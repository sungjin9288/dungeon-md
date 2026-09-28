import { describe, expect, it } from 'vitest';
import { startQuest } from './quests';
import {
  applyRoomSlotDamageSnapshot,
  applyRoomSlotHpSnapshotToState,
  assignMonsterToRoomSlot,
  changeRoomSlotType,
  createDefaultDungeonSlot,
  setRoomSlotBuilding,
  ensureDungeonSlot,
  getRoomRepairCost,
  installTrapInRoomSlot,
  normalizeDungeonSlot,
  removeMonsterFromRoomSlot,
  removeTrapFromRoomSlot,
  repairRoomSlot,
  upgradeRoomSlot,
} from './roomSlotTransactions';
import type { DungeonSlot, GameState } from './wisdom';

function makeSlot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    monsterIds: [undefined],
    trapIds: [undefined],
    roomLevel: 1,
    hp: 200,
    maxHp: 200,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 500,
    dmLevel: 20,
    dungeonSlots: [],
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

describe('roomSlotTransactions — slot shape', () => {
  it('creates a default level 1 slot with normalized capacity', () => {
    expect(createDefaultDungeonSlot()).toEqual({
      roomType: undefined,
      monsterIds: [undefined],
      trapIds: [undefined],
      roomLevel: 1,
      hp: 200,
      maxHp: 200,
    });
  });

  it('normalizes capacity when type changes', () => {
    const slot = makeSlot({ roomLevel: 2, monsterIds: ['a', 'b', 'extra'], trapIds: ['t1'] });

    expect(normalizeDungeonSlot({ ...slot, roomType: 'combat' }).monsterIds).toEqual(['a', 'b', 'extra']);
    expect(normalizeDungeonSlot({ ...slot, roomType: 'trap' }).trapIds).toEqual(['t1', undefined]);
  });

  it('ensures a missing slot and advances build_room quest progress', () => {
    const state = startQuest(makeState(), 'MQ-001');

    const result = ensureDungeonSlot(state, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.dungeonSlots[0]).toEqual(createDefaultDungeonSlot());
    expect(result.state.questProgress['MQ-001'].objectives.O1).toBe(1);
    expect(state.dungeonSlots).toEqual([]);
  });

  it('returns unchanged state when ensuring an existing slot', () => {
    const slot = makeSlot();
    const state = makeState({ dungeonSlots: [slot] });

    const result = ensureDungeonSlot(state, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('changes room type and resizes slot arrays immutably', () => {
    const slot = makeSlot({ roomLevel: 1, monsterIds: ['m1'], trapIds: ['t1'] });
    const state = makeState({ dungeonSlots: [slot] });

    const result = changeRoomSlotType(state, 0, 'combat');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.roomType).toBe('combat');
    expect(result.slot.monsterIds).toEqual(['m1', undefined]);
    expect(result.slot.trapIds).toEqual(['t1']);
    expect(state.dungeonSlots[0].monsterIds).toEqual(['m1']);
  });

  it('gives a fresh design its family default building and records it as built', () => {
    const slot = makeSlot({ roomType: undefined, roomLevel: 0, hp: 0, maxHp: 0, monsterIds: [], trapIds: [] });
    const state = makeState({ dungeonSlots: [slot] });

    const result = changeRoomSlotType(state, 0, 'combat');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.building).toBe('guardian');
    expect(result.state.roomsBuilt).toEqual(['guardian']);
    expect(state.roomsBuilt ?? []).toEqual([]);
  });

  it('keeps a building across a family change only when it belongs to the new family', () => {
    const slot = makeSlot({ roomType: 'combat', building: 'tower', roomLevel: 2 });
    const state = makeState({ dungeonSlots: [slot], roomsBuilt: ['tower'] });

    const sameFamily = changeRoomSlotType(state, 0, 'combat');
    expect(sameFamily.ok && sameFamily.slot.building).toBe('tower');

    const otherFamily = changeRoomSlotType(state, 0, 'magic');
    expect(otherFamily.ok && otherFamily.slot.building).toBe('scroll_library');
    // an already-built room changing role is not a new building
    expect(otherFamily.ok && otherFamily.state.roomsBuilt).toEqual(['tower']);
  });

  it('setRoomSlotBuilding syncs the family to the building and refuses locked buildings', () => {
    const slot = makeSlot({ roomType: 'combat', roomLevel: 1 });
    const state = makeState({ dungeonSlots: [slot] });

    const tower = setRoomSlotBuilding(state, 0, 'tower');
    expect(tower.ok).toBe(true);
    if (!tower.ok) return;
    expect(tower.slot.building).toBe('tower');
    expect(tower.slot.roomType).toBe('combat');

    const altar = setRoomSlotBuilding(state, 0, 'spirit_altar');
    expect(altar.ok).toBe(false);
    if (altar.ok) return;
    expect(altar.reason).toBe('building_locked');
    expect(altar.state).toBe(state);

    const library = setRoomSlotBuilding(state, 0, 'scroll_library');
    expect(library.ok && library.slot.roomType).toBe('magic');
  });

  it('initializes a first-time room design as a healthy level 1 room', () => {
    const slot = makeSlot({
      roomType: undefined,
      roomLevel: 0,
      hp: 0,
      maxHp: 0,
      monsterIds: [],
      trapIds: [],
    });
    const state = makeState({ dungeonSlots: [slot] });

    const result = changeRoomSlotType(state, 0, 'trap');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.roomType).toBe('trap');
    expect(result.slot.roomLevel).toBe(1);
    expect(result.slot.hp).toBe(200);
    expect(result.slot.maxHp).toBe(200);
    expect(result.slot.monsterIds).toEqual([undefined]);
    expect(result.slot.trapIds).toEqual([undefined, undefined]);
  });
});

describe('roomSlotTransactions — durability snapshots', () => {
  it('reduces persistent damage once with the strongest room armor and then rounds up', () => {
    const armored = makeSlot({ hp: 100, maxHp: 100, monsterIds: ['primary', 'extra'] });
    const empty = makeSlot({ hp: 100, maxHp: 100 });
    const equipment = new Map([
      ['primary', { dmgReduction: 0.15 }],
      ['extra', { dmgReduction: 0.30 }],
    ]);
    const result = applyRoomSlotDamageSnapshot([armored, empty], 0.05, equipment);
    expect(result.map(slot => slot?.hp)).toEqual([96, 95]);
    expect(armored.hp).toBe(100);
    expect(empty.hp).toBe(100);
  });

  it('applies damage to a cloned slot snapshot without mutating runtime input', () => {
    const slot = makeSlot({ hp: 100, maxHp: 100 });

    const result = applyRoomSlotDamageSnapshot([slot], 0.333);

    expect(result[0]?.hp).toBe(66);
    expect(result[0]).not.toBe(slot);
    expect(slot.hp).toBe(100);
  });

  it('skips nullish runtime slots while damaging valid slots', () => {
    const slot = makeSlot({ hp: 80, maxHp: 100 });

    const result = applyRoomSlotDamageSnapshot([null, slot, undefined], 0.25);

    expect(result[0]).toBeNull();
    expect(result[1]?.hp).toBe(55);
    expect(result[2]).toBeUndefined();
  });

  it('merges a runtime HP snapshot into GameState while preserving slot metadata', () => {
    const state = makeState({
      homeGold: 999,
      dungeonSlots: [
        makeSlot({ hp: 100, maxHp: 100, roomLevel: 3, monsterIds: ['m1'], trapIds: ['t1'] }),
      ],
    });

    const result = applyRoomSlotHpSnapshotToState(state, [makeSlot({ hp: 45, maxHp: 100 })]);

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.homeGold).toBe(999);
    expect(result.state.dungeonSlots[0]).toEqual({
      ...state.dungeonSlots[0],
      hp: 45,
      maxHp: 100,
    });
    expect(state.dungeonSlots[0].hp).toBe(100);
  });

  it('returns unchanged state for an empty runtime snapshot', () => {
    const state = makeState({ dungeonSlots: [makeSlot({ hp: 100 })] });

    const result = applyRoomSlotHpSnapshotToState(state, []);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });
});

describe('roomSlotTransactions — repair and upgrade', () => {
  it('calculates repair cost from missing HP', () => {
    expect(getRoomRepairCost(makeSlot({ hp: 100, maxHp: 200 }))).toBe(40);
    expect(getRoomRepairCost(makeSlot({ hp: 195, maxHp: 200 }))).toBe(10);
    expect(getRoomRepairCost(makeSlot({ hp: 200, maxHp: 200 }))).toBe(0);
  });

  it('repairs a damaged room and deducts gold', () => {
    const state = makeState({ homeGold: 100, dungeonSlots: [makeSlot({ hp: 100, maxHp: 200 })] });

    const result = repairRoomSlot(state, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(40);
    expect(result.state.homeGold).toBe(60);
    expect(result.slot.hp).toBe(200);
    expect(state.dungeonSlots[0].hp).toBe(100);
  });

  it('fails repair without enough gold', () => {
    const state = makeState({ homeGold: 20, dungeonSlots: [makeSlot({ hp: 100, maxHp: 200 })] });

    const result = repairRoomSlot(state, 0);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gold');
    expect(result.state).toBe(state);
  });

  it('upgrades a room, resizes capacity, deducts gold, and ticks upgrade quest', () => {
    const state = startQuest(makeState({
      homeGold: 500,
      dmLevel: 5,
      dungeonSlots: [makeSlot({ roomLevel: 1, hp: 100, maxHp: 200, monsterIds: ['m1'], trapIds: ['t1'] })],
    }), 'MQ-007');

    const result = upgradeRoomSlot(state, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(150);
    expect(result.previousLevel).toBe(1);
    expect(result.nextLevel).toBe(2);
    expect(result.state.homeGold).toBe(350);
    expect(result.slot.roomLevel).toBe(2);
    expect(result.slot.hp).toBe(450);
    expect(result.slot.maxHp).toBe(450);
    expect(result.slot.monsterIds).toEqual(['m1', undefined]);
    expect(result.state.questProgress['MQ-007'].objectives.O1).toBe(1);
  });

  it('blocks upgrade at DM level cap', () => {
    const state = makeState({ dmLevel: 1, dungeonSlots: [makeSlot({ roomLevel: 1 })] });

    const result = upgradeRoomSlot(state, 0);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('room_level_cap_reached');
  });
});

describe('roomSlotTransactions — monster assignment', () => {
  it('assigns a monster and clears its previous room slot', () => {
    const state = makeState({
      dungeonSlots: [
        makeSlot({ monsterIds: ['dokkaebi_warrior'] }),
        makeSlot({ roomLevel: 2, monsterIds: [undefined, undefined] }),
      ],
    });

    const result = assignMonsterToRoomSlot(state, 1, 1, 'dokkaebi_warrior');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.dungeonSlots[0].monsterIds).toEqual([undefined]);
    expect(result.state.dungeonSlots[1].monsterIds).toEqual([undefined, 'dokkaebi_warrior']);
    expect(state.dungeonSlots[0].monsterIds).toEqual(['dokkaebi_warrior']);
  });

  it('removes a monster from a slot', () => {
    const state = makeState({ dungeonSlots: [makeSlot({ monsterIds: ['m1'] })] });

    const result = removeMonsterFromRoomSlot(state, 0, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.monsterIds).toEqual([undefined]);
    expect(state.dungeonSlots[0].monsterIds).toEqual(['m1']);
  });

  it('ticks the assign_monster quest objective on a NET-NEW placement (regression: MQ-002 never progressed at home)', () => {
    // MQ-002 objective O1 = assign_monster target 1
    const started = startQuest(makeState({
      dungeonSlots: [makeSlot({ monsterIds: [undefined] })],
    }), 'MQ-002');

    const result = assignMonsterToRoomSlot(started, 0, 0, 'dokkaebi_warrior');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.questProgress['MQ-002'].objectives.O1).toBe(1);
  });

  it('does NOT tick assign_monster when moving an already-placed monster between slots', () => {
    // MQ-027 O2 = assign_monster target 3. One monster placed at quest start
    // → auto-met to 1. Moving that same monster must NOT raise it to 2.
    const started = startQuest(makeState({
      dungeonSlots: [
        makeSlot({ monsterIds: ['dokkaebi_warrior'] }),
        makeSlot({ roomLevel: 2, monsterIds: [undefined, undefined] }),
      ],
    }), 'MQ-027');
    expect(started.questProgress['MQ-027'].objectives.O2).toBe(1); // auto-met baseline

    const result = assignMonsterToRoomSlot(started, 1, 0, 'dokkaebi_warrior');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.questProgress['MQ-027'].objectives.O2).toBe(1); // unchanged
    expect(result.state.dungeonSlots[1].monsterIds).toEqual(['dokkaebi_warrior', undefined]);
  });

  it('startQuest auto-mets assign_monster and build_room from existing dungeon state', () => {
    const started = startQuest(makeState({
      dungeonSlots: [makeSlot({ monsterIds: ['m1'] }), makeSlot({ monsterIds: [undefined] })],
    }), 'MQ-002');

    expect(started.questProgress['MQ-002'].objectives.O1).toBe(1);
  });
});

describe('roomSlotTransactions — traps', () => {
  it('installs a trap, charging cost and refunding replaced trap', () => {
    const state = makeState({
      homeGold: 200,
      dungeonSlots: [makeSlot({ trapIds: ['spike_trap'] })],
    });

    const result = installTrapInRoomSlot(state, 0, 0, 'slow_trap');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(80);
    expect(result.refund).toBe(25);
    expect(result.state.homeGold).toBe(145);
    expect(result.slot.trapIds).toEqual(['slow_trap']);
    expect(state.dungeonSlots[0].trapIds).toEqual(['spike_trap']);
  });

  it('requires full trap cost before applying replacement refund', () => {
    const state = makeState({
      homeGold: 60,
      dungeonSlots: [makeSlot({ trapIds: ['spike_trap'] })],
    });

    const result = installTrapInRoomSlot(state, 0, 0, 'slow_trap');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gold');
    expect(result.state).toBe(state);
  });

  it('removes a trap and refunds half of its cost', () => {
    const state = makeState({
      homeGold: 100,
      dungeonSlots: [makeSlot({ trapIds: ['slow_trap'] })],
    });

    const result = removeTrapFromRoomSlot(state, 0, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refund).toBe(40);
    expect(result.state.homeGold).toBe(140);
    expect(result.slot.trapIds).toEqual([undefined]);
    expect(state.dungeonSlots[0].trapIds).toEqual(['slow_trap']);
  });
});
