/**
 * SummonShowcase.ts — collection showcase panel renderers.
 * All functions take (scene, ...) — no `this` usage.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { RARITIES, RARITY_COLORS } from '../data/summonPools';
import { getCollectionSummary } from './SummonShared';

// ─── drawCollectionShowcase ───────────────────────────────────────────────────

export function drawCollectionShowcase(scene: Phaser.Scene): void {
  const gs      = loadGameState();
  const summary = getCollectionSummary(gs);
  const g       = scene.add.graphics().setDepth(2);

  const progress = summary.total > 0 ? summary.owned / summary.total : 0;
  const barW     = 92;

  drawShowcasePanel(g, 14, 78, 112, 78, 0x2b1a09, CASUAL.PURPLE);
  scene.add.text(28, 91, '도감 수집', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setDepth(6);
  scene.add.text(28, 109, `${summary.owned}/${summary.total}`, {
    fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setDepth(6);

  const pg = scene.add.graphics().setDepth(6);
  pg.fillStyle(CASUAL.PANEL_SOFT, 1);
  pg.fillRoundedRect(28, 134, barW, 7, 4);
  pg.fillStyle(CASUAL.GOLD, 1);
  pg.fillRoundedRect(28, 134, Phaser.Math.Clamp(barW * progress, 3, barW), 7, 4);
  pg.lineStyle(1, CASUAL.EDGE_SOFT, 0.6);
  pg.strokeRoundedRect(28, 134, barW, 7, 4);

  drawShowcasePanel(g, CANVAS_WIDTH - 126, 78, 112, 78, 0x261022, CASUAL.RED);
  scene.add.text(CANVAS_WIDTH - 112, 91, '레어 획득', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setDepth(6);
  scene.add.text(CANVAS_WIDTH - 112, 111, `E ${summary.epics}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
  }).setDepth(6);
  scene.add.text(CANVAS_WIDTH - 60, 111, `L ${summary.legends}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
  }).setDepth(6);
  scene.add.text(CANVAS_WIDTH - 112, 134, `${summary.totalPulls} pulls`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setDepth(6);

  drawRecentPullChips(scene, summary.recent);
}

// ─── drawShowcasePanel ────────────────────────────────────────────────────────

export function drawShowcasePanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  _bg: number,
  border: number,
): void {
  g.fillStyle(CASUAL.SHADOW, 0.18);
  g.fillRoundedRect(x + 2, y + 4, w, h, 12);
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(x, y, w, h, 12);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(x + 6, y + 5, w - 12, 6, 3);
  g.lineStyle(3, border, 1);
  g.strokeRoundedRect(x, y, w, h, 12);
}

// ─── drawRecentPullChips ──────────────────────────────────────────────────────

export function drawRecentPullChips(
  scene: Phaser.Scene,
  recent: NonNullable<ReturnType<typeof loadGameState>['summonHistory']>,
): void {
  const cx = CANVAS_WIDTH / 2;
  const y  = 162;
  const title = recent.length > 0 ? '최근 획득' : '첫 소환 보상 대기';
  scene.add.text(cx, y - 12, title, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setDepth(6);

  const chips = recent.slice(0, 3);
  if (chips.length === 0) {
    const emptyG = scene.add.graphics().setDepth(5);
    emptyG.fillStyle(0x1d1106, 0.86);
    emptyG.fillRoundedRect(cx - 53, y - 1, 106, 20, 10);
    emptyG.lineStyle(1, 0x7a55ff, 0.35);
    emptyG.strokeRoundedRect(cx - 53, y - 1, 106, 20, 10);
    scene.add.text(cx, y + 9, 'NEW 카드팩 OPEN', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ffd86b',
    }).setOrigin(0.5).setDepth(6);
    return;
  }

  const startX = cx - ((chips.length - 1) * 42) / 2;
  chips.forEach((rec, i) => {
    const def = MONSTER_DEFS[rec.monsterId as MonsterId];
    if (!def) return;
    const rarityIdx = RARITIES.indexOf(rec.rarity);
    const color     = RARITY_COLORS[rarityIdx] ?? 0x8866ff;
    const x         = startX + i * 42;
    const chipG     = scene.add.graphics().setDepth(5);
    chipG.fillStyle(0x1d1106, 0.92);
    chipG.fillRoundedRect(x - 17, y - 2, 34, 24, 9);
    chipG.lineStyle(1.2, color, 0.8);
    chipG.strokeRoundedRect(x - 17, y - 2, 34, 24, 9);
    chipG.fillStyle(color, rec.isNew ? 0.24 : 0.12);
    chipG.fillCircle(x + 11, y + 3, rec.isNew ? 4 : 2);
    scene.add.text(x, y + 9, def.emoji, {
      fontFamily: 'sans-serif', fontSize: '15px',
    }).setOrigin(0.5).setDepth(6);
  });
}
