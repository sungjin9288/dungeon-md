import { describe, expect, it } from 'vitest';
import { getMonsterLoadoutRecommendation, getTrapLoadoutRecommendation } from './roomLoadoutRecommendations';
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

function makeSlot(roomType: RoomSlotType, overrides: Partial<DungeonSlot> = {}): DungeonSlot {
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

describe('roomLoadoutRecommendations — monster', () => {
  it('recommends the strongest unassigned monster for an empty room slot', () => {
    const state = makeState({
      ownedMonsters: [
        makeMonster({ id: 'dokkaebi_warrior', level: 2 }),
        makeMonster({ id: 'white_tiger', level: 12 }),
      ],
      dungeonSlots: [makeSlot('combat')],
    });

    const recommendation = getMonsterLoadoutRecommendation(state, 0);

    expect(recommendation?.monsterId).toBe('white_tiger');
    expect(recommendation?.reason).toContain('ATK');
  });

  it('skips monsters already assigned to another dungeon room', () => {
    const state = makeState({
      ownedMonsters: [
        makeMonster({ id: 'dokkaebi_warrior', level: 20 }),
        makeMonster({ id: 'gumiho_guardian', level: 4 }),
      ],
      dungeonSlots: [
        makeSlot('combat', { monsterIds: ['dokkaebi_warrior'] }),
        makeSlot('magic'),
      ],
    });

    const recommendation = getMonsterLoadoutRecommendation(state, 1);

    expect(recommendation?.monsterId).toBe('gumiho_guardian');
  });

  it('returns null when every owned monster is already assigned', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ id: 'dokkaebi_warrior' })],
      dungeonSlots: [makeSlot('combat', { monsterIds: ['dokkaebi_warrior'] })],
    });

    expect(getMonsterLoadoutRecommendation(state, 0)).toBeNull();
  });

  it('recommends a fusion-only hybrid instead of dropping it from the roster', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ id: 'storm_spirit', rarity: 2 })],
      dungeonSlots: [makeSlot('magic')],
    });

    expect(getMonsterLoadoutRecommendation(state, 0)).toMatchObject({
      monsterId: 'storm_spirit',
      name: '폭풍 정령',
      icon: '⚡',
      attack: 24,
    });
  });

  it('uses evolved attack in loadout ranking and copy', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ id: 'dokkaebi_warrior_leg', rarity: 4 })],
      dungeonSlots: [makeSlot('combat')],
    });

    expect(getMonsterLoadoutRecommendation(state, 0)).toMatchObject({
      monsterId: 'dokkaebi_warrior_leg',
      name: '전설 도깨비 전사',
      attack: 57,
    });
  });
});

describe('roomLoadoutRecommendations — trap', () => {
  it('recommends a role-appropriate unlocked trap the player can afford', () => {
    const state = makeState({
      dmLevel: 10,
      homeGold: 500,
      dungeonSlots: [makeSlot('trap')],
    });

    const recommendation = getTrapLoadoutRecommendation(state, 0);

    expect(recommendation?.trapId).toBe('stun_trap');
    expect(recommendation?.reason).toContain('200');
  });

  it('falls back to an affordable early trap when stronger traps are locked or too expensive', () => {
    const state = makeState({
      dmLevel: 1,
      homeGold: 70,
      dungeonSlots: [makeSlot('combat')],
    });

    expect(getTrapLoadoutRecommendation(state, 0)?.trapId).toBe('spike_trap');
  });

  it('prefers a different trap when the best trap is already installed in the room', () => {
    const state = makeState({
      dmLevel: 10,
      homeGold: 500,
      dungeonSlots: [makeSlot('trap', { trapIds: ['stun_trap'] })],
    });

    expect(getTrapLoadoutRecommendation(state, 0)?.trapId).toBe('poison_trap');
  });

  it('returns null when no trap can be bought', () => {
    const state = makeState({
      dmLevel: 10,
      homeGold: 40,
      dungeonSlots: [makeSlot('trap')],
    });

    expect(getTrapLoadoutRecommendation(state, 0)).toBeNull();
  });
});

describe('roomLoadoutRecommendations — crafted traps', () => {
  it('offers a stocked tier-2 trap even with no gold, and never an unstocked one', () => {
    const state = makeState({
      dmLevel: 10,
      homeGold: 0,
      trapStock: { thorn_wall: 1 },
      dungeonSlots: [makeSlot('trap')],
    });

    expect(getTrapLoadoutRecommendation(state, 0)?.trapId).toBe('thorn_wall');
    expect(getTrapLoadoutRecommendation({ ...state, trapStock: {} }, 0)).toBeNull();
  });
});
