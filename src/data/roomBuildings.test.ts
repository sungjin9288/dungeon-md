import { describe, expect, it } from 'vitest';
import { FAMILY_DEFAULT_ROOM, ROOM_DEFS, ROOM_FAMILY, type RoomType } from './rooms';
import {
  getHighestUnlockedChapter,
  getSlotBuilding,
  getSlotBuildingName,
  isRoomBuildingUnlocked,
  listUnlockedBuildings,
} from './roomBuildings';
import { loadGameState, type GameState } from './wisdom';

function stateReaching(chapter: number): GameState {
  // Unlock the first stage of every chapter up to `chapter` (ids: ch1=1, ch2=11, ch3=21, ...).
  const state = loadGameState();
  const firstStageOf = [1, 11, 21, 33, 43, 53, 63, 73, 81];
  const stageProgress = state.stageProgress.map((entry, index) => ({
    ...entry,
    unlocked: firstStageOf.slice(0, chapter).includes(index + 1),
  }));
  return { ...state, stageProgress };
}

describe('room families', () => {
  it('assigns every combat room to exactly one family and every family a default it owns', () => {
    const types = Object.keys(ROOM_DEFS) as RoomType[];
    expect(types.every(type => ROOM_FAMILY[type] !== undefined)).toBe(true);
    for (const [family, building] of Object.entries(FAMILY_DEFAULT_ROOM)) {
      expect(ROOM_FAMILY[building]).toBe(family);
    }
  });
});

describe('getSlotBuilding', () => {
  it('falls back to the family default when no building is chosen', () => {
    expect(getSlotBuilding({ roomType: 'combat' })).toBe('guardian');
    expect(getSlotBuilding({ roomType: 'magic' })).toBe('scroll_library');
    expect(getSlotBuilding({})).toBeNull();
  });

  it('prefers an explicit building and ignores unknown ids', () => {
    expect(getSlotBuilding({ roomType: 'combat', building: 'tower' })).toBe('tower');
    expect(getSlotBuilding({ roomType: 'combat', building: 'nope' as RoomType })).toBe('guardian');
  });

  it('names the family for the default building and the building otherwise', () => {
    expect(getSlotBuildingName({ roomType: 'combat' }, '전투실')).toBe('전투실');
    expect(getSlotBuildingName({ roomType: 'combat', building: 'tower' }, '전투실')).toBe('봉화 망루');
  });
});

describe('building unlocks follow the campaign', () => {
  it('reads the highest chapter with an unlocked stage', () => {
    expect(getHighestUnlockedChapter(stateReaching(1))).toBe(1);
    expect(getHighestUnlockedChapter(stateReaching(4))).toBe(4);
    expect(getHighestUnlockedChapter({ stageProgress: [] })).toBe(1);
  });

  it('keeps every family default and the chapter-less rooms open from the start', () => {
    const fresh = stateReaching(1);
    for (const building of Object.values(FAMILY_DEFAULT_ROOM)) {
      expect(isRoomBuildingUnlocked(building, fresh), building).toBe(true);
    }
    expect(isRoomBuildingUnlocked('gold', fresh)).toBe(true);
    expect(isRoomBuildingUnlocked('tower', fresh)).toBe(true);
  });

  it('opens chapter rooms only once that chapter is reached', () => {
    expect(isRoomBuildingUnlocked('void_forge', stateReaching(5))).toBe(false);
    expect(isRoomBuildingUnlocked('void_forge', stateReaching(6))).toBe(true);
    expect(isRoomBuildingUnlocked('spirit_altar', stateReaching(3))).toBe(false);
    expect(isRoomBuildingUnlocked('spirit_altar', stateReaching(4))).toBe(true);
  });

  it('lists unlocked buildings grouped in family order and grows with the campaign', () => {
    const early = listUnlockedBuildings(stateReaching(1));
    expect(early).toEqual(['guardian', 'tower', 'trap', 'gold', 'medicine_hall', 'scroll_library']);
    const late = listUnlockedBuildings(stateReaching(9));
    expect(late).toHaveLength(Object.keys(ROOM_DEFS).length);
    expect(late.map(type => ROOM_FAMILY[type])).toEqual([...late.map(type => ROOM_FAMILY[type])].sort(
      (a, b) => ['combat', 'trap', 'support', 'magic'].indexOf(a) - ['combat', 'trap', 'support', 'magic'].indexOf(b),
    ));
  });
});
