import { type AchievementContext, checkAchievements } from './achievements';
import { addXp } from './barracks';
import { applyDailyChallengeTick } from './daily';
import { SKIN_DATA } from './monsters';
import {
  applyQuestObjectiveUpdate,
  completeAndAdvance,
  tickSubQuestProgress,
  type ObjectiveType,
} from './quests';
import { recordBuiltRoom, type GameState, type OwnedMonster } from './wisdom';

export interface AchievementUnlockResult {
  state:       GameState;
  unlockedIds: string[];
  changed:     boolean;
}

export interface MonsterLevelUp {
  monsterId:     string;
  previousLevel: number;
  newLevel:      number;
}

export interface MonsterXpGrantResult {
  state:    GameState;
  levelUps: MonsterLevelUp[];
  changed:  boolean;
}

export interface ConsecutiveDayProgressResult {
  state:   GameState;
  changed: boolean;
}

export interface QuestObjectiveProgressResult {
  state:          GameState;
  changed:        boolean;
  questCompleted: boolean;
}

export interface CombatRoomActionProgressResult extends QuestObjectiveProgressResult {
  recordedRoomType?: string;
}

export interface InvaderKillProgressResult {
  state:             GameState;
  changed:           boolean;
  dailyCompletedIds: string[];
  dailyRewardGems:   number;
}

export function buildAchievementContext(state: GameState): AchievementContext {
  return {
    totalKills:        state.totalKills       ?? 0,
    totalGoldEarned:   state.totalGoldEarned  ?? 0,
    roomsBuilt:        state.roomsBuilt       ?? [],
    bossesKilled:      state.bossesKilled     ?? [],
    endlessHighScore:  state.endlessHighScore ?? 0,
    consecutiveDays:   state.consecutiveDays  ?? 0,
    soulCrystals:      state.soulCrystals     ?? 0,
    wisdomTree:        state.wisdomTree       ?? {},
    stageProgress:     state.stageProgress    ?? [],
    dmLevel:           state.dmLevel          ?? 1,
    ownedMonsterCount: (state.ownedMonsters ?? []).length,
    ownedSkinCount:    Object.values(state.ownedSkins ?? {}).flat().length,
    totalFusions:      state.totalFusions     ?? 0,
    completedTribes:   state.completedTribes  ?? 0,
    totalSummons:      (state.summonHistory ?? []).length,
    questSkinsOwned:   SKIN_DATA
      .filter(skin => skin.unlockVia === 'quest')
      .filter(skin => (state.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id))
      .length,
  };
}

export function unlockAvailableAchievements(
  state: GameState,
  unlockedAt = Date.now(),
): AchievementUnlockResult {
  const unlockedIds = checkAchievements(
    buildAchievementContext(state),
    state.achievements ?? {},
  );

  if (unlockedIds.length === 0) {
    return { state, unlockedIds, changed: false };
  }

  const achievements = { ...(state.achievements ?? {}) };
  unlockedIds.forEach(id => {
    achievements[id] = { unlocked: true, current: 0, unlockedAt };
  });

  return {
    state: { ...state, achievements },
    unlockedIds,
    changed: true,
  };
}

export function grantMonsterRosterXp(
  state: GameState,
  amount: number,
): MonsterXpGrantResult {
  const ownedMonsters = state.ownedMonsters ?? [];
  if (ownedMonsters.length === 0 || amount <= 0) {
    return { state, levelUps: [], changed: false };
  }

  let changed = false;
  const levelUps: MonsterLevelUp[] = [];
  const nextMonsters = ownedMonsters.map(monster => {
    const next: OwnedMonster = {
      ...monster,
      spentSkills: { ...(monster.spentSkills ?? {}) },
      equippedSkills: [...(monster.equippedSkills ?? [])],
    };
    const previousLevel = next.level;
    const previousXp = next.xp;
    const previousSkillPoints = next.skillPoints;
    const result = addXp(next, amount);

    if (
      next.level !== previousLevel ||
      next.xp !== previousXp ||
      next.skillPoints !== previousSkillPoints
    ) {
      changed = true;
    }
    if (result.levelled) {
      levelUps.push({ monsterId: next.id, previousLevel, newLevel: result.newLevel });
    }
    return next;
  });

  if (!changed) return { state, levelUps: [], changed: false };
  return {
    state: { ...state, ownedMonsters: nextMonsters },
    levelUps,
    changed: true,
  };
}

export function applyQuestObjectiveProgress(
  state: GameState,
  type: ObjectiveType,
  amount = 1,
): QuestObjectiveProgressResult {
  const [questState, update] = applyQuestObjectiveUpdate(state, type, amount);
  const subQuestState = tickSubQuestProgress(questState, type, amount);

  if (update?.questDone) {
    const [completedState, completion] = completeAndAdvance(subQuestState);
    return {
      state: completedState,
      changed: completedState !== state,
      questCompleted: completion !== null,
    };
  }

  return {
    state: subQuestState,
    changed: subQuestState !== state,
    questCompleted: false,
  };
}

export function applyCombatRoomBuildProgress(
  state: GameState,
  roomType: string,
): CombatRoomActionProgressResult {
  const progress = applyQuestObjectiveProgress(state, 'build_room');
  const recordedState = recordBuiltRoom(progress.state, roomType);
  return {
    state: recordedState,
    changed: true,
    questCompleted: progress.questCompleted,
    recordedRoomType: roomType,
  };
}

export function applyCombatMonsterAssignmentProgress(
  state: GameState,
): CombatRoomActionProgressResult {
  return applyQuestObjectiveProgress(state, 'assign_monster');
}

export function applyCombatRoomUpgradeProgress(
  state: GameState,
): CombatRoomActionProgressResult {
  return applyQuestObjectiveProgress(state, 'upgrade_room');
}

export function applyInvaderKillProgress(
  state: GameState,
  invaderType: string,
  goldEarned: number,
): InvaderKillProgressResult {
  const killState: GameState = {
    ...state,
    totalKills:      (state.totalKills      ?? 0) + 1,
    totalGoldEarned: (state.totalGoldEarned ?? 0) + goldEarned,
    bossesKilled:    [...(state.bossesKilled ?? []), invaderType],
  };
  const dailyResult = applyDailyChallengeTick(killState, 'kill_count');

  return {
    state:             dailyResult.state,
    changed:           true,
    dailyCompletedIds: dailyResult.completedIds,
    dailyRewardGems:   dailyResult.rewardGems,
  };
}

function previousIsoDate(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function applyConsecutiveDayProgress(
  state: GameState,
  today = new Date().toISOString().slice(0, 10),
): ConsecutiveDayProgressResult {
  if (state.lastPlayDate === today) {
    return { state, changed: false };
  }

  const consecutiveDays = state.lastPlayDate === previousIsoDate(today)
    ? (state.consecutiveDays ?? 0) + 1
    : 1;

  return {
    state: { ...state, consecutiveDays, lastPlayDate: today },
    changed: true,
  };
}
