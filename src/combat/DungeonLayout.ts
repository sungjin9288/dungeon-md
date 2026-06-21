// ─── Dungeon Layout Builders ─────────────────────────────────────────────────
// Extracted from DungeonScene.ts to keep the scene file focused on runtime
// orchestration. These helpers are all write-only draws — they read their
// inputs as plain parameters and mutate only the scene's display list and
// the Room array passed back to the caller.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Torch } from '../objects/Torch';
import { COLORS, CSS, CASUAL } from '../constants/colors';
import { addSceneAtmosphere } from '../ui/SceneAtmosphere';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_X, GRID_Y,
  TORCH_POSITIONS, INVADER_WAYPOINTS,
  TOP_BAR_HEIGHT, FOG_START_Y, FOG_HEIGHT,
} from '../constants/layout';
import type { DungeonTheme } from '../themes/themes';
import { drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
import { bakeDungeonBackdrop } from '../art/DungeonBackdrop';
import { getRoomSlotCapacity, ROOM_SLOT_TYPE_DEFS, type DungeonSlot, type RoomSlotType } from '../data/wisdom';
import { ROOM_DEFS, type RoomData, type RoomType } from '../data/rooms';
import { MONSTER_DEFS, resolveMonsterDef } from '../data/monsters';
import { HYBRID_DEFS } from '../data/fusion';
import type { EquipmentStats } from '../data/barracks';

export const WAVE_BUTTON_W = 270;
export const WAVE_BUTTON_H = 60;

const HOME_SLOT_COLS = 3;

const SLOT_TO_COMBAT_ROOM: Record<RoomSlotType, RoomType> = {
  combat:  'guardian',
  trap:    'trap',
  support: 'medicine_hall',
  magic:   'scroll_library',
};

const SLOT_VISUAL_ACCENT: Record<RoomSlotType, number> = {
  combat:  0xff8a45,
  trap:    0x5fb854,
  support: 0x55b88a,
  magic:   0x9a6cd8,
};

export interface DungeonSlotDeploymentConfig {
  readonly rooms:             Room[][];
  readonly roomGrid:          (RoomData | null)[][];
  readonly effectiveCols:     number;
  readonly dungeonTrapSlots:  DungeonSlot[];
  readonly equipmentMap:      ReadonlyMap<string, EquipmentStats>;
}

export interface DungeonSlotDeploymentSummary {
  readonly builtRooms:       number;
  readonly assignedMonsters: number;
  readonly equippedMonsters: number;
  readonly activeTraps:      number;
  readonly brokenRooms:      number;
}

export function resolveSlotCombatRoomType(roomType: RoomSlotType | undefined): RoomType | null {
  return roomType ? SLOT_TO_COMBAT_ROOM[roomType] : null;
}

function getHomeSlotIndex(row: number, col: number): number | null {
  return col >= HOME_SLOT_COLS ? null : row * HOME_SLOT_COLS + col;
}

function getDefinedIds(ids: readonly (string | undefined | null)[] | undefined): string[] {
  return (ids ?? []).filter((id): id is string => Boolean(id));
}

function getMonsterEmoji(monsterId: string): string {
  return MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS]?.emoji
    ?? HYBRID_DEFS[monsterId]?.emoji
    ?? '👾';
}

export function deployDungeonSlotsToGrid(cfg: DungeonSlotDeploymentConfig): DungeonSlotDeploymentSummary {
  const { rooms, roomGrid, effectiveCols, dungeonTrapSlots, equipmentMap } = cfg;
  let builtRooms = 0;
  let assignedMonsters = 0;
  let equippedMonsters = 0;
  let activeTraps = 0;
  let brokenRooms = 0;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < effectiveCols; col++) {
      const slotIndex = getHomeSlotIndex(row, col);
      if (slotIndex === null) continue;

      const slot = dungeonTrapSlots[slotIndex];
      const roomType = resolveSlotCombatRoomType(slot?.roomType);
      const room = rooms[row]?.[col];
      if (!slot || !roomType || !room || room.state !== 'empty') continue;

      room.occupyWith(roomType);
      const data = room.roomData;
      if (!data) continue;

      const visualLevel = Phaser.Math.Clamp(slot.roomLevel, 1, 3);
      room.setInitialRoomLevel(visualLevel);
      room.setRoomHpSnapshot(slot.hp, slot.maxHp);
      data.level = visualLevel;

      const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
      if (typeDef) room.setRoomTypeBadge(typeDef.icon);

      const monsterIds = getDefinedIds(slot.monsterIds);
      const trapIds = getDefinedIds(slot.trapIds);
      const capacity = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      const equippedCount = monsterIds.filter(id => equipmentMap.has(id)).length;
      builtRooms++;

      if (slot.hp <= 0) {
        data.attackCooldown = 0;
        data.monsterSlot = null;
        data.monsterSlots = [];
        room.setBrokenState();
        roomGrid[row][col] = data;
        brokenRooms++;
        continue;
      }

      activeTraps += trapIds.length;

      if (monsterIds.length > 0) {
        const primaryMonsterId = monsterIds[0];
        data.monsterSlot = primaryMonsterId as typeof data.monsterSlot;
        data.monsterSlots = monsterIds as typeof data.monsterSlots;
        const primaryDef = resolveMonsterDef(primaryMonsterId);
        if (primaryDef && primaryDef.attackCooldown > 0) {
          data.attackCooldown = primaryDef.attackCooldown;
        }
        if (slot.roomType === 'magic' && data.attackCooldown > 0) {
          data.attackCooldown = Math.round(data.attackCooldown * 0.8);
        }
        const hpBonus = equipmentMap.get(primaryMonsterId)?.roomHpBonus ?? 0;
        if (hpBonus > 0) room.addBonusHp(hpBonus);
        room.setMonsterSprite(primaryMonsterId, getMonsterEmoji(primaryMonsterId));
        assignedMonsters += monsterIds.length;
      } else {
        data.monsterSlot = null;
        data.monsterSlots = [];
        data.attackCooldown = ROOM_DEFS[roomType].attackCooldown;
      }

      room.setDungeonSlotLoadoutVisual({
        roomTypeIcon: typeDef?.icon ?? '◇',
        roomTypeName: typeDef?.name ?? '던전실',
        accentColor: slot.roomType ? SLOT_VISUAL_ACCENT[slot.roomType] : ROOM_DEFS[roomType].accentColor,
        slotRoomType: slot.roomType,
        primaryMonsterEmoji: monsterIds[0] ? getMonsterEmoji(monsterIds[0]) : null,
        primaryMonsterId: monsterIds[0] ?? null,
        monsterCount: monsterIds.length,
        monsterCapacity: capacity.monsters,
        equipmentCount: equippedCount,
        trapCount: trapIds.length,
        trapCapacity: capacity.traps,
      });
      equippedMonsters += equippedCount;

      roomGrid[row][col] = data;
    }
  }

  return { builtRooms, assignedMonsters, equippedMonsters, activeTraps, brokenRooms };
}

// ─── Background ───────────────────────────────────────────────────────────────

/**
 * Build a signature-safe warm-stone override of the (dark) theme so the shared
 * decoration helpers (drawStalactites/drawStalagmites/drawCaveWallTexture) —
 * which read stone/glow colors from the theme internally — draw in the bright
 * CASUAL palette without us editing the shared theme object. Immutable spread:
 * only the decorative stone/glow fields are swapped.
 */
function casualDecorTheme(theme: DungeonTheme): DungeonTheme {
  return {
    ...theme,
    stoneDark:  CASUAL.EDGE_SOFT,
    stoneMid:   CASUAL.PANEL_SOFT,
    stoneLight: CASUAL.EDGE_SOFT,
    glowColor:  CASUAL.GOLD,
  };
}

export function drawDungeonBackground(
  scene:             Phaser.Scene,
  theme:             DungeonTheme,
  effectiveCols:     number,
  effectiveCellSize: number,
  chapter            = 1,
): void {
  const t = theme;
  // Warm-stone override fed to the shared decoration helpers (visual-only).
  const decorTheme = casualDecorTheme(t);
  const g = scene.add.graphics().setDepth(-20);

  // Base — warm light vertical gradient (replaces the dark cave fill).
  g.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle floor-tile grid — soft warm brown on cream, very low alpha.
  const ts = 40;
  for (let x = 0; x < CANVAS_WIDTH; x += ts)
    for (let y = TOP_BAR_HEIGHT; y < CANVAS_HEIGHT; y += ts) {
      g.lineStyle(0.4, CASUAL.EDGE_SOFT, 0.12);
      g.strokeRect(x, y, ts, ts);
    }

  // Upper area — soft warm "ceiling" band.
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRect(0, TOP_BAR_HEIGHT, CANVAS_WIDTH, GRID_Y - TOP_BAR_HEIGHT);
  for (let y = TOP_BAR_HEIGHT + 8; y < GRID_Y; y += 14) {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.08); g.fillRect(0, y, CANVAS_WIDTH, 2);
  }

  // Stalactites at grid top — warm-brown decorative, not gloomy.
  if (t.decorations.includes('stalactites')) {
    drawStalactites(g, decorTheme, GRID_Y - 4, CANVAS_WIDTH, 31);
  }

  // Grid separator line — warm seam.
  g.fillStyle(CASUAL.EDGE_SOFT, 0.25);
  g.fillRect(GRID_X - 4, GRID_Y - 2, effectiveCols * effectiveCellSize + 8, 2);

  // Floor area — slightly deeper warm band, low contrast.
  const floorY = GRID_Y + GRID_ROWS * effectiveCellSize + 4;
  g.fillStyle(CASUAL.BG_BOTTOM, 0.55);
  g.fillRect(0, floorY, CANVAS_WIDTH, CANVAS_HEIGHT - floorY);
  for (let y = floorY; y < CANVAS_HEIGHT; y += 8) {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.08); g.fillRect(0, y, CANVAS_WIDTH, 4);
  }

  // Stalagmites at bottom — warm-brown decorative.
  if (t.decorations.includes('stalagmites')) {
    drawStalagmites(g, decorTheme, floorY + 2, CANVAS_WIDTH, 88);
  }

  // Faint warm rock strata texture (uses CASUAL.EDGE_SOFT via override theme).
  drawCaveWallTexture(g, decorTheme, 0, TOP_BAR_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - TOP_BAR_HEIGHT, 67);
  drawDungeonDefenseFrame(scene, t, effectiveCols, effectiveCellSize, chapter);

  // Atmosphere over the surround: torch glow + drifting embers for depth/life.
  // Vignette OFF — never darken battle edges where invaders enter (readability).
  addSceneAtmosphere(scene, { vignette: false });
}

function drawDungeonDefenseFrame(
  scene: Phaser.Scene,
  _theme: DungeonTheme,   // visual-only reskin ignores the dark theme; uses CASUAL palette
  effectiveCols: number,
  effectiveCellSize: number,
  chapter = 1,
): void {
  const gridW = effectiveCols * effectiveCellSize;
  const gridH = GRID_ROWS * effectiveCellSize;
  const x = GRID_X;
  const y = GRID_Y;
  // Play-area: painted dungeon backdrop (matches the home board) behind
  // translucent cells, framed by a brown stone border. Drop shadow sits
  // behind the painting so it never darkens the illustration.
  const panelX = x - 16, panelY = y - 18;
  const panelW = gridW + 32, panelH = gridH + 36;

  const shadowG = scene.add.graphics().setDepth(-16);
  shadowG.fillStyle(CASUAL.SHADOW, 0.5);
  shadowG.fillRoundedRect(x - 22, y - 24, gridW + 44, gridH + 48, 18);

  // Per-chapter illustrated backdrop if dropped in (bg-battle-ch{N}); else the
  // universal chamber; else the procedural Canvas painting. See ASSET_GUIDE.md.
  const chapterKey = `bg-battle-ch${chapter}`;
  const realKey = scene.textures.exists(chapterKey) ? chapterKey : 'bg-dungeon-chamber';
  const bdKey = bakeDungeonBackdrop(scene, `battleBackdrop_ch${chapter}_${panelW}x${panelH}`, panelW, panelH, realKey);
  scene.add.image(panelX, panelY, bdKey).setOrigin(0, 0).setDisplaySize(panelW, panelH).setDepth(-15);

  const g = scene.add.graphics().setDepth(-12);
  g.lineStyle(3, CASUAL.EDGE, 1);
  g.strokeRoundedRect(panelX, panelY, panelW, panelH, 15);
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.4);
  g.strokeRoundedRect(x - 7, y - 8, gridW + 14, gridH + 16, 10);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < effectiveCols; col++) {
      const cellX = x + col * effectiveCellSize;
      const cellY = y + row * effectiveCellSize;
      const inset = 9;
      const accent = row === 0 ? CASUAL.GOLD : row === 1 ? CASUAL.GREEN : CASUAL.PURPLE;
      const cw = effectiveCellSize - inset * 2;
      // Translucent dark alcove — the painted dungeon shows through empty slots.
      g.fillStyle(CASUAL.SHADOW, 0.3);
      g.fillRoundedRect(cellX + inset, cellY + inset, cw, cw, 12);
      // Per-row accent border (slot identity), toned for the dark backdrop.
      g.lineStyle(2, accent, 0.6);
      g.strokeRoundedRect(cellX + inset, cellY + inset, cw, cw, 12);
      // Faint bottom accent strip.
      g.fillStyle(accent, 0.55);
      g.fillRoundedRect(cellX + inset + 10, cellY + effectiveCellSize - inset - 10, cw - 20, 3, 2);
    }
  }

  // Entry gate — bright red nub on cream.
  const gateY = y + effectiveCellSize / 2;
  g.fillStyle(CASUAL.PANEL, 0.95);
  g.fillRoundedRect(x + gridW - 6, gateY - 30, 24, 60, 8);
  g.lineStyle(2.5, CASUAL.RED, 1);
  g.strokeRoundedRect(x + gridW - 6, gateY - 30, 24, 60, 8);
  g.fillStyle(CASUAL.RED, 0.9);
  g.fillTriangle(x + gridW + 12, gateY, x + gridW + 2, gateY - 9, x + gridW + 2, gateY + 9);

  // Core "heart" — gold on a cream circle with brown ring.
  const heartX = x - 14;
  const heartY = y + gridH - effectiveCellSize / 2;
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillCircle(heartX, heartY, 18);
  g.lineStyle(2.5, CASUAL.EDGE, 1);
  g.strokeCircle(heartX, heartY, 18);
  g.fillStyle(CASUAL.GOLD, 0.35);
  g.fillCircle(heartX, heartY, 10);
  g.fillStyle(CASUAL.GOLD, 1);
  g.fillTriangle(heartX, heartY - 8, heartX - 8, heartY, heartX, heartY + 8);
  g.fillTriangle(heartX, heartY - 8, heartX + 8, heartY, heartX, heartY + 8);

  // Corner studs — cream circles, brown ring, gold center.
  [[x - 14, y - 16], [x + gridW + 14, y - 16], [x - 14, y + gridH + 16], [x + gridW + 14, y + gridH + 16]].forEach(([sx, sy]) => {
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillCircle(sx, sy, 8);
    g.lineStyle(2, CASUAL.EDGE, 1);
    g.strokeCircle(sx, sy, 8);
    g.fillStyle(CASUAL.GOLD, 1);
    g.fillCircle(sx, sy, 3);
  });
}

// ─── Path ─────────────────────────────────────────────────────────────────────

export function buildInvaderPath(scene: Phaser.Scene): Phaser.Curves.Path {
  const [first, ...rest] = INVADER_WAYPOINTS;
  const path = new Phaser.Curves.Path(first.x, first.y);
  for (const pt of rest) path.lineTo(pt.x, pt.y);

  drawInvasionRoute(scene);

  return path;
}

function drawInvasionRoute(scene: Phaser.Scene): void {
  const routeBase = scene.add.graphics().setDepth(48);
  const routeGlow = scene.add.graphics().setDepth(49).setAlpha(0.34);
  const markers = scene.add.graphics().setDepth(51);

  const waypoints = INVADER_WAYPOINTS;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    routeBase.lineStyle(18, 0x050302, 0.30);
    routeBase.lineBetween(from.x, from.y, to.x, to.y);
    routeBase.lineStyle(12, COLORS.STONE_DARK, 0.50);
    routeBase.lineBetween(from.x, from.y, to.x, to.y);
    routeBase.lineStyle(5, COLORS.BLOOD_RED, 0.20);
    routeBase.lineBetween(from.x, from.y, to.x, to.y);
    routeBase.lineStyle(1.5, COLORS.TORCH_GOLD, 0.28);
    routeBase.lineBetween(from.x, from.y, to.x, to.y);

    routeGlow.lineStyle(9, COLORS.BLOOD_GLOW, 0.18);
    routeGlow.lineBetween(from.x, from.y, to.x, to.y);
    drawRouteChevrons(markers, from, to, i);
  }

  drawRouteEndpoint(scene, waypoints[1].x - 8, waypoints[1].y, '침입', 0xff6b1a, 1);
  drawRouteEndpoint(scene, waypoints[waypoints.length - 2].x + 8, waypoints[waypoints.length - 2].y, '심장부', 0xffe27a, -1);

  scene.tweens.add({
    targets: routeGlow,
    alpha: { from: 0.22, to: 0.46 },
    duration: 1400,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
}

function drawRouteChevrons(
  g: Phaser.GameObjects.Graphics,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  seed: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 40) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const step = 58;
  const start = 30 + (seed % 2) * 14;

  for (let d = start; d < len - 18; d += step) {
    const x = from.x + ux * d;
    const y = from.y + uy * d;
    const tipX = x + ux * 8;
    const tipY = y + uy * 8;
    const backX = x - ux * 7;
    const backY = y - uy * 7;

    g.fillStyle(0x000000, 0.32);
    g.fillTriangle(
      tipX + 1,
      tipY + 1,
      backX + px * 5 + 1,
      backY + py * 5 + 1,
      backX - px * 5 + 1,
      backY - py * 5 + 1,
    );
    g.fillStyle(COLORS.TORCH_AMBER, 0.56);
    g.fillTriangle(tipX, tipY, backX + px * 5, backY + py * 5, backX - px * 5, backY - py * 5);
  }
}

function drawRouteEndpoint(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  accent: number,
  facing: 1 | -1,
): void {
  const c = scene.add.container(x, y).setDepth(54);
  const g = scene.add.graphics();
  g.fillStyle(0x070403, 0.78);
  g.fillCircle(0, 0, 17);
  g.lineStyle(1.5, accent, 0.72);
  g.strokeCircle(0, 0, 17);
  g.fillStyle(accent, 0.18);
  g.fillCircle(0, 0, 10);
  g.fillStyle(accent, 0.78);
  g.fillTriangle(facing * 6, 0, facing * -5, -6, facing * -5, 6);
  c.add(g);

  const text = scene.add.text(0, 20, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '9px',
    color: CSS.PARCHMENT,
    fontStyle: 'bold',
    stroke: '#1a0f00',
    strokeThickness: 2,
  }).setOrigin(0.5).setAlpha(0.86);
  c.add(text);
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
  // Warm ember CTA — torch-lit, fits the dark dungeon while still popping.
  const fillTop = hover ? 0xe8902c : 0xc9781f;
  const fillBottom = hover ? 0x854019 : 0x6e3410;
  const border = hover ? COLORS.TORCH_AMBER : 0xf0b85a;

  g.fillStyle(0x020711, 0.62);
  g.fillRoundedRect(x - 6, y + 7, w + 12, h + 8, 15);
  g.fillStyle(0x1f1305, 0.82);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 13);
  g.lineStyle(1, 0x8a5a2a, hover ? 0.42 : 0.28);
  g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 13);

  g.fillGradientStyle(fillTop, fillTop, fillBottom, fillBottom, 1, 1, 1, 1);
  g.fillRoundedRect(x, y, w, h, 11);
  g.lineStyle(2, border, hover ? 0.96 : 0.76);
  g.strokeRoundedRect(x, y, w, h, 11);

  g.fillStyle(0xffffff, hover ? 0.16 : 0.1);
  g.fillRoundedRect(x + 8, y + 8, w - 16, h * 0.34, 9);
  g.fillStyle(COLORS.TORCH_GOLD, hover ? 0.34 : 0.22);
  g.fillRoundedRect(x + 16, y + 7, w - 32, 4, 2);
  g.fillStyle(0xffffff, hover ? 0.18 : 0.1);
  g.fillRoundedRect(x + 64, y + 15, w - 128, 3, 2);
  g.fillStyle(0x140c03, 0.32);
  g.fillRoundedRect(x + 68, y + h - 15, w - 136, 3, 2);

  g.fillStyle(0x140c03, 0.5);
  g.fillRoundedRect(x + 14, y + 13, 36, h - 26, 9);
  g.lineStyle(1, 0xffffff, 0.18);
  g.strokeRoundedRect(x + 14, y + 13, 36, h - 26, 9);
  g.fillStyle(COLORS.TORCH_GOLD, 0.86);
  g.fillCircle(x + 32, y + h / 2, 7);
  g.fillStyle(0x140c03, 0.5);
  g.fillCircle(x + 32, y + h / 2, 3);

  const arrowX = x + w - 31;
  g.fillStyle(0x140c03, 0.38);
  g.fillCircle(arrowX, y + h / 2, 17);
  g.lineStyle(1.3, 0xffffff, 0.22);
  g.strokeCircle(arrowX, y + h / 2, 17);
  g.fillStyle(0xffffff, hover ? 0.88 : 0.68);
  g.fillTriangle(arrowX - 4, y + h / 2 - 7, arrowX - 4, y + h / 2 + 7, arrowX + 6, y + h / 2);
  g.fillStyle(COLORS.TORCH_GOLD, hover ? 0.74 : 0.5);
  g.fillRoundedRect(x + w - 82, y + 17, 18, 4, 2);
  g.fillRoundedRect(x + w - 82, y + h - 21, 18, 4, 2);

  g.lineStyle(1, 0x140c03, 0.24);
  g.lineBetween(x + 60, y + h - 10, x + w - 60, y + h - 10);
}

/**
 * Construct the "⚔ 방어 시작" wave-start button below the dungeon grid.
 *
 * The button handles its own hover paint; the caller only controls the locked
 * predicate (wave in-progress / prep phase) and the tap callback.
 */
export function buildWaveStartButton(
  scene:             Phaser.Scene,
  effectiveCellSize: number,
  callbacks:         WaveButtonCallbacks,
): WaveButtonRefs {
  const bw = WAVE_BUTTON_W, bh = WAVE_BUTTON_H;   // 60px height meets Apple HIG 44pt minimum
  const bx = CANVAS_WIDTH / 2 - bw / 2;
  const by = GRID_Y + GRID_ROWS * effectiveCellSize + 20;

  const bg = scene.add.graphics().setDepth(60);
  paintWaveButton(bg, bx, by, bw, bh, false);

  const label = scene.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 1, '🛡  방어 시작', {
    fontFamily: 'Georgia, serif',
    fontSize: '17px',
    fontStyle: 'bold',
    color: '#fff8d8',
    stroke: '#2a1404',
    strokeThickness: 3,
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
