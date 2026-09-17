import { describe, expect, it } from 'vitest';
import { estimateWeeklyFreeGems, GEM_INFLOW_TARGET_MAX, GEM_INFLOW_TARGET_MIN } from './gemInflow';

describe('free gem inflow per week (P4 ①)', () => {
  it('counts attendance, the weekly name settlement, and expected treasure cards', () => {
    const t1 = estimateWeeklyFreeGems(1);
    expect(t1.attendance).toBe(110);
    expect(t1.notoriety).toBe(130);
    expect(t1.treasure).toBeCloseTo(6 * 0.15 * 55, 5);
  });

  it('lands inside the 300–450 band from tier 2 through tier 5 (the non-paying mid game)', () => {
    // The band spans 150 gems and each tier adds ~34.5, so four tiers is the widest it can cover.
    for (let tier = 2; tier <= 5; tier++) {
      const { total } = estimateWeeklyFreeGems(tier);
      expect(total, `tier ${tier}: ${total}`).toBeGreaterThanOrEqual(GEM_INFLOW_TARGET_MIN);
      expect(total, `tier ${tier}: ${total}`).toBeLessThanOrEqual(GEM_INFLOW_TARGET_MAX);
    }
    // A fresh dungeon is just under the band; a famous one deliberately above it.
    expect(estimateWeeklyFreeGems(1).total).toBeGreaterThanOrEqual(280);
    expect(estimateWeeklyFreeGems(6).total).toBeGreaterThan(GEM_INFLOW_TARGET_MAX);
    expect(estimateWeeklyFreeGems(10).total).toBeGreaterThan(GEM_INFLOW_TARGET_MAX);
  });
});
