/**
 * RoomPickerModals — trap picker and monster picker modals for the room detail overlay.
 * Entry points: showTrapPicker, showMonsterPicker.
 * Chrome helpers live in RoomPickerChrome; pure helpers/consts in RoomPickerShared.
 */

import Phaser from 'phaser';
import { showToast } from './Toast';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { getOwnedMonsterBattleAtk } from '../data/barracks';
import { assignMonsterToRoomSlot, installTrapInRoomSlot } from '../data/roomSlotTransactions';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { logger } from '../utils/logger';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import type { RoomDetailState, RoomDetailCallbacks } from './RoomDetailOverlay';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { addMonsterPortrait, setMonsterPortraitAlpha } from './MonsterPortraitView';
import { showRoomGrowthFeedback } from './RoomGrowthFeedback';
import {
  PICKER_SLIDE_MS,
  SHEET_PAD_X,
  SHEET_HEADER_H,
  SHEET_BOTTOM_PAD,
  ROW_GAP,
  MONSTER_TYPE_LABEL,
  MONSTER_TYPE_ACCENT,
  fitPickerLabel,
  getMonsterRoomFitLabel,
  getTrapRoomFitLabel,
  getEquipmentIcon,
  getPickerMonsterRarityMeta,
} from './RoomPickerShared';
import {
  destroyTrapPicker,
  destroyMonsterPicker,
  addPickerSheetFrame,
  addPickerHeader,
  addPickerRoomContext,
  attachSheetListScroll,
  addPickerCardChrome,
  addPickerStatusPill,
  addPickerTinyPill,
  addPickerMiniBadge,
  addDeltaChipRow,
  registerRoomLoadoutFeedback,
  previewMonsterSlot,
  previewTrapSlot,
  getPreviewDelta,
  getPreviewGrowthStats,
} from './RoomPickerChrome';

// Re-export for the 8 files that import PickerNavCallbacks from here
export type { PickerNavCallbacks } from './RoomPickerShared';

// ─── Trap Picker Modal ──────────────────────────────────────────────────────

export function showTrapPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: import('./RoomPickerShared').PickerNavCallbacks,
  slotIdx: number,
  trapSlotIdx: number,
): void {
  destroyTrapPicker(state);
  destroyMonsterPicker(state);

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const targetSlot = gs.dungeonSlots?.[slotIdx];
  const trapCols = 2;
  const trapCardW = (CW - SHEET_PAD_X * 2 - ROW_GAP) / trapCols;
  const trapCardH = 162;
  const trapRows = Math.ceil(TRAP_DEFS.length / trapCols);
  const contentH = trapRows * trapCardH + Math.max(0, trapRows - 1) * ROW_GAP;
  const modalH = Math.min(SHEET_HEADER_H + contentH + SHEET_BOTTOM_PAD, CH - 112);
  const listY = SHEET_HEADER_H;
  const listH = modalH - SHEET_HEADER_H - SHEET_BOTTOM_PAD;
  const targetY = CH - modalH;
  const c = scene.add.container(0, CH).setDepth(110);  // starts offscreen bottom
  state.trapPickerContainer = c;

  addPickerSheetFrame(scene, c, modalH, CASUAL.GOLD);
  addPickerHeader(
    scene,
    c,
    '함정 선택',
    `슬롯 ${trapSlotIdx + 1} · 보유 ${gs.homeGold.toLocaleString('ko-KR')}g`,
    () => destroyTrapPicker(state, scene, true),
  );
  addPickerRoomContext(scene, c, gs, slotIdx, `T 슬롯 ${trapSlotIdx + 1}`, CASUAL.GOLD);

  const list = scene.add.container(0, listY);
  c.add(list);

  TRAP_DEFS.forEach((trap, index) => {
    const col = index % trapCols;
    const row = Math.floor(index / trapCols);
    const cardX = SHEET_PAD_X + col * (trapCardW + ROW_GAP);
    const cardY = row * (trapCardH + ROW_GAP);
    const locked = gs.dmLevel < trap.unlockLv;
    const canAfford = gs.homeGold >= trap.cost;
    const enabled = !locked && canAfford;
    const accent = enabled ? CASUAL.GOLD : locked ? CASUAL.EDGE_SOFT : CASUAL.RED;
    const fitLabel = getTrapRoomFitLabel(targetSlot, trap.id);
    const delta = getPreviewDelta(
      gs,
      slotIdx,
      previewTrapSlot(gs.dungeonSlots?.[slotIdx], trapSlotIdx, trap.id),
    );
    addPickerCardChrome(scene, list, cardX, cardY, trapCardW, trapCardH, accent, enabled);
    addPickerStatusPill(
      scene,
      list,
      cardX + 10,
      cardY + 15,
      locked ? `Lv.${trap.unlockLv}` : canAfford ? '설치 가능' : '골드 부족',
      accent,
      enabled,
    );
    addPickerTinyPill(
      scene,
      list,
      cardX + trapCardW - 76,
      cardY + 15,
      fitLabel,
      accent,
      enabled,
    );
    addPickerMiniBadge(scene, list, cardX + 10, cardY + 37, `T${trapSlotIdx + 1}`, accent, enabled);

    const alpha = enabled ? 1 : 0.42;
    const iconBg = scene.add.graphics();
    iconBg.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
    iconBg.fillCircle(cardX + trapCardW / 2, cardY + 48, 27);
    iconBg.lineStyle(2.5, accent, enabled ? 0.9 : 0.4);
    iconBg.strokeCircle(cardX + trapCardW / 2, cardY + 48, 27);
    iconBg.fillStyle(accent, enabled ? 0.18 : 0.08);
    iconBg.fillCircle(cardX + trapCardW / 2, cardY + 48, 18);
    list.add(iconBg);
    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 48, trap.emoji, {
      fontFamily: 'sans-serif', fontSize: '25px',
    }).setOrigin(0.5).setAlpha(alpha));

    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 80, fitPickerLabel(trap.name, 8), {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 96, locked ? `DM Lv.${trap.unlockLv}` : `${trap.cost}g · ${trap.desc}`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: enabled ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.6));
    addDeltaChipRow(scene, list, cardX + 10, cardY + 107, trapCardW - 20, delta, enabled);

    const label = locked ? `Lv.${trap.unlockLv}` : canAfford ? '선택' : '골드 부족';
    const pickBtn = addPrimaryActionButton(scene, {
      x: cardX + 10,
      y: cardY + trapCardH - 30,
      w: trapCardW - 20,
      h: 24,
      label,
      fontSize: locked || !canAfford ? '10px' : '11px',
      align: 'center',
      enabled,
      fillColor: CASUAL.GOLD,
      hoverFillColor: 0xffd564,
      borderColor: CASUAL.GOLD_DK,
      hoverBorderColor: CASUAL.GOLD_DK,
      textColor: '#ffffff',
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      disabledTextColor: CASUAL_CSS.INK_SOFT,
      onPress: () => {
        const freshGs = cb.getGameState();
        const previewSlot = previewTrapSlot(freshGs.dungeonSlots?.[slotIdx], trapSlotIdx, trap.id);
        const freshDelta = getPreviewDelta(
          freshGs,
          slotIdx,
          previewSlot,
        );
        const growthStats = getPreviewGrowthStats(freshGs, slotIdx, previewSlot);
        const result = installTrapInRoomSlot(freshGs, slotIdx, trapSlotIdx, trap.id);
        if (!result.ok) {
          logger.debug(`[TRAP] not enough gold (need ${trap.cost}g)`);
          return;
        }
        cb.saveAndRefresh(result.state);
        cb.markRoomChanged?.(slotIdx);
        registerRoomLoadoutFeedback(scene, slotIdx, 'trap', trap.name, trap.emoji, freshDelta, 0xc8921a, growthStats);
        showRoomGrowthFeedback(scene, freshDelta, `${trap.name} 설치 완료`, growthStats);
        logger.debug(`[TRAP] slot ${slotIdx}[${trapSlotIdx}]: ${trap.id} installed, cost: ${result.cost ?? trap.cost}g`);
        destroyTrapPicker(state);
        nav.closeRoomDetail(state, cb);
        scene.time.delayedCall(250, () => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY));
      },
    });
    list.add([pickBtn.bg, pickBtn.text, pickBtn.zone]);
  });

  attachSheetListScroll(scene, c, list, targetY, listY, listH, contentH);

  // Slide up animation
  c.setPosition(0, CH);
  scene.tweens.add({ targets: c, y: targetY, duration: PICKER_SLIDE_MS, ease: 'Quad.easeOut' });
}


// ─── Monster Picker Modal ───────────────────────────────────────────────────

export function showMonsterPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: import('./RoomPickerShared').PickerNavCallbacks,
  slotIdx: number,
  monsterSlotIdx = 0,
): void {
  destroyMonsterPicker(state);
  destroyTrapPicker(state);

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const targetSlot = gs.dungeonSlots?.[slotIdx];
  const monsterRows = gs.ownedMonsters
    .map(om => {
      const mDef = resolveOwnedMonsterProfile(om.id);
      return mDef ? { om, mDef } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const monsterCols = 2;
  const monsterCardW = (CW - SHEET_PAD_X * 2 - ROW_GAP) / monsterCols;
  const monsterCardH = 170;
  const monsterCardRows = monsterRows.length > 0 ? Math.ceil(monsterRows.length / monsterCols) : 1;
  const contentH = monsterRows.length > 0
    ? monsterCardRows * monsterCardH + Math.max(0, monsterCardRows - 1) * ROW_GAP
    : 54;
  const modalH = Math.min(SHEET_HEADER_H + contentH + SHEET_BOTTOM_PAD, CH - 112);
  const listY = SHEET_HEADER_H;
  const listH = modalH - SHEET_HEADER_H - SHEET_BOTTOM_PAD;
  const targetY = CH - modalH;

  const c = scene.add.container(0, CH).setDepth(110);
  state.monsterPickerContainer = c;

  addPickerSheetFrame(scene, c, modalH, CASUAL.GREEN);
  addPickerHeader(
    scene,
    c,
    '몬스터 선택',
    `슬롯 ${monsterSlotIdx + 1} · 보유 ${monsterRows.length}체`,
    () => destroyMonsterPicker(state, scene, true),
  );
  addPickerRoomContext(scene, c, gs, slotIdx, `M 슬롯 ${monsterSlotIdx + 1}`, CASUAL.GREEN);

  const list = scene.add.container(0, listY);
  c.add(list);

  if (monsterRows.length === 0) {
    const emptyFrame = addFramedPanel(scene, {
      x: SHEET_PAD_X,
      y: 0,
      w: CW - SHEET_PAD_X * 2,
      h: 48,
      radius: 10,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      borderAlpha: 0.8,
      borderWidth: 2,
      glowOpacity: 0.02,
      shadowOpacity: 0.2,
      shadowOffsetY: 2,
    });
    list.add([emptyFrame.shadow, emptyFrame.panel, emptyFrame.glow]);
    list.add(scene.add.text(CW / 2, 24, '배치 가능한 몬스터 없음', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  monsterRows.forEach(({ om, mDef }, index) => {
    const col = index % monsterCols;
    const row = Math.floor(index / monsterCols);
    const cardX = SHEET_PAD_X + col * (monsterCardW + ROW_GAP);
    const cardY = row * (monsterCardH + ROW_GAP);
    const currentRoomMonsterIdx = gs.dungeonSlots?.[slotIdx]?.monsterIds?.findIndex(id => id === om.id) ?? -1;
    const isCurrent = currentRoomMonsterIdx === monsterSlotIdx;
    const isAssignedInCurrentRoom = currentRoomMonsterIdx >= 0 && !isCurrent;
    const assignedRoomIdx = gs.dungeonSlots?.findIndex((s, i) =>
      i !== slotIdx && (s?.monsterIds ?? []).includes(om.id),
    ) ?? -1;
    const isAssignedElsewhere = assignedRoomIdx >= 0;
    const enabled = !isCurrent && !isAssignedElsewhere;
    const accent = enabled ? mDef.accentColor : CASUAL.EDGE_SOFT;
    const typeAccent = MONSTER_TYPE_ACCENT[mDef.type] ?? mDef.accentColor;
    const roomFitLabel = getMonsterRoomFitLabel(targetSlot, mDef.type);
    const rarity = getPickerMonsterRarityMeta(mDef.rarityTier);
    const equipmentIcon = getEquipmentIcon(gs, om.equipment);
    const actualAtk = getOwnedMonsterBattleAtk(mDef.baseDamage, om, gs);
    const statusLabel = isCurrent
      ? '현재 슬롯'
      : isAssignedInCurrentRoom
        ? `이 방 M${currentRoomMonsterIdx + 1}`
        : isAssignedElsewhere
          ? `방 #${assignedRoomIdx + 1}`
          : '배치 가능';
    const delta = getPreviewDelta(
      gs,
      slotIdx,
      previewMonsterSlot(gs.dungeonSlots?.[slotIdx], monsterSlotIdx, om.id),
    );

    addPickerCardChrome(scene, list, cardX, cardY, monsterCardW, monsterCardH, accent, enabled);
    addPickerStatusPill(scene, list, cardX + 10, cardY + 15, statusLabel, accent, enabled);
    addPickerTinyPill(
      scene,
      list,
      cardX + monsterCardW - 78,
      cardY + 15,
      roomFitLabel,
      typeAccent,
      enabled,
    );
    addPickerMiniBadge(scene, list, cardX + 10, cardY + 37, rarity.stars, rarity.color, enabled);
    addPickerMiniBadge(scene, list, cardX + monsterCardW - 48, cardY + 37, `M${monsterSlotIdx + 1}`, accent, enabled);

    const alpha = enabled ? 1 : 0.42;
    const cx = cardX + monsterCardW / 2;
    const portrait = addMonsterPortrait(scene, list, cx, cardY + 54, om.id, {
      size: 60,
      frameColor: accent,
      glowColor: accent,
      bgColor: 0x070908,
      equippedSkins: gs.equippedSkins ?? {},
    });
    setMonsterPortraitAlpha(portrait, alpha);
    if (equipmentIcon) {
      const gear = scene.add.graphics();
      gear.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
      gear.fillCircle(cx + 24, cardY + 35, 10);
      gear.lineStyle(2, CASUAL.GOLD, enabled ? 0.9 : 0.35);
      gear.strokeCircle(cx + 24, cardY + 35, 10);
      gear.fillStyle(CASUAL.GOLD, enabled ? 0.2 : 0.06);
      gear.fillCircle(cx + 24, cardY + 35, 6);
      list.add(gear);
      list.add(scene.add.text(cx + 24, cardY + 35, equipmentIcon, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
      }).setOrigin(0.5).setAlpha(alpha));
    }

    list.add(scene.add.text(cx, cardY + 90, fitPickerLabel(mDef.name, 8), {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    list.add(scene.add.text(cx, cardY + 106, `Lv.${om.level} · ${MONSTER_TYPE_LABEL[mDef.type] ?? '전투'} · ATK ${actualAtk}${equipmentIcon ? ' · 장비' : ''}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: enabled ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.54));
    addDeltaChipRow(scene, list, cardX + 10, cardY + 116, monsterCardW - 20, delta, enabled);
    if ((om.skillPoints ?? 0) > 0) {
      list.add(scene.add.text(cardX + monsterCardW - 14, cardY + 23, `SP ${om.skillPoints}`, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: enabled ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5).setAlpha(enabled ? 1 : 0.54));
    }

    const label = isCurrent ? '현재' : isAssignedElsewhere ? '배치됨' : isAssignedInCurrentRoom ? '이동' : '배치';
    const pickBtn = addPrimaryActionButton(scene, {
      x: cardX + 10,
      y: cardY + monsterCardH - 30,
      w: monsterCardW - 20,
      h: 24,
      label,
      fontSize: '10px',
      enabled,
      fillColor: CASUAL.GREEN,
      hoverFillColor: 0x6fdc70,
      borderColor: CASUAL.GREEN_DK,
      hoverBorderColor: CASUAL.GREEN_DK,
      textColor: '#ffffff',
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      disabledTextColor: CASUAL_CSS.INK_SOFT,
      onPress: () => {
        const freshGs = cb.getGameState();
        const previewSlot = previewMonsterSlot(freshGs.dungeonSlots?.[slotIdx], monsterSlotIdx, om.id);
        const freshDelta = getPreviewDelta(
          freshGs,
          slotIdx,
          previewSlot,
        );
        const growthStats = getPreviewGrowthStats(freshGs, slotIdx, previewSlot);
        const result = assignMonsterToRoomSlot(freshGs, slotIdx, monsterSlotIdx, om.id, Date.now());
        if (!result.ok) return;
        try {
          cb.saveAndRefresh(result.state);
        } catch {
          showToast(scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
          return;
        }
        cb.markRoomChanged?.(slotIdx);
        registerRoomLoadoutFeedback(scene, slotIdx, 'monster', mDef.name, mDef.emoji, freshDelta, 0x66c08a, growthStats);
        showRoomGrowthFeedback(scene, freshDelta, `${mDef.name} 배치 완료`, growthStats);
        logger.debug(`[ROOM] slot ${slotIdx}[${monsterSlotIdx}]: ${mDef.name} (${om.id}) assigned`);
        destroyMonsterPicker(state);
        nav.closeRoomDetail(state, cb);
        scene.time.delayedCall(250, () => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY));
      },
    });
    pickBtn.zone.setName(`room-picker-monster-${om.id}`);
    list.add([pickBtn.bg, pickBtn.text, pickBtn.zone]);
  });

  attachSheetListScroll(scene, c, list, targetY, listY, listH, contentH);

  // Slide up
  c.setPosition(0, CH);
  scene.tweens.add({ targets: c, y: targetY, duration: PICKER_SLIDE_MS, ease: 'Quad.easeOut' });
}
