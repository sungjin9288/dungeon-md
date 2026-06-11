import { describe, expect, it } from 'vitest';
import { SEASON_BANNERS } from './banners';
import { defaultOwnedMonster } from './barracks';
import { applySummonPull } from './summonTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gems: 0,
    soulCrystals: 0,
    wisdomTree: {},
    stageProgress: [],
    ownedMonsters: [],
    summonPity: {
      normal: { count: 0, guaranteed: 50 },
      special: { count: 0, guaranteed: 80 },
    },
    summonHistory: [],
    lastFriendSummon: '',
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    ...overrides,
  } as GameState;
}

function rngSequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? values[values.length - 1] ?? 0;
}

describe('summonTransactions — applySummonPull', () => {
  it('spends gems, adds a new monster, records history, and advances summon progress', () => {
    const state = makeState({
      gems: 100,
      soulCrystals: 10,
      wisdomTree: { soulHarvest: 2 },
      activeMainQuestId: 'MQ-005',
      questProgress: {
        'MQ-005': {
          objectives: { O1: 0 },
          completed: false,
        },
      },
      activeSubQuestIds: ['SQ-021'],
      subQuestProgress: {},
    });

    const result = applySummonPull(state, 'normal', 1, {
      rng: rngSequence([0, 0]),
      timestamp: 123,
      today: '2026-05-13',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(30);
    expect(result.wisdomSoulCrystals).toBe(4);
    expect(result.results).toEqual([
      {
        monsterId: 'dokkaebi_warrior',
        rarity: 'common',
        rarityIdx: 0,
        isNew: true,
        scComp: 0,
        ceilingHit: false,
      },
    ]);
    expect(result.state.gems).toBe(70);
    expect(result.state.soulCrystals).toBe(14);
    expect(result.state.ownedMonsters.map(monster => monster.id)).toEqual(['dokkaebi_warrior']);
    expect(result.state.summonPity.normal.count).toBe(1);
    expect(result.state.summonHistory).toEqual([
      {
        type: 'normal',
        monsterId: 'dokkaebi_warrior',
        rarity: 'common',
        isNew: true,
        timestamp: 123,
        scCompensation: undefined,
        ceilingHit: undefined,
      },
    ]);
    expect(result.state.questProgress['MQ-005'].objectives.O1).toBe(1);
    expect(result.state.subQuestProgress['SQ-021']).toBe(1);
    expect(state.gems).toBe(100);
    expect(state.ownedMonsters).toEqual([]);
  });

  it('grants soul crystal compensation for duplicate monsters', () => {
    const existing = defaultOwnedMonster('dokkaebi_warrior');
    const state = makeState({
      gems: 100,
      soulCrystals: 0,
      ownedMonsters: [existing],
    });

    const result = applySummonPull(state, 'normal', 1, {
      rng: rngSequence([0, 0]),
      timestamp: 456,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]).toMatchObject({
      monsterId: 'dokkaebi_warrior',
      isNew: false,
      scComp: 5,
    });
    expect(result.state.soulCrystals).toBe(5);
    expect(result.state.ownedMonsters).toEqual([existing]);
    expect(result.state.summonHistory[0].scCompensation).toBe(5);
  });

  it('uses pity to force the guaranteed rarity and reset the pity counter', () => {
    const state = makeState({
      gems: 100,
      summonPity: {
        normal: { count: 49, guaranteed: 50 },
        special: { count: 0, guaranteed: 80 },
      },
    });

    const result = applySummonPull(state, 'normal', 1, {
      rng: rngSequence([0]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]).toMatchObject({
      rarity: 'epic',
      rarityIdx: 3,
      monsterId: 'ghost_hunter',
      ceilingHit: true,
    });
    expect(result.state.summonPity.normal.count).toBe(0);
  });

  it('prefers unowned monsters for soul summons', () => {
    const state = makeState({
      soulCrystals: 100,
      ownedMonsters: [defaultOwnedMonster('gold_turtle')],
    });

    const result = applySummonPull(state, 'soul', 1, {
      rng: rngSequence([0.01, 0]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]).toMatchObject({
      rarity: 'uncommon',
      monsterId: 'fire_dokkaebi',
      isNew: true,
    });
    expect(result.state.soulCrystals).toBe(50);
    expect(result.state.ownedMonsters.map(monster => monster.id)).toEqual([
      'gold_turtle',
      'fire_dokkaebi',
    ]);
  });

  it('applies active banner boost with injected randomness', () => {
    const summerBanner = SEASON_BANNERS.find(banner => banner.id === 'summer_sea_2026')!;
    const state = makeState({ gems: 100 });

    const result = applySummonPull(state, 'normal', 1, {
      activeBanner: summerBanner,
      rng: rngSequence([0.95, 0, 0]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0]).toMatchObject({
      rarity: 'epic',
      monsterId: 'kraken_soldier',
    });
  });

  it('marks friendship summons as used for the day and blocks repeat use', () => {
    const state = makeState();

    const first = applySummonPull(state, 'friendship', 1, {
      rng: rngSequence([0, 0]),
      today: '2026-05-13',
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.lastFriendSummon).toBe('2026-05-13');

    const repeat = applySummonPull(first.state, 'friendship', 1, {
      rng: rngSequence([0, 0]),
      today: '2026-05-13',
    });
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) {
      expect(repeat.reason).toBe('friendship_already_used');
      expect(repeat.state).toBe(first.state);
    }
  });

  it('fails without changing state when currency is insufficient', () => {
    const noGems = makeState({ gems: 29 });
    const noSoul = makeState({ soulCrystals: 49 });

    const gemResult = applySummonPull(noGems, 'normal', 1);
    const soulResult = applySummonPull(noSoul, 'soul', 1);

    expect(gemResult.ok).toBe(false);
    if (!gemResult.ok) {
      expect(gemResult.reason).toBe('insufficient_gems');
      expect(gemResult.required).toBe(30);
      expect(gemResult.available).toBe(29);
      expect(gemResult.state).toBe(noGems);
    }
    expect(soulResult.ok).toBe(false);
    if (!soulResult.ok) {
      expect(soulResult.reason).toBe('insufficient_soul_crystals');
      expect(soulResult.required).toBe(50);
      expect(soulResult.available).toBe(49);
      expect(soulResult.state).toBe(noSoul);
    }
  });
});
