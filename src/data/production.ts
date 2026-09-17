/**
 * 생산 시설 (Production facilities) — the dungeon's in-base farming/mining.
 *
 * The dungeon master builds and upgrades facilities (mine, herb garden, weavery,
 * mana well, treasury) that passively produce crafting materials + gold while
 * away. This is the concrete heart of the "경영" idle loop: the materials a
 * facility yields are exactly the ones Forge/Fusion consume, so growing your
 * facilities feeds crafting without grinding the Abyss.
 *
 * Pure data/logic only — no Phaser, no GameState mutation (see
 * productionTransactions.ts for build/upgrade). Production over time is folded
 * into the shared idle clock by idleIncome.ts.
 */

import { resolveOwnedMonsterProfile } from './monsters';
import type { TribeId } from './monstersTypes';

export type FacilityOutput =
  | { readonly kind: 'gold' }
  | { readonly kind: 'material'; readonly materialId: string };

export interface FacilityDef {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly desc: string;
  readonly output: FacilityOutput;
  readonly baseRatePerHour: number;   // production at level 1
  readonly buildCost: number;         // gold to build (reach level 1)
  readonly upgradeMult: number;       // upgrade cost growth per level
  readonly maxLevel: number;
}

export const FACILITY_DEFS: Record<string, FacilityDef> = {
  mine: {
    id: 'mine', name: '광산', emoji: '⛏️', desc: '일반 광석을 채굴',
    output: { kind: 'material', materialId: 'common_ore' },
    baseRatePerHour: 2, buildCost: 150, upgradeMult: 1.8, maxLevel: 5,
  },
  herb_garden: {
    id: 'herb_garden', name: '약초원', emoji: '🌿', desc: '약초를 재배',
    output: { kind: 'material', materialId: 'herb' },
    baseRatePerHour: 2, buildCost: 150, upgradeMult: 1.8, maxLevel: 5,
  },
  weavery: {
    id: 'weavery', name: '직조실', emoji: '🧵', desc: '낡은 천을 직조',
    output: { kind: 'material', materialId: 'old_cloth' },
    baseRatePerHour: 1.5, buildCost: 220, upgradeMult: 1.85, maxLevel: 5,
  },
  mana_well: {
    id: 'mana_well', name: '마력 우물', emoji: '🔮', desc: '마법 가루를 정제',
    output: { kind: 'material', materialId: 'magic_dust' },
    baseRatePerHour: 1, buildCost: 380, upgradeMult: 1.9, maxLevel: 5,
  },
  treasury: {
    id: 'treasury', name: '보물고', emoji: '💰', desc: '골드를 축적',
    output: { kind: 'gold' },
    baseRatePerHour: 100, buildCost: 280, upgradeMult: 1.8, maxLevel: 5,
  },
};

/** A tribe whose lore fits the facility: its members work it at +50% instead of +20%. */
export const FACILITY_AFFINITY: Readonly<Record<string, TribeId>> = {
  mine: 'dragon',
  herb_garden: 'sansin',
  weavery: 'mask',
  mana_well: 'sea',
  treasury: 'dokkaebi',
};
/** Any guardian on shift lifts output; the affine tribe lifts it more. */
export const STAFF_MULT = 1.2;
export const STAFF_AFFINITY_MULT = 1.5;

export function isFacilityAffineTribe(facilityId: string, tribe: string | undefined | null): boolean {
  return Boolean(tribe) && FACILITY_AFFINITY[facilityId] === tribe;
}

/** Output multiplier for the monster on shift at `facilityId` (1 when unstaffed). */
export function facilityStaffMult(facilityId: string, monsterId: string | undefined | null): number {
  if (!monsterId) return 1;
  const profile = resolveOwnedMonsterProfile(monsterId);
  if (!profile) return 1;
  return isFacilityAffineTribe(facilityId, profile.tribe) ? STAFF_AFFINITY_MULT : STAFF_MULT;
}

/** Stable display order for the facility list. */
export const FACILITY_ORDER: readonly string[] = ['mine', 'herb_garden', 'weavery', 'mana_well', 'treasury'];

export interface FacilityProduction {
  materials: Record<string, number>;
  gold: number;
}

/** Production per hour at a given level (0 when not built), times the shift multiplier. */
export function facilityRatePerHour(def: FacilityDef, level: number, staffMult = 1): number {
  if (level <= 0) return 0;
  return def.baseRatePerHour * Math.min(level, def.maxLevel) * staffMult;
}

/**
 * Gold cost to take a facility from `currentLevel` to the next level.
 * Returns the build cost at level 0, scales for upgrades, or null when maxed.
 */
export function facilityUpgradeCost(def: FacilityDef, currentLevel: number): number | null {
  if (currentLevel >= def.maxLevel) return null;
  if (currentLevel <= 0) return def.buildCost;
  return Math.round(def.buildCost * Math.pow(def.upgradeMult, currentLevel));
}

/**
 * Total facility production over `ms` of elapsed time. Each material/gold total
 * is floored independently (short idles may round down to nothing). `facilities`
 * maps facilityId → level (0/absent = not built); `staff` maps facilityId → the
 * monster on shift (see facilityStaffMult).
 */
export function facilityProductionOverMs(
  facilities: Readonly<Record<string, number>> | undefined,
  ms: number,
  staff: Readonly<Record<string, string>> | undefined = undefined,
): FacilityProduction {
  const hours = Math.max(0, ms) / 3_600_000;
  const matFloat: Record<string, number> = {};
  let goldFloat = 0;

  for (const id of FACILITY_ORDER) {
    const level = facilities?.[id] ?? 0;
    if (level <= 0) continue;
    const def = FACILITY_DEFS[id];
    const amount = facilityRatePerHour(def, level, facilityStaffMult(id, staff?.[id])) * hours;
    if (def.output.kind === 'gold') {
      goldFloat += amount;
    } else {
      matFloat[def.output.materialId] = (matFloat[def.output.materialId] ?? 0) + amount;
    }
  }

  const materials: Record<string, number> = {};
  for (const [id, v] of Object.entries(matFloat)) {
    const floored = Math.floor(v);
    if (floored > 0) materials[id] = floored;
  }
  return { materials, gold: Math.floor(goldFloat) };
}

/** Count of currently built facilities (level >= 1). */
export function builtFacilityCount(facilities: Readonly<Record<string, number>> | undefined): number {
  return FACILITY_ORDER.reduce((n, id) => n + ((facilities?.[id] ?? 0) > 0 ? 1 : 0), 0);
}
