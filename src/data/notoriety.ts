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
  /**
   * Who leads each wave (65% of its head count): this rung's and the previous rung's additions.
   * Drawing the lead from the cumulative pool made a tier-8 wave mostly tier-1 peasants, so
   * tiers 3–10 measured 81–100% dungeon HP against their reference home (2026-10-01), while
   * tier 1's lead could be a soldier and ran heavier than campaign stage 2 (7% HP, elite lost).
   */
  readonly lead: readonly InvaderType[];
  /**
   * 노련도 — 이 티어 토벌대 일반 무리(보스 호위 포함, 보스 제외)의 HP·심장부 피해 배율. 명성이 오를수록 노련한
   * 토벌대가 온다. 주력·인원만으로는 기준 홈이 티어 3·4·6~8을 100%로 막았다(심장부 피해 80~120 대 던전 HP 2,900+라
   * HP만 올려서는 새도 꿈쩍하지 않았다). 값은 잠정(2026-10-01): 판마다 새 세이브·새로 연 페이지 앞쪽 판의 실전 측정에서
   * 지지 않은 범위다(티어 1~8 최소 성장 홈 · 9~10 강한 로스터 홈). 결과가 절벽형이고 편차가 크며, 긴 대기열 뒤쪽 판은
   * 이유 미확인으로 무너졌다 — 정밀 보정은 그 원인 확인과 반복 주행 뒤에(DUNGEON_EXPANSION_DESIGN.md P5-l).
   */
  readonly veteranMult: number;
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

// Each rung's additions; the pools are their running union.
const R1: InvaderType[] = ['peasant', 'soldier'];
const R2: InvaderType[] = ['shaman', 'high_priest', 'scarecrow_mage', 'trap_breaker', 'shadow_ninja', 'holy_paladin', 'siege_soldier', 'berserker'];
const R3: InvaderType[] = ['knight', 'venom_dancer', 'mercenary_captain'];
const R4: InvaderType[] = ['iron_golem', 'fox_spirit', 'undying_knight'];
const R5: InvaderType[] = ['void_assassin', 'swarm_spawn', 'mirror_knight'];
const R6: InvaderType[] = ['void_assassin_elite', 'undying_warrior', 'void_invader', 'swarm_larva'];
const R7: InvaderType[] = ['plague_herald', 'celestial_knight', 'void_colossus', 'divine_archer', 'celestial_crusader'];
const R8: InvaderType[] = ['shadow_wraith', 'void_soldier', 'radiant_seraph'];
const R9: InvaderType[] = ['titan_sentinel', 'heaven_general', 'sky_titan', 'primordial_guard'];
const R10: InvaderType[] = ['abyss_berserker', 'abyss_reaver'];
const T1: InvaderType[] = [...R1];
const T2: InvaderType[] = [...T1, ...R2];
const T3: InvaderType[] = [...T2, ...R3];
const T4: InvaderType[] = [...T3, ...R4];
const T5: InvaderType[] = [...T4, ...R5];
const T6: InvaderType[] = [...T5, ...R6];
const T7: InvaderType[] = [...T6, ...R7];
const T8: InvaderType[] = [...T7, ...R8];
const T9: InvaderType[] = [...T8, ...R9];
const T10: InvaderType[] = [...T9, ...R10];

export const NOTORIETY_BANDS: readonly NotorietyBand[] = [
  // The 보스 ladder must not fall as the tier rises. It used to: tier 5 fielded
  // void_assassin_elite (350 hp, the same as tier 1's knight) after tier 4's
  // fox_queen (1,600), and tier 8 fielded titan_sentinel (1,500) after tier 7's
  // death_emissary (3,000). Measured over 300 seeds, the elite finale WAVE was
  // 53% lighter at tier 5 than tier 4 and 37% lighter at tier 8 than tier 7 —
  // so raising 명성, which the player does by explicit approval, made the elite
  // card EASIER at two rungs. notorietyBands.test.ts now guards monotonicity.
  { tier: 1,  pool: T1, lead: ['peasant'], veteranMult: 1.0,  bosses: ['knight'],                                                              lootMult: 1.0,  dungeonHp: 1500 },
  { tier: 2,  pool: T2, lead: T2, veteranMult: 1.0,  bosses: ['knight'],                                                              lootMult: 1.15, dungeonHp: 1700 },
  { tier: 3,  pool: T3, lead: [...R2, ...R3], veteranMult: 1.2,  bosses: ['iron_golem'],                                                          lootMult: 1.3,  dungeonHp: 1900 },
  { tier: 4,  pool: T4, lead: [...R3, ...R4], veteranMult: 1.1,  bosses: ['fox_queen'],                                                           lootMult: 1.5,  dungeonHp: 2200 },
  { tier: 5,  pool: T5, lead: [...R4, ...R5], veteranMult: 1.0,  bosses: ['abyss_reaver'],                                                         lootMult: 1.75, dungeonHp: 2500 },
  { tier: 6,  pool: T6, lead: [...R5, ...R6], veteranMult: 1.6,  bosses: ['dragon_king'],                                                         lootMult: 2.0,  dungeonHp: 2900 },
  { tier: 7,  pool: T7, lead: [...R6, ...R7], veteranMult: 1.6,  bosses: ['death_emissary'],                                                      lootMult: 2.4,  dungeonHp: 3300 },
  { tier: 8,  pool: T8, lead: [...R7, ...R8], veteranMult: 1.3,  bosses: ['celestial_dragon'],                                                    lootMult: 2.9,  dungeonHp: 3800 },
  { tier: 9,  pool: T9, lead: [...R8, ...R9], veteranMult: 2.0,  bosses: ['three_god_destroyer'],                                                 lootMult: 3.5,  dungeonHp: 4400 },
  { tier: 10, pool: T10, lead: [...R9, ...R10], veteranMult: 1.4, bosses: ['eternal_emperor', 'three_god_destroyer', 'god_emperor', 'primordial_titan', 'void_sovereign'], lootMult: 4.5, dungeonHp: 5000 },
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
