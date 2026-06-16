/**
 * DungeonBoardLayout — single source of truth for the home dungeon board geometry.
 *
 * Pure module: no Phaser import, no GameState import.
 * Phase A implements only `mode:'flat-grid'`, reproducing the current 3×3 geometry exactly.
 * Phase B will fill `mode:'vertical-cutaway'`.
 */

// ─── Primitive geometry types ─────────────────────────────────────────────────

export interface Rect  { x: number; y: number; w: number; h: number; }
export interface Point { x: number; y: number; }

// ─── Cell & floor types ───────────────────────────────────────────────────────

export interface BoardCell {
  readonly slotIdx:    number;
  readonly rect:       Rect;
  readonly center:     Point;
  readonly isUnlocked: boolean;
  readonly floor:      number;   // 0-based row index
  readonly colInFloor: number;   // 0-based column index within the floor row
}

export interface FloorBand {
  readonly floor:      number;
  readonly label:      string;   // e.g. "B1"
  readonly labelPos:   Point;
  readonly bandRect:   Rect;
  readonly cells:      readonly BoardCell[];
  readonly tunnelInY:  number;   // Y of the entry tunnel center for this floor band
  readonly tunnelOutY: number;   // Y of the exit tunnel center for this floor band
}

// ─── Top-level layout ─────────────────────────────────────────────────────────

export interface DungeonBoardLayout {
  readonly entrance:        Point;
  readonly heart:           Point;
  readonly floors:          readonly FloorBand[];
  readonly cellsByIdx:      ReadonlyMap<number, BoardCell>;
  /**
   * Unlocked slot indices in invasion-route order (INVASION_ORDER ascending).
   * Consumers that previously called getUnlockedRoute() should use this directly.
   */
  readonly route:           readonly number[];
  /**
   * Cell centers in route order (entrance→cells→heart).
   * Used by route-rendering loops that call getSlotCenter() per route step.
   */
  readonly routePolyline:   readonly Point[];
  readonly slotW:           number;
  readonly slotH:           number;
  readonly boardRect:       Rect;
  /**
   * Y coordinate of the bottom edge of the last cell row.
   * minDeckY = contentBottomY + 8  (the existing +8 offset is preserved at call site).
   */
  readonly contentBottomY:  number;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BoardLayoutInput {
  readonly unlockedSlots: number;
  readonly totalSlots:    number;
  readonly regionTop:     number;    // first pixel the grid may use (≈ GRID_START_Y)
  readonly regionBottom:  number;    // last pixel available (not used in flat-grid)
  readonly canvasWidth:   number;
  readonly mode:          'flat-grid' | 'vertical-cutaway';
}

// ─── Constants mirrored from the existing layout block ───────────────────────
// These MUST stay byte-identical to the values in DungeonHomeScene.ts.
// If those values ever change, update both files.

const COLS = 3;
const ROWS = 3;
const SLOT_W = 100;
const SLOT_H = 100;
const SLOT_PAD_Y = 8;

/**
 * INVASION_ORDER[slotIdx] = invasion priority (lower = attacked first).
 * Mirrored from RoomSlotRenderer.ts. Do NOT reorder; battle code also uses it.
 */
const INVASION_ORDER: readonly number[] = [3, 2, 1, 4, 5, 6, 9, 8, 7];

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildDungeonBoardLayout(input: BoardLayoutInput): DungeonBoardLayout {
  if (input.mode === 'vertical-cutaway') {
    throw new Error('DungeonBoardLayout: vertical-cutaway is not yet implemented (Phase B).');
  }
  return buildFlatGrid(input);
}

// ─── Flat-grid implementation ─────────────────────────────────────────────────

function buildFlatGrid(input: BoardLayoutInput): DungeonBoardLayout {
  const { unlockedSlots, totalSlots, regionTop, canvasWidth } = input;

  // SLOT_PAD_X: reproduce the formula from DungeonHomeScene.ts exactly.
  // Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1))
  const slotPadX = Math.floor((canvasWidth - COLS * SLOT_W) / (COLS + 1));
  const gridStartY = regionTop;

  // ── Build all cells ────────────────────────────────────────────────────────
  const allCells: BoardCell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const slotIdx = row * COLS + col;
      if (slotIdx >= totalSlots) continue;

      const rx = slotPadX + col * (SLOT_W + slotPadX);
      const ry = gridStartY + row * (SLOT_H + SLOT_PAD_Y);
      const rect: Rect   = { x: rx, y: ry, w: SLOT_W, h: SLOT_H };
      const center: Point = { x: rx + SLOT_W / 2, y: ry + SLOT_H / 2 };

      allCells.push({
        slotIdx,
        rect,
        center,
        isUnlocked: slotIdx < unlockedSlots,
        floor:      row,
        colInFloor: col,
      });
    }
  }

  const cellsByIdx = new Map<number, BoardCell>(allCells.map(c => [c.slotIdx, c]));

  // ── Route: unlocked slots ordered by INVASION_ORDER ───────────────────────
  // Mirrors getUnlockedRoute() in DungeonHomeScene.ts exactly:
  //   .filter(idx => idx < unlockedCount)
  //   .sort((a, b) => (INVASION_ORDER[a] ?? 99) - (INVASION_ORDER[b] ?? 99))
  const route = Array.from({ length: COLS * ROWS }, (_, idx) => idx)
    .filter(idx => idx < unlockedSlots)
    .sort((a, b) => (INVASION_ORDER[a] ?? 99) - (INVASION_ORDER[b] ?? 99));

  const routePolyline: Point[] = route.map(idx => {
    const cell = cellsByIdx.get(idx);
    if (!cell) throw new Error(`DungeonBoardLayout: no cell for slotIdx ${idx}`);
    return cell.center;
  });

  // ── Floor bands ───────────────────────────────────────────────────────────
  // drawDungeonMapBackdrop uses row-based bands with label "B{row+1}".
  // labelPos: chipX = mapX + 24, chipY = y + 13  where y = GRID_START_Y + row*(SLOT_H+SLOT_PAD_Y) - 6
  // mapX = 8 (from drawDungeonMapBackdrop)
  const mapX = 8;
  const mapW  = canvasWidth - 16;

  const floors: FloorBand[] = [];
  for (let row = 0; row < ROWS; row++) {
    const bandY      = gridStartY + row * (SLOT_H + SLOT_PAD_Y) - 6;
    const bandRect: Rect = { x: mapX + 12, y: bandY, w: mapW - 24, h: SLOT_H + 6 };
    const chipX      = mapX + 24;
    const chipY      = bandY + 13;
    const labelPos: Point = { x: chipX + 1, y: chipY };

    const rowCells = allCells.filter(c => c.floor === row);
    const centerY  = gridStartY + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2;

    floors.push({
      floor:      row,
      label:      `B${row + 1}`,
      labelPos,
      bandRect,
      cells:      rowCells,
      tunnelInY:  centerY,
      tunnelOutY: centerY,
    });
  }

  // ── Board rect ────────────────────────────────────────────────────────────
  // mapY = GRID_START_Y - 12 ; mapH = GRID_ROWS * SLOT_H + (GRID_ROWS-1)*SLOT_PAD_Y + 24
  const mapY = gridStartY - 12;
  const mapH = ROWS * SLOT_H + (ROWS - 1) * SLOT_PAD_Y + 24;
  const boardRect: Rect = { x: mapX, y: mapY, w: mapW, h: mapH };

  // ── contentBottomY ────────────────────────────────────────────────────────
  // = GRID_START_Y + GRID_ROWS * (SLOT_H + SLOT_PAD_Y)
  // minDeckY in buildCommandDeck = contentBottomY + 8 (the +8 stays at call site).
  const contentBottomY = gridStartY + ROWS * (SLOT_H + SLOT_PAD_Y);

  // ── Entrance / heart ──────────────────────────────────────────────────────
  // drawDungeonEntranceGate is called at: mapX + mapW - 12, mapY + 48
  // drawDungeonHeartCore  is called at: mapX + 24, mapY + mapH - 42
  const entrance: Point = { x: mapX + mapW - 12, y: mapY + 48 };
  const heart:    Point = { x: mapX + 24,         y: mapY + mapH - 42 };

  return {
    entrance,
    heart,
    floors,
    cellsByIdx,
    route,
    routePolyline,
    slotW: SLOT_W,
    slotH: SLOT_H,
    boardRect,
    contentBottomY,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for getSlotCenter(idx) in DungeonHomeScene.
 * Returns the pixel center of the given slot.
 */
export function cellCenter(layout: DungeonBoardLayout, slotIdx: number): Point {
  const cell = layout.cellsByIdx.get(slotIdx);
  if (!cell) {
    // Fallback: should never happen for valid indices, but guard for safety.
    throw new Error(`DungeonBoardLayout.cellCenter: no cell for slotIdx ${slotIdx}`);
  }
  return cell.center;
}
