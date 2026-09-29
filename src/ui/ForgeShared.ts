// ─── Forge Shared ─────────────────────────────────────────────────────────────
// 제작소 씬 공유 상수·타입·순수 헬퍼. 최하층 — 씬을 import하지 않는다 (순환 방지).

import {
  BLUEPRINT_DEFS, MATERIAL_DEFS, RARITY_COLORS,
  type BlueprintDef,
} from '../data/fusion';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { getEquipmentStats, EQUIPMENT_DEFS, type OwnedMonster } from '../data/barracks';
import {
  getMonsterDefForOwned, findMonsterRoom, findOpenMonsterRoom,
  type ForgeMaterialProjection, type ForgeMonsterDef,
} from '../data/forgeRecommendations';
import type { GameState } from '../data/wisdom';
import type { CraftedEquipment } from '../data/forgeTransactions';

// ─── Layout Constants ─────────────────────────────────────────────────────────

export const HEADER_H    = 88;
export const TAB_H       = 48;
export const CONTENT_Y   = HEADER_H + TAB_H;
export const WORKBENCH_H = 192;
export const LIST_PAD    = 14;

export const FORGE_RARITY_STARS = ['★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];

export const FORGE_TYPE_META: Record<BlueprintDef['type'], { label: string; icon: string; color: string; hex: number }> = {
  weapon:    { label: '무기',   icon: 'W', color: '#ffb45f', hex: 0xffb45f },
  armor:     { label: '방어구', icon: 'A', color: '#8ac7ff', hex: 0x8ac7ff },
  accessory: { label: '장신구', icon: 'R', color: '#d7a4ff', hex: 0xd7a4ff },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomEquipmentFeedback {
  readonly kind: 'equipment';
  readonly slotIdx: number;
  readonly monsterId: string;
  readonly sourceLabel: string;
  readonly title: string;
  readonly body: string;
  readonly equipmentName: string;
  readonly equipmentEmoji: string;
  readonly statLabel?: string;
  readonly statBefore?: string;
  readonly statAfter?: string;
  readonly accent: number;
}

export interface ForgeTargetCue {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly monsterEmoji: string;
  readonly monsterLevel: number;
  readonly roomLabel: string;
  readonly needLabel: string;
  readonly statusLabel: string;
  readonly accent: number;
  readonly priority: number;
}

// ─── ForgeContext ─────────────────────────────────────────────────────────────
// Central context object passed through every tab/card/FX module.
// The scene keeps ownership of mutable state; modules receive read-only snapshots
// plus callbacks for the actions they can trigger.

export type ForgeTab = 'craft' | 'dismantle' | 'trap';

export interface ForgeContext {
  readonly gs: GameState;
  readonly activeTab: ForgeTab;
  readonly page: number;
  readonly focusMonsterId: string | null;
  readonly focusSourceLabel: string | null;
  readonly selectedBpId: string | null;
  readonly selectedEqIdx: number | null;
  /** Called when the user taps a target-rail chip to change focus monster. */
  readonly onFocusChange: (monsterId: string, roomLabel: string) => void;
  /** Called when the user taps a blueprint row (toggles selection). */
  readonly onSelectBlueprint: (bpId: string) => void;
  /** Called when the user taps an equipment row (toggles selection). */
  readonly onSelectEquipment: (idx: number) => void;
  /** Opens the existing Abyss material-supply route. */
  readonly onOpenAbyss: () => void;
  /** Moves between bounded blueprint/equipment pages. */
  readonly onPageChange: (page: number) => void;
  /** Called when the user confirms crafting a blueprint. */
  readonly onConfirmCraft: (bpId: string) => void;
  /** Called when the user confirms dismantling a crafted equipment. */
  readonly onConfirmDismantle: (idx: number, eq: CraftedEquipment) => void;
  /** '함정' tab: craft one trap into stock. */
  readonly onCraftTrap: (trapId: string) => void;
  /** '함정' tab: raise a trap type's mastery by one. */
  readonly onEnhanceTrap: (trapId: string) => void;
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

export function getBlueprintMaterialProgress(
  bp: BlueprintDef,
  materials: Record<string, number>,
): { have: number; need: number; ratio: number } {
  const need = Object.values(bp.materials).reduce((sum, qty) => sum + qty, 0);
  const have = Object.entries(bp.materials)
    .reduce((sum, [id, qty]) => sum + Math.min(qty, materials[id] ?? 0), 0);
  return { have, need, ratio: need > 0 ? have / need : 1 };
}

export function formatForgeMaterialStatus(material: ForgeMaterialProjection): string {
  const status = material.missing > 0 ? `부족 ${material.missing}` : '충족';
  return `${material.name} ${material.have}/${material.need} · ${status}`;
}

export function rarityHex(rarity: number): number {
  const color = RARITY_COLORS[rarity] ?? '#aaaaaa';
  return Number.parseInt(color.replace('#', ''), 16);
}

export function getForgeRarityStars(rarity: number): string {
  const index = Math.max(0, Math.min(Math.floor(rarity), FORGE_RARITY_STARS.length - 1));
  return FORGE_RARITY_STARS[index];
}

export function getForgeTypeMeta(
  type: BlueprintDef['type'] | string,
): { label: string; icon: string; color: string; hex: number } {
  if (type === 'weapon' || type === 'armor' || type === 'accessory') return FORGE_TYPE_META[type];
  return { label: '장비', icon: 'E', color: '#d2b07b', hex: 0xd2b07b };
}

export function getMaterialDisplay(id: string): { emoji: string; name: string } {
  const def = MATERIAL_DEFS[id];
  if (def) return { emoji: def.emoji, name: def.name };

  const legacy: Record<string, { emoji: string; name: string }> = {
    iron_ore:    { emoji: '🪨', name: '철 광석' },
    spirit_wood: { emoji: '🪵', name: '정령목' },
  };
  const fallback = legacy[id];
  if (fallback) return fallback;

  return {
    emoji: '◇',
    name: id
      .split('_')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
  };
}

export function summarizeStatEffects(
  stats: Record<string, number>,
  fallback: string,
): string[] {
  const labels = Object.entries(stats).map(([key, rawValue]) => {
    const value = Number(rawValue);
    if (key === 'atkMult') {
      const percent = value >= 1 ? Math.round((value - 1) * 100) : Math.round(value * 100);
      return `ATK ${percent >= 0 ? '+' : ''}${percent}%`;
    }
    if (key === 'atkBonus' || key === 'atkMultiplier') return `ATK +${Math.round(value * 100)}%`;
    if (key === 'roomHpBonus')  return `방 HP +${value}`;
    if (key === 'roomHPBonus')  return `방 HP +${value}`;
    if (key === 'stunBonus')    return `기절 +${(value / 1000).toFixed(1)}s`;
    if (key === 'stunDuration') return `기절 +${value}s`;
    if (key === 'freezeChance') return `동결 +${Math.round(value * 100)}%`;
    if (key === 'skillCdMult')  return `쿨타임 -${Math.round((1 - value) * 100)}%`;
    if (key === 'skillCDReduction' || key === 'cdReduction') return `쿨타임 -${Math.round(value * 100)}%`;
    if (key === 'scEarnBonus')  return `수정 +${Math.round(value * 100)}%`;
    if (key === 'goldBonus')    return `골드 +${Math.round(value * 100)}%`;
    if (key === 'goldMult')     return `골드 +${Math.round(value * 100)}%`;
    if (key === 'crystalMult')  return `수정 +${Math.round(value * 100)}%`;
    if (key === 'dmgReduction') return `방 피해 -${Math.round(value * 100)}%`;
    if (key === 'atkSpeedBonus') return `기본공속 +${Math.round(value * 100)}%`;
    if (key === 'bossDmgBonus') return `보스 기본피해 +${Math.round(value * 100)}%`;
    if (key === 'executeChance') return `처형 +${Math.round(value * 100)}%`;
    if (key === 'charmEvery')   return `${value}타 매혹`;
    if (key === 'procBonus')    return `발동 +${Math.round(value * 100)}%`;
    if (key === 'adjacentAtkBonus') return `인접 ATK +${Math.round(value * 100)}%`;
    if (key === 'magicAtkBonus') return `마법 기본피해 +${Math.round(value * 100)}%`;
    if (key === 'holyDmgBonus')     return `추가 마법피해 +${Math.round(value * 100)}%`;
    if (key === 'celestialAtkBonus') return `천상 ATK +${Math.round(value * 100)}%`;
    if (key === 'aoeEvery') return `${value}타 전체 50%`;
    return `${key} +${value}`;
  });
  return labels.length > 0 ? labels.slice(0, 3) : [fallback];
}

/**
 * What crafting this blueprint actually gives you.
 *
 * `BlueprintDef` used to carry its own `stats` / `statDesc` pair, rendered here
 * while combat read `EQUIPMENT_STATS[resultId]` — two tables in disjoint key
 * namespaces (atkBonus/roomHPBonus/skillCDReduction vs atkMult/roomHpBonus/
 * skillCdMult) that were never reconciled. 19 of the 24 blueprints showed the
 * player something other than what they got: 구미호 로브 advertised its only
 * effect as 쿨타임 -20% and delivered 방 HP +120 · 발동 +3%, and 신성 방패
 * promised 피해 -25% · 천상 ATK +20% on top of its room HP, neither of which
 * exists as an equipment field at all.
 *
 * The advertising namespace is gone; this reads the equipment itself, so the
 * forge cannot drift from combat again.
 */
export function summarizeBlueprintEffects(bp: BlueprintDef): string[] {
  return summarizeStatEffects(getEquipmentStats(bp.resultId) as Record<string, number>, '기본 장비');
}

/** One-line version of the same thing, for the prose row above the chips. */
export function blueprintEffectText(bp: BlueprintDef): string {
  return summarizeBlueprintEffects(bp).join(' · ');
}

export function summarizeEquipmentEffects(eq: CraftedEquipment): string[] {
  return summarizeStatEffects(getEquipmentStats(eq.id) as Record<string, number>, '기본 장비');
}

export function getForgeNeedLabel(def: ForgeMonsterDef | null): string {
  if (def?.type === 'magic')   return '장신구 추천';
  if (def?.type === 'support') return '방어구 추천';
  return '무기 추천';
}

export function truncateLabel(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
}

export function getFocusMonsterDisplay(
  gs: GameState,
  focusMonsterId: string | null,
): { name: string; emoji: string; level: number } | null {
  if (!focusMonsterId) return null;
  const owned = gs.ownedMonsters.find(monster => monster.id === focusMonsterId);
  const def = owned ? resolveOwnedMonsterProfile(owned.id) : null;
  if (!owned) return null;
  return {
    name:  def?.name ?? owned.id,
    emoji: def?.emoji ?? '👹',
    level: owned.level,
  };
}

export function getFocusMonsterName(
  gs: GameState,
  focusMonsterId: string | null,
): string | null {
  return getFocusMonsterDisplay(gs, focusMonsterId)?.name ?? null;
}

export function getMonsterEquipmentDisplay(
  gs: GameState,
  monsterId: string,
): { name: string; emoji: string; rarity: number } | null {
  const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;

  const crafted = [...(gs.craftedEquipment ?? [])].reverse()
    .find(equipment => equipment.id === equipmentId);
  if (crafted) return { name: crafted.name, emoji: crafted.emoji, rarity: crafted.rarity };

  const bp = Object.values(BLUEPRINT_DEFS).find(blueprint => blueprint.resultId === equipmentId);

  if (bp) return { name: bp.name, emoji: bp.resultEmoji, rarity: bp.rarity };

  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { name: staticDef.name, emoji: staticDef.icon, rarity: 0 };

  return { name: equipmentId, emoji: '⚙', rarity: 0 };
}

export function getFocusEquipmentDisplay(
  gs: GameState,
  focusMonsterId: string | null,
): { name: string; emoji: string; rarity: number } | null {
  if (!focusMonsterId) return null;
  return getMonsterEquipmentDisplay(gs, focusMonsterId);
}

export function getEquipmentHolderDisplay(
  gs: GameState,
  equipmentId: string,
): { name: string; emoji: string; level: number } | null {
  const holder = gs.ownedMonsters?.find(monster => monster.equipment === equipmentId);
  if (!holder) return null;
  const def = getMonsterDefForOwned(holder.id);
  return {
    name:  def?.name ?? holder.id,
    emoji: def?.emoji ?? '👹',
    level: holder.level,
  };
}

export function getForgeTargetCues(
  gs: GameState,
  focusMonsterId: string | null,
): ForgeTargetCue[] {
  return [...(gs.ownedMonsters ?? [])]
    .map(monster => buildForgeTargetCue(gs, monster, focusMonsterId))
    .sort((a, b) => b.priority - a.priority);
}

export function buildForgeTargetCue(
  gs: GameState,
  monster: OwnedMonster,
  focusMonsterId: string | null,
): ForgeTargetCue {
  const def = getMonsterDefForOwned(monster.id);
  const assignedRoom  = findMonsterRoom(gs, monster.id);
  const openRoom      = assignedRoom ? null : findOpenMonsterRoom(gs, monster);
  const currentEquipment = getMonsterEquipmentDisplay(gs, monster.id);
  const roomLabel = assignedRoom
    ? `방 #${assignedRoom.index + 1}`
    : openRoom
      ? `방 #${openRoom.index + 1}`
      : '막사';
  const needLabel = currentEquipment
    ? '교체 후보'
    : getForgeNeedLabel(def);
  const statusLabel = currentEquipment
    ? truncateLabel(currentEquipment.name, 6)
    : '장비 없음';
  const priority = (focusMonsterId === monster.id ? 100 : 0)
    + (!currentEquipment ? 48 : 8)
    + (assignedRoom ? 34 : openRoom ? 18 : 0)
    + Math.min(monster.level, 30);

  return {
    monsterId:    monster.id,
    monsterName:  def?.name ?? monster.id,
    monsterEmoji: def?.emoji ?? '👹',
    monsterLevel: monster.level,
    roomLabel,
    needLabel,
    statusLabel,
    accent:   def?.accentColor ?? 0xffa43d,
    priority,
  };
}
