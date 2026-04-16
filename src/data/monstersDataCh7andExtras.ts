import type { MonsterDef, MonsterId, MonsterSkin, TribeId } from './monstersTypes';

export const MONSTERS_CH7: Partial<Record<MonsterId, MonsterDef>> = {

  // ─── Chapter 7: 천계족 (Celestial) ──────────────────────────────────────────

  celestial_guardian: {
    id: 'celestial_guardian', name: '천상 수호자', emoji: '⚔️', chapter: 7,
    type: 'melee', roomTypes: ['guardian', 'celestial_shrine'],
    baseDamage: 55, attackCooldown: 1200, range: 1,
    passive: 'DIVINE_TERRITORY',
    passiveDesc: '전 던전 몬스터 공격력·속도 +20%, 골드 +20%',
    accentColor: 0xffd700, unlockStage: 63,
    tribe: 'celestial', element: 'holy', rarityTier: 'R', unlockMethod: 'summon',
  },
  sky_archer: {
    id: 'sky_archer', name: '창공 궁수', emoji: '🏹', chapter: 7,
    type: 'ranged', roomTypes: ['tower', 'celestial_shrine'],
    baseDamage: 38, attackCooldown: 1800, range: 3,
    passive: 'PINNING_SHOT',
    passiveDesc: '20% 확률로 침략자 800ms 속박',
    accentColor: 0xaaddff, unlockStage: 63,
    tribe: 'celestial', element: 'holy', rarityTier: 'R', unlockMethod: 'summon',
  },
  heaven_mage: {
    id: 'heaven_mage', name: '천계 마법사', emoji: '🌟', chapter: 7,
    type: 'magic', roomTypes: ['scroll_library', 'celestial_shrine'],
    baseDamage: 45, attackCooldown: 2000, range: 2,
    passive: 'CHAIN_LIGHTNING',
    passiveDesc: '공격 시 인근 침략자 3체에 40% 연쇄 번개',
    accentColor: 0xccffaa, unlockStage: 64,
    tribe: 'celestial', element: 'lightning', rarityTier: 'R', unlockMethod: 'summon',
  },
  solar_warrior: {
    id: 'solar_warrior', name: '태양 전사', emoji: '☀️', chapter: 7,
    type: 'melee', roomTypes: ['guardian', 'void_forge'],
    baseDamage: 62, attackCooldown: 1300, range: 1,
    passive: 'EMBER_TRAIL',
    passiveDesc: '화염 스택: 10피해/s × 3중첩',
    accentColor: 0xff8800, unlockStage: 65,
    tribe: 'celestial', element: 'fire', rarityTier: 'E', unlockMethod: 'summon',
  },
  divine_healer: {
    id: 'divine_healer', name: '신성 치유자', emoji: '💖', chapter: 7,
    type: 'support', roomTypes: ['medicine_hall', 'celestial_shrine'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MEDITATIVE_AURA',
    passiveDesc: '인접 방 쿨타임 -15%',
    accentColor: 0xffaacc, unlockStage: 66,
    tribe: 'celestial', element: 'holy', rarityTier: 'E', unlockMethod: 'summon',
  },
  starlight_knight: {
    id: 'starlight_knight', name: '별빛 기사', emoji: '🌙', chapter: 7,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 70, attackCooldown: 1100, range: 1,
    passive: 'DUAL_STRIKE',
    passiveDesc: '매 공격 2회 타격 (2타 60% 피해)',
    accentColor: 0x8899ff, unlockStage: 67,
    tribe: 'celestial', element: 'lightning', rarityTier: 'E', unlockMethod: 'summon',
  },
  celestial_sage: {
    id: 'celestial_sage', name: '천상 현인', emoji: '🔮', chapter: 7,
    type: 'magic', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 52, attackCooldown: 2200, range: 3,
    passive: 'SPECTRAL_BOLT',
    passiveDesc: '투사체가 전열 모든 침략자 관통',
    accentColor: 0xccaaff, unlockStage: 70,
    tribe: 'celestial', element: 'holy', rarityTier: 'E', unlockMethod: 'summon',
  },
  god_realm_general: {
    id: 'god_realm_general', name: '신계 대장군', emoji: '👑', chapter: 7,
    type: 'melee', roomTypes: ['guardian', 'celestial_shrine', 'void_forge'],
    baseDamage: 80, attackCooldown: 1000, range: 2,
    passive: 'PACK_CAPTAIN',
    passiveDesc: '같은 족 몬스터 전체 공격력 +15%',
    accentColor: 0xffd700, unlockStage: 72,
    tribe: 'celestial', element: 'holy', rarityTier: 'L', unlockMethod: 'summon',
  },
};

export const SKIN_DATA: MonsterSkin[] = [
  // ─── 도깨비 전사 ────────────────────────────────────────────────────────────
  {
    id: 'dok_warrior_gold',     monsterId: 'dokkaebi_warrior',
    name: '황금 도깨비 전사',  emoji: '👹',
    particleColor: 0xc8921a,   attackEffectColor: 0xffd700,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  {
    id: 'dok_warrior_new_year', monsterId: 'dokkaebi_warrior',
    name: '설날 도깨비 전사',  emoji: '👹🎊',
    particleColor: 0xff4444,   attackEffectColor: 0xff8800,
    idleVariant: 'limited',    rarity: 'limited', gemCost: 300, season: 'winter', available: true,
  },
  // ─── 구미호 수호자 ───────────────────────────────────────────────────────────
  {
    id: 'gumiho_spring',       monsterId: 'gumiho_guardian',
    name: '벚꽃 구미호',       emoji: '🌸🦊',
    particleColor: 0xff88cc,   attackEffectColor: 0xff44aa,
    idleVariant: 'limited',    rarity: 'limited', gemCost: 300, season: 'spring', available: true,
  },
  {
    id: 'gumiho_frost',        monsterId: 'gumiho_guardian',
    name: '서리 구미호',       emoji: '❄️🦊',
    particleColor: 0x88ccff,   attackEffectColor: 0x4488ff,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  // ─── 화염 도깨비 ─────────────────────────────────────────────────────────────
  {
    id: 'flame_blue',          monsterId: 'fire_dokkaebi',
    name: '청염 도깨비',       emoji: '🔥',
    particleColor: 0x4488ff,   attackEffectColor: 0x0044ff,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  // ─── 빙결 산령 ───────────────────────────────────────────────────────────────
  {
    id: 'frost_aurora',        monsterId: 'frost_spirit',
    name: '오로라 산령',       emoji: '🌌❄️',
    particleColor: 0x44ffcc,   attackEffectColor: 0x00ffaa,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  // ─── 신선 도인 ───────────────────────────────────────────────────────────────
  {
    id: 'hermit_golden',       monsterId: 'sage',
    name: '황금 도인',         emoji: '🧙✨',
    particleColor: 0xffd700,   attackEffectColor: 0xffaa00,
    idleVariant: 'normal',     rarity: 'normal',  gemCost: 50,  available: true,
  },
  // ─── 백호 검사 ───────────────────────────────────────────────────────────────
  {
    id: 'tiger_shadow',        monsterId: 'white_tiger',
    name: '흑호 검사',         emoji: '🐯',
    particleColor: 0x222222,   attackEffectColor: 0x444444,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  // ─── 저승사자 ────────────────────────────────────────────────────────────────
  {
    id: 'death_silver',        monsterId: 'death_messenger',
    name: '은빛 저승사자',     emoji: '💀',
    particleColor: 0xcccccc,   attackEffectColor: 0xaaaaaa,
    idleVariant: 'normal',     rarity: 'normal',  gemCost: 50,  available: true,
  },
  // ─── 막내 도깨비 ─────────────────────────────────────────────────────────────
  {
    id: 'little_dok_summer',   monsterId: 'dokkaebi_junior',
    name: '여름 꼬마 도깨비', emoji: '👺🌊',
    particleColor: 0x44aaff,   attackEffectColor: 0x0088ff,
    idleVariant: 'limited',    rarity: 'limited', gemCost: 300, season: 'summer', available: true,
  },
  // ─── 황금 거북이 ─────────────────────────────────────────────────────────────
  {
    id: 'tortoise_jade',       monsterId: 'gold_turtle',
    name: '비취 거북이',       emoji: '🐢',
    particleColor: 0x44ff88,   attackEffectColor: 0x00cc66,
    idleVariant: 'normal',     rarity: 'normal',  gemCost: 50,  available: true,
  },
  // ─── 삼족오 ─────────────────────────────────────────────────────────────────
  {
    id: 'crow_solar',          monsterId: 'three_legged_crow',
    name: '태양 삼족오',       emoji: '☀️🐦',
    particleColor: 0xffaa00,   attackEffectColor: 0xff8800,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
  // ─── 탈 춤꾼 ────────────────────────────────────────────────────────────────
  {
    id: 'dancer_midnight',     monsterId: 'mask_dancer',
    name: '자정 탈 춤꾼',     emoji: '🎪🌙',
    particleColor: 0x440088,   attackEffectColor: 0x8800ff,
    idleVariant: 'special',    rarity: 'rare',    gemCost: 150, available: true,
  },
];

/**
 * Total monster count per tribe (includes all rarities and unlock methods).
 * dokkaebi: 2 existing + 17 new = 19
 * gumiho:   2 existing + 13 new = 15
 * sansin:   4 existing + 7 new  = 11  (gold_turtle, sage, frost_spirit, white_tiger, moon_rabbit_sage → actually recounting below)
 * sea:      1 existing + 8 new  = 9   (sea_god_spear + 8)
 * underworld: 3 existing + 9 new = 12 (death_messenger, ghost_hunter, venom_warrior + 9)
 * mask:     2 existing + 8 new  = 10  (iron_mask, mask_dancer + 8)
 * moonlight: 2 existing + 9 new = 11  (celestial_dancer, three_legged_crow + 9)
 * dragon:   1 existing + 9 new  = 10  (mountain_god + 9)
 *
 * Sansin existing: gold_turtle, sage, frost_spirit, white_tiger, moon_rabbit_sage = 5
 * Sansin new: deer_god, bear_god, mountain_spirit_boy, phoenix, thousand_pine,
 *             mountain_spirit, mountain_god_complete = 7  →  total 12
 */
export const TRIBE_TOTALS: Record<TribeId, number> = {
  dokkaebi:   20,  // 3 existing (dokkaebi_warrior, dokkaebi_junior, fire_dokkaebi) + 17 new
  gumiho:     15,  // 2 existing (gumiho_guardian, fox_shaman) + 13 new
  sansin:     12,  // 5 existing (gold_turtle, sage, frost_spirit, white_tiger, moon_rabbit_sage) + 7 new
  sea:        10,  // 2 existing (sea_god_spear, great_serpent) + 8 new
  underworld: 12,  // 3 existing (death_messenger, ghost_hunter, venom_warrior) + 9 new
  mask:       10,  // 2 existing (iron_mask, mask_dancer) + 8 new
  moonlight:  11,  // 2 existing (celestial_dancer, three_legged_crow) + 9 new
  dragon:     10,  // 1 existing (mountain_god) + 9 new
  celestial:   8,  // 8 new Ch7 monsters
};
