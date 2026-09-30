import {
  BRANCH_DEFS,
  MAX_WISDOM_TIER,
  type BranchDef,
  type GameState, getAncestorsWisdomEffect } from '../data/wisdom';

export type WisdomLineageId = 'foundation' | 'conquest' | 'guardian' | 'abyss';

export interface WisdomLineage {
  readonly id: WisdomLineageId;
  readonly label: string;
  readonly branchIds: readonly string[];
}

export const WISDOM_LINEAGES: readonly WisdomLineage[] = [
  { id: 'foundation', label: '기초석', branchIds: ['goldHands', 'ironWalls', 'masterCraft'] },
  { id: 'conquest', label: '정복', branchIds: ['swiftVictory', 'ancestorsWisdom', 'crystalResonance'] },
  { id: 'guardian', label: '수호', branchIds: ['guardianBlessing', 'eliteTrainer', 'celestialBlood'] },
  { id: 'abyss', label: '심연', branchIds: ['dungeonFortress', 'soulHarvest', 'forgeEnhancer'] },
];

export interface WisdomBranchView {
  readonly branch: BranchDef;
  readonly tier: number;
  readonly validTier: boolean;
  readonly isMaxed: boolean;
  readonly cost: number | null;
  readonly canUpgrade: boolean;
  readonly deficit: number;
  readonly currentEffect: string;
  readonly nextEffect: string | null;
}

export interface WisdomSummary {
  readonly totalTiers: number;
  readonly totalTierCapacity: number;
  readonly maxedBranches: number;
  readonly branchCount: number;
}

export interface WisdomUpgradeSnapshot {
  readonly branchId: string;
  readonly tier: number;
  readonly cost: number;
  readonly soulCrystals: number;
  readonly nextEffect: string;
}

export function getWisdomLineageBranches(lineageId: WisdomLineageId): BranchDef[] {
  const lineage = WISDOM_LINEAGES.find(candidate => candidate.id === lineageId)
    ?? WISDOM_LINEAGES[0];
  const byId = new Map(BRANCH_DEFS.map(branch => [branch.id, branch]));
  return lineage.branchIds
    .map(id => byId.get(id))
    .filter((branch): branch is BranchDef => branch !== undefined);
}

function branchEffect(state: GameState, branch: BranchDef, tier: number): string {
  if (branch.id !== 'ancestorsWisdom') return branch.effect.replace('{value}', String(branch.getValue(tier)));
  const { extraSlots, hpBonus } = getAncestorsWisdomEffect({
    dmLevel: state.dmLevel,
    dungeonPlan: state.dungeonPlan,
    dungeonLicenses: state.dungeonLicenses,
    wisdomTree: { ...state.wisdomTree, ancestorsWisdom: tier },
  });
  return `${state.dungeonPlan ? '곁방 허가' : '방 슬롯'} +${extraSlots} · 던전 HP +${hpBonus}`;
}

export function getWisdomBranchView(state: GameState, branch: BranchDef): WisdomBranchView {
  const rawTier = state.wisdomTree?.[branch.id] ?? 0;
  const validTier = Number.isInteger(rawTier) && rawTier >= 0 && rawTier <= MAX_WISDOM_TIER;
  const tier = validTier ? rawTier : Math.max(0, Math.min(MAX_WISDOM_TIER, Math.trunc(rawTier || 0)));
  const isMaxed = validTier && tier >= MAX_WISDOM_TIER;
  const cost = validTier && !isMaxed ? branch.costPerTier[tier] ?? null : null;
  const crystals = Number.isFinite(state.soulCrystals) ? Math.max(0, state.soulCrystals) : 0;
  const canUpgrade = cost !== null && crystals >= cost;
  const currentEffect = branchEffect(state, branch, tier);
  const nextEffect = isMaxed || !validTier
    ? null
    : branchEffect(state, branch, tier + 1);

  return {
    branch,
    tier,
    validTier,
    isMaxed,
    cost,
    canUpgrade,
    deficit: cost === null ? 0 : Math.max(0, cost - crystals),
    currentEffect,
    nextEffect,
  };
}

export function getWisdomSummary(state: GameState): WisdomSummary {
  const views = BRANCH_DEFS.map(branch => getWisdomBranchView(state, branch));
  return {
    totalTiers: views.reduce((sum, view) => sum + view.tier, 0),
    totalTierCapacity: BRANCH_DEFS.length * MAX_WISDOM_TIER,
    maxedBranches: views.filter(view => view.isMaxed).length,
    branchCount: BRANCH_DEFS.length,
  };
}

export function isWisdomUpgradeSnapshotCurrent(
  state: GameState,
  snapshot: WisdomUpgradeSnapshot,
): boolean {
  const branch = BRANCH_DEFS.find(candidate => candidate.id === snapshot.branchId);
  if (!branch) return false;

  const view = getWisdomBranchView(state, branch);
  return view.validTier
    && view.canUpgrade
    && view.nextEffect === snapshot.nextEffect
    && view.tier === snapshot.tier
    && view.cost === snapshot.cost
    && state.soulCrystals === snapshot.soulCrystals;
}

export type WisdomTierStatus = 'owned' | 'next' | 'locked';

export interface WisdomTierRow {
  readonly tier: number;
  readonly effect: string;
  readonly cost: number;
  readonly status: WisdomTierStatus;
}

/** 한 가호의 1~5등급 전체 — 각 등급을 올렸을 때의 누적 효과, 그 등급의 결정 값, 보유/다음/잠김. */
export function getWisdomTierLadder(state: GameState, branch: BranchDef): WisdomTierRow[] {
  const owned = getWisdomBranchView(state, branch).tier;
  return Array.from({ length: MAX_WISDOM_TIER }, (_, index) => {
    const tier = index + 1;
    return {
      tier,
      effect: branchEffect(state, branch, tier),
      cost: branch.costPerTier[index] ?? 0,
      status: tier <= owned ? 'owned' : tier === owned + 1 ? 'next' : 'locked',
    };
  });
}

