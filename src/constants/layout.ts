export const CANVAS_WIDTH  = 390;
export const CANVAS_HEIGHT = 844;

export const GRID_COLS  = 3;
export const GRID_ROWS  = 3;   // 3×3 = 9 max rooms
export const CELL_SIZE  = 110;
export const GRID_X     = 30;
export const GRID_Y     = 130;

export const GRID_WIDTH  = GRID_COLS * CELL_SIZE;  // 330
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE;  // 330

/** Torch positions: four corners of the grid */
export const TORCH_POSITIONS = [
  { x: GRID_X,                  y: GRID_Y               },  // TL
  { x: GRID_X + GRID_WIDTH,     y: GRID_Y               },  // TR
  { x: GRID_X,                  y: GRID_Y + GRID_HEIGHT },  // BL
  { x: GRID_X + GRID_WIDTH,     y: GRID_Y + GRID_HEIGHT },  // BR
] as const;

// Row centres (y) for the snake path
const _R0 = GRID_Y + CELL_SIZE * 0.5;   // 185
const _R1 = GRID_Y + CELL_SIZE * 1.5;   // 295
const _R2 = GRID_Y + CELL_SIZE * 2.5;   // 405
const _GL = GRID_X;                      // left  edge = 30
const _GR = GRID_X + GRID_WIDTH;         // right edge = 360

/**
 * Snake path: enters right at row 0, snakes through all 3 rows.
 * Row 0: right → left  (cols 2→1→0)
 * Row 1: left  → right (cols 0→1→2)
 * Row 2: right → left  (cols 2→1→0)  → exit left
 */
export const INVADER_WAYPOINTS = [
  { x: CANVAS_WIDTH + 20, y: _R0 },   // enter right
  { x: _GR,               y: _R0 },   // right edge row 0
  { x: _GL,               y: _R0 },   // left  edge row 0 (row 0 traversed)
  { x: _GL,               y: _R1 },   // drop to row 1
  { x: _GR,               y: _R1 },   // right edge row 1 (row 1 traversed)
  { x: _GR,               y: _R2 },   // drop to row 2
  { x: _GL,               y: _R2 },   // left  edge row 2 (row 2 traversed)
  { x: -20,               y: _R2 },   // exit left
] as const;

export const TOP_BAR_HEIGHT = 110;
export const FOG_START_Y    = CANVAS_HEIGHT - 160;
export const FOG_HEIGHT     = 160;
