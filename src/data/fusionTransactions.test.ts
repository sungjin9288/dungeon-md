import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import {
  FUSION_COMBINATION_COST,
  applyFusionAbsorption,
  applyFusionAwakening,
  applyFusionCombination,
  applyFusionEvolution,
} from './fusionTransactions';
import type { GameState } from './wisdom';

function monster(id: string, level = 1) {
  return { ...defaultOwnedMonster(id), level };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    soulCrystals: 150,
    ownedMonsters: [],
    discoveredCombinations: [],
    totalFusions: 0,
    activeMainQuestId: '',
    questProgress: {},
    activeSubQuestIds: [],
    subQuestProgress: {},
    ...overrides,
  } as GameState;
}

describe('fusionTransactions — combination', () => {
  it('creates a known hybrid, records discovery, and advances fusion progress', () => {
    const slotA = monster('dokkaebi_warrior', 5);
    const slotB = monster('gumiho_guardian', 8);
    const state = makeState({
      soulCrystals: 150,
      ownedMonsters: [slotA, slotB],
      totalFusions: 4,
      activeMainQuestId: 'MQ-038',
      questProgress: {
        'MQ-038': {
          objectives: { O1: 0, O2: 0 },
          completed: false,
        },
      },
      activeSubQuestIds: ['SQ-003'],
      subQuestProgress: {},
    });

    const result = applyFusionCombination(state, slotA, slotB);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.recipeMatched) return;
    expect(result.recipeKey).toBe('dokkaebi_warrior+gumiho_guardian');
    expect(result.hybridId).toBe('fox_warrior');
    expect(result.hybrid).toMatchObject({ baseDamage: 28, passive: 'DUAL_STRIKE' });
    expect(result.isNewDiscovery).toBe(true);
    expect(result.monster).toMatchObject({
      id: 'fox_warrior',
      level: 7,
      xp: 0,
      rarity: 2,
      absorptionStacks: 0,
    });
    expect(result.state.soulCrystals).toBe(50);
    expect(result.state.ownedMonsters.map(m => m.id)).toEqual([
      'dokkaebi_warrior',
      'gumiho_guardian',
      'fox_warrior',
    ]);
    expect(result.state.discoveredCombinations).toEqual(['fox_warrior']);
    expect(result.state.totalFusions).toBe(5);
    expect(result.state.questProgress['MQ-038'].objectives.O1).toBe(1);
    expect(result.state.subQuestProgress['SQ-003']).toBe(1);
    expect(state.soulCrystals).toBe(150);
    expect(state.discoveredCombinations).toEqual([]);
    expect(state.totalFusions).toBe(4);
  });

  it('does not duplicate an existing discovery when repeating a known recipe', () => {
    const slotA = monster('dokkaebi_warrior', 1);
    const slotB = monster('gumiho_guardian', 1);
    const state = makeState({
      ownedMonsters: [slotA, slotB],
      discoveredCombinations: ['fox_warrior'],
      totalFusions: 1,
    });

    const result = applyFusionCombination(state, slotA, slotB);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.recipeMatched) return;
    expect(result.isNewDiscovery).toBe(false);
    expect(result.state.discoveredCombinations).toEqual(['fox_warrior']);
    expect(result.state.ownedMonsters.filter(m => m.id === 'fox_warrior')).toHaveLength(1);
    expect(result.state.totalFusions).toBe(2);
  });

  it('spends crystals but does not advance fusion progress for an unknown recipe', () => {
    const slotA = monster('dokkaebi_warrior', 3);
    const slotB = monster('village_archer', 3);
    const state = makeState({
      soulCrystals: 150,
      ownedMonsters: [slotA, slotB],
      totalFusions: 2,
      discoveredCombinations: ['fox_warrior'],
    });

    const result = applyFusionCombination(state, slotA, slotB);

    expect(result.ok).toBe(true);
    if (!result.ok || result.recipeMatched) return;
    expect(result.recipeKey).toBe('dokkaebi_warrior+village_archer');
    expect(result.state.soulCrystals).toBe(50);
    expect(result.state.ownedMonsters).toEqual([slotA, slotB]);
    expect(result.state.discoveredCombinations).toEqual(['fox_warrior']);
    expect(result.state.totalFusions).toBe(2);
    expect(state.soulCrystals).toBe(150);
  });

  it('fails without changing state when slots or crystals are insufficient', () => {
    const slotA = monster('dokkaebi_warrior', 1);
    const slotB = monster('gumiho_guardian', 1);
    const missing = makeState({ soulCrystals: FUSION_COMBINATION_COST });
    const poor = makeState({ soulCrystals: FUSION_COMBINATION_COST - 1 });

    const missingResult = applyFusionCombination(missing, slotA, null);
    const poorResult = applyFusionCombination(poor, slotA, slotB);

    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.reason).toBe('missing_combination_slots');
      expect(missingResult.state).toBe(missing);
    }
    expect(poorResult.ok).toBe(false);
    if (!poorResult.ok) {
      expect(poorResult.reason).toBe('insufficient_soul_crystals');
      expect(poorResult.state).toBe(poor);
    }
  });

  it('rejects a stale source that is no longer in the owned roster', () => {
    const slotA = monster('dokkaebi_warrior', 5);
    const slotB = monster('gumiho_guardian', 8);
    const state = makeState({
      soulCrystals: FUSION_COMBINATION_COST,
      ownedMonsters: [slotB],
    });

    const result = applyFusionCombination(state, slotA, slotB);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('combination_source_not_owned');
      expect(result.state).toBe(state);
    }
    expect(state.soulCrystals).toBe(FUSION_COMBINATION_COST);
    expect(state.ownedMonsters).toEqual([slotB]);
  });

  it('requires two owned copies when the same source is supplied twice', () => {
    const slot = monster('dokkaebi_warrior', 5);
    const state = makeState({
      soulCrystals: FUSION_COMBINATION_COST,
      ownedMonsters: [slot],
    });

    const result = applyFusionCombination(state, slot, slot);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('combination_source_not_owned');
    expect(result.state).toBe(state);
  });
});

describe('fusionTransactions — evolution', () => {
  it('consumes three matching monsters, creates the next evolution, and advances fusion progress', () => {
    const slots = [
      monster('dokkaebi_warrior', 3),
      monster('dokkaebi_warrior', 7),
      monster('dokkaebi_warrior', 5),
    ] as const;
    const other = monster('gumiho_guardian', 2);
    const state = makeState({
      ownedMonsters: [...slots, other],
      totalFusions: 9,
      activeMainQuestId: 'MQ-038',
      questProgress: {
        'MQ-038': {
          objectives: { O1: 2, O2: 0 },
          completed: false,
        },
      },
      activeSubQuestIds: ['SQ-004'],
      subQuestProgress: { 'SQ-004': 2 },
    });

    const result = applyFusionEvolution(state, slots);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.consumedMonsterId).toBe('dokkaebi_warrior');
    expect(result.resultId).toBe('dokkaebi_warrior_unc');
    expect(result.monster).toMatchObject({
      id: 'dokkaebi_warrior_unc',
      level: 7,
      xp: 0,
      skillPoints: 0,
      spentSkills: { A2: 1 },
      rarity: 1,
      absorptionStacks: 0,
    });
    expect(result.state.ownedMonsters.map(m => m.id)).toEqual([
      'gumiho_guardian',
      'dokkaebi_warrior_unc',
    ]);
    expect(result.state.totalFusions).toBe(10);
    expect(result.state.questProgress['MQ-038'].objectives.O1).toBe(3);
    expect(result.state.subQuestProgress['SQ-004']).toBe(3);
    expect(state.ownedMonsters.map(m => m.id)).toEqual([
      'dokkaebi_warrior',
      'dokkaebi_warrior',
      'dokkaebi_warrior',
      'gumiho_guardian',
    ]);
    expect(state.totalFusions).toBe(9);
  });

  it('evolves uncommon monsters into rare monsters with the correct unlocked skill', () => {
    const slots = [
      monster('dokkaebi_warrior_unc', 4),
      monster('dokkaebi_warrior_unc', 4),
      monster('dokkaebi_warrior_unc', 4),
    ] as const;
    const state = makeState({ ownedMonsters: [...slots] });

    const result = applyFusionEvolution(state, slots);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resultId).toBe('dokkaebi_warrior_rare');
    expect(result.monster.spentSkills).toEqual({ A3: 1 });
    expect(result.monster.rarity).toBe(2);
  });

  it('fails without changing state when evolution slots are missing or mismatched', () => {
    const slotA = monster('dokkaebi_warrior', 1);
    const slotB = monster('gumiho_guardian', 1);
    const state = makeState({
      ownedMonsters: [slotA, slotA, slotA, slotB],
    });

    const missingResult = applyFusionEvolution(state, [slotA, slotA, null]);
    const mismatchedResult = applyFusionEvolution(state, [slotA, slotA, slotB]);

    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.reason).toBe('missing_evolution_slots');
      expect(missingResult.state).toBe(state);
    }
    expect(mismatchedResult.ok).toBe(false);
    if (!mismatchedResult.ok) {
      expect(mismatchedResult.reason).toBe('mismatched_evolution_slots');
      expect(mismatchedResult.state).toBe(state);
    }
  });

  it('fails without changing state when no next evolution or not enough owned materials exist', () => {
    const legendary = [
      monster('dokkaebi_warrior_leg', 50),
      monster('dokkaebi_warrior_leg', 50),
      monster('dokkaebi_warrior_leg', 50),
    ] as const;
    const twoOnly = [
      monster('dokkaebi_warrior', 1),
      monster('dokkaebi_warrior', 1),
      monster('dokkaebi_warrior', 1),
    ] as const;
    const noNextState = makeState({ ownedMonsters: [...legendary] });
    const insufficientState = makeState({ ownedMonsters: twoOnly.slice(0, 2) });

    const noNextResult = applyFusionEvolution(noNextState, legendary);
    const insufficientResult = applyFusionEvolution(insufficientState, twoOnly);

    expect(noNextResult.ok).toBe(false);
    if (!noNextResult.ok) {
      expect(noNextResult.reason).toBe('evolution_not_available');
      expect(noNextResult.state).toBe(noNextState);
    }
    expect(insufficientResult.ok).toBe(false);
    if (!insufficientResult.ok) {
      expect(insufficientResult.reason).toBe('insufficient_evolution_materials');
      expect(insufficientResult.state).toBe(insufficientState);
    }
  });
});

describe('fusionTransactions — absorption', () => {
  it('removes sacrifices, grants XP and stacks, and advances fusion progress', () => {
    const target = monster('dokkaebi_warrior', 1);
    target.xp = 90;
    target.absorptionStacks = 1;
    const sameBaseSacrifice = monster('dokkaebi_warrior_unc', 4);
    sameBaseSacrifice.rarity = 1;
    const otherSacrifice = monster('gumiho_guardian', 2);
    const keeper = monster('white_tiger', 3);
    const state = makeState({
      ownedMonsters: [target, sameBaseSacrifice, otherSacrifice, keeper],
      totalFusions: 11,
      activeMainQuestId: 'MQ-038',
      questProgress: {
        'MQ-038': {
          objectives: { O1: 1, O2: 0 },
          completed: false,
        },
      },
      activeSubQuestIds: ['SQ-004'],
      subQuestProgress: { 'SQ-004': 1 },
    });

    const result = applyFusionAbsorption(state, target, [sameBaseSacrifice, otherSacrifice]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalXp).toBe(110);
    expect(result.sameTypeCount).toBe(1);
    expect(result.newStacks).toBe(2);
    expect(result.levelled).toBe(true);
    expect(result.target).toMatchObject({
      id: 'dokkaebi_warrior',
      level: 2,
      xp: 100,
      absorptionStacks: 2,
    });
    expect(result.state.ownedMonsters.map(m => m.id)).toEqual([
      'dokkaebi_warrior',
      'white_tiger',
    ]);
    expect(result.state.ownedMonsters[0]).toEqual(result.target);
    expect(result.state.totalFusions).toBe(12);
    expect(result.state.questProgress['MQ-038'].objectives.O1).toBe(2);
    expect(result.state.subQuestProgress['SQ-004']).toBe(2);
    expect(state.ownedMonsters.map(m => m.id)).toEqual([
      'dokkaebi_warrior',
      'dokkaebi_warrior_unc',
      'gumiho_guardian',
      'white_tiger',
    ]);
    expect(state.totalFusions).toBe(11);
  });

  it('caps same-type absorption stacks at 10', () => {
    const target = monster('dokkaebi_warrior', 1);
    target.absorptionStacks = 9;
    const sacrifices = [
      monster('dokkaebi_warrior_unc', 1),
      monster('dokkaebi_warrior_rare', 1),
    ] as const;
    sacrifices[0].rarity = 1;
    sacrifices[1].rarity = 2;
    const state = makeState({ ownedMonsters: [target, ...sacrifices] });

    const result = applyFusionAbsorption(state, target, sacrifices);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sameTypeCount).toBe(2);
    expect(result.newStacks).toBe(10);
    expect(result.target.absorptionStacks).toBe(10);
  });

  it('fails without changing state when target or sacrifices are missing', () => {
    const target = monster('dokkaebi_warrior', 1);
    const sacrifice = monster('gumiho_guardian', 1);
    const state = makeState({ ownedMonsters: [target, sacrifice] });

    const missingTarget = applyFusionAbsorption(state, null, [sacrifice]);
    const missingSacrifice = applyFusionAbsorption(state, target, []);

    expect(missingTarget.ok).toBe(false);
    if (!missingTarget.ok) {
      expect(missingTarget.reason).toBe('missing_absorption_target');
      expect(missingTarget.state).toBe(state);
    }
    expect(missingSacrifice.ok).toBe(false);
    if (!missingSacrifice.ok) {
      expect(missingSacrifice.reason).toBe('missing_absorption_sacrifices');
      expect(missingSacrifice.state).toBe(state);
    }
  });

  it('fails without changing state for invalid target or sacrifice selections', () => {
    const target = monster('dokkaebi_warrior', 1);
    const sacrifice = monster('gumiho_guardian', 1);
    const missingSacrifice = monster('white_tiger', 1);
    const state = makeState({ ownedMonsters: [target, sacrifice] });
    const targetMissingState = makeState({ ownedMonsters: [sacrifice] });

    const targetAsSacrifice = applyFusionAbsorption(state, target, [target]);
    const targetMissing = applyFusionAbsorption(targetMissingState, target, [sacrifice]);
    const materialMissing = applyFusionAbsorption(state, target, [missingSacrifice]);

    expect(targetAsSacrifice.ok).toBe(false);
    if (!targetAsSacrifice.ok) {
      expect(targetAsSacrifice.reason).toBe('absorption_target_selected_as_sacrifice');
      expect(targetAsSacrifice.state).toBe(state);
    }
    expect(targetMissing.ok).toBe(false);
    if (!targetMissing.ok) {
      expect(targetMissing.reason).toBe('absorption_target_not_owned');
      expect(targetMissing.state).toBe(targetMissingState);
    }
    expect(materialMissing.ok).toBe(false);
    if (!materialMissing.ok) {
      expect(materialMissing.reason).toBe('insufficient_absorption_materials');
      expect(materialMissing.state).toBe(state);
    }
  });
});

describe('fusionTransactions — awakening', () => {
  it('spends one awakening stone, marks the monster awakened, and grants stacks', () => {
    const target = monster('dokkaebi_warrior', 10);
    target.absorptionStacks = 2;
    const duplicate = monster('dokkaebi_warrior', 4);
    duplicate.absorptionStacks = 1;
    const other = monster('gumiho_guardian', 3);
    const state = makeState({
      awakeningStones: 2,
      monsterAffinity: { dokkaebi_warrior: 100 },
      monsterAwakened: {},
      ownedMonsters: [target, duplicate, other],
      totalFusions: 5,
    });

    const result = applyFusionAwakening(state, target);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monsterId).toBe('dokkaebi_warrior');
    expect(result.affectedCount).toBe(2);
    expect(result.monster.absorptionStacks).toBe(5);
    expect(result.state.awakeningStones).toBe(1);
    expect(result.state.monsterAwakened).toEqual({ dokkaebi_warrior: true });
    expect(result.state.ownedMonsters.map(m => [m.id, m.absorptionStacks])).toEqual([
      ['dokkaebi_warrior', 5],
      ['dokkaebi_warrior', 4],
      ['gumiho_guardian', 0],
    ]);
    expect(result.state.totalFusions).toBe(5);
    expect(state.awakeningStones).toBe(2);
    expect(state.monsterAwakened).toEqual({});
    expect(state.ownedMonsters.map(m => [m.id, m.absorptionStacks])).toEqual([
      ['dokkaebi_warrior', 2],
      ['dokkaebi_warrior', 1],
      ['gumiho_guardian', 0],
    ]);
  });

  it('fails without changing state when target is missing or not owned', () => {
    const target = monster('dokkaebi_warrior', 1);
    const state = makeState({
      awakeningStones: 1,
      monsterAffinity: { dokkaebi_warrior: 100 },
      ownedMonsters: [],
    });

    const missingTarget = applyFusionAwakening(state, null);
    const notOwned = applyFusionAwakening(state, target);

    expect(missingTarget.ok).toBe(false);
    if (!missingTarget.ok) {
      expect(missingTarget.reason).toBe('missing_awakening_target');
      expect(missingTarget.state).toBe(state);
    }
    expect(notOwned.ok).toBe(false);
    if (!notOwned.ok) {
      expect(notOwned.reason).toBe('awakening_target_not_owned');
      expect(notOwned.state).toBe(state);
    }
  });

  it('fails without changing state when already awakened, affinity is low, or stones are insufficient', () => {
    const target = monster('dokkaebi_warrior', 1);
    const base = makeState({
      ownedMonsters: [target],
      awakeningStones: 1,
      monsterAffinity: { dokkaebi_warrior: 100 },
      monsterAwakened: {},
    });

    const alreadyAwakened = applyFusionAwakening({
      ...base,
      monsterAwakened: { dokkaebi_warrior: true },
    }, target);
    const lowAffinity = applyFusionAwakening({
      ...base,
      monsterAffinity: { dokkaebi_warrior: 99 },
    }, target);
    const noStones = applyFusionAwakening({
      ...base,
      awakeningStones: 0,
    }, target);

    expect(alreadyAwakened.ok).toBe(false);
    if (!alreadyAwakened.ok) expect(alreadyAwakened.reason).toBe('monster_already_awakened');
    expect(lowAffinity.ok).toBe(false);
    if (!lowAffinity.ok) expect(lowAffinity.reason).toBe('insufficient_awakening_affinity');
    expect(noStones.ok).toBe(false);
    if (!noStones.ok) expect(noStones.reason).toBe('insufficient_awakening_stones');
  });
});

describe('fusionTransactions — the selected copies are the ones used', () => {
  // OwnedMonster has no instance id; copies of one kind differ only by level/xp/etc. The transaction must act on
  // the copies the player picked, not on the first copies of that kind in the owned list.
  it('evolution consumes the three picked copies and keeps an unpicked higher-level copy', () => {
    const veteran = monster('dokkaebi_warrior', 10);
    const fodder = [monster('dokkaebi_warrior', 1), monster('dokkaebi_warrior', 1), monster('dokkaebi_warrior', 1)];
    const state = makeState({ ownedMonsters: [veteran, ...fodder] });

    const result = applyFusionEvolution(state, fodder.map(m => ({ ...m })));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.level).toBe(1);
    expect(result.state.ownedMonsters.filter(m => m.id === 'dokkaebi_warrior').map(m => m.level)).toEqual([10]);
  });

  it('absorption feeds the picked target copy and leaves other copies of that kind alone', () => {
    const rookie = monster('dokkaebi_warrior', 1);
    const champion = monster('dokkaebi_warrior', 9);
    const sacrifice = monster('gumiho_guardian', 1);
    const state = makeState({ ownedMonsters: [rookie, champion, sacrifice] });

    const result = applyFusionAbsorption(state, { ...champion }, [{ ...sacrifice }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const warriors = result.state.ownedMonsters.filter(m => m.id === 'dokkaebi_warrior');
    expect(warriors).toHaveLength(2);
    expect(warriors.find(m => m.level === 1)).toEqual(rookie);
    expect(result.target.level).toBeGreaterThanOrEqual(9);
  });

  it('absorption removes the picked sacrifice copy, not a stronger copy of the same kind', () => {
    const target = monster('white_tiger', 5);
    const strong = monster('gumiho_guardian', 8);
    const weak = monster('gumiho_guardian', 1);
    const state = makeState({ ownedMonsters: [target, strong, weak] });

    const result = applyFusionAbsorption(state, { ...target }, [{ ...weak }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownedMonsters.filter(m => m.id === 'gumiho_guardian').map(m => m.level)).toEqual([8]);
  });
});
