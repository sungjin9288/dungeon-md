import { calculateDungeonMetrics } from './dungeonMetrics';
import { getReadinessDirectiveCopy } from './readinessDirectives';
import {
  getDungeonActionQueue,
  type RoomActionKind,
  type RoomActionRecommendation,
} from './roomActionRecommendations';
import { getLineageNextStep, getLineageGoalPlan } from './lineage';
import { getMonsterDisplayName, getMonsterEmoji } from './fusion';
import type { GameState } from './wisdom';

export type HomePrimaryDestination = 'room-detail' | 'forge' | 'barracks' | 'pre-battle' | 'codex';

export interface HomeReadinessDirective {
  readonly destination: HomePrimaryDestination;
  readonly kind: RoomActionKind | 'ready' | 'lineage';
  readonly slotIdx: number | null;
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
  /** The exact queue action that supplied this directive, if room work remains. */
  readonly roomAction: RoomActionRecommendation | null;
}

export function getHomeReadinessDestination(
  action: RoomActionRecommendation | null,
): HomePrimaryDestination {
  if (!action) return 'pre-battle';
  if (action.kind !== 'growth') return 'room-detail';
  return action.statLabel === 'E' ? 'forge' : 'barracks';
}

/**
 * Selects Home's single primary directive from the same queue used by board markers.
 * It only reads GameState and returns the queue action fields without rewriting them.
 */
export function getHomeReadinessDirective(
  state: GameState,
  unlockedSlots: number,
): HomeReadinessDirective {
  const roomAction = getDungeonActionQueue(state, unlockedSlots)[0] ?? null;
  if (roomAction) {
    return {
      destination: getHomeReadinessDestination(roomAction),
      kind: roomAction.kind,
      slotIdx: roomAction.slotIdx,
      icon: roomAction.icon,
      title: roomAction.title,
      body: roomAction.body,
      ctaLabel: roomAction.ctaLabel,
      statLabel: roomAction.statLabel,
      statValue: roomAction.statValue,
      accent: roomAction.accent,
      roomAction,
    };
  }

  const lineage = getLineageDirective(state);
  if (lineage) return lineage;

  const readiness = calculateDungeonMetrics(state, unlockedSlots).readiness;
  const copy = getReadinessDirectiveCopy('battle-ready', { readiness });
  return {
    destination: 'pre-battle',
    kind: 'ready',
    slotIdx: null,
    icon: copy.icon,
    title: copy.title,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    statLabel: copy.statLabel,
    statValue: `${readiness}%`,
    accent: copy.accent,
    roomAction: null,
  };
}

export const LINEAGE_DIRECTIVE_ACCENT = 0xc181ff;

/** The pinned 계보도 goal as a directive: its next concrete step, or null when unpinned / reached. */
export function getLineageDirective(state: Readonly<Pick<GameState, 'lineageGoal' | 'ownedMonsters'>>): HomeReadinessDirective | null {
  const goalId = state.lineageGoal;
  if (!goalId) return null;
  const step = getLineageNextStep(state, goalId);
  if (!step) return null;
  const plan = getLineageGoalPlan(state, goalId);
  const remaining = plan.filter(entry => entry.kind !== 'owned').length;
  return {
    destination: 'codex',
    kind: 'lineage',
    slotIdx: null,
    icon: getMonsterEmoji(goalId),
    title: `목표 · ${getMonsterDisplayName(goalId)}`,
    body: step.label,
    ctaLabel: '계보 보기',
    statLabel: '남은 단계',
    statValue: `${remaining}`,
    accent: LINEAGE_DIRECTIVE_ACCENT,
    roomAction: null,
  };
}
