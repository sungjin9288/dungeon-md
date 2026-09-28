import { describe, it, expect } from 'vitest';
import {
  AWAKENED_ATK_MULT,
  EQUIPMENT_STATS,
  defaultOwnedMonster,
  getOwnedMonsterAtk,
  getOwnedMonsterBattleAtk,
} from './barracks';

// The header ATK ignored the equipped item, so 장착 never moved it (§33).
describe('getOwnedMonsterBattleAtk', () => {
  const base = { ...defaultOwnedMonster('dokkaebi_warrior'), level: 10 };

  it('matches raising-only ATK when nothing is equipped', () => {
    const bare = { ...base, equipment: null };
    expect(getOwnedMonsterBattleAtk(40, bare)).toBe(getOwnedMonsterAtk(40, bare));
  });

  it('applies the equipped atkMult that combat multiplies into each hit', () => {
    const armed = { ...base, equipment: 'dokkaebi_club' };
    const raw = getOwnedMonsterAtk(40, armed);
    expect(EQUIPMENT_STATS.dokkaebi_club.atkMult).toBe(0.2);
    expect(getOwnedMonsterBattleAtk(40, armed)).toBe(Math.round(raw * 1.2));
    expect(getOwnedMonsterBattleAtk(40, armed)).toBeGreaterThan(raw);
  });

  it('keeps a negative atkMult item (stone_shell) as a reduction', () => {
    const shelled = { ...base, equipment: 'stone_shell' };
    expect(getOwnedMonsterBattleAtk(40, shelled)).toBe(Math.round(getOwnedMonsterAtk(40, shelled) * 0.9));
  });

  it('carries raising channels (awakening) through', () => {
    const bare = { ...base, equipment: null };
    const awake = getOwnedMonsterBattleAtk(40, bare, { monsterAwakened: { dokkaebi_warrior: true } });
    expect(awake).toBe(getOwnedMonsterAtk(40, bare, { monsterAwakened: { dokkaebi_warrior: true } }));
    expect(awake).toBeGreaterThanOrEqual(Math.floor(getOwnedMonsterAtk(40, bare) * AWAKENED_ATK_MULT));
  });
});
