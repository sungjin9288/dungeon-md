/**
 * Daily attendance (login) rewards.
 *
 * A 7-day reward cycle, claimable once per calendar day. Claiming advances the
 * cycle (wrapping after day 7) so long-term players keep collecting. Pure data +
 * logic — no Phaser, `today` is injected (ISO YYYY-MM-DD) for testability.
 *
 * State (GameState): `attendanceDay` = total rewards claimed (drives cycle
 * position), `lastAttendanceClaim` = ISO date of the last claim ('' = never).
 */

import type { GameState } from './wisdom';

export interface AttendanceReward {
  /** Cycle position 1–7 (display only). */
  day:           number;
  gold?:         number;
  gems?:         number;
  soulCrystals?: number;
}

/** 7-day cycle — escalating, with a weekly cap bonus on day 7. */
export const ATTENDANCE_REWARDS: readonly AttendanceReward[] = [
  { day: 1, gold: 100 },
  { day: 2, gems: 10 },
  { day: 3, gold: 250 },
  { day: 4, gems: 20 },
  { day: 5, soulCrystals: 10 },
  { day: 6, gems: 30 },
  { day: 7, gems: 50, gold: 500 },
];

export const ATTENDANCE_CYCLE = ATTENDANCE_REWARDS.length;

export interface AttendanceClaimResult {
  ok:        boolean;
  state:     GameState;
  reward?:   AttendanceReward;
  cycleDay?: number;   // 1–7
}

/** True when today's attendance reward has not yet been claimed. */
export function canClaimAttendance(state: GameState, today: string): boolean {
  return (state.lastAttendanceClaim ?? '') !== today;
}

/** The reward that the next claim would grant (for preview/highlight). */
export function nextAttendanceReward(state: GameState): AttendanceReward {
  return ATTENDANCE_REWARDS[(state.attendanceDay ?? 0) % ATTENDANCE_CYCLE];
}

/**
 * Claim today's attendance reward. Idempotent per calendar day: a second call
 * with the same `today` returns the input state reference unchanged.
 */
export function claimDailyAttendance(state: GameState, today: string): AttendanceClaimResult {
  if ((state.lastAttendanceClaim ?? '') === today) {
    return { ok: false, state };
  }

  const totalDays = state.attendanceDay ?? 0;
  const idx = totalDays % ATTENDANCE_CYCLE;
  const reward = ATTENDANCE_REWARDS[idx];

  return {
    ok: true,
    state: {
      ...state,
      homeGold:            (state.homeGold ?? 0) + (reward.gold ?? 0),
      gems:                (state.gems ?? 0) + (reward.gems ?? 0),
      soulCrystals:        (state.soulCrystals ?? 0) + (reward.soulCrystals ?? 0),
      attendanceDay:       totalDays + 1,
      lastAttendanceClaim: today,
    },
    reward,
    cycleDay: idx + 1,
  };
}
