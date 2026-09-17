import { describe, expect, it } from 'vitest';
import { getBannerSynergyOutlook } from './bannerSynergy';
import { getBondAffinity } from './bondTransactions';
import { estimateWeeklyFreeGems } from './gemInflow';
import { getHomeTodos } from './homeTodos';
import { computeIdleReward, dungeonGoldPerMin } from './idleIncome';
import { getLineageGoalPlan } from './lineage';
import { SEASON_BANNERS } from './banners';
import { installTrapInRoomSlot, removeTrapFromRoomSlot } from './roomSlotTransactions';
import { calcDungeonDps } from './simulation';
import { buildTrapForgeRows } from './trapForgeView';
import { getTrapDef } from './traps';
import { getTrapStock } from './trapTransactions';
import { importGameState, loadGameState, type GameState } from './wisdom';

/** A save written before Phase 3–4 existed: no trap stock, staffing, bond, lineage or shards. */
const LEGACY_SAVE = {
  dmLevel: 12,
  dmXP: 400,
  homeGold: 2400,
  gems: 80,
  soulCrystals: 40,
  awakeningStones: 1,
  materials: { iron_shard: 6, herb: 4, old_cloth: 5 },
  ownedMonsters: [
    { id: 'dokkaebi_warrior', level: 8, xp: 10, skillPoints: 1, spentSkills: { A1: 1 }, equippedSkills: [], equipment: null },
    { id: 'village_archer', level: 5, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null },
  ],
  dungeonSlots: [
    { roomType: 'trap', monsterIds: ['dokkaebi_warrior'], trapIds: ['spike_trap', 'poison_trap'], roomLevel: 2, hp: 240, maxHp: 240 },
    { roomType: 'combat', monsterIds: ['village_archer'], trapIds: [], roomLevel: 1, hp: 200, maxHp: 200 },
  ],
  productionFacilities: { mine: 2 },
  monsterAffinity: { dokkaebi_warrior: 30 },
  lastIdleCollect: 1_000,
};

function importLegacy(): GameState {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(LEGACY_SAVE))));
  const result = importGameState(encoded);
  expect(result.success, result.error).toBe(true);
  return loadGameState();
}

describe('legacy save → Phase 3–4 systems', () => {
  it('fills every new field with its default instead of undefined', () => {
    const gs = importLegacy();
    expect(gs.trapStock).toEqual({});
    expect(gs.trapMastery).toEqual({});
    expect(gs.facilityStaff).toEqual({});
    expect(gs.bondDaily).toEqual({});
    expect(gs.tribeShards).toEqual({});
    expect(gs.lineageGoal).toBeNull();
    // Pre-existing progress survives untouched.
    expect(gs.dmLevel).toBe(12);
    expect(gs.productionFacilities.mine).toBe(2);
    expect(getBondAffinity(gs, 'dokkaebi_warrior')).toBe(30);
  });

  it('keeps the four original trap ids installed and lets them be removed for a refund', () => {
    const gs = importLegacy();
    expect(gs.dungeonSlots[0].trapIds).toEqual(['spike_trap', 'poison_trap']);
    for (const id of gs.dungeonSlots[0].trapIds) expect(getTrapDef(id as string)?.tier).toBe(1);
    const removed = removeTrapFromRoomSlot(gs, 0, 0);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.refund).toBeGreaterThan(0);          // tier 1 refunds gold, not stock
    expect(getTrapStock(removed.state, 'spike_trap')).toBe(0);
    const reinstalled = installTrapInRoomSlot(removed.state, 0, 0, 'spike_trap');
    expect(reinstalled.ok).toBe(true);
  });

  it('every new read-side system runs on it without throwing', () => {
    const gs = importLegacy();
    expect(() => buildTrapForgeRows(gs)).not.toThrow();
    expect(buildTrapForgeRows(gs)).toHaveLength(16);
    expect(getHomeTodos(gs, '2026-09-18').unstaffedFacilities).toBe(1);
    expect(getLineageGoalPlan(gs, 'dokkaebi_warrior_unc').length).toBeGreaterThan(0);
    expect(getBannerSynergyOutlook(SEASON_BANNERS[0], gs)).not.toBeNull();
    expect(estimateWeeklyFreeGems(1).total).toBeGreaterThan(0);
    expect(dungeonGoldPerMin(gs)).toBeGreaterThan(0);
    expect(calcDungeonDps(gs.dungeonSlots, gs.ownedMonsters)).toBeGreaterThan(0);
    const reward = computeIdleReward(gs, (gs.lastIdleCollect ?? 0) + 3_600_000);
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.capped).toBe(false);
  });

  it('applies the raising multiplier from the legacy roster levels and skills', () => {
    const gs = importLegacy();
    const flat = calcDungeonDps(gs.dungeonSlots, gs.ownedMonsters.map(m => ({ ...m, level: 1, spentSkills: {} })));
    expect(calcDungeonDps(gs.dungeonSlots, gs.ownedMonsters)).toBeGreaterThan(flat);
  });
});
