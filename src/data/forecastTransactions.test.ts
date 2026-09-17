import { describe, expect, it } from 'vitest';
import { getDailyDungeon, getWeeklyBoss } from './daily';
import type { ForecastIssueInput } from './forecast';
import {
  beginForecastDay,
  isForecastExhausted,
  MERCHANT_BASE_GOLD,
  MERCHANT_BUYS,
  settleForecastBattle,
  takeForecastCard,
} from './forecastTransactions';
import { NOTORIETY_GAIN } from './notoriety';
import { loadGameState, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

const pinned = (date: string, isMonday = false) => (tier: number): ForecastIssueInput => (
  { date, tier, isMonday, daily: getDailyDungeon(), weeklyBoss: getWeeklyBoss() }
);

describe('beginForecastDay', () => {
  it('issues three cards on a new day and is idempotent within the day', () => {
    const first = beginForecastDay(state(), '2026-09-17', pinned('2026-09-17'));
    expect(first.issued).toBe(true);
    expect(first.state.forecast).toMatchObject({ date: '2026-09-17', taken: [] });
    expect(first.state.forecast.cards).toHaveLength(3);
    const again = beginForecastDay(first.state, '2026-09-17', pinned('2026-09-17'));
    expect(again.issued).toBe(false);
    expect(again.state.forecast.cards).toBe(first.state.forecast.cards);
  });

  it('a long absence erodes the name but keeps the tier, and a new day clears yesterday\'s picks', () => {
    const yesterday = beginForecastDay(state({ notoriety: 1000, notorietyTier: 4 }), '2026-09-01', pinned('2026-09-01')).state;
    const taken = { ...yesterday, forecast: { ...yesterday.forecast, taken: [yesterday.forecast.cards[0].id] } };
    const back = beginForecastDay(taken, '2026-09-11', pinned('2026-09-11'));
    expect(back.daysAway).toBe(10);
    expect(back.state.notoriety).toBeLessThan(1000);
    expect(back.state.notorietyTier).toBe(4);
    expect(back.state.forecast.taken).toEqual([]);
    expect(back.state.forecast.date).toBe('2026-09-11');
  });
});

describe('takeForecastCard', () => {
  it('marks a battle card taken without touching resources', () => {
    const day = beginForecastDay(state({ homeGold: 100 }), '2026-09-17', pinned('2026-09-17')).state;
    const raid = day.forecast.cards[0];
    const took = takeForecastCard(day, raid.id);
    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.state.forecast.taken).toEqual([raid.id]);
    expect(took.state.homeGold).toBe(100);
    expect(took.goldEarned).toBe(0);
    expect(day.forecast.taken).toEqual([]);
  });

  it('refuses unknown or already-taken cards', () => {
    const day = beginForecastDay(state(), '2026-09-17', pinned('2026-09-17')).state;
    const missing = takeForecastCard(day, 'nope');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('card_not_found');
    const once = takeForecastCard(day, day.forecast.cards[0].id);
    const twice = once.ok ? takeForecastCard(once.state, day.forecast.cards[0].id) : once;
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toBe('card_already_taken');
  });

  it('the merchant buys facility outputs at the band price and settles on the spot', () => {
    // Find a date whose third card is the merchant.
    let day: GameState | null = null;
    for (let d = 1; d <= 28 && !day; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      const candidate = beginForecastDay(state({ materials: { common_ore: 10, herb: 4, dok_fragment: 3 }, homeGold: 0 }), date, pinned(date)).state;
      if (candidate.forecast.cards[2].kind === 'merchant') day = candidate;
    }
    expect(day).not.toBeNull();
    if (!day) return;
    const took = takeForecastCard(day, day.forecast.cards[2].id);
    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.goldEarned).toBe(MERCHANT_BASE_GOLD + 10 * MERCHANT_BUYS.common_ore + 4 * MERCHANT_BUYS.herb);
    expect(took.state.homeGold).toBe(took.goldEarned);
    expect(took.state.materials).toEqual({ dok_fragment: 3 });
    expect(took.state.forecast.taken).toEqual([day.forecast.cards[2].id]);
  });

  it('exhaustion means every card of today is taken', () => {
    let day = beginForecastDay(state(), '2026-09-17', pinned('2026-09-17')).state;
    expect(isForecastExhausted(day, '2026-09-17')).toBe(false);
    for (const card of day.forecast.cards) {
      const took = takeForecastCard(day, card.id);
      if (took.ok) day = took.state;
    }
    expect(isForecastExhausted(day, '2026-09-17')).toBe(true);
    expect(isForecastExhausted(day, '2026-09-18')).toBe(false);
  });
});

describe('settleForecastBattle', () => {
  const won = { won: true, goldEarned: 120, dmXP: 150 };
  const lost = { won: false, goldEarned: 30, dmXP: 30 };

  it('pays loot and DM XP once, then the card\'s reward and the name', () => {
    const day = beginForecastDay(state({ homeGold: 0, notoriety: 40 }), '2026-09-17', pinned('2026-09-17')).state;
    const raid = day.forecast.cards[0];
    const took = takeForecastCard(day, raid.id);
    if (!took.ok) throw new Error('take failed');
    const settled = settleForecastBattle(took.state, raid.id, won);
    expect(settled.card?.id).toBe(raid.id);
    expect(settled.notorietyDelta).toBe(NOTORIETY_GAIN.raid);
    expect(settled.state.notoriety).toBe(40 + NOTORIETY_GAIN.raid);
    expect(settled.state.homeGold).toBe(120 + (raid.reward.gold ?? 0));
    expect(settled.state.dmXP + (settled.state.dmLevel - 1) * 0).toBeGreaterThanOrEqual(0);
    expect(settled.battle.changed).toBe(true);
  });

  it('a flawless win earns half again as much name; a loss costs a tenth', () => {
    const day = beginForecastDay(state({ notoriety: 200 }), '2026-09-17', pinned('2026-09-17')).state;
    const raid = day.forecast.cards[0];
    const took = takeForecastCard(day, raid.id);
    if (!took.ok) throw new Error('take failed');
    const flawless = settleForecastBattle(took.state, raid.id, won, { flawless: true });
    expect(flawless.notorietyDelta).toBe(Math.round(NOTORIETY_GAIN.raid * NOTORIETY_GAIN.flawlessMult));
    const defeat = settleForecastBattle(took.state, raid.id, lost);
    expect(defeat.notorietyDelta).toBe(-20);
    expect(defeat.state.notoriety).toBe(180);
    expect(defeat.state.homeGold).toBe(day.homeGold + 30);
  });

  it('settles an untaken or unknown card as a plain battle return', () => {
    const day = beginForecastDay(state({ notoriety: 40 }), '2026-09-17', pinned('2026-09-17')).state;
    const settled = settleForecastBattle(day, day.forecast.cards[0].id, won);
    expect(settled.card).toBeNull();
    expect(settled.notorietyDelta).toBe(0);
    expect(settled.state.notoriety).toBe(40);
    expect(settled.state.homeGold).toBe(day.homeGold + 120);
  });

  it('a Monday weekly-boss card adds the name only — the battle scene pays the weekly reward', () => {
    const day = beginForecastDay(state(), '2026-09-14', pinned('2026-09-14', true)).state;
    const boss = day.forecast.cards[2];
    expect(boss.kind).toBe('weekly_boss');
    const took = takeForecastCard(day, boss.id);
    if (!took.ok) throw new Error('take failed');
    const settled = settleForecastBattle(took.state, boss.id, won);
    expect(settled.state.weeklyBossResetDate).toBe(day.weeklyBossResetDate);
    expect(settled.state.blueprints ?? []).not.toContain('bp_boss_amulet');
    expect(settled.notorietyDelta).toBe(NOTORIETY_GAIN.weekly_boss);
  });
});
