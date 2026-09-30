/**
 * HomeBoardScenery — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import { getDungeonRoomCount } from '../data/dungeonPlan';
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CASUAL } from '../constants/colors';
import { calculateDungeonMetrics } from '../data/dungeonMetrics';
import { bakeDungeonBackdrop } from '../art/DungeonBackdrop';

const LAIR_STONE = 0x080b0a;
const LAIR_IRON = 0x2b2a24;
const LAIR_BRASS = 0xa98245;
const LAIR_PARCHMENT = '#e8d5ae';

// ─── Entrance gate ─────────────────────────────────────────────────────────────

export function drawDungeonEntranceGate(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
): void {
  const unlockedSlots = getDungeonRoomCount(scene.gs);
  const readiness = calculateDungeonMetrics(scene.gs, unlockedSlots).readiness;
  const statusLabel = readiness >= 80 ? '수비선 안정' : '침입 경로 경계';
  const statusColor = readiness >= 80 ? CASUAL.GREEN : accent;
  const archW = 82;
  const archH = 31;

  // A cut-stone mouth opens directly into the route. It is architecture, not a card.
  g.fillStyle(LAIR_STONE, 0.92);
  g.fillRoundedRect(x - archW / 2, y - 9, archW, archH, 18);
  g.fillStyle(statusColor, 0.16);
  g.fillRoundedRect(x - 27, y - 4, 54, archH - 2, 15);
  g.fillStyle(0x020302, 0.98);
  g.fillRoundedRect(x - 19, y, 38, archH - 5, 13);
  g.lineStyle(3, LAIR_IRON, 0.94);
  g.beginPath();
  g.arc(x, y + 13, 27, Math.PI, Math.PI * 2);
  g.strokePath();
  g.lineBetween(x - 27, y + 13, x - 27, y + 22);
  g.lineBetween(x + 27, y + 13, x + 27, y + 22);
  g.lineStyle(2, statusColor, 0.72);
  g.lineBetween(x, y + 11, x, y + 30);
  g.fillStyle(statusColor, 0.84);
  g.fillTriangle(x - 5, y + 25, x + 5, y + 25, x, y + 31);

  c.add(scene.add.text(x - 50, y + 5, '침입 경로', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: LAIR_PARCHMENT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5).setDepth(3));
  c.add(scene.add.text(x + 50, y + 5, statusLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: `#${statusColor.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(3));
}

// ─── Heart core ────────────────────────────────────────────────────────────────

export function drawDungeonHeartCore(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  _accent: number,
): void {
  const unlockedSlots = getDungeonRoomCount(scene.gs);
  const dungeonMetrics = calculateDungeonMetrics(scene.gs, unlockedSlots);
  const readiness = dungeonMetrics.readiness;
  const accent = readiness >= 70 ? CASUAL.GOLD
    : readiness >= 40 ? 0xffaa22
    : 0xff5544;

  const altarW = 184;
  const coreX = x - 58;
  g.fillStyle(0x020302, 0.86);
  g.fillRoundedRect(x - altarW / 2, y - 17, altarW, 34, 13);
  g.lineStyle(2, LAIR_IRON, 0.92);
  g.strokeRoundedRect(x - altarW / 2, y - 17, altarW, 34, 13);
  g.lineStyle(1, LAIR_BRASS, 0.54);
  g.strokeRoundedRect(x - altarW / 2 + 5, y - 12, altarW - 10, 24, 9);

  g.fillStyle(accent, 0.10);
  g.fillCircle(coreX, y, 20);
  g.lineStyle(2, accent, 0.84);
  g.strokeCircle(coreX, y, 13);
  g.fillStyle(accent, 0.90);
  g.fillCircle(coreX, y, 6);
  g.fillTriangle(coreX - 6, y + 7, coreX + 6, y + 7, coreX, y + 16);

  c.add(scene.add.text(x - 28, y - 7, '심장부', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffaa44' : '#ff7766',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(3));
  const readinessLabel = readiness >= 70 ? '✦ 수호' : readiness >= 40 ? '△ 경계' : '! 위협';
  c.add(scene.add.text(x - 28, y + 8, `${readinessLabel} · 준비도 ${readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffbb55' : '#ff8866',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(3));
}

// ─── Map backdrop ──────────────────────────────────────────────────────────────

export function drawDungeonMapBackdrop(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  _unlockedCount: number,
): void {
  const { boardRect, floors, entrance, heart, route: layoutRoute } = scene.boardLayout;
  const mapX = boardRect.x;
  const mapY = boardRect.y;
  const mapW = boardRect.w;
  const mapH = boardRect.h;

  // ── Painted illustrated dungeon backdrop fills the board interior ──────────
  // Canvas-baked (stone masonry, radial torch glows, descending arches, heart
  // glow) — a real painted shaft, not flat fills. Sits behind every element.
  const inX = mapX + 3, inY = mapY + 3, inW = mapW - 6, inH = mapH - 6;
  const bdKey = bakeDungeonBackdrop(
    scene, `dungeonBackdrop_${Math.round(inW)}x${Math.round(inH)}`,
    Math.round(inW * 2), Math.round(inH * 2),
    'bg-dungeon-shaft',
  );
  const backdrop = scene.add.image(inX, inY, bdKey).setOrigin(0, 0).setDisplaySize(inW, inH);
  c.add(backdrop);
  c.sendToBack(backdrop);
  // Thin iron edge frames the viewport without turning it into a dashboard panel.
  g.lineStyle(1.5, LAIR_IRON, 0.72);
  g.strokeRoundedRect(mapX + 3.5, mapY + 3.5, mapW - 7, mapH - 7, 12);

  // ── Entrance strip — drawn by drawDungeonEntranceGate (skip pre-fill here) ──
  // Just draw a bottom seam for the entrance → B1 transition
  const entranceBtmY = entrance.y + (entrance.y - mapY);
  g.lineStyle(1, CASUAL.RED, 0.30);
  g.lineBetween(mapX + 8, entranceBtmY, mapX + mapW - 8, entranceBtmY);

  // ── Heart strip — drawn by drawDungeonHeartCore (skip pre-fill here) ──
  // Just draw a top seam for the B3 → heart transition
  const heartTopY = heart.y - (mapY + mapH - heart.y);
  g.lineStyle(1, CASUAL.GOLD, 0.24);
  g.lineBetween(mapX + 8, heartTopY, mapX + mapW - 8, heartTopY);

  // ── Per-floor depth marks (painted backdrop remains the stone) ────────────
  for (const band of floors) {
    const { bandRect, labelPos } = band;
    // Faint divider seam at the band top — chambers read per descending floor.
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.16);
    g.lineBetween(bandRect.x + 10, bandRect.y, bandRect.x + bandRect.w - 10, bandRect.y);

    const markX = labelPos.x;
    const markY = labelPos.y;
    g.fillStyle(LAIR_STONE, 0.74);
    g.fillRoundedRect(markX - 18, markY - 7, 42, 15, 3);
    g.lineStyle(1, LAIR_BRASS, 0.28);
    g.lineBetween(markX + 26, markY, markX + 50, markY);
    g.fillStyle(LAIR_BRASS, 0.42);
    g.fillCircle(markX + 2, markY, 2);
  }

  // ── Narrative anchors (entrance gate + heart core) ────────────────────────
  if (layoutRoute.length > 0) {
    drawDungeonEntranceGate(scene, c, g, entrance.x, entrance.y, CASUAL.RED);
    drawDungeonHeartCore(scene, c, g, heart.x, heart.y, CASUAL.GOLD);
  }
}
