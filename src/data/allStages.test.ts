import { describe, it, expect } from 'vitest';
import { ALL_STAGES, findStageById } from './allStages';

// These guard the canonical battle-stage union. The Ch8/Ch9-unplayable bug
// happened because DungeonSceneInit kept its OWN [...CHAPTER_1..7] literal that
// drifted from the data. Now there is one list — and these assertions fail the
// moment a chapter is added to data but not flattened here.

describe('ALL_STAGES — canonical battle-stage union', () => {
  it('contains exactly 90 stages (Ch1–Ch9)', () => {
    expect(ALL_STAGES).toHaveLength(90);
  });

  it('covers every stage id 1–90 with no gaps or dupes', () => {
    const ids = ALL_STAGES.map(s => s.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
  });

  it('represents all 9 chapters', () => {
    const chapters = new Set(ALL_STAGES.map(s => s.chapter));
    for (let ch = 1; ch <= 9; ch++) {
      expect(chapters.has(ch), `chapter ${ch} present`).toBe(true);
    }
  });

  it('findStageById resolves Ch8/Ch9 stages to their real chapter (regression)', () => {
    // The exact failure mode: these used to resolve to undefined → Ch1 fallback.
    expect(findStageById(75)?.chapter).toBe(8);
    expect(findStageById(80)?.chapter).toBe(8);
    expect(findStageById(85)?.chapter).toBe(9);
    expect(findStageById(90)?.chapter).toBe(9);
  });

  it('findStageById returns undefined for out-of-range ids', () => {
    expect(findStageById(0)).toBeUndefined();
    expect(findStageById(91)).toBeUndefined();
  });
});
