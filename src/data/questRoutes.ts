import type { ObjectiveType } from './questData';

/**
 * Home pseudo-route: the 오늘의 손님 tray. Forecast battle wins tick
 * defend_invasion, and after a quest's first win its invasion banner used to
 * stay hidden, so MQ-037/040/041 had no visible way forward (§35).
 */
export const FORECAST_ROUTE = 'forecast';

/**
 * Scene that completes a quest objective, for the quest log's "바로 가기".
 * Home-bound objectives (build/assign/upgrade) and passive ones (DM level,
 * gold) have no route: closing the log already returns the player to them.
 */
const OBJECTIVE_DESTINATIONS: Partial<Record<ObjectiveType, string>> = {
  defend_invasion: FORECAST_ROUTE,
  summon: 'SummonScene',
  fuse_monsters: 'FusionScene',
  feed_monster: 'BarracksScene',
  complete_stage: 'StageSelectScene',
};

export function questObjectiveDestination(type: ObjectiveType): string | null {
  return OBJECTIVE_DESTINATIONS[type] ?? null;
}
