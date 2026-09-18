// ─── Invader movement lock ────────────────────────────────────────────────────
// Several crowd-control effects can hold one invader at once (the tier-2/3
// traps apply two or three afflictions in a single entry, so overlap is the
// norm, not the exception). Two rules keep them from cancelling each other:
//
//   1. Movement resumes only when NO lock is left — the newest effect to expire
//      is the one that lets the invader walk again.
//   2. Speed modifiers (slow, rally/captain boost) compose, so an unrelated
//      effect ending must restore the *remaining* speed, never a blind 1×.
//
// Pure so the rules can be tested without a Phaser scene.

export interface MovementLockFlags {
  readonly isStunned: boolean;
  readonly isRooted:  boolean;
  readonly isFrozen:  boolean;
  readonly isCharmed: boolean;
}

export interface PathSpeedModifiers {
  /** Active slow factor (< 1), or 1 when not slowed. */
  readonly slowMult:  number;
  /** Active rally/captain factor (> 1), or 1 when not boosted. */
  readonly boostMult: number;
}

/** Whether any crowd-control effect still holds the invader in place. */
export function isMovementLocked(flags: MovementLockFlags): boolean {
  return flags.isStunned || flags.isRooted || flags.isFrozen || flags.isCharmed;
}

/** The path speed an unlocked invader should walk at, composing every modifier. */
export function restingPathSpeed(mods: PathSpeedModifiers): number {
  const slow  = Number.isFinite(mods.slowMult)  ? Math.max(0, mods.slowMult)  : 1;
  const boost = Number.isFinite(mods.boostMult) ? Math.max(0, mods.boostMult) : 1;
  return slow * boost;
}
