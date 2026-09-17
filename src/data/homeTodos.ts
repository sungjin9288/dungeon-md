// ─── Home todos ───────────────────────────────────────────────────────────────
// The systems a player can act on today that the single directive card has no
// room for: 교감 (free/affordable bond actions), 근무 (built facilities with no
// guardian on shift), 함정 융합 (a tier-2/3 trap that can be crafted now).
// Pure counts; the deck renders them as badges so nothing new competes with the
// directive. Design: GAME_DESIGN_BENCHMARK.md §4.1 ④ / §4.2 / §4.3 ②.

import { BOND_ACTION_ORDER, BOND_MAX } from './bond';
import { canPerformBondAction, getBondAffinity } from './bondTransactions';
import { FACILITY_ORDER } from './production';
import { buildTrapForgeRows } from './trapForgeView';
import type { GameState } from './wisdom';

export interface HomeTodos {
  /** Guardians with at least one bond action still available today. */
  readonly bondGuardians: number;
  /** Built production facilities with no guardian on shift. */
  readonly unstaffedFacilities: number;
  /** Tier-2/3 traps craftable right now (the fusion the player may not notice). */
  readonly trapFusions: number;
}

export function getHomeTodos(state: GameState, today: string): HomeTodos {
  const bondGuardians = (state.ownedMonsters ?? []).filter(monster => (
    getBondAffinity(state, monster.id) < BOND_MAX
    && BOND_ACTION_ORDER.some(action => canPerformBondAction(state, monster.id, action, today).ok)
  )).length;

  const unstaffedFacilities = FACILITY_ORDER.filter(id => (
    (state.productionFacilities?.[id] ?? 0) > 0 && !state.facilityStaff?.[id]
  )).length;

  const trapFusions = buildTrapForgeRows(state).filter(row => row.def.tier > 1 && row.craft.ok).length;

  return { bondGuardians, unstaffedFacilities, trapFusions };
}

export function hasHomeTodos(todos: HomeTodos): boolean {
  return todos.bondGuardians > 0 || todos.unstaffedFacilities > 0 || todos.trapFusions > 0;
}
