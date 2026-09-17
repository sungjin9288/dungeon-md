import { describe, expect, it } from 'vitest';
import { getLineageGoalPlan, getLineageNextStep, getLineageNode, suggestLineageGoal, withLineageGoal } from './lineage';
import { loadGameState, type GameState, type OwnedMonster } from './wisdom';

function owned(id: string): OwnedMonster {
  return { id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null };
}
function state(ids: string[]): GameState {
  return { ...loadGameState(), ownedMonsters: ids.map(owned) };
}

describe('lineage nodes', () => {
  it('derives base, evolution, and hybrid relations without new data', () => {
    const base = getLineageNode('dokkaebi_warrior');
    expect(base.kind).toBe('base');
    expect(base.parents).toEqual([]);
    expect(base.children).toContain('dokkaebi_warrior_unc');
    expect(base.children).toContain('fox_warrior');
    const rare = getLineageNode('dokkaebi_warrior_rare');
    expect(rare.kind).toBe('evolution');
    expect(rare.parents).toEqual(['dokkaebi_warrior_unc']);
    expect(rare.children).toEqual(['dokkaebi_warrior_epic']);
    const hybrid = getLineageNode('fox_warrior');
    expect(hybrid.kind).toBe('hybrid');
    expect(hybrid.parents).toEqual(['dokkaebi_warrior', 'gumiho_guardian']);
  });
});

describe('lineage goal plan', () => {
  it('an owned goal is done; an unowned base is a summon', () => {
    expect(getLineageGoalPlan(state(['sage']), 'sage')[0].kind).toBe('owned');
    expect(getLineageNextStep(state(['sage']), 'sage')).toBeNull();
    expect(getLineageNextStep(state([]), 'sage')).toMatchObject({ kind: 'summon', targetId: 'sage' });
  });

  it('a hybrid needs its missing parent first, then the combination', () => {
    const plan = getLineageGoalPlan(state(['dokkaebi_warrior']), 'fox_warrior');
    expect(plan.map(step => step.kind)).toEqual(['summon', 'combine']);
    expect(plan[0].targetId).toBe('gumiho_guardian');
    expect(plan[1]).toMatchObject({ have: 1, need: 2 });
    const ready = getLineageGoalPlan(state(['dokkaebi_warrior', 'gumiho_guardian']), 'fox_warrior');
    expect(ready.map(step => step.kind)).toEqual(['combine']);
    expect(ready[0].label).toContain('영혼 결정 100');
  });

  it('an evolution counts copies of the previous stage and asks for more when short', () => {
    const short = getLineageGoalPlan(state(['dokkaebi_warrior']), 'dokkaebi_warrior_unc');
    expect(short.map(step => step.kind)).toEqual(['summon', 'evolve']);
    expect(short[0].label).toContain('×3 모으기 (보유 1/3)');
    const ready = getLineageGoalPlan(state(['dokkaebi_warrior', 'dokkaebi_warrior', 'dokkaebi_warrior']), 'dokkaebi_warrior_unc');
    expect(ready.map(step => step.kind)).toEqual(['evolve']);
    expect(ready[0]).toMatchObject({ have: 3, need: 3 });
    // Two stages up: the plan reaches through the intermediate stage.
    const deep = getLineageGoalPlan(state([]), 'dokkaebi_warrior_rare');
    expect(deep.map(step => step.kind)).toEqual(['summon', 'evolve', 'evolve']);
  });

  it('suggests a pin: the guardian while unowned, its next stage once owned, else a hybrid child', () => {
    expect(suggestLineageGoal(state([]), 'dokkaebi_warrior')).toBe('dokkaebi_warrior');
    expect(suggestLineageGoal(state(['dokkaebi_warrior']), 'dokkaebi_warrior')).toBe('dokkaebi_warrior_unc');
    expect(suggestLineageGoal(state(['dokkaebi_warrior_leg']), 'dokkaebi_warrior_leg')).toBeNull();
    expect(suggestLineageGoal(state(['death_messenger']), 'death_messenger')).toBe('soul_guardian');
    expect(withLineageGoal(state([]), 'fox_warrior').lineageGoal).toBe('fox_warrior');
  });
});
