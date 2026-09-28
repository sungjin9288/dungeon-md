import { describe, expect, it, vi } from 'vitest';
import { BOSS_PUNCH_ZOOM, playBossCameraPunch } from './ImpactVfx';

// Every final wave plays the boss entrance. Its punch-in used absolute zooms
// (1.06 → 1.0), but every scene camera runs at the DPR zoom (2 on the web audit,
// 3 on iPhones). The rest of the battle and its result panel then rendered at
// 1/DPR size with 1/DPR touch targets.
describe('boss entrance camera punch', () => {
  it.each([1, 2, 3])('punches in and returns relative to the base zoom %d', baseZoom => {
    const zoomTo = vi.fn();
    const cam = { zoom: baseZoom, zoomTo };
    const scene = { time: { delayedCall: (_ms: number, cb: () => void) => cb() } };

    playBossCameraPunch(scene, cam);

    expect(zoomTo.mock.calls.map(call => call[0])).toEqual([baseZoom * BOSS_PUNCH_ZOOM, baseZoom]);
  });
});
