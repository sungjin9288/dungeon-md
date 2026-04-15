import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { RoomSelectionPanel }  from '../ui/RoomSelectionPanel';
import { MonsterSelectPanel }  from '../ui/MonsterSelectPanel';
import { RoomUpgradePanel }    from '../ui/RoomUpgradePanel';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  CANVAS_HEIGHT,
  GRID_COLS, GRID_ROWS, CELL_SIZE, GRID_Y,
} from '../constants/layout';
import { type RoomData, type RoomType } from '../data/rooms';
import { resolveMonsterDef, type MonsterId } from '../data/monsters';
import type { InvaderType, InvaderDef } from '../data/invaders';
import { type WaveSpec } from '../data/stages';
import { loadGameState, saveGameState, getWisdomBonuses, getPrestigeDmgMult, type WisdomBonuses } from '../data/wisdom';
import { type EquipmentStats } from '../data/barracks';
import { tickDailyChallenge, type DailyDungeon, type WeeklyBoss } from '../data/daily';
import { updateQuestObjective } from '../data/quests';
import { STAGE_CONFIGS } from '../data/stageProgress';
import { applyChapterTheme } from './ChapterTheme';
import { resolveStageSetup, buildEquipmentMap } from '../combat/DungeonSceneInit';
import { SkillHUD } from '../combat/SkillHUD';
import { MonsterSwapManager } from '../combat/MonsterSwap';
import { SynergyManager } from '../combat/SynergyManager';
import type { BossContext } from '../combat/BossBehaviors';
import { applyInvaderBehavior } from '../combat/InvaderBehaviors';
import {
  type SpawnPipelineContext,
  processSpawnQueue  as _processSpawnQueue,
  spawnInvaderByType as _spawnInvaderByType,
} from '../combat/SpawnPipeline';
import { showSkillPopup as _showSkillPopup } from '../combat/SkillPopup';
import { handleInvaderKilled as _handleInvaderKilled, type KillHandlerContext } from '../combat/KillHandler';
import {
  spawnCoinFlyEffect as _spawnCoinFlyEffect,
  spawnBuildParticles as _spawnBuildParticles,
  showRangePreview as _showRangePreview,
  hideRangePreview as _hideRangePreview,
} from '../combat/RoomVfx';
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
} from '../combat/RoomMechanics';
import {
  updateArmoryBonuses as _updateArmoryBonuses,
  runTrapEffects as _runTrapEffects,
  triggerScrollBurst as _triggerScrollBurst,
  triggerChainLightning as _triggerChainLightning,
  triggerSpectralBolt as _triggerSpectralBolt,
  triggerWhirlwind as _triggerWhirlwind,
  recalcRoomTypeBonuses as _recalcRoomTypeBonuses,
} from '../combat/RoomTriggers';
import {
  showGoldFloat as _showGoldFloat,
  showHealEffect as _showHealEffect,
  showFloatText as _showFloatText,
  showSoulHarvestExec as _showSoulHarvestExec,
  showWisdomToast as _showWisdomToast,
} from '../combat/VisualEffects';
import {
  showBossWarning as _showBossWarning,
  showTigersPounce as _showTigersPounce,
  updateLowHpVignette as _updateLowHpVignette,
} from '../combat/ImpactVfx';
import {
  type ResultFlowContext,
  showWaveClear as _showWaveClear,
  triggerWaveFail as _triggerWaveFail,
} from '../combat/ResultFlow';
import { showRepairOption as _showRepairOption, type RepairUIContext } from '../combat/RoomInput';
import { showChapterClear as _showChapterClear } from '../combat/StageClearFlow';
import {
  type WaveEventContext,
  tryShowWaveEvent as _tryShowWaveEvent,
} from '../combat/WaveEvents';
import {
  type QuestTrackerContext,
  checkAchievementsAndToast as _checkAchievementsAndToast,
  tickQuestAndNotify as _tickQuestAndNotify,
  trackConsecutiveDays as _trackConsecutiveDays,
  grantMonsterXp as _grantMonsterXp,
} from '../combat/QuestTracker';
import {
  applyRoomSlotDamage as _applyRoomSlotDamage,
  saveRoomHpsToGameState as _saveRoomHpsToGameState,
} from '../combat/RoomDurability';
import {
  drawDungeonBackground,
  buildInvaderPath,
  buildDungeonGrid,
  placeDungeonTorches,
  addDustMoteParticles,
  addDungeonFog,
  buildWaveStartButton,
  paintWaveButton,
} from '../combat/DungeonLayout';
import { activateSkillEffect, type ActiveSkillContext } from '../combat/ActiveSkills';
import { BossHud } from '../combat/BossHud';
import { startWave as _startWave, type WaveStartContext } from '../combat/WaveStart';
import {
  showWaveEnemyPreview      as _showWaveEnemyPreview,
  showEndlessMilestoneToast as _showEndlessMilestoneToast,
  showEndlessResult         as _showEndlessResult,
  checkWaveEnd              as _checkWaveEnd,
  type CheckWaveEndContext,
} from '../combat/WaveLifecycle';
import {
  placeRoom    as _placeRoom,
  assignMonster as _assignMonster,
  upgradeRoom  as _upgradeRoom,
  type RoomActionsContext,
} from '../combat/RoomActions';
import { onRoomClick as _onRoomClick, type RoomInputContext } from '../combat/RoomInput';
import {
  initSkillHUD    as _initSkillHUD,
  initSwapManager as _initSwapManager,
  type GameplayInitContext,
} from '../combat/GameplayInit';
import {
  type BattleEventContext,
  handleInvaderReachedEnd  as _handleInvaderReachedEnd,
  handleMirrorReflect      as _handleMirrorReflect,
  handleInvaderKilledRow   as _handleInvaderKilledRow,
  handlePermafrostShatter  as _handlePermafrostShatter,
  applyWarHexToHighestHP   as _applyWarHexToHighestHP,
  triggerTauntingRoar      as _triggerTauntingRoar,
} from '../combat/BattleEventHandlers';
import { hasDivineTerritory } from '../combat/GridQueries';
import {
  type CombatResolverContext,
  findTarget as _findTarget,
  resolveAttack as _resolveAttack,
} from '../combat/CombatResolver';
import { logger } from '../utils/logger';

export class DungeonScene extends Phaser.Scene {
  // ── Dynamic grid dimensions (overridden per chapter) ───────────────────────
  private effectiveCols     = GRID_COLS;   // 3 for Ch1, 4 for Ch2
  private effectiveCellSize = CELL_SIZE;   // 110 for Ch1, 82 for Ch2
  private stageChapter      = 1;
  private stageNumber       = 0;           // 0 = inline invasion (no stage number)
  private waterCells        = new Set<number>();   // flat indices (row*cols+col) of water cells

  // ── Wave configs (loaded per stage) ───────────────────────────────────────
  private waveConfigs: WaveSpec[] = [];

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

  // Boss HP bar — owned by combat/BossHud (created lazily on first boss spawn)
  private bossHud?:       BossHud;
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

  // ── Range preview overlay ─────────────────────────────────────────────────
  private rangePreviewGfx?: Phaser.GameObjects.Graphics;

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

  // ── Battle speed ─────────────────────────────────────────────────────────
  private speedMult: 1 | 2 = 1;

  // ── Low-HP vignette ──────────────────────────────────────────────────────
  private lowHpVignette?: Phaser.GameObjects.Graphics;

  // ── Wave kill counter ─────────────────────────────────────────────────────
  private killCounterText?: Phaser.GameObjects.Text;
  private waveInvaderTotal = 0;

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
    this.equipmentMap = buildEquipmentMap(gameState);

    // Resolve stage config, wave list, daily/weekly overrides
    const setup           = resolveStageSetup(this.registry, gameState);
    this.baseSlots        = setup.baseSlots;
    this.isEndless        = setup.isEndless;
    if (setup.isEndless) {
      this.maxWave = 9999;
      this.endlessHighScore = setup.endlessHighScore;
      this.registry.set('endlessHighScore', this.endlessHighScore);
    }
    this.dailyMode      = setup.dailyMode;
    this.weeklyBossMode = setup.weeklyBossMode;

    this.waveConfigs    = setup.waveConfigs;
    this.maxWave        = this.isEndless ? 9999 : setup.waveConfigs.length;
    this.stageChapter   = setup.stageChapter;
    this.stageNumber    = setup.stageNumber;
    this.effectiveCols  = setup.effectiveCols;
    this.effectiveCellSize = this.effectiveCols === GRID_COLS
      ? CELL_SIZE
      : Math.floor((GRID_COLS * CELL_SIZE) / this.effectiveCols);  // keep same total width
    this.waterCells = setup.waterCells;

    // Apply starting gold bonus (use stage startGold if higher)
    this.gold             = Math.max(setup.stageStartGold, 300) + this.wisdomBonuses.startingGold;
    this.startGold        = this.gold;

    // Apply dungeon HP bonus
    this.maxHp            = setup.stageDungeonHp + this.wisdomBonuses.dungeonMaxHpBonus + this.wisdomBonuses.fortressHp;
    this.dungeonHp        = this.maxHp;

    // Load unlockedStage from STAGE_CONFIGS so the monster picker shows correct options
    this.unlockedStage = STAGE_CONFIGS.find(s => s.stageNumber === setup.stageNumber)?.unlockedStage ?? setup.stageNumber;

    logger.debug(`[WISDOM] startingGold: ${this.gold}, maxHp: ${this.maxHp}, slots: ${this.baseSlots + this.wisdomBonuses.extraSlots}`);

    this.returnTo = this.registry.get('returnTo') as string | undefined;
    this.registry.set('gold',  this.gold);
    this.registry.set('gems',  this.gems);
    this.registry.set('hp',    this.dungeonHp);
    this.registry.set('wave',  this.wave);
    this.registry.set('status','');

    // Ch7 (stages 63-72) always use Celestial Realm theme
    const effectiveTheme = setup.stageNumber >= 63 ? 'celestial_realm' : gameState.equippedTheme;
    this.theme = getActiveTheme(effectiveTheme);
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
    this.bossHud?.destroy();
    this.bossHud = undefined;
    this.resultOverlay?.destroy();
    this.resultOverlay = undefined;
    this.lowHpVignette?.destroy();
    this.lowHpVignette = undefined;
    this.killCounterText?.destroy();
    this.killCounterText = undefined;

    // Clear cached data
    this.equipmentMap.clear();
  }

  // ── FPS monitor (dev mode) ─────────────────────────────────────────────────
  private fpsText?: Phaser.GameObjects.Text;

  update(_time: number, _delta: number): void {
    if (!this.waveActive) return;
    const rmCtx = this.makeRoomMechanicsCtx();
    this.runCombat(_time, rmCtx);
    _runTrapEffects(rmCtx, _time);
    _runHealers(rmCtx, _time);
    _runGoldVeins(rmCtx, _time);
    this.updateBossHpBar();
    this.checkWaveEnd();
    _runMercenaryAuras(rmCtx, _time);
    _runTigersPounce(rmCtx, _time);
    if (this.stageChapter >= 3) {
      _runSoulHarvest(rmCtx, _time);
      _runMedicineHallHeal(rmCtx, _time);
      _runPoisonTrailDamage(rmCtx, _time);
    }
    if (this.stageChapter >= 4) {
      _runSpiritAltar(rmCtx, _time);
      _runLunarRhythm(rmCtx, _time);
      _runEntrancingVeil(rmCtx);
    }

    // Update skill HUD cooldown arcs
    this.skillHUD?.update();

    // Update room attack cooldown rings
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < this.effectiveCols; c++)
        this.rooms[r]?.[c]?.updateAttackCooldown(_time);

    // FPS display — only in development
    if (import.meta.env.DEV && this.fpsText) {
      const fps = Math.round(this.game.loop.actualFps);
      const color = fps >= 55 ? '#00ff88' : fps >= 45 ? '#ffcc00' : '#ff4444';
      this.fpsText.setText(`FPS: ${fps}`).setColor(color);
    }
  }

  // ─── Background / Path / Grid / Atmosphere ───────────────────────────────
  // Implementations live in combat/DungeonLayout.ts — these wrappers keep the
  // original private call sites (`this.drawBackground()` etc.) intact.

  private drawBackground(): void {
    drawDungeonBackground(this, this.theme, this.effectiveCols, this.effectiveCellSize);
  }

  private buildPath(): void {
    this.invaderPath = buildInvaderPath(this);
  }

  private buildGrid(): void {
    const gc = this.effectiveCols;
    const availableSlots = Math.min(
      GRID_ROWS * gc,
      this.baseSlots + this.wisdomBonuses.extraSlots,
    );
    this.rooms = buildDungeonGrid(this, {
      effectiveCols:     gc,
      effectiveCellSize: this.effectiveCellSize,
      availableSlots,
      waterCells:        this.waterCells,
      dungeonTrapSlots:  this.dungeonTrapSlots,
      onRoomClick:       (r) => this.onRoomClick(r),
    });
  }

  private placeTorches(): void {
    placeDungeonTorches(this);
  }

  private addDustMotes(): void {
    addDustMoteParticles(this, this.effectiveCellSize);
  }

  private addFog(): void {
    addDungeonFog(this);
  }

  // ─── Wave Button ──────────────────────────────────────────────────────────

  private buildWaveButton(): void {
    const refs = buildWaveStartButton(this, this.effectiveCellSize, {
      isLocked: () => this.waveActive || this.prepActive,
      onPress:  () => this.tryShowWaveEvent(),
    });
    this.waveBtnBg   = refs.bg;
    this.waveLabel   = refs.label;
    this.waveBtnZone = refs.zone;
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
      () => { this.hideRangePreview(); },
    );
  }

  // ─── Room Interaction ─────────────────────────────────────────────────────

  private onRoomClick(room: Room): void {
    _onRoomClick(this.makeRoomInputCtx(), room);
  }

  private makeRoomInputCtx(): RoomInputContext {
    const self = this;
    return {
      waveActive:           this.waveActive,
      equipmentMap:         this.equipmentMap,
      skillCooldowns:       this.skillCooldowns,
      speedMult:            this.speedMult,
      unlockedStage:        this.unlockedStage,
      nowMs:                this.time.now,
      dailyElementRestrict: this.dailyMode?.elementRestrict,
      get targetingSkillId()    { return self.targetingSkillId; },
      set targetingSkillId(v)   { self.targetingSkillId = v; },
      get skillPopup()          { return self.skillPopup; },
      set skillPopup(v)         { self.skillPopup = v; },
      get selectedRoom()        { return self.selectedRoom; },
      set selectedRoom(v)       { self.selectedRoom = v; },
      isInSwapMode:       ()          => this.swapManager?.isInSwapMode() ?? false,
      routeSwapTap:       (r, c)      => this.swapManager?.onRoomTap(r, c),
      startSwapPress:     (r, c)      => this.swapManager?.onRoomPointerDown(r, c),
      activateSkill:      (id, room)  => this.activateSkill(id, room),
      showSkillCooldown:  (id, ms)    => this.skillHUD?.startCooldown(id, ms),
      clearSkillSelection:()          => this.skillHUD?.clearSelection(),
      showRepairOption:   (r, c)      => _showRepairOption(this._makeRepairCtx(), r, c),
      showSkillPopup:     (r)         => this.showSkillPopup(r),
      closeRoomPanel:     ()          => this.panel.close(),
      openRoomPanel:      (r, c, g)   => this.panel.open(r, c, g),
      openMonsterPanel:   (r, c, t, s, x) => this.monsterPanel.open(r, c, t, s, x ?? undefined),
      openUpgradePanel:   (r, c, d, h) => this.upgradePanel.open(r, c, d, h),
      showRangePreview:   (r, c, rng) => this.showRangePreview(r, c, rng),
      getSynergyHints:    ()          => this.synergyManager.activeSynergies.map(s => ({ name: s.tier.name, desc: s.tier.desc })),
      getGold:            ()          => this.gold,
    };
  }

  private _makeRepairCtx(): RepairUIContext {
    const self = this;
    return {
      scene:    this,
      roomGrid: this.roomGrid,
      rooms:    this.rooms,
      get gold() { return self.gold; },
      showFloatText: (x, y, t, c) => _showFloatText(this, x, y, t, c),
      setGold: (v) => { self.gold = v; this.registry.set('gold', v); },
    };
  }

  // ─── Active Skill Popup ───────────────────────────────────────────────────

  private showSkillPopup(room: Room): void {
    _showSkillPopup({
      scene:          this,
      room,
      skillCooldowns: this.skillCooldowns,
      equipmentMap:   this.equipmentMap,
      speedMult:      this.speedMult,
      getSkillPopup:  () => this.skillPopup,
      setSkillPopup:  (v) => { this.skillPopup = v; },
      activateSkill:  (id, r) => this.activateSkill(id, r),
    });
  }

  private activateSkill(skillId: string, room: Room): void {
    audioManager.playSfx('skill_activate');
    // Track skill_use daily challenge
    const gs_skill = loadGameState();
    tickDailyChallenge(gs_skill, 'skill_use');
    saveGameState(gs_skill);

    activateSkillEffect(skillId, this.makeActiveSkillContext(room));
  }

  private makeActiveSkillContext(room: Room): ActiveSkillContext {
    return {
      scene:             this,
      room,
      activeInvaders:    this.activeInvaders.filter(i => i.active && !i.isDead),
      effectiveCellSize: this.effectiveCellSize,
      roomGrid:          this.roomGrid,
      rooms:             this.rooms,
      now:               this.time.now,
      addGold: (amount) => {
        this.gold += amount;
        this.registry.set('gold', this.gold);
      },
      showGoldFloat:     (text, x, y) => _showGoldFloat(this, text, x, y),
      spawnGhostWarrior: (r, c)       => _spawnGhostWarrior(this.makeRoomMechanicsCtx(), r, c),
    };
  }

  private placeRoom(row: number, col: number, type: RoomType): void {
    _placeRoom(this.makeRoomActionsCtx(), row, col, type);
  }

  private assignMonster(row: number, col: number, id: MonsterId): void {
    _assignMonster(this.makeRoomActionsCtx(), row, col, id);
  }

  private makeRoomActionsCtx(): RoomActionsContext {
    const self = this;
    return {
      scene:             this,
      rooms:             this.rooms,
      roomGrid:          this.roomGrid,
      stageChapter:      this.stageChapter,
      effectiveCols:     this.effectiveCols,
      unlockedStage:     this.unlockedStage,
      dungeonTrapSlots:  this.dungeonTrapSlots,
      equipmentMap:      this.equipmentMap,
      wisdomBonuses:     this.wisdomBonuses,
      get gold()         { return self.gold; },
      set gold(v)        { self.gold = v; },
      setGoldRegistry:          (v)          => this.registry.set('gold', v),
      setGoldWarn:              ()           => this.registry.set('goldWarn', true),
      setSelectedRoom:          (r)          => { this.selectedRoom = r; },
      spawnBuildParticles:      (x, y)       => this.spawnBuildParticles(x, y),
      recalcRoomTypeBonuses:    ()           => _recalcRoomTypeBonuses(this.makeRoomMechanicsCtx()),
      recalcSynergies:          ()           => this.synergyManager.recalc(this.roomGrid, this.effectiveCols),
      tickQuestAndNotify:       (gs, t, a)   => this.tickQuestAndNotify(gs, t, a),
      checkAchievementsAndToast:(gs)         => this.checkAchievementsAndToast(gs),
      openMonsterPanel:         (r, c, t, s) => this.monsterPanel.open(r, c, t, s),
      shakeRoomSelectionPanel:  ()           => this.panel.shakeInsufficient(),
      shakeUpgradePanel:        ()           => this.upgradePanel?.shakeInsufficient(),
    };
  }

  private upgradeRoom(row: number, col: number): void {
    _upgradeRoom(this.makeRoomActionsCtx(), row, col);
  }

  // ─── Build particles ──────────────────────────────────────────────────────

  // ─── Attack range preview ─────────────────────────────────────────────────

  /** Draw a semi-transparent dashed range ring on the room at (row, col). */
  private showRangePreview(row: number, col: number, range: number): void {
    this.hideRangePreview();
    this.rangePreviewGfx = _showRangePreview(this, row, col, range, this.effectiveCellSize);
  }

  /** Fade out and destroy the current range preview graphic. */
  private hideRangePreview(): void {
    if (!this.rangePreviewGfx) return;
    _hideRangePreview(this, this.rangePreviewGfx);
    this.rangePreviewGfx = undefined;
  }

  private spawnBuildParticles(x: number, y: number): void {
    _spawnBuildParticles(this, x, y);
  }

  // ─── Wave Flow ────────────────────────────────────────────────────────────

  private startWave(): void {
    _startWave(this.makeWaveStartCtx());
  }

  private makeWaveStartCtx(): WaveStartContext {
    const self = this;
    return {
      scene:             this,
      maxWave:           this.maxWave,
      isEndless:         this.isEndless,
      endlessHighScore:  this.endlessHighScore,
      stageChapter:      this.stageChapter,
      maxHp:             this.maxHp,
      effectiveCellSize: this.effectiveCellSize,
      roomGrid:          this.roomGrid,
      waveConfigs:       this.waveConfigs,
      dungeonTrapSlots:  this.dungeonTrapSlots,
      activeInvaders:    this.activeInvaders,
      get wave()                 { return self.wave; },
      set wave(v)                { self.wave = v; },
      get waveActive()           { return self.waveActive; },
      set waveActive(v)          { self.waveActive = v; },
      get endlessRecordBroken()  { return self.endlessRecordBroken; },
      set endlessRecordBroken(v) { self.endlessRecordBroken = v; },
      get waveEndChecked()       { return self.waveEndChecked; },
      set waveEndChecked(v)      { self.waveEndChecked = v; },
      get waveHasSpawned()       { return self.waveHasSpawned; },
      set waveHasSpawned(v)      { self.waveHasSpawned = v; },
      get dungeonHp()            { return self.dungeonHp; },
      set dungeonHp(v)           { self.dungeonHp = v; },
      get recentlyDeadInvaders()    { return self.recentlyDeadInvaders; },
      set recentlyDeadInvaders(v)   { self.recentlyDeadInvaders = v; },
      get tauntBoostActiveUntil()   { return self.tauntBoostActiveUntil; },
      set tauntBoostActiveUntil(v)  { self.tauntBoostActiveUntil = v; },
      get killsThisWave()        { return self.killsThisWave; },
      set killsThisWave(v)       { self.killsThisWave = v; },
      get breakthruCount()       { return self.breakthruCount; },
      set breakthruCount(v)      { self.breakthruCount = v; },
      get waveStartSlotHps()     { return self.waveStartSlotHps; },
      set waveStartSlotHps(v)    { self.waveStartSlotHps = v; },
      get waveStartDungeonHp()   { return self.waveStartDungeonHp; },
      set waveStartDungeonHp(v)  { self.waveStartDungeonHp = v; },
      get waveInvaderTotal()     { return self.waveInvaderTotal; },
      set waveInvaderTotal(v)    { self.waveInvaderTotal = v; },
      get killCounterText()      { return self.killCounterText; },
      set killCounterText(v)     { self.killCounterText = v; },
      get waveGoldMult()         { return self.waveGoldMult; },
      set waveGoldMult(v)        { self.waveGoldMult = v; },
      get waveHpMult()           { return self.waveHpMult; },
      set waveHpMult(v)          { self.waveHpMult = v; },
      get waveAtkMult()          { return self.waveAtkMult; },
      set waveAtkMult(v)         { self.waveAtkMult = v; },
      get waveSpdMult()          { return self.waveSpdMult; },
      set waveSpdMult(v)         { self.waveSpdMult = v; },
      get waveFogOverlay()       { return self.waveFogOverlay; },
      set waveFogOverlay(v)      { self.waveFogOverlay = v; },
      get spawnQueue()           { return self.spawnQueue; },
      set spawnQueue(v)          { self.spawnQueue = v; },
      setWaveRegistry:    (v)   => this.registry.set('wave', v),
      setHpRegistry:      (v)   => this.registry.set('hp', v),
      setWaveLabelText:   (t, c) => this.waveLabel.setText(t).setColor(c),
      disableWaveButton:  ()    => { this.waveBtnBg.setAlpha(0.4); this.waveBtnZone.disableInteractive(); },
      hasSynergy:         (id)  => this.synergyManager.hasSpecial(id),
      updateArmoryBonuses:()    => _updateArmoryBonuses(this.makeRoomMechanicsCtx()),
      triggerScrollBurst: (d)   => _triggerScrollBurst(this.makeRoomMechanicsCtx(), d),
      showBossWarning:    ()    => this.showBossWarning(),
      processSpawnQueue:  (dl)  => this.processSpawnQueue(dl),
      showEndlessMilestoneToast: () => this.showEndlessMilestoneToast(),
      showWaveEnemyPreview:      () => this._showWaveEnemyPreview(),
    };
  }

  private processSpawnQueue(initialDelay: number): void {
    _processSpawnQueue(this.makeSpawnPipelineCtx(), initialDelay);
  }

  private spawnInvader(type: InvaderType): void {
    _spawnInvaderByType(this.makeSpawnPipelineCtx(), type);
  }

  /** Brief enemy-type summary pill shown just after the wave banner slides in. */
  private _showWaveEnemyPreview(): void {
    _showWaveEnemyPreview(this, this.waveConfigs, this.wave);
  }

  private makeSpawnPipelineCtx(): SpawnPipelineContext {
    const self = this;
    return {
      scene:           this,
      invaderPath:     this.invaderPath,
      waveHpMult:      this.waveHpMult,
      waveSpdMult:     this.waveSpdMult,
      dailySpeedMult:  this.dailyMode?.modifiers.invaderSpeedMult ?? 1,
      get waveActive()     { return self.waveActive; },
      get activeInvaders() { return self.activeInvaders; },
      get spawnQueue()     { return self.spawnQueue; },
      set spawnQueue(v)    { self.spawnQueue = v; },
      set waveHasSpawned(v: boolean) { self.waveHasSpawned = v; },
      setRemainingInvadersRegistry: (n) => this.registry.set('remainingInvaders', n),
      hasSynergy:   (id)       => this.synergyManager.hasSpecial(id),
      applyBehavior: (inv, def) => applyInvaderBehavior(this.makeBossCtx(), inv, def),
    };
  }

  // ─── Combat (update loop) ─────────────────────────────────────────────────

  private runCombat(now: number, rmCtx: RoomMechanicsContext): void {
    const cs  = this.effectiveCellSize;
    const ctx = this.makeCombatResolverCtx();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < this.effectiveCols; col++) {
        const data = this.roomGrid[row][col];
        if (!data || !data.attackCooldown) continue;
        if (now - data.lastAttackTime < data.attackCooldown) continue;

        const mDef        = resolveMonsterDef(data.monsterSlot ?? undefined);
        const range       = mDef ? mDef.range : 1;
        const cellCenterY = GRID_Y + row * cs + cs / 2;
        const rowRange    = cs * Math.max(range - 0.2, 0.8);

        const target = _findTarget(
          this.activeInvaders, data, mDef,
          this.rooms[row][col].x, cellCenterY, rowRange, now,
        );
        if (target && _resolveAttack(ctx, row, col, data, mDef, target, cellCenterY, now)) continue;
      }
    }
    _runExtraMonsterAttacks(rmCtx, now);
  }

  private makeCombatResolverCtx(): CombatResolverContext {
    const self = this;
    return {
      scene:             this,
      rooms:             this.rooms,
      roomGrid:          this.roomGrid,
      activeInvaders:    this.activeInvaders,
      effectiveCols:     this.effectiveCols,
      effectiveCellSize: this.effectiveCellSize,
      equipmentMap:      this.equipmentMap,
      waveAtkMult:       this.waveAtkMult,
      wisdomBonuses:     this.wisdomBonuses,
      prestigeDmgMult:   this.prestigeDmgMult,
      speedMult:         this.speedMult,
      get gold()               { return self.gold; },
      set gold(v)              { self.gold = v; },
      get tauntBoostActiveUntil() { return self.tauntBoostActiveUntil; },
      setGoldRegistry:         (v)          => this.registry.set('gold', v),
      hasSynergy:              (id)         => this.synergyManager.hasSpecial(id),
      applyWarHexToHighestHP:  ()           => this.applyWarHexToHighestHP(),
      triggerTauntingRoar:     (rx, ry)     => this.triggerTauntingRoar(rx, ry),
      triggerSpectralBolt:     (rx, cy, r, d) => _triggerSpectralBolt(this.makeRoomMechanicsCtx(), rx, cy, r, d),
      triggerWhirlwind:        (r, d, rx, cy) => _triggerWhirlwind(this.makeRoomMechanicsCtx(), r, d, rx, cy),
      triggerChainLightning:   (src, cd, mc) => _triggerChainLightning(this.makeRoomMechanicsCtx(), src, cd, mc),
    };
  }

  private makeBossCtx(): BossContext {
    // Returns a mutable context object. The shared BossHud is lazily created
    // here so the very first BossBehaviors handler can call ctx.bossHud.build().
    const self = this;
    return {
      scene: this,
      activeInvaders: this.activeInvaders,
      rooms: this.rooms,
      roomGrid: this.roomGrid,
      get effectiveCols() { return self.effectiveCols; },
      get effectiveCellSize() { return self.effectiveCellSize; },
      get speedMult() { return self.speedMult; },
      invaderPath: this.invaderPath,
      bossHud: this.getBossHud(),
      showFloatText: (x, y, text, color) => _showFloatText(this, x, y, text, color),
      spawnInvader: (type) => this.spawnInvader(type),
      triggerChainLightning: (source, chainDmg, maxChains) => _triggerChainLightning(this.makeRoomMechanicsCtx(), source, chainDmg, maxChains),
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
      drawBtn: (g, x, y, w, h, hover) => paintWaveButton(g, x, y, w, h, hover),
      startWave: () => this.startWave(),
      grantMonsterXp: (amount) => _grantMonsterXp(this.makeQuestTrackerCtx(), amount),
      saveRoomHpsToGameState: () => _saveRoomHpsToGameState(this.dungeonTrapSlots),
      showFloatText: (x, y, text, color) => _showFloatText(this, x, y, text, color),
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
      get speedMult() { return self.speedMult; },
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
      showGoldFloat: (text, x, y) => _showGoldFloat(this, text, x, y),
      showTigersPounce: (rx, ry, tx, ty) => _showTigersPounce(this, rx, ry, tx, ty),
      showHealEffect: (healer, target, amount) => _showHealEffect(this, healer, target, amount),
      showSoulHarvestExec: (x, y) => _showSoulHarvestExec(this, x, y),
      showFloatText: (x, y, text, color) => _showFloatText(this, x, y, text, color),
      flashRoom: (row, col) => this.rooms[row][col].flashAttack(),
      healRoomHp: (row, col, amount) => this.rooms[row][col].healRoomHp(amount),
      damageRoomHp: (row, col, amount) => this.rooms[row][col].damageRoomHp(amount),
      hasDivineTerritory: () => hasDivineTerritory(this.roomGrid),
      pushInvader: (inv) => this.activeInvaders.push(inv),
    };
  }

  private setSpeed(mult: 1 | 2): void {
    this.speedMult = mult;
    this.time.timeScale = mult;
    this.tweens.timeScale = mult;
  }

  private updateLowHpVignette(): void {
    this.lowHpVignette = _updateLowHpVignette(this, this.dungeonHp / this.maxHp, this.lowHpVignette);
  }

  private applyWarHexToHighestHP(): void {
    _applyWarHexToHighestHP(this.makeBattleEventCtx());
  }

  private triggerTauntingRoar(rx: number, ry: number): void {
    _triggerTauntingRoar(this.makeBattleEventCtx(), rx, ry);
  }

  // ── Tigers Pounce update loop ──────────────────────────────────────────────
  private pounceReadyMap = new Map<string, { ready: boolean; cooldownUntil: number }>();

  // ─── Gold Vein passive income ─────────────────────────────────────────────

  private goldTick = 0;

  // ─── Wave End Detection ───────────────────────────────────────────────────

  private waveEndChecked  = false;
  private waveHasSpawned  = false;

  private checkWaveEnd(): void {
    _checkWaveEnd(this.makeCheckWaveEndCtx());
  }

  private makeCheckWaveEndCtx(): CheckWaveEndContext {
    const self = this;
    return {
      scene:              this,
      wave:               this.wave,
      maxWave:            this.maxWave,
      waveStartDungeonHp: this.waveStartDungeonHp,
      maxHp:              this.maxHp,
      get waveEndChecked()        { return self.waveEndChecked; },
      set waveEndChecked(v)       { self.waveEndChecked = v; },
      get waveHasSpawned()        { return self.waveHasSpawned; },
      get activeInvaders()        { return self.activeInvaders; },
      set activeInvaders(v)       { self.activeInvaders = v; },
      get killCounterText()       { return self.killCounterText; },
      set killCounterText(v)      { self.killCounterText = v; },
      get waveActive()            { return self.waveActive; },
      set waveActive(v)           { self.waveActive = v; },
      get dungeonHp()             { return self.dungeonHp; },
      get consecutiveNoDmgWaves() { return self.consecutiveNoDmgWaves; },
      set consecutiveNoDmgWaves(v){ self.consecutiveNoDmgWaves = v; },
      saveRoomHpsToGameState: () => _saveRoomHpsToGameState(this.dungeonTrapSlots),
      showChapterClear:       () => this.showChapterClear(),
      showWaveClear:          () => this.showWaveClear(),
    };
  }

  // ─── Wave Clear Panel ─────────────────────────────────────────────────────

  // ─── Wave random events ──────────────────────────────────────────────────

  private makeWaveEventCtx(): WaveEventContext {
    const self = this;
    return {
      scene: this,
      get wave() { return self.wave; },
      get maxWave() { return self.maxWave; },
      get isEndless() { return self.isEndless; },
      get waveConfigs() { return self.waveConfigs; },
      get theme() { return self.theme; },
      get synergyHasMoonlightHealUp() { return self.synergyManager.hasSpecial('MOONLIGHT_HEAL_UP'); },
      get maxHp() { return self.maxHp; },
      get stageNumber() { return self.stageNumber; },
      get waveGoldMult() { return self.waveGoldMult; },
      set waveGoldMult(v) { self.waveGoldMult = v; },
      get waveHpMult() { return self.waveHpMult; },
      set waveHpMult(v) { self.waveHpMult = v; },
      get waveAtkMult() { return self.waveAtkMult; },
      set waveAtkMult(v) { self.waveAtkMult = v; },
      get waveSpdMult() { return self.waveSpdMult; },
      set waveSpdMult(v) { self.waveSpdMult = v; },
      get waveFogOverlay() { return self.waveFogOverlay; },
      set waveFogOverlay(v) { self.waveFogOverlay = v; },
      get dungeonHp() { return self.dungeonHp; },
      set dungeonHp(v) { self.dungeonHp = v; },
      startWave: () => self.startWave(),
      setRegistryHp: (hp) => self.registry.set('hp', hp),
    };
  }

  private tryShowWaveEvent(): void {
    _tryShowWaveEvent(this.makeWaveEventCtx());
  }

  private showWaveClear(): void {
    _showWaveClear(this.makeResultFlowCtx());
  }

  // ─── Wave Fail ────────────────────────────────────────────────────────────

  private triggerWaveFail(): void {
    _triggerWaveFail(this.makeResultFlowCtx());
  }

  // ─── Boss HP bar ──────────────────────────────────────────────────────────

  /** Lazily instantiate the shared BossHud (also used by BossBehaviors). */
  private getBossHud(): BossHud {
    if (!this.bossHud) this.bossHud = new BossHud(this);
    return this.bossHud;
  }

  private buildBossHpBar(maxHp: number): void {
    this.getBossHud().build(maxHp);
  }

  private updateBossHpBar(): void {
    this.bossHud?.update(this.activeInvaders, this.wave, this.maxWave);
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

  // ─── Event Registration ──────────────────────────────────────────────────────
  // Each handler is a named private method so it can be read and reasoned about
  // independently. The lambda bodies have been removed from this registration
  // stub to keep it concise.

  private setupEvents(): void {
    this.events.on('invaderKilled',    (inv: Invader)                  => this.handleInvaderKilled(inv));
    this.events.on('invaderReachedEnd',(inv: Invader)                  => this.handleInvaderReachedEnd(inv));
    this.events.on('mirrorReflect',    (_inv: Invader, dmg: number)    => this.handleMirrorReflect(dmg));
    this.events.on('invaderKilledRow', (_inv: Invader, row: number)    => this.handleInvaderKilledRow(row));
    this.events.on('roomDestroyed',    (row: number, col: number)      => this.handleRoomDestroyed(row, col));
    this.events.on('permafrostShatter',(source: Invader)               => this.handlePermafrostShatter(source));
    this.registry.events.on('changedata-battleSpeed',  (_: unknown, v: 1 | 2)       => this.setSpeed(v));
    this.registry.events.on('changedata-battlePaused', (_: unknown, p: boolean)     => this.handleBattlePauseChange(p));
  }

  // ─── roomDestroyed ────────────────────────────────────────────────────────────

  private handleRoomDestroyed(row: number, col: number): void {
    this.roomGrid[row][col] = null;
    logger.debug(`[ROOM DESTROYED] [${row},${col}]`);
  }

  // ─── invaderKilled ────────────────────────────────────────────────────────────

  private handleInvaderKilled(inv: Invader): void {
    _handleInvaderKilled(this.makeKillHandlerCtx(), inv);
  }

  private makeKillHandlerCtx(): KillHandlerContext {
    const self = this;
    return {
      scene:                   this,
      equipmentMap:            this.equipmentMap,
      materialsEarnedThisRun:  this.materialsEarnedThisRun,
      get killCounterText()    { return self.killCounterText; },
      get waveInvaderTotal()   { return self.waveInvaderTotal; },
      roomGrid:                this.roomGrid,
      get wave()               { return self.wave; },
      get maxWave()            { return self.maxWave; },
      get isEndless()          { return self.isEndless; },
      get waveActive()         { return self.waveActive; },
      get maxHp()              { return self.maxHp; },
      get stageChapter()       { return self.stageChapter; },
      get effectiveCols()      { return self.effectiveCols; },
      get gold()               { return self.gold; },
      set gold(v)              { self.gold = v; },
      get killsThisRun()       { return self.killsThisRun; },
      set killsThisRun(v)      { self.killsThisRun = v; },
      get killsThisWave()      { return self.killsThisWave; },
      set killsThisWave(v)     { self.killsThisWave = v; },
      get goldEarnedThisRun()  { return self.goldEarnedThisRun; },
      set goldEarnedThisRun(v) { self.goldEarnedThisRun = v; },
      get killComboCount()     { return self.killComboCount; },
      set killComboCount(v)    { self.killComboCount = v; },
      get lastKillTime()       { return self.lastKillTime; },
      set lastKillTime(v)      { self.lastKillTime = v; },
      get activeInvaders()     { return self.activeInvaders; },
      set activeInvaders(v)    { self.activeInvaders = v; },
      get dungeonHp()          { return self.dungeonHp; },
      set dungeonHp(v)         { self.dungeonHp = v; },
      get hexedInvader()       { return self.hexedInvader; },
      set hexedInvader(v)      { self.hexedInvader = v; },
      get recentlyDeadInvaders()    { return self.recentlyDeadInvaders; },
      set recentlyDeadInvaders(v)   { self.recentlyDeadInvaders = v; },
      setGoldRegistry:              (v) => this.registry.set('gold', v),
      setHpRegistry:                (v) => this.registry.set('hp', v),
      setRemainingInvadersRegistry: (n) => this.registry.set('remainingInvaders', n),
      hasSynergy:                   (id) => this.synergyManager.hasSpecial(id),
      spawnInvader:                 (type) => this.spawnInvader(type),
      spawnCoinFlyEffect:           (x, y) => _spawnCoinFlyEffect(this, x, y),
      checkAchievementsAndToast:    (gs) => this.checkAchievementsAndToast(gs),
      applyWarHexToHighestHP:       () => this.applyWarHexToHighestHP(),
      grantMonsterXp:               (amount) => _grantMonsterXp(this.makeQuestTrackerCtx(), amount),
      hasDivineTerritory:           () => hasDivineTerritory(this.roomGrid),
    };
  }

  // ─── BattleEventContext factory ───────────────────────────────────────────────

  private makeBattleEventCtx(): BattleEventContext {
    const self = this;
    return {
      scene:          this,
      wisdomBonuses:  this.wisdomBonuses,
      roomGrid:       this.roomGrid,
      rooms:          this.rooms,
      effectiveCols:  this.effectiveCols,
      speedMult:      this.speedMult,
      maxHp:          this.maxHp,
      get dungeonHp()              { return self.dungeonHp; },
      set dungeonHp(v)             { self.dungeonHp = v; },
      get activeInvaders()         { return self.activeInvaders; },
      set activeInvaders(v)        { self.activeInvaders = v; },
      get gold()                   { return self.gold; },
      set gold(v)                  { self.gold = v; },
      get hexedInvader()           { return self.hexedInvader; },
      set hexedInvader(v)          { self.hexedInvader = v; },
      get tauntBoostActiveUntil()  { return self.tauntBoostActiveUntil; },
      set tauntBoostActiveUntil(v) { self.tauntBoostActiveUntil = v; },
      get breakthruCount()         { return self.breakthruCount; },
      set breakthruCount(v)        { self.breakthruCount = v; },
      hasSynergy:         (id)  => this.synergyManager.hasSpecial(id),
      applyRoomSlotDamage:(pct) => _applyRoomSlotDamage(this.dungeonTrapSlots, pct),
      triggerWaveFail:    ()    => this.triggerWaveFail(),
      updateLowHpVignette:()    => this.updateLowHpVignette(),
      setHpRegistry:      (v)   => this.registry.set('hp', v),
      setGoldRegistry:    (v)   => this.registry.set('gold', v),
    };
  }

  // ─── invaderReachedEnd ────────────────────────────────────────────────────────

  private handleInvaderReachedEnd(inv: Invader): void {
    _handleInvaderReachedEnd(this.makeBattleEventCtx(), inv);
  }

  // ─── mirrorReflect ────────────────────────────────────────────────────────────

  private handleMirrorReflect(reflectDmg: number): void {
    _handleMirrorReflect(this.makeBattleEventCtx(), reflectDmg);
  }

  // ─── invaderKilledRow (GILDED_KILL) ──────────────────────────────────────────

  private handleInvaderKilledRow(invRow: number): void {
    _handleInvaderKilledRow(this.makeBattleEventCtx(), invRow);
  }

  // ─── permafrostShatter ────────────────────────────────────────────────────────

  private handlePermafrostShatter(source: Invader): void {
    _handlePermafrostShatter(this.makeBattleEventCtx(), source);
  }

  // ─── battlePaused ─────────────────────────────────────────────────────────────

  private handleBattlePauseChange(paused: boolean): void {
    if (paused) {
      this.time.timeScale = 0;
      this.tweens.timeScale = 0;
    } else {
      this.time.timeScale = this.speedMult;
      this.tweens.timeScale = this.speedMult;
    }
  }

  // ─── Endless Mode ─────────────────────────────────────────────────────────

  private showEndlessMilestoneToast(): void {
    _showEndlessMilestoneToast(this, this.wave);
  }

  private showEndlessResult(): void {
    _showEndlessResult(this, this.wave, this.wisdomBonuses.crystalEarnMult, this.killsThisRun, this.goldEarnedThisRun);
  }

  // ─── Achievement system ────────────────────────────────────────────────────

  private makeQuestTrackerCtx(): QuestTrackerContext {
    return { scene: this };
  }

  private checkAchievementsAndToast(gs: ReturnType<typeof loadGameState>): void {
    _checkAchievementsAndToast(this.makeQuestTrackerCtx(), gs);
  }

  private tickQuestAndNotify(gs: ReturnType<typeof loadGameState>, type: Parameters<typeof updateQuestObjective>[1], amount = 1): void {
    _tickQuestAndNotify(this.makeQuestTrackerCtx(), gs, type, amount);
  }

  private trackConsecutiveDays(): void {
    _trackConsecutiveDays();
  }

  // ─── Chapter 3: Medicine Hall healing ─────────────────────────────────────

  private medicineHealTick = 0;
  private medicineGlobalPulseLast = 0;

  // ─── Chapter 3: POISON_TRAIL room damage ───────────────────────────────────

  private poisonDamageTick = 0;

  // ─── Ch4: ENTRANCING_VEIL — while celestial_dancer placed, slow all invaders ─

  private entrancingVeilApplied = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT INTERACTION SUBSYSTEMS
  // ═══════════════════════════════════════════════════════════════════════════

  private initSkillHUD(gameState: ReturnType<typeof loadGameState>): void {
    _initSkillHUD(this.makeGameplayInitCtx(), gameState);
  }

  private initSwapManager(): void {
    _initSwapManager(this.makeGameplayInitCtx());
  }

  private makeGameplayInitCtx(): GameplayInitContext {
    return {
      scene:         this,
      roomGrid:      this.roomGrid,
      rooms:         this.rooms,
      effectiveCols: this.effectiveCols,
      setTargetingSkillId: (v) => { this.targetingSkillId = v; },
      setSkillHUD:         (v) => { this.skillHUD = v; },
      setSwapManager:      (v) => { this.swapManager = v; },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNERGY SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /** Recalculate active tribe synergies and element combos from placed monsters. */
  // ─── Room Durability ──────────────────────────────────────────────────────

}
