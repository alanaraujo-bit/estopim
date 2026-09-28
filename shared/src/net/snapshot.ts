import { B, T } from '../sim/constants';
import type { Game } from '../sim/game';
import type { Bomb, Enemy, GEvent, Hazard, Player, Projectile, RoundResult } from '../sim/types';

// Campos numéricos do jogador em ordem fixa (compacto em JSON).
const PF = [
  'x', 'y', 'dir', 'moving', 'alive', 'hp', 'maxHp', 'invuln', 'bombsMax', 'range', 'speedLvl', 'kick', 'shield', 'cart', 'cartCharges',
  'abilityCd', 'abilityMax', 'curse', 'curseT', 'dashT', 'dashDir', 'jumpT', 'jumpDur', 'jumpFx', 'jumpFy', 'jumpTx', 'jumpTy', 'invisT',
  'stunT', 'chillT', 'slideDir', 'knockT', 'knockDir', 'tpLock', 'respawnT', 'deadT', 'killedBy', 'score', 'carrying', 'potatoT', 'lastSeq', 'connected', 'team',
] as const;
const BF = ['id', 'owner', 'kind', 'x', 'y', 'vx', 'vy', 'speed', 'fuse', 'maxFuse', 'range', 'frozen', 'pierce', 'armed', 'hidden', 'chainDepth', 'z', 'prog', 'conv', 'kickedBy'] as const;
const EF = ['id', 'x', 'y', 'dir', 'hp', 'maxHp', 'state', 'timer', 'timer2', 'alive', 'deadT', 'boss', 'size', 'flags', 'spawnT', 'tele', 'stunT', 'invuln', 'speed'] as const;

const num = (v: any): number => (typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v * 1000) / 1000) : 0);

export interface Snapshot {
  t: 's';
  k: number; // tick
  ph: string;
  pt: number;
  tl: number;
  sd: number;
  p: number[][];
  st: number[][]; // [kills, deaths, blocks, items]
  b: number[][];
  e: (number | string)[][];
  ed: number[][];
  pr: (number | string)[][];
  hz: (number | string)[][];
  f: number[];
  fr: number[];
  ch: number[];
  ct: number[]; // cristais: [i, tileT]
  tiles?: string;
  items?: string;
  floor?: string;
  ms: Record<string, any>;
  hud?: any;
  ev: GEvent[];
  res?: RoundResult | null;
}

const MS_KEYS = ['teamScore', 'holder', 'target', 'core', 'caps', 'teams', 'baseOf', 'carrier', 'wave', 'exitOpen', 'plates', 'elapsed', 'boss', 'bossPhase', 'objectives'];

export function encodeSnapshot(g: Game, opts: { tiles: boolean; floor?: boolean; viewerTeam: number; events: GEvent[] }): Snapshot {
  const snap: Snapshot = {
    t: 's',
    k: g.tick,
    ph: g.phase,
    pt: g.phaseT,
    tl: g.timeLeft,
    sd: g.sudden ? 1 : 0,
    p: g.players.map((p) => PF.map((k) => num((p as any)[k]))),
    st: g.players.map((p) => [p.stats.kills, p.stats.deaths, p.stats.blocks, p.stats.items]),
    b: [],
    e: [],
    ed: [],
    pr: g.projectiles.map((pr) => [pr.id, pr.kind, num(pr.x), num(pr.y), num(pr.vx), num(pr.vy), pr.life]),
    hz: g.hazards.map((h) => [h.x, h.y, h.t, h.total, h.kind, h.data ?? 0]),
    f: [],
    fr: [],
    ch: [],
    ct: [],
    ms: {},
    ev: opts.events,
    res: g.result,
  };
  for (const b of g.bombs) {
    // minas inimigas armadas não são enviadas (anti-trapaça)
    if (b.kind === B.Mine && b.armed > 50) {
      const owner = g.players[b.owner];
      if (owner && owner.team !== opts.viewerTeam) continue;
    }
    snap.b.push(BF.map((k) => num((b as any)[k])));
  }
  for (const e of g.enemies) {
    snap.e.push([e.type, ...EF.map((k) => num((e as any)[k]))]);
    snap.ed.push(e.data.map(num));
  }
  const n = g.flame.length;
  for (let i = 0; i < n; i++) {
    if (g.flame[i]) snap.f.push(i, g.flame[i], g.flameOwner[i], g.flameKind[i], g.flameDir[i], g.flameSrc[i]);
    if (g.frostT[i]) snap.fr.push(i, g.frostT[i]);
    if (g.chillT[i]) snap.ch.push(i, g.chillT[i], g.chillOwner[i]);
    if (g.tiles[i] === T.Crystal) snap.ct.push(i, g.tileT[i]);
  }
  if (opts.tiles) {
    snap.tiles = String.fromCharCode(...Array.from(g.tiles, (t) => 48 + t));
    // só itens visíveis (tile vazio) — itens sob blocos nunca saem do servidor
    snap.items = String.fromCharCode(...Array.from(g.items, (it, i) => 48 + (g.tiles[i] === T.Empty ? it : 0)));
  }
  if (opts.floor) snap.floor = String.fromCharCode(...Array.from(g.floor, (f) => 48 + f));
  for (const k of MS_KEYS) if (g.mstate[k] !== undefined) snap.ms[k] = g.mstate[k];
  snap.hud = g.ctl.hud?.(g);
  return snap;
}

/** Aplica um snapshot numa réplica local do jogo. */
export function applySnapshot(g: Game, s: Snapshot) {
  g.tick = s.k;
  g.phase = s.ph as any;
  g.phaseT = s.pt;
  g.timeLeft = s.tl;
  g.sudden = !!s.sd;
  s.p.forEach((arr, idx) => {
    const p = g.players[idx] as any;
    if (!p) return;
    PF.forEach((k, j) => {
      const v = arr[j];
      if (k === 'moving' || k === 'alive' || k === 'kick' || k === 'connected') p[k] = !!v;
      else p[k] = v;
    });
    const st = s.st[idx];
    if (st) {
      p.stats.kills = st[0];
      p.stats.deaths = st[1];
      p.stats.blocks = st[2];
      p.stats.items = st[3];
    }
  });
  // cargas: reconstrói preservando objetos por id (interpolação estável)
  const byId = new Map(g.bombs.map((b) => [b.id, b]));
  g.bombs = s.b.map((arr) => {
    const id = arr[0];
    const b = (byId.get(id) ?? ({} as Bomb)) as any;
    BF.forEach((k, j) => {
      const v = arr[j];
      b[k] = k === 'hidden' || k === 'conv' ? !!v : v;
    });
    b.passers ??= 0;
    b.chainFrom ??= b.owner;
    b.pulled ??= false;
    b.tpLock ??= 0;
    return b as Bomb;
  });
  const eById = new Map(g.enemies.map((e) => [e.id, e]));
  g.enemies = s.e.map((arr, idx) => {
    const id = arr[1] as number;
    const e = (eById.get(id) ?? ({ path: [], tx: 0, ty: 0 } as unknown as Enemy)) as any;
    e.type = arr[0];
    EF.forEach((k, j) => {
      const v = arr[j + 1];
      e[k] = k === 'alive' || k === 'boss' ? !!v : v;
    });
    e.data = s.ed[idx] ?? [0, 0, 0, 0];
    return e as Enemy;
  });
  g.projectiles = s.pr.map((a) => ({ id: a[0] as number, kind: a[1] as Projectile['kind'], x: a[2] as number, y: a[3] as number, vx: a[4] as number, vy: a[5] as number, life: a[6] as number, owner: -1 }));
  g.hazards = s.hz.map((a) => ({ x: a[0] as number, y: a[1] as number, t: a[2] as number, total: a[3] as number, kind: a[4] as Hazard['kind'], data: a[5] as number }));
  g.flame.fill(0);
  g.flameDir.fill(0);
  for (let k = 0; k < s.f.length; k += 6) {
    const i = s.f[k];
    g.flame[i] = s.f[k + 1];
    g.flameOwner[i] = s.f[k + 2];
    g.flameKind[i] = s.f[k + 3];
    g.flameDir[i] = s.f[k + 4];
    g.flameSrc[i] = s.f[k + 5];
  }
  g.frostT.fill(0);
  for (let k = 0; k < s.fr.length; k += 2) g.frostT[s.fr[k]] = s.fr[k + 1];
  g.chillT.fill(0);
  for (let k = 0; k < s.ch.length; k += 3) {
    g.chillT[s.ch[k]] = s.ch[k + 1];
    g.chillOwner[s.ch[k]] = s.ch[k + 2];
  }
  if (s.tiles) {
    for (let i = 0; i < s.tiles.length; i++) g.tiles[i] = s.tiles.charCodeAt(i) - 48;
    g.tilesVer++;
  }
  if (s.items) for (let i = 0; i < s.items.length; i++) g.items[i] = s.items.charCodeAt(i) - 48;
  if (s.floor) for (let i = 0; i < s.floor.length; i++) g.floor[i] = s.floor.charCodeAt(i) - 48;
  for (let k = 0; k < s.ct.length; k += 2) g.tileT[s.ct[k]] = s.ct[k + 1];
  for (const [k, v] of Object.entries(s.ms)) g.mstate[k] = v;
  (g as any).remoteHud = s.hud;
  if (s.res !== undefined) g.result = s.res;
  g.events = s.ev ?? [];
}

export type { Player };
