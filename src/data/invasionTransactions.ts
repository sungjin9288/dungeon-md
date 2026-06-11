import {
  applyQuestObjectiveUpdate,
  tickSubQuestProgress,
  type ObjectiveUpdate,
} from './quests';
import type { GameState, QuestProgress } from './wisdom';

export interface BattleReturnResult {
  won:              boolean;
  goldEarned:       number;
  dmXP:             number;
  materialsEarned?: Record<string, number>;
}

export interface BattleReturnSettlement {
  state:        GameState;
  changed:      boolean;
  didLevelUp:   boolean;
  defendUpdate: ObjectiveUpdate | null;
}

export function xpForDmLevel(level: number): number {
  return level * 100;
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function numberRecordsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return stringArraysEqual(leftKeys, rightKeys) && leftKeys.every(key => left[key] === right[key]);
}

function questProgressEqual(
  left: Record<string, QuestProgress>,
  right: Record<string, QuestProgress>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return stringArraysEqual(leftKeys, rightKeys) && leftKeys.every(key => {
    const leftProgress = left[key];
    const rightProgress = right[key];
    return (
      leftProgress.completed === rightProgress.completed &&
      leftProgress.completedAt === rightProgress.completedAt &&
      numberRecordsEqual(leftProgress.objectives, rightProgress.objectives)
    );
  });
}

function battleSettlementChanged(source: GameState, next: GameState): boolean {
  return (
    source.homeGold !== next.homeGold ||
    source.dmXP !== next.dmXP ||
    source.dmLevel !== next.dmLevel ||
    source.totalGoldEarned !== next.totalGoldEarned ||
    !numberRecordsEqual(source.materials ?? {}, next.materials ?? {}) ||
    !questProgressEqual(source.questProgress ?? {}, next.questProgress ?? {}) ||
    !numberRecordsEqual(source.subQuestProgress ?? {}, next.subQuestProgress ?? {}) ||
    !stringArraysEqual(source.activeSubQuestIds ?? [], next.activeSubQuestIds ?? [])
  );
}

export function applyBattleReturnSettlement(
  state: GameState,
  result: BattleReturnResult,
): BattleReturnSettlement {
  let dmXP = (state.dmXP ?? 0) + result.dmXP;
  let dmLevel = state.dmLevel ?? 1;
  while (dmXP >= xpForDmLevel(dmLevel)) {
    dmXP -= xpForDmLevel(dmLevel);
    dmLevel += 1;
  }

  const materials = { ...(state.materials ?? {}) };
  Object.entries(result.materialsEarned ?? {}).forEach(([id, qty]) => {
    materials[id] = (materials[id] ?? 0) + qty;
  });

  let nextState: GameState = {
    ...state,
    homeGold:        (state.homeGold ?? 0) + result.goldEarned,
    dmXP,
    dmLevel,
    totalGoldEarned: (state.totalGoldEarned ?? 0) + result.goldEarned,
    materials,
  };

  const [goldQuestState] = applyQuestObjectiveUpdate(nextState, 'collect_gold', result.goldEarned);
  nextState = tickSubQuestProgress(goldQuestState, 'collect_gold', result.goldEarned);
  const [levelQuestState] = applyQuestObjectiveUpdate(nextState, 'reach_dm_level');
  nextState = tickSubQuestProgress(levelQuestState, 'reach_dm_level');

  let defendUpdate: ObjectiveUpdate | null = null;
  if (result.won) {
    const [defendQuestState, update] = applyQuestObjectiveUpdate(nextState, 'defend_invasion');
    nextState = tickSubQuestProgress(defendQuestState, 'defend_invasion');
    defendUpdate = update;
  }

  const changed = battleSettlementChanged(state, nextState);

  return {
    state: changed ? nextState : state,
    changed,
    didLevelUp: dmLevel > (state.dmLevel ?? 1),
    defendUpdate,
  };
}
