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
  it('곁방 허가를 다 써도 살 수 있는 허가증이 있으면 곁방 자리를 남긴다(허가증 구매 창의 유일한 입구)', () => {
    const usedSide = { corridor: [0], sides: [{ slot: 1, anchor: 0, side: 'up' as const }] };
    const full = state({ dmLevel: 4, homeGold: 10_000, gems: 1_000, dungeonPlan: usedSide });
    expect(getDigSpotView(full, 'down')).toMatchObject({ hasPermit: false, licenseOffer: { kind: 'side', gems: 200 } });
    expect(showSideDigSpots(full)).toBe(true);
    // 허가증도 다 샀으면 숨긴다(다음 레벨 허가까지 보드를 +로 덮지 않는다).
    const maxed = state({ dmLevel: 4, dungeonPlan: usedSide, dungeonLicenses: { side: 4 } });
    const fullyUsed = { ...usedSide, sides: [0, 1, 2, 3, 4].map(i => ({ slot: i + 1, anchor: 0, side: 'up' as const })) };
    expect(showSideDigSpots({ ...maxed, dungeonPlan: fullyUsed })).toBe(false);
  });
});
