import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_DEFS,
  EPILOGUE_ACHIEVEMENT_DEFS,
  getAchievementDef,
  checkAchievements,
  type AchievementContext,
} from './achievements';

// ─── Shared helpers (duplicated from achievements.test.ts) ───────────────────

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

// ─── EPILOGUE_ACHIEVEMENT_DEFS data integrity ─────────────────────────────────

describe('EPILOGUE_ACHIEVEMENT_DEFS', () => {
  it('contains exactly 5 epilogue achievements', () => {
    expect(EPILOGUE_ACHIEVEMENT_DEFS).toHaveLength(5);
  });

  it('has unique ids (no overlap with base defs)', () => {
    const baseIds     = new Set(ACHIEVEMENT_DEFS.map(a => a.id));
    const epilogueIds = EPILOGUE_ACHIEVEMENT_DEFS.map(a => a.id);
    expect(new Set(epilogueIds).size).toBe(epilogueIds.length);
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

describe('getAchievementDef — unknown id', () => {
  it('returns undefined for an id not in base or epilogue defs', () => {
    expect(getAchievementDef('nonexistent_achievement_xyz')).toBeUndefined();
  });
});

describe('getProgress — epilogue economy', () => {
  it('gold_1000000: reports totalGoldEarned', () => {
    const def = getAchievementDef('gold_1000000')!;
    expect(def.getProgress(makeCtx({ totalGoldEarned: 500_000 }))).toBe(500_000);
    expect(def.getProgress(makeCtx({ totalGoldEarned: 1_000_000 }))).toBe(1_000_000);
  });

  it('gold_1000000: progress above target is returned as-is (no clamping)', () => {
    const def = getAchievementDef('gold_1000000')!;
    expect(def.getProgress(makeCtx({ totalGoldEarned: 2_000_000 }))).toBe(2_000_000);
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

  it('unlocks both dm_lv25 and dm_lv30 when neither is already unlocked at level 30', () => {
    const ctx    = makeCtx({ dmLevel: 30 });
    const result = checkAchievements(ctx, {});
    expect(result).toContain('dm_lv25');
    expect(result).toContain('dm_lv30');
  });

  it('does not re-unlock gold_1000000 when already unlocked', () => {
    const ctx    = makeCtx({ totalGoldEarned: 2_000_000 });
    const result = checkAchievements(ctx, { gold_1000000: { unlocked: true } });
    expect(result).not.toContain('gold_1000000');
  });

  it('does not unlock fusion_30 at 29 fusions (one below target)', () => {
    const ctx    = makeCtx({ totalFusions: 29 });
    const result = checkAchievements(ctx, {});
    expect(result).not.toContain('fusion_30');
  });

  it('only returns fusion_50 when fusion_30 is already unlocked at 50 fusions', () => {
    const ctx    = makeCtx({ totalFusions: 50 });
    const result = checkAchievements(ctx, { fusion_30: { unlocked: true } });
    expect(result).toContain('fusion_50');
    expect(result).not.toContain('fusion_30');
  });

  it('gold_1000000 reward is 300 gems and 100 soulCrystals', () => {
    const def = EPILOGUE_ACHIEVEMENT_DEFS.find(d => d.id === 'gold_1000000')!;
    expect(def.reward.gems).toBe(300);
    expect(def.reward.soulCrystals).toBe(100);
  });

  it('dm_lv30 reward is 200 gems and 100 soulCrystals', () => {
    const def = EPILOGUE_ACHIEVEMENT_DEFS.find(d => d.id === 'dm_lv30')!;
    expect(def.reward.gems).toBe(200);
    expect(def.reward.soulCrystals).toBe(100);
  });

  it('fusion_30 reward is 60 gems and 30 soulCrystals', () => {
    const def = EPILOGUE_ACHIEVEMENT_DEFS.find(d => d.id === 'fusion_30')!;
    expect(def.reward.gems).toBe(60);
    expect(def.reward.soulCrystals).toBe(30);
  });

  it('fusion_50 reward is 120 gems and 60 soulCrystals', () => {
    const def = EPILOGUE_ACHIEVEMENT_DEFS.find(d => d.id === 'fusion_50')!;
    expect(def.reward.gems).toBe(120);
    expect(def.reward.soulCrystals).toBe(60);
  });

  it('dm_lv25 reward is 100 gems and 50 soulCrystals', () => {
    const def = EPILOGUE_ACHIEVEMENT_DEFS.find(d => d.id === 'dm_lv25')!;
    expect(def.reward.gems).toBe(100);
    expect(def.reward.soulCrystals).toBe(50);
  });

  it('dm_lv25 at exactly level 24 (one below) is NOT unlocked', () => {
    const ctx    = makeCtx({ dmLevel: 24 });
    const result = checkAchievements(ctx, {});
    expect(result).not.toContain('dm_lv25');
  });

  it('returns empty array when no achievements qualify (emptyCtx)', () => {
    const result = checkAchievements(emptyCtx, {});
    expect(result).toHaveLength(0);
  });
});
