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

/**
 * Emoji still passed as icon strings by shared row/card renderers (addInfoRow
 * etc.) → the sigil drawn in their place. Unmapped strings (⚔, ◆, ✦ …) are
 * already typographic glyphs and keep rendering as text.
 */
export const EMOJI_SIGILS: Readonly<Record<string, { readonly kind: SigilKind; readonly color: number }>> = {
  '💰': { kind: 'coin', color: 0xe8c25a },
  '✨': { kind: 'spark', color: 0xe8c25a },
  '💎': { kind: 'gem', color: 0x7fd3c4 },
  '💠': { kind: 'gem', color: 0x8fb8f0 },
  '⚒': { kind: 'hammer', color: 0xd08a52 },
  '🔧': { kind: 'hammer', color: 0xd08a52 },
  '🔥': { kind: 'flame', color: 0xef846d },
  '⚡': { kind: 'bolt', color: 0xe8c25a },
  '🔮': { kind: 'orb', color: 0xb58ae0 },
  '🛡️': { kind: 'shield', color: 0x9fb4c8 },
  '🛡': { kind: 'shield', color: 0x9fb4c8 },
  '📜': { kind: 'scroll', color: 0xd8c08a },
  '🏰': { kind: 'wall', color: 0xb8a88a },
  '💚': { kind: 'heart', color: 0x76c6a0 },
  '👹': { kind: 'skull', color: 0xef846d },
  '❄': { kind: 'snow', color: 0xa8d8f0 },
  '❄️': { kind: 'snow', color: 0xa8d8f0 },
  '🕸': { kind: 'web', color: 0xb8a88a },
  '🏆': { kind: 'chalice', color: 0xe8c25a },
  '⭐': { kind: 'star', color: 0xe8c25a },
  '🔓': { kind: 'lock', color: 0xe8c25a },
  '🎯': { kind: 'target', color: 0xef846d },
  '📅': { kind: 'calendar', color: 0xd8c08a },
  '✅': { kind: 'star', color: 0x76c6a0 },
  '👑': { kind: 'crown', color: 0xe8c25a },
  '⚔': { kind: 'swords', color: 0xd8c08a },
  '⚔️': { kind: 'swords', color: 0xd8c08a },
  '🛠': { kind: 'hammer', color: 0xd08a52 },
  '🌀': { kind: 'orb', color: 0xb58ae0 },
};

/** Active skills (barracks.ts ACTIVE_SKILLS ids) → sigil + the skill's VFX colour. */
export const ACTIVE_SKILL_SIGILS: Readonly<Record<string, { readonly kind: SigilKind; readonly color: number }>> = {
  fire_burst: { kind: 'flame', color: 0xff8a4a },
  ice_arrow: { kind: 'snow', color: 0x88ddff },
  lightning: { kind: 'bolt', color: 0xfff27a },
  poison_cloud: { kind: 'flask', color: 0x7cff64 },
  heavy_strike: { kind: 'hammer', color: 0xff9a35 },
  fortress: { kind: 'wall', color: 0x8acbff },
  heal_room: { kind: 'heart', color: 0x5cff9b },
  shield: { kind: 'shield', color: 0xaab7ff },
  gold_rush: { kind: 'coin', color: 0xffdf6e },
  speed_up: { kind: 'infinity', color: 0x44ffcc },
  summon_ghost: { kind: 'wisp', color: 0xcc88ff },
  timestop: { kind: 'moon', color: 0xffffff },
  curse_all: { kind: 'orb', color: 0x9944ff },
  healing_rain: { kind: 'sprout', color: 0x44ccff },
  rage: { kind: 'skull', color: 0xff5555 },
  meteor: { kind: 'star', color: 0xff6644 },
  emergency_repair: { kind: 'hammer', color: 0x66ddff },
  war_cry: { kind: 'banner', color: 0xff6644 },
};


/** Endless-run modifiers (endlessModifiers.ts ENDLESS_MODIFIERS ids). */
export const ENDLESS_MODIFIER_SIGILS: Readonly<Record<string, SigilKind>> = {
  swift: 'bolt', armored: 'shield', swarm: 'web', elite: 'crown', frenzy: 'flame',
  relentless: 'moon', glacial: 'snow', blitz: 'spark', golden: 'coin', juggernaut: 'statue',
  tempest: 'orb', cursed: 'skull', glass_cannon: 'shard', vanguard: 'swords', treasure: 'chest',
  doomtide: 'wave', phantom: 'wisp',
};

/** Wave events (waveEvents.ts WAVE_EVENTS types). */
export const WAVE_EVENT_SIGILS: Readonly<Record<string, SigilKind>> = {
  merchant: 'coin', supply: 'chest', curse: 'skull', rally: 'banner', fog: 'wisp',
  void_storm: 'orb', ancient_blessing: 'spark', crimson_curse: 'flame', gold_vein: 'ore',
  raiders: 'swords', guardian_rite: 'shield', unsealing: 'lock', time_warp: 'infinity',
};
