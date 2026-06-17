import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  loadGameState, saveGameState,
  getUnlockedSlots,
  getRoomSlotCapacity,
  type DungeonSlot,
  type GameState,
  type OwnedMonster,
} from '../data/wisdom';
import { calculateDungeonMetrics, calculateRoomMetrics } from '../data/dungeonMetrics';
import { getReadinessDirectiveCopy } from '../data/readinessDirectives';
import {
  getDungeonActionQueue,
  getRoomActionRecommendation,
  type RoomActionRecommendation,
} from '../data/roomActionRecommendations';
import { MONSTER_DEFS } from '../data/monsters';
import {
  applyBattleReturnSettlement,
  xpForDmLevel,
  type BattleReturnResult,
} from '../data/invasionTransactions';
import {
  initializeHomeQuestState,
  settleCompletedHomeMainQuest,
  type HomeMainQuestCompletionResult,
} from '../data/questLifecycleTransactions';
import { settleTutorialStageAdvance } from '../data/tutorialTransactions';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { audioManager } from '../audio/AudioManager';
import { TutorialOverlay, TUTORIAL_STEPS, TUTORIAL_DONE } from '../ui/TutorialOverlay';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  drawStalactites, drawStalagmites, addWaterDrip,
} from '../themes/decorations';
import { logger } from '../utils/logger';
import { openSimulationModal } from '../ui/SimulationModal';
import {
  showQuestCompleteOverlay,
  showGameCompleteOverlay,
  openQuestLog,
  type QuestLogState,
} from '../ui/QuestLogPanel';
import { buildDailyContentPanel, showChallengePanel } from '../ui/DailyContentPanel';
import {
  openRoomDetail as openRoomDetailOverlay,
  createRoomDetailState,
  type RoomDetailState,
  type RoomDetailCallbacks,
} from '../ui/RoomDetailOverlay';
import {
  openPlacementTray,
  closePlacementTray,
} from '../ui/DungeonPlacementTray';
import {
  type RoomSlotContext,
  drawBattleSlot as _drawBattleSlot,
  SLOT_W, SLOT_H,
} from '../ui/RoomSlotRenderer';
import {
  type InvasionUIState,
  createInvasionUIState,
  checkForInvasion,
  showInvasionBanner,
  goToPreBattle,
} from '../ui/InvasionUI';
import { type DungeonBoardLayout } from '../ui/DungeonBoardLayout';
import { buildDungeonBlueprintPanel } from '../ui/DungeonBlueprintPanel';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import {
  computeIdleReward, collectIdleIncome, startIdleClock, hasIdlePayout, IDLE_CAP_HOURS,
  type IdleReward,
} from '../data/idleIncome';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  type TopBarRefs,
  buildTopBar,
  buildQuestBanner,
  buildStatsBar,
  showBattleReturnOverlay,
  showDmLevelUpOverlay,
  showBattleDefeatOverlay,
  showChapterCompleteOverlay,
} from '../ui/HomeOverlays';
import { getReducedMotion } from '../utils/reducedMotion';
import {
  drawDungeonRouteNetwork as _drawDungeonRouteNetwork,
  getUnlockedRoute as _getUnlockedRoute,
  addDungeonRouteFlow as _addDungeonRouteFlow,
} from './HomeBoardRoute';
import {
  drawDungeonMapBackdrop as _drawDungeonMapBackdrop,
} from './HomeBoardScenery';
import {
  rebuildDungeonSlots as _rebuildDungeonSlots,
  drawDungeonRoomAlcove as _drawDungeonRoomAlcove,
  addRoomActivityAura as _addRoomActivityAura,
  getRoomActivityColor as _getRoomActivityColor,
  makeRoomSlotCtx as _makeRoomSlotCtx,
} from './HomeRoomCards';
import {
  getRoomActionPin as _getRoomActionPin,
} from './HomeRoomActionPin';

// ─── Layout constants ──────────────────────────────────────────────────────────

const TOP_H    = 64;
const BOT_H    = 64;
const BOT_Y    = CANVAS_HEIGHT - BOT_H;

const GRID_ROWS_HOME = 3;

const SLOT_PAD_Y = 8;
const QUEST_BANNER_H = 22;
const BLUEPRINT_Y = TOP_H + QUEST_BANNER_H + 5;
const BLUEPRINT_H = 0;
const GRID_START_Y = TOP_H + QUEST_BANNER_H + 10;

function xpForLevel(lv: number): number { return xpForDmLevel(lv); }

interface GameStateResult {
  readonly state: GameState;
  readonly changed: boolean;
}

interface HomeDirective {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
  readonly onPress: () => void;
}

export interface HomeRoomFeedback {
  readonly kind: 'equipment' | 'upgrade' | 'design' | 'monster' | 'trap' | 'repair' | 'unlock';
  readonly slotIdx: number;
  readonly title: string;
  readonly body: string;
  readonly equipmentName?: string;
  readonly equipmentEmoji?: string;
  readonly statLabel?: string;
  readonly statBefore?: string;
  readonly statAfter?: string;
  readonly accent: number;
}

interface HomeRoomActionPin {
  readonly slotIdx: number;
  readonly label: string;
  readonly icon: string;
  readonly accent: number;
}

interface HomeFocusTarget {
  readonly monsterId: string;
  readonly sourceLabel: string;
  readonly slotIdx: number | null;
}


export class DungeonHomeScene extends Phaser.Scene {
  /** @internal */ gs = loadGameState();
  private tutorialOverlay: TutorialOverlay | null = null;
  /** @internal */ roomDetailState: RoomDetailState = createRoomDetailState();
  private roomDetailCallbacks: RoomDetailCallbacks = {
    getGameState: () => this.gs,
    saveAndRefresh: (nextState = this.gs) => this.persistGameState(nextState),
    rebuildDungeonSlots: () => this.refreshHomeDynamicPanels(),
    markRoomChanged: (slotIdx) => this.markRoomChanged(slotIdx),
    navigateToScene: (sceneKey) => this.navigateFromHome(sceneKey),
    openRoomSlot: (slotIdx) => this.openDungeonSlot(slotIdx),
    startBattle: () => goToPreBattle(this, this.gs, this.invasionState),
    isPreBattleEditActive: () => this.hasPreBattleEditReturn(),
    resumePreBattle: () => this.resumePreBattleFromRoomEdit(),
  };
  /** @internal */ dungeonContainer: Phaser.GameObjects.Container | null = null;
  private dungeonBlueprintContainer: Phaser.GameObjects.Container | null = null;
  private commandDeckContainer: Phaser.GameObjects.Container | null = null;
  /** @internal */ boardLayout!: DungeonBoardLayout;
  /** @internal */ recentlyChangedRoomIdx: number | null = null;
  /** @internal */ selectedRoomIdx: number | null = null;
  /** @internal */ pendingRoomFeedback: HomeRoomFeedback | null = null;
  private roomFocusTransitionActive = false;

  // Quest log panel
  private questLogState: QuestLogState = { questLogOpen: false };

  // Guards duplicate quest-complete overlays when multiple refreshes land in one frame
  private questSettlePending = false;

  // Invasion state (extracted to InvasionUI.ts)
  private invasionState: InvasionUIState = createInvasionUIState();

  // Currency text refs for live animation
  private currencyTexts: Phaser.GameObjects.Text[] = [];
  private topBarRefs: TopBarRefs | null = null;

  // Theme
  /** @internal */ theme!: DungeonTheme;

  constructor() { super({ key: 'DungeonHomeScene' }); }

  private persistGameState(nextState = this.gs): void {
    this.gs = nextState;
    saveGameState(this.gs);
    this.refreshCurrencyTexts();
    this.refreshTopBarProgress();
  }

  private markRoomChanged(slotIdx: number): void {
    this.recentlyChangedRoomIdx = slotIdx;
  }

  private refreshCurrencyTexts(): void {
    const values = [this.gs.homeGold, this.gs.soulCrystals, this.gs.gems];
    this.currencyTexts.forEach((text, idx) => {
      text.setText((values[idx] ?? 0).toLocaleString('ko-KR'));
    });
  }

  private refreshTopBarProgress(): void {
    if (!this.topBarRefs) return;
    const refs = this.topBarRefs;
    const xpTarget = xpForLevel(this.gs.dmLevel);
    const xpPct = Phaser.Math.Clamp((this.gs.dmXP ?? 0) / xpTarget, 0, 1);
    refs.dmLevelText.setText(`던전 마스터  Lv.${this.gs.dmLevel}`);
    refs.xpText.setText(`${this.gs.dmXP} / ${xpTarget} XP`);
    refs.xpFill.clear();
    if (xpPct > 0) {
      refs.xpFill.fillStyle(refs.xpFillBounds.color, 1);
      refs.xpFill.fillRoundedRect(
        refs.xpFillBounds.x,
        refs.xpFillBounds.y,
        Math.floor(refs.xpFillBounds.w * xpPct),
        refs.xpFillBounds.h,
        refs.xpFillBounds.radius,
      );
    }
  }

  private refreshHomeDynamicPanels(): void {
    this.rebuildDungeonBlueprintPanel();
    this.rebuildDungeonSlots();
    this.buildCommandDeck();
    this.settlePendingQuestCompletion();
  }

  private applyGameStateResult<T extends GameStateResult>(result: T): T {
    if (result.changed) this.persistGameState(result.state);
    return result;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create(): void {
    this.gs = loadGameState();
    this.roomDetailState = createRoomDetailState();
    this.questLogState = { questLogOpen: false };
    this.invasionState = createInvasionUIState();
    this.currencyTexts = [];
    this.topBarRefs = null;
    this.dungeonContainer = null;
    this.dungeonBlueprintContainer = null;
    this.commandDeckContainer = null;
    this.recentlyChangedRoomIdx = null;
    this.selectedRoomIdx = null;
    closePlacementTray();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      closePlacementTray();
      this.selectedRoomIdx = null;
    });
    this.pendingRoomFeedback = this.consumeHomeRoomFeedback();
    this.roomFocusTransitionActive = false;
    if (this.pendingRoomFeedback) this.recentlyChangedRoomIdx = this.pendingRoomFeedback.slotIdx;
    this.theme = getActiveTheme(this.gs.equippedTheme);
    this.buildBackground();

    const topBarRefs: TopBarRefs = buildTopBar(
      this, this.gs, this.theme, TOP_H, this.questLogState, xpForLevel,
    );
    this.topBarRefs = topBarRefs;
    this.currencyTexts = topBarRefs.currencyTexts;

    buildQuestBanner(this, this.gs, this.theme, TOP_H,
      () => openQuestLog(this, this.questLogState, this.gs));
    this.buildDungeonGrid();
    this.buildCommandDeck();
    buildStatsBar(this, this.gs, this.theme, BOT_Y);
    this.buildBottomNav();
    buildDailyContentPanel(this, () => showChallengePanel(this));
    this.addAmbientEffects();
    if (this.pendingRoomFeedback) this.showHomeRoomFeedbackBanner(this.pendingRoomFeedback);

    this.checkBattleReturn();  // must run before initQuests so rewards applied first
    this.initQuests();
    // Store latest gs ref after battle return and quest initialization.
    this.registry.set('_invasionGs', this.gs);

    this.maybeShowIdleIncome();

    const pendingUnlock = this.registry.get('pendingUnlock') as string | undefined;
    if (pendingUnlock) this.registry.remove('pendingUnlock');

    const chapterComplete = this.registry.get('chapterComplete') as boolean | undefined;
    if (chapterComplete) {
      this.registry.remove('chapterComplete');
      this.time.delayedCall(800, () => showChapterCompleteOverlay(this));
    }

    this.cameras.main.fadeIn(250, 0, 0, 0);
    audioManager.resume().then(() => audioManager.playBgm('home'));
    this.maybeOpenFocusedDungeonSlot();
    this.maybeShowTutorial();
  }

  // ─── Idle (offline) dungeon income ────────────────────────────────────────
  private maybeShowIdleIncome(): void {
    const now = Date.now();
    // First-ever visit: start the clock, no payout (avoid an epoch-sized reward).
    if ((this.gs.lastIdleCollect ?? 0) <= 0) {
      this.persistGameState(startIdleClock(this.gs, now));
      return;
    }
    const reward = computeIdleReward(this.gs, now);
    if (!hasIdlePayout(reward)) return;   // nothing meaningful accrued yet — keep accruing
    this.time.delayedCall(550, () => this.showIdleIncomePanel(reward));
  }

  private formatIdleDuration(ms: number): string {
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
    return `${Math.max(1, m)}분`;
  }

  private showIdleIncomePanel(reward: IdleReward): void {
    if (!this.scene.isActive()) return;
    const cx = CANVAS_WIDTH / 2;
    const matParts = Object.entries(reward.materials)
      .map(([id, q]) => `${MATERIAL_DEFS[id]?.emoji ?? '❔'}${q}`);
    const w = 300, h = matParts.length ? 256 : 224;
    const px = cx - w / 2;
    const py = CANVAS_HEIGHT / 2 - h / 2;

    // Tap-blocking scrim.
    const scrim = this.add.graphics().setDepth(899);
    scrim.fillStyle(CASUAL.SHADOW, 0.62);
    scrim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scrim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );

    const overlay = this.add.container(0, 0).setDepth(900);

    const frame = addFramedPanel(this, {
      x: px, y: py, w, h, radius: 18,
      fillColor: CASUAL.PANEL, borderColor: CASUAL.GOLD, borderAlpha: 1, borderWidth: 3,
      accentColor: CASUAL.GOLD, accentAlpha: 0.5, glowColor: CASUAL.GOLD, glowOpacity: 0.1,
      shadowOpacity: 0.5, shadowOffsetY: 5,
    });
    overlay.add([frame.shadow, frame.panel, frame.glow]);

    overlay.add(this.add.text(cx, py + 28, '🏰 던전 방치 수익', {
      fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
      color: CASUAL_CSS.GOLD, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));

    const dur = this.formatIdleDuration(reward.creditedMs);
    overlay.add(this.add.text(cx, py + 60, `던전을 비운 ${dur} 동안${reward.capped ? ' (최대 적립)' : ''}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    let cy = py + 96;
    if (reward.gold > 0) {
      overlay.add(this.add.text(cx, cy, `💰 +${reward.gold.toLocaleString('ko-KR')}`, {
        fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold',
        color: CASUAL_CSS.GOLD, stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5));
      cy += 34;
    }
    if (matParts.length) {
      overlay.add(this.add.text(cx, cy, `🏭 ${matParts.join('  ')}`, {
        fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
        color: CASUAL_CSS.INK, stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5));
      cy += 26;
    }

    overlay.add(this.add.text(cx, cy + 6, `던전 운영 ${Math.round(reward.ratePerMin)} 골드/분 · 생산 시설 + 최대 ${IDLE_CAP_HOURS}시간`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    const btnW = 180, btnH = 44;
    const claim = addPrimaryActionButton(this, {
      x: cx - btnW / 2, y: py + h - 58, w: btnW, h: btnH, label: '수령', fontSize: '17px',
      fillColor: CASUAL.GOLD, hoverFillColor: 0xffd66a, borderColor: CASUAL.GOLD_DK,
      once: true,
      onPress: () => {
        const { state } = collectIdleIncome(this.gs, Date.now());
        this.persistGameState(state);
        overlay.destroy();
        scrim.destroy();
      },
    });
    overlay.add([claim.bg, claim.text, claim.zone]);

    // Fade in (no scale — keeps the full-screen scrim aligned).
    scrim.setAlpha(0);
    overlay.setAlpha(0);
    this.tweens.add({ targets: [scrim, overlay], alpha: 1, duration: 220, ease: 'Quad.easeOut' });
  }

  private maybeOpenFocusedDungeonSlot(): void {
    const focusedSlotIdx = this.consumeFocusRoomSlotIdx();
    const feedbackSlotIdx = this.pendingRoomFeedback?.kind === 'equipment'
      ? this.pendingRoomFeedback.slotIdx
      : null;
    const slotIdx = focusedSlotIdx ?? feedbackSlotIdx;
    if (slotIdx === null) return;
    const openDelay = this.pendingRoomFeedback?.slotIdx === slotIdx ? 2400 : 280;

    window.setTimeout(() => {
      if (!this.scene.isActive()) return;
      this.openDungeonSlot(slotIdx);
    }, openDelay);
  }

  private consumeFocusRoomSlotIdx(): number | null {
    const raw = this.registry.get('focusRoomSlotIdx');
    this.registry.remove('focusRoomSlotIdx');
    this.registry.remove('focusMonsterId');
    this.registry.remove('focusSourceLabel');
    const slotIdx = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(slotIdx)) return null;
    if (slotIdx < 0 || slotIdx >= getUnlockedSlots(this.gs.dmLevel)) return null;
    return slotIdx;
  }

  private hasPreBattleEditReturn(): boolean {
    return Boolean(this.registry.get('preBattleEditReturn'))
      && Boolean(this.registry.get('invasionConfig'));
  }

  private resumePreBattleFromRoomEdit(): void {
    if (!this.hasPreBattleEditReturn()) {
      goToPreBattle(this, this.gs, this.invasionState);
      return;
    }

    this.registry.remove('preBattleEditReturn');
    if (!this.registry.get('questId')) {
      this.registry.set('questId', this.gs.activeMainQuestId);
    }
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('PreBattleScene');
    });
  }

  private consumeHomeRoomFeedback(): HomeRoomFeedback | null {
    const raw = this.registry.get('homeRoomFeedback') as Partial<HomeRoomFeedback> | undefined;
    this.registry.remove('homeRoomFeedback');
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
    if (slotIdx < 0 || slotIdx >= getUnlockedSlots(this.gs.dmLevel)) return null;
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

  private showHomeRoomFeedbackBanner(feedback: HomeRoomFeedback): void {
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

    const c = this.add.container(0, 0).setDepth(38).setAlpha(0).setY(-8);
    const bg = this.add.graphics();
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

    c.add(this.add.text(x + 34, y + h / 2, icon, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
    }).setOrigin(0.5));
    c.add(this.add.text(x + 66, y + 19, title, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#d8fff5',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + 66, y + 40, feedback.body, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: this.theme.textSecondary,
      wordWrap: { width: w - 166, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + w - 51, y + h / 2 - 4, statText, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(x + w - 51, y + h / 2 + 13, '방 반영', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: '#82cdbd',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    this.tweens.add({
      targets: c,
      alpha: 1,
      y: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
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

  // ─── Tutorial ─────────────────────────────────────────────────────────────────

  private maybeShowTutorial(): void {
    const stage = this.gs.tutorialStage ?? 0;
    if (stage >= TUTORIAL_DONE) return;

    const nextStageNum = stage === 0 ? 1 : stage;
    const step = TUTORIAL_STEPS.find(s => s.stage === nextStageNum);
    if (!step) return;

    this.time.delayedCall(700, () => {
      if (!this.tutorialOverlay) {
        this.tutorialOverlay = new TutorialOverlay(this, (completedStage) => {
          const result = this.applyGameStateResult(
            settleTutorialStageAdvance(this.gs, completedStage),
          );
          if (result.nextStage !== null) {
            const nextStep = TUTORIAL_STEPS.find(s => s.stage === result.nextStage);
            if (nextStep && this.tutorialOverlay) this.tutorialOverlay.show(nextStep);
          } else {
            this.tutorialOverlay = null;
          }
        });
      }
      this.tutorialOverlay.show(step);
    });
  }

  // ─── Quest system ─────────────────────────────────────────────────────────────

  private initQuests(): void {
    this.applyGameStateResult(initializeHomeQuestState(this.gs));
    this.settlePendingQuestCompletion();
    checkForInvasion(
      this, this.gs, this.invasionState,
      GRID_START_Y, GRID_ROWS_HOME, SLOT_PAD_Y,
    );
  }

  /**
   * Settle a main quest whose objectives were completed outside battle
   * (home room build, summon, fusion, feeding). Battle returns settle via
   * checkBattleReturn; this covers every other path and re-checks for a
   * newly started invasion quest so the chain keeps flowing at home.
   */
  private settlePendingQuestCompletion(): void {
    if (this.questSettlePending) return;
    const done = this.advanceCompletedQuest();
    if (!done) return;
    this.questSettlePending = true;
    this.time.delayedCall(350, () => {
      this.questSettlePending = false;
      if (!this.scene.isActive('DungeonHomeScene')) return;
      this.handleQuestComplete(done);
      checkForInvasion(
        this, this.gs, this.invasionState,
        GRID_START_Y, GRID_ROWS_HOME, SLOT_PAD_Y,
      );
      // The next quest may start already satisfied (auto-met objectives) —
      // drain the chain so back-to-back completions settle without user input.
      this.settlePendingQuestCompletion();
    });
  }

  // ─── Battle return ────────────────────────────────────────────────────────────

  private checkBattleReturn(): void {
    const result = this.registry.get('battleResult') as BattleReturnResult | undefined;
    if (!result) return;
    this.registry.remove('battleResult');
    this.registry.remove('returnTo');

    const prevGold    = this.gs.homeGold;
    const prevCrystal = this.gs.soulCrystals;
    const prevGems    = this.gs.gems;
    const prevDmLevel = this.gs.dmLevel;
    const prevSlots = getUnlockedSlots(prevDmLevel);

    const settlement = this.applyGameStateResult(
      applyBattleReturnSettlement(this.gs, result),
    );
    const didLevelUp = settlement.didLevelUp;
    const battleReturnGrowth = {
      previousDmLevel: prevDmLevel,
      nextDmLevel: this.gs.dmLevel,
      previousSlots: prevSlots,
      nextSlots: getUnlockedSlots(this.gs.dmLevel),
      questCompletionPending: !!settlement.defendUpdate?.questDone,
      materialsEarned: result.materialsEarned,
    };
    if (settlement.changed) this.refreshHomeDynamicPanels();

    // Animate changed currency displays
    const newVals = [this.gs.homeGold, this.gs.soulCrystals, this.gs.gems];
    const oldVals = [prevGold, prevCrystal, prevGems];
    newVals.forEach((nv, i) => {
      const t = this.currencyTexts[i];
      if (!t || !t.active) return;
      t.setText(nv.toLocaleString('ko-KR'));
      if (nv !== oldVals[i]) {
        t.setColor('#ffee44');
        this.tweens.add({
          targets: t, scaleX: 1.4, scaleY: 1.4, duration: 130, ease: 'Back.easeOut',
          onComplete: () => this.tweens.add({
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
          this.time.delayedCall(200, () => showDmLevelUpOverlay(this, this.gs.dmLevel, {
            primaryLabel: slotUnlocked ? '새 방 설계' : '확인',
            onDismiss: slotUnlocked
              ? () => this.revealUnlockedRoom(
                  battleReturnGrowth.previousSlots,
                  battleReturnGrowth.nextSlots,
                )
              : undefined,
          }));
        } else if (update?.questDone) {
          const done = this.advanceCompletedQuest();
          if (done) this.handleQuestComplete(done);
        }
      };
      if (update?.questDone && !didLevelUp) {
        const done = this.advanceCompletedQuest();
        this.time.delayedCall(400, () => {
          showBattleReturnOverlay(this, result, () => {
            if (done) this.handleQuestComplete(done);
          }, battleReturnGrowth);
        });
      } else {
        this.time.delayedCall(400, () => showBattleReturnOverlay(this, result, afterReturn, battleReturnGrowth));
      }
    } else {
      this.time.delayedCall(400, () => showBattleDefeatOverlay(
        this,
        () => showInvasionBanner(
          this, this.invasionState,
          () => goToPreBattle(this, this.gs, this.invasionState),
        ),
      ));
    }
  }

  private revealUnlockedRoom(previousSlots: number, nextSlots: number): void {
    if (nextSlots <= previousSlots) return;
    const slotIdx = previousSlots;
    if (slotIdx < 0 || slotIdx >= getUnlockedSlots(this.gs.dmLevel)) return;

    this.pendingRoomFeedback = {
      kind: 'unlock',
      slotIdx,
      title: '새 방 해금',
      body: `방 #${slotIdx + 1} 설계 가능`,
      statLabel: '방',
      statBefore: String(previousSlots),
      statAfter: String(nextSlots),
      accent: 0x55b88a,
    };
    this.recentlyChangedRoomIdx = slotIdx;
    this.refreshHomeDynamicPanels();

    this.time.delayedCall(420, () => {
      if (!this.scene.isActive('DungeonHomeScene')) return;
      const overlayOpen = !!this.roomDetailState.roomDetailContainer
        || !!this.roomDetailState.monsterPickerContainer
        || !!this.roomDetailState.trapPickerContainer;
      if (overlayOpen) return;
      this.openDungeonSlot(slotIdx);
    });
  }

  // ─── Quest completion handling ────────────────────────────────────────────────

  private advanceCompletedQuest(): HomeMainQuestCompletionResult | null {
    const result = this.applyGameStateResult(settleCompletedHomeMainQuest(this.gs));
    return result.completion ? result : null;
  }

  private handleQuestComplete(result: HomeMainQuestCompletionResult): void {
    const completion = result.completion;
    if (!completion) return;

    if (result.pendingUnlock) this.registry.set('pendingUnlock', result.pendingUnlock);
    if (result.chapterCompleted) this.registry.set('chapterComplete', true);

    result.unlockedBlueprintIds.forEach(bp => logger.debug(`[FORGE] Blueprint unlocked: ${bp}`));
    if (result.awakeningStonesAwarded > 0) {
      logger.debug(`[AWAKEN] +${result.awakeningStonesAwarded} awakening stone (total: ${this.gs.awakeningStones})`);
    }

    if (result.gameCompleted) {
      showGameCompleteOverlay(this, completion.completedQuest);
    } else {
      showQuestCompleteOverlay(this, completion.completedQuest);
    }
  }

  // ─── Direct-placement board: select a room → bottom tray ─────────────────────

  /** @internal */ selectRoomForPlacement(slotIdx: number): void {
    if (this.roomFocusTransitionActive) return;
    this.selectedRoomIdx = slotIdx;
    this.rebuildDungeonSlots();
    openPlacementTray({
      scene: this,
      getGameState: () => this.gs,
      persist: (state) => this.persistGameState(state),
      rebuildSlots: () => this.rebuildDungeonSlots(),
      openDetail: (idx) => {
        this.selectedRoomIdx = null;
        this.rebuildDungeonSlots();
        this.openDungeonSlot(idx);
      },
      onClose: () => {
        this.selectedRoomIdx = null;
        this.rebuildDungeonSlots();
      },
    }, slotIdx);
  }

  // ─── Room Detail Overlay (delegated to RoomDetailOverlay.ts) ─────────────────

  private openRoomDetail(slotIdx: number, cellX: number, cellY: number): void {
    if (this.roomFocusTransitionActive) return;

    const openOverlay = () => {
      openRoomDetailOverlay(
        this, this.roomDetailState, this.theme, this.roomDetailCallbacks,
        slotIdx, cellX, cellY,
      );
    };

    if (getReducedMotion()) {
      openOverlay();
      return;
    }

    this.playRoomFocusTransition(slotIdx, cellX, cellY, openOverlay);
  }

  private playRoomFocusTransition(
    slotIdx: number,
    cellX: number,
    cellY: number,
    onFocusComplete: () => void,
  ): void {
    this.roomFocusTransitionActive = true;
    const accent = this.getRoomFocusAccent(slotIdx);
    const startX = cellX + SLOT_W / 2;
    const startY = cellY + SLOT_H / 2;
    const targetX = CANVAS_WIDTH / 2;
    const targetY = GRID_START_Y + 146;

    const layer = this.add.container(0, 0).setDepth(92).setAlpha(0);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.46);
    dim.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);
    layer.add(dim);

    const beam = this.add.graphics();
    beam.fillStyle(accent, 0.08);
    beam.beginPath();
    beam.moveTo(startX - 38, startY - 34);
    beam.lineTo(startX + 38, startY - 34);
    beam.lineTo(targetX + 112, targetY + 96);
    beam.lineTo(targetX - 112, targetY + 96);
    beam.closePath();
    beam.fillPath();
    beam.lineStyle(1, accent, 0.22);
    beam.lineBetween(startX - 40, startY - 34, targetX - 112, targetY + 96);
    beam.lineBetween(startX + 40, startY - 34, targetX + 112, targetY + 96);
    layer.add(beam);

    const focus = this.add.container(startX, startY);
    const focusG = this.add.graphics();
    focus.add(focusG);
    _drawBattleSlot(this.makeRoomSlotCtx(), focus, focusG, -SLOT_W / 2, -SLOT_H / 2, slotIdx, true);

    const ring = this.add.graphics();
    ring.lineStyle(3, accent, 0.82);
    ring.strokeRoundedRect(-SLOT_W / 2 - 6, -SLOT_H / 2 - 6, SLOT_W + 12, SLOT_H + 12, 14);
    ring.lineStyle(1, 0xffffff, 0.28);
    ring.strokeRoundedRect(-SLOT_W / 2 + 5, -SLOT_H / 2 + 5, SLOT_W - 10, SLOT_H - 10, 10);
    ring.fillStyle(accent, 0.14);
    ring.fillRoundedRect(-42, -SLOT_H / 2 - 26, 84, 19, 7);
    focus.add(ring);

    const label = this.add.text(0, -SLOT_H / 2 - 16, `방 #${slotIdx + 1} 확대`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#f0e6c8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    focus.add(label);
    layer.add(focus);

    this.tweens.add({
      targets: layer,
      alpha: 1,
      duration: 90,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: focus,
      x: targetX,
      y: targetY,
      scaleX: 2.08,
      scaleY: 2.08,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        onFocusComplete();
        this.tweens.add({
          targets: layer,
          alpha: 0,
          duration: 120,
          ease: 'Quad.easeOut',
          onComplete: () => {
            layer.destroy(true);
            this.roomFocusTransitionActive = false;
          },
        });
      },
    });
  }

  private getRoomFocusAccent(slotIdx: number): number {
    const slot = this.gs.dungeonSlots?.[slotIdx];
    if (slot?.roomType && slot.hp <= 0) return 0xff5544;
    if (slot?.roomType) return this.getRoomActivityColor(slot);
    return 0x55b88a;
  }

  // ─── Stone background ────────────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    // Bright warm vertical gradient (casual storybook backdrop)
    bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Soft sun glow up top
    bg.fillStyle(0xfff7e4, 0.5);
    bg.fillEllipse(CANVAS_WIDTH / 2, 30, CANVAS_WIDTH * 1.5, 240);
    // Playful polka dots
    bg.fillStyle(CASUAL.BG_DOT, 0.16);
    for (let row = 0, y = 70; y < CANVAS_HEIGHT; y += 60, row++) {
      for (let x = (row % 2) * 30 + 16; x < CANVAS_WIDTH; x += 60) bg.fillCircle(x, y, 3.5);
    }
  }

  // ─── Dungeon grid ────────────────────────────────────────────────────────────

  private buildDungeonGrid(): void {
    const bg = this.add.graphics().setDepth(1);
    // Warm light dungeon board surface (matches the casual battlefield floor).
    bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
    bg.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);

    const gridCaveY = GRID_START_Y - 8;
    const gridCaveH = GRID_ROWS_HOME * SLOT_H + (GRID_ROWS_HOME - 1) * SLOT_PAD_Y + 16;
    // Soft floor-tile texture under the play area.
    bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.1);
    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      const tunnelY = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2 - 5;
      bg.lineBetween(24, tunnelY + 5, CANVAS_WIDTH - 24, tunnelY + 5);
    }

    const lowerCavernY = gridCaveY + gridCaveH - 5;
    const lowerCavernH = Math.max(70, BOT_Y - lowerCavernY - 24);
    // Lower floor band — slightly deeper warm tone with a soft top seam.
    bg.fillStyle(CASUAL.BG_BOTTOM, 0.5);
    bg.fillRect(0, lowerCavernY, CANVAS_WIDTH, lowerCavernH);
    bg.fillStyle(0xffffff, 0.18);
    bg.fillRect(0, lowerCavernY, CANVAS_WIDTH, 2);
    bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.12);
    bg.lineBetween(16, lowerCavernY + lowerCavernH - 18, CANVAS_WIDTH - 16, lowerCavernY + lowerCavernH - 24);
    // Soft polka dots to match the global casual backdrop.
    bg.fillStyle(CASUAL.BG_DOT, 0.14);
    for (let r = 0, y = lowerCavernY + 18; y < lowerCavernY + lowerCavernH - 8; y += 30, r++) {
      for (let x = (r % 2) * 26 + 22; x < CANVAS_WIDTH - 12; x += 52) bg.fillCircle(x, y, 3);
    }

    if (BLUEPRINT_H > 0) {
      this.rebuildDungeonBlueprintPanel();

      // Simulation button
      const simBtnX = CANVAS_WIDTH - 66, simBtnY = BLUEPRINT_Y + 8;
      const simBg = this.add.graphics().setDepth(5);
      simBg.fillStyle(CASUAL.EDGE, 1);
      simBg.fillRoundedRect(simBtnX, simBtnY + 2, 56, 24, 12);
      simBg.fillStyle(CASUAL.PANEL, 1);
      simBg.fillRoundedRect(simBtnX, simBtnY, 56, 23, 12);
      simBg.fillStyle(0xffffff, 0.12);
      simBg.fillRoundedRect(simBtnX + 4, simBtnY + 3, 48, 5, 3);
      const simTxt = this.add.text(simBtnX + 28, simBtnY + 11, '⚗ 예측', {
        fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(6).setInteractive();
      simTxt.on('pointerdown', () => openSimulationModal(this, this.gs, this.theme));
    }

    this.rebuildDungeonSlots();
  }

  private rebuildDungeonBlueprintPanel(): void {
    if (this.dungeonBlueprintContainer) this.dungeonBlueprintContainer.destroy();
    if (BLUEPRINT_H <= 0) {
      this.dungeonBlueprintContainer = null;
      return;
    }
    this.dungeonBlueprintContainer = buildDungeonBlueprintPanel(this, this.gs, this.theme, {
      x: 10,
      y: BLUEPRINT_Y,
      w: CANVAS_WIDTH - 86,
      h: BLUEPRINT_H,
    });
  }

  private rebuildDungeonSlots(): void { _rebuildDungeonSlots(this); }

  /** @internal */ addRoomOpenAffordance(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    slotIdx: number,
  ): { setHover: (hover: boolean) => void; pulse: () => void } {
    const accent = this.getRoomFocusAccent(slotIdx);
    const base = this.add.graphics();
    const hover = this.add.graphics().setVisible(false);
    const pulse = this.add.graphics().setVisible(false);
    const corner = 10;
    const inset = 6;
    // Use the actual cell dimensions from the layout (may differ from SLOT_W/H in vertical-cutaway).
    const cellW = this.boardLayout.slotW;
    const cellH = this.boardLayout.slotH;

    const drawCorners = (
      graphics: Phaser.GameObjects.Graphics,
      alpha: number,
      weight: number,
      expand = 0,
    ): void => {
      const left = x + inset - expand;
      const top = y + inset - expand;
      const right = x + cellW - inset + expand;
      const bottom = y + cellH - inset + expand;
      const len = corner + expand * 0.5;

      graphics.clear();
      graphics.lineStyle(weight, accent, alpha);
      graphics.lineBetween(left, top + len, left, top);
      graphics.lineBetween(left, top, left + len, top);
      graphics.lineBetween(right - len, top, right, top);
      graphics.lineBetween(right, top, right, top + len);
      graphics.lineBetween(left, bottom - len, left, bottom);
      graphics.lineBetween(left, bottom, left + len, bottom);
      graphics.lineBetween(right - len, bottom, right, bottom);
      graphics.lineBetween(right, bottom - len, right, bottom);
    };

    drawCorners(base, 0.22, 1);
    drawCorners(hover, 0.86, 1.6, 2);
    c.add([base, hover, pulse]);

    return {
      setHover: (isHover: boolean): void => {
        hover.setVisible(isHover);
        base.setAlpha(isHover ? 0.35 : 1);
      },
      pulse: (): void => {
        drawCorners(pulse, 0.92, 2, 3);
        pulse.setVisible(true).setAlpha(1);
        this.tweens.killTweensOf(pulse);
        this.tweens.add({
          targets: pulse,
          alpha: 0,
          duration: 220,
          ease: 'Quad.easeOut',
          onComplete: () => pulse.setVisible(false),
        });
      },
    };
  }

  /** @internal */ addPrimaryRoomActionPin(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const route = this.getUnlockedRoute(unlockedCount);
    const pin = route
      .map(idx => this.getRoomActionPin(idx))
      .find((candidate): candidate is HomeRoomActionPin => Boolean(candidate));
    if (!pin) return;
    const rankedSlots = new Set(
      getDungeonActionQueue(this.gs, unlockedCount)
        .slice(0, 3)
        .map(action => action.slotIdx),
    );
    if (rankedSlots.has(pin.slotIdx)) return;

    const pinCell = this.boardLayout.cellsByIdx.get(pin.slotIdx);
    const x = (pinCell?.rect.x ?? 0) + this.boardLayout.slotW - 17;
    const y = (pinCell?.rect.y ?? 0) + 29;
    const pinContainer = this.add.container(x, y);
    const g = this.add.graphics();

    g.fillStyle(0x0b0703, 0.92);
    g.fillCircle(0, 0, 14);
    g.lineStyle(1.2, pin.accent, 0.76);
    g.strokeCircle(0, 0, 14);
    g.fillStyle(pin.accent, 0.22);
    g.fillCircle(0, 0, 8);
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(-4, -5, 2.2);
    g.fillTriangle(10, 0, 4, -4, 4, 4);
    pinContainer.add(g);

    const text = this.add.text(-1, 0, pin.icon, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#f0e6c8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    pinContainer.add(text);
    const zone = this.add.zone(0, 0, 34, 34)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      this.selectRoomForPlacement(pin.slotIdx);
    });
    pinContainer.add(zone);
    c.add(pinContainer);

    if (getReducedMotion()) return;
    this.tweens.add({
      targets: pinContainer,
      y: y - 3,
      alpha: { from: 0.86, to: 1 },
      duration: 740,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private getRoomActionPin(slotIdx: number): HomeRoomActionPin | null {
    return _getRoomActionPin(this, slotIdx);
  }

  /** @internal */ addActionQueueRankMarkers(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const actions = getDungeonActionQueue(this.gs, unlockedCount).slice(0, 3);
    if (actions.length === 0) return;

    const reducedMotion = getReducedMotion();
    actions.forEach((action, i) => {
      const aqCell = this.boardLayout.cellsByIdx.get(action.slotIdx);
      const x = aqCell?.center.x ?? 0;
      const y = (aqCell?.rect.y ?? 0) + 10;
      const rank = i + 1;
      this.addActionQueueRoomSpotlight(c, action, rank, x, y + this.boardLayout.slotH / 2 - 10, reducedMotion);
      const markerW = 42;
      const marker = this.add.container(x, y).setDepth(14);
      const bg = this.add.graphics();

      bg.fillStyle(0x070503, 0.94);
      bg.fillRoundedRect(-markerW / 2, -10, markerW, 20, 8);
      bg.lineStyle(1.2, action.accent, 0.86);
      bg.strokeRoundedRect(-markerW / 2, -10, markerW, 20, 8);
      bg.fillStyle(action.accent, 0.22);
      bg.fillRoundedRect(-markerW / 2 + 4, -6, markerW - 8, 12, 6);
      bg.fillStyle(0x0b0703, 0.92);
      bg.fillCircle(-markerW / 2 + 11, 0, 9);
      bg.lineStyle(1, action.accent, 0.76);
      bg.strokeCircle(-markerW / 2 + 11, 0, 9);
      bg.fillStyle(0xffffff, 0.18);
      bg.fillCircle(-markerW / 2 + 8, -3, 2);
      marker.add(bg);

      marker.add(this.add.text(-markerW / 2 + 11, 0, String(rank), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#fff6d6',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      marker.add(this.add.text(8, 0, action.icon, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#fff6d6',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      const zone = this.add.zone(0, 0, markerW + 16, 30)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => marker.setScale(1.06));
      zone.on('pointerout', () => marker.setScale(1));
      zone.on('pointerdown', () => {
        audioManager.playSfx('button_click');
        this.selectRoomForPlacement(action.slotIdx);
      });
      marker.add(zone);
      c.add(marker);

      if (reducedMotion) return;
      this.tweens.add({
        targets: marker,
        y: y - 2,
        alpha: { from: 0.88, to: 1 },
        duration: 680 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private addActionQueueRoomSpotlight(
    c: Phaser.GameObjects.Container,
    action: RoomActionRecommendation,
    rank: number,
    x: number,
    y: number,
    reducedMotion: boolean,
  ): void {
    const spotlight = this.add.container(x, y).setDepth(13);
    const g = this.add.graphics();
    const ringW = this.boardLayout.slotW + 12 - Math.min(rank, 3) * 2;
    const ringH = this.boardLayout.slotH + 10 - Math.min(rank, 3) * 2;
    const left = -ringW / 2;
    const top = -ringH / 2;
    const alpha = rank === 1 ? 0.80 : rank === 2 ? 0.56 : 0.42;

    g.fillStyle(action.accent, rank === 1 ? 0.10 : 0.055);
    g.fillRoundedRect(left, top, ringW, ringH, 13);
    g.lineStyle(rank === 1 ? 2.2 : 1.4, action.accent, alpha);
    g.strokeRoundedRect(left, top, ringW, ringH, 13);
    g.lineStyle(1, 0xffffff, rank === 1 ? 0.18 : 0.10);
    g.strokeRoundedRect(left + 5, top + 5, ringW - 10, ringH - 10, 10);

    g.fillStyle(0x070503, 0.72);
    g.fillCircle(left + 18, top + 18, 7);
    g.lineStyle(1, action.accent, 0.54);
    g.strokeCircle(left + 18, top + 18, 7);
    g.fillStyle(action.accent, 0.34);
    g.fillCircle(left + 18, top + 18, 3);
    spotlight.add(g);

    c.add(spotlight);
    if (reducedMotion || rank !== 1) return;
    this.tweens.add({
      targets: spotlight,
      scaleX: 1.04,
      scaleY: 1.04,
      alpha: { from: 0.82, to: 1 },
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** @internal */ addRoomMaintenanceBadges(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const queue = getDungeonActionQueue(this.gs, unlockedCount);
    const spotlightedSlots = new Set(queue.slice(0, 3).map(action => action.slotIdx));
    const primaryPin = this.getUnlockedRoute(unlockedCount)
      .map(idx => this.getRoomActionPin(idx))
      .find((candidate): candidate is HomeRoomActionPin => Boolean(candidate));
    const maintenanceActions = queue
      .filter(action =>
        action.kind === 'growth'
        && !spotlightedSlots.has(action.slotIdx)
        && action.slotIdx !== primaryPin?.slotIdx,
      )
      .slice(0, 3);
    if (maintenanceActions.length === 0) return;

    const reducedMotion = getReducedMotion();
    maintenanceActions.forEach(action => {
      const mbCell = this.boardLayout.cellsByIdx.get(action.slotIdx);
      const x = mbCell?.center.x ?? 0;
      const y = (mbCell?.rect.y ?? 0) + this.boardLayout.slotH - 15;
      const label = `${action.icon} ${action.label}`;
      const badgeW = Math.max(54, 38 + action.label.length * 10);
      const badge = this.add.container(x, y).setDepth(15);
      const bg = this.add.graphics();

      bg.fillStyle(0x040708, 0.94);
      bg.fillRoundedRect(-badgeW / 2, -13, badgeW, 26, 8);
      bg.lineStyle(1.2, action.accent, 0.78);
      bg.strokeRoundedRect(-badgeW / 2, -13, badgeW, 26, 8);
      bg.fillStyle(action.accent, 0.20);
      bg.fillRoundedRect(-badgeW / 2 + 4, -9, badgeW - 8, 18, 6);
      badge.add(bg);

      const labelText = this.add.text(0, -4, label, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#fff5dc',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const statText = this.add.text(0, 7, action.statValue, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#b8fff0',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const zone = this.add.zone(0, 0, badgeW + 8, 32)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => badge.setScale(1.06));
      zone.on('pointerout', () => badge.setScale(1));
      zone.on('pointerdown', () => {
        audioManager.playSfx('button_click');
        this.selectRoomForPlacement(action.slotIdx);
      });
      badge.add([labelText, statText, zone]);
      c.add(badge);

      if (reducedMotion) return;
      this.tweens.add({
        targets: badge,
        alpha: { from: 0.82, to: 1 },
        y: y - 2,
        duration: 780,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /** @internal */ addDungeonActivityLayer(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    for (let idx = 0; idx < unlockedCount; idx++) {
      const slot = this.gs.dungeonSlots?.[idx];
      if (!slot?.roomType) continue;

      const actCell = this.boardLayout.cellsByIdx.get(idx);
      const cx = actCell?.center.x ?? 0;
      const cy = actCell?.center.y ?? 0;
      _addRoomActivityAura(this, c, cx, cy, slot, idx);
    }
  }

  /** @internal */ drawDungeonRoomAlcoves(
    g: Phaser.GameObjects.Graphics,
    _unlockedCount: number,
  ): void {
    for (const [idx, alcCell] of this.boardLayout.cellsByIdx) {
      _drawDungeonRoomAlcove(this, g, alcCell.rect.x, alcCell.rect.y, idx, alcCell.isUnlocked);
    }
  }

  /** @internal */ getRoomActivityColor(slot: DungeonSlot): number {
    return _getRoomActivityColor(this, slot);
  }



  /** @internal */ drawDungeonMapBackdrop(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    _unlockedCount: number,
  ): void { _drawDungeonMapBackdrop(this, c, g, _unlockedCount); }

  /** @internal */ drawDungeonRouteNetwork(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    unlockedCount: number,
  ): void { _drawDungeonRouteNetwork(this, c, g, unlockedCount); }

  getUnlockedRoute(_unlockedCount: number): readonly number[] {
    return _getUnlockedRoute(this, _unlockedCount);
  }

  /** @internal */ addDungeonRouteFlow(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addDungeonRouteFlow(this, c, unlockedCount); }

  // ─── Slot helpers ─────────────────────────────────────────────────────────────

  private makeRoomSlotCtx(): RoomSlotContext {
    return _makeRoomSlotCtx(this);
  }

  // ─── Command deck ────────────────────────────────────────────────────────────

  private buildCommandDeck(): void {
    if (this.commandDeckContainer) {
      this.commandDeckContainer.destroy();
      this.commandDeckContainer = null;
    }
    const deckX = 12;
    const minDeckY = this.boardLayout.contentBottomY + 8;
    const deckW = CANVAS_WIDTH - deckX * 2;
    const statsTopY = BOT_Y - 26;
    const availableDeckH = statsTopY - minDeckY - 10;
    // Phase C: slim deck — target ~155px, was 218
    const deckH = Math.min(160, availableDeckH);
    const deckY = Math.max(minDeckY, statsTopY - deckH - 10);
    if (deckH < 140) return;
    const deck = this.add.container(0, 0).setDepth(4);
    this.commandDeckContainer = deck;

    const unlockedSlots = getUnlockedSlots(this.gs.dmLevel);
    const visibleSlots = (this.gs.dungeonSlots ?? []).slice(0, unlockedSlots);
    const builtRooms = visibleSlots.filter(slot => !!slot?.roomType).length;
    const ownedMonsters = this.gs.ownedMonsters ?? [];
    const skillReady = ownedMonsters.filter(m => (m.skillPoints ?? 0) > 0).length;
    const collectionSummary = this.getMonsterCollectionSummary(ownedMonsters);
    const dungeonMetrics = calculateDungeonMetrics(this.gs, unlockedSlots);
    // Keep getDungeonActionQueue for board rank markers; not rendered in deck.
    const _actionQueue = getDungeonActionQueue(this.gs, unlockedSlots);
    const directive = this.getHomeDirective(
      unlockedSlots,
      visibleSlots,
      dungeonMetrics.readiness,
      skillReady,
    );
    const frame = addFramedPanel(this, {
      x: deckX,
      y: deckY,
      w: deckW,
      h: deckH,
      radius: 16,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: CASUAL.EDGE_SOFT,
      accentAlpha: 0.5,
      glowColor: CASUAL.EDGE_SOFT,
      glowOpacity: 0.06,
      shadowOpacity: 0.4,
      shadowOffsetY: 4,
    });
    deck.add([frame.shadow, frame.panel, frame.glow]);

    const g = this.add.graphics();
    deck.add(g);

    // ── Header strip (deckY+8 … +28) ──────────────────────────────────────────
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 26, 10);
    g.fillStyle(CASUAL.GOLD, 0.14);
    g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 26, 10);

    deck.add(this.add.text(deckX + 16, deckY + 21, '던전 운영실', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // Compact 도감 pill (right of header) — replaces full chip
    this.drawHomeCollectionPill(deck, g, deckX + deckW - 92, deckY + 11, 80, 18, collectionSummary);

    // ── Readiness inline line (deckY+36 … +54) ────────────────────────────────
    const readinessColor = dungeonMetrics.readiness >= 80
      ? CASUAL.GREEN : dungeonMetrics.readiness >= 55 ? CASUAL.GOLD : CASUAL.RED;
    const readinessCss = dungeonMetrics.readiness >= 80
      ? CASUAL_CSS.GREEN : dungeonMetrics.readiness >= 55 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;
    const readinessPct = Phaser.Math.Clamp(dungeonMetrics.readiness / 100, 0, 1);

    const barLineY = deckY + 37;
    const barLineX = deckX + 14;
    const barLineW = deckW - 28;
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(barLineX, barLineY, barLineW, 14, 5);
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.4);
    g.strokeRoundedRect(barLineX, barLineY, barLineW, 14, 5);
    const fillW = Math.max(8, barLineW * readinessPct);
    g.fillStyle(readinessColor, 0.28);
    g.fillRoundedRect(barLineX, barLineY, fillW, 14, 5);

    deck.add(this.add.text(barLineX + 6, barLineY + 7, '운영도', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(barLineX + 42, barLineY + 7, `${dungeonMetrics.readiness}%`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: readinessCss,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(barLineX + barLineW - 6, barLineY + 7, `방 ${builtRooms}/${unlockedSlots}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    // ── Divider ────────────────────────────────────────────────────────────────
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.35);
    g.lineBetween(deckX + 14, deckY + 55, deckX + deckW - 14, deckY + 55);

    // ── Directive card — hero element (deckY+58 … +100) ───────────────────────
    const directiveY = deckY + 58;
    this.drawHomeDirectiveCard(deck, deckX + 14, directiveY, deckW - 28, 40, directive);

    // ── Primary CTA (deckY+102 … +130) ────────────────────────────────────────
    const ctaY = directiveY + 44;
    const ctaH = 26;
    const { bg: ctaBg, text: ctaText, zone: ctaZone } = addPrimaryActionButton(this, {
      x: deckX + 14,
      y: ctaY,
      w: deckW - 28,
      h: ctaH,
      label: directive.ctaLabel,
      fontSize: '12px',
      fillColor: directive.accent,
      hoverFillColor: directive.accent,
      borderColor: directive.accent,
      hoverBorderColor: directive.accent,
      onPress: () => directive.onPress(),
    });
    deck.add([ctaBg, ctaText, ctaZone]);

    // ── Divider ────────────────────────────────────────────────────────────────
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.35);
    g.lineBetween(deckX + 14, ctaY + ctaH + 4, deckX + deckW - 14, ctaY + ctaH + 4);

    // ── Secondary chip row (deckY+135 … +157): 방확대 · 몬스터성장 · 장비제작 ──
    const chipRowY = ctaY + ctaH + 8;
    const chipRowH = 20;
    const chipGap = 6;
    const chipW = (deckW - 28 - chipGap * 2) / 3;
    const secondaryChips: Array<{ label: string; icon: string; onPress: () => void }> = [
      { label: '방 확대', icon: '▣', onPress: () => this.openFirstDungeonSlot() },
      { label: '몬스터 성장', icon: '👹', onPress: () => this.openFocusedMonsterGrowth() },
      { label: '장비 제작', icon: '⚒', onPress: () => this.openFocusedForge() },
    ];
    secondaryChips.forEach((chip, i) => {
      const chipX = deckX + 14 + i * (chipW + chipGap);
      const chipBg = this.add.graphics();
      deck.add(chipBg);
      const drawChip = (hover = false): void => {
        chipBg.clear();
        chipBg.fillStyle(CASUAL.SHADOW, hover ? 0.28 : 0.18);
        chipBg.fillRoundedRect(chipX, chipRowY + 2, chipW, chipRowH, 5);
        chipBg.fillStyle(hover ? CASUAL.PANEL_SOFT : CASUAL.PANEL, 1);
        chipBg.fillRoundedRect(chipX, chipRowY, chipW, chipRowH, 5);
        chipBg.lineStyle(hover ? 2 : 1.5, CASUAL.EDGE_SOFT, hover ? 0.9 : 0.6);
        chipBg.strokeRoundedRect(chipX, chipRowY, chipW, chipRowH, 5);
        chipBg.fillStyle(0xffffff, hover ? 0.2 : 0.1);
        chipBg.fillRoundedRect(chipX + 3, chipRowY + 2, chipW - 6, 3, 2);
      };
      drawChip(false);
      const iconT = this.add.text(chipX + 10, chipRowY + chipRowH / 2, chip.icon, {
        fontFamily: 'sans-serif', fontSize: '9px',
      }).setOrigin(0.5);
      const labelT = this.add.text(chipX + chipW / 2 + 4, chipRowY + chipRowH / 2, chip.label, {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const zone = this.add.zone(chipX, chipRowY, chipW, chipRowH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      deck.add([iconT, labelT, zone]);
      zone.on('pointerover', () => {
        drawChip(true);
        labelT.setColor(CASUAL_CSS.INK);
      });
      zone.on('pointerout', () => {
        drawChip(false);
        labelT.setColor(CASUAL_CSS.INK_SOFT);
        iconT.setScale(1);
        labelT.setScale(1);
      });
      zone.on('pointerdown', () => {
        this.tweens.add({ targets: [iconT, labelT], scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 80 });
        audioManager.playSfx('button_click');
        chip.onPress();
      });
    });

    // Suppress unused-variable warning — getDungeonActionQueue kept for board use.
    void _actionQueue;
  }

  private getMonsterCollectionSummary(
    ownedMonsters: readonly OwnedMonster[],
  ): { owned: number; total: number; rareOwned: number; percent: number } {
    const ownedTypes = new Set<string>();
    for (const monster of ownedMonsters) {
      const typeId = Object.keys(MONSTER_DEFS).find(
        id => monster.id === id || monster.id.startsWith(`${id}_`),
      );
      if (typeId) ownedTypes.add(typeId);
    }
    const defs = Object.values(MONSTER_DEFS);
    const rareOwned = Array.from(ownedTypes).filter(id => {
      const rarity = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.rarityTier;
      return rarity === 'E' || rarity === 'L';
    }).length;
    const total = defs.length;
    return {
      owned: ownedTypes.size,
      total,
      rareOwned,
      percent: total > 0 ? ownedTypes.size / total : 0,
    };
  }

  private drawHomeCollectionPill(
    deck: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    summary: { owned: number; total: number; rareOwned: number; percent: number },
  ): void {
    const PINK = 0xe85fc0;
    const PINK_CSS = '#e06ab0';
    g.fillStyle(CASUAL.SHADOW, 0.18);
    g.fillRoundedRect(x, y + 1, w, h, 6);
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, PINK, 0.75);
    g.strokeRoundedRect(x, y, w, h, 6);
    g.fillStyle(PINK, 0.85);
    g.fillCircle(x + 9, y + h / 2, 5);
    deck.add(this.add.text(x + 9, y + h / 2, '★', {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    deck.add(this.add.text(x + 17, y + h / 2, `도감 ${summary.owned}/${summary.total}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: PINK_CSS,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + w - 4, y + h / 2, `★${summary.rareOwned}`, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
    // Make the pill interactive → open Codex
    const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    deck.add(zone);
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      this.navigateFromHome('CodexScene');
    });
  }

  private getHomeDirective(
    unlockedSlots: number,
    visibleSlots: readonly (DungeonSlot | undefined)[],
    dungeonReadiness: number,
    skillReady: number,
  ): HomeDirective {
    const entries = Array.from({ length: unlockedSlots }, (_, idx) => ({
      idx,
      slot: visibleSlots[idx],
    }));
    const roomName = (idx: number): string => `방 #${idx + 1}`;
    const buildHomeDirective = (
      copy: ReturnType<typeof getReadinessDirectiveCopy>,
      statValue: string,
      onPress: () => void,
    ): HomeDirective => ({
      icon: copy.icon,
      title: copy.title,
      body: copy.body,
      ctaLabel: copy.ctaLabel,
      statLabel: copy.statLabel,
      statValue,
      accent: copy.accent,
      onPress,
    });
    const buildRoomActionDirective = (
      slotIdx: number,
      onPress: () => void,
    ): HomeDirective => {
      const action = getRoomActionRecommendation(this.gs, slotIdx);
      return {
        icon: action.icon,
        title: action.title,
        body: action.body,
        ctaLabel: action.ctaLabel,
        statLabel: action.statLabel,
        statValue: action.statValue,
        accent: action.accent,
        onPress,
      };
    };

    const broken = entries.find(({ slot }) => !!slot?.roomType && slot.hp <= 0);
    if (broken) {
      return buildRoomActionDirective(broken.idx, () => this.selectRoomForPlacement(broken.idx));
    }

    const monsterGap = entries.find(({ slot }) => {
      if (!slot?.roomType) return false;
      const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      return (slot.monsterIds ?? []).filter(Boolean).length < cap.monsters;
    });
    if (monsterGap?.slot) {
      return buildRoomActionDirective(monsterGap.idx, () => this.selectRoomForPlacement(monsterGap.idx));
    }

    const trapGap = entries.find(({ slot }) => {
      if (!slot?.roomType) return false;
      const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      return (slot.trapIds ?? []).filter(Boolean).length < cap.traps;
    });
    if (trapGap?.slot) {
      return buildRoomActionDirective(trapGap.idx, () => this.selectRoomForPlacement(trapGap.idx));
    }

    const empty = entries.find(({ slot }) => !slot?.roomType);
    if (empty) {
      return buildRoomActionDirective(empty.idx, () => this.selectRoomForPlacement(empty.idx));
    }

    if (skillReady > 0) {
      return buildHomeDirective(
        getReadinessDirectiveCopy('grow-monster', { skillReady }),
        `${skillReady}`,
        () => this.navigateFromHome('BarracksScene'),
      );
    }

    const weakestRoom = entries
      .filter((entry): entry is { idx: number; slot: DungeonSlot } => !!entry.slot?.roomType)
      .map(entry => ({
        idx: entry.idx,
        slot: entry.slot,
        readiness: calculateRoomMetrics(this.gs, entry.slot).readiness,
      }))
      .sort((a, b) => a.readiness - b.readiness)[0];

    if (dungeonReadiness < 85 && weakestRoom) {
      return buildHomeDirective(
        getReadinessDirectiveCopy('forge-equipment', {
          roomLabel: roomName(weakestRoom.idx),
          readiness: weakestRoom.readiness,
        }),
        `${weakestRoom.readiness}%`,
        () => this.navigateFromHome('ForgeScene'),
      );
    }

    return buildHomeDirective(
      getReadinessDirectiveCopy('battle-ready', { readiness: dungeonReadiness }),
      `${dungeonReadiness}%`,
      () => goToPreBattle(this, this.gs, this.invasionState),
    );
  }

  private drawHomeDirectiveCard(
    deck: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    directive: HomeDirective,
  ): void {
    const accentCss = `#${directive.accent.toString(16).padStart(6, '0')}`;
    const bg = this.add.graphics();
    deck.add(bg);
    // Cream casual card, accent-bordered, with a candy accent icon cap.
    bg.fillStyle(CASUAL.SHADOW, 0.22);
    bg.fillRoundedRect(x, y + 2, w, h, 7);
    bg.fillStyle(CASUAL.PANEL, 1);
    bg.fillRoundedRect(x, y, w, h, 7);
    bg.lineStyle(2.5, directive.accent, 0.9);
    bg.strokeRoundedRect(x, y, w, h, 7);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(x + 5, y + 4, w - 10, 4, 2);
    bg.fillStyle(directive.accent, 0.95);
    bg.fillRoundedRect(x + 6, y + 6, 24, h - 12, 6);
    bg.fillStyle(0xffffff, 0.35);
    bg.fillRoundedRect(x + 8, y + 8, 20, 4, 2);

    deck.add(this.add.text(x + 18, y + h / 2, directive.icon, {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    deck.add(this.add.text(x + 38, y + 10, directive.title, {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: accentCss,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + 38, y + 24, directive.body, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: Math.max(120, w - 164), useAdvancedWrap: true },
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + w - 104, y + 10, directive.statLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    deck.add(this.add.text(x + w - 104, y + 24, directive.statValue, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: accentCss,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const ctaX = x + w - 78;
    const ctaY = y + 5;
    const ctaW = 70;
    const ctaH = h - 10;
    const ctaBg = this.add.graphics();
    deck.add(ctaBg);
    // Saturated candy pill — accent cap over the same accent base, white label.
    const drawCta = (hover = false): void => {
      ctaBg.clear();
      ctaBg.fillStyle(CASUAL.SHADOW, hover ? 0.3 : 0.22);
      ctaBg.fillRoundedRect(ctaX, ctaY + 2, ctaW, ctaH, 6);
      ctaBg.fillStyle(directive.accent, hover ? 1 : 0.92);
      ctaBg.fillRoundedRect(ctaX, ctaY, ctaW, ctaH, 6);
      ctaBg.fillStyle(0xffffff, hover ? 0.5 : 0.38);
      ctaBg.fillRoundedRect(ctaX + 5, ctaY + 4, ctaW - 10, 5, 3);
      ctaBg.lineStyle(1.5, directive.accent, 1);
      ctaBg.strokeRoundedRect(ctaX, ctaY, ctaW, ctaH, 6);
    };
    drawCta(false);

    const ctaText = this.add.text(ctaX + ctaW / 2, ctaY + ctaH / 2, directive.ctaLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = this.add.zone(ctaX, ctaY, ctaW, ctaH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    deck.add([ctaText, zone]);
    zone.on('pointerover', () => {
      drawCta(true);
    });
    zone.on('pointerout', () => {
      drawCta(false);
      ctaText.setScale(1);
    });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: ctaText, scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 80 });
      audioManager.playSfx('button_click');
      directive.onPress();
    });
  }

  private openFirstDungeonSlot(): void {
    const unlockedSlots = getUnlockedSlots(this.gs.dmLevel);
    const queuedAction = getDungeonActionQueue(this.gs, unlockedSlots)[0];
    if (queuedAction) {
      this.selectRoomForPlacement(queuedAction.slotIdx);
      return;
    }

    const slots = this.gs.dungeonSlots ?? [];
    let idx = 0;
    for (let i = 0; i < unlockedSlots; i++) {
      const slot = slots[i];
      const hasMonster = (slot?.monsterIds ?? []).some(Boolean);
      if (!slot?.roomType || !hasMonster || slot.hp <= 0) {
        idx = i;
        break;
      }
    }
    this.selectRoomForPlacement(idx);
  }

  private openFocusedMonsterGrowth(): void {
    const target = this.getFocusedMonsterGrowthTarget();

    if (target) {
      this.applyHomeFocusTarget(target);
    } else {
      this.clearHomeFocusTarget();
    }
    this.navigateFromHome('BarracksScene');
  }

  private openFocusedForge(): void {
    const target = this.getFocusedForgeTarget();

    if (target) {
      this.applyHomeFocusTarget(target);
    } else {
      this.clearHomeFocusTarget();
    }
    this.registry.set('forgeReturnScene', 'DungeonHomeScene');
    this.navigateFromHome('ForgeScene');
  }

  private getFocusedMonsterGrowthTarget(): HomeFocusTarget | null {
    return this.findQueuedGrowthTarget('level')
      ?? this.findQueuedGrowthTarget('readiness')
      ?? this.findSkillReadyMonsterTarget()
      ?? this.findLowestLevelMonsterTarget();
  }

  private getFocusedForgeTarget(): HomeFocusTarget | null {
    return this.findQueuedGrowthTarget('equipment')
      ?? this.findFirstUnequippedMonsterTarget();
  }

  private findQueuedGrowthTarget(kind: 'equipment' | 'level' | 'readiness'): HomeFocusTarget | null {
    const unlockedSlots = getUnlockedSlots(this.gs.dmLevel);
    const actions = getDungeonActionQueue(this.gs, unlockedSlots).filter(action => action.kind === 'growth');

    for (const action of actions) {
      if (kind === 'equipment' && action.statLabel !== 'E') continue;
      if (kind === 'level' && action.statLabel !== 'Lv') continue;
      if (kind === 'readiness' && action.statLabel === 'E') continue;

      const target = kind === 'equipment'
        ? this.findUnequippedRoomMonsterTarget(action.slotIdx)
        : this.findUnderleveledRoomMonsterTarget(action.slotIdx) ?? this.findFirstRoomMonsterTarget(action.slotIdx);
      if (target) return target;
    }

    return null;
  }

  private findUnequippedRoomMonsterTarget(slotIdx: number): HomeFocusTarget | null {
    const monster = this.findRoomMonster(slotIdx, owned => !owned.equipment);
    return monster ? this.buildRoomFocusTarget(slotIdx, monster.id) : null;
  }

  private findUnderleveledRoomMonsterTarget(slotIdx: number): HomeFocusTarget | null {
    const targetLevel = Math.max(2, this.gs.dmLevel - 1);
    const monster = this.findRoomMonster(slotIdx, owned => owned.level < targetLevel);
    return monster ? this.buildRoomFocusTarget(slotIdx, monster.id) : null;
  }

  private findFirstRoomMonsterTarget(slotIdx: number): HomeFocusTarget | null {
    const monster = this.findRoomMonster(slotIdx, () => true);
    return monster ? this.buildRoomFocusTarget(slotIdx, monster.id) : null;
  }

  private findRoomMonster(slotIdx: number, predicate: (monster: OwnedMonster) => boolean): OwnedMonster | null {
    const slot = this.gs.dungeonSlots?.[slotIdx];
    if (!slot) return null;

    for (const monsterId of slot.monsterIds ?? []) {
      if (!monsterId) continue;
      const owned = this.gs.ownedMonsters.find(monster => monster.id === monsterId);
      if (owned && predicate(owned)) return owned;
    }

    return null;
  }

  private findFirstUnequippedMonsterTarget(): HomeFocusTarget | null {
    const target = (this.gs.ownedMonsters ?? [])
      .find(monster => !monster.equipment);
    return target ? this.buildMonsterFocusTarget(target.id, '장비 지휘') : null;
  }

  private findSkillReadyMonsterTarget(): HomeFocusTarget | null {
    const target = [...(this.gs.ownedMonsters ?? [])]
      .filter(monster => (monster.skillPoints ?? 0) > 0)
      .sort((a, b) =>
        ((b.skillPoints ?? 0) - (a.skillPoints ?? 0))
        || (b.level - a.level)
        || (b.xp - a.xp),
      )[0];
    return target ? this.buildMonsterFocusTarget(target.id, '성장 지휘') : null;
  }

  private findLowestLevelMonsterTarget(): HomeFocusTarget | null {
    const target = [...(this.gs.ownedMonsters ?? [])]
      .sort((a, b) =>
        (a.level - b.level)
        || (a.xp - b.xp)
        || a.id.localeCompare(b.id),
      )[0];
    return target ? this.buildMonsterFocusTarget(target.id, '성장 지휘') : null;
  }

  private buildRoomFocusTarget(slotIdx: number, monsterId: string): HomeFocusTarget {
    return {
      monsterId,
      sourceLabel: `방 #${slotIdx + 1} 수호자`,
      slotIdx,
    };
  }

  private buildMonsterFocusTarget(monsterId: string, fallbackSourceLabel: string): HomeFocusTarget {
    const slotIdx = this.findMonsterRoomSlotIdx(monsterId);
    if (slotIdx !== null) return this.buildRoomFocusTarget(slotIdx, monsterId);
    return {
      monsterId,
      sourceLabel: fallbackSourceLabel,
      slotIdx: null,
    };
  }

  private findMonsterRoomSlotIdx(monsterId: string): number | null {
    const slots = this.gs.dungeonSlots ?? [];
    const idx = slots.findIndex(slot => (slot?.monsterIds ?? []).includes(monsterId));
    return idx >= 0 ? idx : null;
  }

  private applyHomeFocusTarget(target: HomeFocusTarget): void {
    this.registry.set('focusMonsterId', target.monsterId);
    this.registry.set('focusSourceLabel', target.sourceLabel);
    if (target.slotIdx === null) {
      this.registry.remove('focusRoomSlotIdx');
    } else {
      this.registry.set('focusRoomSlotIdx', target.slotIdx);
    }
  }

  private clearHomeFocusTarget(): void {
    this.registry.remove('focusMonsterId');
    this.registry.remove('focusSourceLabel');
    this.registry.remove('focusRoomSlotIdx');
  }

  private openDungeonSlot(idx: number): void {
    const odCell = this.boardLayout.cellsByIdx.get(idx);
    const sx = odCell?.rect.x ?? 0;
    const sy = odCell?.rect.y ?? 0;
    this.openRoomDetail(idx, sx, sy);
  }

  private navigateFromHome(sceneKey: string): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
  }

  /** @internal */ resolveMonsterVisual(monsterId: string): { emoji: string; name: string } {
    const baseId = Object.keys(MONSTER_DEFS).find(
      id => monsterId === id || monsterId.startsWith(`${id}_`),
    );
    const def = baseId ? MONSTER_DEFS[baseId as keyof typeof MONSTER_DEFS] : undefined;
    const name = def?.name ?? '수호자';
    return {
      emoji: def?.emoji ?? '👹',
      name: name.length > 5 ? `${name.slice(0, 4)}…` : name,
    };
  }

  // ─── Bottom nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const g = this.add.graphics().setDepth(8);
    // Chunky cream nav bar with a thick brown top edge + shadow
    g.fillStyle(CASUAL.SHADOW, 1);
    g.fillRect(0, BOT_Y - 4, CANVAS_WIDTH, BOT_H + 4);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, BOT_Y, CANVAS_WIDTH, BOT_H);
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(0, BOT_Y, CANVAS_WIDTH, 3);
    g.lineStyle(3, CASUAL.EDGE, 1);
    g.lineBetween(0, BOT_Y, CANVAS_WIDTH, BOT_Y);

    const tabs = [
      { icon: '🏰', label: '던전',  key: 'home',     accent: CASUAL.GOLD,   accentDk: CASUAL.GOLD_DK   },
      { icon: '👹', label: '막사',  key: 'barracks', accent: CASUAL.RED,    accentDk: CASUAL.RED_DK    },
      { icon: '🔮', label: '소환',  key: 'summon',   accent: CASUAL.PURPLE, accentDk: CASUAL.PURPLE_DK },
      { icon: '⚒',  label: '제작',  key: 'forge',    accent: CASUAL.BLUE,   accentDk: CASUAL.BLUE_DK   },
      { icon: '⚔️', label: '전투',  key: 'battle',   accent: CASUAL.GREEN,  accentDk: CASUAL.GREEN_DK  },
    ];
    const tabW = CANVAS_WIDTH / tabs.length;
    const panelY = BOT_Y + 6;
    const panelH = BOT_H - 10;

    const today = new Date().toISOString().slice(0, 10);
    const hasUnclaimedAchievement = ACHIEVEMENT_DEFS.some(d => {
      const entry = this.gs.achievements?.[d.id];
      return entry?.unlocked && !entry.rewardClaimed;
    });

    tabs.forEach(({ icon, label, key, accent, accentDk }, i) => {
      const tx       = i * tabW + tabW / 2;
      const isActive = key === 'home';
      const panelX = i * tabW + 5;
      const panelW = tabW - 10;

      if (isActive) {
        // Raised saturated pill with bottom-shadow lip + glossy top
        g.fillStyle(accentDk, 1);
        g.fillRoundedRect(panelX, panelY + 3, panelW, panelH, 11);
        g.fillStyle(accent, 1);
        g.fillRoundedRect(panelX, panelY, panelW, panelH - 1, 11);
        g.fillStyle(0xffffff, 0.32);
        g.fillRoundedRect(panelX + 5, panelY + 4, panelW - 10, 8, 5);
      } else {
        g.fillStyle(CASUAL.PANEL_SOFT, 1);
        g.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
        g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
        g.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);
      }
      const iconTxt = this.add.text(tx, BOT_Y + 11, icon, {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5, 0).setDepth(9);
      const labelTxt = this.add.text(tx, BOT_Y + 46, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: isActive ? '#ffffff' : CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
        stroke: isActive ? '#' + accentDk.toString(16).padStart(6, '0') : undefined,
        strokeThickness: isActive ? 3 : 0,
      }).setOrigin(0.5).setDepth(9);

      // Badge indicators — red circle at top-right of icon
      const showBadge = (
        (key === 'barracks' && this.gs.ownedMonsters.some(m => (m.skillPoints ?? 0) > 0)) ||
        (key === 'forge'    && (this.gs.awakeningStones ?? 0) > 0) ||
        (key === 'summon'   && this.gs.lastFriendSummon !== today) ||
        (key === 'battle'   && hasUnclaimedAchievement)
      );
      if (showBadge) {
        const bx = tx + 14;
        const by = panelY + 9;
        const badgeG = this.add.graphics().setDepth(61);
        badgeG.fillStyle(0xff2222, 1);
        badgeG.fillCircle(bx, by, 5);
        badgeG.lineStyle(1, 0xffffff, 0.65);
        badgeG.strokeCircle(bx, by, 5);
        this.add.text(bx, by, '!', {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(62);
      }

      if (!isActive) {
        const hoverG = this.add.graphics().setDepth(8.5).setVisible(false);
        hoverG.fillStyle(accent, 0.22);
        hoverG.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
        hoverG.lineStyle(2, accent, 0.9);
        hoverG.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);

        const zone = this.add.zone(i * tabW, BOT_Y, tabW, BOT_H)
          .setOrigin(0, 0)
          .setDepth(11)
          .setInteractive({ useHandCursor: true });

        zone.on('pointerover', () => {
          hoverG.setVisible(true);
          labelTxt.setColor('#' + accentDk.toString(16).padStart(6, '0'));
        });
        zone.on('pointerout', () => {
          hoverG.setVisible(false);
          labelTxt.setColor(CASUAL_CSS.INK_SOFT);
          iconTxt.setScale(1);
          labelTxt.setScale(1);
        });
        zone.on('pointerdown', () => {
          this.tweens.add({
            targets: [iconTxt, labelTxt],
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 80,
            yoyo: true,
          });
          audioManager.playSfx('button_click');
          this.cameras.main.fadeOut(220, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            if (key === 'barracks') this.scene.start('BarracksScene');
            else if (key === 'summon') this.scene.start('SummonScene');
            else if (key === 'forge') this.scene.start('ForgeScene');
            else if (key === 'battle') this.scene.start('StageSelectScene');
          });
        });
      }
    });
  }

  // ─── Ambient effects ─────────────────────────────────────────────────────────

  private addAmbientEffects(): void {
    const t = this.theme;
    const gridTop    = GRID_START_Y;
    const gridBottom = GRID_START_Y + GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y);

    if (t.decorations.includes('stalactites')) {
      const stalG = this.add.graphics().setDepth(3);
      drawStalactites(stalG, t, gridTop - 6, CANVAS_WIDTH, 42);
      drawStalactites(stalG, t, 0, CANVAS_WIDTH, 99);
    }
    if (t.decorations.includes('stalagmites')) {
      const stalG2 = this.add.graphics().setDepth(3);
      drawStalagmites(stalG2, t, gridBottom + 4, CANVAS_WIDTH, 77);
      drawStalagmites(stalG2, t, CANVAS_HEIGHT - 64, CANVAS_WIDTH, 55);
    }

    const glowPts = [
      { x: 18,                y: gridTop },
      { x: CANVAS_WIDTH - 18, y: gridTop },
      { x: 18,                y: gridBottom - 20 },
      { x: CANVAS_WIDTH - 18, y: gridBottom - 20 },
    ];
    const glow = this.add.graphics().setDepth(4);
    glowPts.forEach(({ x, y }) => {
      glow.fillStyle(t.glowColor, 0.04);
      glow.fillCircle(x, y, 36);
      glow.fillStyle(t.glowColor, 0.08);
      glow.fillCircle(x, y, 18);
      glow.fillStyle(t.glowColor, 0.18);
      glow.fillCircle(x, y, 6);
    });
    this.tweens.add({
      targets: glow, alpha: { from: 0.6, to: 1.0 },
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    if (t.decorations.includes('water_drips')) {
      const dripXs = [45, 130, 220, 310, 365];
      for (const dx of dripXs) addWaterDrip(this, t, dx, gridTop - 2, gridTop + 60, 16);
    }
  }
}
