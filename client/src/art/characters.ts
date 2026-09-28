import { CHARACTERS, type CharId } from '@estopim/shared';
import { circle, ellipse, rr, shade, star, withAlpha, type Ctx } from './draw';

export interface CharPose {
  char: CharId;
  dir: number; // 0 cima, 1 dir, 2 baixo, 3 esq
  t: number; // tempo em segundos
  moving: boolean;
  colors?: [string, string, string, string];
  alpha?: number;
  flash?: number; // 0..1 brilho branco (dano)
  squash?: number; // -1..1
  emote?: 'win' | 'sad' | 'cheer' | null;
  scale?: number;
  accessory?: string;
}

/** Desenha o personagem com os pés em (x, y). S = tamanho do tile em px. */
export function drawCharacter(c: Ctx, x: number, y: number, S: number, pose: CharPose) {
  const def = CHARACTERS[pose.char];
  const [main, sec, det, skin] = pose.colors ?? def.colors;
  const dir = pose.dir;
  const t = pose.t;
  const scale = pose.scale ?? 1;
  const walk = pose.moving ? t * 11 : 0;
  const bob = pose.moving ? Math.abs(Math.sin(walk)) * S * 0.05 : Math.sin(t * 2.4) * S * 0.012;
  const breathe = pose.moving ? 1 : 1 + Math.sin(t * 2.4) * 0.018;
  const sq = pose.squash ?? 0;
  const side = dir === 1 || dir === 3;
  const flip = dir === 3 ? -1 : 1;
  const back = dir === 0;
  const blink = (t * 0.9) % 3.7 < 0.12;

  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  if (pose.alpha !== undefined) c.globalAlpha *= pose.alpha;

  // sombra
  c.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(c, 0, 0, S * 0.3, S * 0.1);
  c.fill();

  const isMola = pose.char === 'mola';
  const lift = isMola && pose.moving ? Math.abs(Math.sin(walk * 0.5)) * S * 0.1 : 0;
  c.translate(0, -bob - lift);
  c.scale((1 + sq * 0.12) * (side ? 1 : 1), (1 - sq * 0.12) * breathe);

  const big = pose.char === 'tuba';
  const bw = S * (big ? 0.62 : 0.46); // largura do corpo
  const bh = S * (big ? 0.46 : 0.4);
  const bodyY = -S * 0.12;
  const headR = S * (big ? 0.24 : 0.27);
  const headY = bodyY - bh * 0.5 - headR * 0.72;

  // ───── pés ─────
  const fo = pose.moving ? Math.sin(walk) * S * 0.07 : 0;
  if (isMola) {
    c.strokeStyle = '#9aa7b8';
    c.lineWidth = S * 0.035;
    for (const sx of [-1, 1]) {
      c.beginPath();
      const fx = sx * S * 0.1;
      c.moveTo(fx, bodyY + bh * 0.3);
      for (let k = 1; k <= 4; k++) c.lineTo(fx + (k % 2 ? 1 : -1) * S * 0.05, bodyY + bh * 0.3 + (k * (S * 0.14 + lift * 0.3)) / 4);
      c.stroke();
      c.fillStyle = det;
      ellipse(c, fx, -S * 0.01, S * 0.07, S * 0.04);
      c.fill();
    }
  } else {
    c.fillStyle = shade(det, -0.1);
    if (side) {
      ellipse(c, fo * flip, -S * 0.03, S * 0.1, S * 0.06);
      c.fill();
      ellipse(c, -fo * flip, -S * 0.02, S * 0.1, S * 0.06);
      c.fill();
    } else {
      ellipse(c, -S * 0.11, -S * 0.03 + (pose.moving ? fo * 0.3 : 0), S * 0.09, S * 0.065);
      c.fill();
      ellipse(c, S * 0.11, -S * 0.03 - (pose.moving ? fo * 0.3 : 0), S * 0.09, S * 0.065);
      c.fill();
    }
  }

  // ───── extras atrás do corpo ─────
  if (pose.char === 'magna' && !back) drawMagnet(c, S, bodyY - bh * 0.35, side, flip);
  if (pose.char === 'faisca' && pose.moving) drawScarfTrail(c, S, bodyY - bh * 0.45, dir, t, sec);
  if (pose.char === 'pira') drawRibbons(c, S, bodyY - bh * 0.2, dir, t, pose.moving, sec, main);

  // ───── corpo ─────
  const bodyGrad = c.createLinearGradient(0, bodyY - bh / 2, 0, bodyY + bh / 2);
  bodyGrad.addColorStop(0, shade(main, 0.12));
  bodyGrad.addColorStop(1, shade(main, -0.12));
  c.fillStyle = bodyGrad;
  if (pose.char === 'lume' || pose.char === 'vulto') {
    // manto
    c.beginPath();
    c.moveTo(-bw * 0.35, bodyY - bh * 0.55);
    c.quadraticCurveTo(-bw * 0.62, bodyY + bh * 0.3, -bw * 0.55, bodyY + bh * 0.62);
    c.lineTo(bw * 0.55, bodyY + bh * 0.62);
    c.quadraticCurveTo(bw * 0.62, bodyY + bh * 0.3, bw * 0.35, bodyY - bh * 0.55);
    c.closePath();
    c.fill();
  } else if (isMola) {
    rr(c, -bw * 0.4, bodyY - bh * 0.45, bw * 0.8, bh * 0.85, S * 0.08);
    c.fill();
  } else {
    rr(c, -bw / 2, bodyY - bh / 2, bw, bh, bw * 0.38);
    c.fill();
  }
  // contorno sutil
  c.strokeStyle = withAlpha('#000000', 0.25);
  c.lineWidth = Math.max(1, S * 0.02);
  c.stroke();

  // detalhes do corpo (frente)
  if (!back) {
    switch (pose.char) {
      case 'tuba': {
        const dx = side ? flip * bw * 0.12 : 0;
        c.fillStyle = '#f3e3c3';
        ellipse(c, dx, bodyY + bh * 0.05, bw * (side ? 0.22 : 0.3), bh * 0.3);
        c.fill();
        c.strokeStyle = det;
        c.lineWidth = S * 0.03;
        c.stroke();
        c.beginPath();
        c.moveTo(dx - bw * 0.2, bodyY - bh * 0.1);
        c.lineTo(dx + bw * 0.2, bodyY + bh * 0.2);
        c.moveTo(dx + bw * 0.2, bodyY - bh * 0.1);
        c.lineTo(dx - bw * 0.2, bodyY + bh * 0.2);
        c.strokeStyle = withAlpha(det, 0.6);
        c.lineWidth = S * 0.015;
        c.stroke();
        break;
      }
      case 'faisca':
        c.fillStyle = sec;
        c.fillRect(-S * 0.02 + (side ? flip * S * 0.06 : 0), bodyY - bh * 0.45, S * 0.04, bh * 0.85);
        break;
      case 'geada':
        c.fillStyle = '#dfe9f2';
        c.beginPath();
        c.moveTo(-bw * 0.08, bodyY - bh * 0.48);
        c.lineTo(0, bodyY - bh * 0.1);
        c.lineTo(bw * 0.08, bodyY - bh * 0.48);
        c.fill();
        c.fillStyle = '#8ecae6';
        circle(c, bw * 0.2, bodyY, S * 0.025);
        c.fill();
        break;
      case 'magna':
        c.fillStyle = sec;
        rr(c, -bw * 0.28, bodyY - bh * 0.2, bw * 0.56, bh * 0.5, S * 0.05);
        c.fill();
        c.fillStyle = det;
        c.fillRect(-bw * 0.3, bodyY - bh * 0.45, S * 0.035, bh * 0.35);
        c.fillRect(bw * 0.3 - S * 0.035, bodyY - bh * 0.45, S * 0.035, bh * 0.35);
        break;
      case 'mola':
        c.fillStyle = '#243447';
        rr(c, -bw * 0.22, bodyY - bh * 0.2, bw * 0.44, bh * 0.35, S * 0.03);
        c.fill();
        c.fillStyle = (t * 2) % 1 < 0.5 ? '#ffbf69' : '#2ec4b6';
        circle(c, 0, bodyY - bh * 0.02, S * 0.03);
        c.fill();
        break;
      case 'pira':
        c.fillStyle = sec;
        for (let k = 0; k < 3; k++)
          for (let j = 0; j < 2; j++) {
            ellipse(c, (k - 1) * bw * 0.22 + (side ? flip * bw * 0.1 : 0), bodyY - bh * 0.15 + j * bh * 0.25, S * 0.04, S * 0.03);
            c.fill();
          }
        break;
      case 'lume':
        c.fillStyle = '#5ef2d6';
        star(c, side ? flip * bw * 0.1 : 0, bodyY + bh * 0.05, S * 0.05, S * 0.02, 4);
        c.fill();
        break;
      case 'vulto':
        c.fillStyle = sec;
        c.fillRect(-bw * 0.45, bodyY - bh * 0.1, bw * 0.9, S * 0.04);
        break;
    }
  } else if (pose.char === 'magna') {
    drawMagnet(c, S, bodyY - bh * 0.35, false, 1, true);
  }

  // braços
  const armSwing = pose.moving ? Math.sin(walk) * S * 0.06 : 0;
  c.fillStyle = shade(main, -0.05);
  if (side) {
    ellipse(c, -flip * bw * 0.05 + armSwing * flip, bodyY + bh * 0.05, S * 0.07, S * 0.09);
    c.fill();
  } else {
    ellipse(c, -bw * 0.52, bodyY + bh * 0.05 + armSwing * 0.4, S * 0.07, S * 0.09);
    c.fill();
    ellipse(c, bw * 0.52, bodyY + bh * 0.05 - armSwing * 0.4, S * 0.07, S * 0.09);
    c.fill();
  }
  // mãos
  c.fillStyle = isMola ? '#9aa7b8' : pose.char === 'vulto' || pose.char === 'lume' ? shade(main, -0.25) : skin;
  if (!side) {
    circle(c, -bw * 0.55, bodyY + bh * 0.22 + armSwing * 0.4, S * 0.05);
    c.fill();
    circle(c, bw * 0.55, bodyY + bh * 0.22 - armSwing * 0.4, S * 0.05);
    c.fill();
  }

  // ───── cabeça ─────
  drawHead(c, S, 0, headY, headR, pose, main, sec, det, skin, side, flip, back, blink);

  // flash de dano
  if (pose.flash && pose.flash > 0) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(255,255,255,${pose.flash})`;
    c.fillRect(-S, -S * 1.5, S * 2, S * 2);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

function drawHead(
  c: Ctx,
  S: number,
  hx: number,
  hy: number,
  r: number,
  pose: CharPose,
  main: string,
  sec: string,
  det: string,
  skin: string,
  side: boolean,
  flip: number,
  back: boolean,
  blink: boolean,
) {
  const ch = pose.char;
  const faceX = side ? flip * r * 0.35 : 0;
  // base da cabeça
  if (ch === 'mola') {
    const g = c.createLinearGradient(0, hy - r, 0, hy + r);
    g.addColorStop(0, shade(main, 0.2));
    g.addColorStop(1, shade(main, -0.1));
    c.fillStyle = g;
    rr(c, hx - r * 1.05, hy - r * 0.9, r * 2.1, r * 1.8, r * 0.45);
    c.fill();
    c.strokeStyle = withAlpha('#000', 0.25);
    c.lineWidth = Math.max(1, S * 0.02);
    c.stroke();
    // antena
    c.strokeStyle = '#9aa7b8';
    c.lineWidth = S * 0.025;
    c.beginPath();
    c.moveTo(hx, hy - r * 0.9);
    c.lineTo(hx + Math.sin(pose.t * 5) * S * 0.03, hy - r * 1.35);
    c.stroke();
    c.fillStyle = sec;
    circle(c, hx + Math.sin(pose.t * 5) * S * 0.03, hy - r * 1.4, S * 0.045);
    c.fill();
    if (!back) {
      c.fillStyle = '#10202e';
      rr(c, hx - r * 0.75 + faceX * 0.5, hy - r * 0.5, r * 1.5, r * 1.05, r * 0.3);
      c.fill();
      c.fillStyle = '#5ef2d6';
      c.shadowColor = '#5ef2d6';
      c.shadowBlur = S * 0.08;
      const ey = hy - r * 0.02;
      if (blink) {
        c.fillRect(hx - r * 0.45 + faceX, ey, r * 0.3, r * 0.08);
        c.fillRect(hx + r * 0.15 + faceX, ey, r * 0.3, r * 0.08);
      } else {
        rr(c, hx - r * 0.42 + faceX, ey - r * 0.2, r * 0.22, r * 0.36, r * 0.06);
        c.fill();
        rr(c, hx + r * 0.2 + faceX, ey - r * 0.2, r * 0.22, r * 0.36, r * 0.06);
      }
      c.fill();
      c.shadowBlur = 0;
    }
    return;
  }

  const hooded = ch === 'lume' || ch === 'vulto';
  // cabeça
  const hg = c.createRadialGradient(hx - r * 0.3, hy - r * 0.4, r * 0.1, hx, hy, r * 1.1);
  const baseCol = hooded ? main : skin;
  hg.addColorStop(0, shade(baseCol, 0.15));
  hg.addColorStop(1, shade(baseCol, -0.1));
  c.fillStyle = hg;
  if (hooded) {
    // capuz pontudo
    c.beginPath();
    c.moveTo(hx - r * 1.05, hy + r * 0.55);
    c.quadraticCurveTo(hx - r * 1.15, hy - r * 0.6, hx + (side ? -flip * r * 0.3 : 0), hy - r * 1.35);
    c.quadraticCurveTo(hx + r * 1.15, hy - r * 0.6, hx + r * 1.05, hy + r * 0.55);
    c.quadraticCurveTo(hx, hy + r * 0.95, hx - r * 1.05, hy + r * 0.55);
    c.fill();
    c.strokeStyle = withAlpha('#000', 0.25);
    c.lineWidth = Math.max(1, S * 0.02);
    c.stroke();
    if (!back) {
      c.fillStyle = ch === 'lume' ? '#140e30' : '#07010f';
      ellipse(c, hx + faceX, hy + r * 0.08, r * (side ? 0.55 : 0.72), r * 0.62);
      c.fill();
      // olhos luminosos
      const ec = ch === 'lume' ? '#5ef2d6' : '#ffffff';
      c.fillStyle = ec;
      c.shadowColor = ec;
      c.shadowBlur = S * 0.08;
      const ey = hy + r * 0.05;
      const eh = blink ? r * 0.04 : ch === 'vulto' ? r * 0.08 : r * 0.16;
      if (!side || flip > 0) {
        ellipse(c, hx + faceX + r * 0.24, ey, r * 0.13, eh);
        c.fill();
      }
      if (!side || flip < 0) {
        ellipse(c, hx + faceX - r * 0.24, ey, r * 0.13, eh);
        c.fill();
      }
      c.shadowBlur = 0;
      if (ch === 'vulto') {
        // cachecol cobrindo a boca
        c.fillStyle = sec;
        rr(c, hx - r * 0.85, hy + r * 0.25, r * 1.7, r * 0.45, r * 0.2);
        c.fill();
      }
      if (ch === 'lume') {
        c.fillStyle = sec;
        c.shadowColor = sec;
        c.shadowBlur = S * 0.12;
        c.beginPath();
        c.moveTo(hx + faceX, hy - r * 0.95);
        c.lineTo(hx + faceX + r * 0.14, hy - r * 0.72);
        c.lineTo(hx + faceX, hy - r * 0.5);
        c.lineTo(hx + faceX - r * 0.14, hy - r * 0.72);
        c.closePath();
        c.fill();
        c.shadowBlur = 0;
      }
    } else if (ch === 'vulto') {
      c.fillStyle = sec;
      c.beginPath();
      c.moveTo(hx, hy + r * 0.3);
      c.quadraticCurveTo(hx + r * 0.5 + Math.sin(pose.t * 6) * r * 0.2, hy + r * 1.1, hx + r * 0.2, hy + r * 1.5);
      c.lineTo(hx - r * 0.1, hy + r * 1.4);
      c.closePath();
      c.fill();
    }
    return;
  }

  circle(c, hx, hy, r);
  c.fill();
  c.strokeStyle = withAlpha('#000', 0.22);
  c.lineWidth = Math.max(1, S * 0.02);
  c.stroke();

  // cabelo / chapéu
  switch (ch) {
    case 'faisca': {
      c.fillStyle = sec;
      c.beginPath();
      c.arc(hx, hy - r * 0.05, r * 1.02, Math.PI * 1.02, Math.PI * 1.98);
      c.closePath();
      c.fill();
      // espetos
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        const bx = hx + k * r * 0.38;
        c.moveTo(bx - r * 0.25, hy - r * 0.7);
        c.lineTo(bx + (side ? -flip * r * 0.3 : k * r * 0.1), hy - r * (1.35 - Math.abs(k) * 0.12));
        c.lineTo(bx + r * 0.25, hy - r * 0.7);
        c.fill();
      }
      if (!back) {
        // óculos na testa
        c.fillStyle = det;
        c.fillRect(hx - r, hy - r * 0.55, r * 2, r * 0.22);
        c.fillStyle = '#7ad8ff';
        circle(c, hx - r * 0.35 + faceX * 0.6, hy - r * 0.44, r * 0.2);
        c.fill();
        circle(c, hx + r * 0.35 + faceX * 0.6, hy - r * 0.44, r * 0.2);
        c.fill();
      }
      break;
    }
    case 'tuba': {
      c.fillStyle = det;
      c.beginPath();
      c.arc(hx, hy - r * 0.15, r * 1.02, Math.PI, Math.PI * 2);
      c.closePath();
      c.fill();
      c.fillRect(hx - r * 1.05 + (side ? flip * r * 0.5 : 0), hy - r * 0.25, r * (side ? 1.6 : 2.1), r * 0.2);
      break;
    }
    case 'geada': {
      c.fillStyle = sec === '#ffffff' ? '#bfe6ff' : sec;
      c.beginPath();
      c.arc(hx, hy - r * 0.05, r * 1.08, Math.PI * 0.95, Math.PI * 2.05);
      c.lineTo(hx + r * 1.08, hy + r * 0.55);
      c.lineTo(hx + r * 0.75, hy + r * 0.55);
      c.lineTo(hx + r * 0.75, hy - r * 0.2);
      c.lineTo(hx - r * 0.75, hy - r * 0.2);
      c.lineTo(hx - r * 0.75, hy + r * 0.55);
      c.lineTo(hx - r * 1.08, hy + r * 0.55);
      c.closePath();
      c.fillStyle = '#bfe6ff';
      c.fill();
      break;
    }
    case 'magna': {
      c.fillStyle = '#3a2a2a';
      c.beginPath();
      c.arc(hx, hy - r * 0.1, r * 1.03, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fill();
      circle(c, hx + (side ? -flip * r * 0.6 : 0), hy - r * 0.95, r * 0.35);
      c.fill();
      break;
    }
    case 'pira': {
      c.fillStyle = '#1b1b24';
      c.beginPath();
      c.arc(hx, hy - r * 0.1, r * 1.04, Math.PI * 1.0, Math.PI * 2.0);
      c.closePath();
      c.fill();
      c.fillStyle = sec;
      c.fillRect(hx - r * 1.02, hy - r * 0.45, r * 2.04, r * 0.2);
      break;
    }
  }

  if (back) return;
  // olhos
  const ey = hy + r * 0.08;
  const ex = r * 0.36;
  const drawEye = (px: number) => {
    if (blink) {
      c.strokeStyle = '#2b1a1a';
      c.lineWidth = Math.max(1, S * 0.02);
      c.beginPath();
      c.moveTo(px - r * 0.12, ey);
      c.lineTo(px + r * 0.12, ey);
      c.stroke();
      return;
    }
    c.fillStyle = '#ffffff';
    ellipse(c, px, ey, r * 0.17, r * 0.22);
    c.fill();
    c.fillStyle = '#1d1426';
    const look = side ? flip * r * 0.06 : 0;
    ellipse(c, px + look, ey + r * 0.03, r * 0.1, r * 0.14);
    c.fill();
    c.fillStyle = '#ffffff';
    circle(c, px + look + r * 0.04, ey - r * 0.04, r * 0.04);
    c.fill();
  };
  if (!side || flip > 0) drawEye(hx + faceX + ex * (side ? 0.6 : 1));
  if (!side || flip < 0) drawEye(hx + faceX - ex * (side ? 0.6 : 1));
  // bochechas
  c.fillStyle = 'rgba(255,110,110,0.35)';
  if (!side) {
    ellipse(c, hx - r * 0.55, hy + r * 0.38, r * 0.14, r * 0.08);
    c.fill();
    ellipse(c, hx + r * 0.55, hy + r * 0.38, r * 0.14, r * 0.08);
    c.fill();
  }
  // boca
  c.strokeStyle = '#5a2a2a';
  c.lineWidth = Math.max(1, S * 0.018);
  c.beginPath();
  if (pose.emote === 'win' || pose.emote === 'cheer') c.arc(hx + faceX, hy + r * 0.4, r * 0.16, 0.1, Math.PI - 0.1);
  else if (pose.emote === 'sad') c.arc(hx + faceX, hy + r * 0.55, r * 0.12, Math.PI + 0.3, -0.3);
  else c.arc(hx + faceX, hy + r * 0.38, r * 0.1, 0.2, Math.PI - 0.2);
  c.stroke();
  if (ch === 'tuba') {
    c.fillStyle = '#3d2b1f';
    ellipse(c, hx + faceX - r * 0.15, hy + r * 0.32, r * 0.18, r * 0.07, 0.2);
    c.fill();
    ellipse(c, hx + faceX + r * 0.15, hy + r * 0.32, r * 0.18, r * 0.07, -0.2);
    c.fill();
  }
  if (ch === 'geada') {
    c.fillStyle = 'rgba(142,202,230,0.45)';
    c.strokeStyle = '#1b3a4b';
    c.lineWidth = Math.max(1, S * 0.015);
    rr(c, hx - r * 0.72 + faceX * 0.6, ey - r * 0.22, r * 1.44, r * 0.4, r * 0.15);
    c.fill();
    c.stroke();
  }
  if (ch === 'magna') {
    c.fillStyle = '#1d3557';
    c.fillRect(hx - r * 0.95, hy - r * 0.42, r * 1.9, r * 0.14);
    c.fillStyle = '#a8dadc';
    circle(c, hx - r * 0.3 + faceX * 0.5, hy - r * 0.35, r * 0.15);
    c.fill();
    circle(c, hx + r * 0.3 + faceX * 0.5, hy - r * 0.35, r * 0.15);
    c.fill();
  }
}

function drawMagnet(c: Ctx, S: number, y: number, side: boolean, flip: number, front = false) {
  c.save();
  c.translate(side ? -flip * S * 0.18 : 0, y - S * (front ? 0.05 : 0.12));
  c.lineWidth = S * 0.13;
  c.strokeStyle = '#e63946';
  c.beginPath();
  c.arc(0, 0, S * 0.2, Math.PI, 0, true);
  c.stroke();
  c.fillStyle = '#d8e2e6';
  c.fillRect(-S * 0.265, -S * 0.1, S * 0.13, S * 0.1);
  c.fillRect(S * 0.135, -S * 0.1, S * 0.13, S * 0.1);
  c.restore();
}

function drawScarfTrail(c: Ctx, S: number, y: number, dir: number, t: number, col: string) {
  const bx = dir === 1 ? -1 : dir === 3 ? 1 : 0;
  const by = dir === 2 ? -1 : dir === 0 ? 1 : 0.3;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-S * 0.06, y);
  const wav = Math.sin(t * 14) * S * 0.05;
  c.quadraticCurveTo(bx * S * 0.25, y + by * S * 0.1 + wav, bx * S * 0.4 + (bx === 0 ? S * 0.15 : 0), y + by * S * 0.18 - wav);
  c.lineTo(bx * S * 0.35 + (bx === 0 ? S * 0.1 : 0), y + by * S * 0.24);
  c.quadraticCurveTo(bx * S * 0.2, y + by * S * 0.16, S * 0.06, y + S * 0.05);
  c.closePath();
  c.fill();
}

function drawRibbons(c: Ctx, S: number, y: number, dir: number, t: number, moving: boolean, a: string, b: string) {
  const bx = dir === 1 ? -1 : dir === 3 ? 1 : 0;
  c.lineWidth = S * 0.035;
  c.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    c.strokeStyle = k ? a : b;
    c.beginPath();
    const sx = (k ? 1 : -1) * S * 0.18;
    c.moveTo(sx, y);
    const amp = moving ? 0.12 : 0.05;
    for (let s = 1; s <= 6; s++) {
      const px = sx + bx * s * S * 0.05 + (bx === 0 ? (k ? 1 : -1) * s * S * 0.03 : 0);
      const py = y + s * S * 0.04 + Math.sin(t * 8 + s + k * 2) * S * amp * (s / 6);
      c.lineTo(px, py);
    }
    c.stroke();
  }
}
