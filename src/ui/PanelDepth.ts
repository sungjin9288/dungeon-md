/**
 * PanelDepth — reusable drop-shadow + inner-glow helpers for cards/panels.
 *
 * Phaser has no built-in filter/blur, so we approximate shadows with a stack
 * of offset graphics at decreasing alpha. This gives a soft, readable
 * drop shadow that separates cards from the background and adds perceived
 * depth without heavy GPU cost.
 *
 * Usage:
 *   import { addPanelShadow, addInnerGlow } from '../ui/PanelDepth';
 *   // BEFORE drawing the card:
 *   const shadow = addPanelShadow(this, x, y, w, h, 10);
 *   container.addAt(shadow, 0); // put underneath
 *   // AFTER drawing the card:
 *   const glow = addInnerGlow(this, x, y, w, h, 10, 0x4466aa);
 *   container.add(glow);
 */

import Phaser from 'phaser';

/**
 * Draws a soft drop shadow behind a rectangular panel.
 * Renders 4 stacked shapes with increasing offset and decreasing alpha.
 *
 * @returns Graphics object — caller is responsible for adding to container
 *          and destroying on cleanup.
 */
export function addPanelShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  opts: { offsetY?: number; color?: number; opacity?: number } = {},
): Phaser.GameObjects.Graphics {
  const { offsetY = 4, color = 0x000000, opacity = 0.55 } = opts;

  const g = scene.add.graphics();

  // 4 layers, each one larger + softer = approximates gaussian blur
  const layers = [
    { dx: 0, dy: offsetY + 3, spread: 6, alpha: opacity * 0.18 },
    { dx: 0, dy: offsetY + 2, spread: 4, alpha: opacity * 0.28 },
    { dx: 0, dy: offsetY + 1, spread: 2, alpha: opacity * 0.42 },
    { dx: 0, dy: offsetY,     spread: 0, alpha: opacity * 0.55 },
  ];

  for (const layer of layers) {
    g.fillStyle(color, layer.alpha);
    g.fillRoundedRect(
      x - layer.spread,
      y - layer.spread + layer.dy,
      w + layer.spread * 2,
      h + layer.spread * 2,
      radius + layer.spread,
    );
  }

  return g;
}

/**
 * Draws a subtle inner glow highlight at the top of a panel — simulates
 * light catching the top bevel and gives the card a "lit from above" feel.
 *
 * @returns Graphics object.
 */
export function addInnerGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  _h: number,
  radius: number,
  color: number = 0xffffff,
  opacity: number = 0.12,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();

  // Top highlight strip — gradient approximation via 3 stacked rects
  const strips = [
    { yOff: 1, h: 2, alpha: opacity * 1.0 },
    { yOff: 3, h: 3, alpha: opacity * 0.55 },
    { yOff: 6, h: 4, alpha: opacity * 0.25 },
  ];

  for (const s of strips) {
    g.fillStyle(color, s.alpha);
    g.fillRoundedRect(x + 2, y + s.yOff, w - 4, s.h, radius * 0.4);
  }

  return g;
}

/**
 * Combined helper: adds shadow below + inner glow on top of a card region.
 * Returns both graphics so caller can place them in a container.
 *
 * The shadow should be added BEFORE the card body (lower z-order), the
 * glow AFTER (higher z-order).
 */
export function addPanelDepth(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  opts: {
    shadowColor?: number;
    shadowOpacity?: number;
    shadowOffsetY?: number;
    glowColor?: number;
    glowOpacity?: number;
  } = {},
): { shadow: Phaser.GameObjects.Graphics; glow: Phaser.GameObjects.Graphics } {
  const shadow = addPanelShadow(scene, x, y, w, h, radius, {
    color: opts.shadowColor,
    opacity: opts.shadowOpacity,
    offsetY: opts.shadowOffsetY,
  });
  const glow = addInnerGlow(
    scene,
    x,
    y,
    w,
    h,
    radius,
    opts.glowColor,
    opts.glowOpacity,
  );
  return { shadow, glow };
}
