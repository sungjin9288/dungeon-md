/**
 * HomeLifecycle — extracted private-method bodies from DungeonHomeScene.
 *
 * Covers: idle income, room feedback banner, focus/return, quests,
 * battle-return settlement, unlock reveal, and tutorial.
 *
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { getUnlockedSlots } from '../data/wisdom';
import {
  applyBattleReturnSettlement,
  type BattleReturnResult,
} from '../data/invasionTransactions';
import {
  initializeHomeQuestState,
  settleCompletedHomeMainQuest,
  type HomeMainQuestCompletionResult,
} from '../data/questLifecycleTransactions';
import { settleTutorialStageAdvance } from '../data/tutorialTransactions';
import { TutorialOverlay, TUTORIAL_STEPS, TUTORIAL_DONE } from '../ui/TutorialOverlay';
import {
  showQuestCompleteOverlay,
  showGameCompleteOverlay,
} from '../ui/QuestLogPanel';
import {
  computeIdleReward, collectIdleIncome, startIdleClock, hasIdlePayout, IDLE_CAP_HOURS,
  type IdleReward,
} from '../data/idleIncome';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  showBattleReturnOverlay,
  showDmLevelUpOverlay,
  showBattleDefeatOverlay,
} from '../ui/HomeOverlays';
import {
  checkForInvasion,
  showInvasionBanner,
  goToPreBattle,
} from '../ui/InvasionUI';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { logger } from '../utils/logger';
import type { HomeRoomFeedback } from './DungeonHomeScene';

// ─── Layout constants (must match DungeonHomeScene.ts) ───────────────────────

const TOP_H = 64;
const QUEST_BANNER_H = 22;
const GRID_ROWS_HOME = 3;
const SLOT_PAD_Y = 8;
const GRID_START_Y = TOP_H + QUEST_BANNER_H + 10;

// ─── maybeShowIdleIncome ──────────────────────────────────────────────────────

export function maybeShowIdleIncome(scene: DungeonHomeScene): void {
  const now = Date.now();
  // First-ever visit: start the clock, no payout (avoid an epoch-sized reward).
  if ((scene.gs.lastIdleCollect ?? 0) <= 0) {
    scene.persistGameState(startIdleClock(scene.gs, now));
    return;
  }
  const reward = computeIdleReward(scene.gs, now);
  if (!hasIdlePayout(reward)) return;   // nothing meaningful accrued yet — keep accruing
  scene.time.delayedCall(550, () => showIdleIncomePanel(scene, reward));
}

// ─── formatIdleDuration ──────────────────────────────────────────────────────

export function formatIdleDuration(_scene: DungeonHomeScene, ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${Math.max(1, m)}분`;
}

// ─── showIdleIncomePanel ──────────────────────────────────────────────────────

export function showIdleIncomePanel(scene: DungeonHomeScene, reward: IdleReward): void {
  if (!scene.scene.isActive()) return;
  const cx = CANVAS_WIDTH / 2;
  const matParts = Object.entries(reward.materials)
    .map(([id, q]) => `${MATERIAL_DEFS[id]?.emoji ?? '❔'}${q}`);
  const w = 300, h = matParts.length ? 256 : 224;
  const px = cx - w / 2;
  const py = CANVAS_HEIGHT / 2 - h / 2;

  // Tap-blocking scrim.
  const scrim = scene.add.graphics().setDepth(899);
  scrim.fillStyle(CASUAL.SHADOW, 0.62);
  scrim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scrim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );

  const overlay = scene.add.container(0, 0).setDepth(900);

  const frame = addFramedPanel(scene, {
    x: px, y: py, w, h, radius: 18,
    fillColor: CASUAL.PANEL, borderColor: CASUAL.GOLD, borderAlpha: 1, borderWidth: 3,
    accentColor: CASUAL.GOLD, accentAlpha: 0.5, glowColor: CASUAL.GOLD, glowOpacity: 0.1,
    shadowOpacity: 0.5, shadowOffsetY: 5,
  });
  overlay.add([frame.shadow, frame.panel, frame.glow]);

  overlay.add(scene.add.text(cx, py + 28, '🏰 던전 방치 수익', {
    fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
    color: CASUAL_CSS.GOLD, stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5));

  const dur = formatIdleDuration(scene, reward.creditedMs);
  overlay.add(scene.add.text(cx, py + 60, `던전을 비운 ${dur} 동안${reward.capped ? ' (최대 적립)' : ''}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  let cy = py + 96;
  if (reward.gold > 0) {
    overlay.add(scene.add.text(cx, cy, `💰 +${reward.gold.toLocaleString('ko-KR')}`, {
      fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: CASUAL_CSS.GOLD, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5));
    cy += 34;
  }
  if (matParts.length) {
    overlay.add(scene.add.text(cx, cy, `🏭 ${matParts.join('  ')}`, {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    cy += 26;
  }

  overlay.add(scene.add.text(cx, cy + 6, `던전 운영 ${Math.round(reward.ratePerMin)} 골드/분 · 생산 시설 + 최대 ${IDLE_CAP_HOURS}시간`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  const btnW = 180, btnH = 44;
  const claim = addPrimaryActionButton(scene, {
    x: cx - btnW / 2, y: py + h - 58, w: btnW, h: btnH, label: '수령', fontSize: '17px',
    fillColor: CASUAL.GOLD, hoverFillColor: 0xffd66a, borderColor: CASUAL.GOLD_DK,
    once: true,
    onPress: () => {
      const { state } = collectIdleIncome(scene.gs, Date.now());
      scene.persistGameState(state);
      overlay.destroy();
      scrim.destroy();
    },
  });
  overlay.add([claim.bg, claim.text, claim.zone]);

  // Fade in (no scale — keeps the full-screen scrim aligned).
  scrim.setAlpha(0);
  overlay.setAlpha(0);
  scene.tweens.add({ targets: [scrim, overlay], alpha: 1, duration: 220, ease: 'Quad.easeOut' });
}

// ─── consumeHomeRoomFeedback ──────────────────────────────────────────────────

export function consumeHomeRoomFeedback(scene: DungeonHomeScene): HomeRoomFeedback | null {
  const raw = scene.registry.get('homeRoomFeedback') as Partial<HomeRoomFeedback> | undefined;
  scene.registry.remove('homeRoomFeedback');
  if (!raw || (
    raw.kind !== 'equipment'
    && raw.kind !== 'upgrade'
    && raw.kind !== 'design'
    && raw.kind !== 'monster'
    && raw.kind !== 'trap'
    && raw.kind !== 'repair'
    && raw.kind !== 'unlock'
  )) return null;
  const slotIdx = typeof raw.slotIdx === 'number' ? raw.slotIdx : Number(raw.slotIdx);
  if (!Number.isInteger(slotIdx)) return null;
  if (slotIdx < 0 || slotIdx >= getUnlockedSlots(scene.gs.dmLevel)) return null;
  if (!raw.title || !raw.body) return null;
  if (raw.kind === 'equipment' && (!raw.equipmentName || !raw.equipmentEmoji)) return null;
  return {
    kind: raw.kind,
    slotIdx,
    title: raw.title,
    body: raw.body,
    equipmentName: raw.equipmentName,
    equipmentEmoji: raw.equipmentEmoji,
    statLabel: raw.statLabel,
    statBefore: raw.statBefore,
    statAfter: raw.statAfter,
    accent: typeof raw.accent === 'number' ? raw.accent : 0xc8e8b0,
  };
}

// ─── showHomeRoomFeedbackBanner ───────────────────────────────────────────────

export function showHomeRoomFeedbackBanner(
  scene: DungeonHomeScene,
  feedback: HomeRoomFeedback,
): void {
  const w = 318;
  const h = 62;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = TOP_H + QUEST_BANNER_H + 2;
  const accent = feedback.accent;
  const icon = feedback.kind === 'equipment'
    ? feedback.equipmentEmoji ?? '⚒'
    : feedback.kind === 'repair'
      ? '🛠'
      : feedback.kind === 'monster'
        ? '👹'
        : feedback.kind === 'trap'
          ? '⚠'
          : '★';
  const statText = feedback.statLabel && feedback.statBefore && feedback.statAfter
    ? `${feedback.statLabel} ${feedback.statBefore}→${feedback.statAfter}`
    : `B${feedback.slotIdx + 1}`;
  const title = feedback.kind === 'equipment' && feedback.equipmentName
    ? `${feedback.equipmentEmoji ?? icon} ${feedback.equipmentName} 장착 완료`
    : feedback.title;

  const c = scene.add.container(0, 0).setDepth(38).setAlpha(0).setY(-8);
  const bg = scene.add.graphics();
  bg.fillStyle(0x04110f, 0.96);
  bg.fillRoundedRect(x, y, w, h, 12);
  bg.fillStyle(accent, 0.12);
  bg.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 9);
  bg.fillStyle(0x070503, 0.34);
  bg.fillRoundedRect(x + w - 88, y + 12, 74, h - 24, 9);
  bg.lineStyle(1.6, accent, 0.84);
  bg.strokeRoundedRect(x, y, w, h, 12);
  bg.lineStyle(1, 0xffffff, 0.12);
  bg.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 9);
  bg.fillStyle(accent, 0.18);
  bg.fillCircle(x + 34, y + h / 2, 22);
  bg.lineStyle(1, 0xffffff, 0.18);
  bg.strokeCircle(x + 34, y + h / 2, 22);
  c.add(bg);

  c.add(scene.add.text(x + 34, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '22px',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 66, y + 19, title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#d8fff5',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 66, y + 40, feedback.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: scene.theme.textSecondary,
    wordWrap: { width: w - 166, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 51, y + h / 2 - 4, statText, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: '#b8fff0',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 51, y + h / 2 + 13, '방 반영', {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#82cdbd',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  scene.tweens.add({
    targets: c,
    alpha: 1,
    y: 0,
    duration: 180,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: c,
        alpha: 0,
        y: -8,
        delay: 1900,
        duration: 240,
        ease: 'Quad.easeIn',
        onComplete: () => c.destroy(),
      });
    },
  });
}

// ─── maybeOpenFocusedDungeonSlot ──────────────────────────────────────────────

export function maybeOpenFocusedDungeonSlot(scene: DungeonHomeScene): void {
  const focusedSlotIdx = consumeFocusRoomSlotIdx(scene);
  const feedbackSlotIdx = scene.pendingRoomFeedback?.kind === 'equipment'
    ? scene.pendingRoomFeedback.slotIdx
    : null;
  const slotIdx = focusedSlotIdx ?? feedbackSlotIdx;
  if (slotIdx === null) return;
  const openDelay = scene.pendingRoomFeedback?.slotIdx === slotIdx ? 2400 : 280;

  window.setTimeout(() => {
    if (!scene.scene.isActive()) return;
    scene.openDungeonSlot(slotIdx);
  }, openDelay);
}

// ─── consumeFocusRoomSlotIdx ──────────────────────────────────────────────────

export function consumeFocusRoomSlotIdx(scene: DungeonHomeScene): number | null {
  const raw = scene.registry.get('focusRoomSlotIdx');
  scene.registry.remove('focusRoomSlotIdx');
  scene.registry.remove('focusMonsterId');
  scene.registry.remove('focusSourceLabel');
  const slotIdx = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(slotIdx)) return null;
  if (slotIdx < 0 || slotIdx >= getUnlockedSlots(scene.gs.dmLevel)) return null;
  return slotIdx;
}

// ─── hasPreBattleEditReturn ───────────────────────────────────────────────────

export function hasPreBattleEditReturn(scene: DungeonHomeScene): boolean {
  return Boolean(scene.registry.get('preBattleEditReturn'))
    && Boolean(scene.registry.get('invasionConfig'));
}

// ─── resumePreBattleFromRoomEdit ──────────────────────────────────────────────

export function resumePreBattleFromRoomEdit(scene: DungeonHomeScene): void {
  if (!hasPreBattleEditReturn(scene)) {
    goToPreBattle(scene, scene.gs, scene.invasionState);
    return;
  }

  scene.registry.remove('preBattleEditReturn');
  if (!scene.registry.get('questId')) {
    scene.registry.set('questId', scene.gs.activeMainQuestId);
  }
  scene.cameras.main.fadeOut(220, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start('PreBattleScene');
  });
}

// ─── initQuests ──────────────────────────────────────────────────────────────

export function initQuests(scene: DungeonHomeScene): void {
  scene.applyGameStateResult(initializeHomeQuestState(scene.gs));
  settlePendingQuestCompletion(scene);
  checkForInvasion(
    scene, scene.gs, scene.invasionState,
    GRID_START_Y, GRID_ROWS_HOME, SLOT_PAD_Y,
  );
}

// ─── settlePendingQuestCompletion ─────────────────────────────────────────────

/**
 * Settle a main quest whose objectives were completed outside battle
 * (home room build, summon, fusion, feeding). Battle returns settle via
 * checkBattleReturn; this covers every other path and re-checks for a
 * newly started invasion quest so the chain keeps flowing at home.
 */
export function settlePendingQuestCompletion(scene: DungeonHomeScene): void {
  if (scene.questSettlePending) return;
  const done = advanceCompletedQuest(scene);
  if (!done) return;
  scene.questSettlePending = true;
  scene.time.delayedCall(350, () => {
    scene.questSettlePending = false;
    if (!scene.scene.isActive('DungeonHomeScene')) return;
    handleQuestComplete(scene, done);
    checkForInvasion(
      scene, scene.gs, scene.invasionState,
      GRID_START_Y, GRID_ROWS_HOME, SLOT_PAD_Y,
    );
    // The next quest may start already satisfied (auto-met objectives) —
    // drain the chain so back-to-back completions settle without user input.
    settlePendingQuestCompletion(scene);
  });
}

// ─── advanceCompletedQuest ────────────────────────────────────────────────────

export function advanceCompletedQuest(
  scene: DungeonHomeScene,
): HomeMainQuestCompletionResult | null {
  const result = scene.applyGameStateResult(settleCompletedHomeMainQuest(scene.gs));
  return result.completion ? result : null;
}

// ─── handleQuestComplete ──────────────────────────────────────────────────────

export function handleQuestComplete(
  scene: DungeonHomeScene,
  result: HomeMainQuestCompletionResult,
): void {
  const completion = result.completion;
  if (!completion) return;

  if (result.pendingUnlock) scene.registry.set('pendingUnlock', result.pendingUnlock);
  if (result.chapterCompleted) scene.registry.set('chapterComplete', true);

  result.unlockedBlueprintIds.forEach(bp => logger.debug(`[FORGE] Blueprint unlocked: ${bp}`));
  if (result.awakeningStonesAwarded > 0) {
    logger.debug(`[AWAKEN] +${result.awakeningStonesAwarded} awakening stone (total: ${scene.gs.awakeningStones})`);
  }

  if (result.gameCompleted) {
    showGameCompleteOverlay(scene, completion.completedQuest);
  } else {
    showQuestCompleteOverlay(scene, completion.completedQuest);
  }
}

// ─── checkBattleReturn ────────────────────────────────────────────────────────

export function checkBattleReturn(scene: DungeonHomeScene): void {
  const result = scene.registry.get('battleResult') as BattleReturnResult | undefined;
  if (!result) return;
  scene.registry.remove('battleResult');
  scene.registry.remove('returnTo');

  const prevGold    = scene.gs.homeGold;
  const prevCrystal = scene.gs.soulCrystals;
  const prevGems    = scene.gs.gems;
  const prevDmLevel = scene.gs.dmLevel;
  const prevSlots = getUnlockedSlots(prevDmLevel);

  const settlement = scene.applyGameStateResult(
    applyBattleReturnSettlement(scene.gs, result),
  );
  const didLevelUp = settlement.didLevelUp;
  const battleReturnGrowth = {
    previousDmLevel: prevDmLevel,
    nextDmLevel: scene.gs.dmLevel,
    previousSlots: prevSlots,
    nextSlots: getUnlockedSlots(scene.gs.dmLevel),
    questCompletionPending: !!settlement.defendUpdate?.questDone,
    materialsEarned: result.materialsEarned,
  };
  if (settlement.changed) scene.refreshHomeDynamicPanels();

  // Animate changed currency displays
  const newVals = [scene.gs.homeGold, scene.gs.soulCrystals, scene.gs.gems];
  const oldVals = [prevGold, prevCrystal, prevGems];
  newVals.forEach((nv, i) => {
    const t = scene.currencyTexts[i];
    if (!t || !t.active) return;
    t.setText(nv.toLocaleString('ko-KR'));
    if (nv !== oldVals[i]) {
      t.setColor('#ffee44');
      scene.tweens.add({
        targets: t, scaleX: 1.4, scaleY: 1.4, duration: 130, ease: 'Back.easeOut',
        onComplete: () => scene.tweens.add({
          targets: t, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeIn',
          onComplete: () => t.setColor('#e8d090'),
        }),
      });
    }
  });

  if (result.won) {
    const update = settlement.defendUpdate;
    const afterReturn = () => {
      if (didLevelUp) {
        const slotUnlocked = battleReturnGrowth.nextSlots > battleReturnGrowth.previousSlots;
        scene.time.delayedCall(200, () => showDmLevelUpOverlay(scene, scene.gs.dmLevel, {
          primaryLabel: slotUnlocked ? '새 방 설계' : '확인',
          onDismiss: slotUnlocked
            ? () => revealUnlockedRoom(
                scene,
                battleReturnGrowth.previousSlots,
                battleReturnGrowth.nextSlots,
              )
            : undefined,
        }));
      } else if (update?.questDone) {
        const done = advanceCompletedQuest(scene);
        if (done) handleQuestComplete(scene, done);
      }
    };
    if (update?.questDone && !didLevelUp) {
      const done = advanceCompletedQuest(scene);
      scene.time.delayedCall(400, () => {
        showBattleReturnOverlay(scene, result, () => {
          if (done) handleQuestComplete(scene, done);
        }, battleReturnGrowth);
      });
    } else {
      scene.time.delayedCall(400, () => showBattleReturnOverlay(scene, result, afterReturn, battleReturnGrowth));
    }
  } else {
    scene.time.delayedCall(400, () => showBattleDefeatOverlay(
      scene,
      () => showInvasionBanner(
        scene, scene.invasionState,
        () => goToPreBattle(scene, scene.gs, scene.invasionState),
      ),
    ));
  }
}

// ─── revealUnlockedRoom ───────────────────────────────────────────────────────

export function revealUnlockedRoom(
  scene: DungeonHomeScene,
  previousSlots: number,
  nextSlots: number,
): void {
  if (nextSlots <= previousSlots) return;
  const slotIdx = previousSlots;
  if (slotIdx < 0 || slotIdx >= getUnlockedSlots(scene.gs.dmLevel)) return;

  scene.pendingRoomFeedback = {
    kind: 'unlock',
    slotIdx,
    title: '새 방 해금',
    body: `방 #${slotIdx + 1} 설계 가능`,
    statLabel: '방',
    statBefore: String(previousSlots),
    statAfter: String(nextSlots),
    accent: 0x55b88a,
  };
  scene.recentlyChangedRoomIdx = slotIdx;
  scene.refreshHomeDynamicPanels();

  scene.time.delayedCall(420, () => {
    if (!scene.scene.isActive('DungeonHomeScene')) return;
    const overlayOpen = !!scene.roomDetailState.roomDetailContainer
      || !!scene.roomDetailState.monsterPickerContainer
      || !!scene.roomDetailState.trapPickerContainer;
    if (overlayOpen) return;
    scene.openDungeonSlot(slotIdx);
  });
}

// ─── maybeShowTutorial ────────────────────────────────────────────────────────

export function maybeShowTutorial(scene: DungeonHomeScene): void {
  const stage = scene.gs.tutorialStage ?? 0;
  if (stage >= TUTORIAL_DONE) return;

  const nextStageNum = stage === 0 ? 1 : stage;
  const step = TUTORIAL_STEPS.find(s => s.stage === nextStageNum);
  if (!step) return;

  scene.time.delayedCall(700, () => {
    if (!scene.tutorialOverlay) {
      scene.tutorialOverlay = new TutorialOverlay(scene, (completedStage) => {
        const result = scene.applyGameStateResult(
          settleTutorialStageAdvance(scene.gs, completedStage),
        );
        if (result.nextStage !== null) {
          const nextStep = TUTORIAL_STEPS.find(s => s.stage === result.nextStage);
          if (nextStep && scene.tutorialOverlay) scene.tutorialOverlay.show(nextStep);
        } else {
          scene.tutorialOverlay = null;
        }
      });
    }
    scene.tutorialOverlay.show(step);
  });
}
