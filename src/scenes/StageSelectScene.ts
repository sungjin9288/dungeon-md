import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, type StageProgressEntry } from '../data/wisdom';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7 } from '../data/stages';
import type { InvaderType } from '../data/invaders';

// ─── Invader type → emoji ─────────────────────────────────────────────────────

const INVADER_EMOJI: Partial<Record<InvaderType, string>> = {
  peasant: '👤', soldier: '🪖', knight: '⚔️', shaman: '🔮',
  berserker: '😡', shadow_ninja: '🥷', siege_soldier: '🛡',
  holy_paladin: '✝️', iron_golem: '🤖', high_priest: '🧙', mercenary_captain: '🗡',
  fox_queen: '🦊',
  undying_knight: '💀', scarecrow_mage: '🎃', venom_dancer: '🐍', void_assassin: '👁',
  dragon_king: '🐉',
  void_assassin_elite: '👁', death_emissary: '💀', ghost_add: '👻',
  void_invader: '🌀', undying_warrior: '💀', three_god_destroyer: '⚡',
  mirror_knight: '🪞', shadow_wraith: '👤', celestial_crusader: '✝️',
  void_colossus: '🌑', eternal_emperor: '👑',
  celestial_knight: '🌟', divine_archer: '🏹', sky_titan: '⛅',
  radiant_seraph: '😇', heaven_general: '👑', celestial_dragon: '🐉', god_emperor: '👼',
};

// Compute top-2 invader type emojis for each stage (index 0-71)
const ALL_STAGES = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4,
  ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7,
];

const STAGE_ENEMY_ICONS: string[] = ALL_STAGES.map(cfg => {
  const counts: Partial<Record<InvaderType, number>> = {};
  for (const wave of cfg.waves) {
    for (const inv of wave.invaders) {
      if (!inv.isBoss) counts[inv.type] = (counts[inv.type] ?? 0) + inv.count;
    }
  }
  const top = (Object.entries(counts) as [InvaderType, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => INVADER_EMOJI[t] ?? '')
    .join('');
  return top;
});

// ─── Stage progress types ─────────────────────────────────────────────────────

export type StageProgress = StageProgressEntry;

export const TOTAL_STAGES = 72;

// Minimal per-stage configs used to boot DungeonScene
export const STAGE_CONFIGS = [
  // ── Chapter 1: 도깨비 숲 ──
  { stageNumber: 1,  slots: 3,  unlockedStage: 1,  chapter: 1 },
  { stageNumber: 2,  slots: 4,  unlockedStage: 2,  chapter: 1 },
  { stageNumber: 3,  slots: 4,  unlockedStage: 3,  chapter: 1 },
  { stageNumber: 4,  slots: 5,  unlockedStage: 4,  chapter: 1 },
  { stageNumber: 5,  slots: 5,  unlockedStage: 4,  chapter: 1 },
  { stageNumber: 6,  slots: 6,  unlockedStage: 6,  chapter: 1 },
  { stageNumber: 7,  slots: 6,  unlockedStage: 6,  chapter: 1 },
  { stageNumber: 8,  slots: 7,  unlockedStage: 8,  chapter: 1 },
  { stageNumber: 9,  slots: 9,  unlockedStage: 8,  chapter: 1 },
  { stageNumber: 10, slots: 9,  unlockedStage: 8,  chapter: 1, bossWave: true },
  // ── Chapter 2: 구미호 계곡 ──
  { stageNumber: 11, slots: 10, unlockedStage: 11, chapter: 2 },
  { stageNumber: 12, slots: 11, unlockedStage: 12, chapter: 2 },
  { stageNumber: 13, slots: 12, unlockedStage: 13, chapter: 2 },
  { stageNumber: 14, slots: 12, unlockedStage: 14, chapter: 2 },
  { stageNumber: 15, slots: 13, unlockedStage: 15, chapter: 2 },
  { stageNumber: 16, slots: 13, unlockedStage: 16, chapter: 2 },
  { stageNumber: 17, slots: 14, unlockedStage: 17, chapter: 2 },
  { stageNumber: 18, slots: 14, unlockedStage: 18, chapter: 2 },
  { stageNumber: 19, slots: 15, unlockedStage: 19, chapter: 2 },
  { stageNumber: 20, slots: 16, unlockedStage: 19, chapter: 2, bossWave: true },
  // ── Chapter 3: 용왕 해저궁 ──
  { stageNumber: 21, slots: 16, unlockedStage: 21, chapter: 3 },
  { stageNumber: 22, slots: 16, unlockedStage: 22, chapter: 3 },
  { stageNumber: 23, slots: 17, unlockedStage: 23, chapter: 3 },
  { stageNumber: 24, slots: 17, unlockedStage: 24, chapter: 3 },
  { stageNumber: 25, slots: 17, unlockedStage: 25, chapter: 3 },
  { stageNumber: 26, slots: 18, unlockedStage: 26, chapter: 3 },
  { stageNumber: 27, slots: 18, unlockedStage: 27, chapter: 3 },
  { stageNumber: 28, slots: 18, unlockedStage: 28, chapter: 3 },
  { stageNumber: 29, slots: 18, unlockedStage: 29, chapter: 3 },
  { stageNumber: 30, slots: 20, unlockedStage: 29, chapter: 3 },
  { stageNumber: 31, slots: 20, unlockedStage: 29, chapter: 3 },
  { stageNumber: 32, slots: 20, unlockedStage: 29, chapter: 3, bossWave: true },
  // ── Chapter 4: 저승 관문 ──
  { stageNumber: 33, slots: 8,  unlockedStage: 33, chapter: 4 },
  { stageNumber: 34, slots: 9,  unlockedStage: 34, chapter: 4 },
  { stageNumber: 35, slots: 10, unlockedStage: 35, chapter: 4 },
  { stageNumber: 36, slots: 10, unlockedStage: 36, chapter: 4 },
  { stageNumber: 37, slots: 11, unlockedStage: 37, chapter: 4 },
  { stageNumber: 38, slots: 11, unlockedStage: 38, chapter: 4 },
  { stageNumber: 39, slots: 12, unlockedStage: 39, chapter: 4 },
  { stageNumber: 40, slots: 12, unlockedStage: 40, chapter: 4 },
  { stageNumber: 41, slots: 12, unlockedStage: 40, chapter: 4 },
  { stageNumber: 42, slots: 12, unlockedStage: 40, chapter: 4, bossWave: true },
  // ── Chapter 5: 삼신산 ──
  { stageNumber: 43, slots: 10, unlockedStage: 43, chapter: 5 },
  { stageNumber: 44, slots: 10, unlockedStage: 44, chapter: 5 },
  { stageNumber: 45, slots: 11, unlockedStage: 45, chapter: 5 },
  { stageNumber: 46, slots: 11, unlockedStage: 46, chapter: 5 },
  { stageNumber: 47, slots: 12, unlockedStage: 47, chapter: 5 },
  { stageNumber: 48, slots: 12, unlockedStage: 48, chapter: 5 },
  { stageNumber: 49, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 50, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 51, slots: 12, unlockedStage: 49, chapter: 5 },
  { stageNumber: 52, slots: 12, unlockedStage: 49, chapter: 5, bossWave: true },
  // ── Chapter 6: 영원의 왕좌 ──
  { stageNumber: 53, slots: 12, unlockedStage: 53, chapter: 6 },
  { stageNumber: 54, slots: 12, unlockedStage: 54, chapter: 6 },
  { stageNumber: 55, slots: 13, unlockedStage: 55, chapter: 6 },
  { stageNumber: 56, slots: 13, unlockedStage: 56, chapter: 6 },
  { stageNumber: 57, slots: 13, unlockedStage: 57, chapter: 6 },
  { stageNumber: 58, slots: 14, unlockedStage: 58, chapter: 6 },
  { stageNumber: 59, slots: 14, unlockedStage: 59, chapter: 6 },
  { stageNumber: 60, slots: 14, unlockedStage: 60, chapter: 6 },
  { stageNumber: 61, slots: 14, unlockedStage: 60, chapter: 6 },
  { stageNumber: 62, slots: 14, unlockedStage: 60, chapter: 6, bossWave: true },
  // ── Chapter 7: 신계 침공 ──
  { stageNumber: 63, slots: 14, unlockedStage: 63, chapter: 7 },
  { stageNumber: 64, slots: 14, unlockedStage: 64, chapter: 7 },
  { stageNumber: 65, slots: 15, unlockedStage: 65, chapter: 7 },
  { stageNumber: 66, slots: 15, unlockedStage: 66, chapter: 7 },
  { stageNumber: 67, slots: 15, unlockedStage: 67, chapter: 7 },
  { stageNumber: 68, slots: 16, unlockedStage: 68, chapter: 7 },
  { stageNumber: 69, slots: 16, unlockedStage: 69, chapter: 7 },
  { stageNumber: 70, slots: 16, unlockedStage: 70, chapter: 7 },
  { stageNumber: 71, slots: 16, unlockedStage: 70, chapter: 7 },
  { stageNumber: 72, slots: 16, unlockedStage: 70, chapter: 7, bossWave: true },
];

// ─── Persistence helpers ──────────────────────────────────────────────────────

const SAVE_KEY = 'dungeonStageProgress';

export function loadProgress(): StageProgress[] {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as StageProgress[];
      // Pad to TOTAL_STAGES for backward compat (old 10-entry saves)
      while (saved.length < TOTAL_STAGES) {
        saved.push({ unlocked: false, bestStars: 0 });
      }
      return saved;
    }
    catch { /* fall through */ }
  }
  // Default: stage 1 unlocked, rest locked
  return Array.from({ length: TOTAL_STAGES }, (_, i) => ({
    unlocked:  i === 0,
    bestStars: 0,
  }));
}

export function saveProgress(progress: StageProgress[]): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

/** Call after clearing a stage to unlock the next one and record stars + HP%. */
export function recordClear(stageIndex: number, stars: number, hpPercent?: number): StageProgress[] {
  const prog = loadProgress();
  if (!prog[stageIndex]) return prog;
  prog[stageIndex].bestStars = Math.max(prog[stageIndex].bestStars, stars);
  if (hpPercent !== undefined) {
    prog[stageIndex].bestHpPercent = Math.max(prog[stageIndex].bestHpPercent ?? 0, hpPercent);
  }
  // Unlock next stage
  if (stageIndex + 1 < TOTAL_STAGES) prog[stageIndex + 1].unlocked = true;
  // Clearing Stage 10 (index 9) also unlocks Stage 11 (index 10) — Ch2 gate
  if (stageIndex === 9 && prog[10]) prog[10].unlocked = true;
  // Clearing Stage 20 (index 19) also unlocks Stage 21 (index 20) — Ch3 gate
  if (stageIndex === 19 && prog[20]) prog[20].unlocked = true;
  // Clearing Stage 32 (index 31) also unlocks Stage 33 (index 32) — Ch4 gate
  if (stageIndex === 31 && prog[32]) prog[32].unlocked = true;
  // Clearing Stage 42 (index 41) also unlocks Stage 43 (index 42) — Ch5 gate
  if (stageIndex === 41 && prog[42]) prog[42].unlocked = true;
  // Clearing Stage 52 (index 51) also unlocks Stage 53 (index 52) — Ch6 gate
  if (stageIndex === 51 && prog[52]) prog[52].unlocked = true;
  // Clearing Stage 62 (index 61) also unlocks Stage 63 (index 62) — Ch7 gate
  if (stageIndex === 61 && prog[62]) prog[62].unlocked = true;
  saveProgress(prog);
  return prog;
}

// ─── StageSelectScene ─────────────────────────────────────────────────────────

export class StageSelectScene extends Phaser.Scene {
  private progress: StageProgress[] = [];
  private isDragging    = false;
  private dragStartY    = 0;
  private maxScrollY    = 720;

  constructor() { super({ key: 'StageSelectScene' }); }

  create(): void {
    this.progress = loadProgress();

    this.drawBackground();
    this.drawHeader();
    this.drawGrid();
    this.drawCh2Section();
    this.drawCh3Section();
    this.drawCh4Section();
    this.drawCh5Section();
    this.drawCh6Section();
    this.drawCh7Section();
    this.drawWisdomButton();
    this.drawEndlessButton();
    this.drawAchievementButton();
    this.drawBarracksButton();

    // Camera scroll via drag
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT + this.maxScrollY);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = p.y + this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const newScrollY = Phaser.Math.Clamp(this.dragStartY - p.y, 0, this.maxScrollY);
      this.cameras.main.setScroll(0, newScrollY);
    });
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  // ─── Background ─────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a0f00, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT + 300);  // extra height for scroll

    // Stone tile texture suggestion
    const ts = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += ts) {
      for (let y = 0; y < CANVAS_HEIGHT + 300; y += ts) {
        g.fillStyle(0x221508, 0.5);
        g.fillRect(x, y, ts - 1, ts - 1);
      }
    }
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 48, '도깨비 숲', {
      fontFamily: "Georgia, serif",
      fontSize: '26px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);

    this.add.text(CANVAS_WIDTH / 2, 84, 'Chapter 1  —  10 스테이지', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CSS.PARCHMENT_MUTED,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Divider line
    const div = this.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    div.lineBetween(30, 104, CANVAS_WIDTH - 30, 104);
  }

  // ─── Stage grid (2 rows × 5 cols) ───────────────────────────────────────

  private drawGrid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 58, BH = 68;
    const GAP_X = 8, GAP_Y = 14;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 128;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const x   = startX + c * (BW + GAP_X);
        const y   = startY + r * (BH + GAP_Y);
        this.drawStagePlaque(idx, x, y, BW, BH);
      }
    }
  }

  private drawStagePlaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = String(idx + 1);

    const bg = this.add.graphics();

    if (!prog.unlocked) {
      // Locked — dark plaque
      bg.fillStyle(0x0e0a04, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3a2810, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 14, label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#5a3a1a',
      }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      // Unlocked, not cleared
      bg.fillStyle(0x2d2416, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0x6a4820, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + 16, label, {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: CSS.PARCHMENT,
      }).setOrigin(0.5);

      // Enemy type icons
      const icons0 = STAGE_ENEMY_ICONS[idx];
      if (icons0) {
        this.add.text(x + w / 2, y + 36, icons0, {
          fontFamily: 'sans-serif', fontSize: '10px',
        }).setOrigin(0.5).setAlpha(0.6);
      }

      // 3 empty star outlines
      this.add.text(x + w / 2, y + h - 18, '☆☆☆', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#6a5030',
      }).setOrigin(0.5);

      // Interactive
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x3d3020, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, COLORS.TORCH_GOLD, 0.7); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x2d2416, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x6a4820, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      // Cleared — gold glow
      bg.fillStyle(0x3d3020, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, COLORS.TORCH_GOLD, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + 16, label, {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);

      const filledStars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 18, filledStars, {
        fontFamily: 'sans-serif', fontSize: '12px', color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);

      // Enemy type icons
      const icons1 = STAGE_ENEMY_ICONS[idx];
      if (icons1) {
        this.add.text(x + w / 2, y + 30, icons1, {
          fontFamily: 'sans-serif', fontSize: '10px',
        }).setOrigin(0.5).setAlpha(0.5);
      }

      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 30, `HP ${prog.bestHpPercent}%`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: hpColor,
        }).setOrigin(0.5);
      }

      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    // Boss badge on stage 10
    if (cfg.bossWave) {
      this.add.text(x + w - 4, y + 4, '👹', { fontSize: '11px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 2 section ──────────────────────────────────────────────────

  private drawCh2Section(): void {
    const ch2Unlocked = this.progress[9]?.bestStars > 0;

    // Divider with chapter label
    const div = this.add.graphics();
    div.lineStyle(1, ch2Unlocked ? 0x20c090 : 0x2a3a30, 0.6);
    div.lineBetween(30, 302, CANVAS_WIDTH - 30, 302);

    if (ch2Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 292, 'Chapter 2  —  구미호 계곡', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#20c090',
        letterSpacing: 2,
      }).setOrigin(0.5, 1);

      this.drawCh2Grid();
    } else {
      // Locked chapter banner
      this.add.text(CANVAS_WIDTH / 2, 292, 'Chapter 2  —  구미호 계곡  🔒', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#2a5040',
        letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 310, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x050e0a, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x143020, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 10을 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#2a6040',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '구미호 계곡  ·  10 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#1a3a28',
      }).setOrigin(0.5);
    }
  }

  private drawCh2Grid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 58, BH = 68;
    const GAP_X = 8, GAP_Y = 14;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 318;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 10 + r * COLS + c;   // indices 10–19
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh2Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh2Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = String(cfg.stageNumber);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x050e0a, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x143020, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 14, label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#1a4a30',
      }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x0d1e18, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0x2a7a60, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + 16, label, {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: '#a0e8c8',
      }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 18, '☆☆☆', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#1a6040',
      }).setOrigin(0.5);

      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x163028, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x20c090, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x0d1e18, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x2a7a60, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x163028, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0x20c090, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);

      this.add.text(x + w / 2, y + 16, label, {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: '#20c090',
      }).setOrigin(0.5);

      const filledStars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 18, filledStars, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#20c090',
      }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 30, `HP ${prog.bestHpPercent}%`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: hpColor,
        }).setOrigin(0.5);
      }

      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    // Boss badge on stage 20
    if (cfg.bossWave) {
      this.add.text(x + w - 4, y + 4, '🦊', { fontSize: '11px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 3 section ──────────────────────────────────────────────────

  private drawCh3Section(): void {
    const ch3Unlocked = this.progress[19]?.bestStars > 0;

    const div = this.add.graphics();
    div.lineStyle(1, ch3Unlocked ? 0x2266cc : 0x1a2440, 0.6);
    div.lineBetween(30, 492, CANVAS_WIDTH - 30, 492);

    if (ch3Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 482, 'Chapter 3  —  용왕 해저궁', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4488ff', letterSpacing: 2,
      }).setOrigin(0.5, 1);
      this.drawCh3Grid();
    } else {
      this.add.text(CANVAS_WIDTH / 2, 482, 'Chapter 3  —  용왕 해저궁  🔒', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#1a3060', letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 500, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x020810, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x0a1830, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 20을 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#1a3880',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '용왕 해저궁  ·  12 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#0e1e48',
      }).setOrigin(0.5);
    }
  }

  private drawCh3Grid(): void {
    const COLS = 6, ROWS = 2;
    const BW = 48, BH = 62;
    const GAP_X = 6, GAP_Y = 10;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 506;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 20 + r * COLS + c;  // indices 20–31
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh3Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh3Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = cfg ? String(cfg.stageNumber) : String(idx + 1);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x020810, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x0a1830, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 12, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#0a2048' }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x050e20, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0x1a4488, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#88aaf8' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 16, '☆☆☆', { fontFamily: 'sans-serif', fontSize: '11px', color: '#1a3a88' }).setOrigin(0.5);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x0a1838, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x4488ff, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x050e20, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x1a4488, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x0a1838, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0x4488ff, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#4488ff' }).setOrigin(0.5);
      const stars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 16, stars, { fontFamily: 'sans-serif', fontSize: '11px', color: '#4488ff' }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 28, `HP ${prog.bestHpPercent}%`, { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
      }
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    if (cfg?.bossWave) {
      this.add.text(x + w - 4, y + 4, '🐲', { fontSize: '12px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 4 section ──────────────────────────────────────────────────

  private drawCh4Section(): void {
    const ch4Unlocked = this.progress[31]?.bestStars > 0;

    const div = this.add.graphics();
    div.lineStyle(1, ch4Unlocked ? 0xaa2244 : 0x3a1520, 0.6);
    div.lineBetween(30, 662, CANVAS_WIDTH - 30, 662);

    if (ch4Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 652, 'Chapter 4  —  저승 관문', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#cc2244', letterSpacing: 2,
      }).setOrigin(0.5, 1);
      this.drawCh4Grid();
    } else {
      this.add.text(CANVAS_WIDTH / 2, 652, 'Chapter 4  —  저승 관문  🔒', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#5a1a2a', letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 670, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x100008, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x3a0820, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 32를 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#6a1a30',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '저승 관문  ·  10 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#3a0a18',
      }).setOrigin(0.5);
    }
  }

  private drawCh4Grid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 56, BH = 62;
    const GAP_X = 6, GAP_Y = 10;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 672;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 32 + r * COLS + c;  // indices 32–41
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh4Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh4Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = cfg ? String(cfg.stageNumber) : String(idx + 1);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x100008, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3a0820, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 12, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#5a1030' }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x200010, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0x881030, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ff6688' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 16, '☆☆☆', { fontFamily: 'sans-serif', fontSize: '11px', color: '#881030' }).setOrigin(0.5);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x300018, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xcc2244, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x200010, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x881030, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x300018, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0xcc2244, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#cc2244' }).setOrigin(0.5);
      const stars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 16, stars, { fontFamily: 'sans-serif', fontSize: '11px', color: '#cc2244' }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 28, `HP ${prog.bestHpPercent}%`, { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
      }
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    if (cfg?.bossWave) {
      this.add.text(x + w - 4, y + 4, '☠️', { fontSize: '12px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 5 section ──────────────────────────────────────────────────

  private drawCh5Section(): void {
    const ch5Unlocked = this.progress[41]?.bestStars > 0;

    const div = this.add.graphics();
    div.lineStyle(1, ch5Unlocked ? 0xddaa00 : 0x3a2800, 0.6);
    div.lineBetween(30, 840, CANVAS_WIDTH - 30, 840);

    if (ch5Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 830, 'Chapter 5  —  삼신산', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#ddaa00', letterSpacing: 2,
      }).setOrigin(0.5, 1);
      this.drawCh5Grid();
    } else {
      this.add.text(CANVAS_WIDTH / 2, 830, 'Chapter 5  —  삼신산  🔒', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#5a4000', letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 848, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x0e0800, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x3a2800, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 42를 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#8a6000',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '삼신산  ·  10 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a3000',
      }).setOrigin(0.5);
    }
  }

  private drawCh5Grid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 56, BH = 62;
    const GAP_X = 6, GAP_Y = 10;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 850;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 42 + r * COLS + c;  // indices 42–51
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh5Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh5Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = cfg ? String(cfg.stageNumber) : String(idx + 1);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x0e0800, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3a2800, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 12, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#5a4000' }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x1a1000, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0xaa7700, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ffcc44' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 16, '☆☆☆', { fontFamily: 'sans-serif', fontSize: '11px', color: '#aa7700' }).setOrigin(0.5);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x281800, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xddaa00, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x1a1000, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xaa7700, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x281800, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0xddaa00, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ddaa00' }).setOrigin(0.5);
      const stars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 16, stars, { fontFamily: 'sans-serif', fontSize: '11px', color: '#ddaa00' }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 28, `HP ${prog.bestHpPercent}%`, { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
      }
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    if (cfg?.bossWave) {
      this.add.text(x + w - 4, y + 4, '🌟', { fontSize: '12px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 6 Section ──────────────────────────────────────────────────

  private drawCh6Section(): void {
    const ch6Unlocked = this.progress[51]?.bestStars > 0;

    const div = this.add.graphics();
    div.lineStyle(1, ch6Unlocked ? 0x8844cc : 0x2a1050, 0.6);
    div.lineBetween(30, 1010, CANVAS_WIDTH - 30, 1010);

    if (ch6Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 1000, 'Chapter 6  —  영원의 왕좌', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#d4af37', letterSpacing: 2,
      }).setOrigin(0.5, 1);
      this.drawCh6Grid();
    } else {
      this.add.text(CANVAS_WIDTH / 2, 1000, 'Chapter 6  —  영원의 왕좌  🔒', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a2870', letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 1018, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0018, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x2a1050, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 52를 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#8844cc',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '영원의 왕좌  ·  10 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a2870',
      }).setOrigin(0.5);
    }
  }

  private drawCh6Grid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 56, BH = 62;
    const GAP_X = 6, GAP_Y = 10;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 1020;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 52 + r * COLS + c;  // indices 52–61
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh6Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh6Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = cfg ? String(cfg.stageNumber) : String(idx + 1);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x0a0018, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x2a1050, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 12, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#4a2870' }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x140028, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0x8844cc, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#d4af37' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 16, '☆☆☆', { fontFamily: 'sans-serif', fontSize: '11px', color: '#8844cc' }).setOrigin(0.5);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x200040, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xd4af37, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x140028, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0x8844cc, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x200040, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0xd4af37, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#d4af37' }).setOrigin(0.5);
      const stars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 16, stars, { fontFamily: 'sans-serif', fontSize: '11px', color: '#d4af37' }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 28, `HP ${prog.bestHpPercent}%`, { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
      }
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    if (cfg?.bossWave) {
      this.add.text(x + w - 4, y + 4, '🌟', { fontSize: '12px' }).setOrigin(1, 0);
    }
  }

  // ─── Chapter 7 Section ──────────────────────────────────────────────────

  private drawCh7Section(): void {
    const ch7Unlocked = this.progress[61]?.bestStars > 0;

    const div = this.add.graphics();
    div.lineStyle(1, ch7Unlocked ? 0xffd700 : 0x2a1a00, 0.6);
    div.lineBetween(30, 1175, CANVAS_WIDTH - 30, 1175);

    if (ch7Unlocked) {
      this.add.text(CANVAS_WIDTH / 2, 1165, 'Chapter 7  —  신계 침공', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#ffd700', letterSpacing: 2,
      }).setOrigin(0.5, 1);
      this.drawCh7Grid();
    } else {
      this.add.text(CANVAS_WIDTH / 2, 1165, 'Chapter 7  —  신계 침공  🔒', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a3a00', letterSpacing: 2,
      }).setOrigin(0.5, 1);

      const bx = 30, by = 1183, bw = CANVAS_WIDTH - 60, bh = 56;
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0800, 1);
      bg.fillRoundedRect(bx, by, bw, bh, 8);
      bg.lineStyle(1, 0x3a2a00, 0.8);
      bg.strokeRoundedRect(bx, by, bw, bh, 8);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 - 6, '⛓ 스테이지 62를 클리어하면 열립니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#cc9900',
      }).setOrigin(0.5);
      this.add.text(CANVAS_WIDTH / 2, by + bh / 2 + 10, '신계 침공  ·  10 스테이지', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a3a00',
      }).setOrigin(0.5);
    }
  }

  private drawCh7Grid(): void {
    const COLS = 5, ROWS = 2;
    const BW = 56, BH = 62;
    const GAP_X = 6, GAP_Y = 10;
    const gridW = COLS * BW + (COLS - 1) * GAP_X;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 1185;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const stageIdx = 62 + r * COLS + c;  // indices 62–71
        const x = startX + c * (BW + GAP_X);
        const y = startY + r * (BH + GAP_Y);
        this.drawCh7Plaque(stageIdx, x, y, BW, BH);
      }
    }
  }

  private drawCh7Plaque(
    idx: number, x: number, y: number, w: number, h: number,
  ): void {
    const prog  = this.progress[idx];
    const cfg   = STAGE_CONFIGS[idx];
    const label = cfg ? String(cfg.stageNumber) : String(idx + 1);

    const bg = this.add.graphics();

    if (!prog?.unlocked) {
      bg.fillStyle(0x0a0800, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3a2a00, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + h / 2 - 4, '⛓', { fontFamily: 'sans-serif', fontSize: '18px' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 12, label, { fontFamily: 'sans-serif', fontSize: '10px', color: '#4a3a00' }).setOrigin(0.5);

    } else if (prog.bestStars === 0) {
      bg.fillStyle(0x1a1400, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1.5, 0xffd700, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd700' }).setOrigin(0.5);
      this.add.text(x + w / 2, y + h - 16, '☆☆☆', { fontFamily: 'sans-serif', fontSize: '11px', color: '#cc9900' }).setOrigin(0.5);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
      zone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x2a2000, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xffd700, 1); bg.strokeRoundedRect(x, y, w, h, 6); });
      zone.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x1a1400, 1); bg.fillRoundedRect(x, y, w, h, 6); bg.lineStyle(1.5, 0xffd700, 0.9); bg.strokeRoundedRect(x, y, w, h, 6); });

    } else {
      bg.fillStyle(0x2a2000, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, 0xffd700, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      this.add.text(x + w / 2, y + 14, label, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd700' }).setOrigin(0.5);
      const stars = '★'.repeat(prog.bestStars) + '☆'.repeat(3 - prog.bestStars);
      this.add.text(x + w / 2, y + h - 16, stars, { fontFamily: 'sans-serif', fontSize: '11px', color: '#ffd700' }).setOrigin(0.5);
      if (prog.bestHpPercent !== undefined) {
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(x + w / 2, y + h - 28, `HP ${prog.bestHpPercent}%`, { fontFamily: 'sans-serif', fontSize: '10px', color: hpColor }).setOrigin(0.5);
      }
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.launchStage(idx));
    }

    if (cfg?.bossWave) {
      this.add.text(x + w - 4, y + 4, '🌟', { fontSize: '12px' }).setOrigin(1, 0);
    }
  }

  // ─── Wisdom button ───────────────────────────────────────────────────────

  private drawWisdomButton(): void {
    const gameState = loadGameState();
    const crystals  = gameState.soulCrystals;

    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 976;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a0a2a, 1);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    bg.lineStyle(2, 0x7a30c8, 0.85);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

    this.add.text(CANVAS_WIDTH / 2, btnY + btnH / 2, `⛩ 선조의 지혜  💎${crystals}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: '#c070ff',
    }).setOrigin(0.5);

    const zone = this.add.zone(CANVAS_WIDTH / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => { bg.clear(); bg.fillStyle(0x2a1040, 1); bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8); bg.lineStyle(2, COLORS.TORCH_GOLD, 0.7); bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8); });
    zone.on('pointerout',   () => { bg.clear(); bg.fillStyle(0x1a0a2a, 1); bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8); bg.lineStyle(2, 0x7a30c8, 0.85); bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8); });
    zone.on('pointerdown',  () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AncestralWisdomScene'); });
  }

  // ─── Endless button ──────────────────────────────────────────────────────

  private drawEndlessButton(): void {
    // Unlocks when Stage 10 has been cleared (bestStars > 0)
    const stage10Cleared = this.progress[9]?.bestStars > 0;

    const btnW = 114, btnH = 44;
    const btnX = CANVAS_WIDTH / 2 - btnW - 4;
    const btnY = 1034;

    const bg = this.add.graphics();

    if (stage10Cleared) {
      bg.fillStyle(0x1a0808, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(2, 0xcc2200, 0.85);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

      this.add.text(btnX + btnW / 2, btnY + btnH / 2, '⚔ 무한 던전', {
        fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
        color: '#ff6644',
      }).setOrigin(0.5);

      const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x2a1010, 1);
        bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
        bg.lineStyle(2, COLORS.TORCH_GOLD, 0.7);
        bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      });
      zone.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x1a0808, 1);
        bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
        bg.lineStyle(2, 0xcc2200, 0.85);
        bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      });
      zone.on('pointerdown', () => {
        this.registry.set('stageConfig', { stageNumber: 0, slots: 9, endless: true });
        this.scene.start('DungeonScene');
      });
    } else {
      // Locked — show as greyed-out with lock
      bg.fillStyle(0x0e0a04, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(1, 0x3a2810, 0.6);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.add.text(btnX + btnW / 2, btnY + btnH / 2 - 4, '⛓', {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5);
      this.add.text(btnX + btnW / 2, btnY + btnH - 12, '무한 던전', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#5a3a1a',
      }).setOrigin(0.5);
      this.add.text(btnX + btnW / 2, btnY + btnH + 6, 'Ch.1 보스 클리어 후 해금', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#664444',
      }).setOrigin(0.5, 0);
    }
  }

  // ─── Achievement button ───────────────────────────────────────────────────

  private drawAchievementButton(): void {
    const btnW = 114, btnH = 44;
    const btnX = CANVAS_WIDTH / 2 + 4;
    const btnY = 1034;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a1a0a, 1);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    bg.lineStyle(2, 0x228822, 0.85);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '🏆 업적', {
      fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
      color: '#88cc44',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x0a2a0a, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(2, COLORS.TORCH_GOLD, 0.7);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x0a1a0a, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(2, 0x228822, 0.85);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerdown', () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AchievementScene'); });
  }

  // ─── Barracks button ─────────────────────────────────────────────────────

  private drawBarracksButton(): void {
    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 1088;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a1520, 1);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    bg.lineStyle(2, 0x3388cc, 0.85);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '⚔️ 몬스터 막사', {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: '#66aaff',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x0a2030, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(2, COLORS.TORCH_GOLD, 0.7);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x0a1520, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(2, 0x3388cc, 0.85);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerdown', () => this.scene.start('BarracksScene'));
  }

  // ─── Launch ─────────────────────────────────────────────────────────────

  private launchStage(idx: number): void {
    const cfg = STAGE_CONFIGS[idx];
    logger.debug(`[STAGE SELECT] launching stage ${cfg.stageNumber}`);
    // Pass config to DungeonScene via registry
    this.registry.set('stageConfig', cfg);

    // Check for unseen cinematic
    const cinematicId = STAGE_CINEMATICS[cfg.stageNumber];
    if (cinematicId) {
      const gs = loadGameState();
      const seen = gs.cinematicSeen ?? [];
      if (!seen.includes(cinematicId)) {
        this.scene.start('CinematicScene', {
          cinematicId,
          nextScene: 'DungeonScene',
        });
        return;
      }
    }

    this.scene.start('DungeonScene');
  }
}
