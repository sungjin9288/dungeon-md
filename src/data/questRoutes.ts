import type { ObjectiveType } from './questData';

/**
 * Scene that completes a quest objective, for the quest log's "바로 가기".
 * Home-bound objectives (build/assign/upgrade/defend) and passive ones (DM level,
 * gold) have no route: closing the log already returns the player to them.
 */
const OBJECTIVE_DESTINATIONS: Partial<Record<ObjectiveType, string>> = {
  summon: 'SummonScene',
  fuse_monsters: 'FusionScene',
  feed_monster: 'BarracksScene',
  complete_stage: 'StageSelectScene',
};

export function questObjectiveDestination(type: ObjectiveType): string | null {
  return OBJECTIVE_DESTINATIONS[type] ?? null;
}
