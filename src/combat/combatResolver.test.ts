import { describe, it, expect } from 'vitest';
import { findTarget } from './CombatResolver';
import type { RoomData } from '../data/rooms';
import type { CombatMonsterDef } from '../data/monsters';
import type { Invader } from '../objects/Invader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal RoomData stub — only `type` is used by findTarget */
function makeRoom(type: RoomData['type'] = 'guardian'): RoomData {
  return { type } as RoomData;
}

/** Minimal Invader stub with every field used by findTarget */
function makeInvader(overrides: {
  active?: boolean;
  x?: number;
  y?: number;
  isDamageImmune?: boolean;
  isStunned?: boolean;
  voidPhaseUntil?: number;
  isTrapImmune?: boolean;
  isInvisible?: boolean;
  pathProgress?: number;
} = {}): Invader {
  return {
    active:          overrides.active         ?? true,
    x:               overrides.x              ?? 100,
    y:               overrides.y              ?? 300,
    isDamageImmune:  overrides.isDamageImmune ?? false,
    isStunned:       overrides.isStunned      ?? false,
    voidPhaseUntil:  overrides.voidPhaseUntil ?? 0,
    isTrapImmune:    overrides.isTrapImmune   ?? false,
    isInvisible:     overrides.isInvisible    ?? false,
    pathTween:       overrides.pathProgress !== undefined
      ? { progress: overrides.pathProgress }
      : undefined,
  } as unknown as Invader;
}

const NOW = 10_000;
const ROOM_X = 50;
const CENTER_Y = 300;
const ROW_RANGE = 110; // CELL_SIZE

// ─── findTarget — basic targeting ─────────────────────────────────────────────

describe('findTarget — basic targeting', () => {
  it('returns null when invader list is empty', () => {
    expect(findTarget([], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('returns the single active invader within row range', () => {
    const inv = makeInvader({ x: 80, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('returns the closer of two active invaders', () => {
    const near = makeInvader({ x: 60, y: CENTER_Y });
    const far  = makeInvader({ x: 200, y: CENTER_Y });
    expect(findTarget([near, far], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(near);
  });

  it('returns null when the only invader is outside rowRange', () => {
    const inv = makeInvader({ x: 80, y: CENTER_Y + ROW_RANGE + 1 });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('selects the invader within row range when another is outside', () => {
    const inside  = makeInvader({ x: 80, y: CENTER_Y });
    const outside = makeInvader({ x: 60, y: CENTER_Y + ROW_RANGE + 1 });
    expect(findTarget([inside, outside], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inside);
  });
});

// ─── findTarget — skip conditions ─────────────────────────────────────────────

describe('findTarget — skip conditions', () => {
  it('skips inactive invaders', () => {
    const inv = makeInvader({ active: false, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('skips isDamageImmune invaders that are not stunned', () => {
    const inv = makeInvader({ isDamageImmune: true, isStunned: false, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('does NOT skip isDamageImmune invader when it is stunned', () => {
    const inv = makeInvader({ isDamageImmune: true, isStunned: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('skips invaders in void phase when room is a trap', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW + 5000, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('does NOT skip void-phase invaders in non-trap rooms', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW + 5000, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('guardian'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('skips void-phase invaders in trap_corridor rooms', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW + 5000, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap_corridor'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('skips trap-immune invaders in trap rooms', () => {
    const inv = makeInvader({ isTrapImmune: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('does NOT skip trap-immune invaders in guardian rooms', () => {
    const inv = makeInvader({ isTrapImmune: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('guardian'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('skips invisible invaders', () => {
    const inv = makeInvader({ isInvisible: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });
});

// ─── findTarget — SUN_DIVE passive ────────────────────────────────────────────

describe('findTarget — SUN_DIVE passive', () => {
  const sunDive: CombatMonsterDef = {
    baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500,
  };

  it('ignores row range and returns highest pathProgress invader', () => {
    // Placed far outside normal row range
    const farRow = makeInvader({ x: 80, y: CENTER_Y + ROW_RANGE * 3, pathProgress: 0.9 });
    const near   = makeInvader({ x: 80, y: CENTER_Y,                   pathProgress: 0.3 });
    expect(findTarget([farRow, near], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(farRow);
  });

  it('returns the invader with higher pathProgress when two are in range', () => {
    const low  = makeInvader({ x: 80, y: CENTER_Y, pathProgress: 0.2 });
    const high = makeInvader({ x: 90, y: CENTER_Y, pathProgress: 0.8 });
    expect(findTarget([low, high], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(high);
  });

  it('returns null when all SUN_DIVE candidates are inactive', () => {
    const inv = makeInvader({ active: false, x: 60, y: CENTER_Y, pathProgress: 0.9 });
    expect(findTarget([inv], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('still skips invisible invaders even with SUN_DIVE', () => {
    const inv = makeInvader({ isInvisible: true, x: 60, y: CENTER_Y, pathProgress: 0.99 });
    expect(findTarget([inv], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });
});

// ─── findTarget — void phase expiry edge case ─────────────────────────────────

describe('findTarget — void phase boundary', () => {
  it('targets the invader when voidPhaseUntil == now (expired)', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW, x: 60, y: CENTER_Y });
    // now < voidPhaseUntil is the skip condition → equal means NOT skipped
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });
});
