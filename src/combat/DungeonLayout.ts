// ─── Dungeon Layout Builders ─────────────────────────────────────────────────
// Extracted from DungeonScene.ts to keep the scene file focused on runtime
// orchestration. These helpers are all write-only draws — they read their
// inputs as plain parameters and mutate only the scene's display list and
// the Room array passed back to the caller.

import { markBattleHud } from './battleHudMark';
import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Torch } from '../objects/Torch';
import { COLORS, CSS, CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { addSceneAtmosphere } from '../ui/SceneAtmosphere';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_X, GRID_Y,
  TOP_BAR_HEIGHT, FOG_START_Y, FOG_HEIGHT,
} from '../constants/layout';
import type { DungeonTheme } from '../themes/themes';
import { drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
import { bakeDungeonBackdrop } from '../art/DungeonBackdrop';
import { getRoomSlotCapacity, MAX_ROOM_LEVEL, ROOM_SLOT_TYPE_DEFS, type DungeonSlot, type RoomSlotType } from '../data/wisdom';
import { ROOM_DEFS, type RoomData } from '../data/rooms';
import { getSlotBuilding } from '../data/roomBuildings';
import { tempoCooldown } from '../data/combatTempo';
import { resolveMonsterAttackCooldown, resolveOwnedMonsterProfile, type ElementId } from '../data/monsters';
import type { EquipmentStats } from '../data/barracks';
import { CORRIDOR_ROW, slotAt, type BattleTopology, type Point } from '../data/battleTopology';

export const WAVE_BUTTON_W = 270;
export const WAVE_BUTTON_H = 60;

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
  /** Daily-rule element lock: guardians of any other element sit this battle out. */
  readonly elementRestrict?:  ElementId | null;
  /** Guardians on a facility shift (GameState.facilityStaff) sit this battle out. */
  readonly staffedMonsterIds?: ReadonlySet<string>;
}

export interface DungeonSlotDeploymentSummary {
  readonly builtRooms:       number;
  readonly assignedMonsters: number;
  readonly equippedMonsters: number;
  readonly activeTraps:      number;
  readonly brokenRooms:      number;
}

function getDefinedIds(ids: readonly (string | undefined | null)[] | undefined): string[] {
  return (ids ?? []).filter((id): id is string => Boolean(id));
}

function getDefinedMonsterIds(ids: readonly (string | undefined | null)[] | undefined): string[] {
  return getDefinedIds(ids).filter(id => resolveOwnedMonsterProfile(id) !== null);
}

function getMonsterEmoji(monsterId: string): string {
  return resolveOwnedMonsterProfile(monsterId)?.emoji ?? '👾';
}

export function deployDungeonSlotsToGrid(cfg: DungeonSlotDeploymentConfig): DungeonSlotDeploymentSummary {
  const { rooms, roomGrid, effectiveCols, dungeonTrapSlots, equipmentMap, elementRestrict, staffedMonsterIds } = cfg;
  let builtRooms = 0;
  let assignedMonsters = 0;
  let equippedMonsters = 0;
  let activeTraps = 0;
  let brokenRooms = 0;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < effectiveCols; col++) {
      const room = rooms[row]?.[col];
      if (room) room.equipmentMap = equipmentMap;
      const slotIndex = room?.homeSlot ?? null;
      if (slotIndex === null) continue;

      const slot = dungeonTrapSlots[slotIndex];
      const roomType = slot ? getSlotBuilding(slot) : null;
      if (!slot || !roomType || !room || room.state !== 'empty') continue;

      room.occupyWith(roomType);
      const data = room.roomData;
      if (!data) continue;

      const visualLevel = Phaser.Math.Clamp(slot.roomLevel, 1, MAX_ROOM_LEVEL);
      room.setInitialRoomLevel(visualLevel);
      room.setRoomHpSnapshot(slot.hp, slot.maxHp);
      data.level = visualLevel;

      const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
      if (typeDef) room.setRoomTypeBadge(typeDef.id);

      const monsterIds = getDefinedMonsterIds(slot.monsterIds).filter(id => (
        !staffedMonsterIds?.has(id)
        && (!elementRestrict || resolveOwnedMonsterProfile(id)?.element === elementRestrict)
      ));
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
        data.monsterSlot = primaryMonsterId;
        data.monsterSlots = monsterIds;
        data.attackCooldown = resolveMonsterAttackCooldown(primaryMonsterId, data.type);
        const hpBonus = equipmentMap.get(primaryMonsterId)?.roomHpBonus ?? 0;
        if (hpBonus > 0) room.addBonusHp(hpBonus);
        room.setMonsterSprite(primaryMonsterId, getMonsterEmoji(primaryMonsterId));
        assignedMonsters += monsterIds.length;
      } else {
        data.monsterSlot = null;
        data.monsterSlots = [];
        data.attackCooldown = tempoCooldown(ROOM_DEFS[roomType].attackCooldown);
      }

      room.setDungeonSlotLoadoutVisual({
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
  topology:          BattleTopology,
  effectiveCellSize: number,
  chapter            = 1,
  worldWidth         = CANVAS_WIDTH,
): void {
  const t = theme;
  const effectiveCols = topology.cols;
  // The corridor can outgrow the screen; the backdrop spans the whole battlefield.
  const W = Math.max(CANVAS_WIDTH, worldWidth);
  // Warm-stone override fed to the shared decoration helpers (visual-only).
  const decorTheme = casualDecorTheme(t);
  const g = scene.add.graphics().setDepth(-20);

  // Base — warm light vertical gradient (replaces the dark cave fill).
  g.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  g.fillRect(0, 0, W, CANVAS_HEIGHT);

  // Subtle floor-tile grid — warm stone seams at very low alpha.
  const ts = 40;
  for (let x = 0; x < W; x += ts)
    for (let y = TOP_BAR_HEIGHT; y < CANVAS_HEIGHT; y += ts) {
      g.lineStyle(0.4, CASUAL.EDGE_SOFT, 0.12);
      g.strokeRect(x, y, ts, ts);
    }

  // Upper area — soft warm "ceiling" band.
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRect(0, TOP_BAR_HEIGHT, W, GRID_Y - TOP_BAR_HEIGHT);
  for (let y = TOP_BAR_HEIGHT + 8; y < GRID_Y; y += 14) {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.08); g.fillRect(0, y, W, 2);
  }

  // Stalactites at grid top — warm-brown decorative, not gloomy.
  if (t.decorations.includes('stalactites')) {
    drawStalactites(g, decorTheme, GRID_Y - 4, W, 31);
  }

  // Grid separator line — warm seam.
  g.fillStyle(CASUAL.EDGE_SOFT, 0.25);
  g.fillRect(GRID_X - 4, GRID_Y - 2, effectiveCols * effectiveCellSize + 8, 2);

  // Floor area — slightly deeper warm band, low contrast.
  const floorY = GRID_Y + GRID_ROWS * effectiveCellSize + 4;
  g.fillStyle(CASUAL.BG_BOTTOM, 0.55);
  g.fillRect(0, floorY, W, CANVAS_HEIGHT - floorY);
  for (let y = floorY; y < CANVAS_HEIGHT; y += 8) {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.08); g.fillRect(0, y, W, 4);
  }

  // Stalagmites at bottom — warm-brown decorative.
  if (t.decorations.includes('stalagmites')) {
    drawStalagmites(g, decorTheme, floorY + 2, W, 88);
  }

  // Faint warm rock strata texture (uses CASUAL.EDGE_SOFT via override theme).
  drawCaveWallTexture(g, decorTheme, 0, TOP_BAR_HEIGHT, W, CANVAS_HEIGHT - TOP_BAR_HEIGHT, 67);
  drawDungeonDefenseFrame(scene, t, topology, effectiveCellSize, chapter);

  // Atmosphere over the surround: torch glow + drifting embers for depth/life.
  // Vignette OFF — never darken battle edges where invaders enter (readability).
  addSceneAtmosphere(scene, { vignette: false });
}

function drawDungeonDefenseFrame(
  scene: Phaser.Scene,
  _theme: DungeonTheme,   // visual-only reskin ignores the dark theme; uses CASUAL palette
  topology: BattleTopology,
  effectiveCellSize: number,
  chapter = 1,
): void {
  const gridW = topology.cols * effectiveCellSize;
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

  // Alcoves only where the dungeon has a room: corridor (middle row) and its side rooms.
  for (const { row, col } of topology.cells) {
    {
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

  // Entry gate (left) — ember signal where invaders step onto the corridor.
  const corridorY = y + effectiveCellSize * (CORRIDOR_ROW + 0.5);
  const gateY = corridorY;
  g.fillStyle(CASUAL.PANEL, 0.95);
  g.fillRoundedRect(x - 18, gateY - 30, 24, 60, 8);
  g.lineStyle(2.5, CASUAL.RED, 1);
  g.strokeRoundedRect(x - 18, gateY - 30, 24, 60, 8);
  g.fillStyle(CASUAL.RED, 0.9);
  g.fillTriangle(x + 2, gateY, x - 8, gateY - 9, x - 8, gateY + 9);

  // Core "heart" (right end of the corridor) — brass on a dark seal with an iron ring.
  const heartX = x + gridW + 14;
  const heartY = corridorY;
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillCircle(heartX, heartY, 18);
  g.lineStyle(2.5, CASUAL.EDGE, 1);
  g.strokeCircle(heartX, heartY, 18);
  g.fillStyle(CASUAL.GOLD, 0.35);
  g.fillCircle(heartX, heartY, 10);
  g.fillStyle(CASUAL.GOLD, 1);
  g.fillTriangle(heartX, heartY - 8, heartX - 8, heartY, heartX, heartY + 8);
  g.fillTriangle(heartX, heartY - 8, heartX + 8, heartY, heartX, heartY + 8);

  // Corner studs — iron rings with brass centers.
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

/** 침입 경로: 배치도의 주 통로를 따라 입구(왼쪽) → 심장부(오른쪽). battleTopology.corridorWaypoints. */
/** A straight-segment path through the waypoints (no route drawing). */
export function pathFromWaypoints(waypoints: readonly Point[]): Phaser.Curves.Path {
  const [first, ...rest] = waypoints;
  const path = new Phaser.Curves.Path(first.x, first.y);
  for (const pt of rest) path.lineTo(pt.x, pt.y);
  return path;
}

export function buildInvaderPath(scene: Phaser.Scene, waypoints: readonly Point[]): Phaser.Curves.Path {
  drawInvasionRoute(scene, waypoints);
  return pathFromWaypoints(waypoints);
}

function drawInvasionRoute(scene: Phaser.Scene, waypoints: readonly Point[]): void {
  const routeBase = scene.add.graphics().setDepth(48);
  const routeGlow = scene.add.graphics().setDepth(49).setAlpha(0.34);
  const markers = scene.add.graphics().setDepth(51);

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
  drawRouteEndpoint(scene, waypoints[waypoints.length - 2].x + 8, waypoints[waypoints.length - 2].y, '심장부', 0xffe27a, 1);

  scene.tweens.add({
    targets: routeGlow,
    alpha: { from: 0.22, to: 0.46 },
    duration: 1400,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
}

/**
 * 목적이 있는 손님의 우회선 — 주 통로에서 목표 방까지만(나머지는 주 경로와 겹친다). 이번 전투에 그 손님이
 * 올 때만 그린다: 점선 + 목표 방 위 표식(💰 보물고 / 🐲 굴).
 */
export function drawVisitorDetour(
  scene: Phaser.Scene,
  waypoints: readonly Point[],
  corridorY: number,
  kind: 'adventurer' | 'wanderer',
): void {
  const color = kind === 'adventurer' ? COLORS.TORCH_GOLD : 0x9a6cd8;
  const branchAt = waypoints.findIndex(pt => pt.y !== corridorY);
  // A corridor target has no branch: mark the deepest point the visitor reaches.
  const target = branchAt >= 0 ? waypoints[branchAt] : waypoints.reduce((a, b) => (b.x > a.x ? b : a));
  const from = branchAt > 0 ? waypoints[branchAt - 1] : target;
  const g = scene.add.graphics().setDepth(50);
  const len = Math.hypot(target.x - from.x, target.y - from.y);
  const ux = len > 0 ? (target.x - from.x) / len : 0;
  const uy = len > 0 ? (target.y - from.y) / len : 0;
  g.lineStyle(3, color, 0.7);
  for (let d = 0; d < len; d += 12) {
    const end = Math.min(len, d + 6);
    g.lineBetween(from.x + ux * d, from.y + uy * d, from.x + ux * end, from.y + uy * end);
  }
  // Tag in the seam between the corridor and the side room, above the room cards' decoration.
  const tagY = target.y === corridorY ? target.y - 44 : (corridorY + target.y) / 2;
  const label = `${kind === 'adventurer' ? '💰 보물고' : '🐲 굴'} 우회`;
  const tag = scene.add.text(target.x, tagY, label, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#1a120a',
    backgroundColor: kind === 'adventurer' ? '#e8c060' : '#b89ae8', padding: { x: 5, y: 2 },
  }).setOrigin(0.5).setDepth(63);
  scene.tweens.add({ targets: tag, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });
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
    fontSize: '10px',
    color: CSS.PARCHMENT,
    fontStyle: 'bold',
    stroke: '#1a0f00',
    strokeThickness: 2,
  }).setOrigin(0.5).setAlpha(0.86);
  c.add(text);
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export interface GridBuildConfig {
  topology:          BattleTopology;                 // 배치도 → 칸(주 통로 가운데 줄, 곁방 위·아래)
  effectiveCellSize: number;
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
  const { topology, effectiveCellSize: cs, dungeonTrapSlots, onRoomClick } = cfg;
  const gc = topology.cols;
  const rooms: Room[][] = [];

  // The battle is the home dungeon, cell for cell: the corridor runs along the
  // middle row and side rooms sit above/below their anchor. A cell with no
  // room is an inert, invisible 'locked' Room so grid loops keep their shape.
  for (let row = 0; row < GRID_ROWS; row++) {
    rooms[row] = [];
    for (let col = 0; col < gc; col++) {
      const cx = GRID_X + col * cs + cs / 2;
      const cy = GRID_Y + row * cs + cs / 2;
      const homeSlot = slotAt(topology, row, col);
      const room = new Room(scene, cx, cy, row, col, homeSlot === null ? 'locked' : 'empty', onRoomClick, cs);
      room.homeSlot = homeSlot;
      room.setDepth(10);
      if (homeSlot === null) room.setVisible(false);
      rooms[row][col] = room;
    }
  }

  // Pre-load dungeon slot configuration (monsters + traps) into room metadata.
  // These private fields are consumed later in combat setup; we keep the
  // dynamic-cast pattern verbatim to avoid scope-creep into Room's public API.
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < gc; col++) {
      const room = rooms[row][col];
      const slot = room.homeSlot === null ? undefined : dungeonTrapSlots[room.homeSlot];
      if (!slot) continue;
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

/** 주 통로 양 끝(입구·심장부 쪽)의 위·아래 모서리에 횃불. */
export function placeDungeonTorches(scene: Phaser.Scene, topology: BattleTopology, cellSize: number): void {
  const left = GRID_X;
  const right = GRID_X + topology.cols * cellSize;
  const top = GRID_Y + CORRIDOR_ROW * cellSize;
  const bottom = top + cellSize;
  [[left, top], [right, top], [left, bottom], [right, bottom]].forEach(([x, y]) => new Torch(scene, x, y));
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
  const fill = hover ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE;
  const border = hover ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.BRASS;

  g.fillStyle(DUNGEON_UI.VOID, 0.72);
  g.fillRoundedRect(x + 3, y + 5, w, h, 9);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(DUNGEON_UI.EMBER, hover ? 1 : 0.88);
  g.fillRect(x, y + 8, 4, h - 16);
  g.lineStyle(1.5, border, 0.98);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.45);
  g.lineBetween(x + 60, y + 10, x + w - 60, y + 10);
  g.lineBetween(x + 60, y + h - 10, x + w - 60, y + h - 10);

  g.fillStyle(DUNGEON_UI.SOOT, 0.92);
  g.fillRoundedRect(x + 14, y + 13, 36, h - 26, 6);
  g.lineStyle(1, DUNGEON_UI.IRON, 1);
  g.strokeRoundedRect(x + 14, y + 13, 36, h - 26, 6);
  g.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.9);
  g.fillCircle(x + 32, y + h / 2, 7);
  g.fillStyle(DUNGEON_UI.SOOT, 0.9);
  g.fillCircle(x + 32, y + h / 2, 3);

  const arrowX = x + w - 31;
  g.fillStyle(DUNGEON_UI.SOOT, 0.92);
  g.fillCircle(arrowX, y + h / 2, 17);
  g.lineStyle(1.3, border, 0.7);
  g.strokeCircle(arrowX, y + h / 2, 17);
  g.fillStyle(DUNGEON_UI.BRASS_BRIGHT, hover ? 1 : 0.82);
  g.fillTriangle(arrowX - 4, y + h / 2 - 7, arrowX - 4, y + h / 2 + 7, arrowX + 6, y + h / 2);
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

  const bg = markBattleHud(scene.add.graphics().setDepth(60));
  paintWaveButton(bg, bx, by, bw, bh, false);

  const label = scene.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 1, '침입 방어 개시', {
    fontFamily: 'Georgia, serif',
    fontSize: '17px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
    stroke: '#030504',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(61);
  markBattleHud(label);

  const zone = markBattleHud(scene.add.zone(CANVAS_WIDTH / 2, by + bh / 2, bw, bh)
    .setInteractive().setDepth(62));

  zone.on('pointerover', () => {
    if (callbacks.isLocked()) return;
    paintWaveButton(bg, bx, by, bw, bh, true);
    label.setColor(DUNGEON_UI_CSS.BRASS);
  });
  zone.on('pointerout', () => {
    paintWaveButton(bg, bx, by, bw, bh, false);
    label.setColor(DUNGEON_UI_CSS.PARCHMENT);
  });
  zone.on('pointerdown', () => {
    if (!callbacks.isLocked()) callbacks.onPress();
  });

  return { bg, label, zone };
}

export function addDungeonFog(scene: Phaser.Scene): void {
  const fog = markBattleHud(scene.add.graphics().setDepth(90));
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
    const c = markBattleHud(scene.add.graphics().setDepth(91));
    c.fillStyle(0xd4c8a0, 0.6); c.fillRect(x - 2, y, 5, 14);
    c.fillStyle(COLORS.TORCH_GLOW, 0.75); c.fillTriangle(x + 0.5, y - 10, x - 5, y + 1, x + 6, y + 1);
    c.fillStyle(0xffee44, 0.7);           c.fillTriangle(x + 0.5, y - 5,  x - 3, y + 1, x + 4, y + 1);
    scene.tweens.add({
      targets: c, scaleX: { from: 0.85, to: 1.15 }, alpha: { from: 0.5, to: 0.85 },
      duration: Phaser.Math.Between(600, 1000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  });
}
