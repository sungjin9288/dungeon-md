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
  'dokkaebi_bomber',
  'dokkaebi_captain',
  'dokkaebi_duelist',
  'dokkaebi_king',
  'dokkaebi_shaman',
  'healer_dokkaebi',
  'ice_dokkaebi',
  'poison_dokkaebi',
  'shadow_dokkaebi',
  'shield_dokkaebi',
  'storm_dokkaebi',
  'thunder_dokkaebi',
  'gold_dokkaebi',
  'fire_dokkaebi_king',
  'black_dragon_dokkaebi',
  'dokkaebi_general',
  'dokkaebi_god_king',
  'venom_warrior',
  'abyss_mage',
  'skeleton_knight',
  'soul_guardian',
  'underworld_witch',
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
  '천상 수호자': 'celestial_guardian',
} as const);

/** Chapter villains in cinematics → boss invader type (their own boss cutout). */
const SPEAKER_BOSS = Object.freeze({
  '구미호 여왕': 'fox_queen',
  '용왕': 'dragon_king',
  '저승왕 사자': 'death_emissary',
  '삼신 파괴자': 'three_god_destroyer',
  '영원의 황제': 'eternal_emperor',
  '천제': 'god_emperor',
  '원초신': 'primordial_titan',
  '공허 군주': 'void_sovereign',
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
 * procedural palette portrait. Appended by scripts/register-ritual-v2.mjs --skins.
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

/**
 * Ritual-v2 boss cutouts (invader boss types). A boss without an entry keeps the
 * emoji/seal fallback. Appended by scripts/register-ritual-v2.mjs --bosses.
 */
const BOSS_ART_IDS: readonly string[] = [
];

export function getBossArt(bossType: unknown): CharacterArt | null {
  if (typeof bossType !== 'string' || !BOSS_ART_IDS.includes(bossType)) return null;
  return {
    monsterId: bossType as MonsterId,
    version: 'ritual-v2',
    textureKey: `boss-ritual-v2-${bossType}`,
    path: `/assets/monsters/ritual-v2/bosses/${bossType}.webp`,
  };
}

/** Streamable art by id: a monster cutout, else a skin cutout, else a boss cutout. */
export function getStreamableArt(id: unknown): CharacterArt | null {
  return getCharacterArt(id) ?? getSkinArt(id) ?? getBossArt(id);
}

/** Streamer id for a story speaker (guardian or boss), or null when none is mapped. */
export function getSpeakerArtId(speaker: unknown): string | null {
  if (typeof speaker !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(SPEAKER_ART, speaker)) return SPEAKER_ART[speaker as keyof typeof SPEAKER_ART];
  if (Object.prototype.hasOwnProperty.call(SPEAKER_BOSS, speaker)) return SPEAKER_BOSS[speaker as keyof typeof SPEAKER_BOSS];
  return null;
}

/** Loaded art for a story speaker: guardian (with legacy fallback) or boss cutout. */
export function selectSpeakerArtSource(
  speaker: unknown,
  textureExists: (key: string) => boolean,
): CharacterArtSource | null {
  if (typeof speaker === 'string' && Object.prototype.hasOwnProperty.call(SPEAKER_ART, speaker)) {
    return selectCharacterArtSource(SPEAKER_ART[speaker as keyof typeof SPEAKER_ART], textureExists);
  }
  const boss = getBossArt(getSpeakerArtId(speaker));
  return boss && textureExists(boss.textureKey) ? { textureKey: boss.textureKey, version: boss.version } : null;
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
