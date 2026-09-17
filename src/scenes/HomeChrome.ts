/**
 * HomeChrome — chrome/nav/background/room-detail cluster extracted from DungeonHomeScene.
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ROOT_NAV_Y } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { getDungeonActionQueue, type RoomActionRecommendation } from '../data/roomActionRecommendations';
import { buildDungeonBlueprintPanel } from '../ui/DungeonBlueprintPanel';
import { openRoomDetail as openRoomDetailOverlay } from '../ui/RoomDetailOverlay';
import { openPlacementTray } from '../ui/DungeonPlacementTray';
import { drawBattleSlot as _drawBattleSlot, SLOT_W, SLOT_H } from '../ui/RoomSlotRenderer';
import { drawStalactites, drawStalagmites, addWaterDrip } from '../themes/decorations';
import { getReducedMotion } from '../utils/reducedMotion';
import { audioManager } from '../audio/AudioManager';
import { addRoomActivityAura as _addRoomActivityAura, drawDungeonRoomAlcove as _drawDungeonRoomAlcove, makeRoomSlotCtx as _makeRoomSlotCtx } from './HomeRoomCards';

// ─── Layout constants (must match DungeonHomeScene.ts) ─────────────────────────

const TOP_H = 64;
const BOT_Y = ROOT_NAV_Y;

const GRID_ROWS_HOME = 3;
const SLOT_PAD_Y = 8;
const QUEST_BANNER_H = 22;
const BLUEPRINT_Y = TOP_H + QUEST_BANNER_H + 5;
const BLUEPRINT_H = 0;
const GRID_START_Y = TOP_H + QUEST_BANNER_H + 10;

// ─── buildBackground ─────────────────────────────────────────────────────────

export function buildBackground(scene: DungeonHomeScene): void {
  const bg = scene.add.graphics().setDepth(0);
  bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.08);
  bg.lineBetween(18, 122, 92, 78);
  bg.lineBetween(CANVAS_WIDTH - 18, 154, CANVAS_WIDTH - 82, 102);
  bg.lineBetween(24, CANVAS_HEIGHT - 128, 102, CANVAS_HEIGHT - 94);
}

// ─── buildDungeonGrid ────────────────────────────────────────────────────────

export function buildDungeonGrid(scene: DungeonHomeScene): void {
  const bg = scene.add.graphics().setDepth(1);
  bg.fillGradientStyle(CASUAL.BG_TOP, CASUAL.BG_TOP, CASUAL.BG_BOTTOM, CASUAL.BG_BOTTOM, 1);
  bg.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);

  const gridCaveY = GRID_START_Y - 8;
  const gridCaveH = GRID_ROWS_HOME * SLOT_H + (GRID_ROWS_HOME - 1) * SLOT_PAD_Y + 16;
  bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.1);
  for (let row = 0; row < GRID_ROWS_HOME; row++) {
    const tunnelY = GRID_START_Y + row * (SLOT_H + SLOT_PAD_Y) + SLOT_H / 2 - 5;
    bg.lineBetween(24, tunnelY + 5, CANVAS_WIDTH - 24, tunnelY + 5);
  }

  const lowerCavernY = gridCaveY + gridCaveH - 5;
  const lowerCavernH = Math.max(70, BOT_Y - lowerCavernY - 24);
  bg.fillStyle(CASUAL.BG_BOTTOM, 0.5);
  bg.fillRect(0, lowerCavernY, CANVAS_WIDTH, lowerCavernH);
  bg.fillStyle(0xffffff, 0.18);
  bg.fillRect(0, lowerCavernY, CANVAS_WIDTH, 2);
  bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.12);
  bg.lineBetween(16, lowerCavernY + lowerCavernH - 18, CANVAS_WIDTH - 16, lowerCavernY + lowerCavernH - 24);
  bg.fillStyle(CASUAL.BG_DOT, 0.14);
  for (let r = 0, y = lowerCavernY + 18; y < lowerCavernY + lowerCavernH - 8; y += 30, r++) {
    for (let x = (r % 2) * 26 + 22; x < CANVAS_WIDTH - 12; x += 52) bg.fillCircle(x, y, 3);
  }

  scene.rebuildDungeonSlots();
}

// ─── rebuildDungeonBlueprintPanel ─────────────────────────────────────────────

export function rebuildDungeonBlueprintPanel(scene: DungeonHomeScene): void {
  if (scene.dungeonBlueprintContainer) scene.dungeonBlueprintContainer.destroy();
  if (BLUEPRINT_H <= 0) {
    scene.dungeonBlueprintContainer = null;
    return;
  }
  scene.dungeonBlueprintContainer = buildDungeonBlueprintPanel(scene, scene.gs, scene.theme, {
    x: 10,
    y: BLUEPRINT_Y,
    w: CANVAS_WIDTH - 86,
    h: BLUEPRINT_H,
  });
}

// ─── addAmbientEffects ────────────────────────────────────────────────────────

export function addAmbientEffects(scene: DungeonHomeScene): void {
  const t = scene.theme;
  const reducedMotion = getReducedMotion();
  const gridTop    = GRID_START_Y;
  const gridBottom = GRID_START_Y + GRID_ROWS_HOME * (SLOT_H + SLOT_PAD_Y);

  if (t.decorations.includes('stalactites')) {
    const stalG = scene.add.graphics().setDepth(3);
    drawStalactites(stalG, t, gridTop - 6, CANVAS_WIDTH, 42);
    drawStalactites(stalG, t, 0, CANVAS_WIDTH, 99);
  }
  if (t.decorations.includes('stalagmites')) {
    const stalG2 = scene.add.graphics().setDepth(3);
    drawStalagmites(stalG2, t, gridBottom + 4, CANVAS_WIDTH, 77);
    drawStalagmites(stalG2, t, CANVAS_HEIGHT - 64, CANVAS_WIDTH, 55);
  }

  const glowPts = [
    { x: 18,                y: gridTop },
    { x: CANVAS_WIDTH - 18, y: gridTop },
    { x: 18,                y: gridBottom - 20 },
    { x: CANVAS_WIDTH - 18, y: gridBottom - 20 },
  ];
  const glow = scene.add.graphics().setDepth(4);
  glowPts.forEach(({ x, y }) => {
    glow.fillStyle(t.glowColor, 0.04);
    glow.fillCircle(x, y, 36);
    glow.fillStyle(t.glowColor, 0.08);
    glow.fillCircle(x, y, 18);
    glow.fillStyle(t.glowColor, 0.18);
    glow.fillCircle(x, y, 6);
  });
  // Reduced motion: keep the corner glows lit at full alpha (no perpetual pulse).
  if (reducedMotion) {
    glow.setAlpha(1.0);
  } else {
    scene.tweens.add({
      targets: glow, alpha: { from: 0.6, to: 1.0 },
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // Water drips are a perpetual self-rescheduling effect — skip entirely under
  // reduced motion (decorative only; the cave reads fine without them).
  if (!reducedMotion && t.decorations.includes('water_drips')) {
    const dripXs = [45, 130, 220, 310, 365];
    for (const dx of dripXs) addWaterDrip(scene, t, dx, gridTop - 2, gridTop + 60, 16);
  }
}

// ─── openRoomDetail ────────────────────────────────────────────────────────────

export function openRoomDetail(
  scene: DungeonHomeScene,
  slotIdx: number,
  cellX: number,
  cellY: number,
): void {
  if (scene.roomFocusTransitionActive) return;

  const openOverlay = () => {
    openRoomDetailOverlay(
      scene, scene.roomDetailState, scene.theme, scene.roomDetailCallbacks,
      slotIdx, cellX, cellY,
    );
  };

  if (getReducedMotion()) {
    openOverlay();
    return;
  }

  playRoomFocusTransition(scene, slotIdx, cellX, cellY, openOverlay);
}

// ─── playRoomFocusTransition ──────────────────────────────────────────────────

export function playRoomFocusTransition(
  scene: DungeonHomeScene,
  slotIdx: number,
  cellX: number,
  cellY: number,
  onFocusComplete: () => void,
): void {
  scene.roomFocusTransitionActive = true;
  const accent = getRoomFocusAccent(scene, slotIdx);
  const startX = cellX + SLOT_W / 2;
  const startY = cellY + SLOT_H / 2;
  const targetX = CANVAS_WIDTH / 2;
  const targetY = GRID_START_Y + 146;

  const layer = scene.add.container(0, 0).setDepth(92).setAlpha(0);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.46);
  dim.fillRect(0, TOP_H, CANVAS_WIDTH, BOT_Y - TOP_H);
  layer.add(dim);

  const beam = scene.add.graphics();
  beam.fillStyle(accent, 0.08);
  beam.beginPath();
  beam.moveTo(startX - 38, startY - 34);
  beam.lineTo(startX + 38, startY - 34);
  beam.lineTo(targetX + 112, targetY + 96);
  beam.lineTo(targetX - 112, targetY + 96);
  beam.closePath();
  beam.fillPath();
  beam.lineStyle(1, accent, 0.22);
  beam.lineBetween(startX - 40, startY - 34, targetX - 112, targetY + 96);
  beam.lineBetween(startX + 40, startY - 34, targetX + 112, targetY + 96);
  layer.add(beam);

  const focus = scene.add.container(startX, startY);
  const focusG = scene.add.graphics();
  focus.add(focusG);
  _drawBattleSlot(_makeRoomSlotCtx(scene), focus, focusG, -SLOT_W / 2, -SLOT_H / 2, slotIdx, true);

  const ring = scene.add.graphics();
  ring.lineStyle(3, accent, 0.82);
  ring.strokeRoundedRect(-SLOT_W / 2 - 6, -SLOT_H / 2 - 6, SLOT_W + 12, SLOT_H + 12, 14);
  ring.lineStyle(1, 0xffffff, 0.28);
  ring.strokeRoundedRect(-SLOT_W / 2 + 5, -SLOT_H / 2 + 5, SLOT_W - 10, SLOT_H - 10, 10);
  ring.fillStyle(accent, 0.14);
  ring.fillRoundedRect(-42, -SLOT_H / 2 - 26, 84, 19, 7);
  focus.add(ring);

  const label = scene.add.text(0, -SLOT_H / 2 - 16, `방 #${slotIdx + 1} 확대`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  focus.add(label);
  layer.add(focus);

  scene.tweens.add({
    targets: layer,
    alpha: 1,
    duration: 90,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: focus,
    x: targetX,
    y: targetY,
    scaleX: 2.08,
    scaleY: 2.08,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      onFocusComplete();
      scene.tweens.add({
        targets: layer,
        alpha: 0,
        duration: 120,
        ease: 'Quad.easeOut',
        onComplete: () => {
          layer.destroy(true);
          scene.roomFocusTransitionActive = false;
        },
      });
    },
  });
}

// ─── getRoomFocusAccent ───────────────────────────────────────────────────────

export function getRoomFocusAccent(scene: DungeonHomeScene, slotIdx: number): number {
  const slot = scene.gs.dungeonSlots?.[slotIdx];
  if (slot?.roomType && slot.hp <= 0) return 0xff5544;
  if (slot?.roomType) return scene.getRoomActivityColor(slot);
  return 0x55b88a;
}

// ─── selectRoomForPlacement ───────────────────────────────────────────────────

export function selectRoomForPlacement(scene: DungeonHomeScene, slotIdx: number): void {
  if (scene.roomFocusTransitionActive) return;
  scene.selectedRoomIdx = slotIdx;
  scene.rebuildDungeonSlots();
  openPlacementTray({
    scene,
    getGameState: () => scene.gs,
    persist: (state) => scene.persistGameState(state),
    rebuildSlots: () => scene.rebuildDungeonSlots(),
    openDetail: (idx) => {
      scene.selectedRoomIdx = null;
      scene.rebuildDungeonSlots();
      scene.openDungeonSlot(idx);
    },
    onClose: () => {
      scene.selectedRoomIdx = null;
      scene.rebuildDungeonSlots();
    },
    openForgeTraps: () => {
      scene.registry.set('forgeReturnScene', 'DungeonHomeScene');
      scene.registry.set('forgeTab', 'trap');
      scene.navigateFromHome('ForgeScene');
    },
  }, slotIdx);
}

// ─── addRoomOpenAffordance ────────────────────────────────────────────────────

export function addRoomOpenAffordance(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  slotIdx: number,
): { setHover: (hover: boolean) => void; pulse: () => void } {
  const accent = getRoomFocusAccent(scene, slotIdx);
  const baseG = scene.add.graphics();
  const hoverG = scene.add.graphics().setVisible(false);
  const pulseG = scene.add.graphics().setVisible(false);
  const corner = 10;
  const inset = 6;
  const cellW = scene.boardLayout.slotW;
  const cellH = scene.boardLayout.slotH;

  const drawCorners = (
    graphics: Phaser.GameObjects.Graphics,
    alpha: number,
    weight: number,
    expand = 0,
  ): void => {
    const left = x + inset - expand;
    const top = y + inset - expand;
    const right = x + cellW - inset + expand;
    const bottom = y + cellH - inset + expand;
    const len = corner + expand * 0.5;

    graphics.clear();
    graphics.lineStyle(weight, accent, alpha);
    graphics.lineBetween(left, top + len, left, top);
    graphics.lineBetween(left, top, left + len, top);
    graphics.lineBetween(right - len, top, right, top);
    graphics.lineBetween(right, top, right, top + len);
    graphics.lineBetween(left, bottom - len, left, bottom);
    graphics.lineBetween(left, bottom, left + len, bottom);
    graphics.lineBetween(right - len, bottom, right, bottom);
    graphics.lineBetween(right, bottom - len, right, bottom);
  };

  drawCorners(baseG, 0.22, 1);
  drawCorners(hoverG, 0.86, 1.6, 2);
  c.add([baseG, hoverG, pulseG]);

  return {
    setHover: (isHover: boolean): void => {
      hoverG.setVisible(isHover);
      baseG.setAlpha(isHover ? 0.35 : 1);
    },
    pulse: (): void => {
      drawCorners(pulseG, 0.92, 2, 3);
      pulseG.setVisible(true).setAlpha(1);
      scene.tweens.killTweensOf(pulseG);
      scene.tweens.add({
        targets: pulseG,
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => pulseG.setVisible(false),
      });
    },
  };
}

// ─── addPrimaryRoomActionPin ──────────────────────────────────────────────────

interface HomeRoomActionPin {
  readonly slotIdx: number;
  readonly label: string;
  readonly icon: string;
  readonly accent: number;
}

export function addPrimaryRoomActionPin(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const route = scene.getUnlockedRoute(unlockedCount);
  const pin = route
    .map(idx => scene.getRoomActionPin(idx))
    .find((candidate): candidate is HomeRoomActionPin => Boolean(candidate));
  if (!pin) return;
  const rankedSlots = new Set(
    getDungeonActionQueue(scene.gs, unlockedCount)
      .slice(0, 3)
      .map(action => action.slotIdx),
  );
  if (rankedSlots.has(pin.slotIdx)) return;

  const pinCell = scene.boardLayout.cellsByIdx.get(pin.slotIdx);
  const x = (pinCell?.rect.x ?? 0) + scene.boardLayout.slotW - 17;
  const y = (pinCell?.rect.y ?? 0) + 29;
  const pinContainer = scene.add.container(x, y);
  const g = scene.add.graphics();

  g.fillStyle(0x0b0703, 0.92);
  g.fillCircle(0, 0, 14);
  g.lineStyle(1.2, pin.accent, 0.76);
  g.strokeCircle(0, 0, 14);
  g.fillStyle(pin.accent, 0.22);
  g.fillCircle(0, 0, 8);
  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(-4, -5, 2.2);
  g.fillTriangle(10, 0, 4, -4, 4, 4);
  pinContainer.add(g);

  g.fillStyle(pin.accent, 0.9);
  g.fillCircle(-1, -3, 2.2);
  g.fillRoundedRect(-2, 1, 2, 6, 1);
  const zone = scene.add.zone(0, 0, 44, 44)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    scene.selectRoomForPlacement(pin.slotIdx);
  });
  pinContainer.add(zone);
  c.add(pinContainer);

  if (getReducedMotion()) return;
  scene.tweens.add({
    targets: pinContainer,
    y: y - 3,
    alpha: { from: 0.86, to: 1 },
    duration: 740,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ─── addActionQueueRankMarkers ─────────────────────────────────────────────────

export function addActionQueueRankMarkers(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const action = getDungeonActionQueue(scene.gs, unlockedCount)[0];
  if (!action) {
    const firstBand = scene.boardLayout.floors[0]?.bandRect;
    const routeTarget = {
      x: scene.boardLayout.entrance.x,
      y: firstBand ? firstBand.y + firstBand.h : scene.boardLayout.heart.y - 28,
    };
    addHomeSpatialDirective(scene, c, routeTarget.x, routeTarget.y, '⚔', '방어 준비', CASUAL.GREEN, () => {
      scene.roomDetailCallbacks.startBattle?.();
    });
    return;
  }

  const cell = scene.boardLayout.cellsByIdx.get(action.slotIdx);
  if (!cell) return;
  addActionQueueRoomSpotlight(
    scene,
    c,
    action,
    1,
    cell.center.x,
    cell.center.y,
    getReducedMotion(),
  );
  addHomeSpatialDirective(
    scene,
    c,
    cell.center.x,
    cell.rect.y + 14,
    action.icon,
    action.label,
    action.accent,
    () => scene.selectRoomForPlacement(action.slotIdx),
  );
}

function addHomeSpatialDirective(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  icon: string,
  label: string,
  accent: number,
  onPress: () => void,
): void {
  void icon;
  const w = Math.max(72, 26 + label.length * 10);
  const marker = scene.add.container(x, y).setDepth(14);
  const bg = scene.add.graphics();
  bg.fillStyle(0x070806, 0.94);
  bg.fillRoundedRect(-w / 2, -14, w, 28, 4);
  bg.fillStyle(0x2e2a20, 0.92);
  bg.fillRect(-w / 2 + 4, -10, w - 8, 2);
  bg.fillStyle(accent, 0.82);
  bg.fillRect(-w / 2, -14, 3, 28);
  bg.lineStyle(1, 0xa98245, 0.68);
  bg.strokeRoundedRect(-w / 2, -14, w, 28, 4);
  marker.add(bg);
  marker.add(scene.add.text(0, 1, label, {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5));
  const zone = scene.add.zone(0, 0, Math.max(44, w), 44)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => marker.setScale(1.03));
  zone.on('pointerout', () => marker.setScale(1));
  zone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    onPress();
  });
  marker.add(zone);
  c.add(marker);
}

// ─── addActionQueueRoomSpotlight ──────────────────────────────────────────────

export function addActionQueueRoomSpotlight(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  action: RoomActionRecommendation,
  rank: number,
  x: number,
  y: number,
  reducedMotion: boolean,
): void {
  const spotlight = scene.add.container(x, y).setDepth(13);
  const g = scene.add.graphics();
  const ringW = scene.boardLayout.slotW + 12 - Math.min(rank, 3) * 2;
  const ringH = scene.boardLayout.slotH + 10 - Math.min(rank, 3) * 2;
  const left = -ringW / 2;
  const top = -ringH / 2;
  const alpha = rank === 1 ? 0.80 : rank === 2 ? 0.56 : 0.42;

  g.fillStyle(action.accent, rank === 1 ? 0.035 : 0.02);
  g.fillRoundedRect(left, top, ringW, ringH, 13);
  g.lineStyle(rank === 1 ? 2.2 : 1.4, action.accent, alpha);
  g.strokeRoundedRect(left, top, ringW, ringH, 13);
  g.lineStyle(1, 0xffffff, rank === 1 ? 0.18 : 0.10);
  g.strokeRoundedRect(left + 5, top + 5, ringW - 10, ringH - 10, 10);

  g.fillStyle(0x070503, 0.72);
  g.fillCircle(left + 18, top + 18, 7);
  g.lineStyle(1, action.accent, 0.54);
  g.strokeCircle(left + 18, top + 18, 7);
  g.fillStyle(action.accent, 0.34);
  g.fillCircle(left + 18, top + 18, 3);
  spotlight.add(g);

  c.add(spotlight);
  if (reducedMotion || rank !== 1) return;
  scene.tweens.add({
    targets: spotlight,
    scaleX: 1.04,
    scaleY: 1.04,
    alpha: { from: 0.82, to: 1 },
    duration: 760,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ─── addRoomMaintenanceBadges ─────────────────────────────────────────────────

export function addRoomMaintenanceBadges(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const queue = getDungeonActionQueue(scene.gs, unlockedCount);
  const spotlightedSlots = new Set(queue.slice(0, 3).map(action => action.slotIdx));
  const primaryPin = scene.getUnlockedRoute(unlockedCount)
    .map(idx => scene.getRoomActionPin(idx))
    .find((candidate): candidate is HomeRoomActionPin => Boolean(candidate));
  const maintenanceActions = queue
    .filter(action =>
      action.kind === 'growth'
      && !spotlightedSlots.has(action.slotIdx)
      && action.slotIdx !== primaryPin?.slotIdx,
    )
    .slice(0, 3);
  if (maintenanceActions.length === 0) return;

  const reducedMotion = getReducedMotion();
  maintenanceActions.forEach(action => {
    const mbCell = scene.boardLayout.cellsByIdx.get(action.slotIdx);
    const x = mbCell?.center.x ?? 0;
    const y = (mbCell?.rect.y ?? 0) + scene.boardLayout.slotH - 15;
    const label = action.label;
    const badgeW = Math.max(54, 38 + action.label.length * 10);
    const badge = scene.add.container(x, y).setDepth(15);
    const bg = scene.add.graphics();

    bg.fillStyle(0x040708, 0.94);
    bg.fillRoundedRect(-badgeW / 2, -13, badgeW, 26, 8);
    bg.lineStyle(1.2, action.accent, 0.78);
    bg.strokeRoundedRect(-badgeW / 2, -13, badgeW, 26, 8);
    bg.fillStyle(action.accent, 0.20);
    bg.fillRoundedRect(-badgeW / 2 + 4, -9, badgeW - 8, 18, 6);
    badge.add(bg);

    const labelText = scene.add.text(0, -4, label, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#fff5dc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const statText = scene.add.text(0, 7, action.statValue, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = scene.add.zone(0, 0, Math.max(44, badgeW + 8), 44)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => badge.setScale(1.06));
    zone.on('pointerout', () => badge.setScale(1));
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      scene.selectRoomForPlacement(action.slotIdx);
    });
    badge.add([labelText, statText, zone]);
    c.add(badge);

    if (reducedMotion) return;
    scene.tweens.add({
      targets: badge,
      alpha: { from: 0.82, to: 1 },
      y: y - 2,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });
}

// ─── addDungeonActivityLayer ──────────────────────────────────────────────────

export function addDungeonActivityLayer(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const reducedMotion = getReducedMotion();
  for (let idx = 0; idx < unlockedCount; idx++) {
    const slot = scene.gs.dungeonSlots?.[idx];
    if (!slot?.roomType) continue;

    const actCell = scene.boardLayout.cellsByIdx.get(idx);
    const cx = actCell?.center.x ?? 0;
    const cy = actCell?.center.y ?? 0;
    _addRoomActivityAura(scene, c, cx, cy, slot, idx, reducedMotion);
  }
}

// ─── drawDungeonRoomAlcoves ───────────────────────────────────────────────────

export function drawDungeonRoomAlcoves(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  unlockedCount: number,
): void {
  for (const [idx, alcCell] of scene.boardLayout.cellsByIdx) {
    if (idx > unlockedCount) continue;
    _drawDungeonRoomAlcove(scene, g, alcCell.rect.x, alcCell.rect.y, idx, alcCell.isUnlocked);
  }
}
