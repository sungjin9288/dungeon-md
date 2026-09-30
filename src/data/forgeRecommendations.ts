// ─── Forge Recommendations ────────────────────────────────────────────────────
// ForgeScene에서 분리한 순수 추천 로직 — 설계도별 최적 장착 대상 산정.
// 씬 상태(focusMonsterId 등)는 인자로 전달받아 엔진 무관·단위 테스트 가능.

import { resolveOwnedMonsterProfile, type OwnedMonsterProfile } from './monsters';
import { getMonsterAtk, getEquipmentStats, type EquipmentStats, type OwnedMonster } from './barracks';
import { BLUEPRINT_DEFS, MATERIAL_DEFS, forgeRarityHex, type BlueprintDef } from './fusion';
import { canCraftBlueprint } from './forgeTransactions';
import {
  projectRoomReinforcement,
  type RoomReinforcementProjection,
} from './reinforcementRecommendations';
import {
  getRoomSlotCapacity, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState, type RoomSlotType,
} from './wisdom';

export type ForgeMonsterDef = OwnedMonsterProfile;

export interface ForgeRecommendation {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly monsterEmoji: string;
  readonly monsterLevel: number;
  readonly roomLabel: string;
  readonly roomContextLabel: string;
  readonly targetLine: string;
  /** Numeric room power is available only for an actual assigned room. */
  readonly powerDelta: number | null;
  readonly equipmentImprovement: number;
  readonly improvementLabel: string;
  readonly room: RoomReinforcementProjection;
  readonly accent: number;
  readonly kind: 'focus' | 'deployed' | 'open-room' | 'bench';
}

export interface ForgeMaterialProjection {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly have: number;
  readonly need: number;
  readonly missing: number;
}

export interface ForgeBlueprintProjection {
  readonly blueprint: BlueprintDef;
  readonly recommendation: ForgeRecommendation | null;
  readonly craftable: boolean;
  readonly materials: readonly ForgeMaterialProjection[];
  readonly materialHave: number;
  readonly materialNeed: number;
  readonly materialMissing: number;
  readonly whyNow: string;
  readonly priority: number;
}

export interface ForgeFocusContext {
  readonly monsterId:   string | null;
  readonly sourceLabel: string | null;
}

export function getForgeRarityHex(rarity: number): number {
  return forgeRarityHex(rarity);
}

export function getBlueprintRecommendation(
  gs: GameState,
  bp: BlueprintDef,
  focus: ForgeFocusContext = { monsterId: null, sourceLabel: null },
): ForgeRecommendation | null {
  const focusMonster = focus.monsterId
    ? gs.ownedMonsters.find(monster => (
      monster.id === focus.monsterId && resolveOwnedMonsterProfile(monster.id) !== null
    ))
    : null;
  if (focusMonster) {
    return buildBlueprintRecommendation(gs, bp, focusMonster, focus.sourceLabel, 'focus');
  }

  const ranked = gs.ownedMonsters
    .filter(monster => resolveOwnedMonsterProfile(monster.id) !== null)
    .map((monster, rosterIndex) => {
      const recommendation = buildBlueprintRecommendation(gs, bp, monster, null);
      return {
        recommendation,
        score: scoreBlueprintRecommendation(bp, monster, recommendation),
        rosterIndex,
      };
    })
    .sort((a, b) => b.score - a.score || a.rosterIndex - b.rosterIndex);

  return ranked[0]?.recommendation ?? null;
}

export function buildBlueprintRecommendation(
  gs: GameState,
  bp: BlueprintDef,
  monster: OwnedMonster,
  _focusSourceLabel: string | null,
  forcedKind?: ForgeRecommendation['kind'],
): ForgeRecommendation {
  const def = getMonsterDefForOwned(monster.id);
  const room = projectRoomReinforcement(gs, monster.id, { equipment: bp.resultId });
  const assignedRoom = room.kind === 'assigned' ? findMonsterRoom(gs, monster.id) : null;
  const openRoom = room.kind === 'recommended' ? findOpenMonsterRoom(gs, monster) : null;
  const kind = forcedKind
    ?? (assignedRoom ? 'deployed' : openRoom ? 'open-room' : 'bench');
  const powerDelta = room.power?.delta ?? null;
  const equipmentImprovement = getBlueprintPowerDelta(monster, bp);
  const monsterName = def?.name ?? monster.id;
  const improvementLabel = equipmentImprovement > 0
    ? `장비 영향 +${equipmentImprovement}`
    : '개선 없음';
  const targetLine = room.power
    ? `${monsterName} · ${room.roomLabel} · 방 전력 ${room.power.before}→${room.power.after} 예상`
    : `${monsterName} · ${room.roomContextLabel} · 배치 전 방 전력 추정 없음`;

  return {
    monsterId: monster.id,
    monsterName,
    monsterEmoji: def?.emoji ?? '👹',
    monsterLevel: monster.level,
    roomLabel: room.roomLabel,
    roomContextLabel: room.roomContextLabel,
    targetLine,
    powerDelta,
    equipmentImprovement,
    improvementLabel,
    room,
    accent: def?.accentColor ?? getForgeRarityHex(bp.rarity),
    kind,
  };
}

export function scoreBlueprintRecommendation(
  bp: BlueprintDef,
  monster: OwnedMonster,
  recommendation: ForgeRecommendation,
): number {
  const def = getMonsterDefForOwned(monster.id);
  let score = recommendation.equipmentImprovement;
  score += Math.max(0, recommendation.powerDelta ?? 0);
  if (!monster.equipment) score += 36;
  if (recommendation.kind === 'focus') score += 80;
  if (recommendation.kind === 'deployed') score += 28;
  if (recommendation.kind === 'open-room') score += 12;
  score += Math.min(24, monster.level);
  score += getBlueprintMonsterFit(bp, def);
  return score;
}

export function getBlueprintMonsterFit(
  bp: BlueprintDef,
  def: ForgeMonsterDef | null,
): number {
  if (!def) return 0;
  if (bp.type === 'weapon') return def.baseDamage > 0 ? 18 : -10;
  if (bp.type === 'armor') return def.type === 'support' ? 16 : 10;
  if (bp.type === 'accessory') {
    return def.type === 'support' || def.type === 'magic' ? 18 : 8;
  }
  return 0;
}

export function getBlueprintPowerDelta(monster: OwnedMonster, bp: BlueprintDef): number {
  const baseAtk = getOwnedMonsterAttack(monster);
  const nextPower = calculateEquipmentImpactPower(baseAtk, getEquipmentStats(bp.resultId));
  const currentPower = calculateEquipmentImpactPower(baseAtk, getEquipmentStats(monster.equipment));
  return Math.max(0, nextPower - currentPower);
}

export function getForgeBlueprintProjection(
  gs: GameState,
  bp: BlueprintDef,
  focus: ForgeFocusContext = { monsterId: null, sourceLabel: null },
): ForgeBlueprintProjection {
  const materials = Object.entries(bp.materials).map(([id, need]) => {
    const have = Math.max(0, gs.materials?.[id] ?? 0);
    const material = MATERIAL_DEFS[id];
    return {
      id,
      name: material?.name ?? id,
      emoji: material?.emoji ?? '◇',
      have,
      need,
      missing: Math.max(0, need - have),
    };
  });
  const materialHave = materials.reduce((sum, material) => sum + Math.min(material.have, material.need), 0);
  const materialNeed = materials.reduce((sum, material) => sum + material.need, 0);
  const materialMissing = materials.reduce((sum, material) => sum + material.missing, 0);
  const craftable = canCraftBlueprint(bp, gs.materials ?? {});
  const recommendation = getBlueprintRecommendation(gs, bp, focus);
  const positiveAssignedGain = recommendation?.room.kind === 'assigned'
    ? Math.max(0, recommendation.powerDelta ?? 0)
    : 0;
  const improvement = recommendation?.equipmentImprovement ?? 0;
  const whyNow = craftable
    ? `${materialHave}/${materialNeed} 재료 충족 · ${recommendation?.improvementLabel ?? '장착 대상 없음'}`
    : `재료 부족 ${materialMissing} · 보유 ${materialHave}/${materialNeed}`;
  const priority = (craftable ? 100000 : 0)
    + positiveAssignedGain * 100
    + Math.max(0, improvement) * 10
    + bp.rarity;

  return {
    blueprint: bp,
    recommendation,
    craftable,
    materials,
    materialHave,
    materialNeed,
    materialMissing,
    whyNow,
    priority,
  };
}

export function rankForgeBlueprints(
  gs: GameState,
  focus: ForgeFocusContext = { monsterId: null, sourceLabel: null },
): ForgeBlueprintProjection[] {
  return (gs.blueprints ?? [])
    .map((blueprintId, registryIndex) => ({ blueprint: BLUEPRINT_DEFS[blueprintId], registryIndex }))
    .filter((entry): entry is { blueprint: BlueprintDef; registryIndex: number } => Boolean(entry.blueprint))
    .map(entry => ({ ...getForgeBlueprintProjection(gs, entry.blueprint, focus), registryIndex: entry.registryIndex }))
    .sort((a, b) => {
      const craftableDiff = Number(b.craftable) - Number(a.craftable);
      if (craftableDiff) return craftableDiff;
      const aAssignedGain = a.recommendation?.room.kind === 'assigned' ? Math.max(0, a.recommendation.powerDelta ?? 0) : 0;
      const bAssignedGain = b.recommendation?.room.kind === 'assigned' ? Math.max(0, b.recommendation.powerDelta ?? 0) : 0;
      if (bAssignedGain !== aAssignedGain) return bAssignedGain - aAssignedGain;
      const improvementDiff = (b.recommendation?.equipmentImprovement ?? 0) - (a.recommendation?.equipmentImprovement ?? 0);
      if (improvementDiff) return improvementDiff;
      if (b.blueprint.rarity !== a.blueprint.rarity) return b.blueprint.rarity - a.blueprint.rarity;
      return a.registryIndex - b.registryIndex;
    })
    .map(({ registryIndex: _registryIndex, ...projection }) => projection);
}

export interface ForgeTargetProjection {
  readonly monster: OwnedMonster;
  readonly recommendation: ForgeRecommendation | null;
  readonly bestBlueprint: ForgeBlueprintProjection | null;
  readonly priority: number;
  readonly rosterIndex: number;
}

export function rankForgeTargets(
  gs: GameState,
  focusMonsterId: string | null,
): ForgeTargetProjection[] {
  return gs.ownedMonsters
    .filter(monster => resolveOwnedMonsterProfile(monster.id) !== null)
    .map((monster, rosterIndex) => {
      const bestBlueprint = rankForgeBlueprints(gs, { monsterId: monster.id, sourceLabel: null })[0] ?? null;
      const recommendation = bestBlueprint?.recommendation ?? null;
      const assignedGain = recommendation?.room.kind === 'assigned' ? Math.max(0, recommendation.powerDelta ?? 0) : 0;
      const priority = (monster.id === focusMonsterId ? 1000000 : 0)
        + (bestBlueprint?.craftable ? 10000 : 0)
        + assignedGain * 100
        + Math.max(0, recommendation?.equipmentImprovement ?? 0) * 10
        + monster.level;
      return { monster, recommendation, bestBlueprint, priority, rosterIndex };
    })
    .sort((a, b) => b.priority - a.priority || a.rosterIndex - b.rosterIndex);
}

/**
 * Keeps target controls reachable when focus ranking moves the active monster
 * to the top: the visible rail advances one stable roster position at a time.
 */
export function cycleForgeTargetsByRoster(
  gs: GameState,
  focusMonsterId: string | null,
): ForgeTargetProjection[] {
  const rankedTargets = rankForgeTargets(gs, focusMonsterId);
  if (rankedTargets.length === 0) return [];

  const targetsById = new Map(rankedTargets.map(target => [target.monster.id, target]));
  const rosterTargets = gs.ownedMonsters
    .map(monster => targetsById.get(monster.id))
    .filter((target): target is ForgeTargetProjection => Boolean(target));
  const startMonsterId = focusMonsterId ?? rankedTargets[0].monster.id;
  const startIndex = Math.max(0, rosterTargets.findIndex(target => target.monster.id === startMonsterId));

  return rosterTargets.map((_, index) => rosterTargets[(startIndex + index) % rosterTargets.length]);
}

export function getOwnedMonsterAttack(monster: OwnedMonster): number {
  const def = getMonsterDefForOwned(monster.id);
  if (!def) return Math.max(8, monster.level * 3);
  return getMonsterAtk(def.baseDamage, monster.level, monster.spentSkills ?? {});
}

export function calculateEquipmentImpactPower(baseAtk: number, stats: EquipmentStats): number {
  let power = 0;
  if (stats.atkMult) power += Math.round(baseAtk * stats.atkMult);
  if (stats.roomHpBonus) power += Math.round(stats.roomHpBonus / 20);
  if (stats.stunBonus) power += Math.round(stats.stunBonus / 100);
  if (stats.freezeChance) power += Math.round(stats.freezeChance * 40);
  if (stats.executeChance) power += Math.round(stats.executeChance * 80);
  if (stats.procBonus) power += Math.round(stats.procBonus * 60);
  if (stats.skillCdMult && stats.skillCdMult < 1) power += Math.round((1 - stats.skillCdMult) * 40);
  if (stats.goldMult) power += Math.round(stats.goldMult * 25);
  if (stats.crystalMult) power += Math.round(stats.crystalMult * 30);
  return Math.max(0, power);
}

export function getMonsterDefForOwned(monsterId: string): ForgeMonsterDef | null {
  return resolveOwnedMonsterProfile(monsterId);
}

export function findMonsterRoom(
  gs: GameState,
  monsterId: string,
): { slot: DungeonSlot; index: number } | null {
  const index = (gs.dungeonSlots ?? []).findIndex(slot => (slot?.monsterIds ?? []).includes(monsterId));
  if (index < 0) return null;
  return { slot: gs.dungeonSlots[index], index };
}

export function findOpenMonsterRoom(
  gs: GameState,
  monster: OwnedMonster,
): { slot: DungeonSlot; index: number } | null {
  const preferred = getPreferredRoomSlotType(monster);
  const candidates = (gs.dungeonSlots ?? [])
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => Boolean(slot?.roomType) && hasOpenMonsterSlot(slot));
  return candidates.sort((a, b) => {
    const aPreferred = a.slot.roomType === preferred ? 1 : 0;
    const bPreferred = b.slot.roomType === preferred ? 1 : 0;
    return bPreferred - aPreferred;
  })[0] ?? null;
}

export function hasOpenMonsterSlot(slot: DungeonSlot): boolean {
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  return (slot.monsterIds ?? []).filter(Boolean).length < cap.monsters;
}

export function getPreferredRoomSlotType(monster: OwnedMonster): RoomSlotType {
  const def = getMonsterDefForOwned(monster.id);
  if (def?.type === 'magic') return 'magic';
  if (def?.type === 'support') return 'support';
  return 'combat';
}

export function getRoomTypeName(roomType?: RoomSlotType): string {
  return ROOM_SLOT_TYPE_DEFS.find(def => def.id === roomType)?.name ?? '미지정 방';
}
