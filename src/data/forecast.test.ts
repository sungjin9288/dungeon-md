import { describe, expect, it } from 'vitest';
import { getDailyDungeon, getWeeklyBoss } from './daily';
import { MAX_BAND_WAVE_HEADS, FORECAST_CARDS_PER_DAY, WEEKLY_BOSS_MIN_TIER, buildBandWaves, buildWandererWaves, forecastBattleWaves, forecastVisitor, isBattleCard, issueForecastCards, type ForecastIssueInput } from './forecast';
import { WANDERER_TRIBE } from './visitors';
import { bandWaveBudget, invaderThreshold } from './notoriety';
import { INVADER_DEFS, veteranInvaderDef } from './invaders';
import { getNotorietyBand, NOTORIETY_BANDS } from './notoriety';
import { seededRand } from './daily';
import type { WaveSpec } from './stages';

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

  it('each wave is led by the band lead pool (tier 1 by peasants, like campaign stages 1–2)', () => {
    for (const band of NOTORIETY_BANDS) {
      for (let seed = 1; seed <= 5; seed++) {
        for (const wave of buildBandWaves(band, 'raid', seededRand(seed * 1000 + band.tier))) {
          expect(band.lead, `tier ${band.tier}`).toContain(wave.invaders[0].type);
        }
      }
    }
    expect(getNotorietyBand(1).lead).toEqual(['peasant']);
  });

  it('veteran bands carry their HP/heart-damage multiplier on rank-and-file only, never on the boss', () => {
    for (const band of NOTORIETY_BANDS) {
      const elite = buildBandWaves(band, 'elite', seededRand(band.tier));
      for (const wave of elite) {
        for (const group of wave.invaders) {
          const expected = group.isBoss || band.veteranMult === 1 ? undefined : band.veteranMult;
          expect(group.veteranMult, `tier ${band.tier} ${group.type}`).toBe(expected);
        }
      }
    }
    const def = INVADER_DEFS.soldier;
    expect(veteranInvaderDef(def, 2)).toMatchObject({ hp: def.hp * 2, damage: def.damage * 2, speed: def.speed });
    expect(veteranInvaderDef(def, undefined)).toBe(def);
  });

  it('every wave spends its threat budget, whatever the draw — and stays under the head cap', () => {
    const threat = (wave: WaveSpec) => wave.invaders.reduce(
      (sum, group) => sum + group.count * invaderThreshold(group.type) * (group.veteranMult ?? 1), 0);
    for (const band of NOTORIETY_BANDS) {
      const perWave: number[][] = [];
      for (let seed = 1; seed <= 200; seed++) {
        buildBandWaves(band, 'raid', seededRand(seed * 1000 + band.tier)).forEach((wave, i) => {
          expect(wave.invaders.reduce((sum, group) => sum + group.count, 0)).toBeLessThanOrEqual(MAX_BAND_WAVE_HEADS);
          (perWave[i] ??= []).push(threat(wave) / bandWaveBudget(band, i + 1));
        });
      }
      // Mean on budget; spread small. Before the budget, tier 10's per-wave threat varied ±50%.
      for (const ratios of perWave) {
        const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        const sd = Math.sqrt(ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length);
        expect(mean, `tier ${band.tier} mean`).toBeGreaterThan(0.8);
        expect(mean, `tier ${band.tier} mean`).toBeLessThan(1.25);
        expect(sd, `tier ${band.tier} spread`).toBeLessThan(0.3);
      }
    }
  });

  it('the configured budgets are spent, not swallowed by the head cap (stronger units come instead)', () => {
    const threat = (wave: WaveSpec) => wave.invaders.reduce(
      (sum, group) => sum + group.count * invaderThreshold(group.type) * (group.veteranMult ?? 1), 0);
    for (const band of NOTORIETY_BANDS) {
      const ratios: number[] = [];
      for (let seed = 1; seed <= 100; seed++) {
        buildBandWaves(band, 'raid', seededRand(seed)).forEach((wave, i) => ratios.push(threat(wave) / bandWaveBudget(band, i + 1)));
      }
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      // Before units were picked strong enough for their share, tier 2 at 2.5× its budget stayed under the
      // cap with peasants and nothing changed. Past each tier's ceiling, raise veteranMult instead.
      expect(mean, `tier ${band.tier}`).toBeGreaterThan(0.9);
    }
  });

  it('a higher tier asks for more threat per wave', () => {
    for (let i = 1; i < NOTORIETY_BANDS.length - 1; i++) {
      expect(bandWaveBudget(NOTORIETY_BANDS[i], 6)).toBeGreaterThan(bandWaveBudget(NOTORIETY_BANDS[i - 1], 6));
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

describe('손님 종류 카드', () => {
  it('카드 종류 → 손님: 보물 = 모험가, 순례 = 떠돌이 몬스터, 상인은 전투 없음, 나머지는 토벌대', () => {
    expect(forecastVisitor('treasure')).toBe('adventurer');
    expect(forecastVisitor('pilgrim')).toBe('wanderer');
    expect(forecastVisitor('merchant')).toBeNull();
    for (const kind of ['raid', 'elite', 'weekly_boss', 'daily_rule'] as const) expect(forecastVisitor(kind)).toBe('raider');
  });

  it('발급된 카드의 모든 침입자가 카드의 손님 종류를 단다', () => {
    for (let day = 1; day <= 40; day++) {
      const date = `2026-10-${String((day % 28) + 1).padStart(2, '0')}`;
      for (const tier of [1, 4, 8]) {
        for (const card of issueForecastCards({ ...input(date, tier), isMonday: false })) {
          const visitor = forecastVisitor(card.kind);
          if (visitor === 'adventurer' || visitor === 'wanderer') {
            for (const wave of card.waves ?? []) for (const group of wave.invaders) expect(group.visitor).toBe(visitor);
          }
        }
      }
    }
  });

  it('떠돌이 몬스터는 포섭 가능한 괴물형이고, 밴드 위협도를 크게 넘지 않는다', () => {
    for (const band of NOTORIETY_BANDS) {
      const ceiling = Math.max(...band.pool.map(invaderThreshold)) * 1.25;
      const floor = Math.min(...(Object.keys(WANDERER_TRIBE) as (keyof typeof WANDERER_TRIBE)[]).map(invaderThreshold));
      for (const wave of buildWandererWaves(band, seededRand(band.tier))) {
        for (const group of wave.invaders) {
          expect(WANDERER_TRIBE[group.type], `${band.tier} ${group.type}`).toBeDefined();
          expect(invaderThreshold(group.type)).toBeLessThanOrEqual(Math.max(ceiling, floor));
        }
      }
    }
  });
});

describe('전투 시작 시 손님 적용', () => {
  it('규칙 이전에 발급된 보물 카드(손님 표시 없음)도 모험가로 싸운다', () => {
    const legacy = { kind: 'treasure' as const, waves: [{ wave: 1, invaders: [{ type: 'soldier' as const, count: 2, spawnDelay: 1000 }] }] };
    expect(forecastBattleWaves(legacy)[0].invaders[0].visitor).toBe('adventurer');
    expect(legacy.waves[0].invaders[0]).not.toHaveProperty('visitor');
    expect(forecastBattleWaves({ kind: 'raid', waves: legacy.waves })[0].invaders[0]).not.toHaveProperty('visitor');
  });
});
