import { describe, it, expect } from 'vitest';
import { ALL_STAGES, CHAPTER_VETERAN_MULT, chapterVeteranFor, findStageById } from './allStages';

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

describe('장별 노련도', () => {
  it('2장은 첫 스테이지 0.58에서 끝 스테이지 0.84로 오르고, 보스에는 걸리지 않는다', () => {
    expect(CHAPTER_VETERAN_MULT[2]).toEqual([0.58, 0.84]);
    const ch2 = ALL_STAGES.filter(stage => stage.chapter === 2);
    const mults = ch2.map(stage => chapterVeteranFor(stage, ALL_STAGES));
    expect(mults[0]).toBe(0.58);
    expect(mults[mults.length - 1]).toBe(0.84);
    for (let i = 1; i < mults.length; i++) expect(mults[i]).toBeGreaterThanOrEqual(mults[i - 1]);
    for (const [i, stage] of ch2.entries()) {
      for (const wave of stage.waves) for (const group of wave.invaders) {
        expect(group.veteranMult, `stage ${stage.id} ${group.type}`).toBe(group.isBoss ? undefined : mults[i]);
      }
    }
  });

  it('표의 모든 장은 첫·끝 스테이지가 경사 양 끝이고, 그 사이는 두 값 안에 있으며 보스는 빠진다', () => {
    for (const [chapterKey, entry] of Object.entries(CHAPTER_VETERAN_MULT)) {
      const [first, last] = typeof entry === 'number' ? [entry, entry] : entry!;
      const stages = ALL_STAGES.filter(stage => stage.chapter === Number(chapterKey));
      const mults = stages.map(stage => chapterVeteranFor(stage, ALL_STAGES));
      expect(mults[0], `chapter ${chapterKey} first`).toBe(first);
      expect(mults[mults.length - 1], `chapter ${chapterKey} last`).toBe(last);
      for (const [i, stage] of stages.entries()) {
        expect(mults[i]).toBeGreaterThanOrEqual(Math.min(first, last));
        expect(mults[i]).toBeLessThanOrEqual(Math.max(first, last));
        for (const wave of stage.waves) for (const group of wave.invaders) {
          if (group.isBoss) expect(group.veteranMult, `stage ${stage.id} boss ${group.type}`).toBeUndefined();
        }
      }
    }
  });

  it('4~9장은 노련도를 받고(최소 성장 홈이 HP 100%로 지나가던 장), 1·3장은 받지 않는다', () => {
    for (const chapter of [4, 5, 6, 7, 8, 9]) expect(CHAPTER_VETERAN_MULT[chapter], `chapter ${chapter}`).toBeDefined();
    for (const chapter of [1, 3]) expect(CHAPTER_VETERAN_MULT[chapter], `chapter ${chapter}`).toBeUndefined();
  });

  it('표에 없는 장은 그대로다', () => {
    for (const stage of ALL_STAGES.filter(s => CHAPTER_VETERAN_MULT[s.chapter] === undefined)) {
      for (const wave of stage.waves) for (const group of wave.invaders) expect(group.veteranMult).toBeUndefined();
    }
  });
});
