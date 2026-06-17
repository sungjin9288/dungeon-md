/**
 * Unit tests for SummonShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import { loadGameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import {
  getDexNo,
  getMonsterTagLine,
  getCollectionSummary,
  SUMMON_TRIBE_LABELS,
  SUMMON_ELEMENT_LABELS,
} from './SummonShared';
import type { GameState } from '../data/wisdom';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGs(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

// ─── getDexNo ─────────────────────────────────────────────────────────────────

describe('getDexNo', () => {
  it('returns 001 for the first monster in MONSTER_DEFS', () => {
    const firstId = Object.keys(MONSTER_DEFS)[0] as MonsterId;
    expect(getDexNo(firstId)).toBe('001');
  });

  it('returns a zero-padded 3-digit string for subsequent entries', () => {
    const ids     = Object.keys(MONSTER_DEFS) as MonsterId[];
    const lastId  = ids[ids.length - 1];
    const result  = getDexNo(lastId);
    expect(result).toMatch(/^\d{3}$/);
    expect(result).toBe(String(ids.length).padStart(3, '0'));
  });

  it('returns 001 for an unknown id (indexOf returns -1, clamped to 0)', () => {
    expect(getDexNo('unknown_id' as MonsterId)).toBe('001');
  });
});

// ─── getMonsterTagLine ────────────────────────────────────────────────────────

describe('getMonsterTagLine', () => {
  it('formats tribe · element when both are present', () => {
    const firstDef = Object.values(MONSTER_DEFS)[0];
    const tagline  = getMonsterTagLine(firstDef);
    expect(tagline).toMatch(/·/);
  });

  it('uses known Korean tribe label for dokkaebi', () => {
    const def = { ...Object.values(MONSTER_DEFS)[0], tribe: 'dokkaebi', element: undefined };
    const tagline = getMonsterTagLine(def as (typeof MONSTER_DEFS)[MonsterId]);
    expect(tagline).toContain(SUMMON_TRIBE_LABELS['dokkaebi']);
    expect(tagline).toContain('중립');
  });

  it('falls back to raw tribe string for unknown tribe key', () => {
    const def = { ...Object.values(MONSTER_DEFS)[0], tribe: 'custom_tribe', element: undefined };
    const tagline = getMonsterTagLine(def as (typeof MONSTER_DEFS)[MonsterId]);
    expect(tagline).toContain('custom_tribe');
  });

  it('uses Korean element label for fire', () => {
    const def = { ...Object.values(MONSTER_DEFS)[0], tribe: undefined, element: 'fire' };
    const tagline = getMonsterTagLine(def as (typeof MONSTER_DEFS)[MonsterId]);
    expect(tagline).toContain(SUMMON_ELEMENT_LABELS['fire']);
  });
});

// ─── getCollectionSummary ─────────────────────────────────────────────────────

describe('getCollectionSummary', () => {
  it('returns zero owned when ownedMonsters is empty', () => {
    const gs      = makeGs({ ownedMonsters: [] });
    const summary = getCollectionSummary(gs);
    expect(summary.owned).toBe(0);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('counts epics and legends from summonHistory', () => {
    const gs = makeGs({
      summonHistory: [
        { type: 'normal', monsterId: 'dokkaebi_warrior', rarity: 'epic',      isNew: true,  timestamp: 1 },
        { type: 'normal', monsterId: 'dokkaebi_warrior', rarity: 'legendary', isNew: false, timestamp: 2 },
        { type: 'normal', monsterId: 'dokkaebi_warrior', rarity: 'rare',      isNew: false, timestamp: 3 },
      ],
    });
    const summary = getCollectionSummary(gs);
    expect(summary.epics).toBe(1);
    expect(summary.legends).toBe(1);
    expect(summary.totalPulls).toBe(3);
  });

  it('recent slice is reversed and at most 3 entries', () => {
    const history = [1, 2, 3, 4, 5].map(n => ({
      type: 'normal' as const,
      monsterId: 'dokkaebi_warrior',
      rarity: 'common' as const,
      isNew: false,
      timestamp: n,
    }));
    const gs      = makeGs({ summonHistory: history });
    const summary = getCollectionSummary(gs);
    expect(summary.recent).toHaveLength(3);
    // reversed: newest first (timestamp 5 should be first)
    expect(summary.recent[0].timestamp).toBe(5);
  });

  it('total equals number of keys in MONSTER_DEFS', () => {
    const gs      = makeGs({});
    const summary = getCollectionSummary(gs);
    expect(summary.total).toBe(Object.keys(MONSTER_DEFS).length);
  });
});
