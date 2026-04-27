import { describe, it, expect } from 'vitest';
import {
  xpToNextLevel,
  addXp,
  getMonsterAtk,
  SKILL_TREES,
  ACTIVE_SKILLS,
  EQUIPMENT_DEFS,
  EQUIPMENT_STATS,
  getEquipmentStats,
  defaultOwnedMonster,
  STARTER_ROSTER,
  type OwnedMonster,
  type SkillNode,
} from './barracks';
import { BLUEPRINT_DEFS } from './fusion';

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

// ─── SKILL_TREES ─────────────────────────────────────────────────────────────

describe('SKILL_TREES — count', () => {
  const entries = Object.entries(SKILL_TREES);

  it('has at least 80 skill trees', () => {
    expect(entries.length).toBeGreaterThanOrEqual(80);
  });

  it('includes custom trees for all 9 Ch1–Ch5 tribe leaders', () => {
    const expected = [
      'dokkaebi_warrior', 'gumiho_guardian', 'white_tiger',
      'death_messenger', 'thunder_hero', 'mask_dancer',
      'celestial_dancer', 'mountain_god', 'sea_god_spear',
    ];
    for (const id of expected) {
      expect(SKILL_TREES[id as keyof typeof SKILL_TREES], `missing tree for ${id}`).toBeDefined();
    }
  });

  it('every key matches its tree.monsterId', () => {
    for (const [key, tree] of entries) {
      expect(tree!.monsterId, `${key} monsterId mismatch`).toBe(key);
    }
  });
});

describe('SKILL_TREES — branch names', () => {
  const entries = Object.entries(SKILL_TREES);

  it('every tree has branchNames with non-empty A, B, C', () => {
    for (const [id, tree] of entries) {
      expect(tree!.branchNames.A.length, `${id} branchNames.A`).toBeGreaterThan(0);
      expect(tree!.branchNames.B.length, `${id} branchNames.B`).toBeGreaterThan(0);
      expect(tree!.branchNames.C.length, `${id} branchNames.C`).toBeGreaterThan(0);
    }
  });

  it('dokkaebi_warrior tree has branch names 전투, 방어, 지원', () => {
    const tree = SKILL_TREES['dokkaebi_warrior']!;
    expect(tree.branchNames.A).toBe('전투');
    expect(tree.branchNames.B).toBe('방어');
    expect(tree.branchNames.C).toBe('지원');
  });
});

describe('SKILL_TREES — node structure', () => {
  const entries = Object.entries(SKILL_TREES);

  it('every tree has at least 9 nodes (3 branches × 3 tiers)', () => {
    for (const [id, tree] of entries) {
      expect(tree!.nodes.length, `${id} node count`).toBeGreaterThanOrEqual(9);
    }
  });

  it('every node has a non-empty id, name, desc, and icon', () => {
    for (const [mId, tree] of entries) {
      for (const node of tree!.nodes) {
        expect(node.id.length,   `${mId}/${node.id} id`).toBeGreaterThan(0);
        expect(node.name.length, `${mId}/${node.id} name`).toBeGreaterThan(0);
        expect(node.desc.length, `${mId}/${node.id} desc`).toBeGreaterThan(0);
        expect(node.icon.length, `${mId}/${node.id} icon`).toBeGreaterThan(0);
      }
    }
  });

  it('every node tier is 1, 2, or 3', () => {
    for (const [mId, tree] of entries) {
      for (const node of tree!.nodes) {
        expect([1, 2, 3], `${mId}/${node.id} tier`).toContain(node.tier);
      }
    }
  });

  it('every node branch is A, B, or C', () => {
    for (const [mId, tree] of entries) {
      for (const node of tree!.nodes) {
        expect(['A', 'B', 'C'], `${mId}/${node.id} branch`).toContain(node.branch);
      }
    }
  });

  it('every node cost is a positive integer', () => {
    for (const [mId, tree] of entries) {
      for (const node of tree!.nodes) {
        expect(node.cost, `${mId}/${node.id} cost`).toBeGreaterThan(0);
        expect(Number.isInteger(node.cost), `${mId}/${node.id} cost integer`).toBe(true);
      }
    }
  });

  it('every requires field references an existing node id in the same tree', () => {
    for (const [mId, tree] of entries) {
      const nodeIds = new Set(tree!.nodes.map((n: SkillNode) => n.id));
      for (const node of tree!.nodes) {
        if (node.requires) {
          expect(
            nodeIds.has(node.requires),
            `${mId}/${node.id} requires "${node.requires}" which does not exist`,
          ).toBe(true);
        }
      }
    }
  });

  it('tier-2 nodes require a tier-1 node (no skipping)', () => {
    for (const [mId, tree] of entries) {
      const nodeMap = new Map(tree!.nodes.map((n: SkillNode) => [n.id, n]));
      for (const node of tree!.nodes) {
        if (node.tier === 2 && node.requires) {
          const prereq = nodeMap.get(node.requires)!;
          expect(prereq?.tier, `${mId}/${node.id} tier-2 prereq tier`).toBe(1);
        }
      }
    }
  });

  it('tier-3 nodes require a tier-2 node (no skipping)', () => {
    for (const [mId, tree] of entries) {
      const nodeMap = new Map(tree!.nodes.map((n: SkillNode) => [n.id, n]));
      for (const node of tree!.nodes) {
        if (node.tier === 3 && node.requires) {
          const prereq = nodeMap.get(node.requires)!;
          expect(prereq?.tier, `${mId}/${node.id} tier-3 prereq tier`).toBe(2);
        }
      }
    }
  });
});

describe('SKILL_TREES — dokkaebi_warrior spot-check', () => {
  const tree = SKILL_TREES['dokkaebi_warrior']!;

  it('A1 node is 강타 with ATK +15%', () => {
    const a1 = tree.nodes.find(n => n.id === 'A1')!;
    expect(a1).toBeDefined();
    expect(a1.name).toBe('강타');
    expect(a1.desc).toContain('ATK +15%');
  });

  it('A2 requires A1', () => {
    const a2 = tree.nodes.find(n => n.id === 'A2')!;
    expect(a2.requires).toBe('A1');
  });

  it('A3 requires A2', () => {
    const a3 = tree.nodes.find(n => n.id === 'A3')!;
    expect(a3.requires).toBe('A2');
  });
});

// ─── EQUIPMENT_STATS — data integrity ─────────────────────────────────────────

describe('EQUIPMENT_STATS — structure', () => {
  it('contains at least 23 entries (10 base + 13 original crafted)', () => {
    expect(Object.keys(EQUIPMENT_STATS).length).toBeGreaterThanOrEqual(23);
  });

  it('every entry has at least one defined stat field', () => {
    for (const [id, stats] of Object.entries(EQUIPMENT_STATS)) {
      expect(
        Object.keys(stats).length,
        `EQUIPMENT_STATS["${id}"] has no stat fields`,
      ).toBeGreaterThan(0);
    }
  });

  it('all atkMult values are between -0.20 and 0.90 (penalties allowed)', () => {
    for (const [id, stats] of Object.entries(EQUIPMENT_STATS)) {
      if (stats.atkMult !== undefined) {
        expect(stats.atkMult, `${id} atkMult`).toBeGreaterThanOrEqual(-0.20);
        expect(stats.atkMult, `${id} atkMult`).toBeLessThanOrEqual(0.90);
      }
    }
  });

  it('all roomHpBonus values are positive integers', () => {
    for (const [id, stats] of Object.entries(EQUIPMENT_STATS)) {
      if (stats.roomHpBonus !== undefined) {
        expect(stats.roomHpBonus, `${id} roomHpBonus`).toBeGreaterThan(0);
        expect(Number.isInteger(stats.roomHpBonus), `${id} roomHpBonus integer`).toBe(true);
      }
    }
  });

  it('all skillCdMult values are between 0.70 and 0.95', () => {
    for (const [id, stats] of Object.entries(EQUIPMENT_STATS)) {
      if (stats.skillCdMult !== undefined) {
        expect(stats.skillCdMult, `${id} skillCdMult`).toBeGreaterThanOrEqual(0.70);
        expect(stats.skillCdMult, `${id} skillCdMult`).toBeLessThanOrEqual(0.95);
      }
    }
  });
});

describe('EQUIPMENT_STATS × BLUEPRINT_DEFS — cross-reference', () => {
  it('every BLUEPRINT_DEFS resultId exists in EQUIPMENT_STATS', () => {
    for (const [bpId, def] of Object.entries(BLUEPRINT_DEFS)) {
      expect(
        EQUIPMENT_STATS[def.resultId],
        `Blueprint "${bpId}" resultId "${def.resultId}" not found in EQUIPMENT_STATS`,
      ).toBeDefined();
    }
  });

  it('crafted items (eq_*) in EQUIPMENT_STATS all have a blueprint', () => {
    const blueprintResultIds = new Set(Object.values(BLUEPRINT_DEFS).map(d => d.resultId));
    for (const id of Object.keys(EQUIPMENT_STATS)) {
      if (id.startsWith('eq_')) {
        expect(blueprintResultIds.has(id), `EQUIPMENT_STATS key "${id}" has no blueprint`).toBe(true);
      }
    }
  });
});

describe('EQUIPMENT_STATS — spot-checks for Ch7/Ch8 items', () => {
  it('eq_void_blade has atkMult 0.60 and skillCdMult 0.75', () => {
    expect(EQUIPMENT_STATS['eq_void_blade']?.atkMult).toBeCloseTo(0.60);
    expect(EQUIPMENT_STATS['eq_void_blade']?.skillCdMult).toBeCloseTo(0.75);
  });

  it('eq_abyss_mail has roomHpBonus 800', () => {
    expect(EQUIPMENT_STATS['eq_abyss_mail']?.roomHpBonus).toBe(800);
  });

  it('eq_primordial_gem has atkMult 0.80 and crystalMult 0.30', () => {
    expect(EQUIPMENT_STATS['eq_primordial_gem']?.atkMult).toBeCloseTo(0.80);
    expect(EQUIPMENT_STATS['eq_primordial_gem']?.crystalMult).toBeCloseTo(0.30);
  });

  it('eq_divine_aegis has roomHpBonus 500', () => {
    expect(EQUIPMENT_STATS['eq_divine_aegis']?.roomHpBonus).toBe(500);
  });
});
