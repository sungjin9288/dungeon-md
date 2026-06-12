// ─── Room Detail Feedback ────────────────────────────────────────────────────
// 방 상세 진입 피드백 연출 + 추천 액션 적용(설계/수리/배치). Shared에만 의존.

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
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

export function drawPreBattleReturnStrip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  _state: RoomDetailState,
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
    fontFamily: 'Georgia, serif',
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

export function drawNextQueuePreviewChip(
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
