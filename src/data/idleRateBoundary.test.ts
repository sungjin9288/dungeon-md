import { describe, expect, it } from 'vitest';
import { collectIdleIncome, computeIdleReward, settleIdleAcrossChange } from './idleIncome';
import { loadGameState, type GameState } from './wisdom';
import { applyBattleReturnSettlement } from './invasionTransactions';

// Decorations, DM level, wisdom and notoriety tier change the idle rate. Room
// and production changes already settled the unclaimed window at the old rate;
// these four applied the new rate to the whole window retroactively.
const HOUR = 3_600_000;
const NOW = 50 * HOUR;
function home(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(),
    dmLevel: 4, homeGold: 1000, materials: {}, lastIdleCollect: NOW - HOUR,
    dungeonSlots: [{ roomType: 'combat', building: 'guardian', roomLevel: 1, monsterIds: [], trapIds: [], hp: 200, maxHp: 200 }],
    ...overrides,
  };
}

describe('idle settlement across rate changes', () => {
  it('pays the unclaimed hour at the old DM rate before the level rises', () => {
    const prev = home();
    const oldRatePay = computeIdleReward(prev, NOW).gold;
    const next = { ...prev, dmLevel: 9, homeGold: prev.homeGold + 300 };
    const settled = settleIdleAcrossChange(prev, next, NOW);
    expect(settled.homeGold).toBe(1300 + oldRatePay);
    expect(settled.lastIdleCollect).toBe(NOW);
    expect(settled.dmLevel).toBe(9);
    expect(computeIdleReward(next, NOW).gold).toBeGreaterThan(oldRatePay);
  });

  it('keeps the transaction result and the old-rate remainder', () => {
    const prev = home({ idleRemainder: { operationGold: 0.5, productionGold: 0, materials: {} } });
    const next = { ...prev, notorietyTier: 3, homeGold: prev.homeGold - 200 };
    const settled = settleIdleAcrossChange(prev, next, NOW);
    const expected = collectIdleIncome(prev, NOW);
    expect(settled.homeGold).toBe(800 + expected.reward.gold);
    expect(settled.idleRemainder).toEqual(expected.state.idleRemainder);
    expect(settled.notorietyTier).toBe(3);
  });

  it('leaves unrelated changes alone', () => {
    const prev = home();
    const next = { ...prev, homeGold: prev.homeGold - 50 };
    expect(settleIdleAcrossChange(prev, next, NOW)).toBe(next);
  });

  it('settles when decorations, wisdom or tier change', () => {
    const prev = home();
    for (const next of [
      { ...prev, placedDecorations: ['gold_chest'] },
      { ...prev, wisdomTree: { ...prev.wisdomTree, goldHands: 1 } },
      { ...prev, notorietyTier: 2 },
    ]) {
      expect(settleIdleAcrossChange(prev, next as GameState, NOW).lastIdleCollect).toBe(NOW);
    }
  });
});

describe('battle settlement across a DM level-up', () => {
  it('pays the unclaimed window at the old rate when the XP levels the DM', () => {
    const prev = home({ dmXP: 390 });
    const oldRatePay = computeIdleReward(prev, NOW).gold;
    const settled = applyBattleReturnSettlement(prev, { won: true, goldEarned: 30, dmXP: 150 }, { now: NOW });
    expect(settled.didLevelUp).toBe(true);
    expect(settled.state.homeGold).toBe(1000 + 30 + oldRatePay);
    expect(settled.state.lastIdleCollect).toBe(NOW);
  });
  it('leaves the idle clock alone without a level-up', () => {
    const prev = home({ dmXP: 0 });
    const settled = applyBattleReturnSettlement(prev, { won: true, goldEarned: 30, dmXP: 10 }, { now: NOW });
    expect(settled.state.lastIdleCollect).toBe(prev.lastIdleCollect);
    expect(settled.state.homeGold).toBe(1030);
  });
});
