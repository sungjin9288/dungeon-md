/**
 * Tribe synergy & element combo system.
 *
 * - Tribe synergy: 2/4/6 monsters of the same tribe → stacking bonuses
 * - Element combo: adjacent rooms with complementary elements → special effects
 */

import type { TribeId, ElementId } from './monsters';

// ─── Synergy Effect ────────────────────────────────────────────────────────────

export interface SynergyEffect {
  atkMult?:  number;   // e.g. 1.10 = +10%
  spdMult?:  number;   // attack speed multiplier
  goldMult?: number;   // gold drop multiplier
  special?:  string;   // special effect ID handled by DungeonScene
}

// ─── Tribe Synergy ─────────────────────────────────────────────────────────────

export interface TribeSynergyTier {
  count:  2 | 4 | 6 | 8;   // 8 = "전설" capstone for a full mono-tribe board
  name:   string;       // Korean display name
  desc:   string;       // Korean description
  effect: SynergyEffect;
}

export interface TribeSynergy {
  tribe:      TribeId;
  tiers:      TribeSynergyTier[];
}

export const TRIBE_SYNERGIES: TribeSynergy[] = [
  {
    tribe: 'dokkaebi',
    tiers: [
      { count: 2, name: '도깨비 협동', desc: '도깨비족 ATK +10%',
        effect: { atkMult: 1.10 } },
      { count: 4, name: '도깨비 광란', desc: '도깨비족 ATK +25%, 공격 범위 +1',
        effect: { atkMult: 1.25, special: 'DOKKAEBI_RANGE_UP' } },
      { count: 6, name: '도깨비 신위', desc: '전원 ATK +40%, 첫타 기절 부여',
        effect: { atkMult: 1.40, special: 'DOKKAEBI_STUN_ALL' } },
      { count: 8, name: '도깨비 군왕', desc: '전설: 전원 ATK +60%, 첫타 기절 유지',
        effect: { atkMult: 1.60, special: 'DOKKAEBI_STUN_ALL' } },
    ],
  },
  {
    tribe: 'gumiho',
    tiers: [
      { count: 2, name: '여우 유혹', desc: '매혹 확률 +5%',
        effect: { special: 'GUMIHO_CHARM_5' } },
      { count: 4, name: '여우 환술', desc: '매혹 확률 +15%, 침략자 속도 -10%',
        effect: { spdMult: 0.90, special: 'GUMIHO_CHARM_15' } },
      { count: 6, name: '구미호 각성', desc: 'ATK +30%, 환상 분신 소환',
        effect: { atkMult: 1.30, special: 'GUMIHO_CLONE' } },
      { count: 8, name: '구미호 천호', desc: '전설: ATK +55%, 환상 분신 유지',
        effect: { atkMult: 1.55, special: 'GUMIHO_CLONE' } },
    ],
  },
  {
    tribe: 'dragon',
    tiers: [
      { count: 2, name: '용의 비늘', desc: '전체 방 피해 감소 10%',
        effect: { special: 'DRAGON_DEF_10' } },
      { count: 4, name: '용의 갑옷', desc: '피해 감소 25%, 화염 면역',
        effect: { special: 'DRAGON_DEF_25_FIRE_IMMUNE' } },
      { count: 6, name: '용의 숨결', desc: 'ATK +40%, 매 웨이브 시작 시 AoE',
        effect: { atkMult: 1.40, special: 'DRAGON_BREATH_AOE' } },
      { count: 8, name: '용제', desc: '전설: ATK +65%, 웨이브 시작 AoE 유지',
        effect: { atkMult: 1.65, special: 'DRAGON_BREATH_AOE' } },
    ],
  },
  {
    tribe: 'underworld',
    tiers: [
      { count: 2, name: '저승 수확', desc: '처치 시 골드 +2',
        effect: { goldMult: 1.20 } },
      { count: 4, name: '저승 계약', desc: '골드 +50%, 부활 확률 10%',
        effect: { goldMult: 1.50, special: 'UNDERWORLD_REVIVE_10' } },
      { count: 6, name: '사신의 낫', desc: 'ATK +35%, 즉사 임계치 +10%',
        effect: { atkMult: 1.35, special: 'UNDERWORLD_EXECUTE_UP' } },
      { count: 8, name: '명계의 군주', desc: '전설: ATK +55%, 즉사 임계치 유지',
        effect: { atkMult: 1.55, special: 'UNDERWORLD_EXECUTE_UP' } },
    ],
  },
  {
    tribe: 'sansin',
    tiers: [
      { count: 2, name: '산신 축복', desc: '전체 회복력 +15%',
        effect: { special: 'SANSIN_HEAL_15' } },
      { count: 4, name: '산신 보호', desc: '회복력 +30%, 방 HP +20%',
        effect: { special: 'SANSIN_HEAL_30_HP_UP' } },
      { count: 6, name: '산신 현현', desc: 'ATK +30%, 자연 재생 (방 HP 자동 회복)',
        effect: { atkMult: 1.30, special: 'SANSIN_REGEN' } },
      { count: 8, name: '산군', desc: '전설: ATK +55%, 자연 재생 유지',
        effect: { atkMult: 1.55, special: 'SANSIN_REGEN' } },
    ],
  },
  {
    tribe: 'sea',
    tiers: [
      { count: 2, name: '해류', desc: '밀어내기 효과 +20%',
        effect: { special: 'SEA_PUSH_20' } },
      { count: 4, name: '해신 파도', desc: '밀어내기 +40%, 침략자 속도 -15%',
        effect: { spdMult: 0.85, special: 'SEA_PUSH_40' } },
      { count: 6, name: '해신 분노', desc: 'ATK +35%, 매 웨이브 쓰나미 AoE',
        effect: { atkMult: 1.35, special: 'SEA_TSUNAMI' } },
      { count: 8, name: '해제', desc: '전설: ATK +60%, 쓰나미 AoE 유지',
        effect: { atkMult: 1.60, special: 'SEA_TSUNAMI' } },
    ],
  },
  {
    tribe: 'mask',
    tiers: [
      { count: 2, name: '탈놀이', desc: '도발 지속시간 +0.5초',
        effect: { special: 'MASK_TAUNT_UP' } },
      { count: 4, name: '신명', desc: 'ATK/SPD +15%, 도발 +1초',
        effect: { atkMult: 1.15, spdMult: 1.15, special: 'MASK_TAUNT_LONG' } },
      { count: 6, name: '축제 광란', desc: '전원 ATK +35%, 적 혼란 효과',
        effect: { atkMult: 1.35, special: 'MASK_CONFUSION' } },
      { count: 8, name: '대탈굿', desc: '전설: 전원 ATK +55%, 적 혼란 유지',
        effect: { atkMult: 1.55, special: 'MASK_CONFUSION' } },
    ],
  },
  {
    tribe: 'moonlight',
    tiers: [
      { count: 2, name: '달빛 은총', desc: '쿨다운 -10%',
        effect: { spdMult: 1.10 } },
      { count: 4, name: '달빛 축복', desc: '쿨다운 -20%, 치유 효과 +20%',
        effect: { spdMult: 1.20, special: 'MOONLIGHT_HEAL_UP' } },
      { count: 6, name: '보름달 각성', desc: 'ATK +35%, 주기적 전체 치유',
        effect: { atkMult: 1.35, special: 'MOONLIGHT_MASS_HEAL' } },
      { count: 8, name: '월령 군주', desc: '전설: ATK +55%, 주기적 전체 치유 유지',
        effect: { atkMult: 1.55, special: 'MOONLIGHT_MASS_HEAL' } },
    ],
  },
  {
    tribe: 'celestial',
    tiers: [
      { count: 2, name: '천상의 가호', desc: '성스러운 피해 +20%',
        effect: { atkMult: 1.20 } },
      { count: 4, name: '천상 군단', desc: '성스러운 피해 +35%, DIVINE_WARD 무시',
        effect: { atkMult: 1.35, special: 'CELESTIAL_PIERCE' } },
      { count: 6, name: '천제의 강림', desc: 'ATK +50%, 웨이브 시작 시 전체 침략자 느리게',
        effect: { atkMult: 1.50, special: 'CELESTIAL_DESCENT' } },
      { count: 8, name: '천제 군림', desc: '전설: ATK +75%, 전체 침략자 둔화 유지',
        effect: { atkMult: 1.75, special: 'CELESTIAL_DESCENT' } },
    ],
  },
];

// ─── Element Combo ─────────────────────────────────────────────────────────────

export interface ElementCombo {
  elements: [ElementId, ElementId];
  name:     string;
  desc:     string;
  effect:   SynergyEffect;
}

export const ELEMENT_COMBOS: ElementCombo[] = [
  {
    elements: ['fire', 'frost'],
    name: '증기 폭발',
    desc: '10초마다 인접 침략자에게 AoE 피해',
    effect: { special: 'STEAM_BURST' },
  },
  {
    elements: ['lightning', 'dark'],
    name: '번개 저주',
    desc: '처치 시 3대상 체인 피해',
    effect: { special: 'CHAIN_CURSE' },
  },
  {
    elements: ['holy', 'dark'],
    name: '균형',
    desc: '모든 방 받는 피해 -15%',
    effect: { special: 'BALANCE_DEF' },
  },
];

// ─── Synergy Calculator ────────────────────────────────────────────────────────

export interface ActiveSynergy {
  tribe:   TribeId;
  count:   number;
  tier:    TribeSynergyTier;
}

export interface ActiveElementCombo {
  combo: ElementCombo;
  locations: Array<[number, number]>;  // room positions triggering this combo
}

/**
 * Calculate active tribe synergies from placed monsters.
 * @param tribeCounts Map of TribeId → number of placed monsters
 */
export function calcTribeSynergies(tribeCounts: Map<TribeId, number>): ActiveSynergy[] {
  const result: ActiveSynergy[] = [];
  for (const syn of TRIBE_SYNERGIES) {
    const count = tribeCounts.get(syn.tribe) ?? 0;
    // Find highest qualifying tier
    let best: TribeSynergyTier | null = null;
    for (const tier of syn.tiers) {
      if (count >= tier.count) best = tier;
    }
    if (best) {
      result.push({ tribe: syn.tribe, count, tier: best });
    }
  }
  return result;
}

/**
 * Check for element combos between adjacent rooms.
 * @param grid Element grid (row × col) — null for empty rooms
 * @param cols Number of columns
 */
export function calcElementCombos(
  grid: (ElementId | null)[][],
  cols: number,
): ActiveElementCombo[] {
  const found: ActiveElementCombo[] = [];
  const rows = grid.length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = grid[r]?.[c];
      if (!el) continue;
      // Check right and down neighbours
      const neighbours: Array<[number, number]> = [];
      if (c + 1 < cols) neighbours.push([r, c + 1]);
      if (r + 1 < rows) neighbours.push([r + 1, c]);

      for (const [nr, nc] of neighbours) {
        const nel = grid[nr]?.[nc];
        if (!nel || nel === el) continue;

        // Check if this pair matches any combo
        for (const combo of ELEMENT_COMBOS) {
          const [e1, e2] = combo.elements;
          if ((el === e1 && nel === e2) || (el === e2 && nel === e1)) {
            // Avoid duplicates
            const exists = found.some(f =>
              f.combo === combo &&
              f.locations.some(([lr, lc]) => lr === r && lc === c),
            );
            if (!exists) {
              found.push({ combo, locations: [[r, c], [nr, nc]] });
            }
          }
        }
      }
    }
  }
  return found;
}

/**
 * Aggregate ATK multiplier from all active synergies.
 */
export function getSynergyAtkMult(synergies: ActiveSynergy[]): number {
  let mult = 1;
  for (const s of synergies) {
    mult *= s.tier.effect.atkMult ?? 1;
  }
  return mult;
}

/**
 * Aggregate SPD multiplier from all active synergies.
 */
export function getSynergySpdMult(synergies: ActiveSynergy[]): number {
  let mult = 1;
  for (const s of synergies) {
    mult *= s.tier.effect.spdMult ?? 1;
  }
  return mult;
}
