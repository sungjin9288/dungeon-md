// ─── StagePlaque ──────────────────────────────────────────────────────────────
// Generic stage card renderer and chapter section builder for StageSelectScene.
// Extracted from StageSelectScene.ts (A36) to eliminate 7-chapter duplicated
// plaque / grid / section logic that differed only in colour palette.
//
// Public API
//   drawGenericPlaque   — renders one stage card (locked / uncleared / cleared)
//   drawChapterSection  — renders a chapter divider, header, progress bar + grid
//   drawChapterProgressBar — standalone progress bar; also used by Ch1 header
//   addStarPop          — animated ★ row (shared by Ch1 plaque + generic plaque)

import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { STAGE_CONFIGS } from '../data/stageProgress';
import type { StageProgress } from '../data/stageProgress';
import { addPanelShadow } from './PanelDepth';

// ── PlaqueTheme ───────────────────────────────────────────────────────────────

export interface PlaqueTheme {
  // Locked state
  lockedBg:             number;
  lockedBorder:         number;
  lockedLabelColor:     string;
  // Uncleared state
  unclearedBg:          number;
  unclearedBorder:      number;
  unclearedHoverBg:     number;
  unclearedHoverBorder: number;
  unclearedLabelColor:  string;
  unclearedStarColor:   string;
  // Cleared state
  clearedBg:            number;
  clearedBorder:        number;
  clearedLabelColor:    string;
  starColor:            string;
  // Decoration
  bossEmoji:            string;
  /** true → graphics mini bar + text; false → text-only HP% line */
  showHpBar:            boolean;
}

// ── CHAPTER_PLAQUE_THEMES  (index 0 = Ch2, … index 5 = Ch7) ──────────────────

export const CHAPTER_PLAQUE_THEMES: PlaqueTheme[] = [
  // [0] Ch2 — emerald green
  {
    lockedBg: 0x050e0a, lockedBorder: 0x143020, lockedLabelColor: '#1a4a30',
    unclearedBg: 0x0d1e18, unclearedBorder: 0x2a7a60,
    unclearedHoverBg: 0x163028, unclearedHoverBorder: 0x20c090,
    unclearedLabelColor: '#a0e8c8', unclearedStarColor: '#1a6040',
    clearedBg: 0x163028, clearedBorder: 0x20c090, clearedLabelColor: '#20c090',
    starColor: '#20c090', bossEmoji: '🦊', showHpBar: true,
  },
  // [1] Ch3 — ocean blue
  {
    lockedBg: 0x020810, lockedBorder: 0x0a1830, lockedLabelColor: '#0a2048',
    unclearedBg: 0x050e20, unclearedBorder: 0x1a4488,
    unclearedHoverBg: 0x0a1838, unclearedHoverBorder: 0x4488ff,
    unclearedLabelColor: '#88aaf8', unclearedStarColor: '#1a3a88',
    clearedBg: 0x0a1838, clearedBorder: 0x4488ff, clearedLabelColor: '#4488ff',
    starColor: '#4488ff', bossEmoji: '🐲', showHpBar: false,
  },
  // [2] Ch4 — blood red
  {
    lockedBg: 0x100008, lockedBorder: 0x3a0820, lockedLabelColor: '#5a1030',
    unclearedBg: 0x200010, unclearedBorder: 0x881030,
    unclearedHoverBg: 0x300018, unclearedHoverBorder: 0xcc2244,
    unclearedLabelColor: '#ff6688', unclearedStarColor: '#881030',
    clearedBg: 0x300018, clearedBorder: 0xcc2244, clearedLabelColor: '#cc2244',
    starColor: '#cc2244', bossEmoji: '☠️', showHpBar: false,
  },
  // [3] Ch5 — ancient gold
  {
    lockedBg: 0x0e0800, lockedBorder: 0x3a2800, lockedLabelColor: '#5a4000',
    unclearedBg: 0x1a1000, unclearedBorder: 0xaa7700,
    unclearedHoverBg: 0x281800, unclearedHoverBorder: 0xddaa00,
    unclearedLabelColor: '#ffcc44', unclearedStarColor: '#aa7700',
    clearedBg: 0x281800, clearedBorder: 0xddaa00, clearedLabelColor: '#ddaa00',
    starColor: '#ddaa00', bossEmoji: '🌟', showHpBar: false,
  },
  // [4] Ch6 — royal purple / gold
  {
    lockedBg: 0x0a0018, lockedBorder: 0x2a1050, lockedLabelColor: '#4a2870',
    unclearedBg: 0x140028, unclearedBorder: 0x8844cc,
    unclearedHoverBg: 0x200040, unclearedHoverBorder: 0xd4af37,
    unclearedLabelColor: '#d4af37', unclearedStarColor: '#8844cc',
    clearedBg: 0x200040, clearedBorder: 0xd4af37, clearedLabelColor: '#d4af37',
    starColor: '#d4af37', bossEmoji: '🌟', showHpBar: false,
  },
  // [5] Ch7 — divine gold
  {
    lockedBg: 0x0a0800, lockedBorder: 0x3a2a00, lockedLabelColor: '#4a3a00',
    unclearedBg: 0x1a1400, unclearedBorder: 0xffd700,
    unclearedHoverBg: 0x2a2000, unclearedHoverBorder: 0xffd700,
    unclearedLabelColor: '#ffd700', unclearedStarColor: '#cc9900',
    clearedBg: 0x2a2000, clearedBorder: 0xffd700, clearedLabelColor: '#ffd700',
    starColor: '#ffd700', bossEmoji: '🌟', showHpBar: false,
  },
  // [6] Ch8 — primordial abyss (void indigo)
  {
    lockedBg: 0x04020e, lockedBorder: 0x1a0a3a, lockedLabelColor: '#2a1050',
    unclearedBg: 0x0a0520, unclearedBorder: 0x6622cc,
    unclearedHoverBg: 0x120830, unclearedHoverBorder: 0x9944ff,
    unclearedLabelColor: '#cc88ff', unclearedStarColor: '#440088',
    clearedBg: 0x120830, clearedBorder: 0x9944ff, clearedLabelColor: '#cc88ff',
    starColor: '#aa44ff', bossEmoji: '🌑', showHpBar: false,
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
  // Colours
  activeDivColor:   number;
  activeTextColor:  string;
  lockedDivColor:   number;
  lockedLabelColor: string;
  bannerBg:         number;
  bannerBorder:     number;
  lockedMsgColor:   string;
  lockedNameColor:  string;
}

// ── CHAPTER_SECTION_DATA  (index 0 = Ch2, … index 5 = Ch7) ───────────────────

export const CHAPTER_SECTION_DATA: ChapterSectionData[] = [
  // Ch2
  {
    num: 2, name: '구미호 계곡', stageCount: 10,
    unlockIdx: 9, unlockMsg: '⛓ 스테이지 10을 클리어하면 열립니다',
    startIdx: 10,
    divY: 302, labelY: 292, progressBarY: 307, bannerY: 310, gridStartY: 318,
    cols: 5, rows: 2, bw: 58, bh: 68, gapX: 8, gapY: 14,
    activeDivColor: 0x20c090, activeTextColor: '#20c090',
    lockedDivColor: 0x2a3a30, lockedLabelColor: '#2a5040',
    bannerBg: 0x050e0a, bannerBorder: 0x143020,
    lockedMsgColor: '#2a6040', lockedNameColor: '#1a3a28',
  },
  // Ch3
  {
    num: 3, name: '용왕 해저궁', stageCount: 12,
    unlockIdx: 19, unlockMsg: '⛓ 스테이지 20을 클리어하면 열립니다',
    startIdx: 20,
    divY: 492, labelY: 482, progressBarY: 497, bannerY: 500, gridStartY: 506,
    cols: 6, rows: 2, bw: 48, bh: 62, gapX: 6, gapY: 10,
    activeDivColor: 0x2266cc, activeTextColor: '#4488ff',
    lockedDivColor: 0x1a2440, lockedLabelColor: '#1a3060',
    bannerBg: 0x020810, bannerBorder: 0x0a1830,
    lockedMsgColor: '#1a3880', lockedNameColor: '#0e1e48',
  },
  // Ch4
  {
    num: 4, name: '저승 관문', stageCount: 10,
    unlockIdx: 31, unlockMsg: '⛓ 스테이지 32를 클리어하면 열립니다',
    startIdx: 32,
    divY: 662, labelY: 652, progressBarY: 667, bannerY: 670, gridStartY: 672,
    cols: 5, rows: 2, bw: 56, bh: 62, gapX: 6, gapY: 10,
    activeDivColor: 0xaa2244, activeTextColor: '#cc2244',
    lockedDivColor: 0x3a1520, lockedLabelColor: '#5a1a2a',
    bannerBg: 0x100008, bannerBorder: 0x3a0820,
    lockedMsgColor: '#6a1a30', lockedNameColor: '#3a0a18',
  },
  // Ch5
  {
    num: 5, name: '삼신산', stageCount: 10,
    unlockIdx: 41, unlockMsg: '⛓ 스테이지 42를 클리어하면 열립니다',
    startIdx: 42,
    divY: 840, labelY: 830, progressBarY: 845, bannerY: 848, gridStartY: 850,
    cols: 5, rows: 2, bw: 56, bh: 62, gapX: 6, gapY: 10,
    activeDivColor: 0xddaa00, activeTextColor: '#ddaa00',
    lockedDivColor: 0x3a2800, lockedLabelColor: '#5a4000',
    bannerBg: 0x0e0800, bannerBorder: 0x3a2800,
    lockedMsgColor: '#8a6000', lockedNameColor: '#4a3000',
  },
  // Ch6
  {
    num: 6, name: '영원의 왕좌', stageCount: 10,
    unlockIdx: 51, unlockMsg: '⛓ 스테이지 52를 클리어하면 열립니다',
    startIdx: 52,
    divY: 1010, labelY: 1000, progressBarY: 1015, bannerY: 1018, gridStartY: 1020,
    cols: 5, rows: 2, bw: 56, bh: 62, gapX: 6, gapY: 10,
    activeDivColor: 0x8844cc, activeTextColor: '#d4af37',
    lockedDivColor: 0x2a1050, lockedLabelColor: '#4a2870',
    bannerBg: 0x0a0018, bannerBorder: 0x2a1050,
    lockedMsgColor: '#8844cc', lockedNameColor: '#4a2870',
  },
  // Ch7
  {
    num: 7, name: '신계 침공', stageCount: 10,
    unlockIdx: 61, unlockMsg: '⛓ 스테이지 62를 클리어하면 열립니다',
    startIdx: 62,
    divY: 1175, labelY: 1165, progressBarY: 1180, bannerY: 1183, gridStartY: 1185,
    cols: 5, rows: 2, bw: 56, bh: 62, gapX: 6, gapY: 10,
    activeDivColor: 0xffd700, activeTextColor: '#ffd700',
    lockedDivColor: 0x2a1a00, lockedLabelColor: '#4a3a00',
    bannerBg: 0x0a0800, bannerBorder: 0x3a2a00,
    lockedMsgColor: '#cc9900', lockedNameColor: '#4a3a00',
  },
  // Ch8
  {
    num: 8, name: '원초의 심연', stageCount: 8,
    unlockIdx: 71, unlockMsg: '⛓ 스테이지 72를 클리어하면 열립니다',
    startIdx: 72,
    divY: 1340, labelY: 1330, progressBarY: 1345, bannerY: 1348, gridStartY: 1350,
    cols: 4, rows: 2, bw: 66, bh: 62, gapX: 10, gapY: 10,
    activeDivColor: 0x9944ff, activeTextColor: '#cc88ff',
    lockedDivColor: 0x1a0a3a, lockedLabelColor: '#2a1050',
    bannerBg: 0x04020e, bannerBorder: 0x1a0a3a,
    lockedMsgColor: '#6622cc', lockedNameColor: '#2a1050',
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

  if (prog?.unlocked) {
    addPanelShadow(scene, x, y, w, h, 6, { offsetY: 2, opacity: isFrontier ? 0.7 : 0.45 });
  }

  if (!prog?.unlocked) {
    bg.fillStyle(theme.lockedBg, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, theme.lockedBorder, 0.8);
    bg.strokeRoundedRect(x, y, w, h, 6);
    _drawPlaqueAccent(bg, x, y, w, theme.lockedBorder, 0.35);
    scene.add.text(x + w / 2, y + h / 2 - 4, '⛓',
      { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
    scene.add.text(x + w / 2, y + h - 12, label,
      { fontFamily: 'sans-serif', fontSize: '10px', color: theme.lockedLabelColor }).setOrigin(0.5);

  } else if (prog.bestStars === 0) {
    const drawBase = (fillCol: number, strokeCol: number) => {
      bg.clear();
      bg.fillStyle(fillCol, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, strokeCol, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      _drawPlaqueAccent(bg, x, y, w, strokeCol, isFrontier ? 0.95 : 0.65);
    };
    drawBase(theme.unclearedBg, theme.unclearedBorder);
    scene.add.text(x + w / 2, y + 14, label, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: theme.unclearedLabelColor,
    }).setOrigin(0.5);
    scene.add.text(x + w / 2, y + h - 16, '☆☆☆', {
      fontFamily: 'sans-serif', fontSize: '11px', color: theme.unclearedStarColor,
    }).setOrigin(0.5);
    const zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => _pressPlaque(scene, bg, () => onSelect(idx)));
    zone.on('pointerover', () => drawBase(theme.unclearedHoverBg,  theme.unclearedHoverBorder));
    zone.on('pointerout',  () => drawBase(theme.unclearedBg,       theme.unclearedBorder));

  } else {
    bg.fillStyle(theme.clearedBg, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(2, theme.clearedBorder, 0.9);
    bg.strokeRoundedRect(x, y, w, h, 6);
    _drawPlaqueAccent(bg, x, y, w, theme.clearedBorder, 0.85);
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

  if (cfg?.bossWave) {
    scene.add.text(x + w - 4, y + 4, theme.bossEmoji,
      { fontSize: '11px' }).setOrigin(1, 0);
  }

  if (isFrontier) {
    _drawFrontierCue(scene, x, y, w, h, theme.unclearedHoverBorder);
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
  scene.tweens.add({
    targets: ring,
    alpha: { from: 0.35, to: 1 },
    duration: 850,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const cue = scene.add.graphics();
  cue.fillStyle(color, 0.95);
  cue.fillTriangle(x + 7, y + 9, x + 7, y + 21, x + 17, y + 15);
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
  const hpColor = hpPercent >= 80 ? '#44ff88' : hpPercent >= 40 ? '#ffcc44' : '#ff6644';
  if (showBar) {
    const fillRgb = hpPercent >= 80 ? 0x44ff88 : hpPercent >= 40 ? 0xffcc44 : 0xff6644;
    const barW = w - 14, barX = x + 7, barY = y + h - 26;
    const hpBar = scene.add.graphics();
    hpBar.fillStyle(0x222222, 0.9);
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

  const div = scene.add.graphics();
  div.lineStyle(1, unlocked ? data.activeDivColor : data.lockedDivColor, 0.6);
  div.lineBetween(30, data.divY, CANVAS_WIDTH - 30, data.divY);

  if (unlocked) {
    scene.add.text(CANVAS_WIDTH / 2, data.labelY,
      `Chapter ${data.num}  —  ${data.name}`, {
        fontFamily: 'sans-serif', fontSize: '12px',
        color: data.activeTextColor, letterSpacing: 2,
      }).setOrigin(0.5, 1);
    drawChapterProgressBar(scene, data.startIdx, data.stageCount, data.progressBarY, progress);
    _drawChapterGrid(scene, data, theme, progress, onSelect, highlightIdx);
  } else {
    scene.add.text(CANVAS_WIDTH / 2, data.labelY,
      `Chapter ${data.num}  —  ${data.name}  🔒`, {
        fontFamily: 'sans-serif', fontSize: '12px',
        color: data.lockedLabelColor, letterSpacing: 2,
      }).setOrigin(0.5, 1);
    const bx = 30, bw = CANVAS_WIDTH - 60, bh = 56;
    const bg = scene.add.graphics();
    bg.fillStyle(data.bannerBg, 1);
    bg.fillRoundedRect(bx, data.bannerY, bw, bh, 8);
    bg.lineStyle(1, data.bannerBorder, 0.8);
    bg.strokeRoundedRect(bx, data.bannerY, bw, bh, 8);
    scene.add.text(CANVAS_WIDTH / 2, data.bannerY + bh / 2 - 6, data.unlockMsg, {
      fontFamily: 'sans-serif', fontSize: '11px', color: data.lockedMsgColor,
    }).setOrigin(0.5);
    scene.add.text(CANVAS_WIDTH / 2, data.bannerY + bh / 2 + 10,
      `${data.name}  ·  ${data.stageCount} 스테이지`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: data.lockedNameColor,
      }).setOrigin(0.5);
  }
}

// ── _drawChapterGrid ──────────────────────────────────────────────────────────

function _drawChapterGrid(
  scene:    Phaser.Scene,
  data:     ChapterSectionData,
  theme:    PlaqueTheme,
  progress: StageProgress[],
  onSelect: (idx: number) => void,
  highlightIdx?: number,
): void {
  const { cols, rows, bw, bh, gapX, gapY, startIdx, gridStartY } = data;
  const gridW  = cols * bw + (cols - 1) * gapX;
  const startX = (CANVAS_WIDTH - gridW) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = startIdx + r * cols + c;
      const x   = startX + c * (bw + gapX);
      const y   = gridStartY + r * (bh + gapY);
      drawGenericPlaque(scene, idx, x, y, bw, bh, theme, progress, onSelect, highlightIdx);
    }
  }
}

// ── drawChapterProgressBar ────────────────────────────────────────────────────

export function drawChapterProgressBar(
  scene:    Phaser.Scene,
  startIdx: number,
  count:    number,
  y:        number,
  progress: StageProgress[],
): void {
  const slice     = progress.slice(startIdx, startIdx + count);
  const cleared   = slice.filter(p => p.bestStars > 0).length;
  const totalStars = slice.reduce((s, p) => s + (p.bestStars ?? 0), 0);
  const maxStars  = count * 3;
  const pct       = count > 0 ? cleared / count : 0;
  const bx = 30, bw = CANVAS_WIDTH - 60, bh = 4;
  const bg = scene.add.graphics();
  bg.fillStyle(0x1a1a1a, 1);
  bg.fillRoundedRect(bx, y, bw, bh, 2);
  const fillColor = pct >= 1 ? COLORS.TORCH_GOLD : pct >= 0.5 ? 0x44cc88 : 0x2255aa;
  bg.fillStyle(fillColor, 0.9);
  bg.fillRoundedRect(bx, y, Math.max(4, bw * pct), bh, 2);
  scene.add.text(bx + bw - 2, y - 2, `${cleared}/${count}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }).setOrigin(1, 1);
  const starColor = totalStars === maxStars ? CSS.TORCH_AMBER : '#666644';
  scene.add.text(bx + 2, y - 2, `★ ${totalStars}/${maxStars}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: starColor,
  }).setOrigin(0, 1);
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
      color: isFilled ? color : '#666655',
    }).setOrigin(0.5).setScale(0).setAlpha(0);
    scene.tweens.add({
      targets: t, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 220, ease: 'Back.easeOut', delay: 60 + i * 80,
    });
  });
}
