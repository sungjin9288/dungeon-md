import { describe, expect, it, vi } from 'vitest';
import type { PlacementTrayCtx } from '../ui/DungeonPlacementTray';

// The tray is the primary Home edit path (room card → tray). Its commits must
// refresh the same Home panels as the room-detail path: the command deck
// (directive, readiness, room count) and pending main-quest settlement. Before
// this guard, building room #1 from the tray left the deck at "준비도 0% ·
// 방 0/3 · 방 #1 설계" and never paid MQ-001, stalling the first-invasion chain.
const opened: PlacementTrayCtx[] = [];
vi.mock('../ui/DungeonPlacementTray', () => ({
  openPlacementTray: (ctx: PlacementTrayCtx) => { opened.push(ctx); },
}));
vi.mock('../ui/HomeRoomSwap', () => ({ beginRoomSwap: vi.fn() }));
vi.mock('../ui/RoomDetailOverlay', () => ({ openRoomDetail: vi.fn() }));
vi.mock('../ui/RoomSlotRenderer', () => ({ drawBattleSlot: vi.fn(), SLOT_W: 120, SLOT_H: 120 }));
vi.mock('../themes/decorations', () => ({ drawStalactites: vi.fn(), drawStalagmites: vi.fn(), addWaterDrip: vi.fn() }));
vi.mock('../audio/AudioManager', () => ({ audioManager: {} }));
vi.mock('./HomeRoomCards', () => ({ addRoomActivityAura: vi.fn(), drawDungeonRoomAlcove: vi.fn(), makeRoomSlotCtx: vi.fn() }));

const { selectRoomForPlacement } = await import('./HomeChrome');

describe('Home placement tray refresh', () => {
  it('refreshes the command deck and quest settlement after a tray commit', () => {
    const scene = {
      roomFocusTransitionActive: false,
      selectedRoomIdx: null as number | null,
      rebuildDungeonSlots: vi.fn(),
      refreshHomeDynamicPanels: vi.fn(),
    };
    selectRoomForPlacement(scene as never, 0);
    const ctx = opened[opened.length - 1];
    scene.rebuildDungeonSlots.mockClear();

    ctx.rebuildSlots();

    expect(scene.refreshHomeDynamicPanels).toHaveBeenCalledTimes(1);
  });
});
