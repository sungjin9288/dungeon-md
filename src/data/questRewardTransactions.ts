import { STARTER_BLUEPRINTS } from './fusion';
import type { GameState } from './wisdom';

export const QUEST_BLUEPRINT_REWARDS: Record<string, string> = {
  'MQ-015': 'bp_ore_plate',
  'MQ-020': 'bp_arcane_core',
  'MQ-025': 'bp_guardian_crown',
  'MQ-030': 'bp_celestial_lance',
  'MQ-034': 'bp_divine_aegis',
  'MQ-038': 'bp_void_blade',
  'MQ-041': 'bp_abyss_mail',
  'MQ-044': 'bp_primordial_gem',
};

export interface MainQuestCompletionRewardResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly unlockedBlueprintIds: string[];
  readonly awakeningStonesAwarded: number;
}

export function applyMainQuestCompletionRewards(
  state: GameState,
  questId: string,
): MainQuestCompletionRewardResult {
  const previousBlueprints = state.blueprints ?? [];
  const blueprintCandidates = [
    ...(questId === 'MQ-007' ? STARTER_BLUEPRINTS : []),
    ...(QUEST_BLUEPRINT_REWARDS[questId] ? [QUEST_BLUEPRINT_REWARDS[questId]] : []),
  ];

  const unlockedBlueprintIds = blueprintCandidates.filter(
    blueprintId => !previousBlueprints.includes(blueprintId),
  );
  const awakeningStonesAwarded = questId === 'MQ-010' ? 1 : 0;

  if (unlockedBlueprintIds.length === 0 && awakeningStonesAwarded === 0) {
    return {
      state,
      changed: false,
      unlockedBlueprintIds: [],
      awakeningStonesAwarded: 0,
    };
  }

  return {
    state: {
      ...state,
      blueprints: unlockedBlueprintIds.length > 0
        ? [...previousBlueprints, ...unlockedBlueprintIds]
        : previousBlueprints,
      awakeningStones: (state.awakeningStones ?? 0) + awakeningStonesAwarded,
    },
    changed: true,
    unlockedBlueprintIds,
    awakeningStonesAwarded,
  };
}
