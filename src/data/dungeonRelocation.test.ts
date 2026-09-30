import { describe, expect, it } from 'vitest';
import { countRooms, getDigCost, getDungeonPlan } from './dungeonPlan';
import { RELOCATE_GEMS, getRelocateGoldCost, swapDungeonRooms } from './dungeonPlanTransactions';
import { loadGameState, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), homeGold: 100_000, gems: 100, ...overrides };
}

const plan = {
  corridor: [0, 1, 2, 3],
  sides: [{ slot: 4, anchor: 1, side: 'up' as const }],
};

describe('방 자리 바꾸기', () => {
  it('주 통로 두 방의 순서를 맞바꾸고 골드를 낸다 — 방 내용(dungeonSlots)은 번호를 따라간다', () => {
    const before = state({ dungeonPlan: plan });
    const result = swapDungeonRooms(before, 0, 3, 'gold');
    expect(result.ok).toBe(true);
    expect(getDungeonPlan(result.state).corridor).toEqual([3, 1, 2, 0]);
    expect(result.state.homeGold).toBe(100_000 - getRelocateGoldCost(before));
    expect(result.state.gems).toBe(100);
    expect(result.state.dungeonSlots).toBe(before.dungeonSlots);
  });

  it('주 통로 방과 곁방을 맞바꾼다 — 곁방이 붙은 자리(anchor·위아래)는 그대로', () => {
    const result = swapDungeonRooms(state({ dungeonPlan: plan }), 4, 2, 'gold');
    expect(getDungeonPlan(result.state)).toEqual({
      corridor: [0, 1, 4, 3],
      sides: [{ slot: 2, anchor: 1, side: 'up' }],
    });
  });

  it('보석 특전으로 내면 골드는 그대로 두고 보석만 쓴다', () => {
    const result = swapDungeonRooms(state({ dungeonPlan: plan }), 1, 2, 'gems');
    expect(result.ok).toBe(true);
    expect(result.state.gems).toBe(100 - RELOCATE_GEMS);
    expect(result.state.homeGold).toBe(100_000);
  });

  it('같은 방·배치도에 없는 방·잔액 부족은 거절하고 저장을 바꾸지 않는다', () => {
    const base = state({ dungeonPlan: plan });
    expect(swapDungeonRooms(base, 1, 1, 'gold')).toMatchObject({ ok: false, reason: 'same_room', state: base });
    expect(swapDungeonRooms(base, 1, 9, 'gold')).toMatchObject({ ok: false, reason: 'invalid_room', state: base });
    const poor = state({ dungeonPlan: plan, homeGold: 0, gems: 0 });
    expect(swapDungeonRooms(poor, 0, 1, 'gold')).toMatchObject({ ok: false, reason: 'insufficient_gold', state: poor });
    expect(swapDungeonRooms(poor, 0, 1, 'gems')).toMatchObject({ ok: false, reason: 'insufficient_gems', state: poor });
  });

  it('골드 비용은 던전이 클수록 비싸다(마지막 방 굴착비의 25%, 최소 100)', () => {
    const small = state({ dungeonPlan: { corridor: [0], sides: [] } });
    expect(getRelocateGoldCost(small)).toBe(100);
    const big = state({ dungeonPlan: plan });
    expect(getRelocateGoldCost(big)).toBe(Math.round((getDigCost(countRooms(plan)) * 0.25) / 10) * 10);
    expect(getRelocateGoldCost(big)).toBeGreaterThan(getRelocateGoldCost(small));
  });

  it('어떤 교환이든 방 번호 집합·곁방 자리 수는 그대로다', () => {
    const base = state({ dungeonPlan: plan });
    const all = [0, 1, 2, 3, 4];
    for (const a of all) {
      for (const b of all) {
        if (a === b) continue;
        const next = getDungeonPlan(swapDungeonRooms(base, a, b, 'gold').state);
        expect([...next.corridor, ...next.sides.map(side => side.slot)].sort()).toEqual(all);
        expect(next.sides.map(side => [side.anchor, side.side])).toEqual([[1, 'up']]);
      }
    }
  });
});
