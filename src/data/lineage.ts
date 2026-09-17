// ─── Lineage (계보도) ─────────────────────────────────────────────────────────
// No new data: every guardian's place in the family tree is derived from the
// registry, the evolution tiers, and the combination table. A pinned goal
// turns that tree into one next step the home directive can point at.
// Design: GAME_DESIGN_BENCHMARK.md §4.3 ①.

import {
  COMBINATION_TABLE,
  EVOLUTION_TIERS,
  EVOLVABLE_BASES,
  getBaseId,
  getMonsterDisplayName,
  getMonsterRarity,
  getNextEvolution,
} from './fusion';
import { MONSTER_DEFS } from './monsters';
import type { GameState } from './wisdom';

export type LineageKind = 'base' | 'evolution' | 'hybrid';

export interface LineageNode {
  readonly id: string;
  readonly name: string;
  readonly kind: LineageKind;
  /** What this guardian is made from: the previous stage, or the two hybrid parents. */
  readonly parents: readonly string[];
  /** What this guardian can become: its next stage and the hybrids it fathers. */
  readonly children: readonly string[];
}

/** Copies of the previous stage that one evolution consumes (fusionTransactions). */
export const EVOLUTION_COPIES = 3;
export const COMBINATION_SOUL_CRYSTALS = 100;

function hybridParents(id: string): readonly string[] {
  const entry = Object.entries(COMBINATION_TABLE).find(([, result]) => result === id);
  return entry ? entry[0].split('+') : [];
}

function hybridChildren(id: string): readonly string[] {
  return Object.entries(COMBINATION_TABLE)
    .filter(([key]) => key.split('+').includes(id))
    .map(([, result]) => result);
}

function previousStage(id: string): string | null {
  const rarity = getMonsterRarity(id);
  if (rarity <= 0) return null;
  const base = getBaseId(id);
  return rarity === 1 ? base : base + EVOLUTION_TIERS[rarity - 2].resultId;
}

export function lineageKindOf(id: string): LineageKind {
  if (hybridParents(id).length > 0) return 'hybrid';
  return getMonsterRarity(id) > 0 ? 'evolution' : 'base';
}

export function getLineageNode(id: string): LineageNode {
  const kind = lineageKindOf(id);
  const prev = kind === 'evolution' ? previousStage(id) : null;
  const next = getNextEvolution(id);
  return {
    id,
    name: getMonsterDisplayName(id),
    kind,
    parents: kind === 'hybrid' ? hybridParents(id) : prev ? [prev] : [],
    children: [...(next ? [next.resultId] : []), ...(kind === 'base' ? hybridChildren(id) : [])],
  };
}

export function isEvolvableBase(id: string): boolean {
  return EVOLVABLE_BASES.has(getBaseId(id));
}

// ─── Goal plan ────────────────────────────────────────────────────────────────

export type LineageStepKind = 'owned' | 'summon' | 'evolve' | 'combine';

export interface LineageStep {
  readonly kind: LineageStepKind;
  readonly targetId: string;
  readonly label: string;
  /** Progress toward this step, when countable (copies for an evolution, parents for a hybrid). */
  readonly have: number;
  readonly need: number;
}

function ownedCount(state: Readonly<Pick<GameState, 'ownedMonsters'>>, id: string): number {
  return (state.ownedMonsters ?? []).filter(monster => monster.id === id).length;
}

/**
 * The ordered steps from what the player holds to `goalId`, innermost first:
 * summon what is missing, evolve what is short, combine what is ready. An
 * owned goal is a single 'owned' step.
 */
export function getLineageGoalPlan(state: Readonly<Pick<GameState, 'ownedMonsters'>>, goalId: string, depth = 0): readonly LineageStep[] {
  const name = getMonsterDisplayName(goalId);
  if (ownedCount(state, goalId) > 0) return [{ kind: 'owned', targetId: goalId, label: `${name} 보유 중`, have: 1, need: 1 }];
  if (depth > 6) return [];
  const node = getLineageNode(goalId);

  if (node.kind === 'hybrid') {
    const steps: LineageStep[] = [];
    for (const parent of node.parents) if (ownedCount(state, parent) === 0) steps.push(...getLineageGoalPlan(state, parent, depth + 1));
    const have = node.parents.filter(parent => ownedCount(state, parent) > 0).length;
    steps.push({
      kind: 'combine', targetId: goalId,
      label: `합성 · 조합: ${node.parents.map(getMonsterDisplayName).join(' + ')} → ${name} (영혼 결정 ${COMBINATION_SOUL_CRYSTALS})`,
      have, need: node.parents.length,
    });
    return steps;
  }

  if (node.kind === 'evolution') {
    const prev = node.parents[0];
    const have = ownedCount(state, prev);
    const steps: LineageStep[] = [];
    if (have < EVOLUTION_COPIES) {
      const gather: LineageStep = {
        kind: 'summon', targetId: prev,
        label: `${getMonsterDisplayName(prev)} ×${EVOLUTION_COPIES} 모으기 (보유 ${have}/${EVOLUTION_COPIES}) · 소환`,
        have, need: EVOLUTION_COPIES,
      };
      // A base stage is gathered by summoning more copies; a deeper stage by
      // walking its own plan first (the copies come from evolving again).
      const prevPlan = getLineageGoalPlan(state, prev, depth + 1).filter(step => step.kind !== 'owned');
      if (prevPlan.length === 0 || prevPlan.every(step => step.kind === 'summon')) steps.push(gather);
      else steps.push(...prevPlan);
    }
    steps.push({
      kind: 'evolve', targetId: goalId,
      label: `합성 · 진화: ${getMonsterDisplayName(prev)} ×${EVOLUTION_COPIES} → ${name} (보유 ${Math.min(have, EVOLUTION_COPIES)}/${EVOLUTION_COPIES})`,
      have: Math.min(have, EVOLUTION_COPIES), need: EVOLUTION_COPIES,
    });
    return steps;
  }

  const def = MONSTER_DEFS[goalId as keyof typeof MONSTER_DEFS];
  const via = def?.unlockMethod === 'codex_reward' ? '도감 보상' : def?.unlockMethod === 'seasonal' ? '시즌 배너' : '소환';
  return [{ kind: 'summon', targetId: goalId, label: `${name} 획득 · ${via}`, have: 0, need: 1 }];
}

/** The one thing to do next for the goal, or null when it is owned / has no plan. */
export function getLineageNextStep(state: Readonly<Pick<GameState, 'ownedMonsters'>>, goalId: string): LineageStep | null {
  const plan = getLineageGoalPlan(state, goalId);
  const first = plan[0];
  return first && first.kind !== 'owned' ? first : null;
}

/**
 * What the codex folio offers to pin for `id`: the guardian itself while it is
 * unowned, its next evolution once owned, else the first hybrid it fathers.
 */
export function suggestLineageGoal(state: Readonly<Pick<GameState, 'ownedMonsters'>>, id: string): string | null {
  if (ownedCount(state, id) === 0) return id;
  const next = getNextEvolution(id);
  if (next) return next.resultId;
  const child = hybridChildren(id).find(hybrid => ownedCount(state, hybrid) === 0);
  return child ?? null;
}

export function withLineageGoal<S extends Pick<GameState, 'lineageGoal'>>(state: S, goalId: string | null): S {
  return { ...state, lineageGoal: goalId };
}
