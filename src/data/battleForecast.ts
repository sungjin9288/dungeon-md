/**
 * Story-invasion battle target and forecast helpers.
 *
 * This module deliberately owns the InvasionConfig -> StageConfig boundary so
 * both preview and launch operate on the same validated combat target.
 */
import { INVADER_DEFS, type InvaderType } from './invaders';
import type { InvasionConfig } from './quests';
import { simulateDungeon, type SimResult, type SimulationDiagnostic } from './simulation';
import type { StageConfig } from './stages';
import type { DungeonSlot, OwnedMonster } from './wisdom';

const STORY_INVASION_STAGE_ID = 999;
const STORY_INVASION_DUNGEON_HP = 800;
const STORY_INVASION_WAVE_REWARD = 120;
const STORY_INVASION_SPAWN_DELAY = 2200;
const FORECAST_HEURISTIC_COPY = '결정론적 DPS·이동시간 휴리스틱입니다. 장비·스킬·지혜·장식·시너지·방 메커니즘은 제외됩니다.';

/** Story-only enemy names retained by older quest data. */
export const STORY_INVADER_ALIASES: Readonly<Record<string, InvaderType>> = {
  peasant_soldier: 'peasant',
  shield_knight: 'knight',
  shadow_thief: 'shadow_ninja',
  field_medic: 'shaman',
};

export interface StoryInvasionDiagnostic {
  readonly kind: 'unknown-invader-type';
  readonly waveNumber: number;
  readonly invaderType: string;
  readonly count: number;
}

export interface StoryInvasionTarget {
  readonly stage: StageConfig | null;
  readonly diagnostics: readonly StoryInvasionDiagnostic[];
}

export type BattleForecastRisk = 'secure' | 'guarded' | 'strained' | 'critical';

export interface BattleForecast {
  readonly status: 'ready' | 'incomplete';
  readonly stage: StageConfig | null;
  readonly risk: BattleForecastRisk | null;
  readonly simulation: SimResult | null;
  readonly diagnostics: readonly (StoryInvasionDiagnostic | SimulationDiagnostic)[];
  readonly heuristicCopy: string;
  readonly marginCopy: string;
}

function isInvaderType(type: string): type is InvaderType {
  return Object.prototype.hasOwnProperty.call(INVADER_DEFS, type);
}

/** Resolve both story aliases and normal combat-registry invader types. */
export function resolveStoryInvaderType(type: string): InvaderType | undefined {
  if (Object.prototype.hasOwnProperty.call(STORY_INVADER_ALIASES, type)) {
    return STORY_INVADER_ALIASES[type];
  }
  return isInvaderType(type) ? type : undefined;
}

/**
 * Build a battle-ready StageConfig for a story invasion.
 *
 * A bad enemy type prevents a partial target from escaping this data boundary;
 * callers receive the deterministic diagnostics instead of an altered wave.
 */
export function buildStoryInvasionTarget(invasion: InvasionConfig): StoryInvasionTarget {
  const diagnostics: StoryInvasionDiagnostic[] = [];
  const waves = invasion.waves.map(wave => ({
    wave: wave.waveNumber,
    clearReward: STORY_INVASION_WAVE_REWARD,
    invaders: wave.invaders.flatMap(entry => {
      const type = resolveStoryInvaderType(entry.type);
      if (!type) {
        diagnostics.push({
          kind: 'unknown-invader-type',
          waveNumber: wave.waveNumber,
          invaderType: entry.type,
          count: entry.count,
        });
        return [];
      }
      return [{ type, count: entry.count, spawnDelay: STORY_INVASION_SPAWN_DELAY }];
    }),
  }));

  if (diagnostics.length > 0) return { stage: null, diagnostics };

  return {
    stage: {
      id: STORY_INVASION_STAGE_ID,
      chapter: 1,
      koreanName: invasion.name,
      dungeonHp: STORY_INVASION_DUNGEON_HP,
      waves,
    },
    diagnostics,
  };
}

function getForecastRisk(result: SimResult): BattleForecastRisk {
  const hpRatio = result.startHp > 0 ? result.finalHp / result.startHp : 0;
  if (hpRatio <= 0) return 'critical';
  if (hpRatio < 0.5) return 'strained';
  if (hpRatio < 0.85) return 'guarded';
  return 'secure';
}

/**
 * Run the deterministic preview for a previously built target. The target's
 * StageConfig is returned unchanged so UI callers can preserve object identity.
 */
export function buildBattleForecast(
  target: StoryInvasionTarget,
  slots: DungeonSlot[],
  ownedMonsters: OwnedMonster[],
): BattleForecast {
  if (!target.stage) {
    return {
      status: 'incomplete',
      stage: null,
      risk: null,
      simulation: null,
      diagnostics: target.diagnostics,
      heuristicCopy: `${FORECAST_HEURISTIC_COPY} 계산할 수 없습니다.`,
      marginCopy: '남은 던전 HP와 방어 여유를 계산할 수 없습니다.',
    };
  }

  const simulation = simulateDungeon(
    slots,
    ownedMonsters,
    target.stage.waves,
    target.stage.dungeonHp,
  );
  const diagnostics = [...target.diagnostics, ...simulation.diagnostics];
  if (diagnostics.length > 0) {
    return {
      status: 'incomplete',
      stage: target.stage,
      risk: null,
      simulation,
      diagnostics,
      heuristicCopy: `${FORECAST_HEURISTIC_COPY} 결과가 불완전합니다.`,
      marginCopy: '남은 던전 HP와 방어 여유를 확정할 수 없습니다.',
    };
  }

  return {
    status: 'ready',
    stage: target.stage,
    risk: getForecastRisk(simulation),
    simulation,
    diagnostics,
    heuristicCopy: FORECAST_HEURISTIC_COPY,
    marginCopy: `남은 던전 HP ${simulation.finalHp}/${simulation.startHp} · 방어 여유 +${simulation.finalHp} HP`,
  };
}
