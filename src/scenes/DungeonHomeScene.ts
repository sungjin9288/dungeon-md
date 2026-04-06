import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  loadGameState, saveGameState,
  getUnlockedSlots,
} from '../data/wisdom';
import {
  getQuest, startQuest, updateQuestObjective, completeAndAdvance,
  assignSubQuests, tickSubQuestProgress,
  type MainQuest, type InvasionConfig,
} from '../data/quests';
import { STARTER_BLUEPRINTS } from '../data/fusion';
import { audioManager } from '../audio/AudioManager';
import { TutorialOverlay, TUTORIAL_STEPS, TUTORIAL_DONE } from '../ui/TutorialOverlay';
// daily imports used by extracted DailyContentPanel
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture, addWaterDrip,
} from '../themes/decorations';
import { logger } from '../utils/logger';
import { showAudioSettings } from '../ui/AudioSettingsPanel';
import { openSimulationModal } from '../ui/SimulationModal';
import {
  showQuestCompleteOverlay,
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
import { openPrestigeModal, buildPrestigeBadge } from '../ui/PrestigeModal';
import {
  type RoomSlotContext,
  drawBattleSlot as _drawBattleSlot,
  SLOT_W, SLOT_H,
} from '../ui/RoomSlotRenderer';
import { applyIdleAnimation as _applyIdleAnimation } from '../ui/MonsterAnimations';


// ─── Layout constants ──────────────────────────────────────────────────────────

const TOP_H    = 64;
const BOT_H    = 64;
const BOT_Y    = CANVAS_HEIGHT - BOT_H;

// Dungeon grid (3 rows × 3 cols = 9 room slots max)
const GRID_COLS_HOME = 3;
const GRID_ROWS_HOME = 3;

const SLOT_PAD_X = Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1));
const SLOT_PAD_Y = 16;
const GRID_START_Y = TOP_H + 32;

function xpForLevel(lv: number): number { return lv * 100; }


// Trap definitions imported from ../data/traps

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

  // Quest log panel (shared state with extracted QuestLogPanel)
  private questLogState: QuestLogState = { questLogOpen: false };

  // Invasion state
  private invasionConfig?: InvasionConfig;
  private alertBanner?: Phaser.GameObjects.Container;
  private reminderIcon?: Phaser.GameObjects.Text;

  // Theme
  private theme!: DungeonTheme;

  constructor() { super({ key: 'DungeonHomeScene' }); }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create(): void {
    this.gs = loadGameState();
    this.theme = getActiveTheme(this.gs.equippedTheme);
    this.buildBackground();
    this.buildTopBar();
    this.buildDungeonGrid();
    this.buildBottomNav();
    buildDailyContentPanel(this, () => showChallengePanel(this));
    this.addAmbientEffects();
    this.checkBattleReturn();   // must run before initQuests so rewards applied first
    this.initQuests();
    assignSubQuests(this.gs);
    saveGameState(this.gs);

    // Clear pending unlock (animation removed — features accessible via nav tabs)
    const pendingUnlock = this.registry.get('pendingUnlock') as string | undefined;
    if (pendingUnlock) {
      this.registry.remove('pendingUnlock');
    }

    // Chapter 1 complete teaser
    const chapterComplete = this.registry.get('chapterComplete') as boolean | undefined;
    if (chapterComplete) {
      this.registry.remove('chapterComplete');
      setTimeout(() => this.showChapterCompleteOverlay(), 800);
    }

    this.cameras.main.fadeIn(250, 0, 0, 0);

    // Start home BGM (requires user gesture — safe to call here, first tap already happened)
    audioManager.resume().then(() => audioManager.playBgm('home'));

    // Tutorial: show first step for new players (tutorialStage 0 = never started)
    this.maybeShowTutorial();
  }

  // ─── Tutorial ─────────────────────────────────────────────────────────────────

  private maybeShowTutorial(): void {
    const stage = this.gs.tutorialStage ?? 0;
    if (stage >= TUTORIAL_DONE) return;   // already completed

    // Find the next pending step (stage 0 → show step 1)
    const nextStageNum = stage === 0 ? 1 : stage;
    const step = TUTORIAL_STEPS.find(s => s.stage === nextStageNum);
    if (!step) return;

    // Delay slightly so scene fully renders first
    this.time.delayedCall(700, () => {
      if (!this.tutorialOverlay) {
        this.tutorialOverlay = new TutorialOverlay(this, (completedStage) => {
          this.gs.tutorialStage = completedStage;
          saveGameState(this.gs);

          if (completedStage < TUTORIAL_DONE) {
            // Show next step immediately
            const nextStep = TUTORIAL_STEPS.find(s => s.stage === completedStage);
            if (nextStep && this.tutorialOverlay) {
              this.tutorialOverlay.show(nextStep);
            }
          } else {
            // All done — destroy overlay helper
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
    this.checkForInvasion();
  }

  // ─── Battle return ────────────────────────────────────────────────────────

  private checkBattleReturn(): void {
    const result = this.registry.get('battleResult') as
      { won: boolean; goldEarned: number; dmXP: number; materialsEarned?: Record<string, number> } | undefined;
    if (!result) return;
    this.registry.remove('battleResult');
    this.registry.remove('returnTo');

    this.gs.homeGold      += result.goldEarned;
    this.gs.dmXP          += result.dmXP;
    // DM level-up loop
    while (this.gs.dmXP >= xpForLevel(this.gs.dmLevel)) {
      this.gs.dmXP    -= xpForLevel(this.gs.dmLevel);
      this.gs.dmLevel += 1;
    }
    this.gs.totalGoldEarned = (this.gs.totalGoldEarned ?? 0) + result.goldEarned;
    updateQuestObjective(this.gs, 'collect_gold', result.goldEarned);
    tickSubQuestProgress(this.gs, 'collect_gold', result.goldEarned);
    updateQuestObjective(this.gs, 'reach_dm_level');
    tickSubQuestProgress(this.gs, 'reach_dm_level');

    // Apply earned materials
    if (result.materialsEarned) {
      this.gs.materials = this.gs.materials ?? {};
      Object.entries(result.materialsEarned).forEach(([id, qty]) => {
        this.gs.materials[id] = (this.gs.materials[id] ?? 0) + qty;
      });
    }

    if (result.won) {
      const update = updateQuestObjective(this.gs, 'defend_invasion');
      tickSubQuestProgress(this.gs, 'defend_invasion');
      saveGameState(this.gs);
      if (update?.questDone) {
        const done = completeAndAdvance(this.gs);
        saveGameState(this.gs);
        setTimeout(() => {
          this.showBattleReturnOverlay(result, () => {
            if (done) this.handleQuestComplete(done);
          });
        }, 400);
      } else {
        setTimeout(() => this.showBattleReturnOverlay(result, () => {}), 400);
      }
    } else {
      saveGameState(this.gs); // persist gold/XP/materials even on defeat
      setTimeout(() => this.showBattleDefeatOverlay(), 400);
    }
  }

  private showBattleReturnOverlay(
    result: { goldEarned: number; dmXP: number },
    onDismiss: () => void,
  ): void {
    const c = this.add.container(0, 0).setDepth(70);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const PW = 300, PH = 220;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x081a0a, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 8);
    pg.lineStyle(2, 0x22bb55, 0.9);
    pg.strokeRoundedRect(PX, PY, PW, PH, 8);
    c.add(pg);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 28, '침략 격퇴! ✓', {
      fontFamily: 'Georgia, serif', fontSize: '21px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 56, '────────────────────', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#1a4a2a',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 76, [
      `💰  +${result.goldEarned} 골드`,
      `✨  +${result.dmXP} 던전 마스터 XP`,
    ].join('\n'), {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8f0c8',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5, 0));

    const btn = this.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44ff88', fontStyle: 'bold',
      backgroundColor: '#0a2a0a', padding: { x: 32, y: 10 },
    }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', () => { c.destroy(true); onDismiss(); });
    c.add(btn);

    c.setAlpha(0).setScale(0.88);
    this.tweens.add({ targets: c, alpha: 1, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private showBattleDefeatOverlay(): void {
    const c = this.add.container(0, 0).setDepth(70);
    const dim = this.add.graphics();
    dim.fillStyle(0x1a0000, 0.8);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const PW = 300, PH = 200;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x1a0500, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 8);
    pg.lineStyle(2, 0xaa2222, 0.9);
    pg.strokeRoundedRect(PX, PY, PW, PH, 8);
    c.add(pg);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 28, '던전 함락...', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ff4444', fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 66, '수호자들이 물러났습니다.\n다시 방어를 준비하세요.', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8a0a0',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5));

    const btn = this.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '다시 준비하기', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ff6644',
      backgroundColor: '#2a0000', padding: { x: 24, y: 9 },
    }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', () => {
      c.destroy(true);
      setTimeout(() => this.showInvasionBanner(), 300);
    });
    c.add(btn);
  }

  // ─── Invasion alert ───────────────────────────────────────────────────────

  private checkForInvasion(): void {
    const quest = getQuest(this.gs.activeMainQuestId);
    if (!quest?.invasionOnComplete) return;
    const defObj = quest.objectives.find(o => o.type === 'defend_invasion');
    if (!defObj) return;
    const prog    = this.gs.questProgress[quest.id];
    const current = prog?.objectives[defObj.id] ?? 0;
    if (current > 0) return;   // already fought

    this.invasionConfig = quest.invasionOnComplete;
    this.showZoneAPulse();
    setTimeout(() => this.showInvasionBanner(), 1500);
  }

  private showZoneAPulse(): void {
    const overlay = this.add.graphics().setDepth(15);
    let count = 0;
    const ti = setInterval(() => {
      count++;
      overlay.clear();
      if (count % 2 === 1) {
        overlay.fillStyle(0xff0000, 0.22);
        overlay.fillRect(0, GRID_START_Y, CANVAS_WIDTH, GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y));
      }
      if (count >= 6) { clearInterval(ti); overlay.destroy(); }
    }, 450);
  }

  private showInvasionBanner(): void {
    if (this.alertBanner) return;
    const cfg = this.invasionConfig;
    if (!cfg) return;

    const c = this.add.container(0, -110).setDepth(60);

    const bg = this.add.graphics();
    bg.fillStyle(0x660000, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, 104);
    bg.lineStyle(2, 0xc8921a, 0.8);
    bg.lineBetween(0, 104, CANVAS_WIDTH, 104);
    c.add(bg);

    c.add(this.add.text(18, 10, '⚠️  침략 발생!', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ff7755', fontStyle: 'bold',
    }));
    c.add(this.add.text(18, 36, `${cfg.name}이(가) 쳐들어온다!`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0c8a0',
    }));

    const prepBtn = this.add.text(CANVAS_WIDTH - 16, 60, '방어 준비 →', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0e6c8', fontStyle: 'bold',
      backgroundColor: '#8b0000', padding: { x: 10, y: 5 },
    }).setOrigin(1, 0).setInteractive();
    prepBtn.on('pointerdown', () => this.goToPreBattle());
    c.add(prepBtn);

    const laterBtn = this.add.text(16, 62, '잠시 후에', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#886644',
    }).setInteractive();
    laterBtn.on('pointerdown', () => this.dismissBanner());
    c.add(laterBtn);

    this.alertBanner = c;

    // Slide down with setInterval
    let y = -110;
    const ti = setInterval(() => {
      y = Math.min(0, y + 18);
      c.setY(y);
      if (y >= 0) clearInterval(ti);
    }, 28);
  }

  private dismissBanner(): void {
    const banner = this.alertBanner;
    if (!banner) return;
    this.alertBanner = undefined;
    let y = banner.y;
    const ti = setInterval(() => {
      y = Math.max(-110, y - 18);
      banner.setY(y);
      if (y <= -110) { clearInterval(ti); banner.destroy(); this.showReminderIcon(); }
    }, 28);
  }

  private showReminderIcon(): void {
    if (this.reminderIcon) return;
    this.reminderIcon = this.add.text(CANVAS_WIDTH / 2, 72, '🔴  침략 대기 중 — 탭하여 준비', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ff5544',
      backgroundColor: '#2a0000', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(30).setInteractive();
    this.reminderIcon.on('pointerdown', () => {
      this.reminderIcon?.destroy();
      this.reminderIcon = undefined;
      this.showInvasionBanner();
    });
    this.tweens.add({
      targets: this.reminderIcon, alpha: { from: 0.55, to: 1.0 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private goToPreBattle(): void {
    this.alertBanner?.destroy();
    this.alertBanner = undefined;
    this.reminderIcon?.destroy();
    this.reminderIcon = undefined;

    const quest = getQuest(this.gs.activeMainQuestId);
    this.registry.set('invasionConfig', quest?.invasionOnComplete ?? this.invasionConfig);
    this.registry.set('questId', this.gs.activeMainQuestId);

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('PreBattleScene');
    });
  }

  // ─── Room Detail Overlay (delegated to RoomDetailOverlay.ts) ─────────────────

  private openRoomDetail(slotIdx: number, cellX: number, cellY: number): void {
    openRoomDetailOverlay(this, this.roomDetailState, this.theme, this.roomDetailCallbacks, slotIdx, cellX, cellY);
  }

  // ─── (Room detail methods extracted to RoomDetailOverlay.ts) ────────────────

  private handleQuestComplete(result: {
    completedQuest: MainQuest;
    nextQuestId: string | null;
    unlocks: string[];
  }): void {
    const isChapterEnd = result.completedQuest.id === 'MQ-010';
    if (result.unlocks.length > 0) {
      this.registry.set('pendingUnlock', result.unlocks[0]);
    }
    if (isChapterEnd) this.registry.set('chapterComplete', true);

    // MQ-007: award starter blueprints
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

    // MQ-010: award +1 awakening stone
    if (result.completedQuest.id === 'MQ-010') {
      this.gs.awakeningStones = (this.gs.awakeningStones ?? 0) + 1;
      saveGameState(this.gs);
      logger.debug(`[AWAKEN] +1 awakening stone (total: ${this.gs.awakeningStones})`);
    }

    // MQ-015: unlock ore plate blueprint
    if (result.completedQuest.id === 'MQ-015') {
      this.gs.blueprints = this.gs.blueprints ?? [];
      if (!this.gs.blueprints.includes('bp_ore_plate')) {
        this.gs.blueprints.push('bp_ore_plate');
        logger.debug('[FORGE] Blueprint unlocked: bp_ore_plate');
      }
      saveGameState(this.gs);
    }

    // MQ-020: unlock arcane core blueprint
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

  // Quest log panel methods → extracted to ../ui/QuestLogPanel.ts

  // ─── Stone background ────────────────────────────────────────────────────────

  private buildBackground(): void {
    const t  = this.theme;
    const bg = this.add.graphics().setDepth(0);

    // Main cave rock fill
    bg.fillStyle(t.bgPrimary, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Horizontal rock strata lines
    bg.lineStyle(1, t.bgSecondary, t.bgGridAlpha);
    for (let y = 0; y < CANVAS_HEIGHT; y += 24) {
      bg.lineBetween(0, y, CANVAS_WIDTH, y);
    }
    // Subtle vertical fissure lines
    bg.lineStyle(1, t.bgSecondary, t.bgGridAlpha * 0.5);
    for (let x = 0; x < CANVAS_WIDTH; x += 48) {
      bg.lineBetween(x, 0, x, CANVAS_HEIGHT);
    }

    // Sedimentary rock texture overlay
    drawCaveWallTexture(bg, t, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 42);
  }

  // ─── Top bar ──────────────────────────────────────────────────────────────────

  private buildTopBar(): void {
    const t = this.theme;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(t.panelDark, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, TOP_H);
    g.lineStyle(2, t.panelBorder, 1);
    g.lineBetween(0, TOP_H - 1, CANVAS_WIDTH, TOP_H - 1);

    // DM avatar
    g.fillStyle(t.stoneDark, 1);
    g.fillCircle(36, 32, 22);
    g.lineStyle(2, t.panelBorder, 0.8);
    g.strokeCircle(36, 32, 22);
    this.add.text(36, 32, '🏰', {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5).setDepth(6);

    // DM level + XP bar
    this.add.text(66, 12, `던전 마스터  Lv.${this.gs.dmLevel}`, {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: t.panelBorderCSS, fontStyle: 'bold',
    }).setDepth(6);

    const xpBarX = 66, xpBarY = 30, xpBarW = 150, xpBarH = 8;
    const xpPct  = Math.min(this.gs.dmXP / xpForLevel(this.gs.dmLevel), 1);
    g.fillStyle(t.stoneDark, 1);
    g.fillRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
    if (xpPct > 0) {
      g.fillStyle(t.panelBorder, 1);
      g.fillRoundedRect(xpBarX, xpBarY, Math.floor(xpBarW * xpPct), xpBarH, 3);
    }
    g.lineStyle(1, t.stoneMid, 0.7);
    g.strokeRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
    this.add.text(xpBarX + xpBarW / 2, xpBarY + 4, `${this.gs.dmXP} / ${xpForLevel(this.gs.dmLevel)} XP`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: t.textSecondary,
    }).setOrigin(0.5).setDepth(6);

    // 📜 Quest log button
    const questBtn = this.add.text(228, TOP_H / 2, '📜', {
      fontFamily: 'sans-serif', fontSize: '20px',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    questBtn.on('pointerdown', () => openQuestLog(this, this.questLogState, this.gs));

    // ⚙️ Audio settings button
    const settingsBtn = this.add.text(258, TOP_H / 2, '⚙️', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    settingsBtn.on('pointerdown', () => showAudioSettings(this));

    // ✨ New Game+ button — only visible after game completion
    if (this.gs.gameCompleted) {
      const ngBtn = this.add.text(286, TOP_H / 2, '✨', {
        fontFamily: 'sans-serif', fontSize: '18px',
      }).setOrigin(0.5).setDepth(6).setInteractive();
      ngBtn.on('pointerdown', () =>
        openPrestigeModal(this, () => {
          this.gs = loadGameState();
          this.scene.restart();
        }),
      );
      // Prestige badge near title
      if ((this.gs.prestigeLevel ?? 0) > 0) {
        buildPrestigeBadge(this, CANVAS_WIDTH / 2 + 60, TOP_H / 2, this.gs.prestigeLevel ?? 0)
          .setDepth(6);
      }
    }

    // Currencies (right side)
    const currencies = [
      { icon: '💰', val: this.gs.homeGold,      x: CANVAS_WIDTH - 116 },
      { icon: '💠', val: this.gs.soulCrystals,  x: CANVAS_WIDTH - 68  },
      { icon: '💎', val: this.gs.gems,           x: CANVAS_WIDTH - 20  },
    ];
    for (const { icon, val, x } of currencies) {
      this.add.text(x, 10, icon, { fontFamily: 'sans-serif', fontSize: '14px' })
        .setOrigin(0.5, 0).setDepth(6);
      this.add.text(x, 28, String(val), {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#e8d090',
      }).setOrigin(0.5, 0).setDepth(6);
    }
  }

  // ─── Zone A — Battle Arena (6 slots) ─────────────────────────────────────────

  private buildDungeonGrid(): void {
    // Full-area dungeon background
    const t  = this.theme;
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(t.bgPrimary, 1);
    bg.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);
    this.add.text(CANVAS_WIDTH / 2, TOP_H + 8, '⚔️  나의 던전  ⚔️', {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: t.textSecondary, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(2);

    // Simulation button (top-right of grid header)
    const simBtnX = CANVAS_WIDTH - 56;
    const simBtnY = TOP_H + 4;
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

    // Synergy: draw connectors between adjacent same-roomType slots
    this.drawSynergyConnectors(c, g, unlockedCount);

    // Synergy summary row below the grid
    this.drawSynergySummary(c);
  }

  // ─── Synergy connector overlay ────────────────────────────────────────────────

  private drawSynergyConnectors(
    c: Phaser.GameObjects.Container,
    _g: Phaser.GameObjects.Graphics,
    unlockedCount: number,
  ): void {
    const slots = this.gs.dungeonSlots ?? [];
    const SYNERGY_COLOR: Record<string, number> = {
      combat:  0xcc3333,
      trap:    0x884488,
      support: 0x33aa55,
      magic:   0x3366cc,
    };

    // Check all horizontal and vertical adjacent pairs
    const pairs: Array<[number, number]> = [];
    for (let row = 0; row < GRID_ROWS_HOME; row++) {
      for (let col = 0; col < GRID_COLS_HOME; col++) {
        const idx = row * GRID_COLS_HOME + col;
        if (idx >= unlockedCount) continue;
        // Horizontal neighbor
        if (col + 1 < GRID_COLS_HOME) {
          const nIdx = row * GRID_COLS_HOME + (col + 1);
          if (nIdx < unlockedCount) pairs.push([idx, nIdx]);
        }
        // Vertical neighbor
        if (row + 1 < GRID_ROWS_HOME) {
          const nIdx = (row + 1) * GRID_COLS_HOME + col;
          if (nIdx < unlockedCount) pairs.push([idx, nIdx]);
        }
      }
    }

    for (const [aIdx, bIdx] of pairs) {
      const aSlot = slots[aIdx];
      const bSlot = slots[bIdx];
      if (!aSlot?.roomType || !bSlot?.roomType) continue;
      if (aSlot.roomType !== bSlot.roomType) continue;
      if (aSlot.hp <= 0 || bSlot.hp <= 0) continue;

      const aRow = Math.floor(aIdx / GRID_COLS_HOME);
      const aCol = aIdx % GRID_COLS_HOME;
      const bRow = Math.floor(bIdx / GRID_COLS_HOME);
      const bCol = bIdx % GRID_COLS_HOME;

      const ax = SLOT_PAD_X + aCol * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2;
      const ay = GRID_START_Y + aRow * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2;
      const bx = SLOT_PAD_X + bCol * (SLOT_W + SLOT_PAD_X) + SLOT_W / 2;
      const by = GRID_START_Y + bRow * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2;

      const col = SYNERGY_COLOR[aSlot.roomType] ?? 0xffffff;

      // Glow line — drawn with increasing transparency
      const sg = this.add.graphics().setDepth(4);
      sg.lineStyle(6, col, 0.15);
      sg.lineBetween(ax, ay, bx, by);
      sg.lineStyle(3, col, 0.5);
      sg.lineBetween(ax, ay, bx, by);
      sg.lineStyle(1, 0xffffff, 0.4);
      sg.lineBetween(ax, ay, bx, by);
      c.add(sg);

      // Animated pulse dot travelling the line
      const dot = this.add.graphics().setDepth(5);
      dot.fillStyle(col, 0.9);
      dot.fillCircle(0, 0, 3);
      dot.setPosition(ax, ay);
      c.add(dot);
      this.tweens.add({
        targets: dot, x: bx, y: by,
        duration: 1200 + Math.random() * 600,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Math.random() * 800,
      });
    }
  }

  // ─── Synergy summary row ─────────────────────────────────────────────────────

  private drawSynergySummary(c: Phaser.GameObjects.Container): void {
    const slots = this.gs.dungeonSlots ?? [];
    const t = this.theme;

    // Count roomType clusters (adjacent same-type)
    const typeCounts: Record<string, number> = {};
    for (const slot of slots) {
      if (slot?.roomType && slot.hp > 0) {
        typeCounts[slot.roomType] = (typeCounts[slot.roomType] ?? 0) + 1;
      }
    }

    const activeTypes = Object.entries(typeCounts).filter(([, cnt]) => cnt >= 2);
    if (activeTypes.length === 0) return;

    const baseY = GRID_START_Y + GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y) + 4;
    const TYPE_INFO: Record<string, { color: string; icon: string; bonus: string }> = {
      combat:  { color: '#cc5555', icon: '👊', bonus: '몬스터 슬롯+1' },
      trap:    { color: '#aa66cc', icon: '🕸', bonus: '함정피해+20%' },
      support: { color: '#44bb77', icon: '💚', bonus: '인접ATK+15%' },
      magic:   { color: '#5588dd', icon: '🔮', bonus: '쿨다운-20%' },
    };

    let xOff = 8;
    for (const [type, count] of activeTypes) {
      const info = TYPE_INFO[type];
      if (!info) continue;

      const badge = this.add.graphics().setDepth(4);
      badge.fillStyle(t.panelDark, 0.9);
      badge.fillRoundedRect(xOff, baseY, 106, 18, 4);
      badge.lineStyle(1, parseInt(info.color.replace('#', '0x'), 16), 0.7);
      badge.strokeRoundedRect(xOff, baseY, 106, 18, 4);
      c.add(badge);

      c.add(this.add.text(xOff + 5, baseY + 9, `${info.icon} ×${count} ${info.bonus}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: info.color,
      }).setOrigin(0, 0.5).setDepth(5));

      xOff += 112;
      if (xOff + 106 > CANVAS_WIDTH) break;
    }
  }

  // openSimulationModal → extracted to ../ui/SimulationModal.ts

  private makeRoomSlotCtx(): RoomSlotContext {
    return {
      scene: this,
      theme: this.theme,
      gs: this.gs,
      applyIdleAnimation: (emoji, monsterId, compact) => this.applyIdleAnimation(emoji, monsterId, compact),
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

  // ─── Idle animations ────────────────────────────────────────────────────────

  private applyIdleAnimation(emoji: Phaser.GameObjects.Text, monsterId: string, _compact = false): void {
    _applyIdleAnimation(this, emoji, monsterId);
  }


  private showChapterCompleteOverlay(): void {
    const c = this.add.container(0, 0).setDepth(90);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const PW = 340, PH = 280;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x100800, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 10);
    pg.lineStyle(2.5, 0xc8921a, 1);
    pg.strokeRoundedRect(PX, PY, PW, PH, 10);
    c.add(pg);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 30, '✨  Chapter 1  ✨', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 58, '메인 퀘스트 완료!', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#f0e6c8', fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 96, '던전이 더욱 강해졌다.\n연구소가 개방되었습니다.', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8b090',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 148, '─────────────────────', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#3a2810',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 170, '"구미호 계곡에서 이상한 소식이..."', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#806040', fontStyle: 'italic',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 192, '— Chapter 2 티저 —', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
    }).setOrigin(0.5));

    const btn = this.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8921a', fontStyle: 'bold',
      backgroundColor: '#1a0f00', padding: { x: 36, y: 12 },
    }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', () => { c.destroy(true); this.scene.restart(); });
    c.add(btn);

    c.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
  }

  // buildDailyContentPanel + showChallengePanel → extracted to ../ui/DailyContentPanel.ts

  // ─── Bottom nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const t = this.theme;
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(t.panelDark, 1);
    g.fillRect(0, BOT_Y, CANVAS_WIDTH, BOT_H);
    g.lineStyle(2, t.panelBorder, 0.5);
    g.lineBetween(0, BOT_Y, CANVAS_WIDTH, BOT_Y);

    const tabs = [
      { icon: '🏰', label: '던전',   key: 'home'    },
      { icon: '👹', label: '막사',   key: 'barracks' },
      { icon: '🔮', label: '소환',   key: 'summon'  },
      { icon: '⚒',  label: '제작',   key: 'forge'   },
      { icon: '⚔️',  label: '전투',   key: 'battle'  },
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
        fontFamily: 'Georgia, serif', fontSize: '9px',
        color: isActive ? t.panelBorderCSS : t.textSecondary,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5, 0).setDepth(9);
      if (i > 0) {
        g.lineStyle(1, t.stoneDark, 0.5);
        g.lineBetween(i * tabW, BOT_Y + 6, i * tabW, CANVAS_HEIGHT - 6);
      }

      if (!isActive) {
        iconTxt.setInteractive();
        iconTxt.on('pointerdown', () => {
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

  // showAudioSettings + showImportConfirm → extracted to ../ui/AudioSettingsPanel.ts + ../ui/ImportExportModal.ts

  // ─── Torch particles ──────────────────────────────────────────────────────────

  private addAmbientEffects(): void {
    const t = this.theme;
    const gridTop    = GRID_START_Y;
    const gridBottom = GRID_START_Y + GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y);

    // ── Cave decorations ─────────────────────────────────────────────────────
    if (t.decorations.includes('stalactites')) {
      const stalG = this.add.graphics().setDepth(3);
      drawStalactites(stalG, t, gridTop - 6, CANVAS_WIDTH, 42);
      // Also a few at the very top of the screen
      drawStalactites(stalG, t, 0, CANVAS_WIDTH, 99);
    }
    if (t.decorations.includes('stalagmites')) {
      const stalG2 = this.add.graphics().setDepth(3);
      drawStalagmites(stalG2, t, gridBottom + 4, CANVAS_WIDTH, 77);
      // Bottom of screen above nav
      drawStalagmites(stalG2, t, CANVAS_HEIGHT - 64, CANVAS_WIDTH, 55);
    }

    // ── Bioluminescent glow points (replace torches) ─────────────────────────
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

    // ── Water drips ──────────────────────────────────────────────────────────
    if (t.decorations.includes('water_drips')) {
      const dripXs = [45, 130, 220, 310, 365];
      for (const dx of dripXs) {
        addWaterDrip(this, t, dx, gridTop - 2, gridTop + 60, 16);
      }
    }
  }
}
