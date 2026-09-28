import type { EquipmentStats } from './barracks';
import type { InvaderDef } from './invaders';

export function equipmentAttackIntervalMult(stats?: EquipmentStats): number {
  return 1 / (1 + (stats?.atkSpeedBonus ?? 0));
}

/** Classify each hit target separately so a boss cannot boost nearby ordinary enemies. */
export function equipmentBossDamageMult(stats: EquipmentStats | undefined, target?: Pick<InvaderDef, 'isBoss' | 'isMiniBoss'>): number {
  return target?.isBoss || target?.isMiniBoss ? 1 + (stats?.bossDmgBonus ?? 0) : 1;
}


export const EQUIPMENT_AOE_DAMAGE_MULT = 0.5;

export function equipmentMagicAttackMult(stats: EquipmentStats | undefined, isMagic: boolean): number {
  return isMagic ? 1 + (stats?.magicAtkBonus ?? 0) : 1;
}

/** Target defenses for equipment bonus hits; Invader.takeDamage owns shield/hex rounding. */
export function equipmentBonusDamage(
  damage: number,
  target: { isDamageImmune?: boolean; isStunned?: boolean; isSubmerged?: boolean;
    isMagicImmune?: boolean; magicImmuneUntil?: number; hasIronBody?: boolean;
    hasSiegeShield?: boolean; isTrapImmune?: boolean; voidPhaseUntil?: number },
  now: number, magic: boolean, trap: boolean, ignoreArmor = false,
): number {
  if (target.isDamageImmune && !target.isStunned) return 0;
  if (target.isSubmerged && !trap) return 0;
  if (trap && (target.isTrapImmune || now < (target.voidPhaseUntil ?? 0))) return 0;
  if (magic && (target.isMagicImmune || now < (target.magicImmuneUntil ?? 0))) return 0;
  let result = damage;
  if (!ignoreArmor && target.hasIronBody) result *= .5;
  if (!ignoreArmor && trap && target.hasSiegeShield) result *= .5;
  return result;
}
