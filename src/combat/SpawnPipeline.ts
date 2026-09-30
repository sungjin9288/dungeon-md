// ─── SpawnPipeline ────────────────────────────────────────────────────────────
// Handles the two-step invader spawn pipeline:
//
//   processSpawnQueue() — schedules each item in the queue with timed delays.
//                         Items stay queued until their timer fires so wave-end
//                         detection can distinguish pending from completed spawns.
//
//   spawnInvaderWithDef() — creates one Invader, applies wave-event HP/speed
//                           modifiers, plays spawn VFX, applies synergy slow,
//                           registers it in activeInvaders, and wires up all
//                           per-behavior handlers via InvaderBehaviors.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { InvaderDef, InvaderType } from '../data/invaders';
import { INVADER_DEFS } from '../data/invaders';
import type { WeeklyBoss } from '../data/daily';
import type { BossContext } from './BossBehaviors';
import { resolveSpawnDef } from './spawnDefResolve';
import { playInvaderSpawnEntrance } from './ImpactVfx';
import { announceTraitOnce } from './TraitCallout';
import type { VisitorKind } from '../data/visitors';

/** 생성 대기열 한 칸. `visitor`가 없으면 토벌대. */
export interface SpawnQueueItem {
  readonly def: InvaderDef;
  readonly delay: number;
  readonly visitor?: VisitorKind;
}

/** 손님 종류의 경로와 목표 방(없으면 null — 토벌대 경로로 심장부). */
export interface VisitorRoute {
  readonly path: Phaser.Curves.Path;
  readonly targetSlot: number | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SpawnPipelineContext {
  readonly scene:          Phaser.Scene;
  readonly invaderPath:    Phaser.Curves.Path;
  readonly waveHpMult:     number;
  readonly waveSpdMult:    number;
  readonly dailySpeedMult: number;
  readonly synergyInvaderMoveMult: number;
  /** Active weekly boss config (weeklyBossMode), or null outside the mode. */
  readonly weeklyBoss:     WeeklyBoss | null;
  /** Behaviors already announced this run — for the once-per-trait callout. */
  readonly seenTraits:     Set<string>;

  get waveActive():    boolean;
  get activeInvaders(): Invader[];
  get spawnQueue():    SpawnQueueItem[];
  set spawnQueue(v:    SpawnQueueItem[]);
  set waveHasSpawned(v: boolean);

  setRemainingInvadersRegistry(n: number): void;
  hasSynergy(id: string): boolean;
  applyBehavior(inv: Invader, def: InvaderDef): void;
  visitorRoute(kind: VisitorKind): VisitorRoute;
}

// ─── processSpawnQueue ────────────────────────────────────────────────────────
// Iterates the queued items and schedules each via scene.time.delayedCall. A
// queued item is removed only when its timer fires. The membership check also
// prevents a stale timer from spawning into a later wave after the queue was
// replaced.

export function processSpawnQueue(ctx: SpawnPipelineContext, initialDelay: number): void {
  let acc = initialDelay;
  ctx.spawnQueue.forEach((item) => {
    ctx.scene.time.delayedCall(acc, () => {
      const pendingIndex = ctx.spawnQueue.indexOf(item);
      if (pendingIndex < 0) return;
      ctx.spawnQueue = [
        ...ctx.spawnQueue.slice(0, pendingIndex),
        ...ctx.spawnQueue.slice(pendingIndex + 1),
      ];
      if (!ctx.waveActive) return;
      spawnInvaderWithDef(ctx, item.def, item.visitor);
    });
    acc += item.delay;
  });
}

// ─── spawnInvaderWithDef ──────────────────────────────────────────────────────
// Creates and configures one Invader:
//   1. Resolve the effective def (wave multipliers + weekly boss override).
//   2. Instantiate Invader, set depth, play spawn entrance VFX.
//   3. Apply CELESTIAL_DESCENT synergy slow if active.
//   4. Register in activeInvaders, mark waveHasSpawned.
//   5. Hand off to InvaderBehaviors for per-type passive/phase setup.

export function spawnInvaderWithDef(ctx: SpawnPipelineContext, def: InvaderDef, visitor: VisitorKind = 'raider'): void {
  const modDef = resolveSpawnDef(def, ctx, ctx.weeklyBoss);
  const route = visitor === 'raider' ? { path: ctx.invaderPath, targetSlot: null } : ctx.visitorRoute(visitor);

  const inv = new Invader(ctx.scene, route.path, modDef);
  // No target room: the visitor behaves as a raider and heads for the heart.
  inv.visitor = route.targetSlot === null ? 'raider' : visitor;
  inv.visitorTargetSlot = route.targetSlot;
  inv.setDepth(40);
  inv.markVisitor(inv.visitor);

  playInvaderSpawnEntrance(ctx.scene, inv, !!modDef.isBoss);

  if (ctx.hasSynergy('CELESTIAL_DESCENT')) inv.applySlow(0.75, 3000);

  ctx.activeInvaders.push(inv);
  ctx.waveHasSpawned = true;
  ctx.setRemainingInvadersRegistry(ctx.activeInvaders.filter(i => i.active).length);

  ctx.applyBehavior(inv, modDef);

  // Teach the player about a special enemy the first time it appears.
  announceTraitOnce(ctx.scene, ctx.seenTraits, inv);
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
