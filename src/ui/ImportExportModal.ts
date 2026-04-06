/**
 * Import confirmation modal for save data.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { importGameState } from '../data/wisdom';

export function showImportConfirm(
  scene: Phaser.Scene,
  parentOv: Phaser.GameObjects.Container,
  toastFn: (msg: string, color?: string) => void,
): void {
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const DW = 260, DH = 140;
  const DX = (CW - DW) / 2, DY = (CH - DH) / 2;

  const dialog = scene.add.container(0, 0).setDepth(55);

  const dBackdrop = scene.add.rectangle(CW / 2, CH / 2, CW, CH, 0x000000, 0.5)
    .setInteractive();
  dialog.add(dBackdrop);

  const dPanel = scene.add.graphics();
  dPanel.fillStyle(0x2a0800, 0.98);
  dPanel.fillRoundedRect(DX, DY, DW, DH, 8);
  dPanel.lineStyle(2, 0xaa4444, 0.9);
  dPanel.strokeRoundedRect(DX, DY, DW, DH, 8);
  dialog.add(dPanel);

  dialog.add(scene.add.text(CW / 2, DY + 20, '⚠️  주의', {
    fontFamily: 'Georgia, serif', fontSize: '14px',
    color: '#ff6644', fontStyle: 'bold',
  }).setOrigin(0.5, 0));

  dialog.add(scene.add.text(CW / 2, DY + 48, '기존 데이터가 덮어씌워집니다.\n클립보드의 세이브 코드를 불러옵니다.', {
    fontFamily: 'sans-serif', fontSize: '11px',
    color: '#e8d090', align: 'center', lineSpacing: 4,
  }).setOrigin(0.5, 0));

  // Confirm
  const confirmBtn = scene.add.text(CW / 2 - 50, DY + DH - 28, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '13px',
    color: '#ff6644', fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive();
  dialog.add(confirmBtn);
  confirmBtn.on('pointerdown', () => {
    navigator.clipboard.readText().then((code) => {
      const result = importGameState(code.trim());
      dialog.destroy(true);
      parentOv.destroy(true);
      if (result.success) {
        toastFn('세이브 복원 완료! 다시 불러옵니다...');
        scene.time.delayedCall(800, () => scene.scene.start('DungeonHomeScene'));
      } else {
        toastFn(result.error ?? '가져오기 실패', '#ff8888');
      }
    }).catch(() => {
      dialog.destroy(true);
      toastFn('클립보드 접근 실패', '#ff8888');
    });
  });

  // Cancel
  const cancelBtn = scene.add.text(CW / 2 + 50, DY + DH - 28, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '13px',
    color: '#888888',
  }).setOrigin(0.5).setInteractive();
  dialog.add(cancelBtn);
  cancelBtn.on('pointerdown', () => { dialog.destroy(true); });

  dBackdrop.on('pointerdown', () => { dialog.destroy(true); });
}
