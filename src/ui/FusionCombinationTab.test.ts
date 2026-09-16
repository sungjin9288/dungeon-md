import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from '../data/barracks';
import { reconcileCombinationSlots } from './FusionSelectionState';

describe('reconcileCombinationSlots', () => {
  it('keeps selected sources while both ids remain owned', () => {
    const slotA = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 5 };
    const slotB = { ...defaultOwnedMonster('gumiho_guardian'), level: 8 };

    const result = reconcileCombinationSlots([slotA, slotB], [slotA, slotB]);

    expect(result[0]).toBe(slotA);
    expect(result[1]).toBe(slotB);
  });

  it('clears a source consumed by another ritual', () => {
    const stale = defaultOwnedMonster('dokkaebi_warrior');
    const retained = defaultOwnedMonster('gumiho_guardian');

    expect(reconcileCombinationSlots([stale, retained], [retained])).toEqual([null, retained]);
  });

  it('does not let one owned copy satisfy two retained slots', () => {
    const selected = defaultOwnedMonster('dokkaebi_warrior');
    const onlyOwnedCopy = defaultOwnedMonster('dokkaebi_warrior');

    expect(reconcileCombinationSlots([selected, selected], [onlyOwnedCopy])).toEqual([
      selected,
      null,
    ]);
  });

  it('rebinds a stale level selection to the remaining live copy', () => {
    const stale = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 10 };
    const live = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 1 };

    const result = reconcileCombinationSlots([stale, null], [live]);

    expect(result[0]).toBe(live);
    expect(result[0]?.level).toBe(1);
  });
});
