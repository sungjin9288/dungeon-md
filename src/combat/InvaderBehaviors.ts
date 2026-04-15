// ─── Invader Behavior Dispatch ───────────────────────────────────────────────
// Extracted from DungeonScene.spawnInvaderWithDef. Each InvaderDef has a
// `behavior` tag that drives state setup (shields, immunities, phase handlers,
// scheduled cycles, ...). The scene used to own a giant switch that fanned out
// to thin wrappers which themselves forwarded into BossBehaviors — this file
// collapses both layers into one place.

import { Invader } from '../objects/Invader';
import type { InvaderDef } from '../data/invaders';
import {
  type BossContext,
  scheduleNinjaInvisibilityCycle,
  setupFoxQueenPhase,
  setupUndyingKnight,
  setupDecoyClone,
  scheduleVoidTeleport,
  setupDragonKingPhase,
  setupVoidStealthElite,
  setupDeathEmissary,
} from './BossBehaviors';
import {
  setupThreeGodDestroyer,
  setupShadowRealm,
  setupEternalEmperor,
  setupGodEmperor,
} from './LateBossBehaviors';
import { showHolyPaladinAura } from './VisualEffects';
import { showRallyCryEffect } from './ImpactVfx';

/**
 * Apply the behavior described by {@link def.behavior} to a freshly spawned
 * invader. All shared state comes from the BossContext, which already knows
 * about the scene, active invaders, and speed multiplier.
 *
 * Behaviors fall into three groups:
 *   1. Simple flag toggles (SIEGE_SHIELD, TRAP_IMMUNITY, ...).
 *   2. Inline one-shot logic (STEALTH fade-in, RALLY_CRY buff pulse).
 *   3. Multi-phase boss setup delegated to BossBehaviors.
 */
export function applyInvaderBehavior(
  ctx: BossContext,
  inv: Invader,
  def: InvaderDef,
): void {
  const { scene, activeInvaders, speedMult } = ctx;

  switch (def.behavior) {
    // ── Chapter 1–2 simple flag behaviors ────────────────────────────────────
    case 'SIEGE_SHIELD':
      inv.hasSiegeShield = true;
      break;

    case 'TRAP_IMMUNITY':
      inv.isTrapImmune = true;
      break;

    case 'BERSERKER_RAGE':
      inv.hasBerserkerRage = true;
      break;

    case 'IRON_BODY':
      inv.hasIronBody   = true;
      inv.isUnstoppable = true;
      break;

    case 'STEALTH':
      inv.isInvisible    = true;
      inv.voidPhaseUntil = scene.time.now + 3000 / speedMult;
      inv.setAlpha(0.25);
      scheduleNinjaInvisibilityCycle(ctx, inv);
      break;

    case 'DIVINE_WARD':
      if (def.type === 'holy_paladin') {
        inv.magicImmuneUntil = scene.time.now + 5000 / speedMult;
        showHolyPaladinAura(scene, inv);
      } else {
        inv.isMagicImmune = true;
      }
      break;

    case 'RALLY_CRY':
      // mercenary_captain has its own aura loop — skip the one-shot pulse.
      if (def.type !== 'mercenary_captain') {
        scene.time.delayedCall(200, () => {
          if (!inv.active) return;
          activeInvaders.forEach(other => {
            if (other !== inv && other.active
                && Math.hypot(other.x - inv.x, other.y - inv.y) < 200) {
              other.applySpeedBoost(1.2, 5000);
            }
          });
          showRallyCryEffect(scene, inv.x, inv.y);
        });
      }
      break;

    // ── Chapter 2–6 boss multi-phase handlers ────────────────────────────────
    case 'FOX_QUEEN_PHASE':
      setupFoxQueenPhase(ctx, inv);
      break;

    case 'UNDYING_KNIGHT':
      setupUndyingKnight(ctx, inv);
      break;

    case 'DECOY_CLONE':
      setupDecoyClone(ctx, inv);
      break;

    case 'POISON_TRAIL':
      // handled per-tick in runPoisonTrailDamage
      break;

    case 'VOID_TELEPORT':
      scheduleVoidTeleport(ctx, inv);
      break;

    case 'DRAGON_KING_PHASE':
      setupDragonKingPhase(ctx, inv);
      break;

    case 'VOID_STEALTH_ELITE':
      setupVoidStealthElite(ctx, inv);
      break;

    case 'STUN_IMMUNE':
      inv.isDamageImmune = true;
      setupDeathEmissary(ctx, inv);
      break;

    case 'FIVE_PHASE':
      setupThreeGodDestroyer(ctx, inv);
      break;

    case 'MIRROR_SHIELD':
      inv.hasMirrorShield     = true;
      inv.mirrorHitsRemaining = 3;
      inv.mirrorGfx           = scene.add.graphics().setDepth(inv.depth + 1);
      break;

    case 'SWARM':
      // Handled in the invaderKilled event (splits into 3 swarm_spawn on death).
      break;

    case 'SHADOW_REALM':
      setupShadowRealm(ctx, inv);
      break;

    case 'EMPEROR_PHASE':
      setupEternalEmperor(ctx, inv);
      break;

    case 'GOD_EMPEROR_PHASE':
      setupGodEmperor(ctx, inv);
      break;
  }
}
