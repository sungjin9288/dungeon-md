/**
 * 던전 배치도 — 주 통로(입구 → 심장부 한 줄) + 주 통로 방 위·아래의 곁방.
 * (설계: docs/design/DUNGEON_EXPANSION_DESIGN.md)
 *
 * 방의 내용(방 종류·수호자·함정·레벨)은 여전히 `GameState.dungeonSlots[slot]`에 있다. 배치도는 그 슬롯들이
 * 던전 안 어디에 있는지만 말한다 — 그래서 슬롯 번호를 키로 쓰는 기존 기능(내구도·추천·근무 등)은 그대로 둔다.
 *
 * 레벨은 "허가", 골드는 "굴착비", 보석은 "특전(추가 허가증)"이다. 순수 함수만 둔다(Phaser 없음).
 */
import { getUnlockedSlotCount, type GameState } from './wisdom';

export type SideDir = 'up' | 'down';

/** 주 통로 `anchor`번째 방의 위 또는 아래에 붙은 곁방. `slot`은 dungeonSlots 인덱스. */
export interface SideRoom {
  readonly slot: number;
  readonly anchor: number;
  readonly side: SideDir;
}

export interface DungeonPlan {
  /** 입구에서 심장부 순서의 dungeonSlots 인덱스. 침입자가 이 순서로 지난다. */
  readonly corridor: readonly number[];
  readonly sides: readonly SideRoom[];
}

export interface DungeonLicenses {
  /** 보석으로 산 주 통로 추가 허가(최대 MAX_CORRIDOR_LICENSES). */
  readonly corridor: number;
  /** 보석으로 산 곁방 추가 허가(최대 MAX_SIDE_LICENSES). */
  readonly side: number;
  /** 옛 3×3 던전에서 이전할 때 레벨 허가를 넘던 칸 — 손실 없이 인정한다. */
  readonly legacyCorridor: number;
}

// ─── 허가 표 ─────────────────────────────────────────────────────────────────

/** [DM 레벨, 주 통로 허가 칸 수] — 레벨업마다가 아니라 정해진 레벨에서만 오른다. */
export const CORRIDOR_PERMIT_LEVELS: readonly (readonly [number, number])[] = [
  [1, 1], [2, 2], [3, 3], [5, 4], [7, 5], [9, 6], [12, 7], [15, 8], [18, 9], [22, 10],
];
/** [DM 레벨, 곁방 허가 칸 수]. */
export const SIDE_PERMIT_LEVELS: readonly (readonly [number, number])[] = [
  [4, 1], [6, 2], [8, 3], [11, 4], [14, 5], [17, 6], [20, 7], [24, 8],
];

export const MAX_CORRIDOR_LICENSES = 2;
export const MAX_SIDE_LICENSES = 4;
/** 보석 특전 가격(n번째 허가증). */
export const CORRIDOR_LICENSE_GEMS: readonly number[] = [300, 600];
export const SIDE_LICENSE_GEMS: readonly number[] = [200, 300, 400, 500];

export const MAX_CORRIDOR_ROOMS = 10 + MAX_CORRIDOR_LICENSES;   // 12
export const MAX_SIDE_ROOMS = 8 + MAX_SIDE_LICENSES;            // 12

const EMPTY_LICENSES: DungeonLicenses = { corridor: 0, side: 0, legacyCorridor: 0 };

function permitFrom(table: readonly (readonly [number, number])[], dmLevel: number): number {
  let count = 0;
  for (const [level, value] of table) if (dmLevel >= level) count = value;
  return count;
}

export function getCorridorPermit(dmLevel: number): number {
  return permitFrom(CORRIDOR_PERMIT_LEVELS, dmLevel);
}

export function getSidePermit(dmLevel: number): number {
  return permitFrom(SIDE_PERMIT_LEVELS, dmLevel);
}

export function getLicenses(state: Readonly<Pick<GameState, 'dungeonLicenses'>>): DungeonLicenses {
  return { ...EMPTY_LICENSES, ...(state.dungeonLicenses ?? {}) };
}

/** 지금 가질 수 있는 주 통로 칸 수(레벨 허가 + 보석 허가증 + 옛 던전 허가). */
export function getCorridorCapacity(state: Readonly<Pick<GameState, 'dmLevel' | 'dungeonLicenses'>>): number {
  const licenses = getLicenses(state);
  const capacity = getCorridorPermit(state.dmLevel ?? 1) + licenses.corridor + licenses.legacyCorridor;
  return Math.min(MAX_CORRIDOR_ROOMS + licenses.legacyCorridor, capacity);
}

/** 곁방 칸 수(레벨 허가 + 보석 허가증). */
export function getSideCapacity(state: Readonly<Pick<GameState, 'dmLevel' | 'dungeonLicenses'>>): number {
  const licenses = getLicenses(state);
  return Math.min(MAX_SIDE_ROOMS, getSidePermit(state.dmLevel ?? 1) + licenses.side);
}

// ─── 굴착비 ──────────────────────────────────────────────────────────────────

/** n번째 칸(주 통로 + 곁방 합산, 1부터)을 파는 골드. 첫 칸은 시작 던전이라 무료. */
export function getDigCost(nthRoom: number): number {
  if (nthRoom <= 1) return 0;
  return Math.round((150 * nthRoom ** 1.6) / 10) * 10;
}

// ─── 옛 3×3 격자 → 배치도 ────────────────────────────────────────────────────

/**
 * 옛 전투 경로가 격자 칸을 지나던 순서(입구 쪽 먼저): 0행 오른쪽→왼쪽, 1행 왼쪽→오른쪽, 2행 오른쪽→왼쪽.
 * `DungeonBoardLayout` INVASION_ORDER와 같은 순서다.
 */
export const LEGACY_GRID_ROUTE: readonly number[] = [2, 1, 0, 3, 4, 5, 8, 7, 6];

/** 배치도가 없는 세이브: 지금 열린 격자 칸을 옛 침입 순서대로 한 줄 주 통로로 본다(현재 전투와 같다). */
export function planFromLegacyGrid(state: Readonly<Pick<GameState, 'dmLevel' | 'wisdomTree'>>): DungeonPlan {
  const open = getUnlockedSlotCount(state);
  return { corridor: LEGACY_GRID_ROUTE.filter(slot => slot < open), sides: [] };
}

export function getDungeonPlan(state: Readonly<Pick<GameState, 'dungeonPlan' | 'dmLevel' | 'wisdomTree'>>): DungeonPlan {
  return state.dungeonPlan ?? planFromLegacyGrid(state);
}

/**
 * 새 규칙으로 넘어갈 때 한 번: 배치도를 저장하고, 레벨 허가를 넘던 옛 칸은 "옛 던전 허가"로 인정한다.
 * 이미 배치도가 있으면 그대로 둔다(같은 참조).
 */
export function migrateToDungeonPlan(state: GameState): GameState {
  if (state.dungeonPlan) return state;
  const plan = planFromLegacyGrid(state);
  const permit = getCorridorPermit(state.dmLevel ?? 1);
  const licenses = getLicenses(state);
  return {
    ...state,
    dungeonPlan: plan,
    dungeonLicenses: { ...licenses, legacyCorridor: Math.max(licenses.legacyCorridor, plan.corridor.length - permit) },
  };
}

// ─── 조회 ────────────────────────────────────────────────────────────────────

export function countRooms(plan: DungeonPlan): number {
  return plan.corridor.length + plan.sides.length;
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
