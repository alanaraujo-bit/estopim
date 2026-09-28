import { B, CARTRIDGES, I } from '@estopim/shared';
import { circle, ellipse, rr, shade, star, withAlpha, type Ctx } from './draw';

export interface BombSkin {
  id: string;
  name: string;
  body: string;
  hi: string;
  band?: string;
  shape: 'sphere' | 'lantern' | 'cube' | 'star' | 'crystal' | 'drum' | 'fruit' | 'orb';
}

export const BOMB_SKINS: Record<string, BombSkin> = {
  classica: { id: 'classica', name: 'Clássica', body: '#2a2440', hi: '#6d63a0', shape: 'sphere' },
  lanterna: { id: 'lanterna', name: 'Lanterna Junina', body: '#e8413b', hi: '#ffd166', band: '#ffcf3d', shape: 'lantern' },
  cubo: { id: 'cubo', name: 'Cubo de Fundição', body: '#5a5f6b', hi: '#a0a7b5', band: '#ff7a1a', shape: 'cube' },
  estrela: { id: 'estrela', name: 'Estrela Cadente', body: '#3a2a7a', hi: '#b69cff', band: '#ffd166', shape: 'star' },
  cristal: { id: 'cristal', name: 'Cristal Boreal', body: '#6ec6f0', hi: '#e8fbff', shape: 'crystal' },
  zabumba: { id: 'zabumba', name: 'Zabumba', body: '#f3e3c3', hi: '#ffffff', band: '#c0392b', shape: 'drum' },
  caju: { id: 'caju', name: 'Caju', body: '#ff9f1c', hi: '#ffd166', band: '#6b3f1d', shape: 'fruit' },
  orbe: { id: 'orbe', name: 'Orbe Neon', body: '#12081f', hi: '#ff3cac', band: '#3cf2ff', shape: 'orb' },
};

export interface BombDrawOpts {
  kind: number;
  skin: string;
  t: number;
  fuseFrac: number; // 0 recém-colocada → 1 explodindo
  frozen: boolean;
  showRing: boolean;
  alpha?: number;
  z?: number;
  owner?: string; // cor do dono
}

export function drawBomb(c: Ctx, x: number, y: number, S: number, o: BombDrawOpts) {
  const skin = BOMB_SKINS[o.skin] ?? BOMB_SKINS.classica;
  const f = o.fuseFrac;
  const pulseRate = 3 + f * f * 22;
  const pulse = o.frozen ? 0 : Math.sin(o.t * pulseRate) * (0.03 + f * 0.07);
  const r = S * 0.3 * (1 + pulse);
  const lift = (o.z ?? 0) * S * 3;
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  // sombra
  c.fillStyle = `rgba(0,0,0,${0.3 * (1 - Math.min(1, (o.z ?? 0) * 1.2))})`;
  ellipse(c, x, y + S * 0.26, r * 0.95, r * 0.35);
  c.fill();
  c.translate(x, y - lift);

  // anel de contagem (legível sem depender de cor: é um arco que se fecha)
  if (o.showRing && o.kind !== B.Mine && o.kind !== B.Remote && !o.frozen) {
    c.lineWidth = Math.max(2, S * 0.05);
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(0, S * 0.02, S * 0.42, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = f > 0.75 ? '#ff4d3d' : f > 0.45 ? '#ffb020' : '#fff3d0';
    c.beginPath();
    c.arc(0, S * 0.02, S * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f));
    c.stroke();
  }

  const special = o.kind !== B.Normal && o.kind !== B.Barrel && o.kind !== B.Rain && o.kind !== B.Mini && o.kind !== B.Enemy;
  const cart = CARTRIDGES[o.kind];
  const body = special && cart ? shade(cart.color, -0.35) : o.kind === B.Enemy ? '#3a1414' : o.kind === B.Rain ? '#1e2a44' : skin.body;
  const hi = special && cart ? cart.color : o.kind === B.Enemy ? '#ff4d3d' : o.kind === B.Rain ? '#6ef3ff' : skin.hi;
  const rr2 = o.kind === B.Mini ? r * 0.65 : r;

  if (o.kind === B.Barrel || o.kind === B.Potato) {
    c.restore();
    return;
  }

  const shape = special || o.kind === B.Enemy || o.kind === B.Rain || o.kind === B.Mini ? 'sphere' : skin.shape;
  const g = c.createRadialGradient(-rr2 * 0.35, -rr2 * 0.4, rr2 * 0.1, 0, 0, rr2 * 1.1);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, shade(body, 0.1));
  g.addColorStop(1, shade(body, -0.35));
  c.fillStyle = g;
  switch (shape) {
    case 'sphere':
    case 'orb':
      circle(c, 0, 0, rr2);
      c.fill();
      break;
    case 'cube':
      rr(c, -rr2, -rr2, rr2 * 2, rr2 * 2, rr2 * 0.3);
      c.fill();
      break;
    case 'lantern':
      ellipse(c, 0, 0, rr2 * 0.9, rr2 * 1.05);
      c.fill();
      break;
    case 'star':
      star(c, 0, 0, rr2 * 1.2, rr2 * 0.65, 5);
      c.fill();
      break;
    case 'crystal':
      c.beginPath();
      c.moveTo(0, -rr2 * 1.2);
      c.lineTo(rr2 * 0.9, 0);
      c.lineTo(0, rr2 * 1.1);
      c.lineTo(-rr2 * 0.9, 0);
      c.closePath();
      c.fill();
      break;
    case 'drum':
      rr(c, -rr2, -rr2 * 0.8, rr2 * 2, rr2 * 1.6, rr2 * 0.3);
      c.fill();
      break;
    case 'fruit':
      ellipse(c, 0, rr2 * 0.1, rr2 * 0.95, rr2 * 0.9);
      c.fill();
      break;
  }
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = Math.max(1, S * 0.02);
  c.stroke();
  // detalhes do skin
  if (!special && skin.band && o.kind === B.Normal) {
    c.strokeStyle = skin.band;
    c.lineWidth = S * 0.04;
    c.beginPath();
    if (shape === 'lantern') {
      c.moveTo(-rr2 * 0.9, 0);
      c.lineTo(rr2 * 0.9, 0);
      c.moveTo(-rr2 * 0.5, -rr2 * 0.85);
      c.lineTo(-rr2 * 0.5, rr2 * 0.85);
      c.moveTo(rr2 * 0.5, -rr2 * 0.85);
      c.lineTo(rr2 * 0.5, rr2 * 0.85);
    } else if (shape === 'drum') {
      c.moveTo(-rr2, -rr2 * 0.45);
      c.lineTo(rr2, -rr2 * 0.45);
      c.moveTo(-rr2, rr2 * 0.45);
      c.lineTo(rr2, rr2 * 0.45);
    } else if (shape === 'cube') {
      c.moveTo(-rr2, 0);
      c.lineTo(rr2, 0);
    } else if (shape === 'fruit') {
      c.moveTo(0, -rr2 * 0.8);
      c.quadraticCurveTo(rr2 * 0.4, -rr2 * 1.3, rr2 * 0.2, -rr2 * 1.5);
    } else if (shape === 'orb') {
      c.arc(0, 0, rr2 * 0.6, 0, Math.PI * 2);
    }
    c.stroke();
  }
  // brilho
  c.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(c, -rr2 * 0.35, -rr2 * 0.42, rr2 * 0.24, rr2 * 0.14, -0.6);
  c.fill();
  // ícone do tipo especial (sinal independente de cor)
  if (special) drawKindGlyph(c, o.kind, rr2);

  // pavio
  if (o.kind !== B.Mine) {
    c.strokeStyle = '#6b4a2a';
    c.lineWidth = S * 0.04;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(rr2 * 0.3, -rr2 * 0.85);
    const len = S * 0.14 * (1 - f * 0.8);
    c.quadraticCurveTo(rr2 * 0.6, -rr2 * 1.2, rr2 * 0.4 + len * 0.5, -rr2 * 0.95 - len);
    c.stroke();
    if (!o.frozen) {
      const sx = rr2 * 0.4 + len * 0.5,
        sy = -rr2 * 0.95 - len;
      const fl = 0.7 + Math.sin(o.t * 40) * 0.3;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, S * 0.12 * fl);
      sg.addColorStop(0, 'rgba(255,255,220,1)');
      sg.addColorStop(0.35, 'rgba(255,200,60,0.9)');
      sg.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = sg;
      circle(c, sx, sy, S * 0.12 * fl);
      c.fill();
    }
  }
  if (o.frozen) {
    c.fillStyle = 'rgba(180,230,255,0.45)';
    rr(c, -rr2 * 1.15, -rr2 * 1.15, rr2 * 2.3, rr2 * 2.3, rr2 * 0.35);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = S * 0.025;
    c.stroke();
  }
  c.restore();
}

function drawKindGlyph(c: Ctx, kind: number, r: number) {
  c.save();
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineWidth = r * 0.16;
  c.lineCap = 'round';
  c.beginPath();
  const k = r * 0.45;
  switch (kind) {
    case B.Pierce:
      c.moveTo(-k, 0);
      c.lineTo(k, 0);
      c.moveTo(k * 0.4, -k * 0.5);
      c.lineTo(k, 0);
      c.lineTo(k * 0.4, k * 0.5);
      break;
    case B.Frag:
      c.moveTo(-k, -k);
      c.lineTo(k, k);
      c.moveTo(k, -k);
      c.lineTo(-k, k);
      break;
    case B.Mine:
      c.arc(0, 0, k * 0.6, 0, Math.PI * 2);
      break;
    case B.Pulse:
      c.arc(0, 0, k * 0.4, 0, Math.PI * 2);
      c.moveTo(k, 0);
      c.arc(0, 0, k, 0, Math.PI * 2);
      break;
    case B.Frost:
      for (let a = 0; a < 3; a++) {
        const ang = (a * Math.PI) / 3;
        c.moveTo(Math.cos(ang) * k, Math.sin(ang) * k);
        c.lineTo(-Math.cos(ang) * k, -Math.sin(ang) * k);
      }
      break;
    case B.Remote:
      c.arc(0, k * 0.3, k * 0.25, 0, Math.PI * 2);
      c.moveTo(-k * 0.7, -k * 0.2);
      c.quadraticCurveTo(0, -k * 0.9, k * 0.7, -k * 0.2);
      break;
    case B.Cluster:
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        c.moveTo(dx * k * 0.7 + k * 0.2, dy * k * 0.7);
        c.arc(dx * k * 0.7, dy * k * 0.7, k * 0.2, 0, Math.PI * 2);
      }
      break;
  }
  c.stroke();
  c.restore();
}

export const ITEM_COLORS: Record<number, [string, string]> = {
  [I.BombUp]: ['#3a2a7a', '#8f7bff'],
  [I.RangeUp]: ['#b3261e', '#ff7a4d'],
  [I.SpeedUp]: ['#0a7a5a', '#35e0a8'],
  [I.Kick]: ['#6b3f1d', '#e6a15a'],
  [I.Shield]: ['#1d4e89', '#6ec6ff'],
  [I.Cartridge]: ['#8a1c7c', '#ff6bd6'],
  [I.Curse]: ['#1a1a1a', '#8a2be2'],
  [I.RangeMax]: ['#b35c00', '#ffd23f'],
  [I.Fragment]: ['#0f5f7a', '#6ef3ff'],
  [I.Relic]: ['#7a5a00', '#ffe066'],
  [I.Heart]: ['#8a1030', '#ff5d8f'],
  [I.Spark]: ['#7a4a00', '#ffcf3d'],
};

/** Ícone de item (também usado na UI). */
export function drawItemIcon(c: Ctx, it: number, cx: number, cy: number, s: number) {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';
  c.lineWidth = s * 0.11;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const k = s * 0.32;
  switch (it) {
    case I.BombUp:
      circle(c, -k * 0.15, k * 0.15, k * 0.62);
      c.fill();
      c.beginPath();
      c.moveTo(k * 0.25, -k * 0.35);
      c.lineTo(k * 0.55, -k * 0.75);
      c.stroke();
      c.fillStyle = '#ffd166';
      circle(c, k * 0.6, -k * 0.8, k * 0.18);
      c.fill();
      break;
    case I.RangeUp:
      c.beginPath();
      c.moveTo(0, -k);
      c.bezierCurveTo(k * 0.9, -k * 0.2, k * 0.5, k, 0, k);
      c.bezierCurveTo(-k * 0.5, k, -k * 0.9, -k * 0.2, 0, -k);
      c.fill();
      c.fillStyle = '#ffd166';
      circle(c, 0, k * 0.35, k * 0.35);
      c.fill();
      break;
    case I.SpeedUp:
      c.beginPath();
      c.moveTo(-k * 0.8, -k * 0.7);
      c.lineTo(-k * 0.1, 0);
      c.lineTo(-k * 0.8, k * 0.7);
      c.moveTo(k * 0.0, -k * 0.7);
      c.lineTo(k * 0.7, 0);
      c.lineTo(k * 0.0, k * 0.7);
      c.stroke();
      break;
    case I.Kick:
      c.beginPath();
      c.moveTo(-k * 0.5, -k);
      c.lineTo(-k * 0.2, k * 0.3);
      c.lineTo(k * 0.8, k * 0.3);
      c.lineTo(k * 0.8, k * 0.8);
      c.lineTo(-k * 0.6, k * 0.8);
      c.closePath();
      c.fill();
      break;
    case I.Shield:
      c.beginPath();
      c.moveTo(0, -k);
      c.lineTo(k * 0.85, -k * 0.55);
      c.quadraticCurveTo(k * 0.8, k * 0.6, 0, k);
      c.quadraticCurveTo(-k * 0.8, k * 0.6, -k * 0.85, -k * 0.55);
      c.closePath();
      c.fill();
      break;
    case I.Cartridge:
      star(c, 0, 0, k, k * 0.42, 4, 0);
      c.fill();
      break;
    case I.Curse:
      circle(c, 0, -k * 0.15, k * 0.7);
      c.fill();
      c.fillRect(-k * 0.4, k * 0.3, k * 0.8, k * 0.55);
      c.fillStyle = '#1a1a1a';
      circle(c, -k * 0.28, -k * 0.2, k * 0.18);
      c.fill();
      circle(c, k * 0.28, -k * 0.2, k * 0.18);
      c.fill();
      break;
    case I.RangeMax:
      star(c, 0, 0, k * 1.05, k * 0.45, 8);
      c.fill();
      break;
    case I.Fragment:
      c.beginPath();
      c.moveTo(0, -k);
      c.lineTo(k * 0.65, 0);
      c.lineTo(0, k);
      c.lineTo(-k * 0.65, 0);
      c.closePath();
      c.fill();
      break;
    case I.Relic:
      star(c, 0, 0, k, k * 0.45, 5);
      c.fill();
      break;
    case I.Heart:
      c.beginPath();
      c.moveTo(0, k * 0.8);
      c.bezierCurveTo(-k * 1.2, -k * 0.1, -k * 0.5, -k * 1.0, 0, -k * 0.35);
      c.bezierCurveTo(k * 0.5, -k * 1.0, k * 1.2, -k * 0.1, 0, k * 0.8);
      c.fill();
      break;
    case I.Spark:
      circle(c, 0, 0, k * 0.7);
      c.fill();
      c.fillStyle = '#7a4a00';
      star(c, 0, 0, k * 0.45, k * 0.2, 4);
      c.fill();
      break;
  }
  c.restore();
}

export function drawItem(c: Ctx, x: number, y: number, S: number, it: number, t: number, alpha = 1) {
  const [dark, light] = ITEM_COLORS[it] ?? ['#333', '#999'];
  const bob = Math.sin(t * 3 + x * 0.1) * S * 0.04;
  const s = S * 0.62;
  c.save();
  c.globalAlpha *= alpha;
  c.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(c, x, y + S * 0.28, S * 0.26, S * 0.08);
  c.fill();
  // brilho
  const gl = c.createRadialGradient(x, y + bob, 0, x, y + bob, S * 0.55);
  gl.addColorStop(0, withAlpha(light.startsWith('#') ? light : '#ffffff', 0.35));
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl;
  circle(c, x, y + bob, S * 0.55);
  c.fill();
  const g = c.createLinearGradient(0, y - s / 2 + bob, 0, y + s / 2 + bob);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  c.fillStyle = g;
  rr(c, x - s / 2, y - s / 2 + bob, s, s, s * 0.28);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = Math.max(1.5, S * 0.035);
  c.stroke();
  drawItemIcon(c, it, x, y + bob, s);
  c.restore();
}
