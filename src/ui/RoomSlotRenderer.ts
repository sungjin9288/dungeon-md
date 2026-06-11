/**
 * Battle slot renderer — extracted from DungeonHomeScene.
 *
 * Renders dungeon room slots in 3 states: locked, destroyed, or occupied.
 */
import Phaser from 'phaser';
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

const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat:  0xb64a3a,
  trap:    0xc8921a,
  support: 0x44aa77,
  magic:   0x7f66cc,
};
const ROOM_TYPE_SHORT_LABEL: Record<string, string> = {
  combat: '전투',
  trap: '함정',
  support: '지원',
  magic: '마법',
};
const HOME_MONSTER_SLOT_COLOR = 0x8ff0d0;
const HOME_TRAP_SLOT_COLOR = 0xffc45f;

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
  g.fillStyle(0x050806, 0.88);
  g.fillCircle(cx, cy, 11);
  g.lineStyle(1.2, hint.color, 0.72);
  g.strokeCircle(cx, cy, 11);
  g.fillStyle(hint.color, 0.20);
  g.fillCircle(cx, cy, 7);
  g.fillStyle(0xffffff, 0.16);
  g.fillCircle(cx - 3, cy - 4, 2);
  c.add(scene.add.text(cx, cy, hint.icon, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#fff0c2',
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
  g.fillStyle(0x070806, 0.92);
  g.fillRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.lineStyle(1, 0xffcc66, 0.72);
  g.strokeRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.fillStyle(0xffcc66, 0.16);
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

  g.lineStyle(1.4, 0xffd166, 0.54);
  g.strokeRoundedRect(x + 8, y + 15, SLOT_W - 16, SLOT_H - 25, 11);
  g.lineStyle(0.8, 0xffffff, 0.14);
  g.strokeRoundedRect(x + 13, y + 20, SLOT_W - 26, SLOT_H - 35, 8);
  g.fillStyle(0xffd166, 0.08);
  g.fillRoundedRect(x + 13, y + 21, SLOT_W - 26, 7, 4);
  g.fillStyle(0xffd166, 0.15);
  g.fillCircle(x + 20, y + 25, 3);
  g.fillCircle(x + SLOT_W - 20, y + 25, 3);

  if (!equipment) return;
  const name = equipment.name.length > 5 ? `${equipment.name.slice(0, 5)}…` : equipment.name;
  const label = scene.add.text(x + SLOT_W / 2, y + 15, name, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#ffe6a6',
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
  const readinessColor = readiness >= 78 ? 0x44ccaa : readiness >= 45 ? 0xc8921a : 0xff6a4a;
  const label = loadoutStatus
    ? `${roomShortLabel ?? '방'} M${loadoutStatus.monsterCount}`
    : '운영';
  const value = loadoutStatus
    ? `T${loadoutStatus.trapCount} ${Math.round(readiness)}%`
    : threatScore > 0
    ? `${Math.round(readiness)}%/${Math.min(999, threatScore)}`
    : `${Math.round(readiness)}%/-`;

  g.fillStyle(0x030607, 0.86);
  g.fillRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.lineStyle(1, readinessColor, 0.46);
  g.strokeRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.fillStyle(readinessColor, 0.18);
  g.fillRoundedRect(
    chipX + 2,
    chipY + chipH - 4,
    Math.max(4, (chipW - 4) * Phaser.Math.Clamp(readiness / 100, 0, 1)),
    2,
    1,
  );
  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(chipX + 3, chipY + 3, 4, chipH - 7, 2);
  c.add(scene.add.text(chipX + 10, chipY + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(chipX + chipW - 5, chipY + 8, value, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: readiness >= 45 ? '#fff0c2' : '#ffb39a',
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
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const ribbonX = x + 30;
  const ribbonY = y + 7;
  const ribbonW = 43;
  const ribbonH = 15;
  const labelColor = danger ? '#ffb7a8' : '#fff3cf';

  g.fillStyle(0x020405, 0.82);
  g.fillRoundedRect(ribbonX, ribbonY + 2, ribbonW, ribbonH, 5);
  g.fillStyle(accent, danger ? 0.18 : 0.10 + glow * 0.08);
  g.fillRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.lineStyle(1, accent, danger ? 0.58 : 0.34 + glow * 0.22);
  g.strokeRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.fillStyle(0xffffff, danger ? 0.10 : 0.07);
  g.fillRoundedRect(ribbonX + 5, ribbonY + 4, ribbonW - 10, 2, 1);

  c.add(scene.add.text(ribbonX + ribbonW / 2, ribbonY + ribbonH / 2 + 0.5, label, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '8px',
    color: labelColor,
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
  g.fillStyle(0x030607, 0.90);
  g.fillRoundedRect(x, y, 38, 16, 5);
  g.lineStyle(1, color, complete ? 0.38 : 0.66);
  g.strokeRoundedRect(x, y, 38, 16, 5);
  g.fillStyle(color, complete ? 0.12 : 0.20);
  g.fillRoundedRect(x + 2, y + 3, 4, 10, 3);
  if (!complete) {
    g.fillStyle(color, 0.24);
    g.fillCircle(x + 31, y + 8, 2);
  }
  c.add(scene.add.text(x + 20, y + 8, label, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: complete ? '#9ebcae' : '#fff4ce',
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
  g.fillStyle(0x020405, 0.58);
  g.fillRoundedRect(x + 10, y + 48, SLOT_W - 20, 22, 7);
  g.lineStyle(1, accent, 0.24);
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
  g.lineStyle(1.4, accent, alpha);
  g.fillStyle(accent, alpha * 0.45);

  if (roomType === 'combat') {
    g.fillStyle(0x120604, 0.54);
    g.fillRoundedRect(x + 21, y + 28, 15, 30, 4);
    g.fillRoundedRect(x + 64, y + 28, 15, 30, 4);
    g.fillStyle(accent, 0.2 + alpha * 0.2);
    g.fillTriangle(x + 21, y + 28, x + 36, y + 28, x + 28.5, y + 44);
    g.fillTriangle(x + 64, y + 28, x + 79, y + 28, x + 71.5, y + 44);
    g.lineStyle(1, 0xffd8a0, 0.18 + alpha * 0.12);
    g.lineBetween(x + 38, y + 43, x + 62, y + 32);
    g.lineBetween(x + 38, y + 32, x + 62, y + 43);
    g.fillStyle(accent, 0.18 + alpha * 0.12);
    g.fillRoundedRect(x + 32, y + 58, 36, 9, 4);
    g.fillRoundedRect(x + 16, y + 66, 21, 4, 2);
    g.fillRoundedRect(x + 63, y + 66, 21, 4, 2);
    g.lineBetween(x + 25, y + 62, x + 34, y + 49);
    g.lineBetween(x + 75, y + 62, x + 66, y + 49);
    g.lineStyle(1, 0xffffff, alpha * 0.26);
    g.lineBetween(x + 27, y + 53, x + 36, y + 46);
    g.lineBetween(x + 73, y + 53, x + 64, y + 46);
    return;
  }

  if (roomType === 'trap') {
    g.fillStyle(0x1a1003, 0.54);
    g.fillRoundedRect(x + 24, y + 34, 52, 28, 8);
    g.lineStyle(1, accent, 0.24 + alpha * 0.2);
    for (let i = 0; i < 4; i++) {
      const yy = y + 39 + i * 6;
      g.lineBetween(x + 28, yy, x + 72, yy + (i % 2 === 0 ? 3 : -3));
    }
    g.fillStyle(accent, 0.22 + alpha * 0.18);
    for (let i = 0; i < 4; i++) {
      const px = x + 30 + i * 13;
      g.fillTriangle(px, y + 60, px + 5, y + 49 - (i % 2) * 3, px + 10, y + 60);
    }
    for (let i = 0; i < 5; i++) {
      const px = x + 22 + i * 14;
      g.fillTriangle(px, y + 71, px + 5, y + 58 - (i % 2) * 3, px + 10, y + 71);
    }
    g.lineStyle(1, accent, alpha * 0.8);
    g.lineBetween(x + 18, y + 73, x + 84, y + 73);
    return;
  }

  if (roomType === 'support') {
    g.fillStyle(0x06130c, 0.56);
    g.fillEllipse(x + SLOT_W / 2, y + 63, 50, 18);
    g.lineStyle(1.4, accent, 0.26 + alpha * 0.2);
    g.strokeCircle(x + SLOT_W / 2, y + 46, 16);
    g.lineStyle(1, accent, 0.22 + alpha * 0.16);
    for (let i = 0; i < 5; i++) {
      const vx = x + 24 + i * 13;
      g.lineBetween(vx, y + 30, vx - 4 + (i % 2) * 8, y + 55);
      g.fillCircle(vx - 3 + (i % 2) * 6, y + 48, 2.4);
    }
    g.fillStyle(accent, 0.24 + alpha * 0.12);
    g.fillCircle(x + SLOT_W / 2, y + 46, 4);
    g.fillRoundedRect(x + 18, y + 55, 10, 24, 3);
    g.fillRoundedRect(x + 72, y + 55, 10, 24, 3);
    g.fillRoundedRect(x + 30, y + 61, 40, 8, 4);
    g.lineStyle(1, 0xffffff, alpha * 0.22);
    g.lineBetween(x + 36, y + 65, x + 64, y + 65);
    return;
  }

  if (roomType === 'magic') {
    const cx = x + SLOT_W / 2;
    const cy = y + 64;
    g.fillStyle(0x09061a, 0.58);
    g.fillCircle(cx, cy, 26);
    g.lineStyle(1.2, accent, 0.28 + alpha * 0.24);
    g.strokeCircle(cx, cy, 24);
    g.strokeCircle(cx, cy, 16);
    g.strokeCircle(cx, cy, 8);
    g.lineStyle(1, 0xffffff, 0.10 + alpha * 0.08);
    g.lineBetween(cx - 18, cy + 9, cx, cy - 18);
    g.lineBetween(cx, cy - 18, cx + 18, cy + 9);
    g.lineBetween(cx + 18, cy + 9, cx - 18, cy + 9);
    g.fillStyle(accent, 0.32 + alpha * 0.15);
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
  g.lineStyle(1, 0xffffff, alpha * 0.18);
  for (let row = 0; row < 3; row++) {
    const yy = y + 9 + row * 11;
    g.lineBetween(x + 5, yy, x + w - 5, yy);
  }

  g.lineStyle(1, accent, alpha * 0.22);
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

  g.fillStyle(0x020405, 0.54);
  g.fillEllipse(x + SLOT_W / 2, y + SLOT_H - 10, SLOT_W - 10, 18);

  // Cutaway chamber silhouette: carved rim, back wall, side walls, and a perspective floor.
  g.fillStyle(0x071012, 0.98);
  g.beginPath();
  g.moveTo(x + 13, y + 29);
  g.lineTo(x + 22, y + 14);
  g.lineTo(x + 39, y + 8);
  g.lineTo(x + 61, y + 8);
  g.lineTo(x + 78, y + 14);
  g.lineTo(x + 87, y + 29);
  g.lineTo(x + 94, y + SLOT_H - 14);
  g.lineTo(x + 78, y + SLOT_H - 6);
  g.lineTo(x + 22, y + SLOT_H - 6);
  g.lineTo(x + 6, y + SLOT_H - 14);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x020405, 0.64);
  g.beginPath();
  g.moveTo(chamberX + 7, chamberY + 21);
  g.lineTo(chamberX + 18, chamberY + 9);
  g.lineTo(chamberX + chamberW - 18, chamberY + 9);
  g.lineTo(chamberX + chamberW - 7, chamberY + 21);
  g.lineTo(chamberX + chamberW - 2, chamberY + chamberH - 7);
  g.lineTo(chamberX + 2, chamberY + chamberH - 7);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.3, accent, 0.16 + glow * 0.18);
  g.beginPath();
  g.moveTo(x + 18, y + 29);
  g.lineTo(x + 27, y + 18);
  g.lineTo(x + 41, y + 13);
  g.lineTo(x + 59, y + 13);
  g.lineTo(x + 73, y + 18);
  g.lineTo(x + 82, y + 29);
  g.strokePath();
  g.lineStyle(1, 0xffffff, 0.08 + glow * 0.08);
  g.lineBetween(x + 24, y + 17, x + 17, y + 36);
  g.lineBetween(x + 76, y + 17, x + 83, y + 36);
  g.lineBetween(x + 38, y + 11, x + 31, y + 25);
  g.lineBetween(x + 62, y + 11, x + 69, y + 25);

  g.fillStyle(0x152229, 0.98);
  g.fillRoundedRect(backX, backY, backW, backH, 8);
  g.fillStyle(0x071014, 0.72);
  g.fillRoundedRect(backX + 6, backY + 7, backW - 12, backH - 9, 7);
  drawMasonryLines(g, backX + 4, backY + 5, backW - 8, accent, 0.42 + glow * 0.28);

  g.fillStyle(0x0b1519, 0.98);
  g.fillTriangle(chamberX + 3, chamberY + 18, backX, backY + 7, x + 14, y + SLOT_H - 13);
  g.fillTriangle(chamberX + chamberW - 3, chamberY + 18, backX + backW, backY + 7, x + SLOT_W - 14, y + SLOT_H - 13);
  g.lineStyle(1, accent, 0.12 + glow * 0.16);
  g.lineBetween(backX, backY + 10, x + 14, y + SLOT_H - 14);
  g.lineBetween(backX + backW, backY + 10, x + SLOT_W - 14, y + SLOT_H - 14);

  g.fillStyle(0x091113, 0.96);
  g.beginPath();
  g.moveTo(x + 16, floorY);
  g.lineTo(x + SLOT_W - 16, floorY);
  g.lineTo(x + SLOT_W - 7, y + SLOT_H - 12);
  g.lineTo(x + 7, y + SLOT_H - 12);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.08 + glow * 0.08);
  g.beginPath();
  g.moveTo(x + 20, floorY + 2);
  g.lineTo(x + SLOT_W - 20, floorY + 2);
  g.lineTo(x + SLOT_W - 18, y + SLOT_H - 19);
  g.lineTo(x + 18, y + SLOT_H - 19);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, accent, 0.16 + glow * 0.18);
  g.lineBetween(x + 16, floorY, x + SLOT_W - 16, floorY);
  g.lineBetween(x + 23, floorY + 3, x + 13, y + SLOT_H - 14);
  g.lineBetween(x + SLOT_W - 23, floorY + 3, x + SLOT_W - 13, y + SLOT_H - 14);
  g.lineStyle(1, 0xffffff, 0.08 + glow * 0.08);
  g.lineBetween(x + 32, floorY + 7, x + SLOT_W - 32, floorY + 7);
  g.lineBetween(x + 25, floorY + 17, x + SLOT_W - 25, floorY + 17);

  g.fillStyle(0x020405, 0.88);
  g.fillCircle(x + SLOT_W / 2, backY + 21, 15);
  g.fillRoundedRect(x + SLOT_W / 2 - 15, backY + 21, 30, 23, 7);
  g.fillStyle(accent, 0.08 + glow * 0.09);
  g.fillCircle(x + SLOT_W / 2, backY + 22, 10);

  g.fillStyle(0x040708, 0.92);
  g.fillRoundedRect(x + 5, y + 32, 10, 42, 5);
  g.fillRoundedRect(x + SLOT_W - 15, y + 32, 10, 42, 5);
  g.lineStyle(1, accent, 0.24 + glow * 0.15);
  g.lineBetween(x + 10, y + 37, x + 10, y + 67);
  g.lineBetween(x + SLOT_W - 10, y + 37, x + SLOT_W - 10, y + 67);
  g.fillStyle(accent, 0.17 + glow * 0.12);
  g.fillCircle(x + 10, y + 42, 2.6);
  g.fillCircle(x + SLOT_W - 10, y + 42, 2.6);

  g.fillStyle(0xffc875, 0.13 + glow * 0.08);
  g.fillCircle(x + 18, y + 43, 7);
  g.fillCircle(x + SLOT_W - 18, y + 43, 7);
  g.fillStyle(0xffd978, 0.5);
  g.fillCircle(x + 18, y + 43, 2.4);
  g.fillCircle(x + SLOT_W - 18, y + 43, 2.4);
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(x + SLOT_W / 2, y + 70, SLOT_W - 34, 16);
  g.lineStyle(1, accent, 0.10 + glow * 0.12);
  g.lineBetween(x + 24, y + 26, x + SLOT_W - 24, y + 26);
  g.lineBetween(x + 20, y + 31, x + SLOT_W - 20, y + 31);
}

function drawLockedExcavationFace(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  t: DungeonTheme,
  seed: number,
): void {
  const cx = x + SLOT_W / 2;
  const cy = y + SLOT_H / 2;
  const rockPath = [
    { px: 10, py: 32 },
    { px: 18, py: 16 },
    { px: 35, py: 9 },
    { px: 63, py: 10 },
    { px: 82, py: 17 },
    { px: 91, py: 33 },
    { px: 94, py: 79 },
    { px: 77, py: 90 },
    { px: 23, py: 91 },
    { px: 6, py: 80 },
  ];
  const traceRockPath = (offset: number): void => {
    g.beginPath();
    rockPath.forEach((p, idx) => {
      const ox = p.px < SLOT_W / 2 ? -offset : offset;
      const oy = p.py < SLOT_H / 2 ? -offset : offset;
      const px = x + p.px + ox;
      const py = y + p.py + oy;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
  };

  g.fillStyle(0x020405, 0.82);
  traceRockPath(3);
  g.fillPath();
  g.fillStyle(t.stoneDark, 0.84);
  traceRockPath(0);
  g.fillPath();
  g.fillStyle(0x050909, 0.78);
  g.beginPath();
  g.moveTo(x + 19, y + 43);
  g.lineTo(x + 27, y + 27);
  g.lineTo(x + 41, y + 22);
  g.lineTo(x + 60, y + 22);
  g.lineTo(x + 75, y + 28);
  g.lineTo(x + 83, y + 43);
  g.lineTo(x + 80, y + 68);
  g.lineTo(x + 20, y + 68);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x010202, 0.72);
  g.fillCircle(cx, y + 43, 25);
  g.fillRoundedRect(cx - 25, y + 42, 50, 28, 7);
  g.fillStyle(t.stoneMid, 0.18);
  g.fillCircle(cx, y + 43, 18);
  g.fillRoundedRect(cx - 18, y + 44, 36, 17, 6);
  g.lineStyle(1.2, t.panelBorder, 0.24);
  g.strokeCircle(cx, y + 43, 23);
  g.lineStyle(1, t.stoneLight, 0.10);
  g.lineBetween(cx, y + 23, cx, y + 66);
  g.lineBetween(cx - 18, y + 43, cx + 18, y + 43);
  g.fillStyle(0x060403, 0.84);
  g.fillRoundedRect(cx - 9, y + 42, 18, 18, 5);
  g.lineStyle(1, 0xffc86a, 0.36);
  g.strokeRoundedRect(cx - 9, y + 42, 18, 18, 5);
  g.fillStyle(0xffd978, 0.30);
  g.fillCircle(cx, y + 50, 3.2);

  const rocks = [
    { px: 15, py: 23, w: 21, h: 18, c: t.stoneMid },
    { px: 35, py: 17, w: 20, h: 15, c: t.slotLocked },
    { px: 56, py: 21, w: 25, h: 19, c: t.stoneMid },
    { px: 21, py: 46, w: 19, h: 20, c: t.slotLocked },
    { px: 63, py: 47, w: 21, h: 20, c: t.stoneDark },
    { px: 36, py: 61, w: 30, h: 17, c: t.stoneMid },
  ];
  for (const [i, rock] of rocks.entries()) {
    const jitter = (seed + i * 11) % 5;
    g.fillStyle(rock.c, 0.22 + (i % 3) * 0.05);
    g.fillRoundedRect(x + rock.px, y + rock.py + jitter * 0.3, rock.w, rock.h, 5);
    g.lineStyle(1, t.stoneLight, 0.08);
    g.lineBetween(x + rock.px + 3, y + rock.py + 4, x + rock.px + rock.w - 4, y + rock.py + rock.h - 5);
  }

  g.fillStyle(t.stoneMid, 0.16);
  g.fillTriangle(x + 12, y + 79, x + 31, y + 58, x + 52, y + 79);
  g.fillTriangle(x + 45, y + 82, x + 70, y + 55, x + 88, y + 82);
  g.fillStyle(0x050302, 0.55);
  g.fillEllipse(cx, y + SLOT_H - 15, SLOT_W - 24, 18);

  g.lineStyle(3, 0x7a4522, 0.62);
  g.lineBetween(x + 23, y + 28, x + 76, y + 73);
  g.lineBetween(x + 77, y + 28, x + 24, y + 73);
  g.lineStyle(2.4, 0x1c1712, 0.72);
  g.lineBetween(x + 19, y + 39, x + 81, y + 54);
  g.lineBetween(x + 21, y + 57, x + 79, y + 39);
  g.lineStyle(1, 0xffcf72, 0.18);
  for (let i = 0; i < 4; i++) {
    const linkX = x + 27 + i * 15;
    g.strokeCircle(linkX, y + 42 + (i % 2) * 4, 3.2);
    g.strokeCircle(linkX + 4, y + 44 + (i % 2) * 4, 3.2);
  }
  g.lineStyle(1, 0xffc86a, 0.28);
  g.lineBetween(x + 25, y + 27, x + 78, y + 72);
  g.lineBetween(x + 79, y + 27, x + 26, y + 72);
  g.lineStyle(2, 0x8f5b2b, 0.58);
  g.lineBetween(x + 18, y + 70, x + 82, y + 70);
  g.lineStyle(1, t.stoneLight, 0.12);
  g.lineBetween(x + 22, y + 33, x + SLOT_W - 23, y + 58);
  g.lineBetween(x + SLOT_W - 31, y + 20, x + 23, y + 41);
  g.lineBetween(x + 34, y + 18, x + 22, y + 31);
  g.lineBetween(x + SLOT_W - 37, y + 60, x + SLOT_W - 22, y + 78);

  g.fillStyle(0xffcf72, 0.15);
  g.fillCircle(x + 18, y + 31, 6);
  g.fillCircle(x + SLOT_W - 18, y + 31, 6);
  g.fillStyle(0x4bd5ff, 0.10);
  g.fillCircle(cx, y + 43, 31);
  g.fillStyle(0xffd978, 0.48);
  g.fillCircle(x + 18, y + 31, 2);
  g.fillCircle(x + SLOT_W - 18, y + 31, 2);
  g.lineStyle(1, t.panelBorder, 0.24);
  traceRockPath(0);
  g.strokePath();

  g.fillStyle(0x000000, 0.28);
  g.fillCircle(cx, cy - 4, 15);
}

function drawConstructionScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
): void {
  const cx = x + SLOT_W / 2;
  g.fillStyle(0x020405, 0.52);
  g.beginPath();
  g.moveTo(x + 12, y + 34);
  g.lineTo(x + 22, y + 17);
  g.lineTo(x + 40, y + 10);
  g.lineTo(x + 61, y + 10);
  g.lineTo(x + 79, y + 17);
  g.lineTo(x + 88, y + 34);
  g.lineTo(x + 93, y + 78);
  g.lineTo(x + 76, y + 89);
  g.lineTo(x + 24, y + 89);
  g.lineTo(x + 7, y + 78);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x06100f, 0.72);
  g.beginPath();
  g.moveTo(x + 20, y + 42);
  g.lineTo(x + 28, y + 27);
  g.lineTo(x + 42, y + 22);
  g.lineTo(x + 59, y + 22);
  g.lineTo(x + 73, y + 27);
  g.lineTo(x + 81, y + 42);
  g.lineTo(x + 78, y + 66);
  g.lineTo(x + 22, y + 66);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x081312, 0.92);
  g.beginPath();
  g.moveTo(x + 19, y + 55);
  g.lineTo(x + SLOT_W - 19, y + 55);
  g.lineTo(x + SLOT_W - 9, y + SLOT_H - 12);
  g.lineTo(x + 9, y + SLOT_H - 12);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.07);
  g.beginPath();
  g.moveTo(x + 25, y + 58);
  g.lineTo(x + SLOT_W - 25, y + 58);
  g.lineTo(x + SLOT_W - 31, y + SLOT_H - 23);
  g.lineTo(x + 31, y + SLOT_H - 23);
  g.closePath();
  g.fillPath();

  g.lineStyle(1, accent, 0.2);
  g.strokeRoundedRect(x + 25, y + 29, 50, 24, 7);
  g.lineStyle(1, accent, 0.16);
  g.lineBetween(x + 32, y + 35, x + 68, y + 47);
  g.lineBetween(x + 32, y + 47, x + 68, y + 35);
  g.lineBetween(x + 24, y + 61, x + SLOT_W - 24, y + 61);
  g.lineBetween(x + 18, y + 71, x + SLOT_W - 18, y + 71);
  g.lineBetween(x + 29, y + 56, x + 20, y + SLOT_H - 15);
  g.lineBetween(x + SLOT_W - 29, y + 56, x + SLOT_W - 20, y + SLOT_H - 15);

  g.fillStyle(accent, 0.16);
  g.fillRoundedRect(x + 30, y + 37, 40, 7, 4);
  g.fillStyle(0x000000, 0.34);
  g.fillEllipse(cx, y + SLOT_H - 14, SLOT_W - 28, 13);

  g.lineStyle(2, 0x8f5b2b, 0.68);
  g.lineBetween(x + 18, y + 28, x + 18, y + 76);
  g.lineBetween(x + 82, y + 28, x + 82, y + 76);
  g.lineBetween(x + 17, y + 38, x + 83, y + 38);
  g.lineBetween(x + 18, y + 58, x + 82, y + 58);
  g.lineBetween(x + 20, y + 30, x + 80, y + 75);
  g.lineBetween(x + 80, y + 30, x + 20, y + 75);
  g.lineStyle(1, 0xffcf72, 0.28);
  g.lineBetween(x + 18, y + 27, x + 18, y + 76);
  g.lineBetween(x + 82, y + 27, x + 82, y + 76);

  g.lineStyle(1, accent, 0.26);
  g.strokeRoundedRect(x + 29, y + 31, 42, 19, 6);
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 34, y + 34, 32, 5, 3);
  g.lineStyle(1, 0xffffff, 0.10);
  g.lineBetween(x + 35, y + 47, x + 66, y + 34);

  g.fillStyle(0x031214, 0.92);
  g.fillRoundedRect(x + 28, y + 31, 44, 24, 7);
  g.lineStyle(1, accent, 0.42);
  g.strokeRoundedRect(x + 28, y + 31, 44, 24, 7);
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 32, y + 35, 36, 16, 4);
  g.lineStyle(1, 0x9ff4ff, 0.34);
  g.strokeRoundedRect(x + 35, y + 37, 13, 10, 2);
  g.strokeRoundedRect(x + 52, y + 37, 12, 10, 2);
  g.lineBetween(x + 48, y + 42, x + 52, y + 42);
  g.lineBetween(x + 42, y + 47, x + 42, y + 51);
  g.lineStyle(1, 0xffffff, 0.12);
  g.lineBetween(x + 34, y + 34, x + 66, y + 51);
  g.fillStyle(0xffd978, 0.38);
  g.fillCircle(x + 28, y + 30, 2.3);
  g.fillCircle(x + 72, y + 30, 2.3);

  g.fillStyle(0x9ff4ff, 0.18);
  g.fillRoundedRect(x + 38, y + 65, 24, 5, 3);
  g.lineStyle(1, accent, 0.24);
  g.lineBetween(x + 50, y + 58, x + 50, y + 82);
  g.lineBetween(x + 39, y + 70, x + 61, y + 70);
  g.lineStyle(1, 0xffcf72, 0.24);
  g.lineBetween(x + 32, y + 75, x + 22, y + 86);
  g.lineBetween(x + 68, y + 75, x + 78, y + 86);

  g.fillStyle(0xffd978, 0.52);
  g.fillCircle(x + 22, y + 35, 2.2);
  g.fillCircle(x + 78, y + 35, 2.2);
  g.fillStyle(accent, 0.28);
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
  const { scene, theme: t, gs } = ctx;

  if (!unlocked) {
    // Locked slots read as unexcavated rock faces in the dungeon grid.
    drawRoughEdgeRect(g, t.slotLocked, 0.55, x, y, SLOT_W, SLOT_H, index * 17);
    drawLockedExcavationFace(g, x, y, t, index * 17);
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2;
    c.add(scene.add.text(cx, cy - 8, '🔒', { fontSize: '17px' }).setOrigin(0.5).setAlpha(0.58));
    const reqLv = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
    g.fillStyle(0x050302, 0.78);
    g.fillRoundedRect(cx - 20, cy + 10, 40, 16, 5);
    g.lineStyle(1, t.panelBorder, 0.5);
    g.strokeRoundedRect(cx - 20, cy + 10, 40, 16, 5);
    c.add(scene.add.text(cx, cy + 18, `Lv.${reqLv}`, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: t.textSecondary,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.82));
    return;
  }

  const slot = gs.dungeonSlots?.[index];
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot?.roomType);
  const roomMetrics = calculateRoomMetrics(gs, slot);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const actionHint = getRoomActionHint(gs, index);

  // ── 파손 방: HP=0 특수 표시 ────────────────────────────────────────────────
  if (slot?.roomType && slot.hp <= 0) {
    const roomAccent = ROOM_TYPE_ACCENT[slot.roomType] ?? 0xff5544;
    g.fillStyle(0x1a0000, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 6);
    g.lineStyle(2, 0x8b0000, 0.8);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 6);
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '파손 방', 0xff5544, roomMetrics.readiness, true);
    // Crack lines
    g.lineStyle(2, 0xff2222, 0.6);
    g.lineBetween(x + 18, y + 8,  x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + SLOT_W - 14, y + SLOT_H - 6);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + 10, y + SLOT_H - 14);
    const cx = x + SLOT_W / 2;
    g.fillStyle(roomAccent, 0.12);
    g.fillCircle(cx, y + SLOT_H / 2 - 10, 27);
    c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, '💥', { fontFamily: 'sans-serif', fontSize: '22px' }).setOrigin(0.5).setAlpha(0.75));
    c.add(scene.add.text(cx, y + SLOT_H / 2 + 12, '파손', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ff4444',
    }).setOrigin(0.5));
    c.add(scene.add.text(cx, y + SLOT_H - 10, '수리 필요', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#884444',
    }).setOrigin(0.5));
    drawActionHintBadge(scene, c, g, x, y, actionHint);
    // Invasion order badge
    const order = INVASION_ORDER[index];
    if (order !== undefined) {
      const bg2 = scene.add.graphics();
      bg2.fillStyle(0x8b0000, 0.7);
      bg2.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
      c.add(bg2);
      c.add(scene.add.text(x + 10, y + 9, String(order), { fontFamily: 'monospace', fontSize: '9px', color: '#ff8888' }).setOrigin(0.5));
    }
    return;
  }

  const primaryMonsterId = slot?.monsterIds?.[0];
  const typeIdForSlot = primaryMonsterId ? resolveMonsterTypeId(primaryMonsterId) : null;
  const monDef = typeIdForSlot ? MONSTER_DEFS[typeIdForSlot] : null;
  const primaryEquipment = getEquippedItem(gs, primaryMonsterId);

  if (monDef) {
    // ── Occupied cell: cave alcove with rough edges ────────────────────────
    const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? t.panelBorder;
    drawRoughEdgeRect(g, t.slotFill, 1, x, y, SLOT_W, SLOT_H, index * 17);
    drawDungeonRoomShell(g, x, y, roomAccent, roomMetrics.readiness);
    drawRoomTypeProps(g, x, y, slot?.roomType, roomAccent, roomMetrics.readiness);
    addRoomShine(scene, c, x, y, roomAccent, roomMetrics.readiness, index);
    drawEquipmentPowerAura(scene, c, g, x, y, roomMetrics.equipmentPower, primaryEquipment);

    // Mineral-vein border
    strokeRoughEdgeRect(g, t.slotBorder, 0.8, 1, x, y, SLOT_W, SLOT_H, index * 17);

    g.fillStyle(roomAccent, 0.84);
    g.fillCircle(x + 15, y + 15, 10);
    c.add(scene.add.text(x + 15, y + 15, typeDef?.icon ?? '▣', {
      fontFamily: 'sans-serif', fontSize: '12px',
    }).setOrigin(0.5));
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '던전 방', roomAccent, roomMetrics.readiness);

    // Glow behind emoji — cool-toned by monster type
    const glowColor: Record<string, number> = {
      melee:   0x884444,   // muted red
      ranged:  0x446688,   // steel blue
      magic:   0x664488,   // purple
      support: 0x448866,   // teal
    };
    const glow = glowColor[monDef.type] ?? t.stoneMid;
    const glowG = scene.add.graphics();
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2 - 10;
    for (let r = 22; r >= 6; r -= 4) {
      glowG.fillStyle(glow, 0.06 * (22 - r) / 4 + 0.04);
      glowG.fillCircle(cx, cy, r);
    }
    c.add(glowG);

    const portrait = addMonsterPortrait(scene, c, cx, cy, primaryMonsterId ?? '', {
      size: 58,
      frameColor: t.slotBorder,
      glowColor: glow,
      bgColor: t.stoneDark,
      equippedSkins: gs.equippedSkins ?? {},
    });
    if (portrait.fallbackText && typeIdForSlot) {
      ctx.applyIdleAnimation(portrait.fallbackText, typeIdForSlot, true);
    }
    if (primaryEquipment) {
      drawEquipmentBadge(scene, c, g, x + SLOT_W - 20, y + SLOT_H / 2 - 8, primaryEquipment);
    }

    // Level badge top-right
    if (slot && slot.roomLevel > 1) {
      const badgeBg = scene.add.graphics();
      badgeBg.fillStyle(t.panelBorder, 0.9);
      badgeBg.fillRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      c.add(badgeBg);
      c.add(scene.add.text(x + SLOT_W - 12, y + 8, `Lv${slot.roomLevel}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#0a0e14',
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

    // HP bar bottom
    if (slot) {
      const hpPct = Math.max(0, slot.hp / slot.maxHp);
      const barW  = SLOT_W - 10;
      const barY  = y + SLOT_H - 8;
      const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? t.panelBorder : 0x8b0000;
      g.fillStyle(t.panelDark, 1);
      g.fillRoundedRect(x + 5, barY, barW, 4, 2);
      g.fillStyle(barColor, 1);
      g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
    }
  } else {
    // ── Empty cell: dark cave alcove ──────────────────────────────────────
    drawRoughEdgeRect(g, t.stoneDark, 1, x, y, SLOT_W, SLOT_H, index * 17);
    const hasType = !!(slot?.roomType);
    strokeRoughEdgeRect(g, hasType ? t.stoneMid : t.slotBorder, hasType ? 0.5 : 0.35, 1.5, x, y, SLOT_W, SLOT_H, index * 17);

    if (hasType) {
      const td = typeDef;
      const cx = x + SLOT_W / 2;
      const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? t.stoneMid;
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
        color: '#9ebcae',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.82));
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
        g.fillStyle(t.panelDark, 1);
        g.fillRoundedRect(x + 5, barY, barW, 4, 2);
        g.fillStyle(hpPct > 0.33 ? t.panelBorder : 0x8b0000, 1);
        g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
      }
    } else {
      // Truly empty — construction plot for dungeon tycoon growth.
      drawConstructionScaffold(g, x, y, t.panelBorder);
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 - 14, '+', {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: t.panelBorderCSS,
      }).setOrigin(0.5).setAlpha(0.78));
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 + 10, '방 설계', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: t.textSecondary,
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
    badgeG.fillStyle(0x000000, 0.55);
    badgeG.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
    c.add(badgeG);
    c.add(scene.add.text(x + 10, y + 9, String(order), {
      fontFamily: 'monospace', fontSize: '9px', color: '#c8921a',
    }).setOrigin(0.5));
  }
}
