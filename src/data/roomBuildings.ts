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

/**
 * Family defaults are always buildable so a fresh dungeon can field every
 * role; the other buildings open with the chapter that introduces them.
 */
export function isRoomBuildingUnlocked(
  building: RoomType,
  state: Readonly<Pick<GameState, 'stageProgress'>>,
): boolean {
  const def = ROOM_DEFS[building];
  if (!def) return false;
  if (FAMILY_DEFAULT_ROOM[ROOM_FAMILY[building]] === building) return true;
  if (def.chapter === undefined) return true;
  return def.chapter <= getHighestUnlockedChapter(state);
}

/** Buildings the player may pick right now, grouped in family order. */
export function listUnlockedBuildings(state: Readonly<Pick<GameState, 'stageProgress'>>): RoomType[] {
  const all = Object.keys(ROOM_DEFS) as RoomType[];
  return ROOM_FAMILY_ORDER.flatMap(family => all.filter(type => (
    ROOM_FAMILY[type] === family && isRoomBuildingUnlocked(type, state)
  )));
}
