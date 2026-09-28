import { useEffect, useRef } from 'preact/hooks';
import { CARTRIDGES, CHARACTERS, type Player } from '@estopim/shared';
import { touchState } from '../game/input';
import { settings } from '../state/settings';
import { audio } from '../audio/engine';

function vibrate(ms: number) {
  if (settings.value.haptics && navigator.vibrate) navigator.vibrate(ms);
}

/** Direcional virtual + botões. Escreve em touchState (lido pela simulação). */
export function TouchControls({ player, onPause, onEmote }: { player: Player | null; onPause: () => void; onEmote: () => void }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const s = settings.value;
  const size = 1 * s.touchSize;
  useEffect(() => {
    touchState.active = true;
    const zone = stickRef.current!;
    const base = baseRef.current!;
    const knob = knobRef.current!;
    let id = -1;
    let ox = 0,
      oy = 0;
    const R = 56 * size;
    const home = () => {
      const r = zone.getBoundingClientRect();
      return s.touchFloating ? null : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const setBase = (x: number, y: number) => {
      const r = zone.getBoundingClientRect();
      base.style.left = x - r.left + 'px';
      base.style.top = y - r.top + 'px';
    };
    const reset = () => {
      id = -1;
      touchState.dir = -1;
      knob.style.transform = 'translate(-50%,-50%)';
      base.classList.remove('active');
      const h = home();
      if (h) setBase(h.x, h.y);
      else {
        const r = zone.getBoundingClientRect();
        setBase(r.left + r.width * 0.5, r.top + r.height * 0.6);
      }
    };
    reset();
    const move = (x: number, y: number) => {
      let dx = x - ox,
        dy = y - oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        // base segue o dedo (sensação de joystick "arrastável")
        if (s.touchFloating) {
          ox += (dx / len) * (len - R);
          oy += (dy / len) * (len - R);
          setBase(ox, oy);
        }
        dx = x - ox;
        dy = y - oy;
      }
      const l2 = Math.min(R, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      knob.style.transform = `translate(calc(-50% + ${Math.cos(ang) * l2}px), calc(-50% + ${Math.sin(ang) * l2}px))`;
      const dead = 14 * size;
      let dir = -1;
      if (Math.hypot(dx, dy) > dead) {
        // histerese: prefere manter a direção atual perto das diagonais
        const adx = Math.abs(dx),
          ady = Math.abs(dy);
        const cur = touchState.dir;
        const horiz = cur === 1 || cur === 3 ? adx > ady * 0.75 : adx > ady * 1.33;
        dir = horiz ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      }
      if (dir !== touchState.dir && dir >= 0) vibrate(4);
      touchState.dir = dir;
    };
    const down = (e: PointerEvent) => {
      if (id >= 0) return;
      audio.unlock();
      id = e.pointerId;
      zone.setPointerCapture(id);
      const h = home();
      if (h) {
        ox = h.x;
        oy = h.y;
      } else {
        ox = e.clientX;
        oy = e.clientY;
        setBase(ox, oy);
      }
      base.classList.add('active');
      move(e.clientX, e.clientY);
      e.preventDefault();
    };
    const mv = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      move(e.clientX, e.clientY);
      e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      reset();
    };
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', mv);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    window.addEventListener('resize', reset);
    return () => {
      touchState.active = false;
      touchState.dir = -1;
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', mv);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', reset);
    };
  }, [s.touchFloating, s.touchSize]);

  const press = (k: 'bomb' | 'ability' | 'cart') => (e: PointerEvent) => {
    e.preventDefault();
    audio.unlock();
    touchState[k] = true;
    vibrate(k === 'bomb' ? 12 : 8);
    (e.currentTarget as HTMLElement).classList.add('down');
  };
  const release = (e: PointerEvent) => (e.currentTarget as HTMLElement).classList.remove('down');

  const cdFrac = player ? player.abilityCd / Math.max(1, player.abilityMax) : 0;
  const cart = player?.cart ? CARTRIDGES[player.cart] : null;
  const abil = player ? CHARACTERS[player.char].ability : null;
  return (
    <div class={'touch' + (s.touchLeftHanded ? ' lefty' : '')} style={{ opacity: s.touchOpacity, '--ts': size } as any}>
      <div class="stick-zone" ref={stickRef}>
        <div class="stick-base" ref={baseRef}>
          <div class="stick-knob" ref={knobRef} />
        </div>
      </div>
      <div class="tbtns">
        <button class="tbtn bomb" onPointerDown={press('bomb')} onPointerUp={release} onPointerCancel={release} aria-label="Soltar carga">
          <svg viewBox="0 0 40 40" width="46%" height="46%">
            <circle cx="18" cy="23" r="12" fill="currentColor" />
            <path d="M25 13l5-5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
            <circle cx="32" cy="6" r="3.5" fill="#ffd166" />
          </svg>
        </button>
        {abil && (
          <button class={'tbtn ability' + (cdFrac > 0 ? ' cooling' : '')} onPointerDown={press('ability')} onPointerUp={release} onPointerCancel={release} aria-label={'Técnica: ' + abil.name} style={{ '--cd': cdFrac } as any}>
            <span class="abil-name">{abil.name}</span>
            {cdFrac > 0 && <span class="cd-num">{Math.ceil((player!.abilityCd || 0) / 60)}</span>}
          </button>
        )}
        <button class={'tbtn cart' + (cart ? '' : ' empty')} onPointerDown={press('cart')} onPointerUp={release} onPointerCancel={release} aria-label={cart ? 'Cartucho: ' + cart.name : 'Sem cartucho'} style={cart ? ({ '--cc': cart.color } as any) : undefined}>
          <span>{cart ? cart.short : '—'}</span>
          {cart && <b>{player!.cartCharges}</b>}
        </button>
        <button class="tbtn emote" onPointerDown={(e) => (e.preventDefault(), onEmote())} aria-label="Emote">
          ☺
        </button>
      </div>
      <button class="tpause" onPointerDown={(e) => (e.preventDefault(), onPause())} aria-label="Pausar">
        ❚❚
      </button>
    </div>
  );
}
