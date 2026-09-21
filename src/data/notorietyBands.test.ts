/**
 * Notoriety band guard — a band-tier expedition must be beatable by the home a
 * player is expected to have when they can reasonably hold that tier. Uses the
 * same pacing model as the campaign guard (campaignPacing.ts) and the same
 * coverage-aware simulation, so the two stay comparable.
 */
import { describe, expect, it } from 'vitest';
import { INVADER_DEFS } from './invaders';
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

describe('명성 사다리는 올라갈수록 무거워진다', () => {
  // The player raises 명성 tier by explicit approval (간판 올리기). It used to be
  // possible to approve a raise and get an EASIER elite card: tier 5's boss was
  // void_assassin_elite (350 hp, tier 1's knight) after tier 4's fox_queen
  // (1,600), and tier 8's was titan_sentinel (1,500) after tier 7's
  // death_emissary (3,000). Over 300 seeds the elite finale wave measured 53%
  // and 37% lighter across those two rungs.
  const bossHp = (band: typeof NOTORIETY_BANDS[number]) =>
    Math.min(...band.bosses.map(type => INVADER_DEFS[type].hp));

  it('보스 풀의 최약체가 티어를 따라 줄지 않는다', () => {
    for (let i = 1; i < NOTORIETY_BANDS.length; i++) {
      const prev = NOTORIETY_BANDS[i - 1];
      const band = NOTORIETY_BANDS[i];
      expect(bossHp(band), `tier ${band.tier} boss vs tier ${prev.tier}`)
        .toBeGreaterThanOrEqual(bossHp(prev));
    }
  });

  it('던전 HP와 전리품 배수도 함께 오른다', () => {
    for (let i = 1; i < NOTORIETY_BANDS.length; i++) {
      const prev = NOTORIETY_BANDS[i - 1];
      const band = NOTORIETY_BANDS[i];
      expect(band.dungeonHp, `tier ${band.tier} dungeonHp`).toBeGreaterThan(prev.dungeonHp);
      expect(band.lootMult, `tier ${band.tier} lootMult`).toBeGreaterThan(prev.lootMult);
    }
  });

  it('모든 보스가 실재하는 침입자다', () => {
    for (const band of NOTORIETY_BANDS) {
      for (const type of band.bosses) {
        expect(INVADER_DEFS[type], `tier ${band.tier} "${type}"`).toBeDefined();
      }
    }
  });
})
