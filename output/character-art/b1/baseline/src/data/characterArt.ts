import { MONSTER_DEFS } from './monsterRegistry';
import type { MonsterId } from './monstersTypes';

export interface CharacterArt {
  readonly monsterId: MonsterId;
  readonly version: 'ritual-v2';
  readonly textureKey: string;
  readonly path: string;
}

// Presentation overrides only. The complete legacy JPEG catalog stays loaded.
export const CHARACTER_ART = Object.freeze({
  dokkaebi_warrior: Object.freeze({
    monsterId: 'dokkaebi_warrior', version: 'ritual-v2',
    textureKey: 'monster-ritual-v2-dokkaebi_warrior',
    path: '/assets/monsters/ritual-v2/dokkaebi_warrior.png',
  }),
  gumiho_guardian: Object.freeze({
    monsterId: 'gumiho_guardian', version: 'ritual-v2',
    textureKey: 'monster-ritual-v2-gumiho_guardian',
    path: '/assets/monsters/ritual-v2/gumiho_guardian.png',
  }),
  death_messenger: Object.freeze({
    monsterId: 'death_messenger', version: 'ritual-v2',
    textureKey: 'monster-ritual-v2-death_messenger',
    path: '/assets/monsters/ritual-v2/death_messenger.png',
  }),
  mountain_spirit: Object.freeze({
    monsterId: 'mountain_spirit', version: 'ritual-v2',
    textureKey: 'monster-ritual-v2-mountain_spirit',
    path: '/assets/monsters/ritual-v2/mountain_spirit.png',
  }),
} satisfies Partial<Record<MonsterId, CharacterArt>>);

const SPEAKER_ART = Object.freeze({
  '도깨비 전사': 'dokkaebi_warrior',
  '구미호': 'gumiho_guardian',
  '저승사자': 'death_messenger',
  '산신령': 'mountain_spirit',
} as const);

export function getCharacterArt(monsterId: unknown): CharacterArt | null {
  return typeof monsterId === 'string' && Object.prototype.hasOwnProperty.call(CHARACTER_ART, monsterId)
    ? CHARACTER_ART[monsterId as keyof typeof CHARACTER_ART]
    : null;
}

export function getCharacterArtForSpeaker(speaker: unknown): CharacterArt | null {
  return typeof speaker === 'string' && Object.prototype.hasOwnProperty.call(SPEAKER_ART, speaker)
    ? getCharacterArt(SPEAKER_ART[speaker as keyof typeof SPEAKER_ART])
    : null;
}

export interface CharacterArtSource {
  readonly textureKey: string;
  readonly version: 'ritual-v2' | 'legacy';
}

/** Null selects the existing procedural path, including explicit skin rendering. */
export function selectCharacterArtSource(
  monsterId: unknown,
  textureExists: (key: string) => boolean,
  skinId?: string,
): CharacterArtSource | null {
  if (skinId || typeof monsterId !== 'string'
    || !Object.prototype.hasOwnProperty.call(MONSTER_DEFS, monsterId)) return null;
  const art = getCharacterArt(monsterId);
  if (art && textureExists(art.textureKey)) return { textureKey: art.textureKey, version: art.version };
  const legacyKey = `monster-ai-${monsterId}`;
  return textureExists(legacyKey) ? { textureKey: legacyKey, version: 'legacy' } : null;
}
