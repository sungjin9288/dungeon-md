// ─── HomeTopBar ───────────────────────────────────────────────────────────────
// Top-bar, header torches, quest banner, and stats bar for DungeonHomeScene.
// Split from HomeOverlays.ts to keep each module under the 800-line limit.

import type Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import type { DungeonTheme } from '../themes/themes';
import type { GameState } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { showAudioSettings } from './AudioSettingsPanel';
import { openQuestLog, type QuestLogState } from './QuestLogPanel';
import { openPrestigeModal, buildPrestigeBadge } from './PrestigeModal';

// ─── DM Title data ────────────────────────────────────────────────────────────
// Maps unlockedFeatures key → display label + color.
// Add new entries here as chapters / events are released.

const DM_TITLE_MAP: Record<string, { label: string; color: string }> = {
  abyss_title:   { label: '원초의 심연 정복자', color: '#cc88ff' },
  heaven_title:  { label: '신계 정복자',         color: '#aaddff' },
  volcano_title: { label: '화염 산맥의 영웅',     color: '#ff9944' },
};

/** Priority order — first match wins (highest prestige first). */
const DM_TITLE_PRIORITY = ['abyss_title', 'heaven_title', 'volcano_title'] as const;

// ─── Top-bar ─────────────────────────────────────────────────────────────────

export interface TopBarRefs {
  /** Gold / crystal / gem text nodes — used by checkBattleReturn to animate. */
  currencyTexts: Phaser.GameObjects.Text[];
  /** DM level and XP refs — updated when battle rewards settle on the home scene. */
  dmLevelText: Phaser.GameObjects.Text;
  xpText: Phaser.GameObjects.Text;
  xpFill: Phaser.GameObjects.Graphics;
  xpFillBounds: { x: number; y: number; w: number; h: number; radius: number; color: number };
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
  // Chunky cream header bar with brown bottom edge
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, topH);
  g.fillStyle(0xffffff, 0.12);
  g.fillRect(0, 0, CANVAS_WIDTH, 3);
  g.fillStyle(CASUAL.EDGE, 1);
  g.fillRect(0, topH - 4, CANVAS_WIDTH, 4);

  // DM avatar — cream base + chunky brown ring
  g.fillStyle(CASUAL.GOLD, 1);
  g.fillCircle(36, 32, 22);
  g.lineStyle(3, CASUAL.EDGE, 1);
  g.strokeCircle(36, 32, 22);
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(36, 26, 12);

  // Pulsing glow aura
  const glowRing = scene.add.graphics().setDepth(4);
  glowRing.setPosition(36, 32);
  glowRing.fillStyle(CASUAL.GOLD, 0.3);
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

  // DM level + title badge + XP bar
  const earnedTitleKey = DM_TITLE_PRIORITY.find(k => gs.unlockedFeatures?.includes(k));
  const nameLineY = earnedTitleKey ? 8 : 12;
  const xpBarX = 66, xpBarY = earnedTitleKey ? 38 : 30, xpBarW = 150, xpBarH = 8;

  const dmLevelText = scene.add.text(66, nameLineY, `던전 마스터  Lv.${gs.dmLevel}`, {
    fontFamily: 'sans-serif', fontSize: '13px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setDepth(6);

  if (earnedTitleKey) {
    const td = DM_TITLE_MAP[earnedTitleKey];
    scene.add.text(66, nameLineY + 14, `✦ ${td.label}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: td.color, fontStyle: 'italic',
    }).setDepth(6);
  }
  const xpPct  = Math.min(gs.dmXP / xpForLevel(gs.dmLevel), 1);
  g.fillStyle(0xe9d3ad, 1);
  g.fillRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 4);
  const xpFill = scene.add.graphics().setDepth(5.5);
  if (xpPct > 0) {
    xpFill.fillStyle(CASUAL.GREEN, 1);
    xpFill.fillRoundedRect(xpBarX + 1, xpBarY + 1, Math.floor((xpBarW - 2) * xpPct), xpBarH - 2, 3);
  }
  g.lineStyle(1.5, CASUAL.EDGE, 0.8);
  g.strokeRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 4);
  const xpText = scene.add.text(xpBarX + xpBarW / 2, xpBarY + 4, `${gs.dmXP} / ${xpForLevel(gs.dmLevel)} XP`, {
    fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
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
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(6);
    currencyTexts.push(valT);
  }

  return {
    currencyTexts,
    dmLevelText,
    xpText,
    xpFill,
    xpFillBounds: {
      x: xpBarX + 1,
      y: xpBarY + 1,
      w: xpBarW - 2,
      h: xpBarH - 2,
      radius: 3,
      color: CASUAL.GREEN,
    },
  };
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
  _theme: DungeonTheme,
  topH: number,
  onTap?: () => void,
): void {
  const quest = getQuest(gs.activeMainQuestId);
  if (!quest) return;

  const bY = topH;
  const bH = 22;
  const bg = scene.add.graphics().setDepth(4);
  // cream banner with glossy top highlight + thin brown bottom edge
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRect(0, bY, CANVAS_WIDTH, bH);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRect(0, bY, CANVAS_WIDTH, 2);
  bg.fillStyle(CASUAL.EDGE, 1);
  bg.fillRect(0, bY + bH - 2, CANVAS_WIDTH, 2);

  const obj  = quest.objectives[0];
  const prog = gs.questProgress?.[quest.id];
  const cur  = prog?.objectives?.[obj?.id] ?? 0;
  const tgt  = obj?.target ?? 1;
  const pct  = Math.min(cur / tgt, 1);

  const barX = 8, barW = 80;
  // progress track — soft cream + brown edge
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(barX, bY + 7, barW, 7, 3);
  if (pct > 0) {
    bg.fillStyle(CASUAL.GREEN, 1);
    bg.fillRoundedRect(barX, bY + 7, Math.round(barW * pct), 7, 3);
  }
  bg.lineStyle(1, CASUAL.EDGE, 0.6);
  bg.strokeRoundedRect(barX, bY + 7, barW, 7, 3);

  // Show objective action text (more actionable than quest title) — INK label
  // with the progress "N/M" as a GOLD accent appended right after it.
  const objDesc = obj?.description ?? quest.title;
  const label = scene.add.text(barX + barW + 6, bY + 11, `📜 ${objDesc}  `, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(5);
  scene.add.text(label.x + label.width, bY + 11, `${cur}/${tgt}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(5);

  // Tap hint arrow (right edge)
  if (onTap) {
    scene.add.text(CANVAS_WIDTH - 8, bY + 11, '›', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(5);
    scene.add.zone(0, bY, CANVAS_WIDTH, bH)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(6)
      .on('pointerdown', onTap);
  }
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

export function buildStatsBar(
  scene: Phaser.Scene,
  gs: GameState,
  _theme: DungeonTheme,
  botY: number,
): void {
  const bH = 26;
  const bY = botY - bH;
  const g  = scene.add.graphics().setDepth(3);
  // cream stats bar — glossy top highlight + thin brown top edge
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRect(0, bY, CANVAS_WIDTH, bH);
  g.fillStyle(0xffffff, 0.12);
  g.fillRect(0, bY, CANVAS_WIDTH, 2);
  g.fillStyle(CASUAL.EDGE, 1);
  g.fillRect(0, bY, CANVAS_WIDTH, 1);

  const clearedStages = gs.stageProgress.filter(p => p.bestStars > 0).length;
  const stats = [
    { icon: '💀', val: (gs.totalKills        ?? 0).toLocaleString('ko-KR'), label: '처치'    },
    { icon: '💰', val: (gs.totalGoldEarned   ?? 0).toLocaleString('ko-KR'), label: '황금'    },
    { icon: '🗺', val: `${clearedStages}/${gs.stageProgress.length}`,         label: '스테이지' },
  ];

  const colW = CANVAS_WIDTH / stats.length;
  stats.forEach(({ icon, val, label }, i) => {
    const cx = i * colW + colW / 2;
    // value (INK) + label (INK_SOFT) — two-tone but kept centered as a block.
    // Measure both parts hidden, then place left→right so the block stays on cx.
    const valStr = `${icon} ${val} `;
    const valMeasure = scene.add.text(0, 0, valStr, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    }).setVisible(false);
    const labelMeasure = scene.add.text(0, 0, label, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    }).setVisible(false);
    const blockW = valMeasure.width + labelMeasure.width;
    const startX = cx - blockW / 2;
    valMeasure.destroy();
    labelMeasure.destroy();
    const valText = scene.add.text(startX, bY + 13, valStr, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(4);
    scene.add.text(startX + valText.width, bY + 13, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(4);
    if (i > 0) {
      g.lineStyle(1, CASUAL.EDGE_SOFT, 0.5);
      g.lineBetween(i * colW, bY + 5, i * colW, bY + bH - 5);
    }
  });
}
