/**
 * 던전 확장 거래 — 주 통로 굴착, 곁방 굴착, 보석 허가증 구매. 순수 함수이며 저장은 호출 쪽이 한다.
 * 파낸 칸은 "빈 터"로 생기고, 방 종류는 기존 방 설계 흐름(roomSlotTransactions)으로 정한다.
 */
import {
  CORRIDOR_LICENSE_GEMS,
  MAX_CORRIDOR_LICENSES,
  MAX_SIDE_LICENSES,
  SIDE_LICENSE_GEMS,
  countRooms,
  getCorridorCapacity,
  getDigCost,
  getDungeonPlan,
  getLicenses,
  getSideCapacity,
  hasSide,
  migrateToDungeonPlan,
  nextFreeSlot,
  type DungeonPlan,
  type SideDir,
} from './dungeonPlan';
import type { GameState } from './wisdom';

export type DungeonExpandFailure =
  | 'no_permit'           // 레벨 허가·허가증 칸을 다 썼다
  | 'insufficient_gold'
  | 'invalid_anchor'      // 곁방을 붙일 주 통로 방이 없다
  | 'occupied'            // 그 자리에 이미 곁방이 있다
  | 'max_licenses'
  | 'insufficient_gems';

export type DungeonExpandResult =
  | { readonly ok: true; readonly state: GameState; readonly slot?: number; readonly cost: number }
  | { readonly ok: false; readonly state: GameState; readonly reason: DungeonExpandFailure };

function fail(state: GameState, reason: DungeonExpandFailure): DungeonExpandResult {
  return { ok: false, state, reason };
}

/** 새 칸을 파고 골드를 낸다. 배치도가 아직 없던 세이브는 먼저 옛 던전 허가와 함께 이전한다. */
function dig(
  state: GameState,
  build: (plan: DungeonPlan, slot: number) => DungeonPlan,
): DungeonExpandResult {
  const plan = getDungeonPlan(state);
  const cost = getDigCost(countRooms(plan) + 1);
  if ((state.homeGold ?? 0) < cost) return fail(state, 'insufficient_gold');
  const slot = nextFreeSlot(plan, state.dungeonSlots ?? []);
  return {
    ok: true,
    slot,
    cost,
    state: { ...state, homeGold: (state.homeGold ?? 0) - cost, dungeonPlan: build(plan, slot) },
  };
}

/** 주 통로 끝(심장부 쪽)에 한 칸. */
export function digCorridorRoom(input: GameState): DungeonExpandResult {
  const state = migrateToDungeonPlan(input);
  if (getDungeonPlan(state).corridor.length >= getCorridorCapacity(state)) return fail(input, 'no_permit');
  return withInputOnFailure(input, dig(state, (plan, slot) => ({ ...plan, corridor: [...plan.corridor, slot] })));
}

/** 주 통로 `anchor`번째 방의 위 또는 아래에 곁방 한 칸. */
export function digSideRoom(input: GameState, anchor: number, side: SideDir): DungeonExpandResult {
  const state = migrateToDungeonPlan(input);
  const plan = getDungeonPlan(state);
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= plan.corridor.length) return fail(input, 'invalid_anchor');
  if (hasSide(plan, anchor, side)) return fail(input, 'occupied');
  if (plan.sides.length >= getSideCapacity(state)) return fail(input, 'no_permit');
  return withInputOnFailure(input, dig(state, (current, slot) => ({ ...current, sides: [...current.sides, { slot, anchor, side }] })));
}

export type DungeonLicenseKind = 'corridor' | 'side';

/** 보석 특전: 레벨 한계를 넘는 영구 허가 한 칸. */
export function buyDungeonLicense(state: GameState, kind: DungeonLicenseKind): DungeonExpandResult {
  const licenses = getLicenses(state);
  const owned = licenses[kind];
  const max = kind === 'corridor' ? MAX_CORRIDOR_LICENSES : MAX_SIDE_LICENSES;
  if (owned >= max) return fail(state, 'max_licenses');
  const price = (kind === 'corridor' ? CORRIDOR_LICENSE_GEMS : SIDE_LICENSE_GEMS)[owned];
  if ((state.gems ?? 0) < price) return fail(state, 'insufficient_gems');
  return {
    ok: true,
    cost: price,
    state: { ...state, gems: (state.gems ?? 0) - price, dungeonLicenses: { ...licenses, [kind]: owned + 1 } },
  };
}

/** 실패하면 이전(migrate)도 하지 않은 원래 상태를 돌려준다 — 거절된 조작이 저장을 바꾸지 않게. */
function withInputOnFailure(input: GameState, result: DungeonExpandResult): DungeonExpandResult {
  return result.ok ? result : { ...result, state: input };
}
