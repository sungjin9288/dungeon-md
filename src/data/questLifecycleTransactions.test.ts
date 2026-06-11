import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceCompletedMainQuest,
  initializeHomeQuestState,
  settleCompletedHomeMainQuest,
} from './questLifecycleTransactions';
import { STARTER_BLUEPRINTS } from './fusion';
import { SUB_QUEST_POOL, getQuest, startQuest } from './quests';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    activeMainQuestId: '',
    questProgress: {},
    dmLevel: 1,
    dmXP: 0,
    homeGold: 0,
    gems: 0,
    soulCrystals: 0,
    totalGoldEarned: 0,
    unlockedFeatures: [],
    blueprints: [],
    awakeningStones: 0,
    ownedSkins: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

function makeCompletedQuestState(questId: string, overrides: Partial<GameState> = {}): GameState {
  const started = startQuest(makeState(overrides), questId);
  const quest = getQuest(questId);
  if (!quest) return started;

  return {
    ...started,
    questProgress: {
      ...started.questProgress,
      [questId]: {
        ...started.questProgress[questId],
        objectives: Object.fromEntries(
          quest.objectives.map(objective => [objective.id, objective.target]),
        ),
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('questLifecycleTransactions — home quest initialization', () => {
  it('starts the default main quest and fills empty sub-quest slots', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = initializeHomeQuestState(makeState());

    expect(result.changed).toBe(true);
    expect(result.startedMainQuestId).toBe('MQ-001');
    expect(result.state.activeMainQuestId).toBe('MQ-001');
    expect(result.state.questProgress['MQ-001']).toBeDefined();
    expect(result.assignedSubQuestIds).toEqual([
      SUB_QUEST_POOL[0].id,
      SUB_QUEST_POOL[1].id,
    ]);
    expect(result.state.activeSubQuestIds).toEqual(result.assignedSubQuestIds);
  });

  it('returns the same state when main and sub-quest state is already initialized', () => {
    const state = makeState({
      activeMainQuestId: 'MQ-001',
      questProgress: {
        'MQ-001': { completed: false, objectives: { O1: 0 } },
      },
      activeSubQuestIds: ['SQ-001', 'SQ-002'],
      subQuestProgress: { 'SQ-001': 0, 'SQ-002': 0 },
      completedSubQuestIds: [],
    });

    const result = initializeHomeQuestState(state);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.startedMainQuestId).toBeNull();
    expect(result.assignedSubQuestIds).toEqual([]);
  });

  it('preserves the active main quest and fills only missing sub-quest slots', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = makeState({
      activeMainQuestId: 'MQ-004',
      questProgress: {
        'MQ-004': { completed: false, objectives: { O1: 0 } },
      },
      activeSubQuestIds: [SUB_QUEST_POOL[0].id],
      subQuestProgress: { [SUB_QUEST_POOL[0].id]: 0 },
    });

    const result = initializeHomeQuestState(state);

    expect(result.changed).toBe(true);
    expect(result.startedMainQuestId).toBeNull();
    expect(result.state.activeMainQuestId).toBe('MQ-004');
    expect(result.state.activeSubQuestIds).toEqual([
      SUB_QUEST_POOL[0].id,
      SUB_QUEST_POOL[1].id,
    ]);
    expect(result.assignedSubQuestIds).toEqual([SUB_QUEST_POOL[1].id]);
  });

  it('normalizes stale saves with missing sub-quest containers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = makeState({
      activeMainQuestId: 'MQ-001',
      activeSubQuestIds: undefined as unknown as string[],
      subQuestProgress: undefined as unknown as Record<string, number>,
      completedSubQuestIds: undefined as unknown as string[],
    });

    const result = initializeHomeQuestState(state);

    expect(result.changed).toBe(true);
    expect(result.state.activeSubQuestIds).toEqual([
      SUB_QUEST_POOL[0].id,
      SUB_QUEST_POOL[1].id,
    ]);
    expect(result.state.subQuestProgress[SUB_QUEST_POOL[0].id]).toBe(0);
    expect(result.state.completedSubQuestIds).toEqual([]);
  });

  it('does not start an unknown initial quest id', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = initializeHomeQuestState(makeState(), 'MQ-MISSING');

    expect(result.changed).toBe(true);
    expect(result.startedMainQuestId).toBeNull();
    expect(result.state.activeMainQuestId).toBe('');
    expect(result.state.questProgress).toEqual({});
    expect(result.assignedSubQuestIds).toHaveLength(2);
  });
});

describe('questLifecycleTransactions — main quest completion advancement', () => {
  it('advances a completed quest, starts the next quest, and reports completion payload', () => {
    const started = startQuest(makeState(), 'MQ-003');
    const state = {
      ...started,
      questProgress: {
        ...started.questProgress,
        'MQ-003': {
          ...started.questProgress['MQ-003'],
          objectives: { O1: 1 },
        },
      },
    };

    const result = advanceCompletedMainQuest(state);

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.completion?.completedQuest.id).toBe('MQ-003');
    expect(result.completion?.nextQuestId).toBe('MQ-004');
    expect(result.state.questProgress['MQ-003'].completed).toBe(true);
    expect(result.state.activeMainQuestId).toBe('MQ-004');
    expect(result.state.questProgress['MQ-004']).toBeDefined();
  });

  it('returns unchanged state and no completion when no active quest can advance', () => {
    const state = makeState({ activeMainQuestId: 'MQ-MISSING' });

    const result = advanceCompletedMainQuest(state);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.completion).toBeNull();
  });
});

describe('questLifecycleTransactions — home main quest completion settlement', () => {
  it('advances a completed quest and applies extra completion rewards in one result', () => {
    const state = makeCompletedQuestState('MQ-007', {
      blueprints: [STARTER_BLUEPRINTS[0]],
      awakeningStones: 2,
    });

    const result = settleCompletedHomeMainQuest(state);

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.completion?.completedQuest.id).toBe('MQ-007');
    expect(result.unlockedBlueprintIds).toEqual([STARTER_BLUEPRINTS[1]]);
    expect(result.awakeningStonesAwarded).toBe(0);
    expect(result.state.blueprints).toEqual(STARTER_BLUEPRINTS);
    expect(result.state.awakeningStones).toBe(2);
    expect(result.state.questProgress['MQ-007'].completed).toBe(true);
    expect(state.blueprints).toEqual([STARTER_BLUEPRINTS[0]]);
  });

  it('reports chapter completion and awakening stone rewards for MQ-010', () => {
    const state = makeCompletedQuestState('MQ-010', { awakeningStones: 0 });

    const result = settleCompletedHomeMainQuest(state);

    expect(result.changed).toBe(true);
    expect(result.completion?.completedQuest.id).toBe('MQ-010');
    expect(result.pendingUnlock).toBe(result.completion?.unlocks[0] ?? null);
    expect(result.chapterCompleted).toBe(true);
    expect(result.gameCompleted).toBe(false);
    expect(result.awakeningStonesAwarded).toBe(1);
    expect(result.state.awakeningStones).toBe(1);
  });

  it('returns unchanged metadata when no active quest can be completed', () => {
    const state = makeState({ activeMainQuestId: 'MQ-MISSING' });

    const result = settleCompletedHomeMainQuest(state);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.completion).toBeNull();
    expect(result.pendingUnlock).toBeNull();
    expect(result.chapterCompleted).toBe(false);
    expect(result.gameCompleted).toBe(false);
    expect(result.unlockedBlueprintIds).toEqual([]);
    expect(result.awakeningStonesAwarded).toBe(0);
  });
});
