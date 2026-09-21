// ─── stageProgress.ts ────────────────────────────────────────────────────────
// Stage-progress data layer: per-stage config table, progress persistence, and
// unlock/clear recording.  Extracted from StageSelectScene so that combat
// modules (StageClearFlow, DungeonScene) can depend on a data module instead
// of a UI scene.

import { type StageProgressEntry } from './wisdom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageProgress = StageProgressEntry;

export const TOTAL_STAGES = 90;

// ─── Per-stage boot config ────────────────────────────────────────────────────
// Minimal configs used to launch DungeonScene (chapter, bossWave flag). The
// battle grid always mirrors the home board, so stages carry no slot count.

export const STAGE_CONFIGS = [
  // ── Chapter 1: 도깨비 숲 ──
  { stageNumber: 1, chapter: 1 },
  { stageNumber: 2, chapter: 1 },
  { stageNumber: 3, chapter: 1 },
  { stageNumber: 4, chapter: 1 },
  { stageNumber: 5, chapter: 1 },
  { stageNumber: 6, chapter: 1 },
  { stageNumber: 7, chapter: 1 },
  { stageNumber: 8, chapter: 1 },
  { stageNumber: 9, chapter: 1 },
  { stageNumber: 10, chapter: 1, bossWave: true },
  // ── Chapter 2: 구미호 계곡 ──
  { stageNumber: 11, chapter: 2 },
  { stageNumber: 12, chapter: 2 },
  { stageNumber: 13, chapter: 2 },
  { stageNumber: 14, chapter: 2 },
  { stageNumber: 15, chapter: 2 },
  { stageNumber: 16, chapter: 2 },
  { stageNumber: 17, chapter: 2 },
  { stageNumber: 18, chapter: 2 },
  { stageNumber: 19, chapter: 2 },
  { stageNumber: 20, chapter: 2, bossWave: true },
  // ── Chapter 3: 용왕 해저궁 ──
  { stageNumber: 21, chapter: 3 },
  { stageNumber: 22, chapter: 3 },
  { stageNumber: 23, chapter: 3 },
  { stageNumber: 24, chapter: 3 },
  { stageNumber: 25, chapter: 3 },
  { stageNumber: 26, chapter: 3 },
  { stageNumber: 27, chapter: 3 },
  { stageNumber: 28, chapter: 3 },
  { stageNumber: 29, chapter: 3 },
  { stageNumber: 30, chapter: 3 },
  { stageNumber: 31, chapter: 3 },
  { stageNumber: 32, chapter: 3, bossWave: true },
  // ── Chapter 4: 저승 관문 ──
  { stageNumber: 33, chapter: 4 },
  { stageNumber: 34, chapter: 4 },
  { stageNumber: 35, chapter: 4 },
  { stageNumber: 36, chapter: 4 },
  { stageNumber: 37, chapter: 4 },
  { stageNumber: 38, chapter: 4 },
  { stageNumber: 39, chapter: 4 },
  { stageNumber: 40, chapter: 4 },
  { stageNumber: 41, chapter: 4 },
  { stageNumber: 42, chapter: 4, bossWave: true },
  // ── Chapter 5: 삼신산 ──
  { stageNumber: 43, chapter: 5 },
  { stageNumber: 44, chapter: 5 },
  { stageNumber: 45, chapter: 5 },
  { stageNumber: 46, chapter: 5 },
  { stageNumber: 47, chapter: 5 },
  { stageNumber: 48, chapter: 5 },
  { stageNumber: 49, chapter: 5 },
  { stageNumber: 50, chapter: 5 },
  { stageNumber: 51, chapter: 5 },
  { stageNumber: 52, chapter: 5, bossWave: true },
  // ── Chapter 6: 영원의 왕좌 ──
  { stageNumber: 53, chapter: 6 },
  { stageNumber: 54, chapter: 6 },
  { stageNumber: 55, chapter: 6 },
  { stageNumber: 56, chapter: 6 },
  { stageNumber: 57, chapter: 6 },
  { stageNumber: 58, chapter: 6 },
  { stageNumber: 59, chapter: 6 },
  { stageNumber: 60, chapter: 6 },
  { stageNumber: 61, chapter: 6 },
  { stageNumber: 62, chapter: 6, bossWave: true },
  // ── Chapter 7: 신계 침공 ──
  { stageNumber: 63, chapter: 7 },
  { stageNumber: 64, chapter: 7 },
  { stageNumber: 65, chapter: 7 },
  { stageNumber: 66, chapter: 7 },
  { stageNumber: 67, chapter: 7 },
  { stageNumber: 68, chapter: 7 },
  { stageNumber: 69, chapter: 7 },
  { stageNumber: 70, chapter: 7 },
  { stageNumber: 71, chapter: 7 },
  { stageNumber: 72, chapter: 7, bossWave: true },
  // ── Chapter 8: 원초의 심연 ──
  { stageNumber: 73, chapter: 8 },
  { stageNumber: 74, chapter: 8 },
  { stageNumber: 75, chapter: 8 },
  { stageNumber: 76, chapter: 8 },
  { stageNumber: 77, chapter: 8 },
  { stageNumber: 78, chapter: 8 },
  { stageNumber: 79, chapter: 8 },
  { stageNumber: 80, chapter: 8, bossWave: true },
  // ── Chapter 9: 공허 너머 ──
  { stageNumber: 81, chapter: 9 },
  { stageNumber: 82, chapter: 9 },
  { stageNumber: 83, chapter: 9 },
  { stageNumber: 84, chapter: 9 },
  { stageNumber: 85, chapter: 9 },
  { stageNumber: 86, chapter: 9 },
  { stageNumber: 87, chapter: 9 },
  { stageNumber: 88, chapter: 9 },
  { stageNumber: 89, chapter: 9 },
  { stageNumber: 90, chapter: 9, bossWave: true },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'dungeonStageProgress';
const CHAPTER_GATE_UNLOCKS: Record<number, number> = {
  9:  10,
  19: 20,
  31: 32,
  41: 42,
  51: 52,
  61: 62,
  71: 72,
};

/**
 * The highest campaign stage the player has actually cleared (0 = none).
 *
 * Stage numbers are 1-based and entries are index-aligned, so the answer is the
 * last starred index plus one. Two private copies of this walk used to live in
 * summonTransactions and tribeShards, both gating acquisition on it; they are
 * gone, and any new caller should use this one.
 */
export function highestClearedStage(
  state: Readonly<{ stageProgress?: ReadonlyArray<{ bestStars?: number } | undefined> }>,
): number {
  return (state.stageProgress ?? []).reduce(
    (max: number, entry, index) => ((entry?.bestStars ?? 0) > 0 ? index + 1 : max),
    0,
  );
}

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

export function applyStageClear(
  progress: StageProgress[],
  stageIndex: number,
  stars: number,
  hpPercent?: number,
): StageProgress[] {
  if (!progress[stageIndex]) return progress;

  const unlockIndices = new Set<number>();
  if (stageIndex + 1 < TOTAL_STAGES) unlockIndices.add(stageIndex + 1);
  const gateUnlock = CHAPTER_GATE_UNLOCKS[stageIndex];
  if (gateUnlock !== undefined && gateUnlock < TOTAL_STAGES) unlockIndices.add(gateUnlock);

  return progress.map((entry, i) => {
    if (!entry) return entry;
    if (i === stageIndex) {
      return {
        ...entry,
        bestStars: Math.max(entry.bestStars, stars),
        ...(hpPercent !== undefined
          ? { bestHpPercent: Math.max(entry.bestHpPercent ?? 0, hpPercent) }
          : {}),
      };
    }
    if (unlockIndices.has(i)) return { ...entry, unlocked: true };
    return entry;
  });
}

/** Call after clearing a stage to unlock the next one and record stars + HP%. */
export function recordClear(stageIndex: number, stars: number, hpPercent?: number): StageProgress[] {
  const prog = loadProgress();
  const next = applyStageClear(prog, stageIndex, stars, hpPercent);
  saveProgress(next);
  return next;
}
