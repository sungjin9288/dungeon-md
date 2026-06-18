import { describe, it, expect, beforeEach } from 'vitest';
import { loadBattleSpeed, saveBattleSpeed } from './battleSpeedSetting';

describe('battleSpeedSetting', () => {
  beforeEach(() => {
    try { globalThis.localStorage?.removeItem('dungeonBattleSpeed'); } catch { /* no-op */ }
  });

  it('defaults to 1× when nothing is saved', () => {
    expect(loadBattleSpeed()).toBe(1);
  });

  it('round-trips 2× and 3×', () => {
    saveBattleSpeed(2);
    expect(loadBattleSpeed()).toBe(2);
    saveBattleSpeed(3);
    expect(loadBattleSpeed()).toBe(3);
  });

  it('clamps out-of-range or non-numeric stored values to 1×', () => {
    try { globalThis.localStorage?.setItem('dungeonBattleSpeed', '9'); } catch { /* no-op */ }
    expect(loadBattleSpeed()).toBe(1);
    try { globalThis.localStorage?.setItem('dungeonBattleSpeed', 'abc'); } catch { /* no-op */ }
    expect(loadBattleSpeed()).toBe(1);
    try { globalThis.localStorage?.setItem('dungeonBattleSpeed', '0'); } catch { /* no-op */ }
    expect(loadBattleSpeed()).toBe(1);
  });
});
