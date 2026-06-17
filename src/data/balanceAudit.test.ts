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
 * AUDIT NOTE (2026-06-18): Ch2 is an intentional-looking outlier — the fox_queen
 * mini-boss (wall 112.5) closes EVERY Ch2 stage (fox-themed chapter), so Ch2's
 * regular-stage wall sits ~3× above Ch3's regular stages (33.8). That is a
 * cross-chapter inversion flagged for design review, NOT asserted here (it may
 * be a deliberate motif). The guards below hold for all 8 chapters as-is.
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
