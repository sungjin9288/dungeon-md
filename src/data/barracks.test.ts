import { describe, it, expect } from 'vitest';
import {
  xpToNextLevel,
  addXp,
  getMonsterAtk,
  ACTIVE_SKILLS,
  EQUIPMENT_DEFS,
  getEquipmentStats,
  defaultOwnedMonster,
  STARTER_ROSTER,
  type OwnedMonster,
} from './barracks';

// ─── xpToNextLevel ────────────────────────────────────────────────────────────

describe('xpToNextLevel', () => {
  it('returns 100 at level 1', () => {
    expect(xpToNextLevel(1)).toBe(100);
  });

  it('increases monotonically as level rises', () => {
    for (let lv = 1; lv < 50; lv++) {
      expect(xpToNextLevel(lv + 1)).toBeGreaterThan(xpToNextLevel(lv));
    }
  });

  it('is always a positive integer', () => {
    for (let lv = 1; lv <= 50; lv++) {
      const xp = xpToNextLevel(lv);
      expect(xp).toBeGreaterThan(0);
      expect(Number.isInteger(xp)).toBe(true);
    }
  });

  it('roughly follows 1.18× growth rate (level 5 ≈ 195)', () => {
    // 100 * 1.18^4 ≈ 193.9 → rounded to 194
    expect(xpToNextLevel(5)).toBeGreaterThan(150);
    expect(xpToNextLevel(5)).toBeLessThan(250);
  });
});

// ─── addXp ────────────────────────────────────────────────────────────────────

describe('addXp', () => {
  function makeMon(level = 1, xp = 0): OwnedMonster {
    return { ...defaultOwnedMonster('dokkaebi_warrior'), level, xp };
  }

  it('does not level up when XP is below threshold', () => {
    const mon = makeMon(1, 0);
    const result = addXp(mon, 50);
    expect(result.levelled).toBe(false);
    expect(mon.level).toBe(1);
    expect(mon.xp).toBe(50);
  });

  it('levels up when XP meets threshold', () => {
    const mon = makeMon(1, 0);
    const result = addXp(mon, 100); // xpToNextLevel(1) = 100
    expect(result.levelled).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(mon.level).toBe(2);
  });

  it('carries over excess XP after level-up', () => {
    const mon = makeMon(1, 0);
    addXp(mon, 150); // 100 to level, 50 leftover
    expect(mon.xp).toBe(50);
  });

  it('can level up multiple times in a single call', () => {
    const mon = makeMon(1, 0);
    addXp(mon, 9999);
    expect(mon.level).toBeGreaterThan(2);
  });

  it('caps level at 50 and zeroes XP at cap', () => {
    const mon = makeMon(49, 0);
    addXp(mon, 999999);
    expect(mon.level).toBe(50);
    expect(mon.xp).toBe(0);
  });

  it('grants 1 skill point every 5 levels', () => {
    const mon = makeMon(4, 0);
    const spBefore = mon.skillPoints;
    addXp(mon, 999999); // push past level 5
    expect(mon.skillPoints).toBeGreaterThan(spBefore);
  });
});

// ─── getMonsterAtk ────────────────────────────────────────────────────────────

describe('getMonsterAtk', () => {
  it('returns baseAtk at level 1 with no skills', () => {
    expect(getMonsterAtk(100, 1, {})).toBe(100);
  });

  it('scales up with level (Lv.10 > Lv.1)', () => {
    expect(getMonsterAtk(100, 10, {})).toBeGreaterThan(100);
  });

  it('applies A1 강타 +15% when spentSkills.A1 >= 1', () => {
    const base  = getMonsterAtk(100, 1, {});
    const withA1 = getMonsterAtk(100, 1, { A1: 1 });
    expect(withA1).toBeCloseTo(base * 1.15, 0);
  });

  it('does not apply A1 bonus when A1 = 0', () => {
    const base = getMonsterAtk(100, 1, {});
    const noA1 = getMonsterAtk(100, 1, { A1: 0 });
    expect(noA1).toBe(base);
  });

  it('returns a rounded integer', () => {
    const atk = getMonsterAtk(77, 7, { A1: 1 });
    expect(Number.isInteger(atk)).toBe(true);
  });

  it('increases consistently across consecutive levels', () => {
    for (let lv = 1; lv < 10; lv++) {
      expect(getMonsterAtk(100, lv + 1, {})).toBeGreaterThanOrEqual(
        getMonsterAtk(100, lv, {}),
      );
    }
  });
});

// ─── ACTIVE_SKILLS data integrity ─────────────────────────────────────────────

describe('ACTIVE_SKILLS', () => {
  it('contains exactly 15 skills', () => {
    expect(ACTIVE_SKILLS).toHaveLength(15);
  });

  it('has unique ids', () => {
    const ids = ACTIVE_SKILLS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every skill has a non-empty name, icon, and desc', () => {
    for (const sk of ACTIVE_SKILLS) {
      expect(sk.name.length,  `${sk.id} name`).toBeGreaterThan(0);
      expect(sk.icon.length,  `${sk.id} icon`).toBeGreaterThan(0);
      expect(sk.desc.length,  `${sk.id} desc`).toBeGreaterThan(0);
    }
  });

  it('every category is combat, defense, or support', () => {
    const valid = new Set(['combat', 'defense', 'support']);
    for (const sk of ACTIVE_SKILLS) {
      expect(valid.has(sk.category), `${sk.id} category`).toBe(true);
    }
  });

  it('every cooldown is a positive number', () => {
    for (const sk of ACTIVE_SKILLS) {
      expect(sk.cooldown, `${sk.id} cooldown`).toBeGreaterThan(0);
    }
  });

  it('every goldCost and gemCost are non-negative', () => {
    for (const sk of ACTIVE_SKILLS) {
      expect(sk.goldCost, `${sk.id} goldCost`).toBeGreaterThanOrEqual(0);
      expect(sk.gemCost,  `${sk.id} gemCost`).toBeGreaterThanOrEqual(0);
    }
  });

  it('all 3 categories are represented', () => {
    const cats = new Set(ACTIVE_SKILLS.map(s => s.category));
    expect(cats.has('combat')).toBe(true);
    expect(cats.has('defense')).toBe(true);
    expect(cats.has('support')).toBe(true);
  });
});

// ─── EQUIPMENT_DEFS data integrity ───────────────────────────────────────────

describe('EQUIPMENT_DEFS', () => {
  it('has unique ids', () => {
    const ids = EQUIPMENT_DEFS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every equipment has a non-empty name, icon, and desc', () => {
    for (const eq of EQUIPMENT_DEFS) {
      expect(eq.name.length, `${eq.id} name`).toBeGreaterThan(0);
      expect(eq.icon.length, `${eq.id} icon`).toBeGreaterThan(0);
      expect(eq.desc.length, `${eq.id} desc`).toBeGreaterThan(0);
    }
  });

  it('every type is weapon, armor, or accessory', () => {
    const valid = new Set(['weapon', 'armor', 'accessory']);
    for (const eq of EQUIPMENT_DEFS) {
      expect(valid.has(eq.type), `${eq.id} type`).toBe(true);
    }
  });

  it('every goldCost and gemCost are non-negative', () => {
    for (const eq of EQUIPMENT_DEFS) {
      expect(eq.goldCost, `${eq.id} goldCost`).toBeGreaterThanOrEqual(0);
      expect(eq.gemCost,  `${eq.id} gemCost`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── getEquipmentStats ────────────────────────────────────────────────────────

describe('getEquipmentStats', () => {
  it('returns empty object for null', () => {
    expect(getEquipmentStats(null)).toEqual({});
  });

  it('returns empty object for unknown id', () => {
    expect(getEquipmentStats('does_not_exist')).toEqual({});
  });

  it('returns correct stats for dokkaebi_club', () => {
    const stats = getEquipmentStats('dokkaebi_club');
    expect(stats.atkMult).toBeCloseTo(0.20);
    expect(stats.stunBonus).toBe(500);
  });

  it('returns correct stats for dragon_claw', () => {
    const stats = getEquipmentStats('dragon_claw');
    expect(stats.atkMult).toBeCloseTo(0.35);
    expect(stats.executeChance).toBeCloseTo(0.10);
  });

  it('returns correct stats for soul_robe (skillCdMult)', () => {
    const stats = getEquipmentStats('soul_robe');
    expect(stats.skillCdMult).toBeCloseTo(0.80);
  });

  it('returns correct stats for golden_armor (roomHpBonus + goldMult)', () => {
    const stats = getEquipmentStats('golden_armor');
    expect(stats.roomHpBonus).toBe(100);
    expect(stats.goldMult).toBeCloseTo(0.10);
  });
});

// ─── defaultOwnedMonster ──────────────────────────────────────────────────────

describe('defaultOwnedMonster', () => {
  it('creates a monster at level 1 with 0 XP', () => {
    const mon = defaultOwnedMonster('dokkaebi_warrior');
    expect(mon.level).toBe(1);
    expect(mon.xp).toBe(0);
  });

  it('sets the id to the provided monsterId', () => {
    const mon = defaultOwnedMonster('gumiho_guardian');
    expect(mon.id).toBe('gumiho_guardian');
  });

  it('initialises spentSkills as empty object', () => {
    const mon = defaultOwnedMonster('dokkaebi_warrior');
    expect(mon.spentSkills).toEqual({});
  });

  it('initialises equippedSkills as empty array', () => {
    const mon = defaultOwnedMonster('dokkaebi_warrior');
    expect(Array.isArray(mon.equippedSkills)).toBe(true);
    expect(mon.equippedSkills).toHaveLength(0);
  });
});

// ─── STARTER_ROSTER ───────────────────────────────────────────────────────────

describe('STARTER_ROSTER', () => {
  it('contains at least one starter monster', () => {
    expect(STARTER_ROSTER.length).toBeGreaterThanOrEqual(1);
  });

  it('contains dokkaebi_warrior', () => {
    expect(STARTER_ROSTER).toContain('dokkaebi_warrior');
  });
});
