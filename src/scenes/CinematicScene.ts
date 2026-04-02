import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { type DialogueLine, type CinematicDef, getCinematic } from '../data/cinematics';
import { loadGameState, saveGameState } from '../data/wisdom';

// ─── Scene data passed via scene.start ────────────────────────────────────────

export interface CinematicSceneData {
  cinematicId: string;         // which cinematic to play
  nextScene:   string;         // scene key to launch after finish
  nextData?:   object;         // data to pass to next scene
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PANEL_H   = 260;
const PANEL_Y   = CANVAS_HEIGHT - PANEL_H;
const CHAR_MS   = 28;   // ms per character (typewriter speed)
const PANEL_PAD = 20;

// Emoji → glow color
function glowColor(emoji: string): number {
  if (emoji === '⛩️') return 0xff8800;
  if (emoji === '👹') return 0xff2200;
  if (emoji === '🦊') return 0xff44aa;
  if (emoji === '🐉') return 0x0088ff;
  return 0x8800cc;   // 💀 and others → purple
}

export class CinematicScene extends Phaser.Scene {
  private lines:      DialogueLine[] = [];
  private lineIndex   = 0;
  private nextScene   = 'StageSelectScene';
  private nextData?:  object;

  // UI objects
  private panel!:       Phaser.GameObjects.Container;
  private panelBg!:     Phaser.GameObjects.Graphics;
  private emojiGlow!:   Phaser.GameObjects.Graphics;
  private emojiText!:   Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private dialogText!:  Phaser.GameObjects.Text;
  private nextBtn!:     Phaser.GameObjects.Text;
  private pulseTween?:  Phaser.Tweens.Tween;

  // Typewriter state
  private fullText    = '';
  private shownChars  = 0;
  private typeTimer?: ReturnType<typeof setInterval>;
  private isTyping    = false;

  constructor() { super({ key: 'CinematicScene' }); }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(data: CinematicSceneData): void {
    this.lineIndex  = 0;
    this.nextScene  = data.nextScene ?? 'StageSelectScene';
    this.nextData   = data.nextData;

    const def: CinematicDef | undefined = getCinematic(data.cinematicId);
    if (!def) { this.finish(); return; }

    this.lines = def.lines;

    // Mark as seen
    const gs = loadGameState();
    if (!gs.cinematicSeen) gs.cinematicSeen = [];
    if (!gs.cinematicSeen.includes(data.cinematicId)) {
      gs.cinematicSeen.push(data.cinematicId);
      saveGameState(gs);
    }

    // Dim overlay — 40% so dungeon is visible behind
    const dim = this.add.graphics().setDepth(0);
    dim.fillStyle(0x000000, 0.4);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Panel container (slides up from bottom)
    this.panel = this.add.container(0, CANVAS_HEIGHT).setDepth(10);
    this.buildPanelGraphics();

    // Skip button
    const skipT = this.add.text(CANVAS_WIDTH - 16, 20, 'SKIP ▶▶', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#888888',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setDepth(15).setInteractive();
    skipT.on('pointerdown', () => this.finish());

    // Slide panel up
    this.tweens.add({ targets: this.panel, y: 0, duration: 400, ease: 'Power2.easeOut' });
    setTimeout(() => this.showLine(0), 450);

    // Tap on panel to advance
    const tapZone = this.add.zone(
      CANVAS_WIDTH / 2, PANEL_Y + PANEL_H / 2,
      CANVAS_WIDTH, PANEL_H,
    ).setInteractive().setDepth(20);
    tapZone.on('pointerdown', () => this.onTap());
  }

  // ─── Panel graphics ──────────────────────────────────────────────────────────

  private buildPanelGraphics(): void {
    this.panelBg = this.add.graphics();

    // Gradient simulation: dark-top to lighter-bottom
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(0x1a + (0x2d - 0x1a) * t);
      const g = Math.round(0x0f + (0x24 - 0x0f) * t);
      const b = Math.round(0x00 + (0x16 - 0x00) * t);
      this.panelBg.fillStyle((r << 16) | (g << 8) | b, 1);
      const stripY = PANEL_Y + Math.floor(i * PANEL_H / steps);
      const stripH = Math.ceil(PANEL_H / steps) + 1;
      this.panelBg.fillRect(0, stripY, CANVAS_WIDTH, stripH);
    }

    // Gold top border (full opacity)
    this.panelBg.lineStyle(2, 0xc8921a, 1);
    this.panelBg.lineBetween(0, PANEL_Y, CANVAS_WIDTH, PANEL_Y);

    // Subtle horizontal stone texture lines
    this.panelBg.lineStyle(1, 0x2a2010, 0.35);
    for (let y = PANEL_Y + 28; y < CANVAS_HEIGHT; y += 22) {
      this.panelBg.lineBetween(0, y, CANVAS_WIDTH, y);
    }

    this.panel.add(this.panelBg);

    // Emoji glow (drawn before emoji so it appears behind)
    this.emojiGlow = this.add.graphics();
    this.panel.add(this.emojiGlow);

    // Speaker name — gold, uppercase feel
    this.speakerText = this.add.text(
      PANEL_PAD + 56, PANEL_Y + 16, '',
      {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#c8921a',
        fontStyle: 'bold',
        letterSpacing: 2,
      },
    );
    this.panel.add(this.speakerText);

    // Character emoji
    this.emojiText = this.add.text(
      PANEL_PAD + 28, PANEL_Y + 52, '',
      { fontFamily: 'sans-serif', fontSize: '56px' },
    ).setOrigin(0.5);
    this.panel.add(this.emojiText);

    // Dialogue text — parchment 16px
    this.dialogText = this.add.text(
      PANEL_PAD + 56, PANEL_Y + 38, '',
      {
        fontFamily: 'Georgia, serif',
        fontSize:   '16px',
        color:      '#f0e6c8',
        wordWrap:   { width: CANVAS_WIDTH - PANEL_PAD * 2 - 64 },
        lineSpacing: 5,
      },
    );
    this.panel.add(this.dialogText);

    // Pulsing ▶ tap indicator (bottom-right, hidden initially)
    this.nextBtn = this.add.text(
      CANVAS_WIDTH - PANEL_PAD, CANVAS_HEIGHT - 16, '▶',
      { fontFamily: 'sans-serif', fontSize: '18px', color: '#c8921a' },
    ).setOrigin(1, 1).setAlpha(0);
    this.panel.add(this.nextBtn);
  }

  // ─── Emoji glow ──────────────────────────────────────────────────────────────

  private drawEmojiGlow(localX: number, localY: number, color: number): void {
    this.emojiGlow.clear();
    // Soft glow constrained to ~32px (half of 64px emoji container)
    // Outermost ring subtle, innermost bright — like box-shadow
    const layers = [
      { r: 32, a: 0.08 },
      { r: 24, a: 0.14 },
      { r: 16, a: 0.20 },
      { r:  8, a: 0.18 },
    ];
    for (const { r, a } of layers) {
      this.emojiGlow.fillStyle(color, a);
      this.emojiGlow.fillCircle(localX, localY, r);
    }
  }

  // ─── Show a dialogue line ───────────────────────────────────────────────────

  private showLine(index: number): void {
    if (index >= this.lines.length) { this.finish(); return; }

    const line = this.lines[index];
    this.lineIndex = index;

    // Hide/kill pulse on next btn
    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.nextBtn.setAlpha(0);

    // Update speaker name (uppercase for small-caps feel)
    this.speakerText.setText(line.speaker.toUpperCase());

    // Position elements based on side
    let emojiLocalX: number;
    if (line.side === 'left') {
      emojiLocalX = PANEL_PAD + 28;
      this.emojiText.setX(emojiLocalX);
      this.speakerText.setX(PANEL_PAD + 56);
      this.dialogText.setX(PANEL_PAD + 56);
      this.dialogText.setStyle({ ...this.dialogText.style, align: 'left' });
    } else {
      emojiLocalX = CANVAS_WIDTH - PANEL_PAD - 28;
      this.emojiText.setX(emojiLocalX);
      this.speakerText.setX(CANVAS_WIDTH - PANEL_PAD - 56);
      this.dialogText.setX(PANEL_PAD);
      this.dialogText.setStyle({ ...this.dialogText.style, align: 'left' });
    }
    this.emojiText.setText(line.emoji);

    // Draw glow behind emoji
    this.drawEmojiGlow(emojiLocalX, PANEL_Y + 52, glowColor(line.emoji));

    // Emoji pop-in
    this.emojiText.setScale(0.6).setAlpha(0.4);
    this.tweens.add({ targets: this.emojiText, scaleX: 1, scaleY: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });

    // Start typewriter
    this.fullText   = line.text;
    this.shownChars = 0;
    this.isTyping   = true;
    this.dialogText.setText('');

    if (this.typeTimer !== undefined) { clearInterval(this.typeTimer); this.typeTimer = undefined; }
    this.typeTimer = setInterval(() => {
      this.shownChars++;
      this.dialogText.setText(this.fullText.slice(0, this.shownChars));
      if (this.shownChars >= this.fullText.length) {
        clearInterval(this.typeTimer!);
        this.typeTimer = undefined;
        this.isTyping  = false;
        this.onTypeComplete(line);
      }
    }, CHAR_MS);
  }

  private onTypeComplete(line: DialogueLine): void {
    // Start pulsing ▶
    this.nextBtn.setAlpha(0.4);
    this.pulseTween = this.tweens.add({
      targets:  this.nextBtn,
      alpha:    { from: 0.4, to: 1.0 },
      duration: 800,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    if (line.pause && line.pause > 0) {
      setTimeout(() => this.advance(), line.pause);
    }
  }

  // ─── Input handling ──────────────────────────────────────────────────────────

  private onTap(): void {
    if (this.isTyping) {
      if (this.typeTimer !== undefined) { clearInterval(this.typeTimer); this.typeTimer = undefined; }
      this.isTyping = false;
      this.shownChars = this.fullText.length;
      this.dialogText.setText(this.fullText);
      this.onTypeComplete(this.lines[this.lineIndex]);
    } else {
      this.advance();
    }
  }

  private advance(): void {
    const next = this.lineIndex + 1;
    if (next >= this.lines.length) {
      this.finish();
    } else {
      this.tweens.add({
        targets: [this.dialogText, this.speakerText, this.emojiText, this.emojiGlow],
        alpha: 0, duration: 150,
        onComplete: () => {
          this.dialogText.setAlpha(1);
          this.speakerText.setAlpha(1);
          this.emojiText.setAlpha(1);
          this.emojiGlow.setAlpha(1);
          this.showLine(next);
        },
      });
    }
  }

  // ─── Finish ──────────────────────────────────────────────────────────────────

  private finish(): void {
    if (this.typeTimer !== undefined) { clearInterval(this.typeTimer); this.typeTimer = undefined; }
    this.pulseTween?.stop();
    this.tweens.add({
      targets: this.panel,
      y: CANVAS_HEIGHT,
      duration: 300,
      ease: 'Power2.easeIn',
      onComplete: () => {
        this.scene.start(this.nextScene, this.nextData ?? {});
      },
    });
  }
}
