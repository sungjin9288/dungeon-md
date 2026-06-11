import { describe, expect, it } from 'vitest';
import { applyDailyChallengeTick, getDailyChallenges, getTodayString, tickDailyChallenge } from './daily';
import {
  applyEndlessRunReward,
  applyWaveClearDailyChallengeProgress,
  applyWaveClearDailyChallenges,
} from './waveTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    soulCrystals: 0,
    endlessHighScore: 0,
    dailyChallengeDate: '',
    dailyChallenges: {},
    ...overrides,
  } as GameState;
}

describe('waveTransactions — endless reward', () => {
  it('adds endless crystals and records a new high score without mutating input', () => {
    const state = makeState({ soulCrystals: 5, endlessHighScore: 15 });

    const result = applyEndlessRunReward(state, 20, 1.5);

    expect(result.crystalsEarned).toBe(9);
    expect(result.previousBest).toBe(15);
    expect(result.isNewRecord).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.soulCrystals).toBe(14);
    expect(result.state.endlessHighScore).toBe(20);
    expect(state.soulCrystals).toBe(5);
    expect(state.endlessHighScore).toBe(15);
  });

  it('preserves the previous high score when the run is not a record', () => {
    const state = makeState({ soulCrystals: 0, endlessHighScore: 50 });

    const result = applyEndlessRunReward(state, 20, 1);

    expect(result.crystalsEarned).toBe(6);
    expect(result.previousBest).toBe(50);
    expect(result.isNewRecord).toBe(false);
    expect(result.state.endlessHighScore).toBe(50);
  });
});

describe('waveTransactions — daily challenge progress', () => {
  it('applies the same result as a wave_clear daily challenge tick', () => {
    const state = makeState({
      dailyChallengeDate: '2000-01-01',
      dailyChallenges: {
        'dc-old-0': { completed: false, progress: 99 },
      },
    });

    const result = applyWaveClearDailyChallenges(state, false);
    const expected = tickDailyChallenge(state, 'wave_clear');

    expect(result).toEqual(expected);
    expect(result).not.toBe(state);
    expect(state.dailyChallenges).toEqual({
      'dc-old-0': { completed: false, progress: 99 },
    });
  });

  it('also applies no_damage progress when the wave took no damage', () => {
    const state = makeState();

    const result = applyWaveClearDailyChallenges(state, true);
    const expected = tickDailyChallenge(
      tickDailyChallenge(state, 'wave_clear'),
      'no_damage',
    );

    expect(result).toEqual(expected);
  });

  it('returns result metadata for wave_clear and no_damage challenge progress', () => {
    const state = makeState({
      gems: 50,
      dailyChallengeDate: '2000-01-01',
      dailyChallenges: {
        'dc-old-0': { completed: false, progress: 99 },
      },
    });

    const result = applyWaveClearDailyChallengeProgress(state, true);
    const waveExpected = applyDailyChallengeTick(state, 'wave_clear');
    const noDamageExpected = applyDailyChallengeTick(waveExpected.state, 'no_damage');

    expect(result.state).toEqual(noDamageExpected.state);
    expect(result.changed).toBe(waveExpected.changed || noDamageExpected.changed);
    expect(result.completedIds).toEqual([
      ...waveExpected.completedIds,
      ...noDamageExpected.completedIds,
    ]);
    expect(result.rewardGems).toBe(waveExpected.rewardGems + noDamageExpected.rewardGems);
    expect(state.dailyChallenges).toEqual({
      'dc-old-0': { completed: false, progress: 99 },
    });
  });

  it('returns the same state when matching daily challenges are already completed', () => {
    const completedMap: Record<string, { completed: boolean; progress: number }> = {};
    for (const challenge of getDailyChallenges()) {
      if (challenge.objective.type === 'wave_clear' || challenge.objective.type === 'no_damage') {
        completedMap[challenge.id] = {
          completed: true,
          progress: challenge.objective.target,
        };
      }
    }
    const state = makeState({
      dailyChallengeDate: getTodayString(),
      dailyChallenges: completedMap,
    });

    const result = applyWaveClearDailyChallengeProgress(state, true);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.completedIds).toEqual([]);
    expect(result.rewardGems).toBe(0);
  });
});
