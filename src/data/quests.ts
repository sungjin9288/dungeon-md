// ─── Imports ──────────────────────────────────────────────────────────────────

import type { GameState } from './wisdom';
import { logger } from '../utils/logger';

// Re-export all types and data from questData for backwards compatibility
export type {
  ObjectiveType,
  Objective,
  Reward,
  InvasionWaveEntry,
  InvasionWave,
  InvasionConfig,
  MainQuest,
} from './questData';
export { MAIN_QUESTS } from './questData';

import type { ObjectiveType, MainQuest, Reward } from './questData';
import { MAIN_QUESTS } from './questData';
import { SKIN_DATA } from '../data/monsters';

// ─── Helper functions ─────────────────────────────────────────────────────────

export function getQuest(id: string): MainQuest | undefined {
  return MAIN_QUESTS.find(q => q.id === id);
}

export function startQuest(gs: GameState, questId: string): GameState {
  const quest = getQuest(questId);
  if (!quest) return gs;

  const existingProg = gs.questProgress[questId];
  const objectives: Record<string, number> = existingProg
    ? { ...existingProg.objectives }
    : Object.fromEntries(quest.objectives.map(o => [o.id, 0]));

  // Auto-satisfy objectives already met by current game state
  quest.objectives.forEach(o => {
    const cur = objectives[o.id] ?? 0;
    if (o.type === 'reach_dm_level' && gs.dmLevel >= o.target && cur < o.target) {
      objectives[o.id] = o.target;
      logger.debug(`[OBJECTIVE] reach_dm_level: ${o.target}/${o.target} (auto-met at Lv.${gs.dmLevel})`);
    }
    if (o.type === 'collect_gold' && (gs.totalGoldEarned ?? 0) >= o.target && cur < o.target) {
      objectives[o.id] = o.target;
      logger.debug(`[OBJECTIVE] collect_gold: ${o.target}/${o.target} (auto-met)`);
    }
  });

  const newProg = existingProg
    ? { ...existingProg, objectives }
    : { objectives, completed: false as const };

  logger.debug(`[QUEST] ${questId} started: ${quest.title}`);
  quest.objectives.forEach(o => logger.debug(`[OBJECTIVE] ${o.type}: ${objectives[o.id] ?? 0}/${o.target}`));

  return {
    ...gs,
    activeMainQuestId: questId,
    questProgress: { ...gs.questProgress, [questId]: newProg },
  };
}

export interface ObjectiveUpdate {
  questId:   string;
  objId:     string;
  current:   number;
  target:    number;
  questDone: boolean;
}

export function updateQuestObjective(
  gs:     GameState,
  type:   ObjectiveType,
  amount  = 1,
): ObjectiveUpdate | null {
  if (!gs.activeMainQuestId) return null;
  const questId = gs.activeMainQuestId;
  const quest   = getQuest(questId);
  const prog    = gs.questProgress[questId];
  if (!quest || !prog || prog.completed) return null;
  for (const obj of quest.objectives) {
    if (obj.type !== type) continue;
    const cur  = prog.objectives[obj.id] ?? 0;
    if (cur >= obj.target) continue;
    const next = Math.min(cur + amount, obj.target);
    prog.objectives[obj.id] = next;
    logger.debug(`[OBJECTIVE] ${obj.type}: ${next}/${obj.target}`);
    const questDone = quest.objectives.every(
      o => (prog.objectives[o.id] ?? 0) >= o.target,
    );
    return { questId, objId: obj.id, current: next, target: obj.target, questDone };
  }
  return null;
}

export function completeAndAdvance(
  gs: GameState,
): [GameState, { completedQuest: MainQuest; nextQuestId: string | null; unlocks: string[] } | null] {
  const questId = gs.activeMainQuestId;
  const quest   = getQuest(questId);
  const prog    = gs.questProgress[questId];
  if (!quest || !prog) return [gs, null];

  const r        = quest.reward;
  const xpGained = r.dmXP;

  let newGold    = (gs.homeGold     ?? 0) + (r.gold         ?? 0);
  let newGems    = (gs.gems         ?? 0) + (r.gems         ?? 0);
  let newSC      = (gs.soulCrystals ?? 0) + (r.soulCrystals ?? 0);
  let newDmXP    = (gs.dmXP         ?? 0) + xpGained;
  let newDmLevel = gs.dmLevel;
  let threshold  = newDmLevel * 100;
  while (newDmXP >= threshold) {
    newDmXP -= threshold; newDmLevel += 1; threshold = newDmLevel * 100;
    logger.debug(`[QUEST] DM Level Up! Now Lv.${newDmLevel}`);
  }
  logger.debug(`[QUEST] ${questId} COMPLETE — rewards granted`);
  logger.debug(`[DM XP] +${xpGained}, total: ${newDmXP}, level: ${newDmLevel}`);

  const unlocks     = r.unlocks ?? [] as string[];
  const newFeatures = [...gs.unlockedFeatures];
  unlocks.forEach(u => {
    if (!newFeatures.includes(u)) { newFeatures.push(u); logger.debug(`[UNLOCK] ${u}`); }
  });

  const partialGs: GameState = {
    ...gs,
    homeGold: newGold, gems: newGems, soulCrystals: newSC,
    dmXP: newDmXP, dmLevel: newDmLevel,
    unlockedFeatures: newFeatures,
    questProgress:    { ...gs.questProgress, [questId]: { ...prog, completed: true, completedAt: Date.now() } },
    activeMainQuestId: quest.nextQuestId ?? '',
  };
  const nextQuestId = quest.nextQuestId;
  const advancedGs  = nextQuestId ? startQuest(partialGs, nextQuestId) : partialGs;
  const finalGs     = grantQuestSkins(advancedGs);
  return [finalGs, { completedQuest: quest, nextQuestId: nextQuestId ?? null, unlocks }];
}

// ─── Quest-skin grant ─────────────────────────────────────────────────────────

/**
 * Check all quest-unlock skins and grant any whose linked quest is now completed.
 * Pure function — returns updated GameState (or same reference if nothing changed).
 */
export function grantQuestSkins(gs: GameState): GameState {
  const questSkins = SKIN_DATA.filter(s => s.unlockVia === 'quest' && s.unlockRef);
  let ownedSkins = gs.ownedSkins ?? {};
  let changed = false;

  for (const skin of questSkins) {
    const refId = skin.unlockRef!;
    const prog  = gs.questProgress[refId];
    if (!prog?.completed) continue;

    const alreadyOwned = (ownedSkins[skin.monsterId] ?? []).includes(skin.id);
    if (alreadyOwned) continue;

    const prev = ownedSkins[skin.monsterId] ?? [];
    ownedSkins = { ...ownedSkins, [skin.monsterId]: [...prev, skin.id] };
    changed = true;
    logger.debug(`[SKIN] Quest unlock: ${skin.id} granted (ref: ${refId})`);
  }

  return changed ? { ...gs, ownedSkins } : gs;
}

// ─── Sub quest system ─────────────────────────────────────────────────────────

export interface SubQuest {
  id:          string;
  title:       string;
  icon:        string;
  objective:   { type: ObjectiveType; target: number; description: string };
  reward:      Reward;
}

export const SUB_QUEST_POOL: SubQuest[] = [
  // ── defend ──
  { id: 'SQ-001', icon: '⚔️', title: '오늘의 방어',
    objective: { type: 'defend_invasion', target: 1, description: '침략 1회 격퇴' },
    reward: { dmXP: 30, gold: 120 } },
  { id: 'SQ-002', icon: '🛡️', title: '연속 방어',
    objective: { type: 'defend_invasion', target: 3, description: '침략 3회 격퇴' },
    reward: { dmXP: 80, gold: 300 } },
  // ── fuse ──
  { id: 'SQ-003', icon: '🔬', title: '몬스터 합성',
    objective: { type: 'fuse_monsters', target: 1, description: '몬스터 합성 1회' },
    reward: { dmXP: 60, soulCrystals: 40 } },
  { id: 'SQ-004', icon: '⚗️', title: '연구 열의',
    objective: { type: 'fuse_monsters', target: 3, description: '몬스터 합성 3회' },
    reward: { dmXP: 100, soulCrystals: 80 } },
  // ── build / upgrade ──
  { id: 'SQ-005', icon: '🔨', title: '던전 강화',
    objective: { type: 'upgrade_room', target: 1, description: '방 업그레이드 1회' },
    reward: { dmXP: 30, gold: 150 } },
  { id: 'SQ-006', icon: '🏗️', title: '방 건설',
    objective: { type: 'build_room', target: 1, description: '방 1개 건설' },
    reward: { dmXP: 30, gold: 100 } },
  // ── gold ──
  { id: 'SQ-007', icon: '💰', title: '골드 수집',
    objective: { type: 'collect_gold', target: 500, description: '골드 500 획득' },
    reward: { dmXP: 40, gold: 200 } },
  { id: 'SQ-008', icon: '💵', title: '대량 수집',
    objective: { type: 'collect_gold', target: 1500, description: '골드 1500 획득' },
    reward: { dmXP: 80, gold: 400 } },
  // ── upgrade 2nd variant ──
  { id: 'SQ-009', icon: '⬆️', title: '연속 강화',
    objective: { type: 'upgrade_room', target: 3, description: '방 업그레이드 3회' },
    reward: { dmXP: 100, gold: 350 } },
  // ── Ch7 specific ──
  { id: 'SQ-010', icon: '⚔️', title: '천계 도전',
    objective: { type: 'complete_stage', target: 65, description: '스테이지 65 클리어' },
    reward: { dmXP: 200, soulCrystals: 150 } },
  { id: 'SQ-011', icon: '🏰', title: '신계 방어선',
    objective: { type: 'defend_invasion', target: 5, description: '침략 5회 격퇴' },
    reward: { dmXP: 180, gold: 800 } },
  { id: 'SQ-012', icon: '💎', title: '천상의 보물',
    objective: { type: 'collect_gold', target: 5000, description: '골드 5000 획득' },
    reward: { dmXP: 160, soulCrystals: 100 } },
  { id: 'SQ-013', icon: '🌟', title: '각성의 경지',
    objective: { type: 'upgrade_room', target: 5, description: '방 업그레이드 5회' },
    reward: { dmXP: 250, gold: 1000 } },
  { id: 'SQ-014', icon: '🔮', title: '강화 소환',
    objective: { type: 'summon', target: 10, description: '소환 10회' },
    reward: { dmXP: 200, soulCrystals: 120 } },
  { id: 'SQ-015', icon: '👑', title: '신황제 격파',
    objective: { type: 'complete_stage', target: 72, description: '스테이지 72 클리어' },
    reward: { dmXP: 500, soulCrystals: 300 } },
  // ── assign_monster ──
  { id: 'SQ-016', icon: '🦎', title: '수호자 배치',
    objective: { type: 'assign_monster', target: 1, description: '몬스터 1마리 배치' },
    reward: { dmXP: 20, gold: 80 } },
  { id: 'SQ-017', icon: '🐉', title: '수호대 완성',
    objective: { type: 'assign_monster', target: 3, description: '몬스터 3마리 배치' },
    reward: { dmXP: 60, gold: 200 } },
  // ── feed_monster ──
  { id: 'SQ-018', icon: '🍖', title: '첫 식사',
    objective: { type: 'feed_monster', target: 1, description: '몬스터에게 먹이 1회' },
    reward: { dmXP: 25, gold: 100 } },
  { id: 'SQ-019', icon: '🍗', title: '영양 공급',
    objective: { type: 'feed_monster', target: 3, description: '몬스터에게 먹이 3회' },
    reward: { dmXP: 60, soulCrystals: 30 } },
  { id: 'SQ-020', icon: '🥩', title: '집중 훈련식',
    objective: { type: 'feed_monster', target: 5, description: '몬스터에게 먹이 5회' },
    reward: { dmXP: 100, soulCrystals: 60 } },
  // ── summon extras ──
  { id: 'SQ-021', icon: '🌀', title: '소환 집중',
    objective: { type: 'summon', target: 3, description: '소환 3회 실행' },
    reward: { dmXP: 80, gold: 250 } },
  { id: 'SQ-022', icon: '💫', title: '다중 소환',
    objective: { type: 'summon', target: 5, description: '소환 5회 실행' },
    reward: { dmXP: 120, soulCrystals: 50 } },
  // ── complete_stage extras ──
  { id: 'SQ-023', icon: '🗺️', title: '중반 탐험',
    objective: { type: 'complete_stage', target: 20, description: '스테이지 20 클리어' },
    reward: { dmXP: 80, gold: 300 } },
  { id: 'SQ-024', icon: '⚡', title: '후반 돌파',
    objective: { type: 'complete_stage', target: 40, description: '스테이지 40 클리어' },
    reward: { dmXP: 150, soulCrystals: 80 } },
  // ── build_room extra ──
  { id: 'SQ-025', icon: '🏯', title: '던전 확장',
    objective: { type: 'build_room', target: 2, description: '방 2개 건설' },
    reward: { dmXP: 60, gold: 220 } },
  // ── Chapter 8: 원초의 심연 ──────────────────────────────────────────────────
  { id: 'SQ-026', icon: '🌑', title: '심연의 탐험',
    objective: { type: 'complete_stage', target: 75, description: '스테이지 75 클리어' },
    reward: { dmXP: 250, soulCrystals: 150 } },
  { id: 'SQ-027', icon: '🔮', title: '원초신 격파',
    objective: { type: 'complete_stage', target: 80, description: '스테이지 80 클리어' },
    reward: { dmXP: 600, soulCrystals: 400, gems: 50 } },
  { id: 'SQ-028', icon: '💜', title: '심연의 보물',
    objective: { type: 'collect_gold', target: 20000, description: '골드 20,000 획득' },
    reward: { dmXP: 200, gold: 5000 } },
  { id: 'SQ-029', icon: '🌀', title: '심연 방어전',
    objective: { type: 'defend_invasion', target: 8, description: '침략 8회 격퇴' },
    reward: { dmXP: 220, soulCrystals: 180 } },
  { id: 'SQ-030', icon: '⚡', title: '원초의 소환',
    objective: { type: 'summon', target: 15, description: '소환 15회 실행' },
    reward: { dmXP: 180, soulCrystals: 120 } },
];

// Legacy alias kept for compatibility
export const SUB_QUEST_POOL_CH1 = SUB_QUEST_POOL;

export function getSubQuestById(id: string): SubQuest | undefined {
  return SUB_QUEST_POOL.find(sq => sq.id === id);
}

// ─── Sub-quest state helpers ───────────────────────────────────────────────────

const MAX_ACTIVE_SUB_QUESTS = 2;

/** Fill empty sub-quest slots with random picks from the pool (skip already active/completed). */
export function assignSubQuests(gs: GameState): GameState {
  const activeIds  = [...(gs.activeSubQuestIds  ?? [])];
  const progress   = { ...(gs.subQuestProgress  ?? {}) };
  const completed  = gs.completedSubQuestIds ?? [];

  const available = SUB_QUEST_POOL.filter(sq =>
    !activeIds.includes(sq.id) && !completed.includes(sq.id),
  );

  while (activeIds.length < MAX_ACTIVE_SUB_QUESTS && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    const sq  = available.splice(idx, 1)[0];
    activeIds.push(sq.id);
    progress[sq.id] = progress[sq.id] ?? 0;
  }

  return { ...gs, activeSubQuestIds: activeIds, subQuestProgress: progress, completedSubQuestIds: completed };
}

/** Increment progress for all active sub-quests matching the given objective type. */
export function tickSubQuestProgress(
  gs: GameState,
  type: ObjectiveType,
  amount = 1,
): GameState {
  const activeIds = gs.activeSubQuestIds ?? [];
  const prevProg  = gs.subQuestProgress  ?? {};
  const newProg   = { ...prevProg };

  for (const sqId of activeIds) {
    const sq = getSubQuestById(sqId);
    if (!sq || sq.objective.type !== type) continue;
    const prev = prevProg[sqId] ?? 0;
    if (prev >= sq.objective.target) continue;
    newProg[sqId] = Math.min(prev + amount, sq.objective.target);
  }
  return { ...gs, activeSubQuestIds: activeIds, subQuestProgress: newProg };
}

/** Claim a completed sub-quest: grant rewards and remove from active list. */
export function claimSubQuest(gs: GameState, sqId: string): [GameState, SubQuest | null] {
  const activeIds    = gs.activeSubQuestIds    ?? [];
  const completedIds = gs.completedSubQuestIds ?? [];
  const progress     = gs.subQuestProgress     ?? {};

  const sq  = getSubQuestById(sqId);
  const idx = activeIds.indexOf(sqId);
  if (!sq || idx === -1) return [gs, null];

  // Accumulate rewards
  let newGold    = gs.homeGold     ?? 0;
  let newGems    = gs.gems         ?? 0;
  let newSC      = gs.soulCrystals ?? 0;
  let newDmXP    = gs.dmXP         ?? 0;
  let newDmLevel = gs.dmLevel;

  if (sq.reward.gold)         newGold   += sq.reward.gold;
  if (sq.reward.gems)         newGems   += sq.reward.gems;
  if (sq.reward.soulCrystals) newSC     += sq.reward.soulCrystals;
  if (sq.reward.dmXP) {
    newDmXP += sq.reward.dmXP;
    const threshold = newDmLevel * 100;
    if (newDmXP >= threshold) { newDmXP -= threshold; newDmLevel++; }
  }

  // Move active → completed, remove progress entry
  const newActiveIds  = activeIds.filter((_, i) => i !== idx);
  const newCompleted  = completedIds.includes(sqId) ? completedIds : [...completedIds, sqId];
  const newProgress   = Object.fromEntries(Object.entries(progress).filter(([k]) => k !== sqId));

  const partialGs: GameState = {
    ...gs,
    homeGold:             newGold,
    gems:                 newGems,
    soulCrystals:         newSC,
    dmXP:                 newDmXP,
    dmLevel:              newDmLevel,
    activeSubQuestIds:    newActiveIds,
    completedSubQuestIds: newCompleted,
    subQuestProgress:     newProgress,
  };

  return [assignSubQuests(partialGs), sq];
}
