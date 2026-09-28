import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductionScene } from './ProductionScene';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

const cases = [
  { name: 'first construction', setup: (gs: GameState) => ({ ...gs, productionFacilities: {}, lastIdleCollect: 0 }),
    run: (s: ProductionScene) => s['buildOrUpgrade']('mine'),
    expected: { homeGold: 4850, productionFacilities: { mine: 1 }, lastIdleCollect: 10_001_000 } },
  { name: 'upgrade', run: (s: ProductionScene) => s['buildOrUpgrade']('mine'),
    expected: { homeGold: 4830, materials: { common_ore: 7 }, productionFacilities: { mine: 2 }, lastIdleCollect: 10_001_000 } },
  { name: 'collection', run: (s: ProductionScene) => s['collect'](),
    expected: { homeGold: 5100, materials: { common_ore: 7 }, lastIdleCollect: 10_001_000 } },
  { name: 'assignment from a room', setup: (gs: GameState) => ({ ...gs, dungeonSlots: [{ roomType: 'combat' as const, roomLevel: 1, hp: 100, maxHp: 100, monsterIds: ['dokkaebi_warrior'], trapIds: [] }] }),
    run: (s: ProductionScene) => s['assignStaff']('mine', 'dokkaebi_warrior'),
    expected: { facilityStaff: { mine: 'dokkaebi_warrior' } } },
  { name: 'assignment from another facility', setup: (gs: GameState) => ({ ...gs, facilityStaff: { treasury: 'dokkaebi_warrior' } }),
    run: (s: ProductionScene) => s['assignStaff']('mine', 'dokkaebi_warrior'),
    expected: { homeGold: 5150, materials: { common_ore: 7 }, facilityStaff: { mine: 'dokkaebi_warrior' } } },
  { name: 'unassignment', setup: (gs: GameState) => ({ ...gs, facilityStaff: { mine: 'dokkaebi_warrior' } }),
    run: (s: ProductionScene) => s['clearStaff']('mine'), expected: { homeGold: 5100, materials: { common_ore: 7 }, facilityStaff: {} } },
];

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe('ProductionScene persistence', () => {
  it.each(cases)('$name retains the original save on failure and retries once', test => {
    const base = { ...loadGameState(), homeGold: 5000, lastIdleCollect: 6_400_000,
      productionFacilities: { mine: 1, treasury: 1 }, materials: { common_ore: 5 } };
    saveGameState(test.setup ? test.setup(base) : base);
    const scene = new ProductionScene();
    const render = vi.spyOn(scene as unknown as { render(): void }, 'render').mockImplementation(() => {});
    scene.create(); render.mockClear();
    const original = scene['gs'], raw = localStorage.getItem('dungeonGameState');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(10_000_000);
    const storage = localStorage; let reject = true, writes = 0;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem(key: string, value: string) {
        if (reject) throw new DOMException('Full', 'QuotaExceededError');
        storage.setItem(key, value); writes++;
      },
    });
    expect(() => test.run(scene)).not.toThrow();
    expect(scene['gs']).toBe(original);
    expect(localStorage.getItem('dungeonGameState')).toBe(raw);
    expect(writes).toBe(0);
    expect(scene['transactionPending']).toBe(false);
    expect(scene['receipt']).toEqual({ text: '저장 실패 · 다시 시도해주세요', tone: 'warning' });
    expect(render).toHaveBeenCalledTimes(1);

    reject = false; clock.mockReturnValue(10_001_000);
    test.run(scene);
    expect(writes).toBe(1);
    expect(loadGameState()).toMatchObject(test.expected);
    expect(JSON.parse(JSON.stringify(scene['gs']))).toEqual(loadGameState());
    expect(scene['receipt']?.tone).toBe('success');
    if (test.name !== 'first construction' && test.name !== 'collection') {
      expect(scene['receipt']?.text).toContain('적립분 수령');
      expect(scene['gs'].lastIdleCollect).toBe(10_001_000);
    }
    if (test.name.startsWith('assignment')) {
      expect(loadGameState().facilityStaff).toEqual({ mine: 'dokkaebi_warrior' });
      expect(loadGameState().dungeonSlots.flatMap(slot => slot.monsterIds)).not.toContain('dokkaebi_warrior');
    }
    if (test.name === 'unassignment') expect(loadGameState().facilityStaff).toEqual({});
    test.run(scene); // Same-tick duplicate stays behind the existing cooldown.
    expect(writes).toBe(1);
    expect(render).toHaveBeenCalledTimes(2);
  });
});
