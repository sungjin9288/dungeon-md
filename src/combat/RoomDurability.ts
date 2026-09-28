// ─── RoomDurability ───────────────────────────────────────────────────────────
// Runtime adapters for managing dungeon trap-slot HP. GameState merge rules live
// in src/data/roomSlotTransactions.
//
//   applyRoomSlotDamage()    — reduce all slot HPs by a fraction of their maxHp
//   saveRoomHpsToGameState() — persist current slot HPs to localStorage

import { loadGameState, saveGameState, type DungeonSlot } from '../data/wisdom';
import type { EquipmentStats } from '../data/barracks';
import {
  applyRoomSlotDamageSnapshot,
  applyRoomSlotHpSnapshotToState,
} from '../data/roomSlotTransactions';

// ─── applyRoomSlotDamage ──────────────────────────────────────────────────────
// Reduces every configured dungeon slot's HP by `ceil(maxHp * fraction * armorMult)`,
// clamped to 0. Called on invader breakthrough / mirror reflect.

export function applyRoomSlotDamage(
  slots:    DungeonSlot[],
  fraction: number,
  equipmentMap: ReadonlyMap<string, EquipmentStats> = new Map(),
  getActiveMonsterIds?: (slotIndex: number) => readonly (string | null | undefined)[],
): void {
  // Battle restrictions and swaps can differ from the saved loadout. Use live
  // occupants for armor eligibility without overwriting persistent assignments.
  const damageSlots = getActiveMonsterIds
    ? slots.map((slot, i) => slot && {
      ...slot,
      monsterIds: getActiveMonsterIds(i).map(id => id ?? undefined),
    })
    : slots;
  const damagedSlots = applyRoomSlotDamageSnapshot(damageSlots, fraction, equipmentMap);
  damagedSlots.forEach((slot, i) => {
    const target = slots[i] as DungeonSlot | null | undefined;
    if (!target || !slot) return;
    target.hp = slot.hp;
    target.maxHp = slot.maxHp;
  });
}

// ─── saveRoomHpsToGameState ───────────────────────────────────────────────────
// Writes current slot HP values back to the persisted GameState so they survive
// between sessions. No-ops when the slots array is empty (no traps placed).

export function saveRoomHpsToGameState(slots: DungeonSlot[]): void {
  const result = applyRoomSlotHpSnapshotToState(loadGameState(), slots);
  if (result.changed) saveGameState(result.state);
}
