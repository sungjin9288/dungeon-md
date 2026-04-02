/**
 * Monster swap system for DungeonScene.
 *
 * Long-press (500ms) an occupied room → enters swap mode.
 * Tap another occupied room → swap monsterSlots.
 * 30-second cooldown between swaps.
 */

import Phaser from 'phaser';
import { CSS } from '../constants/colors';

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
  private swapIndicator?: Phaser.GameObjects.Text;
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

    // Show indicator
    this.swapIndicator = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      20,
      '🔄 교체할 몬스터를 선택하세요',
      {
        fontFamily: 'sans-serif', fontSize: '13px', color: CSS.TORCH_AMBER,
        backgroundColor: '#000000cc', padding: { x: 10, y: 4 },
      },
    ).setOrigin(0.5).setDepth(95);
  }

  cancelSwapMode(): void {
    this.swapSource = null;
    this.swapIndicator?.destroy();
    this.swapIndicator = undefined;
  }

  private showCooldownMessage(secsLeft: number): void {
    this.cooldownText?.destroy();
    this.cooldownText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      45,
      `⏳ 교체 쿨다운: ${secsLeft}초`,
      {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ff6644',
        backgroundColor: '#000000cc', padding: { x: 8, y: 3 },
      },
    ).setOrigin(0.5).setDepth(95);

    this.scene.time.delayedCall(1500, () => {
      this.cooldownText?.destroy();
      this.cooldownText = undefined;
    });
  }

  destroy(): void {
    this.swapIndicator?.destroy();
    this.cooldownText?.destroy();
    this.longPressTimer?.remove(false);
  }
}
