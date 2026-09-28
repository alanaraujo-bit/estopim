import { signal } from '@preact/signals';
import { audio } from '../audio/engine';
import { DEFAULT_BINDINGS, input, type Bindings } from '../game/input';

export interface Settings {
  v: number;
  quality: 'auto' | 0 | 1 | 2;
  fpsCap: 0 | 30 | 60;
  shake: number;
  flashes: boolean;
  reducedMotion: boolean;
  uiScale: number;
  markers: boolean;
  showFps: boolean;
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
  muteInBackground: boolean;
  bindings: Record<'solo' | 'left' | 'right', Bindings>;
  touchSize: number;
  touchOpacity: number;
  touchLeftHanded: boolean;
  touchFloating: boolean;
  haptics: boolean;
  padVibration: boolean;
  colorblind: 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  highContrast: boolean;
  largeText: boolean;
  tips: boolean;
  showNames: boolean;
  quickChat: boolean;
  invites: 'todos' | 'amigos' | 'ninguem';
  showOnline: boolean;
  language: 'pt-BR';
}

export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  quality: 'auto',
  fpsCap: 0,
  shake: 1,
  flashes: true,
  reducedMotion: false,
  uiScale: 1,
  markers: true,
  showFps: false,
  master: 0.8,
  music: 0.55,
  sfx: 0.85,
  ui: 0.6,
  muted: false,
  muteInBackground: true,
  bindings: structuredClone(DEFAULT_BINDINGS),
  touchSize: 1,
  touchOpacity: 0.85,
  touchLeftHanded: false,
  touchFloating: true,
  haptics: true,
  padVibration: true,
  colorblind: 'nenhum',
  highContrast: false,
  largeText: false,
  tips: true,
  showNames: true,
  quickChat: true,
  invites: 'todos',
  showOnline: true,
  language: 'pt-BR',
};

const KEY = 'estopim.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_SETTINGS), ...s, bindings: { ...structuredClone(DEFAULT_BINDINGS), ...(s.bindings ?? {}) } };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export const settings = signal<Settings>(load());

/** Qualidade efetiva detectada automaticamente. */
export const autoQuality = signal<0 | 1 | 2>(detectQuality());

function detectQuality(): 0 | 1 | 2 {
  const mem = (navigator as any).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mem <= 2 || cores <= 2) return 0;
  if (mobile && (mem <= 4 || cores <= 4)) return 1;
  return 2;
}

export function effectiveQuality(): 0 | 1 | 2 {
  const q = settings.value.quality;
  return q === 'auto' ? autoQuality.value : q;
}

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.value));
  } catch {
    /* armazenamento indisponível: segue só em memória */
  }
  applySettings();
}

export function applySettings() {
  const s = settings.value;
  audio.settings = { master: s.master, music: s.music, sfx: s.sfx, ui: s.ui, muted: s.muted };
  audio.apply();
  input.bindings = s.bindings;
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(s.uiScale * (s.largeText ? 1.12 : 1)));
  root.classList.toggle('reduced-motion', s.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.toggle('high-contrast', s.highContrast);
  root.dataset.cb = s.colorblind;
}

/** Ajuste dinâmico: se o FPS médio cair muito no modo automático, reduz a qualidade. */
export function reportFps(fps: number) {
  if (settings.value.quality !== 'auto') return;
  if (fps < 40 && autoQuality.value > 0) autoQuality.value = (autoQuality.value - 1) as 0 | 1;
}
