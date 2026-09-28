import { describe, expect, it } from 'vitest';
import { getAffordableSummonType } from './summonPools';
import { getHomeReadinessDestination } from './homeReadinessDirective';

const TODAY = '2026-09-29';

describe('getAffordableSummonType', () => {
  it('prefers the free daily friendship pull', () => {
    expect(getAffordableSummonType({ lastFriendSummon: '2026-09-28', soulCrystals: 999, gems: 999 }, TODAY)).toBe('friendship');
  });

  it('falls back to soul crystals, then gems, then nothing', () => {
    expect(getAffordableSummonType({ lastFriendSummon: TODAY, soulCrystals: 50, gems: 0 }, TODAY)).toBe('soul');
    expect(getAffordableSummonType({ lastFriendSummon: TODAY, soulCrystals: 49, gems: 30 }, TODAY)).toBe('normal');
    expect(getAffordableSummonType({ lastFriendSummon: TODAY, soulCrystals: 49, gems: 29 }, TODAY)).toBeNull();
  });
});

describe('Home directive routes recruit actions to 소환', () => {
  it('uses the summon destination only for recruit actions', () => {
    const base = {
      kind: 'assign-monster' as const, slotIdx: 0, icon: '', label: '', title: '', body: '',
      ctaLabel: '', statLabel: 'M', statValue: '0/1', accent: 0,
    };
    expect(getHomeReadinessDestination({ ...base, recruit: 'soul' })).toBe('summon');
    expect(getHomeReadinessDestination(base)).toBe('room-detail');
  });
});
