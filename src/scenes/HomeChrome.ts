/**
 * HomeChrome — chrome/nav/background/room-detail cluster extracted from DungeonHomeScene.
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { getDungeonActionQueue, type RoomActionRecommendation } from '../data/roomActionRecommendations';
import { buildDungeonBlueprintPanel } from '../ui/DungeonBlueprintPanel';
import { openRoomDetail as openRoomDetailOverlay } from '../ui/RoomDetailOverlay';
import { openPlacementTray } from '../ui/DungeonPlacementTray';
import { drawBattleSlot as _drawBattleSlot, SLOT_W, SLOT_H } from '../ui/RoomSlotRenderer';
import { openSimulationModal } from '../ui/SimulationModal';
import { drawStalactites, drawStalagmites, addWaterDrip } from '../themes/decorations';
import { getReducedMotion } from '../utils/reducedMotion';
import { audioManager } from '../audio/AudioManager';
import { addRoomActivityAura as _addRoomActivityAura, drawDungeonRoomAlcove as _drawDungeonRoomAlcove, makeRoomSlotCtx as _makeRoomSlotCtx } from './HomeRoomCards';

// ─── Layout constants (must match DungeonHomeScene.ts) ─────────────────────────

const TOP_H = 64;
const BOT_H = 64;
const BOT_Y = CANVAS_HEIGHT - BOT_H;

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
  bg.fillStyle(0xfff7e4, 0.5);
  bg.fillEllipse(CANVAS_WIDTH / 2, 30, CANVAS_WIDTH * 1.5, 240);
  bg.fillStyle(CASUAL.BG_DOT, 0.16);
  for (let row = 0, y = 70; y < CANVAS_HEIGHT; y += 60, row++) {
    for (let x = (row % 2) * 30 + 16; x < CANVAS_WIDTH; x += 60) bg.fillCircle(x, y, 3.5);
  }
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

  if (BLUEPRINT_H > 0) {
    rebuildDungeonBlueprintPanel(scene);

    const simBtnX = CANVAS_WIDTH - 66, simBtnY = BLUEPRINT_Y + 8;
    const simBg = scene.add.graphics().setDepth(5);
    simBg.fillStyle(CASUAL.EDGE, 1);
    simBg.fillRoundedRect(simBtnX, simBtnY + 2, 56, 24, 12);
    simBg.fillStyle(CASUAL.PANEL, 1);
    simBg.fillRoundedRect(simBtnX, simBtnY, 56, 23, 12);
    simBg.fillStyle(0xffffff, 0.12);
    simBg.fillRoundedRect(simBtnX + 4, simBtnY + 3, 48, 5, 3);
    const simTxt = scene.add.text(simBtnX + 28, simBtnY + 11, '⚗ 예측', {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    simTxt.on('pointerdown', () => openSimulationModal(scene, scene.gs, scene.theme));
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

// ─── buildBottomNav ───────────────────────────────────────────────────────────

export function buildBottomNav(scene: DungeonHomeScene): void {
  const g = scene.add.graphics().setDepth(8);
  g.fillStyle(CASUAL.SHADOW, 1);
  g.fillRect(0, BOT_Y - 4, CANVAS_WIDTH, BOT_H + 4);
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRect(0, BOT_Y, CANVAS_WIDTH, BOT_H);
  g.fillStyle(0xffffff, 0.14);
  g.fillRect(0, BOT_Y, CANVAS_WIDTH, 3);
  g.lineStyle(3, CASUAL.EDGE, 1);
  g.lineBetween(0, BOT_Y, CANVAS_WIDTH, BOT_Y);

  const tabs = [
    { icon: '🏰', label: '던전',  key: 'home',     accent: CASUAL.GOLD,   accentDk: CASUAL.GOLD_DK   },
    { icon: '👹', label: '막사',  key: 'barracks', accent: CASUAL.RED,    accentDk: CASUAL.RED_DK    },
    { icon: '🔮', label: '소환',  key: 'summon',   accent: CASUAL.PURPLE, accentDk: CASUAL.PURPLE_DK },
    { icon: '⚒',  label: '제작',  key: 'forge',    accent: CASUAL.BLUE,   accentDk: CASUAL.BLUE_DK   },
    { icon: '⚔️', label: '전투',  key: 'battle',   accent: CASUAL.GREEN,  accentDk: CASUAL.GREEN_DK  },
  ];
  const tabW = CANVAS_WIDTH / tabs.length;
  const panelY = BOT_Y + 6;
  const panelH = BOT_H - 10;

  const today = new Date().toISOString().slice(0, 10);
  const hasUnclaimedAchievement = ACHIEVEMENT_DEFS.some(d => {
    const entry = scene.gs.achievements?.[d.id];
    return entry?.unlocked && !entry.rewardClaimed;
  });

  tabs.forEach(({ icon, label, key, accent, accentDk }, i) => {
    const tx       = i * tabW + tabW / 2;
    const isActive = key === 'home';
    const panelX = i * tabW + 5;
    const panelW = tabW - 10;

    if (isActive) {
      g.fillStyle(accentDk, 1);
      g.fillRoundedRect(panelX, panelY + 3, panelW, panelH, 11);
      g.fillStyle(accent, 1);
      g.fillRoundedRect(panelX, panelY, panelW, panelH - 1, 11);
      g.fillStyle(0xffffff, 0.32);
      g.fillRoundedRect(panelX + 5, panelY + 4, panelW - 10, 8, 5);
    } else {
      g.fillStyle(CASUAL.PANEL_SOFT, 1);
      g.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
      g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
      g.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);
    }
    const iconTxt = scene.add.text(tx, BOT_Y + 11, icon, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5, 0).setDepth(9);
    const labelTxt = scene.add.text(tx, BOT_Y + 46, label, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: isActive ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
      stroke: isActive ? '#' + accentDk.toString(16).padStart(6, '0') : undefined,
      strokeThickness: isActive ? 3 : 0,
    }).setOrigin(0.5).setDepth(9);

    const showBadge = (
      (key === 'barracks' && scene.gs.ownedMonsters.some(m => (m.skillPoints ?? 0) > 0)) ||
      (key === 'forge'    && (scene.gs.awakeningStones ?? 0) > 0) ||
      (key === 'summon'   && scene.gs.lastFriendSummon !== today) ||
      (key === 'battle'   && hasUnclaimedAchievement)
    );
    if (showBadge) {
      const bx = tx + 14;
      const by = panelY + 9;
      const badgeG = scene.add.graphics().setDepth(61);
      badgeG.fillStyle(0xff2222, 1);
      badgeG.fillCircle(bx, by, 5);
      badgeG.lineStyle(1, 0xffffff, 0.65);
      badgeG.strokeCircle(bx, by, 5);
      scene.add.text(bx, by, '!', {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(62);
    }

    if (!isActive) {
      const hoverG = scene.add.graphics().setDepth(8.5).setVisible(false);
      hoverG.fillStyle(accent, 0.22);
      hoverG.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
      hoverG.lineStyle(2, accent, 0.9);
      hoverG.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);

      const zone = scene.add.zone(i * tabW, BOT_Y, tabW, BOT_H)
        .setOrigin(0, 0)
        .setDepth(11)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        hoverG.setVisible(true);
        labelTxt.setColor('#' + accentDk.toString(16).padStart(6, '0'));
      });
      zone.on('pointerout', () => {
        hoverG.setVisible(false);
        labelTxt.setColor(CASUAL_CSS.INK_SOFT);
        iconTxt.setScale(1);
        labelTxt.setScale(1);
      });
      zone.on('pointerdown', () => {
        scene.tweens.add({
          targets: [iconTxt, labelTxt],
          scaleX: 0.9,
          scaleY: 0.9,
          duration: 80,
          yoyo: true,
        });
        audioManager.playSfx('button_click');
        scene.cameras.main.fadeOut(220, 0, 0, 0);
        scene.cameras.main.once('camerafadeoutcomplete', () => {
          if (key === 'barracks') scene.scene.start('BarracksScene');
          else if (key === 'summon') scene.scene.start('SummonScene');
          else if (key === 'forge') scene.scene.start('ForgeScene');
          else if (key === 'battle') scene.scene.start('StageSelectScene');
        });
      });
    }
  });
}

// ─── addAmbientEffects ────────────────────────────────────────────────────────

export function addAmbientEffects(scene: DungeonHomeScene): void {
  const t = scene.theme;
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
  scene.tweens.add({
    targets: glow, alpha: { from: 0.6, to: 1.0 },
    duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  if (t.decorations.includes('water_drips')) {
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

  const text = scene.add.text(-1, 0, pin.icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  pinContainer.add(text);
  const zone = scene.add.zone(0, 0, 34, 34)
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
  const actions = getDungeonActionQueue(scene.gs, unlockedCount).slice(0, 3);
  if (actions.length === 0) return;

  const reducedMotion = getReducedMotion();
  actions.forEach((action, i) => {
    const aqCell = scene.boardLayout.cellsByIdx.get(action.slotIdx);
    const x = aqCell?.center.x ?? 0;
    const y = (aqCell?.rect.y ?? 0) + 10;
    const rank = i + 1;
    addActionQueueRoomSpotlight(scene, c, action, rank, x, y + scene.boardLayout.slotH / 2 - 10, reducedMotion);
    const markerW = 42;
    const marker = scene.add.container(x, y).setDepth(14);
    const bg = scene.add.graphics();

    bg.fillStyle(0x070503, 0.94);
    bg.fillRoundedRect(-markerW / 2, -10, markerW, 20, 8);
    bg.lineStyle(1.2, action.accent, 0.86);
    bg.strokeRoundedRect(-markerW / 2, -10, markerW, 20, 8);
    bg.fillStyle(action.accent, 0.22);
    bg.fillRoundedRect(-markerW / 2 + 4, -6, markerW - 8, 12, 6);
    bg.fillStyle(0x0b0703, 0.92);
    bg.fillCircle(-markerW / 2 + 11, 0, 9);
    bg.lineStyle(1, action.accent, 0.76);
    bg.strokeCircle(-markerW / 2 + 11, 0, 9);
    bg.fillStyle(0xffffff, 0.18);
    bg.fillCircle(-markerW / 2 + 8, -3, 2);
    marker.add(bg);

    marker.add(scene.add.text(-markerW / 2 + 11, 0, String(rank), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#fff6d6',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    marker.add(scene.add.text(8, 0, action.icon, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#fff6d6',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const zone = scene.add.zone(0, 0, markerW + 16, 30)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => marker.setScale(1.06));
    zone.on('pointerout', () => marker.setScale(1));
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      scene.selectRoomForPlacement(action.slotIdx);
    });
    marker.add(zone);
    c.add(marker);

    if (reducedMotion) return;
    scene.tweens.add({
      targets: marker,
      y: y - 2,
      alpha: { from: 0.88, to: 1 },
      duration: 680 + i * 90,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });
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

  g.fillStyle(action.accent, rank === 1 ? 0.10 : 0.055);
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
    const label = `${action.icon} ${action.label}`;
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
      fontSize: '9px',
      color: '#fff5dc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const statText = scene.add.text(0, 7, action.statValue, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = scene.add.zone(0, 0, badgeW + 8, 32)
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
  for (let idx = 0; idx < unlockedCount; idx++) {
    const slot = scene.gs.dungeonSlots?.[idx];
    if (!slot?.roomType) continue;

    const actCell = scene.boardLayout.cellsByIdx.get(idx);
    const cx = actCell?.center.x ?? 0;
    const cy = actCell?.center.y ?? 0;
    _addRoomActivityAura(scene, c, cx, cy, slot, idx);
  }
}

// ─── drawDungeonRoomAlcoves ───────────────────────────────────────────────────

export function drawDungeonRoomAlcoves(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  _unlockedCount: number,
): void {
  for (const [idx, alcCell] of scene.boardLayout.cellsByIdx) {
    _drawDungeonRoomAlcove(scene, g, alcCell.rect.x, alcCell.rect.y, idx, alcCell.isUnlocked);
  }
}
