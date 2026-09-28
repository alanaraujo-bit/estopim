import type { Enemy, Game } from '@estopim/shared';
import { circle, ellipse, rr, shade, star, withAlpha, type Ctx } from './draw';
import { drawBoss } from './bosses';

/** Desenha um inimigo com os pés em (x, y). */
export function drawEnemy(c: Ctx, x: number, y: number, S: number, e: Enemy, t: number, g: Game) {
  if (!e.alive) {
    if (e.deadT > 40) return;
    const k = e.deadT / 40;
    c.save();
    c.globalAlpha = 1 - k;
    c.translate(x, y);
    c.scale(1 + k * 0.4, 1 - k * 0.6);
    c.translate(-x, -y);
    drawEnemyBody(c, x, y, S, e, t, g);
    c.restore();
    return;
  }
  c.save();
  if (e.spawnT > 0) {
    const k = 1 - e.spawnT / 30;
    c.globalAlpha = Math.max(0, Math.min(1, k));
    // portal de chegada
    c.strokeStyle = 'rgba(180,90,255,0.8)';
    c.lineWidth = S * 0.05;
    ellipse(c, x, y, S * 0.4 * (1.2 - k * 0.4), S * 0.14);
    c.stroke();
  }
  const flash = e.invuln > 0 && Math.floor(t * 20) % 2 === 0;
  drawEnemyBody(c, x, y, S, e, t, g);
  if (flash) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(x - S * e.size, y - S * 1.6 * e.size, S * 2 * e.size, S * 2 * e.size);
    c.globalCompositeOperation = 'source-over';
  }
  if (e.stunT > 0) {
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + (k * Math.PI * 2) / 3;
      c.fillStyle = '#fff3a0';
      star(c, x + Math.cos(a) * S * 0.28, y - S * 0.95 * e.size + Math.sin(a) * S * 0.08, S * 0.07, S * 0.03, 5);
      c.fill();
    }
  }
  // barra de vida para inimigos com mais de 1 de vida (não-chefes)
  if (!e.boss && e.maxHp > 1 && e.hp < e.maxHp) {
    const w = S * 0.6;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    rr(c, x - w / 2, y - S * 1.12, w, S * 0.08, S * 0.04);
    c.fill();
    c.fillStyle = '#ff5d5d';
    rr(c, x - w / 2, y - S * 1.12, (w * e.hp) / e.maxHp, S * 0.08, S * 0.04);
    c.fill();
  }
  c.restore();
}

function eye(c: Ctx, x: number, y: number, r: number, col: string, glow = true) {
  if (glow) {
    c.shadowColor = col;
    c.shadowBlur = r * 3;
  }
  c.fillStyle = col;
  circle(c, x, y, r);
  c.fill();
  c.shadowBlur = 0;
}

function drawEnemyBody(c: Ctx, x: number, y: number, S: number, e: Enemy, t: number, g: Game) {
  const dir = e.dir;
  const side = dir === 1 || dir === 3;
  const fx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
  const fy = dir === 2 ? 1 : dir === 0 ? -1 : 0;
  const moving = e.state !== 99;
  const bob = Math.abs(Math.sin(t * 9 + e.id)) * S * 0.03;
  if (e.boss) {
    drawBoss(c, x, y, S, e, t, g);
    return;
  }
  // sombra
  c.fillStyle = 'rgba(0,0,0,0.3)';
  ellipse(c, x, y, S * 0.32, S * 0.1);
  c.fill();
  switch (e.type) {
    case 'rastejo': {
      // besouro enferrujado
      const by = y - S * 0.22 - bob;
      c.strokeStyle = '#2b1a12';
      c.lineWidth = S * 0.035;
      for (let k = -1; k <= 1; k++) {
        const w = Math.sin(t * 16 + k) * S * 0.04;
        c.beginPath();
        c.moveTo(x - S * 0.2, by + k * S * 0.08);
        c.lineTo(x - S * 0.36, by + k * S * 0.1 + S * 0.12 + w);
        c.moveTo(x + S * 0.2, by + k * S * 0.08);
        c.lineTo(x + S * 0.36, by + k * S * 0.1 + S * 0.12 - w);
        c.stroke();
      }
      const gr = c.createLinearGradient(0, by - S * 0.25, 0, by + S * 0.2);
      gr.addColorStop(0, '#c0764a');
      gr.addColorStop(1, '#6a3b22');
      c.fillStyle = gr;
      ellipse(c, x, by, S * 0.3, S * 0.24);
      c.fill();
      c.strokeStyle = '#3b2216';
      c.lineWidth = S * 0.025;
      c.beginPath();
      c.moveTo(x, by - S * 0.24);
      c.lineTo(x, by + S * 0.24);
      c.stroke();
      eye(c, x + fx * S * 0.18 - S * 0.07, by + fy * S * 0.1 - S * 0.02, S * 0.045, '#ff5a3d');
      eye(c, x + fx * S * 0.18 + S * 0.07, by + fy * S * 0.1 - S * 0.02, S * 0.045, '#ff5a3d');
      break;
    }
    case 'farejador': {
      // cão-robô
      const by = y - S * 0.3 - bob * 2;
      c.fillStyle = '#3d4250';
      const legT = Math.sin(t * 18 + e.id) * S * 0.06;
      for (const [lx, ph] of [
        [-0.18, 1],
        [0.18, -1],
      ]) {
        rr(c, x + lx * S - S * 0.04, by + S * 0.08 + legT * ph, S * 0.08, S * 0.2, S * 0.03);
        c.fill();
      }
      const gr = c.createLinearGradient(0, by - S * 0.2, 0, by + S * 0.15);
      gr.addColorStop(0, '#8a93a6');
      gr.addColorStop(1, '#4a5162');
      c.fillStyle = gr;
      rr(c, x - S * 0.3, by - S * 0.14, S * 0.6, S * 0.28, S * 0.12);
      c.fill();
      // cabeça
      const hx = x + (side ? fx * S * 0.28 : 0),
        hy = by - S * 0.16 + (dir === 2 ? S * 0.06 : 0);
      c.fillStyle = '#6a7386';
      rr(c, hx - S * 0.17, hy - S * 0.14, S * 0.34, S * 0.26, S * 0.1);
      c.fill();
      c.fillStyle = '#2b2f3a';
      c.beginPath();
      c.moveTo(hx - S * 0.14, hy - S * 0.12);
      c.lineTo(hx - S * 0.2, hy - S * 0.3);
      c.lineTo(hx - S * 0.04, hy - S * 0.14);
      c.moveTo(hx + S * 0.14, hy - S * 0.12);
      c.lineTo(hx + S * 0.2, hy - S * 0.3);
      c.lineTo(hx + S * 0.04, hy - S * 0.14);
      c.fill();
      if (dir !== 0) eye(c, hx + fx * S * 0.05, hy - S * 0.02, S * 0.06, e.state === 2 ? '#ff2a2a' : '#ffb347');
      break;
    }
    case 'minador': {
      const by = y - S * 0.34 - bob;
      c.fillStyle = '#4b3a2a';
      rr(c, x - S * 0.22, by - S * 0.05, S * 0.44, S * 0.36, S * 0.12);
      c.fill();
      c.fillStyle = '#e8b04a';
      c.beginPath();
      c.arc(x, by - S * 0.08, S * 0.24, Math.PI, 0);
      c.fill();
      c.fillRect(x - S * 0.28, by - S * 0.1, S * 0.56, S * 0.05);
      // lanterna
      eye(c, x + fx * S * 0.1, by - S * 0.22, S * 0.06, '#fff7c2');
      c.fillStyle = '#1b1410';
      rr(c, x - S * 0.16, by - S * 0.05, S * 0.32, S * 0.12, S * 0.05);
      c.fill();
      eye(c, x - S * 0.07 + fx * S * 0.04, by + 0.01 * S, S * 0.03, '#ff8a3d');
      eye(c, x + S * 0.07 + fx * S * 0.04, by + 0.01 * S, S * 0.03, '#ff8a3d');
      // mochila de cargas
      c.fillStyle = '#2a2440';
      circle(c, x - fx * S * 0.2 + (side ? 0 : S * 0.22), by + S * 0.12, S * 0.1);
      c.fill();
      break;
    }
    case 'bastiao': {
      const by = y - S * 0.36 - bob * 0.5;
      c.fillStyle = '#5a4a3a';
      rr(c, x - S * 0.3, by - S * 0.2, S * 0.6, S * 0.5, S * 0.14);
      c.fill();
      c.fillStyle = '#7a6a5a';
      rr(c, x - S * 0.2, by - S * 0.38, S * 0.4, S * 0.25, S * 0.1);
      c.fill();
      eye(c, x + fx * S * 0.08, by - S * 0.26, S * 0.05, '#ff5a3d');
      // escudo frontal (grande, lado da direção)
      c.save();
      c.translate(x + fx * S * 0.3, by + fy * S * 0.18 + S * 0.05);
      const sw = side ? S * 0.12 : S * 0.7;
      const sh = side ? S * 0.62 : S * 0.2;
      if (dir !== 0) {
        const gs = c.createLinearGradient(-sw / 2, 0, sw / 2, 0);
        gs.addColorStop(0, '#9aa7b8');
        gs.addColorStop(0.5, '#e6edf5');
        gs.addColorStop(1, '#6a7386');
        c.fillStyle = gs;
        rr(c, -sw / 2, -sh / 2 - (side ? S * 0.1 : 0), sw, sh + (side ? 0 : S * 0.25), S * 0.06);
        c.fill();
        c.strokeStyle = '#ffcf3d';
        c.lineWidth = S * 0.03;
        c.stroke();
      }
      c.restore();
      if (dir === 0) {
        c.fillStyle = '#9aa7b8';
        rr(c, x - S * 0.35, by - S * 0.45, S * 0.7, S * 0.15, S * 0.05);
        c.fill();
      }
      break;
    }
    case 'acolito': {
      const by = y - S * 0.3 - Math.sin(t * 3 + e.id) * S * 0.04;
      c.fillStyle = '#9fc3dc';
      c.beginPath();
      c.moveTo(x - S * 0.28, y - S * 0.04);
      c.quadraticCurveTo(x - S * 0.3, by - S * 0.3, x, by - S * 0.55);
      c.quadraticCurveTo(x + S * 0.3, by - S * 0.3, x + S * 0.28, y - S * 0.04);
      c.closePath();
      c.fill();
      c.fillStyle = '#1b3a4b';
      ellipse(c, x + fx * S * 0.04, by - S * 0.2, S * 0.14, S * 0.12);
      c.fill();
      if (dir !== 0) {
        eye(c, x - S * 0.05 + fx * S * 0.05, by - S * 0.2, S * 0.03, '#bfe9ff');
        eye(c, x + S * 0.05 + fx * S * 0.05, by - S * 0.2, S * 0.03, '#bfe9ff');
      }
      // cristal carregando
      const charge = e.tele;
      c.fillStyle = withAlpha('#bfe9ff', 0.5 + charge * 0.5);
      c.shadowColor = '#bfe9ff';
      c.shadowBlur = S * 0.2 * (0.3 + charge);
      star(c, x + fx * S * 0.3 + (side ? 0 : S * 0.25), by + S * 0.02, S * (0.08 + charge * 0.07), S * 0.03, 4);
      c.fill();
      c.shadowBlur = 0;
      break;
    }
    case 'sentinela': {
      const by = y - S * 0.4;
      c.strokeStyle = '#3a3f4a';
      c.lineWidth = S * 0.05;
      c.beginPath();
      c.moveTo(x, by);
      c.lineTo(x - S * 0.25, y - S * 0.02);
      c.moveTo(x, by);
      c.lineTo(x + S * 0.25, y - S * 0.02);
      c.moveTo(x, by);
      c.lineTo(x, y);
      c.stroke();
      c.fillStyle = '#5a6272';
      circle(c, x, by, S * 0.24);
      c.fill();
      const lens = e.tele > 0 ? '#ff2a5a' : '#ffcf3d';
      eye(c, x + fx * S * 0.12, by + fy * S * 0.08, S * (0.08 + e.tele * 0.04), lens);
      break;
    }
    case 'esporo': {
      const pul = 1 + Math.sin(t * 5 + e.id) * 0.08;
      const r = S * (e.data[0] ? 0.18 : 0.28) * pul;
      const by = y - r - bob;
      const gr = c.createRadialGradient(x - r * 0.3, by - r * 0.3, r * 0.1, x, by, r);
      gr.addColorStop(0, '#d9ff8a');
      gr.addColorStop(1, '#4f9a2a');
      c.fillStyle = gr;
      circle(c, x, by, r);
      c.fill();
      c.fillStyle = '#a8ff5a';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + t;
        circle(c, x + Math.cos(a) * r * 0.9, by + Math.sin(a) * r * 0.9, r * 0.15);
        c.fill();
      }
      c.fillStyle = '#1b2a10';
      circle(c, x - r * 0.3 + fx * r * 0.2, by - r * 0.1, r * 0.13);
      c.fill();
      circle(c, x + r * 0.3 + fx * r * 0.2, by - r * 0.1, r * 0.13);
      c.fill();
      break;
    }
    case 'vigia': {
      const hidden = e.state === 0;
      if (hidden) {
        // disfarçado de bloco (sutil diferença: olhos piscando às vezes)
        const art = g.map.biome;
        void art;
        c.fillStyle = '#8f9277';
        rr(c, x - S * 0.45, y - S * 0.85, S * 0.9, S * 0.9, S * 0.12);
        c.fill();
        c.fillStyle = '#5d604a';
        rr(c, x - S * 0.45, y - S * 0.35, S * 0.9, S * 0.38, S * 0.12);
        c.fill();
        if ((t + e.id) % 4 < 0.25) {
          eye(c, x - S * 0.12, y - S * 0.45, S * 0.035, '#ff3a3a');
          eye(c, x + S * 0.12, y - S * 0.45, S * 0.035, '#ff3a3a');
        }
      } else {
        const by = y - S * 0.35 - bob;
        c.fillStyle = '#6a6e55';
        rr(c, x - S * 0.3, by - S * 0.25, S * 0.6, S * 0.55, S * 0.2);
        c.fill();
        c.fillStyle = '#2b2e20';
        c.beginPath();
        c.arc(x + fx * S * 0.05, by + S * 0.05, S * 0.18, 0, Math.PI);
        c.fill();
        c.fillStyle = '#ffffff';
        for (let k = -2; k <= 2; k++) {
          c.beginPath();
          c.moveTo(x + k * S * 0.07 - S * 0.03, by + S * 0.05);
          c.lineTo(x + k * S * 0.07, by + S * 0.12);
          c.lineTo(x + k * S * 0.07 + S * 0.03, by + S * 0.05);
          c.fill();
        }
        eye(c, x - S * 0.12 + fx * S * 0.06, by - S * 0.1, S * 0.05, '#ff3a3a');
        eye(c, x + S * 0.12 + fx * S * 0.06, by - S * 0.1, S * 0.05, '#ff3a3a');
      }
      break;
    }
    case 'reparador': {
      const by = y - S * 0.6 - Math.sin(t * 4 + e.id) * S * 0.06;
      c.fillStyle = 'rgba(0,0,0,0.2)';
      ellipse(c, x, y, S * 0.2, S * 0.06);
      c.fill();
      c.fillStyle = '#e0e6ee';
      ellipse(c, x, by, S * 0.26, S * 0.18);
      c.fill();
      c.strokeStyle = '#6ef3ff';
      c.lineWidth = S * 0.025;
      const spin = t * 30;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(x + sx * S * 0.28, by - S * 0.12, S * 0.14 * Math.abs(Math.cos(spin)), S * 0.03, 0, 0, Math.PI * 2);
        c.stroke();
      }
      eye(c, x + fx * S * 0.08, by, S * 0.06, '#6ef3ff');
      // aura de suporte
      if (e.tele > 0) {
        c.strokeStyle = withAlpha('#6ef3ff', 0.4 * e.tele);
        c.lineWidth = S * 0.04;
        circle(c, x, y - S * 0.3, S * 1.5);
        c.stroke();
      }
      break;
    }
    case 'piscante': {
      const by = y - S * 0.45;
      const r = S * 0.22 * (1 + Math.sin(t * 8) * 0.1);
      const gr = c.createRadialGradient(x, by, 0, x, by, r * 1.6);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, '#c77dff');
      gr.addColorStop(1, 'rgba(90,24,154,0)');
      c.fillStyle = gr;
      circle(c, x, by, r * 1.6);
      c.fill();
      c.fillStyle = '#240046';
      circle(c, x + fx * r * 0.3, by, r * 0.35);
      c.fill();
      break;
    }
    case 'salamandra': {
      const by = y - S * 0.2 - bob;
      c.fillStyle = '#ff6b1a';
      ellipse(c, x, by, S * 0.32, S * 0.18);
      c.fill();
      c.fillStyle = '#ffd23f';
      for (let k = -1; k <= 1; k++) {
        circle(c, x + k * S * 0.12, by - S * 0.06, S * 0.04);
        c.fill();
      }
      c.fillStyle = '#b3261e';
      circle(c, x + (side ? fx : 0) * S * 0.3, by + (side ? 0 : fy * S * 0.12), S * 0.14);
      c.fill();
      eye(c, x + (side ? fx : 0) * S * 0.36, by - S * 0.03 + (side ? 0 : fy * S * 0.12), S * 0.035, '#fff');
      break;
    }
    default: {
      const by = y - S * 0.35;
      c.fillStyle = shade('#7a4bff', -0.1);
      circle(c, x, by, S * 0.28);
      c.fill();
      eye(c, x, by, S * 0.06, '#fff');
    }
  }
  void moving;
}
