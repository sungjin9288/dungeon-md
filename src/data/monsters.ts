import type { RoomType } from './rooms';

// ─── Tribe / Element / Rarity / Unlock types ─────────────────────────────────

export type TribeId =
  | 'dokkaebi'
  | 'gumiho'
  | 'dragon'
  | 'underworld'
  | 'sansin'
  | 'sea'
  | 'mask'
  | 'moonlight'
  | 'celestial';

export type ElementId =
  | 'fire'
  | 'frost'
  | 'lightning'
  | 'dark'
  | 'holy';

export type RarityId = 'C' | 'U' | 'R' | 'E' | 'L';

export type UnlockMethod = 'summon' | 'codex_reward' | 'fusion_combination' | 'seasonal';

// ─── Passive IDs ─────────────────────────────────────────────────────────────

export type PassiveId =
  | 'FIRST_STRIKE_STUN'   // first attack each wave: 2× dmg + stun 1500ms
  | 'PACK_FRENZY'         // +10% attack speed per adjacent dokkaebi
  | 'PINNING_SHOT'        // 20% chance to root invader 800ms
  | 'GILDED_KILL'         // +2g per kill in same row
  | 'EMBER_TRAIL'         // burn stacks: 10dmg/s × 3 stacks
  | 'MEDITATIVE_AURA'     // adjacent rooms get -15% cooldown
  // ─── Chapter 2 ───
  | 'FOX_FIRE_CHARM'      // hit charms 1 invader 3s: walks backward
  | 'PERMAFROST'          // hit freezes 2.5s; on death: AoE 60dmg within 80px
  | 'TIGERS_POUNCE'       // first attack: lunge 2 rows, 2× dmg
  | 'TIDE_THRUST'         // each hit: pushes invader back 60px
  | 'WAR_HEX'             // on attack: curse entire column, -30% max hp for 8s
  | 'TAUNTING_ROAR'       // on attack: nearby invaders slow 50% for 3s (120px radius)
  // ─── Chapter 3 ───
  | 'SOUL_HARVEST'        // execute invader at ≤15% HP; +5 bonus gold
  | 'CHAIN_LIGHTNING'     // attack chains to 3 nearby invaders at 40% damage
  | 'SPECTRAL_BOLT'       // projectile passes through all invaders in a line
  | 'WHIRLWIND_DANCE'     // every 5th hit: AoE across full row 150% damage
  | 'VENOM_STACK'         // 5 stacks → paralyzed 2s + 80 burst damage
  // ─── Chapter 4 ───
  | 'ENTRANCING_VEIL'     // global: all invaders speed ×0.88
  | 'SUN_DIVE'            // ignores row; targets closest-to-exit invader
  | 'CONSTRICT'           // 25% per attack: immobilize 3s + 15dmg/s DoT
  | 'LUNAR_RHYTHM'        // every 30s: reset adjacent room cooldowns
  | 'DIVINE_TERRITORY'    // global: all monsters +20% dmg/spd, gold +20%
  // ─── Chapter 6 — new passives ───
  | 'PHOENIX_REVIVAL'     // on death revive once at 50% HP
  | 'DRAGON_FURY'         // ATK doubles below 30% HP
  | 'MOONLIGHT_HEAL'      // heals all ally monsters 5HP/s
  | 'PACK_CAPTAIN'        // all same-tribe monsters in dungeon +15% ATK
  | 'AOE_BOMB'            // every 3rd attack: AoE explosion 80dmg 100px
  | 'DUAL_STRIKE'         // each attack hits twice (2nd hit 60% dmg)
  | 'SHADOW_STEP'         // 30% chance to avoid invader attack
  | 'SHIELD_BASH'         // 25% chance: stun 1.5s + 150% dmg
  | 'DOOM_CURSE'          // on attack: target takes +30% dmg for 10s
  | 'KINGS_RALLY'         // all monsters in dungeon +20% ATK/SPD for 8s (30s cd)
  | 'TEMPEST'             // attacks hit all invaders in column
  | 'GOLDEN_AURA'         // gold drop from kills in this room +3💰
  | 'FOX_CLONE'           // 20% chance: summon illusion copy for 5s
  | 'TAILS_POWER'         // each kill: +5% dmg stacking (max 50%)
  | 'FROST_CHARM'         // on hit: 40% chance freeze 2s + charm 3s
  | 'THUNDER_BOLT'        // every 4th attack: chain lightning 3 targets
  | 'FUSION_SOUL'         // adjacent different-tribe monsters share 10% stats
  | 'DRAGON_SCALE'        // blocks 20% of all incoming dungeon damage
  | 'MOONBEAM'            // heals weakest ally monster 15HP every 5s
  | 'UNDERWORLD_GRASP'    // hit: 15% chance immobilize 4s + 20dmg/s DoT
  | 'SEA_CURRENT'         // all pushback effects in dungeon +30%
  | 'MASK_MIMIC'          // copies the passive effect of adjacent monster
  | 'TRIBE_MASTERY'       // codex completion: tribe-wide stat buff
  | 'SEASONAL_BOON'       // seasonal limited: team-wide special buff
  | 'VENOM_BURST'         // poison stacks → burst damage
  | 'CHARM_GAZE'          // on-hit charm/mesmerize effect
  | 'GHOST_ARROW'         // piercing attacks that ignore armor
  | 'DEATH_RATTLE';       // on-death: one final attack

// ─── Monster IDs ─────────────────────────────────────────────────────────────

export type MonsterId =
  // ─── Chapter 1 ───
  | 'dokkaebi_warrior'
  | 'dokkaebi_junior'
  | 'village_archer'
  | 'gold_turtle'
  | 'fire_dokkaebi'
  | 'sage'
  // ─── Chapter 2 ───
  | 'gumiho_guardian'
  | 'frost_spirit'
  | 'white_tiger'
  | 'sea_god_spear'
  | 'fox_shaman'
  | 'iron_mask'
  // ─── Chapter 3 ───
  | 'death_messenger'
  | 'thunder_hero'
  | 'ghost_hunter'
  | 'mask_dancer'
  | 'venom_warrior'
  // ─── Chapter 4 ───
  | 'celestial_dancer'
  | 'three_legged_crow'
  | 'great_serpent'
  | 'moon_rabbit_sage'
  // ─── Chapter 5 ───
  | 'mountain_god'
  | 'volcanic_warrior'
  | 'storm_archer'
  | 'abyss_mage'
  | 'celestial_healer'
  | 'mask_berserker'
  | 'sea_dragon_lord'
  | 'fox_spirit_elder'
  // ─── Chapter 6 — dokkaebi tribe ───
  | 'thunder_dokkaebi'
  | 'ice_dokkaebi'
  | 'healer_dokkaebi'
  | 'dokkaebi_captain'
  | 'dokkaebi_bomber'
  | 'dokkaebi_duelist'
  | 'poison_dokkaebi'
  | 'shadow_dokkaebi'
  | 'shield_dokkaebi'
  | 'dokkaebi_shaman'
  | 'dokkaebi_king'
  | 'storm_dokkaebi'
  | 'gold_dokkaebi'
  | 'fire_dokkaebi_king'
  | 'black_dragon_dokkaebi'
  | 'dokkaebi_general'
  | 'dokkaebi_god_king'
  // ─── Chapter 6 — gumiho tribe ───
  | 'one_tail_fox'
  | 'three_tail_fox'
  | 'five_tail_fox'
  | 'spring_gumiho'
  | 'summer_gumiho'
  | 'ice_gumiho'
  | 'thunder_gumiho'
  | 'fox_warrior'
  | 'gumiho_queen'
  | 'gumiho_goddess'
  | 'gumiho_archmage'
  | 'celestial_fairy'
  | 'gumiho_demon'
  // ─── Chapter 6 — sansin tribe ───
  | 'deer_god'
  | 'bear_god'
  | 'mountain_spirit_boy'
  | 'phoenix'
  | 'thousand_pine'
  | 'mountain_spirit'
  | 'mountain_god_complete'
  // ─── Chapter 6 — sea tribe ───
  | 'sea_dragon_archer'
  | 'jellyfish_sorcerer'
  | 'sea_general'
  | 'sea_witch'
  | 'shark_warrior'
  | 'kraken_soldier'
  | 'dragon_king_guardian'
  | 'sea_god_complete'
  // ─── Chapter 6 — underworld tribe ───
  | 'skeleton_knight'
  | 'soul_guardian'
  | 'underworld_archer'
  | 'underworld_witch'
  | 'hell_guard'
  | 'yomra_warrior'
  | 'ghost_king'
  | 'spirit_summoner'
  | 'underworld_complete'
  // ─── Chapter 6 — mask tribe ───
  | 'mask_archer'
  | 'bongsan_maskman'
  | 'cheoyong_warrior'
  | 'mask_wizard'
  | 'thunder_mask_warrior'
  | 'glacier_warrior'
  | 'great_mask_god'
  | 'mask_complete'
  // ─── Chapter 6 — moonlight tribe ───
  | 'moonlight_rabbit'
  | 'starlight_fairy'
  | 'crescent_archer'
  | 'moonlight_tiger'
  | 'galaxy_warrior'
  | 'full_moon_sorcerer'
  | 'solar_eclipse_warrior'
  | 'lunar_eclipse_mage'
  | 'moonlight_complete'
  // ─── Chapter 6 — dragon tribe ───
  | 'red_dragon_warrior'
  | 'blue_dragon_guardian'
  | 'gold_dragon_sage'
  | 'black_dragon_assassin'
  | 'white_dragon_healer'
  | 'blue_dragon_archmage'
  | 'banya_guardian'
  | 'dragon_avatar'
  | 'five_dragon_complete'
  // ─── Chapter 7: 천계족 ───
  | 'celestial_guardian'
  | 'sky_archer'
  | 'heaven_mage'
  | 'solar_warrior'
  | 'divine_healer'
  | 'starlight_knight'
  | 'celestial_sage'
  | 'god_realm_general';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MonsterDef {
  id:             MonsterId;
  name:           string;        // Korean display name
  emoji:          string;
  type:           'melee' | 'ranged' | 'magic' | 'support';
  roomTypes:      RoomType[];    // which room types can house this monster
  baseDamage:     number;        // base attack damage (0 = support / no attack)
  attackCooldown: number;        // ms between attacks (0 = non-attacker)
  range:          number;        // row-units of reach (1 = same row, 2 = 2 rows)
  passive:        PassiveId;
  passiveDesc:    string;        // short description for UI
  accentColor:    number;        // Phaser hex for card accent
  unlockStage:    number;        // minimum stage required
  chapter?:       number;        // 1, 2, 3, 4, 5, or 6
  // ─── Extended metadata (Chapter 6+) ───
  tribe?:        TribeId;
  element?:      ElementId;
  rarityTier?:   RarityId;
  unlockMethod?: UnlockMethod;
  season?:       'spring' | 'summer' | 'fall' | 'winter';
}

// ─── All monsters ─────────────────────────────────────────────────────────────

export const MONSTER_DEFS: Record<MonsterId, MonsterDef> = {

  // ─── Chapter 1 ────────────────────────────────────────────────────────────

  dokkaebi_warrior: {
    id: 'dokkaebi_warrior', name: '도깨비 전사', emoji: '👹',
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 20, attackCooldown: 1500, range: 1,
    passive: 'FIRST_STRIKE_STUN',
    passiveDesc: '첫 공격: 2× 피해 + 1.5초 기절',
    accentColor: 0x8b0000, unlockStage: 1,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'C',
  },
  dokkaebi_junior: {
    id: 'dokkaebi_junior', name: '막내 도깨비', emoji: '👺',
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 12, attackCooldown: 1200, range: 1,
    passive: 'PACK_FRENZY',
    passiveDesc: '인접 도깨비 당 공속 +10%',
    accentColor: 0x305030, unlockStage: 3,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'C',
  },
  village_archer: {
    id: 'village_archer', name: '촌 궁수', emoji: '🏹',
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 15, attackCooldown: 2000, range: 2,
    passive: 'PINNING_SHOT',
    passiveDesc: '20% 확률: 0.8초 속박',
    accentColor: 0x2d4a1e, unlockStage: 2,
    element: 'holy', rarityTier: 'C',
  },
  gold_turtle: {
    id: 'gold_turtle', name: '황금 거북이', emoji: '🐢',
    type: 'support', roomTypes: ['gold'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'GILDED_KILL',
    passiveDesc: '같은 행 처치 시 +2💰',
    accentColor: 0xc8921a, unlockStage: 4,
    tribe: 'sansin', element: 'holy', rarityTier: 'U',
  },
  fire_dokkaebi: {
    id: 'fire_dokkaebi', name: '화염 도깨비', emoji: '🔥',
    type: 'magic', roomTypes: ['guardian'],
    baseDamage: 18, attackCooldown: 1500, range: 1,
    passive: 'EMBER_TRAIL',
    passiveDesc: '명중 시 화상 (10/초 × 3스택)',
    accentColor: 0xe05010, unlockStage: 6,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'U',
  },
  sage: {
    id: 'sage', name: '신선 도인', emoji: '🧙',
    type: 'support', roomTypes: ['scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MEDITATIVE_AURA',
    passiveDesc: '인접 방 공속 -15%',
    accentColor: 0x4060a0, unlockStage: 8,
    tribe: 'sansin', element: 'holy', rarityTier: 'U',
  },

  // ─── Chapter 2 ────────────────────────────────────────────────────────────

  gumiho_guardian: {
    id: 'gumiho_guardian', name: '구미호 수호자', emoji: '🦊', chapter: 2,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 22, attackCooldown: 2000, range: 2,
    passive: 'FOX_FIRE_CHARM',
    passiveDesc: '3번째 공격마다 매혹 구슬 발사: 3초 행동 불능',
    accentColor: 0xd06010, unlockStage: 11,
    tribe: 'gumiho', element: 'dark', rarityTier: 'R',
  },
  frost_spirit: {
    id: 'frost_spirit', name: '빙결 산령', emoji: '❄️', chapter: 2,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 18, attackCooldown: 1600, range: 2,
    passive: 'PERMAFROST',
    passiveDesc: '30% 확률 빙결 1.2초; 빙결 사망 시 80px AoE 60피해 + 파열',
    accentColor: 0x40a0c8, unlockStage: 17,
    tribe: 'sansin', element: 'frost', rarityTier: 'R',
  },
  white_tiger: {
    id: 'white_tiger', name: '백호 검사', emoji: '🐯', chapter: 2,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 35, attackCooldown: 1800, range: 1,
    passive: 'TIGERS_POUNCE',
    passiveDesc: '60% 이상 진행한 침략자에게 3× 돌진 (5초 재사용)',
    accentColor: 0xe0e0c0, unlockStage: 12,
    tribe: 'sansin', element: 'lightning', rarityTier: 'R',
  },
  sea_god_spear: {
    id: 'sea_god_spear', name: '해신 창병', emoji: '🔱', chapter: 2,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 20, attackCooldown: 1400, range: 2,
    passive: 'TIDE_THRUST',
    passiveDesc: '4번째 명중마다 경로 8% 밀어냄',
    accentColor: 0x1060a0, unlockStage: 14,
    tribe: 'sea', element: 'frost', rarityTier: 'R',
  },
  fox_shaman: {
    id: 'fox_shaman', name: '여우 무당', emoji: '🪬', chapter: 2,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 0, attackCooldown: 8000, range: 999,
    passive: 'WAR_HEX',
    passiveDesc: '8초마다 체력 최대 침략자에게 저주: 받는 피해 +25%',
    accentColor: 0x8020a0, unlockStage: 15,
    tribe: 'gumiho', element: 'dark', rarityTier: 'R',
  },
  iron_mask: {
    id: 'iron_mask', name: '철갑 탈', emoji: '🎭', chapter: 2,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 25, attackCooldown: 2500, range: 1,
    passive: 'TAUNTING_ROAR',
    passiveDesc: '8초마다 도발: 전체 침략자 2초 정지 + 아군 피해 +30%',
    accentColor: 0x606060, unlockStage: 19,
    tribe: 'mask', element: 'dark', rarityTier: 'R',
  },

  // ─── Chapter 3 ────────────────────────────────────────────────────────────

  death_messenger: {
    id: 'death_messenger', name: '저승사자', emoji: '💀', chapter: 3,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 1,
    passive: 'SOUL_HARVEST',
    passiveDesc: '15% 이하 HP 침략자 즉처형 + 골드 +5',
    accentColor: 0x301050, unlockStage: 21,
    tribe: 'underworld', element: 'dark', rarityTier: 'R',
  },
  thunder_hero: {
    id: 'thunder_hero', name: '벼락 용사', emoji: '⚡', chapter: 3,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 30, attackCooldown: 1500, range: 1,
    passive: 'CHAIN_LIGHTNING',
    passiveDesc: '공격 시 인접 3체에 40% 연쇄 번개',
    accentColor: 0xd4c000, unlockStage: 23,
    element: 'lightning', rarityTier: 'R',
  },
  ghost_hunter: {
    id: 'ghost_hunter', name: '귀신 포수', emoji: '👻', chapter: 3,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 25, attackCooldown: 1800, range: 3,
    passive: 'SPECTRAL_BOLT',
    passiveDesc: '유령 투사체: 직선상 모든 침략자 관통',
    accentColor: 0xd0d0f0, unlockStage: 24,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  mask_dancer: {
    id: 'mask_dancer', name: '탈 춤꾼', emoji: '🎪', chapter: 3,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 20, attackCooldown: 1000, range: 1,
    passive: 'WHIRLWIND_DANCE',
    passiveDesc: '5번째 공격: 행 전체에 150% 회오리',
    accentColor: 0xd04010, unlockStage: 26,
    tribe: 'mask', element: 'fire', rarityTier: 'E',
  },
  venom_warrior: {
    id: 'venom_warrior', name: '독사 무사', emoji: '🐍', chapter: 3,
    type: 'melee', roomTypes: ['guardian', 'trap_corridor'],
    baseDamage: 15, attackCooldown: 1200, range: 1,
    passive: 'VENOM_STACK',
    passiveDesc: '5스택: 2초 마비 + 80 폭발 피해',
    accentColor: 0x306010, unlockStage: 28,
    tribe: 'underworld', element: 'dark', rarityTier: 'R',
  },

  // ─── Chapter 4 ────────────────────────────────────────────────────────────

  celestial_dancer: {
    id: 'celestial_dancer', name: '천녀 무희', emoji: '🪭', chapter: 4,
    type: 'support', roomTypes: ['guardian', 'tower', 'scroll_library', 'gold', 'trap', 'trap_corridor', 'armory', 'medicine_hall', 'spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'ENTRANCING_VEIL',
    passiveDesc: '전체 침략자 이동 속도 −12%',
    accentColor: 0xddaa00, unlockStage: 33,
    tribe: 'moonlight', element: 'holy', rarityTier: 'E',
  },
  three_legged_crow: {
    id: 'three_legged_crow', name: '삼족오', emoji: '🐦‍⬛', chapter: 4,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 28, attackCooldown: 1400, range: 999,
    passive: 'SUN_DIVE',
    passiveDesc: '행 제한 없음; 출구에 가장 가까운 침략자 우선 공격',
    accentColor: 0x111111, unlockStage: 34,
    tribe: 'moonlight', element: 'holy', rarityTier: 'E',
  },
  great_serpent: {
    id: 'great_serpent', name: '구렁이', emoji: '🐍', chapter: 4,
    type: 'melee', roomTypes: ['trap_corridor'],
    baseDamage: 20, attackCooldown: 1000, range: 1,
    passive: 'CONSTRICT',
    passiveDesc: '25% 확률: 3초 속박 + 15피해/초',
    accentColor: 0x224400, unlockStage: 36,
    tribe: 'sea', element: 'dark', rarityTier: 'E',
  },
  moon_rabbit_sage: {
    id: 'moon_rabbit_sage', name: '토끼 달인', emoji: '🐇', chapter: 4,
    type: 'support', roomTypes: ['guardian', 'tower', 'scroll_library', 'gold', 'trap', 'trap_corridor', 'armory', 'medicine_hall', 'spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'LUNAR_RHYTHM',
    passiveDesc: '30초마다 인접 방 쿨타임 즉시 초기화',
    accentColor: 0xddeeff, unlockStage: 38,
    tribe: 'sansin', element: 'holy', rarityTier: 'E',
  },

  // ─── Chapter 5 ────────────────────────────────────────────────────────────

  mountain_god: {
    id: 'mountain_god', name: '산신', emoji: '⛰️', chapter: 5,
    type: 'support', roomTypes: ['spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'DIVINE_TERRITORY',
    passiveDesc: '전체 몬스터 공격+20%, 공속+20%, 골드 수입 +20%',
    accentColor: 0xffcc00, unlockStage: 43,
    tribe: 'dragon', element: 'holy', rarityTier: 'L',
  },
  volcanic_warrior: {
    id: 'volcanic_warrior', name: '화산 전사', emoji: '🌋', chapter: 5,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 28, attackCooldown: 1400, range: 1,
    passive: 'DRAGON_FURY',
    passiveDesc: 'HP 30% 이하 시 ATK 2배 (화산의 분노)',
    accentColor: 0xe04000, unlockStage: 43,
    tribe: 'sansin', element: 'fire', rarityTier: 'E',
  },
  storm_archer: {
    id: 'storm_archer', name: '폭풍 궁수', emoji: '🏹', chapter: 5,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 22, attackCooldown: 1600, range: 3,
    passive: 'THUNDER_BOLT',
    passiveDesc: '4번째 공격마다 연쇄 번개 3체에 전도',
    accentColor: 0xb0b000, unlockStage: 44,
    tribe: 'moonlight', element: 'lightning', rarityTier: 'E',
  },
  abyss_mage: {
    id: 'abyss_mage', name: '심연 마법사', emoji: '🌀', chapter: 5,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 26, attackCooldown: 2000, range: 2,
    passive: 'DOOM_CURSE',
    passiveDesc: '공격 시 저주: 대상 받는 피해 +30% 10초',
    accentColor: 0x4010a0, unlockStage: 46,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  celestial_healer: {
    id: 'celestial_healer', name: '천상 치유사', emoji: '✨', chapter: 5,
    type: 'support', roomTypes: ['spirit_altar', 'medicine_hall'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONLIGHT_HEAL',
    passiveDesc: '전체 아군 몬스터 지속 회복 5HP/s',
    accentColor: 0xf0e060, unlockStage: 47,
    tribe: 'sansin', element: 'holy', rarityTier: 'E',
  },
  mask_berserker: {
    id: 'mask_berserker', name: '탈 광전사', emoji: '🎭', chapter: 5,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 32, attackCooldown: 1200, range: 1,
    passive: 'DUAL_STRIKE',
    passiveDesc: '매 공격: 2회 타격, 2번째 60% 피해',
    accentColor: 0xc04020, unlockStage: 48,
    tribe: 'mask', element: 'fire', rarityTier: 'E',
  },
  sea_dragon_lord: {
    id: 'sea_dragon_lord', name: '해룡왕', emoji: '🐉', chapter: 5,
    type: 'ranged', roomTypes: ['tower', 'dragons_lair'],
    baseDamage: 30, attackCooldown: 2200, range: 4,
    passive: 'TEMPEST',
    passiveDesc: '공격이 같은 열의 모든 침략자에게 적중',
    accentColor: 0x1060c0, unlockStage: 50,
    tribe: 'sea', element: 'frost', rarityTier: 'L',
  },
  fox_spirit_elder: {
    id: 'fox_spirit_elder', name: '구미호 장로', emoji: '🦊', chapter: 5,
    type: 'magic', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 35, attackCooldown: 2000, range: 3,
    passive: 'FOX_CLONE',
    passiveDesc: '20% 확률: 5초 허상 소환 (허상도 공격 가능)',
    accentColor: 0xc06040, unlockStage: 52,
    tribe: 'gumiho', element: 'dark', rarityTier: 'L',
  },

  // ─── Chapter 6 — 도깨비족 (17 new) ───────────────────────────────────────

  thunder_dokkaebi: {
    id: 'thunder_dokkaebi', name: '번개 도깨비', emoji: '⚡', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 14, attackCooldown: 1100, range: 1,
    passive: 'THUNDER_BOLT',
    passiveDesc: '4번째 공격마다 연쇄 번개 3체에 전도',
    accentColor: 0xc0c000, unlockStage: 10,
    tribe: 'dokkaebi', element: 'lightning', rarityTier: 'U',
  },
  ice_dokkaebi: {
    id: 'ice_dokkaebi', name: '얼음 도깨비', emoji: '❄️', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 13, attackCooldown: 1400, range: 1,
    passive: 'FROST_CHARM',
    passiveDesc: '명중 시 30% 확률 빙결 1초',
    accentColor: 0x4080c0, unlockStage: 10,
    tribe: 'dokkaebi', element: 'frost', rarityTier: 'U',
  },
  healer_dokkaebi: {
    id: 'healer_dokkaebi', name: '치유 도깨비', emoji: '💚', chapter: 6,
    type: 'support', roomTypes: ['medicine_hall', 'guardian', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONBEAM',
    passiveDesc: '5초마다 가장 체력이 낮은 아군 몬스터 15HP 회복',
    accentColor: 0x40c060, unlockStage: 12,
    tribe: 'dokkaebi', element: 'holy', rarityTier: 'U',
  },
  dokkaebi_captain: {
    id: 'dokkaebi_captain', name: '도깨비 대장', emoji: '👹', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 26, attackCooldown: 1600, range: 1,
    passive: 'PACK_CAPTAIN',
    passiveDesc: '던전 내 같은 종족 몬스터 ATK +15%',
    accentColor: 0xb03000, unlockStage: 20,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'R',
  },
  dokkaebi_bomber: {
    id: 'dokkaebi_bomber', name: '도깨비 폭격수', emoji: '💣', chapter: 6,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 20, attackCooldown: 2200, range: 3,
    passive: 'AOE_BOMB',
    passiveDesc: '3번째 공격마다 100px AoE 폭발 80피해',
    accentColor: 0xd06000, unlockStage: 22,
    tribe: 'dokkaebi', element: 'lightning', rarityTier: 'R',
  },
  dokkaebi_duelist: {
    id: 'dokkaebi_duelist', name: '도깨비 쌍검사', emoji: '⚔️', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 18, attackCooldown: 1200, range: 1,
    passive: 'DUAL_STRIKE',
    passiveDesc: '매 공격: 2회 타격, 2번째 60% 피해',
    accentColor: 0x503080, unlockStage: 22,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'R',
  },
  poison_dokkaebi: {
    id: 'poison_dokkaebi', name: '독 도깨비', emoji: '☠️', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'trap_corridor'],
    baseDamage: 16, attackCooldown: 1300, range: 1,
    passive: 'VENOM_BURST',
    passiveDesc: '명중 시 독 중첩 (5스택: 100 폭발 피해)',
    accentColor: 0x407020, unlockStage: 24,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'R',
  },
  shadow_dokkaebi: {
    id: 'shadow_dokkaebi', name: '그림자 도깨비', emoji: '🌑', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 22, attackCooldown: 1400, range: 1,
    passive: 'SHADOW_STEP',
    passiveDesc: '30% 확률: 침략자 공격 회피',
    accentColor: 0x301050, unlockStage: 24,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'R',
  },
  shield_dokkaebi: {
    id: 'shield_dokkaebi', name: '방패 도깨비', emoji: '🛡️', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 15, attackCooldown: 2000, range: 1,
    passive: 'SHIELD_BASH',
    passiveDesc: '25% 확률: 1.5초 기절 + 150% 피해',
    accentColor: 0x8090a0, unlockStage: 25,
    tribe: 'dokkaebi', element: 'holy', rarityTier: 'R',
  },
  dokkaebi_shaman: {
    id: 'dokkaebi_shaman', name: '도깨비 주술사', emoji: '🪄', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 28, attackCooldown: 2000, range: 2,
    passive: 'DOOM_CURSE',
    passiveDesc: '공격 시 저주: 대상 받는 피해 +30% 10초',
    accentColor: 0x6020a0, unlockStage: 30,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'E',
  },
  dokkaebi_king: {
    id: 'dokkaebi_king', name: '도깨비 왕', emoji: '👑', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar'],
    baseDamage: 38, attackCooldown: 1800, range: 1,
    passive: 'KINGS_RALLY',
    passiveDesc: '30초마다 도발: 던전 전체 ATK+20%/SPD+20% 8초',
    accentColor: 0xd04000, unlockStage: 33,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'E',
  },
  storm_dokkaebi: {
    id: 'storm_dokkaebi', name: '폭풍 도깨비', emoji: '🌪️', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'guardian'],
    baseDamage: 32, attackCooldown: 1500, range: 2,
    passive: 'TEMPEST',
    passiveDesc: '공격이 같은 열의 모든 침략자에게 적중',
    accentColor: 0xa0a000, unlockStage: 33,
    tribe: 'dokkaebi', element: 'lightning', rarityTier: 'E',
  },
  gold_dokkaebi: {
    id: 'gold_dokkaebi', name: '황금 도깨비', emoji: '💰', chapter: 6,
    type: 'support', roomTypes: ['gold', 'guardian', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'GOLDEN_AURA',
    passiveDesc: '같은 방 처치 시 골드 +3💰',
    accentColor: 0xd4a020, unlockStage: 34,
    tribe: 'dokkaebi', element: 'holy', rarityTier: 'E',
  },
  fire_dokkaebi_king: {
    id: 'fire_dokkaebi_king', name: '불꽃 도깨비 왕', emoji: '🔥', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 42, attackCooldown: 1600, range: 1,
    passive: 'AOE_BOMB',
    passiveDesc: '화염 도깨비 + 도깨비 왕 조합 전용 (범위 화염 폭발)',
    accentColor: 0xe03000, unlockStage: 50,
    tribe: 'dokkaebi', element: 'fire', rarityTier: 'E', unlockMethod: 'fusion_combination',
  },
  black_dragon_dokkaebi: {
    id: 'black_dragon_dokkaebi', name: '흑룡 도깨비', emoji: '🐲', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 55, attackCooldown: 2000, range: 1,
    passive: 'SEASONAL_BOON',
    passiveDesc: '흑룡의 기운 (시즌 한정 특별 기술)',
    accentColor: 0x200030, unlockStage: 50,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'L', unlockMethod: 'seasonal', season: 'fall',
  },
  dokkaebi_general: {
    id: 'dokkaebi_general', name: '도깨비 장군', emoji: '⚔️', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar'],
    baseDamage: 52, attackCooldown: 2200, range: 1,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '도깨비족 도감 완성 보상 (각성 전용 기술)',
    accentColor: 0x300050, unlockStage: 50,
    tribe: 'dokkaebi', element: 'dark', rarityTier: 'L', unlockMethod: 'codex_reward',
  },
  dokkaebi_god_king: {
    id: 'dokkaebi_god_king', name: '도깨비 신왕', emoji: '🌟', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'KINGS_RALLY',
    passiveDesc: '도깨비족 20종 도감 완성 보상 (전설 버프)',
    accentColor: 0xffd700, unlockStage: 55,
    tribe: 'dokkaebi', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 구미호족 (13 new) ───────────────────────────────────────

  one_tail_fox: {
    id: 'one_tail_fox', name: '꼬리 1개 여우', emoji: '🦊', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 10, attackCooldown: 1500, range: 2,
    passive: 'CHARM_GAZE',
    passiveDesc: '명중 시 20% 매혹 1초',
    accentColor: 0xa03010, unlockStage: 5,
    tribe: 'gumiho', element: 'dark', rarityTier: 'C',
  },
  three_tail_fox: {
    id: 'three_tail_fox', name: '꼬리 3개 여우', emoji: '🦊', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 16, attackCooldown: 1800, range: 2,
    passive: 'CHARM_GAZE',
    passiveDesc: '명중 시 30% 매혹 2초',
    accentColor: 0xb04020, unlockStage: 12,
    tribe: 'gumiho', element: 'dark', rarityTier: 'U',
  },
  five_tail_fox: {
    id: 'five_tail_fox', name: '꼬리 5개 여우', emoji: '🦊', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 22, attackCooldown: 2000, range: 2,
    passive: 'TAILS_POWER',
    passiveDesc: '처치 시 피해 +5% 중첩 (최대 50%)',
    accentColor: 0xc05030, unlockStage: 20,
    tribe: 'gumiho', element: 'dark', rarityTier: 'R',
  },
  spring_gumiho: {
    id: 'spring_gumiho', name: '봄 구미호', emoji: '🌸', chapter: 6,
    type: 'support', roomTypes: ['scroll_library', 'spirit_altar', 'medicine_hall'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'SEASONAL_BOON',
    passiveDesc: '봄 시즌 한정 (전체 아군 회복력 +20%)',
    accentColor: 0xf08080, unlockStage: 50,
    tribe: 'gumiho', element: 'holy', rarityTier: 'U', unlockMethod: 'seasonal', season: 'spring',
  },
  summer_gumiho: {
    id: 'summer_gumiho', name: '여름 구미호', emoji: '🌊', chapter: 6,
    type: 'support', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'SEASONAL_BOON',
    passiveDesc: '여름 시즌 한정 (침략자 이동속도 -15%)',
    accentColor: 0x2080c0, unlockStage: 50,
    tribe: 'gumiho', element: 'holy', rarityTier: 'U', unlockMethod: 'seasonal', season: 'summer',
  },
  ice_gumiho: {
    id: 'ice_gumiho', name: '빙설 구미호', emoji: '❄️', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 24, attackCooldown: 2000, range: 2,
    passive: 'FROST_CHARM',
    passiveDesc: '명중 시 40% 확률: 빙결 2초 + 매혹 3초',
    accentColor: 0x4090d0, unlockStage: 22,
    tribe: 'gumiho', element: 'frost', rarityTier: 'R',
  },
  thunder_gumiho: {
    id: 'thunder_gumiho', name: '번개 구미호', emoji: '⚡', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 26, attackCooldown: 1800, range: 2,
    passive: 'THUNDER_BOLT',
    passiveDesc: '4번째 공격마다 연쇄 번개 3체에 전도',
    accentColor: 0xc0a000, unlockStage: 24,
    tribe: 'gumiho', element: 'lightning', rarityTier: 'R',
  },
  fox_warrior: {
    id: 'fox_warrior', name: '여우 전사', emoji: '🦊', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 28, attackCooldown: 1500, range: 1,
    passive: 'DUAL_STRIKE',
    passiveDesc: '매 공격: 2회 타격, 구미호+도깨비 조합 전용',
    accentColor: 0xa06020, unlockStage: 50,
    tribe: 'gumiho', element: 'fire', rarityTier: 'R', unlockMethod: 'fusion_combination',
  },
  gumiho_queen: {
    id: 'gumiho_queen', name: '구미호 여왕', emoji: '👑', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 36, attackCooldown: 2000, range: 3,
    passive: 'FOX_CLONE',
    passiveDesc: '20% 확률: 5초 허상 소환 (허상도 공격 가능)',
    accentColor: 0xc04080, unlockStage: 35,
    tribe: 'gumiho', element: 'dark', rarityTier: 'E',
  },
  gumiho_goddess: {
    id: 'gumiho_goddess', name: '구미호 여신', emoji: '✨', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '구미호족 도감 완성 시 해금 (전체 매혹 확률 +10%)',
    accentColor: 0xffc0a0, unlockStage: 55,
    tribe: 'gumiho', element: 'holy', rarityTier: 'E', unlockMethod: 'codex_reward',
  },
  gumiho_archmage: {
    id: 'gumiho_archmage', name: '구미호 대마법사', emoji: '🔮', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 40, attackCooldown: 2500, range: 3,
    passive: 'DOOM_CURSE',
    passiveDesc: '조합 전용: 강화 저주 (받는 피해 +40% 15초)',
    accentColor: 0x7030b0, unlockStage: 50,
    tribe: 'gumiho', element: 'dark', rarityTier: 'E', unlockMethod: 'fusion_combination',
  },
  celestial_fairy: {
    id: 'celestial_fairy', name: '선녀', emoji: '🧚', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'medicine_hall', 'scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'FUSION_SOUL',
    passiveDesc: '구미호+산신 조합 전용: 인접 이종족 몬스터 스탯 +10% 공유',
    accentColor: 0xf0e8c0, unlockStage: 55,
    tribe: 'gumiho', element: 'holy', rarityTier: 'L', unlockMethod: 'fusion_combination',
  },
  gumiho_demon: {
    id: 'gumiho_demon', name: '구미호 악신', emoji: '😈', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'dragons_lair'],
    baseDamage: 56, attackCooldown: 2200, range: 3,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '구미호족 15종 도감 완성 보상 (공포 마법)',
    accentColor: 0x500080, unlockStage: 55,
    tribe: 'gumiho', element: 'dark', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 산신족 (7 new) ──────────────────────────────────────────

  deer_god: {
    id: 'deer_god', name: '사슴 신', emoji: '🦌', chapter: 6,
    type: 'support', roomTypes: ['medicine_hall', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'DRAGON_SCALE',
    passiveDesc: '아군 몬스터 이동 애니메이션 가속 (피해 반응 -10%)',
    accentColor: 0x90c060, unlockStage: 15,
    tribe: 'sansin', element: 'holy', rarityTier: 'U',
  },
  bear_god: {
    id: 'bear_god', name: '곰 산신', emoji: '🐻', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 28, attackCooldown: 2000, range: 1,
    passive: 'SHIELD_BASH',
    passiveDesc: '25% 확률: 1.5초 기절 + 150% 피해 (강인한 방어)',
    accentColor: 0x704030, unlockStage: 22,
    tribe: 'sansin', element: 'holy', rarityTier: 'R',
  },
  mountain_spirit_boy: {
    id: 'mountain_spirit_boy', name: '산신 도령', emoji: '⛩️', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'medicine_hall'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONBEAM',
    passiveDesc: '30초마다 던전 HP 50 회복',
    accentColor: 0x80c080, unlockStage: 25,
    tribe: 'sansin', element: 'holy', rarityTier: 'R',
  },
  phoenix: {
    id: 'phoenix', name: '봉황', emoji: '🦅', chapter: 6,
    type: 'magic', roomTypes: ['spirit_altar', 'scroll_library'],
    baseDamage: 38, attackCooldown: 2000, range: 2,
    passive: 'PHOENIX_REVIVAL',
    passiveDesc: '사망 시 1회 50% HP로 부활; 부활 시 주변 100px AoE 60dmg',
    accentColor: 0xe06010, unlockStage: 35,
    tribe: 'sansin', element: 'fire', rarityTier: 'E',
  },
  thousand_pine: {
    id: 'thousand_pine', name: '천년 소나무', emoji: '🌲', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'medicine_hall', 'scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONLIGHT_HEAL',
    passiveDesc: '전체 아군 몬스터 지속 회복 5HP/s',
    accentColor: 0x408040, unlockStage: 38,
    tribe: 'sansin', element: 'holy', rarityTier: 'E',
  },
  mountain_spirit: {
    id: 'mountain_spirit', name: '산신령', emoji: '⛩️', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '산신족 도감 완성 보상 (던전 회복력 +20%)',
    accentColor: 0xd4c060, unlockStage: 55,
    tribe: 'sansin', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },
  mountain_god_complete: {
    id: 'mountain_god_complete', name: '산신 완성체', emoji: '🌄', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '산신족 12종 완성 보상 (전설급 산신 가호)',
    accentColor: 0xffd080, unlockStage: 55,
    tribe: 'sansin', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 해신족 (8 new) ──────────────────────────────────────────

  sea_dragon_archer: {
    id: 'sea_dragon_archer', name: '해룡 궁수', emoji: '🏹', chapter: 6,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 16, attackCooldown: 1800, range: 2,
    passive: 'FROST_CHARM',
    passiveDesc: '화살에 빙결 속성 (명중 시 20% 빙결 1.5초)',
    accentColor: 0x2060b0, unlockStage: 12,
    tribe: 'sea', element: 'frost', rarityTier: 'U',
  },
  jellyfish_sorcerer: {
    id: 'jellyfish_sorcerer', name: '해파리 술사', emoji: '🪼', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 14, attackCooldown: 1600, range: 2,
    passive: 'THUNDER_BOLT',
    passiveDesc: '명중 시 전기충격 (0.5초 마비)',
    accentColor: 0x6040c0, unlockStage: 13,
    tribe: 'sea', element: 'frost', rarityTier: 'U',
  },
  sea_general: {
    id: 'sea_general', name: '용궁 장수', emoji: '🐡', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 26, attackCooldown: 1600, range: 1,
    passive: 'PACK_CAPTAIN',
    passiveDesc: '해신족 아군과 같은 방에 있을 때 ATK +20%',
    accentColor: 0x3080a0, unlockStage: 22,
    tribe: 'sea', element: 'frost', rarityTier: 'R',
  },
  sea_witch: {
    id: 'sea_witch', name: '바다 마녀', emoji: '🧜', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 24, attackCooldown: 2200, range: 3,
    passive: 'DOOM_CURSE',
    passiveDesc: '공격 시 저주: 대상 받는 피해 +30% 10초',
    accentColor: 0x204060, unlockStage: 23,
    tribe: 'sea', element: 'dark', rarityTier: 'R',
  },
  shark_warrior: {
    id: 'shark_warrior', name: '상어 전사', emoji: '🦈', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 30, attackCooldown: 1400, range: 1,
    passive: 'DRAGON_FURY',
    passiveDesc: '30% 이하 HP 침략자 공격 시 ATK 2×',
    accentColor: 0x1050a0, unlockStage: 24,
    tribe: 'sea', element: 'frost', rarityTier: 'R',
  },
  kraken_soldier: {
    id: 'kraken_soldier', name: '크라켄 병사', emoji: '🦑', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'trap_corridor'],
    baseDamage: 36, attackCooldown: 2000, range: 1,
    passive: 'UNDERWORLD_GRASP',
    passiveDesc: '명중 시 15%: 4초 속박 + 20피해/초 DoT',
    accentColor: 0x101040, unlockStage: 33,
    tribe: 'sea', element: 'dark', rarityTier: 'E',
  },
  dragon_king_guardian: {
    id: 'dragon_king_guardian', name: '용왕 수호자', emoji: '🐉', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 40, attackCooldown: 2000, range: 1,
    passive: 'DRAGON_SCALE',
    passiveDesc: '던전 HP에 가해지는 모든 피해 -20%',
    accentColor: 0x2060c0, unlockStage: 36,
    tribe: 'sea', element: 'frost', rarityTier: 'E',
  },
  sea_god_complete: {
    id: 'sea_god_complete', name: '해신 완성체', emoji: '👑', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'SEA_CURRENT',
    passiveDesc: '해신족 10종 도감 완성 보상 (밀어내기 효과 +50%)',
    accentColor: 0x40c0d0, unlockStage: 55,
    tribe: 'sea', element: 'frost', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 저승족 (9 new) ──────────────────────────────────────────

  skeleton_knight: {
    id: 'skeleton_knight', name: '해골 기사', emoji: '💀', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 14, attackCooldown: 1600, range: 1,
    passive: 'DEATH_RATTLE',
    passiveDesc: '사망 시 50% 확률: 잔해가 1회 더 공격',
    accentColor: 0x706060, unlockStage: 12,
    tribe: 'underworld', element: 'dark', rarityTier: 'U',
  },
  soul_guardian: {
    id: 'soul_guardian', name: '영혼 수호자', emoji: '💀', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'guardian'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'PHOENIX_REVIVAL',
    passiveDesc: '저승+산신 조합 전용: 처치된 아군 소생 (1회)',
    accentColor: 0xa0a0c0, unlockStage: 50,
    tribe: 'underworld', element: 'holy', rarityTier: 'R', unlockMethod: 'fusion_combination',
  },
  underworld_archer: {
    id: 'underworld_archer', name: '저승 궁수', emoji: '🏹', chapter: 6,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 22, attackCooldown: 1800, range: 3,
    passive: 'GHOST_ARROW',
    passiveDesc: '투사체가 유령 형태: 방어력 무시',
    accentColor: 0x302050, unlockStage: 22,
    tribe: 'underworld', element: 'dark', rarityTier: 'R',
  },
  underworld_witch: {
    id: 'underworld_witch', name: '저승 마녀', emoji: '🧙', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 20, attackCooldown: 2000, range: 2,
    passive: 'DOOM_CURSE',
    passiveDesc: '공격 시 저주: 대상 받는 피해 +30% 10초',
    accentColor: 0x502060, unlockStage: 23,
    tribe: 'underworld', element: 'dark', rarityTier: 'R',
  },
  hell_guard: {
    id: 'hell_guard', name: '저승 문지기', emoji: '⛩️', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar'],
    baseDamage: 34, attackCooldown: 2000, range: 1,
    passive: 'TAUNTING_ROAR',
    passiveDesc: '8초마다 도발: 전체 침략자 2초 정지 + 아군 피해 +30%',
    accentColor: 0x201040, unlockStage: 32,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  yomra_warrior: {
    id: 'yomra_warrior', name: '염라 전사', emoji: '👺', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 36, attackCooldown: 1600, range: 1,
    passive: 'SOUL_HARVEST',
    passiveDesc: '15% 이하 HP 침략자 즉처형 + 골드 +5',
    accentColor: 0x800000, unlockStage: 33,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  ghost_king: {
    id: 'ghost_king', name: '귀왕', emoji: '👑', chapter: 6,
    type: 'magic', roomTypes: ['spirit_altar', 'scroll_library'],
    baseDamage: 38, attackCooldown: 2200, range: 3,
    passive: 'PACK_CAPTAIN',
    passiveDesc: '저승족 아군 모두 ATK +25% (왕의 패기)',
    accentColor: 0x500020, unlockStage: 35,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  spirit_summoner: {
    id: 'spirit_summoner', name: '망자 소환사', emoji: '📿', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 12000, range: 999,
    passive: 'FOX_CLONE',
    passiveDesc: '12초마다 무작위 저승족 유령 소환 (15초 지속)',
    accentColor: 0x403060, unlockStage: 36,
    tribe: 'underworld', element: 'dark', rarityTier: 'E',
  },
  underworld_complete: {
    id: 'underworld_complete', name: '저승 완성체', emoji: '🌟', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '저승족 12종 도감 완성 보상 (처형 임계치 +10%)',
    accentColor: 0x9000c0, unlockStage: 55,
    tribe: 'underworld', element: 'dark', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 탈족 (8 new) ────────────────────────────────────────────

  mask_archer: {
    id: 'mask_archer', name: '탈 궁수', emoji: '🎭', chapter: 6,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 14, attackCooldown: 1600, range: 2,
    passive: 'THUNDER_BOLT',
    passiveDesc: '번개 속성 화살 (명중 시 인접 적 25피해 연쇄)',
    accentColor: 0x605020, unlockStage: 12,
    tribe: 'mask', element: 'lightning', rarityTier: 'U',
  },
  bongsan_maskman: {
    id: 'bongsan_maskman', name: '봉산 탈꾼', emoji: '🎭', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 24, attackCooldown: 1400, range: 1,
    passive: 'TAUNTING_ROAR',
    passiveDesc: '8초마다 도발: 전체 침략자 2초 정지',
    accentColor: 0xa06030, unlockStage: 22,
    tribe: 'mask', element: 'holy', rarityTier: 'R',
  },
  cheoyong_warrior: {
    id: 'cheoyong_warrior', name: '처용 전사', emoji: '🎭', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 26, attackCooldown: 1500, range: 1,
    passive: 'SHIELD_BASH',
    passiveDesc: '처용 춤: 30% 확률 침략자 방향 전환',
    accentColor: 0xb04010, unlockStage: 23,
    tribe: 'mask', element: 'fire', rarityTier: 'R',
  },
  mask_wizard: {
    id: 'mask_wizard', name: '탈 마법사', emoji: '🎭', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 22, attackCooldown: 2000, range: 2,
    passive: 'MASK_MIMIC',
    passiveDesc: '인접 몬스터의 패시브 효과 복사',
    accentColor: 0x503080, unlockStage: 24,
    tribe: 'mask', element: 'dark', rarityTier: 'R',
  },
  thunder_mask_warrior: {
    id: 'thunder_mask_warrior', name: '번개 마스크 전사', emoji: '⚡', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 38, attackCooldown: 1400, range: 1,
    passive: 'CHAIN_LIGHTNING',
    passiveDesc: '탈+번개 도깨비 조합: 공격 시 인접 3체에 40% 연쇄',
    accentColor: 0xc0c000, unlockStage: 50,
    tribe: 'mask', element: 'lightning', rarityTier: 'E', unlockMethod: 'fusion_combination',
  },
  glacier_warrior: {
    id: 'glacier_warrior', name: '빙하 무사', emoji: '❄️', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 36, attackCooldown: 1800, range: 1,
    passive: 'PERMAFROST',
    passiveDesc: '탈+빙결 산령 조합: 명중 시 빙결 + 사망 시 AoE',
    accentColor: 0x60a0d0, unlockStage: 50,
    tribe: 'mask', element: 'frost', rarityTier: 'E', unlockMethod: 'fusion_combination',
  },
  great_mask_god: {
    id: 'great_mask_god', name: '대탈 신', emoji: '🎭', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'guardian'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'KINGS_RALLY',
    passiveDesc: '30초마다 탈 신의 강림: 전체 ATK+20%/SPD+20% 8초',
    accentColor: 0xd4a000, unlockStage: 37,
    tribe: 'mask', element: 'holy', rarityTier: 'E',
  },
  mask_complete: {
    id: 'mask_complete', name: '탈족 완성체', emoji: '🌟', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '탈족 10종 도감 완성 보상 (도발 지속 +1초)',
    accentColor: 0xd4c060, unlockStage: 55,
    tribe: 'mask', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 달빛족 (9 new) ──────────────────────────────────────────

  moonlight_rabbit: {
    id: 'moonlight_rabbit', name: '달빛 토끼', emoji: '🐇', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'medicine_hall'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONLIGHT_HEAL',
    passiveDesc: '전체 아군 몬스터 지속 회복 5HP/s',
    accentColor: 0xd0d0f0, unlockStage: 20,
    tribe: 'moonlight', element: 'holy', rarityTier: 'R',
  },
  starlight_fairy: {
    id: 'starlight_fairy', name: '별빛 선녀', emoji: '🌟', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'scroll_library'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'GOLDEN_AURA',
    passiveDesc: '별빛 가호: 아군 처치 시 골드 +5 보너스',
    accentColor: 0xe0e080, unlockStage: 22,
    tribe: 'moonlight', element: 'holy', rarityTier: 'R',
  },
  crescent_archer: {
    id: 'crescent_archer', name: '초승달 궁수', emoji: '🌙', chapter: 6,
    type: 'ranged', roomTypes: ['tower'],
    baseDamage: 26, attackCooldown: 1800, range: 3,
    passive: 'SPECTRAL_BOLT',
    passiveDesc: '초승달 화살: 직선상 모든 침략자 관통',
    accentColor: 0x4060a0, unlockStage: 24,
    tribe: 'moonlight', element: 'dark', rarityTier: 'R',
  },
  moonlight_tiger: {
    id: 'moonlight_tiger', name: '달빛 호랑이', emoji: '🐯', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 30, attackCooldown: 1600, range: 1,
    passive: 'TIGERS_POUNCE',
    passiveDesc: '60% 이상 진행한 침략자에게 3× 돌진 (5초 재사용)',
    accentColor: 0x8090b0, unlockStage: 25,
    tribe: 'moonlight', element: 'frost', rarityTier: 'R',
  },
  galaxy_warrior: {
    id: 'galaxy_warrior', name: '은하 무사', emoji: '🌌', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 36, attackCooldown: 1500, range: 1,
    passive: 'TEMPEST',
    passiveDesc: '은하의 힘: 공격마다 15% 확률 전체 행 광역 피해',
    accentColor: 0x203080, unlockStage: 33,
    tribe: 'moonlight', element: 'frost', rarityTier: 'E',
  },
  full_moon_sorcerer: {
    id: 'full_moon_sorcerer', name: '보름달 술사', emoji: '🌕', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'spirit_altar'],
    baseDamage: 34, attackCooldown: 2200, range: 3,
    passive: 'LUNAR_RHYTHM',
    passiveDesc: '30초마다 인접 방 쿨타임 즉시 초기화',
    accentColor: 0xf0d060, unlockStage: 34,
    tribe: 'moonlight', element: 'holy', rarityTier: 'E',
  },
  solar_eclipse_warrior: {
    id: 'solar_eclipse_warrior', name: '일식 전사', emoji: '🌑', chapter: 6,
    type: 'melee', roomTypes: ['guardian'],
    baseDamage: 40, attackCooldown: 1600, range: 1,
    passive: 'SHADOW_STEP',
    passiveDesc: '30% 확률: 침략자 공격 회피 + 반격 50% 피해',
    accentColor: 0x100010, unlockStage: 36,
    tribe: 'moonlight', element: 'dark', rarityTier: 'E',
  },
  lunar_eclipse_mage: {
    id: 'lunar_eclipse_mage', name: '월식 마법사', emoji: '🌒', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library'],
    baseDamage: 38, attackCooldown: 2000, range: 2,
    passive: 'WAR_HEX',
    passiveDesc: '8초마다 체력 최대 침략자에게 저주: 받는 피해 +25%',
    accentColor: 0x202040, unlockStage: 37,
    tribe: 'moonlight', element: 'dark', rarityTier: 'E',
  },
  moonlight_complete: {
    id: 'moonlight_complete', name: '달빛 완성체', emoji: '✨', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '달빛족 11종 도감 완성 보상 (신성 피해 +20%)',
    accentColor: 0xe0e0ff, unlockStage: 55,
    tribe: 'moonlight', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

  // ─── Chapter 6 — 용족 (9 new) ────────────────────────────────────────────

  red_dragon_warrior: {
    id: 'red_dragon_warrior', name: '적룡 전사', emoji: '🔴', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 40, attackCooldown: 1600, range: 1,
    passive: 'DRAGON_FURY',
    passiveDesc: 'HP 30% 이하 시 ATK 2배 (분노의 용)',
    accentColor: 0xc02000, unlockStage: 33,
    tribe: 'dragon', element: 'fire', rarityTier: 'E',
  },
  blue_dragon_guardian: {
    id: 'blue_dragon_guardian', name: '청룡 수호자', emoji: '🔵', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'dragons_lair'],
    baseDamage: 36, attackCooldown: 1800, range: 1,
    passive: 'DRAGON_SCALE',
    passiveDesc: '던전 HP에 가해지는 모든 피해 -20%',
    accentColor: 0x1040c0, unlockStage: 34,
    tribe: 'dragon', element: 'frost', rarityTier: 'E',
  },
  gold_dragon_sage: {
    id: 'gold_dragon_sage', name: '황룡 현자', emoji: '🟡', chapter: 6,
    type: 'support', roomTypes: ['spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'GOLDEN_AURA',
    passiveDesc: '같은 방 처치 시 골드 +3 + 용족 전체 ATK +10%',
    accentColor: 0xd4a000, unlockStage: 35,
    tribe: 'dragon', element: 'holy', rarityTier: 'E',
  },
  black_dragon_assassin: {
    id: 'black_dragon_assassin', name: '흑룡 암살자', emoji: '⚫', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'trap_corridor'],
    baseDamage: 42, attackCooldown: 1400, range: 1,
    passive: 'SHADOW_STEP',
    passiveDesc: '30% 확률: 침략자 공격 회피 + 은신 3초',
    accentColor: 0x000020, unlockStage: 35,
    tribe: 'dragon', element: 'dark', rarityTier: 'E',
  },
  white_dragon_healer: {
    id: 'white_dragon_healer', name: '백룡 치유사', emoji: '⚪', chapter: 6,
    type: 'support', roomTypes: ['medicine_hall', 'spirit_altar', 'dragons_lair'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'MOONLIGHT_HEAL',
    passiveDesc: '전체 아군 몬스터 지속 회복 5HP/s (용족 강화)',
    accentColor: 0xe8e8f0, unlockStage: 36,
    tribe: 'dragon', element: 'holy', rarityTier: 'E',
  },
  blue_dragon_archmage: {
    id: 'blue_dragon_archmage', name: '청룡 대마법사', emoji: '🐲', chapter: 6,
    type: 'magic', roomTypes: ['scroll_library', 'dragons_lair'],
    baseDamage: 58, attackCooldown: 2500, range: 4,
    passive: 'CHAIN_LIGHTNING',
    passiveDesc: '공격 시 인접 3체에 40% 연쇄 번개 + 전체 번개 공명',
    accentColor: 0x0040d0, unlockStage: 48,
    tribe: 'dragon', element: 'lightning', rarityTier: 'L',
  },
  banya_guardian: {
    id: 'banya_guardian', name: '반야 수호자', emoji: '🔱', chapter: 6,
    type: 'melee', roomTypes: ['guardian', 'spirit_altar', 'dragons_lair'],
    baseDamage: 55, attackCooldown: 2000, range: 1,
    passive: 'DIVINE_TERRITORY',
    passiveDesc: '전체 몬스터 공격+20%, 공속+20%, 골드 수입 +20%',
    accentColor: 0xd06000, unlockStage: 48,
    tribe: 'dragon', element: 'fire', rarityTier: 'L',
  },
  dragon_avatar: {
    id: 'dragon_avatar', name: '용의 화신', emoji: '🐉', chapter: 6,
    type: 'melee', roomTypes: ['dragons_lair', 'spirit_altar'],
    baseDamage: 60, attackCooldown: 2500, range: 2,
    passive: 'SEASONAL_BOON',
    passiveDesc: '시즌 한정: 용의 화신 강림 (전체 화속성 피해 +30%)',
    accentColor: 0xff4000, unlockStage: 55,
    tribe: 'dragon', element: 'fire', rarityTier: 'L', unlockMethod: 'seasonal', season: 'fall',
  },
  five_dragon_complete: {
    id: 'five_dragon_complete', name: '오룡 완성체', emoji: '🌟', chapter: 6,
    type: 'support', roomTypes: ['dragons_lair', 'spirit_altar'],
    baseDamage: 0, attackCooldown: 0, range: 0,
    passive: 'TRIBE_MASTERY',
    passiveDesc: '용족 10종 도감 완성 보상 (전설 몬스터 ATK +25%)',
    accentColor: 0xffd700, unlockStage: 55,
    tribe: 'dragon', element: 'holy', rarityTier: 'L', unlockMethod: 'codex_reward',
  },

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all monsters that can be placed in this room type at the given stage. */
export function getMonstersForRoom(
  roomType: RoomType,
  unlockedStage: number,
  elementFilter?: ElementId,
): MonsterDef[] {
  return (Object.values(MONSTER_DEFS) as MonsterDef[]).filter(m => {
    if (!m.roomTypes.includes(roomType)) return false;
    if (m.unlockStage > unlockedStage) return false;
    if (elementFilter && m.element !== elementFilter) return false;
    return true;
  });
}

/** Returns all monsters belonging to the given tribe. */
export function getMonstersForTribe(tribe: TribeId): MonsterDef[] {
  return (Object.values(MONSTER_DEFS) as MonsterDef[]).filter(
    m => m.tribe === tribe,
  );
}

// ─── Skin system ──────────────────────────────────────────────────────────────

export interface MonsterSkin {
  id:                string;
  monsterId:         MonsterId;
  name:              string;
  emoji:             string;
  particleColor:     number;
  attackEffectColor: number;
  idleVariant:       'normal' | 'special' | 'limited';
  rarity:            'normal' | 'rare' | 'limited';
  gemCost:           number;
  season?:           'spring' | 'summer' | 'fall' | 'winter';
  available:         boolean;   // false = expired limited skin
}

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

/** Returns the equipped skin for a monster, or null if using default. */
export function getSkinForMonster(
  monsterId: string,
  equippedSkins: Record<string, string>,
): MonsterSkin | null {
  const skinId = equippedSkins[monsterId];
  if (!skinId) return null;
  return SKIN_DATA.find(s => s.id === skinId) ?? null;
}

/** Returns all skins for a given monster. */
export function getSkinsForMonster(monsterId: string): MonsterSkin[] {
  return SKIN_DATA.filter(s => s.monsterId === monsterId);
}

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

// ─── Monster def resolver (MONSTER_DEFS → HYBRID_DEFS fallback) ──────────────

import { HYBRID_DEFS } from './fusion';

export type CombatMonsterDef = {
  baseDamage: number;
  passive?: string;
  type?: string;
  tribe?: string;
  range: number;
  attackCooldown: number;
};

export function resolveMonsterDef(id: string | undefined): CombatMonsterDef | null {
  if (!id) return null;
  const md = MONSTER_DEFS[id as MonsterId];
  if (md) return md as CombatMonsterDef;
  const hd = HYBRID_DEFS[id];
  if (!hd) return null;
  const isMagic = hd.roomTypes.includes('scroll_library') || hd.roomTypes.includes('celestial_shrine');
  return {
    baseDamage: hd.baseDamage,
    passive:    hd.passive,
    type:       isMagic ? 'magic' : 'melee',
    tribe:      undefined,
    range:      isMagic ? 2 : 1,
    attackCooldown: 0,
  };
}
