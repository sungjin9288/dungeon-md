import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getRoomSlotCapacity,
  getUnlockedSlots,
  loadGameState,
  ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot,
  type GameState,
  type RoomSlotType,
} from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import type { InvaderType } from '../data/invaders';
import { getReadinessDirectiveCopy, type ReadinessDirectiveSeverity } from '../data/readinessDirectives';
import { MONSTER_DEFS } from '../data/monsters';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS, getEquipmentStats, getMonsterAtk, type ActiveSkill, type EquipmentStats, type OwnedMonster } from '../data/barracks';
import { MONSTER_EMOJI, MONSTER_NAME } from '../data/monsterDisplay';
import { TRIBE_SYNERGIES } from '../data/synergy';
import { TRAP_DEFS } from '../data/traps';
import { getDungeonActionQueue, type RoomActionRecommendation } from '../data/roomActionRecommendations';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { addMonsterPortrait, resolveMonsterTypeId } from '../ui/MonsterPortraitView';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';

// Map invasion invader type names → DungeonScene InvaderType
const INVASION_TYPE_MAP: Record<string, InvaderType> = {
  peasant_soldier: 'peasant',
  shield_knight:   'knight',
  shadow_thief:    'shadow_ninja',
  field_medic:     'shaman',
};

const ENEMY_EMOJI: Record<string, string> = {
  peasant_soldier: '👤', shield_knight:     '🛡️',
  shadow_thief:    '🗡️', field_medic:      '💊',
  // Chapter 8 invasion types
  void_soldier:    '🌑', abyss_berserker:   '💜',
  primordial_guard: '⛓️', primordial_titan: '🌌',
};
const ENEMY_NAME: Record<string, string> = {
  peasant_soldier:  '농민병사',    shield_knight:     '방패기사',
  shadow_thief:     '그림자도적',  field_medic:       '야전 의무병',
  // Chapter 8 invasion types
  void_soldier:     '공허 병사',   abyss_berserker:   '심연 광전사',
  primordial_guard: '원초 수문장', primordial_titan:  '원초신',
};
const ENEMY_THREAT_SCORE: Record<string, number> = {
  peasant_soldier:  14,
  shield_knight:    28,
  shadow_thief:     24,
  field_medic:      22,
  void_soldier:     34,
  abyss_berserker:  46,
  primordial_guard: 58,
  primordial_titan: 110,
};

// Saturated accent palette (kept vivid on the bright casual bg).
const ACCENT = {
  gold: CASUAL.GOLD,
  coral: CASUAL.RED,
  sky: CASUAL.BLUE,
  mint: CASUAL.GREEN,
} as const;

const TRIBE_KO: Record<string, string> = {
  dokkaebi: '도깨비', gumiho: '구미호', sansin: '산신',
  sea: '해신', underworld: '저승', mask: '탈', moonlight: '달빛',
  dragon: '용', celestial: '천상',
};

const ROOM_STYLE: Record<RoomSlotType | 'empty', { accent: number; bg: number; text: string }> = {
  combat:  { accent: 0xff8a45, bg: 0x382b1f, text: '#ffd3a6' },
  trap:    { accent: 0x5fb854, bg: 0x18352a, text: '#b9ffd8' },
  support: { accent: 0x55b88a, bg: 0x2a1c0e, text: '#dce8c8' },
  magic:   { accent: 0x9a6cd8, bg: 0x28264f, text: '#d6ccff' },
  empty:   { accent: 0x61778d, bg: 0x1a2a38, text: '#9db5c5' },
};

const TRAP_DEFENSE_SCORE: Record<string, number> = {
  spike_trap:  20,
  slow_trap:   18,
  poison_trap: 32,
  stun_trap:   38,
};

interface DefenseRoomSummary {
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

interface DefenseTotals {
  readonly unlockedSlots: number;
  readonly builtRooms: number;
  readonly monsterCount: number;
  readonly equipmentCount: number;
  readonly trapCount: number;
  readonly equipmentPower: number;
  readonly totalPower: number;
}

type DefenseDirectiveSeverity = ReadinessDirectiveSeverity;

interface DefenseDirective {
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

interface EquipmentSummary {
  readonly monsterId: string;
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly power: number;
  readonly effect: string;
}

function getDefinedIds(ids: readonly (string | undefined)[] | undefined): string[] {
  return (ids ?? []).filter((id): id is string => Boolean(id));
}

function getRoomTypeMeta(roomType: RoomSlotType | undefined): { name: string; icon: string } {
  const def = ROOM_SLOT_TYPE_DEFS.find(t => t.id === roomType);
  return {
    name: def?.name ?? '미설계실',
    icon: def?.icon ?? '◇',
  };
}

function getOwnedMonster(gs: GameState, monsterId: string): OwnedMonster | undefined {
  return gs.ownedMonsters.find(mon => mon.id === monsterId);
}

function getMonsterDef(monsterId: string): (typeof MONSTER_DEFS)[keyof typeof MONSTER_DEFS] | undefined {
  const typeId = resolveMonsterTypeId(monsterId);
  return typeId ? MONSTER_DEFS[typeId] : undefined;
}

function getMonsterDisplayName(monsterId: string): string {
  const typeId = resolveMonsterTypeId(monsterId);
  return (typeId ? MONSTER_NAME[typeId] : undefined) ?? MONSTER_NAME[monsterId] ?? monsterId;
}

function getMonsterDisplayEmoji(monsterId: string): string {
  const typeId = resolveMonsterTypeId(monsterId);
  return (typeId ? MONSTER_EMOJI[typeId] : undefined) ?? MONSTER_EMOJI[monsterId] ?? '👾';
}

function getTrapDisplay(trapId: string): { emoji: string; name: string } {
  const trap = TRAP_DEFS.find(t => t.id === trapId);
  return { emoji: trap?.emoji ?? '◇', name: trap?.name ?? trapId };
}

function getEquipmentDisplay(gs: GameState, equipmentId: string): { icon: string; name: string } {
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return {
    icon: craftedDef?.emoji ?? '⚙',
    name: craftedDef?.name ?? equipmentId,
  };
}

function getEquipmentEffectLabel(stats: EquipmentStats): string {
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

function getEquipmentDefensePower(basePower: number, stats: EquipmentStats): number {
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

function getMonsterEquipmentSummary(gs: GameState, monsterId: string, basePower: number): EquipmentSummary | null {
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

function getMonsterDefenseScore(gs: GameState, monsterId: string): { base: number; equipment: EquipmentSummary | null; total: number } {
  const owned = getOwnedMonster(gs, monsterId);
  const def = getMonsterDef(monsterId);
  const base = def
    ? getMonsterAtk(def.baseDamage, owned?.level ?? 1, owned?.spentSkills ?? {})
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

function getDefenseRooms(gs: GameState): DefenseRoomSummary[] {
  const unlockedSlots = getUnlockedSlots(gs.dmLevel);
  const slots = gs.dungeonSlots ?? [];
  const rooms: DefenseRoomSummary[] = [];

  for (let index = 0; index < unlockedSlots; index++) {
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

function getDefenseTotals(gs: GameState, rooms: readonly DefenseRoomSummary[]): DefenseTotals {
  const unlockedSlots = getUnlockedSlots(gs.dmLevel);
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

function getFirstEmptyUnlockedSlot(
  rooms: readonly DefenseRoomSummary[],
  totals: DefenseTotals,
): number | undefined {
  const usedSlots = new Set(rooms.map(room => room.index));
  for (let index = 0; index < totals.unlockedSlots; index++) {
    if (!usedSlots.has(index)) return index;
  }
  return undefined;
}

function getFirstRoomWithMonsterSpace(rooms: readonly DefenseRoomSummary[]): number | undefined {
  return rooms.find(room => room.monsterIds.length < room.capacity.monsters)?.index
    ?? rooms[0]?.index;
}

function getFirstRoomWithTrapSpace(rooms: readonly DefenseRoomSummary[]): number | undefined {
  return rooms.find(room => room.trapIds.length < room.capacity.traps)?.index
    ?? rooms[0]?.index;
}

function getLowestHpRoom(rooms: readonly DefenseRoomSummary[]): DefenseRoomSummary | undefined {
  return [...rooms].sort((a, b) => {
    const aRatio = a.slot.hp / Math.max(1, a.slot.maxHp);
    const bRatio = b.slot.hp / Math.max(1, b.slot.maxHp);
    return aRatio - bRatio;
  })[0];
}

function getLowestPowerRoom(rooms: readonly DefenseRoomSummary[]): DefenseRoomSummary | undefined {
  return [...rooms].sort((a, b) => a.power - b.power)[0];
}

function getPowerRiskActionSlot(rooms: readonly DefenseRoomSummary[]): number | undefined {
  const damagedRoom = getLowestHpRoom(rooms);
  if (damagedRoom && damagedRoom.slot.hp < damagedRoom.slot.maxHp) {
    return damagedRoom.index;
  }

  return getLowestPowerRoom(rooms)?.index;
}

function estimateInvasionPressure(cfg: InvasionConfig | undefined): number {
  if (!cfg) return 0;

  const rawPressure = cfg.waves.reduce((total, wave, waveIndex) => {
    const waveMultiplier = 1 + waveIndex * 0.18;
    const wavePressure = wave.invaders.reduce((sum, invader) => {
      return sum + invader.count * (ENEMY_THREAT_SCORE[invader.type] ?? 24);
    }, 0);
    return total + wavePressure * waveMultiplier;
  }, 0);

  return Math.max(1, Math.round(rawPressure * 0.55));
}

function defenseDirectiveFill(severity: DefenseDirectiveSeverity): number {
  if (severity === 'danger') return 0x402333;
  if (severity === 'warning') return 0x3b3321;
  return 0x193b31;
}

function buildDefenseDirective(
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

function buildDefenseDirectiveFromRoomAction(
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
      readiness: Number.parseInt(action.statValue, 10) || readiness,
    }),
    readiness,
    pressure,
    action.slotIdx,
  );
}

function getDefenseDirective(
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
    return buildDefenseDirectiveFromRoomAction(firstRoomAction, readiness, pressure);
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

function getDefenseActionVerb(directive: DefenseDirective): string {
  if (directive.title.includes('새 방')) return '설계';
  if (directive.title.includes('수호자')) return '배치';
  if (directive.title.includes('함정')) return '함정';
  if (directive.title.includes('복구')) return '수리';
  return '정비';
}

function getDefenseActionButtonLabel(directive: DefenseDirective): string {
  if (!directive.actionLabel) return '';
  if (directive.actionSlotIdx === undefined) return directive.actionLabel;
  return `방 #${directive.actionSlotIdx + 1} ${getDefenseActionVerb(directive)}`;
}

function drawDefenseActionTargetBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  directive: DefenseDirective,
  labelOverride?: string,
): void {
  if (directive.actionSlotIdx === undefined || !directive.actionLabel) return;

  const label = labelOverride ?? getDefenseActionVerb(directive);
  const badgeW = label.length > 3 ? 48 : 40;
  const ring = scene.add.graphics();
  ring.lineStyle(2, directive.accent, 0.92);
  ring.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  ring.fillStyle(directive.accent, 0.08);
  ring.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);

  const badge = scene.add.graphics();
  badge.fillStyle(0x1f1305, 0.94);
  badge.fillRoundedRect(x + w - badgeW - 8, y + 5, badgeW, 14, 4);
  badge.lineStyle(1, directive.accent, 0.82);
  badge.strokeRoundedRect(x + w - badgeW - 8, y + 5, badgeW, 14, 4);

  const text = scene.add.text(x + w - badgeW / 2 - 8, y + 12, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  scene.tweens.add({
    targets: [ring, badge, text],
    alpha: { from: 0.68, to: 1 },
    duration: 720,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function getDefenseQueueBadgeLabel(action: RoomActionRecommendation): string {
  if (action.kind === 'assign-monster') return '배치';
  if (action.kind === 'install-trap') return '함정';
  if (action.kind === 'design') return '설계';
  if (action.kind === 'repair') return '수리';
  if (action.kind === 'growth') return '보강';
  return action.label;
}

function drawDefenseQueueBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  action: RoomActionRecommendation,
  rank: number,
): void {
  const label = `${rank} ${getDefenseQueueBadgeLabel(action)}`;
  const w = label.length > 3 ? 48 : 40;
  const g = scene.add.graphics();
  g.fillStyle(0x1f1305, 0.88);
  g.fillRoundedRect(x - w, y, w, 14, 4);
  g.lineStyle(1, action.accent, 0.62);
  g.strokeRoundedRect(x - w, y, w, 14, 4);
  scene.add.text(x - w / 2, y + 7, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0.5);
}

function drawDefenseQueuePip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  action: RoomActionRecommendation,
  rank: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(action.accent, 0.92);
  g.fillRoundedRect(x, y, 14, 11, 4);
  g.lineStyle(1, 0x1f1305, 0.58);
  g.strokeRoundedRect(x, y, 14, 11, 4);
  scene.add.text(x + 7, y + 5.5, String(rank), {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#071824',
    fontStyle: 'bold',
  }).setOrigin(0.5);
}

function drawDefenseRouteActionRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  rank: number,
): void {
  const isPrimary = rank === 1;
  const ring = scene.add.graphics();
  ring.lineStyle(isPrimary ? 2 : 1.2, accent, isPrimary ? 0.96 : 0.72);
  ring.strokeRoundedRect(x - 3, y - 4, w + 6, h + 8, 7);
  ring.fillStyle(accent, isPrimary ? 0.12 : 0.06);
  ring.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 5);

  const corner = scene.add.graphics();
  corner.fillStyle(accent, 0.92);
  corner.fillTriangle(x + w - 2, y + 2, x + w - 2, y + 12, x + w - 12, y + 2);
  corner.lineStyle(1, 0x1f1305, 0.46);
  corner.lineBetween(x + w - 2, y + 12, x + w - 12, y + 2);

  const pulse = scene.add.graphics();
  pulse.lineStyle(1, accent, isPrimary ? 0.36 : 0.22);
  pulse.strokeRoundedRect(x - 7, y - 8, w + 14, h + 16, 9);

  scene.tweens.add({
    targets: [ring, pulse],
    alpha: { from: isPrimary ? 0.7 : 0.52, to: 1 },
    duration: isPrimary ? 680 : 920,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function drawDefenseRoomCardShell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  readinessRatio: number,
  highlighted: boolean,
): void {
  const ratio = Phaser.Math.Clamp(readinessRatio, 0, 1);
  g.fillStyle(0x140c03, highlighted ? 0.28 : 0.16);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
  g.lineStyle(highlighted ? 1.6 : 1, accent, highlighted ? 0.84 : 0.38);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);

  g.fillStyle(accent, highlighted ? 0.2 : 0.1);
  g.fillRoundedRect(x + 8, y + 10, 25, h - 20, 5);
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(x + 12, y + 15, 17, 7, 3);
  g.fillStyle(0x1f1305, 0.5);
  g.fillRoundedRect(x + 13, y + h - 23, 15, 10, 4);

  g.fillStyle(0x140c03, 0.76);
  g.fillRoundedRect(x + 42, y + h - 12, w - 98, 4, 2);
  g.fillStyle(accent, highlighted ? 0.96 : 0.78);
  g.fillRoundedRect(x + 42, y + h - 12, Math.max(4, (w - 98) * ratio), 4, 2);

  const socketAlpha = highlighted ? 0.72 : 0.42;
  [[x + w - 14, y + 8], [x + w - 14, y + h - 18], [x + 8, y + 8], [x + 8, y + h - 18]].forEach(([sx, sy]) => {
    g.fillStyle(accent, socketAlpha);
    g.fillRoundedRect(sx, sy, 6, 6, 2);
    g.fillStyle(0x140c03, 0.52);
    g.fillRoundedRect(sx + 1, sy + 1, 4, 4, 1);
  });
}

function formatDefenseReadinessPercent(readiness: number): string {
  if (readiness > 100) return '100%+';
  return `${Math.max(0, Math.round(readiness))}%`;
}

function getDefenseDirectiveDisplayChip(directive: DefenseDirective): string {
  if (directive.severity === 'warning' && directive.chip === '위험') return '보강';
  return directive.chip;
}

function shortenLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export class PreBattleScene extends Phaser.Scene {
  constructor() { super({ key: 'PreBattleScene' }); }

  create(): void {
    const cfg     = this.registry.get('invasionConfig') as InvasionConfig | undefined;
    const questId = this.registry.get('questId')        as string        | undefined;
    const gs      = loadGameState();

    // ─ Bright casual storybook background (gradient + sun glow + polka dots) ──
    applyCasualBackground(this);

    // ─ Back button — cream candy pill ────────────────────────────────────────
    const backBg = this.add.graphics();
    const drawBack = (fill: number = CASUAL.PANEL, border: number = CASUAL.EDGE): void => {
      backBg.clear();
      backBg.fillStyle(CASUAL.EDGE, 1);
      backBg.fillRoundedRect(10, 12, 70, 28, 13);
      backBg.fillStyle(fill, 1);
      backBg.fillRoundedRect(10, 10, 70, 26, 13);
      backBg.fillStyle(0xffffff, 0.45);
      backBg.fillRoundedRect(14, 12, 62, 5, 3);
      backBg.lineStyle(2, border, 1);
      backBg.strokeRoundedRect(10, 10, 70, 26, 13);
    };
    drawBack();
    const backBtn = this.add.text(45, 23, '← 취소', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5);
    const backZone = this.add.zone(10, 10, 70, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    backZone.on('pointerover', () => {
      backBtn.setColor(CASUAL_CSS.INK_SOFT);
      drawBack(CASUAL.PANEL_SOFT, CASUAL.GOLD_DK);
    });
    backZone.on('pointerout', () => {
      backBtn.setColor(CASUAL_CSS.INK);
      drawBack();
    });
    backZone.on('pointerdown', () => this.scene.start('DungeonHomeScene'));

    // ─ TOP: Invasion Info ─────────────────────────────────────────────────────
    const iY = 44, iH = cfg ? 60 + (cfg.waves[0]?.invaders.length ?? 0) * 22 + (cfg.waves.length > 1 ? 22 : 0) + 38 : 120;
    const { panel: ig } = addFramedPanel(this, {
      x: 12,
      y: iY,
      w: CANVAS_WIDTH - 24,
      h: iH,
      radius: 12,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: ACCENT.coral,
      accentAlpha: 1,
      glowColor: ACCENT.coral,
      glowOpacity: 0.12,
      shadowOpacity: 0.28,
      shadowOffsetY: 4,
    });
    // soft inner cream tray under the enemy roster
    ig.fillStyle(CASUAL.PANEL_SOFT, 0.92);
    ig.fillRoundedRect(22, iY + 54, CANVAS_WIDTH - 44, Math.max(36, iH - 68), 8);
    ig.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
    ig.strokeRoundedRect(22, iY + 54, CANVAS_WIDTH - 44, Math.max(36, iH - 68), 8);

    this.add.text(CANVAS_WIDTH / 2, iY + 18, `🚨  ${cfg?.name ?? '침략 알림'}`, {
      fontFamily: 'sans-serif', fontSize: '17px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(CANVAS_WIDTH / 2, iY + 42, `스토리 침략 — 메인 퀘스트 ${questId ?? ''}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(22, iY + 76, '예상 적군:', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    });

    let ey = iY + 96;
    const wave1 = cfg?.waves?.[0]?.invaders ?? [];
    wave1.forEach(({ type, count }) => {
      this.add.text(30, ey, `${ENEMY_EMOJI[type] ?? '👥'}  ${ENEMY_NAME[type] ?? type}  ×${count}`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      });
      ey += 22;
    });
    if ((cfg?.waves?.length ?? 0) > 1) {
      this.add.text(30, ey, `+ ${cfg!.waves.length - 1}개 추가 웨이브`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      });
      ey += 20;
    }
    this.add.text(CANVAS_WIDTH / 2, ey + 10, '⚠️  이 침략은 건너뛸 수 없습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ─ MIDDLE: Dungeon defense loadout ───────────────────────────────────────
    const defenseRooms = getDefenseRooms(gs);
    const defenseTotals = getDefenseTotals(gs, defenseRooms);
    const directive = getDefenseDirective(defenseRooms, defenseTotals, gs, cfg);
    const actionQueue = getDungeonActionQueue(gs, defenseTotals.unlockedSlots);
    const actionBySlot = new Map(
      actionQueue.map((action, index) => [action.slotIdx, { action, rank: index + 1 }]),
    );
    const dY = iY + iH + 16, dH = 348;
    const { panel: dg } = addFramedPanel(this, {
      x: 12,
      y: dY,
      w: CANVAS_WIDTH - 24,
      h: dH,
      radius: 12,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: ACCENT.sky,
      accentAlpha: 1,
      glowColor: ACCENT.sky,
      glowOpacity: 0.1,
      shadowOpacity: 0.28,
      shadowOffsetY: 4,
    });
    // inner cream tray housing the loadout board + cards
    dg.fillStyle(CASUAL.PANEL_SOFT, 0.9);
    dg.fillRoundedRect(22, dY + 38, CANVAS_WIDTH - 44, dH - 50, 9);
    dg.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.6);
    dg.strokeRoundedRect(22, dY + 38, CANVAS_WIDTH - 44, dH - 50, 9);

    this.add.text(CANVAS_WIDTH / 2, dY + 16, '던전 방어 편성', {
      fontFamily: 'sans-serif', fontSize: '14px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(CANVAS_WIDTH - 28, dY + 16, `DM Lv.${gs.dmLevel}`, {
      fontFamily: 'monospace', fontSize: '9px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    const directiveY = dY + 42;
    const directiveIcon = directive.severity === 'ready' ? '✓' : directive.severity === 'warning' ? '!' : '!';
    dg.fillStyle(CASUAL.PANEL, 1);
    dg.fillRoundedRect(24, directiveY, CANVAS_WIDTH - 48, 46, 8);
    dg.fillStyle(0xffffff, 0.4);
    dg.fillRoundedRect(28, directiveY + 4, CANVAS_WIDTH - 56, 4, 2);
    dg.lineStyle(2.5, directive.accent, 1);
    dg.strokeRoundedRect(24, directiveY, CANVAS_WIDTH - 48, 46, 8);
    dg.fillStyle(directive.accent, 1);
    dg.fillRoundedRect(32, directiveY + 8, 30, 30, 7);
    this.add.text(47, directiveY + 23, directiveIcon, {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(72, directiveY + 12, '전투 지휘', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(72, directiveY + 25, directive.title, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(72, directiveY + 37, directive.body, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: 218 },
    }).setOrigin(0, 0.5);

    const readyRatio = Math.max(0, Math.min(1, directive.readiness / 100));
    const readinessText = formatDefenseReadinessPercent(directive.readiness);
    const directiveChip = getDefenseDirectiveDisplayChip(directive);
    dg.fillStyle(CASUAL.PANEL_SOFT, 1);
    dg.fillRoundedRect(CANVAS_WIDTH - 88, directiveY + 10, 50, 20, 6);
    dg.lineStyle(1.5, directive.accent, 0.9);
    dg.strokeRoundedRect(CANVAS_WIDTH - 88, directiveY + 10, 50, 20, 6);
    this.add.text(CANVAS_WIDTH - 63, directiveY + 20, `${directiveChip} ${readinessText}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: `#${directive.accent.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    dg.fillStyle(CASUAL.EDGE_SOFT, 0.45);
    dg.fillRoundedRect(CANVAS_WIDTH - 88, directiveY + 34, 50, 4, 2);
    if (readyRatio > 0) {
      dg.fillStyle(directive.accent, 1);
      dg.fillRoundedRect(CANVAS_WIDTH - 88, directiveY + 34, Math.max(3, 50 * readyRatio), 4, 2);
    }

    const statY = dY + 98;
    const drawStatPill = (x: number, label: string, value: string, color: number): void => {
      const w = 66, h = 24;
      dg.fillStyle(CASUAL.PANEL, 1);
      dg.fillRoundedRect(x, statY, w, h, 7);
      dg.fillStyle(0xffffff, 0.4);
      dg.fillRoundedRect(x + 3, statY + 3, w - 6, 3, 2);
      dg.lineStyle(2, color, 0.9);
      dg.strokeRoundedRect(x, statY, w, h, 7);
      this.add.text(x + 8, statY + 7, label, {
        fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.add.text(x + w - 8, statY + 15, value, {
        fontFamily: 'monospace', fontSize: '10px', color: `#${color.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    };

    drawStatPill(24,  '방',   `${defenseTotals.builtRooms}/${defenseTotals.unlockedSlots}`, CASUAL.RED_DK);
    drawStatPill(94,  '수호', `${defenseTotals.monsterCount}`, CASUAL.GOLD_DK);
    drawStatPill(164, '장비', `${defenseTotals.equipmentCount}`, CASUAL.GOLD_DK);
    drawStatPill(234, '함정', `${defenseTotals.trapCount}`, CASUAL.GREEN_DK);
    drawStatPill(304, 'DEF',  `${defenseTotals.totalPower}`, CASUAL.PURPLE_DK);

    const roomByIndex = new Map(defenseRooms.map(room => [room.index, room]));
    const railY = dY + 134;
    const cellW = 29, cellH = 28, cellGap = 5;
    const railX = Math.floor((CANVAS_WIDTH - (9 * cellW + 8 * cellGap)) / 2);
    dg.fillStyle(CASUAL.PANEL, 1);
    dg.fillRoundedRect(24, railY, CANVAS_WIDTH - 48, 58, 10);
    dg.fillStyle(0xffffff, 0.4);
    dg.fillRoundedRect(28, railY + 4, CANVAS_WIDTH - 56, 4, 2);
    dg.lineStyle(2, CASUAL.EDGE_SOFT, 0.8);
    dg.strokeRoundedRect(24, railY, CANVAS_WIDTH - 48, 58, 10);
    this.add.text(32, railY + 13, '침략 루트 작전판', {
      fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(CANVAS_WIDTH - 32, railY + 13, `권장 DEF ${directive.pressure || '-'}`, {
      fontFamily: 'monospace', fontSize: '8px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.add.text(railX, railY + 52, '입구', {
      fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(railX + 9 * cellW + 8 * cellGap, railY + 52, '던전 심장', {
      fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    dg.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
    dg.lineBetween(railX + cellW / 2, railY + 34, railX + 8 * (cellW + cellGap) + cellW / 2, railY + 34);
    for (let i = 0; i < 9; i++) {
      const slot = gs.dungeonSlots?.[i];
      const meta = getRoomTypeMeta(slot?.roomType);
      const style = ROOM_STYLE[slot?.roomType ?? 'empty'];
      const queueItem = actionBySlot.get(i);
      const unlocked = i < defenseTotals.unlockedSlots;
      const built = unlocked && !!slot?.roomType;
      const room = roomByIndex.get(i);
      const isActionTarget = directive.actionSlotIdx === i && Boolean(directive.actionLabel);
      const cx = railX + i * (cellW + cellGap);
      const cy = railY + 21;
      // built → dark content tile w/ bright border; empty unlocked → cream-rimmed; locked → dim
      dg.fillStyle(built ? style.bg : unlocked ? CASUAL.PANEL_SOFT : 0x121f2c, 1);
      dg.fillRoundedRect(cx, cy, cellW, cellH, 6);
      if (built) {
        dg.fillStyle(0xffffff, 0.05);
        dg.fillRoundedRect(cx + 3, cy + 4, cellW - 6, 8, 3);
        dg.fillStyle(style.accent, 0.16);
        dg.fillRoundedRect(cx + 4, cy + cellH - 7, cellW - 8, 3, 2);
      } else if (unlocked) {
        dg.fillStyle(0xffffff, 0.45);
        dg.fillRoundedRect(cx + 3, cy + 3, cellW - 6, 4, 2);
      }
      dg.lineStyle(built ? 1.5 : 2, built ? style.accent : unlocked ? CASUAL.EDGE : 0x223344, built ? 0.85 : unlocked ? 0.9 : 0.48);
      dg.strokeRoundedRect(cx, cy, cellW, cellH, 6);
      this.add.text(cx + cellW / 2, cy + 12, built ? meta.icon : String(i + 1), {
        fontFamily: 'sans-serif',
        fontSize: built ? '12px' : '8px',
        color: built ? style.text : unlocked ? CASUAL_CSS.INK : '#526677',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      if (built && room) {
        const roomTarget = Math.max(35, Math.round((directive.pressure || defenseTotals.totalPower || 1) / Math.max(1, defenseTotals.builtRooms)));
        const roomRatio = Math.max(0, Math.min(1, room.power / roomTarget));
        dg.fillStyle(0x140c03, 0.85);
        dg.fillRoundedRect(cx + 4, cy + cellH - 5, cellW - 8, 3, 2);
        dg.fillStyle(roomRatio >= 1 ? ACCENT.mint : roomRatio >= 0.7 ? ACCENT.gold : ACCENT.coral, 0.9);
        dg.fillRoundedRect(cx + 4, cy + cellH - 5, Math.max(3, (cellW - 8) * roomRatio), 3, 2);
      }
      if (queueItem) {
        drawDefenseRouteActionRing(this, cx, cy, cellW, cellH, queueItem.action.accent, queueItem.rank);
        drawDefenseQueuePip(this, cx + cellW - 10, cy - 4, queueItem.action, queueItem.rank);
      } else if (isActionTarget) {
        drawDefenseRouteActionRing(this, cx, cy, cellW, cellH, directive.accent, 1);
      }
    }

    const showRoomInfo = (room: DefenseRoomSummary): void => {
      this.children.getByName('defenseRoomInfoOv')?.destroy();
      this.children.getByName('defenseRoomInfoDim')?.destroy();

      const dim = this.add.graphics().setName('defenseRoomInfoDim').setDepth(198);
      dim.fillStyle(0x000000, 0.46);
      dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const ov = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
        .setName('defenseRoomInfoOv').setDepth(200);
      const monsterLines = room.monsterIds.length > 0
        ? room.monsterIds.slice(0, 4).map(id => {
            const owned = getOwnedMonster(gs, id);
            return `${getMonsterDisplayEmoji(id)} ${getMonsterDisplayName(id)}  Lv.${owned?.level ?? 1}`;
          })
        : ['수호자 미배치'];
      const trapLines = room.trapIds.length > 0
        ? room.trapIds.slice(0, 4).map(id => {
            const trap = getTrapDisplay(id);
            return `${trap.emoji} ${trap.name}`;
          })
        : ['함정 미배치'];
      const equipmentLines = room.equipment.length > 0
        ? room.equipment.slice(0, 3).map(equipment => `${equipment.icon} ${equipment.name}  ${equipment.effect}`)
        : ['장비 미장착'];
      const popH = 232 + Math.max(monsterLines.length, trapLines.length) * 16 + Math.min(3, equipmentLines.length) * 14;
      let dismissZone: Phaser.GameObjects.Zone | null = null;
      const dismiss = (): void => {
        ov.destroy();
        dim.destroy();
        dismissZone?.destroy();
      };
      const addModalButton = (
        x: number,
        y: number,
        w: number,
        label: string,
        accent: number,
        onPress: () => void,
      ): void => {
        const h = 30;
        const btnBg = this.add.graphics();
        const draw = (fillAlpha = 0.90, borderAlpha = 0.76): void => {
          btnBg.clear();
          btnBg.fillStyle(0x140c03, 0.34);
          btnBg.fillRoundedRect(x, y + 3, w, h, 7);
          btnBg.fillStyle(accent, fillAlpha);
          btnBg.fillRoundedRect(x, y, w, h, 7);
          btnBg.lineStyle(1, 0xffffff, borderAlpha);
          btnBg.strokeRoundedRect(x, y, w, h, 7);
          btnBg.lineStyle(1, 0xffffff, 0.22);
          btnBg.lineBetween(x + 10, y + 6, x + w - 10, y + 6);
        };
        draw();
        ov.add(btnBg);
        const btnText = this.add.text(x + w / 2, y + h / 2, label, {
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#fff8d8',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        ov.add(btnText);
        const btnZone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
        btnZone.on('pointerover', () => draw(1, 0.96));
        btnZone.on('pointerout', () => draw());
        btnZone.once('pointerdown', () => {
          this.tweens.add({
            targets: [btnBg, btnText],
            alpha: 0.72,
            duration: 60,
            yoyo: true,
            onComplete: onPress,
          });
        });
        ov.add(btnZone);
      };
      const ovBg = this.add.graphics();
      ovBg.fillStyle(0x221504, 0.97);
      ovBg.fillRoundedRect(-142, -popH / 2, 284, popH, 8);
      ovBg.lineStyle(1.5, room.style.accent, 0.86);
      ovBg.strokeRoundedRect(-142, -popH / 2, 284, popH, 8);
      ovBg.fillStyle(room.style.accent, 0.14);
      ovBg.fillRoundedRect(-128, -popH / 2 + 12, 256, 34, 6);
      ov.add(ovBg);

      ov.add(this.add.text(0, -popH / 2 + 29, `#${room.index + 1} ${room.typeIcon} ${room.typeName}`, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: CASUAL_CSS.CREAM, fontStyle: 'bold',
      }).setOrigin(0.5));
      ov.add(this.add.text(0, -popH / 2 + 58, `Lv.${room.slot.roomLevel}  HP ${room.slot.hp}/${room.slot.maxHp}  DEF ${room.power}`, {
        fontFamily: 'monospace', fontSize: '10px', color: room.style.text,
      }).setOrigin(0.5));

      ov.add(this.add.text(0, -popH / 2 + 73, `장비 ${room.equipment.length}/${room.monsterIds.length}  DEF +${room.equipmentPower}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: room.equipment.length > 0 ? '#ffdf6e' : '#907a58',
      }).setOrigin(0.5));

      ov.add(this.add.text(-118, -popH / 2 + 96, `수호자 ${room.monsterIds.length}/${room.capacity.monsters}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#c8921a', fontStyle: 'bold',
      }));
      ov.add(this.add.text(18, -popH / 2 + 96, `함정 ${room.trapIds.length}/${room.capacity.traps}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#62c66e', fontStyle: 'bold',
      }));
      monsterLines.forEach((line, i) => {
        ov.add(this.add.text(-118, -popH / 2 + 116 + i * 16, line, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#fff0c8',
        }));
      });
      trapLines.forEach((line, i) => {
        ov.add(this.add.text(18, -popH / 2 + 116 + i * 16, line, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#b9ffd8',
        }));
      });

      const equipmentY = -popH / 2 + 128 + Math.max(monsterLines.length, trapLines.length) * 16;
      ov.add(this.add.text(-118, equipmentY, '장비 효과', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#ffdf6e',
        fontStyle: 'bold',
      }));
      equipmentLines.forEach((line, i) => {
        ov.add(this.add.text(-118, equipmentY + 16 + i * 14, line, {
          fontFamily: 'sans-serif',
          fontSize: '8px',
          color: room.equipment.length > 0 ? '#ffe6a3' : '#907a58',
        }));
      });

      addModalButton(-118, popH / 2 - 44, 112, '방 편집', room.style.accent, () => {
        dismiss();
        this.returnToDungeonRoom(room.index);
      });
      addModalButton(8, popH / 2 - 44, 110, '닫기', 0x395168, dismiss);

      this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 180 });

      dismissZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        .setOrigin(0).setInteractive().setDepth(199);
      this.time.delayedCall(80, () => {
        dismissZone?.once('pointerdown', dismiss);
      });
    };

    for (let i = 0; i < 9; i++) {
      const queueItem = actionBySlot.get(i);
      const unlocked = i < defenseTotals.unlockedSlots;
      const room = roomByIndex.get(i);
      if (!unlocked) continue;
      const cx = railX + i * (cellW + cellGap);
      const cy = railY + 21;
      const routeHitZone = this.add.zone(cx - 2, cy - 5, cellW + 4, cellH + 10)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      routeHitZone.on('pointerdown', () => {
        if (queueItem || !room) {
          this.returnToDungeonRoom(i);
          return;
        }
        showRoomInfo(room);
      });
    }

    const cardW = 166, cardH = 64, cardGap = 10;
    const cardsY = dY + 206;
    const emptyEntries = Array.from({ length: defenseTotals.unlockedSlots }, (_, index) => index)
      .filter(index => !roomByIndex.has(index));
    const cardEntries = [
      ...defenseRooms.map(room => ({ index: room.index, room })),
      ...emptyEntries.map(index => ({ index, room: undefined })),
    ].slice(0, 4);

    cardEntries.forEach(({ index, room }, pos) => {
      const cx = 24 + (pos % 2) * (cardW + cardGap);
      const cy = cardsY + Math.floor(pos / 2) * (cardH + 6);
      const queueItem = actionBySlot.get(index);
      const isActionTarget = directive.actionSlotIdx === index && Boolean(directive.actionLabel);

      if (!room) {
        const slotAccent = isActionTarget ? directive.accent : CASUAL.EDGE;
        // cream-rimmed empty slot
        dg.fillStyle(CASUAL.PANEL_SOFT, 1);
        dg.fillRoundedRect(cx, cy, cardW, cardH, 8);
        dg.fillStyle(0xffffff, 0.4);
        dg.fillRoundedRect(cx + 5, cy + 4, cardW - 10, 5, 3);
        // inner glyph well (cream sub-tile)
        dg.fillStyle(CASUAL.PANEL, 1);
        dg.fillRoundedRect(cx + 6, cy + 8, 30, cardH - 16, 6);
        dg.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
        dg.strokeRoundedRect(cx + 6, cy + 8, 30, cardH - 16, 6);
        dg.lineStyle(isActionTarget ? 3 : 2.5, slotAccent, 1);
        dg.strokeRoundedRect(cx, cy, cardW, cardH, 8);
        this.add.text(cx + 21, cy + 32, '+', {
          fontFamily: 'sans-serif', fontSize: '22px', color: CASUAL_CSS.INK, fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(cx + 42, cy + 15, `#${index + 1} 미설계`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK, fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.add.text(cx + 42, cy + 30, '방 타입 선택 필요', {
          fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.add.text(cx + 42, cy + 45, 'M -/- · T -/-', {
          fontFamily: 'monospace', fontSize: '8px', color: CASUAL_CSS.INK_SOFT,
        }).setOrigin(0, 0.5);
        dg.fillStyle(CASUAL.GOLD, 1);
        dg.fillRoundedRect(cx + cardW - 54, cy + 22, 44, 17, 6);
        dg.lineStyle(1.5, CASUAL.GOLD_DK, 1);
        dg.strokeRoundedRect(cx + cardW - 54, cy + 22, 44, 17, 6);
        this.add.text(cx + cardW - 32, cy + 30.5, '바로 설계', {
          fontFamily: 'sans-serif', fontSize: '7px', color: CASUAL_CSS.INK, fontStyle: 'bold',
        }).setOrigin(0.5);
        const emptyHitZone = this.add.zone(cx, cy, cardW, cardH)
          .setOrigin(0).setInteractive({ useHandCursor: true });
        emptyHitZone.on('pointerdown', () => this.returnToDungeonRoom(index));
        if (isActionTarget) {
          drawDefenseActionTargetBadge(this, cx, cy, cardW, cardH, directive, queueItem
            ? `${queueItem.rank} ${getDefenseQueueBadgeLabel(queueItem.action)}`
            : undefined);
        } else if (queueItem) {
          drawDefenseQueueBadge(this, cx + cardW - 8, cy + 5, queueItem.action, queueItem.rank);
        }
        return;
      }

      const roomTarget = Math.max(35, Math.round((directive.pressure || defenseTotals.totalPower || 1) / Math.max(1, defenseTotals.builtRooms)));
      const cardRatio = Math.max(0, Math.min(1, room.power / roomTarget));

      dg.fillStyle(room.style.bg, 1);
      dg.fillRoundedRect(cx, cy, cardW, cardH, 6);
      drawDefenseRoomCardShell(
        dg,
        cx,
        cy,
        cardW,
        cardH,
        isActionTarget ? directive.accent : room.style.accent,
        cardRatio,
        isActionTarget || Boolean(queueItem),
      );
      dg.fillStyle(0x1f1305, 0.58);
      dg.fillRoundedRect(cx + 6, cy + 9, 31, cardH - 18, 6);
      dg.fillStyle(0xffffff, 0.06);
      dg.fillRoundedRect(cx + 42, cy + 10, cardW - 94, 12, 4);
      dg.fillStyle(room.style.accent, 0.1);
      dg.fillRoundedRect(cx + 42, cy + cardH - 14, cardW - 96, 5, 3);
      dg.lineStyle(1.2, room.style.accent, 0.62);
      dg.strokeRoundedRect(cx, cy, cardW, cardH, 6);
      dg.fillStyle(room.style.accent, 0.72);
      dg.fillRoundedRect(cx + 7, cy + 5, cardW - 14, 3, 2);

      const primaryMonsterId = room.monsterIds[0];
      if (primaryMonsterId) {
        addMonsterPortrait(this, null, cx + 21, cy + 33, primaryMonsterId, {
          size: 30,
          frameColor: room.style.accent,
          glowColor: room.style.accent,
          bgColor: 0x12283b,
          equippedSkins: gs.equippedSkins,
        });
      } else {
        this.add.text(cx + 21, cy + 33, room.typeIcon, {
          fontFamily: 'sans-serif', fontSize: '20px',
        }).setOrigin(0.5);
      }

      this.add.text(cx + 42, cy + 15, `#${room.index + 1} ${shortenLabel(room.typeName, 6)}`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#f0e6c8', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.add.text(cx + 42, cy + 30, `Lv.${room.slot.roomLevel}  HP ${room.slot.hp}/${room.slot.maxHp}`, {
        fontFamily: 'monospace', fontSize: '8px', color: room.style.text,
      }).setOrigin(0, 0.5);
      this.add.text(cx + 42, cy + 45, `M${room.monsterIds.length}/${room.capacity.monsters} E${room.equipment.length} T${room.trapIds.length}/${room.capacity.traps}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#bad9e8',
      }).setOrigin(0, 0.5);

      if (room.equipment.length > 0) {
        dg.fillStyle(ACCENT.gold, 0.2);
        dg.fillRoundedRect(cx + 7, cy + cardH - 16, 30, 11, 4);
        dg.lineStyle(1, ACCENT.gold, 0.5);
        dg.strokeRoundedRect(cx + 7, cy + cardH - 16, 30, 11, 4);
        this.add.text(cx + 22, cy + cardH - 10.5, `⚙${room.equipment.length}`, {
          fontFamily: 'Georgia, serif',
          fontSize: '7px',
          color: '#ffe6a3',
          fontStyle: 'bold',
        }).setOrigin(0.5);
      }

      const trap = room.trapIds[0] ? getTrapDisplay(room.trapIds[0]) : null;
      dg.fillStyle(0x221504, 0.78);
      dg.fillRoundedRect(cx + cardW - 47, cy + 13, 37, 16, 4);
      dg.lineStyle(1, trap ? 0x5fb854 : 0x61778d, trap ? 0.7 : 0.42);
      dg.strokeRoundedRect(cx + cardW - 47, cy + 13, 37, 16, 4);
      this.add.text(cx + cardW - 28.5, cy + 21, trap ? trap.emoji : 'T -', {
        fontFamily: 'sans-serif', fontSize: trap ? '10px' : '8px', color: trap ? '#b9ffd8' : '#9db5c5',
      }).setOrigin(0.5);

      dg.fillStyle(room.style.accent, 0.18);
      dg.fillRoundedRect(cx + cardW - 52, cy + 40, 42, 15, 4);
      this.add.text(cx + cardW - 31, cy + 47.5, `DEF ${room.power}`, {
        fontFamily: 'monospace', fontSize: '7px', color: room.style.text, fontStyle: 'bold',
      }).setOrigin(0.5);

      dg.fillStyle(0x140c03, 0.82);
      dg.fillRoundedRect(cx + 42, cy + cardH - 8, cardW - 98, 4, 2);
      dg.fillStyle(cardRatio >= 1 ? ACCENT.mint : cardRatio >= 0.7 ? ACCENT.gold : ACCENT.coral, 0.95);
      dg.fillRoundedRect(cx + 42, cy + cardH - 8, Math.max(4, (cardW - 98) * cardRatio), 4, 2);

      if (isActionTarget) {
        drawDefenseActionTargetBadge(this, cx, cy, cardW, cardH, directive, queueItem
          ? `${queueItem.rank} ${getDefenseQueueBadgeLabel(queueItem.action)}`
          : undefined);
      } else if (queueItem) {
        drawDefenseQueueBadge(this, cx + cardW - 8, cy + 5, queueItem.action, queueItem.rank);
      }

      const hitZone = this.add.zone(cx, cy, cardW, cardH)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => {
        if (queueItem) {
          this.returnToDungeonRoom(index);
          return;
        }
        showRoomInfo(room);
      });
    });

    // ─ SYNERGY: Active tribe combos from deployed dungeon monsters ──────────
    const tribeCount: Record<string, number> = {};
    defenseRooms.flatMap(room => room.monsterIds).forEach(monsterId => {
      const def = getMonsterDef(monsterId);
      const tribe = def?.tribe;
      if (tribe) tribeCount[tribe] = (tribeCount[tribe] ?? 0) + 1;
    });
    const activeSynergies = Object.entries(tribeCount).filter(([, c]) => c >= 2);
    const synY = dY + dH + 8;
    if (activeSynergies.length > 0) {
      let chipX = 14;
      activeSynergies.forEach(([tribe, count]) => {
        const label = `✨ ${TRIBE_KO[tribe] ?? tribe} ×${count}`;
        const chip = this.add.text(chipX, synY, label, {
          fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK,
          backgroundColor: '#ffc63a', padding: { x: 8, y: 4 },
        });
        chip.setInteractive({ useHandCursor: true });
        chip.on('pointerdown', () => {
          this.children.getByName('synTooltip')?.destroy();

          const syn = TRIBE_SYNERGIES.find(s => s.tribe === tribe);
          if (!syn) return;

          const activeTier = [...syn.tiers].reverse().find(t => t.count <= count);
          const nextTiers  = syn.tiers.filter(t => t.count > count);

          const lines: string[] = [];
          if (activeTier) {
            lines.push(`✨ ${activeTier.name} (×${activeTier.count})`);
            lines.push(activeTier.desc);
          }
          if (nextTiers.length > 0) lines.push('──────────────');
          nextTiers.forEach(t => lines.push(`ⓘ ×${t.count}: ${t.name} — ${t.desc}`));

          const popH = 24 + lines.length * 18 + 10;
          const popW = 240;
          const ov = this.add.container(CANVAS_WIDTH / 2, synY - 10)
            .setName('synTooltip').setDepth(200);

          const bg = this.add.graphics();
          bg.fillStyle(0x221504, 0.97);
          bg.fillRoundedRect(-popW / 2, -popH, popW, popH, 6);
          bg.lineStyle(1, ACCENT.gold, 0.7);
          bg.strokeRoundedRect(-popW / 2, -popH, popW, popH, 6);
          ov.add(bg);

          lines.forEach((line, i) => {
            const color = i === 0 ? '#ffdf6e' : line.startsWith('ⓘ') ? '#907a58' : '#f0e6c8';
            const fs = i === 0 ? '12px' : '10px';
            ov.add(this.add.text(0, -popH + 14 + i * 18, line, {
              fontFamily: 'sans-serif', fontSize: fs, color,
            }).setOrigin(0.5, 0));
          });

          this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 150 });

          const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            .setOrigin(0).setInteractive().setDepth(199);
          closeZone.once('pointerdown', () => { ov.destroy(); closeZone.destroy(); });
        });
        chipX += chip.width + 8;
      });
    } else {
      this.add.text(14, synY + 2, '시너지 없음', {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0, 0);
    }

    // ─ SKILLS: Owned active skills — tap for cooldown/desc details ──────────
    const ownedSkills = (gs.ownedActiveSkills ?? [])
      .map(id => ACTIVE_SKILLS.find(s => s.id === id))
      .filter((s): s is ActiveSkill => s != null);
    if (ownedSkills.length > 0) {
      const skillChip = this.add.text(CANVAS_WIDTH - 14, synY, `🎯 스킬 ×${ownedSkills.length}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.WHITE,
        backgroundColor: '#2f8f3a', padding: { x: 8, y: 4 },
      }).setOrigin(1, 0);
      skillChip.setInteractive({ useHandCursor: true });
      skillChip.on('pointerdown', () => {
        this.children.getByName('skillTooltip')?.destroy();

        const lines: Array<{ text: string; kind: 'title' | 'name' | 'desc' }> = [
          { text: '🎯 보유 액티브 스킬', kind: 'title' },
        ];
        ownedSkills.forEach(s => {
          lines.push({ text: `${s.icon} ${s.name} · 쿨다운 ${s.cooldown}s`, kind: 'name' });
          lines.push({ text: s.desc, kind: 'desc' });
        });

        const popH = 14 + lines.length * 17 + 10;
        const popW = 260;
        const ov = this.add.container(CANVAS_WIDTH / 2, synY - 10)
          .setName('skillTooltip').setDepth(200);

        const bg = this.add.graphics();
        bg.fillStyle(0x221504, 0.97);
        bg.fillRoundedRect(-popW / 2, -popH, popW, popH, 6);
        bg.lineStyle(1, ACCENT.sky, 0.7);
        bg.strokeRoundedRect(-popW / 2, -popH, popW, popH, 6);
        ov.add(bg);

        lines.forEach((line, i) => {
          const color = line.kind === 'title' ? '#e8c468'
            : line.kind === 'name' ? '#f0e6c8' : '#907a58';
          const fs = line.kind === 'title' ? '12px' : '10px';
          ov.add(this.add.text(0, -popH + 12 + i * 17, line.text, {
            fontFamily: 'sans-serif', fontSize: fs, color,
            fontStyle: line.kind === 'desc' ? 'normal' : 'bold',
          }).setOrigin(0.5, 0));
        });

        this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 150 });

        const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
          .setOrigin(0).setInteractive().setDepth(199);
        closeZone.once('pointerdown', () => { ov.destroy(); closeZone.destroy(); });
      });
    }

    // ─ BOTTOM: Battle Command Frame ──────────────────────────────────────────
    const commandY = dY + dH + 30;
    const commandH = 72;
    const startY = commandY + 22;
    const commandStatus =
      directive.severity === 'ready' ? '출격 가능' :
      directive.severity === 'warning' ? '보강 권장' : '위험';
    const pressureText = directive.pressure > 0
      ? `${defenseTotals.totalPower}/${directive.pressure}`
      : `${defenseTotals.totalPower}`;

    const commandBg = this.add.graphics();
    // chunky cream command tray
    commandBg.fillStyle(CASUAL.SHADOW, 0.22);
    commandBg.fillRoundedRect(10, commandY + 4, CANVAS_WIDTH - 20, commandH, 14);
    commandBg.fillStyle(CASUAL.PANEL, 1);
    commandBg.fillRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 14);
    commandBg.fillStyle(0xffffff, 0.5);
    commandBg.fillRoundedRect(16, commandY + 5, CANVAS_WIDTH - 32, 5, 3);
    commandBg.lineStyle(3, CASUAL.EDGE, 1);
    commandBg.strokeRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 14);
    // status strip (soft cream sub-band)
    commandBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    commandBg.fillRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 15, 7);
    commandBg.lineStyle(1.5, directive.accent, 0.85);
    commandBg.strokeRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 15, 7);

    this.add.text(24, commandY + 10, '출격 명령', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);

    this.add.text(92, commandY + 10, commandStatus, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: directive.severity === 'ready' ? CASUAL_CSS.GREEN :
        directive.severity === 'warning' ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
    }).setOrigin(0, 0.5);

    this.add.text(CANVAS_WIDTH - 24, commandY + 10, `DEF ${pressureText} · 준비 ${readinessText}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(1, 0.5);

    if (directive.actionLabel) {
      // secondary "go fix it" → cream pill
      addPrimaryActionButton(this, {
        x: 14,
        y: startY,
        w: 124,
        h: 48,
        label: getDefenseActionButtonLabel(directive),
        fontSize: '13px',
        fillColor: CASUAL.PANEL,
        hoverFillColor: CASUAL.PANEL_SOFT,
        borderColor: CASUAL.EDGE,
        hoverBorderColor: CASUAL.GOLD_DK,
        textColor: CASUAL_CSS.INK,
        onPress: () => {
          if (directive.actionSlotIdx === undefined) {
            this.scene.start('DungeonHomeScene');
            return;
          }
          this.returnToDungeonRoom(directive.actionSlotIdx);
        },
      });
      // primary "방어 시작" → bright candy button (GREEN normal, RED if risky)
      addPrimaryActionButton(this, {
        x: 148,
        y: startY,
        w: 228,
        h: 48,
        label: '🛡️  방어 시작',
        fontSize: '15px',
        fillColor: directive.severity === 'danger' ? CASUAL.RED : CASUAL.GREEN,
        hoverFillColor: directive.severity === 'danger' ? 0xff7a64 : 0x6fdc70,
        borderColor: directive.severity === 'danger' ? CASUAL.RED_DK : CASUAL.GREEN_DK,
        hoverBorderColor: directive.severity === 'danger' ? CASUAL.RED_DK : CASUAL.GREEN_DK,
        textColor: CASUAL_CSS.WHITE,
        once: true,
        onPress: () => this.launchBattle(cfg, questId),
      });
    } else {
      // primary "방어 시작!" → bright GREEN candy button
      addPrimaryActionButton(this, {
        x: CANVAS_WIDTH / 2 - 146,
        y: startY,
        w: 292,
        h: 48,
        label: '🛡️   방어 시작!',
        fillColor: CASUAL.GREEN,
        hoverFillColor: 0x6fdc70,
        borderColor: CASUAL.GREEN_DK,
        hoverBorderColor: CASUAL.GREEN_DK,
        textColor: CASUAL_CSS.WHITE,
        once: true,
        onPress: () => this.launchBattle(cfg, questId),
      });
    }

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private returnToDungeonRoom(slotIdx: number): void {
    this.registry.set('preBattleEditReturn', true);
    this.registry.set('focusRoomSlotIdx', slotIdx);
    this.scene.start('DungeonHomeScene');
  }

  private launchBattle(cfg: InvasionConfig | undefined, questId: string | undefined): void {
    if (!cfg) return;

    // Convert InvasionConfig → StageConfig format that DungeonScene understands
    const waveSpecs = cfg.waves.map(w => ({
      wave:        w.waveNumber,
      clearReward: 120,
      invaders:    w.invaders.map(inv => ({
        // Use explicit mapping first; if missing, pass through as-is (Ch8+ types match InvaderType directly)
        type:       (INVASION_TYPE_MAP[inv.type] ?? inv.type) as InvaderType,
        count:      inv.count,
        spawnDelay: 2200,
      })),
    }));

    this.registry.set('stageConfig', {
      id:         999,
      chapter:    1,
      koreanName: cfg.name,
      dungeonHp:  800,
      startGold:  400,
      waves:      waveSpecs,
    });
    this.registry.set('returnTo',  'DungeonHomeScene');
    this.registry.set('questId',   questId ?? '');
    this.registry.remove('invasionConfig');  // don't re-trigger on restart

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene');
    });
  }
}
