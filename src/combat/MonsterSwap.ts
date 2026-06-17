/**
 * Monster swap system for DungeonScene.
 *
 * Long-press (500ms) an occupied room → enters swap mode.
 * Tap another occupied room → swap monsterSlots.
 * 30-second cooldown between swaps.
 */

import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SwapCallbacks {
  /** Return the monster ID in room [row, col], or null if empty. */
  getMonsterAt: (row: number, col: number) => string | null;
  /** Execute the swap between two rooms. */
  executeSwap: (r1: number, c1: number, r2: number, c2: number) => void;
}

// ─── Swap Manager ──────────────────────────────────────────────────────────────

const SWAP_COOLDOWN_MS = 30_000;
const LONG_PRESS_MS    = 500;

export class MonsterSwapManager {
  private scene: Phaser.Scene;
  private callbacks: SwapCallbacks;

  private swapSource: { row: number; col: number } | null = null;
  private cooldownUntil = 0;
  private longPressTimer?: Phaser.Time.TimerEvent;
  private swapPillBg?: Phaser.GameObjects.Graphics;
  private swapHeader?: Phaser.GameObjects.Text;
  private swapBody?: Phaser.GameObjects.Text;
  private cooldownPillBg?: Phaser.GameObjects.Graphics;
  private cooldownText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, callbacks: SwapCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  /** Call when a room is pressed down. */
  onRoomPointerDown(row: number, col: number): void {
    if (this.swapSource) return; // already in swap mode

    const mId = this.callbacks.getMonsterAt(row, col);
    if (!mId) return; // empty room

    // Start long-press timer
    this.longPressTimer = this.scene.time.delayedCall(LONG_PRESS_MS, () => {
      this.enterSwapMode(row, col);
    });
  }

  /** Call when a room pointer is released (cancel long-press if not yet triggered). */
  onRoomPointerUp(): void {
    if (this.longPressTimer) {
      this.longPressTimer.remove(false);
      this.longPressTimer = undefined;
    }
  }

  /** Call when a room is tapped (pointerdown + pointerup within threshold). */
  onRoomTap(row: number, col: number): boolean {
    if (!this.swapSource) return false; // not in swap mode

    const mId = this.callbacks.getMonsterAt(row, col);
    if (!mId) {
      // Cancel swap mode if empty room tapped
      this.cancelSwapMode();
      return true;
    }

    if (this.swapSource.row === row && this.swapSource.col === col) {
      // Same room — cancel
      this.cancelSwapMode();
      return true;
    }

    // Check cooldown
    const now = this.scene.time.now;
    if (now < this.cooldownUntil) {
      const secsLeft = Math.ceil((this.cooldownUntil - now) / 1000);
      this.showCooldownMessage(secsLeft);
      return true;
    }

    // Execute swap
    this.callbacks.executeSwap(
      this.swapSource.row, this.swapSource.col,
      row, col,
    );
    this.cooldownUntil = now + SWAP_COOLDOWN_MS;
    this.cancelSwapMode();
    return true;
  }

  isInSwapMode(): boolean {
    return this.swapSource !== null;
  }

  private enterSwapMode(row: number, col: number): void {
    this.swapSource = { row, col };

    // CASUAL pill background
    const cx = this.scene.cameras.main.width / 2;
    const pillW = 200, pillH = 44, pillX = cx - pillW / 2, pillY = 90;

    this.swapPillBg = this.scene.add.graphics().setDepth(95);
    this.swapPillBg.fillStyle(CASUAL.PANEL, 1);
    this.swapPillBg.fillRoundedRect(pillX, pillY, pillW, pillH, 8);
    this.swapPillBg.lineStyle(2, CASUAL.EDGE, 1);
    this.swapPillBg.strokeRoundedRect(pillX, pillY, pillW, pillH, 8);

    this.swapHeader = this.scene.add.text(cx, pillY + 12, '🔄 교체 모드', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: CASUAL_CSS.GOLD,
    }).setOrigin(0.5, 0).setDepth(96);

    this.swapBody = this.scene.add.text(cx, pillY + 28, '교체할 방을 선택하세요', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0).setDepth(96);
  }

  cancelSwapMode(): void {
    this.swapSource = null;
    this.swapPillBg?.destroy();
    this.swapPillBg = undefined;
    this.swapHeader?.destroy();
    this.swapHeader = undefined;
    this.swapBody?.destroy();
    this.swapBody = undefined;
  }

  private showCooldownMessage(secsLeft: number): void {
    this.cooldownPillBg?.destroy();
    this.cooldownText?.destroy();

    const cx = this.scene.cameras.main.width / 2;
    const pillW = 200, pillH = 30, pillX = cx - pillW / 2, pillY = 142;

    this.cooldownPillBg = this.scene.add.graphics().setDepth(95);
    this.cooldownPillBg.fillStyle(CASUAL.PANEL, 1);
    this.cooldownPillBg.fillRoundedRect(pillX, pillY, pillW, pillH, 8);
    this.cooldownPillBg.lineStyle(2, CASUAL.EDGE, 1);
    this.cooldownPillBg.strokeRoundedRect(pillX, pillY, pillW, pillH, 8);

    this.cooldownText = this.scene.add.text(
      cx,
      pillY + 15,
      `⏳ 교체 쿨다운: ${secsLeft}초`,
      {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.RED,
      },
    ).setOrigin(0.5).setDepth(96);

    this.scene.time.delayedCall(1500, () => {
      this.cooldownPillBg?.destroy();
      this.cooldownPillBg = undefined;
      this.cooldownText?.destroy();
      this.cooldownText = undefined;
    });
  }

  destroy(): void {
    this.swapPillBg?.destroy();
    this.swapHeader?.destroy();
    this.swapBody?.destroy();
    this.cooldownPillBg?.destroy();
    this.cooldownText?.destroy();
    this.longPressTimer?.remove(false);
  }
}
