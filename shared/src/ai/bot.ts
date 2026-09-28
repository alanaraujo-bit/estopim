import { CHARACTERS } from '../content/characters';
import { B, BASE_FUSE, DX, DY, F, I, T } from '../sim/constants';
import type { Game } from '../sim/game';
import { Rng } from '../sim/rng';
import type { Player, PlayerInput } from '../sim/types';
import { NEVER, blastTiles, computeDanger, firstStep, safeBfs, type Danger } from './danger';

interface Profile {
  react: number; // ticks entre decisões
  mistake: number; // chance de ignorar verificação de fuga
  aggression: number;
  abilities: number; // chance de usar técnicas
  margin: number;
  lookahead: boolean;
}

const PROFILES: Record<number, Profile> = {
  1: { react: 16, mistake: 0.08, aggression: 0.35, abilities: 0.2, margin: 4, lookahead: false },
  2: { react: 7, mistake: 0.02, aggression: 0.65, abilities: 0.6, margin: 6, lookahead: true },
  3: { react: 2, mistake: 0, aggression: 0.95, abilities: 1, margin: 8, lookahead: true },
};

const ITEM_VALUE: Record<number, number> = {
  [I.BombUp]: 9,
  [I.RangeUp]: 8,
  [I.SpeedUp]: 7,
  [I.Kick]: 6,
  [I.Shield]: 10,
  [I.Cartridge]: 6,
  [I.RangeMax]: 11,
  [I.Heart]: 10,
  [I.Fragment]: 14,
  [I.Relic]: 5,
  [I.Spark]: 3,
  [I.Curse]: -8,
};

export class BotBrain {
  prof: Profile;
  rng: Rng;
  cooldown = 0;
  target = -1;
  targetT = 0;
  lastDir = -1;
  wantBomb = false;
  stuck = 0;
  lastPos = -1;

  constructor(
    public id: number,
    level: number,
    seed: number,
  ) {
    this.prof = PROFILES[level] ?? PROFILES[2];
    this.rng = new Rng(seed * 7919 + id * 104729);
  }

  think(g: Game, shared?: { danger?: Danger }): PlayerInput {
    const p = g.players[this.id];
    const inp: PlayerInput = { dir: -1, bomb: false, ability: false, cart: false };
    if (!p || !p.alive || g.phase !== 'play') return inp;
    const tpt = Math.max(6, Math.round(60 / g.playerSpeed(p)));
    const cx = Math.round(p.x),
      cy = Math.round(p.y);
    const here = g.idx(cx, cy);
    const danger = shared?.danger ?? computeDanger(g, p.team);
    const centered = Math.abs(p.x - cx) < 0.12 && Math.abs(p.y - cy) < 0.12;

    // ─── 1. Em perigo? Fuja. ───
    const inDanger = danger.t[here] !== NEVER && danger.t[here] < 200;
    if (inDanger) {
      const bfs = safeBfs(g, here, danger, tpt, this.prof.margin * 0.5);
      let best = -1,
        bestScore = -1e9;
      for (let i = 0; i < bfs.dist.length; i++) {
        if (bfs.dist[i] < 0) continue;
        const safeForever = danger.t[i] === NEVER;
        const sc = (safeForever ? 1000 : danger.t[i]) - bfs.dist[i] * 8 + this.rng.next();
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      }
      if (best >= 0 && best !== here) {
        const step = firstStep(bfs.prev, here, best);
        if (step >= 0) inp.dir = this.dirTo(g, here, step);
      }
      // Sem saída boa? Técnica de emergência.
      const hopeless = best < 0 || (danger.t[best] !== NEVER && danger.t[best] < bfs.dist[best] * tpt + 10) || best === here;
      if (hopeless && p.abilityCd === 0 && g.rules.abilities && this.rng.next() < this.prof.abilities + 0.2) {
        const d = this.emergencyAbility(g, p, danger);
        if (d >= 0) {
          inp.dir = d;
          p.dir = d;
          inp.ability = true;
        }
      }
      if (inp.dir < 0 && !inp.ability && !centered) inp.dir = this.centerDir(p, cx, cy);
      this.target = -1;
      return inp;
    }

    // ─── 2. Técnicas ofensivas ───
    if (g.rules.abilities && p.abilityCd === 0 && this.rng.next() < this.prof.abilities * 0.08) {
      if (this.offensiveAbility(g, p, danger)) inp.ability = true;
    }
    // Remota: detonar quando pega alguém e estamos seguros
    const myRemote = g.bombs.filter((b) => b.owner === p.id && b.kind === B.Remote);
    if (myRemote.length) {
      const enemyHit = myRemote.some((b) => this.blastHitsEnemy(g, p, b.x, b.y, b.range));
      const selfHit = myRemote.some((b) => blastTiles(g, b.x, b.y, b.range, 0).includes(here));
      if (enemyHit && !selfHit) inp.cart = true;
    }

    // ─── 3. Decidir soltar carga ───
    if (this.cooldown > 0) this.cooldown--;
    if (this.cooldown === 0 && centered) {
      const canNormal = g.activeBombs(p) < p.bombsMax && g.canPlaceAt(cx, cy);
      const canCart = !!p.cart && p.cart !== B.Pulse && p.cart !== B.Frost && g.canPlaceAt(cx, cy) && !g.bombs.some((b) => b.owner === p.id && b.kind === p.cart);
      if (canNormal || canCart) {
        const value = this.bombValue(g, p, cx, cy);
        if (value > 0) {
          const fuse = Math.round(BASE_FUSE * CHARACTERS[p.char].fuseMul);
          const hypo = computeDanger(g, p.team, { x: cx, y: cy, range: p.range, pierce: p.char === 'lume' ? 1 : 0, fuse });
          const escape = this.hasEscape(g, here, hypo, tpt);
          if (escape || this.rng.next() < this.prof.mistake) {
            const threshold = 1.5 - this.prof.aggression;
            if (value >= threshold) {
              if (canNormal) inp.bomb = true;
              else inp.cart = true;
              this.cooldown = this.prof.react + 6;
              return inp;
            }
          }
        }
      }
    }

    // ─── 4. Escolher destino ───
    if (--this.targetT <= 0 || this.target === here || this.target < 0) {
      this.pickTarget(g, p, danger, tpt);
      this.targetT = this.prof.react * 3 + 20;
    }
    if (this.target >= 0 && this.target !== here) {
      const bfs = safeBfs(g, here, danger, tpt, this.prof.margin);
      if (bfs.dist[this.target] >= 0) {
        const step = firstStep(bfs.prev, here, this.target);
        if (step >= 0) {
          // não entrar em tile que ficará perigoso enquanto estivermos lá
          const dt = danger.t[step];
          if (dt === NEVER || dt > tpt * 3) inp.dir = this.dirTo(g, here, step);
        }
      } else this.target = -1;
    }
    // sem rumo: centraliza no tile atual (evita ficar parado entre dois tiles)
    if (inp.dir < 0 && !centered) inp.dir = this.centerDir(p, cx, cy);
    // anti-travamento
    if (this.lastPos === here && inp.dir >= 0) {
      if (++this.stuck > 90) {
        this.target = -1;
        this.stuck = 0;
      }
    } else this.stuck = 0;
    this.lastPos = here;
    return inp;
  }

  centerDir(p: Player, cx: number, cy: number): number {
    const ox = p.x - cx,
      oy = p.y - cy;
    if (Math.abs(ox) > Math.abs(oy)) return ox > 0 ? 3 : 1;
    return oy > 0 ? 0 : 2;
  }

  dirTo(g: Game, from: number, to: number): number {
    const fx = from % g.w,
      fy = (from / g.w) | 0;
    const tx = to % g.w,
      ty = (to / g.w) | 0;
    if (tx > fx) return 1;
    if (tx < fx) return 3;
    if (ty > fy) return 2;
    return 0;
  }

  hasEscape(g: Game, here: number, danger: Danger, tpt: number): boolean {
    // bombas bloqueiam, exceto a hipotética sob nós
    const n = g.w * g.h;
    const blocks = new Uint8Array(n);
    for (const b of g.bombs) {
      const [bx, by] = g.bombTile(b);
      blocks[g.idx(bx, by)] = 1;
    }
    blocks[here] = 0;
    const bfs = safeBfs(g, here, danger, tpt, this.prof.margin, blocks);
    for (let i = 0; i < n; i++) {
      if (bfs.dist[i] <= 0) continue;
      if (danger.t[i] === NEVER) return true;
    }
    return false;
  }

  enemies(g: Game, p: Player): { x: number; y: number; w: number }[] {
    const out: { x: number; y: number; w: number }[] = [];
    for (const o of g.players) {
      if (!o.alive || o.team === p.team || o.invisT > 0) continue;
      out.push({ x: Math.round(o.x), y: Math.round(o.y), w: 1 });
    }
    for (const e of g.enemies) {
      if (!e.alive || e.spawnT > 0 || e.flags & 2) continue;
      if (e.type === 'vigia' && e.state === 0) continue;
      out.push({ x: Math.round(e.x), y: Math.round(e.y), w: e.boss ? 1.5 : 0.8 });
    }
    return out;
  }

  blastHitsEnemy(g: Game, p: Player, x: number, y: number, range: number): boolean {
    const tiles = new Set(blastTiles(g, x, y, range, 0));
    return this.enemies(g, p).some((e) => tiles.has(g.idx(e.x, e.y)));
  }

  bombValue(g: Game, p: Player, x: number, y: number): number {
    const tiles = blastTiles(g, x, y, p.range, p.char === 'lume' ? 1 : 0);
    let v = 0;
    const set = new Set(tiles);
    for (const i of tiles) {
      const t = g.tiles[i];
      if (t === T.Block || t === T.Vine || t === T.Hard) v += 0.6;
      if (t === T.Barrel) v += 0.8;
      if (t === T.Target) v += 3;
      if (t === T.Empty && g.items[i] && g.items[i] !== I.Curse) v -= 0.5;
    }
    for (const e of this.enemies(g, p)) {
      const ei = g.idx(e.x, e.y);
      if (set.has(ei)) v += 1.4 * e.w;
      else if (Math.abs(e.x - x) + Math.abs(e.y - y) <= 2) v += 0.4 * e.w * this.prof.aggression;
    }
    // aliados na linha de fogo: evitar
    for (const o of g.players) if (o.alive && o.id !== p.id && o.team === p.team && set.has(g.idx(Math.round(o.x), Math.round(o.y)))) v -= 2;
    if (g.mode === 'brasa' && p.potatoT <= 0) v *= 0.6;
    return v;
  }

  pickTarget(g: Game, p: Player, danger: Danger, tpt: number) {
    const here = g.idx(Math.round(p.x), Math.round(p.y));
    const bfs = safeBfs(g, here, danger, tpt, this.prof.margin);
    const enemies = this.enemies(g, p);
    let best = -1,
      bestScore = -1e9;
    const modeGoal = this.modeGoal(g, p);
    for (let i = 0; i < bfs.dist.length; i++) {
      const d = bfs.dist[i];
      if (d < 0) continue;
      if (danger.t[i] !== NEVER && danger.t[i] < d * tpt + 60) continue;
      const x = i % g.w,
        y = (i / g.w) | 0;
      let sc = 0;
      const it = g.items[i];
      if (it) sc += (ITEM_VALUE[it] ?? 2) * 1.2;
      // local bom para bombardear blocos
      let blocks = 0;
      for (let dd = 0; dd < 4; dd++) {
        const nx = x + DX[dd],
          ny = y + DY[dd];
        const t = g.tileAt(nx, ny);
        if (t === T.Block || t === T.Vine || t === T.Hard || t === T.Barrel) blocks++;
        if (t === T.Target) blocks += 4;
      }
      sc += blocks * 1.1;
      // perto de inimigos (agressão)
      for (const e of enemies) {
        const md = Math.abs(e.x - x) + Math.abs(e.y - y);
        if (md === 0) continue;
        if ((e.x === x || e.y === y) && md <= p.range) sc += 3.2 * this.prof.aggression * e.w;
        else if (md <= 3) sc += 1.2 * this.prof.aggression * e.w;
      }
      if (modeGoal) sc += modeGoal(i, x, y);
      sc -= d * 0.55;
      sc += this.rng.next() * 0.8;
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    }
    this.target = best;
  }

  modeGoal(g: Game, p: Player): ((i: number, x: number, y: number) => number) | null {
    switch (g.mode) {
      case 'coroa':
        return (i) => (g.floor[i] === F.Zone ? 14 : 0);
      case 'captura': {
        const core = g.mstate.core;
        if (!core) return null;
        if (core.carrier === p.id) {
          const base = new Set<number>(g.mstate.baseOf[p.team]);
          return (i) => (base.has(i) ? 40 : 0);
        }
        const cx = Math.round(core.x),
          cy = Math.round(core.y);
        const carrier = g.players[core.carrier];
        const allyCarrying = carrier && carrier.team === p.team;
        return (_i, x, y) => {
          const md = Math.abs(cx - x) + Math.abs(cy - y);
          return allyCarrying ? Math.max(0, 6 - md) : Math.max(0, 20 - md * 2.5);
        };
      }
      case 'brasa': {
        const carrier = g.players[g.mstate.carrier];
        if (!carrier) return null;
        if (carrier.id === p.id) {
          const others = g.players.filter((o) => o.alive && o.id !== p.id);
          return (_i, x, y) => Math.max(...others.map((o) => Math.max(0, 22 - (Math.abs(o.x - x) + Math.abs(o.y - y)) * 3)), 0);
        }
        return (_i, x, y) => Math.min(12, Math.abs(carrier.x - x) + Math.abs(carrier.y - y)) * 1.8;
      }
    }
    return null;
  }

  emergencyAbility(g: Game, p: Player, danger: Danger): number {
    const cx = Math.round(p.x),
      cy = Math.round(p.y);
    const id = CHARACTERS[p.char].ability.id;
    const safeAt = (x: number, y: number) => g.inb(x, y) && g.canPlaceAt(x, y) && danger.t[g.idx(x, y)] === NEVER;
    switch (id) {
      case 'arranque':
      case 'salto': {
        for (let d = 0; d < 4; d++) {
          const x2 = cx + DX[d] * (id === 'salto' ? 2 : 3),
            y2 = cy + DY[d] * (id === 'salto' ? 2 : 3);
          if (id === 'salto' ? safeAt(x2, y2) : [1, 2, 3].some((k) => safeAt(cx + DX[d] * k, cy + DY[d] * k))) return d;
        }
        return -1;
      }
      case 'congelar':
      case 'estrondo':
        return p.dir;
      case 'prisma': {
        // bloqueia a direção de onde vem a carga mais próxima
        let bestD = -1,
          bestDist = 99;
        for (const b of g.bombs) {
          const [bx, by] = g.bombTile(b);
          if (bx === cx && by !== cy) {
            const d = by < cy ? 0 : 2;
            if (Math.abs(by - cy) < bestDist) {
              bestDist = Math.abs(by - cy);
              bestD = d;
            }
          } else if (by === cy && bx !== cx) {
            const d = bx < cx ? 3 : 1;
            if (Math.abs(bx - cx) < bestDist) {
              bestDist = Math.abs(bx - cx);
              bestD = d;
            }
          }
        }
        return bestDist >= 2 ? bestD : -1;
      }
    }
    return -1;
  }

  offensiveAbility(g: Game, p: Player, danger: Danger): boolean {
    const id = CHARACTERS[p.char].ability.id;
    const cx = Math.round(p.x),
      cy = Math.round(p.y);
    const here = g.idx(cx, cy);
    switch (id) {
      case 'detonar': {
        const own = g.bombs.filter((b) => b.owner === p.id);
        if (!own.length) return false;
        const tiles = new Set<number>();
        for (const b of own) for (const i of blastTiles(g, b.x, b.y, b.range, b.pierce)) tiles.add(i);
        if (tiles.has(here)) return false;
        return this.enemies(g, p).some((e) => tiles.has(g.idx(e.x, e.y)));
      }
      case 'sombra':
        return this.enemies(g, p).some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 4);
      case 'ima': {
        // puxa carga de alguém que está perto de um inimigo? Simplificação: puxar carga própria para inimigo à frente não se aplica.
        return false;
      }
      case 'estrondo': {
        // empurra cargas em direção a inimigos
        const near = g.bombs.some((b) => Math.abs(b.x - cx) + Math.abs(b.y - cy) <= 2 && b.vx === 0 && b.vy === 0);
        const enemyNear = this.enemies(g, p).some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 5);
        return near && enemyNear && danger.t[here] === NEVER;
      }
    }
    return false;
  }
}
