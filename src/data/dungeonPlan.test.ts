import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_PERMIT_LEVELS,
  LEGACY_GRID_ROUTE,
  MAX_CORRIDOR_ROOMS,
  MAX_SIDE_ROOMS,
  SIDE_PERMIT_LEVELS,
  getCorridorCapacity,
  getCorridorPermit,
  getDigCost,
  getDungeonPlan,
  getDungeonRoomCount,
  getSideCapacity,
  getSidePermit,
  migrateToDungeonPlan,
  nextFreeSlot,
  planFromLegacyGrid,
} from './dungeonPlan';
import { buyDungeonLicense, digCorridorRoom, digSideRoom } from './dungeonPlanTransactions';
import { loadGameState, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

describe('허가 표', () => {
  it('레벨업마다가 아니라 정해진 레벨에서만, 상한까지 오른다', () => {
    expect(getCorridorPermit(1)).toBe(1);
    expect(getCorridorPermit(4)).toBe(3);   // DM4에는 새 주 통로 허가가 없다
    expect(getCorridorPermit(22)).toBe(10);
    expect(getCorridorPermit(99)).toBe(10);
    expect(getSidePermit(3)).toBe(0);
    expect(getSidePermit(24)).toBe(8);
    for (const table of [CORRIDOR_PERMIT_LEVELS, SIDE_PERMIT_LEVELS]) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i][0]).toBeGreaterThan(table[i - 1][0]);
        expect(table[i][1]).toBe(table[i - 1][1] + 1);
      }
    }
  });

  it('보석 허가증을 더해도 최대 주 통로 12 · 곁방 12', () => {
    const maxed = state({ dmLevel: 99, dungeonLicenses: { corridor: 2, side: 4, legacyCorridor: 0 } });
    expect(getCorridorCapacity(maxed)).toBe(MAX_CORRIDOR_ROOMS);
    expect(getSideCapacity(maxed)).toBe(MAX_SIDE_ROOMS);
    expect(MAX_CORRIDOR_ROOMS + MAX_SIDE_ROOMS).toBe(24);
  });
});

describe('굴착비', () => {
  it('첫 칸은 무료, 이후 칸마다 오른다', () => {
    expect(getDigCost(1)).toBe(0);
    let previous = 0;
    for (let n = 2; n <= 24; n++) {
      const cost = getDigCost(n);
      expect(cost).toBeGreaterThan(previous);
      expect(cost % 10).toBe(0);
      previous = cost;
    }
  });
});

describe('옛 3×3 격자 → 배치도', () => {
  it('열린 칸을 옛 침입 순서대로 한 줄로 — 지금 전투와 같은 순서', () => {
    expect(LEGACY_GRID_ROUTE).toEqual([2, 1, 0, 3, 4, 5, 8, 7, 6]);
    expect(planFromLegacyGrid(state({ dmLevel: 1 })).corridor).toEqual([2, 1, 0]);
    expect(planFromLegacyGrid(state({ dmLevel: 8 })).corridor).toEqual(LEGACY_GRID_ROUTE);
    expect(planFromLegacyGrid(state({ dmLevel: 8 })).sides).toEqual([]);
  });

  it('배치도가 없으면 계산하고, 있으면 저장된 것을 쓴다', () => {
    const saved = { corridor: [0], sides: [] };
    expect(getDungeonPlan(state({ dmLevel: 8, dungeonPlan: saved }))).toBe(saved);
    expect(getDungeonPlan(state({ dmLevel: 8 })).corridor).toHaveLength(9);
  });

  it('이전 시 레벨 허가를 넘던 옛 칸은 옛 던전 허가로 인정해 손실이 없다', () => {
    const migrated = migrateToDungeonPlan(state({ dmLevel: 8 }));   // 옛 9칸, 새 허가는 5칸
    expect(migrated.dungeonPlan?.corridor).toHaveLength(9);
    expect(migrated.dungeonLicenses?.legacyCorridor).toBe(4);
    expect(getCorridorCapacity(migrated)).toBe(9);
    expect(migrateToDungeonPlan(migrated)).toBe(migrated);
  });
});

describe('새 칸 번호', () => {
  it('배치도에 없고 방이 지어진 적 없는 가장 작은 번호 — 배열 중간을 비우지 않는다', () => {
    expect(nextFreeSlot({ corridor: [2, 1, 0], sides: [] }, [])).toBe(3);
    expect(nextFreeSlot({ corridor: [0], sides: [{ slot: 1, anchor: 0, side: 'up' }] }, [])).toBe(2);
    expect(nextFreeSlot({ corridor: [0], sides: [] }, [undefined, { roomType: 'trap' }])).toBe(2);
  });
});

describe('굴착 거래', () => {
  const fresh = (overrides: Partial<GameState> = {}) =>
    state({ dmLevel: 5, homeGold: 100_000, gems: 1_000, dungeonPlan: { corridor: [0], sides: [] }, ...overrides });

  it('주 통로를 끝에 한 칸 늘리고 골드를 낸다', () => {
    const result = digCorridorRoom(fresh());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.dungeonPlan?.corridor).toEqual([0, 1]);
    expect(result.cost).toBe(getDigCost(2));
    expect(result.state.homeGold).toBe(100_000 - getDigCost(2));
  });

  it('허가를 다 쓰면 거절하고 원래 상태를 돌려준다', () => {
    const full = fresh({ dmLevel: 1 });
    const result = digCorridorRoom(full);
    expect(result).toMatchObject({ ok: false, reason: 'no_permit' });
    expect(result.state).toBe(full);
  });

  it('골드가 모자라면 거절', () => {
    expect(digCorridorRoom(fresh({ homeGold: 0 }))).toMatchObject({ ok: false, reason: 'insufficient_gold' });
  });

  it('배치도가 없던 옛 세이브는 굴착할 때 옛 던전 허가와 함께 이전된다', () => {
    const legacy = state({ dmLevel: 8, homeGold: 100_000 });  // 옛 9칸, 새 허가 5칸
    const result = digCorridorRoom(legacy);
    expect(result).toMatchObject({ ok: false, reason: 'no_permit' });  // 9칸이 이미 허가(5+옛 4)를 다 채움
    expect(result.state).toBe(legacy);                                 // 거절은 저장을 바꾸지 않는다
  });

  it('곁방: 주 통로 방 위·아래에 한 칸씩, 허가 안에서', () => {
    const base = fresh({ dmLevel: 6 });   // 곁방 허가 2
    const up = digSideRoom(base, 0, 'up');
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.state.dungeonPlan?.sides).toEqual([{ slot: 1, anchor: 0, side: 'up' }]);
    expect(digSideRoom(up.state, 0, 'up')).toMatchObject({ ok: false, reason: 'occupied' });
    expect(digSideRoom(up.state, 3, 'down')).toMatchObject({ ok: false, reason: 'invalid_anchor' });
    const down = digSideRoom(up.state, 0, 'down');
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(digSideRoom({ ...down.state, dungeonPlan: { corridor: [0, 5], sides: down.state.dungeonPlan!.sides } }, 1, 'up'))
      .toMatchObject({ ok: false, reason: 'no_permit' });
  });

  it('보석 허가증: 가격대로, 최대 개수까지', () => {
    let current = fresh({ gems: 2_000 });
    const first = buyDungeonLicense(current, 'corridor');
    expect(first).toMatchObject({ ok: true, cost: 300 });
    if (!first.ok) return;
    current = first.state;
    expect(current.gems).toBe(1_700);
    expect(getCorridorCapacity(current)).toBe(getCorridorPermit(5) + 1);
    const second = buyDungeonLicense(current, 'corridor');
    expect(second).toMatchObject({ ok: true, cost: 600 });
    if (!second.ok) return;
    expect(buyDungeonLicense(second.state, 'corridor')).toMatchObject({ ok: false, reason: 'max_licenses' });
    expect(buyDungeonLicense(fresh({ gems: 100 }), 'side')).toMatchObject({ ok: false, reason: 'insufficient_gems' });
  });
});

describe('칸 번호 연속 불변식', () => {
  it('굴착을 반복해도 배치도 슬롯은 항상 0..n-1 — "방 수만큼 0부터 순회"하는 코드가 그대로 맞다', () => {
    let current = state({ dmLevel: 30, homeGold: 10_000_000, dungeonPlan: { corridor: [0], sides: [] } });
    const steps: Array<() => ReturnType<typeof digCorridorRoom>> = [
      () => digCorridorRoom(current), () => digSideRoom(current, 0, 'up'), () => digCorridorRoom(current),
      () => digSideRoom(current, 1, 'down'), () => digCorridorRoom(current), () => digSideRoom(current, 2, 'up'),
    ];
    for (const step of steps) {
      const result = step();
      expect(result.ok).toBe(true);
      current = result.state;
      const plan = getDungeonPlan(current);
      const slots = [...plan.corridor, ...plan.sides.map(side => side.slot)].sort((a, b) => a - b);
      expect(slots).toEqual(Array.from({ length: slots.length }, (_, i) => i));
      expect(getDungeonRoomCount(current)).toBe(slots.length);
    }
  });

  it('옛 세이브의 방 수는 옛 열린 칸 수와 같다', () => {
    for (const dmLevel of [1, 2, 4, 6, 8, 20]) {
      expect(getDungeonRoomCount(state({ dmLevel }))).toBe(planFromLegacyGrid(state({ dmLevel })).corridor.length);
    }
  });
});
