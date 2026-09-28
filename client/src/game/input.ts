import type { PlayerInput } from '@estopim/shared';

export type Action = 'up' | 'right' | 'down' | 'left' | 'bomb' | 'ability' | 'cart' | 'pause' | 'emote';
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Record<'solo' | 'left' | 'right', Bindings> = {
  solo: {
    up: ['KeyW', 'ArrowUp'],
    right: ['KeyD', 'ArrowRight'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    bomb: ['Space', 'KeyJ', 'KeyZ'],
    ability: ['KeyK', 'KeyX', 'ShiftLeft'],
    cart: ['KeyL', 'KeyC', 'KeyE'],
    pause: ['Escape', 'KeyP'],
    emote: ['KeyT'],
  },
  left: {
    up: ['KeyW'],
    right: ['KeyD'],
    down: ['KeyS'],
    left: ['KeyA'],
    bomb: ['KeyF', 'Space'],
    ability: ['KeyG'],
    cart: ['KeyR'],
    pause: ['Escape'],
    emote: ['KeyT'],
  },
  right: {
    up: ['ArrowUp'],
    right: ['ArrowRight'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    bomb: ['Slash', 'Numpad0', 'Enter', 'NumpadEnter'],
    ability: ['Period', 'Numpad1'],
    cart: ['Comma', 'Numpad2'],
    pause: ['Escape'],
    emote: ['Numpad3'],
  },
};

export const KEY_LABELS: Record<string, string> = {
  Space: 'Espaço',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Shift Esq.',
  ShiftRight: 'Shift Dir.',
  ControlLeft: 'Ctrl Esq.',
  ControlRight: 'Ctrl Dir.',
  Enter: 'Enter',
  Escape: 'Esc',
  Slash: '/',
  Period: '.',
  Comma: ',',
  NumpadEnter: 'Enter (num.)',
  Numpad0: 'Num 0',
  Numpad1: 'Num 1',
  Numpad2: 'Num 2',
  Numpad3: 'Num 3',
  Backspace: '⌫',
  Tab: 'Tab',
};

export function keyLabel(code: string) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export type Source = { type: 'keyboard'; scheme: 'solo' | 'left' | 'right' } | { type: 'gamepad'; index: number } | { type: 'touch' } | { type: 'any' };

const DIR_ACTIONS: Action[] = ['up', 'right', 'down', 'left'];

/** Estado compartilhado dos controles de toque (escrito pelo componente de UI). */
export const touchState = {
  dir: -1,
  bomb: false,
  ability: false,
  cart: false,
  active: false,
};

export class InputManager {
  held = new Set<string>();
  dirStack: string[] = [];
  latched = new Set<string>();
  bindings: Record<'solo' | 'left' | 'right', Bindings> = structuredClone(DEFAULT_BINDINGS);
  padPrev = new Map<number, boolean[]>();
  padLatch = new Map<number, Set<Action>>();
  onPause: (() => void) | null = null;
  onEmote: ((src: Source) => void) | null = null;
  lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  seq = 0;
  private bound = false;
  enabled = true;

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }
  detach() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }
  clear = () => {
    this.held.clear();
    this.dirStack = [];
    this.latched.clear();
  };

  private isBound(code: string): boolean {
    for (const sch of Object.values(this.bindings)) for (const keys of Object.values(sch)) if (keys.includes(code)) return true;
    return false;
  }

  onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (!this.isBound(e.code)) return;
    e.preventDefault();
    this.lastDevice = 'keyboard';
    if (e.repeat) return;
    this.held.add(e.code);
    this.latched.add(e.code);
    for (const sch of Object.values(this.bindings)) {
      for (const a of DIR_ACTIONS) if (sch[a].includes(e.code)) {
        this.dirStack = this.dirStack.filter((c) => c !== e.code);
        this.dirStack.push(e.code);
      }
      if (sch.pause.includes(e.code)) this.onPause?.();
    }
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
    this.dirStack = this.dirStack.filter((c) => c !== e.code);
  };

  private kbDir(b: Bindings): number {
    for (let k = this.dirStack.length - 1; k >= 0; k--) {
      const code = this.dirStack[k];
      for (let d = 0; d < 4; d++) if (b[DIR_ACTIONS[d]].includes(code) && this.held.has(code)) return d;
    }
    return -1;
  }
  private kbEdge(b: Bindings, a: Action): boolean {
    let hit = false;
    for (const code of b[a]) if (this.latched.has(code)) hit = true;
    return hit;
  }

  /** Amostra a entrada de uma fonte. Chame uma vez por tick de simulação. */
  sample(src: Source): PlayerInput {
    const inp: PlayerInput = { dir: -1, bomb: false, ability: false, cart: false, seq: ++this.seq };
    if (!this.enabled) return inp;
    if (src.type === 'any') {
      // jogador solo: teclado + qualquer controle + toque
      const parts = [this.sample({ type: 'keyboard', scheme: 'solo' }), this.sample({ type: 'touch' }), ...this.connectedPads().map((i) => this.sample({ type: 'gamepad', index: i }))];
      for (const q of parts) {
        if (inp.dir < 0 && q.dir >= 0) inp.dir = q.dir;
        inp.bomb ||= q.bomb;
        inp.ability ||= q.ability;
        inp.cart ||= q.cart;
      }
      return inp;
    }
    if (src.type === 'keyboard') {
      const b = this.bindings[src.scheme];
      inp.dir = this.kbDir(b);
      inp.bomb = this.kbEdge(b, 'bomb');
      inp.ability = this.kbEdge(b, 'ability');
      inp.cart = this.kbEdge(b, 'cart');
      if (this.kbEdge(b, 'emote')) this.onEmote?.(src);
    } else if (src.type === 'gamepad') {
      const pad = navigator.getGamepads?.()[src.index];
      if (pad) {
        const latch = this.padLatch.get(src.index);
        const st = this.readPad(pad);
        inp.dir = st.dir;
        inp.bomb = !!latch?.has('bomb');
        inp.ability = !!latch?.has('ability');
        inp.cart = !!latch?.has('cart');
        if (latch?.has('emote')) this.onEmote?.(src);
        latch?.clear();
      }
    } else if (src.type === 'touch') {
      inp.dir = touchState.dir;
      inp.bomb = touchState.bomb;
      inp.ability = touchState.ability;
      inp.cart = touchState.cart;
      touchState.bomb = touchState.ability = touchState.cart = false;
    }
    return inp;
  }

  /** Limpa bordas de teclado após todas as amostras do tick. */
  endTick() {
    this.latched.clear();
  }

  readPad(pad: Gamepad) {
    const ax = pad.axes[0] ?? 0,
      ay = pad.axes[1] ?? 0;
    let dir = -1;
    const bt = (i: number) => !!pad.buttons[i]?.pressed;
    if (bt(12)) dir = 0;
    else if (bt(15)) dir = 1;
    else if (bt(13)) dir = 2;
    else if (bt(14)) dir = 3;
    else if (Math.hypot(ax, ay) > 0.45) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 1 : 3) : ay > 0 ? 2 : 0;
    return { dir };
  }

  /** Detecta bordas de botões de controle (chamar a cada quadro). */
  pollPads() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const prev = this.padPrev.get(pad.index) ?? [];
      const now = pad.buttons.map((b) => b.pressed);
      let latch = this.padLatch.get(pad.index);
      if (!latch) this.padLatch.set(pad.index, (latch = new Set()));
      const edge = (i: number) => now[i] && !prev[i];
      if (edge(0)) latch.add('bomb');
      if (edge(1) || edge(2) || edge(4)) latch.add('ability');
      if (edge(3) || edge(5)) latch.add('cart');
      if (edge(8)) latch.add('emote');
      if (edge(9)) this.onPause?.();
      if (now.some((b, i) => b && !prev[i])) this.lastDevice = 'gamepad';
      this.padPrev.set(pad.index, now);
    }
  }

  connectedPads(): number[] {
    return (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p).map((p) => p.index);
  }

  rumble(index: number, strength: number, ms: number) {
    const pad = navigator.getGamepads?.()[index] as any;
    pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch?.(() => {});
  }
}

export const input = new InputManager();
