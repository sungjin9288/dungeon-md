import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  loadGameState, saveGameState, exportGameState, importGameState,
  getUnlockedSlots, SLOT_UNLOCK_LEVELS,
  getRoomSlotCapacity, getMaxRoomLevel, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type RoomSlotType,
} from '../data/wisdom';
import { MONSTER_DEFS, getSkinForMonster } from '../data/monsters';
import {
  getQuest, startQuest, updateQuestObjective, completeAndAdvance,
  assignSubQuests, tickSubQuestProgress, claimSubQuest, getSubQuestById,
  type MainQuest, type InvasionConfig,
} from '../data/quests';
import { STARTER_BLUEPRINTS } from '../data/fusion';
import { audioManager } from '../audio/AudioManager';
import { TutorialOverlay, TUTORIAL_STEPS, TUTORIAL_DONE } from '../ui/TutorialOverlay';
import { getDailyDungeon, getDailyChallenges, getWeeklyBoss, getTodayString, getThisWeekMonday } from '../data/daily';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture, addWaterDrip,
  drawRoughEdgeRect, strokeRoughEdgeRect,
} from '../themes/decorations';
import { CHAPTER_1 } from '../data/stages';
import { simulateDungeon } from '../data/simulation';
import { logger } from '../utils/logger';
import { showToast } from '../ui/Toast';


// ─── Layout constants ──────────────────────────────────────────────────────────

const TOP_H    = 64;
const BOT_H    = 64;
const BOT_Y    = CANVAS_HEIGHT - BOT_H;

// Dungeon grid (3 rows × 3 cols = 9 room slots max)
const GRID_COLS_HOME = 3;
const GRID_ROWS_HOME = 3;

/**
 * Invasion traversal order for each slot (snake path):
 *   Row 0: right→left  (col2=1st, col1=2nd, col0=3rd)
 *   Row 1: left→right  (col0=4th, col1=5th, col2=6th)
 *   Row 2: right→left  (col2=7th, col1=8th, col0=9th)
 * Index = row * GRID_COLS_HOME + col
 */
const INVASION_ORDER = [3, 2, 1, 4, 5, 6, 9, 8, 7];
const SLOT_W     = 100;
const SLOT_H     = 100;
const SLOT_PAD_X = Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1));
const SLOT_PAD_Y = 16;
const GRID_START_Y = TOP_H + 32;

function xpForLevel(lv: number): number { return lv * 100; }


// Trap definitions
const TRAP_DEFS: Array<{ id: string; emoji: string; name: string; cost: number; desc: string; unlockLv: number }> = [
  { id: 'spike_trap',  emoji: '🗡',  name: '가시 덫',   cost:  50, desc: '진입 시 20 피해',           unlockLv: 0  },
  { id: 'slow_trap',   emoji: '🕸',  name: '느림 덫',   cost:  80, desc: '이동속도 -40%, 2초',         unlockLv: 0  },
  { id: 'poison_trap', emoji: '☠️', name: '독 덫',     cost: 120, desc: '8 피해/초, 4초',             unlockLv: 6  },
  { id: 'stun_trap',   emoji: '⚡',  name: '감전 덫',   cost: 200, desc: '기절 1초',                   unlockLv: 10 },
];

export class DungeonHomeScene extends Phaser.Scene {
  private gs = loadGameState();
  private tutorialOverlay: TutorialOverlay | null = null;
  private roomDetailContainer: Phaser.GameObjects.Container | null = null;
  private roomDetailCellX    = 0;
  private roomDetailCellY    = 0;
  private dungeonContainer: Phaser.GameObjects.Container | null = null;
  private trapPickerContainer: Phaser.GameObjects.Container | null = null;
  private monsterPickerContainer: Phaser.GameObjects.Container | null = null;

  // Quest log panel
  private questLogContainer?: Phaser.GameObjects.Container;
  private questLogOpen = false;

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
    this.buildDailyContentPanel();
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

  // ─── Room Detail Overlay ──────────────────────────────────────────────────────

  private openRoomDetail(slotIdx: number, cellX: number, cellY: number): void {
    if (this.roomDetailContainer) return;

    // Store cell position for reopen after upgrade/assignment
    this.roomDetailCellX   = cellX;
    this.roomDetailCellY   = cellY;

    this.gs.dungeonSlots = this.gs.dungeonSlots ?? [];
    if (!this.gs.dungeonSlots[slotIdx]) {
      const cap = getRoomSlotCapacity(1);
      this.gs.dungeonSlots[slotIdx] = {
        monsterIds: Array(cap.monsters).fill(undefined),
        trapIds:    Array(cap.traps).fill(undefined),
        roomLevel: 1, hp: 200, maxHp: 200,
      };
      updateQuestObjective(this.gs, 'build_room');
      tickSubQuestProgress(this.gs, 'build_room');
      saveGameState(this.gs);
    }
    // Ensure arrays are sized to current capacity (handles upgrades)
    const slot: DungeonSlot = this.gs.dungeonSlots[slotIdx];
    {
      const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      if (!Array.isArray(slot.monsterIds)) slot.monsterIds = Array(cap.monsters).fill(undefined);
      if (!Array.isArray(slot.trapIds))    slot.trapIds    = Array(cap.traps).fill(undefined);
      while (slot.monsterIds.length < cap.monsters) slot.monsterIds.push(undefined);
      while (slot.trapIds.length    < cap.traps)    slot.trapIds.push(undefined);
    }
    logger.debug(`[ROOM] Opening detail for slot ${slotIdx} Lv.${slot.roomLevel}`);

    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
    const c = this.add.container(CW / 2, CH / 2).setDepth(100).setAlpha(0);
    this.roomDetailContainer = c;

    // ── Cave chamber background ─────────────────────────────────────────────────
    const t  = this.theme;
    const bg = this.add.graphics();
    bg.fillStyle(t.stoneDark, 1);
    bg.fillRect(-CW / 2, -CH / 2, CW, CH);
    // Rock strata lines
    bg.lineStyle(1, t.stoneMid, 0.25);
    for (let ty = -CH / 2; ty < CH / 2; ty += 24) bg.lineBetween(-CW / 2, ty, CW / 2, ty);
    bg.lineStyle(1, t.stoneMid, 0.12);
    for (let tx = -CW / 2; tx < CW / 2; tx += 32) bg.lineBetween(tx, -CH / 2, tx, CH / 2);
    drawCaveWallTexture(bg, t, -CW / 2, -CH / 2, CW, CH, 99);
    // Cave wall edges
    bg.fillStyle(t.bgPrimary, 0.6);
    bg.fillRect(-CW / 2, -CH / 2, 14, CH);
    bg.fillRect(CW / 2 - 14, -CH / 2, 14, CH);
    // Stalactites at top, stalagmites at bottom
    drawStalactites(bg, t, -CH / 2 + 44, CW, 55);
    drawStalagmites(bg, t, CH / 2, CW, 66);
    c.add(bg);

    // ── Header ────────────────────────────────────────────────────────────────
    const headerH = 44;
    const hdrG = this.add.graphics();
    hdrG.fillStyle(t.panelDark, 1);
    hdrG.fillRect(-CW / 2, -CH / 2, CW, headerH);
    hdrG.lineStyle(1, t.panelBorder, 0.5);
    hdrG.lineBetween(-CW / 2, -CH / 2 + headerH, CW / 2, -CH / 2 + headerH);
    c.add(hdrG);

    const backBtn = this.add.text(-CW / 2 + 16, -CH / 2 + headerH / 2, '← 나가기', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: t.panelBorderCSS,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.closeRoomDetail());
    c.add(backBtn);

    const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
    const typeLabel = typeDef ? `${typeDef.icon} ${typeDef.name}` : '🏚 일반실';
    c.add(this.add.text(0, -CH / 2 + headerH / 2,
      `방 #${slotIdx + 1}  ${typeLabel}  ${'★'.repeat(slot.roomLevel)}`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: t.textPrimary,
    }).setOrigin(0.5));

    // ── Bioluminescent glow dots (replace torches) ────────────────────────────
    const glowG = this.add.graphics();
    for (const tx of [-CW / 2 + 18, CW / 2 - 18]) {
      glowG.fillStyle(t.glowColor, 0.15);
      glowG.fillCircle(tx, -CH / 2 + headerH + 14, 12);
      glowG.fillStyle(t.glowColor, 0.35);
      glowG.fillCircle(tx, -CH / 2 + headerH + 14, 5);
    }
    c.add(glowG);

    // ── Layout constants ──────────────────────────────────────────────────────
    const secPad = 14;
    const secX   = -CW / 2 + secPad;
    const secW   = CW - secPad * 2;
    const typeStripY = -CH / 2 + headerH + 10;

    // ── Room Type Selector strip ───────────────────────────────────────────────
    const typeStripH = this.buildRoomTypeStrip(c, slot, slotIdx, secX, secW, typeStripY);
    const monSecY = typeStripY + typeStripH + 6;

    // ── Monster Section ───────────────────────────────────────────────────────
    const monSecH = this.buildMonsterSection(c, slot, slotIdx, secX, secW, monSecY);

    // ── Trap Section ──────────────────────────────────────────────────────────
    const trapSecY = monSecY + monSecH + 8;
    const trapSecH = this.buildTrapSection(c, slot, slotIdx, secX, secW, trapSecY);

    // ── Durability bar ────────────────────────────────────────────────────────
    const durY    = trapSecY + trapSecH + 10;
    const hpPct   = Math.max(0, slot.hp / slot.maxHp);
    const barW    = secW - 80;
    const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? 0xc8921a : 0x8b0000;
    const durG = this.add.graphics();
    durG.fillStyle(0x0e0900, 1);
    durG.fillRoundedRect(secX + 40, durY, barW, 10, 3);
    durG.fillStyle(barColor, 1);
    durG.fillRoundedRect(secX + 40, durY, barW * hpPct, 10, 3);
    durG.lineStyle(1, 0x664400, 0.4);
    durG.strokeRoundedRect(secX + 40, durY, barW, 10, 3);
    c.add(durG);
    c.add(this.add.text(secX + 36, durY + 5, '내구도', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#664400',
    }).setOrigin(1, 0.5));
    c.add(this.add.text(secX + 40 + barW + 4, durY + 5, `${slot.hp}/${slot.maxHp}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(0, 0.5));

    // ── Repair button (only when damaged) ────────────────────────────────────
    const repairY = durY + 18;
    if (slot.hp < slot.maxHp) {
      const missingHp  = slot.maxHp - slot.hp;
      const repairCost = Math.max(10, Math.ceil(missingHp / slot.maxHp * 80));
      const canRepair  = this.gs.homeGold >= repairCost;
      const repairBtn  = this.add.text(
        secX + secW / 2, repairY,
        `🔧 수리  (${repairCost}g)  HP +${missingHp}`, {
          fontFamily: 'Georgia, serif', fontSize: '10px',
          color: canRepair ? '#88cc44' : '#664400',
          backgroundColor: '#0e0900', padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: canRepair });
      if (canRepair) {
        repairBtn.on('pointerover', () => repairBtn.setColor('#bbff66'));
        repairBtn.on('pointerout',  () => repairBtn.setColor('#88cc44'));
        repairBtn.on('pointerdown', () => {
          this.gs.homeGold -= repairCost;
          slot.hp = slot.maxHp;
          saveGameState(this.gs);
          logger.debug(`[REPAIR] slot ${slotIdx}: restored to ${slot.maxHp} HP (cost ${repairCost}g)`);
          this.closeRoomDetail();
          setTimeout(() => this.openRoomDetail(slotIdx, cellX, cellY), 150);
        });
      }
      c.add(repairBtn);
    }

    // ── Upgrade button (capped by DM level) ──────────────────────────────────
    const maxRoomLv = getMaxRoomLevel(this.gs.dmLevel);
    const upgY = slot.hp < slot.maxHp ? repairY + 26 : durY + 22;
    if (slot.roomLevel < 5 && slot.roomLevel < maxRoomLv) {
      const ROOM_UPGRADE_COSTS = [150, 300, 600, 1200, 2400];
      const ROOM_UPGRADE_HP    = [300, 450, 650, 900, 1200];
      const upgCost = ROOM_UPGRADE_COSTS[slot.roomLevel - 1] ?? 1200;
      const nextHp  = ROOM_UPGRADE_HP[slot.roomLevel] ?? 1200;
      const newCap  = getRoomSlotCapacity(slot.roomLevel + 1, slot.roomType);
      const cdBonus = ['-10%', '-20%', '-30%', '-40%'][slot.roomLevel - 1] ?? '-40%';
      const upgBtn  = this.add.text(secX + secW / 2, upgY,
        `업그레이드  Lv.${slot.roomLevel}→${slot.roomLevel + 1}  (${upgCost}g)  몬스터 ${newCap.monsters} / 함정 ${newCap.traps}`, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8921a',
          backgroundColor: '#1e1206', padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      upgBtn.on('pointerover', () => upgBtn.setColor('#ffe080'));
      upgBtn.on('pointerout',  () => upgBtn.setColor('#c8921a'));
      upgBtn.on('pointerdown', () => {
        if (this.gs.homeGold < upgCost) return;
        this.gs.homeGold  -= upgCost;
        slot.roomLevel    += 1;
        slot.maxHp         = nextHp;
        slot.hp            = nextHp;
        // Expand slot arrays to new capacity
        const cap2 = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
        while (slot.monsterIds.length < cap2.monsters) slot.monsterIds.push(undefined);
        while (slot.trapIds.length    < cap2.traps)    slot.trapIds.push(undefined);
        updateQuestObjective(this.gs, 'upgrade_room');
        tickSubQuestProgress(this.gs, 'upgrade_room');
        saveGameState(this.gs);
        logger.debug(`[ROOM UPGRADE] slot ${slotIdx}: Lv.${slot.roomLevel - 1}→Lv.${slot.roomLevel}  HP: ${slot.maxHp - 100}→${slot.maxHp}, cooldown bonus: ${cdBonus}`);
        this.closeRoomDetail();
        setTimeout(() => this.openRoomDetail(slotIdx, cellX, cellY), 250);
      });
      c.add(upgBtn);
    } else if (slot.roomLevel < 5 && slot.roomLevel >= maxRoomLv) {
      // Blocked by DM level
      const neededDm = [5, 10, 15, 20][slot.roomLevel - 1] ?? 20;
      c.add(this.add.text(secX + secW / 2, upgY,
        `🔒 DM Lv.${neededDm} 달성 후 업그레이드 가능`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#664400',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(secX + secW / 2, upgY, '✨ 최고 레벨 (Lv.5)', {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ffe080',
      }).setOrigin(0.5));
    }

    // ── Expand animation from cell ─────────────────────────────────────────────
    const startScaleX = SLOT_W / CW;
    const startScaleY = SLOT_H / CH;
    const startX      = cellX + SLOT_W / 2 - CW / 2;
    const startY      = cellY + SLOT_H / 2 - CH / 2;
    c.setPosition(CW / 2 + startX, CH / 2 + startY).setScale(startScaleX, startScaleY);

    const STEPS = 15;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const t    = step / STEPS;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      c.setAlpha(ease)
       .setScale(startScaleX + (1 - startScaleX) * ease, startScaleY + (1 - startScaleY) * ease)
       .setPosition(CW / 2 + startX * (1 - ease), CH / 2 + startY * (1 - ease));
      if (step >= STEPS) {
        clearInterval(iv);
        c.setScale(1).setPosition(CW / 2, CH / 2).setAlpha(1);
      }
    }, 20);
  }

  // ─── Room Type Strip ──────────────────────────────────────────────────────────

  private buildRoomTypeStrip(
    c: Phaser.GameObjects.Container,
    slot: DungeonSlot, slotIdx: number,
    secX: number, secW: number, secY: number,
  ): number {
    const stripH = 42;
    const bg = this.add.graphics();
    bg.fillStyle(0x130c04, 0.95);
    bg.fillRoundedRect(secX, secY, secW, stripH, 6);
    bg.lineStyle(1, 0x3a2010, 0.4);
    bg.strokeRoundedRect(secX, secY, secW, stripH, 6);
    c.add(bg);

    const btnW = (secW - 4) / 4;
    ROOM_SLOT_TYPE_DEFS.forEach((td, i) => {
      const bx   = secX + 2 + i * btnW;
      const isActive = slot.roomType === td.id;
      const btnBg = this.add.graphics();
      btnBg.fillStyle(isActive ? 0xc8921a : 0x241208, isActive ? 0.9 : 0.6);
      btnBg.fillRoundedRect(bx + 1, secY + 4, btnW - 2, stripH - 8, 4);
      c.add(btnBg);
      c.add(this.add.text(bx + btnW / 2, secY + 14, td.icon, {
        fontFamily: 'sans-serif', fontSize: '14px',
      }).setOrigin(0.5));
      c.add(this.add.text(bx + btnW / 2, secY + 30, td.name, {
        fontFamily: 'Georgia, serif', fontSize: '8px',
        color: isActive ? '#0e0900' : '#806040',
      }).setOrigin(0.5));

      const zone = this.add.zone(bx + btnW / 2, secY + stripH / 2, btnW - 2, stripH - 8)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        slot.roomType = td.id as RoomSlotType;
        // Resize arrays to new capacity
        const newCap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
        while (slot.monsterIds.length < newCap.monsters) slot.monsterIds.push(undefined);
        while (slot.trapIds.length    < newCap.traps)    slot.trapIds.push(undefined);
        saveGameState(this.gs);
        this.closeRoomDetail();
        setTimeout(() => this.openRoomDetail(slotIdx, this.roomDetailCellX, this.roomDetailCellY), 100);
      });
      c.add(zone);
    });

    return stripH;
  }

  // ─── Monster Section (multi-slot) ────────────────────────────────────────────

  private buildMonsterSection(
    c: Phaser.GameObjects.Container,
    slot: DungeonSlot, slotIdx: number,
    secX: number, secW: number, secY: number,
  ): number {
    const cap    = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    const rowH   = 58;   // per monster slot row
    const secH   = 26 + cap.monsters * rowH;

    const bg = this.add.graphics();
    bg.fillStyle(0x241208, 1);
    bg.fillRoundedRect(secX, secY, secW, secH, 8);
    bg.lineStyle(1.5, 0xc8921a, 0.4);
    bg.strokeRoundedRect(secX, secY, secW, secH, 8);
    c.add(bg);

    c.add(this.add.text(secX + 12, secY + 8, `👊 몬스터 구역`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
    }));
    c.add(this.add.text(secX + secW - 12, secY + 8, `${cap.monsters}슬롯`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(1, 0));

    for (let mi = 0; mi < cap.monsters; mi++) {
      const rowY   = secY + 24 + mi * rowH;
      const mId    = slot.monsterIds[mi];
      const om     = mId ? this.gs.ownedMonsters.find(m => m.id === mId) : null;
      const typeId = om ? (Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id) : null;
      const mDef   = typeId ? MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] : null;

      // Row separator
      if (mi > 0) {
        const sepG = this.add.graphics();
        sepG.lineStyle(1, 0x3a2010, 0.3);
        sepG.lineBetween(secX + 8, rowY - 1, secX + secW - 8, rowY - 1);
        c.add(sepG);
      }

      // Slot number badge
      c.add(this.add.text(secX + 10, rowY + rowH / 2, `${mi + 1}`, {
        fontFamily: 'monospace', fontSize: '9px', color: '#4a3020',
      }).setOrigin(0.5));

      if (mDef && om) {
        c.add(this.add.text(secX + 30, rowY + rowH / 2, mDef.emoji, {
          fontFamily: 'sans-serif', fontSize: '28px',
        }).setOrigin(0.5));
        c.add(this.add.text(secX + 50, rowY + 8, `${mDef.name}  Lv.${om.level}`, {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e8d090',
        }));
        c.add(this.add.text(secX + 50, rowY + 22, `ATK:${mDef.baseDamage}  CD:${(mDef.attackCooldown/1000).toFixed(1)}s`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#a07040',
        }));
        c.add(this.add.text(secX + 50, rowY + 34, mDef.passiveDesc, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
          fontStyle: 'italic',
        }));
        this.makeDetailBtn(c, secX + secW - 14, rowY + rowH / 2, '교체', () => {
          this.showMonsterPicker(slotIdx, mi);
        });
        // Remove button
        this.makeDetailBtn(c, secX + secW - 48, rowY + rowH / 2, '제거', () => {
          slot.monsterIds[mi] = undefined;
          saveGameState(this.gs);
          this.closeRoomDetail();
          setTimeout(() => this.openRoomDetail(slotIdx, this.roomDetailCellX, this.roomDetailCellY), 250);
        });
      } else {
        c.add(this.add.text(secX + 30, rowY + rowH / 2, '👤', {
          fontFamily: 'sans-serif', fontSize: '22px',
        }).setOrigin(0.5).setAlpha(0.3));
        c.add(this.add.text(secX + 50, rowY + rowH / 2 - 6, `슬롯 ${mi + 1} — 비어있음`, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4a3020',
        }));
        this.makeDetailBtn(c, secX + secW - 14, rowY + rowH / 2, '배치 →', () => {
          this.showMonsterPicker(slotIdx, mi);
        });
      }
    }

    return secH;
  }

  // ─── Trap Section (multi-slot) ───────────────────────────────────────────────

  private buildTrapSection(
    c: Phaser.GameObjects.Container,
    slot: DungeonSlot, slotIdx: number,
    secX: number, secW: number, secY: number,
  ): number {
    const cap  = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    const rowH = 58;
    const secH = 26 + cap.traps * rowH;

    const bg = this.add.graphics();
    bg.fillStyle(0x0f0f0f, 1);
    bg.fillRoundedRect(secX, secY, secW, secH, 8);
    bg.lineStyle(1.5, 0x664400, 0.4);
    bg.strokeRoundedRect(secX, secY, secW, secH, 8);
    c.add(bg);

    c.add(this.add.text(secX + 12, secY + 8, `🕸 함정 구역`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#885500',
    }));
    c.add(this.add.text(secX + secW - 12, secY + 8, `${cap.traps}슬롯`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(1, 0));

    for (let ti = 0; ti < cap.traps; ti++) {
      const rowY = secY + 24 + ti * rowH;
      const trap = TRAP_DEFS.find(t => t.id === slot.trapIds[ti]);

      if (ti > 0) {
        const sepG = this.add.graphics();
        sepG.lineStyle(1, 0x3a2010, 0.3);
        sepG.lineBetween(secX + 8, rowY - 1, secX + secW - 8, rowY - 1);
        c.add(sepG);
      }

      c.add(this.add.text(secX + 10, rowY + rowH / 2, `${ti + 1}`, {
        fontFamily: 'monospace', fontSize: '9px', color: '#4a3020',
      }).setOrigin(0.5));

      if (trap) {
        c.add(this.add.text(secX + 30, rowY + rowH / 2, trap.emoji, {
          fontFamily: 'sans-serif', fontSize: '26px',
        }).setOrigin(0.5));
        c.add(this.add.text(secX + 50, rowY + 8, trap.name, {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
        }));
        c.add(this.add.text(secX + 50, rowY + 22, `효과: ${trap.desc}`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#a07040',
        }));
        this.makeDetailBtn(c, secX + secW - 14, rowY + rowH / 2, '교체', () => {
          this.showTrapPicker(slotIdx, ti);
        });
        this.makeDetailBtn(c, secX + secW - 48, rowY + rowH / 2, '제거', () => {
          slot.trapIds[ti] = undefined;
          const refund = Math.floor(trap.cost * 0.5);
          this.gs.homeGold += refund;
          saveGameState(this.gs);
          logger.debug(`[TRAP] slot ${slotIdx}[${ti}] removed, refund: ${refund}g`);
          this.closeRoomDetail();
          setTimeout(() => this.openRoomDetail(slotIdx, this.roomDetailCellX, this.roomDetailCellY), 250);
        });
      } else {
        c.add(this.add.text(secX + 30, rowY + rowH / 2, '🔧', {
          fontFamily: 'sans-serif', fontSize: '20px',
        }).setOrigin(0.5).setAlpha(0.3));
        c.add(this.add.text(secX + 50, rowY + rowH / 2 - 6, `슬롯 ${ti + 1} — 비어있음`, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4a3020',
        }));
        this.makeDetailBtn(c, secX + secW - 14, rowY + rowH / 2, '설치 →', () => {
          this.showTrapPicker(slotIdx, ti);
        });
      }
    }

    return secH;
  }

  private makeDetailBtn(
    c: Phaser.GameObjects.Container,
    x: number, y: number,
    label: string,
    cb: () => void,
  ): void {
    const btn = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#e8d090',
      backgroundColor: '#2a1806', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffe080'));
    btn.on('pointerout',  () => btn.setColor('#e8d090'));
    btn.on('pointerdown', cb);
    c.add(btn);
  }

  private closeRoomDetail(): void {
    if (this.trapPickerContainer)   { this.trapPickerContainer.destroy();   this.trapPickerContainer   = null; }
    if (this.monsterPickerContainer) { this.monsterPickerContainer.destroy(); this.monsterPickerContainer = null; }
    if (!this.roomDetailContainer) return;
    const c = this.roomDetailContainer;
    this.roomDetailContainer = null;

    const STEPS = 10;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const t = step / STEPS;
      c.setAlpha(1 - t).setScale(1 - t * 0.3);
      if (step >= STEPS) {
        clearInterval(iv);
        c.destroy();
        this.rebuildDungeonSlots();   // ← step 8: update grid cell visuals
      }
    }, 20);
  }

  // ─── Trap Picker Modal ────────────────────────────────────────────────────────

  private showTrapPicker(slotIdx: number, trapSlotIdx: number): void {
    if (this.trapPickerContainer) { this.trapPickerContainer.destroy(); this.trapPickerContainer = null; }

    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
    const modalH = 240;
    const c = this.add.container(0, CH).setDepth(110);  // starts offscreen bottom
    this.trapPickerContainer = c;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0900, 1);
    bg.fillRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
    bg.lineStyle(1, 0xc8921a, 0.5);
    bg.strokeRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
    c.add(bg);

    c.add(this.add.text(CW / 2, 16, '함정 선택', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
    }).setOrigin(0.5, 0));

    const closeBtn = this.add.text(CW - 14, 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#664422',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { this.trapPickerContainer?.destroy(); this.trapPickerContainer = null; });
    c.add(closeBtn);

    let rowY = 44;
    TRAP_DEFS.forEach(trap => {
      const locked = this.gs.dmLevel < trap.unlockLv;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(locked ? 0x0a0900 : 0x1a0f00, 1);
      rowBg.fillRect(8, rowY, CW - 16, 42);
      rowBg.lineStyle(1, locked ? 0x332200 : 0x664400, 0.4);
      rowBg.lineBetween(8, rowY + 42, CW - 8, rowY + 42);
      c.add(rowBg);

      const alpha = locked ? 0.4 : 1;
      c.add(this.add.text(28, rowY + 12, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5).setAlpha(alpha));
      c.add(this.add.text(48, rowY + 7, `${trap.name}`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: locked ? '#4a3020' : '#c8921a',
      }).setOrigin(0, 0));
      c.add(this.add.text(48, rowY + 22, trap.desc, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
      }).setOrigin(0, 0).setAlpha(alpha));

      const costLabel = locked ? `🔒 Lv.${trap.unlockLv} 해금` : `${trap.cost}g`;
      if (locked) {
        c.add(this.add.text(CW - 20, rowY + 14, costLabel, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
        }).setOrigin(1, 0.5));
      } else {
        const pickBtn = this.add.text(CW - 20, rowY + 14, `${trap.cost}g  [선택]`, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#e8d090',
          backgroundColor: '#2a1806', padding: { x: 6, y: 3 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        pickBtn.on('pointerdown', () => {
          if (this.gs.homeGold < trap.cost) {
            logger.debug(`[TRAP] not enough gold (need ${trap.cost}g)`);
            return;
          }
          // Refund existing trap if replacing
          const sl = this.gs.dungeonSlots[slotIdx]!;
          const existingId = sl.trapIds?.[trapSlotIdx];
          if (existingId) {
            const old = TRAP_DEFS.find(t => t.id === existingId);
            if (old) { this.gs.homeGold += Math.floor(old.cost * 0.5); }
          }
          this.gs.homeGold -= trap.cost;
          if (!Array.isArray(sl.trapIds)) sl.trapIds = [];
          sl.trapIds[trapSlotIdx] = trap.id;
          saveGameState(this.gs);
          logger.debug(`[TRAP] slot ${slotIdx}[${trapSlotIdx}]: ${trap.id} installed, cost: ${trap.cost}g`);
          this.trapPickerContainer?.destroy();
          this.trapPickerContainer = null;
          this.closeRoomDetail();
          setTimeout(() => this.openRoomDetail(slotIdx, this.roomDetailCellX, this.roomDetailCellY), 250);
        });
        c.add(pickBtn);
      }
      rowY += 44;
    });

    // Slide up animation
    const targetY = CH - modalH;
    const startY  = CH;
    const STEPS   = 12;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const t    = step / STEPS;
      const ease = 1 - Math.pow(1 - t, 2);
      c.setPosition(0, startY + (targetY - startY) * ease);
      if (step >= STEPS) { clearInterval(iv); c.setPosition(0, targetY); }
    }, 16);
  }

  // ─── Monster Picker Modal ─────────────────────────────────────────────────────

  private showMonsterPicker(slotIdx: number, monsterSlotIdx = 0): void {
    if (this.monsterPickerContainer) { this.monsterPickerContainer.destroy(); this.monsterPickerContainer = null; }

    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
    const monsters = this.gs.ownedMonsters;
    const rowH  = 52;
    const modalH = Math.min(48 + monsters.length * rowH, CH - 100);

    const c = this.add.container(0, CH).setDepth(110);
    this.monsterPickerContainer = c;

    const bg = this.add.graphics();
    bg.fillStyle(0x0e0900, 1);
    bg.fillRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
    bg.lineStyle(1, 0xc8921a, 0.5);
    bg.strokeRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
    c.add(bg);

    c.add(this.add.text(CW / 2, 16, '몬스터 선택', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
    }).setOrigin(0.5, 0));

    const closeBtn = this.add.text(CW - 14, 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#664422',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { this.monsterPickerContainer?.destroy(); this.monsterPickerContainer = null; });
    c.add(closeBtn);

    let rowY = 44;
    monsters.forEach(om => {
      const omTypeId = Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id;
      const mDef = MONSTER_DEFS[omTypeId as keyof typeof MONSTER_DEFS];
      if (!mDef) return;

      const isAssigned = this.gs.dungeonSlots?.some((s, i) =>
        i !== slotIdx && (s?.monsterIds ?? []).includes(om.id),
      );

      const rowBg = this.add.graphics();
      rowBg.fillStyle(isAssigned ? 0x0a0900 : 0x1a0f00, 1);
      rowBg.fillRect(8, rowY, CW - 16, rowH - 4);
      rowBg.lineStyle(1, 0x3a2010, 0.4);
      rowBg.lineBetween(8, rowY + rowH - 4, CW - 8, rowY + rowH - 4);
      c.add(rowBg);

      c.add(this.add.text(28, rowY + rowH / 2 - 8, mDef.emoji, {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5));
      c.add(this.add.text(50, rowY + 8, `${mDef.name}  Lv.${om.level}`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: isAssigned ? '#4a3020' : '#e8d090',
      }));
      c.add(this.add.text(50, rowY + 24, `ATK: ${mDef.baseDamage}  ${mDef.passiveDesc}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
      }));

      if (isAssigned) {
        c.add(this.add.text(CW - 20, rowY + rowH / 2 - 8, '배치됨', {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
        }).setOrigin(1, 0.5));
      } else {
        const pickBtn = this.add.text(CW - 20, rowY + rowH / 2 - 8, '[배치]', {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8921a',
          backgroundColor: '#2a1806', padding: { x: 6, y: 3 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        pickBtn.on('pointerdown', () => {
          // Remove this monster from any other slot it was in
          this.gs.dungeonSlots?.forEach(s => {
            if (!s?.monsterIds) return;
            const idx = s.monsterIds.indexOf(om.id);
            if (idx !== -1) s.monsterIds[idx] = undefined;
          });
          if (!this.gs.dungeonSlots[slotIdx]) {
            const cap = getRoomSlotCapacity(1);
            this.gs.dungeonSlots[slotIdx] = {
              monsterIds: Array(cap.monsters).fill(undefined),
              trapIds:    Array(cap.traps).fill(undefined),
              roomLevel: 1, hp: 200, maxHp: 200,
            };
          }
          this.gs.dungeonSlots[slotIdx]!.monsterIds[monsterSlotIdx] = om.id;
          saveGameState(this.gs);
          logger.debug(`[ROOM] slot ${slotIdx}[${monsterSlotIdx}]: ${mDef.name} (${om.id}) assigned`);
          this.monsterPickerContainer?.destroy();
          this.monsterPickerContainer = null;
          this.closeRoomDetail();
          setTimeout(() => this.openRoomDetail(slotIdx, this.roomDetailCellX, this.roomDetailCellY), 250);
        });
        c.add(pickBtn);
      }
      rowY += rowH;
    });

    // Slide up
    const targetY = CH - modalH;
    const STEPS   = 12;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const t    = step / STEPS;
      const ease = 1 - Math.pow(1 - t, 2);
      c.setPosition(0, CH + (targetY - CH) * ease);
      if (step >= STEPS) { clearInterval(iv); c.setPosition(0, targetY); }
    }, 16);
  }

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

    this.showQuestCompleteOverlay(result.completedQuest);
  }

  // ─── Quest Complete overlay ──────────────────────────────────────────────────

  private showQuestCompleteOverlay(quest: MainQuest): void {
    const c = this.add.container(0, 0).setDepth(80);

    // Dim
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setInteractive();
    c.add(dim);

    // Panel
    const PW = 320, PH = 240;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x1a0f00, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 8);
    pg.lineStyle(2, 0xc8921a, 1);
    pg.strokeRoundedRect(PX, PY, PW, PH, 8);
    c.add(pg);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 26, '퀘스트 완료!', {
      fontFamily: 'Georgia, serif', fontSize: '22px',
      color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 56, quest.title, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0e6c8',
    }).setOrigin(0.5));

    // Rewards
    const lines: string[] = [];
    if (quest.reward.gold)         lines.push(`💰  +${quest.reward.gold} 골드`);
    if (quest.reward.soulCrystals) lines.push(`💠  +${quest.reward.soulCrystals} 수정`);
    if (quest.reward.dmXP)         lines.push(`✨  +${quest.reward.dmXP} XP`);
    if (quest.reward.monsters?.length)  lines.push(`👹  ${quest.reward.monsters[0]}`);
    if (quest.reward.unlocks?.length)   lines.push(`🔓  ${quest.reward.unlocks[0]} 해금`);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 84, lines.join('\n'), {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8b090',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0));

    // Confirm button
    const confirmBtn = this.add.text(CANVAS_WIDTH / 2, PY + PH - 40, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '15px',
      color: '#c8921a', fontStyle: 'bold',
      backgroundColor: '#2a1800', padding: { x: 32, y: 10 },
    }).setOrigin(0.5).setInteractive();

    const dismiss = () => { c.destroy(true); this.scene.restart(); };
    confirmBtn.on('pointerdown', dismiss);
    dim.on('pointerdown', dismiss);
    c.add(confirmBtn);

    c.setScale(0.85).setAlpha(0);
    this.tweens.add({
      targets: c, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 220, ease: 'Back.easeOut',
    });
  }

  // ─── Quest log panel ─────────────────────────────────────────────────────────

  private openQuestLog(): void {
    if (this.questLogOpen) return;
    this.questLogOpen = true;
    this.questLogContainer?.destroy();
    this.questLogContainer = this.buildQuestLogContainer();
    // Slide in with setInterval (reliable at 15fps preview, unlike Phaser tweens)
    let x = CANVAS_WIDTH;
    const step = Math.ceil(CANVAS_WIDTH / 7);
    const ti = setInterval(() => {
      x = Math.max(0, x - step);
      this.questLogContainer?.setX(x);
      if (x <= 0) clearInterval(ti);
    }, 30);
  }

  private closeQuestLog(): void {
    if (!this.questLogOpen) return;
    this.questLogOpen = false;
    const container = this.questLogContainer;
    this.questLogContainer = undefined;
    let x = container?.x ?? 0;
    const step = Math.ceil(CANVAS_WIDTH / 7);
    const ti = setInterval(() => {
      x = Math.min(CANVAS_WIDTH, x + step);
      container?.setX(x);
      if (x >= CANVAS_WIDTH) {
        clearInterval(ti);
        container?.destroy();
      }
    }, 30);
  }

  private buildQuestLogContainer(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(50);

    // Full-screen background
    const bg = this.add.graphics();
    bg.fillStyle(0x080500, 0.97);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.lineStyle(2, 0xc8921a, 0.35);
    bg.lineBetween(0, 0, 0, CANVAS_HEIGHT);
    c.add(bg);

    // Header bar
    const hg = this.add.graphics();
    hg.fillStyle(0x0d0800, 1);
    hg.fillRect(0, 0, CANVAS_WIDTH, 48);
    hg.lineStyle(1, 0xc8921a, 0.4);
    hg.lineBetween(0, 48, CANVAS_WIDTH, 48);
    c.add(hg);

    c.add(this.add.text(CANVAS_WIDTH / 2, 24, '퀘스트 로그', {
      fontFamily: 'Georgia, serif', fontSize: '16px',
      color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5));

    const closeBtn = this.add.text(CANVAS_WIDTH - 14, 12, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#664422',
    }).setOrigin(1, 0).setInteractive();
    closeBtn.on('pointerdown', () => this.closeQuestLog());
    c.add(closeBtn);

    let y = 56;
    y = this.drawMainQuestCard(c, y);
    y = this.drawSubQuestSection(c, y);
    this.drawMiniQuestSection(c, y);

    // Tap outside (left strip) to close
    // Tap dim bg behind to close
    bg.setInteractive();
    bg.on('pointerdown', () => this.closeQuestLog());

    return c;
  }

  // ─── Active main quest card ───────────────────────────────────────────────────

  private drawMainQuestCard(c: Phaser.GameObjects.Container, y: number): number {
    const PAD    = 12;
    const CARD_W = CANVAS_WIDTH - PAD * 2;

    c.add(this.add.text(PAD, y, '📜  메인 퀘스트', {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: '#c8921a', fontStyle: 'bold', letterSpacing: 1,
    }));
    y += 20;

    const quest = this.gs.activeMainQuestId
      ? getQuest(this.gs.activeMainQuestId)
      : null;

    if (!quest) {
      const eg = this.add.graphics();
      eg.fillStyle(0x140c04, 1);
      eg.fillRoundedRect(PAD, y, CARD_W, 50, 6);
      eg.lineStyle(1, 0x664422, 0.4);
      eg.strokeRoundedRect(PAD, y, CARD_W, 50, 6);
      c.add(eg);
      c.add(this.add.text(CANVAS_WIDTH / 2, y + 25, '진행 중인 메인 퀘스트 없음', {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#4a3020',
      }).setOrigin(0.5));
      return y + 62;
    }

    const prog     = this.gs.questProgress[quest.id];
    const objCount = quest.objectives.length;
    const CARD_H   = 74 + objCount * 28 + 24;

    // Card background
    const cg = this.add.graphics();
    cg.fillStyle(0x1a0f00, 1);
    cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    cg.lineStyle(1.5, 0xc8921a, 0.7);
    cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    // Status dot (yellow = in progress)
    cg.fillStyle(0xffcc00, 1);
    cg.fillCircle(PAD + CARD_W - 12, y + 14, 5);
    c.add(cg);

    // Quest ID + title
    c.add(this.add.text(PAD + 10, y + 8, `[${quest.id}]`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }));
    c.add(this.add.text(PAD + 58, y + 8, quest.title, {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#f0e6c8', fontStyle: 'bold',
    }));

    // NPC emoji + first line of description
    c.add(this.add.text(PAD + 10, y + 28, quest.npcEmoji, {
      fontFamily: 'sans-serif', fontSize: '18px',
    }));
    const descLine = quest.description.split('\n')[0];
    c.add(this.add.text(PAD + 36, y + 30, `"${descLine}"`, {
      fontFamily: 'Georgia, serif', fontSize: '10px',
      color: '#a08060', fontStyle: 'italic',
      wordWrap: { width: CARD_W - 50 },
    }));

    // Objectives
    let oy = y + 54;
    quest.objectives.forEach(obj => {
      const cur   = prog?.objectives[obj.id] ?? 0;
      const pct   = Math.min(cur / obj.target, 1);
      const BAR_W = 90;

      c.add(this.add.text(PAD + 10, oy, `▸ ${obj.description}`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8b090',
      }));

      const bg2 = this.add.graphics();
      bg2.fillStyle(0x0a0600, 1);
      bg2.fillRoundedRect(CANVAS_WIDTH - PAD - BAR_W - 10, oy, BAR_W, 11, 2);
      if (pct > 0) {
        bg2.fillStyle(0xc8921a, 1);
        bg2.fillRoundedRect(CANVAS_WIDTH - PAD - BAR_W - 10, oy, Math.floor(BAR_W * pct), 11, 2);
      }
      bg2.lineStyle(0.5, 0x664400, 0.6);
      bg2.strokeRoundedRect(CANVAS_WIDTH - PAD - BAR_W - 10, oy, BAR_W, 11, 2);
      c.add(bg2);

      c.add(this.add.text(CANVAS_WIDTH - PAD - 6, oy + 5, `${cur}/${obj.target}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
      }).setOrigin(1, 0.5));

      oy += 26;
    });

    // Reward preview
    const rwds: string[] = [];
    if (quest.reward.gold)         rwds.push(`💰${quest.reward.gold}`);
    if (quest.reward.soulCrystals) rwds.push(`💠${quest.reward.soulCrystals}`);
    if (quest.reward.dmXP)         rwds.push(`✨${quest.reward.dmXP}XP`);
    if (quest.reward.unlocks?.length) rwds.push(`🔓${quest.reward.unlocks[0]}`);
    c.add(this.add.text(PAD + 10, oy + 4, `보상: ${rwds.join('  ')}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }));

    return y + CARD_H + 14;
  }

  // ─── Sub quest section ────────────────────────────────────────────────────────

  private drawSubQuestSection(c: Phaser.GameObjects.Container, y: number): number {
    const PAD    = 12;
    const CARD_W = CANVAS_WIDTH - PAD * 2;
    const CARD_H = 62;

    c.add(this.add.text(PAD, y, '⚔️  서브 퀘스트', {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: '#a08060', fontStyle: 'bold',
    }));
    y += 20;

    const sqIds = this.gs.activeSubQuestIds ?? [];

    if (sqIds.length === 0) {
      const eg = this.add.graphics();
      eg.fillStyle(0x120a02, 1);
      eg.fillRoundedRect(PAD, y, CARD_W, 44, 6);
      eg.lineStyle(1, 0x5a3c1c, 0.45);
      eg.strokeRoundedRect(PAD, y, CARD_W, 44, 6);
      c.add(eg);
      c.add(this.add.text(CANVAS_WIDTH / 2, y + 22, '모든 서브 퀘스트 완료! 내일 다시 도전하세요.', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#806040',
      }).setOrigin(0.5));
      return y + 56;
    }

    sqIds.forEach(sqId => {
      const sq = getSubQuestById(sqId);
      if (!sq) return;

      const prog   = this.gs.subQuestProgress?.[sqId] ?? 0;
      const done   = prog >= sq.objective.target;
      const pct    = Math.min(prog / sq.objective.target, 1);
      const BAR_W  = 100;
      const borderCol = done ? 0xffcc44 : 0x5a3c1c;
      const borderAlpha = done ? 0.9 : 0.45;

      const cg = this.add.graphics();
      cg.fillStyle(done ? 0x1a1200 : 0x120a02, 1);
      cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
      cg.lineStyle(done ? 1.5 : 1, borderCol, borderAlpha);
      cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
      c.add(cg);

      // Icon + title
      c.add(this.add.text(PAD + 10, y + 10, `${sq.icon} ${sq.title}`, {
        fontFamily: 'Georgia, serif', fontSize: '12px',
        color: done ? '#ffcc44' : '#c8b090', fontStyle: 'bold',
      }));

      // Objective description
      c.add(this.add.text(PAD + 10, y + 26, sq.objective.description, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
      }));

      // Progress bar
      const bx = PAD + 10;
      const by = y + 40;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x0a0600, 1);
      barBg.fillRoundedRect(bx, by, BAR_W, 10, 2);
      if (pct > 0) {
        barBg.fillStyle(done ? 0xffcc00 : 0xc8921a, 1);
        barBg.fillRoundedRect(bx, by, Math.floor(BAR_W * pct), 10, 2);
      }
      barBg.lineStyle(0.5, 0x664400, 0.6);
      barBg.strokeRoundedRect(bx, by, BAR_W, 10, 2);
      c.add(barBg);

      // Progress text
      c.add(this.add.text(bx + BAR_W + 6, by + 5, `${prog}/${sq.objective.target}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
      }).setOrigin(0, 0.5));

      // Reward preview
      const rwds: string[] = [];
      if (sq.reward.gold)         rwds.push(`💰${sq.reward.gold}`);
      if (sq.reward.soulCrystals) rwds.push(`💠${sq.reward.soulCrystals}`);
      if (sq.reward.dmXP)         rwds.push(`✨${sq.reward.dmXP}XP`);
      c.add(this.add.text(CANVAS_WIDTH - PAD - 10, y + 26, rwds.join(' '), {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#c8921a',
      }).setOrigin(1, 0.5));

      // Claim button (only when done)
      if (done) {
        const btnW = 52;
        const btnX = CANVAS_WIDTH - PAD - 10 - btnW;
        const btnY = y + 38;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x8a6200, 1);
        btnBg.fillRoundedRect(btnX, btnY, btnW, 16, 4);
        c.add(btnBg);
        const btnTxt = this.add.text(btnX + btnW / 2, btnY + 8, '완료!  수령', {
          fontFamily: 'Georgia, serif', fontSize: '9px', color: '#fff9e0', fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive();
        btnTxt.on('pointerdown', () => {
          const claimed = claimSubQuest(this.gs, sqId);
          if (!claimed) return;
          saveGameState(this.gs);
          // Rebuild quest log
          this.questLogContainer?.destroy();
          this.questLogContainer = undefined;
          this.questLogContainer = this.buildQuestLogContainer();
        });
        c.add(btnTxt);
      }

      y += CARD_H + 10;
    });

    return y + 4;
  }

  // ─── Mini quest (daily) section ───────────────────────────────────────────────

  private drawMiniQuestSection(c: Phaser.GameObjects.Container, y: number): void {
    const PAD    = 12;
    const CARD_W = CANVAS_WIDTH - PAD * 2;

    c.add(this.add.text(PAD, y, '🎯  일일 퀘스트', {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: '#a08060', fontStyle: 'bold',
    }));
    y += 20;

    const challenges = getDailyChallenges();
    const today      = getTodayString();
    // Reset stale challenge data if date changed
    if (this.gs.dailyChallengeDate !== today) {
      this.gs.dailyChallenges    = {};
      this.gs.dailyChallengeDate = today;
    }
    const CARD_H = 16 + challenges.length * 26 + 20;

    const cg = this.add.graphics();
    cg.fillStyle(0x0e0700, 1);
    cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    cg.lineStyle(1, 0x4a3010, 0.5);
    cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    c.add(cg);

    let dy = y + 10;
    let allDone = true;
    challenges.forEach(ch => {
      const state   = this.gs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
      const done    = state.completed;
      const prog    = Math.min(state.progress, ch.objective.target);
      if (!done) allDone = false;

      const checkmark = done ? '✓' : '□';
      const col       = done ? '#44cc88' : '#7a5a3a';
      c.add(this.add.text(PAD + 10, dy, `${checkmark}  ${ch.description}`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: col,
      }));
      const rwdStr = ch.reward.gems ? `💎${ch.reward.gems}` : '';
      c.add(this.add.text(CANVAS_WIDTH - PAD - 10, dy, done ? '완료' : `${prog}/${ch.objective.target}  ${rwdStr}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: done ? '#44cc88' : '#5a3c1c',
      }).setOrigin(1, 0));
      dy += 26;
    });

    // Summary footer
    const completedCount = challenges.filter(ch => (this.gs.dailyChallenges[ch.id]?.completed ?? false)).length;
    c.add(this.add.text(PAD + 10, dy + 2, `${completedCount}/${challenges.length} 완료`, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: allDone ? '#44cc88' : '#5a3c1c',
    }));
    const totalGems = challenges.reduce((sum, ch) => sum + (ch.reward.gems ?? 0), 0);
    c.add(this.add.text(CANVAS_WIDTH - PAD - 10, dy + 2, `총 보상: 💎${totalGems}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(1, 0));
  }

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
    questBtn.on('pointerdown', () => this.openQuestLog());

    // ⚙️ Audio settings button
    const settingsBtn = this.add.text(258, TOP_H / 2, '⚙️', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    settingsBtn.on('pointerdown', () => this.showAudioSettings());

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
    simTxt.on('pointerdown', () => this.openSimulationModal());

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

  // ─── Simulation modal ────────────────────────────────────────────────────────

  private openSimulationModal(): void {
    const t = this.theme;
    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;

    // Overlay dim
    const dim = this.add.graphics().setDepth(200);
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, CW, CH);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });

    // Card
    const cw = 340, ch = 430;
    const cx = (CW - cw) / 2, cy = (CH - ch) / 2;
    const card = this.add.graphics().setDepth(201);
    card.fillStyle(t.panelDark, 1);
    card.fillRoundedRect(cx, cy, cw, ch, 8);
    card.lineStyle(2, t.panelBorder, 0.9);
    card.strokeRoundedRect(cx, cy, cw, ch, 8);
    // Cave strata texture
    for (let ry = cy + 8; ry < cy + ch; ry += 18) {
      card.lineStyle(1, t.stoneLight, 0.03 + Math.random() * 0.03);
      card.lineBetween(cx + 4, ry, cx + cw - 4, ry);
    }
    card.setY(-60).setAlpha(0);
    this.tweens.add({ targets: card, y: 0, alpha: 1, duration: 300, ease: 'Power2.easeOut' });

    const container = this.add.container(0, 0).setDepth(202);
    container.add([dim, card]);

    // Title
    const title = this.add.text(cx + cw / 2, cy + 22, '⚗  던전 전투 예측', {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: t.panelBorderCSS,
    }).setOrigin(0.5).setAlpha(0);
    container.add(title);
    this.tweens.add({ targets: title, alpha: 1, duration: 250, delay: 150 });

    // Run simulation vs Chapter 1 Stage 1
    const stageWaves = CHAPTER_1[0].waves;
    const startHp    = CHAPTER_1[0].dungeonHp;
    const result     = simulateDungeon(
      this.gs.dungeonSlots ?? [],
      this.gs.ownedMonsters ?? [],
      stageWaves,
      startHp,
    );

    // DPS row
    const dpsColor = result.totalDps < 8 ? '#ff6666' : result.totalDps < 18 ? '#ffcc44' : '#44cc88';
    const dpsT = this.add.text(cx + 16, cy + 50,
      `던전 총 DPS:  ${result.totalDps.toFixed(1)} / 초`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: dpsColor,
    }).setAlpha(0);
    container.add(dpsT);
    this.tweens.add({ targets: dpsT, alpha: 1, duration: 200, delay: 200 });

    // Win % bar
    const barY = cy + 74;
    const barW = cw - 32;
    const wpct = result.winPct / 100;
    const barBg = this.add.graphics().setAlpha(0).setDepth(202);
    barBg.fillStyle(t.stoneDark, 1);
    barBg.fillRoundedRect(cx + 16, barY, barW, 10, 3);
    const barFill = this.add.graphics().setAlpha(0).setDepth(202);
    const fillColor = wpct >= 0.7 ? 0x44cc88 : wpct >= 0.4 ? 0xddcc00 : 0xcc2200;
    barFill.fillStyle(fillColor, 1);
    barFill.fillRoundedRect(cx + 16, barY, barW * wpct, 10, 3);
    const pctT = this.add.text(cx + cw / 2, barY + 5, `예상 생존율  ${result.winPct}%`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0).setDepth(203);
    container.add([barBg, barFill, pctT]);
    this.tweens.add({ targets: [barBg, barFill, pctT], alpha: 1, duration: 200, delay: 280 });

    // Divider
    const divG = this.add.graphics().setAlpha(0).setDepth(202);
    divG.lineStyle(1, t.panelBorder, 0.3);
    divG.lineBetween(cx + 16, barY + 18, cx + cw - 16, barY + 18);
    container.add(divG);
    this.tweens.add({ targets: divG, alpha: 1, duration: 150, delay: 320 });

    // Per-wave results (compact rows)
    const waveStartY = barY + 26;
    const rowH = 22;
    const DIFF_COLOR: Record<string, string> = {
      easy: '#44cc88', medium: '#88ccff', hard: '#ffcc44', extreme: '#ff6666',
    };
    const DIFF_LABEL: Record<string, string> = {
      easy: '쉬움', medium: '보통', hard: '어려움', extreme: '위험',
    };

    result.waveResults.slice(0, 10).forEach((wr, i) => {
      const wy = waveStartY + i * rowH;
      const rowT = this.add.text(cx + 16, wy + 11, `${wr.waveNum}웨이브`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: t.textSecondary,
      }).setOrigin(0, 0.5).setAlpha(0).setDepth(202);
      container.add(rowT);

      const diffT = this.add.text(cx + 80, wy + 11,
        `${DIFF_LABEL[wr.difficulty]} (생존 ${wr.survived}/${wr.invaderCount})`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: DIFF_COLOR[wr.difficulty],
      }).setOrigin(0, 0.5).setAlpha(0).setDepth(202);
      container.add(diffT);

      const hpLostT = this.add.text(cx + cw - 16, wy + 11,
        wr.hpLost > 0 ? `-${wr.hpLost}HP` : '무피해', {
        fontFamily: 'sans-serif', fontSize: '9px',
        color: wr.hpLost > 0 ? '#ff8888' : '#44cc88',
      }).setOrigin(1, 0.5).setAlpha(0).setDepth(202);
      container.add(hpLostT);

      this.tweens.add({ targets: [rowT, diffT, hpLostT], alpha: 1, duration: 150, delay: 370 + i * 40 });
    });

    // Recommendation
    const recY = waveStartY + 10 * rowH + 4;
    const recG = this.add.graphics().setAlpha(0).setDepth(202);
    recG.lineStyle(1, t.panelBorder, 0.3);
    recG.lineBetween(cx + 16, recY, cx + cw - 16, recY);
    container.add(recG);
    const recT = this.add.text(cx + cw / 2, recY + 14, `💡 ${result.recommendation}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: t.panelBorderCSS,
    }).setOrigin(0.5).setAlpha(0).setDepth(202);
    container.add(recT);
    this.tweens.add({ targets: [recG, recT], alpha: 1, duration: 200, delay: 780 });

    // Close button
    const closeY = cy + ch - 28;
    const closeT = this.add.text(cx + cw / 2, closeY, '✕  닫기', {
      fontFamily: 'sans-serif', fontSize: '11px', color: t.textSecondary,
    }).setOrigin(0.5).setDepth(203).setInteractive();
    container.add(closeT);
    closeT.on('pointerdown', () => {
      this.tweens.add({ targets: [dim, card, container], alpha: 0, duration: 200,
        onComplete: () => { dim.destroy(); card.destroy(); container.destroy(); },
      });
    });
  }

  private drawBattleSlot(
    c: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    index: number, unlocked: boolean,
  ): void {
    const t = this.theme;
    if (!unlocked) {
      // Dark cave alcove — locked
      drawRoughEdgeRect(g, t.slotLocked, 0.7, x, y, SLOT_W, SLOT_H, index * 17);
      strokeRoughEdgeRect(g, t.stoneDark, 0.3, 1, x, y, SLOT_W, SLOT_H, index * 17);
      // X-chain pattern
      g.lineStyle(2, t.stoneMid, 0.3);
      g.lineBetween(x + 20, y + 20, x + SLOT_W - 20, y + SLOT_H - 20);
      g.lineBetween(x + SLOT_W - 20, y + 20, x + 20, y + SLOT_H - 20);
      const cx = x + SLOT_W / 2;
      const cy = y + SLOT_H / 2;
      c.add(this.add.text(cx, cy - 8, '🔒', { fontSize: '22px' }).setOrigin(0.5).setAlpha(0.5));
      const reqLv = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
      c.add(this.add.text(cx, cy + 16, `Lv.${reqLv} 해금`, {
        fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
      }).setOrigin(0.5));
      return;
    }

    const slot = this.gs.dungeonSlots?.[index];

    // ── 파손 방: HP=0 특수 표시 ────────────────────────────────────────────────
    if (slot && slot.hp <= 0) {
      g.fillStyle(0x1a0000, 1);
      g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 6);
      g.lineStyle(2, 0x8b0000, 0.8);
      g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 6);
      // Crack lines
      g.lineStyle(2, 0xff2222, 0.6);
      g.lineBetween(x + 18, y + 8,  x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4);
      g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + SLOT_W - 14, y + SLOT_H - 6);
      g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + 10, y + SLOT_H - 14);
      const cx = x + SLOT_W / 2;
      c.add(this.add.text(cx, y + SLOT_H / 2 - 10, '💥', { fontFamily: 'sans-serif', fontSize: '22px' }).setOrigin(0.5).setAlpha(0.75));
      c.add(this.add.text(cx, y + SLOT_H / 2 + 12, '파손', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ff4444',
      }).setOrigin(0.5));
      c.add(this.add.text(cx, y + SLOT_H - 10, '수리 필요', {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#884444',
      }).setOrigin(0.5));
      // Invasion order badge
      const order = INVASION_ORDER[index];
      if (order !== undefined) {
        const bg2 = this.add.graphics();
        bg2.fillStyle(0x8b0000, 0.7);
        bg2.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
        c.add(bg2);
        c.add(this.add.text(x + 10, y + 9, String(order), { fontFamily: 'monospace', fontSize: '9px', color: '#ff8888' }).setOrigin(0.5));
      }
      return;
    }

    const primaryMonsterId = slot?.monsterIds?.[0];
    const monDef = primaryMonsterId
      ? (() => {
          const om = this.gs.ownedMonsters.find(m => m.id === primaryMonsterId);
          if (!om) return null;
          const typeId = Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id;
          return MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] ?? null;
        })()
      : null;
    const primaryTrapId = slot?.trapIds?.[0];
    const trapDef = primaryTrapId ? TRAP_DEFS.find(t => t.id === primaryTrapId) : null;
    // Extra occupied monster count for badge
    const extraMonsterCount = Math.max(0, (slot?.monsterIds ?? []).filter(Boolean).length - 1);

    if (monDef) {
      // ── Occupied cell: cave alcove with rough edges ────────────────────────
      drawRoughEdgeRect(g, t.slotFill, 1, x, y, SLOT_W, SLOT_H, index * 17);
      const inset = 6;
      g.fillStyle(t.stoneDark, 0.65);
      g.fillRoundedRect(x + inset, y + inset, SLOT_W - inset * 2, SLOT_H - inset * 2, 4);

      // Mineral-vein border
      strokeRoughEdgeRect(g, t.slotBorder, 0.8, 1, x, y, SLOT_W, SLOT_H, index * 17);

      // Glow behind emoji — cool-toned by monster type
      const glowColor: Record<string, number> = {
        melee:   0x884444,   // muted red
        ranged:  0x446688,   // steel blue
        magic:   0x664488,   // purple
        support: 0x448866,   // teal
      };
      const glow = glowColor[monDef.type] ?? t.stoneMid;
      const glowG = this.add.graphics();
      const cx = x + SLOT_W / 2;
      const cy = y + SLOT_H / 2 - 10;
      for (let r = 22; r >= 6; r -= 4) {
        glowG.fillStyle(glow, 0.06 * (22 - r) / 4 + 0.04);
        glowG.fillCircle(cx, cy, r);
      }
      c.add(glowG);

      // Monster emoji (36px) — apply equipped skin if any
      const typeIdForSlot = Object.keys(MONSTER_DEFS).find(
        k => primaryMonsterId === k || (primaryMonsterId ?? '').startsWith(k + '_'),
      ) ?? (primaryMonsterId ?? '');
      const slotSkin = getSkinForMonster(typeIdForSlot, this.gs.equippedSkins ?? {});
      const emojiText = this.add.text(cx, cy, slotSkin ? slotSkin.emoji : monDef.emoji, {
        fontFamily: 'sans-serif', fontSize: '36px',
      }).setOrigin(0.5);
      c.add(emojiText);
      // Idle animation (compact — no particles)
      this.applyIdleAnimation(emojiText, typeIdForSlot, true);

      // Extra monster count badge (bottom-left)
      if (extraMonsterCount > 0) {
        const ebg = this.add.graphics();
        ebg.fillStyle(0x8b0000, 0.85);
        ebg.fillRoundedRect(x + 2, y + SLOT_H - 16, 18, 13, 3);
        c.add(ebg);
        c.add(this.add.text(x + 11, y + SLOT_H - 9, `+${extraMonsterCount}`, {
          fontFamily: 'monospace', fontSize: '8px', color: '#ffcccc',
        }).setOrigin(0.5));
      }

      // Level badge top-right
      if (slot && slot.roomLevel > 1) {
        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(t.panelBorder, 0.9);
        badgeBg.fillRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
        c.add(badgeBg);
        c.add(this.add.text(x + SLOT_W - 12, y + 8, `Lv${slot.roomLevel}`, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#0a0e14',
        }).setOrigin(0.5));
      }

      // Trap icon bottom-right with colored dot behind it
      if (trapDef) {
        const trapDotG = this.add.graphics();
        const trapDotColors: Record<string, number> = {
          spike_trap:  0x8b0000,
          slow_trap:   0x004488,
          poison_trap: 0x2d6b00,
          stun_trap:   0x886600,
        };
        trapDotG.fillStyle(trapDotColors[trapDef.id] ?? 0x333333, 0.55);
        trapDotG.fillCircle(x + SLOT_W - 10, y + SLOT_H - 12, 9);
        c.add(trapDotG);
        c.add(this.add.text(x + SLOT_W - 10, y + SLOT_H - 12, trapDef.emoji, {
          fontFamily: 'sans-serif', fontSize: '14px',
        }).setOrigin(0.5));
      }

      // HP bar bottom
      if (slot) {
        const hpPct = Math.max(0, slot.hp / slot.maxHp);
        const barW  = SLOT_W - 10;
        const barY  = y + SLOT_H - 8;
        const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? t.panelBorder : 0x8b0000;
        g.fillStyle(t.panelDark, 1);
        g.fillRoundedRect(x + 5, barY, barW, 4, 2);
        g.fillStyle(barColor, 1);
        g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
      }
    } else {
      // ── Empty cell: dark cave alcove ──────────────────────────────────────
      drawRoughEdgeRect(g, t.stoneDark, 1, x, y, SLOT_W, SLOT_H, index * 17);
      const hasType = !!(slot?.roomType);
      strokeRoughEdgeRect(g, hasType ? t.stoneMid : t.slotBorder, hasType ? 0.5 : 0.35, 1.5, x, y, SLOT_W, SLOT_H, index * 17);

      if (hasType) {
        const td = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot!.roomType);
        const cx = x + SLOT_W / 2;
        c.add(this.add.text(cx, y + SLOT_H / 2 - 14, td?.icon ?? '🏚', {
          fontFamily: 'sans-serif', fontSize: '28px',
        }).setOrigin(0.5).setAlpha(0.6));
        c.add(this.add.text(cx, y + SLOT_H / 2 + 10, td?.name ?? '', {
          fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
        }).setOrigin(0.5));
        c.add(this.add.text(cx, y + SLOT_H - 10, '몬스터 미배치', {
          fontFamily: 'sans-serif', fontSize: '8px', color: t.textSecondary,
        }).setOrigin(0.5));
        if (slot && slot.hp < slot.maxHp) {
          const hpPct = Math.max(0, slot.hp / slot.maxHp);
          const barW  = SLOT_W - 10;
          const barY  = y + SLOT_H - 8;
          g.fillStyle(t.panelDark, 1);
          g.fillRoundedRect(x + 5, barY, barW, 4, 2);
          g.fillStyle(hpPct > 0.33 ? t.panelBorder : 0x8b0000, 1);
          g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
        }
      } else {
        // Truly empty — cave rock interior
        g.lineStyle(1, t.stoneLight, 0.2);
        for (let ty = y + 12; ty < y + SLOT_H - 4; ty += 12) {
          g.lineBetween(x + 4, ty, x + SLOT_W - 4, ty);
        }
        c.add(this.add.text(x + SLOT_W / 2, y + SLOT_H / 2 - 10, '⚠️', {
          fontFamily: 'sans-serif', fontSize: '20px',
        }).setOrigin(0.5).setAlpha(0.35));
        c.add(this.add.text(x + SLOT_W / 2, y + SLOT_H - 12, '빈 슬롯', {
          fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
        }).setOrigin(0.5));
      }
    }

    // ── Invasion order badge (top-left, all unlocked slots) ───────────────────
    const order = INVASION_ORDER[index];
    if (order !== undefined) {
      const badgeG = this.add.graphics();
      badgeG.fillStyle(0x000000, 0.55);
      badgeG.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
      c.add(badgeG);
      c.add(this.add.text(x + 10, y + 9, String(order), {
        fontFamily: 'monospace', fontSize: '9px', color: '#c8921a',
      }).setOrigin(0.5));
    }
  }

  // ─── Idle animations ────────────────────────────────────────────────────────

  // (Zone B removed — monster dwelling moved to BarracksScene)

  private applyIdleAnimation(emoji: Phaser.GameObjects.Text, monsterId: string, _compact = false): void {
    const x0 = emoji.x;
    const y0 = emoji.y;

    switch (monsterId) {
      case 'dokkaebi_warrior': {
        // PACE_AND_PUNCH: left-right walk
        this.tweens.add({
          targets: emoji, x: x0 - 20,
          duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        const doPunch = () => {
          if (!emoji.active) return;
          const orig = emoji.text;
          emoji.setText('👊');
          setTimeout(() => { if (emoji.active) emoji.setText(orig); }, 200);
          setTimeout(doPunch, Phaser.Math.Between(4000, 7000));
        };
        setTimeout(doPunch, Phaser.Math.Between(4000, 7000));
        break;
      }
      case 'dokkaebi_junior': {
        // BOUNCE_AND_LOOK
        this.tweens.add({
          targets: emoji, y: y0 - 8,
          duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        setInterval(() => {
          if (!emoji.active) return;
          emoji.setScale(-1, 1);
          setTimeout(() => { if (emoji.active) emoji.setScale(1, 1); }, 1000);
        }, 5000);
        setTimeout(() => setInterval(() => {
          if (!emoji.active) return;
          this.tweens.add({
            targets: emoji, angle: 360, duration: 400,
            onComplete: () => { if (emoji.active) emoji.setAngle(0); },
          });
        }, 5000), 2500);
        break;
      }
      case 'fire_dokkaebi': {
        // BREATHE_FIRE
        this.tweens.add({
          targets: emoji, scaleX: 1.05, scaleY: 1.05,
          duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        setInterval(() => {
          if (!emoji.active) return;
          for (let i = 0; i < 3; i++) {
            const px = emoji.x + Phaser.Math.Between(-12, 12);
            const fp = this.add.text(px, emoji.y - 8, '🔥', { fontSize: '12px' })
              .setOrigin(0.5).setDepth(20);
            this.tweens.add({
              targets: fp, y: fp.y - 32, alpha: 0,
              duration: 600, delay: i * 80,
              onComplete: () => fp.destroy(),
            });
          }
        }, 6000);
        break;
      }
      case 'gumiho_guardian': {
        // TAIL_GROOM
        this.tweens.add({
          targets: emoji, angle: 3,
          duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        setInterval(() => {
          if (!emoji.active) return;
          for (let i = 0; i < 3; i++) {
            const ang = (i * 120) * Math.PI / 180;
            const r = 22;
            const sp = this.add.text(
              emoji.x + Math.cos(ang) * r, emoji.y + Math.sin(ang) * r,
              '✨', { fontSize: '10px' },
            ).setOrigin(0.5).setDepth(20);
            this.tweens.add({
              targets: sp,
              x: sp.x + Math.cos(ang) * 10,
              y: sp.y + Math.sin(ang) * 10,
              alpha: 0, duration: 800,
              onComplete: () => sp.destroy(),
            });
          }
        }, 8000);
        break;
      }
      case 'sage': {
        // MEDITATE_FLOAT
        this.tweens.add({
          targets: emoji, y: y0 - 6, alpha: 0.85,
          duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        setInterval(() => {
          if (!emoji.active) return;
          const glow = this.add.graphics().setDepth(19);
          glow.fillStyle(0xffd700, 0.28);
          glow.fillCircle(emoji.x, emoji.y, 28);
          this.tweens.add({
            targets: glow, alpha: 0, duration: 350,
            onComplete: () => glow.destroy(),
          });
        }, 10000);
        break;
      }
      case 'frost_spirit': {
        // FROST_STEP: wander + frost trail
        const doWander = () => {
          if (!emoji.active) return;
          const fp = this.add.text(emoji.x, emoji.y, '❄', {
            fontSize: '11px', color: '#88ccff',
          }).setOrigin(0.5).setDepth(15).setAlpha(0.7);
          this.tweens.add({ targets: fp, alpha: 0, duration: 2000, onComplete: () => fp.destroy() });
          const dx = Phaser.Math.Between(-15, 15);
          this.tweens.add({
            targets: emoji,
            x: Phaser.Math.Clamp(emoji.x + dx, x0 - 22, x0 + 22),
            duration: 2000, ease: 'Sine.easeInOut',
            onComplete: doWander,
          });
        };
        setTimeout(doWander, 1500);
        break;
      }
      default: {
        // DEFAULT: gentle bob
        this.tweens.add({
          targets: emoji, y: y0 - 5,
          duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    }
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

  // ─── Daily content panel ─────────────────────────────────────────────────────

  private buildDailyContentPanel(): void {
    const gs = loadGameState();
    const today = getTodayString();
    const daily = getDailyDungeon();
    const weeklyBoss = getWeeklyBoss();
    const challenges = getDailyChallenges();

    const dailyDone = gs.dailyDungeonCompleted === today;

    // Floating daily content button — right side of screen
    const btnX = CANVAS_WIDTH - 55;
    const btnY = 140;

    // Daily dungeon button
    const dailyBg = this.add.graphics().setDepth(10);
    dailyBg.fillStyle(dailyDone ? 0x1a3a1a : 0x3a1a00, 0.9);
    dailyBg.fillRoundedRect(btnX, btnY, 48, 48, 8);
    dailyBg.lineStyle(1.5, dailyDone ? 0x44cc44 : 0xc8921a, 0.8);
    dailyBg.strokeRoundedRect(btnX, btnY, 48, 48, 8);

    this.add.text(btnX + 24, btnY + 14, dailyDone ? '✅' : '⚔️', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(btnX + 24, btnY + 34, '일일', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#c8921a',
    }).setOrigin(0.5).setDepth(11);

    if (!dailyDone) {
      const zone = this.add.zone(btnX + 24, btnY + 24, 48, 48)
        .setInteractive().setDepth(12);
      zone.on('pointerdown', () => {
        audioManager.playSfx('button_click');
        // Launch dungeon scene with daily mode
        this.registry.set('stageConfig', {
          stageNumber: 1,
          slots: 12,
          endless: false,
        });
        this.registry.set('dailyMode', daily);
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('DungeonScene');
        });
      });
    }

    // Weekly boss button
    const weekBtnY = btnY + 56;
    const weeklyDone = gs.weeklyBossResetDate === getThisWeekMonday();
    const weeklyBg = this.add.graphics().setDepth(10);
    weeklyBg.fillStyle(weeklyDone ? 0x1a0030 : 0x2a0030, 0.9);
    weeklyBg.fillRoundedRect(btnX, weekBtnY, 48, 48, 8);
    weeklyBg.lineStyle(1.5, weeklyDone ? 0x44cc44 : 0xaa44ff, 0.8);
    weeklyBg.strokeRoundedRect(btnX, weekBtnY, 48, 48, 8);

    this.add.text(btnX + 24, weekBtnY + 14, weeklyDone ? '✅' : '👑', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(btnX + 24, weekBtnY + 34, '주간', {
      fontFamily: 'sans-serif', fontSize: '8px', color: weeklyDone ? '#44cc44' : '#aa44ff',
    }).setOrigin(0.5).setDepth(11);

    // Weekly boss click — launch as invasion-style battle
    const weekZone = this.add.zone(btnX + 24, weekBtnY + 24, 48, 48)
      .setInteractive().setDepth(12);
    weekZone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      // Build single boss wave
      const bossWave = [{
        wave: 1, clearReward: weeklyBoss.rewards.skinShards * 100,
        invaders: [{ type: weeklyBoss.bossType, count: 1, spawnDelay: 0, isBoss: true }],
      }];
      this.registry.set('stageConfig', {
        waves: bossWave,
        dungeonHp: 3000,
        startGold: 500,
        chapter: 1,
      });
      this.registry.set('returnTo', 'DungeonHomeScene');
      this.registry.set('weeklyBossMode', { boss: weeklyBoss });
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('DungeonHomeScene');
        this.scene.start('DungeonScene');
      });
    });

    // Challenge button
    const chalBtnY = weekBtnY + 56;
    const completedCount = challenges.filter(c => {
      const state = gs.dailyChallenges[c.id];
      return state?.completed ?? false;
    }).length;

    const chalBg = this.add.graphics().setDepth(10);
    chalBg.fillStyle(0x003030, 0.9);
    chalBg.fillRoundedRect(btnX, chalBtnY, 48, 48, 8);
    chalBg.lineStyle(1.5, 0x44cccc, 0.8);
    chalBg.strokeRoundedRect(btnX, chalBtnY, 48, 48, 8);

    this.add.text(btnX + 24, chalBtnY + 14, '🎯', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(btnX + 24, chalBtnY + 34, `${completedCount}/3`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#44cccc',
    }).setOrigin(0.5).setDepth(11);

    const chalZone = this.add.zone(btnX + 24, chalBtnY + 24, 48, 48)
      .setInteractive().setDepth(12);
    chalZone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      this.showChallengePanel();
    });
  }

  private showChallengePanel(): void {
    const gs = loadGameState();
    const today = getTodayString();
    // Reset stale progress
    if (gs.dailyChallengeDate !== today) {
      gs.dailyChallenges    = {};
      gs.dailyChallengeDate = today;
    }
    const challenges = getDailyChallenges();

    const c = this.add.container(0, 0).setDepth(95);

    // Dim overlay
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.80);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
    c.add(dim);

    const PW = 340, PH = 320;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;

    const pg = this.add.graphics();
    pg.fillStyle(0x060e18, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 10);
    pg.lineStyle(2, 0x44cccc, 1);
    pg.strokeRoundedRect(PX, PY, PW, PH, 10);
    c.add(pg);

    c.add(this.add.text(CANVAS_WIDTH / 2, PY + 22, '🎯  오늘의 도전 과제', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cccc', fontStyle: 'bold',
    }).setOrigin(0.5));

    challenges.forEach((ch, i) => {
      const entry = gs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
      const rowY = PY + 56 + i * 78;

      // Row bg
      const rbg = this.add.graphics();
      rbg.fillStyle(entry.completed ? 0x0a2a1a : 0x0a1422, 0.8);
      rbg.fillRoundedRect(PX + 12, rowY, PW - 24, 68, 6);
      if (entry.completed) {
        rbg.lineStyle(1, 0x44cc88, 0.6);
        rbg.strokeRoundedRect(PX + 12, rowY, PW - 24, 68, 6);
      }
      c.add(rbg);

      // Status icon + description
      const icon = entry.completed ? '✅' : '🔲';
      c.add(this.add.text(PX + 26, rowY + 12, icon, {
        fontFamily: 'sans-serif', fontSize: '14px',
      }));
      c.add(this.add.text(PX + 48, rowY + 12, ch.description, {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: entry.completed ? '#88eebb' : '#d0c8b0',
      }));

      // Reward
      c.add(this.add.text(PX + PW - 24, rowY + 12, `+${ch.reward.gems ?? 0} 💎`, {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: entry.completed ? '#aaffcc' : '#88aacc',
      }).setOrigin(1, 0));

      // Progress bar
      const barX = PX + 26, barY = rowY + 44, barW = PW - 52, barH = 8;
      const prog = this.add.graphics();
      prog.fillStyle(0x1a2a3a, 1);
      prog.fillRoundedRect(barX, barY, barW, barH, 4);
      const ratio = Math.min(entry.progress / ch.objective.target, 1);
      if (ratio > 0) {
        prog.fillStyle(entry.completed ? 0x44cc88 : 0x44aacc, 1);
        prog.fillRoundedRect(barX, barY, barW * ratio, barH, 4);
      }
      c.add(prog);

      c.add(this.add.text(barX + barW + 6, barY - 1, `${entry.progress}/${ch.objective.target}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#88aacc',
      }));
    });

    const closeBtn = this.add.text(CANVAS_WIDTH / 2, PY + PH - 26, '닫기', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44cccc', fontStyle: 'bold',
      backgroundColor: '#060e18', padding: { x: 32, y: 10 },
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerdown', () => { c.destroy(true); });
    c.add(closeBtn);

    c.setScale(0.88).setAlpha(0);
    this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
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

  // ─── Audio settings overlay ───────────────────────────────────────────────────

  private showAudioSettings(): void {
    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
    const OW = 310, OH = 400;
    const OX = (CW - OW) / 2, OY = (CH - OH) / 2;
    const DEPTH = 50;

    const ov = this.add.container(0, 0).setDepth(DEPTH);

    // Backdrop
    const backdrop = this.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.65)
      .setInteractive();
    ov.add(backdrop);

    // Panel
    const panelG = this.add.graphics();
    panelG.fillStyle(0x1a0f00, 0.97);
    panelG.fillRoundedRect(OX, OY, OW, OH, 10);
    panelG.lineStyle(2, 0xc8921a, 0.9);
    panelG.strokeRoundedRect(OX, OY, OW, OH, 10);
    ov.add(panelG);

    // Title
    ov.add(this.add.text(CW / 2, OY + 20, '⚙️  설정', {
      fontFamily: 'Georgia, serif', fontSize: '16px',
      color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    const cfg = audioManager.getSettings();

    const makeRow = (
      labelText: string,
      yOff: number,
      isEnabled: boolean,
      onToggle: (v: boolean) => void,
      volume: number,
      onVolume: (v: number) => void,
    ) => {
      const rowY = OY + yOff;

      // Label
      ov.add(this.add.text(OX + 16, rowY, labelText, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#e8d090',
      }).setOrigin(0, 0.5));

      // Toggle button
      const toggleBg = this.add.rectangle(OX + OW - 36, rowY, 44, 22, isEnabled ? 0x226622 : 0x442222, 1)
        .setInteractive();
      const toggleLabel = this.add.text(OX + OW - 36, rowY,
        isEnabled ? 'ON' : 'OFF', {
          fontFamily: 'sans-serif', fontSize: '10px',
          color: isEnabled ? '#88ff88' : '#ff8888',
        }).setOrigin(0.5);
      ov.add(toggleBg); ov.add(toggleLabel);
      toggleBg.on('pointerdown', () => {
        const next = !isEnabled;
        isEnabled = next;
        toggleBg.setFillStyle(next ? 0x226622 : 0x442222);
        toggleLabel.setText(next ? 'ON' : 'OFF').setColor(next ? '#88ff88' : '#ff8888');
        onToggle(next);
        audioManager.playSfx('button_click');
      });

      // Volume slider track
      const SX = OX + 16, SY = rowY + 20, SW = OW - 52;
      const sliderBg = this.add.graphics();
      sliderBg.fillStyle(0x3a2800, 1);
      sliderBg.fillRoundedRect(SX, SY - 4, SW, 8, 4);
      ov.add(sliderBg);

      const pct = volume;
      const fillG = this.add.graphics();
      const drawFill = (p: number) => {
        fillG.clear();
        fillG.fillStyle(0xc8921a, 1);
        fillG.fillRoundedRect(SX, SY - 4, Math.max(8, SW * p), 8, 4);
      };
      drawFill(pct);
      ov.add(fillG);

      // Slider handle
      const knob = this.add.circle(SX + SW * pct, SY, 8, 0xffd700)
        .setInteractive({ draggable: true });
      ov.add(knob);
      knob.on('drag', (_ptr: unknown, x: number) => {
        const clamped = Math.max(SX, Math.min(SX + SW, x));
        const newPct  = (clamped - SX) / SW;
        knob.x = clamped;
        drawFill(newPct);
        onVolume(newPct);
      });
    };

    makeRow(
      '🎵 배경음악 (BGM)',
      60,
      cfg.bgmEnabled,
      (v) => audioManager.setBgmEnabled(v),
      cfg.bgmVolume,
      (v) => audioManager.setBgmVolume(v),
    );

    makeRow(
      '🔊 효과음 (SFX)',
      140,
      cfg.sfxEnabled,
      (v) => audioManager.setSfxEnabled(v),
      cfg.sfxVolume,
      (v) => audioManager.setSfxVolume(v),
    );

    // ── Divider ────────────────────────────────────────────
    const divG = this.add.graphics();
    divG.lineStyle(1, 0xc8921a, 0.3);
    divG.lineBetween(OX + 16, OY + 220, OX + OW - 16, OY + 220);
    ov.add(divG);

    ov.add(this.add.text(CW / 2, OY + 234, '💾  세이브 관리', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Toast helper using shared utility
    const toast = (msg: string, color = '#88ff88') => {
      showToast(this, msg, { color, depth: DEPTH + 1 });
    };

    // Export button
    const exportBtnBg = this.add.graphics();
    exportBtnBg.fillStyle(0x224422, 1);
    exportBtnBg.fillRoundedRect(OX + 16, OY + 260, OW - 32, 36, 6);
    exportBtnBg.lineStyle(1, 0x44aa44, 0.7);
    exportBtnBg.strokeRoundedRect(OX + 16, OY + 260, OW - 32, 36, 6);
    ov.add(exportBtnBg);
    ov.add(this.add.text(CW / 2, OY + 278, '📤  세이브 내보내기 (클립보드 복사)', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#88ff88',
    }).setOrigin(0.5));
    const exportZone = this.add.zone(CW / 2, OY + 278, OW - 32, 36).setInteractive();
    ov.add(exportZone);
    exportZone.on('pointerdown', () => {
      const code = exportGameState();
      navigator.clipboard.writeText(code).then(
        () => toast('복사 완료! 안전한 곳에 보관하세요.'),
        () => toast('클립보드 접근 실패', '#ff8888'),
      );
    });

    // Import button
    const importBtnBg = this.add.graphics();
    importBtnBg.fillStyle(0x442222, 1);
    importBtnBg.fillRoundedRect(OX + 16, OY + 306, OW - 32, 36, 6);
    importBtnBg.lineStyle(1, 0xaa4444, 0.7);
    importBtnBg.strokeRoundedRect(OX + 16, OY + 306, OW - 32, 36, 6);
    ov.add(importBtnBg);
    ov.add(this.add.text(CW / 2, OY + 324, '📥  세이브 가져오기 (클립보드에서)', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ff8888',
    }).setOrigin(0.5));
    const importZone = this.add.zone(CW / 2, OY + 324, OW - 32, 36).setInteractive();
    ov.add(importZone);
    importZone.on('pointerdown', () => {
      // Show confirmation dialog
      this.showImportConfirm(ov, toast);
    });

    // Close button
    const closeBtn = this.add.text(CW / 2, OY + OH - 22, '닫기', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive();
    closeBtn.on('pointerdown', () => { ov.destroy(true); });
    ov.add(closeBtn);

    backdrop.on('pointerdown', () => { ov.destroy(true); });
  }

  private showImportConfirm(
    parentOv: Phaser.GameObjects.Container,
    toastFn: (msg: string, color?: string) => void,
  ): void {
    const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
    const DW = 260, DH = 140;
    const DX = (CW - DW) / 2, DY = (CH - DH) / 2;

    const dialog = this.add.container(0, 0).setDepth(55);

    const dBackdrop = this.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.5)
      .setInteractive();
    dialog.add(dBackdrop);

    const dPanel = this.add.graphics();
    dPanel.fillStyle(0x2a0800, 0.98);
    dPanel.fillRoundedRect(DX, DY, DW, DH, 8);
    dPanel.lineStyle(2, 0xaa4444, 0.9);
    dPanel.strokeRoundedRect(DX, DY, DW, DH, 8);
    dialog.add(dPanel);

    dialog.add(this.add.text(CW / 2, DY + 20, '⚠️  주의', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    dialog.add(this.add.text(CW / 2, DY + 48, '기존 데이터가 덮어씌워집니다.\n클립보드의 세이브 코드를 불러옵니다.', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: '#e8d090', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Confirm
    const confirmBtn = this.add.text(CW / 2 - 50, DY + DH - 28, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive();
    dialog.add(confirmBtn);
    confirmBtn.on('pointerdown', () => {
      navigator.clipboard.readText().then((code) => {
        const result = importGameState(code.trim());
        dialog.destroy(true);
        parentOv.destroy(true);
        if (result.success) {
          toastFn('세이브 복원 완료! 다시 불러옵니다...');
          this.time.delayedCall(800, () => this.scene.start('DungeonHomeScene'));
        } else {
          toastFn(result.error ?? '가져오기 실패', '#ff8888');
        }
      }).catch(() => {
        dialog.destroy(true);
        toastFn('클립보드 접근 실패', '#ff8888');
      });
    });

    // Cancel
    const cancelBtn = this.add.text(CW / 2 + 50, DY + DH - 28, '취소', {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#888888',
    }).setOrigin(0.5).setInteractive();
    dialog.add(cancelBtn);
    cancelBtn.on('pointerdown', () => { dialog.destroy(true); });

    dBackdrop.on('pointerdown', () => { dialog.destroy(true); });
  }

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
