/**
 * Gold-economy audit/guard — verifies every campaign stage is affordable:
 * the gold the player can earn in a stage (startGold + Σ wave clearReward) must
 * comfortably cover building + upgrading a viable defense, and the opening
 * startGold must afford at least a minimal opening line.
 *
 * Floors (cheapest combat room = 100 gold):
 *   opening   : startGold ≥ 2 rooms (200)
 *   viable run: startGold + Σrewards ≥ 4 rooms + one upgrade round (~600)
 */

import { describe, it, expect } from 'vitest';
import { ROOM_DEFS } from './rooms';
import {
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4,
  CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8,
  type StageConfig,
} from './stages';

const ALL_STAGES: StageConfig[] = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4,
  ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8,
];
const COMBAT_COST = ROOM_DEFS.guardian.cost; // ⚔️ damage room (100g) — viability baseline

const stageGold = (s: StageConfig) =>
  s.startGold + s.waves.reduce((sum, w) => sum + (w.clearReward ?? 0), 0);

describe('gold-economy affordability guard', () => {
  it('opening startGold affords at least a 2-room opening line', () => {
    for (const s of ALL_STAGES) {
      expect(s.startGold, `stage ${s.id} startGold`).toBeGreaterThanOrEqual(COMBAT_COST * 2);
    }
  });

  it('total earnable gold per stage covers a viable build+upgrade', () => {
    for (const s of ALL_STAGES) {
      expect(stageGold(s), `stage ${s.id} total gold`).toBeGreaterThanOrEqual(COMBAT_COST * 6);
    }
  });

  it('total earnable gold trends upward across the campaign (no late-game drought)', () => {
    // Compare chapter-average earnable gold: chapter 8 ≥ chapter 1.
    const chapters = [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8];
    const avg = (cs: StageConfig[]) => cs.reduce((sum, s) => sum + stageGold(s), 0) / cs.length;
    expect(avg(chapters[7])).toBeGreaterThan(avg(chapters[0]));
  });
});
