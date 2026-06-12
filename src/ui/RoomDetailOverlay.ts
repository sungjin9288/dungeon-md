/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
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
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture } from '../themes/decorations';
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
