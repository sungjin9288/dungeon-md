/**
 * PreBattleShared.ts — consts, types, and pure helpers shared across the
 * PreBattle feature modules.  NO Phaser render logic here.
 */
import { getDungeonPlan, getDungeonRoomCount } from '../data/dungeonPlan';
import {
  getPrestigeDmgMult,
  getRoomSlotCapacity,
  ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot,
  type GameState,
  type RoomSlotType,
} from '../data/wisdom';
import { buildStoryInvasionTarget, STORY_INVADER_ALIASES } from '../data/battleForecast';
import { INVADER_DEFS, type InvaderType } from '../data/invaders';
import type { InvasionConfig } from '../data/quests';
import { getReadinessDirectiveCopy, type ReadinessDirectiveSeverity } from '../data/readinessDirectives';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { EQUIPMENT_DEFS, getEquipmentStats, getOwnedMonsterAtk, type EquipmentStats } from '../data/barracks';
import { TRAP_DEFS } from '../data/traps';
import { getDungeonActionQueue, type RoomActionRecommendation } from '../data/roomActionRecommendations';
import { CASUAL } from '../constants/colors';

export const ENEMY_EMOJI: Record<string, string> = {
  peasant_soldier: '👤', shield_knight:     '🛡️',
  shadow_thief:    '🗡️', field_medic:      '💊',
  // Chapter 8 invasion types
  void_soldier:    '🌑', abyss_berserker:   '💜',
  primordial_guard: '⛓️', primordial_titan: '🌌',
};

export const ENEMY_NAME: Record<string, string> = {
  peasant_soldier:  '농민병사',    shield_knight:     '방패기사',
  shadow_thief:     '그림자도적',  field_medic:       '야전 의무병',
  // Chapter 8 invasion types
  void_soldier:     '공허 병사',   abyss_berserker:   '심연 광전사',
  primordial_guard: '원초 수문장', primordial_titan:  '원초신',
};

/** Name of the invader that actually fights: story aliases resolve first. */
export function enemyDisplayName(type: string): string {
  const fightsAs = STORY_INVADER_ALIASES[type] ?? type;
  return INVADER_DEFS[fightsAs as InvaderType]?.koreanName ?? ENEMY_NAME[type] ?? type;
}

// Saturated accent palette (kept vivid on the bright casual bg).
export const ACCENT = {
  gold: CASUAL.GOLD,
  coral: CASUAL.RED,
  sky: CASUAL.BLUE,
  mint: CASUAL.GREEN,
} as const;

export const TRIBE_KO: Record<string, string> = {
  dokkaebi: '도깨비', gumiho: '구미호', sansin: '산신',
  sea: '해신', underworld: '저승', mask: '탈', moonlight: '달빛',
  dragon: '용', celestial: '천상',
};

export const ROOM_STYLE: Record<RoomSlotType | 'empty', { accent: number; bg: number; text: string }> = {
  combat:  { accent: 0xff8a45, bg: 0x382b1f, text: '#ffd3a6' },
  trap:    { accent: 0x5fb854, bg: 0x18352a, text: '#b9ffd8' },
  support: { accent: 0x55b88a, bg: 0x2a1c0e, text: '#dce8c8' },
  magic:   { accent: 0x9a6cd8, bg: 0x28264f, text: '#d6ccff' },
  empty:   { accent: 0x61778d, bg: 0x1a2a38, text: '#9db5c5' },
};

export const TRAP_DEFENSE_SCORE: Record<string, number> = {
  spike_trap:  20,
  slow_trap:   18,
  poison_trap: 32,
  stun_trap:   38,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EquipmentSummary {
  readonly monsterId: string;
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly power: number;
  readonly effect: string;
}

export interface DefenseRoomSummary {
  readonly index: number;
  readonly slot: DungeonSlot;
  readonly typeName: string;
  readonly typeIcon: string;
  readonly style: { accent: number; bg: number; text: string };
  readonly monsterIds: string[];
  readonly trapIds: string[];
  readonly capacity: { monsters: number; traps: number };
  readonly equipment: EquipmentSummary[];
  readonly equipmentPower: number;
  readonly power: number;
}

export interface DefenseTotals {
  readonly unlockedSlots: number;
  readonly builtRooms: number;
  readonly monsterCount: number;
  readonly equipmentCount: number;
  readonly trapCount: number;
  readonly equipmentPower: number;
  readonly totalPower: number;
}

export type DefenseDirectiveSeverity = ReadinessDirectiveSeverity;

export interface DefenseDirective {
  readonly title: string;
  readonly body: string;
  readonly chip: string;
  readonly severity: DefenseDirectiveSeverity;
  readonly accent: number;
  readonly fill: number;
  readonly readiness: number;
  readonly pressure: number;
  readonly actionLabel?: string;
  readonly actionSlotIdx?: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function getDefinedIds(ids: readonly (string | undefined)[] | undefined): string[] {
  return (ids ?? []).filter((id): id is string => Boolean(id));
}

export function getRoomTypeMeta(roomType: RoomSlotType | undefined): { name: string; icon: string } {
  const def = ROOM_SLOT_TYPE_DEFS.find(t => t.id === roomType);
  return {
    name: def?.name ?? '미설계실',
    icon: def?.icon ?? '◇',
  };
}

export function getOwnedMonster(gs: GameState, monsterId: string) {
  return gs.ownedMonsters.find(mon => mon.id === monsterId);
}

export function getMonsterDef(monsterId: string) {
  return resolveOwnedMonsterProfile(monsterId) ?? undefined;
}

export function getMonsterDisplayName(monsterId: string): string {
  return resolveOwnedMonsterProfile(monsterId)?.name ?? monsterId;
}

export function getMonsterDisplayEmoji(monsterId: string): string {
  return resolveOwnedMonsterProfile(monsterId)?.emoji ?? '👾';
}

export function getTrapDisplay(trapId: string): { emoji: string; name: string } {
  const trap = TRAP_DEFS.find(t => t.id === trapId);
  return { emoji: trap?.emoji ?? '◇', name: trap?.name ?? trapId };
}

export function getEquipmentDisplay(gs: GameState, equipmentId: string): { icon: string; name: string } {
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return {
    icon: craftedDef?.emoji ?? '⚙',
    name: craftedDef?.name ?? equipmentId,
  };
}

export function getEquipmentEffectLabel(stats: EquipmentStats): string {
  const labels: string[] = [];
  if (stats.atkMult) labels.push(`ATK ${stats.atkMult > 0 ? '+' : ''}${Math.round(stats.atkMult * 100)}%`);
  if (stats.roomHpBonus) labels.push(`HP +${stats.roomHpBonus}`);
  if (stats.freezeChance) labels.push(`빙결 +${Math.round(stats.freezeChance * 100)}%`);
  if (stats.executeChance) labels.push(`처형 +${Math.round(stats.executeChance * 100)}%`);
  if (stats.procBonus) labels.push(`발동 +${Math.round(stats.procBonus * 100)}%`);
  if (stats.skillCdMult && stats.skillCdMult < 1) labels.push(`쿨 -${Math.round((1 - stats.skillCdMult) * 100)}%`);
  if (stats.goldMult) labels.push(`골드 +${Math.round(stats.goldMult * 100)}%`);
  if (stats.crystalMult) labels.push(`결정 +${Math.round(stats.crystalMult * 100)}%`);
  return labels.slice(0, 2).join(' · ') || '전투 보조';
}

export function getEquipmentDefensePower(basePower: number, stats: EquipmentStats): number {
  const atkPower = Math.round(basePower * (stats.atkMult ?? 0));
  const hpPower = Math.round((stats.roomHpBonus ?? 0) * 0.16);
  const procPower = Math.round((stats.procBonus ?? 0) * 180);
  const freezePower = Math.round((stats.freezeChance ?? 0) * 160);
  const executePower = Math.round((stats.executeChance ?? 0) * 220);
  const cooldownPower = stats.skillCdMult && stats.skillCdMult < 1
    ? Math.round((1 - stats.skillCdMult) * 120)
    : 0;
  const economyPower = Math.round(((stats.goldMult ?? 0) + (stats.crystalMult ?? 0)) * 80);
  return atkPower + hpPower + procPower + freezePower + executePower + cooldownPower + economyPower;
}

export function getMonsterEquipmentSummary(gs: GameState, monsterId: string, basePower: number): EquipmentSummary | null {
  const owned = getOwnedMonster(gs, monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;
  const stats = getEquipmentStats(equipmentId);
  const display = getEquipmentDisplay(gs, equipmentId);
  return {
    monsterId,
    id: equipmentId,
    icon: display.icon,
    name: display.name,
    power: getEquipmentDefensePower(basePower, stats),
    effect: getEquipmentEffectLabel(stats),
  };
}

export function getMonsterDefenseScore(gs: GameState, monsterId: string): { base: number; equipment: EquipmentSummary | null; total: number } {
  const owned = getOwnedMonster(gs, monsterId);
  const def = getMonsterDef(monsterId);
  const base = def
    ? (owned ? getOwnedMonsterAtk(def.baseDamage, owned, gs) : def.baseDamage)
    : owned
      ? 40 + owned.level * 2
      : 0;
  const equipment = getMonsterEquipmentSummary(gs, monsterId, base);
  return {
    base,
    equipment,
    total: Math.max(0, base + (equipment?.power ?? 0)),
  };
}

export function getDefenseRooms(gs: GameState): DefenseRoomSummary[] {
  // Invasion order: the main corridor from the entrance, then the side rooms.
  const plan = getDungeonPlan(gs);
  const order = [...plan.corridor, ...plan.sides.map(side => side.slot)];
  const slots = gs.dungeonSlots ?? [];
  const rooms: DefenseRoomSummary[] = [];

  for (const index of order) {
    const slot = slots[index];
    if (!slot) continue;

    const monsterIds = getDefinedIds(slot.monsterIds);
    const trapIds = getDefinedIds(slot.trapIds);
    const hasBuild = Boolean(slot.roomType || monsterIds.length > 0 || trapIds.length > 0);
    if (!hasBuild) continue;

    const capacity = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    const meta = getRoomTypeMeta(slot.roomType);
    const monsterScores = monsterIds.map(id => getMonsterDefenseScore(gs, id));
    const monsterPower = monsterScores.reduce((sum, score) => sum + score.total, 0);
    const equipment = monsterScores
      .map(score => score.equipment)
      .filter((summary): summary is EquipmentSummary => Boolean(summary));
    const equipmentPower = equipment.reduce((sum, summary) => sum + summary.power, 0);
    const trapPower = trapIds.reduce((sum, id) => sum + (TRAP_DEFENSE_SCORE[id] ?? 16), 0);
    const durabilityPower = Math.round((slot.hp / Math.max(1, slot.maxHp)) * slot.roomLevel * 24);
    const style = ROOM_STYLE[slot.roomType ?? 'empty'];

    rooms.push({
      index,
      slot,
      typeName: meta.name,
      typeIcon: meta.icon,
      style,
      monsterIds,
      trapIds,
      capacity,
      equipment,
      equipmentPower,
      power: Math.max(0, monsterPower + trapPower + durabilityPower),
    });
  }

  return rooms;
}

export function getDefenseTotals(gs: GameState, rooms: readonly DefenseRoomSummary[]): DefenseTotals {
  const unlockedSlots = getDungeonRoomCount(gs);
  return {
    unlockedSlots,
    builtRooms: rooms.filter(room => !!room.slot.roomType).length,
    monsterCount: rooms.reduce((sum, room) => sum + room.monsterIds.length, 0),
    equipmentCount: rooms.reduce((sum, room) => sum + room.equipment.length, 0),
    trapCount: rooms.reduce((sum, room) => sum + room.trapIds.length, 0),
    equipmentPower: rooms.reduce((sum, room) => sum + room.equipmentPower, 0),
    totalPower: rooms.reduce((sum, room) => sum + room.power, 0),
  };
}

export function getFirstEmptyUnlockedSlot(
  rooms: readonly DefenseRoomSummary[],
  totals: DefenseTotals,
): number | undefined {
  const usedSlots = new Set(rooms.map(room => room.index));
  for (let index = 0; index < totals.unlockedSlots; index++) {
    if (!usedSlots.has(index)) return index;
  }
  return undefined;
}

export function getFirstRoomWithMonsterSpace(rooms: readonly DefenseRoomSummary[]): number | undefined {
  return rooms.find(room => room.monsterIds.length < room.capacity.monsters)?.index
    ?? rooms[0]?.index;
}

export function getFirstRoomWithTrapSpace(rooms: readonly DefenseRoomSummary[]): number | undefined {
  return rooms.find(room => room.trapIds.length < room.capacity.traps)?.index
    ?? rooms[0]?.index;
}

export function getLowestHpRoom(rooms: readonly DefenseRoomSummary[]): DefenseRoomSummary | undefined {
  return [...rooms].sort((a, b) => {
    const aRatio = a.slot.hp / Math.max(1, a.slot.maxHp);
    const bRatio = b.slot.hp / Math.max(1, b.slot.maxHp);
    return aRatio - bRatio;
  })[0];
}

export function getLowestPowerRoom(rooms: readonly DefenseRoomSummary[]): DefenseRoomSummary | undefined {
  return [...rooms].sort((a, b) => a.power - b.power)[0];
}

export function getPowerRiskActionSlot(rooms: readonly DefenseRoomSummary[]): number | undefined {
  const damagedRoom = getLowestHpRoom(rooms);
  if (damagedRoom && damagedRoom.slot.hp < damagedRoom.slot.maxHp) {
    return damagedRoom.index;
  }

  return getLowestPowerRoom(rooms)?.index;
}

export function estimateInvasionPressure(cfg: InvasionConfig | undefined): number {
  if (!cfg) return 0;

  const target = buildStoryInvasionTarget(cfg).stage;
  if (!target) return 0; // Invalid targets are also rejected by battle entry.

  // Preserve the first encounter's display scale (peasant = 14) and the existing
  // wave weights, but derive every enemy contribution from the spawned HP.
  // This is a preparation heuristic, not a prediction of combat damage.
  const weightedHp = target.waves.reduce((total, wave, waveIndex) => {
    const waveHp = wave.invaders.reduce((sum, invader) =>
      sum + invader.count * INVADER_DEFS[invader.type].hp, 0);
    return total + waveHp * (1 + waveIndex * 0.18);
  }, 0);
  return Math.max(1, Math.round(weightedHp * 14 / INVADER_DEFS.peasant.hp * 0.55));
}

export function defenseDirectiveFill(severity: DefenseDirectiveSeverity): number {
  if (severity === 'danger') return 0x402333;
  if (severity === 'warning') return 0x3b3321;
  return 0x193b31;
}

export function buildDefenseDirective(
  copy: ReturnType<typeof getReadinessDirectiveCopy>,
  readiness: number,
  pressure: number,
  actionSlotIdx?: number,
): DefenseDirective {
  return {
    title: copy.title,
    body: copy.body,
    chip: copy.chip,
    severity: copy.severity,
    accent: copy.accent,
    fill: defenseDirectiveFill(copy.severity),
    readiness,
    pressure,
    actionLabel: copy.severity === 'ready' ? undefined : copy.ctaLabel,
    actionSlotIdx: copy.severity === 'ready' ? undefined : actionSlotIdx,
  };
}

export function buildDefenseDirectiveFromRoomAction(
  action: RoomActionRecommendation,
  readiness: number,
  pressure: number,
): DefenseDirective {
  const roomLabel = `방 #${action.slotIdx + 1}`;
  if (action.kind === 'design') {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('room-design', { roomLabel }),
      readiness,
      pressure,
      action.slotIdx,
    );
  }

  if (action.kind === 'repair') {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('room-repair', { roomLabel }),
      readiness,
      pressure,
      action.slotIdx,
    );
  }

  if (action.kind === 'assign-monster') {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('assign-monster', { roomLabel }),
      readiness,
      pressure,
      action.slotIdx,
    );
  }

  if (action.kind === 'install-trap') {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('install-trap', { roomLabel }),
      readiness,
      pressure,
      action.slotIdx,
    );
  }

  return buildDefenseDirective(
    getReadinessDirectiveCopy('forge-equipment', {
      roomLabel,
      readiness,
    }),
    readiness,
    pressure,
    action.slotIdx,
  );
}

export function getDefenseDirective(
  rooms: readonly DefenseRoomSummary[],
  totals: DefenseTotals,
  gs: GameState,
  cfg: InvasionConfig | undefined,
): DefenseDirective {
  const pressure = estimateInvasionPressure(cfg);
  const readiness = pressure > 0
    ? Math.max(0, Math.min(999, Math.round((totals.totalPower / pressure) * 100)))
    : (totals.totalPower > 0 ? 100 : 0);
  const emptySlots = Math.max(0, totals.unlockedSlots - totals.builtRooms);

  if (totals.builtRooms === 0 || rooms.length === 0) {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('room-design', { unlockedSlots: totals.unlockedSlots }),
      readiness,
      pressure,
      getFirstEmptyUnlockedSlot(rooms, totals) ?? 0,
    );
  }

  if (totals.monsterCount === 0) {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('assign-monster', { builtRooms: totals.builtRooms }),
      readiness,
      pressure,
      getFirstRoomWithMonsterSpace(rooms),
    );
  }

  const actionQueue = getDungeonActionQueue(gs, totals.unlockedSlots);
  const firstRoomAction = actionQueue[0];
  if (firstRoomAction && firstRoomAction.kind !== 'growth') {
    const chore = buildDefenseDirectiveFromRoomAction(firstRoomAction, readiness, pressure);
    // Already strong enough for this invasion: a room chore (an empty seat, a missing trap)
    // is advice, not a reason to hold the sortie — "보강 권장" at 50x the needed power misled.
    // The chore stays on the card and its button; only the verdict turns to ready.
    if (readiness >= 100 && chore.severity === 'warning') {
      return { ...chore, severity: 'ready', chip: '여유', accent: 0xffe27a, fill: defenseDirectiveFill('ready') };
    }
    return chore;
  }

  if (pressure > 0 && readiness < 80) {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('power-risk', {
        currentPower: totals.totalPower,
        requiredPower: pressure,
      }),
      readiness,
      pressure,
      getPowerRiskActionSlot(rooms),
    );
  }

  if (totals.trapCount === 0) {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('install-trap', { monsterCount: totals.monsterCount }),
      readiness,
      pressure,
      getFirstRoomWithTrapSpace(rooms),
    );
  }

  if (emptySlots > 0) {
    return buildDefenseDirective(
      getReadinessDirectiveCopy('room-design', { emptySlots }),
      readiness,
      pressure,
      getFirstEmptyUnlockedSlot(rooms, totals),
    );
  }

  if (firstRoomAction) {
    return buildDefenseDirectiveFromRoomAction(firstRoomAction, readiness, pressure);
  }

  return buildDefenseDirective(
    getReadinessDirectiveCopy('battle-ready', {
      currentPower: totals.totalPower,
      requiredPower: pressure,
      readiness,
    }),
    readiness,
    pressure,
  );
}

export function getDefenseActionVerb(directive: DefenseDirective): string {
  if (directive.title.includes('새 방')) return '설계';
  if (directive.title.includes('수호자')) return '배치';
  if (directive.title.includes('함정')) return '함정';
  if (directive.title.includes('복구')) return '수리';
  return '정비';
}

export function getDefenseActionButtonLabel(directive: DefenseDirective): string {
  if (!directive.actionLabel) return '';
  if (directive.actionSlotIdx === undefined) return directive.actionLabel;
  return `방 #${directive.actionSlotIdx + 1} ${getDefenseActionVerb(directive)}`;
}

export function getDefenseQueueBadgeLabel(action: RoomActionRecommendation): string {
  if (action.kind === 'assign-monster') return '배치';
  if (action.kind === 'install-trap') return '함정';
  if (action.kind === 'design') return '설계';
  if (action.kind === 'repair') return '수리';
  if (action.kind === 'growth') return '보강';
  return action.label;
}

export function formatDefenseReadinessPercent(readiness: number): string {
  if (readiness > 100) return '100%+';
  return `${Math.max(0, Math.round(readiness))}%`;
}

export function formatPrestigeBattleBonus(state: GameState): string | null {
  const prestigeLevel = state.prestigeLevel ?? 0;
  if (prestigeLevel <= 0) return null;

  const multiplier = getPrestigeDmgMult(state);
  const bonusPercent = Math.round((multiplier - 1) * 100);
  return `명성 Lv.${prestigeLevel} · 공격 피해 +${bonusPercent}% · 전투 배율 ×${multiplier.toFixed(1)}`;
}

export function getDefenseDirectiveDisplayChip(directive: DefenseDirective): string {
  if (directive.severity === 'warning' && directive.chip === '위험') return '보강';
  return directive.chip;
}

export function shortenLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
