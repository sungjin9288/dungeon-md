/**
 * 홈 굴착 자리 → 화면에 보여줄 내용(순수). 굴착 확인 창과 보드의 굴착 타일이 같은 판정을 쓴다.
 */
import {
  CORRIDOR_LICENSE_GEMS,
  CORRIDOR_PERMIT_LEVELS,
  MAX_CORRIDOR_LICENSES,
  MAX_SIDE_LICENSES,
  SIDE_LICENSE_GEMS,
  SIDE_PERMIT_LEVELS,
  countRooms,
  getCorridorCapacity,
  getCorridorPermit,
  getDigCost,
  getDungeonPlan,
  getLicenses,
  getSideCapacity,
  getSidePermit,
  type DungeonPlan,
} from './dungeonPlan';
import type { DungeonLicenseKind } from './dungeonPlanTransactions';
import type { GameState } from './wisdom';

export type DigSpotKind = 'corridor' | 'up' | 'down';

export interface DigSpotView {
  readonly title: string;
  readonly cost: number;
  readonly canAfford: boolean;
  /** 허가가 남아 있는가(레벨 + 보석 허가증 + 옛 던전 허가). */
  readonly hasPermit: boolean;
  /** "주 통로 4 / 5칸" 같은 현재 사용량. */
  readonly usageLine: string;
  /** 허가가 없을 때: 무료로 한 칸 더 열리는 다음 DM 레벨(없으면 null). */
  readonly nextPermitDm: number | null;
  /** 허가가 없을 때 살 수 있는 보석 허가증(최대치면 null). */
  readonly licenseOffer: { readonly kind: DungeonLicenseKind; readonly gems: number } | null;
  readonly canDig: boolean;
  /** 굴착할 수 없는 이유(보드 타일·버튼 문구). */
  readonly blocker: string | null;
}

function nextPermitLevel(table: readonly (readonly [number, number])[], dmLevel: number): number | null {
  return table.find(([level]) => level > dmLevel)?.[0] ?? null;
}

export function getDigSpotView(state: Readonly<GameState>, kind: DigSpotKind): DigSpotView {
  const plan = getDungeonPlan(state);
  const dm = state.dmLevel ?? 1;
  const corridor = kind === 'corridor';
  const used = corridor ? plan.corridor.length : plan.sides.length;
  const capacity = corridor ? getCorridorCapacity(state) : getSideCapacity(state);
  const hasPermit = used < capacity;
  const cost = getDigCost(countRooms(plan) + 1);
  const canAfford = (state.homeGold ?? 0) >= cost;
  const licenses = getLicenses(state);
  const licenseKind: DungeonLicenseKind = corridor ? 'corridor' : 'side';
  const owned = licenses[licenseKind];
  const maxLicenses = corridor ? MAX_CORRIDOR_LICENSES : MAX_SIDE_LICENSES;
  const prices = corridor ? CORRIDOR_LICENSE_GEMS : SIDE_LICENSE_GEMS;
  const levelPermit = corridor ? getCorridorPermit(dm) : getSidePermit(dm);
  const nextPermitDm = hasPermit ? null : nextPermitLevel(corridor ? CORRIDOR_PERMIT_LEVELS : SIDE_PERMIT_LEVELS, dm);
  const licenseOffer = !hasPermit && owned < maxLicenses ? { kind: licenseKind, gems: prices[owned] } : null;
  const blocker = !hasPermit
    ? (nextPermitDm !== null ? `DM ${nextPermitDm}에 허가` : '허가 최대')
    : !canAfford ? '골드 부족' : null;
  return {
    title: corridor ? '주 통로 굴착' : `곁방 굴착 · ${kind === 'up' ? '위' : '아래'}`,
    cost,
    canAfford,
    hasPermit,
    usageLine: `${corridor ? '주 통로' : '곁방'} ${used} / ${capacity}칸 · 레벨 허가 ${levelPermit}${owned > 0 ? ` + 허가증 ${owned}` : ''}`,
    nextPermitDm,
    licenseOffer,
    canDig: hasPermit && canAfford,
    blocker,
  };
}

/**
 * 보드에 곁방 굴착 자리를 보여줄지. 곁방 허가가 남았거나, 곁방이 열린 뒤(용량 1+) 살 수 있는 보석 허가증이
 * 남았을 때 — 허가증 구매 창은 이 자리를 눌러야만 열린다. 둘 다 없으면 숨긴다(보드가 +로 뒤덮이지 않게).
 */
export function showSideDigSpots(state: Readonly<GameState>): boolean {
  const capacity = getSideCapacity(state);
  if (getDungeonPlan(state).sides.length < capacity) return true;
  return capacity > 0 && getLicenses(state).side < MAX_SIDE_LICENSES;
}

/** 배치도 안에서 방의 자리 한 줄: "주 통로 3번째" / "곁방 · 2번째 방 위". 배치도에 없으면 null. */
export function roomPositionLabel(plan: DungeonPlan, slot: number): string | null {
  const position = plan.corridor.indexOf(slot);
  if (position >= 0) return `주 통로 ${position + 1}번째`;
  const side = plan.sides.find(room => room.slot === slot);
  return side ? `곁방 · ${side.anchor + 1}번째 방 ${side.side === 'up' ? '위' : '아래'}` : null;
}
