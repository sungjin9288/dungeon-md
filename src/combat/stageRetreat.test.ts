import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGameState, saveGameState } from '../data/wisdom';
import { STAGE_DEFEAT_DM_XP } from '../data/invasionTransactions';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('./WaveLifecycle', () => ({ enableWaveButton: vi.fn() }));
vi.mock('../ui/HomeResultOverlays', () => ({ addBattleCalloutRow: vi.fn() }));
vi.mock('../ui/GameUiPrimitives', () => ({ addFramedPanel: vi.fn(), addPrimaryActionButton: vi.fn() }));
const { buildFailOptions, FAIL_OPTION_COUNT, AD_REVIVES_PER_BATTLE } = await import('./ResultPanel');

// A lost campaign stage offered only revive or restart: there was no way back
// to Home to reinforce, which is the loop the defeat hint asks for.
function ctx(returnTo?: string, adRevivesUsed = 0) {
  const registry = new Map<string, unknown>();
  const started: string[] = [];
  const revives = { used: adRevivesUsed };
  return {
    registry, started, revives,
    value: {
      returnTo, gold: 120, gems: 0, materialsEarnedThisRun: { old_cloth: 1 },
      maxHp: 1000, wave: 4,
      get adRevivesUsed() { return revives.used; },
      setAdRevivesUsed: (n: number) => { revives.used = n; },
      setDungeonHp: vi.fn(), setWaveEndChecked: vi.fn(), setWave: vi.fn(), startWave: vi.fn(),
      scene: {
        registry: { set: (k: string, v: unknown) => registry.set(k, v), get: (k: string) => registry.get(k) },
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

  it('an abyss climb retreats to the expedition hall, not to the dungeon', () => {
    const c = ctx('AbyssScene');
    c.registry.set('abyssPendingFloor', 2);
    const retreat = buildFailOptions(c.value as never, ov as never, null)[0];
    expect(retreat.label).toBe('심연 원정실로 · 전리품 정산');
    retreat.action();
    expect(c.registry.get('battleResult')).toMatchObject({ won: false, goldEarned: 120 });
    expect(c.started).toEqual(['AbyssScene']);
  });

  it('keeps the invasion hand-off to Home for returnTo battles', () => {
    const c = ctx('DungeonHomeScene');
    buildFailOptions(c.value as never, ov as never, null)[0].action();
    expect(loadGameState().homeGold).toBe(500);
    expect(c.registry.get('battleResult')).toMatchObject({ won: false, goldEarned: 120, dmXP: STAGE_DEFEAT_DM_XP });
  });
});

describe('ad revive limit', () => {
  it('offers one free ad revive per battle', () => {
    const c = ctx();
    const ad = buildFailOptions(c.value as never, ov as never, null)[1];
    expect(ad.label).toBe('광고 확인 후 부활');
    ad.action();
    expect(c.revives.used).toBe(AD_REVIVES_PER_BATTLE);
    expect(c.value.startWave).toHaveBeenCalledTimes(1);
  });

  it('disables the ad revive once it has been used this battle', () => {
    const c = ctx(undefined, AD_REVIVES_PER_BATTLE);
    const options = buildFailOptions(c.value as never, ov as never, null);
    expect(options).toHaveLength(FAIL_OPTION_COUNT);
    const ad = options[1];
    expect(ad.label).toContain('사용함');
    expect(ad.canDismiss?.()).toBe(false);
    ad.action();
    expect(c.value.startWave).not.toHaveBeenCalled();
    expect(c.registry.get('status')).toBe('광고 부활은 전투당 1회입니다');
  });
});
