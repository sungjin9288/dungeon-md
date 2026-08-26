import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { applyPrestigeStart } from '../data/prestigeTransactions';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { buildPrestigeBadge, openPrestigeModal } from './PrestigeModal';

vi.mock('../data/wisdom', () => ({
  loadGameState: vi.fn(),
  saveGameState: vi.fn(),
  getPrestigeDmgMult: vi.fn(() => 1),
}));

vi.mock('../data/prestigeTransactions', () => ({
  applyPrestigeStart: vi.fn(),
}));

vi.mock('../utils/reducedMotion', () => ({
  getReducedMotion: vi.fn(() => true),
}));

vi.mock('./GameUiPrimitives', () => ({
  addFramedPanel: vi.fn(() => ({
    shadow: makeDisplayObject(),
    panel: makeDisplayObject(),
    glow: makeDisplayObject(),
  })),
  addInfoRow: vi.fn(() => ({
    bg: makeDisplayObject(),
    iconText: makeDisplayObject(),
    labelText: makeDisplayObject(),
    valueText: makeDisplayObject(),
  })),
  addPrimaryActionButton: vi.fn(() => ({
    bg: makeDisplayObject(),
    text: makeDisplayObject(),
    zone: makeDisplayObject(),
  })),
}));

function makeDisplayObject(): Record<string, ReturnType<typeof vi.fn>> {
  const object: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'add', 'destroy', 'fillRect', 'fillStyle', 'lineBetween', 'lineStyle',
    'setDepth', 'setInteractive', 'setOrigin',
  ]) {
    object[method] = vi.fn(() => object);
  }
  return object;
}

function makeScene() {
  const container = makeDisplayObject();
  const blocker = makeDisplayObject();
  return {
    container,
    blocker,
    scene: {
      add: {
        container: vi.fn(() => container),
        graphics: vi.fn(() => makeDisplayObject()),
        text: vi.fn(() => makeDisplayObject()),
        zone: vi.fn(() => blocker),
      },
      tweens: { add: vi.fn() },
    } as unknown as Phaser.Scene,
  };
}

function completedState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameCompleted: true,
    prestigeLevel: 0,
    ...overrides,
  } as GameState;
}

describe('openPrestigeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadGameState).mockReturnValue(completedState());
  });

  it('adds a full-screen interactive blocker below the modal content', () => {
    const { scene, container, blocker } = makeScene();

    openPrestigeModal(scene, vi.fn());

    expect(scene.add.zone).toHaveBeenCalledWith(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    expect(blocker.setInteractive).toHaveBeenCalledOnce();
    expect(container.add).toHaveBeenNthCalledWith(1, blocker);
  });

  it('persists the prestige transaction before invoking the confirm callback', () => {
    const initial = completedState();
    const current = completedState({ prestigeLevel: 2 });
    const next = completedState({ gameCompleted: false, prestigeLevel: 3 });
    vi.mocked(loadGameState)
      .mockReturnValueOnce(initial)
      .mockReturnValueOnce(current);
    vi.mocked(applyPrestigeStart).mockReturnValue({
      ok: true,
      state: next,
      changed: true,
      previousPrestigeLevel: 2,
      nextPrestigeLevel: 3,
      damageMultiplier: 1.3,
    });
    const { scene, container } = makeScene();
    const onConfirm = vi.fn();

    openPrestigeModal(scene, onConfirm);
    const confirmOptions = vi.mocked(addPrimaryActionButton).mock.calls
      .map(([, options]) => options)
      .find((options) => options.label === '✨ 시작하기');
    expect(confirmOptions).toBeDefined();
    confirmOptions?.onPress();

    expect(applyPrestigeStart).toHaveBeenCalledWith(current);
    expect(saveGameState).toHaveBeenCalledWith(next);
    expect(container.destroy).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(vi.mocked(saveGameState).mock.invocationCallOrder[0])
      .toBeLessThan(onConfirm.mock.invocationCallOrder[0]);
  });
});

describe('buildPrestigeBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the home status compact enough for the DM seal footprint', () => {
    const { scene } = makeScene();

    buildPrestigeBadge(scene, 28, 51, 1);

    expect(scene.add.container).toHaveBeenCalledWith(28, 51);
    expect(addFramedPanel).toHaveBeenCalledWith(scene, expect.objectContaining({
      x: -26,
      y: -10,
      w: 52,
      h: 20,
      radius: 8,
    }));
    expect(scene.add.text).toHaveBeenCalledWith(0, 0, '👑 ×1', expect.objectContaining({
      fontSize: '10px',
    }));
  });
});
