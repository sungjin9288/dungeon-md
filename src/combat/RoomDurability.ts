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
  gs.dungeonSlots = gs.dungeonSlots ?? [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;
    if (!gs.dungeonSlots[i]) gs.dungeonSlots[i] = slot;
    else { gs.dungeonSlots[i].hp = slot.hp; gs.dungeonSlots[i].maxHp = slot.maxHp; }
  }
  saveGameState(gs);
}
