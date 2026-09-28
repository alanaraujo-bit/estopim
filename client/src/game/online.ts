import { COSMETIC_BY_ID, INPUT_FLAG, MAP_BY_ID, applySnapshot, createGame, type Game, type MatchEndInfo, type MatchStart, type PlayerInput, type RoundResult, type ServerMsg } from '@estopim/shared';
import { onMsg, send } from '../net/client';
import { input } from './input';
import type { Renderer } from './renderer';
import type { MatchState } from './match';

/** Partida online: o servidor é autoritativo; o cliente prevê o próprio movimento. */
export class OnlineSession {
  game!: Game;
  renderer: Renderer | null = null;
  state: MatchState = { round: 1, wins: {}, results: [], over: false, winnerTeam: -1 };
  running = false;
  paused = false;
  onEvents: ((g: Game) => void) | null = null;
  onRoundOver: ((g: Game, st: MatchState) => void) | null = null;
  onFrame: ((g: Game) => void) | null = null;
  onEnd: ((info: MatchEndInfo) => void) | null = null;
  onRoundStart: ((round: number) => void) | null = null;
  me: number;
  pending: { seq: number; inp: PlayerInput }[] = [];
  outbox: [number, number, number][] = [];
  seq = 0;
  raf = 0;
  last = 0;
  acc = 0;
  lastSnapAt = 0;
  snapInterval = 1000 / 30;
  unsub: (() => void) | null = null;
  roundFired = false;
  gotSnap = false;

  info: MatchStart;

  constructor(start: MatchStart) {
    this.info = start;
    this.me = start.you;
    this.build(start);
    this.state.wins = { ...start.wins };
    this.unsub = onMsg((m) => this.onServer(m));
  }

  build(s: MatchStart) {
    this.info = s;
    this.game = createGame({ map: MAP_BY_ID[s.map] ?? MAP_BY_ID.praca, mode: s.mode, seed: s.seed, players: s.players, rules: s.rules, round: s.round });
    this.game.replica = true;
    this.state.round = s.round;
    this.roundFired = false;
    this.gotSnap = false;
    this.pending = [];
    if (this.renderer) {
      this.renderer.prev.clear();
      this.renderer.deathAt.clear();
    }
  }

  attach(r: Renderer) {
    this.renderer = r;
    r.view = { local: [this.me], localTeam: this.info.players[this.me]?.team ?? 0 };
  }

  onServer(m: ServerMsg) {
    switch (m.t) {
      case 'snap': {
        const g = this.game;
        const r = this.renderer;
        r?.capture(g);
        const me = g.players[this.me];
        const before = me ? { x: me.x, y: me.y } : null;
        applySnapshot(g, m.s);
        this.gotSnap = true;
        const now = performance.now();
        if (this.lastSnapAt) this.snapInterval = this.snapInterval * 0.9 + (now - this.lastSnapAt) * 0.1;
        this.lastSnapAt = now;
        // reconciliação: reaplica entradas ainda não confirmadas
        if (me) {
          this.pending = this.pending.filter((p) => p.seq > me.lastSeq);
          if (me.alive && (g.phase === 'play' || g.phase === 'ending')) for (const p of this.pending) g.predictStep(me, p.inp);
          // suaviza pequenas correções
          if (before && r) {
            const dx = me.x - before.x,
              dy = me.y - before.y;
            if (Math.abs(dx) + Math.abs(dy) < 0.6) r.prev.set('p' + me.id, [before.x, before.y]);
          }
        }
        if (g.events.length) {
          r?.onEvents(g, g.events);
          for (const ev of g.events) if (ev.e === 'hit' && ev.p === this.me) navigator.vibrate?.(40);
          this.onEvents?.(g);
        }
        break;
      }
      case 'round': {
        this.state.wins = m.wins;
        this.state.results.push(m.result);
        this.state.over = !m.next;
        this.state.winnerTeam = m.result.winnerTeam;
        if (!this.roundFired) {
          this.roundFired = true;
          this.game.result = m.result as RoundResult;
          this.onRoundOver?.(this.game, this.state);
        }
        break;
      }
      case 'start': {
        this.build(m.m);
        this.me = m.m.you;
        this.attach(this.renderer!);
        this.onRoundStart?.(m.m.round);
        break;
      }
      case 'end':
        this.onEnd?.(m.info);
        break;
      case 'emote': {
        const def = COSMETIC_BY_ID[m.id];
        if (def && this.renderer && m.p !== this.me) this.renderer.emotes.set(m.p, { glyph: def.data?.glyph ?? '!', text: def.data?.text ?? def.name, t: this.renderer.time });
        break;
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    input.attach();
    send({ t: 'resume' });
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
    this.unsub?.();
  }

  frame(ts: number) {
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.25) dt = 0.25;
    input.pollPads();
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 6) {
      this.tickInput();
      this.acc -= 1 / 60;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    const alpha = Math.min(1, (performance.now() - this.lastSnapAt) / this.snapInterval);
    this.renderer?.render(this.game, alpha, dt);
    this.onFrame?.(this.game);
  }

  tickInput() {
    const inp = input.sample({ type: 'any' });
    input.endTick();
    const seq = ++this.seq;
    inp.seq = seq;
    const flags = (inp.bomb ? INPUT_FLAG.bomb : 0) | (inp.ability ? INPUT_FLAG.ability : 0) | (inp.cart ? INPUT_FLAG.cart : 0);
    this.outbox.push([seq, inp.dir, flags]);
    if (this.outbox.length >= 2 || flags) {
      send({ t: 'in', i: this.outbox });
      this.outbox = [];
    }
    const g = this.game;
    const me = g.players[this.me];
    if (!this.gotSnap || !me || !me.alive) return;
    this.pending.push({ seq, inp: { ...inp, bomb: false, ability: false, cart: false } });
    if (this.pending.length > 120) this.pending.shift();
    g.predictStep(me, inp);
    this.renderer?.prev.set('p' + me.id, [me.x, me.y]);
  }
}
