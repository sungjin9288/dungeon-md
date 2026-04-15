// ─── Dungeon Layout Builders ─────────────────────────────────────────────────
// Extracted from DungeonScene.ts to keep the scene file focused on runtime
// orchestration. These helpers are all write-only draws — they read their
// inputs as plain parameters and mutate only the scene's display list and
// the Room array passed back to the caller.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Torch } from '../objects/Torch';
import { COLORS, CSS } from '../constants/colors';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_X, GRID_Y,
  TORCH_POSITIONS, INVADER_WAYPOINTS,
  TOP_BAR_HEIGHT, FOG_START_Y, FOG_HEIGHT,
} from '../constants/layout';
import type { DungeonTheme } from '../themes/themes';
import { drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
import type { DungeonSlot } from '../data/wisdom';

// ─── Background ───────────────────────────────────────────────────────────────

export function drawDungeonBackground(
  scene:             Phaser.Scene,
  theme:             DungeonTheme,
  effectiveCols:     number,
  effectiveCellSize: number,
): void {
  const t = theme;
  const g = scene.add.graphics().setDepth(-20);
  g.fillStyle(t.bgPrimary, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Cave rock grid
  const ts = 40;
  for (let x = 0; x < CANVAS_WIDTH; x += ts)
    for (let y = TOP_BAR_HEIGHT; y < CANVAS_HEIGHT; y += ts) {
      g.lineStyle(0.4, t.stoneDark, 0.18);
      g.strokeRect(x, y, ts, ts);
    }

  // Upper area — cave ceiling
  g.fillStyle(t.stoneDark, 1);
  g.fillRect(0, TOP_BAR_HEIGHT, CANVAS_WIDTH, GRID_Y - TOP_BAR_HEIGHT);
  for (let y = TOP_BAR_HEIGHT + 8; y < GRID_Y; y += 14) {
    g.fillStyle(t.bgPrimary, 0.4); g.fillRect(0, y, CANVAS_WIDTH, 2);
  }

  // Stalactites at grid top
  if (t.decorations.includes('stalactites')) {
    drawStalactites(g, t, GRID_Y - 4, CANVAS_WIDTH, 31);
  }

  // Grid separator line — mineral vein
  g.fillStyle(t.panelBorder, 0.2);
  g.fillRect(GRID_X - 4, GRID_Y - 2, effectiveCols * effectiveCellSize + 8, 2);

  // Floor area
  const floorY = GRID_Y + GRID_ROWS * effectiveCellSize + 4;
  g.fillStyle(t.stoneDark, 0.25);
  g.fillRect(0, floorY, CANVAS_WIDTH, CANVAS_HEIGHT - floorY);
  for (let y = floorY; y < CANVAS_HEIGHT; y += 8) {
    g.fillStyle(t.bgPrimary, 0.3); g.fillRect(0, y, CANVAS_WIDTH, 4);
  }

  // Stalagmites at bottom
  if (t.decorations.includes('stalagmites')) {
    drawStalagmites(g, t, floorY + 2, CANVAS_WIDTH, 88);
  }

  // Rock strata texture
  drawCaveWallTexture(g, t, 0, TOP_BAR_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - TOP_BAR_HEIGHT, 67);
}

// ─── Path ─────────────────────────────────────────────────────────────────────

export function buildInvaderPath(scene: Phaser.Scene): Phaser.Curves.Path {
  const [first, ...rest] = INVADER_WAYPOINTS;
  const path = new Phaser.Curves.Path(first.x, first.y);
  for (const pt of rest) path.lineTo(pt.x, pt.y);

  // Debug path overlay
  const dbg = scene.add.graphics().setDepth(50).setAlpha(0.45);
  dbg.lineStyle(1.5, COLORS.BLOOD_RED, 0.6);
  path.draw(dbg, 64);
  dbg.fillStyle(COLORS.BLOOD_RED, 0.7);
  path.getPoints(40).forEach((pt, i) => {
    if (i % 2 === 0) dbg.fillCircle(pt.x, pt.y, 2);
  });

  return path;
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export interface GridBuildConfig {
  effectiveCols:     number;
  effectiveCellSize: number;
  availableSlots:    number;                         // total slots the player has unlocked
  waterCells:        Set<number>;                    // flat indices forced to water
  dungeonTrapSlots:  DungeonSlot[];                  // persistent slot config (monsters/traps)
  onRoomClick:       (room: Room) => void;
}

/**
 * Build the clickable room grid and pre-seed persistent slot metadata into each room.
 *
 * Returns the 2D room array (caller assigns it to its scene field).
 */
export function buildDungeonGrid(
  scene: Phaser.Scene,
  cfg:   GridBuildConfig,
): Room[][] {
  const { effectiveCols: gc, effectiveCellSize: cs, availableSlots, waterCells, dungeonTrapSlots, onRoomClick } = cfg;
  const rooms: Room[][] = [];

  let slotIndex = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    rooms[row] = [];
    for (let col = 0; col < gc; col++) {
      const cx = GRID_X + col * cs + cs / 2;
      const cy = GRID_Y + row * cs + cs / 2;
      const flatIdx = row * gc + col;
      let state: 'empty' | 'locked' | 'water';
      if (waterCells.has(flatIdx)) {
        state = 'water';
      } else {
        state = slotIndex < availableSlots ? 'empty' : 'locked';
        slotIndex++;
      }
      const room = new Room(scene, cx, cy, row, col, state, onRoomClick, cs);
      room.setDepth(10);
      rooms[row][col] = room;
    }
  }

  // Pre-load dungeon slot configuration (monsters + traps) into room metadata.
  // These private fields are consumed later in combat setup; we keep the
  // dynamic-cast pattern verbatim to avoid scope-creep into Room's public API.
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < gc; col++) {
      const idx  = row * gc + col;
      const slot = dungeonTrapSlots[idx];
      if (!slot) continue;
      const room = rooms[row][col];
      if (room.state !== 'empty') continue;
      const raw = room as unknown as Record<string, unknown>;
      raw['_slotMonsterIds'] = slot.monsterIds ?? [];
      raw['_slotTrapIds']    = slot.trapIds    ?? [];
      raw['_slotRoomType']   = slot.roomType;
      raw['_slotRoomLevel']  = slot.roomLevel;
    }
  }

  return rooms;
}

// ─── Torches ──────────────────────────────────────────────────────────────────

export function placeDungeonTorches(scene: Phaser.Scene): void {
  TORCH_POSITIONS.forEach(({ x, y }) => new Torch(scene, x, y));
}

// ─── Atmosphere ───────────────────────────────────────────────────────────────

export function addDustMoteParticles(
  scene:             Phaser.Scene,
  effectiveCellSize: number,
): void {
  const cs = effectiveCellSize;
  scene.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
    x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
    y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
    speedX: { min: -6, max: 6 }, speedY: { min: -4, max: 4 },
    alpha: { min: 0.05, max: 0.18 }, scale: { min: 0.3, max: 0.9 },
    lifespan: { min: 4000, max: 9000 }, frequency: 700, quantity: 1,
  }).setDepth(30);
}

// ─── Wave-start Button ────────────────────────────────────────────────────────

export interface WaveButtonRefs {
  bg:    Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone:  Phaser.GameObjects.Zone;
}

export interface WaveButtonCallbacks {
  /** Returns true while the button should not react to hover/press (wave or prep). */
  isLocked: () => boolean;
  /** Invoked when the user taps the button while unlocked. */
  onPress:  () => void;
}

/**
 * Fills the wave-start button background graphic.
 *
 * Exported so that `ResultFlow` can repaint the button after wave end without
 * the scene having to re-implement the same draw logic.
 */
export function paintWaveButton(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean,
): void {
  g.clear();
  g.fillStyle(hover ? 0xaa0000 : COLORS.BLOOD_RED, 1);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(2, hover ? COLORS.TORCH_AMBER : COLORS.TORCH_GOLD, hover ? 0.9 : 0.55);
  g.strokeRoundedRect(x, y, w, h, 6);
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.38, 4);
}

/**
 * Construct the "⚔ 침략 시작" wave-start button below the dungeon grid.
 *
 * The button handles its own hover paint; the caller only controls the locked
 * predicate (wave in-progress / prep phase) and the tap callback.
 */
export function buildWaveStartButton(
  scene:             Phaser.Scene,
  effectiveCellSize: number,
  callbacks:         WaveButtonCallbacks,
): WaveButtonRefs {
  const bw = 270, bh = 60;   // 60px height meets Apple HIG 44pt minimum
  const bx = CANVAS_WIDTH / 2 - bw / 2;
  const by = GRID_Y + GRID_ROWS * effectiveCellSize + 20;

  const bg = scene.add.graphics().setDepth(60);
  paintWaveButton(bg, bx, by, bw, bh, false);

  const label = scene.add.text(CANVAS_WIDTH / 2, by + bh / 2, '⚔  침략 시작', {
    fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold', color: CSS.PARCHMENT,
  }).setOrigin(0.5).setDepth(61);

  const zone = scene.add.zone(CANVAS_WIDTH / 2, by + bh / 2, bw, bh)
    .setInteractive().setDepth(62);

  zone.on('pointerover', () => {
    if (callbacks.isLocked()) return;
    paintWaveButton(bg, bx, by, bw, bh, true);
    label.setColor(CSS.TORCH_AMBER);
  });
  zone.on('pointerout', () => {
    paintWaveButton(bg, bx, by, bw, bh, false);
    label.setColor(CSS.PARCHMENT);
  });
  zone.on('pointerdown', () => {
    if (!callbacks.isLocked()) callbacks.onPress();
  });

  return { bg, label, zone };
}

export function addDungeonFog(scene: Phaser.Scene): void {
  const fog = scene.add.graphics().setDepth(90);
  fog.fillGradientStyle(
    COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, 0, 0, 0.88, 0.88,
  );
  fog.fillRect(0, FOG_START_Y, CANVAS_WIDTH, FOG_HEIGHT);

  // Scattered floor candles
  const candles = [
    { x: 60,  y: CANVAS_HEIGHT - 100 },
    { x: 200, y: CANVAS_HEIGHT - 85  },
    { x: 330, y: CANVAS_HEIGHT - 110 },
  ];
  candles.forEach(({ x, y }) => {
    const c = scene.add.graphics().setDepth(91);
    c.fillStyle(0xd4c8a0, 0.6); c.fillRect(x - 2, y, 5, 14);
    c.fillStyle(COLORS.TORCH_GLOW, 0.75); c.fillTriangle(x + 0.5, y - 10, x - 5, y + 1, x + 6, y + 1);
    c.fillStyle(0xffee44, 0.7);           c.fillTriangle(x + 0.5, y - 5,  x - 3, y + 1, x + 4, y + 1);
    scene.tweens.add({
      targets: c, scaleX: { from: 0.85, to: 1.15 }, alpha: { from: 0.5, to: 0.85 },
      duration: Phaser.Math.Between(600, 1000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  });
}
