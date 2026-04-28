/**
 * Unit tests for wisdom.ts — permanent game state, branch bonuses,
 * save/load migrations, and slot unlocking.
 *
 * Pure logic only (no Phaser). Uses happy-dom for localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BRANCH_DEFS,
  ROOM_SLOT_TYPE_DEFS,
  SLOT_UNLOCK_LEVELS,
  getRoomSlotCapacity,
  getMaxRoomLevel,
  getUnlockedSlots,
  getWisdomBonuses,
  getPrestigeDmgMult,
  loadGameState,
  saveGameState,
  exportGameState,
  importGameState,
  startPrestige,
  type GameState,
} from './wisdom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GAME_STATE_KEY = 'dungeonGameState';

beforeEach(() => {
  localStorage.clear();
});

// ─── Branch definitions ──────────────────────────────────────────────────────

describe('BRANCH_DEFS', () => {
  it('defines exactly 12 branches', () => {
    expect(BRANCH_DEFS).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = BRANCH_DEFS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every branch has 5 tier costs', () => {
    for (const b of BRANCH_DEFS) {
      expect(b.costPerTier).toHaveLength(5);
      // Costs should be monotonically non-decreasing
      for (let i = 1; i < b.costPerTier.length; i++) {
        expect(b.costPerTier[i]).toBeGreaterThanOrEqual(b.costPerTier[i - 1]);
      }
    }
  });

  it('getValue returns 0 for tier 0 and increases with tier', () => {
    for (const b of BRANCH_DEFS) {
      expect(b.getValue(0)).toBe(0);
      expect(b.getValue(5)).toBeGreaterThan(b.getValue(1));
    }
  });
});

// ─── Room slot type defs ─────────────────────────────────────────────────────

describe('ROOM_SLOT_TYPE_DEFS', () => {
  it('defines all 4 slot types', () => {
    expect(ROOM_SLOT_TYPE_DEFS).toHaveLength(4);
    const ids = ROOM_SLOT_TYPE_DEFS.map(d => d.id);
    expect(ids).toEqual(['combat', 'trap', 'support', 'magic']);
  });
});

// ─── Room slot capacity ─────────────────────────────────────────────────────

describe('getRoomSlotCapacity', () => {
  it('Lv.1 default: 1 monster, 1 trap', () => {
    expect(getRoomSlotCapacity(1)).toEqual({ monsters: 1, traps: 1 });
  });

  it('Lv.5 default: 5 monsters, 3 traps', () => {
    expect(getRoomSlotCapacity(5)).toEqual({ monsters: 5, traps: 3 });
  });

  it('combat room grants +1 monster slot', () => {
    const cap = getRoomSlotCapacity(3, 'combat');
    expect(cap.monsters).toBe(4); // 3 + 1
    expect(cap.traps).toBe(2);
  });

  it('trap room grants +1 trap slot', () => {
    const cap = getRoomSlotCapacity(3, 'trap');
    expect(cap.monsters).toBe(3);
    expect(cap.traps).toBe(3); // 2 + 1
  });

  it('support/magic rooms do not change slot counts', () => {
    expect(getRoomSlotCapacity(3, 'support')).toEqual({ monsters: 3, traps: 2 });
    expect(getRoomSlotCapacity(3, 'magic')).toEqual({ monsters: 3, traps: 2 });
  });

  it('clamps level below 1 to Lv.1', () => {
    expect(getRoomSlotCapacity(0)).toEqual({ monsters: 1, traps: 1 });
    expect(getRoomSlotCapacity(-5)).toEqual({ monsters: 1, traps: 1 });
  });

  it('clamps level above 5 to Lv.5 capacity', () => {
    expect(getRoomSlotCapacity(10)).toEqual({ monsters: 5, traps: 3 });
  });
});

// ─── Max room level ──────────────────────────────────────────────────────────

describe('getMaxRoomLevel', () => {
  it.each([
    [1, 1],   [4, 1],
    [5, 2],   [9, 2],
    [10, 3],  [14, 3],
    [15, 4],  [19, 4],
    [20, 5],  [99, 5],
  ])('dmLevel=%i → maxRoomLevel=%i', (dm, expected) => {
    expect(getMaxRoomLevel(dm)).toBe(expected);
  });
});

// ─── Unlocked slots ──────────────────────────────────────────────────────────

describe('getUnlockedSlots', () => {
  it('returns 1 slot at DM Lv.0–1', () => {
    expect(getUnlockedSlots(0)).toBe(1);
    expect(getUnlockedSlots(1)).toBe(1);
  });

  it('unlocks progressively with DM level', () => {
    expect(getUnlockedSlots(2)).toBe(2);
    expect(getUnlockedSlots(4)).toBe(3);
    expect(getUnlockedSlots(6)).toBe(4);
    expect(getUnlockedSlots(8)).toBe(5);
    expect(getUnlockedSlots(10)).toBe(6);
    expect(getUnlockedSlots(12)).toBe(7);
    expect(getUnlockedSlots(15)).toBe(8);
    expect(getUnlockedSlots(18)).toBe(9);
  });

  it('caps at 9 slots (3×3 grid)', () => {
    expect(getUnlockedSlots(30)).toBe(9);
    expect(getUnlockedSlots(100)).toBe(9);
  });

  it('SLOT_UNLOCK_LEVELS table matches the function output', () => {
    for (const [level, expectedSlots] of SLOT_UNLOCK_LEVELS) {
      expect(getUnlockedSlots(level)).toBeGreaterThanOrEqual(expectedSlots);
    }
  });
});

// ─── Save / Load roundtrip ───────────────────────────────────────────────────

describe('loadGameState / saveGameState', () => {
  it('returns default state when nothing saved', () => {
    const state = loadGameState();
    expect(state.dmLevel).toBe(1);
    expect(state.dmXP).toBe(0);
    expect(state.homeGold).toBe(200);
    expect(state.equippedTheme).toBe('cave');
    expect(state.ownedThemes).toEqual(['cave']);
    expect(state.stageProgress).toHaveLength(80);
    expect(state.stageProgress[0].unlocked).toBe(true);
    expect(state.stageProgress[1].unlocked).toBe(false);
  });

  it('saves and loads state roundtrip', () => {
    const state = loadGameState();
    state.homeGold = 5000;
    state.dmLevel  = 10;
    state.gems     = 42;
    saveGameState(state);

    const loaded = loadGameState();
    expect(loaded.homeGold).toBe(5000);
    expect(loaded.dmLevel).toBe(10);
    expect(loaded.gems).toBe(42);
  });

  it('falls back to defaults when stored JSON is malformed', () => {
    localStorage.setItem(GAME_STATE_KEY, 'not json');
    const state = loadGameState();
    expect(state.dmLevel).toBe(1);
    expect(state.homeGold).toBe(200);
  });

  it('merges missing fields with defaults (forward migration)', () => {
    // Simulate an older save missing some fields
    const partial = { dmLevel: 5, homeGold: 999 };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(partial));
    const state = loadGameState();
    expect(state.dmLevel).toBe(5);
    expect(state.homeGold).toBe(999);
    // Defaults should fill in missing fields
    expect(state.equippedTheme).toBe('cave');
    expect(state.wisdomTree).toBeDefined();
    expect(state.stageProgress).toHaveLength(80);
  });
});

// ─── StageProgress migration ─────────────────────────────────────────────────

describe('stageProgress migration', () => {
  it('pads short stageProgress arrays up to 62+ stages', () => {
    const shortSave = {
      dmLevel: 1,
      homeGold: 200,
      stageProgress: [
        { unlocked: true, bestStars: 3 },
        { unlocked: true, bestStars: 2 },
      ],
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(shortSave));
    const state = loadGameState();
    expect(state.stageProgress.length).toBeGreaterThanOrEqual(62);
    // First two entries preserved
    expect(state.stageProgress[0]).toEqual({ unlocked: true, bestStars: 3 });
    expect(state.stageProgress[1]).toEqual({ unlocked: true, bestStars: 2 });
    // Padded entries default to locked
    expect(state.stageProgress[61].unlocked).toBe(false);
    expect(state.stageProgress[61].bestStars).toBe(0);
  });
});

// ─── DungeonSlot migration ───────────────────────────────────────────────────

describe('dungeonSlots migration', () => {
  it('migrates old flat format (monsterId/trapId) to new array format', () => {
    const oldSave = {
      dmLevel: 1,
      homeGold: 200,
      ownedMonsters: [],  // valid for importGameState guard
      dungeonSlots: [
        {
          roomType: 'combat',
          roomLevel: 2,
          monsterId: 'dokkaebi_warrior',
          trapId: 'spike_trap',
          hp: 200,
          maxHp: 200,
        },
      ],
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(oldSave));
    const state = loadGameState();
    expect(state.dungeonSlots).toHaveLength(1);
    const slot = state.dungeonSlots[0];
    expect(Array.isArray(slot.monsterIds)).toBe(true);
    expect(Array.isArray(slot.trapIds)).toBe(true);
    expect(slot.monsterIds[0]).toBe('dokkaebi_warrior');
    expect(slot.trapIds[0]).toBe('spike_trap');
    expect(slot.roomLevel).toBe(2);
  });

  it('leaves new array format unchanged', () => {
    const newSave = {
      dmLevel: 1,
      homeGold: 200,
      dungeonSlots: [
        {
          roomType: 'trap',
          roomLevel: 3,
          monsterIds: ['a', 'b'],
          trapIds: ['t1', 't2'],
          hp: 300,
          maxHp: 300,
        },
      ],
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(newSave));
    const state = loadGameState();
    expect(state.dungeonSlots[0].monsterIds).toEqual(['a', 'b']);
    expect(state.dungeonSlots[0].trapIds).toEqual(['t1', 't2']);
  });
});

// ─── Export / Import save ────────────────────────────────────────────────────

describe('exportGameState / importGameState', () => {
  it('exports a base64-encoded string that round-trips via import', () => {
    const state = loadGameState();
    state.homeGold = 12345;
    state.dmLevel  = 7;
    saveGameState(state);

    const encoded = exportGameState();
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    // Clear storage and reimport
    localStorage.clear();
    const result = importGameState(encoded);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const loaded = loadGameState();
    expect(loaded.homeGold).toBe(12345);
    expect(loaded.dmLevel).toBe(7);
  });

  it('rejects malformed base64 input', () => {
    const result = importGameState('not-valid-base64-!@#$%');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects data missing required fields', () => {
    const invalid = btoa(JSON.stringify({ foo: 'bar' }));
    const result = importGameState(invalid);
    expect(result.success).toBe(false);
    expect(result.error).toBe('유효하지 않은 세이브 데이터');
  });

  it('rejects data with wrong type on dmLevel', () => {
    const invalid = btoa(JSON.stringify({ dmLevel: 'high', ownedMonsters: [] }));
    const result = importGameState(invalid);
    expect(result.success).toBe(false);
  });
});

// ─── Wisdom bonuses ──────────────────────────────────────────────────────────

describe('getWisdomBonuses', () => {
  it('returns zero bonuses for fresh state', () => {
    const state = loadGameState();
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.startingGold).toBe(0);
    expect(bonuses.dungeonMaxHpBonus).toBe(0);
    expect(bonuses.roomCostMult).toBe(1);
    expect(bonuses.waveRewardMult).toBe(1);
    expect(bonuses.extraSlots).toBe(0);
    expect(bonuses.crystalEarnMult).toBe(1);
    expect(bonuses.monsterDmgMult).toBe(1);
    expect(bonuses.monsterAtkMult).toBe(1);
    expect(bonuses.crystalPerWave).toBe(0);
    expect(bonuses.fortressHp).toBe(0);
  });

  it('applies goldHands tier 3 → startingGold 150', () => {
    const state = loadGameState();
    state.wisdomTree['goldHands'] = 3;
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.startingGold).toBe(150); // 3 * 50
  });

  it('applies ironWalls tier 5 → +100 dungeon HP', () => {
    const state = loadGameState();
    state.wisdomTree['ironWalls'] = 5;
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.dungeonMaxHpBonus).toBe(100); // 5 * 20
  });

  it('applies masterCraft tier 4 → roomCostMult 0.8', () => {
    const state = loadGameState();
    state.wisdomTree['masterCraft'] = 4;
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.roomCostMult).toBeCloseTo(0.8); // 1 - 4*5/100
  });

  it('applies guardianBlessing tier 5 → monsterDmgMult 0.75', () => {
    const state = loadGameState();
    state.wisdomTree['guardianBlessing'] = 5;
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.monsterDmgMult).toBeCloseTo(0.75); // 1 - 5*5/100
  });

  it('applies swiftVictory tier 3 → waveRewardMult 1.3', () => {
    const state = loadGameState();
    state.wisdomTree['swiftVictory'] = 3;
    const b = getWisdomBonuses(state);
    expect(b.waveRewardMult).toBeCloseTo(1.3); // 1 + 3*10/100
  });

  it('applies ancestorsWisdom tier 4 → extraSlots 4', () => {
    const state = loadGameState();
    state.wisdomTree['ancestorsWisdom'] = 4;
    const b = getWisdomBonuses(state);
    expect(b.extraSlots).toBe(4);
  });

  it('applies crystalResonance tier 2 → crystalEarnMult 1.4', () => {
    const state = loadGameState();
    state.wisdomTree['crystalResonance'] = 2;
    const b = getWisdomBonuses(state);
    expect(b.crystalEarnMult).toBeCloseTo(1.4); // 1 + 2*20/100
  });

  it('applies eliteTrainer tier 3 → monsterAtkMult 1.09', () => {
    const state = loadGameState();
    state.wisdomTree['eliteTrainer'] = 3;
    const b = getWisdomBonuses(state);
    expect(b.monsterAtkMult).toBeCloseTo(1.09); // 1 + 3*3/100
  });

  it('applies celestialBlood tier 4 → crystalPerWave 4', () => {
    const state = loadGameState();
    state.wisdomTree['celestialBlood'] = 4;
    const b = getWisdomBonuses(state);
    expect(b.crystalPerWave).toBe(4); // tier * 1
  });

  // ── Ch8 branches ─────────────────────────────────────────────────────────────

  it('soulHarvest tier 0 → summonBonusCrystal 0', () => {
    const state = loadGameState();
    const b = getWisdomBonuses(state);
    expect(b.summonBonusCrystal).toBe(0);
  });

  it('soulHarvest tier 3 → summonBonusCrystal 6', () => {
    const state = loadGameState();
    state.wisdomTree['soulHarvest'] = 3;
    const b = getWisdomBonuses(state);
    expect(b.summonBonusCrystal).toBe(6); // 3 * 2
  });

  it('soulHarvest tier 5 → summonBonusCrystal 10 (max)', () => {
    const state = loadGameState();
    state.wisdomTree['soulHarvest'] = 5;
    const b = getWisdomBonuses(state);
    expect(b.summonBonusCrystal).toBe(10); // 5 * 2
  });

  it('forgeEnhancer tier 0 → forgeBonusCrystal 0', () => {
    const state = loadGameState();
    const b = getWisdomBonuses(state);
    expect(b.forgeBonusCrystal).toBe(0);
  });

  it('forgeEnhancer tier 2 → forgeBonusCrystal 6', () => {
    const state = loadGameState();
    state.wisdomTree['forgeEnhancer'] = 2;
    const b = getWisdomBonuses(state);
    expect(b.forgeBonusCrystal).toBe(6); // 2 * 3
  });

  it('forgeEnhancer tier 5 → forgeBonusCrystal 15 (max)', () => {
    const state = loadGameState();
    state.wisdomTree['forgeEnhancer'] = 5;
    const b = getWisdomBonuses(state);
    expect(b.forgeBonusCrystal).toBe(15); // 5 * 3
  });

  it('Ch8 both branches tier 4 each → independent values', () => {
    const state = loadGameState();
    state.wisdomTree['soulHarvest']  = 4;
    state.wisdomTree['forgeEnhancer'] = 4;
    const b = getWisdomBonuses(state);
    expect(b.summonBonusCrystal).toBe(8);   // 4 * 2
    expect(b.forgeBonusCrystal).toBe(12);   // 4 * 3
  });

  it('applies multiple bonuses independently', () => {
    const state = loadGameState();
    state.wisdomTree['goldHands']       = 2;
    state.wisdomTree['ancestorsWisdom'] = 3;
    state.wisdomTree['dungeonFortress'] = 2;
    const b = getWisdomBonuses(state);
    expect(b.startingGold).toBe(100); // 2 * 50
    expect(b.extraSlots).toBe(3);
    expect(b.fortressHp).toBe(100); // 2 * 50
  });
});

// ─── Prestige ────────────────────────────────────────────────────────────────

describe('getPrestigeDmgMult', () => {
  it('returns 1.0 for no prestige', () => {
    const state = loadGameState();
    expect(getPrestigeDmgMult(state)).toBe(1);
  });

  it('adds 10% per prestige level', () => {
    const state = loadGameState();
    state.prestigeLevel = 3;
    expect(getPrestigeDmgMult(state)).toBeCloseTo(1.3);
  });
});

describe('BRANCH_DEFS — per-branch getValue formula', () => {
  const get = (id: string) => BRANCH_DEFS.find(b => b.id === id)!;

  it('goldHands.getValue scales by 50 per tier (tier 3 → 150)', () => {
    expect(get('goldHands').getValue(3)).toBe(150);
    expect(get('goldHands').getValue(5)).toBe(250);
  });

  it('ironWalls.getValue scales by 20 per tier (tier 5 → 100)', () => {
    expect(get('ironWalls').getValue(5)).toBe(100);
  });

  it('dungeonFortress.getValue scales by 50 per tier (tier 3 → 150)', () => {
    expect(get('dungeonFortress').getValue(3)).toBe(150);
    expect(get('dungeonFortress').getValue(5)).toBe(250);
  });

  it('ancestorsWisdom.getValue equals tier (1:1 mapping)', () => {
    for (let t = 0; t <= 5; t++) {
      expect(get('ancestorsWisdom').getValue(t)).toBe(t);
    }
  });

  it('celestialBlood.getValue equals tier (1:1 mapping)', () => {
    for (let t = 0; t <= 5; t++) {
      expect(get('celestialBlood').getValue(t)).toBe(t);
    }
  });

  it('Ch8 branches (soulHarvest, forgeEnhancer) have tier-5 cost 80 — highest of all', () => {
    const maxCost5 = Math.max(...BRANCH_DEFS.map(b => b.costPerTier[4]));
    expect(get('soulHarvest').costPerTier[4]).toBe(maxCost5);
    expect(get('forgeEnhancer').costPerTier[4]).toBe(maxCost5);
    expect(maxCost5).toBe(80);
  });
});

describe('getWisdomBonuses — dungeonFortress branch', () => {
  it('dungeonFortress tier 0 → fortressHp = 0', () => {
    const state = loadGameState();
    const b = getWisdomBonuses(state);
    expect(b.fortressHp).toBe(0);
  });

  it('dungeonFortress tier 3 → fortressHp = 150', () => {
    const state = loadGameState();
    state.wisdomTree['dungeonFortress'] = 3;
    expect(getWisdomBonuses(state).fortressHp).toBe(150);
  });

  it('dungeonFortress tier 5 → fortressHp = 250 (max)', () => {
    const state = loadGameState();
    state.wisdomTree['dungeonFortress'] = 5;
    expect(getWisdomBonuses(state).fortressHp).toBe(250);
  });

  it('dungeonFortress is independent from ironWalls (both stack)', () => {
    const state = loadGameState();
    state.wisdomTree['ironWalls']       = 5; // +100 dungeonMaxHpBonus
    state.wisdomTree['dungeonFortress'] = 5; // +250 fortressHp
    const b = getWisdomBonuses(state);
    expect(b.dungeonMaxHpBonus).toBe(100);
    expect(b.fortressHp).toBe(250);
  });
});

describe('startPrestige', () => {
  it('increments prestigeLevel', () => {
    const state = loadGameState();
    const next = startPrestige(state);
    expect(next.prestigeLevel).toBe(1);

    const next2 = startPrestige(next);
    expect(next2.prestigeLevel).toBe(2);
  });

  it('preserves permanent progression (wisdomTree, DM level, crystals)', () => {
    const state = loadGameState();
    state.wisdomTree['goldHands'] = 3;
    state.dmLevel      = 15;
    state.dmXP         = 500;
    state.soulCrystals = 999;
    state.gems         = 100;

    const next = startPrestige(state);

    expect(next.wisdomTree['goldHands']).toBe(3);
    expect(next.dmLevel).toBe(15);
    expect(next.dmXP).toBe(500);
    expect(next.soulCrystals).toBe(999);
    expect(next.gems).toBe(100);
  });

  it('resets run-specific progress (homeGold, quests, stageProgress)', () => {
    const state = loadGameState();
    state.homeGold          = 9999;
    state.activeMainQuestId = 'MQ-042';
    state.stageProgress[5]  = { unlocked: true, bestStars: 3 };

    const next = startPrestige(state);

    expect(next.homeGold).toBe(200); // back to default
    expect(next.activeMainQuestId).toBe('MQ-001');
    expect(next.stageProgress[5].unlocked).toBe(false);
    expect(next.stageProgress[5].bestStars).toBe(0);
  });

  it('does not mutate the original state', () => {
    const state = loadGameState();
    state.homeGold = 9999;
    const snapshot: GameState = JSON.parse(JSON.stringify(state));
    startPrestige(state);
    expect(state.homeGold).toBe(snapshot.homeGold);
    expect(state.stageProgress).toEqual(snapshot.stageProgress);
  });
});
