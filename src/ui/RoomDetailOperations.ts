// ─── Room Detail Operations ──────────────────────────────────────────────────
// 운영 요약 패널 + 방 지시(directive) 산출/표시. Shared·Feedback에 의존.

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  getRoomSlotCapacity, getUnlockedSlots, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState } from '../data/wisdom';
import { MONSTER_DEFS } from '../data/monsters';
import {
  calculateRoomLoadoutStatus,
  calculateRoomMetrics,
  type RoomOperationalMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation } from '../data/roomDesignRecommendations';
import { getDungeonActionQueue } from '../data/roomActionRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import {
  getRoomRepairCost } from '../data/roomSlotTransactions';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  
  
  
  
  
  navigateToFocusedForge, navigateToFocusedMonster } from './RoomDetailInterior';

import {
  ROOM_DETAIL_CLOSE_MS, ROOM_TYPE_ACCENT, RoomDetailNextActionEntry, RoomDirective, findFirstEmptySlot, RoomDetailState, RoomDetailCallbacks, navigateFromRoomDetail } from './RoomDetailShared';
import {
  drawSectionTargetPulse, applyRoomRepairAction, applyRecommendedRoomDesign, applyRecommendedMonsterPlacement, applyRecommendedTrapPlacement } from './RoomDetailFeedback';

// ─── Operations summary ──────────────────────────────────────────────────────

export function buildRoomOperationsPanel(
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
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GREEN,
    accentAlpha: 1,
    glowColor: CASUAL.GREEN,
    glowOpacity: 0.04,
    shadowOpacity: 0.26,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, panelH, CASUAL.GREEN, '전력 보강');
  }

  const g = scene.add.graphics();
  g.fillStyle(CASUAL.GREEN, 0.1);
  g.fillRoundedRect(secX + 10, secY + 10, secW - 20, 28, 7);
  g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
  g.lineBetween(secX + 14, secY + 58, secX + secW - 14, secY + 58);
  c.add(g);

  c.add(scene.add.text(secX + 18, secY + 24, '운영 현황', {
    fontFamily: 'sans-serif',
    fontSize: '14px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 18, secY + 24, `${typeDef?.name ?? '미설계'} · ${status}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: slot.roomType && slot.hp <= 0 ? CASUAL_CSS.RED : slot.roomType ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  const readinessW = secW - 156;
  const readinessY = secY + 48;
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(secX + 14, readinessY, readinessW, 8, 4);
  g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.6);
  g.strokeRoundedRect(secX + 14, readinessY, readinessW, 8, 4);
  g.fillStyle(roomMetrics.readiness >= 70 ? CASUAL.GREEN : roomMetrics.readiness >= 35 ? CASUAL.GOLD : CASUAL.RED, 1);
  g.fillRoundedRect(secX + 14, readinessY, Math.max(5, readinessW * roomMetrics.readiness / 100), 8, 4);
  c.add(scene.add.text(secX + 14, readinessY - 10, `준비도 ${roomMetrics.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
    x: secX + secW - 142,
    y: secY + 39,
    w: 128,
    h: 18,
    accent: slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? CASUAL.GREEN : CASUAL.GREEN,
    showLabels: true });

  c.add(scene.add.text(secX + 18, secY + 73, '다음 지시', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
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
      hoverBorderColor: borderColor,
      textColor,
      onPress });
    c.add([button.bg, button.text, button.zone]);
  };

  addShortcut(secX + 14, canResumePreBattle ? '👹 성장' : '👹 성장/레벨업', CASUAL.GREEN, CASUAL.GREEN_DK, '#ffffff', () => {
    if (firstMonsterId) {
      navigateToFocusedMonster(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
  });
  addShortcut(secX + 14 + shortcutW + shortcutGap, canResumePreBattle ? '⚒ 장비' : '⚒ 장비 강화', CASUAL.PURPLE, CASUAL.PURPLE_DK, '#ffffff', () => {
    if (firstMonsterId) {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
  });
  if (canResumePreBattle) {
    addShortcut(secX + 14 + (shortcutW + shortcutGap) * 2, '⚔ 침공 복귀', CASUAL.BLUE, CASUAL.BLUE_DK, '#ffffff', () => {
      cb.requestClose?.();
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    });
  }

  return panelH;
}

export function getRoomDirective(
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

export function getNextRoomDetailAction(
  state: GameState,
  currentSlotIdx: number,
): RoomDetailNextActionEntry | null {
  const unlockedSlots = getUnlockedSlots(state.dmLevel);
  const queue = getDungeonActionQueue(state, unlockedSlots);
  const index = queue.findIndex(action => action.slotIdx !== currentSlotIdx);
  if (index < 0) return null;
  return { action: queue[index], rank: index + 1 };
}

export function openQueuedRoomFromDetail(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  cb: RoomDetailCallbacks,
  slotIdx: number,
): void {
  cb.requestClose?.();
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.openRoomSlot?.(slotIdx);
  });
}

export function startBattleFromRoomDetail(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  cb.requestClose?.();
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.startBattle?.();
  });
}

export function drawRoomDirective(
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
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, directive.accent, 0.85);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(directive.accent, 1);
  g.fillRoundedRect(x + 5, y + 5, 4, h - 10, 3);
  g.fillStyle(0xffffff, 0.45);
  g.fillRoundedRect(x + 13, y + 7, w - ctaW - 30, 4, 2);
  c.add(g);

  c.add(scene.add.text(x + 18, y + 14, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 18, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: w - ctaW - 42, useAdvancedWrap: true } }).setOrigin(0, 0.5));

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 8,
      y: y + 8,
      w: ctaW,
      h: 32,
      label: directive.ctaLabel,
      fontSize: '10px',
      fillColor: directive.accent,
      hoverFillColor: directive.accent,
      borderColor: directive.accent,
      hoverBorderColor: directive.accent,
      textColor: '#ffffff',
      onPress: directive.onPress });
    c.add([button.bg, button.text, button.zone]);
    return;
  }

  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  g.lineStyle(2, directive.accent, 0.7);
  g.strokeRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  c.add(scene.add.text(x + w - ctaW / 2 - 8, y + 24, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0.5));
}
