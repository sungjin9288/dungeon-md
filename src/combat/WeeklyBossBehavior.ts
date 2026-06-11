// ─── Weekly Boss Behavior ─────────────────────────────────────────────────────
// Scene-side application of the weekly raid boss phase mechanic
// (data/weeklyBossPhases.ts). In weeklyBossMode this REPLACES the boss's
// native chapter behavior so all eight pool bosses share one predictable
// raid ruleset:
//
//   - phase = equal HP segments (5 phases → 80/60/40/20% boundaries)
//   - on phase entry: banner + camera shake/flash, permanent speed-up,
//     escort add summons
//
// HP polling follows the BossBehaviors.setupFoxQueenPhase pattern (recursive
// delayedCall) so a cancelled wave or boss death stops the loop naturally.

import { Invader } from '../objects/Invader';
import type { WeeklyBoss } from '../data/daily';
import { getWeeklyBossPhase, getWeeklyBossPhaseMod } from '../data/weeklyBossPhases';
import { type BossContext, showBossPhaseText } from './BossBehaviors';
import { logger } from '../utils/logger';

const PHASE_POLL_MS = 500;
/** Effectively-permanent speed boost duration (same pattern as DRAGON_KING). */
const PHASE_SPEED_DURATION_MS = 9_999_999;
const SUMMON_STAGGER_MS = 400;

export function setupWeeklyBossPhases(ctx: BossContext, inv: Invader, boss: WeeklyBoss): void {
  const { scene } = ctx;

  ctx.bossHud.build(inv.maxHp, {
    label:      `👑 ${boss.name}`,
    bgColor:    0x1a0530,
    labelColor: '#cc88ff',
  });

  let phase = 1;

  const enterPhase = (next: number, summons: number) => {
    const mod = getWeeklyBossPhaseMod(next);
    showBossPhaseText(ctx, inv, next, mod.banner, mod.color);
    scene.cameras.main.shake(500, 0.025);
    scene.cameras.main.flash(
      350, (mod.color >> 16) & 0xff, (mod.color >> 8) & 0xff, mod.color & 0xff, false,
    );
    inv.applySpeedBoost(mod.speedMult, PHASE_SPEED_DURATION_MS);
    for (let i = 0; i < summons; i++) {
      scene.time.delayedCall(i * SUMMON_STAGGER_MS, () => {
        if (inv.active) ctx.spawnInvader(mod.summonType);
      });
    }
    logger.debug(`[WEEKLY_BOSS] phase ${next} — speed×${mod.speedMult}, summons=${summons}`);
  };

  const checkPhase = () => {
    if (!inv.active) return;
    const next = getWeeklyBossPhase(inv.hp, inv.maxHp, boss.phases);
    if (next > phase) {
      // Accumulate summons across skipped phases so a burst that crosses
      // multiple thresholds still spawns every scheduled add.
      let summons = 0;
      for (let p = phase + 1; p <= next; p++) summons += getWeeklyBossPhaseMod(p).summonCount;
      phase = next;
      enterPhase(next, summons);
    }
    scene.time.delayedCall(PHASE_POLL_MS, checkPhase);
  };
  scene.time.delayedCall(PHASE_POLL_MS, checkPhase);
}
