import { describe, expect, it } from 'vitest';
import { BOND_ACTIONS, BOND_ACTION_ORDER, BOND_THRESHOLDS, bondAtkMult, bondThresholdsCrossed, bondTier, nextBondThreshold } from './bond';
import { canPerformBondAction, getBondCountsToday, performBondAction } from './bondTransactions';
import { MATERIAL_DEFS } from './fusion';
import { loadGameState, type GameState } from './wisdom';

const TODAY = '2026-09-18';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), homeGold: 1000, materials: { herb: 2, common_ore: 1 }, ...overrides } as GameState;
}
const HERO = 'dokkaebi_warrior';

describe('bond data', () => {
  it('has three ordered actions whose material options are real materials', () => {
    expect(BOND_ACTION_ORDER.map(id => BOND_ACTIONS[id].id)).toEqual(BOND_ACTION_ORDER);
    for (const action of Object.values(BOND_ACTIONS)) {
      for (const option of action.materialsAny) for (const id of Object.keys(option)) expect(MATERIAL_DEFS[id], id).toBeDefined();
    }
  });

  it('thresholds climb 25/50/75/100 with rising attack bonuses', () => {
    expect(BOND_THRESHOLDS.map(t => t.at)).toEqual([25, 50, 75, 100]);
    expect(bondTier(24)).toBeNull();
    expect(bondTier(25)?.label).toBe('신뢰');
    expect(bondTier(100)?.label).toBe('일심');
    expect(bondAtkMult(undefined)).toBe(1);
    expect(bondAtkMult(74)).toBeCloseTo(1.06);
    expect(bondAtkMult(100)).toBeCloseTo(1.15);
    expect(bondThresholdsCrossed(20, 55).map(t => t.at)).toEqual([25, 50]);
    expect(nextBondThreshold(76)?.at).toBe(100);
    expect(nextBondThreshold(100)).toBeNull();
  });
});

describe('bond transactions', () => {
  it('a treat spends the first payable material option and raises affinity', () => {
    const r = performBondAction(state({ materials: { common_ore: 1 } }), HERO, 'treat', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spentMaterials).toEqual({ common_ore: 1 });
    expect(r.state.materials.common_ore).toBe(0);
    expect(r.affinityAfter).toBe(8);
    expect(r.remainingToday).toBe(2);
    expect(getBondCountsToday(r.state, HERO, TODAY)).toEqual({ treat: 1 });
  });

  it('daily limits reset with the date; talk is free once a day', () => {
    let s = state();
    const first = performBondAction(s, HERO, 'talk', TODAY);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    s = first.state;
    expect(s.homeGold).toBe(1000);
    expect(canPerformBondAction(s, HERO, 'talk', TODAY)).toMatchObject({ ok: false, reason: 'daily_limit', remaining: 0 });
    expect(canPerformBondAction(s, HERO, 'talk', '2026-09-19')).toMatchObject({ ok: true, remaining: 1 });
  });

  it('sparring costs gold and grants guardian XP; refuses when broke or unowned', () => {
    const r = performBondAction(state(), HERO, 'spar', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spentGold).toBe(120);
    expect(r.state.homeGold).toBe(880);
    const before = state().ownedMonsters.find(m => m.id === HERO)!;
    const after = r.state.ownedMonsters.find(m => m.id === HERO)!;
    expect(after.xp + (after.level - before.level) * 1000).toBeGreaterThan(before.xp);
    expect(performBondAction(state({ homeGold: 10 }), HERO, 'spar', TODAY)).toMatchObject({ ok: false, reason: 'insufficient_gold' });
    expect(performBondAction(state(), 'ghost', 'talk', TODAY)).toMatchObject({ ok: false, reason: 'not_owned' });
    expect(performBondAction(state({ materials: {} }), HERO, 'treat', TODAY)).toMatchObject({ ok: false, reason: 'insufficient_materials' });
  });

  it('crossing 75 pays the soul-crystal gift once, and 100 closes the bond', () => {
    const s = state({ monsterAffinity: { [HERO]: 70 }, soulCrystals: 5 });
    const r = performBondAction(s, HERO, 'treat', TODAY);
    expect(r.ok && r.crossed.map(t => t.at)).toEqual([75]);
    expect(r.ok && r.state.soulCrystals).toBe(35);
    const nearMax = performBondAction(state({ monsterAffinity: { [HERO]: 96 } }), HERO, 'treat', TODAY);
    expect(nearMax.ok && nearMax.affinityAfter).toBe(100);
    expect(nearMax.ok && canPerformBondAction(nearMax.state, HERO, 'talk', TODAY)).toMatchObject({ ok: false, reason: 'bond_maxed' });
  });
});
