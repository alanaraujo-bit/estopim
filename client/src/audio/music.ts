import { Rng } from '@estopim/shared';
import { audio, midiToFreq } from './engine';

// Trilha generativa: cada estilo define andamento, escala, progressão, percussão e timbres.
// O motivo de cada seção é gerado com semente fixa → memorável, mas com variações a cada volta.

type Inst = 'sanfona' | 'pluck' | 'bell' | 'marimba' | 'arp' | 'lead' | 'harp' | 'brass';
type Drum = 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'zabumba' | 'zrim' | 'triangle' | 'triopen' | 'shaker' | 'clank' | 'taiko' | 'wood' | 'tom' | 'rim';

interface Style {
  bpm: number;
  root: number;
  scale: number[];
  sections: number[][]; // graus por compasso (4 compassos por seção)
  drums: Partial<Record<Drum, string>>; // 16 passos: x = forte, o = fraco, . = nada
  tense?: Partial<Record<Drum, string>>; // camada extra na intensidade 2
  bass: string; // 16 passos: R raiz, F quinta, O oitava, . pausa, - sustenta
  comp?: { inst: 'pad' | 'sanfona' | 'pluck' | 'bell' | 'organ'; pattern: string };
  lead: Inst;
  leadOct: number;
  rhythms: string[]; // ritmos candidatos da melodia (16 passos por compasso, 2 compassos)
  swing?: number;
  leadGain?: number;
  bright?: number;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIX = [0, 2, 4, 5, 7, 9, 10];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const DOR = [0, 2, 3, 5, 7, 9, 10];
const PHR = [0, 1, 3, 5, 7, 8, 10];
const LYD = [0, 2, 4, 6, 7, 9, 11];
const HMIN = [0, 2, 3, 5, 7, 8, 11];

export const STYLES: Record<string, Style> = {
  // Forró eletrônico: zabumba, triângulo e sanfona.
  vila: {
    bpm: 122,
    root: 55,
    scale: MIX,
    sections: [
      [0, 3, 4, 0],
      [0, 3, 6, 4],
      [3, 4, 0, 5],
      [0, 3, 4, 0],
    ],
    drums: { zabumba: 'x.....x.x.......', zrim: '....x.......x...', triangle: 'x.oxx.oxx.oxx.ox', kick: 'x.......x.......' },
    tense: { shaker: 'oooooooooooooooo', clap: '....x.......x...' },
    bass: 'R.....F.O.....F.',
    comp: { inst: 'sanfona', pattern: '..x...x...x...x.' },
    lead: 'sanfona',
    leadOct: 1,
    rhythms: ['x.x.x..xx.x.x...', 'x..x..x.x.x.x...', 'x.xx..x.x..x.x..', '..x.x.x.x..xx...'],
    swing: 0.08,
    leadGain: 0.9,
  },
  menu: {
    bpm: 96,
    root: 57,
    scale: MAJ,
    sections: [
      [0, 5, 3, 4],
      [0, 5, 1, 4],
      [3, 4, 2, 5],
      [3, 4, 0, 0],
    ],
    drums: { zabumba: 'x.....x.........', zrim: '....x.......x...', triangle: 'x.o.x.o.x.o.x.o.' },
    bass: 'R.....F.R.......',
    comp: { inst: 'pluck', pattern: 'x..x..x.x..x..x.' },
    lead: 'bell',
    leadOct: 1,
    rhythms: ['x...x...x.x.....', 'x.x...x...x.....', '..x.x...x...x...'],
    swing: 0.1,
    leadGain: 0.6,
  },
  fundicao: {
    bpm: 108,
    root: 45,
    scale: PHR,
    sections: [
      [0, 0, 1, 0],
      [0, 5, 1, 0],
      [3, 1, 0, 6],
      [0, 0, 1, 0],
    ],
    drums: { kick: 'x...x...x...x...', clank: '..x...x...x..x.x', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    tense: { tom: '............x.xx', hat: 'oxoxoxoxoxoxoxox' },
    bass: 'R.R.R.R.R.R.F.R.',
    comp: { inst: 'organ', pattern: 'x...............' },
    lead: 'lead',
    leadOct: 1,
    rhythms: ['x..x..x...x.x...', 'x.x.x...x..x....', 'xx..x..x..x.....'],
    leadGain: 0.55,
  },
  boreal: {
    bpm: 98,
    root: 60,
    scale: LYD,
    sections: [
      [0, 1, 0, 4],
      [5, 1, 4, 0],
      [3, 1, 5, 4],
      [0, 1, 4, 0],
    ],
    drums: { kick: 'x.........x.....', rim: '....x.......x...', shaker: '..o...o...o...o.' },
    tense: { hat: 'x.x.x.x.x.x.x.x.', snare: '....x.......x..x' },
    bass: 'R.......F.......',
    comp: { inst: 'bell', pattern: 'x.x.x.x.x.x.x.x.' },
    lead: 'bell',
    leadOct: 1,
    rhythms: ['x...x...x...x...', 'x.....x...x.....', 'x...x.x.....x...'],
    leadGain: 0.5,
  },
  aurora: {
    bpm: 90,
    root: 50,
    scale: DOR,
    sections: [
      [0, 3, 0, 6],
      [0, 3, 4, 6],
      [5, 3, 4, 0],
      [0, 3, 6, 0],
    ],
    drums: { taiko: 'x.......x..x....', wood: '....x.......x.x.', shaker: 'o.o.o.o.o.o.o.o.' },
    tense: { tom: 'x..x..x.x..x..x.' },
    bass: 'R.......R...F...',
    comp: { inst: 'pad', pattern: 'x...............' },
    lead: 'harp',
    leadOct: 1,
    rhythms: ['x.x.x...x.x.x...', 'x...x.x.x.......', 'x.xxx...x...x...'],
    leadGain: 0.6,
  },
  verdejante: {
    bpm: 112,
    root: 52,
    scale: [0, 3, 5, 7, 10, 12, 15],
    sections: [
      [0, 2, 3, 0],
      [0, 2, 4, 3],
      [2, 3, 4, 0],
      [0, 2, 3, 0],
    ],
    drums: { taiko: 'x.....x...x.....', wood: 'x..x..x...x.x...', shaker: 'oxoxoxoxoxoxoxox' },
    tense: { tom: '..x...x...x...xx', kick: 'x...x...x...x...' },
    bass: 'R..R..F...R..F..',
    comp: { inst: 'pluck', pattern: 'x..x..x...x..x..' },
    lead: 'marimba',
    leadOct: 1,
    rhythms: ['x.xx.x.xx.x.x...', 'x..x.x..x.x.x...', 'xx.x.x..xx.x....'],
    leadGain: 0.7,
  },
  orbita: {
    bpm: 114,
    root: 48,
    scale: MIN,
    sections: [
      [0, 5, 2, 6],
      [0, 5, 3, 4],
      [5, 6, 0, 4],
      [0, 5, 2, 6],
    ],
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.' },
    tense: { hat: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...' },
    bass: 'R.R.R.R.R.R.R.R.',
    comp: { inst: 'pad', pattern: 'x...............' },
    lead: 'arp',
    leadOct: 1,
    rhythms: ['x.x.x.x.x.x.x.x.', 'xxx.x.x.xxx.x.x.', 'x.xxx.x.x.xxx.x.'],
    leadGain: 0.45,
  },
  magma: {
    bpm: 126,
    root: 45,
    scale: HMIN,
    sections: [
      [0, 0, 5, 4],
      [0, 3, 5, 4],
      [5, 6, 4, 4],
      [0, 0, 5, 4],
    ],
    drums: { taiko: 'x..x..x.x.......', kick: 'x.......x.......', snare: '....x.......x...', clank: '......x.......x.' },
    tense: { tom: 'x.x.x.x.x.xxxxxx', hat: 'x.x.x.x.x.x.x.x.' },
    bass: 'R.R.R.RRR.R.R.F.',
    comp: { inst: 'organ', pattern: 'x.......x.......' },
    lead: 'brass',
    leadOct: 1,
    rhythms: ['x..x..x.x.......', 'x.x.x..xx.......', 'x...x.x.x..x....'],
    leadGain: 0.5,
  },
  neon: {
    bpm: 116,
    root: 52,
    scale: MIN,
    sections: [
      [0, 5, 3, 4],
      [0, 5, 6, 4],
      [3, 4, 5, 6],
      [0, 5, 3, 4],
    ],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', openhat: '..............x.' },
    tense: { hat: 'xxxxxxxxxxxxxxxx', clap: '....x..x....x...' },
    bass: 'RORORORORORORORO',
    comp: { inst: 'pad', pattern: 'x.......x.......' },
    lead: 'arp',
    leadOct: 1,
    rhythms: ['x.xx.xx.x.xx.xx.', 'x..x..x.x..x..x.', 'xxx.xxx.xxx.x.x.'],
    leadGain: 0.45,
  },
  chefe: {
    bpm: 132,
    root: 45,
    scale: PHR,
    sections: [
      [0, 1, 0, 6],
      [0, 1, 5, 4],
      [0, 1, 0, 6],
      [5, 4, 1, 0],
    ],
    drums: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', taiko: 'x.......x...x...', hat: 'x.x.x.x.x.x.x.x.' },
    tense: { tom: 'x.xx.xx.x.xx.xxx', clap: '....x.......x...' },
    bass: 'RRRRRRRRFFFFOOFF',
    comp: { inst: 'organ', pattern: 'x...x...x...x...' },
    lead: 'brass',
    leadOct: 1,
    rhythms: ['x.x.x..xx.x.x...', 'xx.xx.x.x...x...', 'x..x..x.x.xx.x..'],
    leadGain: 0.55,
  },
  vitoria: {
    bpm: 128,
    root: 60,
    scale: MAJ,
    sections: [
      [0, 3, 4, 0],
      [0, 3, 4, 0],
      [0, 3, 4, 0],
      [0, 3, 4, 0],
    ],
    drums: { zabumba: 'x.....x.x.......', triangle: 'x.oxx.oxx.oxx.ox', zrim: '....x.......x...' },
    bass: 'R.....F.O.....F.',
    comp: { inst: 'sanfona', pattern: '..x...x...x...x.' },
    lead: 'sanfona',
    leadOct: 1,
    rhythms: ['x.x.x.x.x.x.x...'],
    leadGain: 0.8,
  },
};

interface Phrase {
  notes: { step: number; deg: number; len: number }[];
}

class Composer {
  phrases: Phrase[] = [];
  constructor(
    public st: Style,
    seed: number,
  ) {
    const rng = new Rng(seed);
    // um motivo por seção (A, A', B, A'')
    const motifA = this.makePhrase(rng, 0);
    const motifB = this.makePhrase(rng, 2);
    const vary = (p: Phrase, r: Rng): Phrase => ({
      notes: p.notes.map((n, i) => (i === p.notes.length - 1 || r.next() > 0.3 ? n : { ...n, deg: n.deg + (r.next() < 0.5 ? 1 : -1) })),
    });
    this.phrases = [motifA, vary(motifA, rng), motifB, vary(motifA, rng)];
  }
  makePhrase(rng: Rng, sectionIdx: number): Phrase {
    const rh = this.st.rhythms[rng.int(this.st.rhythms.length)];
    const notes: Phrase['notes'] = [];
    let deg = [0, 2, 4][rng.int(3)] + (sectionIdx === 2 ? 2 : 0);
    // 2 compassos de ritmo (repete o padrão com pequena alteração no segundo)
    for (let bar = 0; bar < 2; bar++) {
      for (let s = 0; s < 16; s++) {
        const c = rh[s];
        if (c !== 'x') continue;
        if (bar === 1 && s > 10 && rng.next() < 0.5) continue;
        let len = 1;
        while (s + len < 16 && rh[s + len] === '.' && len < 4) len++;
        notes.push({ step: bar * 16 + s, deg, len });
        const r = rng.next();
        deg += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
        deg = Math.max(-2, Math.min(9, deg));
      }
    }
    // termina em nota do acorde
    if (notes.length) notes[notes.length - 1].deg = [0, 2, 4][rng.int(3)];
    return { notes };
  }
}

export class MusicPlayer {
  style: Style | null = null;
  styleId = '';
  composer: Composer | null = null;
  timer = 0;
  nextTime = 0;
  step = 0;
  bar = 0;
  intensity = 1;
  bus: GainNode | null = null;
  filter: BiquadFilterNode | null = null;
  seed = 1;
  cycle = 0;

  play(styleId: string, seed = 7) {
    if (styleId === this.styleId && this.timer) return;
    audio.init();
    if (!audio.ctx) return;
    this.stop(0.6);
    const st = STYLES[styleId] ?? STYLES.vila;
    this.style = st;
    this.styleId = styleId;
    this.seed = seed;
    this.cycle = 0;
    this.composer = new Composer(st, seed);
    const ctx = audio.ctx;
    this.bus = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    this.bus.connect(this.filter).connect(audio.musicBus);
    this.step = 0;
    this.bar = 0;
    this.nextTime = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  stop(fade = 0.5) {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    const bus = this.bus;
    if (bus && audio.ctx) {
      const t = audio.ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => bus.disconnect(), fade * 1000 + 100);
    }
    this.bus = null;
    this.styleId = '';
  }

  setIntensity(v: number) {
    this.intensity = v;
    if (this.filter && audio.ctx) this.filter.frequency.setTargetAtTime(v === 0 ? 2200 : 18000, audio.ctx.currentTime, 0.4);
  }

  /** Abafa (menus de pausa etc.) */
  muffle(on: boolean) {
    if (this.filter && audio.ctx) this.filter.frequency.setTargetAtTime(on ? 900 : this.intensity === 0 ? 2200 : 18000, audio.ctx.currentTime, 0.15);
  }

  private schedule() {
    const ctx = audio.ctx;
    const st = this.style;
    if (!ctx || !st || !this.bus) return;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / st.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.14) {
      const swing = st.swing && this.step % 2 === 1 ? st.swing * stepDur : 0;
      this.playStep(this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
        if (this.bar >= 16) {
          this.bar = 0;
          this.cycle++;
          // nova variação preservando os motivos principais
          if (this.cycle % 2 === 0) this.composer = new Composer(st, this.seed + this.cycle);
        }
      }
    }
  }

  private chordFor(bar: number): number[] {
    const st = this.style!;
    const sec = st.sections[Math.floor(bar / 4) % st.sections.length];
    const deg = sec[bar % 4];
    return [deg, deg + 2, deg + 4];
  }

  private degToMidi(deg: number, oct = 0): number {
    const st = this.style!;
    const n = st.scale.length;
    const o = Math.floor(deg / n);
    const d = ((deg % n) + n) % n;
    return st.root + st.scale[d] + 12 * (o + oct);
  }

  private playStep(t: number, sd: number) {
    const st = this.style!;
    const bus = this.bus!;
    const s = this.step;
    const chord = this.chordFor(this.bar);
    const inten = this.intensity;
    // Percussão
    for (const [drum, pat] of Object.entries(st.drums) as [Drum, string][]) {
      const c = pat[s];
      if (c === 'x' || c === 'o') this.drum(drum, t, c === 'x' ? 1 : 0.5, bus);
    }
    if (inten >= 2 && st.tense) {
      for (const [drum, pat] of Object.entries(st.tense) as [Drum, string][]) {
        const c = pat[s];
        if (c === 'x' || c === 'o') this.drum(drum, t, c === 'x' ? 0.9 : 0.45, bus);
      }
    }
    // Baixo
    const bc = st.bass[s];
    if (bc !== '.' && bc !== '-') {
      const rootM = this.degToMidi(chord[0], -2);
      const m = bc === 'F' ? this.degToMidi(chord[2], -2) : bc === 'O' ? rootM + 12 : rootM;
      let len = 1;
      while (s + len < 16 && st.bass[s + len] === '.' && len < 3) len++;
      this.bass(midiToFreq(m), t, sd * len * 0.95, bus);
    }
    // Acompanhamento
    if (st.comp && inten >= 1) {
      if (st.comp.pattern[s] === 'x') {
        const notes = chord.map((d) => midiToFreq(this.degToMidi(d, 0)));
        const len = st.comp.inst === 'pad' || st.comp.inst === 'organ' ? sd * (st.comp.pattern.indexOf('x', s + 1) > 0 ? st.comp.pattern.indexOf('x', s + 1) - s : 16 - s) : sd * 1.5;
        this.comp(st.comp.inst, notes, t, len, bus);
      }
    }
    // Melodia: seções B/A só com intensidade ≥ 1; frase de 2 compassos
    if (inten >= 1 && this.composer) {
      const secIdx = Math.floor(this.bar / 4) % 4;
      const phrase = this.composer.phrases[secIdx];
      const within = (this.bar % 2) * 16 + s;
      // deixa respirar: toca frases nos compassos 0-1 e 2-3 alternando com pausa no fim da seção B
      const rest = this.bar % 4 === 3 && secIdx === 3 && inten < 2;
      if (!rest) {
        for (const n of phrase.notes) {
          if (n.step !== within) continue;
          const m = this.degToMidi(n.deg + chord[0] - (chord[0] > 3 ? 7 : 0), st.leadOct);
          this.lead(st.lead, midiToFreq(m), t, sd * n.len, bus, (st.leadGain ?? 0.6) * (inten >= 2 ? 1.1 : 1));
        }
      }
    }
  }

  // ─────────── instrumentos ───────────
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private bass(f: number, t: number, dur: number, bus: AudioNode) {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(250, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.008, 0.32, dur);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(bus);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private comp(inst: string, freqs: number[], t: number, dur: number, bus: AudioNode) {
    const ctx = audio.ctx!;
    if (inst === 'pad' || inst === 'organ') {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(inst === 'pad' ? 0.07 : 0.05, t + (inst === 'pad' ? 0.4 : 0.02));
      g.gain.setValueAtTime(inst === 'pad' ? 0.07 : 0.05, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = inst === 'pad' ? 1100 : 1800;
      lp.connect(g).connect(bus);
      for (const f of freqs) {
        for (const det of inst === 'pad' ? [-8, 8] : [0]) {
          const o = ctx.createOscillator();
          o.type = inst === 'pad' ? 'sawtooth' : 'square';
          o.frequency.value = f;
          o.detune.value = det;
          o.connect(lp);
          o.start(t);
          o.stop(t + dur + 0.35);
        }
      }
      return;
    }
    for (const f of freqs) this.lead(inst as Inst, f, t, dur, bus, 0.25);
  }

  private lead(inst: Inst, f: number, t: number, dur: number, bus: AudioNode, gain: number) {
    const ctx = audio.ctx!;
    const g = ctx.createGain();
    switch (inst) {
      case 'sanfona': {
        // acordeão: serras detunadas + vibrato + passa-banda
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.6;
        const lg = ctx.createGain();
        lg.gain.value = f * 0.006;
        lfo.connect(lg);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = Math.min(2600, f * 3);
        bp.Q.value = 0.9;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        for (const [type, det] of [
          ['sawtooth', -7],
          ['sawtooth', 7],
          ['square', 0],
        ] as [OscillatorType, number][]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = f;
          o.detune.value = det;
          lg.connect(o.frequency);
          o.connect(bp);
          o.start(t);
          o.stop(t + dur + 0.15);
        }
        bp.connect(lp).connect(g);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09 * gain, t + 0.025);
        g.gain.setValueAtTime(0.08 * gain, t + Math.max(0.03, dur - 0.04));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
        lfo.start(t);
        lfo.stop(t + dur + 0.15);
        break;
      }
      case 'bell': {
        const car = ctx.createOscillator();
        car.type = 'sine';
        car.frequency.value = f * 2;
        const mod = ctx.createOscillator();
        mod.frequency.value = f * 2 * 3.5;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 2.5, t);
        mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
        mod.connect(mg).connect(car.frequency);
        car.connect(g);
        this.env(g, t, 0.003, 0.12 * gain, 1.1);
        car.start(t);
        mod.start(t);
        car.stop(t + 1.2);
        mod.stop(t + 1.2);
        break;
      }
      case 'marimba': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * 2;
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = f * 8;
        const g2 = ctx.createGain();
        this.env(g2, t, 0.001, 0.05 * gain, 0.05);
        o2.connect(g2).connect(bus);
        o.connect(g);
        this.env(g, t, 0.002, 0.2 * gain, 0.35);
        o.start(t);
        o2.start(t);
        o.stop(t + 0.45);
        o2.stop(t + 0.1);
        break;
      }
      case 'harp':
      case 'pluck': {
        const o = ctx.createOscillator();
        o.type = inst === 'harp' ? 'triangle' : 'triangle';
        o.frequency.value = f * (inst === 'harp' ? 2 : 1);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4000, t);
        lp.frequency.exponentialRampToValueAtTime(600, t + 0.4);
        o.connect(lp).connect(g);
        this.env(g, t, 0.002, 0.16 * gain, inst === 'harp' ? 0.9 : 0.3);
        o.start(t);
        o.stop(t + 1);
        break;
      }
      case 'arp': {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f * 2;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 6;
        lp.frequency.setValueAtTime(3500, t);
        lp.frequency.exponentialRampToValueAtTime(500, t + 0.15);
        o.connect(lp).connect(g);
        this.env(g, t, 0.002, 0.09 * gain, Math.min(0.2, dur));
        o.start(t);
        o.stop(t + 0.3);
        break;
      }
      case 'brass': {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.exponentialRampToValueAtTime(2500, t + 0.06);
        lp.frequency.exponentialRampToValueAtTime(1200, t + dur);
        o.connect(lp).connect(g);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11 * gain, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
        o.start(t);
        o.stop(t + dur + 0.1);
        break;
      }
      case 'lead':
      default: {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2200;
        o.connect(lp).connect(g);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08 * gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
    g.connect(bus);
    if (inst === 'bell' || inst === 'harp' || inst === 'sanfona') {
      const send = ctx.createGain();
      send.gain.value = 0.35;
      g.connect(send).connect(audio.reverbSend);
    }
  }

  private drum(d: Drum, t: number, v: number, bus: AudioNode) {
    const ctx = audio.ctx!;
    switch (d) {
      case 'kick':
        audio.osc('sine', 130, t, 0.22, 0.55 * v, bus, { slideTo: 42, slideTime: 0.12 });
        break;
      case 'zabumba':
        audio.osc('sine', 95, t, 0.3, 0.6 * v, bus, { slideTo: 55, slideTime: 0.15 });
        audio.noiseBurst(t, 0.05, 0.12 * v, bus, { type: 'lowpass', freq: 700 });
        break;
      case 'zrim':
        audio.noiseBurst(t, 0.06, 0.18 * v, bus, { type: 'bandpass', freq: 1800, q: 2.5 });
        audio.osc('triangle', 330, t, 0.05, 0.1 * v, bus);
        break;
      case 'triangle':
      case 'triopen': {
        const dur = d === 'triopen' || v >= 1 ? 0.35 : 0.06;
        for (const [ratio, amp] of [
          [1, 1],
          [2.76, 0.5],
          [5.4, 0.25],
        ]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 2900 * ratio;
          const g = ctx.createGain();
          this.env(g, t, 0.001, 0.035 * v * amp, dur);
          o.connect(g).connect(bus);
          o.start(t);
          o.stop(t + dur + 0.05);
        }
        break;
      }
      case 'snare':
        audio.noiseBurst(t, 0.16, 0.28 * v, bus, { type: 'highpass', freq: 1500 });
        audio.osc('triangle', 210, t, 0.08, 0.2 * v, bus, { slideTo: 150 });
        break;
      case 'clap':
        for (let k = 0; k < 3; k++) audio.noiseBurst(t + k * 0.011, 0.09, 0.18 * v, bus, { type: 'bandpass', freq: 1400, q: 1.4 });
        break;
      case 'hat':
        audio.noiseBurst(t, 0.035, 0.09 * v, bus, { type: 'highpass', freq: 8000 });
        break;
      case 'openhat':
        audio.noiseBurst(t, 0.25, 0.08 * v, bus, { type: 'highpass', freq: 7000 });
        break;
      case 'shaker':
        audio.noiseBurst(t, 0.05, 0.06 * v, bus, { type: 'highpass', freq: 6000 }, false, 0.01);
        break;
      case 'clank': {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 540;
        const m = ctx.createOscillator();
        m.frequency.value = 540 * 1.47;
        const mg = ctx.createGain();
        mg.gain.value = 800;
        m.connect(mg).connect(o.frequency);
        const g = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2500;
        this.env(g, t, 0.001, 0.07 * v, 0.18);
        o.connect(bp).connect(g).connect(bus);
        o.start(t);
        m.start(t);
        o.stop(t + 0.25);
        m.stop(t + 0.25);
        break;
      }
      case 'taiko':
        audio.osc('sine', 80, t, 0.5, 0.6 * v, bus, { slideTo: 45, slideTime: 0.3 });
        audio.noiseBurst(t, 0.12, 0.2 * v, bus, { type: 'lowpass', freq: 400 }, true);
        break;
      case 'tom':
        audio.osc('sine', 160, t, 0.2, 0.35 * v, bus, { slideTo: 90 });
        break;
      case 'wood':
        audio.osc('sine', 950, t, 0.05, 0.18 * v, bus);
        audio.osc('sine', 1900, t, 0.02, 0.06 * v, bus);
        break;
      case 'rim':
        audio.noiseBurst(t, 0.03, 0.14 * v, bus, { type: 'bandpass', freq: 3000, q: 4 });
        break;
    }
  }
}

export const music = new MusicPlayer();

export function biomeTrack(biome: string, boss = false) {
  if (boss) return 'chefe';
  return STYLES[biome] ? biome : 'vila';
}
