import { describe, expect, it } from 'vitest';
import {
  applyBattleReturnSettlement,
  xpForDmLevel,
  type BattleReturnResult,
} from './invasionTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 0,
    dmXP: 0,
    dmLevel: 1,
    totalGoldEarned: 0,
    materials: {},
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

function makeResult(overrides: Partial<BattleReturnResult> = {}): BattleReturnResult {
  return {
    won: true,
    goldEarned: 0,
    dmXP: 0,
    ...overrides,
  };
}

describe('invasionTransactions — battle return settlement', () => {
  it('applies gold, DM XP, materials, and collect_gold progress without mutating input', () => {
    const state = makeState({
      homeGold: 100,
      dmXP: 390,
      dmLevel: 4,
      totalGoldEarned: 900,
      materials: { common_ore: 1 },
      activeMainQuestId: 'MQ-010',
      questProgress: {
        'MQ-010': { completed: false, objectives: { O1: 0, O2: 0 } },
      },
      activeSubQuestIds: ['SQ-007'],
      subQuestProgress: { 'SQ-007': 0 },
    });

    const result = applyBattleReturnSettlement(state, makeResult({
      won: false,
      goldEarned: 150,
      dmXP: 20,
      materialsEarned: { common_ore: 2, magic_dust: 1 },
    }));

    expect(result.changed).toBe(true);
    expect(result.didLevelUp).toBe(true);
    expect(result.defendUpdate).toBeNull();
    expect(result.state).not.toBe(state);
    expect(result.state.homeGold).toBe(250);
    expect(result.state.dmLevel).toBe(5);
    expect(result.state.dmXP).toBe(10);
    expect(result.state.totalGoldEarned).toBe(1050);
    expect(result.state.materials).toEqual({ common_ore: 3, magic_dust: 1 });
    expect(result.state.questProgress['MQ-010'].objectives.O2).toBe(150);
    expect(result.state.subQuestProgress['SQ-007']).toBe(150);
    expect(state.homeGold).toBe(100);
    expect(state.materials).toEqual({ common_ore: 1 });
  });

  it('ticks defend_invasion quest and sub-quest progress only when battle was won', () => {
    const state = makeState({
      activeMainQuestId: 'MQ-003',
      questProgress: {
        'MQ-003': { completed: false, objectives: { O1: 0 } },
      },
      activeSubQuestIds: ['SQ-001'],
      subQuestProgress: { 'SQ-001': 0 },
    });

    const result = applyBattleReturnSettlement(state, makeResult({ won: true }));

    expect(result.changed).toBe(true);
    expect(result.defendUpdate?.questDone).toBe(true);
    expect(result.state.questProgress['MQ-003'].objectives.O1).toBe(1);
    expect(result.state.subQuestProgress['SQ-001']).toBe(1);
    expect(state.questProgress['MQ-003'].objectives.O1).toBe(0);
  });

  it('does not tick defend_invasion when battle was lost', () => {
    const state = makeState({
      activeMainQuestId: 'MQ-003',
      questProgress: {
        'MQ-003': { completed: false, objectives: { O1: 0 } },
      },
      activeSubQuestIds: ['SQ-001'],
      subQuestProgress: { 'SQ-001': 0 },
    });

    const result = applyBattleReturnSettlement(state, makeResult({ won: false }));

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.defendUpdate).toBeNull();
    expect(result.state.questProgress['MQ-003'].objectives.O1).toBe(0);
    expect(result.state.subQuestProgress['SQ-001']).toBe(0);
  });

  it('reports unchanged no-op returns without replacing the state reference', () => {
    const state = makeState();

    const result = applyBattleReturnSettlement(state, makeResult({
      won: false,
      goldEarned: 0,
      dmXP: 0,
      materialsEarned: {},
    }));

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.didLevelUp).toBe(false);
    expect(result.defendUpdate).toBeNull();
  });

  it('exposes the DM XP threshold used by the home UI', () => {
    expect(xpForDmLevel(1)).toBe(100);
    expect(xpForDmLevel(5)).toBe(500);
  });
});
