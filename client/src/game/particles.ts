import { circle, rr, star, type Ctx } from '../art/draw';

export type PType = 'spark' | 'smoke' | 'debris' | 'ember' | 'ring' | 'text' | 'confetti' | 'star' | 'snow' | 'note' | 'shard' | 'dust' | 'glow';

export interface Particle {
  t: PType;
  x: number; // em tiles
  y: number;
  z: number; // altura em tiles
  vx: number;
  vy: number;
  vz: number;
  g: number; // gravidade em z
  drag: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  color2?: string;
  rot: number;
  vr: number;
  text?: string;
  add: boolean;
}

export class Particles {
  list: Particle[] = [];
  max = 900;
  quality = 1; // 0.3..1 multiplicador de quantidade

  spawn(p: Partial<Particle> & { t: PType; x: number; y: number }) {
    if (this.list.length >= this.max) this.list.shift();
    const q: Particle = {
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      g: 0,
      drag: 0,
      life: 0,
      max: 0.6,
      size: 0.1,
      grow: 0,
      color: '#fff',
      rot: 0,
      vr: 0,
      add: false,
      ...p,
    };
    q.life = q.max;
    this.list.push(q);
    return q;
  }

  count(n: number) {
    return Math.max(1, Math.round(n * this.quality));
  }

  update(dt: number) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.pow(1 - Math.min(0.99, p.drag), dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.g || p.vz) {
        p.vz -= p.g * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          if (p.t === 'debris' || p.t === 'confetti' || p.t === 'shard') {
            p.vz = -p.vz * 0.35;
            p.vx *= 0.6;
            p.vy *= 0.6;
            p.vr *= 0.5;
          } else p.vz = 0;
        }
      }
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      L[w++] = p;
    }
    L.length = w;
  }

  draw(c: Ctx, S: number, layer: 'normal' | 'add') {
    for (const p of this.list) {
      if (p.add !== (layer === 'add')) continue;
      const k = p.life / p.max;
      const px = p.x * S,
        py = (p.y - p.z) * S;
      const sz = Math.max(0.1, p.size * S);
      switch (p.t) {
        case 'spark': {
          c.globalAlpha = Math.min(1, k * 1.5);
          c.strokeStyle = p.color;
          c.lineWidth = Math.max(1, sz * 0.5);
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px - p.vx * S * 0.03, py - (p.vy - p.vz) * S * 0.03);
          c.stroke();
          break;
        }
        case 'glow': {
          c.globalAlpha = k;
          const g = c.createRadialGradient(px, py, 0, px, py, sz);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          circle(c, px, py, sz);
          c.fill();
          break;
        }
        case 'ember':
        case 'dust':
        case 'smoke': {
          c.globalAlpha = p.t === 'smoke' ? k * 0.55 : p.t === 'dust' ? k * 0.6 : k;
          c.fillStyle = p.color;
          circle(c, px, py, sz);
          c.fill();
          break;
        }
        case 'debris':
        case 'shard': {
          c.globalAlpha = Math.min(1, k * 3);
          c.save();
          c.translate(px, py);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          if (p.t === 'shard') {
            c.beginPath();
            c.moveTo(0, -sz);
            c.lineTo(sz * 0.5, 0);
            c.lineTo(0, sz);
            c.lineTo(-sz * 0.5, 0);
            c.closePath();
            c.fill();
          } else c.fillRect(-sz / 2, -sz / 2, sz, sz * 0.8);
          c.restore();
          // sombra no chão
          if (p.z > 0.05) {
            c.globalAlpha = Math.min(1, k * 3) * 0.25;
            c.fillStyle = '#000';
            circle(c, px, p.y * S, sz * 0.5);
            c.fill();
          }
          break;
        }
        case 'confetti': {
          c.globalAlpha = Math.min(1, k * 2);
          c.save();
          c.translate(px, py);
          c.rotate(p.rot);
          c.scale(1, Math.cos(p.rot * 2));
          c.fillStyle = p.color;
          c.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
          c.restore();
          break;
        }
        case 'ring': {
          c.globalAlpha = k;
          c.strokeStyle = p.color;
          c.lineWidth = Math.max(1, S * 0.08 * k);
          circle(c, px, py, sz);
          c.stroke();
          break;
        }
        case 'star': {
          c.globalAlpha = Math.min(1, k * 2);
          c.fillStyle = p.color;
          star(c, px, py, sz, sz * 0.45, 4, p.rot);
          c.fill();
          break;
        }
        case 'snow': {
          c.globalAlpha = k;
          c.fillStyle = p.color;
          circle(c, px, py, sz);
          c.fill();
          break;
        }
        case 'note': {
          c.globalAlpha = Math.min(1, k * 2);
          c.fillStyle = p.color;
          c.font = `900 ${sz * 2}px system-ui`;
          c.textAlign = 'center';
          c.fillText(p.text ?? '♪', px, py);
          break;
        }
        case 'text': {
          const a = Math.min(1, k * 2.5);
          c.globalAlpha = a;
          const pop = 1 + Math.max(0, (k - 0.85) * 3);
          c.font = `900 ${sz * pop}px "Bungee", system-ui`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.lineWidth = Math.max(2, sz * 0.22);
          c.strokeStyle = 'rgba(20,8,30,0.9)';
          c.strokeText(p.text ?? '', px, py);
          c.fillStyle = p.color;
          c.fillText(p.text ?? '', px, py);
          break;
        }
      }
    }
    c.globalAlpha = 1;
  }
}

export function rrPath(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  rr(c, x, y, w, h, r);
}
