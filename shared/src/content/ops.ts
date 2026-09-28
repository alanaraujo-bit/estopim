import { CHARACTERS, type CharId } from './characters';
import { COSMETIC_BY_ID } from './cosmetics';
import { MISSION_BY_ID } from './campaign';
import {
  addXp,
  applyMatch,
  checkAchievements,
  claimAchievement,
  claimChallenge,
  claimSeason,
  computeMatchRewards,
  grant,
  progressChallenges,
  type MatchRewards,
  type MatchSummary,
  type Profile,
} from './progression';

export type Op =
  | { k: 'match'; s: MatchSummary; at: number }
  | { k: 'mission'; id: string; stars: [boolean, boolean, boolean]; time: number; relic: boolean; at: number }
  | { k: 'claimChallenge'; id: string }
  | { k: 'claimAch'; id: string }
  | { k: 'claimSeason'; tier: number }
  | { k: 'buy'; id: string }
  | { k: 'equip'; slot: 'skin' | 'bomb' | 'trail' | 'victory' | 'banner' | 'frame' | 'title' | 'emote'; id: string; char?: CharId; index?: number }
  | { k: 'name'; name: string }
  | { k: 'fav'; char: CharId }
  | { k: 'tutorial' };

export interface OpResult {
  ok: boolean;
  error?: string;
  events: string[];
  rewards?: MatchRewards;
  missionRewards?: { xp: number; sparks: number; firstClear: boolean; newStars: number };
}

export function sanitizeName(raw: string): string {
  const s = raw.normalize('NFC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s;
}

const BAD = ['porra', 'caralho', 'buceta', 'puta', 'viado', 'merda', 'fdp', 'arrombado', 'cu ', 'nazi', 'hitler'];
export function isNameAllowed(name: string) {
  const n = ' ' + name.toLowerCase() + ' ';
  return name.length >= 3 && !BAD.some((b) => n.includes(b));
}

/** Limites de plausibilidade para relatórios de partida vindos do cliente. */
export function clampSummary(s: MatchSummary): MatchSummary {
  const secs = Math.max(0, Math.min(3600, s.seconds | 0));
  const perMin = Math.max(1, secs / 60);
  return {
    ...s,
    rounds: Math.max(1, Math.min(9, s.rounds | 0)),
    roundWins: Math.max(0, Math.min(5, s.roundWins | 0)),
    kills: Math.max(0, Math.min(Math.ceil(perMin * 6), s.kills | 0, 60)),
    deaths: Math.max(0, Math.min(99, s.deaths | 0)),
    blocks: Math.max(0, Math.min(Math.ceil(perMin * 70), s.blocks | 0, 900)),
    items: Math.max(0, Math.min(Math.ceil(perMin * 25), s.items | 0, 200)),
    bombs: Math.max(0, Math.min(2000, s.bombs | 0)),
    chain: Math.max(0, Math.min(12, s.chain | 0)),
    abilities: Math.max(0, Math.min(Math.ceil(perMin * 10), s.abilities | 0)),
    nearMiss: Math.max(0, Math.min(Math.ceil(perMin * 10), s.nearMiss | 0)),
    flawless: Math.max(0, Math.min(5, s.flawless | 0)),
    seconds: secs,
    players: Math.max(1, Math.min(8, s.players | 0)),
    char: CHARACTERS[s.char] ? s.char : 'faisca',
  };
}

export function applyOp(p: Profile, op: Op, opts: { trusted: boolean; now?: number } = { trusted: false }): OpResult {
  const now = opts.now ?? Date.now();
  const ev: string[] = [];
  switch (op.k) {
    case 'match': {
      const s = opts.trusted ? op.s : clampSummary(op.s);
      if (!opts.trusted && (s.online || s.ranked)) return { ok: false, error: 'Partidas online são registradas pelo servidor.', events: [] };
      if (!p.unlockedChars.includes(s.char) && !opts.trusted) s.char = 'faisca';
      const rewards = computeMatchRewards(s, p, now);
      applyMatch(p, s, rewards, now);
      checkAchievements(p, ev);
      return { ok: true, events: ev, rewards };
    }
    case 'mission': {
      const m = MISSION_BY_ID[op.id];
      if (!m) return { ok: false, error: 'Missão desconhecida.', events: [] };
      // pré-requisito: missão anterior concluída
      if (m.requires && !p.campaign[m.requires]?.done && !opts.trusted) return { ok: false, error: 'Missão bloqueada.', events: [] };
      const rec = (p.campaign[op.id] ??= { done: false, stars: [false, false, false], best: 0 });
      const first = !rec.done;
      let newStars = 0;
      op.stars.forEach((s, i) => {
        if (s && !rec.stars[i]) {
          rec.stars[i] = true;
          newStars++;
        }
      });
      rec.done = true;
      const t = Math.max(1, Math.round(op.time));
      rec.best = rec.best ? Math.min(rec.best, t) : t;
      if (op.relic && !rec.relic) {
        rec.relic = true;
        p.stats.secrets++;
      }
      const xp = (first ? 260 : 60) + newStars * 70;
      const sparks = (first ? 150 : 30) + newStars * 45;
      addXp(p, xp, ev);
      p.sparks += sparks;
      p.season.xp += Math.round(xp * 0.8);
      p.stats.missions++;
      if (first && m.reward) grant(p, m.reward, ev);
      progressChallenges(p, { missions: 1, stars: newStars });
      checkAchievements(p, ev);
      return { ok: true, events: ev, missionRewards: { xp, sparks, firstClear: first, newStars } };
    }
    case 'claimChallenge':
      return { ok: claimChallenge(p, op.id), events: ev };
    case 'claimAch':
      return { ok: claimAchievement(p, op.id), events: ev };
    case 'claimSeason':
      return { ok: claimSeason(p, op.tier), events: ev };
    case 'buy': {
      const c = COSMETIC_BY_ID[op.id];
      if (!c || c.source !== 'loja' || !c.price) return { ok: false, error: 'Item indisponível.', events: [] };
      if (p.inventory.includes(c.id)) return { ok: false, error: 'Você já tem este item.', events: [] };
      if (p.sparks < c.price) return { ok: false, error: 'Faíscas insuficientes.', events: [] };
      p.sparks -= c.price;
      p.inventory.push(c.id);
      return { ok: true, events: ['item:' + c.id] };
    }
    case 'equip': {
      const c = COSMETIC_BY_ID[op.id];
      const owned = p.inventory.includes(op.id);
      if (op.slot === 'skin') {
        const ch = op.char;
        if (!ch || !CHARACTERS[ch]) return { ok: false, error: 'Personagem inválido.', events: [] };
        if (op.id === 'base') {
          delete p.equipped.skins[ch];
          return { ok: true, events: [] };
        }
        if (!c || c.char !== ch || !owned) return { ok: false, error: 'Visual indisponível.', events: [] };
        p.equipped.skins[ch] = op.id;
        return { ok: true, events: [] };
      }
      if (!c || !owned || c.kind !== op.slot) return { ok: false, error: 'Item indisponível.', events: [] };
      if (op.slot === 'emote') {
        const idx = Math.max(0, Math.min(3, op.index ?? 0));
        const list = p.equipped.emotes.slice(0, 4);
        const prev = list.indexOf(op.id);
        if (prev >= 0) list[prev] = list[idx];
        list[idx] = op.id;
        p.equipped.emotes = list;
      } else (p.equipped as any)[op.slot] = op.id;
      return { ok: true, events: [] };
    }
    case 'name': {
      const n = sanitizeName(op.name);
      if (!isNameAllowed(n)) return { ok: false, error: 'Escolha um nome com 3 a 16 caracteres, sem palavras ofensivas.', events: [] };
      p.name = n;
      return { ok: true, events: [] };
    }
    case 'fav': {
      if (!p.unlockedChars.includes(op.char)) return { ok: false, error: 'Personagem bloqueado.', events: [] };
      p.favoriteChar = op.char;
      return { ok: true, events: [] };
    }
    case 'tutorial':
      p.tutorialDone = true;
      return { ok: true, events: [] };
  }
  return { ok: false, error: 'Operação inválida.', events: [] };
}
