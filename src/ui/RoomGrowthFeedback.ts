import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import type { RoomMetricDelta, RoomOperationalMetrics } from '../data/dungeonMetrics';

export interface RoomGrowthFeedbackStats {
  readonly threatBefore: number;
  readonly threatAfter: number;
  readonly lootBefore: number;
  readonly lootAfter: number;
  readonly readinessBefore: number;
  readonly readinessAfter: number;
}

export function buildRoomGrowthFeedbackStats(
  before: RoomOperationalMetrics,
  after: RoomOperationalMetrics,
): RoomGrowthFeedbackStats {
  return {
    threatBefore: before.threatScore,
    threatAfter: after.threatScore,
    lootBefore: before.lootPotential,
    lootAfter: after.lootPotential,
    readinessBefore: before.readiness,
    readinessAfter: after.readiness,
  };
}

export function showRoomGrowthFeedback(
  scene: Phaser.Scene,
  delta: RoomMetricDelta,
  title: string,
  stats?: RoomGrowthFeedbackStats,
): void {
  const parts = stats ? formatShiftParts(stats) : formatDeltaParts(delta);
  const summary = parts.length > 0 ? parts.join(' · ') : '운영 상태 유지';
  const positive = delta.threatDelta > 0 || delta.lootDelta > 0 || delta.readinessDelta > 0;
  const accent = positive ? 0x44ccaa : 0xc8921a;
  const textColor = positive ? '#bffff0' : '#ffe0a0';
  const readinessRatio = stats ? Phaser.Math.Clamp(stats.readinessAfter / 100, 0, 1) : 0;

  const w = 286;
  const h = stats ? 72 : 58;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = 74;
  const c = scene.add.container(0, 0).setDepth(240).setAlpha(0).setY(-8);

  const bg = scene.add.graphics();
  bg.fillStyle(0x06100d, 0.96);
  bg.fillRoundedRect(x, y, w, h, 12);
  bg.lineStyle(1.5, accent, 0.88);
  bg.strokeRoundedRect(x, y, w, h, 12);
  bg.fillStyle(accent, 0.14);
  bg.fillRoundedRect(x + 8, y + 7, w - 16, 5, 3);
  c.add(bg);

  c.add(scene.add.text(x + 16, y + 24, title, {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: textColor,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 16, y + 43, summary, {
    fontFamily: 'sans-serif',
    fontSize: stats ? '10px' : '11px',
    color: textColor,
    fontStyle: positive ? 'bold' : 'normal',
    wordWrap: { width: w - 54, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));
  if (stats) {
    bg.fillStyle(0x0b201a, 0.94);
    bg.fillRoundedRect(x + 16, y + 57, w - 54, 6, 3);
    bg.fillStyle(accent, 0.9);
    bg.fillRoundedRect(x + 16, y + 57, Math.max(4, (w - 54) * readinessRatio), 6, 3);
    bg.lineStyle(0.8, accent, 0.44);
    bg.strokeRoundedRect(x + 16, y + 57, w - 54, 6, 3);
    c.add(scene.add.text(x + w - 16, y + 60, `${stats.readinessAfter}%`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
  }
  c.add(scene.add.text(x + w - 18, y + 31, positive ? '▲' : '◆', {
    fontFamily: 'Georgia, serif',
    fontSize: '20px',
    color: textColor,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  scene.tweens.add({
    targets: c,
    alpha: 1,
    y: 0,
    duration: 180,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: c,
        alpha: 0,
        y: -10,
        delay: 1250,
        duration: 320,
        ease: 'Quad.easeIn',
        onComplete: () => c.destroy(),
      });
    },
  });
}

function formatDeltaParts(delta: RoomMetricDelta): string[] {
  return [
    delta.threatDelta !== 0 ? `위협 ${formatSigned(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSigned(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSigned(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => !!part);
}

function formatShiftParts(stats: RoomGrowthFeedbackStats): string[] {
  return [
    stats.threatBefore !== stats.threatAfter ? `위협 ${stats.threatBefore}→${stats.threatAfter}` : null,
    stats.readinessBefore !== stats.readinessAfter ? `준비 ${stats.readinessBefore}→${stats.readinessAfter}%` : null,
    stats.lootBefore !== stats.lootAfter ? `전리품 ${stats.lootBefore}→${stats.lootAfter}` : null,
  ].filter((part): part is string => !!part);
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
