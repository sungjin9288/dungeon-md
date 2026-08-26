import { describe, expect, it } from 'vitest';
import {
  getFixedShellViewportOffset,
  getHomeZoneHitAreas,
  getLogicalViewportPointerY,
} from './GameZoneNavigation';

describe('GameZoneNavigation — Home geometry', () => {
  it('lays out exactly four 44px-or-larger global zone targets at 390×844', () => {
    const areas = getHomeZoneHitAreas(390, 844);
    expect(areas.map(area => area.zone)).toEqual(['dungeon', 'legion', 'forge', 'invasion']);
    expect(areas).toHaveLength(4);
    expect(areas.every(area => area.width >= 44 && area.height >= 44)).toBe(true);
    expect(areas[0]).toMatchObject({ x: 0, y: 780, width: 97.5, height: 64 });
    expect(areas[3]).toMatchObject({ x: 292.5, y: 780, width: 97.5, height: 64 });
  });

  it.each([
    { dpr: 1, zoom: 1, width: 390, height: 844, x: 0, y: 0 },
    { dpr: 2, zoom: 2, width: 780, height: 1688, x: 195, y: 422 },
    { dpr: 3, zoom: 3, width: 1170, height: 2532, x: 390, y: 844 },
  ])('corrects centered fixed-shell coordinates at DPR $dpr', metrics => {
    expect(getFixedShellViewportOffset(metrics)).toEqual({ x: metrics.x, y: metrics.y });
  });

  it.each([
    { pointerY: 124, zoom: 1, logicalY: 124 },
    { pointerY: 248, zoom: 2, logicalY: 124 },
    { pointerY: 2340, zoom: 3, logicalY: 780 },
    { pointerY: 320, zoom: 0, logicalY: 320 },
  ])('normalizes physical pointer Y at camera zoom $zoom', ({ pointerY, zoom, logicalY }) => {
    expect(getLogicalViewportPointerY(pointerY, zoom)).toBe(logicalY);
  });
});
