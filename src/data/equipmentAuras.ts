import type { EquipmentStats } from './barracks';
import type { CombatMonsterDef } from './monsters';
import type { RoomData } from './rooms';

type AuraRoom = Pick<RoomData, 'monsterSlot' | 'monsterSlots' | 'roomHp'>;

/** Read the current placement on every attack so swaps and collapses remove old auras. */
export function equipmentAuraAttackMult(
  roomGrid: readonly (readonly (AuraRoom | null)[])[],
  equipmentMap: ReadonlyMap<string, EquipmentStats> | undefined,
  row: number,
  col: number,
  tribe?: CombatMonsterDef['tribe'],
): number {
  const targetRoom = roomGrid[row]?.[col];
  if (!equipmentMap || !targetRoom || targetRoom.roomHp <= 0
    || (!targetRoom.monsterSlot && !targetRoom.monsterSlots.some(Boolean))) return 1;

  let adjacentBonus = 0;
  let celestialBonus = 0;
  for (let r = 0; r < roomGrid.length; r++) {
    for (let c = 0; c < roomGrid[r].length; c++) {
      const room = roomGrid[r][c];
      if (!room || room.roomHp <= 0) continue;
      const adjacent = Math.abs(r - row) + Math.abs(c - col) === 1;
      for (const id of [room.monsterSlot, ...room.monsterSlots]) {
        if (!id) continue;
        const stats = equipmentMap.get(id);
        if (adjacent) adjacentBonus = Math.max(adjacentBonus, stats?.adjacentAtkBonus ?? 0);
        if (tribe === 'celestial') celestialBonus = Math.max(celestialBonus, stats?.celestialAtkBonus ?? 0);
      }
    }
  }
  return (1 + adjacentBonus) * (1 + celestialBonus);
}
