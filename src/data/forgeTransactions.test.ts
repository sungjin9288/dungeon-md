import { describe, expect, it } from 'vitest';
import { BLUEPRINT_DEFS } from './fusion';
import {
  applyCraftBlueprint,
  applyDismantleCraftedEquipment,
  canCraftBlueprint,
  getDismantleReturns,
  type CraftedEquipment,
} from './forgeTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    soulCrystals: 10,
    wisdomTree: {},
    materials: {},
    craftedEquipment: [],
    ...overrides,
  } as GameState;
}

describe('forgeTransactions — craft', () => {
  const bp = BLUEPRINT_DEFS.bp_dokkaebi_club;

  it('detects craftable blueprints from material quantities', () => {
    expect(canCraftBlueprint(bp, { dok_fragment: 3, iron_shard: 2 })).toBe(true);
    expect(canCraftBlueprint(bp, { dok_fragment: 2, iron_shard: 2 })).toBe(false);
    expect(canCraftBlueprint(bp, {})).toBe(false);
  });

  it('crafts equipment, consumes materials, and preserves input state', () => {
    const state = makeState({
      soulCrystals: 10,
      materials: { dok_fragment: 4, iron_shard: 3, herb: 1 },
    });

    const result = applyCraftBlueprint(state, bp);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).not.toBe(state);
    expect(result.state.materials).toEqual({ dok_fragment: 1, iron_shard: 1, herb: 1 });
    expect(result.state.craftedEquipment).toEqual([
      {
        id: bp.resultId,
        name: bp.name,
        type: bp.type,
        rarity: bp.rarity,
        emoji: bp.resultEmoji,
        stats: bp.stats,
      },
    ]);
    expect(result.state.ownedEquipment).toEqual([bp.resultId]);
    expect(result.equipment).toEqual(result.state.craftedEquipment[0]);
    expect(result.consumedMaterials).toEqual(bp.materials);
    expect(result.materialsBefore).toEqual({ dok_fragment: 4, iron_shard: 3, herb: 1 });
    expect(state.materials).toEqual({ dok_fragment: 4, iron_shard: 3, herb: 1 });
    expect(state.craftedEquipment).toEqual([]);
  });

  it('does not duplicate an already-owned crafted equipment id', () => {
    const state = makeState({
      ownedEquipment: [bp.resultId],
      materials: { dok_fragment: 3, iron_shard: 2 },
    });

    const result = applyCraftBlueprint(state, bp);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownedEquipment).toEqual([bp.resultId]);
  });

  it('adds forgeEnhancer wisdom crystal bonus on craft', () => {
    const state = makeState({
      soulCrystals: 10,
      wisdomTree: { forgeEnhancer: 2 },
      materials: { dok_fragment: 3, iron_shard: 2 },
    });

    const result = applyCraftBlueprint(state, bp);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.soulCrystals).toBe(16);
  });

  it('fails without changing state when materials are insufficient', () => {
    const state = makeState({ materials: { dok_fragment: 3, iron_shard: 1 } });

    const result = applyCraftBlueprint(state, bp);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_materials');
    expect(result.state).toBe(state);
    expect(state.materials).toEqual({ dok_fragment: 3, iron_shard: 1 });
  });
});

describe('forgeTransactions — dismantle', () => {
  const bp = BLUEPRINT_DEFS.bp_dokkaebi_club;
  const equipment: CraftedEquipment = {
    id: bp.resultId,
    name: bp.name,
    type: bp.type,
    rarity: bp.rarity,
    emoji: bp.resultEmoji,
    stats: { ...bp.stats },
  };

  it('calculates 50 percent material returns with floor rounding', () => {
    expect(getDismantleReturns(bp)).toEqual({ dok_fragment: 1, iron_shard: 1 });
    expect(getDismantleReturns(undefined)).toEqual({});
  });

  it('removes the selected crafted equipment and returns materials', () => {
    const other: CraftedEquipment = { ...equipment, id: 'eq_other', name: 'Other' };
    const state = makeState({
      materials: { dok_fragment: 4 },
      ownedEquipment: [equipment.id, other.id],
      craftedEquipment: [equipment, other],
    });

    const result = applyDismantleCraftedEquipment(state, 0, bp);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.materials).toEqual({ dok_fragment: 5, iron_shard: 1 });
    expect(result.state.craftedEquipment).toEqual([other]);
    expect(result.state.ownedEquipment).toEqual([other.id]);
    expect(result.equipment).toEqual(equipment);
    expect(result.returnedMaterials).toEqual({ dok_fragment: 1, iron_shard: 1 });
    expect(state.materials).toEqual({ dok_fragment: 4 });
    expect(state.craftedEquipment).toEqual([equipment, other]);
  });

  it('still removes equipment when no matching blueprint exists', () => {
    const state = makeState({ materials: {}, craftedEquipment: [equipment] });

    const result = applyDismantleCraftedEquipment(state, 0, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.returnedMaterials).toEqual({});
    expect(result.state.materials).toEqual({});
    expect(result.state.craftedEquipment).toEqual([]);
  });

  it('fails without changing state when the equipment index is invalid', () => {
    const state = makeState({ craftedEquipment: [equipment] });

    const result = applyDismantleCraftedEquipment(state, 3, bp);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_equipment_index');
    expect(result.state).toBe(state);
    expect(state.craftedEquipment).toEqual([equipment]);
  });
});
