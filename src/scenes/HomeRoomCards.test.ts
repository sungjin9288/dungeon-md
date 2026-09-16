import { describe, expect, it } from 'vitest';
import { isVisibleHomeSlot } from '../ui/DungeonBoardLayout';

describe('Home room visibility', () => {
  it('shows operational rooms and only the next sealed expansion', () => {
    expect(Array.from({ length: 9 }, (_, idx) => isVisibleHomeSlot(idx, 1)))
      .toEqual([true, true, false, false, false, false, false, false, false]);
    expect(Array.from({ length: 9 }, (_, idx) => isVisibleHomeSlot(idx, 4)))
      .toEqual([true, true, true, true, true, false, false, false, false]);
  });
});
