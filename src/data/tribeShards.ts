// ─── Tribe shards (부족 조각) ─────────────────────────────────────────────────
// A duplicate pull is no longer only soul-crystal change: it also drops an
// awakening stone (rarer pulls) and shards of the duplicate's tribe. 100
// shards buy one guardian of that tribe the player does not own yet — the
// Cookie Run "shard" principle on the soul summon's unowned-only pool.
// Design: GAME_DESIGN_BENCHMARK.md §4.4 ②. Pure.

import { MONSTER_DEFS, type MonsterId } from './monsters';
import { defaultOwnedMonster } from './barracks';
import { RARITY_POOLS } from './summonPools';
import type { GameState } from './wisdom';

/** Per duplicate, by rarity index 0..4 (common → legendary). */
export const SHARDS_PER_DUPLICATE: readonly number[] = [5, 8, 15, 25, 40];
export const AWAKENING_STONES_PER_DUPLICATE: readonly number[] = [0, 0, 1, 1, 2];
export const TRIBE_SHARD_REDEEM_COST = 100;

export interface DuplicateReward {
  readonly tribe: string | null;
  readonly shards: number;
  readonly awakeningStones: number;
}

export function duplicateReward(monsterId: string, rarityIdx: number): DuplicateReward {
  const tribe = MONSTER_DEFS[monsterId as MonsterId]?.tribe ?? null;
  const idx = Math.max(0, Math.min(SHARDS_PER_DUPLICATE.length - 1, rarityIdx));
  return { tribe, shards: tribe ? SHARDS_PER_DUPLICATE[idx] : 0, awakeningStones: AWAKENING_STONES_PER_DUPLICATE[idx] };
}

export function getTribeShards(state: Readonly<Pick<GameState, 'tribeShards'>>, tribe: string): number {
  return state.tribeShards?.[tribe] ?? 0;
}

function highestClearedStage(state: Readonly<Pick<GameState, 'stageProgress'>>): number {
  return (state.stageProgress ?? []).reduce(
    (max: number, progress: { bestStars?: number }, idx: number) => ((progress?.bestStars ?? 0) > 0 ? idx + 1 : max),
    0,
  );
}

/** Summonable guardians of `tribe` the player does not own yet, gated like the summon pools. */
export function redeemableTribeMonsters(
  state: Readonly<Pick<GameState, 'ownedMonsters' | 'stageProgress'>>,
  tribe: string,
): MonsterId[] {
  const owned = new Set((state.ownedMonsters ?? []).map(monster => monster.id));
  const cleared = highestClearedStage(state);
  const summonable = new Set<MonsterId>(Object.values(RARITY_POOLS).flat() as MonsterId[]);
  return (Object.keys(MONSTER_DEFS) as MonsterId[]).filter(id => {
    const def = MONSTER_DEFS[id];
    if (def.tribe !== tribe || owned.has(id) || !summonable.has(id)) return false;
    return cleared <= 0 || (def.unlockStage ?? 1) <= cleared;
  });
}

export type TribeShardFailureReason = 'insufficient_shards' | 'tribe_complete';

export type TribeShardRedeemResult =
  | { readonly ok: true; readonly state: GameState; readonly monsterId: MonsterId; readonly spent: number }
  | { readonly ok: false; readonly state: GameState; readonly reason: TribeShardFailureReason; readonly have: number; readonly need: number };

export function canRedeemTribeShards(state: GameState, tribe: string): { readonly ok: boolean; readonly reason?: TribeShardFailureReason; readonly candidates: number } {
  const candidates = redeemableTribeMonsters(state, tribe).length;
  if (getTribeShards(state, tribe) < TRIBE_SHARD_REDEEM_COST) return { ok: false, reason: 'insufficient_shards', candidates };
  if (candidates === 0) return { ok: false, reason: 'tribe_complete', candidates };
  return { ok: true, candidates };
}

/** Spend 100 shards of `tribe` for one random unowned guardian of that tribe. */
export function redeemTribeShards(state: GameState, tribe: string, rng: () => number = Math.random): TribeShardRedeemResult {
  const have = getTribeShards(state, tribe);
  const check = canRedeemTribeShards(state, tribe);
  if (!check.ok) return { ok: false, state, reason: check.reason ?? 'insufficient_shards', have, need: TRIBE_SHARD_REDEEM_COST };
  const candidates = redeemableTribeMonsters(state, tribe);
  const monsterId = candidates[Math.floor(rng() * candidates.length)];
  return {
    ok: true,
    monsterId,
    spent: TRIBE_SHARD_REDEEM_COST,
    state: {
      ...state,
      tribeShards: { ...(state.tribeShards ?? {}), [tribe]: have - TRIBE_SHARD_REDEEM_COST },
      ownedMonsters: [...(state.ownedMonsters ?? []), defaultOwnedMonster(monsterId)],
    },
  };
}
