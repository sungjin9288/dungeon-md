import { describe, it, expect } from 'vitest';
import { darken, lighten, computeLayout } from './invaderShapeHelpers';

// ─── darken ───────────────────────────────────────────────────────────────────

describe('darken', () => {
  it('returns 0 for black input regardless of amount', () => {
    expect(darken(0x000000, 0.5)).toBe(0x000000);
  });

  it('scales each channel by the given amount (default 0.4)', () => {
    // 0xffffff → each channel = 255 * 0.4 = 102 = 0x66
    const result = darken(0xffffff);
    const r = (result >> 16) & 0xff;
    const g = (result >> 8)  & 0xff;
    const b =  result        & 0xff;
    expect(r).toBe(Math.floor(255 * 0.4));
    expect(g).toBe(Math.floor(255 * 0.4));
    expect(b).toBe(Math.floor(255 * 0.4));
  });

  it('applies amount=0.5 correctly', () => {
    // 0xff0000 → r=127 (floor(255*0.5)), g=0, b=0
    const result = darken(0xff0000, 0.5);
    expect((result >> 16) & 0xff).toBe(Math.floor(255 * 0.5));
    expect((result >> 8)  & 0xff).toBe(0);
    expect( result        & 0xff).toBe(0);
  });

  it('only affects the non-zero channels', () => {
    // Pure green 0x00ff00 darkened by 0.5
    const result = darken(0x00ff00, 0.5);
    expect((result >> 16) & 0xff).toBe(0);
    expect((result >> 8)  & 0xff).toBe(Math.floor(255 * 0.5));
    expect( result        & 0xff).toBe(0);
  });

  it('returns a value with R, G, B channels all < original (for white)', () => {
    const white = 0xffffff;
    const result = darken(white, 0.8);
    const r = (result >> 16) & 0xff;
    const g = (result >> 8)  & 0xff;
    const b =  result        & 0xff;
    expect(r).toBeLessThan(255);
    expect(g).toBeLessThan(255);
    expect(b).toBeLessThan(255);
  });

  it('amount=1.0 preserves original color', () => {
    expect(darken(0x123456, 1.0)).toBe(0x123456);
  });

  it('returns integer (no floating point channels)', () => {
    const result = darken(0xabcdef, 0.3);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ─── lighten ──────────────────────────────────────────────────────────────────

describe('lighten', () => {
  it('adds amt to each channel (default 60)', () => {
    // 0x000000 → each channel = min(255, 0+60) = 60
    const result = lighten(0x000000);
    const r = (result >> 16) & 0xff;
    const g = (result >> 8)  & 0xff;
    const b =  result        & 0xff;
    expect(r).toBe(60);
    expect(g).toBe(60);
    expect(b).toBe(60);
  });

  it('clamps each channel at 255', () => {
    // Near-max: 0xf0f0f0 (240 per channel) + 60 → clamped to 255
    const result = lighten(0xf0f0f0, 60);
    expect((result >> 16) & 0xff).toBe(255);
    expect((result >> 8)  & 0xff).toBe(255);
    expect( result        & 0xff).toBe(255);
  });

  it('white + any amount stays white', () => {
    expect(lighten(0xffffff, 100)).toBe(0xffffff);
  });

  it('only affects channels that need lightening', () => {
    // 0xff0000 (r=255, g=0, b=0) + 30
    const result = lighten(0xff0000, 30);
    expect((result >> 16) & 0xff).toBe(255); // clamped
    expect((result >> 8)  & 0xff).toBe(30);
    expect( result        & 0xff).toBe(30);
  });

  it('result is always >= input color per channel', () => {
    const c = 0x804020;
    const result = lighten(c, 40);
    const rIn  = (c >> 16) & 0xff;
    const gIn  = (c >> 8)  & 0xff;
    const bIn  =  c        & 0xff;
    expect((result >> 16) & 0xff).toBeGreaterThanOrEqual(rIn);
    expect((result >> 8)  & 0xff).toBeGreaterThanOrEqual(gIn);
    expect( result        & 0xff).toBeGreaterThanOrEqual(bIn);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(lighten(0x123456, 20))).toBe(true);
  });
});

// ─── computeLayout ────────────────────────────────────────────────────────────

describe('computeLayout', () => {
  const R = 40;
  const COLOR = 0xff4400;
  const layout = computeLayout(R, COLOR);

  it('cx equals radius (canvas is square: width = height = 2r)', () => {
    expect(layout.cx).toBe(R);
  });

  it('cy equals radius', () => {
    expect(layout.cy).toBe(R);
  });

  it('fill equals the provided color', () => {
    expect(layout.fill).toBe(COLOR);
  });

  it('hi (highlight) is lighter than fill', () => {
    // hi uses lighten(fill, 55)
    const hiR = (layout.hi >> 16) & 0xff;
    const fiR = (COLOR   >> 16) & 0xff;
    expect(hiR).toBeGreaterThanOrEqual(fiR);
  });

  it('dk (dark) is darker than fill', () => {
    // dk uses darken(fill, 0.55)
    const dkR = (layout.dk >> 16) & 0xff;
    const fiR = (COLOR    >> 16) & 0xff;
    expect(dkR).toBeLessThanOrEqual(fiR);
  });

  it('hr (head radius) is ~42% of r', () => {
    expect(layout.hr).toBeCloseTo(R * 0.42, 5);
  });

  it('body origin (by) is below head centre (hy)', () => {
    expect(layout.by).toBeGreaterThan(layout.hy);
  });

  it('bw (body width) is a positive fraction of r', () => {
    expect(layout.bw).toBeGreaterThan(0);
    expect(layout.bw).toBeLessThan(R);
  });

  it('bh (body height) is a positive fraction of r', () => {
    expect(layout.bh).toBeGreaterThan(0);
    expect(layout.bh).toBeLessThan(R);
  });

  it('scales proportionally with radius (double r → double all lengths)', () => {
    const l2 = computeLayout(R * 2, COLOR);
    expect(l2.hr).toBeCloseTo(layout.hr * 2, 5);
    expect(l2.bw).toBeCloseTo(layout.bw * 2, 5);
  });

  it('r field equals the provided radius', () => {
    expect(layout.r).toBe(R);
  });

  it('hx (head centre x) equals cx (canvas centre)', () => {
    expect(layout.hx).toBe(layout.cx);
  });

  it('hy (head centre y) is above canvas centre (cy - r×0.22)', () => {
    expect(layout.hy).toBeCloseTo(R - R * 0.22, 5);
    expect(layout.hy).toBeLessThan(layout.cy);
  });

  it('bw equals r × 0.68 exactly', () => {
    expect(layout.bw).toBeCloseTo(R * 0.68, 5);
  });

  it('bh equals r × 0.42 exactly', () => {
    expect(layout.bh).toBeCloseTo(R * 0.42, 5);
  });

  it('by equals hy + hr + r×0.02 (body top sits just below head bottom)', () => {
    expect(layout.by).toBeCloseTo(layout.hy + layout.hr + R * 0.02, 5);
  });
});

// ─── darken / lighten — zero-amount edge cases ───────────────────────────────

describe('darken — amount=0 edge case', () => {
  it('amount=0 returns black (all channels zeroed)', () => {
    expect(darken(0xffffff, 0)).toBe(0x000000);
    expect(darken(0xff8040, 0)).toBe(0x000000);
  });
});

describe('lighten — amount=0 edge case', () => {
  it('amount=0 returns original color unchanged', () => {
    expect(lighten(0x123456, 0)).toBe(0x123456);
    expect(lighten(0x000000, 0)).toBe(0x000000);
  });
});

// ─── darken — additional channel isolation ────────────────────────────────────

describe('darken — channel isolation', () => {
  it('pure blue 0x0000ff × 0.5 → only blue channel halved → 0x00007f', () => {
    // R=0, G=0, B=floor(255×0.5)=127=0x7f
    expect(darken(0x0000ff, 0.5)).toBe(0x00007f);
  });

  it('gray 0x888888 × 0.5 → all channels equal floor(136×0.5)=68 → 0x444444', () => {
    expect(darken(0x888888, 0.5)).toBe(0x444444);
  });

  it('darken composed: darken(lighten(x)) is darker than original', () => {
    const lit = lighten(0x606060, 40);   // 0x888888
    const dk  = darken(lit, 0.5);        // 0x444444
    expect(dk).toBeLessThan(0x606060);
  });
});

// ─── lighten — partial clamping ───────────────────────────────────────────────

describe('lighten — partial clamping', () => {
  it('clamps only channels that exceed 255 (0xf0f000 + 20)', () => {
    // R=min(255,0xf0+20)=255, G=min(255,0xf0+20)=255, B=min(255,0+20)=20
    expect(lighten(0xf0f000, 20)).toBe(0xffff14);
  });

  it('pure red 0xff0000 + 10: red clamps, green and blue each become 10', () => {
    expect(lighten(0xff0000, 10)).toBe(0xff0a0a);
  });
});

// ─── computeLayout — hi / dk formula cross-check ─────────────────────────────

describe('computeLayout — hi/dk formula cross-check', () => {
  it('hi === lighten(fill, 55)', () => {
    const layout = computeLayout(60, 0x44aaff);
    expect(layout.hi).toBe(lighten(0x44aaff, 55));
  });

  it('dk === darken(fill, 0.55)', () => {
    const layout = computeLayout(60, 0x44aaff);
    expect(layout.dk).toBe(darken(0x44aaff, 0.55));
  });
});
