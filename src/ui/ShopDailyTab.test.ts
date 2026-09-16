import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDailyItems, isCurrentDailyOffer, seededShuffle } from './ShopDailyTab';

afterEach(() => {
  vi.useRealTimers();
});

describe('ShopDailyTab daily catalog', () => {
  it('shuffles deterministically without mutating the registry order', () => {
    const source = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(source, 42)).toEqual(seededShuffle(source, 42));
    expect(source).toEqual(['a', 'b', 'c', 'd']);
  });

  it('provides three unique equipment and skill offers for a UTC day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    const daily = getDailyItems();

    expect(daily.equipment).toHaveLength(3);
    expect(new Set(daily.equipment.map(item => item.id)).size).toBe(3);
    expect(daily.skills).toHaveLength(3);
    expect(new Set(daily.skills.map(item => item.id)).size).toBe(3);
  });

  it('rejects a captured offer after a UTC rotation removes it', () => {
    vi.useFakeTimers();
    const firstDay = new Date('2026-09-04T12:00:00.000Z');
    vi.setSystemTime(firstDay);
    const captured = getDailyItems().equipment;

    let staleId: string | undefined;
    for (let offset = 1; offset <= 30 && !staleId; offset += 1) {
      vi.setSystemTime(firstDay.getTime() + offset * 86_400_000);
      staleId = captured.find(item => !isCurrentDailyOffer('equipment', item.id))?.id;
    }

    expect(staleId).toBeDefined();
    expect(isCurrentDailyOffer('equipment', staleId!)).toBe(false);
    expect(isCurrentDailyOffer('equipment', getDailyItems().equipment[0].id)).toBe(true);
  });
});
