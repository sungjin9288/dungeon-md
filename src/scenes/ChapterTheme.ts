import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_Y, GRID_ROWS } from '../constants/layout';
import { logger } from '../utils/logger';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── applyChapterTheme ────────────────────────────────────────────────────────
//
// Extracted from DungeonScene. Each chapter applies a distinct ambient visual
// theme on top of the base dungeon background.
//
// Usage:
//   applyChapterTheme(this, this.stageChapter, this.effectiveCellSize);

export function applyChapterTheme(
  scene: Phaser.Scene,
  chapter: number,
  effectiveCellSize: number,
): void {
  // Every chapter theme is purely decorative ambient (alpha-pulse overlays,
  // drifting particles, animated caustics/rings). Under reduced motion the
  // static themed backdrop still draws; only the perpetual motion is skipped.
  const reducedMotion = getReducedMotion();
  switch (chapter) {
    case 2: applyChapter2Theme(scene, effectiveCellSize, reducedMotion); break;
    case 3: applyChapter3Theme(scene, effectiveCellSize, reducedMotion); break;
    case 4: applyChapter4Theme(scene, effectiveCellSize, reducedMotion); break;
    case 5: applyChapter5Theme(scene, effectiveCellSize, reducedMotion); break;
    case 6: applyChapter6Theme(scene, effectiveCellSize, reducedMotion); break;
    case 7: applyChapter7Theme(scene, effectiveCellSize, reducedMotion); break;
    case 8: applyChapter8Theme(scene, effectiveCellSize, reducedMotion); break;
    case 9: applyChapter9Theme(scene, effectiveCellSize, reducedMotion); break;
    // Chapter 1 has no overlay theme
  }
}

// ─── Ch2: Teal Forest Mist ────────────────────────────────────────────────────

function applyChapter2Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  const mist = scene.add.graphics().setDepth(5);
  mist.fillStyle(0x00283c, 1);
  mist.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  mist.setAlpha(0.12);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: mist,
      alpha: { from: 0.08, to: 0.18 },
      duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const cs = effectiveCellSize;
    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -4, max: 4 }, speedY: { min: -8, max: -3 },
      alpha: { min: 0.04, max: 0.12 },
      scale: { min: 0.4, max: 1.0 },
      tint: 0x1aff9b,
      lifespan: { min: 5000, max: 10000 }, frequency: 500, quantity: 1,
    }).setDepth(31);
  }

  logger.debug('[CH2 THEME] teal mist applied');
}

// ─── Ch3: Underwater Palace ───────────────────────────────────────────────────

function applyChapter3Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  const water = scene.add.graphics().setDepth(5);
  water.fillStyle(0x001830, 1);
  water.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  water.setAlpha(0.18);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: water,
      alpha: { from: 0.12, to: 0.24 },
      duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Caustic light pattern (animated blue ripples on floor)
    const caustic = scene.add.graphics().setDepth(6);
    const drawCaustics = () => {
      caustic.clear();
      const t = scene.time.now * 0.001;
      for (let i = 0; i < 8; i++) {
        const cx = 40 + i * 44 + Math.sin(t * 1.2 + i) * 10;
        const cy = GRID_Y + GRID_ROWS * effectiveCellSize * 0.6 + Math.cos(t + i * 0.7) * 8;
        caustic.lineStyle(1, 0x44aaff, 0.12);
        caustic.strokeEllipse(cx, cy, 30 + Math.sin(t + i) * 8, 16);
      }
    };
    scene.time.addEvent({ delay: 80, repeat: -1, callback: drawCaustics });

    const cs = effectiveCellSize;
    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: 0, max: 20 },
      speedX: { min: -6, max: 6 }, speedY: { min: -30, max: -15 },
      alpha: { min: 0.05, max: 0.2 },
      scale: { min: 0.2, max: 0.6 },
      tint: 0x66ccff,
      lifespan: { min: 3000, max: 6000 }, frequency: 400, quantity: 1,
    }).setDepth(32);
  }

  logger.debug('[CH3 THEME] underwater palace applied');
}

// ─── Ch4: Hell Gate / Underworld ──────────────────────────────────────────────

function applyChapter4Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  const hellOver = scene.add.graphics().setDepth(5);
  hellOver.fillStyle(0x200000, 1);
  hellOver.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  hellOver.setAlpha(0.22);
  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: hellOver, alpha: { from: 0.15, to: 0.30 },
      duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: 0, max: 20 },
      speedX: { min: -8, max: 8 }, speedY: { min: -50, max: -20 },
      alpha: { min: 0.08, max: 0.25 },
      scale: { min: 0.15, max: 0.5 },
      tint: [0xff4400, 0xff8800, 0xffcc00],
      lifespan: { min: 2000, max: 4000 }, frequency: 200, quantity: 1,
    }).setDepth(32);
  }

  const cracks = scene.add.graphics().setDepth(7);
  cracks.lineStyle(1, 0xff2200, 0.18);
  for (let i = 0; i < 6; i++) {
    const sx = 30 + i * 60, sy = GRID_Y + GRID_ROWS * cs;
    cracks.lineBetween(sx, sy, sx + 20, sy - 30);
    cracks.lineBetween(sx + 20, sy - 30, sx + 35, sy - 20);
  }

  logger.debug('[CH4 THEME] hell gate applied');
}

// ─── Ch5: Mountain / Celestial ────────────────────────────────────────────────

function applyChapter5Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  const celestial = scene.add.graphics().setDepth(5);
  celestial.fillStyle(0x201000, 1);
  celestial.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  celestial.setAlpha(0.15);
  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: celestial, alpha: { from: 0.10, to: 0.22 },
      duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -5, max: 5 }, speedY: { min: -15, max: -5 },
      alpha: { min: 0.05, max: 0.20 },
      scale: { min: 0.2, max: 0.7 },
      tint: [0xffcc44, 0xffeeaa, 0xffffff],
      lifespan: { min: 4000, max: 8000 }, frequency: 350, quantity: 1,
    }).setDepth(32);
  }

  const mtn = scene.add.graphics().setDepth(8);
  mtn.fillStyle(0x1a1000, 0.6);
  const bY = GRID_Y + GRID_ROWS * cs + 10;
  mtn.fillTriangle(0, bY + 60, 80, bY, 160, bY + 60);
  mtn.fillTriangle(120, bY + 60, 200, bY - 15, 280, bY + 60);
  mtn.fillTriangle(220, bY + 60, 290, bY + 5, 360, bY + 60);

  logger.debug('[CH5 THEME] celestial mountain applied');
}

// ─── Ch6: Void Throne ────────────────────────────────────────────────────────

function applyChapter6Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  const voidMist = scene.add.graphics().setDepth(5);
  voidMist.fillStyle(0x0a0018, 1);
  voidMist.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  voidMist.setAlpha(0.20);
  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: voidMist, alpha: { from: 0.15, to: 0.30 },
      duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -8, max: 8 }, speedY: { min: -20, max: -5 },
      alpha: { min: 0.05, max: 0.25 },
      scale: { min: 0.2, max: 0.8 },
      tint: [0x8844cc, 0xd4af37, 0x6622aa],
      lifespan: { min: 5000, max: 10000 }, frequency: 280, quantity: 1,
    }).setDepth(32);
  }

  const bY = GRID_Y + GRID_ROWS * cs + 10;
  const crystalGfx = scene.add.graphics().setDepth(8);
  crystalGfx.fillStyle(0x8844cc, 0.4);
  crystalGfx.fillTriangle(40, bY + 50, 60, bY, 80, bY + 50);
  crystalGfx.fillTriangle(160, bY + 50, 185, bY - 10, 210, bY + 50);
  crystalGfx.fillTriangle(280, bY + 50, 310, bY + 5, 340, bY + 50);
  crystalGfx.lineStyle(1, 0xd4af37, 0.3);
  crystalGfx.lineBetween(60, bY, 40, bY + 50);
  crystalGfx.lineBetween(60, bY, 80, bY + 50);
  crystalGfx.lineBetween(185, bY - 10, 160, bY + 50);
  crystalGfx.lineBetween(185, bY - 10, 210, bY + 50);
  crystalGfx.lineBetween(310, bY + 5, 280, bY + 50);
  crystalGfx.lineBetween(310, bY + 5, 340, bY + 50);

  logger.debug('[CH6 THEME] void throne applied');
}

// ─── Ch7: Celestial Realm ─────────────────────────────────────────────────────

function applyChapter7Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  // Golden divine radiance overlay
  const divineGlow = scene.add.graphics().setDepth(5);
  divineGlow.fillStyle(0x1a1400, 1);
  divineGlow.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  divineGlow.setAlpha(0.18);

  // Golden holy light shaft from above
  const shaft = scene.add.graphics().setDepth(6);
  shaft.fillStyle(0xffd700, 0.06);
  shaft.fillTriangle(
    CANVAS_WIDTH / 2 - 60, 0,
    CANVAS_WIDTH / 2 + 60, 0,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT,
  );

  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: divineGlow,
      alpha: { from: 0.12, to: 0.28 },
      duration: 3500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: shaft,
      alpha: { from: 0.04, to: 0.10 },
      duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Floating golden stars / holy particles
    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -4, max: 4 }, speedY: { min: -18, max: -6 },
      alpha: { min: 0.08, max: 0.30 },
      scale: { min: 0.15, max: 0.55 },
      tint: [0xffd700, 0xfff0aa, 0xffffff, 0xffcc00],
      lifespan: { min: 4000, max: 9000 }, frequency: 300, quantity: 1,
    }).setDepth(33);
  }

  // Divine pillars along the bottom edge
  const bY = GRID_Y + GRID_ROWS * cs + 10;
  const pillarGfx = scene.add.graphics().setDepth(8);
  pillarGfx.fillStyle(0xffd700, 0.22);
  const pillarPositions = [20, 90, 170, 250, 320];
  pillarPositions.forEach(px => {
    pillarGfx.fillRect(px, bY - 30, 8, 50);
    // Pillar top cap
    pillarGfx.fillTriangle(px - 4, bY - 30, px + 12, bY - 30, px + 4, bY - 46);
  });
  pillarGfx.lineStyle(1, 0xffd700, 0.35);
  pillarPositions.forEach(px => {
    pillarGfx.lineBetween(px - 4, bY - 30, px + 12, bY - 30);
  });

  logger.debug('[CH7 THEME] celestial realm applied');
}

// ─── Ch8: Primordial Abyss ───────────────────────────────────────────────────

function applyChapter8Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  // Deep primordial void — near-total darkness with barely visible purple pulses
  const voidDepth = scene.add.graphics().setDepth(5);
  voidDepth.fillStyle(0x04020a, 1);
  voidDepth.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  voidDepth.setAlpha(0.30);
  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: voidDepth,
      alpha: { from: 0.22, to: 0.40 },
      duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Slow void-pulse ring emanating from the center floor
    const ringCx = CANVAS_WIDTH / 2;
    const ringCy = GRID_Y + GRID_ROWS * cs * 0.6;
    const ringGfx = scene.add.graphics().setDepth(6);
    let ringR = 0;
    scene.time.addEvent({
      delay: 60,
      repeat: -1,
      callback: () => {
        ringGfx.clear();
        ringR = (ringR + 0.8) % 160;
        const a = (1 - ringR / 160) * 0.12;
        ringGfx.lineStyle(1.5, 0x6622cc, a);
        ringGfx.strokeEllipse(ringCx, ringCy, ringR * 2.8, ringR * 1.2);
      },
    });

    // Void tear particles — extremely dark, slow-drifting
    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -3, max: 3 }, speedY: { min: -10, max: -2 },
      alpha: { min: 0.06, max: 0.28 },
      scale: { min: 0.12, max: 0.50 },
      tint: [0x3300aa, 0x660099, 0x110022, 0x440066],
      lifespan: { min: 6000, max: 12000 }, frequency: 320, quantity: 1,
    }).setDepth(33);
  }

  // Primordial rift cracks along the floor edge
  const bY = GRID_Y + GRID_ROWS * cs + 10;
  const riftGfx = scene.add.graphics().setDepth(8);
  const riftSegs = [
    { x: 15, forks: [[0, 0], [18, -28], [32, -14], [44, -36]] },
    { x: 120, forks: [[0, 0], [12, -22], [28, -10], [40, -30], [52, -18]] },
    { x: 240, forks: [[0, 0], [14, -26], [30, -12], [46, -34]] },
    { x: 320, forks: [[0, 0], [16, -20], [34, -8],  [48, -28]] },
  ];
  riftSegs.forEach(({ x, forks }) => {
    riftGfx.lineStyle(1, 0x6622cc, 0.22);
    for (let i = 1; i < forks.length; i++) {
      const [ax, ay] = forks[i - 1];
      const [bx, by] = forks[i];
      riftGfx.lineBetween(x + ax, bY + ay, x + bx, bY + by);
    }
    riftGfx.lineStyle(1, 0x9944ff, 0.10);
    riftGfx.lineBetween(x, bY, x + forks[forks.length - 1][0], bY + forks[forks.length - 1][1]);
  });

  logger.debug('[CH8 THEME] primordial abyss applied');
}

// ─── Ch9: Beyond the Void / Oblivion ──────────────────────────────────────────

function applyChapter9Theme(scene: Phaser.Scene, effectiveCellSize: number, reducedMotion: boolean): void {
  // 공허 너머 — reality collapsing into oblivion. Distinct from Ch8's purple
  // abyss: absolute black with cold white/cyan void-light tearing through.
  const oblivion = scene.add.graphics().setDepth(5);
  oblivion.fillStyle(0x010104, 1);
  oblivion.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  oblivion.setAlpha(0.36);
  const cs = effectiveCellSize;
  if (!reducedMotion) {
    scene.tweens.add({
      targets: oblivion,
      alpha: { from: 0.28, to: 0.46 },
      duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Collapsing ring — reality pulled INWARD toward the void (vs Ch8's outward pulse)
    const ringCx = CANVAS_WIDTH / 2;
    const ringCy = GRID_Y + GRID_ROWS * cs * 0.6;
    const ringGfx = scene.add.graphics().setDepth(6);
    let ringR = 160;
    scene.time.addEvent({
      delay: 60,
      repeat: -1,
      callback: () => {
        ringGfx.clear();
        ringR = ringR <= 4 ? 160 : ringR - 0.9;
        const a = (ringR / 160) * 0.14;
        ringGfx.lineStyle(1.5, 0xaaddff, a);
        ringGfx.strokeEllipse(ringCx, ringCy, ringR * 2.6, ringR * 1.1);
      },
    });

    // Cold reality-tear motes — pale white/cyan, erratic drift
    scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -6, max: 6 }, speedY: { min: -8, max: 4 },
      alpha: { min: 0.05, max: 0.30 },
      scale: { min: 0.10, max: 0.45 },
      tint: [0xffffff, 0xaaddff, 0x88aacc, 0xddeeff],
      lifespan: { min: 5000, max: 11000 }, frequency: 300, quantity: 1,
    }).setDepth(33);
  }

  // White fracture lines along the floor — light leaking through torn reality
  const bY = GRID_Y + GRID_ROWS * cs + 10;
  const fractGfx = scene.add.graphics().setDepth(8);
  const fractSegs = [
    { x: 25,  forks: [[0, 0], [16, -32], [30, -18], [46, -40], [58, -22]] },
    { x: 145, forks: [[0, 0], [14, -26], [30, -14], [44, -36]] },
    { x: 255, forks: [[0, 0], [18, -30], [34, -16], [50, -38], [62, -20]] },
    { x: 335, forks: [[0, 0], [14, -24], [30, -10], [44, -32]] },
  ];
  fractSegs.forEach(({ x, forks }) => {
    fractGfx.lineStyle(1, 0xffffff, 0.20);
    for (let i = 1; i < forks.length; i++) {
      const [ax, ay] = forks[i - 1];
      const [bx, by] = forks[i];
      fractGfx.lineBetween(x + ax, bY + ay, x + bx, bY + by);
    }
    fractGfx.lineStyle(1, 0xaaddff, 0.12);
    fractGfx.lineBetween(x, bY, x + forks[forks.length - 1][0], bY + forks[forks.length - 1][1]);
  });

  logger.debug('[CH9 THEME] beyond the void applied');
}
