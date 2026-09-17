import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  CANVAS_HEIGHT,
  GRID_COLS, GRID_ROWS, CELL_SIZE,
} from '../constants/layout';
import { type RoomData } from '../data/rooms';
import type { InvaderType, InvaderDef } from '../data/invaders';
import { type WaveSpec } from '../data/stages';
import { loadGameState, saveGameState, getWisdomBonuses, getPrestigeDmgMult, type WisdomBonuses } from '../data/wisdom';
import { computeDecorationBonuses, EMPTY_BONUSES, type DecorationBonuses } from '../data/decorations';
import { type EquipmentStats, buildGuardianAtkMultMap } from '../data/barracks';
import { applyDailyChallengeTick, type DailyDungeon, type WeeklyBoss } from '../data/daily';
import type { ObjectiveType } from '../data/quests';
import { applyChapterTheme } from './ChapterTheme';
import { resolveStageSetup, buildEquipmentMap } from '../combat/DungeonSceneInit';
import { SkillHUD } from '../combat/SkillHUD';
import { MonsterSwapManager } from '../combat/MonsterSwap';
import { SynergyManager } from '../combat/SynergyManager';
import { processSpawnQueue as _processSpawnQueue, spawnInvaderByType as _spawnInvaderByType } from '../combat/SpawnPipeline';
import { registerDynamicSpawn as _registerDynamicSpawn } from '../combat/waveSpawnAccounting';
import { showSkillPopup as _showSkillPopup } from '../combat/SkillPopup';
import { handleInvaderKilled as _handleInvaderKilled } from '../combat/KillHandler';
import { showRangePreview as _showRangePreview, hideRangePreview as _hideRangePreview } from '../combat/RoomVfx';
import {
  type RoomMechanicsContext,
  runTigersPounce as _runTigersPounce,
  runMercenaryAuras as _runMercenaryAuras,
  runHealers as _runHealers,
  runSoulHarvest as _runSoulHarvest,
  runMedicineHallHeal as _runMedicineHallHeal,
  runPoisonTrailDamage as _runPoisonTrailDamage,
  runEntrancingVeil as _runEntrancingVeil,
  runSpiritAltar as _runSpiritAltar,
  runLunarRhythm as _runLunarRhythm,
} from '../combat/RoomMechanics';
import { runTrapEffects as _runTrapEffects, recalcRoomTypeBonuses as _recalcRoomTypeBonuses } from '../combat/RoomTriggers';
import { showWisdomToast as _showWisdomToast } from '../combat/VisualEffects';
import { showBossWarning as _showBossWarning, updateLowHpVignette as _updateLowHpVignette } from '../combat/ImpactVfx';
import { showWaveClear as _showWaveClear, triggerWaveFail as _triggerWaveFail } from '../combat/ResultFlow';
import { showChapterClear as _showChapterClear } from '../combat/StageClearFlow';
import { tryShowWaveEvent as _tryShowWaveEvent } from '../combat/WaveEvents';
import { checkAchievementsAndToast as _checkAchievementsAndToast, tickQuestAndNotify as _tickQuestAndNotify, trackConsecutiveDays as _trackConsecutiveDays } from '../combat/QuestTracker';
import {
  drawDungeonBackground,
  buildInvaderPath,
  buildDungeonGrid,
  placeDungeonTorches,
  addDustMoteParticles,
  addDungeonFog,
  buildWaveStartButton,
  type DungeonSlotDeploymentSummary,
} from '../combat/DungeonLayout';
import { activateSkillEffect } from '../combat/ActiveSkills';
import { BossHud } from '../combat/BossHud';
import { startWave as _startWave } from '../combat/WaveStart';
import { showWaveEnemyPreview as _showWaveEnemyPreview, showEndlessMilestoneToast as _showEndlessMilestoneToast, showEndlessResult as _showEndlessResult, checkWaveEnd as _checkWaveEnd } from '../combat/WaveLifecycle';
import { onRoomClick as _onRoomClick } from '../combat/RoomInput';
import { initSkillHUD as _initSkillHUD, initSwapManager as _initSwapManager } from '../combat/GameplayInit';
import {
  handleInvaderReachedEnd  as _handleInvaderReachedEnd,
  handleMirrorReflect      as _handleMirrorReflect,
  handleInvaderKilledRow   as _handleInvaderKilledRow,
  handlePermafrostShatter  as _handlePermafrostShatter,
  applyWarHexToHighestHP   as _applyWarHexToHighestHP,
  triggerTauntingRoar      as _triggerTauntingRoar,
} from '../combat/BattleEventHandlers';
import {
  buildRoomInputCtx,
  buildActiveSkillContext,
  buildWaveStartCtx,
  buildSpawnPipelineCtx,
  buildResultFlowCtx,
  buildRoomMechanicsCtx,
  buildCheckWaveEndCtx,
  buildWaveEventCtx,
  buildKillHandlerCtx,
  buildBattleEventCtx,
  buildGameplayInitCtx,
  buildQuestTrackerCtx,
} from '../combat/DungeonSceneCtx';
import { logger } from '../utils/logger';
import {
  deployDungeonSlots as _deployDungeonSlots,
  showDungeonDeploymentToast as _showDungeonDeploymentToast,
  buildDungeonCommandStrip as _buildDungeonCommandStrip,
  runCombat as _runCombat,
  setupEvents as _setupEvents,
} from './DungeonSceneVisuals';

export class DungeonScene extends Phaser.Scene {
  // ── Dynamic grid dimensions (overridden per chapter) ───────────────────────
  effectiveCols     = GRID_COLS;   // 3 for Ch1, 4 for Ch2
  effectiveCellSize = CELL_SIZE;   // 110 for Ch1, 82 for Ch2
  stageChapter      = 1;
  stageNumber       = 0;           // 0 = inline invasion (no stage number)
  waterCells        = new Set<number>();   // flat indices (row*cols+col) of water cells

  // ── Wave configs (loaded per stage) ───────────────────────────────────────
  waveConfigs: WaveSpec[] = [];

  hexedInvader: import('../objects/Invader').Invader | null = null;
  recentlyDeadInvaders: Array<import('../data/invaders').InvaderDef> = [];
  tauntBoostActiveUntil = 0;  // TAUNTING_ROAR damage boost

  // ── Grid state ─────────────────────────────────────────────────────────────
  rooms:    Room[][] = [];
  roomGrid: (RoomData | null)[][] = [];

  // ── Combat ─────────────────────────────────────────────────────────────────
  invaderPath!: Phaser.Curves.Path;
  activeInvaders: Invader[] = [];
  /** Invader behaviors already announced (trait callout) — once per run. */
  seenTraitBehaviors: Set<string> = new Set();

  // ── UI ─────────────────────────────────────────────────────────────────────
  // Active skill system
  skillPopup?:    Phaser.GameObjects.Container;
  skillCooldowns  = new Map<string, number>();  // `${row}_${col}_${skillId}` → ready-at ms

  // Boss HP bar — owned by combat/BossHud (created lazily on first boss spawn)
  bossHud?:       BossHud;
  waveLabel!: Phaser.GameObjects.Text;
  waveBtnBg!: Phaser.GameObjects.Graphics;
  waveBtnZone!: Phaser.GameObjects.Zone;
  resultOverlay?: Phaser.GameObjects.Container;
  returnTo?: string;   // set when launched from invasion (PreBattleScene)
  countdownBar?: Phaser.GameObjects.Graphics;
  /** @internal */ commandStrip?: Phaser.GameObjects.Container;

  // ── Combat interaction subsystems ─────────────────────────────────────────
  skillHUD?: SkillHUD;
  swapManager?: MonsterSwapManager;
  targetingSkillId: string | null = null;

  // ── Range preview overlay ─────────────────────────────────────────────────
  private rangePreviewGfx?: Phaser.GameObjects.Graphics;

  // ── Synergy system ────────────────────────────────────────────────────────
  synergyManager!: SynergyManager;

  // ── Wisdom bonuses ─────────────────────────────────────────────────────────
  wisdomBonuses!: WisdomBonuses;
  prestigeDmgMult = 1;   // +10% per prestige level
  private baseSlots       = 12;  // overridden in create() from stage config

  // ── Player state ───────────────────────────────────────────────────────────
  // Battle gold is loot: it starts at 0 and only kills / wave rewards add to
  // it. The dungeon itself is designed at home; nothing is built mid-battle.
  gold      = 0;
  gems      = 0;   // loaded from GameState in create() — revive spends REAL gems
  dungeonHp = 1000;
  maxHp     = 1000;
  /** Decoration set bonuses (dungeon HP / trap damage) active this battle. */
  decorationBonuses: DecorationBonuses = EMPTY_BONUSES;

  // ── Wave state ─────────────────────────────────────────────────────────────
  wave         = 0;
  maxWave      = 10;
  waveActive   = false;
  spawnQueue:  Array<{ def: InvaderDef; delay: number }> = [];
  prepTimer    = 0;
  prepActive   = false;

  // ── Endless mode ───────────────────────────────────────────────────────────
  isEndless        = false;
  endlessHighScore = 0;
  endlessRecordBroken = false;
  killsThisRun     = 0;
  goldEarnedThisRun = 0;
  killComboCount   = 0;
  lastKillTime     = 0;
  materialsEarnedThisRun: Record<string, number> = {};
  equipmentMap = new Map<string, EquipmentStats>();  // monsterId → equipment stats
  guardianAtkMult = new Map<string, number>();       // monsterId → level·강타 multiplier

  // ── Per-wave stats ─────────────────────────────────────────────────────────
  killsThisWave      = 0;
  breakthruCount     = 0;
  waveStartSlotHps: number[] = [];   // snapshot of slot HPs at wave start
  waveStartDungeonHp = 0;           // for no_damage challenge tracking
  consecutiveNoDmgWaves = 0;         // consecutive waves cleared without taking HP damage

  // ── Wave event multipliers (reset each wave) ─────────────────────────────
  waveGoldMult = 1;
  waveHpMult   = 1;    // invader HP multiplier (curse)
  waveAtkMult  = 1;    // monster ATK multiplier (rally)
  waveSpdMult  = 1;    // invader speed multiplier (fog)
  waveFogOverlay?: Phaser.GameObjects.Graphics;

  // ── Dungeon slot traps ──────────────────────────────────────────────────────
  dungeonTrapSlots: import('../data/wisdom').DungeonSlot[] = [];
  /** Per-trap-type mastery from the save; read once per battle like the slots. */
  trapMastery: Readonly<Record<string, number>> = {};
  // Extra monster attack cooldowns: key = `${row}_${col}_${slotIdx}` → lastAttackTime ms
  extraMonsterCooldowns = new Map<string, number>();
  /** Per-slot trap damage synergy multiplier (populated by recalcRoomTypeBonuses) */
  slotTrapSynergyMult  = new Map<number, number>();

  // Theme
  theme!: DungeonTheme;

  // ── Battle speed ─────────────────────────────────────────────────────────
  speedMult: 1 | 2 | 3 = 1;

  // ── Low-HP vignette ──────────────────────────────────────────────────────
  lowHpVignette?: Phaser.GameObjects.Graphics;

  // ── Wave kill counter ─────────────────────────────────────────────────────
  killCounterText?: Phaser.GameObjects.Text;
  waveInvaderTotal = 0;

  // ── Daily dungeon mode ────────────────────────────────────────────────────
  dailyMode:      DailyDungeon | null = null;
  weeklyBossMode: WeeklyBoss    | null = null;

  constructor() { super({ key: 'DungeonScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    // Phaser reuses the Scene instance after stop/start, but does not call this
    // class method automatically. Bind it once per activation so combat event
    // listeners and timers cannot stack across consecutive battles.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // ── Wisdom bonuses ────────────────────────────────────────────────────────
    const gameState       = loadGameState();
    this.wisdomBonuses    = getWisdomBonuses(gameState);
    this.prestigeDmgMult  = getPrestigeDmgMult(gameState);
    this.synergyManager   = new SynergyManager(this);
    this.dungeonTrapSlots = gameState.dungeonSlots ?? [];
    this.trapMastery      = gameState.trapMastery ?? {};
    this.decorationBonuses = computeDecorationBonuses(gameState.placedDecorations);

    // Build monster → equipment stats / raising multiplier lookups
    this.equipmentMap = buildEquipmentMap(gameState);
    this.guardianAtkMult = buildGuardianAtkMultMap(gameState.ownedMonsters);

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

    this.gold             = 0;

    // Apply dungeon HP bonus (+ 수호의 진영 decoration set bonus)
    const baseMaxHp       = setup.stageDungeonHp + this.wisdomBonuses.dungeonMaxHpBonus + this.wisdomBonuses.fortressHp;
    this.maxHp            = Math.round(baseMaxHp * (1 + this.decorationBonuses.dungeonHpPct / 100));
    this.dungeonHp        = this.maxHp;

    // Reset per-battle state — Phaser는 씬 인스턴스를 재사용하므로 클래스 필드
    // 초기값은 재진입 시 복원되지 않음. 이전 전투의 wave=10이 남으면
    // startWave의 wave >= maxWave 가드에 막혀 다음 전투가 시작 불가(소프트락).
    this.wave            = 0;
    this.waveActive      = false;
    this.prepActive      = false;
    this.prepTimer       = 0;
    this.spawnQueue      = [];
    this.waveEndChecked  = false;
    this.waveHasSpawned  = false;
    this.killsThisRun    = 0;
    this.goldEarnedThisRun = 0;
    this.endlessRecordBroken = false;
    this.skillCooldowns.clear();

    logger.debug(`[WISDOM] maxHp: ${this.maxHp}, slots: ${this.baseSlots}`);

    this.returnTo = this.registry.get('returnTo') as string | undefined;
    this.gems = gameState.gems ?? 0;
    this.registry.set('gold',  this.gold);
    this.registry.set('gems',  this.gems);
    this.registry.set('hp',    this.dungeonHp);
    this.registry.set('wave',  this.wave);
    this.registry.set('maxWave', this.maxWave);
    this.registry.set('status','');

    // Ch7 (stages 63-72) always use Celestial Realm theme
    const effectiveTheme = setup.stageNumber >= 63 ? 'celestial_realm' : gameState.equippedTheme;
    this.theme = getActiveTheme(effectiveTheme);
    this.roomGrid = Array.from({ length: GRID_ROWS }, () => Array<RoomData | null>(this.effectiveCols).fill(null));

    this.drawBackground();
    this.buildPath();
    this.buildGrid();
    const deploymentSummary = this.deployDungeonSlots();
    this.placeTorches();
    this.addDustMotes();
    this.addFog();
    this.buildWaveButton();
    this.setupEvents();
    applyChapterTheme(this, this.stageChapter, this.effectiveCellSize);

    this.showWisdomToast();
    this.buildDungeonCommandStrip(deploymentSummary);
    this.showDungeonDeploymentToast(deploymentSummary);
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
    this.commandStrip?.destroy();
    this.commandStrip = undefined;

    // Clear cached data
    this.equipmentMap.clear();
    this.guardianAtkMult.clear();
  }

  // ── FPS monitor (dev mode) ─────────────────────────────────────────────────
  private fpsText?: Phaser.GameObjects.Text;

  update(_time: number, _delta: number): void {
    if (!this.waveActive) return;
    const rmCtx = buildRoomMechanicsCtx(this);
    this.runCombat(_time, rmCtx);
    _runTrapEffects(rmCtx, _time);
    _runHealers(rmCtx, _time);
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
    drawDungeonBackground(this, this.theme, this.effectiveCols, this.effectiveCellSize, this.stageChapter);
  }

  private buildPath(): void {
    this.invaderPath = buildInvaderPath(this);
  }

  private buildGrid(): void {
    const gc = this.effectiveCols;
    // baseSlots already includes the wisdom-tree extra slots (see
    // getUnlockedSlotCount); the battle grid mirrors the home board exactly.
    const availableSlots = Math.min(GRID_ROWS * gc, this.baseSlots);
    this.rooms = buildDungeonGrid(this, {
      effectiveCols:     gc,
      effectiveCellSize: this.effectiveCellSize,
      availableSlots,
      waterCells:        this.waterCells,
      dungeonTrapSlots:  this.dungeonTrapSlots,
      onRoomClick:       (r) => this.onRoomClick(r),
    });
  }

  private deployDungeonSlots(): DungeonSlotDeploymentSummary {
    return _deployDungeonSlots(this);
  }

  private showDungeonDeploymentToast(summary: DungeonSlotDeploymentSummary): void {
    _showDungeonDeploymentToast(this, summary);
  }

  private buildDungeonCommandStrip(summary: DungeonSlotDeploymentSummary): void {
    _buildDungeonCommandStrip(this, summary);
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

  // ─── Room Interaction ─────────────────────────────────────────────────────

  private onRoomClick(room: Room): void {
    _onRoomClick(buildRoomInputCtx(this), room);
  }

  // ─── Active Skill Popup ───────────────────────────────────────────────────

  showSkillPopup(room: Room): void {
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

  activateSkill(skillId: string, room: Room): void {
    audioManager.playSfx('skill_activate');
    const dailyResult = applyDailyChallengeTick(loadGameState(), 'skill_use');
    if (dailyResult.changed) saveGameState(dailyResult.state);

    activateSkillEffect(skillId, buildActiveSkillContext(this, room));
  }

  // ─── Attack range preview ─────────────────────────────────────────────────

  /** Draw a semi-transparent dashed range ring on the room at (row, col). */
  showRangePreview(row: number, col: number, range: number): void {
    this.hideRangePreview();
    this.rangePreviewGfx = _showRangePreview(this, row, col, range, this.effectiveCellSize);
  }

  /** Fade out and destroy the current range preview graphic. */
  private hideRangePreview(): void {
    if (!this.rangePreviewGfx) return;
    _hideRangePreview(this, this.rangePreviewGfx);
    this.rangePreviewGfx = undefined;
  }

  // ─── Wave Flow ────────────────────────────────────────────────────────────

  startWave(): void {
    _startWave(buildWaveStartCtx(this));
  }

  processSpawnQueue(initialDelay: number): void {
    _processSpawnQueue(buildSpawnPipelineCtx(this), initialDelay);
  }

  spawnInvader(type: InvaderType): void {
    _registerDynamicSpawn(this);
    _spawnInvaderByType(buildSpawnPipelineCtx(this), type);
  }

  /** Brief enemy-type summary pill shown just after the wave banner slides in. */
  _showWaveEnemyPreview(): void {
    _showWaveEnemyPreview(this, this.waveConfigs, this.wave);
  }

  // ─── Combat (update loop) ─────────────────────────────────────────────────

  private runCombat(now: number, _rmCtx: RoomMechanicsContext): void {
    _runCombat(this, now);
  }

  /** @internal */ setSpeed(mult: 1 | 2 | 3): void {
    this.speedMult = mult;
    this.time.timeScale = mult;
    this.tweens.timeScale = mult;
  }

  updateLowHpVignette(): void {
    this.lowHpVignette = _updateLowHpVignette(this, this.dungeonHp / this.maxHp, this.lowHpVignette);
  }

  applyWarHexToHighestHP(): void {
    _applyWarHexToHighestHP(buildBattleEventCtx(this));
  }

  triggerTauntingRoar(rx: number, ry: number): void {
    _triggerTauntingRoar(buildBattleEventCtx(this), rx, ry);
  }

  // ── Tigers Pounce update loop ──────────────────────────────────────────────
  pounceReadyMap = new Map<string, { ready: boolean; cooldownUntil: number }>();

  // ─── Wave End Detection ───────────────────────────────────────────────────

  waveEndChecked  = false;
  waveHasSpawned  = false;

  private checkWaveEnd(): void {
    _checkWaveEnd(buildCheckWaveEndCtx(this));
  }

  // ─── Wave Clear Panel ─────────────────────────────────────────────────────

  // ─── Wave random events ──────────────────────────────────────────────────

  private tryShowWaveEvent(): void {
    _tryShowWaveEvent(buildWaveEventCtx(this));
  }

  showWaveClear(): void {
    _showWaveClear(buildResultFlowCtx(this));
  }

  // ─── Wave Fail ────────────────────────────────────────────────────────────

  triggerWaveFail(): void {
    _triggerWaveFail(buildResultFlowCtx(this));
  }

  // ─── Boss HP bar ──────────────────────────────────────────────────────────

  /** Lazily instantiate the shared BossHud (also used by BossBehaviors). */
  getBossHud(): BossHud {
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

  showBossWarning(): void {
    _showBossWarning(this, {
      waveConfigs: this.waveConfigs,
      wave: this.wave,
      isEndless: this.isEndless,
      buildBossHpBar: (hp: number) => this.buildBossHpBar(hp),
      bossHpOverride: this.weeklyBossMode?.totalHp,
    });
  }

  showChapterClear(): void {
    _showChapterClear(buildResultFlowCtx(this));
  }

  // ─── Event Registration ──────────────────────────────────────────────────────

  private setupEvents(): void {
    _setupEvents(this);
  }

  // ─── roomDestroyed ────────────────────────────────────────────────────────────

  /** @internal */ handleRoomDestroyed(row: number, col: number): void {
    this.roomGrid[row][col] = null;
    logger.debug(`[ROOM DESTROYED] [${row},${col}]`);
  }

  // ─── invaderKilled ────────────────────────────────────────────────────────────

  /** @internal */ handleInvaderKilled(inv: Invader): void {
    _handleInvaderKilled(buildKillHandlerCtx(this), inv);
  }

  // ─── invaderReachedEnd ────────────────────────────────────────────────────────

  /** @internal */ handleInvaderReachedEnd(inv: Invader): void {
    _handleInvaderReachedEnd(buildBattleEventCtx(this), inv);
  }

  // ─── mirrorReflect ────────────────────────────────────────────────────────────

  /** @internal */ handleMirrorReflect(reflectDmg: number): void {
    _handleMirrorReflect(buildBattleEventCtx(this), reflectDmg);
  }

  // ─── invaderKilledRow (GILDED_KILL) ──────────────────────────────────────────

  /** @internal */ handleInvaderKilledRow(invRow: number): void {
    _handleInvaderKilledRow(buildBattleEventCtx(this), invRow);
  }

  // ─── permafrostShatter ────────────────────────────────────────────────────────

  /** @internal */ handlePermafrostShatter(source: Invader): void {
    _handlePermafrostShatter(buildBattleEventCtx(this), source);
  }

  // ─── battlePaused ─────────────────────────────────────────────────────────────

  /** @internal */ handleBattlePauseChange(paused: boolean): void {
    if (paused) {
      this.time.timeScale = 0;
      this.tweens.timeScale = 0;
    } else {
      this.time.timeScale = this.speedMult;
      this.tweens.timeScale = this.speedMult;
    }
  }

  // ─── Endless Mode ─────────────────────────────────────────────────────────

  showEndlessMilestoneToast(): void {
    _showEndlessMilestoneToast(this, this.wave);
  }

  showEndlessResult(): void {
    _showEndlessResult(this, this.wave, this.wisdomBonuses.crystalEarnMult, this.killsThisRun, this.goldEarnedThisRun);
  }

  // ─── Achievement system ────────────────────────────────────────────────────

  checkAchievementsAndToast(gs: ReturnType<typeof loadGameState>): void {
    _checkAchievementsAndToast(buildQuestTrackerCtx(this), gs);
  }

  tickQuestAndNotify(gs: ReturnType<typeof loadGameState>, type: ObjectiveType, amount = 1): ReturnType<typeof loadGameState> {
    return _tickQuestAndNotify(buildQuestTrackerCtx(this), gs, type, amount);
  }

  private trackConsecutiveDays(): void {
    _trackConsecutiveDays();
  }

  // ─── Chapter 3: Medicine Hall healing ─────────────────────────────────────

  medicineHealTick = 0;
  medicineGlobalPulseLast = 0;

  // ─── Chapter 3: POISON_TRAIL room damage ───────────────────────────────────

  poisonDamageTick = 0;

  // ─── Ch4: ENTRANCING_VEIL — while celestial_dancer placed, slow all invaders ─

  entrancingVeilApplied = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT INTERACTION SUBSYSTEMS
  // ═══════════════════════════════════════════════════════════════════════════

  private initSkillHUD(gameState: ReturnType<typeof loadGameState>): void {
    _initSkillHUD(buildGameplayInitCtx(this), gameState);
  }

  private initSwapManager(): void {
    _initSwapManager(buildGameplayInitCtx(this));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNERGY SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /** Recalculate active tribe synergies and element combos from placed monsters. */
  // ─── Room Durability ──────────────────────────────────────────────────────

}
