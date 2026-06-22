/**
 * SummonBannerCard — banner card rendering for SummonScene.
 * Extracted from SummonScene.buildBannerCard (~218-321).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { MONSTER_DEFS } from '../data/monsters';
import { getBannerTimeLeft, type SeasonBanner } from '../data/banners';
import { getReducedMotion } from '../utils/reducedMotion';

/**
 * Builds a full-width seasonal banner card and adds it to `container`.
 *
 * @param scene     - The active Phaser.Scene (used for `add.*` and `time.*`)
 * @param container - The container to add all created objects to
 * @param banner    - The active SeasonBanner data
 * @param topY      - Absolute Y position of the top edge of the banner card
 */
export function buildBannerCard(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  banner: SeasonBanner,
  topY: number,
): void {
  const BANER_H = 92;
  const BW = CANVAS_WIDTH - 22; // full-width minus margins
  const BX = 11;                // left edge

  // ── Panel background ──────────────────────────────────────────
  const bg = scene.add.graphics();
  bg.fillStyle(banner.bgColor, 1);
  bg.fillRoundedRect(BX, topY, BW, BANER_H, 10);
  container.add(bg);

  // ── Pulsing border (animated via time event) ──────────────────
  const borderG = scene.add.graphics();
  container.add(borderG);
  if (getReducedMotion()) {
    // Static banner border — no perpetual pulse under reduced motion.
    borderG.lineStyle(4, banner.borderColor, 0.27);
    borderG.strokeRoundedRect(BX - 1, topY - 1, BW + 2, BANER_H + 2, 11);
    borderG.lineStyle(1.5, banner.borderColor, 0.9);
    borderG.strokeRoundedRect(BX, topY, BW, BANER_H, 10);
    borderG.lineStyle(1, banner.glowColor, 0.18);
    borderG.lineBetween(BX + 12, topY + 1, BX + BW - 12, topY + 1);
  } else {
    let pulseT = 0;
    scene.time.addEvent({
      delay: 33, repeat: -1,
      callback: () => {
        if (!borderG.active) return;
        pulseT += 0.05;
        const alpha = 0.55 + 0.45 * Math.sin(pulseT * 2.5);
        const glow  = 0.18 + 0.18 * Math.sin(pulseT * 1.8);
        borderG.clear();
        // Outer glow
        borderG.lineStyle(4, banner.borderColor, glow);
        borderG.strokeRoundedRect(BX - 1, topY - 1, BW + 2, BANER_H + 2, 11);
        // Main border
        borderG.lineStyle(1.5, banner.borderColor, alpha);
        borderG.strokeRoundedRect(BX, topY, BW, BANER_H, 10);
        // Inner highlight
        borderG.lineStyle(1, banner.glowColor, glow * 0.5);
        borderG.lineBetween(BX + 12, topY + 1, BX + BW - 12, topY + 1);
      },
    });
  }

  // ── Season badge (top-left) ───────────────────────────────────
  const badgeBg = scene.add.graphics();
  badgeBg.fillStyle(banner.borderColor, 0.25);
  badgeBg.fillRoundedRect(BX + 8, topY + 7, 70, 16, 8);
  container.add(badgeBg);
  container.add(scene.add.text(BX + 43, topY + 15, banner.subname, {
    fontFamily: 'sans-serif', fontSize: '11px', color: banner.accentCss,
  }).setOrigin(0.5));

  // ── Banner name ───────────────────────────────────────────────
  container.add(scene.add.text(BX + 16, topY + 30, banner.name, {
    fontFamily: 'Georgia, serif', fontSize: '14px',
    color: banner.accentCss, fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  // ── Description ───────────────────────────────────────────────
  container.add(scene.add.text(BX + 16, topY + 50, banner.description, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#bbbbbb',
  }).setOrigin(0, 0.5));

  // ── Countdown (bottom-left) ───────────────────────────────────
  const timeText = scene.add.text(BX + 16, topY + BANER_H - 12, getBannerTimeLeft(banner), {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#888888',
  }).setOrigin(0, 0.5);
  container.add(timeText);
  // Live update countdown
  scene.time.addEvent({
    delay: 60_000, repeat: -1,
    callback: () => {
      if (timeText.active) timeText.setText(getBannerTimeLeft(banner));
    },
  });

  // ── Featured monster emojis (right side) ─────────────────────
  const shown = banner.featuredMonsters.slice(0, 4);
  const emojiStartX = CANVAS_WIDTH - 16 - shown.length * 34;
  shown.forEach((mId, idx) => {
    const def = MONSTER_DEFS[mId as keyof typeof MONSTER_DEFS];
    const em  = def?.emoji ?? '👾';
    const ex  = emojiStartX + idx * 34;
    const ey  = topY + BANER_H / 2;

    // Glow circle under emoji
    const eg = scene.add.graphics();
    eg.fillStyle(banner.glowColor, 0.12);
    eg.fillCircle(ex + 14, ey, 16);
    container.add(eg);

    container.add(scene.add.text(ex + 14, ey, em, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5));
  });
  if (banner.featuredMonsters.length > 4) {
    container.add(scene.add.text(CANVAS_WIDTH - 14, topY + BANER_H / 2, `+${banner.featuredMonsters.length - 4}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888888',
    }).setOrigin(1, 0.5));
  }

  // ── Rate boost badge ──────────────────────────────────────────
  const boostPct = Math.round(banner.rateMultiplier * 100);
  const boostBg  = scene.add.graphics();
  boostBg.fillStyle(banner.borderColor, 0.3);
  boostBg.fillRoundedRect(BX + BW - 72, topY + 6, 62, 18, 9);
  container.add(boostBg);
  container.add(scene.add.text(BX + BW - 41, topY + 15, `피처드 ${boostPct}%↑`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: banner.accentCss, fontStyle: 'bold',
  }).setOrigin(0.5));
}
