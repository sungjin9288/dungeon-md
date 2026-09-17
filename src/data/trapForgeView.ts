// ─── Trap forge view ──────────────────────────────────────────────────────────
// Read-only projection of every trap for the forge's '함정' tab: what the
// player holds, what the next craft/enhance needs, and why a button is off.
// Pure; the tab only renders these rows.

import { MATERIAL_DEFS } from './fusion';
import { canCraftTrap, getTrapMastery, getTrapStock, trapInputsNeeded, type TrapTransactionFailureReason } from './trapTransactions';
import { AFFLICTION_DEFS, getTrapDef, TRAP_DEFS, TRAP_MASTERY_MAX, trapMasteryCost, trapMasteryMult, type TrapDef } from './traps';
import type { GameState } from './wisdom';

export interface TrapNeedLine {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly have: number;
  readonly need: number;
}

export interface TrapActionState {
  readonly ok: boolean;
  readonly reason: TrapTransactionFailureReason | null;
  /** Short button/status label in Korean. */
  readonly label: string;
}

export interface TrapForgeRow {
  readonly def: TrapDef;
  readonly stock: number;
  readonly mastery: number;
  readonly masteryMult: number;
  readonly afflictionLabel: string;
  readonly materials: readonly TrapNeedLine[];
  readonly inputTraps: readonly TrapNeedLine[];
  readonly craft: TrapActionState;
  readonly enhanceMaterials: readonly TrapNeedLine[];
  readonly enhance: TrapActionState;
}

const CRAFT_LABEL: Record<TrapTransactionFailureReason, string> = {
  unknown_trap:             '알 수 없음',
  locked:                   '잠김',
  insufficient_materials:   '재료 부족',
  insufficient_input_traps: '하위 함정 부족',
  mastery_at_max:           '최대',
};

function materialLines(state: GameState, cost: Readonly<Record<string, number>>): TrapNeedLine[] {
  return Object.entries(cost).map(([id, need]) => ({
    id,
    name: MATERIAL_DEFS[id]?.name ?? id,
    emoji: MATERIAL_DEFS[id]?.emoji ?? '▪',
    have: state.materials?.[id] ?? 0,
    need,
  }));
}

function inputTrapLines(state: GameState, def: TrapDef): TrapNeedLine[] {
  return Object.entries(trapInputsNeeded(def)).map(([id, need]) => {
    const input = getTrapDef(id);
    return { id, name: input?.name ?? id, emoji: input?.emoji ?? '▪', have: getTrapStock(state, id), need };
  });
}

export function buildTrapForgeRow(state: GameState, def: TrapDef): TrapForgeRow {
  const mastery = getTrapMastery(state, def.id);
  const craftCheck = canCraftTrap(state, def.id);
  const craft: TrapActionState = craftCheck.ok
    ? { ok: true, reason: null, label: '제작' }
    : { ok: false, reason: craftCheck.reason ?? 'unknown_trap',
        label: craftCheck.reason === 'locked' ? `Lv.${def.unlockLv} 잠김` : CRAFT_LABEL[craftCheck.reason ?? 'unknown_trap'] };

  const atMax = mastery >= TRAP_MASTERY_MAX;
  const enhanceMaterials = atMax ? [] : materialLines(state, trapMasteryCost(def, mastery));
  const enhanceShort = enhanceMaterials.some(line => line.have < line.need);
  const enhance: TrapActionState = atMax
    ? { ok: false, reason: 'mastery_at_max', label: '숙련 최대' }
    : enhanceShort
      ? { ok: false, reason: 'insufficient_materials', label: '재료 부족' }
      : { ok: true, reason: null, label: `강화 +${mastery + 1}` };

  return {
    def,
    stock: getTrapStock(state, def.id),
    mastery,
    masteryMult: trapMasteryMult(mastery),
    afflictionLabel: def.afflictions.map(id => AFFLICTION_DEFS[id].name).join(' + '),
    materials: materialLines(state, def.recipe.materials),
    inputTraps: inputTrapLines(state, def),
    craft,
    enhanceMaterials,
    enhance,
  };
}

/** Rows in definition order (tier 1 → 3); unlocked traps first within the list is not needed — the order is the recipe tree. */
export function buildTrapForgeRows(state: GameState): readonly TrapForgeRow[] {
  return TRAP_DEFS.map(def => buildTrapForgeRow(state, def));
}

export function summarizeTrapForge(state: GameState): { readonly stockTotal: number; readonly masteryTotal: number; readonly craftableCount: number } {
  const rows = buildTrapForgeRows(state);
  return {
    stockTotal: rows.reduce((sum, row) => sum + row.stock, 0),
    masteryTotal: rows.reduce((sum, row) => sum + row.mastery, 0),
    craftableCount: rows.filter(row => row.craft.ok).length,
  };
}
