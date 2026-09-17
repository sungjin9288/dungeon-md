import { describe, it, expect } from 'vitest';
import { GRID_COLS, GRID_ROWS } from '../constants/layout';
import {
  CHAPTER_1,
  CHAPTER_2,
  CHAPTER_3,
  CHAPTER_4,
  CHAPTER_5,
  CHAPTER_6,
  CHAPTER_7,
  CHAPTER_8,
  CHAPTER_9,
  type StageConfig,
  type WaveSpec,
} from './stages';
import { TRAP_DEFS } from './traps';
import { INVADER_DEFS, type InvaderType } from './invaders';

const ALL_CHAPTERS = [
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4,
  CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8, CHAPTER_9,
] as const;

const ALL_STAGES: StageConfig[] = ALL_CHAPTERS.flat();

// ─── Total stage count ────────────────────────────────────────────────────────

describe('stages — total count', () => {
  it('all chapters combined equal 90 stages', () => {
    expect(ALL_STAGES.length).toBe(90);
  });

  it('CHAPTER_1 has 10 stages', () => {
    expect(CHAPTER_1).toHaveLength(10);
  });

  it('CHAPTER_2 has 10 stages', () => {
    expect(CHAPTER_2).toHaveLength(10);
  });

  it('CHAPTER_3 has 12 stages', () => {
    expect(CHAPTER_3).toHaveLength(12);
  });

  it('CHAPTER_8 has 8 stages', () => {
    expect(CHAPTER_8).toHaveLength(8);
  });

  it('CHAPTER_9 has 10 stages', () => {
    expect(CHAPTER_9).toHaveLength(10);
  });
});

// ─── StageConfig structural integrity ────────────────────────────────────────

describe('StageConfig — structural integrity', () => {
  it('every id is a positive integer', () => {
    for (const s of ALL_STAGES) {
      expect(Number.isInteger(s.id), `stage ${s.id} not integer`).toBe(true);
      expect(s.id, `stage ${s.id}`).toBeGreaterThan(0);
    }
  });

  it('stage ids are unique across all chapters', () => {
    const ids = ALL_STAGES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stage ids span exactly 1–90 with no gaps', () => {
    const ids = ALL_STAGES.map(s => s.id).sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      expect(ids[i], `expected id ${i + 1}`).toBe(i + 1);
    }
  });

  it('every stage has a chapter value 1–9', () => {
    for (const s of ALL_STAGES) {
      expect(s.chapter, `stage ${s.id} chapter`).toBeGreaterThanOrEqual(1);
      expect(s.chapter, `stage ${s.id} chapter`).toBeLessThanOrEqual(9);
    }
  });

  it('every stage has dungeonHp > 0', () => {
    for (const s of ALL_STAGES) {
      expect(s.dungeonHp, `stage ${s.id} dungeonHp`).toBeGreaterThan(0);
    }
  });

  it('every stage has at least one wave', () => {
    for (const s of ALL_STAGES) {
      expect(s.waves.length, `stage ${s.id} waves`).toBeGreaterThan(0);
    }
  });

  it('koreanName, when present, is non-empty', () => {
    for (const s of ALL_STAGES) {
      if (s.koreanName !== undefined) {
        expect(s.koreanName.length, `stage ${s.id} koreanName`).toBeGreaterThan(0);
      }
    }
  });

  it('every water cell is unique and inside the runtime grid', () => {
    for (const s of ALL_STAGES) {
      const waterCells = s.waterCells ?? [];
      const cellCount = (s.gridCols ?? GRID_COLS) * GRID_ROWS;
      expect(new Set(waterCells).size, `stage ${s.id} duplicate water cell`).toBe(waterCells.length);
      for (const index of waterCells) {
        expect(Number.isInteger(index), `stage ${s.id} water cell ${index}`).toBe(true);
        expect(index, `stage ${s.id} water cell ${index}`).toBeGreaterThanOrEqual(0);
        expect(index, `stage ${s.id} water cell ${index}`).toBeLessThan(cellCount);
      }
    }
  });

  it('keeps Chapter 3 water layouts inside its fixed 4×3 board', () => {
    expect(CHAPTER_3.map(s => s.waterCells ?? [])).toEqual([
      [0],
      [3],
      [0, 3],
      [8, 11],
      [3, 8, 9],
      [0, 7, 10],
      [1, 9, 10],
      [2, 8, 9, 11],
      [0, 3, 5, 9, 10],
      [3, 5, 8, 10, 11],
      [1, 4, 8, 9, 11],
      [0, 3, 5, 8, 10, 11],
    ]);
  });
});

// ─── WaveSpec integrity ───────────────────────────────────────────────────────

describe('WaveSpec — integrity', () => {
  const allWaves: Array<{ stageId: number; wave: WaveSpec }> = ALL_STAGES.flatMap(s =>
    s.waves.map(w => ({ stageId: s.id, wave: w })),
  );

  it('every wave has at least one invader group', () => {
    for (const { stageId, wave } of allWaves) {
      expect(wave.invaders.length, `stage ${stageId} a wave`).toBeGreaterThan(0);
    }
  });

  it('every invader group has count > 0', () => {
    for (const { stageId, wave } of allWaves) {
      for (const inv of wave.invaders) {
        expect(inv.count, `stage ${stageId} invader count`).toBeGreaterThan(0);
      }
    }
  });

  it('every invader group has spawnDelay >= 0', () => {
    for (const { stageId, wave } of allWaves) {
      for (const inv of wave.invaders) {
        expect(inv.spawnDelay, `stage ${stageId} spawnDelay`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every invader type is a known InvaderType', () => {
    for (const { stageId, wave } of allWaves) {
      for (const inv of wave.invaders) {
        expect(
          INVADER_DEFS[inv.type as InvaderType],
          `stage ${stageId} unknown type "${inv.type}"`,
        ).toBeDefined();
      }
    }
  });

  it('clearReward, when set, is a positive integer', () => {
    for (const { stageId, wave } of allWaves) {
      if (wave.clearReward !== undefined) {
        expect(wave.clearReward, `stage ${stageId} clearReward`).toBeGreaterThan(0);
        expect(Number.isInteger(wave.clearReward), `stage ${stageId} clearReward integer`).toBe(true);
      }
    }
  });
});

// ─── Chapter-level constraints ────────────────────────────────────────────────

describe('chapter-level constraints', () => {
  it('all Ch1 stages have chapter = 1', () => {
    for (const s of CHAPTER_1) {
      expect(s.chapter).toBe(1);
    }
  });

  it('all Ch8 stages have chapter = 8', () => {
    for (const s of CHAPTER_8) {
      expect(s.chapter).toBe(8);
    }
  });

  it('Ch1 ids are 1–10', () => {
    const ids = CHAPTER_1.map(s => s.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(ids[ids.length - 1]).toBe(10);
  });

  it('Ch8 ids are 73–80', () => {
    const ids = CHAPTER_8.map(s => s.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(73);
    expect(ids[ids.length - 1]).toBe(80);
  });

  it('dungeonHp increases from Ch1 to Ch8 (later chapters are harder)', () => {
    const ch1AvgHp = CHAPTER_1.reduce((s, x) => s + x.dungeonHp, 0) / CHAPTER_1.length;
    const ch8AvgHp = CHAPTER_8.reduce((s, x) => s + x.dungeonHp, 0) / CHAPTER_8.length;
    expect(ch8AvgHp).toBeGreaterThan(ch1AvgHp);
  });

  it('stage 10 (final Ch1) has a boss wave with isBoss=true', () => {
    const stage10 = CHAPTER_1.find(s => s.id === 10)!;
    const lastWave = stage10.waves[stage10.waves.length - 1];
    expect(lastWave.invaders.some(inv => inv.isBoss === true)).toBe(true);
  });

  it('stage 80 (final Ch8) has a boss wave with isBoss=true', () => {
    const stage80 = CHAPTER_8.find(s => s.id === 80)!;
    const lastWave = stage80.waves[stage80.waves.length - 1];
    expect(lastWave.invaders.some(inv => inv.isBoss === true)).toBe(true);
  });

  it('each chapter ends with a boss-tier invader (isBoss on spec or on invader def)', () => {
    // Some chapters mark isBoss on the wave entry; others rely on the invader def's isBoss flag
    for (const chapter of ALL_CHAPTERS) {
      const lastStage = chapter[chapter.length - 1];
      const lastWave  = lastStage.waves[lastStage.waves.length - 1];
      const hasBoss = lastWave.invaders.some(inv => {
        const specBoss = inv.isBoss === true;
        const defBoss  = (INVADER_DEFS[inv.type as InvaderType] as { isBoss?: boolean })?.isBoss === true;
        return specBoss || defBoss;
      });
      expect(hasBoss, `chapter ending stage ${lastStage.id} missing boss-tier invader`).toBe(true);
    }
  });

  it('Ch2+ stages have gridCols defined (multi-column grid)', () => {
    const laterChapters = [CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5,
                           CHAPTER_6, CHAPTER_7, CHAPTER_8];
    for (const chapter of laterChapters) {
      for (const s of chapter) {
        expect(s.gridCols, `stage ${s.id} gridCols`).toBeDefined();
        expect(s.gridCols!, `stage ${s.id} gridCols value`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ─── TRAP_DEFS — data integrity ───────────────────────────────────────────────

describe('TRAP_DEFS', () => {
  it('contains exactly 4 trap definitions', () => {
    expect(TRAP_DEFS).toHaveLength(4);
  });

  it('every trap has a non-empty id', () => {
    for (const t of TRAP_DEFS) {
      expect(t.id.length, `${t.id} id`).toBeGreaterThan(0);
    }
  });

  it('trap ids are unique', () => {
    const ids = TRAP_DEFS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every trap has a non-empty emoji', () => {
    for (const t of TRAP_DEFS) {
      expect(t.emoji.length, `${t.id} emoji`).toBeGreaterThan(0);
    }
  });

  it('every trap has a non-empty name', () => {
    for (const t of TRAP_DEFS) {
      expect(t.name.length, `${t.id} name`).toBeGreaterThan(0);
    }
  });

  it('every trap has a non-empty desc', () => {
    for (const t of TRAP_DEFS) {
      expect(t.desc.length, `${t.id} desc`).toBeGreaterThan(0);
    }
  });

  it('every trap cost is positive', () => {
    for (const t of TRAP_DEFS) {
      expect(t.cost, `${t.id} cost`).toBeGreaterThan(0);
    }
  });

  it('every trap unlockLv is non-negative', () => {
    for (const t of TRAP_DEFS) {
      expect(t.unlockLv, `${t.id} unlockLv`).toBeGreaterThanOrEqual(0);
    }
  });

  it('spike_trap exists and has cost 50', () => {
    const trap = TRAP_DEFS.find(t => t.id === 'spike_trap');
    expect(trap).toBeDefined();
    expect(trap!.cost).toBe(50);
    expect(trap!.unlockLv).toBe(0);
  });

  it('stun_trap is the most expensive trap', () => {
    const maxCost = Math.max(...TRAP_DEFS.map(t => t.cost));
    const stunTrap = TRAP_DEFS.find(t => t.id === 'stun_trap');
    expect(stunTrap!.cost).toBe(maxCost);
  });

  it('costs strictly increase from spike to stun (ascending by unlockLv)', () => {
    // Traps are defined in order: spike(0) → slow(0) → poison(6) → stun(10)
    // Costs should generally increase with power
    const spikeC = TRAP_DEFS.find(t => t.id === 'spike_trap')!.cost;
    const slowC  = TRAP_DEFS.find(t => t.id === 'slow_trap')!.cost;
    const poisonC = TRAP_DEFS.find(t => t.id === 'poison_trap')!.cost;
    const stunC  = TRAP_DEFS.find(t => t.id === 'stun_trap')!.cost;
    expect(slowC).toBeGreaterThan(spikeC);
    expect(poisonC).toBeGreaterThan(slowC);
    expect(stunC).toBeGreaterThan(poisonC);
  });
});

// ─── koreanName completeness ──────────────────────────────────────────────────

describe('ALL_STAGES — koreanName completeness', () => {
  it('every stage has a defined, non-empty koreanName', () => {
    for (const s of ALL_STAGES) {
      expect(
        s.koreanName,
        `Stage ${s.id} (ch${s.chapter}) is missing koreanName`,
      ).toBeDefined();
      expect(
        s.koreanName!.length,
        `Stage ${s.id} koreanName is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('Ch4 stages 33–42 all have koreanName', () => {
    const ch4 = ALL_STAGES.filter(s => s.chapter === 4);
    expect(ch4).toHaveLength(10);
    for (const s of ch4) {
      expect(s.koreanName, `Stage ${s.id} missing koreanName`).toBeDefined();
    }
  });

  it('Ch5 stages 43–52 all have koreanName', () => {
    const ch5 = ALL_STAGES.filter(s => s.chapter === 5);
    expect(ch5).toHaveLength(10);
    for (const s of ch5) {
      expect(s.koreanName, `Stage ${s.id} missing koreanName`).toBeDefined();
    }
  });

  it('spot-checks: specific Ch4/Ch5 koreanNames are correct', () => {
    const s42 = ALL_STAGES.find(s => s.id === 42)!;
    expect(s42.koreanName).toBe('저승왕 사자');
    const s46 = ALL_STAGES.find(s => s.id === 46)!;
    expect(s46.koreanName).toBe('공허의 침입자');
    const s52 = ALL_STAGES.find(s => s.id === 52)!;
    expect(s52.koreanName).toBe('삼신 파괴자');
  });

  it('koreanNames are unique across all 80 stages', () => {
    const names = ALL_STAGES.map(s => s.koreanName!);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ─── stages — chapter counts Ch4–Ch7 ─────────────────────────────────────────

describe('stages — chapter counts Ch4–Ch7', () => {
  it('CHAPTER_4 has 10 stages', () => {
    expect(CHAPTER_4).toHaveLength(10);
  });

  it('CHAPTER_5 has 10 stages', () => {
    expect(CHAPTER_5).toHaveLength(10);
  });

  it('CHAPTER_6 has 10 stages', () => {
    expect(CHAPTER_6).toHaveLength(10);
  });

  it('CHAPTER_7 has 10 stages', () => {
    expect(CHAPTER_7).toHaveLength(10);
  });

  it('all Ch4 stages have chapter = 4', () => {
    for (const s of CHAPTER_4) {
      expect(s.chapter, `stage ${s.id}`).toBe(4);
    }
  });

  it('all Ch5 stages have chapter = 5', () => {
    for (const s of CHAPTER_5) {
      expect(s.chapter, `stage ${s.id}`).toBe(5);
    }
  });

  it('all Ch6 stages have chapter = 6', () => {
    for (const s of CHAPTER_6) {
      expect(s.chapter, `stage ${s.id}`).toBe(6);
    }
  });

  it('all Ch7 stages have chapter = 7', () => {
    for (const s of CHAPTER_7) {
      expect(s.chapter, `stage ${s.id}`).toBe(7);
    }
  });
});

// ─── stages — chapter ID ranges ──────────────────────────────────────────────

describe('stages — chapter ID ranges', () => {
  const idsOf = (ch: StageConfig[]) => ch.map(s => s.id).sort((a, b) => a - b);

  it('Ch2 ids are 11–20', () => {
    const ids = idsOf(CHAPTER_2);
    expect(ids[0]).toBe(11);
    expect(ids[ids.length - 1]).toBe(20);
    expect(ids).toHaveLength(10);
  });

  it('Ch3 ids are 21–32', () => {
    const ids = idsOf(CHAPTER_3);
    expect(ids[0]).toBe(21);
    expect(ids[ids.length - 1]).toBe(32);
    expect(ids).toHaveLength(12);
  });

  it('Ch4 ids are 33–42', () => {
    const ids = idsOf(CHAPTER_4);
    expect(ids[0]).toBe(33);
    expect(ids[ids.length - 1]).toBe(42);
    expect(ids).toHaveLength(10);
  });

  it('Ch5 ids are 43–52', () => {
    const ids = idsOf(CHAPTER_5);
    expect(ids[0]).toBe(43);
    expect(ids[ids.length - 1]).toBe(52);
    expect(ids).toHaveLength(10);
  });

  it('Ch6 ids are 53–62', () => {
    const ids = idsOf(CHAPTER_6);
    expect(ids[0]).toBe(53);
    expect(ids[ids.length - 1]).toBe(62);
    expect(ids).toHaveLength(10);
  });

  it('Ch7 ids are 63–72', () => {
    const ids = idsOf(CHAPTER_7);
    expect(ids[0]).toBe(63);
    expect(ids[ids.length - 1]).toBe(72);
    expect(ids).toHaveLength(10);
  });
});

// ─── stages — per-chapter final boss wave ────────────────────────────────────

describe('stages — per-chapter final boss wave', () => {
  const hasBoss = (stage: StageConfig) =>
    stage.waves.some(w =>
      w.invaders.some(inv => {
        if (inv.isBoss === true) return true;
        const def = INVADER_DEFS[inv.type as InvaderType];
        return def?.isBoss === true || (def as { isMiniBoss?: boolean })?.isMiniBoss === true;
      }),
    );

  it('stage 20 (Ch2 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 20)!;
    expect(hasBoss(s)).toBe(true);
  });

  it('stage 32 (Ch3 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 32)!;
    expect(hasBoss(s)).toBe(true);
  });

  it('stage 42 (Ch4 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 42)!;
    expect(hasBoss(s)).toBe(true);
  });

  it('stage 52 (Ch5 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 52)!;
    expect(hasBoss(s)).toBe(true);
  });

  it('stage 62 (Ch6 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 62)!;
    expect(hasBoss(s)).toBe(true);
  });

  it('stage 72 (Ch7 final) has a boss wave', () => {
    const s = ALL_STAGES.find(s => s.id === 72)!;
    expect(hasBoss(s)).toBe(true);
  });
});

// ─── CHAPTER_8 — per-stage wave counts and final boss ────────────────────────

describe('CHAPTER_8 — per-stage wave counts', () => {
  const s = (id: number) => CHAPTER_8.find(st => st.id === id)!;

  it('stages 73–76 each have exactly 10 waves', () => {
    for (const id of [73, 74, 75, 76]) {
      expect(s(id).waves.length, `stage ${id} wave count`).toBe(10);
    }
  });

  it('stages 77 and 78 each have exactly 12 waves', () => {
    expect(s(77).waves.length, 'stage 77').toBe(12);
    expect(s(78).waves.length, 'stage 78').toBe(12);
  });

  it('stage 79 (survival) has exactly 15 waves', () => {
    expect(s(79).waves.length).toBe(15);
  });

  it('stage 80 (final boss) has exactly 15 waves', () => {
    expect(s(80).waves.length).toBe(15);
  });

  it('stage 80 is the hardest Ch8 stage by dungeonHp', () => {
    const maxHp = Math.max(...CHAPTER_8.map(st => st.dungeonHp));
    expect(s(80).dungeonHp).toBe(maxHp);
    expect(s(80).dungeonHp).toBe(11000);
  });

  it('stage 73 (first Ch8 stage) has no primordial_guard invaders', () => {
    const allTypes = s(73).waves.flatMap(w => w.invaders.map(i => i.type));
    expect(allTypes).not.toContain('primordial_guard');
  });

  it('stage 78 (first to use primordial_guard) has primordial_guard in its waves', () => {
    const allTypes = s(78).waves.flatMap(w => w.invaders.map(i => i.type));
    expect(allTypes).toContain('primordial_guard');
  });
});

describe('CHAPTER_8 — primordial_titan final boss', () => {
  const stage80 = CHAPTER_8.find(s => s.id === 80)!;
  const finalWave = stage80.waves[stage80.waves.length - 1];

  it('stage 80 final wave (wave 15) contains exactly one primordial_titan', () => {
    const titans = finalWave.invaders.filter(i => i.type === 'primordial_titan');
    expect(titans).toHaveLength(1);
    expect(titans[0].count).toBe(1);
  });

  it('primordial_titan entry on wave 15 has isBoss = true', () => {
    const titan = finalWave.invaders.find(i => i.type === 'primordial_titan')!;
    expect(titan.isBoss).toBe(true);
  });

  it('primordial_titan is not present before wave 15 (only in final wave)', () => {
    const nonFinalWaves = stage80.waves.slice(0, -1);
    const titanInEarly = nonFinalWaves.flatMap(w => w.invaders).some(i => i.type === 'primordial_titan');
    expect(titanInEarly).toBe(false);
  });

  it('stage 80 wave 15 clearReward = 8000 (Ch8 finale)', () => {
    expect(finalWave.clearReward).toBe(8000);
  });

  it('Ch9 finale (stage 90) pays the highest clear reward in the game', () => {
    const allRewards = ALL_STAGES.flatMap(st => st.waves.map(w => w.clearReward ?? 0));
    const maxReward = Math.max(...allRewards);
    const stage90  = CHAPTER_9.find(s => s.id === 90)!;
    const s90Final = stage90.waves[stage90.waves.length - 1];
    expect(s90Final.clearReward).toBe(maxReward);
    expect(s90Final.clearReward).toBe(9500);
  });

  it('stage 80 wave 14 has primordial_guard with isBoss = true (penultimate boss wave)', () => {
    const wave14 = stage80.waves.find(w => w.wave === 14)!;
    const bossGuard = wave14.invaders.find(i => i.type === 'primordial_guard' && i.isBoss === true);
    expect(bossGuard).toBeDefined();
  });
});
