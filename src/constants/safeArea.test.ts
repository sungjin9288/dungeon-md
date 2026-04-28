import { describe, it, expect, beforeEach } from 'vitest';
import { getGameSafeArea, MIN_SAFE_TOP, MIN_SAFE_BOTTOM } from './safeArea';

// happy-dom provides getComputedStyle; we can inject CSS custom properties
// via document.documentElement.style.setProperty.

function setCssSafeArea(top: number, bottom: number, left = 0, right = 0): void {
  const root = document.documentElement;
  root.style.setProperty('--sat', String(top));
  root.style.setProperty('--sab', String(bottom));
  root.style.setProperty('--sal', String(left));
  root.style.setProperty('--sar', String(right));
}

function clearCssSafeArea(): void {
  const root = document.documentElement;
  root.style.removeProperty('--sat');
  root.style.removeProperty('--sab');
  root.style.removeProperty('--sal');
  root.style.removeProperty('--sar');
}

// ─── getGameSafeArea ──────────────────────────────────────────────────────────

describe('getGameSafeArea — structure', () => {
  beforeEach(() => clearCssSafeArea());

  it('returns a SafeArea object with top, bottom, left, right', () => {
    const sa = getGameSafeArea(1);
    expect(typeof sa.top).toBe('number');
    expect(typeof sa.bottom).toBe('number');
    expect(typeof sa.left).toBe('number');
    expect(typeof sa.right).toBe('number');
  });

  it('all values are non-negative integers', () => {
    const sa = getGameSafeArea(1);
    expect(sa.top).toBeGreaterThanOrEqual(0);
    expect(sa.bottom).toBeGreaterThanOrEqual(0);
    expect(sa.left).toBeGreaterThanOrEqual(0);
    expect(sa.right).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(sa.top)).toBe(true);
    expect(Number.isInteger(sa.bottom)).toBe(true);
  });

  it('returns zeros when no CSS custom properties are set', () => {
    const sa = getGameSafeArea(1);
    expect(sa.top).toBe(0);
    expect(sa.bottom).toBe(0);
    expect(sa.left).toBe(0);
    expect(sa.right).toBe(0);
  });
});

describe('getGameSafeArea — scale math', () => {
  beforeEach(() => clearCssSafeArea());

  it('displayScale=1 returns CSS pixel values directly (ceiled)', () => {
    setCssSafeArea(44, 34);
    const sa = getGameSafeArea(1);
    expect(sa.top).toBe(44);    // ceil(44/1) = 44
    expect(sa.bottom).toBe(34); // ceil(34/1) = 34
  });

  it('displayScale=2 halves the CSS pixel values (ceiled)', () => {
    setCssSafeArea(44, 34);
    const sa = getGameSafeArea(2);
    expect(sa.top).toBe(22);    // ceil(44/2) = 22
    expect(sa.bottom).toBe(17); // ceil(34/2) = 17
  });

  it('displayScale=0 falls back to 1 (guard against division by zero)', () => {
    setCssSafeArea(20, 10);
    const sa0 = getGameSafeArea(0);
    const sa1 = getGameSafeArea(1);
    expect(sa0.top).toBe(sa1.top);
    expect(sa0.bottom).toBe(sa1.bottom);
  });

  it('applies Math.ceil (non-integer result rounds up)', () => {
    setCssSafeArea(33, 0);
    // displayScale=2 → ceil(33/2) = ceil(16.5) = 17
    const sa = getGameSafeArea(2);
    expect(sa.top).toBe(17);
  });

  it('left and right scale the same way as top and bottom', () => {
    setCssSafeArea(0, 0, 16, 8);
    const sa = getGameSafeArea(2);
    expect(sa.left).toBe(8);   // ceil(16/2)
    expect(sa.right).toBe(4);  // ceil(8/2)
  });

  it('displayScale=1 default parameter behaves same as explicit 1', () => {
    setCssSafeArea(20, 10);
    expect(getGameSafeArea()).toStrictEqual(getGameSafeArea(1));
  });

  it('negative displayScale falls back to 1 (same as zero)', () => {
    setCssSafeArea(20, 10);
    expect(getGameSafeArea(-1)).toStrictEqual(getGameSafeArea(1));
    expect(getGameSafeArea(-5)).toStrictEqual(getGameSafeArea(1));
  });

  it('large displayScale scales insets down proportionally', () => {
    setCssSafeArea(100, 50);
    const sa = getGameSafeArea(10);
    expect(sa.top).toBe(10);    // ceil(100/10) = 10
    expect(sa.bottom).toBe(5);  // ceil(50/10) = 5
  });
});

// ─── MIN_SAFE_TOP / MIN_SAFE_BOTTOM constants ─────────────────────────────────

describe('MIN_SAFE_TOP / MIN_SAFE_BOTTOM constants', () => {
  it('MIN_SAFE_TOP is 0', () => {
    expect(MIN_SAFE_TOP).toBe(0);
  });

  it('MIN_SAFE_BOTTOM is 0', () => {
    expect(MIN_SAFE_BOTTOM).toBe(0);
  });
});
