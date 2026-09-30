/**
 * Unit tests for wisdom.ts — permanent game state, branch bonuses,
 * save/load migrations, and slot unlocking.
 *
 * Pure logic only (no Phaser). Uses happy-dom for localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TOTAL_STAGES } from './stageProgress';
import {
  BRANCH_DEFS,
  ROOM_SLOT_TYPE_DEFS,
  SLOT_UNLOCK_LEVELS,
  getRoomSlotCapacity,
  getMaxRoomLevel,
  getDmLevelForRoomLevel,
  getUnlockedSlots,
  getWisdomBonuses,
  getPrestigeDmgMult,
  upgradeWisdomBranch,
  recordBuiltRoom,
  loadGameState,
  saveGameState,
  exportGameState,
  importGameState,
  startPrestige,
  type GameState,
  getUnlockedSlotCount,
  getAncestorsWisdomEffect,
  migrateToDungeonPlan,
} from './wisdom';
import { defaultOwnedMonster } from './barracks';
import { getSideCapacity } from './dungeonPlan';

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
    [1, 1],   [2, 1],
    [3, 2],   [9, 2],
    [10, 3],  [14, 3],
    [15, 4],  [19, 4],
    [20, 5],  [99, 5],
  ])('dmLevel=%i → maxRoomLevel=%i', (dm, expected) => {
    expect(getMaxRoomLevel(dm)).toBe(expected);
  });
});

// ─── Unlocked slots ──────────────────────────────────────────────────────────

describe('getUnlockedSlots', () => {
  it('opens the three-room starting board at DM Lv.0–1', () => {
    expect(getUnlockedSlots(0)).toBe(3);
    expect(getUnlockedSlots(1)).toBe(3);
  });

  it('unlocks progressively with DM level', () => {
    expect(getUnlockedSlots(2)).toBe(4);
    expect(getUnlockedSlots(4)).toBe(5);
    expect(getUnlockedSlots(5)).toBe(6);
    expect(getUnlockedSlots(6)).toBe(7);
    expect(getUnlockedSlots(7)).toBe(8);
    expect(getUnlockedSlots(8)).toBe(9);
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
    expect(state.stageProgress).toHaveLength(90);
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
    expect(state.stageProgress).toHaveLength(90);
  });
});

// ─── StageProgress migration ─────────────────────────────────────────────────

describe('stageProgress migration', () => {
  it('pads short stageProgress arrays to the full stage count', () => {
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
    // Was `>= 62`, a bound left over from before chapters 7-9 existed: a
    // regression that padded to 62 and stopped would have passed. The two
    // sibling cases above already pin the exact count; this one now does too.
    expect(state.stageProgress).toHaveLength(TOTAL_STAGES);
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
    expect(bonuses.idleIncomeMult).toBe(1);
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

  it('applies goldHands tier 3 → operating income ×1.3', () => {
    const state = loadGameState();
    state.wisdomTree['goldHands'] = 3;
    const bonuses = getWisdomBonuses(state);
    expect(bonuses.idleIncomeMult).toBeCloseTo(1.3); // 1 + 3 * 10%
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
    expect(b.idleIncomeMult).toBeCloseTo(1.2); // 1 + 2 * 10%
    expect(b.extraSlots).toBe(3);
    expect(b.fortressHp).toBe(100); // 2 * 50
  });
});

// ─── State transitions ───────────────────────────────────────────────────────

describe('upgradeWisdomBranch', () => {
  it('deducts the current tier cost and increments the selected branch immutably', () => {
    const state = loadGameState();
    state.soulCrystals = 100;
    state.wisdomTree['goldHands'] = 0;

    const result = upgradeWisdomBranch(state, 'goldHands');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state).not.toBe(state);
    expect(result.state.wisdomTree).not.toBe(state.wisdomTree);
    expect(result.previousTier).toBe(0);
    expect(result.nextTier).toBe(1);
    expect(result.cost).toBe(5);
    expect(result.state.soulCrystals).toBe(95);
    expect(result.state.wisdomTree['goldHands']).toBe(1);
    expect(state.soulCrystals).toBe(100);
    expect(state.wisdomTree['goldHands']).toBe(0);
  });

  it('uses the next tier cost for later upgrades', () => {
    const state = loadGameState();
    state.soulCrystals = 100;
    state.wisdomTree['goldHands'] = 2;

    const result = upgradeWisdomBranch(state, 'goldHands');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.previousTier).toBe(2);
    expect(result.nextTier).toBe(3);
    expect(result.cost).toBe(20);
    expect(result.state.soulCrystals).toBe(80);
  });

  it('fails without changing state when soul crystals are insufficient', () => {
    const state = loadGameState();
    state.soulCrystals = 4;

    const result = upgradeWisdomBranch(state, 'goldHands');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected insufficient crystals');
    expect(result.reason).toBe('insufficient_soul_crystals');
    expect(result.state).toBe(state);
    expect(state.wisdomTree['goldHands']).toBe(0);
  });

  it('fails without changing state when the branch is already max tier', () => {
    const state = loadGameState();
    state.soulCrystals = 999;
    state.wisdomTree['goldHands'] = 5;

    const result = upgradeWisdomBranch(state, 'goldHands');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected max tier');
    expect(result.reason).toBe('max_tier');
    expect(result.state).toBe(state);
    expect(state.wisdomTree['goldHands']).toBe(5);
  });

  it('fails without changing state for an unknown branch id', () => {
    const state = loadGameState();
    state.soulCrystals = 999;

    const result = upgradeWisdomBranch(state, 'missing_branch');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected unknown branch');
    expect(result.reason).toBe('unknown_branch');
    expect(result.state).toBe(state);
  });
});

describe('recordBuiltRoom', () => {
  it('appends a room build entry immutably and preserves duplicates', () => {
    const state = loadGameState();
    state.roomsBuilt = ['guardian'];

    const next = recordBuiltRoom(state, 'guardian');

    expect(next).not.toBe(state);
    expect(next.roomsBuilt).not.toBe(state.roomsBuilt);
    expect(next.roomsBuilt).toEqual(['guardian', 'guardian']);
    expect(state.roomsBuilt).toEqual(['guardian']);
  });

  it('treats missing legacy roomsBuilt as an empty list', () => {
    const state = loadGameState();
    state.roomsBuilt = undefined as unknown as string[];

    const next = recordBuiltRoom(state, 'trap');

    expect(next.roomsBuilt).toEqual(['trap']);
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

  it('goldHands.getValue scales by 10% per tier (tier 3 → 30)', () => {
    expect(get('goldHands').getValue(3)).toBe(30);
    expect(get('goldHands').getValue(5)).toBe(50);
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

  it('masterCraft.getValue scales by 5 per tier (tier 3 → 15, tier 5 → 25)', () => {
    expect(get('masterCraft').getValue(3)).toBe(15);
    expect(get('masterCraft').getValue(5)).toBe(25);
  });

  it('swiftVictory.getValue scales by 10 per tier (tier 3 → 30, tier 5 → 50)', () => {
    expect(get('swiftVictory').getValue(3)).toBe(30);
    expect(get('swiftVictory').getValue(5)).toBe(50);
  });

  it('crystalResonance.getValue scales by 20 per tier (tier 3 → 60, tier 5 → 100)', () => {
    expect(get('crystalResonance').getValue(3)).toBe(60);
    expect(get('crystalResonance').getValue(5)).toBe(100);
  });

  it('guardianBlessing.getValue scales by 5 per tier (tier 3 → 15, tier 5 → 25)', () => {
    expect(get('guardianBlessing').getValue(3)).toBe(15);
    expect(get('guardianBlessing').getValue(5)).toBe(25);
  });

  it('eliteTrainer.getValue scales by 3 per tier (tier 3 → 9, tier 5 → 15)', () => {
    expect(get('eliteTrainer').getValue(3)).toBe(9);
    expect(get('eliteTrainer').getValue(5)).toBe(15);
  });

  it('soulHarvest.getValue scales by 2 per tier (tier 3 → 6, tier 5 → 10)', () => {
    expect(get('soulHarvest').getValue(3)).toBe(6);
    expect(get('soulHarvest').getValue(5)).toBe(10);
  });

  it('forgeEnhancer.getValue scales by 3 per tier (tier 3 → 9, tier 5 → 15)', () => {
    expect(get('forgeEnhancer').getValue(3)).toBe(9);
    expect(get('forgeEnhancer').getValue(5)).toBe(15);
  });

  it('every branch getValue(0) returns 0', () => {
    for (const b of BRANCH_DEFS) {
      expect(b.getValue(0), `${b.id} getValue(0)`).toBe(0);
    }
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

  // Guards the highest-stakes carry-over: collection + codex + meta must survive
  // prestige. A field accidentally added to the reset list (or dropped) = real
  // player data loss. The earlier tests cover currency/wisdom only.
  it('preserves collection & meta progression (monsters, achievements, codex claims, endless, attendance)', () => {
    const state = loadGameState();
    state.ownedMonsters       = [defaultOwnedMonster('dokkaebi_warrior')];
    state.achievements        = { first_blood: { unlocked: true, current: 0, unlockedAt: 1 } };
    state.codexRewardsClaimed = ['dokkaebi'];
    state.completedTribes     = 1;
    state.endlessHighScore    = 250;
    state.attendanceDay       = 5;
    state.lastAttendanceClaim = '2026-06-20';

    const next = startPrestige(state);

    expect(next.ownedMonsters).toHaveLength(1);
    expect(next.ownedMonsters[0].id).toBe('dokkaebi_warrior');
    expect(next.achievements.first_blood?.unlocked).toBe(true);
    expect(next.codexRewardsClaimed).toEqual(['dokkaebi']);
    expect(next.completedTribes).toBe(1);
    expect(next.endlessHighScore).toBe(250);
    expect(next.attendanceDay).toBe(5);
    expect(next.lastAttendanceClaim).toBe('2026-06-20');
  });
});

describe('선조의 지혜 초과 슬롯의 HP 전환', () => {
  it.each([1, 5, 7, 8, 12, 40])('DM %i의 모든 티어에 슬롯 또는 HP 효용이 있다', dmLevel => {
    for (let tier = 0; tier <= 5; tier++) {
      const state = { dmLevel, wisdomTree: { ancestorsWisdom: tier } };
      const effect = getAncestorsWisdomEffect(state);
      expect(effect.extraSlots + effect.hpBonus / 20).toBe(tier);
      expect(getUnlockedSlotCount(state) - getUnlockedSlots(dmLevel)).toBe(effect.extraSlots);
      expect(getUnlockedSlotCount(state)).toBeLessThanOrEqual(9);
      expect(getWisdomBonuses(state).extraSlots).toBe(effect.extraSlots);
      expect(getWisdomBonuses(state).dungeonMaxHpBonus).toBe(effect.hpBonus);
    }
  });

  it('부분 상한과 전체 상한을 정확히 나눈다', () => {
    expect(getAncestorsWisdomEffect({ dmLevel: 5, wisdomTree: { ancestorsWisdom: 5 } })).toEqual({ extraSlots: 3, hpBonus: 40 });
    expect(getAncestorsWisdomEffect({ dmLevel: 7, wisdomTree: { ancestorsWisdom: 3 } })).toEqual({ extraSlots: 1, hpBonus: 40 });
    expect(getAncestorsWisdomEffect({ dmLevel: 8, wisdomTree: { ancestorsWisdom: 5 } })).toEqual({ extraSlots: 0, hpBonus: 100 });
  });

  it('기존 투자와 다른 HP 가호를 합산하고 저장·프레스티지 후에도 동일하다', () => {
    // 가로 던전: DM12 곁방 허가 4 + 선조의 지혜 5티어 = 곁방 9 — 상한(12) 안이라 HP로 넘치지 않는다.
    const state = loadGameState(); state.dmLevel = 12;
    state.wisdomTree = { ancestorsWisdom: 5, ironWalls: 5, dungeonFortress: 5 };
    const before = structuredClone(state);
    expect(getAncestorsWisdomEffect(state)).toEqual({ extraSlots: 5, hpBonus: 0 });
    expect(getSideCapacity(state)).toBe(9);
    expect(getWisdomBonuses(state).dungeonMaxHpBonus).toBe(100);
    expect(getWisdomBonuses(state).fortressHp).toBe(250);
    saveGameState(state);
    expect(getWisdomBonuses(loadGameState())).toEqual(getWisdomBonuses(state));
    const prestige = startPrestige(state);
    expect(prestige.dmLevel).toBe(12);
    expect(getWisdomBonuses(prestige)).toEqual(getWisdomBonuses(state));
    expect(state).toEqual(before);
  });

  it('최대 보드에서 구매하면 기존 비용으로 HP가 증가한다(옛 격자 세이브)', () => {
    const state: GameState = { ...loadGameState(), dungeonPlan: undefined, dmLevel: 8, soulCrystals: 145 };
    let next = state;
    for (let tier = 1; tier <= 5; tier++) {
      const result = upgradeWisdomBranch(next, 'ancestorsWisdom');
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('upgrade failed');
      next = result.state;
      expect(getWisdomBonuses(next).dungeonMaxHpBonus).toBe(tier * 20);
      expect(getUnlockedSlotCount(next)).toBe(9);
    }
    expect(next.soulCrystals).toBe(0);
    expect(state.soulCrystals).toBe(145);
  });
});

describe('선조의 지혜 → 곁방 허가(가로 던전)', () => {
  const corridor = (overrides: Partial<GameState>): GameState => ({ ...loadGameState(), ...overrides });

  it('곁방 상한을 넘는 티어만 HP로 남는다', () => {
    // DM24 곁방 허가 8 + 보석 허가증 4 = 12(상한) → 지혜 3티어는 전부 HP.
    const full = corridor({ dmLevel: 24, dungeonLicenses: { side: 4 }, wisdomTree: { ancestorsWisdom: 3 } });
    expect(getAncestorsWisdomEffect(full)).toEqual({ extraSlots: 0, hpBonus: 60 });
    expect(getSideCapacity(full)).toBe(12);
    const partial = corridor({ dmLevel: 24, dungeonLicenses: { side: 2 }, wisdomTree: { ancestorsWisdom: 3 } });
    expect(getAncestorsWisdomEffect(partial)).toEqual({ extraSlots: 2, hpBonus: 20 });
  });

  it('옛 격자에서 이미 칸을 연 티어는 주 통로에 있으므로 곁방으로 다시 세지 않는다', () => {
    // DM2 격자 4칸 + 지혜 2칸 = 6칸 → 주 통로 6(레벨 허가 2 + 옛 던전 허가 4), 곁방 보너스 0.
    const legacy: GameState = { ...loadGameState(), dungeonPlan: undefined, dmLevel: 2, wisdomTree: { ancestorsWisdom: 2 } };
    const migrated = migrateToDungeonPlan(legacy);
    expect(migrated.dungeonPlan?.corridor).toHaveLength(6);
    expect(migrated.dungeonLicenses).toMatchObject({ legacyCorridor: 4, legacyWisdom: 2 });
    expect(getAncestorsWisdomEffect(migrated)).toEqual({ extraSlots: 0, hpBonus: 0 });
    const third = { ...migrated, wisdomTree: { ancestorsWisdom: 3 } };
    expect(getAncestorsWisdomEffect(third)).toEqual({ extraSlots: 1, hpBonus: 0 });
  });
});

describe('가로 던전 켜기 — 새 게임 · 불러오기 · 복원 · 환생', () => {
  it('새 게임은 주 통로 1칸에서 시작한다', () => {
    localStorage.clear();
    expect(loadGameState().dungeonPlan).toEqual({ corridor: [0], sides: [] });
  });

  it('배치도 없는 옛 세이브는 불러올 때 이전되고 원본은 한 번만 보관된다', () => {
    localStorage.clear();
    const old = { ...loadGameState(), dungeonPlan: undefined, dmLevel: 8 };
    localStorage.setItem('dungeonGameState', JSON.stringify(old));
    const loaded = loadGameState();
    expect(loaded.dungeonPlan?.corridor).toEqual([2, 1, 0, 3, 4, 5, 8, 7, 6]);
    expect(loaded.dungeonLicenses).toMatchObject({ legacyCorridor: 4 });
    const backup = localStorage.getItem('dungeonGameState_prePlan');
    expect(JSON.parse(backup!).dungeonPlan).toBeUndefined();
    saveGameState(loaded);
    expect(loadGameState().dungeonPlan).toEqual(loaded.dungeonPlan);
    localStorage.setItem('dungeonGameState', JSON.stringify({ ...old, dmLevel: 1 }));
    loadGameState();
    expect(localStorage.getItem('dungeonGameState_prePlan')).toBe(backup);
  });

  it('옛 세이브 코드를 복원해도 같은 이전을 거친다', () => {
    localStorage.clear();
    const old = { ...loadGameState(), dungeonPlan: undefined, dmLevel: 5 };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(old))));
    expect(importGameState(code).success).toBe(true);
    const stored = JSON.parse(localStorage.getItem('dungeonGameState')!);
    expect(stored.dungeonPlan.corridor).toHaveLength(6);
  });

  it('환생은 던전을 1칸으로 되돌리되 보석 허가증은 남긴다', () => {
    const state = { ...loadGameState(), dmLevel: 12, dungeonPlan: { corridor: [0, 1, 2], sides: [] },
      dungeonLicenses: { corridor: 1, side: 2, legacyCorridor: 3, legacyWisdom: 1 } };
    const next = startPrestige(state);
    expect(next.dungeonPlan).toEqual({ corridor: [0], sides: [] });
    expect(next.dungeonLicenses).toEqual({ corridor: 1, side: 2, legacyCorridor: 0, legacyWisdom: 0 });
  });
});

// Room detail kept its own table (Lv2 at DM5) after the gate moved to DM3, and
// the placement tray said "강화 최대" for a gated room. Both now read the gate.
describe('getDmLevelForRoomLevel', () => {
  it('is the first DM level whose gate allows the room level', () => {
    expect([2, 3, 4, 5].map(getDmLevelForRoomLevel)).toEqual([3, 10, 15, 20]);
    for (const level of [2, 3, 4, 5]) {
      const dm = getDmLevelForRoomLevel(level);
      expect(getMaxRoomLevel(dm)).toBeGreaterThanOrEqual(level);
      expect(getMaxRoomLevel(dm - 1)).toBeLessThan(level);
    }
    expect(getDmLevelForRoomLevel(1)).toBe(1);
  });
});
