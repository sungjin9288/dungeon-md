import { describe, it, expect } from 'vitest';
import {
  ROOM_DEFS,
  MAX_ROOM_LEVEL,
  getUpgradeCost,
  getAttackDamage,
  getScrollAuraBonus,
  getMedicineHealRate,
  getArmoryDmgBonus,
  getArmoryRadius,
  getAltarKillsNeeded,
  getDragonsLairCooldown,
  getRoomStructuralHp,
  type RoomType,
} from './rooms';

// ─── ROOM_DEFS data integrity ─────────────────────────────────────────────────

describe('ROOM_DEFS', () => {
  const entries = Object.entries(ROOM_DEFS) as [RoomType, (typeof ROOM_DEFS)[RoomType]][];

  it('contains exactly 12 room types', () => {
    expect(entries).toHaveLength(12);
  });

  it('every key matches the type field', () => {
    for (const [key, def] of entries) {
      expect(def.type, key).toBe(key);
    }
  });

  it('every room has a non-empty koreanName, emoji, and description', () => {
    for (const def of Object.values(ROOM_DEFS)) {
      expect(def.koreanName.length,  `${def.type} koreanName`).toBeGreaterThan(0);
      expect(def.emoji.length,       `${def.type} emoji`).toBeGreaterThan(0);
      expect(def.description.length, `${def.type} description`).toBeGreaterThan(0);
    }
  });

  it('every cost is positive', () => {
    for (const def of Object.values(ROOM_DEFS)) {
      expect(def.cost, `${def.type} cost`).toBeGreaterThan(0);
    }
  });

  it('every upgradeMult is > 1', () => {
    for (const def of Object.values(ROOM_DEFS)) {
      expect(def.upgradeMult, `${def.type} upgradeMult`).toBeGreaterThan(1);
    }
  });

  it('every baseHp is positive', () => {
    for (const def of Object.values(ROOM_DEFS)) {
      expect(def.baseHp, `${def.type} baseHp`).toBeGreaterThan(0);
    }
  });

  it('Ch1 rooms (guardian, trap, gold, tower) have no chapter field', () => {
    const ch1 = ['guardian', 'trap', 'gold', 'tower'] as RoomType[];
    for (const type of ch1) {
      expect(ROOM_DEFS[type].chapter, `${type} chapter`).toBeUndefined();
    }
  });

  it('later rooms carry a chapter number >= 2', () => {
    const laterRooms = ['scroll_library', 'trap_corridor', 'armory', 'medicine_hall',
      'spirit_altar', 'dragons_lair', 'celestial_shrine', 'void_forge'] as RoomType[];
    for (const type of laterRooms) {
      expect(ROOM_DEFS[type].chapter, `${type} chapter`).toBeGreaterThanOrEqual(2);
    }
  });

  it('armory is marked isPassive', () => {
    expect(ROOM_DEFS['armory'].isPassive).toBe(true);
  });

  it('medicine_hall has a healRate', () => {
    expect(ROOM_DEFS['medicine_hall'].healRate).toBeGreaterThan(0);
  });

  it('gold room has positive goldPerSec, combat rooms have 0', () => {
    expect(ROOM_DEFS['gold'].goldPerSec).toBeGreaterThan(0);
    expect(ROOM_DEFS['guardian'].goldPerSec).toBe(0);
  });

  it('MAX_ROOM_LEVEL is 3', () => {
    expect(MAX_ROOM_LEVEL).toBe(3);
  });
});

// ─── getUpgradeCost ───────────────────────────────────────────────────────────

describe('getUpgradeCost', () => {
  it('uses explicit upgradeCosts when provided (scroll_library Lv1→2)', () => {
    // upgradeCosts: [170, 300]
    expect(getUpgradeCost('scroll_library', 1)).toBe(170);
  });

  it('uses explicit upgradeCosts Lv2→3', () => {
    expect(getUpgradeCost('scroll_library', 2)).toBe(300);
  });

  it('falls back to formula cost × upgradeMult^level (guardian Lv1→2)', () => {
    // cost=100, upgradeMult=1.6, level=1 → round(100 × 1.6^1) = 160
    expect(getUpgradeCost('guardian', 1)).toBe(160);
  });

  it('formula for Lv2→3 compounds correctly', () => {
    // cost=100, mult=1.6, level=2 → round(100 × 1.6^2) = round(256) = 256
    expect(getUpgradeCost('guardian', 2)).toBe(256);
  });

  it('upgrade cost increases with level', () => {
    expect(getUpgradeCost('guardian', 2)).toBeGreaterThan(getUpgradeCost('guardian', 1));
  });

  it('returns a rounded integer', () => {
    expect(Number.isInteger(getUpgradeCost('trap', 1))).toBe(true);
  });
});

// ─── getAttackDamage ──────────────────────────────────────────────────────────

describe('getAttackDamage', () => {
  it('returns base attackDamage at level 1', () => {
    expect(getAttackDamage('guardian', 1)).toBe(20);
  });

  it('applies 1.4× scaling at level 2', () => {
    // 20 × 1.4^1 = 28
    expect(getAttackDamage('guardian', 2)).toBe(28);
  });

  it('applies 1.4^2 scaling at level 3', () => {
    // 20 × 1.96 = 39.2 → rounded 39
    expect(getAttackDamage('guardian', 3)).toBe(39);
  });

  it('strictly increases per level', () => {
    const d1 = getAttackDamage('tower', 1);
    const d2 = getAttackDamage('tower', 2);
    const d3 = getAttackDamage('tower', 3);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it('returns 0 for passive/gold rooms at any level', () => {
    expect(getAttackDamage('gold', 1)).toBe(0);
    expect(getAttackDamage('gold', 3)).toBe(0);
    expect(getAttackDamage('armory', 1)).toBe(0);
  });

  it('returns a rounded integer', () => {
    expect(Number.isInteger(getAttackDamage('trap', 2))).toBe(true);
  });
});

// ─── getScrollAuraBonus ───────────────────────────────────────────────────────

describe('getScrollAuraBonus', () => {
  it('returns 0.15 at level 1', () => {
    expect(getScrollAuraBonus(1)).toBeCloseTo(0.15);
  });

  it('returns 0.25 at level 2', () => {
    expect(getScrollAuraBonus(2)).toBeCloseTo(0.25);
  });

  it('returns 0.40 at level 3', () => {
    expect(getScrollAuraBonus(3)).toBeCloseTo(0.40);
  });

  it('increases with level', () => {
    expect(getScrollAuraBonus(2)).toBeGreaterThan(getScrollAuraBonus(1));
    expect(getScrollAuraBonus(3)).toBeGreaterThan(getScrollAuraBonus(2));
  });
});

// ─── getMedicineHealRate ──────────────────────────────────────────────────────

describe('getMedicineHealRate', () => {
  it('returns 2 at level 1', () => {
    expect(getMedicineHealRate(1)).toBe(2);
  });

  it('returns 5 at level 2', () => {
    expect(getMedicineHealRate(2)).toBe(5);
  });

  it('returns 10 at level 3', () => {
    expect(getMedicineHealRate(3)).toBe(10);
  });
});

// ─── getArmoryDmgBonus ────────────────────────────────────────────────────────

describe('getArmoryDmgBonus', () => {
  it('returns 0.25 at level 1', () => {
    expect(getArmoryDmgBonus(1)).toBeCloseTo(0.25);
  });

  it('returns 0.35 at level 2', () => {
    expect(getArmoryDmgBonus(2)).toBeCloseTo(0.35);
  });

  it('returns 0.50 at level 3', () => {
    expect(getArmoryDmgBonus(3)).toBeCloseTo(0.50);
  });
});

// ─── getArmoryRadius ─────────────────────────────────────────────────────────

describe('getArmoryRadius', () => {
  it('returns 1 at level 1', () => {
    expect(getArmoryRadius(1)).toBe(1);
  });

  it('returns 2 at level 2', () => {
    expect(getArmoryRadius(2)).toBe(2);
  });

  it('returns 2 at level 3', () => {
    expect(getArmoryRadius(3)).toBe(2);
  });
});

// ─── getAltarKillsNeeded ──────────────────────────────────────────────────────

describe('getAltarKillsNeeded', () => {
  it('returns 10 at level 1', () => {
    expect(getAltarKillsNeeded(1)).toBe(10);
  });

  it('returns 8 at level 2', () => {
    expect(getAltarKillsNeeded(2)).toBe(8);
  });

  it('returns 6 at level 3', () => {
    expect(getAltarKillsNeeded(3)).toBe(6);
  });

  it('strictly decreases with level (easier at higher levels)', () => {
    expect(getAltarKillsNeeded(2)).toBeLessThan(getAltarKillsNeeded(1));
    expect(getAltarKillsNeeded(3)).toBeLessThan(getAltarKillsNeeded(2));
  });
});

// ─── getDragonsLairCooldown ───────────────────────────────────────────────────

describe('getDragonsLairCooldown', () => {
  it('returns 5000ms at level 1', () => {
    expect(getDragonsLairCooldown(1)).toBe(5000);
  });

  it('returns 4000ms at level 2', () => {
    expect(getDragonsLairCooldown(2)).toBe(4000);
  });

  it('returns 3000ms at level 3', () => {
    expect(getDragonsLairCooldown(3)).toBe(3000);
  });

  it('cooldown decreases with level (faster attacks)', () => {
    expect(getDragonsLairCooldown(2)).toBeLessThan(getDragonsLairCooldown(1));
    expect(getDragonsLairCooldown(3)).toBeLessThan(getDragonsLairCooldown(2));
  });
});

// ─── getRoomStructuralHp ──────────────────────────────────────────────────────

describe('getRoomStructuralHp', () => {
  it('returns the baseHp from ROOM_DEFS', () => {
    expect(getRoomStructuralHp('guardian')).toBe(ROOM_DEFS['guardian'].baseHp);
  });

  it('returns 100 for unknown room type', () => {
    expect(getRoomStructuralHp('nonexistent_room' as RoomType)).toBe(100);
  });

  it('void_forge has higher HP than guardian (late-game room)', () => {
    expect(getRoomStructuralHp('void_forge')).toBeGreaterThan(
      getRoomStructuralHp('guardian'),
    );
  });
});

// ─── ROOM_DEFS — per-room type spot-checks ───────────────────────────────────

describe('ROOM_DEFS — per-room type spot-checks', () => {
  const r = (t: RoomType) => ROOM_DEFS[t];

  // ── Ch1 rooms ─────────────────────────────────────────────────────────────
  it('guardian: cost=100, baseHp=200, no chapter', () => {
    expect(r('guardian').cost).toBe(100);
    expect(r('guardian').baseHp).toBe(200);
    expect((r('guardian') as { chapter?: number }).chapter).toBeUndefined();
  });

  it('trap: cost=80, baseHp=100, no chapter', () => {
    expect(r('trap').cost).toBe(80);
    expect(r('trap').baseHp).toBe(100);
    expect((r('trap') as { chapter?: number }).chapter).toBeUndefined();
  });

  it('gold: goldPerSec=10, cost=120, no chapter', () => {
    expect(r('gold').goldPerSec).toBe(10);
    expect(r('gold').cost).toBe(120);
    expect((r('gold') as { chapter?: number }).chapter).toBeUndefined();
  });

  it('tower: cost=130, baseHp=150, no chapter', () => {
    expect(r('tower').cost).toBe(130);
    expect(r('tower').baseHp).toBe(150);
  });

  // ── Ch2 rooms ─────────────────────────────────────────────────────────────
  it('scroll_library: chapter=2, cost=120, baseHp=160', () => {
    expect((r('scroll_library') as { chapter?: number }).chapter).toBe(2);
    expect(r('scroll_library').cost).toBe(120);
    expect(r('scroll_library').baseHp).toBe(160);
  });

  it('trap_corridor: chapter=2, cost=110, baseHp=130', () => {
    expect((r('trap_corridor') as { chapter?: number }).chapter).toBe(2);
    expect(r('trap_corridor').cost).toBe(110);
  });

  // ── Ch3 rooms ─────────────────────────────────────────────────────────────
  it('armory: chapter=3, isPassive=true, cost=90', () => {
    expect((r('armory') as { chapter?: number }).chapter).toBe(3);
    expect((r('armory') as { isPassive?: boolean }).isPassive).toBe(true);
    expect(r('armory').cost).toBe(90);
  });

  it('medicine_hall: chapter=3, healRate=2, cost=100', () => {
    expect((r('medicine_hall') as { chapter?: number }).chapter).toBe(3);
    expect((r('medicine_hall') as { healRate?: number }).healRate).toBe(2);
    expect(r('medicine_hall').cost).toBe(100);
  });

  // ── Ch4 rooms ─────────────────────────────────────────────────────────────
  it('spirit_altar: chapter=4, cost=150, baseHp=160', () => {
    expect((r('spirit_altar') as { chapter?: number }).chapter).toBe(4);
    expect(r('spirit_altar').cost).toBe(150);
    expect(r('spirit_altar').baseHp).toBe(160);
  });

  it('dragons_lair: chapter=4, cost=200 (most expensive), baseHp=300 (highest)', () => {
    expect((r('dragons_lair') as { chapter?: number }).chapter).toBe(4);
    expect(r('dragons_lair').cost).toBe(200);
    expect(r('dragons_lair').baseHp).toBe(300);
  });

  // ── Ch5/Ch6 rooms ─────────────────────────────────────────────────────────
  it('celestial_shrine: chapter=5, cost=160', () => {
    expect((r('celestial_shrine') as { chapter?: number }).chapter).toBe(5);
    expect(r('celestial_shrine').cost).toBe(160);
  });

  it('void_forge: chapter=6, cost=190, baseHp=220', () => {
    expect((r('void_forge') as { chapter?: number }).chapter).toBe(6);
    expect(r('void_forge').cost).toBe(190);
    expect(r('void_forge').baseHp).toBe(220);
  });
});

// ─── ROOM_DEFS — cost and HP ordering ────────────────────────────────────────

describe('ROOM_DEFS — cost and HP ordering', () => {
  const allRooms = Object.values(ROOM_DEFS);

  it('trap (cost 80) is the cheapest room', () => {
    const minCost = Math.min(...allRooms.map(r => r.cost));
    expect(ROOM_DEFS['trap'].cost).toBe(minCost);
  });

  it('dragons_lair (cost 200) is the most expensive room', () => {
    const maxCost = Math.max(...allRooms.map(r => r.cost));
    expect(ROOM_DEFS['dragons_lair'].cost).toBe(maxCost);
  });

  it('trap (baseHp 100) has the lowest structural HP', () => {
    const minHp = Math.min(...allRooms.map(r => r.baseHp));
    expect(ROOM_DEFS['trap'].baseHp).toBe(minHp);
  });

  it('dragons_lair (baseHp 300) has the highest structural HP', () => {
    const maxHp = Math.max(...allRooms.map(r => r.baseHp));
    expect(ROOM_DEFS['dragons_lair'].baseHp).toBe(maxHp);
  });

  it('later-chapter rooms cost more on average than Ch1 rooms', () => {
    const ch1Avg = (['guardian', 'trap', 'gold', 'tower'] as RoomType[])
      .reduce((s, t) => s + ROOM_DEFS[t].cost, 0) / 4;
    const laterAvg = (['spirit_altar', 'dragons_lair', 'celestial_shrine', 'void_forge'] as RoomType[])
      .reduce((s, t) => s + ROOM_DEFS[t].cost, 0) / 4;
    expect(laterAvg).toBeGreaterThan(ch1Avg);
  });
});
