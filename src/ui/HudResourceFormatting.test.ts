import { describe, expect, it } from 'vitest';
import { formatHudResourceValue } from './HudResourceFormatting';

describe('formatHudResourceValue', () => {
  it.each([
    [0, '0'],
    [9_999, '9,999'],
    [10_000, '1만'],
    [50_000, '5만'],
    [125_000_000, '1.3억'],
  ])('keeps %i bounded as %s', (value, expected) => {
    expect(formatHudResourceValue(value)).toBe(expected);
  });

  it('normalizes invalid and negative values for the HUD', () => {
    expect(formatHudResourceValue(Number.NaN)).toBe('0');
    expect(formatHudResourceValue(-1)).toBe('0');
  });
});
