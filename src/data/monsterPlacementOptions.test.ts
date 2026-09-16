import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import { loadGameState } from './wisdom';
import { getMonsterPlacementOptions } from './monsterPlacementOptions';

function stateWith(ids: string[]) {
  return {
    ...loadGameState(),
    ownedMonsters: ids.map(id => defaultOwnedMonster(id)),
  };
}

describe('getMonsterPlacementOptions', () => {
  it('includes owned evolved IDs and deduplicates an exact registry collision', () => {
    const options = getMonsterPlacementOptions(
      stateWith(['dokkaebi_warrior_leg', 'fox_warrior', 'fox_warrior']),
      'guardian',
      1,
    );
    expect(options.some(option => option.id === 'dokkaebi_warrior_leg')).toBe(true);
    expect(options.filter(option => option.id === 'fox_warrior')).toHaveLength(1);
  });

  it('uses the common hybrid cadence and excludes a canonical collision from the wrong room', () => {
    const options = getMonsterPlacementOptions(
      stateWith(['storm_spirit', 'soul_guardian']),
      'scroll_library',
      1,
    );
    expect(options.find(option => option.id === 'storm_spirit')).toMatchObject({
      attackCooldown: 2000,
      range: 2,
      type: 'magic',
    });
    expect(options.some(option => option.id === 'soul_guardian')).toBe(false);
  });
});
