import { calculateDungeonMetrics } from './dungeonMetrics';
import { getReadinessDirectiveCopy } from './readinessDirectives';
import {
  getDungeonActionQueue,
  type RoomActionKind,
  type RoomActionRecommendation,
} from './roomActionRecommendations';
import { getLineageNextStep, getLineageGoalPlan } from './lineage';
import { getMonsterDisplayName, getMonsterEmoji } from './fusion';
import { getDigSpotView } from './dungeonDigView';
import type { GameState } from './wisdom';

export type HomePrimaryDestination = 'room-detail' | 'forge' | 'barracks' | 'pre-battle' | 'codex' | 'summon' | 'dig';

export interface HomeReadinessDirective {
  readonly destination: HomePrimaryDestination;
  readonly kind: RoomActionKind | 'ready' | 'lineage' | 'dig';
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
  if (action.recruit) return 'summon';
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
  // A free corridor permit the player can pay for outranks growth chores (equipment, skill points):
  // growing the dungeon is the tycoon loop, and the early quests ask for it.
  if (!roomAction || roomAction.kind === 'growth') {
    const dig = getDigDirective(state);
    if (dig) return dig;
  }
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

export const DIG_DIRECTIVE_ACCENT = 0x6fbf73;

/** 주 통로를 지금 팔 수 있으면(허가 + 골드) 굴착 지시, 아니면 null. */
function getDigDirective(state: GameState): HomeReadinessDirective | null {
  const view = getDigSpotView(state, 'corridor');
  if (!view.canDig) return null;
  return {
    destination: 'dig',
    kind: 'dig',
    slotIdx: null,
    icon: '⛏',
    title: '주 통로 굴착',
    body: `굴착비 ${view.cost.toLocaleString('ko-KR')}골드 · 새 방 자리 +1`,
    ctaLabel: '굴착하기',
    statLabel: '주 통로',
    statValue: view.usageLine.split(' · ')[0].replace('주 통로 ', ''),
    accent: DIG_DIRECTIVE_ACCENT,
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
