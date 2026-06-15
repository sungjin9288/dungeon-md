import Phaser from 'phaser';
import { CASUAL } from '../constants/colors';
import type { RoomLoadoutStatus } from '../data/dungeonMetrics';

export interface RoomLoadoutRailOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly accent: number;
  readonly showLabels?: boolean;
}

const MONSTER_PIP_COLOR = CASUAL.GREEN_DK;
const TRAP_PIP_COLOR = CASUAL.GOLD_DK;
const EQUIPMENT_PIP_COLOR = CASUAL.PURPLE_DK;
const EMPTY_PIP_COLOR = CASUAL.EDGE_SOFT;

export function drawRoomLoadoutRail(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  status: RoomLoadoutStatus,
  options: RoomLoadoutRailOptions,
): void {
  const { x, y, w, h, accent, showLabels = false } = options;
  if (status.monsterCapacity <= 0 && status.trapCapacity <= 0) return;

  const cy = y + h / 2;
  const monsterStart = showLabels ? x + 25 : x + 12;
  const trapStart = showLabels ? x + Math.max(67, Math.floor(w * 0.53)) : x + Math.max(42, Math.floor(w * 0.46));
  const gearStart = showLabels ? x + w - 25 : x + w - 22;
  const maxVisibleLoadoutPips = showLabels ? 5 : 4;
  const equipmentCapacity = Math.max(1, Math.min(4, status.monsterCapacity));
  const filledLoadout = status.monsterCount + status.trapCount + Math.min(status.equippedMonsters, equipmentCapacity);
  const totalLoadout = Math.max(1, status.monsterCapacity + status.trapCapacity + equipmentCapacity);
  const loadoutRatio = Phaser.Math.Clamp(filledLoadout / totalLoadout, 0, 1);

  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, w, h, 7);
  g.fillStyle(0xffffff, 0.4);
  g.fillRoundedRect(x + 3, y + 2, w - 6, 3, 2);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.fillStyle(accent, 0.9);
  g.fillRoundedRect(x + 2, y + 3, 4, h - 6, 2);
  g.fillStyle(accent, 0.5);
  g.fillRoundedRect(x + 7, y + h - 4, Math.max(5, (w - 12) * loadoutRatio), 2, 1);

  if (showLabels) {
    addRailLabel(scene, c, monsterStart - 14, cy, 'M', MONSTER_PIP_COLOR);
    addRailLabel(scene, c, trapStart - 14, cy, 'T', TRAP_PIP_COLOR);
    addRailLabel(scene, c, gearStart - 13, cy, 'E', EQUIPMENT_PIP_COLOR);
  }

  drawLoadoutPipRow(g, monsterStart, cy, status.monsterCount, status.monsterCapacity, MONSTER_PIP_COLOR, 'circle', maxVisibleLoadoutPips);
  drawLoadoutPipRow(g, trapStart, cy, status.trapCount, status.trapCapacity, TRAP_PIP_COLOR, 'triangle', maxVisibleLoadoutPips);
  drawEquipmentPipRow(g, gearStart, cy, status.equippedMonsters, equipmentCapacity);
}

function addRailLabel(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  color: number,
): void {
  c.add(scene.add.text(x, y, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: `#${color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawLoadoutPipRow(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  y: number,
  count: number,
  capacity: number,
  color: number,
  shape: 'circle' | 'triangle',
  maxVisible = 5,
): void {
  const visibleCapacity = Math.min(capacity, maxVisible);
  for (let i = 0; i < visibleCapacity; i += 1) {
    const px = startX + i * 6;
    const filled = i < count;
    if (shape === 'circle') {
      g.fillStyle(filled ? color : EMPTY_PIP_COLOR, filled ? 1 : 0.55);
      g.fillCircle(px, y, 2.3);
      g.lineStyle(1, color, filled ? 0.34 : 0.22);
      g.strokeCircle(px, y, 2.6);
    } else {
      g.fillStyle(filled ? color : EMPTY_PIP_COLOR, filled ? 1 : 0.55);
      g.fillTriangle(px - 2.6, y + 2.3, px, y - 2.7, px + 2.6, y + 2.3);
      g.lineStyle(1, color, filled ? 0.32 : 0.2);
      g.strokeTriangle(px - 2.9, y + 2.6, px, y - 3, px + 2.9, y + 2.6);
    }
  }
  if (capacity > visibleCapacity) {
    g.fillStyle(color, 0.5);
    g.fillCircle(startX + visibleCapacity * 6 + 1, y, 1.5);
  }
}

function drawEquipmentPipRow(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  y: number,
  equippedCount: number,
  capacity: number,
): void {
  const visibleCapacity = Math.min(Math.max(1, capacity), 4);
  for (let i = 0; i < visibleCapacity; i += 1) {
    const x = startX + i * 6;
    const filled = i < equippedCount;
    drawEquipmentDiamond(g, x, y, filled);
  }
  if (capacity > visibleCapacity) {
    g.fillStyle(EQUIPMENT_PIP_COLOR, 0.48);
    g.fillCircle(startX + visibleCapacity * 6 + 1, y, 1.4);
  }
}

function drawEquipmentDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  filled: boolean,
): void {
  g.fillStyle(filled ? EQUIPMENT_PIP_COLOR : EMPTY_PIP_COLOR, filled ? 1 : 0.55);
  g.beginPath();
  g.moveTo(x, y - 3.7);
  g.lineTo(x + 3.7, y);
  g.lineTo(x, y + 3.7);
  g.lineTo(x - 3.7, y);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, EQUIPMENT_PIP_COLOR, filled ? 0.62 : 0.2);
  g.strokeTriangle(x, y - 3.7, x + 3.7, y, x, y + 3.7);
  g.lineBetween(x, y + 3.7, x - 3.7, y);
  g.lineBetween(x - 3.7, y, x, y - 3.7);
}
