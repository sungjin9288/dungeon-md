/**
 * Trap / affliction icon: the painted icon when its texture was loaded
 * (public/assets/traps/{id}.png via trapArtManifest), otherwise the emoji the
 * game always showed. One call site pattern for tray chips, pickers and Forge.
 */
import Phaser from 'phaser';
import { TRAP_DEFS } from '../data/traps';

export function trapArtKey(id: string): string {
  return `trap-art-${id}`;
}

/** Adds the icon centred at (x, y) fitting `size` px; the caller adds it to a container if needed. */
export function addTrapIcon(
  scene: Phaser.Scene,
  trapId: string,
  x: number,
  y: number,
  size: number,
  alpha = 1,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  const key = trapArtKey(trapId);
  if (scene.textures.exists(key)) {
    return scene.add.image(x, y, key).setDisplaySize(size, size).setAlpha(alpha);
  }
  const emoji = TRAP_DEFS.find(def => def.id === trapId)?.emoji ?? '◇';
  return scene.add.text(x, y, emoji, { fontSize: `${Math.round(size * 0.85)}px` }).setOrigin(0.5).setAlpha(alpha);
}
