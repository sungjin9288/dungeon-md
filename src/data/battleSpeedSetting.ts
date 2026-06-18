/**
 * Battle-speed preference — a lightweight standalone setting (NOT part of the
 * main GameState save), mirroring the AudioManager settings store. Persisting
 * it here keeps the player's chosen 1×/2×/3× across battles without touching
 * the (large, migration-sensitive) game save format.
 */

export type BattleSpeed = 1 | 2 | 3;

const KEY = 'dungeonBattleSpeed';

/** Load the saved battle speed; defaults to 1× and is validated to 1|2|3. */
export function loadBattleSpeed(): BattleSpeed {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return n === 2 || n === 3 ? n : 1;
  } catch {
    return 1;
  }
}

/** Persist the chosen battle speed. */
export function saveBattleSpeed(v: BattleSpeed): void {
  try {
    globalThis.localStorage?.setItem(KEY, String(v));
  } catch {
    /* localStorage unavailable — non-fatal, speed simply won't persist */
  }
}
