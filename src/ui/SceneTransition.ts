/**
 * SceneTransition — soft fade-out → start-next-scene helper.
 *
 * Companion to the auto fade-in installed in main.ts (runs on every scene
 * CREATE). Use this for cases where you want the old scene to dissolve
 * before the new one appears, instead of a hard cut.
 *
 * Usage:
 *   import { fadeToScene } from '../ui/SceneTransition';
 *   fadeToScene(this, 'DungeonHomeScene');
 *   // or with payload:
 *   fadeToScene(this, 'DungeonScene', { stageId: 5 });
 *
 * Default fade duration is 180ms — mirrors the auto fade-in so transitions
 * feel symmetric (total 360ms door-to-door).
 */

import Phaser from 'phaser';
import { getReducedMotion } from '../utils/reducedMotion';

const DEFAULT_FADE_MS = 180;

export function fadeToScene(
  scene: Phaser.Scene,
  nextSceneKey: string,
  data?: object,
  durationMs: number = DEFAULT_FADE_MS,
): void {
  const cam = scene.cameras.main;
  if (!cam || getReducedMotion()) {
    scene.scene.start(nextSceneKey, data);
    return;
  }

  // Guard against double-start if caller triggers twice quickly.
  // Phaser's fadeEffect.isRunning is the most reliable flag.
  if (cam.fadeEffect?.isRunning) return;

  cam.fadeOut(durationMs, 0, 0, 0);
  cam.once(
    Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
    () => {
      scene.scene.start(nextSceneKey, data);
    },
  );
}

/**
 * Fade out current scene and STOP it (instead of starting a new one).
 * Useful for closing overlays.
 */
export function fadeOutAndStop(
  scene: Phaser.Scene,
  durationMs: number = DEFAULT_FADE_MS,
): void {
  const cam = scene.cameras.main;
  if (!cam || getReducedMotion()) {
    scene.scene.stop();
    return;
  }
  if (cam.fadeEffect?.isRunning) return;

  cam.fadeOut(durationMs, 0, 0, 0);
  cam.once(
    Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
    () => {
      scene.scene.stop();
    },
  );
}
