import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';
import { STAGE_DEFEAT_DM_XP } from '../data/invasionTransactions';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('./WaveLifecycle', () => ({ enableWaveButton: vi.fn() }));
vi.mock('../ui/HomeResultOverlays', () => ({ addBattleCalloutRow: vi.fn() }));
vi.mock('../ui/GameUiPrimitives', () => ({ addFramedPanel: vi.fn(), addPrimaryActionButton: vi.fn() }));
const { buildFailOptions, FAIL_OPTION_COUNT } = await import('./ResultPanel');

// A lost campaign stage offered only revive or restart: there was no way back
// to Home to reinforce, which is the loop the defeat hint asks for.
function ctx(returnTo?: string) {
  const registry = new Map<string, unknown>();
  const started: string[] = [];
  return {
    registry, started,
    value: {
      returnTo, gold: 120, gems: 0, materialsEarnedThisRun: { old_cloth: 1 },
      scene: {
        registry: { set: (k: string, v: unknown) => registry.set(k, v) },
        scene: { stop: vi.fn(), start: (key: string) => started.push(key) },
      },
    },
  };
}
const ov = { destroy: vi.fn() };

beforeEach(() => {
  localStorage.clear();
  saveGameState({ ...loadGameState(), homeGold: 500, dmXP: 10, dmLevel: 2, materials: {} });
});

describe('battle defeat options', () => {
  it('always offers the retreat first', () => {
    const labels = buildFailOptions(ctx().value as never, ov as never, null).map(option => option.label);
    expect(labels).toHaveLength(FAIL_OPTION_COUNT);
    expect(labels[0]).toBe('던전으로 귀환 · 방어선 보강');
  });

  it('settles a campaign stage retreat and returns Home', () => {
    const c = ctx();
    buildFailOptions(c.value as never, ov as never, null)[0].action();
    const saved = loadGameState();
    expect([saved.homeGold, saved.dmXP, saved.materials]).toEqual([620, 10 + STAGE_DEFEAT_DM_XP, { old_cloth: 1 }]);
    expect(c.registry.has('battleResult')).toBe(false);
    expect(c.started).toEqual(['DungeonHomeScene']);
  });

  it('keeps the invasion hand-off to Home for returnTo battles', () => {
    const c = ctx('DungeonHomeScene');
    buildFailOptions(c.value as never, ov as never, null)[0].action();
    expect(loadGameState().homeGold).toBe(500);
    expect(c.registry.get('battleResult')).toMatchObject({ won: false, goldEarned: 120, dmXP: STAGE_DEFEAT_DM_XP });
  });
});
