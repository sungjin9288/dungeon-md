/**
 * Wisdom-tree economy guard.
 *
 * Locks in the soul-crystal meta-progression pacing so a data edit can't silently
 * break it (e.g. a non-monotonic cost tier, a wrong-length cost array, or a 10×
 * cost typo that wrecks the grind curve).
 *
 * AUDIT (2026-06-18): 12 branches × 5 tiers. Per-branch cost-to-max:
 *   basic branches    [5,10,20,35,50]   = 120  (×6)
 *   mid branches      [5/8,15,25,40,60] = 145–148 (×3: ancestorsWisdom/eliteTrainer/dungeonFortress)
 *   premium income    [10,20,35,55,80]  = 200  (×3: celestialBlood/soulHarvest/forgeEnhancer)
 *   → full tree ≈ 1761 crystals. Monotonic, premium > basic — economy is sound.
 */

import { describe, it, expect } from 'vitest';
import { BRANCH_DEFS, MAX_WISDOM_TIER } from './wisdom';

const branchTotal = (b: { costPerTier: number[] }) => b.costPerTier.reduce((s, c) => s + c, 0);

describe('wisdom-tree economy guard', () => {
  it('every branch has MAX_WISDOM_TIER positive, strictly-increasing tier costs', () => {
    for (const b of BRANCH_DEFS) {
      expect(b.costPerTier.length, `${b.id} cost length`).toBe(MAX_WISDOM_TIER);
      for (let i = 0; i < b.costPerTier.length; i++) {
        expect(b.costPerTier[i], `${b.id} tier ${i} cost`).toBeGreaterThan(0);
        if (i > 0) {
          expect(b.costPerTier[i], `${b.id} tier ${i} not increasing`)
            .toBeGreaterThan(b.costPerTier[i - 1]);
        }
      }
    }
  });

  it('every branch bonus starts at 0 (tier 0) and rises with tier', () => {
    for (const b of BRANCH_DEFS) {
      expect(b.getValue(0), `${b.id} tier-0 value`).toBe(0);
      expect(b.getValue(MAX_WISDOM_TIER), `${b.id} maxed value`).toBeGreaterThan(b.getValue(1));
    }
  });

  it('full-tree crystal cost stays within a sane pacing band (regression guard)', () => {
    const total = BRANCH_DEFS.reduce((s, b) => s + branchTotal(b), 0);
    // ≈1761 today; band catches a major mis-edit without forbidding normal tuning.
    expect(total).toBeGreaterThanOrEqual(1200);
    expect(total).toBeLessThanOrEqual(2600);
  });

  it('premium income branches cost more to max than the cheapest basic branch', () => {
    const cheapest = Math.min(...BRANCH_DEFS.map(branchTotal));
    for (const id of ['celestialBlood', 'soulHarvest', 'forgeEnhancer']) {
      const b = BRANCH_DEFS.find(x => x.id === id);
      expect(b, `branch ${id} exists`).toBeTruthy();
      if (b) expect(branchTotal(b), `${id} should be premium-priced`).toBeGreaterThan(cheapest);
    }
  });
});
