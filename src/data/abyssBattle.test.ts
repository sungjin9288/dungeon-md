import { describe, expect, it } from 'vitest';
import { loadGameState, type GameState } from './wisdom';
import { abyssBattleFloor, getAbyssBattleLabels } from './abyssBattle';
import { settleAbyssBattle } from './abyssTransactions';

const ALWAYS = (): number => 0;

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(),
    homeGold: 100,
    totalGoldEarned: 0,
    materials: {},
    abyss: { highestFloor: 0, keys: 12, lastRefill: '2026-10-01' },
    ...overrides,
  };
}

describe('심연 전투 판정·이름표', () => {
  it('원정실로 돌아가는 전투이고 층이 있을 때만 심연 전투다', () => {
    expect(abyssBattleFloor('AbyssScene', 3)).toBe(3);
    expect(abyssBattleFloor('DungeonHomeScene', 3)).toBeNull();
    expect(abyssBattleFloor('AbyssScene', undefined)).toBeNull();
    expect(abyssBattleFloor('AbyssScene', 0)).toBeNull();
  });

  it('홈 침략 방어가 아니라 심연 원정으로 읽힌다', () => {
    expect(getAbyssBattleLabels(12)).toMatchObject({
      clearTitle: '심연 12층 돌파',
      hudSubtitle: '12층 · 중층부 폐허',
      winReturnLabel: '심연 원정실로 · 보상 수령',
    });
  });
});

describe('심연 전투 정산', () => {
  const battle = { goldEarned: 100, dmXP: 30, materialsEarned: { common_ore: 2 } };

  it('이기면 전투 전리품과 층 정복 보상이 모두 들어온다', () => {
    const before = state();
    const out = settleAbyssBattle(before, 1, { won: true, ...battle }, { now: 0, rng: ALWAYS });
    if (!out.clear) throw new Error('won battle must clear the floor');
    expect(out.state.abyss.highestFloor).toBe(1);
    expect(out.state.homeGold).toBe(100 + 100 + out.clear.loot.gold);
    expect(out.state.materials.common_ore).toBe(2 + (out.clear.loot.materials.common_ore ?? 0));
    expect(out.state.dmXP).toBe((before.dmXP ?? 0) + 30);
  });

  it('져도 전투 전리품은 들어오고 층은 그대로다', () => {
    const out = settleAbyssBattle(state(), 1, { won: false, ...battle }, { now: 0, rng: ALWAYS });
    expect(out.clear).toBeNull();
    expect(out.state.abyss.highestFloor).toBe(0);
    expect(out.state.homeGold).toBe(200);
    expect(out.state.materials.common_ore).toBe(2);
  });
});
