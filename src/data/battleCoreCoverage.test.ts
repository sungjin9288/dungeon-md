/**
 * Every battle mode sets its own dungeon core.
 *
 * This codebase shipped the same defect three times, each found only by
 * measuring a mode long after it went in:
 *   - 심연: no `dungeonHp` on its stageConfig, so all 60 floors inherited
 *     DungeonScene's class default of 1,000 while floor damage grew to 10,115.
 *   - 무한: entered as `{ endless: true, stageNumber: 0 }`, and id 0 matches no
 *     stage, so `?? ALL_STAGES[0]` handed every run Chapter 1 Stage 1's 1,500.
 *   - 스토리 침입: one constant 800 for all ten, while their own core damage
 *     grew 64x from INV-001 to INV-009.
 *
 * The shape is always "a mode forgets dungeonHp and silently inherits a number
 * meant for something else". This file is the guard for the fourth instance:
 * every source of battle waves must produce a core derived from what it fields.
 */
import { describe, expect, it } from 'vitest';
import { ALL_STAGES } from './allStages';
import { INVADER_DEFS } from './invaders';
import { abyssFloorDungeonHp, ABYSS_MAX_FLOOR, buildAbyssFloorWaves } from './abyss';
import { endlessDungeonHp } from './endlessWave';
import { storyInvasionDungeonHp, buildStoryInvasionTarget } from './battleForecast';
import { MAIN_QUESTS } from './quests';
import { INLINE_FALLBACK_DUNGEON_HP } from '../combat/DungeonSceneInit';

/** Core damage a wave list can do if literally nothing is stopped. */
function coreDamage(waves: ReadonlyArray<{ invaders: ReadonlyArray<{ type: string; count: number }> }>): number {
  return waves.reduce((sum, wave) => sum + wave.invaders.reduce(
    (acc, group) => acc + group.count * (INVADER_DEFS[group.type as keyof typeof INVADER_DEFS]?.damage ?? 0), 0), 0);
}

describe('모든 전투 모드가 자기 코어를 갖는다', () => {
  it('심연: 층이 깊어지면 코어도 자란다', () => {
    expect(abyssFloorDungeonHp(ABYSS_MAX_FLOOR))
      .toBeGreaterThan(abyssFloorDungeonHp(1) * 3);
    let prevRatio = 0;
    for (const floor of [1, 10, 30, 60]) {
      const ratio = abyssFloorDungeonHp(floor) / coreDamage(buildAbyssFloorWaves(floor));
      if (prevRatio) expect(ratio, `floor ${floor} forgiveness`).toBeCloseTo(prevRatio, 1);
      prevRatio = ratio;
    }
  });

  it('무한: 캠페인 도달점을 따라 코어가 자라고 절대 줄지 않는다', () => {
    let prev = 0;
    for (let standing = 1; standing <= ALL_STAGES.length; standing++) {
      const hp = endlessDungeonHp(standing);
      expect(hp, `standing ${standing}`).toBeGreaterThanOrEqual(prev);
      prev = hp;
    }
    expect(endlessDungeonHp(ALL_STAGES.length)).toBeGreaterThan(endlessDungeonHp(1) * 3);
  });

  it('스토리 침입: 챕터를 따라 코어가 자란다', () => {
    let prev = 0;
    for (let chapter = 1; chapter <= 9; chapter++) {
      const hp = storyInvasionDungeonHp(chapter);
      expect(hp, `chapter ${chapter}`).toBeGreaterThanOrEqual(prev);
      prev = hp;
    }
  });

  it('어떤 모드도 인라인 폴백 상수에 머무르지 않는다', () => {
    // If a mode's core equals the fallback everywhere, it never set its own.
    const abyssCores = new Set(Array.from({ length: ABYSS_MAX_FLOOR }, (_, i) => abyssFloorDungeonHp(i + 1)));
    expect(abyssCores.size, '심연 코어 종류').toBeGreaterThan(1);

    const invasionCores = new Set(MAIN_QUESTS
      .filter(quest => quest.invasionOnComplete)
      .map(quest => buildStoryInvasionTarget(quest.invasionOnComplete!, quest.chapter).stage?.dungeonHp));
    expect(invasionCores.size, '스토리 침입 코어 종류').toBeGreaterThan(1);
    expect(invasionCores.has(INLINE_FALLBACK_DUNGEON_HP), '침입이 폴백에 머무름').toBe(false);
  });

  it('캠페인 스테이지는 저마다 코어를 들고 있다', () => {
    for (const stage of ALL_STAGES) {
      expect(stage.dungeonHp, `stage ${stage.id}`).toBeGreaterThan(0);
    }
    expect(new Set(ALL_STAGES.map(stage => stage.dungeonHp)).size).toBeGreaterThan(5);
  });
});
