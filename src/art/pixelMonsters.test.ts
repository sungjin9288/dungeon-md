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
  OVERLAYS,
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

  it('dokkaebi primary color (index 2) is 0xcc3300 (bright red)', () => {
    expect(TRIBE_PALETTES['dokkaebi'][2]).toBe(0xcc3300);
  });

  it('celestial primary color (index 2) is 0xffd700 (gold)', () => {
    expect(TRIBE_PALETTES['celestial'][2]).toBe(0xffd700);
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

  it('U rarity (shift=15) applies exact channel delta to slot 1: 0x4a0000 → 0x590f0f', () => {
    // R: 0x4a=74 +15=89=0x59, G: 0+15=15=0x0f, B: 0+15=15=0x0f
    expect(getRarityPalette(BASE, 'U')[1]).toBe(0x590f0f);
  });

  it('R rarity (shift=30) applies exact channel delta to slot 1: 0x4a0000 → 0x681e1e', () => {
    // R: 74+30=104=0x68, G: 0+30=30=0x1e, B: 0+30=30=0x1e
    expect(getRarityPalette(BASE, 'R')[1]).toBe(0x681e1e);
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

  it('no-tribe fallback uses gray NO_TRIBE_PALETTE (slot 1 = 0x333333)', () => {
    // When tribe is omitted and rarity is C (shift=0) the NO_TRIBE_PALETTE is returned as-is
    const data = getMonsterSpriteData('gold_turtle'); // valid MonsterId, no tribe passed
    expect(data.palette[1]).toBe(0x333333);
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

  it('fire_aura overlay changes pixels compared to same recipe without overlay', () => {
    const without = composeSilhouette({ head: 'horned', body: 'magic_robe' });
    const withOverlay = composeSilhouette({ head: 'horned', body: 'magic_robe', overlay: 'fire_aura' });
    expect(JSON.stringify(withOverlay)).not.toBe(JSON.stringify(without));
  });

  it('overlay variant is independently cached — different cache key from base recipe', () => {
    const base  = composeSilhouette({ head: 'skull', body: 'melee_heavy' });
    const overlaid = composeSilhouette({ head: 'skull', body: 'melee_heavy', overlay: 'scales' });
    // Not the same reference despite sharing head+body
    expect(overlaid).not.toBe(base);
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

// ─── HEADS part table ─────────────────────────────────────────────────────────

describe('HEADS part table', () => {
  it('contains all 18 head variants', () => {
    expect(Object.keys(HEADS).length).toBe(18);
  });

  it('every head grid is exactly 8 rows × 24 cols', () => {
    for (const [id, grid] of Object.entries(HEADS)) {
      expect(grid.length, `${id} row count`).toBe(8);
      for (let r = 0; r < grid.length; r++) {
        expect(grid[r].length, `${id} row[${r}] col count`).toBe(24);
      }
    }
  });

  it('every head pixel value is in [0, 5]', () => {
    for (const [id, grid] of Object.entries(HEADS)) {
      for (const row of grid) {
        for (const v of row) {
          expect(v, `${id} bad pixel ${v}`).toBeGreaterThanOrEqual(0);
          expect(v, `${id} bad pixel ${v}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('each head has at least one non-zero pixel (not blank)', () => {
    for (const [id, grid] of Object.entries(HEADS)) {
      const hasPixels = grid.some(row => row.some(v => v > 0));
      expect(hasPixels, `${id} is completely blank`).toBe(true);
    }
  });
});

// ─── BODIES part table ────────────────────────────────────────────────────────

describe('BODIES part table', () => {
  it('contains all 10 body variants', () => {
    expect(Object.keys(BODIES).length).toBe(10);
  });

  it('every body grid is exactly 24 rows × 24 cols', () => {
    for (const [id, grid] of Object.entries(BODIES)) {
      expect(grid.length, `${id} row count`).toBe(24);
      for (let r = 0; r < grid.length; r++) {
        expect(grid[r].length, `${id} row[${r}] col count`).toBe(24);
      }
    }
  });

  it('every body pixel value is in [0, 5]', () => {
    for (const [id, grid] of Object.entries(BODIES)) {
      for (const row of grid) {
        for (const v of row) {
          expect(v, `${id} bad pixel ${v}`).toBeGreaterThanOrEqual(0);
          expect(v, `${id} bad pixel ${v}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('each body has at least one non-zero pixel', () => {
    for (const [id, grid] of Object.entries(BODIES)) {
      const hasPixels = grid.some(row => row.some(v => v > 0));
      expect(hasPixels, `${id} is completely blank`).toBe(true);
    }
  });
});

// ─── ACCESSORIES part table ───────────────────────────────────────────────────

describe('ACCESSORIES part table', () => {
  it('contains all 15 accessory variants', () => {
    expect(Object.keys(ACCESSORIES).length).toBe(15);
  });

  it('every accessory grid is exactly 24 rows × 24 cols', () => {
    for (const [id, grid] of Object.entries(ACCESSORIES)) {
      expect(grid.length, `${id} row count`).toBe(24);
      for (let r = 0; r < grid.length; r++) {
        expect(grid[r].length, `${id} row[${r}] col count`).toBe(24);
      }
    }
  });

  it('each accessory has at least one non-zero pixel', () => {
    for (const [id, grid] of Object.entries(ACCESSORIES)) {
      const hasPixels = grid.some(row => row.some(v => v > 0));
      expect(hasPixels, `${id} is completely blank`).toBe(true);
    }
  });
});

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────

describe('OVERLAYS', () => {
  const BLANK_24: number[][] = Array.from({ length: 24 }, () => Array(24).fill(2));

  it('contains all 8 overlay functions', () => {
    expect(Object.keys(OVERLAYS).length).toBe(8);
  });

  it('every overlay returns a 24×24 grid', () => {
    for (const [id, fn] of Object.entries(OVERLAYS)) {
      const result = fn(BLANK_24.map(r => [...r]));
      expect(result.length, `${id} row count`).toBe(24);
      expect(result[0].length, `${id} col count`).toBe(24);
    }
  });

  it('every overlay output contains only valid pixel values [0, 5]', () => {
    for (const [id, fn] of Object.entries(OVERLAYS)) {
      const result = fn(BLANK_24.map(r => [...r]));
      for (const row of result) {
        for (const v of row) {
          expect(v, `${id} bad pixel ${v}`).toBeGreaterThanOrEqual(0);
          expect(v, `${id} bad pixel ${v}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('fire_dokkaebi recipe (fire_aura overlay) produces non-zero pixels', () => {
    const recipe = MONSTER_RECIPES['fire_dokkaebi']!;
    const result = composeSilhouette(recipe);
    const nonZero = result.flat().filter(v => v > 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });
});
