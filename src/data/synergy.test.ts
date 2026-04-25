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

  it('every tribe has exactly 3 tiers', () => {
    for (const syn of TRIBE_SYNERGIES) {
      expect(syn.tiers, `${syn.tribe} tiers`).toHaveLength(3);
    }
  });

  it('tier counts are always 2, 4, 6 in order', () => {
    for (const syn of TRIBE_SYNERGIES) {
      expect(syn.tiers[0].count).toBe(2);
      expect(syn.tiers[1].count).toBe(4);
      expect(syn.tiers[2].count).toBe(6);
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

  it('activates tier-3 even when count exceeds 6', () => {
    const counts = new Map<TribeId, number>([['sea', 9]]);
    const result = calcTribeSynergies(counts);
    expect(result[0].tier.count).toBe(6);
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
