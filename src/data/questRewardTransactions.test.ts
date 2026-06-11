import { describe, expect, it } from 'vitest';
import {
  applyMainQuestCompletionRewards,
  QUEST_BLUEPRINT_REWARDS,
} from './questRewardTransactions';
import { STARTER_BLUEPRINTS } from './fusion';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    blueprints: [],
    awakeningStones: 0,
    ...overrides,
  } as GameState;
}

describe('questRewardTransactions — main quest completion rewards', () => {
  it('grants missing starter blueprints for MQ-007 without mutating input', () => {
    const state = makeState({ blueprints: [STARTER_BLUEPRINTS[0]], awakeningStones: 2 });

    const result = applyMainQuestCompletionRewards(state, 'MQ-007');

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.unlockedBlueprintIds).toEqual([STARTER_BLUEPRINTS[1]]);
    expect(result.state.blueprints).toEqual(STARTER_BLUEPRINTS);
    expect(result.state.awakeningStones).toBe(2);
    expect(state.blueprints).toEqual([STARTER_BLUEPRINTS[0]]);
  });

  it('does not duplicate quest blueprint rewards that are already owned', () => {
    const blueprintId = QUEST_BLUEPRINT_REWARDS['MQ-015'];
    const state = makeState({ blueprints: [blueprintId] });

    const result = applyMainQuestCompletionRewards(state, 'MQ-015');

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.unlockedBlueprintIds).toEqual([]);
    expect(result.state.blueprints).toEqual([blueprintId]);
  });

  it('grants chapter blueprint rewards for configured quest ids', () => {
    const result = applyMainQuestCompletionRewards(makeState(), 'MQ-044');

    expect(result.changed).toBe(true);
    expect(result.unlockedBlueprintIds).toEqual(['bp_primordial_gem']);
    expect(result.state.blueprints).toEqual(['bp_primordial_gem']);
  });

  it('grants one awakening stone for MQ-010', () => {
    const result = applyMainQuestCompletionRewards(makeState({ awakeningStones: 3 }), 'MQ-010');

    expect(result.changed).toBe(true);
    expect(result.awakeningStonesAwarded).toBe(1);
    expect(result.state.awakeningStones).toBe(4);
  });

  it('returns the same state when the quest has no extra completion rewards', () => {
    const state = makeState({ blueprints: ['bp_existing'], awakeningStones: 1 });

    const result = applyMainQuestCompletionRewards(state, 'MQ-001');

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.unlockedBlueprintIds).toEqual([]);
    expect(result.awakeningStonesAwarded).toBe(0);
  });
});
