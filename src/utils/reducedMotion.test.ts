import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReducedMotion } from './reducedMotion';

describe('getReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(getReducedMotion()).toBe(false);
  });

  it.each([true, false])('returns the media-query match state (%s)', matches => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })));
    expect(getReducedMotion()).toBe(matches);
    expect(globalThis.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
