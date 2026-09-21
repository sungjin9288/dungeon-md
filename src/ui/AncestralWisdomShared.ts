import {
  BRANCH_DEFS,
  MAX_WISDOM_TIER,
  type BranchDef,
  type GameState, getUnlockedSlots, MAX_DUNGEON_SLOTS } from '../data/wisdom';

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
  /** Set when another tier would provably change nothing right now. */
  readonly inertReason: string | null;
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
}

export function getWisdomLineageBranches(lineageId: WisdomLineageId): BranchDef[] {
  const lineage = WISDOM_LINEAGES.find(candidate => candidate.id === lineageId)
    ?? WISDOM_LINEAGES[0];
  const byId = new Map(BRANCH_DEFS.map(branch => [branch.id, branch]));
  return lineage.branchIds
    .map(id => byId.get(id))
    .filter((branch): branch is BranchDef => branch !== undefined);
}

/**
 * Why buying another tier of this node would change nothing right now.
 *
 * 선조의 지혜 grants extra room slots, but the live count is
 * `min(MAX_DUNGEON_SLOTS, getUnlockedSlots(dmLevel) + tier)` and the DM curve
 * alone reaches the 9-slot cap at DM 8. Prestige does NOT reset dmLevel
 * (startPrestige spreads it through), so past DM 8 every tier of a node that
 * costs 145 crystals in total buys exactly zero slots, for the rest of the
 * game and every prestige after it.
 *
 * Raising the cap would break the 3x3 home board, resetting dmLevel on prestige
 * is a progression redesign, and lowering the DM slot curve would invalidate the
 * measured campaign pacing table — so the node is not repriced here. What it
 * must not do is keep selling itself as if it did something.
 */
export function wisdomBranchInertReason(state: GameState, branch: BranchDef): string | null {
  if (branch.id !== 'ancestorsWisdom') return null;
  const fromDmLevel = getUnlockedSlots(state.dmLevel ?? 1);
  return fromDmLevel >= MAX_DUNGEON_SLOTS
    ? `DM ${state.dmLevel ?? 1} 기준 방 슬롯이 이미 최대(${MAX_DUNGEON_SLOTS})입니다 — 지금은 늘지 않습니다`
    : null;
}

export function getWisdomBranchView(state: GameState, branch: BranchDef): WisdomBranchView {
  const rawTier = state.wisdomTree?.[branch.id] ?? 0;
  const validTier = Number.isInteger(rawTier) && rawTier >= 0 && rawTier <= MAX_WISDOM_TIER;
  const tier = validTier ? rawTier : Math.max(0, Math.min(MAX_WISDOM_TIER, Math.trunc(rawTier || 0)));
  const isMaxed = validTier && tier >= MAX_WISDOM_TIER;
  const cost = validTier && !isMaxed ? branch.costPerTier[tier] ?? null : null;
  const crystals = Number.isFinite(state.soulCrystals) ? Math.max(0, state.soulCrystals) : 0;
  const canUpgrade = cost !== null && crystals >= cost;
  const currentEffect = branch.effect.replace('{value}', String(branch.getValue(tier)));
  const nextEffect = isMaxed || !validTier
    ? null
    : branch.effect.replace('{value}', String(branch.getValue(tier + 1)));

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
    inertReason: wisdomBranchInertReason(state, branch),
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
    && view.tier === snapshot.tier
    && view.cost === snapshot.cost
    && state.soulCrystals === snapshot.soulCrystals;
}
