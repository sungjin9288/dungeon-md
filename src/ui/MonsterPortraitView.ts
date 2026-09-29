import Phaser from 'phaser';
import { generatePortrait } from '../art/PortraitGenerator';
import { MONSTER_DEFS, getSkinForMonster, resolveOwnedMonsterProfile } from '../data/monsters';
import { getMonsterVisualIdentity } from '../data/monsterVisualIdentity';

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
  readonly cueGraphic?: Phaser.GameObjects.Graphics;
  readonly roleCue?: Phaser.GameObjects.Text;
  readonly elementCue?: Phaser.GameObjects.Text;
}

export function setMonsterPortraitAlpha(portrait: MonsterPortraitRefs, alpha: number): void {
  portrait.frame.setAlpha(alpha);
  portrait.image?.setAlpha(alpha);
  portrait.fallbackText?.setAlpha(alpha);
  portrait.cueGraphic?.setAlpha(alpha);
  portrait.roleCue?.setAlpha(alpha);
  portrait.elementCue?.setAlpha(alpha);
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
  const profile = resolveOwnedMonsterProfile(monsterId);
  const typeId = profile?.registryId ?? null;
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
  let cueGraphic: Phaser.GameObjects.Graphics | undefined;
  let roleCue: Phaser.GameObjects.Text | undefined;
  let elementCue: Phaser.GameObjects.Text | undefined;

  if (typeId) {
    // A skinned guardian renders its skin palette through the same generator the
    // Codex uses; without it an equipped skin showed only its emoji.
    const portraitKey = generatePortrait(scene, typeId, skin?.id);
    if (scene.textures.exists(portraitKey)) {
      image = scene.add.image(x, y, portraitKey)
        .setOrigin(0.5)
        .setDisplaySize(size - 8, size - 8)
        .setDepth(depth + 0.1);
    }
  }

  if (!image) {
    fallbackText = scene.add.text(x, y, skin?.emoji ?? profile?.emoji ?? '👹', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(18, Math.round(size * 0.58))}px`,
    }).setOrigin(0.5).setDepth(depth + 0.1);
  }

  // Portraits at card size benefit from a compact, deterministic role + element
  // read. Tiny world tokens intentionally omit the cue to preserve their sprite.
  if (def && size >= 34) {
    const identity = getMonsterVisualIdentity(def);
    const cueSize = Math.max(14, Math.min(18, Math.round(size * 0.28)));
    const cueY = y + size / 2 - cueSize / 2 - 2;
    const roleX = x - size / 2 + cueSize / 2 + 2;
    const elementX = x + size / 2 - cueSize / 2 - 2;
    cueGraphic = scene.add.graphics().setDepth(depth + 0.2);
    cueGraphic.fillStyle(identity.role.color, 0.92);
    cueGraphic.fillCircle(roleX, cueY, cueSize / 2);
    cueGraphic.fillStyle(identity.element.color, 0.92);
    cueGraphic.fillCircle(elementX, cueY, cueSize / 2);
    cueGraphic.lineStyle(1, 0x0a0d10, 0.72);
    cueGraphic.strokeCircle(roleX, cueY, cueSize / 2);
    cueGraphic.strokeCircle(elementX, cueY, cueSize / 2);

    const cueStyle = {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(10, Math.round(cueSize * 0.72))}px`,
      color: '#ffffff',
      stroke: '#101317',
      strokeThickness: 2,
    };
    roleCue = scene.add.text(roleX, cueY, identity.role.glyph, cueStyle)
      .setOrigin(0.5).setDepth(depth + 0.3);
    elementCue = scene.add.text(elementX, cueY, identity.element.glyph, cueStyle)
      .setOrigin(0.5).setDepth(depth + 0.3);
  }

  if (container) {
    container.add(frame);
    if (image) container.add(image);
    if (fallbackText) container.add(fallbackText);
    if (cueGraphic) container.add(cueGraphic);
    if (roleCue) container.add(roleCue);
    if (elementCue) container.add(elementCue);
  }

  return { frame, image, fallbackText, cueGraphic, roleCue, elementCue };
}
