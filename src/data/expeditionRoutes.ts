/**
 * 원정 메뉴 — 침공 지도 헤더의 '원정'이 여는 목록. 관문 밖 활동(재료 탐험·무한 도전·환생·업적·생산·장식)의
 * 이름·현황 한 줄·잠김 여부. 순수 모듈(씬 이동은 StageSelectScene.openExpeditionRoute).
 */
import { refilledKeys, ABYSS_MAX_FLOOR } from './abyss';
import type { GameState } from './wisdom';

/** 무한 던전은 1장 보스(관문 10)를 깨면 열린다. */
export const ENDLESS_UNLOCK_STAGE_IDX = 9;

export type ExpeditionRouteKey = 'abyss' | 'endless' | 'wisdom' | 'achievement' | 'production' | 'decoration';

export interface ExpeditionRoute {
  readonly key: ExpeditionRouteKey;
  readonly label: string;
  readonly detail: string;
  readonly locked: boolean;
}

interface StageProgressLike {
  readonly bestStars: number;
}

export function getExpeditionRoutes(
  state: GameState,
  progress: readonly (StageProgressLike | undefined)[],
  today: string,
): ExpeditionRoute[] {
  const abyss = refilledKeys(state.abyss, today);
  const abyssDetail = abyss.highestFloor >= ABYSS_MAX_FLOOR
    ? `전 층 돌파 · 소탕 열쇠 ${abyss.keys}`
    : abyss.highestFloor > 0
      ? `${abyss.highestFloor}층 돌파 · 소탕 열쇠 ${abyss.keys}`
      : '재료 탐험 · 1층부터';
  const endlessOpen = (progress[ENDLESS_UNLOCK_STAGE_IDX]?.bestStars ?? 0) > 0;
  return [
    { key: 'abyss', label: '심연', detail: abyssDetail, locked: false },
    {
      key: 'endless', label: '무한 던전', locked: !endlessOpen,
      detail: endlessOpen ? `최고 ${state.endlessHighScore ?? 0}웨이브` : '1장 보스 격파 후 열림',
    },
    { key: 'wisdom', label: '선조의 지혜', detail: `영혼 결정 ${state.soulCrystals ?? 0}`, locked: false },
    { key: 'achievement', label: '업적', detail: '달성 기록 · 보상', locked: false },
    { key: 'production', label: '생산', detail: '방치 재료 수령', locked: false },
    { key: 'decoration', label: '장식', detail: '세트 효과', locked: false },
  ];
}
