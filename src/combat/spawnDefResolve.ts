// ─── spawnDefResolve ──────────────────────────────────────────────────────────
// Pure def-resolution step of the spawn pipeline, kept free of Phaser-coupled
// imports (type-only) so it stays unit-testable under happy-dom:
//
//   1. Apply wave-event HP/speed multipliers and daily-mode speed modifier.
//   2. Weekly boss mode: the boss's HP becomes weeklyBoss.totalHp outright —
//      wave multipliers never stack on it, the pool value is the fight's
//      contract. isBoss is forced so mini-boss defs (fox_queen, dragon_king,
//      celestial_dragon) still get the boss aura, label, and BossHud tracking.
//
// Always returns a copy when a modification applies; INVADER_DEFS entries are
// never mutated.

import type { InvaderDef } from '../data/invaders';
import type { WeeklyBoss } from '../data/daily';

export interface SpawnDefMults {
  waveHpMult:     number;
  waveSpdMult:    number;
  dailySpeedMult: number;
  synergyInvaderMoveMult?: number;
}

export function resolveSpawnDef(
  def: InvaderDef,
  mults: SpawnDefMults,
  weeklyBoss: WeeklyBoss | null = null,
): InvaderDef {
  const { waveHpMult, waveSpdMult, dailySpeedMult, synergyInvaderMoveMult = 1 } = mults;
  const scaled = (waveHpMult !== 1 || waveSpdMult !== 1 || dailySpeedMult !== 1 || synergyInvaderMoveMult !== 1)
    ? { ...def, hp: Math.round(def.hp * waveHpMult), speed: Math.round(def.speed * waveSpdMult * dailySpeedMult * synergyInvaderMoveMult) }
    : def;

  if (weeklyBoss && def.type === weeklyBoss.bossType) {
    return { ...scaled, hp: weeklyBoss.totalHp, isBoss: true };
  }
  return scaled;
}
