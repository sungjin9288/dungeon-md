import { describe, expect, it } from 'vitest';
import {
  calculateDungeonMetrics,
  calculateRoomLoadoutStatus,
  calculateRoomMetricDelta,
  calculateRoomMetrics,
} from './dungeonMetrics';
import type { DungeonSlot, GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ownedMonsters: [{
      id: 'dokkaebi_warrior',
      level: 1,
      xp: 0,
      skillPoints: 0,
      spentSkills: {},
      equippedSkills: [],
      equipment: null,
    }],
    dungeonSlots: [],
    ...overrides,
  } as GameState;
}

function makeSlot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType: 'combat',
    monsterIds: ['dokkaebi_warrior'],
    trapIds: ['spike_trap'],
    roomLevel: 2,
    hp: 450,
    maxHp: 450,
    ...overrides,
  };
}

describe('dungeonMetrics', () => {
  it('calculates room threat from monsters, traps, room type, and level', () => {
    const state = makeState();
    const metrics = calculateRoomMetrics(state, makeSlot());

    expect(metrics.monsterPower).toBe(20);
    expect(metrics.equipmentPower).toBe(0);
    expect(metrics.trapPower).toBe(20);
    expect(metrics.typeBonus).toBe(3);
    expect(metrics.levelBonus).toBe(4);
    expect(metrics.threatScore).toBe(47);
    expect(metrics.readiness).toBe(70);
    expect(metrics.lootPotential).toBe(4);
  });

  it('includes equipped monster gear in room threat and dungeon totals', () => {
    const state = makeState({
      ownedMonsters: [{
        id: 'dokkaebi_warrior',
        level: 1,
        xp: 0,
        skillPoints: 0,
        spentSkills: {},
        equippedSkills: [],
        equipment: 'eq_dokkaebi_club',
      }],
    });
    const baseMetrics = calculateRoomMetrics(makeState(), makeSlot());
    const equippedMetrics = calculateRoomMetrics(state, makeSlot());
    const dungeonMetrics = calculateDungeonMetrics({ ...state, dungeonSlots: [makeSlot()] }, 1);

    expect(equippedMetrics.equipmentPower).toBeGreaterThan(0);
    expect(equippedMetrics.threatScore).toBeGreaterThan(baseMetrics.threatScore);
    expect(dungeonMetrics.equipmentPower).toBe(equippedMetrics.equipmentPower);
  });

  it('reduces room threat when durability is damaged', () => {
    const state = makeState();
    const healthy = calculateRoomMetrics(state, makeSlot());
    const damaged = calculateRoomMetrics(state, makeSlot({ hp: 225 }));

    expect(damaged.durabilityFactor).toBe(0.5);
    expect(damaged.threatScore).toBeLessThan(healthy.threatScore);
  });

  it('aggregates visible dungeon rooms into one operational score', () => {
    const state = makeState({
      dungeonSlots: [
        makeSlot(),
        makeSlot({
          roomType: 'trap',
          monsterIds: [],
          trapIds: ['stun_trap'],
          roomLevel: 1,
          hp: 200,
          maxHp: 200,
        }),
        makeSlot({ roomType: undefined, monsterIds: [], trapIds: [] }),
      ],
    });

    const metrics = calculateDungeonMetrics(state, 2);

    expect(metrics.builtRooms).toBe(2);
    expect(metrics.assignedMonsters).toBe(1);
    expect(metrics.installedTraps).toBe(2);
    expect(metrics.threatScore).toBeGreaterThan(47);
    expect(metrics.lootPotential).toBeGreaterThan(4);
    expect(metrics.readiness).toBeGreaterThan(50);
  });

  it('reports metric deltas between current and preview room loadouts', () => {
    const state = makeState();
    const current = makeSlot({ monsterIds: [], trapIds: [] });
    const next = makeSlot({ monsterIds: ['dokkaebi_warrior'], trapIds: [] });

    const delta = calculateRoomMetricDelta(state, current, next);

    expect(delta.threatDelta).toBeGreaterThan(0);
    expect(delta.lootDelta).toBeGreaterThanOrEqual(0);
    expect(delta.readinessDelta).toBeGreaterThan(0);
  });

  it('summarizes room loadout capacity and equipped guardians for compact room cards', () => {
    const state = makeState({
      ownedMonsters: [
        {
          id: 'dokkaebi_warrior',
          level: 1,
          xp: 0,
          skillPoints: 0,
          spentSkills: {},
          equippedSkills: [],
          equipment: 'eq_dokkaebi_club',
        },
        {
          id: 'skeleton_archer_1',
          level: 1,
          xp: 0,
          skillPoints: 0,
          spentSkills: {},
          equippedSkills: [],
          equipment: null,
        },
      ],
    });

    const status = calculateRoomLoadoutStatus(
      state,
      makeSlot({
        roomType: 'combat',
        roomLevel: 2,
        monsterIds: ['dokkaebi_warrior', 'skeleton_archer_1', undefined],
        trapIds: ['spike_trap', undefined],
      }),
    );

    expect(status).toEqual({
      monsterCount: 2,
      monsterCapacity: 3,
      trapCount: 1,
      trapCapacity: 1,
      equippedMonsters: 1,
    });
  });

  it('does not expose loadout capacity for unbuilt design plots', () => {
    const status = calculateRoomLoadoutStatus(
      makeState(),
      makeSlot({
        roomType: undefined,
        roomLevel: 0,
        hp: 0,
        maxHp: 0,
        monsterIds: [],
        trapIds: [],
      }),
    );

    expect(status).toEqual({
      monsterCount: 0,
      monsterCapacity: 0,
      trapCount: 0,
      trapCapacity: 0,
      equippedMonsters: 0,
    });
  });
});
