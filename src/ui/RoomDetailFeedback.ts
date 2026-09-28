// ─── Room Detail Feedback ────────────────────────────────────────────────────
// 방 상세 진입 피드백 연출 + 추천 액션 적용(설계/수리/배치). Shared에만 의존.

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { showToast } from './Toast';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import {
  getRoomSlotCapacity, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot } from '../data/wisdom';
import {
  calculateRoomMetricDelta,
  calculateRoomMetrics,
  type RoomMetricDelta } from '../data/dungeonMetrics';
import { type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import {
  type MonsterLoadoutRecommendation,
  type TrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import {
  assignMonsterToRoomSlot,
  changeRoomSlotType,
  getRoomRepairCost,
  installTrapInRoomSlot,
  repairRoomSlot } from '../data/roomSlotTransactions';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';
import { addPrimaryActionButton } from './GameUiPrimitives';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback,
  type RoomGrowthFeedbackStats } from './RoomGrowthFeedback';

export type { PickerNavCallbacks };



import {
  ROOM_DETAIL_CLOSE_MS, ROOM_DETAIL_REOPEN_DELAY_MS, ROOM_TYPE_ACCENT, RoomDetailNextActionEntry, RoomActionHeaderStatus, RoomDirective, RoomDetailReturnFeedback, formatSignedPower, getRoomReadinessColor, getDirectiveVisualMeta, prefersReducedMotion, RoomDetailState, RoomDetailCallbacks } from './RoomDetailShared';
import { drawDirectiveSigil } from './RoomDetailSkin';

export function consumeRoomDetailFeedback(
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

export function drawRoomDetailReturnFeedback(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  _theme: DungeonTheme,
  feedback: RoomDetailReturnFeedback,
  x: number,
  y: number,
  w: number,
): number {
  const h = 48;
  const accent = feedback.accent;
  const target = feedback.kind === 'repair'
    ? 'repair'
    : feedback.kind === 'monster'
      ? 'monster'
      : feedback.kind === 'trap'
        ? 'trap'
        : feedback.kind === 'design'
          ? 'type'
          : 'growth';
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
  g.fillStyle(DUNGEON_UI.VOID, 0.96);
  g.fillRoundedRect(x, y + 3, w, h, 4);
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, h, 4);
  g.lineStyle(1, accent, 0.9);
  g.strokeRoundedRect(x, y, w, h, 4);
  g.fillStyle(accent, 1);
  g.fillRoundedRect(x + 7, y + 7, 5, h - 14, 4);
  drawDirectiveSigil(g, target, x + 31, y + h / 2, accent);
  c.add(g);

  c.add(scene.add.text(x + 58, y + 16, feedback.title, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 58, y + 33, feedback.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: statText ? w - 156 : w - 136, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  if (statText) {
    g.fillStyle(DUNGEON_UI.SOOT, 0.94);
    g.fillRoundedRect(x + w - 92, y + 13, 78, 22, 3);
    g.lineStyle(1.5, accent, 0.7);
    g.strokeRoundedRect(x + w - 92, y + 13, 78, 22, 3);
  }
  c.add(scene.add.text(x + w - 14, y + h / 2, statText ?? status, {
    fontFamily: 'sans-serif',
    fontSize: statText ? '9px' : '10px',
    color: DUNGEON_UI_CSS.TEXT,
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

export function drawPreBattleReturnStrip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  _theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  _state: RoomDetailState,
  x: number,
  y: number,
  w: number,
): number {
  const h = 54;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, h, 4);
  g.lineStyle(1, CASUAL.BLUE, 0.9);
  g.strokeRoundedRect(x, y, w, h, 4);
  drawDirectiveSigil(g, 'none', x + 25, y + 27, CASUAL.BLUE);
  c.add(g);

  c.add(scene.add.text(x + 48, y + 17, '침공 편집 중', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 48, y + 31, '정비 후 작전판으로 복귀합니다.', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.MUTED }).setOrigin(0, 0.5));

  const button = addPrimaryActionButton(scene, {
    x: x + w - 110,
    y: y + 5,
    w: 100,
    h: 44,
    label: '침공 복귀',
    fontSize: '12px',
    fillColor: CASUAL.BLUE,
    hoverFillColor: 0x5cb6f5,
    borderColor: CASUAL.BLUE_DK,
    hoverBorderColor: CASUAL.BLUE_DK,
    textColor: '#ffffff',
    onPress: () => {
      cb.requestClose?.();
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    } });
  c.add([button.bg, button.text, button.zone]);

  return h;
}

export function drawRoomActionHeader(
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
  const h = hasNextAction ? 140 : 98;
  const ctaW = 104;
  const ctaH = 44;
  const meta = getDirectiveVisualMeta(directive);
  const readinessColor = getRoomReadinessColor(status.readiness);
  const readinessCss = status.readiness >= 78 ? DUNGEON_UI_CSS.JADE : status.readiness >= 45 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.VOID, 0.96);
  g.fillRoundedRect(x, y + 3, w, h, 5);
  g.fillStyle(directive.fillColor, 0.98);
  g.fillRoundedRect(x, y, w, h, 5);
  g.lineStyle(1.2, directive.accent, 0.86);
  g.strokeRoundedRect(x, y, w, h, 5);
  g.fillStyle(directive.accent, 0.9);
  g.fillRoundedRect(x + 5, y + 5, 4, h - 10, 2);
  drawDirectiveSigil(g, directive.target, x + 31, y + 40, directive.accent);
  c.add(g);

  c.add(scene.add.text(x + 58, y + 14, `다음 지시 · ${meta.label}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 14, y + 14, `준비도 ${status.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readinessCss,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x + w - 96, y + 23, 82, 5, 2);
  g.fillStyle(readinessColor, 0.94);
  g.fillRoundedRect(x + w - 96, y + 23, Math.max(6, 82 * Phaser.Math.Clamp(status.readiness / 100, 0, 1)), 5, 2);

  c.add(scene.add.text(x + 58, y + 35, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 58, y + 54, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: w - ctaW - 78, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  const loadoutText = `수호 ${status.monsterCount}/${status.monsterCapacity} · 함정 ${status.trapCapacity > 0 ? `${status.trapCount}/${status.trapCapacity}` : '-'} · 장비 ${status.equipmentPower > 0 ? formatSignedPower(status.equipmentPower) : '-'}`;
  c.add(scene.add.text(x + 58, y + 79, loadoutText, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  if (nextActionEntry && onNextActionPress) {
    drawNextQueuePreviewChip(scene, c, nextActionEntry, x + 12, y + 98, w - 24, onNextActionPress);
  }

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 10,
      y: y + 42,
      w: ctaW,
      h: ctaH,
      label: directive.ctaLabel,
      fontSize: '11px',
      enabled: directive.enabled ?? true,
      fillColor: directive.accent,
      hoverFillColor: directive.accent,
      borderColor: DUNGEON_UI.BRASS_BRIGHT,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      textColor: '#090705',
      onPress: directive.onPress });
    c.add([button.bg, button.text, button.zone]);
    return h;
  }

  g.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  g.fillRoundedRect(x + w - ctaW - 10, y + 42, ctaW, ctaH, 4);
  g.lineStyle(2, directive.accent, 0.7);
  g.strokeRoundedRect(x + w - ctaW - 10, y + 42, ctaW, ctaH, 4);
  c.add(scene.add.text(x + w - ctaW / 2 - 10, y + 42 + ctaH / 2, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0.5));

  return h;
}

export function drawNextQueuePreviewChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  nextActionEntry: RoomDetailNextActionEntry,
  x: number,
  y: number,
  w: number,
  onPress: () => void,
): void {
  const h = 34;
  const buttonW = 56;
  const { action, rank } = nextActionEntry;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, h, 3);
  g.lineStyle(1, action.accent, 0.7);
  g.strokeRoundedRect(x, y, w, h, 3);
  g.fillStyle(action.accent, 0.9);
  g.fillRoundedRect(x + 5, y + 6, 4, h - 12, 2);
  g.fillStyle(action.accent, 0.92);
  g.fillRoundedRect(x + w - buttonW - 5, y + 3, buttonW, h - 6, 3);
  c.add(g);

  c.add(scene.add.text(x + 16, y + h / 2, `다음 ${rank}순 · 방 #${action.slotIdx + 1} ${action.label}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
    wordWrap: { width: w - buttonW - 30 } }).setOrigin(0, 0.5));

  c.add(scene.add.text(x + w - buttonW / 2 - 5, y + h / 2, '이동', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#090705',
    fontStyle: 'bold' }).setOrigin(0.5));

  const zone = scene.add.zone(x, y - 5, w, 44)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => g.setAlpha(1));
  zone.on('pointerout', () => g.setAlpha(1));
  zone.on('pointerdown', onPress);
  c.add(zone);
}

export function drawSectionTargetPulse(
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
    g.fillStyle(accent, 1);
    g.fillRoundedRect(chipX, chipY, chipW, 18, 6);
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(chipX + 3, chipY + 2, chipW - 6, 3, 2);
    g.lineStyle(1.5, CASUAL.EDGE, 0.4);
    g.strokeRoundedRect(chipX, chipY, chipW, 18, 6);
    chip = scene.add.text(chipX + chipW / 2, chipY + 9, label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#ffffff',
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

export function registerRoomUpgradeFeedback(
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

export function registerRoomDesignFeedback(
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

export function registerRoomRepairFeedback(
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

export function applyRoomRepairAction(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
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
  cb.requestClose?.();
  setTimeout(() => {
    cb.requestReopen?.(slotIdx);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

export function applyRecommendedRoomDesign(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
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
  const result = changeRoomSlotType(freshGs, slotIdx, recommendation.roomType, Date.now());
  if (!result.ok) return;

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === recommendation.roomType);
  const accent = ROOM_TYPE_ACCENT[recommendation.roomType] ?? 0xc8921a;
  try {
    cb.saveAndRefresh(result.state);
  } catch {
    showToast(scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
    return;
  }
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
  cb.requestClose?.();
  setTimeout(() => {
    cb.requestReopen?.(slotIdx);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

export function registerRoomLoadoutFeedback(
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

export function previewMonsterLoadoutSlot(
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

export function previewTrapLoadoutSlot(
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

export function applyRecommendedMonsterPlacement(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
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
  const result = assignMonsterToRoomSlot(freshGs, slotIdx, monsterSlotIdx, recommendation.monsterId, Date.now());
  if (!result.ok) {
    logger.debug(`[ROOM] recommended monster assignment failed: ${result.reason}`);
    return;
  }

  try {
    cb.saveAndRefresh(result.state);
  } catch {
    showToast(scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
    return;
  }
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
  cb.requestClose?.();
  setTimeout(() => {
    cb.requestReopen?.(slotIdx);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

export function applyRecommendedTrapPlacement(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
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
  cb.requestClose?.();
  setTimeout(() => {
    cb.requestReopen?.(slotIdx);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}
