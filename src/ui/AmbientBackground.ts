/**
 * AmbientBackground — shared bright casual-toy backdrop for non-battle scenes.
 *
 * Applied globally to allow-listed scenes from main.ts (and idempotently from a
 * scene's own create() when it wants the backdrop earlier). Draws a warm
 * vertical gradient + soft sun glow + playful polka dots so every scene shares
 * the same friendly storybook frame as the home screen.
 *
 * Design notes:
 * - Drawn in world space at depth -1000 with the DEFAULT scrollFactor (1),
 *   matching DungeonHomeScene.buildBackground. The game runs a high-DPR camera
 *   (zoom 2 + scroll offset); scrollFactor(0) misaligns under that transform.
 * - Oversized vertically so short-scrolling scenes still show the backdrop.
 * - Idempotent per scene instance via data key `casualBgApplied`.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL } from '../constants/colors';

const CASUAL_BG_FLAG = 'casualBgApplied';

export function applyCasualBackground(scene: Phaser.Scene): void {
  if (scene.data?.get(CASUAL_BG_FLAG)) return;
  scene.data?.set(CASUAL_BG_FLAG, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.data?.set(CASUAL_BG_FLAG, false);
  });

  const top = -CANVAS_HEIGHT;
  const bottom = CANVAS_HEIGHT * 2;
  const bg = scene.add.graphics().setDepth(-1000);
  bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  bg.fillRect(0, top, CANVAS_WIDTH, bottom - top);
  bg.fillStyle(0xfff7e4, 0.5);
  bg.fillEllipse(CANVAS_WIDTH / 2, 30, CANVAS_WIDTH * 1.5, 240);
  bg.fillStyle(CASUAL.BG_DOT, 0.16);
  for (let row = 0, y = 70; y < bottom; y += 60, row++) {
    for (let x = (row % 2) * 30 + 16; x < CANVAS_WIDTH; x += 60) bg.fillCircle(x, y, 3.5);
  }
}
