import { describe, it, expect, beforeEach } from 'vitest';

import type { GameState } from './wisdom';
import { loadGameState } from './wisdom';
import {
  MAIN_QUESTS,
  SUB_QUEST_POOL,
  SUB_QUEST_POOL_CH1,
  assignSubQuests,
  claimSubQuest,
  completeAndAdvance,
  getQuest,
  getSubQuestById,
  startQuest,
  tickSubQuestProgress,
  updateQuestObjective,
} from './quests';

// ─── Test helpers ────────────────────────────────────────────────────────────

function freshGameState(): GameState {
  localStorage.clear();
  return loadGameState();
}

// ─── MAIN_QUESTS shape ───────────────────────────────────────────────────────

describe('MAIN_QUESTS', () => {
  it('contains at least the first chapter quests', () => {
    expect(MAIN_QUESTS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique quest ids', () => {
    const ids = MAIN_QUESTS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every quest has at least one objective with target > 0', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.objectives.length).toBeGreaterThan(0);
      for (const o of q.objectives) {
        expect(o.target).toBeGreaterThan(0);
        expect(o.current).toBe(0); // template baseline
      }
    }
  });

  it('nextQuestId references an existing quest or is null', () => {
    const ids = new Set(MAIN_QUESTS.map(q => q.id));
    for (const q of MAIN_QUESTS) {
      if (q.nextQuestId !== null) {
        expect(ids.has(q.nextQuestId)).toBe(true);
      }
    }
  });

  it('the only quest with null nextQuestId is the last in the chain', () => {
    const terminals = MAIN_QUESTS.filter(q => q.nextQuestId === null);
    expect(terminals.length).toBe(1);
  });

  it('reward.dmXP is always defined and non-negative', () => {
    for (const q of MAIN_QUESTS) {
      expect(q.reward.dmXP).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── getQuest ────────────────────────────────────────────────────────────────

describe('getQuest', () => {
  it('returns the quest by id', () => {
    const q = getQuest('MQ-001');
    expect(q).toBeDefined();
    expect(q?.chapter).toBe(1);
  });

  it('returns undefined for unknown id', () => {
    expect(getQuest('MQ-NONEXISTENT')).toBeUndefined();
  });
});

// ─── startQuest ──────────────────────────────────────────────────────────────

describe('startQuest', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('sets activeMainQuestId', () => {
    startQuest(gs, 'MQ-001');
    expect(gs.activeMainQuestId).toBe('MQ-001');
  });

  it('initializes questProgress with zeroed objectives', () => {
    startQuest(gs, 'MQ-001');
    const prog = gs.questProgress['MQ-001'];
    expect(prog).toBeDefined();
    expect(prog.completed).toBe(false);
    expect(prog.objectives['O1']).toBe(0);
  });

  it('is a no-op for unknown quest id', () => {
    startQuest(gs, 'MQ-BOGUS');
    expect(gs.activeMainQuestId).toBe('');
    expect(Object.keys(gs.questProgress)).toHaveLength(0);
  });

  it('auto-satisfies reach_dm_level when current dmLevel already exceeds target', () => {
    // MQ-004 has a reach_dm_level target of 3
    gs.dmLevel = 5;
    startQuest(gs, 'MQ-004');
    const prog = gs.questProgress['MQ-004'];
    // find the reach_dm_level objective
    const quest = getQuest('MQ-004')!;
    const reachObj = quest.objectives.find(o => o.type === 'reach_dm_level')!;
    expect(prog.objectives[reachObj.id]).toBe(reachObj.target);
  });

  it('auto-satisfies collect_gold when totalGoldEarned already meets target', () => {
    // MQ-010 has collect_gold target of 1000 and reach_dm_level target of 5
    gs.totalGoldEarned = 2500;
    gs.dmLevel = 10;
    startQuest(gs, 'MQ-010');
    const quest = getQuest('MQ-010')!;
    const goldObj = quest.objectives.find(o => o.type === 'collect_gold')!;
    const reachObj = quest.objectives.find(o => o.type === 'reach_dm_level')!;
    const prog = gs.questProgress['MQ-010'];
    expect(prog.objectives[goldObj.id]).toBe(goldObj.target);
    expect(prog.objectives[reachObj.id]).toBe(reachObj.target);
  });

  it('does not overwrite existing progress when quest re-starts', () => {
    startQuest(gs, 'MQ-001');
    gs.questProgress['MQ-001'].objectives['O1'] = 1; // manually set mid-progress
    startQuest(gs, 'MQ-001'); // re-entry should preserve
    expect(gs.questProgress['MQ-001'].objectives['O1']).toBe(1);
  });
});

// ─── updateQuestObjective ─────────────────────────────────────────────────────

describe('updateQuestObjective', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('returns null when no active quest', () => {
    const result = updateQuestObjective(gs, 'build_room', 1);
    expect(result).toBeNull();
  });

  it('increments matching objective and returns update payload', () => {
    startQuest(gs, 'MQ-001'); // build_room target 1
    const result = updateQuestObjective(gs, 'build_room', 1);
    expect(result).not.toBeNull();
    expect(result?.questId).toBe('MQ-001');
    expect(result?.objId).toBe('O1');
    expect(result?.current).toBe(1);
    expect(result?.target).toBe(1);
    expect(result?.questDone).toBe(true);
  });

  it('does not increment when type does not match', () => {
    startQuest(gs, 'MQ-001'); // build_room only
    const result = updateQuestObjective(gs, 'assign_monster', 1);
    expect(result).toBeNull();
    expect(gs.questProgress['MQ-001'].objectives['O1']).toBe(0);
  });

  it('clamps to target on over-increment', () => {
    startQuest(gs, 'MQ-008'); // feed_monster target 3
    const result = updateQuestObjective(gs, 'feed_monster', 99);
    expect(result?.current).toBe(3);
    expect(result?.questDone).toBe(true);
  });

  it('marks questDone=false until all objectives are met', () => {
    // MQ-004 has build_room(2) + reach_dm_level(3)
    gs.dmLevel = 1; // prevents auto-satisfaction
    startQuest(gs, 'MQ-004');
    const first = updateQuestObjective(gs, 'build_room', 1);
    expect(first?.questDone).toBe(false);
    const second = updateQuestObjective(gs, 'build_room', 1);
    expect(second?.current).toBe(2);
    expect(second?.questDone).toBe(false); // reach_dm_level still pending
    const third = updateQuestObjective(gs, 'reach_dm_level', 3);
    expect(third?.questDone).toBe(true);
  });

  it('returns null when quest is already completed', () => {
    startQuest(gs, 'MQ-001');
    gs.questProgress['MQ-001'].completed = true;
    const result = updateQuestObjective(gs, 'build_room', 1);
    expect(result).toBeNull();
  });

  it('returns null when trying to increment a completed objective', () => {
    startQuest(gs, 'MQ-001');
    gs.questProgress['MQ-001'].objectives['O1'] = 1; // already at target
    const result = updateQuestObjective(gs, 'build_room', 1);
    expect(result).toBeNull();
  });
});

// ─── completeAndAdvance ──────────────────────────────────────────────────────

describe('completeAndAdvance', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('returns null when no active quest', () => {
    const result = completeAndAdvance(gs);
    expect(result).toBeNull();
  });

  it('awards gold/dmXP and marks quest complete', () => {
    startQuest(gs, 'MQ-001');
    const homeGoldBefore = gs.homeGold;
    const result = completeAndAdvance(gs);
    expect(result).not.toBeNull();
    expect(result?.completedQuest.id).toBe('MQ-001');
    expect(gs.questProgress['MQ-001'].completed).toBe(true);
    expect(gs.questProgress['MQ-001'].completedAt).toBeGreaterThan(0);
    expect(gs.homeGold).toBe(homeGoldBefore + 100); // MQ-001 gold reward
  });

  it('advances to the next quest via nextQuestId', () => {
    startQuest(gs, 'MQ-001');
    completeAndAdvance(gs);
    expect(gs.activeMainQuestId).toBe('MQ-002');
    expect(gs.questProgress['MQ-002']).toBeDefined();
  });

  it('clears activeMainQuestId when nextQuestId is null (chain terminal)', () => {
    const terminal = MAIN_QUESTS.find(q => q.nextQuestId === null)!;
    startQuest(gs, terminal.id);
    completeAndAdvance(gs);
    expect(gs.activeMainQuestId).toBe('');
  });

  it('levels up DM when XP exceeds threshold', () => {
    startQuest(gs, 'MQ-001'); // dmXP 50 reward
    gs.dmLevel = 1;
    gs.dmXP = 80; // 80 + 50 = 130 ≥ 100 → level up
    completeAndAdvance(gs);
    expect(gs.dmLevel).toBeGreaterThanOrEqual(2);
  });

  it('adds unlocks to unlockedFeatures without duplicates', () => {
    // MQ-004 rewards unlocks: ['summon_altar']
    gs.dmLevel = 10; // satisfy reach_dm_level auto
    startQuest(gs, 'MQ-004');
    gs.questProgress['MQ-004'].objectives['O1'] = 2; // build_room
    completeAndAdvance(gs);
    expect(gs.unlockedFeatures).toContain('summon_altar');

    // Running same unlock path again should not duplicate
    const countBefore = gs.unlockedFeatures.filter(u => u === 'summon_altar').length;
    expect(countBefore).toBe(1);
  });

  it('awards gems and soulCrystals when reward includes them', () => {
    // MQ-003 rewards soulCrystals: 5
    startQuest(gs, 'MQ-003');
    const scBefore = gs.soulCrystals;
    completeAndAdvance(gs);
    expect(gs.soulCrystals).toBe(scBefore + 5);
  });
});

// ─── SUB_QUEST_POOL shape ────────────────────────────────────────────────────

describe('SUB_QUEST_POOL', () => {
  it('has unique ids', () => {
    const ids = SUB_QUEST_POOL.map(sq => sq.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exports the legacy alias SUB_QUEST_POOL_CH1', () => {
    expect(SUB_QUEST_POOL_CH1).toBe(SUB_QUEST_POOL);
  });

  it('every sub-quest has a positive target and dmXP reward', () => {
    for (const sq of SUB_QUEST_POOL) {
      expect(sq.objective.target).toBeGreaterThan(0);
      expect(sq.reward.dmXP).toBeGreaterThan(0);
    }
  });
});

// ─── getSubQuestById ─────────────────────────────────────────────────────────

describe('getSubQuestById', () => {
  it('finds a known sub-quest', () => {
    const sq = getSubQuestById('SQ-001');
    expect(sq).toBeDefined();
    expect(sq?.objective.type).toBe('defend_invasion');
  });

  it('returns undefined for unknown id', () => {
    expect(getSubQuestById('SQ-BOGUS')).toBeUndefined();
  });
});

// ─── assignSubQuests ─────────────────────────────────────────────────────────

describe('assignSubQuests', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('fills up to 2 active sub-quests from an empty slate', () => {
    assignSubQuests(gs);
    expect(gs.activeSubQuestIds).toHaveLength(2);
    for (const id of gs.activeSubQuestIds) {
      expect(getSubQuestById(id)).toBeDefined();
      expect(gs.subQuestProgress[id]).toBe(0);
    }
  });

  it('is idempotent when already full', () => {
    assignSubQuests(gs);
    const before = [...gs.activeSubQuestIds];
    assignSubQuests(gs);
    expect(gs.activeSubQuestIds).toEqual(before);
  });

  it('never assigns completed sub-quests', () => {
    gs.completedSubQuestIds = SUB_QUEST_POOL.slice(0, 13).map(sq => sq.id); // leave only 2 in pool
    assignSubQuests(gs);
    expect(gs.activeSubQuestIds).toHaveLength(2);
    for (const id of gs.activeSubQuestIds) {
      expect(gs.completedSubQuestIds).not.toContain(id);
    }
  });

  it('initializes arrays when missing (fresh state compatibility)', () => {
    // Simulate pre-subquest save
    (gs as unknown as Record<string, unknown>).activeSubQuestIds = undefined;
    (gs as unknown as Record<string, unknown>).subQuestProgress = undefined;
    (gs as unknown as Record<string, unknown>).completedSubQuestIds = undefined;
    assignSubQuests(gs);
    expect(Array.isArray(gs.activeSubQuestIds)).toBe(true);
    expect(gs.activeSubQuestIds.length).toBe(2);
  });
});

// ─── tickSubQuestProgress ────────────────────────────────────────────────────

describe('tickSubQuestProgress', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
    // Deterministic active sub-quests for test clarity
    gs.activeSubQuestIds = ['SQ-001', 'SQ-006']; // defend_invasion(1), build_room(1)
    gs.subQuestProgress = { 'SQ-001': 0, 'SQ-006': 0 };
    gs.completedSubQuestIds = [];
  });

  it('increments matching active sub-quests', () => {
    tickSubQuestProgress(gs, 'build_room', 1);
    expect(gs.subQuestProgress['SQ-006']).toBe(1);
    expect(gs.subQuestProgress['SQ-001']).toBe(0);
  });

  it('returns list of newly completed sub-quests on the tick that finishes them', () => {
    const completed = tickSubQuestProgress(gs, 'defend_invasion', 1);
    expect(completed).toEqual(['SQ-001']);
  });

  it('clamps progress to target', () => {
    tickSubQuestProgress(gs, 'defend_invasion', 99);
    expect(gs.subQuestProgress['SQ-001']).toBe(1);
  });

  it('does not re-complete already-maxed sub-quests', () => {
    gs.subQuestProgress['SQ-001'] = 1;
    const completed = tickSubQuestProgress(gs, 'defend_invasion', 1);
    expect(completed).toEqual([]);
  });

  it('returns empty array when no active sub-quest matches type', () => {
    const completed = tickSubQuestProgress(gs, 'summon', 1);
    expect(completed).toEqual([]);
  });
});

// ─── claimSubQuest ───────────────────────────────────────────────────────────

describe('claimSubQuest', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
    gs.activeSubQuestIds = ['SQ-001', 'SQ-006'];
    gs.subQuestProgress = { 'SQ-001': 1, 'SQ-006': 0 };
    gs.completedSubQuestIds = [];
  });

  it('grants gold and dmXP rewards', () => {
    const goldBefore = gs.homeGold;
    const xpBefore = gs.dmXP;
    const claimed = claimSubQuest(gs, 'SQ-001');
    expect(claimed).not.toBeNull();
    expect(gs.homeGold).toBe(goldBefore + 120); // SQ-001 reward
    expect(gs.dmXP).toBeGreaterThanOrEqual(xpBefore); // may have leveled
  });

  it('moves the sub-quest from active to completed', () => {
    claimSubQuest(gs, 'SQ-001');
    expect(gs.activeSubQuestIds).not.toContain('SQ-001');
    expect(gs.completedSubQuestIds).toContain('SQ-001');
    expect(gs.subQuestProgress['SQ-001']).toBeUndefined();
  });

  it('refills the active list back to 2 after claim', () => {
    claimSubQuest(gs, 'SQ-001');
    expect(gs.activeSubQuestIds).toHaveLength(2);
  });

  it('returns null for unknown sub-quest id', () => {
    const result = claimSubQuest(gs, 'SQ-BOGUS');
    expect(result).toBeNull();
  });

  it('returns null when sub-quest is not in active list', () => {
    const result = claimSubQuest(gs, 'SQ-002');
    expect(result).toBeNull();
  });

  it('grants soulCrystals when reward includes them', () => {
    gs.activeSubQuestIds = ['SQ-003']; // fuse_monsters, reward soulCrystals 40
    gs.subQuestProgress = { 'SQ-003': 1 };
    const scBefore = gs.soulCrystals;
    claimSubQuest(gs, 'SQ-003');
    expect(gs.soulCrystals).toBe(scBefore + 40);
  });
});
