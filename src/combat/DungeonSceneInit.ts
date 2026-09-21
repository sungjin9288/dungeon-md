// ─── DungeonSceneInit ─────────────────────────────────────────────────────────
// Pure initialization helpers used by DungeonScene.create().
//
//   resolveStageSetup()  — resolves all stage/chapter/grid config from the
//                          Phaser registry, handling inline invasion waves,
//                          daily dungeon overrides, and weekly boss mode.
//
//   buildEquipmentMap()  — builds the monsterId → EquipmentStats lookup used
//                          by combat multipliers.

import Phaser from 'phaser';
import { logger } from '../utils/logger';
import { type WaveSpec } from '../data/stages';
import { ALL_STAGES } from '../data/allStages';
import { highestClearedStage } from '../data/stageProgress';
import { loadGameState, getUnlockedSlotCount, type WisdomBonuses } from '../data/wisdom';
import { getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { type DailyDungeon, type WeeklyBoss } from '../data/daily';
import { rollEndlessModifier } from '../data/endlessModifiers';
import { endlessDungeonHp } from '../data/endlessWave';
import { GRID_COLS } from '../constants/layout';

// ─── StageSetup ───────────────────────────────────────────────────────────────
// All derived setup values that DungeonScene.create() assigns to `this.*` fields
// after calling resolveStageSetup().

export interface StageSetup {
  waveConfigs:     WaveSpec[];
  stageChapter:    number;
  effectiveCols:   number;
  waterCells:      Set<number>;
  stageDungeonHp:  number;
  baseSlots:       number;
  isEndless:       boolean;
  endlessHighScore: number;
  stageNumber:     number;
  dailyMode:       DailyDungeon | null;
  weeklyBossMode:  WeeklyBoss   | null;
}

// ─── resolveStageSetup ────────────────────────────────────────────────────────
// Reads the `stageConfig`, `dailyMode`, and `weeklyBossMode` keys from the
// Phaser registry and returns a fully resolved StageSetup.
//
// Three source modes:
//   1. Inline waves (invasion mode) — stageCfg contains `waves` array directly.
//   2. Normal stage — stageCfg has `stageNumber`, looked up in CHAPTER_* arrays.
//   3. Daily dungeon override — `dailyMode` overrides the wave list.
//
// Registry side-effects: consumes (nulls) dailyMode and weeklyBossMode entries.

/** Last-resort core for an inline battle whose config forgot to set one. */
export const INLINE_FALLBACK_DUNGEON_HP = 1000;

export function resolveStageSetup(
  registry:  Phaser.Data.DataManager,
  gameState: ReturnType<typeof loadGameState>,
): StageSetup {
  const stageCfg = registry.get('stageConfig') as {
    stageNumber?: number; endless?: boolean;
    waves?: WaveSpec[]; chapter?: number; dungeonHp?: number;
  } | undefined;

  // The battle grid mirrors the home board exactly: nothing is built mid-battle,
  // so a stage cannot offer more (or fewer) cells than the player designed.
  const baseSlots = getUnlockedSlotCount(gameState);
  const isEndless = stageCfg?.endless ?? false;
  const endlessHighScore = isEndless ? (gameState.endlessHighScore ?? 0) : 0;

  // Roll a fresh endless challenge modifier (도전 변수) per run; carried via the
  // registry so WaveStart / UIScene / EndlessResultScene can read it. Cleared on
  // non-endless stages so no stale chip shows.
  registry.set('endlessModifier', isEndless ? rollEndlessModifier().id : null);

  // Pre-seed the trait-callout key to null so the first real callout fires a
  // 'changedata-traitCallout' event (Phaser emits 'setdata' — not 'changedata'
  // — on a key's very first set, which UIScene's listener would otherwise miss).
  registry.set('traitCallout', null);

  // Seed battle speed to 1× so UIScene's restore of the saved 2×/3× preference
  // (set after setupEvents wires the changedata-battleSpeed listener) registers
  // as a *change* and applies to DungeonScene. Same setdata→changedata caveat.
  registry.set('battleSpeed', 1);

  // Seed pause to false so the FIRST pause tap of a session registers as a
  // *change* (changedata-battlePaused) rather than a silent first-set (setdata),
  // which previously left the very first pause of a run not actually pausing.
  registry.set('battlePaused', false);

  // ── Resolve wave config + grid shape ─────────────────────────────────────────
  // ALL_STAGES is the single canonical 90-stage union (see data/allStages.ts);
  // never re-inline a per-chapter spread here or a new chapter will be missed.
  let waveConfigs:    WaveSpec[];
  let stageChapter:   number;
  let effectiveCols:  number;
  let waterCells:     Set<number>;
  let stageDungeonHp: number;
  let stageNumber:    number;

  const hasInlineWaves = Array.isArray((stageCfg as { waves?: unknown })?.waves);
  if (hasInlineWaves && stageCfg) {
    waveConfigs    = (stageCfg as { waves: WaveSpec[] }).waves;
    stageChapter   = stageCfg.chapter ?? 1;
    effectiveCols  = GRID_COLS;
    waterCells     = new Set<number>();
    // A silent `?? 1000` here is how this codebase shipped the same defect three
    // times: a mode that forgets `dungeonHp` inherits a number meant for
    // something else and nobody notices. The abyss ran all sixty floors on
    // DungeonScene's default, endless ran every wave on Chapter 1 Stage 1's
    // core, and all ten story invasions shared one constant while their own
    // pressure grew 64x. Keep the fallback — an inline battle must still start
    // — but say so, so the fourth instance is visible the first time it runs.
    if (stageCfg.dungeonHp === undefined) {
      logger.warn(
        `[STAGE] inline battle "${stageCfg.chapter ?? '?'}" carries no dungeonHp; `
        + `falling back to ${INLINE_FALLBACK_DUNGEON_HP}. Derive one from the mode's own waves.`,
      );
    }
    stageDungeonHp = stageCfg.dungeonHp ?? INLINE_FALLBACK_DUNGEON_HP;
    stageNumber    = 0;   // inline invasion — no stage number
  } else if (isEndless) {
    // Endless enters as { endless: true, stageNumber: 0 } and builds its waves
    // per wave in WaveStart, so it has neither inline waves nor a stage id.
    // It used to fall through the branch below, where `find(s => s.id === 0)`
    // misses and `?? ALL_STAGES[0]` handed every endless run Chapter 1 Stage
    // 1's tutorial core — 1,500 HP, measured, no matter how deep the run went
    // or how strong the board was. Same shape as the abyss defect: the mode
    // never set dungeonHp, so it inherited someone else's.
    //
    // An endless run fights at the player's campaign standing, so it takes the
    // core of the deepest stage they have cleared. That is derived from real
    // progress rather than invented, and it keeps growing the way the campaign
    // curve does (stage 10: 2,400 → stage 80: 11,000).
    const standing = Math.max(1, Math.min(ALL_STAGES.length, highestClearedStage(gameState)));
    stageNumber    = 0;
    waveConfigs    = [];
    stageChapter   = ALL_STAGES.find(s => s.id === standing)?.chapter ?? 1;
    effectiveCols  = GRID_COLS;
    waterCells     = new Set<number>();
    stageDungeonHp = endlessDungeonHp(standing);
  } else {
    stageNumber    = stageCfg?.stageNumber ?? 1;
    const stageDef = ALL_STAGES.find(s => s.id === stageNumber) ?? ALL_STAGES[0];
    waveConfigs    = stageDef.waves;
    stageChapter   = stageDef.chapter;
    effectiveCols  = stageDef.gridCols ?? GRID_COLS;
    waterCells     = new Set<number>(stageDef.waterCells ?? []);
    stageDungeonHp = stageDef.dungeonHp;
  }

  // ── Daily dungeon override ────────────────────────────────────────────────────
  const rawDaily = registry.get('dailyMode') as DailyDungeon | undefined;
  let dailyMode: DailyDungeon | null;
  if (rawDaily) {
    dailyMode   = rawDaily;
    waveConfigs = rawDaily.waves;
    registry.set('dailyMode', null);   // consume once
  } else {
    dailyMode = null;
  }

  // ── Weekly boss mode ──────────────────────────────────────────────────────────
  const rawWeekly = registry.get('weeklyBossMode') as { boss: WeeklyBoss } | undefined;
  const weeklyBossMode = rawWeekly?.boss ?? null;
  if (rawWeekly) registry.set('weeklyBossMode', null);

  return {
    waveConfigs, stageChapter, effectiveCols, waterCells,
    stageDungeonHp, baseSlots, isEndless,
    endlessHighScore, stageNumber, dailyMode, weeklyBossMode,
  };
}

// ─── buildEquipmentMap ────────────────────────────────────────────────────────
// Builds a fresh Map<monsterId, EquipmentStats> from the saved game state.
// Returns an empty map when no monsters have equipment.

export function buildEquipmentMap(
  gameState: ReturnType<typeof loadGameState>,
): Map<string, EquipmentStats> {
  const map = new Map<string, EquipmentStats>();
  for (const m of gameState.ownedMonsters) {
    if (m.equipment) {
      const stats = getEquipmentStats(m.equipment);
      if (Object.keys(stats).length > 0) map.set(m.id, stats);
    }
  }
  return map;
}

// ─── resolveWisdomBonuses type helper ────────────────────────────────────────
// Re-export the type so callers don't need a separate import.
export type { WisdomBonuses };
