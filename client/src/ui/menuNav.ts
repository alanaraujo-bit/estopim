import { useEffect } from 'preact/hooks';
import { route } from '../state/store';
import { sfx } from '../audio/sfx';

const FOCUSABLE = 'button:not([disabled]), [role="button"], input, select, a[href], [tabindex]:not([tabindex="-1"])';

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none';
}

function scope(): HTMLElement {
  // prioriza sobreposições (modais/seletores)
  const overlays = document.querySelectorAll<HTMLElement>('.overlay');
  return overlays.length ? overlays[overlays.length - 1] : document.body;
}

function move(dir: 0 | 1 | 2 | 3) {
  const root = scope();
  const all = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
  if (!all.length) return;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !root.contains(cur) || cur === document.body) {
    all[0].focus();
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2,
    ay = a.top + a.height / 2;
  let best: HTMLElement | null = null,
    bestScore = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2,
      by = b.top + b.height / 2;
    const dx = bx - ax,
      dy = by - ay;
    let main = 0,
      cross = 0;
    if (dir === 0) {
      main = -dy;
      cross = Math.abs(dx);
    } else if (dir === 2) {
      main = dy;
      cross = Math.abs(dx);
    } else if (dir === 1) {
      main = dx;
      cross = Math.abs(dy);
    } else {
      main = -dx;
      cross = Math.abs(dy);
    }
    if (main <= 4) continue;
    const score = main + cross * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    sfx.hover();
  }
}

function goBack() {
  const root = scope();
  const btn = root.querySelector<HTMLElement>('button[title="Voltar"], button[title="Fechar"]');
  btn?.click();
}

/** Navegação de menus com setas / controle. Desligada durante a partida. */
export function useMenuNavigation() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (route.value.id === 'game' && !document.querySelector('.overlay, .pause-menu')) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && !['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
      const map: Record<string, 0 | 1 | 2 | 3> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
      if (e.key in map) {
        if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
        e.preventDefault();
        move(map[e.key]);
      } else if (e.key === 'Escape' && route.value.id !== 'game') {
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    let prev: boolean[] = [];
    let heldT = 0;
    let lastDir = -1;
    const iv = setInterval(() => {
      if (route.value.id === 'game' && !document.querySelector('.overlay, .pause-menu')) return;
      const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p);
      if (!pad) return;
      const now = pad.buttons.map((b) => b.pressed);
      const edge = (i: number) => now[i] && !prev[i];
      const ax = pad.axes[0] ?? 0,
        ay = pad.axes[1] ?? 0;
      let dir = -1;
      if (now[12] || ay < -0.6) dir = 0;
      else if (now[15] || ax > 0.6) dir = 1;
      else if (now[13] || ay > 0.6) dir = 2;
      else if (now[14] || ax < -0.6) dir = 3;
      if (dir >= 0) {
        if (dir !== lastDir || performance.now() - heldT > 220) {
          move(dir as 0 | 1 | 2 | 3);
          heldT = performance.now();
        }
      }
      lastDir = dir;
      if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
      if (edge(1)) goBack();
      prev = now;
    }, 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(iv);
    };
  }, []);
}
