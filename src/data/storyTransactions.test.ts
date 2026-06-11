import { describe, expect, it } from 'vitest';
import {
  applyGameCompletionReward,
  markCinematicSeen,
} from './storyTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    soulCrystals: 0,
    cinematicSeen: [],
    gameCompleted: false,
    ...overrides,
  } as GameState;
}

describe('storyTransactions — cinematics', () => {
  it('marks a cinematic as seen without mutating the original state', () => {
    const state = makeState({ cinematicSeen: ['intro'] });

    const result = markCinematicSeen(state, 'ch1_clear');

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.cinematicSeen).toEqual(['intro', 'ch1_clear']);
    expect(state.cinematicSeen).toEqual(['intro']);
  });

  it('returns unchanged state when the cinematic is already seen', () => {
    const state = makeState({ cinematicSeen: ['intro'] });

    const result = markCinematicSeen(state, 'intro');

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });
});

describe('storyTransactions — game completion', () => {
  it('grants the first-clear soul crystal bonus and marks completion', () => {
    const state = makeState({ soulCrystals: 20, gameCompleted: false });

    const result = applyGameCompletionReward(state, 50);

    expect(result.changed).toBe(true);
    expect(result.soulCrystalBonus).toBe(50);
    expect(result.state).not.toBe(state);
    expect(result.state.soulCrystals).toBe(70);
    expect(result.state.gameCompleted).toBe(true);
    expect(state.soulCrystals).toBe(20);
    expect(state.gameCompleted).toBe(false);
  });

  it('does not grant the completion reward twice', () => {
    const state = makeState({ soulCrystals: 70, gameCompleted: true });

    const result = applyGameCompletionReward(state, 50);

    expect(result.changed).toBe(false);
    expect(result.soulCrystalBonus).toBe(0);
    expect(result.state).toBe(state);
  });
});
