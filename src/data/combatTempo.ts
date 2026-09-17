// ─── Home defence tempo ───────────────────────────────────────────────────────
// Since the home dungeon became the only dungeon (nothing is built or upgraded
// mid-battle), every room fights at a faster base tempo. The 90 campaign stages
// were tuned around a board that grew during the fight; the tempo restores the
// kill throughput that growth used to provide, uniformly, instead of retuning
// every stage. Organic play-throughs (scripts/verify-campaign-pacing.mjs) set
// the value; simulation.ts applies the same factor so forecasts stay honest.

export const HOME_DEFENSE_TEMPO = 1.5;

/** A room or guardian attack cooldown at the home defence tempo. */
export function tempoCooldown(baseMs: number): number {
  return baseMs > 0 ? Math.round(baseMs / HOME_DEFENSE_TEMPO) : baseMs;
}
