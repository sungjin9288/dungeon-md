import type Phaser from 'phaser';
import { getCharacterArtForSpeaker, selectCharacterArtSource } from '../data/characterArt';

export type QuestSpeakerVisual =
  | { kind: 'image'; textureKey: string }
  | { kind: 'emoji'; emoji: string };

export function resolveQuestSpeakerVisual(
  speaker: string,
  emoji: string,
  textureExists: (key: string) => boolean,
): QuestSpeakerVisual {
  const art = getCharacterArtForSpeaker(speaker);
  const source = art
    ? selectCharacterArtSource(art.monsterId, textureExists)
    : null;
  return source
    ? { kind: 'image', textureKey: source.textureKey }
    : { kind: 'emoji', emoji };
}

export function addQuestSpeakerVisual(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  size: number,
  speaker: string,
  emoji: string,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  const visual = resolveQuestSpeakerVisual(
    speaker,
    emoji,
    key => scene.textures.exists(key),
  );
  const object = visual.kind === 'image'
    ? scene.add.image(x, y, visual.textureKey).setOrigin(0).setDisplaySize(size, size)
    : scene.add.text(x + size / 2, y + size / 2, visual.emoji, {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(size * 0.75)}px`,
    }).setOrigin(0.5);
  container.add(object);
  return object;
}
