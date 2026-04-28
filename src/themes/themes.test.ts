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
  it('cave: particleGravity=120, bgGridAlpha=0.45, panelBorderCSS=#3a8890', () => {
    expect(CAVE_THEME.particleGravity).toBe(120);
    expect(CAVE_THEME.bgGridAlpha).toBe(0.45);
    expect(CAVE_THEME.panelBorderCSS).toBe('#3a8890');
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
