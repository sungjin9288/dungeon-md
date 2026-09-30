/**
 * 배치도 → 전투 칸 위치. 전투 격자는 "위 곁방 줄(0) / 주 통로 줄(1) / 아래 곁방 줄(2)" 3행 × 주 통로 길이 열이다.
 * 주 통로 i번째 방은 (1, i), 그 방의 위·아래 곁방은 (0, i)·(2, i). 순수 함수(Phaser 없음).
 *
 * 격자 행·열을 쓰는 기존 전투 규칙(함정의 열 통과, 상하좌우 인접)은 이 배치에서 그대로 새 의미가 된다:
 * 인접 = 주 통로 앞뒤 방 + 그 방에 붙은 곁방.
 */
import type { DungeonPlan } from './dungeonPlan';

export const TOPOLOGY_ROWS = 3;
export const CORRIDOR_ROW = 1;

export interface TopologyCell {
  readonly slot: number;
  readonly row: number;
  readonly col: number;
}

export interface BattleTopology {
  /** 열 수 = 주 통로 길이(최소 1). */
  readonly cols: number;
  readonly cells: readonly TopologyCell[];
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function buildBattleTopology(plan: DungeonPlan): BattleTopology {
  const corridor = plan.corridor.map((slot, col) => ({ slot, row: CORRIDOR_ROW, col }));
  const sides = plan.sides
    .filter(side => side.anchor >= 0 && side.anchor < plan.corridor.length)
    .map(side => ({ slot: side.slot, row: side.side === 'up' ? 0 : 2, col: side.anchor }));
  return { cols: Math.max(1, plan.corridor.length), cells: [...corridor, ...sides] };
}

/** (행, 열)에 있는 방의 dungeonSlots 인덱스, 칸이 비어 있으면 null. */
export function slotAt(topology: BattleTopology, row: number, col: number): number | null {
  return topology.cells.find(cell => cell.row === row && cell.col === col)?.slot ?? null;
}

export function cellOfSlot(topology: BattleTopology, slot: number): TopologyCell | null {
  return topology.cells.find(cell => cell.slot === slot) ?? null;
}

/**
 * 침입 경로: 왼쪽 입구 → 주 통로 줄을 따라 → 오른쪽 심장부. 입구·심장부는 격자 밖 `margin`만큼.
 * 모든 방을 같은 방향으로 한 번씩 지나며, 뱀처럼 꺾이지 않는다.
 */
export function corridorWaypoints(
  topology: BattleTopology,
  geometry: { readonly gridX: number; readonly gridY: number; readonly cellSize: number; readonly margin: number },
): readonly Point[] {
  const y = geometry.gridY + geometry.cellSize * (CORRIDOR_ROW + 0.5);
  const left = geometry.gridX;
  const right = geometry.gridX + topology.cols * geometry.cellSize;
  return [
    { x: left - geometry.margin, y },   // 입구 밖
    { x: left, y },                      // 첫 방 앞
    { x: right, y },                     // 마지막 방 뒤
    { x: right + geometry.margin, y },   // 심장부
  ];
}

/** 전장 전체 폭(격자 + 양쪽 입구·심장부 여백). 화면보다 넓으면 전투 카메라가 가로로 움직인다. */
export function battlefieldWidth(
  topology: BattleTopology,
  geometry: { readonly gridX: number; readonly cellSize: number; readonly margin: number },
): number {
  return geometry.gridX * 2 + topology.cols * geometry.cellSize + geometry.margin;
}
