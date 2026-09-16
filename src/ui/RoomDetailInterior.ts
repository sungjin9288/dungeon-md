import { fitSlotLabel } from './RoomDetailCompactCards';
import { addPreviewHitZone, drawInteriorChamber, drawInteriorDungeonEditorDetails, drawInteriorEquipmentAura, drawInteriorEquipmentBadge, drawInteriorEquipmentSocket, drawInteriorRoomFixture, drawInteriorRoomPlaque, drawInteriorSlotActionChip, drawMonsterAnchor, drawMonsterPreviewPedestal, drawPreviewTargetRing, drawTrapPreviewSlot } from './RoomDetailInteriorDecor';
// ─── Room Detail Interior Preview ─────────────────────────────────────────────
// RoomDetailOverlay에서 분리한 방 내부 프리뷰 + 컴팩트 로드아웃 드로잉 계층.
// 진입점: buildRoomInteriorPreview (열린 방), drawUnbuiltRoomBlueprintPreview(본체 잔류).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { ROOM_SLOT_TYPE_DEFS, type DungeonSlot, type GameState } from '../data/wisdom';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation, type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  deriveRoomEditorPreviewState,
  getRoomEditorPreviewLayout,
  type RoomEditorPreviewAction,
  type RoomEditorPreviewLayout,
  type RoomEditorPreviewState,
} from './RoomEditorPreviewState';

export type { PickerNavCallbacks };


import {
  formatSignedPower, getEquippedItem,
  navigateFromRoomDetail, shouldHighlightDirectiveTarget,
  EquipmentBadge, ROOM_TYPE_ACCENT, RoomDetailCallbacks, RoomDetailState, RoomDirective } from './RoomDetailShared';
import { drawRoomTypeSigil } from './RoomDetailSkin';

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
  const panelH = 322;
  const accent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0x66c08a : 0x55b88a;
  const roomMetrics = calculateRoomMetrics(gs, slot);

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: panelH,
    radius: 5,
    fillColor: DUNGEON_UI.SOOT,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 1,
    borderWidth: 1,
    accentColor: accent,
    accentAlpha: 0.9,
    glowColor: accent,
    glowOpacity: 0.025,
    shadowOpacity: 0.3,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const g = scene.add.graphics();
  c.add(g);
  const chamberX = secX + 10;
  const chamberY = secY + 36;
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
    drawRoomTypeSigil(g, undefined, secX + 22, secY + 18, 17, DUNGEON_UI.BRASS_BRIGHT);
    c.add(scene.add.text(secX + 36, secY + 18, '방 설계 도면', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: DUNGEON_UI_CSS.PARCHMENT,
      fontStyle: 'bold' }).setOrigin(0, 0.5));
    c.add(scene.add.text(secX + secW - 16, secY + 17, `추천 ${recommendedType?.name ?? recommendation.title} · ${recommendation.shortLabel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold' }).setOrigin(1, 0.5));
    return panelH;
  }

  const preview = deriveRoomEditorPreviewState(gs, slot, directive.target);
  const previewLayout = getRoomEditorPreviewLayout(preview, {
    chamberX,
    chamberY,
    chamberWidth: chamberW,
    chamberHeight: chamberH,
  });
  const cap = preview.capacity;
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = preview.monsterCount;
  const trapCount = preview.trapCount;
  const equippedCount = preview.equippedCount;

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
    previewLayout,
    roomMetrics.readiness,
  );
  if (shouldHighlightDirectiveTarget(directive, 'type')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH * 0.54, 138, 72, directive.accent, '역할 선택');
  }
  if (shouldHighlightDirectiveTarget(directive, 'repair')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH / 2, chamberW - 26, chamberH - 18, directive.accent, '수리 필요');
  }

  const roomLabel = typeDef?.name ?? '일반실';
  drawInteriorRoomPlaque(
    scene,
    c,
    g,
    chamberX,
    chamberY,
    chamberW,
    accent,
    slot.roomType,
    roomLabel,
    slot.roomLevel,
    roomMetrics.readiness,
    Boolean(slot.roomType && slot.hp <= 0),
  );
  drawRoomTypeSigil(g, slot.roomType, secX + 22, secY + 18, 17, accent);
  c.add(scene.add.text(secX + 36, secY + 18, '방 내부 배치', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: DUNGEON_UI_CSS.PARCHMENT,
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
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  for (const { socket: trapSocket, x, y } of previewLayout.traps) {
    const isAssigned = trapSocket.state === 'assigned';
    drawTrapPreviewSlot(
      scene,
      c,
      x,
      y,
      accent,
      trapSocket.state,
      `T${trapSocket.slotIndex + 1}`,
    );
    drawInteriorSlotActionChip(scene, c, x, y + 18, isAssigned ? '교체' : '설치', isAssigned ? 0xffc44d : accent, isAssigned);
    if (trapSocket.state === 'target') {
      drawPreviewTargetRing(scene, c, x, y + 8, 92, 52, directive.accent, '설치');
    }
    const hitZone = findPreviewHitZone(previewLayout, 'trap-picker', trapSocket.slotIndex);
    if (hitZone) {
      addPreviewHitZone(scene, c, hitZone.x, hitZone.y, hitZone.width, hitZone.height, () => {
        showTrapPicker(scene, state, theme, cb, nav, slotIdx, trapSocket.slotIndex);
      });
    }
  }

  for (const { socket: monsterSocket, x, y } of previewLayout.monsters) {
    const monsterId = monsterSocket.monsterId;
    const equipmentSocket = preview.equipment[monsterSocket.slotIndex];
    const equipment = equipmentSocket?.state === 'assigned'
      ? getEquippedItem(gs, monsterId)
      : null;
    if (monsterId) {
      drawMonsterPreviewPedestal(scene, c, x, y, accent, monsterSocket.state, `M${monsterSocket.slotIndex + 1}`);
      addMonsterPortrait(scene, c, x, y, monsterId, {
        size: 38,
        frameColor: accent,
        glowColor: accent,
        bgColor: DUNGEON_UI.STONE,
        equippedSkins: gs.equippedSkins ?? {} });
      c.add(scene.add.text(x, y + 28, monsterSocket.hasOwnedMetadata ? `Lv.${monsterSocket.level}` : '?', {
        fontFamily: 'sans-serif',
        fontSize: monsterSocket.hasOwnedMetadata ? '10px' : '12px',
        color: DUNGEON_UI_CSS.BRASS,
        fontStyle: 'bold' }).setOrigin(0.5));
      drawInteriorSlotActionChip(scene, c, x - 22, y - 26, monsterSocket.hasOwnedMetadata ? '성장' : '교체', CASUAL.GREEN, true);
      if (equipment) {
        drawInteriorEquipmentBadge(scene, c, x + 23, y - 17, equipment, accent);
      } else {
        drawInteriorEquipmentSocket(scene, c, x + 23, y - 17, accent, equipmentSocket?.state ?? 'disabled');
      }
      if (equipmentSocket?.state === 'target') {
        drawPreviewTargetRing(scene, c, x + 23, y - 17, 76, 44, directive.accent, '제작');
      }
    } else {
      drawMonsterPreviewPedestal(scene, c, x, y, accent, monsterSocket.state, `M${monsterSocket.slotIndex + 1}`);
      drawMonsterAnchor(scene, c, x, y, accent, monsterSocket.state);
      drawInteriorSlotActionChip(scene, c, x, y + 27, '배치', accent, false);
      if (monsterSocket.state === 'target') {
        drawPreviewTargetRing(scene, c, x, y + 2, 98, 68, directive.accent, '배치');
      }
    }
    const pickerZone = findPreviewHitZone(previewLayout, 'monster-picker', monsterSocket.slotIndex);
    if (pickerZone) {
      addPreviewHitZone(scene, c, pickerZone.x, pickerZone.y, pickerZone.width, pickerZone.height, () => {
        showMonsterPicker(scene, state, theme, cb, nav, slotIdx, monsterSocket.slotIndex);
      });
    }
    const growthZone = findPreviewHitZone(previewLayout, 'monster-growth', monsterSocket.slotIndex);
    if (growthZone && monsterId) {
      addPreviewHitZone(scene, c, growthZone.x, growthZone.y, growthZone.width, growthZone.height, () => {
        navigateToFocusedMonster(scene, state, cb, monsterId, slotIdx);
      });
    }
    const forgeZone = findPreviewHitZone(previewLayout, 'forge', monsterSocket.slotIndex);
    if (forgeZone && monsterId) {
      addPreviewHitZone(scene, c, forgeZone.x, forgeZone.y, forgeZone.width, forgeZone.height, () => {
        navigateToFocusedForge(scene, state, cb, monsterId, slotIdx);
      });
    }
  }

  drawInteriorEquipmentSummary(
    scene, state, cb, c, g, gs, preview, slotIdx,
    secX + 16, secY + panelH - 50, secW - 32, accent,
    roomMetrics.equipmentPower,
  );

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

  g.fillStyle(DUNGEON_UI.VOID, 0.99);
  g.fillRoundedRect(x, y, w, h, 5);
  g.fillStyle(DUNGEON_UI.STONE, 0.96);
  g.fillRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 3);
  g.lineStyle(1.5, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(x, y, w, h, 5);
  g.lineStyle(1, DUNGEON_UI.BRASS, 0.24);
  g.strokeRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 3);

  g.lineStyle(1, DUNGEON_UI.EDGE, 0.16);
  for (let gx = blueprintX + 22; gx < blueprintX + blueprintW - 12; gx += 22) {
    g.lineBetween(gx, blueprintY + 10, gx, blueprintY + blueprintH - 10);
  }
  for (let gy = blueprintY + 20; gy < blueprintY + blueprintH - 10; gy += 20) {
    g.lineBetween(blueprintX + 10, gy, blueprintX + blueprintW - 10, gy);
  }

  g.fillStyle(DUNGEON_UI.SOOT, 0.82);
  g.fillRoundedRect(x + 44, y + 52, w - 88, 82, 5);
  g.lineStyle(2, accent, 0.7);
  g.strokeRoundedRect(x + 56, y + 64, w - 112, 68, 12);
  g.lineStyle(1.2, accent, 0.44);
  g.strokeRoundedRect(x + 72, y + 78, w - 144, 40, 8);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.3);
  g.lineBetween(x + 64, y + 132, x + w - 64, y + 64);
  g.lineBetween(x + 64, y + 64, x + w - 64, y + 132);

  g.lineStyle(2, DUNGEON_UI.IRON, 0.8);
  g.lineBetween(x + 38, y + 44, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 44, x + w - 38, y + 151);
  g.lineBetween(x + 30, y + 58, x + w - 30, y + 58);
  g.lineBetween(x + 34, y + 144, x + w - 34, y + 144);
  g.lineBetween(x + 38, y + 48, x + w - 38, y + 146);
  g.lineBetween(x + w - 38, y + 48, x + 38, y + 146);
  g.lineStyle(1, CASUAL.GOLD, 0.4);
  g.lineBetween(x + 38, y + 43, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 43, x + w - 38, y + 151);

  g.fillStyle(accent, 0.16);
  g.fillCircle(centerX, centerY, 39);
  g.lineStyle(1.4, accent, 0.6);
  g.strokeCircle(centerX, centerY, 38);
  g.strokeCircle(centerX, centerY, 24);
  g.fillStyle(DUNGEON_UI.VOID, 0.94);
  g.fillRoundedRect(centerX - 72, centerY - 20, 144, 40, 4);
  g.lineStyle(1, accent, 0.5);
  g.strokeRoundedRect(centerX - 72, centerY - 17, 144, 34, 10);

  drawRoomTypeSigil(g, recommendation.roomType, centerX - 47, centerY - 7, 20, accent);
  c.add(scene.add.text(centerX + 4, centerY - 7, recommendedType?.name ?? recommendation.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(centerX, centerY + 12, recommendation.shortLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0.5));

  ROOM_SLOT_TYPE_DEFS.forEach((type, i) => {
    const optionX = x + 54 + i * ((w - 108) / Math.max(1, ROOM_SLOT_TYPE_DEFS.length - 1));
    const optionY = y + h - 75;
    const isRecommended = type.id === recommendation.roomType;
    const optionAccent = ROOM_TYPE_ACCENT[type.id] ?? accent;
    g.fillStyle(isRecommended ? optionAccent : DUNGEON_UI.VOID, isRecommended ? 0.22 : 0.94);
    g.fillRoundedRect(optionX - 31, optionY - 15, 62, 32, 4);
    g.lineStyle(isRecommended ? 1.6 : 1, optionAccent, isRecommended ? 0.85 : 0.4);
    g.strokeRoundedRect(optionX - 31, optionY - 15, 62, 32, 4);
    if (isRecommended) {
      g.fillStyle(optionAccent, 0.95);
      g.fillCircle(optionX + 23, optionY - 11, 4);
    }
    drawRoomTypeSigil(g, type.id, optionX, optionY - 4, 14, optionAccent);
    c.add(scene.add.text(optionX, optionY + 11, fitSlotLabel(type.name, 5), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: isRecommended ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
      fontStyle: isRecommended ? 'bold' : 'normal' }).setOrigin(0.5));
  });

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
  preview: RoomEditorPreviewState,
  slotIdx: number,
  x: number,
  y: number,
  w: number,
  accent: number,
  equipmentPower: number,
): void {
  const actionableEquipment = preview.equipment.filter(socket => socket.state !== 'disabled');
  const firstMonsterId = actionableEquipment.find(socket => socket.monsterId)?.monsterId;
  const equipmentEntries = preview.equipment
    .filter((socket): socket is typeof socket & { monsterId: string } =>
      socket.state === 'assigned' && typeof socket.monsterId === 'string',
    )
    .map(socket => getEquippedItem(gs, socket.monsterId))
    .filter((equipment): equipment is EquipmentBadge => Boolean(equipment));
  const primaryEquipment = equipmentEntries[0] ?? null;
  const assignedMonsterIds = preview.monsters
    .map(socket => socket.monsterId)
    .filter((monsterId): monsterId is string => typeof monsterId === 'string');
  const assignedCount = Math.max(1, assignedMonsterIds.length);
  const hasDisabledEquipment = preview.equipment.some(socket =>
    Boolean(socket.monsterId) && socket.state === 'disabled',
  );
  const fullyEquipped = actionableEquipment.length > 0 && preview.equippedCount >= actionableEquipment.length;
  const actionLabel = firstMonsterId ? (primaryEquipment ? '교체' : '제작') : hasDisabledEquipment ? '잠김' : '대기';
  const text = primaryEquipment
    ? `${primaryEquipment.name} · ${primaryEquipment.effect}${equipmentEntries.length > 1 ? ` · +${equipmentEntries.length - 1}` : ''}`
    : hasDisabledEquipment
      ? '소유 정보 없음 · 장비 편집 잠김'
      : firstMonsterId
      ? '장비 미장착 · 제작으로 방 전력 보강'
      : '수호자 배치 후 장비 강화 가능';

  const railH = 44;
  const buttonW = 54;
  const buttonH = 34;
  const buttonX = x + w - buttonW - 5;
  const buttonY = y + 5;
  const titleX = x + 38;
  const textMaxChars = w < 310 ? 20 : 27;
  const powerLabel = equipmentPower !== 0 ? `전력 ${formatSignedPower(equipmentPower)}` : '전력 -';
  const statusColor = fullyEquipped ? DUNGEON_UI.BRASS_BRIGHT : firstMonsterId ? accent : DUNGEON_UI.EDGE;

  g.fillStyle(DUNGEON_UI.VOID, 0.96);
  g.fillRoundedRect(x, y, w, railH, 4);
  g.lineStyle(1.2, statusColor, firstMonsterId ? 0.7 : 0.38);
  g.strokeRoundedRect(x, y, w, railH, 4);
  g.fillStyle(statusColor, 0.18);
  g.fillRoundedRect(x + 5, y + 5, 26, railH - 10, 3);
  g.lineStyle(1.4, statusColor, 0.9);
  g.strokeTriangle(x + 18, y + 10, x + 26, y + 27, x + 10, y + 27);
  g.lineBetween(x + 18, y + 14, x + 18, y + 30);

  c.add(scene.add.text(titleX, y + 12, `장비 ${preview.equippedCount}/${assignedCount} · ${powerLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: primaryEquipment ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(titleX, y + 29, fitSlotLabel(text, textMaxChars), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: primaryEquipment ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED }).setOrigin(0, 0.5));

  g.fillStyle(firstMonsterId ? DUNGEON_UI.BRASS : DUNGEON_UI.STONE_RAISED, firstMonsterId ? 0.94 : 0.82);
  g.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 3);
  g.lineStyle(1, firstMonsterId ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE, 0.74);
  g.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 3);
  c.add(scene.add.text(buttonX + buttonW / 2, buttonY + buttonH / 2, actionLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: firstMonsterId ? '#120d06' : DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0.5));

  if (firstMonsterId) {
    addPreviewHitZone(scene, c, x + w / 2, y + railH / 2, w, 44, () => {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
    });
  }
}

function findPreviewHitZone(
  layout: RoomEditorPreviewLayout,
  action: RoomEditorPreviewAction,
  slotIndex: number,
) {
  return layout.hitZones.find(zone => zone.action === action && zone.slotIndex === slotIndex);
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
  const guardY = y + Math.round(h * 0.66);
  const readinessColor = readiness >= 78 ? CASUAL.GREEN : readiness >= 45 ? CASUAL.GOLD : CASUAL.RED;
  const floorTop = y + Math.round(h * 0.43);

  g.fillStyle(DUNGEON_UI.VOID, 0.42);
  g.fillRoundedRect(x + 24, trapY - 16, w - 48, 36, 10);
  g.fillStyle(DUNGEON_UI.VOID, 0.76);
  g.beginPath();
  g.moveTo(x + 34, floorTop);
  g.lineTo(x + w - 34, floorTop);
  g.lineTo(x + w - 18, y + h - 18);
  g.lineTo(x + 18, y + h - 18);
  g.closePath();
  g.fillPath();

  g.fillStyle(DUNGEON_UI.STONE, 0.78);
  g.fillRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.fillRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);
  g.lineStyle(1.1, accent, 0.34);
  g.strokeRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.strokeRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);

  g.fillStyle(accent, 0.14);
  g.fillRoundedRect(x + 34, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + w - 42, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + 35, guardY - 27, 8, 58, 4);
  g.fillRoundedRect(x + w - 43, guardY - 27, 8, 58, 4);
  g.lineStyle(1, accent, 0.18);
  g.lineBetween(x + 42, trapY + 18, x + 52, guardY - 30);
  g.lineBetween(x + w - 42, trapY + 18, x + w - 52, guardY - 30);

  g.lineStyle(1, DUNGEON_UI.EDGE, 0.3);
  g.lineBetween(x + 40, trapY + 2, x + w - 40, trapY + 2);
  g.lineBetween(x + 43, guardY + 19, x + w - 43, guardY + 19);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.2);
  g.lineBetween(x + 56, floorTop + 14, x + 43, y + h - 25);
  g.lineBetween(x + w - 56, floorTop + 14, x + w - 43, y + h - 25);

  g.fillStyle(accent, 0.2);
  g.fillRoundedRect(x + 38, trapY - 9, Math.max(12, (w - 76) * (trapCap > 0 ? trapCount / trapCap : 0)), 4, 2);
  g.fillRoundedRect(x + 38, guardY + 25, Math.max(12, (w - 76) * (monsterCap > 0 ? monsterCount / monsterCap : 0)), 4, 2);
  drawInteriorEquipmentTrack(g, x + w - 92, guardY - 6, equippedCount, monsterCap, accent);

  c.add(scene.add.text(x + 42, trapY - 2, '함정 라인', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, trapY - 2, `T ${trapCount}/${trapCap}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: trapCount > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
  c.add(scene.add.text(x + 42, guardY - 20, '수호 라인', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, guardY - 20, `M ${monsterCount}/${monsterCap} · E ${equippedCount}/${monsterCap}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: monsterCount > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  const chipX = x + w - 76;
  const chipY = y + h - 18;
  g.fillStyle(DUNGEON_UI.VOID, 0.94);
  g.fillRoundedRect(chipX, chipY, 58, 13, 5);
  g.lineStyle(1, readinessColor, 0.7);
  g.strokeRoundedRect(chipX, chipY, 58, 13, 5);
  g.fillStyle(readinessColor, 0.28);
  g.fillRoundedRect(chipX + 2, chipY + 2, Math.max(5, 54 * Phaser.Math.Clamp(readiness / 100, 0, 1)), 9, 4);
  c.add(scene.add.text(chipX + 29, chipY + 6.5, `운영 ${readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorPlacementScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  layout: RoomEditorPreviewLayout,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const coreX = x + w / 2;
  const coreY = y + h - 27;
  const trapBusY = y + Math.round(h * 0.27) + 2;
  const guardBusY = y + Math.round(h * 0.66) + 18;

  g.lineStyle(1, accent, 0.16 + glow * 0.1);
  g.lineBetween(x + 46, trapBusY, x + w - 46, trapBusY);
  g.lineBetween(x + 50, guardBusY, x + w - 50, guardBusY);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.08 + glow * 0.05);
  g.lineBetween(coreX, y + Math.round(h * 0.44), coreX, y + h - 22);

  for (const { socket, x: posX, y: posY } of layout.traps) {
    const filled = socket.state === 'assigned';
    const color = filled ? CASUAL.GOLD : accent;
    const alpha = filled ? 0.28 + glow * 0.1 : 0.14 + glow * 0.05;

    g.lineStyle(1, color, alpha);
    g.lineBetween(posX, posY + 14, posX, trapBusY);
    g.lineBetween(posX, trapBusY, coreX + (posX < coreX ? -18 : 18), y + Math.round(h * 0.43));
    g.fillStyle(color, alpha * 0.68);
    g.beginPath();
    g.moveTo(posX, posY - 25);
    g.lineTo(posX + 29, posY - 6);
    g.lineTo(posX + 21, posY + 20);
    g.lineTo(posX - 21, posY + 20);
    g.lineTo(posX - 29, posY - 6);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, color, filled ? 0.4 : 0.22);
    g.strokePath();
    g.fillStyle(CASUAL.SHADOW, 0.14);
    g.fillCircle(posX, posY + 2, 18);
    g.fillStyle(color, filled ? 0.28 : 0.14);
    g.fillCircle(posX, posY + 2, 8);
  }

  for (const { socket, x: posX, y: posY } of layout.monsters) {
    const filled = socket.state === 'assigned';
    const color = filled ? accent : CASUAL.GREEN;
    const alpha = filled ? 0.26 + glow * 0.12 : 0.12 + glow * 0.05;

    g.lineStyle(1, color, alpha);
    g.lineBetween(posX, posY + 24, posX, guardBusY);
    g.lineBetween(posX, guardBusY, coreX + (posX < coreX ? -22 : 22), coreY - 18);
    g.fillStyle(color, alpha * 0.64);
    g.fillEllipse(posX, posY + 15, 70, 25);
    g.lineStyle(1, color, filled ? 0.38 : 0.2);
    g.strokeEllipse(posX, posY + 15, 62, 20);
    g.strokeCircle(posX, posY + 1, filled ? 27 : 23);
    g.lineStyle(1, DUNGEON_UI.EDGE, filled ? 0.12 : 0.06);
    g.lineBetween(posX - 21, posY + 15, posX + 21, posY + 15);
    g.lineBetween(posX, posY - 8, posX, posY + 29);
    g.fillStyle(color, filled ? 0.24 : 0.12);
    g.fillCircle(posX - 25, posY + 17, 2);
    g.fillCircle(posX + 25, posY + 17, 2);
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
  g.fillStyle(DUNGEON_UI.VOID, 0.88);
  g.fillRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.lineStyle(1, CASUAL.GOLD_DK, equippedCount > 0 ? 0.5 : 0.3);
  g.strokeRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(startX - 5, y + 4, Math.max(5, visibleCapacity * 8 + 8), 1.5, 1);

  for (let i = 0; i < visibleCapacity; i += 1) {
    const px = startX + i * 8;
    const filled = i < equippedCount;
    g.fillStyle(filled ? CASUAL.GOLD : DUNGEON_UI.STONE, filled ? 0.95 : 0.8);
    g.beginPath();
    g.moveTo(px, y - 4);
    g.lineTo(px + 4, y);
    g.lineTo(px, y + 4);
    g.lineTo(px - 4, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, filled ? CASUAL.GOLD_DK : DUNGEON_UI.EDGE, filled ? 0.7 : 0.4);
    g.strokeTriangle(px, y - 4, px + 4, y, px, y + 4);
    g.lineBetween(px, y + 4, px - 4, y);
    g.lineBetween(px - 4, y, px, y - 4);
  }
  if (monsterCap > visibleCapacity) {
    g.fillStyle(CASUAL.GOLD, 0.6);
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
