import type { DungeonSlot } from '../data/wisdom';

export type PlacementTrayTab = 'type' | 'monster' | 'trap';

/** An unbuilt room must present its required design choice before loadout tabs. */
export function getPlacementTrayOpeningTab(
  currentTab: PlacementTrayTab,
  slot: Pick<DungeonSlot, 'roomType'> | null | undefined,
): PlacementTrayTab {
  return slot?.roomType ? currentTab : 'type';
}
