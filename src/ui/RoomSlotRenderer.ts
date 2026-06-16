/**
 * Battle slot renderer — extracted from DungeonHomeScene.
 *
 * Renders dungeon room slots in 3 states: locked, destroyed, or occupied.
 */
import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { MONSTER_DEFS } from '../data/monsters';
import { EQUIPMENT_DEFS } from '../data/barracks';
import { calculateRoomLoadoutStatus, calculateRoomMetrics } from '../data/dungeonMetrics';
import { getRoomActionRecommendation } from '../data/roomActionRecommendations';
import { SLOT_UNLOCK_LEVELS, ROOM_SLOT_TYPE_DEFS } from '../data/wisdom';
import type { DungeonTheme } from '../themes/themes';
import { drawRoughEdgeRect, strokeRoughEdgeRect } from '../themes/decorations';
import type { GameState } from '../data/wisdom';
import { addMonsterPortrait, resolveMonsterTypeId } from './MonsterPortraitView';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';

// ─── Shared layout constants ───────────────────────────────────────────────

export const SLOT_W = 100;
export const SLOT_H = 100;
export const INVASION_ORDER = [3, 2, 1, 4, 5, 6, 9, 8, 7];

// Saturated casual accents per room type — used as chunky cell borders on cream.
const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat:  CASUAL.RED,
  trap:    CASUAL.GOLD,
  support: CASUAL.GREEN,
  magic:   CASUAL.PURPLE,
};
const ROOM_TYPE_SHORT_LABEL: Record<string, string> = {
  combat: '전투',
  trap: '함정',
  support: '지원',
  magic: '마법',
};
const HOME_MONSTER_SLOT_COLOR = CASUAL.RED;
const HOME_TRAP_SLOT_COLOR = CASUAL.GREEN_DK;

interface RoomActionHint {
  readonly label: string;
  readonly icon: string;
  readonly color: number;
}

interface EquipmentBadge {
  readonly icon: string;
  readonly name: string;
}

function getEquippedItem(gs: GameState, monsterId: string | null | undefined): EquipmentBadge | null {
  if (!monsterId) return null;
  const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return craftedDef ? { icon: craftedDef.emoji, name: craftedDef.name } : null;
}

function getRoomActionHint(
  gs: GameState,
  slotIdx: number,
): RoomActionHint {
  const action = getRoomActionRecommendation(gs, slotIdx);
  return { label: action.label, icon: action.icon, color: action.accent };
}

function drawActionHintBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hint: RoomActionHint,
): void {
  const cx = x + SLOT_W - 18;
  const cy = y + 26;
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillCircle(cx, cy, 11);
  g.lineStyle(2, hint.color, 0.9);
  g.strokeCircle(cx, cy, 11);
  g.fillStyle(hint.color, 0.22);
  g.fillCircle(cx, cy, 7);
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(cx - 3, cy - 4, 2.4);
  c.add(scene.add.text(cx, cy, hint.icon, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawEquipmentBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  equipment: EquipmentBadge,
): void {
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.lineStyle(1.5, CASUAL.GOLD_DK, 0.9);
  g.strokeRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.fillStyle(CASUAL.GOLD, 0.25);
  g.fillCircle(x, y, 8);
  c.add(scene.add.text(x, y, equipment.icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }).setOrigin(0.5));
}

function drawEquipmentPowerAura(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  equipmentPower: number,
  equipment: EquipmentBadge | null,
): void {
  if (equipmentPower <= 0) return;

  g.lineStyle(2, CASUAL.GOLD, 0.6);
  g.strokeRoundedRect(x + 8, y + 15, SLOT_W - 16, SLOT_H - 25, 11);
  g.lineStyle(1, CASUAL.GOLD_DK, 0.3);
  g.strokeRoundedRect(x + 13, y + 20, SLOT_W - 26, SLOT_H - 35, 8);
  g.fillStyle(CASUAL.GOLD, 0.14);
  g.fillRoundedRect(x + 13, y + 21, SLOT_W - 26, 7, 4);
  g.fillStyle(CASUAL.GOLD, 0.22);
  g.fillCircle(x + 20, y + 25, 3);
  g.fillCircle(x + SLOT_W - 20, y + 25, 3);

  if (!equipment) return;
  const name = equipment.name.length > 5 ? `${equipment.name.slice(0, 5)}…` : equipment.name;
  const label = scene.add.text(x + SLOT_W / 2, y + 15, name, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: CASUAL_CSS.GOLD,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  c.add(label);
}

function drawRoomOperationsChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  readiness: number,
  threatScore: number,
  accent: number,
  loadoutStatus?: ReturnType<typeof calculateRoomLoadoutStatus>,
  roomShortLabel?: string,
): void {
  const chipX = x + 9;
  const chipY = y + 57;
  const chipW = 82;
  const chipH = 18;
  const readinessColor = readiness >= 78 ? CASUAL.GREEN : readiness >= 45 ? CASUAL.GOLD : CASUAL.RED;
  const label = loadoutStatus
    ? `${roomShortLabel ?? '방'} M${loadoutStatus.monsterCount}`
    : '운영';
  const value = loadoutStatus
    ? `T${loadoutStatus.trapCount} ${Math.round(readiness)}%`
    : threatScore > 0
    ? `${Math.round(readiness)}%/${Math.min(999, threatScore)}`
    : `${Math.round(readiness)}%/-`;

  g.fillStyle(CASUAL.PANEL_SOFT, 0.96);
  g.fillRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.fillStyle(readinessColor, 0.9);
  g.fillRoundedRect(
    chipX + 2,
    chipY + chipH - 4,
    Math.max(4, (chipW - 4) * Phaser.Math.Clamp(readiness / 100, 0, 1)),
    2,
    1,
  );
  g.fillStyle(accent, 0.85);
  g.fillRoundedRect(chipX + 3, chipY + 3, 4, chipH - 7, 2);
  c.add(scene.add.text(chipX + 10, chipY + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(chipX + chipW - 5, chipY + 8, value, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: readiness >= 45 ? CASUAL_CSS.INK : CASUAL_CSS.RED,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

function drawRoomNameRibbon(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  label: string,
  accent: number,
  readiness: number,
  danger = false,
): void {
  void readiness;
  const ribbonX = x + 30;
  const ribbonY = y + 7;
  const ribbonW = 43;
  const ribbonH = 15;
  const ribbonFill = danger ? CASUAL.RED : accent;

  // Saturated accent ribbon with white sheen + white label (matches Room.ts title strip).
  g.fillStyle(CASUAL.SHADOW, 0.22);
  g.fillRoundedRect(ribbonX, ribbonY + 2, ribbonW, ribbonH, 5);
  g.fillStyle(ribbonFill, 0.92);
  g.fillRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(ribbonX + 5, ribbonY + 3, ribbonW - 10, 2, 1);

  c.add(scene.add.text(ribbonX + ribbonW / 2, ribbonY + ribbonH / 2 + 0.5, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '8px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawHomeSocketChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  kind: 'M' | 'T',
  count: number,
  capacity: number,
  color: number,
): void {
  if (capacity <= 0) return;
  const complete = count >= capacity;
  const label = `${kind}${count}/${capacity}`;
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillRoundedRect(x, y, 38, 16, 5);
  g.lineStyle(1.5, color, complete ? 0.55 : 0.9);
  g.strokeRoundedRect(x, y, 38, 16, 5);
  g.fillStyle(color, complete ? 0.85 : 0.5);
  g.fillRoundedRect(x + 2, y + 3, 4, 10, 3);
  if (!complete) {
    g.fillStyle(color, 0.5);
    g.fillCircle(x + 31, y + 8, 2);
  }
  c.add(scene.add.text(x + 20, y + 8, label, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: complete ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawHomeEmptyRoomLoadoutCue(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  status: ReturnType<typeof calculateRoomLoadoutStatus>,
  accent: number,
): void {
  g.fillStyle(CASUAL.PANEL_SOFT, 0.9);
  g.fillRoundedRect(x + 10, y + 48, SLOT_W - 20, 22, 7);
  g.lineStyle(1.5, accent, 0.55);
  g.strokeRoundedRect(x + 10, y + 48, SLOT_W - 20, 22, 7);
  drawHomeSocketChip(scene, c, g, x + 13, y + 51, 'M', status.monsterCount, status.monsterCapacity, HOME_MONSTER_SLOT_COLOR);
  drawHomeSocketChip(scene, c, g, x + 51, y + 51, 'T', status.trapCount, status.trapCapacity, HOME_TRAP_SLOT_COLOR);
}

function drawRoomTypeProps(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  roomType: string | undefined,
  accent: number,
  readiness: number,
): void {
  const alpha = 0.2 + Phaser.Math.Clamp(readiness / 100, 0, 1) * 0.2;
  g.lineStyle(1.4, accent, 0.4 + alpha);
  g.fillStyle(accent, alpha * 0.45);

  if (roomType === 'combat') {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.6);
    g.fillRoundedRect(x + 21, y + 28, 15, 30, 4);
    g.fillRoundedRect(x + 64, y + 28, 15, 30, 4);
    g.fillStyle(accent, 0.55 + alpha * 0.3);
    g.fillTriangle(x + 21, y + 28, x + 36, y + 28, x + 28.5, y + 44);
    g.fillTriangle(x + 64, y + 28, x + 79, y + 28, x + 71.5, y + 44);
    g.lineStyle(1, CASUAL.EDGE, 0.4 + alpha * 0.2);
    g.lineBetween(x + 38, y + 43, x + 62, y + 32);
    g.lineBetween(x + 38, y + 32, x + 62, y + 43);
    g.fillStyle(accent, 0.5 + alpha * 0.2);
    g.fillRoundedRect(x + 32, y + 58, 36, 9, 4);
    g.fillRoundedRect(x + 16, y + 66, 21, 4, 2);
    g.fillRoundedRect(x + 63, y + 66, 21, 4, 2);
    g.lineBetween(x + 25, y + 62, x + 34, y + 49);
    g.lineBetween(x + 75, y + 62, x + 66, y + 49);
    g.lineStyle(1, 0xffffff, 0.35 + alpha * 0.26);
    g.lineBetween(x + 27, y + 53, x + 36, y + 46);
    g.lineBetween(x + 73, y + 53, x + 64, y + 46);
    return;
  }

  if (roomType === 'trap') {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.5);
    g.fillRoundedRect(x + 24, y + 34, 52, 28, 8);
    g.lineStyle(1, accent, 0.45 + alpha * 0.2);
    for (let i = 0; i < 4; i++) {
      const yy = y + 39 + i * 6;
      g.lineBetween(x + 28, yy, x + 72, yy + (i % 2 === 0 ? 3 : -3));
    }
    g.fillStyle(accent, 0.55 + alpha * 0.18);
    for (let i = 0; i < 4; i++) {
      const px = x + 30 + i * 13;
      g.fillTriangle(px, y + 60, px + 5, y + 49 - (i % 2) * 3, px + 10, y + 60);
    }
    for (let i = 0; i < 5; i++) {
      const px = x + 22 + i * 14;
      g.fillTriangle(px, y + 71, px + 5, y + 58 - (i % 2) * 3, px + 10, y + 71);
    }
    g.lineStyle(1, accent, 0.5 + alpha * 0.5);
    g.lineBetween(x + 18, y + 73, x + 84, y + 73);
    return;
  }

  if (roomType === 'support') {
    g.fillStyle(CASUAL.EDGE_SOFT, 0.45);
    g.fillEllipse(x + SLOT_W / 2, y + 63, 50, 18);
    g.lineStyle(1.4, accent, 0.5 + alpha * 0.2);
    g.strokeCircle(x + SLOT_W / 2, y + 46, 16);
    g.lineStyle(1, accent, 0.45 + alpha * 0.16);
    for (let i = 0; i < 5; i++) {
      const vx = x + 24 + i * 13;
      g.lineBetween(vx, y + 30, vx - 4 + (i % 2) * 8, y + 55);
      g.fillCircle(vx - 3 + (i % 2) * 6, y + 48, 2.4);
    }
    g.fillStyle(accent, 0.55 + alpha * 0.12);
    g.fillCircle(x + SLOT_W / 2, y + 46, 4);
    g.fillRoundedRect(x + 18, y + 55, 10, 24, 3);
    g.fillRoundedRect(x + 72, y + 55, 10, 24, 3);
    g.fillRoundedRect(x + 30, y + 61, 40, 8, 4);
    g.lineStyle(1, 0xffffff, 0.3 + alpha * 0.22);
    g.lineBetween(x + 36, y + 65, x + 64, y + 65);
    return;
  }

  if (roomType === 'magic') {
    const cx = x + SLOT_W / 2;
    const cy = y + 64;
    g.fillStyle(CASUAL.PANEL_SOFT, 0.5);
    g.fillCircle(cx, cy, 26);
    g.lineStyle(1.2, accent, 0.55 + alpha * 0.24);
    g.strokeCircle(cx, cy, 24);
    g.strokeCircle(cx, cy, 16);
    g.strokeCircle(cx, cy, 8);
    g.lineStyle(1, CASUAL.EDGE, 0.3 + alpha * 0.08);
    g.lineBetween(cx - 18, cy + 9, cx, cy - 18);
    g.lineBetween(cx, cy - 18, cx + 18, cy + 9);
    g.lineBetween(cx + 18, cy + 9, cx - 18, cy + 9);
    g.fillStyle(accent, 0.6 + alpha * 0.15);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + 0.2;
      const rx = cx + Math.cos(angle) * 23;
      const ry = cy + Math.sin(angle) * 23;
      g.fillCircle(rx, ry, 2.5);
    }
  }
}

function drawMasonryLines(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  accent: number,
  alpha: number,
): void {
  g.lineStyle(1, CASUAL.EDGE_SOFT, alpha * 0.5);
  for (let row = 0; row < 3; row++) {
    const yy = y + 9 + row * 11;
    g.lineBetween(x + 5, yy, x + w - 5, yy);
  }

  g.lineStyle(1, accent, alpha * 0.5);
  for (let row = 0; row < 3; row++) {
    const offset = row % 2 === 0 ? 9 : 18;
    for (let xx = x + offset; xx < x + w - 8; xx += 22) {
      g.lineBetween(xx, y + 4 + row * 11, xx, y + 13 + row * 11);
    }
  }
}

function drawDungeonRoomShell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
  readiness: number,
): void {
  // Cream cutaway chamber (casual reskin): cream body, soft back wall + white
  // sheen, warm cream floor slab, and an accent ground pad — matches Room.ts.
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const chamberX = x + 5;
  const chamberY = y + 8;
  const chamberW = SLOT_W - 10;
  const chamberH = SLOT_H - 14;
  const backX = x + 17;
  const backY = y + 20;
  const backW = SLOT_W - 34;
  const backH = 38;
  const floorY = y + 58;

  // Warm ground shadow under the cell.
  g.fillStyle(CASUAL.SHADOW, 0.22);
  g.fillEllipse(x + SLOT_W / 2, y + SLOT_H - 10, SLOT_W - 10, 18);

  // Chamber body fill — dark stone.
  g.fillStyle(CASUAL.PANEL, 0.98);
  g.fillRoundedRect(chamberX, chamberY, chamberW, chamberH, 10);

  // Warm torchlight bath — makes an occupied room read as a lived-in, lit
  // dungeon chamber. Two soft pools from the wall sconces + a gentle ambient.
  g.fillStyle(0xff8a3d, 0.05 + glow * 0.07);
  g.fillRoundedRect(chamberX, chamberY, chamberW, chamberH, 10);
  g.fillStyle(0xffb060, 0.06 + glow * 0.1);
  g.fillCircle(x + 18, y + 44, 26);
  g.fillCircle(x + SLOT_W - 18, y + 44, 26);

  // Carved rim accent.
  g.lineStyle(1.5, accent, 0.5 + glow * 0.2);
  g.beginPath();
  g.moveTo(x + 18, y + 29);
  g.lineTo(x + 27, y + 18);
  g.lineTo(x + 41, y + 13);
  g.lineTo(x + 59, y + 13);
  g.lineTo(x + 73, y + 18);
  g.lineTo(x + 82, y + 29);
  g.strokePath();

  // Back wall — soft cream panel + faint accent wash + white sheen line.
  g.fillStyle(CASUAL.PANEL_SOFT, 0.95);
  g.fillRoundedRect(backX, backY, backW, backH, 8);
  g.fillStyle(accent, 0.1 + glow * 0.06);
  g.fillRoundedRect(backX + 6, backY + 7, backW - 12, backH - 9, 7);
  g.lineStyle(1, 0xffffff, 0.4);
  g.lineBetween(backX + 6, backY + 6, backX + backW - 6, backY + 6);
  drawMasonryLines(g, backX + 4, backY + 5, backW - 8, accent, 0.42 + glow * 0.28);

  // Side walls — soft cream wedges with accent seam.
  g.fillStyle(CASUAL.PANEL_SOFT, 0.7);
  g.fillTriangle(chamberX + 3, chamberY + 18, backX, backY + 7, x + 14, y + SLOT_H - 13);
  g.fillTriangle(chamberX + chamberW - 3, chamberY + 18, backX + backW, backY + 7, x + SLOT_W - 14, y + SLOT_H - 13);
  g.lineStyle(1, accent, 0.3 + glow * 0.16);
  g.lineBetween(backX, backY + 10, x + 14, y + SLOT_H - 14);
  g.lineBetween(backX + backW, backY + 10, x + SLOT_W - 14, y + SLOT_H - 14);

  // Perspective floor slab — warm cream.
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.beginPath();
  g.moveTo(x + 16, floorY);
  g.lineTo(x + SLOT_W - 16, floorY);
  g.lineTo(x + SLOT_W - 7, y + SLOT_H - 12);
  g.lineTo(x + 7, y + SLOT_H - 12);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.1 + glow * 0.06);
  g.beginPath();
  g.moveTo(x + 20, floorY + 2);
  g.lineTo(x + SLOT_W - 20, floorY + 2);
  g.lineTo(x + SLOT_W - 18, y + SLOT_H - 19);
  g.lineTo(x + 18, y + SLOT_H - 19);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, accent, 0.4 + glow * 0.18);
  g.lineBetween(x + 16, floorY, x + SLOT_W - 16, floorY);
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.45);
  g.lineBetween(x + 23, floorY + 3, x + 13, y + SLOT_H - 14);
  g.lineBetween(x + SLOT_W - 23, floorY + 3, x + SLOT_W - 13, y + SLOT_H - 14);
  g.lineBetween(x + 32, floorY + 7, x + SLOT_W - 32, floorY + 7);
  g.lineBetween(x + 25, floorY + 17, x + SLOT_W - 25, floorY + 17);

  // Wall niche behind the portrait — soft cream pocket + accent glow.
  g.fillStyle(CASUAL.PANEL_SOFT, 0.9);
  g.fillCircle(x + SLOT_W / 2, backY + 21, 15);
  g.fillRoundedRect(x + SLOT_W / 2 - 15, backY + 21, 30, 23, 7);
  g.fillStyle(accent, 0.14 + glow * 0.1);
  g.fillCircle(x + SLOT_W / 2, backY + 22, 10);

  // Side pillars — cream with accent seam.
  g.fillStyle(CASUAL.PANEL_SOFT, 0.95);
  g.fillRoundedRect(x + 5, y + 32, 10, 42, 5);
  g.fillRoundedRect(x + SLOT_W - 15, y + 32, 10, 42, 5);
  g.lineStyle(1, accent, 0.45 + glow * 0.15);
  g.lineBetween(x + 10, y + 37, x + 10, y + 67);
  g.lineBetween(x + SLOT_W - 10, y + 37, x + SLOT_W - 10, y + 67);
  g.fillStyle(accent, 0.5 + glow * 0.12);
  g.fillCircle(x + 10, y + 42, 2.6);
  g.fillCircle(x + SLOT_W - 10, y + 42, 2.6);

  // Wall torches — bracket + flame, so the room reads as torch-lit.
  for (const tx of [x + 18, x + SLOT_W - 18]) {
    const ty = y + 44;
    // glow halo
    g.fillStyle(0xff8a3d, 0.18 + glow * 0.14);
    g.fillCircle(tx, ty - 2, 9);
    // iron bracket
    g.fillStyle(CASUAL.EDGE, 0.9);
    g.fillRoundedRect(tx - 2, ty, 4, 8, 1.5);
    // flame (outer warm + inner bright)
    g.fillStyle(0xff6b1a, 0.95);
    g.fillTriangle(tx - 4, ty, tx, ty - 11, tx + 4, ty);
    g.fillStyle(0xffd24a, 1);
    g.fillTriangle(tx - 2, ty, tx, ty - 6, tx + 2, ty);
  }
}

// Deterministic 0..1 from an integer seed (stable per slot, no Math.random).
function seededUnit(seed: number, salt: number): number {
  const v = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function drawLockedExcavationFace(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  seed: number,
): void {
  // Unexcavated rock — a craggy earth/stone face the player will dig out.
  // Reads as "solid rock to excavate" so locked slots feel like dungeon
  // expansion, not just sealed panels. (README: 잠긴 칸 = 파내는 암반)
  const ix = x + 8, iy = y + 8, iw = SLOT_W - 16, ih = SLOT_H - 16;

  // Raw rock fill — earthy dark stone, darker than the lit rooms.
  g.fillStyle(0x1c150b, 1);
  g.fillRoundedRect(ix, iy, iw, ih, 7);
  // Top-lit rock shelf + deep lower shadow for carved-into-earth depth.
  g.fillStyle(0x2a2012, 0.9);
  g.fillRoundedRect(ix, iy, iw, ih * 0.42, { tl: 7, tr: 7, bl: 0, br: 0 });
  g.fillStyle(0x000000, 0.28);
  g.fillRoundedRect(ix, iy + ih * 0.62, iw, ih * 0.38, { tl: 0, tr: 0, bl: 7, br: 7 });

  // Embedded boulders (deterministic lumps).
  for (let i = 0; i < 5; i++) {
    const bx = ix + 8 + seededUnit(seed, i) * (iw - 16);
    const by = iy + 10 + seededUnit(seed, i + 9) * (ih - 22);
    const r = 4 + seededUnit(seed, i + 3) * 5;
    g.fillStyle(0x342819, 0.8);
    g.fillCircle(bx, by, r);
    g.fillStyle(0x120d06, 0.5);
    g.fillCircle(bx + 1.5, by + 1.8, r * 0.7);
    g.fillStyle(CASUAL.EDGE_SOFT, 0.22);
    g.fillCircle(bx - r * 0.4, by - r * 0.45, r * 0.4);
  }

  // Cracks splitting the rock.
  g.lineStyle(1.5, 0x0c0804, 0.7);
  const mx = ix + iw / 2;
  g.lineBetween(mx, iy + 6, mx - 6 + seededUnit(seed, 1) * 12, iy + ih * 0.5);
  g.lineBetween(mx - 6 + seededUnit(seed, 1) * 12, iy + ih * 0.5, ix + 10, iy + ih - 6);
  g.lineBetween(mx - 6 + seededUnit(seed, 1) * 12, iy + ih * 0.5, ix + iw - 12, iy + ih - 8);
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.18);
  g.lineBetween(mx + 1, iy + 6, mx - 5 + seededUnit(seed, 1) * 12, iy + ih * 0.5);

  // Ore / gem glints — hints of reward buried in the rock.
  const oreColors = [CASUAL.GOLD, CASUAL.BLUE, CASUAL.PURPLE];
  for (let i = 0; i < 3; i++) {
    const ox = ix + 12 + seededUnit(seed, i + 20) * (iw - 24);
    const oy = iy + 14 + seededUnit(seed, i + 27) * (ih - 28);
    g.fillStyle(oreColors[i % oreColors.length], 0.55);
    g.fillCircle(ox, oy, 1.8);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(ox - 0.6, oy - 0.6, 0.7);
  }

  // Chiseled rock rim.
  g.lineStyle(2, CASUAL.EDGE, 0.5);
  g.strokeRoundedRect(ix, iy, iw, ih, 7);
}

function drawConstructionScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
): void {
  // Bright "blueprint plot" (casual reskin): a clean cream build pad with a dashed
  // accent blueprint frame + corner pegs — reads as buildable on the bright board.
  const cx = x + SLOT_W / 2;

  // Soft cream build pad + warm ground shadow.
  g.fillStyle(CASUAL.SHADOW, 0.18);
  g.fillEllipse(cx, y + SLOT_H - 14, SLOT_W - 30, 12);
  g.fillStyle(CASUAL.PANEL_SOFT, 0.85);
  g.fillRoundedRect(x + 16, y + 26, SLOT_W - 32, SLOT_H - 44, 9);

  // Blueprint frame — accent dashes around the pad.
  g.lineStyle(1.5, accent, 0.7);
  g.strokeRoundedRect(x + 20, y + 30, SLOT_W - 40, SLOT_H - 52, 7);
  g.lineStyle(1, accent, 0.4);
  g.lineBetween(x + 28, y + 44, x + SLOT_W - 28, y + 44);
  g.lineBetween(x + 28, y + 56, x + SLOT_W - 28, y + 56);
  g.lineBetween(cx, y + 34, cx, y + 64);

  // Corner build pegs.
  g.fillStyle(accent, 0.85);
  g.fillCircle(x + 22, y + 32, 2.4);
  g.fillCircle(x + SLOT_W - 22, y + 32, 2.4);
  g.fillCircle(x + 22, y + SLOT_H - 24, 2.4);
  g.fillCircle(x + SLOT_W - 22, y + SLOT_H - 24, 2.4);

  // Warm gold guide pins.
  g.fillStyle(CASUAL.GOLD, 0.8);
  g.fillCircle(x + 31, y + 64, 2.5);
  g.fillCircle(x + SLOT_W - 31, y + 64, 2.5);
}

function addRoomShine(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  readiness: number,
  seed: number,
): void {
  if (readiness < 55) return;
  const shine = scene.add.graphics();
  shine.fillStyle(accent, 0.14);
  shine.fillRoundedRect(x + 9, y + 8, SLOT_W - 18, 4, 3);
  shine.lineStyle(1, accent, 0.26);
  shine.lineBetween(x + 18, y + SLOT_H - 20, x + SLOT_W - 18, y + SLOT_H - 24);
  shine.setAlpha(0.18);
  c.add(shine);
  scene.tweens.add({
    targets: shine,
    alpha: 0.42,
    duration: 900 + (seed % 4) * 180,
    delay: seed * 70,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ─── RoomSlotContext ───────────────────────────────────────────────────────

export interface RoomSlotContext {
  readonly scene: Phaser.Scene;
  readonly theme: DungeonTheme;
  readonly gs: GameState;
  applyIdleAnimation(emoji: Phaser.GameObjects.Text, monsterId: string, compact: boolean): void;
}

// ─── drawBattleSlot ────────────────────────────────────────────────────────

export function drawBattleSlot(
  ctx: RoomSlotContext,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  index: number, unlocked: boolean,
): void {
  const { scene, gs } = ctx;

  if (!unlocked) {
    // Locked slots read as raw rock to be excavated — dungeon expansion.
    drawRoughEdgeRect(g, 0x1c150b, 1, x, y, SLOT_W, SLOT_H, index * 17);
    strokeRoughEdgeRect(g, CASUAL.EDGE, 0.7, 2.5, x, y, SLOT_W, SLOT_H, index * 17);
    drawLockedExcavationFace(g, x, y, index * 17);
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2;
    // Pickaxe affordance — "dig this out".
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(cx, cy - 8, 15);
    c.add(scene.add.text(cx, cy - 8, '⛏', { fontSize: '18px' }).setOrigin(0.5).setAlpha(0.92));
    const reqLv = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
    g.fillStyle(CASUAL.PANEL, 0.98);
    g.fillRoundedRect(cx - 26, cy + 10, 52, 17, 6);
    g.lineStyle(1.5, CASUAL.GOLD_DK, 0.8);
    g.strokeRoundedRect(cx - 26, cy + 10, 52, 17, 6);
    c.add(scene.add.text(cx, cy + 18, `Lv.${reqLv} 굴착`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    return;
  }

  const slot = gs.dungeonSlots?.[index];
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot?.roomType);
  const roomMetrics = calculateRoomMetrics(gs, slot);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const actionHint = getRoomActionHint(gs, index);

  // ── 파손 방: HP=0 특수 표시 ────────────────────────────────────────────────
  if (slot?.roomType && slot.hp <= 0) {
    // Broken room — cream tile with RED danger border + red crack marks.
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.RED, 0.12);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    g.lineStyle(2.5, CASUAL.RED, 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '파손 방', CASUAL.RED, roomMetrics.readiness, true);
    // Crack lines
    g.lineStyle(2, CASUAL.RED_DK, 0.85);
    g.lineBetween(x + 18, y + 8,  x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + SLOT_W - 14, y + SLOT_H - 6);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + 10, y + SLOT_H - 14);
    const cx = x + SLOT_W / 2;
    g.fillStyle(CASUAL.RED, 0.15);
    g.fillCircle(cx, y + SLOT_H / 2 - 10, 27);
    c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, '💥', { fontFamily: 'sans-serif', fontSize: '22px' }).setOrigin(0.5).setAlpha(0.85));
    c.add(scene.add.text(cx, y + SLOT_H / 2 + 12, '파손', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(scene.add.text(cx, y + SLOT_H - 10, '수리 필요', {
      fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    drawActionHintBadge(scene, c, g, x, y, actionHint);
    // Invasion order badge
    const order = INVASION_ORDER[index];
    if (order !== undefined) {
      const bg2 = scene.add.graphics();
      bg2.fillStyle(CASUAL.RED, 0.95);
      bg2.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
      bg2.lineStyle(1, CASUAL.RED_DK, 0.7);
      bg2.strokeRoundedRect(x + 2, y + 2, 16, 14, 3);
      c.add(bg2);
      c.add(scene.add.text(x + 10, y + 9, String(order), { fontFamily: 'monospace', fontSize: '9px', color: CASUAL_CSS.WHITE, fontStyle: 'bold' }).setOrigin(0.5));
    }
    return;
  }

  const primaryMonsterId = slot?.monsterIds?.[0];
  const typeIdForSlot = primaryMonsterId ? resolveMonsterTypeId(primaryMonsterId) : null;
  const monDef = typeIdForSlot ? MONSTER_DEFS[typeIdForSlot] : null;
  const primaryEquipment = getEquippedItem(gs, primaryMonsterId);

  if (monDef) {
    // ── Occupied cell: cream chamber with the room's saturated accent ──────
    const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.GOLD;
    // Warm shadow + cream cell body + white top highlight (matches Room.ts).
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    drawDungeonRoomShell(g, x, y, roomAccent, roomMetrics.readiness);
    drawRoomTypeProps(g, x, y, slot?.roomType, roomAccent, roomMetrics.readiness);
    addRoomShine(scene, c, x, y, roomAccent, roomMetrics.readiness, index);
    drawEquipmentPowerAura(scene, c, g, x, y, roomMetrics.equipmentPower, primaryEquipment);

    // Chunky saturated accent border.
    g.lineStyle(2.5, roomAccent, 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);

    g.fillStyle(roomAccent, 0.95);
    g.fillCircle(x + 15, y + 15, 10);
    g.lineStyle(1.5, CASUAL.EDGE, 0.8);
    g.strokeCircle(x + 15, y + 15, 10);
    c.add(scene.add.text(x + 15, y + 15, typeDef?.icon ?? '▣', {
      fontFamily: 'sans-serif', fontSize: '12px',
    }).setOrigin(0.5));
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '던전 방', roomAccent, roomMetrics.readiness);

    // Soft accent glow behind the portrait — warm casual accent by monster type.
    const glowColor: Record<string, number> = {
      melee:   CASUAL.RED,
      ranged:  CASUAL.GOLD,
      magic:   CASUAL.PURPLE,
      support: CASUAL.GREEN,
    };
    const glow = glowColor[monDef.type] ?? roomAccent;
    const glowG = scene.add.graphics();
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2 - 10;
    for (let r = 22; r >= 6; r -= 4) {
      glowG.fillStyle(glow, 0.06 * (22 - r) / 4 + 0.05);
      glowG.fillCircle(cx, cy, r);
    }
    c.add(glowG);

    const portrait = addMonsterPortrait(scene, c, cx, cy, primaryMonsterId ?? '', {
      size: 58,
      frameColor: roomAccent,
      glowColor: glow,
      bgColor: CASUAL.PANEL_SOFT,
      equippedSkins: gs.equippedSkins ?? {},
    });
    if (portrait.fallbackText && typeIdForSlot) {
      ctx.applyIdleAnimation(portrait.fallbackText, typeIdForSlot, true);
    }
    if (primaryEquipment) {
      drawEquipmentBadge(scene, c, g, x + SLOT_W - 20, y + SLOT_H / 2 - 8, primaryEquipment);
    }

    // Level badge top-right — gold chip with white sheen.
    if (slot && slot.roomLevel > 1) {
      const badgeBg = scene.add.graphics();
      badgeBg.fillStyle(CASUAL.GOLD, 1);
      badgeBg.fillRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      badgeBg.lineStyle(1.5, CASUAL.EDGE, 0.85);
      badgeBg.strokeRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      c.add(badgeBg);
      c.add(scene.add.text(x + SLOT_W - 12, y + 8, `Lv${slot.roomLevel}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    drawRoomOperationsChip(
      scene,
      c,
      g,
      x,
      y,
      roomMetrics.readiness,
      roomMetrics.threatScore,
      roomAccent,
      loadoutStatus,
      ROOM_TYPE_SHORT_LABEL[slot?.roomType ?? ''],
    );
    drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
      x: x + 9,
      y: y + 77,
      w: SLOT_W - 18,
      h: 14,
      accent: roomAccent,
    });

    // HP bar bottom — cream track + brown edge, fill GREEN/GOLD/RED by ratio.
    if (slot) {
      const hpPct = Math.max(0, slot.hp / slot.maxHp);
      const barW  = SLOT_W - 10;
      const barY  = y + SLOT_H - 8;
      const barColor = hpPct > 0.66 ? CASUAL.GREEN : hpPct > 0.33 ? CASUAL.GOLD : CASUAL.RED;
      g.fillStyle(CASUAL.EDGE, 1);
      g.fillRoundedRect(x + 3.5, barY - 1.5, barW + 3, 7, 3);
      g.fillStyle(CASUAL.PANEL_SOFT, 1);
      g.fillRoundedRect(x + 5, barY, barW, 4, 2);
      g.fillStyle(barColor, 1);
      g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
    }
  } else {
    // ── Empty / buildable cell: cream PANEL_SOFT plot ─────────────────────
    const hasType = !!(slot?.roomType);
    g.fillStyle(CASUAL.SHADOW, 0.2);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    const emptyBorder = hasType ? (ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.EDGE) : CASUAL.EDGE;
    g.lineStyle(2.5, emptyBorder, hasType ? 0.9 : 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);

    if (hasType) {
      const td = typeDef;
      const cx = x + SLOT_W / 2;
      const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.GOLD;
      drawDungeonRoomShell(g, x, y, roomAccent, roomMetrics.readiness);
      drawRoomTypeProps(g, x, y, slot?.roomType, roomAccent, roomMetrics.readiness);
      addRoomShine(scene, c, x, y, roomAccent, roomMetrics.readiness, index);
      c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, td?.icon ?? '▣', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5).setAlpha(0.74));
      drawRoomNameRibbon(scene, c, g, x, y, td?.name ?? '던전 방', roomAccent, roomMetrics.readiness);
      drawHomeEmptyRoomLoadoutCue(scene, c, g, x, y, loadoutStatus, roomAccent);
      c.add(scene.add.text(cx, y + 73, `${ROOM_TYPE_SHORT_LABEL[slot?.roomType ?? ''] ?? '방'} 대기`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
        x: x + 9,
        y: y + 80,
        w: SLOT_W - 18,
        h: 12,
        accent: roomAccent,
      });
      if (slot && slot.hp < slot.maxHp) {
        const hpPct = Math.max(0, slot.hp / slot.maxHp);
        const barW  = SLOT_W - 10;
        const barY  = y + SLOT_H - 8;
        g.fillStyle(CASUAL.EDGE, 1);
        g.fillRoundedRect(x + 3.5, barY - 1.5, barW + 3, 7, 3);
        g.fillStyle(CASUAL.PANEL_SOFT, 1);
        g.fillRoundedRect(x + 5, barY, barW, 4, 2);
        g.fillStyle(hpPct > 0.66 ? CASUAL.GREEN : hpPct > 0.33 ? CASUAL.GOLD : CASUAL.RED, 1);
        g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
      }
    } else {
      // Truly empty — bright blueprint plot inviting a build.
      drawConstructionScaffold(g, x, y, CASUAL.GOLD);
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 - 14, '+', {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0.5));
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 + 10, '방 설계', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  if (actionHint.label !== '완비' && slot?.roomType) {
    drawActionHintBadge(scene, c, g, x, y, actionHint);
  }

  // ── Invasion order badge (top-left, all unlocked slots) ───────────────────
  const order = INVASION_ORDER[index];
  if (order !== undefined && !slot?.roomType) {
    const badgeG = scene.add.graphics();
    badgeG.fillStyle(CASUAL.GOLD, 0.95);
    badgeG.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
    badgeG.lineStyle(1, CASUAL.EDGE, 0.7);
    badgeG.strokeRoundedRect(x + 2, y + 2, 16, 14, 3);
    c.add(badgeG);
    c.add(scene.add.text(x + 10, y + 9, String(order), {
      fontFamily: 'monospace', fontSize: '9px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5));
  }
}
