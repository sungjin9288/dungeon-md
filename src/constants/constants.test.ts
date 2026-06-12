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
  TORCH_POSITIONS,
  INVADER_WAYPOINTS,
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

// ─── layout — TORCH_POSITIONS ─────────────────────────────────────────────────

describe('layout — TORCH_POSITIONS', () => {
  it('has exactly 4 positions (one per grid corner)', () => {
    expect(TORCH_POSITIONS).toHaveLength(4);
  });

  it('top-left torch is at (GRID_X, GRID_Y)', () => {
    expect(TORCH_POSITIONS[0]).toStrictEqual({ x: GRID_X, y: GRID_Y });
  });

  it('top-right torch is at (GRID_X + GRID_WIDTH, GRID_Y)', () => {
    expect(TORCH_POSITIONS[1]).toStrictEqual({ x: GRID_X + GRID_WIDTH, y: GRID_Y });
  });

  it('bottom-left torch is at (GRID_X, GRID_Y + GRID_HEIGHT)', () => {
    expect(TORCH_POSITIONS[2]).toStrictEqual({ x: GRID_X, y: GRID_Y + GRID_HEIGHT });
  });

  it('bottom-right torch is at (GRID_X + GRID_WIDTH, GRID_Y + GRID_HEIGHT)', () => {
    expect(TORCH_POSITIONS[3]).toStrictEqual({ x: GRID_X + GRID_WIDTH, y: GRID_Y + GRID_HEIGHT });
  });

  it('all torch x-coordinates are within canvas bounds', () => {
    for (const p of TORCH_POSITIONS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });

  it('all torch y-coordinates are within canvas bounds', () => {
    for (const p of TORCH_POSITIONS) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });
});

// ─── layout — INVADER_WAYPOINTS ───────────────────────────────────────────────

describe('layout — INVADER_WAYPOINTS', () => {
  it('has exactly 8 waypoints', () => {
    expect(INVADER_WAYPOINTS).toHaveLength(8);
  });

  it('first waypoint starts off-screen to the right', () => {
    expect(INVADER_WAYPOINTS[0].x).toBeGreaterThan(CANVAS_WIDTH);
  });

  it('last waypoint exits off-screen to the left', () => {
    expect(INVADER_WAYPOINTS[INVADER_WAYPOINTS.length - 1].x).toBeLessThan(0);
  });

  it('all y-coordinates are within the grid row range', () => {
    const minY = GRID_Y;
    const maxY = GRID_Y + GRID_HEIGHT;
    // Internal waypoints (not entry/exit) must be inside the grid
    for (let i = 1; i < INVADER_WAYPOINTS.length - 1; i++) {
      expect(INVADER_WAYPOINTS[i].y).toBeGreaterThanOrEqual(minY);
      expect(INVADER_WAYPOINTS[i].y).toBeLessThanOrEqual(maxY);
    }
  });

  it('waypoint y-values change monotonically (path goes row 0 → 1 → 2)', () => {
    // Row transitions: wp[3] drops to row 1, wp[5] drops to row 2
    expect(INVADER_WAYPOINTS[3].y).toBeGreaterThan(INVADER_WAYPOINTS[2].y);
    expect(INVADER_WAYPOINTS[5].y).toBeGreaterThan(INVADER_WAYPOINTS[4].y);
  });

  it('each waypoint has x and y properties as numbers', () => {
    for (const wp of INVADER_WAYPOINTS) {
      expect(typeof wp.x).toBe('number');
      expect(typeof wp.y).toBe('number');
    }
  });
});

// ─── layout — overlay constants ───────────────────────────────────────────────

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

// ─── layout — INVADER_WAYPOINTS exact coordinates ────────────────────────────

describe('layout — INVADER_WAYPOINTS exact coordinates', () => {
  it('waypoint[0] is the off-screen-right entry {x:410, y:185}', () => {
    expect(INVADER_WAYPOINTS[0]).toStrictEqual({ x: 410, y: 185 });
  });

  it('waypoint[1] is the grid right edge on row 0 {x:360, y:185}', () => {
    expect(INVADER_WAYPOINTS[1]).toStrictEqual({ x: 360, y: 185 });
  });

  it('waypoint[2] is the grid left edge on row 0 {x:30, y:185}', () => {
    expect(INVADER_WAYPOINTS[2]).toStrictEqual({ x: 30, y: 185 });
  });

  it('waypoint[3] is the left-side pivot to row 1 {x:30, y:295}', () => {
    expect(INVADER_WAYPOINTS[3]).toStrictEqual({ x: 30, y: 295 });
  });

  it('waypoint[4] is the grid right edge on row 1 {x:360, y:295}', () => {
    expect(INVADER_WAYPOINTS[4]).toStrictEqual({ x: 360, y: 295 });
  });

  it('waypoint[5] is the right-side pivot to row 2 {x:360, y:405}', () => {
    expect(INVADER_WAYPOINTS[5]).toStrictEqual({ x: 360, y: 405 });
  });

  it('waypoint[6] is the grid left edge on row 2 {x:30, y:405}', () => {
    expect(INVADER_WAYPOINTS[6]).toStrictEqual({ x: 30, y: 405 });
  });

  it('waypoint[7] is the off-screen-left exit {x:-20, y:405}', () => {
    expect(INVADER_WAYPOINTS[7]).toStrictEqual({ x: -20, y: 405 });
  });

  it('row 0 y-center (185) equals GRID_Y + 0*CELL_SIZE + CELL_SIZE/2', () => {
    const row0Y = GRID_Y + 0 * CELL_SIZE + CELL_SIZE / 2;
    expect(INVADER_WAYPOINTS[1].y).toBe(row0Y);
    expect(INVADER_WAYPOINTS[2].y).toBe(row0Y);
  });

  it('row 1 y-center (295) equals GRID_Y + 1*CELL_SIZE + CELL_SIZE/2', () => {
    const row1Y = GRID_Y + 1 * CELL_SIZE + CELL_SIZE / 2;
    expect(INVADER_WAYPOINTS[3].y).toBe(row1Y);
    expect(INVADER_WAYPOINTS[4].y).toBe(row1Y);
  });

  it('row 2 y-center (405) equals GRID_Y + 2*CELL_SIZE + CELL_SIZE/2', () => {
    const row2Y = GRID_Y + 2 * CELL_SIZE + CELL_SIZE / 2;
    expect(INVADER_WAYPOINTS[5].y).toBe(row2Y);
    expect(INVADER_WAYPOINTS[6].y).toBe(row2Y);
  });

  it('row 0 traverses right-to-left (wp[1].x > wp[2].x)', () => {
    expect(INVADER_WAYPOINTS[1].x).toBeGreaterThan(INVADER_WAYPOINTS[2].x);
  });

  it('row 1 traverses left-to-right (wp[3].x < wp[4].x)', () => {
    expect(INVADER_WAYPOINTS[3].x).toBeLessThan(INVADER_WAYPOINTS[4].x);
  });

  it('row 2 traverses right-to-left (wp[5].x > wp[6].x)', () => {
    expect(INVADER_WAYPOINTS[5].x).toBeGreaterThan(INVADER_WAYPOINTS[6].x);
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

  it('left-column torches (TL, BL) share the same x = GRID_X', () => {
    expect(TORCH_POSITIONS[0].x).toBe(GRID_X);
    expect(TORCH_POSITIONS[2].x).toBe(GRID_X);
  });

  it('right-column torches (TR, BR) share the same x = GRID_X + GRID_WIDTH', () => {
    expect(TORCH_POSITIONS[1].x).toBe(GRID_X + GRID_WIDTH);
    expect(TORCH_POSITIONS[3].x).toBe(GRID_X + GRID_WIDTH);
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
