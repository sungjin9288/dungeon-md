import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Torch } from '../objects/Torch';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { RoomSelectionPanel }  from '../ui/RoomSelectionPanel';
import { MonsterSelectPanel }  from '../ui/MonsterSelectPanel';
import { RoomUpgradePanel }    from '../ui/RoomUpgradePanel';
import { COLORS, CSS } from '../constants/colors';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import { rollWaveEvent, type WaveEventDef } from '../data/waveEvents';
import { drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_COLS, GRID_ROWS, CELL_SIZE, GRID_X, GRID_Y,
  TORCH_POSITIONS, INVADER_WAYPOINTS,
  TOP_BAR_HEIGHT, FOG_START_Y, FOG_HEIGHT,
} from '../constants/layout';
import { ROOM_DEFS, getUpgradeCost, getScrollAuraBonus, MAX_ROOM_LEVEL, getAltarKillsNeeded, type RoomData, type RoomType } from '../data/rooms';
import { MONSTER_DEFS, getMonstersForRoom, type MonsterId } from '../data/monsters';
import { INVADER_DEFS } from '../data/invaders';
import type { InvaderType, InvaderDef } from '../data/invaders';
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, type WaveSpec } from '../data/stages';
import { getMedicineHealRate, getArmoryDmgBonus, getArmoryRadius } from '../data/rooms';
import { loadGameState, saveGameState, getWisdomBonuses, getUnlockedSlots, ROOM_SLOT_TYPE_DEFS, type WisdomBonuses } from '../data/wisdom';
import { checkAchievements, ACHIEVEMENT_DEFS, type AchievementContext } from '../data/achievements';
import { addXp, ACTIVE_SKILLS, getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { rollMaterialDrop, MATERIAL_DEFS } from '../data/fusion';
import { buildEndlessSpawnQueue } from '../data/endlessWave';
import { tickDailyChallenge, getTodayString, type DailyDungeon, type WeeklyBoss, getThisWeekMonday } from '../data/daily';
import { updateQuestObjective, tickSubQuestProgress, completeAndAdvance } from '../data/quests';
import { recordClear, STAGE_CONFIGS } from './StageSelectScene';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { applyChapterTheme } from './ChapterTheme';
import { SkillHUD } from '../combat/SkillHUD';
import { MonsterSwapManager } from '../combat/MonsterSwap';
import { SynergyManager } from '../combat/SynergyManager';
import { logger } from '../utils/logger';

export class DungeonScene extends Phaser.Scene {
  // ── Dynamic grid dimensions (overridden per chapter) ───────────────────────
  private effectiveCols     = GRID_COLS;   // 3 for Ch1, 4 for Ch2
  private effectiveCellSize = CELL_SIZE;   // 110 for Ch1, 82 for Ch2
  private stageChapter      = 1;
  private waterCells        = new Set<number>();   // flat indices (row*cols+col) of water cells

  // ── Wave configs (loaded per stage) ───────────────────────────────────────
  private waveConfigs: WaveSpec[] = CHAPTER_1[0].waves;

  private hexedInvader: import('../objects/Invader').Invader | null = null;
  private recentlyDeadInvaders: Array<import('../data/invaders').InvaderDef> = [];
  private tauntBoostActiveUntil = 0;  // TAUNTING_ROAR damage boost

  // ── Grid state ─────────────────────────────────────────────────────────────
  private rooms:    Room[][] = [];
  private roomGrid: (RoomData | null)[][] = [];

  // ── Combat ─────────────────────────────────────────────────────────────────
  private invaderPath!: Phaser.Curves.Path;
  private activeInvaders: Invader[] = [];

  // ── UI ─────────────────────────────────────────────────────────────────────
  private panel!:         RoomSelectionPanel;
  private monsterPanel!:  MonsterSelectPanel;
  private upgradePanel!:  RoomUpgradePanel;
  private selectedRoom:   Room | null = null;
  private unlockedStage   = 1;        // Chapter 1 start
  // Active skill system
  private skillPopup?:    Phaser.GameObjects.Container;
  private skillCooldowns  = new Map<string, number>();  // `${row}_${col}_${skillId}` → ready-at ms

  // Boss HP bar elements
  private bossHpBarBg?:   Phaser.GameObjects.Graphics;
  private bossHpBarFill?: Phaser.GameObjects.Graphics;
  private bossHpLabel?:   Phaser.GameObjects.Text;
  private bossMaxHp       = 0;
  private waveLabel!: Phaser.GameObjects.Text;
  private waveBtnBg!: Phaser.GameObjects.Graphics;
  private waveBtnZone!: Phaser.GameObjects.Zone;
  private resultOverlay?: Phaser.GameObjects.Container;
  private returnTo?: string;   // set when launched from invasion (PreBattleScene)
  private countdownBar?: Phaser.GameObjects.Graphics;

  // ── Combat interaction subsystems ─────────────────────────────────────────
  private skillHUD?: SkillHUD;
  private swapManager?: MonsterSwapManager;
  private targetingSkillId: string | null = null;

  // ── Synergy system ────────────────────────────────────────────────────────
  private synergyManager!: SynergyManager;

  // ── Wisdom bonuses ─────────────────────────────────────────────────────────
  private wisdomBonuses!: WisdomBonuses;
  private baseSlots      = 12;   // overridden in create() from stage config

  // ── Player state ───────────────────────────────────────────────────────────
  private gold      = 500;
  private startGold = 500;
  private gems      = 200;
  private dungeonHp = 1000;
  private maxHp     = 1000;

  // ── Wave state ─────────────────────────────────────────────────────────────
  private wave         = 0;
  private maxWave      = 10;
  private waveActive   = false;
  private spawnQueue:  Array<{ def: InvaderDef; delay: number }> = [];
  private prepTimer    = 0;
  private prepActive   = false;

  // ── Endless mode ───────────────────────────────────────────────────────────
  private isEndless        = false;
  private endlessHighScore = 0;
  private endlessRecordBroken = false;
  private killsThisRun     = 0;
  private goldEarnedThisRun = 0;
  private killComboCount   = 0;
  private lastKillTime     = 0;
  private materialsEarnedThisRun: Record<string, number> = {};
  private equipmentMap = new Map<string, EquipmentStats>();  // monsterId → equipment stats

  // ── Per-wave stats ─────────────────────────────────────────────────────────
  private killsThisWave      = 0;
  private breakthruCount     = 0;
  private waveStartSlotHps: number[] = [];   // snapshot of slot HPs at wave start
  private waveStartDungeonHp = 0;           // for no_damage challenge tracking
  private consecutiveNoDmgWaves = 0;         // consecutive waves cleared without taking HP damage

  // ── Wave event multipliers (reset each wave) ─────────────────────────────
  private waveGoldMult = 1;
  private waveHpMult   = 1;    // invader HP multiplier (curse)
  private waveAtkMult  = 1;    // monster ATK multiplier (rally)
  private waveSpdMult  = 1;    // invader speed multiplier (fog)
  private waveFogOverlay?: Phaser.GameObjects.Graphics;

  // ── Dungeon slot traps ──────────────────────────────────────────────────────
  private dungeonTrapSlots: import('../data/wisdom').DungeonSlot[] = [];
  // Extra monster attack cooldowns: key = `${row}_${col}_${slotIdx}` → lastAttackTime ms
  private extraMonsterCooldowns = new Map<string, number>();
  /** Per-slot trap damage synergy multiplier (populated by recalcRoomTypeBonuses) */
  private slotTrapSynergyMult  = new Map<number, number>();

  // Theme
  private theme!: DungeonTheme;

  // ── Daily dungeon mode ────────────────────────────────────────────────────
  private dailyMode:      DailyDungeon | null = null;
  private weeklyBossMode: WeeklyBoss    | null = null;

  constructor() { super({ key: 'DungeonScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    // ── Wisdom bonuses ────────────────────────────────────────────────────────
    const gameState       = loadGameState();
    this.wisdomBonuses    = getWisdomBonuses(gameState);
    this.synergyManager   = new SynergyManager(this);
    this.dungeonTrapSlots = gameState.dungeonSlots ?? [];

    // Build monster → equipment stats lookup
    this.equipmentMap.clear();
    for (const m of gameState.ownedMonsters) {
      if (m.equipment) {
        const stats = getEquipmentStats(m.equipment);
        if (Object.keys(stats).length > 0) this.equipmentMap.set(m.id, stats);
      }
    }

    // Read stage config from registry (set by StageSelectScene or PreBattleScene)
    const stageCfg        = this.registry.get('stageConfig') as {
      stageNumber?: number; slots?: number; endless?: boolean;
      // Invasion-mode inline config (set by PreBattleScene)
      waves?: WaveSpec[]; chapter?: number; dungeonHp?: number; startGold?: number;
    } | undefined;
    this.baseSlots        = stageCfg?.slots ?? getUnlockedSlots(gameState.dmLevel);
    this.isEndless        = stageCfg?.endless ?? false;
    if (this.isEndless) {
      this.maxWave = 9999;
      this.endlessHighScore = gameState.endlessHighScore ?? 0;
      this.registry.set('endlessHighScore', this.endlessHighScore);
    }

    // Load the correct wave config + determine chapter / grid dimensions
    // If stageCfg has inline waves (invasion mode from PreBattleScene), use them directly
    const hasInlineWaves = Array.isArray((stageCfg as { waves?: unknown })?.waves);
    let waveConfigs: WaveSpec[];
    let stageChapter: number;
    let effectiveCols: number;
    let waterCells: Set<number>;
    let stageDungeonHp: number;
    let stageStartGold: number;
    if (hasInlineWaves && stageCfg) {
      waveConfigs     = (stageCfg as { waves: WaveSpec[] }).waves;
      stageChapter    = stageCfg.chapter ?? 1;
      effectiveCols   = GRID_COLS;
      waterCells      = new Set<number>();
      stageDungeonHp  = stageCfg.dungeonHp ?? 1000;
      stageStartGold  = stageCfg.startGold ?? 300;
    } else {
      const stageId = stageCfg?.stageNumber ?? 1;
      const allStages = [...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5, ...CHAPTER_6];
      const stageDef  = allStages.find(s => s.id === stageId) ?? CHAPTER_1[0];
      waveConfigs     = stageDef.waves;
      stageChapter    = stageDef.chapter;
      effectiveCols   = stageDef.gridCols ?? GRID_COLS;
      waterCells      = new Set<number>(stageDef.waterCells ?? []);
      stageDungeonHp  = stageDef.dungeonHp;
      stageStartGold  = stageDef.startGold;
    }
    // ── Daily dungeon mode ─────────────────────────────────────────────────
    const rawDaily = this.registry.get('dailyMode') as DailyDungeon | undefined;
    if (rawDaily) {
      this.dailyMode = rawDaily;
      // Override waves with daily-generated waves
      waveConfigs = rawDaily.waves;
      this.registry.set('dailyMode', null);  // consume once
    } else {
      this.dailyMode = null;
    }

    const rawWeekly = this.registry.get('weeklyBossMode') as { boss: WeeklyBoss } | undefined;
    this.weeklyBossMode = rawWeekly?.boss ?? null;
    if (rawWeekly) this.registry.set('weeklyBossMode', null); // consume once

    this.waveConfigs    = waveConfigs;
    this.maxWave        = this.isEndless ? 9999 : waveConfigs.length;
    this.stageChapter   = stageChapter;
    this.effectiveCols  = effectiveCols;
    this.effectiveCellSize = this.effectiveCols === GRID_COLS
      ? CELL_SIZE
      : Math.floor((GRID_COLS * CELL_SIZE) / this.effectiveCols);  // keep same total width
    this.waterCells = waterCells;

    // Apply starting gold bonus (use stage startGold if higher)
    this.gold             = Math.max(stageStartGold, 300) + this.wisdomBonuses.startingGold;
    this.startGold        = this.gold;

    // Apply dungeon HP bonus
    this.maxHp            = stageDungeonHp + this.wisdomBonuses.dungeonMaxHpBonus;
    this.dungeonHp        = this.maxHp;

    // Load unlockedStage from STAGE_CONFIGS so the monster picker shows correct options
    const stageNum = stageCfg?.stageNumber ?? 1;
    this.unlockedStage = STAGE_CONFIGS.find(s => s.stageNumber === stageNum)?.unlockedStage ?? stageNum;

    logger.debug(`[WISDOM] startingGold: ${this.gold}, maxHp: ${this.maxHp}, slots: ${this.baseSlots + this.wisdomBonuses.extraSlots}`);

    this.returnTo = this.registry.get('returnTo') as string | undefined;
    this.registry.set('gold',  this.gold);
    this.registry.set('gems',  this.gems);
    this.registry.set('hp',    this.dungeonHp);
    this.registry.set('wave',  this.wave);
    this.registry.set('status','');

    this.theme = getActiveTheme(gameState.equippedTheme);
    this.roomGrid = Array.from({ length: GRID_ROWS }, () => Array<RoomData | null>(this.effectiveCols).fill(null));

    this.drawBackground();
    this.buildPath();
    this.buildGrid();
    this.placeTorches();
    this.addDustMotes();
    this.addFog();
    this.buildWaveButton();
    this.buildPanel();
    this.buildMonsterPanel();
    this.buildUpgradePanel();
    this.setupEvents();
    applyChapterTheme(this, this.stageChapter, this.effectiveCellSize);

    this.showWisdomToast();
    // Ensure DungeonHomeScene is hidden when battle starts (it may still be active as a background scene)
    if (this.scene.isActive('DungeonHomeScene')) this.scene.stop('DungeonHomeScene');
    this.scene.launch('UIScene');
    this.trackConsecutiveDays();

    // ── Combat interaction subsystems ────────────────────────────────────────
    this.initSkillHUD(gameState);
    this.initSwapManager();

    audioManager.resume().then(() => audioManager.playBgm('battle'));

    // FPS monitor — dev builds only
    if (import.meta.env.DEV) {
      this.fpsText = this.add.text(6, CANVAS_HEIGHT - 18, 'FPS: --', {
        fontFamily: 'monospace', fontSize: '12px', color: '#00ff88',
        backgroundColor: '#00000088', padding: { x: 4, y: 2 },
      }).setDepth(999);
    }
  }

  shutdown(): void {
    // Remove custom event listeners
    this.events.off('invaderKilled');
    this.events.off('invaderReachedEnd');
    this.events.off('invaderKilledRow');
    this.events.off('roomDestroyed');
    this.events.off('permafrostShatter');
    this.events.off('mirrorReflect');

    // Destroy remaining invaders
    this.activeInvaders.forEach(inv => { if (inv.active) inv.destroy(); });
    this.activeInvaders = [];

    // Cancel all pending timers
    this.time.removeAllEvents();

    // Cleanup subsystems
    this.skillHUD?.destroy();
    this.resultOverlay?.destroy();
    this.resultOverlay = undefined;

    // Clear cached data
    this.equipmentMap.clear();
  }

  // ── FPS monitor (dev mode) ─────────────────────────────────────────────────
  private fpsText?: Phaser.GameObjects.Text;

  update(_time: number, _delta: number): void {
    if (!this.waveActive) return;
    this.runCombat(_time);
    this.runTrapEffects(_time);
    this.runHealers(_time);
    this.runGoldVeins(_time);
    this.updateBossHpBar();
    this.checkWaveEnd();
    this.runMercenaryAuras(_time);
    this.runTigersPounce(_time);
    if (this.stageChapter >= 3) {
      this.runSoulHarvest(_time);
      this.runMedicineHallHeal(_time);
      this.runPoisonTrailDamage(_time);
    }
    if (this.stageChapter >= 4) {
      this.runSpiritAltar(_time);
      this.runLunarRhythm(_time);
      this.runEntrancingVeil();
    }

    // Update skill HUD cooldown arcs
    this.skillHUD?.update();

    // FPS display — only in development
    if (import.meta.env.DEV && this.fpsText) {
      const fps = Math.round(this.game.loop.actualFps);
      const color = fps >= 55 ? '#00ff88' : fps >= 45 ? '#ffcc00' : '#ff4444';
      this.fpsText.setText(`FPS: ${fps}`).setColor(color);
    }
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    const t = this.theme;
    const g = this.add.graphics().setDepth(-20);
    g.fillStyle(t.bgPrimary, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Cave rock grid
    const ts = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += ts)
      for (let y = TOP_BAR_HEIGHT; y < CANVAS_HEIGHT; y += ts) {
        g.lineStyle(0.4, t.stoneDark, 0.18);
        g.strokeRect(x, y, ts, ts);
      }

    // Upper area — cave ceiling
    g.fillStyle(t.stoneDark, 1);
    g.fillRect(0, TOP_BAR_HEIGHT, CANVAS_WIDTH, GRID_Y - TOP_BAR_HEIGHT);
    for (let y = TOP_BAR_HEIGHT + 8; y < GRID_Y; y += 14) {
      g.fillStyle(t.bgPrimary, 0.4); g.fillRect(0, y, CANVAS_WIDTH, 2);
    }

    // Stalactites at grid top
    if (t.decorations.includes('stalactites')) {
      drawStalactites(g, t, GRID_Y - 4, CANVAS_WIDTH, 31);
    }

    // Grid separator line — mineral vein
    g.fillStyle(t.panelBorder, 0.2);
    g.fillRect(GRID_X - 4, GRID_Y - 2, this.effectiveCols * this.effectiveCellSize + 8, 2);

    // Floor area
    const floorY = GRID_Y + GRID_ROWS * this.effectiveCellSize + 4;
    g.fillStyle(t.stoneDark, 0.25);
    g.fillRect(0, floorY, CANVAS_WIDTH, CANVAS_HEIGHT - floorY);
    for (let y = floorY; y < CANVAS_HEIGHT; y += 8) {
      g.fillStyle(t.bgPrimary, 0.3); g.fillRect(0, y, CANVAS_WIDTH, 4);
    }

    // Stalagmites at bottom
    if (t.decorations.includes('stalagmites')) {
      drawStalagmites(g, t, floorY + 2, CANVAS_WIDTH, 88);
    }

    // Rock strata texture
    drawCaveWallTexture(g, t, 0, TOP_BAR_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - TOP_BAR_HEIGHT, 67);
  }

  // ─── Path ─────────────────────────────────────────────────────────────────

  private buildPath(): void {
    const [first, ...rest] = INVADER_WAYPOINTS;
    this.invaderPath = new Phaser.Curves.Path(first.x, first.y);
    for (const pt of rest) this.invaderPath.lineTo(pt.x, pt.y);

    // Debug path
    const dbg = this.add.graphics().setDepth(50).setAlpha(0.45);
    dbg.lineStyle(1.5, COLORS.BLOOD_RED, 0.6);
    this.invaderPath.draw(dbg, 64);
    dbg.fillStyle(COLORS.BLOOD_RED, 0.7);
    this.invaderPath.getPoints(40).forEach((pt, i) => {
      if (i % 2 === 0) dbg.fillCircle(pt.x, pt.y, 2);
    });
  }

  // ─── Grid ─────────────────────────────────────────────────────────────────

  private buildGrid(): void {
    const gc = this.effectiveCols;
    const cs = this.effectiveCellSize;
    const availableSlots = Math.min(GRID_ROWS * gc, this.baseSlots + this.wisdomBonuses.extraSlots);
    let slotIndex = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      this.rooms[row] = [];
      for (let col = 0; col < gc; col++) {
        const cx = GRID_X + col * cs + cs / 2;
        const cy = GRID_Y + row * cs + cs / 2;
        const flatIdx = row * gc + col;
        let state: 'empty' | 'locked' | 'water';
        if (this.waterCells.has(flatIdx)) {
          state = 'water';
        } else {
          state = slotIndex < availableSlots ? 'empty' : 'locked';
          slotIndex++;
        }
        const room = new Room(this, cx, cy, row, col, state, (r) => this.onRoomClick(r), cs);
        room.setDepth(10);
        this.rooms[row][col] = room;
      }
    }

    // Pre-load dungeon slot configuration (monsters + traps) into room data
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < gc; col++) {
        const idx  = row * gc + col;
        const slot = this.dungeonTrapSlots[idx];
        if (!slot) continue;
        const room = this.rooms[row][col];
        if (room.state !== 'empty') continue;
        // Sync monster slots into RoomData after player buys a room (not pre-built here)
        // but store monsterIds on the room for access during combat setup
        (room as unknown as Record<string, unknown>)['_slotMonsterIds'] = slot.monsterIds ?? [];
        (room as unknown as Record<string, unknown>)['_slotTrapIds']    = slot.trapIds    ?? [];
        (room as unknown as Record<string, unknown>)['_slotRoomType']   = slot.roomType;
        (room as unknown as Record<string, unknown>)['_slotRoomLevel']  = slot.roomLevel;
      }
    }
  }

  // ─── Torches ──────────────────────────────────────────────────────────────

  private placeTorches(): void {
    TORCH_POSITIONS.forEach(({ x, y }) => new Torch(this, x, y));
  }

  // ─── Atmosphere ───────────────────────────────────────────────────────────

  private addDustMotes(): void {
    const cs = this.effectiveCellSize;
    this.add.particles(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * cs / 2, 'dust', {
      x: { min: -CANVAS_WIDTH / 2, max: CANVAS_WIDTH / 2 },
      y: { min: -GRID_ROWS * cs / 2, max: GRID_ROWS * cs / 2 },
      speedX: { min: -6, max: 6 }, speedY: { min: -4, max: 4 },
      alpha: { min: 0.05, max: 0.18 }, scale: { min: 0.3, max: 0.9 },
      lifespan: { min: 4000, max: 9000 }, frequency: 700, quantity: 1,
    }).setDepth(30);
  }

  private addFog(): void {
    const fog = this.add.graphics().setDepth(90);
    fog.fillGradientStyle(
      COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, 0, 0, 0.88, 0.88,
    );
    fog.fillRect(0, FOG_START_Y, CANVAS_WIDTH, FOG_HEIGHT);

    // Scattered floor candles
    [{ x: 60, y: CANVAS_HEIGHT - 100 }, { x: 200, y: CANVAS_HEIGHT - 85 }, { x: 330, y: CANVAS_HEIGHT - 110 }]
      .forEach(({ x, y }) => {
        const c = this.add.graphics().setDepth(91);
        c.fillStyle(0xd4c8a0, 0.6); c.fillRect(x - 2, y, 5, 14);
        c.fillStyle(COLORS.TORCH_GLOW, 0.75); c.fillTriangle(x + 0.5, y - 10, x - 5, y + 1, x + 6, y + 1);
        c.fillStyle(0xffee44, 0.7);           c.fillTriangle(x + 0.5, y - 5,  x - 3, y + 1, x + 4, y + 1);
        this.tweens.add({
          targets: c, scaleX: { from: 0.85, to: 1.15 }, alpha: { from: 0.5, to: 0.85 },
          duration: Phaser.Math.Between(600, 1000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });
  }

  // ─── Wave Button ──────────────────────────────────────────────────────────

  private buildWaveButton(): void {
    const bw = 270, bh = 60;   // 60px height meets Apple HIG 44pt minimum
    const bx = CANVAS_WIDTH / 2 - bw / 2;
    const by = GRID_Y + GRID_ROWS * this.effectiveCellSize + 20;

    this.waveBtnBg = this.add.graphics().setDepth(60);
    this.drawBtn(this.waveBtnBg, bx, by, bw, bh, false);

    this.waveLabel = this.add.text(CANVAS_WIDTH / 2, by + bh / 2, '⚔  침략 시작', {
      fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold', color: CSS.PARCHMENT,
    }).setOrigin(0.5).setDepth(61);

    this.waveBtnZone = this.add.zone(CANVAS_WIDTH / 2, by + bh / 2, bw, bh)
      .setInteractive().setDepth(62);
    this.waveBtnZone.on('pointerover', () => {
      if (this.waveActive || this.prepActive) return;
      this.drawBtn(this.waveBtnBg, bx, by, bw, bh, true);
      this.waveLabel.setColor(CSS.TORCH_AMBER);
    });
    this.waveBtnZone.on('pointerout', () => {
      this.drawBtn(this.waveBtnBg, bx, by, bw, bh, false);
      this.waveLabel.setColor(CSS.PARCHMENT);
    });
    this.waveBtnZone.on('pointerdown', () => {
      if (!this.waveActive && !this.prepActive) this.tryShowWaveEvent();
    });
  }

  private drawBtn(
    g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean,
  ): void {
    g.clear();
    g.fillStyle(hover ? 0xaa0000 : COLORS.BLOOD_RED, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(2, hover ? COLORS.TORCH_AMBER : COLORS.TORCH_GOLD, hover ? 0.9 : 0.55);
    g.strokeRoundedRect(x, y, w, h, 6);
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.38, 4);
  }

  // ─── Panel ────────────────────────────────────────────────────────────────

  private buildPanel(): void {
    this.panel = new RoomSelectionPanel(
      this,
      (row, col, type) => this.placeRoom(row, col, type),
      () => { this.selectedRoom?.deselect(); this.selectedRoom = null; },
    );
  }

  private buildMonsterPanel(): void {
    this.monsterPanel = new MonsterSelectPanel(
      this,
      (row, col, id) => this.assignMonster(row, col, id),
      () => { /* no-op: room already placed */ },
    );
  }

  private buildUpgradePanel(): void {
    this.upgradePanel = new RoomUpgradePanel(
      this,
      (row, col) => this.upgradeRoom(row, col),
      () => { /* closed */ },
    );
  }

  // ─── Room Interaction ─────────────────────────────────────────────────────

  private onRoomClick(room: Room): void {
    if (room.state === 'water') return;  // water cells are non-interactive

    // ── Swap mode: if manager is active, route tap to it ──
    if (this.swapManager?.isInSwapMode()) {
      this.swapManager.onRoomTap(room.row, room.col);
      return;
    }
    // Start long-press detection for swap (only during wave on occupied rooms)
    if (this.waveActive && room.state === 'occupied') {
      this.swapManager?.onRoomPointerDown(room.row, room.col);
    }

    // ── SkillHUD targeting mode: activate selected skill on tapped room ──
    if (this.targetingSkillId && room.state === 'occupied' && room.roomData) {
      const skillId = this.targetingSkillId;
      const sk = ACTIVE_SKILLS.find(s => s.id === skillId);
      if (sk) {
        this.activateSkill(skillId, room);
        const cdKey = `${skillId}:${room.row}:${room.col}`;
        const eqCdMult = room.roomData?.monsterSlot ? (this.equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1) : 1;
        const cdMs = sk.cooldown * 1000 * eqCdMult;
        this.skillCooldowns.set(cdKey, this.time.now + cdMs);
        this.skillHUD?.startCooldown(skillId, cdMs);
        // Daily challenge: skill_use
        const gs_sk = loadGameState();
        tickDailyChallenge(gs_sk, 'skill_use');
        saveGameState(gs_sk);
      }
      this.targetingSkillId = null;
      this.skillHUD?.clearSelection();
      return;
    }

    // During a wave: tapping a damaged occupied room shows repair option
    if (this.waveActive && room.state === 'occupied' && room.roomData &&
        room.roomData.roomHp < room.roomData.maxRoomHp) {
      this.showRepairOption(room.row, room.col);
      return;
    }

    // During a wave: tapping an occupied room shows active skill popup
    if (this.waveActive && room.state === 'occupied' && room.roomData) {
      this.showSkillPopup(room);
      return;
    }

    this.skillPopup?.destroy(); this.skillPopup = undefined;

    if (room.state === 'empty') {
      if (this.selectedRoom === room) {
        room.deselect();
        this.selectedRoom = null;
        this.panel.close();
        return;
      }
      this.selectedRoom?.deselect();
      room.select();
      this.selectedRoom = room;
      this.panel.open(room.row, room.col, this.gold);

    } else if (room.state === 'occupied' && room.roomData) {
      const hasMonstersAvailable = getMonstersForRoom(room.roomData.type, this.unlockedStage).length > 0;
      if (hasMonstersAvailable && !room.roomData.monsterSlot) {
        // No monster assigned yet — open monster panel first
        this.monsterPanel.open(room.row, room.col, room.roomData.type, this.unlockedStage);
      } else {
        // Monster assigned (or no monsters for this room type) — open upgrade panel
        this.upgradePanel.open(room.row, room.col, room.roomData);
      }
    }
  }

  // ─── Active Skill Popup ───────────────────────────────────────────────────

  private showSkillPopup(room: Room): void {
    // Dismiss if tapping same room twice
    if (this.skillPopup) {
      this.skillPopup.destroy();
      this.skillPopup = undefined;
      return;
    }

    const gs = loadGameState();
    const monsterId = room.roomData?.monsterSlot;
    const om = monsterId ? gs.ownedMonsters.find(m => m.id === monsterId) : undefined;
    const skills = om?.equippedSkills ?? [];

    // Even without owned monster skills, show an empty-state tip briefly
    if (skills.length === 0) {
      const tip = this.add.text(room.x, room.y - 40, '장착된 스킬 없음', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#888888',
        backgroundColor: '#111111', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(200);
      this.time.delayedCall(1200, () => tip.destroy());
      return;
    }

    const popup = this.add.container(0, 0).setDepth(200);
    this.skillPopup = popup;

    // Dim background click to close
    const dismissZone = this.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT).setInteractive();
    dismissZone.on('pointerdown', () => { popup.destroy(); this.skillPopup = undefined; });
    popup.add(dismissZone);

    const btnW = 90, btnH = 56, gap = 8;
    const totalW = skills.length * btnW + (skills.length - 1) * gap;
    const startX = room.x - totalW / 2;
    const py     = Math.max(room.y - btnH - 12, 100);

    skills.forEach((skillId, i) => {
      const sk = ACTIVE_SKILLS.find(s => s.id === skillId);
      if (!sk) return;

      const bx = startX + i * (btnW + gap);
      const by = py;
      const cdKey = `${room.row}_${room.col}_${skillId}`;
      const now   = this.time.now;
      const ready = (this.skillCooldowns.get(cdKey) ?? 0) <= now;

      // Button bg
      const bg = this.add.graphics();
      bg.fillStyle(ready ? 0x1a0030 : 0x1a1a1a, 1);
      bg.fillRoundedRect(bx, by, btnW, btnH, 8);
      bg.lineStyle(2, ready ? 0xaa44ff : 0x444444, 0.9);
      bg.strokeRoundedRect(bx, by, btnW, btnH, 8);
      popup.add(bg);

      const iconT = this.add.text(bx + btnW / 2, by + 14, sk.icon, {
        fontFamily: 'sans-serif', fontSize: '18px',
      }).setOrigin(0.5);
      popup.add(iconT);

      const nameT = this.add.text(bx + btnW / 2, by + 32, sk.name, {
        fontFamily: 'sans-serif', fontSize: '9px', color: ready ? '#cc88ff' : '#555555',
        wordWrap: { width: btnW - 6 }, align: 'center',
      }).setOrigin(0.5);
      popup.add(nameT);

      const cdLeft = ready ? '준비됨' : `${Math.ceil(((this.skillCooldowns.get(cdKey) ?? 0) - now) / 1000)}s`;
      const cdT = this.add.text(bx + btnW / 2, by + 48, cdLeft, {
        fontFamily: 'sans-serif', fontSize: '8px', color: ready ? '#44ff88' : '#ff6644',
      }).setOrigin(0.5);
      popup.add(cdT);

      if (ready) {
        const zone = this.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH).setInteractive();
        zone.on('pointerdown', () => {
          this.activateSkill(skillId, room);
          const eqCdMult2 = room.roomData?.monsterSlot ? (this.equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1) : 1;
          this.skillCooldowns.set(cdKey, now + sk.cooldown * 1000 * eqCdMult2);
          popup.destroy(); this.skillPopup = undefined;
        });
        popup.add(zone);
      }
    });
  }

  private activateSkill(skillId: string, room: Room): void {
    audioManager.playSfx('skill_activate');
    // Track skill_use daily challenge
    const gs_skill = loadGameState();
    tickDailyChallenge(gs_skill, 'skill_use');
    saveGameState(gs_skill);
    const now   = this.time.now;
    const row   = room.row;
    const invaders = this.activeInvaders.filter(i => i.active && !i.isDead);

    const flashText = (msg: string, color = '#ffffff') => {
      const t = this.add.text(room.x, room.y - 20, msg, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
        color, stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(250);
      this.tweens.add({ targets: t, y: room.y - 60, alpha: 0, duration: 900,
        onComplete: () => t.destroy() });
    };

    switch (skillId) {
      case 'fire_burst': {
        const rowInvs = invaders.filter(inv => Math.abs(inv.y - room.y) < this.effectiveCellSize);
        rowInvs.forEach(inv => inv.takeDamage(200));
        flashText(`🔥 화염 폭발! -200`, '#ff6600');
        break;
      }
      case 'ice_arrow': {
        invaders.slice(0, 3).forEach(inv => inv.applyFreeze(2000));
        flashText('❄️ 빙결!', '#88ddff');
        break;
      }
      case 'lightning': {
        const targets = invaders.slice(0, 5);
        targets.forEach((inv, i) => {
          this.time.delayedCall(i * 80, () => { if (!inv.isDead) inv.takeDamage(100); });
        });
        flashText('⚡ 연쇄 번개!', '#ffff44');
        break;
      }
      case 'poison_cloud': {
        invaders.forEach(inv => inv.applyBurn(now));
        flashText('🌫️ 독 안개!', '#88ff44');
        break;
      }
      case 'heavy_strike': {
        if (room.roomData) room.roomData.nextAttack3x = true;
        flashText('💥 강타 준비!', '#ff8800');
        break;
      }
      case 'fortress': {
        if (room.roomData) room.roomData.immuneUntil = now + 10000;
        flashText('🏰 철옹성!', '#88ccff');
        break;
      }
      case 'heal_room': {
        if (room.roomData) {
          room.roomData.roomHp = Math.min(room.roomData.maxRoomHp, room.roomData.roomHp + 100);
          room.updateHpBar?.();
        }
        flashText('💚 회복 +100', '#44ff88');
        break;
      }
      case 'shield': {
        // Adjacent rooms (same row ±1 col, and ±1 row same col)
        const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
        neighbors.forEach(([dr, dc]) => {
          const d = this.roomGrid[row + dr]?.[room.col + dc];
          if (d) d.immuneUntil = now + 5000;
        });
        flashText('🛡️ 보호막!', '#aaaaff');
        break;
      }
      case 'gold_rush': {
        this.gold += 200;
        this.registry.set('gold', this.gold);
        this.showGoldFloat('+200 💰', room.x, room.y - 30);
        flashText('💰 골드 +200!', '#ffdd44');
        break;
      }
      case 'speed_up': {
        // All monsters attack speed boost: reduce cooldownLeft temporarily
        // Approximate by granting all rooms a 50% cooldown reduction for 8s
        for (const r of this.roomGrid)
          for (const d of r)
            if (d) d.speedBoostUntil = now + 8000;
        flashText('🌀 속도 증가!', '#44ffcc');
        break;
      }
      case 'summon_ghost': {
        this.spawnGhostWarrior(row, room.col);
        flashText('👻 소환!', '#cc88ff');
        break;
      }
      case 'timestop': {
        invaders.forEach(inv => inv.applyFreeze(3000));
        flashText('⏸️ 시간 정지!', '#ffffff');
        break;
      }
      case 'curse_all': {
        invaders.forEach(inv => { inv.applyRoot(1000); inv.applyBurn(now); });
        flashText('🔮 저주!', '#9944ff');
        break;
      }
      case 'healing_rain': {
        for (const r of this.roomGrid)
          for (const d of r)
            if (d) d.roomHp = Math.min(d.maxRoomHp, d.roomHp + 30);
        this.rooms.forEach(rRow => rRow.forEach(r => r?.updateHpBar?.()));
        flashText('🌧️ 치유의 비!', '#44ccff');
        break;
      }
      case 'rage': {
        if (room.roomData) room.roomData.rageUntil = now + 10000;
        flashText('😤 분노!', '#ff4444');
        break;
      }
      default:
        flashText('✨', '#ffffff');
    }
  }

  private placeRoom(row: number, col: number, type: RoomType): void {
    const def            = ROOM_DEFS[type];
    const effectiveCost  = Math.round(def.cost * this.wisdomBonuses.roomCostMult);
    if (this.gold < effectiveCost) {
      this.panel.shakeInsufficient();
      return;
    }
    this.gold -= effectiveCost;
    this.registry.set('gold', this.gold);
    audioManager.playSfx('room_build');
    {
      const gs_q = loadGameState();
      this.tickQuestAndNotify(gs_q, 'build_room');
      saveGameState(gs_q);
    }

    const room = this.rooms[row][col];
    room.occupyWith(type);
    room.deselect();
    this.selectedRoom = null;
    this.roomGrid[row][col] = room.roomData;

    // Ch3: initialize room structural HP bar
    if (this.stageChapter >= 3) {
      room.initRoomHp(ROOM_DEFS[type].baseHp);
    }

    this.spawnBuildParticles(room.x, room.y);
    logger.debug(`[PLACE] ${type} at [${row},${col}] | gold left: ${this.gold}`);

    // Track for achievements
    const gs1 = loadGameState();
    gs1.roomsBuilt = gs1.roomsBuilt ?? [];
    gs1.roomsBuilt.push(type);
    saveGameState(gs1);
    this.checkAchievementsAndToast(gs1);

    // Auto-assign pre-configured monsters from home slot data
    const flatIdx  = row * this.effectiveCols + col;
    const homeSlot = this.dungeonTrapSlots[flatIdx];
    const data     = this.roomGrid[row][col];
    if (homeSlot && data) {
      // Broken room: HP depleted — show crack visual, skip all assignment
      if (homeSlot.hp <= 0) {
        this.rooms[row][col].setBrokenState();
        logger.debug(`[BROKEN] slot ${flatIdx}: room destroyed, skipping assignment`);
        this.recalcRoomTypeBonuses();
        return;
      }

      // Show room type icon badge in top-left corner
      const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === homeSlot.roomType);
      if (typeDef) this.rooms[row][col].setRoomTypeBadge(typeDef.icon);

      const validIds = (homeSlot.monsterIds ?? []).filter(Boolean) as import('../data/monsters').MonsterId[];
      if (validIds.length > 0) {
        // Assign primary monster (reuse existing assignMonster path)
        this.assignMonster(row, col, validIds[0]);
        // Magic room: -20% attack cooldown (applied after assignMonster which may override cd)
        if (homeSlot.roomType === 'magic') {
          data.attackCooldown = Math.round(data.attackCooldown * 0.8);
          logger.debug(`[MAGIC ROOM] slot ${flatIdx}: cd → ${data.attackCooldown}ms`);
        }
        // Populate extra monsters
        data.monsterSlots = validIds;
        logger.debug(`[AUTO-ASSIGN] slot ${flatIdx}: ${validIds.join(', ')}`);
        this.recalcRoomTypeBonuses();
        return;   // skip manual monster picker
      }
      // Even without monsters, recalc bonuses (support room may affect others)
      this.recalcRoomTypeBonuses();
    }

    // Open monster panel if this room type supports monsters
    const available = getMonstersForRoom(type, this.unlockedStage);
    if (available.length > 0) {
      window.setTimeout(() => {
        this.monsterPanel.open(row, col, type, this.unlockedStage);
      }, 200);
    }
  }

  private assignMonster(row: number, col: number, id: MonsterId): void {
    const data = this.roomGrid[row][col];
    if (!data) return;
    data.monsterSlot = id;
    data.hasFirstStrikeUsed = false;
    const mDef = MONSTER_DEFS[id];
    if (!mDef) return;
    // Update effective cooldown to monster's cooldown
    if (mDef.attackCooldown > 0) data.attackCooldown = mDef.attackCooldown;
    // Equipment: roomHpBonus
    const eqS = this.equipmentMap.get(id);
    if (eqS?.roomHpBonus) this.rooms[row][col].addBonusHp(eqS.roomHpBonus);
    this.rooms[row][col].setMonsterSprite(id, mDef.emoji);
    audioManager.playSfx('monster_place');
    {
      const gs_q = loadGameState();
      this.tickQuestAndNotify(gs_q, 'assign_monster');
      saveGameState(gs_q);
    }
    logger.debug(`[MONSTER] ${id} → [${row},${col}]`);
    this.synergyManager.recalc(this.roomGrid, this.effectiveCols);
  }

  private upgradeRoom(row: number, col: number): void {
    const data = this.roomGrid[row][col];
    const room = this.rooms[row][col];
    if (!data || !room.roomData || data.level >= MAX_ROOM_LEVEL) return;

    const cost = getUpgradeCost(data.type, data.level);
    if (this.gold < cost) {
      this.registry.set('status', `강화 비용: ${cost}💰 — 골드 부족`);
      window.setTimeout(() => this.registry.set('status', ''), 2000);
      return;
    }

    this.gold -= cost;
    this.registry.set('gold', this.gold);
    audioManager.playSfx('room_upgrade');
    {
      const gs_q = loadGameState();
      this.tickQuestAndNotify(gs_q, 'upgrade_room');
      saveGameState(gs_q);
    }

    // Apply upgrade (data and room.roomData are the same object)
    data.level++;

    // Improve cooldown if no monster overriding it
    if (!data.monsterSlot) {
      const def = ROOM_DEFS[data.type];
      data.attackCooldown = Math.round(def.attackCooldown * Math.pow(0.75, data.level - 1));
    }

    // Redraw level badge + gold flash
    room.upgrade();

    // Gold spark burst
    this.spawnBuildParticles(room.x, room.y);

    logger.debug(`[UPGRADE] ${data.type} → Lv${data.level} cooldown=${data.attackCooldown}ms at [${row},${col}]`);
  }

  // ─── Build particles ──────────────────────────────────────────────────────

  private spawnBuildParticles(x: number, y: number): void {
    const e = this.add.particles(x, y, 'dust', {
      speed: { min: 25, max: 90 }, angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [COLORS.STONE_DARK, COLORS.STONE_MID, COLORS.TORCH_GOLD],
      lifespan: 420, quantity: 12, frequency: -1,
    }).setDepth(45);
    e.explode(12);
    this.time.delayedCall(500, () => e.destroy());
  }

  // ─── Wave Flow ────────────────────────────────────────────────────────────

  private startWave(): void {
    if (this.wave >= this.maxWave) return;
    this.wave++;
    this.waveActive = true;
    this.registry.set('wave', this.wave);
    this.waveLabel.setText(`⚔  ${this.wave}번 침략 진행 중...`).setColor(CSS.PARCHMENT_MUTED);

    // Endless mode: flash new record
    if (this.isEndless && !this.endlessRecordBroken && this.endlessHighScore > 0 && this.wave > this.endlessHighScore) {
      this.endlessRecordBroken = true;
      const rt = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, '🏆 신기록!', {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(300).setAlpha(0);
      this.tweens.add({ targets: rt, alpha: 1, y: rt.y - 30, duration: 600, ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({ targets: rt, alpha: 0, delay: 1200, duration: 400,
          onComplete: () => rt.destroy() }) });
    }
    this.waveBtnBg.setAlpha(0.4);
    this.waveBtnZone.disableInteractive();

    this.waveEndChecked = false;
    this.waveHasSpawned = false;

    // Reset per-wave monster passive state
    for (const row of this.roomGrid)
      for (const data of row)
        if (data) data.hasFirstStrikeUsed = false;

    // Reset per-wave counters
    for (const row of this.roomGrid)
      for (const data of row) {
        if (!data) continue;
        data.foxCharmAttackCount  = 0;
        data.tideHitCount         = 0;
        data.venomHitCount        = 0;
        data.whirlwindHitCount    = 0;
        data.scrollBurstActiveUntil = 0;
        data.deathRattleLastTime  = 0;
      }
    this.recentlyDeadInvaders = [];
    this.tauntBoostActiveUntil = 0;

    // Reset per-wave result stats
    this.killsThisWave      = 0;
    this.breakthruCount     = 0;
    this.waveStartSlotHps   = this.dungeonTrapSlots.map(s => s?.hp ?? 0);
    this.waveStartDungeonHp = this.dungeonHp;

    // Reset wave event multipliers
    this.waveGoldMult = 1;
    this.waveHpMult   = 1;
    this.waveAtkMult  = 1;
    this.waveSpdMult  = 1;
    if (this.waveFogOverlay) { this.waveFogOverlay.destroy(); this.waveFogOverlay = undefined; }

    if (this.stageChapter >= 3) this.updateArmoryBonuses();

    // Lv3 scroll_library SCROLL_BURST: 2× for all magic rooms for 4000ms
    for (const row of this.roomGrid)
      for (const data of row) {
        if (data?.type === 'scroll_library' && data.level >= 3) {
          this.triggerScrollBurst(data);
        }
      }

    if (this.isEndless) {
      // ── Endless mode spawn ────────────────────────────────────────────────
      this.spawnQueue = buildEndlessSpawnQueue(this.wave);
      this.showEndlessMilestoneToast();
      this.processSpawnQueue(0);
      logger.debug(`[ENDLESS WAVE ${this.wave}] spawning ${this.spawnQueue.length} invaders`);
    } else {
      // ── Normal mode spawn ─────────────────────────────────────────────────
      const cfg = this.waveConfigs[Math.min(this.wave - 1, this.waveConfigs.length - 1)];
      this.spawnQueue = [];
      cfg.invaders.forEach(({ type, count, spawnDelay }) => {
        for (let i = 0; i < count; i++) {
          this.spawnQueue.push({ def: INVADER_DEFS[type], delay: spawnDelay });
        }
      });

      // Boss drama: final wave (stage) OR every 10 waves (endless)
      const isBoss = this.isEndless ? (this.wave % 10 === 0) : (this.wave === this.maxWave);
      if (isBoss) this.showBossWarning();

      this.processSpawnQueue(isBoss ? 3000 : 0);
      logger.debug(`[WAVE ${this.wave}] spawning ${this.spawnQueue.length} invaders`);
    }
  }

  private processSpawnQueue(initialDelay: number): void {
    let acc = initialDelay;
    this.spawnQueue.forEach((item) => {
      this.time.delayedCall(acc, () => {
        if (!this.waveActive) return;
        this.spawnInvaderWithDef(item.def);
      });
      acc += item.delay;
    });
    this.spawnQueue = [];
  }

  private spawnInvader(type: InvaderType): void {
    this.spawnInvaderWithDef(INVADER_DEFS[type]);
  }

  private spawnInvaderWithDef(def: InvaderDef): void {
    // Apply wave event modifiers (curse HP, fog speed) + daily mode speed
    const dailySpd = this.dailyMode?.modifiers.invaderSpeedMult ?? 1;
    const modDef = (this.waveHpMult !== 1 || this.waveSpdMult !== 1 || dailySpd !== 1)
      ? { ...def, hp: Math.round(def.hp * this.waveHpMult), speed: Math.round(def.speed * this.waveSpdMult * dailySpd) }
      : def;
    const inv = new Invader(this, this.invaderPath, modDef);
    inv.setDepth(40);
    this.activeInvaders.push(inv);
    this.waveHasSpawned = true;

    // ── Ch2 invader behavior setup ─────────────────────────────────────────
    switch (def.behavior) {
      case 'SIEGE_SHIELD':
        inv.hasSiegeShield = true;
        break;
      case 'TRAP_IMMUNITY':
        inv.isTrapImmune = true;
        break;
      case 'BERSERKER_RAGE':
        inv.hasBerserkerRage = true;
        break;
      case 'IRON_BODY':
        inv.hasIronBody   = true;
        inv.isUnstoppable = true;
        break;
      case 'STEALTH':
        inv.isInvisible    = true;
        inv.voidPhaseUntil = this.time.now + 3000;
        inv.setAlpha(0.25);
        this.scheduleNinjaInvisibilityCycle(inv);
        break;
      case 'DIVINE_WARD':
        if (def.type === 'holy_paladin') {
          inv.magicImmuneUntil = this.time.now + 5000;
          this.showHolyPaladinAura(inv);
        } else {
          inv.isMagicImmune = true;
        }
        break;
      case 'RALLY_CRY':
        if (def.type !== 'mercenary_captain') {
          this.time.delayedCall(200, () => {
            if (!inv.active) return;
            this.activeInvaders.forEach(other => {
              if (other !== inv && other.active
                  && Math.hypot(other.x - inv.x, other.y - inv.y) < 200)
                other.applySpeedBoost(1.2, 5000);
            });
            this.showRallyCryEffect(inv.x, inv.y);
          });
        }
        break;
      case 'FOX_QUEEN_PHASE':
        this.setupFoxQueenPhase(inv);
        break;
      // ── Chapter 3 behaviors ──────────────────────────────────────────────
      case 'UNDYING_KNIGHT':
        this.setupUndyingKnight(inv);
        break;
      case 'DECOY_CLONE':
        this.setupDecoyClone(inv);
        break;
      case 'POISON_TRAIL':
        // handled per-tick in runPoisonTrailDamage
        break;
      case 'VOID_TELEPORT':
        this.scheduleVoidTeleport(inv);
        break;
      case 'DRAGON_KING_PHASE':
        this.setupDragonKingPhase(inv);
        break;
      // ── Chapter 4 behaviors ──────────────────────────────────────────────
      case 'VOID_STEALTH_ELITE':
        this.setupVoidStealthElite(inv);
        break;
      case 'STUN_IMMUNE':
        inv.isDamageImmune = true;
        this.setupDeathEmissary(inv);
        break;
      // ── Chapter 5 behaviors ──────────────────────────────────────────────
      case 'FIVE_PHASE':
        this.setupThreeGodDestroyer(inv);
        break;
      // ── Chapter 6 behaviors ──────────────────────────────────────────────
      case 'MIRROR_SHIELD':
        inv.hasMirrorShield = true;
        inv.mirrorHitsRemaining = 3;
        inv.mirrorGfx = this.add.graphics().setDepth(inv.depth + 1);
        break;
      case 'SWARM':
        // Handled in invaderKilled event (splits on death)
        break;
      case 'SHADOW_REALM':
        this.setupShadowRealm(inv);
        break;
      case 'EMPEROR_PHASE':
        this.setupEternalEmperor(inv);
        break;
    }
  }

  private triggerScrollBurst(libraryData: RoomData): void {
    libraryData.scrollBurstActiveUntil = this.time.now + 4000;
    // Purple wave ripple visual from this library's room
    for (let row = 0; row < GRID_ROWS; row++)
      for (let col = 0; col < this.effectiveCols; col++) {
        const d = this.roomGrid[row][col];
        if (d === libraryData) {
          const g = this.add.graphics().setDepth(50);
          g.lineStyle(3, 0xaa44ff, 0.9);
          g.strokeCircle(this.rooms[row][col].x, this.rooms[row][col].y, 10);
          this.tweens.add({ targets: g, scaleX: 10, scaleY: 10, alpha: 0, duration: 600,
            onComplete: () => g.destroy() });
          const t = this.add.text(this.rooms[row][col].x, this.rooms[row][col].y - 20, '📜 폭발!', {
            fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
          }).setOrigin(0.5).setDepth(51);
          this.tweens.add({ targets: t, y: this.rooms[row][col].y - 50, alpha: 0, duration: 800,
            onComplete: () => t.destroy() });
        }
      }
    logger.debug('[SCROLL_BURST] Lv3 burst — 2× magic dmg for 4s');
  }

  // ─── Dungeon slot trap effects ────────────────────────────────────────────

  // Column center X positions for the 3 grid columns
  private static readonly TRAP_COL_CENTERS = [
    GRID_X + CELL_SIZE * 0.5,   // col 0: x ≈ 85
    GRID_X + CELL_SIZE * 1.5,   // col 1: x ≈ 195
    GRID_X + CELL_SIZE * 2.5,   // col 2: x ≈ 305
  ];

  private runTrapEffects(now: number): void {
    if (this.dungeonTrapSlots.length === 0) return;
    for (const inv of this.activeInvaders) {
      if (!inv.active || inv.isDead || inv.isTrapImmune) continue;
      if (!('_trapCols' in inv)) (inv as unknown as Record<string, unknown>)['_trapCols'] = new Set<number>();
      const triggered = (inv as unknown as Record<string, unknown>)['_trapCols'] as Set<number>;

      for (let col = 0; col < 3; col++) {
        const cx = DungeonScene.TRAP_COL_CENTERS[col];
        if (Math.abs(inv.x - cx) > 45 || triggered.has(col)) continue;
        triggered.add(col);

        // Check all rows of dungeonSlots for this column
        for (let row = 0; row < GRID_ROWS; row++) {
          const slotIdx = row * 3 + col;
          const slot    = this.dungeonTrapSlots[slotIdx];
          if (!slot) continue;
          for (const trapId of (slot.trapIds ?? [])) {
            this.applyTrapToInvader(inv, slot, slotIdx, trapId, now);
          }
        }
      }
    }
  }

  private applyTrapToInvader(
    inv: import('../objects/Invader').Invader,
    slot: import('../data/wisdom').DungeonSlot,
    slotIdx: number,
    trapId: string | undefined,
    now: number,
  ): void {
    if (!trapId || slot.hp <= 0) return;   // broken rooms don't trigger traps
    // Trap room bonus: +20% trap damage + synergy bonus (함정+지원 인접 +15%)
    const trapRoomMult  = slot.roomType === 'trap' ? 1.2 : 1.0;
    const synergyMult   = this.slotTrapSynergyMult.get(slotIdx) ?? 1.0;
    const dmgMult = slot.roomLevel * trapRoomMult * synergyMult;
    switch (trapId) {
      case 'spike_trap': {
        const dmg = 20 * dmgMult;
        inv.takeDamage(dmg);
        logger.debug(`[TRAP] slot${slotIdx} spike_trap: ${dmg} dmg`);
        break;
      }
      case 'slow_trap':
        inv.applySlow(0.6, 2000);   // speed × 0.6 = -40%
        logger.debug(`[TRAP] slot${slotIdx} slow_trap: -40% speed 2s`);
        break;
      case 'poison_trap':
        inv.burnStacks.push({ startTime: now, lastTickTime: now, damage: 8, duration: 4000 });
        logger.debug(`[TRAP] slot${slotIdx} poison_trap: DoT 8/s×4s`);
        break;
      case 'stun_trap':
        inv.applyStun(1000);
        logger.debug(`[TRAP] slot${slotIdx} stun_trap: stun 1s`);
        break;
    }
  }

  // ─── Combat (update loop) ─────────────────────────────────────────────────

  private runCombat(now: number): void {
    const cs = this.effectiveCellSize;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || !data.attackCooldown) continue;
        if (now - data.lastAttackTime < data.attackCooldown) continue;

        const mDef        = data.monsterSlot ? (MONSTER_DEFS[data.monsterSlot] ?? null) : null;
        const range       = mDef ? mDef.range : 1;
        const cellCenterY = GRID_Y + row * cs + cs / 2;
        const rowRange    = cs * Math.max(range - 0.2, 0.8);

        let target: Invader | null = null;
        let bestDist = Infinity;
        const isSunDive = mDef?.passive === 'SUN_DIVE';

        for (const inv of this.activeInvaders) {
          if (!inv.active) continue;
          // STUN_IMMUNE bosses: only damageable while stunned — skip them if NOT stunned
          if (inv.isDamageImmune && !inv.isStunned) continue;
          // Void phase / stealth: immune to trap rooms for first N seconds
          if ((data.type === 'trap' || data.type === 'trap_corridor') && now < inv.voidPhaseUntil) continue;
          // TRAP_IMMUNITY: skip trap rooms entirely
          if ((data.type === 'trap' || data.type === 'trap_corridor') && inv.isTrapImmune) continue;
          // Invisible invaders: single-target attacks miss
          if (inv.isInvisible) continue;
          // SUN_DIVE: ignores row restriction, targets highest pathProgress (closest to exit)
          if (isSunDive) {
            const prog = inv.pathTween?.progress ?? 0;
            if (prog > bestDist) { bestDist = prog; target = inv; }
          } else {
            if (Math.abs(inv.y - cellCenterY) > rowRange) continue;
            const dist = Math.hypot(inv.x - this.rooms[row][col].x, inv.y - cellCenterY);
            if (dist < bestDist) { bestDist = dist; target = inv; }
          }
        }

        if (target) {
          // ── Base damage: prefer monster baseDamage when available ─────────
          const baseDmg = (mDef && mDef.baseDamage > 0)
            ? mDef.baseDamage
            : ROOM_DEFS[data.type].attackDamage;
          let dmg = baseDmg * Math.pow(1.4, data.level - 1) * data.roomTypeDmgMult * this.waveAtkMult;

          // ── Equipment bonus ─────────────────────────────────────────────
          const eqStats = data.monsterSlot ? this.equipmentMap.get(data.monsterSlot) : undefined;
          if (eqStats?.atkMult) dmg *= (1 + eqStats.atkMult);

          // ── Scroll Library aura bonus (+15/25/40% to magic monsters) ─────
          const isMagicMonster = mDef?.type === 'magic';
          if (isMagicMonster) {
            for (let sr = 0; sr < GRID_ROWS; sr++) {
              for (let sc = 0; sc < this.effectiveCols; sc++) {
                const sd = this.roomGrid[sr][sc];
                if (!sd || sd.type !== 'scroll_library') continue;
                const dist = Math.abs(sr - row) + Math.abs(sc - col);
                if (dist <= 3) {
                  dmg *= 1 + getScrollAuraBonus(sd.level);
                  break;
                }
              }
            }
          }

          // ── Scroll Burst (Lv3 scroll_library active) ─────────────────────
          if (isMagicMonster && this.isScrollBurstActive(row, col, now)) {
            dmg *= 2;
          }

          // ── TAUNTING_ROAR boost: all rooms +30% while active ──────────────
          if (now < this.tauntBoostActiveUntil) dmg *= 1.3;

          // ── Armory bonus: adjacent armory buffs guardian rooms (Ch3) ──────
          if (data.type === 'guardian' && data.armoryDmgBonus > 0) {
            dmg *= (1 + data.armoryDmgBonus);
          }

          // ── DIVINE_TERRITORY (mountain_god): all monsters +20% dmg ─────────
          if (this.hasDivineTerritory()) dmg *= 1.2;

          // ── TRIBE_MASTERY: same-tribe monsters +15% ATK ───────────────────
          if (mDef?.tribe && this.hasTribeMasteryFor(mDef.tribe)) dmg *= 1.15;

          // ── SEASONAL_BOON: all monsters +10% ATK ──────────────────────────
          if (this.hasSeasonalBoon()) dmg *= 1.10;

          // ── GHOST_ARROW: attacks ignore armor — bypass damage reductions ──
          const isGhostArrow = mDef?.passive === 'GHOST_ARROW';
          if (isGhostArrow) dmg *= 1.30;

          // ── Dragon's Lair: 2× dmg vs boss invaders ────────────────────────
          if (data.type === 'dragons_lair' && target.def.isBoss) dmg *= 2;

          // ── Active skill: heavy_strike (3× next attack) ───────────────────
          if (data.nextAttack3x) { dmg *= 3; data.nextAttack3x = false; }

          // ── Active skill: rage (+100% ATK for 10s) ────────────────────────
          if (now < (data.rageUntil ?? 0)) dmg *= 2;

          // ── Active skill: speed_up (attack 50% faster for 8s) ─────────────
          if (now < (data.speedBoostUntil ?? 0)) data.attackCooldown = ROOM_DEFS[data.type].attackCooldown * 0.5;
          else if (data.speedBoostUntil > 0 && now >= data.speedBoostUntil) {
            data.attackCooldown = ROOM_DEFS[data.type].attackCooldown; data.speedBoostUntil = 0;
          }

          // ── FIRST_STRIKE_STUN passive ──────────────────────────────────────
          if (mDef?.passive === 'FIRST_STRIKE_STUN' && !data.hasFirstStrikeUsed) {
            data.hasFirstStrikeUsed = true;
            dmg *= 2;
            target.applyStun(1500);
            this.showFirstStrikeEffect(this.rooms[row][col].x, cellCenterY);
          }

          // ── EMBER_TRAIL passive ────────────────────────────────────────────
          if (mDef?.passive === 'EMBER_TRAIL' && !target.isFireImmune) {
            target.applyBurn(now);
          }

          // ── PINNING_SHOT passive ───────────────────────────────────────────
          const procB = eqStats?.procBonus ?? 0;
          if (mDef?.passive === 'PINNING_SHOT' && Math.random() < 0.20 + procB) {
            target.applyRoot(800);
          }

          // ── PERMAFROST passive — 30% freeze chance, 1200ms ────────────────
          if (mDef?.passive === 'PERMAFROST' && !target.isFrozen
              && !target.isMagicImmune && now >= target.magicImmuneUntil
              && Math.random() < 0.30 + procB) {
            target.applyFreeze(1200);
          }

          // ── FOX_FIRE_CHARM passive — every 3rd attack, charm orb ──────────
          if (mDef?.passive === 'FOX_FIRE_CHARM'
              && !target.isCharmed && !target.isMagicImmune && now >= target.magicImmuneUntil) {
            data.foxCharmAttackCount++;
            const charmN = eqStats?.charmEvery ?? 3;
            if (data.foxCharmAttackCount % charmN === 0) {
              this.spawnCharmOrb(this.rooms[row][col].x, cellCenterY, target);
              data.lastAttackTime = now;
              this.rooms[row][col].flashAttack();
              continue; // charm orb replaces normal attack
            }
          }

          // ── TIDE_THRUST passive — every 4th hit pushback ─────────────────
          if (mDef?.passive === 'TIDE_THRUST' && !target.isUnstoppable) {
            data.tideHitCount++;
            if (data.tideHitCount % 4 === 0) {
              target.applyPushback(60);
              this.showTideWave(target.x, target.y);
            }
          }

          // ── WAR_HEX passive — handled in per-room interval below ──────────
          // (fox_shaman uses attackCooldown 8000ms as its interval; regular attack does no dmg)
          if (mDef?.passive === 'WAR_HEX') {
            this.applyWarHexToHighestHP();
            data.lastAttackTime = now;
            this.rooms[row][col].flashAttack();
            continue; // no direct damage
          }

          // ── TAUNTING_ROAR passive — 8000ms interval ───────────────────────
          if (mDef?.passive === 'TAUNTING_ROAR') {
            if (now - data.tauntLastTime >= 8000) {
              data.tauntLastTime = now;
              this.triggerTauntingRoar(this.rooms[row][col].x, cellCenterY);
            }
          }

          // ── trap_corridor per-level effects ───────────────────────────────
          if (data.type === 'trap_corridor') {
            // Lv1: slow 40% for 2s + base spike dmg
            target.applySlow(0.6, 2000);
            // Lv2+: poison 8 dmg/s for 4s (reuse burn with modified damage)
            if (data.level >= 2) target.applyBurn(now);
            // Lv3: bonus fire dmg + frozen invaders take 2× spike
            if (data.level >= 3) {
              dmg += 20;
              if (target.isFrozen) dmg *= 2;
            }
            this.showTrapRing(this.rooms[row][col].x, cellCenterY);
          } else if (data.type === 'trap') {
            this.showTrapRing(this.rooms[row][col].x, cellCenterY);
          }

          // ── SIEGE_SHIELD: 50% dmg reduction from trap rooms (GHOST_ARROW ignores) ─
          if (!isGhostArrow && target.hasSiegeShield && (data.type === 'trap' || data.type === 'trap_corridor')) {
            dmg *= 0.5;
          }
          // ── IRON_BODY: halves all damage (GHOST_ARROW ignores) ────────────
          if (!isGhostArrow && target.hasIronBody) dmg *= 0.5;
          // ── DRAGON_KING phase 3: submerged — only traps deal damage ────────
          if (target.isSubmerged && data.type !== 'trap' && data.type !== 'trap_corridor') {
            this.showMagicImmuneMiss(target.x, target.y);
            data.lastAttackTime = now;
            this.rooms[row][col].flashAttack();
            continue;
          }

          // ── DIVINE_WARD: magic attacks miss (full immunity) ───────────────
          if (target.isMagicImmune && (mDef?.type === 'magic')) dmg = 0;
          // ── MAGIC_IMMUNITY_WINDOW: first 5s magic immune ─────────────────
          if (now < target.magicImmuneUntil && (mDef?.type === 'magic')) {
            this.showMagicImmuneMiss(target.x, target.y);
            data.lastAttackTime = now;
            this.rooms[row][col].flashAttack();
            continue;
          }

          // ── SPECTRAL_BOLT: piercing bolt hits all in same row ────────────
          if (mDef?.passive === 'SPECTRAL_BOLT') {
            this.triggerSpectralBolt(this.rooms[row][col].x, cellCenterY, row, Math.round(dmg));
            data.lastAttackTime = now;
            this.rooms[row][col].flashAttack();
            continue;
          }

          // ── WHIRLWIND_DANCE: every 5th hit full-row AoE 150% ────────────
          if (mDef?.passive === 'WHIRLWIND_DANCE') {
            data.whirlwindHitCount++;
            if (data.whirlwindHitCount % 5 === 0) {
              this.triggerWhirlwind(row, Math.round(dmg * 1.5), this.rooms[row][col].x, cellCenterY);
              data.lastAttackTime = now;
              this.rooms[row][col].flashAttack();
              continue;
            }
          }

          // ── Equipment effects: freeze / stun / execute ────────────────
          if (eqStats) {
            if (eqStats.freezeChance && !target.isFrozen && !target.isMagicImmune
                && now >= target.magicImmuneUntil && Math.random() < eqStats.freezeChance) {
              target.applyFreeze(800);
            }
            if (eqStats.stunBonus && target.isStunned) {
              target.applyStun(eqStats.stunBonus);  // extend existing stun
            }
            if (eqStats.executeChance && target.hp > 0 && target.hp < target.maxHp * 0.15
                && !target.def.isBoss && Math.random() < eqStats.executeChance) {
              target.takeDamage(target.hp);
              data.lastAttackTime = now;
              this.rooms[row][col].flashAttack();
              this.showAttackLine(this.rooms[row][col].x, cellCenterY, target.x, target.y);
              continue;
            }
          }

          target.takeDamage(Math.round(dmg));
          data.lastAttackTime = now;
          this.rooms[row][col].flashAttack();
          this.showAttackLine(this.rooms[row][col].x, cellCenterY, target.x, target.y);

          // ── CHAIN_LIGHTNING: chain to 3 nearby at 40% ───────────────────
          if (mDef?.passive === 'CHAIN_LIGHTNING') {
            this.triggerChainLightning(target, Math.round(dmg * 0.4), 3);
          }

          // ── CONSTRICT: 25% chance immobilize 3s + 15dmg/s DoT ────────────
          if (mDef?.passive === 'CONSTRICT' && !target.isUnstoppable && Math.random() < 0.25 + procB) {
            target.applyRoot(3000);
            target.applyBurn(now);   // reuse burn slot for 15dmg/s DoT approximation
            const ct = this.add.text(target.x, target.y - 22, '🐍 속박!', {
              fontFamily: 'sans-serif', fontSize: '10px', color: '#44cc00',
            }).setOrigin(0.5).setDepth(55);
            this.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
            logger.debug('[CONSTRICT] 3s root + DoT applied');
          }

          // ── VENOM_BURST: on hit apply poison stack, burst at 5 stacks ───
          if (mDef?.passive === 'VENOM_BURST') {
            target.addVenomStack();
          }

          // ── CHARM_GAZE: 25% chance to freeze/mesmerize target for 1.5s ───
          if (mDef?.passive === 'CHARM_GAZE'
              && !target.isFrozen && !target.isMagicImmune
              && now >= target.magicImmuneUntil
              && Math.random() < 0.25 + procB) {
            target.applyFreeze(1500);
            const ct = this.add.text(target.x, target.y - 22, '💫 매혹!', {
              fontFamily: 'sans-serif', fontSize: '10px', color: '#ff66cc',
            }).setOrigin(0.5).setDepth(55);
            this.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
          }

          // ── DEATH_RATTLE: every 30s burst 200 dmg to closest invader ──────
          if (mDef?.passive === 'DEATH_RATTLE') {
            if (now - (data.deathRattleLastTime ?? 0) >= 30000) {
              data.deathRattleLastTime = now;
              const closest = this.activeInvaders
                .filter(i => i.active && !i.isDead)
                .sort((a, b) => {
                  const da = Math.hypot(a.x - this.rooms[row][col].x, a.y - cellCenterY);
                  const db = Math.hypot(b.x - this.rooms[row][col].x, b.y - cellCenterY);
                  return da - db;
                })[0];
              if (closest) {
                closest.takeDamage(200);
                const ct = this.add.text(closest.x, closest.y - 22, '💀 죽음의 울림!', {
                  fontFamily: 'sans-serif', fontSize: '10px', color: '#cc0000',
                }).setOrigin(0.5).setDepth(55);
                this.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
                logger.debug('[DEATH_RATTLE] 200 burst dmg to closest invader');
              }
            }
          }

          // ── Dragon's Lair Lv3: 10% Dragon's Roar on any kill (checked after dmg) ─
          if (data.type === 'dragons_lair' && data.level >= 3 && Math.random() < 0.10) {
            this.triggerDragonRoar(this.rooms[row][col].x, cellCenterY);
          }
        }
      }
    }

    // ── Extra monster slots (slots 1+) independent attacks ────────────────────
    this.runExtraMonsterAttacks(now);
  }

  private runExtraMonsterAttacks(now: number): void {
    const cs = this.effectiveCellSize;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || !data.monsterSlots || data.monsterSlots.length <= 1) continue;

        const cellCenterY = GRID_Y + row * cs + cs / 2;
        // Process slots 1+ (slot 0 = primary, already handled by main runCombat)
        for (let si = 1; si < data.monsterSlots.length; si++) {
          const mId = data.monsterSlots[si];
          if (!mId) continue;
          const mDef = MONSTER_DEFS[mId as import('../data/monsters').MonsterId];
          if (!mDef) continue;

          const cdKey = `${row}_${col}_${si}`;
          const lastAt = this.extraMonsterCooldowns.get(cdKey) ?? 0;
          const cd     = mDef.attackCooldown > 0 ? mDef.attackCooldown : data.attackCooldown;
          if (now - lastAt < cd) continue;

          // Find nearest target in row range
          const rowRange = cs * (mDef.range ?? 1) * 0.8;
          let target: import('../objects/Invader').Invader | null = null;
          let bestDist = Infinity;
          for (const inv of this.activeInvaders) {
            if (!inv.active || inv.isInvisible) continue;
            if (Math.abs(inv.y - cellCenterY) > rowRange) continue;
            const d = Math.hypot(inv.x - this.rooms[row][col].x, inv.y - cellCenterY);
            if (d < bestDist) { bestDist = d; target = inv; }
          }
          if (!target) continue;

          this.extraMonsterCooldowns.set(cdKey, now);
          let dmg = (mDef.baseDamage > 0 ? mDef.baseDamage : ROOM_DEFS[data.type].attackDamage)
            * Math.pow(1.4, data.level - 1)
            * data.roomTypeDmgMult;
          if (now < this.tauntBoostActiveUntil) dmg *= 1.3;
          if (this.hasDivineTerritory()) dmg *= 1.2;
          target.takeDamage(dmg);
          this.rooms[row][col].flashAttack();
        }
      }
    }
  }

  private scheduleNinjaInvisibilityCycle(inv: Invader): void {
    // After 3s visible window expires, become visible for 5s, then repeat
    const beVisible = () => {
      if (!inv.active) return;
      inv.isInvisible = false;
      this.tweens.add({ targets: inv, alpha: 1, duration: 300 });
      this.time.delayedCall(5000, () => {
        if (!inv.active) return;
        inv.isInvisible = true;
        this.tweens.add({ targets: inv, alpha: 0.2, duration: 300 });
        this.time.delayedCall(3000, beVisible);
      });
    };
    this.time.delayedCall(3000, beVisible);
  }

  private showHolyPaladinAura(inv: Invader): void {
    const aura = this.add.graphics().setDepth(inv.depth - 1);
    const step = () => {
      if (!inv.active) { aura.destroy(); return; }
      const remaining = inv.magicImmuneUntil - this.time.now;
      if (remaining <= 0) { aura.destroy(); return; }
      const alpha = Math.min(0.6, remaining / 3000) * 0.8;
      aura.clear();
      aura.lineStyle(2.5, 0xffffff, alpha);
      aura.strokeCircle(inv.x, inv.y, inv.def.radius + 8);
      aura.fillStyle(0xffffff, alpha * 0.15);
      aura.fillCircle(inv.x, inv.y, inv.def.radius + 8);
      this.time.delayedCall(80, step);
    };
    step();
  }

  private setupFoxQueenPhase(inv: Invader): void {
    let phase = 1;
    const checkPhase = () => {
      if (!inv.active) return;
      const pct = inv.hp / inv.maxHp;
      if (pct <= 0.6 && phase === 1) {
        phase = 2;
        this.showFoxQueenPhaseTransition(inv, 2);
        // Phase 2: start charming player monsters every 15s
        this.time.addEvent({
          delay: 15000, repeat: -1,
          callback: () => {
            if (!inv.active || phase < 2) return;
            this.foxQueenCharmMonster();
          },
        });
      }
      if (pct <= 0.3 && phase === 2) {
        phase = 3;
        this.showFoxQueenPhaseTransition(inv, 3);
        // Phase 3: spawn 3 shadow ninjas every 20s
        this.time.addEvent({
          delay: 20000, repeat: -1,
          callback: () => {
            if (!inv.active || phase < 3) return;
            for (let i = 0; i < 3; i++)
              this.time.delayedCall(i * 500, () => this.spawnInvader('shadow_ninja'));
            const portal = this.add.text(INVADER_WAYPOINTS[0].x, INVADER_WAYPOINTS[0].y, '🌀', {
              fontFamily: 'sans-serif', fontSize: '24px',
            }).setOrigin(0.5).setDepth(50);
            this.tweens.add({ targets: portal, alpha: 0, duration: 1200, onComplete: () => portal.destroy() });
          },
        });
      }
      this.time.delayedCall(500, checkPhase);
    };
    this.time.delayedCall(500, checkPhase);
  }

  private showFoxQueenPhaseTransition(inv: Invader, phase: number): void {
    this.cameras.main.shake(400, 0.015);
    const colors = ['', '#ff9900', '#ff4400'];
    const t = this.add.text(inv.x, inv.y - 30, `🦊 Phase ${phase}!`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: colors[phase - 1] ?? '#ff4400',
    }).setOrigin(0.5).setDepth(55);
    this.tweens.add({ targets: t, y: inv.y - 65, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
    logger.debug(`[FOX_QUEEN] entering phase ${phase} at ${Math.round((inv.hp / inv.maxHp) * 100)}% HP`);
  }

  private foxQueenCharmMonster(): void {
    // Charm the monster in a random occupied room for 5000ms
    for (let row = 0; row < GRID_ROWS; row++)
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (data?.monsterSlot) {
          const warn = this.add.text(
            this.rooms[row][col].x, this.rooms[row][col].y,
            '홀렸다!', { fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ff66bb' },
          ).setOrigin(0.5).setDepth(55);
          this.tweens.add({ targets: warn, y: this.rooms[row][col].y - 30, alpha: 0, duration: 1200,
            onComplete: () => warn.destroy() });
          // Briefly flash the room pink
          this.rooms[row][col].flashAttack();
          return;  // only one room charmed per trigger
        }
      }
  }

  private showAttackLine(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics().setDepth(45);
    g.lineStyle(1.5, COLORS.TORCH_GOLD, 0.9);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
  }

  private showFirstStrikeEffect(x: number, y: number): void {
    const t = this.add.text(x, y - 10, '일격!', {
      fontFamily: "Georgia, serif", fontSize: '13px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: t, y: y - 45, alpha: 0, duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  private showTigersPounce(rx: number, ry: number, tx: number, ty: number): void {
    // Orange slash line from room to target
    const g = this.add.graphics().setDepth(50);
    g.lineStyle(3, 0xe8a000, 0.9);
    g.lineBetween(rx, ry, tx, ty);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    const t = this.add.text(tx, ty - 16, '포효!', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#e8a000',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({ targets: t, y: ty - 45, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  private showRallyCryEffect(x: number, y: number): void {
    const g = this.add.graphics().setDepth(50);
    g.lineStyle(2.5, 0xffcc00, 0.8);
    g.strokeCircle(x, y, 10);
    this.tweens.add({ targets: g, scaleX: 20, scaleY: 20, alpha: 0, duration: 600,
      onComplete: () => g.destroy() });
    const t = this.add.text(x, y - 18, '집결!', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ffcc00',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({ targets: t, y: y - 48, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private showTrapRing(x: number, y: number): void {
    const g = this.add.graphics().setDepth(45);
    g.lineStyle(2, 0x9040e0, 0.9);
    g.strokeCircle(x, y, 20);
    this.tweens.add({
      targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 400,
      onComplete: () => g.destroy(),
    });
  }

  private isScrollBurstActive(row: number, col: number, now: number): boolean {
    // Check if ANY adjacent (within 3 tiles) scroll_library has burst active
    for (let sr = 0; sr < GRID_ROWS; sr++)
      for (let sc = 0; sc < this.effectiveCols; sc++) {
        const sd = this.roomGrid[sr][sc];
        if (!sd || sd.type !== 'scroll_library') continue;
        if (Math.abs(sr - row) + Math.abs(sc - col) <= 3 && now < sd.scrollBurstActiveUntil) return true;
      }
    return false;
  }

  private spawnCharmOrb(rx: number, ry: number, target: Invader): void {
    const orb = this.add.graphics().setDepth(52);
    orb.fillStyle(0xff44aa, 1);
    orb.fillCircle(rx, ry, 6);
    this.tweens.add({
      targets: orb,
      x: target.x, y: target.y,
      duration: 400, ease: 'Power2',
      onComplete: () => {
        orb.destroy();
        if (target.active) {
          target.applyCharm(3000);
          // Heart burst at impact
          const h = this.add.text(target.x, target.y - 14, '💗', {
            fontFamily: 'sans-serif', fontSize: '16px',
          }).setOrigin(0.5).setDepth(53);
          this.tweens.add({ targets: h, y: target.y - 44, alpha: 0, duration: 700,
            onComplete: () => h.destroy() });
        }
      },
    });
  }

  private showTideWave(tx: number, ty: number): void {
    const g = this.add.graphics().setDepth(50);
    g.lineStyle(2.5, 0x44aaff, 0.9);
    g.strokeCircle(tx, ty, 12);
    this.tweens.add({ targets: g, scaleX: 3, scaleY: 3, alpha: 0, duration: 350,
      onComplete: () => g.destroy() });
    const t = this.add.text(tx, ty - 18, '밀어냄!', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#44aaff',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({ targets: t, y: ty - 45, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  private applyWarHexToHighestHP(): void {
    // Remove hex from previous target
    if (this.hexedInvader?.active) this.hexedInvader.removeHex();
    this.hexedInvader = null;

    // Find invader with highest current HP
    let best: Invader | null = null;
    let bestHp = 0;
    for (const inv of this.activeInvaders) {
      if (inv.active && inv.hp > bestHp) { bestHp = inv.hp; best = inv; }
    }
    if (best) {
      best.applyHex();
      this.hexedInvader = best;
      // Purple skull above
      const t = this.add.text(best.x, best.y - best.def.radius - 16, '💀', {
        fontFamily: 'sans-serif', fontSize: '14px',
      }).setOrigin(0.5).setDepth(52);
      this.tweens.add({ targets: t, y: best.y - best.def.radius - 36, alpha: 0, duration: 800,
        onComplete: () => t.destroy() });
      logger.debug(`[WAR_HEX] targeting hp=${bestHp} — dmg ×1.25`);
    }
  }

  private triggerTauntingRoar(rx: number, ry: number): void {
    // Gold ring pulse from room
    const ring = this.add.graphics().setDepth(50);
    ring.lineStyle(3, COLORS.TORCH_GOLD, 0.9);
    ring.strokeCircle(rx, ry, 12);
    this.tweens.add({ targets: ring, scaleX: 12, scaleY: 12, alpha: 0, duration: 600,
      onComplete: () => ring.destroy() });

    // Stop all active invaders for 2000ms
    this.activeInvaders.forEach(inv => {
      if (inv.active) {
        inv.applyTaunt(2000);
        // "!" text above each invader
        const excl = this.add.text(inv.x, inv.y - inv.def.radius - 10, '!', {
          fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ff4444',
        }).setOrigin(0.5).setDepth(53);
        this.tweens.add({ targets: excl, y: inv.y - inv.def.radius - 28, alpha: 0, duration: 800,
          onComplete: () => excl.destroy() });
      }
    });

    // All rooms get +30% damage for 2000ms
    this.tauntBoostActiveUntil = this.time.now + 2000;

    logger.debug(`[TAUNTING_ROAR] ${this.activeInvaders.filter(i => i.active).length} invaders stopped, +30% dmg for 2s`);
  }

  private showMagicImmuneMiss(tx: number, ty: number): void {
    const t = this.add.text(tx, ty - 16, 'IMMUNE', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#ffffff22',
    }).setOrigin(0.5).setDepth(53);
    this.tweens.add({ targets: t, y: ty - 40, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  // ── Tigers Pounce update loop ──────────────────────────────────────────────
  private pounceReadyMap = new Map<string, { ready: boolean; cooldownUntil: number }>();

  private runTigersPounce(now: number): void {
    if (!this.waveActive) return;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || data.monsterSlot !== 'white_tiger') continue;
        const key = `${row},${col}`;
        let state = this.pounceReadyMap.get(key);
        if (!state) { state = { ready: true, cooldownUntil: 0 }; this.pounceReadyMap.set(key, state); }
        if (!state.ready && now < state.cooldownUntil) continue;
        state.ready = true;
        if (!state.ready) continue;

        // Find furthest-advanced invader (highest pathTween.progress)
        let target: Invader | null = null;
        let bestProgress = 0;
        for (const inv of this.activeInvaders) {
          if (!inv.active || inv.isInvisible) continue;
          const prog = (inv.pathTween as Phaser.Tweens.Tween).progress ?? 0;
          if (prog > 0.6 && prog > bestProgress) { bestProgress = prog; target = inv; }
        }
        if (!target) continue;

        // Trigger pounce
        const rdef = MONSTER_DEFS['white_tiger'];
        const dmg  = Math.round(rdef.baseDamage * 3 * Math.pow(1.4, data.level - 1));
        target.takeDamage(dmg);
        state.ready = false;
        state.cooldownUntil = now + 5000;

        const rx = this.rooms[row][col].x;
        const cs = this.effectiveCellSize;
        const ry = GRID_Y + row * cs + cs / 2;
        this.showTigersPounce(rx, ry, target.x, target.y);
      }
    }
  }

  // ── Mercenary Captain continuous speed aura ───────────────────────────────

  private runMercenaryAuras(_now: number): void {
    if (!this.waveActive) return;
    const captains = this.activeInvaders.filter(
      i => i.active && i.def.type === 'mercenary_captain',
    );
    if (captains.length === 0) return;

    this.activeInvaders.forEach(inv => {
      if (!inv.active || inv.def.type === 'mercenary_captain') return;
      const nearCaptain = captains.some(c => Math.hypot(c.x - inv.x, c.y - inv.y) < 200);
      if (nearCaptain && inv.pathTween && inv.pathTween.timeScale < 1.3) {
        inv.pathTween.timeScale = 1.3;
      } else if (!nearCaptain && inv.pathTween && inv.pathTween.timeScale === 1.3) {
        inv.pathTween.timeScale = 1;
      }
    });
  }

  // ─── Gold Vein passive income ─────────────────────────────────────────────

  private goldTick = 0;

  private runGoldVeins(now: number): void {
    if (now - this.goldTick < 1000) return;
    this.goldTick = now;
    let income = 0;
    for (const row of this.roomGrid)
      for (const data of row)
        if (data?.goldPerSec) income += data.goldPerSec;
    if (income <= 0) return;
    this.gold += income;
    this.registry.set('gold', this.gold);
    this.showGoldFloat(`+${income}`, CANVAS_WIDTH / 2, GRID_Y - 20);
  }

  private showGoldFloat(text: string, x: number, y: number): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(95);
    this.tweens.add({
      targets: t, y: y - 35, alpha: 0, duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  // ─── Healer loop (soldier = 야전 치유사) ──────────────────────────────────

  private runHealers(now: number): void {
    const HEAL_INTERVAL = 2000;
    const HEAL_AMOUNT   = 20;
    const HEAL_RANGE    = 150;

    for (const healer of this.activeInvaders) {
      if (!healer.active || healer.def.type !== 'soldier') continue;
      if (now - healer.lastHealTime < HEAL_INTERVAL) continue;

      // Find lowest HP% invader within 150px (excluding self)
      let target: typeof healer | null = null;
      let lowestPct = 1;
      for (const inv of this.activeInvaders) {
        if (!inv.active || inv === healer) continue;
        const dist = Math.hypot(inv.x - healer.x, inv.y - healer.y);
        if (dist > HEAL_RANGE) continue;
        const pct = inv.hp / inv.maxHp;
        if (pct < lowestPct && inv.hp < inv.maxHp) { lowestPct = pct; target = inv; }
      }

      healer.lastHealTime = now;
      if (!target) continue;

      target.receiveHeal(HEAL_AMOUNT);
      this.showHealEffect(healer, target, HEAL_AMOUNT);
      logger.debug(`[HEAL] target hp=${target.hp}/${target.maxHp} (${Math.round(lowestPct * 100)}%) +${HEAL_AMOUNT}`);
    }
  }

  private showHealEffect(
    healer: Invader, target: Invader, amount: number,
  ): void {
    // Green beam from healer → target
    const beam = this.add.graphics().setDepth(46);
    beam.lineStyle(2, 0x44ff44, 1);
    beam.lineBetween(healer.x, healer.y, target.x, target.y);
    this.tweens.add({ targets: beam, alpha: 0, duration: 400, onComplete: () => beam.destroy() });

    // "+20" float above target
    const t = this.add.text(target.x, target.y - 20, `+${amount}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#44ff44',
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: target.y - 50, alpha: 0, duration: 600, onComplete: () => t.destroy() });

    // Green cross on target
    const cross = this.add.text(target.x + 12, target.y - 12, '✚', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#44ff44',
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({
      targets: cross, scaleX: { from: 0, to: 1 }, scaleY: { from: 0, to: 1 },
      duration: 150, yoyo: true, hold: 200,
      onComplete: () => cross.destroy(),
    });
  }

  // ─── Wave End Detection ───────────────────────────────────────────────────

  private waveEndChecked  = false;
  private waveHasSpawned  = false;

  private checkWaveEnd(): void {
    if (this.waveEndChecked) return;
    if (!this.waveHasSpawned) return;
    if (this.activeInvaders.filter(i => i.active).length > 0) return;

    this.waveEndChecked = true;
    this.time.delayedCall(800, () => {
      if (this.activeInvaders.filter(i => i.active).length > 0) {
        this.waveEndChecked = false;
        return;
      }
      this.waveActive = false;
      this.activeInvaders = [];
      logger.debug(`[WAVE ${this.wave} CLEAR] dungeon HP: ${this.dungeonHp}/${this.maxHp}`);
      this.saveRoomHpsToGameState();

      // Daily challenge: wave_clear
      const noDmg = this.dungeonHp >= this.waveStartDungeonHp;
      if (noDmg) {
        this.consecutiveNoDmgWaves++;
      } else {
        this.consecutiveNoDmgWaves = 0;
      }
      {
        const gs_dc = loadGameState();
        tickDailyChallenge(gs_dc, 'wave_clear');
        if (noDmg) tickDailyChallenge(gs_dc, 'no_damage');
        saveGameState(gs_dc);
      }

      if (this.wave >= this.maxWave) {
        this.showChapterClear();
      } else {
        this.showWaveClear();
      }
    });
  }

  // ─── Wave Clear Panel ─────────────────────────────────────────────────────

  // ─── Wave random events ──────────────────────────────────────────────────

  private tryShowWaveEvent(): void {
    const nextWave = this.wave + 1;
    const stageId  = this.registry.get('stageConfig')?.stageNumber ?? 1;
    const evt = rollWaveEvent(nextWave, this.maxWave, stageId);

    if (evt) {
      this.showWaveEvent(evt, () => this.showWavePreview());
    } else {
      this.showWavePreview();
    }
  }

  private showWaveEvent(evt: WaveEventDef, onDone: () => void): void {
    const t = this.theme;
    const ov = this.add.container(0, 0).setDepth(250);

    // Dim
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setAlpha(0);
    ov.add(dim);
    this.tweens.add({ targets: dim, alpha: 1, duration: 200 });

    // Card
    const cw = 260, ch = 120;
    const cx = (CANVAS_WIDTH - cw) / 2;
    const cy = CANVAS_HEIGHT / 2 - ch / 2 - 20;

    const card = this.add.graphics();
    card.fillStyle(t.panelDark, 1);
    card.fillRoundedRect(cx, cy, cw, ch, 8);
    card.lineStyle(2, parseInt(evt.color.replace('#', ''), 16), 0.9);
    card.strokeRoundedRect(cx, cy, cw, ch, 8);
    card.setAlpha(0).setY(-40);
    ov.add(card);
    this.tweens.add({ targets: card, y: 0, alpha: 1, duration: 300, ease: 'Power2.easeOut' });

    // Icon
    const icon = this.add.text(cx + cw / 2, cy + 28, evt.icon, {
      fontSize: '32px',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(icon);
    this.tweens.add({ targets: icon, alpha: 1, duration: 200, delay: 150 });

    // Name
    const name = this.add.text(cx + cw / 2, cy + 62, evt.name, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: evt.color,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(name);
    this.tweens.add({ targets: name, alpha: 1, duration: 200, delay: 250 });

    // Description
    const desc = this.add.text(cx + cw / 2, cy + 86, evt.description, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aabbcc',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(desc);
    this.tweens.add({ targets: desc, alpha: 1, duration: 200, delay: 350 });

    // Apply event effect
    this.applyWaveEvent(evt);

    // Auto-dismiss after 1.8s
    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: ov, alpha: 0, duration: 300,
        onComplete: () => { ov.destroy(); onDone(); },
      });
    });
  }

  private applyWaveEvent(evt: WaveEventDef): void {
    switch (evt.type) {
      case 'merchant':
        this.waveGoldMult = 1.5;
        break;
      case 'supply':
        this.dungeonHp = Math.min(this.maxHp, this.dungeonHp + Math.ceil(this.maxHp * 0.15));
        this.registry.set('hp', this.dungeonHp);
        break;
      case 'curse':
        this.waveHpMult   = 1.3;
        this.waveGoldMult = 2.0;
        break;
      case 'rally':
        this.waveAtkMult = 1.25;
        break;
      case 'fog':
        this.waveSpdMult = 0.85;
        // Visual fog overlay
        this.waveFogOverlay = this.add.graphics().setDepth(15).setAlpha(0.3);
        this.waveFogOverlay.fillStyle(0x556677, 0.25);
        this.waveFogOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        break;
    }
    logger.debug(`[EVENT] ${evt.name} applied: gold×${this.waveGoldMult} hp×${this.waveHpMult} atk×${this.waveAtkMult} spd×${this.waveSpdMult}`);
  }

  // ─── 침략 예고 패널 ─────────────────────────────────────────────────────────

  private showWavePreview(): void {
    const nextWave = this.wave + 1;
    if (nextWave > this.maxWave) { this.startWave(); return; }

    // Gather wave info
    const cfg = this.isEndless
      ? null
      : this.waveConfigs[Math.min(nextWave - 1, this.waveConfigs.length - 1)];

    const ov = this.add.container(0, 0).setDepth(300);

    // Dim
    const dim = this.add.graphics().setAlpha(0);
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);
    this.tweens.add({ targets: dim, alpha: 1, duration: 200 });

    // Card
    const cw = 310, ch = cfg ? 40 + cfg.invaders.length * 36 + 80 : 140;
    const cx = CANVAS_WIDTH / 2 - cw / 2;
    const cy = CANVAS_HEIGHT / 2 - ch / 2;
    const card = this.add.graphics();
    card.fillStyle(0x1a0f00, 1);
    card.fillRoundedRect(cx, cy, cw, ch, 10);
    card.lineStyle(2, 0xc8921a, 0.9);
    card.strokeRoundedRect(cx, cy, cw, ch, 10);
    ov.add(card);

    // Title
    ov.add(this.add.text(CANVAS_WIDTH / 2, cy + 18,
      `⚠️  ${nextWave}번째 침략 예고`, {
      fontFamily: 'Georgia, serif', fontSize: '15px',
      fontStyle: 'bold', color: '#c8921a',
    }).setOrigin(0.5));

    if (cfg) {
      // Enemy list
      let rowY = cy + 46;
      const typeCount = new Map<string, number>();
      for (const { type, count } of cfg.invaders) {
        typeCount.set(type, (typeCount.get(type) ?? 0) + count);
      }
      const totalInvaders = [...typeCount.values()].reduce((a, b) => a + b, 0);

      for (const [type, count] of typeCount) {
        const def = INVADER_DEFS[type as import('../data/invaders').InvaderType];
        if (!def) continue;

        const rowG = this.add.graphics();
        rowG.fillStyle(0x2d1a00, 0.7);
        rowG.fillRoundedRect(cx + 12, rowY - 12, cw - 24, 30, 4);
        ov.add(rowG);

        // HP bar (relative strength)
        const hpFrac = Math.min(1, def.hp / 1000);
        const barW   = 60;
        const hpG    = this.add.graphics();
        hpG.fillStyle(0x0e0900, 1);
        hpG.fillRoundedRect(cx + cw - 90, rowY - 6, barW, 8, 2);
        hpG.fillStyle(def.hp > 400 ? 0x8b0000 : def.hp > 150 ? 0xc8921a : 0x2d9e2d, 1);
        hpG.fillRoundedRect(cx + cw - 90, rowY - 6, barW * hpFrac, 8, 2);
        ov.add(hpG);

        ov.add(this.add.text(cx + 20, rowY,
          `×${count}  ${def.koreanName}`, {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#e8d090',
        }).setOrigin(0, 0.5));
        ov.add(this.add.text(cx + cw - 24, rowY,
          `HP ${def.hp}`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
        }).setOrigin(1, 0.5));

        // Special behavior badge
        if (def.behavior) {
          const behaviorLabel: Record<string, string> = {
            VOID_PHASE: '순간이동', REVIVE_ONCE: '부활', NINJA_STEALTH: '은신',
            SIEGE_SHIELD: '방어막', HOLY_PALADIN: '신성면역', IRON_GOLEM: '둔화면역',
          };
          ov.add(this.add.text(cx + 20 + 120, rowY,
            `[${behaviorLabel[def.behavior] ?? def.behavior}]`, {
            fontFamily: 'sans-serif', fontSize: '8px', color: '#ff8888',
          }).setOrigin(0, 0.5));
        }

        rowY += 36;
      }

      // Total / damage warning
      ov.add(this.add.text(CANVAS_WIDTH / 2, rowY + 2,
        `총 ${totalInvaders}명  ·  돌파 시 던전 피해`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#664400',
      }).setOrigin(0.5));
    } else {
      ov.add(this.add.text(CANVAS_WIDTH / 2, cy + 60,
        '무한 모드 — 침략자가 계속 강해집니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#806040',
      }).setOrigin(0.5));
    }

    // Confirm button
    const btnY = cy + ch - 32;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x8b0000, 0.85);
    btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6);
    ov.add(btnBg);
    const btnT = this.add.text(CANVAS_WIDTH / 2, btnY, '⚔  침략 시작', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8d090',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btnT.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(0xb00000, 1); btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6); });
    btnT.on('pointerout',  () => { btnBg.clear(); btnBg.fillStyle(0x8b0000, 0.85); btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6); });
    btnT.on('pointerdown', () => { ov.destroy(); this.startWave(); });
    ov.add(btnT);
  }

  private showWaveClear(): void {
    const waveCfgReward = this.waveConfigs[this.wave - 1]?.clearReward;
    const fallback = 50 + this.wave * 10 + (this.stageChapter - 1) * 40;
    const dailyGold = this.dailyMode?.modifiers.goldMult ?? 1;
    const reward = Math.round((waveCfgReward ?? fallback) * this.wisdomBonuses.waveRewardMult * this.waveGoldMult * dailyGold);
    this.gold += reward;
    this.registry.set('gold', this.gold);
    audioManager.playSfx('wave_clear');

    const stars = this.dungeonHp / this.maxHp > 0.8 ? 3
                : this.dungeonHp / this.maxHp > 0.4 ? 2 : 1;

    // Wave participation XP
    this.grantMonsterXp(10);

    logger.debug(`[WAVE CLEAR] reward=${reward}g stars=${stars}`);
    this.showResultPanel(false, reward, stars);
    this.startPrepCountdown();
  }

  private showResultPanel(isFail: boolean, reward: number, stars: number): void {
    if (this.resultOverlay) this.resultOverlay.destroy();
    const ov = this.add.container(0, 0).setDepth(300);
    this.resultOverlay = ov;

    // Compute wave stat summary
    const damagedSlots = this.dungeonTrapSlots.filter(
      (s, i) => s && (this.waveStartSlotHps[i] ?? s.hp) > s.hp
    );
    const damagedCount  = damagedSlots.length;
    const destroyedCount = this.dungeonTrapSlots.filter(s => s && s.hp <= 0).length;

    // Dim overlay
    const dim = this.add.graphics();
    dim.fillStyle(isFail ? COLORS.BLOOD_RED : COLORS.BLACK, 0.7);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setAlpha(0);
    ov.add(dim);
    this.tweens.add({ targets: dim, alpha: 1, duration: 400 });

    // Card — taller to fit stats
    const cw = 300;
    const statsH = 60;   // extra height for the 3-stat row
    const ch = isFail ? 220 : 200 + statsH;
    const cx = CANVAS_WIDTH / 2 - cw / 2;
    const cy = CANVAS_HEIGHT / 2 - ch / 2;

    const card = this.add.graphics();
    card.fillStyle(COLORS.STONE_DARK, 1);
    card.fillRoundedRect(cx, cy, cw, ch, 10);
    card.lineStyle(2, isFail ? COLORS.BLOOD_GLOW : COLORS.TORCH_GOLD, 0.9);
    card.strokeRoundedRect(cx, cy, cw, ch, 10);
    card.setY(-80).setAlpha(0);
    ov.add(card);
    this.tweens.add({ targets: card, y: 0, alpha: 1, duration: 350, ease: 'Power2.easeOut' });

    const title = isFail ? '던전 함락!' : '침입자 격퇴!';
    const titleColor = isFail ? CSS.BLOOD_GLOW : CSS.TORCH_AMBER;
    const titleT = this.add.text(CANVAS_WIDTH / 2, cy + 30, title, {
      fontFamily: "Georgia, serif", fontSize: '24px', fontStyle: 'bold', color: titleColor,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(titleT);
    this.tweens.add({ targets: titleT, alpha: 1, duration: 300, delay: 200 });

    if (!isFail) {
      // Stars
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const starsT = this.add.text(CANVAS_WIDTH / 2, cy + 68, starStr, {
        fontFamily: 'sans-serif', fontSize: '22px', color: CSS.TORCH_AMBER,
      }).setOrigin(0.5).setAlpha(0);
      ov.add(starsT);
      this.tweens.add({ targets: starsT, alpha: 1, duration: 300, delay: 350 });

      // Reward
      const rewardT = this.add.text(CANVAS_WIDTH / 2, cy + 106, `황금 보상  +${reward}💰`, {
        fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT,
      }).setOrigin(0.5).setAlpha(0);
      ov.add(rewardT);
      this.tweens.add({ targets: rewardT, alpha: 1, duration: 300, delay: 450 });

      // ── Wave stat row ───────────────────────────────────────────────────────
      const statY = cy + 138;
      const statDivider = this.add.graphics().setAlpha(0);
      statDivider.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
      statDivider.lineBetween(cx + 16, statY - 10, cx + cw - 16, statY - 10);
      ov.add(statDivider);
      this.tweens.add({ targets: statDivider, alpha: 1, duration: 200, delay: 480 });

      const statItems = [
        { icon: '⚔', label: '격퇴', value: String(this.killsThisWave),   color: '#88ff88' },
        { icon: '💥', label: '돌파', value: String(this.breakthruCount),  color: this.breakthruCount > 0 ? '#ff8888' : '#888888' },
        { icon: '🏚', label: '손상 방', value: `${damagedCount}칸`,       color: damagedCount > 0 ? '#ffbb44' : '#888888' },
      ];
      const colW = cw / 3;
      statItems.forEach(({ icon, label, value, color }, i) => {
        const sx = cx + colW * i + colW / 2;
        const iconT = this.add.text(sx, statY + 4, icon, {
          fontFamily: 'sans-serif', fontSize: '16px',
        }).setOrigin(0.5).setAlpha(0);
        ov.add(iconT);
        this.tweens.add({ targets: iconT, alpha: 1, duration: 200, delay: 520 + i * 60 });

        const valT = this.add.text(sx, statY + 24, value, {
          fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color,
        }).setOrigin(0.5).setAlpha(0);
        ov.add(valT);
        this.tweens.add({ targets: valT, alpha: 1, duration: 200, delay: 540 + i * 60 });

        const lblT = this.add.text(sx, statY + 40, label, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
        }).setOrigin(0.5).setAlpha(0);
        ov.add(lblT);
        this.tweens.add({ targets: lblT, alpha: 1, duration: 200, delay: 560 + i * 60 });
      });

      // Destroyed room warning
      if (destroyedCount > 0) {
        const warnT = this.add.text(CANVAS_WIDTH / 2, statY + 60,
          `⚠ 파손된 방 ${destroyedCount}칸 — 홈에서 수리 필요`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#ff6666',
          backgroundColor: '#1a0000', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setAlpha(0);
        ov.add(warnT);
        this.tweens.add({ targets: warnT, alpha: 1, duration: 200, delay: 680 });
      }
      // ──────────────────────────────────────────────────────────────────────

      const wave = this.wave;
      const btnT = this.add.text(CANVAS_WIDTH / 2, cy + ch - 40, `다음 침략 준비 (${wave + 1}/${this.maxWave})`, {
        fontFamily: "Georgia, serif", fontSize: '13px', color: CSS.PARCHMENT,
      }).setOrigin(0.5).setAlpha(0);
      ov.add(btnT);
      this.tweens.add({ targets: btnT, alpha: 1, duration: 300, delay: 700 });

      const btnZone = this.add.zone(CANVAS_WIDTH / 2, cy + ch - 40, 280, 36).setInteractive();
      ov.add(btnZone);
      btnZone.on('pointerdown', () => {
        ov.destroy();
        this.resultOverlay = undefined;
        this.prepActive = false; // allow wave button to fire even if countdown still running
        this.enableWaveButton();
      });

    } else {
      // Fail options
      const failMsg = this.add.text(CANVAS_WIDTH / 2, cy + 72, '던전이 함락되었습니다', {
        fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setAlpha(0);
      ov.add(failMsg);
      this.tweens.add({ targets: failMsg, alpha: 1, duration: 300, delay: 200 });

      const options: Array<{ label: string; action: () => void }> = [
        ...(this.returnTo ? [{
          label: '🏰  던전으로 귀환',
          action: () => {
            this.registry.set('battleResult', { won: false, goldEarned: this.gold, dmXP: 30, materialsEarned: { ...this.materialsEarnedThisRun } });
            ov.destroy();
            this.scene.start('DungeonHomeScene');
          },
        }] : []),
        { label: '광고 보기 (부활)',      action: () => this.revive(0) },
        { label: '💎 5보석으로 부활',     action: () => this.revive(5) },
        { label: '처음부터',              action: () => this.resetStage() },
      ];
      options.forEach(({ label, action }, i) => {
        const oy = cy + 110 + i * 38;
        const ob = this.add.graphics();
        ob.fillStyle(i === 2 ? COLORS.STONE_MID : COLORS.BLOOD_RED, 0.7);
        ob.fillRoundedRect(cx + 20, oy - 14, cw - 40, 30, 5);
        ov.add(ob);
        const ot = this.add.text(CANVAS_WIDTH / 2, oy, label, {
          fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT,
        }).setOrigin(0.5).setAlpha(0);
        ov.add(ot);
        this.tweens.add({ targets: ot, alpha: 1, duration: 250, delay: 250 + i * 80 });
        const oz = this.add.zone(CANVAS_WIDTH / 2, oy, cw - 40, 30).setInteractive();
        ov.add(oz);
        oz.on('pointerdown', () => { ov.destroy(); this.resultOverlay = undefined; action(); });
      });
    }
  }

  private enableWaveButton(): void {
    const bw = 270, bh = 48;
    const bx = CANVAS_WIDTH / 2 - bw / 2;
    const by = GRID_Y + GRID_ROWS * this.effectiveCellSize + 20;
    this.waveEndChecked = false;
    this.waveHasSpawned = false;
    this.drawBtn(this.waveBtnBg, bx, by, bw, bh, false);
    this.waveBtnBg.setAlpha(1);
    this.waveBtnZone.setInteractive();
    this.waveLabel.setText('⚔  침략 시작').setColor(CSS.PARCHMENT);
  }

  // ─── Prep countdown ───────────────────────────────────────────────────────

  private startPrepCountdown(): void {
    this.prepActive   = true;
    this.prepTimer    = 10;

    if (!this.countdownBar) {
      const barBg = this.add.graphics().setDepth(70);
      const bx = CANVAS_WIDTH / 2 - 130;
      const by = GRID_Y + GRID_ROWS * this.effectiveCellSize + 78;
      barBg.fillStyle(COLORS.STONE_DARK, 1);
      barBg.fillRoundedRect(bx, by, 260, 10, 3);
      this.countdownBar = this.add.graphics().setDepth(71);
    }

    const tick = () => {
      this.prepTimer--;
      const bx = CANVAS_WIDTH / 2 - 130;
      const by = GRID_Y + GRID_ROWS * this.effectiveCellSize + 78;
      this.countdownBar!.clear();
      this.countdownBar!.fillStyle(COLORS.TORCH_GOLD, 0.8);
      this.countdownBar!.fillRoundedRect(bx, by, 260 * (this.prepTimer / 10), 10, 3);
      this.registry.set('status', `다음 침략까지 ${this.prepTimer}초`);

      if (this.prepTimer <= 0) {
        this.prepActive = false;
        this.countdownBar!.clear();
        this.registry.set('status', '');
        this.waveEndChecked = false;
        this.enableWaveButton();
      } else {
        this.time.delayedCall(1000, tick);
      }
    };
    this.time.delayedCall(1000, tick);
  }

  // ─── Wave Fail ────────────────────────────────────────────────────────────

  private triggerWaveFail(): void {
    audioManager.playSfx('defeat');
    this.waveActive = false;
    this.activeInvaders.forEach(i => { if (i.active) i.destroy(); });
    this.activeInvaders = [];
    this.saveRoomHpsToGameState();

    // Screen shake
    this.cameras.main.shake(600, 0.02);

    // Red vignette
    const vig = this.add.graphics().setDepth(290);
    vig.fillStyle(COLORS.BLOOD_RED, 0.5);
    vig.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.tweens.add({ targets: vig, alpha: 0, duration: 600 });

    if (this.isEndless) {
      logger.debug(`[ENDLESS FAIL] wave=${this.wave} kills=${this.killsThisRun}`);
      this.time.delayedCall(700, () => this.showEndlessResult());
    } else {
      logger.debug('[WAVE FAIL] dungeonHP=0');
      this.showResultPanel(true, 0, 0);
    }
  }

  private revive(gemCost: number): void {
    if (gemCost > 0 && this.gems < gemCost) {
      this.registry.set('status', '보석 부족!');
      return;
    }
    if (gemCost > 0) {
      this.gems -= gemCost;
      this.registry.set('gems', this.gems);
    } else {
      logger.debug('[AD] watch_ad triggered');
    }
    this.dungeonHp = Math.round(this.maxHp * 0.5);
    this.registry.set('hp', this.dungeonHp);
    this.waveEndChecked = false;
    this.wave--; // pre-decrement so startWave's ++ lands on the same wave
    this.startWave();
  }

  private resetStage(): void {
    this.wave      = 0;
    this.dungeonHp = this.maxHp;
    this.gold      = this.startGold;
    this.registry.set('wave', 0);
    this.registry.set('hp',   this.dungeonHp);
    this.registry.set('gold', this.gold);
    this.activeInvaders = [];
    this.waveEndChecked = false;
    this.enableWaveButton();
    logger.debug('[RESET] stage reset');
  }

  // ─── Boss HP bar ──────────────────────────────────────────────────────────

  private buildBossHpBar(maxHp: number): void {
    this.bossMaxHp = maxHp;
    const bx = CANVAS_WIDTH / 2 - 100;
    const by = TOP_BAR_HEIGHT + 2;

    this.bossHpBarBg = this.add.graphics().setDepth(95);
    this.bossHpBarBg.fillStyle(0x220011, 1);
    this.bossHpBarBg.fillRoundedRect(bx - 2, by - 2, 204, 16, 3);

    this.bossHpBarFill = this.add.graphics().setDepth(96);

    this.bossHpLabel = this.add.text(CANVAS_WIDTH / 2, by - 12, '👹 도깨비 대왕', {
      fontFamily: 'sans-serif', fontSize: '9px', color: CSS.BLOOD_GLOW,
    }).setOrigin(0.5).setDepth(97);
  }

  private updateBossHpBar(): void {
    if (!this.bossHpBarFill || !this.bossHpBarBg) return;
    // Find the boss invader (knight on wave 10, or dragon_king on wave 12 of Ch3)
    const boss = this.activeInvaders.find(i => i.active && (i.def.type === 'knight' || i.def.type === 'dragon_king'));
    if (!boss && this.wave === this.maxWave) {
      // Boss dead — remove bar
      this.bossHpBarBg?.destroy();  this.bossHpBarBg  = undefined;
      this.bossHpBarFill?.destroy(); this.bossHpBarFill = undefined;
      this.bossHpLabel?.destroy();   this.bossHpLabel  = undefined;
      return;
    }
    if (!boss) return;

    const bx  = CANVAS_WIDTH / 2 - 100;
    const by  = TOP_BAR_HEIGHT + 2;
    const pct = boss.hp / this.bossMaxHp;
    const col = pct > 0.5 ? 0x440044 : 0x8b0000;

    this.bossHpBarFill.clear();
    this.bossHpBarFill.fillStyle(col, 1);
    this.bossHpBarFill.fillRoundedRect(bx, by, Math.max(0, 200 * pct), 12, 3);

    if (this.bossHpLabel) {
      const bossIcon = boss.def.type === 'dragon_king' ? '🐲 용왕' : '👹 도깨비 대왕';
      this.bossHpLabel.setText(`${bossIcon}  ${boss.hp} / ${this.bossMaxHp}`);
    }
  }

  // ─── Wisdom toast ─────────────────────────────────────────────────────────

  private showWisdomToast(): void {
    const b = this.wisdomBonuses;
    const lines: string[] = [];
    if (b.startingGold   > 0) lines.push(`💰 시작 골드 +${b.startingGold}`);
    if (b.dungeonMaxHpBonus > 0) lines.push(`🏰 던전 HP +${b.dungeonMaxHpBonus}`);
    if (b.roomCostMult   < 1) lines.push(`🔨 방 비용 -${Math.round((1 - b.roomCostMult) * 100)}%`);
    if (b.waveRewardMult > 1) lines.push(`⚡ 웨이브 보상 +${Math.round((b.waveRewardMult - 1) * 100)}%`);
    if (b.extraSlots     > 0) lines.push(`📜 추가 슬롯 +${b.extraSlots}`);
    if (b.crystalEarnMult > 1) lines.push(`💎 수정 획득 +${Math.round((b.crystalEarnMult - 1) * 100)}%`);
    if (b.monsterDmgMult < 1) lines.push(`🛡 몬스터 피해 -${Math.round((1 - b.monsterDmgMult) * 100)}%`);
    if (lines.length === 0) return;

    const toast = this.add.text(CANVAS_WIDTH / 2, 98, `⛩ 선조의 가호\n${lines.join('  ')}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#c070ff',
      align: 'center', backgroundColor: '#0d0a1a',
      padding: { x: 10, y: 6 },
      wordWrap: { width: 340 },
    }).setOrigin(0.5, 0).setDepth(200).setAlpha(0);

    this.tweens.add({
      targets: toast, alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({
          targets: toast, alpha: 0, duration: 400, delay: 2500,
          onComplete: () => toast.destroy(),
        });
      },
    });
  }

  // ─── Boss (Wave 10) ───────────────────────────────────────────────────────

  private showBossWarning(): void {
    const cam = this.cameras.main;

    // Resolve boss info from current wave config
    const waveCfg = this.waveConfigs[this.wave - 1];
    const bossGrp = waveCfg?.invaders.find(i => i.isBoss);
    const bossDef = bossGrp ? INVADER_DEFS[bossGrp.type] : null;
    const endlessBossName = this.wave >= 50 ? '전설적 침략자' : this.wave >= 30 ? '고위 보스' : this.wave >= 20 ? '엘리트 보스' : '미니 보스';
    const bossName = bossDef?.koreanName ?? (this.isEndless ? endlessBossName : '보스');
    const bossHp   = bossDef?.hp ?? (this.isEndless ? 200 + this.wave * 30 : 350);

    // Boss-specific accent color (hex → CSS string)
    const bossColorNum = bossDef?.color ?? 0xff2222;
    const bossColorCss = '#' + bossColorNum.toString(16).padStart(6, '0');

    // Boss emoji per type
    const BOSS_EMOJI: Record<string, string> = {
      fox_queen:          '🦊',
      dragon_king:        '🐉',
      death_emissary:     '💀',
      three_god_destroyer:'⛩️',
      eternal_emperor:    '👑',
    };
    const bossEmoji = (bossGrp ? BOSS_EMOJI[bossGrp.type] : null) ?? '⚔️';

    // Boss one-liner quote
    const BOSS_QUOTES: Record<string, string> = {
      fox_queen:           '내 꼬리 아홉 개가 너희를 집어삼킬 것이다.',
      dragon_king:         '이 바다의 모든 것은 내 것이다!',
      death_emissary:      '저승의 문은 이미 열렸다...',
      three_god_destroyer: '모든 것을 부숴버리겠다!!',
      eternal_emperor:     '영원히... 너희는 나를 이길 수 없다.',
    };
    const bossQuote = bossGrp ? (BOSS_QUOTES[bossGrp.type] ?? null) : null;

    // ── 0ms: BGM slowdown + dark overlay ────────────────────────────────────
    audioManager.rampBpm(80, 1.5);

    const overlay = this.add.graphics().setDepth(198).setAlpha(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 800 });

    // ── 300ms: Boss-colored vignette pulse (3×) ──────────────────────────────
    const vignette = this.add.graphics().setDepth(199).setAlpha(0);
    vignette.lineStyle(18, bossColorNum, 1);
    vignette.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: vignette, alpha: { from: 0, to: 0.6 },
        duration: 350, yoyo: true, repeat: 2,
        onComplete: () => vignette.destroy(),
      });
    });

    // ── 800ms: Boss name card slide-in ──────────────────────────────────────
    const cardH = bossQuote ? 100 : 80;
    const nameCard = this.add.container(CANVAS_WIDTH + 220, CANVAS_HEIGHT / 2 - cardH / 2).setDepth(200);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x080808, 0.92);
    cardBg.fillRoundedRect(-170, 0, 340, cardH, 8);
    cardBg.lineStyle(2, bossColorNum, 0.9);
    cardBg.strokeRoundedRect(-170, 0, 340, cardH, 8);
    // Top accent stripe in boss color
    cardBg.fillStyle(bossColorNum, 0.7);
    cardBg.fillRoundedRect(-170, 0, 340, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
    nameCard.add(cardBg);

    // ⚠ label
    const warningT = this.add.text(0, 14, '⚠  보스 출현', {
      fontFamily: 'sans-serif', fontSize: '10px', color: bossColorCss,
      letterSpacing: 2,
    }).setOrigin(0.5);
    nameCard.add(warningT);

    // Emoji + Name
    const nameT = this.add.text(0, 36, `${bossEmoji} ${bossName}`, {
      fontFamily: 'Georgia, serif', fontSize: '19px', fontStyle: 'bold', color: '#ffffff',
      shadow: { color: bossColorCss, blur: 10, fill: true },
    }).setOrigin(0.5);
    nameCard.add(nameT);

    // HP bar preview
    const hpLabel = this.add.text(0, 62, `HP  ${bossHp.toLocaleString()}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
    }).setOrigin(0.5);
    nameCard.add(hpLabel);

    // Optional quote line
    if (bossQuote) {
      const quoteT = this.add.text(0, 83, `"${bossQuote}"`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#cccccc',
        fontStyle: 'italic', wordWrap: { width: 300 },
      }).setOrigin(0.5, 0);
      nameCard.add(quoteT);
    }

    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: nameCard, x: CANVAS_WIDTH / 2,
        duration: 380, ease: 'Power2.easeOut',
      });
      audioManager.playSfx('boss_appear');
    });

    // ── 850ms: Camera shake ──────────────────────────────────────────────────
    this.time.delayedCall(850, () => {
      cam.shake(700, 0.014);
    });

    // ── 1000ms: Camera zoom-in ──────────────────────────────────────────────
    this.time.delayedCall(1000, () => {
      cam.zoomTo(1.06, 1500, 'Sine.easeInOut');
    });

    // Camera boss-color flash
    const r = (bossColorNum >> 16) & 0xff;
    const g = (bossColorNum >> 8)  & 0xff;
    const b = bossColorNum          & 0xff;
    cam.flash(500, r, g, b);

    // ── 2500ms: Name card fade out ──────────────────────────────────────────
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: nameCard, alpha: 0, duration: 400,
        onComplete: () => nameCard.destroy(),
      });
    });

    // ── 2700ms: Zoom restore + BGM accelerate + overlay fade ────────────────
    this.time.delayedCall(2700, () => {
      cam.zoomTo(1.0, 500, 'Sine.easeOut');
      audioManager.rampBpm(130, 2);
      this.tweens.add({
        targets: overlay, alpha: 0, duration: 600,
        onComplete: () => overlay.destroy(),
      });
    });

    logger.debug(`[BOSS] ${bossName} appears! HP: ${bossHp}`);
    this.buildBossHpBar(bossHp);
  }

  private showChapterClear(): void {
    audioManager.playSfx('victory');
    const baseCrystals = 5;
    const crystals     = Math.round(baseCrystals * this.wisdomBonuses.crystalEarnMult);
    const stars        = this.dungeonHp / this.maxHp > 0.8 ? 3
                       : this.dungeonHp / this.maxHp > 0.4 ? 2 : 1;
    this.registry.set('soulCrystals', crystals);

    // Persist soul crystals to GameState
    const gs = loadGameState();
    gs.soulCrystals += crystals;
    // Also persist star progress — skip for invasion battles (no stageNumber)
    const stageCfg = this.registry.get('stageConfig') as { stageNumber?: number } | undefined;
    const stageNum = stageCfg?.stageNumber;
    if (stageNum !== undefined) {
      const stageIdx = stageNum - 1;
      if (gs.stageProgress[stageIdx]) {
        gs.stageProgress[stageIdx].bestStars = Math.max(gs.stageProgress[stageIdx].bestStars, stars);
      }
      if (stageIdx + 1 < gs.stageProgress.length) gs.stageProgress[stageIdx + 1].unlocked = true;
    }
    this.tickQuestAndNotify(gs, 'complete_stage');

    // ── Daily dungeon clear ─────────────────────────────────────────────────
    if (this.dailyMode) {
      const today = getTodayString();
      gs.dailyDungeonCompleted = today;
      gs.soulCrystals += this.dailyMode.rewards.crystals;
      for (const matId of this.dailyMode.rewards.materials) {
        gs.materials[matId] = (gs.materials[matId] ?? 0) + 1;
      }
    }

    // ── Weekly boss clear ───────────────────────────────────────────────────
    if (this.weeklyBossMode) {
      const thisWeek = getThisWeekMonday();
      // Only grant rewards if not already claimed this week
      if (gs.weeklyBossResetDate !== thisWeek) {
        gs.weeklyBossResetDate = thisWeek;
        gs.weeklyBossHpDealt   = 0;
        gs.soulCrystals += this.weeklyBossMode.rewards.skinShards * 10;
        gs.materials['boss_essence'] = (gs.materials['boss_essence'] ?? 0) + 1;
        // Unlock boss blueprint on first clear
        gs.blueprints = gs.blueprints ?? [];
        if (!gs.blueprints.includes('bp_boss_amulet')) {
          gs.blueprints.push('bp_boss_amulet');
        }
      }
    }

    saveGameState(gs);

    // Sync to StageSelectScene's own progress key (bestStars + bestHpPercent)
    const hpPercent = Math.round((this.dungeonHp / this.maxHp) * 100);
    if (stageNum !== undefined) recordClear(stageNum - 1, stars, hpPercent);

    logger.debug(`[CHAPTER CLEAR] stars=${stars} +${crystals} soul crystals (×${this.wisdomBonuses.crystalEarnMult.toFixed(2)})`);

    // Full overlay
    const ov = this.add.container(0, 0).setDepth(310);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setAlpha(0);
    ov.add(dim);
    this.tweens.add({ targets: dim, alpha: 1, duration: 600 });

    // Card
    const cw = 320, ch = 320;
    const cx = CANVAS_WIDTH / 2 - cw / 2;
    const cy = CANVAS_HEIGHT / 2 - ch / 2;
    const card = this.add.graphics();
    card.fillStyle(COLORS.STONE_DARK, 1);
    card.fillRoundedRect(cx, cy, cw, ch, 12);
    card.lineStyle(2, COLORS.TORCH_GOLD, 0.9);
    card.strokeRoundedRect(cx, cy, cw, ch, 12);
    card.setY(-60).setAlpha(0);
    ov.add(card);
    this.tweens.add({ targets: card, y: 0, alpha: 1, duration: 500, ease: 'Power2.easeOut', delay: 200 });

    const chLabel = `${this.stageChapter}장`;

    // Game complete: only stage 62 (final stage of Ch6)
    const stageCfgX = this.registry.get('stageConfig') as { stageNumber?: number } | undefined;
    if (stageCfgX?.stageNumber === 62) {
      this.time.delayedCall(200, () => this.showGameComplete());
      return;
    }
    const clearTitle = this.dailyMode
      ? `⚔️  ${this.dailyMode.name}  클리어!`
      : this.weeklyBossMode
      ? `👑  ${this.weeklyBossMode.name}  격파!`
      : `🎉  ${chLabel} 클리어!`;
    const title = this.add.text(CANVAS_WIDTH / 2, cy + 32, clearTitle, {
      fontFamily: "Georgia, serif", fontSize: '24px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(title);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 500 });

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const starsT = this.add.text(CANVAS_WIDTH / 2, cy + 78, starStr, {
      fontFamily: 'sans-serif', fontSize: '24px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(starsT);
    this.tweens.add({ targets: starsT, alpha: 1, duration: 300, delay: 650 });

    const crystalT = this.add.text(CANVAS_WIDTH / 2, cy + 120, `영혼 결정체  +${crystals} 💎`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#88aaff',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(crystalT);
    this.tweens.add({ targets: crystalT, alpha: 1, duration: 300, delay: 780 });

    // Daily dungeon reward line
    if (this.dailyMode) {
      const dailyCrystals = this.dailyMode.rewards.crystals;
      const dailyT = this.add.text(CANVAS_WIDTH / 2, cy + 148, `일일 보상  +${dailyCrystals} 💠  재료 ×${this.dailyMode.rewards.materials.length}`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#44ffcc',
      }).setOrigin(0.5).setAlpha(0);
      ov.add(dailyT);
      this.tweens.add({ targets: dailyT, alpha: 1, duration: 300, delay: 880 });
    }

    const killT = this.add.text(CANVAS_WIDTH / 2, cy + 152, `골드 획득: ${this.gold}💰`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(killT);
    this.tweens.add({ targets: killT, alpha: 1, duration: 300, delay: 880 });

    // Materials earned this run
    const matEntries = Object.entries(this.materialsEarnedThisRun).filter(([, q]) => q > 0);
    if (matEntries.length > 0) {
      const matStr = '획득 재료: ' + matEntries.map(([id, q]) => {
        const def = MATERIAL_DEFS[id];
        return `${def?.emoji ?? '?'} ${def?.name ?? id} ×${q}`;
      }).join('  ');
      const matT = this.add.text(CANVAS_WIDTH / 2, cy + 170, matStr, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
      }).setOrigin(0.5).setAlpha(0);
      ov.add(matT);
      this.tweens.add({ targets: matT, alpha: 1, duration: 300, delay: 940 });
    }

    // Divider
    const divG = this.add.graphics();
    divG.lineStyle(1, COLORS.STONE_MID, 0.5);
    divG.lineBetween(cx + 20, cy + 178, cx + cw - 20, cy + 178);
    divG.setAlpha(0);
    ov.add(divG);
    this.tweens.add({ targets: divG, alpha: 1, duration: 300, delay: 900 });

    // Buttons
    const goldEarned = this.gold;
    const curStageCfg = this.registry.get('stageConfig') as { stageNumber?: number } | undefined;
    const curStageNum = curStageCfg?.stageNumber;
    // For invasion battles (no stageNumber), never offer "다음 스테이지"
    const nextCfg = (curStageNum !== undefined && !this.returnTo)
      ? STAGE_CONFIGS[curStageNum]  // STAGE_CONFIGS is 0-indexed; next stage = curStageNum
      : undefined;

    const launchNext = () => {
      if (!nextCfg) return;
      this.registry.set('stageConfig', nextCfg);
      const cinematicId = STAGE_CINEMATICS[nextCfg.stageNumber];
      if (cinematicId) {
        const gs2 = loadGameState();
        const seen = gs2.cinematicSeen ?? [];
        if (!seen.includes(cinematicId)) {
          ov.destroy();
          this.scene.stop('UIScene');
          this.scene.start('CinematicScene', { cinematicId, nextScene: 'DungeonScene' });
          return;
        }
      }
      ov.destroy();
      this.scene.stop('UIScene');
      this.scene.start('DungeonScene');
    };

    const btnData: Array<{ label: string; action: () => void; enabled: boolean }> = [
      {
        label: nextCfg ? `다음 스테이지 →  (${nextCfg.stageNumber}스테이지)` : '🏆  모든 챕터 클리어!',
        action: nextCfg ? launchNext : () => {},
        enabled: !!nextCfg,
      },
      {
        label: this.returnTo ? '🏰  던전으로 귀환' : '스테이지 선택으로',
        action: () => {
          if (this.returnTo) {
            this.registry.set('battleResult', { won: true, goldEarned, dmXP: 150, materialsEarned: { ...this.materialsEarnedThisRun } });
            ov.destroy();
            this.scene.start('DungeonHomeScene');
          } else {
            ov.destroy();
            this.scene.start('StageSelectScene');
          }
        },
        enabled: true,
      },
    ];
    btnData.forEach(({ label, action, enabled }, i) => {
      const btnY = cy + 200 + i * 48;
      const btnBg = this.add.graphics();
      const bgColor = !enabled ? COLORS.STONE_DARK : i === 0 ? 0x1a6040 : COLORS.BLOOD_RED;
      btnBg.fillStyle(bgColor, enabled ? 0.85 : 0.5);
      btnBg.fillRoundedRect(cx + 20, btnY, cw - 40, 36, 5);
      if (enabled && i === 0) {
        btnBg.lineStyle(1, 0x44ff88, 0.5);
        btnBg.strokeRoundedRect(cx + 20, btnY, cw - 40, 36, 5);
      }
      btnBg.setAlpha(0);
      ov.add(btnBg);
      this.tweens.add({ targets: btnBg, alpha: 1, duration: 250, delay: 1000 + i * 120 });

      const btnT = this.add.text(CANVAS_WIDTH / 2, btnY + 18, label, {
        fontFamily: "Georgia, serif", fontSize: '13px',
        color: enabled ? CSS.PARCHMENT : '#666666',
      }).setOrigin(0.5).setAlpha(0);
      ov.add(btnT);
      this.tweens.add({ targets: btnT, alpha: 1, duration: 250, delay: 1000 + i * 120 });

      if (enabled) {
        const zone = this.add.zone(CANVAS_WIDTH / 2, btnY + 18, cw - 40, 36).setInteractive();
        ov.add(zone);
        zone.on('pointerdown', action);
      }
    });
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  private setupEvents(): void {
    this.events.on('invaderKilled', (inv: Invader) => {
      let goldReward = inv.def.reward;
      // Equipment goldMult: sum across all placed monsters' equipment
      for (const eq of this.equipmentMap.values()) {
        if (eq.goldMult) goldReward = Math.round(goldReward * (1 + eq.goldMult));
      }
      this.gold += goldReward;
      this.registry.set('gold', this.gold);
      this.showGoldFloat(`+${goldReward}`, inv.x, inv.y - 20);
      audioManager.playSfx('death');

      // Track for achievements and per-wave stats
      this.killsThisRun++;
      this.killsThisWave++;
      this.goldEarnedThisRun += goldReward;

      // Kill combo streak
      const now = this.time.now;
      if (now - this.lastKillTime < 3000) {
        this.killComboCount++;
      } else {
        this.killComboCount = 1;
      }
      this.lastKillTime = now;
      if (this.killComboCount >= 3) {
        const comboLabels: Record<number, string> = { 3: '트리플 킬!', 4: '쿼드 킬!', 5: '펜타 킬!' };
        const label = comboLabels[this.killComboCount] ?? `×${this.killComboCount} 연속 킬!`;
        const cx = Math.round(inv.x);
        const cy = Math.round(inv.y) - 30;
        const ct = this.add.text(cx, cy, label, {
          fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold',
          color: this.killComboCount >= 5 ? '#ff4444' : this.killComboCount >= 4 ? '#ff9900' : '#ffee44',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(300);
        this.tweens.add({
          targets: ct, y: cy - 28, alpha: 0,
          duration: 1200, ease: 'Power1',
          onComplete: () => ct.destroy(),
        });
      }
      const gs2 = loadGameState();
      gs2.totalKills       = (gs2.totalKills       ?? 0) + 1;
      gs2.totalGoldEarned  = (gs2.totalGoldEarned  ?? 0) + inv.def.reward;
      gs2.bossesKilled     = gs2.bossesKilled ?? [];
      gs2.bossesKilled.push(inv.def.type);
      tickDailyChallenge(gs2, 'kill_count');
      saveGameState(gs2);
      this.checkAchievementsAndToast(gs2);

      // Boss split (only in normal mode and not a mini-boss)
      if (inv.def.type === 'knight' && this.wave === this.maxWave && !this.isEndless && !inv.def.isMiniBoss) {
        for (let i = 0; i < 4; i++) {
          this.time.delayedCall(i * 200, () => this.spawnInvader('peasant'));
        }
        this.gold += 200;
        this.registry.set('gold', this.gold);
        this.showGoldFloat('+200', CANVAS_WIDTH / 2, GRID_Y + 20);
        logger.debug('[BOSS SPLIT] spawning 4 peasants');
      }

      this.activeInvaders = this.activeInvaders.filter(i => i !== inv);

      // SWARM: split into 3 swarm_spawn on death
      if (inv.def.behavior === 'SWARM' && inv.def.type !== 'swarm_spawn') {
        for (let i = 0; i < 3; i++) {
          this.time.delayedCall(i * 120, () => {
            if (!this.waveActive) return;
            this.spawnInvader('swarm_spawn');
          });
        }
      }

      // Track recently dead for HIGH_PRIEST resurrection (keep last 3)
      this.recentlyDeadInvaders.unshift(inv.def);
      if (this.recentlyDeadInvaders.length > 3) this.recentlyDeadInvaders.pop();

      // WAR_HEX transfer: if hexed invader dies, hex the next highest HP
      if (this.hexedInvader === inv) {
        this.hexedInvader = null;
        this.applyWarHexToHighestHP();
      }

      // Spirit Altar: increment kill count for all altar rooms (Ch4+)
      if (this.stageChapter >= 4) {
        for (let ar = 0; ar < GRID_ROWS; ar++)
          for (let ac = 0; ac < this.effectiveCols; ac++) {
            const ad = this.roomGrid[ar][ac];
            if (ad?.type === 'spirit_altar') ad.altarKillCount++;
          }
      }

      // Dragon's Lair Lv2+: +100g on boss kill (Ch4+)
      if (this.stageChapter >= 4 && inv.def.isBoss) {
        for (const row of this.roomGrid)
          for (const d of row)
            if (d?.type === 'dragons_lair' && d.level >= 2) {
              this.gold += 100;
              this.registry.set('gold', this.gold);
              this.showGoldFloat('+100 🐲', inv.x, inv.y - 30);
            }
      }

      // DIVINE_TERRITORY gold bonus: +20% gold per kill while mountain_god alive
      if (this.hasDivineTerritory()) {
        const bonus = Math.round(inv.def.reward * 0.2);
        if (bonus > 0) {
          this.gold += bonus;
          this.registry.set('gold', this.gold);
        }
      }

      // Monster barracks XP: +100 for boss kill, +5 for regular kill
      this.grantMonsterXp(inv.def.isBoss ? 100 : 5);

      // Material drop (15% base, per DROP_TABLE)
      if (!this.isEndless) {
        const matId = rollMaterialDrop(inv.def.type);
        if (matId) {
          this.materialsEarnedThisRun[matId] = (this.materialsEarnedThisRun[matId] ?? 0) + 1;
          const def = MATERIAL_DEFS[matId];
          logger.debug(`[MATERIAL DROP] ${def?.emoji ?? ''} ${def?.name ?? matId} ×1 (from ${inv.def.type})`);
        }
      }
    });

    this.events.on('invaderReachedEnd', (inv: Invader) => {
      const actualDamage = Math.round(inv.def.damage * this.wisdomBonuses.monsterDmgMult);
      this.dungeonHp = Math.max(0, this.dungeonHp - actualDamage);
      this.registry.set('hp', this.dungeonHp);
      this.activeInvaders = this.activeInvaders.filter(i => i !== inv);

      // Track breakthrough and damage dungeon room slots
      this.breakthruCount++;
      this.applyRoomSlotDamage(0.05);

      // Red vignette flash on HP loss
      const vf = this.add.graphics().setDepth(280).setAlpha(0.4);
      vf.fillStyle(COLORS.BLOOD_RED, 0.4);
      vf.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.tweens.add({ targets: vf, alpha: 0, duration: 500, onComplete: () => vf.destroy() });

      // Camera shake — stronger for big hits
      const hpRatio = actualDamage / this.maxHp;
      const shakeIntensity = Math.min(0.025, 0.006 + hpRatio * 0.8);
      this.cameras.main.shake(300, shakeIntensity);

      if (this.dungeonHp <= 0) this.triggerWaveFail();
    });

    // MIRROR_SHIELD: 30% of damage dealt is reflected back to dungeon
    this.events.on('mirrorReflect', (_inv: Invader, reflectDmg: number) => {
      this.dungeonHp = Math.max(0, this.dungeonHp - reflectDmg);
      this.registry.set('hp', this.dungeonHp);
      this.showGoldFloat(`-${reflectDmg}`, CANVAS_WIDTH / 2, GRID_Y + 20);
      if (this.dungeonHp <= 0) this.triggerWaveFail();
    });

    // GILDED_KILL: +2g per kill in same row for gold_turtle rooms
    this.events.on('invaderKilledRow', (_inv: Invader, invRow: number) => {
      for (let col = 0; col < this.effectiveCols; col++) {
        const d = this.roomGrid[invRow][col];
        if (d?.monsterSlot === 'gold_turtle') {
          this.gold += 2;
          this.registry.set('gold', this.gold);
          this.showGoldFloat('+2', this.rooms[invRow][col].x, this.rooms[invRow][col].y - 20);
        }
      }
    });

    // Ch3 roomDestroyed: nullify roomGrid entry
    this.events.on('roomDestroyed', (row: number, col: number) => {
      this.roomGrid[row][col] = null;
      logger.debug(`[ROOM DESTROYED] [${row},${col}]`);
    });

    // PERMAFROST shatter: camera shake + AoE 60 dmg within 80px
    this.events.on('permafrostShatter', (source: Invader) => {
      const SHATTER_RANGE = 80;
      const SHATTER_DMG   = 60;
      this.cameras.main.shake(300, 0.02);
      let aoeHits = 0;
      this.activeInvaders.forEach(other => {
        if (other === source || !other.active) return;
        if (Math.hypot(other.x - source.x, other.y - source.y) <= SHATTER_RANGE) {
          other.takeDamage(SHATTER_DMG);
          aoeHits++;
          // Brief blue flash on hit invaders
          const bl = this.add.graphics().setDepth(other.depth + 2);
          bl.fillStyle(0x88ddff, 0.7);
          bl.fillCircle(other.x, other.y, other.def.radius + 4);
          this.tweens.add({ targets: bl, alpha: 0, duration: 200, onComplete: () => bl.destroy() });
        }
      });
      logger.debug(`[PERMAFROST SHATTER] aoeHits=${aoeHits} dmg=${SHATTER_DMG}`);
    });
  }

  // ─── Endless Mode ─────────────────────────────────────────────────────────

  private showEndlessMilestoneToast(): void {
    const w = this.wave;
    let msg = '';
    if      (w === 10)  msg = '🌊 10웨이브! 엘리트 등장!';
    else if (w === 20)  msg = '👹 20웨이브! 미니 보스!';
    else if (w === 30)  msg = '⚔ 30웨이브! 엘리트 쌍검사!';
    else if (w === 50)  msg = '💫 50웨이브! 절반의 영웅!';
    else if (w === 100) msg = '🌟 100웨이브! 전설!';
    if (!msg) return;

    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, msg, {
      fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
      color: '#ffdd44', backgroundColor: '#1a0a00',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(250).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 1800, onComplete: () => t.destroy() });
      },
    });

    if (w === 50 || w === 100) this.cameras.main.flash(400, 255, 220, 50, false);
  }

  private showEndlessResult(): void {
    const gs = loadGameState();
    const crystalsBase  = Math.floor(this.wave / 5);
    const milestone     = (this.wave >= 100 ? 10 : 0) + (this.wave >= 50 ? 5 : 0) + (this.wave >= 20 ? 2 : 0);
    const crystals      = Math.round((crystalsBase + milestone) * this.wisdomBonuses.crystalEarnMult);
    const isNewRecord   = this.wave > (gs.endlessHighScore ?? 0);

    gs.soulCrystals      = (gs.soulCrystals     ?? 0) + crystals;
    gs.endlessHighScore  = Math.max(gs.endlessHighScore ?? 0, this.wave);
    gs.totalKills        = gs.totalKills       ?? 0;
    gs.totalGoldEarned   = gs.totalGoldEarned  ?? 0;
    saveGameState(gs);

    this.registry.set('endlessResult', {
      wave:           this.wave,
      kills:          this.killsThisRun,
      goldEarned:     this.goldEarnedThisRun,
      crystalsEarned: crystals,
      isNewRecord,
    });

    this.scene.stop('UIScene');
    this.scene.start('EndlessResultScene');
  }

  // ─── Achievement system ────────────────────────────────────────────────────

  private checkAchievementsAndToast(gs: ReturnType<typeof loadGameState>): void {
    const ctx: AchievementContext = {
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

    const newlyUnlocked = checkAchievements(ctx, gs.achievements ?? {});
    if (newlyUnlocked.length === 0) return;

    // Persist unlocks
    gs.achievements = gs.achievements ?? {};
    newlyUnlocked.forEach(id => {
      gs.achievements[id] = { unlocked: true, current: 0, unlockedAt: Date.now() };
    });
    saveGameState(gs);

    // Show toasts in sequence
    newlyUnlocked.forEach((id, i) => {
      const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
      if (!def) return;
      this.time.delayedCall(i * 3200, () => this.showAchievementToast(def.name, def.icon));
    });
  }

  private tickQuestAndNotify(gs: ReturnType<typeof loadGameState>, type: Parameters<typeof updateQuestObjective>[1], amount = 1): void {
    const update = updateQuestObjective(gs, type, amount);
    tickSubQuestProgress(gs, type, amount);
    if (update?.questDone) {
      completeAndAdvance(gs);
      this.time.delayedCall(600, () => this.showQuestCompleteToast());
    }
  }

  private showQuestCompleteToast(): void {
    const toast = this.add.container(CANVAS_WIDTH / 2, -50).setDepth(500);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1060, 0.95);
    bg.fillRoundedRect(-130, -22, 260, 44, 8);
    bg.lineStyle(2, 0xaa88ff, 0.9);
    bg.strokeRoundedRect(-130, -22, 260, 44, 8);
    toast.add(bg);
    toast.add(this.add.text(0, 0, '📜 퀘스트 완료!', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ddaaff',
    }).setOrigin(0.5));
    this.tweens.add({
      targets: toast, y: 60, duration: 400, ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({ targets: toast, y: -60, alpha: 0, duration: 350, onComplete: () => toast.destroy() });
        });
      },
    });
  }

  private showAchievementToast(name: string, icon: string): void {
    const toast = this.add.container(CANVAS_WIDTH / 2, -60).setDepth(500);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2a10, 0.95);
    bg.fillRoundedRect(-120, -24, 240, 48, 8);
    bg.lineStyle(2, 0x44cc44, 0.9);
    bg.strokeRoundedRect(-120, -24, 240, 48, 8);

    const iconTxt = this.add.text(-90, 0, icon, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5);

    const label = this.add.text(-60, -8, '업적 달성!', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#88dd44',
    }).setOrigin(0, 0.5);

    const nameTxt = this.add.text(-60, 7, name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold', color: '#ccff88',
    }).setOrigin(0, 0.5);

    toast.add([bg, iconTxt, label, nameTxt]);

    // Slide in
    this.tweens.add({
      targets: toast,
      y: 80,
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        // Slide out after 2.5s
        this.tweens.add({
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

  // ─── Consecutive day tracking ──────────────────────────────────────────────

  private trackConsecutiveDays(): void {
    const gs    = loadGameState();
    const today = new Date().toISOString().split('T')[0];
    if (gs.lastPlayDate === today) return;   // already tracked today

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    gs.consecutiveDays = (gs.lastPlayDate === yesterday)
      ? (gs.consecutiveDays ?? 0) + 1
      : 1;
    gs.lastPlayDate = today;
    saveGameState(gs);
    logger.debug(`[STREAK] day ${gs.consecutiveDays} (last: ${gs.lastPlayDate})`);
  }

  // ─── Chapter 3: Armory buff ────────────────────────────────────────────────

  /** Recompute and cache armory bonus for every guardian room. Called at wave start. */
  private updateArmoryBonuses(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const d = this.roomGrid[row][col];
        if (!d || d.type !== 'guardian') continue;
        let bonus = 0;
        // Find nearest armory within its radius
        for (let ar = 0; ar < GRID_ROWS; ar++) {
          for (let ac = 0; ac < this.effectiveCols; ac++) {
            const ad = this.roomGrid[ar][ac];
            if (!ad || ad.type !== 'armory') continue;
            const radius = getArmoryRadius(ad.level);
            const dist = Math.max(Math.abs(ar - row), Math.abs(ac - col));
            if (dist <= radius) {
              bonus = Math.max(bonus, getArmoryDmgBonus(ad.level));
            }
          }
        }
        d.armoryDmgBonus = bonus;
      }
    }
  }

  // ─── Chapter 3: SOUL_HARVEST ───────────────────────────────────────────────

  private runSoulHarvest(now: number): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || data.monsterSlot !== 'death_messenger') continue;
        if (now - data.soulHarvestLastTime < 800) continue;

        // Check all invaders in row for ≤15% HP
        const cs = this.effectiveCellSize;
        const cellCenterY = GRID_Y + row * cs + cs / 2;
        for (const inv of this.activeInvaders) {
          if (!inv.active || inv.isDecoy) continue;
          if (Math.abs(inv.y - cellCenterY) > cs * 1.5) continue;
          const pct = inv.hp / inv.maxHp;
          if (pct <= 0.15) {
            // Execute!
            inv.takeDamage(inv.hp, true);
            data.soulHarvestLastTime = now;
            this.gold += 5;
            this.registry.set('gold', this.gold);
            this.showSoulHarvestExec(inv.x, inv.y);
            this.rooms[row][col].flashAttack();
            logger.debug(`[SOUL_HARVEST] executed ${inv.def.type} hp=${inv.hp}`);
            break;
          }
        }
      }
    }
  }

  private showSoulHarvestExec(x: number, y: number): void {
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(0x400060, 0.9);
    g.fillCircle(x, y, 28);
    this.tweens.add({ targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 500,
      onComplete: () => g.destroy() });
    const t = this.add.text(x, y - 20, '💀 처형 +5💰', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(56);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  // ─── Chapter 3: CHAIN_LIGHTNING ────────────────────────────────────────────

  private triggerChainLightning(source: Invader, chainDmg: number, maxChains: number): void {
    const chained = new Set<Invader>([source]);
    let current = source;
    for (let i = 0; i < maxChains; i++) {
      let nearest: Invader | null = null;
      let nearestDist = Infinity;
      for (const inv of this.activeInvaders) {
        if (!inv.active || chained.has(inv)) continue;
        const d = Math.hypot(inv.x - current.x, inv.y - current.y);
        if (d < 120 && d < nearestDist) { nearestDist = d; nearest = inv; }
      }
      if (!nearest) break;
      chained.add(nearest);
      nearest.takeDamage(chainDmg, true);
      // Lightning arc visual
      const arc = this.add.graphics().setDepth(55);
      arc.lineStyle(2, 0xffee44, 0.9);
      arc.lineBetween(current.x, current.y, nearest.x, nearest.y);
      // Zig-zag: add 2 mid points offset
      const mx = (current.x + nearest.x) / 2 + Phaser.Math.Between(-12, 12);
      const my = (current.y + nearest.y) / 2 + Phaser.Math.Between(-12, 12);
      arc.lineStyle(1.5, 0xffffff, 0.7);
      arc.lineBetween(current.x, current.y, mx, my);
      arc.lineBetween(mx, my, nearest.x, nearest.y);
      this.tweens.add({ targets: arc, alpha: 0, duration: 250, onComplete: () => arc.destroy() });
      current = nearest;
    }
    if (chained.size > 1) {
      const t = this.add.text(source.x, source.y - 18, `⚡×${chained.size - 1}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffee44',
      }).setOrigin(0.5).setDepth(56);
      this.tweens.add({ targets: t, y: source.y - 45, alpha: 0, duration: 600, onComplete: () => t.destroy() });
      logger.debug(`[CHAIN_LIGHTNING] chained ${chained.size - 1} targets @ ${chainDmg} dmg`);
    }
  }

  // ─── Chapter 3: SPECTRAL_BOLT ──────────────────────────────────────────────

  private triggerSpectralBolt(fromX: number, _fromY: number, row: number, dmg: number): void {
    const cs = this.effectiveCellSize;
    const rowY = GRID_Y + row * cs + cs / 2;
    let hits = 0;

    // Ghostly bolt visual travelling right to left (invaders move right to left)
    const bolt = this.add.graphics().setDepth(55);
    bolt.fillStyle(0xaaddff, 0.9);
    bolt.fillEllipse(fromX, rowY, 14, 8);
    this.tweens.add({
      targets: bolt, x: -40, duration: 600, ease: 'Linear',
      onComplete: () => bolt.destroy(),
    });

    // Deal damage to all invaders in row
    this.activeInvaders.forEach(inv => {
      if (!inv.active || Math.abs(inv.y - rowY) > cs * 0.7) return;
      inv.takeDamage(dmg, true);
      hits++;
      const flash = this.add.graphics().setDepth(inv.depth + 2);
      flash.fillStyle(0xaaddff, 0.6);
      flash.fillCircle(inv.x, inv.y, inv.def.radius + 4);
      this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    });

    if (hits > 0) logger.debug(`[SPECTRAL_BOLT] row=${row} hits=${hits} dmg=${dmg}`);
  }

  // ─── Chapter 3: WHIRLWIND_DANCE ────────────────────────────────────────────

  private triggerWhirlwind(row: number, dmg: number, rx: number, ry: number): void {
    const cs = this.effectiveCellSize;
    const rowY = GRID_Y + row * cs + cs / 2;
    let hits = 0;
    this.activeInvaders.forEach(inv => {
      if (!inv.active || Math.abs(inv.y - rowY) > cs * 0.8) return;
      inv.takeDamage(dmg);
      hits++;
    });
    // Spinning vortex visual
    const g = this.add.graphics().setDepth(55);
    g.lineStyle(3, 0xff6622, 0.9);
    g.strokeCircle(rx, ry, 20);
    this.tweens.add({ targets: g, scaleX: 5, scaleY: 5, alpha: 0, rotation: Math.PI * 2, duration: 600,
      onComplete: () => g.destroy() });
    const t = this.add.text(rx, ry - 20, '🌀 회오리!', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ff8844',
    }).setOrigin(0.5).setDepth(56);
    this.tweens.add({ targets: t, y: ry - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    logger.debug(`[WHIRLWIND] row=${row} hits=${hits} dmg=${dmg}`);
  }

  // ─── Chapter 3: Medicine Hall healing ─────────────────────────────────────

  private medicineHealTick = 0;
  private medicineGlobalPulseLast = 0;

  private runMedicineHallHeal(now: number): void {
    if (now - this.medicineHealTick < 1000) return;
    this.medicineHealTick = now;

    for (let mr = 0; mr < GRID_ROWS; mr++) {
      for (let mc = 0; mc < this.effectiveCols; mc++) {
        const md = this.roomGrid[mr][mc];
        if (!md || md.type !== 'medicine_hall') continue;
        const healRate = getMedicineHealRate(md.level);

        // Lv2+: self-heal
        if (md.level >= 2) this.rooms[mr][mc].healRoomHp(healRate);

        // Heal adjacent rooms
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          const nr = mr + dr, nc = mc + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= this.effectiveCols) continue;
          const nd = this.roomGrid[nr][nc];
          if (!nd) continue;
          this.rooms[nr][nc].healRoomHp(healRate);
        }

        // Lv3: global pulse every 15s
        if (md.level >= 3 && now - this.medicineGlobalPulseLast >= 15000) {
          this.medicineGlobalPulseLast = now;
          this.triggerMedicineGlobalPulse(healRate * 2);
        }
      }
    }
  }

  private triggerMedicineGlobalPulse(amount: number): void {
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < this.effectiveCols; c++)
        if (this.roomGrid[r][c]) this.rooms[r][c].healRoomHp(amount);

    const pulse = this.add.graphics().setDepth(50);
    pulse.lineStyle(3, 0x44ff88, 0.8);
    pulse.strokeCircle(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * this.effectiveCellSize / 2, 20);
    this.tweens.add({ targets: pulse, scaleX: 20, scaleY: 20, alpha: 0, duration: 800,
      onComplete: () => pulse.destroy() });
    logger.debug(`[MEDICINE HALL] Lv3 global pulse +${amount} HP`);
  }

  // ─── Chapter 3: POISON_TRAIL room damage ───────────────────────────────────

  private poisonDamageTick = 0;

  private runPoisonTrailDamage(now: number): void {
    if (now - this.poisonDamageTick < 1000) return;
    this.poisonDamageTick = now;

    const cs = this.effectiveCellSize;
    for (const inv of this.activeInvaders) {
      if (!inv.active || inv.def.behavior !== 'POISON_TRAIL') continue;
      // Damage rooms near this invader (5 HP/s)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < this.effectiveCols; c++) {
          if (!this.roomGrid[r][c]) continue;
          const cx = GRID_X + c * cs + cs / 2;
          const cy = GRID_Y + r * cs + cs / 2;
          if (Math.hypot(inv.x - cx, inv.y - cy) < cs * 0.8) {
            const rd = this.roomGrid[r][c];
            if (rd && this.time.now < (rd.immuneUntil ?? 0)) break; // fortress/shield active
            this.rooms[r][c].damageRoomHp(5);
            // Green puddle beneath invader
            const puddle = this.add.graphics().setDepth(inv.depth - 2);
            puddle.fillStyle(0x44ff44, 0.18);
            puddle.fillEllipse(inv.x, inv.y + inv.def.radius, 30, 14);
            this.tweens.add({ targets: puddle, alpha: 0, duration: 600, onComplete: () => puddle.destroy() });
          }
        }
      }
    }
  }

  // ─── Chapter 3: UNDYING_KNIGHT (revive once if killed by non-magic) ────────

  private setupUndyingKnight(inv: Invader): void {
    const checkRevive = () => {
      if (!inv.active) return;
      if (inv.hp <= 0 && !inv.revivedOnce && !inv.killedByMagic) {
        inv.revivedOnce = true;
        inv.hp = Math.round(inv.maxHp * 0.60);
        inv.setTint(0xaaaaff);
        const t = this.add.text(inv.x, inv.y - 22, '불사 부활!', {
          fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#88aaff',
        }).setOrigin(0.5).setDepth(56);
        this.tweens.add({ targets: t, y: inv.y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
        logger.debug('[UNDYING_KNIGHT] revived at 60% HP');
      }
      this.time.delayedCall(200, checkRevive);
    };
    this.time.delayedCall(200, checkRevive);
  }

  // ─── Chapter 3: DECOY_CLONE ────────────────────────────────────────────────

  private setupDecoyClone(inv: Invader): void {
    const spawnDecoy = () => {
      if (!inv.active || !inv.active) return;
      if (inv.hasDecoyAlive) { this.time.delayedCall(15000, spawnDecoy); return; }
      // Spawn a ghost-like decoy that walks the path
      const decoyDef = { ...inv.def, hp: 1, reward: 0, damage: 0 };
      const decoy = new Invader(this, this.invaderPath, decoyDef);
      decoy.isDecoy = true;
      decoy.setAlpha(0.45);
      decoy.setTint(0xaaaaff);
      decoy.setDepth(38);
      this.activeInvaders.push(decoy);
      inv.hasDecoyAlive = true;
      // When decoy dies, release flag
      this.events.once(`decoyDied_${decoy.def.type}_${Date.now()}`, () => {
        inv.hasDecoyAlive = false;
      });
      logger.debug('[DECOY_CLONE] spawned decoy');
      this.time.delayedCall(15000, spawnDecoy);
    };
    this.time.delayedCall(15000, spawnDecoy);
  }

  // ─── Chapter 3: VOID_TELEPORT ──────────────────────────────────────────────

  private scheduleVoidTeleport(inv: Invader): void {
    this.time.delayedCall(2000, () => {
      if (!inv.active) return;
      // Teleport invader to the last row of the grid
      const cs = this.effectiveCellSize;
      const finalRowY = GRID_Y + (GRID_ROWS - 1) * cs + cs / 2;
      const targetX   = GRID_X + cs / 2;  // leftmost col
      // Visual: void flash at current position
      const flash = this.add.graphics().setDepth(60);
      flash.fillStyle(0x220044, 0.9);
      flash.fillCircle(inv.x, inv.y, 28);
      this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 400,
        onComplete: () => flash.destroy() });
      // Re-appear at target
      inv.setPosition(targetX, finalRowY);
      inv.setAlpha(0);
      this.tweens.add({ targets: inv, alpha: 1, duration: 300 });
      const t = this.add.text(targetX, finalRowY - 22, '공허 이동!', {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#cc44ff',
      }).setOrigin(0.5).setDepth(56);
      this.tweens.add({ targets: t, y: finalRowY - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
      logger.debug('[VOID_TELEPORT] teleported to final row');
    });
  }

  // ─── Chapter 3: DRAGON_KING_PHASE boss ─────────────────────────────────────

  private setupDragonKingPhase(inv: Invader): void {
    this.buildDragonKingHpBar(inv.maxHp);
    let phase = 1;
    const checkPhase = () => {
      if (!inv.active) return;
      const pct = inv.hp / inv.maxHp;
      if (pct <= 0.66 && phase === 1) {
        phase = 2;
        inv.isFireImmune = true;
        inv.applySpeedBoost(55 / inv.def.speed, 9999999);
        this.showDragonPhaseTransition(inv, 2, '🐲 불꽃 형태! 화염 면역!');
        logger.debug('[DRAGON_KING] phase 2 — fire immune, speed 55');
      }
      if (pct <= 0.33 && phase === 2) {
        phase = 3;
        inv.dragonPhase = 3;
        this.showDragonPhaseTransition(inv, 3, '🐲 해저 잠수! 함정만 통함!');
        // Begin submerge cycle
        inv.applySubmerge(6000);
        logger.debug('[DRAGON_KING] phase 3 — submerge loop begins');
      }
      this.time.delayedCall(400, checkPhase);
    };
    this.time.delayedCall(400, checkPhase);
  }

  private buildDragonKingHpBar(maxHp: number): void {
    this.bossMaxHp = maxHp;
    const bx = CANVAS_WIDTH / 2 - 100;
    const by = TOP_BAR_HEIGHT + 2;
    if (!this.bossHpBarBg) {
      this.bossHpBarBg = this.add.graphics().setDepth(95);
      this.bossHpBarBg.fillStyle(0x001430, 1);
      this.bossHpBarBg.fillRoundedRect(bx - 2, by - 2, 204, 16, 3);
    }
    if (!this.bossHpBarFill) this.bossHpBarFill = this.add.graphics().setDepth(96);
    if (!this.bossHpLabel) {
      this.bossHpLabel = this.add.text(CANVAS_WIDTH / 2, by - 12, '🐲 용왕', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#44aaff',
      }).setOrigin(0.5).setDepth(97);
    }
  }

  private showDragonPhaseTransition(_inv: Invader, phase: number, msg: string): void {
    this.cameras.main.shake(400, 0.02);
    this.cameras.main.flash(300, 0, 100, 180, false);
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, msg, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: phase === 2 ? '#ff8844' : '#44aaff',
      backgroundColor: '#001430', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(260).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1500, onComplete: () => t.destroy() });
      },
    });
    logger.debug(`[DRAGON_KING] phase transition → ${phase}: "${msg}"`);
  }

  // ─── Ch4/Ch5 helpers ──────────────────────────────────────────────────────

  /** Returns true if any placed monster has DIVINE_TERRITORY passive */
  private hasDivineTerritory(): boolean {
    for (const row of this.roomGrid)
      for (const d of row)
        if (d?.monsterSlot && MONSTER_DEFS[d.monsterSlot]?.passive === 'DIVINE_TERRITORY')
          return true;
    return false;
  }

  /** Returns true if any placed monster with the given tribe has TRIBE_MASTERY */
  private hasTribeMasteryFor(tribe: import('../data/monsters').TribeId): boolean {
    for (const row of this.roomGrid)
      for (const d of row)
        if (d?.monsterSlot) {
          const def = MONSTER_DEFS[d.monsterSlot];
          if (def?.passive === 'TRIBE_MASTERY' && def.tribe === tribe) return true;
        }
    return false;
  }

  /** Returns true if any placed monster has SEASONAL_BOON passive */
  private hasSeasonalBoon(): boolean {
    for (const row of this.roomGrid)
      for (const d of row)
        if (d?.monsterSlot && MONSTER_DEFS[d.monsterSlot]?.passive === 'SEASONAL_BOON')
          return true;
    return false;
  }

  // ─── Ch4: ENTRANCING_VEIL — while celestial_dancer placed, slow all invaders ─

  private entrancingVeilApplied = false;

  private runEntrancingVeil(): void {
    // Check if any room has celestial_dancer
    let hasDancer = false;
    for (const row of this.roomGrid)
      for (const d of row)
        if (d?.monsterSlot === 'celestial_dancer') { hasDancer = true; break; }

    if (hasDancer && !this.entrancingVeilApplied) {
      this.entrancingVeilApplied = true;
      // Apply 0.88 speed multiplier to all active + future invaders
      for (const inv of this.activeInvaders)
        if (inv.active) inv.applySlow(0.88, 9999999);
      logger.debug('[ENTRANCING_VEIL] global 0.88× speed active');
    } else if (!hasDancer && this.entrancingVeilApplied) {
      this.entrancingVeilApplied = false;
    }
  }

  // ─── Ch4: Spirit Altar — summon ghost warrior on kill threshold ────────────

  private runSpiritAltar(_now: number): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const d = this.roomGrid[row][col];
        if (!d || d.type !== 'spirit_altar') continue;
        const needed = getAltarKillsNeeded(d.level);
        if (d.altarKillCount >= needed && d.altarGhostActiveUntil <= this.time.now) {
          d.altarKillCount = 0;
          const ghostCount = d.level >= 2 ? 2 : 1;
          d.altarGhostActiveUntil = this.time.now + 10000;
          for (let g = 0; g < ghostCount; g++) {
            this.time.delayedCall(g * 400, () => this.spawnGhostWarrior(row, col));
          }
          logger.debug(`[SPIRIT_ALTAR Lv${d.level}] summoning ${ghostCount} ghost(s)`);
        }
      }
    }
  }

  private spawnGhostWarrior(altarRow: number, _altarCol: number): void {
    // Ghost patrols exit row — spawn a ghost_add at entrance and fast-track it
    const def = INVADER_DEFS['ghost_add'];
    const inv  = new Invader(this, this.invaderPath, def);
    inv.setDepth(42);
    inv.setAlpha(0.7);
    inv.setTint(0x8888ff);
    inv.isMagicImmune = true;   // physical-immune ghost
    this.activeInvaders.push(inv);
    const label = this.add.text(inv.x, inv.y - 18, '👻 소환!', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaaff',
    }).setOrigin(0.5).setDepth(56);
    this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 900, onComplete: () => label.destroy() });
    logger.debug(`[GHOST] spawned from altar row=${altarRow}`);
  }

  // ─── Ch4: LUNAR_RHYTHM — every 30s reset adjacent room cooldowns ───────────

  private runLunarRhythm(now: number): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const d = this.roomGrid[row][col];
        if (!d || d.monsterSlot !== 'moon_rabbit_sage') continue;
        if (now - d.lunarResetLastTime < 30000) continue;
        d.lunarResetLastTime = now;
        // Reset adjacent rooms (4 cardinal dirs)
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= this.effectiveCols) continue;
          const nd = this.roomGrid[nr][nc];
          if (nd) nd.lastAttackTime = 0;
        }
        const t = this.add.text(this.rooms[row][col].x, this.rooms[row][col].y - 20, '🌙 쿨타임 초기화!', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#ddeeff',
        }).setOrigin(0.5).setDepth(55);
        this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
        logger.debug(`[LUNAR_RHYTHM] adjacent cooldowns reset at [${row},${col}]`);
      }
    }
  }

  // ─── Ch4: Dragon's Roar effect ─────────────────────────────────────────────

  private triggerDragonRoar(x: number, y: number): void {
    this.cameras.main.shake(300, 0.015);
    const flash = this.add.graphics().setDepth(60);
    flash.lineStyle(3, 0xff4400, 0.9);
    flash.strokeCircle(x, y, 20);
    this.tweens.add({ targets: flash, scaleX: 5, scaleY: 5, alpha: 0, duration: 500, onComplete: () => flash.destroy() });

    // Slow all invaders 50% for 3s
    for (const inv of this.activeInvaders)
      if (inv.active) inv.applySlow(0.5, 3000);

    const t = this.add.text(x, y - 24, '🐲 포효!', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ff8844',
    }).setOrigin(0.5).setDepth(56);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    logger.debug('[DRAGONS_ROAR] all invaders slowed 50% for 3s');
  }

  // ─── Ch4: VOID_STEALTH_ELITE behavior ──────────────────────────────────────

  private setupVoidStealthElite(inv: Invader): void {
    // Teleport after 2s, then 2s stealth
    this.time.delayedCall(2000, () => {
      if (!inv.active) return;
      // Flash at current position
      const flash = this.add.graphics().setDepth(60);
      flash.fillStyle(0x440066, 0.85);
      flash.fillCircle(inv.x, inv.y, 22);
      this.tweens.add({ targets: flash, scaleX: 2, scaleY: 2, alpha: 0, duration: 350, onComplete: () => flash.destroy() });

      // Move to halfway point
      const cs = this.effectiveCellSize;
      inv.setPosition(GRID_X + cs / 2, GRID_Y + Math.floor(GRID_ROWS / 2) * cs + cs / 2);
      inv.isInvisible = true;
      inv.setAlpha(0.15);

      // Re-appear after 2s
      this.time.delayedCall(2000, () => {
        if (!inv.active) return;
        inv.isInvisible = false;
        this.tweens.add({ targets: inv, alpha: 1, duration: 300 });
      });
      logger.debug('[VOID_STEALTH_ELITE] teleported + stealth 2s');
    });
  }

  // ─── Ch4: setupDeathEmissary (STUN_IMMUNE boss) ─────────────────────────────

  private setupDeathEmissary(inv: Invader): void {
    this.buildBossHpBar(inv.maxHp);

    // Draw immunity aura (dark purple ring)
    const aura = this.add.graphics().setDepth(inv.depth - 1);
    const drawAura = () => {
      if (!inv.active) { aura.destroy(); return; }
      aura.clear();
      const pulse = 0.5 + 0.3 * Math.sin(this.time.now * 0.004);
      if (inv.isDamageImmune) {
        aura.lineStyle(3, 0x660088, pulse);
        aura.strokeCircle(inv.x, inv.y, inv.def.radius + 12);
        aura.fillStyle(0x220044, pulse * 0.3);
        aura.fillCircle(inv.x, inv.y, inv.def.radius + 12);
      } else {
        // While stunned: bright red — damageable
        aura.lineStyle(3, 0xff0000, 0.9);
        aura.strokeCircle(inv.x, inv.y, inv.def.radius + 12);
      }
      this.time.delayedCall(60, drawAura);
    };
    drawAura();

    let emissaryPhase = 1;

    const checkPhase = () => {
      if (!inv.active) return;
      const pct = inv.hp / inv.maxHp;

      if (pct <= 0.66 && emissaryPhase === 1) {
        emissaryPhase = 2;
        logger.debug('[DEATH_EMISSARY] phase 2 — faster ghost adds (12s)');
        this.showBossPhaseText(inv, 2, '💀 2단계! 망령 가속!', 0x8800cc);
      }
      if (pct <= 0.33 && emissaryPhase === 2) {
        emissaryPhase = 3;
        logger.debug('[DEATH_EMISSARY] phase 3 — JUDGMENT every 25s');
        this.showBossPhaseText(inv, 3, '💀 3단계! 심판의 심판!', 0xcc0000);
        // JUDGMENT: random room loses 50% HP every 25s
        this.time.addEvent({
          delay: 25000, repeat: -1,
          callback: () => {
            if (!inv.active || emissaryPhase < 3) return;
            this.triggerJudgment();
          },
        });
      }
      this.time.delayedCall(300, checkPhase);
    };
    checkPhase();

    // Ghost adds every 20s (12s in phase 2)
    const spawnGhostAdd = () => {
      if (!inv.active) return;
      const delay = emissaryPhase >= 2 ? 12000 : 20000;
      this.spawnInvader('ghost_add');
      const t = this.add.text(INVADER_WAYPOINTS[0].x, INVADER_WAYPOINTS[0].y, '👻', {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5).setDepth(50);
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, duration: 800, onComplete: () => t.destroy() });
      this.time.delayedCall(delay, spawnGhostAdd);
    };
    this.time.delayedCall(20000, spawnGhostAdd);

    // Show immunity / stun-to-damage hint
    const hintLoop = () => {
      if (!inv.active) return;
      const msg = inv.isDamageImmune
        ? '면역 — 기절시켜야 피해!'
        : '⚡ 피해 가능!';
      const color = inv.isDamageImmune ? '#cc44ff' : '#ff4444';
      const t = this.add.text(inv.x, inv.y - inv.def.radius - 18, msg, {
        fontFamily: 'sans-serif', fontSize: '9px', color,
      }).setOrigin(0.5).setDepth(70);
      this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
      this.time.delayedCall(1500, hintLoop);
    };
    this.time.delayedCall(500, hintLoop);

    logger.debug('[DEATH_EMISSARY] setup complete — isDamageImmune=true, ghost adds every 20s');
  }

  private triggerJudgment(): void {
    // Pick a random non-null room and deal 50% HP
    const candidates: Array<[number, number]> = [];
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < this.effectiveCols; c++)
        if (this.roomGrid[r][c]) candidates.push([r, c]);
    if (!candidates.length) return;
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    const d = this.roomGrid[r][c]!;
    const dmg = Math.round(d.maxRoomHp * 0.5);
    d.roomHp = Math.max(0, d.roomHp - dmg);
    const rm = this.rooms[r][c];
    this.cameras.main.shake(500, 0.025);
    const t = this.add.text(rm.x, rm.y, '☠️ 심판!', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ff0000',
    }).setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
    logger.debug(`[JUDGMENT] room [${r},${c}] −50% HP (−${dmg})`);
  }

  // ─── Ch5: setupThreeGodDestroyer (FIVE_PHASE boss) ─────────────────────────

  private setupThreeGodDestroyer(inv: Invader): void {
    this.buildBossHpBar(inv.maxHp);

    let phase5 = 1;
    const phaseColors = [0xff4444, 0xff8800, 0xffff00, 0x44ff88, 0xaa00ff];
    const phaseNames = ['화염', '번개', '공허', '독', '신성'];

    const checkPhase5 = () => {
      if (!inv.active) return;
      const pct = inv.hp / inv.maxHp;
      const thresholds = [0.80, 0.60, 0.40, 0.20];
      if (phase5 <= 4 && pct <= thresholds[phase5 - 1]) {
        phase5++;
        inv.ch5BossPhase = phase5;
        const color = phaseColors[phase5 - 1];
        const name  = phaseNames[phase5 - 1];
        this.showBossPhaseText(inv, phase5, `⛰️ ${name} 단계!`, color);
        this.cameras.main.shake(600, 0.03);
        this.cameras.main.flash(400, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false);

        // Each phase adds a new ability
        switch (phase5) {
          case 2: // Lightning: chain lightning every 10s
            this.time.addEvent({
              delay: 10000, repeat: -1,
              callback: () => {
                if (!inv.active || inv.ch5BossPhase < 2) return;
                const nearest = this.activeInvaders.filter(i => i !== inv && i.active)[0];
                if (nearest) this.triggerChainLightning(nearest, 60, 5);
              },
            });
            break;
          case 3: // Void: teleport every 15s (target closest room to exit)
            this.time.addEvent({
              delay: 15000, repeat: -1,
              callback: () => {
                if (!inv.active || inv.ch5BossPhase < 3) return;
                inv.setAlpha(0);
                const cs = this.effectiveCellSize;
                inv.setPosition(GRID_X + cs / 2, GRID_Y + (GRID_ROWS - 1) * cs + cs / 2);
                this.tweens.add({ targets: inv, alpha: 1, duration: 300 });
                logger.debug('[THREE_GOD] phase 3 void teleport');
              },
            });
            break;
          case 4: // Venom: apply burn to all rooms every 20s
            this.time.addEvent({
              delay: 20000, repeat: -1,
              callback: () => {
                if (!inv.active || inv.ch5BossPhase < 4) return;
                for (const r of this.roomGrid)
                  for (const d of r)
                    if (d) { d.roomHp = Math.max(0, d.roomHp - 40); }
                const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, '🐍 독 홍수!', {
                  fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cc00',
                  backgroundColor: '#001400', padding: { x: 10, y: 5 },
                }).setOrigin(0.5).setDepth(260).setAlpha(0);
                this.tweens.add({ targets: t, alpha: 1, duration: 300,
                  onComplete: () => this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1200, onComplete: () => t.destroy() }) });
                logger.debug('[THREE_GOD] phase 4 venom flood — all rooms −40 HP');
              },
            });
            break;
          case 5: // Divine: all invaders heal + speed boost
            this.time.addEvent({
              delay: 12000, repeat: -1,
              callback: () => {
                if (!inv.active || inv.ch5BossPhase < 5) return;
                for (const ai of this.activeInvaders)
                  if (ai.active) { ai.receiveHeal(100); ai.applySpeedBoost(1.3, 8000); }
                const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, '✨ 신성 가호!', {
                  fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffeeaa',
                  backgroundColor: '#201000', padding: { x: 10, y: 5 },
                }).setOrigin(0.5).setDepth(260).setAlpha(0);
                this.tweens.add({ targets: t, alpha: 1, duration: 300,
                  onComplete: () => this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1200, onComplete: () => t.destroy() }) });
                logger.debug('[THREE_GOD] phase 5 divine blessing — all invaders +100HP +30% speed');
              },
            });
            break;
        }
        logger.debug(`[THREE_GOD_DESTROYER] phase ${phase5} (${name}) — HP ${Math.round(pct * 100)}%`);
      }
      this.time.delayedCall(300, checkPhase5);
    };
    checkPhase5();

    logger.debug('[THREE_GOD_DESTROYER] setup complete — 5-phase final boss');
  }

  private showBossPhaseText(inv: Invader, phase: number, msg: string, colorHex: number): void {
    const cs = `#${colorHex.toString(16).padStart(6, '0')}`;
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, msg, {
      fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
      color: cs, backgroundColor: '#000000cc', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(265).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1800, onComplete: () => t.destroy() });
      },
    });
    logger.debug(`[BOSS_PHASE_${phase}] "${msg}"`);
    // Ring flash around boss
    const ring = this.add.graphics().setDepth(inv.depth + 2);
    ring.lineStyle(4, colorHex, 1);
    ring.strokeCircle(inv.x, inv.y, inv.def.radius + 6);
    this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
  }

  // ─── Game Complete Screen ─────────────────────────────────────────────────

  private showGameComplete(): void {
    // Persist rewards first (guard against duplicate triggers)
    const crystalBonus = 50;
    const gs0 = loadGameState();
    if (!gs0.gameCompleted) {
      gs0.soulCrystals += crystalBonus;
      gs0.gameCompleted = true;
      saveGameState(gs0);
      // Fire achievement check now that stageProgress[61] is set
      this.checkAchievementsAndToast(gs0);
    }

    // Play game_complete cinematic on first clear
    const gs1 = loadGameState();
    const seen = gs1.cinematicSeen ?? [];
    if (!seen.includes('game_complete')) {
      this.scene.stop('UIScene');
      this.scene.start('CinematicScene', { cinematicId: 'game_complete', nextScene: 'StageSelectScene' });
      return;
    }

    // Cinematic already seen — show summary overlay
    this.waveActive = false;
    this.scene.pause();

    const ov = this.add.container(0, 0).setDepth(400);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.92);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    // Gold glow background
    const glow = this.add.graphics();
    glow.fillStyle(0xffcc00, 0.08);
    glow.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(glow);

    const titleT = this.add.text(CANVAS_WIDTH / 2, 140, '🌟 게임 완료! 🌟', {
      fontFamily: 'Georgia, serif', fontSize: '28px', fontStyle: 'bold', color: '#ffcc00',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(titleT);
    this.tweens.add({ targets: titleT, alpha: 1, duration: 600, delay: 200 });

    const subT = this.add.text(CANVAS_WIDTH / 2, 190, '모든 6개 챕터를 클리어했습니다!', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffeeaa',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(subT);
    this.tweens.add({ targets: subT, alpha: 1, duration: 400, delay: 500 });

    // Star display
    const stars3 = this.add.text(CANVAS_WIDTH / 2, 250, '★★★★★★', {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#ffcc00',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(stars3);
    this.tweens.add({ targets: stars3, alpha: 1, duration: 400, delay: 700,
      onComplete: () => {
        this.tweens.add({ targets: stars3, scaleX: 1.15, scaleY: 1.15, duration: 400, yoyo: true, repeat: 2 });
      },
    });

    const crystalT = this.add.text(CANVAS_WIDTH / 2, 310, `보너스 영혼 결정체 +${crystalBonus} 💎`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#88aaff',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(crystalT);
    this.tweens.add({ targets: crystalT, alpha: 1, duration: 400, delay: 900 });

    const hpT = this.add.text(CANVAS_WIDTH / 2, 340, `최종 던전 HP: ${this.dungeonHp}/${this.maxHp}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(hpT);
    this.tweens.add({ targets: hpT, alpha: 1, duration: 300, delay: 1050 });

    // Prestige prompt
    const pressT = this.add.text(CANVAS_WIDTH / 2, 410, '✨ 명성 시스템 잠금 해제! ✨', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#cc88ff',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(pressT);
    this.tweens.add({ targets: pressT, alpha: 1, duration: 400, delay: 1200 });

    // Return to map button
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x330066, 1);
    btnBg.fillRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8);
    btnBg.lineStyle(2, 0xffcc00, 0.9);
    btnBg.strokeRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8);
    btnBg.setAlpha(0);
    ov.add(btnBg);

    const btnT = this.add.text(CANVAS_WIDTH / 2, 483, '스테이지 선택으로', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffcc00',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(btnT);
    this.tweens.add({ targets: [btnBg, btnT], alpha: 1, duration: 400, delay: 1400 });

    const zone = this.add.zone(CANVAS_WIDTH / 2, 483, 220, 46).setInteractive();
    zone.on('pointerdown', () => {
      this.scene.stop('UIScene');
      this.scene.start('StageSelectScene');
    });
    zone.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(0x550088, 1); btnBg.fillRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8); btnBg.lineStyle(2, 0xffcc00, 0.9); btnBg.strokeRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8); });
    zone.on('pointerout',  () => { btnBg.clear(); btnBg.fillStyle(0x330066, 1); btnBg.fillRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8); btnBg.lineStyle(2, 0xffcc00, 0.9); btnBg.strokeRoundedRect(CANVAS_WIDTH / 2 - 110, 460, 220, 46, 8); });

    logger.debug(`[GAME COMPLETE] all 6 chapters cleared! +${crystalBonus} soul crystals`);
  }

  // ─── Monster XP ──────────────────────────────────────────────────────────

  private grantMonsterXp(amount: number): void {
    const gs = loadGameState();
    if (!gs.ownedMonsters || gs.ownedMonsters.length === 0) return;
    const levelled: string[] = [];
    for (const m of gs.ownedMonsters) {
      const result = addXp(m, amount);
      if (result.levelled) levelled.push(`${m.id} → Lv.${result.newLevel}`);
    }
    saveGameState(gs);
    levelled.forEach((msg, i) => {
      this.time.delayedCall(i * 400, () => this.showXpToast(msg));
    });
    logger.debug(`[XP] +${amount} XP granted to ${gs.ownedMonsters.length} monsters`);
  }

  private showXpToast(msg: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, 120, `⬆ LEVEL UP! ${msg}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: '#ffdd44', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(350).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, y: 100, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, y: 80, duration: 400, delay: 1200,
          onComplete: () => t.destroy() });
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT INTERACTION SUBSYSTEMS
  // ═══════════════════════════════════════════════════════════════════════════

  private initSkillHUD(gameState: ReturnType<typeof loadGameState>): void {
    // Gather equipped active skills from owned monsters
    const equippedSkillIds: string[] = [];
    for (const m of gameState.ownedMonsters ?? []) {
      for (const sid of m.equippedSkills ?? []) {
        if (!equippedSkillIds.includes(sid) && equippedSkillIds.length < 3) {
          equippedSkillIds.push(sid);
        }
      }
    }
    // Fill empty slots with first available skills
    for (const sk of ACTIVE_SKILLS) {
      if (equippedSkillIds.length >= 3) break;
      if (!equippedSkillIds.includes(sk.id)) equippedSkillIds.push(sk.id);
    }

    this.skillHUD = new SkillHUD(this, equippedSkillIds, {
      onSkillSelected: (skillId) => {
        this.targetingSkillId = skillId;
        // Highlight all rooms with monsters
        for (let r = 0; r < this.roomGrid.length; r++) {
          for (let c = 0; c < this.effectiveCols; c++) {
            if (this.roomGrid[r][c]?.monsterSlot) {
              this.rooms[r]?.[c]?.setAlpha(1);
            }
          }
        }
      },
      onSkillCancelled: () => {
        this.targetingSkillId = null;
      },
    });
  }

  private initSwapManager(): void {
    // Global pointerup cancels any in-progress long-press
    this.input.on('pointerup', () => this.swapManager?.onRoomPointerUp());

    this.swapManager = new MonsterSwapManager(this, {
      getMonsterAt: (row, col) => this.roomGrid[row]?.[col]?.monsterSlot ?? null,
      executeSwap: (r1, c1, r2, c2) => {
        const data1 = this.roomGrid[r1]?.[c1];
        const data2 = this.roomGrid[r2]?.[c2];
        if (!data1 || !data2) return;

        // Swap monster slots
        const temp = data1.monsterSlot;
        data1.monsterSlot = data2.monsterSlot;
        data2.monsterSlot = temp;

        // Update visuals
        if (data1.monsterSlot) {
          const def1 = MONSTER_DEFS[data1.monsterSlot as keyof typeof MONSTER_DEFS];
          this.rooms[r1]?.[c1]?.setMonsterSprite(data1.monsterSlot, def1?.emoji);
        } else {
          this.rooms[r1]?.[c1]?.setMonsterSprite(null);
        }
        if (data2.monsterSlot) {
          const def2 = MONSTER_DEFS[data2.monsterSlot as keyof typeof MONSTER_DEFS];
          this.rooms[r2]?.[c2]?.setMonsterSprite(data2.monsterSlot, def2?.emoji);
        } else {
          this.rooms[r2]?.[c2]?.setMonsterSprite(null);
        }

        // Float text
        this.showFloatText(
          this.rooms[r1]?.[c1]?.x ?? 0,
          this.rooms[r1]?.[c1]?.y ?? 0,
          '🔄 교체!', '#44ccff',
        );
      },
    });
  }

  /** Show a repair button on a damaged room. Cost = 50% of build cost. */
  private showRepairOption(row: number, col: number): void {
    const data = this.roomGrid[row]?.[col];
    if (!data || data.roomHp >= data.maxRoomHp) return;

    const def = ROOM_DEFS[data.type];
    const cost = Math.round(def.cost * 0.5);

    const room = this.rooms[row]?.[col];
    if (!room) return;

    const btn = this.add.text(room.x, room.y - 40, `🔧 수리 (${cost}💰)`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#44ff44',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(80).setInteractive();

    btn.on('pointerdown', () => {
      if (this.gold < cost) {
        this.showFloatText(room.x, room.y, '골드 부족!', '#ff4444');
        btn.destroy();
        return;
      }
      this.gold -= cost;
      this.registry.set('gold', this.gold);
      data.roomHp = data.maxRoomHp;
      room.updateHpBar();
      this.showFloatText(room.x, room.y, `🔧 수리 완료!`, '#44ff44');
      btn.destroy();
    });

    // Auto-dismiss after 3s
    this.time.delayedCall(3000, () => btn.destroy());
  }

  private showFloatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(99);
    this.tweens.add({
      targets: t, y: y - 30, alpha: { from: 1, to: 0 },
      duration: 800, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNERGY SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /** Recalculate active tribe synergies and element combos from placed monsters. */
  // ─── Room Durability ──────────────────────────────────────────────────────

  /** Reduce all configured room slot HPs by a fraction of their maxHp. */
  private applyRoomSlotDamage(fraction: number): void {
    for (const slot of this.dungeonTrapSlots) {
      if (!slot) continue;
      slot.hp = Math.max(0, slot.hp - Math.ceil(slot.maxHp * fraction));
    }
  }

  /** Persist current dungeonTrapSlots HP values back to saved game state. */
  private saveRoomHpsToGameState(): void {
    if (this.dungeonTrapSlots.length === 0) return;
    const gs = loadGameState();
    gs.dungeonSlots = gs.dungeonSlots ?? [];
    for (let i = 0; i < this.dungeonTrapSlots.length; i++) {
      const slot = this.dungeonTrapSlots[i];
      if (!slot) continue;
      if (!gs.dungeonSlots[i]) gs.dungeonSlots[i] = slot;
      else { gs.dungeonSlots[i].hp = slot.hp; gs.dungeonSlots[i].maxHp = slot.maxHp; }
    }
    saveGameState(gs);
  }

  // ─── Room Type Bonuses ────────────────────────────────────────────────────

  private recalcRoomTypeBonuses(): void {
    const gc = this.effectiveCols;

    // Reset all bonuses
    this.slotTrapSynergyMult.clear();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < gc; c++) {
        const data = this.roomGrid[r][c];
        if (data) data.roomTypeDmgMult = 1.0;
      }
    }

    const adj = (r: number, c: number): Array<[number, number]> =>
      ([ [-1,0],[1,0],[0,-1],[0,1] ] as Array<[number, number]>)
        .filter(([dr, dc]) => r+dr>=0 && r+dr<GRID_ROWS && c+dc>=0 && c+dc<gc)
        .map(([dr, dc]) => [r+dr, c+dc] as [number, number]);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < gc; c++) {
        const idx  = r * gc + c;
        const slot = this.dungeonTrapSlots[idx];
        if (!slot || slot.hp <= 0) continue;   // broken rooms grant no bonus

        // ── 지원실: 인접 방 ATK +15% ────────────────────────────────────────
        if (slot.roomType === 'support') {
          for (const [nr, nc] of adj(r, c)) {
            const adjData = this.roomGrid[nr][nc];
            if (adjData) adjData.roomTypeDmgMult = Math.max(adjData.roomTypeDmgMult, 1.15);
          }
        }

        // ── 시너지: 전투실 + 마법진 인접 → 전투실 ATK +10%, 마법진 CD -10% ─
        if (slot.roomType === 'combat') {
          const hasMagicNeighbor = adj(r, c).some(([nr, nc]) => {
            const ns = this.dungeonTrapSlots[nr * gc + nc];
            return ns && ns.roomType === 'magic' && ns.hp > 0;
          });
          if (hasMagicNeighbor) {
            const data = this.roomGrid[r][c];
            if (data) data.roomTypeDmgMult = Math.max(data.roomTypeDmgMult, 1.1);
            logger.debug(`[SYNERGY] ⚔️+🔮 전투+마법 시너지 at [${r},${c}]`);
          }
        }
        if (slot.roomType === 'magic') {
          const hasCombatNeighbor = adj(r, c).some(([nr, nc]) => {
            const ns = this.dungeonTrapSlots[nr * gc + nc];
            return ns && ns.roomType === 'combat' && ns.hp > 0;
          });
          if (hasCombatNeighbor) {
            const data = this.roomGrid[r][c];
            if (data) data.attackCooldown = Math.round(data.attackCooldown * 0.9);
          }
        }

        // ── 시너지: 함정실 + 지원실 인접 → 함정 피해 +15% ──────────────────
        if (slot.roomType === 'trap') {
          const hasSupportNeighbor = adj(r, c).some(([nr, nc]) => {
            const ns = this.dungeonTrapSlots[nr * gc + nc];
            return ns && ns.roomType === 'support' && ns.hp > 0;
          });
          if (hasSupportNeighbor) {
            this.slotTrapSynergyMult.set(idx, 1.15);
            logger.debug(`[SYNERGY] 🕸️+💚 함정+지원 시너지 at [${r},${c}]`);
          }
        }
      }
    }
  }

  // ─── Ch6: Shadow Realm (phases out periodically) ─────────────────────────

  private setupShadowRealm(inv: Invader): void {
    inv.shadowRealmGfx = this.add.graphics().setDepth(inv.depth - 1);
    const phaseIn = () => {
      if (inv.isDead || !inv.active) return;
      inv.isInShadowRealm = true;
      inv.isDamageImmune = true;
      this.tweens.add({ targets: inv, alpha: 0.15, duration: 300 });
      this.time.delayedCall(2000, () => {
        if (inv.isDead || !inv.active) return;
        inv.isInShadowRealm = false;
        inv.isDamageImmune = false;
        this.tweens.add({ targets: inv, alpha: 1, duration: 300 });
      });
    };
    inv.shadowRealmTimer = this.time.addEvent({
      delay: 8000, callback: phaseIn, loop: true,
    });
  }

  // ─── Ch6: Eternal Emperor (EMPEROR_PHASE boss) ──────────────────────────

  private setupEternalEmperor(inv: Invader): void {
    this.buildBossHpBar(inv.maxHp);

    // Phase 1: Mirror shield active
    inv.hasMirrorShield = true;
    inv.mirrorHitsRemaining = 3;
    inv.mirrorGfx = this.add.graphics().setDepth(inv.depth + 1);

    const checkPhase = () => {
      if (inv.isDead || !inv.active) return;
      const pct = inv.hp / inv.maxHp;
      this.updateBossHpBar();

      // Phase 2: 70% HP — summon titan_sentinel adds
      if (pct <= 0.7 && inv.ch6BossPhase < 2) {
        inv.ch6BossPhase = 2;
        for (let i = 0; i < 2; i++) {
          this.time.delayedCall(i * 500, () => this.spawnInvader('titan_sentinel'));
        }
      }

      // Phase 3: 40% HP — activate shadow realm cycle
      if (pct <= 0.4 && inv.ch6BossPhase < 3) {
        inv.ch6BossPhase = 3;
        this.setupShadowRealm(inv);
      }

      // Phase 4: 15% HP — enrage (double speed + periodic immunity)
      if (pct <= 0.15 && inv.ch6BossPhase < 4) {
        inv.ch6BossPhase = 4;
        // Double speed
        if (inv.pathTween) {
          const remaining = inv.pathTween.duration - inv.pathTween.elapsed;
          inv.pathTween.duration = inv.pathTween.elapsed + remaining * 0.5;
        }
        // Periodic 1s immunity every 5s
        this.time.addEvent({
          delay: 5000,
          callback: () => {
            if (inv.isDead || !inv.active) return;
            inv.isDamageImmune = true;
            this.time.delayedCall(1000, () => {
              if (!inv.isDead) inv.isDamageImmune = false;
            });
          },
          loop: true,
        });
      }

      this.time.delayedCall(400, checkPhase);
    };
    this.time.delayedCall(1000, checkPhase);
  }
}
