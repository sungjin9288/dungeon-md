/**
 * 손님(침입자) 종류 — 누가 왜 오고, 던전 어디로 가는가. (설계: docs/design/DUNGEON_EXPANSION_DESIGN.md §2)
 *
 * - 토벌대(raider): 던전을 없애러 온다. 주 통로 → 심장부. 도착하면 던전 피해(기존 침입과 같다).
 * - 모험가(adventurer): 보물을 노린다. 보물고(황금 광맥·대형 보물고)로 돌아 들어갔다가 입구로 빠져나간다.
 *   빠져나가면 전리품 골드를 훔쳐 가고, 잡으면 재료를 한 번 더 떨군다.
 * - 떠돌이 몬스터(wanderer): 머물 굴(용의 둥지·고급 몬스터 굴)을 찾는다. 도착하면 포섭(계약)을 시도한다.
 *
 * 목표 방이 없으면 모험가·떠돌이 몬스터도 토벌대처럼 심장부로 간다 — 목적 방을 지을지가 플레이어의 선택이다.
 * 라이벌 던전마스터는 토벌대 경로를 쓰는 보스 손님이다(예보 카드의 이름·보상으로만 다르다). 순수 모듈.
 */
import type { DungeonPlan } from './dungeonPlanRules';
import { DROP_TABLE } from './fusion';
import { getSlotBuilding } from './roomBuildings';
import type { InvaderType } from './invaders';
import type { TribeId } from './monstersTypes';
import type { RoomType } from './rooms';
import type { DungeonSlot } from './wisdom';

export type VisitorKind = 'raider' | 'adventurer' | 'wanderer';

/** 목적이 있는 손님이 찾는 건물(보석 특수 방 포함) — 여럿이면 입구에서 가까운 것. */
export const VISITOR_TARGET_BUILDINGS: Readonly<Record<Exclude<VisitorKind, 'raider'>, readonly RoomType[]>> = {
  adventurer: ['gold', 'grand_vault'],
  wanderer: ['dragons_lair', 'elite_den'],
};

export const VISITOR_LABEL: Readonly<Record<VisitorKind, string>> = {
  raider: '토벌대',
  adventurer: '모험가',
  wanderer: '떠돌이 몬스터',
};

/** 모험가가 빠져나갈 때 훔쳐 가는 전리품 골드 = 처치 보상 × 이 배수. */
export const ADVENTURER_STEAL_MULT = 3;
/** 떠돌이 몬스터가 굴에 닿았을 때 포섭 성공 확률과 성공 시 부족 조각. */
export const WANDERER_RECRUIT_CHANCE = 0.4;
export const WANDERER_RECRUIT_SHARDS = 10;
/** 고급 몬스터 굴(보석 특수 방)에 닿았을 때의 포섭 확률과 조각. */
export const ELITE_DEN_RECRUIT_CHANCE = 0.7;
export const ELITE_DEN_RECRUIT_SHARDS = 20;

/** 떠돌이 몬스터로 오는 괴물형 침입자와, 포섭하면 조각을 주는 부족. */
export const WANDERER_TRIBE: Readonly<Partial<Record<InvaderType, TribeId>>> = {
  plague_rat: 'dokkaebi',
  ghost_add: 'underworld',
  bone_archer: 'underworld',
  fox_spirit: 'gumiho',
  swarm_spawn: 'void',
  shadow_wraith: 'underworld',
  swarm_larva: 'void',
};

type SlotLike = Pick<DungeonSlot, 'roomType' | 'building' | 'hp'> | null | undefined;

/**
 * 손님이 찾아갈 방의 슬롯, 없으면 null. 입구에서 가장 가까운(주 통로 위치가 앞선) 멀쩡한 목적 건물을 고른다.
 * 곁방은 붙은 주 통로 방의 위치로 잰다.
 */
export function findVisitorTarget(
  plan: DungeonPlan,
  slots: readonly SlotLike[],
  kind: VisitorKind,
): number | null {
  if (kind === 'raider') return null;
  const wanted = VISITOR_TARGET_BUILDINGS[kind];
  const isTarget = (slot: number): boolean => {
    const data = slots[slot];
    if (!data?.roomType || data.hp <= 0) return false;
    const building = getSlotBuilding(data);
    return building !== null && wanted.includes(building);
  };
  const candidates = [
    ...plan.corridor.map((slot, position) => ({ slot, position })),
    ...plan.sides
      .filter(side => side.anchor >= 0 && side.anchor < plan.corridor.length)
      .map(side => ({ slot: side.slot, position: side.anchor })),
  ].filter(candidate => isTarget(candidate.slot));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, next) => (next.position < best.position ? next : best)).slot;
}

// ─── 도착·처치 결과(전투가 부른다) ──────────────────────────────────────────────

/** 모험가가 빠져나가며 훔치는 전리품 골드 — 가진 전리품보다 많이 가져가지는 못한다. */
export function adventurerStealAmount(reward: number, lootHeld: number): number {
  return Math.max(0, Math.min(Math.floor(lootHeld), Math.round(reward * ADVENTURER_STEAL_MULT)));
}

/** 모험가를 잡으면 짐에서 확정으로 떨어지는 재료(그 침입자의 첫 드롭, 없으면 헌 천). */
export function adventurerLoot(type: InvaderType): string {
  return DROP_TABLE[type]?.[0]?.id ?? 'old_cloth';
}

/**
 * 떠돌이 몬스터가 굴에 닿았을 때 포섭 판정. `roll`은 0..1 난수, `den`은 닿은 굴의 건물(고급 몬스터 굴이면 더 잘
 * 포섭하고 조각도 많다). 성공하면 그 괴물의 부족 조각을 준다. 부족이 정해지지 않은 침입자는 포섭할 수 없다.
 */
export function resolveWandererArrival(
  type: InvaderType,
  roll: number,
  den: RoomType | null = 'dragons_lair',
): { tribe: TribeId; shards: number } | null {
  const tribe = WANDERER_TRIBE[type];
  const elite = den === 'elite_den';
  if (!tribe || roll >= (elite ? ELITE_DEN_RECRUIT_CHANCE : WANDERER_RECRUIT_CHANCE)) return null;
  return { tribe, shards: elite ? ELITE_DEN_RECRUIT_SHARDS : WANDERER_RECRUIT_SHARDS };
}
