/**
 * Achievement public API — thin barrel module.
 * All types and data live in achievementData.ts; this file re-exports
 * everything and adds the two runtime helper functions.
 */

export type {
  AchievementCategory,
  AchievementReward,
  AchievementDef,
  AchievementContext,
} from './achievementData';

export { ACHIEVEMENT_DEFS } from './achievementData';

import {
  ACHIEVEMENT_DEFS,
  type AchievementDef,
  type AchievementContext,
} from './achievementData';

/** Look up a definition by id (returns undefined if not found) */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find(a => a.id === id);
}

/** Check which achievements should unlock given current context.
 *  Returns ids of newly-unlocked achievements. */
export function checkAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: Record<string, { unlocked: boolean }>,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (alreadyUnlocked[def.id]?.unlocked) continue;
    if (def.getProgress(ctx) >= def.target) {
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
}
