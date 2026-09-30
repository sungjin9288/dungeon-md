import { type SeasonBanner } from './banners';
import { defaultOwnedMonster } from './barracks';
import { type MonsterId } from './monsters';
import { applyQuestObjectiveUpdate, tickSubQuestProgress } from './quests';
import {
  RARITIES,
  RARITY_POOLS,
  RARITY_RATES,
  SC_COMP,
  SUMMON_TYPE_DEFS,
  type SummonType,
} from './summonPools';
import { getWisdomBonuses, type GameState, type SummonRarity, type SummonRecord } from './wisdom';
import { duplicateReward } from './tribeShards';

export interface SummonPullResult {
  monsterId: MonsterId;
  rarity: SummonRarity;
  rarityIdx: number;
  isNew: boolean;
  scComp: number;
  ceilingHit: boolean;
  /** Duplicate extras (P4 ②): tribe shards toward a guaranteed unowned guardian, and awakening stones. */
  tribe: string | null;
  tribeShards: number;
  awakeningStones: number;
  /** Copies of this monster owned after the pull (a duplicate joins the roster as evolution/absorption material). */
  copies: number;
}

export type SummonTransactionFailureReason =
  | 'unknown_summon_type'
  | 'invalid_summon_count'
  | 'friendship_already_used'
  | 'insufficient_gems'
  | 'insufficient_soul_crystals'
  | 'empty_summon_pool';

export type SummonTransactionResult =
  | {
      ok: true;
      state: GameState;
      results: SummonPullResult[];
      cost: number;
      wisdomSoulCrystals: number;
    }
  | {
      ok: false;
      state: GameState;
      reason: SummonTransactionFailureReason;
      required?: number;
      available?: number;
    };

export interface SummonTransactionOptions {
  readonly activeBanner?: SeasonBanner | null;
  readonly today?: string;
  readonly timestamp?: number;
  readonly rng?: () => number;
}

function rollRarityWithRng(rates: readonly number[], rng: () => number): number {
  let roll = rng() * 100;
  for (let i = 0; i < rates.length; i++) {
    roll -= rates[i];
    if (roll <= 0) return i;
  }
  let last = 0;
  for (let i = 0; i < rates.length; i++) {
    if (rates[i] > 0) last = i;
  }
  return last;
}

function pickRandom<T>(values: readonly T[], rng: () => number): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(rng() * values.length)];
}

function applyBannerBoostWithRng(
  banner: SeasonBanner,
  rarity: SummonRarity,
  pool: readonly MonsterId[],
  rng: () => number,
): MonsterId | undefined {
  if (rarity !== banner.boostedRarity) {
    return pickRandom(pool, rng);
  }

  const featured = banner.featuredMonsters.filter(id => pool.includes(id));
  if (featured.length === 0) return pickRandom(pool, rng);
  if (rng() < banner.rateMultiplier) return pickRandom(featured, rng);
  return pickRandom(pool, rng);
}

/**
 * The catalogue a summon draws from — `RARITY_POOLS` as written, gated by
 * RARITY and nothing else.
 *
 * This used to also filter by `unlockStage <= highestClearedStage`, which
 * collapsed the gacha the moment a player cleared anything: the pool went from
 * 114 monsters at zero clears to 1 at one clear (uncommon/rare/epic/legendary
 * all empty), and an empty pool aborts the whole pull with 'empty_summon_pool'.
 * Worse, the pity ceiling forces epic (normal) or legendary (special) while the
 * gate emptied epic until stage 24 and legendary until stage 43 — and the
 * failure path returns the ORIGINAL state, so the ceiling counter never
 * cleared and the summon button stayed permanently dead. Those two systems
 * cannot both be intended, which is what proved the gate was not.
 *
 * `unlockStage` means "when this monster appears in the story" (see
 * CHARACTER_B1_SPEC.md) and is the pacing model's roster lever
 * (`campaignPacing.expectedRoster`). Reusing it here double-gated acquisition
 * against data that was never tuned for it. Summoning ahead of the story is
 * what a gacha is for; rarity is the gate.
 */
function getSummonPool(_state: GameState, rarity: SummonRarity): MonsterId[] {
  return RARITY_POOLS[rarity];
}

export function applySummonPull(
  state: GameState,
  type: SummonType,
  count: number,
  options: SummonTransactionOptions = {},
): SummonTransactionResult {
  if (count <= 0) return { ok: false, state, reason: 'invalid_summon_count' };

  const summonDef = SUMMON_TYPE_DEFS.find(def => def.id === type);
  if (!summonDef) return { ok: false, state, reason: 'unknown_summon_type' };

  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const timestamp = options.timestamp ?? Date.now();
  const rng = options.rng ?? Math.random;
  const cost = count === 1 ? summonDef.cost1 : (summonDef.cost10 ?? summonDef.cost1 * count);

  let gems = state.gems ?? 0;
  let soulCrystals = state.soulCrystals ?? 0;
  let awakeningStones = state.awakeningStones ?? 0;
  const tribeShards = { ...(state.tribeShards ?? {}) };
  let lastFriendSummon = state.lastFriendSummon;

  if (type === 'friendship') {
    if (state.lastFriendSummon === today) {
      return { ok: false, state, reason: 'friendship_already_used' };
    }
  } else if (summonDef.currency === 'gems') {
    if (gems < cost) {
      return { ok: false, state, reason: 'insufficient_gems', required: cost, available: gems };
    }
    gems -= cost;
  } else if (summonDef.currency === 'soul') {
    if (soulCrystals < cost) {
      return { ok: false, state, reason: 'insufficient_soul_crystals', required: cost, available: soulCrystals };
    }
    soulCrystals -= cost;
  }

  const pity = state.summonPity
    ? { normal: { ...state.summonPity.normal }, special: { ...state.summonPity.special } }
    : { normal: { count: 0, guaranteed: 50 }, special: { count: 0, guaranteed: 80 } };
  const ownedMonsters = [...(state.ownedMonsters ?? [])];
  const summonHistory = [...(state.summonHistory ?? [])];
  const results: SummonPullResult[] = [];

  for (let i = 0; i < count; i++) {
    let rarityIdx: number;
    let ceilingHit = false;

    if ((type === 'normal' || type === 'special') && pity[type]) {
      pity[type].count++;
      if (pity[type].count >= pity[type].guaranteed) {
        rarityIdx = type === 'normal' ? 3 : 4;
        ceilingHit = true;
        pity[type].count = 0;
      } else {
        rarityIdx = rollRarityWithRng(RARITY_RATES[type], rng);
      }
    } else {
      rarityIdx = rollRarityWithRng(RARITY_RATES[type], rng);
    }

    const rarity = RARITIES[rarityIdx];
    const pool = getSummonPool(state, rarity);
    if (pool.length === 0) return { ok: false, state, reason: 'empty_summon_pool' };

    let monsterId: MonsterId | undefined;
    if (type === 'soul') {
      const ownedIds = new Set(ownedMonsters.map(monster => monster.id));
      const unowned = pool.filter(id => !ownedIds.has(id));
      monsterId = pickRandom(unowned.length > 0 ? unowned : pool, rng);
    } else if (
      options.activeBanner &&
      (options.activeBanner.validSummonTypes as string[]).includes(type) &&
      !ceilingHit
    ) {
      monsterId = applyBannerBoostWithRng(options.activeBanner, rarity, pool, rng);
    } else {
      monsterId = pickRandom(pool, rng);
    }
    if (!monsterId) return { ok: false, state, reason: 'empty_summon_pool' };

    const alreadyOwned = ownedMonsters.some(monster => monster.id === monsterId);
    let scComp = 0;
    let dup: ReturnType<typeof duplicateReward> = { tribe: null, shards: 0, awakeningStones: 0 };
    // Every pull joins the roster: evolution fuses 3 copies and absorption eats spares, and the lineage
    // guide tells the player to "collect ×3 · summon" — a duplicate that only paid a bonus left both unreachable.
    ownedMonsters.push(defaultOwnedMonster(monsterId));
    if (alreadyOwned) {
      scComp = SC_COMP[rarityIdx];
      soulCrystals += scComp;
      dup = duplicateReward(monsterId, rarityIdx);
      if (dup.tribe && dup.shards > 0) tribeShards[dup.tribe] = (tribeShards[dup.tribe] ?? 0) + dup.shards;
      awakeningStones += dup.awakeningStones;
    }

    if (type === 'friendship') lastFriendSummon = today;

    const record: SummonRecord = {
      type,
      monsterId,
      rarity,
      isNew: !alreadyOwned,
      timestamp,
      scCompensation: scComp || undefined,
      ceilingHit: ceilingHit || undefined,
    };
    summonHistory.push(record);
    const copies = ownedMonsters.filter(monster => monster.id === monsterId).length;
    results.push({ monsterId, rarity, rarityIdx, isNew: !alreadyOwned, scComp, ceilingHit, tribe: dup.tribe, tribeShards: dup.shards, awakeningStones: dup.awakeningStones, copies });
  }

  const wisdomSoulCrystals = Math.max(0, getWisdomBonuses(state).summonBonusCrystal * count);
  soulCrystals += wisdomSoulCrystals;

  const updated = {
    ...state,
    gems,
    soulCrystals,
    awakeningStones,
    tribeShards,
    summonPity: pity,
    ownedMonsters,
    summonHistory,
    lastFriendSummon,
  };
  const [questUpdated] = applyQuestObjectiveUpdate(updated, 'summon', count);

  return {
    ok: true,
    state: tickSubQuestProgress(questUpdated, 'summon', count),
    results,
    cost,
    wisdomSoulCrystals,
  };
}
