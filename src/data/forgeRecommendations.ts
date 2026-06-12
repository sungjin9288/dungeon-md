// ─── Forge Recommendations ────────────────────────────────────────────────────
// ForgeScene에서 분리한 순수 추천 로직 — 설계도별 최적 장착 대상 산정.
// 씬 상태(focusMonsterId 등)는 인자로 전달받아 엔진 무관·단위 테스트 가능.

import { MONSTER_DEFS } from './monsters';
import { getMonsterAtk, getEquipmentStats, type EquipmentStats, type OwnedMonster } from './barracks';
import { RARITY_COLORS, type BlueprintDef } from './fusion';
import {
  getRoomSlotCapacity, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState, type RoomSlotType,
} from './wisdom';

export type ForgeMonsterDef = (typeof MONSTER_DEFS)[keyof typeof MONSTER_DEFS];

export interface ForgeRecommendation {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly monsterEmoji: string;
  readonly monsterLevel: number;
  readonly roomLabel: string;
  readonly targetLine: string;
  readonly powerDelta: number;
  readonly accent: number;
  readonly kind: 'focus' | 'deployed' | 'open-room' | 'bench';
}

export interface ForgeFocusContext {
  readonly monsterId:   string | null;
  readonly sourceLabel: string | null;
}

export function getForgeRarityHex(rarity: number): number {
  const color = RARITY_COLORS[rarity] ?? '#aaaaaa';
  return Number.parseInt(color.replace('#', ''), 16);
}

export function getBlueprintRecommendation(
  gs: GameState,
  bp: BlueprintDef,
  focus: ForgeFocusContext = { monsterId: null, sourceLabel: null },
): ForgeRecommendation | null {
  const focusMonster = focus.monsterId
    ? gs.ownedMonsters.find(monster => monster.id === focus.monsterId)
    : null;
  if (focusMonster) {
    return buildBlueprintRecommendation(gs, bp, focusMonster, focus.sourceLabel, 'focus');
  }

  const ranked = gs.ownedMonsters
    .map(monster => {
      const recommendation = buildBlueprintRecommendation(gs, bp, monster, null);
      return {
        recommendation,
        score: scoreBlueprintRecommendation(bp, monster, recommendation),
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.recommendation ?? null;
}

export function buildBlueprintRecommendation(
  gs: GameState,
  bp: BlueprintDef,
  monster: OwnedMonster,
  focusSourceLabel: string | null,
  forcedKind?: ForgeRecommendation['kind'],
): ForgeRecommendation {
  const def = getMonsterDefForOwned(monster.id);
  const assignedRoom = findMonsterRoom(gs, monster.id);
  const openRoom = assignedRoom ? null : findOpenMonsterRoom(gs, monster);
  const kind = forcedKind
    ?? (assignedRoom ? 'deployed' : openRoom ? 'open-room' : 'bench');
  const roomRef = assignedRoom ?? openRoom;
  const roomLabel = kind === 'focus' && focusSourceLabel
    ? focusSourceLabel
    : roomRef
      ? `방 #${roomRef.index + 1}`
      : '막사 대기';
  const roomTypeName = roomRef?.slot.roomType
    ? getRoomTypeName(roomRef.slot.roomType)
    : kind === 'bench'
      ? '배치 대기'
      : '방 보강';
  const powerDelta = getBlueprintPowerDelta(monster, bp);
  const monsterName = def?.name ?? monster.id;
  const targetLine = `${monsterName} · ${roomLabel} ${roomTypeName} 장착 시 방 전력 +${powerDelta} 예상`;

  return {
    monsterId: monster.id,
    monsterName,
    monsterEmoji: def?.emoji ?? '👹',
    monsterLevel: monster.level,
    roomLabel,
    targetLine,
    powerDelta,
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
  let score = recommendation.powerDelta;
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
  const exact = MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS];
  if (exact) return exact;
  const baseId = Object.keys(MONSTER_DEFS).find(
    id => monsterId === id || monsterId.startsWith(`${id}_`),
  ) as keyof typeof MONSTER_DEFS | undefined;
  return baseId ? MONSTER_DEFS[baseId] : null;
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
