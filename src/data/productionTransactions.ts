/**
 * GameState-level transactions for 생산 시설 (production facilities) — building
 * and upgrading. Immutable: every op returns a new GameState. Pure (no Phaser).
 */

import type { GameState } from './wisdom';
import { FACILITY_DEFS, facilityStaffMult, facilityUpgradeCost } from './production';
import { normalizeDungeonSlot } from './roomSlotTransactions';
import { collectIdleIncome, type IdleReward } from './idleIncome';

export type FacilityBuildResult =
  | { ok: true; state: GameState; spent: number; newLevel: number; idleReward: IdleReward }
  | { ok: false; reason: 'unknown' | 'maxed' | 'no_gold' };

/**
 * Build or upgrade a facility one level, spending gold. Validates the facility
 * exists, isn't maxed, and spendable gold covers the cost. Settle the preceding
 * interval before changing its rate; the caller persists both in one write.
 */
export function buildOrUpgradeFacility(state: Readonly<GameState>, facilityId: string, timestamp: number): FacilityBuildResult {
  const def = FACILITY_DEFS[facilityId];
  if (!def) return { ok: false, reason: 'unknown' };

  const current = state.productionFacilities?.[facilityId] ?? 0;
  const cost = facilityUpgradeCost(def, current);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (state.homeGold < cost) return { ok: false, reason: 'no_gold' };

  const settled = collectIdleIncome(state, timestamp);
  const newLevel = current + 1;
  return {
    ok: true,
    spent: cost,
    newLevel,
    idleReward: settled.reward,
    state: {
      ...settled.state,
      homeGold: settled.state.homeGold - cost,
      productionFacilities: { ...(state.productionFacilities ?? {}), [facilityId]: newLevel },
    },
  };
}

export type FacilityStaffResult =
  | { ok: true; state: GameState; staffMult: number; movedFromRoom: boolean; movedFromFacility: string | null; idleReward: IdleReward }
  | { ok: false; reason: 'unknown' | 'not_built' | 'not_owned' | 'not_staffed' };

/** Which facility a monster is on shift at, if any. */
export function findStaffedFacility(state: Readonly<Pick<GameState, 'facilityStaff'>>, monsterId: string): string | null {
  for (const [facilityId, staffed] of Object.entries(state.facilityStaff ?? {})) if (staffed === monsterId) return facilityId;
  return null;
}

export function isMonsterOnShift(state: Readonly<Pick<GameState, 'facilityStaff'>>, monsterId: string): boolean {
  return findStaffedFacility(state, monsterId) !== null;
}

/** All monster ids currently on shift — they sit out home defense. */
export function staffedMonsterIds(state: Readonly<Pick<GameState, 'facilityStaff'>>): ReadonlySet<string> {
  return new Set(Object.values(state.facilityStaff ?? {}).filter(id => typeof id === 'string' && id.length > 0));
}

/**
 * Put a monster on shift at a built facility. A guardian is either on shift or
 * in a room, never both: it leaves its room and any other facility it worked.
 */
export function assignFacilityStaff(state: Readonly<GameState>, facilityId: string, monsterId: string, timestamp: number): FacilityStaffResult {
  if (!FACILITY_DEFS[facilityId]) return { ok: false, reason: 'unknown' };
  if ((state.productionFacilities?.[facilityId] ?? 0) <= 0) return { ok: false, reason: 'not_built' };
  if (!(state.ownedMonsters ?? []).some(monster => monster.id === monsterId)) return { ok: false, reason: 'not_owned' };

  const settled = collectIdleIncome(state, timestamp);
  let movedFromRoom = false;
  const dungeonSlots = (state.dungeonSlots ?? []).map(slot => {
    if (!slot) return slot;
    const idx = (slot.monsterIds ?? []).indexOf(monsterId);
    if (idx === -1) return slot;
    movedFromRoom = true;
    const monsterIds = [...(slot.monsterIds ?? [])];
    monsterIds[idx] = undefined;
    return normalizeDungeonSlot({ ...slot, monsterIds });
  });

  const movedFromFacility = findStaffedFacility(state, monsterId);
  const facilityStaff: Record<string, string> = {};
  for (const [id, staffed] of Object.entries(state.facilityStaff ?? {})) if (staffed !== monsterId && id !== facilityId) facilityStaff[id] = staffed;
  facilityStaff[facilityId] = monsterId;

  return {
    ok: true,
    idleReward: settled.reward,
    staffMult: facilityStaffMult(facilityId, monsterId),
    movedFromRoom,
    movedFromFacility: movedFromFacility === facilityId ? null : movedFromFacility,
    state: { ...settled.state, dungeonSlots, facilityStaff },
  };
}

/** Take the monster off shift at `facilityId`; it returns to the free roster. */
export function clearFacilityStaff(state: Readonly<GameState>, facilityId: string, timestamp: number): FacilityStaffResult {
  if (!FACILITY_DEFS[facilityId]) return { ok: false, reason: 'unknown' };
  const monsterId = state.facilityStaff?.[facilityId];
  if (!monsterId) return { ok: false, reason: 'not_staffed' };
  const settled = collectIdleIncome(state, timestamp);
  const facilityStaff = { ...(state.facilityStaff ?? {}) };
  delete facilityStaff[facilityId];
  return { ok: true, idleReward: settled.reward, staffMult: 1, movedFromRoom: false, movedFromFacility: null, state: { ...settled.state, facilityStaff } };
}
