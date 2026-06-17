/**
 * Reusable gated pop-in helper for Phaser 3 scenes.
 * Always checks getReducedMotion() — if true, snaps to final state
 * immediately and calls onComplete synchronously (accessibility gate).
 */
import type Phaser from 'phaser';
import { getReducedMotion } from '../utils/reducedMotion';

/** Options for popIn. All fields are optional — sensible defaults apply. */
export interface PopInOpts {
  /** Target scale to pop to (default: 1). */
  scale?: number;
  /**
   * Tween duration in ms (default: 220).
   * Clamped to [120, 320].
   */
  duration?: number;
  /** Phaser ease string (default: 'Back.easeOut'). */
  ease?: string;
  /** Delay before the tween starts in ms (default: 0). */
  delay?: number;
  /**
   * When true (default), also animates alpha from 0 → 1.
   * Set to false to skip the alpha component.
   */
  fromAlpha?: boolean;
  /** Called when the animation completes (or immediately when reduced-motion). */
  onComplete?: () => void;
}

/**
 * Animate a Phaser game object popping in from scale-0.
 *
 * @param scene   - The Phaser scene that owns the tween manager.
 * @param target  - Any Phaser game object with setScale / setAlpha.
 * @param opts    - Optional configuration (see PopInOpts).
 */
export function popIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & {
    setScale: (s: number) => unknown;
    setAlpha: (a: number) => unknown;
  },
  opts: PopInOpts = {},
): void {
  const {
    scale = 1,
    duration: rawDuration = 220,
    ease = 'Back.easeOut',
    delay = 0,
    fromAlpha = true,
    onComplete,
  } = opts;

  const duration = Math.min(320, Math.max(120, rawDuration));

  // Accessibility gate — snap to final state immediately.
  if (getReducedMotion()) {
    target.setScale(scale);
    if (fromAlpha) target.setAlpha(1);
    onComplete?.();
    return;
  }

  // Start from hidden state.
  target.setScale(0);
  if (fromAlpha) target.setAlpha(0);

  const tweenConfig: Phaser.Types.Tweens.TweenBuilderConfig = {
    targets: target,
    scaleX: scale,
    scaleY: scale,
    duration,
    ease,
    delay,
    onComplete: onComplete ? () => { onComplete(); } : undefined,
  };

  if (fromAlpha) {
    (tweenConfig as Record<string, unknown>).alpha = 1;
  }

  scene.tweens.add(tweenConfig);
}
