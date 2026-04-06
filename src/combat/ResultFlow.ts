import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_ROWS, GRID_Y } from '../constants/layout';
import { MATERIAL_DEFS } from '../data/fusion';
import { ROOM_DEFS, type RoomData } from '../data/rooms';
import { loadGameState, saveGameState, type WisdomBonuses } from '../data/wisdom';
import { getTodayString, getThisWeekMonday, type DailyDungeon, type WeeklyBoss } from '../data/daily';
import { recordClear, STAGE_CONFIGS } from '../scenes/StageSelectScene';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';

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
  startGold: number;
  gems: number;
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
  waveConfigs: ReadonlyArray<{ clearReward?: number }>;

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
  tickQuestAndNotify: (gs: ReturnType<typeof loadGameState>, type: string) => void;

  // Mutators — update ctx properties and registry together
  setDungeonHp: (hp: number) => void;
  setGold: (gold: number) => void;
  setGems: (gems: number) => void;
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

export function showWaveClear(ctx: ResultFlowContext): void {
  const waveCfgReward = ctx.waveConfigs[ctx.wave - 1]?.clearReward;
  const fallback = 50 + ctx.wave * 10 + (ctx.stageChapter - 1) * 40;
  const dailyGold = ctx.dailyMode?.modifiers.goldMult ?? 1;
  const reward = Math.round((waveCfgReward ?? fallback) * ctx.wisdomBonuses.waveRewardMult * ctx.waveGoldMult * dailyGold);
  ctx.setGold(ctx.gold + reward);
  audioManager.playSfx('wave_clear');

  const stars = ctx.dungeonHp / ctx.maxHp > 0.8 ? 3
              : ctx.dungeonHp / ctx.maxHp > 0.4 ? 2 : 1;

  // Wave participation XP
  ctx.grantMonsterXp(10);

  logger.debug(`[WAVE CLEAR] reward=${reward}g stars=${stars}`);
  showResultPanel(ctx, false, reward, stars);
  startPrepCountdown(ctx);
}

// ── showResultPanel ───────────────────────────────────────────────────────────

export function showResultPanel(ctx: ResultFlowContext, isFail: boolean, reward: number, stars: number): void {
  const scene = ctx.scene;
  if (ctx.resultOverlay) ctx.resultOverlay.destroy();
  const ov = scene.add.container(0, 0).setDepth(300);
  ctx.setResultOverlay(ov);

  // Compute wave stat summary
  const damagedCount = ctx.dungeonTrapSlots.filter(
    (s, i) => s && (ctx.waveStartSlotHps[i] ?? s.hp) > s.hp,
  ).length;
  const destroyedCount = ctx.dungeonTrapSlots.filter(s => s && s.hp <= 0).length;

  // Dim overlay
  const dim = scene.add.graphics();
  dim.fillStyle(isFail ? COLORS.BLOOD_RED : COLORS.BLACK, 0.7);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 400 });

  // Card — taller to fit stats
  const cw = 300;
  const statsH = 60;
  const ch = isFail ? 220 : 200 + statsH;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;

  const card = scene.add.graphics();
  card.fillStyle(COLORS.STONE_DARK, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 10);
  card.lineStyle(2, isFail ? COLORS.BLOOD_GLOW : COLORS.TORCH_GOLD, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 10);
  card.setY(-80).setAlpha(0);
  ov.add(card);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 350, ease: 'Power2.easeOut' });

  const title = isFail ? '던전 함락!' : '침입자 격퇴!';
  const titleColor = isFail ? CSS.BLOOD_GLOW : CSS.TORCH_AMBER;
  const titleT = scene.add.text(CANVAS_WIDTH / 2, cy + 30, title, {
    fontFamily: "Georgia, serif", fontSize: '24px', fontStyle: 'bold', color: titleColor,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(titleT);
  scene.tweens.add({ targets: titleT, alpha: 1, duration: 300, delay: 200 });

  if (!isFail) {
    buildSuccessContent(ctx, ov, cx, cy, cw, ch, stars, reward, damagedCount, destroyedCount);
  } else {
    buildFailContent(ctx, ov, cx, cy, cw);
  }
}

function buildSuccessContent(
  ctx: ResultFlowContext,
  ov: Phaser.GameObjects.Container,
  cx: number, cy: number, cw: number, ch: number,
  stars: number, reward: number,
  damagedCount: number, destroyedCount: number,
): void {
  const scene = ctx.scene;

  // Stars
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const starsT = scene.add.text(CANVAS_WIDTH / 2, cy + 68, starStr, {
    fontFamily: 'sans-serif', fontSize: '22px', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(starsT);
  scene.tweens.add({ targets: starsT, alpha: 1, duration: 300, delay: 350 });

  // Reward
  const rewardT = scene.add.text(CANVAS_WIDTH / 2, cy + 106, `황금 보상  +${reward}💰`, {
    fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(rewardT);
  scene.tweens.add({ targets: rewardT, alpha: 1, duration: 300, delay: 450 });

  // Wave stat row
  const statY = cy + 138;
  const statDivider = scene.add.graphics().setAlpha(0);
  statDivider.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
  statDivider.lineBetween(cx + 16, statY - 10, cx + cw - 16, statY - 10);
  ov.add(statDivider);
  scene.tweens.add({ targets: statDivider, alpha: 1, duration: 200, delay: 480 });

  const statItems = [
    { icon: '⚔', label: '격퇴', value: String(ctx.killsThisWave),   color: '#88ff88' },
    { icon: '💥', label: '돌파', value: String(ctx.breakthruCount),  color: ctx.breakthruCount > 0 ? '#ff8888' : '#888888' },
    { icon: '🏚', label: '손상 방', value: `${damagedCount}칸`,       color: damagedCount > 0 ? '#ffbb44' : '#888888' },
  ];
  const colW = cw / 3;
  statItems.forEach(({ icon, label, value, color }, i) => {
    const sx = cx + colW * i + colW / 2;
    const iconT = scene.add.text(sx, statY + 4, icon, {
      fontFamily: 'sans-serif', fontSize: '16px',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(iconT);
    scene.tweens.add({ targets: iconT, alpha: 1, duration: 200, delay: 520 + i * 60 });

    const valT = scene.add.text(sx, statY + 24, value, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(valT);
    scene.tweens.add({ targets: valT, alpha: 1, duration: 200, delay: 540 + i * 60 });

    const lblT = scene.add.text(sx, statY + 40, label, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(lblT);
    scene.tweens.add({ targets: lblT, alpha: 1, duration: 200, delay: 560 + i * 60 });
  });

  // Destroyed room warning
  if (destroyedCount > 0) {
    const warnT = scene.add.text(CANVAS_WIDTH / 2, statY + 60,
      `⚠ 파손된 방 ${destroyedCount}칸 — 홈에서 수리 필요`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ff6666',
      backgroundColor: '#1a0000', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setAlpha(0);
    ov.add(warnT);
    scene.tweens.add({ targets: warnT, alpha: 1, duration: 200, delay: 680 });
  }

  const wave = ctx.wave;
  const btnT = scene.add.text(CANVAS_WIDTH / 2, cy + ch - 40, `다음 침략 준비 (${wave + 1}/${ctx.maxWave})`, {
    fontFamily: "Georgia, serif", fontSize: '13px', color: CSS.PARCHMENT,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(btnT);
  scene.tweens.add({ targets: btnT, alpha: 1, duration: 300, delay: 700 });

  const btnZone = scene.add.zone(CANVAS_WIDTH / 2, cy + ch - 40, 280, 36).setInteractive();
  ov.add(btnZone);
  btnZone.on('pointerdown', () => {
    ov.destroy();
    ctx.setResultOverlay(undefined);
    ctx.setPrepActive(false);
    enableWaveButton(ctx);
  });
}

function buildFailContent(
  ctx: ResultFlowContext,
  ov: Phaser.GameObjects.Container,
  cx: number, cy: number, cw: number,
): void {
  const scene = ctx.scene;

  const failMsg = scene.add.text(CANVAS_WIDTH / 2, cy + 72, '던전이 함락되었습니다', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(failMsg);
  scene.tweens.add({ targets: failMsg, alpha: 1, duration: 300, delay: 200 });

  const options: Array<{ label: string; action: () => void }> = [
    ...(ctx.returnTo ? [{
      label: '🏰  던전으로 귀환',
      action: () => {
        scene.registry.set('battleResult', { won: false, goldEarned: ctx.gold, dmXP: 30, materialsEarned: { ...ctx.materialsEarnedThisRun } });
        ov.destroy();
        scene.scene.start('DungeonHomeScene');
      },
    }] : []),
    { label: '광고 보기 (부활)',      action: () => revive(ctx, 0) },
    { label: '💎 5보석으로 부활',     action: () => revive(ctx, 5) },
    { label: '처음부터',              action: () => resetStage(ctx) },
  ];
  options.forEach(({ label, action }, i) => {
    const oy = cy + 110 + i * 38;
    const ob = scene.add.graphics();
    ob.fillStyle(i === 2 ? COLORS.STONE_MID : COLORS.BLOOD_RED, 0.7);
    ob.fillRoundedRect(cx + 20, oy - 14, cw - 40, 30, 5);
    ov.add(ob);
    const ot = scene.add.text(CANVAS_WIDTH / 2, oy, label, {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(ot);
    scene.tweens.add({ targets: ot, alpha: 1, duration: 250, delay: 250 + i * 80 });
    const oz = scene.add.zone(CANVAS_WIDTH / 2, oy, cw - 40, 30).setInteractive();
    ov.add(oz);
    oz.on('pointerdown', () => { ov.destroy(); ctx.setResultOverlay(undefined); action(); });
  });
}

// ── enableWaveButton ──────────────────────────────────────────────────────────

export function enableWaveButton(ctx: ResultFlowContext): void {
  const bw = 270, bh = 48;
  const bx = CANVAS_WIDTH / 2 - bw / 2;
  const by = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 20;
  ctx.setWaveEndChecked(false);
  ctx.setWaveHasSpawned(false);
  ctx.drawBtn(ctx.waveBtnBg, bx, by, bw, bh, false);
  ctx.waveBtnBg.setAlpha(1);
  ctx.waveBtnZone.setInteractive();
  ctx.waveLabel.setText('⚔  침략 시작').setColor(CSS.PARCHMENT);
}

// ── startPrepCountdown ────────────────────────────────────────────────────────

export function startPrepCountdown(ctx: ResultFlowContext): void {
  const scene = ctx.scene;
  ctx.setPrepActive(true);
  ctx.setPrepTimer(10);

  if (!ctx.countdownBar) {
    const barBg = scene.add.graphics().setDepth(70);
    const bx = CANVAS_WIDTH / 2 - 130;
    const by = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 78;
    barBg.fillStyle(COLORS.STONE_DARK, 1);
    barBg.fillRoundedRect(bx, by, 260, 10, 3);
    ctx.setCountdownBar(scene.add.graphics().setDepth(71));
  }

  const tick = () => {
    ctx.setPrepTimer(ctx.prepTimer - 1);
    const bx = CANVAS_WIDTH / 2 - 130;
    const by = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 78;
    ctx.countdownBar!.clear();
    ctx.countdownBar!.fillStyle(COLORS.TORCH_GOLD, 0.8);
    ctx.countdownBar!.fillRoundedRect(bx, by, 260 * (ctx.prepTimer / 10), 10, 3);
    scene.registry.set('status', `다음 침략까지 ${ctx.prepTimer}초`);

    if (ctx.prepTimer <= 0) {
      ctx.setPrepActive(false);
      ctx.countdownBar!.clear();
      scene.registry.set('status', '');
      ctx.setWaveEndChecked(false);
      enableWaveButton(ctx);
    } else {
      scene.time.delayedCall(1000, tick);
    }
  };
  scene.time.delayedCall(1000, tick);
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
  vig.fillStyle(COLORS.BLOOD_RED, 0.5);
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

// ── revive ────────────────────────────────────────────────────────────────────

export function revive(ctx: ResultFlowContext, gemCost: number): void {
  if (gemCost > 0 && ctx.gems < gemCost) {
    ctx.scene.registry.set('status', '보석 부족!');
    return;
  }
  if (gemCost > 0) {
    ctx.setGems(ctx.gems - gemCost);
  } else {
    logger.debug('[AD] watch_ad triggered');
  }
  ctx.setDungeonHp(Math.round(ctx.maxHp * 0.5));
  ctx.setWaveEndChecked(false);
  ctx.setWave(ctx.wave - 1); // pre-decrement so startWave's ++ lands on the same wave
  ctx.startWave();
}

// ── resetStage ────────────────────────────────────────────────────────────────

export function resetStage(ctx: ResultFlowContext): void {
  ctx.setWave(0);
  ctx.setDungeonHp(ctx.maxHp);
  ctx.setGold(ctx.startGold);
  ctx.activeInvaders.length = 0;
  ctx.setWaveEndChecked(false);
  enableWaveButton(ctx);
  logger.debug('[RESET] stage reset');
}

// ── showChapterClear ──────────────────────────────────────────────────────────

export function showChapterClear(ctx: ResultFlowContext): void {
  const scene = ctx.scene;
  audioManager.playSfx('victory');
  const baseCrystals = 5 + ctx.wisdomBonuses.crystalPerWave;
  const crystals     = Math.round(baseCrystals * ctx.wisdomBonuses.crystalEarnMult);
  const stars        = ctx.dungeonHp / ctx.maxHp > 0.8 ? 3
                     : ctx.dungeonHp / ctx.maxHp > 0.4 ? 2 : 1;
  scene.registry.set('soulCrystals', crystals);

  // Persist soul crystals to GameState
  const gs = loadGameState();
  gs.soulCrystals += crystals;
  // Also persist star progress — skip for invasion battles (no stageNumber)
  const stageCfg = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  const stageNum = stageCfg?.stageNumber;
  if (stageNum !== undefined) {
    const stageIdx = stageNum - 1;
    if (gs.stageProgress[stageIdx]) {
      gs.stageProgress[stageIdx].bestStars = Math.max(gs.stageProgress[stageIdx].bestStars, stars);
    }
    if (stageIdx + 1 < gs.stageProgress.length) gs.stageProgress[stageIdx + 1].unlocked = true;
  }
  ctx.tickQuestAndNotify(gs, 'complete_stage');

  // Daily dungeon clear
  if (ctx.dailyMode) {
    const today = getTodayString();
    gs.dailyDungeonCompleted = today;
    gs.soulCrystals += ctx.dailyMode.rewards.crystals;
    for (const matId of ctx.dailyMode.rewards.materials) {
      gs.materials[matId] = (gs.materials[matId] ?? 0) + 1;
    }
  }

  // Weekly boss clear
  if (ctx.weeklyBossMode) {
    const thisWeek = getThisWeekMonday();
    if (gs.weeklyBossResetDate !== thisWeek) {
      gs.weeklyBossResetDate = thisWeek;
      gs.weeklyBossHpDealt   = 0;
      gs.soulCrystals += ctx.weeklyBossMode.rewards.skinShards * 10;
      gs.materials['boss_essence'] = (gs.materials['boss_essence'] ?? 0) + 1;
      gs.blueprints = gs.blueprints ?? [];
      if (!gs.blueprints.includes('bp_boss_amulet')) {
        gs.blueprints.push('bp_boss_amulet');
      }
    }
  }

  saveGameState(gs);

  // Sync to StageSelectScene's own progress key
  const hpPercent = Math.round((ctx.dungeonHp / ctx.maxHp) * 100);
  if (stageNum !== undefined) recordClear(stageNum - 1, stars, hpPercent);

  logger.debug(`[CHAPTER CLEAR] stars=${stars} +${crystals} soul crystals (×${ctx.wisdomBonuses.crystalEarnMult.toFixed(2)})`);

  // Full overlay
  const ov = scene.add.container(0, 0).setDepth(310);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.85);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 600 });

  // Card
  const cw = 320, ch = 320;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;
  const card = scene.add.graphics();
  card.fillStyle(COLORS.STONE_DARK, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 12);
  card.lineStyle(2, COLORS.TORCH_GOLD, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 12);
  card.setY(-60).setAlpha(0);
  ov.add(card);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 500, ease: 'Power2.easeOut', delay: 200 });

  const chLabel = `${ctx.stageChapter}장`;

  // Game complete: stage 72 (final stage of Ch7)
  const stageCfgX = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  if (stageCfgX?.stageNumber === 72) {
    scene.time.delayedCall(200, () => showGameComplete(ctx));
    return;
  }
  const clearTitle = ctx.dailyMode
    ? `⚔️  ${ctx.dailyMode.name}  클리어!`
    : ctx.weeklyBossMode
    ? `👑  ${ctx.weeklyBossMode.name}  격파!`
    : `🎉  ${chLabel} 클리어!`;
  const title = scene.add.text(CANVAS_WIDTH / 2, cy + 32, clearTitle, {
    fontFamily: "Georgia, serif", fontSize: '24px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(title);
  scene.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 500 });

  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const starsT = scene.add.text(CANVAS_WIDTH / 2, cy + 78, starStr, {
    fontFamily: 'sans-serif', fontSize: '24px', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(starsT);
  scene.tweens.add({ targets: starsT, alpha: 1, duration: 300, delay: 650 });

  const crystalT = scene.add.text(CANVAS_WIDTH / 2, cy + 120, `영혼 결정체  +${crystals} 💎`, {
    fontFamily: 'sans-serif', fontSize: '14px', color: '#88aaff',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(crystalT);
  scene.tweens.add({ targets: crystalT, alpha: 1, duration: 300, delay: 780 });

  // Daily dungeon reward line
  if (ctx.dailyMode) {
    const dailyCrystals = ctx.dailyMode.rewards.crystals;
    const dailyT = scene.add.text(CANVAS_WIDTH / 2, cy + 148, `일일 보상  +${dailyCrystals} 💠  재료 ×${ctx.dailyMode.rewards.materials.length}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#44ffcc',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(dailyT);
    scene.tweens.add({ targets: dailyT, alpha: 1, duration: 300, delay: 880 });
  }

  const killT = scene.add.text(CANVAS_WIDTH / 2, cy + 152, `골드 획득: ${ctx.gold}💰`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(killT);
  scene.tweens.add({ targets: killT, alpha: 1, duration: 300, delay: 880 });

  // Materials earned this run
  const matEntries = Object.entries(ctx.materialsEarnedThisRun).filter(([, q]) => q > 0);
  if (matEntries.length > 0) {
    const matStr = '획득 재료: ' + matEntries.map(([id, q]) => {
      const def = MATERIAL_DEFS[id];
      return `${def?.emoji ?? '?'} ${def?.name ?? id} ×${q}`;
    }).join('  ');
    const matT = scene.add.text(CANVAS_WIDTH / 2, cy + 170, matStr, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(matT);
    scene.tweens.add({ targets: matT, alpha: 1, duration: 300, delay: 940 });
  }

  // Divider
  const divG = scene.add.graphics();
  divG.lineStyle(1, COLORS.STONE_MID, 0.5);
  divG.lineBetween(cx + 20, cy + 178, cx + cw - 20, cy + 178);
  divG.setAlpha(0);
  ov.add(divG);
  scene.tweens.add({ targets: divG, alpha: 1, duration: 300, delay: 900 });

  // Buttons
  const goldEarned = ctx.gold;
  const curStageCfg = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  const curStageNum = curStageCfg?.stageNumber;
  const nextCfg = (curStageNum !== undefined && !ctx.returnTo)
    ? STAGE_CONFIGS[curStageNum]
    : undefined;

  const launchNext = () => {
    if (!nextCfg) return;
    scene.registry.set('stageConfig', nextCfg);
    const cinematicId = STAGE_CINEMATICS[nextCfg.stageNumber];
    if (cinematicId) {
      const gs2 = loadGameState();
      const seen = gs2.cinematicSeen ?? [];
      if (!seen.includes(cinematicId)) {
        ov.destroy();
        scene.scene.stop('UIScene');
        scene.scene.start('CinematicScene', { cinematicId, nextScene: 'DungeonScene' });
        return;
      }
    }
    ov.destroy();
    scene.scene.stop('UIScene');
    scene.scene.start('DungeonScene');
  };

  const btnData: Array<{ label: string; action: () => void; enabled: boolean }> = [
    {
      label: nextCfg ? `다음 스테이지 →  (${nextCfg.stageNumber}스테이지)` : '🏆  모든 챕터 클리어!',
      action: nextCfg ? launchNext : () => {},
      enabled: !!nextCfg,
    },
    {
      label: ctx.returnTo ? '🏰  던전으로 귀환' : '스테이지 선택으로',
      action: () => {
        if (ctx.returnTo) {
          scene.registry.set('battleResult', { won: true, goldEarned, dmXP: 150, materialsEarned: { ...ctx.materialsEarnedThisRun } });
          ov.destroy();
          scene.scene.start('DungeonHomeScene');
        } else {
          ov.destroy();
          scene.scene.start('StageSelectScene');
        }
      },
      enabled: true,
    },
  ];
  btnData.forEach(({ label, action, enabled }, i) => {
    const btnY = cy + 200 + i * 48;
    const btnBg = scene.add.graphics();
    const bgColor = !enabled ? COLORS.STONE_DARK : i === 0 ? 0x1a6040 : COLORS.BLOOD_RED;
    btnBg.fillStyle(bgColor, enabled ? 0.85 : 0.5);
    btnBg.fillRoundedRect(cx + 20, btnY, cw - 40, 36, 5);
    if (enabled && i === 0) {
      btnBg.lineStyle(1, 0x44ff88, 0.5);
      btnBg.strokeRoundedRect(cx + 20, btnY, cw - 40, 36, 5);
    }
    btnBg.setAlpha(0);
    ov.add(btnBg);
    scene.tweens.add({ targets: btnBg, alpha: 1, duration: 250, delay: 1000 + i * 120 });

    const btnT = scene.add.text(CANVAS_WIDTH / 2, btnY + 18, label, {
      fontFamily: "Georgia, serif", fontSize: '13px',
      color: enabled ? CSS.PARCHMENT : '#666666',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(btnT);
    scene.tweens.add({ targets: btnT, alpha: 1, duration: 250, delay: 1000 + i * 120 });

    if (enabled) {
      const zone = scene.add.zone(CANVAS_WIDTH / 2, btnY + 18, cw - 40, 36).setInteractive();
      ov.add(zone);
      zone.on('pointerdown', action);
    }
  });
}

// ── showGameComplete ──────────────────────────────────────────────────────────

export function showGameComplete(ctx: ResultFlowContext): void {
  const scene = ctx.scene;

  // Persist rewards first (guard against duplicate triggers)
  const crystalBonus = 50;
  const gs0 = loadGameState();
  if (!gs0.gameCompleted) {
    gs0.soulCrystals += crystalBonus;
    gs0.gameCompleted = true;
    saveGameState(gs0);
    ctx.checkAchievementsAndToast(gs0);
  }

  // Play game_complete cinematic on first clear
  const gs1 = loadGameState();
  const seen = gs1.cinematicSeen ?? [];
  if (!seen.includes('game_complete')) {
    scene.scene.stop('UIScene');
    scene.scene.start('CinematicScene', { cinematicId: 'game_complete', nextScene: 'StageSelectScene' });
    return;
  }

  // Cinematic already seen — show enhanced summary overlay
  ctx.setWaveActive(false);
  scene.scene.pause();

  const cx = CANVAS_WIDTH / 2;
  const ov = scene.add.container(0, 0).setDepth(400);

  // ── Background ────────────────────────────────────────────────────────────
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.94);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  // Radial gold glow at center
  const glowGfx = scene.add.graphics();
  glowGfx.fillStyle(0xffd700, 0.06);
  glowGfx.fillCircle(cx, CANVAS_HEIGHT * 0.42, 300);
  glowGfx.fillStyle(0xaaddff, 0.04);
  glowGfx.fillCircle(cx, CANVAS_HEIGHT * 0.42, 200);
  ov.add(glowGfx);

  // ── Firework particles ────────────────────────────────────────────────────
  const FIREWORK_COLORS = [0xffd700, 0xff88aa, 0x88ffcc, 0xaaddff, 0xffcc00];
  const spawnFirework = (px: number, py: number) => {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      const dot = scene.add.graphics().setDepth(401);
      const col = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      dot.fillStyle(col, 1);
      dot.fillCircle(0, 0, 2 + Math.random() * 2);
      dot.setPosition(px, py);
      scene.tweens.add({
        targets: dot,
        x: px + Math.cos(angle) * speed,
        y: py + Math.sin(angle) * speed,
        alpha: { from: 1, to: 0 },
        duration: 700 + Math.random() * 400,
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  };
  const fwPositions: [number, number][] = [
    [cx - 100, 160], [cx + 100, 120], [cx, 200],
    [cx - 140, 300], [cx + 140, 280],
  ];
  fwPositions.forEach(([fx, fy], idx) => {
    scene.time.delayedCall(300 + idx * 180, () => spawnFirework(fx, fy));
  });
  // Second wave
  scene.time.delayedCall(1800, () => {
    fwPositions.forEach(([fx, fy], idx) => {
      scene.time.delayedCall(idx * 120, () => spawnFirework(fx + (Math.random() - 0.5) * 40, fy + (Math.random() - 0.5) * 30));
    });
  });

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleT = scene.add.text(cx, 130, '⚔️ 신계 정복 완료! ⚔️', {
    fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold', color: '#ffd700',
  }).setOrigin(0.5).setAlpha(0).setScale(0.8);
  ov.add(titleT);
  scene.tweens.add({ targets: titleT, alpha: 1, scaleX: 1, scaleY: 1, duration: 700, delay: 200, ease: 'Back.out' });

  const subT = scene.add.text(cx, 172, '신황제를 쓰러뜨리고 7개 챕터를 완전 정복!', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffeeaa',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(subT);
  scene.tweens.add({ targets: subT, alpha: 1, duration: 400, delay: 600 });

  // Animated stars (one by one)
  const STAR_LABELS = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7'];
  STAR_LABELS.forEach((label, idx) => {
    const sx = cx - 126 + idx * 42;
    const starG = scene.add.text(sx, 222, '★', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#ffd700',
    }).setOrigin(0.5).setAlpha(0).setScale(0);
    const labelG = scene.add.text(sx, 250, label, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#ccaa44',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(starG);
    ov.add(labelG);
    scene.tweens.add({
      targets: starG, alpha: 1, scaleX: 1, scaleY: 1, duration: 300,
      delay: 800 + idx * 130, ease: 'Back.out',
      onComplete: () => {
        scene.tweens.add({ targets: starG, scaleX: 1.2, scaleY: 1.2, duration: 200, yoyo: true });
      },
    });
    scene.tweens.add({ targets: labelG, alpha: 1, duration: 200, delay: 900 + idx * 130 });
  });

  // ── Stats panel ────────────────────────────────────────────────────────────
  const gs2 = loadGameState();
  const totalStages = Object.values(gs2.stageProgress ?? {}).filter((p: { bestStars?: number }) => (p.bestStars ?? 0) > 0).length;
  const panelY = 290;

  const panelBg = scene.add.graphics();
  panelBg.fillStyle(0x111133, 0.88);
  panelBg.fillRoundedRect(cx - 155, panelY, 310, 110, 10);
  panelBg.lineStyle(1, 0x4455aa, 0.6);
  panelBg.strokeRoundedRect(cx - 155, panelY, 310, 110, 10);
  panelBg.setAlpha(0);
  ov.add(panelBg);
  scene.tweens.add({ targets: panelBg, alpha: 1, duration: 400, delay: 1700 });

  const stats: [string, string][] = [
    ['클리어 스테이지', `${totalStages} / 72`],
    ['최종 던전 HP', `${ctx.dungeonHp} / ${ctx.maxHp}`],
    ['보너스 영혼 결정체', `+${crystalBonus} 💎`],
    ['던전 마스터 레벨', `${gs2.dmLevel ?? 1}`],
  ];
  stats.forEach(([label, value], i) => {
    const sy = panelY + 16 + i * 24;
    const lT = scene.add.text(cx - 140, sy, label, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aabbcc',
    }).setAlpha(0);
    const vT = scene.add.text(cx + 140, sy, value, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffeebb',
    }).setOrigin(1, 0).setAlpha(0);
    ov.add(lT);
    ov.add(vT);
    scene.tweens.add({ targets: [lT, vT], alpha: 1, duration: 300, delay: 1800 + i * 80 });
  });

  // ── New Game+ prestige teaser ──────────────────────────────────────────────
  const pressY = 428;
  const pressGfx = scene.add.graphics();
  pressGfx.fillStyle(0x2a0055, 0.9);
  pressGfx.fillRoundedRect(cx - 155, pressY, 310, 46, 8);
  pressGfx.lineStyle(1.5, 0xcc88ff, 0.8);
  pressGfx.strokeRoundedRect(cx - 155, pressY, 310, 46, 8);
  pressGfx.setAlpha(0);
  ov.add(pressGfx);

  const pressT = scene.add.text(cx, pressY + 13, '✨ New Game+ — 명성 시스템 잠금 해제! ✨', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#cc88ff',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(pressT);
  const pressSubT = scene.add.text(cx, pressY + 30, '홈 화면 → 설정에서 뉴게임+ 시작 가능', {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#8866aa',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(pressSubT);
  scene.tweens.add({ targets: [pressGfx, pressT, pressSubT], alpha: 1, duration: 500, delay: 2200 });
  scene.time.delayedCall(2600, () => {
    scene.tweens.add({ targets: pressT, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
  });

  // ── Buttons ────────────────────────────────────────────────────────────────
  const makeBtn = (bx: number, by: number, w: number, label: string, fillCol: number, borderCol: number) => {
    const bg = scene.add.graphics();
    const drawBtn = (f: number) => {
      bg.clear();
      bg.fillStyle(f, 1);
      bg.fillRoundedRect(bx - w / 2, by, w, 44, 8);
      bg.lineStyle(2, borderCol, 0.9);
      bg.strokeRoundedRect(bx - w / 2, by, w, 44, 8);
    };
    drawBtn(fillCol);
    bg.setAlpha(0);
    ov.add(bg);
    const txt = scene.add.text(bx, by + 22, label, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#' + borderCol.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setAlpha(0);
    ov.add(txt);
    const zone = scene.add.zone(bx, by + 22, w, 44).setInteractive().setDepth(402);
    zone.on('pointerover', () => drawBtn(fillCol + 0x222222));
    zone.on('pointerout',  () => drawBtn(fillCol));
    return { bg, txt, zone };
  };

  const btnStage = makeBtn(cx - 83, 500, 150, '스테이지 선택', 0x223355, 0xffcc00);
  const btnHome  = makeBtn(cx + 83, 500, 150, '홈으로', 0x222233, 0xaabbcc);

  scene.tweens.add({ targets: [btnStage.bg, btnStage.txt, btnHome.bg, btnHome.txt], alpha: 1, duration: 400, delay: 2400 });

  btnStage.zone.on('pointerdown', () => {
    scene.scene.stop('UIScene');
    scene.scene.start('StageSelectScene');
  });
  btnHome.zone.on('pointerdown', () => {
    scene.scene.stop('UIScene');
    scene.scene.start('DungeonHomeScene');
  });

  logger.debug(`[GAME COMPLETE] all 7 chapters cleared! +${crystalBonus} soul crystals`);
}

// ── showRepairOption ──────────────────────────────────────────────────────────

export function showRepairOption(ctx: ResultFlowContext, row: number, col: number): void {
  const scene = ctx.scene;
  const data = ctx.roomGrid[row]?.[col];
  if (!data || data.roomHp >= data.maxRoomHp) return;

  const def = ROOM_DEFS[data.type];
  const cost = Math.round(def.cost * 0.5);

  const room = ctx.rooms[row]?.[col];
  if (!room) return;

  const btn = scene.add.text(room.x, room.y - 40, `🔧 수리 (${cost}💰)`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#44ff44',
    backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
  }).setOrigin(0.5).setDepth(80).setInteractive();

  btn.on('pointerdown', () => {
    if (ctx.gold < cost) {
      ctx.showFloatText(room.x, room.y, '골드 부족!', '#ff4444');
      btn.destroy();
      return;
    }
    ctx.setGold(ctx.gold - cost);
    data.roomHp = data.maxRoomHp;
    room.updateHpBar();
    ctx.showFloatText(room.x, room.y, `🔧 수리 완료!`, '#44ff44');
    btn.destroy();
  });

  // Auto-dismiss after 3s
  scene.time.delayedCall(3000, () => btn.destroy());
}
