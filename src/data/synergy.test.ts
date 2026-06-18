import { describe, it, expect } from 'vitest';
import {
  TRIBE_SYNERGIES,
  ELEMENT_COMBOS,
  calcTribeSynergies,
  calcElementCombos,
  getSynergyAtkMult,
  getSynergySpdMult,
  type ActiveSynergy,
} from './synergy';
import type { TribeId, ElementId } from './monsters';

// ─── TRIBE_SYNERGIES data integrity ──────────────────────────────────────────

describe('TRIBE_SYNERGIES', () => {
  it('defines exactly 9 tribes', () => {
    expect(TRIBE_SYNERGIES).toHaveLength(9);
  });

  it('has unique tribe ids', () => {
    const ids = TRIBE_SYNERGIES.map(s => s.tribe);
    expect(new Set(ids).size).toBe(9);
  });

  it('every tribe has exactly 4 tiers (2/4/6/8)', () => {
    for (const syn of TRIBE_SYNERGIES) {
      expect(syn.tiers, `${syn.tribe} tiers`).toHaveLength(4);
    }
  });

  it('tier counts are always 2, 4, 6, 8 in order', () => {
    for (const syn of TRIBE_SYNERGIES) {
      expect(syn.tiers[0].count).toBe(2);
      expect(syn.tiers[1].count).toBe(4);
      expect(syn.tiers[2].count).toBe(6);
      expect(syn.tiers[3].count).toBe(8);
    }
  });

  it('every tribe has an ×8 "전설" capstone that strictly out-scales its ×6 tier', () => {
    // The 8-tier must carry the 6-tier special forward (so 6→8 never loses an
    // effect) and raise atkMult — and stay within a sane balance cap (≤ 2.0×).
    for (const syn of TRIBE_SYNERGIES) {
      const t6 = syn.tiers[2];
      const t8 = syn.tiers[3];
      expect(t8.count, `${syn.tribe} capstone count`).toBe(8);
      // atkMult rises 6→8
      expect(t8.effect.atkMult ?? 1, `${syn.tribe} ×8 atkMult`).toBeGreaterThan(t6.effect.atkMult ?? 1);
      // capped for balance
      expect(t8.effect.atkMult ?? 1, `${syn.tribe} ×8 atkMult cap`).toBeLessThanOrEqual(2.0);
      // carries the 6-tier special forward (if the 6-tier had one)
      if (t6.effect.special !== undefined) {
        expect(t8.effect.special, `${syn.tribe} ×8 keeps ×6 special`).toBe(t6.effect.special);
      }
    }
  });

  it('every tier has a non-empty name and desc', () => {
    for (const syn of TRIBE_SYNERGIES) {
      for (const tier of syn.tiers) {
        expect(tier.name.length, `${syn.tribe}/${tier.count} name`).toBeGreaterThan(0);
        expect(tier.desc.length, `${syn.tribe}/${tier.count} desc`).toBeGreaterThan(0);
      }
    }
  });

  it('every tier has at least one effect key', () => {
    for (const syn of TRIBE_SYNERGIES) {
      for (const tier of syn.tiers) {
        const keys = Object.keys(tier.effect);
        expect(keys.length, `${syn.tribe}/${tier.count} effect`).toBeGreaterThan(0);
      }
    }
  });

  it('atkMult effects are always > 1 when present', () => {
    for (const syn of TRIBE_SYNERGIES) {
      for (const tier of syn.tiers) {
        if (tier.effect.atkMult !== undefined) {
          expect(tier.effect.atkMult, `${syn.tribe}/${tier.count}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('spdMult effects are always positive (> 0) when present', () => {
    // spdMult can be < 1 (slow enemies) or > 1 (boost ally speed / reduce cooldown)
    for (const syn of TRIBE_SYNERGIES) {
      for (const tier of syn.tiers) {
        if (tier.effect.spdMult !== undefined) {
          expect(tier.effect.spdMult, `${syn.tribe}/${tier.count}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── ELEMENT_COMBOS data integrity ───────────────────────────────────────────

describe('ELEMENT_COMBOS', () => {
  it('defines exactly 3 element combos', () => {
    expect(ELEMENT_COMBOS).toHaveLength(3);
  });

  it('every combo has two distinct elements', () => {
    for (const combo of ELEMENT_COMBOS) {
      expect(combo.elements).toHaveLength(2);
      expect(combo.elements[0]).not.toBe(combo.elements[1]);
    }
  });

  it('every combo has a non-empty name and desc', () => {
    for (const combo of ELEMENT_COMBOS) {
      expect(combo.name.length).toBeGreaterThan(0);
      expect(combo.desc.length).toBeGreaterThan(0);
    }
  });

  it('includes fire+frost, lightning+dark, and holy+dark', () => {
    const pairs = ELEMENT_COMBOS.map(c => c.elements.slice().sort().join('+'));
    expect(pairs).toContain(['fire', 'frost'].sort().join('+'));
    expect(pairs).toContain(['dark', 'lightning'].sort().join('+'));
    expect(pairs).toContain(['dark', 'holy'].sort().join('+'));
  });
});

// ─── calcTribeSynergies ───────────────────────────────────────────────────────

describe('calcTribeSynergies', () => {
  it('returns empty array when no tribes are placed', () => {
    const result = calcTribeSynergies(new Map());
    expect(result).toEqual([]);
  });

  it('returns empty array when count is below minimum threshold (< 2)', () => {
    const counts = new Map<TribeId, number>([['dokkaebi', 1]]);
    const result = calcTribeSynergies(counts);
    expect(result).toHaveLength(0);
  });

  it('activates tier-1 (×2) when exactly 2 of a tribe are placed', () => {
    const counts = new Map<TribeId, number>([['dokkaebi', 2]]);
    const result = calcTribeSynergies(counts);
    expect(result).toHaveLength(1);
    expect(result[0].tribe).toBe('dokkaebi');
    expect(result[0].tier.count).toBe(2);
  });

  it('upgrades to tier-2 (×4) when 4 monsters qualify', () => {
    const counts = new Map<TribeId, number>([['gumiho', 4]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].tier.count).toBe(4);
  });

  it('activates tier-3 (×6) at 6 monsters', () => {
    const counts = new Map<TribeId, number>([['dragon', 6]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].tier.count).toBe(6);
  });

  it('activates tier-3 (×6) at 6–7, not yet the ×8 capstone', () => {
    const counts = new Map<TribeId, number>([['sea', 7]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].tier.count).toBe(6);
  });

  it('activates the ×8 "전설" capstone at 8+ mono-tribe monsters', () => {
    const counts = new Map<TribeId, number>([['sea', 9]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].tier.count).toBe(8);
    // capstone carries the ×6 tsunami special forward
    expect(result[0].tier.effect.special).toBe('SEA_TSUNAMI');
  });

  it('activates multiple tribes simultaneously', () => {
    const counts = new Map<TribeId, number>([
      ['dokkaebi', 2],
      ['gumiho',   4],
      ['dragon',   6],
    ]);
    const result = calcTribeSynergies(counts);
    expect(result).toHaveLength(3);
    const tribes = result.map(r => r.tribe);
    expect(tribes).toContain('dokkaebi');
    expect(tribes).toContain('gumiho');
    expect(tribes).toContain('dragon');
  });

  it('only the highest qualifying tier is returned per tribe', () => {
    // 5 monsters → should pick tier-2 (×4), not tier-1 (×2)
    const counts = new Map<TribeId, number>([['underworld', 5]]);
    const result = calcTribeSynergies(counts);
    expect(result).toHaveLength(1);
    expect(result[0].tier.count).toBe(4);
  });

  it('correctly records the active monster count on the result', () => {
    const counts = new Map<TribeId, number>([['sansin', 3]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].count).toBe(3);
  });
});

// ─── calcElementCombos ────────────────────────────────────────────────────────

describe('calcElementCombos', () => {
  it('returns empty for a grid with no adjacent pairs', () => {
    // Single element, no neighbours
    const grid: (ElementId | null)[][] = [['fire', null]];
    const result = calcElementCombos(grid, 2);
    expect(result).toHaveLength(0);
  });

  it('returns empty when adjacent elements are the same', () => {
    const grid: (ElementId | null)[][] = [['fire', 'fire']];
    const result = calcElementCombos(grid, 2);
    expect(result).toHaveLength(0);
  });

  it('detects fire+frost combo in same row', () => {
    const grid: (ElementId | null)[][] = [['fire', 'frost']];
    const result = calcElementCombos(grid, 2);
    expect(result).toHaveLength(1);
    expect(result[0].combo.elements).toContain('fire');
    expect(result[0].combo.elements).toContain('frost');
  });

  it('detects combo across rows (vertical neighbour)', () => {
    const grid: (ElementId | null)[][] = [['lightning'], ['dark']];
    const result = calcElementCombos(grid, 1);
    expect(result).toHaveLength(1);
    expect(result[0].combo.elements).toContain('lightning');
    expect(result[0].combo.elements).toContain('dark');
  });

  it('detects holy+dark combo', () => {
    const grid: (ElementId | null)[][] = [['holy', 'dark']];
    const result = calcElementCombos(grid, 2);
    expect(result).toHaveLength(1);
    expect(result[0].combo.elements).toContain('holy');
    expect(result[0].combo.elements).toContain('dark');
  });

  it('does not generate combo for unregistered element pairs', () => {
    // fire + holy is not in ELEMENT_COMBOS
    const grid: (ElementId | null)[][] = [['fire', 'holy']];
    const result = calcElementCombos(grid, 2);
    expect(result).toHaveLength(0);
  });

  it('skips null cells', () => {
    const grid: (ElementId | null)[][] = [[null, 'fire', null, 'frost']];
    const result = calcElementCombos(grid, 4);
    // fire and frost are not adjacent (separated by null, null)
    expect(result).toHaveLength(0);
  });

  it('records the correct grid locations', () => {
    const grid: (ElementId | null)[][] = [['fire', 'frost']];
    const result = calcElementCombos(grid, 2);
    const locs = result[0].locations;
    expect(locs).toContainEqual([0, 0]);
    expect(locs).toContainEqual([0, 1]);
  });
});

// ─── getSynergyAtkMult ────────────────────────────────────────────────────────

describe('getSynergyAtkMult', () => {
  it('returns 1.0 for empty synergy list', () => {
    expect(getSynergyAtkMult([])).toBe(1);
  });

  it('returns 1.0 when no synergy has atkMult', () => {
    const synergies: ActiveSynergy[] = [{
      tribe: 'gumiho',
      count: 2,
      tier: { count: 2, name: '여우', desc: '매혹', effect: { special: 'X' } },
    }];
    expect(getSynergyAtkMult(synergies)).toBe(1);
  });

  it('applies a single atkMult correctly', () => {
    const synergies: ActiveSynergy[] = [{
      tribe: 'dokkaebi',
      count: 2,
      tier: { count: 2, name: '도깨비', desc: 'ATK +10%', effect: { atkMult: 1.10 } },
    }];
    expect(getSynergyAtkMult(synergies)).toBeCloseTo(1.10);
  });

  it('multiplies two atkMults together', () => {
    const synergies: ActiveSynergy[] = [
      { tribe: 'dokkaebi', count: 2, tier: { count: 2, name: 'A', desc: '', effect: { atkMult: 1.10 } } },
      { tribe: 'dragon',   count: 4, tier: { count: 4, name: 'B', desc: '', effect: { atkMult: 1.20 } } },
    ];
    expect(getSynergyAtkMult(synergies)).toBeCloseTo(1.10 * 1.20);
  });
});

// ─── getSynergySpdMult ────────────────────────────────────────────────────────

describe('getSynergySpdMult', () => {
  it('returns 1.0 for empty synergy list', () => {
    expect(getSynergySpdMult([])).toBe(1);
  });

  it('returns 1.0 when no synergy has spdMult', () => {
    const synergies: ActiveSynergy[] = [{
      tribe: 'dokkaebi',
      count: 2,
      tier: { count: 2, name: 'A', desc: '', effect: { atkMult: 1.10 } },
    }];
    expect(getSynergySpdMult(synergies)).toBe(1);
  });

  it('applies a single spdMult correctly', () => {
    const synergies: ActiveSynergy[] = [{
      tribe: 'gumiho',
      count: 4,
      tier: { count: 4, name: 'B', desc: '', effect: { spdMult: 0.90 } },
    }];
    expect(getSynergySpdMult(synergies)).toBeCloseTo(0.90);
  });

  it('multiplies two spdMults together', () => {
    const synergies: ActiveSynergy[] = [
      { tribe: 'gumiho',     count: 4, tier: { count: 4, name: 'A', desc: '', effect: { spdMult: 0.90 } } },
      { tribe: 'underworld', count: 4, tier: { count: 4, name: 'B', desc: '', effect: { spdMult: 0.85 } } },
    ];
    expect(getSynergySpdMult(synergies)).toBeCloseTo(0.90 * 0.85);
  });
});

// ─── TRIBE_SYNERGIES — tribe id enumeration ───────────────────────────────────

describe('TRIBE_SYNERGIES — tribe id enumeration', () => {
  const TRIBE_IDS = TRIBE_SYNERGIES.map(s => s.tribe);

  it('contains exactly these 9 tribe ids', () => {
    const expected = ['dokkaebi', 'gumiho', 'dragon', 'underworld', 'sansin', 'sea', 'mask', 'moonlight', 'celestial'];
    for (const id of expected) {
      expect(TRIBE_IDS, `missing tribe "${id}"`).toContain(id);
    }
    expect(TRIBE_IDS).toHaveLength(9);
  });

  it('dokkaebi is in the list', () => expect(TRIBE_IDS).toContain('dokkaebi'));
  it('gumiho is in the list',   () => expect(TRIBE_IDS).toContain('gumiho'));
  it('dragon is in the list',   () => expect(TRIBE_IDS).toContain('dragon'));
  it('celestial is in the list',() => expect(TRIBE_IDS).toContain('celestial'));
  it('moonlight is in the list',() => expect(TRIBE_IDS).toContain('moonlight'));
});

// ─── TRIBE_SYNERGIES — per-tribe effect spot-checks ──────────────────────────

describe('TRIBE_SYNERGIES — per-tribe effect spot-checks', () => {
  const get = (id: string) => TRIBE_SYNERGIES.find(s => s.tribe === id)!;

  // ── dokkaebi ──────────────────────────────────────────────────────────────
  it('dokkaebi tier-1 atkMult is 1.10', () => {
    expect(get('dokkaebi').tiers[0].effect.atkMult).toBeCloseTo(1.10);
  });
  it('dokkaebi tier-3 atkMult is 1.40', () => {
    expect(get('dokkaebi').tiers[2].effect.atkMult).toBeCloseTo(1.40);
  });
  it('dokkaebi tier-3 special is DOKKAEBI_STUN_ALL', () => {
    expect(get('dokkaebi').tiers[2].effect.special).toBe('DOKKAEBI_STUN_ALL');
  });

  // ── gumiho ────────────────────────────────────────────────────────────────
  it('gumiho tier-1 has no atkMult (charm-only)', () => {
    expect(get('gumiho').tiers[0].effect.atkMult).toBeUndefined();
  });
  it('gumiho tier-2 has spdMult 0.90', () => {
    expect(get('gumiho').tiers[1].effect.spdMult).toBeCloseTo(0.90);
  });
  it('gumiho tier-3 atkMult is 1.30', () => {
    expect(get('gumiho').tiers[2].effect.atkMult).toBeCloseTo(1.30);
  });
  it('gumiho tier-3 special is GUMIHO_CLONE', () => {
    expect(get('gumiho').tiers[2].effect.special).toBe('GUMIHO_CLONE');
  });

  // ── dragon ────────────────────────────────────────────────────────────────
  it('dragon tier-3 atkMult is 1.40', () => {
    expect(get('dragon').tiers[2].effect.atkMult).toBeCloseTo(1.40);
  });
  it('dragon tier-3 special is DRAGON_BREATH_AOE', () => {
    expect(get('dragon').tiers[2].effect.special).toBe('DRAGON_BREATH_AOE');
  });

  // ── underworld ────────────────────────────────────────────────────────────
  it('underworld tier-2 goldMult is 1.50', () => {
    expect((get('underworld').tiers[1].effect as { goldMult?: number }).goldMult).toBeCloseTo(1.50);
  });
  it('underworld tier-3 atkMult is 1.35', () => {
    expect(get('underworld').tiers[2].effect.atkMult).toBeCloseTo(1.35);
  });

  // ── sansin ────────────────────────────────────────────────────────────────
  it('sansin tier-1 special is SANSIN_HEAL_15', () => {
    expect(get('sansin').tiers[0].effect.special).toBe('SANSIN_HEAL_15');
  });
  it('sansin tier-3 atkMult is 1.30', () => {
    expect(get('sansin').tiers[2].effect.atkMult).toBeCloseTo(1.30);
  });

  // ── sea ───────────────────────────────────────────────────────────────────
  it('sea tier-2 spdMult is 0.85', () => {
    expect(get('sea').tiers[1].effect.spdMult).toBeCloseTo(0.85);
  });
  it('sea tier-3 atkMult is 1.35 and special is SEA_TSUNAMI', () => {
    const t3 = get('sea').tiers[2];
    expect(t3.effect.atkMult).toBeCloseTo(1.35);
    expect(t3.effect.special).toBe('SEA_TSUNAMI');
  });

  // ── mask ──────────────────────────────────────────────────────────────────
  it('mask tier-2 has both atkMult 1.15 and spdMult 1.15', () => {
    const t2 = get('mask').tiers[1];
    expect(t2.effect.atkMult).toBeCloseTo(1.15);
    expect(t2.effect.spdMult).toBeCloseTo(1.15);
  });
  it('mask tier-3 atkMult is 1.35', () => {
    expect(get('mask').tiers[2].effect.atkMult).toBeCloseTo(1.35);
  });

  // ── moonlight ─────────────────────────────────────────────────────────────
  it('moonlight tier-1 spdMult is 1.10', () => {
    expect(get('moonlight').tiers[0].effect.spdMult).toBeCloseTo(1.10);
  });
  it('moonlight tier-2 spdMult is 1.20', () => {
    expect(get('moonlight').tiers[1].effect.spdMult).toBeCloseTo(1.20);
  });
  it('moonlight tier-3 atkMult is 1.35', () => {
    expect(get('moonlight').tiers[2].effect.atkMult).toBeCloseTo(1.35);
  });

  // ── celestial ─────────────────────────────────────────────────────────────
  it('celestial tier-1 atkMult is 1.20', () => {
    expect(get('celestial').tiers[0].effect.atkMult).toBeCloseTo(1.20);
  });
  it('celestial tier-2 atkMult is 1.35 and special is CELESTIAL_PIERCE', () => {
    const t2 = get('celestial').tiers[1];
    expect(t2.effect.atkMult).toBeCloseTo(1.35);
    expect(t2.effect.special).toBe('CELESTIAL_PIERCE');
  });
  it('celestial tier-3 atkMult is 1.50 and special is CELESTIAL_DESCENT', () => {
    const t3 = get('celestial').tiers[2];
    expect(t3.effect.atkMult).toBeCloseTo(1.50);
    expect(t3.effect.special).toBe('CELESTIAL_DESCENT');
  });
  it('celestial tier-1 atkMult (1.20) is the highest tier-1 atkMult across all tribes', () => {
    const tier1AtkValues = TRIBE_SYNERGIES
      .map(s => s.tiers[0].effect.atkMult ?? 1)
      .filter(v => v > 1);
    const maxTier1Atk = Math.max(...tier1AtkValues);
    expect(get('celestial').tiers[0].effect.atkMult).toBeCloseTo(maxTier1Atk);
  });
});

// ─── TRIBE_SYNERGIES — tier-3 coverage ───────────────────────────────────────

describe('TRIBE_SYNERGIES — tier-3 always has atkMult or special', () => {
  it('every tribe tier-3 has atkMult or special defined', () => {
    for (const syn of TRIBE_SYNERGIES) {
      const t3 = syn.tiers[2];
      const hasEffect = t3.effect.atkMult !== undefined || t3.effect.special !== undefined;
      expect(hasEffect, `${syn.tribe} tier-3 missing atkMult and special`).toBe(true);
    }
  });

  it('atkMult rises monotonically across tiers, peaking at the ×8 capstone', () => {
    for (const syn of TRIBE_SYNERGIES) {
      const atk = syn.tiers.map(t => t.effect.atkMult ?? 1);
      for (let i = 1; i < atk.length; i++) {
        expect(atk[i], `${syn.tribe} tier ${i} atkMult should be >= prior tier`).toBeGreaterThanOrEqual(atk[i - 1]);
      }
      // The ×8 capstone holds the highest atkMult.
      expect(atk[3], `${syn.tribe} ×8 is the peak atkMult`).toBe(Math.max(...atk));
    }
  });
});
