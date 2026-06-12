// ─── Result Panel ─────────────────────────────────────────────────────────────
// Builds the wave-clear / wave-fail overlay card shown to the player after
// each combat round ends. Extracted from ResultFlow.ts so that the flow
// orchestration (showWaveClear, triggerWaveFail) stays readable without the
// 250-line UI builder buried inside it.
//
// Also owns revive() and resetStage() — they are only ever called from
// buildFailContent, so housing them here avoids a circular import
// (ResultFlow → ResultPanel → ResultFlow).
//
// Public exports:
//   showResultPanel  — entry point; delegates to success or fail builder
//   revive           — gem/ad revive (called by fail-panel action)
//   resetStage       — full stage reset (called by fail-panel action)

import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { MATERIAL_DEFS } from '../data/fusion';
import { enableWaveButton } from './WaveLifecycle';
import type { ResultFlowContext } from './ResultFlow';
import { logger } from '../utils/logger';

// ─── showResultPanel ──────────────────────────────────────────────────────────

export function showResultPanel(ctx: ResultFlowContext, isFail: boolean, reward: number, stars: number): void {
  const scene = ctx.scene;
  if (ctx.resultOverlay) ctx.resultOverlay.destroy();
  const ov = scene.add.container(0, 0).setDepth(300);
  ctx.setResultOverlay(ov);

  // Compute wave stat summary
  const damagedCount  = ctx.dungeonTrapSlots.filter(
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
  const cw     = 300;
  // Reserve 70px for stat row, plus 56px for materials section if any materials earned
  const hasMaterials = Object.values(ctx.materialsEarnedThisRun ?? {}).some(q => q > 0);
  const statsH = hasMaterials ? 126 : 60;
  const ch     = isFail ? 220 : 200 + statsH;
  const cx     = CANVAS_WIDTH  / 2 - cw / 2;
  const cy     = CANVAS_HEIGHT / 2 - ch / 2;

  const card = scene.add.graphics();
  card.fillStyle(COLORS.STONE_DARK, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 10);
  card.lineStyle(2, isFail ? COLORS.BLOOD_GLOW : COLORS.TORCH_GOLD, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 10);
  card.setY(-80).setAlpha(0);
  ov.add(card);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 350, ease: 'Power2.easeOut' });

  const title      = isFail ? '던전 함락!' : '침입자 격퇴!';
  const titleColor = isFail ? CSS.BLOOD_GLOW : CSS.TORCH_AMBER;
  const titleT = scene.add.text(CANVAS_WIDTH / 2, cy + 30, title, {
    fontFamily: 'Georgia, serif', fontSize: '24px', fontStyle: 'bold', color: titleColor,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(titleT);
  scene.tweens.add({ targets: titleT, alpha: 1, duration: 300, delay: 200 });

  if (!isFail) {
    buildSuccessContent(ctx, ov, cx, cy, cw, ch, stars, reward, damagedCount, destroyedCount);
  } else {
    buildFailContent(ctx, ov, cx, cy, cw);
  }
}

// ─── buildSuccessContent (module-private) ─────────────────────────────────────

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
  const starsT  = scene.add.text(CANVAS_WIDTH / 2, cy + 68, starStr, {
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
  const statY       = cy + 138;
  const statDivider = scene.add.graphics().setAlpha(0);
  statDivider.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
  statDivider.lineBetween(cx + 16, statY - 10, cx + cw - 16, statY - 10);
  ov.add(statDivider);
  scene.tweens.add({ targets: statDivider, alpha: 1, duration: 200, delay: 480 });

  const statItems = [
    { icon: '⚔',  label: '격퇴',    value: String(ctx.killsThisWave),   color: '#88ff88' },
    { icon: '💥', label: '돌파',    value: String(ctx.breakthruCount),   color: ctx.breakthruCount > 0 ? '#ff8888' : '#888888' },
    { icon: '🏚', label: '손상 방', value: `${damagedCount}칸`,           color: damagedCount > 0 ? '#ffbb44' : '#888888' },
    { icon: '💰', label: '획득 골드', value: `+${ctx.goldEarnedThisRun}`, color: '#ffcc44' },
  ];
  const colW = cw / 4;
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

  // Perfect clear bonus
  if (ctx.breakthruCount === 0 && damagedCount === 0 && destroyedCount === 0) {
    const perfectT = scene.add.text(CANVAS_WIDTH / 2, statY + 54, '✨ 퍼펙트 클리어!', {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(perfectT);
    scene.tweens.add({
      targets: perfectT, alpha: 1,
      scaleX: { from: 0.7, to: 1 }, scaleY: { from: 0.7, to: 1 },
      duration: 350, ease: 'Back.easeOut', delay: 640,
    });
  }

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

  // Materials earned this wave
  const matEntries = Object.entries(ctx.materialsEarnedThisRun).filter(([, q]) => q > 0);
  if (matEntries.length > 0) {
    // Section divider + header
    const matDivY = statY + 62;
    const matDiv = scene.add.graphics().setAlpha(0);
    matDiv.lineStyle(1, COLORS.TORCH_GOLD, 0.15);
    matDiv.lineBetween(cx + 16, matDivY, cx + cw - 16, matDivY);
    ov.add(matDiv);
    scene.tweens.add({ targets: matDiv, alpha: 1, duration: 200, delay: 680 });

    const matHeaderT = scene.add.text(cx + 16, matDivY + 6, '획득 재료', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#886644',
    }).setAlpha(0);
    ov.add(matHeaderT);
    scene.tweens.add({ targets: matHeaderT, alpha: 1, duration: 200, delay: 690 });

    // Material chips — show name + qty
    const chipY = matDivY + 22;
    const cols  = Math.min(matEntries.length, 3);
    const chipW = (cw - 32) / cols;
    matEntries.slice(0, 3).forEach(([id, qty], mi) => {
      const def    = MATERIAL_DEFS[id];
      const emoji  = def?.emoji ?? '?';
      const name   = def?.name  ?? id;
      const chipX  = cx + 16 + mi * chipW;

      // Chip background
      const chipBg = scene.add.graphics().setAlpha(0);
      chipBg.fillStyle(0x1a1200, 0.9);
      chipBg.fillRoundedRect(chipX, chipY, chipW - 4, 28, 4);
      chipBg.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
      chipBg.strokeRoundedRect(chipX, chipY, chipW - 4, 28, 4);
      ov.add(chipBg);
      scene.tweens.add({ targets: chipBg, alpha: 1, duration: 180, delay: 710 + mi * 50 });

      // Emoji + qty
      const chipT = scene.add.text(chipX + (chipW - 4) / 2, chipY + 8, `${emoji} ×${qty}`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#ffcc66',
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(chipT);
      scene.tweens.add({ targets: chipT, alpha: 1, duration: 180, delay: 720 + mi * 50 });

      // Material name below
      const nameT = scene.add.text(chipX + (chipW - 4) / 2, chipY + 18, name.length > 6 ? name.slice(0, 6) + '…' : name, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#886644',
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(nameT);
      scene.tweens.add({ targets: nameT, alpha: 1, duration: 180, delay: 730 + mi * 50 });
    });

    // If more than 3, show "+N more" hint
    if (matEntries.length > 3) {
      const moreT = scene.add.text(cx + cw - 16, chipY + 10, `+${matEntries.length - 3}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#664422',
      }).setOrigin(1, 0).setAlpha(0);
      ov.add(moreT);
      scene.tweens.add({ targets: moreT, alpha: 1, duration: 180, delay: 780 });
    }
  }

  const wave     = ctx.wave;
  const btnDelay = matEntries.length > 0 ? 800 + Math.min(matEntries.length, 3) * 50 : 700;

  const btnT = scene.add.text(CANVAS_WIDTH / 2, cy + ch - 40,
    `다음 침략 준비 (${wave + 1}/${ctx.maxWave})`, {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(btnT);
  scene.tweens.add({ targets: btnT, alpha: 1, duration: 300, delay: btnDelay });

  // Activate button after brief hold so player sees rewards first
  const btnZone = scene.add.zone(CANVAS_WIDTH / 2, cy + ch - 40, 280, 36);
  ov.add(btnZone);
  scene.time.delayedCall(btnDelay + 400, () => {
    if (!btnZone.scene) return;   // 패널이 타이머보다 먼저 파괴됨 (준비 카운트다운 자동 진행)
    btnT.setColor(CSS.PARCHMENT);
    btnZone.setInteractive();
    btnZone.on('pointerdown', () => {
      ov.destroy();
      ctx.setResultOverlay(undefined);
      ctx.setPrepActive(false);
      enableWaveButton(ctx);
    });
  });

  // "즉시 시작" skip button
  if (wave < ctx.maxWave) {
    const skipT = scene.add.text(CANVAS_WIDTH / 2, cy + ch - 14, '⚡ 즉시 시작', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ffcc44',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(skipT);
    scene.tweens.add({ targets: skipT, alpha: 1, duration: 200, delay: btnDelay + 600 });

    const skipZone = scene.add.zone(CANVAS_WIDTH / 2, cy + ch - 14, 200, 24);
    ov.add(skipZone);
    scene.time.delayedCall(btnDelay + 600, () => {
      if (!skipZone.scene) return;   // 패널 선파괴 가드
      skipZone.setInteractive();
      skipZone.on('pointerdown', () => {
        ov.destroy();
        ctx.setResultOverlay(undefined);
        ctx.setPrepActive(false);
        ctx.setPrepTimer(0);
        ctx.countdownBar?.clear();
        ctx.startWave();
      });
    });
  }
}

// ─── buildFailContent (module-private) ────────────────────────────────────────

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

  // Weakest room hint — find slot with the most relative HP loss
  let worstIdx  = -1;
  let worstLoss = 0;
  ctx.dungeonTrapSlots.forEach((slot, i) => {
    if (!slot || slot.maxHp <= 0) return;
    const max     = slot.maxHp;
    const startHp = ctx.waveStartSlotHps[i] ?? max;
    const loss    = (startHp - slot.hp) / max;
    if (loss > worstLoss) { worstLoss = loss; worstIdx = i; }
  });
  if (worstIdx >= 0 && worstLoss > 0.05) {
    const wRow   = Math.floor(worstIdx / ctx.effectiveCols) + 1;
    const wCol   = worstIdx % ctx.effectiveCols + 1;
    const dmgPct = Math.round(worstLoss * 100);
    const hintT  = scene.add.text(CANVAS_WIDTH / 2, cy + 93,
      `⚠  취약 지점: ${wRow}행 ${wCol}열  (피해 ${dmgPct}%)`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ff8888',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(hintT);
    scene.tweens.add({ targets: hintT, alpha: 1, duration: 300, delay: 350 });
  }

  const options: Array<{ label: string; action: () => void }> = [
    ...(ctx.returnTo ? [{
      label: '🏰  던전으로 귀환',
      action: () => {
        scene.registry.set('battleResult', {
          won: false, goldEarned: ctx.gold, dmXP: 30,
          materialsEarned: { ...ctx.materialsEarnedThisRun },
        });
        ov.destroy();
        scene.scene.start('DungeonHomeScene');
      },
    }] : []),
    { label: '광고 보기 (부활)',  action: () => revive(ctx, 0) },
    { label: '💎 5보석으로 부활', action: () => revive(ctx, 5) },
    { label: '처음부터',          action: () => confirmReset(ctx, ov) },
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

// ─── revive ───────────────────────────────────────────────────────────────────

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

// ─── confirmReset ─────────────────────────────────────────────────────────────

function confirmReset(ctx: ResultFlowContext, failOv: Phaser.GameObjects.Container): void {
  const scene = ctx.scene;
  const OW = 280, OH = 160;
  const OX = (CANVAS_WIDTH  - OW) / 2;
  const OY = (CANVAS_HEIGHT - OH) / 2;

  const ov = scene.add.container(0, 0).setDepth(90).setAlpha(0);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0d0005, 1);
  bg.fillRoundedRect(OX, OY, OW, OH, 8);
  bg.lineStyle(2, 0xaa2222, 0.9);
  bg.strokeRoundedRect(OX, OY, OW, OH, 8);
  ov.add(bg);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 30, '⚠ 처음부터?', {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#cc4444',
  }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 60, '진행 상황이 초기화됩니다.\n획득한 골드가 사라집니다.', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a0a0',
    align: 'center',
  }).setOrigin(0.5));

  const confirmBtn = scene.add.text(CANVAS_WIDTH / 2 - 50, OY + OH - 30, '초기화', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#cc4444',
    backgroundColor: '#2a0000', padding: { x: 18, y: 7 },
  }).setOrigin(0.5).setInteractive();
  confirmBtn.on('pointerdown', () => {
    ov.destroy(true);
    failOv.destroy(true);
    ctx.setResultOverlay(undefined);
    resetStage(ctx);
  });
  ov.add(confirmBtn);

  const cancelBtn = scene.add.text(CANVAS_WIDTH / 2 + 50, OY + OH - 30, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#666666',
    backgroundColor: '#111111', padding: { x: 18, y: 7 },
  }).setOrigin(0.5).setInteractive();
  cancelBtn.on('pointerdown', () => ov.destroy(true));
  ov.add(cancelBtn);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
}

// ─── resetStage ───────────────────────────────────────────────────────────────

export function resetStage(ctx: ResultFlowContext): void {
  ctx.setWave(0);
  ctx.setDungeonHp(ctx.maxHp);
  ctx.setGold(ctx.startGold);
  ctx.activeInvaders.length = 0;
  ctx.setWaveEndChecked(false);
  enableWaveButton(ctx);
  logger.debug('[RESET] stage reset');
}
