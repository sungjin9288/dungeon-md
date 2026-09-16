import { describe, expect, it } from 'vitest';
import { getDungeonActionQueue, getRoomActionRecommendation } from './roomActionRecommendations';
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

describe('roomActionRecommendations', () => {
  it('turns an untyped room into a design action with recommended room copy', () => {
    const action = getRoomActionRecommendation(makeState({
      dungeonSlots: [makeSlot(undefined)],
    }), 0);

    expect(action.kind).toBe('design');
    expect(action.label).toBe('설계');
    expect(action.body).toContain('전투실');
  });

  it('surfaces the recommended guardian when a monster slot is open', () => {
    const action = getRoomActionRecommendation(makeState({
      ownedMonsters: [
        makeMonster({ id: 'dokkaebi_warrior', level: 2 }),
        makeMonster({ id: 'white_tiger', level: 12 }),
      ],
      dungeonSlots: [makeSlot('combat')],
    }), 0);

    expect(action.kind).toBe('assign-monster');
    expect(action.label).toBe('수호');
    expect(action.body).toContain('백호');
    expect(action.statValue).toBe('0/2');
  });

  it('falls back to a generic monster placement action when no guardian is available', () => {
    const action = getRoomActionRecommendation(makeState({
      ownedMonsters: [makeMonster({ id: 'dokkaebi_warrior' })],
      dungeonSlots: [makeSlot('combat', { monsterIds: ['dokkaebi_warrior'] })],
    }), 0);

    expect(action.kind).toBe('assign-monster');
    expect(action.label).toBe('배치');
    expect(action.body).toContain('빈 몬스터 슬롯');
  });

  it('surfaces the recommended trap when trap slots are open', () => {
    const action = getRoomActionRecommendation(makeState({
      dmLevel: 10,
      homeGold: 500,
      ownedMonsters: [makeMonster({ id: 'dokkaebi_warrior' })],
      dungeonSlots: [makeSlot('trap', { monsterIds: ['dokkaebi_warrior'] })],
    }), 0);

    expect(action.kind).toBe('install-trap');
    expect(action.label).toBe('함정');
    expect(action.body).toContain('감전 덫');
    expect(action.statValue).toBe('0/2');
  });

  it('reports ready when room loadout and readiness are complete', () => {
    const action = getRoomActionRecommendation(makeState({
      dmLevel: 6,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: 'golden_armor' }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    }), 0);

    expect(action.kind).toBe('ready');
    expect(action.label).toBe('완비');
  });

  it('recommends equipment when a full room has unequipped guardians', () => {
    const action = getRoomActionRecommendation(makeState({
      dmLevel: 6,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: null }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    }), 0);

    expect(action.kind).toBe('growth');
    expect(action.label).toBe('장비');
    expect(action.statLabel).toBe('E');
    expect(action.statValue).toBe('1/2');
  });

  it('recommends guardian growth when a full equipped room is underleveled', () => {
    const action = getRoomActionRecommendation(makeState({
      dmLevel: 8,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 3, equipment: 'golden_armor' }),
        makeMonster({ id: 'dokkaebi_warrior', level: 8, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    }), 0);

    expect(action.kind).toBe('growth');
    expect(action.label).toBe('성장');
    expect(action.statLabel).toBe('Lv');
    expect(action.body).toContain('목표 Lv.7');
  });

  it('treats invalid imported monster IDs as empty instead of targeting them for growth', () => {
    const action = getRoomActionRecommendation(makeState({
      dmLevel: 6,
      ownedMonsters: [makeMonster({ id: 'no_such_monster', level: 1 })],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['no_such_monster', 'also_invalid'],
        trapIds: ['slow_trap'],
      })],
    }), 0);

    expect(action.kind).toBe('assign-monster');
    expect(action.statValue).toBe('0/2');
  });

  it('orders dungeon action queue by urgent operation priority before room index', () => {
    const queue = getDungeonActionQueue(makeState({
      dmLevel: 10,
      homeGold: 500,
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
    }), 4);

    expect(queue.map(action => action.kind)).toEqual([
      'repair',
      'assign-monster',
      'install-trap',
      'design',
    ]);
    expect(queue.map(action => action.slotIdx)).toEqual([3, 1, 2, 0]);
  });

  it('prioritizes built-room growth before expanding empty rooms', () => {
    const queue = getDungeonActionQueue(makeState({
      dmLevel: 10,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: null }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [
        makeSlot('combat', {
          monsterIds: ['white_tiger', 'dokkaebi_warrior'],
          trapIds: ['slow_trap'],
        }),
        makeSlot(undefined),
      ],
    }), 2);

    expect(queue.map(action => [action.slotIdx, action.kind, action.label])).toEqual([
      [0, 'growth', '장비'],
      [1, 'design', '설계'],
    ]);
  });

  it('includes unlocked empty slots that do not exist in saved dungeonSlots yet', () => {
    const queue = getDungeonActionQueue(makeState({
      dmLevel: 10,
      ownedMonsters: [
        makeMonster({ id: 'white_tiger', level: 12, equipment: 'golden_armor' }),
        makeMonster({ id: 'dokkaebi_warrior', level: 12, equipment: 'dokkaebi_club' }),
      ],
      dungeonSlots: [makeSlot('combat', {
        monsterIds: ['white_tiger', 'dokkaebi_warrior'],
        trapIds: ['slow_trap'],
      })],
    }), 3);

    expect(queue.map(action => [action.slotIdx, action.kind])).toEqual([
      [1, 'design'],
      [2, 'design'],
    ]);
  });
});
