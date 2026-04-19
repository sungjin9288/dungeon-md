// ─── stageProgress.ts ────────────────────────────────────────────────────────
// Stage-progress data layer: per-stage config table, progress persistence, and
// unlock/clear recording.  Extracted from StageSelectScene so that combat
// modules (StageClearFlow, DungeonScene) can depend on a data module instead
// of a UI scene.

import { type StageProgressEntry } from './wisdom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageProgress = StageProgressEntry;

export const TOTAL_STAGES = 80;

// ─── Per-stage boot config ────────────────────────────────────────────────────
// Minimal configs used to launch DungeonScene (slots, chapter, bossWave flag).

export const STAGE_CONFIGS = [
  // ── Chapter 1: 도깨비 숲 ──
  { stageNumber: 1,  slots: 3,  unlockedStage: 1,  chapter: 1 },
  { stageNumber: 2,  slots: 4,  unlockedStage: 2,  chapter: 1 },
  { stageNumber: 3,  slots: 4,  unlockedStage: 3,  chapter: 1 },
  { stageNumber: 4,  slots: 5,  unlockedStage: 4,  chapter: 1 },
  { stageNumber: 5,  slots: 5,  unlockedStage: 4,  chapter: 1 },
  { stageNumber: 6,  slots: 6,  unlockedStage: 6,  chapter: 1 },
  { stageNumber: 7,  slots: 6,  unlockedStage: 6,  chapter: 1 },
  { stageNumber: 8,  slots: 7,  unlockedStage: 8,  chapter: 1 },
  { stageNumber: 9,  slots: 9,  unlockedStage: 8,  chapter: 1 },
  { stageNumber: 10, slots: 9,  unlockedStage: 8,  chapter: 1, bossWave: true },
  // ── Chapter 2: 구미호 계곡 ──
  { stageNumber: 11, slots: 10, unlockedStage: 11, chapter: 2 },
  { stageNumber: 12, slots: 11, unlockedStage: 12, chapter: 2 },
  { stageNumber: 13, slots: 12, unlockedStage: 13, chapter: 2 },
  { stageNumber: 14, slots: 12, unlockedStage: 14, chapter: 2 },
  { stageNumber: 15, slots: 13, unlockedStage: 15, chapter: 2 },
  { stageNumber: 16, slots: 13, unlockedStage: 16, chapter: 2 },
  { stageNumber: 17, slots: 14, unlockedStage: 17, chapter: 2 },
  { stageNumber: 18, slots: 14, unlockedStage: 18, chapter: 2 },
  { stageNumber: 19, slots: 15, unlockedStage: 19, chapter: 2 },
  { stageNumber: 20, slots: 16, unlockedStage: 19, chapter: 2, bossWave: true },
  // ── Chapter 3: 용왕 해저궁 ──
  { stageNumber: 21, slots: 16, unlockedStage: 21, chapter: 3 },
  { stageNumber: 22, slots: 16, unlockedStage: 22, chapter: 3 },
  { stageNumber: 23, slots: 17, unlockedStage: 23, chapter: 3 },
  { stageNumber: 24, slots: 17, unlockedStage: 24, chapter: 3 },
  { stageNumber: 25, slots: 17, unlockedStage: 25, chapter: 3 },
  { stageNumber: 26, slots: 18, unlockedStage: 26, chapter: 3 },
  { stageNumber: 27, slots: 18, unlockedStage: 27, chapter: 3 },
  { stageNumber: 28, slots: 18, unlockedStage: 28, chapter: 3 },
  { stageNumber: 29, slots: 18, unlockedStage: 29, chapter: 3 },
  { stageNumber: 30, slots: 20, unlockedStage: 29, chapter: 3 },
  { stageNumber: 31, slots: 20, unlockedStage: 29, chapter: 3 },
  { stageNumber: 32, slots: 20, unlockedStage: 29, chapter: 3, bossWave: true },
  // ── Chapter 4: 저승 관문 ──
  { stageNumber: 33, slots: 8,  unlockedStage: 33, chapter: 4 },
  { stageNumber: 34, slots: 9,  unlockedStage: 34, chapter: 4 },
  { stageNumber: 35, slots: 10, unlockedStage: 35, chapter: 4 },
  { stageNumber: 36, slots: 10, unlockedStage: 36, chapter: 4 },
  { stageNumber: 37, slots: 11, unlockedStage: 37, chapter: 4 },
  { stageNumber: 38, slots: 11, unlockedStage: 38, chapter: 4 },
  { stageNumber: 39, slots: 12, unlockedStage: 39, chapter: 4 },
  { stageNumber: 40, slots: 12, unlockedStage: 40, chapter: 4 },
  { stageNumber: 41, slots: 12, unlockedStage: 40, chapter: 4 },
  { stageNumber: 42, slots: 12, unlockedStage: 40, chapter: 4, bossWave: true },
  // ── Chapter 5: 삼신산 ──
  { stageNumber: 43, slots: 10, unlockedStage: 43, chapter: 5 },
  { stageNumber: 44, slots: 10, unlockedStage: 44, chapter: 5 },
  { stageNumber: 45, slots: 11, unlockedStage: 45, chapter: 5 },
  { stageNumber: 46, slots: 11, unlockedStage: 46, chapter: 5 },
  { stageNumber: 47, slots: 12, unlockedStage: 47, chapter: 5 },
  { stageNumber: 48, slots: 12, unlockedStage: 48, chapter: 5 },
  { stageNumber: 49, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 50, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 51, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 52, slots: 12, unlockedStage: 49, chapter: 5, bossWave: true },
  // ── Chapter 6: 영원의 왕좌 ──
  { stageNumber: 53, slots: 12, unlockedStage: 53, chapter: 6 },
  { stageNumber: 54, slots: 12, unlockedStage: 54, chapter: 6 },
  { stageNumber: 55, slots: 13, unlockedStage: 55, chapter: 6 },
  { stageNumber: 56, slots: 13, unlockedStage: 56, chapter: 6 },
  { stageNumber: 57, slots: 13, unlockedStage: 57, chapter: 6 },
  { stageNumber: 58, slots: 14, unlockedStage: 58, chapter: 6 },
  { stageNumber: 59, slots: 14, unlockedStage: 59, chapter: 6 },
  { stageNumber: 60, slots: 14, unlockedStage: 60, chapter: 6 },
  { stageNumber: 61, slots: 14, unlockedStage: 60, chapter: 6 },
  { stageNumber: 62, slots: 14, unlockedStage: 60, chapter: 6, bossWave: true },
  // ── Chapter 7: 신계 침공 ──
  { stageNumber: 63, slots: 14, unlockedStage: 63, chapter: 7 },
  { stageNumber: 64, slots: 14, unlockedStage: 64, chapter: 7 },
  { stageNumber: 65, slots: 15, unlockedStage: 65, chapter: 7 },
  { stageNumber: 66, slots: 15, unlockedStage: 66, chapter: 7 },
  { stageNumber: 67, slots: 15, unlockedStage: 67, chapter: 7 },
  { stageNumber: 68, slots: 16, unlockedStage: 68, chapter: 7 },
  { stageNumber: 69, slots: 16, unlockedStage: 69, chapter: 7 },
  { stageNumber: 70, slots: 16, unlockedStage: 70, chapter: 7 },
  { stageNumber: 71, slots: 16, unlockedStage: 70, chapter: 7 },
  { stageNumber: 72, slots: 16, unlockedStage: 70, chapter: 7, bossWave: true },
  // ── Chapter 8: 원초의 심연 ──
  { stageNumber: 73, slots: 17, unlockedStage: 73, chapter: 8 },
  { stageNumber: 74, slots: 17, unlockedStage: 74, chapter: 8 },
  { stageNumber: 75, slots: 17, unlockedStage: 75, chapter: 8 },
  { stageNumber: 76, slots: 18, unlockedStage: 76, chapter: 8 },
  { stageNumber: 77, slots: 18, unlockedStage: 77, chapter: 8 },
  { stageNumber: 78, slots: 18, unlockedStage: 78, chapter: 8 },
  { stageNumber: 79, slots: 18, unlockedStage: 79, chapter: 8 },
  { stageNumber: 80, slots: 18, unlockedStage: 79, chapter: 8, bossWave: true },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'dungeonStageProgress';

export function loadProgress(): StageProgress[] {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as StageProgress[];
      // Pad to TOTAL_STAGES for backward compat (old 10-entry saves)
      while (saved.length < TOTAL_STAGES) {
        saved.push({ unlocked: false, bestStars: 0 });
      }
      return saved;
    }
    catch { /* fall through */ }
  }
  // Default: stage 1 unlocked, rest locked
  return Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    unlocked:  i === 0,
    bestStars: 0,
  }));
}

export function saveProgress(progress: StageProgress[]): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

/** Call after clearing a stage to unlock the next one and record stars + HP%. */
export function recordClear(stageIndex: number, stars: number, hpPercent?: number): StageProgress[] {
  const prog = loadProgress();
  if (!prog[stageIndex]) return prog;
  prog[stageIndex].bestStars = Math.max(prog[stageIndex].bestStars, stars);
  if (hpPercent !== undefined) {
    prog[stageIndex].bestHpPercent = Math.max(prog[stageIndex].bestHpPercent ?? 0, hpPercent);
  }
  // Unlock next stage
  if (stageIndex + 1 < TOTAL_STAGES) prog[stageIndex + 1].unlocked = true;
  // Clearing Stage 10 (index 9) also unlocks Stage 11 (index 10) — Ch2 gate
  if (stageIndex === 9 && prog[10]) prog[10].unlocked = true;
  // Clearing Stage 20 (index 19) also unlocks Stage 21 (index 20) — Ch3 gate
  if (stageIndex === 19 && prog[20]) prog[20].unlocked = true;
  // Clearing Stage 32 (index 31) also unlocks Stage 33 (index 32) — Ch4 gate
  if (stageIndex === 31 && prog[32]) prog[32].unlocked = true;
  // Clearing Stage 42 (index 41) also unlocks Stage 43 (index 42) — Ch5 gate
  if (stageIndex === 41 && prog[42]) prog[42].unlocked = true;
  // Clearing Stage 52 (index 51) also unlocks Stage 53 (index 52) — Ch6 gate
  if (stageIndex === 51 && prog[52]) prog[52].unlocked = true;
  // Clearing Stage 62 (index 61) also unlocks Stage 63 (index 62) — Ch7 gate
  if (stageIndex === 61 && prog[62]) prog[62].unlocked = true;
  // Clearing Stage 72 (index 71) also unlocks Stage 73 (index 72) — Ch8 gate
  if (stageIndex === 71 && prog[72]) prog[72].unlocked = true;
  saveProgress(prog);
  return prog;
}
