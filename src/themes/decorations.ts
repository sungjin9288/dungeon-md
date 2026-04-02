/**
 * Procedural cave decoration drawing utilities.
 * All functions draw into a Phaser.GameObjects.Graphics — no external assets needed.
 */

import type { DungeonTheme } from './DungeonTheme';

// Simple seeded pseudo-random for deterministic decorations
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Stalactites ──────────────────────────────────────────────────────────────

/** Draw stalactites hanging down from y across the given width */
export function drawStalactites(
  g: Phaser.GameObjects.Graphics,
  theme: DungeonTheme,
  y: number,
  width: number,
  seed = 42,
): void {
  const rng = seededRandom(seed);
  const count = 10 + Math.floor(rng() * 4);
  let x = 8 + rng() * 20;

  for (let i = 0; i < count && x < width - 8; i++) {
    const h   = 10 + rng() * 18;          // height 10–28
    const w   = 6 + rng() * 8;            // base width 6–14
    const jx  = (rng() - 0.5) * 3;        // slight jitter

    // Outer (dark)
    g.fillStyle(theme.stoneDark, 0.9);
    g.fillTriangle(
      x - w / 2,     y,
      x + w / 2,     y,
      x + jx,        y + h,
    );
    // Inner (lighter core)
    g.fillStyle(theme.stoneMid, 0.5);
    g.fillTriangle(
      x - w / 4,     y,
      x + w / 4,     y,
      x + jx,        y + h * 0.7,
    );
    // Wet tip highlight
    g.fillStyle(theme.glowColor, 0.12);
    g.fillCircle(x + jx, y + h - 1, 1.5);

    x += 24 + rng() * 22;
  }
}

// ── Stalagmites ──────────────────────────────────────────────────────────────

/** Draw stalagmites growing up from y across the given width */
export function drawStalagmites(
  g: Phaser.GameObjects.Graphics,
  theme: DungeonTheme,
  y: number,
  width: number,
  seed = 77,
): void {
  const rng = seededRandom(seed);
  const count = 8 + Math.floor(rng() * 4);
  let x = 12 + rng() * 24;

  for (let i = 0; i < count && x < width - 8; i++) {
    const h  = 6 + rng() * 12;            // shorter than stalactites
    const w  = 5 + rng() * 7;
    const jx = (rng() - 0.5) * 2;

    g.fillStyle(theme.stoneDark, 0.85);
    g.fillTriangle(
      x - w / 2,  y,
      x + w / 2,  y,
      x + jx,     y - h,
    );
    g.fillStyle(theme.stoneMid, 0.4);
    g.fillTriangle(
      x - w / 4,  y,
      x + w / 4,  y,
      x + jx,     y - h * 0.65,
    );

    x += 28 + rng() * 20;
  }
}

// ── Cave wall texture ────────────────────────────────────────────────────────

/** Draw horizontal rock strata lines for a sedimentary-rock feel */
export function drawCaveWallTexture(
  g: Phaser.GameObjects.Graphics,
  theme: DungeonTheme,
  x: number, y: number, w: number, h: number,
  seed = 123,
): void {
  const rng = seededRandom(seed);
  let cy = y + 4;
  while (cy < y + h) {
    const band = 8 + rng() * 16;
    const a    = 0.02 + rng() * 0.04;
    g.fillStyle(theme.stoneLight, a);
    g.fillRect(x, cy, w, Math.min(band * 0.4, 3));
    cy += band;
  }
}

// ── Rough-edge rectangle ─────────────────────────────────────────────────────

/**
 * Draw a filled rectangle with rough/natural edges (cave alcove look).
 * Replaces fillRoundedRect for organic feel.
 */
export function drawRoughEdgeRect(
  g: Phaser.GameObjects.Graphics,
  fillColor: number,
  fillAlpha: number,
  x: number, y: number, w: number, h: number,
  seed = 0,
): void {
  const rng = seededRandom(seed);
  const jitter = () => (rng() - 0.5) * 4;   // ±2px displacement
  const pts: Array<{ x: number; y: number }> = [];

  // Top edge (left → right)
  pts.push({ x: x + 2 + jitter(), y: y + jitter() });
  pts.push({ x: x + w * 0.3 + jitter(), y: y + jitter() });
  pts.push({ x: x + w * 0.6 + jitter(), y: y + jitter() });
  pts.push({ x: x + w - 2 + jitter(), y: y + jitter() });

  // Right edge (top → bottom)
  pts.push({ x: x + w + jitter(), y: y + h * 0.3 + jitter() });
  pts.push({ x: x + w + jitter(), y: y + h * 0.7 + jitter() });

  // Bottom edge (right → left)
  pts.push({ x: x + w - 2 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + w * 0.6 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + w * 0.3 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + 2 + jitter(), y: y + h + jitter() });

  // Left edge (bottom → top)
  pts.push({ x: x + jitter(), y: y + h * 0.7 + jitter() });
  pts.push({ x: x + jitter(), y: y + h * 0.3 + jitter() });

  g.fillStyle(fillColor, fillAlpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}

/** Stroke version of rough-edge rect */
export function strokeRoughEdgeRect(
  g: Phaser.GameObjects.Graphics,
  strokeColor: number,
  strokeAlpha: number,
  lineWidth: number,
  x: number, y: number, w: number, h: number,
  seed = 0,
): void {
  const rng = seededRandom(seed);
  const jitter = () => (rng() - 0.5) * 4;
  const pts: Array<{ x: number; y: number }> = [];

  pts.push({ x: x + 2 + jitter(), y: y + jitter() });
  pts.push({ x: x + w * 0.3 + jitter(), y: y + jitter() });
  pts.push({ x: x + w * 0.6 + jitter(), y: y + jitter() });
  pts.push({ x: x + w - 2 + jitter(), y: y + jitter() });
  pts.push({ x: x + w + jitter(), y: y + h * 0.3 + jitter() });
  pts.push({ x: x + w + jitter(), y: y + h * 0.7 + jitter() });
  pts.push({ x: x + w - 2 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + w * 0.6 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + w * 0.3 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + 2 + jitter(), y: y + h + jitter() });
  pts.push({ x: x + jitter(), y: y + h * 0.7 + jitter() });
  pts.push({ x: x + jitter(), y: y + h * 0.3 + jitter() });

  g.lineStyle(lineWidth, strokeColor, strokeAlpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.strokePath();
}

// ── Water drip effect ────────────────────────────────────────────────────────

/** Create a repeating water-drip effect at the given position */
export function addWaterDrip(
  scene: Phaser.Scene,
  theme: DungeonTheme,
  x: number,
  startY: number,
  endY: number,
  depth = 16,
): void {
  const delay = 2000 + Math.random() * 3000;

  const doDrip = () => {
    const drop = scene.add.circle(x, startY, 2, theme.glowColor, 0.6).setDepth(depth);
    scene.tweens.add({
      targets: drop,
      y: endY,
      alpha: 0.3,
      duration: 800,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Splash
        for (let i = 0; i < 3; i++) {
          const sp = scene.add.circle(
            x + (Math.random() - 0.5) * 8,
            endY,
            1.5,
            theme.glowColor,
            0.4,
          ).setDepth(depth);
          scene.tweens.add({
            targets: sp,
            y: endY - 3 - Math.random() * 4,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 400,
            onComplete: () => sp.destroy(),
          });
        }
        drop.destroy();
      },
    });
  };

  scene.time.addEvent({ delay, callback: doDrip, loop: true });
  // First drip after a short random offset
  scene.time.delayedCall(Math.random() * 1500, doDrip);
}
