/**
 * Chibi-style invader silhouette shapes — dispatcher.
 *
 * Drawing logic is split by chapter:
 *   - InvaderShapesCh1_3.ts  (Ch1-3 invaders)
 *   - InvaderShapesCh4_6.ts  (Ch4-6 invaders)
 */

import type { InvaderDef } from '../data/invaders';
import { darken, drawEyes, computeLayout } from './invaderShapeHelpers';
import { drawCh1_3 } from './InvaderShapesCh1_3';
import { drawCh4_6 } from './InvaderShapesCh4_6';
import { drawCh7 } from './InvaderShapesCh7';

// ─── Main drawing function ───────────────────────────────────────────────────

export function drawInvaderShape(g: Phaser.GameObjects.Graphics, type: string, def: InvaderDef): void {
  const layout = computeLayout(def.radius, def.color);

  if (drawCh1_3(g, type, layout)) return;
  if (drawCh4_6(g, type, layout)) return;
  if (drawCh7(g, type, layout)) return;

  // Fallback: generic cute circle with eyes
  const { cx, cy, r, fill } = layout;
  g.fillStyle(fill, 0.88);
  g.fillCircle(cx, cy, r * 0.78);
  drawEyes(g, cx, cy - r * 0.08, r * 0.78);
  g.lineStyle(1.5, darken(fill, 0.5), 0.6);
  g.strokeCircle(cx, cy, r * 0.78);
}
