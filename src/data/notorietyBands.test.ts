/**
 * Notoriety band guard — a band-tier expedition must be beatable by the home a
 * player is expected to have when they can reasonably hold that tier. Uses the
 * same pacing model as the campaign guard (campaignPacing.ts) and the same
 * coverage-aware simulation, so the two stay comparable.
 */
import { describe, expect, it } from 'vitest';
import { expectedHome, requiredDps, simulateHome, veteranHome } from './campaignPacing';
import { seededRand } from './daily';
import { buildBandWaves } from './forecast';
import { NOTORIETY_BANDS } from './notoriety';

/** Campaign stage whose expected home should hold each tier [DRAFT]. */
export const TIER_REFERENCE_STAGE: readonly number[] = [1, 8, 16, 26, 36, 46, 56, 66, 76, 86];

const SEEDS = [1, 2, 3, 4, 5];

describe('notoriety bands are held by the expected home of their reference stage', () => {
  for (const band of NOTORIETY_BANDS) {
    const stageNumber = TIER_REFERENCE_STAGE[band.tier - 1];
    // Tiers 9–10 close with the campaign's phase bosses: like chapter 9 itself,
    // they are tuned for a grown roster.
    const home = band.tier >= 9 ? veteranHome(stageNumber) : expectedHome(stageNumber);
    for (const kind of ['raid', 'elite'] as const) {
      it(`tier ${band.tier} ${kind} vs stage-${stageNumber} home`, () => {
        for (const seed of SEEDS) {
          const waves = buildBandWaves(band, kind, seededRand(seed * 1000 + band.tier));
          const stage = { id: 0, chapter: band.tier, waves, dungeonHp: band.dungeonHp };
          const sim = simulateHome(home, stage);
          const margin = sim.totalDps / requiredDps(stage);
          expect(sim.winPct, `tier ${band.tier} ${kind} seed ${seed} win%`).toBeGreaterThanOrEqual(kind === 'raid' ? 70 : 50);
          expect(margin, `tier ${band.tier} ${kind} seed ${seed} margin`).toBeGreaterThanOrEqual(1.2);
        }
      });
    }
  }
});
