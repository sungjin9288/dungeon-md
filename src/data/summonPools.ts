import type { GameState, SummonRarity } from './wisdom';
import type { MonsterId } from './monsters';

// ─── Summon type definitions ──────────────────────────────────────────────────

export type SummonType = 'normal' | 'special' | 'soul' | 'friendship';

export interface SummonTypeDef {
  id:       SummonType;
  name:     string;
  icon:     string;
  cost1:    number;
  cost10:   number | null;
  currency: 'gems' | 'soul' | 'fp';
  bgColor:  number;
  border:   number;
  accent:   string;
  hasPity:  boolean;
  pityRarity?: string;
  desc:     string;
}

// Card colours follow the dungeon palette (spirit-fire blue, vermilion seal, jade, amber)
// rather than the neon violet/pink/mint/orange that read as a generic gacha skin.
export const SUMMON_TYPE_DEFS: readonly SummonTypeDef[] = [
  {
    id: 'normal',     name: '일반 소환',  icon: '🌀',
    cost1: 30,  cost10: 250, currency: 'gems',
    bgColor: 0x0c1122, border: 0x5b7fd6, accent: '#a9c0f0',   // 도깨비불 청색
    hasPity: true, pityRarity: 'Epic',
    desc: '에픽 천장 50회',
  },
  {
    id: 'special',    name: '특별 소환',  icon: '⭐',
    cost1: 50,  cost10: 450, currency: 'gems',
    bgColor: 0x1c0a07, border: 0xd4553a, accent: '#f2a58a',   // 주홍 인장
    hasPity: true, pityRarity: 'Legend',
    desc: '전설 천장 80회',
  },
  {
    id: 'soul',       name: '영혼 소환',  icon: '💠',
    cost1: 50,  cost10: null, currency: 'soul',
    bgColor: 0x071610, border: 0x3fae8a, accent: '#9ad9c0',   // 옥
    hasPity: false,
    desc: '미보유 몬스터만',
  },
  {
    id: 'friendship', name: '우정 소환',  icon: '🤝',
    cost1: 0,   cost10: null, currency: 'fp',
    bgColor: 0x1a1206, border: 0xc9953e, accent: '#e8cc8e',   // 호박
    hasPity: false,
    desc: '무료 1회/일',
  },
];

// ─── Rarity tables ────────────────────────────────────────────────────────────

export type RecruitSummonType = 'friendship' | 'soul' | 'normal';

function summonCost(type: SummonType): number {
  return SUMMON_TYPE_DEFS.find(def => def.id === type)?.cost1 ?? Infinity;
}

/**
 * Cheapest single pull the player can make right now, or null. Guidance uses it
 * to send a player with empty guardian slots and no free guardian to 소환
 * instead of to a placement tray with nothing to place.
 */
export function getAffordableSummonType(
  state: Readonly<Pick<GameState, 'lastFriendSummon' | 'soulCrystals' | 'gems'>>,
  today: string = new Date().toISOString().slice(0, 10),
): RecruitSummonType | null {
  if (state.lastFriendSummon !== today) return 'friendship';
  if ((state.soulCrystals ?? 0) >= summonCost('soul')) return 'soul';
  if ((state.gems ?? 0) >= summonCost('normal')) return 'normal';
  return null;
}

export const RARITY_RATES: Record<SummonType, number[]> = {
  normal:     [50, 28, 16, 4.5, 1.5],  // C/U/R/E/L — 100종 풀 기준
  special:    [0,  25, 42, 27,  6],    // 고등급 위주
  soul:       [0,  25, 42, 27,  6],    // 동일
  friendship: [55, 45, 0,  0,   0],    // 무료: C/U만
};

export const RARITIES: SummonRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_STARS   = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
export const RARITY_COLORS  = [0xaaaaaa, 0x44aaff, 0xffdd44, 0xcc44ff, 0xff8844];
export const RARITY_CSS     = ['#aaaaaa', '#44aaff', '#ffdd44', '#cc44ff', '#ff8844'];
export const RARITY_KO      = ['일반', '고급', '희귀', '에픽', '전설'];
export const SC_COMP        = [5, 15, 40, 100, 300];

export const RARITY_POOLS: Record<SummonRarity, MonsterId[]> = {
  // ─── Common (4종) ────────────────────────────────────────────────────────
  common: [
    'dokkaebi_warrior', 'dokkaebi_junior', 'village_archer', 'one_tail_fox',
  ],
  // ─── Uncommon (12종) ─────────────────────────────────────────────────────
  uncommon: [
    'gold_turtle', 'fire_dokkaebi', 'sage',
    'thunder_dokkaebi', 'ice_dokkaebi', 'healer_dokkaebi', 'three_tail_fox',
    'deer_god', 'sea_dragon_archer', 'jellyfish_sorcerer',
    'skeleton_knight', 'mask_archer',
  ],
  // ─── Rare (32종) ─────────────────────────────────────────────────────────
  rare: [
    // Ch1–3 originals
    'gumiho_guardian', 'frost_spirit', 'white_tiger', 'sea_god_spear',
    'fox_shaman', 'iron_mask', 'death_messenger', 'thunder_hero', 'venom_warrior',
    // Ch6 — 도깨비족
    'dokkaebi_captain', 'dokkaebi_bomber', 'dokkaebi_duelist',
    'poison_dokkaebi', 'shadow_dokkaebi', 'shield_dokkaebi',
    // Ch6 — 구미호족
    'five_tail_fox', 'ice_gumiho', 'thunder_gumiho',
    // Ch6 — 산신족
    'bear_god', 'mountain_spirit_boy',
    // Ch6 — 해신족
    'sea_general', 'sea_witch', 'shark_warrior',
    // Ch6 — 저승족
    'underworld_archer', 'underworld_witch',
    // Ch6 — 탈족
    'bongsan_maskman', 'cheoyong_warrior', 'mask_wizard',
    // Ch6 — 달빛족
    'moonlight_rabbit', 'starlight_fairy', 'crescent_archer', 'moonlight_tiger',
    // Ch7 — 천상족
    'celestial_guardian', 'sky_archer', 'heaven_mage',
    // Ch8 — 원초족
    'abyssal_seer', 'chaos_reaver',
    // Ch9 — 공허족
    'void_acolyte', 'rift_stalker',
  ],
  // ─── Epic (29종) ─────────────────────────────────────────────────────────
  epic: [
    // Ch3–4 originals
    'ghost_hunter', 'mask_dancer', 'celestial_dancer', 'three_legged_crow',
    'great_serpent', 'moon_rabbit_sage',
    // Ch5
    'volcanic_warrior', 'storm_archer', 'abyss_mage', 'celestial_healer', 'mask_berserker',
    // Ch6 — 도깨비족
    'dokkaebi_shaman', 'dokkaebi_king', 'storm_dokkaebi', 'gold_dokkaebi',
    // Ch6 — 구미호족
    'gumiho_queen',
    // Ch6 — 산신족
    'phoenix', 'thousand_pine',
    // Ch6 — 해신족
    'kraken_soldier', 'dragon_king_guardian', 'tide_leviathan',
    // Ch6 — 저승족
    'hell_guard', 'yomra_warrior', 'ghost_king', 'spirit_summoner',
    // Ch6 — 탈족
    'great_mask_god',
    // Ch6 — 달빛족
    'galaxy_warrior', 'full_moon_sorcerer', 'solar_eclipse_warrior', 'lunar_eclipse_mage',
    // Ch6 — 용족
    'red_dragon_warrior', 'blue_dragon_guardian', 'gold_dragon_sage',
    'black_dragon_assassin', 'white_dragon_healer', 'twilight_dragon',
    // Ch7 — 천상족
    'solar_warrior', 'divine_healer', 'starlight_knight', 'celestial_sage',
    // Ch8 — 원초족
    'void_harbinger', 'primordial_shaman', 'abyssal_warden', 'soul_devourer',
    // Ch9 — 공허족
    'void_archon', 'null_sorcerer', 'abyss_titan', 'soul_reaver',
  ],
  // ─── Legendary (3종) ─────────────────────────────────────────────────────
  legendary: [
    'mountain_god', 'blue_dragon_archmage', 'banya_guardian',
    // Ch5
    'sea_dragon_lord', 'fox_spirit_elder',
    // Ch7 — 천상족
    'god_realm_general', 'empyrean_sovereign',
    // Ch8 — 원초족
    'eternal_colossus', 'primordial_devourer',
    // Ch9 — 공허족
    'void_monarch', 'oblivion_devourer',
  ],
};

// ─── Utility ──────────────────────────────────────────────────────────────────

export function rollRarity(rates: number[]): number {
  let r = Math.random() * 100;
  for (let i = 0; i < rates.length; i++) {
    r -= rates[i];
    if (r <= 0) return i;
  }
  // fallback: last non-zero index
  let last = 0;
  for (let j = 0; j < rates.length; j++) { if (rates[j] > 0) last = j; }
  return last;
}
