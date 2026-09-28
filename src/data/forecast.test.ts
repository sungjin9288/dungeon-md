import { describe, expect, it } from 'vitest';
import { getDailyDungeon, getWeeklyBoss } from './daily';
import { FORECAST_CARDS_PER_DAY, WEEKLY_BOSS_MIN_TIER, buildBandWaves, isBattleCard, issueForecastCards, type ForecastIssueInput } from './forecast';
import { INVADER_DEFS } from './invaders';
import { getNotorietyBand, NOTORIETY_BANDS } from './notoriety';
import { seededRand } from './daily';

function input(date: string, tier: number, isMonday = false): ForecastIssueInput {
  return { date, tier, isMonday, daily: getDailyDungeon(), weeklyBoss: getWeeklyBoss() };
}

describe('issueForecastCards', () => {
  it('issues three cards, the first always a raid of the current tier', () => {
    const cards = issueForecastCards(input('2026-09-17', 3));
    expect(cards).toHaveLength(FORECAST_CARDS_PER_DAY);
    expect(cards[0].kind).toBe('raid');
    expect(cards[0].bandTier).toBe(3);
    expect(['elite', 'raid']).toContain(cards[1].kind);
    expect(cards.map(c => c.id)).toEqual(['2026-09-17-0', '2026-09-17-1', '2026-09-17-2']);
  });

  it('is deterministic for a date and tier, and differs across days', () => {
    const a = issueForecastCards(input('2026-09-17', 2));
    const b = issueForecastCards(input('2026-09-17', 2));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const other = issueForecastCards(input('2026-09-18', 2));
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(a));
  });

  it('Monday\'s third card is the weekly boss from the gate tier up', () => {
    const cards = issueForecastCards(input('2026-09-14', WEEKLY_BOSS_MIN_TIER, true));
    expect(cards[2].kind).toBe('weekly_boss');
    expect(cards[2].weeklyBoss).toBeDefined();
    expect(isBattleCard(cards[2])).toBe(true);
  });

  it('below the gate tier Monday draws a regular special card instead of the 40k+ HP boss', () => {
    for (let tier = 1; tier < WEEKLY_BOSS_MIN_TIER; tier++) {
      const cards = issueForecastCards(input('2026-09-14', tier, true));
      expect(cards[2].kind, `tier ${tier}`).not.toBe('weekly_boss');
    }
  });

  it('every battle card carries known invaders and a positive HP pool; merchants carry none', () => {
    for (let tier = 1; tier <= NOTORIETY_BANDS.length; tier++) {
      for (const day of ['2026-09-15', '2026-09-16', '2026-09-19']) {
        for (const card of issueForecastCards(input(day, tier))) {
          if (card.kind === 'merchant') { expect(card.waves).toBeUndefined(); continue; }
          expect(isBattleCard(card), `${card.id} ${card.kind}`).toBe(true);
          for (const wave of card.waves ?? []) for (const g of wave.invaders) {
            expect(INVADER_DEFS[g.type], `${card.id} ${g.type}`).toBeDefined();
            expect(g.count).toBeGreaterThan(0);
          }
          expect(card.preview.invaderTypes.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('buildBandWaves', () => {
  it('draws rank-and-file from the band pool and closes elites with a band boss', () => {
    for (const band of NOTORIETY_BANDS) {
      const raid = buildBandWaves(band, 'raid', seededRand(band.tier));
      for (const wave of raid) for (const g of wave.invaders) expect(band.pool).toContain(g.type);
      const elite = buildBandWaves(band, 'elite', seededRand(band.tier + 100));
      const last = elite[elite.length - 1];
      expect(last.invaders.some(g => g.isBoss && band.bosses.includes(g.type))).toBe(true);
      expect(elite.length).toBe(raid.length + 1);
    }
  });

  it('a higher tier fields more waves and pays more', () => {
    const low = buildBandWaves(getNotorietyBand(1), 'raid', seededRand(1));
    const high = buildBandWaves(getNotorietyBand(9), 'raid', seededRand(1));
    expect(high.length).toBeGreaterThan(low.length);
    const total = (waves: typeof low) => waves.reduce((s, w) => s + (w.clearReward ?? 0), 0);
    expect(total(high)).toBeGreaterThan(total(low));
  });
});
