import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { RoomSelectionPanel }  from '../ui/RoomSelectionPanel';
import { MonsterSelectPanel }  from '../ui/MonsterSelectPanel';
import { RoomUpgradePanel }    from '../ui/RoomUpgradePanel';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import {
  CANVAS_HEIGHT, CANVAS_WIDTH,
  GRID_COLS, GRID_ROWS, CELL_SIZE, GRID_Y,
} from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { type RoomData, type RoomType } from '../data/rooms';
import { resolveMonsterDef, type MonsterId } from '../data/monsters';
import type { InvaderType, InvaderDef } from '../data/invaders';
import { type WaveSpec } from '../data/stages';
import { loadGameState, saveGameState, getWisdomBonuses, getPrestigeDmgMult, type WisdomBonuses } from '../data/wisdom';
import { computeDecorationBonuses, EMPTY_BONUSES, type DecorationBonuses } from '../data/decorations';
import { type EquipmentStats } from '../data/barracks';
import { applyDailyChallengeTick, type DailyDungeon, type WeeklyBoss } from '../data/daily';
import type { ObjectiveType } from '../data/quests';
import { STAGE_CONFIGS } from '../data/stageProgress';
import { applyChapterTheme } from './ChapterTheme';
import { resolveStageSetup, buildEquipmentMap } from '../combat/DungeonSceneInit';
import { SkillHUD } from '../combat/SkillHUD';
import { MonsterSwapManager } from '../combat/MonsterSwap';
import { SynergyManager } from '../combat/SynergyManager';
import { processSpawnQueue as _processSpawnQueue, spawnInvaderByType as _spawnInvaderByType } from '../combat/SpawnPipeline';
import { showSkillPopup as _showSkillPopup } from '../combat/SkillPopup';
import { handleInvaderKilled as _handleInvaderKilled } from '../combat/KillHandler';
import { spawnBuildParticles as _spawnBuildParticles, showRangePreview as _showRangePreview, hideRangePreview as _hideRangePreview } from '../combat/RoomVfx';
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
  runLunarRhythm as _runLunarRhythm,
  runExtraMonsterAttacks as _runExtraMonsterAttacks,
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
  deployDungeonSlotsToGrid,
  type DungeonSlotDeploymentSummary,
} from '../combat/DungeonLayout';
import { activateSkillEffect } from '../combat/ActiveSkills';
import { BossHud } from '../combat/BossHud';
import { startWave as _startWave } from '../combat/WaveStart';
import { showWaveEnemyPreview as _showWaveEnemyPreview, showEndlessMilestoneToast as _showEndlessMilestoneToast, showEndlessResult as _showEndlessResult, checkWaveEnd as _checkWaveEnd } from '../combat/WaveLifecycle';
import { placeRoom as _placeRoom, assignMonster as _assignMonster, upgradeRoom as _upgradeRoom } from '../combat/RoomActions';
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
  findTarget as _findTarget,
  resolveAttack as _resolveAttack,
} from '../combat/CombatResolver';
import {
  buildRoomInputCtx,
  buildActiveSkillContext,
  buildRoomActionsCtx,
  buildWaveStartCtx,
  buildSpawnPipelineCtx,
  buildCombatResolverCtx,
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

  // ── UI ─────────────────────────────────────────────────────────────────────
  panel!:         RoomSelectionPanel;
  monsterPanel!:  MonsterSelectPanel;
  upgradePanel!:  RoomUpgradePanel;
  selectedRoom:   Room | null = null;
  unlockedStage   = 1;        // Chapter 1 start
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
  private commandStrip?: Phaser.GameObjects.Container;

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
  gold      = 500;
  startGold = 500;
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
  // Extra monster attack cooldowns: key = `${row}_${col}_${slotIdx}` → lastAttackTime ms
  extraMonsterCooldowns = new Map<string, number>();
  /** Per-slot trap damage synergy multiplier (populated by recalcRoomTypeBonuses) */
  slotTrapSynergyMult  = new Map<number, number>();

  // Theme
  theme!: DungeonTheme;

  // ── Battle speed ─────────────────────────────────────────────────────────
  speedMult: 1 | 2 = 1;

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
    // ── Wisdom bonuses ────────────────────────────────────────────────────────
    const gameState       = loadGameState();
    this.wisdomBonuses    = getWisdomBonuses(gameState);
    this.prestigeDmgMult  = getPrestigeDmgMult(gameState);
    this.synergyManager   = new SynergyManager(this);
    this.dungeonTrapSlots = gameState.dungeonSlots ?? [];
    this.decorationBonuses = computeDecorationBonuses(gameState.placedDecorations);

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
    this.selectedRoom    = null;
    this.killsThisRun    = 0;
    this.goldEarnedThisRun = 0;
    this.endlessRecordBroken = false;
    this.skillCooldowns.clear();

    // Load unlockedStage from STAGE_CONFIGS so the monster picker shows correct options
    this.unlockedStage = STAGE_CONFIGS.find(s => s.stageNumber === setup.stageNumber)?.unlockedStage ?? setup.stageNumber;

    logger.debug(`[WISDOM] startingGold: ${this.gold}, maxHp: ${this.maxHp}, slots: ${this.baseSlots + this.wisdomBonuses.extraSlots}`);

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
    this.buildPanel();
    this.buildMonsterPanel();
    this.buildUpgradePanel();
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
  }

  // ── FPS monitor (dev mode) ─────────────────────────────────────────────────
  private fpsText?: Phaser.GameObjects.Text;

  update(_time: number, _delta: number): void {
    if (!this.waveActive) return;
    const rmCtx = buildRoomMechanicsCtx(this);
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

  private deployDungeonSlots(): DungeonSlotDeploymentSummary {
    const summary = deployDungeonSlotsToGrid({
      rooms:             this.rooms,
      roomGrid:          this.roomGrid,
      effectiveCols:     this.effectiveCols,
      dungeonTrapSlots:  this.dungeonTrapSlots,
      equipmentMap:      this.equipmentMap,
    });

    if (summary.builtRooms > 0) {
      this.synergyManager.recalc(this.roomGrid, this.effectiveCols);
      _recalcRoomTypeBonuses(buildRoomMechanicsCtx(this));
    }

    return summary;
  }

  private showDungeonDeploymentToast(summary: DungeonSlotDeploymentSummary): void {
    if (summary.builtRooms <= 0) return;
    const toastY = GRID_Y + GRID_ROWS * this.effectiveCellSize + 5;

    const toast = this.add.text(
      CANVAS_WIDTH / 2,
      toastY,
      `던전 전개 완료 · 방 ${summary.builtRooms} · 수호자 ${summary.assignedMonsters} · 장비 ${summary.equippedMonsters} · 함정 ${summary.activeTraps}`,
      {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: summary.brokenRooms > 0 ? CASUAL_CSS.RED : CASUAL_CSS.INK,
        backgroundColor: CASUAL_CSS.CREAM,
        padding: { x: 10, y: 5 },
      },
    ).setOrigin(0.5).setDepth(120).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 0.94 },
      y: toastY - 6,
      duration: 220,
      ease: 'Cubic.easeOut',
      yoyo: true,
      hold: 1250,
      onComplete: () => toast.destroy(),
    });
  }

  private buildDungeonCommandStrip(summary: DungeonSlotDeploymentSummary): void {
    this.commandStrip?.destroy();
    if (summary.builtRooms <= 0) return;

    const builtSlots = this.dungeonTrapSlots.filter(slot => Boolean(slot.roomType));
    const totalMaxHp = builtSlots.reduce((sum, slot) => sum + Math.max(1, slot.maxHp), 0);
    const totalHp = builtSlots.reduce((sum, slot) => sum + Phaser.Math.Clamp(slot.hp, 0, Math.max(1, slot.maxHp)), 0);
    const durability = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : 100;
    const warning = summary.brokenRooms > 0
      ? `파손${summary.brokenRooms}`
      : summary.assignedMonsters <= 0
        ? '수호 없음'
        : durability < 50
          ? '수리'
          : '준비';
    const isWarning = summary.brokenRooms > 0 || durability < 50 || summary.assignedMonsters <= 0;
    const warningColor = isWarning ? CASUAL.RED : CASUAL.GREEN;

    const y = GRID_Y - 8;
    const strip = this.add.container(CANVAS_WIDTH / 2, y).setDepth(76).setAlpha(0);
    const g = this.add.graphics();
    const w = CANVAS_WIDTH - 24;
    const h = 22;
    // Cream strip with chunky brown edge + white top highlight (casual toy look).
    g.fillStyle(CASUAL.SHADOW, 0.18);
    g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 8);
    g.fillStyle(CASUAL.PANEL, 0.98);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2, CASUAL.EDGE, 0.92);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(-w / 2 + 6, -h / 2 + 3, w - 12, 3, 2);
    strip.add(g);

    const title = this.add.text(-w / 2 + 12, 0, '방어 진형', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);
    strip.add(title);

    this.addCommandStripChip(strip, -98, `방${summary.builtRooms}`, CASUAL.BLUE, CASUAL_CSS.BLUE);
    this.addCommandStripChip(strip, -50, `수호${summary.assignedMonsters}`, CASUAL.RED, CASUAL_CSS.RED);
    this.addCommandStripChip(strip, 2, `함정${summary.activeTraps}`, CASUAL.GREEN, CASUAL_CSS.GREEN);
    this.addCommandStripChip(strip, 57, `장비${summary.equippedMonsters}`,
      summary.equippedMonsters > 0 ? CASUAL.GOLD : CASUAL.EDGE_SOFT,
      summary.equippedMonsters > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT);
    this.addCommandStripChip(strip, 115, `내구${durability}%`,
      durability < 50 ? CASUAL.RED : CASUAL.GOLD,
      durability < 50 ? CASUAL_CSS.RED : CASUAL_CSS.GOLD);
    this.addCommandStripChip(strip, 172, warning, warningColor,
      isWarning ? CASUAL_CSS.RED : CASUAL_CSS.WHITE, true, !isWarning);

    this.commandStrip = strip;
    this.tweens.add({
      targets: strip,
      alpha: { from: 0, to: 0.96 },
      y: y - 2,
      duration: 220,
      ease: 'Cubic.easeOut',
    });
  }

  private addCommandStripChip(
    strip: Phaser.GameObjects.Container,
    x: number,
    label: string,
    accent: number,
    textColor: string,
    alignRight = false,
    candy = false,
  ): void {
    const text = this.add.text(x, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      fontStyle: 'bold',
      // Candy "ready" pill gets white-on-saturated text; stat pills get their
      // saturated accent value as the label color over a cream body.
      color: candy ? CASUAL_CSS.WHITE : textColor,
    }).setOrigin(alignRight ? 1 : 0.5, 0.5);
    const b = text.getBounds();
    const padX = 8;
    const chipW = b.width + padX * 2;
    const chipX = alignRight ? x - b.width - padX * 2 : x - b.width / 2 - padX;
    const bg = this.add.graphics();
    if (candy) {
      // Bright saturated candy pill (GREEN/GOLD when ready) with white highlight.
      bg.fillStyle(CASUAL.SHADOW, 0.22);
      bg.fillRoundedRect(chipX, -7, chipW, 16, 6);
      bg.fillStyle(accent, 1);
      bg.fillRoundedRect(chipX, -8, chipW, 16, 6);
      bg.lineStyle(2, CASUAL.EDGE, 0.85);
      bg.strokeRoundedRect(chipX, -8, chipW, 16, 6);
      bg.fillStyle(0xffffff, 0.12);
      bg.fillRoundedRect(chipX + 4, -6, chipW - 8, 3, 2);
    } else {
      // Cream stat pill: PANEL_SOFT body + 2px EDGE border + white top highlight.
      bg.fillStyle(CASUAL.PANEL_SOFT, 0.98);
      bg.fillRoundedRect(chipX, -8, chipW, 16, 6);
      bg.lineStyle(2, CASUAL.EDGE, 0.55);
      bg.strokeRoundedRect(chipX, -8, chipW, 16, 6);
      bg.fillStyle(0xffffff, 0.14);
      bg.fillRoundedRect(chipX + 4, -6, chipW - 8, 3, 2);
    }
    strip.add(bg);
    strip.add(text);
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

  private placeRoom(row: number, col: number, type: RoomType): void {
    _placeRoom(buildRoomActionsCtx(this), row, col, type);
  }

  private assignMonster(row: number, col: number, id: MonsterId): void {
    _assignMonster(buildRoomActionsCtx(this), row, col, id);
  }

  private upgradeRoom(row: number, col: number): void {
    _upgradeRoom(buildRoomActionsCtx(this), row, col);
  }

  // ─── Build particles ──────────────────────────────────────────────────────

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

  spawnBuildParticles(x: number, y: number): void {
    _spawnBuildParticles(this, x, y);
  }

  // ─── Wave Flow ────────────────────────────────────────────────────────────

  startWave(): void {
    _startWave(buildWaveStartCtx(this));
  }

  processSpawnQueue(initialDelay: number): void {
    _processSpawnQueue(buildSpawnPipelineCtx(this), initialDelay);
  }

  spawnInvader(type: InvaderType): void {
    _spawnInvaderByType(buildSpawnPipelineCtx(this), type);
  }

  /** Brief enemy-type summary pill shown just after the wave banner slides in. */
  _showWaveEnemyPreview(): void {
    _showWaveEnemyPreview(this, this.waveConfigs, this.wave);
  }

  // ─── Combat (update loop) ─────────────────────────────────────────────────

  private runCombat(now: number, rmCtx: RoomMechanicsContext): void {
    const cs  = this.effectiveCellSize;
    const ctx = buildCombatResolverCtx(this);
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


  private setSpeed(mult: 1 | 2): void {
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

  // ─── Gold Vein passive income ─────────────────────────────────────────────

  goldTick = 0;

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
    _handleInvaderKilled(buildKillHandlerCtx(this), inv);
  }

  // ─── invaderReachedEnd ────────────────────────────────────────────────────────

  private handleInvaderReachedEnd(inv: Invader): void {
    _handleInvaderReachedEnd(buildBattleEventCtx(this), inv);
  }

  // ─── mirrorReflect ────────────────────────────────────────────────────────────

  private handleMirrorReflect(reflectDmg: number): void {
    _handleMirrorReflect(buildBattleEventCtx(this), reflectDmg);
  }

  // ─── invaderKilledRow (GILDED_KILL) ──────────────────────────────────────────

  private handleInvaderKilledRow(invRow: number): void {
    _handleInvaderKilledRow(buildBattleEventCtx(this), invRow);
  }

  // ─── permafrostShatter ────────────────────────────────────────────────────────

  private handlePermafrostShatter(source: Invader): void {
    _handlePermafrostShatter(buildBattleEventCtx(this), source);
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
