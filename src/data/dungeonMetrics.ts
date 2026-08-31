import { getEquipmentStats, getMonsterAtk, type EquipmentStats } from './barracks';
import { MONSTER_DEFS, resolveMonsterTypeId } from './monsters';
import { TRAP_DEFS } from './traps';
import { getRoomSlotCapacity, type DungeonSlot, type GameState } from './wisdom';

export interface RoomOperationalMetrics {
  monsterPower: number;
  equipmentPower: number;
  trapPower: number;
  typeBonus: number;
  levelBonus: number;
  durabilityFactor: number;
  threatScore: number;
  lootPotential: number;
  readiness: number;
}

export interface DungeonOperationalMetrics {
  threatScore: number;
  equipmentPower: number;
  lootPotential: number;
  readiness: number;
  builtRooms: number;
  assignedMonsters: number;
  installedTraps: number;
}

export interface RoomMetricDelta {
  threatDelta: number;
  lootDelta: number;
  readinessDelta: number;
}

export interface RoomLoadoutStatus {
  monsterCount: number;
  monsterCapacity: number;
  trapCount: number;
  trapCapacity: number;
  equippedMonsters: number;
}

const TRAP_THREAT: Record<string, number> = {
  spike_trap: 20,
  slow_trap: 16,
  poison_trap: 32,
  stun_trap: 30,
};

export function calculateRoomMetrics(
  state: GameState,
  slot: DungeonSlot | null | undefined,
): RoomOperationalMetrics {
  if (!slot) {
    return {
      monsterPower: 0,
      equipmentPower: 0,
      trapPower: 0,
      typeBonus: 0,
      levelBonus: 0,
      durabilityFactor: 0,
      threatScore: 0,
      lootPotential: 0,
      readiness: 0,
    };
  }

  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const assignedMonsters = (slot.monsterIds ?? []).filter(Boolean).length;
  const installedTraps = (slot.trapIds ?? []).filter(Boolean).length;
  const monsterPower = calculateMonsterPower(state, slot);
  const equipmentPower = calculateEquipmentPower(state, slot);
  const trapBasePower = calculateTrapPower(slot);
  const trapPower = Math.round(trapBasePower * (slot.roomType === 'trap' ? 1.2 : 1));
  const guardianPower = monsterPower + equipmentPower;
  const roomBasePower = guardianPower + trapPower;
  const combatBonus = slot.roomType === 'combat' ? Math.round(guardianPower * 0.15) : 0;
  const supportBonus = slot.roomType === 'support' ? Math.round(roomBasePower * 0.10) : 0;
  const magicBonus = slot.roomType === 'magic' ? Math.round(guardianPower * 0.12) : 0;
  const typeBonus = combatBonus + supportBonus + magicBonus;
  const levelBonus = Math.round((roomBasePower + typeBonus) * Math.max(0, slot.roomLevel - 1) * 0.1);
  const durabilityFactor = slot.maxHp > 0 ? clamp(slot.hp / slot.maxHp, 0, 1) : 0;
  const rawThreat = roomBasePower + typeBonus + levelBonus;
  const threatScore = Math.round(rawThreat * (0.6 + durabilityFactor * 0.4));
  const roomReadiness = calculateReadiness(slot.roomType ? 1 : 0, assignedMonsters, cap.monsters, installedTraps, cap.traps);
  const lootPotential = Math.round((monsterPower * 0.08 + equipmentPower * 0.04 + trapPower * 0.06 + slot.roomLevel * 1.5) * (roomReadiness / 100));

  return {
    monsterPower,
    equipmentPower,
    trapPower,
    typeBonus,
    levelBonus,
    durabilityFactor,
    threatScore,
    lootPotential,
    readiness: roomReadiness,
  };
}

export function calculateDungeonMetrics(
  state: GameState,
  visibleSlotCount = state.dungeonSlots?.length ?? 0,
): DungeonOperationalMetrics {
  const slots = (state.dungeonSlots ?? []).slice(0, visibleSlotCount);
  const builtRooms = slots.filter(slot => !!slot?.roomType).length;
  const assignedMonsters = slots.reduce(
    (sum, slot) => sum + (slot?.monsterIds ?? []).filter(Boolean).length,
    0,
  );
  const installedTraps = slots.reduce(
    (sum, slot) => sum + (slot?.trapIds ?? []).filter(Boolean).length,
    0,
  );
  const roomMetrics = slots.map(slot => calculateRoomMetrics(state, slot));
  const threatScore = roomMetrics.reduce((sum, metrics) => sum + metrics.threatScore, 0);
  const equipmentPower = roomMetrics.reduce((sum, metrics) => sum + metrics.equipmentPower, 0);
  const lootPotential = roomMetrics.reduce((sum, metrics) => sum + metrics.lootPotential, 0);
  const readiness = builtRooms > 0
    ? Math.round(roomMetrics.reduce((sum, metrics) => sum + metrics.readiness, 0) / builtRooms)
    : 0;

  return {
    threatScore,
    equipmentPower,
    lootPotential,
    readiness,
    builtRooms,
    assignedMonsters,
    installedTraps,
  };
}

export function calculateRoomMetricDelta(
  state: GameState,
  currentSlot: DungeonSlot | null | undefined,
  nextSlot: DungeonSlot | null | undefined,
): RoomMetricDelta {
  const current = calculateRoomMetrics(state, currentSlot);
  const next = calculateRoomMetrics(state, nextSlot);
  return {
    threatDelta: next.threatScore - current.threatScore,
    lootDelta: next.lootPotential - current.lootPotential,
    readinessDelta: next.readiness - current.readiness,
  };
}

export function calculateRoomLoadoutStatus(
  state: GameState,
  slot: DungeonSlot | null | undefined,
): RoomLoadoutStatus {
  if (!slot?.roomType) {
    return {
      monsterCount: 0,
      monsterCapacity: 0,
      trapCount: 0,
      trapCapacity: 0,
      equippedMonsters: 0,
    };
  }

  const capacity = getRoomSlotCapacity(Math.max(1, slot.roomLevel), slot.roomType);
  const monsterIds = (slot.monsterIds ?? [])
    .filter((monsterId): monsterId is string => typeof monsterId === 'string' && monsterId.length > 0);
  const trapIds = (slot.trapIds ?? [])
    .filter((trapId): trapId is string => typeof trapId === 'string' && trapId.length > 0);
  const equippedMonsters = monsterIds.reduce((sum, monsterId) => {
    const owned = state.ownedMonsters.find(monster => monster.id === monsterId);
    return sum + (owned?.equipment ? 1 : 0);
  }, 0);

  return {
    monsterCount: monsterIds.length,
    monsterCapacity: capacity.monsters,
    trapCount: trapIds.length,
    trapCapacity: capacity.traps,
    equippedMonsters,
  };
}

function calculateMonsterPower(state: GameState, slot: DungeonSlot): number {
  return (slot.monsterIds ?? []).reduce((sum, monsterId) => {
    if (!monsterId) return sum;
    const owned = state.ownedMonsters.find(monster => monster.id === monsterId);
    if (!owned) return sum;
    const typeId = resolveMonsterTypeId(owned.id);
    if (!typeId) return sum;
    const def = MONSTER_DEFS[typeId];
    return sum + Math.round(getMonsterAtk(def.baseDamage, owned.level, owned.spentSkills ?? {}));
  }, 0);
}

function calculateEquipmentPower(state: GameState, slot: DungeonSlot): number {
  return (slot.monsterIds ?? []).reduce((sum, monsterId) => {
    if (!monsterId) return sum;
    const owned = state.ownedMonsters.find(monster => monster.id === monsterId);
    if (!owned?.equipment) return sum;
    const typeId = resolveMonsterTypeId(owned.id);
    if (!typeId) return sum;
    const def = MONSTER_DEFS[typeId];
    const baseAtk = getMonsterAtk(def.baseDamage, owned.level, owned.spentSkills ?? {});
    return sum + calculateEquipmentImpactPower(baseAtk, getEquipmentStats(owned.equipment));
  }, 0);
}

function calculateEquipmentImpactPower(baseAtk: number, stats: EquipmentStats): number {
  let power = 0;
  if (stats.atkMult) power += Math.round(baseAtk * stats.atkMult);
  if (stats.roomHpBonus) power += Math.round(stats.roomHpBonus / 20);
  if (stats.stunBonus) power += Math.round(stats.stunBonus / 100);
  if (stats.freezeChance) power += Math.round(stats.freezeChance * 40);
  if (stats.executeChance) power += Math.round(stats.executeChance * 80);
  if (stats.procBonus) power += Math.round(stats.procBonus * 60);
  if (stats.skillCdMult && stats.skillCdMult < 1) power += Math.round((1 - stats.skillCdMult) * 40);
  if (stats.goldMult) power += Math.round(stats.goldMult * 25);
  if (stats.crystalMult) power += Math.round(stats.crystalMult * 30);
  return power;
}

function calculateTrapPower(slot: DungeonSlot): number {
  return (slot.trapIds ?? []).reduce((sum, trapId) => {
    if (!trapId) return sum;
    const trap = TRAP_DEFS.find(def => def.id === trapId);
    return sum + (TRAP_THREAT[trapId] ?? Math.max(8, Math.round((trap?.cost ?? 40) * 0.18)));
  }, 0);
}

function calculateReadiness(
  hasRoomType: number,
  assignedMonsters: number,
  monsterCapacity: number,
  installedTraps: number,
  trapCapacity: number,
): number {
  const typeScore = hasRoomType * 30;
  const monsterScore = monsterCapacity > 0 ? (assignedMonsters / monsterCapacity) * 45 : 0;
  const trapScore = trapCapacity > 0 ? (installedTraps / trapCapacity) * 25 : 0;
  return Math.round(clamp(typeScore + monsterScore + trapScore, 0, 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
