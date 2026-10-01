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

/**
 * 장별 노련도 — 그 장 스테이지 일반 무리(보스 제외)의 HP·심장부 피해 배율(`WaveSpec` 무리의 `veteranMult`,
 * 명성 티어와 같은 장치). 손으로 짠 90개 스테이지를 하나씩 고치지 않고 장 단위로 난이도를 고른다. 값은 하나(장 전체)
 * 또는 [장 첫 스테이지, 장 끝 스테이지] 선형 경사. 전투와 시뮬(`campaignPacing`)이 모두 이 표를 거친 `ALL_STAGES`를 읽는다.
 *
 * 2장: 최소 성장 홈이 11~19를 모두 5~7웨이브에 졌다(2026-10-01) — 장 경계에서 던전 HP가 2,400 → 1,400으로 내려가고
 * 첫 웨이브부터 2티어 유닛 7~8명이 온다. 실전 탐색(0.65배: 11 64 · 14 95 · 17 90 · 20 100%, 0.8배: 11 패배 · 14 20 · 17 65 ·
 * 20 70%)에서 목표(평균 HP 40~85%)에 맞는 배율이 장 안에서 커져 경사로 둔다.
 */
export const CHAPTER_VETERAN_MULT: Readonly<Partial<Record<number, number | readonly [number, number]>>> = {
  2: [0.58, 0.84],
};

/** 그 스테이지의 장별 노련도(경사면 장 안의 위치로 보간). 없으면 1. */
export function chapterVeteranFor(stage: Pick<StageConfig, 'id' | 'chapter'>, stages: readonly Pick<StageConfig, 'id' | 'chapter'>[]): number {
  const entry = CHAPTER_VETERAN_MULT[stage.chapter];
  if (entry === undefined) return 1;
  if (typeof entry === 'number') return entry;
  const ids = stages.filter(s => s.chapter === stage.chapter).map(s => s.id);
  const first = Math.min(...ids);
  const last = Math.max(...ids);
  const t = last > first ? (stage.id - first) / (last - first) : 0;
  return Math.round((entry[0] + (entry[1] - entry[0]) * t) * 100) / 100;
}

/** 노련도를 얹은 스테이지(배율이 1이면 그대로). */
export function withChapterVeteran(stage: StageConfig, mult: number): StageConfig {
  if (mult === 1) return stage;
  return {
    ...stage,
    waves: stage.waves.map(wave => ({
      ...wave,
      invaders: wave.invaders.map(group => (group.isBoss ? group : { ...group, veteranMult: mult })),
    })),
  };
}

/** Flattened, in-order union of all chapter stage tables. */
const RAW_STAGES: StageConfig[] = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5,
  ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8, ...CHAPTER_9,
];
export const ALL_STAGES: StageConfig[] = RAW_STAGES.map(stage => withChapterVeteran(stage, chapterVeteranFor(stage, RAW_STAGES)));

/** Resolve a stage definition by its 1-based stage id, or undefined if unknown. */
export function findStageById(id: number): StageConfig | undefined {
  return ALL_STAGES.find(s => s.id === id);
}
