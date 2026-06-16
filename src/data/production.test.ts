import { describe, it, expect } from 'vitest';
import type { GameState } from './wisdom';
import { MATERIAL_DEFS } from './fusion';
import {
  FACILITY_DEFS, FACILITY_ORDER,
  facilityRatePerHour, facilityUpgradeCost, facilityProductionOverMs, builtFacilityCount,
} from './production';
import { buildOrUpgradeFacility } from './productionTransactions';

const HOUR = 3_600_000;

describe('facility catalog integrity', () => {
  it('every facility is in FACILITY_ORDER and outputs a real material or gold', () => {
    expect([...FACILITY_ORDER].sort()).toEqual(Object.keys(FACILITY_DEFS).sort());
    for (const def of Object.values(FACILITY_DEFS)) {
      if (def.output.kind === 'material') {
        expect(MATERIAL_DEFS[def.output.materialId]).toBeDefined();
      }
    }
  });
});

describe('facilityRatePerHour', () => {
  it('is 0 at level 0 and scales with level (capped at maxLevel)', () => {
    const mine = FACILITY_DEFS.mine;
    expect(facilityRatePerHour(mine, 0)).toBe(0);
    expect(facilityRatePerHour(mine, 1)).toBe(mine.baseRatePerHour);
    expect(facilityRatePerHour(mine, 3)).toBe(mine.baseRatePerHour * 3);
    expect(facilityRatePerHour(mine, 99)).toBe(mine.baseRatePerHour * mine.maxLevel);
  });
});

describe('facilityUpgradeCost', () => {
  it('returns build cost at level 0, grows for upgrades, null when maxed', () => {
    const mine = FACILITY_DEFS.mine;
    expect(facilityUpgradeCost(mine, 0)).toBe(mine.buildCost);
    expect(facilityUpgradeCost(mine, 1)).toBeGreaterThan(mine.buildCost);
    expect(facilityUpgradeCost(mine, 2)).toBeGreaterThan(facilityUpgradeCost(mine, 1)!);
    expect(facilityUpgradeCost(mine, mine.maxLevel)).toBeNull();
  });
});

describe('facilityProductionOverMs', () => {
  it('produces nothing with no facilities', () => {
    expect(facilityProductionOverMs({}, HOUR)).toEqual({ materials: {}, gold: 0 });
    expect(facilityProductionOverMs(undefined, HOUR)).toEqual({ materials: {}, gold: 0 });
  });

  it('mines materials at the level rate over time', () => {
    const out = facilityProductionOverMs({ mine: 2 }, HOUR);   // 2/hr × level 2 = 4
    expect(out.materials.common_ore).toBe(4);
    expect(out.gold).toBe(0);
  });

  it('treasury produces gold, not materials', () => {
    const out = facilityProductionOverMs({ treasury: 1 }, HOUR);
    expect(out.gold).toBe(FACILITY_DEFS.treasury.baseRatePerHour);
    expect(Object.keys(out.materials)).toHaveLength(0);
  });

  it('floors fractional production (short idle rounds down)', () => {
    const out = facilityProductionOverMs({ mine: 1 }, HOUR / 4);   // 2/hr × 0.25h = 0.5 → 0
    expect(out.materials.common_ore).toBeUndefined();
  });

  it('mixes materials + gold across facilities', () => {
    const out = facilityProductionOverMs({ mine: 1, herb_garden: 1, treasury: 1 }, HOUR);
    expect(out.materials.common_ore).toBe(2);
    expect(out.materials.herb).toBe(2);
    expect(out.gold).toBe(100);
  });

  it('builtFacilityCount counts only built facilities', () => {
    expect(builtFacilityCount({ mine: 2, herb_garden: 0, treasury: 1 })).toBe(2);
    expect(builtFacilityCount(undefined)).toBe(0);
  });
});

describe('buildOrUpgradeFacility', () => {
  function makeState(overrides: Partial<GameState> = {}): GameState {
    return { homeGold: 1000, productionFacilities: {}, ...overrides } as GameState;
  }

  it('builds a facility, spending gold immutably', () => {
    const before = makeState({ homeGold: 500 });
    const r = buildOrUpgradeFacility(before, 'mine');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newLevel).toBe(1);
    expect(r.spent).toBe(FACILITY_DEFS.mine.buildCost);
    expect(r.state.homeGold).toBe(500 - FACILITY_DEFS.mine.buildCost);
    expect(r.state.productionFacilities.mine).toBe(1);
    expect(before.homeGold).toBe(500);          // input untouched
    expect(before.productionFacilities.mine).toBeUndefined();
  });

  it('rejects when gold is insufficient', () => {
    const r = buildOrUpgradeFacility(makeState({ homeGold: 10 }), 'mine');
    expect(r).toEqual({ ok: false, reason: 'no_gold' });
  });

  it('rejects an unknown facility', () => {
    expect(buildOrUpgradeFacility(makeState(), 'nope').ok).toBe(false);
  });

  it('rejects upgrading past max level', () => {
    const maxed = makeState({ productionFacilities: { mine: FACILITY_DEFS.mine.maxLevel } });
    expect(buildOrUpgradeFacility(maxed, 'mine')).toEqual({ ok: false, reason: 'maxed' });
  });
});
