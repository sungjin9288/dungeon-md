/**
 * Audio settings overlay with volume sliders and save management buttons.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { audioManager } from '../audio/AudioManager';
import { exportGameState } from '../data/wisdom';
import { showToast } from './Toast';
import { showImportConfirm } from './ImportExportModal';

export function showAudioSettings(scene: Phaser.Scene): void {
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const OW = 310, OH = 400;
  const OX = (CW - OW) / 2, OY = (CH - OH) / 2;
  const DEPTH = 50;

  const ov = scene.add.container(0, 0).setDepth(DEPTH);

  // Backdrop
  const backdrop = scene.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.65)
    .setInteractive();
  ov.add(backdrop);

  // Panel
  const panelG = scene.add.graphics();
  panelG.fillStyle(0x1a0f00, 0.97);
  panelG.fillRoundedRect(OX, OY, OW, OH, 10);
  panelG.lineStyle(2, 0xc8921a, 0.9);
  panelG.strokeRoundedRect(OX, OY, OW, OH, 10);
  ov.add(panelG);

  // Title
  ov.add(scene.add.text(CW / 2, OY + 20, '⚙️  설정', {
    fontFamily: 'Georgia, serif', fontSize: '16px',
    color: '#c8921a', fontStyle: 'bold',
  }).setOrigin(0.5, 0));

  const cfg = audioManager.getSettings();

  const makeRow = (
    labelText: string,
    yOff: number,
    isEnabled: boolean,
    onToggle: (v: boolean) => void,
    volume: number,
    onVolume: (v: number) => void,
  ) => {
    const rowY = OY + yOff;

    // Label
    ov.add(scene.add.text(OX + 16, rowY, labelText, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#e8d090',
    }).setOrigin(0, 0.5));

    // Toggle button
    const toggleBg = scene.add.rectangle(OX + OW - 36, rowY, 44, 22, isEnabled ? 0x226622 : 0x442222, 1)
      .setInteractive();
    const toggleLabel = scene.add.text(OX + OW - 36, rowY,
      isEnabled ? 'ON' : 'OFF', {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: isEnabled ? '#88ff88' : '#ff8888',
      }).setOrigin(0.5);
    ov.add(toggleBg); ov.add(toggleLabel);
    toggleBg.on('pointerdown', () => {
      const next = !isEnabled;
      isEnabled = next;
      toggleBg.setFillStyle(next ? 0x226622 : 0x442222);
      toggleLabel.setText(next ? 'ON' : 'OFF').setColor(next ? '#88ff88' : '#ff8888');
      onToggle(next);
      audioManager.playSfx('button_click');
    });

    // Volume slider track
    const SX = OX + 16, SY = rowY + 20, SW = OW - 52;
    const sliderBg = scene.add.graphics();
    sliderBg.fillStyle(0x3a2800, 1);
    sliderBg.fillRoundedRect(SX, SY - 4, SW, 8, 4);
    ov.add(sliderBg);

    const pct = volume;
    const fillG = scene.add.graphics();
    const drawFill = (p: number) => {
      fillG.clear();
      fillG.fillStyle(0xc8921a, 1);
      fillG.fillRoundedRect(SX, SY - 4, Math.max(8, SW * p), 8, 4);
    };
    drawFill(pct);
    ov.add(fillG);

    // Slider handle
    const knob = scene.add.circle(SX + SW * pct, SY, 8, 0xffd700)
      .setInteractive({ draggable: true });
    ov.add(knob);
    knob.on('drag', (_ptr: unknown, x: number) => {
      const clamped = Math.max(SX, Math.min(SX + SW, x));
      const newPct  = (clamped - SX) / SW;
      knob.x = clamped;
      drawFill(newPct);
      onVolume(newPct);
    });
  };

  makeRow(
    '🎵 배경음악 (BGM)',
    60,
    cfg.bgmEnabled,
    (v) => audioManager.setBgmEnabled(v),
    cfg.bgmVolume,
    (v) => audioManager.setBgmVolume(v),
  );

  makeRow(
    '🔊 효과음 (SFX)',
    140,
    cfg.sfxEnabled,
    (v) => audioManager.setSfxEnabled(v),
    cfg.sfxVolume,
    (v) => audioManager.setSfxVolume(v),
  );

  // ── Divider ────────────────────────────────────────────
  const divG = scene.add.graphics();
  divG.lineStyle(1, 0xc8921a, 0.3);
  divG.lineBetween(OX + 16, OY + 220, OX + OW - 16, OY + 220);
  ov.add(divG);

  ov.add(scene.add.text(CW / 2, OY + 234, '💾  세이브 관리', {
    fontFamily: 'Georgia, serif', fontSize: '14px',
    color: '#c8921a', fontStyle: 'bold',
  }).setOrigin(0.5, 0));

  // Toast helper using shared utility
  const toast = (msg: string, color = '#88ff88') => {
    showToast(scene, msg, { color, depth: DEPTH + 1 });
  };

  // Export button
  const exportBtnBg = scene.add.graphics();
  exportBtnBg.fillStyle(0x224422, 1);
  exportBtnBg.fillRoundedRect(OX + 16, OY + 260, OW - 32, 36, 6);
  exportBtnBg.lineStyle(1, 0x44aa44, 0.7);
  exportBtnBg.strokeRoundedRect(OX + 16, OY + 260, OW - 32, 36, 6);
  ov.add(exportBtnBg);
  ov.add(scene.add.text(CW / 2, OY + 278, '📤  세이브 내보내기 (클립보드 복사)', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#88ff88',
  }).setOrigin(0.5));
  const exportZone = scene.add.zone(CW / 2, OY + 278, OW - 32, 36).setInteractive();
  ov.add(exportZone);
  exportZone.on('pointerdown', () => {
    const code = exportGameState();
    navigator.clipboard.writeText(code).then(
      () => toast('복사 완료! 안전한 곳에 보관하세요.'),
      () => toast('클립보드 접근 실패', '#ff8888'),
    );
  });

  // Import button
  const importBtnBg = scene.add.graphics();
  importBtnBg.fillStyle(0x442222, 1);
  importBtnBg.fillRoundedRect(OX + 16, OY + 306, OW - 32, 36, 6);
  importBtnBg.lineStyle(1, 0xaa4444, 0.7);
  importBtnBg.strokeRoundedRect(OX + 16, OY + 306, OW - 32, 36, 6);
  ov.add(importBtnBg);
  ov.add(scene.add.text(CW / 2, OY + 324, '📥  세이브 가져오기 (클립보드에서)', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#ff8888',
  }).setOrigin(0.5));
  const importZone = scene.add.zone(CW / 2, OY + 324, OW - 32, 36).setInteractive();
  ov.add(importZone);
  importZone.on('pointerdown', () => {
    showImportConfirm(scene, ov, toast);
  });

  // Close button
  const closeBtn = scene.add.text(CW / 2, OY + OH - 22, '닫기', {
    fontFamily: 'Georgia, serif', fontSize: '14px',
    color: '#c8921a', fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive();
  closeBtn.on('pointerdown', () => { ov.destroy(true); });
  ov.add(closeBtn);

  backdrop.on('pointerdown', () => { ov.destroy(true); });
}
