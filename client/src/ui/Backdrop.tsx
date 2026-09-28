import { useEffect, useRef } from 'preact/hooks';
import { effectiveQuality, settings } from '../state/settings';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  trail?: boolean;
}

const FW_COLORS = ['#ffd166', '#ff7a2f', '#ff4d6d', '#4cc9f0', '#8ac926', '#f7f1e3', '#b69cff'];

/** Cenário animado dos menus: noite de festa na Vila Pavio. */
export function Backdrop({ variant = 'night', intensity = 1 }: { variant?: 'night' | 'dusk' | 'dark'; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let W = 0,
      H = 0,
      raf = 0,
      last = performance.now();
    const q = effectiveQuality();
    const scale = q === 0 ? 0.6 : q === 1 ? 0.8 : Math.min(1.25, window.devicePixelRatio || 1);
    const resize = () => {
      W = Math.round(cv.clientWidth * scale);
      H = Math.round(cv.clientHeight * scale);
      cv.width = W;
      cv.height = H;
      buildCity();
    };
    let stars: { x: number; y: number; r: number; p: number }[] = [];
    let roofsFar: number[][] = [];
    let roofsNear: number[][] = [];
    let windows: { x: number; y: number; w: number; h: number; on: number }[] = [];
    const buildCity = () => {
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.6, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
      roofsFar = [];
      let x = -20;
      while (x < W + 40) {
        const w = 40 + Math.random() * 70;
        const h = H * (0.12 + Math.random() * 0.1);
        roofsFar.push([x, w, h, Math.random() < 0.5 ? 1 : 0]);
        x += w - 4;
      }
      roofsNear = [];
      windows = [];
      x = -30;
      while (x < W + 60) {
        const w = 70 + Math.random() * 110;
        const h = H * (0.08 + Math.random() * 0.1);
        roofsNear.push([x, w, h, Math.random() < 0.6 ? 1 : 0]);
        const nw = Math.floor(w / 28);
        for (let k = 0; k < nw; k++) if (Math.random() < 0.6) windows.push({ x: x + 12 + k * 26, y: H - h + h * 0.35, w: 10, h: 13, on: Math.random() });
        x += w - 6;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const sparks: Spark[] = [];
    const embers: Spark[] = [];
    let nextFw = 0.6;
    const reduced = settings.value.reducedMotion;
    const launch = () => {
      const x = W * (0.1 + Math.random() * 0.8);
      sparks.push({ x, y: H * 0.85, vx: (Math.random() - 0.5) * 30 * scale, vy: -(H * (0.55 + Math.random() * 0.25)), life: 1.1, max: 1.1, col: '#fff3c4', trail: true });
    };
    const burst = (x: number, y: number) => {
      const col = FW_COLORS[(Math.random() * FW_COLORS.length) | 0];
      const col2 = FW_COLORS[(Math.random() * FW_COLORS.length) | 0];
      const n = q === 0 ? 30 : 60;
      const sp = (90 + Math.random() * 90) * scale;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.1;
        const s = sp * (0.7 + Math.random() * 0.3);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4 + Math.random() * 0.6, max: 2, col: k % 3 ? col : col2 });
      }
      flash = Math.min(1, flash + 0.5);
      flashX = x;
      flashY = y;
    };
    let flash = 0,
      flashX = 0,
      flashY = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      // céu
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      if (variant === 'dark') {
        sky.addColorStop(0, '#0c0618');
        sky.addColorStop(1, '#1a0d2e');
      } else {
        sky.addColorStop(0, '#120725');
        sky.addColorStop(0.55, '#2d1250');
        sky.addColorStop(0.85, variant === 'dusk' ? '#7a2a4a' : '#5a1f55');
        sky.addColorStop(1, '#2a1030');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // brilho do horizonte
      const hg = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.8);
      hg.addColorStop(0, 'rgba(255,140,60,0.35)');
      hg.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);
      // estrelas
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.5 + s.p);
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      // clarão dos fogos
      if (flash > 0) {
        const fg = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, H * 0.7);
        fg.addColorStop(0, `rgba(255,220,170,${0.18 * flash})`);
        fg.addColorStop(1, 'rgba(255,220,170,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
        flash = Math.max(0, flash - dt * 1.6);
      }
      // fogos
      if (!reduced && intensity > 0) {
        nextFw -= dt;
        if (nextFw <= 0) {
          launch();
          nextFw = (1.2 + Math.random() * 1.8) / intensity;
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k];
        s.life -= dt;
        if (s.trail) {
          s.vy += H * 0.55 * dt;
          if (s.vy > -H * 0.08 || s.life <= 0) {
            burst(s.x, s.y);
            sparks.splice(k, 1);
            continue;
          }
        } else {
          s.vx *= Math.pow(0.4, dt);
          s.vy = s.vy * Math.pow(0.4, dt) + 60 * scale * dt;
        }
        if (s.life <= 0) {
          sparks.splice(k, 1);
          continue;
        }
        const px = s.x,
          py = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = s.trail ? 1 : Math.min(1, s.life / 0.8);
        ctx.strokeStyle = s.col;
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 30 + k));
        ctx.lineWidth = s.trail ? 2.4 * scale : 2 * scale;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // cidade distante
      ctx.fillStyle = '#1d0d33';
      for (const [x, w, h, peak] of roofsFar) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x, H * 0.82 - h);
        if (peak) ctx.lineTo(x + w / 2, H * 0.82 - h - 18 * scale);
        ctx.lineTo(x + w, H * 0.82 - h);
        ctx.lineTo(x + w, H);
        ctx.fill();
      }
      // varal de bandeirinhas
      const cols = ['#ff4d6d', '#ffd166', '#4cc9f0', '#8ac926', '#ff7a2f'];
      for (let line = 0; line < 2; line++) {
        const y0 = H * (0.08 + line * 0.07);
        const sag = H * 0.05;
        ctx.strokeStyle = 'rgba(255,230,200,0.25)';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 10) {
          const y = y0 + Math.sin((x / W) * Math.PI) * sag;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        const n = Math.floor(W / (34 * scale));
        for (let k = 0; k < n; k++) {
          const x = (k + 0.5) * (W / n) + (line ? 12 : 0) * scale;
          const y = y0 + Math.sin((x / W) * Math.PI) * sag;
          const sw = reduced ? 0 : Math.sin(t * 2 + k * 0.7 + line) * 0.12;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(sw);
          ctx.fillStyle = cols[(k + line * 2) % cols.length];
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(-8 * scale, 0);
          ctx.lineTo(8 * scale, 0);
          ctx.lineTo(0, 16 * scale);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      // brasas subindo
      if (embers.length < (q === 0 ? 12 : 30) && Math.random() < 0.3) embers.push({ x: Math.random() * W, y: H + 5, vx: (Math.random() - 0.5) * 10, vy: -(20 + Math.random() * 30) * scale, life: 6, max: 6, col: Math.random() < 0.5 ? '#ffb347' : '#ffd166' });
      ctx.globalCompositeOperation = 'lighter';
      for (let k = embers.length - 1; k >= 0; k--) {
        const e = embers[k];
        e.life -= dt;
        e.x += (e.vx + Math.sin(t * 2 + k) * 8) * dt;
        e.y += e.vy * dt;
        if (e.life <= 0 || e.y < -10) {
          embers.splice(k, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, e.life / 2) * 0.8;
        ctx.fillStyle = e.col;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 1.6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // telhados próximos
      for (const [x, w, h, peak] of roofsNear) {
        ctx.fillStyle = '#12071f';
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x, H - h);
        if (peak) ctx.lineTo(x + w / 2, H - h - 26 * scale);
        ctx.lineTo(x + w, H - h);
        ctx.lineTo(x + w, H);
        ctx.fill();
      }
      for (const wdw of windows) {
        const on = 0.5 + 0.5 * Math.sin(t * 0.3 + wdw.on * 20);
        ctx.fillStyle = `rgba(255,${190 + wdw.on * 40},${100 + wdw.on * 60},${0.35 + on * 0.5})`;
        ctx.fillRect(wdw.x, wdw.y, wdw.w * scale, wdw.h * scale);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant, intensity]);
  return <canvas ref={ref} class="backdrop" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
}
