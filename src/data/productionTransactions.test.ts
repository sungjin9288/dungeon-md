/**
 * Unit tests for productionTransactions — build / upgrade facilities.
 * Pure GameState transitions (no Phaser).
 */

import { describe, it, expect } from 'vitest';
import { buildOrUpgradeFacility } from './productionTransactions';
import { FACILITY_DEFS, facilityUpgradeCost } from './production';
import { loadGameState, type GameState } from './wisdom';

function makeGs(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

const FAC_ID = 'mine';
const mineDef = FACILITY_DEFS[FAC_ID];
const buildCost = facilityUpgradeCost(mineDef, 0)!; // level 0 → 1 cost

describe('buildOrUpgradeFacility', () => {
  it('rejects an unknown facility', () => {
    expect(buildOrUpgradeFacility(makeGs(), 'no_such_facility'))
      .toEqual({ ok: false, reason: 'unknown' });
  });

  it('builds a facility (level 0 → 1): deducts gold, sets level', () => {
    const gs = makeGs({ homeGold: buildCost + 50, productionFacilities: {} });
    const r = buildOrUpgradeFacility(gs, FAC_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spent).toBe(buildCost);
    expect(r.newLevel).toBe(1);
    expect(r.state.homeGold).toBe(50);
    expect(r.state.productionFacilities[FAC_ID]).toBe(1);
    // immutability
    expect(gs.homeGold).toBe(buildCost + 50);
    expect(gs.productionFacilities).toEqual({});
  });

  it('rejects when gold is insufficient', () => {
    const gs = makeGs({ homeGold: buildCost - 1, productionFacilities: {} });
    expect(buildOrUpgradeFacility(gs, FAC_ID)).toEqual({ ok: false, reason: 'no_gold' });
  });

  it('upgrades an existing facility (level 1 → 2) at the scaled cost', () => {
    const upgradeCost = facilityUpgradeCost(mineDef, 1)!;
    const gs = makeGs({ homeGold: upgradeCost + 10, productionFacilities: { [FAC_ID]: 1 } });
    const r = buildOrUpgradeFacility(gs, FAC_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spent).toBe(upgradeCost);
    expect(r.newLevel).toBe(2);
    expect(r.state.productionFacilities[FAC_ID]).toBe(2);
  });

  it('rejects upgrading a maxed facility', () => {
    const gs = makeGs({
      homeGold: 9_999_999,
      productionFacilities: { [FAC_ID]: mineDef.maxLevel },
    });
    expect(buildOrUpgradeFacility(gs, FAC_ID)).toEqual({ ok: false, reason: 'maxed' });
  });
});
