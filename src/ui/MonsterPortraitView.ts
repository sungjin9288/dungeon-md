import Phaser from 'phaser';
import { generatePortrait } from '../art/PortraitGenerator';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';

export interface MonsterPortraitOptions {
  readonly size: number;
  readonly depth?: number;
  readonly frameColor?: number;
  readonly glowColor?: number;
  readonly bgColor?: number;
  readonly equippedSkins?: Record<string, string>;
}

export interface MonsterPortraitRefs {
  readonly frame: Phaser.GameObjects.Graphics;
  readonly image?: Phaser.GameObjects.Image;
  readonly fallbackText?: Phaser.GameObjects.Text;
}

export function resolveMonsterTypeId(monsterId: string): MonsterId | null {
  const typeId = Object.keys(MONSTER_DEFS).find(
    id => monsterId === id || monsterId.startsWith(`${id}_`),
  );
  return (typeId ?? null) as MonsterId | null;
}

export function addMonsterPortrait(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container | null,
  x: number,
  y: number,
  monsterId: string,
  options: MonsterPortraitOptions,
): MonsterPortraitRefs {
  const {
    size,
    depth = 0,
    frameColor = 0xc8921a,
    glowColor = frameColor,
    bgColor = 0x090d10,
    equippedSkins,
  } = options;
  const typeId = resolveMonsterTypeId(monsterId);
  const def = typeId ? MONSTER_DEFS[typeId] : undefined;
  const skin = typeId && equippedSkins ? getSkinForMonster(typeId, equippedSkins) : null;
  const radius = Math.max(5, Math.round(size * 0.16));

  const frame = scene.add.graphics().setDepth(depth);
  frame.fillStyle(glowColor, 0.16);
  frame.fillRoundedRect(x - size / 2 - 3, y - size / 2 - 3, size + 6, size + 6, radius + 2);
  frame.fillStyle(bgColor, 0.98);
  frame.fillRoundedRect(x - size / 2, y - size / 2, size, size, radius);
  frame.lineStyle(1.4, frameColor, 0.72);
  frame.strokeRoundedRect(x - size / 2, y - size / 2, size, size, radius);
  frame.lineStyle(1, 0xffffff, 0.12);
  frame.lineBetween(x - size / 2 + 6, y - size / 2 + 5, x + size / 2 - 6, y - size / 2 + 5);

  let image: Phaser.GameObjects.Image | undefined;
  let fallbackText: Phaser.GameObjects.Text | undefined;

  if (typeId && !skin) {
    const portraitKey = generatePortrait(scene, typeId);
    if (scene.textures.exists(portraitKey)) {
      image = scene.add.image(x, y, portraitKey)
        .setOrigin(0.5)
        .setDisplaySize(size - 8, size - 8)
        .setDepth(depth + 0.1);
    }
  }

  if (!image) {
    fallbackText = scene.add.text(x, y, skin?.emoji ?? def?.emoji ?? '👹', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(18, Math.round(size * 0.58))}px`,
    }).setOrigin(0.5).setDepth(depth + 0.1);
  }

  if (container) {
    container.add(frame);
    if (image) container.add(image);
    if (fallbackText) container.add(fallbackText);
  }

  return { frame, image, fallbackText };
}
