/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getRoomSlotCapacity, getMaxRoomLevel, getUnlockedSlots, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState } from '../data/wisdom';
import { MONSTER_DEFS } from '../data/monsters';
import { EQUIPMENT_DEFS, getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { TRAP_DEFS } from '../data/traps';
import {
  calculateRoomLoadoutStatus,
  calculateRoomMetricDelta,
  calculateRoomMetrics,
  type RoomMetricDelta,
  type RoomOperationalMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation, type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import { getDungeonActionQueue } from '../data/roomActionRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation,
  type MonsterLoadoutRecommendation,
  type TrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import {
  assignMonsterToRoomSlot,
  changeRoomSlotType,
  ensureDungeonSlot,
  getRoomRepairCost,
  getRoomUpgradeCost,
  installTrapInRoomSlot,
  removeTrapFromRoomSlot,
  repairRoomSlot,
  upgradeRoomSlot } from '../data/roomSlotTransactions';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton, addProgressBar } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback,
  type RoomGrowthFeedbackStats } from './RoomGrowthFeedback';

export type { PickerNavCallbacks };


import {
  addCompactAttributeChip, addCompactEmptySlotGlyph, addCompactEquipmentSocket,
  addCompactLoadoutButton, addRecommendedMonsterSlotPreview, addRecommendedTrapSlotPreview,
  buildRoomInteriorPreview, drawCollectorCardSkin, drawCompactEmptyMonsterPlanTag,
  drawCompactEmptyTrapPlanTag, drawCompactGrowthMeter, drawCompactLoadoutSlotFrame,
  drawCompactRoomTypeStateTag, drawCompactTrapEffectTag, fitSlotLabel,
  formatCompactTrapCost, getMonsterRarityMeta, navigateToFocusedForge, navigateToFocusedMonster } from './RoomDetailInterior';

// ─── Layout constants (mirrored from DungeonHomeScene) ────────────────────────

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

function getEquipmentEffectLabel(stats: EquipmentStats, fallback = '전투 보조'): string {
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

function consumeRoomDetailFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
): RoomDetailReturnFeedback | null {
  const raw = scene.registry.get('roomDetailFeedback') as Partial<RoomDetailReturnFeedback> | undefined;
  if (!raw || (
    raw.kind !== 'equipment'
    && raw.kind !== 'upgrade'
    && raw.kind !== 'design'
    && raw.kind !== 'monster'
    && raw.kind !== 'trap'
    && raw.kind !== 'repair'
  )) return null;
  const feedbackSlotIdx = typeof raw.slotIdx === 'number' ? raw.slotIdx : Number(raw.slotIdx);
  if (feedbackSlotIdx !== slotIdx) return null;
  scene.registry.remove('roomDetailFeedback');
  if (!raw.title || !raw.body) return null;
  if (raw.kind === 'equipment' && (!raw.equipmentName || !raw.equipmentEmoji)) return null;
  return {
    kind: raw.kind,
    slotIdx: feedbackSlotIdx,
    title: raw.title,
    body: raw.body,
    equipmentName: raw.equipmentName,
    equipmentEmoji: raw.equipmentEmoji,
    roomIcon: raw.roomIcon,
    statLabel: typeof raw.statLabel === 'string' ? raw.statLabel : undefined,
    statBefore: typeof raw.statBefore === 'string' ? raw.statBefore : undefined,
    statAfter: typeof raw.statAfter === 'string' ? raw.statAfter : undefined,
    accent: typeof raw.accent === 'number' ? raw.accent : 0xc8e8b0 };
}

function drawRoomDetailReturnFeedback(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  theme: DungeonTheme,
  feedback: RoomDetailReturnFeedback,
  x: number,
  y: number,
  w: number,
): number {
  const h = 48;
  const accent = feedback.accent;
  const icon = feedback.kind === 'equipment'
    ? feedback.equipmentEmoji ?? '⚒'
    : feedback.kind === 'design' || feedback.kind === 'monster' || feedback.kind === 'trap'
      ? feedback.roomIcon ?? '▣'
      : feedback.kind === 'repair'
        ? '🛠'
      : '★';
  const status = feedback.kind === 'equipment'
    ? '적용됨'
    : feedback.kind === 'design'
      ? '설계됨'
      : feedback.kind === 'monster'
        ? '배치됨'
        : feedback.kind === 'trap'
          ? '설치됨'
          : feedback.kind === 'repair'
            ? '복구됨'
          : '성장됨';
  const statText = feedback.statLabel && feedback.statBefore && feedback.statAfter
    ? `${feedback.statLabel} ${feedback.statBefore}→${feedback.statAfter}`
    : null;
  const g = scene.add.graphics();
  g.fillStyle(0x06100d, 0.96);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1.4, accent, 0.76);
  g.strokeRoundedRect(x, y, w, h, 10);
  g.fillStyle(accent, 0.16);
  g.fillRoundedRect(x + 7, y + 7, 5, h - 14, 4);
  g.fillCircle(x + 31, y + h / 2, 18);
  g.lineStyle(1, 0xffffff, 0.18);
  g.strokeCircle(x + 31, y + h / 2, 18);
  c.add(g);

  c.add(scene.add.text(x + 31, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '20px' }).setOrigin(0.5));
  c.add(scene.add.text(x + 58, y + 16, feedback.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#d8fff5',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 58, y + 33, feedback.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: theme.textSecondary,
    wordWrap: { width: statText ? w - 156 : w - 136, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  if (statText) {
    g.fillStyle(accent, 0.18);
    g.fillRoundedRect(x + w - 92, y + 13, 78, 22, 6);
    g.lineStyle(1, accent, 0.48);
    g.strokeRoundedRect(x + w - 92, y + 13, 78, 22, 6);
  }
  c.add(scene.add.text(x + w - 14, y + h / 2, statText ?? status, {
    fontFamily: 'sans-serif',
    fontSize: statText ? '9px' : '10px',
    color: '#b8fff0',
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  g.setAlpha(0.78);
  scene.tweens.add({
    targets: g,
    alpha: 1,
    duration: 380,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut' });
  return h;
}

function drawPreBattleReturnStrip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  state: RoomDetailState,
  x: number,
  y: number,
  w: number,
): number {
  const h = 34;
  const g = scene.add.graphics();
  g.fillStyle(0x091c2a, 0.96);
  g.fillRoundedRect(x, y, w, h, 9);
  g.lineStyle(1.2, 0xe8c468, 0.74);
  g.strokeRoundedRect(x, y, w, h, 9);
  g.fillStyle(0xe8c468, 0.12);
  g.fillRoundedRect(x + 8, y + 7, 22, 20, 6);
  c.add(g);

  c.add(scene.add.text(x + 19, y + 17, '⚔', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#f0e6c8' }).setOrigin(0.5));
  c.add(scene.add.text(x + 40, y + 12, '침공 편집 중', {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '10px',
    color: '#ffdf6e',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 40, y + 24, '정비 후 바로 작전판으로 돌아갈 수 있습니다.', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: theme.textSecondary }).setOrigin(0, 0.5));

  const button = addPrimaryActionButton(scene, {
    x: x + w - 92,
    y: y + 5,
    w: 82,
    h: 24,
    label: '침공 복귀',
    fontSize: '9px',
    fillColor: 0x27445a,
    hoverFillColor: 0x315b78,
    borderColor: 0xe8c468,
    hoverBorderColor: 0xfff0a3,
    textColor: '#f0e6c8',
    onPress: () => {
      closeRoomDetail(state, cb);
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    } });
  c.add([button.bg, button.text, button.zone]);

  return h;
}

function drawRoomActionHeader(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  directive: RoomDirective,
  x: number,
  y: number,
  w: number,
  status: RoomActionHeaderStatus,
  nextActionEntry?: RoomDetailNextActionEntry | null,
  onNextActionPress?: () => void,
): number {
  const hasNextAction = Boolean(nextActionEntry && onNextActionPress);
  const h = hasNextAction ? 110 : 82;
  const ctaW = 88;
  const meta = getDirectiveVisualMeta(directive);
  const readinessColor = getRoomReadinessColor(status.readiness);
  const readinessCss = `#${readinessColor.toString(16).padStart(6, '0')}`;
  const g = scene.add.graphics();
  g.fillStyle(0x0b0703, 0.94);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1.4, directive.accent, 0.66);
  g.strokeRoundedRect(x, y, w, h, 10);
  g.fillStyle(directive.accent, 0.12);
  g.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 8);
  g.fillStyle(0x0b0703, 0.74);
  g.fillRoundedRect(x + 12, y + 12, 40, 44, 10);
  g.lineStyle(1.1, directive.accent, 0.58);
  g.strokeRoundedRect(x + 12, y + 12, 40, 44, 10);
  g.fillStyle(directive.accent, 0.20);
  g.fillCircle(x + 32, y + 34, 15);
  c.add(g);

  c.add(scene.add.text(x + 32, y + 34, meta.icon, {
    fontFamily: 'sans-serif',
    fontSize: '18px' }).setOrigin(0.5));

  c.add(scene.add.text(x + 60, y + 14, '던전마스터 지휘', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  g.fillStyle(directive.accent, 0.16);
  g.fillRoundedRect(x + 155, y + 6, 44, 17, 6);
  g.lineStyle(1, directive.accent, 0.36);
  g.strokeRoundedRect(x + 155, y + 6, 44, 17, 6);
  c.add(scene.add.text(x + 177, y + 14.5, meta.label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold' }).setOrigin(0.5));
  g.fillStyle(readinessColor, 0.13);
  g.fillRoundedRect(x + 203, y + 6, 58, 17, 6);
  g.lineStyle(1, readinessColor, 0.44);
  g.strokeRoundedRect(x + 203, y + 6, 58, 17, 6);
  g.fillStyle(readinessColor, 0.35);
  g.fillRoundedRect(
    x + 207,
    y + 18,
    Math.max(5, 24 * Phaser.Math.Clamp(status.readiness / 100, 0, 1)),
    2,
    1,
  );
  c.add(scene.add.text(x + 232, y + 14.5, `준비 ${status.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readinessCss,
    fontStyle: 'bold' }).setOrigin(0.5));

  const miniStats = [
    { label: '수호', value: `${status.monsterCount}/${status.monsterCapacity}`, color: status.monsterCount > 0 ? '#88ffcc' : '#806040' },
    { label: '함정', value: status.trapCapacity > 0 ? `${status.trapCount}/${status.trapCapacity}` : '-', color: status.trapCount > 0 ? '#ffe080' : '#806040' },
    { label: '장비', value: status.equipmentPower > 0 ? formatSignedPower(status.equipmentPower) : '-', color: status.equipmentPower > 0 ? '#ffdf6e' : '#806040' },
  ];
  const miniY = y + 60;
  miniStats.forEach((stat, i) => {
    const chipX = x + 60 + i * 62;
    g.fillStyle(0x050806, 0.72);
    g.fillRoundedRect(chipX, miniY, 56, 16, 5);
    g.lineStyle(1, directive.accent, 0.16);
    g.strokeRoundedRect(chipX, miniY, 56, 16, 5);
    c.add(scene.add.text(chipX + 7, miniY + 8, stat.label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#8ab3aa',
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    c.add(scene.add.text(chipX + 50, miniY + 8, stat.value, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: stat.color,
      fontStyle: 'bold' }).setOrigin(1, 0.5));
  });
  c.add(scene.add.text(x + 60, y + 32, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: directive.textColor,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 60, y + 49, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ebcae',
    wordWrap: { width: w - ctaW - 82, useAdvancedWrap: true } }).setOrigin(0, 0.5));

  if (nextActionEntry && onNextActionPress) {
    drawNextQueuePreviewChip(scene, c, nextActionEntry, x + 12, y + 82, w - 24, onNextActionPress);
  }

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 8,
      y: y + 29,
      w: ctaW,
      h: 34,
      label: directive.ctaLabel,
      fontSize: '10px',
      enabled: directive.enabled ?? true,
      fillColor: directive.fillColor,
      hoverFillColor: directive.fillColor,
      borderColor: directive.accent,
      hoverBorderColor: 0xffdf6e,
      textColor: directive.textColor,
      onPress: directive.onPress });
    c.add([button.bg, button.text, button.zone]);
    return h;
  }

  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x + w - ctaW - 8, y + 29, ctaW, 34, 7);
  g.lineStyle(1, directive.accent, 0.34);
  g.strokeRoundedRect(x + w - ctaW - 8, y + 29, ctaW, 34, 7);
  c.add(scene.add.text(x + w - ctaW / 2 - 8, y + 46, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold' }).setOrigin(0.5));

  return h;
}

function getRoomReadinessColor(readiness: number): number {
  if (readiness >= 78) return 0x66c08a;
  if (readiness >= 45) return 0xffc45c;
  return 0xff6b5f;
}

function drawNextQueuePreviewChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  nextActionEntry: RoomDetailNextActionEntry,
  x: number,
  y: number,
  w: number,
  onPress: () => void,
): void {
  const h = 24;
  const buttonW = 48;
  const { action, rank } = nextActionEntry;
  const g = scene.add.graphics();
  g.fillStyle(0x06110f, 0.94);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, action.accent, 0.46);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.fillStyle(action.accent, 0.16);
  g.fillRoundedRect(x + 5, y + 5, 5, h - 10, 3);
  g.fillStyle(0x071812, 0.96);
  g.fillRoundedRect(x + w - buttonW - 5, y + 2, buttonW, 20, 6);
  g.lineStyle(1, action.accent, 0.62);
  g.strokeRoundedRect(x + w - buttonW - 5, y + 2, buttonW, 20, 6);
  c.add(g);

  c.add(scene.add.text(x + 16, y + h / 2, `다음 ${rank}순 · 방 #${action.slotIdx + 1} ${action.label}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#b7ffe8',
    fontStyle: 'bold',
    wordWrap: { width: w - buttonW - 30 } }).setOrigin(0, 0.5));

  c.add(scene.add.text(x + w - buttonW / 2 - 5, y + h / 2, '이동', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#d8fff0',
    fontStyle: 'bold' }).setOrigin(0.5));

  const zone = scene.add.zone(x, y - 6, w, h + 12)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => g.setAlpha(1));
  zone.on('pointerout', () => g.setAlpha(0.94));
  zone.on('pointerdown', onPress);
  c.add(zone);
}

function getDirectiveVisualMeta(directive: RoomDirective): { icon: string; label: string } {
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
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function shouldHighlightDirectiveTarget(directive: RoomDirective, target: RoomDirectiveTarget): boolean {
  return directive.target === target;
}

function drawSectionTargetPulse(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
  chipPlacement: 'top' | 'none' = 'top',
): void {
  const g = scene.add.graphics();
  g.lineStyle(4, accent, 0.14);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 10);
  g.lineStyle(1.7, accent, 0.82);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 9);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 8);
  c.add(g);

  let chip: Phaser.GameObjects.Text | null = null;
  if (chipPlacement === 'top') {
    const chipW = Math.min(98, Math.max(58, label.length * 9 + 18));
    const chipX = x + w / 2 - chipW / 2;
    const chipY = y + 6;
    g.fillStyle(0x040908, 0.88);
    g.fillRoundedRect(chipX, chipY, chipW, 18, 6);
    g.lineStyle(1, accent, 0.66);
    g.strokeRoundedRect(chipX, chipY, chipW, 18, 6);
    chip = scene.add.text(chipX + chipW / 2, chipY + 9, label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#f5ffe8',
      fontStyle: 'bold' }).setOrigin(0.5);
    c.add(chip);
  }

  if (prefersReducedMotion()) return;
  scene.tweens.add({
    targets: chip ? [g, chip] : g,
    alpha: { from: 0.72, to: 1 },
    duration: 520,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut' });
}

function registerRoomUpgradeFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  previousLevel: number,
  nextLevel: number,
  previousHp: number,
  nextHp: number,
  previousCap: { monsters: number; traps: number },
  nextCap: { monsters: number; traps: number },
  stats?: RoomGrowthFeedbackStats,
): void {
  const slotDelta = [
    nextCap.monsters > previousCap.monsters ? `수호 +${nextCap.monsters - previousCap.monsters}` : null,
    nextCap.traps > previousCap.traps ? `함정 +${nextCap.traps - previousCap.traps}` : null,
  ].filter((part): part is string => Boolean(part));
  const slotText = slotDelta.length > 0 ? slotDelta.join(' · ') : '방 구조 강화';
  const feedback: RoomDetailReturnFeedback = {
    kind: 'upgrade',
    slotIdx,
    title: '방 레벨 상승',
    body: `Lv.${previousLevel}→${nextLevel} · HP ${previousHp}→${nextHp} · ${slotText}`,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent: 0xe8c468 };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function registerRoomDesignFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  roomName: string,
  roomIcon: string,
  delta: RoomMetricDelta,
  accent: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const parts = [
    delta.threatDelta !== 0 ? `위협 ${formatSignedPower(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSignedPower(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSignedPower(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
  const feedback: RoomDetailReturnFeedback = {
    kind: 'design',
    slotIdx,
    title: '방 설계 완료',
    body: `${roomName} 역할 적용${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`,
    roomIcon,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function registerRoomRepairFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  previousHp: number,
  nextHp: number,
  cost: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const feedback: RoomDetailReturnFeedback = {
    kind: 'repair',
    slotIdx,
    title: '방 수리 완료',
    body: `HP ${previousHp}→${nextHp} · ${cost}g 사용`,
    statLabel: stats ? '위협' : undefined,
    statBefore: stats ? String(stats.threatBefore) : undefined,
    statAfter: stats ? String(stats.threatAfter) : undefined,
    accent: 0x66c08a };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function applyRoomRepairAction(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  fallbackSlot: DungeonSlot,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? fallbackSlot;
  const beforeMetrics = calculateRoomMetrics(freshGs, freshSlot);
  const repairCost = getRoomRepairCost(freshSlot);
  const result = repairRoomSlot(freshGs, slotIdx);
  if (!result.ok) return;

  const repairDelta = calculateRoomMetricDelta(freshGs, freshSlot, result.slot);
  const repairStats = buildRoomGrowthFeedbackStats(
    beforeMetrics,
    calculateRoomMetrics(freshGs, result.slot),
  );
  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomRepairFeedback(
    scene,
    slotIdx,
    freshSlot.hp,
    result.slot.hp,
    result.cost ?? repairCost,
    repairStats,
  );
  showRoomGrowthFeedback(scene, repairDelta, '방 내구도 복구', repairStats);
  logger.debug(`[REPAIR] slot ${slotIdx}: restored to ${result.slot.maxHp} HP (cost ${result.cost ?? repairCost}g)`);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

function applyRecommendedRoomDesign(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  recommendation: RoomDesignRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = { ...freshSlot, roomType: recommendation.roomType };
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = changeRoomSlotType(freshGs, slotIdx, recommendation.roomType);
  if (!result.ok) return;

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === recommendation.roomType);
  const accent = ROOM_TYPE_ACCENT[recommendation.roomType] ?? 0xc8921a;
  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomDesignFeedback(
    scene,
    slotIdx,
    typeDef?.name ?? recommendation.title,
    typeDef?.icon ?? '▣',
    freshDelta,
    accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${typeDef?.name ?? recommendation.title} 설계 적용`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

function registerRoomLoadoutFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  kind: 'monster' | 'trap',
  name: string,
  icon: string,
  delta: RoomMetricDelta,
  accent: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const actionLabel = kind === 'monster' ? '수호 라인 배치' : '함정 라인 설치';
  const parts = [
    delta.threatDelta !== 0 ? `위협 ${formatSignedPower(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSignedPower(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSignedPower(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
  const feedback: RoomDetailReturnFeedback = {
    kind,
    slotIdx,
    title: kind === 'monster' ? '수호자 배치 완료' : '함정 설치 완료',
    body: `${name} ${actionLabel}${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`,
    roomIcon: icon,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function previewMonsterLoadoutSlot(
  slot: DungeonSlot | null | undefined,
  monsterSlotIdx: number,
  monsterId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const monsterIds = Array.from({ length: cap.monsters }, (_, i) => slot.monsterIds?.[i]);
  monsterIds[monsterSlotIdx] = monsterId;
  return { ...slot, monsterIds };
}

function previewTrapLoadoutSlot(
  slot: DungeonSlot | null | undefined,
  trapSlotIdx: number,
  trapId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const trapIds = Array.from({ length: cap.traps }, (_, i) => slot.trapIds?.[i]);
  trapIds[trapSlotIdx] = trapId;
  return { ...slot, trapIds };
}

function applyRecommendedMonsterPlacement(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  monsterSlotIdx: number,
  recommendation: MonsterLoadoutRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = previewMonsterLoadoutSlot(freshSlot, monsterSlotIdx, recommendation.monsterId);
  if (!previewSlot) return;
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = assignMonsterToRoomSlot(freshGs, slotIdx, monsterSlotIdx, recommendation.monsterId);
  if (!result.ok) {
    logger.debug(`[ROOM] recommended monster assignment failed: ${result.reason}`);
    return;
  }

  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomLoadoutFeedback(
    scene,
    slotIdx,
    'monster',
    recommendation.name,
    recommendation.icon,
    freshDelta,
    recommendation.accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${recommendation.name} 배치 완료`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

function applyRecommendedTrapPlacement(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  trapSlotIdx: number,
  recommendation: TrapLoadoutRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = previewTrapLoadoutSlot(freshSlot, trapSlotIdx, recommendation.trapId);
  if (!previewSlot) return;
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = installTrapInRoomSlot(freshGs, slotIdx, trapSlotIdx, recommendation.trapId);
  if (!result.ok) {
    logger.debug(`[TRAP] recommended trap install failed: ${result.reason}`);
    return;
  }

  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomLoadoutFeedback(
    scene,
    slotIdx,
    'trap',
    recommendation.name,
    recommendation.icon,
    freshDelta,
    recommendation.accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${recommendation.name} 설치 완료`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}


// ─── Context / State ──────────────────────────────────────────────────────────

/** Mutable state managed by the overlay functions. */
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


// ─── Public API ───────────────────────────────────────────────────────────────

export function openRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  cellX: number,
  cellY: number,
): void {
  if (state.roomDetailContainer) return;

  state.scene = scene;
  const gs = cb.getGameState();

  // Store cell position for reopen after upgrade/assignment
  state.roomDetailSlotIdx = slotIdx;
  state.roomDetailCellX = cellX;
  state.roomDetailCellY = cellY;

  const prevSlots  = gs.dungeonSlots ?? [];
  let currentGs    = gs;
  if (!prevSlots[slotIdx]) {
    const result = ensureDungeonSlot(gs, slotIdx);
    if (!result.ok) return;
    currentGs = result.state;
    if (result.changed) {
      cb.saveAndRefresh(currentGs);
      cb.markRoomChanged?.(slotIdx);
    }
  }
  // Build a normalized UI copy of the slot (correct array sizes, no gs mutation)
  const rawSlot: DungeonSlot = (currentGs.dungeonSlots ?? [])[slotIdx];
  const slotCap = getRoomSlotCapacity(rawSlot.roomLevel, rawSlot.roomType);
  const slot: DungeonSlot = {
    ...rawSlot,
    monsterIds: Array.from({ length: slotCap.monsters }, (_, i) =>
      Array.isArray(rawSlot.monsterIds) ? rawSlot.monsterIds[i] : undefined,
    ),
    trapIds: Array.from({ length: slotCap.traps }, (_, i) =>
      Array.isArray(rawSlot.trapIds) ? rawSlot.trapIds[i] : undefined,
    ) };
  logger.debug(`[ROOM] Opening detail for slot ${slotIdx} Lv.${slot.roomLevel}`);

  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const c = scene.add.container(CW / 2, CH / 2).setDepth(100).setAlpha(0);
  state.roomDetailContainer = c;


  // ── Cave chamber background ─────────────────────────────────────────────────
  const t  = theme;
  const bg = scene.add.graphics();
  bg.fillStyle(t.stoneDark, 1);
  bg.fillRect(-CW / 2, -CH / 2, CW, CH);
  // Rock strata lines
  bg.lineStyle(1, t.stoneMid, 0.25);
  for (let ty = -CH / 2; ty < CH / 2; ty += 24) bg.lineBetween(-CW / 2, ty, CW / 2, ty);
  bg.lineStyle(1, t.stoneMid, 0.12);
  for (let tx = -CW / 2; tx < CW / 2; tx += 32) bg.lineBetween(tx, -CH / 2, tx, CH / 2);
  drawCaveWallTexture(bg, t, -CW / 2, -CH / 2, CW, CH, 99);
  // Cave wall edges
  bg.fillStyle(t.bgPrimary, 0.6);
  bg.fillRect(-CW / 2, -CH / 2, 14, CH);
  bg.fillRect(CW / 2 - 14, -CH / 2, 14, CH);
  // Stalactites at top, stalagmites at bottom
  drawStalactites(bg, t, -CH / 2 + 44, CW, 55);
  drawStalagmites(bg, t, CH / 2, CW, 66);
  c.add(bg);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 56;
  const hdrG = scene.add.graphics();
  hdrG.fillStyle(t.panelDark, 1);
  hdrG.fillRect(-CW / 2, -CH / 2, CW, headerH);
  hdrG.lineStyle(1, t.panelBorder, 0.5);
  hdrG.lineBetween(-CW / 2, -CH / 2 + headerH, CW / 2, -CH / 2 + headerH);
  c.add(hdrG);

  const backBtn = scene.add.text(-CW / 2 + 16, -CH / 2 + headerH / 2, '← 나가기', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: t.panelBorderCSS }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  backBtn.on('pointerdown', () => closeRoomDetail(state, cb));
  c.add(backBtn);

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const typeLabel = typeDef ? `${typeDef.icon} ${typeDef.name}` : '🏚 일반실';
  c.add(scene.add.text(0, -CH / 2 + headerH / 2,
    `방 #${slotIdx + 1}  ${typeLabel}  ${'★'.repeat(slot.roomLevel)}`, {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: t.textPrimary }).setOrigin(0.5));

  // ── Bioluminescent glow dots ────────────────────────────────────────────────
  const glowG = scene.add.graphics();
  for (const tx of [-CW / 2 + 18, CW / 2 - 18]) {
    glowG.fillStyle(t.glowColor, 0.15);
    glowG.fillCircle(tx, -CH / 2 + headerH + 14, 12);
    glowG.fillStyle(t.glowColor, 0.35);
    glowG.fillCircle(tx, -CH / 2 + headerH + 14, 5);
  }
  c.add(glowG);

  const content = scene.add.container(0, 0);
  c.add(content);

  // ── Layout constants ──────────────────────────────────────────────────────
  const secPad = 16;
  const secX   = -CW / 2 + secPad;
  const secW   = CW - secPad * 2;
  const roomFeedback = consumeRoomDetailFeedback(scene, slotIdx);

  // ── Nav callbacks (avoids circular import with RoomPickerModals) ─────────
  const nav: PickerNavCallbacks = {
    closeRoomDetail,
    openRoomDetail };

  const contentTopY = -CH / 2 + headerH + 10;
  const preBattleStripOffset = cb.isPreBattleEditActive?.() && cb.resumePreBattle
    ? drawPreBattleReturnStrip(scene, content, theme, cb, state, secX, contentTopY, secW) + 8
    : 0;
  const feedbackOffset = roomFeedback
    ? drawRoomDetailReturnFeedback(scene, content, theme, roomFeedback, secX, contentTopY + preBattleStripOffset, secW) + 8
    : 0;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const roomMetrics = calculateRoomMetrics(currentGs, slot);
  const actionDirective = getRoomDirective(scene, state, theme, cb, nav, slot, slotIdx, cap, monsterCount, trapCount, roomMetrics);
  const nextActionEntry = actionDirective.target !== 'none' && cb.openRoomSlot
    ? getNextRoomDetailAction(currentGs, slotIdx)
    : null;
  const previewY = -CH / 2 + headerH + 12 + preBattleStripOffset + feedbackOffset;
  const previewH = buildRoomInteriorPreview(
    scene, state, theme, cb, nav, content, currentGs, slot, slotIdx, secX, secW, previewY,
    actionDirective,
  );
  const actionHeaderY = previewY + previewH + 8;
  const actionHeaderH = drawRoomActionHeader(
    scene,
    content,
    actionDirective,
    secX,
    actionHeaderY,
    secW,
    {
      readiness: roomMetrics.readiness,
      monsterCount,
      monsterCapacity: cap.monsters,
      trapCount,
      trapCapacity: cap.traps,
      equipmentPower: roomMetrics.equipmentPower },
    nextActionEntry,
    nextActionEntry ? () => openQueuedRoomFromDetail(scene, state, cb, nextActionEntry.action.slotIdx) : undefined,
  );
  const typeStripY = actionHeaderY + actionHeaderH + 8;

  // ── Room Type Selector strip ───────────────────────────────────────────────
  const reopen = () => {
    closeRoomDetail(state, cb);
    setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), ROOM_DETAIL_REOPEN_DELAY_MS);
  };
  const typeStripH = buildRoomTypeStrip(
    scene, state, theme, cb, content, slot, slotIdx, secX, secW, typeStripY, reopen,
    shouldHighlightDirectiveTarget(actionDirective, 'type'),
  );
  const opsY = typeStripY + typeStripH + 8;
  const opsH = buildRoomOperationsPanel(
    scene, state, theme, cb, nav, content, currentGs, slot, slotIdx, secX, secW, opsY,
    shouldHighlightDirectiveTarget(actionDirective, 'growth'),
  );
  const monSecY = opsY + opsH + 8;

  // ── Monster Section ───────────────────────────────────────────────────────
  const monSecH = buildMonsterSection(
    scene, state, theme, cb, nav, content, slot, slotIdx, secX, secW, monSecY,
    shouldHighlightDirectiveTarget(actionDirective, 'monster'),
  );

  // ── Trap Section ──────────────────────────────────────────────────────────
  const trapSecY = monSecY + monSecH + 8;
  const trapSecH = buildTrapSection(
    scene, state, theme, cb, nav, content, slot, slotIdx, secX, secW, trapSecY,
    shouldHighlightDirectiveTarget(actionDirective, 'trap'),
  );

  // ── Room growth panel ─────────────────────────────────────────────────────
  const growthY = trapSecY + trapSecH + 14;
  const hpPct = Math.max(0, slot.hp / slot.maxHp);
  const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? 0xc8921a : 0x8b0000;
  const maxRoomLv = getMaxRoomLevel(gs.dmLevel);
  const isDamaged = slot.hp < slot.maxHp;
  const canShowUpgradeButton = slot.roomLevel < 5 && slot.roomLevel < maxRoomLv;
  const growthPanelH = isDamaged ? 252 : 216;
  const growthAccent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0xc8921a : 0xc8921a;
  const growthFrame = addFramedPanel(scene, {
    x: secX,
    y: growthY,
    w: secW,
    h: growthPanelH,
    radius: 10,
    fillColor: 0x160c04,
    borderColor: growthAccent,
    borderAlpha: 0.28,
    borderWidth: 1.2,
    accentColor: growthAccent,
    accentAlpha: 0.26,
    glowColor: growthAccent,
    glowOpacity: 0.05,
    shadowOpacity: 0.28,
    shadowOffsetY: 3 });
  content.add([growthFrame.shadow, growthFrame.panel, growthFrame.glow]);

  const growthG = scene.add.graphics();
  growthG.fillStyle(growthAccent, 0.08);
  growthG.fillRoundedRect(secX + 10, growthY + 10, secW - 20, 30, 8);
  growthG.fillStyle(0x050806, 0.76);
  growthG.fillRoundedRect(secX + secW - 72, growthY + 14, 56, 18, 7);
  growthG.lineStyle(1, growthAccent, 0.38);
  growthG.strokeRoundedRect(secX + secW - 72, growthY + 14, 56, 18, 7);
  content.add(growthG);

  content.add(scene.add.text(secX + 18, growthY + 25, '방 성장', {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#ffe1a8',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 44, growthY + 23, `Lv.${slot.roomLevel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffdf8a',
    fontStyle: 'bold' }).setOrigin(0.5));

  const durabilityY = growthY + 56;
  const durabilityBar = addProgressBar(scene, {
    x: secX + 72,
    y: durabilityY,
    w: secW - 126,
    h: 14,
    ratio: hpPct,
    fillColor: barColor,
    trackColor: 0x0e0900,
    borderColor: growthAccent,
    borderAlpha: 0.32,
    duration: 320 });
  content.add([durabilityBar.track, durabilityBar.fill]);
  content.add(scene.add.text(secX + 18, durabilityY + 7, '내구도', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#b78954',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 18, durabilityY + 7, `${slot.hp}/${slot.maxHp}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: hpPct > 0.33 ? '#ffdf8a' : '#ff8a6a',
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  let nextGrowthY = growthY + 86;
  if (isDamaged) {
    const missingHp = slot.maxHp - slot.hp;
    const repairCost = getRoomRepairCost(slot);
    const canRepair = gs.homeGold >= repairCost;
    const repairBtn = addPrimaryActionButton(scene, {
      x: secX + 18,
      y: nextGrowthY,
      w: secW - 36,
      h: 32,
      label: `내구 수리  ${repairCost}g  ·  HP +${missingHp}`,
      fontSize: '12px',
      enabled: canRepair,
      fillColor: 0x143010,
      hoverFillColor: 0x1c4616,
      borderColor: 0x5aaa40,
      hoverBorderColor: 0x9be66b,
      textColor: '#bbff66',
      disabledTextColor: '#664400',
      onPress: () => {
        applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot);
      } });
    content.add([repairBtn.bg, repairBtn.text, repairBtn.zone]);
    if (shouldHighlightDirectiveTarget(actionDirective, 'repair')) {
      drawSectionTargetPulse(scene, content, secX + 12, nextGrowthY - 4, secW - 24, 40, actionDirective.accent, '수리', 'none');
    }
    nextGrowthY += 42;
  }

  let upgradeSummary = '';
  if (canShowUpgradeButton) {
    const upgCost = getRoomUpgradeCost(slot.roomLevel);
    const newCap = getRoomSlotCapacity(slot.roomLevel + 1, slot.roomType);
    const cdBonus = ['-10%', '-20%', '-30%', '-40%'][slot.roomLevel - 1] ?? '-40%';
    const canUpgrade = gs.homeGold >= upgCost;
    upgradeSummary = `확장 시 수호 ${newCap.monsters} / 함정 ${newCap.traps}`;
    const upgBtn = addPrimaryActionButton(scene, {
      x: secX + 18,
      y: nextGrowthY,
      w: secW - 36,
      h: 42,
      label: `Lv.${slot.roomLevel} → ${slot.roomLevel + 1} 방 확장  (${upgCost}g)\n${upgradeSummary}`,
      fontSize: '12px',
      align: 'center',
      enabled: canUpgrade,
      fillColor: 0x2a1606,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      textColor: '#ffe080',
      onPress: () => {
        showRoomUpgradeConfirm(scene, upgCost, slot.roomLevel, newCap, () => {
          const freshGs = cb.getGameState();
          const freshSlot = freshGs.dungeonSlots?.[slotIdx];
          const previousLevel = freshSlot?.roomLevel ?? slot.roomLevel;
          const previousHp = freshSlot?.maxHp ?? slot.maxHp;
          const previousCap = getRoomSlotCapacity(previousLevel, freshSlot?.roomType ?? slot.roomType);
          const result = upgradeRoomSlot(freshGs, slotIdx);
          if (!result.ok) return;
          const upgradeDelta = freshSlot
            ? calculateRoomMetricDelta(freshGs, freshSlot, result.slot)
            : { threatDelta: 0, lootDelta: 0, readinessDelta: 0 };
          const upgradeStats = freshSlot
            ? buildRoomGrowthFeedbackStats(
                calculateRoomMetrics(freshGs, freshSlot),
                calculateRoomMetrics(freshGs, result.slot),
              )
            : undefined;
          cb.saveAndRefresh(result.state);
          cb.markRoomChanged?.(slotIdx);
          registerRoomUpgradeFeedback(
            scene,
            slotIdx,
            result.previousLevel ?? previousLevel,
            result.nextLevel ?? result.slot.roomLevel,
            previousHp,
            result.slot.maxHp,
            previousCap,
            getRoomSlotCapacity(result.slot.roomLevel, result.slot.roomType),
            upgradeStats,
          );
          showRoomGrowthFeedback(scene, upgradeDelta, `방 Lv.${result.nextLevel ?? result.slot.roomLevel} 확장`, upgradeStats);
          logger.debug(`[ROOM UPGRADE] slot ${slotIdx}: Lv.${result.previousLevel}→Lv.${result.nextLevel}  HP: ${freshSlot?.maxHp ?? 0}→${result.slot.maxHp}, cooldown bonus: ${cdBonus}`);
          closeRoomDetail(state, cb);
          setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, cellX, cellY), ROOM_DETAIL_REOPEN_DELAY_MS);
        });
      } });
    content.add([upgBtn.bg, upgBtn.text, upgBtn.zone]);
    nextGrowthY += 54;
  } else if (slot.roomLevel < 5 && slot.roomLevel >= maxRoomLv) {
    const neededDm = [5, 10, 15, 20][slot.roomLevel - 1] ?? 20;
    upgradeSummary = `DM Lv.${neededDm} 달성 후 다음 확장`;
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, `🔒 ${upgradeSummary}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#9b7650',
      fontStyle: 'bold',
      backgroundColor: '#0e0900',
      padding: { x: 10, y: 5 } }).setOrigin(0, 0.5));
    nextGrowthY += 36;
  } else {
    upgradeSummary = '최고 레벨 확장 완료';
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, '최고 레벨 (Lv.5)', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#ffe080',
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    nextGrowthY += 34;
  }

  const bonusDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === (slot.roomType ?? 'combat'));
  let contentBottom = growthY + growthPanelH + 18;
  if (bonusDef) {
    const bonusY = nextGrowthY + 2;
    const bonusH = 64;
    growthG.fillStyle(0x050806, 0.66);
    growthG.fillRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 8);
    growthG.lineStyle(1, growthAccent, 0.24);
    growthG.strokeRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 8);
    growthG.fillStyle(growthAccent, 0.16);
    growthG.fillRoundedRect(secX + 22, bonusY + 10, 5, bonusH - 20, 3);
    content.add(scene.add.text(secX + 36, bonusY + 14, `${bonusDef.icon} ${bonusDef.name} 특성`, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#ffdf8a',
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 36, bonusY + 34, bonusDef.bonus, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#c79b68',
      wordWrap: { width: secW - 88, useAdvancedWrap: true } }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 36, bonusY + 52, upgradeSummary || `현재 Lv.${slot.roomLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#7f6143' }).setOrigin(0, 0.5));
  }

  attachRoomDetailScroll(scene, state, c, content, contentBottom, headerH);

  // ── Expand animation from cell ─────────────────────────────────────────────
  const startScaleX = SLOT_W / CW;
  const startScaleY = SLOT_H / CH;
  const startX      = cellX + SLOT_W / 2 - CW / 2;
  const startY      = cellY + SLOT_H / 2 - CH / 2;
  c.setPosition(CW / 2 + startX, CH / 2 + startY).setScale(startScaleX, startScaleY);

  c.setAlpha(0);
  scene.tweens.add({
    targets: c,
    alpha: 1, scaleX: 1, scaleY: 1, x: CW / 2, y: CH / 2,
    duration: 300, ease: 'Quad.easeInOut' });
}

function attachRoomDetailScroll(
  scene: Phaser.Scene,
  state: RoomDetailState,
  overlay: Phaser.GameObjects.Container,
  content: Phaser.GameObjects.Container,
  contentBottom: number,
  headerH: number,
): void {
  const viewBottom = CANVAS_HEIGHT / 2 - 16;
  const maxScroll = Math.max(0, contentBottom - viewBottom);

  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(0, headerH, CANVAS_WIDTH, CANVAS_HEIGHT - headerH - 10);
  const mask = maskShape.createGeometryMask();
  content.setMask(mask);

  const applyScroll = (nextY: number): void => {
    content.setY(Phaser.Math.Clamp(nextY, -maxScroll, 0));
  };

  const isInScrollView = (pointer: Phaser.Input.Pointer): boolean =>
    pointer.x >= 0 && pointer.x <= CANVAS_WIDTH &&
    pointer.y >= headerH && pointer.y <= CANVAS_HEIGHT - 10;

  let updateButtons = (): void => {};

  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (maxScroll <= 0 || !isInScrollView(pointer)) return;
    applyScroll(content.y - deltaY * 0.45);
    updateButtons();
  };
  scene.input.on('wheel', onWheel);

  if (maxScroll > 0) {
    const buttonW = 34;
    const buttonH = 28;
    const buttonY = -CANVAS_HEIGHT / 2 + 14;
    const upButton = addPrimaryActionButton(scene, {
      x: CANVAS_WIDTH / 2 - 86,
      y: buttonY,
      w: buttonW,
      h: buttonH,
      label: '▲',
      fontSize: '12px',
      fillColor: 0x241208,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      onPress: () => {
        applyScroll(content.y + 150);
        updateButtons();
      } });
    const downButton = addPrimaryActionButton(scene, {
      x: CANVAS_WIDTH / 2 - 48,
      y: buttonY,
      w: buttonW,
      h: buttonH,
      label: '▼',
      fontSize: '12px',
      fillColor: 0x241208,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      onPress: () => {
        applyScroll(content.y - 150);
        updateButtons();
      } });
    overlay.add([upButton.bg, upButton.text, upButton.zone, downButton.bg, downButton.text, downButton.zone]);

    const setButtonState = (button: ReturnType<typeof addPrimaryActionButton>, enabled: boolean): void => {
      button.bg.setAlpha(enabled ? 0.88 : 0.24);
      button.text.setAlpha(enabled ? 1 : 0.3);
      if (enabled) button.zone.setInteractive({ useHandCursor: true });
      else button.zone.disableInteractive();
    };

    updateButtons = (): void => {
      setButtonState(upButton, content.y < -1);
      setButtonState(downButton, content.y > -maxScroll + 1);
    };
    updateButtons();
  }

  state.roomDetailScrollCleanup = () => {
    scene.input.off('wheel', onWheel);
    content.clearMask(false);
    mask.destroy();
    maskShape.destroy();
  };
}


// ─── Operations summary ──────────────────────────────────────────────────────

function buildRoomOperationsPanel(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number,
  secW: number,
  secY: number,
  highlightTarget = false,
): number {
  const canResumePreBattle = Boolean(cb.isPreBattleEditActive?.() && cb.resumePreBattle);
  const panelH = canResumePreBattle ? 188 : 178;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const roomMetrics = calculateRoomMetrics(gs, slot);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const directive = getRoomDirective(scene, state, theme, cb, nav, slot, slotIdx, cap, monsterCount, trapCount, roomMetrics);
  const status = slot.roomType && slot.hp <= 0
    ? '수리 필요'
    : !slot.roomType
      ? '설계 대기'
      : monsterCount > 0 || trapCount > 0
        ? '가동 중'
        : '배치 대기';

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: panelH,
    radius: 10,
    fillColor: 0x07100d,
    borderColor: 0x2f8f75,
    borderAlpha: 0.38,
    borderWidth: 1.2,
    accentColor: 0x66c08a,
    accentAlpha: 0.34,
    glowColor: 0x66c08a,
    glowOpacity: 0.04,
    shadowOpacity: 0.26,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, panelH, 0x44aa77, '전력 보강');
  }

  const g = scene.add.graphics();
  g.fillStyle(0x66c08a, 0.07);
  g.fillRoundedRect(secX + 10, secY + 10, secW - 20, 28, 7);
  g.lineStyle(1, 0x2f8f75, 0.18);
  g.lineBetween(secX + 14, secY + 58, secX + secW - 14, secY + 58);
  c.add(g);

  c.add(scene.add.text(secX + 18, secY + 24, '운영 현황', {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#c8e8b0',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 18, secY + 24, `${typeDef?.name ?? '미설계'} · ${status}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: slot.roomType && slot.hp <= 0 ? '#ff7766' : slot.roomType ? '#88ffcc' : '#d0a86c',
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  const readinessW = secW - 156;
  const readinessY = secY + 48;
  g.fillStyle(0x07100d, 1);
  g.fillRoundedRect(secX + 14, readinessY, readinessW, 8, 4);
  g.fillStyle(roomMetrics.readiness >= 70 ? 0x66c08a : roomMetrics.readiness >= 35 ? 0xc8921a : 0x8a4c32, 0.92);
  g.fillRoundedRect(secX + 14, readinessY, Math.max(5, readinessW * roomMetrics.readiness / 100), 8, 4);
  c.add(scene.add.text(secX + 14, readinessY - 10, `준비도 ${roomMetrics.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
    x: secX + secW - 142,
    y: secY + 39,
    w: 128,
    h: 18,
    accent: slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0x66c08a : 0x66c08a,
    showLabels: true });

  c.add(scene.add.text(secX + 18, secY + 73, '다음 지시', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  drawRoomDirective(scene, c, directive, secX + 14, secY + 84, secW - 28);

  const shortcutY = secY + 144;
  const shortcutW = canResumePreBattle ? (secW - 42) / 3 : (secW - 34) / 2;
  const shortcutGap = canResumePreBattle ? 7 : 6;
  const firstMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
  const addShortcut = (
    x: number,
    label: string,
    fillColor: number,
    borderColor: number,
    textColor: string,
    onPress: () => void,
  ): void => {
    const button = addPrimaryActionButton(scene, {
      x,
      y: shortcutY,
      w: shortcutW,
      h: 26,
      label,
      fontSize: '10px',
      fillColor,
      hoverFillColor: fillColor,
      borderColor,
      hoverBorderColor: 0xffdf6e,
      textColor,
      onPress });
    c.add([button.bg, button.text, button.zone]);
  };

  addShortcut(secX + 14, canResumePreBattle ? '👹 성장' : '👹 성장/레벨업', 0x123a2b, 0x5fb854, '#c8ffe0', () => {
    if (firstMonsterId) {
      navigateToFocusedMonster(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
  });
  addShortcut(secX + 14 + shortcutW + shortcutGap, canResumePreBattle ? '⚒ 장비' : '⚒ 장비 강화', 0x2e2142, 0x9a6cd8, '#e4d8ff', () => {
    if (firstMonsterId) {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
  });
  if (canResumePreBattle) {
    addShortcut(secX + 14 + (shortcutW + shortcutGap) * 2, '⚔ 침공 복귀', 0x27445a, 0xe8c468, '#f0e6c8', () => {
      closeRoomDetail(state, cb);
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    });
  }

  return panelH;
}

function getRoomDirective(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  slot: DungeonSlot,
  slotIdx: number,
  cap: { monsters: number; traps: number },
  monsterCount: number,
  trapCount: number,
  roomMetrics: RoomOperationalMetrics,
): RoomDirective {
  const firstMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  const firstTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const gs = cb.getGameState();
  const recommendation = !slot.roomType ? getRoomDesignRecommendation(gs, slotIdx) : null;

  if (slot.roomType && slot.hp <= 0) {
    const repairCost = getRoomRepairCost(slot);
    const canRepair = gs.homeGold >= repairCost;
    return {
      title: '수리 우선',
      body: `HP ${slot.hp}/${slot.maxHp} · 수리 ${repairCost}g`,
      ctaLabel: canRepair ? '즉시 수리' : '골드 부족',
      target: 'repair',
      accent: 0xff5544,
      fillColor: 0x22100c,
      textColor: '#ffb09a',
      enabled: canRepair,
      onPress: () => applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot) };
  }

  if (!slot.roomType) {
    return {
      title: recommendation ? `${recommendation.title}` : '방 역할 설계',
      body: recommendation?.reason ?? '먼저 전투실, 함정실, 지원실, 마법실 중 역할을 정하세요.',
      ctaLabel: recommendation ? '추천 적용' : '아래에서 설계',
      target: 'type',
      accent: 0x55b88a,
      fillColor: 0x08151c,
      textColor: '#c8f1ff',
      onPress: recommendation
        ? () => applyRecommendedRoomDesign(scene, state, theme, cb, slotIdx, slot, recommendation)
        : undefined };
  }

  if (firstMonsterSlot >= 0) {
    const monsterRecommendation = getMonsterLoadoutRecommendation(gs, slotIdx);
    if (monsterRecommendation) {
      return {
        title: '추천 수호자 배치',
        body: `${monsterRecommendation.name} · ${monsterRecommendation.reason}`,
        ctaLabel: '추천 배치',
        target: 'monster',
        accent: monsterRecommendation.accent,
        fillColor: 0x1f1208,
        textColor: '#ffe1c2',
        onPress: () => applyRecommendedMonsterPlacement(
          scene,
          state,
          theme,
          cb,
          slotIdx,
          slot,
          firstMonsterSlot,
          monsterRecommendation,
        ) };
    }
    return {
      title: '수호자 배치',
      body: `빈 몬스터 슬롯 ${cap.monsters - monsterCount}개가 남았습니다.`,
      ctaLabel: '즉시 배치',
      target: 'monster',
      accent: 0xff8a45,
      fillColor: 0x1f1208,
      textColor: '#ffe1c2',
      onPress: () => showMonsterPicker(scene, state, theme, cb, nav, slotIdx, firstMonsterSlot) };
  }

  if (cap.traps > 0 && firstTrapSlot >= 0) {
    const trapRecommendation = getTrapLoadoutRecommendation(gs, slotIdx);
    if (trapRecommendation) {
      return {
        title: '추천 함정 설치',
        body: `${trapRecommendation.name} · ${trapRecommendation.reason}`,
        ctaLabel: '추천 설치',
        target: 'trap',
        accent: trapRecommendation.accent,
        fillColor: 0x201605,
        textColor: '#ffe3a0',
        onPress: () => applyRecommendedTrapPlacement(
          scene,
          state,
          theme,
          cb,
          slotIdx,
          slot,
          firstTrapSlot,
          trapRecommendation,
        ) };
    }
    return {
      title: '함정 설치',
      body: `침입 경로에 빈 함정 슬롯 ${cap.traps - trapCount}개가 있습니다.`,
      ctaLabel: '즉시 설치',
      target: 'trap',
      accent: 0xc8921a,
      fillColor: 0x201605,
      textColor: '#ffe3a0',
      onPress: () => showTrapPicker(scene, state, theme, cb, nav, slotIdx, firstTrapSlot) };
  }

  const assignedMonsterIds = slot.monsterIds.filter((monsterId): monsterId is string =>
    typeof monsterId === 'string' && monsterId.length > 0,
  );
  const firstUnequippedMonsterId = assignedMonsterIds.find(monsterId =>
    !gs.ownedMonsters.find(monster => monster.id === monsterId)?.equipment,
  );
  if (firstUnequippedMonsterId) {
    const focusMonsterDef = MONSTER_DEFS[firstUnequippedMonsterId as keyof typeof MONSTER_DEFS] ?? null;
    return {
      title: '장비 보강',
      body: `${focusMonsterDef?.name ?? '수호자'} 장비가 비어 있습니다. 제작소에서 바로 보강하세요.`,
      ctaLabel: '장비 강화',
      target: 'growth',
      accent: 0x9a6cd8,
      fillColor: 0x151026,
      textColor: '#e4d8ff',
      onPress: () => navigateToFocusedForge(scene, state, cb, firstUnequippedMonsterId, slotIdx) };
  }

  const targetLevel = Math.max(2, gs.dmLevel - 1);
  const underleveledMonster = assignedMonsterIds
    .map(monsterId => gs.ownedMonsters.find(monster => monster.id === monsterId))
    .find(monster => monster && monster.level < targetLevel);
  if (underleveledMonster) {
    const focusMonsterDef = MONSTER_DEFS[underleveledMonster.id as keyof typeof MONSTER_DEFS] ?? null;
    return {
      title: '수호자 성장 필요',
      body: `${focusMonsterDef?.name ?? '수호자'} Lv.${underleveledMonster.level} · 목표 Lv.${targetLevel}`,
      ctaLabel: '수호자 성장',
      target: 'growth',
      accent: 0x44aa77,
      fillColor: 0x0b1b14,
      textColor: '#c8ffe0',
      onPress: () => navigateToFocusedMonster(scene, state, cb, underleveledMonster.id, slotIdx) };
  }

  if (roomMetrics.readiness < 78) {
    const focusMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
    const focusMonsterDef = focusMonsterId ? MONSTER_DEFS[focusMonsterId as keyof typeof MONSTER_DEFS] : null;
    return {
      title: focusMonsterDef ? '수호자 성장 필요' : '전력 보강',
      body: focusMonsterDef
        ? `${focusMonsterDef.name} 성장/장비 보강으로 방 준비도를 올리세요.`
        : '몬스터 성장이나 장비 제작으로 준비도를 더 올릴 수 있습니다.',
      ctaLabel: focusMonsterDef ? '수호자 성장' : '성장 이동',
      target: 'growth',
      accent: 0x44aa77,
      fillColor: 0x0b1b14,
      textColor: '#c8ffe0',
      onPress: () => {
        if (focusMonsterId) {
          navigateToFocusedMonster(scene, state, cb, focusMonsterId, slotIdx);
          return;
        }
        navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
      } };
  }

  const nextActionEntry = getNextRoomDetailAction(gs, slotIdx);
  if (nextActionEntry && cb.openRoomSlot) {
    const { action: nextAction, rank: nextActionRank } = nextActionEntry;
    return {
      title: '가동 완비',
      body: `${nextActionRank}순 작업: 방 #${nextAction.slotIdx + 1} ${nextAction.label} · ${nextAction.body}`,
      ctaLabel: `방 #${nextAction.slotIdx + 1} ${nextAction.label}`,
      target: 'none',
      accent: nextAction.accent,
      fillColor: 0x071812,
      textColor: '#b7ffe8',
      onPress: () => openQueuedRoomFromDetail(scene, state, cb, nextAction.slotIdx) };
  }

  if (cb.startBattle) {
    return {
      title: '전투 준비 완료',
      body: '모든 작업 큐가 비었습니다. 다음 침공 방어로 진행하세요.',
      ctaLabel: '침공 준비',
      target: 'none',
      accent: 0xe8c468,
      fillColor: 0x1f1506,
      textColor: '#ffe8a6',
      onPress: () => startBattleFromRoomDetail(scene, state, cb) };
  }

  return {
    title: '가동 완비',
    body: '이 방은 다음 침입을 막을 준비가 끝났습니다.',
    ctaLabel: '완비',
    target: 'none',
    accent: 0x66c08a,
    fillColor: 0x071812,
    textColor: '#b7ffe8' };
}

function getNextRoomDetailAction(
  state: GameState,
  currentSlotIdx: number,
): RoomDetailNextActionEntry | null {
  const unlockedSlots = getUnlockedSlots(state.dmLevel);
  const queue = getDungeonActionQueue(state, unlockedSlots);
  const index = queue.findIndex(action => action.slotIdx !== currentSlotIdx);
  if (index < 0) return null;
  return { action: queue[index], rank: index + 1 };
}

function openQueuedRoomFromDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  slotIdx: number,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.openRoomSlot?.(slotIdx);
  });
}

function startBattleFromRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.startBattle?.();
  });
}

export function findFirstEmptySlot(ids: readonly (string | undefined)[], cap: number): number {
  for (let i = 0; i < cap; i++) {
    if (!ids[i]) return i;
  }
  return -1;
}

function drawRoomDirective(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  directive: RoomDirective,
  x: number,
  y: number,
  w: number,
): void {
  const h = 48;
  const ctaW = 86;
  const g = scene.add.graphics();
  g.fillStyle(directive.fillColor, 0.96);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(1.2, directive.accent, 0.58);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(directive.accent, 0.20);
  g.fillRoundedRect(x + 5, y + 5, 4, h - 10, 3);
  g.fillStyle(directive.accent, 0.08);
  g.fillRoundedRect(x + 13, y + 7, w - ctaW - 30, h - 14, 7);
  c.add(g);

  c.add(scene.add.text(x + 18, y + 14, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    color: directive.textColor,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 18, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ebcae',
    wordWrap: { width: w - ctaW - 42, useAdvancedWrap: true } }).setOrigin(0, 0.5));

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 8,
      y: y + 8,
      w: ctaW,
      h: 32,
      label: directive.ctaLabel,
      fontSize: '10px',
      fillColor: directive.fillColor,
      hoverFillColor: directive.fillColor,
      borderColor: directive.accent,
      hoverBorderColor: 0xffdf6e,
      textColor: directive.textColor,
      onPress: directive.onPress });
    c.add([button.bg, button.text, button.zone]);
    return;
  }

  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  g.lineStyle(1, directive.accent, 0.34);
  g.strokeRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  c.add(scene.add.text(x + w - ctaW / 2 - 8, y + 24, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function navigateFromRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  sceneKey: string,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 30, () => {
    if (cb.navigateToScene) {
      cb.navigateToScene(sceneKey);
      return;
    }
    scene.scene.start(sceneKey);
  });
}

// ─── Close ────────────────────────────────────────────────────────────────────

export function closeRoomDetail(
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  if (state.roomDetailScrollCleanup) { state.roomDetailScrollCleanup(); state.roomDetailScrollCleanup = null; }
  if (state.trapPickerContainer)   { state.trapPickerContainer.destroy();   state.trapPickerContainer   = null; }
  if (state.monsterPickerContainer) { state.monsterPickerContainer.destroy(); state.monsterPickerContainer = null; }
  if (!state.roomDetailContainer) return;
  const c = state.roomDetailContainer;
  state.roomDetailContainer = null;
  state.roomDetailSlotIdx = null;

  const tweenScene = state.scene;
  if (tweenScene) {
    tweenScene.tweens.add({
      targets: c,
      alpha: 0, scaleX: 0.7, scaleY: 0.7,
      duration: ROOM_DETAIL_CLOSE_MS, ease: 'Linear',
      onComplete: () => { c.destroy(); cb.rebuildDungeonSlots(); } });
  } else {
    c.destroy();
    cb.rebuildDungeonSlots();
  }
}


// ─── Room Type Strip ──────────────────────────────────────────────────────────

function buildRoomTypeStrip(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
  _cb: RoomDetailCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  _slotIdx: number,
  secX: number, secW: number, secY: number,
  reopen: () => void,
  highlightTarget = false,
): number {
  const stripH = 126;
  const activeType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const designGs = _cb.getGameState();
  const recommendation = activeType ? null : getRoomDesignRecommendation(designGs, _slotIdx);
  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: stripH,
    radius: 8,
    fillColor: 0x130c04,
    borderColor: 0x3a2010,
    borderAlpha: 0.45,
    borderWidth: 1,
    glowColor: 0xc8921a,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 2 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, stripH, 0x55b88a, '다음 선택');
  }

  c.add(scene.add.text(secX + 14, secY + 15, '방 설계 타입', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#c8921a',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 14, secY + 15, activeType ? `${activeType.name} 적용 중` : recommendation ? `추천 ${recommendation.shortLabel}` : '역할 미설정', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: activeType ? '#ffdd88' : recommendation ? '#88ffcc' : '#806040' }).setOrigin(1, 0.5));
  if (recommendation) {
    c.add(scene.add.text(secX + 14, secY + 32, `추천: ${recommendation.title} · ${recommendation.reason}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#88ffcc',
      wordWrap: { width: secW - 28, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  }

  const cardY = secY + 44;
  const cardH = 74;
  const btnW = (secW - 10) / 4;
  ROOM_SLOT_TYPE_DEFS.forEach((td, i) => {
    const bx   = secX + 5 + i * btnW;
    const isActive = slot.roomType === td.id;
    const isRecommended = recommendation?.roomType === td.id;
    const accent = ROOM_TYPE_ACCENT[td.id] ?? 0xc8921a;
    const delta = calculateRoomMetricDelta(designGs, slot, { ...slot, roomType: td.id });
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(isActive ? accent : isRecommended ? 0x102820 : 0x241208, isActive ? 0.86 : isRecommended ? 0.92 : 0.66);
    btnBg.fillRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.lineStyle(isRecommended ? 1.7 : 1.2, accent, isActive || isRecommended ? 0.95 : 0.35);
    btnBg.strokeRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.fillStyle(isActive ? 0xffffff : accent, isActive ? 0.13 : 0.08);
    btnBg.fillRoundedRect(bx + 8, cardY + 5, btnW - 18, 3, 2);
    c.add(btnBg);
    const tagLabel = isActive ? '적용' : isRecommended ? '추천' : ROOM_TYPE_ROLE_CHIP[td.id] ?? '설계';
    drawCompactRoomTypeStateTag(scene, c, bx + 8, cardY + 10, tagLabel, accent, isActive, isRecommended);
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 31, td.icon, {
      fontFamily: 'sans-serif', fontSize: '17px' }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 49, td.name, {
      fontFamily: 'Georgia, serif', fontSize: '10px',
      color: isActive ? '#0e0900' : isRecommended ? '#d8fff5' : '#a07040',
      fontStyle: isActive || isRecommended ? 'bold' : 'normal' }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 64, isActive ? '적용중' : isRecommended ? recommendation.shortLabel : formatRoomTypeDelta(delta.threatDelta, delta.readinessDelta, td.id), {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: isActive ? '#0e0900' : isRecommended ? '#88ffcc' : '#6f5636',
      fontStyle: isRecommended ? 'bold' : 'normal' }).setOrigin(0.5));

    const zone = scene.add.zone(bx + btnW / 2, cardY + cardH / 2, btnW - 4, cardH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (isActive) return;
      const freshGs = _cb.getGameState();
      const freshSlot = freshGs.dungeonSlots?.[_slotIdx] ?? slot;
      const previewSlot = { ...freshSlot, roomType: td.id };
      const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
      const growthStats = buildRoomGrowthFeedbackStats(
        calculateRoomMetrics(freshGs, freshSlot),
        calculateRoomMetrics(freshGs, previewSlot),
      );
      const result = changeRoomSlotType(freshGs, _slotIdx, td.id);
      if (!result.ok) return;
      _cb.saveAndRefresh(result.state);
      _cb.markRoomChanged?.(_slotIdx);
      registerRoomDesignFeedback(scene, _slotIdx, td.name, td.icon, freshDelta, accent, growthStats);
      showRoomGrowthFeedback(scene, freshDelta, `${td.name} 설계 적용`, growthStats);
      reopen();
    });
    c.add(zone);
  });

  return stripH;
}

function formatRoomTypeDelta(
  threatDelta: number,
  readinessDelta: number,
  roomType: string,
): string {
  if (threatDelta > 0) return `위협 +${threatDelta}`;
  if (readinessDelta > 0) return `준비 +${readinessDelta}%`;
  return ROOM_TYPE_SHORT_BONUS[roomType] ?? '역할 변경';
}


// ─── Monster Section ──────────────────────────────────────────────────────────

function buildMonsterSection(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
  highlightTarget = false,
): number {
  const gs = cb.getGameState();
  const cap    = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const perRow = Math.min(3, Math.max(1, cap.monsters));
  const gap    = 8;
  const cardH  = 94;
  const rows   = Math.ceil(cap.monsters / perRow);
  const cardW  = (secW - 24 - gap * (perRow - 1)) / perRow;
  const secH   = 38 + rows * cardH + Math.max(0, rows - 1) * gap + 10;
  const firstEmptyMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  const monsterRecommendation = firstEmptyMonsterSlot >= 0
    ? getMonsterLoadoutRecommendation(gs, slotIdx)
    : null;

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: secH,
    radius: 10,
    fillColor: 0x241208,
    borderColor: 0xc8921a,
    borderAlpha: 0.36,
    borderWidth: 1.2,
    accentColor: 0xc8921a,
    accentAlpha: 0.28,
    glowColor: 0xc8921a,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, MONSTER_ROW_ACCENT, '다음 배치');
  }

  const assignedCount = slot.monsterIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '👊 수호 라인 슬롯', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    fontStyle: 'bold' }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${assignedCount}/${cap.monsters}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: assignedCount > 0 ? '#ffdd88' : '#806040' }).setOrigin(1, 0));

  for (let mi = 0; mi < cap.monsters; mi++) {
    const col    = mi % perRow;
    const row    = Math.floor(mi / perRow);
    const cardX  = secX + 12 + col * (cardW + gap);
    const cardY  = secY + 34 + row * (cardH + gap);
    const mId    = slot.monsterIds[mi];
    const om     = mId ? gs.ownedMonsters.find(m => m.id === mId) : null;
    const typeId = om ? (Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id) : null;
    const mDef   = typeId ? MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] : null;

    drawCompactLoadoutSlotFrame(scene, c, cardX, cardY, cardW, cardH, MONSTER_ROW_ACCENT, !!mDef && !!om, `M${mi + 1}`);

    if (mDef && om) {
      const equipment = getEquippedItem(gs, om.id);
      const typeAccent = MONSTER_TYPE_COLOR[mDef.type] ?? MONSTER_ROW_ACCENT;
      const rarity = getMonsterRarityMeta(mDef);
      drawCollectorCardSkin(scene, c, cardX, cardY, cardW, cardH, rarity, true);
      addMonsterPortrait(scene, c, cardX + 27, cardY + 35, om.id, {
        size: 36,
        frameColor: rarity.color,
        glowColor: rarity.color,
        bgColor: 0x070908,
        equippedSkins: gs.equippedSkins ?? {} });
      addCompactEquipmentSocket(scene, c, cardX + 40, cardY + 23, equipment, MONSTER_ROW_ACCENT);
      addCompactAttributeChip(
        scene,
        c,
        cardX + 52,
        cardY + 14,
        MONSTER_TYPE_LABEL[mDef.type] ?? mDef.type,
        typeAccent,
      );
      c.add(scene.add.text(cardX + 52, cardY + 32, fitSlotLabel(mDef.name, 6), {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e8d090',
        fontStyle: 'bold' }).setOrigin(0, 0.5));
      c.add(scene.add.text(cardX + 52, cardY + 47, `Lv.${om.level} · ATK ${mDef.baseDamage}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#a07040' }).setOrigin(0, 0.5));
      drawCompactGrowthMeter(
        scene,
        c,
        cardX + 52,
        cardY + 55,
        Math.max(28, cardW - 63),
        om.xp ?? 0,
        typeAccent,
      );
      const swapW = Math.max(33, Math.min(39, cardW * 0.36));
      const growW = Math.max(40, cardW - 23 - swapW);
      addCompactLoadoutButton(scene, c, cardX + 7, cardY + cardH - 27, swapW, '교체', MONSTER_ROW_ACCENT, () => {
        showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
      });
      addCompactLoadoutButton(scene, c, cardX + 15 + swapW, cardY + cardH - 27, growW, cardW < 114 ? '성장' : '성장 관리', 0x66c08a, () => {
        navigateToFocusedMonster(scene, state, cb, om.id, slotIdx);
      }, true);
    } else {
      if (monsterRecommendation && mi === firstEmptyMonsterSlot) {
        addRecommendedMonsterSlotPreview(
          scene, c, cardX, cardY, cardW, cardH, MONSTER_ROW_ACCENT,
          monsterRecommendation,
          () => applyRecommendedMonsterPlacement(
            scene, state, theme, cb, slotIdx, slot, mi, monsterRecommendation,
          ),
          () => showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi),
        );
      } else {
        addCompactEmptySlotGlyph(scene, c, cardX + 27, cardY + 35, MONSTER_ROW_ACCENT, '+');
        addCompactAttributeChip(scene, c, cardX + 52, cardY + 17, '대기', MONSTER_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 35, '수호 설계', {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#8a6a4a',
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        drawCompactEmptyMonsterPlanTag(scene, c, cardX + 52, cardY + 48, Math.max(38, cardW - 63), MONSTER_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 61, '새 수호자', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#6f5636',
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        addCompactLoadoutButton(scene, c, cardX + 10, cardY + cardH - 27, cardW - 20, '배치', MONSTER_ROW_ACCENT, () => {
          showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
        }, true);
      }
    }
  }

  return secH;
}


// ─── Trap Section ─────────────────────────────────────────────────────────────

function buildTrapSection(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
  highlightTarget = false,
): number {
  const cap  = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const perRow = Math.min(3, Math.max(1, cap.traps));
  const gap    = 8;
  const cardH  = 90;
  const rows   = Math.ceil(cap.traps / perRow);
  const cardW  = (secW - 24 - gap * (perRow - 1)) / perRow;
  const secH   = 38 + rows * cardH + Math.max(0, rows - 1) * gap + 10;
  const firstEmptyTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const trapRecommendation = firstEmptyTrapSlot >= 0
    ? getTrapLoadoutRecommendation(cb.getGameState(), slotIdx)
    : null;

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: secH,
    radius: 10,
    fillColor: 0x0f0f0f,
    borderColor: 0x664400,
    borderAlpha: 0.36,
    borderWidth: 1.2,
    accentColor: 0x664400,
    accentAlpha: 0.24,
    glowColor: 0xc8921a,
    glowOpacity: 0.03,
    shadowOpacity: 0.24,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, TRAP_ROW_ACCENT, '다음 설치');
  }

  const installedCount = slot.trapIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '🕸 함정 라인 슬롯', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    fontStyle: 'bold' }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${installedCount}/${cap.traps}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: installedCount > 0 ? '#ffdd88' : '#806040' }).setOrigin(1, 0));

  for (let ti = 0; ti < cap.traps; ti++) {
    const col = ti % perRow;
    const row = Math.floor(ti / perRow);
    const cardX = secX + 12 + col * (cardW + gap);
    const cardY = secY + 34 + row * (cardH + gap);
    const trap = TRAP_DEFS.find(t => t.id === slot.trapIds[ti]);

    drawCompactLoadoutSlotFrame(scene, c, cardX, cardY, cardW, cardH, TRAP_ROW_ACCENT, !!trap, `T${ti + 1}`);

    if (trap) {
      const iconX = cardX + 27;
      const trapIconG = scene.add.graphics();
      trapIconG.fillStyle(0x050806, 0.94);
      trapIconG.fillCircle(iconX, cardY + 33, 18);
      trapIconG.lineStyle(1.2, TRAP_ROW_ACCENT, 0.54);
      trapIconG.strokeCircle(iconX, cardY + 33, 18);
      trapIconG.fillStyle(TRAP_ROW_ACCENT, 0.12);
      trapIconG.fillCircle(iconX, cardY + 33, 12);
      c.add(trapIconG);
      c.add(scene.add.text(iconX, cardY + 33, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '19px' }).setOrigin(0.5));
      addCompactAttributeChip(scene, c, cardX + 52, cardY + 12, '설비', TRAP_ROW_ACCENT);
      c.add(scene.add.text(cardX + 52, cardY + 30, fitSlotLabel(trap.name, 6), {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
        fontStyle: 'bold' }).setOrigin(0, 0.5));
      drawCompactTrapEffectTag(
        scene,
        c,
        cardX + 52,
        cardY + 42,
        Math.max(38, cardW - 63),
        trap.desc,
        TRAP_ROW_ACCENT,
      );
      c.add(scene.add.text(cardX + 52, cardY + 58, formatCompactTrapCost(trap.cost, trap.unlockLv, cardW < 114), {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#8a6a4a',
        fontStyle: 'bold' }).setOrigin(0, 0.5));
      const swapW = Math.max(33, Math.min(39, cardW * 0.36));
      const manageW = Math.max(40, cardW - 23 - swapW);
      addCompactLoadoutButton(scene, c, cardX + 7, cardY + cardH - 27, swapW, '교체', TRAP_ROW_ACCENT, () => {
        showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
      });
      addCompactLoadoutButton(scene, c, cardX + 15 + swapW, cardY + cardH - 27, manageW, '회수', 0xffc44d, () => {
        const result = removeTrapFromRoomSlot(cb.getGameState(), slotIdx, ti);
        if (!result.ok) return;
        cb.saveAndRefresh(result.state);
        cb.markRoomChanged?.(slotIdx);
        logger.debug(`[TRAP] slot ${slotIdx}[${ti}] removed, refund: ${result.refund ?? 0}g`);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), ROOM_DETAIL_REOPEN_DELAY_MS);
      });
    } else {
      if (trapRecommendation && ti === firstEmptyTrapSlot) {
        addRecommendedTrapSlotPreview(
          scene, c, cardX, cardY, cardW, cardH, TRAP_ROW_ACCENT,
          trapRecommendation,
          () => applyRecommendedTrapPlacement(
            scene, state, theme, cb, slotIdx, slot, ti, trapRecommendation,
          ),
          () => showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti),
        );
      } else {
        addCompactEmptySlotGlyph(scene, c, cardX + 27, cardY + 33, TRAP_ROW_ACCENT, '+');
        addCompactAttributeChip(scene, c, cardX + 52, cardY + 12, '대기', TRAP_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 31, '함정 설계', {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#8a6a4a',
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        drawCompactEmptyTrapPlanTag(scene, c, cardX + 52, cardY + 43, Math.max(38, cardW - 63), TRAP_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 58, '새 설비', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#6f5636',
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        addCompactLoadoutButton(scene, c, cardX + 10, cardY + cardH - 27, cardW - 20, '설치', TRAP_ROW_ACCENT, () => {
          showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
        }, true);
      }
    }
  }

  return secH;
}


// ─── Room Upgrade Confirm Dialog ─────────────────────────────────────────────

function showRoomUpgradeConfirm(
  scene: Phaser.Scene,
  cost: number,
  currentLevel: number,
  newCap: { monsters: number; traps: number },
  onConfirm: () => void,
): void {
  const OW = 280, OH = 170;
  const OX = (CANVAS_WIDTH  - OW) / 2;
  const OY = (CANVAS_HEIGHT - OH) / 2;

  const ov = scene.add.container(0, 0).setDepth(200).setAlpha(0);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const frame = addFramedPanel(scene, {
    x: OX,
    y: OY,
    w: OW,
    h: OH,
    radius: 8,
    fillColor: 0x1e1206,
    borderColor: 0xc8921a,
    borderAlpha: 0.9,
    accentColor: 0xc8921a,
    accentAlpha: 0.65,
    glowColor: 0xc8921a,
    glowOpacity: 0.09,
    shadowOpacity: 0.75,
    shadowOffsetY: 5 });
  ov.add([frame.shadow, frame.panel, frame.glow]);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 26, '⬆️ 방 업그레이드', {
    fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: '#c8921a' }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 52, `Lv.${currentLevel} → Lv.${currentLevel + 1}`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0e6c8' }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 70, `비용: 💰 ${cost} 골드`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcc44' }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 90, `몬스터 ${newCap.monsters}슬롯 / 함정 ${newCap.traps}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#a07040' }).setOrigin(0.5));

  const confirmBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 - 124,
    y: OY + OH - 46,
    w: 104,
    h: 34,
    label: '업그레이드',
    fontSize: '12px',
    fillColor: 0x2a1400,
    hoverFillColor: 0x3c2100,
    borderColor: 0xc8921a,
    hoverBorderColor: 0xffcc44,
    textColor: '#ffe080',
    once: true,
    onPress: () => { ov.destroy(true); onConfirm(); } });
  ov.add([confirmBtn.bg, confirmBtn.text, confirmBtn.zone]);

  const cancelBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 + 20,
    y: OY + OH - 46,
    w: 104,
    h: 34,
    label: '취소',
    fontSize: '12px',
    fillColor: 0x111111,
    hoverFillColor: 0x1a1a1a,
    borderColor: 0x4a3424,
    hoverBorderColor: 0x806040,
    textColor: '#8a6a4a',
    once: true,
    onPress: () => ov.destroy(true) });
  ov.add([cancelBtn.bg, cancelBtn.text, cancelBtn.zone]);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
}
