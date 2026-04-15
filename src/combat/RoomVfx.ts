// ─── Room VFX ─────────────────────────────────────────────────────────────────
// Visual effects specific to room building / upgrading and the targeting UI.
// Extracted from DungeonScene to keep pure rendering logic out of the scene.

import Phaser from 'phaser';
import { COLORS } from '../constants/colors';
import { CANVAS_WIDTH, GRID_X, GRID_Y } from '../constants/layout';

// ─── Coin-fly effect ─────────────────────────────────────────────────────────
// Two golden coins arc from the kill position toward the gold HUD pill.

export function spawnCoinFlyEffect(
  scene:  Phaser.Scene,
  fromX:  number,
  fromY:  number,
): void {
  // Gold HUD pill center: UIScene positions it at CANVAS_WIDTH-196+45, safeTop+23.
  // Use approximate target (safe-area top is unknown here → target top bar area).
  const targetX = CANVAS_WIDTH - 151;
  const targetY = 23;

  for (let i = 0; i < 2; i++) {
    const coin = scene.add.graphics().setDepth(290);
    coin.fillStyle(COLORS.TORCH_GOLD, 1);
    coin.fillCircle(0, 0, 4);
    coin.fillStyle(0xffe066, 0.5);
    coin.fillCircle(-1, -1, 2);
    coin.setPosition(fromX + (i === 0 ? -6 : 6), fromY);
    scene.tweens.add({
      targets: coin,
      x: targetX + (Math.random() * 10 - 5),
      y: targetY,
      scaleX: 0.5, scaleY: 0.5,
      alpha: { from: 1, to: 0 },
      duration: 420 + i * 60,
      ease: 'Power2.easeIn',
      delay: i * 40,
      onComplete: () => coin.destroy(),
    });
  }
}

// ─── Build particles ─────────────────────────────────────────────────────────
// Gold-tinted dust burst played when a room is built or upgraded.

export function spawnBuildParticles(scene: Phaser.Scene, x: number, y: number): void {
  const e = scene.add.particles(x, y, 'dust', {
    speed: { min: 25, max: 90 }, angle: { min: 0, max: 360 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [COLORS.STONE_DARK, COLORS.STONE_MID, COLORS.TORCH_GOLD],
    lifespan: 420, quantity: 12, frequency: -1,
  }).setDepth(45);
  e.explode(12);
  scene.time.delayedCall(500, () => e.destroy());
}

// ─── Attack range preview ─────────────────────────────────────────────────────
// Draws a semi-transparent dashed ring showing a room's attack range.
// Returns the created Graphics object so the caller can store it and later
// pass it to hideRangePreview().

export function showRangePreview(
  scene:    Phaser.Scene,
  row:      number,
  col:      number,
  range:    number,
  cellSize: number,
): Phaser.GameObjects.Graphics | undefined {
  if (range <= 0) return undefined;

  const cx  = GRID_X + col * cellSize + cellSize / 2;
  const cy  = GRID_Y + row * cellSize + cellSize / 2;
  const r   = range * cellSize * 0.85;

  const gfx = scene.add.graphics().setDepth(8).setAlpha(0);

  // Filled tinted area
  gfx.fillStyle(0xffcc44, 0.12);
  gfx.fillCircle(cx, cy, r);

  // Dashed stroke (simulated with arc segments)
  const segCount = 24;
  const segGap   = 0.08;
  for (let s = 0; s < segCount; s++) {
    const startAngle = (s / segCount) * Math.PI * 2 - Math.PI / 2;
    const endAngle   = startAngle + (Math.PI * 2 / segCount) - segGap;
    gfx.lineStyle(1.8, 0xffdd66, 0.85);
    gfx.beginPath();
    gfx.arc(cx, cy, r, startAngle, endAngle, false);
    gfx.strokePath();
  }

  // Center crosshair on the room
  gfx.lineStyle(1, 0xffdd66, 0.5);
  gfx.strokeCircle(cx, cy, cellSize * 0.45);

  // Fade in
  scene.tweens.add({ targets: gfx, alpha: 1, duration: 150, ease: 'Power1.easeOut' });

  return gfx;
}

// ─── Hide range preview ───────────────────────────────────────────────────────
// Fades out and destroys the graphics returned by showRangePreview().

export function hideRangePreview(
  scene: Phaser.Scene,
  gfx:   Phaser.GameObjects.Graphics,
): void {
  scene.tweens.add({
    targets: gfx, alpha: 0, duration: 120, ease: 'Power1.easeIn',
    onComplete: () => gfx.destroy(),
  });
}
