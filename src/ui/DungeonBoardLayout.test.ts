import { describe, expect, it } from 'vitest';
import { buildDungeonBoardLayout } from './DungeonBoardLayout';

describe('DungeonBoardLayout — vertical cutaway', () => {
  it('reveals outer-wall chambers before filling the centre shaft', () => {
    const layout = buildDungeonBoardLayout({
      unlockedSlots: 1,
      totalSlots: 9,
      regionTop: 96,
      regionBottom: 594,
      canvasWidth: 390,
      mode: 'vertical-cutaway',
    });

    const first = layout.cellsByIdx.get(0);
    const next = layout.cellsByIdx.get(1);
    const centre = layout.cellsByIdx.get(2);

    expect(first?.colInFloor).toBe(0);
    expect(next?.colInFloor).toBe(2);
    expect(centre?.colInFloor).toBe(1);
    expect(first?.rect.x).toBeLessThan(centre?.rect.x ?? 0);
    expect(next?.rect.x).toBeGreaterThan(centre?.rect.x ?? 0);
    expect(layout.route).toEqual([0]);
  });
});
