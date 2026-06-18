/**
 * Campaign difficulty-curve guard.
 *
 * Measures each stage's intrinsic difficulty gate, independent of any loadout:
 *   dpsWall = max over invaders of (hp × speed / PATH_LENGTH_PX)
 *             — the sustained DPS needed to kill the toughest invader within its
 *               travel window; the dominant "can I clear this at all" gate.
 *
 * These guards lock in the campaign's structural shape so an accidental data
 * edit (e.g. a mid-chapter stage made tougher than its own boss finale, or a
 * stage with no real threat) is caught in CI.
 *
 * AUDIT NOTE (2026-06-18): The audit found a Ch2 inversion — the full fox_queen
 * mini-boss (wall 112.5) closed EVERY Ch2 stage, putting Ch2's regular stages
 * ~3× above Ch3's (33.8). Fix: S11–S19 now close with a lesser `fox_spirit`
 * (wall ~28, theme preserved); the full fox_queen is reserved for the S20
 * chapter boss. Ch2 regular wall (28) now sits just under Ch3 (33.8) — curve
 * resolved. The chapter-finale-is-peak guard still holds (S20 112.5 > 28).
 */

import { describe, it, expect } from 'vitest';
import { INVADER_DEFS } from './invaders';
import {
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4,
  CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8,
  type StageConfig,
} from './stages';

const PATH_LENGTH_PX = 640;
const CHAPTERS: StageConfig[][] = [
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8,
];

/** Sustained DPS needed to kill a stage's toughest invader within its travel window. */
export function stageDpsWall(stage: StageConfig): number {
  let wall = 0;
  for (const wave of stage.waves) {
    for (const grp of wave.invaders) {
      const def = INVADER_DEFS[grp.type];
      if (!def) continue;
      const w = (def.hp * def.speed) / PATH_LENGTH_PX;
      if (w > wall) wall = w;
    }
  }
  return wall;
}

describe('campaign difficulty-curve guard', () => {
  it('every stage has a positive difficulty gate (no empty / threatless stages)', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter) {
        expect(stageDpsWall(stage), `stage ${stage.id} has zero threat`).toBeGreaterThan(0);
      }
    }
  });

  it('each chapter finale is at least as hard as its earlier stages (boss = peak)', () => {
    for (const chapter of CHAPTERS) {
      if (chapter.length < 2) continue;
      const walls   = chapter.map(stageDpsWall);
      const finale  = walls[walls.length - 1];
      const earlier = Math.max(...walls.slice(0, -1));
      expect(finale, `Ch${chapter[0].chapter} finale ${finale} < earlier peak ${earlier}`)
        .toBeGreaterThanOrEqual(earlier);
    }
  });

  it('overall difficulty trends upward across chapters (by finale wall)', () => {
    const finales = CHAPTERS.map(c => stageDpsWall(c[c.length - 1]));
    // Final chapter's boss wall must dominate the first chapter's by a wide margin.
    expect(finales[finales.length - 1]).toBeGreaterThan(finales[0] * 3);
  });
});
