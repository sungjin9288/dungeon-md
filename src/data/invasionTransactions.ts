import {
  applyQuestObjectiveUpdate,
  tickSubQuestProgress,
  type ObjectiveUpdate,
} from './quests';
import type { GameState, QuestProgress } from './wisdom';
import type { BattleResultCallout } from './battleResultCallout';

export interface BattleReturnResult {
  won:              boolean;
  goldEarned:       number;
  dmXP:             number;
  /** Dungeon HP left as a share of max (0–1); absent on older hand-offs. */
  hpShare?:         number;
  materialsEarned?: Record<string, number>;
  readonly callout?: BattleResultCallout;
}

export interface BattleReturnSettlement {
  state:        GameState;
  changed:      boolean;
  didLevelUp:   boolean;
  defendUpdate: ObjectiveUpdate | null;
}

/** DM XP a campaign/invasion battle settles with. One source for combat and pacing tooling. */
export const STAGE_CLEAR_DM_XP  = 150;
export const STAGE_DEFEAT_DM_XP = 30;

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

export interface BattleSettlementOptions {
  /** Story invasions and forecast cards defend the home; campaign stages do not tick it. */
  readonly defendInvasion?: boolean;
}

export function applyBattleReturnSettlement(
  state: GameState,
  result: BattleReturnResult,
  { defendInvasion = true }: BattleSettlementOptions = {},
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
  if (result.won && defendInvasion) {
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
