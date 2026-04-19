// ─── RoomDurability ───────────────────────────────────────────────────────────
// Pure functions for managing dungeon trap-slot HP. No scene reference needed.
//
//   applyRoomSlotDamage()    — reduce all slot HPs by a fraction of their maxHp
//   saveRoomHpsToGameState() — persist current slot HPs to localStorage

import { loadGameState, saveGameState, type DungeonSlot } from '../data/wisdom';

// ─── applyRoomSlotDamage ──────────────────────────────────────────────────────
// Reduces every configured dungeon slot's HP by `ceil(maxHp * fraction)`,
// clamped to 0. Called on invader breakthrough / mirror reflect.

export function applyRoomSlotDamage(
  slots:    DungeonSlot[],
  fraction: number,
): void {
  for (const slot of slots) {
    if (!slot) continue;
    slot.hp = Math.max(0, slot.hp - Math.ceil(slot.maxHp * fraction));
  }
}

// ─── saveRoomHpsToGameState ───────────────────────────────────────────────────
// Writes current slot HP values back to the persisted GameState so they survive
// between sessions. No-ops when the slots array is empty (no traps placed).

export function saveRoomHpsToGameState(slots: DungeonSlot[]): void {
  if (slots.length === 0) return;
  const gs = loadGameState();
  const prevSlots = gs.dungeonSlots ?? [];
  const len = Math.max(prevSlots.length, slots.length);
  const newSlots: DungeonSlot[] = Array.from({ length: len }, (_, i) => {
    const slot = slots[i];
    if (!slot) return prevSlots[i];
    const existing = prevSlots[i];
    return existing ? { ...existing, hp: slot.hp, maxHp: slot.maxHp } : slot;
  });
  saveGameState({ ...gs, dungeonSlots: newSlots });
}
