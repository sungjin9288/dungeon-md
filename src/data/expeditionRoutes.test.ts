import { describe, expect, it } from 'vitest';
import { getExpeditionRoutes } from './expeditionRoutes';
import { loadGameState, type GameState } from './wisdom';

const TODAY = '2026-10-01';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

describe('원정 메뉴 목록', () => {
  it('심연을 맨 위에 두고, 오늘 열쇠가 아직 안 찼으면 채운 값으로 보여 준다', () => {
    const routes = getExpeditionRoutes(
      state({ abyss: { highestFloor: 7, keys: 2, lastRefill: '2026-09-30' } }), [], TODAY,
    );
    expect(routes[0]).toMatchObject({ key: 'abyss', locked: false, detail: '7층 돌파 · 소탕 열쇠 12' });
    expect(getExpeditionRoutes(state({ abyss: { highestFloor: 0, keys: 12, lastRefill: TODAY } }), [], TODAY)[0].detail)
      .toBe('재료 탐험 · 1층부터');
  });

  it('무한 던전은 관문 10(1장 보스)을 깨야 열린다', () => {
    const locked = getExpeditionRoutes(state(), [], TODAY).find(route => route.key === 'endless');
    expect(locked).toMatchObject({ locked: true, detail: '1장 보스 격파 후 열림' });
    const progress = Array.from({ length: 10 }, () => ({ bestStars: 3 }));
    const open = getExpeditionRoutes(state({ endlessHighScore: 14 }), progress, TODAY).find(route => route.key === 'endless');
    expect(open).toMatchObject({ locked: false, detail: '최고 14웨이브' });
  });

  it('관문 밖 활동 여섯 곳을 모두 담는다', () => {
    expect(getExpeditionRoutes(state(), [], TODAY).map(route => route.key))
      .toEqual(['abyss', 'endless', 'wisdom', 'achievement', 'production', 'decoration']);
  });
});
