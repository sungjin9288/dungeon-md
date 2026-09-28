import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DungeonHomeScene } from './DungeonHomeScene';
import { maybeShowIdleIncome, showIdleIncomePanel } from './HomeLifecycle';
import { loadGameState, saveGameState } from '../data/wisdom';
import { computeIdleReward } from '../data/idleIncome';
import { addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { showToast } from '../ui/Toast';

vi.mock('phaser', () => ({ default: {
  Scene: class {}, Geom: { Rectangle: class { static Contains() { return true; } } },
} }));
vi.mock('../ui/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../ui/GameUiPrimitives', () => ({
  addFramedPanel: () => ({}), addPrimaryActionButton: vi.fn(() => ({})),
}));

function object() {
  const result: Record<string, Mock<() => unknown>> = {};
  for (const method of ['setDepth', 'setInteractive', 'add', 'fillStyle', 'fillRect', 'fillCircle', 'strokeCircle', 'setOrigin', 'lineStyle', 'lineBetween', 'setAlpha', 'destroy']) result[method] = vi.fn(() => result);
  const live = Object.assign(result, { active: true });
  live.destroy = vi.fn(() => { live.active = false; return live; });
  return live;
}

function open() {
  const scene = new DungeonHomeScene();
  scene.gs = loadGameState();
  const overlay = object(), scrim = object();
  Object.assign(scene, {
    scene: { isActive: () => true },
    add: { container: () => overlay, graphics: () => scrim, text: () => object() },
    tweens: { add: vi.fn() },
  });
  showIdleIncomePanel(scene, computeIdleReward(scene.gs, Date.now()));
  const calls = vi.mocked(addPrimaryActionButton).mock.calls;
  const options = calls[calls.length - 1][1];
  return { scene, overlay, scrim, press: options.onPress, options };
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(10_000_000);
  saveGameState({ ...loadGameState(), prestigeLevel: 3, lastIdleCollect: Date.now() - 3_600_000,
    productionFacilities: { mine: 1, treasury: 1 }, materials: { common_ore: 5 } });
});
afterEach(() => vi.unstubAllGlobals());

describe('Home idle reward persistence', () => {
  it('credits facility rewards once and closes the overlay only after saving', () => {
    const f = open(); f.press();
    expect(loadGameState()).toMatchObject({ homeGold: 300, materials: { common_ore: 7 }, lastIdleCollect: Date.now(), prestigeLevel: 3 });
    expect(f.scene.gs).toEqual(loadGameState());
    expect(f.overlay.destroy).toHaveBeenCalledTimes(1);
    f.press();
    expect(f.overlay.destroy).toHaveBeenCalledTimes(1);
    expect(loadGameState().homeGold).toBe(300);
  });

  it('preserves live and persisted state on failure, then retries the same button', () => {
    const f = open(), before = f.scene.gs, raw = localStorage.getItem('dungeonGameState');
    const storage = localStorage; let reject = true;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem(key: string, value: string) {
        if (reject) throw new DOMException('Full', 'QuotaExceededError');
        storage.setItem(key, value);
      },
    });
    expect(() => f.press()).not.toThrow();
    expect(f.scene.gs).toBe(before);
    expect(localStorage.getItem('dungeonGameState')).toBe(raw);
    expect(f.overlay.destroy).not.toHaveBeenCalled();
    expect(f.scrim.destroy).not.toHaveBeenCalled();
    expect(f.options.once).not.toBe(true);
    expect(showToast).toHaveBeenCalledWith(f.scene, '수령 저장 실패. 다시 시도해주세요.', expect.objectContaining({ depth: 901 }));
    reject = false; f.press();
    expect(loadGameState()).toMatchObject({ homeGold: 300, materials: { common_ore: 7 } });
    expect(f.overlay.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['scene', 'overlay'])('does not commit a pending button callback after %s closes', target => {
    const f = open(), raw = localStorage.getItem('dungeonGameState');
    if (target === 'overlay') f.overlay.destroy();
    else vi.spyOn(f.scene.scene, 'isActive').mockReturnValue(false);
    f.press();
    expect(localStorage.getItem('dungeonGameState')).toBe(raw);
  });
});

describe('Home entry after a short absence', () => {
  function enter(elapsedMs: number) {
    saveGameState({ ...loadGameState(), lastIdleCollect: Date.now() - elapsedMs });
    const scene = new DungeonHomeScene();
    scene.gs = loadGameState();
    const delayedCall = vi.fn();
    Object.assign(scene, { time: { delayedCall }, refreshCurrencyTexts: vi.fn() });
    maybeShowIdleIncome(scene);
    return { scene, delayedCall };
  }

  it('auto-claims with the same settlement and no blocking panel', () => {
    const expected = computeIdleReward(loadGameState(), Date.now());
    const before = loadGameState();
    const { scene, delayedCall } = enter(60_000);
    const saved = loadGameState();
    expect(delayedCall).not.toHaveBeenCalled();
    expect(saved.homeGold).toBe(before.homeGold + computeIdleReward({ ...before, lastIdleCollect: Date.now() - 60_000 }, Date.now()).gold);
    expect(saved.lastIdleCollect).toBe(Date.now());
    expect(scene.gs).toEqual(saved);
    expect(showToast).toHaveBeenCalledWith(scene, expect.stringContaining('황금'), expect.anything());
    expect(expected.gold).toBeGreaterThan(0);
  });

  it('keeps accruing when the silent save fails', () => {
    saveGameState({ ...loadGameState(), lastIdleCollect: Date.now() - 60_000 });
    const raw = localStorage.getItem('dungeonGameState');
    const storage = localStorage;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem() { throw new DOMException('Full', 'QuotaExceededError'); },
    });
    const scene = new DungeonHomeScene();
    scene.gs = loadGameState();
    const before = scene.gs;
    Object.assign(scene, { time: { delayedCall: vi.fn() }, refreshCurrencyTexts: vi.fn() });
    expect(() => maybeShowIdleIncome(scene)).not.toThrow();
    expect(scene.gs).toBe(before);
    expect(storage.getItem('dungeonGameState')).toBe(raw);
  });

  it('still shows the recovery panel after a real absence', () => {
    const { delayedCall } = enter(3_600_000);
    expect(delayedCall).toHaveBeenCalledTimes(1);
  });
});
