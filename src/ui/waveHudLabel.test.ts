import { describe, it, expect } from 'vitest';
import { getWaveHudLabel } from './waveHudLabel';

describe('getWaveHudLabel', () => {
  it('counts waves and flags the final one while it is being fought', () => {
    expect(getWaveHudLabel(3, 10)).toEqual({ text: '침략 3/10', tone: 'normal' });
    expect(getWaveHudLabel(10, 10)).toEqual({ text: '⚠ 최종 침략!', tone: 'final' });
  });

  it('stops warning once the final wave is cleared (result screen)', () => {
    expect(getWaveHudLabel(10, 10, 'clear')).toEqual({ text: '✓ 침략 격퇴', tone: 'clear' });
  });

  it('keeps endless mode on its open counter', () => {
    expect(getWaveHudLabel(0, 9999)).toEqual({ text: '침략 대기', tone: 'normal' });
    expect(getWaveHudLabel(42, 9999, 'clear')).toEqual({ text: '침략 42', tone: 'normal' });
  });
});
