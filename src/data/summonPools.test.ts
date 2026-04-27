import { describe, it, expect } from 'vitest';
import {
  SUMMON_TYPE_DEFS,
  RARITY_RATES,
  RARITIES,
  RARITY_STARS,
  RARITY_COLORS,
  RARITY_CSS,
  RARITY_KO,
  SC_COMP,
  RARITY_POOLS,
  rollRarity,
  type SummonType,
} from './summonPools';
import { MONSTER_DEFS } from './monsters';

// ─── SUMMON_TYPE_DEFS data integrity ─────────────────────────────────────────

describe('SUMMON_TYPE_DEFS', () => {
  it('contains exactly 4 summon types', () => {
    expect(SUMMON_TYPE_DEFS).toHaveLength(4);
  });

  it('ids are normal, special, soul, friendship', () => {
    const ids = SUMMON_TYPE_DEFS.map(d => d.id);
    expect(ids).toContain('normal');
    expect(ids).toContain('special');
    expect(ids).toContain('soul');
    expect(ids).toContain('friendship');
  });

  it('every type has a non-empty name, icon, and desc', () => {
    for (const d of SUMMON_TYPE_DEFS) {
      expect(d.name.length, `${d.id} name`).toBeGreaterThan(0);
      expect(d.icon.length, `${d.id} icon`).toBeGreaterThan(0);
      expect(d.desc.length, `${d.id} desc`).toBeGreaterThan(0);
    }
  });

  it('currency is gems, soul, or fp', () => {
    const valid = new Set(['gems', 'soul', 'fp']);
    for (const d of SUMMON_TYPE_DEFS) {
      expect(valid.has(d.currency), `${d.id} currency "${d.currency}"`).toBe(true);
    }
  });

  it('friendship summon has cost1 = 0 (free)', () => {
    const fp = SUMMON_TYPE_DEFS.find(d => d.id === 'friendship')!;
    expect(fp.cost1).toBe(0);
  });

  it('normal and special summons have cost1 > 0', () => {
    for (const id of ['normal', 'special'] as SummonType[]) {
      const d = SUMMON_TYPE_DEFS.find(t => t.id === id)!;
      expect(d.cost1, `${id} cost1`).toBeGreaterThan(0);
    }
  });

  it('hasPity is true for normal and special, false for others', () => {
    const normal  = SUMMON_TYPE_DEFS.find(d => d.id === 'normal')!;
    const special = SUMMON_TYPE_DEFS.find(d => d.id === 'special')!;
    const soul    = SUMMON_TYPE_DEFS.find(d => d.id === 'soul')!;
    expect(normal.hasPity).toBe(true);
    expect(special.hasPity).toBe(true);
    expect(soul.hasPity).toBe(false);
  });
});

// ─── RARITY_RATES data integrity ─────────────────────────────────────────────

describe('RARITY_RATES', () => {
  const types: SummonType[] = ['normal', 'special', 'soul', 'friendship'];

  it('every summon type has a rates array of length 5', () => {
    for (const t of types) {
      expect(RARITY_RATES[t], t).toHaveLength(5);
    }
  });

  it('rates sum to 100 for each summon type', () => {
    for (const t of types) {
      const sum = RARITY_RATES[t].reduce((a, b) => a + b, 0);
      expect(sum, `${t} rates sum`).toBeCloseTo(100, 1);
    }
  });

  it('every individual rate is non-negative', () => {
    for (const t of types) {
      for (const rate of RARITY_RATES[t]) {
        expect(rate, t).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('friendship rates have 0 chance for rare, epic, legendary', () => {
    const [, , rare, epic, leg] = RARITY_RATES['friendship'];
    expect(rare).toBe(0);
    expect(epic).toBe(0);
    expect(leg).toBe(0);
  });

  it('special summon legendary rate > normal summon legendary rate', () => {
    const legSpecial = RARITY_RATES['special'][4];
    const legNormal  = RARITY_RATES['normal'][4];
    expect(legSpecial).toBeGreaterThan(legNormal);
  });
});

// ─── Rarity lookup arrays ─────────────────────────────────────────────────────

describe('rarity lookup arrays', () => {
  it('RARITIES has 5 entries in ascending order', () => {
    expect(RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  it('RARITY_STARS, RARITY_COLORS, RARITY_CSS, RARITY_KO, SC_COMP all have 5 entries', () => {
    expect(RARITY_STARS).toHaveLength(5);
    expect(RARITY_COLORS).toHaveLength(5);
    expect(RARITY_CSS).toHaveLength(5);
    expect(RARITY_KO).toHaveLength(5);
    expect(SC_COMP).toHaveLength(5);
  });

  it('SC_COMP (soul crystal compensation) strictly increases with rarity', () => {
    for (let i = 1; i < SC_COMP.length; i++) {
      expect(SC_COMP[i]).toBeGreaterThan(SC_COMP[i - 1]);
    }
  });

  it('RARITY_CSS values are hex color strings', () => {
    for (const css of RARITY_CSS) {
      expect(css).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── RARITY_POOLS data integrity ─────────────────────────────────────────────

describe('RARITY_POOLS', () => {
  it('has pools for all 5 rarities', () => {
    expect(RARITY_POOLS['common']).toBeDefined();
    expect(RARITY_POOLS['uncommon']).toBeDefined();
    expect(RARITY_POOLS['rare']).toBeDefined();
    expect(RARITY_POOLS['epic']).toBeDefined();
    expect(RARITY_POOLS['legendary']).toBeDefined();
  });

  it('common pool has at least 1 monster', () => {
    expect(RARITY_POOLS['common'].length).toBeGreaterThanOrEqual(1);
  });

  it('rare pool is the largest pool', () => {
    const sizes = {
      common:    RARITY_POOLS['common'].length,
      uncommon:  RARITY_POOLS['uncommon'].length,
      rare:      RARITY_POOLS['rare'].length,
      epic:      RARITY_POOLS['epic'].length,
      legendary: RARITY_POOLS['legendary'].length,
    };
    expect(sizes.rare).toBeGreaterThan(sizes.common);
    expect(sizes.rare).toBeGreaterThan(sizes.uncommon);
  });

  it('no id appears in more than one pool', () => {
    const seen = new Set<string>();
    for (const [rarity, pool] of Object.entries(RARITY_POOLS)) {
      for (const id of pool) {
        expect(seen.has(id), `"${id}" appears twice (rarity: ${rarity})`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('dokkaebi_warrior is in the common pool', () => {
    expect(RARITY_POOLS['common']).toContain('dokkaebi_warrior');
  });

  it('mountain_god is in the legendary pool', () => {
    expect(RARITY_POOLS['legendary']).toContain('mountain_god');
  });
});

// ─── rollRarity ───────────────────────────────────────────────────────────────

describe('rollRarity', () => {
  it('returns an index in range [0, rates.length - 1]', () => {
    const rates = [50, 28, 16, 4.5, 1.5];
    for (let i = 0; i < 50; i++) {
      const idx = rollRarity(rates);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(rates.length);
    }
  });

  it('always returns 0 when first rate is 100', () => {
    const rates = [100, 0, 0, 0, 0];
    for (let i = 0; i < 20; i++) {
      expect(rollRarity(rates)).toBe(0);
    }
  });

  it('always returns the last index when all weight is on it', () => {
    const rates = [0, 0, 0, 0, 100];
    for (let i = 0; i < 20; i++) {
      expect(rollRarity(rates)).toBe(4);
    }
  });

  it('friendship pool never rolls rare/epic/legendary (rates=0)', () => {
    // friendship: [55, 45, 0, 0, 0] — run many trials, never get index >= 2
    for (let i = 0; i < 100; i++) {
      const idx = rollRarity(RARITY_RATES['friendship']);
      expect(idx, 'friendship roll must be 0 or 1').toBeLessThanOrEqual(1);
    }
  });

  it('produces a mix of indices over many trials when rates are balanced', () => {
    const rates = [20, 20, 20, 20, 20];
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 500; i++) counts[rollRarity(rates)]++;
    // Every bucket should fire at least once in 500 trials
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
    }
  });
});

// ─── RARITY_POOLS × MONSTER_DEFS — cross-reference ────────────────────────────

describe('RARITY_POOLS × MONSTER_DEFS — no orphan pool entries', () => {
  it('every monster id in any rarity pool exists in MONSTER_DEFS', () => {
    for (const [rarity, pool] of Object.entries(RARITY_POOLS)) {
      for (const id of pool) {
        expect(
          MONSTER_DEFS[id as keyof typeof MONSTER_DEFS],
          `RARITY_POOLS["${rarity}"] references unknown monsterId "${id}"`,
        ).toBeDefined();
      }
    }
  });

  it('all 5 rarities have at least 1 pool member', () => {
    for (const rarity of RARITIES) {
      expect(
        RARITY_POOLS[rarity].length,
        `RARITY_POOLS["${rarity}"] is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('legendary pool has at least 3 entries', () => {
    expect(RARITY_POOLS['legendary'].length).toBeGreaterThanOrEqual(3);
  });

  it('total monsters across all pools is at least 30', () => {
    const total = Object.values(RARITY_POOLS).reduce((s, pool) => s + pool.length, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });
});
