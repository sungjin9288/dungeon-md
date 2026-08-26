import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, ROOT_NAV_Y } from '../constants/layout';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { getContextualBackTarget, getZoneDestination } from '../data/navigationContract';
import {
  buildHomeZoneNavigation,
  buildZoneBackButton,
  getLogicalViewportPointerY,
  getSceneFixedShellViewportOffset,
} from '../ui/GameZoneNavigation';
import { loadGameState } from '../data/wisdom';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';
import {
  type StageProgress, TOTAL_STAGES, STAGE_CONFIGS,
  loadProgress, saveProgress, recordClear,
} from '../data/stageProgress';
import {
  CHAPTER_PLAQUE_THEMES, CHAPTER_SECTION_DATA,
  drawChapterSection, drawChapterProgressBar,
  drawGenericPlaque, buildJourneyPathPositions, drawJourneyTrail,
  JOURNEY_NODE_W, JOURNEY_NODE_H,
  type PlaqueTheme,
} from '../ui/StagePlaque';

export type { StageProgress };
export { TOTAL_STAGES, STAGE_CONFIGS, loadProgress, saveProgress, recordClear };

// ── Chapter 1 plaque theme ────────────────────────────────────────────────────
// Mirrors the inline Ch1 colours from the old drawStagePlaque() method.

const CHAPTER_1_THEME: PlaqueTheme = {
  lockedBg:             CASUAL.PANEL_SOFT,
  lockedBorder:         CASUAL.EDGE_SOFT,
  lockedLabelColor:     CASUAL_CSS.INK_SOFT,
  unclearedBg:          CASUAL.PANEL,
  unclearedBorder:      CASUAL.EDGE,
  unclearedHoverBg:     CASUAL.PANEL,
  unclearedHoverBorder: CASUAL.GREEN_DK,
  unclearedLabelColor:  CASUAL_CSS.INK,
  unclearedStarColor:   CASUAL_CSS.INK_SOFT,
  clearedBg:            CASUAL.PANEL,
  clearedBorder:        CASUAL.GOLD,
  clearedLabelColor:    CASUAL_CSS.INK,
  starColor:            CASUAL_CSS.GOLD,
  bossEmoji:            '👹',
  accent:               CASUAL.GREEN,
  showHpBar:            true,
};

// ─── StageSelectScene ─────────────────────────────────────────────────────────

export class StageSelectScene extends Phaser.Scene {
  private progress: StageProgress[] = [];
  private isDragging    = false;
  private dragStartY    = 0;
  // Journey path layout: 9 chapters total. Heights:
  //   Ch1–2,4–7,9 (10 stages): 424px path + 60px header = 484px
  //   Ch3 (12 stages):         512px path + 60px header = 572px
  //   Ch8 (8 stages):          336px path + 60px header = 396px
  // Ch9 (st81–90) sits below Ch8 (path bottom ≈ 4448), pushing the hub buttons
  // down by one 10-stage section (+484) from their pre-Ch9 positions.
  // Total content bottom = deepest hub button row (abyss/생산/장식):
  //   btnY 4658 + btnH 48 + 28 padding ≈ 4734.
  // Scroll clamp is derived live from this + the DPR-zoom camera offset
  // (see the pointermove handler) so the true top (world y=0) stays reachable.
  private contentHeight = 4734;
  private frontierIdx   = 0;
  private fixedHeaderContainer?: Phaser.GameObjects.Container;

  constructor() { super({ key: 'StageSelectScene' }); }

  create(): void {
    this.progress = loadProgress();

    // Find the frontier: first unlocked stage with no clear
    this.frontierIdx = this.progress.findIndex(p => p.unlocked && p.bestStars === 0);
    if (this.frontierIdx < 0) this.frontierIdx = this.progress.length; // all cleared

    this.drawBackground();
    this.drawHeader();
    this.drawChapter1Path();
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
    this.drawAbyssButton();
    buildHomeZoneNavigation(this, 'invasion', (zone) => {
      this.scene.start(getZoneDestination(zone));
    });

    // Camera scroll via drag.
    // NOTE: main.ts applyDprCamera() zooms the camera by dpr and centerOn()s the
    // canvas, so the scroll value that shows world y=0 at the top is NEGATIVE
    // (= -(camHeight - camHeight/zoom)/2), not 0. Clamping to [0, …] would
    // amputate the top chapters. We derive the true [top, bottom] scroll range
    // live from the camera's current zoom + height (DPR-agnostic).
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, this.contentHeight);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const pointerY = getLogicalViewportPointerY(p.y, this.cameras.main.zoom);
      // Fixed header and root navigation are controls, never drag handles.
      if (pointerY < 124 || pointerY >= ROOT_NAV_Y) {
        this.isDragging = false;
        return;
      }
      this.isDragging = true;
      this.dragStartY = pointerY + this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const cam = this.cameras.main;
      const pointerY = getLogicalViewportPointerY(p.y, cam.zoom);
      const viewH = cam.height / cam.zoom;                 // visible world px (≈ CANVAS_HEIGHT)
      const topScrollY = -(cam.height - viewH) / 2;        // scroll that shows world y=0
      const bottomScrollY = topScrollY + Math.max(0, this.contentHeight - viewH);
      const newScrollY = Phaser.Math.Clamp(this.dragStartY - pointerY, topScrollY, bottomScrollY);
      cam.setScroll(0, newScrollY);
    });
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  // ─── Background ─────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    // Fixed to the viewport (scrollFactor 0) so it stays put as the camera scrolls.
    applyCasualBackground(this);

    // Top header band (cream with white top highlight + brown bottom edge).
    const offset = getSceneFixedShellViewportOffset(this);
    const header = this.add.container(offset.x, offset.y).setScrollFactor(0).setDepth(-10);
    this.fixedHeaderContainer = header;
    const g = this.add.graphics();
    header.add(g);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 124);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.SHADOW, 0.18);
    g.fillRect(0, 124, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, 124 - 3, CANVAS_WIDTH, 3);
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.fixedHeaderContainer?.setDepth(10);
    // Phase B2: ornate header flourish — diamond ornaments flanking the title
    this.drawTitleFlourish(CANVAS_WIDTH / 2, 48, '침공 · 도깨비 숲', 20);
    buildZoneBackButton(this, {
      label: '← 던전',
      onBack: () => this.scene.start(getContextualBackTarget('StageSelectScene')),
    });

    const subtitle = this.add.text(CANVAS_WIDTH / 2, 84, 'Chapter 1  —  10 스테이지', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CASUAL_CSS.INK_SOFT,
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    this.fixedHeaderContainer?.add(subtitle);

    // Decorative double divider line
    const div = this.add.graphics().setScrollFactor(0);
    div.lineStyle(1, CASUAL.EDGE, 0.55);
    div.lineBetween(30, 102, CANVAS_WIDTH - 30, 102);
    div.lineStyle(0.5, CASUAL.EDGE_SOFT, 0.4);
    div.lineBetween(30, 105, CANVAS_WIDTH - 30, 105);
    // Center diamond ornament on divider
    div.fillStyle(CASUAL.GOLD, 1);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 103, CANVAS_WIDTH / 2 + 5, 103, CANVAS_WIDTH / 2, 98);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 103, CANVAS_WIDTH / 2 + 5, 103, CANVAS_WIDTH / 2, 108);
    this.fixedHeaderContainer?.add(div);

    drawChapterProgressBar(this, 0, 10, 116, this.progress, this.fixedHeaderContainer);
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
    }).setOrigin(0.5).setScrollFactor(0);
    this.fixedHeaderContainer?.add(title);

    // Measure title bounds to place ornaments
    const bounds = title.getBounds();
    const padX = 14;

    // Left ornament — small diamond + short line
    const ornL = this.add.graphics().setScrollFactor(0);
    ornL.fillStyle(CASUAL.GOLD, 1);
    const lx = bounds.left - padX;
    ornL.fillTriangle(lx - 5, cy, lx, cy - 4, lx, cy + 4);
    ornL.lineStyle(1.5, CASUAL.EDGE, 0.7);
    ornL.lineBetween(lx - 22, cy, lx - 7, cy);
    this.fixedHeaderContainer?.add(ornL);

    // Right ornament — mirror
    const ornR = this.add.graphics().setScrollFactor(0);
    ornR.fillStyle(CASUAL.GOLD, 1);
    const rx = bounds.right + padX;
    ornR.fillTriangle(rx + 5, cy, rx, cy - 4, rx, cy + 4);
    ornR.lineStyle(1.5, CASUAL.EDGE, 0.7);
    ornR.lineBetween(rx + 7, cy, rx + 22, cy);
    this.fixedHeaderContainer?.add(ornR);
  }

  // ─── Chapter 1 journey path ──────────────────────────────────────────────
  // Replaces the old flat 2×5 grid with a serpentine path of 10 nodes.
  // Ch1 header ends at ~124; path starts at 136.

  private drawChapter1Path(): void {
    const CH1_COUNT  = 10;
    const PATH_START = 136;
    const positions  = buildJourneyPathPositions(CH1_COUNT, PATH_START);

    // Local frontier (0–9 within Ch1, or CH1_COUNT if all cleared)
    const localFrontier = this.frontierIdx < CH1_COUNT ? this.frontierIdx : CH1_COUNT;

    // Trail first (behind nodes)
    drawJourneyTrail(this, positions, localFrontier, CASUAL.GOLD);

    // Nodes via shared drawGenericPlaque
    for (let i = 0; i < CH1_COUNT; i++) {
      const { x, y } = positions[i];
      drawGenericPlaque(
        this, i, x, y,
        JOURNEY_NODE_W, JOURNEY_NODE_H,
        CHAPTER_1_THEME, this.progress,
        (idx) => this.showRewardPreview(idx),
        this.frontierIdx,
      );
    }
  }

  // ─── Wisdom button ───────────────────────────────────────────────────────
  // Hub buttons sit after all 9 chapter path sections.
  // Ch9 bottom: 4024 + journeyPathHeight(10)=424 = 4448, +40 gap → 4488.

  private drawWisdomButton(): void {
    const gameState = loadGameState();
    const crystals  = gameState.soulCrystals;

    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 4488;

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
    const btnY = 4546;

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
    const btnY = 4546;

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
    const btnY = 4600;

    this.buildCasualButton(
      btnX, btnY, btnW, btnH,
      '⚔️ 몬스터 막사',
      CASUAL.BLUE, CASUAL_CSS.BLUE,
      () => this.scene.start('BarracksScene'),
    );
  }

  private drawAbyssButton(): void {
    // Dungeon-management hubs: Abyss (active farming), Production (idle
    // materials), Decorations (set bonuses) — all resource/economy destinations.
    const gap = 8, totalW = 362, btnH = 48;
    const btnW = (totalW - gap * 2) / 3;
    const startX = CANVAS_WIDTH / 2 - totalW / 2;
    const btnY = 4658;

    this.buildCasualButton(
      startX, btnY, btnW, btnH, '🕳 심연',
      CASUAL.PURPLE, CASUAL_CSS.PURPLE,
      () => this.scene.start('AbyssScene'), '13px',
    );
    this.buildCasualButton(
      startX + btnW + gap, btnY, btnW, btnH, '🏭 생산',
      CASUAL.GOLD, CASUAL_CSS.GOLD,
      () => this.scene.start('ProductionScene'), '13px',
    );
    this.buildCasualButton(
      startX + (btnW + gap) * 2, btnY, btnW, btnH, '🎏 장식',
      CASUAL.GREEN, CASUAL_CSS.GREEN,
      () => this.scene.start('DecorationScene'), '13px',
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
      bg.fillStyle(0xffffff, 0.12);
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
