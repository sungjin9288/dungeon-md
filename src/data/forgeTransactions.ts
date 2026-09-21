import type { BlueprintDef } from './fusion';
import { getEquipmentStats } from './barracks';
import { getWisdomBonuses, type GameState } from './wisdom';

export type CraftedEquipment = GameState['craftedEquipment'][number];

export type ForgeTransactionFailureReason =
  | 'insufficient_materials'
  | 'invalid_equipment_index';

export type ForgeCraftResult =
  | {
      ok: true;
      state: GameState;
      equipment: CraftedEquipment;
      consumedMaterials: Record<string, number>;
      materialsBefore: Record<string, number>;
    }
  | { ok: false; state: GameState; reason: ForgeTransactionFailureReason };

export type ForgeDismantleResult =
  | {
      ok: true;
      state: GameState;
      equipment: CraftedEquipment;
      returnedMaterials: Record<string, number>;
    }
  | { ok: false; state: GameState; reason: ForgeTransactionFailureReason };

export function canCraftBlueprint(
  blueprint: BlueprintDef,
  materials: Record<string, number> = {},
): boolean {
  return Object.entries(blueprint.materials).every(
    ([id, qty]) => (materials[id] ?? 0) >= qty,
  );
}

export function getDismantleReturns(
  blueprint: BlueprintDef | undefined,
): Record<string, number> {
  if (!blueprint) return {};
  return Object.fromEntries(
    Object.entries(blueprint.materials)
      .map(([id, qty]) => [id, Math.floor(qty * 0.5)] as const)
      .filter(([, qty]) => qty > 0),
  );
}

function createCraftedEquipment(blueprint: BlueprintDef): CraftedEquipment {
  return {
    id: blueprint.resultId,
    name: blueprint.name,
    type: blueprint.type,
    rarity: blueprint.rarity,
    emoji: blueprint.resultEmoji,
    // Same table combat reads (barracks.getEquipmentStats); the blueprint's
    // own parallel `stats` field is gone — it advertised effects the equipment
    // did not deliver on 19 of 24 blueprints.
    stats: { ...getEquipmentStats(blueprint.resultId) } as Record<string, number>,
  };
}

export function applyCraftBlueprint(
  state: GameState,
  blueprint: BlueprintDef,
): ForgeCraftResult {
  const materialsBefore = { ...(state.materials ?? {}) };
  if (!canCraftBlueprint(blueprint, materialsBefore)) {
    return { ok: false, state, reason: 'insufficient_materials' };
  }

  const materials = { ...materialsBefore };
  for (const [id, qty] of Object.entries(blueprint.materials)) {
    materials[id] = Math.max(0, (materials[id] ?? 0) - qty);
  }

  const equipment = createCraftedEquipment(blueprint);
  const forgeCrystalBonus = getWisdomBonuses(state).forgeBonusCrystal;
  const ownedEquipment = state.ownedEquipment ?? [];
  const nextOwnedEquipment = ownedEquipment.includes(equipment.id)
    ? ownedEquipment
    : [...ownedEquipment, equipment.id];

  return {
    ok: true,
    equipment,
    consumedMaterials: { ...blueprint.materials },
    materialsBefore,
    state: {
      ...state,
      materials,
      soulCrystals: state.soulCrystals + forgeCrystalBonus,
      ownedEquipment: nextOwnedEquipment,
      craftedEquipment: [...(state.craftedEquipment ?? []), equipment],
    },
  };
}

export function applyDismantleCraftedEquipment(
  state: GameState,
  equipmentIndex: number,
  blueprint: BlueprintDef | undefined,
): ForgeDismantleResult {
  const craftedEquipment = state.craftedEquipment ?? [];
  if (equipmentIndex < 0 || equipmentIndex >= craftedEquipment.length) {
    return { ok: false, state, reason: 'invalid_equipment_index' };
  }

  const equipment = craftedEquipment[equipmentIndex];
  const returnedMaterials = getDismantleReturns(blueprint);
  const nextCraftedEquipment = craftedEquipment.filter((_, i) => i !== equipmentIndex);
  const equipmentStillCrafted = nextCraftedEquipment.some(eq => eq.id === equipment.id);
  const materials = { ...(state.materials ?? {}) };
  for (const [id, qty] of Object.entries(returnedMaterials)) {
    materials[id] = (materials[id] ?? 0) + qty;
  }
  const ownedEquipment = equipmentStillCrafted
    ? (state.ownedEquipment ?? [])
    : (state.ownedEquipment ?? []).filter(id => id !== equipment.id);
  const ownedMonsters = equipmentStillCrafted
    ? state.ownedMonsters
    : state.ownedMonsters?.map(monster =>
        monster.equipment === equipment.id
          ? { ...monster, equipment: null }
          : monster,
      );

  return {
    ok: true,
    equipment,
    returnedMaterials,
    state: {
      ...state,
      materials,
      ownedEquipment,
      ownedMonsters,
      craftedEquipment: nextCraftedEquipment,
    },
  };
}
