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

// ─── findTarget — row range boundary ─────────────────────────────────────────

describe('findTarget — row range boundary', () => {
  it('includes an invader at exactly rowRange distance (condition is strictly >)', () => {
    const inv = makeInvader({ x: ROOM_X, y: CENTER_Y + ROW_RANGE }); // diff == ROW_RANGE
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('excludes an invader one pixel beyond rowRange', () => {
    const inv = makeInvader({ x: ROOM_X, y: CENTER_Y + ROW_RANGE + 1 });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('returns null when all invaders are outside rowRange', () => {
    const a = makeInvader({ x: 60, y: CENTER_Y + ROW_RANGE + 5 });
    const b = makeInvader({ x: 70, y: CENTER_Y - ROW_RANGE - 5 });
    expect(findTarget([a, b], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('picks the one valid invader among several out-of-range', () => {
    const oor1 = makeInvader({ x: 60, y: CENTER_Y + ROW_RANGE + 10 });
    const ok   = makeInvader({ x: 80, y: CENTER_Y });
    const oor2 = makeInvader({ x: 60, y: CENTER_Y - ROW_RANGE - 10 });
    expect(findTarget([oor1, ok, oor2], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(ok);
  });
});

// ─── findTarget — trap_corridor symmetric skip ────────────────────────────────

describe('findTarget — trap_corridor symmetric skip', () => {
  it('skips trap-immune invader in trap_corridor (same rule as trap room)', () => {
    const inv = makeInvader({ isTrapImmune: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap_corridor'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('stunned invader in void phase in trap room is still skipped (stun does NOT override void-phase)', () => {
    // isDamageImmune stun-override applies only to the damage-immune check, not void phase
    const inv = makeInvader({ isStunned: true, voidPhaseUntil: NOW + 5000, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });
});

// ─── findTarget — tie-breaking ────────────────────────────────────────────────

describe('findTarget — tie-breaking', () => {
  it('normal mode: two invaders at equal hypot distance → first in array wins (strict <)', () => {
    // Both at (ROOM_X, CENTER_Y) → distance = 0 for both; first wins because 0 is NOT < 0
    const first  = makeInvader({ x: ROOM_X, y: CENTER_Y });
    const second = makeInvader({ x: ROOM_X, y: CENTER_Y });
    expect(findTarget([first, second], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(first);
  });

  it('SUN_DIVE: two invaders with equal pathProgress → first in array wins (strict >)', () => {
    const sunDive: CombatMonsterDef = { baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500 };
    const first  = makeInvader({ pathProgress: 0.5 });
    const second = makeInvader({ pathProgress: 0.5 });
    expect(findTarget([first, second], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(first);
  });

  it('SUN_DIVE: invisible invader with higher progress loses to non-invisible with lower progress', () => {
    const sunDive: CombatMonsterDef = { baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500 };
    const invisible = makeInvader({ isInvisible: true,  pathProgress: 0.99 }); // skipped
    const visible   = makeInvader({ isInvisible: false, pathProgress: 0.1  }); // selected
    expect(findTarget([invisible, visible], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(visible);
  });
});

// ─── findTarget — SUN_DIVE edge cases ────────────────────────────────────────

describe('findTarget — SUN_DIVE edge cases', () => {
  const sunDive: CombatMonsterDef = {
    baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500,
  };

  it('still skips damage-immune non-stunned invaders with SUN_DIVE', () => {
    const inv = makeInvader({ isDamageImmune: true, isStunned: false, pathProgress: 0.99 });
    expect(findTarget([inv], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('targets damage-immune invader if it is also stunned (SUN_DIVE)', () => {
    const inv = makeInvader({ isDamageImmune: true, isStunned: true, pathProgress: 0.99 });
    expect(findTarget([inv], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('treats undefined pathTween as progress=0 (still selectable)', () => {
    // makeInvader with no pathProgress leaves pathTween undefined
    const inv = makeInvader({ x: 60, y: CENTER_Y }); // pathTween undefined
    expect(findTarget([inv], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('prefers defined progress over undefined (0 default)', () => {
    const noTween = makeInvader({ x: 60, y: CENTER_Y });           // prog = 0
    const hasTween = makeInvader({ x: 200, y: CENTER_Y, pathProgress: 0.5 }); // prog = 0.5
    expect(findTarget([noTween, hasTween], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(hasTween);
  });

  it('all progress=0 → first active invader returned (0 > -Infinity on first pass)', () => {
    const a = makeInvader({ pathProgress: 0.0 });
    const b = makeInvader({ pathProgress: 0.0 });
    const c = makeInvader({ pathProgress: 0.0 });
    expect(findTarget([a, b, c], makeRoom(), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(a);
  });
});

// ─── findTarget — non-trap rooms ignore void phase & trap immunity ────────────

describe('findTarget — non-trap rooms ignore void-phase and trap immunity', () => {
  it('celestial_shrine room: void-phased invader is still targetable', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW + 9000, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('celestial_shrine'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('scroll_library room: trap-immune invader is still targetable', () => {
    const inv = makeInvader({ isTrapImmune: true, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('scroll_library'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('trap_corridor: non-trap-immune non-void-phased invader is valid target', () => {
    const inv = makeInvader({ x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap_corridor'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });
});

// ─── findTarget — closest of 3+ invaders & stun-only behaviour ───────────────

describe('findTarget — 3+ invader selection & stun-only state', () => {
  it('returns the closest of three invaders at distinct distances', () => {
    const near = makeInvader({ x: ROOM_X + 10,  y: CENTER_Y }); // dist=10
    const mid  = makeInvader({ x: ROOM_X + 50,  y: CENTER_Y }); // dist=50
    const far  = makeInvader({ x: ROOM_X + 200, y: CENTER_Y }); // dist=200
    expect(findTarget([far, mid, near], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(near);
  });

  it('isStunned=true alone (not damage-immune) does not affect targeting', () => {
    // stun is only relevant when isDamageImmune is also true
    const inv = makeInvader({ isStunned: true, isDamageImmune: false, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('voidPhaseUntil one ms before now is targetable in trap room (just expired)', () => {
    const inv = makeInvader({ voidPhaseUntil: NOW - 1, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('SUN_DIVE still skips void-phased invaders in trap rooms (filters run before passive)', () => {
    const sunDive: CombatMonsterDef = { baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500 };
    const inv = makeInvader({ voidPhaseUntil: NOW + 9000, x: 60, y: CENTER_Y, pathProgress: 0.99 });
    expect(findTarget([inv], makeRoom('trap'), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });
});

// ─── findTarget — negative row-range boundary & extra skip combinations ────────

describe('findTarget — negative row-range boundary & extra skip combos', () => {
  it('includes invader at exactly negative boundary (y = CENTER_Y - ROW_RANGE)', () => {
    // |CENTER_Y - ROW_RANGE - CENTER_Y| = ROW_RANGE; ROW_RANGE > ROW_RANGE is false → included
    const inv = makeInvader({ x: ROOM_X, y: CENTER_Y - ROW_RANGE });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('excludes invader one pixel past negative boundary (y = CENTER_Y - ROW_RANGE - 1)', () => {
    const inv = makeInvader({ x: ROOM_X, y: CENTER_Y - ROW_RANGE - 1 });
    expect(findTarget([inv], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('voidPhaseUntil = NOW + 1 in trap room → still skipped (one ms into future)', () => {
    // now < voidPhaseUntil: 10000 < 10001 → true → skipped
    const inv = makeInvader({ voidPhaseUntil: NOW + 1, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('three invaders — inactive + damage-immune-unstunned + valid → returns valid', () => {
    const inactive = makeInvader({ active: false,          x: 60, y: CENTER_Y });
    const immune   = makeInvader({ isDamageImmune: true, isStunned: false, x: 70, y: CENTER_Y });
    const valid    = makeInvader({ x: 80, y: CENTER_Y });
    expect(findTarget([inactive, immune, valid], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(valid);
  });

  it('SUN_DIVE: trap-immune invader in trap room is still skipped', () => {
    const sunDive: CombatMonsterDef = { baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500 };
    const inv = makeInvader({ isTrapImmune: true, pathProgress: 0.95, x: 60, y: CENTER_Y });
    expect(findTarget([inv], makeRoom('trap'), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });

  it('SUN_DIVE: void-phased invader in guardian room is NOT skipped', () => {
    const sunDive: CombatMonsterDef = { baseDamage: 40, passive: 'SUN_DIVE', range: 3, attackCooldown: 1500 };
    const inv = makeInvader({ voidPhaseUntil: NOW + 9000, pathProgress: 0.8, x: 60, y: CENTER_Y });
    // void phase only blocks trap / trap_corridor rooms — guardian is safe
    expect(findTarget([inv], makeRoom('guardian'), sunDive, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBe(inv);
  });

  it('all invaders are damage-immune and not stunned → returns null', () => {
    const a = makeInvader({ isDamageImmune: true, isStunned: false, x: 60,  y: CENTER_Y });
    const b = makeInvader({ isDamageImmune: true, isStunned: false, x: 100, y: CENTER_Y });
    expect(findTarget([a, b], makeRoom(), null, ROOM_X, CENTER_Y, ROW_RANGE, NOW)).toBeNull();
  });
});
