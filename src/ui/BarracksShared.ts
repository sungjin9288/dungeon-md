// ─── Barracks Shared ─────────────────────────────────────────────────────────
// 병영 씬 공유 상수·타입·순수 헬퍼. 최하층 — 씬을 import하지 않는다 (순환 방지).

import { COLORS } from '../constants/colors';
import { MONSTER_DEFS, resolveOwnedMonsterProfile } from '../data/monsters';
import {
  xpToNextLevel,
  EQUIPMENT_DEFS,
  type OwnedMonster,
} from '../data/barracks';
import {
  getRoomSlotCapacity,
  getUnlockedSlotCount,
  ROOM_SLOT_TYPE_DEFS,
  type GameState,
  type DungeonSlot,
  type RoomSlotType,
} from '../data/wisdom';
import type { OwnedMonsterProfile, RarityId } from '../data/monsters';

// ─── Card Geometry Constants ──────────────────────────────────────────────────

export const CARD_W          = 362;
export const CARD_H          = 180;
export const CARD_PAD        = 10;
export const CARD_START_X    = 14;
export const GROWTH_PANEL_Y  = 88;
export const GROWTH_PANEL_H  = 150;
export const SORT_CHIP_Y     = GROWTH_PANEL_Y + GROWTH_PANEL_H + 8;
export const FILTER_CHIP_Y   = SORT_CHIP_Y + 48;
export const CARD_START_Y    = FILTER_CHIP_Y + 48;
export const SUMMON_ROW_H    = 72;

// ─── Type aliases ─────────────────────────────────────────────────────────────

export type BarracksSortKey    = 'growth' | 'level' | 'atk' | 'rarity';
export type BarracksFilterType = 'all' | 'melee' | 'ranged' | 'magic' | 'support';

// ─── Rarity lookup tables ─────────────────────────────────────────────────────

export const OWNED_RARITY_TO_TIER: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];

export const COLLECTION_RARITY_META: Record<
  RarityId,
  { rank: number; label: string; stars: string; color: number; css: string }
> = {
  C: { rank: 0, label: 'COMMON', stars: '★',     color: 0x8f98a5, css: '#b9c0ca' },
  U: { rank: 1, label: 'UNIQUE', stars: '★★',    color: 0x58c681, css: '#8ff0ad' },
  R: { rank: 2, label: 'RARE',   stars: '★★★',   color: 0x62a8ff, css: '#9bc9ff' },
  E: { rank: 3, label: 'EPIC',   stars: '★★★★',  color: 0xc978ff, css: '#e3b4ff' },
  L: { rank: 4, label: 'LEGEND', stars: '★★★★★', color: 0xffc857, css: '#ffd878' },
};

export const TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비',
  gumiho:   '구미호',
  dragon:   '용족',
  underworld: '저승',
  sansin:   '산신',
  sea:      '해신',
  mask:     '탈족',
  moonlight: '달빛',
  celestial: '천상',
};

export const ELEMENT_META: Record<string, { label: string; icon: string; color: number }> = {
  fire:      { label: '화염', icon: '🔥', color: 0xff7a3d },
  frost:     { label: '서리', icon: '❄',  color: 0x7bdcff },
  lightning: { label: '번개', icon: '⚡', color: 0xffdf64 },
  dark:      { label: '암흑', icon: '☾',  color: 0xc181ff },
  holy:      { label: '신성', icon: '✦',  color: 0xffe8a3 },
};

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

export interface MonsterRoomPlan {
  label: string;
  subLabel: string;
  accent: number;
  kind: 'deployed' | 'recommended' | 'repair' | 'design' | 'locked';
}

export interface MonsterCardActionCue {
  icon: string;
  label: string;
  subLabel: string;
  chip: string;
  accent: number;
  fill: number;
  textColor: string;
}

export interface MonsterCollectionMeta {
  indexLabel: string;
  tier: RarityId;
  rank: number;
  label: string;
  stars: string;
  color: number;
  css: string;
  tribeLabel: string;
  elementLabel: string;
  elementIcon: string;
  elementColor: number;
}

// ─── Growth sort helpers ──────────────────────────────────────────────────────

export function isGrowthReady(m: OwnedMonster): boolean {
  if (m.skillPoints > 0) return true;
  if (m.equipment === null) return true;
  if (m.level < 50) {
    const needed = xpToNextLevel(m.level);
    if (needed > 0 && m.xp / needed >= 0.78) return true;
  }
  return false;
}

export function growthPriority(m: OwnedMonster): number {
  const xpProgress = m.level < 50 ? m.xp / xpToNextLevel(m.level) : 0;
  const spScore    = m.skillPoints > 0 ? 1000 + m.skillPoints * 10 : 0;
  const xpScore    = xpProgress >= 0.78 ? Math.round(xpProgress * 100) : 0;
  const gearScore  = m.equipment === null ? 50 : 0;
  return spScore + xpScore + gearScore;
}

export function compareGrowth(a: OwnedMonster, b: OwnedMonster): number {
  const aReady = isGrowthReady(a);
  const bReady = isGrowthReady(b);
  if (aReady !== bReady) return aReady ? -1 : 1;
  if (aReady) return growthPriority(b) - growthPriority(a);
  return b.level - a.level;
}

// ─── Pure helpers (take explicit gs/monster args, no `this`) ─────────────────

export function getMonsterCollectionMeta(
  monster: OwnedMonster,
  def: OwnedMonsterProfile,
): MonsterCollectionMeta {
  const allIds = Object.keys(MONSTER_DEFS);
  const index = def.registryId ? allIds.indexOf(def.registryId) : -1;
  const tier = def.rarityTier ?? OWNED_RARITY_TO_TIER[monster.rarity ?? 0] ?? 'C';
  const rarity = COLLECTION_RARITY_META[tier];
  const element = def.element ? ELEMENT_META[def.element] : null;
  return {
    indexLabel:   index >= 0 ? `No.${String(index + 1).padStart(3, '0')}` : 'No.---',
    tier,
    rank:         rarity.rank,
    label:        rarity.label,
    stars:        rarity.stars,
    color:        rarity.color,
    css:          rarity.css,
    tribeLabel:   def.tribe ? TRIBE_LABELS[def.tribe] ?? '수호' : '수호',
    elementLabel: element?.label ?? '무속',
    elementIcon:  element?.icon ?? '◆',
    elementColor: element?.color ?? COLORS.TORCH_AMBER,
  };
}

export function getMonsterTypeMeta(
  type?: string,
): { label: string; color: number; text: string } {
  if (type === 'melee')   return { label: '근접 훈련',  color: 0xff9354, text: '#ffd0a6' };
  if (type === 'ranged')  return { label: '원거리 훈련', color: 0x7bbcff, text: '#c9e4ff' };
  if (type === 'magic')   return { label: '마력 증폭',  color: 0xc978ff, text: '#edd1ff' };
  if (type === 'support') return { label: '지원 의식',  color: 0x89e06f, text: '#d8ffd1' };
  return { label: '혼합 훈련', color: COLORS.TORCH_AMBER, text: '#ffcf78' };
}

export function getEquipmentDisplay(
  gs: GameState,
  equipmentId: string | null,
): { icon: string; name: string } | null {
  if (!equipmentId) return null;
  const staticDef = EQUIPMENT_DEFS.find(e => e.id === equipmentId);
  if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
  const craftedDef = [...(gs.craftedEquipment ?? [])]
    .reverse()
    .find(e => e.id === equipmentId);
  if (!craftedDef) return null;
  return { icon: craftedDef.emoji, name: craftedDef.name };
}

export function getDeployedMonsterIds(gs: GameState): Set<string> {
  return new Set(
    (gs.dungeonSlots ?? []).flatMap(slot => slot.monsterIds.filter(Boolean) as string[]),
  );
}

export function getEquipmentInventoryIds(gs: GameState): string[] {
  return Array.from(new Set([
    ...(gs.ownedEquipment ?? []),
    ...(gs.craftedEquipment ?? []).map(e => e.id),
  ]));
}

// ─── Room plan helpers ────────────────────────────────────────────────────────

function getRoomTypeDisplay(roomType?: RoomSlotType): { name: string; accent: number } {
  const def = ROOM_SLOT_TYPE_DEFS.find(r => r.id === roomType);
  if (roomType === 'combat')  return { name: def?.name ?? '전투실', accent: 0xff9354 };
  if (roomType === 'trap')    return { name: def?.name ?? '함정실', accent: COLORS.TORCH_AMBER };
  if (roomType === 'support') return { name: def?.name ?? '지원실', accent: 0x89e06f };
  if (roomType === 'magic')   return { name: def?.name ?? '마법진', accent: 0xc978ff };
  return { name: '미설계 방', accent: 0x55b88a };
}

function findMonsterRoom(
  gs: GameState,
  monsterId: string,
): { slot: DungeonSlot; index: number } | null {
  const slots = gs.dungeonSlots ?? [];
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    if (!slot) continue;
    if ((slot.monsterIds ?? []).some(id => id === monsterId)) return { slot, index };
  }
  return null;
}

function hasOpenMonsterSlot(slot: DungeonSlot): boolean {
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  return (slot.monsterIds ?? []).filter(Boolean).length < cap.monsters;
}

function getPreferredRoomType(monsterType?: string): RoomSlotType {
  if (monsterType === 'magic')   return 'magic';
  if (monsterType === 'support') return 'support';
  return 'combat';
}

/**
 * Forge target rail room cue. The craft recommendation only exists when a
 * blueprint does; without one, the guardian's real placement still decides it.
 */
export function getForgeTargetRoomCue(
  gs: GameState,
  monster: OwnedMonster,
  room: { readonly kind: 'assigned' | 'recommended' | 'unassigned'; readonly roomLabel: string } | null | undefined,
): string {
  if (room?.kind === 'assigned') return `실제 ${room.roomLabel}`;
  if (room?.kind === 'recommended') return `추천 ${room.roomLabel}`;
  const placed = findMonsterRoom(gs, monster.id);
  return placed ? `실제 방 #${placed.index + 1}` : '배치 대기';
}

export function getMonsterRoomPlan(gs: GameState, monster: OwnedMonster): MonsterRoomPlan {
  const deployed = findMonsterRoom(gs, monster.id);
  if (deployed) {
    const room = getRoomTypeDisplay(deployed.slot.roomType);
    return {
      label:    `방 #${deployed.index + 1} 배치중`,
      subLabel: `${room.name} · Lv.${deployed.slot.roomLevel}`,
      accent:   room.accent,
      kind:     'deployed',
    };
  }

  const def = resolveOwnedMonsterProfile(monster.id);
  const preferredType = getPreferredRoomType(def?.type);
  const unlockedSlots = getUnlockedSlotCount(gs);
  const slots = gs.dungeonSlots ?? [];
  const viableRooms = slots
    .slice(0, unlockedSlots)
    .map((slot, index) => ({ slot, index }))
    .filter((entry): entry is { slot: DungeonSlot; index: number } => Boolean(entry.slot));

  const preferredRoom = viableRooms.find(({ slot }) =>
    slot.hp > 0 && slot.roomType === preferredType && hasOpenMonsterSlot(slot),
  );
  if (preferredRoom) {
    const room = getRoomTypeDisplay(preferredRoom.slot.roomType);
    return {
      label:    `방 #${preferredRoom.index + 1} 추천`,
      subLabel: `${room.name} 빈 슬롯`,
      accent:   room.accent,
      kind:     'recommended',
    };
  }

  const anyOpenRoom = viableRooms.find(({ slot }) =>
    slot.hp > 0 && Boolean(slot.roomType) && hasOpenMonsterSlot(slot),
  );
  if (anyOpenRoom) {
    const room = getRoomTypeDisplay(anyOpenRoom.slot.roomType);
    return {
      label:    `방 #${anyOpenRoom.index + 1} 대기`,
      subLabel: `${room.name} 임시 배치 가능`,
      accent:   room.accent,
      kind:     'recommended',
    };
  }

  const repairRoom = viableRooms.find(({ slot }) =>
    slot.hp <= 0 && Boolean(slot.roomType) && hasOpenMonsterSlot(slot),
  );
  if (repairRoom) {
    return {
      label:    `방 #${repairRoom.index + 1} 수리 후 배치`,
      subLabel: '파손 방 복구 필요',
      accent:   0xff5544,
      kind:     'repair',
    };
  }

  const designRoom = viableRooms.find(({ slot }) => !slot.roomType);
  if (designRoom) {
    return {
      label:    `방 #${designRoom.index + 1} 설계 필요`,
      subLabel: `${getRoomTypeDisplay(preferredType).name} 추천`,
      accent:   0x55b88a,
      kind:     'design',
    };
  }

  return {
    label:    '방 해금 대기',
    subLabel: '던전 레벨업 필요',
    accent:   0x8a6a4a,
    kind:     'locked',
  };
}

export function getMonsterCardActionCue(
  monster: OwnedMonster,
  xpPct: number,
  hasEquipment: boolean,
  isDeployed: boolean,
  roomPlan: MonsterRoomPlan,
  /** Owned items this monster could equip now; 0 means crafting is the only route. */
  equippableCount = 0,
): MonsterCardActionCue {
  const sp = monster.skillPoints ?? 0;
  if (sp > 0) {
    return {
      icon:      '✦',
      label:     `SP ${sp} 사용`,
      subLabel:  '스킬 노드 해금',
      chip:      '성장',
      accent:    0xc978ff,
      fill:      0x2b123b,
      textColor: '#e7c2ff',
    };
  }
  if (monster.level >= 50) {
    return {
      icon:      '👑',
      label:     '최대 레벨',
      subLabel:  hasEquipment ? '배치 최적화' : '장비 보강',
      chip:      'MAX',
      accent:    0xffc857,
      fill:      0x26200f,
      textColor: '#ffe6a3',
    };
  }
  if (xpPct >= 0.82) {
    return {
      icon:      '🥩',
      label:     '레벨업 임박',
      subLabel:  `EXP ${Math.round(xpPct * 100)}%`,
      chip:      '훈련',
      accent:    0x55d4ff,
      fill:      0x102638,
      textColor: '#dce8c8',
    };
  }
  if (!hasEquipment && equippableCount > 0) {
    return {
      icon:      '⚒',
      label:     '장비 장착',
      subLabel:  `보유 장비 ${equippableCount}개`,
      chip:      '장착',
      accent:    COLORS.TORCH_AMBER,
      fill:      0x241707,
      textColor: '#ffd08a',
    };
  }
  if (!hasEquipment) {
    return {
      icon:      '⚒',
      label:     '장비 보강',
      subLabel:  '전력 상승 추천',
      chip:      '제작',
      accent:    COLORS.TORCH_AMBER,
      fill:      0x241707,
      textColor: '#ffd08a',
    };
  }
  if (!isDeployed && roomPlan.kind !== 'locked') {
    return {
      icon:      '▣',
      label:     roomPlan.kind === 'design' ? '방 설계' : '방 배치',
      subLabel:  roomPlan.subLabel,
      chip:      '배치',
      accent:    roomPlan.accent,
      fill:      0x0e1f1d,
      textColor: '#c9fff2',
    };
  }
  if (isDeployed) {
    return {
      icon:      '✓',
      label:     '방어선 합류',
      subLabel:  roomPlan.subLabel,
      chip:      '활동',
      accent:    0x89e06f,
      fill:      0x142314,
      textColor: '#d4ffd0',
    };
  }
  return {
    icon:      '◆',
    label:     '훈련 대기',
    subLabel:  '상세 성장 확인',
    chip:      '대기',
    accent:    0x8bbf6a,
    fill:      0x131714,
    textColor: '#c9e8b8',
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function truncateLabel(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
}
