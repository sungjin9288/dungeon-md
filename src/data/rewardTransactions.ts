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
