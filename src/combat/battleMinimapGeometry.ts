/**
 * 전장 미니맵 좌표 — 가로로 긴 전장(월드 x 0..worldWidth, 3줄)을 미니맵 사각형에 옮긴다. Phaser 없음.
 */
export interface MinimapRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const MINIMAP_ROWS = 3;

export function minimapX(worldX: number, worldWidth: number, rect: MinimapRect): number {
  const t = worldWidth > 0 ? worldX / worldWidth : 0;
  return rect.x + Math.max(0, Math.min(1, t)) * rect.w;
}

/** 월드 y를 줄 기준으로 옮긴다: 격자 위쪽 gridY부터 줄 높이 cellSize. */
export function minimapY(worldY: number, gridY: number, cellSize: number, rect: MinimapRect): number {
  const rowF = (worldY - gridY) / cellSize;
  return rect.y + Math.max(0, Math.min(MINIMAP_ROWS, rowF)) * (rect.h / MINIMAP_ROWS);
}

/** 미니맵을 누른 x → 그 지점을 화면 가운데에 두는 카메라 scrollX(한계 안). */
export function minimapScrollFor(mapX: number, rect: MinimapRect, worldWidth: number, viewWidth: number): number {
  const worldX = ((mapX - rect.x) / rect.w) * worldWidth;
  return Math.max(0, Math.min(Math.max(0, worldWidth - viewWidth), worldX - viewWidth / 2));
}
