import type { GameState } from './wisdom';

export interface StoryTransactionResult {
  state:   GameState;
  changed: boolean;
}

export interface GameCompletionResult extends StoryTransactionResult {
  soulCrystalBonus: number;
}

export function markCinematicSeen(
  state: GameState,
  cinematicId: string,
): StoryTransactionResult {
  const cinematicSeen = state.cinematicSeen ?? [];
  if (cinematicSeen.includes(cinematicId)) {
    return { state, changed: false };
  }

  return {
    state: { ...state, cinematicSeen: [...cinematicSeen, cinematicId] },
    changed: true,
  };
}

export function applyGameCompletionReward(
  state: GameState,
  soulCrystalBonus = 50,
): GameCompletionResult {
  if (state.gameCompleted) {
    return { state, changed: false, soulCrystalBonus: 0 };
  }

  return {
    state: {
      ...state,
      soulCrystals: (state.soulCrystals ?? 0) + soulCrystalBonus,
      gameCompleted: true,
    },
    changed: true,
    soulCrystalBonus,
  };
}
