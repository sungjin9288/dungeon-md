/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { showToast } from './Toast';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { getSlotBuildingName } from '../data/roomBuildings';
import {
  getRoomSlotCapacity, getMaxRoomLevel, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot } from '../data/wisdom';
import {
  calculateRoomMetricDelta,
  calculateRoomMetrics } from '../data/dungeonMetrics';
import {
  ensureDungeonSlot,
  getRoomRepairCost,
  getRoomUpgradeCost,
  upgradeRoomSlot } from '../data/roomSlotTransactions';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton, addProgressBar } from './GameUiPrimitives';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback } from './RoomGrowthFeedback';

export type { PickerNavCallbacks };


import {
  
  
  buildRoomInteriorPreview } from './RoomDetailInterior';

import {
  SLOT_W, SLOT_H, ROOM_DETAIL_CLOSE_MS, ROOM_DETAIL_REOPEN_DELAY_MS, ROOM_TYPE_ACCENT, shouldHighlightDirectiveTarget, RoomDetailState, RoomDetailCallbacks } from './RoomDetailShared';
import {
  consumeRoomDetailFeedback, drawRoomDetailReturnFeedback, drawPreBattleReturnStrip, drawRoomActionHeader, drawSectionTargetPulse, registerRoomUpgradeFeedback, applyRoomRepairAction } from './RoomDetailFeedback';

import {
  buildRoomOperationsPanel, getRoomDirective, getNextRoomDetailAction,
  openQueuedRoomFromDetail } from './RoomDetailOperations';
import {
  buildRoomTypeStrip, buildMonsterSection, buildTrapSection, showRoomUpgradeConfirm } from './RoomDetailSections';
import { drawRoomTypeSigil } from './RoomDetailSkin';

// ─── Context / State ──────────────────────────────────────────────────────────

/** Mutable state managed by the overlay functions. */
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
  cb.requestClose = () => closeRoomDetail(state, cb);
  cb.requestReopen = idx => openRoomDetail(scene, state, theme, cb, idx, state.roomDetailCellX, state.roomDetailCellY);
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


  // ── Dungeon workbench shell ────────────────────────────────────────────────
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.78);
  bg.fillRect(-CW / 2, -CH / 2, CW, CH);
  bg.fillStyle(DUNGEON_UI.SOOT, 1);
  bg.fillRect(-CW / 2, -CH / 2, CW, CH);
  bg.fillStyle(DUNGEON_UI.STONE, 0.72);
  bg.fillRect(-CW / 2, -CH / 2 + 64, 10, CH - 64);
  bg.fillRect(CW / 2 - 10, -CH / 2 + 64, 10, CH - 64);
  bg.lineStyle(1, DUNGEON_UI.IRON, 0.5);
  for (let y = -CH / 2 + 92; y < CH / 2; y += 36) {
    bg.lineBetween(-CW / 2 + 4, y, -CW / 2 + 10, y);
    bg.lineBetween(CW / 2 - 10, y + 18, CW / 2 - 4, y + 18);
  }
  bg.lineStyle(2, DUNGEON_UI.EDGE, 0.74);
  bg.lineBetween(-CW / 2, -CH / 2, -CW / 2, CH / 2);
  bg.lineBetween(CW / 2, -CH / 2, CW / 2, CH / 2);
  c.add(bg);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 64;
  const hdrG = scene.add.graphics();
  hdrG.fillStyle(DUNGEON_UI.VOID, 1);
  hdrG.fillRect(-CW / 2, -CH / 2, CW, headerH);
  hdrG.fillStyle(DUNGEON_UI.STONE_RAISED, 0.82);
  hdrG.fillRect(-CW / 2 + 5, -CH / 2 + 5, CW - 10, headerH - 10);
  hdrG.lineStyle(1, DUNGEON_UI.BRASS, 0.66);
  hdrG.lineBetween(-CW / 2 + 8, -CH / 2 + headerH - 4, CW / 2 - 8, -CH / 2 + headerH - 4);
  hdrG.lineStyle(3, DUNGEON_UI.IRON, 1);
  hdrG.lineBetween(-CW / 2, -CH / 2 + headerH, CW / 2, -CH / 2 + headerH);
  c.add(hdrG);

  const backW = 82;
  const backX = -CW / 2 + 14;
  const backCY = -CH / 2 + headerH / 2;
  const backH = 44;
  const backY = backCY - backH / 2;
  const backG = scene.add.graphics();
  backG.fillStyle(DUNGEON_UI.VOID, 0.96);
  backG.fillRoundedRect(backX, backY, backW, backH, 4);
  backG.lineStyle(1.5, DUNGEON_UI.BRASS, 0.78);
  backG.strokeRoundedRect(backX, backY, backW, backH, 4);
  backG.lineStyle(2, DUNGEON_UI.BRASS_BRIGHT, 0.86);
  backG.lineBetween(backX + 20, backCY - 7, backX + 13, backCY);
  backG.lineBetween(backX + 13, backCY, backX + 20, backCY + 7);
  c.add(backG);
  const backBtn = scene.add.text(backX + 49, backCY, '나가기', {
    fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold' }).setOrigin(0.5);
  c.add(backBtn);
  const backZone = scene.add.zone(backX, backY, backW, backH).setOrigin(0)
    .setInteractive({ useHandCursor: true });
  backZone.on('pointerdown', () => closeRoomDetail(state, cb));
  c.add(backZone);

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const typeLabel = typeDef ? getSlotBuildingName(slot, typeDef.name) : '미설계 방';
  const titleIconX = -CW / 2 + 112;
  drawRoomTypeSigil(hdrG, slot.roomType, titleIconX, backCY, 22, slot.roomType ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE);
  c.add(scene.add.text(titleIconX + 18, backCY - 7, `방 #${slotIdx + 1} · ${typeLabel}`, {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(titleIconX + 18, backCY + 10, `ROOM LEVEL ${String(slot.roomLevel).padStart(2, '0')}`, {
    fontFamily: 'monospace', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold' }).setOrigin(0, 0.5));

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
  const barColor = hpPct > 0.66 ? DUNGEON_UI.JADE : hpPct > 0.33 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EMBER;
  const maxRoomLv = getMaxRoomLevel(gs.dmLevel);
  const isDamaged = slot.hp < slot.maxHp;
  const canShowUpgradeButton = !!slot.roomType && slot.roomLevel >= 1 && slot.roomLevel < 5 && slot.roomLevel < maxRoomLv;
  const growthPanelH = isDamaged ? 268 : 216;
  const growthAccent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0xc8921a : 0xc8921a;
  const growthFrame = addFramedPanel(scene, {
    x: secX,
    y: growthY,
    w: secW,
    h: growthPanelH,
    radius: 4,
    fillColor: DUNGEON_UI.SOOT,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 0.9,
    borderWidth: 1,
    accentColor: growthAccent,
    accentAlpha: 1,
    glowColor: growthAccent,
    glowOpacity: 0.02,
    shadowOpacity: 0.28,
    shadowOffsetY: 3 });
  content.add([growthFrame.shadow, growthFrame.panel, growthFrame.glow]);

  const growthG = scene.add.graphics();
  growthG.fillStyle(growthAccent, 0.1);
  growthG.fillRect(secX + 8, growthY + 8, 4, growthPanelH - 16);
  growthG.fillStyle(DUNGEON_UI.STONE_RAISED, 0.94);
  growthG.fillRoundedRect(secX + secW - 72, growthY + 12, 56, 22, 3);
  growthG.lineStyle(1, DUNGEON_UI.EDGE, 0.8);
  growthG.strokeRoundedRect(secX + secW - 72, growthY + 12, 56, 22, 3);
  content.add(growthG);

  content.add(scene.add.text(secX + 18, growthY + 25, '방 성장', {
    fontFamily: 'sans-serif',
    fontSize: '14px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 44, growthY + 23, `Lv.${slot.roomLevel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.BRASS,
    fontStyle: 'bold' }).setOrigin(0.5));

  const durabilityY = growthY + 56;
  const durabilityBar = addProgressBar(scene, {
    x: secX + 72,
    y: durabilityY,
    w: secW - 126,
    h: 14,
    ratio: hpPct,
    fillColor: barColor,
    trackColor: DUNGEON_UI.VOID,
    borderColor: DUNGEON_UI.EDGE,
    borderAlpha: 0.9,
    duration: 320 });
  content.add([durabilityBar.track, durabilityBar.fill]);
  content.add(scene.add.text(secX + 18, durabilityY + 7, '내구도', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 18, durabilityY + 7, `${slot.hp}/${slot.maxHp}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: hpPct > 0.33 ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.EMBER,
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
      h: 44,
      label: `내구 수리  ${repairCost}g  ·  HP +${missingHp}`,
      fontSize: '12px',
      enabled: canRepair,
      fillColor: DUNGEON_UI.JADE,
      hoverFillColor: 0x6fdc70,
      borderColor: DUNGEON_UI.EDGE,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      textColor: '#07100c',
      onPress: () => {
        applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot);
      } });
    content.add([repairBtn.bg, repairBtn.text, repairBtn.zone]);
    if (shouldHighlightDirectiveTarget(actionDirective, 'repair')) {
      drawSectionTargetPulse(scene, content, secX + 12, nextGrowthY - 4, secW - 24, 40, actionDirective.accent, '수리', 'none');
    }
    nextGrowthY += 54;
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
      h: 44,
      label: `Lv.${slot.roomLevel} → ${slot.roomLevel + 1} 방 확장  (${upgCost}g)\n${upgradeSummary}`,
      fontSize: '12px',
      align: 'center',
      enabled: canUpgrade,
      fillColor: DUNGEON_UI.BRASS,
      hoverFillColor: 0xffd564,
      borderColor: DUNGEON_UI.BRASS_BRIGHT,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      textColor: '#100b05',
      onPress: () => {
        showRoomUpgradeConfirm(scene, upgCost, slot.roomLevel, newCap, () => {
          const freshGs = cb.getGameState();
          const freshSlot = freshGs.dungeonSlots?.[slotIdx];
          const previousLevel = freshSlot?.roomLevel ?? slot.roomLevel;
          const previousHp = freshSlot?.maxHp ?? slot.maxHp;
          const previousCap = getRoomSlotCapacity(previousLevel, freshSlot?.roomType ?? slot.roomType);
          const result = upgradeRoomSlot(freshGs, slotIdx, Date.now());
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
          try {
            cb.saveAndRefresh(result.state);
          } catch {
            showToast(scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
            return;
          }
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
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, `잠금 · ${upgradeSummary}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold',
      backgroundColor: '#101612',
      padding: { x: 10, y: 5 } }).setOrigin(0, 0.5));
    nextGrowthY += 36;
  } else {
    upgradeSummary = '최고 레벨 확장 완료';
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, '최고 레벨 (Lv.5)', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: DUNGEON_UI_CSS.BRASS,
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    nextGrowthY += 34;
  }

  const bonusDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === (slot.roomType ?? 'combat'));
  let contentBottom = growthY + growthPanelH + 18;
  if (bonusDef) {
    const bonusY = nextGrowthY + 2;
    const bonusH = 64;
    growthG.fillStyle(DUNGEON_UI.VOID, 0.94);
    growthG.fillRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 3);
    growthG.lineStyle(1, DUNGEON_UI.EDGE, 0.7);
    growthG.strokeRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 3);
    growthG.fillStyle(growthAccent, 1);
    growthG.fillRoundedRect(secX + 22, bonusY + 10, 5, bonusH - 20, 3);
    drawRoomTypeSigil(growthG, bonusDef.id, secX + 31, bonusY + 16, 14, growthAccent);
    content.add(scene.add.text(secX + 45, bonusY + 14, `${bonusDef.name} 특성`, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: DUNGEON_UI_CSS.PARCHMENT,
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 45, bonusY + 34, bonusDef.bonus, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: secW - 88, useAdvancedWrap: true } }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 45, bonusY + 52, upgradeSummary || `현재 Lv.${slot.roomLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED }).setOrigin(0, 0.5));
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
    const buttonW = 44;
    const buttonH = 44;
    const buttonY = -CANVAS_HEIGHT / 2 + 6;
    const upButton = addPrimaryActionButton(scene, {
      x: CANVAS_WIDTH / 2 - 98,
      y: buttonY,
      w: buttonW,
      h: buttonH,
      label: '▲',
      fontSize: '12px',
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      hoverBorderColor: DUNGEON_UI.BRASS,
      textColor: DUNGEON_UI_CSS.PARCHMENT,
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
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      hoverBorderColor: DUNGEON_UI.BRASS,
      textColor: DUNGEON_UI_CSS.PARCHMENT,
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


// 하위 호환 재수출 — 기존 import 경로 유지
export * from './RoomDetailShared';
