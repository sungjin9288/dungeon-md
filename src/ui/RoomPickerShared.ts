/**
 * RoomPickerShared.ts — constants, types, and pure helpers shared
 * across RoomPickerChrome and RoomPickerModals. NO Phaser render logic here.
 * NO imports that pull in Phaser transitively (safe for unit tests).
 */
import { EQUIPMENT_DEFS } from '../data/barracks';
import { type RoomMetricDelta } from '../data/dungeonMetrics';
import { type DungeonSlot, type GameState } from '../data/wisdom';
import type Phaser from 'phaser';
import type { RoomDetailState, RoomDetailCallbacks } from './RoomDetailOverlay';
import type { DungeonTheme } from '../themes/themes';

// ─── Re-exported interface ─────────────────────────────────────────────────────

/** Callbacks injected to avoid circular imports. */
export interface PickerNavCallbacks {
  closeRoomDetail: (state: RoomDetailState, cb: RoomDetailCallbacks) => void;
  openRoomDetail: (
    scene: Phaser.Scene,
    state: RoomDetailState,
    theme: DungeonTheme,
    cb: RoomDetailCallbacks,
    slotIdx: number,
    cellX: number,
    cellY: number,
  ) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

export const SHEET_X = 8;
export const SHEET_PAD_X = 12;
export const SHEET_HEADER_H = 78;
export const SHEET_BOTTOM_PAD = 14;
export const ROW_GAP = 8;
export const PICKER_SLIDE_MS = 220;

// ─── Label maps ───────────────────────────────────────────────────────────────

export const MONSTER_TYPE_LABEL: Record<string, string> = {
  melee: '근접',
  ranged: '원거리',
  magic: '마법',
  support: '지원',
};

export const MONSTER_TYPE_ACCENT: Record<string, number> = {
  melee: 0xd65a42,
  ranged: 0x5fb7ff,
  magic: 0x9a6cd8,
  support: 0x65e0a0,
};

export const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat: 0xb64a3a,
  trap: 0xc8921a,
  support: 0x44aa77,
  magic: 0x7f66cc,
};

export const PICKER_MONSTER_RARITY_META = {
  C: { stars: '★', color: 0x8aa4aa, css: '#8aa4aa' },
  U: { stars: '★★', color: 0x65e0a0, css: '#65e0a0' },
  R: { stars: '★★★', color: 0x5fb7ff, css: '#5fb7ff' },
  E: { stars: '★★★★', color: 0xc58cff, css: '#c58cff' },
  L: { stars: '★★★★★', color: 0xe8c468, css: '#ffd166' },
} as const;

export const MONSTER_ROOM_FIT: Record<string, Partial<Record<string, string>>> = {
  combat: {
    melee: '전열 핵심',
    ranged: '후열 화력',
  },
  trap: {
    ranged: '함정 보조',
    magic: '제압 보조',
    support: '유지 보조',
  },
  support: {
    support: '지원 적합',
    magic: '버프 연계',
  },
  magic: {
    magic: '마력 적합',
    support: '쿨감 연계',
  },
};

export const TRAP_ROOM_FIT: Record<string, Partial<Record<string, string>>> = {
  combat: {
    slow_trap: '진입 제어',
    spike_trap: '초반 피해',
  },
  trap: {
    stun_trap: '핵심 제압',
    poison_trap: '지속 피해',
    slow_trap: '동선 제어',
  },
  support: {
    slow_trap: '보호 동선',
    stun_trap: '긴급 제압',
  },
  magic: {
    stun_trap: '시전 보호',
    poison_trap: '마력 압박',
  },
};

// ─── Pure helpers ──────────────────────────────────────────────────────────────

export function getRoomAccent(slot: DungeonSlot | null | undefined, fallback: number): number {
  return slot?.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? fallback : fallback;
}

export function fitPickerLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatDeltaParts(delta: RoomMetricDelta): string[] {
  return [
    delta.threatDelta !== 0 ? `위협 ${formatSigned(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSigned(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSigned(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
}

export function getMonsterRoomFitLabel(slot: DungeonSlot | null | undefined, monsterType: string): string {
  if (!slot?.roomType) return MONSTER_TYPE_LABEL[monsterType] ?? '전투';
  return MONSTER_ROOM_FIT[slot.roomType]?.[monsterType]
    ?? MONSTER_TYPE_LABEL[monsterType]
    ?? '전투';
}

export function getTrapRoomFitLabel(slot: DungeonSlot | null | undefined, trapId: string): string {
  if (!slot?.roomType) return '기본 설비';
  return TRAP_ROOM_FIT[slot.roomType]?.[trapId]
    ?? (slot.roomType === 'trap' ? '함정실 보정' : '보조 설비');
}

export function getEquipmentIcon(gs: GameState, equipmentId: string | null | undefined): string | null {
  if (!equipmentId) return null;
  return EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId)?.icon
    ?? gs.craftedEquipment?.find(equipment => equipment.id === equipmentId)?.emoji
    ?? '◆';
}

export function getPickerMonsterRarityMeta(
  rarityTier: string | undefined,
): typeof PICKER_MONSTER_RARITY_META[keyof typeof PICKER_MONSTER_RARITY_META] {
  if (rarityTier && rarityTier in PICKER_MONSTER_RARITY_META) {
    return PICKER_MONSTER_RARITY_META[rarityTier as keyof typeof PICKER_MONSTER_RARITY_META];
  }
  return PICKER_MONSTER_RARITY_META.C;
}
