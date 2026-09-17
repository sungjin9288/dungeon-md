/**
 * 던전 방치 수익 (Idle / offline dungeon income).
 *
 * The dungeon master's core "경영" (management) payoff: the dungeon you build
 * and upgrade keeps earning gold while you're away. Income scales with how
 * developed the dungeon is — number of built rooms, their levels, the guardians
 * deployed in them, and the DM level — so growing the dungeon directly grows
 * passive income. Accumulation is capped so returning after a long break gives
 * a satisfying-but-bounded payout.
 *
 * Pure data/logic only — no Phaser, no GameState mutation beyond returning new
 * copies (immutable). Timestamps are injected so this is fully deterministic
 * and testable.
 */

import { getWisdomBonuses, type GameState, type DungeonSlot } from './wisdom';
import { facilityProductionOverMs } from './production';
import { computeDecorationBonuses } from './decorations';

// ─── Tunable rate constants (gold per minute) ────────────────────────────────
export const IDLE_BASE_PER_MIN     = 1;     // a staffed dungeon ticks over at all
export const IDLE_PER_ROOM         = 3;     // each built room
export const IDLE_PER_LEVEL        = 2;     // each room level beyond 1
export const IDLE_PER_GUARDIAN     = 1.5;   // each deployed guardian
export const IDLE_DM_BONUS         = 0.04;  // ×(1 + dmLevel * this)
export const IDLE_CAP_HOURS        = 8;     // max accumulation window
export const IDLE_CAP_MS           = IDLE_CAP_HOURS * 60 * 60 * 1000;

export interface IdleReward {
  /** Total gold earned — dungeon operation + treasury facility (floored). */
  readonly gold: number;
  /** Materials produced by 생산 시설 over the credited window (floored per id). */
  readonly materials: Record<string, number>;
  /** Real elapsed time since last collection, in ms (uncapped). */
  readonly elapsedMs: number;
  /** Elapsed time actually paid out, in ms (capped at IDLE_CAP_MS). */
  readonly creditedMs: number;
  /** Whether the elapsed time hit the accumulation cap. */
  readonly capped: boolean;
  /** The dungeon's current operation gold-per-minute rate (excludes facilities). */
  readonly ratePerMin: number;
}

/** Whether a reward actually contains anything worth claiming. */
export function hasIdlePayout(reward: IdleReward): boolean {
  return reward.gold > 0 || Object.keys(reward.materials).length > 0;
}

function definedCount(ids: readonly (string | undefined | null)[] | undefined): number {
  return (ids ?? []).filter(Boolean).length;
}

/** Whether a slot counts as a built room (has a room type assigned). */
function isBuilt(slot: DungeonSlot | undefined | null): slot is DungeonSlot {
  return Boolean(slot && slot.roomType);
}

/**
 * The dungeon's passive gold-per-minute, derived from its development:
 * built rooms + their levels + deployed guardians, scaled by DM level.
 * Returns 0 when nothing is built yet.
 */
export function dungeonGoldPerMin(state: Readonly<Pick<GameState, 'dungeonSlots' | 'dmLevel' | 'wisdomTree'>>): number {
  const built = (state.dungeonSlots ?? []).filter(isBuilt);
  if (built.length === 0) return 0;

  let levelSum = 0;
  let guardians = 0;
  for (const slot of built) {
    levelSum  += Math.max(0, (slot.roomLevel ?? 1) - 1);
    guardians += definedCount(slot.monsterIds);
  }

  const raw =
    IDLE_BASE_PER_MIN +
    built.length * IDLE_PER_ROOM +
    levelSum * IDLE_PER_LEVEL +
    guardians * IDLE_PER_GUARDIAN;

  const dmScale = 1 + Math.max(0, (state.dmLevel ?? 1)) * IDLE_DM_BONUS;
  // 지혜의 나무 `황금의 손` — the tree's only economy branch now that battles
  // no longer hand out starting gold.
  const wisdomScale = getWisdomBonuses(state).idleIncomeMult;
  return raw * dmScale * wisdomScale;
}

/**
 * Compute the idle reward owed since the last collection at time `now` (ms).
 * On an uninitialized clock (lastIdleCollect <= 0) nothing is owed — the clock
 * starts on the next collect so the first visit never dumps epoch-sized gold.
 */
export function computeIdleReward(state: Readonly<GameState>, now: number): IdleReward {
  const ratePerMin = dungeonGoldPerMin(state);
  const last = state.lastIdleCollect ?? 0;

  if (last <= 0 || now <= last) {
    return { gold: 0, materials: {}, elapsedMs: 0, creditedMs: 0, capped: false, ratePerMin };
  }

  const elapsedMs  = now - last;
  const creditedMs = Math.min(elapsedMs, IDLE_CAP_MS);

  // Decoration set bonuses scale idle gold + facility production.
  const deco = computeDecorationBonuses(state.placedDecorations);
  const goldMult = 1 + deco.idleGoldPct / 100;
  const prodMult = 1 + deco.idleProductionPct / 100;

  const operationGold = Math.floor(ratePerMin * (creditedMs / 60000) * goldMult);
  // Apply the production bonus by scaling the credited window before flooring.
  const production = facilityProductionOverMs(state.productionFacilities, creditedMs * prodMult);

  return {
    gold: operationGold + production.gold,
    materials: production.materials,
    elapsedMs,
    creditedMs,
    capped: elapsedMs > IDLE_CAP_MS,
    ratePerMin,
  };
}

/**
 * Collect idle income: returns a new state with the gold credited and the
 * clock reset to `now`. Always advances the clock (even on a 0 payout) so the
 * accumulation window restarts from this visit.
 */
export function collectIdleIncome(
  state: Readonly<GameState>,
  now: number,
): { state: GameState; reward: IdleReward } {
  const reward = computeIdleReward(state, now);
  const materials = { ...(state.materials ?? {}) };
  for (const [id, qty] of Object.entries(reward.materials)) {
    materials[id] = (materials[id] ?? 0) + qty;
  }
  return {
    state: {
      ...state,
      homeGold: state.homeGold + reward.gold,
      materials,
      lastIdleCollect: now,
    },
    reward,
  };
}

/** Start/refresh the idle clock without paying out (e.g. first-ever load). */
export function startIdleClock(state: Readonly<GameState>, now: number): GameState {
  if ((state.lastIdleCollect ?? 0) > 0) return state as GameState;
  return { ...state, lastIdleCollect: now };
}
