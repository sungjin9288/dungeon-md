// ─── Room Detail Interior Preview ─────────────────────────────────────────────
// RoomDetailOverlay에서 분리한 방 내부 프리뷰 + 컴팩트 로드아웃 드로잉 계층.
// 진입점: buildRoomInteriorPreview (열린 방), drawUnbuiltRoomBlueprintPreview(본체 잔류).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import {
  type DungeonSlot } from '../data/wisdom';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  
  prefersReducedMotion, 
  EquipmentBadge } from './RoomDetailShared';

// RoomDetailInteriorDecor — 방 내부 프리뷰 장식 드로잉 (구조물·소켓·앵커)

export function drawInteriorChamber(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  slot: DungeonSlot,
): void {
  const isBroken = Boolean(slot.roomType && slot.hp <= 0);
  const backY = y + 14;
  const backH = Math.round(h * 0.42);
  const floorY = backY + backH - 4;

  g.fillStyle(0x050302, 0.99);
  g.fillRoundedRect(x, y, w, h, 14);
  g.fillStyle(isBroken ? 0x210b08 : 0x111b22, 0.90);
  g.fillRoundedRect(x + 8, y + 8, w - 16, h - 16, 12);
  g.lineStyle(1.5, isBroken ? 0xff5544 : accent, isBroken ? 0.64 : 0.45);
  g.strokeRoundedRect(x, y, w, h, 14);
  g.lineStyle(1, 0xffffff, 0.08);
  g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 11);

  g.fillStyle(0x17262d, 0.95);
  g.fillRoundedRect(x + 24, backY, w - 48, backH, 11);
  g.fillStyle(0x140d04, 0.84);
  g.fillRoundedRect(x + 34, backY + 13, w - 68, backH - 18, 9);
  g.lineStyle(1, accent, 0.12);
  for (let gy = backY + 24; gy < backY + backH - 7; gy += 13) {
    g.lineBetween(x + 42, gy, x + w - 42, gy);
  }
  g.lineStyle(1, 0xffffff, 0.06);
  for (let gx = x + 56; gx < x + w - 45; gx += 34) {
    g.lineBetween(gx, backY + 18, gx - 7, backY + backH - 8);
  }

  g.fillStyle(0x140d04, 0.96);
  g.beginPath();
  g.moveTo(x + 34, floorY);
  g.lineTo(x + w - 34, floorY);
  g.lineTo(x + w - 14, y + h - 18);
  g.lineTo(x + 14, y + h - 18);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.07);
  g.beginPath();
  g.moveTo(x + 46, floorY + 8);
  g.lineTo(x + w - 46, floorY + 8);
  g.lineTo(x + w - 34, y + h - 28);
  g.lineTo(x + 34, y + h - 28);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, accent, 0.15);
  g.lineBetween(x + 42, floorY + 2, x + 25, y + h - 22);
  g.lineBetween(x + w - 42, floorY + 2, x + w - 25, y + h - 22);
  g.lineStyle(1, 0xffffff, 0.06);
  for (let i = 0; i < 4; i++) {
    const yy = floorY + 18 + i * 20;
    g.lineBetween(x + 36 + i * 4, yy, x + w - 36 - i * 4, yy);
  }

  const laneY = backY + 38;
  g.fillStyle(0x020506, 0.72);
  g.fillRoundedRect(x + 18, laneY - 10, w - 36, 20, 9);
  g.lineStyle(1.2, accent, 0.22);
  g.lineBetween(x + 36, laneY, x + w - 36, laneY);
  for (let i = 0; i < 5; i++) {
    const px = x + 58 + i * Math.max(32, (w - 116) / 4);
    g.fillStyle(accent, 0.16 + (i % 2) * 0.07);
    g.fillTriangle(px + 6, laneY, px - 3, laneY - 5, px - 3, laneY + 5);
  }

  g.fillStyle(0x0e171b, 1);
  g.fillRoundedRect(x - 6, y + 38, 19, 48, 6);
  g.fillRoundedRect(x + w - 13, y + 38, 19, 48, 6);
  g.fillStyle(accent, 0.26);
  g.fillRoundedRect(x, y + 50, 6, 22, 3);
  g.fillRoundedRect(x + w - 6, y + 50, 6, 22, 3);
  c.add(scene.add.text(x + 7, y + 94, 'IN', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.74));
  c.add(scene.add.text(x + w - 7, y + 94, 'OUT', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.74));

  if (isBroken) {
    g.lineStyle(1.6, 0xff5544, 0.42);
    g.lineBetween(x + 36, y + 19, x + 76, y + 70);
    g.lineBetween(x + 76, y + 70, x + 57, y + h - 16);
    g.lineBetween(x + w - 55, y + 22, x + w - 92, y + 58);
    g.fillStyle(0xff5544, 0.08);
    g.fillRoundedRect(x + 9, y + 9, w - 18, h - 18, 10);
  }
}

export function drawInteriorDungeonEditorDetails(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomLevel: number,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const ceilingY = y + 18;
  const floorY = y + h - 38;

  g.fillStyle(0x050302, 0.58);
  g.fillRoundedRect(x + 30, y + 13, w - 60, 11, 5);
  g.fillStyle(accent, 0.08 + glow * 0.05);
  g.fillRoundedRect(x + 44, y + 16, w - 88, 4, 2);
  g.lineStyle(1, accent, 0.18 + glow * 0.08);
  for (let i = 0; i < 4; i++) {
    const xx = x + 58 + i * ((w - 116) / 3);
    g.lineBetween(xx, ceilingY, xx - 10, ceilingY + 38);
  }

  g.fillStyle(0xffc875, 0.10 + glow * 0.08);
  g.fillCircle(x + 25, y + 55, 15);
  g.fillCircle(x + w - 25, y + 55, 15);
  g.fillStyle(0xffd978, 0.48);
  g.fillCircle(x + 25, y + 55, 3);
  g.fillCircle(x + w - 25, y + 55, 3);
  g.lineStyle(1, 0xffd978, 0.22);
  g.lineBetween(x + 25, y + 58, x + 25, y + 82);
  g.lineBetween(x + w - 25, y + 58, x + w - 25, y + 82);

  g.lineStyle(1, accent, 0.12 + glow * 0.08);
  for (let i = 0; i < 3; i++) {
    const yy = floorY + i * 12;
    g.lineBetween(x + 46 + i * 7, yy, x + w - 46 - i * 7, yy);
  }
  for (let i = 0; i < 4; i++) {
    const xx = x + 64 + i * ((w - 128) / 3);
    g.lineBetween(xx, floorY - 13, xx - 16, y + h - 20);
  }

  const pipCount = Phaser.Math.Clamp(roomLevel, 1, 5);
  for (let i = 0; i < pipCount; i++) {
    const yy = y + 106 + i * 12;
    g.fillStyle(accent, 0.20 + glow * 0.12);
    g.fillCircle(x + 22, yy, 2.4);
    g.fillCircle(x + w - 22, yy, 2.4);
  }
}

export function drawInteriorEquipmentAura(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  equipmentPower: number,
): void {
  if (equipmentPower <= 0) return;

  g.lineStyle(1.4, 0xe8c468, 0.44);
  g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 18, 10);
  g.lineStyle(0.8, 0xffffff, 0.11);
  g.strokeRoundedRect(x + 17, y + 20, w - 34, h - 48, 8);
  g.fillStyle(0xe8c468, 0.09);
  g.fillRoundedRect(x + 22, y + 18, w - 44, 5, 3);
  g.fillCircle(x + 36, y + 24, 3);
  g.fillCircle(x + w - 36, y + 24, 3);

  g.fillStyle(0x100b03, 0.92);
  g.fillRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  g.lineStyle(1, 0xe8c468, 0.58);
  g.strokeRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  c.add(scene.add.text(x + w - 63, y + 20, `장비 강화 +${equipmentPower}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#fff0c2',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawInteriorRoomPlaque(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  accent: number,
  icon: string,
  roomName: string,
  roomLevel: number,
  readiness: number,
  danger: boolean,
): void {
  const plaqueW = 132;
  const plaqueH = 28;
  const plaqueX = x + w / 2 - plaqueW / 2;
  const plaqueY = y + 16;
  const readinessColor = readiness >= 70 ? 0x5fb854 : readiness >= 35 ? 0xe8c468 : 0xff7a5a;

  g.fillStyle(0x050302, 0.72);
  g.fillRoundedRect(plaqueX, plaqueY + 3, plaqueW, plaqueH, 8);
  g.fillStyle(danger ? 0x2a0906 : 0x07131d, 0.94);
  g.fillRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.lineStyle(1.2, danger ? 0xff5544 : accent, danger ? 0.66 : 0.46);
  g.strokeRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.fillStyle(accent, danger ? 0.12 : 0.08);
  g.fillRoundedRect(plaqueX + 8, plaqueY + 6, 22, plaqueH - 12, 6);
  g.fillStyle(readinessColor, 0.16);
  g.fillRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.lineStyle(1, readinessColor, 0.34);
  g.strokeRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(plaqueX + 36, plaqueY + 6, 40, 2, 1);

  c.add(scene.add.text(plaqueX + 19, plaqueY + plaqueH / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px' }).setOrigin(0.5));
  c.add(scene.add.text(plaqueX + 36, plaqueY + 12, `${roomName} Lv.${roomLevel}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    color: danger ? '#ffb7a8' : '#fff3cf',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(plaqueX + 103, plaqueY + 14, `${readiness}%`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: readiness >= 35 ? '#fff0c2' : '#ffb39a',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawInteriorRoomFixture(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomType: string | undefined,
  roomLevel: number,
  readiness: number,
): void {
  const cx = x + w / 2;
  const cy = y + h - 26;
  const glow = 0.12 + Math.min(0.16, readiness / 800);

  g.fillStyle(accent, glow * 0.6);
  g.fillCircle(cx, cy, 26 + Math.min(10, roomLevel * 2));
  g.lineStyle(1.2, accent, glow + 0.12);

  if (roomType === 'combat') {
    g.fillStyle(0x180605, 0.54);
    g.fillRoundedRect(cx - 62, y + 42, 22, 54, 5);
    g.fillRoundedRect(cx + 40, y + 42, 22, 54, 5);
    g.fillStyle(accent, 0.23 + glow * 0.16);
    g.fillTriangle(cx - 62, y + 42, cx - 40, y + 42, cx - 51, y + 66);
    g.fillTriangle(cx + 40, y + 42, cx + 62, y + 42, cx + 51, y + 66);
    g.strokeCircle(cx, cy, 23);
    g.strokeCircle(cx, cy, 13);
    g.fillStyle(accent, 0.24);
    g.fillRoundedRect(x + 34, y + h - 25, 36, 5, 3);
    g.fillRoundedRect(x + w - 70, y + h - 25, 36, 5, 3);
    g.lineStyle(1.2, accent, 0.34);
    g.lineBetween(x + 45, y + h - 29, x + 63, y + h - 49);
    g.lineBetween(x + w - 45, y + h - 29, x + w - 63, y + h - 49);
    g.lineStyle(1.2, 0xffd8a0, 0.22 + glow * 0.08);
    g.lineBetween(cx - 18, cy - 7, cx + 18, cy - 29);
    g.lineBetween(cx - 18, cy - 29, cx + 18, cy - 7);
    return;
  }

  if (roomType === 'trap') {
    g.fillStyle(0x160d03, 0.60);
    g.fillRoundedRect(cx - 72, y + 34, 144, 30, 8);
    g.lineStyle(1, accent, 0.22 + glow * 0.14);
    for (let i = 0; i < 5; i++) {
      const sx = cx - 60 + i * 30;
      g.lineBetween(sx, y + 39, sx + 18, y + 59);
    }
    g.fillStyle(accent, 0.22);
    for (let i = 0; i < 7; i++) {
      const px = x + 53 + i * ((w - 106) / 6);
      g.fillTriangle(px - 5, y + 48, px, y + 34 - (i % 2) * 4, px + 5, y + 48);
    }
    g.lineStyle(1.2, accent, 0.38);
    g.lineBetween(x + 44, y + 49, x + w - 44, y + 49);
    g.fillStyle(accent, 0.16 + glow * 0.10);
    g.fillRoundedRect(cx - 39, cy - 11, 78, 20, 8);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(cx - 26, cy - 2, cx + 26, cy - 2);
    g.strokeCircle(cx, cy, 16);
    return;
  }

  if (roomType === 'support') {
    g.fillStyle(0x06130c, 0.58);
    g.fillEllipse(cx, cy + 7, 92, 28);
    g.lineStyle(1, accent, 0.24 + glow * 0.10);
    for (let i = 0; i < 6; i++) {
      const vx = cx - 70 + i * 28;
      g.lineBetween(vx, y + 42, vx - 6 + (i % 2) * 12, y + 82);
      g.fillCircle(vx - 4 + (i % 2) * 8, y + 76, 2.6);
    }
    g.fillStyle(accent, 0.16);
    g.fillRoundedRect(cx - 38, cy - 13, 76, 22, 9);
    g.fillStyle(accent, 0.34);
    g.fillRoundedRect(cx - 5, cy - 20, 10, 36, 5);
    g.fillRoundedRect(cx - 18, cy - 7, 36, 10, 5);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(cx - 40, cy - 15, 80, 25, 9);
    return;
  }

  if (roomType === 'magic') {
    g.fillStyle(0x08051c, 0.60);
    g.fillCircle(cx, cy, 46);
    g.strokeCircle(cx, cy, 27);
    g.strokeCircle(cx, cy, 16);
    g.strokeCircle(cx, cy, 6);
    g.lineStyle(1, 0xffffff, 0.10 + glow * 0.08);
    g.lineBetween(cx, cy - 34, cx + 30, cy + 18);
    g.lineBetween(cx + 30, cy + 18, cx - 30, cy + 18);
    g.lineBetween(cx - 30, cy + 18, cx, cy - 34);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      g.fillStyle(accent, 0.35);
      g.fillCircle(cx + Math.cos(angle) * 27, cy + Math.sin(angle) * 27, 2.4);
      g.fillCircle(cx + Math.cos(angle + 0.25) * 39, cy + Math.sin(angle + 0.25) * 39, 1.8);
    }
    return;
  }

  g.lineStyle(1.1, accent, 0.26);
  g.strokeRoundedRect(cx - 38, cy - 18, 76, 34, 8);
  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(cx - 26, cy - 10, 52, 20, 6);
}

export function drawMonsterPreviewPedestal(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050302, 0.48);
  g.fillEllipse(x, y + 24, 66, 18);
  g.fillStyle(0x030608, 0.88);
  g.fillRoundedRect(x - 27, y + 5, 54, 22, 9);
  g.fillStyle(filled ? accent : 0x050806, filled ? 0.20 : 0.84);
  g.fillEllipse(x, y + 16, 56, 18);
  g.lineStyle(1.2, accent, filled ? 0.54 : 0.30);
  g.strokeEllipse(x, y + 16, 56, 18);
  g.lineStyle(1, accent, filled ? 0.28 : 0.14);
  g.strokeEllipse(x, y + 11, 38, 9);
  g.lineStyle(1, 0xffffff, filled ? 0.12 : 0.06);
  g.lineBetween(x - 18, y + 16, x + 18, y + 16);
  g.lineBetween(x, y + 9, x, y + 24);
  if (!filled) {
    g.fillStyle(accent, 0.10);
    g.fillCircle(x, y, 25);
    g.lineStyle(1.1, accent, 0.34);
    g.strokeCircle(x, y, 22);
    g.lineStyle(1, 0xffffff, 0.08);
    g.strokeCircle(x, y, 13);
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 2 * i + Math.PI / 4;
      g.fillStyle(accent, 0.26);
      g.fillCircle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 1.8);
    }
  }
  g.fillStyle(accent, filled ? 0.16 : 0.07);
  g.fillRoundedRect(x - 22, y + 20, 44, 6, 3);
  g.fillCircle(x - 22, y + 15, 2.2);
  g.fillCircle(x + 22, y + 15, 2.2);
  g.fillStyle(0x050302, 0.90);
  g.fillRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.lineStyle(1, accent, filled ? 0.58 : 0.34);
  g.strokeRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.fillStyle(accent, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 30, y + 12, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 22, y + 8.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawInteriorEquipmentBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.94);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0xffcc66, 0.74);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y, equipment.icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px' }).setOrigin(0.5));
}

export function drawInteriorEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.88);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0x9a6cd8, 0.52);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.10);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y - 0.5, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#e4d8ff',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawInteriorSlotActionChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  filled: boolean,
): void {
  const w = Math.max(filled ? 34 : 42, label.length * 10 + (filled ? 13 : 22));
  const h = filled ? 15 : 16;
  const g = scene.add.graphics();
  g.fillStyle(0x020806, filled ? 0.94 : 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.lineStyle(1, accent, filled ? 0.68 : 0.72);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.fillStyle(accent, filled ? 0.20 : 0.16);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 5);
  g.fillStyle(accent, filled ? 0.86 : 0.58);
  g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, 4, h - 8, 3);
  if (!filled) {
    const arrowX = x + w / 2 - 7;
    g.fillStyle(0xffffff, 0.24);
    g.beginPath();
    g.moveTo(arrowX - 2, y - 3);
    g.lineTo(arrowX + 3, y);
    g.lineTo(arrowX - 2, y + 3);
    g.closePath();
    g.fillPath();
  } else {
    g.fillStyle(accent, 0.72);
    g.fillCircle(x + w / 2 - 8, y, 2.2);
  }
  c.add(g);
  c.add(scene.add.text(filled ? x - 2 : x - 3, y + 0.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: filled ? '#eaffd8' : '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawPreviewTargetRing(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
): void {
  const g = scene.add.graphics();
  g.lineStyle(4, accent, 0.14);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(1.7, accent, 0.86);
  g.strokeRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 9);
  g.fillStyle(accent, 0.07);
  g.fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 8);
  const chipW = Math.min(w - 14, Math.max(48, label.length * 10 + 18));
  const chipY = y - h / 2 + 7;
  g.fillStyle(0x040908, 0.90);
  g.fillRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  g.lineStyle(1, accent, 0.72);
  g.strokeRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  c.add(g);

  const text = scene.add.text(x, chipY + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#f5ffe8',
    fontStyle: 'bold' }).setOrigin(0.5);
  c.add(text);

  if (prefersReducedMotion()) return;
  scene.tweens.add({
    targets: [g, text],
    alpha: { from: 0.72, to: 1 },
    duration: 560,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut' });
}

export function addPreviewHitZone(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  onPress: () => void,
): void {
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onPress);
  c.add(zone);
}

export function getPreviewSlotPosition(
  index: number,
  total: number,
  x: number,
  y: number,
  w: number,
  rowGap: number,
): { x: number; y: number } {
  const perRow = Math.min(3, Math.max(1, total));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const countInRow = Math.min(perRow, total - row * perRow);
  const gap = countInRow <= 1 ? 0 : Math.min(54, w / (countInRow - 1));
  const startX = x + w / 2 - gap * (countInRow - 1) / 2;
  return { x: startX + col * gap, y: y + row * rowGap };
}

export function drawTrapPreviewSlot(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  icon: string,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  const edge = filled ? 0xffc44d : accent;
  g.fillStyle(0x050302, 0.46);
  g.fillEllipse(x, y + 13, 50, 13);
  g.fillStyle(filled ? 0x2d1b08 : 0x071016, filled ? 0.98 : 0.86);
  g.beginPath();
  g.moveTo(x - 20, y - 7);
  g.lineTo(x - 13, y - 14);
  g.lineTo(x + 13, y - 14);
  g.lineTo(x + 20, y - 7);
  g.lineTo(x + 20, y + 8);
  g.lineTo(x + 12, y + 14);
  g.lineTo(x - 12, y + 14);
  g.lineTo(x - 20, y + 8);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.2, edge, filled ? 0.86 : 0.36);
  g.strokePath();
  g.fillStyle(edge, filled ? 0.15 : 0.07);
  g.fillRoundedRect(x - 13, y - 8, 26, 5, 2);
  g.lineStyle(1, edge, filled ? 0.38 : 0.18);
  g.lineBetween(x - 13, y + 8, x + 13, y + 8);
  if (!filled) {
    g.fillStyle(edge, 0.11);
    g.fillCircle(x, y, 16);
    g.lineStyle(1, edge, 0.32);
    g.strokeCircle(x, y, 13);
  }
  g.fillStyle(0xffffff, filled ? 0.14 : 0.06);
  g.fillCircle(x - 14, y - 8, 1.5);
  g.fillCircle(x + 14, y - 8, 1.5);
  g.fillStyle(0x050302, 0.92);
  g.fillRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.lineStyle(1, edge, filled ? 0.62 : 0.36);
  g.strokeRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.fillStyle(edge, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 25, y - 9, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 17, y - 12.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x, filled ? y : y - 0.5, filled ? icon : '+', {
    fontFamily: 'sans-serif',
    fontSize: filled ? '16px' : '18px',
    color: filled ? '#ffe080' : '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function drawMonsterAnchor(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x061016, 0.88);
  g.fillCircle(x, y, 15);
  g.fillStyle(accent, 0.07);
  g.fillCircle(x, y, 22);
  g.lineStyle(1.2, accent, 0.40);
  g.strokeCircle(x, y, 15);
  g.lineStyle(1, accent, 0.25);
  g.strokeCircle(x, y, 8);
  g.lineBetween(x - 10, y, x + 10, y);
  g.lineBetween(x, y - 10, x, y + 10);
  g.fillStyle(accent, 0.22);
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 2 * i + Math.PI / 4;
    g.fillCircle(x + Math.cos(angle) * 17, y + Math.sin(angle) * 17, 1.8);
  }
  c.add(g);
  c.add(scene.add.text(x, y - 1, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    color: '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}
