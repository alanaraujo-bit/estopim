import { signal, computed } from '@preact/signals';
import { newProfile, rollChallenges, type Profile } from '@estopim/shared';

// ───────────── Navegação ─────────────
export type ScreenId =
  | 'title'
  | 'onboarding'
  | 'home'
  | 'play'
  | 'campaign'
  | 'briefing'
  | 'setup'
  | 'game'
  | 'results'
  | 'online'
  | 'lobby'
  | 'queue'
  | 'locker'
  | 'shop'
  | 'season'
  | 'challenges'
  | 'profile'
  | 'rankings'
  | 'friends'
  | 'settings'
  | 'credits';

export interface Route {
  id: ScreenId;
  params?: any;
}

export const route = signal<Route>({ id: 'title' });
const history: Route[] = [];

export function go(id: ScreenId, params?: any, replace = false) {
  if (!replace) history.push(route.value);
  route.value = { id, params };
}
export function back(fallback: ScreenId = 'home') {
  const prev = history.pop();
  route.value = prev && prev.id !== 'game' && prev.id !== 'title' ? prev : { id: fallback };
}
export function resetTo(id: ScreenId, params?: any) {
  history.length = 0;
  route.value = { id, params };
}

// ───────────── Perfil local ─────────────
const PKEY = 'estopim.profile';

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PKEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      const base = newProfile(p.id, p.name);
      const merged = { ...base, ...p, equipped: { ...base.equipped, ...p.equipped }, stats: { ...base.stats, ...p.stats } };
      rollChallenges(merged);
      return merged;
    }
  } catch {
    /* perfil corrompido: cria outro */
  }
  const id = 'l_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const p = newProfile(id, '');
  rollChallenges(p);
  return p;
}

export const profile = signal<Profile>(loadProfile());

export function saveProfile(p: Profile = profile.value) {
  try {
    localStorage.setItem(PKEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento */
  }
}

/** Aplica uma mutação ao perfil e persiste. */
export function mutateProfile(fn: (p: Profile) => void) {
  const p = structuredClone(profile.value);
  fn(p);
  profile.value = p;
  saveProfile(p);
}

// ───────────── Notificações ─────────────
export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'warn' | 'error' | 'reward';
  icon?: string;
  sub?: string;
}
export const toasts = signal<Toast[]>([]);
let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', sub?: string, icon?: string, ms = 3200) {
  const t: Toast = { id: toastId++, text, kind, sub, icon };
  toasts.value = [...toasts.value, t].slice(-4);
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), ms);
}

// ───────────── Modal genérico ─────────────
export interface ModalSpec {
  title: string;
  body?: string;
  actions: { label: string; kind?: 'primary' | 'ghost' | 'danger'; onClick?: () => void }[];
  dismissable?: boolean;
}
export const modal = signal<ModalSpec | null>(null);
export function confirmModal(title: string, body: string, okLabel = 'Confirmar', danger = false): Promise<boolean> {
  return new Promise((res) => {
    modal.value = {
      title,
      body,
      dismissable: true,
      actions: [
        { label: 'Cancelar', kind: 'ghost', onClick: () => res(false) },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => res(true) },
      ],
    };
  });
}

// ───────────── Rede ─────────────
export const online = signal<'offline' | 'connecting' | 'online'>('offline');
export const isTouch = signal<boolean>(matchMedia('(pointer: coarse)').matches);
export const viewport = signal({ w: window.innerWidth, h: window.innerHeight });
export const portrait = computed(() => viewport.value.h > viewport.value.w);
export const compact = computed(() => Math.min(viewport.value.w, viewport.value.h) < 560);

window.addEventListener('resize', () => (viewport.value = { w: window.innerWidth, h: window.innerHeight }));
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') isTouch.value = true;
  else if (e.pointerType === 'mouse') isTouch.value = false;
});
window.addEventListener('keydown', () => {
  if (isTouch.value && !matchMedia('(pointer: coarse)').matches) isTouch.value = false;
});
