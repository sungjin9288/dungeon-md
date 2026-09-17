import {
  getEquipmentStats,
  getMonsterAtk,
  type OwnedMonster,
} from './barracks';
import { resolveOwnedMonsterProfile, type OwnedMonsterProfile } from './monsters';
import { trapEffectiveDps, TRAP_DEFS, type TrapDef } from './traps';
import { getTrapMastery, getTrapStock } from './trapTransactions';
import type { GameState, RoomSlotType } from './wisdom';

export interface MonsterLoadoutRecommendation {
  readonly kind: 'monster';
  readonly monsterId: string;
  readonly monsterTypeId: string;
  readonly name: string;
  readonly icon: string;
  readonly attack: number;
  readonly reason: string;
  readonly accent: number;
}

export interface TrapLoadoutRecommendation {
  readonly kind: 'trap';
  readonly trapId: string;
  readonly name: string;
  readonly icon: string;
  readonly cost: number;
  readonly reason: string;
  readonly accent: number;
}

interface MonsterRecommendationCandidate {
  readonly owned: OwnedMonster;
  readonly def: OwnedMonsterProfile;
  readonly monsterTypeId: string;
  readonly attack: number;
  readonly score: number;
}

const MONSTER_ROOM_TYPE_BONUS: Record<RoomSlotType, Partial<Record<OwnedMonsterProfile['type'], number>>> = {
  combat: {
    melee: 35,
    ranged: 28,
    magic: 18,
    support: 12,
  },
  trap: {
    ranged: 26,
    magic: 22,
    support: 18,
    melee: 10,
  },
  support: {
    support: 42,
    magic: 24,
    ranged: 16,
    melee: 12,
  },
  magic: {
    magic: 42,
    support: 28,
    ranged: 18,
    melee: 10,
  },
};

const MONSTER_ROOM_REASON: Record<RoomSlotType, string> = {
  combat: '전투실 화력 우선',
  trap: '함정실 보조 화력',
  support: '지원실 시너지 우선',
  magic: '마법진 스킬 회전',
};

const TRAP_ROOM_TYPE_BONUS: Record<RoomSlotType, Record<string, number>> = {
  combat: {
    slow_trap: 54,
    spike_trap: 44,
    stun_trap: 38,
    poison_trap: 34,
  },
  trap: {
    stun_trap: 70,
    poison_trap: 60,
    slow_trap: 52,
    spike_trap: 42,
  },
  support: {
    slow_trap: 66,
    stun_trap: 50,
    poison_trap: 42,
    spike_trap: 34,
  },
  magic: {
    stun_trap: 64,
    poison_trap: 54,
    slow_trap: 42,
    spike_trap: 32,
  },
};

const TRAP_ROOM_REASON: Record<RoomSlotType, string> = {
  combat: '첫 접전 속도 제어',
  trap: '함정실 핵심 제압',
  support: '지원 방 보호 동선',
  magic: '스킬 방 진입 차단',
};

export function getMonsterLoadoutRecommendation(
  state: GameState,
  slotIdx: number,
): MonsterLoadoutRecommendation | null {
  const roomType = state.dungeonSlots?.[slotIdx]?.roomType;
  const assignedMonsterIds = collectAssignedMonsterIds(state);
  const candidates = (state.ownedMonsters ?? [])
    .filter(monster => !assignedMonsterIds.has(monster.id))
    .map(monster => buildMonsterCandidate(monster, roomType))
    .filter((candidate): candidate is MonsterRecommendationCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || b.attack - a.attack || b.owned.level - a.owned.level);

  const best = candidates[0];
  if (!best) return null;

  const roomReason = roomType ? MONSTER_ROOM_REASON[roomType] : '초기 수호 라인';
  return {
    kind: 'monster',
    monsterId: best.owned.id,
    monsterTypeId: best.monsterTypeId,
    name: best.def.name,
    icon: best.def.emoji,
    attack: best.attack,
    reason: `${roomReason} · ATK ${best.attack}`,
    accent: best.def.accentColor,
  };
}

export function getTrapLoadoutRecommendation(
  state: GameState,
  slotIdx: number,
): TrapLoadoutRecommendation | null {
  const slot = state.dungeonSlots?.[slotIdx];
  const roomType = slot?.roomType;
  const gold = state.homeGold ?? 0;
  const dmLevel = state.dmLevel ?? 1;
  const installedTrapIds = new Set(
    (slot?.trapIds ?? []).filter((trapId): trapId is string => typeof trapId === 'string' && trapId.length > 0),
  );
  // Tier 1 is bought with gold; crafted tiers install only from stock.
  const affordableTraps = TRAP_DEFS
    .filter(trap => dmLevel >= trap.unlockLv)
    .filter(trap => (trap.tier === 1 ? gold >= trap.cost : getTrapStock(state, trap.id) > 0));
  const diverseTraps = affordableTraps.filter(trap => !installedTrapIds.has(trap.id));
  const candidates = (diverseTraps.length > 0 ? diverseTraps : affordableTraps)
    .map(trap => ({
      trap,
      score: getTrapScore(trap, roomType, getTrapMastery(state, trap.id)),
    }))
    .sort((a, b) => b.score - a.score || b.trap.cost - a.trap.cost);

  const best = candidates[0]?.trap;
  if (!best) return null;

  const roomReason = roomType ? TRAP_ROOM_REASON[roomType] : '기본 방어 보강';
  return {
    kind: 'trap',
    trapId: best.id,
    name: best.name,
    icon: best.emoji,
    cost: best.cost,
    reason: `${roomReason} · ${best.cost.toLocaleString('ko-KR')}g`,
    accent: 0xc8921a,
  };
}

function buildMonsterCandidate(
  owned: OwnedMonster,
  roomType: RoomSlotType | undefined,
): MonsterRecommendationCandidate | null {
  const def = resolveOwnedMonsterProfile(owned.id);
  if (!def) return null;
  const monsterTypeId = def.registryId ?? def.id;
  const attack = calculateRecommendedAttack(owned, def);
  const roomBonus = roomType ? MONSTER_ROOM_TYPE_BONUS[roomType][def.type] ?? 0 : 0;
  const rarityBonus = (owned.rarity ?? 0) * 12;
  const equipmentBonus = owned.equipment ? 10 : 0;
  const skillReadyBonus = (owned.skillPoints ?? 0) * 3;

  return {
    owned,
    def,
    monsterTypeId,
    attack,
    score: attack + roomBonus + owned.level * 2 + rarityBonus + equipmentBonus + skillReadyBonus,
  };
}

function calculateRecommendedAttack(owned: OwnedMonster, def: OwnedMonsterProfile): number {
  const baseAttack = getMonsterAtk(def.baseDamage, owned.level, owned.spentSkills ?? {});
  if (!owned.equipment) return baseAttack;
  const equipmentStats = getEquipmentStats(owned.equipment);
  return Math.round(baseAttack * (1 + (equipmentStats.atkMult ?? 0)));
}

function collectAssignedMonsterIds(state: GameState): Set<string> {
  return new Set(
    (state.dungeonSlots ?? [])
      .flatMap(slot => slot?.monsterIds ?? [])
      .filter((monsterId): monsterId is string => typeof monsterId === 'string' && monsterId.length > 0),
  );
}

function getTrapScore(trap: TrapDef, roomType: RoomSlotType | undefined, mastery: number): number {
  const roleBonus = roomType ? TRAP_ROOM_TYPE_BONUS[roomType][trap.id] ?? 0 : 0;
  // Crafted traps have no gold price; their worth is the afflictions they stack.
  return roleBonus + Math.round(trap.cost * 0.2) + Math.round(trapEffectiveDps(trap.id, mastery) * 2);
}
