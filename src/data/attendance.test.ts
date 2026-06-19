import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_REWARDS,
  ATTENDANCE_CYCLE,
  canClaimAttendance,
  nextAttendanceReward,
  claimDailyAttendance,
} from './attendance';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    homeGold: 0,
    gems: 0,
    soulCrystals: 0,
    attendanceDay: 0,
    lastAttendanceClaim: '',
    ...overrides,
  } as GameState;
}

describe('ATTENDANCE_REWARDS data', () => {
  it('is a 7-day cycle with day fields 1..7 in order', () => {
    expect(ATTENDANCE_CYCLE).toBe(7);
    ATTENDANCE_REWARDS.forEach((r, i) => expect(r.day).toBe(i + 1));
  });

  it('every reward grants at least one currency', () => {
    for (const r of ATTENDANCE_REWARDS) {
      const total = (r.gold ?? 0) + (r.gems ?? 0) + (r.soulCrystals ?? 0);
      expect(total, `day ${r.day}`).toBeGreaterThan(0);
    }
  });
});

describe('claimDailyAttendance', () => {
  it('grants day-1 reward on the first claim and advances the cycle', () => {
    const state = makeState({ homeGold: 50, gems: 5 });
    const r = claimDailyAttendance(state, '2026-06-19');

    expect(r.ok).toBe(true);
    expect(r.cycleDay).toBe(1);
    expect(r.reward).toBe(ATTENDANCE_REWARDS[0]);
    expect(r.state.homeGold).toBe(50 + 100); // day-1 = 100 gold
    expect(r.state.attendanceDay).toBe(1);
    expect(r.state.lastAttendanceClaim).toBe('2026-06-19');
    // immutability
    expect(state.homeGold).toBe(50);
    expect(state.attendanceDay).toBe(0);
  });

  it('is idempotent per calendar day — a second same-day claim is rejected', () => {
    const first = claimDailyAttendance(makeState(), '2026-06-19');
    const second = claimDailyAttendance(first.state, '2026-06-19');
    expect(second.ok).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('claims the next cycle reward on a new day', () => {
    const day1 = claimDailyAttendance(makeState(), '2026-06-19');
    const day2 = claimDailyAttendance(day1.state, '2026-06-20');
    expect(day2.ok).toBe(true);
    expect(day2.cycleDay).toBe(2);
    expect(day2.state.gems).toBe(10); // day-2 = 10 gems
    expect(day2.state.attendanceDay).toBe(2);
  });

  it('wraps back to day 1 after a full 7-day cycle', () => {
    const state = makeState({ attendanceDay: 7, lastAttendanceClaim: '2026-06-18' });
    const r = claimDailyAttendance(state, '2026-06-19');
    expect(r.cycleDay).toBe(1);              // 7 % 7 = 0 → day 1
    expect(r.reward).toBe(ATTENDANCE_REWARDS[0]);
    expect(r.state.attendanceDay).toBe(8);
  });

  it('grants the day-7 weekly bonus (gems + gold)', () => {
    const state = makeState({ attendanceDay: 6, lastAttendanceClaim: '2026-06-18' });
    const r = claimDailyAttendance(state, '2026-06-19');
    expect(r.cycleDay).toBe(7);
    expect(r.state.gems).toBe(50);
    expect(r.state.homeGold).toBe(500);
  });
});

describe('canClaimAttendance / nextAttendanceReward', () => {
  it('canClaim is true on a fresh day and false after claiming', () => {
    const state = makeState();
    expect(canClaimAttendance(state, '2026-06-19')).toBe(true);
    const r = claimDailyAttendance(state, '2026-06-19');
    expect(canClaimAttendance(r.state, '2026-06-19')).toBe(false);
  });

  it('nextAttendanceReward reflects the upcoming cycle position', () => {
    expect(nextAttendanceReward(makeState({ attendanceDay: 0 }))).toBe(ATTENDANCE_REWARDS[0]);
    expect(nextAttendanceReward(makeState({ attendanceDay: 3 }))).toBe(ATTENDANCE_REWARDS[3]);
    expect(nextAttendanceReward(makeState({ attendanceDay: 7 }))).toBe(ATTENDANCE_REWARDS[0]);
  });
});
