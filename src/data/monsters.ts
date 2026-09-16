// ─── Re-export all types (keeps existing import paths working) ────────────────
export type {
  TribeId,
  ElementId,
  RarityId,
  UnlockMethod,
  PassiveId,
  MonsterId,
  MonsterDef,
  MonsterSkin,
} from './monstersTypes';

// ─── Import data parts ────────────────────────────────────────────────────────
import type { MonsterId, MonsterDef, RarityId } from './monstersTypes';
import {
  SKIN_DATA as _SKIN_DATA,
  TRIBE_TOTALS as _TRIBE_TOTALS,
} from './monstersDataCh7andExtras';
import { MONSTER_DEFS } from './monsterRegistry';

// ─── Assembled lookup ─────────────────────────────────────────────────────────

export { MONSTER_DEFS };

// ─── Re-export data constants ────────────────────────────────────────────────

export const SKIN_DATA = _SKIN_DATA;
export const TRIBE_TOTALS = _TRIBE_TOTALS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { ElementId } from './monstersTypes';
import { ROOM_DEFS, type RoomType } from './rooms';

/** Resolves an exact registry ID or a delimited owned-instance ID to its longest base type. */
export function resolveMonsterTypeId(monsterId: unknown): MonsterId | null {
  if (typeof monsterId !== 'string' || !monsterId) return null;
  if (Object.prototype.hasOwnProperty.call(MONSTER_DEFS, monsterId)) {
    return monsterId as MonsterId;
  }

  let longestMatch: MonsterId | null = null;
  for (const candidate of Object.keys(MONSTER_DEFS) as MonsterId[]) {
    if (monsterId.startsWith(`${candidate}_`) && (!longestMatch || candidate.length > longestMatch.length)) {
      longestMatch = candidate;
    }
  }
  return longestMatch;
}

/** Returns all monsters that can be placed in this room type at the given stage. */
export function getMonstersForRoom(
  roomType: RoomType,
  unlockedStage: number,
  elementFilter?: ElementId,
): MonsterDef[] {
  return (Object.values(MONSTER_DEFS) as MonsterDef[]).filter(m => {
    if (!m.roomTypes.includes(roomType)) return false;
    if (m.unlockStage > unlockedStage) return false;
    if (elementFilter && m.element !== elementFilter) return false;
    return true;
  });
}

/** Returns all monsters belonging to the given tribe. */
export function getMonstersForTribe(tribe: import('./monstersTypes').TribeId): MonsterDef[] {
  return (Object.values(MONSTER_DEFS) as MonsterDef[]).filter(
    m => m.tribe === tribe,
  );
}

// ─── Skin helpers ─────────────────────────────────────────────────────────────

import type { MonsterSkin } from './monstersTypes';

/** Returns the equipped skin for a monster, or null if using default. */
export function getSkinForMonster(
  monsterId: string,
  equippedSkins: Record<string, string>,
): MonsterSkin | null {
  const skinId = equippedSkins[monsterId];
  if (!skinId) return null;
  return SKIN_DATA.find(s => s.id === skinId) ?? null;
}

/** Returns all skins for a given monster. */
export function getSkinsForMonster(monsterId: string): MonsterSkin[] {
  return SKIN_DATA.filter(s => s.monsterId === monsterId);
}

// ─── Owned monster profile resolver ──────────────────────────────────────────

import { HYBRID_DEFS, getMonsterRarity } from './fusion';

export interface OwnedMonsterProfile {
  readonly id: string;
  readonly registryId: MonsterId | null;
  readonly source: 'registry' | 'variant' | 'hybrid';
  readonly name: string;
  readonly emoji: string;
  readonly type: MonsterDef['type'];
  readonly roomTypes: readonly string[];
  readonly baseDamage: number;
  readonly attackCooldown: number;
  readonly range: number;
  readonly passive: string;
  readonly passiveDesc: string;
  readonly accentColor: number;
  readonly tribe?: MonsterDef['tribe'];
  readonly element?: MonsterDef['element'];
  readonly rarityTier: RarityId;
}

const OWNED_RARITY_TIERS: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];
const OWNED_RARITY_PREFIXES = ['', '강화 ', '정예 ', '영웅 ', '전설 '] as const;
const OWNED_RARITY_ACCENTS = [0x8f98a5, 0x58c681, 0x62a8ff, 0xc978ff, 0xffc857] as const;

/**
 * Resolves every valid OwnedMonster.id into one read-only presentation/combat
 * profile. Exact registry IDs stay canonical; evolved IDs inherit their base
 * definition; fusion-only hybrids use the existing hybrid registry.
 */
export function resolveOwnedMonsterProfile(id: unknown): OwnedMonsterProfile | null {
  if (typeof id !== 'string' || !id) return null;

  if (Object.prototype.hasOwnProperty.call(MONSTER_DEFS, id)) {
    const def = MONSTER_DEFS[id as MonsterId];
    return {
      ...def,
      id,
      registryId: def.id,
      source: 'registry',
      rarityTier: def.rarityTier ?? 'C',
    };
  }

  const registryId = resolveMonsterTypeId(id);
  if (registryId) {
    const def = MONSTER_DEFS[registryId];
    const rarity = getMonsterRarity(id);
    return {
      ...def,
      id,
      registryId,
      source: 'variant',
      name: `${OWNED_RARITY_PREFIXES[rarity] ?? ''}${def.name}`,
      baseDamage: rarity > 0
        ? Math.round(def.baseDamage * Math.pow(1.30, rarity))
        : def.baseDamage,
      rarityTier: rarity > 0
        ? OWNED_RARITY_TIERS[rarity] ?? def.rarityTier ?? 'C'
        : def.rarityTier ?? 'C',
    };
  }

  if (!Object.prototype.hasOwnProperty.call(HYBRID_DEFS, id)) return null;
  const hybrid = HYBRID_DEFS[id];
  const isMagic = hybrid.roomTypes.includes('scroll_library')
    || hybrid.roomTypes.includes('celestial_shrine');
  return {
    id,
    registryId: null,
    source: 'hybrid',
    name: hybrid.name,
    emoji: hybrid.emoji,
    type: isMagic ? 'magic' : 'melee',
    roomTypes: hybrid.roomTypes,
    baseDamage: hybrid.baseDamage,
    attackCooldown: isMagic ? 2000 : 1500,
    range: isMagic ? 2 : 1,
    passive: hybrid.passive,
    passiveDesc: hybrid.passiveDesc,
    accentColor: OWNED_RARITY_ACCENTS[hybrid.rarity] ?? OWNED_RARITY_ACCENTS[0],
    rarityTier: OWNED_RARITY_TIERS[hybrid.rarity] ?? 'C',
  };
}

// ─── Combat def resolver ─────────────────────────────────────────────────────

export type CombatMonsterDef = {
  baseDamage: number;
  passive?: string;
  type?: string;
  tribe?: string;
  range: number;
  attackCooldown: number;
};

export function resolveMonsterDef(id: unknown): CombatMonsterDef | null {
  const profile = resolveOwnedMonsterProfile(id);
  if (!profile) return null;
  return {
    baseDamage: profile.baseDamage,
    passive: profile.passive,
    type: profile.type,
    tribe: profile.tribe,
    range: profile.range,
    attackCooldown: profile.attackCooldown,
  };
}

/** Resolves the baseline cadence used by a monster in a concrete combat room. */
export function resolveMonsterAttackCooldown(
  id: unknown,
  roomType: RoomType,
): number {
  const profile = resolveOwnedMonsterProfile(id);
  const baseCooldown = profile?.attackCooldown && profile.attackCooldown > 0
    ? profile.attackCooldown
    : ROOM_DEFS[roomType].attackCooldown;
  return roomType === 'scroll_library' && baseCooldown > 0
    ? Math.round(baseCooldown * 0.8)
    : baseCooldown;
}
