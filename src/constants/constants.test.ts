import { describe, it, expect } from 'vitest';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  GRID_X,
  GRID_Y,
  GRID_WIDTH,
  GRID_HEIGHT,
  TOP_BAR_HEIGHT,
  FOG_START_Y,
  FOG_HEIGHT,
} from './layout';
import { COLORS, CSS } from './colors';

// ─── layout — canvas ──────────────────────────────────────────────────────────

describe('layout — canvas', () => {
  it('CANVAS_WIDTH is 390 (iPhone portrait width)', () => {
    expect(CANVAS_WIDTH).toBe(390);
  });

  it('CANVAS_HEIGHT is 844 (iPhone 12 portrait height)', () => {
    expect(CANVAS_HEIGHT).toBe(844);
  });

  it('canvas dimensions are positive integers', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
    expect(Number.isInteger(CANVAS_WIDTH)).toBe(true);
    expect(Number.isInteger(CANVAS_HEIGHT)).toBe(true);
  });

  it('canvas is taller than wide (portrait mode)', () => {
    expect(CANVAS_HEIGHT).toBeGreaterThan(CANVAS_WIDTH);
  });
});

// ─── layout — grid ────────────────────────────────────────────────────────────

describe('layout — grid', () => {
  it('GRID_COLS × GRID_ROWS = 9 total slots', () => {
    expect(GRID_COLS * GRID_ROWS).toBe(9);
  });

  it('GRID_WIDTH = GRID_COLS × CELL_SIZE', () => {
    expect(GRID_WIDTH).toBe(GRID_COLS * CELL_SIZE);
  });

  it('GRID_HEIGHT = GRID_ROWS × CELL_SIZE', () => {
    expect(GRID_HEIGHT).toBe(GRID_ROWS * CELL_SIZE);
  });

  it('GRID_WIDTH equals 330', () => {
    expect(GRID_WIDTH).toBe(330);
  });

  it('GRID_HEIGHT equals 330', () => {
    expect(GRID_HEIGHT).toBe(330);
  });

  it('grid fits horizontally within canvas (GRID_X + GRID_WIDTH ≤ CANVAS_WIDTH)', () => {
    expect(GRID_X + GRID_WIDTH).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('grid fits vertically within canvas (GRID_Y + GRID_HEIGHT ≤ CANVAS_HEIGHT)', () => {
    expect(GRID_Y + GRID_HEIGHT).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('GRID_X and GRID_Y are non-negative', () => {
    expect(GRID_X).toBeGreaterThanOrEqual(0);
    expect(GRID_Y).toBeGreaterThanOrEqual(0);
  });

  it('CELL_SIZE is a positive integer', () => {
    expect(CELL_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(CELL_SIZE)).toBe(true);
  });

  it('GRID_COLS = 3 and GRID_ROWS = 3', () => {
    expect(GRID_COLS).toBe(3);
    expect(GRID_ROWS).toBe(3);
  });

  it('GRID_X = 30 and GRID_Y = 130 (exact layout origin)', () => {
    expect(GRID_X).toBe(30);
    expect(GRID_Y).toBe(130);
  });

  it('CELL_SIZE = 110 (exact cell size)', () => {
    expect(CELL_SIZE).toBe(110);
  });
});

describe('layout — overlay constants', () => {
  it('TOP_BAR_HEIGHT is positive and less than CANVAS_HEIGHT', () => {
    expect(TOP_BAR_HEIGHT).toBeGreaterThan(0);
    expect(TOP_BAR_HEIGHT).toBeLessThan(CANVAS_HEIGHT);
  });

  it('FOG_START_Y = CANVAS_HEIGHT - FOG_HEIGHT', () => {
    expect(FOG_START_Y).toBe(CANVAS_HEIGHT - FOG_HEIGHT);
  });

  it('FOG_START_Y is within canvas vertical range', () => {
    expect(FOG_START_Y).toBeGreaterThan(0);
    expect(FOG_START_Y).toBeLessThan(CANVAS_HEIGHT);
  });

  it('FOG_HEIGHT is positive', () => {
    expect(FOG_HEIGHT).toBeGreaterThan(0);
  });

  it('TOP_BAR_HEIGHT = 110 (exact)', () => {
    expect(TOP_BAR_HEIGHT).toBe(110);
  });

  it('FOG_HEIGHT = 160 (exact)', () => {
    expect(FOG_HEIGHT).toBe(160);
  });
});

// ─── colors — COLORS (hex palette) ───────────────────────────────────────────

describe('COLORS', () => {
  it('has at least 16 named colour slots', () => {
    expect(Object.keys(COLORS).length).toBeGreaterThanOrEqual(16);
  });

  it('every value is a non-negative integer (valid 24-bit colour)', () => {
    for (const [name, value] of Object.entries(COLORS)) {
      expect(Number.isInteger(value), `${name} is integer`).toBe(true);
      expect(value, `${name} non-negative`).toBeGreaterThanOrEqual(0);
      expect(value, `${name} ≤ 0xffffff`).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('BLACK is a very dark colour (each channel ≤ 30)', () => {
    const v = COLORS.BLACK;
    const r = (v >> 16) & 0xff;
    const g = (v >> 8)  & 0xff;
    const b =  v        & 0xff;
    expect(r).toBeLessThanOrEqual(30);
    expect(g).toBeLessThanOrEqual(30);
    expect(b).toBeLessThanOrEqual(30);
  });

  it('PARCHMENT is a light warm colour (R channel > 200)', () => {
    const r = (COLORS.PARCHMENT >> 16) & 0xff;
    expect(r).toBeGreaterThan(200);
  });

  it('BLOOD_RED has a high red channel and low green/blue', () => {
    const r = (COLORS.BLOOD_RED >> 16) & 0xff;
    const g = (COLORS.BLOOD_RED >> 8)  & 0xff;
    const b =  COLORS.BLOOD_RED        & 0xff;
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('all colour keys are uppercase strings', () => {
    for (const key of Object.keys(COLORS)) {
      expect(key).toBe(key.toUpperCase());
    }
  });

  it('no two colour names map to the same hex value', () => {
    const values = Object.values(COLORS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ─── colors — CSS (string palette) ───────────────────────────────────────────

describe('CSS', () => {
  it('has at least 8 named CSS colour strings', () => {
    expect(Object.keys(CSS).length).toBeGreaterThanOrEqual(8);
  });

  it('every value starts with "#"', () => {
    for (const [name, value] of Object.entries(CSS)) {
      expect(value, `${name} must start with #`).toMatch(/^#/);
    }
  });

  it('every value is a valid 6-digit hex CSS colour', () => {
    for (const [name, value] of Object.entries(CSS)) {
      expect(value, `${name} invalid hex`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('CSS keys match a subset of COLORS keys', () => {
    const colorKeys = new Set(Object.keys(COLORS));
    for (const key of Object.keys(CSS)) {
      expect(colorKeys.has(key), `CSS key "${key}" not in COLORS`).toBe(true);
    }
  });

  it('CSS.PARCHMENT and COLORS.PARCHMENT encode the same colour', () => {
    // CSS '#f0e6c8' → R=0xf0 G=0xe6 B=0xc8
    const hex = parseInt(CSS.PARCHMENT.slice(1), 16);
    expect(hex).toBe(COLORS.PARCHMENT);
  });

  it('CSS.TORCH_GLOW and COLORS.TORCH_GLOW encode the same colour', () => {
    const hex = parseInt(CSS.TORCH_GLOW.slice(1), 16);
    expect(hex).toBe(COLORS.TORCH_GLOW);
  });

  it('no two CSS colour names map to the same string', () => {
    const values = Object.values(CSS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every CSS value encodes the same number as the matching COLORS key', () => {
    for (const [key, cssHex] of Object.entries(CSS)) {
      const fromCss    = parseInt((cssHex as string).slice(1), 16);
      const fromColors = (COLORS as Record<string, number>)[key];
      expect(fromCss, `CSS.${key} vs COLORS.${key}`).toBe(fromColors);
    }
  });
});

// ─── layout — derived edge values & torch column symmetry ────────────────────

describe('layout — derived edge values & torch column symmetry', () => {
  it('GRID_X + GRID_WIDTH = 360 (right grid edge, exact)', () => {
    expect(GRID_X + GRID_WIDTH).toBe(360);
  });

  it('GRID_Y + GRID_HEIGHT = 460 (bottom grid edge, exact)', () => {
    expect(GRID_Y + GRID_HEIGHT).toBe(460);
  });

  it('FOG_START_Y = 684 (exact: 844 - 160)', () => {
    expect(FOG_START_Y).toBe(684);
  });

  it('COLORS has exactly 23 named colour keys (16 base + 7 unified-design tokens)', () => {
    expect(Object.keys(COLORS)).toHaveLength(23);
  });

  it('design tokens: JADE accent and unified panel/card base exist', () => {
    expect(COLORS.JADE).toBe(0x55b88a);
    expect(COLORS.PANEL_BG).toBe(0x1f1305);
    expect(COLORS.CARD_BG).toBe(0x2c1d0d);
  });

  it('CSS has exactly 8 named CSS colour keys', () => {
    expect(Object.keys(CSS)).toHaveLength(8);
  });
});
