import { describe, it, expect } from 'vitest';
import {
  WEEKLY_BOSS_PHASE_MODS,
  getWeeklyBossPhase,
  getWeeklyBossPhaseMod,
} from './weeklyBossPhases';
import { WEEKLY_BOSS_POOL, getWeeklyBoss } from './daily';
import { INVADER_DEFS } from './invaders';

// ─── getWeeklyBossPhase — 5-phase boundaries ──────────────────────────────────

describe('getWeeklyBossPhase — 5-phase boundaries (totalHp 100)', () => {
  const TOTAL = 100;
  const PHASES = 5;

  it.each([
    [100, 1], [81, 1],          // (80%, 100%] → phase 1
    [80, 2],  [61, 2],          // (60%, 80%]  → phase 2
    [60, 3],  [41, 3],          // (40%, 60%]  → phase 3
    [40, 4],  [21, 4],          // (20%, 40%]  → phase 4
    [20, 5],  [1, 5],  [0, 5],  // [0%, 20%]   → phase 5
  ])('hp %i → phase %i', (hp, expected) => {
    expect(getWeeklyBossPhase(hp, TOTAL, PHASES)).toBe(expected);
  });

  it('hp above totalHp (overheal) stays in phase 1', () => {
    expect(getWeeklyBossPhase(150, TOTAL, PHASES)).toBe(1);
  });

  it('negative hp clamps to the final phase', () => {
    expect(getWeeklyBossPhase(-50, TOTAL, PHASES)).toBe(PHASES);
  });

  it('phase never decreases as hp drops (monotonic)', () => {
    let prev = 1;
    for (let hp = TOTAL; hp >= 0; hp--) {
      const phase = getWeeklyBossPhase(hp, TOTAL, PHASES);
      expect(phase).toBeGreaterThanOrEqual(prev);
      prev = phase;
    }
    expect(prev).toBe(PHASES);
  });

  it('works with real pool HP values (50000 totalHp)', () => {
    expect(getWeeklyBossPhase(50_000, 50_000, 5)).toBe(1);
    expect(getWeeklyBossPhase(40_000, 50_000, 5)).toBe(2);
    expect(getWeeklyBossPhase(10_000, 50_000, 5)).toBe(5);
    expect(getWeeklyBossPhase(10_001, 50_000, 5)).toBe(4);
  });
});

describe('getWeeklyBossPhase — generic phase counts & invalid input', () => {
  it('phases=3 splits HP into thirds', () => {
    expect(getWeeklyBossPhase(100, 90, 3)).toBe(1);  // overheal
    expect(getWeeklyBossPhase(90, 90, 3)).toBe(1);
    expect(getWeeklyBossPhase(60, 90, 3)).toBe(2);
    expect(getWeeklyBossPhase(30, 90, 3)).toBe(3);
  });

  it('phases=1 always returns 1', () => {
    expect(getWeeklyBossPhase(100, 100, 1)).toBe(1);
    expect(getWeeklyBossPhase(1, 100, 1)).toBe(1);
  });

  it('non-positive totalHp falls back to phase 1', () => {
    expect(getWeeklyBossPhase(50, 0, 5)).toBe(1);
    expect(getWeeklyBossPhase(50, -10, 5)).toBe(1);
  });

  it('non-positive or non-finite phases falls back to phase 1', () => {
    expect(getWeeklyBossPhase(50, 100, 0)).toBe(1);
    expect(getWeeklyBossPhase(50, 100, -2)).toBe(1);
    expect(getWeeklyBossPhase(50, 100, NaN)).toBe(1);
  });

  it('non-finite totalHp falls back to phase 1', () => {
    expect(getWeeklyBossPhase(50, NaN, 5)).toBe(1);
    expect(getWeeklyBossPhase(50, Infinity, 5)).toBe(1);
  });
});

// ─── WEEKLY_BOSS_PHASE_MODS — escalation table ────────────────────────────────

describe('WEEKLY_BOSS_PHASE_MODS', () => {
  it('has exactly 5 entries with 1-based phase indices in order', () => {
    expect(WEEKLY_BOSS_PHASE_MODS).toHaveLength(5);
    WEEKLY_BOSS_PHASE_MODS.forEach((mod, i) => expect(mod.phase).toBe(i + 1));
  });

  it('phase 1 is the neutral spawn state (no speed-up, no summons, no banner)', () => {
    const p1 = WEEKLY_BOSS_PHASE_MODS[0];
    expect(p1.speedMult).toBe(1.0);
    expect(p1.summonCount).toBe(0);
    expect(p1.banner).toBe('');
  });

  it('speedMult is ≥ 1 and strictly increases from phase 2 on', () => {
    for (let i = 0; i < WEEKLY_BOSS_PHASE_MODS.length; i++) {
      expect(WEEKLY_BOSS_PHASE_MODS[i].speedMult).toBeGreaterThanOrEqual(1);
      if (i > 0) {
        expect(WEEKLY_BOSS_PHASE_MODS[i].speedMult)
          .toBeGreaterThan(WEEKLY_BOSS_PHASE_MODS[i - 1].speedMult);
      }
    }
  });

  it('phases 2–5 each have a non-empty Korean banner and at least 1 summon', () => {
    for (const mod of WEEKLY_BOSS_PHASE_MODS.slice(1)) {
      expect(mod.banner.length).toBeGreaterThan(0);
      expect(mod.summonCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('every summonType is a valid INVADER_DEFS entry', () => {
    for (const mod of WEEKLY_BOSS_PHASE_MODS) {
      expect(INVADER_DEFS[mod.summonType]).toBeDefined();
    }
  });

  it('summoned escorts are never bosses (no recursive boss spawns)', () => {
    for (const mod of WEEKLY_BOSS_PHASE_MODS) {
      const def = INVADER_DEFS[mod.summonType];
      expect(def.isBoss).not.toBe(true);
      expect(def.isMiniBoss).not.toBe(true);
    }
  });

  it('final phase speedMult stays within a sane raid range (≤ 2×)', () => {
    const last = WEEKLY_BOSS_PHASE_MODS[WEEKLY_BOSS_PHASE_MODS.length - 1];
    expect(last.speedMult).toBeLessThanOrEqual(2);
  });
});

// ─── getWeeklyBossPhaseMod — clamped lookup ───────────────────────────────────

describe('getWeeklyBossPhaseMod', () => {
  it('returns the matching entry for phases 1–5', () => {
    for (let p = 1; p <= 5; p++) {
      expect(getWeeklyBossPhaseMod(p).phase).toBe(p);
    }
  });

  it('clamps out-of-range phases to the nearest defined entry', () => {
    expect(getWeeklyBossPhaseMod(0).phase).toBe(1);
    expect(getWeeklyBossPhaseMod(-3).phase).toBe(1);
    expect(getWeeklyBossPhaseMod(99).phase).toBe(5);
  });
});

// ─── WEEKLY_BOSS_POOL ↔ INVADER_DEFS integration ──────────────────────────────

describe('WEEKLY_BOSS_POOL — invader def integration', () => {
  it('has exactly 9 entries', () => {
    expect(WEEKLY_BOSS_POOL).toHaveLength(9);
  });

  it('every bossType exists in INVADER_DEFS and is a boss or mini-boss', () => {
    for (const entry of WEEKLY_BOSS_POOL) {
      const def = INVADER_DEFS[entry.bossType];
      expect(def, entry.bossType).toBeDefined();
      expect(def.isBoss === true || def.isMiniBoss === true, entry.bossType).toBe(true);
    }
  });

  it('every pool hp is raid-scale: at least 10× the base def hp', () => {
    for (const entry of WEEKLY_BOSS_POOL) {
      const def = INVADER_DEFS[entry.bossType];
      expect(entry.hp, entry.bossType).toBeGreaterThanOrEqual(def.hp * 10);
    }
  });

  it('pool hp values stay within the documented 40k–220k band', () => {
    for (const entry of WEEKLY_BOSS_POOL) {
      expect(entry.hp).toBeGreaterThanOrEqual(40_000);
      expect(entry.hp).toBeLessThanOrEqual(220_000);  // raised for Ch9 void_sovereign (10× base 22k)
    }
  });

  it('getWeeklyBoss().totalHp matches its pool entry for the current week', () => {
    const boss = getWeeklyBoss();
    const entry = WEEKLY_BOSS_POOL[boss.weekIndex % WEEKLY_BOSS_POOL.length];
    expect(boss.totalHp).toBe(entry.hp);
    expect(boss.bossType).toBe(entry.bossType);
    expect(boss.name).toBe(entry.name);
  });
});
