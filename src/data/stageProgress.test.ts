import { describe, it, expect, beforeEach } from 'vitest';
import {
  STAGE_CONFIGS,
  TOTAL_STAGES,
  loadProgress,
  saveProgress,
  recordClear,
} from './stageProgress';

beforeEach(() => {
  localStorage.clear();
});

// ─── STAGE_CONFIGS data integrity ────────────────────────────────────────────

describe('STAGE_CONFIGS', () => {
  it('contains exactly 80 entries', () => {
    expect(STAGE_CONFIGS).toHaveLength(80);
  });

  it('TOTAL_STAGES constant equals 80', () => {
    expect(TOTAL_STAGES).toBe(80);
  });

  it('stageNumber runs 1–80 in order', () => {
    STAGE_CONFIGS.forEach((cfg, i) => {
      expect(cfg.stageNumber).toBe(i + 1);
    });
  });

  it('chapter values span 1–8', () => {
    const chapters = new Set(STAGE_CONFIGS.map(c => c.chapter));
    for (let ch = 1; ch <= 8; ch++) {
      expect(chapters.has(ch), `chapter ${ch} present`).toBe(true);
    }
  });

  it('all chapter values are between 1 and 8', () => {
    for (const cfg of STAGE_CONFIGS) {
      expect(cfg.chapter).toBeGreaterThanOrEqual(1);
      expect(cfg.chapter).toBeLessThanOrEqual(8);
    }
  });

  it('every slot count is a positive number', () => {
    for (const cfg of STAGE_CONFIGS) {
      expect(cfg.slots, `stage ${cfg.stageNumber}`).toBeGreaterThan(0);
    }
  });

  it('boss stages are at stageNumbers 10, 20, 32, 42, 52, 62, 72, 80', () => {
    const bosses = STAGE_CONFIGS.filter(c => c.bossWave).map(c => c.stageNumber);
    expect(bosses).toEqual([10, 20, 32, 42, 52, 62, 72, 80]);
  });

  it('non-boss stages do not have bossWave: true', () => {
    const bossNums = new Set([10, 20, 32, 42, 52, 62, 72, 80]);
    for (const cfg of STAGE_CONFIGS) {
      if (!bossNums.has(cfg.stageNumber)) {
        expect(cfg.bossWave ?? false, `stage ${cfg.stageNumber}`).toBe(false);
      }
    }
  });

  it('slot counts generally increase across stages (not strictly, but final > initial)', () => {
    const firstSlots = STAGE_CONFIGS[0].slots;
    const lastSlots  = STAGE_CONFIGS[79].slots;
    expect(lastSlots).toBeGreaterThan(firstSlots);
  });

  it('every stageNumber matches its array index + 1', () => {
    STAGE_CONFIGS.forEach((cfg, i) => {
      expect(cfg.stageNumber - 1).toBe(i);
    });
  });
});

// ─── loadProgress ─────────────────────────────────────────────────────────────

describe('loadProgress', () => {
  it('returns 80 entries on fresh state', () => {
    const prog = loadProgress();
    expect(prog).toHaveLength(TOTAL_STAGES);
  });

  it('stage 1 (index 0) is unlocked by default', () => {
    const prog = loadProgress();
    expect(prog[0].unlocked).toBe(true);
  });

  it('stages 2–80 are locked by default', () => {
    const prog = loadProgress();
    for (let i = 1; i < TOTAL_STAGES; i++) {
      expect(prog[i].unlocked, `index ${i}`).toBe(false);
    }
  });

  it('all bestStars start at 0', () => {
    const prog = loadProgress();
    for (const entry of prog) {
      expect(entry.bestStars).toBe(0);
    }
  });

  it('pads a short (legacy) save to 80 entries', () => {
    // Simulate a 10-entry old save
    const old = Array.from({ length: 10 }, (_, i) => ({
      unlocked: i === 0,
      bestStars: i === 0 ? 3 : 0,
    }));
    localStorage.setItem('dungeonStageProgress', JSON.stringify(old));
    const prog = loadProgress();
    expect(prog).toHaveLength(TOTAL_STAGES);
    expect(prog[0].bestStars).toBe(3); // preserved
    expect(prog[10].unlocked).toBe(false); // padded
  });

  it('loads and preserves saved progress correctly', () => {
    const data = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
      unlocked: i < 5,
      bestStars: i < 5 ? 3 : 0,
    }));
    saveProgress(data);
    const loaded = loadProgress();
    expect(loaded[4].unlocked).toBe(true);
    expect(loaded[4].bestStars).toBe(3);
    expect(loaded[5].unlocked).toBe(false);
  });
});

// ─── recordClear ──────────────────────────────────────────────────────────────

describe('recordClear', () => {
  it('updates bestStars for the cleared stage', () => {
    const prog = recordClear(0, 3);
    expect(prog[0].bestStars).toBe(3);
  });

  it('does not downgrade bestStars (max preserved)', () => {
    recordClear(0, 3);
    const prog = recordClear(0, 1);
    expect(prog[0].bestStars).toBe(3);
  });

  it('unlocks the next stage after a clear', () => {
    const prog = recordClear(0, 2); // clear stage index 0
    expect(prog[1].unlocked).toBe(true);
  });

  it('records bestHpPercent when provided', () => {
    const prog = recordClear(0, 3, 85);
    expect(prog[0].bestHpPercent).toBe(85);
  });

  it('does not downgrade bestHpPercent', () => {
    recordClear(0, 3, 90);
    const prog = recordClear(0, 2, 50);
    expect(prog[0].bestHpPercent).toBe(90);
  });

  it('does not record bestHpPercent when undefined', () => {
    const prog = recordClear(0, 3); // no hpPercent
    expect(prog[0].bestHpPercent).toBeUndefined();
  });

  // ── Chapter gate unlocks ───────────────────────────────────────────────────

  it('clearing index 9 (Stage 10 boss) unlocks index 10 — Ch2 gate', () => {
    const prog = recordClear(9, 3);
    expect(prog[10].unlocked).toBe(true);
  });

  it('clearing index 19 (Stage 20 boss) unlocks index 20 — Ch3 gate', () => {
    const prog = recordClear(19, 3);
    expect(prog[20].unlocked).toBe(true);
  });

  it('clearing index 31 (Stage 32 boss) unlocks index 32 — Ch4 gate', () => {
    const prog = recordClear(31, 3);
    expect(prog[32].unlocked).toBe(true);
  });

  it('clearing index 41 (Stage 42 boss) unlocks index 42 — Ch5 gate', () => {
    const prog = recordClear(41, 3);
    expect(prog[42].unlocked).toBe(true);
  });

  it('clearing index 51 (Stage 52 boss) unlocks index 52 — Ch6 gate', () => {
    const prog = recordClear(51, 3);
    expect(prog[52].unlocked).toBe(true);
  });

  it('clearing index 61 (Stage 62 boss) unlocks index 62 — Ch7 gate', () => {
    const prog = recordClear(61, 3);
    expect(prog[62].unlocked).toBe(true);
  });

  it('clearing index 71 (Stage 72 boss) unlocks index 72 — Ch8 gate', () => {
    const prog = recordClear(71, 3);
    expect(prog[72].unlocked).toBe(true);
  });

  it('does not unlock beyond TOTAL_STAGES on the last stage', () => {
    // Clearing the last stage (index 79) must not throw / access out-of-bounds
    expect(() => recordClear(79, 3)).not.toThrow();
    const prog = recordClear(79, 3);
    expect(prog).toHaveLength(TOTAL_STAGES);
  });

  it('returns the full progress array of length 80', () => {
    const prog = recordClear(0, 2);
    expect(prog).toHaveLength(TOTAL_STAGES);
  });

  it('persists cleared progress to localStorage', () => {
    recordClear(3, 3, 75);
    const loaded = loadProgress();
    expect(loaded[3].bestStars).toBe(3);
    expect(loaded[3].bestHpPercent).toBe(75);
  });
});
