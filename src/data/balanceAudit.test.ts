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
  CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8, CHAPTER_9,
  type StageConfig,
} from './stages';
import { simulateDungeon } from './simulation';

const PATH_LENGTH_PX = 640;
const CHAPTERS: StageConfig[][] = [
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8, CHAPTER_9,
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

// ─── Economy-curve guard ─────────────────────────────────────────────────────
// Complements the difficulty guard: locks in the reward economy so an accidental
// edit (a zero-reward wave, a boss that pays less than its opener, or a chapter
// whose payout regressed below Ch1) is caught in CI.

/** Total clear-reward gold a stage pays across all its waves. */
function stageReward(stage: StageConfig): number {
  return stage.waves.reduce((sum, w) => sum + (w.clearReward ?? 0), 0);
}

describe('campaign economy-curve guard', () => {
  it('every wave grants a positive clear reward (no free waves)', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter) {
        for (const w of stage.waves) {
          expect(w.clearReward ?? 0, `stage ${stage.id} wave ${w.wave} reward`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every stage has positive dungeonHp', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter) {
        expect(stage.dungeonHp, `stage ${stage.id} dungeonHp`).toBeGreaterThan(0);
      }
    }
  });

  it('within a stage the boss (last) wave pays at least as much as the opening wave', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter) {
        if (stage.waves.length < 2) continue;
        const first = stage.waves[0].clearReward ?? 0;
        const last  = stage.waves[stage.waves.length - 1].clearReward ?? 0;
        expect(last, `stage ${stage.id} last-wave ${last} < opener ${first}`).toBeGreaterThanOrEqual(first);
      }
    }
  });

  it('campaign economy scales up — final chapter finale out-rewards the Ch1 finale', () => {
    const c1Finale   = stageReward(CHAPTER_1[CHAPTER_1.length - 1]);
    const lastCh     = CHAPTERS[CHAPTERS.length - 1];
    const lastFinale = stageReward(lastCh[lastCh.length - 1]);
    expect(lastFinale, `final finale ${lastFinale} ≤ Ch1 finale ${c1Finale}`).toBeGreaterThan(c1Finale);
  });
});

// ─── Simulated-threat guard (headless simulateDungeon) ───────────────────────
// Runs the real combat sim against an UNDEFENDED dungeon at a high reference HP
// (so it never floors) to measure each stage's total wave threat — a real-combat
// cross-check complementing the per-invader dpsWall gate.

const REF_HP = 10_000_000;
function undefendedDamage(stage: StageConfig): number {
  const r = simulateDungeon([], [], stage.waves, REF_HP);
  return REF_HP - r.finalHp;
}

describe('campaign simulated-threat guard', () => {
  it('every stage deals real damage to an undefended dungeon (no zero-threat stage)', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter) {
        expect(undefendedDamage(stage), `stage ${stage.id} undefended damage`).toBeGreaterThan(0);
      }
    }
  });

  it('simulated wave threat trends upward — final-chapter finale far exceeds the Ch1 finale', () => {
    const c1     = undefendedDamage(CHAPTER_1[CHAPTER_1.length - 1]);
    const lastCh = CHAPTERS[CHAPTERS.length - 1];
    const cLast  = undefendedDamage(lastCh[lastCh.length - 1]);
    expect(cLast, `final finale threat ${cLast} vs Ch1 finale ${c1}`).toBeGreaterThan(c1 * 2);
  });
});
