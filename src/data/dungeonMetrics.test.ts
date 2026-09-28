import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
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
    expect(metrics.levelBonus).toBe(17);
    expect(metrics.threatScore).toBe(60);
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

  it('includes evolved and fusion-only monsters in room power', () => {
    const state = makeState({
      ownedMonsters: [
        {
          id: 'dokkaebi_warrior_leg', level: 1, xp: 0, skillPoints: 0,
          spentSkills: {}, equippedSkills: [], equipment: null,
        },
        {
          id: 'storm_spirit', level: 1, xp: 0, skillPoints: 0,
          spentSkills: {}, equippedSkills: [], equipment: null,
        },
      ],
    });
    const metrics = calculateRoomMetrics(state, makeSlot({
      monsterIds: ['dokkaebi_warrior_leg', 'storm_spirit'],
      trapIds: [],
      roomLevel: 1,
    }));

    expect(metrics.monsterPower).toBe(81);
  });

  it('excludes invalid imported monster IDs from loadout counts and readiness', () => {
    const invalid = {
      id: 'no_such_monster', level: 99, xp: 0, skillPoints: 0,
      spentSkills: {}, equippedSkills: [], equipment: null,
    };
    const state = makeState({ ownedMonsters: [invalid] });
    const slot = makeSlot({ monsterIds: [invalid.id], trapIds: [] });

    expect(calculateRoomLoadoutStatus(state, slot).monsterCount).toBe(0);
    expect(calculateRoomMetrics(state, slot).readiness).toBe(30);
    expect(calculateDungeonMetrics({ ...state, dungeonSlots: [slot] }, 1).assignedMonsters).toBe(0);
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
          id: 'dokkaebi_junior_1',
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
        monsterIds: ['dokkaebi_warrior', 'dokkaebi_junior_1', undefined],
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

describe('전력이 모든 육성 채널을 본다', () => {
  // The power readout is what a player judges readiness by, and
  // reinforcementRecommendations feeds its delta straight into the growth
  // ranking. It used to call getMonsterAtk with affinity defaulted to 0 — so
  // 교감 was invisible everywhere except the monster-detail header — and once
  // 흡수 stacks and 각성 joined guardianAtkMult they were invisible too.
  const room = (monsterId: string) => ({
    roomType: 'combat' as const, monsterIds: [monsterId], trapIds: [],
    roomLevel: 1, hp: 200, maxHp: 200,
  });

  function powerWith(extra: Partial<GameState>, monster: Partial<{ absorptionStacks: number }> = {}) {
    const owned = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 20, ...monster };
    const state = { ownedMonsters: [owned], ...extra } as unknown as GameState;
    return calculateRoomMetrics(state, room('dokkaebi_warrior')).monsterPower;
  }

  const base = powerWith({});

  it('교감이 전력을 올린다', () => {
    expect(powerWith({ monsterAffinity: { dokkaebi_warrior: 100 } })).toBeGreaterThan(base);
  });

  it('흡수 스택이 전력을 올린다', () => {
    expect(powerWith({}, { absorptionStacks: 10 })).toBeGreaterThan(base);
  });

  it('각성이 전력을 올린다', () => {
    expect(powerWith({ monsterAwakened: { dokkaebi_warrior: true } })).toBeGreaterThan(base);
  });

  it('셋이 함께 적용되면 각각보다 크다', () => {
    const all = powerWith(
      { monsterAffinity: { dokkaebi_warrior: 100 }, monsterAwakened: { dokkaebi_warrior: true } },
      { absorptionStacks: 10 },
    );
    expect(all).toBeGreaterThan(powerWith({ monsterAffinity: { dokkaebi_warrior: 100 } }));
    expect(all).toBeGreaterThan(powerWith({}, { absorptionStacks: 10 }));
  });
})


describe('방 레벨의 전력 성장 곡선', () => {
  it('Lv1 기준을 유지하고 Lv2~5를 전투와 같은 곡선으로 반영한다', () => {
    const state = makeState();
    const scores = [1, 2, 3, 4, 5].map(roomLevel =>
      calculateRoomMetrics(state, makeSlot({ roomLevel })).threatScore);
    expect(scores).toEqual([43, 60, 84, 118, 165]);
    expect(scores[4] - scores[3]).toBeGreaterThan(scores[1] - scores[0]);
  });

  it('방 강화 예상 증가량은 실제 변경 후 합계 차이와 같다', () => {
    const state = makeState();
    const current = makeSlot({ roomLevel: 4 });
    const next = makeSlot({ roomLevel: 5 });
    const delta = calculateRoomMetricDelta(state, current, next);
    const before = calculateDungeonMetrics({ ...state, dungeonSlots: [current] });
    const after = calculateDungeonMetrics({ ...state, dungeonSlots: [next] });
    expect(delta.threatDelta).toBe(47);
    expect(after.threatScore - before.threatScore).toBe(delta.threatDelta);
  });

  it('고레벨의 내구도 할인과 빈 방의 0점을 유지한다', () => {
    const state = makeState();
    expect(calculateRoomMetrics(state, makeSlot({ roomLevel: 5, hp: 225 })).threatScore).toBe(132);
    expect(calculateRoomMetrics(state, makeSlot({ roomLevel: 5, monsterIds: [], trapIds: [] })).threatScore).toBe(0);
    expect(calculateRoomMetrics(state, undefined).threatScore).toBe(0);
    expect(calculateRoomMetrics(state, makeSlot({ roomLevel: 0 })).threatScore).toBe(43);
  });
});
