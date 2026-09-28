import { describe, expect, it } from 'vitest';
import { collectIdleIncome, computeIdleReward } from './idleIncome';
import { assignFacilityStaff, buildOrUpgradeFacility, clearFacilityStaff } from './productionTransactions';
import { loadGameState, type GameState } from './wisdom';

const START = 1000;
const HOUR = 3_600_000;
function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), homeGold: 5000, dungeonSlots: [], dmLevel: 1,
    wisdomTree: {}, placedDecorations: [], notorietyTier: 1, materials: {},
    productionFacilities: { mine: 1, treasury: 1 }, facilityStaff: {},
    lastIdleCollect: START, ...overrides };
}

describe('production changes settle the preceding rate', () => {
  it('a newly built mine earns nothing for time before construction', () => {
    const before = state({ productionFacilities: { treasury: 1 } });
    const result = buildOrUpgradeFacility(before, 'mine', START + HOUR);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.homeGold).toBe(4950); // existing treasury +100, build -150
    expect(result.state.materials).toEqual({});
    expect(computeIdleReward(result.state, START + 2 * HOUR).materials).toEqual({ common_ore: 2 });
    expect(before.homeGold).toBe(5000);
    expect(before.lastIdleCollect).toBe(START);
  });

  it('upgrade pays the old level, then accrues the new level from its timestamp', () => {
    const result = buildOrUpgradeFacility(state(), 'mine', START + HOUR);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.homeGold).toBe(4830);
    expect(result.idleReward.materials).toEqual({ common_ore: 2 });
    const next = collectIdleIncome(result.state, START + 2 * HOUR).state;
    expect(next.materials.common_ore).toBe(6); // 2 + 4, never 4 + 4
    expect(next.homeGold).toBe(4930);
  });

  it('assignment, transfer and removal pay each old staffing rate exactly once', () => {
    const assigned = assignFacilityStaff(state(), 'treasury', 'dokkaebi_warrior', START + HOUR);
    if (!assigned.ok) throw new Error(assigned.reason);
    expect(assigned.state.homeGold).toBe(5100);
    const moved = assignFacilityStaff(assigned.state, 'mine', 'dokkaebi_warrior', START + 2 * HOUR);
    if (!moved.ok) throw new Error(moved.reason);
    expect(moved.state.homeGold).toBe(5250);
    expect(moved.state.materials.common_ore).toBe(4);
    const cleared = clearFacilityStaff(moved.state, 'mine', START + 3 * HOUR);
    if (!cleared.ok) throw new Error(cleared.reason);
    expect(cleared.state.homeGold).toBe(5350);
    expect(cleared.state.materials.common_ore).toBe(6);
    expect(cleared.state.idleRemainder?.materials.common_ore).toBeCloseTo(0.4);
    expect(collectIdleIncome(cleared.state, START + 4 * HOUR).state.materials.common_ore).toBe(8);
  });

  it('removal preserves the worker operating contribution for the old interval', () => {
    const before = state({ facilityStaff: { mine: 'dokkaebi_warrior' },
      dungeonSlots: [{ roomType: 'combat', monsterIds: [], trapIds: [], roomLevel: 1, hp: 100, maxHp: 100 }] });
    const owed = computeIdleReward(before, START + HOUR);
    const result = clearFacilityStaff(before, 'mine', START + HOUR);
    if (!result.ok) throw new Error(result.reason);
    expect(result.idleReward).toEqual(owed);
    expect(result.state.homeGold).toBe(before.homeGold + owed.gold);
    expect(computeIdleReward(result.state, START + 2 * HOUR).gold).toBeLessThan(owed.gold);
  });

  it('keeps incomplete output through a zero-payout upgrade', () => {
    const result = buildOrUpgradeFacility(state({ productionFacilities: { mine: 1 } }), 'mine', START + HOUR / 4);
    if (!result.ok) throw new Error(result.reason);
    expect(result.idleReward.materials).toEqual({});
    expect(result.state.idleRemainder?.materials.common_ore).toBe(0.5);
    expect(collectIdleIncome(result.state, START + HOUR / 4 + HOUR / 8).state.materials.common_ore).toBe(1);
  });

  it('caps the old interval and cannot collect it twice', () => {
    const result = buildOrUpgradeFacility(state(), 'mine', START + 48 * HOUR);
    if (!result.ok) throw new Error(result.reason);
    expect(result.idleReward).toMatchObject({ capped: true, creditedMs: 12 * HOUR, gold: 1200, materials: { common_ore: 24 } });
    expect(computeIdleReward(result.state, START + 48 * HOUR)).toMatchObject({ gold: 0, materials: {} });
    expect(computeIdleReward(result.state, START + 49 * HOUR).materials.common_ore).toBe(4);
  });

  it('initializes a legacy clock without retroactive production', () => {
    const result = buildOrUpgradeFacility(state({ lastIdleCollect: 0 }), 'mine', START + HOUR);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.lastIdleCollect).toBe(START + HOUR);
    expect(result.state.homeGold).toBe(4730);
    expect(result.state.materials).toEqual({});
  });

  it('validates spendable gold and action targets before settling', () => {
    const before = state({ homeGold: 0 });
    const snapshot = structuredClone(before);
    expect(buildOrUpgradeFacility(before, 'mine', START + HOUR)).toEqual({ ok: false, reason: 'no_gold' });
    expect(assignFacilityStaff(before, 'mine', 'missing', START + HOUR)).toEqual({ ok: false, reason: 'not_owned' });
    expect(clearFacilityStaff(before, 'mine', START + HOUR)).toEqual({ ok: false, reason: 'not_staffed' });
    expect(before).toEqual(snapshot);
    expect(computeIdleReward(before, START + HOUR).gold).toBe(100);
  });
});
