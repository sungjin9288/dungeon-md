/**
 * New Game+ / Prestige confirmation modal.
 *
 * Shows when the player has completed all 8 chapters and taps
 * the prestige button in DungeonHomeScene settings.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState, getPrestigeDmgMult } from '../data/wisdom';
import { applyPrestigeStart } from '../data/prestigeTransactions';
import { addFramedPanel, addInfoRow, addPrimaryActionButton } from './GameUiPrimitives';

const CX = CANVAS_WIDTH / 2;
const PRESTIGE_PANEL_FILL = 0x0d0d22;
const PRESTIGE_ROW_FILL = 0x16052a;
const PRESTIGE_BORDER = 0xcc88ff;
const PRESTIGE_BORDER_CSS = '#cc88ff';
const PRESTIGE_MUTED = '#aaaacc';
const RESET_RED = 0xff7777;
const KEEP_GREEN = 0x77ff99;

// ── Prestige crown badges ─────────────────────────────────────────────────────

const PRESTIGE_LABELS: Record<number, { emoji: string; color: string; title: string }> = {
  0: { emoji: '',    color: '#ffffff', title: '' },
  1: { emoji: '👑',  color: '#c0c0c0', title: '은빛 명성' },
  2: { emoji: '👑',  color: '#ffd700', title: '황금 명성' },
  3: { emoji: '💎',  color: '#aaddff', title: '천상 명성' },
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
  dim.fillStyle(0x000000, 0.88);
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
    radius: 14,
    fillColor: PRESTIGE_PANEL_FILL,
    borderColor: PRESTIGE_BORDER,
    borderAlpha: 0.92,
    borderWidth: 2,
    accentColor: PRESTIGE_BORDER,
    accentAlpha: 0.78,
    glowColor: PRESTIGE_BORDER,
    glowOpacity: 0.12,
    shadowOpacity: 0.72,
    shadowOffsetY: 6,
  });
  addToContainer(container, panel.shadow, panel.panel, panel.glow);

  // ── Header ─────────────────────────────────────────────────────────────────
  const titleT = scene.add.text(CX, panelY + 28, '✨ New Game+ ✨', {
    fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold', color: PRESTIGE_BORDER_CSS,
  }).setOrigin(0.5);
  container.add(titleT);

  const subT = scene.add.text(CX, panelY + 58, '새로운 여정을 시작하시겠습니까?', {
    fontFamily: 'sans-serif', fontSize: '12px', color: PRESTIGE_MUTED,
  }).setOrigin(0.5);
  container.add(subT);

  // Divider
  const div = scene.add.graphics();
  div.lineStyle(1, PRESTIGE_BORDER, 0.28);
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
    fillColor: 0x1a1130,
    borderColor: hexToColor(nextLabel.color),
    labelColor: PRESTIGE_MUTED,
  });
  addToContainer(container, badge.bg, badge.iconText, badge.labelText, badge.valueText);

  scene.tweens.add({
    targets: [badge.bg, badge.iconText, badge.labelText, badge.valueText],
    alpha: 0.72,
    duration: 700,
    yoyo: true,
    repeat: -1,
  });

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
    valueColor: CSS.TORCH_AMBER,
    fillColor: 0x220044,
    borderColor: COLORS.TORCH_GOLD,
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
    radius: 8,
    fillColor: 0x160c18,
    borderColor: RESET_RED,
    borderAlpha: 0.62,
    borderWidth: 1,
    accentColor: RESET_RED,
    accentAlpha: 0.42,
    glowColor: RESET_RED,
    glowOpacity: 0.06,
    shadowOpacity: 0.28,
    shadowOffsetY: 2,
  });
  const keepFrame = addFramedPanel(scene, {
    x: CX + 10,
    y: infoY - 12,
    w: 132,
    h: 126,
    radius: 8,
    fillColor: 0x0c1812,
    borderColor: KEEP_GREEN,
    borderAlpha: 0.62,
    borderWidth: 1,
    accentColor: KEEP_GREEN,
    accentAlpha: 0.42,
    glowColor: KEEP_GREEN,
    glowOpacity: 0.06,
    shadowOpacity: 0.28,
    shadowOffsetY: 2,
  });
  addToContainer(
    container,
    resetFrame.shadow, resetFrame.panel, resetFrame.glow,
    keepFrame.shadow, keepFrame.panel, keepFrame.glow,
  );

  const resetHeaderT = scene.add.text(CX - 76, infoY, '초기화', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ff7777',
  }).setOrigin(0.5);
  container.add(resetHeaderT);
  const keepHeaderT = scene.add.text(CX + 76, infoY, '유지', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#77ff99',
  }).setOrigin(0.5);
  container.add(keepHeaderT);

  resetItems.forEach((item, i) => {
    const t = scene.add.text(CX - 76, infoY + 20 + i * 18, `✗ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#cc5555',
    }).setOrigin(0.5);
    container.add(t);
  });
  keepItems.forEach((item, i) => {
    const t = scene.add.text(CX + 76, infoY + 20 + i * 18, `✓ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#55cc77',
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
      borderColor: hexToColor(curLabel.color),
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
    fillColor: 0x3a0066,
    hoverFillColor: 0x5500aa,
    borderColor: PRESTIGE_BORDER,
    hoverBorderColor: 0xeeaaff,
    textColor: PRESTIGE_BORDER_CSS,
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
    fillColor: 0x1a1a33,
    hoverFillColor: 0x2a2a55,
    borderColor: 0x666688,
    hoverBorderColor: 0x8888aa,
    textColor: PRESTIGE_MUTED,
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
    radius: 7,
    fillColor: 0x1a0033,
    borderColor: hexToColor(label.color),
    borderAlpha: 0.9,
    borderWidth: 1.5,
    glowColor: hexToColor(label.color),
    glowOpacity: 0.08,
    shadowOpacity: 0.24,
    shadowOffsetY: 1,
  });
  addToContainer(badge, frame.shadow, frame.panel, frame.glow);

  const t = scene.add.text(0, 0, `${label.emoji} ×${prestigeLevel}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: label.color,
  }).setOrigin(0.5);
  badge.add(t);
  return badge;
}

function hexToColor(color: string): number {
  const raw = color.startsWith('#') ? color.slice(1) : color;
  const parsed = Number.parseInt(raw, 16);
  return Number.isFinite(parsed) ? parsed : PRESTIGE_BORDER;
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
