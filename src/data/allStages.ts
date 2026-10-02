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
import { highestClearedStage } from './stageProgress';

/**
 * 장별 노련도 — 그 장 스테이지 일반 무리(보스 제외)의 HP·심장부 피해 배율(`WaveSpec` 무리의 `veteranMult`,
 * 명성 티어와 같은 장치). 손으로 짠 90개 스테이지를 하나씩 고치지 않고 장 단위로 난이도를 고른다. 값은 하나(장 전체)
 * 또는 [장 첫 스테이지, 장 끝 스테이지] 선형 경사. 전투와 시뮬(`campaignPacing`)이 모두 이 표를 거친 `ALL_STAGES`를 읽는다.
 *
 * 2장: 최소 성장 홈이 11~19를 모두 5~7웨이브에 졌다(2026-10-01) — 장 경계에서 던전 HP가 2,400 → 1,400으로 내려가고
 * 첫 웨이브부터 2티어 유닛 7~8명이 온다. 실전 탐색(0.65배: 11 64 · 14 95 · 17 90 · 20 100%, 0.8배: 11 패배 · 14 20 · 17 65 ·
 * 20 70%)에서 목표(평균 HP 40~85%)에 맞는 배율이 장 안에서 커져 경사로 둔다.
 *
 * 4~8장: 반대로 최소 성장 홈이 거의 전부 HP 100%로 이겼다(4·5장 100%, 7·8장 대부분 100%). 손으로 짠 웨이브가
 * 3장보다 가볍고(머릿수 7~12) 홈 DPS는 계속 자란다. 결과는 절벽형 — 침략자가 통로 끝까지 살아남는 배율부터 갑자기
 * 무너진다(34: 3.8배 100 · 4.5배 24%, 79: 2.7배 90 · 3.0배 24 · 3.5배 패배). 그래서 장마다 절벽 바로 아래에 둔다.
 * 7·8장은 뒤로 갈수록 웨이브 위협이 가팔라(7장 936 → 1,448, 8장 1,311 → 2,259) 장 안에서 배율을 내린다. 7장 끝은
 * 시뮬 가드(campaignPacing.test — 기대 홈 HP 60%↑, 피날레 ≥ 첫 판)가 묶는다: 72의 보스 아닌 천룡이 2.4배부터 샌다.
 * 9장: 강한 로스터 홈(해금된 가장 센 공격수 31명 — 기대 홈 DPS의 5~7배)에 맞춰 둔 장이라 최소 성장 홈마저 90까지 HP 100%로
 * 이겼다. 다른 장처럼 최소 성장 홈 절벽 아래로(81: 2.1배 79 · 2.5배 13, 90: 1.7배 57 · 2.0배 패배). 측정은 설계 문서 P5-p·P5-q.
 * 5장 끝은 측정 도구 수정(P5-s) 뒤 52가 5.0배에서 4판 중 3판 패배라 4.6으로 낮췄다(77·85%).
 */
export const CHAPTER_VETERAN_MULT: Readonly<Partial<Record<number, number | readonly [number, number]>>> = {
  2: [0.58, 0.84],
  4: [3.9, 4.4],
  5: [4.5, 4.6],
  6: 3.0,
  7: [2.6, 2.3],
  8: [3.5, 2.4],
  9: [2.1, 1.6],
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

/**
 * 플레이어의 캠페인 위치(가장 깊이 깬 스테이지)의 장, 아직 아무것도 못 깼으면 1. 관문 밖 전투(무한 던전·심연)는
 * 스테이지 번호가 없어 이 장으로 싸운다 — 전투는 장 번호로 방 기믹을 켜므로(3장+ 사신 처형·약방·무기고,
 * 4장+ 영혼 제단·월광·홀림 베일) 장을 안 넘기면 플레이어가 가진 방이 관문 밖에서만 멈춘다.
 */
export function standingChapter(state: Parameters<typeof highestClearedStage>[0]): number {
  const standing = highestClearedStage(state);
  return ALL_STAGES.find(stage => stage.id === standing)?.chapter ?? 1;
}
