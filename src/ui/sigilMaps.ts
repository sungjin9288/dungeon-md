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
