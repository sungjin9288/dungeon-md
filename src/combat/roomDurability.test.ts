import { describe, it, expect } from 'vitest';
import { applyRoomSlotDamage } from './RoomDurability';
import type { DungeonSlot } from '../data/wisdom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSlot(hp: number, maxHp?: number): DungeonSlot {
  return {
    monsterIds: [],
    trapIds:    [],
    roomLevel:  1,
    hp,
    maxHp: maxHp ?? hp,
  };
}

// ─── applyRoomSlotDamage ──────────────────────────────────────────────────────

describe('applyRoomSlotDamage', () => {
  it('does nothing when fraction is 0', () => {
    const slot = makeSlot(200);
    applyRoomSlotDamage([slot], 0);
    expect(slot.hp).toBe(200);
  });

  it('reduces hp to 0 when fraction is 1.0', () => {
    const slot = makeSlot(200);
    applyRoomSlotDamage([slot], 1.0);
    expect(slot.hp).toBe(0);
  });

  it('applies ceil(maxHp × fraction) damage', () => {
    // maxHp=100, fraction=0.1 → ceil(10) = 10 damage → hp = 90
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.1);
    expect(slot.hp).toBe(90);
  });

  it('rounds damage up via Math.ceil (fractional damage is ceiled)', () => {
    // maxHp=100, fraction=0.05 → ceil(5.0) = 5 damage → hp = 95
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.05);
    expect(slot.hp).toBe(95);
  });

  it('ceils non-integer damage — maxHp=10, fraction=0.15 → ceil(1.5)=2 dmg → hp=8', () => {
    const slot = makeSlot(10);
    applyRoomSlotDamage([slot], 0.15);
    expect(slot.hp).toBe(8);
  });

  it('clamps hp to 0 — does not go negative', () => {
    const slot = makeSlot(50);
    applyRoomSlotDamage([slot], 2.0); // 2× maxHp damage
    expect(slot.hp).toBe(0);
  });

  it('clamps even when current hp is lower than computed damage', () => {
    const slot = makeSlot(30, 100); // hp=30 but maxHp=100
    applyRoomSlotDamage([slot], 0.5); // damage = ceil(50) = 50 > hp
    expect(slot.hp).toBe(0);
  });

  it('applies damage independently to each slot', () => {
    const s1 = makeSlot(200);
    const s2 = makeSlot(100);
    applyRoomSlotDamage([s1, s2], 0.5);
    expect(s1.hp).toBe(100); // 200 - ceil(100) = 100
    expect(s2.hp).toBe(50);  // 100 - ceil(50)  = 50
  });

  it('skips null entries in the array', () => {
    const slot = makeSlot(200);
    // TypeScript requires DungeonSlot[], but runtime may have nullish entries
    applyRoomSlotDamage([slot, null as unknown as DungeonSlot], 0.5);
    expect(slot.hp).toBe(100); // null skipped without crash
  });

  it('handles empty array gracefully', () => {
    expect(() => applyRoomSlotDamage([], 0.5)).not.toThrow();
  });

  it('damage is based on maxHp, not current hp', () => {
    const slot = makeSlot(50, 200); // hp=50 (already damaged), maxHp=200
    applyRoomSlotDamage([slot], 0.1); // damage = ceil(20) regardless of current hp
    expect(slot.hp).toBe(30); // 50 - 20 = 30
  });

  it('all slots at 0 hp remain at 0 after further damage', () => {
    const slots = [makeSlot(0, 100), makeSlot(0, 200)];
    applyRoomSlotDamage(slots, 0.5);
    expect(slots[0].hp).toBe(0);
    expect(slots[1].hp).toBe(0);
  });

  it('fraction > 1 still clamps to 0 (not negative)', () => {
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 5.0); // 5× damage
    expect(slot.hp).toBe(0);
  });
});
