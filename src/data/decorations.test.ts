import { describe, it, expect } from 'vitest';
import type { GameState } from './wisdom';
import { MATERIAL_DEFS } from './fusion';
import {
  DECORATION_DEFS, SET_DEFS, SET_ORDER,
  decorationsInSet, activeSetTier, computeDecorationBonuses, decorationSlots, EMPTY_BONUSES,
} from './decorations';
import { acquireDecoration, placeDecoration, unplaceDecoration } from './decorationTransactions';

describe('decoration catalog integrity', () => {
  it('every decoration belongs to a defined set', () => {
    for (const def of Object.values(DECORATION_DEFS)) {
      expect(SET_DEFS[def.setId]).toBeDefined();
    }
  });

  it('craft costs reference real materials', () => {
    for (const def of Object.values(DECORATION_DEFS)) {
      if (def.cost.kind === 'craft') {
        for (const matId of Object.keys(def.cost.materials)) {
          expect(MATERIAL_DEFS[matId]).toBeDefined();
        }
      }
    }
  });

  it('each set has 3 pieces', () => {
    for (const setId of SET_ORDER) {
      expect(decorationsInSet(setId)).toHaveLength(3);
    }
  });
});

describe('activeSetTier', () => {
  it('unlocks tiers by placed count', () => {
    expect(activeSetTier('bounty', 1)).toBe(-1);
    expect(activeSetTier('bounty', 2)).toBe(0);
    expect(activeSetTier('bounty', 3)).toBe(1);
  });
});

describe('computeDecorationBonuses', () => {
  it('is empty with nothing placed', () => {
    expect(computeDecorationBonuses([])).toEqual(EMPTY_BONUSES);
    expect(computeDecorationBonuses(undefined)).toEqual(EMPTY_BONUSES);
  });

  it('applies the 2-piece bounty tier', () => {
    const b = computeDecorationBonuses(['golden_pot', 'bounty_totem']);
    expect(b.idleGoldPct).toBe(10);
    expect(b.idleProductionPct).toBe(0);
  });

  it('applies the full 3-piece bounty tier', () => {
    const b = computeDecorationBonuses(['golden_pot', 'bounty_totem', 'treasure_chest']);
    expect(b.idleGoldPct).toBe(25);
    expect(b.idleProductionPct).toBe(15);
  });

  it('sums bonuses across multiple sets', () => {
    const b = computeDecorationBonuses(['golden_pot', 'bounty_totem', 'war_banner', 'brazier']);
    expect(b.idleGoldPct).toBe(10);    // bounty 2-piece
    expect(b.dungeonHpPct).toBe(8);    // guardian 2-piece
  });

  it('ignores unknown ids', () => {
    expect(computeDecorationBonuses(['nope', 'golden_pot'])).toEqual(EMPTY_BONUSES);
  });
});

describe('decorationSlots', () => {
  it('grows with DM level, capped at 9', () => {
    expect(decorationSlots(1)).toBe(4);
    expect(decorationSlots(6)).toBe(6);
    expect(decorationSlots(99)).toBe(9);
  });
});

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 1000, dmLevel: 6, materials: {},
    ownedDecorations: [], placedDecorations: [],
    ...overrides,
  } as GameState;
}

describe('acquireDecoration', () => {
  it('buys a gold decoration immutably', () => {
    const before = makeState({ homeGold: 500 });
    const r = acquireDecoration(before, 'golden_pot');   // 300 gold
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.homeGold).toBe(200);
    expect(r.state.ownedDecorations).toContain('golden_pot');
    expect(before.homeGold).toBe(500);
    expect(before.ownedDecorations).toHaveLength(0);
  });

  it('crafts a material decoration, deducting materials', () => {
    const before = makeState({ materials: { old_cloth: 9, common_ore: 9 } });
    const r = acquireDecoration(before, 'war_banner');   // old_cloth 5 + common_ore 3
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.materials.old_cloth).toBe(4);
    expect(r.state.materials.common_ore).toBe(6);
    expect(r.state.ownedDecorations).toContain('war_banner');
  });

  it('rejects insufficient gold / materials / owned / unknown', () => {
    expect(acquireDecoration(makeState({ homeGold: 10 }), 'golden_pot')).toMatchObject({ ok: false, reason: 'no_gold' });
    expect(acquireDecoration(makeState({ materials: {} }), 'war_banner')).toMatchObject({ ok: false, reason: 'no_materials' });
    expect(acquireDecoration(makeState({ ownedDecorations: ['golden_pot'] }), 'golden_pot')).toMatchObject({ ok: false, reason: 'owned' });
    expect(acquireDecoration(makeState(), 'nope')).toMatchObject({ ok: false, reason: 'unknown' });
  });
});

describe('placeDecoration / unplaceDecoration', () => {
  it('places an owned decoration', () => {
    const before = makeState({ ownedDecorations: ['golden_pot'] });
    const r = placeDecoration(before, 'golden_pot');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.placedDecorations).toContain('golden_pot');
  });

  it('rejects placing unowned / already placed', () => {
    expect(placeDecoration(makeState(), 'golden_pot')).toMatchObject({ ok: false, reason: 'not_owned' });
    const placed = makeState({ ownedDecorations: ['golden_pot'], placedDecorations: ['golden_pot'] });
    expect(placeDecoration(placed, 'golden_pot')).toMatchObject({ ok: false, reason: 'already' });
  });

  it('rejects placing beyond the slot cap', () => {
    const owned = Object.keys(DECORATION_DEFS);
    const full = makeState({
      dmLevel: 1,                                  // 4 slots
      ownedDecorations: owned,
      placedDecorations: owned.slice(0, 4),
    });
    expect(placeDecoration(full, owned[4])).toMatchObject({ ok: false, reason: 'no_slots' });
  });

  it('unplaces immutably', () => {
    const before = makeState({ ownedDecorations: ['golden_pot'], placedDecorations: ['golden_pot'] });
    const after = unplaceDecoration(before, 'golden_pot');
    expect(after.placedDecorations).toHaveLength(0);
    expect(before.placedDecorations).toHaveLength(1);
  });
});
