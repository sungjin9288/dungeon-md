import { describe, expect, it } from 'vitest';
import type { SkillNode } from './barracks';
import { startQuest } from './quests';
import {
  cycleMonsterActiveSkillSlot,
  equipMonsterEquipment,
  feedOwnedMonster,
  purchaseActiveSkillWithGold,
  spendMonsterSkillNode,
} from './barracksTransactions';
import type { GameState } from './wisdom';

function makeMonster(overrides = {}) {
  return {
    id: 'dokkaebi_warrior',
    level: 1,
    xp: 0,
    skillPoints: 0,
    spentSkills: {},
    equippedSkills: [],
    equipment: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 500,
    ownedMonsters: [makeMonster()],
    ownedEquipment: ['dokkaebi_club'],
    ownedActiveSkills: ['fire_burst', 'heal_room'],
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    completedSubQuestIds: [],
    ...overrides,
  } as GameState;
}

const nodeA1: SkillNode = {
  id: 'A1',
  name: '강타',
  tier: 1,
  cost: 1,
  branch: 'A',
  desc: 'ATK +15%',
  icon: 'x',
};

const nodeA2: SkillNode = {
  id: 'A2',
  name: '연속 공격',
  tier: 2,
  cost: 2,
  branch: 'A',
  requires: 'A1',
  desc: '첫 공격 시 2회 연속 타격',
  icon: 'x',
};

describe('barracksTransactions — feedOwnedMonster', () => {
  it('deducts gold, grants monster XP, and preserves input state', () => {
    const state = makeState({ homeGold: 200 });

    const result = feedOwnedMonster(state, 'dokkaebi_warrior', 50, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).not.toBe(state);
    expect(result.state.homeGold).toBe(150);
    expect(result.monster.xp).toBe(20);
    expect(result.monster.level).toBe(1);
    expect(result.levelled).toBe(false);
    expect(state.homeGold).toBe(200);
    expect(state.ownedMonsters[0].xp).toBe(0);
  });

  it('reports levelled=true when XP crosses a level threshold', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ xp: 90 })],
    });

    const result = feedOwnedMonster(state, 'dokkaebi_warrior', 50, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.levelled).toBe(true);
    expect(result.monster.level).toBe(2);
    expect(result.monster.xp).toBe(10);
  });

  it('advances feed quest and sub-quest progress after a successful feed', () => {
    const state = startQuest(makeState({
      activeSubQuestIds: ['SQ-018'],
      subQuestProgress: { 'SQ-018': 0 },
    }), 'MQ-008');

    const result = feedOwnedMonster(state, 'dokkaebi_warrior', 50, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.questProgress['MQ-008'].objectives.O1).toBe(1);
    expect(result.state.subQuestProgress['SQ-018']).toBe(1);
    expect(state.questProgress['MQ-008'].objectives.O1).toBe(0);
    expect(state.subQuestProgress['SQ-018']).toBe(0);
  });

  it('does not charge gold when funds are insufficient', () => {
    const state = startQuest(makeState({
      homeGold: 20,
      activeSubQuestIds: ['SQ-018'],
      subQuestProgress: { 'SQ-018': 0 },
    }), 'MQ-008');

    const result = feedOwnedMonster(state, 'dokkaebi_warrior', 50, 20);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gold');
    expect(result.state).toBe(state);
    expect(state.questProgress['MQ-008'].objectives.O1).toBe(0);
    expect(state.subQuestProgress['SQ-018']).toBe(0);
  });

  it('does not charge gold when the monster is missing', () => {
    const state = makeState({ homeGold: 200, ownedMonsters: [] });

    const result = feedOwnedMonster(state, 'missing', 50, 20);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('monster_not_found');
    expect(result.state.homeGold).toBe(200);
  });
});

describe('barracksTransactions — spendMonsterSkillNode', () => {
  it('spends skill points and marks the node as learned', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ skillPoints: 2 })],
    });

    const result = spendMonsterSkillNode(state, 'dokkaebi_warrior', nodeA1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.skillPoints).toBe(1);
    expect(result.monster.spentSkills).toEqual({ A1: 1 });
    expect(state.ownedMonsters[0].skillPoints).toBe(2);
    expect(state.ownedMonsters[0].spentSkills).toEqual({});
  });

  it('requires prerequisite nodes before spending deeper nodes', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ skillPoints: 3 })],
    });

    const result = spendMonsterSkillNode(state, 'dokkaebi_warrior', nodeA2);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('prerequisite_not_met');
  });

  it('fails when skill points are insufficient or node is already spent', () => {
    const noPoints = makeState();
    const noPointsResult = spendMonsterSkillNode(noPoints, 'dokkaebi_warrior', nodeA1);
    expect(noPointsResult.ok).toBe(false);
    if (!noPointsResult.ok) expect(noPointsResult.reason).toBe('insufficient_skill_points');

    const alreadySpent = makeState({
      ownedMonsters: [makeMonster({ skillPoints: 2, spentSkills: { A1: 1 } })],
    });
    const spentResult = spendMonsterSkillNode(alreadySpent, 'dokkaebi_warrior', nodeA1);
    expect(spentResult.ok).toBe(false);
    if (!spentResult.ok) expect(spentResult.reason).toBe('skill_already_spent');
  });
});

describe('barracksTransactions — equipment and active skills', () => {
  it('equips owned equipment on the selected monster', () => {
    const state = makeState();

    const result = equipMonsterEquipment(state, 'dokkaebi_warrior', 'dokkaebi_club');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.equipment).toBe('dokkaebi_club');
    expect(state.ownedMonsters[0].equipment).toBeNull();
  });

  it('equips crafted equipment even when it only exists in the forge inventory', () => {
    const state = makeState({
      ownedEquipment: [],
      craftedEquipment: [{
        id: 'eq_dokkaebi_club',
        name: '도깨비 방망이',
        type: 'weapon',
        rarity: 1,
        emoji: '🪓',
        stats: { atkBonus: 0.2 },
      }],
    });

    const result = equipMonsterEquipment(state, 'dokkaebi_warrior', 'eq_dokkaebi_club');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.equipment).toBe('eq_dokkaebi_club');
    expect(state.ownedMonsters[0].equipment).toBeNull();
  });

  it('refuses equipment that is not owned', () => {
    const state = makeState();

    const result = equipMonsterEquipment(state, 'dokkaebi_warrior', 'dragon_claw');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('equipment_not_owned');
    expect(result.state).toBe(state);
  });

  it('cycles a monster active skill slot through owned skills', () => {
    const state = makeState({
      ownedMonsters: [makeMonster({ equippedSkills: ['fire_burst'] })],
    });

    const result = cycleMonsterActiveSkillSlot(state, 'dokkaebi_warrior', 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.equippedSkills[0]).toBe('heal_room');
    expect(state.ownedMonsters[0].equippedSkills).toEqual(['fire_burst']);
  });

  it('validates active skill slot and owned skill availability', () => {
    const invalidSlot = cycleMonsterActiveSkillSlot(makeState(), 'dokkaebi_warrior', 2);
    expect(invalidSlot.ok).toBe(false);
    if (!invalidSlot.ok) expect(invalidSlot.reason).toBe('invalid_skill_slot');

    const noSkills = cycleMonsterActiveSkillSlot(makeState({ ownedActiveSkills: [] }), 'dokkaebi_warrior', 0);
    expect(noSkills.ok).toBe(false);
    if (!noSkills.ok) expect(noSkills.reason).toBe('no_owned_active_skills');
  });
});

describe('barracksTransactions — purchaseActiveSkillWithGold', () => {
  it('buys a new active skill with gold without duplicating existing skills', () => {
    const state = makeState({ homeGold: 300, ownedActiveSkills: ['fire_burst'] });

    const result = purchaseActiveSkillWithGold(state, 'heal_room', 120);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.homeGold).toBe(180);
    expect(result.state.ownedActiveSkills).toEqual(['fire_burst', 'heal_room']);
    expect(state.ownedActiveSkills).toEqual(['fire_burst']);
  });

  it('does not charge gold for an already-owned active skill', () => {
    const state = makeState({ homeGold: 300, ownedActiveSkills: ['heal_room'] });

    const result = purchaseActiveSkillWithGold(state, 'heal_room', 120);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.homeGold).toBe(300);
  });

  it('fails without changing state when gold is insufficient', () => {
    const state = makeState({ homeGold: 20, ownedActiveSkills: [] });

    const result = purchaseActiveSkillWithGold(state, 'heal_room', 120);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gold');
    expect(result.state).toBe(state);
  });
});
