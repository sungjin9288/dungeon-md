// ─── HomeOverlayShared ────────────────────────────────────────────────────────
// Pure data helpers for the home result overlays. NO Phaser render logic here —
// kept import-light so it can be unit-tested without loading the Phaser runtime.

import { CASUAL, CASUAL_CSS } from '../constants/colors';

export interface BattleReturnGrowthContext {
  readonly previousDmLevel: number;
  readonly nextDmLevel: number;
  readonly previousPermits: number;
  readonly nextPermits: number;
  readonly questCompletionPending?: boolean;
  readonly materialsEarned?: Record<string, number>;
}

export interface BattleReturnGrowthSummary {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly valueColor: string;
  readonly fillColor: number;
  readonly borderColor: number;
  readonly note: string;
  readonly buttonLabel: string;
}

// Casual-toy modal chrome — cream cards, brown edges, saturated accents.
const OVERLAY_ROW_FILL = CASUAL.PANEL_SOFT; // soft cream stat row
const VICTORY_GREEN_DARK = CASUAL.GREEN_DK; // candy-button base for primary
const VICTORY_TEXT = CASUAL_CSS.GREEN;

/**
 * Pick the single growth highlight shown on the battle-return overlay.
 * Priority (first match wins): dig permit gained → master level-up →
 * pending quest completion (it is what the button leads to next) →
 * crafting materials → generic dungeon growth.
 */
export function buildBattleReturnGrowthSummary(
  growth?: BattleReturnGrowthContext,
): BattleReturnGrowthSummary {
  const materialCount = Object.values(growth?.materialsEarned ?? {})
    .reduce((sum, qty) => sum + Math.max(0, qty), 0);
  const leveledUp = !!growth && growth.nextDmLevel > growth.previousDmLevel;
  const permitGained = !!growth && growth.nextPermits > growth.previousPermits;

  if (permitGained && growth) {
    return {
      icon: '⛏',
      label: '굴착 허가',
      value: `${growth.previousPermits} → ${growth.nextPermits}칸`,
      valueColor: CASUAL_CSS.GREEN,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.GREEN_DK,
      note: '골드로 새 방을 파서 침입 동선을 늘릴 수 있습니다',
      buttonLabel: '굴착 허가 확인',
    };
  }

  if (leveledUp && growth) {
    return {
      icon: '✦',
      label: '마스터 성장',
      value: `Lv.${growth.previousDmLevel} → ${growth.nextDmLevel}`,
      valueColor: CASUAL_CSS.GOLD,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.GOLD_DK,
      note: '레벨 보상이 다음 방어 준비에 반영됩니다',
      buttonLabel: '성장 확인',
    };
  }

  if (growth?.questCompletionPending) {
    return {
      icon: '📜',
      label: '퀘스트 완료',
      value: '보상 대기',
      valueColor: CASUAL_CSS.GOLD,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.GOLD_DK,
      note: '확인 후 메인 퀘스트 보상과 해금이 이어집니다',
      buttonLabel: '퀘스트 보상 확인',
    };
  }

  if (materialCount > 0) {
    return {
      icon: '⚒',
      label: '제작 재료',
      value: `+${materialCount.toLocaleString('ko-KR')}`,
      valueColor: CASUAL_CSS.BLUE,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.BLUE_DK,
      note: '공방에서 수호자 장비를 제작하거나 강화하세요',
      // The button only closes the summary; '공방 준비' promised a trip there.
      buttonLabel: '재료 확인',
    };
  }

  return {
    icon: '▣',
    label: '던전 성장',
    value: '재정비 가능',
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
    note: '보상이 즉시 저장되었습니다. 방 배치와 장비를 보강하세요',
    buttonLabel: '던전 성장 확인',
  };
}
