import { CHAR_ORDER, type CharId } from './characters';
import { Rng, hashStr } from '../sim/rng';

// ───────────────────────── Perfil ─────────────────────────
export interface CampaignRecord {
  done: boolean;
  stars: [boolean, boolean, boolean];
  best: number; // melhor tempo em segundos
  relic?: boolean;
}

export interface ChallengeState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface Stats {
  matches: number;
  wins: number;
  rounds: number;
  roundWins: number;
  kills: number;
  deaths: number;
  blocks: number;
  items: number;
  bombs: number;
  bestChain: number;
  abilities: number;
  nearMiss: number;
  playSeconds: number;
  flawless: number;
  onlineMatches: number;
  missions: number;
  secrets: number;
  byChar: Record<string, { m: number; w: number }>;
  byMode: Record<string, { m: number; w: number }>;
}

export interface Profile {
  v: number;
  id: string;
  name: string;
  tag: string;
  createdAt: number;
  level: number;
  xp: number;
  sparks: number;
  inventory: string[];
  equipped: {
    skins: Partial<Record<CharId, string>>;
    bomb: string;
    trail: string;
    emotes: string[];
    victory: string;
    banner: string;
    frame: string;
    title: string;
  };
  favoriteChar: CharId;
  unlockedChars: CharId[];
  mastery: Partial<Record<CharId, number>>; // xp de maestria
  campaign: Record<string, CampaignRecord>;
  stats: Stats;
  achievements: Record<string, { done: boolean; claimed: boolean; at?: number }>;
  daily: { key: string; list: ChallengeState[] };
  weekly: { key: string; list: ChallengeState[] };
  season: { id: string; xp: number; claimed: number[] };
  ranked: { mmr: number; games: number; wins: number; peak: number };
  tutorialDone: boolean;
  firstWinDay: string;
  news: string[]; // itens vistos
}

export const emptyStats = (): Stats => ({
  matches: 0,
  wins: 0,
  rounds: 0,
  roundWins: 0,
  kills: 0,
  deaths: 0,
  blocks: 0,
  items: 0,
  bombs: 0,
  bestChain: 0,
  abilities: 0,
  nearMiss: 0,
  playSeconds: 0,
  flawless: 0,
  onlineMatches: 0,
  missions: 0,
  secrets: 0,
  byChar: {},
  byMode: {},
});

export function newProfile(id: string, name: string): Profile {
  return {
    v: 1,
    id,
    name,
    tag: String(1000 + (hashStr(id) % 9000)),
    createdAt: Date.now(),
    level: 1,
    xp: 0,
    sparks: 300,
    inventory: ['classica', 'nenhum', 'aceno', 'gg', 'risada', 'susto', 'danca', 'faixa-pavio', 'moldura-simples', 'titulo-novato'],
    equipped: {
      skins: {},
      bomb: 'classica',
      trail: 'nenhum',
      emotes: ['aceno', 'gg', 'risada', 'susto'],
      victory: 'danca',
      banner: 'faixa-pavio',
      frame: 'moldura-simples',
      title: 'titulo-novato',
    },
    favoriteChar: 'faisca',
    unlockedChars: ['faisca', 'tuba', 'lume'],
    mastery: {},
    campaign: {},
    stats: emptyStats(),
    achievements: {},
    daily: { key: '', list: [] },
    weekly: { key: '', list: [] },
    season: { id: SEASON.id, xp: 0, claimed: [] },
    ranked: { mmr: 1000, games: 0, wins: 0, peak: 1000 },
    tutorialDone: false,
    firstWinDay: '',
    news: [],
  };
}

// ───────────────────────── Níveis ─────────────────────────
export const MAX_LEVEL = 100;
export const xpToNext = (level: number) => Math.round(420 + Math.min(level - 1, 60) * 115);

export interface Reward {
  sparks?: number;
  xp?: number;
  seasonXp?: number;
  item?: string; // cosmético
  char?: CharId;
}

/** Recompensas ao atingir cada nível. */
export function levelReward(level: number): Reward {
  const table: Record<number, Reward> = {
    2: { item: 'brasas', sparks: 100 },
    3: { char: 'mola', sparks: 100 },
    4: { item: 'fogo', sparks: 100 },
    5: { char: 'magna', sparks: 150 },
    6: { item: 'faixa-orbita', sparks: 100 },
    7: { item: 'zabumba', sparks: 150 },
    8: { char: 'vulto', sparks: 150 },
    10: { item: 'moldura-brasa', sparks: 300 },
    20: { item: 'titulo-fogueteiro', sparks: 500 },
  };
  return table[level] ?? { sparks: level % 5 === 0 ? 250 : 120 };
}

// ───────────────────────── Maestria ─────────────────────────
export const MASTERY_LEVELS = [0, 300, 800, 1600, 2800, 4500, 7000, 10000, 14000, 20000];
export function masteryLevel(xp: number): number {
  let l = 0;
  for (let k = 0; k < MASTERY_LEVELS.length; k++) if (xp >= MASTERY_LEVELS[k]) l = k + 1;
  return l;
}
export const MASTERY_REWARDS: Record<number, (c: CharId) => Reward> = {
  3: () => ({ sparks: 200 }),
  5: () => ({ sparks: 400 }),
  7: () => ({ sparks: 600 }),
  10: (c) => ({ item: `${c}-ouro` }),
};

// ───────────────────────── Temporada ─────────────────────────
export const SEASON = {
  id: 't1',
  name: 'Temporada 1 — Arraiá do Pavio',
  desc: 'A Vila Pavio está em festa. Complete desafios, suba de faixa e ganhe visuais juninos.',
  tierXp: 1000,
  tiers: 30,
  ends: '2026-12-15',
};

export function seasonReward(tier: number): Reward {
  const special: Record<number, Reward> = {
    1: { item: 'faixa-bandeirinhas' },
    3: { sparks: 200 },
    5: { item: 'caju' },
    8: { item: 'pensando' },
    10: { item: 'lume-aurora' },
    13: { sparks: 400 },
    15: { item: 'notas' },
    20: { item: 'faisca-quadrilha' },
    25: { sparks: 800 },
    30: { item: 'titulo-intocavel' },
  };
  return special[tier] ?? { sparks: 100 + tier * 5 };
}

// ───────────────────────── Desafios ─────────────────────────
export interface ChallengeDef {
  id: string;
  text: string;
  stat: string; // chave do resumo de partida
  target: number;
  reward: Reward;
  weekly?: boolean;
}

const DAILY_POOL: ChallengeDef[] = [
  { id: 'd-win2', text: 'Vença 2 partidas', stat: 'wins', target: 2, reward: { sparks: 120, seasonXp: 400 } },
  { id: 'd-kills5', text: 'Elimine 5 adversários', stat: 'kills', target: 5, reward: { sparks: 100, seasonXp: 350 } },
  { id: 'd-blocks60', text: 'Destrua 60 blocos', stat: 'blocks', target: 60, reward: { sparks: 90, seasonXp: 300 } },
  { id: 'd-items20', text: 'Colete 20 Brasas', stat: 'items', target: 20, reward: { sparks: 90, seasonXp: 300 } },
  { id: 'd-chain', text: 'Provoque uma reação em cadeia de 3 cargas', stat: 'chain3', target: 1, reward: { sparks: 110, seasonXp: 350 } },
  { id: 'd-abil10', text: 'Use sua técnica 10 vezes', stat: 'abilities', target: 10, reward: { sparks: 80, seasonXp: 300 } },
  { id: 'd-matches3', text: 'Jogue 3 partidas', stat: 'matches', target: 3, reward: { sparks: 80, seasonXp: 300 } },
  { id: 'd-mission', text: 'Conclua uma missão da campanha', stat: 'missions', target: 1, reward: { sparks: 100, seasonXp: 350 } },
  { id: 'd-special', text: 'Jogue um modo especial', stat: 'special', target: 1, reward: { sparks: 90, seasonXp: 300 } },
  { id: 'd-near', text: 'Escape por um triz 5 vezes', stat: 'nearMiss', target: 5, reward: { sparks: 90, seasonXp: 300 } },
];

const WEEKLY_POOL: ChallengeDef[] = [
  { id: 'w-win10', text: 'Vença 10 partidas', stat: 'wins', target: 10, reward: { sparks: 500, seasonXp: 1500 }, weekly: true },
  { id: 'w-kills30', text: 'Elimine 30 adversários', stat: 'kills', target: 30, reward: { sparks: 450, seasonXp: 1400 }, weekly: true },
  { id: 'w-blocks400', text: 'Destrua 400 blocos', stat: 'blocks', target: 400, reward: { sparks: 400, seasonXp: 1200 }, weekly: true },
  { id: 'w-online', text: 'Jogue 5 partidas online', stat: 'online', target: 5, reward: { sparks: 450, seasonXp: 1500 }, weekly: true },
  { id: 'w-stars', text: 'Ganhe 6 estrelas na campanha', stat: 'stars', target: 6, reward: { sparks: 500, seasonXp: 1500 }, weekly: true },
  { id: 'w-chars', text: 'Vença com 3 personagens diferentes', stat: 'charWins', target: 3, reward: { sparks: 450, seasonXp: 1400 }, weekly: true },
];

export const CHALLENGES: Record<string, ChallengeDef> = Object.fromEntries([...DAILY_POOL, ...WEEKLY_POOL].map((c) => [c.id, c]));

/** Chave do dia no fuso de Brasília. */
export function dayKey(now = Date.now()): string {
  const d = new Date(now - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
export function weekKey(now = Date.now()): string {
  const d = new Date(now - 3 * 3600 * 1000);
  const day = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - day);
  return 'w' + d.toISOString().slice(0, 10);
}

export function rollChallenges(p: Profile, now = Date.now()) {
  const dk = dayKey(now);
  if (p.daily.key !== dk) {
    const rng = new Rng(hashStr(p.id + dk));
    const pool = rng.shuffle(DAILY_POOL.slice()).slice(0, 3);
    p.daily = { key: dk, list: pool.map((c) => ({ id: c.id, progress: 0, claimed: false })) };
  }
  const wk = weekKey(now);
  if (p.weekly.key !== wk) {
    const rng = new Rng(hashStr(p.id + wk));
    const pool = rng.shuffle(WEEKLY_POOL.slice()).slice(0, 3);
    p.weekly = { key: wk, list: pool.map((c) => ({ id: c.id, progress: 0, claimed: false })) };
  }
}

// ───────────────────────── Conquistas ─────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (p: Profile) => number; // progresso atual
  target: number;
  reward: Reward;
  hidden?: boolean;
}

const campaignDone = (p: Profile, ch: number) => Object.entries(p.campaign).filter(([k, v]) => k.startsWith(ch + '-') && v.done).length;
const campaignStars = (p: Profile) => Object.values(p.campaign).reduce((a, v) => a + v.stars.filter(Boolean).length, 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeira', name: 'Primeira Faísca', desc: 'Vença sua primeira partida.', check: (p) => p.stats.wins, target: 1, reward: { sparks: 150 } },
  { id: 'vitorias10', name: 'Pavio Aceso', desc: 'Vença 10 partidas.', check: (p) => p.stats.wins, target: 10, reward: { sparks: 300 } },
  { id: 'vitorias100', name: 'Lenda da Vila', desc: 'Vença 100 partidas.', check: (p) => p.stats.wins, target: 100, reward: { item: 'coroa', sparks: 1000 } },
  { id: 'elim50', name: 'Artilheiro', desc: 'Elimine 50 adversários.', check: (p) => p.stats.kills, target: 50, reward: { sparks: 300 } },
  { id: 'elim500', name: 'Mestre da Queima', desc: 'Elimine 500 adversários.', check: (p) => p.stats.kills, target: 500, reward: { item: 'moldura-ouro', sparks: 1000 } },
  { id: 'blocos1000', name: 'Demolidor', desc: 'Destrua 1.000 blocos.', check: (p) => p.stats.blocks, target: 1000, reward: { item: 'titulo-demolidor', sparks: 400 } },
  { id: 'cadeia4', name: 'Efeito Dominó', desc: 'Provoque uma cadeia de 4 cargas.', check: (p) => p.stats.bestChain + 1, target: 4, reward: { sparks: 250 } },
  { id: 'cadeia6', name: 'Estrategista', desc: 'Provoque uma cadeia de 6 cargas.', check: (p) => p.stats.bestChain + 1, target: 6, reward: { item: 'titulo-estrategista', sparks: 500 } },
  { id: 'intocavel', name: 'Nem Chamuscado', desc: 'Vença 10 rodadas sem levar dano.', check: (p) => p.stats.flawless, target: 10, reward: { sparks: 500 } },
  { id: 'triz50', name: 'Por um Triz', desc: 'Escape por um triz 50 vezes.', check: (p) => p.stats.nearMiss, target: 50, reward: { sparks: 300 } },
  { id: 'cap1', name: 'A Vila em Festa', desc: 'Conclua o Capítulo 1.', check: (p) => campaignDone(p, 1), target: 5, reward: { sparks: 300 } },
  { id: 'cap2', name: 'Fogo na Fundição', desc: 'Conclua o Capítulo 2.', check: (p) => campaignDone(p, 2), target: 5, reward: { item: 'faixa-fundicao', sparks: 300 } },
  { id: 'cap3', name: 'Degelo', desc: 'Conclua o Capítulo 3.', check: (p) => campaignDone(p, 3), target: 5, reward: { item: 'moldura-gelo', sparks: 300 } },
  { id: 'cap4', name: 'Luz Dobrada', desc: 'Conclua o Capítulo 4.', check: (p) => campaignDone(p, 4), target: 5, reward: { sparks: 400 } },
  { id: 'cap5', name: 'Raízes', desc: 'Conclua o Capítulo 5.', check: (p) => campaignDone(p, 5), target: 5, reward: { sparks: 400 } },
  { id: 'cap6', name: 'A Centelha Volta', desc: 'Conclua a campanha.', check: (p) => campaignDone(p, 6), target: 5, reward: { item: 'titulo-heroi', sparks: 1000 } },
  { id: 'estrelas30', name: 'Constelação', desc: 'Ganhe 30 estrelas na campanha.', check: campaignStars, target: 30, reward: { sparks: 500 } },
  { id: 'estrelas90', name: 'Céu Estrelado', desc: 'Ganhe 90 estrelas na campanha.', check: campaignStars, target: 90, reward: { item: 'estrelas', sparks: 1500 } },
  { id: 'segredos', name: 'Olho Vivo', desc: 'Encontre 10 relíquias secretas.', check: (p) => p.stats.secrets, target: 10, reward: { sparks: 600 } },
  { id: 'elenco', name: 'Elenco Completo', desc: 'Jogue com todos os personagens.', check: (p) => CHAR_ORDER.filter((c) => (p.stats.byChar[c]?.m ?? 0) > 0).length, target: 8, reward: { sparks: 500 } },
  { id: 'nivel10', name: 'Veterano', desc: 'Alcance o nível 10.', check: (p) => p.level, target: 10, reward: { sparks: 300 } },
  { id: 'nivel25', name: 'Mestre Fogueteiro', desc: 'Alcance o nível 25.', check: (p) => p.level, target: 25, reward: { sparks: 800 } },
  { id: 'online10', name: 'Arena Aberta', desc: 'Jogue 10 partidas online.', check: (p) => p.stats.onlineMatches, target: 10, reward: { sparks: 400 } },
  { id: 'horda', name: 'Linha de Frente', desc: 'Vença uma Horda completa.', check: (p) => p.stats.byMode['horda']?.w ?? 0, target: 1, reward: { sparks: 500 } },
  { id: 'coroa', name: 'Majestade', desc: 'Vença 5 partidas de Coroa.', check: (p) => p.stats.byMode['coroa']?.w ?? 0, target: 5, reward: { sparks: 400 } },
  { id: 'ranque', name: 'Brasa Viva', desc: 'Alcance a divisão Brasa na ranqueada.', check: (p) => (p.ranked.peak >= 1200 ? 1 : 0), target: 1, reward: { sparks: 600 } },
];

// ───────────────────────── Ranqueada ─────────────────────────
export const RANKS = [
  { id: 'faisca', name: 'Faísca', min: 0, color: '#cfc6b8' },
  { id: 'chama', name: 'Chama', min: 1000, color: '#ffb347' },
  { id: 'brasa', name: 'Brasa', min: 1200, color: '#ff7a2f' },
  { id: 'labareda', name: 'Labareda', min: 1400, color: '#ff4d6d' },
  { id: 'fornalha', name: 'Fornalha', min: 1600, color: '#b69cff' },
  { id: 'supernova', name: 'Supernova', min: 1800, color: '#ffe066' },
];
export function rankOf(mmr: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (mmr >= x.min) r = x;
  const idx = RANKS.indexOf(r);
  const next = RANKS[idx + 1];
  const span = next ? next.min - r.min : 200;
  const within = mmr - r.min;
  const div = next ? 3 - Math.min(2, Math.floor((within / span) * 3)) : 0;
  return { ...r, div, label: next ? `${r.name} ${['', 'I', 'II', 'III'][div]}` : r.name, progress: Math.min(1, within / span) };
}
export function eloDelta(a: number, b: number, scoreA: number, games: number): number {
  const k = games < 10 ? 48 : 30;
  const exp = 1 / (1 + Math.pow(10, (b - a) / 400));
  return Math.round(k * (scoreA - exp));
}

// ───────────────────────── Recompensas de partida ─────────────────────────
export interface MatchSummary {
  mode: string;
  char: CharId;
  won: boolean;
  rounds: number;
  roundWins: number;
  kills: number;
  deaths: number;
  blocks: number;
  items: number;
  bombs: number;
  chain: number;
  abilities: number;
  nearMiss: number;
  flawless: number;
  seconds: number;
  online: boolean;
  ranked: boolean;
  vsBots: boolean;
  players: number;
}

export interface MatchRewards {
  xp: number;
  sparks: number;
  seasonXp: number;
  mastery: number;
  breakdown: { label: string; xp: number }[];
  firstWin: boolean;
}

export function computeMatchRewards(s: MatchSummary, p: Profile, now = Date.now()): MatchRewards {
  const bd: { label: string; xp: number }[] = [];
  const add = (label: string, xp: number) => {
    if (xp > 0) bd.push({ label, xp: Math.round(xp) });
  };
  const botMul = s.vsBots && !s.online ? 0.7 : 1;
  add('Participação', 50 + s.rounds * 12);
  if (s.won) add('Vitória', 90 + s.players * 10);
  add('Rodadas vencidas', s.roundWins * 20);
  add('Eliminações', s.kills * 22);
  add('Demolição', Math.min(45, s.blocks));
  add('Brasas coletadas', Math.min(30, s.items * 2));
  if (s.chain >= 2) add('Reação em cadeia', s.chain * 12);
  if (s.flawless) add('Sem dano', s.flawless * 15);
  const firstWin = s.won && p.firstWinDay !== dayKey(now);
  let xp = bd.reduce((a, b) => a + b.xp, 0) * botMul;
  if (firstWin) {
    bd.push({ label: 'Primeira vitória do dia', xp: Math.round(xp) });
    xp *= 2;
  }
  if (s.online) xp *= 1.15;
  const sparks = Math.round((25 + (s.won ? 40 : 0) + s.kills * 4 + s.roundWins * 6) * botMul * (s.ranked ? 1.3 : 1));
  return {
    xp: Math.round(xp),
    sparks,
    seasonXp: Math.round(xp * 0.8),
    mastery: Math.round(xp * 0.6),
    breakdown: bd,
    firstWin,
  };
}

/** Aplica recompensas ao perfil. Retorna eventos (níveis, itens) para a UI celebrar. */
export function grant(p: Profile, r: Reward, events: string[] = []): string[] {
  if (r.sparks) p.sparks += r.sparks;
  if (r.item && !p.inventory.includes(r.item)) {
    p.inventory.push(r.item);
    events.push('item:' + r.item);
  }
  if (r.char && !p.unlockedChars.includes(r.char)) {
    p.unlockedChars.push(r.char);
    events.push('char:' + r.char);
  }
  if (r.seasonXp) p.season.xp += r.seasonXp;
  if (r.xp) addXp(p, r.xp, events);
  return events;
}

export function addXp(p: Profile, xp: number, events: string[] = []): string[] {
  p.xp += xp;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    events.push('level:' + p.level);
    grant(p, levelReward(p.level), events);
  }
  return events;
}

export function addMastery(p: Profile, c: CharId, xp: number, events: string[] = []) {
  const before = masteryLevel(p.mastery[c] ?? 0);
  p.mastery[c] = (p.mastery[c] ?? 0) + xp;
  const after = masteryLevel(p.mastery[c]!);
  for (let l = before + 1; l <= after; l++) {
    events.push(`mastery:${c}:${l}`);
    const rw = MASTERY_REWARDS[l];
    if (rw) grant(p, rw(c), events);
  }
  return events;
}

/** Atualiza estatísticas, desafios e conquistas após uma partida. */
export function applyMatch(p: Profile, s: MatchSummary, rewards: MatchRewards, now = Date.now()): string[] {
  const ev: string[] = [];
  const st = p.stats;
  st.matches++;
  if (s.won) st.wins++;
  st.rounds += s.rounds;
  st.roundWins += s.roundWins;
  st.kills += s.kills;
  st.deaths += s.deaths;
  st.blocks += s.blocks;
  st.items += s.items;
  st.bombs += s.bombs;
  st.bestChain = Math.max(st.bestChain, s.chain);
  st.abilities += s.abilities;
  st.nearMiss += s.nearMiss;
  st.playSeconds += s.seconds;
  st.flawless += s.flawless;
  if (s.online) st.onlineMatches++;
  const bc = (st.byChar[s.char] ??= { m: 0, w: 0 });
  bc.m++;
  if (s.won) bc.w++;
  const bm = (st.byMode[s.mode] ??= { m: 0, w: 0 });
  bm.m++;
  if (s.won) bm.w++;
  if (rewards.firstWin) p.firstWinDay = dayKey(now);
  addXp(p, rewards.xp, ev);
  p.sparks += rewards.sparks;
  p.season.xp += rewards.seasonXp;
  addMastery(p, s.char, rewards.mastery, ev);
  progressChallenges(p, {
    wins: s.won ? 1 : 0,
    kills: s.kills,
    blocks: s.blocks,
    items: s.items,
    chain3: s.chain >= 2 ? 1 : 0,
    abilities: s.abilities,
    matches: 1,
    special: ['coroa', 'chuva', 'brasa', 'captura', 'horda'].includes(s.mode) ? 1 : 0,
    nearMiss: s.nearMiss,
    online: s.online ? 1 : 0,
    charWins: s.won ? 1 : 0,
  });
  checkAchievements(p, ev);
  return ev;
}

export function progressChallenges(p: Profile, delta: Record<string, number>) {
  rollChallenges(p);
  for (const list of [p.daily.list, p.weekly.list]) {
    for (const c of list) {
      const def = CHALLENGES[c.id];
      if (!def || c.claimed) continue;
      const d = delta[def.stat] ?? 0;
      if (d > 0) c.progress = Math.min(def.target, c.progress + d);
    }
  }
}

export function checkAchievements(p: Profile, ev: string[] = []) {
  for (const a of ACHIEVEMENTS) {
    const st = (p.achievements[a.id] ??= { done: false, claimed: false });
    if (!st.done && a.check(p) >= a.target) {
      st.done = true;
      st.at = Date.now();
      ev.push('ach:' + a.id);
    }
  }
  return ev;
}

export function claimChallenge(p: Profile, id: string): boolean {
  for (const list of [p.daily.list, p.weekly.list]) {
    const c = list.find((x) => x.id === id);
    const def = CHALLENGES[id];
    if (c && def && !c.claimed && c.progress >= def.target) {
      c.claimed = true;
      grant(p, def.reward);
      return true;
    }
  }
  return false;
}

export function claimAchievement(p: Profile, id: string): boolean {
  const st = p.achievements[id];
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (st && def && st.done && !st.claimed) {
    st.claimed = true;
    grant(p, def.reward);
    return true;
  }
  return false;
}

export function seasonTier(p: Profile) {
  return Math.min(SEASON.tiers, Math.floor(p.season.xp / SEASON.tierXp));
}

export function claimSeason(p: Profile, tier: number): boolean {
  if (tier < 1 || tier > seasonTier(p) || p.season.claimed.includes(tier)) return false;
  p.season.claimed.push(tier);
  grant(p, seasonReward(tier));
  return true;
}
