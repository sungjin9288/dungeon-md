import type { EquipmentStats } from './barracks';

/** Armor protects its occupied room; multiple wearers use the strongest bonus. */
export function getRoomEquipmentDamageReduction(
  monsterIds: readonly (string | null | undefined)[],
  equipmentMap?: ReadonlyMap<string, EquipmentStats>,
): number {
  let reduction = 0;
  for (const id of monsterIds) {
    if (!id) continue;
    const bonus = equipmentMap?.get(id)?.dmgReduction ?? 0;
    if (Number.isFinite(bonus)) reduction = Math.max(reduction, bonus);
  }
  return Math.min(1, reduction);
}

/** Keep fractional structural HP; persistent slot durability rounds only once. */
export function reduceRoomEquipmentDamage(amount: number, reduction: number): number {
  return amount * (1 - Math.max(0, Math.min(1, reduction)));
}
