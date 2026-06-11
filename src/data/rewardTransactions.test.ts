import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import {
  claimAchievementReward,
  claimCodexTribeReward,
} from './rewardTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gems: 0,
    soulCrystals: 0,
    achievements: {},
    ownedMonsters: [],
    codexRewardsClaimed: [],
    completedTribes: 0,
    ...overrides,
  } as GameState;
}

describe('rewardTransactions — achievement rewards', () => {
  it('claims an unlocked achievement reward and preserves input state', () => {
    const state = makeState({
      gems: 2,
      soulCrystals: 3,
      achievements: {
        first_blood: { unlocked: true, current: 1 },
      },
    });

    const result = claimAchievementReward(state, 'first_blood', { gems: 5, soulCrystals: 7 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).not.toBe(state);
    expect(result.state.gems).toBe(7);
    expect(result.state.soulCrystals).toBe(10);
    expect(result.state.achievements.first_blood.rewardClaimed).toBe(true);
    expect(state.gems).toBe(2);
    expect(state.soulCrystals).toBe(3);
    expect(state.achievements.first_blood.rewardClaimed).toBeUndefined();
  });

  it('fails without changing state when the achievement is locked or missing', () => {
    const locked = makeState({
      achievements: {
        first_blood: { unlocked: false, current: 0 },
      },
    });
    const missing = makeState();

    const lockedResult = claimAchievementReward(locked, 'first_blood', { gems: 5 });
    const missingResult = claimAchievementReward(missing, 'missing', { gems: 5 });

    expect(lockedResult.ok).toBe(false);
    if (!lockedResult.ok) {
      expect(lockedResult.reason).toBe('achievement_not_unlocked');
      expect(lockedResult.state).toBe(locked);
    }
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.reason).toBe('achievement_not_unlocked');
      expect(missingResult.state).toBe(missing);
    }
  });

  it('fails without changing state when the reward was already claimed', () => {
    const state = makeState({
      achievements: {
        first_blood: { unlocked: true, current: 1, rewardClaimed: true },
      },
    });

    const result = claimAchievementReward(state, 'first_blood', { gems: 5 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('achievement_reward_already_claimed');
    expect(result.state).toBe(state);
  });
});

describe('rewardTransactions — codex tribe rewards', () => {
  it('claims a codex tribe reward and adds the reward monster', () => {
    const state = makeState({
      ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')],
      codexRewardsClaimed: ['gumiho'],
      completedTribes: 1,
    });

    const result = claimCodexTribeReward(state, 'dokkaebi', 'dokkaebi_god_king');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).not.toBe(state);
    expect(result.state.codexRewardsClaimed).toEqual(['gumiho', 'dokkaebi']);
    expect(result.state.completedTribes).toBe(2);
    expect(result.state.ownedMonsters.map(monster => monster.id)).toEqual([
      'dokkaebi_warrior',
      'dokkaebi_god_king',
    ]);
    expect(state.codexRewardsClaimed).toEqual(['gumiho']);
    expect(state.ownedMonsters.map(monster => monster.id)).toEqual(['dokkaebi_warrior']);
  });

  it('claims the tribe without duplicating an already owned reward monster', () => {
    const rewardMonster = defaultOwnedMonster('dokkaebi_god_king');
    const state = makeState({
      ownedMonsters: [rewardMonster],
      codexRewardsClaimed: [],
      completedTribes: 0,
    });

    const result = claimCodexTribeReward(state, 'dokkaebi', 'dokkaebi_god_king');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownedMonsters).toBe(state.ownedMonsters);
    expect(result.state.ownedMonsters).toEqual([rewardMonster]);
    expect(result.state.codexRewardsClaimed).toEqual(['dokkaebi']);
    expect(result.state.completedTribes).toBe(1);
  });

  it('fails without changing state when the codex reward was already claimed', () => {
    const state = makeState({
      ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')],
      codexRewardsClaimed: ['dokkaebi'],
      completedTribes: 1,
    });

    const result = claimCodexTribeReward(state, 'dokkaebi', 'dokkaebi_god_king');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('codex_reward_already_claimed');
    expect(result.state).toBe(state);
  });

  it('fails without changing state when the reward monster is unknown', () => {
    const state = makeState({
      ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')],
    });

    const result = claimCodexTribeReward(state, 'dokkaebi', 'missing_monster' as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unknown_codex_reward');
    expect(result.state).toBe(state);
  });
});
