/**
 * Unit tests for buildBattleReturnGrowthSummary — the pure growth-summary
 * selector behind the battle-return overlay. No Phaser dependency; pure data
 * logic that picks one of five summary variants by priority.
 */

import { describe, it, expect } from 'vitest';
import { CASUAL_CSS } from '../constants/colors';
import {
  buildBattleReturnGrowthSummary,
  type BattleReturnGrowthContext,
} from './HomeOverlayShared';

const baseGrowth: BattleReturnGrowthContext = {
  previousDmLevel: 5,
  nextDmLevel: 5,
  previousSlots: 4,
  nextSlots: 4,
};

describe('buildBattleReturnGrowthSummary', () => {
  it('falls back to the generic dungeon-growth summary when nothing changed', () => {
    const summary = buildBattleReturnGrowthSummary();
    expect(summary.label).toBe('던전 성장');
    expect(summary.buttonLabel).toBe('던전 성장 확인');
  });

  it('prioritizes room expansion over a level-up when both occur', () => {
    const summary = buildBattleReturnGrowthSummary({
      previousDmLevel: 5,
      nextDmLevel: 6,
      previousSlots: 4,
      nextSlots: 5,
    });
    expect(summary.label).toBe('던전 확장');
    expect(summary.value).toBe('4 → 5 방');
    expect(summary.valueColor).toBe(CASUAL_CSS.GREEN);
  });

  it('reports a master level-up when only the DM level rose', () => {
    const summary = buildBattleReturnGrowthSummary({
      ...baseGrowth,
      nextDmLevel: 6,
    });
    expect(summary.label).toBe('마스터 성장');
    expect(summary.value).toBe('Lv.5 → 6');
  });

  it('summarizes crafting materials when some were earned without other growth', () => {
    const summary = buildBattleReturnGrowthSummary({
      ...baseGrowth,
      materialsEarned: { iron: 2, wood: 3 },
    });
    expect(summary.label).toBe('제작 재료');
    expect(summary.value).toBe('+5');
  });

  it('surfaces a pending quest completion when no other growth applies', () => {
    const summary = buildBattleReturnGrowthSummary({
      ...baseGrowth,
      questCompletionPending: true,
    });
    expect(summary.label).toBe('퀘스트 완료');
    expect(summary.buttonLabel).toBe('퀘스트 보상 확인');
  });
});
