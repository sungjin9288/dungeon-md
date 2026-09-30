// ─── Home defence tempo ───────────────────────────────────────────────────────
// Since the home dungeon became the only dungeon (nothing is built or upgraded
// mid-battle), every room fights at a faster base tempo. The 90 campaign stages
// were tuned around a board that grew during the fight; the tempo restores the
// kill throughput that growth used to provide, uniformly, instead of retuning
// every stage. Organic play-throughs (scripts/verify-campaign-pacing.mjs) set
// the value; simulation.ts applies the same factor so forecasts stay honest.
//
// 1.5 → 1.0 (2026-09-30): the corridor dungeon puts every room on the invasion
// route, so a range-1 room now reaches every invader instead of one board row's
// third of the path. The throughput gap the boost covered is gone — stages 1–90
// all still win organically at 1.0 (see DUNGEON_EXPANSION_DESIGN.md, P5-b).

export const HOME_DEFENSE_TEMPO = 1.0;

/** A room or guardian attack cooldown at the home defence tempo. */
export function tempoCooldown(baseMs: number): number {
  return baseMs > 0 ? Math.round(baseMs / HOME_DEFENSE_TEMPO) : baseMs;
}
