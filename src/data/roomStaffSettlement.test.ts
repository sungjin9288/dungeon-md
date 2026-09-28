import { describe, expect, it } from 'vitest';
import { assignMonsterToRoomSlot } from './roomSlotTransactions';
import { collectIdleIncome, computeIdleReward } from './idleIncome';
import { loadGameState, type GameState } from './wisdom';

const START = 1000, HOUR = 3_600_000;
function fixture(): GameState {
  return { ...loadGameState(), homeGold: 5000, dmLevel: 1, wisdomTree: {}, placedDecorations: [],
    notorietyTier: 1, materials: {}, lastIdleCollect: START,
    productionFacilities: { mine: 1, treasury: 1 }, facilityStaff: { treasury: 'dokkaebi_warrior' },
    dungeonSlots: [{ roomType: 'combat', roomLevel: 1, monsterIds: [], trapIds: [], hp: 200, maxHp: 200 }] };
}

describe('working guardian returns to a room', () => {
  it('pays the old staffed rate and applies the unstaffed rate only afterwards', () => {
    const before = fixture(), original = structuredClone(before);
    const owed = computeIdleReward(before, START + HOUR);
    const r = assignMonsterToRoomSlot(before, 0, 0, 'dokkaebi_warrior', START + HOUR);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.homeGold).toBe(5000 + owed.gold);
    expect(r.state.materials.common_ore).toBe(2);
    expect(r.state.lastIdleCollect).toBe(START + HOUR);
    expect(r.state.facilityStaff).toEqual({});
    expect(r.state.dungeonSlots[0].monsterIds[0]).toBe('dokkaebi_warrior');
    const next = collectIdleIncome(r.state, START + 2 * HOUR);
    expect(next.reward.gold).toBe(443); // operation 343.2 + unstaffed treasury 100
    expect(before).toEqual(original);
    const duplicate = assignMonsterToRoomSlot(r.state, 0, 0, 'dokkaebi_warrior', START + HOUR);
    expect(duplicate.state.homeGold).toBe(r.state.homeGold);
  });

  it('preserves fractional material output when moving off a mine', () => {
    const before = { ...fixture(), facilityStaff: { mine: 'dokkaebi_warrior' } };
    const r = assignMonsterToRoomSlot(before, 0, 0, 'dokkaebi_warrior', START + HOUR / 4);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.idleRemainder?.materials.common_ore).toBeCloseTo(0.6);
    expect(collectIdleIncome(r.state, START + HOUR / 4 + HOUR / 5).state.materials.common_ore).toBe(1);
  });

  it('settles before replacing a defender and retains the existing cap', () => {
    const before = fixture(); before.dungeonSlots[0].monsterIds = ['village_archer'];
    const owed = computeIdleReward(before, START + 48 * HOUR);
    const r = assignMonsterToRoomSlot(before, 0, 0, 'dokkaebi_warrior', START + 48 * HOUR);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.homeGold).toBe(5000 + owed.gold);
    expect(r.state.materials.common_ore).toBe(24);
    expect(r.state.lastIdleCollect).toBe(START + 48 * HOUR);
  });

  it('does not settle or remove staffing when the destination is invalid', () => {
    const before = fixture();
    const r = assignMonsterToRoomSlot(before, 0, 99, 'dokkaebi_warrior', START + HOUR);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(before);
    expect(before.facilityStaff.treasury).toBe('dokkaebi_warrior');
  });

  it('initializes a missing idle clock without awarding historical income', () => {
    const r = assignMonsterToRoomSlot({ ...fixture(), lastIdleCollect: 0 }, 0, 0, 'dokkaebi_warrior', START + HOUR);
    expect(r.state.homeGold).toBe(5000);
    expect(r.state.lastIdleCollect).toBe(START + HOUR);
  });
});
