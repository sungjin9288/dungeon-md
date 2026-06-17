/**
 * Unit tests for decorationTransactions — acquire / place / unplace.
 * Pure GameState transitions (no Phaser).
 */

import { describe, it, expect } from 'vitest';
import { acquireDecoration, placeDecoration, unplaceDecoration } from './decorationTransactions';
import { DECORATION_DEFS, decorationSlots } from './decorations';
import { loadGameState, type GameState } from './wisdom';

function makeGs(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

// A gold-cost and a craft-cost decoration, resolved from the real defs.
const GOLD_ID = 'golden_pot';
const CRAFT_ID = 'war_banner';
const goldDef = DECORATION_DEFS[GOLD_ID];
const craftDef = DECORATION_DEFS[CRAFT_ID];
const goldCost = goldDef.cost.kind === 'gold' ? goldDef.cost.gold : 0;
const craftMats = craftDef.cost.kind === 'craft' ? craftDef.cost.materials : {};

describe('acquireDecoration', () => {
  it('rejects an unknown decoration', () => {
    const r = acquireDecoration(makeGs(), 'does_not_exist');
    expect(r).toEqual({ ok: false, reason: 'unknown' });
  });

  it('rejects one already owned', () => {
    const r = acquireDecoration(makeGs({ ownedDecorations: [GOLD_ID] }), GOLD_ID);
    expect(r).toEqual({ ok: false, reason: 'owned' });
  });

  it('buys a gold decoration: deducts gold, adds to owned', () => {
    const gs = makeGs({ homeGold: goldCost + 100, ownedDecorations: [] });
    const r = acquireDecoration(gs, GOLD_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.homeGold).toBe(100);
    expect(r.state.ownedDecorations).toContain(GOLD_ID);
    // immutability: original untouched
    expect(gs.homeGold).toBe(goldCost + 100);
    expect(gs.ownedDecorations).toEqual([]);
  });

  it('rejects a gold buy with insufficient gold', () => {
    const r = acquireDecoration(makeGs({ homeGold: goldCost - 1, ownedDecorations: [] }), GOLD_ID);
    expect(r).toEqual({ ok: false, reason: 'no_gold' });
  });

  it('crafts a decoration: consumes materials, adds to owned', () => {
    const materials: Record<string, number> = {};
    for (const [id, qty] of Object.entries(craftMats)) materials[id] = qty + 2;
    const gs = makeGs({ materials, ownedDecorations: [] });
    const r = acquireDecoration(gs, CRAFT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const [id, qty] of Object.entries(craftMats)) {
      expect(r.state.materials[id]).toBe(2);
      expect(gs.materials?.[id]).toBe(qty + 2); // original untouched
    }
    expect(r.state.ownedDecorations).toContain(CRAFT_ID);
  });

  it('rejects a craft with insufficient materials', () => {
    const r = acquireDecoration(makeGs({ materials: {}, ownedDecorations: [] }), CRAFT_ID);
    expect(r).toEqual({ ok: false, reason: 'no_materials' });
  });
});

describe('placeDecoration', () => {
  it('rejects unknown / not-owned / already-placed', () => {
    expect(placeDecoration(makeGs(), 'nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(placeDecoration(makeGs({ ownedDecorations: [] }), GOLD_ID))
      .toEqual({ ok: false, reason: 'not_owned' });
    expect(placeDecoration(makeGs({ ownedDecorations: [GOLD_ID], placedDecorations: [GOLD_ID] }), GOLD_ID))
      .toEqual({ ok: false, reason: 'already' });
  });

  it('places an owned decoration', () => {
    const gs = makeGs({ ownedDecorations: [GOLD_ID], placedDecorations: [] });
    const r = placeDecoration(gs, GOLD_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.placedDecorations).toContain(GOLD_ID);
    expect(gs.placedDecorations).toEqual([]); // immutable
  });

  it('rejects when all decoration slots are full', () => {
    const slots = decorationSlots(0);
    const filler = Object.keys(DECORATION_DEFS).filter(id => id !== GOLD_ID).slice(0, slots);
    const gs = makeGs({ dmLevel: 0, ownedDecorations: [...filler, GOLD_ID], placedDecorations: filler });
    expect(placeDecoration(gs, GOLD_ID)).toEqual({ ok: false, reason: 'no_slots' });
  });
});

describe('unplaceDecoration', () => {
  it('removes a placed decoration', () => {
    const gs = makeGs({ placedDecorations: [GOLD_ID, CRAFT_ID] });
    const next = unplaceDecoration(gs, GOLD_ID);
    expect(next.placedDecorations).toEqual([CRAFT_ID]);
    expect(gs.placedDecorations).toEqual([GOLD_ID, CRAFT_ID]); // immutable
  });

  it('returns the same state when the decoration is not placed', () => {
    const gs = makeGs({ placedDecorations: [CRAFT_ID] });
    expect(unplaceDecoration(gs, GOLD_ID)).toBe(gs);
  });
});
