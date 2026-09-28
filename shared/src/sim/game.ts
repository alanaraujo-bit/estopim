import { CHARACTERS } from '../content/characters';
import { CARTRIDGES, CART_POOL } from '../content/items';
import type { MapDef } from '../content/maps';
import {
  B,
  BASE_FUSE,
  CHAIN_DELAY,
  CONVEYOR_SPEED,
  CURSES,
  DX,
  DY,
  F,
  FLAME_TIME,
  I,
  KICK_SPEED,
  SPEEDS,
  T,
  opposite,
  secs,
} from './constants';
import { defaultItemPlan, parseMap, type ItemPlan } from './map';
import { Rng } from './rng';
import type { Bomb, Enemy, GEvent, Hazard, Phase, Player, PlayerInput, PlayerSetup, Projectile, RoundResult } from './types';

export type ModeId = 'classico' | 'equipes' | 'coroa' | 'chuva' | 'brasa' | 'captura' | 'horda' | 'missao' | 'treino';

export interface Rules {
  roundTime: number; // s
  suddenDeath: boolean;
  suddenAt: number; // s restantes quando o colapso começa
  items: 0 | 1 | 2;
  friendlyFire: boolean;
  abilities: boolean;
  cartridges: boolean;
  curses: boolean;
  scatter: boolean; // itens se espalham ao morrer
  hp: number;
  respawn: boolean;
  respawnTime: number; // s
  startBombs?: number;
  startRange?: number;
  startSpeed?: number;
  itemPlan?: ItemPlan;
}

export const DEFAULT_RULES: Rules = {
  roundTime: 150,
  suddenDeath: true,
  suddenAt: 45,
  items: 1,
  friendlyFire: true,
  abilities: true,
  cartridges: true,
  curses: true,
  scatter: true,
  hp: 1,
  respawn: false,
  respawnTime: 3,
};

export interface Controller {
  id: string;
  init?(g: Game): void;
  tick?(g: Game): void;
  onDeath?(g: Game, p: Player, by: number): void;
  onEnemyDeath?(g: Game, e: Enemy, by: number): void;
  onBlock?(g: Game, x: number, y: number, tile: number, by: number): void;
  onTarget?(g: Game, x: number, y: number, by: number): void;
  onPickup?(g: Game, p: Player, item: number): void;
  checkEnd(g: Game): RoundResult | null;
  /** texto do HUD para objetivos */
  hud?(g: Game): HudObjective[];
}

export interface HudObjective {
  text: string;
  done?: boolean;
  optional?: boolean;
  failed?: boolean;
  progress?: number; // 0..1
}

export interface GameSetup {
  map: MapDef;
  mode: ModeId;
  seed: number;
  players: PlayerSetup[];
  rules?: Partial<Rules>;
  controller?: Controller;
  round?: number;
  /** jogadores com vidas (campanha) */
  countdown?: number;
}

export type EnemyUpdate = (g: Game, e: Enemy) => void;
/** onHit recebe o índice do tile em chamas; retorna false para ignorar o dano. */
export const ENEMY_AI: Record<string, { update: EnemyUpdate; onHit?: (g: Game, e: Enemy, by: number, tile: number) => boolean; onDeath?: (g: Game, e: Enemy, by: number) => void }> = {};

const EPS = 1e-4;

export class Game {
  readonly map: MapDef;
  readonly mode: ModeId;
  readonly rules: Rules;
  readonly rng: Rng;
  w: number;
  h: number;
  tiles: Uint8Array;
  floor: Uint8Array;
  fdata: Uint8Array;
  items: Uint8Array;
  itemProt: Uint8Array;
  flame: Uint8Array;
  flameOwner: Int8Array;
  flameKind: Uint8Array;
  flameDir: Uint8Array;
  flameSrc: Int32Array;
  flameRef: Uint8Array; // chama passou por espelho
  frostT: Uint16Array; // gelo temporário
  chillT: Uint8Array; // lentidão (Geada)
  chillOwner: Int8Array;
  tileT: Uint16Array; // prisma / regeneração
  regrow: Uint16Array;
  tpPair: Int32Array;
  spawns: { x: number; y: number }[];
  zone: number[];
  baseA: number[];
  baseB: number[];
  plates: number[];
  exits: number[];
  doors: number[];
  targets: number[];
  marks: Record<string, number[]>;

  players: Player[] = [];
  bombs: Bomb[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  events: GEvent[] = [];

  tick = 0;
  phase: Phase = 'countdown';
  phaseT: number;
  timeLeft: number;
  sudden = false;
  suddenOrder: number[] = [];
  suddenIdx = 0;
  suddenEvery = 1;
  result: RoundResult | null = null;
  pendingEnd = -1;
  nextId = 1;
  tilesVer = 0;
  ctl: Controller;
  round: number;
  dark: boolean;
  /** dados livres para modos/missões */
  mstate: Record<string, any> = {};
  curseLock: number[] = [];
  nearMissCd: number[] = [];
  nearMissCand: boolean[] = [];
  /** somente leitura no cliente: indica se é uma réplica de rede */
  replica = false;

  constructor(setup: GameSetup, ctl: Controller) {
    this.map = setup.map;
    this.mode = setup.mode;
    this.rules = { ...DEFAULT_RULES, ...(setup.rules ?? {}) };
    this.rng = new Rng(setup.seed);
    this.ctl = ctl;
    this.round = setup.round ?? 1;
    this.dark = !!setup.map.dark;
    const r = this.rules;
    const plan = r.itemPlan ?? defaultItemPlan(setup.players.length, r.items, { cartridges: r.cartridges, curses: r.curses });
    const pm = parseMap(setup.map, this.rng, { items: plan, playerCount: setup.players.length });
    this.w = pm.w;
    this.h = pm.h;
    const n = pm.w * pm.h;
    this.tiles = pm.tiles;
    this.floor = pm.floor;
    this.fdata = pm.fdata;
    this.items = pm.items;
    this.tpPair = pm.tpPair;
    this.spawns = pm.spawns;
    this.zone = pm.zone;
    this.baseA = pm.baseA;
    this.baseB = pm.baseB;
    this.plates = pm.plates;
    this.exits = pm.exits;
    this.doors = pm.doors;
    this.targets = pm.targets;
    this.marks = pm.marks;
    this.itemProt = new Uint8Array(n);
    this.flame = new Uint8Array(n);
    this.flameOwner = new Int8Array(n).fill(-1);
    this.flameKind = new Uint8Array(n);
    this.flameDir = new Uint8Array(n);
    this.flameSrc = new Int32Array(n).fill(-1);
    this.flameRef = new Uint8Array(n);
    this.frostT = new Uint16Array(n);
    this.chillT = new Uint8Array(n);
    this.chillOwner = new Int8Array(n).fill(-1);
    this.tileT = new Uint16Array(n);
    this.regrow = new Uint16Array(n);
    this.timeLeft = secs(r.roundTime);
    this.phaseT = setup.countdown ?? secs(3);
    if (this.phaseT <= 0) this.phase = 'play';

    const spawnOrder = this.spawnOrder(setup.players);
    setup.players.forEach((ps, idx) => {
      const sp = this.spawns[spawnOrder[idx] % Math.max(1, this.spawns.length)] ?? { x: 1, y: 1 };
      this.players.push(this.makePlayer(idx, ps, sp.x, sp.y));
      this.curseLock.push(0);
      this.nearMissCd.push(0);
      this.nearMissCand.push(false);
    });
    this.ctl.init?.(this);
  }

  private spawnOrder(players: PlayerSetup[]): number[] {
    const teams = new Set(players.map((p) => p.team));
    if (teams.size === 2 && players.length === 4) {
      // Equipes começam do mesmo lado.
      const order: number[] = [];
      const left = [0, 3],
        right = [2, 1];
      let li = 0,
        ri = 0;
      const firstTeam = players[0].team;
      for (const p of players) order.push(p.team === firstTeam ? left[li++ % 2] : right[ri++ % 2]);
      return order;
    }
    return players.map((_, i) => i);
  }

  makePlayer(id: number, ps: PlayerSetup, x: number, y: number): Player {
    const c = CHARACTERS[ps.char];
    const r = this.rules;
    return {
      id,
      name: ps.name,
      char: ps.char,
      team: ps.team,
      bot: ps.bot ?? 0,
      cosmetics: ps.cosmetics ?? { skin: 'base', bomb: 'classica', trail: 'nenhum' },
      x,
      y,
      dir: 2,
      moving: false,
      alive: true,
      hp: r.hp,
      maxHp: r.hp,
      invuln: 0,
      bombsMax: r.startBombs ?? c.start.bombs,
      range: Math.max(r.startRange ?? 0, c.start.range),
      speedLvl: Math.max(r.startSpeed ?? 0, c.start.speed),
      kick: c.start.kick,
      shield: 0,
      cart: 0,
      cartCharges: 0,
      abilityCd: secs(3),
      abilityMax: secs(c.ability.cooldown),
      curse: 0,
      curseT: 0,
      dashT: 0,
      dashDir: 0,
      jumpT: 0,
      jumpDur: 0,
      jumpFx: 0,
      jumpFy: 0,
      jumpTx: 0,
      jumpTy: 0,
      invisT: 0,
      stunT: 0,
      chillT: 0,
      slideDir: -1,
      knockT: 0,
      knockDir: 0,
      tpLock: 0,
      respawnT: 0,
      deadT: 0,
      killedBy: -1,
      score: 0,
      carrying: 0,
      potatoT: 0,
      lastSeq: 0,
      connected: true,
      stats: {
        kills: 0,
        deaths: 0,
        selfKills: 0,
        blocks: 0,
        items: 0,
        bombs: 0,
        abilities: 0,
        chains: 0,
        dmgTaken: 0,
        objectives: 0,
        survivedTicks: 0,
        nearMiss: 0,
      },
    };
  }

  // ───────────────────────── utilidades de grid ─────────────────────────
  idx(x: number, y: number) {
    return y * this.w + x;
  }
  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  tileAt(x: number, y: number) {
    return this.inb(x, y) ? this.tiles[y * this.w + x] : T.Wall;
  }
  setTile(i: number, t: number) {
    if (this.tiles[i] !== t) {
      this.tiles[i] = t;
      this.tilesVer++;
    }
  }
  isIce(i: number) {
    return this.floor[i] === F.Ice || this.frostT[i] > 0;
  }
  bombTile(b: Bomb): [number, number] {
    return [Math.round(b.x + b.vx * b.prog), Math.round(b.y + b.vy * b.prog)];
  }
  bombAt(x: number, y: number): Bomb | null {
    for (const b of this.bombs) {
      const [bx, by] = this.bombTile(b);
      if (bx === x && by === y) return b;
    }
    return null;
  }
  playerAtTile(x: number, y: number, except?: Player): Player | null {
    for (const p of this.players) {
      if (!p.alive || p === except || p.jumpT > 0) continue;
      if (Math.abs(p.x - x) < 0.75 && Math.abs(p.y - y) < 0.75) return p;
    }
    return null;
  }
  enemyAtTile(x: number, y: number): Enemy | null {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const s = e.size;
      const half = (s - 1) / 2;
      if (Math.abs(e.x - x) <= half + 0.6 && Math.abs(e.y - y) <= half + 0.6) return e;
    }
    return null;
  }
  /** tile está livre de sólidos estáticos (ignora cargas/atores) */
  walkableStatic(x: number, y: number) {
    if (!this.inb(x, y)) return false;
    const i = y * this.w + x;
    return this.tiles[i] === T.Empty && this.floor[i] !== F.Pit;
  }
  solidForActor(ax: number, ay: number, tx: number, ty: number): boolean {
    if (!this.walkableStatic(tx, ty)) return true;
    const b = this.bombAt(tx, ty);
    if (b && !(Math.abs(ax - tx) < 0.999 && Math.abs(ay - ty) < 0.999)) return true;
    return false;
  }
  isEnemyOf(a: Player, b: Player) {
    return a.id !== b.id && a.team !== b.team;
  }
  sameTeam(a: number, b: number) {
    const pa = this.players[a],
      pb = this.players[b];
    return !!pa && !!pb && pa.team === pb.team;
  }

  emit(ev: GEvent) {
    this.events.push(ev);
  }

  // ───────────────────────── movimento ─────────────────────────
  /** Move um ator ao longo das faixas do grid com assistência de curva. Retorna distância movida. */
  moveActor(a: { x: number; y: number }, dir: number, dist: number, solid: (tx: number, ty: number) => boolean): number {
    const dx = DX[dir],
      dy = DY[dir];
    let moved = 0;
    if (dx !== 0) {
      const cy = Math.round(a.y);
      const off = a.y - cy;
      if (Math.abs(off) > EPS) {
        const cx = Math.round(a.x);
        let lane = cy;
        if (solid(cx + dx, cy)) {
          const other = cy + Math.sign(off);
          if (Math.abs(off) > 0.3 && !solid(cx + dx, other) && !solid(cx, other)) lane = other;
          else return 0;
        }
        const need = lane - a.y;
        const step = Math.min(Math.abs(need), dist);
        a.y += Math.sign(need) * step;
        dist -= step;
        moved += step;
        if (Math.abs(a.y - lane) > EPS) return moved;
        a.y = lane;
        if (Math.abs(a.x - cx) < 0.02) a.x = cx;
      }
      const row = Math.round(a.y);
      if (dx > 0) {
        const base = Math.floor(a.x + EPS);
        const limit = solid(base + 1, row) ? base : base + 1;
        const nx = Math.max(a.x, Math.min(a.x + dist, limit));
        moved += nx - a.x;
        a.x = nx;
      } else {
        const base = Math.ceil(a.x - EPS);
        const limit = solid(base - 1, row) ? base : base - 1;
        const nx = Math.min(a.x, Math.max(a.x - dist, limit));
        moved += a.x - nx;
        a.x = nx;
      }
    } else {
      const cx = Math.round(a.x);
      const off = a.x - cx;
      if (Math.abs(off) > EPS) {
        const cy = Math.round(a.y);
        let lane = cx;
        if (solid(cx, cy + dy)) {
          const other = cx + Math.sign(off);
          if (Math.abs(off) > 0.3 && !solid(other, cy + dy) && !solid(other, cy)) lane = other;
          else return 0;
        }
        const need = lane - a.x;
        const step = Math.min(Math.abs(need), dist);
        a.x += Math.sign(need) * step;
        dist -= step;
        moved += step;
        if (Math.abs(a.x - lane) > EPS) return moved;
        a.x = lane;
        if (Math.abs(a.y - cy) < 0.02) a.y = cy;
      }
      const col = Math.round(a.x);
      if (dy > 0) {
        const base = Math.floor(a.y + EPS);
        const limit = solid(col, base + 1) ? base : base + 1;
        const ny = Math.max(a.y, Math.min(a.y + dist, limit));
        moved += ny - a.y;
        a.y = ny;
      } else {
        const base = Math.ceil(a.y - EPS);
        const limit = solid(col, base - 1) ? base : base - 1;
        const ny = Math.min(a.y, Math.max(a.y - dist, limit));
        moved += a.y - ny;
        a.y = ny;
      }
    }
    return moved;
  }

  playerSpeed(p: Player): number {
    let s = SPEEDS[Math.min(p.speedLvl, SPEEDS.length - 1)];
    if (p.curse === CURSES.Slow) s = SPEEDS[0] * 0.72;
    if (p.curse === CURSES.Hyper) s = SPEEDS[SPEEDS.length - 1] * 1.08;
    if (p.chillT > 0) s *= 0.62;
    if (p.carrying) s *= 0.88;
    if (p.potatoT > 0) s *= 1.12;
    return s;
  }

  movePlayer(p: Player, dir: number, dist: number): number {
    const solid = (tx: number, ty: number) => this.solidForActor(p.x, p.y, tx, ty);
    const moved = this.moveActor(p, dir, dist, solid);
    // Chute: bloqueado por carga logo à frente e alinhado
    if (moved < dist - EPS && p.kick) {
      const cx = Math.round(p.x),
        cy = Math.round(p.y);
      const aligned = Math.abs(p.x - cx) < 0.05 && Math.abs(p.y - cy) < 0.05;
      if (aligned) {
        const b = this.bombAt(cx + DX[dir], cy + DY[dir]);
        if (b && b.vx === 0 && b.vy === 0 && !b.conv && !this.blockedForBomb(cx + 2 * DX[dir], cy + 2 * DY[dir], b)) {
          b.vx = DX[dir];
          b.vy = DY[dir];
          b.speed = KICK_SPEED;
          b.kickedBy = p.id;
          this.emit({ e: 'kick', p: p.id, x: b.x, y: b.y });
        }
      }
    }
    return moved;
  }

  // ───────────────────────── passo principal ─────────────────────────
  step(inputs: (PlayerInput | undefined)[]) {
    this.events.length = 0;
    this.tick++;
    if (this.phase === 'over') return;
    if (this.phase === 'countdown' || this.phase === 'intro') {
      this.phaseT--;
      if (this.phaseT <= 0) this.phase = 'play';
      // animação ociosa apenas
      for (const p of this.players) {
        const inp = inputs[p.id];
        if (inp && inp.dir >= 0) p.dir = inp.dir;
      }
      return;
    }

    this.updateFlames();
    this.updateTiles();

    for (const p of this.players) this.updatePlayer(p, inputs[p.id]);

    this.updateBombs();
    this.updateHazards();
    this.updateEnemies();
    this.updateProjectiles();
    this.applyDamage();
    this.pickups();
    this.curseContact();
    this.environment();
    if (this.phase === 'play') this.updateTimer();
    this.ctl.tick?.(this);
    this.finishNearMiss();

    if (this.phase === 'play') {
      if (this.pendingEnd < 0) {
        const res = this.ctl.checkEnd(this);
        if (res) this.pendingEnd = 20;
      } else if (--this.pendingEnd <= 0) {
        const res = this.ctl.checkEnd(this);
        if (res) {
          this.result = res;
          this.phase = 'ending';
          this.phaseT = secs(2.2);
        } else this.pendingEnd = -1;
      }
    } else if (this.phase === 'ending') {
      if (--this.phaseT <= 0) this.phase = 'over';
    }
  }

  /** Encerra imediatamente (missões, desistência). */
  forceEnd(res: RoundResult) {
    if (this.phase === 'ending' || this.phase === 'over') return;
    this.result = res;
    this.phase = 'ending';
    this.phaseT = secs(2.2);
  }

  private updateTimer() {
    this.timeLeft--;
    const r = this.rules;
    if (r.suddenDeath && !this.sudden && this.timeLeft <= secs(r.suddenAt)) this.startSudden();
    if (this.sudden && this.suddenIdx < this.suddenOrder.length && this.tick % this.suddenEvery === 0) {
      const i = this.suddenOrder[this.suddenIdx++];
      this.hazards.push({ x: i % this.w, y: (i / this.w) | 0, t: 50, total: 50, kind: 'fall' });
    }
    if (this.timeLeft < 0) this.timeLeft = 0;
  }

  startSudden() {
    this.sudden = true;
    this.emit({ e: 'sudden' });
    // Espiral de fora para dentro sobre tiles não-parede.
    const order: number[] = [];
    let x0 = 1,
      y0 = 1,
      x1 = this.w - 2,
      y1 = this.h - 2;
    while (x0 <= x1 && y0 <= y1) {
      for (let x = x0; x <= x1; x++) order.push(this.idx(x, y0));
      for (let y = y0 + 1; y <= y1; y++) order.push(this.idx(x1, y));
      if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) order.push(this.idx(x, y1));
      if (x1 > x0) for (let y = y1 - 1; y > y0; y--) order.push(this.idx(x0, y));
      x0++;
      y0++;
      x1--;
      y1--;
    }
    this.suddenOrder = order.filter((i) => this.tiles[i] !== T.Wall && this.tiles[i] !== T.Pillar);
    const ticks = Math.max(60, secs(this.rules.suddenAt) - secs(4));
    this.suddenEvery = Math.max(2, Math.floor(ticks / Math.max(1, this.suddenOrder.length)));
  }

  private updateFlames() {
    const n = this.flame.length;
    for (let i = 0; i < n; i++) {
      if (this.itemProt[i]) this.itemProt[i]--;
      if (this.chillT[i]) {
        this.chillT[i]--;
        if (!this.chillT[i]) this.chillOwner[i] = -1;
      }
      if (this.frostT[i]) this.frostT[i]--;
      if (this.flame[i]) {
        this.flame[i]--;
        if (!this.flame[i]) {
          const o = this.flameOwner[i];
          if (o >= 0 && this.players[o]?.char === 'geada' && this.flameKind[i] === B.Normal && this.floor[i] !== F.Pit) {
            this.chillT[i] = secs(2);
            this.chillOwner[i] = o;
          }
          this.flameOwner[i] = -1;
          this.flameKind[i] = 0;
          this.flameDir[i] = 0;
          this.flameSrc[i] = -1;
          this.flameRef[i] = 0;
        }
      }
    }
  }

  private updateTiles() {
    const n = this.tiles.length;
    for (let i = 0; i < n; i++) {
      if (this.tileT[i] && this.tiles[i] === T.Crystal) {
        if (--this.tileT[i] === 0) this.setTile(i, T.Empty);
      }
      if (this.regrow[i]) {
        if (--this.regrow[i] === 0) {
          const x = i % this.w,
            y = (i / this.w) | 0;
          if (this.tiles[i] !== T.Empty || this.flame[i] || this.playerAtTile(x, y) || this.bombAt(x, y) || this.enemyAtTile(x, y)) {
            this.regrow[i] = secs(1);
          } else {
            this.setTile(i, T.Vine);
            this.emit({ e: 'regrow', x, y });
          }
        }
      }
    }
  }

  // ───────────────────────── jogadores ─────────────────────────
  private updatePlayer(p: Player, inp: PlayerInput | undefined) {
    if (!p.alive) {
      p.deadT++;
      if (this.rules.respawn && this.phase === 'play') {
        if (p.respawnT > 0 && --p.respawnT === 0) this.respawn(p);
      }
      return;
    }
    p.stats.survivedTicks++;
    if (inp?.seq) p.lastSeq = inp.seq;
    if (p.invuln > 0) p.invuln--;
    if (p.abilityCd > 0) p.abilityCd--;
    if (p.invisT > 0) p.invisT--;
    if (this.curseLock[p.id] > 0) this.curseLock[p.id]--;
    if (p.curse) {
      if (--p.curseT <= 0) p.curse = 0;
    }
    const acting = this.phase === 'play' || this.phase === 'ending';
    if (!this.moveStep(p, inp, acting, false)) return;
    if (!acting) return;
    if (inp?.bomb) this.placeBomb(p, B.Normal);
    if (p.curse === CURSES.Leaky && this.rng.next() < 0.03) this.placeBomb(p, B.Normal);
    if (inp?.ability) this.useAbility(p);
    if (inp?.cart) this.useCart(p);
  }

  /**
   * Movimento de um tick do jogador. Também usado pela previsão do cliente (predict = true).
   * Retorna false quando o jogador está ocupado (salto, atordoado, empurrão, arranque).
   */
  moveStep(p: Player, inp: PlayerInput | undefined, acting: boolean, predict: boolean): boolean {
    if (p.chillT > 0) p.chillT--;
    const ti = this.idx(Math.round(p.x), Math.round(p.y));
    if (this.chillT[ti] && this.chillOwner[ti] !== p.id) p.chillT = Math.max(p.chillT, 20);
    let dir = inp && acting ? inp.dir : -1;
    if (dir >= 0 && p.curse === CURSES.Reverse) dir = opposite(dir);

    // Salto em andamento
    if (p.jumpT > 0) {
      p.jumpT--;
      const k = 1 - p.jumpT / p.jumpDur;
      p.x = p.jumpFx + (p.jumpTx - p.jumpFx) * k;
      p.y = p.jumpFy + (p.jumpTy - p.jumpFy) * k;
      if (p.jumpT === 0) {
        p.x = p.jumpTx;
        p.y = p.jumpTy;
        p.invuln = Math.max(p.invuln, 4);
      }
      return false;
    }
    if (p.stunT > 0) {
      p.stunT--;
      p.moving = false;
      return false;
    }
    if (p.knockT > 0) {
      p.knockT--;
      this.moveActor(p, p.knockDir, 11 * (1 / 60), (tx, ty) => this.solidForActor(p.x, p.y, tx, ty));
      return false;
    }
    if (p.dashT > 0) {
      p.dashT--;
      this.moveActor(p, p.dashDir, 3 / 9, (tx, ty) => this.solidForActor(p.x, p.y, tx, ty));
      p.moving = true;
      if (inp?.bomb && acting && !predict) this.placeBomb(p, B.Normal);
      return false;
    }

    // Gelo: desliza até bater
    const onIce = this.isIce(ti);
    const speed = this.playerSpeed(p) / 60;
    let moved = 0;
    if (onIce && p.slideDir >= 0) {
      p.dir = p.slideDir;
      moved = this.movePlayer(p, p.slideDir, speed * 1.25);
      if (moved < EPS) p.slideDir = -1;
      p.moving = moved > EPS;
    } else {
      if (!onIce) p.slideDir = -1;
      if (dir >= 0) {
        p.dir = dir;
        moved = this.movePlayer(p, dir, speed);
        p.moving = moved > EPS;
        if (onIce && moved > EPS) p.slideDir = dir;
      } else p.moving = false;
    }
    return true;
  }

  /** Previsão do cliente: aplica apenas movimento + ambiente ao jogador local. */
  predictStep(p: Player, inp: PlayerInput) {
    if (!p.alive || (this.phase !== 'play' && this.phase !== 'ending')) return;
    this.moveStep(p, inp, true, true);
    this.envPlayer(p);
  }

  respawn(p: Player) {
    // Nascimento mais seguro: mais distante dos inimigos e sem chamas/cargas perto.
    let best = this.spawns[p.id % this.spawns.length];
    let bestScore = -1e9;
    for (const s of this.spawns) {
      let sc = 0;
      for (const o of this.players) if (o.alive && o.team !== p.team) sc += Math.min(12, Math.abs(o.x - s.x) + Math.abs(o.y - s.y));
      for (const b of this.bombs) if (Math.abs(b.x - s.x) + Math.abs(b.y - s.y) < 4) sc -= 20;
      if (this.flame[this.idx(s.x, s.y)]) sc -= 50;
      if (this.tiles[this.idx(s.x, s.y)] !== T.Empty) sc -= 100;
      sc += this.rng.next();
      if (sc > bestScore) {
        bestScore = sc;
        best = s;
      }
    }
    const c = CHARACTERS[p.char];
    Object.assign(p, {
      x: best.x,
      y: best.y,
      alive: true,
      hp: p.maxHp,
      invuln: secs(2),
      deadT: 0,
      bombsMax: Math.max(this.rules.startBombs ?? c.start.bombs, p.bombsMax - 1),
      range: Math.max(c.start.range, p.range - 1),
      curse: 0,
      carrying: 0,
      dashT: 0,
      jumpT: 0,
      knockT: 0,
      stunT: 0,
      slideDir: -1,
    });
    this.emit({ e: 'respawn', p: p.id, x: best.x, y: best.y });
  }

  activeBombs(p: Player, cart = false): number {
    let n = 0;
    for (const b of this.bombs) {
      if (b.owner !== p.id) continue;
      const isCart = b.kind !== B.Normal;
      if (isCart === cart) n++;
    }
    return n;
  }

  canPlaceAt(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    return this.tiles[i] === T.Empty && this.floor[i] !== F.Pit && !this.bombAt(x, y);
  }

  placeBomb(p: Player, kind: number): Bomb | null {
    if (p.jumpT > 0) return null;
    if (kind === B.Normal) {
      if (p.curse === CURSES.Jammed) return null;
      if (this.activeBombs(p, false) >= p.bombsMax) return null;
    }
    const x = Math.round(p.x),
      y = Math.round(p.y);
    if (!this.canPlaceAt(x, y)) return null;
    const c = CHARACTERS[p.char];
    let fuse = Math.round(BASE_FUSE * c.fuseMul);
    if (p.curse === CURSES.ShortFuse) fuse = secs(1);
    const b = this.addBomb(x, y, kind, p.id, fuse, p.range);
    b.pierce = p.char === 'lume' ? 1 : 0;
    b.hidden = p.char === 'vulto';
    p.stats.bombs++;
    this.emit({ e: 'place', x, y, k: kind, p: p.id });
    return b;
  }

  addBomb(x: number, y: number, kind: number, owner: number, fuse: number, range: number): Bomb {
    const b: Bomb = {
      id: this.nextId++,
      owner,
      kind: kind as any,
      x,
      y,
      vx: 0,
      vy: 0,
      speed: 0,
      fuse,
      maxFuse: fuse,
      range,
      frozen: 0,
      pierce: 0,
      passers: 0,
      armed: 0,
      hidden: false,
      chainFrom: owner,
      chainDepth: 0,
      z: 0,
      pulled: false,
      prog: 0,
      conv: false,
      tpLock: 0,
      kickedBy: -1,
    };
    switch (kind) {
      case B.Frag:
        b.range = Math.max(2, range - 1);
        break;
      case B.Mine:
        b.fuse = b.maxFuse = secs(30);
        b.range = 2;
        break;
      case B.Remote:
        b.fuse = b.maxFuse = secs(20);
        break;
      case B.Pulse:
        b.fuse = b.maxFuse = secs(1.6);
        b.range = 3;
        break;
      case B.Cluster:
        b.range = Math.max(2, Math.min(range, 3));
        break;
      case B.Mini:
        b.range = 1;
        break;
      case B.Pierce:
        b.pierce = 99;
        break;
    }
    this.bombs.push(b);
    return b;
  }

  useCart(p: Player) {
    if (!this.rules.cartridges) return;
    // Remota: segundo toque detona
    const remotes = this.bombs.filter((b) => b.owner === p.id && b.kind === B.Remote && b.frozen === 0);
    if (remotes.length) {
      remotes.forEach((b, k) => (b.fuse = 1 + k * 2));
      return;
    }
    if (!p.cart || p.cartCharges <= 0) return;
    const active = this.bombs.filter((b) => b.owner === p.id && b.kind === p.cart).length;
    const maxActive = p.cart === B.Mine ? 2 : 1;
    if (active >= maxActive) return;
    const b = this.placeBomb(p, p.cart);
    if (!b) return;
    if (--p.cartCharges <= 0) {
      p.cart = 0;
      p.cartCharges = 0;
    }
  }

  // ───────────────────────── técnicas ─────────────────────────
  useAbility(p: Player) {
    if (!this.rules.abilities || p.abilityCd > 0) return;
    const c = CHARACTERS[p.char];
    const cx = Math.round(p.x),
      cy = Math.round(p.y);
    const d = p.dir;
    let ok = true;
    switch (c.ability.id) {
      case 'arranque': {
        p.dashT = 9;
        p.dashDir = d;
        p.invuln = Math.max(p.invuln, 14);
        break;
      }
      case 'salto': {
        const tx = cx + DX[d] * 2,
          ty = cy + DY[d] * 2;
        if (this.canPlaceAt(tx, ty) && !this.playerAtTile(tx, ty, p) && !this.enemyAtTile(tx, ty)) {
          p.jumpFx = p.x;
          p.jumpFy = p.y;
          p.jumpTx = tx;
          p.jumpTy = ty;
          p.jumpDur = p.jumpT = 22;
        } else ok = false;
        break;
      }
      case 'prisma': {
        const tx = cx + DX[d],
          ty = cy + DY[d];
        if (this.canPlaceAt(tx, ty) && !this.playerAtTile(tx, ty) && !this.enemyAtTile(tx, ty) && this.floor[this.idx(tx, ty)] !== F.Teleport) {
          const i = this.idx(tx, ty);
          this.setTile(i, T.Crystal);
          this.tileT[i] = secs(5);
          this.flame[i] = 0;
        } else ok = false;
        break;
      }
      case 'congelar': {
        let any = false;
        for (const b of this.bombs) {
          const [bx, by] = this.bombTile(b);
          if (Math.max(Math.abs(bx - cx), Math.abs(by - cy)) <= 2) {
            b.frozen = secs(3);
            any = true;
            this.emit({ e: 'freeze', x: bx, y: by });
          }
        }
        for (let yy = cy - 1; yy <= cy + 1; yy++)
          for (let xx = cx - 1; xx <= cx + 1; xx++) if (this.inb(xx, yy) && this.tiles[this.idx(xx, yy)] === T.Empty) this.frostT[this.idx(xx, yy)] = secs(3);
        ok = true;
        void any;
        break;
      }
      case 'estrondo': {
        for (const b of this.bombs) {
          if (b.vx || b.vy) continue;
          const ddx = b.x - cx,
            ddy = b.y - cy;
          if (Math.abs(ddx) + Math.abs(ddy) > 2) continue;
          let pd = d;
          if (ddx !== 0 || ddy !== 0) pd = Math.abs(ddx) >= Math.abs(ddy) ? (ddx > 0 ? 1 : 3) : ddy > 0 ? 2 : 0;
          if (!this.blockedForBomb(b.x + DX[pd], b.y + DY[pd], b)) {
            b.vx = DX[pd];
            b.vy = DY[pd];
            b.speed = KICK_SPEED;
            b.kickedBy = p.id;
          }
        }
        for (const o of this.players) {
          if (o === p || !o.alive || o.jumpT > 0) continue;
          const ddx = o.x - p.x,
            ddy = o.y - p.y;
          if (Math.abs(ddx) + Math.abs(ddy) > 1.6) continue;
          o.knockDir = Math.abs(ddx) >= Math.abs(ddy) ? (ddx >= 0 ? 1 : 3) : ddy >= 0 ? 2 : 0;
          o.knockT = 12;
        }
        for (const e of this.enemies) {
          if (!e.alive || e.boss) continue;
          if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 2) e.stunT = secs(1.2);
        }
        break;
      }
      case 'sombra': {
        p.invisT = secs(4);
        break;
      }
      case 'ima': {
        ok = false;
        for (let k = 1; k <= 7; k++) {
          const tx = cx + DX[d] * k,
            ty = cy + DY[d] * k;
          if (!this.inb(tx, ty)) break;
          const b = this.bombAt(tx, ty);
          if (b) {
            if (k >= 2 && b.vx === 0 && b.vy === 0) {
              b.vx = -DX[d];
              b.vy = -DY[d];
              b.speed = KICK_SPEED;
              b.pulled = true;
              b.kickedBy = p.id;
              ok = true;
            }
            break;
          }
          if (this.tiles[this.idx(tx, ty)] !== T.Empty) break;
        }
        break;
      }
      case 'detonar': {
        const own = this.bombs.filter((b) => b.owner === p.id && b.frozen === 0);
        if (!own.length) ok = false;
        own.sort((a, b) => a.fuse - b.fuse).forEach((b, k) => (b.fuse = Math.min(b.fuse, 2 + k * 5)));
        break;
      }
    }
    this.emit({ e: 'ability', p: p.id, a: c.ability.id, x: p.x, y: p.y, d, ok });
    if (ok) {
      p.abilityCd = p.abilityMax;
      p.stats.abilities++;
    }
  }

  // ───────────────────────── cargas ─────────────────────────
  blockedForBomb(x: number, y: number, self: Bomb): boolean {
    if (!this.inb(x, y)) return true;
    const i = this.idx(x, y);
    if (this.tiles[i] !== T.Empty) return true;
    for (const b of this.bombs) {
      if (b === self) continue;
      const [bx, by] = this.bombTile(b);
      if (bx === x && by === y) return true;
    }
    for (const p of this.players) if (p.alive && p.jumpT === 0 && Math.abs(p.x - x) < 0.8 && Math.abs(p.y - y) < 0.8) return true;
    if (this.enemyAtTile(x, y)) return true;
    return false;
  }

  private updateBombs() {
    for (const b0 of this.bombs.slice()) {
      const b = b0;
      if (!this.bombs.includes(b)) continue;
      if (b.z > 0) {
        b.z = Math.max(0, b.z - 1 / 30);
      }
      // Esteira empurra carga parada
      if (b.vx === 0 && b.vy === 0 && b.prog === 0) {
        const fl = this.floor[this.idx(b.x, b.y)];
        if (fl >= F.ConvU && fl <= F.ConvL) {
          const d = fl - F.ConvU;
          if (!this.blockedForBomb(b.x + DX[d], b.y + DY[d], b)) {
            b.vx = DX[d];
            b.vy = DY[d];
            b.speed = CONVEYOR_SPEED;
            b.conv = true;
          }
        }
      }
      if (b.vx || b.vy) {
        if (b.prog === 0) {
          const i = this.idx(b.x, b.y);
          const fl = this.floor[i];
          if (fl === F.Pit) {
            this.removeBomb(b);
            this.emit({ e: 'fall', x: b.x, y: b.y });
            continue;
          }
          if (fl === F.Teleport && !b.tpLock && this.tpPair[i] >= 0) {
            const j = this.tpPair[i];
            const nx = j % this.w,
              ny = (j / this.w) | 0;
            if (!this.bombAt(nx, ny)) {
              this.emit({ e: 'teleport', x: b.x, y: b.y, x2: nx, y2: ny });
              b.x = nx;
              b.y = ny;
              b.tpLock = 1;
            }
          } else if (fl !== F.Teleport) b.tpLock = 0;
          if (b.conv) {
            const f2 = this.floor[this.idx(b.x, b.y)];
            if (f2 >= F.ConvU && f2 <= F.ConvL) {
              const d = f2 - F.ConvU;
              b.vx = DX[d];
              b.vy = DY[d];
            } else {
              b.vx = b.vy = 0;
              b.conv = false;
              continue;
            }
          }
          if (this.blockedForBomb(b.x + b.vx, b.y + b.vy, b)) {
            b.vx = b.vy = 0;
            b.conv = false;
            b.pulled = false;
            continue;
          }
        }
        b.prog += b.speed / 60;
        while (b.prog >= 1) {
          b.x += b.vx;
          b.y += b.vy;
          b.prog -= 1;
          if (b.prog > 0) {
            const i = this.idx(b.x, b.y);
            const fl = this.floor[i];
            const special = fl === F.Pit || fl === F.Teleport || (b.conv && !(fl >= F.ConvU && fl <= F.ConvL));
            if (special || this.blockedForBomb(b.x + b.vx, b.y + b.vy, b)) {
              b.prog = 0;
              break;
            }
          }
        }
      }

      if (b.frozen > 0) {
        b.frozen--;
        continue;
      }
      if (b.kind === B.Mine) {
        b.armed++;
        if (b.armed > 50) {
          const [mx, my] = this.bombTile(b);
          const owner = this.players[b.owner];
          let trig = false;
          for (const p of this.players) {
            if (!p.alive || p.jumpT > 0) continue;
            if (owner && (p.id === owner.id || p.team === owner.team)) continue;
            if (Math.abs(p.x - mx) + Math.abs(p.y - my) <= 1.1) trig = true;
          }
          for (const e of this.enemies) if (e.alive && Math.abs(e.x - mx) + Math.abs(e.y - my) <= 1.1) trig = true;
          if (trig && b.fuse > 8) b.fuse = 8;
        }
      }
      if (--b.fuse <= 0) this.explode(b);
    }
  }

  removeBomb(b: Bomb) {
    const k = this.bombs.indexOf(b);
    if (k >= 0) this.bombs.splice(k, 1);
  }

  explode(b: Bomb) {
    if (!this.bombs.includes(b)) return;
    this.removeBomb(b);
    const [cx, cy] = this.bombTile(b);
    const owner = b.owner;
    const src = this.idx(cx, cy);
    if (owner >= 0 && this.players[owner]) {
      const st = this.players[owner].stats;
      st.chains = Math.max(st.chains, b.chainDepth);
    }
    this.emit({ e: 'boom', x: cx, y: cy, k: b.kind, p: owner, r: b.range, chain: b.chainDepth });
    if (b.kind === B.Pulse) {
      this.pulse(cx, cy, b.range, owner);
      return;
    }
    const ctx = { owner, kind: b.kind, src, depth: b.chainDepth };
    this.addFlame(cx, cy, ctx, 16);
    for (let d = 0; d < 4; d++) this.propagate(cx, cy, d, b.range, b.pierce, ctx);
    if (b.kind === B.Frag) {
      const diag = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (const [ddx, ddy] of diag) {
        for (let k = 1; k <= b.range - 1; k++) {
          const x = cx + ddx * k,
            y = cy + ddy * k;
          if (!this.flameInto(x, y, ctx, 0, true)) break;
        }
      }
    }
    if (b.kind === B.Cluster) {
      for (let d = 0; d < 4; d++) {
        let ex = cx,
          ey = cy;
        for (let k = 1; k <= b.range; k++) {
          const nx = cx + DX[d] * k,
            ny = cy + DY[d] * k;
          if (!this.walkableStatic(nx, ny)) break;
          ex = nx;
          ey = ny;
        }
        if ((ex !== cx || ey !== cy) && !this.bombAt(ex, ey)) {
          const m = this.addBomb(ex, ey, B.Mini, owner, secs(0.7), 1);
          m.chainDepth = b.chainDepth + 1;
        }
      }
    }
  }

  private pulse(cx: number, cy: number, range: number, owner: number) {
    this.emit({ e: 'pulse', x: cx, y: cy });
    for (const p of this.players) {
      if (!p.alive || p.jumpT > 0) continue;
      const dx = p.x - cx,
        dy = p.y - cy;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range + 0.5) continue;
      let d = p.dir;
      if (dist > 0.01) d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      p.knockDir = d;
      p.knockT = 14;
      p.slideDir = -1;
    }
    for (const b of this.bombs) {
      const dx = b.x - cx,
        dy = b.y - cy;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist === 0 || dist > range) continue;
      const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      if (!this.blockedForBomb(b.x + DX[d], b.y + DY[d], b)) {
        b.vx = DX[d];
        b.vy = DY[d];
        b.speed = KICK_SPEED;
        b.kickedBy = owner;
      }
    }
    for (const e of this.enemies) if (e.alive && !e.boss && Math.abs(e.x - cx) + Math.abs(e.y - cy) <= range) e.stunT = secs(1.5);
  }

  private propagate(x: number, y: number, dir: number, range: number, pierce: number, ctx: FlameCtx) {
    ctx = { ...ctx };
    let d = dir;
    let px = x,
      py = y;
    let left = range;
    let pierceLeft = pierce;
    while (left > 0) {
      const nx = px + DX[d],
        ny = py + DY[d];
      left--;
      if (!this.inb(nx, ny)) break;
      const i = this.idx(nx, ny);
      const t = this.tiles[i];
      if (t === T.Wall || t === T.Pillar || t === T.Door || t === T.Crystal) break;
      // conecta visualmente
      this.flameDir[this.idx(px, py)] |= 1 << d;
      if (t === T.MirrorA || t === T.MirrorB) {
        ctx = { ...ctx, ref: 1 };
        this.addFlame(nx, ny, ctx, 1 << opposite(d));
        d = t === T.MirrorA ? d ^ 1 : 3 - d;
        px = nx;
        py = ny;
        left = Math.max(left, 1);
        continue;
      }
      if (t === T.Block || t === T.Vine || t === T.Hard || t === T.Barrel || t === T.Target || t === T.Cracked) {
        this.addFlame(nx, ny, ctx, 1 << opposite(d));
        this.hitTile(nx, ny, ctx);
        if (pierceLeft > 0 && t !== T.Target) {
          pierceLeft--;
          px = nx;
          py = ny;
          continue;
        }
        break;
      }
      const hitBomb = this.bombAt(nx, ny);
      if (hitBomb) {
        this.addFlame(nx, ny, ctx, 1 << opposite(d));
        this.chainBomb(hitBomb, ctx);
        break;
      }
      const it = this.items[i];
      if (it && !this.itemProt[i] && it !== I.Fragment && it !== I.Relic) {
        this.items[i] = 0;
        this.addFlame(nx, ny, ctx, 1 << opposite(d));
        this.emit({ e: 'burnItem', x: nx, y: ny, i: it });
        this.tilesVer++;
        break;
      }
      this.addFlame(nx, ny, ctx, 1 << opposite(d));
      px = nx;
      py = ny;
    }
  }

  /** Chama isolada (diagonal/hazard). Retorna se pode continuar. */
  flameInto(x: number, y: number, ctx: FlameCtx, bits: number, stopAtBlocks: boolean): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    const t = this.tiles[i];
    if (t === T.Wall || t === T.Pillar || t === T.Door || t === T.Crystal || t === T.MirrorA || t === T.MirrorB) return false;
    this.addFlame(x, y, ctx, bits || 16);
    if (t !== T.Empty) {
      this.hitTile(x, y, ctx);
      return !stopAtBlocks;
    }
    const b = this.bombAt(x, y);
    if (b) {
      this.chainBomb(b, ctx);
      return false;
    }
    return true;
  }

  chainBomb(b: Bomb, ctx: FlameCtx) {
    if (b.frozen > 0) return;
    if (ctx.kind === B.Frost) {
      b.frozen = secs(2);
      return;
    }
    if (b.fuse > CHAIN_DELAY) {
      b.fuse = CHAIN_DELAY;
      b.chainFrom = ctx.owner;
      b.chainDepth = ctx.depth + 1;
    }
  }

  hitTile(x: number, y: number, ctx: FlameCtx) {
    const i = this.idx(x, y);
    const t = this.tiles[i];
    if (ctx.kind === B.Frost && t !== T.Barrel) return;
    switch (t) {
      case T.Block:
      case T.Vine:
      case T.Cracked: {
        this.setTile(i, T.Empty);
        if (t === T.Vine) this.regrow[i] = secs(11);
        if (this.items[i]) this.itemProt[i] = FLAME_TIME + 2;
        if (ctx.owner >= 0 && this.players[ctx.owner]) this.players[ctx.owner].stats.blocks++;
        this.emit({ e: 'block', x, y, t, item: this.items[i] });
        this.ctl.onBlock?.(this, x, y, t, ctx.owner);
        break;
      }
      case T.Hard:
        this.setTile(i, T.Block);
        this.emit({ e: 'block', x, y, t, item: 0 });
        break;
      case T.Barrel: {
        this.setTile(i, T.Empty);
        this.emit({ e: 'block', x, y, t, item: this.items[i] });
        const b = this.addBomb(x, y, B.Barrel, ctx.owner, CHAIN_DELAY + 3, 2);
        b.chainDepth = ctx.depth + 1;
        break;
      }
      case T.Target: {
        this.setTile(i, T.Empty);
        this.emit({ e: 'block', x, y, t, item: this.items[i] });
        this.ctl.onTarget?.(this, x, y, ctx.owner);
        break;
      }
    }
  }

  addFlame(x: number, y: number, ctx: FlameCtx, bits: number) {
    const i = this.idx(x, y);
    this.flame[i] = FLAME_TIME;
    this.flameOwner[i] = ctx.owner < 0 ? -1 : ctx.owner;
    this.flameKind[i] = ctx.kind === B.Frost ? B.Frost : ctx.kind === B.Enemy ? B.Enemy : B.Normal;
    this.flameDir[i] |= bits;
    this.flameSrc[i] = ctx.src;
    if (ctx.ref) this.flameRef[i] = 1;
    if (ctx.kind === B.Frost) {
      if (this.floor[i] !== F.Pit) this.frostT[i] = secs(6);
      return;
    }
    // quase-acertos
    for (const p of this.players) {
      if (!p.alive) continue;
      const dd = Math.abs(Math.round(p.x) - x) + Math.abs(Math.round(p.y) - y);
      if (dd === 1) this.nearMissCand[p.id] = true;
    }
  }

  private finishNearMiss() {
    for (const p of this.players) {
      if (this.nearMissCd[p.id] > 0) this.nearMissCd[p.id]--;
      if (this.nearMissCand[p.id]) {
        this.nearMissCand[p.id] = false;
        if (p.alive && this.nearMissCd[p.id] === 0 && !this.flame[this.idx(Math.round(p.x), Math.round(p.y))]) {
          this.nearMissCd[p.id] = secs(3);
          p.stats.nearMiss++;
          this.emit({ e: 'nearMiss', p: p.id });
        }
      }
    }
  }

  // ───────────────────────── dano ─────────────────────────
  private applyDamage() {
    for (const p of this.players) {
      if (!p.alive || p.jumpT > 0) continue;
      const i = this.idx(Math.round(p.x), Math.round(p.y));
      if (!this.flame[i]) continue;
      if (this.flameKind[i] === B.Frost) {
        if (p.stunT === 0 && p.invuln === 0) {
          p.stunT = secs(1.2);
          this.emit({ e: 'freeze', x: p.x, y: p.y });
        }
        continue;
      }
      const owner = this.flameOwner[i];
      if (!this.rules.friendlyFire && owner >= 0 && owner !== p.id && this.players[owner]?.team === p.team) continue;
      this.hurt(p, owner === -1 && this.flameKind[i] === B.Enemy ? -2 : owner);
    }
    for (const e of this.enemies) {
      if (!e.alive || e.spawnT > 0) continue;
      if (e.invuln > 0) {
        e.invuln--;
        continue;
      }
      const half = (e.size - 1) / 2;
      let hitI = -1;
      for (let yy = Math.round(e.y - half); yy <= Math.round(e.y + half) && hitI < 0; yy++)
        for (let xx = Math.round(e.x - half); xx <= Math.round(e.x + half); xx++) {
          if (!this.inb(xx, yy)) continue;
          const i = this.idx(xx, yy);
          if (this.flame[i] && (this.flameKind[i] !== B.Enemy || e.flags & 2)) {
            hitI = i;
            break;
          }
        }
      if (hitI < 0) continue;
      const owner = this.flameOwner[hitI];
      if (this.flameKind[hitI] === B.Frost) {
        if (!e.boss) e.stunT = Math.max(e.stunT, secs(2));
        continue;
      }
      const ai = ENEMY_AI[e.type];
      if (ai?.onHit && !ai.onHit(this, e, owner, hitI)) continue;
      this.damageEnemy(e, 1, owner);
    }
  }

  damageEnemy(e: Enemy, dmg: number, by: number) {
    e.hp -= dmg;
    e.invuln = e.boss ? secs(1.2) : secs(0.5);
    const dead = e.hp <= 0;
    this.emit({ e: 'enemyHit', id: e.id, x: e.x, y: e.y, dead, boss: e.boss });
    if (dead) {
      e.alive = false;
      e.deadT = 0;
      if (by >= 0 && this.players[by]) this.players[by].stats.kills++;
      ENEMY_AI[e.type]?.onDeath?.(this, e, by);
      this.ctl.onEnemyDeath?.(this, e, by);
    }
  }

  hurt(p: Player, by: number, lethal = false) {
    if (!p.alive) return;
    if (!lethal && (p.invuln > 0 || p.dashT > 0)) return;
    if (!lethal && p.shield > 0) {
      p.shield--;
      p.invuln = secs(1.5);
      this.emit({ e: 'hit', p: p.id, by, x: p.x, y: p.y, shield: true });
      return;
    }
    p.hp = lethal ? 0 : p.hp - 1;
    p.stats.dmgTaken++;
    this.emit({ e: 'hit', p: p.id, by, x: p.x, y: p.y, shield: false });
    if (p.hp <= 0) this.kill(p, by);
    else p.invuln = secs(2);
  }

  kill(p: Player, by: number) {
    p.alive = false;
    p.deadT = 0;
    p.killedBy = by;
    p.moving = false;
    p.stats.deaths++;
    if (by === p.id) p.stats.selfKills++;
    else if (by >= 0 && this.players[by]) {
      if (this.players[by].team !== p.team) this.players[by].stats.kills++;
    }
    this.emit({ e: 'death', p: p.id, by, x: p.x, y: p.y });
    if (this.rules.scatter) this.scatterItems(p);
    if (this.rules.respawn) p.respawnT = secs(this.rules.respawnTime);
    this.ctl.onDeath?.(this, p, by);
  }

  private scatterItems(p: Player) {
    const c = CHARACTERS[p.char];
    const drops: number[] = [];
    for (let k = c.start.bombs; k < p.bombsMax; k++) drops.push(I.BombUp);
    for (let k = c.start.range; k < Math.min(p.range, 6); k++) drops.push(I.RangeUp);
    for (let k = c.start.speed; k < p.speedLvl; k++) drops.push(I.SpeedUp);
    if (p.kick && !c.start.kick) drops.push(I.Kick);
    const free: number[] = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] !== T.Empty || this.items[i] || this.floor[i] === F.Pit || this.floor[i] === F.Teleport) continue;
      const x = i % this.w,
        y = (i / this.w) | 0;
      if (this.bombAt(x, y) || this.flame[i]) continue;
      free.push(i);
    }
    this.rng.shuffle(free);
    for (let k = 0; k < drops.length && k < free.length; k++) {
      this.items[free[k]] = drops[k];
      this.itemProt[free[k]] = 30;
      this.emit({ e: 'item', x: free[k] % this.w, y: (free[k] / this.w) | 0, i: drops[k] });
    }
    if (drops.length) this.tilesVer++;
  }

  // ───────────────────────── itens ─────────────────────────
  private pickups() {
    for (const p of this.players) {
      if (!p.alive || p.jumpT > 0) continue;
      const cx = Math.round(p.x),
        cy = Math.round(p.y);
      this.tryPickup(p, cx, cy);
      if (p.char === 'magna') for (let d = 0; d < 4; d++) this.tryPickup(p, cx + DX[d], cy + DY[d]);
    }
  }

  private tryPickup(p: Player, x: number, y: number) {
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    const it = this.items[i];
    if (!it || this.tiles[i] !== T.Empty) return;
    this.items[i] = 0;
    this.tilesVer++;
    this.applyItem(p, it);
    p.stats.items++;
    this.emit({ e: 'pickup', p: p.id, i: it, x, y });
    this.ctl.onPickup?.(this, p, it);
  }

  applyItem(p: Player, it: number) {
    const c = CHARACTERS[p.char];
    switch (it) {
      case I.BombUp:
        p.bombsMax = Math.min(c.caps.bombs, p.bombsMax + 1);
        break;
      case I.RangeUp:
        p.range = Math.min(c.caps.range, p.range + 1);
        break;
      case I.RangeMax:
        p.range = c.caps.range;
        break;
      case I.SpeedUp:
        p.speedLvl = Math.min(c.caps.speed, p.speedLvl + 1);
        break;
      case I.Kick:
        p.kick = true;
        break;
      case I.Shield:
        p.shield = 1;
        break;
      case I.Heart:
        p.hp = Math.min(p.maxHp, p.hp + 1);
        break;
      case I.Cartridge: {
        const k = this.rng.pick((this.mstate.cartPool as number[] | undefined) ?? CART_POOL);
        p.cart = k as any;
        p.cartCharges = CARTRIDGES[k].charges;
        break;
      }
      case I.Curse: {
        const cs = [CURSES.ShortFuse, CURSES.Slow, CURSES.Hyper, CURSES.Leaky, CURSES.Reverse, CURSES.Jammed];
        p.curse = this.rng.pick(cs);
        p.curseT = secs(10);
        this.curseLock[p.id] = secs(1);
        this.emit({ e: 'curse', p: p.id, c: p.curse, from: -1 });
        break;
      }
    }
  }

  private curseContact() {
    for (const a of this.players) {
      if (!a.alive || !a.curse || this.curseLock[a.id] > 0) continue;
      for (const b of this.players) {
        if (b === a || !b.alive || b.curse || this.curseLock[b.id] > 0) continue;
        if (Math.abs(a.x - b.x) < 0.7 && Math.abs(a.y - b.y) < 0.7) {
          b.curse = a.curse;
          b.curseT = secs(10);
          a.curse = 0;
          a.curseT = 0;
          this.curseLock[a.id] = this.curseLock[b.id] = secs(1.5);
          this.emit({ e: 'curse', p: b.id, c: b.curse, from: a.id });
          break;
        }
      }
    }
  }

  // ───────────────────────── ambiente ─────────────────────────
  envPlayer(p: Player) {
    if (!p.alive || p.jumpT > 0) return;
    const cx = Math.round(p.x),
      cy = Math.round(p.y);
    const i = this.idx(cx, cy);
    const fl = this.floor[i];
    if (fl >= F.ConvU && fl <= F.ConvL && p.dashT === 0) {
      this.moveActor(p, fl - F.ConvU, CONVEYOR_SPEED / 60, (tx, ty) => this.solidForActor(p.x, p.y, tx, ty));
    }
    if (fl === F.Teleport) {
      if (!p.tpLock && Math.abs(p.x - cx) < 0.25 && Math.abs(p.y - cy) < 0.25 && this.tpPair[i] >= 0) {
        const j = this.tpPair[i];
        const nx = j % this.w,
          ny = (j / this.w) | 0;
        this.emit({ e: 'teleport', x: cx, y: cy, x2: nx, y2: ny });
        p.x = nx;
        p.y = ny;
        p.tpLock = 1;
        p.slideDir = -1;
      }
    } else p.tpLock = 0;
  }

  private environment() {
    for (const p of this.players) this.envPlayer(p);
    // Respiradouros
    const vp = this.map.ventPeriod;
    if (vp && this.phase === 'play') {
      const period = secs(vp);
      const warn = secs(1.5);
      const t = this.tick % period;
      if (t === period - warn) {
        const group = Math.floor(this.tick / period) % 2;
        for (let i = 0; i < this.floor.length; i++) {
          if (this.floor[i] === F.Vent && this.fdata[i] === group) this.hazards.push({ x: i % this.w, y: (i / this.w) | 0, t: warn, total: warn, kind: 'vent' });
        }
      }
    }
  }

  private updateHazards() {
    for (let k = this.hazards.length - 1; k >= 0; k--) {
      const hz = this.hazards[k];
      if (--hz.t > 0) continue;
      this.hazards.splice(k, 1);
      const i = this.idx(hz.x, hz.y);
      switch (hz.kind) {
        case 'fall': {
          if (this.tiles[i] === T.Wall || this.tiles[i] === T.Pillar) break;
          this.setTile(i, T.Pillar);
          this.items[i] = 0;
          this.flame[i] = 0;
          this.regrow[i] = 0;
          const b = this.bombAt(hz.x, hz.y);
          if (b) this.removeBomb(b);
          for (const p of this.players) if (p.alive && Math.round(p.x) === hz.x && Math.round(p.y) === hz.y) this.hurt(p, -1, true);
          for (const e of this.enemies) if (e.alive && !e.boss && Math.round(e.x) === hz.x && Math.round(e.y) === hz.y) this.damageEnemy(e, 99, -1);
          this.emit({ e: 'fall', x: hz.x, y: hz.y });
          break;
        }
        case 'vent': {
          const ctx = { owner: -1, kind: B.Normal, src: i, depth: 0 };
          this.emit({ e: 'vent', x: hz.x, y: hz.y });
          this.flameInto(hz.x, hz.y, ctx, 16, true);
          for (let d = 0; d < 4; d++) this.flameInto(hz.x + DX[d], hz.y + DY[d], ctx, 1 << opposite(d), true);
          break;
        }
        case 'strike': {
          const ctx = { owner: -1, kind: B.Enemy, src: i, depth: 0 };
          this.flameInto(hz.x, hz.y, ctx, 16, true);
          break;
        }
        case 'frost': {
          const ctx = { owner: -1, kind: B.Frost, src: i, depth: 0 };
          this.flameInto(hz.x, hz.y, ctx, 16, true);
          break;
        }
        case 'crush': {
          for (const p of this.players) if (p.alive && p.jumpT === 0 && Math.round(p.x) === hz.x && Math.round(p.y) === hz.y) this.hurt(p, -2);
          const b = this.bombAt(hz.x, hz.y);
          if (b) this.explode(b);
          if (this.tiles[i] === T.Block || this.tiles[i] === T.Vine) this.hitTile(hz.x, hz.y, { owner: -1, kind: B.Normal, src: i, depth: 0 });
          this.emit({ e: 'fall', x: hz.x, y: hz.y });
          break;
        }
        case 'rain': {
          if (this.canPlaceAt(hz.x, hz.y)) {
            const b = this.addBomb(hz.x, hz.y, B.Rain, -1, secs(1.1), hz.data ?? 2);
            b.z = 0;
          }
          break;
        }
        case 'laser':
          break;
      }
    }
  }

  private updateEnemies() {
    for (const e of this.enemies) {
      if (!e.alive) {
        e.deadT++;
        continue;
      }
      if (e.spawnT > 0) {
        e.spawnT--;
        continue;
      }
      if (e.stunT > 0) {
        e.stunT--;
        continue;
      }
      ENEMY_AI[e.type]?.update(this, e);
      // Dano por contato
      if (e.flags & 1) continue; // inofensivo ao toque
      const reach = e.size / 2 + 0.2;
      for (const p of this.players) {
        if (!p.alive || p.jumpT > 0) continue;
        if (Math.abs(p.x - e.x) < reach && Math.abs(p.y - e.y) < reach) this.hurt(p, -2);
      }
    }
    if (this.tick % 120 === 0) this.enemies = this.enemies.filter((e) => e.alive || e.deadT < 120);
  }

  private updateProjectiles() {
    for (let k = this.projectiles.length - 1; k >= 0; k--) {
      const pr = this.projectiles[k];
      pr.x += pr.vx / 60;
      pr.y += pr.vy / 60;
      pr.life--;
      const tx = Math.round(pr.x),
        ty = Math.round(pr.y);
      let dead = pr.life <= 0;
      if (!dead) {
        const t = this.tileAt(tx, ty);
        if (t !== T.Empty && t !== T.MirrorA && t !== T.MirrorB) dead = true;
        if (t === T.Block && pr.kind === 'rock') this.hitTile(tx, ty, { owner: -1, kind: B.Normal, src: -1, depth: 0 });
      }
      if (!dead) {
        for (const p of this.players) {
          if (!p.alive || p.jumpT > 0) continue;
          if (Math.abs(p.x - pr.x) < 0.45 && Math.abs(p.y - pr.y) < 0.45) {
            if (pr.kind === 'shard') {
              if (p.invuln === 0 && p.dashT === 0) {
                p.stunT = Math.max(p.stunT, secs(0.9));
                this.emit({ e: 'freeze', x: p.x, y: p.y });
              }
              this.hurt(p, -2);
            } else this.hurt(p, -2);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        const b = this.bombAt(tx, ty);
        if (b && pr.kind === 'orb') {
          b.fuse = Math.min(b.fuse, CHAIN_DELAY);
          dead = true;
        }
      }
      if (dead) this.projectiles.splice(k, 1);
    }
  }

  // ───────────────────────── API para modos/missões ─────────────────────────
  spawnEnemy(type: string, x: number, y: number, opts: Partial<Enemy> = {}): Enemy {
    const e: Enemy = {
      id: this.nextId++,
      type,
      x,
      y,
      dir: 2,
      hp: 1,
      maxHp: 1,
      speed: 2.2,
      state: 0,
      timer: 0,
      timer2: 0,
      tx: x,
      ty: y,
      invuln: 0,
      alive: true,
      deadT: 0,
      boss: false,
      size: 1,
      flags: 0,
      data: [0, 0, 0, 0],
      path: [],
      spawnT: 30,
      tele: 0,
      stunT: 0,
      ...opts,
    };
    e.maxHp = Math.max(e.maxHp, e.hp);
    this.enemies.push(e);
    return e;
  }

  alivePlayers() {
    return this.players.filter((p) => p.alive);
  }
  aliveTeams(): Set<number> {
    return new Set(this.players.filter((p) => p.alive).map((p) => p.team));
  }
  openDoors() {
    for (const i of this.doors) {
      if (this.tiles[i] === T.Door) {
        this.setTile(i, T.Empty);
        this.emit({ e: 'door', x: i % this.w, y: (i / this.w) | 0 });
      }
    }
  }
  message(msg: string, kind: 'progress' | 'done' | 'fail' | 'info' = 'info') {
    this.emit({ e: 'obj', msg, kind });
  }
}

export interface FlameCtx {
  owner: number;
  kind: number;
  src: number;
  depth: number;
  ref?: number;
}
