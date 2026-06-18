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

  it('wave 5 base count is 6 fillers (min(5 + floor(5/5), 20) = 6)', () => {
    // No milestone at wave 5 → exactly 6 entries
    const q = buildEndlessSpawnQueue(5);
    expect(q).toHaveLength(6);
  });

  it('wave 10 base count is 7 fillers + 1 milestone entry = 8 total', () => {
    // baseCount = min(5 + floor(10/5), 20) = 7; milestone adds 1 soldier entry
    const q = buildEndlessSpawnQueue(10);
    expect(q).toHaveLength(8);
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

  it('wave 25 adds an iron_golem champion (2× HP, isMiniBoss, delay=0)', () => {
    const q = buildEndlessSpawnQueue(25);
    const boss = q.find(e => e.def.type === 'iron_golem' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
    expect(boss!.delay).toBe(0);
    const base    = INVADER_DEFS['iron_golem'].hp;
    const hpMult  = Math.pow(1.12, 24);
    expect(boss!.def.hp).toBe(Math.round(base * hpMult * 2));
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

  it('wave 110 fires a rotated milestone — celestial sky_titan champion', () => {
    // (110-100)%10===0, ms=1 → 천상 강습 composition led by a sky_titan champion
    const q = buildEndlessSpawnQueue(110);
    expect(q.some(e => e.def.isMiniBoss === true)).toBe(true);
    expect(q.some(e => e.def.type === 'sky_titan' && e.def.isMiniBoss)).toBe(true);
  });

  it('post-100 milestones rotate through 4 distinct champions then wrap', () => {
    // Champion is the first isMiniBoss entry (milestone pushed before fillers).
    const champ = (w: number) => buildEndlessSpawnQueue(w).find(e => e.def.isMiniBoss)?.def.type;
    expect(champ(100)).toBe('primordial_guard'); // ms0 원초 군단 (unchanged)
    expect(champ(110)).toBe('sky_titan');        // ms1 천상 강습
    expect(champ(120)).toBe('void_colossus');    // ms2 거신 봉기
    expect(champ(130)).toBe('plague_herald');    // ms3 역병 쇄도
    expect(champ(140)).toBe('primordial_guard'); // wraps to ms0
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

  // ── T4 threshold (wave 30) ────────────────────────────────────────────────

  it('wave 29 never contains T4 types (void_assassin_elite excluded before wave 30)', () => {
    const types = typesInQueue(29);
    expect(types.has('void_assassin_elite'), 'wave 29 void_assassin_elite').toBe(false);
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

  // ── T5 threshold (wave 40) ────────────────────────────────────────────────

  it('wave 39 never contains T5 types (void_invader/undying_warrior excluded before wave 40)', () => {
    const types = typesInQueue(39);
    expect(types.has('void_invader'),     'wave 39 void_invader').toBe(false);
    expect(types.has('undying_warrior'),  'wave 39 undying_warrior').toBe(false);
  });

  // ── T6 threshold (wave 50) ────────────────────────────────────────────────

  it('wave 49 never contains T6 types (mirror_knight/void_colossus excluded before wave 50)', () => {
    const types = typesInQueue(49);
    expect(types.has('mirror_knight'),  'wave 49 mirror_knight').toBe(false);
    expect(types.has('void_colossus'),  'wave 49 void_colossus').toBe(false);
    expect(types.has('titan_sentinel'), 'wave 49 titan_sentinel').toBe(false);
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

  it('wave 20 mini-boss knight HP = round(350 × 1.12^19 × 0.5) = 1507', () => {
    const q = buildEndlessSpawnQueue(20);
    const boss = q.find(e => e.def.type === 'knight' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
    const expected = Math.round(INVADER_DEFS['knight'].hp * Math.pow(1.12, 19) * 0.5);
    expect(boss!.def.hp).toBe(expected);
  });
});

// ─── buildEndlessSpawnQueue — additional edge cases ──────────────────────────

describe('buildEndlessSpawnQueue — additional edge cases', () => {
  it('wave 4 never contains T1_LATE types (void/undying excluded before wave 5)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const q = buildEndlessSpawnQueue(4);
      for (const e of q) {
        expect(['void', 'undying'], `wave 4 should not spawn ${e.def.type}`).not.toContain(e.def.type);
      }
    }
  });

  it('wave 5 includes T1_LATE but still excludes T2 (berserker not in pool)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const q = buildEndlessSpawnQueue(5);
      for (const e of q) {
        expect(e.def.type).not.toBe('berserker');
      }
    }
  });

  it('standard filler entries all have delay exactly 1200ms', () => {
    // Wave 1 has no milestones, so every entry is a filler with delay=1200
    const q = buildEndlessSpawnQueue(1);
    for (const e of q) {
      expect(e.delay).toBe(1200);
    }
  });

  it('wave 100 total queue length = 3 milestone + 20 filler entries = 23', () => {
    const q = buildEndlessSpawnQueue(100);
    expect(q).toHaveLength(23);
  });

  it('wave 30 two void_assassin entries share the same def object reference', () => {
    const q = buildEndlessSpawnQueue(30);
    const assassins = q.filter(e => e.def.type === 'void_assassin' && e.def.isMiniBoss);
    expect(assassins).toHaveLength(2);
    expect(assassins[0].def).toBe(assassins[1].def); // same reference
  });

  it('wave 60 first milestone entry has delay=0 and second has delay=1500', () => {
    const q = buildEndlessSpawnQueue(60);
    const colossus = q.find(e => e.def.type === 'void_colossus');
    const titan    = q.find(e => e.def.type === 'titan_sentinel');
    expect(colossus).toBeDefined();
    expect(titan).toBeDefined();
    expect(colossus!.delay).toBe(0);
    expect(titan!.delay).toBe(1500);
  });
});

// ─── buildEndlessSpawnQueue — milestone delays & queue lengths ────────────────

describe('buildEndlessSpawnQueue — milestone delays & queue lengths', () => {
  it('wave 70: sky_titan delay=0 and radiant_seraph delay=1500', () => {
    const q = buildEndlessSpawnQueue(70);
    const skyTitan = q.find(e => e.def.type === 'sky_titan');
    const seraph   = q.find(e => e.def.type === 'radiant_seraph');
    expect(skyTitan).toBeDefined();
    expect(seraph).toBeDefined();
    expect(skyTitan!.delay).toBe(0);
    expect(seraph!.delay).toBe(1500);
  });

  it('wave 90 milestone loop injects exactly 3 void_soldier entries (delay=800)', () => {
    const q = buildEndlessSpawnQueue(90);
    // Milestone void_soldiers have delay=800; fillers use delay=1200
    const milestoneVoidSoldiers = q.filter(e => e.def.type === 'void_soldier' && e.delay === 800);
    expect(milestoneVoidSoldiers).toHaveLength(3);
  });

  it('wave 90 total queue length = 4 milestone + 20 filler = 24', () => {
    // baseCount = min(5 + floor(90/5), 20) = min(23, 20) = 20 fillers
    // milestone: 3 void_soldiers + 1 primordial_guard = 4
    expect(buildEndlessSpawnQueue(90)).toHaveLength(24);
  });

  it('wave 20 total queue length = 1 milestone + 9 filler = 10', () => {
    // baseCount = min(5 + floor(20/5), 20) = min(9, 20) = 9 fillers
    // milestone: 1 knight mini-boss
    expect(buildEndlessSpawnQueue(20)).toHaveLength(10);
  });

  it('wave 80 milestone order: abyss_berserker(delay=0), primordial_guard(delay=2000), abyss_berserker(delay=1500)', () => {
    const q = buildEndlessSpawnQueue(80);
    expect(q[0].def.type).toBe('abyss_berserker');
    expect(q[0].delay).toBe(0);
    expect(q[1].def.type).toBe('primordial_guard');
    expect(q[1].delay).toBe(2000);
    expect(q[2].def.type).toBe('abyss_berserker');
    expect(q[2].delay).toBe(1500);
  });

  it('every entry def.speed is a positive integer at wave 10', () => {
    const q = buildEndlessSpawnQueue(10);
    for (const { def } of q) {
      expect(def.speed, `${def.type} speed`).toBeGreaterThan(0);
      expect(Number.isInteger(def.speed), `${def.type} speed integer`).toBe(true);
    }
  });

  it('every entry def.reward is a positive integer at wave 25', () => {
    const q = buildEndlessSpawnQueue(25);
    for (const { def } of q) {
      expect(def.reward, `${def.type} reward`).toBeGreaterThan(0);
      expect(Number.isInteger(def.reward), `${def.type} reward integer`).toBe(true);
    }
  });
});

// ─── buildEndlessSpawnQueue — queue-length pins & HP formula spot-checks ─────

describe('buildEndlessSpawnQueue — queue-length pins & HP formula spot-checks', () => {
  it('wave 25 total queue length = 11 (1 milestone + 10 fillers)', () => {
    // baseCount = min(5 + floor(25/5), 20) = min(10, 20) = 10; + 1 iron_golem
    expect(buildEndlessSpawnQueue(25)).toHaveLength(11);
  });

  it('wave 30 total queue length = 13 (2 milestones + 11 fillers)', () => {
    // baseCount = min(5 + floor(30/5), 20) = min(11, 20) = 11; + 2 void_assassins
    expect(buildEndlessSpawnQueue(30)).toHaveLength(13);
  });

  it('wave 40 total queue length = 14 (1 milestone + 13 fillers)', () => {
    // baseCount = min(5 + floor(40/5), 20) = min(13, 20) = 13; + 1 void_assassin_elite
    expect(buildEndlessSpawnQueue(40)).toHaveLength(14);
  });

  it('wave 80 total queue length = 23 (3 milestones + 20 fillers)', () => {
    // baseCount = min(5 + floor(80/5), 20) = min(21, 20) = 20; + 3 milestone entries
    expect(buildEndlessSpawnQueue(80)).toHaveLength(23);
  });

  it('wave 30 first void_assassin delay=0, second void_assassin delay=1200', () => {
    const q = buildEndlessSpawnQueue(30);
    const assassins = q.filter(e => e.def.type === 'void_assassin' && e.def.isMiniBoss);
    expect(assassins[0].delay).toBe(0);
    expect(assassins[1].delay).toBe(1200);
  });

  it('wave 40 void_assassin_elite HP = round(base × 1.12^39 × 1.8)', () => {
    const q = buildEndlessSpawnQueue(40);
    const boss = q.find(e => e.def.type === 'void_assassin_elite' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
    const expected = Math.round(INVADER_DEFS['void_assassin_elite'].hp * Math.pow(1.12, 39) * 1.8);
    expect(boss!.def.hp).toBe(expected);
  });

  it('post-90 milestone (wave 100): primordial_guard delay=0, void_soldier+abyss_berserker delay=1200', () => {
    const q = buildEndlessSpawnQueue(100);
    const pg  = q.find(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss);
    const vs  = q.find(e => e.def.type === 'void_soldier' && !e.def.isMiniBoss);
    const ab  = q.find(e => e.def.type === 'abyss_berserker' && !e.def.isMiniBoss);
    expect(pg).toBeDefined();
    expect(pg!.delay).toBe(0);
    expect(vs).toBeDefined();
    expect(vs!.delay).toBe(1200);
    expect(ab).toBeDefined();
    expect(ab!.delay).toBe(1200);
  });
});

// ─── buildEndlessSpawnQueue — untested queue lengths & HP formula pins ────────

describe('buildEndlessSpawnQueue — additional length pins & HP formulas', () => {
  it('wave 9 total queue length = 6 (no milestone, baseCount = min(5+1,20) = 6)', () => {
    // floor(9/5) = 1 → baseCount = 6; no milestone at wave 9
    expect(buildEndlessSpawnQueue(9)).toHaveLength(6);
  });

  it('wave 50 total queue length = 16 (1 milestone + 15 fillers)', () => {
    // baseCount = min(5 + floor(50/5), 20) = min(15, 20) = 15; +1 titan_sentinel
    expect(buildEndlessSpawnQueue(50)).toHaveLength(16);
  });

  it('wave 60 total queue length = 19 (2 milestones + 17 fillers)', () => {
    // baseCount = min(5 + floor(60/5), 20) = min(17, 20) = 17; +void_colossus + titan_sentinel
    expect(buildEndlessSpawnQueue(60)).toHaveLength(19);
  });

  it('wave 70 total queue length = 21 (2 milestones + 19 fillers)', () => {
    // baseCount = min(5 + floor(70/5), 20) = min(19, 20) = 19; +sky_titan + radiant_seraph
    expect(buildEndlessSpawnQueue(70)).toHaveLength(21);
  });

  it('wave 50 titan_sentinel HP = round(base × 1.12^49 × 2)', () => {
    const q    = buildEndlessSpawnQueue(50);
    const boss = q.find(e => e.def.type === 'titan_sentinel' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
    const expected = Math.round(INVADER_DEFS['titan_sentinel'].hp * Math.pow(1.12, 49) * 2);
    expect(boss!.def.hp).toBe(expected);
  });

  it('wave 90 primordial_guard HP = round(base × 1.12^89 × 3)', () => {
    const q    = buildEndlessSpawnQueue(90);
    const boss = q.find(e => e.def.type === 'primordial_guard' && e.def.isMiniBoss);
    expect(boss).toBeDefined();
    const expected = Math.round(INVADER_DEFS['primordial_guard'].hp * Math.pow(1.12, 89) * 3);
    expect(boss!.def.hp).toBe(expected);
  });

  it('wave 1 entries all have reward equal to their INVADER_DEFS base reward (no scaling)', () => {
    // rwdMult at wave 1 = 1.08^0 = 1; Math.round(base * 1) = base
    const q = buildEndlessSpawnQueue(1);
    for (const entry of q) {
      const base = INVADER_DEFS[entry.def.type as InvaderType].reward;
      expect(entry.def.reward, `wave 1 ${entry.def.type} reward`).toBe(base);
    }
  });
});
