import { getDungeonRoomCount } from './dungeonPlan';
import {
  getRoomSlotCapacity,
  type DungeonSlot,
  type GameState,
  type RoomSlotType,
} from './wisdom';

export interface RoomDesignRecommendation {
  readonly roomType: RoomSlotType;
  readonly title: string;
  readonly reason: string;
  readonly shortLabel: string;
}

const ROOM_TYPES: readonly RoomSlotType[] = ['combat', 'trap', 'support', 'magic'];
const GRID_COLS = 3;

const ROOM_RECOMMENDATION_COPY: Record<RoomSlotType, Omit<RoomDesignRecommendation, 'roomType'>> = {
  combat: {
    title: '수호 라인 우선',
    reason: '대기 몬스터를 바로 배치해 첫 방어선을 세웁니다.',
    shortLabel: '수호 강화',
  },
  trap: {
    title: '침입 동선 제어',
    reason: '함정 슬롯을 늘려 침입자를 늦추고 방어 효율을 올립니다.',
    shortLabel: '함정 강화',
  },
  support: {
    title: '인접 방 버프',
    reason: '양옆 방을 묶어 수호자 성장을 밀어주는 거점입니다.',
    shortLabel: '연계 강화',
  },
  magic: {
    title: '스킬 회전 확보',
    reason: '마법진으로 특수 효과와 장비 성장 루프를 열어둡니다.',
    shortLabel: '스킬 강화',
  },
};

export function getRoomDesignRecommendation(
  state: GameState,
  slotIdx: number,
): RoomDesignRecommendation {
  const slots = (state.dungeonSlots ?? []).slice(0, getDungeonRoomCount(state));
  const counts = countRoomTypes(slots);
  const gaps = countLoadoutGaps(slots);
  const assignedMonsterIds = new Set(
    slots.flatMap(slot => slot?.monsterIds ?? []).filter((id): id is string => !!id),
  );
  const unassignedMonsters = Math.max(0, (state.ownedMonsters ?? []).length - assignedMonsterIds.size);

  if (counts.combat === 0) return buildRecommendation('combat');
  if (unassignedMonsters > gaps.monsterGaps) return buildRecommendation('combat');
  if (counts.trap === 0) return buildRecommendation('trap');
  if (shouldRecommendSupport(slots, slotIdx, counts)) return buildRecommendation('support');
  if ((state.dmLevel ?? 1) >= 4 && counts.magic === 0) return buildRecommendation('magic');
  if (gaps.trapGaps <= 0 && counts.trap <= counts.combat) return buildRecommendation('trap');

  const leastUsedType = ROOM_TYPES.reduce((best, type) =>
    counts[type] < counts[best] ? type : best,
  'combat');
  return buildRecommendation(leastUsedType);
}

function buildRecommendation(roomType: RoomSlotType): RoomDesignRecommendation {
  return {
    roomType,
    ...ROOM_RECOMMENDATION_COPY[roomType],
  };
}

function countRoomTypes(slots: readonly (DungeonSlot | undefined)[]): Record<RoomSlotType, number> {
  return ROOM_TYPES.reduce((acc, type) => {
    acc[type] = slots.filter(slot => slot?.roomType === type).length;
    return acc;
  }, { combat: 0, trap: 0, support: 0, magic: 0 } as Record<RoomSlotType, number>);
}

function countLoadoutGaps(slots: readonly (DungeonSlot | undefined)[]): {
  readonly monsterGaps: number;
  readonly trapGaps: number;
} {
  return slots.reduce((acc, slot) => {
    if (!slot?.roomType) return acc;
    const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    const monsterCount = (slot.monsterIds ?? []).filter(Boolean).length;
    const trapCount = (slot.trapIds ?? []).filter(Boolean).length;
    return {
      monsterGaps: acc.monsterGaps + Math.max(0, cap.monsters - monsterCount),
      trapGaps: acc.trapGaps + Math.max(0, cap.traps - trapCount),
    };
  }, { monsterGaps: 0, trapGaps: 0 });
}

function shouldRecommendSupport(
  slots: readonly (DungeonSlot | undefined)[],
  slotIdx: number,
  counts: Record<RoomSlotType, number>,
): boolean {
  if (counts.support > 0) return false;
  const adjacentBuiltRooms = getAdjacentSlotIndices(slotIdx, slots.length)
    .filter(idx => !!slots[idx]?.roomType)
    .length;
  return adjacentBuiltRooms >= 2 || (counts.combat > 0 && counts.trap > 0 && slots.length >= 3);
}

function getAdjacentSlotIndices(slotIdx: number, slotCount: number): number[] {
  const col = slotIdx % GRID_COLS;
  const candidates = [
    col > 0 ? slotIdx - 1 : -1,
    col < GRID_COLS - 1 ? slotIdx + 1 : -1,
    slotIdx - GRID_COLS,
    slotIdx + GRID_COLS,
  ];
  return candidates.filter(idx => idx >= 0 && idx < slotCount);
}
