import type Phaser from 'phaser';

export type ForgeEquipmentType = 'weapon' | 'armor' | 'accessory';

export function drawForgeCrest(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x - 12 * scale, y + 4 * scale, 24 * scale, 5 * scale, 1.5 * scale);
  g.fillTriangle(
    x - 7 * scale, y + 9 * scale,
    x + 7 * scale, y + 9 * scale,
    x, y + 15 * scale,
  );
  g.lineStyle(3 * scale, color, alpha);
  g.lineBetween(x - 9 * scale, y - 10 * scale, x + 8 * scale, y + 4 * scale);
  g.fillRoundedRect(x - 14 * scale, y - 13 * scale, 10 * scale, 6 * scale, 1.5 * scale);
}

export function drawBlueprintSigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.lineStyle(1.5 * scale, color, alpha);
  g.strokeRoundedRect(x - 11 * scale, y - 13 * scale, 22 * scale, 26 * scale, 2 * scale);
  g.lineBetween(x - 6 * scale, y - 6 * scale, x + 6 * scale, y - 6 * scale);
  g.lineBetween(x - 6 * scale, y, x + 4 * scale, y);
  g.lineBetween(x - 6 * scale, y + 6 * scale, x + 7 * scale, y + 6 * scale);
  g.fillStyle(color, alpha * 0.9);
  g.fillCircle(x + 6 * scale, y, 2 * scale);
}

export function drawEquipmentSigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  type: ForgeEquipmentType | string,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.lineStyle(2.2 * scale, color, alpha);
  g.fillStyle(color, alpha * 0.18);
  if (type === 'weapon') {
    g.lineBetween(x - 9 * scale, y + 10 * scale, x + 8 * scale, y - 9 * scale);
    g.fillTriangle(
      x + 8 * scale, y - 9 * scale,
      x + 4 * scale, y - 1 * scale,
      x, y - 5 * scale,
    );
    g.lineBetween(x - 11 * scale, y + 5 * scale, x - 4 * scale, y + 12 * scale);
    g.lineBetween(x - 12 * scale, y + 11 * scale, x - 7 * scale, y + 14 * scale);
    return;
  }
  if (type === 'armor') {
    g.beginPath();
    g.moveTo(x, y - 13 * scale);
    g.lineTo(x + 11 * scale, y - 7 * scale);
    g.lineTo(x + 8 * scale, y + 7 * scale);
    g.lineTo(x, y + 14 * scale);
    g.lineTo(x - 8 * scale, y + 7 * scale);
    g.lineTo(x - 11 * scale, y - 7 * scale);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.lineBetween(x, y - 7 * scale, x, y + 8 * scale);
    return;
  }
  g.strokeCircle(x, y, 11 * scale);
  g.strokeCircle(x, y, 4 * scale);
  g.fillTriangle(
    x, y - 15 * scale,
    x + 4 * scale, y - 9 * scale,
    x - 4 * scale, y - 9 * scale,
  );
}

export function drawSupplySigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.lineStyle(2.4 * scale, color, alpha);
  g.lineBetween(x - 8 * scale, y + 11 * scale, x + 6 * scale, y - 8 * scale);
  g.beginPath();
  g.arc(x, y - 6 * scale, 10 * scale, 3.5, 5.8);
  g.strokePath();
  g.fillStyle(color, alpha * 0.2);
  g.fillTriangle(
    x - 12 * scale, y + 12 * scale,
    x - 3 * scale, y + 4 * scale,
    x + 4 * scale, y + 12 * scale,
  );
}

export function drawDismantleSigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.lineStyle(2.2 * scale, color, alpha);
  g.lineBetween(x - 10 * scale, y - 10 * scale, x + 10 * scale, y + 10 * scale);
  g.lineBetween(x + 10 * scale, y - 10 * scale, x - 10 * scale, y + 10 * scale);
  g.strokeCircle(x, y, 13 * scale);
  g.fillStyle(color, alpha * 0.26);
  g.fillCircle(x, y, 4 * scale);
}
