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

import type { WaveSpec } from './stagesChapter1';
import { INVADER_DEFS, type InvaderType } from './invaders';

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

/** Floor 1's numbers, which every deeper floor is expressed as a multiple of. */
export const ABYSS_FLOOR_1_RECOMMENDED_POWER = 40;
export const ABYSS_FLOOR_1_DUNGEON_HP = 1000;

/**
 * The dungeon core's health on a floor. Floor 1 grants 1,000 against 1,350
 * points of incoming core damage; that ratio — how much of a floor you may leak
 * and still clear — is held constant with depth. It used to be *literally*
 * constant: `stageConfig` carried no `dungeonHp`, so all sixty floors fell back
 * to DungeonScene's 1,000 while the floors' damage grew past 6,000.
 */
export function abyssFloorDungeonHp(floor: number): number {
  const ratio = abyssFloorCoreDamage(floor) / abyssFloorCoreDamage(1);
  return Math.round(ABYSS_FLOOR_1_DUNGEON_HP * ratio);
}

export function getAbyssFloorConfig(floor: number): AbyssFloorConfig {
  const f = Math.max(1, Math.min(ABYSS_MAX_FLOOR, Math.floor(floor)));
  const isBoss = isAbyssBossFloor(f);
  // Read off the floor's own waves rather than an invented exponential. The old
  // curve was 40 x 1.16^(f-1) — 406,632 at floor 60 — while that floor's waves
  // were lighter than floor 26's. The player was shown that number as 권장 전투력.
  const recommendedPower = Math.round(
    ABYSS_FLOOR_1_RECOMMENDED_POWER * abyssFloorWaveHp(f) / abyssFloorWaveHp(1),
  );
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
    // The starter blueprint 도깨비 방망이 (MQ-007) needs 3; it used to drop only from floor 26.
    { id: 'dok_fragment', chance: 0.30, min: 1, max: 1 },
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

// ─── Material → source lookup (farming-loop visibility) ──────────────────────
// Reverse of the loot tables: given a crafting material, which part of the
// Abyss farms it. Powers the Forge/Fusion "심연에서 파밍" shortcuts and the
// Abyss "이 재료로 제작 가능" hints — making the farm → craft loop legible.

const BAND_MIN_FLOORS = [1, 11, 26, 46] as const;

export interface AbyssMaterialSource {
  readonly materialId: string;
  readonly bands: number[];     // band indices (0..3) that can drop it
  readonly minFloor: number;    // shallowest floor where it can drop
  readonly bandLabel: string;   // label of the shallowest source band
  readonly bossOnly: boolean;   // only from boss floors (boss_essence)
}

/** Where in the Abyss a crafting material drops, or null if it never drops. */
export function getAbyssMaterialSource(materialId: string): AbyssMaterialSource | null {
  if (materialId === 'boss_essence') {
    return {
      materialId,
      bands: [0, 1, 2, 3],
      minFloor: ABYSS_BOSS_INTERVAL,   // first boss floor
      bandLabel: BAND_LABELS[abyssBand(ABYSS_BOSS_INTERVAL)],
      bossOnly: true,
    };
  }
  const bands: number[] = [];
  for (let b = 0; b < BAND_LOOT.length; b++) {
    if (BAND_LOOT[b].some(e => e.id === materialId)) bands.push(b);
  }
  if (bands.length === 0) return null;
  return {
    materialId,
    bands,
    minFloor: BAND_MIN_FLOORS[bands[0]],
    bandLabel: BAND_LABELS[bands[0]],
    bossOnly: false,
  };
}

/** Whether a material can be farmed anywhere in the Abyss. */
export function dropsInAbyss(materialId: string): boolean {
  return getAbyssMaterialSource(materialId) !== null;
}

/** Short Korean source tag for a material, e.g. "심연 11층~" / "심연 보스층". */
export function abyssMaterialSourceLabel(materialId: string): string | null {
  const src = getAbyssMaterialSource(materialId);
  if (!src) return null;
  return src.bossOnly ? '심연 보스층' : `심연 ${src.minFloor}층~`;
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

// ─── Floor battle waves ──────────────────────────────────────────────────────
// Build a short, depth-scaled inline wave set for an Abyss floor battle. Fed to
// the shared battle scene via stageConfig.waves (the player's placed dungeon
// auto-deploys to defend, same as invasion battles).

// ─── Combat tiers ────────────────────────────────────────────────────────────
// Combat tier is NOT the loot band. `abyssBand` (4 bands) picks the material
// pool and the theme name; the fight advances one tier every ten floors, so
// each boss floor closes a tier. Keeping them separate is what the old code
// got wrong: it drove the fight off the 4 loot bands, so floors 26-45 were one
// single encounter repeated twenty times and 46-60 another fifteen — and band
// 3's berserker (180hp) was *weaker* than band 2's knight (350hp), making the
// deepest floors easier than the middle ones.
export const ABYSS_TIER_SPAN = 10;

/** Combat tier 0..5 — one per ten floors, so floor 10·20·…·60 close a tier. */
export function abyssTier(floor: number): number {
  const f = Math.max(1, Math.min(ABYSS_MAX_FLOOR, Math.floor(floor)));
  return Math.min(5, Math.floor((f - 1) / ABYSS_TIER_SPAN));
}

// Monotone by HP: 60 → 150 → 350 → 400 → 650 → 950.
const ABYSS_PRIMARY: InvaderType[] = [
  'peasant', 'soldier', 'knight', 'undying_warrior', 'celestial_knight', 'abyss_berserker',
];
// The tier's second unit, always lighter than its primary.
const ABYSS_SUPPORT: InvaderType[] = [
  'shaman', 'berserker', 'venom_dancer', 'undying_knight', 'divine_archer', 'void_soldier',
];
// Real bosses, each roughly half its floor's health so the boss floor is a wall
// (the guard in abyss.test.ts holds it above 1.3x the floor before it).
const ABYSS_BOSS: InvaderType[] = [
  'fox_queen', 'dragon_king', 'eternal_emperor', 'god_emperor', 'primordial_titan', 'void_sovereign',
];

export function buildAbyssFloorWaves(floor: number): WaveSpec[] {
  const f = Math.max(1, Math.min(ABYSS_MAX_FLOOR, Math.floor(floor)));
  const tier = abyssTier(f);
  const primary = ABYSS_PRIMARY[tier];
  const support = ABYSS_SUPPORT[tier];
  // Within a tier the crowd grows; the jump between tiers is carried by the
  // unit, not the count, because the spawn count is capped by what a 390px
  // board can hold. The old builder saturated this cap at floor 20 and then
  // had nothing left to scale with.
  const count = Math.min(4 + (f - 1) % ABYSS_TIER_SPAN, 14);
  const delay = Math.max(700, 1700 - f * 14);
  const reward = Math.round((30 + f * 8));

  const waves: WaveSpec[] = [
    { clearReward: reward, invaders: [
      { type: primary, count, spawnDelay: delay },
      { type: support, count: 2 + tier, spawnDelay: delay },
    ] },
    { clearReward: reward, invaders: [
      { type: primary, count: count + 2, spawnDelay: delay },
      { type: ABYSS_PRIMARY[Math.max(0, tier - 1)], count: 3, spawnDelay: delay },
    ] },
  ];

  if (isAbyssBossFloor(f)) {
    waves.push({ clearReward: reward * 3, invaders: [
      { type: ABYSS_BOSS[tier], count: 1, spawnDelay: 0, isBoss: true },
      { type: primary, count, spawnDelay: delay },
    ] });
  } else {
    waves.push({ clearReward: reward, invaders: [
      { type: primary, count: count + 4, spawnDelay: Math.max(600, delay - 200) },
    ] });
  }
  return waves;
}

/** Health a floor's waves can take off the dungeon core if nothing is stopped. */
export function abyssFloorCoreDamage(floor: number): number {
  return buildAbyssFloorWaves(floor).reduce((sum, wave) => sum + wave.invaders.reduce(
    (acc, group) => acc + group.count * (INVADER_DEFS[group.type]?.damage ?? 0), 0), 0);
}

/** Total invader health a floor fields. */
export function abyssFloorWaveHp(floor: number): number {
  return buildAbyssFloorWaves(floor).reduce((sum, wave) => sum + wave.invaders.reduce(
    (acc, group) => acc + group.count * (INVADER_DEFS[group.type]?.hp ?? 0), 0), 0);
}
