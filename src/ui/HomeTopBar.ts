// ─── HomeTopBar ───────────────────────────────────────────────────────────────
// Top-bar, header torches, quest banner, and stats bar for DungeonHomeScene.
// Split from HomeOverlays.ts to keep each module under the 800-line limit.

import type Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import type { DungeonTheme } from '../themes/themes';
import type { GameState } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { showAudioSettings } from './AudioSettingsPanel';
import { openQuestLog, type QuestLogState } from './QuestLogPanel';
import { openPrestigeModal, buildPrestigeBadge } from './PrestigeModal';
import { getReducedMotion } from '../utils/reducedMotion';
import { DM_TITLE_MAP, DM_TITLE_PRIORITY } from '../data/dmTitles';

const HOME_HUD = {
  stone: 0x090b0a,
  stoneRaised: 0x121411,
  edge: 0x5f4d32,
  brass: 0xa98245,
  jade: 0x4f9b78,
  parchment: '#e7d6b5',
  muted: '#a89c86',
} as const;

function drawDmSeal(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x050605, 0.96);
  g.fillCircle(x, y, 19);
  g.lineStyle(2, HOME_HUD.brass, 0.78);
  g.strokeCircle(x, y, 19);
  g.strokeCircle(x, y, 14);
  g.fillStyle(HOME_HUD.brass, 0.86);
  g.fillTriangle(x - 10, y - 5, x - 3, y - 13, x - 1, y - 3);
  g.fillTriangle(x + 10, y - 5, x + 3, y - 13, x + 1, y - 3);
  g.fillTriangle(x - 10, y - 3, x + 10, y - 3, x, y + 13);
  g.fillStyle(HOME_HUD.stone, 1);
  g.fillCircle(x - 4, y + 1, 1.5);
  g.fillCircle(x + 4, y + 1, 1.5);
}

function drawTopControlSigil(
  g: Phaser.GameObjects.Graphics,
  kind: 'quest' | 'settings' | 'prestige',
  x: number,
  y: number,
): void {
  g.fillStyle(HOME_HUD.stoneRaised, 0.98);
  g.fillCircle(x, y, 14);
  g.lineStyle(1, HOME_HUD.edge, 0.9);
  g.strokeCircle(x, y, 14);
  g.lineStyle(2, HOME_HUD.brass, 0.82);
  if (kind === 'quest') {
    g.strokeRoundedRect(x - 7, y - 9, 14, 18, 2);
    g.lineBetween(x - 4, y - 4, x + 4, y - 4);
    g.lineBetween(x - 4, y + 1, x + 4, y + 1);
    g.lineBetween(x - 4, y + 6, x + 2, y + 6);
    return;
  }
  if (kind === 'prestige') {
    g.fillStyle(HOME_HUD.brass, 0.86);
    g.fillTriangle(x, y - 10, x - 3, y - 2, x + 3, y - 2);
    g.fillTriangle(x, y + 10, x - 3, y + 2, x + 3, y + 2);
    g.fillTriangle(x - 10, y, x - 2, y - 3, x - 2, y + 3);
    g.fillTriangle(x + 10, y, x + 2, y - 3, x + 2, y + 3);
    return;
  }
  g.strokeCircle(x, y, 6);
  g.strokeCircle(x, y, 2);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    g.lineBetween(
      x + Math.cos(angle) * 8,
      y + Math.sin(angle) * 8,
      x + Math.cos(angle) * 11,
      y + Math.sin(angle) * 11,
    );
  }
}

function drawCurrencySigil(
  g: Phaser.GameObjects.Graphics,
  kind: 'gold' | 'soul' | 'gem',
  x: number,
  y: number,
): void {
  const color = kind === 'gold' ? 0xd0a64c : kind === 'soul' ? 0x69b49a : 0x72a8c4;
  g.lineStyle(1.5, color, 0.9);
  g.fillStyle(color, 0.16);
  if (kind === 'gold') {
    g.fillCircle(x, y, 6);
    g.strokeCircle(x, y, 6);
    g.lineBetween(x - 3, y, x + 3, y);
    return;
  }
  if (kind === 'soul') {
    g.fillCircle(x, y, 6);
    g.strokeCircle(x, y, 6);
    g.strokeCircle(x, y, 2.5);
    g.lineBetween(x, y - 9, x, y - 6);
    g.lineBetween(x, y + 6, x, y + 9);
    return;
  }
  g.fillTriangle(x, y - 7, x - 7, y - 1, x, y + 7);
  g.fillTriangle(x, y - 7, x + 7, y - 1, x, y + 7);
  g.strokeTriangle(x, y - 7, x - 7, y - 1, x, y + 7);
  g.strokeTriangle(x, y - 7, x + 7, y - 1, x, y + 7);
}

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
  const reducedMotion = getReducedMotion();
  // Soot-black lintel: the HUD is dungeon hardware, not a generic app bar.
  g.fillStyle(HOME_HUD.stone, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, topH);
  g.fillStyle(HOME_HUD.brass, 0.42);
  g.fillRect(0, topH - 1, CANVAS_WIDTH, 1);
  g.fillStyle(0xffffff, 0.035);
  g.fillRect(8, 3, CANVAS_WIDTH - 16, 2);

  drawDmSeal(g, 28, 30);

  // Decorative aura is static in reduced motion.
  const glowRing = scene.add.graphics().setDepth(4);
  glowRing.setPosition(28, 30);
  glowRing.fillStyle(HOME_HUD.brass, 0.10);
  glowRing.fillCircle(0, 0, 23);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: glowRing,
      scaleX: { from: 0.94, to: 1.06 },
      scaleY: { from: 0.94, to: 1.06 },
      alpha:  { from: 0.18, to: 0.08 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // Flanking torches
  buildHeaderTorch(scene, 14, topH - 14, t);
  buildHeaderTorch(scene, CANVAS_WIDTH - 14, topH - 14, t);

  const prestigeLevel = gs.prestigeLevel ?? 0;
  if (prestigeLevel > 0) {
    buildPrestigeBadge(scene, 28, topH - 13, prestigeLevel).setDepth(8);
  }

  // DM level + title badge + XP bar
  const earnedTitleKey = DM_TITLE_PRIORITY.find(k => gs.unlockedFeatures?.includes(k));
  const nameLineY = earnedTitleKey ? 7 : 12;
  const xpBarX = 54, xpBarY = earnedTitleKey ? 40 : 34, xpBarW = 126, xpBarH = 8;

  const dmLevelText = scene.add.text(54, nameLineY, `던전 마스터  Lv.${gs.dmLevel}`, {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: HOME_HUD.parchment, fontStyle: 'bold',
  }).setDepth(6);

  if (earnedTitleKey) {
    const td = DM_TITLE_MAP[earnedTitleKey];
    scene.add.text(54, nameLineY + 15, `✦ ${td.label}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: td.color, fontStyle: 'italic',
    }).setDepth(6);
  }
  const xpPct  = Math.min(gs.dmXP / xpForLevel(gs.dmLevel), 1);
  g.fillStyle(0x020302, 1);
  g.fillRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 4);
  const xpFill = scene.add.graphics().setDepth(5.5);
  if (xpPct > 0) {
    xpFill.fillStyle(HOME_HUD.jade, 1);
    xpFill.fillRoundedRect(xpBarX + 1, xpBarY + 1, Math.floor((xpBarW - 2) * xpPct), xpBarH - 2, 3);
  }
  g.lineStyle(1, HOME_HUD.edge, 0.78);
  g.strokeRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 4);
  const xpText = scene.add.text(xpBarX + xpBarW / 2, xpBarY + 4, `${gs.dmXP} / ${xpForLevel(gs.dmLevel)} XP`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: HOME_HUD.muted, fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(6);

  // Quest log button
  const questX = gs.gameCompleted ? 178 : 202;
  drawTopControlSigil(g, 'quest', questX, topH / 2);
  scene.add.zone(questX, topH / 2, 44, 44).setDepth(7)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => openQuestLog(scene, questLogState, gs));

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
      badge.fillCircle(questX + 11, topH / 2 - 9, 6);
      badge.lineStyle(1, 0xffffff, 0.8);
      badge.strokeCircle(questX + 11, topH / 2 - 9, 6);
      scene.add.text(questX + 11, topH / 2 - 9, '!', {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setDepth(8);
      if (!reducedMotion) {
        scene.tweens.add({
          targets: badge, scaleX: { from: 1, to: 1.18 }, scaleY: { from: 1, to: 1.18 },
          duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    }
  }

  // Audio settings button
  const settingsX = gs.gameCompleted ? 222 : 246;
  drawTopControlSigil(g, 'settings', settingsX, topH / 2);
  scene.add.zone(settingsX, topH / 2, 44, 44).setDepth(7)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => showAudioSettings(scene));

  // New Game+ button
  if (gs.gameCompleted) {
    const ngX = 266;
    drawTopControlSigil(g, 'prestige', ngX, topH / 2);
    scene.add.zone(ngX, topH / 2, 44, 44).setDepth(7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => openPrestigeModal(scene, () => scene.scene.restart()));
  }

  // Simulation button wired through registry so callers don't need to import it here
  // (kept in buildDungeonGrid in the scene itself)

  // Currencies (right side)
  const currencies = [
    { kind: 'gold' as const, val: gs.homeGold,     x: CANVAS_WIDTH - 94 },
    { kind: 'soul' as const, val: gs.soulCrystals, x: CANVAS_WIDTH - 54 },
    { kind: 'gem' as const,  val: gs.gems,          x: CANVAS_WIDTH - 16 },
  ];
  const currencyTexts: Phaser.GameObjects.Text[] = [];
  for (const { kind, val, x } of currencies) {
    drawCurrencySigil(g, kind, x, 14);
    const valT = scene.add.text(x, 27, val.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '12px', color: HOME_HUD.parchment, fontStyle: 'bold',
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
      color: HOME_HUD.jade,
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

  // Flame flicker is decorative — under reduced motion the torch stays lit but still.
  if (getReducedMotion()) return;

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
): Phaser.GameObjects.GameObject[] {
  const quest = getQuest(gs.activeMainQuestId);
  if (!quest) return [];

  const bY = topH;
  const bH = 22;
  const bg = scene.add.graphics().setDepth(4);
  const parts: Phaser.GameObjects.GameObject[] = [bg];
  // Secondary quest line: no card treatment.
  bg.fillStyle(HOME_HUD.stoneRaised, 0.98);
  bg.fillRect(0, bY, CANVAS_WIDTH, bH);
  bg.fillStyle(HOME_HUD.edge, 0.56);
  bg.fillRect(0, bY + bH - 1, CANVAS_WIDTH, 1);

  const prog = gs.questProgress?.[quest.id];
  // The first objective still open: showing objectives[0] kept a finished
  // "build 3 rooms" on screen while the quest waited on its invasion.
  const obj  = quest.objectives.find(o => (prog?.objectives?.[o.id] ?? 0) < o.target) ?? quest.objectives[0];
  const cur  = prog?.objectives?.[obj?.id] ?? 0;
  const tgt  = obj?.target ?? 1;
  const pct  = Math.min(cur / tgt, 1);

  const barX = 8, barW = 80;
  // progress track — soft cream + brown edge
  bg.fillStyle(0x020302, 1);
  bg.fillRoundedRect(barX, bY + 7, barW, 7, 3);
  if (pct > 0) {
    bg.fillStyle(HOME_HUD.jade, 1);
    bg.fillRoundedRect(barX, bY + 7, Math.round(barW * pct), 7, 3);
  }
  bg.lineStyle(1, HOME_HUD.edge, 0.7);
  bg.strokeRoundedRect(barX, bY + 7, barW, 7, 3);

  // Show objective action text (more actionable than quest title) — INK label
  // with the progress "N/M" as a GOLD accent appended right after it.
  const objDesc = obj?.description ?? quest.title;
  const label = scene.add.text(barX + barW + 6, bY + 11, `임무 · ${objDesc}  `, {
    fontFamily: 'sans-serif', fontSize: '11px', color: HOME_HUD.parchment, fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(5);
  parts.push(label, scene.add.text(label.x + label.width, bY + 11, `${cur}/${tgt}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#d8b869', fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(5));

  // Tap hint arrow (right edge)
  if (onTap) {
    parts.push(scene.add.text(CANVAS_WIDTH - 8, bY + 11, '›', {
      fontFamily: 'sans-serif', fontSize: '12px', color: HOME_HUD.muted, fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(5));
    parts.push(scene.add.zone(0, bY + bH / 2, CANVAS_WIDTH, 44)
      .setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(6)
      .on('pointerdown', onTap));
  }
  return parts;
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
  // Quiet ledger above navigation.
  g.fillStyle(HOME_HUD.stone, 1);
  g.fillRect(0, bY, CANVAS_WIDTH, bH);
  g.fillStyle(HOME_HUD.edge, 0.54);
  g.fillRect(0, bY, CANVAS_WIDTH, 1);

  const clearedStages = gs.stageProgress.filter(p => p.bestStars > 0).length;
  const stats = [
    { val: (gs.totalKills        ?? 0).toLocaleString('ko-KR'), label: '처치' },
    { val: (gs.totalGoldEarned   ?? 0).toLocaleString('ko-KR'), label: '황금' },
    { val: `${clearedStages}/${gs.stageProgress.length}`, label: '정복' },
  ];

  const colW = CANVAS_WIDTH / stats.length;
  stats.forEach(({ val, label }, i) => {
    const cx = i * colW + colW / 2;
    // value (INK) + label (INK_SOFT) — two-tone but kept centered as a block.
    // Measure both parts hidden, then place left→right so the block stays on cx.
    const valStr = `${val} `;
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
      fontFamily: 'sans-serif', fontSize: '10px', color: HOME_HUD.parchment, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(4);
    scene.add.text(startX + valText.width, bY + 13, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: HOME_HUD.muted, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(4);
    if (i > 0) {
      g.lineStyle(1, HOME_HUD.edge, 0.5);
      g.lineBetween(i * colW, bY + 5, i * colW, bY + bH - 5);
    }
  });
}
