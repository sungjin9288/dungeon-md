// ─── allStages.ts ──────────────────────────────────────────────────────────
// THE canonical battle-stage table: the single flattened union of every
// chapter's stages (Ch1–Ch9, 90 stages).
//
// Every consumer that resolves a stage by id at battle time — DungeonSceneInit
// (wave/chapter/HP setup) and StageRewardOverlay (reward lookup) — MUST go
// through this list. Previously each kept its own `[...CHAPTER_1, ...CHAPTER_2,
// …]` literal, and when Ch8/Ch9 were added one copy was updated and the other
// (DungeonSceneInit) was not — so stages 73–90 silently fell back to Ch1 S1 at
// battle entry. A single source removes that drift class entirely.

import {
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5,
  CHAPTER_6, CHAPTER_7, CHAPTER_8, CHAPTER_9,
  type StageConfig,
} from './stages';

/** Flattened, in-order union of all chapter stage tables. */
export const ALL_STAGES: StageConfig[] = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5,
  ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8, ...CHAPTER_9,
];

/** Resolve a stage definition by its 1-based stage id, or undefined if unknown. */
export function findStageById(id: number): StageConfig | undefined {
  return ALL_STAGES.find(s => s.id === id);
}
