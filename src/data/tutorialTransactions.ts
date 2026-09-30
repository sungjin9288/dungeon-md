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

/**
 * 이 튜토리얼 단계를 지금 보여줄 수 있는가 — 앞 단계가 시킨 일을 플레이어가 해냈을 때만.
 * 1 첫 방 설계 안내(바로) → 2 수호자 배치(방이 하나라도 설계됨) → 3 침입 방어(수호자가 하나라도 배치됨)
 * → 4 다음 침공 준비(전투를 한 번 치름). 카드를 닫자마자 다음 카드가 떠서 할 일을 앞질렀다.
 */
export function isTutorialStepReady(
  stage: number,
  state: Readonly<Pick<GameState, 'dungeonSlots' | 'totalKills'>>,
): boolean {
  const slots = state.dungeonSlots ?? [];
  switch (stage) {
    case 1: return true;
    case 2: return slots.some(slot => !!slot?.roomType);
    case 3: return slots.some(slot => (slot?.monsterIds ?? []).some(Boolean));
    case 4: return (state.totalKills ?? 0) > 0;
    default: return false;
  }
}
