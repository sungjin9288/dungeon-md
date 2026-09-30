import { describe, expect, it } from 'vitest';
import { BRANCH_DEFS, loadGameState, MAX_WISDOM_TIER } from '../data/wisdom';
import {
  WISDOM_LINEAGES,
  getWisdomBranchView,
  getWisdomLineageBranches,
  getWisdomSummary,
  getWisdomTierLadder,
  isWisdomUpgradeSnapshotCurrent,
} from './AncestralWisdomShared';

describe('AncestralWisdomShared', () => {
  it('exposes every authoritative branch exactly once across four lineages', () => {
    const ids = WISDOM_LINEAGES.flatMap(lineage =>
      getWisdomLineageBranches(lineage.id).map(branch => branch.id));

    expect(WISDOM_LINEAGES).toHaveLength(4);
    expect(ids).toHaveLength(BRANCH_DEFS.length);
    expect(new Set(ids).size).toBe(BRANCH_DEFS.length);
    expect(new Set(ids)).toEqual(new Set(BRANCH_DEFS.map(branch => branch.id)));
  });

  it('derives current, next, cost, and deficit without mutating state', () => {
    const state = loadGameState();
    state.soulCrystals = 12;
    state.wisdomTree = { ...state.wisdomTree, goldHands: 2 };
    const before = JSON.stringify(state);
    const branch = BRANCH_DEFS.find(candidate => candidate.id === 'goldHands')!;

    const view = getWisdomBranchView(state, branch);

    expect(view.tier).toBe(2);
    expect(view.currentEffect).toBe('던전 운영 수익 +20%');
    expect(view.nextEffect).toBe('던전 운영 수익 +30%');
    expect(view.cost).toBe(20);
    expect(view.canUpgrade).toBe(false);
    expect(view.deficit).toBe(8);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('marks maxed branches complete and omits a fabricated next tier', () => {
    const state = loadGameState();
    state.soulCrystals = 999;
    state.wisdomTree = { ...state.wisdomTree, soulHarvest: MAX_WISDOM_TIER };
    const branch = BRANCH_DEFS.find(candidate => candidate.id === 'soulHarvest')!;

    const view = getWisdomBranchView(state, branch);

    expect(view.isMaxed).toBe(true);
    expect(view.canUpgrade).toBe(false);
    expect(view.cost).toBeNull();
    expect(view.nextEffect).toBeNull();
  });

  it('summarizes clamped legacy tiers without changing persistence', () => {
    const state = loadGameState();
    state.wisdomTree = {
      ...state.wisdomTree,
      goldHands: 5,
      ironWalls: 3,
      masterCraft: 99,
      swiftVictory: -4,
    };

    const summary = getWisdomSummary(state);

    expect(summary.branchCount).toBe(12);
    expect(summary.totalTierCapacity).toBe(60);
    expect(summary.totalTiers).toBe(13);
    expect(summary.maxedBranches).toBe(1);
  });

  it('accepts only the exact affordable confirmation snapshot', () => {
    const state = loadGameState();
    state.soulCrystals = 100;
    state.wisdomTree = { ...state.wisdomTree, goldHands: 2 };
    const snapshot = { branchId: 'goldHands', tier: 2, cost: 20, soulCrystals: 100, nextEffect: '던전 운영 수익 +30%' };

    expect(isWisdomUpgradeSnapshotCurrent(state, snapshot)).toBe(true);
    expect(isWisdomUpgradeSnapshotCurrent({ ...state, soulCrystals: 99 }, snapshot)).toBe(false);
    expect(isWisdomUpgradeSnapshotCurrent({
      ...state,
      wisdomTree: { ...state.wisdomTree, goldHands: 3 },
    }, snapshot)).toBe(false);
    expect(isWisdomUpgradeSnapshotCurrent({
      ...state,
      wisdomTree: { ...state.wisdomTree, goldHands: -1 },
    }, snapshot)).toBe(false);
  });
});


describe('선조의 지혜 실제 효과 표시와 승인', () => {
  const branch = BRANCH_DEFS.find(b => b.id === 'ancestorsWisdom')!;
  // 곁방 상한 12 = 레벨 허가(DM5:1 · DM23:7 · DM24:8) + 보석 허가증 + 선조의 지혜. 넘치는 티어만 HP.
  it.each([[5, 0, 3, '곁방 허가 +3 · 던전 HP +0', '곁방 허가 +4 · 던전 HP +0'],
    [24, 4, 2, '곁방 허가 +0 · 던전 HP +40', '곁방 허가 +0 · 던전 HP +60'],
    [23, 4, 2, '곁방 허가 +1 · 던전 HP +20', '곁방 허가 +1 · 던전 HP +40']] as const)(
    'DM %i 허가증 %i tier %i의 현재와 다음 효과를 표시한다', (dmLevel, side, tier, current, next) => {
      const state = loadGameState(); state.dmLevel = dmLevel; state.soulCrystals = 100;
      state.dungeonLicenses = { side };
      state.wisdomTree = { ancestorsWisdom: tier };
      const view = getWisdomBranchView(state, branch);
      expect(view.currentEffect).toBe(current); expect(view.nextEffect).toBe(next);
      expect(view.canUpgrade).toBe(true);
    });
  it('확인 중 DM이 올라 효과가 바뀌면 다시 확인해야 한다', () => {
    const state = loadGameState(); state.dmLevel = 23; state.soulCrystals = 100;
    state.dungeonLicenses = { side: 4 };
    state.wisdomTree = { ancestorsWisdom: 0 };
    const snapshot = { branchId: branch.id, tier: 0, cost: 5, soulCrystals: 100, nextEffect: '곁방 허가 +1 · 던전 HP +0' };
    expect(isWisdomUpgradeSnapshotCurrent(state, snapshot)).toBe(true);
    expect(isWisdomUpgradeSnapshotCurrent({ ...state, dmLevel: 24 }, snapshot)).toBe(false);
  });

  it('등급표: 5등급 효과·비용과 보유/다음/잠김 상태', () => {
    const state = loadGameState();
    state.wisdomTree = { ...state.wisdomTree, goldHands: 2 };
    const branch = BRANCH_DEFS.find(candidate => candidate.id === 'goldHands')!;
    const ladder = getWisdomTierLadder(state, branch);
    expect(ladder).toHaveLength(MAX_WISDOM_TIER);
    expect(ladder.map(row => row.status)).toEqual(['owned', 'owned', 'next', 'locked', 'locked']);
    expect(ladder.map(row => row.cost)).toEqual(branch.costPerTier);
    expect(ladder[2].effect).toBe(getWisdomBranchView(state, branch).nextEffect);
  });
});

