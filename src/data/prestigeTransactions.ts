import {
  getPrestigeDmgMult,
  startPrestige,
  type GameState,
} from './wisdom';

export type PrestigeTransactionFailureReason = 'game_not_completed';

export type PrestigeStartResult =
  | {
      ok: true;
      state: GameState;
      changed: boolean;
      previousPrestigeLevel: number;
      nextPrestigeLevel: number;
      damageMultiplier: number;
    }
  | {
      ok: false;
      state: GameState;
      changed: false;
      reason: PrestigeTransactionFailureReason;
    };

export function applyPrestigeStart(state: GameState): PrestigeStartResult {
  if (!state.gameCompleted) {
    return {
      ok: false,
      state,
      changed: false,
      reason: 'game_not_completed',
    };
  }

  const previousPrestigeLevel = state.prestigeLevel ?? 0;
  const nextState = startPrestige(state);
  const nextPrestigeLevel = nextState.prestigeLevel ?? previousPrestigeLevel + 1;

  return {
    ok: true,
    state: nextState,
    changed: nextState !== state,
    previousPrestigeLevel,
    nextPrestigeLevel,
    damageMultiplier: getPrestigeDmgMult(nextState),
  };
}
