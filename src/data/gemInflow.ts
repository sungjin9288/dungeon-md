// ─── Free gem inflow (P4 ①) ───────────────────────────────────────────────────
// What a non-paying player earns per week from the recurring sources, by
// notoriety tier. A guard test keeps the number inside the design band so a
// reward tweak elsewhere cannot silently starve or flood summoning.
// Design: GAME_DESIGN_BENCHMARK.md §4.4 ① (target 300–450 / week).

import { ATTENDANCE_REWARDS } from './attendance';
import { FORECAST_SPECIAL_WEIGHTS } from './forecast';
import { getNotorietyBand, NOTORIETY_WEEKLY_GEMS_BASE, NOTORIETY_WEEKLY_GEMS_PER_TIER } from './notoriety';

export const GEM_INFLOW_TARGET_MIN = 300;
export const GEM_INFLOW_TARGET_MAX = 450;
/** Six non-Monday days roll a special card; Monday is the weekly boss. */
const SPECIAL_CARD_DAYS_PER_WEEK = 6;

export interface WeeklyGemInflow {
  readonly tier: number;
  readonly attendance: number;
  readonly notoriety: number;
  readonly treasure: number;
  readonly total: number;
}

function treasureCardChance(): number {
  const total = FORECAST_SPECIAL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  const treasure = FORECAST_SPECIAL_WEIGHTS.find(([kind]) => kind === 'treasure')?.[1] ?? 0;
  return total > 0 ? treasure / total : 0;
}

/** Mirrors forecast.treasureCard's reward for the band. */
function treasureCardGems(tier: number): number {
  return 50 + Math.round(5 * getNotorietyBand(tier).tier);
}

export function estimateWeeklyFreeGems(tier: number): WeeklyGemInflow {
  const attendance = ATTENDANCE_REWARDS.reduce((sum, reward) => sum + (reward.gems ?? 0), 0);
  const notoriety = NOTORIETY_WEEKLY_GEMS_BASE + getNotorietyBand(tier).tier * NOTORIETY_WEEKLY_GEMS_PER_TIER;
  const treasure = SPECIAL_CARD_DAYS_PER_WEEK * treasureCardChance() * treasureCardGems(tier);
  return { tier, attendance, notoriety, treasure, total: attendance + notoriety + treasure };
}
