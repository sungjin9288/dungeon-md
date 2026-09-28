import {
  getReadinessDirectiveCopy,
  type ReadinessDirectiveSeverity,
} from './readinessDirectives';
import { ROOM_SLOT_TYPE_DEFS } from './wisdom';

export type BattleResultCalloutState = 'destroyed' | 'damaged' | 'ready';

export interface BattleResultCalloutSlot {
  readonly hp: number;
  readonly maxHp: number;
  readonly roomType?: string;
}

export type BattleResultOutcome = boolean | { readonly won: boolean };

export interface BattleResultCalloutInput {
  readonly outcome: BattleResultOutcome;
  readonly slots: ReadonlyArray<BattleResultCalloutSlot | null | undefined>;
  readonly recentStartHps?: ReadonlyArray<number | null | undefined>;
}

export type BattleResultCalloutDirectiveKind =
  | 'room-repair'
  | 'battle-recovery'
  | 'battle-ready';

/**
 * The complete, render-only contract for a post-battle room directive.
 * Keep this object free of persistence, navigation, and transaction authority.
 */
export interface BattleResultCallout {
  readonly state: BattleResultCalloutState;
  readonly directiveKind: BattleResultCalloutDirectiveKind;
  readonly slotIdx: number | null;
  readonly roomLabel: string | null;
  readonly roleLabel: string | null;
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly chip: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
  readonly severity: ReadinessDirectiveSeverity;
}

interface Candidate {
  readonly slotIdx: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly ratio: number;
  readonly recentLoss: number;
  readonly destroyed: boolean;
  readonly roleLabel: string;
}

function didWin(outcome: BattleResultOutcome): boolean {
  return typeof outcome === 'boolean' ? outcome : outcome.won;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function collectCandidates(input: BattleResultCalloutInput): Candidate[] {
  return input.slots.flatMap((slot, slotIdx) => {
    if (
      !slot
      || !isFiniteNumber(slot.hp)
      || !isFiniteNumber(slot.maxHp)
      || slot.hp < 0
      || slot.maxHp <= 0
      || slot.hp > slot.maxHp
    ) return [];

    const role = ROOM_SLOT_TYPE_DEFS.find(def => def.id === slot.roomType);
    if (!role) return [];

    const startHp = input.recentStartHps?.[slotIdx];
    const recentLoss = isFiniteNumber(startHp)
      ? Math.max(0, (startHp - slot.hp) / slot.maxHp)
      : 0;

    return [{
      slotIdx,
      hp: slot.hp,
      maxHp: slot.maxHp,
      ratio: slot.hp / slot.maxHp,
      recentLoss,
      destroyed: slot.hp === 0,
      roleLabel: role.name,
    }];
  });
}

function chooseCandidate(candidates: readonly Candidate[]): Candidate | null {
  return [...candidates].sort((left, right) =>
    Number(right.destroyed) - Number(left.destroyed)
    || right.recentLoss - left.recentLoss
    || left.ratio - right.ratio
    || left.slotIdx - right.slotIdx,
  )[0] ?? null;
}

function statValue(hp: number, maxHp: number): string {
  return `${Math.max(0, Math.round(hp))}/${Math.max(0, Math.round(maxHp))} HP`;
}

function overallCallout(
  won: boolean,
): BattleResultCallout {
  const directiveKind: BattleResultCalloutDirectiveKind = won
    ? 'battle-ready'
    : 'battle-recovery';
  const copy = getReadinessDirectiveCopy(directiveKind);
  return {
    state: won ? 'ready' : 'damaged',
    directiveKind,
    slotIdx: null,
    roomLabel: null,
    roleLabel: null,
    icon: copy.icon,
    title: copy.title,
    body: copy.body,
    chip: copy.chip,
    statLabel: copy.statLabel,
    // Rendered above its label '준비': "준비 완료 / 준비" repeated itself.
    statValue: won ? '완료' : '편성 점검',
    accent: copy.accent,
    severity: copy.severity,
  };
}

/**
 * Project current room durability into one deterministic post-battle directive.
 * Recent start HP is used only for target ordering; displayed durability is the
 * current slot value so pre-existing damage is never attributed to this battle.
 */
export function projectBattleResultCallout(
  input: BattleResultCalloutInput,
): BattleResultCallout | null {
  const candidates = collectCandidates(input);
  if (candidates.length === 0) return null;

  const won = didWin(input.outcome);
  const candidate = chooseCandidate(candidates.filter(item => item.hp < item.maxHp));
  if (!candidate) return overallCallout(won);

  const state: BattleResultCalloutState = candidate.destroyed
    ? 'destroyed'
    : 'damaged';
  const directiveKind: BattleResultCalloutDirectiveKind = candidate.destroyed
    ? 'room-repair'
    : 'battle-recovery';
  const roomLabel = `방 #${candidate.slotIdx + 1}`;
  const copy = getReadinessDirectiveCopy(directiveKind, {
    roomLabel,
    currentHp: candidate.hp,
    maxHp: candidate.maxHp,
  });

  return {
    state,
    directiveKind,
    slotIdx: candidate.slotIdx,
    roomLabel,
    roleLabel: candidate.roleLabel,
    icon: copy.icon,
    title: copy.title,
    body: copy.body,
    chip: copy.chip,
    statLabel: copy.statLabel,
    statValue: statValue(candidate.hp, candidate.maxHp),
    accent: copy.accent,
    severity: copy.severity,
  };
}
