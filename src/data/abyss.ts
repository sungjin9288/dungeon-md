/**
 * 심연 (The Abyss) — dedicated material-farming dungeon for the dungeon master.
 *
 * A descending tower of floors. Each floor is a combat encounter (reuses the
 * battle scene with a scaling inline wave); clearing a floor for the first time
 * advances depth and grants a bonus. Any cleared floor can then be SWEPT
 * instantly (no battle) for its material loot, gated by daily-refilling Abyss
 * Keys — the farming convenience that feeds evolution (Fusion) + equipment
 * crafting (Forge).
 *
 * Pure data/logic only — no Phaser, no GameState mutation (see
 * abyssTransactions.ts for the GameState-level transactions).
 */

export interface AbyssState {
  /** Highest floor cleared (0 = none cleared yet; floor 1 always enterable). */
  highestFloor: number;
  /** Sweep keys remaining today. */
  keys: number;
  /** YYYY-MM-DD of the last key refill. */
  lastRefill: string;
}

export const ABYSS_MAX_FLOOR = 60;
export const ABYSS_KEY_MAX = 12;
export const ABYSS_BOSS_INTERVAL = 10;

export const DEFAULT_ABYSS_STATE: AbyssState = {
  highestFloor: 0,
  keys: ABYSS_KEY_MAX,
  lastRefill: '',
};

export interface AbyssLootEntry {
  readonly id: string;     // material id (must exist in MATERIAL_DEFS)
  readonly chance: number; // 0..1 roll chance
  readonly min: number;    // min quantity when it drops
  readonly max: number;    // max quantity when it drops
}

export interface AbyssLoot {
  materials: Record<string, number>;
  awakeningStones: number;
  gold: number;
}

export function isAbyssBossFloor(floor: number): boolean {
  return floor > 0 && floor % ABYSS_BOSS_INTERVAL === 0;
}

export interface AbyssFloorConfig {
  readonly floor: number;
  readonly isBoss: boolean;
  /** Recommended total monster power to clear comfortably. */
  readonly recommendedPower: number;
  /** Enemy "wave number" to feed the shared scaling spawn builder. */
  readonly waveScale: number;
  readonly bandLabel: string;
}

/** Floor band index 0..3 (controls loot pool + theme). */
export function abyssBand(floor: number): number {
  if (floor <= 10) return 0;
  if (floor <= 25) return 1;
  if (floor <= 45) return 2;
  return 3;
}

const BAND_LABELS = ['상층부 동굴', '중층부 폐허', '심층부 균열', '최심부 나락'] as const;

export function getAbyssFloorConfig(floor: number): AbyssFloorConfig {
  const f = Math.max(1, Math.min(ABYSS_MAX_FLOOR, Math.floor(floor)));
  const isBoss = isAbyssBossFloor(f);
  // Power curve: gentle early, steeper deep; bosses spike ~1.6x.
  const base = Math.round(40 * Math.pow(1.16, f - 1));
  const recommendedPower = isBoss ? Math.round(base * 1.6) : base;
  return {
    floor: f,
    isBoss,
    recommendedPower,
    waveScale: f,            // reuse endless spawn scaling keyed by floor
    bandLabel: BAND_LABELS[abyssBand(f)],
  };
}

// ─── Loot tables ───────────────────────────────────────────────────────────
// Per-band material pools. Deeper bands unlock rarer materials and higher
// quantities. Boss floors add boss_essence + an awakening-stone chance.

const BAND_LOOT: AbyssLootEntry[][] = [
  // Band 0 (floors 1-10) — common forge/evolve basics
  [
    { id: 'common_ore', chance: 0.75, min: 1, max: 3 },
    { id: 'old_cloth',  chance: 0.55, min: 1, max: 2 },
    { id: 'herb',       chance: 0.50, min: 1, max: 2 },
    { id: 'iron_shard', chance: 0.40, min: 1, max: 2 },
  ],
  // Band 1 (11-25)
  [
    { id: 'iron_shard', chance: 0.70, min: 1, max: 3 },
    { id: 'fox_fur',    chance: 0.45, min: 1, max: 2 },
    { id: 'ice_crystal',chance: 0.40, min: 1, max: 2 },
    { id: 'magic_dust', chance: 0.35, min: 1, max: 2 },
    { id: 'common_ore', chance: 0.50, min: 1, max: 3 },
  ],
  // Band 2 (26-45)
  [
    { id: 'magic_dust',   chance: 0.55, min: 1, max: 3 },
    { id: 'soul_fragment',chance: 0.40, min: 1, max: 2 },
    { id: 'shadow_cloth', chance: 0.38, min: 1, max: 2 },
    { id: 'ice_crystal',  chance: 0.45, min: 1, max: 3 },
    { id: 'dok_fragment', chance: 0.30, min: 1, max: 2 },
  ],
  // Band 3 (46-60) — deepest, richest
  [
    { id: 'soul_fragment',chance: 0.60, min: 2, max: 4 },
    { id: 'shadow_cloth', chance: 0.55, min: 1, max: 3 },
    { id: 'dok_fragment', chance: 0.45, min: 1, max: 3 },
    { id: 'magic_dust',   chance: 0.55, min: 2, max: 4 },
  ],
];

/** The loot table for a floor (boss floors append boss_essence). */
export function getAbyssFloorLoot(floor: number): AbyssLootEntry[] {
  const band = abyssBand(Math.max(1, Math.floor(floor)));
  const table = [...BAND_LOOT[band]];
  if (isAbyssBossFloor(floor)) {
    table.push({ id: 'boss_essence', chance: 1, min: 1, max: 2 });
  }
  return table;
}

function rollInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Roll a floor's loot. `bonusMult` (>=1) scales chances/quantities for
 * first-clear or buffed runs. `rng` injectable for deterministic tests.
 */
export function rollAbyssLoot(
  floor: number,
  rng: () => number = Math.random,
  bonusMult = 1,
): AbyssLoot {
  const loot: AbyssLoot = { materials: {}, awakeningStones: 0, gold: 0 };
  const f = Math.max(1, Math.floor(floor));

  for (const entry of getAbyssFloorLoot(f)) {
    if (rng() < Math.min(1, entry.chance * bonusMult)) {
      const qty = Math.max(1, Math.round(rollInt(rng, entry.min, entry.max) * bonusMult));
      loot.materials[entry.id] = (loot.materials[entry.id] ?? 0) + qty;
    }
  }

  // Gold scales with depth.
  loot.gold = Math.round((20 + f * 6) * bonusMult);

  // Awakening stones: boss floors have a chance, deeper = higher.
  if (isAbyssBossFloor(f)) {
    const stoneChance = Math.min(0.9, 0.3 + abyssBand(f) * 0.2) * bonusMult;
    if (rng() < stoneChance) loot.awakeningStones = abyssBand(f) >= 2 ? 2 : 1;
  }

  return loot;
}

// ─── Key economy ─────────────────────────────────────────────────────────────

/** Returns a refilled AbyssState if the day rolled over; otherwise the same. */
export function refilledKeys(state: AbyssState, today: string): AbyssState {
  if (state.lastRefill === today) return state;
  return { ...state, keys: ABYSS_KEY_MAX, lastRefill: today };
}

export type SweepCheck = { ok: true } | { ok: false; reason: 'locked' | 'no_keys' };

/** Whether `floor` can be swept right now (cleared before + a key available). */
export function canSweepAbyss(state: AbyssState, floor: number): SweepCheck {
  if (floor < 1 || floor > state.highestFloor) return { ok: false, reason: 'locked' };
  if (state.keys <= 0) return { ok: false, reason: 'no_keys' };
  return { ok: true };
}

/** The next floor the player can attempt (climb). Capped at ABYSS_MAX_FLOOR. */
export function nextAbyssFloor(state: AbyssState): number {
  return Math.min(ABYSS_MAX_FLOOR, state.highestFloor + 1);
}
