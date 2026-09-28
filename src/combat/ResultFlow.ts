import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { CASUAL } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_Y } from '../constants/layout';
import { startPrepCountdown } from './WaveLifecycle';
import type { RoomData } from '../data/rooms';
import { loadGameState, type WisdomBonuses, saveGameState } from '../data/wisdom';
import { applyDailyChallengeTick, waveDailyChallengeTicks } from '../data/daily';
import { MONSTER_DEFS } from '../data/monsters';
import { type DailyDungeon, type WeeklyBoss } from '../data/daily';
import { logger } from '../utils/logger';
import { showResultPanel } from './ResultPanel';

// ── Context interface ─────────────────────────────────────────────────────────

export interface ResultFlowContext {
  scene: Phaser.Scene;

  // Grid dimensions
  effectiveCols: number;
  effectiveCellSize: number;

  // Player / game state
  dungeonHp: number;
  maxHp: number;
  gold: number;
  gems: number;
  /** Ad revives used this battle (limit AD_REVIVES_PER_BATTLE). */
  adRevivesUsed: number;
  wave: number;
  maxWave: number;
  stageChapter: number;
  isEndless: boolean;
  waveActive: boolean;
  killsThisRun: number;
  killsThisWave: number;
  breakthruCount: number;
  goldEarnedThisRun: number;
  materialsEarnedThisRun: Record<string, number>;
  waveGoldMult: number;
  waveEndChecked: boolean;
  waveHasSpawned: boolean;
  prepActive: boolean;
  prepTimer: number;
  returnTo?: string;
  dailyMode: DailyDungeon | null;
  weeklyBossMode: WeeklyBoss | null;
  wisdomBonuses: WisdomBonuses;

  // Wave configs
  waveConfigs: ReadonlyArray<{
    clearReward?: number;
    invaders?: ReadonlyArray<{ type: string; count: number; isBoss?: boolean }>;
  }>;

  // Dungeon slot tracking
  dungeonTrapSlots: ReadonlyArray<{ hp: number; maxHp: number } | null>;
  waveStartSlotHps: number[];

  // Active invaders
  activeInvaders: Array<{ active: boolean; destroy: () => void }>;

  // UI refs
  waveBtnBg: Phaser.GameObjects.Graphics;
  waveBtnZone: Phaser.GameObjects.Zone;
  waveLabel: Phaser.GameObjects.Text;
  resultOverlay?: Phaser.GameObjects.Container;
  countdownBar?: Phaser.GameObjects.Graphics;
  rooms: Array<Array<{ x: number; y: number; updateHpBar: () => void }>>;
  roomGrid: (RoomData | null)[][];

  // Callbacks
  drawBtn: (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean) => void;
  startWave: () => void;
  grantMonsterXp: (amount: number) => void;
  saveRoomHpsToGameState: () => void;
  showFloatText: (x: number, y: number, text: string, color: string) => void;
  showEndlessResult: () => void;
  checkAchievementsAndToast: (gs: ReturnType<typeof loadGameState>) => void;
  tickQuestAndNotify: (gs: ReturnType<typeof loadGameState>, type: string, amount?: number) => ReturnType<typeof loadGameState>;

  // Mutators — update ctx properties and registry together
  setDungeonHp: (hp: number) => void;
  setGold: (gold: number) => void;
  setGems: (gems: number) => void;
  setAdRevivesUsed: (count: number) => void;
  setWave: (wave: number) => void;
  setWaveActive: (active: boolean) => void;
  setWaveEndChecked: (v: boolean) => void;
  setWaveHasSpawned: (v: boolean) => void;
  setPrepActive: (v: boolean) => void;
  setPrepTimer: (v: number) => void;
  setResultOverlay: (ov: Phaser.GameObjects.Container | undefined) => void;
  setCountdownBar: (bar: Phaser.GameObjects.Graphics | undefined) => void;
}

// ── showWaveClear ─────────────────────────────────────────────────────────────

/**
 * Credit the daily challenges a cleared wave satisfies.
 *
 * Only `skill_use` was ever ticked (DungeonScene.activateSkill). The other four
 * objective types had no production call site at all, so 50 of the 59 challenge
 * templates could never be completed and the panel advertised them anyway:
 *   tribe_only 24 · kill_count 11 · wave_clear 10 · no_damage 5 · skill_use 9
 *
 * Everything is credited once per wave rather than per kill — a load/save per
 * kill would run hundreds of times a wave.
 */
function tickWaveDailyChallenges(ctx: ResultFlowContext): void {
  const tribes = new Set<string>();
  for (const row of ctx.roomGrid) {
    for (const data of row) {
      for (const monsterId of data?.monsterSlots ?? []) {
        const tribe = monsterId ? MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS]?.tribe : undefined;
        if (tribe) tribes.add(tribe);
      }
    }
  }

  let gs = loadGameState();
  let changed = false;
  for (const tick of waveDailyChallengeTicks({
    kills: ctx.killsThisWave,
    breakthroughs: ctx.breakthruCount,
    tribesOnBoard: [...tribes],
  })) {
    const result = applyDailyChallengeTick(gs, tick.type, tick.amount, tick.filter);
    gs = result.state;
    changed = changed || result.changed;
  }
  if (changed) saveGameState(gs);
}

export function showWaveClear(ctx: ResultFlowContext): void {
  const waveCfgReward = ctx.waveConfigs[ctx.wave - 1]?.clearReward;
  const fallback = 50 + ctx.wave * 10 + (ctx.stageChapter - 1) * 40;
  const dailyGold = ctx.dailyMode?.modifiers.goldMult ?? 1;
  const reward = Math.round((waveCfgReward ?? fallback) * ctx.wisdomBonuses.waveRewardMult * ctx.waveGoldMult * dailyGold);
  ctx.setGold(ctx.gold + reward);
  ctx.showFloatText(CANVAS_WIDTH / 2, GRID_Y + 30, `+${reward} 골드`, '#ffc63a');
  audioManager.playSfx('wave_clear');

  tickWaveDailyChallenges(ctx);

  const stars = ctx.dungeonHp / ctx.maxHp > 0.8 ? 3
              : ctx.dungeonHp / ctx.maxHp > 0.4 ? 2 : 1;

  // Wave participation XP
  ctx.grantMonsterXp(10);

  // ── Wave clear visual flourish: golden border flash + coin burst ──────────
  _spawnWaveClearFlair(ctx.scene, reward);

  logger.debug(`[WAVE CLEAR] reward=${reward}g stars=${stars}`);
  showResultPanel(ctx, false, reward, stars);
  startPrepCountdown(ctx);
}

function _spawnWaveClearFlair(scene: Phaser.Scene, reward: number): void {
  // Golden border flash that pulses and fades
  const border = scene.add.graphics().setDepth(295).setAlpha(0);
  border.lineStyle(6, CASUAL.GOLD, 1);
  border.strokeRect(3, 3, CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6);
  scene.tweens.add({
    targets: border,
    alpha: { from: 0, to: 0.85 },
    duration: 120,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
    onComplete: () => border.destroy(),
  });

  // Coin burst: 4 golden coins flying upward from center-bottom of grid
  const gridBottom = GRID_Y + 4 * (CANVAS_WIDTH < 400 ? 110 : 82);  // approx
  const coinCount  = Math.min(4, 2 + Math.floor(reward / 100));
  for (let i = 0; i < coinCount; i++) {
    const coin = scene.add.graphics().setDepth(290);
    coin.fillStyle(CASUAL.GOLD, 1);
    coin.fillCircle(0, 0, 4.5);
    coin.fillStyle(0xffe066, 0.6);
    coin.fillCircle(-1.5, -1.5, 2);
    const startX = CANVAS_WIDTH / 2 + (i - coinCount / 2 + 0.5) * 22;
    coin.setPosition(startX, gridBottom - 10);
    scene.tweens.add({
      targets: coin,
      x: CANVAS_WIDTH / 2 + (Math.random() * 80 - 40),
      y: gridBottom - 90 - Math.random() * 40,
      scaleX: 0.4,
      scaleY: 0.4,
      alpha: { from: 1, to: 0 },
      duration: 550 + i * 60,
      ease: 'Power2.easeOut',
      delay: i * 45,
      onComplete: () => coin.destroy(),
    });
  }
}

// ── triggerWaveFail ───────────────────────────────────────────────────────────

export function triggerWaveFail(ctx: ResultFlowContext): void {
  audioManager.playSfx('defeat');
  ctx.setWaveActive(false);
  ctx.activeInvaders.forEach(i => { if (i.active) i.destroy(); });
  ctx.activeInvaders.length = 0;
  ctx.saveRoomHpsToGameState();

  // Screen shake
  ctx.scene.cameras.main.shake(600, 0.02);

  // Red vignette
  const vig = ctx.scene.add.graphics().setDepth(290);
  vig.fillStyle(CASUAL.RED, 0.5);
  vig.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.scene.tweens.add({ targets: vig, alpha: 0, duration: 600 });

  if (ctx.isEndless) {
    logger.debug(`[ENDLESS FAIL] wave=${ctx.wave} kills=${ctx.killsThisRun}`);
    ctx.scene.time.delayedCall(700, () => ctx.showEndlessResult());
  } else {
    logger.debug('[WAVE FAIL] dungeonHP=0');
    showResultPanel(ctx, true, 0, 0);
  }
}
