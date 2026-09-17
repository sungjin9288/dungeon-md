import { describe, expect, it } from 'vitest';
import { installTrapInRoomSlot, removeTrapFromRoomSlot } from './roomSlotTransactions';
import { canCraftTrap, craftTrap, enhanceTrap, getTrapMastery, getTrapStock } from './trapTransactions';
import { TRAP_MASTERY_MAX } from './traps';
import { loadGameState, type DungeonSlot, type GameState } from './wisdom';

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), dmLevel: 20, ...overrides };
}
function slot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return { roomType: 'trap', building: 'trap', monsterIds: [undefined], trapIds: [undefined, undefined], roomLevel: 1, hp: 200, maxHp: 200, ...overrides };
}

describe('craftTrap', () => {
  it('crafts a tier-1 trap into stock from materials only', () => {
    const s = state({ materials: { iron_shard: 5 } });
    const r = craftTrap(s, 'spike_trap');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(getTrapStock(r.state, 'spike_trap')).toBe(1);
    expect(r.state.materials.iron_shard).toBe(3);
    expect(s.trapStock).toEqual({});
  });

  it('fuses a tier-2 trap from two stocked tier-1 traps plus materials', () => {
    const s = state({ materials: { iron_shard: 3, herb: 3 }, trapStock: { spike_trap: 1, poison_trap: 1 } });
    const r = craftTrap(s, 'thorn_wall');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.trapStock).toEqual({ spike_trap: 0, poison_trap: 0, thorn_wall: 1 });
    expect(r.consumedTraps).toEqual({ spike_trap: 1, poison_trap: 1 });
  });

  it('refuses when locked, short on materials, or short on input traps', () => {
    expect(canCraftTrap(state({ dmLevel: 1, materials: { magic_dust: 9, iron_shard: 9 } }), 'stun_trap')).toEqual({ ok: false, reason: 'locked' });
    expect(canCraftTrap(state({ materials: {} }), 'spike_trap')).toEqual({ ok: false, reason: 'insufficient_materials' });
    expect(canCraftTrap(state({ materials: { iron_shard: 3, herb: 3 }, trapStock: { spike_trap: 1 } }), 'thorn_wall')).toEqual({ ok: false, reason: 'insufficient_input_traps' });
    expect(craftTrap(state(), 'nope').ok).toBe(false);
  });
});

describe('enhanceTrap', () => {
  it('raises mastery for scaled recipe materials and stops at the cap', () => {
    let s = state({ materials: { iron_shard: 100 } });
    for (let level = 0; level < TRAP_MASTERY_MAX; level++) {
      const r = enhanceTrap(s, 'spike_trap');
      expect(r.ok, `level ${level}`).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(getTrapMastery(s, 'spike_trap')).toBe(TRAP_MASTERY_MAX);
    // 2 + 4 + 6 + 8 + 10 = 30 iron shards
    expect(s.materials.iron_shard).toBe(70);
    const capped = enhanceTrap(s, 'spike_trap');
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.reason).toBe('mastery_at_max');
  });
});

describe('installing crafted traps', () => {
  it('tier-2 traps install from stock (no gold) and return to stock when removed', () => {
    const s = state({ homeGold: 0, trapStock: { thorn_wall: 1 }, dungeonSlots: [slot()] });
    const installed = installTrapInRoomSlot(s, 0, 0, 'thorn_wall');
    expect(installed.ok).toBe(true);
    if (!installed.ok) return;
    expect(installed.state.trapStock.thorn_wall).toBe(0);
    expect(installed.state.homeGold).toBe(0);
    expect(installed.cost).toBe(0);
    const removed = removeTrapFromRoomSlot(installed.state, 0, 0);
    expect(removed.ok && removed.state.trapStock.thorn_wall).toBe(1);
    expect(removed.ok && removed.refund).toBe(0);
  });

  it('refuses a tier-2 install without stock, and tier-1 still buys with gold', () => {
    const none = installTrapInRoomSlot(state({ homeGold: 999, dungeonSlots: [slot()] }), 0, 0, 'thorn_wall');
    expect(none.ok).toBe(false);
    const bought = installTrapInRoomSlot(state({ homeGold: 100, dungeonSlots: [slot()] }), 0, 0, 'spike_trap');
    expect(bought.ok && bought.state.homeGold).toBe(50);
  });

  it('replacing a stocked trap with a bought one sends the old trap back to stock', () => {
    const s = state({ homeGold: 100, trapStock: {}, dungeonSlots: [slot({ trapIds: ['thorn_wall', undefined] })] });
    const r = installTrapInRoomSlot(s, 0, 0, 'spike_trap');
    expect(r.ok && r.state.trapStock.thorn_wall).toBe(1);
    expect(r.ok && r.refund).toBe(0);
  });
});
