import type { GameState } from './wisdom';

export type ShopTransactionFailureReason =
  | 'insufficient_gems'
  | 'insufficient_soul_crystals'
  | 'skin_not_owned';

export type ShopTransactionResult =
  | { ok: true; state: GameState; changed: boolean }
  | { ok: false; state: GameState; reason: ShopTransactionFailureReason };

function appendUnique(values: string[] | undefined, value: string, fallback: string[] = []): {
  values: string[];
  changed: boolean;
} {
  const base = values ?? fallback;
  if (base.includes(value)) return { values: base, changed: false };
  return { values: [...base, value], changed: true };
}

export function purchaseDailyEquipment(
  state: GameState,
  equipmentId: string,
  soulCrystalCost: number,
): ShopTransactionResult {
  const owned = appendUnique(state.ownedEquipment, equipmentId);
  if (!owned.changed) return { ok: true, state, changed: false };
  if (state.soulCrystals < soulCrystalCost) {
    return { ok: false, state, reason: 'insufficient_soul_crystals' };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      soulCrystals: state.soulCrystals - soulCrystalCost,
      ownedEquipment: owned.values,
    },
  };
}

export function purchaseDailySkill(
  state: GameState,
  skillId: string,
  soulCrystalCost: number,
): ShopTransactionResult {
  const owned = appendUnique(state.ownedActiveSkills, skillId);
  if (!owned.changed) return { ok: true, state, changed: false };
  if (state.soulCrystals < soulCrystalCost) {
    return { ok: false, state, reason: 'insufficient_soul_crystals' };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      soulCrystals: state.soulCrystals - soulCrystalCost,
      ownedActiveSkills: owned.values,
    },
  };
}

export function equipTheme(state: GameState, themeId: string): ShopTransactionResult {
  const equippedTheme = state.equippedTheme ?? 'cave';
  if (equippedTheme === themeId) return { ok: true, state, changed: false };
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      equippedTheme: themeId,
    },
  };
}

export function unequipTheme(state: GameState): ShopTransactionResult {
  return equipTheme(state, 'cave');
}

export function purchaseAndEquipTheme(
  state: GameState,
  themeId: string,
  gemCost: number,
): ShopTransactionResult {
  const owned = appendUnique(state.ownedThemes, themeId, ['cave']);
  const alreadyEquipped = (state.equippedTheme ?? 'cave') === themeId;
  if (!owned.changed && alreadyEquipped) return { ok: true, state, changed: false };
  if (owned.changed && (state.gems ?? 0) < gemCost) {
    return { ok: false, state, reason: 'insufficient_gems' };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      gems: owned.changed ? (state.gems ?? 0) - gemCost : state.gems,
      ownedThemes: owned.values,
      equippedTheme: themeId,
    },
  };
}

function removeRecordKey<T>(
  record: Record<string, T> | undefined,
  key: string,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([recordKey]) => recordKey !== key),
  );
}

export function purchaseSkin(
  state: GameState,
  monsterId: string,
  skinId: string,
  gemCost: number,
): ShopTransactionResult {
  const ownedForMonster = state.ownedSkins?.[monsterId] ?? [];
  const owned = appendUnique(ownedForMonster, skinId);
  if (!owned.changed) return { ok: true, state, changed: false };
  if ((state.gems ?? 0) < gemCost) {
    return { ok: false, state, reason: 'insufficient_gems' };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      gems: (state.gems ?? 0) - gemCost,
      ownedSkins: {
        ...(state.ownedSkins ?? {}),
        [monsterId]: owned.values,
      },
    },
  };
}

export function equipSkin(
  state: GameState,
  monsterId: string,
  skinId: string,
): ShopTransactionResult {
  const ownedForMonster = state.ownedSkins?.[monsterId] ?? [];
  if (!ownedForMonster.includes(skinId)) {
    return { ok: false, state, reason: 'skin_not_owned' };
  }
  if (state.equippedSkins?.[monsterId] === skinId) {
    return { ok: true, state, changed: false };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      equippedSkins: {
        ...(state.equippedSkins ?? {}),
        [monsterId]: skinId,
      },
    },
  };
}

export function unequipSkin(
  state: GameState,
  monsterId: string,
): ShopTransactionResult {
  if (!state.equippedSkins?.[monsterId]) {
    return { ok: true, state, changed: false };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      equippedSkins: removeRecordKey(state.equippedSkins, monsterId),
    },
  };
}

export function purchaseAndEquipSkin(
  state: GameState,
  monsterId: string,
  skinId: string,
  gemCost: number,
): ShopTransactionResult {
  const ownedForMonster = state.ownedSkins?.[monsterId] ?? [];
  const owned = appendUnique(ownedForMonster, skinId);
  const alreadyEquipped = state.equippedSkins?.[monsterId] === skinId;
  if (!owned.changed && alreadyEquipped) return { ok: true, state, changed: false };
  if (owned.changed && (state.gems ?? 0) < gemCost) {
    return { ok: false, state, reason: 'insufficient_gems' };
  }
  return {
    ok: true,
    changed: true,
    state: {
      ...state,
      gems: owned.changed ? (state.gems ?? 0) - gemCost : state.gems,
      ownedSkins: {
        ...(state.ownedSkins ?? {}),
        [monsterId]: owned.values,
      },
      equippedSkins: {
        ...(state.equippedSkins ?? {}),
        [monsterId]: skinId,
      },
    },
  };
}
