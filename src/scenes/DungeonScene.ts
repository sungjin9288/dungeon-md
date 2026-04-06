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
import { ROOM_DEFS, getUpgradeCost, getScrollAuraBonus, MAX_ROOM_LEVEL, type RoomData, type RoomType } from '../data/rooms';
import { MONSTER_DEFS, getMonstersForRoom, resolveMonsterDef, type MonsterId } from '../data/monsters';
import { INVADER_DEFS } from '../data/invaders';
import type { InvaderType, InvaderDef } from '../data/invaders';
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, type WaveSpec } from '../data/stages';
import { loadGameState, saveGameState, getWisdomBonuses, getPrestigeDmgMult, getUnlockedSlots, ROOM_SLOT_TYPE_DEFS, type WisdomBonuses } from '../data/wisdom';
import { checkAchievements, ACHIEVEMENT_DEFS, type AchievementContext } from '../data/achievements';
import { addXp, ACTIVE_SKILLS, getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { rollMaterialDrop, MATERIAL_DEFS, HYBRID_DEFS } from '../data/fusion';
import { buildEndlessSpawnQueue } from '../data/endlessWave';
import { tickDailyChallenge, type DailyDungeon, type WeeklyBoss } from '../data/daily';
import { updateQuestObjective, tickSubQuestProgress, completeAndAdvance } from '../data/quests';
import { STAGE_CONFIGS } from './StageSelectScene';
import { applyChapterTheme } from './ChapterTheme';
import { SkillHUD } from '../combat/SkillHUD';
import { MonsterSwapManager } from '../combat/MonsterSwap';
import { SynergyManager } from '../combat/SynergyManager';
import {
  type BossContext,
  scheduleNinjaInvisibilityCycle as _scheduleNinjaInvisibilityCycle,
  setupFoxQueenPhase as _setupFoxQueenPhase,
  setupUndyingKnight as _setupUndyingKnight,
  setupDecoyClone as _setupDecoyClone,
  scheduleVoidTeleport as _scheduleVoidTeleport,
  setupDragonKingPhase as _setupDragonKingPhase,
  setupVoidStealthElite as _setupVoidStealthElite,
  setupDeathEmissary as _setupDeathEmissary,
  setupThreeGodDestroyer as _setupThreeGodDestroyer,
  setupShadowRealm as _setupShadowRealm,
  setupGodEmperor as _setupGodEmperor,
  setupEternalEmperor as _setupEternalEmperor,
} from '../combat/BossBehaviors';
import {
  type RoomMechanicsContext,
  runTigersPounce as _runTigersPounce,
  runMercenaryAuras as _runMercenaryAuras,
  runGoldVeins as _runGoldVeins,
  runHealers as _runHealers,
  runSoulHarvest as _runSoulHarvest,
  runMedicineHallHeal as _runMedicineHallHeal,
  runPoisonTrailDamage as _runPoisonTrailDamage,
  runEntrancingVeil as _runEntrancingVeil,
  runSpiritAltar as _runSpiritAltar,
  spawnGhostWarrior as _spawnGhostWarrior,
  runLunarRhythm as _runLunarRhythm,
  runExtraMonsterAttacks as _runExtraMonsterAttacks,
  updateArmoryBonuses as _updateArmoryBonuses,
  runTrapEffects as _runTrapEffects,
  triggerScrollBurst as _triggerScrollBurst,
  triggerChainLightning as _triggerChainLightning,
  triggerSpectralBolt as _triggerSpectralBolt,
  triggerWhirlwind as _triggerWhirlwind,
  recalcRoomTypeBonuses as _recalcRoomTypeBonuses,
} from '../combat/RoomMechanics';
import {
  showAttackLine as _showAttackLine,
  showFirstStrikeEffect as _showFirstStrikeEffect,
  showTrapRing as _showTrapRing,
  showHolyBurst as _showHolyBurst,
  spawnCharmOrb as _spawnCharmOrb,
  showTideWave as _showTideWave,
  showMagicImmuneMiss as _showMagicImmuneMiss,
  showGoldFloat as _showGoldFloat,
  showHealEffect as _showHealEffect,
  showFloatText as _showFloatText,
  showHolyPaladinAura as _showHolyPaladinAura,
  showSoulHarvestExec as _showSoulHarvestExec,
  showBossWarning as _showBossWarning,
  showWisdomToast as _showWisdomToast,
  showXpToast as _showXpToast,
  triggerDragonRoar as _triggerDragonRoar,
  showTigersPounce as _showTigersPounce,
  showRallyCryEffect as _showRallyCryEffect,
} from '../combat/VisualEffects';
import {
  type ResultFlowContext,
  showWaveClear as _showWaveClear,
  triggerWaveFail as _triggerWaveFail,
  showChapterClear as _showChapterClear,
  showRepairOption as _showRepairOption,
} from '../combat/ResultFlow';
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
  private prestigeDmgMult = 1;   // +10% per prestige level
  private baseSlots       = 12;  // overridden in create() from stage config

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
    this.prestigeDmgMult  = getPrestigeDmgMult(gameState);
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
      const allStages = [...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7];
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
    this.maxHp            = stageDungeonHp + this.wisdomBonuses.dungeonMaxHpBonus + this.wisdomBonuses.fortressHp;
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
      const ownedHybridForRoom = Object.values(HYBRID_DEFS)
        .filter(h => h.roomTypes.includes(room.roomData!.type as string) && loadGameState().ownedMonsters.some(m => m.id === h.id));
      const hasMonstersAvailable = getMonstersForRoom(room.roomData.type, this.unlockedStage).length > 0
        || ownedHybridForRoom.length > 0;
      if (hasMonstersAvailable && !room.roomData.monsterSlot) {
        // No monster assigned yet — open monster panel first
        this.monsterPanel.open(room.row, room.col, room.roomData.type, this.unlockedStage, this.dailyMode?.elementRestrict);
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

    // Open monster panel if this room type supports monsters (including owned hybrids)
    const available = getMonstersForRoom(type, this.unlockedStage);
    const ownedHybrid = Object.values(HYBRID_DEFS)
      .some(h => h.roomTypes.includes(type as string) && loadGameState().ownedMonsters.some(m => m.id === h.id));
    if (available.length > 0 || ownedHybrid) {
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
    const mDef  = MONSTER_DEFS[id];
    const hbDef = mDef ? null : HYBRID_DEFS[id];
    if (!mDef && !hbDef) return;
    const emoji = mDef?.emoji ?? hbDef!.emoji;
    // Update effective cooldown to monster's cooldown (hybrids use room default)
    if (mDef?.attackCooldown && mDef.attackCooldown > 0) data.attackCooldown = mDef.attackCooldown;
    // Equipment: roomHpBonus
    const eqS = this.equipmentMap.get(id);
    if (eqS?.roomHpBonus) this.rooms[row][col].addBonusHp(eqS.roomHpBonus);
    this.rooms[row][col].setMonsterSprite(id, emoji);
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

    // STEAM_BURST (fire+frost combo): every 10s, 25 dmg AoE to all active invaders
    if (this.synergyManager.hasSpecial('STEAM_BURST')) {
      this.time.addEvent({
        delay: 10000, repeat: 8,
        callback: () => {
          if (!this.waveActive) return;
          this.activeInvaders.forEach(i => { if (i.active) i.takeDamage(25); });
          const g = this.add.graphics().setDepth(55);
          g.fillStyle(0x88ddff, 0.2);
          g.fillRect(0, GRID_Y, CANVAS_WIDTH, GRID_ROWS * this.effectiveCellSize);
          this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
        },
      });
    }

    // MOONLIGHT_MASS_HEAL (6 moonlight): heal 5% maxHp every 8s during this wave
    if (this.synergyManager.hasSpecial('MOONLIGHT_MASS_HEAL')) {
      this.time.addEvent({
        delay: 8000, repeat: 4,
        callback: () => {
          if (this.dungeonHp <= 0) return;
          const heal = Math.ceil(this.maxHp * 0.05);
          this.dungeonHp = Math.min(this.maxHp, this.dungeonHp + heal);
          this.registry.set('hp', this.dungeonHp);
          this.showFloatText(CANVAS_WIDTH / 2, 80, `🌙 +${heal}`, '#44ffaa');
        },
      });
    }

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
    // CELESTIAL_DESCENT (6 celestial): all spawned invaders start slowed 25%
    if (this.synergyManager.hasSpecial('CELESTIAL_DESCENT')) inv.applySlow(0.75, 3000);
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
      // ── Chapter 7 behaviors ──────────────────────────────────────────────
      case 'GOD_EMPEROR_PHASE':
        this.setupGodEmperor(inv);
        break;
    }
  }

  private triggerScrollBurst(libraryData: RoomData): void {
    _triggerScrollBurst(this.makeRoomMechanicsCtx(), libraryData);
  }

  // ─── Dungeon slot trap effects ────────────────────────────────────────────

  private runTrapEffects(now: number): void {
    _runTrapEffects(this.makeRoomMechanicsCtx(), now);
  }

  // ─── Combat (update loop) ─────────────────────────────────────────────────

  private runCombat(now: number): void {
    const cs = this.effectiveCellSize;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || !data.attackCooldown) continue;
        if (now - data.lastAttackTime < data.attackCooldown) continue;

        const mDef        = resolveMonsterDef(data.monsterSlot ?? undefined);
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
          let dmg = baseDmg * Math.pow(1.4, data.level - 1) * data.roomTypeDmgMult * this.waveAtkMult * this.wisdomBonuses.monsterAtkMult * this.prestigeDmgMult;

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
          if (mDef?.tribe && this.hasTribeMasteryFor(mDef.tribe as import('../data/monsters').TribeId)) dmg *= 1.15;

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

          // ── celestial_shrine: holy slow + bypasses DIVINE_WARD ──────────
          if (data.type === 'celestial_shrine') {
            // Holy light slows target 30% for 1.5s
            target.applySlow(0.7, 1500);
            // Lv2+: holy damage bypasses DIVINE_WARD (magic immune) — force dmg
            if (data.level >= 2 && target.isMagicImmune) dmg = Math.max(dmg, 10);
            // Lv3: bonus radiant burst (50% extra)
            if (data.level >= 3) dmg *= 1.5;
            this.showHolyBurst(this.rooms[row][col].x, cellCenterY);
          }

          // ── void_forge: 3-row penetrating AoE ────────────────────────────
          if (data.type === 'void_forge') {
            // Hits all invaders in this row AND adjacent rows
            const voidRows = [row - 1, row, row + 1].filter(r => r >= 0 && r < GRID_ROWS);
            for (const vr of voidRows) {
              for (const inv of this.activeInvaders) {
                if (!inv.active || inv === target) continue;
                const invRow = this.getInvaderRow(inv);
                if (invRow === vr) {
                  inv.takeDamage(Math.round(dmg * 0.6));
                }
              }
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

          // ── DIVINE_WARD: magic attacks miss — CELESTIAL_PIERCE bypasses ──
          const celestialPierce = this.synergyManager.hasSpecial('CELESTIAL_PIERCE') && mDef?.tribe === 'celestial';
          if (target.isMagicImmune && (mDef?.type === 'magic') && !celestialPierce) dmg = 0;
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

          // ── GOLD_KILL: +10g on every kill ────────────────────────────────
          if (mDef?.passive === 'GOLD_KILL' && target.hp <= 0) {
            this.gold += 10;
            this.registry.set('gold', this.gold);
            this.showGoldFloat('+10', target.x, target.y - 18);
          }

          // ── QUAKE_STUN: every 5th hit stuns all invaders 1.5s ────────────
          if (mDef?.passive === 'QUAKE_STUN') {
            data.whirlwindHitCount = (data.whirlwindHitCount ?? 0) + 1;
            if (data.whirlwindHitCount % 5 === 0) {
              this.activeInvaders.forEach(i => {
                if (i.active && !i.isUnstoppable) i.applyStun(1500);
              });
              const g = this.add.graphics().setDepth(55);
              g.fillStyle(0x886600, 0.3);
              g.fillRect(0, GRID_Y, CANVAS_WIDTH, GRID_ROWS * this.effectiveCellSize);
              this.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
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
    _runExtraMonsterAttacks(this.makeRoomMechanicsCtx(), now);
  }

  private makeBossCtx(): BossContext {
    // Returns a mutable context object. Boss HP bar fields are written through
    // closures so mutations propagate back to the scene automatically.
    const self = this;
    return {
      scene: this,
      activeInvaders: this.activeInvaders,
      rooms: this.rooms,
      roomGrid: this.roomGrid,
      get effectiveCols() { return self.effectiveCols; },
      get effectiveCellSize() { return self.effectiveCellSize; },
      invaderPath: this.invaderPath,
      get bossMaxHp() { return self.bossMaxHp; },
      set bossMaxHp(v) { self.bossMaxHp = v; },
      get bossHpBarBg() { return self.bossHpBarBg; },
      set bossHpBarBg(v) { self.bossHpBarBg = v; },
      get bossHpBarFill() { return self.bossHpBarFill; },
      set bossHpBarFill(v) { self.bossHpBarFill = v; },
      get bossHpLabel() { return self.bossHpLabel; },
      set bossHpLabel(v) { self.bossHpLabel = v; },
      showFloatText: (x, y, text, color) => this.showFloatText(x, y, text, color),
      spawnInvader: (type) => this.spawnInvader(type),
      triggerChainLightning: (source, chainDmg, maxChains) => this.triggerChainLightning(source, chainDmg, maxChains),
    };
  }

  private makeResultFlowCtx(): ResultFlowContext {
    const self = this;
    return {
      scene: this,
      get effectiveCols() { return self.effectiveCols; },
      get effectiveCellSize() { return self.effectiveCellSize; },
      get dungeonHp() { return self.dungeonHp; },
      get maxHp() { return self.maxHp; },
      get gold() { return self.gold; },
      get startGold() { return self.startGold; },
      get gems() { return self.gems; },
      get wave() { return self.wave; },
      get maxWave() { return self.maxWave; },
      get stageChapter() { return self.stageChapter; },
      get isEndless() { return self.isEndless; },
      get waveActive() { return self.waveActive; },
      get killsThisRun() { return self.killsThisRun; },
      get killsThisWave() { return self.killsThisWave; },
      get breakthruCount() { return self.breakthruCount; },
      get goldEarnedThisRun() { return self.goldEarnedThisRun; },
      get materialsEarnedThisRun() { return self.materialsEarnedThisRun; },
      get waveGoldMult() { return self.waveGoldMult; },
      get waveEndChecked() { return self.waveEndChecked; },
      get waveHasSpawned() { return self.waveHasSpawned; },
      get prepActive() { return self.prepActive; },
      get prepTimer() { return self.prepTimer; },
      get returnTo() { return self.returnTo; },
      get dailyMode() { return self.dailyMode; },
      get weeklyBossMode() { return self.weeklyBossMode; },
      get wisdomBonuses() { return self.wisdomBonuses; },
      get waveConfigs() { return self.waveConfigs; },
      get dungeonTrapSlots() { return self.dungeonTrapSlots; },
      get waveStartSlotHps() { return self.waveStartSlotHps; },
      activeInvaders: this.activeInvaders,
      get waveBtnBg() { return self.waveBtnBg; },
      get waveBtnZone() { return self.waveBtnZone; },
      get waveLabel() { return self.waveLabel; },
      get resultOverlay() { return self.resultOverlay; },
      get countdownBar() { return self.countdownBar; },
      rooms: this.rooms,
      roomGrid: this.roomGrid,
      drawBtn: (g, x, y, w, h, hover) => this.drawBtn(g, x, y, w, h, hover),
      startWave: () => this.startWave(),
      grantMonsterXp: (amount) => this.grantMonsterXp(amount),
      saveRoomHpsToGameState: () => this.saveRoomHpsToGameState(),
      showFloatText: (x, y, text, color) => this.showFloatText(x, y, text, color),
      showEndlessResult: () => this.showEndlessResult(),
      checkAchievementsAndToast: (gs) => this.checkAchievementsAndToast(gs),
      tickQuestAndNotify: (gs, type) => this.tickQuestAndNotify(gs, type as Parameters<typeof import('../data/quests').updateQuestObjective>[1]),
      setDungeonHp: (hp) => { self.dungeonHp = hp; self.registry.set('hp', hp); },
      setGold: (g) => { self.gold = g; self.registry.set('gold', g); },
      setGems: (g) => { self.gems = g; self.registry.set('gems', g); },
      setWave: (w) => { self.wave = w; self.registry.set('wave', w); },
      setWaveActive: (v) => { self.waveActive = v; },
      setWaveEndChecked: (v) => { self.waveEndChecked = v; },
      setWaveHasSpawned: (v) => { self.waveHasSpawned = v; },
      setPrepActive: (v) => { self.prepActive = v; },
      setPrepTimer: (v) => { self.prepTimer = v; },
      setResultOverlay: (ov) => { self.resultOverlay = ov; },
      setCountdownBar: (bar) => { self.countdownBar = bar; },
    };
  }

  private makeRoomMechanicsCtx(): RoomMechanicsContext {
    const self = this;
    return {
      scene: this,
      roomGrid: this.roomGrid,
      rooms: this.rooms,
      activeInvaders: this.activeInvaders,
      get effectiveCols() { return self.effectiveCols; },
      get effectiveCellSize() { return self.effectiveCellSize; },
      get waveActive() { return self.waveActive; },
      invaderPath: this.invaderPath,
      get stageChapter() { return self.stageChapter; },
      get gold() { return self.gold; },
      set gold(v) { self.gold = v; },
      get dungeonHp() { return self.dungeonHp; },
      set dungeonHp(v) { self.dungeonHp = v; },
      get maxHp() { return self.maxHp; },
      dungeonTrapSlots: this.dungeonTrapSlots,
      slotTrapSynergyMult: this.slotTrapSynergyMult,
      extraMonsterCooldowns: this.extraMonsterCooldowns,
      get tauntBoostActiveUntil() { return self.tauntBoostActiveUntil; },
      pounceReadyMap: this.pounceReadyMap,
      get goldTick() { return self.goldTick; },
      set goldTick(v) { self.goldTick = v; },
      get medicineHealTick() { return self.medicineHealTick; },
      set medicineHealTick(v) { self.medicineHealTick = v; },
      get medicineGlobalPulseLast() { return self.medicineGlobalPulseLast; },
      set medicineGlobalPulseLast(v) { self.medicineGlobalPulseLast = v; },
      get poisonDamageTick() { return self.poisonDamageTick; },
      set poisonDamageTick(v) { self.poisonDamageTick = v; },
      get entrancingVeilApplied() { return self.entrancingVeilApplied; },
      set entrancingVeilApplied(v) { self.entrancingVeilApplied = v; },
      setGoldRegistry: (g) => this.registry.set('gold', g),
      showGoldFloat: (text, x, y) => this.showGoldFloat(text, x, y),
      showTigersPounce: (rx, ry, tx, ty) => this.showTigersPounce(rx, ry, tx, ty),
      showHealEffect: (healer, target, amount) => this.showHealEffect(healer, target, amount),
      showSoulHarvestExec: (x, y) => this.showSoulHarvestExec(x, y),
      showFloatText: (x, y, text, color) => this.showFloatText(x, y, text, color),
      flashRoom: (row, col) => this.rooms[row][col].flashAttack(),
      healRoomHp: (row, col, amount) => this.rooms[row][col].healRoomHp(amount),
      damageRoomHp: (row, col, amount) => this.rooms[row][col].damageRoomHp(amount),
      hasDivineTerritory: () => this.hasDivineTerritory(),
      pushInvader: (inv) => this.activeInvaders.push(inv),
    };
  }

  private scheduleNinjaInvisibilityCycle(inv: Invader): void {
    _scheduleNinjaInvisibilityCycle(this.makeBossCtx(), inv);
  }

  private showHolyPaladinAura(inv: Invader): void {
    _showHolyPaladinAura(this, inv);
  }

  private setupFoxQueenPhase(inv: Invader): void {
    _setupFoxQueenPhase(this.makeBossCtx(), inv);
  }

  private showAttackLine(x1: number, y1: number, x2: number, y2: number): void {
    _showAttackLine(this, x1, y1, x2, y2);
  }

  private showFirstStrikeEffect(x: number, y: number): void {
    _showFirstStrikeEffect(this, x, y);
  }

  private showTigersPounce(rx: number, ry: number, tx: number, ty: number): void {
    _showTigersPounce(this, rx, ry, tx, ty);
  }

  private showRallyCryEffect(x: number, y: number): void {
    _showRallyCryEffect(this, x, y);
  }

  private showTrapRing(x: number, y: number): void {
    _showTrapRing(this, x, y);
  }

  private showHolyBurst(x: number, y: number): void {
    _showHolyBurst(this, x, y);
  }

  private getInvaderRow(inv: Invader): number {
    const cs = this.effectiveCellSize;
    for (let r = 0; r < GRID_ROWS; r++) {
      const rowY = GRID_Y + r * cs + cs / 2;
      if (Math.abs(inv.y - rowY) <= cs * 0.7) return r;
    }
    return -1;
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
    _spawnCharmOrb(this, rx, ry, target);
  }

  private showTideWave(tx: number, ty: number): void {
    _showTideWave(this, tx, ty);
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
    _showMagicImmuneMiss(this, tx, ty);
  }

  // ── Tigers Pounce update loop ──────────────────────────────────────────────
  private pounceReadyMap = new Map<string, { ready: boolean; cooldownUntil: number }>();

  private runTigersPounce(now: number): void {
    _runTigersPounce(this.makeRoomMechanicsCtx(), now);
  }

  // ── Mercenary Captain continuous speed aura ───────────────────────────────

  private runMercenaryAuras(_now: number): void {
    _runMercenaryAuras(this.makeRoomMechanicsCtx(), _now);
  }

  // ─── Gold Vein passive income ─────────────────────────────────────────────

  private goldTick = 0;

  private runGoldVeins(now: number): void {
    _runGoldVeins(this.makeRoomMechanicsCtx(), now);
  }

  private showGoldFloat(text: string, x: number, y: number): void {
    _showGoldFloat(this, text, x, y);
  }

  // ─── Healer loop (soldier = 야전 치유사) ──────────────────────────────────

  private runHealers(now: number): void {
    _runHealers(this.makeRoomMechanicsCtx(), now);
  }

  private showHealEffect(
    healer: Invader, target: Invader, amount: number,
  ): void {
    _showHealEffect(this, healer, target, amount);
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
      case 'supply': {
        const moonHealUp = this.synergyManager.hasSpecial('MOONLIGHT_HEAL_UP') ? 1.20 : 1;
        this.dungeonHp = Math.min(this.maxHp, this.dungeonHp + Math.ceil(this.maxHp * 0.15 * moonHealUp));
        this.registry.set('hp', this.dungeonHp);
        break;
      }
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
    _showWaveClear(this.makeResultFlowCtx());
  }

  // ─── Wave Fail ────────────────────────────────────────────────────────────

  private triggerWaveFail(): void {
    _triggerWaveFail(this.makeResultFlowCtx());
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
    _showWisdomToast(this, this.wisdomBonuses);
  }

  // ─── Boss (Wave 10) ───────────────────────────────────────────────────────

  private showBossWarning(): void {
    _showBossWarning(this, {
      waveConfigs: this.waveConfigs,
      wave: this.wave,
      isEndless: this.isEndless,
      buildBossHpBar: (hp: number) => this.buildBossHpBar(hp),
    });
  }

  private showChapterClear(): void {
    _showChapterClear(this.makeResultFlowCtx());
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

      // DIVINE_PROPHECY: 5% chance on kill → heal 5% dungeonHp
      if (Math.random() < 0.05) {
        const hasProphecy = this.roomGrid.flat().some(
          d => d?.monsterSlot && HYBRID_DEFS[d.monsterSlot]?.passive === 'DIVINE_PROPHECY'
        );
        if (hasProphecy) {
          const heal = Math.ceil(this.maxHp * 0.05);
          this.dungeonHp = Math.min(this.maxHp, this.dungeonHp + heal);
          this.registry.set('hp', this.dungeonHp);
          this.showFloatText(CANVAS_WIDTH / 2, 80, `👁️ +${heal} 신탁의 가호`, '#ffd700');
        }
      }

      // CHAIN_CURSE: on kill, chain 30 dmg to 3 nearest invaders
      if (this.synergyManager.hasSpecial('CHAIN_CURSE')) {
        const nearby = this.activeInvaders
          .filter(o => o.active && o !== inv)
          .sort((a, b) => Math.hypot(a.x - inv.x, a.y - inv.y) - Math.hypot(b.x - inv.x, b.y - inv.y))
          .slice(0, 3);
        nearby.forEach((o, i) => {
          this.time.delayedCall(i * 80, () => {
            if (!o.active) return;
            o.takeDamage(30);
            const g = this.add.graphics().setDepth(55);
            g.lineStyle(2, 0x4422ff, 0.9);
            g.lineBetween(inv.x, inv.y, o.x, o.y);
            this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
          });
        });
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
      const balanceDefMult = this.synergyManager.hasSpecial('BALANCE_DEF') ? 0.85 : 1;
      const actualDamage = Math.round(inv.def.damage * this.wisdomBonuses.monsterDmgMult * balanceDefMult);
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
    _updateArmoryBonuses(this.makeRoomMechanicsCtx());
  }

  // ─── Chapter 3: SOUL_HARVEST ───────────────────────────────────────────────

  private runSoulHarvest(now: number): void {
    _runSoulHarvest(this.makeRoomMechanicsCtx(), now);
  }

  private showSoulHarvestExec(x: number, y: number): void {
    _showSoulHarvestExec(this, x, y);
  }

  // ─── Chapter 3: CHAIN_LIGHTNING ────────────────────────────────────────────

  private triggerChainLightning(source: Invader, chainDmg: number, maxChains: number): void {
    _triggerChainLightning(this.makeRoomMechanicsCtx(), source, chainDmg, maxChains);
  }

  // ─── Chapter 3: SPECTRAL_BOLT ──────────────────────────────────────────────

  private triggerSpectralBolt(fromX: number, _fromY: number, row: number, dmg: number): void {
    _triggerSpectralBolt(this.makeRoomMechanicsCtx(), fromX, _fromY, row, dmg);
  }

  // ─── Chapter 3: WHIRLWIND_DANCE ────────────────────────────────────────────

  private triggerWhirlwind(row: number, dmg: number, rx: number, ry: number): void {
    _triggerWhirlwind(this.makeRoomMechanicsCtx(), row, dmg, rx, ry);
  }

  // ─── Chapter 3: Medicine Hall healing ─────────────────────────────────────

  private medicineHealTick = 0;
  private medicineGlobalPulseLast = 0;

  private runMedicineHallHeal(now: number): void {
    _runMedicineHallHeal(this.makeRoomMechanicsCtx(), now);
  }

  // ─── Chapter 3: POISON_TRAIL room damage ───────────────────────────────────

  private poisonDamageTick = 0;

  private runPoisonTrailDamage(now: number): void {
    _runPoisonTrailDamage(this.makeRoomMechanicsCtx(), now);
  }

  // ─── Chapter 3: UNDYING_KNIGHT (revive once if killed by non-magic) ────────

  private setupUndyingKnight(inv: Invader): void {
    _setupUndyingKnight(this.makeBossCtx(), inv);
  }

  // ─── Chapter 3: DECOY_CLONE ────────────────────────────────────────────────

  private setupDecoyClone(inv: Invader): void {
    _setupDecoyClone(this.makeBossCtx(), inv);
  }

  // ─── Chapter 3: VOID_TELEPORT ──────────────────────────────────────────────

  private scheduleVoidTeleport(inv: Invader): void {
    _scheduleVoidTeleport(this.makeBossCtx(), inv);
  }

  // ─── Chapter 3: DRAGON_KING_PHASE boss ─────────────────────────────────────

  private setupDragonKingPhase(inv: Invader): void {
    _setupDragonKingPhase(this.makeBossCtx(), inv);
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
    _runEntrancingVeil(this.makeRoomMechanicsCtx());
  }

  // ─── Ch4: Spirit Altar — summon ghost warrior on kill threshold ────────────

  private runSpiritAltar(_now: number): void {
    _runSpiritAltar(this.makeRoomMechanicsCtx(), _now);
  }

  private spawnGhostWarrior(altarRow: number, _altarCol: number): void {
    _spawnGhostWarrior(this.makeRoomMechanicsCtx(), altarRow, _altarCol);
  }

  // ─── Ch4: LUNAR_RHYTHM — every 30s reset adjacent room cooldowns ───────────

  private runLunarRhythm(now: number): void {
    _runLunarRhythm(this.makeRoomMechanicsCtx(), now);
  }

  // ─── Ch4: Dragon's Roar effect ─────────────────────────────────────────────

  private triggerDragonRoar(x: number, y: number): void {
    _triggerDragonRoar(this, x, y, this.activeInvaders);
  }

  // ─── Ch4: VOID_STEALTH_ELITE behavior ──────────────────────────────────────

  private setupVoidStealthElite(inv: Invader): void {
    _setupVoidStealthElite(this.makeBossCtx(), inv);
  }

  // ─── Ch4: setupDeathEmissary (STUN_IMMUNE boss) ─────────────────────────────

  private setupDeathEmissary(inv: Invader): void {
    _setupDeathEmissary(this.makeBossCtx(), inv);
  }

  // ─── Ch5: setupThreeGodDestroyer (FIVE_PHASE boss) ─────────────────────────

  private setupThreeGodDestroyer(inv: Invader): void {
    _setupThreeGodDestroyer(this.makeBossCtx(), inv);
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
    _showXpToast(this, msg);
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
    _showRepairOption(this.makeResultFlowCtx(), row, col);
  }

  private showFloatText(x: number, y: number, text: string, color: string): void {
    _showFloatText(this, x, y, text, color);
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
    _recalcRoomTypeBonuses(this.makeRoomMechanicsCtx());
  }

  // ─── Ch6: Shadow Realm (phases out periodically) ─────────────────────────

  private setupShadowRealm(inv: Invader): void {
    _setupShadowRealm(this.makeBossCtx(), inv);
  }

  // ─── Ch6: Eternal Emperor (EMPEROR_PHASE boss) ──────────────────────────

  private setupGodEmperor(inv: Invader): void {
    _setupGodEmperor(this.makeBossCtx(), inv);
  }

  private setupEternalEmperor(inv: Invader): void {
    _setupEternalEmperor(this.makeBossCtx(), inv);
  }
}
