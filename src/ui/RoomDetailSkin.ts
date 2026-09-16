import type Phaser from 'phaser';
import { DUNGEON_UI } from '../constants/colors';
import type { RoomDirectiveTarget } from './RoomDetailShared';

/** Code-drawn room marks keep core navigation independent from emoji fonts. */
export function drawRoomTypeSigil(
  g: Phaser.GameObjects.Graphics,
  roomType: string | undefined,
  x: number,
  y: number,
  size: number,
  color: number,
): void {
  const r = size / 2;
  g.lineStyle(Math.max(1.4, size * 0.09), color, 0.92);

  if (roomType === 'combat') {
    g.lineBetween(x - r * 0.56, y - r * 0.58, x + r * 0.55, y + r * 0.58);
    g.lineBetween(x + r * 0.56, y - r * 0.58, x - r * 0.55, y + r * 0.58);
    g.lineBetween(x - r * 0.68, y - r * 0.37, x - r * 0.37, y - r * 0.68);
    g.lineBetween(x + r * 0.68, y - r * 0.37, x + r * 0.37, y - r * 0.68);
    return;
  }

  if (roomType === 'trap') {
    g.lineBetween(x - r * 0.75, y + r * 0.5, x + r * 0.75, y + r * 0.5);
    g.fillStyle(color, 0.9);
    for (let i = -1; i <= 1; i += 1) {
      const px = x + i * r * 0.48;
      g.fillTriangle(px - r * 0.2, y + r * 0.43, px, y - r * 0.62, px + r * 0.2, y + r * 0.43);
    }
    return;
  }

  if (roomType === 'support') {
    g.strokeCircle(x, y, r * 0.72);
    g.lineBetween(x - r * 0.44, y, x + r * 0.44, y);
    g.lineBetween(x, y - r * 0.44, x, y + r * 0.44);
    return;
  }

  if (roomType === 'magic') {
    g.strokeCircle(x, y, r * 0.72);
    g.strokeTriangle(x, y - r * 0.68, x + r * 0.62, y + r * 0.46, x - r * 0.62, y + r * 0.46);
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y, Math.max(1.5, r * 0.13));
    return;
  }

  g.strokeRoundedRect(x - r * 0.62, y - r * 0.62, r * 1.24, r * 1.24, 2);
  g.lineBetween(x - r * 0.42, y, x + r * 0.42, y);
  g.lineBetween(x, y - r * 0.42, x, y + r * 0.42);
}

/** A target-specific command mark for the single next-action plate. */
export function drawDirectiveSigil(
  g: Phaser.GameObjects.Graphics,
  target: RoomDirectiveTarget,
  x: number,
  y: number,
  color: number,
): void {
  g.fillStyle(DUNGEON_UI.VOID, 0.92);
  g.fillCircle(x, y, 18);
  g.lineStyle(1.5, color, 0.9);
  g.strokeCircle(x, y, 17);
  g.strokeCircle(x, y, 12);

  if (target === 'repair') {
    g.lineStyle(3, color, 0.92);
    g.lineBetween(x - 7, y + 7, x + 6, y - 6);
    g.strokeCircle(x + 7, y - 7, 4);
    return;
  }
  if (target === 'monster') {
    g.fillStyle(color, 0.9);
    g.fillTriangle(x - 8, y - 3, x - 4, y - 11, x, y - 3);
    g.fillTriangle(x + 8, y - 3, x + 4, y - 11, x, y - 3);
    g.strokeCircle(x, y + 2, 7);
    return;
  }
  if (target === 'trap') {
    drawRoomTypeSigil(g, 'trap', x, y + 1, 22, color);
    return;
  }
  if (target === 'growth') {
    g.lineBetween(x, y - 10, x, y + 10);
    g.lineBetween(x - 10, y, x + 10, y);
    g.lineBetween(x - 7, y + 7, x + 7, y - 7);
    return;
  }
  if (target === 'none') {
    g.lineStyle(3, color, 0.92);
    g.lineBetween(x - 8, y, x - 2, y + 7);
    g.lineBetween(x - 2, y + 7, x + 9, y - 7);
    return;
  }
  drawRoomTypeSigil(g, undefined, x, y, 22, color);
}
