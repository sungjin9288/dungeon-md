import { describe, expect, it } from 'vitest';
import { assignMonsterToRoomSlot, changeRoomSlotType, createDefaultDungeonSlot, removeMonsterFromRoomSlot, setRoomSlotBuilding, upgradeRoomSlot } from './roomSlotTransactions';
import { collectIdleIncome, computeIdleReward } from './idleIncome';
import { loadGameState, type GameState } from './wisdom';

const START = 1000, HOUR = 3_600_000;
function fixture(): GameState {
  return { ...loadGameState(), dmLevel: 20, homeGold: 5000, lastIdleCollect: START,
    wisdomTree: {}, placedDecorations: [], notorietyTier: 1, materials: {},
    productionFacilities: { treasury: 1 }, facilityStaff: {},
    dungeonSlots: [createDefaultDungeonSlot('combat', 'guardian')] };
}

describe('room operating rate changes', () => {
  it.each([0, 1])('rejects an undesigned Lv.%i upgrade without spending or settling income', roomLevel => {
    const before = { ...fixture(), dungeonSlots: [{ ...createDefaultDungeonSlot(), roomLevel }] };
    expect(upgradeRoomSlot(before, 0, START + HOUR))
      .toEqual({ ok: false, state: before, reason: 'room_not_built' });
  });
  it('construction pays existing facilities without granting past room income', () => {
    const before = { ...fixture(), dungeonSlots: [createDefaultDungeonSlot()] };
    const r = changeRoomSlotType(before, 0, 'combat', START + HOUR);
    expect(r.state.homeGold).toBe(5100);
    expect(r.state.lastIdleCollect).toBe(START + HOUR);
    expect(computeIdleReward(r.state, START + 2 * HOUR).gold).toBe(532);
    expect(before.dungeonSlots[0].roomType).toBeUndefined();
  });

  it('upgrade pays the old level before spending, then uses the new level', () => {
    const before = fixture();
    const r = upgradeRoomSlot(before, 0, START + HOUR);
    expect(r.state.homeGold).toBe(5000 + 532 - 150);
    expect(computeIdleReward(r.state, START + 2 * HOUR).gold).toBe(748);
    expect(before.homeGold).toBe(5000);
  });

  it('a gold room conversion cannot reprice the preceding hour', () => {
    const before = fixture();
    const r = setRoomSlotBuilding(before, 0, 'gold', START + HOUR);
    expect(r.ok).toBe(true);
    expect(r.state.homeGold).toBe(5532);
    expect(computeIdleReward(r.state, START + 2 * HOUR).gold).toBe(1828);
  });

  it('ordinary assignment and removal preserve each preceding guardian count', () => {
    const assigned = assignMonsterToRoomSlot(fixture(), 0, 0, 'dokkaebi_warrior', START + HOUR);
    expect(assigned.state.homeGold).toBe(5532);
    const removed = removeMonsterFromRoomSlot(assigned.state, 0, 0, START + 2 * HOUR);
    expect(removed.state.homeGold).toBe(6226); // previous staffed room 594 + treasury 100
    expect(collectIdleIncome(removed.state, START + 3 * HOUR).state.homeGold).toBe(6758);
  });

  it('a type change settles before discarding occupants beyond the new capacity', () => {
    const before = fixture(); before.dungeonSlots[0].monsterIds = ['dokkaebi_warrior', 'village_archer'];
    const owed = computeIdleReward(before, START + HOUR);
    const r = changeRoomSlotType(before, 0, 'trap', START + HOUR);
    expect(r.state.homeGold).toBe(5000 + owed.gold);
    expect(r.state.dungeonSlots[0].monsterIds.filter(Boolean)).toHaveLength(1);
    expect(computeIdleReward(r.state, START + 2 * HOUR).gold).toBeLessThan(owed.gold);
  });

  it('keeps zero-payout fractions across multiple operations at one timestamp', () => {
    const before = fixture();
    const first = assignMonsterToRoomSlot(before, 0, 0, 'dokkaebi_warrior', START + 1000);
    expect(first.state.homeGold).toBe(5000);
    expect(first.state.idleRemainder?.operationGold).toBeCloseTo(0.12);
    const second = upgradeRoomSlot(first.state, 0, START + 1000);
    expect(second.state.homeGold).toBe(4850);
    expect(second.state.idleRemainder).toEqual(first.state.idleRemainder);
    expect(second.state.lastIdleCollect).toBe(START + 1000);
  });

  it('rejects unaffordable upgrades before crediting pending income', () => {
    const before = { ...fixture(), homeGold: 0 };
    const r = upgradeRoomSlot(before, 0, START + HOUR);
    expect(r).toEqual({ ok: false, state: before, reason: 'insufficient_gold' });
    expect(r.state).toBe(before);
  });

  it('caps an old interval once even when several room changes follow', () => {
    const r = changeRoomSlotType(fixture(), 0, 'trap', START + 48 * HOUR);
    expect(r.state.homeGold).toBe(5000 + 532 * 12);
    const next = assignMonsterToRoomSlot(r.state, 0, 0, 'dokkaebi_warrior', START + 48 * HOUR);
    expect(next.state.homeGold).toBe(r.state.homeGold);
  });
});
