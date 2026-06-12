import { fitSlotLabel } from './RoomDetailCompactCards';
import { addPreviewHitZone, drawInteriorChamber, drawInteriorDungeonEditorDetails, drawInteriorEquipmentAura, drawInteriorEquipmentBadge, drawInteriorEquipmentSocket, drawInteriorRoomFixture, drawInteriorRoomPlaque, drawInteriorSlotActionChip, drawMonsterAnchor, drawMonsterPreviewPedestal, drawPreviewTargetRing, drawTrapPreviewSlot, getPreviewSlotPosition } from './RoomDetailInteriorDecor';
// ─── Room Detail Interior Preview ─────────────────────────────────────────────
// RoomDetailOverlay에서 분리한 방 내부 프리뷰 + 컴팩트 로드아웃 드로잉 계층.
// 진입점: buildRoomInteriorPreview (열린 방), drawUnbuiltRoomBlueprintPreview(본체 잔류).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { ROOM_SLOT_TYPE_DEFS, getRoomSlotCapacity, type DungeonSlot, type GameState } from '../data/wisdom';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { TRAP_DEFS } from '../data/traps';
import { getRoomDesignRecommendation, type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  findFirstEmptySlot, formatSignedPower, getEquippedItem,
  navigateFromRoomDetail, shouldHighlightDirectiveTarget,
  EquipmentBadge, ROOM_TYPE_ACCENT, RoomDetailCallbacks, RoomDetailState, RoomDirective } from './RoomDetailShared';

export function buildRoomInteriorPreview(
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
  directive: RoomDirective,
): number {
  const panelH = 314;
  const accent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0x66c08a : 0x55b88a;
  const roomMetrics = calculateRoomMetrics(gs, slot);

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: panelH,
    radius: 10,
    fillColor: 0x0a1118,
    borderColor: accent,
    borderAlpha: 0.44,
    borderWidth: 1.3,
    accentColor: accent,
    accentAlpha: 0.28,
    glowColor: accent,
    glowOpacity: 0.06,
    shadowOpacity: 0.28,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const g = scene.add.graphics();
  c.add(g);
  const chamberX = secX + 10;
  const chamberY = secY + 32;
  const chamberW = secW - 20;
  const chamberH = 226;

  if (!slot.roomType) {
    const recommendation = getRoomDesignRecommendation(gs, slotIdx);
    const recommendedType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === recommendation.roomType);
    drawUnbuiltRoomBlueprintPreview(
      scene,
      c,
      g,
      chamberX,
      chamberY,
      chamberW,
      chamberH,
      accent,
      recommendation,
      directive,
    );
    c.add(scene.add.text(secX + 16, secY + 17, '🏗 방 설계 도면', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#d8f5ff',
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    c.add(scene.add.text(secX + secW - 16, secY + 17, `추천 ${recommendedType?.name ?? recommendation.title} · ${recommendation.shortLabel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#9ccbd8',
      fontStyle: 'bold' }).setOrigin(1, 0.5));
    return panelH;
  }

  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const equippedCount = slot.monsterIds
    .filter((monsterId): monsterId is string => typeof monsterId === 'string')
    .filter(monsterId => Boolean(getEquippedItem(gs, monsterId)))
    .length;

  drawInteriorChamber(scene, c, g, chamberX, chamberY, chamberW, chamberH, accent, slot);
  drawInteriorDungeonEditorDetails(g, chamberX, chamberY, chamberW, chamberH, accent, slot.roomLevel, roomMetrics.readiness);
  drawInteriorEquipmentAura(scene, c, g, chamberX, chamberY, chamberW, chamberH, roomMetrics.equipmentPower);
  drawInteriorRoomFixture(g, chamberX, chamberY, chamberW, chamberH, accent, slot.roomType, slot.roomLevel, roomMetrics.readiness);
  drawInteriorLoadoutBands(
    scene, c, g, chamberX, chamberY, chamberW, chamberH, accent,
    cap.monsters, monsterCount, cap.traps, trapCount, equippedCount, roomMetrics.readiness,
  );
  drawInteriorPlacementScaffold(
    g,
    chamberX,
    chamberY,
    chamberW,
    chamberH,
    accent,
    slot,
    cap.monsters,
    cap.traps,
    roomMetrics.readiness,
  );
  if (shouldHighlightDirectiveTarget(directive, 'type')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH * 0.54, 138, 72, directive.accent, '역할 선택');
  }
  if (shouldHighlightDirectiveTarget(directive, 'repair')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH / 2, chamberW - 26, chamberH - 18, directive.accent, '수리 필요');
  }

  const roomIcon = typeDef?.icon ?? '🏚';
  const roomLabel = typeDef?.name ?? '일반실';
  drawInteriorRoomPlaque(
    scene,
    c,
    g,
    chamberX,
    chamberY,
    chamberW,
    accent,
    roomIcon,
    roomLabel,
    slot.roomLevel,
    roomMetrics.readiness,
    Boolean(slot.roomType && slot.hp <= 0),
  );
  c.add(scene.add.text(secX + 16, secY + 17, `${roomIcon} 방 내부 편집`, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#d8f5ff',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  const equipmentHeader = roomMetrics.equipmentPower !== 0
    ? ` · 장비 ${formatSignedPower(roomMetrics.equipmentPower)}`
    : '';
  const headerMetric = roomMetrics.threatScore > 0
    ? `${roomLabel} · 준비 ${roomMetrics.readiness}%${equipmentHeader}`
    : `${roomLabel} · 배치 ${monsterCount}/${cap.monsters}`;
  c.add(scene.add.text(secX + secW - 16, secY + 17, headerMetric, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ccbd8',
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  const firstTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const firstMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  for (let i = 0; i < cap.traps; i++) {
    const trapId = slot.trapIds[i];
    const trap = trapId ? TRAP_DEFS.find(t => t.id === trapId) : undefined;
    const pos = getPreviewSlotPosition(i, cap.traps, chamberX + 60, chamberY + Math.round(chamberH * 0.27), chamberW - 120, 28);
    drawTrapPreviewSlot(scene, c, pos.x, pos.y, trap?.emoji ?? 'T', accent, !!trap, `T${i + 1}`);
    drawInteriorSlotActionChip(scene, c, pos.x, pos.y + 18, trap ? '교체' : '설치', trap ? 0xffc44d : accent, !!trap);
    if (shouldHighlightDirectiveTarget(directive, 'trap') && i === firstTrapSlot && !trap) {
      drawPreviewTargetRing(scene, c, pos.x, pos.y + 8, 92, 52, directive.accent, '설치');
    }
    addPreviewHitZone(scene, c, pos.x, pos.y + 8, 42, 44, () => {
      showTrapPicker(scene, state, theme, cb, nav, slotIdx, i);
    });
  }

  for (let i = 0; i < cap.monsters; i++) {
    const monsterId = slot.monsterIds[i];
    const pos = getPreviewSlotPosition(i, cap.monsters, chamberX + 58, chamberY + Math.round(chamberH * 0.68), chamberW - 116, 34);
    const owned = monsterId ? gs.ownedMonsters.find(m => m.id === monsterId) : undefined;
    const equipment = getEquippedItem(gs, monsterId);
    if (monsterId) {
      drawMonsterPreviewPedestal(scene, c, pos.x, pos.y, accent, true, `M${i + 1}`);
      addMonsterPortrait(scene, c, pos.x, pos.y, monsterId, {
        size: 38,
        frameColor: accent,
        glowColor: accent,
        bgColor: 0x061016,
        equippedSkins: gs.equippedSkins ?? {} });
      c.add(scene.add.text(pos.x, pos.y + 28, owned ? `Lv.${owned.level}` : '배치됨', {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: '#ffe080',
        fontStyle: 'bold' }).setOrigin(0.5));
      drawInteriorSlotActionChip(scene, c, pos.x - 22, pos.y - 26, '성장', 0x66c08a, true);
      if (equipment) {
        drawInteriorEquipmentBadge(scene, c, pos.x + 23, pos.y - 17, equipment, accent);
      } else {
        drawInteriorEquipmentSocket(scene, c, pos.x + 23, pos.y - 17, accent);
      }
    } else {
      drawMonsterPreviewPedestal(scene, c, pos.x, pos.y, accent, false, `M${i + 1}`);
      drawMonsterAnchor(scene, c, pos.x, pos.y, accent);
      drawInteriorSlotActionChip(scene, c, pos.x, pos.y + 27, '배치', accent, false);
      if (shouldHighlightDirectiveTarget(directive, 'monster') && i === firstMonsterSlot) {
        drawPreviewTargetRing(scene, c, pos.x, pos.y + 2, 98, 68, directive.accent, '배치');
      }
    }
    addPreviewHitZone(scene, c, pos.x, pos.y, 52, 64, () => {
      if (monsterId && owned) {
        navigateToFocusedMonster(scene, state, cb, monsterId, slotIdx);
        return;
      }
      showMonsterPicker(scene, state, theme, cb, nav, slotIdx, i);
    });
    if (monsterId && owned) {
      addPreviewHitZone(scene, c, pos.x + 23, pos.y - 17, 28, 26, () => {
        navigateToFocusedForge(scene, state, cb, monsterId, slotIdx);
      });
    }
  }

  drawInteriorEquipmentSummary(
    scene, state, cb, c, g, gs, slot, slotIdx,
    secX + 16, secY + panelH - 36, secW - 32, accent, monsterCount, equippedCount,
    roomMetrics.equipmentPower,
  );
  if (shouldHighlightDirectiveTarget(directive, 'growth')) {
    drawPreviewTargetRing(scene, c, secX + secW / 2, secY + panelH - 22, secW - 28, 34, directive.accent, '성장/장비');
  }

  return panelH;
}

function drawUnbuiltRoomBlueprintPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: RoomDesignRecommendation,
  directive: RoomDirective,
): void {
  const recommendedType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === recommendation.roomType);
  const blueprintX = x + 16;
  const blueprintY = y + 16;
  const blueprintW = w - 32;
  const blueprintH = h - 38;
  const centerX = x + w / 2;
  const centerY = y + h / 2 - 8;

  g.fillStyle(0x031017, 0.96);
  g.fillRoundedRect(x, y, w, h, 14);
  g.fillStyle(0x071b23, 0.88);
  g.fillRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 12);
  g.lineStyle(1.5, accent, 0.48);
  g.strokeRoundedRect(x, y, w, h, 14);
  g.lineStyle(1, 0xffffff, 0.10);
  g.strokeRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 12);

  g.lineStyle(1, accent, 0.10);
  for (let gx = blueprintX + 22; gx < blueprintX + blueprintW - 12; gx += 22) {
    g.lineBetween(gx, blueprintY + 10, gx, blueprintY + blueprintH - 10);
  }
  for (let gy = blueprintY + 20; gy < blueprintY + blueprintH - 10; gy += 20) {
    g.lineBetween(blueprintX + 10, gy, blueprintX + blueprintW - 10, gy);
  }

  g.fillStyle(0x010608, 0.54);
  g.fillRoundedRect(x + 44, y + 52, w - 88, 94, 14);
  g.lineStyle(2, accent, 0.54);
  g.strokeRoundedRect(x + 56, y + 64, w - 112, 68, 12);
  g.lineStyle(1.2, accent, 0.34);
  g.strokeRoundedRect(x + 72, y + 78, w - 144, 40, 8);
  g.lineStyle(1, 0xffffff, 0.14);
  g.lineBetween(x + 64, y + 132, x + w - 64, y + 64);
  g.lineBetween(x + 64, y + 64, x + w - 64, y + 132);

  g.lineStyle(2, 0x8f5b2b, 0.72);
  g.lineBetween(x + 38, y + 44, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 44, x + w - 38, y + 151);
  g.lineBetween(x + 30, y + 58, x + w - 30, y + 58);
  g.lineBetween(x + 34, y + 144, x + w - 34, y + 144);
  g.lineBetween(x + 38, y + 48, x + w - 38, y + 146);
  g.lineBetween(x + w - 38, y + 48, x + 38, y + 146);
  g.lineStyle(1, 0xffcf72, 0.28);
  g.lineBetween(x + 38, y + 43, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 43, x + w - 38, y + 151);

  g.fillStyle(accent, 0.13);
  g.fillCircle(centerX, centerY, 39);
  g.lineStyle(1.4, accent, 0.44);
  g.strokeCircle(centerX, centerY, 38);
  g.strokeCircle(centerX, centerY, 24);
  g.fillStyle(0x020608, 0.82);
  g.fillRoundedRect(centerX - 72, centerY - 17, 144, 34, 10);
  g.lineStyle(1, accent, 0.36);
  g.strokeRoundedRect(centerX - 72, centerY - 17, 144, 34, 10);

  c.add(scene.add.text(centerX, centerY - 5, `${recommendedType?.icon ?? '▣'} ${recommendedType?.name ?? recommendation.title}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    color: '#d8f5ff',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(centerX, centerY + 12, recommendation.shortLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#9ccbd8',
    fontStyle: 'bold' }).setOrigin(0.5));

  ROOM_SLOT_TYPE_DEFS.forEach((type, i) => {
    const optionX = x + 54 + i * ((w - 108) / Math.max(1, ROOM_SLOT_TYPE_DEFS.length - 1));
    const optionY = y + h - 54;
    const isRecommended = type.id === recommendation.roomType;
    const optionAccent = ROOM_TYPE_ACCENT[type.id] ?? accent;
    g.fillStyle(isRecommended ? optionAccent : 0x140d04, isRecommended ? 0.28 : 0.82);
    g.fillRoundedRect(optionX - 31, optionY - 16, 62, 36, 9);
    g.lineStyle(isRecommended ? 1.6 : 1, optionAccent, isRecommended ? 0.78 : 0.26);
    g.strokeRoundedRect(optionX - 31, optionY - 16, 62, 36, 9);
    if (isRecommended) {
      g.fillStyle(optionAccent, 0.95);
      g.fillCircle(optionX + 23, optionY - 11, 4);
    }
    c.add(scene.add.text(optionX, optionY - 3, type.icon, {
      fontFamily: 'sans-serif',
      fontSize: '15px' }).setOrigin(0.5));
    c.add(scene.add.text(optionX, optionY + 12, fitSlotLabel(type.name, 5), {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: isRecommended ? '#f0e6c8' : '#7fa2a8',
      fontStyle: isRecommended ? 'bold' : 'normal' }).setOrigin(0.5));
  });

  const ctaW = 118;
  const ctaX = centerX - ctaW / 2;
  const ctaY = y + h - 28;
  g.fillStyle(directive.accent, 0.88);
  g.fillRoundedRect(ctaX, ctaY, ctaW, 24, 8);
  g.lineStyle(1, 0xffffff, 0.24);
  g.strokeRoundedRect(ctaX, ctaY, ctaW, 24, 8);
  c.add(scene.add.text(centerX, ctaY + 12, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#051016',
    fontStyle: 'bold' }).setOrigin(0.5));
  if (directive.onPress) {
    const zone = scene.add.zone(centerX, ctaY + 12, ctaW, 26)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => directive.onPress?.());
    c.add(zone);
  }

  if (shouldHighlightDirectiveTarget(directive, 'type')) {
    drawPreviewTargetRing(scene, c, centerX, centerY + 1, 164, 58, directive.accent, '역할 선택');
  }
}

function drawInteriorEquipmentSummary(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  x: number,
  y: number,
  w: number,
  accent: number,
  monsterCount: number,
  equippedCount: number,
  equipmentPower: number,
): void {
  const firstMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
  const equipmentEntries = slot.monsterIds
    .filter((monsterId): monsterId is string => typeof monsterId === 'string')
    .map(monsterId => getEquippedItem(gs, monsterId))
    .filter((equipment): equipment is EquipmentBadge => Boolean(equipment));
  const primaryEquipment = equipmentEntries[0] ?? null;
  const actionLabel = firstMonsterId ? (primaryEquipment ? '교체' : '제작') : '대기';
  const assignedMonsterIds = slot.monsterIds.filter((monsterId): monsterId is string => typeof monsterId === 'string');
  const assignedCount = Math.max(1, assignedMonsterIds.length, monsterCount);
  const fullyEquipped = firstMonsterId && equippedCount >= assignedCount;
  const statusLabel = !firstMonsterId ? 'EMPTY' : fullyEquipped ? 'READY' : 'NEED';
  const statusColor = !firstMonsterId ? 0x31443d : fullyEquipped ? 0x66c08a : 0xffc44d;
  const text = primaryEquipment
    ? `${primaryEquipment.icon} ${primaryEquipment.name} · ${primaryEquipment.effect}${equipmentEntries.length > 1 ? ` · +${equipmentEntries.length - 1}` : ''}`
    : firstMonsterId
      ? '⚙ 장비 미장착 · 제작으로 방 전력 보강'
      : '⚙ 수호자 배치 후 장비 강화 가능';

  const railH = 30;
  const buttonW = 44;
  const buttonH = 18;
  const buttonX = x + w - buttonW - 7;
  const buttonY = y + 6;
  const pipAreaX = buttonX - 58;
  const titleX = x + 42;
  const textMaxChars = w < 310 ? 18 : 24;
  const powerLabel = equipmentPower !== 0 ? `전력 ${formatSignedPower(equipmentPower)}` : '전력 -';

  g.fillStyle(0x050806, 0.9);
  g.fillRoundedRect(x, y, w, railH, 8);
  g.lineStyle(1.2, primaryEquipment ? 0xe8c468 : accent, primaryEquipment ? 0.62 : 0.32);
  g.strokeRoundedRect(x, y, w, railH, 8);
  g.fillStyle(primaryEquipment ? 0xe8c468 : accent, primaryEquipment ? 0.18 : 0.1);
  g.fillRoundedRect(x + 5, y + 5, 28, railH - 10, 7);
  g.lineStyle(1, primaryEquipment ? 0xffef9c : accent, primaryEquipment ? 0.42 : 0.24);
  g.strokeRoundedRect(x + 5, y + 5, 28, railH - 10, 7);
  c.add(scene.add.text(x + 19, y + railH / 2, primaryEquipment?.icon ?? '⚙', {
    fontFamily: 'sans-serif',
    fontSize: '13px' }).setOrigin(0.5));

  g.fillStyle(statusColor, firstMonsterId ? 0.2 : 0.12);
  g.fillRoundedRect(titleX, y + 4, 38, 11, 4);
  g.lineStyle(1, statusColor, firstMonsterId ? 0.5 : 0.26);
  g.strokeRoundedRect(titleX, y + 4, 38, 11, 4);
  c.add(scene.add.text(titleX + 19, y + 9.5, statusLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: firstMonsterId ? '#f5ffe7' : '#79958a',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(titleX + 44, y + 9.5, `장비 ${equippedCount}/${assignedCount}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: primaryEquipment ? '#ffdf6e' : '#7aa895',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(titleX, y + 22, fitSlotLabel(text, textMaxChars), {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: primaryEquipment ? '#fff0c2' : '#9ebcae' }).setOrigin(0, 0.5));

  g.fillStyle(equipmentPower > 0 ? 0xe8c468 : 0x11261d, equipmentPower > 0 ? 0.22 : 0.46);
  g.fillRoundedRect(pipAreaX - 2, y + 4, 48, 10, 4);
  g.lineStyle(1, equipmentPower > 0 ? 0xe8c468 : 0x38584c, equipmentPower > 0 ? 0.46 : 0.3);
  g.strokeRoundedRect(pipAreaX - 2, y + 4, 48, 10, 4);
  c.add(scene.add.text(pipAreaX + 22, y + 9, powerLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: equipmentPower > 0 ? '#ffdf6e' : '#7aa895',
    fontStyle: 'bold' }).setOrigin(0.5));

  const pipCount = Math.min(4, assignedCount);
  const pipGap = 11;
  const pipStartX = pipAreaX + 5;
  for (let i = 0; i < pipCount; i++) {
    const pipX = pipStartX + i * pipGap;
    const monsterId = assignedMonsterIds[i];
    const equipped = Boolean(monsterId && getEquippedItem(gs, monsterId));
    g.fillStyle(equipped ? 0xe8c468 : 0x101a1a, equipped ? 0.95 : 0.78);
    g.fillRoundedRect(pipX, y + 18, 8, 8, 3);
    g.lineStyle(1, equipped ? 0xffef9c : 0x3f6557, equipped ? 0.7 : 0.42);
    g.strokeRoundedRect(pipX, y + 18, 8, 8, 3);
    if (!equipped) {
      c.add(scene.add.text(pipX + 4, y + 22, '+', {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#6d9f8a',
        fontStyle: 'bold' }).setOrigin(0.5));
    }
  }

  g.fillStyle(firstMonsterId ? 0x2e2142 : 0x111716, firstMonsterId ? 0.95 : 0.72);
  g.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 6);
  g.lineStyle(1, firstMonsterId ? 0x9a6cd8 : 0x31443d, firstMonsterId ? 0.64 : 0.38);
  g.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 6);
  c.add(scene.add.text(buttonX + buttonW / 2, buttonY + buttonH / 2, actionLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: firstMonsterId ? '#e4d8ff' : '#6f8c82',
    fontStyle: 'bold' }).setOrigin(0.5));

  if (firstMonsterId) {
    addPreviewHitZone(scene, c, x + w / 2, y + railH / 2, w, railH, () => {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
    });
  }
}

function drawInteriorLoadoutBands(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  monsterCap: number,
  monsterCount: number,
  trapCap: number,
  trapCount: number,
  equippedCount: number,
  readiness: number,
): void {
  const trapY = y + Math.round(h * 0.27);
  const guardY = y + Math.round(h * 0.68);
  const readinessColor = readiness >= 78 ? 0x66c08a : readiness >= 45 ? 0xc8921a : 0xff6a4a;
  const floorTop = y + Math.round(h * 0.43);

  g.fillStyle(0x050302, 0.34);
  g.fillRoundedRect(x + 24, trapY - 16, w - 48, 36, 10);
  g.fillStyle(0x030608, 0.44);
  g.beginPath();
  g.moveTo(x + 34, floorTop);
  g.lineTo(x + w - 34, floorTop);
  g.lineTo(x + w - 18, y + h - 18);
  g.lineTo(x + 18, y + h - 18);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x050806, 0.56);
  g.fillRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.fillRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);
  g.lineStyle(1.1, accent, 0.20);
  g.strokeRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.strokeRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);

  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 34, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + w - 42, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + 35, guardY - 27, 8, 58, 4);
  g.fillRoundedRect(x + w - 43, guardY - 27, 8, 58, 4);
  g.lineStyle(1, accent, 0.12);
  g.lineBetween(x + 42, trapY + 18, x + 52, guardY - 30);
  g.lineBetween(x + w - 42, trapY + 18, x + w - 52, guardY - 30);

  g.lineStyle(1, accent, 0.14);
  g.lineBetween(x + 40, trapY + 2, x + w - 40, trapY + 2);
  g.lineBetween(x + 43, guardY + 19, x + w - 43, guardY + 19);
  g.lineStyle(1, 0xffffff, 0.06);
  g.lineBetween(x + 56, floorTop + 14, x + 43, y + h - 25);
  g.lineBetween(x + w - 56, floorTop + 14, x + w - 43, y + h - 25);

  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(x + 38, trapY - 9, Math.max(12, (w - 76) * (trapCap > 0 ? trapCount / trapCap : 0)), 4, 2);
  g.fillRoundedRect(x + 38, guardY + 25, Math.max(12, (w - 76) * (monsterCap > 0 ? monsterCount / monsterCap : 0)), 4, 2);
  drawInteriorEquipmentTrack(g, x + w - 92, guardY - 6, equippedCount, monsterCap, accent);

  c.add(scene.add.text(x + 42, trapY - 2, '함정 라인', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, trapY - 2, `T ${trapCount}/${trapCap}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: trapCount > 0 ? '#ffe080' : '#56707a',
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  c.add(scene.add.text(x + 42, guardY - 20, '수호 라인', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, guardY - 20, `M ${monsterCount}/${monsterCap} · E ${equippedCount}/${monsterCap}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: monsterCount > 0 ? '#ffe080' : '#56707a',
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  const chipX = x + w - 76;
  const chipY = y + h - 18;
  g.fillStyle(0x0b0703, 0.88);
  g.fillRoundedRect(chipX, chipY, 58, 13, 5);
  g.lineStyle(1, readinessColor, 0.56);
  g.strokeRoundedRect(chipX, chipY, 58, 13, 5);
  g.fillStyle(readinessColor, 0.18);
  g.fillRoundedRect(chipX + 2, chipY + 2, Math.max(5, 54 * Phaser.Math.Clamp(readiness / 100, 0, 1)), 9, 4);
  c.add(scene.add.text(chipX + 29, chipY + 6.5, `운영 ${readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#fff0c2',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorPlacementScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  slot: DungeonSlot,
  monsterCap: number,
  trapCap: number,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const coreX = x + w / 2;
  const coreY = y + h - 27;
  const trapBusY = y + Math.round(h * 0.27) + 2;
  const guardBusY = y + Math.round(h * 0.68) + 18;

  g.lineStyle(1, accent, 0.10 + glow * 0.08);
  g.lineBetween(x + 46, trapBusY, x + w - 46, trapBusY);
  g.lineBetween(x + 50, guardBusY, x + w - 50, guardBusY);
  g.lineStyle(1, 0xffffff, 0.035 + glow * 0.025);
  g.lineBetween(coreX, y + Math.round(h * 0.44), coreX, y + h - 22);

  for (let i = 0; i < trapCap; i += 1) {
    const pos = getPreviewSlotPosition(i, trapCap, x + 60, y + Math.round(h * 0.27), w - 120, 28);
    const filled = Boolean(slot.trapIds?.[i]);
    const color = filled ? 0xffc45f : accent;
    const alpha = filled ? 0.22 + glow * 0.08 : 0.10 + glow * 0.04;

    g.lineStyle(1, color, alpha);
    g.lineBetween(pos.x, pos.y + 14, pos.x, trapBusY);
    g.lineBetween(pos.x, trapBusY, coreX + (pos.x < coreX ? -18 : 18), y + Math.round(h * 0.43));
    g.fillStyle(color, alpha * 0.68);
    g.beginPath();
    g.moveTo(pos.x, pos.y - 25);
    g.lineTo(pos.x + 29, pos.y - 6);
    g.lineTo(pos.x + 21, pos.y + 20);
    g.lineTo(pos.x - 21, pos.y + 20);
    g.lineTo(pos.x - 29, pos.y - 6);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, color, filled ? 0.30 : 0.16);
    g.strokePath();
    g.fillStyle(0x050302, 0.34);
    g.fillCircle(pos.x, pos.y + 2, 18);
    g.fillStyle(color, filled ? 0.22 : 0.10);
    g.fillCircle(pos.x, pos.y + 2, 8);
  }

  for (let i = 0; i < monsterCap; i += 1) {
    const pos = getPreviewSlotPosition(i, monsterCap, x + 58, y + Math.round(h * 0.68), w - 116, 34);
    const filled = Boolean(slot.monsterIds?.[i]);
    const color = filled ? accent : 0x55b88a;
    const alpha = filled ? 0.20 + glow * 0.10 : 0.08 + glow * 0.04;

    g.lineStyle(1, color, alpha);
    g.lineBetween(pos.x, pos.y + 24, pos.x, guardBusY);
    g.lineBetween(pos.x, guardBusY, coreX + (pos.x < coreX ? -22 : 22), coreY - 18);
    g.fillStyle(color, alpha * 0.64);
    g.fillEllipse(pos.x, pos.y + 15, 70, 25);
    g.lineStyle(1, color, filled ? 0.28 : 0.14);
    g.strokeEllipse(pos.x, pos.y + 15, 62, 20);
    g.strokeCircle(pos.x, pos.y + 1, filled ? 27 : 23);
    g.lineStyle(1, 0xffffff, filled ? 0.08 : 0.04);
    g.lineBetween(pos.x - 21, pos.y + 15, pos.x + 21, pos.y + 15);
    g.lineBetween(pos.x, pos.y - 8, pos.x, pos.y + 29);
    g.fillStyle(color, filled ? 0.24 : 0.12);
    g.fillCircle(pos.x - 25, pos.y + 17, 2);
    g.fillCircle(pos.x + 25, pos.y + 17, 2);
  }

  g.fillStyle(accent, 0.08 + glow * 0.08);
  g.fillCircle(coreX, coreY, 34);
  g.lineStyle(1, accent, 0.18 + glow * 0.12);
  g.strokeCircle(coreX, coreY, 27);
}

function drawInteriorEquipmentTrack(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  y: number,
  equippedCount: number,
  monsterCap: number,
  accent: number,
): void {
  const visibleCapacity = Math.min(Math.max(1, monsterCap), 4);
  g.fillStyle(0x030608, 0.76);
  g.fillRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.lineStyle(1, 0xe8c468, equippedCount > 0 ? 0.38 : 0.18);
  g.strokeRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(startX - 5, y + 4, Math.max(5, visibleCapacity * 8 + 8), 1.5, 1);

  for (let i = 0; i < visibleCapacity; i += 1) {
    const px = startX + i * 8;
    const filled = i < equippedCount;
    g.fillStyle(filled ? 0xe8c468 : 0x121a1a, filled ? 0.94 : 0.78);
    g.beginPath();
    g.moveTo(px, y - 4);
    g.lineTo(px + 4, y);
    g.lineTo(px, y + 4);
    g.lineTo(px - 4, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, filled ? 0xe8c468 : accent, filled ? 0.58 : 0.24);
    g.strokeTriangle(px, y - 4, px + 4, y, px, y + 4);
    g.lineBetween(px, y + 4, px - 4, y);
    g.lineBetween(px - 4, y, px, y - 4);
  }
  if (monsterCap > visibleCapacity) {
    g.fillStyle(0xe8c468, 0.46);
    g.fillCircle(startX + visibleCapacity * 8 + 2, y, 1.5);
  }
}

export function navigateToFocusedMonster(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  monsterId: string,
  slotIdx: number,
): void {
  scene.registry.set('focusMonsterId', monsterId);
  scene.registry.set('focusSourceLabel', `방 #${slotIdx + 1} 수호자`);
  scene.registry.set('focusRoomSlotIdx', slotIdx);
  navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
}

export function navigateToFocusedForge(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  monsterId: string,
  slotIdx: number,
): void {
  scene.registry.set('focusMonsterId', monsterId);
  scene.registry.set('focusSourceLabel', `방 #${slotIdx + 1} 수호자`);
  scene.registry.set('focusRoomSlotIdx', slotIdx);
  scene.registry.set('forgeReturnScene', 'DungeonHomeScene');
  navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
}
