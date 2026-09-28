import { B, DX, DY, F, T, secs } from '../sim/constants';
import { ENEMY_AI, type Game } from '../sim/game';
import type { Enemy } from '../sim/types';
import { NEVER, computeDanger, type Danger } from './danger';

// Bits de flags de inimigos
export const EF = { harmless: 1, friendly: 2, flying: 4, elite: 16 };

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  flags: number;
  desc: string;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  rastejo: { name: 'Rastejo', hp: 1, speed: 1.9, flags: 0, desc: 'Besouro de sucata. Anda sem rumo e morde quem encosta.' },
  farejador: { name: 'Farejador', hp: 1, speed: 2.3, flags: 0, desc: 'Fareja sua trilha e corre atrás quando te vê.' },
  minador: { name: 'Minador', hp: 1, speed: 2.2, flags: 0, desc: 'Solta cargas perto de você e foge.' },
  bastiao: { name: 'Bastião', hp: 2, speed: 1.5, flags: 0, desc: 'Escudo frontal bloqueia explosões. Ataque pelas costas.' },
  acolito: { name: 'Acólito do Frio', hp: 1, speed: 1.8, flags: 0, desc: 'Atira estilhaços de gelo em linha reta.' },
  sentinela: { name: 'Sentinela', hp: 2, speed: 0, flags: 1, desc: 'Gira e vigia. Se te vir, dispara um feixe.' },
  esporo: { name: 'Esporo', hp: 1, speed: 1.6, flags: 0, desc: 'Divide-se em dois quando atingido.' },
  vigia: { name: 'Vigia', hp: 2, speed: 3.3, flags: 0, desc: 'Disfarça-se de bloco e ataca de surpresa.' },
  reparador: { name: 'Reparador', hp: 1, speed: 2.1, flags: 1 | 4, desc: 'Drone que reconstrói blocos e blinda aliados.' },
  piscante: { name: 'Piscante', hp: 1, speed: 1.3, flags: 0, desc: 'Teleporta para perto de você.' },
  salamandra: { name: 'Salamandra', hp: 2, speed: 2.3, flags: 0, desc: 'Imune a fogo — a menos que esteja congelada.' },
  gatuno: { name: 'Gatuno', hp: 1, speed: 3.0, flags: 1, desc: 'Ladrão veloz carregando um fragmento.' },
  coreto: { name: 'Coreto', hp: 6, speed: 0, flags: 1 | 2, desc: 'Proteja!' },
  aquecedor: { name: 'Aquecedor', hp: 5, speed: 1.25, flags: 1 | 2, desc: 'Escolte até a saída.' },
};

export const MARK_TO_ENEMY: Record<string, string> = {
  r: 'rastejo',
  f: 'farejador',
  m: 'minador',
  q: 'bastiao',
  a: 'acolito',
  s: 'sentinela',
  e: 'esporo',
  w: 'vigia',
  d: 'reparador',
  k: 'piscante',
  z: 'salamandra',
  G: 'gatuno',
};

export function spawnTyped(g: Game, type: string, x: number, y: number, extra: Partial<Enemy> = {}): Enemy {
  const d = ENEMY_DEFS[type] ?? ENEMY_DEFS.rastejo;
  return g.spawnEnemy(type, x, y, { hp: d.hp, maxHp: d.hp, speed: d.speed, flags: d.flags, dir: 2, ...extra });
}

// ───────────────────────── utilidades ─────────────────────────
export function enemyDanger(g: Game): Danger {
  const cache = g.mstate.__danger as { tick: number; d: Danger } | undefined;
  if (cache && cache.tick === g.tick) return cache.d;
  const d = computeDanger(g, -99);
  g.mstate.__danger = { tick: g.tick, d };
  return d;
}

const atCenter = (e: Enemy) => Math.abs(e.x - Math.round(e.x)) < 0.04 && Math.abs(e.y - Math.round(e.y)) < 0.04;

function solidFor(g: Game, e: Enemy, tx: number, ty: number): boolean {
  if (!g.inb(tx, ty)) return true;
  const t = g.tiles[g.idx(tx, ty)];
  if (e.flags & EF.flying) return t === T.Wall || t === T.Pillar || t === T.Door;
  return g.solidForActor(e.x, e.y, tx, ty);
}

function walkable(g: Game, e: Enemy, i: number): boolean {
  const x = i % g.w,
    y = (i / g.w) | 0;
  return !solidFor(g, e, x, y);
}

function step(g: Game, e: Enemy, dir: number, speed: number): number {
  if (dir < 0) return 0;
  e.dir = dir;
  return g.moveActor(e, dir, speed / 60, (tx, ty) => solidFor(g, e, tx, ty));
}

/** Alvos hostis para inimigos: jogadores visíveis + estruturas aliadas. */
export function targetsFor(g: Game): { x: number; y: number; w: number; npc: boolean }[] {
  const out: { x: number; y: number; w: number; npc: boolean }[] = [];
  for (const p of g.players) if (p.alive && p.invisT === 0) out.push({ x: Math.round(p.x), y: Math.round(p.y), w: 1, npc: false });
  for (const e of g.enemies) if (e.alive && e.flags & EF.friendly) out.push({ x: Math.round(e.x), y: Math.round(e.y), w: 1.2, npc: true });
  return out;
}

/** BFS a partir do inimigo; retorna distâncias e predecessores. */
function bfs(g: Game, e: Enemy, danger: Danger | null, maxD = 40) {
  const n = g.w * g.h;
  const dist = new Int16Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const start = g.idx(Math.round(e.x), Math.round(e.y));
  const q = new Int32Array(n);
  let h = 0,
    t = 0;
  q[t++] = start;
  dist[start] = 0;
  while (h < t) {
    const c = q[h++];
    if (dist[c] >= maxD) continue;
    const cx = c % g.w,
      cy = (c / g.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d],
        ny = cy + DY[d];
      if (!g.inb(nx, ny)) continue;
      const ni = g.idx(nx, ny);
      if (dist[ni] >= 0) continue;
      if (solidFor(g, e, nx, ny)) continue;
      if (danger && danger.t[ni] !== NEVER && danger.t[ni] < 50 + dist[c] * 12 && danger.end[ni] > dist[c] * 12) continue;
      dist[ni] = dist[c] + 1;
      prev[ni] = c;
      q[t++] = ni;
    }
  }
  return { dist, prev, start };
}

function firstDir(g: Game, prev: Int32Array, start: number, target: number): number {
  let cur = target,
    guard = 0;
  while (prev[cur] !== start && prev[cur] >= 0 && guard++ < 500) cur = prev[cur];
  if (prev[cur] !== start) return -1;
  const sx = start % g.w,
    sy = (start / g.w) | 0;
  const tx = cur % g.w,
    ty = (cur / g.w) | 0;
  return tx > sx ? 1 : tx < sx ? 3 : ty > sy ? 2 : 0;
}

function inDanger(g: Game, e: Enemy, danger: Danger): boolean {
  const i = g.idx(Math.round(e.x), Math.round(e.y));
  return danger.t[i] !== NEVER && danger.t[i] < 70;
}

/** Foge para o tile seguro mais próximo. */
function flee(g: Game, e: Enemy, danger: Danger, speed: number): boolean {
  if (!inDanger(g, e, danger)) return false;
  const r = bfs(g, e, null, 8);
  let best = -1,
    bd = 1e9;
  for (let i = 0; i < r.dist.length; i++) {
    if (r.dist[i] < 0) continue;
    if (danger.t[i] !== NEVER) continue;
    if (r.dist[i] < bd) {
      bd = r.dist[i];
      best = i;
    }
  }
  if (best < 0) return false;
  const d = firstDir(g, r.prev, r.start, best);
  if (d >= 0) step(g, e, d, speed * 1.3);
  return true;
}

function wander(g: Game, e: Enemy, speed: number, danger: Danger) {
  if (atCenter(e) || e.timer2 <= 0) {
    e.x = Math.round(e.x);
    e.y = Math.round(e.y);
    const cx = e.x,
      cy = e.y;
    const opts: number[] = [];
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d],
        ny = cy + DY[d];
      if (solidFor(g, e, nx, ny)) continue;
      const ni = g.idx(nx, ny);
      if (danger.t[ni] !== NEVER && danger.t[ni] < 60) continue;
      opts.push(d);
    }
    if (!opts.length) {
      e.timer2 = 20;
      return;
    }
    const straight = opts.includes(e.dir) && g.rng.next() < 0.75;
    const noBack = opts.filter((d) => d !== ((e.dir + 2) & 3));
    e.dir = straight ? e.dir : (noBack.length ? g.rng.pick(noBack) : g.rng.pick(opts));
    e.timer2 = 40;
  }
  e.timer2--;
  const moved = step(g, e, e.dir, speed);
  if (moved < 0.001) e.timer2 = 0;
}

function chaseTo(g: Game, e: Enemy, tx: number, ty: number, speed: number, danger: Danger, maxD = 30): boolean {
  const r = bfs(g, e, danger, maxD);
  const ti = g.idx(tx, ty);
  if (r.dist[ti] < 0) return false;
  if (ti === r.start) return true;
  const d = firstDir(g, r.prev, r.start, ti);
  if (d < 0) return false;
  step(g, e, d, speed);
  return true;
}

function nearestTarget(g: Game, e: Enemy) {
  let best: { x: number; y: number; w: number; npc: boolean } | null = null,
    bd = 1e9;
  for (const t of targetsFor(g)) {
    const d = Math.abs(t.x - e.x) + Math.abs(t.y - e.y) - (t.npc && g.mstate.preferNpc ? 6 : 0);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

function clearLine(g: Game, x0: number, y0: number, dir: number, max: number, stopAtBombs = false): number[] {
  const out: number[] = [];
  let x = x0,
    y = y0;
  for (let k = 0; k < max; k++) {
    x += DX[dir];
    y += DY[dir];
    if (!g.inb(x, y)) break;
    const t = g.tiles[g.idx(x, y)];
    if (t !== T.Empty && t !== T.MirrorA && t !== T.MirrorB) break;
    if (stopAtBombs && g.bombAt(x, y)) break;
    out.push(g.idx(x, y));
  }
  return out;
}

// ───────────────────────── comportamentos ─────────────────────────
ENEMY_AI.rastejo = {
  update(g, e) {
    const danger = enemyDanger(g);
    if (flee(g, e, danger, e.speed)) return;
    wander(g, e, e.speed, danger);
  },
};

ENEMY_AI.farejador = {
  update(g, e) {
    const danger = enemyDanger(g);
    if (flee(g, e, danger, 3.4)) return;
    const t = nearestTarget(g, e);
    if (t) {
      const md = Math.abs(t.x - e.x) + Math.abs(t.y - e.y);
      if (md <= 7 || (e.state === 2 && md <= 11)) {
        if (e.state !== 2) g.emit({ e: 'enemyAct', id: e.id, a: 'alert', x: e.x, y: e.y });
        e.state = 2;
        if (chaseTo(g, e, t.x, t.y, 3.35, danger)) return;
      } else e.state = 0;
    }
    wander(g, e, e.speed, danger);
  },
};

ENEMY_AI.minador = {
  update(g, e) {
    const danger = enemyDanger(g);
    if (e.timer > 0) e.timer--;
    if (flee(g, e, danger, 3)) {
      e.state = 1;
      return;
    }
    const t = nearestTarget(g, e);
    if (!t) return wander(g, e, e.speed, danger);
    const ex = Math.round(e.x),
      ey = Math.round(e.y);
    const md = Math.abs(t.x - ex) + Math.abs(t.y - ey);
    if (e.timer === 0 && atCenter(e) && md <= 4 && (t.x === ex || t.y === ey) && g.canPlaceAt(ex, ey)) {
      const b = g.addBomb(ex, ey, B.Enemy, -2, secs(2.3), 2);
      b.hidden = false;
      g.emit({ e: 'enemyAct', id: e.id, a: 'bomb', x: ex, y: ey });
      e.timer = secs(4.5);
      e.state = 1;
      return;
    }
    if (md > 3) chaseTo(g, e, t.x, t.y, e.speed, danger) || wander(g, e, e.speed, danger);
    else wander(g, e, e.speed, danger);
  },
};

ENEMY_AI.bastiao = {
  update(g, e) {
    const danger = enemyDanger(g);
    const elite = !!(e.flags & EF.elite);
    const sp = elite ? 1.8 : e.speed;
    if (flee(g, e, danger, sp)) return;
    const t = nearestTarget(g, e);
    if (t && Math.abs(t.x - e.x) + Math.abs(t.y - e.y) <= 9) {
      if (atCenter(e)) {
        // encara o alvo quando parado
        const dx = t.x - e.x,
          dy = t.y - e.y;
        if (Math.abs(dx) + Math.abs(dy) <= 1.2) {
          e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
          return;
        }
      }
      if (chaseTo(g, e, t.x, t.y, sp, danger)) return;
    }
    wander(g, e, sp, danger);
  },
  onHit(g, e, _by, tile) {
    const src = g.flameSrc[tile];
    if (src < 0) return true;
    const sx = src % g.w,
      sy = (src / g.w) | 0;
    const vx = sx - e.x,
      vy = sy - e.y;
    // chama vinda da frente é bloqueada pelo escudo
    if (vx * DX[e.dir] + vy * DY[e.dir] > 0.2) {
      if (e.invuln === 0) g.emit({ e: 'enemyAct', id: e.id, a: 'shield', x: e.x, y: e.y });
      e.invuln = 20;
      return false;
    }
    return true;
  },
};

ENEMY_AI.acolito = {
  update(g, e) {
    const danger = enemyDanger(g);
    if (e.timer > 0) e.timer--;
    if (e.state === 1) {
      // carregando o disparo
      e.tele = Math.min(1, e.tele + 1 / 45);
      if (--e.timer2 <= 0) {
        const sp = 7;
        g.projectiles.push({ id: g.nextId++, kind: 'shard', x: e.x + DX[e.dir] * 0.4, y: e.y + DY[e.dir] * 0.4, vx: DX[e.dir] * sp, vy: DY[e.dir] * sp, life: secs(2), owner: -2 });
        g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y, d: e.dir });
        e.state = 0;
        e.tele = 0;
        e.timer = secs(1.8);
      }
      return;
    }
    if (flee(g, e, danger, 2.6)) return;
    const ex = Math.round(e.x),
      ey = Math.round(e.y);
    if (e.timer === 0 && atCenter(e)) {
      for (const t of targetsFor(g)) {
        for (let d = 0; d < 4; d++) {
          const line = clearLine(g, ex, ey, d, 7);
          if (line.includes(g.idx(t.x, t.y))) {
            e.dir = d;
            e.state = 1;
            e.timer2 = 45;
            g.emit({ e: 'enemyAct', id: e.id, a: 'charge', x: e.x, y: e.y, d });
            return;
          }
        }
      }
    }
    const t = nearestTarget(g, e);
    if (t) {
      const md = Math.abs(t.x - ex) + Math.abs(t.y - ey);
      if (md <= 2) {
        // mantém distância
        const away = Math.abs(t.x - ex) > Math.abs(t.y - ey) ? (t.x > ex ? 3 : 1) : t.y > ey ? 0 : 2;
        if (step(g, e, away, e.speed) > 0) return;
      } else if (md > 6 && chaseTo(g, e, t.x, t.y, e.speed, danger)) return;
    }
    wander(g, e, e.speed, danger);
  },
};

ENEMY_AI.sentinela = {
  update(g, e) {
    const ex = Math.round(e.x),
      ey = Math.round(e.y);
    if (e.state === 0) {
      e.timer++;
      if (e.timer >= 150) {
        e.timer = 0;
        e.dir = (e.dir + 1) & 3;
      }
      const line = clearLine(g, ex, ey, e.dir, 7);
      for (const p of g.players) {
        if (!p.alive || p.invisT > 0) continue;
        if (line.includes(g.idx(Math.round(p.x), Math.round(p.y)))) {
          e.state = 1;
          e.timer2 = 36;
          g.mstate.spotted = true;
          g.emit({ e: 'enemyAct', id: e.id, a: 'alert', x: e.x, y: e.y });
          if (g.mstate.stealth && (g.mstate.alarmCd ?? 0) <= g.tick) {
            g.mstate.alarmCd = g.tick + secs(10);
            g.message('Alarme! Reforços a caminho!', 'fail');
            const spots = g.marks['n'] ?? [];
            for (let k = 0; k < 2; k++) {
              const i = spots.length ? spots[k % spots.length] : g.idx(g.w - 2, g.h - 2);
              spawnTyped(g, 'farejador', i % g.w, (i / g.w) | 0, { spawnT: 40 });
            }
          }
          break;
        }
      }
    } else {
      e.tele = Math.min(1, e.tele + 1 / 30);
      if (--e.timer2 <= 0) {
        const line = clearLine(g, ex, ey, e.dir, 7);
        line.forEach((i, k) => g.hazards.push({ x: i % g.w, y: (i / g.w) | 0, t: 12 + k * 2, total: 12 + k * 2, kind: 'strike' }));
        g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y, d: e.dir });
        e.state = 0;
        e.tele = 0;
        e.timer = 60;
      }
    }
  },
};

ENEMY_AI.esporo = {
  update(g, e) {
    const danger = enemyDanger(g);
    if (flee(g, e, danger, e.speed)) return;
    const t = nearestTarget(g, e);
    if (t && e.data[0] && Math.abs(t.x - e.x) + Math.abs(t.y - e.y) < 6 && chaseTo(g, e, t.x, t.y, e.speed, danger)) return;
    wander(g, e, e.speed, danger);
  },
  onDeath(g, e) {
    if (e.data[0]) return;
    const cx = Math.round(e.x),
      cy = Math.round(e.y);
    let n = 0;
    for (let d = 0; d < 4 && n < 2; d++) {
      const nx = cx + DX[d],
        ny = cy + DY[d];
      if (!g.walkableStatic(nx, ny)) continue;
      spawnTyped(g, 'esporo', nx, ny, { speed: 2.9, data: [1, 0, 0, 0], spawnT: 10, dir: d });
      n++;
    }
    if (n === 0) spawnTyped(g, 'esporo', cx, cy, { speed: 2.9, data: [1, 0, 0, 0], spawnT: 10 });
  },
};

ENEMY_AI.vigia = {
  update(g, e) {
    const ex = Math.round(e.x),
      ey = Math.round(e.y);
    const i = g.idx(ex, ey);
    if (e.state === 0) {
      // escondido como bloco
      if (g.tiles[i] === T.Empty && !g.bombAt(ex, ey) && !g.playerAtTile(ex, ey)) g.setTile(i, T.Block);
      if (g.tiles[i] !== T.Block) {
        e.state = 1;
        e.timer = secs(4);
        return;
      }
      for (const p of g.players) {
        if (!p.alive) continue;
        if (Math.abs(Math.round(p.x) - ex) + Math.abs(Math.round(p.y) - ey) === 1) {
          g.setTile(i, T.Empty);
          e.state = 1;
          e.timer = secs(4);
          g.emit({ e: 'enemyAct', id: e.id, a: 'ambush', x: e.x, y: e.y });
          break;
        }
      }
      return;
    }
    const danger = enemyDanger(g);
    if (flee(g, e, danger, e.speed)) return;
    if (--e.timer <= 0 && atCenter(e) && !g.bombAt(ex, ey) && !g.playerAtTile(ex, ey) && g.items[i] === 0) {
      e.state = 0;
      g.setTile(i, T.Block);
      return;
    }
    const t = nearestTarget(g, e);
    if (t && chaseTo(g, e, t.x, t.y, e.speed, danger, 14)) return;
    wander(g, e, e.speed * 0.7, danger);
  },
  onHit(g, e) {
    if (e.state === 0) {
      e.state = 1;
      e.timer = secs(4);
    }
    return true;
  },
};

ENEMY_AI.reparador = {
  update(g, e) {
    e.timer++;
    e.tele = Math.max(0, e.tele - 1 / 40);
    const t = nearestTarget(g, e);
    // mantém distância média
    if (t) {
      const dx = t.x - e.x,
        dy = t.y - e.y;
      const md = Math.abs(dx) + Math.abs(dy);
      let dir = -1;
      if (md < 3) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : dy > 0 ? 0 : 2;
      else if (md > 6) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      if (dir >= 0) {
        if (step(g, e, dir, e.speed) < 0.001) step(g, e, (dir + 1) & 3, e.speed);
      }
    }
    // blindagem de aliados
    if (e.timer % secs(3) === 0) {
      let any = false;
      for (const o of g.enemies) {
        if (o === e || !o.alive || o.flags & EF.friendly) continue;
        if (Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= 3.5) {
          o.invuln = Math.max(o.invuln, secs(1.6));
          any = true;
        }
      }
      if (any) {
        e.tele = 1;
        g.emit({ e: 'enemyAct', id: e.id, a: 'repair', x: e.x, y: e.y });
      }
    }
    // reconstrói blocos perto do jogador
    if (e.timer % secs(5) === 0 && t) {
      for (let tries = 0; tries < 12; tries++) {
        const x = t.x + g.rng.int(7) - 3,
          y = t.y + g.rng.int(7) - 3;
        if (!g.inb(x, y)) continue;
        const i = g.idx(x, y);
        if (g.tiles[i] !== T.Empty || g.floor[i] !== F.Normal || g.items[i] || g.bombAt(x, y) || g.flame[i]) continue;
        if (Math.abs(x - t.x) + Math.abs(y - t.y) < 2) continue;
        if (g.playerAtTile(x, y) || g.enemyAtTile(x, y)) continue;
        g.setTile(i, T.Block);
        g.emit({ e: 'regrow', x, y });
        break;
      }
    }
  },
};

ENEMY_AI.piscante = {
  update(g, e) {
    const danger = enemyDanger(g);
    e.timer++;
    if (e.state === 1) {
      e.tele = Math.min(1, e.tele + 1 / 40);
      if (--e.timer2 <= 0) {
        e.x = e.tx;
        e.y = e.ty;
        e.state = 0;
        e.tele = 0;
        e.timer = 0;
        g.emit({ e: 'teleport', x: e.x, y: e.y, x2: e.x, y2: e.y });
      }
      return;
    }
    if (e.timer > secs(3.5)) {
      const t = nearestTarget(g, e);
      if (t) {
        for (let tries = 0; tries < 20; tries++) {
          const x = t.x + g.rng.int(7) - 3,
            y = t.y + g.rng.int(7) - 3;
          const md = Math.abs(x - t.x) + Math.abs(y - t.y);
          if (md < 2 || md > 3 || !g.canPlaceAt(x, y)) continue;
          const i = g.idx(x, y);
          if (danger.t[i] !== NEVER || g.enemyAtTile(x, y)) continue;
          e.tx = x;
          e.ty = y;
          e.state = 1;
          e.timer2 = 40;
          g.emit({ e: 'enemyAct', id: e.id, a: 'charge', x, y });
          return;
        }
      }
      e.timer = secs(2);
    }
    if (flee(g, e, danger, e.speed * 1.5)) return;
    wander(g, e, e.speed, danger);
  },
};

ENEMY_AI.salamandra = {
  update(g, e) {
    const danger = enemyDanger(g);
    e.timer++;
    if (e.timer % 45 === 0) {
      const tx = Math.round(e.x - DX[e.dir]),
        ty = Math.round(e.y - DY[e.dir]);
      if (g.walkableStatic(tx, ty)) g.hazards.push({ x: tx, y: ty, t: 50, total: 50, kind: 'strike' });
    }
    const t = nearestTarget(g, e);
    if (t && Math.abs(t.x - e.x) + Math.abs(t.y - e.y) <= 8 && chaseTo(g, e, t.x, t.y, e.speed, danger)) return;
    wander(g, e, e.speed, danger);
  },
  onHit(g, e) {
    if (e.stunT > 0) return true;
    if (e.invuln === 0) g.emit({ e: 'enemyAct', id: e.id, a: 'shield', x: e.x, y: e.y });
    e.invuln = 15;
    return false;
  },
};

ENEMY_AI.gatuno = {
  update(g, e) {
    const danger = enemyDanger(g);
    const players = g.players.filter((p) => p.alive);
    // pego ao ser tocado
    for (const p of players) {
      if (Math.abs(p.x - e.x) < 0.7 && Math.abs(p.y - e.y) < 0.7) {
        g.damageEnemy(e, 99, p.id);
        return;
      }
    }
    const escaping = (g.mstate.escapeAt ?? Infinity) <= g.tick;
    if (escaping && g.exits.length) {
      const ex = g.exits[0];
      e.speed = 3.2;
      if (chaseTo(g, e, ex % g.w, (ex / g.w) | 0, e.speed, danger, 60)) return;
    }
    if (flee(g, e, danger, 3.6)) return;
    if (!atCenter(e) && e.timer2 > 0) {
      e.timer2--;
      step(g, e, e.dir, e.speed);
      return;
    }
    e.x = Math.round(e.x);
    e.y = Math.round(e.y);
    // escolhe o vizinho que maximiza a distância aos jogadores
    let best = -1,
      bestSc = -1e9;
    for (let d = 0; d < 4; d++) {
      const nx = e.x + DX[d],
        ny = e.y + DY[d];
      if (solidFor(g, e, nx, ny)) continue;
      const ni = g.idx(nx, ny);
      if (danger.t[ni] !== NEVER && danger.t[ni] < 80) continue;
      let sc = 0;
      for (const p of players) sc += Math.min(10, Math.abs(p.x - nx) + Math.abs(p.y - ny));
      // evita becos sem saída
      let exits = 0;
      for (let d2 = 0; d2 < 4; d2++) if (!solidFor(g, e, nx + DX[d2], ny + DY[d2])) exits++;
      sc += exits * 1.5 + g.rng.next() * 0.5;
      if (d === ((e.dir + 2) & 3)) sc -= 1;
      if (sc > bestSc) {
        bestSc = sc;
        best = d;
      }
    }
    if (best >= 0) {
      e.dir = best;
      e.timer2 = 20;
      step(g, e, best, e.speed);
    }
  },
};

ENEMY_AI.coreto = { update() {} };

ENEMY_AI.aquecedor = {
  update(g, e) {
    if (!g.exits.length) return;
    const ex = g.exits[0];
    const tx = ex % g.w,
      ty = (ex / g.w) | 0;
    if (Math.round(e.x) === tx && Math.round(e.y) === ty) {
      g.mstate.escortDone = true;
      return;
    }
    // derrete chamas? não — espera o caminho estar seguro
    const danger = enemyDanger(g);
    const r = bfs(g, e, null, 80);
    const ti = g.idx(tx, ty);
    if (r.dist[ti] < 0) {
      e.state = 1; // bloqueado
      if ((g.mstate.blockMsg ?? 0) <= g.tick) {
        g.mstate.blockMsg = g.tick + secs(8);
        g.message('Abra caminho para o Aquecedor!', 'info');
      }
      return;
    }
    e.state = 0;
    const d = firstDir(g, r.prev, r.start, ti);
    if (d < 0) return;
    const nx = Math.round(e.x) + DX[d],
      ny = Math.round(e.y) + DY[d];
    const ni = g.idx(nx, ny);
    if (atCenter(e) && danger.t[ni] !== NEVER && danger.t[ni] < 150) return; // espera o fogo passar
    step(g, e, d, e.speed);
  },
};
