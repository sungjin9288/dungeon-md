import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import { groupOwnedCopies } from './ownedCopies';

describe('groupOwnedCopies', () => {
  it('one entry per kind, the first copy represents it, copies counted', () => {
    const trained = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 9 };
    const owned = [trained, defaultOwnedMonster('village_archer'), defaultOwnedMonster('dokkaebi_warrior'), defaultOwnedMonster('dokkaebi_warrior')];
    const groups = groupOwnedCopies(owned);
    expect(groups.map(g => [g.monster.id, g.copies])).toEqual([['dokkaebi_warrior', 3], ['village_archer', 1]]);
    expect(groups[0].monster).toBe(trained);
  });
});
