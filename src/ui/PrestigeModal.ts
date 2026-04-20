/**
 * New Game+ / Prestige confirmation modal.
 *
 * Shows when the player has completed all 8 chapters and taps
 * the prestige button in DungeonHomeScene settings.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState, startPrestige, getPrestigeDmgMult } from '../data/wisdom';

const CX = CANVAS_WIDTH / 2;

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
  const panel  = scene.add.graphics();
  panel.fillStyle(0x0d0d22, 1);
  panel.fillRoundedRect(CX - 160, panelY, 320, panelH, 14);
  panel.lineStyle(2, 0xcc88ff, 0.9);
  panel.strokeRoundedRect(CX - 160, panelY, 320, panelH, 14);
  container.add(panel);

  // ── Header ─────────────────────────────────────────────────────────────────
  const titleT = scene.add.text(CX, panelY + 28, '✨ New Game+ ✨', {
    fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold', color: '#cc88ff',
  }).setOrigin(0.5);
  container.add(titleT);

  const subT = scene.add.text(CX, panelY + 58, '새로운 여정을 시작하시겠습니까?', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#aaaacc',
  }).setOrigin(0.5);
  container.add(subT);

  // Divider
  const div = scene.add.graphics();
  div.lineStyle(1, 0x4433aa, 0.6);
  div.lineBetween(CX - 130, panelY + 76, CX + 130, panelY + 76);
  container.add(div);

  // ── Prestige badge ─────────────────────────────────────────────────────────
  const badgeT = scene.add.text(CX, panelY + 102, `${nextLabel.emoji} ${nextLabel.title} 달성`, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: nextLabel.color,
  }).setOrigin(0.5);
  container.add(badgeT);

  scene.tweens.add({ targets: badgeT, scaleX: 1.06, scaleY: 1.06, duration: 700, yoyo: true, repeat: -1 });

  // ── Bonus display ──────────────────────────────────────────────────────────
  const bonusY = panelY + 138;
  const bonusBg = scene.add.graphics();
  bonusBg.fillStyle(0x220044, 0.9);
  bonusBg.fillRoundedRect(CX - 130, bonusY, 260, 40, 8);
  container.add(bonusBg);

  const bonusDmgT = scene.add.text(CX, bonusY + 20, `⚔️ 전체 피해 +${nextBonus}% 영구 적용`, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffcc44',
  }).setOrigin(0.5);
  container.add(bonusDmgT);

  // ── What resets / keeps ────────────────────────────────────────────────────
  const infoY = bonusY + 58;
  const resetItems = ['스테이지 진행', '퀘스트 진행', '골드', '던전 슬롯 배치', '컷씬 시청 기록'];
  const keepItems  = ['지혜의 나무', 'DM 레벨', '몬스터 보유', '영혼 결정체', '장비 / 스킨'];

  const resetHeaderT = scene.add.text(CX - 70, infoY, '초기화', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ff7777',
  }).setOrigin(0.5);
  container.add(resetHeaderT);
  const keepHeaderT = scene.add.text(CX + 70, infoY, '유지', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#77ff99',
  }).setOrigin(0.5);
  container.add(keepHeaderT);

  resetItems.forEach((item, i) => {
    const t = scene.add.text(CX - 70, infoY + 18 + i * 20, `✗ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#cc5555',
    }).setOrigin(0.5);
    container.add(t);
  });
  keepItems.forEach((item, i) => {
    const t = scene.add.text(CX + 70, infoY + 18 + i * 20, `✓ ${item}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#55cc77',
    }).setOrigin(0.5);
    container.add(t);
  });

  // Current prestige info
  if (currentPrestige > 0) {
    const curLabel = getPrestigeLabel(currentPrestige);
    const curBonus = getPrestigeDmgMult({ prestigeLevel: currentPrestige } as Parameters<typeof getPrestigeDmgMult>[0]);
    const curT = scene.add.text(CX, infoY + 126, `현재: ${curLabel.emoji} ${curLabel.title} (+${Math.round((curBonus - 1) * 100)}%)`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#8888aa',
    }).setOrigin(0.5);
    container.add(curT);
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  const btnY = panelY + panelH - 74;

  // Confirm button
  const confirmBg = scene.add.graphics();
  const drawConfirm = (f: number) => {
    confirmBg.clear();
    confirmBg.fillStyle(f, 1);
    confirmBg.fillRoundedRect(CX - 130, btnY, 120, 44, 8);
    confirmBg.lineStyle(2, 0xcc88ff, 0.9);
    confirmBg.strokeRoundedRect(CX - 130, btnY, 120, 44, 8);
  };
  drawConfirm(0x3a0066);
  container.add(confirmBg);

  const confirmT = scene.add.text(CX - 70, btnY + 22, '✨ 시작하기', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#cc88ff',
  }).setOrigin(0.5);
  container.add(confirmT);

  const confirmZone = scene.add.zone(CX - 70, btnY + 22, 120, 44).setInteractive().setDepth(depth + 1);
  confirmZone.on('pointerover', () => drawConfirm(0x5500aa));
  confirmZone.on('pointerout',  () => drawConfirm(0x3a0066));
  confirmZone.on('pointerdown', () => {
    const current = loadGameState();
    const next    = startPrestige(current);
    saveGameState(next);
    container.destroy();
    onConfirm();
  });

  // Cancel button
  const cancelBg = scene.add.graphics();
  const drawCancel = (f: number) => {
    cancelBg.clear();
    cancelBg.fillStyle(f, 1);
    cancelBg.fillRoundedRect(CX + 10, btnY, 120, 44, 8);
    cancelBg.lineStyle(2, 0x666688, 0.7);
    cancelBg.strokeRoundedRect(CX + 10, btnY, 120, 44, 8);
  };
  drawCancel(0x1a1a33);
  container.add(cancelBg);

  const cancelT = scene.add.text(CX + 70, btnY + 22, '취소', {
    fontFamily: 'sans-serif', fontSize: '13px', color: '#aaaacc',
  }).setOrigin(0.5);
  container.add(cancelT);

  const cancelZone = scene.add.zone(CX + 70, btnY + 22, 120, 44).setInteractive().setDepth(depth + 1);
  cancelZone.on('pointerover', () => drawCancel(0x2a2a55));
  cancelZone.on('pointerout',  () => drawCancel(0x1a1a33));
  cancelZone.on('pointerdown', () => container.destroy());
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

  const bg = scene.add.graphics();
  bg.fillStyle(0x1a0033, 0.9);
  bg.fillRoundedRect(-40, -12, 80, 24, 6);
  bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(label.color.replace('#', '')).color, 0.9);
  bg.strokeRoundedRect(-40, -12, 80, 24, 6);
  badge.add(bg);

  const t = scene.add.text(0, 0, `${label.emoji} ×${prestigeLevel}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: label.color,
  }).setOrigin(0.5);
  badge.add(t);
  return badge;
}
