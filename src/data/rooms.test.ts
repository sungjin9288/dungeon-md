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
