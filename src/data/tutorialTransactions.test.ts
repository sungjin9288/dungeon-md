import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_DONE_STAGE,
  advanceTutorialStage,
  settleTutorialStageAdvance,
} from './tutorialTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    tutorialStage: 0,
    ...overrides,
  } as GameState;
}

describe('tutorialTransactions — tutorial stage advancement', () => {
  it('advances the persisted tutorial stage without mutating input state', () => {
    const state = makeState({ tutorialStage: 0 });

    const result = advanceTutorialStage(state, 2);

    expect(result.changed).toBe(true);
    expect(result.stage).toBe(2);
    expect(result.state).not.toBe(state);
    expect(result.state.tutorialStage).toBe(2);
    expect(state.tutorialStage).toBe(0);
  });

  it('returns the same state when the requested stage is already persisted', () => {
    const state = makeState({ tutorialStage: 2 });

    const result = advanceTutorialStage(state, 2);

    expect(result.changed).toBe(false);
    expect(result.stage).toBe(2);
    expect(result.state).toBe(state);
  });

  it('does not regress when a stale overlay callback reports an older stage', () => {
    const state = makeState({ tutorialStage: 99 });

    const result = advanceTutorialStage(state, 3);

    expect(result.changed).toBe(false);
    expect(result.stage).toBe(99);
    expect(result.state).toBe(state);
  });

  it('treats missing tutorialStage as zero before advancing', () => {
    const state = makeState({ tutorialStage: undefined as unknown as number });

    const result = advanceTutorialStage(state, 1);

    expect(result.changed).toBe(true);
    expect(result.stage).toBe(1);
    expect(result.state.tutorialStage).toBe(1);
  });
});

describe('tutorialTransactions — tutorial flow advancement', () => {
  it('reports the next overlay stage while the tutorial is still active', () => {
    const state = makeState({ tutorialStage: 1 });

    const result = settleTutorialStageAdvance(state, 2);

    expect(result.changed).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.nextStage).toBe(2);
    expect(result.stage).toBe(2);
    expect(result.state.tutorialStage).toBe(2);
  });

  it('reports completion and no next stage when the done stage is reached', () => {
    const state = makeState({ tutorialStage: 4 });

    const result = settleTutorialStageAdvance(state, TUTORIAL_DONE_STAGE);

    expect(result.changed).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.nextStage).toBeNull();
    expect(result.stage).toBe(TUTORIAL_DONE_STAGE);
    expect(result.state.tutorialStage).toBe(TUTORIAL_DONE_STAGE);
  });

  it('does not reopen an overlay when a stale callback arrives after completion', () => {
    const state = makeState({ tutorialStage: TUTORIAL_DONE_STAGE });

    const result = settleTutorialStageAdvance(state, 3);

    expect(result.changed).toBe(false);
    expect(result.completed).toBe(true);
    expect(result.nextStage).toBeNull();
    expect(result.state).toBe(state);
  });
});
