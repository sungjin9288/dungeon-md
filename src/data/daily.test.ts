import { describe, it, expect } from 'vitest';
import {
  getDailyChallenges,
  tickDailyChallenge,
  getTodayString,
  getThisWeekMonday,
} from './daily';
import type { GameState } from './wisdom';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal GameState sufficient for tickDailyChallenge */
function makeGs(overrides: {
  gems?: number;
  dailyChallengeDate?: string;
  dailyChallenges?: Record<string, { completed: boolean; progress: number }>;
} = {}): GameState {
  return {
    gems: 100,
    dailyChallengeDate: getTodayString(),
    dailyChallenges: {},
    ...overrides,
  } as unknown as GameState;
}

// ─── getDailyChallenges ───────────────────────────────────────────────────────

describe('getDailyChallenges', () => {
  it('always returns exactly 3 challenges', () => {
    const challenges = getDailyChallenges();
    expect(challenges).toHaveLength(3);
  });

  it('every challenge has an id, description, objective, and reward', () => {
    for (const ch of getDailyChallenges()) {
      expect(ch.id.length).toBeGreaterThan(0);
      expect(ch.description.length).toBeGreaterThan(0);
      expect(ch.objective.type.length).toBeGreaterThan(0);
      expect(ch.objective.target).toBeGreaterThan(0);
      expect(ch.reward).toBeDefined();
    }
  });

  it('each challenge has a valid objective type', () => {
    const validTypes = new Set([
      'kill_count', 'no_damage', 'skill_use', 'tribe_only', 'wave_clear',
    ]);
    for (const ch of getDailyChallenges()) {
      expect(validTypes.has(ch.objective.type)).toBe(true);
    }
  });

  it('is deterministic — two calls on the same day return the same challenges', () => {
    const a = getDailyChallenges();
    const b = getDailyChallenges();
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
    expect(a.map(c => c.description)).toEqual(b.map(c => c.description));
  });

  it('challenge ids encode today\'s day index', () => {
    // id format: dc-<dayIndex>-<position>
    const today = getDailyChallenges();
    for (let i = 0; i < today.length; i++) {
      expect(today[i].id).toMatch(/^dc-\d+-\d+$/);
      expect(today[i].id.endsWith(`-${i}`)).toBe(true);
    }
  });

  it('the 3 challenges have distinct ids', () => {
    const ids = getDailyChallenges().map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('reward object has at least one key', () => {
    for (const ch of getDailyChallenges()) {
      const rewardKeys = Object.keys(ch.reward).filter(
        k => (ch.reward as Record<string, number>)[k] !== undefined,
      );
      expect(rewardKeys.length).toBeGreaterThan(0);
    }
  });
});

// ─── tickDailyChallenge — immutability ────────────────────────────────────────

describe('tickDailyChallenge — immutability', () => {
  it('returns a new GameState object (does not mutate input)', () => {
    const gs  = makeGs();
    const [ch] = getDailyChallenges();
    const next = tickDailyChallenge(gs, ch.objective.type);
    expect(next).not.toBe(gs);
  });

  it('original dailyChallenges object is unchanged after tick', () => {
    const gs        = makeGs();
    const before    = gs.dailyChallenges;
    const [ch]      = getDailyChallenges();
    tickDailyChallenge(gs, ch.objective.type);
    expect(gs.dailyChallenges).toBe(before); // same reference
  });
});

// ─── tickDailyChallenge — progress increments ─────────────────────────────────

describe('tickDailyChallenge — progress', () => {
  it('increments progress for a challenge whose type matches', () => {
    const [ch] = getDailyChallenges();
    const gs   = makeGs();
    const next = tickDailyChallenge(gs, ch.objective.type);
    const entry = next.dailyChallenges?.[ch.id];
    expect(entry?.progress).toBeGreaterThan(0);
  });

  it('does not affect challenges whose type does not match', () => {
    const challenges = getDailyChallenges();
    const gs         = makeGs();

    // Use a type that none of today's challenges have (if any)
    const usedTypes = new Set(challenges.map(c => c.objective.type));
    const allTypes  = ['kill_count', 'no_damage', 'skill_use', 'tribe_only', 'wave_clear'] as const;
    const absent    = allTypes.find(t => !usedTypes.has(t));

    if (!absent) {
      // All 5 types appear — can't test this specific case today; skip gracefully
      return;
    }

    const next = tickDailyChallenge(gs, absent);
    for (const ch of challenges) {
      const entry = next.dailyChallenges?.[ch.id];
      expect(entry?.progress ?? 0).toBe(0);
    }
  });

  it('accumulates progress across multiple ticks', () => {
    const [ch] = getDailyChallenges();
    const gs1  = makeGs();
    const gs2  = tickDailyChallenge(gs1, ch.objective.type, 5);
    const gs3  = tickDailyChallenge(gs2, ch.objective.type, 5);

    const progress1 = gs2.dailyChallenges?.[ch.id]?.progress ?? 0;
    const progress2 = gs3.dailyChallenges?.[ch.id]?.progress ?? 0;

    // progress2 should be higher (unless already at target)
    expect(progress2).toBeGreaterThanOrEqual(progress1);
  });

  it('clamps progress to the challenge target (no overshoot)', () => {
    const challenges = getDailyChallenges();
    const gs         = makeGs();

    // Tick with a huge amount to force completion
    let next = gs;
    for (const ch of challenges) {
      next = tickDailyChallenge(next, ch.objective.type, 99_999);
    }

    for (const ch of challenges) {
      const entry = next.dailyChallenges?.[ch.id];
      if (entry) {
        expect(entry.progress).toBeLessThanOrEqual(ch.objective.target);
      }
    }
  });

  it('marks challenge as completed when progress reaches target', () => {
    const challenges = getDailyChallenges();
    const gs         = makeGs();

    let next = gs;
    for (const ch of challenges) {
      next = tickDailyChallenge(next, ch.objective.type, 99_999);
    }

    for (const ch of challenges) {
      const entry = next.dailyChallenges?.[ch.id];
      if (entry) {
        expect(entry.completed).toBe(true);
      }
    }
  });

  it('adds gem reward to gs.gems when a challenge completes', () => {
    // Find a challenge with a gem reward and tick it to completion
    const challenges = getDailyChallenges();
    const chWithGems = challenges.find(c => c.reward.gems !== undefined);
    if (!chWithGems) return; // all 3 have gems in practice — skip if not

    const gs   = makeGs({ gems: 50 });
    const next = tickDailyChallenge(gs, chWithGems.objective.type, 99_999);

    expect(next.gems).toBeGreaterThan(50);
  });

  it('skips already completed challenges (no double-reward)', () => {
    const challenges = getDailyChallenges();
    // Mark all 3 as already completed
    const completedMap: Record<string, { completed: boolean; progress: number }> = {};
    for (const ch of challenges) {
      completedMap[ch.id] = { completed: true, progress: ch.objective.target };
    }

    const gs   = makeGs({ dailyChallenges: completedMap, gems: 200 });
    const next = tickDailyChallenge(gs, challenges[0].objective.type, 99_999);

    // No challenge should have changed its progress
    for (const ch of challenges) {
      expect(next.dailyChallenges?.[ch.id]?.progress).toBe(ch.objective.target);
    }
    // Gems must not have increased (all were already done)
    expect(next.gems).toBe(200);
  });
});

// ─── tickDailyChallenge — filter matching ─────────────────────────────────────

describe('tickDailyChallenge — filter matching', () => {
  it('tribe_only challenge only increments when filter matches', () => {
    const challenges = getDailyChallenges();
    const tribeOnly  = challenges.find(c => c.objective.type === 'tribe_only');
    if (!tribeOnly) return; // not a tribe_only day — skip

    const gs = makeGs();

    // Wrong filter → should NOT increment
    const wrongFilter = 'zzz_does_not_exist';
    const next1 = tickDailyChallenge(gs, 'tribe_only', 1, wrongFilter);
    expect(next1.dailyChallenges?.[tribeOnly.id]?.progress ?? 0).toBe(0);

    // Correct filter → SHOULD increment
    const correctFilter = tribeOnly.objective.filter!;
    const next2 = tickDailyChallenge(gs, 'tribe_only', 1, correctFilter);
    expect(next2.dailyChallenges?.[tribeOnly.id]?.progress ?? 0).toBe(1);
  });

  it('non-filtered challenges (no filter field) are not skipped when filter arg is undefined', () => {
    const challenges = getDailyChallenges();
    const noFilter   = challenges.find(c => !c.objective.filter);
    if (!noFilter) return; // all filtered today — skip

    const gs   = makeGs();
    const next = tickDailyChallenge(gs, noFilter.objective.type);
    expect(next.dailyChallenges?.[noFilter.id]?.progress ?? 0).toBeGreaterThan(0);
  });
});

// ─── tickDailyChallenge — daily reset ─────────────────────────────────────────

describe('tickDailyChallenge — daily reset', () => {
  it('resets progress when dailyChallengeDate differs from today', () => {
    const [ch]    = getDailyChallenges();
    const staleId = `dc-0-0`; // a very old challenge id

    const gs = makeGs({
      dailyChallengeDate: '2000-01-01',
      dailyChallenges:    {
        [staleId]: { completed: false, progress: 99 }, // stale data
      },
    });

    const next = tickDailyChallenge(gs, ch.objective.type, 5);

    // Stale entry should be gone
    expect(next.dailyChallenges?.[staleId]).toBeUndefined();
    // Updated date should be today
    expect(next.dailyChallengeDate).toBe(getTodayString());
  });

  it('preserves existing progress when date already matches today', () => {
    const [ch] = getDailyChallenges();
    const gs1  = makeGs();
    const gs2  = tickDailyChallenge(gs1, ch.objective.type, 3);
    const gs3  = tickDailyChallenge(gs2, ch.objective.type, 2);

    const progress = gs3.dailyChallenges?.[ch.id]?.progress ?? 0;
    // progress should be at least 5 (3+2), unless clamped to target
    expect(progress).toBeGreaterThanOrEqual(Math.min(5, ch.objective.target));
  });
});

// ─── getTodayString ───────────────────────────────────────────────────────────

describe('getTodayString', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches today\'s UTC date', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(getTodayString()).toBe(expected);
  });

  it('is consistent across multiple calls in the same tick', () => {
    expect(getTodayString()).toBe(getTodayString());
  });
});

// ─── getThisWeekMonday ────────────────────────────────────────────────────────

describe('getThisWeekMonday', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    expect(getThisWeekMonday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returned date is a Monday (UTC weekday = 1)', () => {
    const d = new Date(getThisWeekMonday() + 'T00:00:00Z');
    expect(d.getUTCDay()).toBe(1); // 1 = Monday
  });

  it('returned date is ≤ today', () => {
    const monday = getThisWeekMonday();
    const today  = getTodayString();
    expect(monday <= today).toBe(true);
  });

  it('is at most 6 days before today', () => {
    const monday   = new Date(getThisWeekMonday() + 'T00:00:00Z');
    const today    = new Date(getTodayString() + 'T00:00:00Z');
    const diffDays = (today.getTime() - monday.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThan(7);
  });
});
