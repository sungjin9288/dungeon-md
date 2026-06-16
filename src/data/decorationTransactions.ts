/**
 * GameState transactions for 던전 장식품 — acquire (buy/craft), place, unplace.
 * Immutable: every op returns a new GameState. Pure (no Phaser).
 */

import type { GameState } from './wisdom';
import { DECORATION_DEFS, decorationSlots } from './decorations';

export type AcquireResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'unknown' | 'owned' | 'no_gold' | 'no_materials' };

export type PlaceResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'unknown' | 'not_owned' | 'already' | 'no_slots' };

function hasMaterials(have: Record<string, number> | undefined, need: Record<string, number>): boolean {
  return Object.entries(need).every(([id, qty]) => (have?.[id] ?? 0) >= qty);
}

/** Buy (gold) or craft (materials) a decoration into ownedDecorations. */
export function acquireDecoration(state: Readonly<GameState>, id: string): AcquireResult {
  const def = DECORATION_DEFS[id];
  if (!def) return { ok: false, reason: 'unknown' };
  if ((state.ownedDecorations ?? []).includes(id)) return { ok: false, reason: 'owned' };

  if (def.cost.kind === 'gold') {
    if (state.homeGold < def.cost.gold) return { ok: false, reason: 'no_gold' };
    return {
      ok: true,
      state: {
        ...state,
        homeGold: state.homeGold - def.cost.gold,
        ownedDecorations: [...(state.ownedDecorations ?? []), id],
      },
    };
  }

  // craft
  if (!hasMaterials(state.materials, def.cost.materials)) return { ok: false, reason: 'no_materials' };
  const materials = { ...(state.materials ?? {}) };
  for (const [matId, qty] of Object.entries(def.cost.materials)) {
    materials[matId] = (materials[matId] ?? 0) - qty;
  }
  return {
    ok: true,
    state: {
      ...state,
      materials,
      ownedDecorations: [...(state.ownedDecorations ?? []), id],
    },
  };
}

/** Place an owned decoration (counts toward set bonuses), respecting slots. */
export function placeDecoration(state: Readonly<GameState>, id: string): PlaceResult {
  if (!DECORATION_DEFS[id]) return { ok: false, reason: 'unknown' };
  if (!(state.ownedDecorations ?? []).includes(id)) return { ok: false, reason: 'not_owned' };
  const placed = state.placedDecorations ?? [];
  if (placed.includes(id)) return { ok: false, reason: 'already' };
  if (placed.length >= decorationSlots(state.dmLevel)) return { ok: false, reason: 'no_slots' };
  return { ok: true, state: { ...state, placedDecorations: [...placed, id] } };
}

/** Remove a decoration from the active placement. */
export function unplaceDecoration(state: Readonly<GameState>, id: string): GameState {
  const placed = state.placedDecorations ?? [];
  if (!placed.includes(id)) return state as GameState;
  return { ...state, placedDecorations: placed.filter(d => d !== id) };
}
