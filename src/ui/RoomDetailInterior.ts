// ─── Room Detail Interior Preview ─────────────────────────────────────────────
// RoomDetailOverlay에서 분리한 방 내부 프리뷰 + 컴팩트 로드아웃 드로잉 계층.
// 진입점: buildRoomInteriorPreview (열린 방), drawUnbuiltRoomBlueprintPreview(본체 잔류).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import {
  getRoomSlotCapacity,   ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterDef } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import {
  
  
  calculateRoomMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation, type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import {
  
  
  type MonsterLoadoutRecommendation,
  type TrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  findFirstEmptySlot, formatSignedPower, getEquippedItem,
  navigateFromRoomDetail, prefersReducedMotion, shouldHighlightDirectiveTarget,
  EquipmentBadge, MONSTER_RARITY_META, MONSTER_TYPE_COLOR, MONSTER_TYPE_LABEL, ROOM_TYPE_ACCENT, RoomDetailCallbacks, RoomDetailState, RoomDirective } from './RoomDetailOverlay';

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

function drawInteriorChamber(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  slot: DungeonSlot,
): void {
  const isBroken = Boolean(slot.roomType && slot.hp <= 0);
  const backY = y + 14;
  const backH = Math.round(h * 0.42);
  const floorY = backY + backH - 4;

  g.fillStyle(0x050302, 0.99);
  g.fillRoundedRect(x, y, w, h, 14);
  g.fillStyle(isBroken ? 0x210b08 : 0x111b22, 0.90);
  g.fillRoundedRect(x + 8, y + 8, w - 16, h - 16, 12);
  g.lineStyle(1.5, isBroken ? 0xff5544 : accent, isBroken ? 0.64 : 0.45);
  g.strokeRoundedRect(x, y, w, h, 14);
  g.lineStyle(1, 0xffffff, 0.08);
  g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 11);

  g.fillStyle(0x17262d, 0.95);
  g.fillRoundedRect(x + 24, backY, w - 48, backH, 11);
  g.fillStyle(0x140d04, 0.84);
  g.fillRoundedRect(x + 34, backY + 13, w - 68, backH - 18, 9);
  g.lineStyle(1, accent, 0.12);
  for (let gy = backY + 24; gy < backY + backH - 7; gy += 13) {
    g.lineBetween(x + 42, gy, x + w - 42, gy);
  }
  g.lineStyle(1, 0xffffff, 0.06);
  for (let gx = x + 56; gx < x + w - 45; gx += 34) {
    g.lineBetween(gx, backY + 18, gx - 7, backY + backH - 8);
  }

  g.fillStyle(0x140d04, 0.96);
  g.beginPath();
  g.moveTo(x + 34, floorY);
  g.lineTo(x + w - 34, floorY);
  g.lineTo(x + w - 14, y + h - 18);
  g.lineTo(x + 14, y + h - 18);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.07);
  g.beginPath();
  g.moveTo(x + 46, floorY + 8);
  g.lineTo(x + w - 46, floorY + 8);
  g.lineTo(x + w - 34, y + h - 28);
  g.lineTo(x + 34, y + h - 28);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, accent, 0.15);
  g.lineBetween(x + 42, floorY + 2, x + 25, y + h - 22);
  g.lineBetween(x + w - 42, floorY + 2, x + w - 25, y + h - 22);
  g.lineStyle(1, 0xffffff, 0.06);
  for (let i = 0; i < 4; i++) {
    const yy = floorY + 18 + i * 20;
    g.lineBetween(x + 36 + i * 4, yy, x + w - 36 - i * 4, yy);
  }

  const laneY = backY + 38;
  g.fillStyle(0x020506, 0.72);
  g.fillRoundedRect(x + 18, laneY - 10, w - 36, 20, 9);
  g.lineStyle(1.2, accent, 0.22);
  g.lineBetween(x + 36, laneY, x + w - 36, laneY);
  for (let i = 0; i < 5; i++) {
    const px = x + 58 + i * Math.max(32, (w - 116) / 4);
    g.fillStyle(accent, 0.16 + (i % 2) * 0.07);
    g.fillTriangle(px + 6, laneY, px - 3, laneY - 5, px - 3, laneY + 5);
  }

  g.fillStyle(0x0e171b, 1);
  g.fillRoundedRect(x - 6, y + 38, 19, 48, 6);
  g.fillRoundedRect(x + w - 13, y + 38, 19, 48, 6);
  g.fillStyle(accent, 0.26);
  g.fillRoundedRect(x, y + 50, 6, 22, 3);
  g.fillRoundedRect(x + w - 6, y + 50, 6, 22, 3);
  c.add(scene.add.text(x + 7, y + 94, 'IN', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.74));
  c.add(scene.add.text(x + w - 7, y + 94, 'OUT', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.74));

  if (isBroken) {
    g.lineStyle(1.6, 0xff5544, 0.42);
    g.lineBetween(x + 36, y + 19, x + 76, y + 70);
    g.lineBetween(x + 76, y + 70, x + 57, y + h - 16);
    g.lineBetween(x + w - 55, y + 22, x + w - 92, y + 58);
    g.fillStyle(0xff5544, 0.08);
    g.fillRoundedRect(x + 9, y + 9, w - 18, h - 18, 10);
  }
}

function drawInteriorDungeonEditorDetails(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomLevel: number,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const ceilingY = y + 18;
  const floorY = y + h - 38;

  g.fillStyle(0x050302, 0.58);
  g.fillRoundedRect(x + 30, y + 13, w - 60, 11, 5);
  g.fillStyle(accent, 0.08 + glow * 0.05);
  g.fillRoundedRect(x + 44, y + 16, w - 88, 4, 2);
  g.lineStyle(1, accent, 0.18 + glow * 0.08);
  for (let i = 0; i < 4; i++) {
    const xx = x + 58 + i * ((w - 116) / 3);
    g.lineBetween(xx, ceilingY, xx - 10, ceilingY + 38);
  }

  g.fillStyle(0xffc875, 0.10 + glow * 0.08);
  g.fillCircle(x + 25, y + 55, 15);
  g.fillCircle(x + w - 25, y + 55, 15);
  g.fillStyle(0xffd978, 0.48);
  g.fillCircle(x + 25, y + 55, 3);
  g.fillCircle(x + w - 25, y + 55, 3);
  g.lineStyle(1, 0xffd978, 0.22);
  g.lineBetween(x + 25, y + 58, x + 25, y + 82);
  g.lineBetween(x + w - 25, y + 58, x + w - 25, y + 82);

  g.lineStyle(1, accent, 0.12 + glow * 0.08);
  for (let i = 0; i < 3; i++) {
    const yy = floorY + i * 12;
    g.lineBetween(x + 46 + i * 7, yy, x + w - 46 - i * 7, yy);
  }
  for (let i = 0; i < 4; i++) {
    const xx = x + 64 + i * ((w - 128) / 3);
    g.lineBetween(xx, floorY - 13, xx - 16, y + h - 20);
  }

  const pipCount = Phaser.Math.Clamp(roomLevel, 1, 5);
  for (let i = 0; i < pipCount; i++) {
    const yy = y + 106 + i * 12;
    g.fillStyle(accent, 0.20 + glow * 0.12);
    g.fillCircle(x + 22, yy, 2.4);
    g.fillCircle(x + w - 22, yy, 2.4);
  }
}

function drawInteriorEquipmentAura(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  equipmentPower: number,
): void {
  if (equipmentPower <= 0) return;

  g.lineStyle(1.4, 0xe8c468, 0.44);
  g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 18, 10);
  g.lineStyle(0.8, 0xffffff, 0.11);
  g.strokeRoundedRect(x + 17, y + 20, w - 34, h - 48, 8);
  g.fillStyle(0xe8c468, 0.09);
  g.fillRoundedRect(x + 22, y + 18, w - 44, 5, 3);
  g.fillCircle(x + 36, y + 24, 3);
  g.fillCircle(x + w - 36, y + 24, 3);

  g.fillStyle(0x100b03, 0.92);
  g.fillRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  g.lineStyle(1, 0xe8c468, 0.58);
  g.strokeRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  c.add(scene.add.text(x + w - 63, y + 20, `장비 강화 +${equipmentPower}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#fff0c2',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorRoomPlaque(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  accent: number,
  icon: string,
  roomName: string,
  roomLevel: number,
  readiness: number,
  danger: boolean,
): void {
  const plaqueW = 132;
  const plaqueH = 28;
  const plaqueX = x + w / 2 - plaqueW / 2;
  const plaqueY = y + 16;
  const readinessColor = readiness >= 70 ? 0x5fb854 : readiness >= 35 ? 0xe8c468 : 0xff7a5a;

  g.fillStyle(0x050302, 0.72);
  g.fillRoundedRect(plaqueX, plaqueY + 3, plaqueW, plaqueH, 8);
  g.fillStyle(danger ? 0x2a0906 : 0x07131d, 0.94);
  g.fillRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.lineStyle(1.2, danger ? 0xff5544 : accent, danger ? 0.66 : 0.46);
  g.strokeRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.fillStyle(accent, danger ? 0.12 : 0.08);
  g.fillRoundedRect(plaqueX + 8, plaqueY + 6, 22, plaqueH - 12, 6);
  g.fillStyle(readinessColor, 0.16);
  g.fillRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.lineStyle(1, readinessColor, 0.34);
  g.strokeRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(plaqueX + 36, plaqueY + 6, 40, 2, 1);

  c.add(scene.add.text(plaqueX + 19, plaqueY + plaqueH / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px' }).setOrigin(0.5));
  c.add(scene.add.text(plaqueX + 36, plaqueY + 12, `${roomName} Lv.${roomLevel}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    color: danger ? '#ffb7a8' : '#fff3cf',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(plaqueX + 103, plaqueY + 14, `${readiness}%`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: readiness >= 35 ? '#fff0c2' : '#ffb39a',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorRoomFixture(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomType: string | undefined,
  roomLevel: number,
  readiness: number,
): void {
  const cx = x + w / 2;
  const cy = y + h - 26;
  const glow = 0.12 + Math.min(0.16, readiness / 800);

  g.fillStyle(accent, glow * 0.6);
  g.fillCircle(cx, cy, 26 + Math.min(10, roomLevel * 2));
  g.lineStyle(1.2, accent, glow + 0.12);

  if (roomType === 'combat') {
    g.fillStyle(0x180605, 0.54);
    g.fillRoundedRect(cx - 62, y + 42, 22, 54, 5);
    g.fillRoundedRect(cx + 40, y + 42, 22, 54, 5);
    g.fillStyle(accent, 0.23 + glow * 0.16);
    g.fillTriangle(cx - 62, y + 42, cx - 40, y + 42, cx - 51, y + 66);
    g.fillTriangle(cx + 40, y + 42, cx + 62, y + 42, cx + 51, y + 66);
    g.strokeCircle(cx, cy, 23);
    g.strokeCircle(cx, cy, 13);
    g.fillStyle(accent, 0.24);
    g.fillRoundedRect(x + 34, y + h - 25, 36, 5, 3);
    g.fillRoundedRect(x + w - 70, y + h - 25, 36, 5, 3);
    g.lineStyle(1.2, accent, 0.34);
    g.lineBetween(x + 45, y + h - 29, x + 63, y + h - 49);
    g.lineBetween(x + w - 45, y + h - 29, x + w - 63, y + h - 49);
    g.lineStyle(1.2, 0xffd8a0, 0.22 + glow * 0.08);
    g.lineBetween(cx - 18, cy - 7, cx + 18, cy - 29);
    g.lineBetween(cx - 18, cy - 29, cx + 18, cy - 7);
    return;
  }

  if (roomType === 'trap') {
    g.fillStyle(0x160d03, 0.60);
    g.fillRoundedRect(cx - 72, y + 34, 144, 30, 8);
    g.lineStyle(1, accent, 0.22 + glow * 0.14);
    for (let i = 0; i < 5; i++) {
      const sx = cx - 60 + i * 30;
      g.lineBetween(sx, y + 39, sx + 18, y + 59);
    }
    g.fillStyle(accent, 0.22);
    for (let i = 0; i < 7; i++) {
      const px = x + 53 + i * ((w - 106) / 6);
      g.fillTriangle(px - 5, y + 48, px, y + 34 - (i % 2) * 4, px + 5, y + 48);
    }
    g.lineStyle(1.2, accent, 0.38);
    g.lineBetween(x + 44, y + 49, x + w - 44, y + 49);
    g.fillStyle(accent, 0.16 + glow * 0.10);
    g.fillRoundedRect(cx - 39, cy - 11, 78, 20, 8);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(cx - 26, cy - 2, cx + 26, cy - 2);
    g.strokeCircle(cx, cy, 16);
    return;
  }

  if (roomType === 'support') {
    g.fillStyle(0x06130c, 0.58);
    g.fillEllipse(cx, cy + 7, 92, 28);
    g.lineStyle(1, accent, 0.24 + glow * 0.10);
    for (let i = 0; i < 6; i++) {
      const vx = cx - 70 + i * 28;
      g.lineBetween(vx, y + 42, vx - 6 + (i % 2) * 12, y + 82);
      g.fillCircle(vx - 4 + (i % 2) * 8, y + 76, 2.6);
    }
    g.fillStyle(accent, 0.16);
    g.fillRoundedRect(cx - 38, cy - 13, 76, 22, 9);
    g.fillStyle(accent, 0.34);
    g.fillRoundedRect(cx - 5, cy - 20, 10, 36, 5);
    g.fillRoundedRect(cx - 18, cy - 7, 36, 10, 5);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(cx - 40, cy - 15, 80, 25, 9);
    return;
  }

  if (roomType === 'magic') {
    g.fillStyle(0x08051c, 0.60);
    g.fillCircle(cx, cy, 46);
    g.strokeCircle(cx, cy, 27);
    g.strokeCircle(cx, cy, 16);
    g.strokeCircle(cx, cy, 6);
    g.lineStyle(1, 0xffffff, 0.10 + glow * 0.08);
    g.lineBetween(cx, cy - 34, cx + 30, cy + 18);
    g.lineBetween(cx + 30, cy + 18, cx - 30, cy + 18);
    g.lineBetween(cx - 30, cy + 18, cx, cy - 34);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      g.fillStyle(accent, 0.35);
      g.fillCircle(cx + Math.cos(angle) * 27, cy + Math.sin(angle) * 27, 2.4);
      g.fillCircle(cx + Math.cos(angle + 0.25) * 39, cy + Math.sin(angle + 0.25) * 39, 1.8);
    }
    return;
  }

  g.lineStyle(1.1, accent, 0.26);
  g.strokeRoundedRect(cx - 38, cy - 18, 76, 34, 8);
  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(cx - 26, cy - 10, 52, 20, 6);
}

function drawMonsterPreviewPedestal(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050302, 0.48);
  g.fillEllipse(x, y + 24, 66, 18);
  g.fillStyle(0x030608, 0.88);
  g.fillRoundedRect(x - 27, y + 5, 54, 22, 9);
  g.fillStyle(filled ? accent : 0x050806, filled ? 0.20 : 0.84);
  g.fillEllipse(x, y + 16, 56, 18);
  g.lineStyle(1.2, accent, filled ? 0.54 : 0.30);
  g.strokeEllipse(x, y + 16, 56, 18);
  g.lineStyle(1, accent, filled ? 0.28 : 0.14);
  g.strokeEllipse(x, y + 11, 38, 9);
  g.lineStyle(1, 0xffffff, filled ? 0.12 : 0.06);
  g.lineBetween(x - 18, y + 16, x + 18, y + 16);
  g.lineBetween(x, y + 9, x, y + 24);
  if (!filled) {
    g.fillStyle(accent, 0.10);
    g.fillCircle(x, y, 25);
    g.lineStyle(1.1, accent, 0.34);
    g.strokeCircle(x, y, 22);
    g.lineStyle(1, 0xffffff, 0.08);
    g.strokeCircle(x, y, 13);
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 2 * i + Math.PI / 4;
      g.fillStyle(accent, 0.26);
      g.fillCircle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 1.8);
    }
  }
  g.fillStyle(accent, filled ? 0.16 : 0.07);
  g.fillRoundedRect(x - 22, y + 20, 44, 6, 3);
  g.fillCircle(x - 22, y + 15, 2.2);
  g.fillCircle(x + 22, y + 15, 2.2);
  g.fillStyle(0x050302, 0.90);
  g.fillRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.lineStyle(1, accent, filled ? 0.58 : 0.34);
  g.strokeRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.fillStyle(accent, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 30, y + 12, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 22, y + 8.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorEquipmentBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.94);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0xffcc66, 0.74);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y, equipment.icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px' }).setOrigin(0.5));
}

function drawInteriorEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.88);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0x9a6cd8, 0.52);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.10);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y - 0.5, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#e4d8ff',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawInteriorSlotActionChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  filled: boolean,
): void {
  const w = Math.max(filled ? 34 : 42, label.length * 10 + (filled ? 13 : 22));
  const h = filled ? 15 : 16;
  const g = scene.add.graphics();
  g.fillStyle(0x020806, filled ? 0.94 : 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.lineStyle(1, accent, filled ? 0.68 : 0.72);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.fillStyle(accent, filled ? 0.20 : 0.16);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 5);
  g.fillStyle(accent, filled ? 0.86 : 0.58);
  g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, 4, h - 8, 3);
  if (!filled) {
    const arrowX = x + w / 2 - 7;
    g.fillStyle(0xffffff, 0.24);
    g.beginPath();
    g.moveTo(arrowX - 2, y - 3);
    g.lineTo(arrowX + 3, y);
    g.lineTo(arrowX - 2, y + 3);
    g.closePath();
    g.fillPath();
  } else {
    g.fillStyle(accent, 0.72);
    g.fillCircle(x + w / 2 - 8, y, 2.2);
  }
  c.add(g);
  c.add(scene.add.text(filled ? x - 2 : x - 3, y + 0.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: filled ? '#eaffd8' : '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawPreviewTargetRing(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
): void {
  const g = scene.add.graphics();
  g.lineStyle(4, accent, 0.14);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(1.7, accent, 0.86);
  g.strokeRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 9);
  g.fillStyle(accent, 0.07);
  g.fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 8);
  const chipW = Math.min(w - 14, Math.max(48, label.length * 10 + 18));
  const chipY = y - h / 2 + 7;
  g.fillStyle(0x040908, 0.90);
  g.fillRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  g.lineStyle(1, accent, 0.72);
  g.strokeRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  c.add(g);

  const text = scene.add.text(x, chipY + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#f5ffe8',
    fontStyle: 'bold' }).setOrigin(0.5);
  c.add(text);

  if (prefersReducedMotion()) return;
  scene.tweens.add({
    targets: [g, text],
    alpha: { from: 0.72, to: 1 },
    duration: 560,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut' });
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

function addPreviewHitZone(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  onPress: () => void,
): void {
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onPress);
  c.add(zone);
}

function getPreviewSlotPosition(
  index: number,
  total: number,
  x: number,
  y: number,
  w: number,
  rowGap: number,
): { x: number; y: number } {
  const perRow = Math.min(3, Math.max(1, total));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const countInRow = Math.min(perRow, total - row * perRow);
  const gap = countInRow <= 1 ? 0 : Math.min(54, w / (countInRow - 1));
  const startX = x + w / 2 - gap * (countInRow - 1) / 2;
  return { x: startX + col * gap, y: y + row * rowGap };
}

function drawTrapPreviewSlot(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  icon: string,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  const edge = filled ? 0xffc44d : accent;
  g.fillStyle(0x050302, 0.46);
  g.fillEllipse(x, y + 13, 50, 13);
  g.fillStyle(filled ? 0x2d1b08 : 0x071016, filled ? 0.98 : 0.86);
  g.beginPath();
  g.moveTo(x - 20, y - 7);
  g.lineTo(x - 13, y - 14);
  g.lineTo(x + 13, y - 14);
  g.lineTo(x + 20, y - 7);
  g.lineTo(x + 20, y + 8);
  g.lineTo(x + 12, y + 14);
  g.lineTo(x - 12, y + 14);
  g.lineTo(x - 20, y + 8);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.2, edge, filled ? 0.86 : 0.36);
  g.strokePath();
  g.fillStyle(edge, filled ? 0.15 : 0.07);
  g.fillRoundedRect(x - 13, y - 8, 26, 5, 2);
  g.lineStyle(1, edge, filled ? 0.38 : 0.18);
  g.lineBetween(x - 13, y + 8, x + 13, y + 8);
  if (!filled) {
    g.fillStyle(edge, 0.11);
    g.fillCircle(x, y, 16);
    g.lineStyle(1, edge, 0.32);
    g.strokeCircle(x, y, 13);
  }
  g.fillStyle(0xffffff, filled ? 0.14 : 0.06);
  g.fillCircle(x - 14, y - 8, 1.5);
  g.fillCircle(x + 14, y - 8, 1.5);
  g.fillStyle(0x050302, 0.92);
  g.fillRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.lineStyle(1, edge, filled ? 0.62 : 0.36);
  g.strokeRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.fillStyle(edge, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 25, y - 9, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 17, y - 12.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x, filled ? y : y - 0.5, filled ? icon : '+', {
    fontFamily: 'sans-serif',
    fontSize: filled ? '16px' : '18px',
    color: filled ? '#ffe080' : '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}

function drawMonsterAnchor(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x061016, 0.88);
  g.fillCircle(x, y, 15);
  g.fillStyle(accent, 0.07);
  g.fillCircle(x, y, 22);
  g.lineStyle(1.2, accent, 0.40);
  g.strokeCircle(x, y, 15);
  g.lineStyle(1, accent, 0.25);
  g.strokeCircle(x, y, 8);
  g.lineBetween(x - 10, y, x + 10, y);
  g.lineBetween(x, y - 10, x, y + 10);
  g.fillStyle(accent, 0.22);
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 2 * i + Math.PI / 4;
    g.fillCircle(x + Math.cos(angle) * 17, y + Math.sin(angle) * 17, 1.8);
  }
  c.add(g);
  c.add(scene.add.text(x, y - 1, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    color: '#fff4ce',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function fitSlotLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function getCompactTrapEffectLabel(desc: string): string {
  if (desc.includes('이동속도')) return '감속 2초';
  if (desc.includes('피해/초')) return '독 피해';
  if (desc.includes('기절')) return '기절 1초';
  if (desc.includes('피해')) return '진입 피해';
  return fitSlotLabel(desc, 5);
}

export function formatCompactTrapCost(cost: number, unlockLv: number, compact: boolean): string {
  return compact ? `${cost}g Lv${unlockLv}` : `${cost}g · Lv.${unlockLv}`;
}

export function getMonsterRarityMeta(monster: MonsterDef): typeof MONSTER_RARITY_META[keyof typeof MONSTER_RARITY_META] {
  return MONSTER_RARITY_META[monster.rarityTier ?? 'C'] ?? MONSTER_RARITY_META.C;
}

export function drawCollectorCardSkin(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  rarity: ReturnType<typeof getMonsterRarityMeta>,
  owned: boolean,
): void {
  const g = scene.add.graphics();
  g.fillStyle(rarity.color, owned ? 0.12 : 0.06);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.lineStyle(1, rarity.color, owned ? 0.44 : 0.18);
  g.lineBetween(x + 48, y + 8, x + w - 12, y + 8);
  g.fillStyle(0xffffff, owned ? 0.24 : 0.08);
  g.fillCircle(x + w - 19, y + 27, 1.4);
  g.fillCircle(x + w - 30, y + 36, 1.1);
  g.fillCircle(x + 12, y + h - 13, 1.2);
  g.fillStyle(rarity.color, owned ? 0.28 : 0.12);
  g.fillCircle(x + 28, y + 35, 20);
  g.fillStyle(0x050806, 0.62);
  g.fillRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  g.lineStyle(1, rarity.color, owned ? 0.62 : 0.30);
  g.strokeRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  c.add(g);
  c.add(scene.add.text(x + w - 30.5, y + 15.5, rarity.label, {
    fontFamily: 'sans-serif',
    fontSize: '6px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 10, y + h - 14, rarity.stars, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
}

export function drawCompactLoadoutSlotFrame(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.24);
  g.fillRoundedRect(x + 2, y + 3, w, h, 8);
  g.fillStyle(filled ? 0x130c06 : 0x060909, filled ? 0.95 : 0.82);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(filled ? 0x2a1608 : 0x091210, filled ? 0.52 : 0.54);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.fillStyle(0x050806, 0.82);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(1.1, accent, filled ? 0.52 : 0.25);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, 0xffffff, filled ? 0.08 : 0.04);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);
  g.fillStyle(accent, filled ? 0.16 : 0.06);
  g.fillRoundedRect(x + 5, y + 5, w - 10, 4, 3);
  g.fillStyle(0x050806, 0.72);
  g.fillRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.lineStyle(1, accent, filled ? 0.48 : 0.24);
  g.strokeRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.fillStyle(accent, filled ? 0.10 : 0.04);
  g.fillRoundedRect(x + 2, y + 12, 3, h - 24, 2);
  g.fillStyle(accent, filled ? 0.42 : 0.18);
  g.fillCircle(x + w - 9, y + 13, 2.3);
  g.fillCircle(x + w - 9, y + h - 13, 2.3);
  g.lineStyle(1, accent, filled ? 0.20 : 0.10);
  g.lineBetween(x + 45, y + 18, x + w - 12, y + 18);
  g.lineBetween(x + 45, y + h - 30, x + w - 12, y + h - 30);
  c.add(g);
  c.add(scene.add.text(x + 20, y + 18, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: filled ? '#ffe080' : '#8a6a4a',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactAttributeChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
): void {
  const chipW = Math.max(30, Math.min(44, label.length * 11 + 12));
  const chip = scene.add.graphics();
  chip.fillStyle(0x050806, 0.88);
  chip.fillRoundedRect(x, y, chipW, 13, 5);
  chip.lineStyle(1, accent, 0.48);
  chip.strokeRoundedRect(x, y, chipW, 13, 5);
  chip.fillStyle(accent, 0.16);
  chip.fillRoundedRect(x + 2, y + 2, 4, 9, 3);
  c.add(chip);
  c.add(scene.add.text(x + chipW / 2 + 2, y + 6.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#fff0c2',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge | null,
  accent: number,
): void {
  const socket = scene.add.graphics();
  const filled = Boolean(equipment);
  socket.fillStyle(filled ? 0x332005 : 0x070b0a, filled ? 0.96 : 0.84);
  socket.fillCircle(x, y, 8);
  socket.lineStyle(1, filled ? 0xe8c468 : accent, filled ? 0.68 : 0.30);
  socket.strokeCircle(x, y, 8);
  socket.fillStyle(filled ? 0xe8c468 : accent, filled ? 0.16 : 0.06);
  socket.fillCircle(x, y, 5);
  c.add(socket);
  if (equipment) {
    c.add(scene.add.text(x, y, equipment.icon, {
      fontFamily: 'sans-serif',
      fontSize: '10px' }).setOrigin(0.5));
    return;
  }
  c.add(scene.add.text(x, y, '◇', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactEmptySlotGlyph(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  icon: string,
): void {
  const glyph = scene.add.graphics();
  glyph.fillStyle(0x050806, 0.92);
  glyph.fillRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.lineStyle(1.1, accent, 0.34);
  glyph.strokeRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.fillStyle(accent, 0.08);
  glyph.fillRoundedRect(x - 11, y - 11, 22, 22, 6);
  glyph.lineStyle(1, accent, 0.20);
  glyph.lineBetween(x - 9, y, x + 9, y);
  glyph.lineBetween(x, y - 9, x, y + 9);
  glyph.lineStyle(1, accent, 0.12);
  glyph.strokeCircle(x, y, 14);
  c.add(glyph);
  c.add(scene.add.text(x, y, icon, {
    fontFamily: 'sans-serif',
    fontSize: '17px',
    color: '#806040' }).setOrigin(0.5).setAlpha(0.60));
}

export function drawCompactGrowthMeter(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  xp: number,
  accent: number,
): void {
  const ready = xp >= 100;
  const progress = ready ? 1 : Phaser.Math.Clamp((xp % 100) / 100, 0, 1);
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.82);
  g.fillRoundedRect(x, y, w, 5, 3);
  g.lineStyle(1, accent, 0.22);
  g.strokeRoundedRect(x, y, w, 5, 3);
  g.fillStyle(ready ? 0xe8c468 : accent, ready ? 0.88 : 0.72);
  g.fillRoundedRect(x + 1, y + 1, Math.max(4, (w - 2) * progress), 3, 2);
  g.fillStyle(ready ? 0xe8c468 : 0xffffff, ready ? 0.42 : 0.12);
  g.fillCircle(x + w - 4, y + 2.5, 2);
  c.add(g);
  c.add(scene.add.text(x + w, y - 5, ready ? 'UP' : `${Math.round(progress * 100)}%`, {
    fontFamily: 'monospace',
    fontSize: '6px',
    color: ready ? '#ffdf6e' : '#8ab3aa',
    fontStyle: 'bold' }).setOrigin(1, 0.5));
}

export function drawCompactTrapEffectTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  desc: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.84);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.30);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.18);
  g.fillRoundedRect(x + 3, y - 3, 4, 8, 3);
  c.add(g);
  c.add(scene.add.text(x + 10, y + 1, fitSlotLabel(getCompactTrapEffectLabel(desc), w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffe3a0',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function drawCompactEmptyTrapPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.70);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.20);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.08);
  for (let sx = x + 4; sx < x + w - 5; sx += 8) {
    g.fillRoundedRect(sx, y - 1, 4, 2, 1);
  }
  c.add(g);
  c.add(scene.add.text(x + 9, y + 1, w < 58 ? '차단' : '경로 차단', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

function drawCompactMonsterRoleTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.26);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x + 7, y + 1, 3);
  c.add(g);
  c.add(scene.add.text(x + 13, y + 1, fitSlotLabel(label, w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffe1c2',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

function getCompactMonsterRoleLabel(recommendation: MonsterLoadoutRecommendation): string {
  const [primaryReason] = recommendation.reason.split('·').map(part => part.trim());
  return primaryReason || '수호 배치';
}

export function drawCompactEmptyMonsterPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.70);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.20);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.08);
  g.fillCircle(x + 7, y + 1, 3);
  g.fillCircle(x + 17, y + 1, 2.4);
  g.fillCircle(x + 27, y + 1, 1.8);
  c.add(g);
  c.add(scene.add.text(x + 36, y + 1, w < 58 ? '대기' : '대기 라인', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function drawCompactRoomTypeStateTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  isActive: boolean,
  isRecommended: boolean,
): void {
  const tagW = Math.max(32, Math.min(42, 20 + label.length * 10));
  const g = scene.add.graphics();
  g.fillStyle(isActive || isRecommended ? accent : 0x050806, isActive ? 0.92 : isRecommended ? 0.84 : 0.76);
  g.fillRoundedRect(x, y, tagW, 16, 6);
  g.lineStyle(1, accent, isActive || isRecommended ? 0.38 : 0.28);
  g.strokeRoundedRect(x, y, tagW, 16, 6);
  if (!isActive && !isRecommended) {
    g.fillStyle(accent, 0.16);
    g.fillCircle(x + 8, y + 8, 3);
  }
  c.add(g);
  c.add(scene.add.text(x + tagW / 2, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: isActive || isRecommended ? '#0e0900' : '#ffe1b0',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addRecommendedMonsterSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: MonsterLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const recommendedDef = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS];
  const rarity = recommendedDef ? getMonsterRarityMeta(recommendedDef) : MONSTER_RARITY_META.C;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 0.10);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(1.3, rarity.color, 0.72);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 0.88);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(x + 13, y + 11, 1.4);
  g.fillCircle(x + w - 16, y + h - 13, 1.2);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#0e0900',
    fontStyle: 'bold' }).setOrigin(0.5));
  addMonsterPortrait(scene, c, x + 27, y + 35, recommendation.monsterId, {
    size: 36,
    frameColor: rarity.color,
    glowColor: rarity.color,
    bgColor: 0x070908,
    equippedSkins: {} });
  c.add(scene.add.text(x + 8, y + h - 12, rarity.stars, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  const recommendedType = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS]?.type;
  if (recommendedType) {
    addCompactAttributeChip(
      scene,
      c,
      x + 52,
      y + 20,
      MONSTER_TYPE_LABEL[recommendedType] ?? recommendedType,
      MONSTER_TYPE_COLOR[recommendedType] ?? recommendation.accent,
    );
  }
  c.add(scene.add.text(x + 52, y + 36, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: '#ffe1c2',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  drawCompactMonsterRoleTag(
    scene,
    c,
    x + 52,
    y + 48,
    Math.max(38, w - 63),
    getCompactMonsterRoleLabel(recommendation),
    recommendation.accent,
  );
  c.add(scene.add.text(x + 52, y + 61, `ATK ${recommendation.attack}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#c8921a',
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 27, btnW, compact ? '추천' : '추천 배치', recommendation.accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 27, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

export function addRecommendedTrapSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: TrapLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const trapDef = TRAP_DEFS.find(trap => trap.id === recommendation.trapId);
  const effectDesc = trapDef?.desc ?? recommendation.reason;
  const unlockLv = trapDef?.unlockLv ?? 0;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 9, y + 27, 38, h - 37, 8);
  g.lineStyle(1.3, accent, 0.72);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 0.88);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0x050806, 0.94);
  g.fillCircle(x + 27, y + 33, 18);
  g.lineStyle(1.2, accent, 0.62);
  g.strokeCircle(x + 27, y + 33, 18);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x + 27, y + 33, 12);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#0e0900',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x + 27, y + 33, recommendation.icon, {
    fontFamily: 'sans-serif',
    fontSize: '19px' }).setOrigin(0.5));
  c.add(scene.add.text(x + 52, y + 29, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: '#ffe3a0',
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  drawCompactTrapEffectTag(
    scene,
    c,
    x + 52,
    y + 43,
    Math.max(38, w - 63),
    effectDesc,
    accent,
  );
  c.add(scene.add.text(x + 52, y + 58, formatCompactTrapCost(recommendation.cost, unlockLv, compact), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#c8921a',
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 25, btnW, compact ? '추천' : '추천 설치', accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 25, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

export function addCompactLoadoutButton(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
  onPress: () => void,
  primary = false,
): void {
  const button = addPrimaryActionButton(scene, {
    x,
    y,
    w,
    h: 22,
    label,
    fontSize: '10px',
    fillColor: primary ? 0x123526 : 0x160e06,
    hoverFillColor: primary ? 0x18513a : 0x241606,
    borderColor: accent,
    hoverBorderColor: primary ? 0x88ffcc : 0xffdf6e,
    textColor: primary ? '#d8fff0' : '#e8d090',
    onPress });
  c.add([button.bg, button.text, button.zone]);
}


