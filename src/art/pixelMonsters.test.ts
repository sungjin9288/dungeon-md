import { describe, it, expect } from 'vitest';
import {
  TRIBE_PALETTES,
  getRarityPalette,
  getMonsterSpriteData,
  type Palette,
} from './PixelMonsters';
import {
  composeSilhouette,
  MONSTER_RECIPES,
  HEADS,
  BODIES,
  ACCESSORIES,
} from './SilhouetteData';
import type { TribeId } from '../data/monsters';

// ─── TRIBE_PALETTES ───────────────────────────────────────────────────────────

describe('TRIBE_PALETTES', () => {
  const ALL_TRIBES: TribeId[] = [
    'dokkaebi', 'gumiho', 'dragon', 'underworld',
    'sansin', 'sea', 'mask', 'moonlight', 'celestial',
  ];

  it('has an entry for all 9 tribes', () => {
    for (const tribe of ALL_TRIBES) {
      expect(TRIBE_PALETTES[tribe], `missing ${tribe}`).toBeDefined();
    }
  });

  it('every palette has exactly 6 colour slots', () => {
    for (const [tribe, palette] of Object.entries(TRIBE_PALETTES)) {
      expect(palette, `${tribe} palette length`).toHaveLength(6);
    }
  });

  it('index 0 (transparent) is 0x000000 for every tribe', () => {
    for (const [tribe, palette] of Object.entries(TRIBE_PALETTES)) {
      expect(palette[0], `${tribe} transparent`).toBe(0x000000);
    }
  });

  it('every non-transparent slot is a positive integer', () => {
    for (const [tribe, palette] of Object.entries(TRIBE_PALETTES)) {
      for (let i = 1; i < palette.length; i++) {
        expect(typeof palette[i], `${tribe}[${i}]`).toBe('number');
        expect(palette[i], `${tribe}[${i}]`).toBeGreaterThan(0);
      }
    }
  });

  it('tribe palettes are distinct (no two tribes share identical palette)', () => {
    const serialized = Object.values(TRIBE_PALETTES).map(p => JSON.stringify(p));
    expect(new Set(serialized).size).toBe(serialized.length);
  });
});

// ─── getRarityPalette ─────────────────────────────────────────────────────────

describe('getRarityPalette', () => {
  const BASE: Palette = [0x000000, 0x4a0000, 0xcc3300, 0xff6600, 0xffaa44, 0x220000];

  it('common (C) returns the base palette unchanged', () => {
    expect(getRarityPalette(BASE, 'C')).toStrictEqual(BASE);
  });

  it('undefined rarity defaults to C (no shift)', () => {
    expect(getRarityPalette(BASE, undefined)).toStrictEqual(BASE);
  });

  it('legendary (L) returns a palette different from base', () => {
    const result = getRarityPalette(BASE, 'L');
    expect(result).not.toStrictEqual(BASE);
  });

  it('index 0 (transparent) is always preserved as 0x000000', () => {
    for (const rarity of ['C', 'U', 'R', 'E', 'L']) {
      const result = getRarityPalette(BASE, rarity);
      expect(result[0], `${rarity} transparent`).toBe(0x000000);
    }
  });

  it('higher rarity shifts produce brighter colours (L > U > C)', () => {
    const cPalette = getRarityPalette(BASE, 'C');
    const uPalette = getRarityPalette(BASE, 'U');
    const lPalette = getRarityPalette(BASE, 'L');
    // Compare channel 1 (outline) — higher rarity should be brighter
    const cR = (cPalette[1] >> 16) & 0xff;
    const uR = (uPalette[1] >> 16) & 0xff;
    const lR = (lPalette[1] >> 16) & 0xff;
    expect(uR).toBeGreaterThanOrEqual(cR);
    expect(lR).toBeGreaterThanOrEqual(uR);
  });

  it('result palette still has exactly 6 slots', () => {
    expect(getRarityPalette(BASE, 'L')).toHaveLength(6);
  });

  it('all shifted channels are clamped at 255 (no overflow)', () => {
    const nearMax: Palette = [0x000000, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff];
    const result = getRarityPalette(nearMax, 'L');
    for (let i = 1; i < result.length; i++) {
      const r = (result[i] >> 16) & 0xff;
      const g = (result[i] >> 8)  & 0xff;
      const b =  result[i]        & 0xff;
      expect(r, `channel ${i} R`).toBeLessThanOrEqual(255);
      expect(g, `channel ${i} G`).toBeLessThanOrEqual(255);
      expect(b, `channel ${i} B`).toBeLessThanOrEqual(255);
    }
  });
});

// ─── getMonsterSpriteData ─────────────────────────────────────────────────────

describe('getMonsterSpriteData', () => {
  it('returns an object with palette and silhouette', () => {
    const data = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee');
    expect(data.palette).toBeDefined();
    expect(data.silhouette).toBeDefined();
  });

  it('palette is a 6-element array', () => {
    const data = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee');
    expect(data.palette).toHaveLength(6);
  });

  it('silhouette is a 24×24 grid', () => {
    const data = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee');
    expect(data.silhouette).toHaveLength(24);
    for (const row of data.silhouette) {
      expect(row).toHaveLength(24);
    }
  });

  it('silhouette cells contain only palette indices 0–5', () => {
    const data = getMonsterSpriteData('gumiho_guardian', 'gumiho', 'melee');
    for (const row of data.silhouette) {
      for (const cell of row) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThanOrEqual(5);
      }
    }
  });

  it('two different monsters with same tribe have the same base palette', () => {
    const d1 = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee', 'C');
    const d2 = getMonsterSpriteData('dokkaebi_junior',  'dokkaebi', 'melee', 'C');
    expect(d1.palette).toStrictEqual(d2.palette);
  });

  it('legendary rarity produces a brighter palette than common', () => {
    const common = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee', 'C');
    const legend = getMonsterSpriteData('dokkaebi_warrior', 'dokkaebi', 'melee', 'L');
    // Index 1 (outline) should be brighter for legendary
    const cR = (common.palette[1] >> 16) & 0xff;
    const lR = (legend.palette[1] >> 16) & 0xff;
    expect(lR).toBeGreaterThanOrEqual(cR);
  });

  it('works without optional tribe/type/rarity arguments', () => {
    expect(() => getMonsterSpriteData('gold_turtle')).not.toThrow();
  });
});

// ─── composeSilhouette ────────────────────────────────────────────────────────

describe('composeSilhouette', () => {
  it('returns a 24×24 grid', () => {
    const grid = composeSilhouette({ head: 'horned', body: 'melee_stocky' });
    expect(grid).toHaveLength(24);
    for (const row of grid) expect(row).toHaveLength(24);
  });

  it('all cells are palette indices 0–5', () => {
    const grid = composeSilhouette({ head: 'fox_ears', body: 'ranged_slim', accessory: 'bow' });
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThanOrEqual(5);
      }
    }
  });

  it('result is not all zeros (something is drawn)', () => {
    const grid = composeSilhouette({ head: 'skull', body: 'melee_heavy' });
    const nonZero = grid.flat().some(c => c !== 0);
    expect(nonZero).toBe(true);
  });

  it('caching: same recipe returns same object reference', () => {
    const r1 = composeSilhouette({ head: 'horned', body: 'melee_slim' });
    const r2 = composeSilhouette({ head: 'horned', body: 'melee_slim' });
    expect(r1).toBe(r2); // same reference = cached
  });

  it('different recipes produce different grids', () => {
    const g1 = composeSilhouette({ head: 'horned',   body: 'melee_slim' });
    const g2 = composeSilhouette({ head: 'fox_ears', body: 'magic_robe' });
    expect(JSON.stringify(g1)).not.toBe(JSON.stringify(g2));
  });
});

// ─── MONSTER_RECIPES ─────────────────────────────────────────────────────────

describe('MONSTER_RECIPES', () => {
  it('contains at least 100 monster recipes', () => {
    expect(Object.keys(MONSTER_RECIPES).length).toBeGreaterThanOrEqual(100);
  });

  it('every recipe references a valid HeadId', () => {
    for (const [id, recipe] of Object.entries(MONSTER_RECIPES)) {
      expect(HEADS[recipe!.head], `${id} head "${recipe!.head}"`).toBeDefined();
    }
  });

  it('every recipe references a valid BodyId', () => {
    for (const [id, recipe] of Object.entries(MONSTER_RECIPES)) {
      expect(BODIES[recipe!.body], `${id} body "${recipe!.body}"`).toBeDefined();
    }
  });

  it('optional accessory, if set, references a valid AccessoryId', () => {
    for (const [id, recipe] of Object.entries(MONSTER_RECIPES)) {
      if (recipe!.accessory) {
        expect(
          ACCESSORIES[recipe!.accessory],
          `${id} accessory "${recipe!.accessory}"`,
        ).toBeDefined();
      }
    }
  });

  it('village_archer recipe uses bow accessory', () => {
    const recipe = MONSTER_RECIPES['village_archer'];
    expect(recipe).toBeDefined();
    expect(recipe!.accessory).toBe('bow');
  });
});
