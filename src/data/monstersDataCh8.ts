import type { MonsterDef, MonsterId } from './monstersTypes';

// ─── Chapter 8: 원초족 (Primordial Abyss) ────────────────────────────────────
// End-game collectible tier matching the Ch8 campaign (원초의 심연). All passives
// reuse existing PassiveId behaviours (no new combat code). Summonable via the
// gacha (RARITY_POOLS); `eternal_colossus` doubles as the tribe codex reward.

export const MONSTERS_CH8: Partial<Record<MonsterId, MonsterDef>> = {

  abyssal_seer: {
    id: 'abyssal_seer', name: '심연 예언자', emoji: '👁️', chapter: 8,
    type: 'support', roomTypes: ['medicine_hall', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MEDITATIVE_AURA',
    passiveDesc: '인접 방 쿨타임 -15%',
    accentColor: 0x4a2080, unlockStage: 73,
    tribe: 'primordial', element: 'dark', rarityTier: 'R', unlockMethod: 'summon',
  },
  chaos_reaver: {
    id: 'chaos_reaver', name: '혼돈 약탈자', emoji: '🌋', chapter: 8,
    type: 'melee', roomTypes: ['guardian', 'void_forge'],
    baseDamage: 80, attackCooldown: 1200, range: 1,
    passive: 'SHADOW_STEP',
    passiveDesc: '30% 확률로 침략자 공격 회피',
    accentColor: 0x803020, unlockStage: 73,
    tribe: 'primordial', element: 'fire', rarityTier: 'R', unlockMethod: 'summon',
  },
  void_harbinger: {
    id: 'void_harbinger', name: '공허 전령', emoji: '🏹', chapter: 8,
    type: 'ranged', roomTypes: ['tower', 'scroll_library'],
    baseDamage: 82, attackCooldown: 1700, range: 3,
    passive: 'SPECTRAL_BOLT',
    passiveDesc: '투사체가 전열 모든 침략자 관통',
    accentColor: 0x5a2090, unlockStage: 74,
    tribe: 'primordial', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  primordial_shaman: {
    id: 'primordial_shaman', name: '원초 주술사', emoji: '🌀', chapter: 8,
    type: 'magic', roomTypes: ['scroll_library', 'void_forge'],
    baseDamage: 85, attackCooldown: 1900, range: 2,
    passive: 'CHAIN_LIGHTNING',
    passiveDesc: '공격 시 인근 침략자 3체에 40% 연쇄 번개',
    accentColor: 0x6644cc, unlockStage: 75,
    tribe: 'primordial', element: 'lightning', rarityTier: 'E', unlockMethod: 'summon',
  },
  abyssal_warden: {
    id: 'abyssal_warden', name: '심연 수호자', emoji: '🛡️', chapter: 8,
    type: 'melee', roomTypes: ['guardian', 'void_forge'],
    baseDamage: 90, attackCooldown: 1300, range: 1,
    passive: 'DRAGON_SCALE',
    passiveDesc: '받는 던전 피해 20% 감소',
    accentColor: 0x40308a, unlockStage: 76,
    tribe: 'primordial', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  soul_devourer: {
    id: 'soul_devourer', name: '영혼 포식자', emoji: '☠️', chapter: 8,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar'],
    baseDamage: 98, attackCooldown: 1100, range: 1,
    passive: 'SOUL_HARVEST',
    passiveDesc: 'HP 15% 이하 침략자 즉시 처형; 보너스 골드 +5',
    accentColor: 0x702070, unlockStage: 77,
    tribe: 'primordial', element: 'dark', rarityTier: 'E', unlockMethod: 'summon',
  },
  eternal_colossus: {
    id: 'eternal_colossus', name: '영원의 거신', emoji: '🗿', chapter: 8,
    type: 'melee', roomTypes: ['guardian', 'celestial_shrine', 'void_forge'],
    baseDamage: 115, attackCooldown: 1000, range: 2,
    passive: 'KINGS_RALLY',
    passiveDesc: '전 던전 몬스터 ATK·SPD +20% 8초 (쿨 30초)',
    accentColor: 0x9060e0, unlockStage: 78,
    tribe: 'primordial', element: 'dark', rarityTier: 'L', unlockMethod: 'summon',
  },
  primordial_devourer: {
    id: 'primordial_devourer', name: '원초 포식자', emoji: '🌌', chapter: 8,
    type: 'magic', roomTypes: ['scroll_library', 'void_forge'],
    baseDamage: 108, attackCooldown: 1500, range: 3,
    passive: 'TEMPEST',
    passiveDesc: '공격이 같은 열의 모든 침략자에 적중',
    accentColor: 0xaa44ff, unlockStage: 80,
    tribe: 'primordial', element: 'dark', rarityTier: 'L', unlockMethod: 'summon',
  },
};
