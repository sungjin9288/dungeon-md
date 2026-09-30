/**
 * 심연 (Abyss) — GameState transactions (pure, immutable).
 *
 * Sit on top of the pure logic in abyss.ts. Each returns a NEW GameState
 * (never mutates), matching the project's transaction pattern
 * (fusionTransactions / forgeTransactions).
 */

import type { GameState } from './wisdom';
import { abyssBlueprintFor, grantBlueprint } from './blueprintSources';
import { applyBattleReturnSettlement, type BattleReturnResult } from './invasionTransactions';
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
  /** 보스층 격파로 얻은 설계도(blueprintSources.ts, 아직 없을 때만), 없으면 null. */
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
  if (firstClear) {
    next = { ...next, abyss: { ...abyss, highestFloor: floor } };
  }
  // Any battle win on a boss floor pays its blueprint if still missing — not only the first
  // clear, or a save that passed floor 10/20 before blueprints were added could never get them.
  // Sweeps (no battle) do not.
  const blueprint = abyssBlueprintFor(next, floor);
  next = grantBlueprint(next, blueprint);
  return { state: next, loot, firstClear, blueprint };
}

export interface AbyssBattleSettlement {
  readonly state: GameState;
  /** 전투 전리품 정산으로 DM 레벨이 올랐는가. */
  readonly didLevelUp: boolean;
  /** 이겼을 때의 층 정복 결과, 졌으면 null. */
  readonly clear: AbyssClearResult | null;
}

/**
 * 원정실로 돌아온 심연 전투를 정산한다: 전투에서 번 전리품 골드·DM 경험치·재료·부족 조각은 홈 침략·침공 스테이지와
 * 같이 이기든 지든 들어오고(`applyBattleReturnSettlement`, 침략 방어 목표는 올리지 않음), 이기면 층 정복 보상이 더해진다.
 * 예전에는 층 정복 보상만 넣어 전투 전리품이 사라졌다.
 */
export function settleAbyssBattle(
  state: GameState,
  floor: number,
  result: BattleReturnResult,
  { now, rng = Math.random }: { readonly now: number; readonly rng?: () => number },
): AbyssBattleSettlement {
  const settled = applyBattleReturnSettlement(state, result, { defendInvasion: false, now });
  if (!result.won) return { state: settled.state, didLevelUp: settled.didLevelUp, clear: null };
  const clear = clearAbyssFloor(settled.state, floor, rng);
  return { state: clear.state, didLevelUp: settled.didLevelUp, clear };
}
