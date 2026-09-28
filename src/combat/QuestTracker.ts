/**
 * Quest & achievement tracking — extracted from DungeonScene.
 *
 * Handles achievement unlocking, quest objective ticking, and toast notifications.
 */
import Phaser from 'phaser';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { type ObjectiveType } from '../data/quests';
import {
  applyConsecutiveDayProgress,
  applyQuestObjectiveProgress,
  grantMonsterRosterXp,
  unlockAvailableAchievements,
} from '../data/progressionTransactions';
import { CANVAS_WIDTH } from '../constants/layout';
import { showXpToast } from './VisualEffects';
import { logger } from '../utils/logger';

// ─── QuestTrackerContext ───────────────────────────────────────────────────

export interface QuestTrackerContext {
  readonly scene: Phaser.Scene;
}

// ─── checkAchievementsAndToast ─────────────────────────────────────────────

export function checkAchievementsAndToast(
  ctx: QuestTrackerContext,
  gs: ReturnType<typeof loadGameState>,
): void {
  const result = unlockAvailableAchievements(gs);
  if (!result.changed) return;
  saveGameState(result.state);

  // Show toasts in sequence
  result.unlockedIds.forEach((id, i) => {
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (!def) return;
    ctx.scene.time.delayedCall(i * 3200, () => showAchievementToast(ctx, def.name, def.icon));
  });
}

// ─── tickQuestAndNotify ────────────────────────────────────────────────────

export function tickQuestAndNotify(
  ctx: QuestTrackerContext,
  gs: ReturnType<typeof loadGameState>,
  type: ObjectiveType,
  amount = 1,
): GameState {
  const result = applyQuestObjectiveProgress(gs, type, amount);
  if (result.questDone) {
    ctx.scene.time.delayedCall(600, () => showQuestCompleteToast(ctx));
  }
  return result.state;
}

// ─── showQuestCompleteToast ────────────────────────────────────────────────

export function showQuestCompleteToast(ctx: QuestTrackerContext): void {
  const { scene } = ctx;
  const toast = scene.add.container(CANVAS_WIDTH / 2, -50).setDepth(500);
  const bg = scene.add.graphics();
  bg.fillStyle(0x1a1060, 0.95);
  bg.fillRoundedRect(-130, -22, 260, 44, 8);
  bg.lineStyle(2, 0xaa88ff, 0.9);
  bg.strokeRoundedRect(-130, -22, 260, 44, 8);
  toast.add(bg);
  toast.add(scene.add.text(0, 0, '📜 퀘스트 완료!', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ddaaff',
  }).setOrigin(0.5));
  scene.tweens.add({
    targets: toast, y: 60, duration: 400, ease: 'Back.Out',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({ targets: toast, y: -60, alpha: 0, duration: 350, onComplete: () => toast.destroy() });
      });
    },
  });
}

// ─── showAchievementToast ──────────────────────────────────────────────────

export function showAchievementToast(
  ctx: QuestTrackerContext,
  name: string,
  icon: string,
): void {
  const { scene } = ctx;
  const toast = scene.add.container(CANVAS_WIDTH / 2, -60).setDepth(500);

  const bg = scene.add.graphics();
  bg.fillStyle(0x1a2a10, 0.95);
  bg.fillRoundedRect(-120, -24, 240, 48, 8);
  bg.lineStyle(2, 0x44cc44, 0.9);
  bg.strokeRoundedRect(-120, -24, 240, 48, 8);

  const iconTxt = scene.add.text(-90, 0, icon, {
    fontFamily: 'sans-serif', fontSize: '22px',
  }).setOrigin(0.5);

  const label = scene.add.text(-60, -8, '업적 달성!', {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#88dd44',
  }).setOrigin(0, 0.5);

  const nameTxt = scene.add.text(-60, 7, name, {
    fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold', color: '#ccff88',
  }).setOrigin(0, 0.5);

  toast.add([bg, iconTxt, label, nameTxt]);

  // Slide in
  scene.tweens.add({
    targets: toast,
    y: 80,
    duration: 400,
    ease: 'Back.Out',
    onComplete: () => {
      // Slide out after 2.5s
      scene.tweens.add({
        targets: toast,
        y: -80,
        duration: 350,
        delay: 2500,
        ease: 'Power2.In',
        onComplete: () => toast.destroy(),
      });
    },
  });
}

// ─── grantMonsterXp ───────────────────────────────────────────────────────────
// Awards `amount` XP to every owned monster, saves state, then shows a
// level-up toast for each monster that levelled up (staggered 400ms apart).

export function grantMonsterXp(ctx: QuestTrackerContext, amount: number): void {
  const gs = loadGameState();
  const result = grantMonsterRosterXp(gs, amount);
  if (!result.changed) return;
  saveGameState(result.state);
  result.levelUps.forEach((levelUp, i) => {
    const msg = `${levelUp.monsterId} → Lv.${levelUp.newLevel}`;
    ctx.scene.time.delayedCall(i * 400, () => showXpToast(ctx.scene, msg));
  });
  logger.debug(`[XP] +${amount} XP granted to ${result.state.ownedMonsters.length} monsters`);
}

// ─── trackConsecutiveDays ──────────────────────────────────────────────────

export function trackConsecutiveDays(): void {
  const result = applyConsecutiveDayProgress(loadGameState());
  if (!result.changed) return;
  saveGameState(result.state);
  logger.debug(`[STREAK] day ${result.state.consecutiveDays} (last: ${result.state.lastPlayDate})`);
}
