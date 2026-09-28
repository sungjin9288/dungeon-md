import { describe, expect, it, vi } from 'vitest';
import { applyEquipmentBasicEffects } from './EquipmentAttacks';
import { getEquipmentStats } from '../data/barracks';
import { equipmentMagicAttackMult } from '../data/equipmentCombat';
import type { Invader } from '../objects/Invader';
import type { CombatMonsterDef } from '../data/monsters';

const melee = { type: 'melee' } as CombatMonsterDef;
const magic = { type: 'magic', tribe: 'celestial' } as CombatMonsterDef;
function enemy(overrides: Partial<Invader> = {}): Invader {
  return { active: true, isDead: false, def: {}, takeDamage: vi.fn(), ...overrides } as unknown as Invader;
}
const blade = getEquipmentStats('eq_heavenly_blade');
const lance = getEquipmentStats('eq_celestial_lance');

describe('equipment bonus hits', () => {
  it('fifth basic strikes each living enemy once at 50%, without recursive counting', () => {
    const counts = new Map<string, number>();
    const target = enemy(), elsewhere = enemy(), dead = enemy({ isDead: true });
    for (let i = 0; i < 4; i++) applyEquipmentBasicEffects(blade, 'a', counts, melee, 'guardian', 100, target, [target, elsewhere, dead], 10000);
    expect(target.takeDamage).not.toHaveBeenCalled();
    applyEquipmentBasicEffects(blade, 'a', counts, melee, 'guardian', 100, target, [target, elsewhere, dead], 10000);
    expect(target.takeDamage).toHaveBeenCalledExactlyOnceWith(50, false);
    expect(elsewhere.takeDamage).toHaveBeenCalledExactlyOnceWith(50, false);
    expect(dead.takeDamage).not.toHaveBeenCalled();
    expect(counts.get('a')).toBe(5);
  });
  it('counts belong to each wearer even across room changes; a killing basic still counts', () => {
    const counts = new Map([['a', 4]]), dead = enemy({ isDead: true, active: false }), alive = enemy();
    applyEquipmentBasicEffects(blade, 'b', counts, melee, 'guardian', 100, alive, [alive], 10000);
    expect(alive.takeDamage).not.toHaveBeenCalled();
    applyEquipmentBasicEffects(blade, 'a', counts, melee, 'tower', 100, dead, [alive], 10000);
    expect(alive.takeDamage).toHaveBeenCalledExactlyOnceWith(50, false);
    expect([...counts]).toEqual([['a', 5], ['b', 1]]);
  });
  it('killing a proc recipient cannot skip the next live array entry', () => {
    const first = enemy(), second = enemy(), invaders = [first, second];
    first.takeDamage = vi.fn(() => { invaders.splice(0, 1); });
    applyEquipmentBasicEffects(blade, 'a', new Map([['a', 4]]), melee, 'guardian', 100, first, invaders, 10000);
    expect(second.takeDamage).toHaveBeenCalledOnce();
  });
  it('each proc recipient gets its own armor, immunity and dragon-room classification', () => {
    const boss = enemy({ def: { isBoss: true } as Invader['def'] });
    const plain = enemy(), iron = enemy({ hasIronBody: true });
    const submerged = enemy({ isSubmerged: true }), immune = enemy({ isDamageImmune: true });
    applyEquipmentBasicEffects(blade, 'a', new Map([['a', 4]]), melee, 'dragons_lair', 100, boss,
      [boss, plain, iron, submerged, immune], 10000);
    expect(boss.takeDamage).toHaveBeenCalledWith(100, false);
    expect(plain.takeDamage).toHaveBeenCalledWith(50, false);
    expect(iron.takeDamage).toHaveBeenCalledWith(25, false);
    expect(submerged.takeDamage).not.toHaveBeenCalled();
    expect(immune.takeDamage).not.toHaveBeenCalled();
  });
  it('immune attacks do not count; celestial-piercing basics count but procs do not pierce', () => {
    const counts = new Map([['a', 4]]), immune = enemy({ isMagicImmune: true }), plain = enemy();
    applyEquipmentBasicEffects(blade, 'a', counts, magic, 'guardian', 100, immune, [immune, plain], 10000);
    expect(counts.get('a')).toBe(4);
    applyEquipmentBasicEffects(blade, 'a', counts, magic, 'guardian', 100, immune, [immune, plain], 10000, { pierceMagic: true });
    expect(counts.get('a')).toBe(5);
    expect(immune.takeDamage).not.toHaveBeenCalled();
    expect(plain.takeDamage).toHaveBeenCalledWith(50, true);
  });
  it.each([{}, { isMagicImmune: true }, { magicImmuneUntil: 11000 }, { hasIronBody: true }])('holy hit applies magic immunity and armor %j', flags => {
    const target = enemy(flags);
    applyEquipmentBasicEffects(lance, 'a', undefined, melee, 'guardian', 100, target, [target], 10000);
    if ('isMagicImmune' in flags || 'magicImmuneUntil' in flags) expect(target.takeDamage).not.toHaveBeenCalled();
    else expect(target.takeDamage).toHaveBeenCalledWith('hasIronBody' in flags ? 10 : 20, true);
  });
  it('magic core only adds its extra 20% to magic wearers', () => {
    const stats = getEquipmentStats('eq_arcane_core');
    expect(stats.atkMult).toBe(.3);
    expect(equipmentMagicAttackMult(stats, true)).toBe(1.2);
    expect(equipmentMagicAttackMult(stats, false)).toBe(1);
  });
});
