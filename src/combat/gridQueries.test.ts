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

  it('inherits the base passive for an evolved monster id', () => {
    const grid = emptyGrid();
    grid[1][1] = makeRoom({ monsterSlot: 'mountain_god_leg' });
    expect(hasDivineTerritory(grid)).toBe(true);
  });

  it('returns false when monsterSlot is null in every cell', () => {
    const grid = emptyGrid();
    for (const row of grid) row.fill(makeRoom({ monsterSlot: null }));
    expect(hasDivineTerritory(grid)).toBe(false);
  });

  it('returns false for an invalid/unknown monsterSlot key (graceful undefined handling)', () => {
    const grid = emptyGrid();
    // MONSTER_DEFS['nonexistent'] is undefined → passive check is safely skipped
    grid[0][0] = makeRoom({ monsterSlot: 'nonexistent_monster' as any });
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

  it('inherits tribe mastery and tribe for an evolved monster id', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general_epic' });
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

  it('works on a 1×1 grid with the matching TRIBE_MASTERY monster', () => {
    const grid = [[makeRoom({ monsterSlot: 'dokkaebi_general' })]];
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(true);
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

  it('returns false when grid has two non-SEASONAL_BOON monsters', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_warrior' });
    grid[1][2] = makeRoom({ monsterSlot: 'gumiho_guardian' });
    expect(hasSeasonalBoon(grid)).toBe(false);
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

  it('returns true when out-of-range active and in-range active both exist', () => {
    // scroll at (0,0) is active but distance from (2,2) is |2|+|2|=4 → out of range
    // scroll at (1,1) is active and distance from (2,2) is |1|+|1|=2 → in range → true
    const bigGrid = emptyGrid(3, 5);
    bigGrid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 }); // out of range
    bigGrid[1][1] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 500 }); // in range
    expect(isScrollBurstActive(bigGrid, 5, 2, 2, NOW)).toBe(true);
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

  it('returns -1 for y one pixel above the upper boundary of row-0 band', () => {
    // Upper boundary = ROW_Y[0] - 0.7×CELL_SIZE = 185 - 77 = 108
    // One pixel above = 107 → |107-185|=78 > 77 → outside all bands
    const justAbove = ROW_Y[0] - CELL_SIZE * 0.7 - 1;
    expect(getInvaderRow(CELL_SIZE, { y: justAbove })).toBe(-1);
  });

  it('y in the overlap zone [218,262] resolves to row 0 (first-match wins)', () => {
    // Row-0 band [108,262] and Row-1 band [218,372] overlap at [218,262].
    // Loop iterates r=0 first → row 0 wins.
    const overlapY = 240; // inside both bands
    expect(getInvaderRow(CELL_SIZE, { y: overlapY })).toBe(0);
  });

  it('works correctly with a custom effectiveCellSize (80px)', () => {
    // Row-0 centre = GRID_Y + 0*80 + 40 = 170
    const cs = 80;
    const row0Centre = GRID_Y + 0 * cs + cs / 2;
    expect(getInvaderRow(cs, { y: row0Centre })).toBe(0);
    // y=0 is far above every band → -1
    expect(getInvaderRow(cs, { y: 0 })).toBe(-1);
  });

  it('exact lower boundary of row-0 (ROW_Y[0] + 0.7×CELL_SIZE) returns 0', () => {
    // |ROW_Y[0] + 77 - ROW_Y[0]| = 77 = 0.7×110 ≤ 77 → row 0
    const lowerBound = ROW_Y[0] + CELL_SIZE * 0.7; // 185+77=262
    expect(getInvaderRow(CELL_SIZE, { y: lowerBound })).toBe(0);
  });

  it('one pixel past row-0 lower boundary falls into row-1 band', () => {
    // 263: |263-185|=78 > 77 (not row-0); |263-295|=32 ≤ 77 → row 1
    const justPast = ROW_Y[0] + CELL_SIZE * 0.7 + 1;
    expect(getInvaderRow(CELL_SIZE, { y: justPast })).toBe(1);
  });

  it('exact lower boundary of row-2 (ROW_Y[2] + 0.7×CELL_SIZE) returns 2', () => {
    // |ROW_Y[2] + 77 - ROW_Y[2]| = 77 ≤ 77 → row 2
    const row2Lower = ROW_Y[2] + CELL_SIZE * 0.7; // 405+77=482
    expect(getInvaderRow(CELL_SIZE, { y: row2Lower })).toBe(2);
  });
});

// ─── isScrollBurstActive — expiry boundary ────────────────────────────────────

describe('isScrollBurstActive — expiry boundary', () => {
  it('returns false when now === scrollBurstActiveUntil (strict less-than, not <=)', () => {
    const NOW = 10_000;
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW } as Partial<RoomData>);
    // now < activeUntil is false when equal → burst has just expired
    expect(isScrollBurstActive(grid, 3, 0, 0, NOW)).toBe(false);
  });

  it('returns true when now is one ms before expiry (now < activeUntil)', () => {
    const NOW = 10_000;
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 1 } as Partial<RoomData>);
    expect(isScrollBurstActive(grid, 3, 0, 0, NOW)).toBe(true);
  });
});

// ─── Additional edge-case coverage ───────────────────────────────────────────

describe('hasDivineTerritory — 1×1 grid', () => {
  it('returns true on a 1×1 grid containing mountain_god', () => {
    const grid = [[makeRoom({ monsterSlot: 'mountain_god' })]];
    expect(hasDivineTerritory(grid)).toBe(true);
  });
});

describe('hasTribeMasteryFor — graceful unknown monsterSlot', () => {
  it('returns false for an unknown/invalid monsterSlot (MONSTER_DEFS lookup is undefined)', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'totally_unknown_monster_xyz' as any });
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(false);
  });
});

describe('hasSeasonalBoon — additional cases', () => {
  it('returns true on a 1×1 grid containing spring_gumiho', () => {
    const grid = [[makeRoom({ monsterSlot: 'spring_gumiho' })]];
    expect(hasSeasonalBoon(grid)).toBe(true);
  });

  it('returns false for an unknown/invalid monsterSlot (graceful undefined handling)', () => {
    const grid = emptyGrid();
    grid[0][0] = makeRoom({ monsterSlot: 'totally_unknown_monster_xyz' as any });
    expect(hasSeasonalBoon(grid)).toBe(false);
  });
});

describe('getInvaderRow — additional edge cases', () => {
  it('returns -1 for negative y (far above all row bands)', () => {
    expect(getInvaderRow(CELL_SIZE, { y: -100 })).toBe(-1);
  });

  it('y = GRID_Y (130) falls within row-0 band (|130-185|=55 ≤ 77) → row 0', () => {
    // GRID_Y=130, row0 centre=185, half-band=77 → 130 is inside row-0
    expect(getInvaderRow(CELL_SIZE, { y: GRID_Y })).toBe(0);
  });
});

describe('isScrollBurstActive — null cell handling', () => {
  it('does not crash and returns false when grid contains null cells during scan', () => {
    const grid = emptyGrid(3, 3); // all null
    // Introduce a mix of null and a non-scroll room
    grid[1][1] = makeRoom({ type: 'guardian' });
    expect(() => isScrollBurstActive(grid, 3, 0, 0, 5000)).not.toThrow();
    expect(isScrollBurstActive(grid, 3, 0, 0, 5000)).toBe(false);
  });
});

// ─── isScrollBurstActive — distance boundary & zero activeUntil ──────────────

describe('isScrollBurstActive — distance 4 and zero burst time', () => {
  const NOW = 10_000;

  it('Manhattan distance exactly 4 (just outside range) → false', () => {
    // target at (0,0), scroll_library at (0,4) → distance=4 > 3 → false
    // Grid must have GRID_ROWS=3 rows so the inner loop doesn't crash
    const grid = emptyGrid(3, 5);
    grid[0][4] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 5000 });
    expect(isScrollBurstActive(grid, 5, 0, 0, NOW)).toBe(false);
  });

  it('scrollBurstActiveUntil=0 (default/unset) nearby scroll_library → false', () => {
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: 0 });
    expect(isScrollBurstActive(grid, 3, 0, 1, NOW)).toBe(false); // 0 is not < NOW
  });

  it('all scroll_libraries expired → false (none active)', () => {
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW - 100 });
    grid[1][1] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW - 1 });
    expect(isScrollBurstActive(grid, 3, 0, 1, NOW)).toBe(false);
  });
});

// ─── hasDivineTerritory / hasTribeMasteryFor / hasSeasonalBoon — extra cases ──

describe('hasDivineTerritory — two mountain_gods', () => {
  it('returns true when two mountain_gods are present (short-circuits on first)', () => {
    const grid = emptyGrid(1, 2);
    grid[0][0] = makeRoom({ monsterSlot: 'mountain_god' });
    grid[0][1] = makeRoom({ monsterSlot: 'mountain_god' });
    expect(hasDivineTerritory(grid)).toBe(true);
  });
});

describe('hasTribeMasteryFor — dokkaebi_general (tribe=dokkaebi)', () => {
  it('returns true for dokkaebi tribe when dokkaebi_general is in the grid', () => {
    const grid = emptyGrid(1, 1);
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general' });
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(true);
  });

  it('returns false for gumiho tribe when only dokkaebi_general (dokkaebi) is placed', () => {
    const grid = emptyGrid(1, 1);
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general' });
    expect(hasTribeMasteryFor(grid, 'gumiho')).toBe(false);
  });
});

describe('hasSeasonalBoon — summer_gumiho', () => {
  it('returns true when summer_gumiho (SEASONAL_BOON) is in the grid', () => {
    const grid = emptyGrid(1, 1);
    grid[0][0] = makeRoom({ monsterSlot: 'summer_gumiho' });
    expect(hasSeasonalBoon(grid)).toBe(true);
  });
});

// ─── getInvaderRow — row-1 boundary pins & cs=80 ─────────────────────────────

describe('getInvaderRow — row-1 boundary & isScrollBurstActive dist=2 coverage', () => {
  const NOW = 8_000;

  it('exact lower boundary of row-1 (ROW_Y[1] + 0.7×CELL_SIZE = 372) → row 1', () => {
    // |372 - 295| = 77 ≤ 77 → row 1 (at boundary, included)
    const row1Lower = ROW_Y[1] + CELL_SIZE * 0.7;
    expect(getInvaderRow(CELL_SIZE, { y: row1Lower })).toBe(1);
  });

  it('one pixel past row-1 lower boundary (y=373) falls into row-2 band', () => {
    // |373-295|=78 > 77 → not row-1; |373-405|=32 ≤ 77 → row 2
    const justPast = ROW_Y[1] + CELL_SIZE * 0.7 + 1;
    expect(getInvaderRow(CELL_SIZE, { y: justPast })).toBe(2);
  });

  it('row-1 centre with cs=80: GRID_Y+80+40=250 → row 1', () => {
    const cs = 80;
    const row1Centre = GRID_Y + 1 * cs + cs / 2; // 130+80+40=250
    expect(getInvaderRow(cs, { y: row1Centre })).toBe(1);
  });

  it('isScrollBurstActive: diagonal dist=2 (scroll(0,0), query(1,1)) → true', () => {
    // |1-0|+|1-0|=2 ≤ 3 → active
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 1000 });
    expect(isScrollBurstActive(grid, 3, 1, 1, NOW)).toBe(true);
  });

  it('isScrollBurstActive: column-only dist=2 (scroll(0,0), query(0,2)) → true', () => {
    // |0-0|+|2-0|=2 ≤ 3 → active
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 1000 });
    expect(isScrollBurstActive(grid, 3, 0, 2, NOW)).toBe(true);
  });

  it('isScrollBurstActive: row-only dist=2 (scroll(0,0), query(2,0)) → true', () => {
    // |2-0|+|0-0|=2 ≤ 3 → active
    const grid = emptyGrid(3, 3);
    grid[0][0] = makeRoom({ type: 'scroll_library', scrollBurstActiveUntil: NOW + 1000 });
    expect(isScrollBurstActive(grid, 3, 2, 0, NOW)).toBe(true);
  });

  it('hasTribeMasteryFor: dokkaebi_general + gumiho_goddess → true for each tribe, false cross-tribe', () => {
    const grid = emptyGrid(1, 2);
    grid[0][0] = makeRoom({ monsterSlot: 'dokkaebi_general' }); // TRIBE_MASTERY, dokkaebi
    grid[0][1] = makeRoom({ monsterSlot: 'gumiho_goddess' });   // TRIBE_MASTERY, gumiho
    expect(hasTribeMasteryFor(grid, 'dokkaebi')).toBe(true);
    expect(hasTribeMasteryFor(grid, 'gumiho')).toBe(true);
    expect(hasTribeMasteryFor(grid, 'sea')).toBe(false);
  });
});
