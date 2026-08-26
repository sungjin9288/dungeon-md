import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';
import type { GameState } from '../data/wisdom';
import type { ResultFlowContext } from './ResultFlow';
import { showGameComplete } from './GameCompleteFlow';

vi.mock('../data/wisdom', () => ({
  loadGameState: vi.fn(),
  saveGameState: vi.fn(),
}));

function makeDisplayObject(): Record<string, ReturnType<typeof vi.fn>> {
  const object: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'add', 'clear', 'destroy', 'fillCircle', 'fillRect', 'fillRoundedRect',
    'fillStyle', 'lineStyle', 'on', 'setAlpha', 'setDepth', 'setInteractive',
    'setOrigin', 'setPosition', 'setScale', 'strokeRoundedRect',
  ]) {
    object[method] = vi.fn(() => object);
  }
  return object;
}

describe('showGameComplete — repeat clear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the awarded 0 bonus and keeps the summary scene live', () => {
    const completedState = {
      gameCompleted: true,
      cinematicSeen: ['game_complete'],
      soulCrystals: 70,
      dmLevel: 30,
      stageProgress: Array.from({ length: 90 }, () => ({ unlocked: true, bestStars: 3 })),
    } as GameState;
    vi.mocked(loadGameState).mockReturnValue(completedState);

    const textCalls: string[] = [];
    const scene = {
      add: {
        container: vi.fn(() => makeDisplayObject()),
        graphics: vi.fn(() => makeDisplayObject()),
        text: vi.fn((_x: number, _y: number, text: string) => {
          textCalls.push(text);
          return makeDisplayObject();
        }),
        zone: vi.fn(() => makeDisplayObject()),
      },
      scene: {
        pause: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      },
      time: { delayedCall: vi.fn() },
      tweens: { add: vi.fn() },
    };
    const setWaveActive = vi.fn();
    const ctx = {
      scene,
      dungeonHp: 15000,
      maxHp: 15000,
      setWaveActive,
      checkAchievementsAndToast: vi.fn(),
    } as unknown as ResultFlowContext;

    showGameComplete(ctx);

    expect(saveGameState).not.toHaveBeenCalled();
    expect(setWaveActive).toHaveBeenCalledWith(false);
    expect(scene.scene.pause).not.toHaveBeenCalled();
    expect(textCalls).toContain('+0 💠');
    expect(textCalls).not.toContain('+50 💠');
  });
});
