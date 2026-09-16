import { addXp, type OwnedMonster } from './barracks';
import {
  COMBINATION_TABLE,
  HYBRID_DEFS,
  RARITY_XP_VALUES,
  combinationKey,
  getBaseId,
  getNextEvolution,
  getMonsterRarity,
  resolveFusionMonsterDef,
  type HybridDef,
} from './fusion';
import { applyQuestObjectiveUpdate, tickSubQuestProgress } from './quests';
import type { GameState } from './wisdom';

export const FUSION_COMBINATION_COST = 100;

export type FusionTransactionFailureReason =
  | 'missing_combination_slots'
  | 'insufficient_soul_crystals'
  | 'combination_source_not_owned'
  | 'missing_evolution_slots'
  | 'mismatched_evolution_slots'
  | 'evolution_not_available'
  | 'insufficient_evolution_materials'
  | 'missing_absorption_target'
  | 'missing_absorption_sacrifices'
  | 'absorption_target_not_owned'
  | 'absorption_target_selected_as_sacrifice'
  | 'insufficient_absorption_materials'
  | 'missing_awakening_target'
  | 'awakening_target_not_owned'
  | 'monster_already_awakened'
  | 'insufficient_awakening_affinity'
  | 'insufficient_awakening_stones';

export type FusionCombinationResult =
  | {
      ok: true;
      state: GameState;
      recipeMatched: true;
      recipeKey: string;
      hybridId: string;
      hybrid: HybridDef;
      isNewDiscovery: boolean;
      monster: OwnedMonster;
    }
  | {
      ok: true;
      state: GameState;
      recipeMatched: false;
      recipeKey: string;
    }
  | { ok: false; state: GameState; reason: FusionTransactionFailureReason };

export type FusionEvolutionResult =
  | {
      ok: true;
      state: GameState;
      consumedMonsterId: string;
      resultId: string;
      monster: OwnedMonster;
    }
  | { ok: false; state: GameState; reason: FusionTransactionFailureReason };

export type FusionAbsorptionResult =
  | {
      ok: true;
      state: GameState;
      target: OwnedMonster;
      totalXp: number;
      sameTypeCount: number;
      newStacks: number;
      levelled: boolean;
    }
  | { ok: false; state: GameState; reason: FusionTransactionFailureReason };

export type FusionAwakeningResult =
  | {
      ok: true;
      state: GameState;
      monsterId: string;
      monster: OwnedMonster;
      affectedCount: number;
    }
  | { ok: false; state: GameState; reason: FusionTransactionFailureReason };

function applySuccessfulFusionProgress(state: GameState): GameState {
  const withCounter = {
    ...state,
    totalFusions: (state.totalFusions ?? 0) + 1,
  };
  const [questUpdated] = applyQuestObjectiveUpdate(withCounter, 'fuse_monsters');
  return tickSubQuestProgress(questUpdated, 'fuse_monsters');
}

export function applyFusionCombination(
  state: GameState,
  slotA: OwnedMonster | null,
  slotB: OwnedMonster | null,
  soulCrystalCost = FUSION_COMBINATION_COST,
): FusionCombinationResult {
  if (!slotA || !slotB) {
    return { ok: false, state, reason: 'missing_combination_slots' };
  }
  if ((state.soulCrystals ?? 0) < soulCrystalCost) {
    return { ok: false, state, reason: 'insufficient_soul_crystals' };
  }

  const remainingSources = [...(state.ownedMonsters ?? [])];
  const takeOwnedSource = (selection: OwnedMonster): OwnedMonster | null => {
    let index = remainingSources.findIndex(monster =>
      monster.id === selection.id && monster.level === selection.level,
    );
    if (index < 0) index = remainingSources.findIndex(monster => monster.id === selection.id);
    if (index < 0) return null;
    return remainingSources.splice(index, 1)[0];
  };
  const sourceA = takeOwnedSource(slotA);
  const sourceB = takeOwnedSource(slotB);
  if (!sourceA || !sourceB) {
    return { ok: false, state, reason: 'combination_source_not_owned' };
  }

  const recipeKey = combinationKey(sourceA.id, sourceB.id);
  const hybridId = COMBINATION_TABLE[recipeKey];
  if (!hybridId) {
    return {
      ok: true,
      recipeMatched: false,
      recipeKey,
      state: {
        ...state,
        soulCrystals: (state.soulCrystals ?? 0) - soulCrystalCost,
      },
    };
  }

  const hybrid = resolveFusionMonsterDef(hybridId) ?? HYBRID_DEFS[hybridId];
  const discoveredCombinations = state.discoveredCombinations ?? [];
  const isNewDiscovery = !discoveredCombinations.includes(hybridId);
  const monster: OwnedMonster = {
    id: hybridId,
    level: Math.round((sourceA.level + sourceB.level) / 2),
    xp: 0,
    skillPoints: 0,
    spentSkills: {},
    equippedSkills: [],
    equipment: null,
    rarity: hybrid.rarity,
    absorptionStacks: 0,
  };

  const nextState = applySuccessfulFusionProgress({
    ...state,
    soulCrystals: (state.soulCrystals ?? 0) - soulCrystalCost,
    ownedMonsters: [...(state.ownedMonsters ?? []), monster],
    discoveredCombinations: isNewDiscovery
      ? [...discoveredCombinations, hybridId]
      : discoveredCombinations,
  });

  return {
    ok: true,
    state: nextState,
    recipeMatched: true,
    recipeKey,
    hybridId,
    hybrid,
    isNewDiscovery,
    monster,
  };
}

export function applyFusionEvolution(
  state: GameState,
  slots: readonly (OwnedMonster | null)[],
): FusionEvolutionResult {
  const selected = slots.filter((slot): slot is OwnedMonster => slot !== null);
  if (selected.length !== 3) {
    return { ok: false, state, reason: 'missing_evolution_slots' };
  }

  const consumedMonsterId = selected[0].id;
  if (!selected.every(monster => monster.id === consumedMonsterId)) {
    return { ok: false, state, reason: 'mismatched_evolution_slots' };
  }

  const tier = getNextEvolution(consumedMonsterId);
  if (!tier) {
    return { ok: false, state, reason: 'evolution_not_available' };
  }

  const ownedMonsters = state.ownedMonsters ?? [];
  const matchingCount = ownedMonsters.filter(monster => monster.id === consumedMonsterId).length;
  if (matchingCount < 3) {
    return { ok: false, state, reason: 'insufficient_evolution_materials' };
  }

  const maxLevel = Math.max(...selected.map(monster => monster.level));
  let toRemove = 3;
  const remainingMonsters = ownedMonsters.filter(monster => {
    if (toRemove > 0 && monster.id === consumedMonsterId) {
      toRemove--;
      return false;
    }
    return true;
  });

  const evolved: OwnedMonster = {
    id: tier.resultId,
    level: maxLevel,
    xp: 0,
    skillPoints: 0,
    spentSkills: { [tier.unlockedSkill]: 1 },
    equippedSkills: [],
    equipment: null,
    rarity: tier.rarity,
    absorptionStacks: 0,
  };

  return {
    ok: true,
    state: applySuccessfulFusionProgress({
      ...state,
      ownedMonsters: [...remainingMonsters, evolved],
    }),
    consumedMonsterId,
    resultId: tier.resultId,
    monster: evolved,
  };
}

function countById(monsters: readonly OwnedMonster[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const monster of monsters) {
    counts.set(monster.id, (counts.get(monster.id) ?? 0) + 1);
  }
  return counts;
}

export function applyFusionAbsorption(
  state: GameState,
  target: OwnedMonster | null,
  sacrifices: readonly OwnedMonster[],
): FusionAbsorptionResult {
  if (!target) {
    return { ok: false, state, reason: 'missing_absorption_target' };
  }
  if (sacrifices.length === 0) {
    return { ok: false, state, reason: 'missing_absorption_sacrifices' };
  }
  if (sacrifices.some(sacrifice => sacrifice.id === target.id)) {
    return { ok: false, state, reason: 'absorption_target_selected_as_sacrifice' };
  }

  const ownedMonsters = state.ownedMonsters ?? [];
  const freshTarget = ownedMonsters.find(monster => monster.id === target.id);
  if (!freshTarget) {
    return { ok: false, state, reason: 'absorption_target_not_owned' };
  }

  const ownedCounts = countById(ownedMonsters);
  const sacrificeCounts = countById(sacrifices);
  for (const [id, count] of sacrificeCounts) {
    if ((ownedCounts.get(id) ?? 0) < count) {
      return { ok: false, state, reason: 'insufficient_absorption_materials' };
    }
  }

  let totalXp = 0;
  let sameTypeCount = 0;
  for (const sacrifice of sacrifices) {
    const rarity = sacrifice.rarity ?? getMonsterRarity(sacrifice.id);
    totalXp += RARITY_XP_VALUES[rarity] ?? RARITY_XP_VALUES[0];
    if (getBaseId(sacrifice.id) === getBaseId(target.id)) sameTypeCount++;
  }

  const removalCounts = new Map(sacrificeCounts);
  const remainingMonsters = ownedMonsters.filter(monster => {
    const count = removalCounts.get(monster.id) ?? 0;
    if (count > 0) {
      removalCounts.set(monster.id, count - 1);
      return false;
    }
    return true;
  });

  const targetCopy = {
    ...freshTarget,
    spentSkills: { ...freshTarget.spentSkills },
    equippedSkills: [...(freshTarget.equippedSkills ?? [])],
  };
  const xpResult = addXp(targetCopy, totalXp);
  const newStacks = Math.min((targetCopy.absorptionStacks ?? 0) + sameTypeCount, 10);
  const updatedTarget = { ...targetCopy, absorptionStacks: newStacks };

  return {
    ok: true,
    state: applySuccessfulFusionProgress({
      ...state,
      ownedMonsters: remainingMonsters.map(monster =>
        monster.id === target.id ? updatedTarget : monster,
      ),
    }),
    target: updatedTarget,
    totalXp,
    sameTypeCount,
    newStacks,
    levelled: xpResult.levelled,
  };
}

export function applyFusionAwakening(
  state: GameState,
  target: OwnedMonster | null,
): FusionAwakeningResult {
  if (!target) {
    return { ok: false, state, reason: 'missing_awakening_target' };
  }

  const ownedMonsters = state.ownedMonsters ?? [];
  const ownedTarget = ownedMonsters.find(monster => monster.id === target.id);
  if (!ownedTarget) {
    return { ok: false, state, reason: 'awakening_target_not_owned' };
  }

  if (state.monsterAwakened?.[target.id]) {
    return { ok: false, state, reason: 'monster_already_awakened' };
  }

  if ((state.monsterAffinity?.[target.id] ?? 0) < 100) {
    return { ok: false, state, reason: 'insufficient_awakening_affinity' };
  }

  if ((state.awakeningStones ?? 0) < 1) {
    return { ok: false, state, reason: 'insufficient_awakening_stones' };
  }

  let awakenedTarget = ownedTarget;
  let affectedCount = 0;
  const updatedMonsters = ownedMonsters.map(monster => {
    if (monster.id !== target.id) return monster;
    affectedCount++;
    const updated = {
      ...monster,
      absorptionStacks: (monster.absorptionStacks ?? 0) + 3,
    };
    if (monster === ownedTarget) awakenedTarget = updated;
    return updated;
  });

  return {
    ok: true,
    state: {
      ...state,
      awakeningStones: (state.awakeningStones ?? 0) - 1,
      monsterAwakened: { ...(state.monsterAwakened ?? {}), [target.id]: true },
      ownedMonsters: updatedMonsters,
    },
    monsterId: target.id,
    monster: awakenedTarget,
    affectedCount,
  };
}
