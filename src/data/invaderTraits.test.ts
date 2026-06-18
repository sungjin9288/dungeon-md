import { describe, it, expect } from 'vitest';
import { INVADER_TRAIT_BLURBS, getTraitBlurb } from './invaderTraits';
import { INVADER_DEFS } from './invaders';

describe('INVADER_TRAIT_BLURBS', () => {
  it('every blurb is a non-empty string', () => {
    for (const [key, blurb] of Object.entries(INVADER_TRAIT_BLURBS)) {
      expect(blurb, `${key} blurb`).toBeTruthy();
      expect(typeof blurb).toBe('string');
      expect((blurb as string).length, `${key} length`).toBeGreaterThan(2);
    }
  });

  it('covers a meaningful roster of tactical traits (>= 15)', () => {
    expect(Object.keys(INVADER_TRAIT_BLURBS).length).toBeGreaterThanOrEqual(15);
  });

  it('omits multi-phase boss behaviors (those are self-evident set-pieces)', () => {
    const bossPhases = [
      'FOX_QUEEN_PHASE', 'DRAGON_KING_PHASE', 'FIVE_PHASE',
      'EMPEROR_PHASE', 'GOD_EMPEROR_PHASE', 'PRIMORDIAL_PHASE', 'VOID_SURGE',
    ];
    for (const b of bossPhases) {
      expect(INVADER_TRAIT_BLURBS[b as keyof typeof INVADER_TRAIT_BLURBS], `${b} should be omitted`).toBeUndefined();
    }
  });
});

describe('getTraitBlurb', () => {
  it('returns the blurb for a known notable behavior', () => {
    expect(getTraitBlurb('IRON_BODY')).toBe(INVADER_TRAIT_BLURBS.IRON_BODY);
    expect(getTraitBlurb('SWARM')).toBeTruthy();
  });

  it('returns null for undefined and for un-blurbed (boss-phase) behaviors', () => {
    expect(getTraitBlurb(undefined)).toBeNull();
    expect(getTraitBlurb('FOX_QUEEN_PHASE')).toBeNull();
  });

  it('every blurbed behavior is actually used by at least one invader def', () => {
    // Guards against blurbs for behaviors that no invader has (dead data).
    const usedBehaviors = new Set(
      Object.values(INVADER_DEFS).map(d => d.behavior).filter(Boolean),
    );
    for (const key of Object.keys(INVADER_TRAIT_BLURBS)) {
      expect(usedBehaviors.has(key as never), `blurb "${key}" has no invader using it`).toBe(true);
    }
  });
});
