import type { GameState } from './wisdom';

export const TUTORIAL_DONE_STAGE = 99;

export interface TutorialStageAdvanceResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly stage: number;
}

export interface TutorialFlowAdvanceResult extends TutorialStageAdvanceResult {
  readonly completed: boolean;
  readonly nextStage: number | null;
}

export function advanceTutorialStage(
  state: GameState,
  requestedStage: number,
): TutorialStageAdvanceResult {
  const currentStage = state.tutorialStage ?? 0;
  const nextStage = Math.max(currentStage, requestedStage);

  if (nextStage === currentStage) {
    return { state, changed: false, stage: currentStage };
  }

  return {
    state: { ...state, tutorialStage: nextStage },
    changed: true,
    stage: nextStage,
  };
}

export function settleTutorialStageAdvance(
  state: GameState,
  requestedStage: number,
  doneStage = TUTORIAL_DONE_STAGE,
): TutorialFlowAdvanceResult {
  const result = advanceTutorialStage(state, requestedStage);
  const completed = result.stage >= doneStage;
  return {
    ...result,
    completed,
    nextStage: completed ? null : result.stage,
  };
}
