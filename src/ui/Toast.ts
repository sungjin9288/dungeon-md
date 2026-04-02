/**
 * Lightweight reusable toast notification for any Phaser scene.
 *
 * Usage:
 *   showToast(scene, '복사 완료!');
 *   showToast(scene, '실패!', { color: '#ff4444', duration: 2000 });
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';

export interface ToastOptions {
  color?:    string;   // text color (default '#e8d090')
  bgColor?:  number;   // background (default 0x000000)
  bgAlpha?:  number;   // background alpha (default 0.8)
  duration?: number;   // total visible time in ms (default 1800)
  y?:        number;   // y position (default CANVAS_HEIGHT - 80)
  depth?:    number;   // display depth (default 200)
  fontSize?: string;   // font size (default '13px')
}

export function showToast(
  scene: Phaser.Scene,
  message: string,
  opts: ToastOptions = {},
): void {
  const {
    color    = '#e8d090',
    bgColor  = 0x000000,
    bgAlpha  = 0.8,
    duration = 1800,
    y        = CANVAS_HEIGHT - 80,
    depth    = 200,
    fontSize = '13px',
  } = opts;

  const text = scene.add.text(CANVAS_WIDTH / 2, y, message, {
    fontFamily: 'sans-serif',
    fontSize,
    color,
    backgroundColor: undefined,
    padding: { x: 0, y: 0 },
  }).setOrigin(0.5).setDepth(depth).setAlpha(0);

  // Measure text and draw background pill
  const pw = text.width + 24;
  const ph = text.height + 12;
  const bg = scene.add.graphics().setDepth(depth - 1).setAlpha(0);
  bg.fillStyle(bgColor, bgAlpha);
  bg.fillRoundedRect(CANVAS_WIDTH / 2 - pw / 2, y - ph / 2, pw, ph, 8);

  // Fade in
  scene.tweens.add({
    targets: [text, bg],
    alpha: 1,
    y: `-=10`,
    duration: 250,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      // Hold, then fade out
      scene.tweens.add({
        targets: [text, bg],
        alpha: 0,
        y: `-=15`,
        delay: duration - 500,
        duration: 400,
        onComplete: () => { text.destroy(); bg.destroy(); },
      });
    },
  });
}
