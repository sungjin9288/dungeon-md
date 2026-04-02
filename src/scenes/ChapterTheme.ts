import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_Y, GRID_ROWS } from '../constants/layout';
import { logger } from '../utils/logger';

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
  switch (chapter) {
    case 2: applyChapter2Theme(scene, effectiveCellSize); break;
    case 3: applyChapter3Theme(scene, effectiveCellSize); break;
    case 4: applyChapter4Theme(scene, effectiveCellSize); break;
    case 5: applyChapter5Theme(scene, effectiveCellSize); break;
    case 6: applyChapter6Theme(scene, effectiveCellSize); break;
    // Chapter 1 has no overlay theme
  }
}

// ─── Ch2: Teal Forest Mist ────────────────────────────────────────────────────

function applyChapter2Theme(scene: Phaser.Scene, effectiveCellSize: number): void {
  const mist = scene.add.graphics().setDepth(5);
  mist.fillStyle(0x00283c, 1);
  mist.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  mist.setAlpha(0.12);
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

  logger.debug('[CH2 THEME] teal mist applied');
}

// ─── Ch3: Underwater Palace ───────────────────────────────────────────────────

function applyChapter3Theme(scene: Phaser.Scene, effectiveCellSize: number): void {
  const water = scene.add.graphics().setDepth(5);
  water.fillStyle(0x001830, 1);
  water.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  water.setAlpha(0.18);
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

  logger.debug('[CH3 THEME] underwater palace applied');
}

// ─── Ch4: Hell Gate / Underworld ──────────────────────────────────────────────

function applyChapter4Theme(scene: Phaser.Scene, effectiveCellSize: number): void {
  const hellOver = scene.add.graphics().setDepth(5);
  hellOver.fillStyle(0x200000, 1);
  hellOver.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  hellOver.setAlpha(0.22);
  scene.tweens.add({
    targets: hellOver, alpha: { from: 0.15, to: 0.30 },
    duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  const cs = effectiveCellSize;
  scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs, 'dust', {
    x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
    y: { min: 0, max: 20 },
    speedX: { min: -8, max: 8 }, speedY: { min: -50, max: -20 },
    alpha: { min: 0.08, max: 0.25 },
    scale: { min: 0.15, max: 0.5 },
    tint: [0xff4400, 0xff8800, 0xffcc00],
    lifespan: { min: 2000, max: 4000 }, frequency: 200, quantity: 1,
  }).setDepth(32);

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

function applyChapter5Theme(scene: Phaser.Scene, effectiveCellSize: number): void {
  const celestial = scene.add.graphics().setDepth(5);
  celestial.fillStyle(0x201000, 1);
  celestial.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  celestial.setAlpha(0.15);
  scene.tweens.add({
    targets: celestial, alpha: { from: 0.10, to: 0.22 },
    duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  const cs = effectiveCellSize;
  scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
    x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
    y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
    speedX: { min: -5, max: 5 }, speedY: { min: -15, max: -5 },
    alpha: { min: 0.05, max: 0.20 },
    scale: { min: 0.2, max: 0.7 },
    tint: [0xffcc44, 0xffeeaa, 0xffffff],
    lifespan: { min: 4000, max: 8000 }, frequency: 350, quantity: 1,
  }).setDepth(32);

  const mtn = scene.add.graphics().setDepth(8);
  mtn.fillStyle(0x1a1000, 0.6);
  const bY = GRID_Y + GRID_ROWS * cs + 10;
  mtn.fillTriangle(0, bY + 60, 80, bY, 160, bY + 60);
  mtn.fillTriangle(120, bY + 60, 200, bY - 15, 280, bY + 60);
  mtn.fillTriangle(220, bY + 60, 290, bY + 5, 360, bY + 60);

  logger.debug('[CH5 THEME] celestial mountain applied');
}

// ─── Ch6: Void Throne ────────────────────────────────────────────────────────

function applyChapter6Theme(scene: Phaser.Scene, effectiveCellSize: number): void {
  const voidMist = scene.add.graphics().setDepth(5);
  voidMist.fillStyle(0x0a0018, 1);
  voidMist.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  voidMist.setAlpha(0.20);
  scene.tweens.add({
    targets: voidMist, alpha: { from: 0.15, to: 0.30 },
    duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  const cs = effectiveCellSize;
  scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
    x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
    y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
    speedX: { min: -8, max: 8 }, speedY: { min: -20, max: -5 },
    alpha: { min: 0.05, max: 0.25 },
    scale: { min: 0.2, max: 0.8 },
    tint: [0x8844cc, 0xd4af37, 0x6622aa],
    lifespan: { min: 5000, max: 10000 }, frequency: 280, quantity: 1,
  }).setDepth(32);

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
