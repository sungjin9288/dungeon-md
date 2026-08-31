// ─── Room Detail Sections ────────────────────────────────────────────────────
// 방 타입 스트립·몬스터/함정 섹션·업그레이드 확인 다이얼로그.

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getRoomSlotCapacity, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot } from '../data/wisdom';
import { MONSTER_DEFS, resolveMonsterTypeId } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import {
  calculateRoomMetricDelta,
  calculateRoomMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation } from '../data/roomDesignRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import {
  changeRoomSlotType,
  removeTrapFromRoomSlot } from '../data/roomSlotTransactions';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback } from './RoomGrowthFeedback';

export type { PickerNavCallbacks };


import {
  addCompactAttributeChip,
  addCompactEmptySlotGlyph,
  addCompactEquipmentSocket,
  addCompactLoadoutButton,
  addRecommendedMonsterSlotPreview,
  addRecommendedTrapSlotPreview,
  drawCollectorCardSkin,
  drawCompactEmptyMonsterPlanTag,
  drawCompactEmptyTrapPlanTag,
  drawCompactGrowthMeter,
  drawCompactLoadoutSlotFrame,
  drawCompactRoomTypeStateTag,
  drawCompactTrapEffectTag,
  fitSlotLabel,
  formatCompactTrapCost,
  getMonsterRarityMeta } from './RoomDetailCompactCards';
import { navigateToFocusedMonster } from './RoomDetailInterior';

import {
  ROOM_DETAIL_REOPEN_DELAY_MS, MONSTER_ROW_ACCENT, TRAP_ROW_ACCENT, ROOM_TYPE_ACCENT, ROOM_TYPE_SHORT_BONUS, ROOM_TYPE_ROLE_CHIP, MONSTER_TYPE_LABEL, MONSTER_TYPE_COLOR, getEquippedItem, findFirstEmptySlot, RoomDetailState, RoomDetailCallbacks } from './RoomDetailShared';
import {
  drawSectionTargetPulse, registerRoomDesignFeedback, applyRecommendedMonsterPlacement, applyRecommendedTrapPlacement } from './RoomDetailFeedback';

// ─── Room Type Strip ──────────────────────────────────────────────────────────

export function buildRoomTypeStrip(
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
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 2 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, stripH, CASUAL.GREEN, '다음 선택');
  }

  c.add(scene.add.text(secX + 14, secY + 15, '방 설계 타입', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 14, secY + 15, activeType ? `${activeType.name} 적용 중` : recommendation ? `추천 ${recommendation.shortLabel}` : '역할 미설정', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: activeType ? CASUAL_CSS.GOLD : recommendation ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  if (recommendation) {
    c.add(scene.add.text(secX + 14, secY + 32, `추천: ${recommendation.title} · ${recommendation.reason}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.GREEN,
      fontStyle: 'bold',
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
    btnBg.fillStyle(isActive ? accent : isRecommended ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
    btnBg.fillRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.lineStyle(isRecommended ? 2.5 : 2, isActive || isRecommended ? accent : CASUAL.EDGE_SOFT, isActive || isRecommended ? 1 : 0.7);
    btnBg.strokeRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.fillStyle(0xffffff, isActive ? 0.32 : 0.4);
    btnBg.fillRoundedRect(bx + 8, cardY + 5, btnW - 18, 3, 2);
    c.add(btnBg);
    const tagLabel = isActive ? '적용' : isRecommended ? '추천' : ROOM_TYPE_ROLE_CHIP[td.id] ?? '설계';
    drawCompactRoomTypeStateTag(scene, c, bx + 8, cardY + 10, tagLabel, accent, isActive, isRecommended);
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 31, td.icon, {
      fontFamily: 'sans-serif', fontSize: '17px' }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 49, td.name, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: isActive ? '#ffffff' : isRecommended ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold' }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 64, isActive ? '적용중' : isRecommended ? recommendation.shortLabel : formatRoomTypeDelta(delta.threatDelta, delta.readinessDelta, td.id), {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: isActive ? '#ffffff' : isRecommended ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
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

export function formatRoomTypeDelta(
  threatDelta: number,
  readinessDelta: number,
  roomType: string,
): string {
  if (threatDelta > 0) return `위협 +${threatDelta}`;
  if (readinessDelta > 0) return `준비 +${readinessDelta}%`;
  return ROOM_TYPE_SHORT_BONUS[roomType] ?? '역할 변경';
}


// ─── Monster Section ──────────────────────────────────────────────────────────

export function buildMonsterSection(
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
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: MONSTER_ROW_ACCENT,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, MONSTER_ROW_ACCENT, '다음 배치');
  }

  const assignedCount = slot.monsterIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '👊 수호 라인 슬롯', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK,
    fontStyle: 'bold' }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${assignedCount}/${cap.monsters}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    color: assignedCount > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT }).setOrigin(1, 0));

  for (let mi = 0; mi < cap.monsters; mi++) {
    const col    = mi % perRow;
    const row    = Math.floor(mi / perRow);
    const cardX  = secX + 12 + col * (cardW + gap);
    const cardY  = secY + 34 + row * (cardH + gap);
    const mId    = slot.monsterIds[mi];
    const om     = mId ? gs.ownedMonsters.find(m => m.id === mId) : null;
    const typeId = om ? (resolveMonsterTypeId(om.id) ?? om.id) : null;
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
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK,
        fontStyle: 'bold' }).setOrigin(0, 0.5));
      c.add(scene.add.text(cardX + 52, cardY + 47, `Lv.${om.level} · ATK ${mDef.baseDamage}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold' }).setOrigin(0, 0.5));
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
          fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        drawCompactEmptyMonsterPlanTag(scene, c, cardX + 52, cardY + 48, Math.max(38, cardW - 63), MONSTER_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 61, '새 수호자', {
          fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
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

export function buildTrapSection(
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
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: TRAP_ROW_ACCENT,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.03,
    shadowOpacity: 0.24,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, TRAP_ROW_ACCENT, '다음 설치');
  }

  const installedCount = slot.trapIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '🕸 함정 라인 슬롯', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK,
    fontStyle: 'bold' }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${installedCount}/${cap.traps}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    color: installedCount > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT }).setOrigin(1, 0));

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
      trapIconG.fillStyle(0xffffff, 0.85);
      trapIconG.fillCircle(iconX, cardY + 33, 18);
      trapIconG.lineStyle(2, TRAP_ROW_ACCENT, 0.85);
      trapIconG.strokeCircle(iconX, cardY + 33, 18);
      trapIconG.fillStyle(TRAP_ROW_ACCENT, 0.16);
      trapIconG.fillCircle(iconX, cardY + 33, 12);
      c.add(trapIconG);
      c.add(scene.add.text(iconX, cardY + 33, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '19px' }).setOrigin(0.5));
      addCompactAttributeChip(scene, c, cardX + 52, cardY + 12, '설비', TRAP_ROW_ACCENT);
      c.add(scene.add.text(cardX + 52, cardY + 30, fitSlotLabel(trap.name, 6), {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK,
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
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.GOLD,
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
        cb.requestClose?.();
        setTimeout(() => cb.requestReopen?.(slotIdx), ROOM_DETAIL_REOPEN_DELAY_MS);
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
          fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
          fontStyle: 'bold' }).setOrigin(0, 0.5));
        drawCompactEmptyTrapPlanTag(scene, c, cardX + 52, cardY + 43, Math.max(38, cardW - 63), TRAP_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 58, '새 설비', {
          fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
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

export function showRoomUpgradeConfirm(
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
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const frame = addFramedPanel(scene, {
    x: OX,
    y: OY,
    w: OW,
    h: OH,
    radius: 14,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.09,
    shadowOpacity: 0.4,
    shadowOffsetY: 5 });
  ov.add([frame.shadow, frame.panel, frame.glow]);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 30, '⬆️ 방 업그레이드', {
    fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 54, `Lv.${currentLevel} → Lv.${currentLevel + 1}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold' }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 72, `비용: 💰 ${cost} 골드`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.GOLD, fontStyle: 'bold' }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 90, `몬스터 ${newCap.monsters}슬롯 / 함정 ${newCap.traps}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold' }).setOrigin(0.5));

  const confirmBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 - 124,
    y: OY + OH - 46,
    w: 104,
    h: 34,
    label: '업그레이드',
    fontSize: '12px',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd564,
    borderColor: CASUAL.GOLD_DK,
    hoverBorderColor: CASUAL.GOLD_DK,
    textColor: '#ffffff',
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
    fillColor: CASUAL.PANEL,
    hoverFillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE,
    hoverBorderColor: CASUAL.EDGE_SOFT,
    textColor: CASUAL_CSS.INK,
    once: true,
    onPress: () => ov.destroy(true) });
  ov.add([cancelBtn.bg, cancelBtn.text, cancelBtn.zone]);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
}
