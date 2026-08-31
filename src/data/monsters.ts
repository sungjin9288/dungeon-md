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
import type { MonsterId, MonsterDef } from './monstersTypes';
import { MONSTERS_CH1_5 } from './monstersDataCh1to5';
import { MONSTERS_CH6 } from './monstersDataCh6';
import {
  MONSTERS_CH7,
  SKIN_DATA as _SKIN_DATA,
  TRIBE_TOTALS as _TRIBE_TOTALS,
} from './monstersDataCh7andExtras';
import { MONSTERS_CH8 } from './monstersDataCh8';
import { MONSTERS_CH9 } from './monstersDataCh9';

// ─── Assembled lookup ─────────────────────────────────────────────────────────

export const MONSTER_DEFS: Record<MonsterId, MonsterDef> = {
  ...MONSTERS_CH1_5,
  ...MONSTERS_CH6,
  ...MONSTERS_CH7,
  ...MONSTERS_CH8,
  ...MONSTERS_CH9,
} as Record<MonsterId, MonsterDef>;

// ─── Re-export data constants ────────────────────────────────────────────────

export const SKIN_DATA = _SKIN_DATA;
export const TRIBE_TOTALS = _TRIBE_TOTALS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { ElementId } from './monstersTypes';
import type { RoomType } from './rooms';

/** Resolves an owned monster ID to its exact or longest delimited base type. */
export function resolveMonsterTypeId(monsterId: string): MonsterId | null {
  if (!monsterId) return null;
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

// ─── Monster def resolver (MONSTER_DEFS → HYBRID_DEFS fallback) ──────────────

import { HYBRID_DEFS } from './fusion';

export type CombatMonsterDef = {
  baseDamage: number;
  passive?: string;
  type?: string;
  tribe?: string;
  range: number;
  attackCooldown: number;
};

export function resolveMonsterDef(id: string | undefined): CombatMonsterDef | null {
  if (!id) return null;
  const md = MONSTER_DEFS[id as MonsterId];
  if (md) return md as CombatMonsterDef;
  const hd = HYBRID_DEFS[id];
  if (!hd) return null;
  const isMagic = hd.roomTypes.includes('scroll_library') || hd.roomTypes.includes('celestial_shrine');
  return {
    baseDamage: hd.baseDamage,
    passive:    hd.passive,
    type:       isMagic ? 'magic' : 'melee',
    tribe:      undefined,
    range:      isMagic ? 2 : 1,
    attackCooldown: 0,
  };
}
