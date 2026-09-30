/**
 * 전투 화면 고정 UI 표시 — Phaser를 불러오지 않는 작은 모듈(단위 테스트에서도 안전하게 import).
 * 표시된 오브젝트와 깊이 HUD_OVERLAY_DEPTH 이상은 BattleCameras의 고정 카메라가 그린다.
 */
import type Phaser from 'phaser';

/** 이 깊이 이상은 전체 화면 오버레이(보스 등장·결과·팝업) — 항상 화면 고정. */
export const HUD_OVERLAY_DEPTH = 198;
/** `setData` 키 — 체인 중간에서 표시할 때 `.setData(BATTLE_HUD_KEY, true)`. */
export const BATTLE_HUD_KEY = 'battleHud';

/** 화면에 고정해야 하는 전투 UI 오브젝트에 표시한다(컨테이너면 컨테이너 하나만). */
export function markBattleHud<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData?.(BATTLE_HUD_KEY, true);
  return object;
}

export function isBattleHud(object: Phaser.GameObjects.GameObject): boolean {
  return object.getData?.(BATTLE_HUD_KEY) === true
    || ((object as unknown as { depth?: number }).depth ?? 0) >= HUD_OVERLAY_DEPTH;
}
