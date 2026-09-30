/**
 * 심연 원정 전투 — 전투 씬이 '지금 심연 몇 층을 싸우는가'를 아는 단일 판정과 그 전투의 이름표.
 * 심연 전투는 인라인 웨이브 + `returnTo: 'AbyssScene'` + `abyssPendingFloor`로 시작한다(AbyssScene.climb).
 * 이 판정이 없으면 결과 창·HUD가 홈 침략 방어("침공 방어 성공 · 던전으로 귀환")로 읽혔다.
 */
import { getAbyssFloorConfig } from './abyss';

export const ABYSS_SCENE_KEY = 'AbyssScene';
/** registry 인계 — 원정실 '← 뒤로'가 돌아갈 씬(navigationContract 'abyss-entry'). */
export const ABYSS_RETURN_SCENE_KEY = 'abyssReturnScene';
const ABYSS_RETURN_SCENES = ['ForgeScene', 'FusionScene', 'StageSelectScene'] as const;
export type AbyssReturnScene = (typeof ABYSS_RETURN_SCENES)[number];
export const ABYSS_BACK_LABEL: Readonly<Record<AbyssReturnScene, string>> = {
  ForgeScene: '← 공방',
  FusionScene: '← 의식실',
  StageSelectScene: '← 침공',
};

/**
 * 원정실의 돌아갈 곳. 새 인계가 있으면 그것, 전투에서 막 돌아왔으면(인계 없음) 지금 값 유지, 그 밖에는 침공 지도.
 */
export function nextAbyssReturnScene(
  handoff: unknown,
  returningFromBattle: boolean,
  current: AbyssReturnScene,
): AbyssReturnScene {
  if ((ABYSS_RETURN_SCENES as readonly unknown[]).includes(handoff)) return handoff as AbyssReturnScene;
  return returningFromBattle ? current : 'StageSelectScene';
}

export const ABYSS_LOSE_RETURN_LABEL = '심연 원정실로 · 전리품 정산';

/** 심연 전투면 그 층, 아니면 null. 두 인계값이 모두 맞아야 심연 전투다. */
export function abyssBattleFloor(returnTo: unknown, pendingFloor: unknown): number | null {
  if (returnTo !== ABYSS_SCENE_KEY) return null;
  return typeof pendingFloor === 'number' && Number.isInteger(pendingFloor) && pendingFloor >= 1 ? pendingFloor : null;
}

export interface AbyssBattleLabels {
  readonly hudTitle: string;
  readonly hudSubtitle: string;
  readonly clearTitle: string;
  readonly winReturnLabel: string;
  readonly loseReturnLabel: string;
}

export function getAbyssBattleLabels(floor: number): AbyssBattleLabels {
  return {
    hudTitle: '심연 원정',
    hudSubtitle: `${floor}층 · ${getAbyssFloorConfig(floor).bandLabel}`,
    clearTitle: `심연 ${floor}층 돌파`,
    winReturnLabel: '심연 원정실로 · 보상 수령',
    loseReturnLabel: ABYSS_LOSE_RETURN_LABEL,
  };
}
