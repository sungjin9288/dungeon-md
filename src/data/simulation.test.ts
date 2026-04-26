import { describe, it, expect } from 'vitest';
import { calcDungeonDps, simulateDungeon, type SimResult } from './simulation';
import type { DungeonSlot } from './wisdom';
import type { WaveSpec } from './stages';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlot(
  monsterIds: (string | undefined)[] = [],
  trapIds:    (string | undefined)[] = [],
  hp = 200,
): DungeonSlot {
  return { monsterIds, trapIds, hp, maxHp: hp, roomLevel: 1 };
}

function makeWave(type: 'peasant' | 'knight' | 'soldier', count = 3): WaveSpec {
  return { invaders: [{ type, count, spawnDelay: 1200 }] };
}

// ─── calcDungeonDps ───────────────────────────────────────────────────────────

describe('calcDungeonDps', () => {
  it('returns 0 for empty slots', () => {
    expect(calcDungeonDps([], [])).toBe(0);
  });

  it('skips slots with hp <= 0', () => {
    const deadSlot = makeSlot(['dokkaebi_warrior'], [], 0);
    expect(calcDungeonDps([deadSlot], [])).toBe(0);
  });

  it('returns positive DPS for a slot with a known monster', () => {
    // dokkaebi_warrior: baseDamage=20, attackCooldown=1500ms → 20/(1.5) ≈ 13.33
    const slot = makeSlot(['dokkaebi_warrior']);
    expect(calcDungeonDps([slot], [])).toBeGreaterThan(0);
  });

  it('DPS matches formula: baseDamage / (cooldown/1000)', () => {
    const slot = makeSlot(['dokkaebi_warrior']);
    // 20 / 1.5 ≈ 13.33
    expect(calcDungeonDps([slot], [])).toBeCloseTo(20 / 1.5, 1);
  });

  it('adds trap DPS for known trap types', () => {
    const noTrap  = makeSlot([], []);
    const withTrap = makeSlot([], ['spike_trap']); // spike_trap = 5 DPS
    expect(calcDungeonDps([withTrap], []) - calcDungeonDps([noTrap], [])).toBeCloseTo(5, 5);
  });

  it('stacks DPS across multiple slots', () => {
    const s1 = makeSlot(['dokkaebi_warrior']);
    const s2 = makeSlot(['gumiho_guardian']);
    const combined = calcDungeonDps([s1, s2], []);
    expect(combined).toBeGreaterThan(calcDungeonDps([s1], []));
    expect(combined).toBeGreaterThan(calcDungeonDps([s2], []));
  });

  it('level > 1 monster contributes more DPS than level 1', () => {
    const slot = makeSlot(['dokkaebi_warrior']);
    const dpsLv1 = calcDungeonDps([slot], [{ id: 'dokkaebi_warrior', level: 1, xp: 0, spentSkills: {}, equippedSkills: [], skillPoints: 0, equipment: null }]);
    const dpsLv5 = calcDungeonDps([slot], [{ id: 'dokkaebi_warrior', level: 5, xp: 0, spentSkills: {}, equippedSkills: [], skillPoints: 0, equipment: null }]);
    expect(dpsLv5).toBeGreaterThan(dpsLv1);
  });

  it('monsters with attackCooldown=0 (passive types like gold_turtle) contribute 0 DPS', () => {
    const slot = makeSlot(['gold_turtle']);
    expect(calcDungeonDps([slot], [])).toBe(0);
  });

  it('unknown monster id contributes 0 DPS', () => {
    const slot = makeSlot(['completely_unknown_xyz']);
    expect(calcDungeonDps([slot], [])).toBe(0);
  });
});

// ─── simulateDungeon — structure ─────────────────────────────────────────────

describe('simulateDungeon — structure', () => {
  const strongSlot = makeSlot(['dokkaebi_warrior', 'gumiho_guardian']);
  const waves = [makeWave('peasant', 5), makeWave('soldier', 3)];

  it('returns a SimResult with all required fields', () => {
    const r = simulateDungeon([strongSlot], [], waves, 1000);
    expect(typeof r.totalDps).toBe('number');
    expect(Array.isArray(r.waveResults)).toBe(true);
    expect(typeof r.finalHp).toBe('number');
    expect(typeof r.startHp).toBe('number');
    expect(typeof r.winPct).toBe('number');
    expect(typeof r.worstWave).toBe('number');
    expect(typeof r.recommendation).toBe('string');
  });

  it('waveResults length equals number of input waves', () => {
    const r = simulateDungeon([strongSlot], [], waves, 1000);
    expect(r.waveResults).toHaveLength(waves.length);
  });

  it('each WaveSimResult has waveNum, invaderCount, difficulty', () => {
    const r = simulateDungeon([strongSlot], [], waves, 1000);
    for (const wr of r.waveResults) {
      expect(typeof wr.waveNum).toBe('number');
      expect(wr.invaderCount).toBeGreaterThan(0);
      expect(['easy', 'medium', 'hard', 'extreme']).toContain(wr.difficulty);
    }
  });

  it('waveNum is 1-indexed in order', () => {
    const r = simulateDungeon([strongSlot], [], waves, 1000);
    r.waveResults.forEach((wr, i) => expect(wr.waveNum).toBe(i + 1));
  });

  it('startHp matches the input', () => {
    const r = simulateDungeon([strongSlot], [], waves, 800);
    expect(r.startHp).toBe(800);
  });

  it('finalHp is never negative', () => {
    const r = simulateDungeon([], [], [makeWave('knight', 50)], 100);
    expect(r.finalHp).toBeGreaterThanOrEqual(0);
  });

  it('winPct is between 0 and 100', () => {
    const r = simulateDungeon([], [], [makeWave('knight', 50)], 100);
    expect(r.winPct).toBeGreaterThanOrEqual(0);
    expect(r.winPct).toBeLessThanOrEqual(100);
  });
});

// ─── simulateDungeon — difficulty & outcomes ──────────────────────────────────

describe('simulateDungeon — difficulty labels', () => {
  it('0 DPS against weak invaders → extreme difficulty', () => {
    // No monsters; invaders survive → low ratio → extreme
    const r = simulateDungeon([], [], [makeWave('knight', 3)], 1000);
    expect(r.waveResults[0].difficulty).toBe('extreme');
  });

  it('very high DPS kills all invaders → medium difficulty (ratio = 1.0)', () => {
    // ratio = totalHit / totalHp; when all are killed, totalHit == totalHp → ratio=1.0 → medium
    const slots = Array.from({ length: 6 }, () =>
      makeSlot(['dokkaebi_warrior', 'gumiho_guardian', 'white_tiger']),
    );
    const r = simulateDungeon(slots, [], [makeWave('peasant', 1)], 1000);
    expect(r.waveResults[0].difficulty).toBe('medium');
  });

  it('survived count is 0 when DPS kills all invaders', () => {
    const slots = Array.from({ length: 6 }, () =>
      makeSlot(['dokkaebi_warrior', 'gumiho_guardian', 'white_tiger']),
    );
    const r = simulateDungeon(slots, [], [makeWave('peasant', 1)], 1000);
    expect(r.waveResults[0].survived).toBe(0);
  });

  it('survived count > 0 when DPS is 0', () => {
    const r = simulateDungeon([], [], [makeWave('peasant', 3)], 1000);
    expect(r.waveResults[0].survived).toBe(3);
  });
});

// ─── simulateDungeon — recommendation strings ────────────────────────────────

describe('simulateDungeon — recommendations', () => {
  it('suggests placing monsters when totalDps < 8', () => {
    const r = simulateDungeon([], [], [makeWave('peasant', 1)], 1000);
    expect(r.recommendation).toContain('몬스터를 더 배치하세요');
  });

  it('reports 방어 불충분 when hp hits 0', () => {
    // massive wave wipes hp
    const r = simulateDungeon(
      [makeSlot(['dokkaebi_warrior'])],
      [],
      [makeWave('knight', 100)],
      50,
    );
    if (r.finalHp === 0) {
      expect(r.recommendation).toMatch(/방어 불충분|업그레이드/);
    }
  });

  it('recommendation is a non-empty string in all cases', () => {
    const cases: SimResult[] = [
      simulateDungeon([], [], [makeWave('peasant', 1)], 1000),
      simulateDungeon(
        Array.from({ length: 4 }, () => makeSlot(['dokkaebi_warrior', 'gumiho_guardian'])),
        [],
        [makeWave('peasant', 1)],
        1000,
      ),
    ];
    for (const r of cases) {
      expect(r.recommendation.length).toBeGreaterThan(0);
    }
  });
});
