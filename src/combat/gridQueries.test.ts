import { describe, it, expect } from 'vitest';
import {
  hasDivineTerritory,
  hasTribeMasteryFor,
  hasSeasonalBoon,
  isScrollBurstActive,
  getInvaderRow,
} from './GridQueries';
import type { RoomData } from '../data/rooms';
import { GRID_Y, CELL_SIZE } from '../constants/layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoom(partial: Partial<RoomData> = {}): RoomData {
  return {
    type: 'guardian',
    level: 1, hp: 200, maxHp: 200,
    attackCooldown: 1500, lastAttackTime: 0,
    goldPerSec: 0,
    monsterSlot:   null,
    monsterSlots:  [null],
    hasFirstStrikeUsed:    false,
    lastScrollBurstTime:   0,
    scrollBurstActiveUntil: 0,
    foxCharmAttackCount:   0,
    tideHitCount:          0,
    tauntLastTime:         0,
    roomHp: 200, maxRoomHp: 200,
    armoryDmgBonus:   0,
    roomTypeDmgMult:  1.0,
    venomHitCount:        0,
    whirlwindHitCount:    0,
    soulHarvestLastTime:  0,
    altarKillCount:       0,
    altarGhostActiveUntil: 0,
    dragonRoarLastTime:   0,
    lunarResetLastTime:   0,
    deathRattleLastTime:  0,
    nextAttack3x:    false,
    immuneUntil:     0,
    speedBoostUntil: 0,
    rageUntil:       0,
    ...partial,
  } as RoomData;
}

/** Build a 3×3 grid filled with null by default */
function emptyGrid(rows = 3, cols = 3): (RoomData | null)[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

// Row Y-centres for the default 3-row, 110px-cell grid
// GRID_Y=130, CELL_SIZE=110 → row0=185, row1=295, row2=405
const ROW_Y = [0, 1, 2].map(r => GRID_Y + r * CELL_SIZE + CELL_SIZE / 2);

// ─── hasDivineTerritory ───────────────────────────────────────────────────────

describe('hasDivineTerritory', () => {
  it('returns false for an empty grid', () => {
    expect(hasDivineTerritory(emptyGrid())).toBe(false);
  });

  it('returns false when no room has a monster', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom(); // no monsterSlot
    expect(hasDivineTerritory(grid)).toBe(false);
  });

  it('returns false when monster does not have DIVINE_TERRITORY passive', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_warrior' });
    expect(hasDivineTerritory(grid)).toBe(false);
  });

  it('returns true when mountain_god (DIVINE_TERRITORY) is placed', () => {
    const grid = emptyGrid();
    grid[1][1] = makeRoom({ monsterSlot: 'mountain_god' });
    expect(hasDivineTerritory(grid)).toBe(true);
  });

  it('returns true even when mountain_god is in a corner cell', () => {
    const grid = emptyGrid();
    grid[2][2] = makeRoom({ monsterSlot: 'mountain_god' });
    expect(hasDivineTerritory(grid)).toBe(true);
  });

  it('returns false when monsterSlot is null in every cell', () => {
    const grid = emptyGrid();
    for (const row of grid) row.fill(makeRoom({ monsterSlot: null }));
    expect(hasDivineTerritory(grid)).toBe(false);
  });
});

// ─── hasTribeMasteryFor ───────────────────────────────────────────────────────

describe('hasTribeMasteryFor', () => {
  // dokkaebi_general (ch6, dokkaebi tribe) has TRIBE_MASTERY
  it('returns false for an empty grid', () => {
    expect(hasTribeMasteryFor(emptyGrid(), 'dokkaebi')).toBe(false);
  });

  it('returns false when no monster has TRIBE_MASTERY passive', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_warrior' }); // FIRST_STRIKE_STUN
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(false);
  });

  it('returns true when a TRIBE_MASTERY monster with matching tribe is present', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general' }); // TRIBE_MASTERY, dokkaebi
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(true);
  });

  it('returns false when TRIBE_MASTERY monster tribe does not match queried tribe', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general' }); // tribe = dokkaebi
    expect(hasTribeMasteryFor(grid, 'gumiho')).toBe(false);
  });

  it('returns true when TRIBE_MASTERY monster is one of several monsters in the grid', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_warrior' }); // no TRIBE_MASTERY
    grid[0][1] = makeRoom({ monsterSlot: 'dokkaebi_general' }); // TRIBE_MASTERY, dokkaebi
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(true);
  });

  it('returns true for gumiho_goddess (TRIBE_MASTERY, tribe=gumiho)', () => {
    const grid = emptyGrid();
    grid[1][2] = makeRoom({ monsterSlot: 'gumiho_goddess' });
    expect(hasTribeMasteryFor(grid, 'gumiho')).toBe(true);
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(false); // different tribe
  });
});

// ─── hasSeasonalBoon ──────────────────────────────────────────────────────────

describe('hasSeasonalBoon', () => {
  // spring_gumiho (ch6) has SEASONAL_BOON passive
  it('returns false for an empty grid', () => {
    expect(hasSeasonalBoon(emptyGrid())).toBe(false);
  });

  it('returns false when no monster has SEASONAL_BOON', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_warrior' });
    expect(hasSeasonalBoon(grid)).toBe(false);
  });

  it('returns true when spring_gumiho (SEASONAL_BOON) is placed', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'spring_gumiho' });
    expect(hasSeasonalBoon(grid)).toBe(true);
  });

  it('returns true when SEASONAL_BOON monster is in any cell', () => {
    const grid = emptyGrid();
    grid[2][1] = makeRoom({ monsterSlot: 'spring_gumiho' });
    expect(hasSeasonalBoon(grid)).toBe(true);
  });
});

// ─── isScrollBurstActive ──────────────────────────────────────────────────────

describe('isScrollBurstActive', () => {
  const COLS = 3;
  const NOW  = 5000;

  it('returns false on an empty grid', () => {
    expect(isScrollBurstActive(emptyGrid(), COLS, 0, 0, NOW)).toBe(false);
  });

  it('returns false when scroll_library burst has expired (activeUntil < now)', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: 1000 }); // expired
    expect(isScrollBurstActive(grid, COLS, 0, 1, NOW)).toBe(false);
  });

  it('returns true when adjacent scroll_library burst is active', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 1000 });
    // querying cell (0,1): Manhattan distance = 1 ≤ 3 → active
    expect(isScrollBurstActive(grid, COLS, 0, 1, NOW)).toBe(true);
  });

  it('returns true for same cell (distance 0)', () => {
    const grid = emptyGrid();
    grid[1][1] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 });
    expect(isScrollBurstActive(grid, COLS, 1, 1, NOW)).toBe(true);
  });

  it('returns true for Manhattan distance exactly 3', () => {
    // scroll at (0,0); query at (1,2): |1-0|+|2-0| = 3
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 });
    expect(isScrollBurstActive(grid, COLS, 1, 2, NOW)).toBe(true);
  });

  it('returns false for Manhattan distance > 3', () => {
    // Need a bigger grid: scroll at (0,0); query at (0,4): distance = 4
    const bigGrid = emptyGrid(3, 5);
    bigGrid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 });
    expect(isScrollBurstActive(bigGrid, 5, 0, 4, NOW)).toBe(false);
  });

  it('returns false when room is not scroll_library (even with burst time set)', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ type: 'guardian', scrollBurstActiveUntil: NOW + 500 });
    expect(isScrollBurstActive(grid, COLS, 0, 1, NOW)).toBe(false);
  });

  it('returns true when one of two scroll_libraries is active (expired one ignored)', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: 100 });      // expired
    grid[0][2] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 }); // active
    // querying (0,1): distance to (0,2) = 1 ≤ 3 → true
    expect(isScrollBurstActive(grid, COLS, 0, 1, NOW)).toBe(true);
  });
});

// ─── getInvaderRow ────────────────────────────────────────────────────────────

describe('getInvaderRow', () => {
  it('maps exact row-0 centre to row 0', () => {
    expect(getInvaderRow(CELL_SIZE, { y: ROW_Y[0] })).toBe(0);
  });

  it('maps exact row-1 centre to row 1', () => {
    expect(getInvaderRow(CELL_SIZE, { y: ROW_Y[1] })).toBe(1);
  });

  it('maps exact row-2 centre to row 2', () => {
    expect(getInvaderRow(CELL_SIZE, { y: ROW_Y[2] })).toBe(2);
  });

  it('returns -1 for y = 0 (far above all rows)', () => {
    expect(getInvaderRow(CELL_SIZE, { y: 0 })).toBe(-1);
  });

  it('returns -1 for y = 1000 (far below all rows)', () => {
    expect(getInvaderRow(CELL_SIZE, { y: 1000 })).toBe(-1);
  });

  it('maps y close to row-0 centre (within 0.7×cellSize) to row 0', () => {
    const closeY = ROW_Y[0] + Math.floor(CELL_SIZE * 0.6); // within band
    expect(getInvaderRow(CELL_SIZE, { y: closeY })).toBe(0);
  });

  it('accepts y at the exact upper boundary of row-0 band (distance = 0.7×cellSize)', () => {
    // Math.abs(y - rowY) <= 0.7×cellSize → exactly at boundary should return 0
    const boundaryY = ROW_Y[0] - CELL_SIZE * 0.7;
    expect(getInvaderRow(CELL_SIZE, { y: boundaryY })).toBe(0);
  });

  it('returns -1 for y past the last row band', () => {
    const pastLastRow = ROW_Y[2] + CELL_SIZE * 0.7 + 1;
    expect(getInvaderRow(CELL_SIZE, { y: pastLastRow })).toBe(-1);
  });

  it('maps y close to row-2 centre (exclusive to row-2 band) to row 2', () => {
    // Row-1 upper bound = ROW_Y[1] + 0.7×C = 295+77 = 372.
    // Use ROW_Y[2] + 0.5×C = 460, which is inside row-2 band and outside row-1 band.
    const closeY = ROW_Y[2] + Math.floor(CELL_SIZE * 0.5);
    expect(getInvaderRow(CELL_SIZE, { y: closeY })).toBe(2);
  });
});
