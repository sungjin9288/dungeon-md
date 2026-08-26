// ─── StagePlaque ──────────────────────────────────────────────────────────────
// Generic stage card renderer and chapter section builder for StageSelectScene.
// Extracted from StageSelectScene.ts (A36) to eliminate 7-chapter duplicated
// plaque / grid / section logic that differed only in colour palette.
//
// Public API
//   drawGenericPlaque          — renders one stage card (locked / uncleared / cleared)
//   drawChapterSection         — renders a chapter divider, header, progress bar + path
//   drawChapterProgressBar     — standalone progress bar; also used by Ch1 header
//   addStarPop                 — animated ★ row (shared by Ch1 plaque + generic plaque)
//   buildJourneyPathPositions  — compute serpentine node positions for a chapter
//   drawJourneyTrail           — draw lit/dim connecting trail between nodes

import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { STAGE_CONFIGS } from '../data/stageProgress';
import type { StageProgress } from '../data/stageProgress';
import { addPanelShadow } from './PanelDepth';
import { getReducedMotion } from '../utils/reducedMotion';

// ── PlaqueTheme ───────────────────────────────────────────────────────────────
// Casual-toy reskin: stage cards are now cream cells on the bright board. Each
// chapter keeps its identity through a single saturated CASUAL *accent* colour
// used for the chunky border + tint; the cell fill is always cream
// (CASUAL.PANEL / PANEL_SOFT). The hex/CSS fields below carry CASUAL values —
// the field *names* are retained because StageSelectScene + drawing helpers
// reference them, but their semantics shifted from "dark fill" → "accent".

export interface PlaqueTheme {
  // Locked state — muted cream cell + soft edge.
  lockedBg:             number;   // cream fill (CASUAL.PANEL_SOFT)
  lockedBorder:         number;   // soft brown edge (CASUAL.EDGE_SOFT)
  lockedLabelColor:     string;   // INK_SOFT
  // Uncleared state — cream cell + chapter accent edge (playable).
  unclearedBg:          number;   // cream fill (CASUAL.PANEL)
  unclearedBorder:      number;   // chapter accent (used as edge tint)
  unclearedHoverBg:     number;   // brighter cream (CASUAL.PANEL)
  unclearedHoverBorder: number;   // chapter accent (brighter on hover)
  unclearedLabelColor:  string;   // INK
  unclearedStarColor:   string;   // empty-star colour (EDGE_SOFT-ish)
  // Cleared state — cream cell + GOLD edge.
  clearedBg:            number;   // cream fill (CASUAL.PANEL)
  clearedBorder:        number;   // CASUAL.GOLD
  clearedLabelColor:    string;   // INK
  starColor:            string;   // earned-star gold (CASUAL_CSS.GOLD-ish)
  // Decoration
  bossEmoji:            string;
  /** chapter accent hex used for boss ring / frontier ring (CASUAL hex) */
  accent:               number;
  /** true → graphics mini bar + text; false → text-only HP% line */
  showHpBar:            boolean;
}

// Empty-star colour on cream — soft brown so blanks read as "not yet earned".
const EMPTY_STAR_CSS = CASUAL_CSS.INK_SOFT;
// Earned-star gold (slightly deeper than fill GOLD so it pops on cream).
const STAR_GOLD_CSS = '#e0a312';

// ── CHAPTER_PLAQUE_THEMES  (index 0 = Ch2, … index 6 = Ch8) ──────────────────
// Cream cells everywhere; chapter identity = the accent edge colour.

export const CHAPTER_PLAQUE_THEMES: PlaqueTheme[] = [
  // [0] Ch2 — emerald green
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.GREEN,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.GREEN_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🦊', accent: CASUAL.GREEN, showHpBar: true,
  },
  // [1] Ch3 — ocean blue
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.BLUE,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.BLUE_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🐲', accent: CASUAL.BLUE, showHpBar: false,
  },
  // [2] Ch4 — blood red
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.RED,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.RED_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '☠️', accent: CASUAL.RED, showHpBar: false,
  },
  // [3] Ch5 — ancient gold
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.GOLD,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.GOLD_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🌟', accent: CASUAL.GOLD, showHpBar: false,
  },
  // [4] Ch6 — royal purple
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.PURPLE,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.PURPLE_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🌟', accent: CASUAL.PURPLE, showHpBar: false,
  },
  // [5] Ch7 — divine gold
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.GOLD,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.GOLD_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🌟', accent: CASUAL.GOLD, showHpBar: false,
  },
  // [6] Ch8 — primordial abyss (purple)
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.PURPLE,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.PURPLE_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🌑', accent: CASUAL.PURPLE_DK, showHpBar: false,
  },
  // [7] Ch9 — 공허 너머 (deep void purple)
  {
    lockedBg: CASUAL.PANEL_SOFT, lockedBorder: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    unclearedBg: CASUAL.PANEL, unclearedBorder: CASUAL.PURPLE,
    unclearedHoverBg: CASUAL.PANEL, unclearedHoverBorder: CASUAL.PURPLE_DK,
    unclearedLabelColor: CASUAL_CSS.INK, unclearedStarColor: EMPTY_STAR_CSS,
    clearedBg: CASUAL.PANEL, clearedBorder: CASUAL.GOLD, clearedLabelColor: CASUAL_CSS.INK,
    starColor: STAR_GOLD_CSS, bossEmoji: '🌌', accent: CASUAL.PURPLE_DK, showHpBar: false,
  },
];

// ── ChapterSectionData ────────────────────────────────────────────────────────

export interface ChapterSectionData {
  num:              number;   // chapter number (2–7)
  name:             string;   // Korean chapter name
  stageCount:       number;
  unlockIdx:        number;   // progress[] index to check (0-based)
  unlockMsg:        string;   // full lock-banner top line
  startIdx:         number;   // first stage 0-based index
  // Y positions
  divY:             number;
  labelY:           number;
  progressBarY:     number;
  bannerY:          number;
  gridStartY:       number;
  // Grid layout
  cols:             number;
  rows:             number;
  bw:               number;
  bh:               number;
  gapX:             number;
  gapY:             number;
  // Colours — casual reskin: divider/banner accents are CASUAL hex; banner fill
  // is always cream. The chapter title keeps a small accent tint, everything
  // else is INK / INK_SOFT on cream.
  activeDivColor:   number;   // chapter accent (divider + title accent pill)
  activeTextColor:  string;   // chapter title text (INK with accent pill)
  lockedDivColor:   number;   // soft brown divider when locked (EDGE_SOFT)
  lockedLabelColor: string;   // locked chapter title (INK_SOFT)
  bannerBg:         number;   // cream banner fill (CASUAL.PANEL_SOFT)
  bannerBorder:     number;   // chapter accent banner edge
  lockedMsgColor:   string;   // lock message (INK_SOFT)
  lockedNameColor:  string;   // chapter name + count line (INK_SOFT / INK)
}

// ── Journey path layout constants ─────────────────────────────────────────────
// Two-column zigzag serpentine. 10 nodes fit in ~424px, 12 nodes in ~512px.
// Nodes alternate left/right column to create a winding path feel.

export const JOURNEY_NODE_W = 62;
export const JOURNEY_NODE_H = 72;
const JOURNEY_ROW_HEIGHT    = 88;  // vertical step per pair-row
const JOURNEY_LEFT_X        = 42;  // left column node top-left X
const JOURNEY_RIGHT_X       = 226; // right column node top-left X

/**
 * Returns top-left {x,y} for each node in a chapter path.
 * Nodes alternate left/right columns going down (zigzag).
 * Even-indexed node in each pair sits in left col, odd in right col.
 * Row direction swaps every pair so the path zigzags.
 */
export function buildJourneyPathPositions(
  stageCount: number,
  startY:     number,
  nodeW:      number = JOURNEY_NODE_W,
  nodeH:      number = JOURNEY_NODE_H,
): { x: number; y: number }[] {
  const leftX  = (CANVAS_WIDTH / 2) - nodeW - 20;  // ~153 for nodeW=62  → use fixed
  const rightX = (CANVAS_WIDTH / 2) + 20;           // ~215 for nodeW=62  → use fixed
  // Use fixed columns for consistency regardless of nodeW
  const colL = JOURNEY_LEFT_X;
  const colR = JOURNEY_RIGHT_X;
  // Suppress nodeH/nodeW unused-param lint (values used externally for trail centering)
  void nodeW; void nodeH;
  void leftX; void rightX;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < stageCount; i++) {
    const pairRow = Math.floor(i / 2);
    const posInPair = i % 2; // 0=first, 1=second of the pair
    const y = startY + pairRow * JOURNEY_ROW_HEIGHT;
    // Alternate which column goes first each pair-row for a true zigzag:
    // pair 0 (rows 0,1): first=left, second=right
    // pair 1 (rows 2,3): first=right, second=left
    // pair 2 (rows 4,5): first=left, second=right ...
    const evenPair = pairRow % 2 === 0;
    const x = (posInPair === 0)
      ? (evenPair ? colL : colR)
      : (evenPair ? colR : colL);
    positions.push({ x, y });
  }
  return positions;
}

/** Compute center points from top-left positions for trail drawing. */
function _pathCenters(
  positions: { x: number; y: number }[],
  nodeW: number = JOURNEY_NODE_W,
  nodeH: number = JOURNEY_NODE_H,
): { cx: number; cy: number }[] {
  return positions.map(({ x, y }) => ({ cx: x + nodeW / 2, cy: y + nodeH / 2 }));
}

/**
 * Draws connecting trail segments between consecutive nodes.
 * Segments up to (not including) frontierLocalIdx are "lit" (bright/gold).
 * Segments from frontierLocalIdx onward are "dim" (muted stone).
 */
export function drawJourneyTrail(
  scene:            Phaser.Scene,
  positions:        { x: number; y: number }[],
  frontierLocalIdx: number,
  accentColor:      number,
): void {
  if (positions.length < 2) return;
  const centers = _pathCenters(positions);
  const trail = scene.add.graphics();

  for (let i = 0; i < centers.length - 1; i++) {
    const { cx: x1, cy: y1 } = centers[i];
    const { cx: x2, cy: y2 } = centers[i + 1];
    const isLit = i < frontierLocalIdx;

    if (isLit) {
      // Lit segment: gold shadow + bright line
      trail.lineStyle(10, CASUAL.SHADOW, 0.35);
      trail.lineBetween(x1, y1, x2, y2);
      trail.lineStyle(6, accentColor, 0.85);
      trail.lineBetween(x1, y1, x2, y2);
    } else {
      // Dim segment: muted stone path
      trail.lineStyle(6, CASUAL.EDGE_SOFT, 0.3);
      trail.lineBetween(x1, y1, x2, y2);
    }
  }

  // Stone-step dots at each cleared node center
  for (let i = 0; i < Math.min(frontierLocalIdx, centers.length); i++) {
    const { cx, cy } = centers[i];
    trail.fillStyle(accentColor, 0.55);
    trail.fillCircle(cx, cy, 4);
  }
}

/** Compute the path height for a given stage count. */
export function journeyPathHeight(stageCount: number): number {
  // pairs = ceil(stageCount / 2), rowGaps = pairs - 1
  const pairs = Math.ceil(stageCount / 2);
  return (pairs - 1) * JOURNEY_ROW_HEIGHT + JOURNEY_NODE_H;
}

// ── CHAPTER_SECTION_DATA  (index 0 = Ch2, … index 6 = Ch8) ───────────────────
// Y positions updated for the vertical journey path layout.
// Ch1 header top: 0, nodes start: 136. Section heights:
//   10-stage chapter: journeyPathHeight(10) = 4*88+72 = 424px + 60px header = 484px
//   12-stage chapter: journeyPathHeight(12) = 5*88+72 = 512px + 60px header = 572px
//    8-stage chapter: journeyPathHeight(8)  = 3*88+72 = 336px + 60px header = 396px
//
// Cumulative section starts (after Ch1 bottom at 136+424=560, +50 gap):
//   Ch2: start 610, Ch3: 1094, Ch4: 1666, Ch5: 2150, Ch6: 2634, Ch7: 3118, Ch8: 3602
//
// gridStartY now stores the path start Y (renamed semantically; value updated).
// cols/rows/bw/bh/gapX/gapY retained in interface for compat but unused.

export const CHAPTER_SECTION_DATA: ChapterSectionData[] = [
  // Ch2 — 10 stages, section start 610, path start 636
  {
    num: 2, name: '구미호 계곡', stageCount: 10,
    unlockIdx: 9, unlockMsg: '⛓ 스테이지 10을 클리어하면 열립니다',
    startIdx: 10,
    divY: 610, labelY: 598, progressBarY: 613, bannerY: 616, gridStartY: 636,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.GREEN, activeTextColor: CASUAL_CSS.GREEN,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.GREEN,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch3 — 12 stages, section start 1094, path start 1120
  {
    num: 3, name: '용왕 해저궁', stageCount: 12,
    unlockIdx: 19, unlockMsg: '⛓ 스테이지 20을 클리어하면 열립니다',
    startIdx: 20,
    divY: 1094, labelY: 1082, progressBarY: 1097, bannerY: 1100, gridStartY: 1120,
    cols: 6, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.BLUE, activeTextColor: CASUAL_CSS.BLUE,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.BLUE,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch4 — 10 stages, section start 1666, path start 1692
  {
    num: 4, name: '저승 관문', stageCount: 10,
    unlockIdx: 31, unlockMsg: '⛓ 스테이지 32를 클리어하면 열립니다',
    startIdx: 32,
    divY: 1666, labelY: 1654, progressBarY: 1669, bannerY: 1672, gridStartY: 1692,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.RED, activeTextColor: CASUAL_CSS.RED,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.RED,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch5 — 10 stages, section start 2150, path start 2176
  {
    num: 5, name: '삼신산', stageCount: 10,
    unlockIdx: 41, unlockMsg: '⛓ 스테이지 42를 클리어하면 열립니다',
    startIdx: 42,
    divY: 2150, labelY: 2138, progressBarY: 2153, bannerY: 2156, gridStartY: 2176,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.GOLD, activeTextColor: CASUAL_CSS.GOLD,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.GOLD,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch6 — 10 stages, section start 2634, path start 2660
  {
    num: 6, name: '영원의 왕좌', stageCount: 10,
    unlockIdx: 51, unlockMsg: '⛓ 스테이지 52를 클리어하면 열립니다',
    startIdx: 52,
    divY: 2634, labelY: 2622, progressBarY: 2637, bannerY: 2640, gridStartY: 2660,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.PURPLE, activeTextColor: CASUAL_CSS.PURPLE,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.PURPLE,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch7 — 10 stages, section start 3118, path start 3144
  {
    num: 7, name: '신계 침공', stageCount: 10,
    unlockIdx: 61, unlockMsg: '⛓ 스테이지 62를 클리어하면 열립니다',
    startIdx: 62,
    divY: 3118, labelY: 3106, progressBarY: 3121, bannerY: 3124, gridStartY: 3144,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.GOLD, activeTextColor: CASUAL_CSS.GOLD,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.GOLD,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch8 — 8 stages, section start 3602, path start 3628 (path bottom ≈ 3964)
  {
    num: 8, name: '원초의 심연', stageCount: 8,
    unlockIdx: 71, unlockMsg: '⛓ 스테이지 72를 클리어하면 열립니다',
    startIdx: 72,
    divY: 3602, labelY: 3590, progressBarY: 3605, bannerY: 3608, gridStartY: 3628,
    cols: 4, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.PURPLE_DK, activeTextColor: CASUAL_CSS.PURPLE,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.PURPLE_DK,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
  // Ch9 — 10 stages, section start 3998, path start 4024 (path bottom ≈ 4448)
  {
    num: 9, name: '공허 너머', stageCount: 10,
    unlockIdx: 79, unlockMsg: '⛓ 스테이지 80을 클리어하면 열립니다',
    startIdx: 80,
    divY: 3998, labelY: 3986, progressBarY: 4001, bannerY: 4004, gridStartY: 4024,
    cols: 5, rows: 2, bw: JOURNEY_NODE_W, bh: JOURNEY_NODE_H, gapX: 0, gapY: 0,
    activeDivColor: CASUAL.PURPLE_DK, activeTextColor: CASUAL_CSS.PURPLE,
    lockedDivColor: CASUAL.EDGE_SOFT, lockedLabelColor: CASUAL_CSS.INK_SOFT,
    bannerBg: CASUAL.PANEL_SOFT, bannerBorder: CASUAL.PURPLE_DK,
    lockedMsgColor: CASUAL_CSS.INK_SOFT, lockedNameColor: CASUAL_CSS.INK,
  },
];

// ── drawGenericPlaque ─────────────────────────────────────────────────────────
// Renders one stage card for Ch2–Ch7 (locked / uncleared / cleared states).

export function drawGenericPlaque(
  scene:    Phaser.Scene,
  idx:      number,
  x:        number,
  y:        number,
  w:        number,
  h:        number,
  theme:    PlaqueTheme,
  progress: StageProgress[],
  onSelect: (idx: number) => void,
  highlightIdx?: number,
): void {
  const prog  = progress[idx];
  const cfg   = STAGE_CONFIGS[idx];
  const label = cfg ? String(cfg.stageNumber) : String(idx + 1);
  const bg    = scene.add.graphics();
  const isFrontier = idx === highlightIdx && !!prog?.unlocked && prog.bestStars === 0;
  const isBoss = !!cfg?.bossWave;
  // Boss/special stages → RED accent edge regardless of chapter accent.
  const bossEdge = CASUAL.RED;

  if (prog?.unlocked) {
    addPanelShadow(scene, x, y, w, h, 6, {
      offsetY: 2, color: CASUAL.SHADOW, opacity: isFrontier ? 0.32 : 0.22,
    });
  }

  if (!prog?.unlocked) {
    // Locked — muted cream cell + soft brown edge + lock glyph.
    bg.fillStyle(CASUAL.SHADOW, 0.16);
    bg.fillRoundedRect(x, y + 2, w, h, 6);
    bg.fillStyle(theme.lockedBg, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(x + 5, y + 4, w - 10, 5, 3);
    bg.lineStyle(2.5, theme.lockedBorder, 0.9);
    bg.strokeRoundedRect(x, y, w, h, 6);
    scene.add.text(x + w / 2, y + h / 2 - 4, '🔒',
      { fontFamily: 'sans-serif', fontSize: '16px' }).setOrigin(0.5).setAlpha(0.7);
    scene.add.text(x + w / 2, y + h - 12, label,
      { fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: theme.lockedLabelColor }).setOrigin(0.5);

  } else if (prog.bestStars === 0) {
    // Unlocked, not cleared — cream cell + chapter (or boss) accent edge.
    const edgeBase  = isBoss ? bossEdge : theme.unclearedBorder;
    const edgeHover = isBoss ? CASUAL.RED_DK : theme.unclearedHoverBorder;
    const drawBase = (fillCol: number, accentCol: number) => {
      bg.clear();
      bg.fillStyle(fillCol, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.fillStyle(0xffffff, 0.12);
      bg.fillRoundedRect(x + 5, y + 4, w - 10, 6, 3);
      bg.lineStyle(2.5, CASUAL.EDGE, 1);
      bg.strokeRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, accentCol, 0.95);
      bg.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 4);
      _drawPlaqueAccent(bg, x, y, w, accentCol, isFrontier ? 0.95 : 0.7);
    };
    drawBase(theme.unclearedBg, edgeBase);
    scene.add.text(x + w / 2, y + 14, label, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: theme.unclearedLabelColor,
    }).setOrigin(0.5);
    scene.add.text(x + w / 2, y + h - 16, '☆☆☆', {
      fontFamily: 'sans-serif', fontSize: '11px', color: theme.unclearedStarColor,
    }).setOrigin(0.5);
    const zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => _pressPlaque(scene, bg, () => onSelect(idx)));
    zone.on('pointerover', () => drawBase(theme.unclearedHoverBg, edgeHover));
    zone.on('pointerout',  () => drawBase(theme.unclearedBg,      edgeBase));

  } else {
    // Cleared — cream cell + GOLD edge (boss keeps a RED inner ring accent).
    bg.fillStyle(theme.clearedBg, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(x + 5, y + 4, w - 10, 6, 3);
    bg.lineStyle(2.5, CASUAL.EDGE, 1);
    bg.strokeRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1.5, isBoss ? bossEdge : theme.clearedBorder, 0.95);
    bg.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 4);
    _drawPlaqueAccent(bg, x, y, w, theme.clearedBorder, 0.9);
    scene.add.text(x + w / 2, y + 14, label, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: theme.clearedLabelColor,
    }).setOrigin(0.5);
    addStarPop(scene, x + w / 2, y + h - 16, prog.bestStars, theme.starColor);
    if (prog.bestHpPercent !== undefined) {
      _drawHpDisplay(scene, x, y, w, h, prog.bestHpPercent, theme.showHpBar);
    }
    const zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => _pressPlaque(scene, bg, () => onSelect(idx)));
  }

  if (isBoss) {
    scene.add.text(x + w - 4, y + 4, theme.bossEmoji,
      { fontSize: '11px' }).setOrigin(1, 0);
    if (prog?.unlocked) {
      _drawBossRing(scene, x, y, w, h);
    }
  }

  if (isFrontier) {
    _drawFrontierCue(scene, x, y, w, h, isBoss ? CASUAL.RED : theme.accent);
  }
}

// ── Plaque visual helpers ─────────────────────────────────────────────────────

function _drawPlaqueAccent(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x + 8, y + 4, Math.max(8, w - 16), 3, 2);
}

function _pressPlaque(
  scene: Phaser.Scene,
  bg: Phaser.GameObjects.Graphics,
  onComplete: () => void,
): void {
  scene.tweens.add({
    targets: bg,
    alpha: 0.68,
    duration: 70,
    yoyo: true,
    onComplete: () => {
      bg.setAlpha(1);
      onComplete();
    },
  });
}

function _drawFrontierCue(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  const ring = scene.add.graphics();
  ring.lineStyle(2.5, color, 1);
  ring.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  // Pulse is decorative — the static ring + ▶ cue already mark the frontier.
  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.35, to: 1 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  const cue = scene.add.graphics();
  cue.fillStyle(color, 0.95);
  cue.fillTriangle(x + 7, y + 9, x + 7, y + 21, x + 17, y + 15);
}

// ── _drawBossRing ─────────────────────────────────────────────────────────────
// Pulsing RED ring around an unlocked boss/special stage cell (casual accent).

function _drawBossRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const ring = scene.add.graphics();
  ring.lineStyle(2, CASUAL.RED, 0.85);
  ring.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 7);
  // Pulse is decorative — the static red ring already marks the boss cell.
  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.4, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

// ── _drawHpDisplay ────────────────────────────────────────────────────────────

function _drawHpDisplay(
  scene:      Phaser.Scene,
  x:          number,
  y:          number,
  w:          number,
  h:          number,
  hpPercent:  number,
  showBar:    boolean,
): void {
  // Casual HP tint on cream — soft green/gold/red INK-friendly hexes.
  const hpColor = hpPercent >= 80 ? CASUAL_CSS.GREEN : hpPercent >= 40 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;
  if (showBar) {
    const fillRgb = hpPercent >= 80 ? CASUAL.GREEN : hpPercent >= 40 ? CASUAL.GOLD : CASUAL.RED;
    const barW = w - 14, barX = x + 7, barY = y + h - 26;
    const hpBar = scene.add.graphics();
    hpBar.fillStyle(CASUAL.PANEL_SOFT, 1);
    hpBar.fillRoundedRect(barX, barY, barW, 4, 2);
    hpBar.fillStyle(fillRgb, 1);
    hpBar.fillRoundedRect(barX, barY, Math.max(2, barW * (hpPercent / 100)), 4, 2);
    scene.add.text(x + w / 2, barY - 9, `❤ ${hpPercent}%`,
      { fontFamily: 'sans-serif', fontSize: '9px', color: hpColor }).setOrigin(0.5);
  } else {
    scene.add.text(x + w / 2, y + h - 28, `HP ${hpPercent}%`,
      { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
  }
}

// ── drawChapterSection ────────────────────────────────────────────────────────
// Renders one full chapter block: divider → header → progress bar → plaque grid
// (or locked banner when the unlock condition isn't met).

export function drawChapterSection(
  scene:    Phaser.Scene,
  data:     ChapterSectionData,
  theme:    PlaqueTheme,
  progress: StageProgress[],
  onSelect: (idx: number) => void,
  highlightIdx?: number,
): void {
  const unlocked = (progress[data.unlockIdx]?.bestStars ?? 0) > 0;

  // Soft brown divider with a centred accent diamond (matches Ch1 header).
  const div = scene.add.graphics();
  div.lineStyle(1, unlocked ? CASUAL.EDGE : CASUAL.EDGE_SOFT, 0.55);
  div.lineBetween(30, data.divY, CANVAS_WIDTH - 30, data.divY);
  div.fillStyle(unlocked ? data.activeDivColor : CASUAL.EDGE_SOFT, 1);
  div.fillTriangle(CANVAS_WIDTH / 2 - 4, data.divY, CANVAS_WIDTH / 2 + 4, data.divY, CANVAS_WIDTH / 2, data.divY - 5);
  div.fillTriangle(CANVAS_WIDTH / 2 - 4, data.divY, CANVAS_WIDTH / 2 + 4, data.divY, CANVAS_WIDTH / 2, data.divY + 5);

  if (unlocked) {
    _drawChapterTitle(scene, data.labelY, `Chapter ${data.num}  —  ${data.name}`, data.activeDivColor);
    drawChapterProgressBar(scene, data.startIdx, data.stageCount, data.progressBarY, progress);
  } else {
    _drawChapterTitle(scene, data.labelY, `Chapter ${data.num}  —  ${data.name}  🔒`, CASUAL.EDGE_SOFT, data.lockedLabelColor);
    // Slim single-line unlock hint — no big banner (avoids dead-space voids).
    // The dimmed 🔒 node path drawn below shows the journey still ahead, so the
    // map reads as one continuous road (AFK-Journey style) instead of gaps.
    scene.add.text(CANVAS_WIDTH / 2, data.progressBarY - 1, data.unlockMsg, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: data.lockedMsgColor,
    }).setOrigin(0.5, 0);
  }

  // Always render the chapter path. Unlocked chapters show playable / cleared
  // nodes; locked chapters render dimmed 🔒 nodes (non-interactive) so the
  // journey continues unbroken and the reserved height is never empty.
  _drawChapterPath(scene, data, theme, progress, onSelect, highlightIdx);
}

// ── _drawChapterTitle ─────────────────────────────────────────────────────────
// Chapter header: INK (or INK_SOFT when locked) title with a small accent diamond
// pill on each side — mirrors StageSelectScene's casual flourish.

function _drawChapterTitle(
  scene:     Phaser.Scene,
  labelY:    number,
  text:      string,
  accent:    number,
  textColor: string = CASUAL_CSS.INK,
): void {
  const title = scene.add.text(CANVAS_WIDTH / 2, labelY, text, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: textColor, stroke: '#ffffff', strokeThickness: 3, letterSpacing: 1,
  }).setOrigin(0.5, 1);

  const bounds = title.getBounds();
  const cy = labelY - bounds.height / 2;
  const pad = 12;
  const orn = scene.add.graphics();
  orn.fillStyle(accent, 1);
  const lx = bounds.left - pad;
  orn.fillTriangle(lx - 4, cy, lx, cy - 3, lx, cy + 3);
  const rx = bounds.right + pad;
  orn.fillTriangle(rx + 4, cy, rx, cy - 3, rx, cy + 3);
}

// ── _drawChapterPath ──────────────────────────────────────────────────────────
// Renders chapter nodes along a serpentine path with a lit/dim trail.

function _drawChapterPath(
  scene:        Phaser.Scene,
  data:         ChapterSectionData,
  theme:        PlaqueTheme,
  progress:     StageProgress[],
  onSelect:     (idx: number) => void,
  highlightIdx?: number,
): void {
  const { startIdx, stageCount, gridStartY } = data;
  const positions = buildJourneyPathPositions(stageCount, gridStartY);

  // Local frontier index (0-based within this chapter)
  const localFrontier = highlightIdx !== undefined
    ? Math.max(0, highlightIdx - startIdx)
    : stageCount;

  // Trail drawn first (behind nodes)
  drawJourneyTrail(scene, positions, localFrontier, data.activeDivColor);

  // Nodes
  for (let i = 0; i < stageCount; i++) {
    const { x, y } = positions[i];
    drawGenericPlaque(
      scene, startIdx + i, x, y,
      JOURNEY_NODE_W, JOURNEY_NODE_H,
      theme, progress, onSelect, highlightIdx,
    );
  }
}

// ── drawChapterProgressBar ────────────────────────────────────────────────────

export function drawChapterProgressBar(
  scene:    Phaser.Scene,
  startIdx: number,
  count:    number,
  y:        number,
  progress: StageProgress[],
  target?:  Phaser.GameObjects.Container,
): void {
  const slice     = progress.slice(startIdx, startIdx + count);
  const cleared   = slice.filter(p => p.bestStars > 0).length;
  const totalStars = slice.reduce((s, p) => s + (p.bestStars ?? 0), 0);
  const maxStars  = count * 3;
  const pct       = count > 0 ? cleared / count : 0;
  const bx = 30, bw = CANVAS_WIDTH - 60, bh = 4;
  // Cream PANEL_SOFT track + GOLD fill (GREEN/BLUE accents while in progress).
  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(bx, y, bw, bh, 2);
  const fillColor = pct >= 1 ? CASUAL.GOLD : pct >= 0.5 ? CASUAL.GREEN : CASUAL.BLUE;
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(bx, y, Math.max(4, bw * pct), bh, 2);
  if (target) target.add(bg.setScrollFactor(0));
  const countLabel = scene.add.text(bx + bw - 2, y - 2, `${cleared}/${count}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(1, 1);
  if (target) target.add(countLabel.setScrollFactor(0));
  const starColor = totalStars === maxStars ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT;
  const starLabel = scene.add.text(bx + 2, y - 2, `★ ${totalStars}/${maxStars}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: starColor,
  }).setOrigin(0, 1);
  if (target) target.add(starLabel.setScrollFactor(0));
}

// ── addStarPop ────────────────────────────────────────────────────────────────
// Animated 3-star row used by both Ch1 drawStagePlaque and drawGenericPlaque.

export function addStarPop(
  scene:  Phaser.Scene,
  cx:     number,
  cy:     number,
  filled: number,
  color:  string,
): void {
  const spacing = 11;
  [-spacing, 0, spacing].forEach((ox, i) => {
    const isFilled = i < filled;
    const t = scene.add.text(cx + ox, cy, isFilled ? '★' : '☆', {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: isFilled ? color : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setScale(0).setAlpha(0);
    scene.tweens.add({
      targets: t, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 220, ease: 'Back.easeOut', delay: 60 + i * 80,
    });
  });
}
