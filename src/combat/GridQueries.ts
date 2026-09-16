// ─── Grid Queries ─────────────────────────────────────────────────────────────
// Pure, side-effect-free functions that interrogate the room grid or derive
// positional data about invaders. No scene reference required — all inputs are
// plain values, making these independently unit-testable.
//
//   hasDivineTerritory()   — any monster has DIVINE_TERRITORY passive
//   hasTribeMasteryFor()   — any same-tribe monster has TRIBE_MASTERY
//   hasSeasonalBoon()      — any monster has SEASONAL_BOON passive
//   isScrollBurstActive()  — a nearby scroll_library has an active burst
//   getInvaderRow()        — which grid row an invader's Y-position maps to

import { resolveMonsterDef, type TribeId } from '../data/monsters';
import type { RoomData } from '../data/rooms';
import { GRID_ROWS, GRID_Y } from '../constants/layout';

// ─── hasDivineTerritory ───────────────────────────────────────────────────────
// Returns true if any occupied room slot holds a monster with the
// DIVINE_TERRITORY passive (mountain_god etc.). Grants +20% ATK to all rooms.

export function hasDivineTerritory(roomGrid: (RoomData | null)[][]): boolean {
  for (const row of roomGrid)
    for (const d of row)
      if (resolveMonsterDef(d?.monsterSlot ?? undefined)?.passive === 'DIVINE_TERRITORY')
        return true;
  return false;
}

// ─── hasTribeMasteryFor ───────────────────────────────────────────────────────
// Returns true if any room holds a monster with TRIBE_MASTERY whose tribe
// matches `tribe`. Grants +15% ATK to all same-tribe monsters.

export function hasTribeMasteryFor(
  roomGrid: (RoomData | null)[][],
  tribe:    TribeId,
): boolean {
  for (const row of roomGrid)
    for (const d of row)
      if (d?.monsterSlot) {
        const def = resolveMonsterDef(d.monsterSlot);
        if (def?.passive === 'TRIBE_MASTERY' && def.tribe === tribe) return true;
      }
  return false;
}

// ─── hasSeasonalBoon ──────────────────────────────────────────────────────────
// Returns true if any occupied slot holds a monster with the SEASONAL_BOON
// passive. Grants +10% ATK to all monsters.

export function hasSeasonalBoon(roomGrid: (RoomData | null)[][]): boolean {
  for (const row of roomGrid)
    for (const d of row)
      if (resolveMonsterDef(d?.monsterSlot ?? undefined)?.passive === 'SEASONAL_BOON')
        return true;
  return false;
}

// ─── isScrollBurstActive ──────────────────────────────────────────────────────
// Returns true if any scroll_library within Manhattan distance 3 of (row, col)
// currently has its Lv3 burst effect active (2× magic damage).

export function isScrollBurstActive(
  roomGrid:     (RoomData | null)[][],
  effectiveCols: number,
  row: number, col: number, now: number,
): boolean {
  for (let sr = 0; sr < GRID_ROWS; sr++)
    for (let sc = 0; sc < effectiveCols; sc++) {
      const sd = roomGrid[sr][sc];
      if (!sd || sd.type !== 'scroll_library') continue;
      if (Math.abs(sr - row) + Math.abs(sc - col) <= 3 && now < sd.scrollBurstActiveUntil)
        return true;
    }
  return false;
}

// ─── getInvaderRow ────────────────────────────────────────────────────────────
// Maps an invader's current Y-coordinate to the nearest grid row index.
// Returns -1 if the invader is outside all row bands.

export function getInvaderRow(
  effectiveCellSize: number,
  inv: { y: number },
): number {
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowY = GRID_Y + r * effectiveCellSize + effectiveCellSize / 2;
    if (Math.abs(inv.y - rowY) <= effectiveCellSize * 0.7) return r;
  }
  return -1;
}
