import { describe, expect, it } from 'vitest';
import { getEquipmentStats } from './barracks';
import type { EquipmentStats } from './barracks';
import { equipmentAuraAttackMult } from './equipmentAuras';
import { resolveMonsterDef } from './monsters';

function room(primary: string | null, extra: (string | null)[] = [], roomHp = 200) {
  return { monsterSlot: primary, monsterSlots: [primary, ...extra], roomHp };
}

describe('equipment guardian attack auras', () => {
  it.each([[0, 1], [1, 0], [1, 2], [2, 1]])('crown buffs orthogonal room at %s,%s', (r, c) => {
    const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => room('target')));
    grid[r][c] = room('crown');
    const map = new Map([['crown', getEquipmentStats('eq_guardian_crown')]]);
    expect(equipmentAuraAttackMult(grid, map, 1, 1, 'dokkaebi')).toBe(1.25);
  });

  it('excludes same-room, diagonal and distant crowns', () => {
    const map = new Map([['crown', getEquipmentStats('eq_guardian_crown')]]);
    expect(equipmentAuraAttackMult([[room('crown')]], map, 0, 0, 'dokkaebi')).toBe(1);
    const grid = [[room('crown'), null, room('crown')], [null, room('target'), null]];
    expect(equipmentAuraAttackMult(grid, map, 1, 1, 'dokkaebi')).toBe(1);
    expect(equipmentAuraAttackMult([[room('crown'), null, room('target')]], map, 0, 2)).toBe(1);
  });

  it('finds aura gear in extra slots without stacking repeated sources', () => {
    const map = new Map([
      ['crown', getEquipmentStats('eq_guardian_crown')],
      ['crown2', getEquipmentStats('eq_guardian_crown')],
    ]);
    const grid = [[room('first', ['crown', null]), room('target'), room('crown2')]];
    expect(equipmentAuraAttackMult(grid, map, 0, 1)).toBe(1.25);
  });

  it('uses the strongest same-type aura rather than adding it', () => {
    const map = new Map<string, EquipmentStats>([
      ['weak', { adjacentAtkBonus: .1, celestialAtkBonus: .1 }],
      ['strong', { adjacentAtkBonus: .25, celestialAtkBonus: .2 }],
    ]);
    const grid = [[room('weak'), room('target'), room('strong')]];
    expect(equipmentAuraAttackMult(grid, map, 0, 1, 'celestial')).toBeCloseTo(1.5);
  });

  it('aegis buffs celestial guardians boardwide including its wearer, not other tribes', () => {
    const map = new Map([['aegis', getEquipmentStats('eq_divine_aegis')]]);
    const grid = [[room('aegis'), null, room('target')]];
    const tribe = resolveMonsterDef('celestial_guardian')?.tribe;
    expect(tribe).toBe('celestial');
    expect(equipmentAuraAttackMult(grid, map, 0, 2, tribe)).toBe(1.2);
    expect(equipmentAuraAttackMult(grid, map, 0, 0, tribe)).toBe(1.2);
    expect(equipmentAuraAttackMult(grid, map, 0, 2, 'dokkaebi')).toBe(1);
    expect(equipmentAuraAttackMult(grid, map, 0, 2)).toBe(1);
  });

  it('aegis in extra slots stacks neither with itself nor a second copy', () => {
    const map = new Map([
      ['aegis', getEquipmentStats('eq_divine_aegis')],
      ['aegis2', getEquipmentStats('eq_divine_aegis')],
    ]);
    const grid = [[room('aegis', ['aegis']), room('other', ['aegis2']), room('target')]];
    expect(equipmentAuraAttackMult(grid, map, 0, 2, 'celestial')).toBe(1.2);
  });

  it('independent crown and aegis aura types multiply once', () => {
    const map = new Map([
      ['crown', getEquipmentStats('eq_guardian_crown')],
      ['aegis', getEquipmentStats('eq_divine_aegis')],
    ]);
    const grid = [[room('crown', ['aegis']), room('target')]];
    expect(equipmentAuraAttackMult(grid, map, 0, 1, 'celestial')).toBe(1.5);
  });

  it('ignores collapsed source rooms and gives no aura to empty or destroyed targets', () => {
    const map = new Map<string, EquipmentStats>([['source', { adjacentAtkBonus: .25, celestialAtkBonus: .2 }]]);
    expect(equipmentAuraAttackMult([[room('source', [], 0), room('target')]], map, 0, 1, 'celestial')).toBe(1);
    expect(equipmentAuraAttackMult([[room('source'), room(null)]], map, 0, 1, 'celestial')).toBe(1);
    expect(equipmentAuraAttackMult([[room('source'), room('target', [], 0)]], map, 0, 1, 'celestial')).toBe(1);
    expect(equipmentAuraAttackMult([[room('source'), null]], map, 0, 1, 'celestial')).toBe(1);
    expect(equipmentAuraAttackMult([], map, 0, 0, 'celestial')).toBe(1);
  });

  it('recognizes an extra guardian when the primary slot is empty', () => {
    const map = new Map([['crown', getEquipmentStats('eq_guardian_crown')]]);
    expect(equipmentAuraAttackMult([[room('crown'), room(null, ['target'])]], map, 0, 1)).toBe(1.25);
  });

  it('reads current placement and equipment on subsequent attacks after swaps', () => {
    const map = new Map([['crown', getEquipmentStats('eq_guardian_crown')]]);
    const grid = [[room('crown'), room('target'), room('unarmed')]];
    expect(equipmentAuraAttackMult(grid, map, 0, 1)).toBe(1.25);
    grid[0][0] = room('unarmed');
    expect(equipmentAuraAttackMult(grid, map, 0, 1)).toBe(1);
    grid[0][2] = room('crown');
    expect(equipmentAuraAttackMult(grid, map, 0, 1)).toBe(1.25);
    map.delete('crown');
    expect(equipmentAuraAttackMult(grid, map, 0, 1)).toBe(1);
  });

  it('does not require equipment on the attacking guardian', () => {
    const grid = [[room('source'), room('target')]];
    expect(equipmentAuraAttackMult(grid, undefined, 0, 1, 'celestial')).toBe(1);
    expect(equipmentAuraAttackMult(grid, new Map(), 0, 1, 'celestial')).toBe(1);
  });
});
