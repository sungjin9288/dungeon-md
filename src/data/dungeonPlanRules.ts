/**
 * 던전 배치도 규칙 — 타입·허가 표·보석 허가증·굴착비·옛 격자 이전. GameState를 모른다(wisdom.ts가 불러오기에서
 * 이전을 수행할 수 있게 — dungeonPlan.ts는 wisdom.ts를 쓰므로 거기서 가져오면 순환 참조가 된다).
 * 상태 단위 조회(배치도·수용량·방 수)는 dungeonPlan.ts.
 */

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
  /**
   * 이전 시 지혜의 나무 "선조의 지혜"가 이미 격자 칸으로 열어 둔 수 — 그 칸들은 주 통로(옛 던전 허가)에 들어가
   * 있으므로 곁방 허가로 다시 세지 않는다.
   */
  readonly legacyWisdom: number;
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

const EMPTY_LICENSES: DungeonLicenses = { corridor: 0, side: 0, legacyCorridor: 0, legacyWisdom: 0 };

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

export function getLicenses(state: Readonly<{ dungeonLicenses?: Partial<DungeonLicenses> }>): DungeonLicenses {
  return { ...EMPTY_LICENSES, ...(state.dungeonLicenses ?? {}) };
}

// ─── 굴착비 ──────────────────────────────────────────────────────────────────

/** n번째 칸(주 통로 + 곁방 합산, 1부터)을 파는 골드. 첫 칸은 시작 던전이라 무료. */
export function getDigCost(nthRoom: number): number {
  if (nthRoom <= 1) return 0;
  return Math.round((150 * nthRoom ** 1.6) / 10) * 10;
}

// ─── 새 던전 · 옛 3×3 격자 이전 ───────────────────────────────────────────────

/** 새 던전: 주 통로 1칸(0번 슬롯)에서 시작한다. */
export function starterDungeonPlan(): DungeonPlan {
  return { corridor: [0], sides: [] };
}

/**
 * 옛 전투 경로가 격자 칸을 지나던 순서(입구 쪽 먼저): 0행 오른쪽→왼쪽, 1행 왼쪽→오른쪽, 2행 오른쪽→왼쪽.
 */
export const LEGACY_GRID_ROUTE: readonly number[] = [2, 1, 0, 3, 4, 5, 8, 7, 6];

/** 옛 격자에서 열린 칸 수(0..open-1)를 옛 침입 순서대로 한 줄 주 통로로. */
export function legacyGridPlan(openSlots: number): DungeonPlan {
  return { corridor: LEGACY_GRID_ROUTE.filter(slot => slot < openSlots), sides: [] };
}

interface MigratableState {
  readonly dmLevel?: number;
  readonly dungeonPlan?: DungeonPlan;
  readonly dungeonLicenses?: Partial<DungeonLicenses>;
}

/**
 * 새 규칙으로 넘어갈 때 한 번: 배치도를 저장하고, 레벨 허가를 넘던 옛 칸은 "옛 던전 허가"로 인정한다.
 * `openSlots` = 옛 격자에서 열려 있던 칸, `wisdomSlots` = 그중 선조의 지혜가 연 칸.
 * 이미 배치도가 있으면 그대로 둔다(같은 참조).
 */
export function migrateLegacyDungeon<T extends MigratableState>(state: T, openSlots: number, wisdomSlots: number): T {
  if (state.dungeonPlan) return state;
  const plan = legacyGridPlan(openSlots);
  const licenses = getLicenses(state);
  const permit = getCorridorPermit(state.dmLevel ?? 1);
  return {
    ...state,
    dungeonPlan: plan,
    dungeonLicenses: {
      ...licenses,
      legacyCorridor: Math.max(licenses.legacyCorridor, plan.corridor.length - permit),
      legacyWisdom: Math.max(licenses.legacyWisdom, wisdomSlots),
    },
  };
}
