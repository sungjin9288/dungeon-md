import { beforeEach, describe, expect, it } from 'vitest';
import { applyPrestigeStart } from './prestigeTransactions';
import { loadGameState, type GameState } from './wisdom';

beforeEach(() => {
  localStorage.clear();
});

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(),
    ...overrides,
  };
}

describe('prestigeTransactions — prestige start', () => {
  it('fails without changing state when the game has not been completed', () => {
    const state = makeState({ gameCompleted: false, prestigeLevel: 2 });

    const result = applyPrestigeStart(state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('game_not_completed');
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(state.prestigeLevel).toBe(2);
  });

  it('starts a prestige run after completion and reports the new bonus', () => {
    const state = makeState({
      gameCompleted: true,
      prestigeLevel: 2,
      homeGold: 9999,
      activeMainQuestId: 'MQ-044',
      dmLevel: 12,
      soulCrystals: 777,
      gems: 42,
    });
    state.wisdomTree.goldHands = 3;
    state.stageProgress[5] = { unlocked: true, bestStars: 3 };

    const result = applyPrestigeStart(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.previousPrestigeLevel).toBe(2);
    expect(result.nextPrestigeLevel).toBe(3);
    expect(result.damageMultiplier).toBeCloseTo(1.3);
    expect(result.state.prestigeLevel).toBe(3);
    expect(result.state.gameCompleted).toBe(false);
    expect(result.state.homeGold).toBe(200);
    expect(result.state.activeMainQuestId).toBe('MQ-001');
    expect(result.state.stageProgress[5]).toEqual({ unlocked: false, bestStars: 0 });
    expect(result.state.dmLevel).toBe(12);
    expect(result.state.soulCrystals).toBe(777);
    expect(result.state.gems).toBe(42);
    expect(result.state.wisdomTree.goldHands).toBe(3);
    expect(state.gameCompleted).toBe(true);
    expect(state.homeGold).toBe(9999);
  });
});
