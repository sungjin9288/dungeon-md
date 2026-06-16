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
    return buildVerticalCutaway(input);
  }
  return buildFlatGrid(input);
}

// ─── Vertical-cutaway implementation ─────────────────────────────────────────

/**
 * Phase B/D: Vertical dungeon cross-section.
 *
 * Layout (top→bottom within regionTop..regionBottom):
 *   [Entrance strip ~38px] → [Band B1] → [gap 6px] → [Band B2] → [gap] → [Band B3] → [Heart strip ~42px]
 *
 * With the expanded regionBottom (~578) the region height is ~482px, giving:
 *   bandsH ≈ 402px  →  bandH ≈ 130px  →  cellH ≈ 118px  (generous, square-ish)
 *
 * Route polyline (Phase D): clean descending SPINE through centre column,
 * with short horizontal stubs to left/right cells.  The spine points are:
 *   entrance → bandEntry[0] → bandEntry[1] → bandEntry[2] → heart
 * where bandEntry[row] is the centre-column cell's horizontal centre, at the
 * vertical midpoint of that band.  Left/right cell connections branch off the
 * spine at each band's entry Y — stored in the returned routePolyline as
 *     spine[0]=entrance, spine[1]=band0Entry, ... spine[3]=band2Entry, spine[4]=heart
 * plus  sidePolylines[row][col] for stub rendering (exposed via floors[].cells[].center).
 *
 * Consumers that iterate routePolyline get a purely vertical chain; the route
 * renderer calls drawRouteInfrastructureSegment per *cell* pair which are
 * already correctly positioned.
 */
function buildVerticalCutaway(input: BoardLayoutInput): DungeonBoardLayout {
  const { unlockedSlots, totalSlots, regionTop, regionBottom, canvasWidth } = input;

  // ── Geometry constants ────────────────────────────────────────────────────
  const ENTRANCE_H = 38;   // entrance strip height (Phase D: bigger)
  const HEART_H    = 42;   // heart strip height (Phase D: bigger)
  const SIDE_GUT   = 8;    // left+right gutter (per side)
  const CELL_GAP_X = 6;    // horizontal gap between cells within a band
  const BAND_GAP   = 6;    // vertical gap between bands
  const CELL_PAD_Y = 6;    // top+bottom padding inside band
  const numBands   = 3;
  const numCols    = 3;

  const regionH      = regionBottom - regionTop;
  const bandsH       = regionH - ENTRANCE_H - HEART_H;
  const bandH        = Math.floor((bandsH - (numBands - 1) * BAND_GAP) / numBands);
  const cellH        = bandH - 2 * CELL_PAD_Y;
  const availW       = canvasWidth - 2 * SIDE_GUT;
  const cellW        = Math.floor((availW - (numCols - 1) * CELL_GAP_X) / numCols);

  const boardX  = SIDE_GUT;
  const boardY  = regionTop;
  const boardW  = canvasWidth - 2 * SIDE_GUT;

  // ── Build all cells ────────────────────────────────────────────────────────
  const allCells: BoardCell[] = [];
  for (let row = 0; row < numBands; row++) {
    const bandTop = regionTop + ENTRANCE_H + row * (bandH + BAND_GAP);
    for (let col = 0; col < numCols; col++) {
      const slotIdx = row * numCols + col;
      if (slotIdx >= totalSlots) continue;

      const rx = SIDE_GUT + col * (cellW + CELL_GAP_X);
      const ry = bandTop + CELL_PAD_Y;
      const rect: Rect   = { x: rx, y: ry, w: cellW, h: cellH };
      const center: Point = { x: rx + cellW / 2, y: ry + cellH / 2 };

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

  // ── Route: row-major top→bottom (0,1,2,3,…8) ─────────────────────────────
  // Descent order — visible flow straight down through the bands.
  const route = Array.from({ length: numCols * numBands }, (_, idx) => idx)
    .filter(idx => idx < unlockedSlots);

  // ── Entrance & heart strip centers ───────────────────────────────────────
  const midX = canvasWidth / 2;
  const entrance: Point = {
    x: midX,
    y: regionTop + ENTRANCE_H / 2,
  };
  const heart: Point = {
    x: midX,
    y: regionTop + ENTRANCE_H + numBands * bandH + (numBands - 1) * BAND_GAP + HEART_H / 2,
  };

  // ── Route polyline: clean vertical SPINE  (Phase D) ──────────────────────
  // Spine: entrance → centre of each band → heart.
  // This keeps the animated tunnel/shaft running straight down the centre
  // column; cell connections branch off per-band via drawRouteInfrastructure.
  const routePolyline: Point[] = [entrance];
  for (let row = 0; row < numBands; row++) {
    const bandTop    = regionTop + ENTRANCE_H + row * (bandH + BAND_GAP);
    const bandCentreY = bandTop + bandH / 2;
    // Only include band spine point if any cell in this row is unlocked
    const rowUnlocked = route.some(idx => Math.floor(idx / numCols) === row);
    if (rowUnlocked) {
      routePolyline.push({ x: midX, y: bandCentreY });
    }
  }
  routePolyline.push(heart);

  // ── Floor bands ───────────────────────────────────────────────────────────
  const floors: FloorBand[] = [];
  for (let row = 0; row < numBands; row++) {
    const bandTop    = regionTop + ENTRANCE_H + row * (bandH + BAND_GAP);
    const bandRect: Rect = { x: boardX, y: bandTop, w: boardW, h: bandH };
    // Label chip: centred near the LEFT of the band at the TOP seam, above cell content.
    // bandTop is the gap/seam area; cells start at bandTop+CELL_PAD_Y (6px lower).
    // The chip is tiny (36×22) and sits at the band top-seam, centred on a side stub.
    // labelPos.x = boardX + chipW/2 + 4  so chip left edge is at boardX+4 (inside board).
    // labelPos.y = bandTop − 1  (centred on the top seam line between entrance/previous band).
    const labelPos: Point = { x: boardX + 22, y: bandTop };

    const bandCells = allCells.filter(c => c.floor === row);

    floors.push({
      floor:      row,
      label:      `B${row + 1}`,
      labelPos,
      bandRect,
      cells:      bandCells,
      tunnelInY:  bandTop,
      tunnelOutY: bandTop + bandH,
    });
  }

  // ── Board rect: covers entrance through heart ─────────────────────────────
  const boardH    = ENTRANCE_H + numBands * bandH + (numBands - 1) * BAND_GAP + HEART_H;
  const boardRect: Rect = { x: boardX, y: boardY, w: boardW, h: boardH };

  // ── contentBottomY: bottom of the heart strip ────────────────────────────
  const contentBottomY = regionTop + boardH;

  return {
    entrance,
    heart,
    floors,
    cellsByIdx,
    route,
    routePolyline,
    slotW: cellW,
    slotH: cellH,
    boardRect,
    contentBottomY,
  };
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
