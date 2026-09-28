import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class { constructor(public x: number, public y: number, public w: number, public h: number) {} static Contains() { return true; } } } } }));
const { buildOverlayDim } = await import('./HomeResultOverlays');

// Home's result overlays (battle return, DM level-up, defeat, chapter complete)
// sit at depth 70-90 on a dim that took no input: a tap beside the panel reached
// the room cards and opened the placement tray (depth 120) over the summary.
describe('home result overlay dim', () => {
  it('swallows taps across the whole canvas', () => {
    const setInteractive = vi.fn();
    const dim = { fillStyle: vi.fn(), fillRect: vi.fn(), setInteractive };
    buildOverlayDim({ add: { graphics: () => dim } } as never, 0x000000, 0.5);
    expect(setInteractive).toHaveBeenCalledTimes(1);
    const [area] = setInteractive.mock.calls[0];
    expect([area.w, area.h]).toEqual([390, 844]);
  });
});
