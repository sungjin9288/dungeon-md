import { MONSTER_DEFS } from './monsterRegistry';
import type { MonsterId } from './monstersTypes';

export interface CharacterArt {
  readonly monsterId: MonsterId;
  readonly version: 'ritual-v2';
  readonly textureKey: string;
  readonly path: string;
}

// Presentation overrides only. The complete legacy JPEG catalog stays loaded.
// Order matters to tests: the approved first nine stay first; batches append.
const RITUAL_V2_IDS = [
  'dokkaebi_warrior',
  'gumiho_guardian',
  'death_messenger',
  'mountain_spirit',
  'village_archer',
  'dokkaebi_junior',
  'gold_turtle',
  'fire_dokkaebi',
  'sage',
  'one_tail_fox',
  'three_tail_fox',
  'five_tail_fox',
  'fox_shaman',
  'fox_spirit_elder',
  'spring_gumiho',
  'summer_gumiho',
  'ice_gumiho',
  'thunder_gumiho',
  'fox_warrior',
  'gumiho_queen',
  'gumiho_goddess',
  'gumiho_archmage',
  'celestial_fairy',
  'gumiho_demon',
] as const satisfies readonly MonsterId[];

type RitualV2Id = (typeof RITUAL_V2_IDS)[number];

export const CHARACTER_ART: Readonly<Record<RitualV2Id, CharacterArt>> = Object.freeze(
  Object.fromEntries(RITUAL_V2_IDS.map(id => [id, Object.freeze({
    monsterId: id,
    version: 'ritual-v2' as const,
    textureKey: `monster-ritual-v2-${id}`,
    path: `/assets/monsters/ritual-v2/${id}.webp`,
  })])) as Record<RitualV2Id, CharacterArt>,
);

const SPEAKER_ART = Object.freeze({
  '도깨비 전사': 'dokkaebi_warrior',
  '구미호': 'gumiho_guardian',
  '저승사자': 'death_messenger',
  '산신령': 'mountain_spirit',
  '신선 도인': 'sage',
} as const);

/** Monsters whose ritual art stands in for a story speaker; streamed early. */
export const SPEAKER_MONSTER_IDS: readonly MonsterId[] = Object.values(SPEAKER_ART);

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

/**
 * Ritual-v2 skin cutouts (SKIN_DATA ids). A skin without an entry keeps the
 * procedural palette portrait. Appended by scripts/export-skin-art.mjs batches.
 */
const SKIN_ART_IDS: readonly string[] = [
];

export function getSkinArt(skinId: unknown): CharacterArt | null {
  if (typeof skinId !== 'string' || !SKIN_ART_IDS.includes(skinId)) return null;
  return {
    monsterId: skinId as MonsterId,
    version: 'ritual-v2',
    textureKey: `skin-ritual-v2-${skinId}`,
    path: `/assets/monsters/ritual-v2/skins/${skinId}.webp`,
  };
}

/** Streamable art by id: a monster cutout or, failing that, a skin cutout. */
export function getStreamableArt(id: unknown): CharacterArt | null {
  return getCharacterArt(id) ?? getSkinArt(id);
}

/** Null selects the existing procedural path (a skin with no loaded skin art included). */
export function selectCharacterArtSource(
  monsterId: unknown,
  textureExists: (key: string) => boolean,
  skinId?: string,
): CharacterArtSource | null {
  if (typeof monsterId !== 'string' || !Object.prototype.hasOwnProperty.call(MONSTER_DEFS, monsterId)) return null;
  if (skinId) {
    const skinArt = getSkinArt(skinId);
    return skinArt && textureExists(skinArt.textureKey) ? { textureKey: skinArt.textureKey, version: skinArt.version } : null;
  }
  const art = getCharacterArt(monsterId);
  if (art && textureExists(art.textureKey)) return { textureKey: art.textureKey, version: art.version };
  const legacyKey = `monster-ai-${monsterId}`;
  return textureExists(legacyKey) ? { textureKey: legacyKey, version: 'legacy' } : null;
}
