// ─── Reinforcement Recommendations ───────────────────────────────────────────
// Read-only room, growth, and equipment projections for reinforcement surfaces.

import {
  EQUIPMENT_DEFS,
  getEquipmentStats,
  getMonsterAtk,
  xpToNextLevel,
  type OwnedMonster,
} from './barracks';
import { calculateRoomMetrics } from './dungeonMetrics';
import { resolveOwnedMonsterProfile } from './monsters';
import {
  getRoomSlotCapacity,
  ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot,
  type GameState,
  type RoomSlotType,
} from './wisdom';

export type RoomReinforcementKind = 'assigned' | 'recommended' | 'unassigned';

export interface RoomReinforcementChange {
  readonly level?: number;
  readonly equipment?: string | null;
}

export interface RoomReinforcementProjection {
  readonly kind: RoomReinforcementKind;
  readonly roomIndex: number | null;
  readonly roomLabel: string;
  readonly roomContextLabel: string;
  /** Present only for a monster already assigned to a real room. */
  readonly readiness: { readonly before: number; readonly after: number } | null;
  /** Present only when existing room metrics can evaluate the actual room. */
  readonly power: { readonly before: number; readonly after: number; readonly delta: number } | null;
}

interface RoomRef {
  readonly slot: DungeonSlot;
  readonly index: number;
}

/**
 * Projects a level/equipment change through the existing room metric formula.
 * It never changes the input state or room slot structure.
 */
export function projectRoomReinforcement(
  state: GameState,
  monsterId: string,
  change: RoomReinforcementChange = {},
): RoomReinforcementProjection {
  const monster = state.ownedMonsters.find(candidate => candidate.id === monsterId);
  const assigned = findAssignedRoom(state, monsterId);

  if (!monster || !assigned?.slot.roomType) {
    return buildUnavailableProjection(monster ? findRecommendedOpenRoom(state, monsterId) : null);
  }

  const nextMonster = {
    ...monster,
    ...(change.level === undefined ? {} : { level: change.level }),
    ...(change.equipment === undefined ? {} : { equipment: change.equipment }),
  };
  const nextState: GameState = {
    ...state,
    ownedMonsters: state.ownedMonsters.map(candidate =>
      candidate.id === monsterId ? nextMonster : candidate,
    ),
  };
  const before = calculateRoomMetrics(state, assigned.slot);
  const after = calculateRoomMetrics(nextState, assigned.slot);

  return {
    kind: 'assigned',
    roomIndex: assigned.index,
    roomLabel: `방 #${assigned.index + 1}`,
    roomContextLabel: `${getRoomTypeName(assigned.slot.roomType)} 실제 배치`,
    readiness: { before: before.readiness, after: after.readiness },
    power: {
      before: before.threatScore,
      after: after.threatScore,
      delta: after.threatScore - before.threatScore,
    },
  };
}

export function findAssignedRoom(state: GameState, monsterId: string): RoomRef | null {
  const index = (state.dungeonSlots ?? []).findIndex(slot =>
    Boolean(slot?.roomType) && (slot?.monsterIds ?? []).includes(monsterId),
  );
  if (index < 0) return null;
  const slot = state.dungeonSlots[index];
  return slot ? { slot, index } : null;
}

export function findRecommendedOpenRoom(state: GameState, monsterId: string): RoomRef | null {
  const preferredType = getPreferredRoomType(monsterId);
  const candidates = (state.dungeonSlots ?? [])
    .map((slot, index) => slot ? { slot, index } : null)
    .filter((entry): entry is RoomRef => entry !== null && Boolean(entry.slot.roomType) && hasOpenMonsterSlot(entry.slot));

  return candidates.sort((a, b) => {
    const preferredDiff = Number(b.slot.roomType === preferredType) - Number(a.slot.roomType === preferredType);
    return preferredDiff || a.index - b.index;
  })[0] ?? null;
}

function buildUnavailableProjection(recommended: RoomRef | null): RoomReinforcementProjection {
  if (recommended) {
    return {
      kind: 'recommended',
      roomIndex: recommended.index,
      roomLabel: `방 #${recommended.index + 1}`,
      roomContextLabel: `${getRoomTypeName(recommended.slot.roomType)} 추천 빈 슬롯`,
      readiness: null,
      power: null,
    };
  }
  return {
    kind: 'unassigned',
    roomIndex: null,
    roomLabel: '배치 대기',
    roomContextLabel: '실제 배치 방 없음',
    readiness: null,
    power: null,
  };
}

function hasOpenMonsterSlot(slot: DungeonSlot): boolean {
  const capacity = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  return (slot.monsterIds ?? []).filter(Boolean).length < capacity.monsters;
}

function getPreferredRoomType(monsterId: string): RoomSlotType {
  const def = getMonsterDef(monsterId);
  if (def?.type === 'magic') return 'magic';
  if (def?.type === 'support') return 'support';
  return 'combat';
}

function getRoomTypeName(roomType?: RoomSlotType): string {
  return ROOM_SLOT_TYPE_DEFS.find(def => def.id === roomType)?.name ?? '미지정 방';
}

export const GROWTH_FEED_GOLD_COST = 50;
export const GROWTH_FEED_XP_GAIN = 20;

export type GrowthRecommendationAction = 'sp' | 'level-up' | 'equip' | 'feed' | 'blocked-feed' | 'ready';

export interface GrowthRecommendation {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly monsterEmoji: string;
  readonly monsterLevel: number;
  readonly rosterIndex: number;
  readonly action: GrowthRecommendationAction;
  readonly currentEquipment: { readonly id: string; readonly name: string; readonly emoji: string } | null;
  readonly recommendedEquipment: { readonly id: string; readonly name: string; readonly emoji: string } | null;
  readonly whyNow: string;
  readonly costOrDeficit: string;
  readonly xpProgress: { readonly current: number; readonly need: number; readonly percent: number };
  readonly room: RoomReinforcementProjection;
  readonly estimatedPowerDelta: number | null;
  readonly score: number;
}

export function rankGrowthRecommendations(
  state: GameState,
  focusMonsterId: string | null = null,
): GrowthRecommendation[] {
  return state.ownedMonsters
    .filter(monster => getMonsterDef(monster.id) !== null)
    .map((monster, rosterIndex) => buildGrowthRecommendation(state, monster, rosterIndex))
    .sort((a, b) => {
      const focusDiff = Number(b.monsterId === focusMonsterId) - Number(a.monsterId === focusMonsterId);
      return focusDiff || b.score - a.score || a.rosterIndex - b.rosterIndex;
    });
}

export function getPrimaryGrowthRecommendation(
  state: GameState,
  focusMonsterId: string | null = null,
): GrowthRecommendation | null {
  return rankGrowthRecommendations(state, focusMonsterId)[0] ?? null;
}

export function buildGrowthRecommendation(
  state: GameState,
  monster: OwnedMonster,
  rosterIndex = 0,
): GrowthRecommendation {
  const def = getMonsterDef(monster.id);
  const xpNeed = monster.level >= 50 ? 0 : xpToNextLevel(monster.level);
  const xpPercent = monster.level >= 50 ? 1 : Math.min(1, monster.xp / xpNeed);
  const xpProgress = { current: monster.xp, need: xpNeed, percent: Math.round(xpPercent * 100) };
  const currentEquipment = getEquipmentDisplay(state, monster.equipment);
  const equipmentUpgrade = getBestOwnedEquipmentUpgrade(state, monster);
  const baseRoom = projectRoomReinforcement(state, monster.id);
  const feedAffordable = (state.homeGold ?? 0) >= GROWTH_FEED_GOLD_COST;
  const willLevelUp = monster.level < 50 && monster.xp + GROWTH_FEED_XP_GAIN >= xpNeed;

  let action: GrowthRecommendationAction = 'ready';
  let whyNow = `XP ${monster.xp}/${xpNeed} · SP ${monster.skillPoints ?? 0}`;
  let costOrDeficit = monster.level >= 50 ? '최대 레벨' : `다음 훈련 ${GROWTH_FEED_GOLD_COST}골드`;
  let room = baseRoom;
  let estimatedPowerDelta: number | null = null;

  if ((monster.skillPoints ?? 0) > 0) {
    action = 'sp';
    whyNow = `SP ${monster.skillPoints} 보유 · XP ${monster.xp}/${xpNeed}`;
    costOrDeficit = `사용 가능 SP ${monster.skillPoints}`;
  } else if (willLevelUp && feedAffordable) {
    action = 'level-up';
    room = projectRoomReinforcement(state, monster.id, { level: monster.level + 1 });
    estimatedPowerDelta = room.power?.delta ?? null;
    whyNow = `XP ${monster.xp}/${xpNeed} · ${GROWTH_FEED_GOLD_COST}골드로 Lv.${monster.level + 1}`;
    costOrDeficit = `${GROWTH_FEED_GOLD_COST}골드 · 보유 ${state.homeGold ?? 0}`;
  } else if (equipmentUpgrade) {
    action = 'equip';
    room = equipmentUpgrade.room;
    estimatedPowerDelta = room.power?.delta ?? null;
    whyNow = `보유 장비 ${getOwnedValidEquipment(state).length}개 · 교체 가능`;
    costOrDeficit = estimatedPowerDelta === null
      ? '배치 전 · 방 전력 추정 없음'
      : estimatedPowerDelta > 0
        ? `예상 방 전력 +${estimatedPowerDelta}`
        : '개선 없음';
  } else if (monster.level < 50 && feedAffordable) {
    action = 'feed';
    whyNow = `XP ${monster.xp}/${xpNeed} · 보유 골드 ${state.homeGold ?? 0}`;
    costOrDeficit = `${GROWTH_FEED_GOLD_COST}골드 · EXP +${GROWTH_FEED_XP_GAIN}`;
  } else if (monster.level < 50) {
    const deficit = Math.max(0, GROWTH_FEED_GOLD_COST - (state.homeGold ?? 0));
    action = 'blocked-feed';
    whyNow = `XP ${monster.xp}/${xpNeed} · 골드 ${state.homeGold ?? 0}`;
    costOrDeficit = `${GROWTH_FEED_GOLD_COST}골드 필요 · 부족 ${deficit}`;
  }

  return {
    monsterId: monster.id,
    monsterName: def?.name ?? monster.id,
    monsterEmoji: def?.emoji ?? '👹',
    monsterLevel: monster.level,
    rosterIndex,
    action,
    currentEquipment,
    recommendedEquipment: equipmentUpgrade ? {
      id: equipmentUpgrade.id,
      name: equipmentUpgrade.name,
      emoji: equipmentUpgrade.emoji,
    } : null,
    whyNow,
    costOrDeficit,
    xpProgress,
    room,
    estimatedPowerDelta,
    score: getGrowthScore(action, room, estimatedPowerDelta, xpProgress.percent),
  };
}

interface EquipmentUpgrade {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly impact: number;
  readonly room: RoomReinforcementProjection;
}

function getBestOwnedEquipmentUpgrade(state: GameState, monster: OwnedMonster): EquipmentUpgrade | null {
  const currentImpact = getEquipmentImpact(monster);
  return getOwnedValidEquipment(state)
    .filter(candidate => candidate.id !== monster.equipment)
    .map(candidate => {
      const room = projectRoomReinforcement(state, monster.id, { equipment: candidate.id });
      return {
        ...candidate,
        impact: getEquipmentImpact({ ...monster, equipment: candidate.id }) - currentImpact,
        room,
      };
    })
    .filter(candidate => candidate.impact > 0)
    .sort((a, b) => b.impact - a.impact || a.id.localeCompare(b.id))[0] ?? null;
}

function getOwnedValidEquipment(state: GameState): Array<{ id: string; name: string; emoji: string }> {
  const ownedIds = new Set([
    ...(state.ownedEquipment ?? []),
    ...(state.craftedEquipment ?? []).map(equipment => equipment.id),
  ]);
  return Array.from(ownedIds)
    .map(id => getEquipmentDisplay(state, id))
    .filter((equipment): equipment is { id: string; name: string; emoji: string } => Boolean(equipment))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getEquipmentDisplay(
  state: GameState,
  equipmentId: string | null,
): { id: string; name: string; emoji: string } | null {
  if (!equipmentId) return null;
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { id: staticDef.id, name: staticDef.name, emoji: staticDef.icon };
  const crafted = (state.craftedEquipment ?? []).find(equipment => equipment.id === equipmentId);
  if (crafted) return { id: crafted.id, name: crafted.name, emoji: crafted.emoji };
  return null;
}

function getEquipmentImpact(monster: OwnedMonster): number {
  const def = getMonsterDef(monster.id);
  const baseAttack = getMonsterAtk(def?.baseDamage ?? 10, monster.level, monster.spentSkills ?? {});
  const stats = getEquipmentStats(monster.equipment);
  return Math.round(baseAttack * (stats.atkMult ?? 0))
    + Math.round((stats.roomHpBonus ?? 0) / 20)
    + Math.round((stats.stunBonus ?? 0) / 100)
    + Math.round((stats.freezeChance ?? 0) * 40)
    + Math.round((stats.executeChance ?? 0) * 80)
    + Math.round((stats.procBonus ?? 0) * 60)
    + Math.round(Math.max(0, 1 - (stats.skillCdMult ?? 1)) * 40)
    + Math.round((stats.goldMult ?? 0) * 25)
    + Math.round((stats.crystalMult ?? 0) * 30);
}

function getGrowthScore(
  action: GrowthRecommendationAction,
  room: RoomReinforcementProjection,
  estimatedPowerDelta: number | null,
  xpPercent: number,
): number {
  const actionScore: Record<GrowthRecommendationAction, number> = {
    sp: 600,
    'level-up': 500,
    equip: 400,
    feed: 300,
    'blocked-feed': 200,
    ready: 100,
  };
  return actionScore[action]
    + (room.kind === 'assigned' ? 40 : room.kind === 'recommended' ? 20 : 0)
    + Math.max(0, estimatedPowerDelta ?? 0)
    + xpPercent;
}

function getMonsterDef(monsterId: string) {
  return resolveOwnedMonsterProfile(monsterId);
}
