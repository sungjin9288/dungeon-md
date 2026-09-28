import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import { getDailyChallenges, getTodayString } from './daily';
import {
  applyInvaderKillProgress,
  applyQuestObjectiveProgress,
  applyConsecutiveDayProgress,
  buildAchievementContext,
  grantMonsterRosterXp,
  unlockAvailableAchievements,
} from './progressionTransactions';
import { startQuest } from './quests';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    totalKills: 0,
    totalGoldEarned: 0,
    roomsBuilt: [],
    bossesKilled: [],
    endlessHighScore: 0,
    consecutiveDays: 0,
    lastPlayDate: '',
    soulCrystals: 0,
    gems: 0,
    homeGold: 0,
    dmXP: 0,
    wisdomTree: {},
    stageProgress: [],
    dmLevel: 1,
    unlockedFeatures: [],
    ownedMonsters: [],
    ownedSkins: {},
    totalFusions: 0,
    completedTribes: 0,
    summonHistory: [],
    achievements: {},
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

describe('progressionTransactions — achievements', () => {
  it('builds the achievement context from GameState counters', () => {
    const state = makeState({
      totalKills: 7,
      totalGoldEarned: 200,
      roomsBuilt: ['trap_room'],
      bossesKilled: ['dragon_king'],
      endlessHighScore: 11,
      consecutiveDays: 3,
      soulCrystals: 9,
      wisdomTree: { combat: 2 },
      stageProgress: [{ unlocked: true, bestStars: 3 }],
      dmLevel: 6,
      ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')],
      ownedSkins: { dokkaebi_warrior: ['divine_warrior'] },
      totalFusions: 4,
      completedTribes: 1,
      summonHistory: [
        {
          type: 'normal',
          monsterId: 'dokkaebi_warrior',
          rarity: 'common',
          isNew: false,
          timestamp: 1,
        },
      ],
    });

    const context = buildAchievementContext(state);

    expect(context.totalKills).toBe(7);
    expect(context.ownedMonsterCount).toBe(1);
    expect(context.ownedSkinCount).toBe(1);
    expect(context.questSkinsOwned).toBe(1);
    expect(context.totalSummons).toBe(1);
    expect(context.stageProgress).toEqual([{ unlocked: true, bestStars: 3 }]);
  });

  it('unlocks newly qualified achievements without mutating the input state', () => {
    const state = makeState({ totalKills: 1 });

    const result = unlockAvailableAchievements(state, 1234);

    expect(result.changed).toBe(true);
    expect(result.unlockedIds).toContain('first_blood');
    expect(result.state).not.toBe(state);
    expect(result.state.achievements.first_blood).toEqual({
      unlocked: true,
      current: 0,
      unlockedAt: 1234,
    });
    expect(state.achievements.first_blood).toBeUndefined();
  });

  it('returns the same state when no achievements newly qualify', () => {
    const state = makeState({
      totalKills: 1,
      achievements: {
        first_blood: { unlocked: true, current: 0, unlockedAt: 1 },
      },
    });

    const result = unlockAvailableAchievements(state, 1234);

    expect(result.changed).toBe(false);
    expect(result.unlockedIds).toEqual([]);
    expect(result.state).toBe(state);
  });

  // Regression guard: the higher-tier batch achievements must unlock end-to-end
  // when their tracked metric crosses target. Catches a getProgress reading a
  // field that buildAchievementContext doesn't populate (would stay 0 forever).
  it('unlocks the higher-tier batch achievements when their metric crosses target', () => {
    const state = makeState({
      totalKills: 10000,
      totalGoldEarned: 1000000,
      endlessHighScore: 300,
      ownedMonsters: Array.from({ length: 200 }, () =>
        defaultOwnedMonster('dokkaebi_warrior'),
      ),
    });

    const result = unlockAvailableAchievements(state, 1234);

    expect(result.unlockedIds).toContain('slayer_10000');
    expect(result.unlockedIds).toContain('gold_million');
    expect(result.unlockedIds).toContain('endless_wave300');
    expect(result.unlockedIds).toContain('codex_200');
  });

  it('does NOT unlock the batch achievements one short of target', () => {
    const state = makeState({
      totalKills: 9999,
      totalGoldEarned: 999999,
      endlessHighScore: 299,
      ownedMonsters: Array.from({ length: 199 }, () =>
        defaultOwnedMonster('dokkaebi_warrior'),
      ),
    });

    const result = unlockAvailableAchievements(state, 1234);

    expect(result.unlockedIds).not.toContain('slayer_10000');
    expect(result.unlockedIds).not.toContain('gold_million');
    expect(result.unlockedIds).not.toContain('endless_wave300');
    expect(result.unlockedIds).not.toContain('codex_200');
  });
});

describe('progressionTransactions — monster XP', () => {
  it('grants XP to every owned monster and reports level-ups', () => {
    const monster = defaultOwnedMonster('dokkaebi_warrior');
    const state = makeState({ ownedMonsters: [monster] });

    const result = grantMonsterRosterXp(state, 100);

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.ownedMonsters[0].level).toBe(2);
    expect(result.levelUps).toEqual([
      { monsterId: 'dokkaebi_warrior', previousLevel: 1, newLevel: 2 },
    ]);
    expect(monster.level).toBe(1);
    expect(monster.xp).toBe(0);
  });

  it('updates XP without reporting a level-up when below threshold', () => {
    const state = makeState({ ownedMonsters: [defaultOwnedMonster('dokkaebi_warrior')] });

    const result = grantMonsterRosterXp(state, 50);

    expect(result.changed).toBe(true);
    expect(result.levelUps).toEqual([]);
    expect(result.state.ownedMonsters[0].xp).toBe(50);
    expect(state.ownedMonsters[0].xp).toBe(0);
  });

  it('returns unchanged state when there are no owned monsters', () => {
    const state = makeState({ ownedMonsters: [] });

    const result = grantMonsterRosterXp(state, 50);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });
});

describe('progressionTransactions — quest objective progress', () => {
  // Completion is Home's job (settleCompletedHomeMainQuest) — see §34.
  it('ticks main and sub quest progress and reports completion without completing or mutating input', () => {
    const state = startQuest(makeState({
      activeSubQuestIds: ['SQ-006'],
      subQuestProgress: { 'SQ-006': 0 },
    }), 'MQ-001');

    const result = applyQuestObjectiveProgress(state, 'build_room');

    expect(result.changed).toBe(true);
    expect(result.questDone).toBe(true);
    expect(result.state.questProgress['MQ-001'].objectives.O1).toBe(1);
    expect(result.state.questProgress['MQ-001'].completed).toBe(false);
    expect(result.state.activeMainQuestId).toBe('MQ-001');
    expect(result.state.subQuestProgress['SQ-006']).toBe(1);
    expect(result.state.homeGold).toBe(0);
    expect(state.questProgress['MQ-001'].objectives.O1).toBe(0);
    expect(state.subQuestProgress['SQ-006']).toBe(0);
    expect(state.homeGold).toBe(0);
  });
});

describe('progressionTransactions — invader kill progress', () => {
  it('records kill counters and applies kill_count daily progress without mutating input', () => {
    const state = makeState({
      totalKills: 2,
      totalGoldEarned: 30,
      bossesKilled: ['knight'],
      gems: 5,
      dailyChallengeDate: '2000-01-01',
      dailyChallenges: {
        'dc-old-0': { completed: false, progress: 99 },
      },
    });

    const result = applyInvaderKillProgress(state, 'shaman');

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.totalKills).toBe(3);
    expect(result.state.totalGoldEarned).toBe(30); // loot counts at settlement (§34)
    expect(result.state.bossesKilled).toEqual(['knight', 'shaman']);
    expect(result.state.dailyChallengeDate).toBe(getTodayString());
    expect(result.state.dailyChallenges['dc-old-0']).toBeUndefined();
    for (const challenge of getDailyChallenges().filter(ch => ch.objective.type === 'kill_count')) {
      expect(result.state.dailyChallenges[challenge.id]?.progress).toBe(1);
    }
    expect(state.totalKills).toBe(2);
    expect(state.totalGoldEarned).toBe(30);
    expect(state.bossesKilled).toEqual(['knight']);
  });
});

describe('progressionTransactions — consecutive days', () => {
  it('increments streak when the last play date was yesterday', () => {
    const state = makeState({ lastPlayDate: '2026-05-12', consecutiveDays: 4 });

    const result = applyConsecutiveDayProgress(state, '2026-05-13');

    expect(result.changed).toBe(true);
    expect(result.state.consecutiveDays).toBe(5);
    expect(result.state.lastPlayDate).toBe('2026-05-13');
    expect(state.consecutiveDays).toBe(4);
  });

  it('resets streak when the last play date is older than yesterday', () => {
    const state = makeState({ lastPlayDate: '2026-05-10', consecutiveDays: 4 });

    const result = applyConsecutiveDayProgress(state, '2026-05-13');

    expect(result.state.consecutiveDays).toBe(1);
    expect(result.state.lastPlayDate).toBe('2026-05-13');
  });

  it('returns unchanged state when today was already tracked', () => {
    const state = makeState({ lastPlayDate: '2026-05-13', consecutiveDays: 4 });

    const result = applyConsecutiveDayProgress(state, '2026-05-13');

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });
});
