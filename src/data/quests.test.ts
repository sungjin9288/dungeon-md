import { describe, it, expect, beforeEach } from 'vitest';

import type { GameState } from './wisdom';
import { loadGameState } from './wisdom';
import {
  MAIN_QUESTS,
  SUB_QUEST_POOL,
  SUB_QUEST_POOL_CH1,
  applyQuestObjectiveUpdate,
  applySubQuestClaim,
  assignSubQuests,
  claimSubQuest,
  completeAndAdvance,
  getQuest,
  getSubQuestById,
  grantQuestSkins,
  prepareSubQuestLogViewState,
  startQuest,
  tickSubQuestProgress,
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
    const newGs = startQuest(gs, 'MQ-001');
    expect(newGs.activeMainQuestId).toBe('MQ-001');
  });

  it('initializes questProgress with zeroed objectives', () => {
    const newGs = startQuest(gs, 'MQ-001');
    const prog = newGs.questProgress['MQ-001'];
    expect(prog).toBeDefined();
    expect(prog.completed).toBe(false);
    expect(prog.objectives['O1']).toBe(0);
  });

  it('is a no-op for unknown quest id', () => {
    const newGs = startQuest(gs, 'MQ-BOGUS');
    expect(newGs.activeMainQuestId).toBe('');
    expect(Object.keys(newGs.questProgress)).toHaveLength(0);
  });

  it('auto-satisfies reach_dm_level when current dmLevel already exceeds target', () => {
    // MQ-004 has a reach_dm_level target of 3
    gs = { ...gs, dmLevel: 5 };
    const newGs = startQuest(gs, 'MQ-004');
    const prog = newGs.questProgress['MQ-004'];
    // find the reach_dm_level objective
    const quest = getQuest('MQ-004')!;
    const reachObj = quest.objectives.find(o => o.type === 'reach_dm_level')!;
    expect(prog.objectives[reachObj.id]).toBe(reachObj.target);
  });

  it('auto-satisfies collect_gold when totalGoldEarned already meets target', () => {
    // MQ-010 has collect_gold target of 1000 and reach_dm_level target of 5
    gs = { ...gs, totalGoldEarned: 2500, dmLevel: 10 };
    const newGs = startQuest(gs, 'MQ-010');
    const quest = getQuest('MQ-010')!;
    const goldObj = quest.objectives.find(o => o.type === 'collect_gold')!;
    const reachObj = quest.objectives.find(o => o.type === 'reach_dm_level')!;
    const prog = newGs.questProgress['MQ-010'];
    expect(prog.objectives[goldObj.id]).toBe(goldObj.target);
    expect(prog.objectives[reachObj.id]).toBe(reachObj.target);
  });

  it('does not overwrite existing progress when quest re-starts', () => {
    let newGs = startQuest(gs, 'MQ-001');
    newGs = { ...newGs, questProgress: { ...newGs.questProgress, 'MQ-001': { ...newGs.questProgress['MQ-001'], objectives: { ...newGs.questProgress['MQ-001'].objectives, 'O1': 1 } } } };
    const restarted = startQuest(newGs, 'MQ-001'); // re-entry should preserve
    expect(restarted.questProgress['MQ-001'].objectives['O1']).toBe(1);
  });
});

// ─── applyQuestObjectiveUpdate ───────────────────────────────────────────────

describe('applyQuestObjectiveUpdate', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('returns an updated GameState without mutating the input quest progress', () => {
    gs = startQuest(gs, 'MQ-001');
    const originalProgress = gs.questProgress;
    const originalQuest = gs.questProgress['MQ-001'];
    const originalObjectives = originalQuest.objectives;

    const [nextGs, update] = applyQuestObjectiveUpdate(gs, 'build_room', 1);

    expect(update).not.toBeNull();
    expect(update?.questDone).toBe(true);
    expect(nextGs).not.toBe(gs);
    expect(nextGs.questProgress).not.toBe(originalProgress);
    expect(nextGs.questProgress['MQ-001']).not.toBe(originalQuest);
    expect(nextGs.questProgress['MQ-001'].objectives).not.toBe(originalObjectives);
    expect(nextGs.questProgress['MQ-001'].objectives['O1']).toBe(1);
    expect(gs.questProgress['MQ-001'].objectives['O1']).toBe(0);
  });

  it('returns the same GameState reference when no objective matches', () => {
    gs = startQuest(gs, 'MQ-001');

    const [nextGs, update] = applyQuestObjectiveUpdate(gs, 'assign_monster', 1);

    expect(update).toBeNull();
    expect(nextGs).toBe(gs);
    expect(gs.questProgress['MQ-001'].objectives['O1']).toBe(0);
  });

  it('supports sequential immutable updates when callers pass the returned state', () => {
    gs = { ...gs, dmLevel: 1 };
    gs = startQuest(gs, 'MQ-004');

    const [firstGs, first] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    const [secondGs, second] = applyQuestObjectiveUpdate(firstGs, 'build_room', 1);
    const [thirdGs, third] = applyQuestObjectiveUpdate(secondGs, 'reach_dm_level', 3);

    expect(first?.questDone).toBe(false);
    expect(second?.current).toBe(2);
    expect(second?.questDone).toBe(false);
    expect(third?.questDone).toBe(true);
    expect(thirdGs.questProgress['MQ-004'].objectives['O1']).toBe(2);
    expect(thirdGs.questProgress['MQ-004'].objectives['O2']).toBe(3);
    expect(gs.questProgress['MQ-004'].objectives['O1']).toBe(0);
    expect(gs.questProgress['MQ-004'].objectives['O2']).toBe(0);
  });
});

// ─── applyQuestObjectiveUpdate — edge cases ──────────────────────────────────

describe('applyQuestObjectiveUpdate — edge cases', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('returns null when no active quest', () => {
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(result).toBeNull();
    expect(nextGs).toBe(gs);
  });

  it('increments matching objective and returns update payload', () => {
    gs = startQuest(gs, 'MQ-001'); // build_room target 1
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(result).not.toBeNull();
    expect(result?.questId).toBe('MQ-001');
    expect(result?.objId).toBe('O1');
    expect(result?.current).toBe(1);
    expect(result?.target).toBe(1);
    expect(result?.questDone).toBe(true);
    expect(nextGs.questProgress['MQ-001'].objectives['O1']).toBe(1);
  });

  it('does not increment when type does not match', () => {
    gs = startQuest(gs, 'MQ-001'); // build_room only
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'assign_monster', 1);
    expect(result).toBeNull();
    expect(nextGs).toBe(gs);
    expect(gs.questProgress['MQ-001'].objectives['O1']).toBe(0);
  });

  it('clamps to target on over-increment', () => {
    gs = startQuest(gs, 'MQ-008'); // feed_monster target 3
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'feed_monster', 99);
    expect(result?.current).toBe(3);
    expect(result?.questDone).toBe(true);
    expect(nextGs.questProgress['MQ-008'].objectives[result!.objId]).toBe(3);
  });

  it('marks questDone=false until all objectives are met', () => {
    // MQ-004 has build_room(2) + reach_dm_level(3)
    gs = { ...gs, dmLevel: 1 }; // prevents auto-satisfaction
    gs = startQuest(gs, 'MQ-004');
    let first;
    [gs, first] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(first?.questDone).toBe(false);
    let second;
    [gs, second] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(second?.current).toBe(2);
    expect(second?.questDone).toBe(false); // reach_dm_level still pending
    const [, third] = applyQuestObjectiveUpdate(gs, 'reach_dm_level', 3);
    expect(third?.questDone).toBe(true);
  });

  it('returns null when quest is already completed', () => {
    gs = startQuest(gs, 'MQ-001');
    gs = { ...gs, questProgress: { ...gs.questProgress, 'MQ-001': { ...gs.questProgress['MQ-001'], completed: true as const } } };
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(result).toBeNull();
    expect(nextGs).toBe(gs);
  });

  it('returns null when trying to increment a completed objective', () => {
    gs = startQuest(gs, 'MQ-001');
    gs = { ...gs, questProgress: { ...gs.questProgress, 'MQ-001': { ...gs.questProgress['MQ-001'], objectives: { ...gs.questProgress['MQ-001'].objectives, 'O1': 1 } } } };
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'build_room', 1);
    expect(result).toBeNull();
    expect(nextGs).toBe(gs);
  });
});

// ─── completeAndAdvance ──────────────────────────────────────────────────────

describe('completeAndAdvance', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
  });

  it('returns null when no active quest', () => {
    const [, result] = completeAndAdvance(gs);
    expect(result).toBeNull();
  });

  it('awards gold/dmXP and marks quest complete', () => {
    gs = startQuest(gs, 'MQ-001');
    const homeGoldBefore = gs.homeGold;
    const [newGs, result] = completeAndAdvance(gs);
    expect(result).not.toBeNull();
    expect(result?.completedQuest.id).toBe('MQ-001');
    expect(newGs.questProgress['MQ-001'].completed).toBe(true);
    expect(newGs.questProgress['MQ-001'].completedAt).toBeGreaterThan(0);
    expect(newGs.homeGold).toBe(homeGoldBefore + 100); // MQ-001 gold reward
  });

  it('advances to the next quest via nextQuestId', () => {
    gs = startQuest(gs, 'MQ-001');
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.activeMainQuestId).toBe('MQ-002');
    expect(newGs.questProgress['MQ-002']).toBeDefined();
  });

  it('clears activeMainQuestId when nextQuestId is null (chain terminal)', () => {
    const terminal = MAIN_QUESTS.find(q => q.nextQuestId === null)!;
    gs = startQuest(gs, terminal.id);
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.activeMainQuestId).toBe('');
  });

  it('levels up DM when XP exceeds threshold', () => {
    gs = startQuest(gs, 'MQ-001'); // dmXP 50 reward
    gs = { ...gs, dmLevel: 1, dmXP: 80 }; // 80 + 50 = 130 ≥ 100 → level up
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.dmLevel).toBeGreaterThanOrEqual(2);
  });

  it('adds unlocks to unlockedFeatures without duplicates', () => {
    // MQ-004 rewards unlocks: ['summon_altar']
    gs = { ...gs, dmLevel: 10 }; // satisfy reach_dm_level auto
    gs = startQuest(gs, 'MQ-004');
    gs = { ...gs, questProgress: { ...gs.questProgress, 'MQ-004': { ...gs.questProgress['MQ-004'], objectives: { ...gs.questProgress['MQ-004'].objectives, 'O1': 2 } } } };
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.unlockedFeatures).toContain('summon_altar');

    // Running same unlock path again should not duplicate
    const countBefore = newGs.unlockedFeatures.filter(u => u === 'summon_altar').length;
    expect(countBefore).toBe(1);
  });

  it('awards gems and soulCrystals when reward includes them', () => {
    // MQ-003 rewards soulCrystals: 5
    gs = startQuest(gs, 'MQ-003');
    const scBefore = gs.soulCrystals;
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.soulCrystals).toBe(scBefore + 5);
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
    const newGs = assignSubQuests(gs);
    expect(newGs.activeSubQuestIds).toHaveLength(2);
    for (const id of newGs.activeSubQuestIds) {
      expect(getSubQuestById(id)).toBeDefined();
      expect(newGs.subQuestProgress[id]).toBe(0);
    }
  });

  it('is idempotent when already full', () => {
    const newGs = assignSubQuests(gs);
    const before = [...newGs.activeSubQuestIds];
    const newGs2 = assignSubQuests(newGs);
    expect(newGs2.activeSubQuestIds).toEqual(before);
  });

  it('never assigns completed sub-quests', () => {
    gs = { ...gs, completedSubQuestIds: SUB_QUEST_POOL.slice(0, 13).map(sq => sq.id) }; // leave only 2 in pool
    const newGs = assignSubQuests(gs);
    expect(newGs.activeSubQuestIds).toHaveLength(2);
    for (const id of newGs.activeSubQuestIds) {
      expect(newGs.completedSubQuestIds).not.toContain(id);
    }
  });

  it('initializes arrays when missing (fresh state compatibility)', () => {
    // Simulate pre-subquest save
    const staleGs = { ...gs, activeSubQuestIds: undefined as unknown as string[], subQuestProgress: undefined as unknown as Record<string, number>, completedSubQuestIds: undefined as unknown as string[] };
    const newGs = assignSubQuests(staleGs);
    expect(Array.isArray(newGs.activeSubQuestIds)).toBe(true);
    expect(newGs.activeSubQuestIds.length).toBe(2);
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
    const newGs = tickSubQuestProgress(gs, 'build_room', 1);
    expect(newGs.subQuestProgress['SQ-006']).toBe(1);
    expect(newGs.subQuestProgress['SQ-001']).toBe(0);
  });

  it('updates progress on the tick that finishes a sub-quest', () => {
    const newGs = tickSubQuestProgress(gs, 'defend_invasion', 1);
    expect(newGs.subQuestProgress['SQ-001']).toBe(1); // target reached
  });

  it('clamps progress to target', () => {
    const newGs = tickSubQuestProgress(gs, 'defend_invasion', 99);
    expect(newGs.subQuestProgress['SQ-001']).toBe(1);
  });

  it('does not re-complete already-maxed sub-quests', () => {
    gs = { ...gs, subQuestProgress: { ...gs.subQuestProgress, 'SQ-001': 1 } };
    const newGs = tickSubQuestProgress(gs, 'defend_invasion', 1);
    expect(newGs.subQuestProgress['SQ-001']).toBe(1); // no change
  });

  it('returns unchanged progress when no active sub-quest matches type', () => {
    const newGs = tickSubQuestProgress(gs, 'summon', 1);
    expect(newGs.subQuestProgress).toEqual(gs.subQuestProgress);
  });
});

// ─── claimSubQuest ───────────────────────────────────────────────────────────

describe('claimSubQuest', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
    gs = { ...gs, activeSubQuestIds: ['SQ-001', 'SQ-006'], subQuestProgress: { 'SQ-001': 1, 'SQ-006': 0 }, completedSubQuestIds: [] };
  });

  it('grants gold and dmXP rewards', () => {
    const goldBefore = gs.homeGold;
    const xpBefore = gs.dmXP;
    const [newGs, claimed] = claimSubQuest(gs, 'SQ-001');
    expect(claimed).not.toBeNull();
    expect(newGs.homeGold).toBe(goldBefore + 120); // SQ-001 reward
    expect(newGs.dmXP).toBeGreaterThanOrEqual(xpBefore); // may have leveled
  });

  it('moves the sub-quest from active to completed', () => {
    const [newGs] = claimSubQuest(gs, 'SQ-001');
    expect(newGs.activeSubQuestIds).not.toContain('SQ-001');
    expect(newGs.completedSubQuestIds).toContain('SQ-001');
    expect(newGs.subQuestProgress['SQ-001']).toBeUndefined();
  });

  it('refills the active list back to 2 after claim', () => {
    const [newGs] = claimSubQuest(gs, 'SQ-001');
    expect(newGs.activeSubQuestIds).toHaveLength(2);
  });

  it('returns null for unknown sub-quest id', () => {
    const [, result] = claimSubQuest(gs, 'SQ-BOGUS');
    expect(result).toBeNull();
  });

  it('returns null when sub-quest is not in active list', () => {
    const [, result] = claimSubQuest(gs, 'SQ-002');
    expect(result).toBeNull();
  });

  it('grants soulCrystals when reward includes them', () => {
    gs = { ...gs, activeSubQuestIds: ['SQ-003'], subQuestProgress: { 'SQ-003': 1 } }; // fuse_monsters, reward soulCrystals 40
    const scBefore = gs.soulCrystals;
    const [newGs] = claimSubQuest(gs, 'SQ-003');
    expect(newGs.soulCrystals).toBe(scBefore + 40);
  });
});

describe('applySubQuestClaim', () => {
  it('claims only completed active sub-quests through a result object', () => {
    const gs = {
      ...freshGameState(),
      activeSubQuestIds: ['SQ-001'],
      subQuestProgress: { 'SQ-001': 1 },
      completedSubQuestIds: [],
    };

    const result = applySubQuestClaim(gs, 'SQ-001');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subQuest.id).toBe('SQ-001');
    expect(result.changed).toBe(true);
    expect(result.state.homeGold).toBe(gs.homeGold + 120);
    expect(result.state.completedSubQuestIds).toContain('SQ-001');
    expect(result.state.subQuestProgress['SQ-001']).toBeUndefined();
    expect(gs.completedSubQuestIds).toEqual([]);
    expect(gs.subQuestProgress['SQ-001']).toBe(1);
  });

  it('rejects incomplete, inactive, and unknown sub-quest claims without changing state', () => {
    const gs = {
      ...freshGameState(),
      activeSubQuestIds: ['SQ-001'],
      subQuestProgress: { 'SQ-001': 0 },
      completedSubQuestIds: [],
    };

    const incomplete = applySubQuestClaim(gs, 'SQ-001');
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.reason).toBe('not_complete');
      expect(incomplete.state).toBe(gs);
    }

    const inactive = applySubQuestClaim(gs, 'SQ-002');
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) {
      expect(inactive.reason).toBe('not_active');
      expect(inactive.state).toBe(gs);
    }

    const unknown = applySubQuestClaim(gs, 'SQ-BOGUS');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.reason).toBe('unknown_subquest');
      expect(unknown.state).toBe(gs);
    }
  });
});

describe('prepareSubQuestLogViewState', () => {
  it('builds sub-quest view items without changing an already-filled active list', () => {
    const gs = {
      ...freshGameState(),
      activeSubQuestIds: ['SQ-001', 'SQ-006'],
      subQuestProgress: { 'SQ-001': 1, 'SQ-006': 0 },
      completedSubQuestIds: [],
    };

    const result = prepareSubQuestLogViewState(gs);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(gs);
    expect(result.allCompleted).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      progress: 1,
      target: 1,
      completed: true,
      progressRatio: 1,
    });
    expect(result.items[0].subQuest.id).toBe('SQ-001');
    expect(result.items[1]).toMatchObject({
      progress: 0,
      target: 1,
      completed: false,
      progressRatio: 0,
    });
    expect(result.items[1].subQuest.id).toBe('SQ-006');
  });

  it('fills empty active slots and reports the normalized state as changed', () => {
    const gs = {
      ...freshGameState(),
      activeSubQuestIds: [],
      subQuestProgress: {},
      completedSubQuestIds: SUB_QUEST_POOL.slice(2).map(sq => sq.id),
    };

    const result = prepareSubQuestLogViewState(gs);
    const activeIds = [...result.state.activeSubQuestIds].sort();
    const itemIds = result.items.map(item => item.subQuest.id).sort();

    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(gs);
    expect(activeIds).toEqual(['SQ-001', 'SQ-002']);
    expect(result.state.subQuestProgress['SQ-001']).toBe(0);
    expect(result.state.subQuestProgress['SQ-002']).toBe(0);
    expect(itemIds).toEqual(['SQ-001', 'SQ-002']);
    expect(gs.activeSubQuestIds).toEqual([]);
    expect(gs.subQuestProgress).toEqual({});
  });

  it('reports all completed when no sub-quests remain assignable', () => {
    const gs = {
      ...freshGameState(),
      activeSubQuestIds: [],
      subQuestProgress: {},
      completedSubQuestIds: SUB_QUEST_POOL.map(sq => sq.id),
    };

    const result = prepareSubQuestLogViewState(gs);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(gs);
    expect(result.items).toEqual([]);
    expect(result.allCompleted).toBe(true);
  });
});

// ─── Epilogue quest chain (EQ-001 ~ EQ-005) ──────────────────────────────────

describe('EQ chain — data integrity', () => {
  const EQ_IDS = ['EQ-001', 'EQ-002', 'EQ-003', 'EQ-004', 'EQ-005'];

  it('all 5 epilogue quests exist in MAIN_QUESTS', () => {
    for (const id of EQ_IDS) {
      expect(getQuest(id), `${id} must exist`).toBeDefined();
    }
  });

  it('all EQ quests are chapter 8', () => {
    for (const id of EQ_IDS) {
      expect(getQuest(id)!.chapter, `${id} chapter`).toBe(8);
    }
  });

  it('all EQ quests have autoTrigger: true', () => {
    for (const id of EQ_IDS) {
      expect((getQuest(id) as { autoTrigger?: boolean }).autoTrigger, `${id} autoTrigger`).toBe(true);
    }
  });

  it('MQ-044 nextQuestId points to EQ-001 (chain entry)', () => {
    expect(getQuest('MQ-044')!.nextQuestId).toBe('EQ-001');
  });

  it('chain order is EQ-001 → EQ-002 → EQ-003 → EQ-004 → EQ-005 → null', () => {
    const chain = ['EQ-001', 'EQ-002', 'EQ-003', 'EQ-004', 'EQ-005', null] as const;
    for (let i = 0; i < chain.length - 1; i++) {
      const q = getQuest(chain[i] as string)!;
      expect(q.nextQuestId, `${chain[i]} nextQuestId`).toBe(chain[i + 1]);
    }
  });

  it('EQ-003 reward includes eternal_guardian_skin unlock', () => {
    const q = getQuest('EQ-003')!;
    expect(q.reward.unlocks).toContain('eternal_guardian_skin');
  });

  it('EQ-005 reward includes legend_title and master_aura_skin unlocks', () => {
    const q = getQuest('EQ-005')!;
    expect(q.reward.unlocks).toContain('legend_title');
    expect(q.reward.unlocks).toContain('master_aura_skin');
  });

  it('EQ-005 has 3 objectives (summon + collect_gold + reach_dm_level)', () => {
    const q = getQuest('EQ-005')!;
    expect(q.objectives).toHaveLength(3);
    const types = q.objectives.map(o => o.type);
    expect(types).toContain('summon');
    expect(types).toContain('collect_gold');
    expect(types).toContain('reach_dm_level');
  });

  it('all EQ quest rewards have gems and soulCrystals', () => {
    for (const id of EQ_IDS) {
      const r = getQuest(id)!.reward;
      expect(r.gems,         `${id} gems`).toBeGreaterThan(0);
      expect(r.soulCrystals, `${id} soulCrystals`).toBeGreaterThan(0);
    }
  });
});

describe('EQ chain — applyQuestObjectiveUpdate with fuse_monsters', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = freshGameState();
    gs = { ...gs, dmLevel: 1 }; // prevent reach_dm_level auto-satisfaction
    gs = startQuest(gs, 'EQ-002'); // fuse_monsters(15) + reach_dm_level(20)
  });

  it('increments fuse_monsters objective', () => {
    const [, result] = applyQuestObjectiveUpdate(gs, 'fuse_monsters', 1);
    expect(result).not.toBeNull();
    expect(result!.current).toBe(1);
    expect(result!.questDone).toBe(false);
  });

  it('fuse_monsters does not affect reach_dm_level objective', () => {
    // Increment by 1 — O1 (fuse_monsters) advances, but O2 (reach_dm_level) stays 0
    const [nextGs, result] = applyQuestObjectiveUpdate(gs, 'fuse_monsters', 1);
    expect(result).not.toBeNull();
    // questDone is false because O2 (reach_dm_level) is still pending
    expect(result!.questDone).toBe(false);
    expect(nextGs.questProgress['EQ-002'].objectives['O2']).toBe(0);
  });

  it('quest is done only after both objectives are met', () => {
    [gs] = applyQuestObjectiveUpdate(gs, 'fuse_monsters', 15); // O1 maxed
    const [, done] = applyQuestObjectiveUpdate(gs, 'reach_dm_level', 20); // O2 maxed
    expect(done!.questDone).toBe(true);
  });
});

describe('EQ chain — completeAndAdvance awards unlocks', () => {
  let gs: GameState;

  it('EQ-003 completion grants eternal_guardian_skin in unlockedFeatures', () => {
    gs = freshGameState();
    gs = startQuest(gs, 'EQ-003');
    // Satisfy both objectives
    [gs] = applyQuestObjectiveUpdate(gs, 'summon', 60);
    [gs] = applyQuestObjectiveUpdate(gs, 'collect_gold', 500000);
    // Mark as completed manually so completeAndAdvance can fire
    gs = {
      ...gs,
      questProgress: {
        ...gs.questProgress,
        'EQ-003': { objectives: { O1: 60, O2: 500000 }, completed: false },
      },
    };
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.unlockedFeatures).toContain('eternal_guardian_skin');
  });

  it('EQ-005 completion grants legend_title and master_aura_skin', () => {
    gs = freshGameState();
    gs = startQuest(gs, 'EQ-005');
    gs = {
      ...gs,
      questProgress: {
        ...gs.questProgress,
        'EQ-005': { objectives: { O1: 100, O2: 1000000, O3: 30 }, completed: false },
      },
    };
    const [newGs] = completeAndAdvance(gs);
    expect(newGs.unlockedFeatures).toContain('legend_title');
    expect(newGs.unlockedFeatures).toContain('master_aura_skin');
  });

  it('EQ-005 completion sets activeMainQuestId to empty string (terminal quest)', () => {
    gs = freshGameState();
    gs = startQuest(gs, 'EQ-005');
    gs = {
      ...gs,
      questProgress: {
        ...gs.questProgress,
        'EQ-005': { objectives: { O1: 100, O2: 1000000, O3: 30 }, completed: false },
      },
    };
    const [newGs] = completeAndAdvance(gs);
    // completeAndAdvance sets activeMainQuestId to '' (not null) when nextQuestId is null
    expect(newGs.activeMainQuestId).toBe('');
  });
});

// ─── grantQuestSkins ──────────────────────────────────────────────────────────

describe('grantQuestSkins — no-op cases', () => {
  it('returns the same reference when no quest-gated skins are unlockable', () => {
    const gs = freshGameState();
    // No quests completed → nothing to grant
    const result = grantQuestSkins(gs);
    expect(result).toBe(gs); // same reference = unchanged
  });

  it('does not mutate the original state', () => {
    const gs = freshGameState();
    const before = JSON.stringify(gs);
    grantQuestSkins(gs);
    expect(JSON.stringify(gs)).toBe(before);
  });

  it('returns same reference when all eligible skins are already owned', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-030': { objectives: {}, completed: true },
      },
      ownedSkins: {
        three_legged_crow: ['eternal_crow'], // already owned
      },
    };
    const result = grantQuestSkins(gs);
    expect(result).toBe(gs);
  });
});

describe('grantQuestSkins — skin grants', () => {
  it('grants eternal_crow when MQ-030 is completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-030': { objectives: {}, completed: true },
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['three_legged_crow']).toContain('eternal_crow');
  });

  it('grants divine_warrior when MQ-034 is completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-034': { objectives: {}, completed: true },
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['dokkaebi_warrior']).toContain('divine_warrior');
  });

  it('grants void_death when MQ-039 is completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-039': { objectives: {}, completed: true },
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['death_messenger']).toContain('void_death');
  });

  it('grants sage_primordial when MQ-044 is completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-044': { objectives: {}, completed: true },
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['sage']).toContain('sage_primordial');
  });

  it('grants multiple skins when multiple quests are completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-030': { objectives: {}, completed: true },
        'MQ-034': { objectives: {}, completed: true },
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['three_legged_crow']).toContain('eternal_crow');
    expect(result.ownedSkins?.['dokkaebi_warrior']).toContain('divine_warrior');
  });

  it('does not duplicate a skin already owned for the same monster', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-034': { objectives: {}, completed: true },
      },
      ownedSkins: {
        dokkaebi_warrior: ['divine_warrior'], // pre-existing
      },
    };
    const result = grantQuestSkins(gs);
    const skins = result.ownedSkins?.['dokkaebi_warrior'] ?? [];
    expect(skins.filter(s => s === 'divine_warrior')).toHaveLength(1);
  });

  it('preserves existing owned skins for the same monster', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-034': { objectives: {}, completed: true },
      },
      ownedSkins: {
        dokkaebi_warrior: ['some_other_skin'],
      },
    };
    const result = grantQuestSkins(gs);
    expect(result.ownedSkins?.['dokkaebi_warrior']).toContain('some_other_skin');
    expect(result.ownedSkins?.['dokkaebi_warrior']).toContain('divine_warrior');
  });

  it('does not grant skin when quest is in progress but not completed', () => {
    const gs: GameState = {
      ...freshGameState(),
      questProgress: {
        'MQ-030': { objectives: { O1: 5 }, completed: false },
      },
    };
    const result = grantQuestSkins(gs);
    const skins = result.ownedSkins?.['three_legged_crow'] ?? [];
    expect(skins).not.toContain('eternal_crow');
  });
});
