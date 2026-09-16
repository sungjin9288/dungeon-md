import { describe, expect, it, vi } from 'vitest';
import { GRID_ROWS, GRID_Y } from '../constants/layout';
import type { RoomData } from '../data/rooms';
import { runExtraMonsterAttacks, type RoomMechanicsContext } from './RoomMechanics';

vi.mock('../objects/Invader', () => ({ Invader: class {} }));

describe('runExtraMonsterAttacks', () => {
  it('applies the room-adjusted cadence to secondary hybrid slots', () => {
    const cellSize = 40;
    const takeDamage = vi.fn();
    const flashRoom = vi.fn();
    const roomData = {
      type: 'scroll_library',
      level: 1,
      monsterSlots: ['dokkaebi_warrior', 'storm_spirit'],
      attackCooldown: 1600,
      roomTypeDmgMult: 1,
    } as RoomData;
    const roomGrid = Array.from({ length: GRID_ROWS }, (_, row) => [row === 0 ? roomData : null]);
    const rooms = Array.from({ length: GRID_ROWS }, () => [{ x: 0 }]);
    const ctx = {
      roomGrid,
      rooms,
      effectiveCols: 1,
      effectiveCellSize: cellSize,
      activeInvaders: [{
        active: true,
        isInvisible: false,
        x: 0,
        y: GRID_Y + cellSize / 2,
        takeDamage,
      }],
      extraMonsterCooldowns: new Map<string, number>(),
      speedMult: 1,
      tauntBoostActiveUntil: 0,
      hasDivineTerritory: () => false,
      flashRoom,
    } as unknown as RoomMechanicsContext;

    runExtraMonsterAttacks(ctx, 1700);

    expect(takeDamage).toHaveBeenCalledOnce();
    expect(flashRoom).toHaveBeenCalledWith(0, 0);
  });
});
