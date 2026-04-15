// ─── SpawnPipeline ────────────────────────────────────────────────────────────
// Handles the two-step invader spawn pipeline:
//
//   processSpawnQueue() — schedules each item in the queue with timed delays,
//                         then clears the queue. Called by WaveStart after
//                         building the wave's spawn list.
//
//   spawnInvaderWithDef() — creates one Invader, applies wave-event HP/speed
//                           modifiers, plays spawn VFX, applies synergy slow,
//                           registers it in activeInvaders, and wires up all
//                           per-behavior handlers via InvaderBehaviors.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { InvaderDef, InvaderType } from '../data/invaders';
import { INVADER_DEFS } from '../data/invaders';
import type { BossContext } from './BossBehaviors';
import { playInvaderSpawnEntrance } from './ImpactVfx';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SpawnPipelineContext {
  readonly scene:          Phaser.Scene;
  readonly invaderPath:    Phaser.Curves.Path;
  readonly waveHpMult:     number;
  readonly waveSpdMult:    number;
  readonly dailySpeedMult: number;

  get waveActive():    boolean;
  get activeInvaders(): Invader[];
  get spawnQueue():    Array<{ def: InvaderDef; delay: number }>;
  set spawnQueue(v:    Array<{ def: InvaderDef; delay: number }>);
  set waveHasSpawned(v: boolean);

  setRemainingInvadersRegistry(n: number): void;
  hasSynergy(id: string): boolean;
  applyBehavior(inv: Invader, def: InvaderDef): void;
}

// ─── processSpawnQueue ────────────────────────────────────────────────────────
// Iterates the queued items, schedules each via scene.time.delayedCall, then
// clears the queue. The closure re-reads ctx.waveActive at fire-time so a
// cancelled wave (waveActive = false) suppresses late spawns.

export function processSpawnQueue(ctx: SpawnPipelineContext, initialDelay: number): void {
  let acc = initialDelay;
  ctx.spawnQueue.forEach((item) => {
    ctx.scene.time.delayedCall(acc, () => {
      if (!ctx.waveActive) return;
      spawnInvaderWithDef(ctx, item.def);
    });
    acc += item.delay;
  });
  ctx.spawnQueue = [];
}

// ─── spawnInvaderWithDef ──────────────────────────────────────────────────────
// Creates and configures one Invader:
//   1. Apply wave-event HP/speed multipliers and daily-mode speed modifier.
//   2. Instantiate Invader, set depth, play spawn entrance VFX.
//   3. Apply CELESTIAL_DESCENT synergy slow if active.
//   4. Register in activeInvaders, mark waveHasSpawned.
//   5. Hand off to InvaderBehaviors for per-type passive/phase setup.

export function spawnInvaderWithDef(ctx: SpawnPipelineContext, def: InvaderDef): void {
  const { waveHpMult, waveSpdMult, dailySpeedMult } = ctx;
  const modDef = (waveHpMult !== 1 || waveSpdMult !== 1 || dailySpeedMult !== 1)
    ? { ...def, hp: Math.round(def.hp * waveHpMult), speed: Math.round(def.speed * waveSpdMult * dailySpeedMult) }
    : def;

  const inv = new Invader(ctx.scene, ctx.invaderPath, modDef);
  inv.setDepth(40);

  playInvaderSpawnEntrance(ctx.scene, inv, !!def.isBoss);

  if (ctx.hasSynergy('CELESTIAL_DESCENT')) inv.applySlow(0.75, 3000);

  ctx.activeInvaders.push(inv);
  ctx.waveHasSpawned = true;
  ctx.setRemainingInvadersRegistry(ctx.activeInvaders.filter(i => i.active).length);

  ctx.applyBehavior(inv, def);
}

// ─── spawnInvaderByType ───────────────────────────────────────────────────────
// Convenience wrapper: looks up the InvaderDef from the type string and
// delegates to spawnInvaderWithDef. Used by boss behaviors and kill handlers
// that spawn additional invaders mid-wave.

export function spawnInvaderByType(ctx: SpawnPipelineContext, type: InvaderType): void {
  spawnInvaderWithDef(ctx, INVADER_DEFS[type]);
}

// ─── makeBossContextAdapter ───────────────────────────────────────────────────
// Bridges SpawnPipelineContext into the BossContext that InvaderBehaviors needs.
// Only the fields actually used by applyInvaderBehavior are required here.
// The caller (DungeonScene) provides the full BossContext via applyBehavior
// callback so this adapter is kept minimal.
export type { BossContext };
