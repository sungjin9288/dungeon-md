// ─── Wave Lifecycle ────────────────────────────────────────────────────────────
// Wave display helpers and end-detection logic extracted from DungeonScene.
//
//   showWaveEnemyPreview()   — brief enemy-type pill shown after banner settles
//   showEndlessMilestoneToast() — milestone toast at waves 10/20/30/50/100
//   showEndlessResult()      — save, set registry, transition to result scene
//   checkWaveEnd()           — per-frame guard that fires the wave-clear flow

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { INVADER_DEFS } from '../data/invaders';
import type { WaveSpec } from '../data/stages';
import { loadGameState, saveGameState } from '../data/wisdom';
import { tickDailyChallenge } from '../data/daily';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_ROWS, GRID_Y } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { logger } from '../utils/logger';

// ─── showWaveEnemyPreview ─────────────────────────────────────────────────────
// Brief "농민 ×5  기사 ×1" pill shown just after the wave banner slides in.
// Pure display — no state mutation.

export function showWaveEnemyPreview(
  scene:       Phaser.Scene,
  waveConfigs: WaveSpec[],
  wave:        number,
): void {
  const waveCfg = waveConfigs[wave - 1];
  if (!waveCfg?.invaders?.length) return;

  const entries = waveCfg.invaders.slice(0, 3);
  const label   = entries
    .map(e => `${INVADER_DEFS[e.type]?.koreanName ?? e.type} ×${e.count}`)
    .join('  ');

  const pill = scene.add.container(CANVAS_WIDTH / 2, 125).setDepth(248).setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0d0500, 0.88);
  bg.fillRoundedRect(-140, -12, 280, 24, 6);
  bg.lineStyle(1, 0x6a4410, 0.7);
  bg.strokeRoundedRect(-140, -12, 280, 24, 6);
  pill.add(bg);

  pill.add(scene.add.text(0, 0, label, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#d4c090',
  }).setOrigin(0.5));

  scene.tweens.add({
    targets: pill, alpha: 1, duration: 200,
    onComplete: () => scene.tweens.add({
      targets: pill, alpha: 0, delay: 1600, duration: 250,
      onComplete: () => pill.destroy(),
    }),
  });
}

// ─── showEndlessMilestoneToast ────────────────────────────────────────────────
// Milestone toast for endless mode (waves 10/20/30/50/100). Pure display.

export function showEndlessMilestoneToast(scene: Phaser.Scene, wave: number): void {
  let msg = '';
  if      (wave === 10)  msg = '🌊 10웨이브! 엘리트 등장!';
  else if (wave === 20)  msg = '👹 20웨이브! 미니 보스!';
  else if (wave === 30)  msg = '⚔ 30웨이브! 엘리트 쌍검사!';
  else if (wave === 50)  msg = '💫 50웨이브! 절반의 영웅!';
  else if (wave === 100) msg = '🌟 100웨이브! 전설!';
  if (!msg) return;

  const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, msg, {
    fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
    color: '#ffdd44', backgroundColor: '#1a0a00',
    padding: { x: 14, y: 8 },
  }).setOrigin(0.5).setDepth(250).setAlpha(0);

  scene.tweens.add({
    targets: t, alpha: 1, duration: 300,
    onComplete: () => {
      scene.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 1800, onComplete: () => t.destroy() });
    },
  });

  if (wave === 50 || wave === 100) scene.cameras.main.flash(400, 255, 220, 50, false);
}

// ─── showEndlessResult ────────────────────────────────────────────────────────
// Persist score, set registry result payload, transition to EndlessResultScene.

export function showEndlessResult(
  scene:           Phaser.Scene,
  wave:            number,
  crystalEarnMult: number,
  killsThisRun:    number,
  goldEarnedThisRun: number,
): void {
  const gs           = loadGameState();
  const crystalsBase = Math.floor(wave / 5);
  const milestone    = (wave >= 100 ? 10 : 0) + (wave >= 50 ? 5 : 0) + (wave >= 20 ? 2 : 0);
  const crystals     = Math.round((crystalsBase + milestone) * crystalEarnMult);
  const previousBest = gs.endlessHighScore ?? 0;
  const isNewRecord  = wave > previousBest;

  saveGameState({
    ...gs,
    soulCrystals:     (gs.soulCrystals    ?? 0) + crystals,
    endlessHighScore: Math.max(previousBest, wave),
  });

  scene.registry.set('endlessResult', {
    wave, kills: killsThisRun, goldEarned: goldEarnedThisRun,
    crystalsEarned: crystals, isNewRecord, previousBest,
  });

  scene.scene.stop('UIScene');
  scene.scene.start('EndlessResultScene');
}

// ─── checkWaveEnd — context ───────────────────────────────────────────────────

export interface CheckWaveEndContext {
  readonly scene:             Phaser.Scene;
  readonly wave:              number;
  readonly maxWave:           number;
  readonly waveStartDungeonHp: number;
  readonly maxHp:             number;

  get waveEndChecked():       boolean;   set waveEndChecked(v: boolean);
  get waveHasSpawned():       boolean;
  get activeInvaders():       Invader[]; set activeInvaders(v: Invader[]);
  get killCounterText():      Phaser.GameObjects.Text | undefined;
  set killCounterText(v:      Phaser.GameObjects.Text | undefined);
  get waveActive():           boolean;   set waveActive(v: boolean);
  get dungeonHp():            number;
  get consecutiveNoDmgWaves():number;    set consecutiveNoDmgWaves(v: number);

  saveRoomHpsToGameState(): void;
  showChapterClear(): void;
  showWaveClear(): void;
}

// ─── checkWaveEnd ─────────────────────────────────────────────────────────────
// Called each frame from runCombat. Detects when all invaders are gone and
// triggers the wave-clear flow (with a short visual grace period).

export function checkWaveEnd(ctx: CheckWaveEndContext): void {
  if (ctx.waveEndChecked) return;
  if (!ctx.waveHasSpawned) return;
  if (ctx.activeInvaders.filter(i => i.active).length > 0) return;

  ctx.waveEndChecked = true;

  if (ctx.killCounterText) {
    ctx.scene.tweens.add({
      targets: ctx.killCounterText, alpha: 0, duration: 600, delay: 400,
      onComplete: () => { ctx.killCounterText?.destroy(); ctx.killCounterText = undefined; },
    });
  }

  ctx.scene.time.delayedCall(800, () => {
    // A straggler may have entered during the grace window
    if (ctx.activeInvaders.filter(i => i.active).length > 0) {
      ctx.waveEndChecked = false;
      return;
    }

    ctx.waveActive     = false;
    ctx.activeInvaders = [];
    logger.debug(`[WAVE ${ctx.wave} CLEAR] dungeon HP: ${ctx.dungeonHp}/${ctx.maxHp}`);
    ctx.saveRoomHpsToGameState();

    // Daily challenge ticks
    const noDmg = ctx.dungeonHp >= ctx.waveStartDungeonHp;
    ctx.consecutiveNoDmgWaves = noDmg ? ctx.consecutiveNoDmgWaves + 1 : 0;
    {
      let gs_dc = tickDailyChallenge(loadGameState(), 'wave_clear');
      if (noDmg) gs_dc = tickDailyChallenge(gs_dc, 'no_damage');
      saveGameState(gs_dc);
    }

    if (ctx.wave >= ctx.maxWave) {
      ctx.showChapterClear();
    } else {
      ctx.showWaveClear();
    }
  });
}

// ── WavePrepContext ───────────────────────────────────────────────────────────
// Narrow context for the between-wave countdown and wave-button reset.
// ResultFlowContext structurally satisfies this interface so no adapter needed.

export interface WavePrepContext {
  scene: Phaser.Scene;
  effectiveCellSize: number;
  wave: number;
  waveConfigs: ReadonlyArray<{
    invaders?: ReadonlyArray<{ type: string; count: number; isBoss?: boolean }>;
  }>;
  get prepTimer(): number;
  countdownBar?: Phaser.GameObjects.Graphics;
  get waveBtnBg(): Phaser.GameObjects.Graphics;
  get waveBtnZone(): Phaser.GameObjects.Zone;
  get waveLabel(): Phaser.GameObjects.Text;
  drawBtn: (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean) => void;
  setWaveEndChecked: (v: boolean) => void;
  setWaveHasSpawned: (v: boolean) => void;
  setPrepActive: (v: boolean) => void;
  setPrepTimer: (v: number) => void;
  setCountdownBar: (bar: Phaser.GameObjects.Graphics | undefined) => void;
}

// ── enableWaveButton ──────────────────────────────────────────────────────────
// Redraws the wave-start button and fires a golden pulse to attract attention.

export function enableWaveButton(ctx: WavePrepContext): void {
  const bw = 270, bh = 48;
  const bx = CANVAS_WIDTH / 2 - bw / 2;
  const by = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 20;
  ctx.setWaveEndChecked(false);
  ctx.setWaveHasSpawned(false);
  ctx.drawBtn(ctx.waveBtnBg, bx, by, bw, bh, false);
  ctx.waveBtnBg.setAlpha(1);
  ctx.waveBtnZone.setInteractive();
  ctx.waveLabel.setText('⚔  침략 시작').setColor(CSS.PARCHMENT);

  // Golden pulse to draw attention to the newly-ready button
  const scene = ctx.scene;
  const pulse = scene.add.graphics().setDepth(63).setAlpha(0);
  pulse.lineStyle(2.5, COLORS.TORCH_GOLD, 1);
  pulse.strokeRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 8);
  scene.tweens.add({
    targets: pulse,
    alpha: { from: 0, to: 0.9 },
    duration: 180,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
    onComplete: () => pulse.destroy(),
  });
}

// ── startPrepCountdown ────────────────────────────────────────────────────────
// Displays the between-wave countdown bar, ring, and enemy preview; auto-fires
// enableWaveButton when it reaches zero.

export function startPrepCountdown(ctx: WavePrepContext): void {
  const scene = ctx.scene;
  ctx.setPrepActive(true);
  ctx.setPrepTimer(10);

  const barBx = CANVAS_WIDTH / 2 - 130;
  const barBy = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 78;

  if (!ctx.countdownBar) {
    const barBg = scene.add.graphics().setDepth(70);
    barBg.fillStyle(COLORS.STONE_DARK, 1);
    barBg.fillRoundedRect(barBx, barBy, 260, 10, 3);
    ctx.setCountdownBar(scene.add.graphics().setDepth(71));
  }

  // Big countdown number above the bar
  const cdNumY = barBy - 22;
  const cdNum = scene.add.text(CANVAS_WIDTH / 2, cdNumY, '10', {
    fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold',
    color: '#c8921a', stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(72).setAlpha(0.9);

  // Next wave invader preview
  const nextCfg = ctx.waveConfigs[ctx.wave]; // wave is 1-indexed; [wave] = next wave (0-indexed)
  let previewT: Phaser.GameObjects.Text | undefined;
  if (nextCfg?.invaders) {
    const total   = nextCfg.invaders.reduce((s, inv) => s + inv.count, 0);
    const hasBoss = nextCfg.invaders.some(inv => inv.isBoss);
    const icon    = hasBoss ? '👹' : '👾';
    const label   = hasBoss ? `${icon} 보스 포함 ×${total}` : `${icon} ×${total}`;
    previewT = scene.add.text(CANVAS_WIDTH / 2, cdNumY - 18, label, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: hasBoss ? '#ff8844' : '#aaaacc',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(72).setAlpha(0.85);
  }

  // Circular countdown ring overlaid on the wave button center
  const btnCY = GRID_Y + GRID_ROWS * ctx.effectiveCellSize + 50;
  const ringGfx = scene.add.graphics().setDepth(72);
  const _drawRing = (remaining: number) => {
    ringGfx.clear();
    const pct  = remaining / 10;
    const col  = remaining <= 3 ? 0xff4422 : COLORS.TORCH_GOLD;
    const endA = -Math.PI / 2 + pct * Math.PI * 2;
    ringGfx.lineStyle(3, 0x333333, 0.45);
    ringGfx.beginPath();
    ringGfx.arc(CANVAS_WIDTH / 2, btnCY, 22, 0, Math.PI * 2, false);
    ringGfx.strokePath();
    if (pct > 0.01) {
      ringGfx.lineStyle(3, col, 0.9);
      ringGfx.beginPath();
      ringGfx.arc(CANVAS_WIDTH / 2, btnCY, 22, -Math.PI / 2, endA, false);
      ringGfx.strokePath();
    }
  };
  _drawRing(10);

  const tick = () => {
    ctx.setPrepTimer(ctx.prepTimer - 1);
    ctx.countdownBar!.clear();
    ctx.countdownBar!.fillStyle(COLORS.TORCH_GOLD, 0.8);
    ctx.countdownBar!.fillRoundedRect(barBx, barBy, 260 * (ctx.prepTimer / 10), 10, 3);
    _drawRing(ctx.prepTimer);
    scene.registry.set('status', `다음 침략까지 ${ctx.prepTimer}초`);

    if (ctx.prepTimer <= 0) {
      ctx.setPrepActive(false);
      ctx.countdownBar!.clear();
      ringGfx.destroy();
      cdNum.destroy();
      previewT?.destroy();
      scene.registry.set('status', '');
      ctx.setWaveEndChecked(false);
      enableWaveButton(ctx);
    } else {
      cdNum.setText(String(ctx.prepTimer));
      scene.tweens.add({ targets: cdNum, scaleX: { from: 1.3, to: 1 }, scaleY: { from: 1.3, to: 1 }, duration: 200, ease: 'Power2' });
      scene.time.delayedCall(1000, tick);
    }
  };
  scene.time.delayedCall(1000, tick);
}
