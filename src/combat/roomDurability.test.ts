import { describe, it, expect, beforeEach } from 'vitest';
import { applyRoomSlotDamage, saveRoomHpsToGameState } from './RoomDurability';
import { loadGameState, saveGameState } from '../data/wisdom';
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

  it('two sequential calls accumulate damage (second call uses updated hp)', () => {
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.1); // 100 - ceil(10) = 90
    applyRoomSlotDamage([slot], 0.1); // 90  - ceil(10) = 80
    expect(slot.hp).toBe(80);
  });

  it('maxHp=1, fraction=0.5 → ceil(0.5)=1 damage → hp=0', () => {
    const slot = makeSlot(1);
    applyRoomSlotDamage([slot], 0.5);
    expect(slot.hp).toBe(0);
  });

  it('tiny fraction 0.001 still deals 1 damage via ceil (maxHp=100)', () => {
    // ceil(100 * 0.001) = ceil(0.1) = 1 → hp = 99
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.001);
    expect(slot.hp).toBe(99);
  });
});

// ─── saveRoomHpsToGameState ───────────────────────────────────────────────────

describe('saveRoomHpsToGameState', () => {
  beforeEach(() => localStorage.clear());

  function makeSlotFull(hp: number, maxHp = hp, extras: Partial<DungeonSlot> = {}): DungeonSlot {
    return { monsterIds: [], trapIds: [], roomLevel: 1, hp, maxHp, ...extras };
  }

  it('no-ops when slots array is empty (localStorage untouched)', () => {
    saveRoomHpsToGameState([]);
    expect(localStorage.getItem('dungeonGameState')).toBeNull();
  });

  it('writes hp and maxHp to the first dungeonSlot in game state', () => {
    const slot = makeSlotFull(80, 100);
    saveRoomHpsToGameState([slot]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(80);
    expect(saved.dungeonSlots[0].maxHp).toBe(100);
  });

  it('merges with existing game state slot — preserves monsterIds and roomLevel', () => {
    // Pre-populate game state
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100, { monsterIds: ['fire_dokkaebi'], roomLevel: 3 })],
    });
    saveRoomHpsToGameState([makeSlotFull(55, 100)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(55);
    expect(saved.dungeonSlots[0].maxHp).toBe(100);
    expect(saved.dungeonSlots[0].monsterIds).toContain('fire_dokkaebi'); // preserved
    expect(saved.dungeonSlots[0].roomLevel).toBe(3);                     // preserved
  });

  it('extends dungeonSlots when new slots array is longer than existing', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100)],
    });
    saveRoomHpsToGameState([makeSlotFull(80, 100), makeSlotFull(50, 200)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots).toHaveLength(2);
    expect(saved.dungeonSlots[0].hp).toBe(80);
    expect(saved.dungeonSlots[1].hp).toBe(50);
    expect(saved.dungeonSlots[1].maxHp).toBe(200);
  });

  it('preserves extra existing slots when new slots array is shorter', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100), makeSlotFull(90, 150)],
    });
    saveRoomHpsToGameState([makeSlotFull(70, 100)]); // only update slot 0
    const saved = loadGameState();
    expect(saved.dungeonSlots).toHaveLength(2);
    expect(saved.dungeonSlots[0].hp).toBe(70);
    expect(saved.dungeonSlots[1].hp).toBe(90); // untouched
    expect(saved.dungeonSlots[1].maxHp).toBe(150);
  });

  it('updates all slots in a multi-slot call', () => {
    const slots = [makeSlotFull(90, 100), makeSlotFull(40, 200)];
    saveRoomHpsToGameState(slots);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(90);
    expect(saved.dungeonSlots[1].hp).toBe(40);
    expect(saved.dungeonSlots[1].maxHp).toBe(200);
  });

  it('null entry in new slots preserves the existing slot at that index', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100), makeSlotFull(80, 200)],
    });
    // Pass null at index 0 — existing slot 0 should be kept intact
    saveRoomHpsToGameState([null as unknown as DungeonSlot, makeSlotFull(50, 200)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(100);  // unchanged
    expect(saved.dungeonSlots[1].hp).toBe(50);   // updated
  });

  it('preserves trapIds on merge (not just monsterIds and roomLevel)', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100, { trapIds: ['spike_trap', 'slow_trap'] })],
    });
    saveRoomHpsToGameState([makeSlotFull(60, 100)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].trapIds).toContain('spike_trap');
    expect(saved.dungeonSlots[0].trapIds).toContain('slow_trap');
  });

  it('second call is cumulative — reads the previously saved hp', () => {
    saveRoomHpsToGameState([makeSlotFull(80, 100)]);
    // Simulate a second damage event: save with hp=50
    saveRoomHpsToGameState([makeSlotFull(50, 100)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(50); // reflects second call, not first
  });

  it('brand-new slot with no existing entry is stored as-is', () => {
    // No pre-existing dungeonSlots → new slot stored without spread merge
    saveRoomHpsToGameState([makeSlotFull(70, 120)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(70);
    expect(saved.dungeonSlots[0].maxHp).toBe(120);
  });

  it('hp=0 is persisted correctly (not treated as falsy/skipped)', () => {
    saveRoomHpsToGameState([makeSlotFull(0, 100)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(0);
    expect(saved.dungeonSlots[0].maxHp).toBe(100);
  });

  it('three fresh slots are all stored when there is no prior state', () => {
    saveRoomHpsToGameState([
      makeSlotFull(80, 100),
      makeSlotFull(150, 200),
      makeSlotFull(10, 50),
    ]);
    const saved = loadGameState();
    expect(saved.dungeonSlots).toHaveLength(3);
    expect(saved.dungeonSlots[2].hp).toBe(10);
    expect(saved.dungeonSlots[2].maxHp).toBe(50);
  });

  it('middle slot=null with three existing slots preserves the middle slot', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [
        makeSlotFull(100, 100, { monsterIds: ['fire_dokkaebi'] }),
        makeSlotFull(90, 150, { trapIds: ['slow_trap'] }),
        makeSlotFull(80, 200),
      ],
    });
    saveRoomHpsToGameState([makeSlotFull(60, 100), null as unknown as DungeonSlot, makeSlotFull(40, 200)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[1].hp).toBe(90);         // untouched (null → prevSlots[1])
    expect(saved.dungeonSlots[1].trapIds).toContain('slow_trap'); // metadata intact
    expect(saved.dungeonSlots[0].hp).toBe(60);         // updated
    expect(saved.dungeonSlots[2].hp).toBe(40);         // updated
  });
});

// ─── applyRoomSlotDamage — additional edge cases ──────────────────────────────

describe('applyRoomSlotDamage — additional edge cases', () => {
  it('maxHp=0 slot: ceil(0 × fraction)=0 damage, hp stays at 0', () => {
    const slot = makeSlot(0, 0);
    applyRoomSlotDamage([slot], 0.5);
    expect(slot.hp).toBe(0);
  });

  it('fraction=0.333 on maxHp=100: ceil(33.3)=34 damage → hp=66', () => {
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.333);
    expect(slot.hp).toBe(66); // 100 - ceil(100 * 0.333) = 100 - 34 = 66
  });

  it('5-slot array: all slots are processed independently', () => {
    const slots = [100, 80, 60, 40, 20].map(hp => makeSlot(hp));
    applyRoomSlotDamage(slots, 0.5);
    expect(slots[0].hp).toBe(50); // 100 - ceil(50) = 50
    expect(slots[2].hp).toBe(30); // 60  - ceil(30) = 30
    expect(slots[4].hp).toBe(10); // 20  - ceil(10) = 10
  });

  it('undefined entry in slots array is skipped gracefully', () => {
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot, undefined as unknown as DungeonSlot], 0.25);
    expect(slot.hp).toBe(75); // 100 - ceil(25) = 75; undefined entry skipped
  });
});

// ─── saveRoomHpsToGameState — preserves non-slot game state ──────────────────

describe('saveRoomHpsToGameState — preserves unrelated game state fields', () => {
  beforeEach(() => localStorage.clear());

  function makeSlotFull(hp: number, maxHp = hp): DungeonSlot {
    return { monsterIds: [], trapIds: [], roomLevel: 1, hp, maxHp };
  }

  it('homeGold and dmXP in GameState are unchanged after saving room HPs', () => {
    const base = loadGameState();
    saveGameState({ ...base, homeGold: 9999, dmXP: 12345 });
    saveRoomHpsToGameState([makeSlotFull(50, 100)]);
    const saved = loadGameState();
    expect(saved.homeGold).toBe(9999);
    expect(saved.dmXP).toBe(12345);
  });

  it('saving identical hp as existing does not corrupt the slot', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(80, 100)],
    });
    saveRoomHpsToGameState([makeSlotFull(80, 100)]); // same values
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(80);
    expect(saved.dungeonSlots[0].maxHp).toBe(100);
  });

  it('writing a slot at index 1 does not change slot at index 0', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100), makeSlotFull(90, 150)],
    });
    // Pass null for index 0 → index 0 unchanged; only index 1 updated
    saveRoomHpsToGameState([null as unknown as DungeonSlot, makeSlotFull(40, 150)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(100); // untouched
    expect(saved.dungeonSlots[1].hp).toBe(40);  // updated
  });
});

// ─── applyRoomSlotDamage — minimal-maxHp pins ─────────────────────────────────

describe('applyRoomSlotDamage — minimal-maxHp & integer-fraction pins', () => {
  it('maxHp=1, fraction=0.001 → ceil(0.001)=1 → hp=0 (minimum possible damage)', () => {
    const slot = makeSlot(1);
    applyRoomSlotDamage([slot], 0.001);
    expect(slot.hp).toBe(0); // ceil(1 * 0.001) = 1 → hp clamps to 0
  });

  it('fraction=0.5 on even maxHp=100 → exact integer (no rounding) → hp=50', () => {
    const slot = makeSlot(100);
    applyRoomSlotDamage([slot], 0.5);
    expect(slot.hp).toBe(50); // ceil(50.0) = 50 (already integer)
  });

  it('maxHp=999, fraction=0.001 → ceil(0.999)=1 → hp=998', () => {
    const slot = makeSlot(999);
    applyRoomSlotDamage([slot], 0.001);
    expect(slot.hp).toBe(998); // ceil(999 * 0.001) = ceil(0.999) = 1
  });
});

// ─── saveRoomHpsToGameState — roomLevel and equal-length cases ────────────────

describe('saveRoomHpsToGameState — roomLevel preservation & equal-length update', () => {
  beforeEach(() => localStorage.clear());

  function makeSlotFull(hp: number, maxHp = hp, extras: Partial<DungeonSlot> = {}): DungeonSlot {
    return { monsterIds: [], trapIds: [], roomLevel: 1, hp, maxHp, ...extras };
  }

  it('roomLevel from existing slot is preserved on merge (not overwritten by new slot)', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100, { roomLevel: 7 })],
    });
    saveRoomHpsToGameState([makeSlotFull(60, 100, { roomLevel: 1 })]); // new slot has roomLevel=1
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].roomLevel).toBe(7); // existing roomLevel preserved
    expect(saved.dungeonSlots[0].hp).toBe(60);       // hp updated
  });

  it('equal-length update (prevSlots=2, slots=2): both updated, length stays 2', () => {
    saveGameState({
      ...loadGameState(),
      dungeonSlots: [makeSlotFull(100, 100), makeSlotFull(200, 200)],
    });
    saveRoomHpsToGameState([makeSlotFull(70, 100), makeSlotFull(150, 200)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots).toHaveLength(2);
    expect(saved.dungeonSlots[0].hp).toBe(70);
    expect(saved.dungeonSlots[1].hp).toBe(150);
  });

  it('fully-healed slot (hp=maxHp) stored and loaded correctly', () => {
    saveRoomHpsToGameState([makeSlotFull(200, 200)]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].hp).toBe(200);
    expect(saved.dungeonSlots[0].maxHp).toBe(200);
  });

  it('new-slot path (no existing): roomLevel from new slot is preserved', () => {
    // No prior dungeonSlots → existing=undefined → store new slot as-is
    saveRoomHpsToGameState([makeSlotFull(50, 100, { roomLevel: 4 })]);
    const saved = loadGameState();
    expect(saved.dungeonSlots[0].roomLevel).toBe(4);
    expect(saved.dungeonSlots[0].hp).toBe(50);
  });
});
