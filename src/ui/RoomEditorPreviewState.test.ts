import { afterEach, describe, expect, it } from 'vitest';
import { assignMonsterToRoomSlot, removeMonsterFromRoomSlot } from '../data/roomSlotTransactions';
import { loadGameState, saveGameState, type DungeonSlot, type GameState } from '../data/wisdom';
import {
  deriveRoomEditorPreviewState,
  getRoomEditorPreviewLayout,
  hasNonOverlappingRoomEditorPreviewHitZones,
  ROOM_EDITOR_PREVIEW_HIT_SIZE,
} from './RoomEditorPreviewState';

function makeSlot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType: 'combat',
    roomLevel: 1,
    hp: 200,
    maxHp: 200,
    monsterIds: [undefined, undefined],
    trapIds: [undefined],
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 500,
    dmLevel: 20,
    dungeonSlots: [],
    ownedMonsters: [],
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

function ownedMonster(id: string, equipment: string | null = null) {
  return {
    id,
    level: 1,
    xp: 0,
    skillPoints: 0,
    spentSkills: {},
    equippedSkills: [],
    equipment,
  };
}

describe('RoomEditorPreviewState', () => {
  afterEach(() => localStorage.clear());

  it('derives a deterministic, capacity-bounded projection without mutating GameState', () => {
    const slot = makeSlot({
      roomLevel: 1,
      monsterIds: ['m1', 'ignored'],
      trapIds: ['spike_trap', 'ignored'],
    });
    const state = makeState({
      dungeonSlots: [slot],
      ownedMonsters: [ownedMonster('m1', 'dokkaebi_club')],
    });
    const before = structuredClone(state);

    const first = deriveRoomEditorPreviewState(state, slot, 'growth');
    const second = deriveRoomEditorPreviewState(state, slot, 'growth');

    expect(first).toEqual(second);
    expect(first.capacity).toEqual({ monsters: 2, traps: 1 });
    expect(first.monsters).toHaveLength(2);
    expect(first.traps).toHaveLength(1);
    expect(first.equipment).toHaveLength(2);
    expect(first.monsters[1]).toMatchObject({ monsterId: 'ignored', hasOwnedMetadata: false });
    expect(state).toEqual(before);
  });

  it('marks only the first matching empty socket as the next target in a partial room', () => {
    const slot = makeSlot({
      roomLevel: 2,
      monsterIds: ['m1', undefined, undefined],
      trapIds: [undefined],
    });
    const state = makeState({ ownedMonsters: [ownedMonster('m1')] });

    const projection = deriveRoomEditorPreviewState(state, slot, 'monster');
    const targetSockets = [...projection.monsters, ...projection.traps, ...projection.equipment]
      .filter(socket => socket.state === 'target');

    expect(projection.nextTarget).toEqual({ kind: 'monster', slotIndex: 1 });
    expect(targetSockets).toEqual([expect.objectContaining({ kind: 'monster', slotIndex: 1 })]);
    expect(projection.monsters[2]).toMatchObject({ state: 'available' });
    expect(projection.equipment[0]).toMatchObject({ state: 'available' });
    expect(deriveRoomEditorPreviewState(state, slot, 'growth').equipment[0])
      .toMatchObject({ state: 'target', monsterId: 'm1' });
  });

  it('does not expose false targets for a full room or a directive mismatch', () => {
    const slot = makeSlot({
      roomLevel: 1,
      monsterIds: ['m1', 'm2'],
      trapIds: ['spike_trap'],
    });
    const state = makeState({
      ownedMonsters: [ownedMonster('m1', 'dokkaebi_club'), ownedMonster('m2', 'golden_armor')],
    });

    expect(deriveRoomEditorPreviewState(state, slot, 'monster').nextTarget).toBeNull();
    expect(deriveRoomEditorPreviewState(state, slot, 'trap').nextTarget).toBeNull();
    expect(deriveRoomEditorPreviewState(state, slot, 'growth').nextTarget).toBeNull();

    const partial = makeSlot({ monsterIds: ['m1', undefined], trapIds: [undefined] });
    const mismatched = deriveRoomEditorPreviewState(state, partial, 'trap');
    expect(mismatched.nextTarget).toEqual({ kind: 'trap', slotIndex: 0 });
    expect(mismatched.monsters.every(socket => socket.state !== 'target')).toBe(true);
    expect(deriveRoomEditorPreviewState(state, partial, 'none').nextTarget).toBeNull();
  });

  it('keeps equipment disabled when assigned monster metadata is missing or legacy', () => {
    const slot = makeSlot({ monsterIds: ['legacy-monster', undefined] });
    const state = makeState({ ownedMonsters: undefined as unknown as GameState['ownedMonsters'] });

    const projection = deriveRoomEditorPreviewState(state, slot, 'growth');
    const layout = getRoomEditorPreviewLayout(projection, {
      chamberX: 26,
      chamberY: 88,
      chamberWidth: 338,
      chamberHeight: 226,
    });

    expect(projection.monsters[0]).toMatchObject({ state: 'assigned', hasOwnedMetadata: false });
    expect(projection.equipment[0]).toMatchObject({ state: 'disabled', monsterId: 'legacy-monster' });
    expect(projection.nextTarget).toBeNull();
    expect(layout.hitZones.some(zone => zone.action === 'forge' && zone.slotIndex === 0)).toBe(false);
  });

  it('uses non-overlapping 44px preview hit zones for every maximum-capacity room shape', () => {
    const cases = [
      makeSlot({
        roomType: 'combat',
        roomLevel: 5,
        monsterIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
        trapIds: ['spike_trap', 'slow_trap', 'poison_trap'],
      }),
      makeSlot({
        roomType: 'trap',
        roomLevel: 5,
        monsterIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
        trapIds: ['spike_trap', 'slow_trap', 'poison_trap', 'stun_trap'],
      }),
    ];
    const state = makeState({
      ownedMonsters: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map(id => ownedMonster(id)),
    });

    const layouts = cases.map(slot => getRoomEditorPreviewLayout(deriveRoomEditorPreviewState(state, slot), {
      chamberX: 26,
      chamberY: 88,
      chamberWidth: 338,
      chamberHeight: 226,
    }));

    expect(layouts[0].hitZones).toHaveLength(15);
    expect(layouts[1].hitZones).toHaveLength(14);
    layouts.forEach(layout => {
      expect(layout.hitZones.every(zone =>
        zone.width === ROOM_EDITOR_PREVIEW_HIT_SIZE && zone.height === ROOM_EDITOR_PREVIEW_HIT_SIZE,
      )).toBe(true);
      expect(layout.hitZones.map(zone => zone.action)).toEqual(expect.arrayContaining([
        'trap-picker', 'monster-growth', 'forge',
      ]));
      expect(hasNonOverlappingRoomEditorPreviewHitZones(layout.hitZones)).toBe(true);
      expect(layout.hitZones.every(zone =>
        zone.x - zone.width / 2 >= 26 &&
        zone.x + zone.width / 2 <= 26 + 338 &&
        zone.y - zone.height / 2 >= 88 &&
        zone.y + zone.height / 2 <= 88 + 226,
      )).toBe(true);
    });
  });

  it('persists and restores next targets through immutable assignment and removal transactions', () => {
    const state = makeState({
      dungeonSlots: [makeSlot({ roomLevel: 2, monsterIds: ['m1', undefined, undefined] })],
      ownedMonsters: [ownedMonster('m1'), ownedMonster('m2')],
    });
    const initial = deriveRoomEditorPreviewState(state, state.dungeonSlots[0], 'monster');
    const assigned = assignMonsterToRoomSlot(state, 0, 1, 'm2');

    expect(initial.nextTarget).toEqual({ kind: 'monster', slotIndex: 1 });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    saveGameState(assigned.state);
    const assignedReloaded = loadGameState();
    expect(deriveRoomEditorPreviewState(assignedReloaded, assignedReloaded.dungeonSlots[0], 'monster').nextTarget)
      .toEqual({ kind: 'monster', slotIndex: 2 });

    const removed = removeMonsterFromRoomSlot(assignedReloaded, 0, 1);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    saveGameState(removed.state);
    const removedReloaded = loadGameState();
    expect(deriveRoomEditorPreviewState(removedReloaded, removedReloaded.dungeonSlots[0], 'monster').nextTarget)
      .toEqual({ kind: 'monster', slotIndex: 1 });
    expect(state.dungeonSlots[0].monsterIds).toEqual(['m1', undefined, undefined]);
  });
});
