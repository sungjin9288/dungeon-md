/**
 * HomeBoardScenery — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CASUAL } from '../constants/colors';
import { getUnlockedSlots } from '../data/wisdom';
import { calculateDungeonMetrics } from '../data/dungeonMetrics';
import { bakeDungeonBackdrop } from '../art/DungeonBackdrop';

// ─── Entrance gate ─────────────────────────────────────────────────────────────

export function drawDungeonEntranceGate(
  scene: DungeonHomeScene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
): void {
  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const readiness = calculateDungeonMetrics(scene.gs, unlockedSlots).readiness;
  const statusLabel = readiness >= 80 ? '수비선 안정' : '침입 경로 경계';
  const statusColor = readiness >= 80 ? CASUAL.GREEN : accent;
  const archW = 72;
  const archH = 24;

  // Open arch and route throat: the threat belongs to the shaft, not a dashboard card.
  g.fillStyle(CASUAL.PANEL, 0.78);
  g.fillRoundedRect(x - archW / 2, y - 6, archW, archH, 18);
  g.fillStyle(CASUAL.BG_BOTTOM, 1);
  g.fillRoundedRect(x - 22, y - 2, 44, archH, 16);
  g.lineStyle(2, statusColor, 0.82);
  g.beginPath();
  g.arc(x, y + 12, 23, Math.PI, Math.PI * 2);
  g.strokePath();
  g.lineBetween(x - 23, y + 12, x - 23, y + 22);
  g.lineBetween(x + 23, y + 12, x + 23, y + 22);
  g.lineStyle(2, statusColor, 0.72);
  g.lineBetween(x, y + 13, x, y + 30);
  g.fillStyle(statusColor, 0.84);
  g.fillTriangle(x - 5, y + 25, x + 5, y + 25, x, y + 31);

  c.add(scene.add.text(x - 48, y + 5, '침입문', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: '#f2e7d0',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5).setDepth(3));
  c.add(scene.add.text(x + 48, y + 5, statusLabel, {
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
  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const dungeonMetrics = calculateDungeonMetrics(scene.gs, unlockedSlots);
  const readiness = dungeonMetrics.readiness;
  const accent = readiness >= 70 ? CASUAL.GOLD
    : readiness >= 40 ? 0xffaa22
    : 0xff5544;

  const oR = 15;
  g.fillStyle(accent, 0.10);
  g.fillCircle(x, y, oR + 8);
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillCircle(x, y, oR);
  g.lineStyle(2, accent, 0.78);
  g.strokeCircle(x, y, oR);
  g.lineStyle(1, 0xffffff, 0.20);
  g.strokeCircle(x, y, oR - 5);
  g.fillStyle(accent, 0.88);
  g.fillCircle(x, y, 5);

  c.add(scene.add.text(x + 28, y - 7, '던전 심장부', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffaa44' : '#ff7766',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(3));
  const readinessLabel = readiness >= 70 ? '✦ 수호' : readiness >= 40 ? '△ 경계' : '! 위협';
  c.add(scene.add.text(x + 28, y + 8, `${readinessLabel} · 준비도 ${readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffbb55' : '#ff8866',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5).setDepth(3));
  c.add(scene.add.text(x, y + 29, '🔒 잠긴 심도', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#8f91ad', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(3));
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
  // Thin functional edge keeps the painted shaft atmospheric, not clickable.
  g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.48);
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

  // ── Per-floor dividers + label chips (painted backdrop is the stone) ──────
  for (const band of floors) {
    const { bandRect, labelPos, label } = band;
    // Faint divider seam at the band top — chambers read per descending floor.
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.16);
    g.lineBetween(bandRect.x + 10, bandRect.y, bandRect.x + bandRect.w - 10, bandRect.y);

    const chipX = labelPos.x;
    const chipY = labelPos.y;
    const chipG = scene.add.graphics().setDepth(12);
    chipG.lineStyle(1, CASUAL.EDGE_SOFT, 0.62);
    chipG.lineBetween(chipX - 22, chipY, chipX - 10, chipY);
    chipG.lineBetween(chipX + 10, chipY, chipX + 22, chipY);
    c.add(chipG);
    c.add(scene.add.text(chipX, chipY, label, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#d7d8e8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(13));
  }

  // ── Per-room card backing (Phase D: state-legibility pass) ───────────────
  // States: built(green/active), broken(red), locked/excavate(brown dim), empty(faint)
  const { slotW, slotH } = scene.boardLayout;
  for (const [idx, bdCell] of scene.boardLayout.cellsByIdx) {
    const cx = bdCell.rect.x;
    const cy = bdCell.rect.y;
    const cw = bdCell.rect.w;
    const ch = bdCell.rect.h;
    const isUnlocked = bdCell.isUnlocked;
    const slot = scene.gs.dungeonSlots?.[idx];
    const isBuilt   = !!slot?.roomType && slot.hp > 0;
    const isBroken  = !!slot?.roomType && slot.hp <= 0;
    const isEmpty   = isUnlocked && !slot?.roomType;

    // Cells are translucent ALCOVES so the painted dungeon shows through —
    // rooms read as framed openings in the illustration, not opaque cards.
    const cardFill  = isBroken ? 0x2a0808 : isBuilt ? CASUAL.PANEL_SOFT : 0x140c05;
    const cardAlpha = isBuilt ? 0.80 : isBroken ? 0.55 : isEmpty ? 0.20 : 0.32;
    const borderC   = isBroken ? CASUAL.RED : isBuilt ? scene.getRoomActivityColor(slot) : isUnlocked ? CASUAL.GREEN : CASUAL.EDGE_SOFT;
    const borderA   = isBroken ? 0.80 : isBuilt ? 0.70 : isEmpty ? 0.50 : 0.32;

    // Soft drop shadow + translucent recessed alcove face
    g.fillStyle(CASUAL.SHADOW, 0.16);
    g.fillRoundedRect(cx + 1, cy + 2, cw, ch, 10);
    g.fillStyle(cardFill, cardAlpha);
    g.fillRoundedRect(cx, cy, cw, ch, 10);
    // Dark inner top lip — the alcove recedes into the painted rock
    g.fillStyle(CASUAL.SHADOW, 0.26);
    g.fillRoundedRect(cx + 3, cy + 2, cw - 6, 7, 4);

    // State-specific interior hints
    if (isEmpty) {
      g.lineStyle(1, CASUAL.GREEN, 0.20);
      g.lineBetween(cx + 8, cy + ch / 2, cx + cw - 8, cy + ch / 2);
      g.lineBetween(cx + cw / 2, cy + 8, cx + cw / 2, cy + ch - 8);
    } else if (isBroken) {
      g.fillStyle(CASUAL.RED, 0.10);
      g.fillRoundedRect(cx + 2, cy + 2, cw - 4, ch - 4, 8);
    }
    // State edge is functional; labels/icons inside the slot carry the same meaning.
    g.lineStyle(isBroken || isBuilt ? 1.5 : 1, borderC, borderA);
    g.strokeRoundedRect(cx, cy, cw, ch, 10);
  }
  void slotW; void slotH; // referenced by drawBattleSlot callers via boardLayout

  // ── Narrative anchors (entrance gate + heart core) ────────────────────────
  if (layoutRoute.length > 0) {
    drawDungeonEntranceGate(scene, c, g, entrance.x, entrance.y, CASUAL.RED);
    drawDungeonHeartCore(scene, c, g, heart.x, heart.y, CASUAL.GOLD);
  }
}
