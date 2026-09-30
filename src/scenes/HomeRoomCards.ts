/**
 * HomeRoomCards — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import { getDigSpotView, showSideDigSpots } from '../data/dungeonDigView';
import { handleSwapTarget } from '../ui/HomeRoomSwap';
import { openDigPanel } from '../ui/HomeDigPanel';
import { getDungeonPlan, getDungeonRoomCount } from '../data/dungeonPlan';
import { getSlotBuilding, getSlotBuildingName } from '../data/roomBuildings';
import { IDLE_PER_GOLD_ROOM } from '../data/idleIncome';
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CANVAS_WIDTH, ROOT_NAV_Y } from '../constants/layout';
import { CASUAL, CASUAL_CSS, COLORS } from '../constants/colors';
import {
  ROOM_SLOT_TYPE_DEFS,
  SLOT_UNLOCK_LEVELS,
  type DungeonSlot,
} from '../data/wisdom';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { generateMonsterSprite } from '../art/PortraitGenerator';
import { logger } from '../utils/logger';
import {
  type RoomSlotContext,
  drawBattleSlot as _drawBattleSlot,
  SLOT_W,
} from '../ui/RoomSlotRenderer';
import {
  type SynergyDrawContext,
  drawSynergyConnectors,
  drawSynergySummary,
} from '../ui/DungeonSynergy';
import { buildDungeonBoardLayout, isVisibleHomeSlot } from '../ui/DungeonBoardLayout';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── Layout constants (must match DungeonHomeScene.ts) ─────────────────────

const TOP_H            = 64;
const BOT_Y            = ROOT_NAV_Y;

const GRID_COLS_HOME   = 3;
const GRID_ROWS_HOME   = 3;

const SLOT_PAD_X       = Math.floor((CANVAS_WIDTH - GRID_COLS_HOME * SLOT_W) / (GRID_COLS_HOME + 1));
const SLOT_PAD_Y       = 8;
const QUEST_BANNER_H   = 22;
const GRID_START_Y     = TOP_H + QUEST_BANNER_H + 10;

// ─── rebuildDungeonSlots ─────────────────────────────────────────────────────


/** The name a Home room card shows; the action marker that sits on it repeats it (§35). */
export function getHomeRoomTitle(slot: DungeonSlot | null | undefined): string | null {
  if (!slot?.roomType) return null;
  if (slot.hp <= 0) return '파손된 방';
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === slot.roomType);
  return typeDef ? getSlotBuildingName(slot, typeDef.name) : '던전 방';
}

export function rebuildDungeonSlots(scene: DungeonHomeScene): void {
  if (scene.dungeonContainer) scene.dungeonContainer.destroy();
  const c = scene.add.container(0, 0).setDepth(3);
  scene.dungeonContainer = c;

  const unlockedCount = getDungeonRoomCount(scene.gs);
  logger.debug(`[SLOTS] DM Lv.${scene.gs.dmLevel}: ${unlockedCount} slots unlocked`);

  // Phase D: regionBottom expanded to use freed vertical space.
  const statsTopY          = BOT_Y - 26;
  const SLIM_DECK_H        = 142;
  const DECK_GAP           = 18;
  const boardRegionBottom  = statsTopY - SLIM_DECK_H - DECK_GAP;

  scene.boardLayout = buildDungeonBoardLayout({
    unlockedSlots: unlockedCount,
    totalSlots:    GRID_COLS_HOME * GRID_ROWS_HOME,
    regionTop:     GRID_START_Y,
    regionBottom:  boardRegionBottom,
    canvasWidth:   CANVAS_WIDTH,
    mode:          'corridor',
    plan:          getDungeonPlan(scene.gs),
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

  for (const [idx, loopCell] of scene.boardLayout.cellsByIdx) {
    if (!isVisibleHomeSlot(idx, unlockedCount)) continue;
    const isUnlocked = loopCell.isUnlocked;
    const sx = loopCell.rect.x;
    const sy = loopCell.rect.y;

    drawHomeDungeonHotspot(scene, c, g, sx, sy, cellW, cellH, idx, isUnlocked);

    if (idx === changedIdx && isUnlocked) addRoomChangedPulse(scene, c, sx, sy, idx);
    if (idx === scene.selectedRoomIdx && isUnlocked) {
      const hl = scene.add.graphics().setDepth(9);
      hl.lineStyle(2, COLORS.JADE, 1);
      hl.strokeRoundedRect(sx - 2, sy - 2, cellW + 4, cellH + 4, 10);
      c.add(hl);
    } else if (scene.swapSourceIdx !== null && isUnlocked) {
      // Swap mode: every other room is a target.
      const hl = scene.add.graphics().setDepth(9);
      hl.lineStyle(1.5, COLORS.TORCH_AMBER, 0.75);
      hl.strokeRoundedRect(sx - 2, sy - 2, cellW + 4, cellH + 4, 10);
      c.add(hl);
    }

    if (isUnlocked) {
      const _sx = sx, _sy = sy, _idx = idx;
      const focusAffordance = scene.addRoomOpenAffordance(c, _sx, _sy, _idx);
      // Named so the modal harness can open the placement tray; without a name it
      // had no way in, leaving the trap strip (tier badges, stock counts) uncovered.
      const zone = scene.add.zone(sx + cellW / 2, sy + cellH / 2, cellW, cellH)
        .setName(`home-room-card-${_idx}`)
        .setDepth(10).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => focusAffordance.setHover(true));
      zone.on('pointerout', () => focusAffordance.setHover(false));
      // On release, and only if the press was not a board drag (the board scrolls sideways).
      zone.on('pointerup', () => {
        if (scene.boardDragMoved) return;
        focusAffordance.pulse();
        if (scene.swapSourceIdx !== null) handleSwapTarget(scene, _idx);
        else scene.selectRoomForPlacement(_idx);
      });
      c.add(zone);
    }
  }

  drawDigSpots(scene, c);
  scene.addActionQueueRankMarkers(c, unlockedCount);
  drawSynergySummary(synergyCtx, c, CANVAS_WIDTH);
  enableBoardScroll(scene, c, boardRegionBottom);
}

// ─── Dig spots + board scroll (corridor dungeon) ─────────────────────────────

/** 굴착 자리 타일: 주 통로 끝은 항상, 곁방 자리는 곁방 허가나 살 수 있는 허가증이 남았을 때만(`showSideDigSpots`). */
function drawDigSpots(scene: DungeonHomeScene, c: Phaser.GameObjects.Container): void {
  const spots = scene.boardLayout.digSpots ?? [];
  const sides = showSideDigSpots(scene.gs);
  for (const spot of spots) {
    if (spot.kind !== 'corridor' && !sides) continue;
    const view = getDigSpotView(scene.gs, spot.kind);
    const { x, y, w, h } = spot.rect;
    // The corridor end is the main expansion; side spots stay quiet (dashed outline, small +)
    // so a board full of empty dig spots does not outshine the rooms that exist.
    const main = spot.kind === 'corridor';
    const inset = main ? 10 : 22;
    const accent = view.canDig ? CASUAL.GREEN : CASUAL.EDGE_SOFT;
    const g = scene.add.graphics();
    const rx = x + inset, ry = y + inset, rw = w - inset * 2, rh = h - inset * 2;
    if (main) {
      g.fillStyle(0x000000, view.canDig ? 0.34 : 0.22);
      g.fillRoundedRect(rx, ry, rw, rh, 12);
      g.lineStyle(2, accent, view.canDig ? 0.9 : 0.5);
      g.strokeRoundedRect(rx, ry, rw, rh, 12);
    } else {
      strokeDashedRect(g, rx, ry, rw, rh, accent, view.canDig ? 0.55 : 0.3);
    }
    const cx = x + w / 2, cy = y + h / 2 - 8;
    const arm = main ? 10 : 6;
    g.lineStyle(main ? 3 : 2, accent, view.canDig ? (main ? 1 : 0.7) : 0.5);
    g.lineBetween(cx - arm, cy, cx + arm, cy);
    g.lineBetween(cx, cy - arm, cx, cy + arm);
    c.add(g);
    const label = spot.kind === 'corridor'
      ? (view.canDig ? `굴착 ${view.cost.toLocaleString('ko-KR')}` : view.blocker ?? '굴착')
      : (view.canDig ? '곁방' : view.blocker ?? '곁방');
    c.add(scene.add.text(cx, cy + 22, label, {
      fontFamily: 'sans-serif', fontSize: main ? '11px' : '10px', fontStyle: 'bold',
      color: view.canDig && main ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setAlpha(main ? 1 : 0.8));
    const zone = scene.add.zone(x + w / 2, y + h / 2, w - inset * 2, h - inset * 2)
      .setName(`home-dig-${spot.kind}-${spot.anchor}`)
      .setDepth(10).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => { if (!scene.boardDragMoved && scene.swapSourceIdx === null) openDigPanel(scene, spot); });
    c.add(zone);
  }
}

/** Dashed rounded-ish outline (corners left open) for quiet placeholders. */
function strokeDashedRect(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number,
): void {
  const dash = 7, gap = 5;
  g.lineStyle(1.5, color, alpha);
  const edge = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 6; d < len - 6; d += dash + gap) {
      const e = Math.min(len - 6, d + dash);
      g.lineBetween(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}

const BOARD_DRAG_THRESHOLD = 10;

/** 보드가 화면보다 넓으면 보드 영역 안에서만 가로로 끌어 스크롤한다(마스크 + 컨테이너 x). */
function enableBoardScroll(scene: DungeonHomeScene, c: Phaser.GameObjects.Container, regionBottom: number): void {
  const maxScroll = Math.max(0, Math.ceil(scene.boardLayout.boardRect.w - CANVAS_WIDTH));
  scene.boardScrollX = Phaser.Math.Clamp(scene.boardScrollX, 0, maxScroll);
  c.x = -scene.boardScrollX;
  if (maxScroll === 0) return;

  const top = scene.boardLayout.boardRect.y - 6;
  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff, 1).fillRect(0, top, CANVAS_WIDTH, regionBottom - top + 6);
  c.setMask(maskShape.createGeometryMask());
  c.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());

  // Edge cues: the corridor runs past the screen. Fixed to the screen (not the scrolling
  // container) and hidden at the end they point to.
  const midY = scene.boardLayout.heart.y;
  const cue = (side: 'left' | 'right'): Phaser.GameObjects.Container => {
    const x = side === 'left' ? 0 : CANVAS_WIDTH - 22;
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.42);
    bg.fillRect(x, top + 6, 22, regionBottom - top - 6);
    const arrow = scene.add.text(x + 11, midY, side === 'left' ? '‹' : '›', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#e8c060', fontStyle: 'bold',
    }).setOrigin(0.5);
    return scene.add.container(0, 0, [bg, arrow]).setDepth(12);
  };
  const leftCue = cue('left');
  const rightCue = cue('right');
  const syncCues = (): void => {
    leftCue.setVisible(scene.boardScrollX > 4);
    rightCue.setVisible(scene.boardScrollX < maxScroll - 4);
  };
  syncCues();
  c.once(Phaser.GameObjects.Events.DESTROY, () => { leftCue.destroy(); rightCue.destroy(); });

  let startX: number | null = null;
  let startScroll = 0;
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    scene.boardDragMoved = false;
    startX = pointer.worldY >= top && pointer.worldY <= regionBottom ? pointer.worldX : null;
    startScroll = scene.boardScrollX;
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (startX === null || !pointer.isDown) return;
    const dx = pointer.worldX - startX;
    if (!scene.boardDragMoved && Math.abs(dx) < BOARD_DRAG_THRESHOLD) return;
    scene.boardDragMoved = true;
    scene.boardScrollX = Phaser.Math.Clamp(startScroll - dx, 0, maxScroll);
    if (c.active) c.x = -scene.boardScrollX;
    syncCues();
  };
  const onUp = (): void => { startX = null; };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  // The board is rebuilt often; drop this board's listeners with it.
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
  });
}

function drawHomeDungeonHotspot(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  unlocked: boolean,
): void {
  const slot = scene.gs.dungeonSlots?.[index];
  const built = Boolean(unlocked && slot?.roomType);
  const broken = Boolean(built && slot && slot.hp <= 0);
  const accent = broken
    ? CASUAL.RED
    : built && slot
      ? scene.getRoomActivityColor(slot)
      : unlocked
        ? COLORS.JADE
        : 0x876b43;
  const cx = x + w / 2;
  const floorY = y + h - 15;
  const innerX = x + 9;
  const innerY = y + 13;
  const innerW = w - 18;
  const innerH = h - 29;

  // Cutaway chamber mouth: most of the backdrop stays visible around and through it.
  g.fillStyle(0x020403, unlocked ? 0.68 : 0.78);
  g.fillRoundedRect(innerX, innerY, innerW, innerH, 16);
  g.fillStyle(accent, built ? 0.10 : unlocked ? 0.055 : 0.035);
  g.fillRoundedRect(innerX + 5, innerY + 6, innerW - 10, innerH - 10, 13);
  g.lineStyle(2, broken ? CASUAL.RED_DK : 0x38362d, unlocked ? 0.92 : 0.70);
  g.strokeRoundedRect(innerX, innerY, innerW, innerH, 16);
  g.lineStyle(1, accent, built ? 0.56 : unlocked ? 0.40 : 0.30);
  g.strokeRoundedRect(innerX + 4, innerY + 4, innerW - 8, innerH - 8, 13);

  // Physical ledge and side supports seat the room inside the shaft.
  g.fillStyle(0x111411, 0.98);
  g.fillRoundedRect(x + 3, floorY, w - 6, 11, 3);
  g.fillStyle(0x4a412f, 0.58);
  g.fillRect(x + 8, floorY + 1, w - 16, 2);
  g.fillStyle(0x080a08, 0.92);
  g.fillRect(x + 5, innerY + 14, 6, innerH - 20);
  g.fillRect(x + w - 11, innerY + 14, 6, innerH - 20);

  if (!unlocked) {
    drawSealedExpansion(scene, c, g, cx, innerY, innerW, innerH, index);
    return;
  }

  if (!slot?.roomType) {
    g.lineStyle(2, COLORS.JADE, 0.58);
    g.lineBetween(cx - 17, innerY + 30, cx + 17, innerY + 30);
    g.lineBetween(cx, innerY + 18, cx, innerY + 43);
    g.lineStyle(1, 0xe0b96f, 0.48);
    g.strokeCircle(cx, innerY + 30, 21);
    c.add(scene.add.text(cx, y + 8, `방 #${index + 1}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#b9c8b8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8));
    c.add(scene.add.text(cx, floorY - 8, '빈 터', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e2c181', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(8));
    return;
  }

  const metrics = calculateRoomMetrics(scene.gs, slot);
  const monsterIds = (slot.monsterIds ?? []).filter((id): id is string => Boolean(id));
  const trapCount = (slot.trapIds ?? []).filter(Boolean).length;
  const title = getHomeRoomTitle(slot) ?? '던전 방';
  c.add(scene.add.text(cx, y + 8, title, {
    fontFamily: 'Georgia, serif', fontSize: '11px',
    color: broken ? CASUAL_CSS.RED : '#ead7af', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(8));

  if (broken) {
    g.lineStyle(2, CASUAL.RED, 0.78);
    g.lineBetween(innerX + 22, innerY + 8, cx - 4, innerY + 34);
    g.lineBetween(cx - 4, innerY + 34, innerX + innerW - 20, floorY - 7);
    g.lineBetween(cx - 4, innerY + 34, innerX + 18, floorY - 10);
    c.add(scene.add.text(cx, floorY - 7, '수리 필요', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ff8b72', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(8));
    return;
  }

  g.fillStyle(0xe08a45, 0.09);
  g.fillCircle(cx, innerY + innerH / 2 + 4, 30);
  const primaryId = monsterIds[0];
  const profile = primaryId ? resolveOwnedMonsterProfile(primaryId) : null;
  if (profile?.registryId) {
    const sprite = scene.add.image(
      cx,
      innerY + innerH / 2 + 4,
      generateMonsterSprite(scene, profile.registryId),
    ).setOrigin(0.5).setDisplaySize(42, 42).setDepth(7);
    c.add(sprite);
    if (!getReducedMotion()) {
      scene.tweens.add({
        targets: sprite,
        y: sprite.y - 3,
        duration: 1200 + index * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  } else if (trapCount > 0) {
    drawTrapSilhouette(g, cx, floorY - 3, accent);
  } else {
    drawRoomEmblem(g, cx, innerY + innerH / 2 + 3, getSlotBuilding(slot) === 'gold' ? 'gold' : slot.roomType, accent);
  }

  // An income room earns rather than defends: show its revenue, not a combat readiness.
  const isIncomeRoom = getSlotBuilding(slot) === 'gold';
  const footer = isIncomeRoom
    ? `💰 +${IDLE_PER_GOLD_ROOM}/분`
    : `${metrics.readiness}% · 👹${monsterIds.length} 🕸${trapCount}`;
  c.add(scene.add.text(cx, floorY - 7, footer, {
    fontFamily: 'sans-serif', fontSize: '10px',
    color: isIncomeRoom || metrics.readiness >= 70 ? '#d8c187' : '#e89271', fontStyle: 'bold',
  }).setOrigin(0.5, 1).setDepth(8));
}

function drawSealedExpansion(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  w: number,
  h: number,
  index: number,
): void {
  const doorW = Math.min(60, w - 22);
  const doorX = cx - doorW / 2;
  g.fillStyle(0x080706, 0.94);
  g.fillRoundedRect(doorX, y + 8, doorW, h - 13, 13);
  g.lineStyle(2, 0x5c4a31, 0.68);
  g.strokeRoundedRect(doorX, y + 8, doorW, h - 13, 13);
  g.lineStyle(2, 0x7f6845, 0.58);
  g.lineBetween(doorX + 5, y + 15, doorX + doorW - 5, y + h - 9);
  g.lineBetween(doorX + doorW - 5, y + 15, doorX + 5, y + h - 9);
  g.fillStyle(0x17130e, 1);
  g.fillRoundedRect(cx - 8, y + h / 2 - 4, 16, 15, 3);
  g.lineStyle(2, 0xa98245, 0.72);
  g.beginPath();
  g.arc(cx, y + h / 2 - 4, 6, Math.PI, Math.PI * 2);
  g.strokePath();
  g.strokeRoundedRect(cx - 8, y + h / 2 - 4, 16, 15, 3);
  const requiredLevel = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
  c.add(scene.add.text(cx, y + h - 3, `심도 봉인 · Lv.${requiredLevel}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#a99a80', fontStyle: 'bold',
  }).setOrigin(0.5, 1).setDepth(8));
}

function drawTrapSilhouette(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  floorY: number,
  accent: number,
): void {
  g.fillStyle(0x090807, 0.96);
  g.fillRect(cx - 25, floorY - 12, 50, 8);
  g.fillStyle(accent, 0.72);
  for (let i = 0; i < 5; i++) {
    const x = cx - 22 + i * 11;
    g.fillTriangle(x, floorY - 12, x + 9, floorY - 12, x + 4.5, floorY - 29 - (i % 2) * 4);
  }
}

function drawRoomEmblem(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  roomType: string,
  accent: number,
): void {
  g.lineStyle(2, accent, 0.72);
  g.strokeCircle(cx, cy, 18);
  if (roomType === 'combat') {
    g.lineBetween(cx - 10, cy + 10, cx + 10, cy - 10);
    g.lineBetween(cx - 10, cy - 10, cx + 10, cy + 10);
  } else if (roomType === 'trap') {
    g.lineBetween(cx - 12, cy + 8, cx, cy - 10);
    g.lineBetween(cx, cy - 10, cx + 12, cy + 8);
  } else if (roomType === 'gold') {
    // Income room: a stacked coin, not the support cross (which read as "add a guardian").
    g.fillStyle(0xe8c060, 0.85);
    g.fillEllipse(cx, cy + 5, 22, 9);
    g.fillEllipse(cx, cy - 1, 22, 9);
    g.fillStyle(0xfff0b0, 0.9);
    g.fillEllipse(cx, cy - 6, 22, 9);
    g.lineStyle(1.5, 0x8a6420, 0.9);
    g.strokeEllipse(cx, cy - 6, 22, 9);
  } else if (roomType === 'support') {
    g.lineBetween(cx - 11, cy, cx + 11, cy);
    g.lineBetween(cx, cy - 11, cx, cy + 11);
  } else {
    g.strokeCircle(cx, cy, 7);
    g.fillStyle(accent, 0.76);
    g.fillCircle(cx, cy, 3);
  }
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
  const cellW = scene.boardLayout.slotW;
  const cellH = scene.boardLayout.slotH;
  const left = x - 5;
  const top = y - 3;
  const w = cellW + 10;
  const h = cellH + 7;
  const midX = x + cellW / 2;
  const floorY = y + cellH + 2;
  const alpha = unlocked ? 0.48 : 0.22;

  // Only the masonry shell is drawn here; the shaft remains visible between rooms.
  g.fillStyle(0x050706, unlocked ? 0.52 : 0.34);
  g.fillRoundedRect(left, top + 10, w, h - 10, 16);
  g.lineStyle(1.1, 0x33352e, unlocked ? 0.78 : 0.42);
  g.strokeRoundedRect(left, top + 10, w, h - 10, 16);

  g.fillStyle(0x151915, unlocked ? 0.76 : 0.42);
  g.fillRoundedRect(left + 5, top + 8, w - 10, 10, 5);
  g.fillStyle(0xffffff, unlocked ? 0.055 : 0.025);
  g.fillRoundedRect(left + 12, top + 7, w - 24, 3, 2);

  g.fillStyle(0x070b0a, unlocked ? 0.80 : 0.46);
  g.fillRoundedRect(left + 3, top + 18, 8, h - 29, 5);
  g.fillRoundedRect(left + w - 11, top + 18, 8, h - 29, 5);
  g.lineStyle(1, accent, unlocked ? 0.18 + energy * 0.16 : 0.08);
  g.lineBetween(left + 7, top + 22, left + 7, top + h - 16);
  g.lineBetween(left + w - 7, top + 22, left + w - 7, top + h - 16);

  g.fillStyle(0x010202, unlocked ? 0.62 : 0.32);
  g.fillEllipse(midX, floorY, cellW + 12, 14);
  g.fillStyle(accent, isBroken ? 0.12 : 0.045 + energy * 0.055);
  g.fillEllipse(midX, floorY - 1, cellW - 2, 8);

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
      fontSize: '10px',
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
      fontSize: '10px',
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
