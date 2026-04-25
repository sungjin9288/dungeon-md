/**
 * Achievement public API — thin barrel module.
 * All types and data live in achievementData.ts; epilogue defs are in
 * achievementDefsEpilogue.ts.  This file re-exports everything and adds
 * the two runtime helper functions that search BOTH lists.
 */

export type {
  AchievementCategory,
  AchievementReward,
  AchievementDef,
  AchievementContext,
} from './achievementData';

export { ACHIEVEMENT_DEFS } from './achievementData';
export { EPILOGUE_ACHIEVEMENT_DEFS } from './achievementDefsEpilogue';

import {
  ACHIEVEMENT_DEFS,
  type AchievementDef,
  type AchievementContext,
} from './achievementData';
import { EPILOGUE_ACHIEVEMENT_DEFS } from './achievementDefsEpilogue';

/** Full list: base 70 + epilogue 5 = 75 achievements */
const COMBINED_DEFS: AchievementDef[] = [
  ...ACHIEVEMENT_DEFS,
  ...EPILOGUE_ACHIEVEMENT_DEFS,
];

/** Look up a definition by id (searches base + epilogue) */
export function getAchievementDef(id: string): AchievementDef | undefined {
  return COMBINED_DEFS.find(a => a.id === id);
}

/** Check which achievements should unlock given current context.
 *  Returns ids of newly-unlocked achievements (searches base + epilogue). */
export function checkAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: Record<string, { unlocked: boolean }>,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const def of COMBINED_DEFS) {
    if (alreadyUnlocked[def.id]?.unlocked) continue;
    if (def.getProgress(ctx) >= def.target) {
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
}
