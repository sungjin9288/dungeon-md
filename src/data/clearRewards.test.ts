import { beforeEach, describe, expect, it } from 'vitest';
import { applyClearRewards } from './clearRewards';
import type { DailyDungeon, WeeklyBoss } from './daily';
import { loadGameState, type GameState } from './wisdom';

beforeEach(() => {
  localStorage.clear();
});

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(),
    soulCrystals: 10,
    materials: { common_ore: 2 },
    blueprints: [],
    weeklyBossHpDealt: 1234,
    weeklyBossResetDate: '',
    ...overrides,
  };
}

const dailyMode: DailyDungeon = {
  name: '테스트 던전',
  rule: 'gold_rush',
  modifiers: { invaderSpeedMult: 1, goldMult: 3 },
  waves: [],
  rewards: { crystals: 50, materials: ['common_ore', 'magic_dust'] },
  dayIndex: 1,
};

const weeklyBossMode: WeeklyBoss = {
  name: '테스트 보스',
  bossType: 'dragon_king',
  totalHp: 50000,
  phases: 5,
  rewards: { legendaryMaterial: 'boss_essence', skinShards: 5 },
  weekIndex: 1,
};

describe('applyClearRewards', () => {
  it('adds base clear crystals and applies stage progress immutably', () => {
    const state = makeState();
    const originalProgress = state.stageProgress;
    const originalStage = state.stageProgress[0];
    const originalNext = state.stageProgress[1];

    const next = applyClearRewards(state, {
      earnedCrystals: 7,
      stageNumber: 1,
      stars: 3,
      hpPercent: 82,
    });

    expect(next).not.toBe(state);
    expect(next.soulCrystals).toBe(17);
    expect(next.stageProgress).not.toBe(originalProgress);
    expect(next.stageProgress[0]).not.toBe(originalStage);
    expect(next.stageProgress[1]).not.toBe(originalNext);
    expect(next.stageProgress[0].bestStars).toBe(3);
    expect(next.stageProgress[0].bestHpPercent).toBe(82);
    expect(next.stageProgress[1].unlocked).toBe(true);
    expect(state.soulCrystals).toBe(10);
    expect(state.stageProgress[0].bestStars).toBe(0);
  });

  it('adds daily dungeon rewards, materials, and deterministic completion date', () => {
    const state = makeState();

    const next = applyClearRewards(state, {
      earnedCrystals: 5,
      stars: 2,
      dailyMode,
      today: '2026-05-12',
    });

    expect(next.soulCrystals).toBe(65);
    expect(next.dailyDungeonCompleted).toBe('2026-05-12');
    expect(next.materials.common_ore).toBe(3);
    expect(next.materials.magic_dust).toBe(1);
    expect(state.materials).toEqual({ common_ore: 2 });
  });

  it('grants weekly boss rewards once per week and resets weekly dealt HP', () => {
    const state = makeState({ blueprints: ['bp_existing'] });

    const next = applyClearRewards(state, {
      earnedCrystals: 5,
      stars: 3,
      weeklyBossMode,
      weekStart: '2026-05-11',
    });

    expect(next.soulCrystals).toBe(65);
    expect(next.weeklyBossResetDate).toBe('2026-05-11');
    expect(next.weeklyBossHpDealt).toBe(0);
    expect(next.materials.boss_essence).toBe(1);
    expect(next.blueprints).toEqual(['bp_existing', 'bp_boss_amulet']);
    expect(state.blueprints).toEqual(['bp_existing']);
  });

  it('does not grant weekly bonus again when the same week is already recorded', () => {
    const state = makeState({
      soulCrystals: 20,
      weeklyBossResetDate: '2026-05-11',
      weeklyBossHpDealt: 999,
      blueprints: ['bp_boss_amulet'],
      materials: { boss_essence: 2 },
    });

    const next = applyClearRewards(state, {
      earnedCrystals: 5,
      stars: 3,
      weeklyBossMode,
      weekStart: '2026-05-11',
    });

    expect(next.soulCrystals).toBe(25);
    expect(next.weeklyBossHpDealt).toBe(999);
    expect(next.materials.boss_essence).toBe(2);
    expect(next.blueprints).toEqual(['bp_boss_amulet']);
  });

  it('combines normal, daily, weekly, and stage progress rewards', () => {
    const state = makeState({ soulCrystals: 0 });

    const next = applyClearRewards(state, {
      earnedCrystals: 6,
      stageNumber: 10,
      stars: 3,
      hpPercent: 100,
      dailyMode,
      weeklyBossMode,
      today: '2026-05-12',
      weekStart: '2026-05-11',
    });

    expect(next.soulCrystals).toBe(106);
    expect(next.stageProgress[9].bestStars).toBe(3);
    expect(next.stageProgress[9].bestHpPercent).toBe(100);
    expect(next.stageProgress[10].unlocked).toBe(true);
    expect(next.dailyDungeonCompleted).toBe('2026-05-12');
    expect(next.materials.common_ore).toBe(3);
    expect(next.materials.magic_dust).toBe(1);
    expect(next.materials.boss_essence).toBe(1);
    expect(next.blueprints).toContain('bp_boss_amulet');
  });
});

