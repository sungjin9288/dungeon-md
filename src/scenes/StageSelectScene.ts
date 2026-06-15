import Phaser from 'phaser';
import { COLORS, CSS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { loadGameState } from '../data/wisdom';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8 } from '../data/stages';
import type { InvaderType } from '../data/invaders';
import { addPanelShadow } from '../ui/PanelDepth';
import {
  type StageProgress, TOTAL_STAGES, STAGE_CONFIGS,
  loadProgress, saveProgress, recordClear,
} from '../data/stageProgress';
import {
  CHAPTER_PLAQUE_THEMES, CHAPTER_SECTION_DATA,
  drawChapterSection, drawChapterProgressBar, addStarPop,
} from '../ui/StagePlaque';

export type { StageProgress };
export { TOTAL_STAGES, STAGE_CONFIGS, loadProgress, saveProgress, recordClear };

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
  swarm_larva: '🐛', swarm_spawn: '🐜', plague_herald: '☠️', titan_sentinel: '🪨',
  void_colossus: '🌑', eternal_emperor: '👑',
  celestial_knight: '🌟', divine_archer: '🏹', sky_titan: '⛅',
  radiant_seraph: '😇', heaven_general: '👑', celestial_dragon: '🐉', god_emperor: '👼',
  // Ch8 — 원초의 심연
  void_soldier: '🌑', abyss_berserker: '🔥', primordial_guard: '💜', primordial_titan: '💫',
};

// Compute top-2 invader type emojis for each stage (index 0-79)
const ALL_STAGES = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4,
  ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8,
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

function drawStageAccent(
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

function pressStagePlaque(
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

// ─── StageSelectScene ─────────────────────────────────────────────────────────

export class StageSelectScene extends Phaser.Scene {
  private progress: StageProgress[] = [];
  private isDragging    = false;
  private dragStartY    = 0;
  private maxScrollY    = 820;
  private frontierIdx   = 0;

  constructor() { super({ key: 'StageSelectScene' }); }

  create(): void {
    this.progress = loadProgress();

    // Find the frontier: first unlocked stage with no clear
    this.frontierIdx = this.progress.findIndex(p => p.unlocked && p.bestStars === 0);
    if (this.frontierIdx < 0) this.frontierIdx = this.progress.length; // all cleared

    this.drawBackground();
    this.drawHeader();
    this.drawGrid();
    for (let i = 0; i < CHAPTER_SECTION_DATA.length; i++) {
      drawChapterSection(
        this,
        CHAPTER_SECTION_DATA[i],
        CHAPTER_PLAQUE_THEMES[i],
        this.progress,
        (idx) => this.showRewardPreview(idx),
        this.frontierIdx,
      );
    }
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
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    // Fixed to the viewport (scrollFactor 0) so it stays put as the camera scrolls.
    applyCasualBackground(this);

    // Top header band (cream with white top highlight + brown bottom edge).
    const g = this.add.graphics().setScrollFactor(0).setDepth(-10);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 124);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.SHADOW, 0.18);
    g.fillRect(0, 124, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, 124 - 3, CANVAS_WIDTH, 3);
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  private drawHeader(): void {
    // Phase B2: ornate header flourish — diamond ornaments flanking the title
    this.drawTitleFlourish(CANVAS_WIDTH / 2, 48, '도깨비 숲', 26);

    this.add.text(CANVAS_WIDTH / 2, 84, 'Chapter 1  —  10 스테이지', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CASUAL_CSS.INK_SOFT,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Decorative double divider line
    const div = this.add.graphics();
    div.lineStyle(1, CASUAL.EDGE, 0.55);
    div.lineBetween(30, 102, CANVAS_WIDTH - 30, 102);
    div.lineStyle(0.5, CASUAL.EDGE_SOFT, 0.4);
    div.lineBetween(30, 105, CANVAS_WIDTH - 30, 105);
    // Center diamond ornament on divider
    div.fillStyle(CASUAL.GOLD, 1);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 103, CANVAS_WIDTH / 2 + 5, 103, CANVAS_WIDTH / 2, 98);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 103, CANVAS_WIDTH / 2 + 5, 103, CANVAS_WIDTH / 2, 108);

    drawChapterProgressBar(this, 0, 10, 116, this.progress);
  }

  /**
   * Phase B2: draws a chapter title with decorative flanking ornaments.
   * Used by drawHeader + inline chapter section headers.
   */
  private drawTitleFlourish(cx: number, cy: number, text: string, fontSize: number): void {
    const title = this.add.text(cx, cy, text, {
      fontFamily: 'sans-serif',
      fontSize: `${fontSize}px`, fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5);

    // Measure title bounds to place ornaments
    const bounds = title.getBounds();
    const padX = 14;

    // Left ornament — small diamond + short line
    const ornL = this.add.graphics();
    ornL.fillStyle(CASUAL.GOLD, 1);
    const lx = bounds.left - padX;
    ornL.fillTriangle(lx - 5, cy, lx, cy - 4, lx, cy + 4);
    ornL.lineStyle(1.5, CASUAL.EDGE, 0.7);
    ornL.lineBetween(lx - 22, cy, lx - 7, cy);

    // Right ornament — mirror
    const ornR = this.add.graphics();
    ornR.fillStyle(CASUAL.GOLD, 1);
    const rx = bounds.right + padX;
    ornR.fillTriangle(rx + 5, cy, rx, cy - 4, rx, cy + 4);
    ornR.lineStyle(1.5, CASUAL.EDGE, 0.7);
    ornR.lineBetween(rx + 7, cy, rx + 22, cy);
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

    // Phase B2: drop shadow behind every unlocked stage card
    if (prog.unlocked) {
      addPanelShadow(this, x, y, w, h, 6, { offsetY: 2, opacity: 0.55 });
    }

    const bg = this.add.graphics();

    if (!prog.unlocked) {
      // Locked — dark plaque
      bg.fillStyle(0x0e0a04, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3a2810, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      drawStageAccent(bg, x, y, w, 0x3a2810, 0.35);

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
      drawStageAccent(bg, x, y, w, COLORS.TORCH_GOLD, idx === this.frontierIdx ? 0.9 : 0.55);

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
      zone.on('pointerdown', () => pressStagePlaque(this, bg, () => this.showRewardPreview(idx)));
      zone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x3d3020, 1);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.lineStyle(1.5, COLORS.TORCH_GOLD, 0.75);
        bg.strokeRoundedRect(x, y, w, h, 6);
        drawStageAccent(bg, x, y, w, COLORS.TORCH_GOLD, 0.9);
      });
      zone.on('pointerout',  () => {
        bg.clear();
        bg.fillStyle(0x2d2416, 1);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.lineStyle(1.5, 0x6a4820, 0.9);
        bg.strokeRoundedRect(x, y, w, h, 6);
        drawStageAccent(bg, x, y, w, COLORS.TORCH_GOLD, idx === this.frontierIdx ? 0.9 : 0.55);
      });

    } else {
      // Cleared — gold glow
      bg.fillStyle(0x3d3020, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(2, COLORS.TORCH_GOLD, 0.9);
      bg.strokeRoundedRect(x, y, w, h, 6);
      drawStageAccent(bg, x, y, w, COLORS.TORCH_GOLD, 0.85);

      this.add.text(x + w / 2, y + 16, label, {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);

      addStarPop(this, x + w / 2, y + h - 18, prog.bestStars, CSS.TORCH_AMBER);

      // Enemy type icons
      const icons1 = STAGE_ENEMY_ICONS[idx];
      if (icons1) {
        this.add.text(x + w / 2, y + 30, icons1, {
          fontFamily: 'sans-serif', fontSize: '10px',
        }).setOrigin(0.5).setAlpha(0.5);
      }

      if (prog.bestHpPercent !== undefined) {
        const pct     = prog.bestHpPercent / 100;
        const hpColor = prog.bestHpPercent >= 80 ? '#44ff88' : prog.bestHpPercent >= 40 ? '#ffcc44' : '#ff6644';
        const fillRgb = prog.bestHpPercent >= 80 ? 0x44ff88 : prog.bestHpPercent >= 40 ? 0xffcc44 : 0xff6644;
        const barW    = w - 14;
        const barX    = x + 7;
        const barY    = y + h - 26;
        const hpBar   = this.add.graphics();
        hpBar.fillStyle(0x222222, 0.9);
        hpBar.fillRoundedRect(barX, barY, barW, 4, 2);
        hpBar.fillStyle(fillRgb, 1);
        hpBar.fillRoundedRect(barX, barY, Math.max(2, barW * pct), 4, 2);
        this.add.text(x + w / 2, barY - 9, `❤ ${prog.bestHpPercent}%`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: hpColor,
        }).setOrigin(0.5);
      }

      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => pressStagePlaque(this, bg, () => this.showRewardPreview(idx)));
    }

    // Phase B2: boss stage — red pulsing ring + larger badge
    if (cfg.bossWave) {
      if (prog.unlocked) {
        const bossRing = this.add.graphics();
        bossRing.lineStyle(2, 0xcc2222, 0.85);
        bossRing.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 7);
        this.tweens.add({
          targets: bossRing,
          alpha: { from: 0.4, to: 1 },
          duration: 900,
          yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      // Slightly larger boss icon, pulsing
      const bossIcon = this.add.text(x + w - 5, y + 5, '👹', {
        fontSize: '14px',
      }).setOrigin(1, 0);
      this.tweens.add({
        targets: bossIcon,
        scaleX: 1.15, scaleY: 1.15,
        duration: 700,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Frontier pulse ring — first unlocked uncleared stage
    if (idx === this.frontierIdx) {
      const ring = this.add.graphics();
      ring.lineStyle(2.5, COLORS.TORCH_GOLD, 1);
      ring.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
      this.tweens.add({
        targets: ring,
        alpha: { from: 0.3, to: 1.0 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      const cue = this.add.graphics();
      cue.fillStyle(COLORS.TORCH_GOLD, 0.95);
      cue.fillTriangle(x + 7, y + 9, x + 7, y + 21, x + 17, y + 15);
    }
  }

  // ─── Wisdom button ───────────────────────────────────────────────────────

  private drawWisdomButton(): void {
    const gameState = loadGameState();
    const crystals  = gameState.soulCrystals;

    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 976;

    this.buildCasualButton(
      btnX, btnY, btnW, btnH,
      `⛩ 선조의 지혜  💠${crystals}`,
      CASUAL.PURPLE, CASUAL_CSS.PURPLE,
      () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AncestralWisdomScene'); },
    );
  }

  // ─── Endless button ──────────────────────────────────────────────────────

  private drawEndlessButton(): void {
    // Unlocks when Stage 10 has been cleared (bestStars > 0)
    const stage10Cleared = this.progress[9]?.bestStars > 0;

    const btnW = 114, btnH = 44;
    const btnX = CANVAS_WIDTH / 2 - btnW - 4;
    const btnY = 1034;

    if (stage10Cleared) {
      this.buildCasualButton(
        btnX, btnY, btnW, btnH,
        '⚔ 무한 던전',
        CASUAL.RED, CASUAL_CSS.RED,
        () => {
          this.registry.set('stageConfig', { stageNumber: 0, slots: 9, endless: true });
          this.scene.start('DungeonScene');
        },
        '12px',
      );
    } else {
      // Locked — muted cream pill with lock
      const bg = this.add.graphics();
      bg.fillStyle(CASUAL.SHADOW, 0.18);
      bg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 12);
      bg.fillStyle(CASUAL.PANEL_SOFT, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
      bg.lineStyle(3, CASUAL.EDGE_SOFT, 0.85);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 12);
      this.add.text(btnX + btnW / 2, btnY + btnH / 2 - 4, '⛓', {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5);
      this.add.text(btnX + btnW / 2, btnY + btnH - 12, '무한 던전', {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0.5);
      this.add.text(btnX + btnW / 2, btnY + btnH + 6, 'Ch.1 보스 클리어 후 해금', {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0.5, 0);
    }
  }

  // ─── Achievement button ───────────────────────────────────────────────────

  private drawAchievementButton(): void {
    const btnW = 114, btnH = 44;
    const btnX = CANVAS_WIDTH / 2 + 4;
    const btnY = 1034;

    this.buildCasualButton(
      btnX, btnY, btnW, btnH,
      '🏆 업적',
      CASUAL.GREEN, CASUAL_CSS.GREEN,
      () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AchievementScene'); },
      '12px',
    );
  }

  // ─── Barracks button ─────────────────────────────────────────────────────

  private drawBarracksButton(): void {
    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 1088;

    this.buildCasualButton(
      btnX, btnY, btnW, btnH,
      '⚔️ 몬스터 막사',
      CASUAL.BLUE, CASUAL_CSS.BLUE,
      () => this.scene.start('BarracksScene'),
    );
  }

  // ─── Casual button helper ─────────────────────────────────────────────────
  // Cream pill + 3px brown border + saturated semantic accent ring + white
  // top highlight + soft drop shadow. Mirrors BarracksScene's casual chrome.

  private buildCasualButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: number,
    labelColor: string,
    cb: () => void,
    fontSize = '14px',
  ): void {
    const radius = 12;
    const draw = (pressed: boolean): void => {
      bg.clear();
      bg.fillStyle(CASUAL.SHADOW, 0.22);
      bg.fillRoundedRect(x, y + 4, w, h, radius);
      bg.fillStyle(pressed ? CASUAL.PANEL_SOFT : CASUAL.PANEL, 1);
      bg.fillRoundedRect(x, y, w, h, radius);
      bg.fillStyle(0xffffff, 0.45);
      bg.fillRoundedRect(x + 5, y + 4, w - 10, 6, 3);
      bg.lineStyle(3, CASUAL.EDGE, 1);
      bg.strokeRoundedRect(x, y, w, h, radius);
      bg.lineStyle(1.5, accent, 0.9);
      bg.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, radius - 3);
    };
    const bg = this.add.graphics();
    draw(false);

    this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize, fontStyle: 'bold', color: labelColor,
    }).setOrigin(0.5);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', cb);
  }

  // ─── Reward Preview Popup ────────────────────────────────────────────────

  private showRewardPreview(idx: number): void {
    // Use an overlay scene (separate from StageSelectScene's scrolling camera)
    this.registry.set('_rewardPreviewIdx', idx);
    if (!this.scene.isActive('StageRewardOverlay')) {
      this.scene.launch('StageRewardOverlay');
    } else {
      this.scene.get('StageRewardOverlay').scene.restart();
    }
    this.scene.bringToTop('StageRewardOverlay');
  }

  // ─── Launch ─────────────────────────────────────────────────────────────

  launchStage(idx: number): void {
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
