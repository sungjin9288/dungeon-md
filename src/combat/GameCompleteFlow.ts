// ─── Game Complete Flow ───────────────────────────────────────────────────────
// Handles the full-game-clear screen triggered when stageNumber 80 is beaten.
// Extracted from StageClearFlow.ts so that the standard chapter-clear path
// (showChapterClear) and the once-per-playthrough celebration screen live in
// separate modules.
//
// showGameComplete persists the +50 crystal bonus, plays the game_complete
// cinematic on first clear, or shows the enhanced summary overlay on
// subsequent clears.

import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
import { logger } from '../utils/logger';
import type { ResultFlowContext } from './ResultFlow';

// ─── showGameComplete ─────────────────────────────────────────────────────────

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
      const dot   = scene.add.graphics().setDepth(401);
      const col   = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
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
      scene.time.delayedCall(
        idx * 120,
        () => spawnFirework(fx + (Math.random() - 0.5) * 40, fy + (Math.random() - 0.5) * 30),
      );
    });
  });

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleT = scene.add.text(cx, 130, '⚔️ 신계 정복 완료! ⚔️', {
    fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold', color: '#ffd700',
  }).setOrigin(0.5).setAlpha(0).setScale(0.8);
  ov.add(titleT);
  scene.tweens.add({ targets: titleT, alpha: 1, scaleX: 1, scaleY: 1, duration: 700, delay: 200, ease: 'Back.out' });

  const subT = scene.add.text(cx, 172, '원초신을 쓰러뜨리고 8개 챕터를 완전 정복!', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffeeaa',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(subT);
  scene.tweens.add({ targets: subT, alpha: 1, duration: 400, delay: 600 });

  // Animated chapter stars (one by one)
  const STAR_LABELS = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7'];
  STAR_LABELS.forEach((label, idx) => {
    const sx     = cx - 126 + idx * 42;
    const starG  = scene.add.text(sx, 222, '★', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#ffd700',
    }).setOrigin(0.5).setAlpha(0).setScale(0);
    const labelG = scene.add.text(sx, 250, label, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#ccaa44',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(starG);
    ov.add(labelG);
    scene.tweens.add({
      targets: starG, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 300, delay: 800 + idx * 130, ease: 'Back.out',
      onComplete: () => {
        scene.tweens.add({ targets: starG, scaleX: 1.2, scaleY: 1.2, duration: 200, yoyo: true });
      },
    });
    scene.tweens.add({ targets: labelG, alpha: 1, duration: 200, delay: 900 + idx * 130 });
  });

  // ── Stats panel ────────────────────────────────────────────────────────────
  const gs2        = loadGameState();
  const totalStages = Object.values(gs2.stageProgress ?? {})
    .filter((p: { bestStars?: number }) => (p.bestStars ?? 0) > 0).length;
  const panelY     = 290;

  const panelBg = scene.add.graphics();
  panelBg.fillStyle(0x111133, 0.88);
  panelBg.fillRoundedRect(cx - 155, panelY, 310, 110, 10);
  panelBg.lineStyle(1, 0x4455aa, 0.6);
  panelBg.strokeRoundedRect(cx - 155, panelY, 310, 110, 10);
  panelBg.setAlpha(0);
  ov.add(panelBg);
  scene.tweens.add({ targets: panelBg, alpha: 1, duration: 400, delay: 1700 });

  const stats: [string, string][] = [
    ['클리어 스테이지',    `${totalStages} / 80`],
    ['최종 던전 HP',       `${ctx.dungeonHp} / ${ctx.maxHp}`],
    ['보너스 영혼 결정체', `+${crystalBonus} 💠`],
    ['던전 마스터 레벨',   `${gs2.dmLevel ?? 1}`],
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
  const pressY   = 428;
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
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: '#' + borderCol.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setAlpha(0);
    ov.add(txt);
    const zone = scene.add.zone(bx, by + 22, w, 44).setInteractive().setDepth(402);
    zone.on('pointerover', () => drawBtn(fillCol + 0x222222));
    zone.on('pointerout',  () => drawBtn(fillCol));
    return { bg, txt, zone };
  };

  const btnStage = makeBtn(cx - 83, 500, 150, '스테이지 선택', 0x223355, 0xffcc00);
  const btnHome  = makeBtn(cx + 83, 500, 150, '홈으로',        0x222233, 0xaabbcc);
  scene.tweens.add({ targets: [btnStage.bg, btnStage.txt, btnHome.bg, btnHome.txt], alpha: 1, duration: 400, delay: 2400 });

  btnStage.zone.on('pointerdown', () => {
    scene.scene.stop('UIScene');
    scene.scene.start('StageSelectScene');
  });
  btnHome.zone.on('pointerdown', () => {
    scene.scene.stop('UIScene');
    scene.scene.start('DungeonHomeScene');
  });

  logger.debug(`[GAME COMPLETE] all 8 chapters cleared! +${crystalBonus} soul crystals`);
}
