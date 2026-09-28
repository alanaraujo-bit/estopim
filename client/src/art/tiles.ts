import { F, T, type Biome } from '@estopim/shared';
import { BIOME_ART, type BiomeArt } from './biomes';
import { circle, ellipse, h2, makeCanvas, rr, shade, star, withAlpha, type Ctx } from './draw';

/** Proporção da face frontal (altura) em relação ao tile. */
export const LIFT = 0.3;

type Sprite = HTMLCanvasElement;

export class TileArt {
  cache = new Map<string, Sprite>();
  constructor(
    public biome: Biome,
    public S: number,
  ) {}
  get art(): BiomeArt {
    return BIOME_ART[this.biome];
  }
  get L() {
    return Math.round(this.S * LIFT);
  }

  sprite(key: string, draw: (ctx: Ctx, S: number, L: number) => void): Sprite {
    let s = this.cache.get(key);
    if (!s) {
      const [c, ctx] = makeCanvas(this.S, this.S + this.L);
      draw(ctx, this.S, this.L);
      this.cache.set(key, c);
      s = c;
    }
    return s;
  }

  /** Sprite de um tile sólido. mask: bits de vizinhos iguais (1 cima, 2 dir, 4 baixo, 8 esq). */
  solid(t: number, mask: number, variant: number): Sprite | null {
    switch (t) {
      case T.Wall:
        return this.sprite(`w${mask}`, (c, S, L) => this.drawWall(c, S, L, mask, false));
      case T.Pillar:
        return this.sprite(`p${variant % 3}`, (c, S, L) => this.drawPillar(c, S, L, variant % 3));
      case T.Cracked:
        return this.sprite(`c${mask}`, (c, S, L) => {
          this.drawWall(c, S, L, mask, false);
          this.drawCracks(c, S, L);
        });
      case T.Block:
        return this.sprite(`b${variant % 4}`, (c, S, L) => this.drawBlock(c, S, L, variant % 4));
      case T.Hard:
        return this.sprite(`h${variant % 2}`, (c, S, L) => {
          this.drawBlock(c, S, L, variant % 4);
          this.drawReinforce(c, S, L);
        });
      case T.Vine:
        return this.sprite(`v${variant % 3}`, (c, S, L) => this.drawVine(c, S, L, variant % 3));
      case T.Barrel:
        return this.sprite('barrel', (c, S, L) => this.drawBarrel(c, S, L));
      case T.MirrorA:
        return this.sprite('mA', (c, S, L) => this.drawMirror(c, S, L, false));
      case T.MirrorB:
        return this.sprite('mB', (c, S, L) => this.drawMirror(c, S, L, true));
      case T.Crystal:
        return this.sprite('crystal', (c, S, L) => this.drawCrystal(c, S, L));
      case T.Target:
        return this.sprite('target', (c, S, L) => this.drawTarget(c, S, L));
      case T.Door:
        return this.sprite('door', (c, S, L) => this.drawDoor(c, S, L));
    }
    return null;
  }

  // ───────── paredes ─────────
  drawWall(c: Ctx, S: number, L: number, mask: number, _alt: boolean) {
    const a = this.art;
    // face frontal
    c.fillStyle = a.wallFront;
    c.fillRect(0, S - 1, S, L + 1);
    c.fillStyle = withAlpha('#000000', 0.18);
    c.fillRect(0, S + L - Math.max(2, L * 0.18), S, Math.max(2, L * 0.18));
    // tampo
    const g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, a.wallTopHi);
    g.addColorStop(1, a.wallTop);
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    // textura por estilo
    const st = this.art.style;
    c.save();
    c.globalAlpha = 0.22;
    c.strokeStyle = a.wallEdge;
    c.lineWidth = Math.max(1, S * 0.03);
    if (st === 'crate' || st === 'stone' || st === 'moss' || st === 'basalt') {
      // tijolos
      const rows = 3;
      for (let r = 1; r < rows; r++) {
        c.beginPath();
        c.moveTo(0, (S * r) / rows);
        c.lineTo(S, (S * r) / rows);
        c.stroke();
      }
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? S / 2 : S / 4;
        c.beginPath();
        c.moveTo(off, (S * r) / rows);
        c.lineTo(off, (S * (r + 1)) / rows);
        c.moveTo(off + S / 2, (S * r) / rows);
        c.lineTo(off + S / 2, (S * (r + 1)) / rows);
        c.stroke();
      }
    } else {
      // painéis com rebites
      c.strokeRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76);
      c.globalAlpha = 0.35;
      c.fillStyle = a.wallEdge;
      for (const [x, y] of [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
      ]) {
        circle(c, S * x, S * y, S * 0.035);
        c.fill();
      }
    }
    c.restore();
    // bordas nas faces sem vizinho
    const bw = Math.max(2, S * 0.06);
    c.fillStyle = withAlpha('#ffffff', 0.16);
    if (!(mask & 1)) c.fillRect(0, 0, S, bw);
    c.fillStyle = withAlpha('#000000', 0.22);
    if (!(mask & 2)) c.fillRect(S - bw, 0, bw, S + L);
    if (!(mask & 8)) {
      c.fillStyle = withAlpha('#ffffff', 0.08);
      c.fillRect(0, 0, bw, S);
    }
    if (this.biome === 'neon') {
      c.strokeStyle = withAlpha(a.wallEdge, 0.8);
      c.lineWidth = Math.max(1, S * 0.03);
      if (!(mask & 4)) {
        c.beginPath();
        c.moveTo(0, S - 1);
        c.lineTo(S, S - 1);
        c.stroke();
      }
    }
  }

  drawCracks(c: Ctx, S: number, _L: number) {
    c.strokeStyle = withAlpha('#000000', 0.45);
    c.lineWidth = Math.max(1, S * 0.03);
    c.beginPath();
    c.moveTo(S * 0.3, S * 0.1);
    c.lineTo(S * 0.45, S * 0.4);
    c.lineTo(S * 0.35, S * 0.6);
    c.lineTo(S * 0.55, S * 0.9);
    c.moveTo(S * 0.45, S * 0.4);
    c.lineTo(S * 0.7, S * 0.45);
    c.stroke();
  }

  drawPillar(c: Ctx, S: number, L: number, v: number) {
    const a = this.art;
    const m = S * 0.06;
    // corpo
    c.fillStyle = a.pillarFront;
    rr(c, m, S * 0.5, S - 2 * m, S * 0.5 + L - m * 0.5, S * 0.12);
    c.fill();
    const g = c.createLinearGradient(0, m, 0, S - m);
    g.addColorStop(0, shade(a.pillarTop, 0.15));
    g.addColorStop(1, a.pillarTop);
    c.fillStyle = g;
    rr(c, m, m, S - 2 * m, S - 2 * m, S * 0.14);
    c.fill();
    c.strokeStyle = withAlpha('#000000', 0.2);
    c.lineWidth = Math.max(1, S * 0.025);
    c.stroke();
    // ornamento por bioma
    const cx = S / 2,
      cy = S / 2;
    c.save();
    switch (this.biome) {
      case 'vila': {
        // lampião
        c.fillStyle = '#7d3f37';
        rr(c, cx - S * 0.16, cy - S * 0.16, S * 0.32, S * 0.32, S * 0.08);
        c.fill();
        const gg = c.createRadialGradient(cx, cy, 0, cx, cy, S * 0.14);
        gg.addColorStop(0, '#fff6c9');
        gg.addColorStop(1, '#ffb347');
        c.fillStyle = gg;
        circle(c, cx, cy, S * 0.1);
        c.fill();
        break;
      }
      case 'fundicao':
        c.fillStyle = '#ffb347';
        c.globalAlpha = 0.9;
        for (let k = 0; k < 3; k++) {
          c.fillRect(S * 0.2, S * (0.3 + k * 0.16), S * 0.6, S * 0.05);
        }
        c.globalAlpha = 1;
        c.fillStyle = '#2b2d33';
        for (let k = 0; k < 3; k++) c.fillRect(S * (0.2 + k * 0.22), S * 0.3, S * 0.08, S * 0.37);
        break;
      case 'boreal':
        c.fillStyle = withAlpha('#7fd8ff', 0.9);
        rr(c, cx - S * 0.2, cy - S * 0.05, S * 0.4, S * 0.1, S * 0.05);
        c.fill();
        break;
      case 'aurora':
        c.strokeStyle = '#5ef2d6';
        c.lineWidth = S * 0.04;
        c.beginPath();
        c.arc(cx, cy, S * 0.18, 0, Math.PI * 2);
        c.moveTo(cx, cy - S * 0.26);
        c.lineTo(cx, cy + S * 0.26);
        c.stroke();
        break;
      case 'verdejante':
        c.fillStyle = '#3f7a44';
        for (let k = 0; k < 5; k++) {
          ellipse(c, S * (0.25 + h2(k, v) * 0.5), S * (0.2 + k * 0.08), S * 0.12, S * 0.07, h2(v, k) * 3);
          c.fill();
        }
        break;
      case 'orbita':
        c.fillStyle = '#3fd4ff';
        circle(c, cx, cy, S * 0.07);
        c.fill();
        c.strokeStyle = withAlpha('#3fd4ff', 0.6);
        c.lineWidth = S * 0.025;
        rr(c, S * 0.22, S * 0.22, S * 0.56, S * 0.56, S * 0.1);
        c.stroke();
        break;
      case 'magma': {
        c.strokeStyle = '#ff7a1a';
        c.lineWidth = S * 0.035;
        c.beginPath();
        c.moveTo(S * 0.25, S * 0.3);
        c.lineTo(S * 0.45, S * 0.5);
        c.lineTo(S * 0.4, S * 0.72);
        c.moveTo(S * 0.45, S * 0.5);
        c.lineTo(S * 0.72, S * 0.45);
        c.stroke();
        break;
      }
      case 'neon':
        c.strokeStyle = v % 2 ? '#3cf2ff' : '#ff3cac';
        c.lineWidth = S * 0.04;
        rr(c, S * 0.2, S * 0.2, S * 0.6, S * 0.6, S * 0.12);
        c.stroke();
        break;
    }
    c.restore();
  }

  // ───────── blocos destrutíveis ─────────
  drawBlock(c: Ctx, S: number, L: number, v: number) {
    const a = this.art;
    const m = S * 0.05;
    const top = m + S * 0.02;
    // sombra de contato
    c.fillStyle = withAlpha('#000000', 0.25);
    rr(c, m, top + S * 0.1, S - 2 * m, S - m - top + L - S * 0.04, S * 0.12);
    c.fill();
    // frente
    c.fillStyle = a.blockFront;
    rr(c, m, top + S * 0.35, S - 2 * m, S - top - S * 0.35 + L - m, S * 0.12);
    c.fill();
    // topo
    const tw = S - 2 * m,
      th = S - top - m;
    const g = c.createLinearGradient(0, top, 0, top + th);
    g.addColorStop(0, a.blockHi);
    g.addColorStop(0.35, a.blockTop);
    g.addColorStop(1, a.blockTop);
    c.fillStyle = g;
    rr(c, m, top, tw, th, S * 0.12);
    c.fill();
    c.save();
    rr(c, m, top, tw, th, S * 0.12);
    c.clip();
    const x0 = m,
      y0 = top,
      cx = x0 + tw / 2,
      cy = y0 + th / 2;
    switch (a.style) {
      case 'crate': {
        // tábuas + cintas + selo de rojão
        c.strokeStyle = withAlpha('#7a4a1a', 0.45);
        c.lineWidth = S * 0.025;
        for (let k = 1; k < 4; k++) {
          c.beginPath();
          c.moveTo(x0, y0 + (th * k) / 4);
          c.lineTo(x0 + tw, y0 + (th * k) / 4);
          c.stroke();
        }
        c.fillStyle = '#6b3c1c';
        c.fillRect(x0 + tw * 0.14, y0, tw * 0.09, th);
        c.fillRect(x0 + tw * 0.77, y0, tw * 0.09, th);
        const colors = [a.blockDetail, '#2f7de1', '#2aa86b', '#b146c2'];
        c.fillStyle = colors[v % 4];
        circle(c, cx, cy, S * 0.16);
        c.fill();
        c.fillStyle = '#fff4d6';
        star(c, cx, cy, S * 0.1, S * 0.045);
        c.fill();
        break;
      }
      case 'metal': {
        c.strokeStyle = withAlpha('#2f1a10', 0.55);
        c.lineWidth = S * 0.05;
        c.beginPath();
        if (v % 2) {
          c.moveTo(x0, y0);
          c.lineTo(x0 + tw, y0 + th);
        } else {
          c.moveTo(x0 + tw, y0);
          c.lineTo(x0, y0 + th);
        }
        c.stroke();
        c.strokeRect(x0 + S * 0.07, y0 + S * 0.07, tw - S * 0.14, th - S * 0.14);
        c.fillStyle = '#3b2216';
        for (const [px, py] of [
          [0.14, 0.14],
          [0.86, 0.14],
          [0.14, 0.86],
          [0.86, 0.86],
        ]) {
          circle(c, x0 + tw * px, y0 + th * py, S * 0.035);
          c.fill();
        }
        // ferrugem
        c.fillStyle = withAlpha('#d2703a', 0.35);
        for (let k = 0; k < 4; k++) {
          ellipse(c, x0 + tw * h2(v, k), y0 + th * h2(k, v, 3), S * 0.08, S * 0.05);
          c.fill();
        }
        break;
      }
      case 'ice': {
        c.globalAlpha = 0.8;
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(x0 + tw * 0.15, y0 + th * 0.2);
        c.lineTo(x0 + tw * 0.45, y0 + th * 0.12);
        c.lineTo(x0 + tw * 0.25, y0 + th * 0.35);
        c.closePath();
        c.fill();
        c.globalAlpha = 0.5;
        c.strokeStyle = '#ffffff';
        c.lineWidth = S * 0.03;
        c.beginPath();
        c.moveTo(x0 + tw * 0.6, y0 + th * 0.7);
        c.lineTo(x0 + tw * 0.85, y0 + th * 0.55);
        c.stroke();
        c.globalAlpha = 0.25;
        c.fillStyle = '#5bb8e6';
        rr(c, x0 + tw * 0.2, y0 + th * 0.45, tw * 0.5, th * 0.35, S * 0.06);
        c.fill();
        break;
      }
      case 'stone': {
        c.strokeStyle = withAlpha('#2b2150', 0.5);
        c.lineWidth = S * 0.03;
        c.strokeRect(x0 + S * 0.08, y0 + S * 0.08, tw - S * 0.16, th - S * 0.16);
        c.strokeStyle = a.blockDetail;
        c.shadowColor = a.blockDetail;
        c.shadowBlur = S * 0.15;
        c.lineWidth = S * 0.04;
        c.beginPath();
        const rune = v % 3;
        if (rune === 0) {
          c.moveTo(cx, cy - S * 0.15);
          c.lineTo(cx, cy + S * 0.15);
          c.moveTo(cx - S * 0.1, cy - S * 0.05);
          c.lineTo(cx + S * 0.1, cy + S * 0.05);
        } else if (rune === 1) {
          c.arc(cx, cy, S * 0.12, 0.3, Math.PI * 1.7);
        } else {
          c.moveTo(cx - S * 0.12, cy + S * 0.1);
          c.lineTo(cx, cy - S * 0.13);
          c.lineTo(cx + S * 0.12, cy + S * 0.1);
        }
        c.stroke();
        break;
      }
      case 'moss': {
        c.strokeStyle = withAlpha('#3a3d2d', 0.45);
        c.lineWidth = S * 0.03;
        c.beginPath();
        c.moveTo(x0, cy);
        c.lineTo(x0 + tw, cy);
        c.moveTo(cx, y0);
        c.lineTo(cx, cy);
        c.moveTo(cx - tw * 0.2, cy);
        c.lineTo(cx - tw * 0.2, y0 + th);
        c.stroke();
        c.fillStyle = '#4f8f4a';
        for (let k = 0; k < 6; k++) {
          ellipse(c, x0 + tw * (k / 5), y0 + S * 0.02, S * 0.1, S * (0.06 + h2(k, v) * 0.08));
          c.fill();
        }
        c.fillStyle = '#6fbf5f';
        for (let k = 0; k < 3; k++) {
          circle(c, x0 + tw * h2(v, k, 1), y0 + th * (0.2 + h2(k, v, 2) * 0.6), S * 0.04);
          c.fill();
        }
        break;
      }
      case 'cargo': {
        c.fillStyle = withAlpha('#000000', 0.18);
        for (let k = 0; k < 5; k++) c.fillRect(x0 + tw * (0.1 + k * 0.18), y0, tw * 0.06, th);
        c.fillStyle = v % 2 ? '#2b3558' : '#f2f2f2';
        c.fillRect(x0, cy - S * 0.07, tw, S * 0.14);
        c.fillStyle = v % 2 ? '#ffb070' : '#2b3558';
        c.font = `900 ${S * 0.12}px system-ui`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(['Ø9', 'CRG', '07', 'ORB'][v % 4], cx, cy + S * 0.005);
        break;
      }
      case 'basalt': {
        c.strokeStyle = a.blockDetail;
        c.shadowColor = '#ff5a00';
        c.shadowBlur = S * 0.12;
        c.lineWidth = S * 0.03;
        c.beginPath();
        c.moveTo(x0 + tw * 0.1, y0 + th * (0.3 + h2(v, 1) * 0.2));
        c.lineTo(cx, cy);
        c.lineTo(x0 + tw * 0.9, y0 + th * (0.5 + h2(v, 2) * 0.3));
        c.moveTo(cx, cy);
        c.lineTo(cx - tw * 0.05, y0 + th);
        c.stroke();
        break;
      }
      case 'speaker': {
        c.fillStyle = '#121019';
        circle(c, cx, cy, S * 0.25);
        c.fill();
        c.strokeStyle = v % 2 ? '#3cf2ff' : '#ff3cac';
        c.lineWidth = S * 0.035;
        c.shadowColor = c.strokeStyle as string;
        c.shadowBlur = S * 0.12;
        circle(c, cx, cy, S * 0.25);
        c.stroke();
        c.fillStyle = '#2a2638';
        circle(c, cx, cy, S * 0.09);
        c.fill();
        break;
      }
    }
    c.restore();
    // brilho de borda
    c.strokeStyle = withAlpha('#ffffff', 0.18);
    c.lineWidth = Math.max(1, S * 0.025);
    rr(c, m + 1, top + 1, tw - 2, th - 2, S * 0.11);
    c.stroke();
  }

  drawReinforce(c: Ctx, S: number, _L: number) {
    c.fillStyle = '#8f98a6';
    c.strokeStyle = '#4a515c';
    c.lineWidth = Math.max(1, S * 0.02);
    const k = S * 0.2;
    for (const [x, y, sx, sy] of [
      [S * 0.05, S * 0.07, 1, 1],
      [S * 0.95, S * 0.07, -1, 1],
      [S * 0.05, S * 0.95, 1, -1],
      [S * 0.95, S * 0.95, -1, -1],
    ]) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + k * sx, y);
      c.lineTo(x, y + k * sy);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.fillStyle = withAlpha('#8f98a6', 0.9);
    c.fillRect(S * 0.05, S * 0.46, S * 0.9, S * 0.08);
  }

  drawVine(c: Ctx, S: number, L: number, v: number) {
    const cx = S / 2,
      cy = S / 2 + L * 0.5;
    c.fillStyle = withAlpha('#000000', 0.25);
    ellipse(c, cx, S + L * 0.55, S * 0.42, S * 0.14);
    c.fill();
    const blobs: [number, number, number][] = [];
    for (let k = 0; k < 9; k++) {
      const ang = (k / 9) * Math.PI * 2 + v;
      const rad = S * (0.2 + h2(k, v) * 0.1);
      blobs.push([cx + Math.cos(ang) * rad * 0.9, cy + Math.sin(ang) * rad * 0.8 - S * 0.05, S * (0.16 + h2(v, k) * 0.07)]);
    }
    blobs.push([cx, cy - S * 0.08, S * 0.24]);
    for (const [bx, by, br] of blobs) {
      c.fillStyle = '#2f6b37';
      circle(c, bx, by + S * 0.04, br);
      c.fill();
    }
    for (const [bx, by, br] of blobs) {
      const g = c.createRadialGradient(bx - br * 0.3, by - br * 0.4, br * 0.1, bx, by, br);
      g.addColorStop(0, '#8be07a');
      g.addColorStop(1, '#3f8f47');
      c.fillStyle = g;
      circle(c, bx, by, br * 0.92);
      c.fill();
    }
    // flores
    const fl = ['#ff7ab8', '#ffd166', '#ffffff'];
    for (let k = 0; k < 3; k++) {
      c.fillStyle = fl[(k + v) % 3];
      circle(c, cx + (h2(k, v, 5) - 0.5) * S * 0.6, cy + (h2(v, k, 7) - 0.6) * S * 0.5, S * 0.035);
      c.fill();
    }
  }

  drawBarrel(c: Ctx, S: number, L: number) {
    const cx = S / 2;
    const top = S * 0.18,
      bot = S + L * 0.85;
    const w = S * 0.64;
    c.fillStyle = withAlpha('#000000', 0.3);
    ellipse(c, cx + S * 0.04, bot, w * 0.55, S * 0.12);
    c.fill();
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#9e1f25');
    g.addColorStop(0.35, '#e8413b');
    g.addColorStop(1, '#7a1418');
    c.fillStyle = g;
    rr(c, cx - w / 2, top, w, bot - top, S * 0.12);
    c.fill();
    c.fillStyle = '#ffcf3d';
    c.fillRect(cx - w / 2, top + (bot - top) * 0.22, w, S * 0.07);
    c.fillRect(cx - w / 2, top + (bot - top) * 0.72, w, S * 0.07);
    c.fillStyle = '#fff4d0';
    star(c, cx, top + (bot - top) * 0.48, S * 0.11, S * 0.05);
    c.fill();
    c.fillStyle = '#c93a35';
    ellipse(c, cx, top, w / 2, S * 0.1);
    c.fill();
    c.fillStyle = '#6b1216';
    ellipse(c, cx, top, w / 2.8, S * 0.06);
    c.fill();
    c.strokeStyle = '#3b2a1a';
    c.lineWidth = S * 0.035;
    c.beginPath();
    c.moveTo(cx, top);
    c.quadraticCurveTo(cx + S * 0.1, top - S * 0.12, cx + S * 0.05, top - S * 0.16);
    c.stroke();
  }

  drawMirror(c: Ctx, S: number, L: number, back: boolean) {
    const cx = S / 2,
      cy = S / 2;
    c.fillStyle = shade(this.art.pillarFront, -0.1);
    rr(c, S * 0.1, S * 0.55, S * 0.8, S * 0.45 + L * 0.8, S * 0.12);
    c.fill();
    c.fillStyle = this.art.pillarTop;
    rr(c, S * 0.1, S * 0.12, S * 0.8, S * 0.76, S * 0.14);
    c.fill();
    c.save();
    c.translate(cx, cy);
    c.rotate(back ? Math.PI / 4 : -Math.PI / 4);
    const g = c.createLinearGradient(-S * 0.4, 0, S * 0.4, 0);
    g.addColorStop(0, '#bff8ff');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, '#7ad8ff');
    c.fillStyle = '#3a3150';
    rr(c, -S * 0.46, -S * 0.1, S * 0.92, S * 0.2, S * 0.05);
    c.fill();
    c.fillStyle = g;
    rr(c, -S * 0.42, -S * 0.06, S * 0.84, S * 0.12, S * 0.04);
    c.fill();
    c.restore();
  }

  drawCrystal(c: Ctx, S: number, L: number) {
    const cx = S / 2,
      base = S + L * 0.6;
    c.fillStyle = withAlpha('#5ef2d6', 0.25);
    ellipse(c, cx, base, S * 0.42, S * 0.14);
    c.fill();
    const shards: [number, number, number][] = [
      [-0.22, 0.55, 0.14],
      [0.22, 0.6, 0.13],
      [0, 0.95, 0.2],
    ];
    for (const [ox, hgt, wd] of shards) {
      const x = cx + ox * S;
      const g = c.createLinearGradient(x - wd * S, 0, x + wd * S, 0);
      g.addColorStop(0, 'rgba(160,120,255,0.85)');
      g.addColorStop(0.5, 'rgba(220,255,250,0.95)');
      g.addColorStop(1, 'rgba(94,242,214,0.85)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - wd * S, base);
      c.lineTo(x - wd * S * 0.8, base - hgt * S * 0.8);
      c.lineTo(x, base - hgt * S);
      c.lineTo(x + wd * S * 0.8, base - hgt * S * 0.8);
      c.lineTo(x + wd * S, base);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = S * 0.02;
      c.stroke();
    }
  }

  drawTarget(c: Ctx, S: number, L: number) {
    const cx = S / 2;
    c.fillStyle = '#2b2f3a';
    rr(c, S * 0.08, S * 0.35, S * 0.84, S * 0.65 + L * 0.8, S * 0.12);
    c.fill();
    c.fillStyle = '#4a5162';
    rr(c, S * 0.08, S * 0.1, S * 0.84, S * 0.8, S * 0.14);
    c.fill();
    c.strokeStyle = '#ffcf3d';
    c.lineWidth = S * 0.05;
    c.setLineDash([S * 0.08, S * 0.08]);
    rr(c, S * 0.14, S * 0.16, S * 0.72, S * 0.68, S * 0.1);
    c.stroke();
    c.setLineDash([]);
    const g = c.createRadialGradient(cx, S * 0.5, 0, cx, S * 0.5, S * 0.22);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#ff5d8f');
    g.addColorStop(1, '#7a1a3a');
    c.fillStyle = g;
    circle(c, cx, S * 0.5, S * 0.2);
    c.fill();
  }

  drawDoor(c: Ctx, S: number, L: number) {
    this.drawWall(c, S, L, 0, false);
    c.fillStyle = '#2b2f3a';
    rr(c, S * 0.12, S * 0.12, S * 0.76, S * 0.76, S * 0.08);
    c.fill();
    c.fillStyle = '#ffcf3d';
    for (let k = 0; k < 4; k++) c.fillRect(S * (0.2 + k * 0.17), S * 0.18, S * 0.07, S * 0.64);
    c.fillStyle = '#ff4d3d';
    circle(c, S / 2, S / 2, S * 0.08);
    c.fill();
  }

  // ───────── camada de piso (estática) ─────────
  renderFloor(w: number, h: number, floor: Uint8Array, tiles: Uint8Array): HTMLCanvasElement {
    const S = this.S;
    const [cv, c] = makeCanvas(w * S, h * S);
    const a = this.art;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const px = x * S,
          py = y * S;
        const fl = floor[i];
        c.fillStyle = (x + y) % 2 ? a.floorA : a.floorB;
        c.fillRect(px, py, S, S);
        this.floorDetail(c, px, py, S, x, y);
        if (fl === F.Ice) this.iceTile(c, px, py, S, x, y);
        if (fl === F.Pit) this.pitTile(c, px, py, S, x, y, floor, w, h);
        if (fl === F.BaseA || fl === F.BaseB) {
          c.fillStyle = fl === F.BaseA ? 'rgba(255,120,60,0.28)' : 'rgba(80,170,255,0.28)';
          c.fillRect(px, py, S, S);
          c.strokeStyle = fl === F.BaseA ? 'rgba(255,140,80,0.6)' : 'rgba(110,190,255,0.6)';
          c.lineWidth = S * 0.04;
          c.strokeRect(px + S * 0.1, py + S * 0.1, S * 0.8, S * 0.8);
        }
        if (fl === F.Zone) {
          c.fillStyle = 'rgba(255,209,102,0.2)';
          c.fillRect(px, py, S, S);
        }
        if (fl === F.Exit) {
          c.fillStyle = '#1b1530';
          rr(c, px + S * 0.08, py + S * 0.08, S * 0.84, S * 0.84, S * 0.16);
          c.fill();
        }
        if (fl === F.Plate) {
          c.fillStyle = '#6a6f7c';
          rr(c, px + S * 0.18, py + S * 0.18, S * 0.64, S * 0.64, S * 0.1);
          c.fill();
          c.fillStyle = '#9aa0ad';
          rr(c, px + S * 0.24, py + S * 0.22, S * 0.52, S * 0.5, S * 0.08);
          c.fill();
        }
        if (fl === F.Vent) {
          c.fillStyle = '#1a0d0a';
          rr(c, px + S * 0.14, py + S * 0.14, S * 0.72, S * 0.72, S * 0.18);
          c.fill();
          c.strokeStyle = '#4a2a20';
          c.lineWidth = S * 0.04;
          for (let k = 0; k < 3; k++) {
            c.beginPath();
            c.moveTo(px + S * 0.24, py + S * (0.32 + k * 0.18));
            c.lineTo(px + S * 0.76, py + S * (0.32 + k * 0.18));
            c.stroke();
          }
        }
        if (fl === F.Teleport) {
          c.fillStyle = '#12102a';
          circle(c, px + S / 2, py + S / 2, S * 0.4);
          c.fill();
          c.strokeStyle = '#6a5acd';
          c.lineWidth = S * 0.05;
          circle(c, px + S / 2, py + S / 2, S * 0.38);
          c.stroke();
        }
      }
    // Oclusão ambiente sob paredes (sombra suave no piso ao sul/leste de sólidos fixos)
    c.save();
    c.fillStyle = a.shadow;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = tiles[y * w + x];
        if (t === T.Wall || t === T.Pillar) {
          c.fillRect(x * S + S * 0.15, y * S + S, S, S * 0.22);
          if (x + 1 < w) c.fillRect(x * S + S, y * S + S * 0.15, S * 0.14, S);
        }
      }
    c.restore();
    return cv;
  }

  floorDetail(c: Ctx, px: number, py: number, S: number, x: number, y: number) {
    const a = this.art;
    const r = h2(x, y);
    c.save();
    switch (a.floorStyle) {
      case 'terracotta':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.03);
        c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
        if (r < 0.25) {
          c.fillStyle = withAlpha(a.floorDetail, 0.5);
          circle(c, px + S * (0.3 + r), py + S * (0.3 + h2(y, x)), S * 0.05);
          c.fill();
        }
        if (r > 0.9) {
          // confete
          c.fillStyle = ['#ff5d8f', '#ffd166', '#4cc9f0'][((r * 100) | 0) % 3];
          c.fillRect(px + S * h2(x, y, 3), py + S * h2(x, y, 4), S * 0.06, S * 0.03);
        }
        break;
      case 'plate':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.04);
        c.strokeRect(px + 1, py + 1, S - 2, S - 2);
        c.fillStyle = a.floorDetail;
        for (const [ox, oy] of [
          [0.12, 0.12],
          [0.88, 0.12],
          [0.12, 0.88],
          [0.88, 0.88],
        ]) {
          circle(c, px + S * ox, py + S * oy, S * 0.025);
          c.fill();
        }
        if (r > 0.8) {
          c.strokeStyle = withAlpha('#000000', 0.15);
          c.beginPath();
          for (let k = 0; k < 4; k++) {
            c.moveTo(px + S * 0.25, py + S * (0.3 + k * 0.12));
            c.lineTo(px + S * 0.75, py + S * (0.3 + k * 0.12));
          }
          c.stroke();
        }
        break;
      case 'lab':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.02);
        c.strokeRect(px + 0.5, py + 0.5, S / 2, S / 2);
        c.strokeRect(px + S / 2, py + S / 2, S / 2 - 0.5, S / 2 - 0.5);
        if (r > 0.85) {
          c.fillStyle = withAlpha('#7fd8ff', 0.25);
          c.fillRect(px + S * 0.1, py + S * 0.1, S * 0.3, S * 0.3);
        }
        break;
      case 'rune':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.03);
        c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
        if (r > 0.82) {
          c.strokeStyle = withAlpha(a.floorDetail, 0.6);
          c.lineWidth = S * 0.025;
          c.beginPath();
          c.arc(px + S / 2, py + S / 2, S * 0.18, 0, Math.PI * 1.4);
          c.stroke();
        }
        break;
      case 'moss':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.03);
        c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
        c.fillStyle = withAlpha('#7fc76f', 0.35);
        for (let k = 0; k < 3; k++) {
          if (h2(x, y, k) > 0.55) {
            ellipse(c, px + S * h2(x, y, k + 5), py + S * h2(y, x, k + 9), S * 0.12, S * 0.07);
            c.fill();
          }
        }
        break;
      case 'panel':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.04);
        c.strokeRect(px + 1, py + 1, S - 2, S - 2);
        if (r > 0.7) {
          c.strokeStyle = withAlpha(a.floorDetail, 0.35);
          c.lineWidth = S * 0.02;
          c.beginPath();
          c.moveTo(px + S * 0.2, py + S * 0.5);
          c.lineTo(px + S * 0.8, py + S * 0.5);
          c.stroke();
        }
        break;
      case 'basalt':
        c.strokeStyle = a.grout;
        c.lineWidth = Math.max(1, S * 0.035);
        c.strokeRect(px + 1, py + 1, S - 2, S - 2);
        if (r > 0.75) {
          c.strokeStyle = withAlpha('#ff6a00', 0.45);
          c.lineWidth = S * 0.02;
          c.beginPath();
          c.moveTo(px + S * 0.2, py + S * (0.2 + r * 0.3));
          c.lineTo(px + S * 0.5, py + S * 0.5);
          c.lineTo(px + S * 0.8, py + S * 0.7);
          c.stroke();
        }
        break;
      case 'grid':
        c.strokeStyle = withAlpha('#ff3cac', 0.12);
        c.lineWidth = Math.max(1, S * 0.02);
        c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
        break;
    }
    c.restore();
  }

  iceTile(c: Ctx, px: number, py: number, S: number, x: number, y: number) {
    const g = c.createLinearGradient(px, py, px + S, py + S);
    g.addColorStop(0, 'rgba(215,245,255,0.95)');
    g.addColorStop(1, 'rgba(160,220,245,0.95)');
    c.fillStyle = g;
    c.fillRect(px, py, S, S);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = Math.max(1, S * 0.025);
    c.beginPath();
    const r = h2(x, y);
    c.moveTo(px + S * 0.15, py + S * (0.3 + r * 0.2));
    c.lineTo(px + S * 0.4, py + S * 0.15);
    c.moveTo(px + S * 0.55, py + S * 0.8);
    c.lineTo(px + S * 0.85, py + S * (0.55 + r * 0.1));
    c.stroke();
    c.strokeStyle = 'rgba(120,190,220,0.5)';
    c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
  }

  pitTile(c: Ctx, px: number, py: number, S: number, x: number, y: number, floor: Uint8Array, w: number, h: number) {
    c.fillStyle = '#02030a';
    c.fillRect(px, py, S, S);
    for (let k = 0; k < 4; k++) {
      c.fillStyle = `rgba(255,255,255,${0.3 + h2(x, y, k) * 0.6})`;
      c.fillRect(px + S * h2(x, y, k + 1), py + S * h2(y, x, k + 2), Math.max(1, S * 0.03), Math.max(1, S * 0.03));
    }
    // borda superior (lábio da plataforma)
    const up = y > 0 ? floor[(y - 1) * w + x] : 0;
    if (up !== F.Pit) {
      c.fillStyle = '#3a4468';
      c.fillRect(px, py, S, S * 0.22);
      c.fillStyle = '#1a203a';
      c.fillRect(px, py + S * 0.22, S, S * 0.06);
    }
    void h;
  }
}
