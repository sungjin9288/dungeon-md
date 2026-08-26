import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWaveEnd, type CheckWaveEndContext } from './WaveLifecycle';

vi.mock('./DungeonLayout', () => ({ WAVE_BUTTON_H: 48, WAVE_BUTTON_W: 270 }));

describe('checkWaveEnd — pending spawn guard', () => {
  beforeEach(() => localStorage.clear());

  it('does not schedule wave clear while configured spawns are still pending', () => {
    const delayed: Array<() => void> = [];
    let waveEndChecked = false;
    let waveActive = true;
    let activeInvaders: never[] = [];
    let consecutiveNoDmgWaves = 0;

    const ctx = {
      scene: {
        time: { delayedCall: (_delay: number, callback: () => void) => delayed.push(callback) },
        tweens: { add: () => undefined },
      },
      wave: 1,
      maxWave: 10,
      waveStartDungeonHp: 100,
      maxHp: 100,
      get waveEndChecked() { return waveEndChecked; },
      set waveEndChecked(value) { waveEndChecked = value; },
      waveHasSpawned: true,
      spawnQueue: [{}],
      get activeInvaders() { return activeInvaders; },
      set activeInvaders(value) { activeInvaders = value as never[]; },
      killCounterText: undefined,
      get waveActive() { return waveActive; },
      set waveActive(value) { waveActive = value; },
      dungeonHp: 100,
      get consecutiveNoDmgWaves() { return consecutiveNoDmgWaves; },
      set consecutiveNoDmgWaves(value) { consecutiveNoDmgWaves = value; },
      saveRoomHpsToGameState: () => undefined,
      showChapterClear: () => undefined,
      showWaveClear: () => undefined,
    } as unknown as CheckWaveEndContext;

    checkWaveEnd(ctx);

    expect(waveEndChecked).toBe(false);
    expect(waveActive).toBe(true);
    expect(delayed).toHaveLength(0);
  });
});
