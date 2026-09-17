import { describe, expect, it } from 'vitest';
import { buildTrapForgeRow, buildTrapForgeRows, summarizeTrapForge } from './trapForgeView';
import { getTrapDef, TRAP_DEFS, TRAP_MASTERY_MAX } from './traps';
import { loadGameState, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), dmLevel: 20, ...overrides };
}

describe('trapForgeView', () => {
  it('projects one row per trap in recipe-tree order', () => {
    const rows = buildTrapForgeRows(state());
    expect(rows.map(row => row.def.id)).toEqual(TRAP_DEFS.map(def => def.id));
  });

  it('explains why a craft is off: lock level, materials, or input traps', () => {
    expect(buildTrapForgeRow(state({ dmLevel: 1, materials: { magic_dust: 9, iron_shard: 9 } }), getTrapDef('stun_trap')!).craft)
      .toEqual({ ok: false, reason: 'locked', label: 'Lv.10 잠김' });
    expect(buildTrapForgeRow(state({ materials: {} }), getTrapDef('spike_trap')!).craft.label).toBe('재료 부족');
    const fusion = buildTrapForgeRow(state({ materials: { iron_shard: 3, herb: 3 }, trapStock: { spike_trap: 1 } }), getTrapDef('thorn_wall')!);
    expect(fusion.craft.label).toBe('하위 함정 부족');
    expect(fusion.inputTraps).toEqual([
      { id: 'spike_trap', name: '가시 덫', emoji: '🗡', have: 1, need: 1 },
      { id: 'poison_trap', name: '독 덫', emoji: '☠️', have: 0, need: 1 },
    ]);
  });

  it('shows stock, mastery multiplier, and the next enhance cost until the cap', () => {
    const row = buildTrapForgeRow(state({ materials: { iron_shard: 10 }, trapStock: { spike_trap: 2 }, trapMastery: { spike_trap: 2 } }), getTrapDef('spike_trap')!);
    expect(row.stock).toBe(2);
    expect(row.mastery).toBe(2);
    expect(row.masteryMult).toBeCloseTo(1.3);
    expect(row.afflictionLabel).toBe('출혈');
    expect(row.enhance).toEqual({ ok: true, reason: null, label: '강화 +3' });
    expect(row.enhanceMaterials).toEqual([{ id: 'iron_shard', name: '철 조각', emoji: expect.any(String), have: 10, need: 6 }]);

    const maxed = buildTrapForgeRow(state({ trapMastery: { spike_trap: TRAP_MASTERY_MAX } }), getTrapDef('spike_trap')!);
    expect(maxed.enhance.label).toBe('숙련 최대');
    expect(maxed.enhanceMaterials).toEqual([]);
  });

  it('summarizes stock, mastery, and how many traps can be crafted now', () => {
    const summary = summarizeTrapForge(state({ materials: { iron_shard: 2, old_cloth: 3 }, trapStock: { spike_trap: 1, thorn_wall: 2 }, trapMastery: { slow_trap: 1 } }));
    expect(summary).toEqual({ stockTotal: 3, masteryTotal: 1, craftableCount: 2 });
  });
});
