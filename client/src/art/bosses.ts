import type { Enemy, Game } from '@estopim/shared';
import { circle, ellipse, rr, type Ctx } from './draw';

/** Chefes: desenho genérico (substituído por versões dedicadas por chefe). */
export function drawBoss(c: Ctx, x: number, y: number, S: number, e: Enemy, t: number, _g: Game) {
  const R = S * e.size * 0.45;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  ellipse(c, x, y, R, R * 0.3);
  c.fill();
  c.fillStyle = '#4a3a6a';
  rr(c, x - R, y - R * 2, R * 2, R * 2, R * 0.4);
  c.fill();
  c.fillStyle = '#ff3a5a';
  circle(c, x, y - R, R * (0.25 + 0.05 * Math.sin(t * 6)));
  c.fill();
}
