import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_ROW,
  battlefieldWidth,
  buildBattleTopology,
  cellOfSlot,
  corridorReach,
  corridorWaypoints,
  neighborSlots,
  slotAt,
} from './battleTopology';

const plan = {
  corridor: [2, 1, 0, 3],
  sides: [
    { slot: 9, anchor: 1, side: 'up' as const },
    { slot: 10, anchor: 3, side: 'down' as const },
    { slot: 11, anchor: 7, side: 'up' as const },   // 없는 주 통로 방에 붙은 곁방은 버린다
  ],
};

describe('배치도 → 전투 칸', () => {
  const topology = buildBattleTopology(plan);

  it('주 통로는 가운데 줄에 입구부터 순서대로, 곁방은 붙은 방의 위·아래', () => {
    expect(topology.cols).toBe(4);
    expect(plan.corridor.map((_, col) => slotAt(topology, CORRIDOR_ROW, col))).toEqual([2, 1, 0, 3]);
    expect(slotAt(topology, 0, 1)).toBe(9);
    expect(slotAt(topology, 2, 3)).toBe(10);
    expect(slotAt(topology, 0, 0)).toBeNull();
    expect(cellOfSlot(topology, 11)).toBeNull();
    expect(cellOfSlot(topology, 0)).toEqual({ slot: 0, row: 1, col: 2 });
  });

  it('인접 = 주 통로 앞뒤 + 붙은 곁방 + 옆 열의 같은 줄 곁방', () => {
    expect(neighborSlots(topology, 1).sort((a, b) => a - b)).toEqual([0, 2, 9]);   // 주 통로 2번째 방
    expect(neighborSlots(topology, 9)).toEqual([1]);                                // 위 곁방은 붙은 방만
    expect(neighborSlots(topology, 11)).toEqual([]);                                // 버려진 곁방
  });

  it('빈 던전도 한 열은 있다', () => {
    expect(buildBattleTopology({ corridor: [], sides: [] }).cols).toBe(1);
  });
});

describe('침입 경로', () => {
  const geometry = { gridX: 30, gridY: 130, cellSize: 110, margin: 50 };

  it('왼쪽 입구에서 주 통로 줄을 따라 오른쪽 심장부로 — 꺾이지 않는 한 줄', () => {
    const points = corridorWaypoints(buildBattleTopology(plan), geometry);
    expect(points.map(p => p.y)).toEqual(Array(4).fill(130 + 110 * 1.5));
    expect(points.map(p => p.x)).toEqual([-20, 30, 30 + 4 * 110, 30 + 4 * 110 + 50]);
    for (let i = 1; i < points.length; i++) expect(points[i].x).toBeGreaterThan(points[i - 1].x);
  });

  it('전장 폭은 주 통로가 길어질수록 넓어진다', () => {
    const short = battlefieldWidth(buildBattleTopology({ corridor: [0], sides: [] }), geometry);
    const long = battlefieldWidth(buildBattleTopology({ corridor: [0, 1, 2, 3, 4, 5, 6, 7, 8], sides: [] }), geometry);
    expect(long - short).toBe(8 * 110);
  });
});

describe('가로 도달 거리', () => {
  it('사거리 1은 좌우 1.3칸, 사거리가 늘면 칸 단위로 늘어난다', () => {
    expect(corridorReach(110, 1)).toBeCloseTo(143);
    expect(corridorReach(110, 2)).toBeCloseTo(253);
    expect(corridorReach(110, 0)).toBeCloseTo(143);   // 사거리 0 이하도 최소 1칸
  });
});
