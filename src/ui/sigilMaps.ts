/**
 * Which sigil stands for which game concept. Pure data so tests can check
 * coverage without Phaser; the glyphs themselves live in Sigils.ts.
 */
import type { SigilKind } from './Sigils';
import type { AchievementCategory } from '../data/achievementData';

/** 선조의 의식실 branches (wisdom.ts BRANCH_DEFS ids). */
export const WISDOM_SIGILS: Readonly<Record<string, SigilKind>> = {
  goldHands: 'coin',
  ironWalls: 'wall',
  masterCraft: 'hammer',
  swiftVictory: 'bolt',
  ancestorsWisdom: 'scroll',
  crystalResonance: 'gem',
  guardianBlessing: 'shield',
  eliteTrainer: 'swords',
  celestialBlood: 'spark',
  dungeonFortress: 'pagoda',
  soulHarvest: 'moon',
  forgeEnhancer: 'flask',
};

/** 장식 보관실 relics (decorations.ts DECORATION_DEFS ids). */
export const DECORATION_SIGILS: Readonly<Record<string, SigilKind>> = {
  golden_pot: 'plant',
  bounty_totem: 'totem',
  treasure_chest: 'chest',
  war_banner: 'banner',
  brazier: 'flame',
  guardian_statue: 'statue',
  spike_rack: 'spikes',
  poison_vat: 'flask',
  mana_snare: 'web',
  abyss_crystal: 'orb',
  void_chalice: 'chalice',
  abyss_obelisk: 'obelisk',
};

/** Decoration set tabs (decorations.ts SET_DEFS ids). */
export const DECORATION_SET_SIGILS: Readonly<Record<string, SigilKind>> = {
  bounty: 'plant',
  guardian: 'shield',
  trapper: 'web',
  abyssal: 'orb',
};

/** Room families (wisdom.ts ROOM_SLOT_TYPE_DEFS ids): combat · trap · support · magic. */
export const ROOM_TYPE_SIGILS: Readonly<Record<string, SigilKind>> = {
  combat: 'swords',
  trap: 'web',
  support: 'heart',
  magic: 'orb',
};

/** Materials (fusion.ts MATERIAL_DEFS ids): glyph + tint, replacing coloured-circle emoji. */
export const MATERIAL_SIGILS: Readonly<Record<string, { readonly kind: SigilKind; readonly color: number }>> = {
  dok_fragment: { kind: 'shard', color: 0xd9634a },
  iron_shard: { kind: 'shard', color: 0xa7adb2 },
  fox_fur: { kind: 'fur', color: 0xe08a45 },
  ice_crystal: { kind: 'gem', color: 0x8cc8e8 },
  soul_fragment: { kind: 'wisp', color: 0xb58ae0 },
  shadow_cloth: { kind: 'cloth', color: 0x7d7fa8 },
  old_cloth: { kind: 'cloth', color: 0xb08a5a },
  herb: { kind: 'sprout', color: 0x7ac47a },
  common_ore: { kind: 'ore', color: 0xa89a82 },
  magic_dust: { kind: 'spark', color: 0xe6cf7a },
  boss_essence: { kind: 'orb', color: 0xc07ae0 },
};

/** 명예 기록실: one sigil per category instead of 80 per-record emoji. */
export const ACHIEVEMENT_CATEGORY_SIGILS: Readonly<Record<AchievementCategory, SigilKind>> = {
  combat: 'swords',
  economy: 'coin',
  build: 'hammer',
  endless: 'infinity',
  mastery: 'star',
  collection: 'book',
  growth: 'sprout',
};

export function sigilFor(map: Readonly<Record<string, SigilKind>>, id: string, fallback: SigilKind = 'spark'): SigilKind {
  return map[id] ?? fallback;
}
