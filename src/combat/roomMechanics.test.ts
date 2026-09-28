import { getEquipmentStats } from '../data/barracks';
import { resolveMonsterAttackCooldown, resolveMonsterDef } from '../data/monsters';
import { describe, expect, it, vi } from 'vitest';
import { GRID_ROWS, GRID_Y } from '../constants/layout';
import type { RoomData } from '../data/rooms';
import { runExtraMonsterAttacks, type RoomMechanicsContext } from './RoomMechanics';

vi.mock('../objects/Invader', () => ({ Invader: class {} }));

describe('runExtraMonsterAttacks', () => {
  it.each([1, 0.8, 1 / 1.15, 0.8 / 1.15])('applies synergy interval %f to secondary hybrid slots', synergyAttackIntervalMult => {
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
        comboCount: () => 0,
      }],
      extraMonsterCooldowns: new Map<string, number>(),
      speedMult: 1,
      synergyAttackIntervalMult,
      tauntBoostActiveUntil: 0,
      hasDivineTerritory: () => false,
      flashRoom,
    } as unknown as RoomMechanicsContext;

    // Probe just before and after the real monster/room interval.
    const cd = resolveMonsterAttackCooldown('storm_spirit', 'scroll_library') * synergyAttackIntervalMult;
    runExtraMonsterAttacks(ctx, cd - 1);
    expect(takeDamage).not.toHaveBeenCalled();
    runExtraMonsterAttacks(ctx, cd + 1);

    expect(takeDamage).toHaveBeenCalledOnce();
    expect(flashRoom).toHaveBeenCalledWith(0, 0);
  });
});


describe('equipment on an extra guardian', () => {
  it.each([false, true])('boss flag=%s uses the extra wearer equipment', isBoss => {
    const takeDamage = vi.fn();
    const data = { type: 'guardian', level: 1, roomTypeDmgMult: 1,
      monsterSlots: ['village_archer', 'dokkaebi_warrior'] } as RoomData;
    const ctx = {
      roomGrid: [[data], [null], [null]], rooms: [[{ x: 0 }]],
      effectiveCols: 1, effectiveCellSize: 40,
      activeInvaders: [{ active: true, x: 0, y: GRID_Y + 20, def: { isBoss },
        comboCount: () => 0, takeDamage }],
      extraMonsterCooldowns: new Map(), equipmentMap: new Map([
        ['village_archer', getEquipmentStats('eq_boss_amulet')],
        ['dokkaebi_warrior', getEquipmentStats('eq_dragon_fang')],
      ]), speedMult: 1, tauntBoostActiveUntil: 0,
      hasDivineTerritory: () => false, flashRoom: () => {},
    } as unknown as RoomMechanicsContext;
    runExtraMonsterAttacks(ctx, 10000);
    expect(takeDamage).toHaveBeenCalledWith(resolveMonsterDef('dokkaebi_warrior')!.baseDamage * 1.4 * (isBoss ? 1.25 : 1));
  });
  it.each([1, 3])('moonstone interval composes with synergy and battle speed %d', speedMult => {
    const takeDamage = vi.fn();
    const data = { type: 'guardian', level: 1, roomTypeDmgMult: 1,
      monsterSlots: ['dokkaebi_warrior', 'village_archer'] } as RoomData;
    const ctx = {
      roomGrid: [[data], [null], [null]], rooms: [[{ x: 0 }]], effectiveCols: 1, effectiveCellSize: 40,
      activeInvaders: [{ active: true, x: 0, y: GRID_Y + 20, comboCount: () => 0, takeDamage }],
      extraMonsterCooldowns: new Map(), equipmentMap: new Map([['village_archer', getEquipmentStats('eq_moonstone_pendant')]]),
      speedMult, synergyAttackIntervalMult: .8 / 1.15, tauntBoostActiveUntil: 0,
      hasDivineTerritory: () => false, flashRoom: () => {},
    } as unknown as RoomMechanicsContext;
    const boundary = resolveMonsterAttackCooldown('village_archer', 'guardian') * .8 / 1.15 / 1.2 / speedMult;
    runExtraMonsterAttacks(ctx, boundary - .01);
    expect(takeDamage).not.toHaveBeenCalled();
    runExtraMonsterAttacks(ctx, boundary + .01);
    expect(takeDamage).toHaveBeenCalledOnce();
  });
});
