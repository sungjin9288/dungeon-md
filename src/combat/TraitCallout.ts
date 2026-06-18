// ─── TraitCallout ─────────────────────────────────────────────────────────────
// In-battle legibility: the first time a special invader appears, signal the
// HUD (UIScene) to flash a banner naming it + describing its trait, so the
// player learns how to counter the rich (but otherwise hidden) behavior system.
//
// Announced once per behavior per session (the `seen` Set lives on DungeonScene,
// which persists across battles within a run) — no re-teaching, bounded noise.
//
// The banner itself is rendered by UIScene (the zoom-free HUD overlay); the
// DungeonScene's world camera is DPR-zoomed, so a screen-fixed banner must live
// in the HUD scene. We bridge via the shared registry (same pattern as
// `battleSpeed`) so this stays decoupled from UIScene.

import type Phaser from 'phaser';
import type { Invader } from '../objects/Invader';
import { getTraitBlurb } from '../data/invaderTraits';

export interface TraitCalloutPayload {
  readonly title: string;
  readonly blurb: string;
}

/**
 * Announce an invader's trait the first time that behavior is seen.
 * No-op for invaders without a notable behavior (e.g. plain fillers, bosses).
 */
export function announceTraitOnce(scene: Phaser.Scene, seen: Set<string>, inv: Invader): void {
  const behavior = inv.def.behavior;
  if (!behavior || seen.has(behavior)) return;
  const blurb = getTraitBlurb(behavior);
  if (!blurb) return;
  seen.add(behavior);
  const payload: TraitCalloutPayload = { title: `${inv.def.koreanName} 등장`, blurb };
  scene.registry.set('traitCallout', payload);
}
