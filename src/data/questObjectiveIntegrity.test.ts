import { describe, expect, it } from 'vitest';
import { applyBattleReturnSettlement } from './invasionTransactions';
import { applyInvaderKillProgress, applyQuestObjectiveProgress } from './progressionTransactions';
import { settleCompletedHomeMainQuest } from './questLifecycleTransactions';
import { startQuest } from './quests';
import { loadGameState, type GameState } from './wisdom';

// §34: main-quest objectives that did not measure what they say.
function withQuest(overrides: Partial<GameState>, questId: string): GameState {
  const base: GameState = { ...loadGameState(), questProgress: {}, activeMainQuestId: '', ...overrides };
  return startQuest(base, questId);
}

function clearedThrough(n: number): GameState['stageProgress'] {
  return Array.from({ length: 90 }, (_, i) => ({ unlocked: i <= n, bestStars: i < n ? 3 : 0 }));
}

describe('reach_dm_level measures the DM level, not the number of battles', () => {
  // MQ-010: reach DM5 + collect 1,000 gold.
  it('records the current level on each settlement instead of adding one', () => {
    let state = withQuest({ dmLevel: 2, dmXP: 0, totalGoldEarned: 0 }, 'MQ-010');
    for (let i = 0; i < 6; i++) {
      state = applyBattleReturnSettlement(state, { won: true, goldEarned: 0, dmXP: 10 }).state;
    }
    const obj = state.questProgress['MQ-010'].objectives;
    expect(state.dmLevel).toBe(2);
    expect(obj.O1).toBe(2);
  });

  it('reaches the target when the DM actually levels up to it', () => {
    const state = withQuest({ dmLevel: 4, dmXP: 390, totalGoldEarned: 0 }, 'MQ-010');
    const settled = applyBattleReturnSettlement(state, { won: true, goldEarned: 0, dmXP: 20 }).state;
    expect(settled.dmLevel).toBe(5);
    expect(settled.questProgress['MQ-010'].objectives.O1).toBe(5);
  });
});

describe('stage-clear quest completion goes through Home', () => {
  // MQ-030 (stage 62) pays bp_celestial_lance, a Home-only completion reward.
  it('ticks the objective without completing, so Home pays the blueprint', () => {
    const state = withQuest({ stageProgress: clearedThrough(61), blueprints: [] }, 'MQ-030');
    const ticked = applyQuestObjectiveProgress(state, 'complete_stage', 62);
    expect(ticked.questDone).toBe(true);
    expect(ticked.state.activeMainQuestId).toBe('MQ-030');
    expect(ticked.state.questProgress['MQ-030'].completed).toBe(false);

    const home = settleCompletedHomeMainQuest(ticked.state);
    expect(home.completion?.completedQuest.id).toBe('MQ-030');
    expect(home.state.blueprints).toContain('bp_celestial_lance');
  });

  it('counts stages cleared before the quest started', () => {
    const state = withQuest({ stageProgress: clearedThrough(12) }, 'MQ-011');
    expect(state.questProgress['MQ-011'].objectives.O1).toBe(11);
  });
});

describe('lifetime gold is counted once', () => {
  it('kills do not add to totalGoldEarned; the loot settlement does', () => {
    const killed = applyInvaderKillProgress({ ...loadGameState(), totalGoldEarned: 30 }, 'shaman');
    expect(killed.state.totalGoldEarned).toBe(30);
    const settled = applyBattleReturnSettlement(killed.state, { won: true, goldEarned: 17, dmXP: 0 }).state;
    expect(settled.totalGoldEarned).toBe(47);
  });
});

describe('Home syncs reach_dm_level before settling', () => {
  // MQ-004: build 2 rooms + reach DM3. A level gained outside a battle
  // settlement (quest/sub-quest reward) must still complete it at Home.
  it('completes when the DM level was reached without a battle settlement', () => {
    const state = withQuest({ dmLevel: 2, dungeonSlots: [], roomsBuilt: ['a', 'b'] }, 'MQ-004');
    expect(state.questProgress['MQ-004'].objectives.O2).toBe(2);
    const leveled: GameState = { ...state, dmLevel: 3 };
    const home = settleCompletedHomeMainQuest(leveled);
    expect(home.completion?.completedQuest.id).toBe('MQ-004');
  });

  it('does not complete while the level is still short', () => {
    const state = withQuest({ dmLevel: 2, dungeonSlots: [], roomsBuilt: ['a', 'b'] }, 'MQ-004');
    expect(settleCompletedHomeMainQuest(state).completion).toBeNull();
  });
});

describe('upgrade_room cannot deadlock once every room is maxed (§35)', () => {
  const maxedSlots = (n: number, level: number) => Array.from({ length: n }, () => ({
    roomType: 'combat' as const, roomLevel: level, hp: 100, maxHp: 100, monsterIds: [], trapIds: [],
  }));

  it('auto-meets upgrade_room when no unlocked room can be upgraded any further', () => {
    const state = withQuest({ dmLevel: 20, dungeonSlots: maxedSlots(9, 5) as never }, 'MQ-036');
    const quest = state.questProgress['MQ-036'].objectives;
    expect(Object.values(quest)).toContain(4);
  });

  it('keeps upgrade_room open while any room is below the cap', () => {
    const slots = maxedSlots(9, 5);
    slots[3] = { ...slots[3], roomLevel: 4 };
    const state = withQuest({ dmLevel: 20, dungeonSlots: slots as never }, 'MQ-036');
    expect(Object.values(state.questProgress['MQ-036'].objectives)).not.toContain(4);
  });
});

describe('lifetime gold counts every income (§35)', () => {
  it('Home re-syncs collect_gold from totalGoldEarned', () => {
    // MQ-010: DM5 + 1,000 gold; lifetime reached through idle income, not loot.
    const state = withQuest({ dmLevel: 5, totalGoldEarned: 0 }, 'MQ-010');
    const earned: GameState = { ...state, totalGoldEarned: 1200 };
    expect(settleCompletedHomeMainQuest(earned).completion?.completedQuest.id).toBe('MQ-010');
  });
});
