import { DX, DY, T, secs } from '../sim/constants';
import { ENEMY_AI, type Game } from '../sim/game';
import type { Enemy } from '../sim/types';
import { spawnTyped } from './enemies';

export const BOSS_INFO: Record<string, { name: string; title: string; hp: number; size: number }> = {
  rojao: { name: 'Rojão-Mor', title: 'O Foguete da Abertura', hp: 6, size: 3 },
  caldeirao: { name: 'Caldeirão', title: 'Fornalha-Mãe da Fundição', hp: 6, size: 3 },
  criostase: { name: 'Criostase', title: 'IA do Laboratório Boreal', hp: 6, size: 3 },
  oraculo: { name: 'Oráculo Partido', title: 'Guardião das Ruínas', hp: 6, size: 1 },
  maeraiz: { name: 'Mãe-Raiz', title: 'Flor Faminta do Templo', hp: 3, size: 3 },
  arconte: { name: 'O Arconte', title: 'Senhor do Apagão', hp: 9, size: 3 },
};

export function spawnBoss(g: Game, type: string, x: number, y: number): Enemy {
  const info = BOSS_INFO[type];
  const e = g.spawnEnemy(type, x, y, { hp: info.hp, maxHp: info.hp, boss: true, size: info.size, speed: 0, flags: 1, spawnT: 60 });
  e.data = [0, 0, 0, 0];
  g.mstate.boss = { id: e.id, type };
  return e;
}

const strike = (g: Game, x: number, y: number, t: number) => {
  if (g.inb(x, y) && g.tiles[g.idx(x, y)] !== T.Wall && g.tiles[g.idx(x, y)] !== T.Pillar) g.hazards.push({ x, y, t, total: t, kind: 'strike' });
};

function freeTilesNear(g: Game, cx: number, cy: number, r: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let tries = 0; tries < 60 && out.length < n; tries++) {
    const x = cx + g.rng.int(2 * r + 1) - r,
      y = cy + g.rng.int(2 * r + 1) - r;
    if (!g.walkableStatic(x, y)) continue;
    if (out.some(([a, b]) => a === x && b === y)) continue;
    out.push([x, y]);
  }
  return out;
}

function nearestPlayer(g: Game, e: Enemy) {
  let best = null as null | { x: number; y: number },
    bd = 1e9;
  for (const p of g.players) {
    if (!p.alive) continue;
    const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    if (d < bd) {
      bd = d;
      best = { x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  return best;
}

const phase = (e: Enemy) => (e.hp > (e.maxHp * 2) / 3 ? 1 : e.hp > e.maxHp / 3 ? 2 : 3);

function spawnAdds(g: Game, type: string, n: number) {
  const spots = freeTilesNear(g, (g.w / 2) | 0, (g.h / 2) | 0, 6, n);
  for (const [x, y] of spots) spawnTyped(g, type, x, y, { spawnT: 50 });
}

// ───────────── Rojão-Mor ─────────────
function rojaoUpdate(g: Game, e: Enemy) {
  const ph = phase(e);
  e.timer++;
  if (e.state === 0) {
    // no ar: rajadas de rojões
    const every = ph === 3 ? 48 : ph === 2 ? 60 : 72;
    if (e.timer % every === 0) {
      const p = nearestPlayer(g, e);
      const n = 4 + ph * 2;
      const tiles = [...(p ? freeTilesNear(g, p.x, p.y, 2, Math.ceil(n / 2)) : []), ...freeTilesNear(g, (g.w / 2) | 0, (g.h / 2) | 0, 7, Math.floor(n / 2))];
      for (const [x, y] of tiles) strike(g, x, y, 70);
      g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y });
      e.timer2++;
    }
    if (e.timer2 >= (ph === 3 ? 2 : 3)) {
      const p = nearestPlayer(g, e) ?? { x: (g.w / 2) | 0, y: (g.h / 2) | 0 };
      e.tx = Math.max(2, Math.min(g.w - 3, p.x + g.rng.int(3) - 1));
      e.ty = Math.max(2, Math.min(g.h - 3, p.y + g.rng.int(3) - 1));
      for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) g.hazards.push({ x: e.tx + xx, y: e.ty + yy, t: 85, total: 85, kind: 'crush' });
      e.state = 1;
      e.timer = 0;
      e.timer2 = 0;
      g.emit({ e: 'enemyAct', id: e.id, a: 'charge', x: e.tx, y: e.ty });
    }
  } else if (e.state === 1) {
    if (e.timer >= 85) {
      e.x = e.tx;
      e.y = e.ty;
      e.state = 2;
      e.timer = 0;
      // destrói blocos sob o pouso
      for (let yy = -1; yy <= 1; yy++)
        for (let xx = -1; xx <= 1; xx++) {
          const i = g.idx(e.x + xx, e.y + yy);
          if (g.tiles[i] === T.Block || g.tiles[i] === T.Vine) g.setTile(i, T.Empty);
        }
      g.emit({ e: 'fall', x: e.x, y: e.y });
      g.emit({ e: 'enemyAct', id: e.id, a: 'land', x: e.x, y: e.y });
    }
  } else if (e.state === 2) {
    e.tele = 1;
    if (e.timer >= (ph === 3 ? 150 : 200)) {
      e.state = 0;
      e.timer = 0;
      e.tele = 0;
      g.emit({ e: 'enemyAct', id: e.id, a: 'takeoff', x: e.x, y: e.y });
      if (ph >= 2) spawnAdds(g, 'rastejo', ph === 3 ? 3 : 2);
    }
  }
}
ENEMY_AI.rojao = { update: rojaoUpdate, onHit: (_g, e) => e.state === 2 };

// ───────────── Caldeirão ─────────────
ENEMY_AI.caldeirao = {
  update(g, e) {
    const ph = phase(e);
    e.timer++;
    if (e.state === 0) {
      e.tele = Math.max(0, e.tele - 0.02);
      const every = ph === 3 ? 80 : 110;
      if (e.timer % every === 0) {
        const k = e.timer2++ % 3;
        if (k === 0 || (k === 2 && ph === 1)) {
          // pisão: ondas nas linhas alternadas
          const off = (e.timer2 >> 1) % 2;
          for (let y = Math.ceil(e.y + 2); y < g.h - 1; y++) {
            if ((y + off) % 2) continue;
            for (let x = 1; x < g.w - 1; x++) strike(g, x, y, 70 + Math.abs(x - e.x) * 2);
          }
          g.emit({ e: 'enemyAct', id: e.id, a: 'roar', x: e.x, y: e.y });
        } else if (k === 1) {
          const targets = g.players.filter((p) => p.alive);
          const n = ph + 2;
          for (let j = 0; j < n; j++) {
            const p = targets[j % Math.max(1, targets.length)];
            if (!p) break;
            const ang = Math.atan2(p.y - e.y, p.x - e.x) + (j - (n - 1) / 2) * 0.25;
            g.projectiles.push({ id: g.nextId++, kind: 'rock', x: e.x, y: e.y + 1.4, vx: Math.cos(ang) * 5.5, vy: Math.sin(ang) * 5.5, life: secs(3), owner: -2 });
          }
          g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y });
        } else {
          spawnAdds(g, 'rastejo', 2);
        }
        if (e.timer2 % 3 === 0) {
          e.state = 1;
          e.timer = 0;
          g.message('O Caldeirão superaqueceu! Grelhas abertas!', 'info');
          g.emit({ e: 'enemyAct', id: e.id, a: 'charge', x: e.x, y: e.y });
        }
      }
    } else {
      e.tele = 1;
      if (e.timer >= (ph === 3 ? 200 : 240)) {
        e.state = 0;
        e.timer = 0;
      }
    }
  },
  onHit: (_g, e) => e.state === 1,
};

// ───────────── Criostase ─────────────
function freezeAura(g: Game, e: Enemy, r = 2) {
  for (const b of g.bombs) {
    if (b.vx || b.vy || b.kickedBy >= 0) continue;
    const [bx, by] = g.bombTile(b);
    if (Math.max(Math.abs(bx - e.x), Math.abs(by - e.y)) <= r) {
      if (b.frozen < 5) g.emit({ e: 'freeze', x: bx, y: by });
      b.frozen = Math.max(b.frozen, 40);
    }
  }
}
function shardVolley(g: Game, e: Enemy, eight: boolean) {
  const dirs = eight
    ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0.7, 0.7],
        [-0.7, 0.7],
        [0.7, -0.7],
        [-0.7, -0.7],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
  for (const [dx, dy] of dirs) g.projectiles.push({ id: g.nextId++, kind: 'shard', x: e.x + dx * 1.6, y: e.y + dy * 1.6, vx: dx * 5.5, vy: dy * 5.5, life: secs(3), owner: -2 });
  g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y });
}
function criostaseUpdate(g: Game, e: Enemy) {
  const ph = phase(e);
  e.timer++;
  freezeAura(g, e);
  const every = ph === 3 ? 100 : 150;
  if (e.timer % every === 0) {
    shardVolley(g, e, ph >= 2 || (e.timer / every) % 2 === 1);
    if (ph >= 2) {
      const p = nearestPlayer(g, e);
      if (p) for (const [x, y] of freeTilesNear(g, p.x, p.y, 2, 5)) g.hazards.push({ x, y, t: 70, total: 70, kind: 'frost' });
    }
  }
  if (ph === 3 && !e.data[1]) {
    e.data[1] = 1;
    g.message('A Criostase ativou as sentinelas!', 'info');
    for (const [x, y] of [
      [2, 2],
      [g.w - 3, g.h - 3],
    ])
      if (g.walkableStatic(x, y)) spawnTyped(g, 'sentinela', x, y, { spawnT: 40 });
  }
}
ENEMY_AI.criostase = { update: criostaseUpdate, onHit: () => true };

// ───────────── Oráculo Partido ─────────────
function oracleUpdate(g: Game, e: Enemy, anchors: number[]) {
  const ph = phase(e);
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
  const shootEvery = ph === 1 ? 130 : 95;
  if (e.timer % shootEvery === 0) {
    const p = nearestPlayer(g, e);
    if (p) {
      const n = ph >= 2 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x) + (k - (n - 1) / 2) * 0.35;
        g.projectiles.push({ id: g.nextId++, kind: 'orb', x: e.x, y: e.y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: secs(4), owner: -2 });
      }
      g.emit({ e: 'enemyAct', id: e.id, a: 'shoot', x: e.x, y: e.y });
    }
  }
  if (anchors.length > 1 && e.timer >= (ph === 3 ? 260 : 380)) {
    const cur = g.idx(Math.round(e.x), Math.round(e.y));
    const opts = anchors.filter((a) => a !== cur);
    const a = g.rng.pick(opts);
    e.tx = a % g.w;
    e.ty = (a / g.w) | 0;
    e.state = 1;
    e.timer2 = 45;
    g.emit({ e: 'enemyAct', id: e.id, a: 'charge', x: e.tx, y: e.ty });
  }
  if (ph >= 2 && !e.data[1]) {
    e.data[1] = 1;
    spawnAdds(g, 'piscante', 2);
    g.message('O Oráculo chama seus reflexos!', 'info');
  }
  if (ph === 3 && e.timer % 300 === 150) {
    for (let i = 0; i < g.tiles.length; i++) {
      if (g.tiles[i] === T.MirrorA) g.setTile(i, T.MirrorB);
      else if (g.tiles[i] === T.MirrorB) g.setTile(i, T.MirrorA);
    }
    g.message('Os espelhos giraram!', 'info');
  }
}
ENEMY_AI.oraculo = {
  update: (g, e) => oracleUpdate(g, e, g.marks['O'] ?? []),
  onHit(g, e, _by, tile) {
    if (g.flameRef[tile]) return true;
    if (e.invuln === 0) g.emit({ e: 'enemyAct', id: e.id, a: 'shield', x: e.x, y: e.y });
    e.invuln = 25;
    return false;
  },
};

// ───────────── Mãe-Raiz ─────────────
ENEMY_AI.maeraiz = {
  update(g, e) {
    const ph = phase(e);
    e.timer++;
    const bulbs: number[] = g.mstate.bulbs ?? [];
    const bulbT: Record<number, number> = (g.mstate.bulbT ??= {});
    const down = bulbs.filter((i) => g.tiles[i] !== T.Target);
    if (e.state === 0) {
      e.tele = 0;
      // rebrota bulbos
      for (const i of down) {
        if (g.tick - (bulbT[i] ?? g.tick) > secs(ph === 3 ? 9 : 12)) {
          const x = i % g.w,
            y = (i / g.w) | 0;
          if (!g.playerAtTile(x, y) && !g.bombAt(x, y)) {
            g.setTile(i, T.Target);
            g.emit({ e: 'regrow', x, y });
          }
        }
      }
      if (bulbs.length && down.length === bulbs.length) {
        e.state = 1;
        e.timer = 0;
        g.message('O coração da Mãe-Raiz se abriu!', 'done');
        g.emit({ e: 'enemyAct', id: e.id, a: 'roar', x: e.x, y: e.y });
      }
    } else {
      e.tele = 1;
      if (e.timer >= 360) {
        e.state = 0;
        e.timer = 0;
        for (const i of bulbs) {
          if (g.tiles[i] === T.Empty) g.setTile(i, T.Target);
          bulbT[i] = g.tick;
        }
        g.message('Os bulbos rebrotaram!', 'info');
      }
    }
    // raízes em linha
    if (e.timer % (ph === 3 ? 110 : 150) === 75) {
      const p = nearestPlayer(g, e);
      if (p) {
        const horiz = g.rng.next() < 0.5;
        for (let k = 1; k < (horiz ? g.w : g.h) - 1; k++) {
          const x = horiz ? k : p.x,
            y = horiz ? p.y : k;
          if (Math.abs(x - e.x) <= 1 && Math.abs(y - e.y) <= 1) continue;
          strike(g, x, y, 60 + Math.abs(horiz ? x - p.x : y - p.y) * 3);
        }
        g.emit({ e: 'enemyAct', id: e.id, a: 'roar', x: e.x, y: e.y });
      }
      if (ph >= 2 && (e.timer / 150) % 2 < 1) spawnAdds(g, 'esporo', 1);
    }
  },
  onHit: (_g, e) => e.state === 1,
};

// ───────────── O Arconte ─────────────
ENEMY_AI.arconte = {
  update(g, e) {
    const ph = e.hp > 6 ? 1 : e.hp > 3 ? 2 : 3;
    if (e.data[0] !== ph) {
      e.data[0] = ph;
      e.timer = 0;
      e.timer2 = 0;
      e.tele = 0;
      if (ph === 2) {
        const c = g.mstate.center as [number, number];
        e.x = c[0];
        e.y = c[1];
        e.state = 0;
        g.message('O Arconte congela o salão! Chute as cargas!', 'info');
        for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === T.Empty && g.rng.next() < 0.5) g.frostT[i] = secs(12);
      }
      if (ph === 3) {
        g.dark = true;
        e.state = 0;
        g.message('O Arconte apagou as luzes!', 'fail');
      }
    }
    if (ph === 1) rojaoUpdate(g, e);
    else if (ph === 2) criostaseUpdate(g, e);
    else oracleUpdate(g, e, g.marks['O'] ?? []);
  },
  onHit: (_g, e) => (e.data[0] === 1 || !e.data[0] ? e.state === 2 : e.state !== 1),
  onDeath(g) {
    g.dark = false;
  },
};

export { DX, DY };
