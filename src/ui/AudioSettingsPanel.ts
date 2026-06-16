/**
 * Audio settings overlay with volume sliders and save management buttons.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { audioManager } from '../audio/AudioManager';
import { exportGameState } from '../data/wisdom';
import { showToast } from './Toast';
import { showImportConfirm } from './ImportExportModal';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from './GameUiPrimitives';

const SETTINGS_ROW_FILL = CASUAL.PANEL_SOFT;

export function showAudioSettings(scene: Phaser.Scene): void {
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const OW = 310, OH = 400;
  const OX = (CW - OW) / 2, OY = (CH - OH) / 2;
  const DEPTH = 50;

  const ov = scene.add.container(0, 0).setDepth(DEPTH);

  // Backdrop
  const backdrop = scene.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.5)
    .setInteractive();
  ov.add(backdrop);

  // Panel
  const panel = addFramedPanel(scene, {
    x: OX,
    y: OY,
    w: OW,
    h: OH,
    radius: 16,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.08,
    shadowOpacity: 0.4,
    shadowOffsetY: 5,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  // Title
  ov.add(scene.add.text(CW / 2, OY + 20, '⚙️  설정', {
    fontFamily: 'sans-serif', fontSize: '18px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
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
    const rowBg = scene.add.graphics();
    rowBg.fillStyle(SETTINGS_ROW_FILL, 1);
    rowBg.fillRoundedRect(OX + 16, rowY - 22, OW - 32, 62, GAME_UI.radius.row);
    rowBg.fillStyle(0xffffff, 0.4);
    rowBg.fillRoundedRect(OX + 19, rowY - 19, OW - 38, 3, 2);
    rowBg.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
    rowBg.strokeRoundedRect(OX + 16, rowY - 22, OW - 32, 62, GAME_UI.radius.row);
    ov.add(rowBg);

    // Label
    ov.add(scene.add.text(OX + 28, rowY - 6, labelText, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    const valueLabel = scene.add.text(OX + OW - 86, rowY - 6, `${Math.round(volume * 100)}%`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    ov.add(valueLabel);

    // Toggle button
    const toggleBg = scene.add.graphics();
    const toggleX = OX + OW - 76;
    const toggleY = rowY - 18;
    const toggleW = 48;
    const toggleH = 24;
    const drawToggle = (enabled: boolean): void => {
      toggleBg.clear();
      // thick candy bottom edge
      toggleBg.fillStyle(enabled ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT, 1);
      toggleBg.fillRoundedRect(toggleX, toggleY + 2, toggleW, toggleH, 12);
      // bright cap
      toggleBg.fillStyle(enabled ? CASUAL.GREEN : CASUAL.PANEL_SOFT, 1);
      toggleBg.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, 12);
      toggleBg.lineStyle(2, enabled ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT, 1);
      toggleBg.strokeRoundedRect(toggleX, toggleY, toggleW, toggleH, 12);
      // white knob
      toggleBg.fillStyle(0xffffff, 1);
      toggleBg.fillCircle(toggleX + (enabled ? toggleW - 12 : 12), toggleY + toggleH / 2, 8);
    };
    drawToggle(isEnabled);
    const toggleLabel = scene.add.text(0, 0, isEnabled ? 'ON' : 'OFF', {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: isEnabled ? '#ffffff' : CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0.5);
    const updateToggleLabel = (enabled: boolean): void => {
      toggleLabel
        .setText(enabled ? 'ON' : 'OFF')
        .setColor(enabled ? '#ffffff' : CASUAL_CSS.INK_SOFT)
        .setPosition(toggleX + (enabled ? 14 : toggleW - 14), toggleY + toggleH / 2);
    };
    updateToggleLabel(isEnabled);
    const toggleZone = scene.add.zone(toggleX, toggleY, toggleW, toggleH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    ov.add(toggleBg); ov.add(toggleLabel); ov.add(toggleZone);
    toggleZone.on('pointerdown', () => {
      const next = !isEnabled;
      isEnabled = next;
      drawToggle(next);
      updateToggleLabel(next);
      onToggle(next);
      audioManager.playSfx('button_click');
    });

    // Volume slider track
    const SX = OX + 28, SY = rowY + 23, SW = OW - 56;
    const sliderBg = scene.add.graphics();
    sliderBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    sliderBg.fillRoundedRect(SX, SY - 4, SW, 8, 4);
    sliderBg.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
    sliderBg.strokeRoundedRect(SX, SY - 4, SW, 8, 4);
    ov.add(sliderBg);

    const pct = volume;
    const fillG = scene.add.graphics();
    const drawFill = (p: number) => {
      fillG.clear();
      fillG.fillStyle(CASUAL.GOLD, 1);
      fillG.fillRoundedRect(SX, SY - 4, Math.max(8, SW * p), 8, 4);
    };
    drawFill(pct);
    ov.add(fillG);

    // Slider handle — candy knob
    const knob = scene.add.circle(SX + SW * pct, SY, 9, CASUAL.GOLD)
      .setStrokeStyle(2.5, CASUAL.GOLD_DK)
      .setInteractive({ draggable: true });
    ov.add(knob);
    knob.on('drag', (_ptr: unknown, x: number) => {
      const clamped = Math.max(SX, Math.min(SX + SW, x));
      const newPct  = (clamped - SX) / SW;
      knob.x = clamped;
      valueLabel.setText(`${Math.round(newPct * 100)}%`);
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
  divG.lineStyle(2, CASUAL.EDGE_SOFT, 0.55);
  divG.lineBetween(OX + 16, OY + 220, OX + OW - 16, OY + 220);
  ov.add(divG);

  ov.add(scene.add.text(CW / 2, OY + 234, '💾  세이브 관리', {
    fontFamily: 'sans-serif', fontSize: '14px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5, 0));

  // Toast helper using shared utility
  const toast = (msg: string, color: string = CASUAL_CSS.GREEN) => {
    showToast(scene, msg, { color, depth: DEPTH + 1 });
  };

  // Export button
  const exportButton = addPrimaryActionButton(scene, {
    x: OX + 16,
    y: OY + 258,
    w: OW - 32,
    h: 40,
    label: '📤  세이브 내보내기',
    fontSize: '12px',
    fillColor: CASUAL.BLUE,
    hoverFillColor: 0x66bcf4,
    borderColor: CASUAL.BLUE_DK,
    hoverBorderColor: CASUAL.BLUE_DK,
    textColor: '#ffffff',
    onPress: () => {
      const code = exportGameState();
      navigator.clipboard.writeText(code).then(
        () => toast('복사 완료! 안전한 곳에 보관하세요.'),
        () => toast('클립보드 접근 실패', CASUAL_CSS.RED),
      );
    },
  });
  addToContainer(ov, exportButton.bg, exportButton.text, exportButton.zone);

  // Import button
  const importButton = addPrimaryActionButton(scene, {
    x: OX + 16,
    y: OY + 306,
    w: OW - 32,
    h: 40,
    label: '📥  세이브 가져오기',
    fontSize: '12px',
    fillColor: CASUAL.RED,
    hoverFillColor: 0xf57a66,
    borderColor: CASUAL.RED_DK,
    hoverBorderColor: CASUAL.RED_DK,
    textColor: '#ffffff',
    onPress: () => showImportConfirm(scene, ov, toast),
  });
  addToContainer(ov, importButton.bg, importButton.text, importButton.zone);

  // Close button — green candy
  const closeBtn = addPrimaryActionButton(scene, {
    x: OX + 78,
    y: OY + OH - 44,
    w: OW - 156,
    h: 34,
    label: '닫기',
    fontSize: '13px',
    fillColor: CASUAL.GREEN,
    hoverFillColor: 0x6fdc70,
    borderColor: CASUAL.GREEN_DK,
    hoverBorderColor: CASUAL.GREEN_DK,
    textColor: '#ffffff',
    onPress: () => { ov.destroy(true); },
  });
  addToContainer(ov, closeBtn.bg, closeBtn.text, closeBtn.zone);

  backdrop.on('pointerdown', () => { ov.destroy(true); });
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
