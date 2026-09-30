import type { GameState } from './wisdom';
import type { DailyDungeon, WeeklyBoss } from './daily';
import { getThisWeekMonday, getTodayString } from './daily';
import { applyStageClear } from './stageProgress';
import { ALL_STAGES } from './allStages';
import { NOTORIETY_GAIN } from './notoriety';

export interface ClearRewardOptions {
  readonly earnedCrystals: number;
  readonly stageNumber?: number;
  readonly stars: number;
  readonly hpPercent?: number;
  readonly dailyMode?: DailyDungeon | null;
  readonly weeklyBossMode?: WeeklyBoss | null;
  readonly today?: string;
  readonly weekStart?: string;
}

export function applyClearRewards(state: GameState, options: ClearRewardOptions): GameState {
  const {
    earnedCrystals,
    stageNumber,
    stars,
    hpPercent,
    dailyMode = null,
    weeklyBossMode = null,
  } = options;

  // Stage numbers start at 1; an abyss climb carries stageNumber 0 and is not a stage.
  const isStage = stageNumber !== undefined && stageNumber >= 1;
  const stageProgress = isStage
    ? applyStageClear(state.stageProgress, stageNumber - 1, stars, hpPercent)
    : state.stageProgress;

  // A stage's first clear spreads the dungeon's name, scaled by its chapter.
  const firstClear = isStage && (state.stageProgress?.[stageNumber - 1]?.bestStars ?? 0) === 0;
  const chapter = firstClear ? (ALL_STAGES.find(stage => stage.id === stageNumber)?.chapter ?? 1) : 0;
  const notoriety = (state.notoriety ?? 0) + (firstClear ? NOTORIETY_GAIN.stageClearPerChapter * chapter : 0);

  let soulCrystals = (state.soulCrystals ?? 0) + earnedCrystals;
  const materials = { ...(state.materials ?? {}) };
  let dailyDungeonCompleted = state.dailyDungeonCompleted;
  let weeklyBossResetDate = state.weeklyBossResetDate;
  let weeklyBossHpDealt = state.weeklyBossHpDealt;
  let blueprints = state.blueprints ?? [];

  if (dailyMode) {
    dailyDungeonCompleted = options.today ?? getTodayString();
    soulCrystals += dailyMode.rewards.crystals;
    for (const matId of dailyMode.rewards.materials) {
      materials[matId] = (materials[matId] ?? 0) + 1;
    }
  }

  if (weeklyBossMode) {
    const weekStart = options.weekStart ?? getThisWeekMonday();
    if (state.weeklyBossResetDate !== weekStart) {
      weeklyBossResetDate = weekStart;
      weeklyBossHpDealt = 0;
      soulCrystals += weeklyBossMode.rewards.skinShards * 10;
      const materialId = weeklyBossMode.rewards.legendaryMaterial;
      materials[materialId] = (materials[materialId] ?? 0) + 1;
      blueprints = blueprints.includes('bp_boss_amulet')
        ? blueprints
        : [...blueprints, 'bp_boss_amulet'];
    }
  }

  return {
    ...state,
    notoriety,
    soulCrystals,
    stageProgress,
    materials,
    dailyDungeonCompleted,
    weeklyBossResetDate,
    weeklyBossHpDealt,
    blueprints,
  };
}

