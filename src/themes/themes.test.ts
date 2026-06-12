import { describe, it, expect } from 'vitest';

import {
  ALL_THEMES,
  CAVE_THEME,
  CELESTIAL_THEME,
  ICE_CAVE_THEME,
  LAVA_CAVE_THEME,
  VOID_THRONE_THEME,
  getActiveTheme,
} from './themes';
import type { DungeonTheme } from './DungeonTheme';

const REQUIRED_NUMERIC_KEYS: Array<keyof DungeonTheme> = [
  'bgPrimary', 'bgSecondary', 'bgGridAlpha',
  'panelDark', 'panelBorder',
  'slotFill', 'slotBorder', 'slotLocked',
  'stoneDark', 'stoneMid', 'stoneLight',
  'ambientColor', 'glowColor', 'glowAlpha',
  'particleGravity',
];

const REQUIRED_STRING_KEYS: Array<keyof DungeonTheme> = [
  'id', 'name', 'panelBorderCSS',
  'textPrimary', 'textSecondary', 'textAccent',
];

describe('ALL_THEMES', () => {
  it('contains five ordered entries', () => {
    expect(ALL_THEMES).toHaveLength(5);
  });

  it('has unique theme ids', () => {
    const ids = ALL_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(REQUIRED_NUMERIC_KEYS)(
    'every theme defines numeric field "%s"',
    (key) => {
      for (const theme of ALL_THEMES) {
        expect(typeof theme[key]).toBe('number');
      }
    },
  );

  it.each(REQUIRED_STRING_KEYS)(
    'every theme defines string field "%s"',
    (key) => {
      for (const theme of ALL_THEMES) {
        expect(typeof theme[key]).toBe('string');
        expect((theme[key] as string).length).toBeGreaterThan(0);
      }
    },
  );

  it('every theme provides particleTint as a non-empty number array', () => {
    for (const theme of ALL_THEMES) {
      expect(Array.isArray(theme.particleTint)).toBe(true);
      expect(theme.particleTint.length).toBeGreaterThan(0);
      for (const tint of theme.particleTint) {
        expect(typeof tint).toBe('number');
      }
    }
  });

  it('every theme provides decorations as an array', () => {
    for (const theme of ALL_THEMES) {
      expect(Array.isArray(theme.decorations)).toBe(true);
    }
  });

  it('glowAlpha is within [0, 1] for every theme', () => {
    for (const theme of ALL_THEMES) {
      expect(theme.glowAlpha).toBeGreaterThanOrEqual(0);
      expect(theme.glowAlpha).toBeLessThanOrEqual(1);
    }
  });
});

describe('getActiveTheme', () => {
  it('returns CAVE_THEME by default when id omitted', () => {
    expect(getActiveTheme()).toBe(CAVE_THEME);
  });

  it('returns CAVE_THEME for explicit "cave" id', () => {
    expect(getActiveTheme('cave')).toBe(CAVE_THEME);
  });

  it('returns ICE_CAVE_THEME for "ice_cave" id', () => {
    expect(getActiveTheme('ice_cave')).toBe(ICE_CAVE_THEME);
  });

  it('returns LAVA_CAVE_THEME for "lava_cave" id', () => {
    expect(getActiveTheme('lava_cave')).toBe(LAVA_CAVE_THEME);
  });

  it('returns VOID_THRONE_THEME for "void_throne" id', () => {
    expect(getActiveTheme('void_throne')).toBe(VOID_THRONE_THEME);
  });

  it('returns CELESTIAL_THEME for "celestial_realm" id', () => {
    expect(getActiveTheme('celestial_realm')).toBe(CELESTIAL_THEME);
  });

  it('falls back to CAVE_THEME for an unknown id', () => {
    expect(getActiveTheme('nonexistent_theme')).toBe(CAVE_THEME);
  });

  it('falls back to CAVE_THEME for empty string', () => {
    // Empty string is not nullish, so it uses the literal "" key which is missing,
    // and then falls through to the CAVE_THEME default.
    expect(getActiveTheme('')).toBe(CAVE_THEME);
  });

  it('matches theme.id with its registry key', () => {
    expect(CAVE_THEME.id).toBe('cave');
    expect(ICE_CAVE_THEME.id).toBe('ice_cave');
    expect(LAVA_CAVE_THEME.id).toBe('lava_cave');
    expect(VOID_THRONE_THEME.id).toBe('void_throne');
    expect(CELESTIAL_THEME.id).toBe('celestial_realm');
  });
});

// ─── ALL_THEMES — property constraints ───────────────────────────────────────

describe('ALL_THEMES — property constraints', () => {
  it('ALL_THEMES order is cave, ice_cave, lava_cave, void_throne, celestial_realm', () => {
    expect(ALL_THEMES.map(t => t.id)).toEqual([
      'cave', 'ice_cave', 'lava_cave', 'void_throne', 'celestial_realm',
    ]);
  });

  it('bgGridAlpha is within (0, 1) for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.bgGridAlpha, `${t.id} bgGridAlpha`).toBeGreaterThan(0);
      expect(t.bgGridAlpha, `${t.id} bgGridAlpha`).toBeLessThan(1);
    }
  });

  it('panelBorderCSS is a CSS hex string (#rrggbb) for every theme', () => {
    const cssHex = /^#[0-9a-fA-F]{6}$/;
    for (const t of ALL_THEMES) {
      expect(cssHex.test(t.panelBorderCSS), `${t.id} panelBorderCSS="${t.panelBorderCSS}"`).toBe(true);
    }
  });

  it('every theme name is non-empty and different from its id', () => {
    for (const t of ALL_THEMES) {
      expect(t.name.length, `${t.id} name is empty`).toBeGreaterThan(0);
      expect(t.name, `${t.id} name equals id`).not.toBe(t.id);
    }
  });

  it('particleGravity is non-zero for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.particleGravity, `${t.id} particleGravity is 0`).not.toBe(0);
    }
  });

  it('cave and ice_cave have positive particleGravity (falling particles)', () => {
    expect(CAVE_THEME.particleGravity).toBeGreaterThan(0);
    expect(ICE_CAVE_THEME.particleGravity).toBeGreaterThan(0);
  });

  it('lava_cave, void_throne, celestial_realm have negative particleGravity (rising particles)', () => {
    expect(LAVA_CAVE_THEME.particleGravity).toBeLessThan(0);
    expect(VOID_THRONE_THEME.particleGravity).toBeLessThan(0);
    expect(CELESTIAL_THEME.particleGravity).toBeLessThan(0);
  });

  it('celestial_realm has the lowest bgGridAlpha (most transparent grid)', () => {
    const minAlpha = Math.min(...ALL_THEMES.map(t => t.bgGridAlpha));
    expect(CELESTIAL_THEME.bgGridAlpha).toBe(minAlpha);
  });

  it('ice_cave has the highest bgGridAlpha (most visible grid)', () => {
    const maxAlpha = Math.max(...ALL_THEMES.map(t => t.bgGridAlpha));
    expect(ICE_CAVE_THEME.bgGridAlpha).toBe(maxAlpha);
  });
});

// ─── Per-theme spot-checks ────────────────────────────────────────────────────

describe('Per-theme spot-checks', () => {
  it('cave: particleGravity=120, bgGridAlpha=0.45, panelBorderCSS=#8a6e30', () => {
    expect(CAVE_THEME.particleGravity).toBe(120);
    expect(CAVE_THEME.bgGridAlpha).toBe(0.45);
    expect(CAVE_THEME.panelBorderCSS).toBe('#8a6e30');
  });

  it('ice_cave: particleGravity=40, bgGridAlpha=0.55, panelBorderCSS=#6ab4d8', () => {
    expect(ICE_CAVE_THEME.particleGravity).toBe(40);
    expect(ICE_CAVE_THEME.bgGridAlpha).toBe(0.55);
    expect(ICE_CAVE_THEME.panelBorderCSS).toBe('#6ab4d8');
  });

  it('lava_cave: particleGravity=-60 (rising), bgGridAlpha=0.4, panelBorderCSS=#dd5500', () => {
    expect(LAVA_CAVE_THEME.particleGravity).toBe(-60);
    expect(LAVA_CAVE_THEME.bgGridAlpha).toBe(0.4);
    expect(LAVA_CAVE_THEME.panelBorderCSS).toBe('#dd5500');
  });

  it('void_throne: particleGravity=-10 (rising), bgGridAlpha=0.35, panelBorderCSS=#8844cc', () => {
    expect(VOID_THRONE_THEME.particleGravity).toBe(-10);
    expect(VOID_THRONE_THEME.bgGridAlpha).toBe(0.35);
    expect(VOID_THRONE_THEME.panelBorderCSS).toBe('#8844cc');
  });

  it('celestial_realm: particleGravity=-14 (rising), bgGridAlpha=0.28, panelBorderCSS=#ffd700', () => {
    expect(CELESTIAL_THEME.particleGravity).toBe(-14);
    expect(CELESTIAL_THEME.bgGridAlpha).toBe(0.28);
    expect(CELESTIAL_THEME.panelBorderCSS).toBe('#ffd700');
  });

  it('celestial_realm has 4 particleTints (most of any theme)', () => {
    const maxTints = Math.max(...ALL_THEMES.map(t => t.particleTint.length));
    expect(CELESTIAL_THEME.particleTint).toHaveLength(maxTints);
    expect(CELESTIAL_THEME.particleTint).toHaveLength(4);
  });
});

// ─── ALL_THEMES — text colors and stone ordering ──────────────────────────────

describe('ALL_THEMES — text colors and stone ordering', () => {
  const cssHex = /^#[0-9a-fA-F]{6}$/;

  it('textPrimary is a valid 6-digit CSS hex color for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.textPrimary, `${t.id} textPrimary`).toMatch(cssHex);
    }
  });

  it('textSecondary is a valid 6-digit CSS hex color for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.textSecondary, `${t.id} textSecondary`).toMatch(cssHex);
    }
  });

  it('textAccent is a valid 6-digit CSS hex color for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.textAccent, `${t.id} textAccent`).toMatch(cssHex);
    }
  });

  it('stoneDark < stoneMid < stoneLight for every theme (brightness increases)', () => {
    for (const t of ALL_THEMES) {
      expect(t.stoneDark,  `${t.id} stoneDark<stoneMid`).toBeLessThan(t.stoneMid);
      expect(t.stoneMid,   `${t.id} stoneMid<stoneLight`).toBeLessThan(t.stoneLight);
    }
  });

  it('glowAlpha > 0 for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.glowAlpha, `${t.id} glowAlpha`).toBeGreaterThan(0);
    }
  });

  it('panelBorder (hex number) encodes the same color as panelBorderCSS (CSS string)', () => {
    for (const t of ALL_THEMES) {
      const fromCss = parseInt(t.panelBorderCSS.slice(1), 16);
      expect(fromCss, `${t.id} panelBorder vs panelBorderCSS`).toBe(t.panelBorder);
    }
  });

  it('void_throne textPrimary and textAccent are both gold (#d4af37)', () => {
    expect(VOID_THRONE_THEME.textPrimary).toBe('#d4af37');
    expect(VOID_THRONE_THEME.textAccent).toBe('#d4af37');
  });

  it('celestial_realm textPrimary matches its panelBorderCSS (both gold #ffd700)', () => {
    expect(CELESTIAL_THEME.textPrimary).toBe('#ffd700');
    expect(CELESTIAL_THEME.panelBorderCSS).toBe('#ffd700');
  });

  it('bgPrimary < bgSecondary for every theme (primary is darker)', () => {
    for (const t of ALL_THEMES) {
      expect(t.bgPrimary, `${t.id} bgPrimary not < bgSecondary`).toBeLessThan(t.bgSecondary);
    }
  });

  it('glowColor is non-zero for every theme (not black)', () => {
    for (const t of ALL_THEMES) {
      expect(t.glowColor, `${t.id} glowColor is 0`).toBeGreaterThan(0);
    }
  });

  it('every decoration entry is a non-empty string', () => {
    for (const t of ALL_THEMES) {
      for (const d of t.decorations) {
        expect(typeof d, `${t.id} decoration not string`).toBe('string');
        expect((d as string).length, `${t.id} empty decoration`).toBeGreaterThan(0);
      }
    }
  });

  it('lava_cave has exactly 2 decorations (fewest of all themes)', () => {
    expect(LAVA_CAVE_THEME.decorations).toHaveLength(2);
    expect(LAVA_CAVE_THEME.decorations).toContain('stalagmites');
    expect(LAVA_CAVE_THEME.decorations).toContain('torches');
  });

  it('cave is the only theme with water_drips decoration', () => {
    expect(CAVE_THEME.decorations).toContain('water_drips');
    for (const t of ALL_THEMES.filter(t => t.id !== 'cave')) {
      expect(t.decorations, `${t.id} should not have water_drips`).not.toContain('water_drips');
    }
  });

  it('void_throne glowColor matches textAccent (both 0xd4af37 gold)', () => {
    const glowFromAccent = parseInt(VOID_THRONE_THEME.textAccent.slice(1), 16);
    expect(VOID_THRONE_THEME.glowColor).toBe(glowFromAccent);
  });

  it('celestial_realm ambientColor matches textPrimary (both gold #ffd700)', () => {
    const ambientFromText = parseInt(CELESTIAL_THEME.textPrimary.slice(1), 16);
    expect(CELESTIAL_THEME.ambientColor).toBe(ambientFromText);
  });
});

// ─── ALL_THEMES — slot, ambient, and decoration cross-checks ──────────────────

describe('ALL_THEMES — slot, ambient & decoration cross-checks', () => {
  it('ALL_THEMES[0] is the same reference as CAVE_THEME', () => {
    expect(ALL_THEMES[0]).toBe(CAVE_THEME);
  });

  it('slotLocked < slotFill for every theme (locked overlay is darker)', () => {
    for (const t of ALL_THEMES) {
      expect(t.slotLocked, `${t.id} slotLocked < slotFill`).toBeLessThan(t.slotFill);
    }
  });

  it('ambientColor is non-zero for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.ambientColor, `${t.id} ambientColor is 0`).toBeGreaterThan(0);
    }
  });

  it('every particleTint entry is within valid hex range [0, 0xffffff]', () => {
    for (const t of ALL_THEMES) {
      for (const tint of t.particleTint) {
        expect(tint, `${t.id} tint out of range`).toBeGreaterThanOrEqual(0);
        expect(tint, `${t.id} tint out of range`).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('getActiveTheme returns the same reference on repeated calls (idempotent)', () => {
    expect(getActiveTheme('lava_cave')).toBe(getActiveTheme('lava_cave'));
    expect(getActiveTheme()).toBe(getActiveTheme('cave'));
  });

  it('crystals decoration is shared by ice_cave, void_throne, and celestial_realm', () => {
    expect(ICE_CAVE_THEME.decorations).toContain('crystals');
    expect(VOID_THRONE_THEME.decorations).toContain('crystals');
    expect(CELESTIAL_THEME.decorations).toContain('crystals');
    expect(CAVE_THEME.decorations).not.toContain('crystals');
    expect(LAVA_CAVE_THEME.decorations).not.toContain('crystals');
  });

  it('lava_cave is the only theme without stalactites decoration', () => {
    for (const t of ALL_THEMES) {
      if (t.id === 'lava_cave') {
        expect(t.decorations, 'lava_cave should not have stalactites').not.toContain('stalactites');
      } else {
        expect(t.decorations, `${t.id} should have stalactites`).toContain('stalactites');
      }
    }
  });
});

// ─── ALL_THEMES — index pins, panelDark, slotBorder, decoration counts ────────

describe('ALL_THEMES — index pins & additional field constraints', () => {
  it('ALL_THEMES[4] is the same reference as CELESTIAL_THEME', () => {
    expect(ALL_THEMES[4]).toBe(CELESTIAL_THEME);
  });

  it('panelDark is non-zero for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.panelDark, `${t.id} panelDark is 0`).toBeGreaterThan(0);
    }
  });

  it('slotBorder is non-zero for every theme', () => {
    for (const t of ALL_THEMES) {
      expect(t.slotBorder, `${t.id} slotBorder is 0`).toBeGreaterThan(0);
    }
  });

  it('cave has exactly 3 decorations (stalactites, stalagmites, water_drips)', () => {
    expect(CAVE_THEME.decorations).toHaveLength(3);
    expect(CAVE_THEME.decorations).toContain('stalactites');
    expect(CAVE_THEME.decorations).toContain('stalagmites');
    expect(CAVE_THEME.decorations).toContain('water_drips');
  });

  it('ice_cave has exactly 3 decorations (stalactites, stalagmites, crystals)', () => {
    expect(ICE_CAVE_THEME.decorations).toHaveLength(3);
    expect(ICE_CAVE_THEME.decorations).toContain('stalactites');
    expect(ICE_CAVE_THEME.decorations).toContain('stalagmites');
    expect(ICE_CAVE_THEME.decorations).toContain('crystals');
  });

  it('void_throne has exactly 3 decorations (stalactites, crystals, torches)', () => {
    expect(VOID_THRONE_THEME.decorations).toHaveLength(3);
    expect(VOID_THRONE_THEME.decorations).toContain('stalactites');
    expect(VOID_THRONE_THEME.decorations).toContain('crystals');
    expect(VOID_THRONE_THEME.decorations).toContain('torches');
  });

  it('getActiveTheme(t.id) returns the same reference as each named export', () => {
    expect(getActiveTheme('ice_cave')).toBe(ICE_CAVE_THEME);
    expect(getActiveTheme('void_throne')).toBe(VOID_THRONE_THEME);
    expect(getActiveTheme('celestial_realm')).toBe(CELESTIAL_THEME);
  });
});

// ─── ALL_THEMES — remaining index pins, exact glowAlpha, particleTint counts ──

describe('ALL_THEMES — glowAlpha, particleTint, textSecondary & index pins', () => {
  it('ALL_THEMES[1] is the same reference as ICE_CAVE_THEME', () => {
    expect(ALL_THEMES[1]).toBe(ICE_CAVE_THEME);
  });

  it('ALL_THEMES[2] is the same reference as LAVA_CAVE_THEME', () => {
    expect(ALL_THEMES[2]).toBe(LAVA_CAVE_THEME);
  });

  it('ALL_THEMES[3] is the same reference as VOID_THRONE_THEME', () => {
    expect(ALL_THEMES[3]).toBe(VOID_THRONE_THEME);
  });

  it('cave is the only theme where ambientColor === glowColor (both 0xc8721a)', () => {
    expect(CAVE_THEME.ambientColor).toBe(CAVE_THEME.glowColor);
    expect(CAVE_THEME.ambientColor).toBe(0xc8721a);
    for (const t of ALL_THEMES.filter(t => t.id !== 'cave')) {
      expect(t.ambientColor, `${t.id} ambientColor should ≠ glowColor`).not.toBe(t.glowColor);
    }
  });

  it('glowAlpha exact values: cave=0.15, ice=0.20, lava=0.18, void=0.15, celestial=0.18', () => {
    expect(CAVE_THEME.glowAlpha).toBe(0.15);
    expect(ICE_CAVE_THEME.glowAlpha).toBe(0.20);
    expect(LAVA_CAVE_THEME.glowAlpha).toBe(0.18);
    expect(VOID_THRONE_THEME.glowAlpha).toBe(0.15);
    expect(CELESTIAL_THEME.glowAlpha).toBe(0.18);
  });

  it('cave, ice_cave, lava_cave, void_throne each have exactly 3 particleTints', () => {
    expect(CAVE_THEME.particleTint).toHaveLength(3);
    expect(ICE_CAVE_THEME.particleTint).toHaveLength(3);
    expect(LAVA_CAVE_THEME.particleTint).toHaveLength(3);
    expect(VOID_THRONE_THEME.particleTint).toHaveLength(3);
  });

  it('textSecondary spot-checks: cave=#907a58, lava=#805030, celestial=#7a8ecc', () => {
    expect(CAVE_THEME.textSecondary).toBe('#907a58');
    expect(LAVA_CAVE_THEME.textSecondary).toBe('#805030');
    expect(CELESTIAL_THEME.textSecondary).toBe('#7a8ecc');
  });
});

// ─── decoration coverage & additional spot-checks ────────────────────────────

describe('ALL_THEMES — decoration coverage & remaining spot-checks', () => {
  it('celestial_realm has exactly 3 decorations (crystals, torches, stalactites)', () => {
    expect(CELESTIAL_THEME.decorations).toHaveLength(3);
    expect(CELESTIAL_THEME.decorations).toContain('crystals');
    expect(CELESTIAL_THEME.decorations).toContain('torches');
    expect(CELESTIAL_THEME.decorations).toContain('stalactites');
  });

  it('torches decoration appears in lava_cave, void_throne, celestial — not in cave or ice_cave', () => {
    expect(LAVA_CAVE_THEME.decorations).toContain('torches');
    expect(VOID_THRONE_THEME.decorations).toContain('torches');
    expect(CELESTIAL_THEME.decorations).toContain('torches');
    expect(CAVE_THEME.decorations).not.toContain('torches');
    expect(ICE_CAVE_THEME.decorations).not.toContain('torches');
  });

  it('celestial_realm textAccent is "#ffeebb"', () => {
    expect(CELESTIAL_THEME.textAccent).toBe('#ffeebb');
  });

  it('no theme uses the "moss" decoration', () => {
    for (const t of ALL_THEMES) {
      expect(t.decorations, `${t.id} should not use moss`).not.toContain('moss');
    }
  });

  it('panelDark < slotFill for every theme (header bar is darker than empty slot bg)', () => {
    for (const t of ALL_THEMES) {
      expect(t.panelDark, `${t.id} panelDark < slotFill`).toBeLessThan(t.slotFill);
    }
  });

  it('lava_cave textAccent is "#ff8844"', () => {
    expect(LAVA_CAVE_THEME.textAccent).toBe('#ff8844');
  });

  it('cave particleTint exact values: [0xe8a820, 0xc8721a, 0xffd060] (torch embers)', () => {
    expect(CAVE_THEME.particleTint).toStrictEqual([0xe8a820, 0xc8721a, 0xffd060]);
  });
});
