import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';
import { loadProgress, saveProgress } from '../data/stageProgress';
import { openPrestigeModal } from './PrestigeModal';
import { addPrimaryActionButton } from './GameUiPrimitives';
import { showToast } from './Toast';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../utils/reducedMotion', () => ({ getReducedMotion: () => true }));
vi.mock('./Toast', () => ({ showToast: vi.fn() }));
vi.mock('./GameUiPrimitives', () => ({
  addFramedPanel: () => ({}), addInfoRow: () => ({}),
  addPrimaryActionButton: vi.fn(() => ({})),
}));

function open() {
  const object: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['setDepth', 'setInteractive', 'add', 'fillStyle', 'fillRect', 'setOrigin', 'lineStyle', 'lineBetween', 'destroy']) object[method] = vi.fn(() => object);
  const scene = { add: { container: () => object, zone: () => object, graphics: () => object, text: () => object } } as unknown as Phaser.Scene;
  const confirmed = vi.fn();
  openPrestigeModal(scene, confirmed);
  const press = (label: string) => {
    const options = vi.mocked(addPrimaryActionButton).mock.calls.find(([, opts]) => opts.label.includes(label))?.[1];
    if (!options?.onPress) throw new Error(`Missing ${label}`);
    options.onPress();
  };
  return { confirmed, press };
}

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  const progress = Array.from({ length: 90 }, () => ({ unlocked: true, bestStars: 3, bestHpPercent: 90 }));
  saveGameState({ ...loadGameState(), gameCompleted: true, prestigeLevel: 2, dmLevel: 12, soulCrystals: 777, homeGold: 9000, stageProgress: progress });
  saveProgress(progress);
});
afterEach(() => vi.unstubAllGlobals());
const snapshot = () => [localStorage.getItem('dungeonGameState'), localStorage.getItem('dungeonStageProgress')];

describe('prestige confirmation persistence', () => {
  it('resets both progress stores through the actual confirm handler and keeps permanent growth', () => {
    const before = loadGameState();
    const f = open(); f.press('시작하기');
    const after = loadGameState();
    expect(loadProgress()).toEqual(after.stageProgress);
    expect(loadProgress()[0]).toEqual({ unlocked: true, bestStars: 0 });
    expect(loadProgress().slice(1).every(stage => !stage.unlocked && stage.bestStars === 0)).toBe(true);
    expect(after).toMatchObject({ prestigeLevel: 3, gameCompleted: false, homeGold: 200, dmLevel: 12, soulCrystals: 777 });
    expect(after.ownedMonsters).toEqual(before.ownedMonsters);
    expect(after.wisdomTree).toEqual(before.wisdomTree);
    expect(f.confirmed).toHaveBeenCalledTimes(1);
    f.press('시작하기');
    expect(loadGameState().prestigeLevel).toBe(3);
    expect(f.confirmed).toHaveBeenCalledTimes(1);
  });

  it('cancel does not change either store', () => {
    const before = snapshot(); const f = open(); f.press('취소');
    expect(snapshot()).toEqual(before); expect(f.confirmed).not.toHaveBeenCalled();
  });

  it('rechecks completion after the modal was opened', () => {
    const f = open(); saveGameState({ ...loadGameState(), gameCompleted: false });
    const before = snapshot(); f.press('시작하기');
    expect(snapshot()).toEqual(before); expect(f.confirmed).not.toHaveBeenCalled();
  });

  it.each(['dungeonGameState', 'dungeonStageProgress'])('retains both saves and rejects completion if writing %s fails', key => {
    const f = open(); const before = snapshot(); const storage = localStorage;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage),
      setItem(name: string, value: string) {
        if (name === key) throw new DOMException('Full', 'QuotaExceededError');
        storage.setItem(name, value);
      },
    });
    expect(() => f.press('시작하기')).not.toThrow();
    expect(snapshot()).toEqual(before);
    expect(f.confirmed).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
  });
});
