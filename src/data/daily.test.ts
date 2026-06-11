import { describe, it, expect } from 'vitest';
import {
  applyDailyChallengeTick,
  getDailyDungeon,
  getWeeklyBoss,
  getDailyChallenges,
  ensureDailyChallengeDate,
  prepareDailyChallengeViewState,
  tickDailyChallenge,
  getTodayString,
  getThisWeekMonday,
  type DailyDungeon,
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

// ─── ensureDailyChallengeDate ────────────────────────────────────────────────

describe('ensureDailyChallengeDate', () => {
  it('returns the same state when the daily challenge date already matches', () => {
    const gs = makeGs({
      dailyChallengeDate: '2026-05-13',
      dailyChallenges: {
        'dc-current-0': { completed: false, progress: 2 },
      },
    });

    const result = ensureDailyChallengeDate(gs, '2026-05-13');

    expect(result.changed).toBe(false);
    expect(result.state).toBe(gs);
  });

  it('resets stale challenge progress without mutating the original state', () => {
    const gs = makeGs({
      dailyChallengeDate: '2026-05-12',
      dailyChallenges: {
        'dc-old-0': { completed: true, progress: 99 },
      },
    });

    const result = ensureDailyChallengeDate(gs, '2026-05-13');

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(gs);
    expect(result.state.dailyChallengeDate).toBe('2026-05-13');
    expect(result.state.dailyChallenges).toEqual({});
    expect(gs.dailyChallenges).toEqual({
      'dc-old-0': { completed: true, progress: 99 },
    });
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

// ─── applyDailyChallengeTick — transaction result ────────────────────────────

describe('applyDailyChallengeTick', () => {
  it('reports changed state, completed ids, and earned gems when challenges complete', () => {
    const challenges = getDailyChallenges();
    const ch = challenges.find(c => c.reward.gems !== undefined);
    if (!ch) return;
    const matching = challenges.filter(c => c.objective.type === ch.objective.type);
    const expectedGems = matching.reduce((sum, c) => sum + (c.reward.gems ?? 0), 0);
    const gs = makeGs({ gems: 50 });

    const result = applyDailyChallengeTick(gs, ch.objective.type, 99_999);

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(gs);
    expect(result.rewardGems).toBe(expectedGems);
    expect(result.completedIds.sort()).toEqual(matching.map(c => c.id).sort());
    expect(result.state.gems).toBe(50 + expectedGems);
    expect(gs.gems).toBe(50);
  });

  it('returns the same state when today is current and no challenge matches', () => {
    const challenges = getDailyChallenges();
    const usedTypes = new Set(challenges.map(c => c.objective.type));
    const allTypes = ['kill_count', 'no_damage', 'skill_use', 'tribe_only', 'wave_clear'] as const;
    const absent = allTypes.find(t => !usedTypes.has(t));
    if (!absent) return;
    const gs = makeGs();

    const result = applyDailyChallengeTick(gs, absent);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(gs);
    expect(result.completedIds).toEqual([]);
    expect(result.rewardGems).toBe(0);
  });
});

// ─── prepareDailyChallengeViewState — display state result ────────────────────

describe('prepareDailyChallengeViewState', () => {
  it('returns display metadata for current daily challenges without changing current state', () => {
    const challenges = getDailyChallenges();
    const completedId = challenges[0].id;
    const gs = makeGs({
      dailyChallenges: {
        [completedId]: { completed: true, progress: challenges[0].objective.target },
      },
    });

    const result = prepareDailyChallengeViewState(gs, getTodayString());

    expect(result.changed).toBe(false);
    expect(result.state).toBe(gs);
    expect(result.challenges).toHaveLength(3);
    expect(result.completedCount).toBe(1);
    expect(result.allCompleted).toBe(false);
    expect(result.totalRewardGems).toBe(
      result.challenges.reduce((sum, challenge) => sum + (challenge.reward.gems ?? 0), 0),
    );
  });

  it('resets stale daily challenge progress and reports changed state', () => {
    const gs = makeGs({
      dailyChallengeDate: '2000-01-01',
      dailyChallenges: {
        stale: { completed: true, progress: 99 },
      },
    });

    const result = prepareDailyChallengeViewState(gs, '2026-05-14');

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(gs);
    expect(result.today).toBe('2026-05-14');
    expect(result.state.dailyChallengeDate).toBe('2026-05-14');
    expect(result.state.dailyChallenges).toEqual({});
    expect(result.completedCount).toBe(0);
    expect(result.allCompleted).toBe(false);
    expect(gs.dailyChallenges?.stale?.completed).toBe(true);
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

// ─── getDailyDungeon ──────────────────────────────────────────────────────────

describe('getDailyDungeon — structure', () => {
  const dungeon: DailyDungeon = getDailyDungeon();

  it('returns an object with required fields', () => {
    expect(dungeon.name).toBeDefined();
    expect(dungeon.rule).toBeDefined();
    expect(dungeon.modifiers).toBeDefined();
    expect(dungeon.waves).toBeDefined();
    expect(dungeon.rewards).toBeDefined();
    expect(dungeon.dayIndex).toBeDefined();
  });

  it('rule is one of the 4 valid DailyRule values', () => {
    const VALID_RULES = ['element_restrict', 'gold_rush', 'speed_run', 'boss_rush'];
    expect(VALID_RULES).toContain(dungeon.rule);
  });

  it('name is a non-empty string', () => {
    expect(dungeon.name.length).toBeGreaterThan(0);
  });

  it('dayIndex is a non-negative integer', () => {
    expect(Number.isInteger(dungeon.dayIndex)).toBe(true);
    expect(dungeon.dayIndex).toBeGreaterThanOrEqual(0);
  });
});

describe('getDailyDungeon — modifiers', () => {
  const dungeon = getDailyDungeon();

  it('invaderSpeedMult is a positive number', () => {
    expect(dungeon.modifiers.invaderSpeedMult).toBeGreaterThan(0);
  });

  it('goldMult is a positive number', () => {
    expect(dungeon.modifiers.goldMult).toBeGreaterThan(0);
  });

  it('speed_run rule → invaderSpeedMult = 1.5', () => {
    if (dungeon.rule === 'speed_run') {
      expect(dungeon.modifiers.invaderSpeedMult).toBe(1.5);
    }
  });

  it('gold_rush rule → goldMult = 3.0', () => {
    if (dungeon.rule === 'gold_rush') {
      expect(dungeon.modifiers.goldMult).toBe(3.0);
    }
  });

  it('non-speed_run rule → invaderSpeedMult = 1.0', () => {
    if (dungeon.rule !== 'speed_run') {
      expect(dungeon.modifiers.invaderSpeedMult).toBe(1.0);
    }
  });
});

describe('getDailyDungeon — waves', () => {
  const dungeon = getDailyDungeon();

  it('has exactly 10 waves', () => {
    expect(dungeon.waves).toHaveLength(10);
  });

  it('wave numbers are 1–10 in order', () => {
    dungeon.waves.forEach((w, i) => {
      expect(w.wave).toBe(i + 1);
    });
  });

  it('every wave has at least one invader group', () => {
    for (const wave of dungeon.waves) {
      expect(wave.invaders.length).toBeGreaterThan(0);
    }
  });

  it('every invader group count is positive', () => {
    for (const wave of dungeon.waves) {
      for (const inv of wave.invaders) {
        expect(inv.count).toBeGreaterThan(0);
      }
    }
  });

  it('every clearReward is positive', () => {
    for (const wave of dungeon.waves) {
      expect(wave.clearReward, `wave ${wave.wave} clearReward`).toBeGreaterThan(0);
    }
  });

  it('boss wave (wave 10) has isBoss = true on at least one invader', () => {
    const bossWave = dungeon.waves.find(w => w.wave === 10)!;
    expect(bossWave.invaders.some(inv => inv.isBoss === true)).toBe(true);
  });

  it('is deterministic — two calls on the same day produce identical waves', () => {
    const d2 = getDailyDungeon();
    expect(JSON.stringify(dungeon.waves)).toBe(JSON.stringify(d2.waves));
  });
});

describe('getDailyDungeon — rewards', () => {
  const dungeon = getDailyDungeon();

  it('rewards.crystals is a positive integer', () => {
    expect(dungeon.rewards.crystals).toBeGreaterThan(0);
    expect(Number.isInteger(dungeon.rewards.crystals)).toBe(true);
  });

  it('rewards.materials is a non-empty array', () => {
    expect(dungeon.rewards.materials.length).toBeGreaterThan(0);
  });

  it('boss_rush rule grants more crystals (100) than regular rules (50)', () => {
    if (dungeon.rule === 'boss_rush') {
      expect(dungeon.rewards.crystals).toBe(100);
    } else {
      expect(dungeon.rewards.crystals).toBe(50);
    }
  });
});

// ─── getWeeklyBoss ────────────────────────────────────────────────────────────

describe('getWeeklyBoss — structure', () => {
  const boss = getWeeklyBoss();

  it('returns an object with required fields', () => {
    expect(boss.name).toBeDefined();
    expect(boss.bossType).toBeDefined();
    expect(boss.totalHp).toBeDefined();
    expect(boss.phases).toBeDefined();
    expect(boss.rewards).toBeDefined();
    expect(boss.weekIndex).toBeDefined();
  });

  it('name is a non-empty Korean string', () => {
    expect(boss.name.length).toBeGreaterThan(0);
  });

  it('bossType is a non-empty string', () => {
    expect(typeof boss.bossType).toBe('string');
    expect(boss.bossType.length).toBeGreaterThan(0);
  });

  it('totalHp is a large positive integer (≥ 10000)', () => {
    expect(boss.totalHp).toBeGreaterThanOrEqual(10_000);
    expect(Number.isInteger(boss.totalHp)).toBe(true);
  });

  it('phases is exactly 5', () => {
    expect(boss.phases).toBe(5);
  });

  it('weekIndex is a non-negative integer', () => {
    expect(Number.isInteger(boss.weekIndex)).toBe(true);
    expect(boss.weekIndex).toBeGreaterThanOrEqual(0);
  });
});

describe('getWeeklyBoss — rewards', () => {
  const boss = getWeeklyBoss();

  it('legendaryMaterial is boss_essence', () => {
    expect(boss.rewards.legendaryMaterial).toBe('boss_essence');
  });

  it('skinShards is a positive integer', () => {
    expect(boss.rewards.skinShards).toBeGreaterThan(0);
    expect(Number.isInteger(boss.rewards.skinShards)).toBe(true);
  });
});

describe('getWeeklyBoss — rotation', () => {
  it('is deterministic — two calls in the same week return the same boss', () => {
    const b1 = getWeeklyBoss();
    const b2 = getWeeklyBoss();
    expect(b1.bossType).toBe(b2.bossType);
    expect(b1.weekIndex).toBe(b2.weekIndex);
  });
});

describe('getWeeklyBoss — totalHp and pool bounds', () => {
  const boss = getWeeklyBoss();

  it('totalHp is at least 40000 (minimum pool entry)', () => {
    expect(boss.totalHp).toBeGreaterThanOrEqual(40_000);
  });

  it('totalHp is at most 180000 (maximum pool entry)', () => {
    expect(boss.totalHp).toBeLessThanOrEqual(180_000);
  });

  it('weekIndex % 8 is in range [0, 7] (pool has 8 entries)', () => {
    expect(boss.weekIndex % 8).toBeGreaterThanOrEqual(0);
    expect(boss.weekIndex % 8).toBeLessThanOrEqual(7);
  });

  it('skinShards is exactly 5', () => {
    expect(boss.rewards.skinShards).toBe(5);
  });

  it('bossType contains only lowercase letters and underscores', () => {
    expect(boss.bossType).toMatch(/^[a-z_]+$/);
  });
});

// ─── getDailyDungeon — elementRestrict and materials ─────────────────────────

describe('getDailyDungeon — elementRestrict field', () => {
  const dungeon = getDailyDungeon();

  it('rewards.materials is always ["common_ore", "magic_dust"]', () => {
    expect(dungeon.rewards.materials).toEqual(['common_ore', 'magic_dust']);
  });

  it('elementRestrict is either a string or undefined — never null', () => {
    const v = dungeon.elementRestrict;
    expect(v === undefined || typeof v === 'string').toBe(true);
  });

  it('when rule is element_restrict, elementRestrict is a valid element', () => {
    const VALID = new Set(['fire', 'frost', 'lightning', 'dark', 'holy']);
    if (dungeon.rule === 'element_restrict') {
      expect(dungeon.elementRestrict).toBeDefined();
      expect(VALID.has(dungeon.elementRestrict as string)).toBe(true);
    }
  });

  it('when rule is not element_restrict, elementRestrict is undefined', () => {
    if (dungeon.rule !== 'element_restrict') {
      expect(dungeon.elementRestrict).toBeUndefined();
    }
  });

  it('rule is one of the 4 valid types (element_restrict, gold_rush, speed_run, boss_rush)', () => {
    const VALID_RULES = ['element_restrict', 'gold_rush', 'speed_run', 'boss_rush'];
    expect(VALID_RULES).toContain(dungeon.rule);
  });
});

// ─── getDailyDungeon — wave invader group counts & boss flags ─────────────────

describe('getDailyDungeon — wave invader grouping & clearReward formulas', () => {
  const dungeon = getDailyDungeon();

  it('waves 1–2 have exactly 1 invader group each (w < 3: no second group added)', () => {
    for (const wv of dungeon.waves.filter(wv => (wv.wave ?? 0) <= 2)) {
      expect(wv.invaders).toHaveLength(1);
    }
  });

  it('waves 3–8 have exactly 2 invader groups each (w >= 3: second group pushed)', () => {
    for (const wv of dungeon.waves.filter(wv => (wv.wave ?? 0) >= 3 && (wv.wave ?? 0) <= 8)) {
      expect(wv.invaders).toHaveLength(2);
    }
  });

  it('waves 1–8 have no invader with isBoss=true (boss only in waves 9–10)', () => {
    for (const wv of dungeon.waves.filter(wv => (wv.wave ?? 0) <= 8)) {
      for (const inv of wv.invaders) {
        expect(inv.isBoss).not.toBe(true);
      }
    }
  });

  it('wave 9 clearReward: boss_rush → 350, others → 220', () => {
    const wave9 = dungeon.waves.find(w => w.wave === 9)!;
    const expected = dungeon.rule === 'boss_rush' ? 350 : 220;
    expect(wave9.clearReward).toBe(expected);
  });

  it('wave 10 clearReward: boss_rush → 600, others → 450', () => {
    const wave10 = dungeon.waves.find(w => w.wave === 10)!;
    const expected = dungeon.rule === 'boss_rush' ? 600 : 450;
    expect(wave10.clearReward).toBe(expected);
  });

  it('all 3 daily challenges include gems in their reward (every template grants gems)', () => {
    for (const ch of getDailyChallenges()) {
      expect(ch.reward.gems).toBeGreaterThan(0);
    }
  });

  it('tickDailyChallenge with no amount arg defaults to 1 — progress increases by exactly 1', () => {
    const [ch] = getDailyChallenges();
    const gs1  = makeGs();
    const gs2  = tickDailyChallenge(gs1, ch.objective.type);   // amount omitted
    const gs3  = tickDailyChallenge(gs2, ch.objective.type);   // second tick
    const p1   = gs2.dailyChallenges?.[ch.id]?.progress ?? 0;
    const p2   = gs3.dailyChallenges?.[ch.id]?.progress ?? 0;
    // Each tick increments by 1 unless already completed
    expect(p1).toBe(Math.min(1, ch.objective.target));
    expect(p2).toBe(Math.min(2, ch.objective.target));
  });
});
