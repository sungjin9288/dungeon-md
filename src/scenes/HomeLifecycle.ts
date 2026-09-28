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
import { getUnlockedSlotCount } from '../data/wisdom';
import { NAVIGATION_CONTEXT_OPERATIONS } from '../data/navigationContract';
import { beginForecastDay, settleForecastBattle } from '../data/forecastTransactions';
import { getTodayString } from '../data/daily';
import { showToast } from '../ui/Toast';
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
import { getReducedMotion } from '../utils/reducedMotion';
import {
  showQuestCompleteOverlay,
  showGameCompleteOverlay,
} from '../ui/QuestLogPanel';
import {
  computeIdleReward, collectIdleIncome, startIdleClock, hasIdlePayout, idleCapHours,
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
    .map(([id, q]) => `${MATERIAL_DEFS[id]?.name ?? id} ×${q}`);
  const w = 318, h = matParts.length ? 256 : 230;
  const px = cx - w / 2;
  const py = CANVAS_HEIGHT / 2 - h / 2;

  // Tap-blocking scrim.
  const scrim = scene.add.graphics().setDepth(899);
  scrim.fillStyle(0x000000, 0.76);
  scrim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scrim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );

  const overlay = scene.add.container(0, 0).setDepth(900);

  const frame = addFramedPanel(scene, {
    x: px, y: py, w, h, radius: 6,
    fillColor: 0x070908, borderColor: 0xa98245, borderAlpha: 0.9, borderWidth: 2,
    accentColor: 0x4f9b78, accentAlpha: 0.7, glowColor: 0x4f9b78, glowOpacity: 0.08,
    shadowOpacity: 0.62, shadowOffsetY: 5,
  });
  overlay.add([frame.shadow, frame.panel, frame.glow]);

  const seal = scene.add.graphics();
  seal.fillStyle(0xa98245, 0.16);
  seal.fillCircle(cx, py + 27, 15);
  seal.lineStyle(1.5, 0xa98245, 0.86);
  seal.strokeCircle(cx, py + 27, 10);
  seal.lineBetween(cx - 5, py + 27, cx + 5, py + 27);
  seal.lineBetween(cx, py + 22, cx, py + 32);
  overlay.add(seal);

  overlay.add(scene.add.text(cx, py + 52, '방치 수익 회수', {
    fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold',
    color: '#e7d6b5',
  }).setOrigin(0.5));

  const dur = formatIdleDuration(scene, reward.creditedMs);
  overlay.add(scene.add.text(cx, py + 76, `던전을 비운 ${dur} 동안${reward.capped ? ' · 최대 적립' : ''}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#a89c86',
  }).setOrigin(0.5));

  let cy = py + 108;
  if (reward.gold > 0) {
    overlay.add(scene.add.text(cx, cy, `+${reward.gold.toLocaleString('ko-KR')} 황금`, {
      fontFamily: 'sans-serif', fontSize: '25px', fontStyle: 'bold',
      color: '#d8b869',
    }).setOrigin(0.5));
    cy += 34;
  }
  if (matParts.length) {
    overlay.add(scene.add.text(cx, cy, matParts.join(' · '), {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: '#75b998', wordWrap: { width: w - 36 }, align: 'center',
    }).setOrigin(0.5));
    cy += 26;
  }

  overlay.add(scene.add.text(cx, cy + 5, `총 ${reward.ratePerMin.toFixed(1)} 황금/분 · 최대 ${idleCapHours(scene.gs)}시간 적립`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#8f8779',
  }).setOrigin(0.5));

  const btnW = 180, btnH = 44;
  const claim = addPrimaryActionButton(scene, {
    x: cx - btnW / 2, y: py + h - 58, w: btnW, h: btnH, label: '수령', fontSize: '17px',
    fillColor: 0x16231d, hoverFillColor: 0x234133, borderColor: 0x66b58c,
    onPress: () => {
      // Animation callbacks may still be queued after a successful claim/scene exit.
      if (!overlay.active || !scene.scene.isActive()) return;
      const { state } = collectIdleIncome(scene.gs, Date.now());
      try {
        scene.persistGameState(state);
      } catch {
        showToast(scene, '수령 저장 실패. 다시 시도해주세요.', { color: '#ff8888', depth: 901 });
        return;
      }
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
  if (slotIdx < 0 || slotIdx >= getUnlockedSlotCount(scene.gs)) return null;
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
    fontSize: '10px',
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
  if (slotIdx < 0 || slotIdx >= getUnlockedSlotCount(scene.gs)) return null;
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
  if (getReducedMotion()) {
    scene.scene.start('PreBattleScene');
    return;
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

/**
 * First visit of a day: erode the name for absences, pay the weekly settlement,
 * issue today's cards. Runs after the battle return so a returning card is
 * settled against the day it was taken on.
 */
export function beginHomeForecastDay(scene: DungeonHomeScene): void {
  const started = scene.applyGameStateResult(beginForecastDay(scene.gs, getTodayString()));
  if (started.weeklyGems > 0) {
    scene.time.delayedCall(600, () => showToast(scene, `주간 명성 정산 — 보석 +${started.weeklyGems}`, { color: '#ffd166' }));
  }
}

export function checkBattleReturn(scene: DungeonHomeScene): void {
  const result = scene.registry.get('battleResult') as BattleReturnResult | undefined;
  if (!result) return;
  const forecastCardId = scene.registry.get('forecastCardId') as string | undefined;
  NAVIGATION_CONTEXT_OPERATIONS[forecastCardId ? 'forecast-return' : 'battle-result'].consume
    .forEach(field => scene.registry.remove(field));

  const prevGold    = scene.gs.homeGold;
  const prevCrystal = scene.gs.soulCrystals;
  const prevGems    = scene.gs.gems;
  const prevDmLevel = scene.gs.dmLevel;
  const prevSlots = getUnlockedSlotCount({ dmLevel: prevDmLevel, wisdomTree: scene.gs.wisdomTree });

  // A forecast card's battle settles through the card (loot + DM XP once, then
  // the card's reward and the name); any other battle settles as before.
  const settlement = forecastCardId
    ? (() => {
        const forecast = settleForecastBattle(scene.gs, forecastCardId, result, {
          flawless: result.won && (result.hpShare ?? 0) >= 0.999,
        });
        scene.applyGameStateResult(forecast);
        if (forecast.card) {
          const delta = forecast.notorietyDelta;
          scene.time.delayedCall(500, () => showToast(
            scene,
            delta >= 0 ? `${forecast.card?.title} — 명성 +${delta}` : `${forecast.card?.title} — 명성 ${delta}`,
            { color: delta >= 0 ? '#ffd166' : '#ff9a8a' },
          ));
        }
        return forecast.battle;
      })()
    : scene.applyGameStateResult(applyBattleReturnSettlement(scene.gs, result));
  const didLevelUp = settlement.didLevelUp;
  const battleReturnGrowth = {
    previousDmLevel: prevDmLevel,
    nextDmLevel: scene.gs.dmLevel,
    previousSlots: prevSlots,
    nextSlots: getUnlockedSlotCount(scene.gs),
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
        scene.time.delayedCall(200, () => showDmLevelUpOverlay(scene, battleReturnGrowth, {
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
        }, battleReturnGrowth, result.callout);
      });
    } else {
      scene.time.delayedCall(400, () => showBattleReturnOverlay(scene, result, afterReturn, battleReturnGrowth, result.callout));
    }
  } else {
    scene.time.delayedCall(400, () => showBattleDefeatOverlay(
      scene,
      () => showInvasionBanner(
        scene, scene.invasionState,
        () => goToPreBattle(scene, scene.gs, scene.invasionState),
      ),
      result.callout,
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
  if (slotIdx < 0 || slotIdx >= getUnlockedSlotCount(scene.gs)) return;

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
