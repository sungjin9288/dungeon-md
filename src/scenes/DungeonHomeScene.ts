import Phaser from 'phaser';
import { ROOT_NAV_Y } from '../constants/layout';
import {
  loadGameState, saveGameState,
  type DungeonSlot,
  type GameState,
} from '../data/wisdom';

import { xpForDmLevel } from '../data/invasionTransactions';
import { MONSTER_DEFS, resolveMonsterTypeId } from '../data/monsters';
import {
  type HomeMainQuestCompletionResult,
} from '../data/questLifecycleTransactions';
import { audioManager } from '../audio/AudioManager';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  openQuestLog,
  type QuestLogState,
} from '../ui/QuestLogPanel';
import { buildDailyContentPanel, showChallengePanel } from '../ui/DailyContentPanel';
import { getReducedMotion } from '../utils/reducedMotion';
import {
  createRoomDetailState,
  type RoomDetailState,
  type RoomDetailCallbacks,
} from '../ui/RoomDetailOverlay';
import {
  closePlacementTray,
} from '../ui/DungeonPlacementTray';
import {
  type RoomSlotContext,
} from '../ui/RoomSlotRenderer';
import {
  type InvasionUIState,
  createInvasionUIState,
  goToPreBattle,
} from '../ui/InvasionUI';
import { type DungeonBoardLayout } from '../ui/DungeonBoardLayout';
import { type IdleReward } from '../data/idleIncome';
import {
  type TopBarRefs,
  buildTopBar,
  buildQuestBanner,
  buildStatsBar,
  showChapterCompleteOverlay,
} from '../ui/HomeOverlays';
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
  getRoomActivityColor as _getRoomActivityColor,
  makeRoomSlotCtx as _makeRoomSlotCtx,
} from './HomeRoomCards';
import {
  getRoomActionPin as _getRoomActionPin,
} from './HomeRoomActionPin';
import {
  buildCommandDeck as _buildCommandDeck,
} from './HomeCommandDeck';
import { getZoneDestination } from '../data/navigationContract';
import { buildHomeZoneNavigation } from '../ui/GameZoneNavigation';
import {
  maybeShowIdleIncome as _maybeShowIdleIncome,
  formatIdleDuration as _formatIdleDuration,
  showIdleIncomePanel as _showIdleIncomePanel,
  consumeHomeRoomFeedback as _consumeHomeRoomFeedback,
  showHomeRoomFeedbackBanner as _showHomeRoomFeedbackBanner,
  maybeOpenFocusedDungeonSlot as _maybeOpenFocusedDungeonSlot,
  consumeFocusRoomSlotIdx as _consumeFocusRoomSlotIdx,
  hasPreBattleEditReturn as _hasPreBattleEditReturn,
  resumePreBattleFromRoomEdit as _resumePreBattleFromRoomEdit,
  initQuests as _initQuests,
  settlePendingQuestCompletion as _settlePendingQuestCompletion,
  advanceCompletedQuest as _advanceCompletedQuest,
  handleQuestComplete as _handleQuestComplete,
  checkBattleReturn as _checkBattleReturn,
  revealUnlockedRoom as _revealUnlockedRoom,
  maybeShowTutorial as _maybeShowTutorial,
} from './HomeLifecycle';
import {
  buildBackground as _buildBackground,
  buildDungeonGrid as _buildDungeonGrid,
  rebuildDungeonBlueprintPanel as _rebuildDungeonBlueprintPanel,
  addAmbientEffects as _addAmbientEffects,
  openRoomDetail as _openRoomDetail,
  selectRoomForPlacement as _selectRoomForPlacement,
  addRoomOpenAffordance as _addRoomOpenAffordance,
  addPrimaryRoomActionPin as _addPrimaryRoomActionPin,
  addActionQueueRankMarkers as _addActionQueueRankMarkers,
  addActionQueueRoomSpotlight as _addActionQueueRoomSpotlight,
  addRoomMaintenanceBadges as _addRoomMaintenanceBadges,
  addDungeonActivityLayer as _addDungeonActivityLayer,
  drawDungeonRoomAlcoves as _drawDungeonRoomAlcoves,
} from './HomeChrome';

// ─── Layout constants ──────────────────────────────────────────────────────────

const TOP_H = 64;
const BOT_Y = ROOT_NAV_Y;

function xpForLevel(lv: number): number { return xpForDmLevel(lv); }

interface GameStateResult {
  readonly state: GameState;
  readonly changed: boolean;
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

export class DungeonHomeScene extends Phaser.Scene {
  /** @internal */ gs = loadGameState();
  /** @internal */ tutorialOverlay: TutorialOverlay | null = null;
  /** @internal */ roomDetailState: RoomDetailState = createRoomDetailState();
  /** @internal */ roomDetailCallbacks: RoomDetailCallbacks = {
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
  /** @internal */ dungeonBlueprintContainer: Phaser.GameObjects.Container | null = null;
  /** @internal */ commandDeckContainer: Phaser.GameObjects.Container | null = null;
  /** @internal */ boardLayout!: DungeonBoardLayout;
  /** @internal */ recentlyChangedRoomIdx: number | null = null;
  /** @internal */ selectedRoomIdx: number | null = null;
  /** @internal */ pendingRoomFeedback: HomeRoomFeedback | null = null;
  /** @internal */ roomFocusTransitionActive = false;

  // Quest log panel
  private questLogState: QuestLogState = { questLogOpen: false };

  // Guards duplicate quest-complete overlays when multiple refreshes land in one frame
  /** @internal */ questSettlePending = false;

  // Invasion state (extracted to InvasionUI.ts)
  /** @internal */ invasionState: InvasionUIState = createInvasionUIState();

  // Currency text refs for live animation
  /** @internal */ currencyTexts: Phaser.GameObjects.Text[] = [];
  private topBarRefs: TopBarRefs | null = null;

  // Theme
  /** @internal */ theme!: DungeonTheme;

  constructor() { super({ key: 'DungeonHomeScene' }); }

  /** @internal */ persistGameState(nextState = this.gs): void {
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

  /** @internal */ refreshHomeDynamicPanels(): void {
    this.rebuildDungeonBlueprintPanel();
    this.rebuildDungeonSlots();
    this.buildCommandDeck();
    this.settlePendingQuestCompletion();
  }

  /** @internal */ applyGameStateResult<T extends GameStateResult>(result: T): T {
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

    if (!getReducedMotion()) this.cameras.main.fadeIn(250, 0, 0, 0);
    audioManager.resume().then(() => audioManager.playBgm('home'));
    this.maybeOpenFocusedDungeonSlot();
    this.maybeShowTutorial();
  }

  // ─── Idle (offline) dungeon income ────────────────────────────────────────
  private maybeShowIdleIncome(): void { _maybeShowIdleIncome(this); }

  /** @internal */ formatIdleDuration(ms: number): string { return _formatIdleDuration(this, ms); }

  /** @internal */ showIdleIncomePanel(reward: IdleReward): void { _showIdleIncomePanel(this, reward); }

  private maybeOpenFocusedDungeonSlot(): void { _maybeOpenFocusedDungeonSlot(this); }

  /** @internal */ consumeFocusRoomSlotIdx(): number | null { return _consumeFocusRoomSlotIdx(this); }

  private hasPreBattleEditReturn(): boolean { return _hasPreBattleEditReturn(this); }

  private resumePreBattleFromRoomEdit(): void { _resumePreBattleFromRoomEdit(this); }

  private consumeHomeRoomFeedback(): HomeRoomFeedback | null { return _consumeHomeRoomFeedback(this); }

  private showHomeRoomFeedbackBanner(feedback: HomeRoomFeedback): void { _showHomeRoomFeedbackBanner(this, feedback); }

  // ─── Tutorial ─────────────────────────────────────────────────────────────────

  private maybeShowTutorial(): void { _maybeShowTutorial(this); }

  // ─── Quest system ─────────────────────────────────────────────────────────────

  private initQuests(): void { _initQuests(this); }

  private settlePendingQuestCompletion(): void { _settlePendingQuestCompletion(this); }

  // ─── Battle return ────────────────────────────────────────────────────────────

  private checkBattleReturn(): void { _checkBattleReturn(this); }

  /** @internal */ revealUnlockedRoom(previousSlots: number, nextSlots: number): void { _revealUnlockedRoom(this, previousSlots, nextSlots); }

  // ─── Quest completion handling ────────────────────────────────────────────────

  /** @internal */ advanceCompletedQuest(): HomeMainQuestCompletionResult | null { return _advanceCompletedQuest(this); }

  /** @internal */ handleQuestComplete(result: HomeMainQuestCompletionResult): void { _handleQuestComplete(this, result); }

  // ─── Direct-placement board: select a room → bottom tray ─────────────────────

  /** @internal */ selectRoomForPlacement(slotIdx: number): void { _selectRoomForPlacement(this, slotIdx); }

  // ─── Room Detail Overlay ──────────────────────────────────────────────────────

  /** @internal */ openRoomDetail(slotIdx: number, cellX: number, cellY: number): void { _openRoomDetail(this, slotIdx, cellX, cellY); }

  // ─── Stone background ─────────────────────────────────────────────────────────

  private buildBackground(): void { _buildBackground(this); }

  // ─── Dungeon grid ─────────────────────────────────────────────────────────────

  private buildDungeonGrid(): void { _buildDungeonGrid(this); }

  /** @internal */ rebuildDungeonBlueprintPanel(): void { _rebuildDungeonBlueprintPanel(this); }

  /** @internal */ rebuildDungeonSlots(): void { _rebuildDungeonSlots(this); }

  /** @internal */ addRoomOpenAffordance(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    slotIdx: number,
  ): { setHover: (hover: boolean) => void; pulse: () => void } {
    return _addRoomOpenAffordance(this, c, x, y, slotIdx);
  }

  /** @internal */ addPrimaryRoomActionPin(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addPrimaryRoomActionPin(this, c, unlockedCount); }

  /** @internal */ getRoomActionPin(slotIdx: number): { slotIdx: number; label: string; icon: string; accent: number } | null {
    return _getRoomActionPin(this, slotIdx);
  }

  /** @internal */ addActionQueueRankMarkers(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addActionQueueRankMarkers(this, c, unlockedCount); }

  /** @internal */ addRoomMaintenanceBadges(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addRoomMaintenanceBadges(this, c, unlockedCount); }

  /** @internal */ addDungeonActivityLayer(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addDungeonActivityLayer(this, c, unlockedCount); }

  /** @internal */ drawDungeonRoomAlcoves(
    g: Phaser.GameObjects.Graphics,
    _unlockedCount: number,
  ): void { _drawDungeonRoomAlcoves(this, g, _unlockedCount); }

  /** @internal */ getRoomActivityColor(slot: DungeonSlot): number { return _getRoomActivityColor(this, slot); }

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

  getUnlockedRoute(_unlockedCount: number): readonly number[] { return _getUnlockedRoute(this, _unlockedCount); }

  /** @internal */ addDungeonRouteFlow(
    c: Phaser.GameObjects.Container,
    unlockedCount: number,
  ): void { _addDungeonRouteFlow(this, c, unlockedCount); }

  // ─── Slot helpers ─────────────────────────────────────────────────────────────

  /** @internal */ makeRoomSlotCtx(): RoomSlotContext { return _makeRoomSlotCtx(this); }

  // ─── Command deck ─────────────────────────────────────────────────────────────

  private buildCommandDeck(): void { _buildCommandDeck(this); }

  /** @internal */ openDungeonSlot(idx: number): void {
    const odCell = this.boardLayout.cellsByIdx.get(idx);
    const sx = odCell?.rect.x ?? 0;
    const sy = odCell?.rect.y ?? 0;
    this.openRoomDetail(idx, sx, sy);
  }

  /** @internal */ navigateFromHome(sceneKey: string): void {
    if (getReducedMotion()) {
      this.scene.start(sceneKey);
      return;
    }
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey));
  }

  /** @internal */ resolveMonsterVisual(monsterId: string): { emoji: string; name: string } {
    const baseId = resolveMonsterTypeId(monsterId);
    const def = baseId ? MONSTER_DEFS[baseId] : undefined;
    const name = def?.name ?? '수호자';
    return {
      emoji: def?.emoji ?? '👹',
      name: name.length > 5 ? `${name.slice(0, 4)}…` : name,
    };
  }

  // ─── Bottom nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    buildHomeZoneNavigation(this, 'dungeon', (zone) => {
      this.navigateFromHome(getZoneDestination(zone));
    });
  }

  // ─── Ambient effects ──────────────────────────────────────────────────────────

  private addAmbientEffects(): void { _addAmbientEffects(this); }
}
