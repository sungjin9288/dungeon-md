import { calculateRoomLoadoutStatus, calculateRoomMetrics } from './dungeonMetrics';
import { getRoomDesignRecommendation } from './roomDesignRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation,
} from './roomLoadoutRecommendations';
import {
  getRoomSlotCapacity,
  ROOM_SLOT_TYPE_DEFS,
  type GameState,
} from './wisdom';
import { resolveOwnedMonsterProfile } from './monsters';
import { getRoomRepairCost } from './roomSlotTransactions';

export type RoomActionKind =
  | 'design'
  | 'repair'
  | 'assign-monster'
  | 'install-trap'
  | 'growth'
  | 'ready';

export interface RoomActionRecommendation {
  readonly kind: RoomActionKind;
  readonly slotIdx: number;
  readonly icon: string;
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
}

const ROOM_READY_THRESHOLD = 78;
/** Durability below this (percent) puts repair ahead of every loadout action. */
export const REPAIR_RECOMMEND_PCT = 50;
const ACTION_PRIORITY: Record<RoomActionKind, number> = {
  repair: 0,
  'assign-monster': 1,
  'install-trap': 2,
  growth: 3,
  design: 4,
  ready: 5,
};

export function getRoomActionRecommendation(
  state: GameState,
  slotIdx: number,
): RoomActionRecommendation {
  const slot = state.dungeonSlots?.[slotIdx];
  const roomOrdinal = slotIdx + 1;
  const roomLabel = `방 #${roomOrdinal}`;

  if (!slot?.roomType) {
    const recommendation = getRoomDesignRecommendation(state, slotIdx);
    const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === recommendation.roomType);
    return {
      kind: 'design',
      slotIdx,
      icon: typeDef?.icon ?? '▣',
      label: '설계',
      title: '추천 방 설계',
      body: `${typeDef?.name ?? recommendation.title} · ${recommendation.shortLabel}`,
      ctaLabel: `${roomLabel} 설계`,
      statLabel: '확장',
      statValue: `#${roomOrdinal}`,
      accent: 0x55b88a,
    };
  }

  // Breakthroughs wear every room and nothing heals them between battles, so a
  // badly worn room is repaired before its loadout grows.
  const durabilityPct = slot.maxHp > 0 ? Math.floor((slot.hp / slot.maxHp) * 100) : 0;
  if (slot.hp <= 0 || durabilityPct < REPAIR_RECOMMEND_PCT) {
    const broken = slot.hp <= 0;
    return {
      kind: 'repair',
      slotIdx,
      icon: '!',
      label: '수리',
      title: broken ? '파손 방 복구' : '손상 방 수리',
      body: broken
        ? `${roomLabel} 내구도 0 · 수리 필요`
        : `${roomLabel} 내구도 ${durabilityPct}% · 수리 ${getRoomRepairCost(slot)}골드`,
      ctaLabel: `${roomLabel} 수리`,
      statLabel: '내구',
      statValue: `${broken ? 0 : durabilityPct}%`,
      accent: 0xff5544,
    };
  }

  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const monsterCount = calculateRoomLoadoutStatus(state, slot).monsterCount;
  const trapCount = (slot.trapIds ?? []).filter(Boolean).length;

  if (monsterCount < cap.monsters) {
    const recommendation = getMonsterLoadoutRecommendation(state, slotIdx);
    if (recommendation) {
      return {
        kind: 'assign-monster',
        slotIdx,
        icon: recommendation.icon,
        label: '수호',
        title: '추천 수호자 배치',
        body: `${recommendation.name} · ${recommendation.reason}`,
        ctaLabel: `${roomLabel} 배치`,
        statLabel: 'M',
        statValue: `${monsterCount}/${cap.monsters}`,
        accent: recommendation.accent,
      };
    }

    return {
      kind: 'assign-monster',
      slotIdx,
      icon: '👹',
      label: '배치',
      title: '수호자 배치',
      body: `${roomLabel} 빈 몬스터 슬롯 ${cap.monsters - monsterCount}개`,
      ctaLabel: `${roomLabel} 배치`,
      statLabel: 'M',
      statValue: `${monsterCount}/${cap.monsters}`,
      accent: 0xff8a45,
    };
  }

  if (cap.traps > 0 && trapCount < cap.traps) {
    const recommendation = getTrapLoadoutRecommendation(state, slotIdx);
    if (recommendation) {
      return {
        kind: 'install-trap',
        slotIdx,
        icon: recommendation.icon,
        label: '함정',
        title: '추천 함정 설치',
        body: `${recommendation.name} · ${recommendation.reason}`,
        ctaLabel: `${roomLabel} 설치`,
        statLabel: 'T',
        statValue: `${trapCount}/${cap.traps}`,
        accent: recommendation.accent,
      };
    }

    return {
      kind: 'install-trap',
      slotIdx,
      icon: '⌁',
      label: '함정',
      title: '함정 설치',
      body: `${roomLabel} 빈 함정 슬롯 ${cap.traps - trapCount}개`,
      ctaLabel: `${roomLabel} 설치`,
      statLabel: 'T',
      statValue: `${trapCount}/${cap.traps}`,
      accent: 0xc8921a,
    };
  }

  const assignedMonsterIds = (slot.monsterIds ?? []).filter((monsterId): monsterId is string =>
    typeof monsterId === 'string'
    && monsterId.length > 0
    && resolveOwnedMonsterProfile(monsterId) !== null
    && state.ownedMonsters.some(monster => monster.id === monsterId),
  );
  const equippedCount = assignedMonsterIds.filter(monsterId =>
    Boolean(state.ownedMonsters.find(monster => monster.id === monsterId)?.equipment),
  ).length;
  const firstUnequippedMonsterId = assignedMonsterIds.find(monsterId =>
    !state.ownedMonsters.find(monster => monster.id === monsterId)?.equipment,
  );
  if (firstUnequippedMonsterId) {
    return {
      kind: 'growth',
      slotIdx,
      icon: '⚒',
      label: '장비',
      title: '장비 보강',
      body: `${getMonsterDisplayName(firstUnequippedMonsterId)} 장비 미착용 · 방 장비 ${equippedCount}/${assignedMonsterIds.length}`,
      ctaLabel: '장비 이동',
      statLabel: 'E',
      statValue: `${equippedCount}/${assignedMonsterIds.length}`,
      accent: 0x9a6cd8,
    };
  }

  const targetLevel = Math.max(2, state.dmLevel - 1);
  const underleveledMonster = assignedMonsterIds
    .map(monsterId => state.ownedMonsters.find(monster => monster.id === monsterId))
    .find(monster => monster && monster.level < targetLevel);
  if (underleveledMonster) {
    return {
      kind: 'growth',
      slotIdx,
      icon: '▲',
      label: '성장',
      title: '수호자 성장',
      body: `${getMonsterDisplayName(underleveledMonster.id)} Lv.${underleveledMonster.level} · 목표 Lv.${targetLevel}`,
      ctaLabel: '성장 이동',
      statLabel: 'Lv',
      statValue: `${underleveledMonster.level}/${targetLevel}`,
      accent: 0x66c08a,
    };
  }

  const metrics = calculateRoomMetrics(state, slot);
  if (metrics.readiness < ROOM_READY_THRESHOLD) {
    return {
      kind: 'growth',
      slotIdx,
      icon: '▲',
      label: '보강',
      title: '전력 보강',
      body: `${roomLabel} 준비도 ${metrics.readiness}% · 성장/장비 보강`,
      ctaLabel: '성장 이동',
      statLabel: '준비',
      statValue: `${metrics.readiness}%`,
      accent: 0x66c08a,
    };
  }

  return {
    kind: 'ready',
    slotIdx,
    icon: '✓',
    label: '완비',
    title: '가동 완비',
    body: `${roomLabel} 다음 침공 대응 준비 완료`,
    ctaLabel: '완비',
    statLabel: '준비',
    statValue: `${metrics.readiness}%`,
    accent: 0x66c08a,
  };
}

function getMonsterDisplayName(monsterId: string): string {
  return resolveOwnedMonsterProfile(monsterId)?.name ?? monsterId;
}

export function getDungeonActionQueue(
  state: GameState,
  slotCount: number,
): RoomActionRecommendation[] {
  return Array.from({ length: Math.max(0, slotCount) }, (_, slotIdx) =>
    getRoomActionRecommendation(state, slotIdx),
  )
    .filter(action => action.kind !== 'ready')
    .sort((a, b) =>
      ACTION_PRIORITY[a.kind] - ACTION_PRIORITY[b.kind]
      || a.slotIdx - b.slotIdx,
    );
}
