import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_DEFS,
  EPILOGUE_ACHIEVEMENT_DEFS,
  getAchievementDef,
  checkAchievements,
  type AchievementContext,
  type AchievementCategory,
} from './achievements';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES: Set<AchievementCategory> = new Set([
  'combat', 'economy', 'build', 'endless', 'mastery', 'collection', 'growth',
]);

/** Minimal context with every field at zero / empty */
const emptyCtx: AchievementContext = {
  totalKills:        0,
  totalGoldEarned:   0,
  roomsBuilt:        [],
  bossesKilled:      [],
  endlessHighScore:  0,
  consecutiveDays:   0,
  soulCrystals:      0,
  wisdomTree:        {},
  stageProgress:     [],
  dmLevel:           1,
  ownedMonsterCount: 0,
  ownedSkinCount:    0,
  totalFusions:      0,
  completedTribes:   0,
  totalSummons:      0,
  questSkinsOwned:   0,
};

function makeCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return { ...emptyCtx, ...overrides };
}

// ─── ACHIEVEMENT_DEFS data integrity ─────────────────────────────────────────

describe('ACHIEVEMENT_DEFS', () => {
  it('contains exactly 70 achievements', () => {
    expect(ACHIEVEMENT_DEFS).toHaveLength(70);
  });

  it('has unique ids', () => {
    const ids = ACHIEVEMENT_DEFS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every achievement has a non-empty name, description, and icon', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      expect(a.name.length,        `${a.id} name`).toBeGreaterThan(0);
      expect(a.description.length, `${a.id} description`).toBeGreaterThan(0);
      expect(a.icon.length,        `${a.id} icon`).toBeGreaterThan(0);
    }
  });

  it('every category is one of the 7 valid values', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      expect(
        VALID_CATEGORIES.has(a.category),
        `${a.id} category "${a.category}"`,
      ).toBe(true);
    }
  });

  it('every target is a positive number', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      expect(a.target, `${a.id} target`).toBeGreaterThan(0);
    }
  });

  it('every reward has at least one non-zero field', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      const { gems, soulCrystals } = a.reward;
      const hasReward = (gems !== undefined && gems > 0) ||
                        (soulCrystals !== undefined && soulCrystals > 0);
      expect(hasReward, `${a.id} reward`).toBe(true);
    }
  });

  it('getProgress returns a number for every def on empty context', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      const val = a.getProgress(emptyCtx);
      expect(typeof val, `${a.id} getProgress type`).toBe('number');
      expect(isNaN(val), `${a.id} getProgress NaN`).toBe(false);
    }
  });

  it('getProgress never returns a negative value', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      expect(a.getProgress(emptyCtx), `${a.id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('all 7 categories are used at least once', () => {
    const used = new Set(ACHIEVEMENT_DEFS.map(a => a.category));
    for (const cat of VALID_CATEGORIES) {
      expect(used.has(cat), `category "${cat}" is used`).toBe(true);
    }
  });
});

// ─── getAchievementDef ────────────────────────────────────────────────────────

describe('getAchievementDef', () => {
  it('returns the correct def for a known id', () => {
    const def = getAchievementDef('first_blood');
    expect(def).toBeDefined();
    expect(def!.id).toBe('first_blood');
    expect(def!.category).toBe('combat');
  });

  it('returns undefined for an unknown id', () => {
    expect(getAchievementDef('does_not_exist')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getAchievementDef('')).toBeUndefined();
  });

  it('finds every id in ACHIEVEMENT_DEFS', () => {
    for (const a of ACHIEVEMENT_DEFS) {
      expect(getAchievementDef(a.id)).toBe(a);
    }
  });
});

// ─── checkAchievements ────────────────────────────────────────────────────────

describe('checkAchievements', () => {
  it('returns empty array when nothing is unlockable', () => {
    const result = checkAchievements(emptyCtx, {});
    expect(result).toEqual([]);
  });

  it('returns the id when progress reaches target', () => {
    const ctx    = makeCtx({ totalKills: 1 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('first_blood');
  });

  it('does not return an id when progress is below target', () => {
    const ctx    = makeCtx({ totalKills: 99 });
    const result = checkAchievements(ctx, {});
    expect(result).not.toContain('slayer_100');
  });

  it('returns the id when progress exactly equals target', () => {
    const ctx    = makeCtx({ totalKills: 100 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('slayer_100');
  });

  it('returns the id when progress exceeds target', () => {
    const ctx    = makeCtx({ totalKills: 9999 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('slayer_1000');
  });

  it('skips ids that are already unlocked', () => {
    const ctx    = makeCtx({ totalKills: 9999 });
    const result = checkAchievements(ctx, { first_blood: { unlocked: true } });
    expect(result).not.toContain('first_blood');
  });

  it('returns multiple ids in a single call', () => {
    // 9999 kills → first_blood, slayer_100, slayer_500, slayer_1000 all unlock
    const ctx    = makeCtx({ totalKills: 9999 });
    const result = checkAchievements(ctx, {});
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result).toContain('first_blood');
    expect(result).toContain('slayer_100');
    expect(result).toContain('slayer_500');
    expect(result).toContain('slayer_1000');
  });

  it('returned ids are all valid achievement ids (base + epilogue)', () => {
    const allIds = new Set([
      ...ACHIEVEMENT_DEFS.map(a => a.id),
      ...EPILOGUE_ACHIEVEMENT_DEFS.map(a => a.id),
    ]);
    const ctx    = makeCtx({ totalKills: 9999, totalGoldEarned: 9999 });
    const result = checkAchievements(ctx, {});
    for (const id of result) {
      expect(allIds.has(id), `returned id "${id}" must be valid`).toBe(true);
    }
  });
});

// ─── getProgress spot-checks ──────────────────────────────────────────────────

describe('getProgress — combat', () => {
  it('first_blood: 0 before first kill', () => {
    const def = getAchievementDef('first_blood')!;
    expect(def.getProgress(makeCtx({ totalKills: 0 }))).toBe(0);
  });

  it('first_blood: 1 after first kill', () => {
    const def = getAchievementDef('first_blood')!;
    expect(def.getProgress(makeCtx({ totalKills: 1 }))).toBe(1);
  });

  it('kill_all_types: counts unique types in bossesKilled', () => {
    const def = getAchievementDef('kill_all_types')!;
    const ctx = makeCtx({ bossesKilled: ['knight', 'shaman', 'void', 'knight', 'undying'] });
    // 4 unique types
    expect(def.getProgress(ctx)).toBe(4);
  });
});

describe('getProgress — economy', () => {
  it('gold_100: reports totalGoldEarned', () => {
    const def = getAchievementDef('gold_100')!;
    expect(def.getProgress(makeCtx({ totalGoldEarned: 50 }))).toBe(50);
    expect(def.getProgress(makeCtx({ totalGoldEarned: 150 }))).toBe(150);
  });

  it('crystal_10: reports soulCrystals', () => {
    const def = getAchievementDef('crystal_10')!;
    expect(def.getProgress(makeCtx({ soulCrystals: 5 }))).toBe(5);
    expect(def.getProgress(makeCtx({ soulCrystals: 25 }))).toBe(25);
  });
});

describe('getProgress — endless', () => {
  it('endless_first: 0 when endlessHighScore is 0', () => {
    const def = getAchievementDef('endless_first')!;
    expect(def.getProgress(makeCtx({ endlessHighScore: 0 }))).toBe(0);
  });

  it('endless_first: 1 once any score is recorded', () => {
    const def = getAchievementDef('endless_first')!;
    expect(def.getProgress(makeCtx({ endlessHighScore: 1 }))).toBe(1);
  });

  it('endless_wave10: clamps at 10', () => {
    const def = getAchievementDef('endless_wave10')!;
    expect(def.getProgress(makeCtx({ endlessHighScore: 99 }))).toBe(10);
    expect(def.getProgress(makeCtx({ endlessHighScore: 5 }))).toBe(5);
  });
});

describe('getProgress — mastery', () => {
  it('streak_7: clamps at 7', () => {
    const def = getAchievementDef('streak_7')!;
    expect(def.getProgress(makeCtx({ consecutiveDays: 30 }))).toBe(7);
    expect(def.getProgress(makeCtx({ consecutiveDays: 4 }))).toBe(4);
  });

  it('all_wisdom: counts wisdomTree entries >= 1', () => {
    const def = getAchievementDef('all_wisdom')!;
    const tree = { a: 2, b: 0, c: 1, d: 3, e: 1 }; // 4 entries >= 1
    expect(def.getProgress(makeCtx({ wisdomTree: tree }))).toBe(4);
  });

  it('all_wisdom: requires 12 branches for target', () => {
    const def = getAchievementDef('all_wisdom')!;
    expect(def.target).toBe(12);
    const tree12: Record<string, number> = {};
    for (let i = 0; i < 12; i++) tree12[`branch_${i}`] = 1;
    expect(def.getProgress(makeCtx({ wisdomTree: tree12 }))).toBe(12);
  });

  it('wisdom_ch8: 0 when neither branch is unlocked', () => {
    const def = getAchievementDef('wisdom_ch8')!;
    expect(def.getProgress(makeCtx({ wisdomTree: {} }))).toBe(0);
  });

  it('wisdom_ch8: 0 when only soulHarvest is unlocked', () => {
    const def = getAchievementDef('wisdom_ch8')!;
    expect(def.getProgress(makeCtx({ wisdomTree: { soulHarvest: 1 } }))).toBe(0);
  });

  it('wisdom_ch8: 1 when both soulHarvest and forgeEnhancer are >= 1', () => {
    const def = getAchievementDef('wisdom_ch8')!;
    expect(
      def.getProgress(makeCtx({ wisdomTree: { soulHarvest: 2, forgeEnhancer: 1 } })),
    ).toBe(1);
  });

  it('wisdom_master: sums all wisdom tree values', () => {
    const def = getAchievementDef('wisdom_master')!;
    const tree = { a: 5, b: 3, c: 7, d: 10 }; // sum = 25
    expect(def.getProgress(makeCtx({ wisdomTree: tree }))).toBe(25);
  });

  it('wisdom_master: 0 on empty tree', () => {
    const def = getAchievementDef('wisdom_master')!;
    expect(def.getProgress(emptyCtx)).toBe(0);
  });
});

describe('getProgress — build', () => {
  it('all_3star: counts stageProgress entries with bestStars === 3', () => {
    const def  = getAchievementDef('all_3star')!;
    const stages = [
      { unlocked: true, bestStars: 3 },
      { unlocked: true, bestStars: 2 },
      { unlocked: true, bestStars: 3 },
      { unlocked: false, bestStars: 0 },
    ];
    expect(def.getProgress(makeCtx({ stageProgress: stages }))).toBe(2);
  });

  it('all_3star: requires 80 for target', () => {
    const def = getAchievementDef('all_3star')!;
    expect(def.target).toBe(80);
  });
});

describe('getProgress — collection', () => {
  it('codex_10: reports ownedMonsterCount', () => {
    const def = getAchievementDef('codex_10')!;
    expect(def.getProgress(makeCtx({ ownedMonsterCount: 7 }))).toBe(7);
    expect(def.getProgress(makeCtx({ ownedMonsterCount: 12 }))).toBe(12);
  });

  it('skin_first: 1 when at least 1 skin is owned', () => {
    const def = getAchievementDef('skin_first')!;
    expect(def.getProgress(makeCtx({ ownedSkinCount: 0 }))).toBe(0);
    expect(def.getProgress(makeCtx({ ownedSkinCount: 1 }))).toBe(1);
  });
});

describe('getProgress — growth', () => {
  it('quest_skin_first: 0 before any quest skin, 1 after', () => {
    const def = getAchievementDef('quest_skin_first')!;
    expect(def.getProgress(makeCtx({ questSkinsOwned: 0 }))).toBe(0);
    expect(def.getProgress(makeCtx({ questSkinsOwned: 1 }))).toBe(1);
    // clamps at 1
    expect(def.getProgress(makeCtx({ questSkinsOwned: 5 }))).toBe(1);
  });

  it('quest_skin_collector: counts questSkinsOwned up to target (3)', () => {
    const def = getAchievementDef('quest_skin_collector')!;
    expect(def.target).toBe(3);
    expect(def.getProgress(makeCtx({ questSkinsOwned: 2 }))).toBe(2);
    expect(def.getProgress(makeCtx({ questSkinsOwned: 3 }))).toBe(3);
  });
});

// ─── EPILOGUE_ACHIEVEMENT_DEFS data integrity ─────────────────────────────────

describe('EPILOGUE_ACHIEVEMENT_DEFS', () => {
  it('contains exactly 5 epilogue achievements', () => {
    expect(EPILOGUE_ACHIEVEMENT_DEFS).toHaveLength(5);
  });

  it('has unique ids (no overlap with base defs)', () => {
    const baseIds    = new Set(ACHIEVEMENT_DEFS.map(a => a.id));
    const epilogueIds = EPILOGUE_ACHIEVEMENT_DEFS.map(a => a.id);
    // No duplicates within the epilogue list
    expect(new Set(epilogueIds).size).toBe(epilogueIds.length);
    // No overlap with base
    for (const id of epilogueIds) {
      expect(baseIds.has(id), `epilogue id "${id}" must not exist in base defs`).toBe(false);
    }
  });

  it('every epilogue def has a non-empty name, description, and icon', () => {
    for (const a of EPILOGUE_ACHIEVEMENT_DEFS) {
      expect(a.name.length,        `${a.id} name`).toBeGreaterThan(0);
      expect(a.description.length, `${a.id} description`).toBeGreaterThan(0);
      expect(a.icon.length,        `${a.id} icon`).toBeGreaterThan(0);
    }
  });

  it('every epilogue target is a positive number', () => {
    for (const a of EPILOGUE_ACHIEVEMENT_DEFS) {
      expect(a.target, `${a.id} target`).toBeGreaterThan(0);
    }
  });

  it('every epilogue reward has at least one non-zero field', () => {
    for (const a of EPILOGUE_ACHIEVEMENT_DEFS) {
      const { gems, soulCrystals } = a.reward;
      const hasReward = (gems !== undefined && gems > 0) ||
                        (soulCrystals !== undefined && soulCrystals > 0);
      expect(hasReward, `${a.id} reward`).toBe(true);
    }
  });

  it('getProgress returns a non-negative number for every epilogue def', () => {
    for (const a of EPILOGUE_ACHIEVEMENT_DEFS) {
      const val = a.getProgress(emptyCtx);
      expect(typeof val, `${a.id} getProgress type`).toBe('number');
      expect(val, `${a.id} getProgress >= 0`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── getAchievementDef — epilogue lookup ──────────────────────────────────────

describe('getAchievementDef — epilogue', () => {
  it('finds gold_1000000 (epilogue) by id', () => {
    const def = getAchievementDef('gold_1000000');
    expect(def).toBeDefined();
    expect(def!.category).toBe('economy');
    expect(def!.target).toBe(1_000_000);
  });

  it('finds fusion_30 (epilogue) by id', () => {
    const def = getAchievementDef('fusion_30');
    expect(def).toBeDefined();
    expect(def!.target).toBe(30);
  });

  it('finds fusion_50 (epilogue) by id', () => {
    const def = getAchievementDef('fusion_50');
    expect(def).toBeDefined();
    expect(def!.target).toBe(50);
  });

  it('finds dm_lv25 (epilogue) by id', () => {
    const def = getAchievementDef('dm_lv25');
    expect(def).toBeDefined();
    expect(def!.category).toBe('growth');
    expect(def!.target).toBe(25);
  });

  it('finds dm_lv30 (epilogue) by id', () => {
    const def = getAchievementDef('dm_lv30');
    expect(def).toBeDefined();
    expect(def!.target).toBe(30);
  });
});

// ─── getProgress — epilogue spot-checks ───────────────────────────────────────

describe('getProgress — epilogue economy', () => {
  it('gold_1000000: reports totalGoldEarned', () => {
    const def = getAchievementDef('gold_1000000')!;
    expect(def.getProgress(makeCtx({ totalGoldEarned: 500_000 }))).toBe(500_000);
    expect(def.getProgress(makeCtx({ totalGoldEarned: 1_000_000 }))).toBe(1_000_000);
  });
});

describe('getProgress — epilogue collection (fusions)', () => {
  it('fusion_30: reports totalFusions', () => {
    const def = getAchievementDef('fusion_30')!;
    expect(def.getProgress(makeCtx({ totalFusions: 15 }))).toBe(15);
    expect(def.getProgress(makeCtx({ totalFusions: 30 }))).toBe(30);
  });

  it('fusion_50: reports totalFusions', () => {
    const def = getAchievementDef('fusion_50')!;
    expect(def.getProgress(makeCtx({ totalFusions: 50 }))).toBe(50);
  });
});

describe('getProgress — epilogue growth (DM level)', () => {
  it('dm_lv25: reports dmLevel', () => {
    const def = getAchievementDef('dm_lv25')!;
    expect(def.getProgress(makeCtx({ dmLevel: 20 }))).toBe(20);
    expect(def.getProgress(makeCtx({ dmLevel: 25 }))).toBe(25);
  });

  it('dm_lv30: reports dmLevel', () => {
    const def = getAchievementDef('dm_lv30')!;
    expect(def.getProgress(makeCtx({ dmLevel: 30 }))).toBe(30);
  });
});

// ─── checkAchievements — epilogue unlock ─────────────────────────────────────

describe('checkAchievements — epilogue unlock', () => {
  it('unlocks gold_1000000 when totalGoldEarned reaches 1,000,000', () => {
    const ctx    = makeCtx({ totalGoldEarned: 1_000_000 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('gold_1000000');
  });

  it('does not unlock gold_1000000 below target', () => {
    const ctx    = makeCtx({ totalGoldEarned: 999_999 });
    const result = checkAchievements(ctx, {});
    expect(result).not.toContain('gold_1000000');
  });

  it('unlocks fusion_30 when totalFusions reaches 30', () => {
    const ctx    = makeCtx({ totalFusions: 30 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('fusion_30');
  });

  it('unlocks both fusion_30 and fusion_50 at 50 fusions', () => {
    const ctx    = makeCtx({ totalFusions: 50 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('fusion_30');
    expect(result).toContain('fusion_50');
  });

  it('unlocks dm_lv25 when dmLevel reaches 25', () => {
    const ctx    = makeCtx({ dmLevel: 25 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('dm_lv25');
  });

  it('unlocks dm_lv30 but not dm_lv25 when dm_lv25 is already unlocked', () => {
    const ctx    = makeCtx({ dmLevel: 30 });
    const result = checkAchievements(ctx, { dm_lv25: { unlocked: true } });
    expect(result).toContain('dm_lv30');
    expect(result).not.toContain('dm_lv25');
  });
});
