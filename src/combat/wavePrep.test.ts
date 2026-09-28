import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPrepCountdown, enableWaveButton, startPrepCountdown, type WavePrepContext,
} from './WaveLifecycle';

vi.mock('./DungeonLayout', () => ({ WAVE_BUTTON_H: 48, WAVE_BUTTON_W: 270 }));
vi.mock('../utils/reducedMotion', () => ({ getReducedMotion: () => true }));

function fixture() {
  const displays: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
  const display = () => {
    const value: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const key of ['setDepth', 'setAlpha', 'setOrigin', 'fillStyle', 'fillRoundedRect',
      'lineStyle', 'beginPath', 'arc', 'strokePath', 'clear', 'setText', 'setColor', 'setInteractive', 'destroy']) {
      value[key] = vi.fn(() => value);
    }
    displays.push(value);
    return value;
  };
  const scene = {
    events: new EventEmitter(),
    add: { graphics: display, text: display },
    tweens: { add: vi.fn() },
    registry: { set: vi.fn() },
    time: {
      delayedCall: (_ms: number, callback: () => void) => {
        const id = setTimeout(callback, _ms);
        return { remove: () => clearTimeout(id) };
      },
    },
  };
  const state = { prepActive: false, prepTimer: 0, waveHasSpawned: true, waveEndChecked: true };
  const ctx = {
    scene, effectiveCellSize: 110, wave: 1, waveConfigs: [{}, { invaders: [{ type: 'peasant', count: 2 }] }],
    get prepTimer() { return state.prepTimer; },
    waveBtnBg: display(), waveBtnZone: display(), waveLabel: display(), drawBtn: vi.fn(),
    setWaveEndChecked: (v: boolean) => { state.waveEndChecked = v; },
    setWaveHasSpawned: (v: boolean) => { state.waveHasSpawned = v; },
    setPrepActive: (v: boolean) => { state.prepActive = v; },
    setPrepTimer: (v: number) => { state.prepTimer = v; },
    setCountdownBar: (bar: Phaser.GameObjects.Graphics | undefined) => { ctx.countdownBar = bar; },
    countdownBar: undefined,
  } as unknown as WavePrepContext;
  return { scene, state, ctx, displays };
}

describe('wave preparation timer ownership', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('finishes the normal ten-second countdown once and releases its listener', () => {
    const { ctx, state, scene } = fixture();
    startPrepCountdown(ctx);
    vi.advanceTimersByTime(9000);
    expect(state).toEqual({ prepActive: true, prepTimer: 1, waveHasSpawned: true, waveEndChecked: true });
    vi.advanceTimersByTime(1000);
    expect(state).toEqual({ prepActive: false, prepTimer: 0, waveHasSpawned: false, waveEndChecked: false });
    expect(ctx.drawBtn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(scene.events.listenerCount('shutdown')).toBe(0);
  });

  it('cancels the previous prep without resetting flags owned by the next battle', () => {
    const { ctx, state, scene, displays } = fixture();
    startPrepCountdown(ctx);
    vi.advanceTimersByTime(600);
    cancelPrepCountdown(ctx.scene);
    expect(scene.registry.set).toHaveBeenLastCalledWith('status', '');
    state.waveHasSpawned = true;
    state.waveEndChecked = true;
    scene.registry.set.mockClear();
    vi.advanceTimersByTime(12000);
    expect(state).toEqual({ prepActive: false, prepTimer: 0, waveHasSpawned: true, waveEndChecked: true });
    expect(ctx.drawBtn).not.toHaveBeenCalled();
    expect(scene.registry.set).not.toHaveBeenCalled();
    // Countdown number, enemy preview and ring were destroyed exactly once.
    expect(displays.filter(d => d.destroy.mock.calls.length === 1)).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('defence inspection enables the button without leaving a later reset', () => {
    const { ctx, state } = fixture();
    startPrepCountdown(ctx);
    enableWaveButton(ctx);
    state.waveHasSpawned = true;
    vi.advanceTimersByTime(12000);
    expect(state.waveHasSpawned).toBe(true);
    expect(ctx.drawBtn).toHaveBeenCalledTimes(1);
    expect(state.prepTimer).toBe(0);
  });

  it('replacing a countdown keeps only the new countdown and shutdown listener', () => {
    const { ctx, state, scene } = fixture();
    startPrepCountdown(ctx);
    vi.advanceTimersByTime(700);
    startPrepCountdown(ctx);
    vi.advanceTimersByTime(300);
    expect(state.prepTimer).toBe(10);
    vi.advanceTimersByTime(700);
    expect(state.prepTimer).toBe(9);
    expect(vi.getTimerCount()).toBe(1);
    expect(scene.events.listenerCount('shutdown')).toBe(1);
  });

  it('scene shutdown cancels pending prep and repeated cancellation is harmless', () => {
    const { ctx, state, scene } = fixture();
    startPrepCountdown(ctx);
    scene.events.emit('shutdown');
    cancelPrepCountdown(ctx.scene);
    vi.advanceTimersByTime(12000);
    expect(state.prepActive).toBe(false);
    expect(state.waveHasSpawned).toBe(true);
    expect(ctx.drawBtn).not.toHaveBeenCalled();
    expect(scene.events.listenerCount('shutdown')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancelling one scene leaves another scene countdown running', () => {
    const a = fixture(), b = fixture();
    startPrepCountdown(a.ctx);
    startPrepCountdown(b.ctx);
    cancelPrepCountdown(a.ctx.scene);
    vi.advanceTimersByTime(1000);
    expect(a.state.prepTimer).toBe(0);
    expect(b.state.prepTimer).toBe(9);
  });
});
