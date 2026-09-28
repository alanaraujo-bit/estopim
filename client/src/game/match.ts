import { BotBrain, MAP_BY_ID, MODES, createGame, type Controller, type Game, type MapDef, type ModeId, type PlayerInput, type PlayerSetup, type PStats, type RoundResult, type Rules } from '@estopim/shared';
import { input, type Source } from './input';
import type { Renderer } from './renderer';

export interface MatchConfig {
  mode: ModeId;
  mapId: string;
  players: PlayerSetup[];
  roundsToWin: number;
  rules?: Partial<Rules>;
  seed?: number;
  /** jogadores controlados localmente: id → fonte de entrada */
  local: { id: number; source: Source }[];
  controllerFactory?: () => Controller;
  mapOverride?: MapDef;
  randomMap?: boolean;
  /** fábrica alternativa (missões) */
  factory?: (seed: number) => Game;
}

export interface MatchState {
  round: number;
  wins: Record<number, number>; // por equipe
  results: RoundResult[];
  over: boolean;
  winnerTeam: number;
}

const zeroStats = (): PStats => ({ kills: 0, deaths: 0, selfKills: 0, blocks: 0, items: 0, bombs: 0, abilities: 0, chains: 0, dmgTaken: 0, objectives: 0, survivedTicks: 0, nearMiss: 0 });

/** Partida local (solo, bots ou multijogador no mesmo aparelho). */
export class LocalMatch {
  game!: Game;
  bots = new Map<number, BotBrain>();
  state: MatchState = { round: 0, wins: {}, results: [], over: false, winnerTeam: -1 };
  renderer: Renderer | null = null;
  running = false;
  paused = false;
  raf = 0;
  acc = 0;
  last = 0;
  speed = 1;
  onEvents: ((g: Game) => void) | null = null;
  onRoundOver: ((g: Game, st: MatchState) => void) | null = null;
  onFrame: ((g: Game) => void) | null = null;
  seed: number;
  tickCount = 0;
  totals: PStats[] = [];
  flawless: number[] = [];
  private roundOverFired = false;
  mapIds: string[] = [];

  constructor(public cfg: MatchConfig) {
    this.seed = cfg.seed ?? (Math.random() * 1e9) | 0;
    for (const p of cfg.players) this.state.wins[p.team] = 0;
    this.totals = cfg.players.map(zeroStats);
    this.flawless = cfg.players.map(() => 0);
    const mode = MODES[cfg.mode];
    if (cfg.randomMap || cfg.mapId === 'aleatorio') {
      const pool = !mode || mode.maps === 'all' ? Object.keys(MAP_BY_ID) : mode.maps;
      this.mapIds = pool.slice();
      // embaralha a ordem de mapas de forma determinística
      for (let i = this.mapIds.length - 1; i > 0; i--) {
        const j = (this.seed + i * 7919) % (i + 1);
        [this.mapIds[i], this.mapIds[j]] = [this.mapIds[j], this.mapIds[i]];
      }
    }
    this.newRound();
  }

  newRound() {
    this.state.round++;
    this.roundOverFired = false;
    const seed = this.seed + this.state.round * 1013;
    if (this.cfg.factory) this.game = this.cfg.factory(seed);
    else {
      let mapId = this.cfg.mapId;
      if (this.mapIds.length) mapId = this.mapIds[(this.state.round - 1) % this.mapIds.length];
      const map = this.cfg.mapOverride ?? MAP_BY_ID[mapId] ?? MAP_BY_ID.praca;
      this.game = createGame({
        map,
        mode: this.cfg.mode,
        seed,
        players: this.cfg.players,
        rules: this.cfg.rules,
        round: this.state.round,
        controller: this.cfg.controllerFactory?.(),
      });
    }
    this.bots.clear();
    this.cfg.players.forEach((p, id) => {
      if (p.bot) this.bots.set(id, new BotBrain(id, p.bot, seed));
    });
    if (this.renderer) {
      this.renderer.prev.clear();
      this.renderer.deathAt.clear();
    }
  }

  attach(r: Renderer) {
    this.renderer = r;
    r.view = { local: this.cfg.local.map((l) => l.id), localTeam: this.cfg.players[this.cfg.local[0]?.id ?? 0]?.team ?? 0 };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    input.attach();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.frame(ts);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(ts: number) {
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.25) dt = 0.25;
    input.pollPads();
    if (!this.paused) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 8) {
        this.step();
        this.acc -= 1 / 60;
        steps++;
      }
      if (steps >= 8) this.acc = 0;
    }
    const alpha = this.paused ? 1 : Math.min(1, this.acc * 60);
    this.renderer?.render(this.game, alpha, this.paused ? 0 : dt);
    this.onFrame?.(this.game);
  }

  step() {
    const g = this.game;
    this.renderer?.capture(g);
    const inputs: (PlayerInput | undefined)[] = [];
    for (const l of this.cfg.local) inputs[l.id] = input.sample(l.source);
    input.endTick();
    if (g.phase === 'play' || g.phase === 'ending') {
      for (const [id, bot] of this.bots) inputs[id] = bot.think(g);
    }
    g.step(inputs);
    this.tickCount++;
    if (g.events.length) {
      this.renderer?.onEvents(g, g.events);
      this.onEvents?.(g);
    }
    if (g.phase === 'over' && !this.roundOverFired) {
      this.roundOverFired = true;
      const res = g.result!;
      this.state.results.push(res);
      g.players.forEach((p, i) => {
        const t = this.totals[i];
        for (const k of Object.keys(t) as (keyof PStats)[]) {
          if (k === 'chains') t.chains = Math.max(t.chains, p.stats.chains);
          else t[k] += p.stats[k];
        }
        if (res.winnerTeam === p.team && p.stats.dmgTaken === 0) this.flawless[i]++;
      });
      if (res.winnerTeam >= 0) this.state.wins[res.winnerTeam] = (this.state.wins[res.winnerTeam] ?? 0) + 1;
      const best = Object.entries(this.state.wins).find(([, w]) => w >= this.cfg.roundsToWin);
      if (best) {
        this.state.over = true;
        this.state.winnerTeam = +best[0];
      }
      if (res.success !== undefined) this.state.over = true;
      // modos de rodada única com pontuação: o resultado da rodada é o da partida
      if (this.cfg.roundsToWin <= 1) {
        this.state.over = true;
        this.state.winnerTeam = res.winnerTeam;
      }
      this.onRoundOver?.(g, this.state);
    }
  }
}
