import { type SeasonBanner } from './banners';
import { defaultOwnedMonster } from './barracks';
import { MONSTER_DEFS, type MonsterId } from './monsters';
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

export interface SummonPullResult {
  monsterId: MonsterId;
  rarity: SummonRarity;
  rarityIdx: number;
  isNew: boolean;
  scComp: number;
  ceilingHit: boolean;
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

function getHighestClearedStage(state: GameState): number {
  return (state.stageProgress ?? []).reduce(
    (max: number, progress: { bestStars?: number }, idx: number) =>
      (progress?.bestStars ?? 0) > 0 ? idx + 1 : max,
    0,
  );
}

function getSummonPool(state: GameState, rarity: SummonRarity): MonsterId[] {
  const base = RARITY_POOLS[rarity];
  const highestCleared = getHighestClearedStage(state);
  if (highestCleared <= 0) return base;
  return base.filter(id => {
    const monster = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
    return !monster || (monster.unlockStage ?? 1) <= highestCleared;
  });
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
    if (!alreadyOwned) {
      ownedMonsters.push(defaultOwnedMonster(monsterId));
    } else {
      scComp = SC_COMP[rarityIdx];
      soulCrystals += scComp;
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
    results.push({ monsterId, rarity, rarityIdx, isNew: !alreadyOwned, scComp, ceilingHit });
  }

  const wisdomSoulCrystals = Math.max(0, getWisdomBonuses(state).summonBonusCrystal * count);
  soulCrystals += wisdomSoulCrystals;

  const updated = {
    ...state,
    gems,
    soulCrystals,
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
