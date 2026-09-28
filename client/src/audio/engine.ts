// Motor de áudio: tudo é sintetizado em tempo real com WebAudio (sem arquivos).

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  uiBus!: GainNode;
  comp!: DynamicsCompressorNode;
  noise!: AudioBuffer;
  pinkNoise!: AudioBuffer;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  settings: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, ui: 0.6, muted: false };
  unlocked = false;
  private voices = 0;
  maxVoices = 48;
  duck!: GainNode;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.connect(this.comp).connect(ctx.destination);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.duck);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.uiBus = ctx.createGain();
    this.uiBus.connect(this.master);
    // ruído branco e rosa
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.pinkNoise = ctx.createBuffer(1, len, ctx.sampleRate);
    const pd = this.pinkNoise.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // reverb curto sintético
    this.reverb = ctx.createConvolver();
    const rl = ctx.sampleRate * 1.6;
    const ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < rl; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.25;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.apply();
  }

  /** Deve ser chamado num gesto do usuário (toque/clique/tecla). */
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  apply() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.7, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.uiBus.gain.setTargetAtTime(s.ui, t, 0.05);
  }

  /** Abaixa a música brevemente (ex.: grandes explosões, fanfarras). */
  duckMusic(amount = 0.5, time = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(this.duck.gain.value, t);
    this.duck.gain.linearRampToValueAtTime(1 - amount, t + 0.03);
    this.duck.gain.setTargetAtTime(1, t + 0.05, time);
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  canPlay(): boolean {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    if (this.voices >= this.maxVoices) return false;
    return true;
  }
  track(node: AudioScheduledSourceNode, _end: number) {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  panner(pan: number, dest: AudioNode): AudioNode {
    if (!this.ctx) return dest;
    if (!pan) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(dest);
    return p;
  }

  osc(type: OscillatorType, freq: number, t: number, dur: number, gain: number, dest: AudioNode, opts: { attack?: number; release?: number; slideTo?: number; slideTime?: number; detune?: number } = {}) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t + (opts.slideTime ?? dur));
    const g = ctx.createGain();
    const a = opts.attack ?? 0.005;
    const r = opts.release ?? dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + a + r + 0.05);
    this.track(o, t + a + r);
    return { o, g };
  }

  noiseBurst(t: number, dur: number, gain: number, dest: AudioNode, filter: { type: BiquadFilterType; freq: number; to?: number; q?: number }, pink = false, attack = 0.002) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = pink ? this.pinkNoise : this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, filter.to), t + dur);
    f.Q.value = filter.q ?? 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    this.track(src, t + dur);
    return { src, f, g };
  }
}

export const audio = new AudioEngine();

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
