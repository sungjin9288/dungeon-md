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
import { getReducedMotion } from '../utils/reducedMotion';
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
  // Phase D: Full-width top banner — clearer "침입문" label, bigger arch gate,
  // downward chevrons showing where invaders breach.
  const { boardRect } = scene.boardLayout;
  const bx  = boardRect.x + 3;
  const bw  = boardRect.w - 6;
  const top = boardRect.y + 3;
  const btm = boardRect.y + (scene.boardLayout.entrance.y - boardRect.y) * 2 + 4;
  const bannerH = btm - top;

  // Red threat glow fill
  g.fillStyle(0x3a0808, 0.96);
  g.fillRoundedRect(bx, top, bw, bannerH, 10);
  g.fillStyle(accent, 0.14);
  g.fillRoundedRect(bx, top, bw, bannerH, 10);
  // Highlight top rim
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(bx + 4, top + 3, bw - 8, 6, 4);
  // Border
  g.lineStyle(2, accent, 0.60);
  g.strokeRoundedRect(bx, top, bw, bannerH, 10);

  // Arch gate symbol — centred, slightly bigger than before
  const gR = 14;
  g.fillStyle(0x050302, 0.92);
  g.fillCircle(x, y, gR);
  g.fillRoundedRect(x - gR + 2, y, (gR - 2) * 2, gR + 4, 4);
  g.lineStyle(2, accent, 0.80);
  g.strokeCircle(x, y, gR);
  // Inner arch highlight
  g.lineStyle(1, 0xffffff, 0.16);
  g.strokeCircle(x, y, gR - 4);

  // Downward threat chevrons (invaders pour downward)
  g.lineStyle(2.2, accent, 0.82);
  for (let k = 0; k < 3; k++) {
    const cy2 = y + 2 + k * 6;
    g.lineBetween(x - 7, cy2, x, cy2 + 5);
    g.lineBetween(x + 7, cy2, x, cy2 + 5);
  }

  // Labels — left and right of the banner
  c.add(scene.add.text(bx + 12, y, '침입문', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: '#ffb8b8',
    fontStyle: 'bold',
    stroke: '#1a0000', strokeThickness: 4,
  }).setOrigin(0, 0.5).setAlpha(0.98).setDepth(3));

  // Threat sub-label right side
  c.add(scene.add.text(bx + bw - 12, y, '▼ 침략', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ff8888',
    fontStyle: 'bold',
    stroke: '#1a0000', strokeThickness: 3,
  }).setOrigin(1, 0.5).setAlpha(0.80).setDepth(3));

  // Phase D motion: entrance "breach" pulse (tween on a pre-built ring graphic)
  const reducedMotion = getReducedMotion();
  if (!reducedMotion) {
    const pulse = scene.add.graphics();
    pulse.lineStyle(2.5, accent, 0.56);
    pulse.strokeCircle(x, y, gR + 2);
    pulse.lineStyle(1, accent, 0.28);
    pulse.strokeCircle(x, y, gR + 6);
    c.add(pulse);
    scene.tweens.add({
      targets: pulse,
      scaleX: 1.30,
      scaleY: 1.30,
      alpha: 0,
      duration: 1400,
      repeat: -1,
      ease: 'Sine.easeOut',
      onRepeat: () => {
        pulse.setScale(1).setAlpha(0.56);
      },
    });
  }
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
  // Phase D: readiness-linked heart glow.
  // Low readiness (<40) → alarmed red; mid (40-70) → amber; high (>70) → calm gold.
  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const dungeonMetrics = calculateDungeonMetrics(scene.gs, unlockedSlots);
  const readiness = dungeonMetrics.readiness;
  const accent = readiness >= 70 ? CASUAL.GOLD
    : readiness >= 40 ? 0xffaa22
    : 0xff5544;

  const glowAlphaBase = readiness >= 70 ? 0.10
    : readiness >= 40 ? 0.15
    : 0.22;   // more alarmed = stronger glow

  // Full-width bottom plinth — protected core, the thing under threat.
  const { boardRect } = scene.boardLayout;
  const bx       = boardRect.x + 3;
  const bw       = boardRect.w - 6;
  const plinthTop = y - 20;
  const plinthBtm = boardRect.y + boardRect.h - 3;
  const plinthH   = plinthBtm - plinthTop;

  // Plinth background — darker stone with accent tint
  g.fillStyle(readiness >= 70 ? 0x2a1a00 : readiness >= 40 ? 0x2a1400 : 0x2a0808, 0.96);
  g.fillRoundedRect(bx, plinthTop, bw, plinthH, 10);
  g.fillStyle(accent, glowAlphaBase);
  g.fillRoundedRect(bx, plinthTop, bw, plinthH, 10);
  // Highlight rim
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(bx + 4, plinthTop + 3, bw - 8, 6, 4);
  // Border
  g.lineStyle(2, accent, readiness >= 70 ? 0.50 : readiness >= 40 ? 0.60 : 0.72);
  g.strokeRoundedRect(bx, plinthTop, bw, plinthH, 10);
  // Top seam line
  g.lineStyle(1.5, accent, 0.42);
  g.lineBetween(bx + 8, plinthTop, bx + bw - 8, plinthTop);

  // Core orb — larger in Phase D, radius 16
  const oR = 16;
  g.fillStyle(0x050302, 0.90);
  g.fillCircle(x, y, oR);
  // Outer glow rings
  g.fillStyle(accent, glowAlphaBase * 1.6);
  g.fillCircle(x, y, oR + 7);
  g.fillStyle(accent, glowAlphaBase * 0.9);
  g.fillCircle(x, y, oR + 14);
  // Orb fill
  g.fillStyle(accent, 0.22);
  g.fillCircle(x, y, oR);
  // Ring borders
  g.lineStyle(2, accent, readiness >= 70 ? 0.72 : 0.85);
  g.strokeCircle(x, y, oR);
  g.lineStyle(1, 0xffffff, 0.20);
  g.strokeCircle(x, y, oR - 5);
  // Core bright dot
  g.fillStyle(accent, 0.88);
  g.fillCircle(x, y, 5);
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(x - 2, y - 2, 2.2);

  // Labels
  c.add(scene.add.text(bx + 12, y, '심장부', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffaa44' : '#ff7766',
    fontStyle: 'bold',
    stroke: '#1a1002', strokeThickness: 4,
  }).setOrigin(0, 0.5).setAlpha(0.98).setDepth(3));

  // Readiness sub-label right side
  const readinessLabel = readiness >= 70 ? '✦ 수호' : readiness >= 40 ? '△ 경계' : '! 위협';
  c.add(scene.add.text(bx + bw - 12, y, readinessLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readiness >= 70 ? '#ffd24a' : readiness >= 40 ? '#ffbb55' : '#ff8866',
    fontStyle: 'bold',
    stroke: '#1a1002', strokeThickness: 3,
  }).setOrigin(1, 0.5).setAlpha(0.84).setDepth(3));

  // Phase D motion: heart glow pulse tied to readiness — alarmed = faster pulse
  const reducedMotion = getReducedMotion();
  if (!reducedMotion) {
    const glowPulse = scene.add.graphics();
    glowPulse.lineStyle(2, accent, 0.52);
    glowPulse.strokeCircle(x, y, oR + 2);
    glowPulse.lineStyle(1, accent, 0.24);
    glowPulse.strokeCircle(x, y, oR + 8);
    c.add(glowPulse);
    // Faster pulse when readiness is low (more alarmed feel)
    const pulseDuration = readiness >= 70 ? 2200 : readiness >= 40 ? 1600 : 1000;
    scene.tweens.add({
      targets: glowPulse,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: 0,
      duration: pulseDuration,
      repeat: -1,
      ease: 'Sine.easeOut',
      onRepeat: () => {
        glowPulse.setScale(1).setAlpha(0.52);
      },
    });
  }
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
  // Chunky brown edge frame on top (rounded stroke hides the art's square corners).
  g.lineStyle(7, CASUAL.EDGE, 1);
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

    // Floor label chip — floats above the band's top seam.
    // labelPos.y = bandTop (the top edge of this band).
    // Chip is centred on that y so it straddles the gap between bands,
    // keeping it clear of cell content.  depth 12/13 so it sits above cells.
    const chipX = labelPos.x;
    const chipY = labelPos.y;   // = bandTop
    const chipW = 38;
    const chipH = 22;
    // Use a separate graphics at depth 12 so it draws over band fill and cells
    const chipG = scene.add.graphics().setDepth(12);
    // Chip shadow
    chipG.fillStyle(CASUAL.SHADOW, 0.60);
    chipG.fillRoundedRect(chipX - chipW / 2 + 2, chipY - chipH / 2 + 2, chipW, chipH, 6);
    // Chip body — slightly lighter stone
    chipG.fillStyle(CASUAL.EDGE, 1);
    chipG.fillRoundedRect(chipX - chipW / 2, chipY - chipH / 2, chipW, chipH, 6);
    chipG.fillStyle(0xffffff, 0.10);
    chipG.fillRoundedRect(chipX - chipW / 2 + 3, chipY - chipH / 2 + 3, chipW - 6, 4, 3);
    // Chip border
    chipG.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.82);
    chipG.strokeRoundedRect(chipX - chipW / 2, chipY - chipH / 2, chipW, chipH, 6);
    c.add(chipG);
    // Label text — large and bold, clearly legible
    c.add(scene.add.text(chipX, chipY, label, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#f0e6c8', fontStyle: 'bold',
      stroke: '#0a0806', strokeThickness: 3,
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
    g.fillStyle(CASUAL.SHADOW, 0.30);
    g.fillRoundedRect(cx + 1, cy + 3, cw, ch, 10);
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
    // Accent border — thicker for built/broken to pop
    g.lineStyle(isBroken || isBuilt ? 3 : 2, borderC, borderA);
    g.strokeRoundedRect(cx, cy, cw, ch, 10);
  }
  void slotW; void slotH; // referenced by drawBattleSlot callers via boardLayout

  // ── Narrative anchors (entrance gate + heart core) ────────────────────────
  if (layoutRoute.length > 0) {
    drawDungeonEntranceGate(scene, c, g, entrance.x, entrance.y, CASUAL.RED);
    drawDungeonHeartCore(scene, c, g, heart.x, heart.y, CASUAL.GOLD);
  }
}
