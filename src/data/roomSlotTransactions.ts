import { TRAP_DEFS } from './traps';
import {
  getMaxRoomLevel,
  getRoomSlotCapacity,
  getWisdomBonuses,
  type DungeonSlot,
  type GameState,
  type RoomSlotType,
} from './wisdom';
import { applyQuestObjectiveUpdate, tickSubQuestProgress } from './quests';

export const ROOM_UPGRADE_COSTS = [150, 300, 600, 1200, 2400];
export const ROOM_UPGRADE_HP = [300, 450, 650, 900, 1200];

export type RoomSlotTransactionFailureReason =
  | 'slot_not_found'
  | 'insufficient_gold'
  | 'room_level_cap_reached'
  | 'invalid_slot_index';

export type RoomSlotTransactionResult =
  | { ok: true; state: GameState; slot: DungeonSlot; changed: boolean }
  | { ok: false; state: GameState; reason: RoomSlotTransactionFailureReason };

export type RuntimeDungeonSlot = DungeonSlot | null | undefined;

export interface RoomSlotHpSnapshotResult {
  state:        GameState;
  dungeonSlots: DungeonSlot[];
  changed:      boolean;
}

export function createDefaultDungeonSlot(roomType?: RoomSlotType): DungeonSlot {
  const cap = getRoomSlotCapacity(1, roomType);
  return {
    roomType,
    monsterIds: Array<string | undefined>(cap.monsters).fill(undefined),
    trapIds: Array<string | undefined>(cap.traps).fill(undefined),
    roomLevel: 1,
    hp: 200,
    maxHp: 200,
  };
}

export function normalizeDungeonSlot(slot: DungeonSlot): DungeonSlot {
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  return {
    ...slot,
    monsterIds: Array.from({ length: cap.monsters }, (_, i) => slot.monsterIds?.[i]),
    trapIds: Array.from({ length: cap.traps }, (_, i) => slot.trapIds?.[i]),
  };
}

export function applyRoomSlotDamageSnapshot(
  slots: readonly RuntimeDungeonSlot[],
  fraction: number,
): RuntimeDungeonSlot[] {
  return slots.map(slot => {
    if (!slot) return slot;
    return {
      ...slot,
      hp: Math.max(0, slot.hp - Math.ceil(slot.maxHp * fraction)),
    };
  });
}

export function applyRoomSlotHpSnapshotToState(
  state: GameState,
  slots: readonly RuntimeDungeonSlot[],
): RoomSlotHpSnapshotResult {
  if (slots.length === 0) {
    return { state, dungeonSlots: state.dungeonSlots ?? [], changed: false };
  }

  const prevSlots = state.dungeonSlots ?? [];
  const len = Math.max(prevSlots.length, slots.length);
  const dungeonSlots = Array.from({ length: len }, (_, i) => {
    const slot = slots[i];
    if (!slot) return prevSlots[i];
    const existing = prevSlots[i];
    return existing ? { ...existing, hp: slot.hp, maxHp: slot.maxHp } : { ...slot };
  }) as DungeonSlot[];

  return {
    state: { ...state, dungeonSlots },
    dungeonSlots,
    changed: true,
  };
}

function replaceSlot(state: GameState, slotIdx: number, slot: DungeonSlot): GameState {
  const dungeonSlots = [...(state.dungeonSlots ?? [])];
  dungeonSlots[slotIdx] = normalizeDungeonSlot(slot);
  return { ...state, dungeonSlots };
}

export function ensureDungeonSlot(
  state: GameState,
  slotIdx: number,
): RoomSlotTransactionResult {
  if (slotIdx < 0) return { ok: false, state, reason: 'invalid_slot_index' };
  const existing = state.dungeonSlots?.[slotIdx];
  if (existing) return { ok: true, state, slot: normalizeDungeonSlot(existing), changed: false };

  const slot = createDefaultDungeonSlot();
  const withSlot = replaceSlot(state, slotIdx, slot);
  const [questUpdated] = applyQuestObjectiveUpdate(withSlot, 'build_room');
  const nextState = tickSubQuestProgress(questUpdated, 'build_room');
  return { ok: true, state: nextState, slot, changed: true };
}

export function changeRoomSlotType(
  state: GameState,
  slotIdx: number,
  roomType: RoomSlotType,
): RoomSlotTransactionResult {
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  const isFirstDesign = slot.roomLevel < 1 || slot.maxHp <= 0;
  const nextSlot = normalizeDungeonSlot(isFirstDesign
    ? createDefaultDungeonSlot(roomType)
    : { ...slot, roomType });
  return { ok: true, state: replaceSlot(state, slotIdx, nextSlot), slot: nextSlot, changed: true };
}

export function getRoomRepairCost(slot: DungeonSlot): number {
  const missingHp = Math.max(0, slot.maxHp - slot.hp);
  if (missingHp <= 0) return 0;
  return Math.max(10, Math.ceil((missingHp / slot.maxHp) * 80));
}

export function repairRoomSlot(
  state: GameState,
  slotIdx: number,
): RoomSlotTransactionResult & { cost?: number } {
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  const cost = getRoomRepairCost(slot);
  if (cost <= 0) return { ok: true, state, slot: normalizeDungeonSlot(slot), changed: false, cost };
  if ((state.homeGold ?? 0) < cost) return { ok: false, state, reason: 'insufficient_gold' };
  const nextSlot = { ...slot, hp: slot.maxHp };
  return {
    ok: true,
    state: replaceSlot({ ...state, homeGold: (state.homeGold ?? 0) - cost }, slotIdx, nextSlot),
    slot: normalizeDungeonSlot(nextSlot),
    changed: true,
    cost,
  };
}

export function getRoomUpgradeCost(level: number): number {
  return ROOM_UPGRADE_COSTS[level - 1] ?? 1200;
}

export function getRoomUpgradeHp(level: number): number {
  return ROOM_UPGRADE_HP[level] ?? 1200;
}

export function upgradeRoomSlot(
  state: GameState,
  slotIdx: number,
): RoomSlotTransactionResult & { cost?: number; previousLevel?: number; nextLevel?: number } {
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  if (slot.roomLevel >= 5 || slot.roomLevel >= getMaxRoomLevel(state.dmLevel)) {
    return { ok: false, state, reason: 'room_level_cap_reached' };
  }

  // `장인의 솜씨` discounts the only build-side gold sink the home has.
  const cost = Math.round(getRoomUpgradeCost(slot.roomLevel) * getWisdomBonuses(state).roomCostMult);
  if ((state.homeGold ?? 0) < cost) return { ok: false, state, reason: 'insufficient_gold' };

  const nextLevel = slot.roomLevel + 1;
  const nextHp = getRoomUpgradeHp(slot.roomLevel);
  const nextSlot = normalizeDungeonSlot({
    ...slot,
    roomLevel: nextLevel,
    hp: nextHp,
    maxHp: nextHp,
  });
  const withSlot = replaceSlot({ ...state, homeGold: (state.homeGold ?? 0) - cost }, slotIdx, nextSlot);
  const [questUpdated] = applyQuestObjectiveUpdate(withSlot, 'upgrade_room');
  const nextState = tickSubQuestProgress(questUpdated, 'upgrade_room');

  return {
    ok: true,
    state: nextState,
    slot: nextSlot,
    changed: true,
    cost,
    previousLevel: slot.roomLevel,
    nextLevel,
  };
}

export function assignMonsterToRoomSlot(
  state: GameState,
  slotIdx: number,
  monsterSlotIdx: number,
  monsterId: string,
): RoomSlotTransactionResult {
  if (slotIdx < 0 || monsterSlotIdx < 0) return { ok: false, state, reason: 'invalid_slot_index' };
  const clearedSlots = (state.dungeonSlots ?? []).map(slot => {
    if (!slot) return slot;
    const idx = (slot.monsterIds ?? []).indexOf(monsterId);
    if (idx === -1) return slot;
    const monsterIds = [...(slot.monsterIds ?? [])];
    monsterIds[idx] = undefined;
    return normalizeDungeonSlot({ ...slot, monsterIds });
  });

  const base = clearedSlots[slotIdx] ?? createDefaultDungeonSlot();
  const cap = getRoomSlotCapacity(base.roomLevel, base.roomType);
  if (monsterSlotIdx >= cap.monsters) return { ok: false, state, reason: 'invalid_slot_index' };
  const monsterIds = Array.from({ length: cap.monsters }, (_, i) => base.monsterIds?.[i]);
  monsterIds[monsterSlotIdx] = monsterId;
  const nextSlot = normalizeDungeonSlot({ ...base, monsterIds });
  const dungeonSlots = [...clearedSlots];
  dungeonSlots[slotIdx] = nextSlot;
  const withSlot = { ...state, dungeonSlots };

  // Quest tick only for NET-NEW placements — moving an already-placed monster
  // between slots must not re-count toward assign_monster objectives.
  const wasAlreadyPlaced = (state.dungeonSlots ?? []).some(
    s => s?.monsterIds?.includes(monsterId),
  );
  if (wasAlreadyPlaced) {
    return { ok: true, state: withSlot, slot: nextSlot, changed: true };
  }
  const [questUpdated] = applyQuestObjectiveUpdate(withSlot, 'assign_monster');
  const nextState = tickSubQuestProgress(questUpdated, 'assign_monster');
  return { ok: true, state: nextState, slot: nextSlot, changed: true };
}

export function removeMonsterFromRoomSlot(
  state: GameState,
  slotIdx: number,
  monsterSlotIdx: number,
): RoomSlotTransactionResult {
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  if (monsterSlotIdx < 0 || monsterSlotIdx >= cap.monsters) {
    return { ok: false, state, reason: 'invalid_slot_index' };
  }
  const monsterIds = Array.from({ length: cap.monsters }, (_, i) => slot.monsterIds?.[i]);
  monsterIds[monsterSlotIdx] = undefined;
  const nextSlot = normalizeDungeonSlot({ ...slot, monsterIds });
  return { ok: true, state: replaceSlot(state, slotIdx, nextSlot), slot: nextSlot, changed: true };
}

function getTrapCost(trapId: string | undefined): number {
  if (!trapId) return 0;
  return TRAP_DEFS.find(t => t.id === trapId)?.cost ?? 0;
}

export function installTrapInRoomSlot(
  state: GameState,
  slotIdx: number,
  trapSlotIdx: number,
  trapId: string,
): RoomSlotTransactionResult & { cost?: number; refund?: number } {
  const trapCost = getTrapCost(trapId);
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  if (trapSlotIdx < 0 || trapSlotIdx >= cap.traps) {
    return { ok: false, state, reason: 'invalid_slot_index' };
  }
  if ((state.homeGold ?? 0) < trapCost) {
    return { ok: false, state, reason: 'insufficient_gold' };
  }
  const refund = Math.floor(getTrapCost(slot.trapIds?.[trapSlotIdx]) * 0.5);
  const trapIds = Array.from({ length: cap.traps }, (_, i) => slot.trapIds?.[i]);
  trapIds[trapSlotIdx] = trapId;
  const nextSlot = normalizeDungeonSlot({ ...slot, trapIds });
  return {
    ok: true,
    state: replaceSlot({ ...state, homeGold: (state.homeGold ?? 0) + refund - trapCost }, slotIdx, nextSlot),
    slot: nextSlot,
    changed: true,
    cost: trapCost,
    refund,
  };
}

export function removeTrapFromRoomSlot(
  state: GameState,
  slotIdx: number,
  trapSlotIdx: number,
): RoomSlotTransactionResult & { refund?: number } {
  const slot = state.dungeonSlots?.[slotIdx];
  if (!slot) return { ok: false, state, reason: 'slot_not_found' };
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  if (trapSlotIdx < 0 || trapSlotIdx >= cap.traps) {
    return { ok: false, state, reason: 'invalid_slot_index' };
  }
  const refund = Math.floor(getTrapCost(slot.trapIds?.[trapSlotIdx]) * 0.5);
  const trapIds = Array.from({ length: cap.traps }, (_, i) => slot.trapIds?.[i]);
  trapIds[trapSlotIdx] = undefined;
  const nextSlot = normalizeDungeonSlot({ ...slot, trapIds });
  return {
    ok: true,
    state: replaceSlot({ ...state, homeGold: (state.homeGold ?? 0) + refund }, slotIdx, nextSlot),
    slot: nextSlot,
    changed: true,
    refund,
  };
}
