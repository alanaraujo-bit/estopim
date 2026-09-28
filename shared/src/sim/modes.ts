import { B, DX, DY, F, T, secs } from './constants';
import type { Controller, Game, HudObjective, ModeId } from './game';
import type { Player, RoundResult } from './types';

const lastStanding = (g: Game): RoundResult | null => {
  const teams = g.aliveTeams();
  if (teams.size > 1) {
    if (g.timeLeft <= 0 && !g.rules.suddenDeath) return { winnerTeam: -1, winners: [], reason: 'Tempo esgotado' };
    return null;
  }
  if (teams.size === 0) return { winnerTeam: -1, winners: [], reason: 'Empate!' };
  const team = [...teams][0];
  const solo = g.players.length === 1;
  if (solo) return null;
  return { winnerTeam: team, winners: g.players.filter((p) => p.team === team).map((p) => p.id), reason: 'Último de pé' };
};

export const ClassicCtl = (): Controller => ({
  id: 'classico',
  checkEnd: lastStanding,
});

// ───────────── Coroa ─────────────
export const CrownCtl = (): Controller => ({
  id: 'coroa',
  init(g) {
    if (!g.zone.length) {
      const cx = (g.w / 2) | 0,
        cy = (g.h / 2) | 0;
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          const i = g.idx(x, y);
          if (g.tiles[i] === T.Pillar || g.tiles[i] === T.Block || g.tiles[i] === T.Vine || g.tiles[i] === T.Hard || g.tiles[i] === T.Barrel) g.tiles[i] = T.Empty;
          g.items[i] = 0;
          g.floor[i] = F.Zone;
          g.zone.push(i);
        }
    }
    g.mstate.teamScore = {} as Record<number, number>;
    g.mstate.target = 30;
    g.mstate.holder = -1;
  },
  tick(g) {
    if (g.phase !== 'play') return;
    const inZone = new Set<number>();
    for (const p of g.players) {
      if (!p.alive) continue;
      const i = g.idx(Math.round(p.x), Math.round(p.y));
      if (g.floor[i] === F.Zone) inZone.add(p.team);
    }
    const holder = inZone.size === 1 ? [...inZone][0] : inZone.size > 1 ? -2 : -1;
    g.mstate.holder = holder;
    if (holder >= 0) {
      const ts = g.mstate.teamScore as Record<number, number>;
      ts[holder] = (ts[holder] ?? 0) + 1;
      if (ts[holder] % 60 === 0) {
        for (const p of g.players) if (p.team === holder) p.score = ts[holder] / 60;
        g.emit({ e: 'score', p: g.players.find((p) => p.team === holder)!.id, v: ts[holder] / 60 });
      }
    }
  },
  checkEnd(g) {
    const ts = g.mstate.teamScore as Record<number, number>;
    for (const [team, v] of Object.entries(ts)) {
      if (v >= g.mstate.target * 60) return { winnerTeam: +team, winners: g.players.filter((p) => p.team === +team).map((p) => p.id), reason: 'Coroa conquistada' };
    }
    if (g.timeLeft <= 0) return bestScore(g, ts, 'Tempo esgotado');
    return null;
  },
  hud(g) {
    const ts = g.mstate.teamScore as Record<number, number>;
    const best = Math.max(0, ...Object.values(ts));
    return [{ text: 'Domine a zona da coroa', progress: best / (g.mstate.target * 60) }];
  },
});

function bestScore(g: Game, ts: Record<number, number>, reason: string): RoundResult {
  let best = -1,
    bestTeam = -1,
    tie = false;
  for (const [team, v] of Object.entries(ts)) {
    if (v > best) {
      best = v;
      bestTeam = +team;
      tie = false;
    } else if (v === best) tie = true;
  }
  if (bestTeam < 0 || tie) return { winnerTeam: -1, winners: [], reason: 'Empate no placar' };
  return { winnerTeam: bestTeam, winners: g.players.filter((p) => p.team === bestTeam).map((p) => p.id), reason };
}

// ───────────── Chuva de Cargas ─────────────
export const RainCtl = (): Controller => ({
  id: 'chuva',
  init(g) {
    // Menos blocos: remove metade aleatoriamente
    for (let i = 0; i < g.tiles.length; i++) {
      if ((g.tiles[i] === T.Block || g.tiles[i] === T.Vine) && g.rng.next() < 0.5) {
        g.tiles[i] = T.Empty;
      }
    }
    g.mstate.nextRain = secs(2);
    g.mstate.elapsed = 0;
  },
  tick(g) {
    if (g.phase !== 'play') return;
    g.mstate.elapsed++;
    if (--g.mstate.nextRain > 0) return;
    const el = g.mstate.elapsed / 60;
    const interval = Math.max(0.16, 1.1 - el * 0.012);
    const burst = el > 60 ? 2 : 1;
    g.mstate.nextRain = secs(interval);
    for (let k = 0; k < burst; k++) {
      // Mira perto de jogadores com frequência, senão aleatório
      let x = 0,
        y = 0;
      const alive = g.alivePlayers();
      for (let tries = 0; tries < 20; tries++) {
        if (alive.length && g.rng.next() < 0.45) {
          const p = g.rng.pick(alive);
          x = Math.round(p.x) + g.rng.int(5) - 2;
          y = Math.round(p.y) + g.rng.int(5) - 2;
        } else {
          x = 1 + g.rng.int(g.w - 2);
          y = 1 + g.rng.int(g.h - 2);
        }
        if (g.canPlaceAt(x, y) && !g.hazards.some((h) => h.x === x && h.y === y)) break;
      }
      if (!g.canPlaceAt(x, y)) continue;
      const warn = secs(Math.max(0.8, 1.3 - el * 0.004));
      g.hazards.push({ x, y, t: warn, total: warn, kind: 'rain', data: el > 90 ? 3 : 2 });
    }
  },
  checkEnd(g) {
    if (g.players.length === 1) {
      const p = g.players[0];
      if (!p.alive) return { winnerTeam: -1, winners: [], reason: `Sobreviveu ${Math.floor(g.mstate.elapsed / 60)} s` };
      return null;
    }
    return lastStanding(g);
  },
  hud(g) {
    return [{ text: `Sobreviva à chuva — ${Math.floor((g.mstate.elapsed ?? 0) / 60)} s` }];
  },
});

// ───────────── Brasa Quente ─────────────
export const PotatoCtl = (): Controller => ({
  id: 'brasa',
  init(g) {
    g.mstate.carrier = -1;
    g.mstate.nextPick = secs(2);
    g.mstate.lock = 0;
  },
  tick(g) {
    if (g.phase !== 'play') return;
    if (g.mstate.lock > 0) g.mstate.lock--;
    const alive = g.alivePlayers();
    let carrier = g.players[g.mstate.carrier] as Player | undefined;
    if (!carrier || !carrier.alive) {
      if (carrier) carrier.potatoT = 0;
      g.mstate.carrier = -1;
      if (--g.mstate.nextPick > 0 || alive.length < 2) return;
      carrier = g.rng.pick(alive);
      g.mstate.carrier = carrier.id;
      carrier.potatoT = secs(Math.max(8, 14 - (g.players.length - alive.length) * 2));
      g.emit({ e: 'curse', p: carrier.id, c: 99, from: -1 });
    }
    // bônus de velocidade para quem carrega
    carrier.chillT = 0;
    // passar adiante
    if (g.mstate.lock === 0) {
      for (const o of alive) {
        if (o === carrier) continue;
        if (Math.abs(o.x - carrier.x) < 0.75 && Math.abs(o.y - carrier.y) < 0.75) {
          o.potatoT = carrier.potatoT;
          carrier.potatoT = 0;
          g.mstate.carrier = o.id;
          g.mstate.lock = secs(0.8);
          g.emit({ e: 'curse', p: o.id, c: 99, from: carrier.id });
          carrier = o;
          break;
        }
      }
    }
    if (--carrier.potatoT <= 0) {
      const cx = Math.round(carrier.x),
        cy = Math.round(carrier.y);
      const b = g.addBomb(cx, cy, B.Potato, -1, 1, 3);
      b.hidden = false;
      g.hurt(carrier, -1, true);
      g.mstate.carrier = -1;
      g.mstate.nextPick = secs(2.5);
    }
  },
  checkEnd: lastStanding,
  hud(g) {
    const c = g.players[g.mstate.carrier];
    return [{ text: c ? `${c.name} está com a Brasa!` : 'A Brasa vai acender…' }];
  },
});

// ───────────── Captura do Núcleo ─────────────
export const CaptureCtl = (): Controller => ({
  id: 'captura',
  init(g) {
    const cx = (g.w / 2) | 0,
      cy = (g.h / 2) | 0;
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        const i = g.idx(x, y);
        if (g.tiles[i] !== T.Wall) g.tiles[i] = T.Empty;
        g.items[i] = 0;
      }
    // Bases: colunas laterais perto dos nascimentos de cada equipe
    const teams = [...new Set(g.players.map((p) => p.team))];
    g.mstate.teams = teams;
    g.mstate.core = { x: cx, y: cy, carrier: -1, home: [cx, cy], idle: 0 };
    g.mstate.caps = {} as Record<number, number>;
    const baseOf: Record<number, number[]> = {};
    teams.forEach((team, k) => {
      const col = k === 0 ? 1 : g.w - 2;
      baseOf[team] = [];
      for (let y = 1; y < g.h - 1; y++) {
        const i = g.idx(col, y);
        if (g.tiles[i] === T.Empty || g.tiles[i] === T.Block || g.tiles[i] === T.Vine) {
          g.tiles[i] = T.Empty;
          g.floor[i] = k === 0 ? F.BaseA : F.BaseB;
          baseOf[team].push(i);
        }
      }
    });
    g.mstate.baseOf = baseOf;
    // reposiciona jogadores do lado da base
    for (const p of g.players) {
      const k = teams.indexOf(p.team);
      const s = g.spawns.filter((s) => (k === 0 ? s.x < g.w / 2 : s.x > g.w / 2));
      const sp = s[p.id % Math.max(1, s.length)] ?? g.spawns[p.id];
      p.x = sp.x;
      p.y = sp.y;
    }
    g.spawns.sort((a, b) => a.x - b.x);
  },
  onDeath(g, p) {
    const core = g.mstate.core;
    if (core.carrier === p.id) {
      core.carrier = -1;
      core.x = Math.round(p.x);
      core.y = Math.round(p.y);
      core.idle = 0;
      p.carrying = 0;
      g.emit({ e: 'core', p: p.id, a: 'drop', x: core.x, y: core.y });
    }
  },
  tick(g) {
    if (g.phase !== 'play') return;
    const core = g.mstate.core;
    if (core.carrier >= 0) {
      const c = g.players[core.carrier];
      core.x = c.x;
      core.y = c.y;
      const i = g.idx(Math.round(c.x), Math.round(c.y));
      if ((g.mstate.baseOf[c.team] as number[]).includes(i)) {
        const caps = g.mstate.caps as Record<number, number>;
        caps[c.team] = (caps[c.team] ?? 0) + 1;
        c.score++;
        c.stats.objectives++;
        c.carrying = 0;
        core.carrier = -1;
        core.x = core.home[0];
        core.y = core.home[1];
        g.emit({ e: 'core', p: c.id, a: 'score', x: c.x, y: c.y });
      }
      return;
    }
    core.idle++;
    if (core.idle > secs(10) && (core.x !== core.home[0] || core.y !== core.home[1])) {
      core.x = core.home[0];
      core.y = core.home[1];
      core.idle = 0;
      g.emit({ e: 'core', p: -1, a: 'reset', x: core.x, y: core.y });
    }
    for (const p of g.players) {
      if (!p.alive || p.jumpT > 0) continue;
      if (Math.abs(p.x - core.x) < 0.6 && Math.abs(p.y - core.y) < 0.6) {
        core.carrier = p.id;
        p.carrying = 1;
        g.emit({ e: 'core', p: p.id, a: 'take', x: core.x, y: core.y });
        break;
      }
    }
  },
  checkEnd(g) {
    const caps = g.mstate.caps as Record<number, number>;
    for (const [team, v] of Object.entries(caps)) if (v >= 3) return { winnerTeam: +team, winners: g.players.filter((p) => p.team === +team).map((p) => p.id), reason: 'Núcleo capturado' };
    if (g.timeLeft <= 0) return bestScore(g, caps, 'Tempo esgotado');
    return null;
  },
  hud(g) {
    const caps = g.mstate.caps as Record<number, number>;
    const teams = g.mstate.teams as number[];
    return [{ text: `Capturas: ${teams.map((t) => caps[t] ?? 0).join(' × ')} (3 vencem)` }];
  },
});

// ───────────── Horda (cooperativo) ─────────────
const WAVES: string[][] = [
  ['rastejo', 'rastejo', 'rastejo'],
  ['rastejo', 'rastejo', 'farejador', 'farejador'],
  ['farejador', 'farejador', 'minador', 'rastejo', 'rastejo'],
  ['bastiao', 'farejador', 'farejador', 'minador'],
  ['acolito', 'acolito', 'farejador', 'rastejo', 'rastejo', 'minador'],
  ['esporo', 'esporo', 'bastiao', 'farejador', 'farejador'],
  ['reparador', 'bastiao', 'bastiao', 'acolito', 'minador', 'farejador'],
  ['vigia', 'vigia', 'esporo', 'esporo', 'acolito', 'minador', 'farejador'],
  ['reparador', 'reparador', 'bastiao', 'bastiao', 'acolito', 'acolito', 'farejador', 'farejador'],
  ['sentinela', 'bastiao', 'bastiao', 'acolito', 'esporo', 'esporo', 'minador', 'minador', 'farejador'],
];

export const HordeCtl = (): Controller => ({
  id: 'horda',
  init(g) {
    for (let i = 0; i < g.tiles.length; i++) if ((g.tiles[i] === T.Block || g.tiles[i] === T.Vine) && g.rng.next() < 0.45) g.tiles[i] = T.Empty;
    for (const p of g.players) p.team = 0;
    g.mstate.wave = 0;
    g.mstate.nextWave = secs(3);
    g.mstate.cleared = false;
  },
  tick(g) {
    if (g.phase !== 'play') return;
    const alive = g.enemies.some((e) => e.alive);
    if (!alive && g.mstate.wave < WAVES.length) {
      if (--g.mstate.nextWave > 0) return;
      const w = g.mstate.wave++;
      g.message(`Onda ${w + 1} de ${WAVES.length}`, 'info');
      // revive quem caiu
      for (const p of g.players) {
        if (!p.alive) g.respawn(p);
        p.hp = p.maxHp;
      }
      const cand: number[] = [];
      for (let i = 0; i < g.tiles.length; i++) {
        const x = i % g.w,
          y = (i / g.w) | 0;
        if (g.tiles[i] !== T.Empty || g.floor[i] === F.Pit) continue;
        const near = g.players.some((p) => p.alive && Math.abs(p.x - x) + Math.abs(p.y - y) < 6);
        if (!near) cand.push(i);
      }
      g.rng.shuffle(cand);
      WAVES[w].forEach((type, k) => {
        const i = cand[k % Math.max(1, cand.length)];
        if (i === undefined) return;
        g.spawnEnemy(type, i % g.w, (i / g.w) | 0, { spawnT: 60 + k * 12 });
      });
      g.mstate.nextWave = secs(4);
      // Brasas de reforço
      for (let k = 0; k < 2; k++) {
        const i = cand[(k + 20) % Math.max(1, cand.length)];
        if (i !== undefined && !g.items[i]) g.items[i] = k === 0 ? 1 + (w % 3) : 11;
      }
      g.tilesVer++;
    }
  },
  checkEnd(g) {
    if (!g.players.some((p) => p.alive)) return { winnerTeam: -1, winners: [], reason: `Caíram na onda ${g.mstate.wave}`, success: false };
    if (g.mstate.wave >= WAVES.length && !g.enemies.some((e) => e.alive)) return { winnerTeam: 0, winners: g.players.map((p) => p.id), reason: 'Horda repelida!', success: true };
    return null;
  },
  hud(g) {
    const left = g.enemies.filter((e) => e.alive).length;
    return [{ text: `Onda ${Math.max(1, g.mstate.wave)}/${WAVES.length} — inimigos: ${left}`, progress: g.mstate.wave / WAVES.length }];
  },
});

export function controllerFor(mode: ModeId): Controller {
  switch (mode) {
    case 'coroa':
      return CrownCtl();
    case 'chuva':
      return RainCtl();
    case 'brasa':
      return PotatoCtl();
    case 'captura':
      return CaptureCtl();
    case 'horda':
      return HordeCtl();
    default:
      return ClassicCtl();
  }
}

export type { HudObjective };
void DX;
void DY;
