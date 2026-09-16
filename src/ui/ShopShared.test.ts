import { describe, expect, it } from 'vitest';
import { acceptUtcDayIndex, formatUtcReset, paginate, secondsUntilUtcReset } from './ShopShared';

describe('ShopShared', () => {
  it('returns a bounded page without mutating the catalog', () => {
    const catalog = ['a', 'b', 'c', 'd', 'e'];
    const page = paginate(catalog, 8, 2);

    expect(page).toEqual({
      items: ['e'],
      page: 2,
      pageCount: 3,
      start: 4,
      end: 5,
    });
    expect(catalog).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps an empty catalog on a stable first page', () => {
    expect(paginate([], -4, 0)).toEqual({
      items: [],
      page: 0,
      pageCount: 1,
      start: 0,
      end: 0,
    });
  });

  it('formats the single UTC reset countdown used by the shop chrome', () => {
    expect(secondsUntilUtcReset(0)).toBe(86_400);
    expect(secondsUntilUtcReset(86_399_001)).toBe(1);
    expect(formatUtcReset(86_400)).toBe('24:00:00');
    expect(formatUtcReset(3_661.9)).toBe('01:01:01');
    expect(formatUtcReset(-1)).toBe('00:00:00');
  });

  it('defers a UTC catalog rollover while a transaction overlay owns the scene', () => {
    expect(acceptUtcDayIndex(42, 43, true)).toBe(42);
    expect(acceptUtcDayIndex(42, 43, false)).toBe(43);
  });
});
