import { B, CHAIN_DELAY, DX, DY, F, FLAME_TIME, T } from '../sim/constants';
import type { Game } from '../sim/game';
import type { Bomb } from '../sim/types';

export const NEVER = 1 << 28;

export interface Danger {
  /** ticks até a primeira chama no tile (0 = em chamas agora) */
  t: Int32Array;
  /** tick (relativo) em que o perigo termina */
  end: Int32Array;
}

interface VBomb {
  x: number;
  y: number;
  range: number;
  pierce: number;
  kind: number;
  time: number;
  frag: boolean;
}

/** Tiles atingidos por uma explosão (ignorando cargas encadeadas, que são tratadas à parte). */
export function blastTiles(g: Game, x: number, y: number, range: number, pierce: number, frag = false, out: number[] = []): number[] {
  out.push(g.idx(x, y));
  for (let d = 0; d < 4; d++) {
    let px = x,
      py = y,
      dd = d,
      left = range,
      pl = pierce;
    while (left > 0) {
      px += DX[dd];
      py += DY[dd];
      left--;
      if (!g.inb(px, py)) break;
      const i = g.idx(px, py);
      const t = g.tiles[i];
      if (t === T.Wall || t === T.Pillar || t === T.Door || t === T.Crystal) break;
      out.push(i);
      if (t === T.MirrorA || t === T.MirrorB) {
        dd = t === T.MirrorA ? dd ^ 1 : 3 - dd;
        left = Math.max(left, 1);
        continue;
      }
      if (t !== T.Empty) {
        if (pl > 0) {
          pl--;
          continue;
        }
        break;
      }
      if (g.bombAt(px, py)) break;
    }
  }
  if (frag) {
    for (const [ddx, ddy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      for (let k = 1; k <= range - 1; k++) {
        const px = x + ddx * k,
          py = y + ddy * k;
        if (!g.inb(px, py)) break;
        const t = g.tiles[g.idx(px, py)];
        if (t !== T.Empty) {
          if (t === T.Block || t === T.Vine || t === T.Hard) out.push(g.idx(px, py));
          break;
        }
        out.push(g.idx(px, py));
      }
    }
  }
  return out;
}

/**
 * Calcula o mapa de perigo. `viewerTeam` define o que o observador pode ver
 * (minas inimigas armadas são invisíveis). `extra` permite simular uma carga hipotética.
 */
export function computeDanger(g: Game, viewerTeam: number, extra?: { x: number; y: number; range: number; pierce: number; fuse: number }): Danger {
  const n = g.w * g.h;
  const t = new Int32Array(n).fill(NEVER);
  const end = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (g.flame[i] && g.flameKind[i] !== B.Frost) {
      t[i] = 0;
      end[i] = g.flame[i];
    }
  }
  for (const hz of g.hazards) {
    const i = g.idx(hz.x, hz.y);
    if (hz.kind === 'fall') {
      t[i] = Math.min(t[i], hz.t);
      end[i] = NEVER;
    } else if (hz.kind === 'vent' || hz.kind === 'strike' || hz.kind === 'crush') {
      const tiles = hz.kind === 'vent' ? [i, ...[0, 1, 2, 3].map((d) => g.idx(hz.x + DX[d], hz.y + DY[d]))] : [i];
      for (const j of tiles) {
        if (j < 0 || j >= n) continue;
        t[j] = Math.min(t[j], hz.t);
        end[j] = Math.max(end[j], hz.t + FLAME_TIME);
      }
    }
  }
  // Bombas virtuais
  const vb: VBomb[] = [];
  const addV = (b: Bomb) => {
    const [x, y] = g.bombTile(b);
    let time = b.fuse + b.frozen;
    if (b.kind === B.Pulse || b.kind === B.Frost) return;
    if (b.kind === B.Mine) {
      const owner = g.players[b.owner];
      if (b.armed > 50 && owner && owner.team !== viewerTeam) return; // invisível
      time = b.fuse > 60 ? 600 : b.fuse; // assume que pode disparar
    }
    if (b.kind === B.Remote) {
      const owner = g.players[b.owner];
      time = owner && owner.team === viewerTeam ? 900 : Math.min(b.fuse, 20);
    }
    vb.push({ x, y, range: b.range, pierce: b.pierce, kind: b.kind, time, frag: b.kind === B.Frag });
  };
  for (const b of g.bombs) addV(b);
  for (const hz of g.hazards) if (hz.kind === 'rain') vb.push({ x: hz.x, y: hz.y, range: hz.data ?? 2, pierce: 0, kind: B.Rain, time: hz.t + 66, frag: false });
  if (extra) vb.push({ x: extra.x, y: extra.y, range: extra.range, pierce: extra.pierce, kind: B.Normal, time: extra.fuse, frag: false });

  // Propaga cadeias: relaxa tempos
  const tilesOf = vb.map((b) => blastTiles(g, b.x, b.y, b.range, b.pierce, b.frag));
  const at = new Map<number, number[]>();
  vb.forEach((b, k) => {
    const i = g.idx(b.x, b.y);
    (at.get(i) ?? at.set(i, []).get(i)!).push(k);
  });
  for (let iter = 0; iter < 6; iter++) {
    let changed = false;
    vb.forEach((b, k) => {
      for (const i of tilesOf[k]) {
        const others = at.get(i);
        if (!others) continue;
        for (const o of others) {
          if (o === k) continue;
          if (vb[o].time > b.time + CHAIN_DELAY) {
            vb[o].time = b.time + CHAIN_DELAY;
            changed = true;
          }
        }
      }
    });
    if (!changed) break;
  }
  vb.forEach((b, k) => {
    // Barris atingidos também explodem
    for (const i of tilesOf[k]) {
      if (b.time < t[i]) t[i] = b.time;
      end[i] = Math.max(end[i], b.time + FLAME_TIME);
      if (g.tiles[i] === T.Barrel) {
        const bx = i % g.w,
          by = (i / g.w) | 0;
        for (const j of blastTiles(g, bx, by, 2, 0)) {
          const tt = b.time + CHAIN_DELAY + 3;
          if (tt < t[j]) t[j] = tt;
          end[j] = Math.max(end[j], tt + FLAME_TIME);
        }
      }
    }
  });
  return { t, end };
}

export function walkableForBot(g: Game, i: number, allowBombAt = -1): boolean {
  if (g.tiles[i] !== T.Empty) return false;
  if (g.floor[i] === F.Pit) return false;
  if (i !== allowBombAt) {
    const x = i % g.w,
      y = (i / g.w) | 0;
    if (g.bombAt(x, y)) return false;
  }
  return true;
}

export interface PathResult {
  dist: Int32Array; // passos (−1 inalcançável)
  prev: Int32Array;
}

/**
 * BFS com checagem temporal: só passa por tiles que não estarão em chamas no momento em que chegarmos.
 * ticksPerTile = quantos ticks leva para atravessar um tile.
 */
export function safeBfs(g: Game, start: number, danger: Danger, ticksPerTile: number, margin = 6, bombBlocks?: Uint8Array): PathResult {
  const n = g.w * g.h;
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const q = new Int32Array(n);
  let qh = 0,
    qt = 0;
  dist[start] = 0;
  q[qt++] = start;
  while (qh < qt) {
    const cur = q[qh++];
    const cx = cur % g.w,
      cy = (cur / g.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d],
        ny = cy + DY[d];
      if (!g.inb(nx, ny)) continue;
      const ni = g.idx(nx, ny);
      if (dist[ni] >= 0) continue;
      if (g.tiles[ni] !== T.Empty || g.floor[ni] === F.Pit) continue;
      if (bombBlocks ? bombBlocks[ni] : g.bombAt(nx, ny)) continue;
      const arrive = (dist[cur] + 1) * ticksPerTile;
      const enter = arrive - ticksPerTile * 0.6;
      const leave = arrive + ticksPerTile * 0.6;
      // Perigo neste tile durante a passagem?
      const dt = danger.t[ni],
        de = danger.end[ni];
      if (dt !== NEVER && leave + margin > dt && enter - margin < de) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      q[qt++] = ni;
    }
  }
  return { dist, prev };
}

export function firstStep(prev: Int32Array, start: number, target: number): number {
  let cur = target;
  let guard = 0;
  while (prev[cur] !== start && prev[cur] !== -1 && guard++ < 999) cur = prev[cur];
  return prev[cur] === start ? cur : -1;
}
