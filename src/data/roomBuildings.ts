// ─── Room buildings ───────────────────────────────────────────────────────────
// Resolves which concrete room a home slot deploys and which buildings the
// player may currently pick. Pure: no scene or save access.

import { ALL_STAGES } from './allStages';
import { FAMILY_DEFAULT_ROOM, ROOM_DEFS, ROOM_FAMILY, ROOM_FAMILY_ORDER, type RoomType } from './rooms';
import type { DungeonSlot, GameState } from './wisdom';

/** The room a slot fights as: its chosen building, else its family's default. */
export function getSlotBuilding(slot: Readonly<Pick<DungeonSlot, 'roomType' | 'building'>>): RoomType | null {
  if (slot.building && ROOM_DEFS[slot.building]) return slot.building;
  return slot.roomType ? FAMILY_DEFAULT_ROOM[slot.roomType] : null;
}

/** Display name for the slot's building; the family name when it is the default. */
export function getSlotBuildingName(
  slot: Readonly<Pick<DungeonSlot, 'roomType' | 'building'>>,
  familyName: string,
): string {
  const building = getSlotBuilding(slot);
  if (!building || !slot.roomType) return familyName;
  return building === FAMILY_DEFAULT_ROOM[slot.roomType] ? familyName : ROOM_DEFS[building].koreanName;
}

/** Highest campaign chapter the player has reached (a stage in it is unlocked). */
export function getHighestUnlockedChapter(state: Readonly<Pick<GameState, 'stageProgress'>>): number {
  let highest = 1;
  (state.stageProgress ?? []).forEach((entry, index) => {
    if (!entry?.unlocked) return;
    const chapter = ALL_STAGES[index]?.chapter ?? 1;
    if (chapter > highest) highest = chapter;
  });
  return highest;
}

/** 보석 특전 ②: 보석으로 한 번 사면 영구히 지을 수 있는 특수 방과 그 값. 챕터 해금과 무관하다. */
export const PREMIUM_BUILDING_GEMS: Readonly<Partial<Record<RoomType, number>>> = {
  grand_vault: 300,
  elite_den: 300,
};

export function isPremiumBuilding(building: RoomType): boolean {
  return PREMIUM_BUILDING_GEMS[building] !== undefined;
}

type UnlockState = Readonly<Pick<GameState, 'stageProgress'> & Partial<Pick<GameState, 'premiumBuildings'>>>;

/**
 * Family defaults are always buildable so a fresh dungeon can field every
 * role; the other buildings open with the chapter that introduces them.
 * Gem special rooms open only once bought (`premiumBuildings`).
 */
export function isRoomBuildingUnlocked(
  building: RoomType,
  state: UnlockState,
): boolean {
  const def = ROOM_DEFS[building];
  if (!def) return false;
  if (isPremiumBuilding(building)) return (state.premiumBuildings ?? []).includes(building);
  if (FAMILY_DEFAULT_ROOM[ROOM_FAMILY[building]] === building) return true;
  if (def.chapter === undefined) return true;
  return def.chapter <= getHighestUnlockedChapter(state);
}

/** Buildings the player may pick right now, grouped in family order. */
export function listUnlockedBuildings(state: UnlockState): RoomType[] {
  const all = Object.keys(ROOM_DEFS) as RoomType[];
  return ROOM_FAMILY_ORDER.flatMap(family => all.filter(type => (
    ROOM_FAMILY[type] === family && isRoomBuildingUnlocked(type, state)
  )));
}

/** 아직 사지 않은 보석 특수 방(가족 순서) — 설계 목록에 잠긴 칸으로 보여준다. */
export function listLockedPremiumBuildings(state: UnlockState): RoomType[] {
  const all = Object.keys(ROOM_DEFS) as RoomType[];
  return ROOM_FAMILY_ORDER.flatMap(family => all.filter(type => (
    ROOM_FAMILY[type] === family && isPremiumBuilding(type) && !isRoomBuildingUnlocked(type, state)
  )));
}

export type PremiumPurchaseResult =
  | { readonly ok: true; readonly state: GameState; readonly cost: number }
  | { readonly ok: false; readonly state: GameState; readonly reason: 'not_premium' | 'owned' | 'insufficient_gems' };

/** 보석으로 특수 방을 영구 해금한다. 순수 — 저장은 호출 쪽. 거절하면 입력 상태 그대로. */
export function purchasePremiumBuilding(state: GameState, building: RoomType): PremiumPurchaseResult {
  const price = PREMIUM_BUILDING_GEMS[building];
  if (price === undefined) return { ok: false, state, reason: 'not_premium' };
  const owned = state.premiumBuildings ?? [];
  if (owned.includes(building)) return { ok: false, state, reason: 'owned' };
  if ((state.gems ?? 0) < price) return { ok: false, state, reason: 'insufficient_gems' };
  return {
    ok: true,
    cost: price,
    state: { ...state, gems: (state.gems ?? 0) - price, premiumBuildings: [...owned, building] },
  };
}
