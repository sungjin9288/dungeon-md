import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  loadGameState, saveGameState,
  getUnlockedSlots,
} from '../data/wisdom';
import {
  startQuest, updateQuestObjective, completeAndAdvance,
  assignSubQuests, tickSubQuestProgress,
  type MainQuest,
} from '../data/quests';
import { STARTER_BLUEPRINTS } from '../data/fusion';
import { audioManager } from '../audio/AudioManager';
import { TutorialOverlay, TUTORIAL_STEPS, TUTORIAL_DONE } from '../ui/TutorialOverlay';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture, addWaterDrip,
} from '../themes/decorations';
import { logger } from '../utils/logger';
import { openSimulationModal } from '../ui/SimulationModal';
import {
  showQuestCompleteOverlay,
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
  type RoomSlotContext,
  drawBattleSlot as _drawBattleSlot,
  SLOT_W, SLOT_H,
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
const SLOT_PAD_Y = 16;
const QUEST_BANNER_H = 22;
const GRID_START_Y = TOP_H + QUEST_BANNER_H + 10;

function xpForLevel(lv: number): number { return lv * 100; }


export class DungeonHomeScene extends Phaser.Scene {
  private gs = loadGameState();
  private tutorialOverlay: TutorialOverlay | null = null;
  private roomDetailState: RoomDetailState = createRoomDetailState();
  private roomDetailCallbacks: RoomDetailCallbacks = {
    getGameState: () => this.gs,
    saveAndRefresh: () => saveGameState(this.gs),
    rebuildDungeonSlots: () => this.rebuildDungeonSlots(),
  };
  private dungeonContainer: Phaser.GameObjects.Container | null = null;

  // Quest log panel
  private questLogState: QuestLogState = { questLogOpen: false };

  // Invasion state (extracted to InvasionUI.ts)
  private invasionState: InvasionUIState = createInvasionUIState();

  // Currency text refs for live animation
  private currencyTexts: Phaser.GameObjects.Text[] = [];

  // Theme
  private theme!: DungeonTheme;

  constructor() { super({ key: 'DungeonHomeScene' }); }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create(): void {
    this.gs = loadGameState();
    this.theme = getActiveTheme(this.gs.equippedTheme);
    this.buildBackground();

    const topBarRefs: TopBarRefs = buildTopBar(
      this, this.gs, this.theme, TOP_H, this.questLogState, xpForLevel,
    );
    this.currencyTexts = topBarRefs.currencyTexts;

    buildQuestBanner(this, this.gs, this.theme, TOP_H);
    this.buildDungeonGrid();
    buildStatsBar(this, this.gs, this.theme, BOT_Y);
    this.buildBottomNav();
    buildDailyContentPanel(this, () => showChallengePanel(this));
    this.addAmbientEffects();

    // Store gs ref on registry for InvasionUI reminder-icon callback
    this.registry.set('_invasionGs', this.gs);

    this.checkBattleReturn();  // must run before initQuests so rewards applied first
    this.initQuests();
    assignSubQuests(this.gs);
    saveGameState(this.gs);

    const pendingUnlock = this.registry.get('pendingUnlock') as string | undefined;
    if (pendingUnlock) this.registry.remove('pendingUnlock');

    const chapterComplete = this.registry.get('chapterComplete') as boolean | undefined;
    if (chapterComplete) {
      this.registry.remove('chapterComplete');
      setTimeout(() => showChapterCompleteOverlay(this), 800);
    }

    this.cameras.main.fadeIn(250, 0, 0, 0);
    audioManager.resume().then(() => audioManager.playBgm('home'));
    this.maybeShowTutorial();
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
          this.gs.tutorialStage = completedStage;
          saveGameState(this.gs);
          if (completedStage < TUTORIAL_DONE) {
            const nextStep = TUTORIAL_STEPS.find(s => s.stage === completedStage);
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
    if (!this.gs.activeMainQuestId) {
      startQuest(this.gs, 'MQ-001');
      saveGameState(this.gs);
    }
    checkForInvasion(
      this, this.gs, this.invasionState,
      GRID_START_Y, GRID_ROWS_HOME, SLOT_PAD_Y,
    );
  }

  // ─── Battle return ────────────────────────────────────────────────────────────

  private checkBattleReturn(): void {
    const result = this.registry.get('battleResult') as
      { won: boolean; goldEarned: number; dmXP: number; materialsEarned?: Record<string, number> } | undefined;
    if (!result) return;
    this.registry.remove('battleResult');
    this.registry.remove('returnTo');

    const prevGold    = this.gs.homeGold;
    const prevCrystal = this.gs.soulCrystals;
    const prevGems    = this.gs.gems;
    this.gs.homeGold      += result.goldEarned;
    this.gs.dmXP          += result.dmXP;

    // DM level-up loop
    const prevDmLevel = this.gs.dmLevel;
    while (this.gs.dmXP >= xpForLevel(this.gs.dmLevel)) {
      this.gs.dmXP    -= xpForLevel(this.gs.dmLevel);
      this.gs.dmLevel += 1;
    }
    const didLevelUp = this.gs.dmLevel > prevDmLevel;
    this.gs.totalGoldEarned = (this.gs.totalGoldEarned ?? 0) + result.goldEarned;
    updateQuestObjective(this.gs, 'collect_gold', result.goldEarned);
    tickSubQuestProgress(this.gs, 'collect_gold', result.goldEarned);
    updateQuestObjective(this.gs, 'reach_dm_level');
    tickSubQuestProgress(this.gs, 'reach_dm_level');

    if (result.materialsEarned) {
      this.gs.materials = this.gs.materials ?? {};
      Object.entries(result.materialsEarned).forEach(([id, qty]) => {
        this.gs.materials[id] = (this.gs.materials[id] ?? 0) + qty;
      });
    }

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
      const update = updateQuestObjective(this.gs, 'defend_invasion');
      tickSubQuestProgress(this.gs, 'defend_invasion');
      saveGameState(this.gs);
      const afterReturn = () => {
        if (didLevelUp) {
          setTimeout(() => showDmLevelUpOverlay(this, this.gs.dmLevel), 200);
        } else if (update?.questDone) {
          const done = completeAndAdvance(this.gs);
          saveGameState(this.gs);
          if (done) this.handleQuestComplete(done);
        }
      };
      if (update?.questDone && !didLevelUp) {
        const done = completeAndAdvance(this.gs);
        saveGameState(this.gs);
        setTimeout(() => {
          showBattleReturnOverlay(this, result, () => {
            if (done) this.handleQuestComplete(done);
          });
        }, 400);
      } else {
        setTimeout(() => showBattleReturnOverlay(this, result, afterReturn), 400);
      }
    } else {
      saveGameState(this.gs);
      setTimeout(() => showBattleDefeatOverlay(
        this,
        () => showInvasionBanner(
          this, this.invasionState,
          () => goToPreBattle(this, this.gs, this.invasionState),
        ),
      ), 400);
    }
  }

  // ─── Quest completion handling ────────────────────────────────────────────────

  private handleQuestComplete(result: {
    completedQuest: MainQuest;
    nextQuestId: string | null;
    unlocks: string[];
  }): void {
    const isChapterEnd = result.completedQuest.id === 'MQ-010';
    if (result.unlocks.length > 0) this.registry.set('pendingUnlock', result.unlocks[0]);
    if (isChapterEnd) this.registry.set('chapterComplete', true);

    if (result.completedQuest.id === 'MQ-007') {
      this.gs.blueprints = this.gs.blueprints ?? [];
      STARTER_BLUEPRINTS.forEach(bp => {
        if (!this.gs.blueprints.includes(bp)) {
          this.gs.blueprints.push(bp);
          logger.debug(`[FORGE] Blueprint unlocked: ${bp}`);
        }
      });
      saveGameState(this.gs);
    }

    if (result.completedQuest.id === 'MQ-010') {
      this.gs.awakeningStones = (this.gs.awakeningStones ?? 0) + 1;
      saveGameState(this.gs);
      logger.debug(`[AWAKEN] +1 awakening stone (total: ${this.gs.awakeningStones})`);
    }

    if (result.completedQuest.id === 'MQ-015') {
      this.gs.blueprints = this.gs.blueprints ?? [];
      if (!this.gs.blueprints.includes('bp_ore_plate')) {
        this.gs.blueprints.push('bp_ore_plate');
        logger.debug('[FORGE] Blueprint unlocked: bp_ore_plate');
      }
      saveGameState(this.gs);
    }

    if (result.completedQuest.id === 'MQ-020') {
      this.gs.blueprints = this.gs.blueprints ?? [];
      if (!this.gs.blueprints.includes('bp_arcane_core')) {
        this.gs.blueprints.push('bp_arcane_core');
        logger.debug('[FORGE] Blueprint unlocked: bp_arcane_core');
      }
      saveGameState(this.gs);
    }

    showQuestCompleteOverlay(this, result.completedQuest);
  }

  // ─── Room Detail Overlay (delegated to RoomDetailOverlay.ts) ─────────────────

  private openRoomDetail(slotIdx: number, cellX: number, cellY: number): void {
    openRoomDetailOverlay(
      this, this.roomDetailState, this.theme, this.roomDetailCallbacks,
      slotIdx, cellX, cellY,
    );
  }

  // ─── Stone background ────────────────────────────────────────────────────────

  private buildBackground(): void {
    const t  = this.theme;
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(t.bgPrimary, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.lineStyle(1, t.bgSecondary, t.bgGridAlpha);
    for (let y = 0; y < CANVAS_HEIGHT; y += 24) bg.lineBetween(0, y, CANVAS_WIDTH, y);
    bg.lineStyle(1, t.bgSecondary, t.bgGridAlpha * 0.5);
    for (let x = 0; x < CANVAS_WIDTH; x += 48) bg.lineBetween(x, 0, x, CANVAS_HEIGHT);
    drawCaveWallTexture(bg, t, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 42);
  }

  // ─── Dungeon grid ────────────────────────────────────────────────────────────

  private buildDungeonGrid(): void {
    const t  = this.theme;
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(t.bgPrimary, 1);
    bg.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);
    this.add.text(CANVAS_WIDTH / 2, TOP_H + 8, '⚔️  나의 던전  ⚔️', {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: t.textSecondary, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(2);

    // Simulation button
    const simBtnX = CANVAS_WIDTH - 56, simBtnY = TOP_H + 4;
    const simBg = this.add.graphics().setDepth(5);
    simBg.fillStyle(t.panelDark, 1);
    simBg.fillRoundedRect(simBtnX, simBtnY, 50, 22, 4);
    simBg.lineStyle(1, t.panelBorder, 0.7);
    simBg.strokeRoundedRect(simBtnX, simBtnY, 50, 22, 4);
    const simTxt = this.add.text(simBtnX + 25, simBtnY + 11, '⚗ 예측', {
      fontFamily: 'sans-serif', fontSize: '9px', color: t.panelBorderCSS,
    }).setOrigin(0.5).setDepth(6).setInteractive();
    simTxt.on('pointerdown', () => openSimulationModal(this, this.gs, this.theme));

    this.rebuildDungeonSlots();
  }

  private rebuildDungeonSlots(): void {
    if (this.dungeonContainer) this.dungeonContainer.destroy();
    const c = this.add.container(0, 0).setDepth(3);
    this.dungeonContainer = c;

    const unlockedCount = getUnlockedSlots(this.gs.dmLevel);
    logger.debug(`[SLOTS] DM Lv.${this.gs.dmLevel}: ${unlockedCount} slots unlocked`);

    const g = this.add.graphics();
    c.add(g);

    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      for (let col = 0; col < GRID_COLS_HOME; col++) {
        const idx        = row * GRID_COLS_HOME + col;
        const isUnlocked = idx < unlockedCount;
        const sx = SLOT_PAD_X + col * (SLOT_W + SLOT_PAD_X);
        const sy = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y);
        this.drawBattleSlot(c, g, sx, sy, idx, isUnlocked);

        if (isUnlocked) {
          const _sx = sx, _sy = sy, _idx = idx;
          const zone = this.add.zone(sx + SLOT_W / 2, sy + SLOT_H / 2, SLOT_W, SLOT_H)
            .setDepth(10).setInteractive();
          zone.on('pointerdown', () => this.openRoomDetail(_idx, _sx, _sy));
          c.add(zone);
        }
      }
    }

    const synergyCtx: SynergyDrawContext = {
      scene: this, theme: this.theme,
      slots: this.gs.dungeonSlots ?? [],
      gridCols: GRID_COLS_HOME, gridRows: GRID_ROWS_HOME,
      slotW: SLOT_W, slotH: SLOT_H,
      slotPadX: SLOT_PAD_X, slotPadY: SLOT_PAD_Y,
      gridStartY: GRID_START_Y,
    };
    drawSynergyConnectors(synergyCtx, c, unlockedCount);
    drawSynergySummary(synergyCtx, c, CANVAS_WIDTH);
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

  private applyIdleAnimation(
    emoji: Phaser.GameObjects.Text, monsterId: string, _compact = false,
  ): void {
    _applyIdleAnimation(this, emoji, monsterId);
  }

  // ─── Bottom nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const t = this.theme;
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(t.panelDark, 1);
    g.fillRect(0, BOT_Y, CANVAS_WIDTH, BOT_H);
    g.lineStyle(2, t.panelBorder, 0.5);
    g.lineBetween(0, BOT_Y, CANVAS_WIDTH, BOT_Y);

    const tabs = [
      { icon: '🏰', label: '던전',  key: 'home'     },
      { icon: '👹', label: '막사',  key: 'barracks'  },
      { icon: '🔮', label: '소환',  key: 'summon'   },
      { icon: '⚒',  label: '제작',  key: 'forge'    },
      { icon: '⚔️', label: '전투',  key: 'battle'   },
    ];
    const tabW = CANVAS_WIDTH / tabs.length;

    tabs.forEach(({ icon, label, key }, i) => {
      const tx       = i * tabW + tabW / 2;
      const isActive = key === 'home';
      if (isActive) {
        g.fillStyle(t.bgPrimary, 1);
        g.fillRect(i * tabW, BOT_Y + 1, tabW, BOT_H - 1);
        g.lineStyle(2, t.panelBorder, 1);
        g.lineBetween(i * tabW, BOT_Y, (i + 1) * tabW, BOT_Y);
      }
      const iconTxt = this.add.text(tx, BOT_Y + 10, icon, {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5, 0).setDepth(9);
      this.add.text(tx, BOT_Y + 36, label, {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: isActive ? t.panelBorderCSS : t.textSecondary,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5, 0).setDepth(9);
      if (i > 0) {
        g.lineStyle(1, t.stoneDark, 0.5);
        g.lineBetween(i * tabW, BOT_Y + 6, i * tabW, CANVAS_HEIGHT - 6);
      }

      // Badge indicators — red circle at top-right of icon
      const showBadge = (
        (key === 'barracks' && this.gs.ownedMonsters.some(m => (m.skillPoints ?? 0) > 0)) ||
        (key === 'forge'    && (this.gs.awakeningStones ?? 0) > 0)
      );
      if (showBadge) {
        const bx = tx + 12;
        const by = BOT_Y + 8;
        const badgeG = this.add.graphics().setDepth(61);
        badgeG.fillStyle(0xff2222, 1);
        badgeG.fillCircle(bx, by, 5);
        this.add.text(bx, by, '!', {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(62);
      }

      if (!isActive) {
        iconTxt.setInteractive();
        iconTxt.on('pointerdown', () => {
          this.tweens.add({ targets: iconTxt, scaleX: 0.82, scaleY: 0.82, duration: 80, yoyo: true });
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
