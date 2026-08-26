/**
 * AmbientBackground — shared charcoal-indigo stone atmosphere.
 *
 * Applied globally to allow-listed scenes from main.ts (and idempotently from a
 * scene's own create() when it wants the backdrop earlier). It stays visually
 * quiet and non-interactive so rooms, rewards, enemies, and controls remain
 * unambiguous.
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
import { addSceneAtmosphere } from './SceneAtmosphere';

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

  // Broad mineral strata: open strokes instead of closed room/control shapes.
  bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.055);
  for (let y = top + 54, row = 0; y < bottom; y += 76, row++) {
    const drift = row % 2 === 0 ? 18 : -24;
    bg.beginPath();
    bg.moveTo(-24, y);
    bg.lineTo(CANVAS_WIDTH * 0.34 + drift, y + 7);
    bg.lineTo(CANVAS_WIDTH * 0.72 - drift, y - 4);
    bg.lineTo(CANVAS_WIDTH + 24, y + 5);
    bg.strokePath();
  }

  // Sparse static mica flecks. SceneAtmosphere owns any optional motion.
  bg.fillStyle(CASUAL.BG_DOT, 0.065);
  for (let row = 0, y = 52; y < bottom; y += 96, row++) {
    for (let x = 28 + (row % 3) * 39; x < CANVAS_WIDTH; x += 118) {
      bg.fillCircle(x, y, row % 2 === 0 ? 1.2 : 0.9);
    }
  }

  // Idempotent and reduced-motion gated by SceneAtmosphere.
  addSceneAtmosphere(scene);
}
