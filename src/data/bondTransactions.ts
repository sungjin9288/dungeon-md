// ─── Bond transactions ────────────────────────────────────────────────────────
// Daily-limited care actions that raise GameState.monsterAffinity. Pure:
// returns new state; the detail panel shows what happened.

import { addXp, type OwnedMonster } from './barracks';
import { BOND_ACTIONS, BOND_MAX, bondThresholdsCrossed, clampBond, type BondActionId, type BondThreshold } from './bond';
import type { GameState } from './wisdom';

export interface BondDayLog {
  readonly date: string;
  readonly counts: Readonly<Partial<Record<BondActionId, number>>>;
}

export type BondFailureReason = 'not_owned' | 'bond_maxed' | 'daily_limit' | 'insufficient_gold' | 'insufficient_materials';

export type BondActionResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly action: BondActionId;
      readonly affinityBefore: number;
      readonly affinityAfter: number;
      readonly crossed: readonly BondThreshold[];
      readonly remainingToday: number;
      readonly spentMaterials: Readonly<Record<string, number>>;
      readonly spentGold: number;
      readonly levelled: boolean;
    }
  | { readonly ok: false; readonly state: GameState; readonly reason: BondFailureReason };

export function getBondAffinity(state: Readonly<Pick<GameState, 'monsterAffinity'>>, monsterId: string): number {
  return clampBond(state.monsterAffinity?.[monsterId] ?? 0);
}

/** Today's use counts for a guardian; a log from another day reads as empty. */
export function getBondCountsToday(
  state: Readonly<Pick<GameState, 'bondDaily'>>,
  monsterId: string,
  today: string,
): Readonly<Partial<Record<BondActionId, number>>> {
  const log = state.bondDaily?.[monsterId];
  return log && log.date === today ? log.counts : {};
}

export function bondUsesLeft(state: Readonly<Pick<GameState, 'bondDaily'>>, monsterId: string, action: BondActionId, today: string): number {
  return Math.max(0, BOND_ACTIONS[action].dailyLimit - (getBondCountsToday(state, monsterId, today)[action] ?? 0));
}

function payableMaterials(state: Readonly<Pick<GameState, 'materials'>>, action: BondActionId): Readonly<Record<string, number>> | null {
  const options = BOND_ACTIONS[action].materialsAny;
  if (options.length === 0) return {};
  return options.find(cost => Object.entries(cost).every(([id, qty]) => (state.materials?.[id] ?? 0) >= qty)) ?? null;
}

export function canPerformBondAction(
  state: GameState,
  monsterId: string,
  action: BondActionId,
  today: string,
): { readonly ok: boolean; readonly reason?: BondFailureReason; readonly remaining: number; readonly materials: Readonly<Record<string, number>> | null } {
  const remaining = bondUsesLeft(state, monsterId, action, today);
  const materials = payableMaterials(state, action);
  if (!(state.ownedMonsters ?? []).some(monster => monster.id === monsterId)) return { ok: false, reason: 'not_owned', remaining, materials };
  if (getBondAffinity(state, monsterId) >= BOND_MAX) return { ok: false, reason: 'bond_maxed', remaining, materials };
  if (remaining <= 0) return { ok: false, reason: 'daily_limit', remaining, materials };
  if ((state.homeGold ?? 0) < BOND_ACTIONS[action].gold) return { ok: false, reason: 'insufficient_gold', remaining, materials };
  if (materials === null) return { ok: false, reason: 'insufficient_materials', remaining, materials };
  return { ok: true, remaining, materials };
}

export function performBondAction(state: GameState, monsterId: string, action: BondActionId, today: string): BondActionResult {
  const check = canPerformBondAction(state, monsterId, action, today);
  if (!check.ok || check.materials === null) return { ok: false, state, reason: check.reason ?? 'not_owned' };
  const def = BOND_ACTIONS[action];

  const affinityBefore = getBondAffinity(state, monsterId);
  const affinityAfter = clampBond(affinityBefore + def.gain);
  const crossed = bondThresholdsCrossed(affinityBefore, affinityAfter);

  const materials = { ...(state.materials ?? {}) };
  for (const [id, qty] of Object.entries(check.materials)) materials[id] = Math.max(0, (materials[id] ?? 0) - qty);

  const counts = { ...getBondCountsToday(state, monsterId, today) };
  counts[action] = (counts[action] ?? 0) + 1;
  const bondDaily: Record<string, BondDayLog> = { ...(state.bondDaily ?? {}), [monsterId]: { date: today, counts } };

  let levelled = false;
  const ownedMonsters = (state.ownedMonsters ?? []).map((monster): OwnedMonster => {
    if (monster.id !== monsterId || def.xp <= 0) return monster;
    const copy = { ...monster, spentSkills: { ...monster.spentSkills }, equippedSkills: [...monster.equippedSkills] };
    levelled = addXp(copy, def.xp).levelled;
    return copy;
  });

  let soulCrystals = state.soulCrystals ?? 0;
  let gems = state.gems ?? 0;
  for (const threshold of crossed) {
    soulCrystals += threshold.reward?.soulCrystals ?? 0;
    gems += threshold.reward?.gems ?? 0;
  }

  return {
    ok: true,
    action,
    affinityBefore,
    affinityAfter,
    crossed,
    remainingToday: check.remaining - 1,
    spentMaterials: check.materials,
    spentGold: def.gold,
    levelled,
    state: {
      ...state,
      homeGold: (state.homeGold ?? 0) - def.gold,
      materials,
      ownedMonsters,
      soulCrystals,
      gems,
      monsterAffinity: { ...(state.monsterAffinity ?? {}), [monsterId]: affinityAfter },
      bondDaily,
    },
  };
}
