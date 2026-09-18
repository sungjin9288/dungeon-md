import { describe, expect, it } from 'vitest';
import { isMovementLocked, restingPathSpeed } from './movementLock';

const free = { isStunned: false, isRooted: false, isFrozen: false, isCharmed: false };

describe('movement lock', () => {
  it('is locked while any single effect holds the invader', () => {
    expect(isMovementLocked(free)).toBe(false);
    for (const key of ['isStunned', 'isRooted', 'isFrozen', 'isCharmed'] as const) {
      expect(isMovementLocked({ ...free, [key]: true }), key).toBe(true);
    }
  });

  it('stays locked when one of two overlapping effects expires', () => {
    // storm_cage lands shock (stun 1s) and fear (charm 2s) together: the stun
    // expiring must not hand movement back while the charm is still running.
    const both = { ...free, isStunned: true, isCharmed: true };
    expect(isMovementLocked(both)).toBe(true);
    expect(isMovementLocked({ ...both, isStunned: false })).toBe(true);
    expect(isMovementLocked({ ...both, isStunned: false, isCharmed: false })).toBe(false);
  });
});

describe('resting path speed', () => {
  it('composes slow and boost instead of snapping back to 1', () => {
    expect(restingPathSpeed({ slowMult: 1, boostMult: 1 })).toBe(1);
    expect(restingPathSpeed({ slowMult: 0.6, boostMult: 1 })).toBeCloseTo(0.6);
    expect(restingPathSpeed({ slowMult: 1, boostMult: 1.3 })).toBeCloseTo(1.3);
    // A captain aura on a slowed invader: both apply, neither is lost.
    expect(restingPathSpeed({ slowMult: 0.6, boostMult: 1.3 })).toBeCloseTo(0.78);
  });

  it('treats missing or nonsense values as no modifier', () => {
    expect(restingPathSpeed({ slowMult: Number.NaN, boostMult: 1 })).toBe(1);
    expect(restingPathSpeed({ slowMult: -2, boostMult: 1 })).toBe(0);
  });
});
