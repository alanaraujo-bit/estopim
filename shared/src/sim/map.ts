import type { MapDef } from '../content/maps';
import { F, I, T } from './constants';
import { Rng } from './rng';

export interface ParsedMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  floor: Uint8Array;
  fdata: Uint8Array;
  items: Uint8Array;
  spawns: { x: number; y: number }[];
  tpPair: Int32Array;
  zone: number[];
  baseA: number[];
  baseB: number[];
  plates: number[];
  exits: number[];
  doors: number[];
  targets: number[];
  marks: Record<string, number[]>; // letras livres para scripts de missão
}

export interface ItemPlan {
  [item: number]: number;
}

/** Converte ASCII em camadas. `rng` decide blocos aleatórios. */
export function parseMap(def: MapDef, rng: Rng, opts: { fill?: boolean; items?: ItemPlan | null; playerCount?: number } = {}): ParsedMap {
  const rows = def.rows;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const n = w * h;
  const tiles = new Uint8Array(n);
  const floor = new Uint8Array(n);
  const fdata = new Uint8Array(n);
  const items = new Uint8Array(n);
  const tpPair = new Int32Array(n).fill(-1);
  const spawnsById: Record<number, { x: number; y: number }> = {};
  const randomCells: number[] = [];
  const tps: number[] = [];
  const zone: number[] = [];
  const baseA: number[] = [];
  const baseB: number[] = [];
  const plates: number[] = [];
  const exits: number[] = [];
  const doors: number[] = [];
  const targets: number[] = [];
  const marks: Record<string, number[]> = {};
  const fixedItems: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? '#';
      const i = y * w + x;
      switch (c) {
        case '#':
          tiles[i] = T.Wall;
          break;
        case 'x':
          tiles[i] = T.Pillar;
          break;
        case '.':
          randomCells.push(i);
          break;
        case ',':
          break;
        case 'b':
          tiles[i] = T.Block;
          break;
        case 'h':
          tiles[i] = T.Hard;
          break;
        case 'o':
          tiles[i] = T.Barrel;
          break;
        case '/':
          tiles[i] = T.MirrorA;
          break;
        case '\\':
          tiles[i] = T.MirrorB;
          break;
        case '~':
          floor[i] = F.Ice;
          randomCells.push(i);
          break;
        case '_':
          floor[i] = F.Ice;
          break;
        case '^':
          floor[i] = F.ConvU;
          break;
        case '>':
          floor[i] = F.ConvR;
          break;
        case 'v':
          floor[i] = F.ConvD;
          break;
        case '<':
          floor[i] = F.ConvL;
          break;
        case 't':
          floor[i] = F.Teleport;
          tps.push(i);
          break;
        case 'V':
          floor[i] = F.Vent;
          break;
        case 'Z':
          floor[i] = F.Zone;
          zone.push(i);
          break;
        case 'P':
          floor[i] = F.Pit;
          break;
        case 'g':
          tiles[i] = T.Vine;
          break;
        case 'A':
          floor[i] = F.BaseA;
          baseA.push(i);
          break;
        case 'B':
          floor[i] = F.BaseB;
          baseB.push(i);
          break;
        case 'C':
          tiles[i] = T.Cracked;
          break;
        case '*':
          tiles[i] = T.Target;
          targets.push(i);
          break;
        case 'E':
          floor[i] = F.Exit;
          exits.push(i);
          break;
        case 'D':
          tiles[i] = T.Door;
          doors.push(i);
          break;
        case 'p':
          floor[i] = F.Plate;
          plates.push(i);
          break;
        case '$':
          tiles[i] = T.Block;
          fixedItems.push(i);
          break;
        default:
          if (c >= '1' && c <= '8') {
            spawnsById[+c] = { x, y };
          } else if (/[a-zA-Z]/.test(c)) {
            (marks[c] ??= []).push(i);
          }
      }
    }
  }

  // Pares de teletransporte em ordem de leitura.
  for (let k = 0; k + 1 < tps.length; k += 2) {
    tpPair[tps[k]] = tps[k + 1];
    tpPair[tps[k + 1]] = tps[k];
    fdata[tps[k]] = fdata[tps[k + 1]] = k / 2;
  }
  // Grupos dos respiradouros: quadrantes diagonais alternados.
  for (let i = 0; i < n; i++) {
    if (floor[i] === F.Vent) {
      const x = i % w,
        y = (i / w) | 0;
      fdata[i] = x < w / 2 === y < h / 2 ? 0 : 1;
    }
  }

  const spawns = Object.keys(spawnsById)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => spawnsById[k]);

  // Área segura em volta dos nascimentos.
  const safe = new Uint8Array(n);
  for (const s of spawns) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2) continue;
        const x = s.x + dx,
          y = s.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        safe[y * w + x] = 1;
      }
  }

  const blockCells: number[] = [];
  if (opts.fill !== false) {
    for (const i of randomCells) {
      if (safe[i]) continue;
      if (rng.next() < def.density) {
        const r = rng.next();
        if (def.vineRatio && r < def.vineRatio) tiles[i] = T.Vine;
        else if (def.hardRatio && r > 1 - def.hardRatio) tiles[i] = T.Hard;
        else tiles[i] = T.Block;
        blockCells.push(i);
      }
    }
  }
  for (let i = 0; i < n; i++) if ((tiles[i] === T.Block || tiles[i] === T.Vine || tiles[i] === T.Hard) && !blockCells.includes(i)) blockCells.push(i);

  // Distribui itens sob blocos.
  if (opts.items) {
    const pool: number[] = [];
    for (const [k, v] of Object.entries(opts.items)) for (let j = 0; j < v; j++) pool.push(+k);
    rng.shuffle(pool);
    const cells = rng.shuffle(blockCells.filter((i) => !fixedItems.includes(i)).slice());
    for (let k = 0; k < pool.length && k < cells.length; k++) items[cells[k]] = pool[k];
  }
  for (const i of fixedItems) if (!items[i]) items[i] = I.BombUp;

  return { w, h, tiles, floor, fdata, items, spawns, tpPair, zone, baseA, baseB, plates, exits, doors, targets, marks };
}

/** Plano padrão de itens escalado pela quantidade de jogadores. */
export function defaultItemPlan(players: number, level: 0 | 1 | 2, opts: { cartridges: boolean; curses: boolean }): ItemPlan | null {
  if (level === 0) return null;
  const m = level === 2 ? 1.6 : 1;
  const s = Math.max(2, players) / 4;
  const plan: ItemPlan = {
    [I.BombUp]: Math.round(8 * s * m + 2),
    [I.RangeUp]: Math.round(8 * s * m + 2),
    [I.SpeedUp]: Math.round(4 * s * m + 1),
    [I.Kick]: Math.round(2 * s * m + 1),
    [I.Shield]: Math.round(1.5 * s * m),
    [I.RangeMax]: level === 2 ? 2 : 1,
  };
  if (opts.cartridges) plan[I.Cartridge] = Math.round(4 * s * m + 1);
  if (opts.curses) plan[I.Curse] = Math.round(2 * s * m + 1);
  return plan;
}
