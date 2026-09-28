import { B, CHARACTERS, DX, DY, F, FLAME_TIME, I, ITEMS, T, type Game, type GEvent, type Player } from '@estopim/shared';
import { BIOME_ART } from '../art/biomes';
import { drawCharacter } from '../art/characters';
import { circle, clamp, ellipse, lerp, makeCanvas, rr, withAlpha, type Ctx } from '../art/draw';
import { drawBomb, drawItem } from '../art/objects';
import { LIFT, TileArt } from '../art/tiles';
import { drawEnemy } from '../art/enemies';
import { Particles } from './particles';
import { SKINS } from '../content/cosmetics';

export const SLOT_COLORS = ['#ff8a3d', '#4cc9f0', '#8ac926', '#f15bb5', '#ffd166', '#9b5de5', '#00f5d4', '#ff5d8f'];
export const TEAM_COLORS = ['#ff8a3d', '#4cc9f0', '#8ac926', '#f15bb5'];

export interface RenderSettings {
  quality: 0 | 1 | 2; // baixa, média, alta
  shake: number; // 0..1
  reducedMotion: boolean;
  flashes: boolean;
  markers: boolean; // marcadores de forma acima dos jogadores
}

export interface ViewInfo {
  local: number[]; // ids de jogadores locais
  localTeam: number;
  spectate?: boolean;
}

interface Light {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  dpr = 1;
  W = 0; // px do dispositivo
  H = 0;
  S = 48;
  camX = 0;
  camY = 0;
  camTX = 0;
  camTY = 0;
  fitAll = true;
  tiles: TileArt | null = null;
  floorCache: HTMLCanvasElement | null = null;
  floorKey = '';
  parts = new Particles();
  lights: Light[] = [];
  shakeT = 0;
  shakeAmp = 0;
  flashA = 0;
  flashColor = '#fff';
  time = 0;
  prev = new Map<string, [number, number]>();
  hitFlash = new Map<number, number>();
  deathAt = new Map<number, [number, number, number]>();
  settings: RenderSettings = { quality: 2, shake: 1, reducedMotion: false, flashes: true, markers: true };
  darkCanvas: HTMLCanvasElement | null = null;
  view: ViewInfo = { local: [0], localTeam: 0 };
  hudInsetTop = 0;
  hudInsetBottom = 0;
  minTile = 30;
  zoomPunch = 0;
  hudInsetX = 0;
  emotes = new Map<number, { glyph: string; text: string; t: number }>();
  trailT = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(cssW: number, cssH: number) {
    const q = this.settings.quality;
    this.dpr = Math.min(window.devicePixelRatio || 1, q === 2 ? 2 : q === 1 ? 1.5 : 1);
    this.W = Math.round(cssW * this.dpr);
    this.H = Math.round(cssH * this.dpr);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.floorKey = '';
  }

  /** Guarda posições anteriores para interpolar. Chame antes de cada passo da simulação. */
  capture(g: Game) {
    for (const p of g.players) this.prev.set('p' + p.id, [p.x, p.y]);
    for (const b of g.bombs) this.prev.set('b' + b.id, [b.x + b.vx * b.prog, b.y + b.vy * b.prog]);
    for (const e of g.enemies) this.prev.set('e' + e.id, [e.x, e.y]);
  }

  lerpPos(key: string, x: number, y: number, a: number): [number, number] {
    const p = this.prev.get(key);
    if (!p) return [x, y];
    if (Math.abs(p[0] - x) > 1.5 || Math.abs(p[1] - y) > 1.5) return [x, y]; // teleporte
    return [lerp(p[0], x, a), lerp(p[1], y, a)];
  }

  layout(g: Game) {
    const availH = this.H - (this.hudInsetTop + this.hudInsetBottom) * this.dpr;
    const availW = this.W - this.hudInsetX * 2 * this.dpr;
    const fit = Math.min(availW / g.w, availH / (g.h + LIFT));
    const minS = this.minTile * this.dpr;
    this.S = Math.floor(Math.max(fit, Math.min(minS, fit * 1.6)));
    this.fitAll = this.S <= fit + 0.5;
    const key = `${g.map.id}:${this.S}:${g.w}x${g.h}:${g.map.biome}`;
    if (key !== this.floorKey) {
      this.floorKey = key;
      this.tiles = new TileArt(g.map.biome, this.S);
      this.floorCache = this.tiles.renderFloor(g.w, g.h, g.floor, g.tiles);
      (this as any)._floorSig = floorSig(g);
    } else if ((this as any)._floorSig !== floorSig(g)) {
      (this as any)._floorSig = floorSig(g);
      this.floorCache = this.tiles!.renderFloor(g.w, g.h, g.floor, g.tiles);
    }
  }

  // ─────────────────────────────── eventos → efeitos ───────────────────────────────
  onEvents(g: Game, evs: GEvent[]) {
    const P = this.parts;
    const rm = this.settings.reducedMotion;
    for (const ev of evs) {
      switch (ev.e) {
        case 'boom': {
          const big = ev.k === B.Potato ? 2 : 1;
          const col = ev.k === B.Frost ? '#bfe9ff' : ev.k === B.Pulse ? '#4cc9f0' : '#ffb347';
          this.lights.push({ x: ev.x, y: ev.y, r: (2.5 + ev.r * 0.6) * big, life: 0.35, max: 0.35, color: col });
          this.addShake((0.18 + Math.min(0.25, ev.r * 0.03)) * big + ev.chain * 0.04);
          if (ev.k === B.Pulse) {
            for (let k = 0; k < 3; k++) P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.2, grow: 5 + k * 2, max: 0.45, color: '#8fe3ff', add: true });
            break;
          }
          const n = P.count(18 + ev.r * 3);
          for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 3 + Math.random() * 7;
            P.spawn({
              t: 'spark',
              x: ev.x,
              y: ev.y,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              vz: Math.random() * 4,
              g: 12,
              drag: 0.06,
              max: 0.35 + Math.random() * 0.35,
              size: 0.06,
              color: ev.k === B.Frost ? '#e8fbff' : Math.random() < 0.5 ? '#ffe08a' : '#ff8a3d',
              add: true,
            });
          }
          P.spawn({ t: 'glow', x: ev.x, y: ev.y, size: 1.4 + ev.r * 0.1, max: 0.25, color: ev.k === B.Frost ? 'rgba(200,240,255,0.9)' : 'rgba(255,230,160,0.95)', add: true });
          P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.3, grow: 6, max: 0.3, color: ev.k === B.Frost ? '#bfe9ff' : '#ffd08a', add: true });
          if (!rm && this.settings.flashes && ev.chain >= 3) {
            this.flashA = Math.min(0.25, 0.08 + ev.chain * 0.03);
            this.flashColor = '#ffe6b0';
          }
          if (ev.chain >= 2 && this.isLocal(ev.p)) P.spawn({ t: 'text', x: ev.x, y: ev.y - 0.8, vy: -0.8, max: 1.1, size: 0.45, color: '#ffd166', text: `CADEIA ×${ev.chain + 1}` });
          if (ev.k === B.Barrel) {
            for (let k = 0; k < P.count(10); k++)
              P.spawn({ t: 'confetti', x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: 4 + Math.random() * 4, g: 10, max: 1.4, size: 0.12, color: ['#ff5d8f', '#ffd166', '#4cc9f0', '#8ac926'][k % 4], vr: 8 });
          }
          break;
        }
        case 'block': {
          const art = BIOME_ART[g.map.biome];
          const cols = ev.t === T.Vine ? ['#3f8f47', '#8be07a', '#2f6b37'] : ev.t === T.Barrel ? ['#e8413b', '#ffcf3d'] : [art.blockTop, art.blockFront, art.blockHi];
          for (let k = 0; k < P.count(9); k++) {
            P.spawn({
              t: ev.t === T.Vine ? 'shard' : 'debris',
              x: ev.x + (Math.random() - 0.5) * 0.5,
              y: ev.y + (Math.random() - 0.5) * 0.5,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              vz: 3 + Math.random() * 4,
              g: 16,
              drag: 0.02,
              max: 0.9 + Math.random() * 0.4,
              size: 0.1 + Math.random() * 0.1,
              color: cols[k % cols.length],
              rot: Math.random() * 6,
              vr: (Math.random() - 0.5) * 16,
            });
          }
          for (let k = 0; k < P.count(4); k++)
            P.spawn({ t: 'smoke', x: ev.x + (Math.random() - 0.5) * 0.6, y: ev.y + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: -0.4, max: 1 + Math.random() * 0.6, size: 0.25, grow: 0.35, color: 'rgba(80,70,80,1)', drag: 0.05 });
          if (ev.item) this.lights.push({ x: ev.x, y: ev.y, r: 1.4, life: 0.5, max: 0.5, color: '#ffe08a' });
          break;
        }
        case 'pickup': {
          const def = ITEMS[ev.i];
          const good = def?.good ?? true;
          P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.2, grow: 3, max: 0.35, color: good ? '#ffffff' : '#b06bff', add: true });
          for (let k = 0; k < P.count(8); k++) {
            const a = (k / 8) * Math.PI * 2;
            P.spawn({ t: 'star', x: ev.x, y: ev.y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, drag: 0.08, max: 0.5, size: 0.12, color: good ? '#fff1a8' : '#c792ff', add: true });
          }
          if (this.isLocal(ev.p) && def) P.spawn({ t: 'text', x: ev.x, y: ev.y - 0.7, vy: -1.1, drag: 0.04, max: 1.0, size: 0.34, color: good ? '#fff3c4' : '#d8b4ff', text: def.name });
          break;
        }
        case 'burnItem':
          for (let k = 0; k < P.count(6); k++) P.spawn({ t: 'ember', x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random(), max: 0.7, size: 0.05, color: '#ffb347', add: true });
          break;
        case 'place':
          for (let k = 0; k < P.count(5); k++) P.spawn({ t: 'dust', x: ev.x + (Math.random() - 0.5) * 0.4, y: ev.y + 0.25, vx: (Math.random() - 0.5) * 1.5, vy: -0.2, max: 0.45, size: 0.08, grow: 0.15, color: 'rgba(240,220,200,1)', drag: 0.1 });
          this.zoomPunch = Math.max(this.zoomPunch, 0);
          break;
        case 'kick':
          for (let k = 0; k < P.count(6); k++) P.spawn({ t: 'dust', x: ev.x, y: ev.y + 0.2, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, max: 0.4, size: 0.08, grow: 0.2, color: 'rgba(240,220,200,1)', drag: 0.12 });
          P.spawn({ t: 'text', x: ev.x, y: ev.y - 0.5, vy: -1, max: 0.5, size: 0.28, color: '#fff', text: 'TUM!' });
          break;
        case 'hit': {
          this.hitFlash.set(ev.p, 0.35);
          if (ev.shield) {
            P.spawn({ t: 'ring', x: ev.x, y: ev.y - 0.3, size: 0.4, grow: 4, max: 0.4, color: '#6ec6ff', add: true });
            for (let k = 0; k < P.count(10); k++) P.spawn({ t: 'shard', x: ev.x, y: ev.y - 0.3, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: 2, g: 10, max: 0.6, size: 0.1, color: '#a8dcff', vr: 10, rot: Math.random() * 6 });
          }
          break;
        }
        case 'death': {
          const pl = g.players[ev.p];
          this.deathAt.set(ev.p, [ev.x, ev.y, this.time]);
          this.addShake(0.45);
          const col = pl ? (pl.cosmetics && SKINS[pl.cosmetics.skin]?.colors?.[0]) || CHARACTERS[pl.char].colors[0] : '#fff';
          for (let k = 0; k < P.count(26); k++) {
            const a = Math.random() * Math.PI * 2;
            P.spawn({ t: k % 3 ? 'confetti' : 'star', x: ev.x, y: ev.y - 0.3, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4), vz: 3 + Math.random() * 3, g: 9, drag: 0.03, max: 1.2 + Math.random() * 0.6, size: 0.14, color: k % 2 ? col : '#ffffff', vr: 10, rot: Math.random() * 6 });
          }
          if (!rm && this.settings.flashes && this.isLocal(ev.p)) {
            this.flashA = 0.35;
            this.flashColor = '#ff4d3d';
          }
          break;
        }
        case 'ability':
          this.abilityFx(g, ev);
          break;
        case 'teleport':
          for (const [x, y] of [
            [ev.x, ev.y],
            [ev.x2, ev.y2],
          ]) {
            P.spawn({ t: 'ring', x, y, size: 0.7, grow: -1.2, max: 0.45, color: '#b69cff', add: true });
            for (let k = 0; k < P.count(8); k++) {
              const a = (k / 8) * Math.PI * 2;
              P.spawn({ t: 'star', x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.5, vx: -Math.cos(a) * 1.5, vy: -Math.sin(a) * 1.5, max: 0.4, size: 0.08, color: '#e0d4ff', add: true });
            }
          }
          break;
        case 'fall':
          this.addShake(0.12);
          for (let k = 0; k < P.count(6); k++) P.spawn({ t: 'dust', x: ev.x + (Math.random() - 0.5), y: ev.y + 0.4, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 1, max: 0.6, size: 0.12, grow: 0.3, color: 'rgba(200,180,170,1)', drag: 0.1 });
          break;
        case 'vent':
          for (let k = 0; k < P.count(10); k++) P.spawn({ t: 'ember', x: ev.x + (Math.random() - 0.5) * 0.5, y: ev.y, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, max: 0.8, size: 0.06, color: '#ffb000', add: true });
          this.lights.push({ x: ev.x, y: ev.y, r: 2.2, life: 0.4, max: 0.4, color: '#ff7a1a' });
          break;
        case 'pulse':
          break;
        case 'freeze':
          for (let k = 0; k < P.count(8); k++) P.spawn({ t: 'snow', x: ev.x + (Math.random() - 0.5) * 0.8, y: ev.y + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 1, vy: -0.5 - Math.random(), max: 0.9, size: 0.05, color: '#e8fbff', add: true });
          break;
        case 'curse': {
          const pl = g.players[ev.p];
          if (!pl) break;
          for (let k = 0; k < P.count(10); k++) P.spawn({ t: 'smoke', x: pl.x + (Math.random() - 0.5) * 0.6, y: pl.y - 0.4, vx: (Math.random() - 0.5), vy: -0.8, max: 0.8, size: 0.18, grow: 0.3, color: ev.c === 99 ? 'rgba(255,120,40,1)' : 'rgba(130,60,200,1)' });
          break;
        }
        case 'regrow':
          for (let k = 0; k < P.count(6); k++) P.spawn({ t: 'shard', x: ev.x + (Math.random() - 0.5) * 0.6, y: ev.y, vz: 2, g: 8, vx: (Math.random() - 0.5) * 2, max: 0.5, size: 0.08, color: '#8be07a', vr: 8 });
          break;
        case 'enemyHit': {
          for (let k = 0; k < P.count(ev.dead ? 16 : 6); k++) {
            const a = Math.random() * Math.PI * 2;
            P.spawn({ t: ev.dead ? 'debris' : 'spark', x: ev.x, y: ev.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, vz: 3, g: 12, max: 0.7, size: 0.1, color: ev.dead ? '#8a8f99' : '#ffe08a', vr: 10, add: !ev.dead });
          }
          if (ev.boss) this.addShake(0.35);
          break;
        }
        case 'respawn':
          for (let k = 0; k < P.count(12); k++) {
            const a = (k / 12) * Math.PI * 2;
            P.spawn({ t: 'star', x: ev.x + Math.cos(a) * 0.8, y: ev.y + Math.sin(a) * 0.8, vx: -Math.cos(a) * 2, vy: -Math.sin(a) * 2, max: 0.45, size: 0.1, color: '#fff3c4', add: true });
          }
          break;
        case 'core':
          P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.3, grow: 4, max: 0.5, color: '#6ef3ff', add: true });
          if (ev.a === 'score') {
            this.addShake(0.2);
            for (let k = 0; k < P.count(30); k++) P.spawn({ t: 'confetti', x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, vz: 5, g: 9, max: 1.5, size: 0.14, color: ['#6ef3ff', '#ffffff', '#ffd166'][k % 3], vr: 9 });
          }
          break;
        case 'nearMiss':
          if (this.isLocal(ev.p)) {
            const pl = g.players[ev.p];
            P.spawn({ t: 'text', x: pl.x, y: pl.y - 1.1, vy: -0.6, max: 0.9, size: 0.3, color: '#9af7ff', text: 'Por um triz!' });
          }
          break;
        case 'door':
          this.addShake(0.2);
          break;
      }
    }
  }

  abilityFx(g: Game, ev: Extract<GEvent, { e: 'ability' }>) {
    const P = this.parts;
    if (!ev.ok) {
      if (this.isLocal(ev.p)) P.spawn({ t: 'text', x: ev.x, y: ev.y - 1, vy: -0.5, max: 0.6, size: 0.26, color: '#ff9a9a', text: 'Sem espaço' });
      return;
    }
    const pl = g.players[ev.p];
    const col = CHARACTERS[pl.char].colors[1];
    switch (ev.a) {
      case 'arranque':
        for (let k = 0; k < P.count(14); k++) P.spawn({ t: 'spark', x: ev.x, y: ev.y - 0.2, vx: -DX[ev.d] * (3 + Math.random() * 5) + (Math.random() - 0.5) * 2, vy: -DY[ev.d] * (3 + Math.random() * 5) + (Math.random() - 0.5) * 2, max: 0.35, size: 0.07, color: '#ffd166', add: true });
        break;
      case 'salto':
        for (let k = 0; k < P.count(8); k++) P.spawn({ t: 'dust', x: ev.x, y: ev.y + 0.25, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 1, max: 0.5, size: 0.1, grow: 0.25, color: 'rgba(230,230,240,1)', drag: 0.1 });
        break;
      case 'prisma': {
        const x = Math.round(ev.x) + DX[ev.d],
          y = Math.round(ev.y) + DY[ev.d];
        for (let k = 0; k < P.count(12); k++) P.spawn({ t: 'shard', x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 3, g: 8, max: 0.6, size: 0.1, color: k % 2 ? '#5ef2d6' : '#b69cff', vr: 12 });
        this.lights.push({ x, y, r: 1.6, life: 0.4, max: 0.4, color: '#5ef2d6' });
        break;
      }
      case 'congelar':
        P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.4, grow: 7, max: 0.4, color: '#bfe9ff', add: true });
        for (let k = 0; k < P.count(24); k++) {
          const a = Math.random() * Math.PI * 2;
          P.spawn({ t: 'snow', x: ev.x, y: ev.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, drag: 0.08, max: 0.9, size: 0.06, color: '#ffffff', add: true });
        }
        break;
      case 'estrondo':
        this.addShake(0.3);
        P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.4, grow: 8, max: 0.35, color: '#ffd8a8', add: true });
        P.spawn({ t: 'ring', x: ev.x, y: ev.y, size: 0.3, grow: 5, max: 0.45, color: '#ff8a3d', add: true });
        P.spawn({ t: 'text', x: ev.x, y: ev.y - 1, vy: -0.8, max: 0.6, size: 0.4, color: '#ffd8a8', text: 'BUM-BUM!' });
        break;
      case 'sombra':
        for (let k = 0; k < P.count(16); k++) P.spawn({ t: 'smoke', x: ev.x + (Math.random() - 0.5) * 0.8, y: ev.y - 0.3 + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 1.5, vy: -0.3, max: 0.9, size: 0.22, grow: 0.4, color: 'rgba(40,10,70,1)', drag: 0.06 });
        break;
      case 'ima':
        for (let k = 1; k <= 6; k++) P.spawn({ t: 'ring', x: ev.x + DX[ev.d] * k, y: ev.y + DY[ev.d] * k, size: 0.45, grow: -0.6, max: 0.2 + k * 0.05, color: '#ff6b6b', add: true });
        break;
      case 'detonar':
        for (let k = 0; k < P.count(8); k++) P.spawn({ t: 'note', x: ev.x + (Math.random() - 0.5), y: ev.y - 0.6, vx: (Math.random() - 0.5) * 1.5, vy: -1.4, max: 0.9, size: 0.2, color: k % 2 ? '#ffd23f' : '#06d6a0', text: k % 2 ? '♪' : '♫' });
        break;
    }
    void col;
  }

  addShake(a: number) {
    const s = this.settings.shake * (this.settings.reducedMotion ? 0.2 : 1);
    this.shakeAmp = Math.min(1, this.shakeAmp + a * s);
  }

  isLocal(id: number) {
    return this.view.local.includes(id);
  }

  // ─────────────────────────────── render ───────────────────────────────
  render(g: Game, alpha: number, dt: number) {
    this.time += dt;
    this.layout(g);
    const c = this.ctx;
    const S = this.S;
    const L = Math.round(S * LIFT);
    const art = BIOME_ART[g.map.biome];
    this.parts.quality = this.settings.quality === 0 ? 0.35 : this.settings.quality === 1 ? 0.7 : 1;
    this.parts.update(dt);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter((l) => l.life > 0);
    for (const [k, v] of this.hitFlash) {
      if (v - dt <= 0) this.hitFlash.delete(k);
      else this.hitFlash.set(k, v - dt);
    }

    // fundo
    const bg = c.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, art.bgTop);
    bg.addColorStop(1, art.bgBottom);
    c.fillStyle = bg;
    c.fillRect(0, 0, this.W, this.H);
    this.drawBackdrop(c, g);

    // câmera
    const mapW = g.w * S,
      mapH = g.h * S;
    const top = this.hudInsetTop * this.dpr;
    const availH = this.H - top - this.hudInsetBottom * this.dpr;
    let ox: number, oy: number;
    if (this.fitAll) {
      ox = (this.W - mapW) / 2;
      if (this.hudInsetX) ox = Math.max(this.hudInsetX * this.dpr, ox);
      oy = top + (availH - mapH - L) / 2 + L;
    } else {
      const focus = this.focusPoint(g, alpha);
      this.camTX = clamp(focus[0] * S - this.W / 2, Math.min(0, mapW - this.W), Math.max(0, mapW - this.W));
      this.camTY = clamp(focus[1] * S - top - availH / 2, -L, Math.max(-L, mapH - availH));
      const k = 1 - Math.pow(0.001, dt);
      this.camX = lerp(this.camX, this.camTX, k);
      this.camY = lerp(this.camY, this.camTY, k);
      if (mapW < this.W) this.camX = (mapW - this.W) / 2;
      ox = -this.camX;
      oy = top - this.camY;
    }
    // tremor
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
    const sh = this.shakeAmp * this.shakeAmp * S * 0.22;
    const sx = (Math.random() - 0.5) * sh,
      sy = (Math.random() - 0.5) * sh;
    c.save();
    c.translate(Math.round(ox + sx), Math.round(oy + sy));

    // piso
    if (this.floorCache) c.drawImage(this.floorCache, 0, 0);
    this.drawFloorDynamic(c, g, S);
    this.drawHazards(c, g, S);

    // sombras dos sólidos dinâmicos
    c.fillStyle = art.shadow;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const t = g.tiles[y * g.w + x];
        if (t === T.Block || t === T.Hard || t === T.Vine || t === T.Barrel || t === T.Crystal || t === T.Target) {
          c.beginPath();
          c.ellipse(x * S + S * 0.58, y * S + S * 0.9, S * 0.48, S * 0.16, 0, 0, Math.PI * 2);
          c.fill();
        }
      }

    // coleta entidades por linha
    const rows: (() => void)[][] = Array.from({ length: g.h + 2 }, () => []);
    const push = (y: number, f: () => void) => rows[clamp(Math.round(y), 0, g.h + 1)].push(f);

    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      if (!it || g.tiles[i] !== T.Empty) continue;
      const x = i % g.w,
        y = (i / g.w) | 0;
      push(y, () => drawItem(c, x * S + S / 2, y * S + S / 2, S, it, this.time, g.itemProt[i] ? 0.5 + 0.5 * Math.sin(this.time * 30) : 1));
    }
    for (const b of g.bombs) {
      const [bx, by] = this.lerpPos('b' + b.id, b.x + b.vx * b.prog, b.y + b.vy * b.prog, alpha);
      const owner = g.players[b.owner];
      const friendly = !owner || this.view.local.some((id) => g.players[id]?.team === owner.team) || !!this.view.spectate;
      if (b.kind === B.Mine && b.armed > 50 && !friendly) continue;
      const frac = b.kind === B.Mine || b.kind === B.Remote ? 0 : 1 - b.fuse / Math.max(1, b.maxFuse);
      push(by, () =>
        drawBomb(c, bx * S + S / 2, by * S + S / 2, S, {
          kind: b.kind,
          skin: owner?.cosmetics.bomb ?? 'classica',
          t: this.time + b.id,
          fuseFrac: clamp(frac, 0, 1),
          frozen: b.frozen > 0,
          showRing: !b.hidden || friendly,
          z: b.z,
          alpha: b.kind === B.Mine && b.armed > 50 ? 0.55 : 1,
        }),
      );
    }
    for (const e of g.enemies) {
      const [ex, ey] = this.lerpPos('e' + e.id, e.x, e.y, alpha);
      push(ey + (e.size - 1) / 2, () => drawEnemy(c, ex * S + S / 2, ey * S + S / 2 + S * 0.28, S, e, this.time, g));
    }
    for (const p of g.players) {
      const [px, py] = this.lerpPos('p' + p.id, p.x, p.y, alpha);
      push(py, () => this.drawPlayer(c, g, p, px, py, S));
    }
    // objetos de modo (núcleo)
    const core = g.mstate.core;
    if (core && core.carrier < 0) push(core.y, () => this.drawCore(c, core.x * S + S / 2, core.y * S + S / 2, S));

    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const t = g.tiles[y * g.w + x];
        if (t === T.Empty) continue;
        const spr = this.tiles!.solid(t, this.neighborMask(g, x, y, t), (x * 7 + y * 13) & 15);
        if (spr) c.drawImage(spr, x * S, y * S - L);
        if (t === T.Crystal) {
          const tt = g.tileT[y * g.w + x];
          if (tt < 60 && Math.floor(this.time * 10) % 2) {
            c.fillStyle = 'rgba(255,255,255,0.3)';
            c.fillRect(x * S + S * 0.2, y * S - L * 0.5, S * 0.6, S);
          }
        }
      }
      for (const f of rows[y]) f();
    }
    for (const f of rows[g.h]) f();
    for (const f of rows[g.h + 1]) f();

    // chamas e luzes aditivas
    c.globalCompositeOperation = 'lighter';
    this.drawFlames(c, g, S);
    this.drawProjectiles(c, g, S);
    this.drawLights(c, S);
    this.parts.draw(c, S, 'add');
    c.globalCompositeOperation = 'source-over';
    this.parts.draw(c, S, 'normal');

    // escuridão (mapa neon)
    if (g.dark) this.drawDarkness(c, g, S, alpha);

    this.drawOverhead(c, g, S, alpha);
    c.restore();

    // vinheta e flash
    if (this.settings.quality > 0) {
      const vg = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, withAlpha(art.ambient, 0.55));
      c.fillStyle = vg;
      c.fillRect(0, 0, this.W, this.H);
    }
    if (this.flashA > 0) {
      c.fillStyle = withAlpha(this.flashColor, this.flashA);
      c.fillRect(0, 0, this.W, this.H);
      this.flashA = Math.max(0, this.flashA - dt * 1.4);
    }
    if (g.sudden && g.phase === 'play') {
      const a = 0.12 + 0.08 * Math.sin(this.time * 5);
      c.strokeStyle = `rgba(255,60,40,${a})`;
      c.lineWidth = 10 * this.dpr;
      c.strokeRect(0, 0, this.W, this.H);
    }
  }

  focusPoint(g: Game, alpha: number): [number, number] {
    const locals = this.view.local.map((id) => g.players[id]).filter((p) => p);
    const alive = locals.filter((p) => p.alive);
    const list = alive.length ? alive : locals;
    if (!list.length) return [g.w / 2, g.h / 2];
    let x = 0,
      y = 0;
    for (const p of list) {
      const [px, py] = this.lerpPos('p' + p.id, p.x, p.y, alpha);
      x += px + (p.moving ? DX[p.dir] * 0.8 : 0);
      y += py + (p.moving ? DY[p.dir] * 0.8 : 0);
    }
    return [x / list.length + 0.5, y / list.length + 0.5];
  }

  neighborMask(g: Game, x: number, y: number, t: number) {
    const same = (xx: number, yy: number) => {
      const tt = g.tileAt(xx, yy);
      return tt === t || (t === T.Wall && tt === T.Door) || (t === T.Wall && tt === T.Cracked);
    };
    return (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x, y + 1) ? 4 : 0) | (same(x - 1, y) ? 8 : 0);
  }

  drawBackdrop(c: Ctx, g: Game) {
    // partículas ambientes discretas por bioma
    if (this.settings.quality === 0) return;
    const b = g.map.biome;
    const t = this.time;
    c.save();
    const n = 18;
    for (let k = 0; k < n; k++) {
      const seed = k * 97.13;
      const x = ((seed * 13.7 + t * (b === 'boreal' ? 8 : 4) * (0.5 + (k % 3) * 0.3)) % (this.W + 40)) - 20;
      const y = ((seed * 7.3 + (b === 'boreal' ? t * 20 : -t * 10) * (0.5 + (k % 4) * 0.2)) % (this.H + 40) + this.H + 40) % (this.H + 40) - 20;
      c.globalAlpha = 0.18 + (k % 3) * 0.08;
      c.fillStyle = b === 'boreal' ? '#ffffff' : b === 'magma' || b === 'fundicao' ? '#ff9a3d' : b === 'verdejante' ? '#bfff9a' : b === 'neon' ? (k % 2 ? '#ff3cac' : '#3cf2ff') : b === 'orbita' ? '#ffffff' : '#ffd8a8';
      circle(c, x, y, (1 + (k % 3)) * this.dpr);
      c.fill();
    }
    c.restore();
  }

  drawFloorDynamic(c: Ctx, g: Game, S: number) {
    const t = this.time;
    for (let i = 0; i < g.floor.length; i++) {
      const fl = g.floor[i];
      const x = i % g.w,
        y = (i / g.w) | 0;
      const px = x * S,
        py = y * S;
      if (g.frostT[i] && fl !== F.Ice) {
        c.fillStyle = `rgba(200,240,255,${Math.min(0.75, g.frostT[i] / 60)})`;
        c.fillRect(px, py, S, S);
      }
      if (g.chillT[i]) {
        c.fillStyle = `rgba(160,220,255,${Math.min(0.35, g.chillT[i] / 120)})`;
        c.fillRect(px + S * 0.1, py + S * 0.1, S * 0.8, S * 0.8);
      }
      if (fl >= F.ConvU && fl <= F.ConvL) {
        const d = fl - F.ConvU;
        c.fillStyle = '#2a2d35';
        c.fillRect(px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88);
        c.save();
        c.beginPath();
        c.rect(px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88);
        c.clip();
        c.translate(px + S / 2, py + S / 2);
        c.rotate((d - 1) * (Math.PI / 2));
        const off = ((t * 1.7) % 0.5) * S;
        c.fillStyle = '#f2a33a';
        for (let k = -2; k <= 2; k++) {
          const ax = k * S * 0.5 + off - S * 0.25;
          c.beginPath();
          c.moveTo(ax - S * 0.12, -S * 0.2);
          c.lineTo(ax + S * 0.08, 0);
          c.lineTo(ax - S * 0.12, S * 0.2);
          c.lineTo(ax - S * 0.02, S * 0.2);
          c.lineTo(ax + S * 0.18, 0);
          c.lineTo(ax - S * 0.02, -S * 0.2);
          c.closePath();
          c.fill();
        }
        c.restore();
      } else if (fl === F.Teleport) {
        c.save();
        c.translate(px + S / 2, py + S / 2);
        c.rotate(t * 2);
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          c.strokeStyle = `rgba(160,130,255,${0.5 - k * 0.12})`;
          c.lineWidth = S * 0.05;
          c.beginPath();
          c.arc(0, 0, S * (0.12 + k * 0.1), k, k + Math.PI * 1.2);
          c.stroke();
        }
        c.restore();
      } else if (fl === F.Zone) {
        const holder = g.mstate.holder;
        const a = 0.15 + 0.1 * Math.sin(t * 4);
        c.fillStyle = holder >= 0 ? withAlpha(TEAM_COLORS[holder % 4], 0.3 + a) : holder === -2 ? `rgba(255,80,80,${0.2 + a})` : `rgba(255,209,102,${a})`;
        c.fillRect(px, py, S, S);
      } else if (fl === F.Exit) {
        const open = !!g.mstate.exitOpen;
        const gg = c.createRadialGradient(px + S / 2, py + S / 2, 0, px + S / 2, py + S / 2, S * 0.45);
        gg.addColorStop(0, open ? 'rgba(120,255,200,0.95)' : 'rgba(120,120,160,0.4)');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gg;
        circle(c, px + S / 2, py + S / 2, S * 0.45);
        c.fill();
        if (open) {
          c.strokeStyle = 'rgba(160,255,220,0.9)';
          c.lineWidth = S * 0.04;
          circle(c, px + S / 2, py + S / 2, S * (0.25 + 0.1 * Math.sin(t * 5)));
          c.stroke();
        }
      } else if (fl === F.Plate) {
        const pressed = g.mstate.plates?.[i];
        if (pressed) {
          c.fillStyle = 'rgba(120,255,160,0.4)';
          rr(c, px + S * 0.24, py + S * 0.22, S * 0.52, S * 0.5, S * 0.08);
          c.fill();
        }
      }
    }
    // bases
    if (g.mstate.baseOf) {
      c.save();
      c.globalAlpha = 0.25 + 0.1 * Math.sin(t * 3);
      const teams = g.mstate.teams as number[];
      teams.forEach((team, k) => {
        c.fillStyle = TEAM_COLORS[k === 0 ? 0 : 1];
        for (const i of g.mstate.baseOf[team] as number[]) c.fillRect((i % g.w) * S, ((i / g.w) | 0) * S, S, S);
        void team;
      });
      c.restore();
    }
  }

  drawHazards(c: Ctx, g: Game, S: number) {
    for (const hz of g.hazards) {
      const k = 1 - hz.t / hz.total;
      const px = hz.x * S + S / 2,
        py = hz.y * S + S / 2;
      if (hz.kind === 'fall' || hz.kind === 'rain') {
        const r = S * (0.15 + 0.3 * k);
        c.fillStyle = `rgba(0,0,0,${0.2 + 0.4 * k})`;
        ellipse(c, px, py + S * 0.1, r, r * 0.6);
        c.fill();
        // marca X (sinal independente de cor)
        c.strokeStyle = hz.kind === 'rain' ? `rgba(110,243,255,${0.4 + 0.5 * k})` : `rgba(255,80,60,${0.4 + 0.5 * k})`;
        c.lineWidth = S * 0.05;
        const q = S * 0.18;
        c.beginPath();
        c.moveTo(px - q, py - q);
        c.lineTo(px + q, py + q);
        c.moveTo(px + q, py - q);
        c.lineTo(px - q, py + q);
        c.stroke();
        if (hz.kind === 'fall') {
          const fy = py - (1 - k) * S * 4 - S * 0.3;
          c.globalAlpha = k;
          const spr = this.tiles!.solid(T.Pillar, 0, 1);
          if (spr) c.drawImage(spr, hz.x * S, fy - S / 2 - S * LIFT + S * 0.3);
          c.globalAlpha = 1;
        } else {
          drawBomb(c, px, py, S, { kind: B.Rain, skin: 'classica', t: this.time, fuseFrac: 0, frozen: false, showRing: false, z: (1 - k) * 1.5 });
        }
      } else if (hz.kind === 'vent') {
        const a = 0.25 + 0.5 * k * (0.6 + 0.4 * Math.sin(this.time * 20));
        const gg = c.createRadialGradient(px, py, 0, px, py, S * 0.6);
        gg.addColorStop(0, `rgba(255,200,60,${a})`);
        gg.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = gg;
        circle(c, px, py, S * 0.6);
        c.fill();
        c.strokeStyle = `rgba(255,220,120,${0.3 + 0.6 * k})`;
        c.lineWidth = S * 0.04;
        rr(c, hz.x * S + S * 0.08, hz.y * S + S * 0.08, S * 0.84, S * 0.84, S * 0.16);
        c.stroke();
      } else {
        c.fillStyle = hz.kind === 'frost' ? `rgba(160,220,255,${0.2 + 0.5 * k})` : `rgba(255,60,90,${0.15 + 0.45 * k})`;
        rr(c, hz.x * S + S * 0.06, hz.y * S + S * 0.06, S * 0.88, S * 0.88, S * 0.14);
        c.fill();
        c.strokeStyle = hz.kind === 'frost' ? 'rgba(220,245,255,0.9)' : 'rgba(255,120,140,0.9)';
        c.lineWidth = S * 0.035;
        c.stroke();
      }
    }
  }

  drawFlames(c: Ctx, g: Game, S: number) {
    const t = this.time;
    for (let i = 0; i < g.flame.length; i++) {
      const f = g.flame[i];
      if (!f) continue;
      const x = i % g.w,
        y = (i / g.w) | 0;
      const age = FLAME_TIME - f;
      let dist = 0;
      const src = g.flameSrc[i];
      if (src >= 0) dist = Math.abs((src % g.w) - x) + Math.abs(((src / g.w) | 0) - y);
      const reveal = clamp((age + 1.5 - dist * 0.7) / 3, 0, 1);
      if (reveal <= 0) continue;
      const life = f / FLAME_TIME;
      const k = Math.min(1, life * 2.2) * reveal;
      const kind = g.flameKind[i];
      const pal =
        kind === B.Frost
          ? ['rgba(90,170,255,', 'rgba(170,225,255,', 'rgba(245,252,255,']
          : kind === B.Enemy
            ? ['rgba(200,30,120,', 'rgba(255,80,160,', 'rgba(255,220,240,']
            : ['rgba(255,70,20,', 'rgba(255,165,40,', 'rgba(255,248,210,'];
      const cx = x * S + S / 2,
        cy = y * S + S / 2;
      const bits = g.flameDir[i];
      const wob = Math.sin(t * 40 + i) * 0.04;
      const layers: [number, string][] = [
        [0.95 + wob, pal[0]],
        [0.66 + wob, pal[1]],
        [0.34, pal[2]],
      ];
      for (const [wd, col] of layers) {
        const w = S * wd * (0.55 + 0.45 * k);
        c.fillStyle = col + (0.55 + 0.45 * k) + ')';
        rr(c, cx - w / 2, cy - w / 2, w, w, w / 2);
        c.fill();
        for (let d = 0; d < 4; d++) {
          if (!(bits & (1 << d))) continue;
          const ex = cx + DX[d] * S * 0.5,
            ey = cy + DY[d] * S * 0.5;
          const x0 = Math.min(cx, ex) - (DX[d] === 0 ? w / 2 : 0);
          const y0 = Math.min(cy, ey) - (DY[d] === 0 ? w / 2 : 0);
          const ww = DX[d] === 0 ? w : Math.abs(ex - cx) + 1;
          const hh = DY[d] === 0 ? w : Math.abs(ey - cy) + 1;
          c.fillRect(x0, y0, ww, hh);
        }
      }
      // brilho de chão
      if (this.settings.quality > 0 && (bits & 16 || (x + y) % 2 === 0)) {
        const gg = c.createRadialGradient(cx, cy, 0, cx, cy, S * 1.1);
        gg.addColorStop(0, pal[1] + 0.25 * k + ')');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gg;
        c.fillRect(cx - S * 1.1, cy - S * 1.1, S * 2.2, S * 2.2);
      }
      // brasas
      if (this.settings.quality > 0 && Math.random() < 0.12 * this.parts.quality) {
        this.parts.spawn({ t: 'ember', x: x + 0.5 + (Math.random() - 0.5) * 0.6 - 0.5, y: y + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random(), max: 0.6, size: 0.035, color: kind === B.Frost ? '#e8fbff' : '#ffcf6a', add: true });
      }
      // fumaça no fim
      if (f === 3 && Math.random() < 0.5 * this.parts.quality) {
        this.parts.spawn({ t: 'smoke', x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.5, max: 0.9, size: 0.2, grow: 0.35, color: kind === B.Frost ? 'rgba(220,240,255,1)' : 'rgba(70,60,70,1)', drag: 0.05 });
      }
    }
  }

  drawProjectiles(c: Ctx, g: Game, S: number) {
    for (const pr of g.projectiles) {
      const px = pr.x * S + S / 2,
        py = pr.y * S + S / 2;
      const col = pr.kind === 'shard' ? '#bfe9ff' : pr.kind === 'spore' ? '#b6ff6a' : pr.kind === 'rock' ? '#ff9a3d' : '#ff5dc8';
      const gg = c.createRadialGradient(px, py, 0, px, py, S * 0.35);
      gg.addColorStop(0, '#ffffff');
      gg.addColorStop(0.3, col);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg;
      circle(c, px, py, S * 0.35);
      c.fill();
    }
  }

  drawLights(c: Ctx, S: number) {
    if (this.settings.quality === 0) return;
    for (const l of this.lights) {
      const k = l.life / l.max;
      const px = l.x * S + S / 2,
        py = l.y * S + S / 2;
      const r = l.r * S * (0.6 + 0.4 * (1 - k));
      const gg = c.createRadialGradient(px, py, 0, px, py, r);
      gg.addColorStop(0, withAlpha(l.color.startsWith('#') ? l.color : '#ffffff', 0.45 * k));
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg;
      c.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }

  drawDarkness(c: Ctx, g: Game, S: number, alpha: number) {
    const w = g.w * S,
      h = (g.h + 1) * S;
    if (!this.darkCanvas || this.darkCanvas.width !== w || this.darkCanvas.height !== h) this.darkCanvas = makeCanvas(w, h)[0];
    const d = this.darkCanvas.getContext('2d')!;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, w, h);
    d.fillStyle = 'rgba(4,1,10,0.94)';
    d.fillRect(0, 0, w, h);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a = 1) => {
      const px = x * S + S / 2,
        py = y * S + S / 2 + S;
      const gg = d.createRadialGradient(px, py, 0, px, py, r * S);
      gg.addColorStop(0, `rgba(0,0,0,${a})`);
      gg.addColorStop(0.6, `rgba(0,0,0,${a * 0.8})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gg;
      d.fillRect(px - r * S, py - r * S, r * 2 * S, r * 2 * S);
    };
    for (const id of this.view.local) {
      const p = g.players[id];
      if (!p) continue;
      const [px, py] = this.lerpPos('p' + p.id, p.x, p.y, alpha);
      hole(px, py, p.alive ? 3.6 : 2, 1);
    }
    if (this.view.spectate || !this.view.local.length) for (const p of g.players) if (p.alive) hole(p.x, p.y, 3, 1);
    for (const b of g.bombs) hole(b.x + b.vx * b.prog, b.y + b.vy * b.prog, 1.3, 0.85);
    for (let i = 0; i < g.flame.length; i++) if (g.flame[i] && i % 2 === 0) hole(i % g.w, (i / g.w) | 0, 2.2, 1);
    for (const l of this.lights) hole(l.x, l.y, l.r * 0.8, l.life / l.max);
    // placas de neon fixas nos cantos
    const flick = 0.6 + 0.4 * Math.sin(this.time * 3);
    hole(g.w / 2 - 0.5, g.h / 2 - 0.5, 1.6, 0.5 * flick);
    c.drawImage(this.darkCanvas, 0, -S);
  }

  drawCore(c: Ctx, x: number, y: number, S: number) {
    const t = this.time;
    const bob = Math.sin(t * 3) * S * 0.06;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(c, x, y + S * 0.3, S * 0.3, S * 0.1);
    c.fill();
    const gg = c.createRadialGradient(x, y - S * 0.1 + bob, 0, x, y - S * 0.1 + bob, S * 0.5);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.3, '#6ef3ff');
    gg.addColorStop(1, 'rgba(40,120,255,0)');
    c.fillStyle = gg;
    circle(c, x, y - S * 0.1 + bob, S * 0.5);
    c.fill();
    c.save();
    c.translate(x, y - S * 0.1 + bob);
    c.rotate(t);
    c.strokeStyle = '#e8fbff';
    c.lineWidth = S * 0.04;
    rr(c, -S * 0.16, -S * 0.16, S * 0.32, S * 0.32, S * 0.06);
    c.stroke();
    c.restore();
  }

  drawPlayer(c: Ctx, g: Game, p: Player, px: number, py: number, S: number) {
    const cx = px * S + S / 2;
    const cy = py * S + S / 2 + S * 0.28;
    const t = this.time + p.id * 1.7;
    if (!p.alive) {
      const d = this.deathAt.get(p.id);
      const since = d ? this.time - d[2] : 99;
      if (since < 0.6) {
        const k = since / 0.6;
        drawCharacter(c, cx, cy - k * S * 0.4, S, { char: p.char, dir: 2, t, moving: false, alpha: 1 - k, flash: 1 - k, squash: -k, scale: 1 + k * 0.3, colors: skinColors(p) });
      } else if (since < 2.5) {
        // alma subindo
        const k = (since - 0.6) / 1.9;
        c.save();
        c.globalAlpha = 0.5 * (1 - k);
        c.fillStyle = '#ffffff';
        ellipse(c, cx + Math.sin(since * 5) * S * 0.1, cy - S * (0.8 + k * 1.2), S * 0.16, S * 0.2);
        c.fill();
        c.restore();
      }
      return;
    }
    const localView = this.view.local.includes(p.id);
    const allyView = this.view.local.some((id) => g.players[id]?.team === p.team);
    let alpha = 1;
    if (p.invisT > 0) {
      if (localView || allyView) alpha = 0.4;
      else alpha = p.moving ? 0.07 + 0.05 * Math.sin(this.time * 30) : 0;
      if (p.invisT < 30) alpha = Math.max(alpha, 1 - p.invisT / 30);
    }
    if (p.invuln > 0 && p.dashT === 0 && Math.floor(this.time * 16) % 2 === 0 && g.mode !== 'classico') alpha *= 0.45;
    if (alpha <= 0.01) return;
    let jumpZ = 0;
    if (p.jumpT > 0) {
      const k = 1 - p.jumpT / p.jumpDur;
      jumpZ = Math.sin(k * Math.PI) * S * 1.1;
    }
    // escudo
    if (p.shield > 0) {
      c.save();
      c.globalAlpha = 0.35 * alpha;
      const gg = c.createRadialGradient(cx, cy - S * 0.45 - jumpZ, S * 0.2, cx, cy - S * 0.45 - jumpZ, S * 0.6);
      gg.addColorStop(0, 'rgba(110,198,255,0)');
      gg.addColorStop(0.8, 'rgba(110,198,255,0.6)');
      gg.addColorStop(1, 'rgba(200,240,255,0.9)');
      c.fillStyle = gg;
      circle(c, cx, cy - S * 0.45 - jumpZ, S * 0.6);
      c.fill();
      c.restore();
    }
    // rastro do arranque
    if (p.dashT > 0) {
      for (let k = 1; k <= 3; k++) {
        drawCharacter(c, cx - DX[p.dashDir] * S * 0.3 * k, cy - DY[p.dashDir] * S * 0.3 * k, S, { char: p.char, dir: p.dir, t, moving: true, alpha: 0.25 / k, colors: skinColors(p) });
      }
    }
    if (jumpZ > 0) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      ellipse(c, cx, cy, S * 0.25, S * 0.08);
      c.fill();
    }
    this.trail(p, px, py);
    const flash = this.hitFlash.get(p.id) ?? 0;
    const stunned = p.stunT > 0;
    drawCharacter(c, cx, cy - jumpZ, S, {
      char: p.char,
      dir: p.dir,
      t,
      moving: p.moving,
      alpha,
      flash: flash > 0 ? flash * 2 : 0,
      colors: skinColors(p),
      emote: g.phase === 'ending' && g.result?.winners.includes(p.id) ? 'win' : null,
      squash: p.jumpT > 0 ? -0.3 : 0,
    });
    if (stunned) {
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = '#bfe9ff';
      rr(c, cx - S * 0.36, cy - S * 1.05, S * 0.72, S * 1.05, S * 0.18);
      c.fill();
      c.restore();
    }
    if (p.curse || p.potatoT > 0) {
      const k = Math.sin(this.time * 12) * 0.5 + 0.5;
      c.save();
      c.globalAlpha = 0.5 + 0.3 * k;
      c.fillStyle = p.potatoT > 0 ? '#ff7a1a' : '#9b5de5';
      circle(c, cx, cy - S * 1.15 - jumpZ, S * 0.12);
      c.fill();
      c.restore();
    }
    if (p.carrying) this.drawCore(c, cx, cy - S * 1.25 - jumpZ, S * 0.7);
    void alpha;
  }

  drawOverhead(c: Ctx, g: Game, S: number, alpha: number) {
    this.drawEmotes(c, g, S, alpha);
    if (!this.settings.markers) return;
    for (const p of g.players) {
      if (!p.alive) continue;
      const localView = this.view.local.includes(p.id);
      if (p.invisT > 0 && !localView && !this.view.local.some((id) => g.players[id]?.team === p.team)) continue;
      const [px, py] = this.lerpPos('p' + p.id, p.x, p.y, alpha);
      const cx = px * S + S / 2;
      let ty = py * S + S / 2 + S * 0.28 - S * 1.22;
      if (p.jumpT > 0) ty -= Math.sin((1 - p.jumpT / p.jumpDur) * Math.PI) * S * 1.1;
      const col = g.players.length > 2 && new Set(g.players.map((q) => q.team)).size < g.players.length ? TEAM_COLORS[p.team % 4] : SLOT_COLORS[p.id % 8];
      const s = S * 0.13;
      c.save();
      c.translate(cx, ty + Math.sin(this.time * 3 + p.id) * S * 0.02);
      c.fillStyle = col;
      c.strokeStyle = 'rgba(15,6,24,0.9)';
      c.lineWidth = Math.max(1.5, S * 0.035);
      // formas distintas por jogador (acessibilidade)
      c.beginPath();
      switch (p.id % 4) {
        case 0:
          c.moveTo(-s, -s * 0.6);
          c.lineTo(s, -s * 0.6);
          c.lineTo(0, s * 0.9);
          break;
        case 1:
          c.arc(0, 0, s * 0.85, 0, Math.PI * 2);
          break;
        case 2:
          c.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
          break;
        case 3:
          c.moveTo(0, -s);
          c.lineTo(s, 0);
          c.lineTo(0, s);
          c.lineTo(-s, 0);
          break;
      }
      c.closePath();
      c.stroke();
      c.fill();
      if (localView && this.view.local.length === 1) {
        c.font = `800 ${S * 0.2}px Rubik, system-ui`;
        c.textAlign = 'center';
        c.fillStyle = '#ffffff';
        c.strokeStyle = 'rgba(15,6,24,0.8)';
        c.lineWidth = S * 0.05;
        c.strokeText('VOCÊ', 0, -s * 1.3);
        c.fillText('VOCÊ', 0, -s * 1.3);
      } else if (!p.bot || this.view.local.length > 1) {
        c.font = `700 ${S * 0.17}px Rubik, system-ui`;
        c.textAlign = 'center';
        c.fillStyle = '#ffffff';
        c.strokeStyle = 'rgba(15,6,24,0.8)';
        c.lineWidth = S * 0.045;
        const nm = p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name;
        c.strokeText(nm, 0, -s * 1.3);
        c.fillText(nm, 0, -s * 1.3);
      }
      // anel de recarga da técnica (jogador local)
      if (localView && g.rules.abilities) {
        const k = 1 - p.abilityCd / p.abilityMax;
        if (k < 1) {
          c.strokeStyle = 'rgba(255,255,255,0.25)';
          c.lineWidth = S * 0.035;
          c.beginPath();
          c.arc(0, 0, s * 1.35, 0, Math.PI * 2);
          c.stroke();
          c.strokeStyle = '#fff3c4';
          c.beginPath();
          c.arc(0, 0, s * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          c.stroke();
        }
      }
      c.restore();
    }
  }

  trail(p: Player, px: number, py: number) {
    const tr = p.cosmetics?.trail;
    if (!tr || tr === 'nenhum' || !p.moving || this.settings.quality === 0) return;
    const last = this.trailT.get(p.id) ?? 0;
    if (this.time - last < 0.06) return;
    this.trailT.set(p.id, this.time);
    const x = px + (Math.random() - 0.5) * 0.3,
      y = py + 0.25;
    switch (tr) {
      case 'brasas':
        this.parts.spawn({ t: 'ember', x, y, vx: (Math.random() - 0.5) * 0.5, vy: -0.6, max: 0.6, size: 0.04, color: '#ffb347', add: true });
        break;
      case 'confete':
        this.parts.spawn({ t: 'confetti', x, y, vz: 1.5, g: 5, vx: (Math.random() - 0.5), max: 0.8, size: 0.09, color: ['#ff5d8f', '#ffd166', '#4cc9f0', '#8ac926'][(Math.random() * 4) | 0], vr: 8 });
        break;
      case 'neve':
        this.parts.spawn({ t: 'snow', x, y: y - 0.3, vx: (Math.random() - 0.5) * 0.4, vy: 0.3, max: 0.8, size: 0.04, color: '#e8fbff', add: true });
        break;
      case 'notas':
        if (Math.random() < 0.4) this.parts.spawn({ t: 'note', x, y: y - 0.5, vy: -0.8, max: 0.8, size: 0.14, color: '#ffd23f', text: Math.random() < 0.5 ? '♪' : '♫' });
        break;
      case 'estrelas':
        this.parts.spawn({ t: 'star', x, y: y - 0.2, vx: (Math.random() - 0.5) * 0.6, vy: -0.3, max: 0.6, size: 0.07, color: '#fff3c4', add: true, rot: Math.random() * 6 });
        break;
    }
  }

  drawEmotes(c: Ctx, g: Game, S: number, alpha: number) {
    for (const [id, em] of this.emotes) {
      const age = this.time - em.t;
      if (age > 2.4) {
        this.emotes.delete(id);
        continue;
      }
      const p = g.players[id];
      if (!p || !p.alive) continue;
      const [px, py] = this.lerpPos('p' + p.id, p.x, p.y, alpha);
      const pop = Math.min(1, age * 6) * (age > 2 ? 1 - (age - 2) / 0.4 : 1);
      const cx = px * S + S / 2,
        cy = py * S + S / 2 - S * 1.55 - Math.sin(Math.min(1, age * 3) * Math.PI) * S * 0.08;
      c.save();
      c.globalAlpha = Math.max(0, pop);
      c.translate(cx, cy);
      c.scale(0.6 + 0.4 * Math.min(1, age * 5), 0.6 + 0.4 * Math.min(1, age * 5));
      c.font = `800 ${S * 0.24}px Rubik, system-ui`;
      const label = em.glyph + ' ' + em.text;
      const w = c.measureText(label).width + S * 0.3;
      c.fillStyle = 'rgba(255,248,235,0.96)';
      rr(c, -w / 2, -S * 0.22, w, S * 0.44, S * 0.2);
      c.fill();
      c.beginPath();
      c.moveTo(-S * 0.08, S * 0.2);
      c.lineTo(0, S * 0.34);
      c.lineTo(S * 0.08, S * 0.2);
      c.fill();
      c.fillStyle = '#2a1030';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, S * 0.01);
      c.restore();
    }
  }
}

function floorSig(g: Game) {
  // mudanças de piso (modos alteram) invalidam o cache
  let h = 0;
  for (let i = 0; i < g.floor.length; i++) h = (h * 31 + g.floor[i]) | 0;
  return h;
}

export function skinColors(p: Player): [string, string, string, string] | undefined {
  const s = SKINS[p.cosmetics?.skin];
  if (s && s.char === p.char && s.colors) return s.colors;
  return undefined;
}

void I;
