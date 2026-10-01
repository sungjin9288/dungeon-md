import { describe, expect, it } from 'vitest';
import { loadGameState, type GameState } from './wisdom';
import { abyssBattleFloor, abyssBattleStageConfig, getAbyssBattleLabels, nextAbyssReturnScene } from './abyssBattle';
import { abyssFloorDungeonHp, buildAbyssFloorWaves } from './abyss';
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

describe('원정실 돌아갈 곳', () => {
  it('들어온 곳으로 돌아가고, 원정 전투 왕복 동안은 그대로 유지한다', () => {
    const fromForge = nextAbyssReturnScene('ForgeScene', false, 'StageSelectScene');
    expect(fromForge).toBe('ForgeScene');
    // Back from a climb: no new hand-off, keep the forge.
    expect(nextAbyssReturnScene(undefined, true, fromForge)).toBe('ForgeScene');
    // A fresh entry without a hand-off (expedition menu, map bottom) goes back to the invasion map.
    expect(nextAbyssReturnScene(undefined, false, fromForge)).toBe('StageSelectScene');
    expect(nextAbyssReturnScene('DungeonScene', false, 'ForgeScene')).toBe('StageSelectScene');
  });
});

describe('심연 전투의 장 번호', () => {
  const cleared = (count: number) => ({
    stageProgress: Array.from({ length: 90 }, (_, i) => ({ bestStars: i < count ? 1 : 0 })),
  });

  it('플레이어가 깬 가장 깊은 스테이지의 장으로 싸운다 — 3·4장 방 기믹이 심연에서도 켜진다', () => {
    expect(abyssBattleStageConfig(5, cleared(0)).chapter).toBe(1);
    expect(abyssBattleStageConfig(5, cleared(25)).chapter).toBe(3);
    expect(abyssBattleStageConfig(5, cleared(40)).chapter).toBe(4);
    expect(abyssBattleStageConfig(5, cleared(90)).chapter).toBe(9);
  });

  it('웨이브·던전 HP는 층이 정하고, 인라인 전투(스테이지 번호 0)다', () => {
    const config = abyssBattleStageConfig(12, cleared(30));
    expect(config.stageNumber).toBe(0);
    expect(config.waves).toEqual(buildAbyssFloorWaves(12));
    expect(config.dungeonHp).toBe(abyssFloorDungeonHp(12));
  });
});
