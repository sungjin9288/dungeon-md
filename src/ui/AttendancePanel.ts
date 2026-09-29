/**
 * Attendance reward modal — a 7-day login-reward cycle grid with a claim button.
 * Pairs with the pure logic in src/data/attendance.ts (claimDailyAttendance).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { getTodayString } from '../data/daily';
import { audioManager } from '../audio/AudioManager';
import { addFramedPanel } from './GameUiPrimitives';
import {
  ATTENDANCE_REWARDS,
  ATTENDANCE_CYCLE,
  canClaimAttendance,
  claimDailyAttendance,
  type AttendanceReward,
} from '../data/attendance';
import { commitSceneState } from './sceneStateCommit';

function rewardText(rw: AttendanceReward): string {
  const parts: string[] = [];
  if (rw.gold)         parts.push(`골드 ${rw.gold}`);
  if (rw.gems)         parts.push(`보석 ${rw.gems}`);
  if (rw.soulCrystals) parts.push(`결정 ${rw.soulCrystals}`);
  return parts.join(' ');
}

export function showAttendancePanel(scene: Phaser.Scene): void {
  const gs = loadGameState();
  const today = getTodayString();
  const claimable = canClaimAttendance(gs, today);
  const pos = (gs.attendanceDay ?? 0) % ATTENDANCE_CYCLE;   // next reward index

  const c = scene.add.container(0, 0).setDepth(95);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  dim.on('pointerdown', () => c.destroy());
  c.add(dim);

  const PW = 344, PH = 312;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX, y: PY, w: PW, h: PH, radius: 16,
    fillColor: CASUAL.PANEL, borderColor: CASUAL.EDGE, borderAlpha: 1, borderWidth: 3,
    accentColor: CASUAL.GOLD, accentAlpha: 1, shadowOpacity: 0.32, shadowOffsetY: 6,
  });
  [panel.shadow, panel.panel, panel.glow].forEach(o => { if (o) c.add(o); });

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 22, '출석 보상', {
    fontFamily: 'sans-serif', fontSize: '18px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    stroke: '#0a0806', strokeThickness: 3,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 44, `누적 출석 ${gs.attendanceDay ?? 0}일 · 7일마다 보너스`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  // ── 7-day cycle grid (4 + 3) ──
  const cellW = 76, cellH = 62, gap = 8;
  const gy0 = PY + 62;
  const COLS = 4;
  ATTENDANCE_REWARDS.forEach((rw, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const rowCount = row === 0 ? COLS : ATTENDANCE_CYCLE - COLS;
    const rowW = rowCount * cellW + (rowCount - 1) * gap;
    const rowStartX = (CANVAS_WIDTH - rowW) / 2;
    const cx = rowStartX + col * (cellW + gap);
    const cy = gy0 + row * (cellH + gap);

    const isNext    = i === pos;
    const isClaimed = i < pos;                     // earlier in this cycle
    const highlight = isNext && claimable;         // today's claimable reward

    const g = scene.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.3);
    g.fillRoundedRect(cx, cy + 2, cellW, cellH, 8);
    g.fillStyle(isClaimed ? CASUAL.GREEN_DK : highlight ? CASUAL.GOLD_DK : CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(cx, cy, cellW, cellH, 8);
    g.lineStyle(highlight ? 3 : 2, highlight ? CASUAL.GOLD : CASUAL.EDGE, 1);
    g.strokeRoundedRect(cx, cy, cellW, cellH, 8);
    c.add(g);

    c.add(scene.add.text(cx + cellW / 2, cy + 11, `Day ${rw.day}`, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
      color: isClaimed || highlight ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    c.add(scene.add.text(cx + cellW / 2, cy + 32, rewardText(rw), {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, align: 'center', wordWrap: { width: cellW - 8 },
    }).setOrigin(0.5));
    if (isClaimed) {
      c.add(scene.add.text(cx + cellW - 8, cy + 8, '✓', {
        fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
      }).setOrigin(1, 0));
    }
  });

  // ── Claim / done button ──
  const bw = 220, bh = 42;
  const bx = (CANVAS_WIDTH - bw) / 2, by = PY + PH - 56;
  const btn = scene.add.graphics();
  const fill = claimable ? CASUAL.GREEN : CASUAL.PANEL_SOFT;
  btn.fillStyle(CASUAL.SHADOW, 0.4);  btn.fillRoundedRect(bx, by + 2, bw, bh, 11);
  btn.fillStyle(fill, 1);             btn.fillRoundedRect(bx, by, bw, bh, 11);
  btn.lineStyle(2, claimable ? CASUAL.GREEN_DK : CASUAL.EDGE, 1);
  btn.strokeRoundedRect(bx, by, bw, bh, 11);
  c.add(btn);
  c.add(scene.add.text(CANVAS_WIDTH / 2, by + bh / 2, claimable ? '오늘 보상 수령' : '오늘 수령 완료 · 내일 또 오세요', {
    fontFamily: 'sans-serif', fontSize: claimable ? '14px' : '11px', fontStyle: 'bold',
    color: claimable ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
    stroke: claimable ? '#06351f' : undefined, strokeThickness: claimable ? 2 : 0,
  }).setOrigin(0.5));

  if (claimable) {
    const zone = scene.add.zone(CANVAS_WIDTH / 2, by + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      const result = claimDailyAttendance(loadGameState(), getTodayString());
      if (!result.ok) return;
      commitSceneState(scene, result.state);
      audioManager.playSfx('gold_earn');
      c.destroy();
      showAttendanceToast(scene, result.reward ? rewardText(result.reward) : '');
    });
    c.add(zone);
  }
}

function showAttendanceToast(scene: Phaser.Scene, rewardStr: string): void {
  const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, `출석 보상  ${rewardStr}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    color: CASUAL_CSS.WHITE, backgroundColor: '#1c3a1c', padding: { x: 14, y: 8 },
  }).setOrigin(0.5).setDepth(500);
  scene.tweens.add({
    targets: t, y: t.y - 30, alpha: 0, duration: 700, delay: 1100,
    onComplete: () => t.destroy(),
  });
}
