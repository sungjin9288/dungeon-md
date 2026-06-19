import type { AchievementReward } from './achievements';
import { defaultOwnedMonster } from './barracks';
import { MONSTER_DEFS, type MonsterId } from './monsters';
import type { GameState } from './wisdom';

export type RewardTransactionFailureReason =
  | 'achievement_not_unlocked'
  | 'achievement_reward_already_claimed'
  | 'unknown_codex_reward'
  | 'codex_reward_already_claimed';

export type RewardTransactionResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; reason: RewardTransactionFailureReason };

export function claimAchievementReward(
  state: GameState,
  achievementId: string,
  reward: AchievementReward,
): RewardTransactionResult {
  const entry = state.achievements?.[achievementId];
  if (!entry?.unlocked) {
    return { ok: false, state, reason: 'achievement_not_unlocked' };
  }
  if (entry.rewardClaimed) {
    return { ok: false, state, reason: 'achievement_reward_already_claimed' };
  }

  return {
    ok: true,
    state: {
      ...state,
      gems:         (state.gems         ?? 0) + (reward.gems         ?? 0),
      soulCrystals: (state.soulCrystals ?? 0) + (reward.soulCrystals ?? 0),
      achievements: {
        ...state.achievements,
        [achievementId]: { ...entry, rewardClaimed: true },
      },
    },
  };
}

export interface ClaimAllAchievementsResult {
  state:        GameState;
  claimedCount: number;
  gems:         number;
  soulCrystals: number;
}

/**
 * Claim every unlocked-but-unclaimed achievement reward in one pass (QoL).
 * Folds over the per-achievement primitive so the same guards apply; returns
 * the input state reference unchanged when nothing was claimable.
 */
export function claimAllAchievementRewards(
  state: GameState,
  defs: readonly { id: string; reward: AchievementReward }[],
): ClaimAllAchievementsResult {
  let cur = state;
  let claimedCount = 0;
  let gems = 0;
  let soulCrystals = 0;
  for (const def of defs) {
    const res = claimAchievementReward(cur, def.id, def.reward);
    if (res.ok) {
      cur = res.state;
      claimedCount += 1;
      gems += def.reward.gems ?? 0;
      soulCrystals += def.reward.soulCrystals ?? 0;
    }
  }
  return { state: cur, claimedCount, gems, soulCrystals };
}

export function claimCodexTribeReward(
  state: GameState,
  tribeId: string,
  rewardMonsterId: MonsterId,
): RewardTransactionResult {
  if (!MONSTER_DEFS[rewardMonsterId]) {
    return { ok: false, state, reason: 'unknown_codex_reward' };
  }

  const previousClaimed = state.codexRewardsClaimed ?? [];
  if (previousClaimed.includes(tribeId)) {
    return { ok: false, state, reason: 'codex_reward_already_claimed' };
  }

  const alreadyOwned = (state.ownedMonsters ?? []).some(monster => monster.id === rewardMonsterId);
  const claimed = [...previousClaimed, tribeId];

  return {
    ok: true,
    state: {
      ...state,
      ownedMonsters: alreadyOwned
        ? state.ownedMonsters
        : [...(state.ownedMonsters ?? []), defaultOwnedMonster(rewardMonsterId)],
      codexRewardsClaimed: claimed,
      completedTribes: claimed.length,
    },
  };
}
