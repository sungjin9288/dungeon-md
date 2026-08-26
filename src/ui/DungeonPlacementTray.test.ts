import { describe, expect, it } from 'vitest';
import { getPlacementTrayOpeningTab, type PlacementTrayTab } from './DungeonPlacementTrayState';

describe('DungeonPlacementTray — opening tab', () => {
  it.each<PlacementTrayTab>(['type', 'monster', 'trap'])(
    'opens an unbuilt room on the design tab from %s',
    currentTab => {
      expect(getPlacementTrayOpeningTab(currentTab, undefined)).toBe('type');
      expect(getPlacementTrayOpeningTab(currentTab, { roomType: undefined })).toBe('type');
    },
  );

  it.each<PlacementTrayTab>(['type', 'monster', 'trap'])(
    'preserves the active %s tab for a built room',
    currentTab => {
      expect(getPlacementTrayOpeningTab(currentTab, { roomType: 'combat' })).toBe(currentTab);
    },
  );
});
