import { MISSION_BY_ID, starText, type MissionDef } from '../content/campaign';
import { B, F, I, T, secs } from './constants';
import type { Controller, Game, HudObjective } from './game';
import type { Enemy, Player, RoundResult } from './types';
import { ENEMY_DEFS, MARK_TO_ENEMY, spawnTyped, EF } from '../ai/enemies';
import { BOSS_INFO, spawnBoss } from '../ai/bosses';
import { CARTRIDGES } from '../content/items';

export interface MissionResultInfo {
  success: boolean;
  stars: [boolean, boolean, boolean];
  time: number;
  relic: boolean;
  reason: string;
}

/** Controlador genérico de missões dirigido por dados. */
export function MissionCtl(def: MissionDef): Controller {
  const st = {
    killsByType: {} as Record<string, number>,
    targetsTotal: 0,
    targetsDone: 0,
    collected: 0,
    relic: false,
    startTick: 0,
    npcId: -1,
    npcMax: 0,
    waveIdx: 0,
    nextWave: 0,
    plateMem: {} as Record<number, number>,
    platesDone: false,
    chaseIdx: 0,
    chaseNext: 0,
    failed: '' as string,
    bossDead: false,
    thiefDead: false,
    reachedExit: false,
  };
  const has = (k: string) => def.goals.some((g) => g.k === k);

  const goalsDone = (g: Game, includeExit: boolean): boolean => {
    for (const goal of def.goals) {
      switch (goal.k) {
        case 'exit':
          if (includeExit && !st.reachedExit) return false;
          break;
        case 'targets':
          if (st.targetsDone < (goal.n ?? st.targetsTotal)) return false;
          break;
        case 'collect':
          if (st.collected < goal.n) return false;
          break;
        case 'kill': {
          if (goal.n !== undefined) {
            if ((goal.type ? st.killsByType[goal.type] ?? 0 : Object.values(st.killsByType).reduce((a, b) => a + b, 0)) < goal.n) return false;
          } else if (g.enemies.some((e) => e.alive && !(e.flags & EF.friendly) && (!goal.type || e.type === goal.type))) return false;
          break;
        }
        case 'survive':
          if (g.tick - st.startTick < secs(goal.s)) return false;
          break;
        case 'boss':
          if (!st.bossDead) return false;
          break;
        case 'escort':
          if (!g.mstate.escortDone) return false;
          break;
        case 'thief':
          if (!st.thiefDead) return false;
          break;
        case 'plates':
          if (!st.platesDone) return false;
          break;
        case 'protect':
          break;
      }
    }
    return true;
  };

  const npc = (g: Game): Enemy | undefined => g.enemies.find((e) => e.id === st.npcId);

  return {
    id: 'missao:' + def.id,
    init(g) {
      g.mstate.mission = def.id;
      g.mstate.stealth = def.stars.some((s) => s.k === 'unseen');
      g.mstate.preferNpc = has('protect');
      g.mstate.lights = [];
      // itens e marcas especiais
      const markItems: Record<string, [number, number]> = { i: [T.Block, I.Fragment], j: [T.Empty, I.Fragment], U: [T.Cracked, I.Relic], y: [T.Empty, I.Heart], Y: [T.Empty, I.Cartridge], R: [T.Block, I.RangeUp], K: [T.Block, I.Kick] };
      for (const [mk, [tile, item]] of Object.entries(markItems)) for (const i of g.marks[mk] ?? []) {
        g.tiles[i] = tile;
        g.items[i] = item;
      }
      // fragmentos: não podem ser destruídos por chamas (tratados no motor)
      // inimigos
      for (const [mk, type] of Object.entries(MARK_TO_ENEMY)) {
        for (const i of g.marks[mk] ?? []) {
          const e = spawnTyped(g, type, i % g.w, (i / g.w) | 0, { spawnT: 20 + g.rng.int(40) });
          if (type === 'bastiao' && def.special?.elite) {
            e.hp = e.maxHp = 3;
            e.flags |= EF.elite;
          }
          if (type === 'sentinela') e.dir = g.rng.int(4);
        }
      }
      // estrutura / escolta
      for (const i of g.marks['N'] ?? []) {
        const type = def.special?.npc ?? 'coreto';
        const hp = (def.goals.find((x) => x.k === 'protect' || x.k === 'escort') as any)?.hp ?? ENEMY_DEFS[type].hp;
        const e = spawnTyped(g, type, i % g.w, (i / g.w) | 0, { hp, maxHp: hp, spawnT: 0 });
        st.npcId = e.id;
        st.npcMax = hp;
      }
      // chefe
      if (def.boss) {
        const anchor = (g.marks['H'] ?? g.marks['O'] ?? [g.idx((g.w / 2) | 0, (g.h / 2) | 0)])[0];
        const bx = anchor % g.w,
          by = (anchor / g.w) | 0;
        g.mstate.center = [bx, by];
        spawnBoss(g, def.boss, bx, by);
        if (def.boss === 'maeraiz') g.mstate.bulbs = g.targets.slice();
      }
      st.targetsTotal = g.targets.length;
      // carga inicial do jogador
      for (const p of g.players) {
        const s = def.start ?? {};
        if (s.bombs) p.bombsMax = Math.max(p.bombsMax, s.bombs);
        if (s.range) p.range = Math.max(p.range, s.range);
        if (s.speed) p.speedLvl = Math.max(p.speedLvl, s.speed);
        if (s.kick) p.kick = true;
        if (s.cart) {
          p.cart = s.cart as any;
          p.cartCharges = s.charges ?? CARTRIDGES[s.cart]?.charges ?? 3;
        }
        p.abilityCd = 0;
      }
      if (def.special?.waves) st.nextWave = secs(3);
      if (def.special?.chase) st.chaseNext = secs(def.special.chase.start);
      const thief = def.goals.find((x) => x.k === 'thief') as any;
      if (thief) g.mstate.escapeAt = secs(thief.escapeAfter);
      g.mstate.objectives = this.hud!(g);
      g.message(def.summary, 'info');
    },
    tick(g) {
      if (g.phase !== 'play') return;
      if (!st.startTick) st.startTick = g.tick;
      const el = g.tick - st.startTick;
      // limite de tempo
      if (def.timeLimit && el > secs(def.timeLimit)) st.failed = 'O tempo acabou.';
      // ondas
      const sp = def.special;
      if (sp?.waves && --st.nextWave <= 0) {
        const waves = sp.waves as string[][];
        const wave = waves[Math.min(st.waveIdx, waves.length - 1)];
        const spots = (g.marks['n'] ?? []).length ? g.marks['n'] : [g.idx(g.w - 2, 1), g.idx(1, g.h - 2), g.idx(g.w - 2, g.h - 2)];
        wave.forEach((type, k) => {
          const i = spots[(st.waveIdx + k) % spots.length];
          let x = i % g.w,
            y = (i / g.w) | 0;
          if (!g.walkableStatic(x, y)) return;
          spawnTyped(g, type, x, y, { spawnT: 45 + k * 15 });
        });
        st.waveIdx++;
        st.nextWave = secs(sp.waveEvery ?? 15);
      }
      // prensas
      if (sp?.presses) {
        const period = secs(sp.presses);
        const warn = secs(1);
        if (el % period === period - warn) {
          const grp = Math.floor(el / period) % 2;
          for (const i of g.marks['c'] ?? []) {
            const x = i % g.w;
            if (Math.floor(x / 1) % 2 === grp) g.hazards.push({ x, y: (i / g.w) | 0, t: warn, total: warn, kind: 'crush' });
          }
        }
      }
      // perseguição (colapso direcional)
      if (sp?.chase && el >= st.chaseNext) {
        const up = sp.chase.dir === 'up';
        const line = up ? g.h - 1 - st.chaseIdx : st.chaseIdx;
        if (up ? line > 0 : line < g.w - 1) {
          for (let k = 0; k < (up ? g.w : g.h); k++) {
            const x = up ? k : line,
              y = up ? line : k;
            const t = g.tileAt(x, y);
            if (t === T.Wall || t === T.Pillar) continue;
            g.hazards.push({ x, y, t: 60, total: 60, kind: 'fall' });
          }
          st.chaseIdx++;
          st.chaseNext = el + secs(sp.chase.every);
        }
      }
      // espelhos giratórios
      if (sp?.rotateMirrors && el > 0 && el % secs(sp.rotateMirrors) === 0) {
        for (let i = 0; i < g.tiles.length; i++) {
          if (g.tiles[i] === T.MirrorA) g.setTile(i, T.MirrorB);
          else if (g.tiles[i] === T.MirrorB) g.setTile(i, T.MirrorA);
        }
        g.emit({ e: 'obj', msg: 'Os espelhos giraram!', kind: 'info' });
      }
      // placas de pressão
      if (g.plates.length && !st.platesDone) {
        let all = true;
        const pressedNow: Record<number, number> = {};
        for (const i of g.plates) {
          const x = i % g.w,
            y = (i / g.w) | 0;
          const occ = !!g.playerAtTile(x, y) || !!g.bombAt(x, y) || !!g.enemyAtTile(x, y);
          if (occ) st.plateMem[i] = g.tick;
          const on = g.tick - (st.plateMem[i] ?? -9999) <= 60;
          pressedNow[i] = on ? 1 : 0;
          if (!on) all = false;
        }
        g.mstate.plates = pressedNow;
        if (all) {
          st.platesDone = true;
          g.openDoors();
          g.message('Os portões do templo se abriram!', 'done');
        }
      }
      // orçamento de cargas
      if (def.budget) {
        const used = g.players.reduce((a, p) => a + p.stats.bombs, 0);
        g.mstate.budgetLeft = Math.max(0, def.budget - used);
        if (used >= def.budget && g.bombs.length === 0 && !g.flame.some((f) => f > 0) && !goalsDone(g, false)) st.failed = 'Suas cargas acabaram.';
      }
      // estrutura/escolta
      const n = npc(g);
      if (st.npcId >= 0 && (!n || !n.alive)) st.failed = has('escort') ? 'O Aquecedor foi destruído.' : 'O coreto caiu.';
      // ladrão
      const thief = g.enemies.find((e) => e.type === 'gatuno');
      if (thief && thief.alive && g.exits.length) {
        const ex = g.exits[0];
        if (Math.round(thief.x) === ex % g.w && Math.round(thief.y) === ((ex / g.w) | 0)) st.failed = 'O Gatuno fugiu com o fragmento!';
        if (g.mstate.escapeAt && g.tick === g.mstate.escapeAt) g.message('O Gatuno está correndo para a saída!', 'fail');
      }
      // saída
      const exitOpen = g.exits.length > 0 && goalsDone(g, false);
      if (exitOpen && !g.mstate.exitOpen) {
        g.mstate.exitOpen = true;
        if (def.goals.length > 1) g.message('A saída está aberta!', 'done');
        g.emit({ e: 'door', x: g.exits[0] % g.w, y: (g.exits[0] / g.w) | 0 });
      }
      if (exitOpen) {
        for (const p of g.players) {
          if (!p.alive) continue;
          const i = g.idx(Math.round(p.x), Math.round(p.y));
          if (g.floor[i] === F.Exit && Math.abs(p.x - Math.round(p.x)) < 0.3 && Math.abs(p.y - Math.round(p.y)) < 0.3) st.reachedExit = true;
        }
      }
      if (g.tick % 10 === 0) g.mstate.objectives = this.hud!(g);
    },
    onEnemyDeath(g, e, by) {
      st.killsByType[e.type] = (st.killsByType[e.type] ?? 0) + 1;
      if (e.boss) {
        st.bossDead = true;
        g.message(`${BOSS_INFO[e.type]?.name ?? 'Chefe'} derrotado!`, 'done');
        for (const o of g.enemies) if (o.alive && !o.boss && !(o.flags & EF.friendly)) g.damageEnemy(o, 99, -1);
        g.hazards.length = 0;
      }
      if (e.type === 'gatuno') {
        st.thiefDead = true;
        g.message('Fragmento recuperado!', 'done');
      }
      void by;
    },
    onTarget(g, x, y) {
      st.targetsDone++;
      if (def.special?.lamps) (g.mstate.lights as number[][]).push([x, y]);
      if (def.boss === 'maeraiz') {
        (g.mstate.bulbT ??= {})[g.idx(x, y)] = g.tick;
        return;
      }
      const goal = def.goals.find((gg) => gg.k === 'targets') as any;
      if (goal) g.message(`${goal.label}: ${st.targetsDone}/${goal.n ?? st.targetsTotal}`, st.targetsDone >= (goal.n ?? st.targetsTotal) ? 'done' : 'progress');
    },
    onPickup(g, _p, item) {
      if (item === I.Fragment) {
        st.collected++;
        const goal = def.goals.find((gg) => gg.k === 'collect') as any;
        if (goal) g.message(`${goal.label}: ${st.collected}/${goal.n}`, st.collected >= goal.n ? 'done' : 'progress');
      }
      if (item === I.Relic) {
        st.relic = true;
        if (def.special?.collectItem === 'relic') {
          st.collected++;
          const goal = def.goals.find((gg) => gg.k === 'collect') as any;
          g.message(`${goal?.label ?? 'Relíquias'}: ${st.collected}/${goal?.n ?? 1}`, 'progress');
        } else g.message('Relíquia secreta encontrada!', 'done');
      }
    },
    onDeath(g, p: Player) {
      void p;
      if (!g.players.some((q) => q.alive)) st.failed = 'Você caiu.';
    },
    checkEnd(g): RoundResult | null {
      if (st.failed) return { winnerTeam: -1, winners: [], reason: st.failed, success: false, stars: [false, false, false] };
      if (!goalsDone(g, true)) return null;
      const el = (g.tick - st.startTick) / 60;
      const stars: [boolean, boolean, boolean] = [true, false, false];
      def.stars.forEach((s, k) => {
        let ok = false;
        switch (s.k) {
          case 'time':
            ok = el <= s.s;
            break;
          case 'nodamage':
            ok = g.players.every((p) => p.stats.dmgTaken === 0);
            break;
          case 'relic':
            ok = st.relic;
            break;
          case 'unseen':
            ok = !g.mstate.spotted;
            break;
          case 'bombs':
            ok = g.players.reduce((a, p) => a + p.stats.bombs, 0) <= s.n;
            break;
          case 'kills':
            ok = Object.entries(st.killsByType).reduce((a, [t, v]) => a + (ENEMY_DEFS[t]?.flags & EF.friendly ? 0 : v), 0) >= s.n;
            break;
          case 'intact': {
            const n = npc(g);
            ok = !!n && n.hp >= st.npcMax;
            break;
          }
        }
        stars[k + 1] = ok;
      });
      g.mstate.relicFound = st.relic;
      return { winnerTeam: 0, winners: g.players.map((p) => p.id), reason: 'Missão concluída!', success: true, stars };
    },
    hud(g): HudObjective[] {
      const out: HudObjective[] = [];
      const el = g.tick - (st.startTick || g.tick);
      for (const goal of def.goals) {
        switch (goal.k) {
          case 'exit':
            out.push({ text: g.mstate.exitOpen || def.goals.length === 1 ? 'Chegue à saída' : 'Saída bloqueada', done: st.reachedExit });
            break;
          case 'targets': {
            const n = goal.n ?? st.targetsTotal;
            out.push({ text: `${goal.label}: ${Math.min(n, st.targetsDone)}/${n}`, done: st.targetsDone >= n, progress: st.targetsDone / Math.max(1, n) });
            break;
          }
          case 'collect':
            out.push({ text: `${goal.label}: ${st.collected}/${goal.n}`, done: st.collected >= goal.n, progress: st.collected / goal.n });
            break;
          case 'kill': {
            if (goal.n !== undefined) {
              const v = goal.type ? st.killsByType[goal.type] ?? 0 : 0;
              out.push({ text: `${goal.label}: ${v}/${goal.n}`, done: v >= goal.n, progress: v / goal.n });
            } else {
              const left = g.enemies.filter((e) => e.alive && (!goal.type || e.type === goal.type)).length;
              out.push({ text: `${goal.label} restantes: ${left}`, done: left === 0 });
            }
            break;
          }
          case 'survive': {
            const left = Math.max(0, Math.ceil(goal.s - el / 60));
            out.push({ text: `${goal.label}: ${left}s`, done: left === 0, progress: 1 - left / goal.s });
            break;
          }
          case 'protect':
          case 'escort': {
            const n = npc(g);
            out.push({ text: `${goal.label}`, progress: n ? n.hp / st.npcMax : 0, failed: !n || !n.alive });
            break;
          }
          case 'thief':
            out.push({ text: goal.label, done: st.thiefDead });
            break;
          case 'boss': {
            out.push({ text: `Derrote: ${goal.label}`, done: st.bossDead });
            break;
          }
          case 'plates':
            out.push({ text: `${goal.label}: ${Object.values(g.mstate.plates ?? {}).filter(Boolean).length}/${g.plates.length}`, done: st.platesDone });
            break;
        }
      }
      if (def.budget) out.push({ text: `Cargas restantes: ${g.mstate.budgetLeft ?? def.budget}` });
      if (def.timeLimit) out.push({ text: `Tempo: ${Math.max(0, Math.ceil(def.timeLimit - el / 60))}s` });
      def.stars.forEach((s) => out.push({ text: starText(s), optional: true }));
      return out;
    },
  };
}

export function missionById(id: string) {
  return MISSION_BY_ID[id];
}

export { B };
