import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  loadGameState, saveGameState,
  getUnlockedSlots,
  getRoomSlotCapacity,
  SLOT_UNLOCK_LEVELS,
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
  SLOT_W, SLOT_H, INVASION_ORDER,
} from '../ui/RoomSlotRenderer';
import { applyIdleAnimation as _applyIdleAnimation } from '../ui/MonsterAnimations';
import {
  type InvasionUIState,
  createInvasionUIState,
  checkForInvasion,
  showInvasionBanner,
  goToPreBattle,
} from '../ui/InvasionUI';
import {
  type SynergyDrawContext,
  drawSynergyConnectors,
  drawSynergySummary,
} from '../ui/DungeonSynergy';
import { buildDungeonBlueprintPanel } from '../ui/DungeonBlueprintPanel';
import { addFramedPanel } from '../ui/GameUiPrimitives';
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

// ─── Layout constants ──────────────────────────────────────────────────────────

const TOP_H    = 64;
const BOT_H    = 64;
const BOT_Y    = CANVAS_HEIGHT - BOT_H;

const GRID_COLS_HOME = 3;
const GRID_ROWS_HOME = 3;

const SLOT_PAD_X = Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1));
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

interface HomeRoomFeedback {
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

interface HomeCommandButtonHint {
  readonly text: string;
  readonly accent: number;
}

interface HomeOpsStatus {
  readonly readiness: number;
  readonly builtRooms: number;
  readonly unlockedSlots: number;
  readonly assignedMonsters: number;
  readonly monsterCapacity: number;
  readonly installedTraps: number;
  readonly trapCapacity: number;
  readonly threatScore: number;
  readonly nextSlotLevel: number | null;
}

interface RouteSegmentVisualState {
  readonly accent: number;
  readonly energy: number;
  readonly builtCount: number;
  readonly isBroken: boolean;
  readonly isPlanned: boolean;
}

export class DungeonHomeScene extends Phaser.Scene {
  private gs = loadGameState();
  private tutorialOverlay: TutorialOverlay | null = null;
  private roomDetailState: RoomDetailState = createRoomDetailState();
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
  private dungeonContainer: Phaser.GameObjects.Container | null = null;
  private dungeonBlueprintContainer: Phaser.GameObjects.Container | null = null;
  private commandDeckContainer: Phaser.GameObjects.Container | null = null;
  private recentlyChangedRoomIdx: number | null = null;
  private selectedRoomIdx: number | null = null;
  private pendingRoomFeedback: HomeRoomFeedback | null = null;
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
  private theme!: DungeonTheme;

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

  private selectRoomForPlacement(slotIdx: number): void {
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

    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
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

  private rebuildDungeonSlots(): void {
    if (this.dungeonContainer) this.dungeonContainer.destroy();
    const c = this.add.container(0, 0).setDepth(3);
    this.dungeonContainer = c;

    const unlockedCount = getUnlockedSlots(this.gs.dmLevel);
    logger.debug(`[SLOTS] DM Lv.${this.gs.dmLevel}: ${unlockedCount} slots unlocked`);

    const g = this.add.graphics();
    c.add(g);
    const changedIdx = this.recentlyChangedRoomIdx;

    this.drawDungeonMapBackdrop(c, g, unlockedCount);
    this.drawDungeonRouteNetwork(c, g, unlockedCount);
    this.addDungeonRouteFlow(c, unlockedCount);
    this.addDungeonActivityLayer(c, unlockedCount);
    this.drawDungeonRoomAlcoves(g, unlockedCount);

    const synergyCtx: SynergyDrawContext = {
      scene: this, theme: this.theme,
      slots: this.gs.dungeonSlots ?? [],
      gridCols: GRID_COLS_HOME, gridRows: GRID_ROWS_HOME,
      slotW: SLOT_W, slotH: SLOT_H,
      slotPadX: SLOT_PAD_X, slotPadY: SLOT_PAD_Y,
      gridStartY: GRID_START_Y,
    };
    drawSynergyConnectors(synergyCtx, c, unlockedCount);

    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      for (let col = 0; col < GRID_COLS_HOME; col++) {
        const idx        = row * GRID_COLS_HOME + col;
        const isUnlocked = idx < unlockedCount;
        const sx = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
        const sy = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
        this.drawBattleSlot(c, g, sx, sy, idx, isUnlocked);
        if (idx === changedIdx && isUnlocked) this.addRoomChangedPulse(c, sx, sy, idx);
        if (idx === this.selectedRoomIdx && isUnlocked) {
          const hl = this.add.graphics().setDepth(9);
          hl.lineStyle(3, COLORS.JADE, 1);
          hl.strokeRoundedRect(sx - 2, sy - 2, SLOT_W + 4, SLOT_H + 4, 10);
          hl.lineStyle(6, COLORS.JADE, 0.25);
          hl.strokeRoundedRect(sx - 2, sy - 2, SLOT_W + 4, SLOT_H + 4, 10);
          c.add(hl);
        }

        if (isUnlocked) {
          const _sx = sx, _sy = sy, _idx = idx;
          const focusAffordance = this.addRoomOpenAffordance(c, _sx, _sy, _idx);
          const zone = this.add.zone(sx + SLOT_W / 2, sy + SLOT_H / 2, SLOT_W, SLOT_H)
            .setDepth(10).setInteractive({ useHandCursor: true });
          zone.on('pointerover', () => focusAffordance.setHover(true));
          zone.on('pointerout', () => focusAffordance.setHover(false));
          zone.on('pointerdown', () => {
            focusAffordance.pulse();
            this.selectRoomForPlacement(_idx);
          });
          c.add(zone);
        }
      }
    }

    this.addDungeonCrewLayer(c, unlockedCount);
    this.addPrimaryRoomActionPin(c, unlockedCount);
    this.addActionQueueRankMarkers(c, unlockedCount);
    this.addRoomMaintenanceBadges(c, unlockedCount);
    drawSynergySummary(synergyCtx, c, CANVAS_WIDTH);
  }

  private addRoomOpenAffordance(
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

    const drawCorners = (
      graphics: Phaser.GameObjects.Graphics,
      alpha: number,
      weight: number,
      expand = 0,
    ): void => {
      const left = x + inset - expand;
      const top = y + inset - expand;
      const right = x + SLOT_W - inset + expand;
      const bottom = y + SLOT_H - inset + expand;
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

  private addPrimaryRoomActionPin(
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

    const col = pin.slotIdx % GRID_COLS_HOME;
    const row = Math.floor(pin.slotIdx / GRID_COLS_HOME);
    const x = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X) + SLOT_W - 17;
    const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + 29;
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

    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
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
    const action = getRoomActionRecommendation(this.gs, slotIdx);
    if (action.kind === 'ready') return null;
    return { slotIdx, label: action.label, icon: action.icon, accent: action.accent };
  }

  private addActionQueueRankMarkers(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const actions = getDungeonActionQueue(this.gs, unlockedCount).slice(0, 3);
    if (actions.length === 0) return;

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    actions.forEach((action, i) => {
      const col = action.slotIdx % GRID_COLS_HOME;
      const row = Math.floor(action.slotIdx / GRID_COLS_HOME);
      const x = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2;
      const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + 10;
      const rank = i + 1;
      this.addActionQueueRoomSpotlight(c, action, rank, x, y + SLOT_H / 2 - 10, reducedMotion);
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
    const ringW = SLOT_W + 12 - Math.min(rank, 3) * 2;
    const ringH = SLOT_H + 10 - Math.min(rank, 3) * 2;
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

  private addRoomMaintenanceBadges(
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

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    maintenanceActions.forEach(action => {
      const col = action.slotIdx % GRID_COLS_HOME;
      const row = Math.floor(action.slotIdx / GRID_COLS_HOME);
      const x = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2;
      const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H - 15;
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

  private addDungeonActivityLayer(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    for (let idx = 0; idx < unlockedCount; idx++) {
      const slot = this.gs.dungeonSlots?.[idx];
      if (!slot?.roomType) continue;

      const col = idx % GRID_COLS_HOME;
      const row = Math.floor(idx / GRID_COLS_HOME);
      const cx = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2;
      const cy = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2;
      this.addRoomActivityAura(c, cx, cy, slot, idx);
    }
  }

  private drawDungeonRoomAlcoves(
    g: Phaser.GameObjects.Graphics,
    unlockedCount: number,
  ): void {
    const totalSlots = GRID_COLS_HOME * GRID_ROWS_HOME;
    for (let idx = 0; idx < totalSlots; idx++) {
      const col = idx % GRID_COLS_HOME;
      const row = Math.floor(idx / GRID_COLS_HOME);
      const x = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
      const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
      this.drawDungeonRoomAlcove(g, x, y, idx, idx < unlockedCount);
    }
  }

  private drawDungeonRoomAlcove(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    slotIdx: number,
    unlocked: boolean,
  ): void {
    const slot = this.gs.dungeonSlots?.[slotIdx];
    const isBuilt = Boolean(unlocked && slot?.roomType);
    const isBroken = Boolean(isBuilt && slot?.hp <= 0);
    const accent = isBroken
      ? 0xff5544
      : isBuilt && slot
        ? this.getRoomActivityColor(slot)
        : unlocked
          ? 0x55b88a
          : 0x4d3e2a;
    const readiness = slot?.roomType ? calculateRoomMetrics(this.gs, slot).readiness : 0;
    const energy = unlocked
      ? Phaser.Math.Clamp((isBuilt ? readiness / 100 : 0.28) + (slot?.roomLevel ?? 0) * 0.05, 0.22, 0.92)
      : 0.12;
    const left = x - 8;
    const top = y - 8;
    const w = SLOT_W + 16;
    const h = SLOT_H + 18;
    const midX = x + SLOT_W / 2;
    const floorY = y + SLOT_H + 8;
    const alpha = unlocked ? 0.48 : 0.22;

    g.fillStyle(0x050302, unlocked ? 0.66 : 0.40);
    g.fillRoundedRect(left, top, w, h, 14);
    g.lineStyle(1.1, 0x131b1b, unlocked ? 0.78 : 0.42);
    g.strokeRoundedRect(left, top, w, h, 14);

    g.fillStyle(0x101615, unlocked ? 0.60 : 0.32);
    g.fillRoundedRect(left + 5, top + 4, w - 10, 13, 7);
    g.fillStyle(0xffffff, unlocked ? 0.055 : 0.025);
    g.fillRoundedRect(left + 12, top + 7, w - 24, 3, 2);

    g.fillStyle(0x070b0a, unlocked ? 0.80 : 0.46);
    g.fillRoundedRect(left + 3, top + 15, 8, h - 24, 5);
    g.fillRoundedRect(left + w - 11, top + 15, 8, h - 24, 5);
    g.lineStyle(1, accent, unlocked ? 0.18 + energy * 0.16 : 0.08);
    g.lineBetween(left + 7, top + 22, left + 7, top + h - 16);
    g.lineBetween(left + w - 7, top + 22, left + w - 7, top + h - 16);

    g.fillStyle(0x010202, unlocked ? 0.62 : 0.32);
    g.fillEllipse(midX, floorY, SLOT_W + 18, 16);
    g.fillStyle(accent, isBroken ? 0.12 : 0.045 + energy * 0.055);
    g.fillEllipse(midX, floorY - 1, SLOT_W + 4, 9);

    const socketAlpha = isBroken ? 0.34 : 0.16 + energy * 0.20;
    const sockets = [
      { x: left + 13, y: top + 13 },
      { x: left + w - 13, y: top + 13 },
      { x: left + 13, y: top + h - 13 },
      { x: left + w - 13, y: top + h - 13 },
    ];
    sockets.forEach((socket, socketIdx) => {
      g.fillStyle(0x010404, unlocked ? 0.86 : 0.46);
      g.fillCircle(socket.x, socket.y, socketIdx < 2 ? 3.5 : 3);
      g.fillStyle(accent, unlocked ? socketAlpha : 0.07);
      g.fillCircle(socket.x, socket.y, socketIdx < 2 ? 1.8 : 1.5);
    });

    if (isBuilt) {
      g.lineStyle(1.2, accent, isBroken ? 0.28 : 0.18 + energy * 0.22);
      g.strokeRoundedRect(left + 4, top + 4, w - 8, h - 8, 11);
      g.fillStyle(accent, isBroken ? 0.08 : 0.04 + energy * 0.045);
      g.fillRoundedRect(left + 15, floorY - 9, w - 30, 5, 3);
      return;
    }

    if (unlocked) {
      g.lineStyle(1, accent, alpha * 0.32);
      g.strokeRoundedRect(left + 12, top + 20, w - 24, h - 34, 8);
      g.fillStyle(accent, 0.055);
      g.fillRoundedRect(left + 20, top + h - 18, w - 40, 4, 2);
      return;
    }

    g.lineStyle(1, 0x8a7858, 0.10);
    g.strokeRoundedRect(left + 12, top + 20, w - 24, h - 34, 8);
    g.lineStyle(1, 0x8a7858, 0.08);
    g.lineBetween(left + 24, top + 25, left + w - 24, top + h - 22);
    g.lineBetween(left + w - 24, top + 25, left + 24, top + h - 22);
  }

  private addRoomActivityAura(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    slot: DungeonSlot,
    idx: number,
  ): void {
    const isBroken = Boolean(slot.roomType && slot.hp <= 0);
    const monsterCount = (slot.monsterIds ?? []).filter(Boolean).length;
    const trapCount = (slot.trapIds ?? []).filter(Boolean).length;
    const loadoutCount = monsterCount + trapCount;
    const hasActiveLoadout = loadoutCount > 0;
    const activity = Math.min(1, 0.28 + (monsterCount + trapCount + slot.roomLevel) * 0.13);
    const accent = isBroken ? 0xff5544 : this.getRoomActivityColor(slot);
    const aura = this.add.container(x, y).setAlpha(isBroken ? 0.42 : 0.30 + activity * 0.18);

    const glow = this.add.graphics();
    glow.fillStyle(accent, isBroken ? 0.12 : 0.08 + activity * 0.06);
    glow.fillCircle(0, 0, 49);
    glow.fillStyle(accent, isBroken ? 0.11 : 0.12 + activity * 0.07);
    glow.fillCircle(0, 0, 29);
    glow.lineStyle(1, accent, isBroken ? 0.28 : 0.18 + activity * 0.22);
    glow.strokeCircle(0, 0, 42);
    glow.strokeCircle(0, 0, 24);
    aura.add(glow);

    const motePositions = isBroken
      ? [{ x: -18, y: -13 }, { x: 19, y: 15 }]
      : hasActiveLoadout
        ? [{ x: -28, y: -20 }, { x: 22, y: 24 }]
        : [];
    motePositions.forEach((pos, moteIdx) => {
      const mote = this.add.circle(pos.x, pos.y, moteIdx % 2 === 0 ? 2.4 : 1.8, accent, isBroken ? 0.36 : 0.34 + activity * 0.24);
      aura.add(mote);
      this.tweens.add({
        targets: mote,
        alpha: isBroken ? 0.08 : 0.12,
        y: pos.y + (moteIdx % 2 === 0 ? -5 : 4),
        duration: 760 + ((idx + moteIdx) % 4) * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    if (isBroken) {
      glow.lineStyle(1.4, 0xff5544, 0.30);
      glow.lineBetween(-18, -18, -2, 3);
      glow.lineBetween(-2, 3, 18, 21);
      glow.lineBetween(4, -22, -2, 3);
    }

    c.add(aura);
    if (hasActiveLoadout || isBroken) {
      this.tweens.add({
        targets: aura,
        scaleX: isBroken ? 1.04 : 1.08,
        scaleY: isBroken ? 1.04 : 1.08,
        alpha: isBroken ? 0.25 : 0.22 + activity * 0.16,
        duration: isBroken ? 640 : 1100 + (idx % 3) * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private addDungeonCrewLayer(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    for (let idx = 0; idx < unlockedCount; idx++) {
      const slot = this.gs.dungeonSlots?.[idx];
      if (!slot?.roomType || slot.hp <= 0) continue;

      const monsterIds = (slot.monsterIds ?? []).filter((id): id is string => typeof id === 'string');
      const trapIds = (slot.trapIds ?? []).filter((id): id is string => typeof id === 'string');
      if (monsterIds.length === 0 && trapIds.length === 0) continue;

      const col = idx % GRID_COLS_HOME;
      const row = Math.floor(idx / GRID_COLS_HOME);
      const sx = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
      const sy = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
      const accent = monsterIds.length > 0 ? this.getRoomActivityColor(slot) : 0xffc45f;
      const icon = monsterIds.length > 0
        ? this.resolveMonsterVisual(monsterIds[0]).emoji
        : '⚠';
      const loadoutCount = monsterIds.length + trapIds.length;
      const badgeX = sx + SLOT_W + 5;
      const badgeY = sy + 42 + (idx % 2) * 15;

      this.addRoomCrewBadge(c, badgeX, badgeY, icon, loadoutCount, accent, trapIds.length > 0, reducedMotion, idx);
    }
  }

  private addRoomCrewBadge(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    icon: string,
    count: number,
    accent: number,
    hasTrap: boolean,
    reducedMotion: boolean,
    seed: number,
  ): void {
    const badge = this.add.container(x, y).setDepth(13);
    const g = this.add.graphics();
    const countText = count > 1 ? String(Math.min(count, 9)) : '';

    g.fillStyle(0x050402, 0.94);
    g.fillCircle(0, 0, 9.5);
    g.lineStyle(1.2, accent, 0.78);
    g.strokeCircle(0, 0, 9.5);
    g.fillStyle(accent, 0.18);
    g.fillCircle(0, 0, 6);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(-3.5, -3.5, 1.7);
    if (hasTrap) {
      g.fillStyle(0xffc45f, 0.94);
      g.fillTriangle(-9, 8, -4, -1, 1, 8);
      g.lineStyle(1, 0x050402, 0.64);
      g.lineBetween(-7, 6, -4, 1);
      g.lineBetween(-4, 1, -1, 6);
    }
    if (count > 1) {
      g.fillStyle(accent, 0.94);
      g.fillCircle(7.5, 7.5, 4.8);
      g.lineStyle(1, 0x050402, 0.72);
      g.strokeCircle(7.5, 7.5, 4.8);
    }
    badge.add(g);

    badge.add(this.add.text(0, -1, icon, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#f0e6c8',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    if (countText) {
      badge.add(this.add.text(7.5, 7.5, countText, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#06100d',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }
    c.add(badge);

    if (reducedMotion) return;
    this.tweens.add({
      targets: badge,
      y: y + (seed % 2 === 0 ? -2 : 2),
      alpha: { from: 0.86, to: 1 },
      duration: 760 + (seed % 5) * 80,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private getRoomActivityColor(slot: DungeonSlot): number {
    switch (slot.roomType) {
      case 'combat': return 0xff8a45;
      case 'trap': return 0xc8921a;
      case 'support': return 0x66c08a;
      case 'magic': return 0x9c7cff;
      default: return this.theme.panelBorder;
    }
  }



  private drawDungeonEntranceGate(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    accent: number,
  ): void {
    g.fillStyle(0x050302, 0.84);
    g.fillRoundedRect(x - 20, y - 27, 40, 54, 12);
    g.fillStyle(0x101a20, 0.94);
    g.fillRoundedRect(x - 16, y - 22, 32, 44, 10);
    g.fillStyle(0x050302, 0.90);
    g.fillCircle(x, y - 4, 12);
    g.fillRoundedRect(x - 12, y - 4, 24, 24, 7);
    g.lineStyle(1.4, accent, 0.62);
    g.strokeRoundedRect(x - 18, y - 25, 36, 50, 11);
    g.lineStyle(1, 0xffffff, 0.12);
    g.lineBetween(x - 9, y - 17, x - 9, y + 18);
    g.lineBetween(x + 9, y - 17, x + 9, y + 18);
    // Threat glow + entry-direction chevrons (invaders pour in here)
    g.fillStyle(accent, 0.16);
    g.fillCircle(x, y + 2, 14);
    g.fillStyle(accent, 0.30);
    g.fillCircle(x, y + 7, 3);
    g.lineStyle(2, accent, 0.7);
    for (let k = 0; k < 2; k++) {
      const cy2 = y + 2 + k * 8;
      g.lineBetween(x - 7, cy2, x, cy2 + 5);
      g.lineBetween(x + 7, cy2, x, cy2 + 5);
    }
    c.add(this.add.text(x, y - 36, '침입문', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#d8f7ff',
      fontStyle: 'bold',
      stroke: '#02141a', strokeThickness: 3,
    }).setOrigin(1, 0.5).setAlpha(0.95));
  }

  private drawDungeonHeartCore(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    accent: number,
  ): void {
    // Protected core — concentric glow so it reads as the thing under threat
    g.fillStyle(0x050302, 0.86);
    g.fillCircle(x, y, 25);
    g.fillStyle(accent, 0.08);
    g.fillCircle(x, y, 38);
    g.fillStyle(accent, 0.14);
    g.fillCircle(x, y, 31);
    g.lineStyle(1.4, accent, 0.72);
    g.strokeCircle(x, y, 23);
    g.lineStyle(1, 0xffffff, 0.16);
    g.strokeCircle(x, y, 14);
    g.fillStyle(accent, 0.72);
    g.fillCircle(x, y, 6);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(x, y, 2.5);
    g.fillStyle(accent, 0.20);
    g.fillTriangle(x, y - 18, x + 15, y + 10, x - 15, y + 10);
    c.add(this.add.text(x, y + 36, '심장부', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#fff0b8',
      fontStyle: 'bold',
      stroke: '#1a1002', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.95));
  }

  private drawDungeonMapBackdrop(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    unlockedCount: number,
  ): void {
    const mapX = 8;
    const mapY = GRID_START_Y - 12;
    const mapW = CANVAS_WIDTH - 16;
    const mapH = GRID_ROWS_HOME * SLOT_H + (GRID_ROWS_HOME - 1) * SLOT_PAD_Y + 24;

    // ── Bright casual play tray: cream panel, chunky brown edge, drop shadow ──
    g.fillStyle(CASUAL.SHADOW, 0.4);
    g.fillRoundedRect(mapX + 3, mapY + 7, mapW, mapH, 22);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRoundedRect(mapX, mapY, mapW, mapH, 22);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(mapX + 4, mapY + 4, mapW - 8, mapH - 8, 19);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(mapX + 12, mapY + 8, mapW - 24, 9, 5);

    // Per-floor soft shelf + B-label chip
    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) - 6;
      g.fillStyle(row % 2 === 0 ? CASUAL.PANEL_SOFT : 0xffedd0, 0.95);
      g.fillRoundedRect(mapX + 12, y, mapW - 24, SLOT_H + 6, 15);
      g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.45);
      g.strokeRoundedRect(mapX + 12, y, mapW - 24, SLOT_H + 6, 15);
      const chipX = mapX + 24, chipY = y + 13;
      g.fillStyle(CASUAL.EDGE, 1);
      g.fillRoundedRect(chipX - 14, chipY - 9, 30, 18, 6);
      c.add(this.add.text(chipX + 1, chipY, `B${row + 1}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#fff6e6', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2));
    }

    // Per-room bright card backing (so rooms read as chunky cards on the tray)
    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      for (let col = 0; col < GRID_COLS_HOME; col++) {
        const idx = row * GRID_COLS_HOME + col;
        const x = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
        const y = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
        const slot = this.gs.dungeonSlots?.[idx];
        const isUnlocked = idx < unlockedCount;
        const isBroken = !!slot?.roomType && !!slot && slot.hp <= 0;
        const accent = isBroken ? CASUAL.RED
          : slot?.roomType ? this.getRoomActivityColor(slot)
            : isUnlocked ? CASUAL.GREEN : CASUAL.EDGE_SOFT;
        g.fillStyle(CASUAL.SHADOW, isUnlocked ? 0.22 : 0.12);
        g.fillRoundedRect(x - 5, y + 4, SLOT_W + 10, SLOT_H, 14);
        g.fillStyle(isUnlocked ? 0xffffff : 0xece0c4, isUnlocked ? 0.6 : 0.45);
        g.fillRoundedRect(x - 5, y - 2, SLOT_W + 10, SLOT_H + 4, 14);
        g.lineStyle(2.5, accent, isUnlocked ? 0.6 : 0.3);
        g.strokeRoundedRect(x - 5, y - 2, SLOT_W + 10, SLOT_H + 4, 14);
      }
    }

    // Narrative anchors (entrance gate → heart core)
    const routeAnchors = this.getUnlockedRoute(unlockedCount);
    if (routeAnchors.length > 0) {
      this.drawDungeonEntranceGate(c, g, mapX + mapW - 12, mapY + 48, CASUAL.GREEN);
      this.drawDungeonHeartCore(c, g, mapX + 24, mapY + mapH - 42, CASUAL.GOLD);
    }
    return;
  }


  private fillDungeonRouteTunnel(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    color: number,
    alpha: number,
    index: number,
  ): void {
    const passage = this.getRoutePassage(from, to);
    const dx = passage.to.x - passage.from.x;
    const dy = passage.to.y - passage.from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const wobble = index % 2 === 0 ? 3 : -3;
    const mid = {
      x: (passage.from.x + passage.to.x) / 2 + px * wobble,
      y: (passage.from.y + passage.to.y) / 2 + py * wobble,
    };
    const half = width / 2;
    const innerHalf = Math.max(4, half - 3);

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(passage.from.x + px * half - ux * 2, passage.from.y + py * half - uy * 2);
    g.lineTo(mid.x + px * (half + 2), mid.y + py * (half + 2));
    g.lineTo(passage.to.x + px * innerHalf + ux * 2, passage.to.y + py * innerHalf + uy * 2);
    g.lineTo(passage.to.x - px * half + ux * 2, passage.to.y - py * half + uy * 2);
    g.lineTo(mid.x - px * (half + 1), mid.y - py * (half + 1));
    g.lineTo(passage.from.x - px * innerHalf - ux * 2, passage.from.y - py * innerHalf - uy * 2);
    g.closePath();
    g.fillPath();
  }

  private drawDungeonRouteWallStones(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    index: number,
  ): void {
    const passage = this.getRoutePassage(from, to);
    const dx = passage.to.x - passage.from.x;
    const dy = passage.to.y - passage.from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const count = Math.max(2, Math.floor(len / 28));

    for (let i = 1; i <= count; i++) {
      const tpos = i / (count + 1);
      const cx = passage.from.x + dx * tpos;
      const cy = passage.from.y + dy * tpos;
      const offset = i % 2 === 0 ? 9 : -9;
      const sx = cx + px * offset;
      const sy = cy + py * offset;
      const stoneW = Math.abs(dx) >= Math.abs(dy) ? 11 : 7;
      const stoneH = Math.abs(dx) >= Math.abs(dy) ? 6 : 11;
      g.fillStyle(CASUAL.EDGE_SOFT, 0.22 + (index % 2) * 0.04);
      g.fillRoundedRect(sx - stoneW / 2, sy - stoneH / 2, stoneW, stoneH, 3);
      g.lineStyle(1, 0xffffff, 0.18);
      g.lineBetween(sx - px * 3 - ux * 2, sy - py * 3 - uy * 2, sx + px * 3 + ux * 2, sy + py * 3 + uy * 2);
    }
  }

  private drawDungeonRouteNetwork(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    unlockedCount: number,
  ): void {
    const route = this.getUnlockedRoute(unlockedCount);
    if (route.length === 0) return;

    const t = this.theme;

    for (let i = 0; i < route.length - 1; i++) {
      this.fillDungeonRouteTunnel(
        g,
        this.getSlotCenter(route[i]),
        this.getSlotCenter(route[i + 1]),
        31,
        CASUAL.EDGE,
        0.5,
        i,
      );
    }

    for (let i = 0; i < route.length - 1; i++) {
      this.fillDungeonRouteTunnel(
        g,
        this.getSlotCenter(route[i]),
        this.getSlotCenter(route[i + 1]),
        23,
        CASUAL.EDGE_SOFT,
        0.85,
        i + 1,
      );
    }

    for (let i = 0; i < route.length - 1; i++) {
      this.fillDungeonRouteTunnel(
        g,
        this.getSlotCenter(route[i]),
        this.getSlotCenter(route[i + 1]),
        12,
        CASUAL.PANEL_SOFT,
        0.6,
        i + 2,
      );
    }

    for (let i = 0; i < route.length - 1; i++) {
      this.drawRouteInfrastructureSegment(g, route[i], route[i + 1], i);
    }

    for (let i = 0; i < route.length - 1; i++) {
      this.drawDungeonRouteWallStones(g, this.getSlotCenter(route[i]), this.getSlotCenter(route[i + 1]), i);
    }

    g.lineStyle(1.5, t.panelBorder, 0.12);
    for (let i = 0; i < route.length - 1; i++) {
      this.strokeDungeonRouteSegment(g, this.getSlotCenter(route[i]), this.getSlotCenter(route[i + 1]));
    }

    for (let i = 0; i < route.length - 1; i++) {
      this.drawRouteSignal(g, this.getSlotCenter(route[i]), this.getSlotCenter(route[i + 1]), i);
    }

    route.forEach((idx, routeIdx) => {
      const center = this.getSlotCenter(idx);
      this.drawRouteJunction(c, g, center.x, center.y, routeIdx + 1, idx, unlockedCount);
    });
  }

  private drawRouteInfrastructureSegment(
    g: Phaser.GameObjects.Graphics,
    fromIdx: number,
    toIdx: number,
    index: number,
  ): void {
    const state = this.getRouteSegmentVisualState(fromIdx, toIdx);
    const passage = this.getRoutePassage(this.getSlotCenter(fromIdx), this.getSlotCenter(toIdx));
    const dx = passage.to.x - passage.from.x;
    const dy = passage.to.y - passage.from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const railOffset = 8 + (index % 2);
    const railAlpha = state.isPlanned ? 0.12 : state.isBroken ? 0.24 : 0.16 + state.energy * 0.22;
    const plateAlpha = state.isPlanned ? 0.10 : state.isBroken ? 0.17 : 0.12 + state.energy * 0.13;

    this.strokeRouteOffsetLine(g, passage, px, py, railOffset, state.accent, railAlpha, 2);
    this.strokeRouteOffsetLine(g, passage, px, py, -railOffset, state.accent, railAlpha * 0.78, 2);
    this.strokeRouteOffsetLine(g, passage, px, py, 0, 0xffffff, state.isPlanned ? 0.035 : 0.05 + state.energy * 0.05, 1);

    const plateCount = Math.max(1, Math.floor(len / 38));
    for (let i = 1; i <= plateCount; i++) {
      const ratio = i / (plateCount + 1);
      const cx = passage.from.x + dx * ratio;
      const cy = passage.from.y + dy * ratio;
      const plateLength = state.isPlanned ? 10 : 13 + state.energy * 4;
      const plateThickness = state.isPlanned ? 4 : 5.5;
      this.fillRouteServicePlate(g, cx, cy, ux, uy, px, py, plateLength, plateThickness, state.accent, plateAlpha);
      g.fillStyle(0xffffff, state.isPlanned ? 0.05 : 0.07 + state.energy * 0.07);
      g.fillCircle(cx - ux * 2, cy - uy * 2, 1.1);
    }

    this.drawRouteTerminal(g, passage.from.x, passage.from.y, ux, uy, px, py, state, 1);
    this.drawRouteTerminal(g, passage.to.x, passage.to.y, -ux, -uy, px, py, state, 2);
  }

  private getRouteSegmentVisualState(fromIdx: number, toIdx: number): RouteSegmentVisualState {
    const slots = this.gs.dungeonSlots ?? [];
    const endpoints = [slots[fromIdx], slots[toIdx]].filter((slot): slot is DungeonSlot => !!slot?.roomType);
    const isBroken = endpoints.some(slot => slot.hp <= 0);
    const roomMetrics = endpoints.map(slot => calculateRoomMetrics(this.gs, slot));
    const readiness = endpoints.length > 0
      ? Math.round(roomMetrics.reduce((sum, metrics) => sum + metrics.readiness, 0) / endpoints.length)
      : 0;
    const threatScore = roomMetrics.reduce((sum, metrics) => sum + metrics.threatScore, 0);
    const accent = isBroken
      ? 0xff5544
      : endpoints.length > 0
        ? this.getRouteFlowAccent(fromIdx, toIdx)
        : 0x55b88a;
    const activeEnergy = Phaser.Math.Clamp(
      readiness / 100 * 0.68 + Math.min(1, threatScore / 220) * 0.22 + endpoints.length * 0.08,
      0.24,
      1,
    );

    return {
      accent,
      energy: endpoints.length > 0 ? activeEnergy : 0.18,
      builtCount: endpoints.length,
      isBroken,
      isPlanned: endpoints.length === 0,
    };
  }

  private strokeRouteOffsetLine(
    g: Phaser.GameObjects.Graphics,
    passage: { from: { x: number; y: number }; to: { x: number; y: number } },
    px: number,
    py: number,
    offset: number,
    color: number,
    alpha: number,
    width: number,
  ): void {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(passage.from.x + px * offset, passage.from.y + py * offset);
    g.lineTo(passage.to.x + px * offset, passage.to.y + py * offset);
    g.strokePath();
  }

  private fillRouteServicePlate(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    ux: number,
    uy: number,
    px: number,
    py: number,
    length: number,
    thickness: number,
    color: number,
    alpha: number,
  ): void {
    const halfLength = length / 2;
    const halfThickness = thickness / 2;

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(cx + ux * halfLength + px * halfThickness, cy + uy * halfLength + py * halfThickness);
    g.lineTo(cx - ux * halfLength + px * halfThickness, cy - uy * halfLength + py * halfThickness);
    g.lineTo(cx - ux * halfLength - px * halfThickness, cy - uy * halfLength - py * halfThickness);
    g.lineTo(cx + ux * halfLength - px * halfThickness, cy + uy * halfLength - py * halfThickness);
    g.closePath();
    g.fillPath();
  }

  private drawRouteTerminal(
    g: Phaser.GameObjects.Graphics,
    edgeX: number,
    edgeY: number,
    ux: number,
    uy: number,
    px: number,
    py: number,
    state: RouteSegmentVisualState,
    terminalIndex: number,
  ): void {
    const cx = edgeX + ux * 8;
    const cy = edgeY + uy * 8;
    const terminalAlpha = state.isPlanned ? 0.18 : state.isBroken ? 0.34 : 0.26 + state.energy * 0.24;

    this.fillRouteServicePlate(g, cx, cy, ux, uy, px, py, 9, 18, 0x050302, 0.78);
    this.fillRouteServicePlate(g, cx, cy, ux, uy, px, py, 6, 13, state.accent, terminalAlpha);
    g.lineStyle(1, state.accent, terminalAlpha + 0.08);
    g.strokeCircle(cx, cy, state.builtCount > 0 ? 4.2 : 3.3);
    g.fillStyle(0xffffff, state.isPlanned ? 0.06 : 0.10 + state.energy * 0.06);
    g.fillCircle(cx + px * (terminalIndex % 2 === 0 ? 3 : -3), cy + py * (terminalIndex % 2 === 0 ? 3 : -3), 1.1);
  }

  private getUnlockedRoute(unlockedCount: number): number[] {
    return Array.from({ length: GRID_COLS_HOME * GRID_ROWS_HOME }, (_, idx) => idx)
      .filter(idx => idx < unlockedCount)
      .sort((a, b) => (INVASION_ORDER[a] ?? 99) - (INVASION_ORDER[b] ?? 99));
  }

  private getSlotCenter(idx: number): { x: number; y: number } {
    const col = idx % GRID_COLS_HOME;
    const row = Math.floor(idx / GRID_COLS_HOME);
    return {
      x: SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2,
      y: GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2,
    };
  }

  private strokeDungeonRouteSegment(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const passage = this.getRoutePassage(from, to);
    g.beginPath();
    g.moveTo(passage.from.x, passage.from.y);
    g.lineTo(passage.to.x, passage.to.y);
    g.strokePath();
  }

  private getRoutePassage(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): { from: { x: number; y: number }; to: { x: number; y: number } } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const dir = Math.sign(dx) || 1;
      return {
        from: { x: from.x + dir * (SLOT_W / 2 - 2), y: from.y },
        to: { x: to.x - dir * (SLOT_W / 2 - 2), y: to.y },
      };
    }

    const dir = Math.sign(dy) || 1;
    return {
      from: { x: from.x, y: from.y + dir * (SLOT_H / 2 - 2) },
      to: { x: to.x, y: to.y - dir * (SLOT_H / 2 - 2) },
    };
  }

  private drawRouteSignal(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    index: number,
  ): void {
    const passage = this.getRoutePassage(from, to);
    const x = Math.round((passage.from.x + passage.to.x) / 2);
    const y = Math.round((passage.from.y + passage.to.y) / 2);
    const dx = Math.sign(passage.to.x - passage.from.x);
    const dy = Math.sign(passage.to.y - passage.from.y);
    const pulseAlpha = 0.18 + (index % 2) * 0.08;
    this.drawRouteChevron(g, x, y, dx, dy, pulseAlpha);
  }

  private drawRouteChevron(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dx: number,
    dy: number,
    alpha: number,
  ): void {
    const accent = this.theme.panelBorder;
    g.fillStyle(accent, alpha);
    if (Math.abs(dx) >= Math.abs(dy)) {
      const dir = dx >= 0 ? 1 : -1;
      g.fillTriangle(x + dir * 5, y, x - dir * 3, y - 4, x - dir * 3, y + 4);
    } else {
      const dir = dy >= 0 ? 1 : -1;
      g.fillTriangle(x, y + dir * 5, x - 4, y - dir * 3, x + 4, y - dir * 3);
    }
    g.fillStyle(0xffffff, alpha * 0.38);
    g.fillCircle(x, y, 1.2);
  }

  private addDungeonRouteFlow(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void {
    const route = this.getUnlockedRoute(unlockedCount);
    if (route.length < 2) return;

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    for (let i = 0; i < route.length - 1; i++) {
      const fromIdx = route[i];
      const toIdx = route[i + 1];
      const passage = this.getRoutePassage(this.getSlotCenter(fromIdx), this.getSlotCenter(toIdx));
      const dx = passage.to.x - passage.from.x;
      const dy = passage.to.y - passage.from.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      const accent = this.getRouteFlowAccent(fromIdx, toIdx);

      for (let n = 0; n < 2; n++) {
        const t = reducedMotion ? 0.32 + n * 0.28 : n * 0.36;
        const x = passage.from.x + dx * t;
        const y = passage.from.y + dy * t;
        const signal = this.add.graphics();
        signal.setPosition(x, y);
        this.paintRouteFlowSignal(signal, ux, uy, accent, 0.64 - n * 0.12);
        c.add(signal);

        if (reducedMotion) continue;
        signal.setAlpha(0.08);
        this.tweens.add({
          targets: signal,
          x: passage.to.x,
          y: passage.to.y,
          alpha: { from: 0.10, to: 0.72 },
          duration: 1500 + i * 70,
          delay: i * 130 + n * 520,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onRepeat: () => {
            signal.setPosition(passage.from.x, passage.from.y);
            signal.setAlpha(0.08);
          },
        });
      }
    }
  }

  private getRouteFlowAccent(fromIdx: number, toIdx: number): number {
    const slots = this.gs.dungeonSlots ?? [];
    const from = slots[fromIdx];
    const to = slots[toIdx];
    if ((from?.roomType && from.hp <= 0) || (to?.roomType && to.hp <= 0)) return 0xff5544;
    if (from?.roomType) return this.getRoomActivityColor(from);
    if (to?.roomType) return this.getRoomActivityColor(to);
    return 0x55b88a;
  }

  private paintRouteFlowSignal(
    g: Phaser.GameObjects.Graphics,
    ux: number,
    uy: number,
    accent: number,
    alpha: number,
  ): void {
    const px = -uy;
    const py = ux;
    g.clear();
    g.fillStyle(accent, alpha * 0.16);
    g.fillCircle(0, 0, 8);
    g.lineStyle(1, accent, alpha * 0.62);
    g.strokeCircle(0, 0, 5);
    g.fillStyle(accent, alpha);
    g.fillTriangle(
      ux * 6,
      uy * 6,
      -ux * 4 + px * 4,
      -uy * 4 + py * 4,
      -ux * 4 - px * 4,
      -uy * 4 - py * 4,
    );
    g.fillStyle(0xffffff, alpha * 0.42);
    g.fillCircle(-ux * 1.5, -uy * 1.5, 1.3);
  }

  private drawRouteJunction(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    routeOrder: number,
    slotIdx: number,
    unlockedCount: number,
  ): void {
    const slot = this.gs.dungeonSlots?.[slotIdx];
    const isBuilt = !!slot?.roomType && slot.hp > 0;
    const isBroken = !!slot?.roomType && slot.hp <= 0;
    const metrics = slot?.roomType ? calculateRoomMetrics(this.gs, slot) : null;
    const accent = isBroken ? 0xff5544 : isBuilt ? this.getRoomActivityColor(slot) : 0x55b88a;
    const alpha = slotIdx < unlockedCount ? 0.58 : 0.22;
    const accessAlpha = isBuilt
      ? 0.16 + Phaser.Math.Clamp((metrics?.readiness ?? 0) / 100, 0, 1) * 0.16
      : 0.10;

    if (slotIdx < unlockedCount) {
      g.lineStyle(1, accent, isBroken ? 0.24 : accessAlpha);
      g.strokeCircle(x, y, 54);
      const couplers = [
        { x: x - 55, y },
        { x: x + 55, y },
        { x, y: y - 55 },
        { x, y: y + 55 },
      ];
      couplers.forEach((p, idx) => {
        g.fillStyle(0x050302, 0.74);
        g.fillCircle(p.x, p.y, idx % 2 === 0 ? 4.6 : 3.8);
        g.fillStyle(accent, isBroken ? 0.22 : accessAlpha + 0.08);
        g.fillCircle(p.x, p.y, idx % 2 === 0 ? 2.5 : 2.1);
      });
    }

    g.fillStyle(0x050806, 0.82);
    g.fillCircle(x, y, 13);
    g.lineStyle(1.2, accent, alpha);
    g.strokeCircle(x, y, 13);
    g.fillStyle(accent, isBuilt ? 0.18 : 0.09);
    g.fillCircle(x, y, 7);

    if (isBuilt || isBroken) {
      const marker = this.add.text(x, y, String(routeOrder), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: isBroken ? '#ffb0a0' : '#ffe080',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.66);
      c.add(marker);
    }
  }

  // ─── Slot helpers ─────────────────────────────────────────────────────────────

  private makeRoomSlotCtx(): RoomSlotContext {
    return {
      scene: this, theme: this.theme, gs: this.gs,
      applyIdleAnimation: (emoji, monsterId, compact) =>
        this.applyIdleAnimation(emoji, monsterId, compact),
    };
  }

  private drawBattleSlot(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    index: number, unlocked: boolean,
  ): void {
    _drawBattleSlot(this.makeRoomSlotCtx(), c, g, x, y, index, unlocked);
  }

  private addRoomChangedPulse(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    slotIdx: number,
  ): void {
    const feedback = this.pendingRoomFeedback?.slotIdx === slotIdx ? this.pendingRoomFeedback : null;
    const accent = feedback?.accent ?? this.theme.panelBorder;
    const pulse = this.add.container(x + SLOT_W / 2, y + SLOT_H / 2);
    const ring = this.add.graphics();
    const left = -SLOT_W / 2;
    const top = -SLOT_H / 2;
    ring.lineStyle(2, accent, 0.95);
    ring.strokeRoundedRect(left - 4, top - 4, SLOT_W + 8, SLOT_H + 8, 9);
    ring.lineStyle(1, 0xffffff, 0.34);
    ring.strokeRoundedRect(left + 4, top + 4, SLOT_W - 8, SLOT_H - 8, 6);
    ring.fillStyle(accent, 0.16);
    ring.fillRoundedRect(left + 11, top + 8, SLOT_W - 22, feedback ? 32 : 14, 5);
    if (feedback) {
      ring.fillStyle(0xffffff, 0.10);
      ring.fillCircle(left + 20, top + 60, 5);
      ring.fillCircle(left + SLOT_W - 20, top + 68, 4);
      ring.fillCircle(left + SLOT_W - 14, top + 30, 3);
    }

    const label = this.add.text(0, top + (feedback ? 14 : 15), feedback?.title ?? '방 성장', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#fff1b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    pulse.add([ring, label]);
    if (feedback) {
      const statLabel = feedback.statLabel && feedback.statBefore && feedback.statAfter
        ? `${feedback.statLabel} ${feedback.statBefore}→${feedback.statAfter}`
        : null;
      const itemLabel = statLabel ?? (feedback.kind === 'equipment'
        ? `${feedback.equipmentEmoji} ${feedback.equipmentName}`
        : feedback.body);
      const item = this.add.text(0, top + 29, itemLabel, {
        fontFamily: 'sans-serif',
        fontSize: statLabel ? '10px' : '9px',
        color: '#d8fff5',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: SLOT_W - 28, useAdvancedWrap: true },
      }).setOrigin(0.5);
      pulse.add(item);
    }
    c.add(pulse);

    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 2200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        pulse.destroy();
        const overlayOpen = !!this.roomDetailState.roomDetailContainer
          || !!this.roomDetailState.monsterPickerContainer
          || !!this.roomDetailState.trapPickerContainer;
        if (!overlayOpen && this.recentlyChangedRoomIdx === slotIdx) {
          this.recentlyChangedRoomIdx = null;
        }
        if (this.pendingRoomFeedback?.slotIdx === slotIdx) this.pendingRoomFeedback = null;
      },
    });
  }

  private applyIdleAnimation(
    emoji: Phaser.GameObjects.Text, monsterId: string, _compact = false,
  ): void {
    _applyIdleAnimation(this, emoji, monsterId);
  }

  // ─── Command deck ────────────────────────────────────────────────────────────

  private buildCommandDeck(): void {
    if (this.commandDeckContainer) {
      this.commandDeckContainer.destroy();
      this.commandDeckContainer = null;
    }
    const deckX = 12;
    const minDeckY = GRID_START_Y + GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y) + 8;
    const deckW = CANVAS_WIDTH - deckX * 2;
    const statsTopY = BOT_Y - 26;
    const availableDeckH = statsTopY - minDeckY - 10;
    const deckH = Math.min(218, availableDeckH);
    const deckY = Math.max(minDeckY, statsTopY - deckH - 10);
    if (deckH < 190) return;
    const deck = this.add.container(0, 0).setDepth(4);
    this.commandDeckContainer = deck;

    const unlockedSlots = getUnlockedSlots(this.gs.dmLevel);
    const visibleSlots = (this.gs.dungeonSlots ?? []).slice(0, unlockedSlots);
    const builtRooms = visibleSlots.filter(slot => !!slot?.roomType).length;
    const ownedMonsters = this.gs.ownedMonsters ?? [];
    const skillReady = ownedMonsters.filter(m => (m.skillPoints ?? 0) > 0).length;
    const collectionSummary = this.getMonsterCollectionSummary(ownedMonsters);
    const nextSlot = SLOT_UNLOCK_LEVELS.find(([, count]) => count > unlockedSlots);
    const dungeonMetrics = calculateDungeonMetrics(this.gs, unlockedSlots);
    const capacityTotals = visibleSlots.reduce((totals, slot) => {
      if (!slot?.roomType) return totals;
      const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      return {
        monsters: totals.monsters + cap.monsters,
        traps: totals.traps + cap.traps,
      };
    }, { monsters: 0, traps: 0 });
    const directive = this.getHomeDirective(
      unlockedSlots,
      visibleSlots,
      dungeonMetrics.readiness,
      skillReady,
    );
    const actionQueue = getDungeonActionQueue(this.gs, unlockedSlots).slice(0, 3);

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
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 66, 12);
    g.fillStyle(CASUAL.GOLD, 0.18);
    g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 28, 12);
    g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.45);
    g.lineBetween(deckX + 14, deckY + 80, deckX + deckW - 14, deckY + 80);
    g.lineBetween(deckX + 14, deckY + deckH - 51, deckX + deckW - 14, deckY + deckH - 51);

    deck.add(this.add.text(deckX + 16, deckY + 20, '던전 운영실', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    this.drawHomeCollectionChip(deck, g, deckX + deckW - 172, deckY + 9, 112, 22, collectionSummary);
    deck.add(this.add.text(deckX + deckW - 16, deckY + 20, `DM Lv.${this.gs.dmLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    this.drawHomeOpsStatusPanel(
      deck,
      g,
      deckX + 14,
      deckY + 40,
      deckW - 28,
      34,
      {
        readiness: dungeonMetrics.readiness,
        builtRooms,
        unlockedSlots,
        assignedMonsters: dungeonMetrics.assignedMonsters,
        monsterCapacity: capacityTotals.monsters,
        installedTraps: dungeonMetrics.installedTraps,
        trapCapacity: capacityTotals.traps,
        threatScore: dungeonMetrics.threatScore,
        nextSlotLevel: nextSlot?.[0] ?? null,
      },
    );

    const directiveY = deckY + 83;
    this.drawHomeDirectiveCard(deck, deckX + 14, directiveY, deckW - 28, 40, directive);

    const queueY = directiveY + 48;
    this.drawHomeActionQueue(deck, g, deckX + 14, queueY, deckW - 28, actionQueue);

    const buttonY = deckY + deckH - 44;
    const buttonW = (deckW - 44) / 3;
    const firstAction = actionQueue[0];
    const growthTarget = this.getFocusedMonsterGrowthTarget();
    const forgeTarget = this.getFocusedForgeTarget();
    this.addCommandDeckButton(
      deck,
      deckX + 14,
      buttonY,
      buttonW,
      '방 확대',
      '▣',
      () => this.openFirstDungeonSlot(),
      firstAction ? { text: `우선 B${firstAction.slotIdx + 1}`, accent: firstAction.accent } : { text: '전체 완비', accent: 0x66c08a },
    );
    this.addCommandDeckButton(
      deck,
      deckX + 22 + buttonW,
      buttonY,
      buttonW,
      '몬스터 성장',
      '👹',
      () => this.openFocusedMonsterGrowth(),
      { text: this.formatHomeFocusTarget(growthTarget, '성장 지휘'), accent: 0x66c08a },
    );
    this.addCommandDeckButton(
      deck,
      deckX + 30 + buttonW * 2,
      buttonY,
      buttonW,
      '장비 제작',
      '⚒',
      () => this.openFocusedForge(),
      { text: this.formatHomeFocusTarget(forgeTarget, '제작 대기'), accent: 0x9a6cd8 },
    );
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

  private drawHomeCollectionChip(
    deck: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    summary: { owned: number; total: number; rareOwned: number; percent: number },
  ): void {
    // Codex chip keeps its pink semantic accent on a cream casual card.
    const PINK = 0xe85fc0;
    const PINK_CSS = '#a82f88';
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(x, y + 2, w, h, 8);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, PINK, 0.85);
    g.strokeRoundedRect(x, y, w, h, 8);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 4, y + 3, w - 8, 4, 2);
    g.fillStyle(PINK, 0.9);
    g.fillCircle(x + 12, y + h / 2, 8);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(x + 10, y + h / 2 - 3, 2);
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(x + 27, y + h - 7, w - 42, 4, 2);
    g.fillStyle(PINK, 0.9);
    g.fillRoundedRect(x + 27, y + h - 7, Math.max(5, (w - 42) * summary.percent), 4, 2);
    deck.add(this.add.text(x + 12, y + h / 2, '★', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    deck.add(this.add.text(x + 27, y + 8, `도감 ${summary.owned}/${summary.total}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: PINK_CSS,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + w - 8, y + 8, `E+ ${summary.rareOwned}`, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
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

  private drawHomeOpsStatusPanel(
    deck: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    status: HomeOpsStatus,
  ): void {
    const readinessPct = Phaser.Math.Clamp(status.readiness / 100, 0, 1);
    // Saturated casual semantic accent: green good / gold mid / red low.
    const readinessColor = status.readiness >= 80
      ? CASUAL.GREEN
      : status.readiness >= 55 ? CASUAL.GOLD : CASUAL.RED;
    const readinessColorDk = status.readiness >= 80
      ? CASUAL.GREEN_DK
      : status.readiness >= 55 ? CASUAL.GOLD_DK : CASUAL.RED_DK;
    const readinessCss = status.readiness >= 80
      ? CASUAL_CSS.GREEN
      : status.readiness >= 55 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;

    g.fillStyle(CASUAL.SHADOW, 0.2);
    g.fillRoundedRect(x, y + 2, w, h, 7);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(2, CASUAL.EDGE, 0.85);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 4, y + 3, w - 8, 4, 2);
    g.fillStyle(readinessColor, 0.18);
    g.fillRoundedRect(x + 5, y + 6, 72, h - 12, 6);
    g.lineStyle(1.5, readinessColor, 0.7);
    g.strokeRoundedRect(x + 5, y + 6, 72, h - 12, 6);

    deck.add(this.add.text(x + 12, y + 12, '운영도', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + 70, y + 20, `${status.readiness}%`, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: readinessCss,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    const barX = x + 86;
    const barY = y + 10;
    const barW = w - 96;
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(barX, barY, barW, 7, 4);
    g.lineStyle(1.5, CASUAL.EDGE, 0.7);
    g.strokeRoundedRect(barX, barY, barW, 7, 4);
    const fillW = Math.max(6, barW * readinessPct);
    g.fillStyle(readinessColorDk, 1);
    g.fillRoundedRect(barX, barY, fillW, 7, 4);
    g.fillStyle(readinessColor, 1);
    g.fillRoundedRect(barX, barY, fillW, 5, 3);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(barX + 2, barY + 1.5, Math.max(4, fillW - 4), 2, 1);

    const chipY = y + 23;
    const chips = [
      { label: '방', value: `${status.builtRooms}/${status.unlockedSlots}`, accent: CASUAL.BLUE, accentDk: CASUAL.BLUE_DK },
      {
        label: '수호',
        value: status.monsterCapacity > 0 ? `${status.assignedMonsters}/${status.monsterCapacity}` : '-',
        accent: CASUAL.RED, accentDk: CASUAL.RED_DK,
      },
      {
        label: '함정',
        value: status.trapCapacity > 0 ? `${status.installedTraps}/${status.trapCapacity}` : '-',
        accent: CASUAL.GOLD, accentDk: CASUAL.GOLD_DK,
      },
    ];
    const chipGap = 4;
    const chipW = (barW - chipGap * (chips.length - 1)) / chips.length;
    chips.forEach((chip, i) => {
      const chipX = barX + i * (chipW + chipGap);
      const chipCss = `#${chip.accentDk.toString(16).padStart(6, '0')}`;
      g.fillStyle(CASUAL.PANEL_SOFT, 1);
      g.fillRoundedRect(chipX, chipY, chipW, 12, 4);
      g.lineStyle(1.5, chip.accent, 0.85);
      g.strokeRoundedRect(chipX, chipY, chipW, 12, 4);
      deck.add(this.add.text(chipX + 4, chipY + 6, chip.label, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      deck.add(this.add.text(chipX + chipW - 4, chipY + 6, chip.value, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: chipCss,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5));
    });
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

  private drawHomeActionQueue(
    deck: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    actions: readonly RoomActionRecommendation[],
  ): number {
    const rowH = 44;
    const chipY = y + 11;
    const chipH = 33;
    const gap = 6;
    const items = actions.slice(0, 3);

    deck.add(this.add.text(x + 2, y + 3, '다음 명령', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    deck.add(this.add.text(x + w - 2, y + 3, items.length > 0 ? `대기 ${items.length}` : '완비', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: items.length > 0 ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    if (items.length === 0) {
      g.fillStyle(CASUAL.SHADOW, 0.2);
      g.fillRoundedRect(x, chipY + 2, w, chipH, 7);
      g.fillStyle(CASUAL.PANEL, 1);
      g.fillRoundedRect(x, chipY, w, chipH, 7);
      g.lineStyle(2, CASUAL.GREEN, 0.85);
      g.strokeRoundedRect(x, chipY, w, chipH, 7);
      g.fillStyle(0xffffff, 0.12);
      g.fillRoundedRect(x + 5, chipY + 3, w - 10, 4, 2);
      deck.add(this.add.text(x + w / 2, chipY + chipH / 2, '모든 방이 다음 침공 준비 완료', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: CASUAL_CSS.GREEN,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      return rowH;
    }

    const chipW = (w - gap * 2) / 3;
    items.forEach((action, i) => {
      const chipX = x + i * (chipW + gap);
      const targetHint = this.getActionTargetHint(action);
      const statLabel = targetHint
        ? `${targetHint} ${action.statValue}`
        : action.statValue;
      const accentCss = `#${action.accent.toString(16).padStart(6, '0')}`;
      const bg = this.add.graphics();
      deck.add(bg);
      const draw = (hover = false): void => {
        bg.clear();
        bg.fillStyle(CASUAL.SHADOW, hover ? 0.28 : 0.2);
        bg.fillRoundedRect(chipX, chipY + 2, chipW, chipH, 7);
        bg.fillStyle(hover ? CASUAL.PANEL_SOFT : CASUAL.PANEL, 1);
        bg.fillRoundedRect(chipX, chipY, chipW, chipH, 7);
        bg.lineStyle(hover ? 2.5 : 2, action.accent, hover ? 1 : 0.85);
        bg.strokeRoundedRect(chipX, chipY, chipW, chipH, 7);
        bg.fillStyle(0xffffff, hover ? 0.45 : 0.35);
        bg.fillRoundedRect(chipX + 4, chipY + 3, chipW - 8, 3, 2);
        bg.fillStyle(action.accent, hover ? 1 : 0.92);
        bg.fillRoundedRect(chipX + 4, chipY + 4, 24, chipH - 8, 6);
        bg.fillStyle(0xffffff, 0.3);
        bg.fillRoundedRect(chipX + 6, chipY + 6, 20, 3, 2);
        bg.fillStyle(action.accent, hover ? 0.32 : 0.22);
        bg.fillRoundedRect(chipX + 32, chipY + 5, chipW - 42, 5, 3);
      };
      draw(false);

      const rankBg = this.add.graphics();
      deck.add(rankBg);
      const drawRank = (hover = false): void => {
        rankBg.clear();
        rankBg.fillStyle(action.accent, hover ? 1 : 0.92);
        rankBg.fillRoundedRect(chipX + chipW - 23, chipY + 5, 18, 14, 5);
        rankBg.lineStyle(1, 0xffffff, hover ? 0.55 : 0.35);
        rankBg.strokeRoundedRect(chipX + chipW - 23, chipY + 5, 18, 14, 5);
      };
      drawRank(false);

      const iconText = this.add.text(chipX + 15.5, chipY + chipH / 2, action.icon, {
        fontFamily: 'sans-serif',
        fontSize: '14px',
      }).setOrigin(0.5);
      const labelText = this.add.text(chipX + 33, chipY + 14, `B${action.slotIdx + 1} ${action.label}`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: accentCss,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const statText = this.add.text(chipX + 33, chipY + 26, statLabel, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: targetHint ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      }).setOrigin(0, 0.5);
      const rankText = this.add.text(chipX + chipW - 14, chipY + 12, String(i + 1), {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: CASUAL_CSS.WHITE,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      deck.add([iconText, labelText, statText, rankText]);

      const zone = this.add.zone(chipX, chipY, chipW, chipH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      deck.add(zone);
      zone.on('pointerover', () => {
        draw(true);
        drawRank(true);
        labelText.setColor(CASUAL_CSS.INK);
      });
      zone.on('pointerout', () => {
        draw(false);
        drawRank(false);
        labelText.setColor(accentCss);
        iconText.setScale(1);
        labelText.setScale(1);
        statText.setScale(1);
        rankText.setScale(1);
      });
      zone.on('pointerdown', () => {
        audioManager.playSfx('button_click');
        this.tweens.add({
          targets: [iconText, labelText, statText, rankText],
          scaleX: 0.92,
          scaleY: 0.92,
          yoyo: true,
          duration: 80,
        });
        this.selectRoomForPlacement(action.slotIdx);
      });
    });

    return rowH;
  }

  private addCommandDeckButton(
    deck: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    icon: string,
    onPress: () => void,
    hint?: HomeCommandButtonHint,
  ): void {
    const bg = this.add.graphics();
    const h = hint ? 40 : 36;
    deck.add(bg);
    // Cream casual button; brightens to PANEL_SOFT on hover, accent border stays.
    const draw = (hover = false): void => {
      bg.clear();
      bg.fillStyle(CASUAL.SHADOW, hover ? 0.28 : 0.2);
      bg.fillRoundedRect(x, y + 3, w, h, 7);
      bg.fillStyle(hover ? CASUAL.PANEL_SOFT : CASUAL.PANEL, 1);
      bg.fillRoundedRect(x, y, w, h, 7);
      bg.lineStyle(hover ? 2.5 : 2, CASUAL.EDGE, hover ? 1 : 0.85);
      bg.strokeRoundedRect(x, y, w, h, 7);
      bg.fillStyle(0xffffff, hover ? 0.5 : 0.4);
      bg.fillRoundedRect(x + 6, y + 4, w - 12, 4, 2);
      if (hint) {
        bg.fillStyle(CASUAL.PANEL_SOFT, 1);
        bg.fillRoundedRect(x + 7, y + h - 9, w - 14, 5, 3);
        bg.fillStyle(hint.accent, hover ? 1 : 0.9);
        bg.fillRoundedRect(x + 7, y + h - 9, w - 14, 5, 3);
      }
    };
    draw(false);

    const iconT = this.add.text(x + 16, y + h / 2, icon, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: CASUAL_CSS.INK,
    }).setOrigin(0.5);
    const labelT = this.add.text(x + 31, y + (hint ? 13 : h / 2), label, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const children: Phaser.GameObjects.GameObject[] = [iconT, labelT];

    let hintT: Phaser.GameObjects.Text | null = null;
    if (hint) {
      hintT = this.add.text(x + 31, y + 27, hint.text, {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      children.push(hintT);
    }

    const zone = this.add.zone(x, y, w, h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    deck.add([...children, zone]);
    zone.on('pointerover', () => {
      draw(true);
      labelT.setColor(CASUAL_CSS.INK);
      hintT?.setColor(CASUAL_CSS.INK);
    });
    zone.on('pointerout', () => {
      draw(false);
      labelT.setColor(CASUAL_CSS.INK);
      hintT?.setColor(CASUAL_CSS.INK_SOFT);
      iconT.setScale(1);
      labelT.setScale(1);
      hintT?.setScale(1);
    });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: children, scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 80 });
      audioManager.playSfx('button_click');
      onPress();
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

  private formatHomeFocusTarget(target: HomeFocusTarget | null, fallback: string): string {
    if (!target) return fallback;
    const visual = this.resolveMonsterVisual(target.monsterId);
    const roomMatch = /^방 #(\d+)/.exec(target.sourceLabel);
    const source = roomMatch ? `B${roomMatch[1]}` : target.sourceLabel;
    return `${source} ${visual.name}`;
  }

  private getActionTargetHint(action: RoomActionRecommendation): string | null {
    if (action.kind !== 'growth') return null;
    const target = action.statLabel === 'E'
      ? this.findUnequippedRoomMonsterTarget(action.slotIdx)
      : this.findUnderleveledRoomMonsterTarget(action.slotIdx)
        ?? this.findFirstRoomMonsterTarget(action.slotIdx);
    return target ? this.resolveMonsterVisual(target.monsterId).name : null;
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
    const col = idx % GRID_COLS_HOME;
    const row = Math.floor(idx / GRID_COLS_HOME);
    const sx = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
    const sy = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
    this.openRoomDetail(idx, sx, sy);
  }

  private navigateFromHome(sceneKey: string): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
  }

  private resolveMonsterVisual(monsterId: string): { emoji: string; name: string } {
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
