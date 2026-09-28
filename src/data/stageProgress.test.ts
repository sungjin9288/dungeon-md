import { describe, it, expect, beforeEach } from 'vitest';
import {
  STAGE_CONFIGS,
  stageClearTitle,
  TOTAL_STAGES,
  applyStageClear,
  loadProgress,
  saveProgress,
  recordClear,
} from './stageProgress';

beforeEach(() => {
  localStorage.clear();
});

// ─── STAGE_CONFIGS data integrity ────────────────────────────────────────────

describe('STAGE_CONFIGS', () => {
  it('contains exactly 90 entries', () => {
    expect(STAGE_CONFIGS).toHaveLength(90);
  });

  it('TOTAL_STAGES constant equals 90', () => {
    expect(TOTAL_STAGES).toBe(90);
  });

  it('stageNumber runs 1–90 in order', () => {
    STAGE_CONFIGS.forEach((cfg, i) => {
      expect(cfg.stageNumber).toBe(i + 1);
    });
  });

  it('chapter values span 1–9', () => {
    const chapters = new Set(STAGE_CONFIGS.map(c => c.chapter));
    for (let ch = 1; ch <= 9; ch++) {
      expect(chapters.has(ch), `chapter ${ch} present`).toBe(true);
    }
  });

  it('all chapter values are between 1 and 9', () => {
    for (const cfg of STAGE_CONFIGS) {
      expect(cfg.chapter).toBeGreaterThanOrEqual(1);
      expect(cfg.chapter).toBeLessThanOrEqual(9);
    }
  });

  it('boss stages are at stageNumbers 10, 20, 32, 42, 52, 62, 72, 80, 90', () => {
    const bosses = STAGE_CONFIGS.filter(c => c.bossWave).map(c => c.stageNumber);
    expect(bosses).toEqual([10, 20, 32, 42, 52, 62, 72, 80, 90]);
  });

  it('non-boss stages do not have bossWave: true', () => {
    const bossNums = new Set([10, 20, 32, 42, 52, 62, 72, 80, 90]);
    for (const cfg of STAGE_CONFIGS) {
      if (!bossNums.has(cfg.stageNumber)) {
        expect(cfg.bossWave ?? false, `stage ${cfg.stageNumber}`).toBe(false);
      }
    }
  });

  it('every stageNumber matches its array index + 1', () => {
    STAGE_CONFIGS.forEach((cfg, i) => {
      expect(cfg.stageNumber - 1).toBe(i);
    });
  });

});

// ─── STAGE_CONFIGS — chapter layout ──────────────────────────────────────────

describe('STAGE_CONFIGS — chapter layout', () => {
  it('Ch1 spans stages 1–10 (10 stages)', () => {
    const ch1 = STAGE_CONFIGS.filter(s => s.chapter === 1);
    expect(ch1).toHaveLength(10);
    expect(ch1[0].stageNumber).toBe(1);
    expect(ch1[ch1.length - 1].stageNumber).toBe(10);
  });

  it('Ch3 has 12 stages (stages 21–32)', () => {
    const ch3 = STAGE_CONFIGS.filter(s => s.chapter === 3);
    expect(ch3).toHaveLength(12);
    expect(ch3[0].stageNumber).toBe(21);
    expect(ch3[ch3.length - 1].stageNumber).toBe(32);
  });

  it('Ch8 has 8 stages (stages 73–80)', () => {
    const ch8 = STAGE_CONFIGS.filter(s => s.chapter === 8);
    expect(ch8).toHaveLength(8);
    expect(ch8[0].stageNumber).toBe(73);
    expect(ch8[ch8.length - 1].stageNumber).toBe(80);
  });

  it('every chapter from 1 to 9 is represented', () => {
    const chapters = new Set(STAGE_CONFIGS.map(s => s.chapter));
    for (let ch = 1; ch <= 9; ch++) {
      expect(chapters.has(ch), `chapter ${ch} missing`).toBe(true);
    }
  });

  it('Ch2 spans stages 11–20 (10 stages)', () => {
    const ch2 = STAGE_CONFIGS.filter(s => s.chapter === 2);
    expect(ch2).toHaveLength(10);
    expect(ch2[0].stageNumber).toBe(11);
    expect(ch2[ch2.length - 1].stageNumber).toBe(20);
  });

  it('Ch4 spans stages 33–42 (10 stages)', () => {
    const ch4 = STAGE_CONFIGS.filter(s => s.chapter === 4);
    expect(ch4).toHaveLength(10);
    expect(ch4[0].stageNumber).toBe(33);
    expect(ch4[ch4.length - 1].stageNumber).toBe(42);
  });

  it('Ch5 spans stages 43–52 (10 stages)', () => {
    const ch5 = STAGE_CONFIGS.filter(s => s.chapter === 5);
    expect(ch5).toHaveLength(10);
    expect(ch5[0].stageNumber).toBe(43);
    expect(ch5[ch5.length - 1].stageNumber).toBe(52);
  });

  it('Ch6 spans stages 53–62 (10 stages)', () => {
    const ch6 = STAGE_CONFIGS.filter(s => s.chapter === 6);
    expect(ch6).toHaveLength(10);
    expect(ch6[0].stageNumber).toBe(53);
    expect(ch6[ch6.length - 1].stageNumber).toBe(62);
  });

  it('Ch7 spans stages 63–72 (10 stages)', () => {
    const ch7 = STAGE_CONFIGS.filter(s => s.chapter === 7);
    expect(ch7).toHaveLength(10);
    expect(ch7[0].stageNumber).toBe(63);
    expect(ch7[ch7.length - 1].stageNumber).toBe(72);
  });

  it('total boss-wave stages equals exactly 9', () => {
    const bosses = STAGE_CONFIGS.filter(s => s.bossWave === true);
    expect(bosses).toHaveLength(9);
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

  it('falls back to default 80-entry state on corrupt JSON', () => {
    localStorage.setItem('dungeonStageProgress', 'not-valid-json{{{');
    const prog = loadProgress();
    expect(prog).toHaveLength(TOTAL_STAGES);
    expect(prog[0].unlocked).toBe(true);   // stage 1 still unlocked
    expect(prog[1].unlocked).toBe(false);  // rest locked
  });

  it('saveProgress round-trip — exact values survive save/load', () => {
    const data = Array.from({ length: TOTAL_STAGES }, (_, i) => ({
      unlocked: i === 0,
      bestStars: i === 0 ? 2 : 0,
      ...(i === 0 ? { bestHpPercent: 88 } : {}),
    }));
    saveProgress(data);
    const loaded = loadProgress();
    expect(loaded[0].bestStars).toBe(2);
    expect(loaded[0].bestHpPercent).toBe(88);
    expect(loaded[1].bestStars).toBe(0);
  });
});

// ─── applyStageClear ─────────────────────────────────────────────────────────

describe('applyStageClear', () => {
  it('returns a new progress array without mutating the input entries', () => {
    const progress = loadProgress();
    const originalStage = progress[0];
    const originalNext = progress[1];

    const next = applyStageClear(progress, 0, 3, 88);

    expect(next).not.toBe(progress);
    expect(next[0]).not.toBe(originalStage);
    expect(next[1]).not.toBe(originalNext);
    expect(next[0].bestStars).toBe(3);
    expect(next[0].bestHpPercent).toBe(88);
    expect(next[1].unlocked).toBe(true);
    expect(progress[0].bestStars).toBe(0);
    expect(progress[0].bestHpPercent).toBeUndefined();
    expect(progress[1].unlocked).toBe(false);
  });

  it('preserves higher bestStars and bestHpPercent values', () => {
    const progress = loadProgress();
    const first = applyStageClear(progress, 0, 3, 91);
    const second = applyStageClear(first, 0, 1, 25);

    expect(second[0].bestStars).toBe(3);
    expect(second[0].bestHpPercent).toBe(91);
  });

  it('does not write bestHpPercent when hpPercent is omitted', () => {
    const next = applyStageClear(loadProgress(), 0, 2);

    expect(next[0].bestStars).toBe(2);
    expect(next[0].bestHpPercent).toBeUndefined();
  });

  it('returns the same reference for an out-of-range stage index', () => {
    const progress = loadProgress();

    expect(applyStageClear(progress, 999, 3)).toBe(progress);
    expect(applyStageClear(progress, -1, 3)).toBe(progress);
  });

  it('unlocks chapter gates through the shared clear rule', () => {
    const next = applyStageClear(loadProgress(), 71, 3, 100);

    expect(next[71].bestStars).toBe(3);
    expect(next[72].unlocked).toBe(true);
    expect(next[71].bestHpPercent).toBe(100);
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

  it('out-of-range stageIndex returns progress unchanged without throwing', () => {
    const before = loadProgress();
    expect(() => recordClear(999, 3)).not.toThrow();
    expect(() => recordClear(-1, 3)).not.toThrow();
    const after = loadProgress();
    // Progress should not change since guards return early
    expect(after[0].bestStars).toBe(before[0].bestStars);
  });
});

// ─── STAGE_CONFIGS — structural invariants ────────────────────────────────────

describe('STAGE_CONFIGS — structural invariants', () => {

  it('boss stage is always the last stage in its chapter', () => {
    for (let ch = 1; ch <= 9; ch++) {
      const chStages = STAGE_CONFIGS.filter(c => c.chapter === ch);
      const lastStage = chStages[chStages.length - 1];
      expect(lastStage.bossWave, `Ch${ch} last stage should be boss`).toBe(true);
    }
  });

  it('recordClear(8) does NOT unlock Ch2 gate (index 10) — only index 9 triggers it', () => {
    const prog = recordClear(8, 3); // clears stage 9
    expect(prog[9].unlocked).toBe(true);   // next stage (index 9) unlocked
    expect(prog[10].unlocked).toBe(false); // Ch2 gate NOT triggered
  });

  it('two consecutive clears progressively unlock the chain', () => {
    recordClear(0, 3); // unlocks index 1
    recordClear(1, 3); // unlocks index 2
    const prog = loadProgress();
    expect(prog[0].bestStars).toBe(3);
    expect(prog[1].bestStars).toBe(3);
    expect(prog[2].unlocked).toBe(true);
  });

  it('loadProgress with an exactly-90-entry save does not pad or trim', () => {
    const full = Array.from({ length: 90 }, (_, i) => ({ unlocked: i === 0, bestStars: 0 }));
    saveProgress(full);
    const loaded = loadProgress();
    expect(loaded).toHaveLength(90);
  });

  it('recordClear return value matches a subsequent loadProgress() call', () => {
    const returned = recordClear(0, 3, 90);
    const loaded   = loadProgress();
    expect(returned[0].bestStars).toBe(loaded[0].bestStars);
    expect(returned[0].bestHpPercent).toBe(loaded[0].bestHpPercent);
    expect(returned[1].unlocked).toBe(loaded[1].unlocked);
  });
});

// ─── STAGE_CONFIGS — index pins & shared-gate patterns ───────────────────────

describe('STAGE_CONFIGS — index pins & shared-gate patterns', () => {
  it('STAGE_CONFIGS[79] is stageNumber=80, bossWave=true, chapter=8 (final stage)', () => {
    const cfg = STAGE_CONFIGS[79];
    expect(cfg.stageNumber).toBe(80);
    expect(cfg.bossWave).toBe(true);
    expect(cfg.chapter).toBe(8);
  });

  it('recordClear(78, 3) unlocks index 79 (stage 80, penultimate → final)', () => {
    localStorage.clear();
    recordClear(78, 3);
    const prog = loadProgress();
    expect(prog[79].unlocked).toBe(true);
  });

  it('every loadProgress entry has boolean unlocked and numeric bestStars', () => {
    localStorage.clear();
    const prog = loadProgress();
    for (const entry of prog) {
      expect(typeof entry.unlocked,   'unlocked not boolean').toBe('boolean');
      expect(typeof entry.bestStars,  'bestStars not number').toBe('number');
    }
  });
});

// ─── STAGE_CONFIGS — Ch4/Ch6/Ch7 group gates & slot pins ─────────────────────

describe('STAGE_CONFIGS — Ch4/Ch6/Ch7 group gates & additional slot pins', () => {

  it('recordClear with hpPercent=0 stores 0 as bestHpPercent', () => {
    localStorage.clear();
    recordClear(0, 2, 0);
    const prog = loadProgress();
    expect(prog[0].bestHpPercent).toBe(0);
  });

});

// Every regular clear used to read "N장 전선 확보", so clearing stage 1 of 10
// looked like the whole chapter was secured.
describe('stageClearTitle', () => {
  it('names the gate for a mid-chapter clear', () => {
    expect(stageClearTitle(1)).toBe('관문 1 확보');
    expect(stageClearTitle(9)).toBe('관문 9 확보');
  });
  it('secures the chapter only on its last stage', () => {
    for (const cfg of STAGE_CONFIGS) {
      const next = STAGE_CONFIGS.find(c => c.stageNumber === cfg.stageNumber + 1);
      const last = !next || next.chapter !== cfg.chapter;
      expect(stageClearTitle(cfg.stageNumber)).toBe(last ? `${cfg.chapter}장 전선 확보` : `관문 ${cfg.stageNumber} 확보`);
    }
    expect(stageClearTitle(10)).toBe('1장 전선 확보');
  });
});
