import { describe, expect, it } from 'vitest';
import {
  getHomeReadinessDestination,
  getHomeReadinessDirective,
} from './homeReadinessDirective';
import { getDungeonActionQueue, type RoomActionRecommendation } from './roomActionRecommendations';
import type { DungeonSlot, GameState, RoomSlotType } from './wisdom';

function makeMonster(overrides = {}) {
  return {
    id: 'dokkaebi_warrior',
    level: 1,
    xp: 0,
    skillPoints: 0,
    spentSkills: {},
    equippedSkills: [],
    equipment: null,
    ...overrides,
  };
}

function makeSlot(roomType: RoomSlotType | undefined, overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType,
    monsterIds: [],
    trapIds: [],
    roomLevel: 1,
    hp: 220,
    maxHp: 220,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    dmLevel: 1,
    homeGold: 0,
    ownedMonsters: [],
    dungeonSlots: [],
    ...overrides,
  } as GameState;
}

describe('homeReadinessDirective', () => {
  it('preserves the exact first queued room action without mutating GameState', () => {
    const state = makeState({
      dmLevel: 10,
      ownedMonsters: [
        makeMonster({ id: 'dokkaebi_warrior', level: 5 }),
        makeMonster({ id: 'white_tiger', level: 12 }),
      ],
      dungeonSlots: [
        makeSlot(undefined),
        makeSlot('combat'),
        makeSlot('trap', { monsterIds: ['dokkaebi_warrior'] }),
        makeSlot('support', { hp: 0 }),
      ],
    });
    const before = structuredClone(state);
    const expected = getDungeonActionQueue(state, 4)[0];

    const directive = getHomeReadinessDirective(state, 4);

    expect(directive.roomAction).toEqual(expected);
    expect(directive).toMatchObject({
      destination: 'room-detail',
      kind: expected.kind,
      slotIdx: expected.slotIdx,
      title: expected.title,
      body: expected.body,
      ctaLabel: expected.ctaLabel,
      statLabel: expected.statLabel,
      statValue: expected.statValue,
      accent: expected.accent,
    });
    expect(state).toEqual(before);
  });

  it('routes equipment growth to Forge and level growth to Barracks', () => {
    const equipmentState = makeState({
      dmLevel: 6,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: null }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    });
    const levelState = makeState({
      dmLevel: 8,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 3, equipment: 'golden_armor' }),
        makeMonster({ id: 'dokkaebi_warrior', level: 8, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    });

    expect(getHomeReadinessDirective(equipmentState, 1)).toMatchObject({
      destination: 'forge', kind: 'growth', statLabel: 'E', slotIdx: 0,
    });
    expect(getHomeReadinessDirective(levelState, 1)).toMatchObject({
      destination: 'barracks', kind: 'growth', statLabel: 'Lv', slotIdx: 0,
    });
  });

  it('routes non-equipment growth to Barracks and a stable board to PreBattle', () => {
    const readinessAction: RoomActionRecommendation = {
      kind: 'growth', slotIdx: 0, icon: '▲', label: '보강', title: '전력 보강',
      body: '준비도 보강', ctaLabel: '성장 이동', statLabel: '준비', statValue: '70%', accent: 0x66c08a,
    };
    const readyState = makeState({
      dmLevel: 6,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: 'golden_armor' }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    });

    expect(getHomeReadinessDestination(readinessAction)).toBe('barracks');
    expect(getHomeReadinessDirective(readyState, 1)).toMatchObject({
      destination: 'pre-battle', kind: 'ready', slotIdx: null, roomAction: null,
    });
  });
});

describe('dig directive — a free corridor permit outranks growth chores', () => {
  const staffed = makeSlot('combat', { monsterIds: ['dokkaebi_warrior', 'dokkaebi_junior'], trapIds: ['spike_trap'] });
  const base = {
    dmLevel: 4,
    dungeonPlan: { corridor: [0], sides: [] },
    dungeonSlots: [staffed],
    ownedMonsters: [makeMonster(), makeMonster({ id: 'dokkaebi_junior' })],
  };

  it('points at the corridor dig when a permit is free and affordable (the quest said 방 2개, the card said 장비)', () => {
    const directive = getHomeReadinessDirective(makeState({ ...base, homeGold: 5000 }), 1);
    expect(directive).toMatchObject({ kind: 'dig', destination: 'dig', roomAction: null });
    expect(directive.body).toContain('450');
  });

  it('does not dig while the gold is short or no permit is left', () => {
    expect(getHomeReadinessDirective(makeState({ ...base, homeGold: 10 }), 1).kind).not.toBe('dig');
    expect(getHomeReadinessDirective(makeState({ ...base, dmLevel: 1, homeGold: 5000 }), 1).kind).not.toBe('dig');
  });

  it('urgent room work still comes first', () => {
    const empty = makeState({ ...base, homeGold: 5000, dungeonSlots: [makeSlot('combat')] });
    expect(getHomeReadinessDirective(empty, 1).kind).not.toBe('dig');
  });
});
