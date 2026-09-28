import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CHARACTERS, type CharId, SKINS } from '@estopim/shared';
import { drawCharacter } from '../art/characters';
import { drawItemIcon, ITEM_COLORS, drawBomb } from '../art/objects';
import { rr } from '../art/draw';
import { sfx } from '../audio/sfx';
import { audio } from '../audio/engine';
import { back as navBack, modal, profile, toasts } from '../state/store';
import { Icon } from './icons';

export function Btn(p: {
  children?: ComponentChildren;
  kind?: 'fire' | 'gold' | 'cool' | 'green' | 'danger' | 'ghost' | '';
  size?: 'sm' | 'lg' | 'xl' | '';
  icon?: JSX.Element;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  block?: boolean;
  class?: string;
  title?: string;
  shine?: boolean;
  dot?: boolean;
  silent?: boolean;
  style?: JSX.CSSProperties;
  autofocus?: boolean;
}) {
  const cls = ['btn', p.kind ? 'btn-' + p.kind : '', p.size ? 'btn-' + p.size : '', p.block ? 'btn-block' : '', p.shine ? 'btn-shine' : '', !p.children ? 'btn-icon' : '', p.class ?? ''].join(' ');
  return (
    <button
      class={cls}
      disabled={p.disabled}
      title={p.title}
      aria-label={p.title}
      style={p.style}
      autofocus={p.autofocus}
      onPointerEnter={() => !p.disabled && sfx.hover()}
      onClick={(e) => {
        audio.unlock();
        if (p.disabled) return;
        if (!p.silent) sfx.click();
        p.onClick?.(e as any);
      }}
    >
      {p.icon}
      {p.children}
      {p.dot && <span class="badge-dot" />}
    </button>
  );
}

export function Toggle(p: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      class={'toggle' + (p.value ? ' on' : '')}
      role="switch"
      aria-checked={p.value}
      aria-label={p.label}
      onClick={() => {
        sfx.click();
        p.onChange(!p.value);
      }}
    />
  );
}

export function Slider(p: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; label?: string }) {
  const min = p.min ?? 0,
    max = p.max ?? 1;
  const pct = ((p.value - min) / (max - min)) * 100;
  return (
    <input
      class="slider"
      type="range"
      aria-label={p.label}
      min={min}
      max={max}
      step={p.step ?? 0.05}
      value={p.value}
      style={{ '--p': pct + '%' } as any}
      onInput={(e) => p.onChange(parseFloat((e.target as HTMLInputElement).value))}
      onChange={() => sfx.tick()}
    />
  );
}

export function Seg<T extends string | number>(p: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="radiogroup">
      {p.options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={o.v === p.value}
          class={o.v === p.value ? 'on' : ''}
          onClick={() => {
            sfx.click();
            p.onChange(o.v);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar(p: { value: number; kind?: '' | 'cool' | 'green'; style?: JSX.CSSProperties }) {
  return (
    <div class={'bar ' + (p.kind ?? '')} style={p.style}>
      <i style={{ width: Math.max(0, Math.min(1, p.value)) * 100 + '%' }} />
    </div>
  );
}

export function Bunting({ n = 18 }: { n?: number }) {
  return (
    <div class="bunting" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function Currency({ value }: { value?: number }) {
  const v = value ?? profile.value.sparks;
  return (
    <span class="currency" title="Faíscas — ganhas jogando">
      {Icon.coin({ size: 20 })}
      {v.toLocaleString('pt-BR')}
    </span>
  );
}

export function BackBar(p: { title: string; kicker?: string; right?: ComponentChildren; onBack?: () => void }) {
  return (
    <div class="topbar">
      <Btn
        kind="ghost"
        title="Voltar"
        icon={Icon.back({ size: 22 })}
        silent
        onClick={() => {
          sfx.back();
          (p.onBack ?? (() => navBack()))();
        }}
      />
      <div class="col" style={{ gap: '2px' }}>
        {p.kicker && <span class="kicker">{p.kicker}</span>}
        <h1 class="h2">{p.title}</h1>
      </div>
      <div class="spacer" />
      {p.right}
    </div>
  );
}

/** Retrato animado de personagem em canvas. */
export function CharPortrait(p: { char: CharId; skin?: string; size?: number; dir?: number; moving?: boolean; emote?: 'win' | 'sad' | 'cheer' | null; pedestal?: boolean; still?: boolean; class?: string; style?: JSX.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = p.size ?? 120;
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now() + Math.random() * 3000;
    const skinCols = p.skin && SKINS[p.skin]?.char === p.char ? SKINS[p.skin].colors : undefined;
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const S = size * 0.62;
      if (p.pedestal) {
        const g = ctx.createRadialGradient(size / 2, size * 0.86, 0, size / 2, size * 0.86, size * 0.42);
        g.addColorStop(0, 'rgba(255,190,110,0.45)');
        g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(20,8,30,0.55)';
        ctx.beginPath();
        ctx.ellipse(size / 2, size * 0.86, size * 0.3, size * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCharacter(ctx, size / 2, size * 0.86, S, { char: p.char, dir: p.dir ?? 2, t, moving: !!p.moving, colors: skinCols, emote: p.emote ?? null });
      if (!p.still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [p.char, p.skin, size, p.dir, p.moving, p.emote, p.pedestal]);
  return <canvas ref={ref} class={p.class} style={{ width: size + 'px', height: size + 'px', ...(p.style ?? {}) }} aria-label={CHARACTERS[p.char].name} />;
}

/** Ícone de item/carga desenhado em canvas (usado na UI). */
export function ItemBadge({ item, size = 36 }: { item: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const c = cv.getContext('2d')!;
    c.scale(dpr, dpr);
    const [dark, light] = ITEM_COLORS[item] ?? ['#333', '#999'];
    const g = c.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    rr(c, 2, 2, size - 4, size - 4, size * 0.26);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 2;
    c.stroke();
    drawItemIcon(c, item, size / 2, size / 2, size - 4);
  }, [item, size]);
  return <canvas ref={ref} style={{ width: size + 'px', height: size + 'px', flex: 'none' }} />;
}

export function BombPreview({ skin, size = 64 }: { skin: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const c = cv.getContext('2d')!;
    let raf = 0;
    const draw = (now: number) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      drawBomb(c, size / 2, size * 0.52, size * 0.95, { kind: 0, skin, t: now / 1000, fuseFrac: 0.15, frozen: false, showRing: false });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [skin, size]);
  return <canvas ref={ref} style={{ width: size + 'px', height: size + 'px' }} />;
}

export function ToastHost() {
  const list = toasts.value;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={'toast ' + t.kind}>
          <span style={{ fontSize: '1.3rem' }}>{t.icon ?? (t.kind === 'reward' ? '✦' : t.kind === 'error' ? '!' : t.kind === 'ok' ? '✓' : '•')}</span>
          <div>
            {t.text}
            {t.sub && <small>{t.sub}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModalHost() {
  const m = modal.value;
  if (!m) return null;
  const close = () => (modal.value = null);
  return (
    <div class="overlay" onClick={(e) => m.dismissable && e.target === e.currentTarget && (m.actions[0]?.onClick?.(), close())}>
      <div class="panel modal col" role="dialog" aria-modal="true" aria-label={m.title}>
        <h2 class="h2">{m.title}</h2>
        {m.body && <p class="muted">{m.body}</p>}
        <div class="row" style={{ justifyContent: 'flex-end', marginTop: '6px', flexWrap: 'wrap' }}>
          {m.actions.map((a, i) => (
            <Btn
              key={i}
              kind={a.kind === 'primary' ? 'fire' : a.kind === 'danger' ? 'danger' : 'ghost'}
              autofocus={i === m.actions.length - 1}
              onClick={() => {
                close();
                a.onClick?.();
              }}
            >
              {a.label}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Stars({ stars, size = 18 }: { stars: boolean[]; size?: number }) {
  return (
    <span class="row" style={{ gap: '2px' }} aria-label={`${stars.filter(Boolean).length} de 3 estrelas`}>
      {stars.map((s, i) => (
        <span key={i} style={{ color: s ? '#ffcf3d' : 'rgba(255,255,255,.2)' }}>
          {s ? Icon.starFill({ size }) : Icon.star({ size })}
        </span>
      ))}
    </span>
  );
}
