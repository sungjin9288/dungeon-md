import Phaser from 'phaser';
import { COLORS } from '../constants/colors';
import { getReducedMotion } from '../utils/reducedMotion';

export class Torch {
  private flameGfx: Phaser.GameObjects.Graphics;
  private light: Phaser.GameObjects.PointLight;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Flame flicker, light flicker and rising embers are purely decorative —
    // under reduced motion the torch is drawn fully lit but perfectly still.
    const reducedMotion = getReducedMotion();
    // Wall bracket
    const bracket = scene.add.graphics();
    bracket.fillStyle(COLORS.STONE_DARK, 1);
    bracket.fillRect(x - 7, y - 6, 14, 14);
    bracket.fillStyle(0xffffff, 0.08);
    bracket.fillRect(x - 7, y - 6, 14, 2); // highlight
    // Torch stick
    bracket.fillStyle(0x5a3810, 1);
    bracket.fillRect(x - 2, y - 24, 4, 20);
    bracket.fillStyle(0x7a5020, 0.5);
    bracket.fillRect(x - 1, y - 23, 2, 18);
    bracket.setDepth(15);

    // Flame
    this.flameGfx = scene.add.graphics();
    this.drawFlame(this.flameGfx, x, y - 28);
    this.flameGfx.setDepth(16);

    // Flame flicker tween
    if (!reducedMotion) {
      scene.tweens.add({
        targets: this.flameGfx,
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.88, to: 1.12 },
        alpha:  { from: 0.75, to: 1.0 },
        duration: Phaser.Math.Between(550, 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Point light — radial glow over grid
    this.light = scene.add.pointlight(x, y - 10, COLORS.TORCH_GLOW, 220, 0.55, 0.035);
    this.light.setDepth(14);

    // Intensity flicker (offset from flame so they feel independent)
    if (!reducedMotion) {
      scene.tweens.add({
        targets: this.light,
        intensity: { from: 0.3, to: 0.7 },
        radius: { from: 190, to: 240 },
        duration: Phaser.Math.Between(700, 1100),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Ember particles — perpetual rising motion; omit entirely under reduced motion.
    if (!reducedMotion) {
      scene.add.particles(x, y - 32, 'ember', {
        speedY: { min: -65, max: -28 },
        speedX: { min: -14, max: 14 },
        alpha:  { start: 0.95, end: 0 },
        scale:  { start: 0.55, end: 0 },
        tint:   [COLORS.TORCH_GLOW, 0xffaa22, COLORS.BLOOD_GLOW],
        lifespan: 650,
        frequency: 260,
        quantity: 1,
      }).setDepth(17);
    }
  }

  private drawFlame(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Outer flame
    gfx.fillStyle(COLORS.TORCH_GLOW, 0.9);
    gfx.fillTriangle(x, y - 16, x - 9, y + 3, x + 9, y + 3);
    // Mid flame
    gfx.fillStyle(0xffaa22, 0.85);
    gfx.fillTriangle(x, y - 10, x - 6, y + 3, x + 6, y + 3);
    // Hot core
    gfx.fillStyle(0xffee55, 0.8);
    gfx.fillTriangle(x, y - 4, x - 3, y + 3, x + 3, y + 3);
  }
}
