/**
 * HomeBoardRoute — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CASUAL } from '../constants/colors';
import { type DungeonSlot } from '../data/wisdom';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { cellCenter } from '../ui/DungeonBoardLayout';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Re-exported so callers outside this module can reference the shape. */
export interface RouteSegmentVisualState {
  readonly accent: number;
  readonly energy: number;
  readonly builtCount: number;
  readonly isBroken: boolean;
  readonly isPlanned: boolean;
}

// ─── Route-network rendering ───────────────────────────────────────────────

export function drawDungeonRouteNetwork(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  unlockedCount: number,
): void {
  const route = getUnlockedRoute(scene, unlockedCount);
  if (route.length === 0) return;

  const polyline = scene.boardLayout.routePolyline;
  if (polyline.length < 2) return;

  const t = scene.theme;

  for (let i = 0; i < polyline.length - 1; i++) {
    fillDungeonRouteTunnel(scene, g, polyline[i], polyline[i + 1], 31, CASUAL.EDGE, 0.5, i);
  }
  for (let i = 0; i < polyline.length - 1; i++) {
    fillDungeonRouteTunnel(scene, g, polyline[i], polyline[i + 1], 23, CASUAL.EDGE_SOFT, 0.85, i + 1);
  }
  for (let i = 0; i < polyline.length - 1; i++) {
    fillDungeonRouteTunnel(scene, g, polyline[i], polyline[i + 1], 12, CASUAL.PANEL_SOFT, 0.6, i + 2);
  }

  for (let i = 0; i < route.length - 1; i++) {
    drawRouteInfrastructureSegment(scene, g, route[i], route[i + 1], i);
  }
  for (let i = 0; i < polyline.length - 1; i++) {
    drawDungeonRouteWallStones(scene, g, polyline[i], polyline[i + 1], i);
  }

  g.lineStyle(1.5, t.panelBorder, 0.12);
  for (let i = 0; i < polyline.length - 1; i++) {
    strokeDungeonRouteSegment(scene, g, polyline[i], polyline[i + 1]);
  }
  for (let i = 0; i < polyline.length - 1; i++) {
    drawRouteSignal(scene, g, polyline[i], polyline[i + 1], i);
  }

  route.forEach((idx, routeIdx) => {
    const center = getSlotCenter(scene, idx);
    drawRouteJunction(scene, c, g, center.x, center.y, routeIdx + 1, idx, unlockedCount);
  });
}

export function fillDungeonRouteTunnel(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  color: number,
  alpha: number,
  index: number,
): void {
  const passage = getRoutePassage(scene, from, to);
  const dx = passage.to.x - passage.from.x;
  const dy = passage.to.y - passage.from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const wobble = index % 2 === 0 ? 3 : -3;
  const mid = {
    x: (passage.from.x + passage.to.x) / 2 + px * wobble,
    y: (passage.from.y + passage.to.y) / 2 + py * wobble,
  };
  const half = width / 2;
  const innerHalf = Math.max(4, half - 3);

  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(passage.from.x + px * half - ux * 2, passage.from.y + py * half - uy * 2);
  g.lineTo(mid.x + px * (half + 2), mid.y + py * (half + 2));
  g.lineTo(passage.to.x + px * innerHalf + ux * 2, passage.to.y + py * innerHalf + uy * 2);
  g.lineTo(passage.to.x - px * half + ux * 2, passage.to.y - py * half + uy * 2);
  g.lineTo(mid.x - px * (half + 1), mid.y - py * (half + 1));
  g.lineTo(passage.from.x - px * innerHalf - ux * 2, passage.from.y - py * innerHalf - uy * 2);
  g.closePath();
  g.fillPath();
}

export function drawDungeonRouteWallStones(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  index: number,
): void {
  const passage = getRoutePassage(scene, from, to);
  const dx = passage.to.x - passage.from.x;
  const dy = passage.to.y - passage.from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const count = Math.max(2, Math.floor(len / 28));

  for (let i = 1; i <= count; i++) {
    const tpos = i / (count + 1);
    const cx = passage.from.x + dx * tpos;
    const cy = passage.from.y + dy * tpos;
    const offset = i % 2 === 0 ? 9 : -9;
    const sx = cx + px * offset;
    const sy = cy + py * offset;
    const stoneW = Math.abs(dx) >= Math.abs(dy) ? 11 : 7;
    const stoneH = Math.abs(dx) >= Math.abs(dy) ? 6 : 11;
    g.fillStyle(CASUAL.EDGE_SOFT, 0.22 + (index % 2) * 0.04);
    g.fillRoundedRect(sx - stoneW / 2, sy - stoneH / 2, stoneW, stoneH, 3);
    g.lineStyle(1, 0xffffff, 0.18);
    g.lineBetween(sx - px * 3 - ux * 2, sy - py * 3 - uy * 2, sx + px * 3 + ux * 2, sy + py * 3 + uy * 2);
  }
}

export function drawRouteInfrastructureSegment(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  fromIdx: number,
  toIdx: number,
  index: number,
): void {
  const state = getRouteSegmentVisualState(scene, fromIdx, toIdx);
  const passage = getRoutePassage(scene, getSlotCenter(scene, fromIdx), getSlotCenter(scene, toIdx));
  const dx = passage.to.x - passage.from.x;
  const dy = passage.to.y - passage.from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const railOffset = 8 + (index % 2);
  const railAlpha = state.isPlanned ? 0.12 : state.isBroken ? 0.24 : 0.16 + state.energy * 0.22;
  const plateAlpha = state.isPlanned ? 0.10 : state.isBroken ? 0.17 : 0.12 + state.energy * 0.13;

  strokeRouteOffsetLine(g, passage, px, py, railOffset, state.accent, railAlpha, 2);
  strokeRouteOffsetLine(g, passage, px, py, -railOffset, state.accent, railAlpha * 0.78, 2);
  strokeRouteOffsetLine(g, passage, px, py, 0, 0xffffff, state.isPlanned ? 0.035 : 0.05 + state.energy * 0.05, 1);

  const plateCount = Math.max(1, Math.floor(len / 38));
  for (let i = 1; i <= plateCount; i++) {
    const ratio = i / (plateCount + 1);
    const cx = passage.from.x + dx * ratio;
    const cy = passage.from.y + dy * ratio;
    const plateLength = state.isPlanned ? 10 : 13 + state.energy * 4;
    const plateThickness = state.isPlanned ? 4 : 5.5;
    fillRouteServicePlate(g, cx, cy, ux, uy, px, py, plateLength, plateThickness, state.accent, plateAlpha);
    g.fillStyle(0xffffff, state.isPlanned ? 0.05 : 0.07 + state.energy * 0.07);
    g.fillCircle(cx - ux * 2, cy - uy * 2, 1.1);
  }

  drawRouteTerminal(g, passage.from.x, passage.from.y, ux, uy, px, py, state, 1);
  drawRouteTerminal(g, passage.to.x, passage.to.y, -ux, -uy, px, py, state, 2);
}

export function getRouteSegmentVisualState(
  scene: DungeonHomeScene,
  fromIdx: number,
  toIdx: number,
): RouteSegmentVisualState {
  const slots = scene.gs.dungeonSlots ?? [];
  const endpoints = [slots[fromIdx], slots[toIdx]].filter((slot): slot is DungeonSlot => !!slot?.roomType);
  const isBroken = endpoints.some(slot => slot.hp <= 0);
  const roomMetrics = endpoints.map(slot => calculateRoomMetrics(scene.gs, slot));
  const readiness = endpoints.length > 0
    ? Math.round(roomMetrics.reduce((sum, metrics) => sum + metrics.readiness, 0) / endpoints.length)
    : 0;
  const threatScore = roomMetrics.reduce((sum, metrics) => sum + metrics.threatScore, 0);
  const accent = isBroken
    ? 0xff5544
    : endpoints.length > 0
      ? getRouteFlowAccent(scene, fromIdx, toIdx)
      : 0x55b88a;
  const activeEnergy = Phaser.Math.Clamp(
    readiness / 100 * 0.68 + Math.min(1, threatScore / 220) * 0.22 + endpoints.length * 0.08,
    0.24,
    1,
  );

  return {
    accent,
    energy: endpoints.length > 0 ? activeEnergy : 0.18,
    builtCount: endpoints.length,
    isBroken,
    isPlanned: endpoints.length === 0,
  };
}

export function strokeRouteOffsetLine(
  g: Phaser.GameObjects.Graphics,
  passage: { from: { x: number; y: number }; to: { x: number; y: number } },
  px: number,
  py: number,
  offset: number,
  color: number,
  alpha: number,
  width: number,
): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(passage.from.x + px * offset, passage.from.y + py * offset);
  g.lineTo(passage.to.x + px * offset, passage.to.y + py * offset);
  g.strokePath();
}

export function fillRouteServicePlate(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  ux: number,
  uy: number,
  px: number,
  py: number,
  length: number,
  thickness: number,
  color: number,
  alpha: number,
): void {
  const halfLength = length / 2;
  const halfThickness = thickness / 2;

  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(cx + ux * halfLength + px * halfThickness, cy + uy * halfLength + py * halfThickness);
  g.lineTo(cx - ux * halfLength + px * halfThickness, cy - uy * halfLength + py * halfThickness);
  g.lineTo(cx - ux * halfLength - px * halfThickness, cy - uy * halfLength - py * halfThickness);
  g.lineTo(cx + ux * halfLength - px * halfThickness, cy + uy * halfLength - py * halfThickness);
  g.closePath();
  g.fillPath();
}

export function drawRouteTerminal(
  g: Phaser.GameObjects.Graphics,
  edgeX: number,
  edgeY: number,
  ux: number,
  uy: number,
  px: number,
  py: number,
  state: RouteSegmentVisualState,
  terminalIndex: number,
): void {
  const cx = edgeX + ux * 8;
  const cy = edgeY + uy * 8;
  const terminalAlpha = state.isPlanned ? 0.18 : state.isBroken ? 0.34 : 0.26 + state.energy * 0.24;

  fillRouteServicePlate(g, cx, cy, ux, uy, px, py, 9, 18, 0x050302, 0.78);
  fillRouteServicePlate(g, cx, cy, ux, uy, px, py, 6, 13, state.accent, terminalAlpha);
  g.lineStyle(1, state.accent, terminalAlpha + 0.08);
  g.strokeCircle(cx, cy, state.builtCount > 0 ? 4.2 : 3.3);
  g.fillStyle(0xffffff, state.isPlanned ? 0.06 : 0.10 + state.energy * 0.06);
  g.fillCircle(cx + px * (terminalIndex % 2 === 0 ? 3 : -3), cy + py * (terminalIndex % 2 === 0 ? 3 : -3), 1.1);
}

export function getUnlockedRoute(
  scene: DungeonHomeScene,
  _unlockedCount: number,
): readonly number[] {
  return scene.boardLayout.route;
}

export function getSlotCenter(
  scene: DungeonHomeScene,
  idx: number,
): { x: number; y: number } {
  return cellCenter(scene.boardLayout, idx);
}

export function strokeDungeonRouteSegment(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const passage = getRoutePassage(scene, from, to);
  g.beginPath();
  g.moveTo(passage.from.x, passage.from.y);
  g.lineTo(passage.to.x, passage.to.y);
  g.strokePath();
}

export function getRoutePassage(
  scene: DungeonHomeScene,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const halfW = scene.boardLayout.slotW / 2 - 2;
  const halfH = scene.boardLayout.slotH / 2 - 2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = Math.sign(dx) || 1;
    return {
      from: { x: from.x + dir * halfW, y: from.y },
      to: { x: to.x - dir * halfW, y: to.y },
    };
  }

  const dir = Math.sign(dy) || 1;
  return {
    from: { x: from.x, y: from.y + dir * halfH },
    to: { x: to.x, y: to.y - dir * halfH },
  };
}

export function drawRouteSignal(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  index: number,
): void {
  const passage = getRoutePassage(scene, from, to);
  const x = Math.round((passage.from.x + passage.to.x) / 2);
  const y = Math.round((passage.from.y + passage.to.y) / 2);
  const dx = Math.sign(passage.to.x - passage.from.x);
  const dy = Math.sign(passage.to.y - passage.from.y);
  const pulseAlpha = 0.18 + (index % 2) * 0.08;
  drawRouteChevron(scene, g, x, y, dx, dy, pulseAlpha);
}

export function drawRouteChevron(
  scene: DungeonHomeScene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  dx: number,
  dy: number,
  alpha: number,
): void {
  const accent = scene.theme.panelBorder;
  g.fillStyle(accent, alpha);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx >= 0 ? 1 : -1;
    g.fillTriangle(x + dir * 5, y, x - dir * 3, y - 4, x - dir * 3, y + 4);
  } else {
    const dir = dy >= 0 ? 1 : -1;
    g.fillTriangle(x, y + dir * 5, x - 4, y - dir * 3, x + 4, y - dir * 3);
  }
  g.fillStyle(0xffffff, alpha * 0.38);
  g.fillCircle(x, y, 1.2);
}

export function addDungeonRouteFlow(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const route = getUnlockedRoute(scene, unlockedCount);
  if (route.length < 2) return;

  const polyline = scene.boardLayout.routePolyline;
  if (polyline.length < 2) return;

  const reducedMotion = getReducedMotion();

  const BASE_DURATION = 1800;
  const PARTICLE_COUNT = 3;
  const STAGGER_MS = 620;

  for (let i = 0; i < polyline.length - 1; i++) {
    const fromPt = polyline[i];
    const toPt   = polyline[i + 1];
    const passage = getRoutePassage(scene, fromPt, toPt);
    const dx = passage.to.x - passage.from.x;
    const dy = passage.to.y - passage.from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const fromIdx = route[Math.min(i - 1, route.length - 1)] ?? route[0] ?? 0;
    const toIdx   = route[Math.min(i, route.length - 1)] ?? route[0] ?? 0;
    const accent = getRouteFlowAccent(scene, fromIdx, toIdx);
    const segDuration = Math.round(BASE_DURATION * (len / 120));

    for (let n = 0; n < PARTICLE_COUNT; n++) {
      const tStatic = (n + 0.5) / PARTICLE_COUNT;
      const sx = passage.from.x + dx * tStatic;
      const sy = passage.from.y + dy * tStatic;
      const signal = scene.add.graphics();
      signal.setPosition(sx, sy);
      paintRouteFlowSignal(signal, ux, uy, accent, 0.56 - n * 0.10);
      c.add(signal);

      if (reducedMotion) continue;
      signal.setPosition(passage.from.x, passage.from.y);
      signal.setAlpha(0.06);
      scene.tweens.add({
        targets: signal,
        x: passage.to.x,
        y: passage.to.y,
        alpha: { from: 0.08, to: 0.68 },
        duration: segDuration,
        delay: i * 160 + n * STAGGER_MS,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          signal.setPosition(passage.from.x, passage.from.y);
          signal.setAlpha(0.06);
        },
      });
    }
  }
}

export function getRouteFlowAccent(
  scene: DungeonHomeScene,
  fromIdx: number,
  toIdx: number,
): number {
  const slots = scene.gs.dungeonSlots ?? [];
  const from = slots[fromIdx];
  const to = slots[toIdx];
  if ((from?.roomType && from.hp <= 0) || (to?.roomType && to.hp <= 0)) return 0xff5544;
  if (from?.roomType) return scene.getRoomActivityColor(from);
  if (to?.roomType) return scene.getRoomActivityColor(to);
  return 0x55b88a;
}

export function paintRouteFlowSignal(
  g: Phaser.GameObjects.Graphics,
  ux: number,
  uy: number,
  accent: number,
  alpha: number,
): void {
  const px = -uy;
  const py = ux;
  g.clear();
  g.fillStyle(accent, alpha * 0.16);
  g.fillCircle(0, 0, 8);
  g.lineStyle(1, accent, alpha * 0.62);
  g.strokeCircle(0, 0, 5);
  g.fillStyle(accent, alpha);
  g.fillTriangle(
    ux * 6,
    uy * 6,
    -ux * 4 + px * 4,
    -uy * 4 + py * 4,
    -ux * 4 - px * 4,
    -uy * 4 - py * 4,
  );
  g.fillStyle(0xffffff, alpha * 0.42);
  g.fillCircle(-ux * 1.5, -uy * 1.5, 1.3);
}

export function drawRouteJunction(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  routeOrder: number,
  slotIdx: number,
  unlockedCount: number,
): void {
  const slot = scene.gs.dungeonSlots?.[slotIdx];
  const isBuilt = !!slot?.roomType && slot.hp > 0;
  const isBroken = !!slot?.roomType && slot.hp <= 0;
  const metrics = slot?.roomType ? calculateRoomMetrics(scene.gs, slot) : null;
  const accent = isBroken ? 0xff5544 : isBuilt ? scene.getRoomActivityColor(slot) : 0x55b88a;
  const alpha = slotIdx < unlockedCount ? 0.58 : 0.22;
  const accessAlpha = isBuilt
    ? 0.16 + Phaser.Math.Clamp((metrics?.readiness ?? 0) / 100, 0, 1) * 0.16
    : 0.10;

  if (slotIdx < unlockedCount) {
    g.lineStyle(1, accent, isBroken ? 0.24 : accessAlpha);
    g.strokeCircle(x, y, 54);
    const couplers = [
      { x: x - 55, y },
      { x: x + 55, y },
      { x, y: y - 55 },
      { x, y: y + 55 },
    ];
    couplers.forEach((p, idx) => {
      g.fillStyle(0x050302, 0.74);
      g.fillCircle(p.x, p.y, idx % 2 === 0 ? 4.6 : 3.8);
      g.fillStyle(accent, isBroken ? 0.22 : accessAlpha + 0.08);
      g.fillCircle(p.x, p.y, idx % 2 === 0 ? 2.5 : 2.1);
    });
  }

  g.fillStyle(0x050806, 0.82);
  g.fillCircle(x, y, 13);
  g.lineStyle(1.2, accent, alpha);
  g.strokeCircle(x, y, 13);
  g.fillStyle(accent, isBuilt ? 0.18 : 0.09);
  g.fillCircle(x, y, 7);

  if (isBuilt || isBroken) {
    const marker = scene.add.text(x, y, String(routeOrder), {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: isBroken ? '#ffb0a0' : '#ffe080',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.66);
    c.add(marker);
  }
}
