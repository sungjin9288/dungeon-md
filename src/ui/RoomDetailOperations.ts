// ─── Room Detail Operations ──────────────────────────────────────────────────
// 운영 요약 패널 + 방 지시(directive) 산출/표시. Shared·Feedback에 의존.

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import { getDungeonRoomCount } from '../data/dungeonPlan';
import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState } from '../data/wisdom';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { type RoomOperationalMetrics } from '../data/dungeonMetrics';
import { getRoomDesignRecommendation } from '../data/roomDesignRecommendations';
import { getDungeonActionQueue } from '../data/roomActionRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import {
  getRoomRepairCost } from '../data/roomSlotTransactions';
import {
  getReadinessDirectiveCopy,
  type ReadinessDirectiveKind,
  type ReadinessDirectiveSeverity } from '../data/readinessDirectives';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  
  
  
  
  
  navigateToFocusedForge, navigateToFocusedMonster } from './RoomDetailInterior';

import {
  ROOM_DETAIL_CLOSE_MS, RoomDetailNextActionEntry, RoomDirective, RoomDirectiveTarget, findFirstEmptySlot, RoomDetailState, RoomDetailCallbacks, navigateFromRoomDetail } from './RoomDetailShared';
import {
  drawSectionTargetPulse, applyRoomRepairAction, applyRecommendedRoomDesign, applyRecommendedMonsterPlacement, applyRecommendedTrapPlacement } from './RoomDetailFeedback';

// ─── Operations summary ──────────────────────────────────────────────────────

export function buildRoomOperationsPanel(
  scene: Phaser.Scene,
  state: RoomDetailState,
  _theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  _nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number,
  secW: number,
  secY: number,
  highlightTarget = false,
): number {
  const panelH = 98;
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = slot.monsterIds.filter(monsterId => (
    typeof monsterId === 'string'
    && gs.ownedMonsters.some(monster => monster.id === monsterId)
  )).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
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
    radius: 4,
    fillColor: DUNGEON_UI.SOOT,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 0.9,
    borderWidth: 1,
    accentColor: DUNGEON_UI.JADE,
    accentAlpha: 0.7,
    glowColor: DUNGEON_UI.JADE,
    glowOpacity: 0.02,
    shadowOpacity: 0.26,
    shadowOffsetY: 3 });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, panelH, DUNGEON_UI.JADE, '전력 보강');
  }

  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.JADE, 0.1);
  g.fillRect(secX + 8, secY + 8, 4, panelH - 16);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.38);
  g.lineBetween(secX + 14, secY + 34, secX + secW - 14, secY + 34);
  c.add(g);

  c.add(scene.add.text(secX + 18, secY + 20, '정비 도구', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 18, secY + 20, `${typeDef?.name ?? '미설계'} · ${status} · 수호 ${monsterCount} · 함정 ${trapCount}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: slot.roomType && slot.hp <= 0 ? DUNGEON_UI_CSS.EMBER : slot.roomType ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold' }).setOrigin(1, 0.5));

  const shortcutY = secY + 43;
  const shortcutW = (secW - 42) / 2;
  const shortcutGap = 8;
  const firstMonsterId = slot.monsterIds.find((monsterId): monsterId is string => (
    typeof monsterId === 'string'
    && gs.ownedMonsters.some(monster => monster.id === monsterId)
  ));
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
      h: 44,
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

  addShortcut(secX + 14, '수호자 성장', DUNGEON_UI.JADE, DUNGEON_UI.EDGE, '#07100c', () => {
    if (firstMonsterId) {
      navigateToFocusedMonster(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
  });
  addShortcut(secX + 14 + shortcutW + shortcutGap, '장비 강화', DUNGEON_UI.BRASS, DUNGEON_UI.BRASS_BRIGHT, '#120d06', () => {
    if (firstMonsterId) {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
  });
  return panelH;
}

// ─── Directive fill/text helpers ─────────────────────────────────────────────

function roomDirectiveFill(severity: ReadinessDirectiveSeverity): number {
  if (severity === 'danger') return 0x22100c;
  if (severity === 'warning') return 0x0b1b14;
  return 0x071812;
}

function roomDirectiveTextColor(severity: ReadinessDirectiveSeverity): string {
  if (severity === 'danger') return '#ffb09a';
  if (severity === 'warning') return '#c8ffe0';
  return '#b7ffe8';
}

// ─── Target helper ───────────────────────────────────────────────────────────

function roomDirectiveTarget(
  kind: 'room-design' | 'room-repair' | 'assign-monster' | 'install-trap' | 'grow-monster' | 'forge-equipment' | 'power-risk' | 'battle-ready',
): RoomDirectiveTarget {
  switch (kind) {
    case 'room-design':    return 'type';
    case 'room-repair':    return 'repair';
    case 'assign-monster': return 'monster';
    case 'install-trap':   return 'trap';
    case 'grow-monster':   return 'growth';
    case 'forge-equipment':return 'growth';
    case 'power-risk':     return 'growth';
    case 'battle-ready':   return 'none';
  }
}

// ─── Directive builder ───────────────────────────────────────────────────────

function buildRoomDirective(
  kind: ReadinessDirectiveKind,
  ctx: Parameters<typeof getReadinessDirectiveCopy>[1],
  onPress?: () => void,
  overrides?: { body?: string; ctaLabel?: string; accent?: number; enabled?: boolean },
): RoomDirective {
  const copy = getReadinessDirectiveCopy(kind, ctx);
  const severity = copy.severity;
  return {
    title: copy.title,
    body: overrides?.body ?? copy.body,
    ctaLabel: overrides?.ctaLabel ?? copy.ctaLabel,
    target: roomDirectiveTarget(kind),
    accent: overrides?.accent ?? copy.accent,
    fillColor: roomDirectiveFill(severity),
    textColor: roomDirectiveTextColor(severity),
    enabled: overrides?.enabled,
    onPress,
  };
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
  const gs = cb.getGameState();
  const isValidOwnedMonster = (monsterId: unknown): monsterId is string => (
    typeof monsterId === 'string'
    && monsterId.length > 0
    && resolveOwnedMonsterProfile(monsterId) !== null
    && gs.ownedMonsters.some(monster => monster.id === monsterId)
  );
  const firstMonsterSlot = Array.from({ length: cap.monsters })
    .findIndex((_, index) => !isValidOwnedMonster(slot.monsterIds[index]));
  const firstTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const recommendation = !slot.roomType ? getRoomDesignRecommendation(gs, slotIdx) : null;
  const roomLabel = `방 #${slotIdx + 1}`;

  // 1. Broken room — room-repair
  if (slot.roomType && slot.hp <= 0) {
    const repairCost = getRoomRepairCost(slot);
    const canRepair = gs.homeGold >= repairCost;
    const copy = getReadinessDirectiveCopy('room-repair', { roomLabel });
    return {
      title: copy.title,
      body: `${copy.body} · 수리 ${repairCost}g`,
      ctaLabel: canRepair ? '즉시 수리' : '골드 부족',
      target: 'repair',
      accent: copy.accent,
      fillColor: roomDirectiveFill(copy.severity),
      textColor: roomDirectiveTextColor(copy.severity),
      enabled: canRepair,
      onPress: () => applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot),
    };
  }

  // 2. No room type set — room-design
  if (!slot.roomType) {
    return buildRoomDirective(
      'room-design',
      { roomLabel },
      recommendation
        ? () => applyRecommendedRoomDesign(scene, state, theme, cb, slotIdx, slot, recommendation)
        : undefined,
      recommendation
        ? { body: recommendation.reason, ctaLabel: '추천 적용' }
        : { ctaLabel: '아래에서 설계' },
    );
  }

  // 3. Empty monster slot — assign-monster
  if (firstMonsterSlot >= 0) {
    const monsterRecommendation = getMonsterLoadoutRecommendation(gs, slotIdx);
    if (monsterRecommendation) {
      return buildRoomDirective(
        'assign-monster',
        { roomLabel },
        () => applyRecommendedMonsterPlacement(
          scene, state, theme, cb, slotIdx, slot, firstMonsterSlot, monsterRecommendation,
        ),
        {
          body: `${monsterRecommendation.name} · ${monsterRecommendation.reason}`,
          ctaLabel: '추천 배치',
          accent: monsterRecommendation.accent,
        },
      );
    }
    return buildRoomDirective(
      'assign-monster',
      { roomLabel, emptySlots: cap.monsters - monsterCount },
      () => showMonsterPicker(scene, state, theme, cb, nav, slotIdx, firstMonsterSlot),
      { ctaLabel: '즉시 배치' },
    );
  }

  // 4. Open trap slot — install-trap
  if (cap.traps > 0 && firstTrapSlot >= 0) {
    const trapRecommendation = getTrapLoadoutRecommendation(gs, slotIdx);
    if (trapRecommendation) {
      return buildRoomDirective(
        'install-trap',
        { roomLabel },
        () => applyRecommendedTrapPlacement(
          scene, state, theme, cb, slotIdx, slot, firstTrapSlot, trapRecommendation,
        ),
        {
          body: `${trapRecommendation.name} · ${trapRecommendation.reason}`,
          ctaLabel: '추천 설치',
          accent: trapRecommendation.accent,
        },
      );
    }
    return buildRoomDirective(
      'install-trap',
      { roomLabel },
      () => showTrapPicker(scene, state, theme, cb, nav, slotIdx, firstTrapSlot),
      {
        body: `침입 경로에 빈 함정 슬롯 ${cap.traps - trapCount}개가 있습니다.`,
        ctaLabel: '즉시 설치',
      },
    );
  }

  const assignedMonsterIds = slot.monsterIds.filter((monsterId): monsterId is string =>
    isValidOwnedMonster(monsterId),
  );

  // 5. Monster missing equipment — forge-equipment
  const firstUnequippedMonsterId = assignedMonsterIds.find(monsterId =>
    !gs.ownedMonsters.find(monster => monster.id === monsterId)?.equipment,
  );
  if (firstUnequippedMonsterId) {
    const focusMonsterDef = resolveOwnedMonsterProfile(firstUnequippedMonsterId);
    return buildRoomDirective(
      'forge-equipment',
      { roomLabel, readiness: roomMetrics.readiness },
      () => navigateToFocusedForge(scene, state, cb, firstUnequippedMonsterId, slotIdx),
      {
        body: `${focusMonsterDef?.name ?? '수호자'} 장비가 비어 있습니다. 제작소에서 바로 보강하세요.`,
        ctaLabel: '장비 강화',
      },
    );
  }

  // 6. Monster underleveled — grow-monster
  const targetLevel = Math.max(2, gs.dmLevel - 1);
  const underleveledMonster = assignedMonsterIds
    .map(monsterId => gs.ownedMonsters.find(monster => monster.id === monsterId))
    .find(monster => monster && monster.level < targetLevel);
  if (underleveledMonster) {
    const focusMonsterDef = resolveOwnedMonsterProfile(underleveledMonster.id);
    return buildRoomDirective(
      'grow-monster',
      { skillReady: 1 },
      () => navigateToFocusedMonster(scene, state, cb, underleveledMonster.id, slotIdx),
      {
        body: `${focusMonsterDef?.name ?? '수호자'} Lv.${underleveledMonster.level} · 목표 Lv.${targetLevel}`,
        ctaLabel: '수호자 성장',
      },
    );
  }

  // 7. Low readiness — power-risk (or grow-monster if there is a focus monster)
  if (roomMetrics.readiness < 78) {
    const focusMonsterId = slot.monsterIds.find(isValidOwnedMonster);
    const focusMonsterDef = resolveOwnedMonsterProfile(focusMonsterId);
    return buildRoomDirective(
      'power-risk',
      { roomLabel, readiness: roomMetrics.readiness },
      () => {
        if (focusMonsterId) {
          navigateToFocusedMonster(scene, state, cb, focusMonsterId, slotIdx);
          return;
        }
        navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
      },
      focusMonsterDef
        ? {
            body: `${focusMonsterDef.name} 성장/장비 보강으로 방 준비도를 올리세요.`,
            ctaLabel: '수호자 성장',
          }
        : undefined,
    );
  }

  // 8. This room is ready — show next queued action or battle-ready
  const nextActionEntry = getNextRoomDetailAction(gs, slotIdx);
  if (nextActionEntry && cb.openRoomSlot) {
    const { action: nextAction, rank: nextActionRank } = nextActionEntry;
    return buildRoomDirective(
      'battle-ready',
      {},
      () => openQueuedRoomFromDetail(scene, state, cb, nextAction.slotIdx),
      {
        body: `${nextActionRank}순 작업: 방 #${nextAction.slotIdx + 1} ${nextAction.label} · ${nextAction.body}`,
        ctaLabel: `방 #${nextAction.slotIdx + 1} ${nextAction.label}`,
        accent: nextAction.accent,
      },
    );
  }

  if (cb.startBattle) {
    return buildRoomDirective(
      'battle-ready',
      {},
      () => startBattleFromRoomDetail(scene, state, cb),
      { body: '모든 작업 큐가 비었습니다. 다음 침공 방어로 진행하세요.', ctaLabel: '침공 준비' },
    );
  }

  return buildRoomDirective('battle-ready', {});
}

export function getNextRoomDetailAction(
  state: GameState,
  currentSlotIdx: number,
): RoomDetailNextActionEntry | null {
  const unlockedSlots = getDungeonRoomCount(state);
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
  g.fillStyle(0xffffff, 0.12);
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
