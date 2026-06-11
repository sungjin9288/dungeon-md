// ─── RoomDurability ───────────────────────────────────────────────────────────
// Runtime adapters for managing dungeon trap-slot HP. GameState merge rules live
// in src/data/roomSlotTransactions.
//
//   applyRoomSlotDamage()    — reduce all slot HPs by a fraction of their maxHp
//   saveRoomHpsToGameState() — persist current slot HPs to localStorage

import { loadGameState, saveGameState, type DungeonSlot } from '../data/wisdom';
import {
  applyRoomSlotDamageSnapshot,
  applyRoomSlotHpSnapshotToState,
} from '../data/roomSlotTransactions';

// ─── applyRoomSlotDamage ──────────────────────────────────────────────────────
// Reduces every configured dungeon slot's HP by `ceil(maxHp * fraction)`,
// clamped to 0. Called on invader breakthrough / mirror reflect.

export function applyRoomSlotDamage(
  slots:    DungeonSlot[],
  fraction: number,
): void {
  const damagedSlots = applyRoomSlotDamageSnapshot(slots, fraction);
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
