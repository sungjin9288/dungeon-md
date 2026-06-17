/**
 * HomeRoomActionPin — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import { getRoomActionRecommendation } from '../data/roomActionRecommendations';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Shape of a room action pin shown on the board. */
export interface HomeRoomActionPin {
  readonly slotIdx: number;
  readonly label: string;
  readonly icon: string;
  readonly accent: number;
}

// ─── Room action pin computation ──────────────────────────────────────────

export function getRoomActionPin(
  scene: DungeonHomeScene,
  slotIdx: number,
): HomeRoomActionPin | null {
  const action = getRoomActionRecommendation(scene.gs, slotIdx);
  if (action.kind === 'ready') return null;
  return { slotIdx, label: action.label, icon: action.icon, accent: action.accent };
}
