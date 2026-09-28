import type { EquipmentStats } from '../data/barracks';
import type { CombatMonsterDef } from '../data/monsters';
import type { RoomType } from '../data/rooms';
import type { Invader } from '../objects/Invader';
import { equipmentBonusDamage, EQUIPMENT_AOE_DAMAGE_MULT } from '../data/equipmentCombat';

/** Called once per damaging basic attack, including a row-wide replacement basic.
 * Counts belong to the wearer, survive room swaps, and reset at wave start.
 * Bonus hits never call this hook recursively or apply status/proc effects.
 */
export function applyEquipmentBasicEffects(
  stats: EquipmentStats | undefined,
  wearer: string | null,
  counts: Map<string, number> | undefined,
  monster: CombatMonsterDef | null,
  roomType: RoomType,
  baseDamage: number,
  target: Invader,
  invaders: readonly Invader[],
  now: number,
  options: { applyHoly?: boolean; roomLevel?: number; pierceMagic?: boolean } = {},
): void {
  if (!stats || !wearer || baseDamage <= 0) return;
  const magic = monster?.type === 'magic';
  const trap = roomType === 'trap' || roomType === 'trap_corridor';
  const ignoreArmor = monster?.passive === 'GHOST_ARROW';
  const damageFor = (inv: Invader) => baseDamage
    * (roomType === 'dragons_lair' && inv.def?.isBoss ? 2 : 1)
    * (roomType === 'trap_corridor' && (options.roomLevel ?? 1) >= 3 && inv.isFrozen ? 2 : 1);
  // The main hit may have killed its target; only defense eligibility affects counting.
  if (equipmentBonusDamage(baseDamage, target, now, magic && !options.pierceMagic, trap, ignoreArmor) <= 0) return;
  if (options.applyHoly !== false && stats.holyDmgBonus && target.active && !target.isDead) {
    const bonus = equipmentBonusDamage(damageFor(target) * stats.holyDmgBonus, target, now, true, trap, ignoreArmor);
    if (bonus > 0) target.takeDamage(bonus, true);
  }
  if (!stats.aoeEvery || !counts) return;
  const count = (counts.get(wearer) ?? 0) + 1;
  counts.set(wearer, count);
  if (count % stats.aoeEvery !== 0) return;
  // Copy: taking damage can synchronously remove a killed invader from the live array.
  for (const inv of [...invaders]) {
    if (!inv.active || inv.isDead) continue;
    const bonus = equipmentBonusDamage(damageFor(inv) * EQUIPMENT_AOE_DAMAGE_MULT, inv, now, magic, trap, ignoreArmor);
    if (bonus > 0) inv.takeDamage(bonus, magic);
  }
}
