import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class { static Contains() { return true; } } }, Math: { Clamp: (v: number) => v } } }));
vi.mock('../ui/GameUiPrimitives', async importOriginal => ({
  ...(await importOriginal<typeof import('../ui/GameUiPrimitives')>()),
  addFramedPanel: () => ({ shadow: stub(), panel: stub(), glow: stub() }),
  addPrimaryActionButton: () => ({ bg: stub(), text: stub(), zone: stub() }),
}));
const { tryShowWaveEvent, WAVE_BRIEFING_NAME } = await import('./WaveEvents');

function stub(): unknown { return chain(); }
function chain(): unknown {
  const self: unknown = new Proxy(function noop() { /* stub */ }, { get: (_t, key) => (key === 'then' ? undefined : () => self), apply: () => self });
  return self;
}

// The scout report's dim did not block input: tapping the panel body pressed the
// "침입 방어 개시" button underneath, stacking a second briefing (and a second
// wave-event roll, whose multipliers apply on show). One briefing at a time.
describe('wave briefing guard', () => {
  function scene(open: boolean) {
    const containers: string[] = [];
    const created: number[] = [];
    const container = () => {
      created.push(1);
      const wrapper: unknown = new Proxy({}, {
        get: (_t, key) => (key === 'setName'
          ? (n: string) => { containers.push(n); return wrapper; }
          : () => wrapper),
      });
      return wrapper;
    };
    return {
      containers, created,
      value: {
        children: { getByName: (n: string) => (open && n === WAVE_BRIEFING_NAME ? {} : null) },
        add: { container, graphics: chain, text: chain, zone: chain },
        tweens: { add: vi.fn() }, time: { delayedCall: vi.fn() },
      },
    };
  }
  const ctx = (s: unknown) => ({
    scene: s, wave: 1, maxWave: 6, isEndless: false, stageNumber: 1, maxHp: 1500, dungeonHp: 1500,
    waveConfigs: [{ invaders: [{ type: 'peasant', count: 3, spawnDelay: 2400 }] }, { invaders: [{ type: 'peasant', count: 3, spawnDelay: 2400 }] }],
    theme: {}, synergyHasMoonlightHealUp: false, waveGoldMult: 1, waveHpMult: 1, waveAtkMult: 1, waveSpdMult: 1,
    waveFogOverlay: undefined, pendingWaveMults: undefined, startWave: vi.fn(), setRegistryHp: vi.fn(),
  });

  it('opens one named briefing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const s = scene(false);
    tryShowWaveEvent(ctx(s.value) as never);
    expect(s.containers).toContain(WAVE_BRIEFING_NAME);
  });

  it('does not stack a second briefing while one is open', () => {
    const s = scene(true);
    tryShowWaveEvent(ctx(s.value) as never);
    expect(s.created).toEqual([]);
  });
});
