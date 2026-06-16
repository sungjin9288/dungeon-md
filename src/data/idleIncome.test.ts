import { describe, it, expect } from 'vitest';
import type { GameState, DungeonSlot } from './wisdom';
import {
  dungeonGoldPerMin,
  computeIdleReward,
  collectIdleIncome,
  startIdleClock,
  IDLE_CAP_MS,
  IDLE_BASE_PER_MIN,
  IDLE_PER_ROOM,
  IDLE_PER_LEVEL,
  IDLE_PER_GUARDIAN,
  IDLE_DM_BONUS,
} from './idleIncome';

function slot(roomType: string | undefined, roomLevel = 1, monsterIds: (string | undefined)[] = []): DungeonSlot {
  return { roomType: roomType as DungeonSlot['roomType'], monsterIds, trapIds: [], roomLevel, hp: 100, maxHp: 100 };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 1000,
    dmLevel: 1,
    dungeonSlots: [],
    lastIdleCollect: 0,
    ...overrides,
  } as GameState;
}

describe('dungeonGoldPerMin', () => {
  it('is 0 with no built rooms', () => {
    expect(dungeonGoldPerMin(makeState())).toBe(0);
    expect(dungeonGoldPerMin(makeState({ dungeonSlots: [slot(undefined)] }))).toBe(0);
  });

  it('scales with rooms, levels, guardians, and DM level', () => {
    const state = makeState({
      dmLevel: 1,
      dungeonSlots: [
        slot('combat', 3, ['m1', 'm2']),   // +1 room, +2 levels, +2 guardians
        slot('trap', 1, []),               // +1 room
      ],
    });
    const raw = IDLE_BASE_PER_MIN + 2 * IDLE_PER_ROOM + 2 * IDLE_PER_LEVEL + 2 * IDLE_PER_GUARDIAN;
    const expected = raw * (1 + 1 * IDLE_DM_BONUS);
    expect(dungeonGoldPerMin(state)).toBeCloseTo(expected, 5);
  });

  it('higher DM level increases the rate', () => {
    const slots = [slot('combat', 1, ['m1'])];
    const low  = dungeonGoldPerMin(makeState({ dmLevel: 1,  dungeonSlots: slots }));
    const high = dungeonGoldPerMin(makeState({ dmLevel: 20, dungeonSlots: slots }));
    expect(high).toBeGreaterThan(low);
  });

  it('ignores undefined monster slots when counting guardians', () => {
    const a = dungeonGoldPerMin(makeState({ dungeonSlots: [slot('combat', 1, ['m1', undefined, undefined])] }));
    const b = dungeonGoldPerMin(makeState({ dungeonSlots: [slot('combat', 1, ['m1'])] }));
    expect(a).toBe(b);
  });
});

describe('computeIdleReward', () => {
  const built = makeState({ dungeonSlots: [slot('combat', 2, ['m1'])], lastIdleCollect: 1_000_000 });

  it('pays nothing on an uninitialized clock', () => {
    const r = computeIdleReward(makeState({ dungeonSlots: [slot('combat', 2, ['m1'])], lastIdleCollect: 0 }), 9_999_999);
    expect(r.gold).toBe(0);
    expect(r.creditedMs).toBe(0);
  });

  it('pays proportional to elapsed minutes', () => {
    const rate = dungeonGoldPerMin(built);
    const now = built.lastIdleCollect + 30 * 60_000;   // 30 minutes
    const r = computeIdleReward(built, now);
    expect(r.gold).toBe(Math.floor(rate * 30));
    expect(r.capped).toBe(false);
  });

  it('caps accumulation at IDLE_CAP_MS', () => {
    const rate = dungeonGoldPerMin(built);
    const now = built.lastIdleCollect + IDLE_CAP_MS * 3;   // way past the cap
    const r = computeIdleReward(built, now);
    expect(r.capped).toBe(true);
    expect(r.creditedMs).toBe(IDLE_CAP_MS);
    expect(r.gold).toBe(Math.floor(rate * (IDLE_CAP_MS / 60_000)));
  });

  it('never pays negative for a clock in the future', () => {
    const r = computeIdleReward({ ...built, lastIdleCollect: 5_000_000 }, 4_000_000);
    expect(r.gold).toBe(0);
  });
});

describe('collectIdleIncome', () => {
  it('credits gold and resets the clock immutably', () => {
    const before = makeState({ homeGold: 500, dungeonSlots: [slot('combat', 2, ['m1'])], lastIdleCollect: 1_000_000 });
    const now = before.lastIdleCollect + 60 * 60_000;   // 1 hour
    const { state, reward } = collectIdleIncome(before, now);
    expect(reward.gold).toBeGreaterThan(0);
    expect(state.homeGold).toBe(500 + reward.gold);
    expect(state.lastIdleCollect).toBe(now);
    // input untouched
    expect(before.homeGold).toBe(500);
    expect(before.lastIdleCollect).toBe(1_000_000);
  });

  it('still advances the clock when payout is 0 (no rooms)', () => {
    const before = makeState({ dungeonSlots: [], lastIdleCollect: 1_000_000 });
    const { state, reward } = collectIdleIncome(before, 2_000_000);
    expect(reward.gold).toBe(0);
    expect(state.lastIdleCollect).toBe(2_000_000);
  });
});

describe('computeIdleReward with production facilities', () => {
  it('adds facility materials + treasury gold over the credited window', () => {
    const state = makeState({
      dungeonSlots: [],                          // no operation gold
      productionFacilities: { mine: 1, treasury: 1 },
      lastIdleCollect: 1_000_000,
    });
    const now = state.lastIdleCollect + 60 * 60_000;   // 1 hour
    const r = computeIdleReward(state, now);
    expect(r.materials.common_ore).toBe(2);   // mine lvl1 = 2/hr
    expect(r.gold).toBe(100);                  // treasury lvl1 = 100/hr (no operation gold)
  });

  it('facility production also respects the cap', () => {
    const state = makeState({ productionFacilities: { mine: 1 }, lastIdleCollect: 1_000_000 });
    const now = state.lastIdleCollect + IDLE_CAP_MS * 5;
    const r = computeIdleReward(state, now);
    expect(r.materials.common_ore).toBe(Math.floor(2 * (IDLE_CAP_MS / 3_600_000)));
  });
});

describe('collectIdleIncome credits materials', () => {
  it('merges produced materials into gs.materials', () => {
    const before = makeState({
      homeGold: 0,
      materials: { common_ore: 5 },
      productionFacilities: { mine: 2 },        // 4/hr
      lastIdleCollect: 1_000_000,
    });
    const now = before.lastIdleCollect + 60 * 60_000;
    const { state, reward } = collectIdleIncome(before, now);
    expect(reward.materials.common_ore).toBe(4);
    expect(state.materials.common_ore).toBe(5 + 4);
    expect(before.materials.common_ore).toBe(5);   // input untouched
  });
});

describe('startIdleClock', () => {
  it('initializes an unset clock', () => {
    expect(startIdleClock(makeState({ lastIdleCollect: 0 }), 12345).lastIdleCollect).toBe(12345);
  });
  it('is a no-op once the clock is running', () => {
    const s = makeState({ lastIdleCollect: 999 });
    expect(startIdleClock(s, 12345)).toBe(s);
  });
});
