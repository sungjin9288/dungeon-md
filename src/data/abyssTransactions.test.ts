import { describe, it, expect } from 'vitest';
import type { GameState } from './wisdom';
import { ABYSS_KEY_MAX, type AbyssState } from './abyss';
import {
  refillAbyssKeysIfNewDay,
  sweepAbyssFloor,
  clearAbyssFloor,
} from './abyssTransactions';

const ALWAYS = () => 0; // every loot entry drops

function makeState(abyss: Partial<AbyssState> = {}, overrides: Partial<GameState> = {}): GameState {
  return {
    materials: {},
    awakeningStones: 0,
    homeGold: 100,
    abyss: { highestFloor: 5, keys: 3, lastRefill: '2026-06-16', ...abyss },
    ...overrides,
  } as GameState;
}

describe('refillAbyssKeysIfNewDay', () => {
  it('refills on a new day', () => {
    const s = makeState({ keys: 0, lastRefill: '2026-06-15' });
    const out = refillAbyssKeysIfNewDay(s, '2026-06-16');
    expect(out.abyss.keys).toBe(ABYSS_KEY_MAX);
    expect(out.abyss.lastRefill).toBe('2026-06-16');
  });

  it('no-op on the same day (same reference)', () => {
    const s = makeState({ keys: 2, lastRefill: '2026-06-16' });
    expect(refillAbyssKeysIfNewDay(s, '2026-06-16')).toBe(s);
  });
});

describe('sweepAbyssFloor', () => {
  it('rejects an uncleared (locked) floor', () => {
    const s = makeState({ highestFloor: 5 });
    const r = sweepAbyssFloor(s, 6, '2026-06-16', ALWAYS);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('locked');
    expect(r.loot).toBeNull();
  });

  it('rejects when out of keys (same day)', () => {
    const s = makeState({ highestFloor: 5, keys: 0, lastRefill: '2026-06-16' });
    const r = sweepAbyssFloor(s, 3, '2026-06-16', ALWAYS);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_keys');
  });

  it('succeeds: consumes a key and grants loot', () => {
    const s = makeState({ highestFloor: 5, keys: 3, lastRefill: '2026-06-16' });
    const r = sweepAbyssFloor(s, 5, '2026-06-16', ALWAYS);
    expect(r.ok).toBe(true);
    expect(r.state.abyss.keys).toBe(2);
    expect(Object.keys(r.state.materials).length).toBeGreaterThan(0);
    expect(r.state.homeGold).toBeGreaterThan(100);
    expect(r.loot).not.toBeNull();
  });

  it('refills keys on day rollover before sweeping', () => {
    const s = makeState({ highestFloor: 5, keys: 0, lastRefill: '2026-06-15' });
    const r = sweepAbyssFloor(s, 5, '2026-06-16', ALWAYS);
    expect(r.ok).toBe(true);
    expect(r.state.abyss.keys).toBe(ABYSS_KEY_MAX - 1);
  });

  it('does not mutate the input state', () => {
    const s = makeState({ highestFloor: 5, keys: 3, lastRefill: '2026-06-16' });
    sweepAbyssFloor(s, 5, '2026-06-16', ALWAYS);
    expect(s.abyss.keys).toBe(3);
    expect(Object.keys(s.materials).length).toBe(0);
    expect(s.homeGold).toBe(100);
  });
});

describe('clearAbyssFloor', () => {
  it('first-clear of the next floor advances depth + grants loot', () => {
    const s = makeState({ highestFloor: 5 });
    const r = clearAbyssFloor(s, 6, ALWAYS);
    expect(r.firstClear).toBe(true);
    expect(r.state.abyss.highestFloor).toBe(6);
    expect(Object.keys(r.state.materials).length).toBeGreaterThan(0);
  });

  it('replaying a cleared floor does not advance depth', () => {
    const s = makeState({ highestFloor: 5 });
    const r = clearAbyssFloor(s, 3, ALWAYS);
    expect(r.firstClear).toBe(false);
    expect(r.state.abyss.highestFloor).toBe(5);
    expect(Object.keys(r.state.materials).length).toBeGreaterThan(0);
  });

  it('does not cost keys (battle clears are key-free)', () => {
    const s = makeState({ highestFloor: 5, keys: 3 });
    const r = clearAbyssFloor(s, 6, ALWAYS);
    expect(r.state.abyss.keys).toBe(3);
  });

  it('does not mutate the input state', () => {
    const s = makeState({ highestFloor: 5 });
    clearAbyssFloor(s, 6, ALWAYS);
    expect(s.abyss.highestFloor).toBe(5);
    expect(Object.keys(s.materials).length).toBe(0);
  });
});
