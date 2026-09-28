import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DungeonHomeScene } from '../scenes/DungeonHomeScene';
import { applyRecommendedMonsterPlacement } from './RoomDetailFeedback';
import { createRoomDetailState } from './RoomDetailShared';
import { loadGameState, saveGameState } from '../data/wisdom';
import { showToast } from './Toast';
import { showRoomGrowthFeedback } from './RoomGrowthFeedback';
import type { DungeonTheme } from '../themes/themes';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('./Toast', () => ({ showToast: vi.fn() }));
vi.mock('./RoomGrowthFeedback', async importOriginal => ({
  ...await importOriginal<typeof import('./RoomGrowthFeedback')>(), showRoomGrowthFeedback: vi.fn(),
}));

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(3_601_000); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('a failed recommendation save retains the room and accrued income, then retries once', () => {
  saveGameState({ ...loadGameState(), dmLevel: 1, homeGold: 5000, lastIdleCollect: 1000,
    productionFacilities: { treasury: 1 }, facilityStaff: { treasury: 'dokkaebi_warrior' },
    dungeonSlots: [{ roomType: 'combat', roomLevel: 1, monsterIds: [], trapIds: [], hp: 200, maxHp: 200 }] });
  const scene = new DungeonHomeScene();
  Object.assign(scene, { registry: { set: vi.fn() } });
  const cb = { ...scene.roomDetailCallbacks, markRoomChanged: vi.fn(), requestClose: vi.fn(), requestReopen: vi.fn() };
  const original = scene.gs, raw = localStorage.getItem('dungeonGameState');
  const storage = localStorage; let reject = true, writes = 0;
  vi.stubGlobal('localStorage', { getItem: storage.getItem.bind(storage), setItem(key: string, value: string) {
    if (reject) throw new DOMException('Full', 'QuotaExceededError');
    storage.setItem(key, value); writes++;
  } });
  const run = () => applyRecommendedMonsterPlacement(scene, createRoomDetailState(), {} as DungeonTheme,
    cb, 0, original.dungeonSlots[0], 0, { kind: 'monster', monsterId: 'dokkaebi_warrior',
      monsterTypeId: 'dokkaebi_warrior', name: '도깨비 전사', icon: '👹', attack: 10, reason: '', accent: 0 });
  expect(run).not.toThrow();
  expect(scene.gs).toBe(original);
  expect(localStorage.getItem('dungeonGameState')).toBe(raw);
  expect(cb.markRoomChanged).not.toHaveBeenCalled();
  expect(cb.requestClose).not.toHaveBeenCalled();
  expect(showRoomGrowthFeedback).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledWith(scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
  expect(writes).toBe(0);
  reject = false; run();
  expect(writes).toBe(1);
  expect(loadGameState()).toMatchObject({ homeGold: 5493, facilityStaff: {}, lastIdleCollect: 3_601_000 });
  expect(JSON.parse(JSON.stringify(scene.gs))).toEqual(loadGameState());
  expect(scene.gs.dungeonSlots[0].monsterIds[0]).toBe('dokkaebi_warrior');
  expect(cb.requestClose).toHaveBeenCalledTimes(1);
  expect(showRoomGrowthFeedback).toHaveBeenCalledTimes(1);
  vi.runAllTimers();
  expect(cb.requestReopen).toHaveBeenCalledExactlyOnceWith(0);
});
