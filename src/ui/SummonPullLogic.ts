/**
 * SummonPullLogic — pull execution logic for SummonScene.
 * Extracted from SummonScene.executePull (~664-805).
 */

import { loadGameState, saveGameState } from '../data/wisdom';
import { audioManager } from '../audio/AudioManager';
import { type SeasonBanner } from '../data/banners';
import { applySummonPull, type SummonPullResult } from '../data/summonTransactions';
import { logger } from '../utils/logger';
import { type SummonType, RARITY_KO } from '../data/summonPools';
import { playSinglePullAnimation, playMultiPullAnimation } from './SummonAnimations';
import type Phaser from 'phaser';

/** External context the pull logic needs from the scene. */
export interface PullContext {
  scene: Phaser.Scene;
  activeBanner: SeasonBanner | null;
  showToast: (msg: string) => void;
}

function showSummonFailureToast(
  ctx: PullContext,
  result: Extract<ReturnType<typeof applySummonPull>, { ok: false }>,
): void {
  if (result.reason === 'friendship_already_used') {
    ctx.showToast('오늘의 무료 소환을 이미 사용했습니다');
    return;
  }
  if (result.reason === 'insufficient_gems') {
    ctx.showToast(`💎 부족 (${result.available ?? 0}/${result.required ?? 0})`);
    return;
  }
  if (result.reason === 'insufficient_soul_crystals') {
    ctx.showToast(`💠 부족 (${result.available ?? 0}/${result.required ?? 0})`);
    return;
  }
  ctx.showToast('소환을 실행할 수 없습니다');
}

function logSummonResult(type: SummonType, result: SummonPullResult, soulCrystals: number, pityText = ''): void {
  const logRarity = RARITY_KO[result.rarityIdx];
  logger.debug(
    `[SUMMON] type:${type} rarity:${result.rarity}(${logRarity}) monster:${result.monsterId}` +
    ` new:${result.isNew}` +
    (result.ceilingHit ? ' 천장달성!' : '') +
    pityText +
    (result.isNew ? '' : ` compensation:+${result.scComp}💠 totalSC:${soulCrystals}`),
  );
}

/**
 * Executes a summon pull (1 or 10 times), deducts currency, updates state,
 * plays SFX, and triggers the pull animation.
 */
export function executePull(ctx: PullContext, type: SummonType, count: number): boolean {
  const gs = loadGameState();
  const result = applySummonPull(gs, type, count, { activeBanner: ctx.activeBanner });
  if (!result.ok) {
    showSummonFailureToast(ctx, result);
    return false;
  }

  saveGameState(result.state);
  result.results.forEach(pull => {
    const pityText = (type === 'normal' || type === 'special')
      ? ` pity:${result.state.summonPity[type].count}/${result.state.summonPity[type].guaranteed}`
      : '';
    logSummonResult(type, pull, result.state.soulCrystals, pityText);
  });

  // ── SFX ───────────────────────────────────────────────────────
  const hasLegendary = result.results.some(r => r.rarity === 'legendary');
  audioManager.playSfx(hasLegendary ? 'summon_legendary' : 'summon_pull');

  // ── Trigger animation ─────────────────────────────────────────
  const onAnimComplete = () => ctx.scene.scene.restart();
  if (count === 1) {
    playSinglePullAnimation(ctx.scene, result.results[0], onAnimComplete);
  } else {
    playMultiPullAnimation(ctx.scene, result.results, onAnimComplete);
  }
  return true;
}
