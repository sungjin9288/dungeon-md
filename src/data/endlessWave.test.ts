import { describe, it, expect } from 'vitest';
import { buildEndlessSpawnQueue } from './endlessWave';
import { INVADER_DEFS, type InvaderType } from './invaders';

// ─── buildEndlessSpawnQueue — basic structure ─────────────────────────────────

describe('buildEndlessSpawnQueue — structure', () => {
  it('returns a non-empty array for wave 1', () => {
    const q = buildEndlessSpawnQueue(1);
    expect(q.length).toBeGreaterThan(0);
  });

  it('every entry has a def and a delay', () => {
    const q = buildEndlessSpawnQueue(1);
    for (const entry of q) {
      expect(entry.def).toBeDefined();
      expect(typeof entry.delay).toBe('number');
    }
  });

  it('every def.type is a known InvaderType', () => {
    const q = buildEndlessSpawnQueue(5);
    for (const { def } of q) {
      expect(INVADER_DEFS[def.type as InvaderType], `unknown type "${def.type}"`).toBeDefined();
    }
  });

  it('all delays are non-negative', () => {
    const q = buildEndlessSpawnQueue(1);
    for (const { delay } of q) {
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  it('every def.hp is a positive integer', () => {
    const q = buildEndlessSpawnQueue(10);
    for (const { def } of q) {
      expect(def.hp).toBeGreaterThan(0);
      expect(Number.isInteger(def.hp)).toBe(true);
    }
  });
});

// ─── buildEndlessSpawnQueue — pool expansion ──────────────────────────────────

describe('buildEndlessSpawnQueue — pool expansion', () => {
  it('wave 1 only uses T1 types (peasant, soldier, knight, shaman)', () => {
    const allowed = new Set<InvaderType>(['peasant', 'soldier', 'knight', 'shaman']);
    // Run many times to cover randomness
    for (let trial = 0; trial < 10; trial++) {
      const q = buildEndlessSpawnQueue(1);
      for (const { def } of q) {
        expect(allowed.has(def.type as InvaderType), `unexpected type "${def.type}" in wave 1`).toBe(true);
      }
    }
  });

  it('wave 5+ can include void and undying (T1_LATE)', () => {
    // Not guaranteed per call, but T1_LATE is in pool from wave 5
    // We verify the call doesn't throw and types are valid
    const q = buildEndlessSpawnQueue(5);
    expect(q.length).toBeGreaterThan(0);
    const validAtW5 = new Set<InvaderType>(['peasant', 'soldier', 'knight', 'shaman', 'void', 'undying']);
    for (const { def } of q) {
      expect(validAtW5.has(def.type as InvaderType), `type "${def.type}" not valid at wave 5`).toBe(true);
    }
  });

  it('wave 1 base count is 5 (min(5 + 1/5, 20) = 5)', () => {
    // baseCount = Math.min(5 + Math.floor(1/5), 20) = 5
    // No milestone entry at wave 1, so exactly 5 fillers
    const q = buildEndlessSpawnQueue(1);
    expect(q).toHaveLength(5);
  });

  it('count grows with wave number (wave 50 > wave 1)', () => {
    const q1  = buildEndlessSpawnQueue(1);
    const q50 = buildEndlessSpawnQueue(50);
    expect(q50.length).toBeGreaterThanOrEqual(q1.length);
  });

  it('count is capped at 20 filler entries (+ milestone extras)', () => {
    // wave 100: baseCount = min(5 + 20, 20) = 20 fillers + milestone entries
    const q = buildEndlessSpawnQueue(100);
    // milestone at wave 100 (w > 90 && (w-90)%10===0): +3 milestone entries
    expect(q.length).toBeLessThanOrEqual(25); // well under any runaway growth
  });
});

// ─── buildEndlessSpawnQueue — hp / speed scaling ─────────────────────────────

describe('buildEndlessSpawnQueue — stat scaling', () => {
  it('wave 10 peasant hp > wave 1 peasant hp (1.12× per wave)', () => {
    // find a 'peasant' entry if any, otherwise confirm all hps are scaled
    const base = INVADER_DEFS['peasant'].hp;
    const q10  = buildEndlessSpawnQueue(10);
    // At wave 10 the pool still includes peasant; if one appears, its hp must be scaled
    for (const { def } of q10) {
      if (def.type === 'peasant') {
        expect(def.hp).toBeGreaterThan(base);
      }
    }
    // Even if no peasant drew, the queue itself is non-empty
    expect(q10.length).toBeGreaterThan(0);
  });

  it('knight hp is scaled up at wave 50 vs wave 1 base', () => {
    const baseHp = INVADER_DEFS['knight'].hp;
    const hpMult = Math.pow(1.12, 50 - 1);
    const expectedScaled = Math.round(baseHp * hpMult);
    // Make a large wave to ensure knight shows up eventually
    // Instead, verify that if knight appears its hp is correctly scaled
    for (let trial = 0; trial < 5; trial++) {
      const q = buildEndlessSpawnQueue(50);
      for (const { def } of q) {
        if (def.type === 'knight') {
          // Scaled hp should be much greater than base
          expect(def.hp).toBeGreaterThan(baseHp * 10);
          expect(def.hp).toBeCloseTo(expectedScaled, -2); // within ~100
        }
      }
    }
  });
});

// ─── buildEndlessSpawnQueue — milestone waves ─────────────────────────────────

describe('buildEndlessSpawnQueue — milestone waves', () => {
  it('wave 10 adds an elite soldier at the front', () => {
    const q = buildEndlessSpawnQueue(10);
    expect(q[0].def.type).toBe('soldier');
    // Elite: hp boosted 1.5× on top of normal scaling
    const base   = INVADER_DEFS['soldier'].hp;
    const hpMult = Math.pow(1.12, 9);
    expect(q[0].def.hp).toBeCloseTo(Math.round(base * hpMult * 1.5), -1);
    expect(q[0].delay).toBe(2000);
  });

  it('wave 20 adds a mini-boss knight at the front', () => {
    const q = buildEndlessSpawnQueue(20);
    expect(q[0].def.type).toBe('knight');
    expect(q[0].def.isMiniBoss).toBe(true);
    expect(q[0].delay).toBe(0);
  });

  it('wave 30 adds two mini-boss void_assassins', () => {
    const q = buildEndlessSpawnQueue(30);
    const bossEntries = q.filter(e => e.def.type === 'void_assassin' && e.def.isMiniBoss);
    expect(bossEntries).toHaveLength(2);
  });

  it('wave 50 adds a titan_sentinel mini-boss', () => {
    const q = buildEndlessSpawnQueue(50);
    const boss = q.find(e => e.def.type === 'titan_sentinel' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
  });

  it('wave 80 has a primordial_guard champion flanked by abyss_berserkers', () => {
    const q = buildEndlessSpawnQueue(80);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(true);
    expect(q.filter(e => e.def.type === 'abyss_berserker').length).toBeGreaterThanOrEqual(2);
  });

  it('non-milestone wave has no isMiniBoss entry in fillers', () => {
    // wave 2 has no milestone — all entries are plain fillers
    const q = buildEndlessSpawnQueue(2);
    for (const { def } of q) {
      expect(def.isMiniBoss ?? false, `wave 2 should have no mini-boss`).toBe(false);
    }
  });

  it('wave 40 adds a void_assassin_elite mini-boss', () => {
    const q = buildEndlessSpawnQueue(40);
    expect(q.some(e => e.def.type === 'void_assassin_elite' && e.def.isMiniBoss)).toBe(true);
  });

  it('wave 60 has a void_colossus and a titan_sentinel mini-boss pair', () => {
    const q = buildEndlessSpawnQueue(60);
    expect(q.some(e => e.def.type === 'void_colossus'  && e.def.isMiniBoss)).toBe(true);
    expect(q.some(e => e.def.type === 'titan_sentinel' && e.def.isMiniBoss)).toBe(true);
  });

  it('wave 70 has a sky_titan and a radiant_seraph elite pair', () => {
    const q = buildEndlessSpawnQueue(70);
    expect(q.some(e => e.def.type === 'sky_titan'      && e.def.isMiniBoss)).toBe(true);
    expect(q.some(e => e.def.type === 'radiant_seraph' && e.def.isMiniBoss)).toBe(true);
  });

  it('wave 90 has a primordial_guard champion and at least one void_soldier', () => {
    const q = buildEndlessSpawnQueue(90);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(true);
    expect(q.some(e => e.def.type === 'void_soldier')).toBe(true);
  });

  it('post-90 milestone fires every 10 waves (wave 100 has a primordial_guard)', () => {
    // (100 - 90) % 10 === 0 → milestone fires
    const q = buildEndlessSpawnQueue(100);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(true);
  });

  it('wave 101 does NOT fire the post-90 milestone', () => {
    // (101 - 90) % 10 === 1 ≠ 0 → no milestone
    const q = buildEndlessSpawnQueue(101);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(false);
  });

  it('wave 110 fires the post-90 milestone (wave 110 has primordial_guard)', () => {
    // (110 - 90) % 10 === 0 → milestone fires
    const q = buildEndlessSpawnQueue(110);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(true);
  });

  it('waves 20–90 (all mini-boss milestones) each add at least one isMiniBoss entry', () => {
    // Wave 10 only adds an elite soldier (no isMiniBoss flag); 20+ all use isMiniBoss
    const milestones = [20, 25, 30, 40, 50, 60, 70, 80, 90];
    for (const w of milestones) {
      const q = buildEndlessSpawnQueue(w);
      expect(q.some(e => e.def.isMiniBoss === true), `wave ${w} has no isMiniBoss`).toBe(true);
    }
  });
});

// ─── buildEndlessSpawnQueue — pool tier thresholds ────────────────────────────
//
// Pool expansion is deterministic: buildPool(w) never includes T(n) types
// before the threshold wave.  Negative tests below are therefore guaranteed
// regardless of the random filler selection.
//
// Positive (type IS present) tests rely on milestone injections that hard-code
// specific T2/T7/T8 types, making them equally deterministic.

describe('buildEndlessSpawnQueue — pool tier thresholds', () => {
  const typesInQueue = (wave: number): Set<string> =>
    new Set(buildEndlessSpawnQueue(wave).map(e => e.def.type));

  // ── T2 threshold (wave 10) ────────────────────────────────────────────────

  it('wave 9 never contains T2 types (pool excludes them)', () => {
    const types = typesInQueue(9);
    expect(types.has('berserker'),  'wave 9 berserker').toBe(false);
    expect(types.has('iron_golem'), 'wave 9 iron_golem').toBe(false);
    expect(types.has('trap_breaker'), 'wave 9 trap_breaker').toBe(false);
  });

  // Positive: wave 25 milestone hard-injects iron_golem (T2) — deterministic
  it('wave 25 milestone confirms iron_golem (T2) is reachable after wave 10', () => {
    const q = buildEndlessSpawnQueue(25);
    expect(q.some(e => e.def.type === 'iron_golem' && e.def.isMiniBoss)).toBe(true);
  });

  // ── T3 threshold (wave 20) ────────────────────────────────────────────────

  it('wave 19 never contains T3 types (pool excludes them)', () => {
    const types = typesInQueue(19);
    expect(types.has('undying_knight'), 'wave 19 undying_knight').toBe(false);
    expect(types.has('void_assassin'),  'wave 19 void_assassin').toBe(false);
    expect(types.has('scarecrow_mage'), 'wave 19 scarecrow_mage').toBe(false);
  });

  // Positive: wave 30 milestone hard-injects void_assassin (T3) — deterministic
  it('wave 30 milestone confirms void_assassin (T3) is reachable after wave 20', () => {
    const q = buildEndlessSpawnQueue(30);
    expect(q.some(e => e.def.type === 'void_assassin' && e.def.isMiniBoss)).toBe(true);
  });

  // ── T7 threshold (wave 60) ────────────────────────────────────────────────

  it('wave 59 never contains T7 types (pool excludes them)', () => {
    const types = typesInQueue(59);
    expect(types.has('celestial_knight'), 'wave 59 celestial_knight').toBe(false);
    expect(types.has('sky_titan'),        'wave 59 sky_titan').toBe(false);
    expect(types.has('radiant_seraph'),   'wave 59 radiant_seraph').toBe(false);
  });

  // Positive: wave 70 milestone hard-injects sky_titan + radiant_seraph (T7) — deterministic
  it('wave 70 milestone confirms sky_titan and radiant_seraph (T7) reachable after wave 60', () => {
    const q = buildEndlessSpawnQueue(70);
    expect(q.some(e => e.def.type === 'sky_titan'      && e.def.isMiniBoss)).toBe(true);
    expect(q.some(e => e.def.type === 'radiant_seraph' && e.def.isMiniBoss)).toBe(true);
  });

  // ── T8 threshold (wave 70) ────────────────────────────────────────────────

  it('wave 69 never contains T8 types (pool excludes them)', () => {
    const types = typesInQueue(69);
    expect(types.has('void_soldier'),     'wave 69 void_soldier').toBe(false);
    expect(types.has('abyss_berserker'),  'wave 69 abyss_berserker').toBe(false);
    expect(types.has('primordial_guard'), 'wave 69 primordial_guard').toBe(false);
  });

  // Positive: wave 80 milestone hard-injects abyss_berserker + primordial_guard (T8) — deterministic
  it('wave 80 milestone confirms abyss_berserker and primordial_guard (T8) reachable after wave 70', () => {
    const q = buildEndlessSpawnQueue(80);
    expect(q.some(e => e.def.type === 'abyss_berserker'  && e.def.isMiniBoss)).toBe(true);
    expect(q.some(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss)).toBe(true);
  });

  // ── Speed and reward scaling formulas ─────────────────────────────────────
  //
  // Wave 1: speedMult = 1.03^0 = 1 → every entry's speed equals its base speed.
  // This is deterministic: all entries are T1 fillers, Math.round(x * 1) = x.

  it('wave 1 queue entries have speed equal to their base speed (no scaling)', () => {
    const q = buildEndlessSpawnQueue(1);
    for (const entry of q) {
      const base = INVADER_DEFS[entry.def.type as InvaderType].speed;
      expect(entry.def.speed, `wave 1 ${entry.def.type} speed`).toBe(base);
    }
  });

  // Wave 10 milestone soldier (delay=2000) is deterministic — speed and reward both scaled.

  it('wave 10 milestone soldier speed = Math.round(base × 1.03^9)', () => {
    const q = buildEndlessSpawnQueue(10);
    const soldier = q.find(e => e.def.type === 'soldier' && e.delay === 2000);
    expect(soldier).toBeDefined();
    const expected = Math.round(INVADER_DEFS['soldier'].speed * Math.pow(1.03, 9));
    expect(soldier!.def.speed).toBe(expected);
  });

  it('wave 10 milestone soldier reward = Math.round(base × 1.08^9)', () => {
    const q = buildEndlessSpawnQueue(10);
    const soldier = q.find(e => e.def.type === 'soldier' && e.delay === 2000);
    expect(soldier).toBeDefined();
    const expected = Math.round(INVADER_DEFS['soldier'].reward * Math.pow(1.08, 9));
    expect(soldier!.def.reward).toBe(expected);
  });
});
