import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DungeonHomeScene } from './DungeonHomeScene';
import { maybeShowIdleIncome } from './HomeLifecycle';
import { loadGameState, saveGameState } from '../data/wisdom';

vi.mock('phaser', () => ({ default: {
  Scene: class {}, Geom: { Rectangle: class { static Contains() { return true; } } },
} }));
vi.mock('../ui/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../ui/GameUiPrimitives', () => ({
  addFramedPanel: () => ({}), addPrimaryActionButton: vi.fn(() => ({})),
}));

// Own file: `homeVisitedThisLaunch` is module state, and this case needs a fresh launch.
describe('first Home visit of a brand-new save', () => {
  let now = 10_000_000;

  function enter() {
    const scene = new DungeonHomeScene();
    scene.gs = loadGameState();
    const delayedCall = vi.fn();
    Object.assign(scene, { time: { delayedCall }, refreshCurrencyTexts: vi.fn() });
    maybeShowIdleIncome(scene);
    return { delayedCall };
  }

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('counts the clock-starting visit, so a later in-session return skips the panel', () => {
    saveGameState({ ...loadGameState(), lastIdleCollect: 0, productionFacilities: { mine: 1, treasury: 1 } });
    enter();
    expect(loadGameState().lastIdleCollect).toBe(now);

    now += 6 * 60_000; // a six-minute battle, well past the 5-minute first-visit threshold
    const { delayedCall } = enter();
    expect(delayedCall).not.toHaveBeenCalled();
    expect(loadGameState().lastIdleCollect).toBe(now);
  });
});
