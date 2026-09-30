import { describe, expect, it } from 'vitest';
import { getDigSpotView, showSideDigSpots } from './dungeonDigView';
import { getDigCost } from './dungeonPlan';
import { loadGameState, type GameState } from './wisdom';

const state = (overrides: Partial<GameState>): GameState => ({ ...loadGameState(), ...overrides });
const onePlan = { corridor: [0], sides: [] };

describe('굴착 자리 보기', () => {
  it('허가와 골드가 있으면 굴착 가능, 다음 칸 비용을 보여준다', () => {
    const view = getDigSpotView(state({ dmLevel: 2, homeGold: 10_000, dungeonPlan: onePlan }), 'corridor');
    expect(view).toMatchObject({ canDig: true, hasPermit: true, cost: getDigCost(2), blocker: null, licenseOffer: null });
    expect(view.usageLine).toContain('주 통로 1 / 2칸');
  });

  it('골드가 모자라면 막고 이유를 말한다', () => {
    expect(getDigSpotView(state({ dmLevel: 2, homeGold: 0, dungeonPlan: onePlan }), 'corridor'))
      .toMatchObject({ canDig: false, blocker: '골드 부족' });
  });

  it('허가를 다 쓰면 다음 허가 레벨과 보석 허가증을 제안한다', () => {
    const view = getDigSpotView(state({ dmLevel: 1, homeGold: 10_000, dungeonPlan: onePlan }), 'corridor');
    expect(view).toMatchObject({ canDig: false, hasPermit: false, nextPermitDm: 2, blocker: 'DM 2에 허가' });
    expect(view.licenseOffer).toEqual({ kind: 'corridor', gems: 300 });
  });

  it('곁방은 DM4부터 — 그 전에는 보드에 곁방 굴착 자리를 보이지 않는다', () => {
    expect(showSideDigSpots(state({ dmLevel: 3, dungeonPlan: onePlan }))).toBe(false);
    expect(showSideDigSpots(state({ dmLevel: 4, dungeonPlan: onePlan }))).toBe(true);
    expect(getDigSpotView(state({ dmLevel: 3, homeGold: 10_000, dungeonPlan: onePlan }), 'up'))
      .toMatchObject({ title: '곁방 굴착 · 위', nextPermitDm: 4, licenseOffer: { kind: 'side', gems: 200 } });
  });
});
