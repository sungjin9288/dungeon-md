/**
 * Quest & achievement tracking — extracted from DungeonScene.
 *
 * Handles achievement unlocking, quest objective ticking, and toast notifications.
 */
import Phaser from 'phaser';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { checkAchievements, ACHIEVEMENT_DEFS, type AchievementContext } from '../data/achievements';
import { updateQuestObjective, tickSubQuestProgress, completeAndAdvance } from '../data/quests';
import { addXp } from '../data/barracks';
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
  const achCtx: AchievementContext = {
    totalKills:        gs.totalKills       ?? 0,
    totalGoldEarned:   gs.totalGoldEarned  ?? 0,
    roomsBuilt:        gs.roomsBuilt       ?? [],
    bossesKilled:      gs.bossesKilled     ?? [],
    endlessHighScore:  gs.endlessHighScore ?? 0,
    consecutiveDays:   gs.consecutiveDays  ?? 0,
    soulCrystals:      gs.soulCrystals     ?? 0,
    wisdomTree:        gs.wisdomTree       ?? {},
    stageProgress:     gs.stageProgress    ?? [],
    dmLevel:           gs.dmLevel          ?? 1,
    ownedMonsterCount: (gs.ownedMonsters ?? []).length,
    ownedSkinCount:    Object.values(gs.ownedSkins ?? {}).flat().length,
    totalFusions:      gs.totalFusions     ?? 0,
    completedTribes:   gs.completedTribes  ?? 0,
    totalSummons:      (gs.summonHistory ?? []).length,
  };

  const newlyUnlocked = checkAchievements(achCtx, gs.achievements ?? {});
  if (newlyUnlocked.length === 0) return;

  // Persist unlocks
  const newAchievements = { ...(gs.achievements ?? {}) };
  newlyUnlocked.forEach(id => {
    newAchievements[id] = { unlocked: true, current: 0, unlockedAt: Date.now() };
  });
  saveGameState({ ...gs, achievements: newAchievements });

  // Show toasts in sequence
  newlyUnlocked.forEach((id, i) => {
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (!def) return;
    ctx.scene.time.delayedCall(i * 3200, () => showAchievementToast(ctx, def.name, def.icon));
  });
}

// ─── tickQuestAndNotify ────────────────────────────────────────────────────

export function tickQuestAndNotify(
  ctx: QuestTrackerContext,
  gs: ReturnType<typeof loadGameState>,
  type: Parameters<typeof updateQuestObjective>[1],
  amount = 1,
): GameState {
  const update = updateQuestObjective(gs, type, amount);
  const gs1    = tickSubQuestProgress(gs, type, amount);
  if (update?.questDone) {
    const [gs2] = completeAndAdvance(gs1);
    ctx.scene.time.delayedCall(600, () => showQuestCompleteToast(ctx));
    return gs2;
  }
  return gs1;
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
  if (!gs.ownedMonsters || gs.ownedMonsters.length === 0) return;
  const levelled: string[] = [];
  for (const m of gs.ownedMonsters) {
    const result = addXp(m, amount);
    if (result.levelled) levelled.push(`${m.id} → Lv.${result.newLevel}`);
  }
  saveGameState(gs);
  levelled.forEach((msg, i) => {
    ctx.scene.time.delayedCall(i * 400, () => showXpToast(ctx.scene, msg));
  });
  logger.debug(`[XP] +${amount} XP granted to ${gs.ownedMonsters.length} monsters`);
}

// ─── trackConsecutiveDays ──────────────────────────────────────────────────

export function trackConsecutiveDays(): void {
  const gs    = loadGameState();
  const today = new Date().toISOString().split('T')[0];
  if (gs.lastPlayDate === today) return;   // already tracked today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newDays = gs.lastPlayDate === yesterday ? (gs.consecutiveDays ?? 0) + 1 : 1;
  const updated = { ...gs, consecutiveDays: newDays, lastPlayDate: today };
  saveGameState(updated);
  logger.debug(`[STREAK] day ${updated.consecutiveDays} (last: ${updated.lastPlayDate})`);
}
