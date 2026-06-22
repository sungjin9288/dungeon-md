/**
 * New Game+ / Prestige confirmation modal.
 *
 * Shows when the player has completed all 8 chapters and taps
 * the prestige button in DungeonHomeScene settings.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, getPrestigeDmgMult } from '../data/wisdom';
import { applyPrestigeStart } from '../data/prestigeTransactions';
import { addFramedPanel, addInfoRow, addPrimaryActionButton } from './GameUiPrimitives';
import { getReducedMotion } from '../utils/reducedMotion';

const CX = CANVAS_WIDTH / 2;
const PRESTIGE_ROW_FILL = CASUAL.PANEL_SOFT;
const PRESTIGE_BORDER = CASUAL.PURPLE;
const PRESTIGE_BORDER_CSS = CASUAL_CSS.PURPLE;
const PRESTIGE_MUTED = CASUAL_CSS.INK_SOFT;
const RESET_RED = CASUAL.RED;
const KEEP_GREEN = CASUAL.GREEN;

// ── Prestige crown badges ─────────────────────────────────────────────────────
// 캐주얼 토이: 밝은 크림 카드 위 진한 글자 — 명성 등급 색은 채도 높은 액센트로.

const PRESTIGE_LABELS: Record<number, { emoji: string; color: string; title: string }> = {
  0: { emoji: '',    color: CASUAL_CSS.INK,  title: '' },
  1: { emoji: '👑',  color: '#8a8a8a', title: '은빛 명성' },
  2: { emoji: '👑',  color: CASUAL_CSS.GOLD, title: '황금 명성' },
  3: { emoji: '💎',  color: CASUAL_CSS.BLUE, title: '천상 명성' },
};

function getPrestigeLabel(level: number) {
  return PRESTIGE_LABELS[Math.min(level, 3)] ?? PRESTIGE_LABELS[3];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Opens the prestige modal over the current scene.
 * @param scene The hosting scene.
 * @param onConfirm Called when the player confirms prestige (after state is saved).
 */
export function openPrestigeModal(scene: Phaser.Scene, onConfirm: () => void): void {
  const gs = loadGameState();
  if (!gs.gameCompleted) return;

  const currentPrestige = gs.prestigeLevel ?? 0;
  const nextPrestige    = currentPrestige + 1;
  const nextBonus       = Math.round((nextPrestige * 10));
  const nextLabel       = getPrestigeLabel(nextPrestige);

  const depth = 500;
  const container = scene.add.container(0, 0).setDepth(depth);

  // ── Dim overlay ────────────────────────────────────────────────────────────
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  container.add(dim);

  // ── Panel ──────────────────────────────────────────────────────────────────
  const panelH = 520;
  const panelY = (CANVAS_HEIGHT - panelH) / 2;
  const panel = addFramedPanel(scene, {
    x: CX - 160,
    y: panelY,
    w: 320,
    h: panelH,
    radius: 16,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: PRESTIGE_BORDER,
    accentAlpha: 1,
    glowColor: PRESTIGE_BORDER,
    glowOpacity: 0.1,
    shadowOpacity: 0.42,
    shadowOffsetY: 6,
  });
  addToContainer(container, panel.shadow, panel.panel, panel.glow);

  // ── Header ─────────────────────────────────────────────────────────────────
  const titleT = scene.add.text(CX, panelY + 28, '✨ New Game+ ✨', {
    fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', color: PRESTIGE_BORDER_CSS,
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5);
  container.add(titleT);

  const subT = scene.add.text(CX, panelY + 58, '새로운 여정을 시작하시겠습니까?', {
    fontFamily: 'sans-serif', fontSize: '12px', color: PRESTIGE_MUTED, fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(subT);

  // Divider
  const div = scene.add.graphics();
  div.lineStyle(2, CASUAL.EDGE_SOFT, 0.55);
  div.lineBetween(CX - 130, panelY + 76, CX + 130, panelY + 76);
  container.add(div);

  // ── Prestige badge ─────────────────────────────────────────────────────────
  const badge = addInfoRow(scene, {
    x: CX - 130,
    y: panelY + 88,
    w: 260,
    h: 30,
    icon: nextLabel.emoji,
    label: '다음 명성',
    value: nextLabel.title,
    valueColor: nextLabel.color,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: PRESTIGE_BORDER,
    labelColor: PRESTIGE_MUTED,
  });
  addToContainer(container, badge.bg, badge.iconText, badge.labelText, badge.valueText);

  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: [badge.bg, badge.iconText, badge.labelText, badge.valueText],
      alpha: 0.72,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  // ── Bonus display ──────────────────────────────────────────────────────────
  const bonusY = panelY + 138;
  const bonus = addInfoRow(scene, {
    x: CX - 130,
    y: bonusY,
    w: 260,
    h: 40,
    icon: '⚔',
    label: '영구 피해 보너스',
    value: `+${nextBonus}%`,
    valueColor: CASUAL_CSS.GOLD,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.GOLD,
    labelColor: PRESTIGE_MUTED,
  });
  addToContainer(container, bonus.bg, bonus.iconText, bonus.labelText, bonus.valueText);

  // ── What resets / keeps ────────────────────────────────────────────────────
  const infoY = bonusY + 58;
  const resetItems = ['스테이지 진행', '퀘스트 진행', '골드', '던전 슬롯 배치', '컷씬 시청 기록'];
  const keepItems  = ['지혜의 나무', 'DM 레벨', '몬스터 보유', '영혼 결정체', '장비 / 스킨'];

  const resetFrame = addFramedPanel(scene, {
    x: CX - 142,
    y: infoY - 12,
    w: 132,
    h: 126,
    radius: 10,
    fillColor: CASUAL.PANEL,
    borderColor: RESET_RED,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: RESET_RED,
    accentAlpha: 1,
    glowColor: RESET_RED,
    glowOpacity: 0.05,
    shadowOpacity: 0.24,
    shadowOffsetY: 2,
  });
  const keepFrame = addFramedPanel(scene, {
    x: CX + 10,
    y: infoY - 12,
    w: 132,
    h: 126,
    radius: 10,
    fillColor: CASUAL.PANEL,
    borderColor: KEEP_GREEN,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: KEEP_GREEN,
    accentAlpha: 1,
    glowColor: KEEP_GREEN,
    glowOpacity: 0.05,
    shadowOpacity: 0.24,
    shadowOffsetY: 2,
  });
  addToContainer(
    container,
    resetFrame.shadow, resetFrame.panel, resetFrame.glow,
    keepFrame.shadow, keepFrame.panel, keepFrame.glow,
  );

  const resetHeaderT = scene.add.text(CX - 76, infoY, '초기화', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.RED,
  }).setOrigin(0.5);
  container.add(resetHeaderT);
  const keepHeaderT = scene.add.text(CX + 76, infoY, '유지', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
  }).setOrigin(0.5);
  container.add(keepHeaderT);

  resetItems.forEach((item, i) => {
    const t = scene.add.text(CX - 76, infoY + 20 + i * 18, `✗ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(t);
  });
  keepItems.forEach((item, i) => {
    const t = scene.add.text(CX + 76, infoY + 20 + i * 18, `✓ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(t);
  });

  // Current prestige info
  if (currentPrestige > 0) {
    const curLabel = getPrestigeLabel(currentPrestige);
    const curBonus = getPrestigeDmgMult({ prestigeLevel: currentPrestige } as Parameters<typeof getPrestigeDmgMult>[0]);
    const currentRow = addInfoRow(scene, {
      x: CX - 130,
      y: infoY + 126,
      w: 260,
      h: 24,
      icon: curLabel.emoji,
      label: '현재 명성',
      value: `${curLabel.title} +${Math.round((curBonus - 1) * 100)}%`,
      valueColor: curLabel.color,
      fillColor: PRESTIGE_ROW_FILL,
      borderColor: PRESTIGE_BORDER,
      labelColor: PRESTIGE_MUTED,
    });
    addToContainer(container, currentRow.bg, currentRow.iconText, currentRow.labelText, currentRow.valueText);
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  const btnY = panelY + panelH - 74;

  // Confirm button
  const confirmBtn = addPrimaryActionButton(scene, {
    x: CX - 132,
    y: btnY,
    w: 124,
    h: 44,
    label: '✨ 시작하기',
    fontSize: '13px',
    fillColor: CASUAL.PURPLE,
    hoverFillColor: 0xc488f0,
    borderColor: CASUAL.PURPLE_DK,
    hoverBorderColor: CASUAL.PURPLE_DK,
    textColor: '#ffffff',
    once: true,
    onPress: () => {
      const current = loadGameState();
      const result  = applyPrestigeStart(current);
      if (!result.ok) return;
      if (result.changed) saveGameState(result.state);
      container.destroy();
      onConfirm();
    },
  });
  addToContainer(container, confirmBtn.bg, confirmBtn.text, confirmBtn.zone);

  // Cancel button
  const cancelBtn = addPrimaryActionButton(scene, {
    x: CX + 8,
    y: btnY,
    w: 124,
    h: 44,
    label: '취소',
    fontSize: '13px',
    fillColor: CASUAL.PANEL,
    hoverFillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE,
    hoverBorderColor: CASUAL.EDGE_SOFT,
    textColor: CASUAL_CSS.INK,
    onPress: () => container.destroy(),
  });
  addToContainer(container, cancelBtn.bg, cancelBtn.text, cancelBtn.zone);
}

// ── Prestige badge overlay (shown on home screen) ─────────────────────────────

/**
 * Draws a prestige crown badge near the given position.
 * Returns the container so the caller can position/destroy it.
 */
export function buildPrestigeBadge(scene: Phaser.Scene, x: number, y: number, prestigeLevel: number): Phaser.GameObjects.Container {
  if (prestigeLevel <= 0) return scene.add.container(x, y);
  const label = getPrestigeLabel(prestigeLevel);
  const badge = scene.add.container(x, y);

  const frame = addFramedPanel(scene, {
    x: -40,
    y: -12,
    w: 80,
    h: 24,
    radius: 9,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.PURPLE,
    borderAlpha: 1,
    borderWidth: 2.5,
    glowColor: CASUAL.PURPLE,
    glowOpacity: 0.06,
    shadowOpacity: 0.24,
    shadowOffsetY: 1,
  });
  addToContainer(badge, frame.shadow, frame.panel, frame.glow);

  const t = scene.add.text(0, 0, `${label.emoji} ×${prestigeLevel}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
  }).setOrigin(0.5);
  badge.add(t);
  return badge;
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
