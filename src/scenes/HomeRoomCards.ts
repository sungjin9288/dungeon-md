/**
 * HomeRoomCards — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { COLORS } from '../constants/colors';
import { getUnlockedSlots, type DungeonSlot } from '../data/wisdom';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { logger } from '../utils/logger';
import {
  type RoomSlotContext,
  drawBattleSlot as _drawBattleSlot,
  SLOT_W, SLOT_H,
} from '../ui/RoomSlotRenderer';
import {
  type SynergyDrawContext,
  drawSynergyConnectors,
  drawSynergySummary,
} from '../ui/DungeonSynergy';
import { buildDungeonBoardLayout } from '../ui/DungeonBoardLayout';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── Layout constants (must match DungeonHomeScene.ts) ─────────────────────

const TOP_H            = 64;
const BOT_H            = 64;
const CANVAS_HEIGHT_LOCAL = 844;
const BOT_Y            = CANVAS_HEIGHT_LOCAL - BOT_H;

const GRID_COLS_HOME   = 3;
const GRID_ROWS_HOME   = 3;

const SLOT_PAD_X       = Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1));
const SLOT_PAD_Y       = 8;
const QUEST_BANNER_H   = 22;
const GRID_START_Y     = TOP_H + QUEST_BANNER_H + 10;

// ─── rebuildDungeonSlots ─────────────────────────────────────────────────────

export function rebuildDungeonSlots(scene: DungeonHomeScene): void {
  if (scene.dungeonContainer) scene.dungeonContainer.destroy();
  const c = scene.add.container(0, 0).setDepth(3);
  scene.dungeonContainer = c;

  const unlockedCount = getUnlockedSlots(scene.gs.dmLevel);
  logger.debug(`[SLOTS] DM Lv.${scene.gs.dmLevel}: ${unlockedCount} slots unlocked`);

  // Phase D: regionBottom expanded to use freed vertical space.
  const statsTopY          = BOT_Y - 26;
  const SLIM_DECK_H        = 160;
  const DECK_GAP           = 18;
  const boardRegionBottom  = statsTopY - SLIM_DECK_H - DECK_GAP;

  scene.boardLayout = buildDungeonBoardLayout({
    unlockedSlots: unlockedCount,
    totalSlots:    GRID_COLS_HOME * GRID_ROWS_HOME,
    regionTop:     GRID_START_Y,
    regionBottom:  boardRegionBottom,
    canvasWidth:   CANVAS_WIDTH,
    mode:          'vertical-cutaway',
  });

  const g = scene.add.graphics();
  c.add(g);
  const changedIdx = scene.recentlyChangedRoomIdx;

  scene.drawDungeonMapBackdrop(c, g, unlockedCount);
  scene.drawDungeonRouteNetwork(c, g, unlockedCount);
  scene.addDungeonRouteFlow(c, unlockedCount);
  scene.addDungeonActivityLayer(c, unlockedCount);
  scene.drawDungeonRoomAlcoves(g, unlockedCount);

  const { floors, slotW, slotH } = scene.boardLayout;
  const derivedSlotPadX = floors[0]?.cells[0]
    ? floors[0].cells[0].rect.x
    : SLOT_PAD_X;
  const derivedGridStartY = floors[0]?.cells[0]
    ? floors[0].cells[0].rect.y
    : GRID_START_Y;
  const synergyCtx: SynergyDrawContext = {
    scene, theme: scene.theme,
    slots: scene.gs.dungeonSlots ?? [],
    gridCols: GRID_COLS_HOME, gridRows: GRID_ROWS_HOME,
    slotW, slotH,
    slotPadX: derivedSlotPadX, slotPadY: SLOT_PAD_Y,
    gridStartY: derivedGridStartY,
    layout: scene.boardLayout,
  };
  drawSynergyConnectors(synergyCtx, c, unlockedCount);

  const { slotW: cellW, slotH: cellH } = scene.boardLayout;
  const scaleX = cellW / SLOT_W;
  const scaleY = cellH / SLOT_H;
  const needsScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

  for (const [idx, loopCell] of scene.boardLayout.cellsByIdx) {
    const isUnlocked = loopCell.isUnlocked;
    const sx = loopCell.rect.x;
    const sy = loopCell.rect.y;

    if (needsScale) {
      const slotContainer = scene.add.container(sx, sy);
      const slotG = scene.add.graphics();
      slotContainer.add(slotG);
      _drawBattleSlot(makeRoomSlotCtx(scene), slotContainer, slotG, 0, 0, idx, isUnlocked);
      slotContainer.setScale(scaleX, scaleY);
      c.add(slotContainer);
    } else {
      drawBattleSlot(scene, c, g, sx, sy, idx, isUnlocked);
    }

    if (idx === changedIdx && isUnlocked) addRoomChangedPulse(scene, c, sx, sy, idx);
    if (idx === scene.selectedRoomIdx && isUnlocked) {
      const hl = scene.add.graphics().setDepth(9);
      hl.lineStyle(3, COLORS.JADE, 1);
      hl.strokeRoundedRect(sx - 2, sy - 2, cellW + 4, cellH + 4, 10);
      hl.lineStyle(6, COLORS.JADE, 0.25);
      hl.strokeRoundedRect(sx - 2, sy - 2, cellW + 4, cellH + 4, 10);
      c.add(hl);
    }

    if (isUnlocked) {
      const _sx = sx, _sy = sy, _idx = idx;
      const focusAffordance = scene.addRoomOpenAffordance(c, _sx, _sy, _idx);
      const zone = scene.add.zone(sx + cellW / 2, sy + cellH / 2, cellW, cellH)
        .setDepth(10).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => focusAffordance.setHover(true));
      zone.on('pointerout', () => focusAffordance.setHover(false));
      zone.on('pointerdown', () => {
        focusAffordance.pulse();
        scene.selectRoomForPlacement(_idx);
      });
      c.add(zone);
    }
  }

  addDungeonCrewLayer(scene, c, unlockedCount);
  scene.addPrimaryRoomActionPin(c, unlockedCount);
  scene.addActionQueueRankMarkers(c, unlockedCount);
  scene.addRoomMaintenanceBadges(c, unlockedCount);
  drawSynergySummary(synergyCtx, c, CANVAS_WIDTH);
}

// ─── drawDungeonRoomAlcove ────────────────────────────────────────────────────

export function drawDungeonRoomAlcove(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  slotIdx: number,
  unlocked: boolean,
): void {
  const slot = scene.gs.dungeonSlots?.[slotIdx];
  const isBuilt = Boolean(unlocked && slot?.roomType);
  const isBroken = Boolean(isBuilt && slot?.hp <= 0);
  const accent = isBroken
    ? 0xff5544
    : isBuilt && slot
      ? scene.getRoomActivityColor(slot)
      : unlocked
        ? 0x55b88a
        : 0x4d3e2a;
  const readiness = slot?.roomType ? calculateRoomMetrics(scene.gs, slot).readiness : 0;
  const energy = unlocked
    ? Phaser.Math.Clamp((isBuilt ? readiness / 100 : 0.28) + (slot?.roomLevel ?? 0) * 0.05, 0.22, 0.92)
    : 0.12;
  const left = x - 8;
  const top = y - 8;
  const w = SLOT_W + 16;
  const h = SLOT_H + 18;
  const midX = x + SLOT_W / 2;
  const floorY = y + SLOT_H + 8;
  const alpha = unlocked ? 0.48 : 0.22;

  g.fillStyle(0x050302, unlocked ? 0.66 : 0.40);
  g.fillRoundedRect(left, top, w, h, 14);
  g.lineStyle(1.1, 0x131b1b, unlocked ? 0.78 : 0.42);
  g.strokeRoundedRect(left, top, w, h, 14);

  g.fillStyle(0x101615, unlocked ? 0.60 : 0.32);
  g.fillRoundedRect(left + 5, top + 4, w - 10, 13, 7);
  g.fillStyle(0xffffff, unlocked ? 0.055 : 0.025);
  g.fillRoundedRect(left + 12, top + 7, w - 24, 3, 2);

  g.fillStyle(0x070b0a, unlocked ? 0.80 : 0.46);
  g.fillRoundedRect(left + 3, top + 15, 8, h - 24, 5);
  g.fillRoundedRect(left + w - 11, top + 15, 8, h - 24, 5);
  g.lineStyle(1, accent, unlocked ? 0.18 + energy * 0.16 : 0.08);
  g.lineBetween(left + 7, top + 22, left + 7, top + h - 16);
  g.lineBetween(left + w - 7, top + 22, left + w - 7, top + h - 16);

  g.fillStyle(0x010202, unlocked ? 0.62 : 0.32);
  g.fillEllipse(midX, floorY, SLOT_W + 18, 16);
  g.fillStyle(accent, isBroken ? 0.12 : 0.045 + energy * 0.055);
  g.fillEllipse(midX, floorY - 1, SLOT_W + 4, 9);

  const socketAlpha = isBroken ? 0.34 : 0.16 + energy * 0.20;
  const sockets = [
    { x: left + 13, y: top + 13 },
    { x: left + w - 13, y: top + 13 },
    { x: left + 13, y: top + h - 13 },
    { x: left + w - 13, y: top + h - 13 },
  ];
  sockets.forEach((socket, socketIdx) => {
    g.fillStyle(0x010404, unlocked ? 0.86 : 0.46);
    g.fillCircle(socket.x, socket.y, socketIdx < 2 ? 3.5 : 3);
    g.fillStyle(accent, unlocked ? socketAlpha : 0.07);
    g.fillCircle(socket.x, socket.y, socketIdx < 2 ? 1.8 : 1.5);
  });

  if (isBuilt) {
    g.lineStyle(1.2, accent, isBroken ? 0.28 : 0.18 + energy * 0.22);
    g.strokeRoundedRect(left + 4, top + 4, w - 8, h - 8, 11);
    g.fillStyle(accent, isBroken ? 0.08 : 0.04 + energy * 0.045);
    g.fillRoundedRect(left + 15, floorY - 9, w - 30, 5, 3);
    return;
  }

  if (unlocked) {
    g.lineStyle(1, accent, alpha * 0.32);
    g.strokeRoundedRect(left + 12, top + 20, w - 24, h - 34, 8);
    g.fillStyle(accent, 0.055);
    g.fillRoundedRect(left + 20, top + h - 18, w - 40, 4, 2);
    return;
  }

  g.lineStyle(1, 0x8a7858, 0.10);
  g.strokeRoundedRect(left + 12, top + 20, w - 24, h - 34, 8);
  g.lineStyle(1, 0x8a7858, 0.08);
  g.lineBetween(left + 24, top + 25, left + w - 24, top + h - 22);
  g.lineBetween(left + w - 24, top + 25, left + 24, top + h - 22);
}

// ─── addRoomActivityAura ─────────────────────────────────────────────────────

export function addRoomActivityAura(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  slot: DungeonSlot,
  idx: number,
  reducedMotion: boolean,
): void {
  const isBroken = Boolean(slot.roomType && slot.hp <= 0);
  const monsterCount = (slot.monsterIds ?? []).filter(Boolean).length;
  const trapCount = (slot.trapIds ?? []).filter(Boolean).length;
  const loadoutCount = monsterCount + trapCount;
  const hasActiveLoadout = loadoutCount > 0;
  const activity = Math.min(1, 0.28 + (monsterCount + trapCount + slot.roomLevel) * 0.13);
  const accent = isBroken ? 0xff5544 : scene.getRoomActivityColor(slot);
  const aura = scene.add.container(x, y).setAlpha(isBroken ? 0.42 : 0.30 + activity * 0.18);

  const glow = scene.add.graphics();
  glow.fillStyle(accent, isBroken ? 0.12 : 0.08 + activity * 0.06);
  glow.fillCircle(0, 0, 49);
  glow.fillStyle(accent, isBroken ? 0.11 : 0.12 + activity * 0.07);
  glow.fillCircle(0, 0, 29);
  glow.lineStyle(1, accent, isBroken ? 0.28 : 0.18 + activity * 0.22);
  glow.strokeCircle(0, 0, 42);
  glow.strokeCircle(0, 0, 24);
  aura.add(glow);

  const motePositions = isBroken
    ? [{ x: -18, y: -13 }, { x: 19, y: 15 }]
    : hasActiveLoadout
      ? [{ x: -28, y: -20 }, { x: 22, y: 24 }]
      : [];
  motePositions.forEach((pos, moteIdx) => {
    const mote = scene.add.circle(pos.x, pos.y, moteIdx % 2 === 0 ? 2.4 : 1.8, accent, isBroken ? 0.36 : 0.34 + activity * 0.24);
    aura.add(mote);
    if (reducedMotion) return;   // static mote — no perpetual drift
    scene.tweens.add({
      targets: mote,
      alpha: isBroken ? 0.08 : 0.12,
      y: pos.y + (moteIdx % 2 === 0 ? -5 : 4),
      duration: 760 + ((idx + moteIdx) % 4) * 130,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  if (isBroken) {
    glow.lineStyle(1.4, 0xff5544, 0.30);
    glow.lineBetween(-18, -18, -2, 3);
    glow.lineBetween(-2, 3, 18, 21);
    glow.lineBetween(4, -22, -2, 3);
  }

  c.add(aura);
  if (!reducedMotion && (hasActiveLoadout || isBroken)) {
    scene.tweens.add({
      targets: aura,
      scaleX: isBroken ? 1.04 : 1.08,
      scaleY: isBroken ? 1.04 : 1.08,
      alpha: isBroken ? 0.25 : 0.22 + activity * 0.16,
      duration: isBroken ? 640 : 1100 + (idx % 3) * 170,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

// ─── addDungeonCrewLayer ──────────────────────────────────────────────────────

export function addDungeonCrewLayer(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const reducedMotion = getReducedMotion();
  for (let idx = 0; idx < unlockedCount; idx++) {
    const slot = scene.gs.dungeonSlots?.[idx];
    if (!slot?.roomType || slot.hp <= 0) continue;

    const monsterIds = (slot.monsterIds ?? []).filter((id): id is string => typeof id === 'string');
    const trapIds = (slot.trapIds ?? []).filter((id): id is string => typeof id === 'string');
    if (monsterIds.length === 0 && trapIds.length === 0) continue;

    const crewCell = scene.boardLayout.cellsByIdx.get(idx);
    const sx = crewCell?.rect.x ?? 0;
    const sy = crewCell?.rect.y ?? 0;
    const accent = monsterIds.length > 0 ? scene.getRoomActivityColor(slot) : 0xffc45f;
    const icon = monsterIds.length > 0
      ? scene.resolveMonsterVisual(monsterIds[0]).emoji
      : '⚠';
    const loadoutCount = monsterIds.length + trapIds.length;
    const badgeX = sx + scene.boardLayout.slotW + 5;
    const badgeY = sy + 42 + (idx % 2) * 15;

    addRoomCrewBadge(scene, c, badgeX, badgeY, icon, loadoutCount, accent, trapIds.length > 0, reducedMotion, idx);
  }
}

// ─── addRoomCrewBadge ─────────────────────────────────────────────────────────

export function addRoomCrewBadge(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  icon: string,
  count: number,
  accent: number,
  hasTrap: boolean,
  reducedMotion: boolean,
  seed: number,
): void {
  const badge = scene.add.container(x, y).setDepth(13);
  const g = scene.add.graphics();
  const countText = count > 1 ? String(Math.min(count, 9)) : '';

  g.fillStyle(0x050402, 0.94);
  g.fillCircle(0, 0, 9.5);
  g.lineStyle(1.2, accent, 0.78);
  g.strokeCircle(0, 0, 9.5);
  g.fillStyle(accent, 0.18);
  g.fillCircle(0, 0, 6);
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(-3.5, -3.5, 1.7);
  if (hasTrap) {
    g.fillStyle(0xffc45f, 0.94);
    g.fillTriangle(-9, 8, -4, -1, 1, 8);
    g.lineStyle(1, 0x050402, 0.64);
    g.lineBetween(-7, 6, -4, 1);
    g.lineBetween(-4, 1, -1, 6);
  }
  if (count > 1) {
    g.fillStyle(accent, 0.94);
    g.fillCircle(7.5, 7.5, 4.8);
    g.lineStyle(1, 0x050402, 0.72);
    g.strokeCircle(7.5, 7.5, 4.8);
  }
  badge.add(g);

  badge.add(scene.add.text(0, -1, icon, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  if (countText) {
    badge.add(scene.add.text(7.5, 7.5, countText, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#06100d',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }
  c.add(badge);

  if (reducedMotion) return;
  scene.tweens.add({
    targets: badge,
    y: y + (seed % 2 === 0 ? -2 : 2),
    alpha: { from: 0.86, to: 1 },
    duration: 760 + (seed % 5) * 80,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ─── getRoomActivityColor ─────────────────────────────────────────────────────

export function getRoomActivityColor(
  scene: DungeonHomeScene,
  slot: DungeonSlot,
): number {
  switch (slot.roomType) {
    case 'combat':  return 0xff8a45;
    case 'trap':    return 0xc8921a;
    case 'support': return 0x66c08a;
    case 'magic':   return 0x9c7cff;
    default:        return scene.theme.panelBorder;
  }
}

// ─── makeRoomSlotCtx ─────────────────────────────────────────────────────────

export function makeRoomSlotCtx(scene: DungeonHomeScene): RoomSlotContext {
  return {
    scene, theme: scene.theme, gs: scene.gs,
    reducedMotion: getReducedMotion(),
  };
}

// ─── drawBattleSlot ───────────────────────────────────────────────────────────

export function drawBattleSlot(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  index: number,
  unlocked: boolean,
): void {
  _drawBattleSlot(makeRoomSlotCtx(scene), c, g, x, y, index, unlocked);
}

// ─── addRoomChangedPulse ──────────────────────────────────────────────────────

export function addRoomChangedPulse(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  slotIdx: number,
): void {
  const feedback = scene.pendingRoomFeedback?.slotIdx === slotIdx ? scene.pendingRoomFeedback : null;
  const accent = feedback?.accent ?? scene.theme.panelBorder;
  const cw = scene.boardLayout.slotW;
  const ch = scene.boardLayout.slotH;
  const pulse = scene.add.container(x + cw / 2, y + ch / 2);
  const ring = scene.add.graphics();
  const left = -cw / 2;
  const top = -ch / 2;
  ring.lineStyle(2, accent, 0.95);
  ring.strokeRoundedRect(left - 4, top - 4, cw + 8, ch + 8, 9);
  ring.lineStyle(1, 0xffffff, 0.34);
  ring.strokeRoundedRect(left + 4, top + 4, cw - 8, ch - 8, 6);
  ring.fillStyle(accent, 0.16);
  ring.fillRoundedRect(left + 11, top + 8, cw - 22, feedback ? 32 : 14, 5);
  if (feedback) {
    ring.fillStyle(0xffffff, 0.10);
    ring.fillCircle(left + 20, top + Math.min(60, ch - 14), 5);
    ring.fillCircle(left + cw - 20, top + Math.min(68, ch - 6), 4);
    ring.fillCircle(left + cw - 14, top + 30, 3);
  }

  const label = scene.add.text(0, top + (feedback ? 14 : 15), feedback?.title ?? '방 성장', {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    color: '#fff1b8',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  pulse.add([ring, label]);
  if (feedback) {
    const statLabel = feedback.statLabel && feedback.statBefore && feedback.statAfter
      ? `${feedback.statLabel} ${feedback.statBefore}→${feedback.statAfter}`
      : null;
    const itemLabel = statLabel ?? (feedback.kind === 'equipment'
      ? `${feedback.equipmentEmoji} ${feedback.equipmentName}`
      : feedback.body);
    const item = scene.add.text(0, top + 29, itemLabel, {
      fontFamily: 'sans-serif',
      fontSize: statLabel ? '10px' : '9px',
      color: '#d8fff5',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: scene.boardLayout.slotW - 28, useAdvancedWrap: true },
    }).setOrigin(0.5);
    pulse.add(item);
  }
  c.add(pulse);

  scene.tweens.add({
    targets: pulse,
    alpha: 0,
    scaleX: 1.12,
    scaleY: 1.12,
    duration: 2200,
    ease: 'Quad.easeOut',
    onComplete: () => {
      pulse.destroy();
      const overlayOpen = !!scene.roomDetailState.roomDetailContainer
        || !!scene.roomDetailState.monsterPickerContainer
        || !!scene.roomDetailState.trapPickerContainer;
      if (!overlayOpen && scene.recentlyChangedRoomIdx === slotIdx) {
        scene.recentlyChangedRoomIdx = null;
      }
      if (scene.pendingRoomFeedback?.slotIdx === slotIdx) scene.pendingRoomFeedback = null;
    },
  });
}
