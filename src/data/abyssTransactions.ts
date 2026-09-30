/**
 * 심연 (Abyss) — GameState transactions (pure, immutable).
 *
 * Sit on top of the pure logic in abyss.ts. Each returns a NEW GameState
 * (never mutates), matching the project's transaction pattern
 * (fusionTransactions / forgeTransactions).
 */

import type { GameState } from './wisdom';
import { abyssBlueprintFor, grantBlueprint } from './blueprintSources';
import {
  type AbyssState,
  type AbyssLoot,
  DEFAULT_ABYSS_STATE,
  ABYSS_MAX_FLOOR,
  refilledKeys,
  canSweepAbyss,
  rollAbyssLoot,
} from './abyss';

function getAbyss(state: GameState): AbyssState {
  return state.abyss ?? DEFAULT_ABYSS_STATE;
}

/** Merge rolled loot into a NEW GameState (materials + awakening stones + gold). */
function applyLoot(state: GameState, loot: AbyssLoot): GameState {
  const materials = { ...(state.materials ?? {}) };
  for (const [id, qty] of Object.entries(loot.materials)) {
    materials[id] = (materials[id] ?? 0) + qty;
  }
  return {
    ...state,
    materials,
    awakeningStones: (state.awakeningStones ?? 0) + loot.awakeningStones,
    homeGold: (state.homeGold ?? 0) + loot.gold,
    totalGoldEarned: (state.totalGoldEarned ?? 0) + loot.gold,
  };
}

/** Refill sweep keys if the calendar day rolled over. */
export function refillAbyssKeysIfNewDay(state: GameState, today: string): GameState {
  const abyss = getAbyss(state);
  const refilled = refilledKeys(abyss, today);
  if (refilled === abyss) return state;
  return { ...state, abyss: refilled };
}

export interface AbyssSweepResult {
  readonly state: GameState;
  readonly loot: AbyssLoot | null;
  readonly ok: boolean;
  readonly reason?: 'locked' | 'no_keys';
}

/**
 * Instantly sweep a previously-cleared floor for its loot, spending one key.
 * Refills keys for `today` first so a day-rollover is honoured.
 */
export function sweepAbyssFloor(
  state: GameState,
  floor: number,
  today: string,
  rng: () => number = Math.random,
): AbyssSweepResult {
  const refreshed = refillAbyssKeysIfNewDay(state, today);
  const abyss = getAbyss(refreshed);
  const check = canSweepAbyss(abyss, floor);
  if (!check.ok) return { state: refreshed, loot: null, ok: false, reason: check.reason };

  const loot = rollAbyssLoot(floor, rng);
  const looted = applyLoot(refreshed, loot);
  return {
    state: { ...looted, abyss: { ...abyss, keys: abyss.keys - 1 } },
    loot,
    ok: true,
  };
}

export interface AbyssClearResult {
  readonly state: GameState;
  readonly loot: AbyssLoot;
  readonly firstClear: boolean;
  /** 보스층 첫 정복으로 얻은 설계도(blueprintSources.ts), 없으면 null. */
  readonly blueprint: string | null;
}

/**
 * Resolve a won Abyss battle on `floor`. First-clear of the deepest+1 floor
 * advances depth and grants a richer reward (1.5x); replaying a cleared floor
 * grants normal loot. Battle clears never cost keys (keys gate only sweeps).
 */
export function clearAbyssFloor(
  state: GameState,
  floor: number,
  rng: () => number = Math.random,
): AbyssClearResult {
  const abyss = getAbyss(state);
  const firstClear = floor === abyss.highestFloor + 1 && floor <= ABYSS_MAX_FLOOR;
  const loot = rollAbyssLoot(floor, rng, firstClear ? 1.5 : 1);
  let next = applyLoot(state, loot);
  let blueprint: string | null = null;
  if (firstClear) {
    blueprint = abyssBlueprintFor(next, floor);
    next = grantBlueprint({ ...next, abyss: { ...abyss, highestFloor: floor } }, blueprint);
  }
  return { state: next, loot, firstClear, blueprint };
}
