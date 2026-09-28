import { beforeEach, describe, expect, it } from 'vitest';
import { collectIdleIncome, computeIdleReward } from './idleIncome';
import { exportGameState, importGameState, loadGameState, saveGameState, startPrestige, type GameState } from './wisdom';

const START = 1_000_000;
const MINUTE = 60_000;
function fixture(): GameState {
  return { ...loadGameState(), homeGold: 0, lastIdleCollect: START,
    productionFacilities: { mine: 1, weavery: 1, treasury: 1 } };
}
beforeEach(() => localStorage.clear());

describe('idle collection preserves incomplete production', () => {
  it.each([1, 10, 20, 30])('claiming every %i minutes matches a single hour of production', minutes => {
    const initial = fixture(); let state = initial;
    for (let t = minutes; t <= 60; t += minutes) state = collectIdleIncome(state, START + t * MINUTE).state;
    const single = collectIdleIncome(initial, START + 60 * MINUTE).state;
    expect(state.homeGold).toBe(single.homeGold);
    expect(state.materials).toEqual(single.materials);
    expect(state.materials).toEqual({ common_ore: 2, old_cloth: 1 });
    expect(initial.homeGold).toBe(0);
    expect(initial.materials).toEqual({});
  });

  it('keeps operation and treasury rounding separate across claims', () => {
    const initial = { ...fixture(), dmLevel: 1, dungeonSlots: [{ roomType: 'combat' as const, roomLevel: 1, hp: 100, maxHp: 100, monsterIds: [], trapIds: [] }] };
    let state: GameState = initial;
    for (let t = 1; t <= 60; t++) state = collectIdleIncome(state, START + t * MINUTE).state;
    expect(state.homeGold).toBe(collectIdleIncome(initial, START + 60 * MINUTE).state.homeGold);
  });

  it('preview is read-only and remaining progress survives reload and backup restore', () => {
    const first = collectIdleIncome(fixture(), START + 20 * MINUTE).state;
    saveGameState(first);
    const code = exportGameState(); localStorage.clear();
    expect(importGameState(code)).toEqual({ success: true });
    const restored = loadGameState(), snapshot = structuredClone(restored);
    const preview = computeIdleReward(restored, START + 30 * MINUTE);
    expect(preview.materials.common_ore).toBe(1);
    const claimed = collectIdleIncome(restored, START + 30 * MINUTE);
    expect(claimed.reward).toEqual(preview);
    expect(claimed.state.homeGold).toBe(50);
    expect(restored).toEqual(snapshot);
  });

  it('caps only new elapsed production and retains the earlier fraction', () => {
    const first = collectIdleIncome(fixture(), START + 20 * MINUTE).state;
    const cap = collectIdleIncome(first, first.lastIdleCollect + 24 * 60 * MINUTE);
    expect(cap.reward.capped).toBe(true);
    expect(cap.reward.materials.common_ore).toBe(24);
    const after = collectIdleIncome(cap.state, cap.state.lastIdleCollect + 10 * MINUTE);
    expect(after.reward.materials.common_ore).toBe(1);
  });

  it('does not reset the collection clock backwards or grant a duplicate interval', () => {
    const claimed = collectIdleIncome(fixture(), START + 60 * MINUTE).state;
    const earlier = collectIdleIncome(claimed, START + 30 * MINUTE).state;
    expect(earlier.lastIdleCollect).toBe(claimed.lastIdleCollect);
    expect(collectIdleIncome(earlier, claimed.lastIdleCollect).reward.gold).toBe(0);
    expect(earlier.materials).toEqual(claimed.materials);
  });

  it('prestige resets fractional gold with gold but keeps fractional materials', () => {
    const first = collectIdleIncome(fixture(), START + 20 * MINUTE).state;
    const next = startPrestige(first);
    expect(next.idleRemainder?.operationGold).toBe(0);
    expect(next.idleRemainder?.productionGold).toBe(0);
    expect(collectIdleIncome(next, START + 30 * MINUTE).reward.materials.common_ore).toBe(1);
  });

  it.each([NaN, Infinity, -0.5, 2])('ignores invalid saved fractions %s', fraction => {
    const state = { ...fixture(), idleRemainder: { operationGold: fraction, productionGold: fraction, materials: { common_ore: fraction } } };
    expect(computeIdleReward(state, START + 60 * MINUTE)).toEqual(computeIdleReward(fixture(), START + 60 * MINUTE));
  });

  it('keeps the earned fraction unchanged when a facility rate changes', () => {
    const first = collectIdleIncome(fixture(), START + 10 * MINUTE).state;
    const upgraded = { ...first, productionFacilities: { ...first.productionFacilities, mine: 5 } };
    // Earned 1/3 item at Lv1, then 2/3 item over four minutes at Lv5.
    expect(collectIdleIncome(upgraded, START + 14 * MINUTE).reward.materials.common_ore).toBe(1);
  });
});
