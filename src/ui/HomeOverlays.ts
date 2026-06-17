// ─── HomeOverlays ─────────────────────────────────────────────────────────────
// Barrel for the top-bar, stats bar, and modal overlays used by DungeonHomeScene.
// The implementations live in HomeTopBar.ts and HomeResultOverlays.ts to keep
// each module under the 800-line limit; this file preserves the public surface.

export { buildTopBar, buildHeaderTorch, buildQuestBanner, buildStatsBar } from './HomeTopBar';
export type { TopBarRefs } from './HomeTopBar';
export {
  showBattleReturnOverlay,
  showDmLevelUpOverlay,
  showBattleDefeatOverlay,
  showChapterCompleteOverlay,
} from './HomeResultOverlays';

// openSimulationModal is used in buildDungeonGrid — re-export for convenience
export { openSimulationModal } from './SimulationModal';
