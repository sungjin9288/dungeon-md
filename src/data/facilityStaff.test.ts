import { describe, expect, it } from 'vitest';
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
    const r = assignFacilityStaff(state(), 'treasury', 'dokkaebi_warrior');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.facilityStaff).toEqual({ treasury: 'dokkaebi_warrior' });
    expect(r.staffMult).toBe(1.5);
    expect(r.movedFromRoom).toBe(false);
    expect(findStaffedFacility(r.state, 'dokkaebi_warrior')).toBe('treasury');
    expect([...staffedMonsterIds(r.state)]).toEqual(['dokkaebi_warrior']);
  });

  it('refuses unknown, unbuilt, and unowned targets', () => {
    expect(assignFacilityStaff(state(), 'nope', 'dokkaebi_warrior')).toEqual({ ok: false, reason: 'unknown' });
    expect(assignFacilityStaff(state(), 'weavery', 'dokkaebi_warrior')).toEqual({ ok: false, reason: 'not_built' });
    expect(assignFacilityStaff(state(), 'mine', 'ghost')).toEqual({ ok: false, reason: 'not_owned' });
    expect(clearFacilityStaff(state(), 'mine')).toEqual({ ok: false, reason: 'not_staffed' });
  });

  it('a guardian defends or works, never both: a shift pulls it out of its room and vice versa', () => {
    const s = state({ dungeonSlots: [slot(['dokkaebi_warrior', undefined])] });
    const shift = assignFacilityStaff(s, 'mine', 'dokkaebi_warrior');
    expect(shift.ok && shift.movedFromRoom).toBe(true);
    if (!shift.ok) return;
    expect(shift.state.dungeonSlots[0].monsterIds.filter(Boolean)).toEqual([]);

    const back = assignMonsterToRoomSlot(shift.state, 0, 0, 'dokkaebi_warrior');
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.facilityStaff).toEqual({});
    expect(back.state.dungeonSlots[0].monsterIds[0]).toBe('dokkaebi_warrior');
  });

  it('moving between facilities frees the previous one; clearing frees the guardian', () => {
    let s = state();
    const first = assignFacilityStaff(s, 'mine', 'dokkaebi_warrior');
    if (!first.ok) throw new Error('assign');
    const second = assignFacilityStaff(first.state, 'treasury', 'dokkaebi_warrior');
    expect(second.ok && second.movedFromFacility).toBe('mine');
    if (!second.ok) return;
    expect(second.state.facilityStaff).toEqual({ treasury: 'dokkaebi_warrior' });
    const cleared = clearFacilityStaff(second.state, 'treasury');
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
