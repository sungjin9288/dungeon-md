// ─── HomeOverlays ─────────────────────────────────────────────────────────────
// Top-bar, stats bar, and all modal overlays for DungeonHomeScene.
// Extracted to keep DungeonHomeScene.ts under the 800-line limit.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import type { DungeonTheme } from '../themes/themes';
import type { GameState } from '../data/wisdom';
import { getUnlockedSlots } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { showAudioSettings } from './AudioSettingsPanel';
import { openQuestLog, type QuestLogState } from './QuestLogPanel';
import { openPrestigeModal, buildPrestigeBadge } from './PrestigeModal';
import { openSimulationModal } from './SimulationModal';

// ─── Top-bar ─────────────────────────────────────────────────────────────────

export interface TopBarRefs {
  /** Gold / crystal / gem text nodes — used by checkBattleReturn to animate. */
  currencyTexts: Phaser.GameObjects.Text[];
}

/**
 * Build the full top bar: avatar, DM level + XP bar, buttons, currencies.
 * Returns refs the scene needs to keep alive for live currency animation.
 */
export function buildTopBar(
  scene: Phaser.Scene,
  gs: GameState,
  theme: DungeonTheme,
  topH: number,
  questLogState: QuestLogState,
  xpForLevel: (lv: number) => number,
): TopBarRefs {
  const t = theme;
  const g = scene.add.graphics().setDepth(5);
  g.fillStyle(t.panelDark, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, topH);
  g.lineStyle(2, t.panelBorder, 1);
  g.lineBetween(0, topH - 1, CANVAS_WIDTH, topH - 1);

  // DM avatar — stone base + double ring
  g.fillStyle(t.stoneDark, 1);
  g.fillCircle(36, 32, 22);
  g.lineStyle(2, t.panelBorder, 0.8);
  g.strokeCircle(36, 32, 22);
  g.lineStyle(1, t.panelBorder, 0.3);
  g.strokeCircle(36, 32, 26);

  // Pulsing glow aura
  const glowRing = scene.add.graphics().setDepth(4);
  glowRing.setPosition(36, 32);
  glowRing.fillStyle(t.panelBorder, 0.22);
  glowRing.fillCircle(0, 0, 30);
  scene.tweens.add({
    targets: glowRing,
    scaleX: { from: 0.85, to: 1.15 },
    scaleY: { from: 0.85, to: 1.15 },
    alpha:  { from: 0.22, to: 0.05 },
    duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  const dmEmoji = scene.add.text(36, 32, '🏰', {
    fontFamily: 'sans-serif', fontSize: '22px',
  }).setOrigin(0.5).setDepth(6);
  scene.tweens.add({
    targets: dmEmoji, scaleX: 1.06, scaleY: 1.06,
    duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  // Flanking torches
  buildHeaderTorch(scene, 14, topH - 14, t);
  buildHeaderTorch(scene, CANVAS_WIDTH - 14, topH - 14, t);

  // DM level + XP bar
  scene.add.text(66, 12, `던전 마스터  Lv.${gs.dmLevel}`, {
    fontFamily: 'Georgia, serif', fontSize: '13px',
    color: t.panelBorderCSS, fontStyle: 'bold',
  }).setDepth(6);

  const xpBarX = 66, xpBarY = 30, xpBarW = 150, xpBarH = 8;
  const xpPct  = Math.min(gs.dmXP / xpForLevel(gs.dmLevel), 1);
  g.fillStyle(t.stoneDark, 1);
  g.fillRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
  if (xpPct > 0) {
    g.fillStyle(t.panelBorder, 1);
    g.fillRoundedRect(xpBarX, xpBarY, Math.floor(xpBarW * xpPct), xpBarH, 3);
  }
  g.lineStyle(1, t.stoneMid, 0.7);
  g.strokeRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
  scene.add.text(xpBarX + xpBarW / 2, xpBarY + 4, `${gs.dmXP} / ${xpForLevel(gs.dmLevel)} XP`, {
    fontFamily: 'sans-serif', fontSize: '8px', color: t.textSecondary,
  }).setOrigin(0.5).setDepth(6);

  // 📜 Quest log button
  const questBtn = scene.add.text(228, topH / 2, '📜', {
    fontFamily: 'sans-serif', fontSize: '20px',
  }).setOrigin(0.5).setDepth(6).setInteractive();
  questBtn.on('pointerdown', () => openQuestLog(scene, questLogState, gs));

  // Quest notification badge
  const activeQuest = getQuest(gs.activeMainQuestId);
  if (activeQuest) {
    const qprog  = gs.questProgress?.[activeQuest.id];
    const allDone = activeQuest.objectives.every(
      obj => (qprog?.objectives?.[obj.id] ?? 0) >= obj.target,
    );
    if (allDone) {
      const badge = scene.add.graphics().setDepth(7);
      badge.fillStyle(0xff3322, 1);
      badge.fillCircle(241, topH / 2 - 8, 6);
      badge.lineStyle(1, 0xffffff, 0.8);
      badge.strokeCircle(241, topH / 2 - 8, 6);
      scene.add.text(241, topH / 2 - 8, '!', {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setDepth(8);
      scene.tweens.add({
        targets: badge, scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
        duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // ⚙️ Audio settings button
  const settingsBtn = scene.add.text(258, topH / 2, '⚙️', {
    fontFamily: 'sans-serif', fontSize: '18px',
  }).setOrigin(0.5).setDepth(6).setInteractive();
  settingsBtn.on('pointerdown', () => showAudioSettings(scene));

  // ✨ New Game+ button
  if (gs.gameCompleted) {
    const ngBtn = scene.add.text(286, topH / 2, '✨', {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    ngBtn.on('pointerdown', () =>
      openPrestigeModal(scene, () => scene.scene.restart()),
    );
    if ((gs.prestigeLevel ?? 0) > 0) {
      buildPrestigeBadge(scene, CANVAS_WIDTH / 2 + 60, topH / 2, gs.prestigeLevel ?? 0)
        .setDepth(6);
    }
  }

  // Simulation button wired through registry so callers don't need to import it here
  // (kept in buildDungeonGrid in the scene itself)

  // Currencies (right side)
  const currencies = [
    { icon: '💰', val: gs.homeGold,     x: CANVAS_WIDTH - 116 },
    { icon: '💠', val: gs.soulCrystals, x: CANVAS_WIDTH - 68  },
    { icon: '💎', val: gs.gems,          x: CANVAS_WIDTH - 20  },
  ];
  const currencyTexts: Phaser.GameObjects.Text[] = [];
  for (const { icon, val, x } of currencies) {
    scene.add.text(x, 10, icon, { fontFamily: 'sans-serif', fontSize: '14px' })
      .setOrigin(0.5, 0).setDepth(6);
    const valT = scene.add.text(x, 28, val.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#e8d090',
    }).setOrigin(0.5, 0).setDepth(6);
    currencyTexts.push(valT);
  }

  return { currencyTexts };
}

// ─── Header torch ─────────────────────────────────────────────────────────────

/**
 * Small flickering torch drawn with Graphics.
 * Used at both top-bar corners to add atmosphere.
 */
export function buildHeaderTorch(
  scene: Phaser.Scene,
  x: number,
  y: number,
  theme: DungeonTheme,
): void {
  const handle = scene.add.graphics().setDepth(6);
  handle.fillStyle(0x5a3018, 1);
  handle.fillRect(x - 2, y - 2, 4, 12);
  handle.fillStyle(0x2a1008, 1);
  handle.fillRect(x - 2, y + 6, 4, 4);

  const flame = scene.add.graphics().setDepth(7);
  const drawFlame = (scale: number): void => {
    flame.clear();
    flame.fillStyle(0xff7722, 0.85);
    flame.fillCircle(x, y - 6, 5 * scale);
    flame.fillStyle(0xffd066, 0.9);
    flame.fillCircle(x, y - 7, 3 * scale);
    flame.fillStyle(theme.panelBorder, 0.18);
    flame.fillCircle(x, y - 6, 10 * scale);
  };
  drawFlame(1);

  const flickerState = { s: 1 };
  scene.tweens.add({
    targets: flickerState, s: 1.18,
    duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    onUpdate: () => drawFlame(flickerState.s),
  });
}

// ─── Quest progress banner ────────────────────────────────────────────────────

export function buildQuestBanner(
  scene: Phaser.Scene,
  gs: GameState,
  theme: DungeonTheme,
  topH: number,
): void {
  const quest = getQuest(gs.activeMainQuestId);
  if (!quest) return;
  const t = theme;

  const bY = topH;
  const bH = 22;
  const bg = scene.add.graphics().setDepth(4);
  bg.fillStyle(t.stoneDark, 1);
  bg.fillRect(0, bY, CANVAS_WIDTH, bH);
  bg.lineStyle(1, t.panelBorder, 0.35);
  bg.lineBetween(0, bY + bH - 1, CANVAS_WIDTH, bY + bH - 1);

  const obj  = quest.objectives[0];
  const prog = gs.questProgress?.[quest.id];
  const cur  = prog?.objectives?.[obj?.id] ?? 0;
  const tgt  = obj?.target ?? 1;
  const pct  = Math.min(cur / tgt, 1);

  const barX = 8, barW = 80;
  bg.fillStyle(0x1a1a1a, 1);
  bg.fillRoundedRect(barX, bY + 7, barW, 7, 2);
  if (pct > 0) {
    bg.fillStyle(t.panelBorder, 1);
    bg.fillRoundedRect(barX, bY + 7, Math.round(barW * pct), 7, 2);
  }

  scene.add.text(barX + barW + 6, bY + 11,
    `📜 ${quest.title}  ${cur}/${tgt}`,
    { fontFamily: 'sans-serif', fontSize: '10px', color: t.textSecondary },
  ).setOrigin(0, 0.5).setDepth(5);
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

export function buildStatsBar(
  scene: Phaser.Scene,
  gs: GameState,
  theme: DungeonTheme,
  botY: number,
): void {
  const t  = theme;
  const bH = 26;
  const bY = botY - bH;
  const g  = scene.add.graphics().setDepth(3);
  g.fillStyle(t.stoneDark, 1);
  g.fillRect(0, bY, CANVAS_WIDTH, bH);
  g.lineStyle(1, t.panelBorder, 0.2);
  g.lineBetween(0, bY, CANVAS_WIDTH, bY);

  const clearedStages = gs.stageProgress.filter(p => p.bestStars > 0).length;
  const stats = [
    { icon: '💀', val: (gs.totalKills        ?? 0).toLocaleString('ko-KR'), label: '처치'    },
    { icon: '💰', val: (gs.totalGoldEarned   ?? 0).toLocaleString('ko-KR'), label: '황금'    },
    { icon: '🗺', val: `${clearedStages}/62`,                                label: '스테이지' },
  ];

  const colW = CANVAS_WIDTH / stats.length;
  stats.forEach(({ icon, val, label }, i) => {
    const cx = i * colW + colW / 2;
    scene.add.text(cx, bY + 13,
      `${icon} ${val} ${label}`,
      { fontFamily: 'sans-serif', fontSize: '10px', color: t.textSecondary },
    ).setOrigin(0.5).setDepth(4);
    if (i > 0) {
      g.lineStyle(1, t.stoneDark, 0.4);
      g.lineBetween(i * colW, bY + 4, i * colW, bY + bH - 4);
    }
  });
}

// ─── Battle-return overlay ────────────────────────────────────────────────────

export function showBattleReturnOverlay(
  scene: Phaser.Scene,
  result: { goldEarned: number; dmXP: number },
  onDismiss: () => void,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.72);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const PW = 300, PH = 220;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = scene.add.graphics();
  pg.fillStyle(0x081a0a, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 8);
  pg.lineStyle(2, 0x22bb55, 0.9);
  pg.strokeRoundedRect(PX, PY, PW, PH, 8);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '침략 격퇴! ✓', {
    fontFamily: 'Georgia, serif', fontSize: '21px', color: '#44ff88', fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 56, '────────────────────', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#1a4a2a',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 76, [
    `💰  +${result.goldEarned} 골드`,
    `✨  +${result.dmXP} 던전 마스터 XP`,
  ].join('\n'), {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8f0c8',
    align: 'center', lineSpacing: 8,
  }).setOrigin(0.5, 0));

  const btn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44ff88', fontStyle: 'bold',
    backgroundColor: '#0a2a0a', padding: { x: 32, y: 10 },
  }).setOrigin(0.5).setInteractive();
  btn.on('pointerdown', () => { c.destroy(true); onDismiss(); });
  c.add(btn);

  c.setAlpha(0).setScale(0.88);
  scene.tweens.add({
    targets: c, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 220, ease: 'Back.easeOut',
  });
}

// ─── DM level-up overlay ──────────────────────────────────────────────────────

export function showDmLevelUpOverlay(
  scene: Phaser.Scene,
  newLevel: number,
): void {
  const newSlots  = getUnlockedSlots(newLevel);
  const prevSlots = getUnlockedSlots(newLevel - 1);
  const slotUnlocked = newSlots > prevSlots;

  const c = scene.add.container(0, 0).setDepth(75);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const PW = 280, PH = 210;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = scene.add.graphics();
  pg.fillStyle(0x1a1000, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 10);
  pg.lineStyle(2.5, 0xffcc44, 1);
  pg.strokeRoundedRect(PX, PY, PW, PH, 10);
  pg.lineStyle(1, 0xffdd88, 0.3);
  pg.strokeRoundedRect(PX + 4, PY + 4, PW - 8, PH - 8, 8);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 26, '✨ LEVEL UP! ✨', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffcc44', letterSpacing: 3,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 60, `던전 마스터 Lv.${newLevel}`, {
    fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold', color: '#ffee88',
  }).setOrigin(0.5));

  if (slotUnlocked) {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 100, `🏰 방 슬롯 해금!  ${prevSlots} → ${newSlots}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#88ffcc',
      backgroundColor: '#002a1a', padding: { x: 8, y: 4 },
    }).setOrigin(0.5));
  } else {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 100, '전투력이 강화되었습니다', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8d880',
    }).setOrigin(0.5));
  }

  const btn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 36, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffcc44',
    backgroundColor: '#2a1a00', padding: { x: 32, y: 9 },
  }).setOrigin(0.5).setInteractive();
  btn.on('pointerdown', () => {
    scene.tweens.add({
      targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy(true),
    });
  });
  c.add(btn);

  c.setAlpha(0).setScale(0.82);
  scene.tweens.add({
    targets: c, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 280, ease: 'Back.easeOut',
  });

  scene.time.delayedCall(4000, () => {
    if (c.active) {
      scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy(true) });
    }
  });
}

// ─── Battle-defeat overlay ────────────────────────────────────────────────────

export function showBattleDefeatOverlay(
  scene: Phaser.Scene,
  onRetry: () => void,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  const dim = scene.add.graphics();
  dim.fillStyle(0x1a0000, 0.8);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const PW = 300, PH = 200;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = scene.add.graphics();
  pg.fillStyle(0x1a0500, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 8);
  pg.lineStyle(2, 0xaa2222, 0.9);
  pg.strokeRoundedRect(PX, PY, PW, PH, 8);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '던전 함락...', {
    fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ff4444', fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 66, '수호자들이 물러났습니다.\n다시 방어를 준비하세요.', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8a0a0',
    align: 'center', lineSpacing: 6,
  }).setOrigin(0.5));

  const btn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '다시 준비하기', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ff6644',
    backgroundColor: '#2a0000', padding: { x: 24, y: 9 },
  }).setOrigin(0.5).setInteractive();
  btn.on('pointerdown', () => { c.destroy(true); onRetry(); });
  c.add(btn);
}

// ─── Chapter-complete overlay ─────────────────────────────────────────────────

export function showChapterCompleteOverlay(
  scene: Phaser.Scene,
): void {
  const c = scene.add.container(0, 0).setDepth(90);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.85);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const PW = 340, PH = 280;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = scene.add.graphics();
  pg.fillStyle(0x100800, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 10);
  pg.lineStyle(2.5, 0xc8921a, 1);
  pg.strokeRoundedRect(PX, PY, PW, PH, 10);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 30, '✨  Chapter 1  ✨', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 58, '메인 퀘스트 완료!', {
    fontFamily: 'Georgia, serif', fontSize: '24px', color: '#f0e6c8', fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 96, '던전이 더욱 강해졌다.\n연구소가 개방되었습니다.', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8b090',
    align: 'center', lineSpacing: 6,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 148, '─────────────────────', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#3a2810',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 170, '"구미호 계곡에서 이상한 소식이..."', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#806040', fontStyle: 'italic',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 192, '— Chapter 2 티저 —', {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
  }).setOrigin(0.5));

  const btn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 38, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8921a', fontStyle: 'bold',
    backgroundColor: '#1a0f00', padding: { x: 36, y: 12 },
  }).setOrigin(0.5).setInteractive();
  btn.on('pointerdown', () => { c.destroy(true); scene.scene.restart(); });
  c.add(btn);

  c.setScale(0.85).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 300, ease: 'Back.easeOut',
  });
}

// openSimulationModal is used in buildDungeonGrid — re-export for convenience
export { openSimulationModal };
