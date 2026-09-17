import { describe, expect, it } from 'vitest';
import { INVADER_DEFS, type InvaderType } from './invaders';
import {
  applyNotorietyDefeat,
  applyNotorietyGain,
  applyNotorietyIdleDecay,
  canRaiseNotorietyTier,
  getNotorietyBand,
  invaderThreshold,
  lowerNotorietyTier,
  NOTORIETY_BANDS,
  NOTORIETY_MAX_TIER,
  NOTORIETY_SUMMONED_ONLY,
  NOTORIETY_TIER_THRESHOLDS,
  nextNotorietyThreshold,
  raiseNotorietyTier,
  settleNotorietyWeek,
} from './notoriety';
import { loadGameState, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

describe('notoriety bands', () => {
  it('cover every non-endless invader exactly once as rank-and-file or boss, and nothing else', () => {
    const drawable = (Object.values(INVADER_DEFS) as Array<{ type: InvaderType; endlessOnly?: boolean }>)
      .filter(def => !def.endlessOnly && !NOTORIETY_SUMMONED_ONLY.includes(def.type)).map(def => def.type);
    const top = NOTORIETY_BANDS[NOTORIETY_BANDS.length - 1];
    const covered = new Set<InvaderType>([...top.pool, ...NOTORIETY_BANDS.flatMap(b => b.bosses)]);
    for (const type of drawable) expect(covered.has(type), `${type} unbanded`).toBe(true);
    for (const type of covered) expect(INVADER_DEFS[type]?.endlessOnly ?? false, `${type} is endless-only`).toBe(false);
    // A tier's boss is boss-only *at that tier*; knights, say, join the rank-and-file two tiers on.
    for (const band of NOTORIETY_BANDS) for (const boss of band.bosses) expect(band.pool, `tier ${band.tier} ${boss}`).not.toContain(boss);
  });

  it('pools are cumulative and each rung adds strictly tougher invaders', () => {
    for (let i = 1; i < NOTORIETY_BANDS.length; i++) {
      const prev = NOTORIETY_BANDS[i - 1];
      const band = NOTORIETY_BANDS[i];
      for (const type of prev.pool) expect(band.pool).toContain(type);
      const added = band.pool.filter(type => !prev.pool.includes(type));
      const prevMax = Math.max(...prev.pool.map(invaderThreshold));
      for (const type of added) expect(invaderThreshold(type), `${type} in tier ${band.tier}`).toBeGreaterThan(prevMax * 0.9);
      expect(band.lootMult).toBeGreaterThan(prev.lootMult);
      expect(band.dungeonHp).toBeGreaterThan(prev.dungeonHp);
    }
    expect(NOTORIETY_BANDS.map(b => b.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('thresholds climb monotonically and clamp tiers', () => {
    for (let i = 1; i < NOTORIETY_TIER_THRESHOLDS.length; i++) {
      expect(NOTORIETY_TIER_THRESHOLDS[i]).toBeGreaterThan(NOTORIETY_TIER_THRESHOLDS[i - 1]);
    }
    expect(getNotorietyBand(0).tier).toBe(1);
    expect(getNotorietyBand(99).tier).toBe(NOTORIETY_MAX_TIER);
  });
});

describe('notoriety points and the sign', () => {
  it('points accrue but the tier only moves when the player raises it', () => {
    const base = state();
    const rich = applyNotorietyGain(base, 300);
    expect(rich.notoriety).toBe(300);
    expect(rich.notorietyTier).toBe(1);
    expect(base.notoriety).toBe(0);
    expect(canRaiseNotorietyTier(rich)).toBe(true);
    const raised = raiseNotorietyTier(rich);
    expect(raised.ok && raised.state.notorietyTier).toBe(2);
    expect(raised.ok && raised.state.notoriety).toBe(300);
  });

  it('refuses to raise below the threshold or at the top', () => {
    const poor = raiseNotorietyTier(state({ notoriety: 99 }));
    expect(poor.ok).toBe(false);
    if (!poor.ok) expect(poor.reason).toBe('threshold_not_met');
    const top = raiseNotorietyTier(state({ notoriety: 1_000_000, notorietyTier: NOTORIETY_MAX_TIER }));
    expect(top.ok).toBe(false);
    if (!top.ok) expect(top.reason).toBe('at_max_tier');
    expect(nextNotorietyThreshold(state({ notorietyTier: NOTORIETY_MAX_TIER }))).toBeNull();
  });

  it('lowering the sign surrenders a fifth of the name and stops at tier 1', () => {
    const lowered = lowerNotorietyTier(state({ notoriety: 1000, notorietyTier: 4 }));
    expect(lowered.ok && lowered.state).toMatchObject({ notoriety: 800, notorietyTier: 3 });
    const floor = lowerNotorietyTier(state({ notoriety: 50, notorietyTier: 1 }));
    expect(floor.ok).toBe(false);
  });

  it('defeat costs a tenth of the points, never the tier', () => {
    const lost = applyNotorietyDefeat(state({ notoriety: 250, notorietyTier: 3 }));
    expect(lost).toMatchObject({ notoriety: 225, notorietyTier: 3 });
    expect(applyNotorietyDefeat(state({ notoriety: 0 })).notoriety).toBe(0);
  });

  it('idle decay starts after the grace week and keeps the tier', () => {
    const s = state({ notoriety: 1000, notorietyTier: 5 });
    expect(applyNotorietyIdleDecay(s, 7)).toBe(s);
    const away = applyNotorietyIdleDecay(s, 9);
    // two 5% slices, each rounded: 1000 → 950 → 950 − round(47.5) = 902
    expect(away.notoriety).toBe(902);
    expect(away.notorietyTier).toBe(5);
  });
});

describe('weekly settlement', () => {
  it('stamps the first week, pays 100 + tier × 30 gems on later weeks, and is idempotent', () => {
    const first = settleNotorietyWeek(state({ notorietyTier: 3, gems: 10 }), '2026-09-14');
    expect(first).toMatchObject({ changed: true, gems: 0 });
    expect(first.state.gems).toBe(10);
    const again = settleNotorietyWeek(first.state, '2026-09-14');
    expect(again.changed).toBe(false);
    const paid = settleNotorietyWeek(first.state, '2026-09-21');
    expect(paid.gems).toBe(190);
    expect(paid.state.gems).toBe(200);
    expect(paid.state.notorietyWeekStart).toBe('2026-09-21');
  });
});
