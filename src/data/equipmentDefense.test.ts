import { describe, expect, it } from 'vitest';
import { getEquipmentStats } from './barracks';
import { getRoomEquipmentDamageReduction, reduceRoomEquipmentDamage } from './equipmentDefense';

describe('equipment room defense', () => {
  it.each([
    ['eq_spirit_robe', 85],
    ['eq_divine_aegis', 75],
    ['eq_ore_plate', 90],
    ['eq_abyss_mail', 70],
  ])('%s reduces damage in the wearer room', (equipmentId, damage) => {
    const map = new Map([['wearer', getEquipmentStats(equipmentId)]]);
    const reduction = getRoomEquipmentDamageReduction(['wearer'], map);
    expect(reduceRoomEquipmentDamage(100, reduction)).toBeCloseTo(damage);
  });

  it('uses strongest primary or extra wearer without adding or multiplying armor', () => {
    const map = new Map([
      ['primary', getEquipmentStats('eq_spirit_robe')],
      ['extra', getEquipmentStats('eq_abyss_mail')],
      ['elsewhere', { dmgReduction: 0.9 }],
    ]);
    expect(getRoomEquipmentDamageReduction(['primary', null, 'extra', 'extra'], map)).toBe(0.3);
    expect(getRoomEquipmentDamageReduction(['primary'], map)).toBe(0.15);
  });

  it('does not protect an empty room or change damage without equipment', () => {
    const map = new Map([['wearer', getEquipmentStats('eq_abyss_mail')]]);
    expect(getRoomEquipmentDamageReduction([], map)).toBe(0);
    expect(getRoomEquipmentDamageReduction([undefined, 'other'], map)).toBe(0);
    expect(reduceRoomEquipmentDamage(5, 0)).toBe(5);
    expect(reduceRoomEquipmentDamage(5, 0.3)).toBe(3.5);
  });
});
