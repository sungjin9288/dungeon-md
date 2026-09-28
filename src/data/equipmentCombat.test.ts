import { describe, expect, it } from 'vitest';
import { getEquipmentStats } from './barracks';
import { equipmentAttackIntervalMult, equipmentBossDamageMult } from './equipmentCombat';

describe('crafted basic attack effects', () => {
  it.each(['eq_dragon_fang', 'eq_boss_amulet'])('%s only boosts boss and mini-boss targets', id => {
    const stats = getEquipmentStats(id);
    const expected = id === 'eq_dragon_fang' ? 1.25 : 1.4;
    expect(equipmentBossDamageMult(stats, {})).toBe(1);
    expect(equipmentBossDamageMult(stats, { isBoss: true })).toBe(expected);
    expect(equipmentBossDamageMult(stats, { isMiniBoss: true })).toBe(expected);
    expect(equipmentBossDamageMult(stats, { isMiniBoss: true, isBoss: true })).toBe(expected);
  });
  it('moonstone keeps its skill cooldown and independently accelerates basics', () => {
    const stats = getEquipmentStats('eq_moonstone_pendant');
    expect(stats.skillCdMult).toBe(.8);
    expect(equipmentAttackIntervalMult(stats)).toBeCloseTo(1 / 1.2);
    expect(equipmentAttackIntervalMult()).toBe(1);
  });
});
