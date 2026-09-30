export const CANVAS_WIDTH  = 390;
export const CANVAS_HEIGHT = 844;

// Shared shell geometry. Battle and room-grid geometry below intentionally
// remains unchanged; root scenes use these constants for fixed chrome only.
export const ROOT_NAV_HEIGHT = 64;
export const ROOT_NAV_Y = CANVAS_HEIGHT - ROOT_NAV_HEIGHT;
export const SCENE_HEADER_TOUCH_HEIGHT = 44;
/** Minimum touch target (px, logical) for any tappable control. */
export const TOUCH_MIN = 44;

export const GRID_COLS  = 3;
export const GRID_ROWS  = 3;   // 3×3 = 9 max rooms
export const CELL_SIZE  = 110;
export const GRID_X     = 30;
export const GRID_Y     = 130;

export const GRID_WIDTH  = GRID_COLS * CELL_SIZE;  // 330
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE;  // 330

// The invader route and torches follow the dungeon plan now:
// data/battleTopology.ts corridorWaypoints, combat/DungeonLayout.ts placeDungeonTorches.

export const TOP_BAR_HEIGHT = 110;
export const FOG_START_Y    = CANVAS_HEIGHT - 160;
export const FOG_HEIGHT     = 160;
