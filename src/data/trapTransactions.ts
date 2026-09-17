// ─── Trap transactions ────────────────────────────────────────────────────────
// Crafting puts a trap into stock; fusing consumes two lower-tier traps from
// stock; mastery raises a trap type's effect. Installing draws from stock
// (roomSlotTransactions). Pure: returns new state.

import {
  getTrapDef,
  isTrapRecipeFusion,
  TRAP_MASTERY_MAX,
  trapMasteryCost,
  type TrapDef,
} from './traps';
import type { GameState } from './wisdom';

export type TrapTransactionFailureReason =
  | 'unknown_trap'
  | 'locked'
  | 'insufficient_materials'
  | 'insufficient_input_traps'
  | 'mastery_at_max';

export type TrapTransactionResult =
  | { readonly ok: true; readonly state: GameState; readonly trap: TrapDef; readonly consumedMaterials: Readonly<Record<string, number>>; readonly consumedTraps: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly state: GameState; readonly reason: TrapTransactionFailureReason };

export function getTrapStock(state: Readonly<Pick<GameState, 'trapStock'>>, trapId: string): number {
  return state.trapStock?.[trapId] ?? 0;
}

export function getTrapMastery(state: Readonly<Pick<GameState, 'trapMastery'>>, trapId: string): number {
  return state.trapMastery?.[trapId] ?? 0;
}

function hasMaterials(state: GameState, cost: Readonly<Record<string, number>>): boolean {
  return Object.entries(cost).every(([id, qty]) => (state.materials?.[id] ?? 0) >= qty);
}

function spendMaterials(state: GameState, cost: Readonly<Record<string, number>>): Record<string, number> {
  const materials = { ...(state.materials ?? {}) };
  for (const [id, qty] of Object.entries(cost)) materials[id] = Math.max(0, (materials[id] ?? 0) - qty);
  return materials;
}

export function trapInputsNeeded(def: TrapDef): Readonly<Record<string, number>> {
  if (!isTrapRecipeFusion(def.recipe)) return {};
  const needed: Record<string, number> = {};
  for (const input of def.recipe.traps) needed[input] = (needed[input] ?? 0) + 1;
  return needed;
}

export function canCraftTrap(state: GameState, trapId: string): { readonly ok: boolean; readonly reason?: TrapTransactionFailureReason } {
  const def = getTrapDef(trapId);
  if (!def) return { ok: false, reason: 'unknown_trap' };
  if ((state.dmLevel ?? 1) < def.unlockLv) return { ok: false, reason: 'locked' };
  if (!hasMaterials(state, def.recipe.materials)) return { ok: false, reason: 'insufficient_materials' };
  for (const [input, qty] of Object.entries(trapInputsNeeded(def))) {
    if (getTrapStock(state, input) < qty) return { ok: false, reason: 'insufficient_input_traps' };
  }
  return { ok: true };
}

/** Craft one trap into stock, consuming its materials and (tier 2–3) its two input traps. */
export function craftTrap(state: GameState, trapId: string): TrapTransactionResult {
  const def = getTrapDef(trapId);
  if (!def) return { ok: false, state, reason: 'unknown_trap' };
  const check = canCraftTrap(state, trapId);
  if (!check.ok) return { ok: false, state, reason: check.reason ?? 'unknown_trap' };

  const consumedTraps = trapInputsNeeded(def);
  const trapStock = { ...(state.trapStock ?? {}) };
  for (const [input, qty] of Object.entries(consumedTraps)) trapStock[input] = getTrapStock(state, input) - qty;
  trapStock[trapId] = getTrapStock(state, trapId) + 1;

  return {
    ok: true,
    trap: def,
    consumedMaterials: def.recipe.materials,
    consumedTraps,
    state: { ...state, materials: spendMaterials(state, def.recipe.materials), trapStock },
  };
}

/** Raise a trap type's mastery by one level for its recipe materials, scaled by the level. */
export function enhanceTrap(state: GameState, trapId: string): TrapTransactionResult {
  const def = getTrapDef(trapId);
  if (!def) return { ok: false, state, reason: 'unknown_trap' };
  const level = getTrapMastery(state, trapId);
  if (level >= TRAP_MASTERY_MAX) return { ok: false, state, reason: 'mastery_at_max' };
  const cost = trapMasteryCost(def, level);
  if (!hasMaterials(state, cost)) return { ok: false, state, reason: 'insufficient_materials' };
  return {
    ok: true,
    trap: def,
    consumedMaterials: cost,
    consumedTraps: {},
    state: {
      ...state,
      materials: spendMaterials(state, cost),
      trapMastery: { ...(state.trapMastery ?? {}), [trapId]: level + 1 },
    },
  };
}
