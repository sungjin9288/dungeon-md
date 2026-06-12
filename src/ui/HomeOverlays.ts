// ─── HomeOverlays ─────────────────────────────────────────────────────────────
// Top-bar, stats bar, and all modal overlays for DungeonHomeScene.
// Extracted to keep DungeonHomeScene.ts under the 800-line limit.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import type { DungeonTheme } from '../themes/themes';
import type { GameState } from '../data/wisdom';
import { getUnlockedSlots } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { showAudioSettings } from './AudioSettingsPanel';
import { openQuestLog, type QuestLogState } from './QuestLogPanel';
import { openPrestigeModal, buildPrestigeBadge } from './PrestigeModal';
import { openSimulationModal } from './SimulationModal';
import { addFramedPanel, addInfoRow, addPrimaryActionButton } from './GameUiPrimitives';

const OVERLAY_FILL = 0x0e0903;
const OVERLAY_ROW_FILL = 0x120c05;
const VICTORY_GREEN = 0x28c76f;
const VICTORY_GREEN_DARK = 0x0b3519;
const VICTORY_TEXT = '#80ffad';
const DEFEAT_RED = 0xcc3322;
const DEFEAT_RED_DARK = 0x33100c;
const DEFEAT_TEXT = '#ff7a62';

interface BattleReturnGrowthContext {
  readonly previousDmLevel: number;
  readonly nextDmLevel: number;
  readonly previousSlots: number;
  readonly nextSlots: number;
  readonly questCompletionPending?: boolean;
  readonly materialsEarned?: Record<string, number>;
}

interface BattleReturnGrowthSummary {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly valueColor: string;
  readonly fillColor: number;
  readonly borderColor: number;
  readonly note: string;
  readonly buttonLabel: string;
}

interface DmLevelUpOverlayOptions {
  readonly primaryLabel?: string;
  readonly onDismiss?: () => void;
}

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

  // DM level + title badge + XP bar
  const earnedTitleKey = DM_TITLE_PRIORITY.find(k => gs.unlockedFeatures?.includes(k));
  const nameLineY = earnedTitleKey ? 8 : 12;
  const xpBarX = 66, xpBarY = earnedTitleKey ? 38 : 30, xpBarW = 150, xpBarH = 8;

  const dmLevelText = scene.add.text(66, nameLineY, `던전 마스터  Lv.${gs.dmLevel}`, {
    fontFamily: 'Georgia, serif', fontSize: '13px',
    color: t.panelBorderCSS, fontStyle: 'bold',
  }).setDepth(6);

  if (earnedTitleKey) {
    const td = DM_TITLE_MAP[earnedTitleKey];
    scene.add.text(66, nameLineY + 14, `✦ ${td.label}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: td.color, fontStyle: 'italic',
    }).setDepth(6);
  }
  const xpPct  = Math.min(gs.dmXP / xpForLevel(gs.dmLevel), 1);
  g.fillStyle(t.stoneDark, 1);
  g.fillRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
  const xpFill = scene.add.graphics().setDepth(5.5);
  if (xpPct > 0) {
    xpFill.fillStyle(t.panelBorder, 1);
    xpFill.fillRoundedRect(xpBarX + 1, xpBarY + 1, Math.floor((xpBarW - 2) * xpPct), xpBarH - 2, 2);
  }
  g.lineStyle(1, t.stoneMid, 0.7);
  g.strokeRoundedRect(xpBarX, xpBarY, xpBarW, xpBarH, 3);
  const xpText = scene.add.text(xpBarX + xpBarW / 2, xpBarY + 4, `${gs.dmXP} / ${xpForLevel(gs.dmLevel)} XP`, {
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
      radius: 2,
      color: t.panelBorder,
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
  theme: DungeonTheme,
  topH: number,
  onTap?: () => void,
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

  // Show objective action text (more actionable than quest title)
  const objDesc = obj?.description ?? quest.title;
  scene.add.text(barX + barW + 6, bY + 11,
    `📜 ${objDesc}  ${cur}/${tgt}`,
    { fontFamily: 'sans-serif', fontSize: '10px', color: t.textSecondary },
  ).setOrigin(0, 0.5).setDepth(5);

  // Tap hint arrow (right edge)
  if (onTap) {
    scene.add.text(CANVAS_WIDTH - 8, bY + 11, '›', {
      fontFamily: 'sans-serif', fontSize: '12px', color: t.textAccent,
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
    { icon: '🗺', val: `${clearedStages}/${gs.stageProgress.length}`,         label: '스테이지' },
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
  growth?: BattleReturnGrowthContext,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  c.add(buildOverlayDim(scene, 0x000000, 0.74));

  const growthSummary = buildBattleReturnGrowthSummary(growth);
  const PW = 310, PH = 268;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: VICTORY_GREEN,
    borderAlpha: 0.94,
    borderWidth: 2,
    accentColor: VICTORY_GREEN,
    accentAlpha: 0.85,
    glowColor: VICTORY_GREEN,
    glowOpacity: 0.12,
    shadowOpacity: 0.62,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '침략 격퇴! ✓', {
    fontFamily: 'Georgia, serif', fontSize: '21px', color: VICTORY_TEXT, fontStyle: 'bold',
  }).setOrigin(0.5));

  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 64,
    w: PW - 48,
    h: 28,
    icon: '💰',
    label: '전리품 골드',
    value: `+${result.goldEarned.toLocaleString('ko-KR')}`,
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
  })));
  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 100,
    w: PW - 48,
    h: 28,
    icon: '✦',
    label: '던전 마스터 XP',
    value: `+${result.dmXP.toLocaleString('ko-KR')}`,
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
  })));
  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 136,
    w: PW - 48,
    h: 32,
    icon: growthSummary.icon,
    label: growthSummary.label,
    value: growthSummary.value,
    valueColor: growthSummary.valueColor,
    fillColor: growthSummary.fillColor,
    borderColor: growthSummary.borderColor,
  })));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 188, growthSummary.note, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 44,
    y: PY + PH - 58,
    w: PW - 88,
    label: growthSummary.buttonLabel,
    fillColor: VICTORY_GREEN_DARK,
    hoverFillColor: 0x105027,
    borderColor: VICTORY_GREEN,
    textColor: VICTORY_TEXT,
    onPress: () => {
      c.destroy(true);
      onDismiss();
    },
  });

  animateOverlayIn(scene, c);
}

function buildBattleReturnGrowthSummary(
  growth?: BattleReturnGrowthContext,
): BattleReturnGrowthSummary {
  const materialCount = Object.values(growth?.materialsEarned ?? {})
    .reduce((sum, qty) => sum + Math.max(0, qty), 0);
  const leveledUp = !!growth && growth.nextDmLevel > growth.previousDmLevel;
  const slotUnlocked = !!growth && growth.nextSlots > growth.previousSlots;

  if (slotUnlocked && growth) {
    return {
      icon: '🏰',
      label: '던전 확장',
      value: `${growth.previousSlots} → ${growth.nextSlots} 방`,
      valueColor: '#88ffcc',
      fillColor: 0x082018,
      borderColor: 0x1e7a58,
      note: '새 방을 설계해 침입 동선을 더 길게 만들 수 있습니다',
      buttonLabel: '방 확장 확인',
    };
  }

  if (leveledUp && growth) {
    return {
      icon: '✦',
      label: '마스터 성장',
      value: `Lv.${growth.previousDmLevel} → ${growth.nextDmLevel}`,
      valueColor: CSS.TORCH_AMBER,
      fillColor: 0x1f1605,
      borderColor: COLORS.TORCH_GOLD,
      note: '레벨 보상이 다음 방어 준비에 반영됩니다',
      buttonLabel: '성장 확인',
    };
  }

  if (materialCount > 0) {
    return {
      icon: '⚒',
      label: '제작 재료',
      value: `+${materialCount.toLocaleString('ko-KR')}`,
      valueColor: '#9be7ff',
      fillColor: 0x061721,
      borderColor: 0x8a6e30,
      note: '공방에서 수호자 장비를 제작하거나 강화하세요',
      buttonLabel: '공방 준비',
    };
  }

  if (growth?.questCompletionPending) {
    return {
      icon: '📜',
      label: '퀘스트 완료',
      value: '보상 대기',
      valueColor: CSS.TORCH_AMBER,
      fillColor: 0x1f1605,
      borderColor: COLORS.TORCH_GOLD,
      note: '확인 후 메인 퀘스트 보상과 해금이 이어집니다',
      buttonLabel: '퀘스트 보상 확인',
    };
  }

  return {
    icon: '▣',
    label: '던전 성장',
    value: '재정비 가능',
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
    note: '보상이 즉시 저장되었습니다. 방 배치와 장비를 보강하세요',
    buttonLabel: '던전 성장 확인',
  };
}

// ─── DM level-up overlay ──────────────────────────────────────────────────────

export function showDmLevelUpOverlay(
  scene: Phaser.Scene,
  newLevel: number,
  options: DmLevelUpOverlayOptions = {},
): void {
  const newSlots  = getUnlockedSlots(newLevel);
  const prevSlots = getUnlockedSlots(newLevel - 1);
  const slotUnlocked = newSlots > prevSlots;

  const c = scene.add.container(0, 0).setDepth(75);
  c.add(buildOverlayDim(scene, 0x000000, 0.78));

  const PW = 304, PH = 222;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: COLORS.TORCH_GOLD,
    borderAlpha: 1,
    borderWidth: 2.5,
    accentColor: COLORS.TORCH_AMBER,
    accentAlpha: 0.9,
    glowColor: COLORS.TORCH_AMBER,
    glowOpacity: 0.14,
    shadowOpacity: 0.62,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 26, '✨ LEVEL UP! ✨', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: CSS.TORCH_GOLD, letterSpacing: 3,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 60, `던전 마스터 Lv.${newLevel}`, {
    fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold', color: CSS.PARCHMENT,
  }).setOrigin(0.5));

  const row = addInfoRow(scene, {
    x: PX + 24,
    y: PY + 96,
    w: PW - 48,
    h: 30,
    icon: slotUnlocked ? '🏰' : '⚔',
    label: slotUnlocked ? '방 슬롯 해금' : '전투력 강화',
    value: slotUnlocked ? `${prevSlots} → ${newSlots}` : '적용 완료',
    valueColor: slotUnlocked ? '#88ffcc' : CSS.TORCH_AMBER,
    fillColor: slotUnlocked ? 0x082018 : OVERLAY_ROW_FILL,
    borderColor: slotUnlocked ? 0x1e7a58 : COLORS.STONE_MID,
  });
  addToContainer(c, ...Object.values(row));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 148, '다음 방어 준비에 즉시 반영됩니다', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 52,
    y: PY + PH - 58,
    w: PW - 104,
    label: options.primaryLabel ?? '확인',
    fillColor: 0x2a1a00,
    hoverFillColor: 0x3a2608,
    borderColor: COLORS.TORCH_GOLD,
    textColor: CSS.TORCH_GOLD,
    onPress: () => dismissOverlay(scene, c, options.onDismiss),
  });

  animateOverlayIn(scene, c, 0.82, 280);

  scene.time.delayedCall(4000, () => {
    if (c.active) {
      dismissOverlay(scene, c, options.onDismiss);
    }
  });
}

// ─── Battle-defeat overlay ────────────────────────────────────────────────────

export function showBattleDefeatOverlay(
  scene: Phaser.Scene,
  onRetry: () => void,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  c.add(buildOverlayDim(scene, 0x1a0000, 0.82));

  const PW = 310, PH = 208;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: DEFEAT_RED,
    borderAlpha: 0.94,
    borderWidth: 2,
    accentColor: DEFEAT_RED,
    accentAlpha: 0.88,
    glowColor: DEFEAT_RED,
    glowOpacity: 0.12,
    shadowOpacity: 0.64,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '던전 함락...', {
    fontFamily: 'Georgia, serif', fontSize: '20px', color: DEFEAT_TEXT, fontStyle: 'bold',
  }).setOrigin(0.5));

  const row = addInfoRow(scene, {
    x: PX + 24,
    y: PY + 64,
    w: PW - 48,
    h: 34,
    icon: '🛡',
    label: '방어 실패',
    value: '재정비 필요',
    valueColor: DEFEAT_TEXT,
    fillColor: DEFEAT_RED_DARK,
    borderColor: DEFEAT_RED,
  });
  addToContainer(c, ...Object.values(row));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 122, '수호자들이 물러났습니다.\n다시 방어를 준비하세요.', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT_DIM,
    align: 'center', lineSpacing: 5,
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 42,
    y: PY + PH - 58,
    w: PW - 84,
    label: '다시 준비하기',
    fillColor: DEFEAT_RED_DARK,
    hoverFillColor: 0x4a1710,
    borderColor: DEFEAT_RED,
    textColor: DEFEAT_TEXT,
    onPress: () => {
      c.destroy(true);
      onRetry();
    },
  });

  animateOverlayIn(scene, c);
}

// ─── Chapter-complete overlay ─────────────────────────────────────────────────

export function showChapterCompleteOverlay(
  scene: Phaser.Scene,
): void {
  const c = scene.add.container(0, 0).setDepth(90);
  c.add(buildOverlayDim(scene, 0x000000, 0.85));

  const PW = 340, PH = 280;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: COLORS.TORCH_GOLD,
    borderAlpha: 1,
    borderWidth: 2.5,
    accentColor: COLORS.TORCH_AMBER,
    accentAlpha: 0.9,
    glowColor: COLORS.TORCH_AMBER,
    glowOpacity: 0.13,
    shadowOpacity: 0.64,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 30, '✨  Chapter 1  ✨', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_GOLD,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 58, '메인 퀘스트 완료!', {
    fontFamily: 'Georgia, serif', fontSize: '24px', color: CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 96, '던전이 더욱 강해졌다.\n연구소가 개방되었습니다.', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.PARCHMENT_DIM,
    align: 'center', lineSpacing: 6,
  }).setOrigin(0.5));

  const unlockRow = addInfoRow(scene, {
    x: PX + 32,
    y: PY + 130,
    w: PW - 64,
    h: 30,
    icon: '🔓',
    label: '신규 시설',
    value: '연구소 개방',
    valueColor: CSS.TORCH_AMBER,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: COLORS.STONE_MID,
  });
  addToContainer(c, ...Object.values(unlockRow));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 182, '"구미호 계곡에서 이상한 소식이..."', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED, fontStyle: 'italic',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 204, 'Chapter 2 티저', {
    fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 56,
    y: PY + PH - 60,
    w: PW - 112,
    label: '확인',
    fillColor: 0x1a0f00,
    hoverFillColor: 0x2a1a00,
    borderColor: COLORS.TORCH_GOLD,
    textColor: CSS.TORCH_GOLD,
    onPress: () => {
      c.destroy(true);
      scene.scene.restart();
    },
  });

  animateOverlayIn(scene, c, 0.85, 300);
}

function buildOverlayDim(
  scene: Phaser.Scene,
  fillColor: number,
  alpha: number,
): Phaser.GameObjects.Graphics {
  const dim = scene.add.graphics();
  dim.fillStyle(fillColor, alpha);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  return dim;
}

function addOverlayButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly label: string;
    readonly fillColor: number;
    readonly hoverFillColor: number;
    readonly borderColor: number;
    readonly textColor: string;
    readonly onPress: () => void;
  },
): void {
  const button = addPrimaryActionButton(scene, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: 44,
    label: options.label,
    fontSize: '15px',
    fillColor: options.fillColor,
    hoverFillColor: options.hoverFillColor,
    borderColor: options.borderColor,
    hoverBorderColor: COLORS.TORCH_AMBER,
    textColor: options.textColor,
    onPress: options.onPress,
  });
  addToContainer(container, button.bg, button.text, button.zone);
}

function animateOverlayIn(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  fromScale = 0.88,
  duration = 220,
): void {
  container.setAlpha(0).setScale(fromScale);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration,
    ease: 'Back.easeOut',
  });
}

function dismissOverlay(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  onDismiss?: () => void,
): void {
  if (!container.active) return;
  container.setActive(false);
  scene.tweens.add({
    targets: container,
    alpha: 0,
    duration: 200,
    onComplete: () => {
      container.destroy(true);
      onDismiss?.();
    },
  });
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}

// openSimulationModal is used in buildDungeonGrid — re-export for convenience
export { openSimulationModal };
