import type { MonsterDef, MonsterId } from './monstersTypes';

// ─── Chapter 9: 공허족 (Beyond the Void) ─────────────────────────────────────
// Final collectible tier matching the Ch9 campaign (공허 너머). All passives reuse
// existing PassiveId behaviours (no new combat code). Summonable via the gacha
// (RARITY_POOLS); `void_monarch` doubles as the tribe codex reward.

export const MONSTERS_CH9: Partial<Record<MonsterId, MonsterDef>> = {

  void_acolyte: {
    id: 'void_acolyte', name: '공허 추종자', emoji: '🕯️', chapter: 9,
    type: 'support', roomTypes: ['medicine_hall', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONLIGHT_HEAL',
    passiveDesc: '아군 몬스터 전체 5HP/s 회복',
    accentColor: 0x3a1060, unlockStage: 81,
    tribe: 'void', element: 'dark', rarityTier: 'R', unlockMethod: 'summon',
  },
  rift_stalker: {
    id: 'rift_stalker', name: '균열 추적자', emoji: '🌑', chapter: 9,
    type: 'melee', roomTypes: ['guardian', 'void_forge'],
    baseDamage: 85, attackCooldown: 1150, range: 1,
    passive: 'SHADOW_STEP',
    passiveDesc: '30% 확률로 침략자 공격 회피',
    accentColor: 0x4a2080, unlockStage: 81,
    tribe: 'void', element: 'dark', rarityTier: 'R', unlockMethod: 'summon',
  },
  void_archon: {
    id: 'void_archon', name: '공허 집정관', emoji: '🏹', chapter: 9,
    type: 'ranged', roomTypes: ['tower', 'scroll_library'],
    baseDamage: 90, attackCooldown: 1700, range: 3,
    passive: 'GHOST_ARROW',
    passiveDesc: '공격이 방어를 무시하고 관통',
    accentColor: 0x5a30a0, unlockStage: 82,
    tribe: 'void', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  null_sorcerer: {
    id: 'null_sorcerer', name: '무의 술사', emoji: '🌀', chapter: 9,
    type: 'magic', roomTypes: ['scroll_library', 'void_forge'],
    baseDamage: 94, attackCooldown: 1900, range: 2,
    passive: 'DOOM_CURSE',
    passiveDesc: '공격 시 대상 받는 피해 +30% 10초',
    accentColor: 0x6644cc, unlockStage: 84,
    tribe: 'void', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  abyss_titan: {
    id: 'abyss_titan', name: '심연 거신', emoji: '🗿', chapter: 9,
    type: 'melee', roomTypes: ['guardian', 'void_forge'],
    baseDamage: 102, attackCooldown: 1300, range: 1,
    passive: 'DRAGON_SCALE',
    passiveDesc: '받는 던전 피해 20% 감소',
    accentColor: 0x40308a, unlockStage: 85,
    tribe: 'void', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  soul_reaver: {
    id: 'soul_reaver', name: '영혼 약탈자', emoji: '☠️', chapter: 9,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar'],
    baseDamage: 108, attackCooldown: 1100, range: 1,
    passive: 'SOUL_HARVEST',
    passiveDesc: 'HP 15% 이하 침략자 즉시 처형; 보너스 골드 +5',
    accentColor: 0x702090, unlockStage: 87,
    tribe: 'void', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  void_monarch: {
    id: 'void_monarch', name: '공허 군왕', emoji: '👑', chapter: 9,
    type: 'melee', roomTypes: ['guardian', 'celestial_shrine', 'void_forge'],
    baseDamage: 128, attackCooldown: 1000, range: 2,
    passive: 'PHOENIX_REVIVAL',
    passiveDesc: '사망 시 1회 50% HP로 부활',
    accentColor: 0x9060e0, unlockStage: 88,
    tribe: 'void', element: 'dark', rarityTier: 'L', unlockMethod: 'summon',
  },
  oblivion_devourer: {
    id: 'oblivion_devourer', name: '망각의 포식자', emoji: '🌌', chapter: 9,
    type: 'magic', roomTypes: ['scroll_library', 'void_forge'],
    baseDamage: 120, attackCooldown: 1500, range: 3,
    passive: 'TEMPEST',
    passiveDesc: '공격이 같은 열의 모든 침략자에 적중',
    accentColor: 0xbb55ff, unlockStage: 90,
    tribe: 'void', element: 'dark', rarityTier: 'L', unlockMethod: 'summon',
  },
};
