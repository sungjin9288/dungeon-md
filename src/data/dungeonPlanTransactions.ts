/**
 * 던전 확장 거래 — 주 통로 굴착, 곁방 굴착, 보석 허가증 구매, 방 자리 바꾸기. 순수 함수이며 저장은 호출 쪽이 한다.
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
  | 'insufficient_gems'
  | 'same_room'           // 자리 바꾸기: 같은 방끼리
  | 'invalid_room';       // 자리 바꾸기: 배치도에 없는 방

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

// ─── 방 자리 바꾸기(재배치) ─────────────────────────────────────────────────────

/** 보석 특전: 자리 바꾸기 한 번의 보석 값. */
export const RELOCATE_GEMS = 10;
const RELOCATE_GOLD_SHARE = 0.25;
const RELOCATE_GOLD_MIN = 100;

/** 골드로 자리를 바꾸는 값 — 지금 던전의 마지막 방 굴착비의 25%(최소 100). 던전이 클수록 비싸다. */
export function getRelocateGoldCost(state: Readonly<GameState>): number {
  const lastDig = getDigCost(countRooms(getDungeonPlan(state)));
  return Math.max(RELOCATE_GOLD_MIN, Math.round((lastDig * RELOCATE_GOLD_SHARE) / 10) * 10);
}

export type RelocatePayment = 'gold' | 'gems';

/**
 * 두 방의 자리를 맞바꾼다(주 통로끼리, 주 통로↔곁방, 곁방끼리). 배치도의 방 번호만 바꾸므로 방 내용
 * (건물·레벨·몬스터·함정·내구도)은 번호를 따라 함께 옮겨 가고, 곁방이 붙은 자리(anchor·위아래)는 그대로다.
 */
export function swapDungeonRooms(
  input: GameState,
  slotA: number,
  slotB: number,
  payment: RelocatePayment,
): DungeonExpandResult {
  if (slotA === slotB) return fail(input, 'same_room');
  const state = migrateToDungeonPlan(input);
  const plan = getDungeonPlan(state);
  const placed = new Set([...plan.corridor, ...plan.sides.map(side => side.slot)]);
  if (!placed.has(slotA) || !placed.has(slotB)) return fail(input, 'invalid_room');
  const cost = payment === 'gold' ? getRelocateGoldCost(state) : RELOCATE_GEMS;
  const purse = payment === 'gold' ? (state.homeGold ?? 0) : (state.gems ?? 0);
  if (purse < cost) return fail(input, payment === 'gold' ? 'insufficient_gold' : 'insufficient_gems');
  const swap = (slot: number): number => (slot === slotA ? slotB : slot === slotB ? slotA : slot);
  const nextPlan: DungeonPlan = {
    corridor: plan.corridor.map(swap),
    sides: plan.sides.map(side => ({ ...side, slot: swap(side.slot) })),
  };
  return {
    ok: true,
    cost,
    state: {
      ...state,
      ...(payment === 'gold' ? { homeGold: purse - cost } : { gems: purse - cost }),
      dungeonPlan: nextPlan,
    },
  };
}

/** 실패하면 이전(migrate)도 하지 않은 원래 상태를 돌려준다 — 거절된 조작이 저장을 바꾸지 않게. */
function withInputOnFailure(input: GameState, result: DungeonExpandResult): DungeonExpandResult {
  return result.ok ? result : { ...result, state: input };
}
