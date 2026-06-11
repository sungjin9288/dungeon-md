import { describe, expect, it } from 'vitest';
import { getRoomDesignRecommendation } from './roomDesignRecommendations';
import type { DungeonSlot, GameState, RoomSlotType } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    dmLevel: 1,
    ownedMonsters: [{ id: 'dokkaebi_warrior' }],
    dungeonSlots: [],
    ...overrides,
  } as GameState;
}

function makeSlot(roomType: RoomSlotType | undefined, overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType,
    monsterIds: roomType === 'combat' ? ['dokkaebi_warrior'] : [],
    trapIds: roomType === 'trap' ? ['spike_trap'] : [],
    roomLevel: 1,
    hp: 220,
    maxHp: 220,
    ...overrides,
  };
}

describe('roomDesignRecommendations', () => {
  it('recommends a combat room for the first empty dungeon room', () => {
    const recommendation = getRoomDesignRecommendation(makeState({
      dungeonSlots: [makeSlot(undefined)],
    }), 0);

    expect(recommendation.roomType).toBe('combat');
    expect(recommendation.shortLabel).toContain('수호');
  });

  it('recommends trap coverage after the first combat room exists', () => {
    const recommendation = getRoomDesignRecommendation(makeState({
      dmLevel: 2,
      dungeonSlots: [makeSlot('combat'), makeSlot(undefined)],
    }), 1);

    expect(recommendation.roomType).toBe('trap');
  });

  it('recommends support when a room can bridge existing combat and trap rooms', () => {
    const recommendation = getRoomDesignRecommendation(makeState({
      dmLevel: 4,
      dungeonSlots: [makeSlot('combat'), makeSlot(undefined), makeSlot('trap')],
    }), 1);

    expect(recommendation.roomType).toBe('support');
  });

  it('recommends a magic room once the basic combat, trap, and support roles are covered', () => {
    const recommendation = getRoomDesignRecommendation(makeState({
      dmLevel: 6,
      dungeonSlots: [
        makeSlot('combat'),
        makeSlot('trap'),
        makeSlot('support'),
        makeSlot(undefined),
      ],
    }), 3);

    expect(recommendation.roomType).toBe('magic');
  });
});
