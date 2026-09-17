import { describe, expect, it } from 'vitest';
import { getHomeTodos, hasHomeTodos } from './homeTodos';
import { loadGameState, type GameState, type OwnedMonster } from './wisdom';

const TODAY = '2026-09-18';
function owned(id: string): OwnedMonster {
  return { id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null };
}
function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ownedMonsters: [owned('dokkaebi_warrior')], ...overrides };
}

describe('home todos', () => {
  it('counts guardians who can still bond today, and stops counting a maxed one', () => {
    expect(getHomeTodos(state(), TODAY).bondGuardians).toBe(1); // 대화 is free
    const maxed = state({ monsterAffinity: { dokkaebi_warrior: 100 } });
    expect(getHomeTodos(maxed, TODAY).bondGuardians).toBe(0);
    const spent = state({ bondDaily: { dokkaebi_warrior: { date: TODAY, counts: { talk: 1, treat: 3, spar: 2 } } }, materials: {}, homeGold: 0 });
    expect(getHomeTodos(spent, TODAY).bondGuardians).toBe(0);
    expect(getHomeTodos(spent, '2026-09-19').bondGuardians).toBe(1);
  });

  it('counts built facilities with nobody on shift', () => {
    expect(getHomeTodos(state({ productionFacilities: { mine: 1, treasury: 2 } }), TODAY).unstaffedFacilities).toBe(2);
    expect(getHomeTodos(state({ productionFacilities: { mine: 1, treasury: 2 }, facilityStaff: { mine: 'dokkaebi_warrior' } }), TODAY).unstaffedFacilities).toBe(1);
    expect(getHomeTodos(state({ productionFacilities: {} }), TODAY).unstaffedFacilities).toBe(0);
  });

  it('counts only craftable fusions, not tier-1 traps', () => {
    const rich = state({ dmLevel: 20, materials: { iron_shard: 9, herb: 9 }, trapStock: { spike_trap: 1, poison_trap: 1 } });
    expect(getHomeTodos(rich, TODAY).trapFusions).toBe(1);
    expect(getHomeTodos(state({ dmLevel: 20, materials: { iron_shard: 9 } }), TODAY).trapFusions).toBe(0);
  });

  it('hasHomeTodos is true when any count is non-zero', () => {
    expect(hasHomeTodos({ bondGuardians: 0, unstaffedFacilities: 0, trapFusions: 0 })).toBe(false);
    expect(hasHomeTodos({ bondGuardians: 0, unstaffedFacilities: 1, trapFusions: 0 })).toBe(true);
  });
});
