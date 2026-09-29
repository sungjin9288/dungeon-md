import Phaser from 'phaser';
import {
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
  ZONE_ACCENTS,
} from '../constants/colors';
import { CANVAS_WIDTH, ROOT_NAV_HEIGHT, ROOT_NAV_Y } from '../constants/layout';
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
import { addSigil, type SigilKind } from '../ui/Sigils';
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
  unclearedBorder:      ZONE_ACCENTS.invasion,
  unclearedHoverBg:     CASUAL.PANEL,
  unclearedHoverBorder: DUNGEON_UI.EMBER,
  unclearedLabelColor:  CASUAL_CSS.INK,
  unclearedStarColor:   CASUAL_CSS.INK_SOFT,
  clearedBg:            CASUAL.PANEL,
  clearedBorder:        CASUAL.GOLD,
  clearedLabelColor:    CASUAL_CSS.INK,
  starColor:            CASUAL_CSS.GOLD,
  bossEmoji:            '👹',
  accent:               ZONE_ACCENTS.invasion,
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
  //   btnY 4658 + btnH 48 + 28 padding ≈ 4734, plus fixed navigation clearance.
  // Scroll clamp is derived live from this + the DPR-zoom camera offset
  // (see the pointermove handler) so the true top (world y=0) stays reachable.
  private contentHeight = 4734 + ROOT_NAV_HEIGHT;
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
    // Shared charcoal-indigo dungeon atmosphere.
    applyCasualBackground(this);

    // Fixed invasion lintel. It reads as dungeon hardware, not a dashboard card.
    const offset = getSceneFixedShellViewportOffset(this);
    const header = this.add.container(offset.x, offset.y).setScrollFactor(0).setDepth(-10);
    this.fixedHeaderContainer = header;
    const g = this.add.graphics();
    header.add(g);
    g.fillStyle(DUNGEON_UI.SOOT, 0.98);
    g.fillRect(0, 0, CANVAS_WIDTH, 124);
    g.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 5);
    g.fillStyle(DUNGEON_UI.IRON, 0.9);
    g.fillRect(0, 5, 8, 116);
    g.fillRect(CANVAS_WIDTH - 8, 5, 8, 116);
    g.fillStyle(ZONE_ACCENTS.invasion, 0.92);
    g.fillRect(0, 121, CANVAS_WIDTH, 3);
    g.fillStyle(DUNGEON_UI.BRASS, 0.72);
    g.fillRect(24, 118, CANVAS_WIDTH - 48, 1);
  }

  // ─── Header ─────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.fixedHeaderContainer?.setDepth(10);
    this.drawTitleFlourish(CANVAS_WIDTH / 2, 43, '침공 전선', 21);
    buildZoneBackButton(this, {
      label: '← 던전',
      onBack: () => this.scene.start(getContextualBackTarget('StageSelectScene')),
    });

    const subtitle = this.add.text(CANVAS_WIDTH / 2, 76, '도깨비 숲 · 제1장 · 관문 1–10', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: DUNGEON_UI_CSS.MUTED,
      letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0);
    this.fixedHeaderContainer?.add(subtitle);

    // Route rule: brass trail ending in an ember invasion seal.
    const div = this.add.graphics().setScrollFactor(0);
    div.lineStyle(2, DUNGEON_UI.IRON, 0.9);
    div.lineBetween(30, 99, CANVAS_WIDTH - 30, 99);
    div.lineStyle(1, DUNGEON_UI.BRASS, 0.8);
    div.lineBetween(62, 99, CANVAS_WIDTH - 62, 99);
    div.fillStyle(ZONE_ACCENTS.invasion, 1);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 99, CANVAS_WIDTH / 2 + 5, 99, CANVAS_WIDTH / 2, 93);
    div.fillTriangle(CANVAS_WIDTH / 2 - 5, 99, CANVAS_WIDTH / 2 + 5, 99, CANVAS_WIDTH / 2, 105);
    this.fixedHeaderContainer?.add(div);

    drawChapterProgressBar(this, 0, 10, 113, this.progress, this.fixedHeaderContainer);
  }

  /**
   * Draws the invasion lintel title with restrained Korean craft geometry.
   */
  private drawTitleFlourish(cx: number, cy: number, text: string, fontSize: number): void {
    const title = this.add.text(cx, cy, text, {
      fontFamily: 'sans-serif',
      fontSize: `${fontSize}px`, fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
      stroke: '#030504', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0);
    this.fixedHeaderContainer?.add(title);

    // Measure title bounds to place ornaments
    const bounds = title.getBounds();
    const padX = 14;

    // Left ornament — small diamond + short line
    const ornL = this.add.graphics().setScrollFactor(0);
    ornL.fillStyle(ZONE_ACCENTS.invasion, 1);
    const lx = bounds.left - padX;
    ornL.fillTriangle(lx - 5, cy, lx, cy - 4, lx, cy + 4);
    ornL.lineStyle(1.5, DUNGEON_UI.BRASS, 0.75);
    ornL.lineBetween(lx - 22, cy, lx - 7, cy);
    this.fixedHeaderContainer?.add(ornL);

    // Right ornament — mirror
    const ornR = this.add.graphics().setScrollFactor(0);
    ornR.fillStyle(ZONE_ACCENTS.invasion, 1);
    const rx = bounds.right + padX;
    ornR.fillTriangle(rx + 5, cy, rx, cy - 4, rx, cy + 4);
    ornR.lineStyle(1.5, DUNGEON_UI.BRASS, 0.75);
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

    this.buildDungeonCommand(
      btnX, btnY, btnW, btnH,
      `선조의 지혜 · 결정 ${crystals}`,
      CASUAL.PURPLE, CASUAL_CSS.PURPLE,
      () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AncestralWisdomScene'); },
      '14px', 'pagoda',
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
      this.buildDungeonCommand(
        btnX, btnY, btnW, btnH,
        '무한 던전',
        CASUAL.RED, CASUAL_CSS.RED,
        () => {
          this.registry.set('stageConfig', { stageNumber: 0, endless: true });
          this.scene.start('DungeonScene');
        },
        '12px', 'infinity',
      );
    } else {
      // Locked — sealed iron command.
      const bg = this.add.graphics();
      bg.fillStyle(DUNGEON_UI.SOOT, 0.84);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      bg.lineStyle(1, DUNGEON_UI.IRON, 0.78);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      bg.lineStyle(2, DUNGEON_UI.EDGE, 0.65);
      bg.lineBetween(btnX + 18, btnY + 13, btnX + btnW - 18, btnY + 13);
      this.add.text(btnX + btnW / 2, btnY + 28, '무한 던전 · 봉인', {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
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

    this.buildDungeonCommand(
      btnX, btnY, btnW, btnH,
      '업적',
      CASUAL.GREEN, CASUAL_CSS.GREEN,
      () => { this.registry.set('previousScene', 'StageSelectScene'); this.scene.start('AchievementScene'); },
      '12px', 'star',
    );
  }

  // ─── Barracks button ─────────────────────────────────────────────────────

  private drawBarracksButton(): void {
    const btnW = 240, btnH = 48;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;
    const btnY = 4600;

    this.buildDungeonCommand(
      btnX, btnY, btnW, btnH,
      '몬스터 막사',
      CASUAL.BLUE, CASUAL_CSS.BLUE,
      () => this.scene.start('BarracksScene'),
      '14px', 'swords',
    );
  }

  private drawAbyssButton(): void {
    // Dungeon-management hubs: Abyss (active farming), Production (idle
    // materials), Decorations (set bonuses) — all resource/economy destinations.
    const gap = 8, totalW = 362, btnH = 48;
    const btnW = (totalW - gap * 2) / 3;
    const startX = CANVAS_WIDTH / 2 - totalW / 2;
    const btnY = 4658;

    this.buildDungeonCommand(
      startX, btnY, btnW, btnH, '심연',
      CASUAL.PURPLE, CASUAL_CSS.PURPLE,
      () => this.scene.start('AbyssScene'), '13px', 'orb',
    );
    this.buildDungeonCommand(
      startX + btnW + gap, btnY, btnW, btnH, '생산',
      CASUAL.GOLD, CASUAL_CSS.GOLD,
      () => this.scene.start('ProductionScene'), '13px', 'hammer',
    );
    this.buildDungeonCommand(
      startX + (btnW + gap) * 2, btnY, btnW, btnH, '장식',
      CASUAL.GREEN, CASUAL_CSS.GREEN,
      () => this.scene.start('DecorationScene'), '13px', 'banner',
    );
  }

  // ─── Dungeon command helper ────────────────────────────────────────────────

  private buildDungeonCommand(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: number,
    labelColor: string,
    cb: () => void,
    fontSize = '14px',
    sigil?: SigilKind,
  ): void {
    const radius = 6;
    const draw = (pressed: boolean): void => {
      bg.clear();
      bg.fillStyle(DUNGEON_UI.SOOT, 0.72);
      bg.fillRoundedRect(x + 2, y + 3, w, h, radius);
      bg.fillStyle(pressed ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
      bg.fillRoundedRect(x, y, w, h, radius);
      bg.fillStyle(accent, pressed ? 0.92 : 0.72);
      bg.fillRect(x, y + 5, 3, h - 10);
      bg.lineStyle(1.5, pressed ? accent : DUNGEON_UI.IRON, 0.95);
      bg.strokeRoundedRect(x, y, w, h, radius);
    };
    const bg = this.add.graphics();
    draw(false);

    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize, fontStyle: 'bold', color: labelColor,
    }).setOrigin(0.5);
    if (sigil) {
      // Sigil + label centred as one group.
      const size = 16, gap = 6;
      const left = x + (w - (size + gap + text.width)) / 2;
      addSigil(this, sigil, left + size / 2, y + h / 2, size, accent);
      text.setX(left + size + gap + text.width / 2);
    }

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
