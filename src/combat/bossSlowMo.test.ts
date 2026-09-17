import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOSS_SLOWMO_MS, BOSS_SLOWMO_SCALE, playBossKillReaction } from './ImpactVfx';

function fakeScene(active = true) {
  return {
    time: { timeScale: 1 },
    tweens: { timeScale: 1, add: vi.fn() },
    scene: { isActive: () => active },
    add: {
      graphics: () => ({ setDepth: () => ({ fillStyle: () => {}, fillRect: () => {}, destroy: () => {} }) }),
    },
    cameras: { main: { shake: vi.fn() } },
  } as unknown as Phaser.Scene;
}

describe('boss kill slow-mo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dips the clock and tweens, then returns both to the battle speed', () => {
    const scene = fakeScene();
    playBossKillReaction(scene, 3);
    expect(scene.time.timeScale).toBe(BOSS_SLOWMO_SCALE);
    expect(scene.tweens.timeScale).toBe(BOSS_SLOWMO_SCALE);
    vi.advanceTimersByTime(BOSS_SLOWMO_MS + 1);
    // Both return to 3× — a boss kill must not drop a sped-up battle to 1× motion.
    expect(scene.time.timeScale).toBe(3);
    expect(scene.tweens.timeScale).toBe(3);
  });

  it('two kills inside the window still restore the battle speed, never the dipped scale', () => {
    const scene = fakeScene();
    playBossKillReaction(scene, 3);
    vi.advanceTimersByTime(BOSS_SLOWMO_MS / 2);
    playBossKillReaction(scene, 3);            // second kill captures a dipped clock
    vi.advanceTimersByTime(BOSS_SLOWMO_MS / 2 + 1);
    expect(scene.time.timeScale).toBe(BOSS_SLOWMO_SCALE); // first timer must not restore early
    vi.advanceTimersByTime(BOSS_SLOWMO_MS);
    expect(scene.time.timeScale).toBe(3);
    expect(scene.tweens.timeScale).toBe(3);
  });

  it('leaves a scene that stopped mid-reaction alone', () => {
    const scene = fakeScene(false);
    playBossKillReaction(scene, 2);
    vi.advanceTimersByTime(BOSS_SLOWMO_MS + 1);
    expect(scene.time.timeScale).toBe(BOSS_SLOWMO_SCALE);
  });
});
