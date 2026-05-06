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

// ─── getGameSafeArea — additional edge cases ──────────────────────────────────

describe('getGameSafeArea — additional edge cases', () => {
  beforeEach(() => clearCssSafeArea());

  it('fractional displayScale=0.5 doubles the insets (scales up)', () => {
    setCssSafeArea(44, 34);
    const sa = getGameSafeArea(0.5);
    expect(sa.top).toBe(88);     // ceil(44 / 0.5) = 88
    expect(sa.bottom).toBe(68);  // ceil(34 / 0.5) = 68
  });

  it('displayScale=3 with non-divisible value uses Math.ceil', () => {
    setCssSafeArea(10, 10);
    const sa = getGameSafeArea(3);
    expect(sa.top).toBe(4);     // ceil(10 / 3) = ceil(3.333) = 4
    expect(sa.bottom).toBe(4);
  });

  it('all four fields (including left and right) are non-negative integers', () => {
    setCssSafeArea(44, 34, 16, 9);
    const sa = getGameSafeArea(1);
    for (const key of ['top', 'bottom', 'left', 'right'] as const) {
      expect(sa[key], `${key} not integer`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(sa[key]), `${key} not integer`).toBe(true);
    }
  });

  it('returned object has exactly the four keys: top, bottom, left, right', () => {
    const sa = getGameSafeArea(1);
    expect(Object.keys(sa).sort()).toStrictEqual(['bottom', 'left', 'right', 'top']);
  });

  it('two calls with the same scale return deeply equal results (idempotent)', () => {
    setCssSafeArea(44, 34, 16, 8);
    const a = getGameSafeArea(2);
    const b = getGameSafeArea(2);
    expect(a).toStrictEqual(b);
  });

  it('all four asymmetric insets scale independently', () => {
    setCssSafeArea(40, 30, 20, 10);
    const sa = getGameSafeArea(2);
    expect(sa.top).toBe(20);    // ceil(40/2)
    expect(sa.bottom).toBe(15); // ceil(30/2)
    expect(sa.left).toBe(10);   // ceil(20/2)
    expect(sa.right).toBe(5);   // ceil(10/2)
  });

  it('left and right are 0 when only top/bottom CSS vars are set', () => {
    setCssSafeArea(20, 10); // left/right default to 0 in helper
    const sa = getGameSafeArea(1);
    expect(sa.left).toBe(0);
    expect(sa.right).toBe(0);
  });

  it('CSS vars explicitly set to 0 return all-zero SafeArea', () => {
    setCssSafeArea(0, 0, 0, 0);
    const sa = getGameSafeArea(1);
    expect(sa.top).toBe(0);
    expect(sa.bottom).toBe(0);
    expect(sa.left).toBe(0);
    expect(sa.right).toBe(0);
  });

  it('reads CSS vars fresh each call — no caching between calls', () => {
    setCssSafeArea(20, 10);
    const first = getGameSafeArea(1);
    setCssSafeArea(60, 30);
    const second = getGameSafeArea(1);
    expect(first.top).toBe(20);
    expect(second.top).toBe(60);  // reflects the updated var, not cached value
  });

  it('CSS vars cleared between calls → second call returns zeros', () => {
    setCssSafeArea(44, 34);
    getGameSafeArea(1); // prime with values
    clearCssSafeArea();
    const sa = getGameSafeArea(1);
    expect(sa.top).toBe(0);
    expect(sa.bottom).toBe(0);
  });

  it('displayScale=0.25 scales insets up by 4× (ceil(44/0.25)=176)', () => {
    setCssSafeArea(44, 34);
    const sa = getGameSafeArea(0.25);
    expect(sa.top).toBe(176);    // ceil(44 / 0.25) = 176
    expect(sa.bottom).toBe(136); // ceil(34 / 0.25) = 136
  });

  it('bottom and left channels are also ceiled for non-divisible values', () => {
    // scale=2: ceil(33/2)=17 for both bottom and left
    setCssSafeArea(0, 33, 33, 0);
    const sa = getGameSafeArea(2);
    expect(sa.bottom).toBe(17); // ceil(33/2) = ceil(16.5) = 17
    expect(sa.left).toBe(17);   // same
  });
});

// ─── getGameSafeArea — non-integer scale & large values ──────────────────────

describe('getGameSafeArea — non-integer scale & large insets', () => {
  beforeEach(() => clearCssSafeArea());

  it('displayScale=1.5 (non-integer) ceils correctly: ceil(44/1.5)=30', () => {
    setCssSafeArea(44, 0);
    const sa = getGameSafeArea(1.5);
    expect(sa.top).toBe(30); // ceil(44 / 1.5) = ceil(29.33) = 30
  });

  it('displayScale=0.1 scales insets up by 10×: ceil(10/0.1)=100', () => {
    setCssSafeArea(10, 20);
    const sa = getGameSafeArea(0.1);
    expect(sa.top).toBe(100);    // ceil(10 / 0.1) = 100
    expect(sa.bottom).toBe(200); // ceil(20 / 0.1) = 200
  });

  it('all four insets set to the same value return equal fields', () => {
    setCssSafeArea(30, 30, 30, 30);
    const sa = getGameSafeArea(1);
    expect(sa.top).toBe(sa.bottom);
    expect(sa.bottom).toBe(sa.left);
    expect(sa.left).toBe(sa.right);
    expect(sa.top).toBe(30);
  });

  it('large inset (1000) with displayScale=4 → ceil(1000/4)=250', () => {
    setCssSafeArea(1000, 800);
    const sa = getGameSafeArea(4);
    expect(sa.top).toBe(250);    // ceil(1000/4) = 250
    expect(sa.bottom).toBe(200); // ceil(800/4) = 200
  });

  it('MIN_SAFE_TOP and MIN_SAFE_BOTTOM are both typeof number', () => {
    expect(typeof MIN_SAFE_TOP).toBe('number');
    expect(typeof MIN_SAFE_BOTTOM).toBe('number');
  });

  it('two calls to getGameSafeArea return different object references', () => {
    setCssSafeArea(44, 34);
    const a = getGameSafeArea(1);
    const b = getGameSafeArea(1);
    expect(a).not.toBe(b);        // different object references
    expect(a).toStrictEqual(b);   // but same values
  });

  it('only top set: displayScale=2 → ceil(60/2)=30, others remain 0', () => {
    setCssSafeArea(60, 0, 0, 0);
    const sa = getGameSafeArea(2);
    expect(sa.top).toBe(30);
    expect(sa.bottom).toBe(0);
    expect(sa.left).toBe(0);
    expect(sa.right).toBe(0);
  });
});
