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
