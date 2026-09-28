// ─── Forecast transactions ────────────────────────────────────────────────────
// The day's cards as state changes: a day begins (cards issued, the name
// settles), a card is taken, a card's battle is settled. Every function
// returns new state; the scene decides what to show and where to go.
// Contract: docs/design/PHASE2_NOTORIETY_FORECAST.md §2.

import { getThisWeekMonday } from './daily';
import { dayIndexOf } from './daily';
import { forecastIssueInputFor, isBattleCard, issueForecastCards, type ForecastCard, type ForecastIssueInput } from './forecast';
import { applyBattleReturnSettlement, type BattleReturnResult, type BattleReturnSettlement } from './invasionTransactions';
import {
  applyNotorietyDefeat,
  applyNotorietyGain,
  applyNotorietyIdleDecay,
  getNotorietyBand,
  getNotorietyTier,
  NOTORIETY_GAIN,
  settleNotorietyWeek,
} from './notoriety';
import type { GameState } from './wisdom';

/** Facility outputs the merchant buys; other materials are crafting stock and stay. */
export const MERCHANT_BUYS: Readonly<Record<string, number>> = { common_ore: 6, herb: 6, old_cloth: 8, magic_dust: 12 };
export const MERCHANT_BASE_GOLD = 50;

/**
 * What the merchant card pays RIGHT NOW, for this save.
 *
 * `merchantCard` used to advertise a flat `150 × lootMult` while this path paid
 * `(50 + 재료값) × lootMult`, computed independently — the card's own
 * `reward.gold` was never read by any payout. With an empty material stock (the
 * normal state right after crafting) the card showed exactly 3× what it paid:
 * 150 against 50 at tier 1, 675 against 225 at tier 10. The tray now renders
 * this function, so the number on the card is the number the player receives.
 */
export function merchantPayout(
  state: Readonly<Pick<GameState, 'materials'>>,
  bandTier: number,
): { readonly gold: number; readonly soldMaterials: Readonly<Record<string, number>> } {
  const band = getNotorietyBand(bandTier);
  const sold: Record<string, number> = {};
  let gold = MERCHANT_BASE_GOLD;
  for (const [id, price] of Object.entries(MERCHANT_BUYS)) {
    const qty = state.materials?.[id] ?? 0;
    if (qty <= 0) continue;
    gold += qty * price;
    sold[id] = qty;
  }
  return { gold: Math.round(gold * band.lootMult), soldMaterials: sold };
}

export type ForecastFailureReason = 'card_not_found' | 'card_already_taken' | 'card_not_battle' | 'card_not_taken';

export type ForecastTakeResult =
  | { readonly ok: true; readonly state: GameState; readonly card: ForecastCard; readonly goldEarned: number }
  | { readonly ok: false; readonly state: GameState; readonly reason: ForecastFailureReason };

export interface ForecastDayStart {
  readonly state: GameState;
  readonly changed: boolean;
  readonly issued: boolean;
  readonly weeklyGems: number;
  readonly daysAway: number;
}

export interface ForecastSettlement {
  readonly state: GameState;
  readonly changed: boolean;
  readonly card: ForecastCard | null;
  readonly notorietyDelta: number;
  readonly battle: BattleReturnSettlement;
}

function findCard(state: GameState, cardId: string): ForecastCard | undefined {
  return (state.forecast?.cards ?? []).find(card => card.id === cardId);
}

export function isForecastCardTaken(state: Readonly<Pick<GameState, 'forecast'>>, cardId: string): boolean {
  return (state.forecast?.taken ?? []).includes(cardId);
}

/** All of today's cards have been taken — the day's decisions are spent. */
export function isForecastExhausted(state: Readonly<Pick<GameState, 'forecast'>>, today: string): boolean {
  const forecast = state.forecast;
  if (!forecast || forecast.date !== today || forecast.cards.length === 0) return false;
  return forecast.cards.every(card => forecast.taken.includes(card.id));
}

/**
 * First visit of a day: erode the name for long absences, pay the weekly
 * settlement, and issue today's three cards. Idempotent within a day.
 * `issueInput` lets tests pin the daily/weekly pools; production passes none.
 */
export function beginForecastDay(
  state: GameState,
  today: string,
  issueInput?: (tier: number) => ForecastIssueInput,
): ForecastDayStart {
  const previous = state.forecast?.date ?? '';
  const daysAway = previous ? Math.max(0, dayIndexOf(today) - dayIndexOf(previous)) : 0;

  let next = daysAway > 0 ? applyNotorietyIdleDecay(state, daysAway) : state;
  const week = settleNotorietyWeek(next, getThisWeekMonday());
  next = week.state;

  const issued = previous !== today;
  if (issued) {
    const tier = getNotorietyTier(next);
    const cards = issueForecastCards(issueInput ? issueInput(tier) : forecastIssueInputFor(today, tier));
    next = { ...next, forecast: { date: today, cards, taken: [] } };
  }
  return { state: next, changed: next !== state, issued, weeklyGems: week.gems, daysAway };
}

function markTaken(state: GameState, cardId: string): GameState {
  return { ...state, forecast: { ...state.forecast, taken: [...state.forecast.taken, cardId] } };
}

/**
 * Take a card. Battle cards are only marked — the caller launches the battle
 * with the card's waves and settles through `settleForecastBattle`. The
 * merchant resolves on the spot: facility outputs are sold at the band's
 * prices and the card is spent.
 */
export function takeForecastCard(state: GameState, cardId: string): ForecastTakeResult {
  const card = findCard(state, cardId);
  if (!card) return { ok: false, state, reason: 'card_not_found' };
  if (isForecastCardTaken(state, cardId)) return { ok: false, state, reason: 'card_already_taken' };

  if (card.kind === 'merchant') {
    const payout = merchantPayout(state, card.bandTier);
    const materials = { ...(state.materials ?? {}) };
    for (const id of Object.keys(payout.soldMaterials)) delete materials[id];
    const goldEarned = payout.gold;
    const next = markTaken({
      ...state,
      materials,
      homeGold: (state.homeGold ?? 0) + goldEarned,
      totalGoldEarned: (state.totalGoldEarned ?? 0) + goldEarned,
    }, cardId);
    return { ok: true, state: next, card, goldEarned };
  }

  if (!isBattleCard(card)) return { ok: false, state, reason: 'card_not_battle' };
  return { ok: true, state: markTaken(state, cardId), card, goldEarned: 0 };
}

/**
 * A card's battle came back. Composes the ordinary battle settlement (loot,
 * DM XP, quest ticks) with the card's own reward and the name's movement.
 * Daily-rule and weekly-boss cards launch with `dailyMode` / `weeklyBossMode`
 * in the registry, so the battle scene already paid those modes' rewards at
 * clear time (StageClearFlow → applyClearRewards); this only adds the name.
 */
export function settleForecastBattle(
  state: GameState,
  cardId: string,
  result: BattleReturnResult,
  options: { readonly flawless?: boolean; readonly now?: number } = {},
): ForecastSettlement {
  const battle = applyBattleReturnSettlement(state, result, { now: options.now });
  const card = findCard(state, cardId);
  if (!card || !isForecastCardTaken(state, cardId)) {
    return { state: battle.state, changed: battle.changed, card: null, notorietyDelta: 0, battle };
  }

  let next = battle.state;
  let notorietyDelta = 0;
  if (result.won) {
    const gain = Math.round(card.reward.notoriety * (options.flawless ? NOTORIETY_GAIN.flawlessMult : 1));
    next = applyNotorietyGain(next, gain);
    notorietyDelta = gain;

    const materials = { ...(next.materials ?? {}) };
    for (const [id, qty] of Object.entries(card.reward.materials ?? {})) materials[id] = (materials[id] ?? 0) + qty;
    next = {
      ...next,
      homeGold:        (next.homeGold ?? 0) + (card.reward.gold ?? 0),
      totalGoldEarned: (next.totalGoldEarned ?? 0) + (card.reward.gold ?? 0),
      gems:            (next.gems ?? 0) + (card.reward.gems ?? 0),
      soulCrystals:    (next.soulCrystals ?? 0) + (card.reward.soulCrystals ?? 0),
      materials,
    };
  } else if (card.kind !== 'weekly_boss') {
    // The weekly boss is a stretch challenge: losing it costs no name.
    const before = next.notoriety ?? 0;
    next = applyNotorietyDefeat(next);
    notorietyDelta = (next.notoriety ?? 0) - before;
  }

  return { state: next, changed: true, card, notorietyDelta, battle };
}
