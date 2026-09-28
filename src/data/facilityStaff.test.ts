import { describe, expect, it } from 'vitest';
import { computeIdleReward, dungeonGoldPerMin } from './idleIncome';
import { FACILITY_ORDER } from './production';
import { decorationsInSet } from './decorations';
import { assignFacilityStaff, clearFacilityStaff, findStaffedFacility, staffedMonsterIds } from './productionTransactions';
import { assignMonsterToRoomSlot } from './roomSlotTransactions';
import { getTrapLoadoutRecommendation, getMonsterLoadoutRecommendation } from './roomLoadoutRecommendations';
import { loadGameState, type DungeonSlot, type GameState, type OwnedMonster } from './wisdom';

function owned(id: string): OwnedMonster {
  return { ...(loadGameState().ownedMonsters[0] ?? { id, level: 1, exp: 0 }), id } as OwnedMonster;
}
function slot(monsterIds: (string | undefined)[]): DungeonSlot {
  return { roomType: 'combat', building: 'guardian', monsterIds, trapIds: [undefined], roomLevel: 1, hp: 200, maxHp: 200 };
}
function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(), dmLevel: 10,
    ownedMonsters: [owned('dokkaebi_warrior'), owned('village_archer')],
    productionFacilities: { mine: 1, treasury: 1 },
    ...overrides,
  };
}

describe('facility staffing transactions', () => {
  it('puts an owned guardian on shift at a built facility and reports the multiplier', () => {
    const r = assignFacilityStaff(state(), 'treasury', 'dokkaebi_warrior', 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.facilityStaff).toEqual({ treasury: 'dokkaebi_warrior' });
    expect(r.staffMult).toBe(1.5);
    expect(r.movedFromRoom).toBe(false);
    expect(findStaffedFacility(r.state, 'dokkaebi_warrior')).toBe('treasury');
    expect([...staffedMonsterIds(r.state)]).toEqual(['dokkaebi_warrior']);
  });

  it('refuses unknown, unbuilt, and unowned targets', () => {
    expect(assignFacilityStaff(state(), 'nope', 'dokkaebi_warrior', 1000)).toEqual({ ok: false, reason: 'unknown' });
    expect(assignFacilityStaff(state(), 'weavery', 'dokkaebi_warrior', 1000)).toEqual({ ok: false, reason: 'not_built' });
    expect(assignFacilityStaff(state(), 'mine', 'ghost', 1000)).toEqual({ ok: false, reason: 'not_owned' });
    expect(clearFacilityStaff(state(), 'mine', 1000)).toEqual({ ok: false, reason: 'not_staffed' });
  });

  it('a guardian defends or works, never both: a shift pulls it out of its room and vice versa', () => {
    const s = state({ dungeonSlots: [slot(['dokkaebi_warrior', undefined])] });
    const shift = assignFacilityStaff(s, 'mine', 'dokkaebi_warrior', 1000);
    expect(shift.ok && shift.movedFromRoom).toBe(true);
    if (!shift.ok) return;
    expect(shift.state.dungeonSlots[0].monsterIds.filter(Boolean)).toEqual([]);

    const back = assignMonsterToRoomSlot(shift.state, 0, 0, 'dokkaebi_warrior', 1000);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.facilityStaff).toEqual({});
    expect(back.state.dungeonSlots[0].monsterIds[0]).toBe('dokkaebi_warrior');
  });

  it('moving between facilities frees the previous one; clearing frees the guardian', () => {
    let s = state();
    const first = assignFacilityStaff(s, 'mine', 'dokkaebi_warrior', 1000);
    if (!first.ok) throw new Error('assign');
    const second = assignFacilityStaff(first.state, 'treasury', 'dokkaebi_warrior', 1000);
    expect(second.ok && second.movedFromFacility).toBe('mine');
    if (!second.ok) return;
    expect(second.state.facilityStaff).toEqual({ treasury: 'dokkaebi_warrior' });
    const cleared = clearFacilityStaff(second.state, 'treasury', 1000);
    expect(cleared.ok && cleared.state.facilityStaff).toEqual({});
    s = second.state;
    expect(s.facilityStaff.treasury).toBe('dokkaebi_warrior'); // inputs untouched
  });

  it('room recommendations skip guardians on shift', () => {
    const s = state({ dungeonSlots: [slot([undefined, undefined])], facilityStaff: { mine: 'dokkaebi_warrior', treasury: 'village_archer' } });
    expect(getMonsterLoadoutRecommendation(s, 0)).toBeNull();
    expect(getTrapLoadoutRecommendation(s, 0)).not.toBeNull();
  });
});

// Exercise the assignment transaction: a helper-only test misses the lost room occupant.
describe('staffing preserves a working guardian operating contribution', () => {
  for (const dmLevel of [1, 12, 30, 100]) {
    for (const facilityId of FACILITY_ORDER) {
      it(`DM${dmLevel} ${facilityId}: work does not forfeit operation gold`, () => {
        const before = state({
          dmLevel, notorietyTier: 10, wisdomTree: { goldHands: 5 },
          placedDecorations: [...decorationsInSet('bounty'), ...decorationsInSet('abyssal')],
          dungeonSlots: [slot(['dokkaebi_warrior'])],
          productionFacilities: { [facilityId]: 5 }, facilityStaff: {}, lastIdleCollect: 1000,
        });
        const assigned = assignFacilityStaff(before, facilityId, 'dokkaebi_warrior', 1000);
        if (!assigned.ok) throw new Error('assignment failed');
        expect(assigned.state.dungeonSlots[0].monsterIds.filter(Boolean)).toEqual([]);
        expect(dungeonGoldPerMin(assigned.state)).toBeCloseTo(dungeonGoldPerMin(before));
        const now = 1000 + 12 * 3_600_000;
        const baseline = computeIdleReward(before, now);
        const working = computeIdleReward(assigned.state, now);
        expect(working.gold).toBeGreaterThanOrEqual(baseline.gold);
        if (facilityId === 'treasury') expect(working.gold).toBeGreaterThan(baseline.gold);
        else expect(Object.values(working.materials)[0]).toBeGreaterThan(Object.values(baseline.materials)[0]);
        const cleared = clearFacilityStaff(assigned.state, facilityId, 1000);
        if (!cleared.ok) throw new Error('clear failed');
        expect(dungeonGoldPerMin(cleared.state)).toBeLessThan(dungeonGoldPerMin(assigned.state));
      });
    }
  }
});
