import { B, I, type Game, type GEvent } from '@estopim/shared';
import { audio, midiToFreq } from './engine';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function out(pan = 0) {
  return audio.panner(pan, audio.sfxBus);
}

export const sfx = {
  explosion(size = 1, pan = 0, kind = 0, chain = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now + 0.001;
    const dest = out(pan * 0.6);
    const s = Math.min(1.6, 0.7 + size * 0.12);
    if (kind === B.Frost) {
      audio.noiseBurst(t, 0.7, 0.5, dest, { type: 'highpass', freq: 3000, to: 900, q: 0.5 });
      for (let k = 0; k < 5; k++) audio.osc('sine', midiToFreq(88 + k * 3 + Math.random() * 2), t + k * 0.03, 0.4, 0.07, dest);
      audio.osc('sine', 110, t, 0.3, 0.3, dest, { slideTo: 60 });
      return;
    }
    if (kind === B.Pulse) {
      audio.osc('sine', 220, t, 0.45, 0.5, dest, { slideTo: 40 });
      audio.noiseBurst(t, 0.35, 0.3, dest, { type: 'bandpass', freq: 800, to: 150, q: 1.2 });
      return;
    }
    // corpo grave + estalo + ruído rosa com filtro descendo
    const pitch = 1 + chain * 0.06 + rnd(-0.06, 0.06);
    audio.osc('sine', 140 * pitch, t, 0.5 * s, 0.9, dest, { slideTo: 38, slideTime: 0.45 * s });
    audio.osc('triangle', 90 * pitch, t, 0.3, 0.45, dest, { slideTo: 30 });
    audio.noiseBurst(t, 0.9 * s, 0.85, dest, { type: 'lowpass', freq: 5200, to: 180, q: 0.8 }, true, 0.001);
    audio.noiseBurst(t, 0.12, 0.5, dest, { type: 'highpass', freq: 2500, q: 0.6 });
    // crepitar
    for (let k = 0; k < 4; k++) audio.noiseBurst(t + 0.08 + Math.random() * 0.3, 0.03, 0.18, dest, { type: 'bandpass', freq: rnd(1500, 4500), q: 3 });
    if (size >= 5 || chain >= 2) audio.duckMusic(0.35, 0.3);
    audio.reverbSend && audio.noiseBurst(t, 0.6, 0.2, audio.reverbSend, { type: 'lowpass', freq: 1800, to: 200 }, true);
  },
  place(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.6);
    audio.osc('sine', 180, t, 0.12, 0.45, d, { slideTo: 90 });
    audio.noiseBurst(t, 0.06, 0.12, d, { type: 'bandpass', freq: 900, q: 1.5 });
    // chiado do pavio
    audio.noiseBurst(t + 0.05, 0.35, 0.05, d, { type: 'highpass', freq: 6000, q: 0.5 }, false, 0.05);
  },
  kick(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.6);
    audio.osc('square', 220, t, 0.08, 0.2, d, { slideTo: 110 });
    audio.noiseBurst(t, 0.08, 0.25, d, { type: 'lowpass', freq: 1200 });
  },
  pickup(item: number, pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.5);
    if (item === I.Curse) {
      [60, 58, 55].forEach((m, k) => audio.osc('sawtooth', midiToFreq(m), t + k * 0.08, 0.2, 0.12, d, { slideTo: midiToFreq(m - 1) }));
      return;
    }
    const base = item === I.Shield ? 76 : item === I.Cartridge ? 79 : item === I.RangeMax ? 84 : 72;
    [0, 4, 7, 12].forEach((iv, k) => audio.osc('triangle', midiToFreq(base + iv), t + k * 0.045, 0.18, 0.2, d));
    audio.osc('sine', midiToFreq(base + 24), t + 0.18, 0.3, 0.06, d);
  },
  itemReveal(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now + 0.05;
    audio.osc('sine', midiToFreq(96), t, 0.25, 0.05, out(pan * 0.5));
  },
  burn(pan = 0) {
    if (!audio.canPlay()) return;
    audio.noiseBurst(audio.now, 0.25, 0.12, out(pan), { type: 'bandpass', freq: 2500, to: 800, q: 2 });
  },
  death(pan = 0, local = false) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.5);
    audio.osc('square', 660, t, 0.5, 0.18, d, { slideTo: 80, slideTime: 0.5 });
    audio.osc('triangle', 330, t + 0.05, 0.5, 0.2, d, { slideTo: 50 });
    audio.noiseBurst(t, 0.3, 0.2, d, { type: 'bandpass', freq: 1200, to: 300, q: 1 });
    if (local) audio.duckMusic(0.6, 0.8);
  },
  shieldBreak(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan);
    for (let k = 0; k < 6; k++) audio.osc('sine', rnd(1800, 4200), t + k * 0.02, 0.2, 0.08, d);
    audio.noiseBurst(t, 0.2, 0.25, d, { type: 'highpass', freq: 3000 });
  },
  hurt(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('square', 300, t, 0.15, 0.2, out(pan), { slideTo: 150 });
  },
  ability(id: string, pan = 0, ok = true) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.5);
    if (!ok) {
      audio.osc('square', 180, t, 0.08, 0.12, d);
      audio.osc('square', 140, t + 0.09, 0.1, 0.12, d);
      return;
    }
    switch (id) {
      case 'arranque':
        audio.noiseBurst(t, 0.22, 0.4, d, { type: 'bandpass', freq: 800, to: 5000, q: 1.2 });
        audio.osc('sawtooth', 200, t, 0.18, 0.1, d, { slideTo: 900 });
        break;
      case 'salto':
        audio.osc('sine', 300, t, 0.3, 0.3, d, { slideTo: 900, slideTime: 0.2 });
        audio.osc('triangle', 150, t, 0.35, 0.15, d, { slideTo: 500 });
        break;
      case 'prisma':
        [84, 88, 91, 96].forEach((m, k) => audio.osc('sine', midiToFreq(m), t + k * 0.03, 0.6, 0.1, d));
        audio.noiseBurst(t, 0.3, 0.12, d, { type: 'highpass', freq: 5000 });
        break;
      case 'congelar':
        audio.noiseBurst(t, 0.8, 0.25, d, { type: 'highpass', freq: 4000, to: 1500 });
        [96, 100, 103].forEach((m, k) => audio.osc('sine', midiToFreq(m), t + k * 0.06, 0.7, 0.07, d));
        break;
      case 'estrondo':
        audio.osc('sine', 90, t, 0.5, 0.9, d, { slideTo: 40 });
        audio.osc('sine', 90, t + 0.15, 0.4, 0.6, d, { slideTo: 45 });
        audio.noiseBurst(t, 0.2, 0.3, d, { type: 'lowpass', freq: 400 });
        audio.duckMusic(0.3, 0.2);
        break;
      case 'sombra':
        audio.noiseBurst(t, 0.6, 0.3, d, { type: 'lowpass', freq: 2000, to: 200 });
        audio.osc('sine', 400, t, 0.6, 0.08, d, { slideTo: 120 });
        break;
      case 'ima':
        audio.osc('sawtooth', 110, t, 0.5, 0.12, d, { slideTo: 440 });
        audio.osc('sawtooth', 112, t, 0.5, 0.12, d, { slideTo: 445 });
        break;
      case 'detonar':
        [67, 71, 74, 79].forEach((m, k) => audio.osc('triangle', midiToFreq(m), t + k * 0.05, 0.15, 0.15, d));
        break;
    }
  },
  teleport(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('sine', 300, t, 0.3, 0.2, out(pan), { slideTo: 1200 });
    audio.osc('sine', 1200, t + 0.12, 0.3, 0.15, out(pan), { slideTo: 300 });
  },
  fall(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.6);
    audio.osc('sine', 80, t, 0.3, 0.6, d, { slideTo: 35 });
    audio.noiseBurst(t, 0.25, 0.35, d, { type: 'lowpass', freq: 900, to: 100 }, true);
  },
  vent(pan = 0) {
    if (!audio.canPlay()) return;
    audio.noiseBurst(audio.now, 0.7, 0.35, out(pan * 0.6), { type: 'bandpass', freq: 300, to: 1500, q: 0.8 }, true, 0.05);
  },
  freeze(pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('sine', midiToFreq(100), t, 0.3, 0.06, out(pan));
    audio.noiseBurst(t, 0.2, 0.1, out(pan), { type: 'highpass', freq: 6000 });
  },
  curse(pan = 0, potato = false) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    if (potato) {
      [72, 76, 79].forEach((m, k) => audio.osc('square', midiToFreq(m), t + k * 0.05, 0.1, 0.1, out(pan)));
      return;
    }
    audio.osc('sawtooth', 120, t, 0.5, 0.15, out(pan), { slideTo: 60 });
    audio.osc('sawtooth', 127, t, 0.5, 0.15, out(pan), { slideTo: 63 });
  },
  nearMiss() {
    if (!audio.canPlay()) return;
    audio.noiseBurst(audio.now, 0.3, 0.2, audio.sfxBus, { type: 'bandpass', freq: 600, to: 3000, q: 2 });
  },
  enemyHit(pan = 0, dead = false, boss = false) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.6);
    if (boss) {
      audio.osc('sawtooth', 110, t, 0.6, 0.35, d, { slideTo: 55 });
      audio.osc('square', 73, t, 0.6, 0.25, d, { slideTo: 40 });
      audio.duckMusic(0.3, 0.3);
      return;
    }
    audio.osc('square', dead ? 520 : 800, t, dead ? 0.35 : 0.1, 0.12, d, { slideTo: dead ? 90 : 500 });
    if (dead) audio.noiseBurst(t, 0.3, 0.2, d, { type: 'bandpass', freq: 1500, to: 400, q: 1 });
  },
  enemyAct(a: string, pan = 0) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const d = out(pan * 0.6);
    switch (a) {
      case 'shoot':
        audio.osc('triangle', 900, t, 0.15, 0.1, d, { slideTo: 300 });
        break;
      case 'alert':
        audio.osc('square', 880, t, 0.06, 0.07, d);
        audio.osc('square', 1175, t + 0.07, 0.08, 0.07, d);
        break;
      case 'shield':
        audio.osc('sine', 1500, t, 0.15, 0.12, d, { slideTo: 2200 });
        break;
      case 'repair':
        audio.osc('sine', 600, t, 0.2, 0.08, d, { slideTo: 900 });
        break;
      case 'roar':
        audio.osc('sawtooth', 70, t, 1.2, 0.4, d, { slideTo: 45 });
        audio.osc('sawtooth', 72, t, 1.2, 0.4, d, { slideTo: 44 });
        audio.noiseBurst(t, 1.1, 0.25, d, { type: 'lowpass', freq: 600, to: 150 }, true, 0.1);
        break;
      case 'charge':
        audio.osc('sine', 200, t, 0.9, 0.12, d, { slideTo: 800, slideTime: 0.9 });
        break;
      case 'ambush':
        audio.osc('square', 220, t, 0.15, 0.2, d, { slideTo: 440 });
        audio.noiseBurst(t, 0.2, 0.3, d, { type: 'bandpass', freq: 900 });
        break;
      default:
        audio.osc('triangle', 500, t, 0.1, 0.06, d);
    }
  },
  door() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('sawtooth', 80, t, 0.8, 0.2, audio.sfxBus, { slideTo: 60 });
    audio.noiseBurst(t, 0.9, 0.2, audio.sfxBus, { type: 'lowpass', freq: 500 }, true);
    [72, 76, 79, 84].forEach((m, k) => audio.osc('triangle', midiToFreq(m), t + 0.3 + k * 0.08, 0.3, 0.12, audio.sfxBus));
  },
  objective(done = false) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    const seq = done ? [72, 76, 79, 84, 88] : [79, 84];
    seq.forEach((m, k) => audio.osc('triangle', midiToFreq(m), t + k * 0.07, 0.25, 0.14, audio.uiBus));
  },
  countdown(n: number) {
    if (!audio.canPlay()) return;
    const t = audio.now;
    if (n > 0) {
      audio.osc('square', midiToFreq(72), t, 0.12, 0.12, audio.uiBus);
      audio.osc('sine', midiToFreq(84), t, 0.12, 0.08, audio.uiBus);
    } else {
      audio.osc('square', midiToFreq(84), t, 0.35, 0.14, audio.uiBus);
      audio.osc('sine', midiToFreq(96), t, 0.35, 0.1, audio.uiBus);
      audio.noiseBurst(t, 0.25, 0.1, audio.uiBus, { type: 'highpass', freq: 5000 });
    }
  },
  sudden() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    for (let k = 0; k < 3; k++) {
      audio.osc('sawtooth', midiToFreq(69), t + k * 0.35, 0.2, 0.12, audio.uiBus);
      audio.osc('sawtooth', midiToFreq(70), t + k * 0.35 + 0.17, 0.2, 0.12, audio.uiBus);
    }
  },
  roundWin() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.duckMusic(0.8, 1.5);
    const mel = [67, 72, 76, 79, 84, 79, 84, 88];
    mel.forEach((m, k) => {
      audio.osc('square', midiToFreq(m), t + k * 0.1, 0.18, 0.1, audio.uiBus);
      audio.osc('triangle', midiToFreq(m - 12), t + k * 0.1, 0.18, 0.12, audio.uiBus);
    });
    [60, 64, 67, 72].forEach((m) => audio.osc('sawtooth', midiToFreq(m), t + 0.8, 0.9, 0.05, audio.uiBus, { attack: 0.02 }));
  },
  roundLose() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.duckMusic(0.8, 1.5);
    [67, 66, 65, 64].forEach((m, k) => audio.osc('triangle', midiToFreq(m), t + k * 0.22, 0.3, 0.14, audio.uiBus));
    audio.osc('triangle', midiToFreq(52), t + 0.9, 0.9, 0.14, audio.uiBus);
  },
  score() {
    if (!audio.canPlay()) return;
    audio.osc('triangle', midiToFreq(88), audio.now, 0.1, 0.06, audio.uiBus);
  },
  coreScore() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    [72, 79, 84, 91].forEach((m, k) => audio.osc('square', midiToFreq(m), t + k * 0.06, 0.2, 0.1, audio.uiBus));
  },
  // UI
  hover() {
    if (!audio.canPlay()) return;
    audio.osc('sine', 1400, audio.now, 0.04, 0.04, audio.uiBus, { slideTo: 1800 });
  },
  click() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('triangle', 660, t, 0.07, 0.14, audio.uiBus, { slideTo: 880 });
    audio.noiseBurst(t, 0.03, 0.06, audio.uiBus, { type: 'highpass', freq: 4000 });
  },
  confirm() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('triangle', midiToFreq(76), t, 0.1, 0.14, audio.uiBus);
    audio.osc('triangle', midiToFreq(83), t + 0.07, 0.16, 0.14, audio.uiBus);
  },
  back() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('triangle', midiToFreq(76), t, 0.08, 0.12, audio.uiBus);
    audio.osc('triangle', midiToFreq(69), t + 0.06, 0.12, 0.12, audio.uiBus);
  },
  error() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.osc('square', 200, t, 0.1, 0.1, audio.uiBus);
    audio.osc('square', 160, t + 0.1, 0.14, 0.1, audio.uiBus);
  },
  reward() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    [72, 76, 79, 84, 88, 91, 96].forEach((m, k) => audio.osc('triangle', midiToFreq(m), t + k * 0.05, 0.3, 0.1, audio.uiBus));
    audio.noiseBurst(t + 0.3, 0.6, 0.05, audio.uiBus, { type: 'highpass', freq: 7000 });
  },
  levelUp() {
    if (!audio.canPlay()) return;
    const t = audio.now;
    audio.duckMusic(0.7, 1.2);
    const seq = [60, 64, 67, 72, 76, 79, 84];
    seq.forEach((m, k) => {
      audio.osc('square', midiToFreq(m), t + k * 0.06, 0.25, 0.08, audio.uiBus);
    });
    [72, 76, 79, 84].forEach((m) => audio.osc('triangle', midiToFreq(m), t + 0.5, 1.2, 0.08, audio.uiBus, { attack: 0.01 }));
  },
  tick() {
    if (!audio.canPlay()) return;
    audio.osc('square', 1200, audio.now, 0.03, 0.05, audio.uiBus);
  },
};

/** Traduz eventos da simulação em sons. */
export function playEvents(g: Game, evs: GEvent[], localIds: number[]) {
  const pan = (x: number) => (x - g.w / 2) / (g.w / 2);
  let booms = 0;
  for (const ev of evs) {
    switch (ev.e) {
      case 'boom':
        if (booms++ < 3) sfx.explosion(ev.r, pan(ev.x), ev.k, ev.chain);
        break;
      case 'place':
        sfx.place(pan(ev.x));
        break;
      case 'kick':
        sfx.kick(pan(ev.x));
        break;
      case 'pickup':
        sfx.pickup(ev.i, pan(ev.x));
        break;
      case 'block':
        if (ev.item) sfx.itemReveal(pan(ev.x));
        break;
      case 'burnItem':
        sfx.burn(pan(ev.x));
        break;
      case 'death':
        sfx.death(pan(ev.x), localIds.includes(ev.p));
        break;
      case 'hit':
        if (ev.shield) sfx.shieldBreak(pan(ev.x));
        else if (g.players[ev.p]?.alive) sfx.hurt(pan(ev.x));
        break;
      case 'ability':
        sfx.ability(ev.a, pan(ev.x), ev.ok);
        break;
      case 'teleport':
        sfx.teleport(pan(ev.x));
        break;
      case 'fall':
        sfx.fall(pan(ev.x));
        break;
      case 'vent':
        sfx.vent(pan(ev.x));
        break;
      case 'freeze':
        sfx.freeze(pan(ev.x));
        break;
      case 'curse':
        sfx.curse(0, ev.c === 99);
        break;
      case 'nearMiss':
        if (localIds.includes(ev.p)) sfx.nearMiss();
        break;
      case 'enemyHit':
        sfx.enemyHit(pan(ev.x), ev.dead, ev.boss);
        break;
      case 'enemyAct':
        sfx.enemyAct(ev.a, pan(ev.x));
        break;
      case 'sudden':
        sfx.sudden();
        break;
      case 'door':
        sfx.door();
        break;
      case 'obj':
        sfx.objective(ev.kind === 'done');
        break;
      case 'core':
        if (ev.a === 'score') sfx.coreScore();
        else sfx.pickup(I.Cartridge, pan(ev.x));
        break;
      case 'score':
        sfx.score();
        break;
      case 'respawn':
        sfx.teleport(pan(ev.x));
        break;
    }
  }
}
