/**
 * AmbientBackground — lightweight atmosphere layer for non-battle scenes.
 *
 * Adds three stacked elements at very low depth so existing scene content
 * (cards, panels, text) naturally draws on top:
 *
 *   1. Radial "lantern" glow  — subtle warm spotlight at center-top
 *   2. Corner vignette        — soft black fade at screen edges
 *   3. Ambient dust particles — slow drifting motes adding "alive" feel
 *
 * Usage:
 *   import { applyAmbientBackground } from '../ui/AmbientBackground';
 *   applyAmbientBackground(this);   // call once in scene.create()
 *
 * Design notes:
 * - All layers use setScrollFactor(0) so they stay fixed during camera moves.
 * - Depth range: -1000 .. -990. Scene content should live at depth >= 0.
 * - Dust uses a single Graphics texture pool to avoid per-frame allocation.
 * - Safe to call multiple times: idempotent via data key `ambientApplied`.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL } from '../constants/colors';

const AMBIENT_FLAG = 'ambientApplied';
const CASUAL_BG_FLAG = 'casualBgApplied';

/**
 * Bright casual-toy backdrop — warm vertical gradient, soft sun glow, and
 * playful polka dots. Matches the home scene's buildBackground so every scene
 * shares the same friendly storybook frame. Idempotent per scene instance.
 */
export function applyCasualBackground(scene: Phaser.Scene): void {
  if (scene.data?.get(CASUAL_BG_FLAG)) return;
  scene.data?.set(CASUAL_BG_FLAG, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.data?.set(CASUAL_BG_FLAG, false);
  });

  const bg = scene.add.graphics().setScrollFactor(0).setDepth(-1000);
  bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bg.fillStyle(0xfff7e4, 0.5);
  bg.fillEllipse(CANVAS_WIDTH / 2, 30, CANVAS_WIDTH * 1.5, 240);
  bg.fillStyle(CASUAL.BG_DOT, 0.16);
  for (let row = 0, y = 70; y < CANVAS_HEIGHT; y += 60, row++) {
    for (let x = (row % 2) * 30 + 16; x < CANVAS_WIDTH; x += 60) bg.fillCircle(x, y, 3.5);
  }
}

// Reset flag on shutdown so subsequent CREATE re-applies atmosphere.
function bindShutdownReset(scene: Phaser.Scene): void {
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.data?.set(AMBIENT_FLAG, false);
  });
}

interface AmbientOptions {
  /** Spawn drifting dust motes. Default: true. */
  dust?: boolean;
  /** Warm radial glow at top. Default: true. */
  radial?: boolean;
  /** Corner vignette darkening. Default: true. */
  vignette?: boolean;
  /** Tint of the radial glow (24-bit hex). Default: 0xffd488 (warm torch). */
  radialColor?: number;
}

/**
 * Apply ambient atmosphere layers to a scene. Idempotent.
 */
export function applyAmbientBackground(
  scene: Phaser.Scene,
  options: AmbientOptions = {},
): void {
  // Guard: skip if already applied to this scene instance
  if (scene.data?.get(AMBIENT_FLAG)) return;
  scene.data?.set(AMBIENT_FLAG, true);
  bindShutdownReset(scene);

  const {
    dust = true,
    radial = true,
    vignette = true,
    radialColor = 0xffd488,
  } = options;

  if (radial) {
    drawRadialGlow(scene, radialColor);
  }
  if (vignette) {
    drawVignette(scene);
  }
  if (dust) {
    spawnDustParticles(scene);
  }
}

/**
 * Warm radial glow — simulates torchlight descending from above.
 * Drawn as a stack of concentric circles with decreasing alpha.
 */
function drawRadialGlow(scene: Phaser.Scene, color: number): void {
  const g = scene.add.graphics();
  g.setScrollFactor(0).setDepth(-1000);

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT * 0.28;
  const maxR = CANVAS_HEIGHT * 0.95;

  // Concentric fill: 18 rings from edge to center, inner = brighter
  const RINGS = 18;
  for (let i = RINGS; i >= 1; i--) {
    const t = i / RINGS;
    const r = maxR * t;
    // ease-in for brightness: center rings are disproportionately brighter
    const alpha = (1 - t) * (1 - t) * 0.14;
    g.fillStyle(color, alpha);
    g.fillCircle(cx, cy, r);
  }
}

/**
 * Corner vignette — darkens the four corners of the screen.
 * Uses 4 quadrant radial fades implemented as concentric arcs.
 */
function drawVignette(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.setScrollFactor(0).setDepth(-995);

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  // Draw inverse radial: darker toward edges.
  // 14 rings where OUTER rings have higher alpha.
  const RINGS = 14;
  for (let i = 0; i < RINGS; i++) {
    const t = i / RINGS;
    const r = maxR * (0.55 + t * 0.5);
    // outer rings = higher alpha (quadratic ramp)
    const alpha = t * t * 0.35;
    g.fillStyle(0x000000, alpha);
    g.fillCircle(cx, cy, r);
  }

  // Top strip darken — adds weight under status bar / header
  g.fillStyle(0x000000, 0.18);
  g.fillRect(0, 0, CANVAS_WIDTH, 24);

  // Bottom strip darken — same treatment
  g.fillStyle(0x000000, 0.22);
  g.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
}

/**
 * Ambient dust motes — 12 slow-drifting circles.
 * Each mote tweens in a loop with random duration + delay so motion is
 * never in sync. Motes are cleaned up on scene shutdown automatically
 * (tweens + gameObjects destroyed with the scene).
 */
function spawnDustParticles(scene: Phaser.Scene): void {
  const DUST_COUNT = 12;
  const colors = [0xffd488, 0xffe4a8, 0xffb866] as const;

  for (let i = 0; i < DUST_COUNT; i++) {
    const startX = Phaser.Math.Between(0, CANVAS_WIDTH);
    const startY = Phaser.Math.Between(0, CANVAS_HEIGHT);
    const size = Phaser.Math.FloatBetween(1.2, 2.6);
    const color = colors[i % colors.length];

    const dot = scene.add.graphics();
    dot.setScrollFactor(0).setDepth(-990);
    dot.fillStyle(color, 0.55);
    dot.fillCircle(0, 0, size);
    dot.setPosition(startX, startY);
    dot.setAlpha(0);

    driftDust(scene, dot, i);
  }
}

/**
 * Recursive drift animation: fade in → slow drift → fade out → reset.
 * Uses scene.tweens so cleanup on shutdown is automatic.
 */
function driftDust(
  scene: Phaser.Scene,
  dot: Phaser.GameObjects.Graphics,
  index: number,
): void {
  const duration = Phaser.Math.Between(5200, 9000);
  const driftX = Phaser.Math.Between(-30, 30);
  const driftY = Phaser.Math.Between(-60, -20); // motes rise upward
  const delay = index * 340;

  dot.setAlpha(0);
  const startX = dot.x;
  const startY = dot.y;

  scene.tweens.add({
    targets: dot,
    alpha: { from: 0, to: 0.7 },
    duration: 1200,
    delay,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      scene.tweens.add({
        targets: dot,
        x: startX + driftX,
        y: startY + driftY,
        alpha: 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Reset to a new random position, loop forever
          if (!dot.active) return;
          dot.setPosition(
            Phaser.Math.Between(0, CANVAS_WIDTH),
            Phaser.Math.Between(CANVAS_HEIGHT * 0.4, CANVAS_HEIGHT),
          );
          driftDust(scene, dot, 0);
        },
      });
    },
  });
}
