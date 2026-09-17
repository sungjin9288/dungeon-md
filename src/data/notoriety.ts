// ─── Notoriety (명성 / 악명) ────────────────────────────────────────────────────
// The dungeon is a business whose customers are invaders. Holding them off
// spreads the word; a louder name draws richer — and stronger — expeditions.
// The tier is the player's *choice*: points accrue on their own, but the sign
// only goes up when the player raises it, so a new player is never ambushed by
// a band their home cannot hold. See docs/design/PHASE2_NOTORIETY_FORECAST.md.
//
// Pure: no scene, save or RNG access. Transactions return new state.

import { INVADER_DEFS, type InvaderType } from './invaders';
import type { GameState } from './wisdom';

export const NOTORIETY_MIN_TIER = 1;
export const NOTORIETY_MAX_TIER = 10;

/** Points needed to be *allowed* to raise tier n → n+1 (index n-1). */
export const NOTORIETY_TIER_THRESHOLDS: readonly number[] = [100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500];

/** Gems paid each Monday for the tier held through the previous week. */
export const NOTORIETY_WEEKLY_GEMS_PER_TIER = 30;
/**
 * Flat weekly base so a fresh dungeon's free gem inflow (attendance 110 +
 * ~0.9 treasure cards) clears the 300–450/week band from tier 2 instead of
 * tier 5 (gemInflow.ts is the guard). GAME_DESIGN_BENCHMARK.md §4.4 ①.
 */
export const NOTORIETY_WEEKLY_GEMS_BASE = 100;

export const NOTORIETY_GAIN = {
  raid: 10,
  elite: 25,
  pilgrim: 15,
  treasure: 25,
  daily_rule: 15,
  weekly_boss: 40,
  /** Multiplier on a battle's gain when the dungeon took no damage. */
  flawlessMult: 1.5,
  /** Per campaign stage first-cleared, times its chapter. */
  stageClearPerChapter: 5,
} as const;

/** Share of current points lost on a defeat. */
export const NOTORIETY_DEFEAT_LOSS_PCT = 10;
/** Share of current points lost per day away once the grace period passes. */
export const NOTORIETY_IDLE_LOSS_PCT_PER_DAY = 5;
export const NOTORIETY_IDLE_GRACE_DAYS = 7;
/** Share of current points surrendered when the player lowers the sign. */
export const NOTORIETY_LOWER_TIER_LOSS_PCT = 20;

// ─── Bands ────────────────────────────────────────────────────────────────────

export interface NotorietyBand {
  readonly tier: number;
  /** Rank-and-file invaders a band-tier expedition is drawn from. */
  readonly pool: readonly InvaderType[];
  /** Boss-tier invaders an elite expedition of this tier closes with. */
  readonly bosses: readonly InvaderType[];
  /** Loot multiplier on gold and material rewards. */
  readonly lootMult: number;
  /** Dungeon HP a forecast battle of this tier starts with. */
  readonly dungeonHp: number;
}

// Pools are cumulative by sustained-DPS threshold (hp × speed / 640): tier 1
// holds what a starting board can kill, and each tier adds the next rung.
// Endless-only invaders (void, undying, raider, plague_rat, bone_archer) are
// never drawn here; phase bosses live only in `bosses`.
/** Invaders that only ever appear as another unit's summon; never drawn for a card. */
export const NOTORIETY_SUMMONED_ONLY: readonly InvaderType[] = ['ghost_add'];

const T1: InvaderType[] = ['peasant', 'soldier'];
const T2: InvaderType[] = [...T1, 'shaman', 'high_priest', 'scarecrow_mage', 'trap_breaker', 'shadow_ninja', 'holy_paladin', 'siege_soldier', 'berserker'];
const T3: InvaderType[] = [...T2, 'knight', 'venom_dancer', 'mercenary_captain'];
const T4: InvaderType[] = [...T3, 'iron_golem', 'fox_spirit', 'undying_knight'];
const T5: InvaderType[] = [...T4, 'void_assassin', 'swarm_spawn', 'mirror_knight'];
const T6: InvaderType[] = [...T5, 'void_assassin_elite', 'undying_warrior', 'void_invader', 'swarm_larva'];
const T7: InvaderType[] = [...T6, 'plague_herald', 'celestial_knight', 'void_colossus', 'divine_archer', 'celestial_crusader'];
const T8: InvaderType[] = [...T7, 'shadow_wraith', 'void_soldier', 'radiant_seraph'];
const T9: InvaderType[] = [...T8, 'titan_sentinel', 'heaven_general', 'sky_titan', 'primordial_guard'];
const T10: InvaderType[] = [...T9, 'abyss_berserker', 'abyss_reaver'];

export const NOTORIETY_BANDS: readonly NotorietyBand[] = [
  { tier: 1,  pool: T1,  bosses: ['knight'],                                                              lootMult: 1.0,  dungeonHp: 1500 },
  { tier: 2,  pool: T2,  bosses: ['knight'],                                                              lootMult: 1.15, dungeonHp: 1700 },
  { tier: 3,  pool: T3,  bosses: ['iron_golem'],                                                          lootMult: 1.3,  dungeonHp: 1900 },
  { tier: 4,  pool: T4,  bosses: ['fox_queen'],                                                           lootMult: 1.5,  dungeonHp: 2200 },
  { tier: 5,  pool: T5,  bosses: ['void_assassin_elite'],                                                 lootMult: 1.75, dungeonHp: 2500 },
  { tier: 6,  pool: T6,  bosses: ['dragon_king'],                                                         lootMult: 2.0,  dungeonHp: 2900 },
  { tier: 7,  pool: T7,  bosses: ['death_emissary'],                                                      lootMult: 2.4,  dungeonHp: 3300 },
  { tier: 8,  pool: T8,  bosses: ['titan_sentinel'],                                                      lootMult: 2.9,  dungeonHp: 3800 },
  { tier: 9,  pool: T9,  bosses: ['celestial_dragon'],                                                    lootMult: 3.5,  dungeonHp: 4400 },
  { tier: 10, pool: T10, bosses: ['eternal_emperor', 'three_god_destroyer', 'god_emperor', 'primordial_titan', 'void_sovereign'], lootMult: 4.5, dungeonHp: 5000 },
];

export function clampNotorietyTier(tier: number): number {
  return Math.min(NOTORIETY_MAX_TIER, Math.max(NOTORIETY_MIN_TIER, Math.round(tier || NOTORIETY_MIN_TIER)));
}

export function getNotorietyBand(tier: number): NotorietyBand {
  return NOTORIETY_BANDS[clampNotorietyTier(tier) - 1];
}

/** Sustained DPS needed to kill an invader inside its travel window — the band ladder's rung. */
export function invaderThreshold(type: InvaderType): number {
  const def = INVADER_DEFS[type];
  return def ? (def.hp * def.speed) / 640 : Infinity;
}

// ─── Points and tier ──────────────────────────────────────────────────────────

export function getNotorietyTier(state: Readonly<Pick<GameState, 'notorietyTier'>>): number {
  return clampNotorietyTier(state.notorietyTier ?? NOTORIETY_MIN_TIER);
}

/** Points the current tier needs before the sign may be raised; null at the top. */
export function nextNotorietyThreshold(state: Readonly<Pick<GameState, 'notorietyTier'>>): number | null {
  const tier = getNotorietyTier(state);
  return tier >= NOTORIETY_MAX_TIER ? null : NOTORIETY_TIER_THRESHOLDS[tier - 1];
}

export function canRaiseNotorietyTier(state: Readonly<Pick<GameState, 'notoriety' | 'notorietyTier'>>): boolean {
  const threshold = nextNotorietyThreshold(state);
  return threshold !== null && (state.notoriety ?? 0) >= threshold;
}

export function applyNotorietyGain(state: GameState, amount: number): GameState {
  const gain = Math.max(0, Math.round(amount));
  if (gain === 0) return state;
  return { ...state, notoriety: (state.notoriety ?? 0) + gain };
}

function applyNotorietyLossPct(state: GameState, pct: number): GameState {
  const current = state.notoriety ?? 0;
  const loss = Math.round(current * (pct / 100));
  if (loss <= 0) return state;
  return { ...state, notoriety: current - loss };
}

/** A lost forecast battle costs a slice of the name; the tier itself stays. */
export function applyNotorietyDefeat(state: GameState): GameState {
  return applyNotorietyLossPct(state, NOTORIETY_DEFEAT_LOSS_PCT);
}

/**
 * Days away past the grace period erode points, never the tier: a returning
 * player faces the band they chose, not a harder one, and keeps their sign.
 */
export function applyNotorietyIdleDecay(state: GameState, daysAway: number): GameState {
  const eroding = Math.max(0, Math.floor(daysAway) - NOTORIETY_IDLE_GRACE_DAYS);
  let next = state;
  for (let i = 0; i < eroding; i++) next = applyNotorietyLossPct(next, NOTORIETY_IDLE_LOSS_PCT_PER_DAY);
  return next;
}

export type NotorietyTierResult =
  | { readonly ok: true; readonly state: GameState; readonly tier: number }
  | { readonly ok: false; readonly state: GameState; readonly reason: 'threshold_not_met' | 'at_max_tier' | 'at_min_tier' };

/** The player raises the sign. Points are kept; only the audience changes. */
export function raiseNotorietyTier(state: GameState): NotorietyTierResult {
  const tier = getNotorietyTier(state);
  if (tier >= NOTORIETY_MAX_TIER) return { ok: false, state, reason: 'at_max_tier' };
  if (!canRaiseNotorietyTier(state)) return { ok: false, state, reason: 'threshold_not_met' };
  return { ok: true, state: { ...state, notorietyTier: tier + 1 }, tier: tier + 1 };
}

/** The player lowers the sign to breathe; a fifth of the name is surrendered. */
export function lowerNotorietyTier(state: GameState): NotorietyTierResult {
  const tier = getNotorietyTier(state);
  if (tier <= NOTORIETY_MIN_TIER) return { ok: false, state, reason: 'at_min_tier' };
  const eroded = applyNotorietyLossPct(state, NOTORIETY_LOWER_TIER_LOSS_PCT);
  return { ok: true, state: { ...eroded, notorietyTier: tier - 1 }, tier: tier - 1 };
}

// ─── Weekly settlement ────────────────────────────────────────────────────────

export interface NotorietyWeekSettlement {
  readonly state: GameState;
  readonly changed: boolean;
  readonly gems: number;
}

/**
 * First visit of a new week pays the base plus gems for the tier held. Idempotent per week
 * via `notorietyWeekStart`; the very first week only stamps the date.
 */
export function settleNotorietyWeek(state: GameState, weekStart: string): NotorietyWeekSettlement {
  if (state.notorietyWeekStart === weekStart) return { state, changed: false, gems: 0 };
  if (!state.notorietyWeekStart) {
    return { state: { ...state, notorietyWeekStart: weekStart }, changed: true, gems: 0 };
  }
  const gems = NOTORIETY_WEEKLY_GEMS_BASE + getNotorietyTier(state) * NOTORIETY_WEEKLY_GEMS_PER_TIER;
  return {
    state: { ...state, notorietyWeekStart: weekStart, gems: (state.gems ?? 0) + gems },
    changed: true,
    gems,
  };
}
