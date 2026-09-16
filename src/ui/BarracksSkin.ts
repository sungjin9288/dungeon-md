import Phaser from 'phaser';

export type LegionManagementAction = 'codex' | 'summon' | 'fusion' | 'skill' | 'shop';

export function drawLegionCrest(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
): void {
  g.lineStyle(2 * scale, color, alpha);
  g.beginPath();
  g.arc(x - 7 * scale, y - 3 * scale, 7 * scale, 0.12, 1.68);
  g.strokePath();
  g.beginPath();
  g.arc(x + 7 * scale, y - 3 * scale, 7 * scale, 1.46, 3.02);
  g.strokePath();
  g.fillStyle(color, alpha);
  g.fillTriangle(
    x - 9 * scale, y + 2 * scale,
    x + 9 * scale, y + 2 * scale,
    x, y + 13 * scale,
  );
  g.fillStyle(0x060806, 0.96);
  g.fillCircle(x - 3 * scale, y + 5 * scale, 1.3 * scale);
  g.fillCircle(x + 3 * scale, y + 5 * scale, 1.3 * scale);
}

export function drawGrowthSigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
): void {
  g.lineStyle(2, color, alpha);
  g.strokeCircle(x, y, 9);
  g.lineBetween(x, y + 9, x, y - 10);
  g.lineBetween(x, y - 10, x - 5, y - 4);
  g.lineBetween(x, y - 10, x + 5, y - 4);
  g.fillStyle(color, alpha);
  g.fillCircle(x, y + 1, 2.4);
}

export function drawReinforcementSigil(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha = 1,
): void {
  g.lineStyle(2, color, alpha);
  g.strokeCircle(x, y, 11);
  g.strokeCircle(x, y, 5);
  g.lineBetween(x - 15, y, x - 8, y);
  g.lineBetween(x + 8, y, x + 15, y);
  g.lineBetween(x, y - 15, x, y - 8);
  g.lineBetween(x, y + 8, x, y + 15);
}

export function drawLegionActionSigil(
  g: Phaser.GameObjects.Graphics,
  action: LegionManagementAction,
  x: number,
  y: number,
  color: number,
  alpha = 1,
): void {
  g.lineStyle(1.8, color, alpha);
  g.fillStyle(color, alpha);

  if (action === 'codex') {
    g.strokeRect(x - 10, y - 8, 9, 16);
    g.strokeRect(x + 1, y - 8, 9, 16);
    g.lineBetween(x, y - 7, x, y + 9);
    return;
  }
  if (action === 'summon') {
    drawReinforcementSigil(g, x, y, color, alpha);
    return;
  }
  if (action === 'fusion') {
    g.strokeCircle(x - 5, y, 7);
    g.strokeCircle(x + 5, y, 7);
    g.fillCircle(x, y, 2.2);
    return;
  }
  if (action === 'skill') {
    g.fillCircle(x, y - 8, 2.4);
    g.fillCircle(x - 8, y + 7, 2.4);
    g.fillCircle(x + 8, y + 7, 2.4);
    g.lineBetween(x, y - 5, x - 7, y + 5);
    g.lineBetween(x, y - 5, x + 7, y + 5);
    return;
  }

  g.strokeRect(x - 10, y - 5, 20, 13);
  g.lineBetween(x - 12, y - 5, x + 12, y - 5);
  g.lineBetween(x - 8, y - 10, x + 8, y - 10);
  g.lineBetween(x - 8, y - 10, x - 11, y - 5);
  g.lineBetween(x + 8, y - 10, x + 11, y - 5);
}
