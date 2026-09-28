import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportGameState, importGameState, loadGameState, saveGameState } from './wisdom';
import { loadProgress, recordClear, saveProgress } from './stageProgress';

const encode = (value: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
const snapshot = () => [localStorage.getItem('dungeonGameState'), localStorage.getItem('dungeonStageProgress')];
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function failWritesTo(failedKey: string): void {
  const storage = localStorage;
  vi.stubGlobal('localStorage', {
    getItem: storage.getItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    setItem(key: string, value: string) {
      if (key === failedKey) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      storage.setItem(key, value);
    },
  });
}

describe('save transfer across both progression stores', () => {
  it('restores actual campaign unlocks, stars and HP on a fresh device', () => {
    saveGameState({ ...loadGameState(), homeGold: 12345, dmLevel: 8 });
    recordClear(9, 3, 87);
    const expectedProgress = loadProgress();
    const expectedState = loadGameState();
    const code = exportGameState();
    localStorage.clear();
    expect(importGameState(code)).toEqual({ success: true });
    expect(loadProgress()).toEqual(expectedProgress);
    expect(loadGameState()).toEqual(expectedState);
  });

  it('replaces destination progress instead of retaining or merging its cleared stages', () => {
    recordClear(1, 2, 64);
    const expected = loadProgress();
    const code = exportGameState();
    recordClear(89, 3, 100);
    expect(importGameState(code).success).toBe(true);
    expect(loadProgress()).toEqual(expected);
  });

  it('uses the embedded progress of a legacy flat save and pads old stage lists', () => {
    recordClear(89, 3, 100);
    const code = encode({ dmLevel: 5, ownedMonsters: [], stageProgress: [{ unlocked: true, bestStars: 2, bestHpPercent: 61 }] });
    expect(importGameState(code).success).toBe(true);
    expect(loadProgress()).toHaveLength(90);
    expect(loadProgress()).toEqual(loadGameState().stageProgress);
    expect(loadProgress()[0].bestStars).toBe(2);
    expect(loadProgress()[89].bestStars).toBe(0);
  });

  it('resets campaign progress to defaults when a legacy save contains none', () => {
    recordClear(89, 3, 100);
    expect(importGameState(encode({ dmLevel: 1, ownedMonsters: [] })).success).toBe(true);
    expect(loadProgress()).toEqual(loadGameState().stageProgress);
  });

  it.each([
    null,
    { format: 'dungeon-guardian-save', version: 99, gameState: { dmLevel: 1, ownedMonsters: [] }, campaignProgress: [] },
    { format: 'dungeon-guardian-save', version: 1, gameState: { dmLevel: 1, ownedMonsters: [] } },
    { format: 'dungeon-guardian-save', version: 1, gameState: { dmLevel: 1, ownedMonsters: [] }, campaignProgress: [null] },
    { dmLevel: 1, ownedMonsters: [], stageProgress: [{ unlocked: true, bestStars: 4 }] },
  ])('rejects invalid transfer without modifying either store: %j', payload => {
    saveGameState({ ...loadGameState(), homeGold: 700 });
    recordClear(4, 3, 91);
    const before = snapshot();
    expect(importGameState(encode(payload)).success).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it.each([true, false])('rolls back campaign write if the game-state write fails (existing campaign: %s)', existing => {
    saveGameState({ ...loadGameState(), homeGold: 700 });
    if (existing) saveProgress([{ unlocked: true, bestStars: 1 }]);
    const before = snapshot();
    failWritesTo('dungeonGameState');
    expect(importGameState(encode({ dmLevel: 9, ownedMonsters: [] })).success).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it('does not write game state if campaign storage fails', () => {
    saveGameState({ ...loadGameState(), homeGold: 700 });
    recordClear(2, 1, 20);
    const before = snapshot();
    failWritesTo('dungeonStageProgress');
    expect(importGameState(encode({ dmLevel: 9, ownedMonsters: [] })).success).toBe(false);
    expect(snapshot()).toEqual(before);
  });
});
