import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import {
  claimAchievementReward,
  claimAllAchievementRewards,
  claimAllCodexTribeRewards,
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

describe('rewardTransactions — claim all achievement rewards', () => {
  const defs = [
    { id: 'a', reward: { gems: 5, soulCrystals: 7 } },
    { id: 'b', reward: { gems: 10 } },
    { id: 'c', reward: { soulCrystals: 3 } },
    { id: 'd', reward: { gems: 99 } },
  ];

  it('claims every unlocked + unclaimed reward, summing currencies', () => {
    const state = makeState({
      gems: 1, soulCrystals: 2,
      achievements: {
        a: { unlocked: true, current: 1 },
        b: { unlocked: true, current: 1, rewardClaimed: true },
        c: { unlocked: true, current: 1 },
        d: { unlocked: false, current: 0 },
      },
    });

    const r = claimAllAchievementRewards(state, defs);

    expect(r.claimedCount).toBe(2);        // a + c
    expect(r.gems).toBe(5);                // a:5 only
    expect(r.soulCrystals).toBe(10);       // a:7 + c:3
    expect(r.state.gems).toBe(6);
    expect(r.state.soulCrystals).toBe(12);
    expect(r.state.achievements.a.rewardClaimed).toBe(true);
    expect(r.state.achievements.c.rewardClaimed).toBe(true);
    expect(r.state.achievements.b.rewardClaimed).toBe(true);
    expect(r.state.achievements.d.rewardClaimed).toBeUndefined();
    // immutability — input untouched
    expect(state.gems).toBe(1);
    expect(state.achievements.a.rewardClaimed).toBeUndefined();
  });

  it('returns claimedCount 0 and the same state reference when nothing is claimable', () => {
    const state = makeState({
      achievements: {
        a: { unlocked: true, current: 1, rewardClaimed: true },
        d: { unlocked: false, current: 0 },
      },
    });

    const r = claimAllAchievementRewards(state, defs);

    expect(r.claimedCount).toBe(0);
    expect(r.gems).toBe(0);
    expect(r.soulCrystals).toBe(0);
    expect(r.state).toBe(state);
  });

  it('is idempotent — a second claim-all yields nothing', () => {
    const state = makeState({
      achievements: { a: { unlocked: true, current: 1 } },
    });

    const first = claimAllAchievementRewards(state, defs);
    expect(first.claimedCount).toBe(1);

    const second = claimAllAchievementRewards(first.state, defs);
    expect(second.claimedCount).toBe(0);
    expect(second.state).toBe(first.state);
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

describe('rewardTransactions — claim all codex tribe rewards', () => {
  it('claims every supplied tribe, skipping already-claimed, granting reward monsters', () => {
    const state = makeState({
      ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')],
      codexRewardsClaimed: ['gumiho'],
      completedTribes: 1,
    });

    const r = claimAllCodexTribeRewards(state, [
      { tribeId: 'gumiho',   rewardMonsterId: 'dokkaebi_god_king' }, // already claimed → skip
      { tribeId: 'dokkaebi', rewardMonsterId: 'dokkaebi_god_king' },
    ]);

    expect(r.claimedCount).toBe(1); // only dokkaebi
    expect(r.state.codexRewardsClaimed).toContain('dokkaebi');
    expect(r.state.ownedMonsters.map(m => m.id)).toContain('dokkaebi_god_king');
    // immutability — input untouched
    expect(state.codexRewardsClaimed).toEqual(['gumiho']);
    expect(state.ownedMonsters.map(m => m.id)).toEqual(['dokkaebi_warrior']);
  });

  it('returns claimedCount 0 and the same state when nothing is claimable', () => {
    const state = makeState({ codexRewardsClaimed: ['dokkaebi'] });
    const r = claimAllCodexTribeRewards(state, [
      { tribeId: 'dokkaebi', rewardMonsterId: 'dokkaebi_god_king' },
    ]);
    expect(r.claimedCount).toBe(0);
    expect(r.state).toBe(state);
  });
});
