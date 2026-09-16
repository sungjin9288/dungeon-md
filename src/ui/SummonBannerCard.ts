/**
 * SummonBannerCard — banner card rendering for SummonScene.
 * Extracted from SummonScene.buildBannerCard (~218-321).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { MONSTER_DEFS } from '../data/monsters';
import { getBannerTimeLeft, type SeasonBanner } from '../data/banners';
import { addFramedPanel } from './GameUiPrimitives';

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

  const frame = addFramedPanel(scene, {
    x: BX,
    y: topY,
    w: BW,
    h: BANER_H,
    radius: 8,
    fillColor: DUNGEON_UI.STONE,
    borderColor: banner.borderColor,
    borderAlpha: 0.75,
    accentColor: banner.borderColor,
    accentAlpha: 0.9,
    glowColor: banner.glowColor,
    glowOpacity: 0.03,
    shadowOpacity: 0.55,
  });
  container.add([frame.shadow, frame.panel, frame.glow]);

  // ── Season badge (top-left) ───────────────────────────────────
  const badgeBg = scene.add.graphics();
  badgeBg.fillStyle(DUNGEON_UI.SOOT, 0.92);
  badgeBg.fillRoundedRect(BX + 10, topY + 7, 72, 18, 5);
  badgeBg.lineStyle(1, banner.borderColor, 0.5);
  badgeBg.strokeRoundedRect(BX + 10, topY + 7, 72, 18, 5);
  container.add(badgeBg);
  container.add(scene.add.text(BX + 46, topY + 16, banner.subname, {
    fontFamily: 'sans-serif', fontSize: '10px', color: banner.accentCss, fontStyle: 'bold',
  }).setOrigin(0.5));

  // ── Banner name ───────────────────────────────────────────────
  container.add(scene.add.text(BX + 16, topY + 30, banner.name, {
    fontFamily: 'sans-serif', fontSize: '14px',
    color: banner.accentCss, fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  // ── Description ───────────────────────────────────────────────
  container.add(scene.add.text(BX + 16, topY + 50, banner.description, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  // ── Countdown (bottom-left) ───────────────────────────────────
  const timeText = scene.add.text(BX + 16, topY + BANER_H - 12, getBannerTimeLeft(banner), {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
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

    // Small contract portraits stay secondary to the banner message.
    const eg = scene.add.graphics();
    eg.fillStyle(DUNGEON_UI.SOOT, 0.88);
    eg.fillCircle(ex + 14, ey, 16);
    eg.lineStyle(1, banner.borderColor, 0.45);
    eg.strokeCircle(ex + 14, ey, 16);
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
  boostBg.fillStyle(DUNGEON_UI.SOOT, 0.94);
  boostBg.fillRoundedRect(BX + BW - 72, topY + 6, 62, 18, 9);
  boostBg.lineStyle(1, banner.borderColor, 0.6);
  boostBg.strokeRoundedRect(BX + BW - 72, topY + 6, 62, 18, 9);
  container.add(boostBg);
  container.add(scene.add.text(BX + BW - 41, topY + 15, `피처드 ${boostPct}%↑`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: banner.accentCss, fontStyle: 'bold',
  }).setOrigin(0.5));
}
