/**
 * Unit tests for CodexShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import {
  getDexNo,
  getRarityMeta,
  truncateLabel,
  isTribeClaimable,
  CODEX_RARITY_META,
  TRIBE_META,
  TRIBE_REWARD_MONSTER,
} from './CodexShared';
import { MONSTER_DEFS } from '../data/monsters';
import type { MonsterId } from '../data/monsters';

// ─── getDexNo ─────────────────────────────────────────────────────────────────

describe('getDexNo', () => {
  it('returns 001-padded string for the first monster key', () => {
    // The first key in MONSTER_DEFS should yield '001'
    const firstId = Object.keys(MONSTER_DEFS)[0] as MonsterId;
    expect(getDexNo(firstId)).toBe('001');
  });

  it('pads to 3 digits for a single-digit index', () => {
    const result = getDexNo('dokkaebi_warrior' as MonsterId);
    expect(result).toMatch(/^\d{3}$/);
  });

  it('returns 001 for an unknown monster id (index -1 floors to 0)', () => {
    // Unknown id → indexOf returns -1 → Math.max(0, -1) = 0 → '001'
    expect(getDexNo('nonexistent_id' as MonsterId)).toBe('001');
  });
});

// ─── getRarityMeta ────────────────────────────────────────────────────────────

describe('getRarityMeta', () => {
  it('returns C meta for undefined', () => {
    const meta = getRarityMeta(undefined);
    expect(meta.label).toBe(CODEX_RARITY_META['C'].label);
    expect(meta.stars).toBe('★');
  });

  it('returns correct meta for each defined tier', () => {
    const tiers = ['C', 'U', 'R', 'E', 'L'] as const;
    for (const tier of tiers) {
      const meta = getRarityMeta(tier);
      expect(meta.label).toBe(tier);
    }
  });

  it('falls back to C for an unknown tier string', () => {
    const meta = getRarityMeta('X');
    expect(meta.label).toBe('C');
  });
});

// ─── truncateLabel ────────────────────────────────────────────────────────────

describe('truncateLabel', () => {
  it('returns the string unchanged when shorter than maxChars', () => {
    expect(truncateLabel('abc', 5)).toBe('abc');
  });

  it('returns the string unchanged when equal to maxChars', () => {
    expect(truncateLabel('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when longer than maxChars', () => {
    expect(truncateLabel('abcdefgh', 4)).toBe('abcd…');
  });

  it('handles single-char max', () => {
    expect(truncateLabel('xyz', 1)).toBe('x…');
  });
});

// ─── TRIBE_META sanity ────────────────────────────────────────────────────────

describe('TRIBE_META', () => {
  it('has 9 tribes defined', () => {
    expect(TRIBE_META.length).toBe(9);
  });

  it('every tribe has a reward entry in TRIBE_REWARD_MONSTER', () => {
    TRIBE_META.forEach(tribe => {
      expect(TRIBE_REWARD_MONSTER[tribe.id]).toBeDefined();
    });
  });
});

// ─── isTribeClaimable ──────────────────────────────────────────────────────────

describe('isTribeClaimable', () => {
  const TRIBE = ['a', 'b', 'reward'] as unknown as MonsterId[];
  const REWARD = 'reward' as unknown as MonsterId;
  const OWN_AB = ['a', 'b'] as unknown as MonsterId[];
  const OWN_A = ['a'] as unknown as MonsterId[];
  const OWN_ALL = ['a', 'b', 'reward'] as unknown as MonsterId[];
  const ownedBy = (ids: readonly MonsterId[]) => (id: MonsterId) => ids.includes(id);

  it('is claimable when every NON-reward monster is owned (reward itself NOT owned)', () => {
    // The core soft-lock fix: reward monster is granted BY claiming, so it must
    // be excluded from the completion requirement.
    expect(isTribeClaimable(TRIBE, REWARD, ownedBy(OWN_AB), false)).toBe(true);
  });

  it('stays claimable when the reward is also already owned (until claimed flag set)', () => {
    expect(isTribeClaimable(TRIBE, REWARD, ownedBy(OWN_ALL), false)).toBe(true);
  });

  it('is NOT claimable when a non-reward monster is missing', () => {
    expect(isTribeClaimable(TRIBE, REWARD, ownedBy(OWN_A), false)).toBe(false);
  });

  it('is NOT claimable when already claimed', () => {
    expect(isTribeClaimable(TRIBE, REWARD, ownedBy(OWN_AB), true)).toBe(false);
  });

  it('is NOT claimable when there is no reward monster', () => {
    expect(isTribeClaimable(TRIBE, undefined, ownedBy(OWN_AB), false)).toBe(false);
  });

  it('is NOT claimable when the tribe has only the reward monster (nothing to collect)', () => {
    expect(isTribeClaimable([REWARD], REWARD, () => true, false)).toBe(false);
  });
});
