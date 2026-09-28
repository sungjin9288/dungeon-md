import {
  applyQuestObjectiveUpdate,
  assignSubQuests,
  completeAndAdvance,
  isActiveQuestObjectiveComplete,
  startQuest,
  type MainQuest,
} from './quests';
import { applyMainQuestCompletionRewards } from './questRewardTransactions';
import type { GameState } from './wisdom';

export interface MainQuestCompletion {
  completedQuest: MainQuest;
  nextQuestId: string | null;
  unlocks: string[];
}

export interface MainQuestAdvanceResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly completion: MainQuestCompletion | null;
}

export interface HomeMainQuestCompletionResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly completion: MainQuestCompletion | null;
  readonly pendingUnlock: string | null;
  readonly chapterCompleted: boolean;
  readonly gameCompleted: boolean;
  readonly unlockedBlueprintIds: string[];
  readonly awakeningStonesAwarded: number;
}

export interface HomeQuestInitializationResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly startedMainQuestId: string | null;
  readonly assignedSubQuestIds: string[];
}

interface SubQuestSnapshot {
  readonly activeSubQuestIds: string[];
  readonly subQuestProgress: Record<string, number>;
  readonly completedSubQuestIds: string[];
}

function snapshotSubQuests(state: GameState): SubQuestSnapshot {
  return {
    activeSubQuestIds: [...(state.activeSubQuestIds ?? [])],
    subQuestProgress: { ...(state.subQuestProgress ?? {}) },
    completedSubQuestIds: [...(state.completedSubQuestIds ?? [])],
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function recordsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return arraysEqual(leftKeys, rightKeys) && leftKeys.every(key => left[key] === right[key]);
}

function subQuestContainersMissing(state: GameState): boolean {
  return (
    state.activeSubQuestIds === undefined ||
    state.subQuestProgress === undefined ||
    state.completedSubQuestIds === undefined
  );
}

function subQuestSnapshotChanged(
  before: SubQuestSnapshot,
  after: SubQuestSnapshot,
  sourceState: GameState,
): boolean {
  return (
    subQuestContainersMissing(sourceState) ||
    !arraysEqual(before.activeSubQuestIds, after.activeSubQuestIds) ||
    !recordsEqual(before.subQuestProgress, after.subQuestProgress) ||
    !arraysEqual(before.completedSubQuestIds, after.completedSubQuestIds)
  );
}

export function initializeHomeQuestState(
  state: GameState,
  initialQuestId = 'MQ-001',
): HomeQuestInitializationResult {
  let nextState = state;
  let startedMainQuestId: string | null = null;

  if (!nextState.activeMainQuestId) {
    const startedState = startQuest(nextState, initialQuestId);
    if (startedState !== nextState) {
      nextState = startedState;
      if (nextState.activeMainQuestId === initialQuestId) {
        startedMainQuestId = initialQuestId;
      }
    }
  }

  const beforeSubQuests = snapshotSubQuests(nextState);
  const assignedState = assignSubQuests(nextState);
  const afterSubQuests = snapshotSubQuests(assignedState);
  const assignedSubQuestIds = afterSubQuests.activeSubQuestIds.filter(
    id => !beforeSubQuests.activeSubQuestIds.includes(id),
  );

  if (subQuestSnapshotChanged(beforeSubQuests, afterSubQuests, nextState)) {
    nextState = assignedState;
  }

  return {
    state: nextState,
    changed: nextState !== state,
    startedMainQuestId,
    assignedSubQuestIds,
  };
}

export function advanceCompletedMainQuest(state: GameState): MainQuestAdvanceResult {
  // A DM level gained outside a battle settlement (quest or sub-quest reward)
  // has not ticked reach_dm_level yet; sync it before judging completion.
  const [synced] = applyQuestObjectiveUpdate(state, 'reach_dm_level', state.dmLevel ?? 1);
  // completeAndAdvance() completes unconditionally — only settle when the
  // active quest's objectives are actually all met (e.g. home settle path).
  if (!isActiveQuestObjectiveComplete(synced)) {
    return { state, changed: false, completion: null };
  }
  const [nextState, completion] = completeAndAdvance(synced);
  return {
    state: nextState,
    changed: nextState !== state,
    completion,
  };
}

export function settleCompletedHomeMainQuest(state: GameState): HomeMainQuestCompletionResult {
  const advanceResult = advanceCompletedMainQuest(state);
  const completion = advanceResult.completion;
  if (!completion) {
    return {
      state: advanceResult.state,
      changed: advanceResult.changed,
      completion: null,
      pendingUnlock: null,
      chapterCompleted: false,
      gameCompleted: false,
      unlockedBlueprintIds: [],
      awakeningStonesAwarded: 0,
    };
  }

  const rewardResult = applyMainQuestCompletionRewards(
    advanceResult.state,
    completion.completedQuest.id,
  );
  const nextState = rewardResult.changed ? rewardResult.state : advanceResult.state;

  return {
    state: nextState,
    changed: advanceResult.changed || rewardResult.changed,
    completion,
    pendingUnlock: completion.unlocks[0] ?? null,
    chapterCompleted: completion.completedQuest.id === 'MQ-010',
    gameCompleted: completion.completedQuest.id === 'MQ-047',
    unlockedBlueprintIds: rewardResult.unlockedBlueprintIds,
    awakeningStonesAwarded: rewardResult.awakeningStonesAwarded,
  };
}
