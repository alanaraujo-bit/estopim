import type { CharId } from '../content/characters';
import type { BombKind } from './constants';

export interface Cosmetics {
  skin: string; // id da skin (paleta/visual)
  bomb: string; // skin de carga
  trail: string; // rastro
  emote?: string[];
  victory?: string;
  banner?: string;
  frame?: string;
  title?: string;
}

export interface PlayerSetup {
  name: string;
  char: CharId;
  team: number;
  bot?: 0 | 1 | 2 | 3; // 0 = humano, 1..3 = dificuldade do bot
  cosmetics?: Cosmetics;
  accountId?: string;
}

export interface PlayerInput {
  /** direção desejada: -1 nenhuma, 0..3 */
  dir: number;
  bomb: boolean; // borda (pressionou neste tick)
  ability: boolean;
  cart: boolean;
  seq?: number;
}

export const NO_INPUT: PlayerInput = { dir: -1, bomb: false, ability: false, cart: false };

export interface PStats {
  kills: number;
  deaths: number;
  selfKills: number;
  blocks: number;
  items: number;
  bombs: number;
  abilities: number;
  chains: number; // maior cadeia disparada
  dmgTaken: number;
  objectives: number;
  survivedTicks: number;
  nearMiss: number;
}

export interface Player {
  id: number;
  name: string;
  char: CharId;
  team: number;
  bot: number;
  cosmetics: Cosmetics;
  x: number;
  y: number;
  dir: number; // direção para onde olha
  moving: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  invuln: number;
  bombsMax: number;
  range: number;
  speedLvl: number;
  kick: boolean;
  shield: number;
  cart: BombKind | 0;
  cartCharges: number;
  abilityCd: number;
  abilityMax: number;
  curse: number;
  curseT: number;
  // estados de técnica / movimento
  dashT: number;
  dashDir: number;
  jumpT: number;
  jumpDur: number;
  jumpFx: number;
  jumpFy: number;
  jumpTx: number;
  jumpTy: number;
  invisT: number;
  stunT: number;
  chillT: number;
  slideDir: number; // gelo
  knockT: number;
  knockDir: number;
  tpLock: number; // evita teleporte em loop
  respawnT: number;
  deadT: number; // ticks desde a morte (animação)
  killedBy: number; // -1 ambiente, -2 inimigo, id do jogador
  score: number;
  carrying: number; // núcleo (modo captura): 1 se carregando
  potatoT: number; // brasa quente
  lastSeq: number;
  connected: boolean;
  stats: PStats;
}

export interface Bomb {
  id: number;
  owner: number; // id do jogador; -1 ambiente; -2 inimigo
  kind: BombKind;
  x: number;
  y: number;
  vx: number; // direção de deslize (-1,0,1)
  vy: number;
  speed: number; // tiles/s quando deslizando
  fuse: number;
  maxFuse: number;
  range: number;
  frozen: number;
  pierce: number;
  passers: number; // bitmask de jogadores autorizados a sobrepor
  armed: number; // minas
  hidden: boolean; // pavio oculto (Vulto)
  chainFrom: number; // id do jogador que causou a cadeia
  chainDepth: number;
  z: number; // altura visual (queda da chuva)
  pulled: boolean;
  prog: number; // progresso do deslize até o próximo tile (0..1)
  conv: boolean; // movida por esteira
  tpLock: number;
  kickedBy: number;
}

export interface Enemy {
  id: number;
  type: string;
  x: number;
  y: number;
  dir: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: number;
  timer: number;
  timer2: number;
  tx: number; // alvo atual
  ty: number;
  invuln: number;
  alive: boolean;
  deadT: number;
  boss: boolean;
  size: number; // em tiles (1 normal; 2/3 chefes)
  flags: number;
  data: number[];
  path: number[];
  spawnT: number;
  tele: number; // telegráfico visual (0..1)
  stunT: number;
}

export interface Projectile {
  id: number;
  kind: 'shard' | 'orb' | 'laser' | 'spore' | 'rock';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: number;
}

/** Ataques telegrafados: o piso avisa e depois atinge. */
export interface Hazard {
  x: number;
  y: number;
  t: number; // ticks até impactar
  total: number;
  kind: 'fall' | 'vent' | 'rain' | 'strike' | 'laser' | 'crush' | 'frost';
  data?: number;
}

export type GEvent =
  | { e: 'place'; x: number; y: number; k: number; p: number }
  | { e: 'boom'; x: number; y: number; k: number; p: number; r: number; chain: number }
  | { e: 'block'; x: number; y: number; t: number; item: number }
  | { e: 'item'; x: number; y: number; i: number }
  | { e: 'burnItem'; x: number; y: number; i: number }
  | { e: 'pickup'; p: number; i: number; x: number; y: number }
  | { e: 'hit'; p: number; by: number; x: number; y: number; shield: boolean }
  | { e: 'death'; p: number; by: number; x: number; y: number }
  | { e: 'kick'; p: number; x: number; y: number }
  | { e: 'ability'; p: number; a: string; x: number; y: number; d: number; ok: boolean }
  | { e: 'teleport'; x: number; y: number; x2: number; y2: number }
  | { e: 'curse'; p: number; c: number; from: number }
  | { e: 'fall'; x: number; y: number }
  | { e: 'vent'; x: number; y: number }
  | { e: 'enemyHit'; id: number; x: number; y: number; dead: boolean; boss: boolean }
  | { e: 'enemyAct'; id: number; a: string; x: number; y: number; d?: number }
  | { e: 'obj'; msg: string; kind: 'progress' | 'done' | 'fail' | 'info' }
  | { e: 'score'; p: number; v: number }
  | { e: 'respawn'; p: number; x: number; y: number }
  | { e: 'pulse'; x: number; y: number }
  | { e: 'freeze'; x: number; y: number }
  | { e: 'sudden' }
  | { e: 'door'; x: number; y: number }
  | { e: 'regrow'; x: number; y: number }
  | { e: 'core'; p: number; a: 'take' | 'drop' | 'score' | 'reset'; x: number; y: number }
  | { e: 'nearMiss'; p: number };

export type Phase = 'intro' | 'countdown' | 'play' | 'ending' | 'over';

export interface RoundResult {
  winnerTeam: number; // -1 empate
  winners: number[]; // ids de jogadores vencedores
  reason: string;
  /** para missões */
  success?: boolean;
  stars?: boolean[];
}
