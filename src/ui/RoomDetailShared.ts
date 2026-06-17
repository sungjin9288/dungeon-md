// ─── Room Detail Shared ──────────────────────────────────────────────────────
// RoomDetail 계층 공유 타입·레이아웃 상수·순수 헬퍼. 의존 최하층 — 다른
// RoomDetail 모듈을 import하지 않는다 (순환 방지의 기준점).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import {
  type GameState } from '../data/wisdom';
import { EQUIPMENT_DEFS, getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { getDungeonActionQueue } from '../data/roomActionRecommendations';
import type { } from '../themes/themes';
import type { PickerNavCallbacks } from './RoomPickerModals';
import { getReducedMotion } from '../utils/reducedMotion';

export type { PickerNavCallbacks };




export const SLOT_W = 100;

export const SLOT_H = 100;

export const ROOM_DETAIL_CLOSE_MS = 200;

export const ROOM_DETAIL_REOPEN_DELAY_MS = ROOM_DETAIL_CLOSE_MS + 50;

export const MONSTER_ROW_ACCENT = 0xc8921a;

export const TRAP_ROW_ACCENT = 0x8c6a24;

export const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat:  0xb64a3a,
  trap:    0xc8921a,
  support: 0x44aa77,
  magic:   0x7f66cc };

export const ROOM_TYPE_SHORT_BONUS: Record<string, string> = {
  combat:  'M+1',
  trap:    'T+1',
  support: '인접+',
  magic:   'CD-20' };

export const ROOM_TYPE_ROLE_CHIP: Record<string, string> = {
  combat:  '수호',
  trap:    '함정',
  support: '지원',
  magic:   '마법' };

export const MONSTER_TYPE_LABEL: Record<string, string> = {
  melee: '근접',
  ranged: '원거리',
  magic: '마법',
  support: '지원' };

export const MONSTER_TYPE_COLOR: Record<string, number> = {
  melee: 0xd65a42,
  ranged: 0x5fb7ff,
  magic: 0x9a6cd8,
  support: 0x65e0a0 };

export const MONSTER_RARITY_META = {
  C: { label: 'COMMON', stars: '★', color: 0x8aa4aa, css: '#8aa4aa' },
  U: { label: 'UNIQUE', stars: '★★', color: 0x65e0a0, css: '#65e0a0' },
  R: { label: 'RARE', stars: '★★★', color: 0x5fb7ff, css: '#5fb7ff' },
  E: { label: 'EPIC', stars: '★★★★', color: 0xc58cff, css: '#c58cff' },
  L: { label: 'LEGEND', stars: '★★★★★', color: 0xe8c468, css: '#ffd166' } } as const;

export type RoomDirectiveTarget = 'type' | 'repair' | 'monster' | 'trap' | 'growth' | 'none';

export type RoomDetailQueueAction = ReturnType<typeof getDungeonActionQueue>[number];

export interface RoomDetailNextActionEntry {
  readonly action: RoomDetailQueueAction;
  readonly rank: number;
}

export interface RoomActionHeaderStatus {
  readonly readiness: number;
  readonly monsterCount: number;
  readonly monsterCapacity: number;
  readonly trapCount: number;
  readonly trapCapacity: number;
  readonly equipmentPower: number;
}

export interface RoomDirective {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly target: RoomDirectiveTarget;
  readonly accent: number;
  readonly fillColor: number;
  readonly textColor: string;
  readonly enabled?: boolean;
  readonly onPress?: () => void;
}

export interface EquipmentBadge {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly effect: string;
}

export interface RoomDetailReturnFeedback {
  readonly kind: 'equipment' | 'upgrade' | 'design' | 'monster' | 'trap' | 'repair';
  readonly slotIdx: number;
  readonly title: string;
  readonly body: string;
  readonly equipmentName?: string;
  readonly equipmentEmoji?: string;
  readonly roomIcon?: string;
  readonly statLabel?: string;
  readonly statBefore?: string;
  readonly statAfter?: string;
  readonly accent: number;
}

export function getEquipmentEffectLabel(stats: EquipmentStats, fallback = '전투 보조'): string {
  const labels: string[] = [];
  if (stats.atkMult) labels.push(`ATK ${stats.atkMult > 0 ? '+' : ''}${Math.round(stats.atkMult * 100)}%`);
  if (stats.roomHpBonus) labels.push(`HP +${stats.roomHpBonus}`);
  if (stats.freezeChance) labels.push(`빙결 +${Math.round(stats.freezeChance * 100)}%`);
  if (stats.executeChance) labels.push(`처형 +${Math.round(stats.executeChance * 100)}%`);
  if (stats.procBonus) labels.push(`발동 +${Math.round(stats.procBonus * 100)}%`);
  if (stats.skillCdMult && stats.skillCdMult < 1) labels.push(`쿨 -${Math.round((1 - stats.skillCdMult) * 100)}%`);
  if (stats.goldMult) labels.push(`골드 +${Math.round(stats.goldMult * 100)}%`);
  if (stats.crystalMult) labels.push(`결정 +${Math.round(stats.crystalMult * 100)}%`);
  return labels.slice(0, 2).join(' · ') || fallback;
}

export function formatSignedPower(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function getEquippedItem(gs: GameState, monsterId: string | null | undefined): EquipmentBadge | null {
  if (!monsterId) return null;
  const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;
  const stats = getEquipmentStats(equipmentId);
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) {
    return {
      id: equipmentId,
      icon: staticDef.icon,
      name: staticDef.name,
      effect: getEquipmentEffectLabel(stats, staticDef.desc) };
  }
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return craftedDef
    ? {
        id: equipmentId,
        icon: craftedDef.emoji,
        name: craftedDef.name,
        effect: getEquipmentEffectLabel(stats) }
    : null;
}

export function getRoomReadinessColor(readiness: number): number {
  if (readiness >= 78) return 0x66c08a;
  if (readiness >= 45) return 0xffc45c;
  return 0xff6b5f;
}

export function getDirectiveVisualMeta(directive: RoomDirective): { icon: string; label: string } {
  switch (directive.target) {
    case 'repair':
      return { icon: '🛠', label: '내구' };
    case 'type':
      return { icon: '▣', label: '설계' };
    case 'monster':
      return { icon: '👹', label: '수호' };
    case 'trap':
      return { icon: '🕸', label: '함정' };
    case 'growth':
      return { icon: '✦', label: '성장' };
    case 'none':
    default:
      return { icon: '✓', label: '완비' };
  }
}

export function prefersReducedMotion(): boolean {
  return getReducedMotion();
}

export function shouldHighlightDirectiveTarget(directive: RoomDirective, target: RoomDirectiveTarget): boolean {
  return directive.target === target;
}

export interface RoomDetailState {
  roomDetailContainer: Phaser.GameObjects.Container | null;
  trapPickerContainer: Phaser.GameObjects.Container | null;
  monsterPickerContainer: Phaser.GameObjects.Container | null;
  roomDetailSlotIdx: number | null;
  roomDetailCellX: number;
  roomDetailCellY: number;
  /** Set by openRoomDetail; used by closeRoomDetail for tween access. */
  scene: Phaser.Scene | null;
  /** Removes scroll listeners and mask objects owned by the active overlay. */
  roomDetailScrollCleanup: (() => void) | null;
}

export function createRoomDetailState(): RoomDetailState {
  return {
    roomDetailContainer: null,
    trapPickerContainer: null,
    monsterPickerContainer: null,
    roomDetailSlotIdx: null,
    roomDetailCellX: 0,
    roomDetailCellY: 0,
    scene: null,
    roomDetailScrollCleanup: null };
}

export interface RoomDetailCallbacks {
  /** Feedback 계층의 오버레이 닫기/재오픈 — Overlay가 openRoomDetail에서 주입 (역의존 방지) */
  requestClose?: () => void;
  requestReopen?: (slotIdx: number) => void;
  getGameState: () => GameState;
  saveAndRefresh: (state?: GameState) => void;
  rebuildDungeonSlots: () => void;
  markRoomChanged?: (slotIdx: number) => void;
  navigateToScene?: (sceneKey: string) => void;
  openRoomSlot?: (slotIdx: number) => void;
  startBattle?: () => void;
  isPreBattleEditActive?: () => boolean;
  resumePreBattle?: () => void;
}

export function findFirstEmptySlot(ids: readonly (string | undefined)[], cap: number): number {
  for (let i = 0; i < cap; i++) {
    if (!ids[i]) return i;
  }
  return -1;
}

export function navigateFromRoomDetail(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  cb: RoomDetailCallbacks,
  sceneKey: string,
): void {
  cb.requestClose?.();
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 30, () => {
    if (cb.navigateToScene) {
      cb.navigateToScene(sceneKey);
      return;
    }
    scene.scene.start(sceneKey);
  });
}
