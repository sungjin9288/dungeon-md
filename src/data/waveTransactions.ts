import { applyDailyChallengeTick } from './daily';
import type { GameState } from './wisdom';

export interface EndlessRunRewardResult {
  state:          GameState;
  crystalsEarned: number;
  previousBest:   number;
  isNewRecord:    boolean;
}

export interface WaveClearDailyChallengeResult {
  state:        GameState;
  changed:      boolean;
  completedIds: string[];
  rewardGems:   number;
}

export function applyEndlessRunReward(
  state: GameState,
  wave: number,
  crystalEarnMult: number,
): EndlessRunRewardResult {
  const crystalsBase = Math.floor(wave / 5);
  const milestone = (wave >= 100 ? 10 : 0) + (wave >= 50 ? 5 : 0) + (wave >= 20 ? 2 : 0);
  const crystalsEarned = Math.round((crystalsBase + milestone) * crystalEarnMult);
  const previousBest = state.endlessHighScore ?? 0;
  const isNewRecord = wave > previousBest;

  return {
    state: {
      ...state,
      soulCrystals: (state.soulCrystals ?? 0) + crystalsEarned,
      endlessHighScore: Math.max(previousBest, wave),
    },
    crystalsEarned,
    previousBest,
    isNewRecord,
  };
}

export function applyWaveClearDailyChallenges(
  state: GameState,
  noDamage: boolean,
): GameState {
  return applyWaveClearDailyChallengeProgress(state, noDamage).state;
}

export function applyWaveClearDailyChallengeProgress(
  state: GameState,
  noDamage: boolean,
): WaveClearDailyChallengeResult {
  const waveClearResult = applyDailyChallengeTick(state, 'wave_clear');
  const noDamageResult = noDamage
    ? applyDailyChallengeTick(waveClearResult.state, 'no_damage')
    : null;
  const finalState = noDamageResult?.state ?? waveClearResult.state;

  return {
    state:        finalState,
    changed:      waveClearResult.changed || (noDamageResult?.changed ?? false),
    completedIds: [
      ...waveClearResult.completedIds,
      ...(noDamageResult?.completedIds ?? []),
    ],
    rewardGems:   waveClearResult.rewardGems + (noDamageResult?.rewardGems ?? 0),
  };
}
