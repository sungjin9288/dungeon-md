import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { GameState } from '../data/wisdom';
import type { DungeonTheme } from '../themes/themes';
import { buildPrestigeBadge } from './PrestigeModal';
import { buildTopBar } from './HomeTopBar';

vi.mock('../data/quests', () => ({
  getQuest: vi.fn(() => null),
}));

vi.mock('../utils/reducedMotion', () => ({
  getReducedMotion: vi.fn(() => true),
}));

vi.mock('./AudioSettingsPanel', () => ({
  showAudioSettings: vi.fn(),
}));

vi.mock('./QuestLogPanel', () => ({
  openQuestLog: vi.fn(),
}));

vi.mock('./PrestigeModal', () => ({
  buildPrestigeBadge: vi.fn(),
  openPrestigeModal: vi.fn(),
}));

function makeDisplayObject(): Record<string, ReturnType<typeof vi.fn>> & { width: number; x: number } {
  const object = { width: 20, x: 0 } as Record<string, ReturnType<typeof vi.fn>> & { width: number; x: number };
  for (const method of [
    'clear', 'destroy', 'fillCircle', 'fillRect', 'fillRoundedRect', 'fillStyle',
    'fillTriangle', 'lineBetween', 'lineStyle', 'on', 'setDepth', 'setInteractive',
    'setOrigin', 'setPosition', 'strokeCircle', 'strokeRoundedRect', 'strokeTriangle',
  ]) {
    object[method] = vi.fn(() => object);
  }
  return object;
}

function makeScene(): Phaser.Scene {
  return {
    add: {
      graphics: vi.fn(() => makeDisplayObject()),
      text: vi.fn(() => makeDisplayObject()),
      zone: vi.fn(() => makeDisplayObject()),
    },
    tweens: { add: vi.fn() },
  } as unknown as Phaser.Scene;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    dmLevel: 1,
    dmXP: 0,
    gameCompleted: false,
    prestigeLevel: 0,
    unlockedFeatures: [],
    activeMainQuestId: '',
    questProgress: {},
    homeGold: 200,
    soulCrystals: 0,
    gems: 0,
    ...overrides,
  } as GameState;
}

const theme = { panelBorder: 0x80643a } as DungeonTheme;

describe('buildTopBar — prestige status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildPrestigeBadge).mockReturnValue(
      makeDisplayObject() as unknown as Phaser.GameObjects.Container,
    );
  });

  it('keeps prestige visible beside the DM seal during a new run', () => {
    const scene = makeScene();

    buildTopBar(scene, makeState({ prestigeLevel: 1 }), theme, 64, { questLogOpen: false }, () => 100);

    expect(buildPrestigeBadge).toHaveBeenCalledWith(scene, 28, 51, 1);
    const badge = vi.mocked(buildPrestigeBadge).mock.results[0]?.value;
    expect(badge.setDepth).toHaveBeenCalledWith(8);
    expect(scene.add.zone).toHaveBeenCalledWith(202, 32, 44, 44);
    expect(scene.add.zone).toHaveBeenCalledWith(246, 32, 44, 44);
    expect(scene.add.zone).not.toHaveBeenCalledWith(266, 32, 44, 44);
  });

  it('keeps completed-run actions in place while using the same badge anchor', () => {
    const scene = makeScene();

    buildTopBar(
      scene,
      makeState({ prestigeLevel: 2, gameCompleted: true }),
      theme,
      64,
      { questLogOpen: false },
      () => 100,
    );

    expect(buildPrestigeBadge).toHaveBeenCalledWith(scene, 28, 51, 2);
    expect(scene.add.zone).toHaveBeenCalledWith(178, 32, 44, 44);
    expect(scene.add.zone).toHaveBeenCalledWith(222, 32, 44, 44);
    expect(scene.add.zone).toHaveBeenCalledWith(266, 32, 44, 44);
  });

  it('does not render a prestige badge before the first prestige', () => {
    const scene = makeScene();

    buildTopBar(scene, makeState(), theme, 64, { questLogOpen: false }, () => 100);

    expect(buildPrestigeBadge).not.toHaveBeenCalled();
  });
});
