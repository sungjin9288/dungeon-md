/**
 * Unit tests for RoomPickerShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import type { DungeonSlot } from '../data/wisdom';
import {
  fitPickerLabel,
  formatSigned,
  formatDeltaParts,
  getMonsterRoomFitLabel,
  getTrapRoomFitLabel,
  getPickerMonsterRarityMeta,
} from './RoomPickerShared';
import type { RoomMetricDelta } from '../data/dungeonMetrics';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCombatSlot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType: 'combat',
    roomLevel: 1,
    hp: 100,
    maxHp: 100,
    monsterIds: [],
    trapIds: [],
    ...overrides,
  };
}

function makeDelta(overrides: Partial<RoomMetricDelta> = {}): RoomMetricDelta {
  return {
    threatDelta: 0,
    lootDelta: 0,
    readinessDelta: 0,
    ...overrides,
  };
}

// ─── fitPickerLabel ───────────────────────────────────────────────────────────

describe('fitPickerLabel', () => {
  it('returns the label unchanged when it fits within max', () => {
    expect(fitPickerLabel('hello', 8)).toBe('hello');
  });

  it('truncates with ellipsis when label exceeds max', () => {
    // slice(0, max-1) = slice(0,7) = 'verylon', then appended '…'
    const result = fitPickerLabel('verylongname', 8);
    expect(result).toBe('verylon…');
    expect(result.length).toBe(8); // 7 chars + ellipsis
  });

  it('does not truncate when label length equals max', () => {
    expect(fitPickerLabel('12345678', 8)).toBe('12345678');
  });

  it('uses default max of 8 when not provided', () => {
    const result = fitPickerLabel('toolonglabel');
    expect(result.endsWith('…')).toBe(true);
  });
});

// ─── formatSigned ─────────────────────────────────────────────────────────────

describe('formatSigned', () => {
  it('prefixes positive numbers with +', () => {
    expect(formatSigned(5)).toBe('+5');
  });

  it('returns negative numbers as-is with minus sign', () => {
    expect(formatSigned(-3)).toBe('-3');
  });

  it('returns 0 without a plus sign', () => {
    expect(formatSigned(0)).toBe('0');
  });
});

// ─── formatDeltaParts ─────────────────────────────────────────────────────────

describe('formatDeltaParts', () => {
  it('returns empty array when all deltas are zero', () => {
    expect(formatDeltaParts(makeDelta())).toEqual([]);
  });

  it('includes threat part when threatDelta is non-zero', () => {
    const parts = formatDeltaParts(makeDelta({ threatDelta: 3 }));
    expect(parts).toContain('위협 +3');
  });

  it('includes loot and readiness parts with correct labels', () => {
    const parts = formatDeltaParts(makeDelta({ lootDelta: -2, readinessDelta: 10 }));
    expect(parts).toContain('전리품 -2');
    expect(parts).toContain('준비 +10%');
  });

  it('returns all three parts when all deltas are non-zero', () => {
    const parts = formatDeltaParts(makeDelta({ threatDelta: 1, lootDelta: 2, readinessDelta: 3 }));
    expect(parts).toHaveLength(3);
  });
});

// ─── getMonsterRoomFitLabel ────────────────────────────────────────────────────

describe('getMonsterRoomFitLabel', () => {
  it('returns fit label when slot and monster type match a known combo', () => {
    const slot = makeCombatSlot({ roomType: 'combat' });
    expect(getMonsterRoomFitLabel(slot, 'melee')).toBe('전열 핵심');
  });

  it('falls back to MONSTER_TYPE_LABEL when no fit defined', () => {
    const slot = makeCombatSlot({ roomType: 'combat' });
    // support type has no fit in combat rooms
    expect(getMonsterRoomFitLabel(slot, 'support')).toBe('지원');
  });

  it('returns type label when slot is null', () => {
    expect(getMonsterRoomFitLabel(null, 'ranged')).toBe('원거리');
  });
});

// ─── getTrapRoomFitLabel ──────────────────────────────────────────────────────

describe('getTrapRoomFitLabel', () => {
  it('returns fit label for a matching trap + room combo', () => {
    const slot = makeCombatSlot({ roomType: 'trap' });
    expect(getTrapRoomFitLabel(slot, 'stun_trap')).toBe('핵심 제압');
  });

  it('returns "함정실 보정" for trap room type with unrecognised trap', () => {
    const slot = makeCombatSlot({ roomType: 'trap' });
    expect(getTrapRoomFitLabel(slot, 'unknown_trap')).toBe('함정실 보정');
  });

  it('returns "보조 설비" for non-trap room with unrecognised trap', () => {
    const slot = makeCombatSlot({ roomType: 'combat' });
    expect(getTrapRoomFitLabel(slot, 'unknown_trap')).toBe('보조 설비');
  });

  it('returns "기본 설비" when slot is null', () => {
    expect(getTrapRoomFitLabel(null, 'stun_trap')).toBe('기본 설비');
  });
});

// ─── getPickerMonsterRarityMeta ────────────────────────────────────────────────

describe('getPickerMonsterRarityMeta', () => {
  it('returns Common meta for "C" tier', () => {
    const meta = getPickerMonsterRarityMeta('C');
    expect(meta.stars).toBe('★');
  });

  it('returns Legendary meta for "L" tier', () => {
    const meta = getPickerMonsterRarityMeta('L');
    expect(meta.stars).toBe('★★★★★');
  });

  it('falls back to Common meta for unknown tier', () => {
    const meta = getPickerMonsterRarityMeta('X');
    expect(meta.stars).toBe('★');
  });

  it('falls back to Common meta for undefined', () => {
    const meta = getPickerMonsterRarityMeta(undefined);
    expect(meta.stars).toBe('★');
  });
});

