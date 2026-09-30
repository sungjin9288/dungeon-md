/**
 * 던전 배치도 — 주 통로(입구 → 심장부 한 줄) + 주 통로 방 위·아래의 곁방.
 * (설계: docs/design/DUNGEON_EXPANSION_DESIGN.md)
 *
 * 방의 내용(방 종류·수호자·함정·레벨)은 여전히 `GameState.dungeonSlots[slot]`에 있다. 배치도는 그 슬롯들이
 * 던전 안 어디에 있는지만 말한다 — 그래서 슬롯 번호를 키로 쓰는 기존 기능(내구도·추천·근무 등)은 그대로 둔다.
 *
 * 레벨은 "허가", 골드는 "굴착비", 보석은 "특전(추가 허가증)"이다. 순수 함수만 둔다(Phaser 없음).
 */
import {
  MAX_CORRIDOR_ROOMS,
  MAX_SIDE_ROOMS,
  getCorridorPermit,
  getLicenses,
  getSidePermit,
  legacyGridPlan,
  type DungeonPlan,
  type SideDir,
} from './dungeonPlanRules';
import { getAncestorsWisdomEffect, getUnlockedSlotCount, migrateToDungeonPlan as migrateToDungeonPlanRules, type GameState } from './wisdom';

export * from './dungeonPlanRules';


// ─── 수용량 ───────────────────────────────────────────────────────────────────

/** 지금 가질 수 있는 주 통로 칸 수(레벨 허가 + 보석 허가증 + 옛 던전 허가). */
export function getCorridorCapacity(state: Readonly<Pick<GameState, 'dmLevel' | 'dungeonLicenses'>>): number {
  const licenses = getLicenses(state);
  const capacity = getCorridorPermit(state.dmLevel ?? 1) + licenses.corridor + licenses.legacyCorridor;
  return Math.min(MAX_CORRIDOR_ROOMS + licenses.legacyCorridor, capacity);
}

/** 곁방 칸 수(레벨 허가 + 보석 허가증 + 선조의 지혜). */
export function getSideCapacity(
  state: Readonly<Pick<GameState, 'dmLevel' | 'dungeonLicenses' | 'dungeonPlan' | 'wisdomTree'>>,
): number {
  const licenses = getLicenses(state);
  const wisdom = state.dungeonPlan ? getAncestorsWisdomEffect(state).extraSlots : 0;
  return Math.min(MAX_SIDE_ROOMS, getSidePermit(state.dmLevel ?? 1) + licenses.side + wisdom);
}

/** 지금 가질 수 있는 방 칸 수 합계(주 통로 + 곁방 허가). 레벨업 안내가 이 값의 변화를 보여준다. */
export function getDigPermitTotal(
  state: Readonly<Pick<GameState, 'dmLevel' | 'dungeonLicenses' | 'dungeonPlan' | 'wisdomTree'>>,
): number {
  return getCorridorCapacity(state) + getSideCapacity(state);
}

// ─── 옛 3×3 격자 → 배치도 ────────────────────────────────────────────────────

/** 배치도가 없는 세이브: 지금 열린 격자 칸을 옛 침입 순서대로 한 줄 주 통로로 본다(현재 전투와 같다). */
export function planFromLegacyGrid(state: Readonly<Pick<GameState, 'dmLevel' | 'wisdomTree'>>): DungeonPlan {
  return legacyGridPlan(getUnlockedSlotCount(state));
}

export function getDungeonPlan(state: Readonly<Pick<GameState, 'dungeonPlan' | 'dmLevel' | 'wisdomTree'>>): DungeonPlan {
  return state.dungeonPlan ?? planFromLegacyGrid(state);
}

/** 불러오기와 같은 이전(이미 배치도가 있으면 같은 참조). */
export function migrateToDungeonPlan(state: GameState): GameState {
  return migrateToDungeonPlanRules(state);
}

// ─── 조회 ────────────────────────────────────────────────────────────────────

export function countRooms(plan: DungeonPlan): number {
  return plan.corridor.length + plan.sides.length;
}

/**
 * 던전의 방 칸 수(주 통로 + 곁방). 칸 번호는 항상 0..n-1로 연속이다 — 새 칸은 가장 작은 빈 번호를 받고
 * (nextFreeSlot), 옛 격자 이전도 열린 칸 0..k-1을 그대로 쓴다. 그래서 "0..n-1 슬롯" 순회 코드는 그대로 맞다.
 * 순서가 중요한 표시(침입 경로)는 getDungeonPlan(state).corridor 순서를 쓸 것.
 */
export function getDungeonRoomCount(
  state: Readonly<Pick<GameState, 'dungeonPlan' | 'dmLevel' | 'wisdomTree'>>,
): number {
  return countRooms(getDungeonPlan(state));
}

/**
 * 새 칸에 줄 dungeonSlots 인덱스: 배치도에 없고 방이 지어진 적도 없는 가장 작은 번호.
 * 뒤로 건너뛰면 배열 중간이 비어, 배열을 순회하는 기존 코드가 빈 칸을 만난다.
 */
export function nextFreeSlot(plan: DungeonPlan, slots: readonly ({ roomType?: unknown } | undefined | null)[]): number {
  const used = new Set([...plan.corridor, ...plan.sides.map(side => side.slot)]);
  for (let slot = 0; ; slot++) {
    if (!used.has(slot) && !slots[slot]?.roomType) return slot;
  }
}

export function hasSide(plan: DungeonPlan, anchor: number, side: SideDir): boolean {
  return plan.sides.some(room => room.anchor === anchor && room.side === side);
}
