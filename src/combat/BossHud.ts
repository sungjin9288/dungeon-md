// ─── Boss HP Bar ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene. The scene now owns a single BossHud instance
// instead of three nullable Graphics/Text fields + a max-hp scalar. The same
// instance is also handed to BossBehaviors via BossContext so per-boss spawn
// handlers (dragon king, god emperor, ...) can build the bar themselves.
//
// VISUAL STYLE: bright casual-toy (Clash/Cookie-Run). Cream plate + chunky
// brown border + glossy highlights; bold boss-RED fill that shifts to PURPLE
// for the enraged late phase. The HP-depletion logic and layout coords are
// unchanged — only the chrome is reskinned.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { CANVAS_WIDTH, TOP_BAR_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';

const BAR_WIDTH  = 200;
const BAR_HEIGHT = 12;
const BAR_X      = CANVAS_WIDTH / 2 - BAR_WIDTH / 2;
const BAR_Y      = TOP_BAR_HEIGHT + 2;

/** Visual customization passed to {@link BossHud.build}. */
export interface BossHudOptions {
  /** Display label (icon + name), e.g. "🐲 용왕". */
  label?:      string;
  /**
   * Legacy dark-hex background tint. Retained for API compatibility with
   * per-boss spawn handlers; the casual reskin always draws a cream plate,
   * so this value is intentionally ignored for chrome.
   */
  bgColor?:   number;
  /**
   * Legacy CSS label color. Retained for API compatibility; the casual reskin
   * uses ink-on-cream for legibility and ignores this value.
   */
  labelColor?: string;
}

const DEFAULT_LABEL = '👹 도깨비 대왕';

/** HP ratio at/below which the boss is treated as enraged (fill turns PURPLE). */
const ENRAGE_THRESHOLD = 0.5;

export class BossHud {
  private bg?:    Phaser.GameObjects.Graphics;
  private fill?:  Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private maxHp        = 0;
  private displayLabel = DEFAULT_LABEL;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Whether the bar visuals currently exist on the scene. */
  get isBuilt(): boolean {
    return !!this.bg;
  }

  /** Create the HP bar visuals. Caller passes the boss's max HP at spawn. */
  build(maxHp: number, opts: BossHudOptions = {}): void {
    // Destroy any existing bar first — protects against double-spawn bugs.
    this.destroy();

    this.maxHp        = maxHp;
    this.displayLabel = opts.label ?? DEFAULT_LABEL;

    // ── Plate: chunky cream card with brown border + gloss + drop shadow ──
    const px = BAR_X - 4;
    const py = BAR_Y - 4;
    const pw = BAR_WIDTH + 8;
    const ph = BAR_HEIGHT + 8;

    this.bg = this.scene.add.graphics().setDepth(95);
    // soft drop shadow (printed-sticker depth)
    this.bg.fillStyle(CASUAL.SHADOW, 0.3);
    this.bg.fillRoundedRect(px, py + 4, pw, ph, 6);
    // dramatic cream body
    this.bg.fillStyle(CASUAL.PANEL_SOFT, 1);
    this.bg.fillRoundedRect(px, py, pw, ph, 6);
    // glossy white top highlight band
    this.bg.fillStyle(0xffffff, 0.12);
    this.bg.fillRoundedRect(px + 4, py + 3, pw - 8, 4, 2);
    // thick rounded brown border
    this.bg.lineStyle(3, CASUAL.EDGE, 1);
    this.bg.strokeRoundedRect(px, py, pw, ph, 6);

    // ── HP track: soft cream channel with brown border ──
    this.bg.fillStyle(CASUAL.PANEL_SOFT, 1);
    this.bg.fillRoundedRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 3);
    this.bg.lineStyle(2, CASUAL.EDGE, 1);
    this.bg.strokeRoundedRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 3);

    this.fill = this.scene.add.graphics().setDepth(96);

    // ── Boss name + HP numbers: bold ink with white stroke for punch ──
    this.label = this.scene.add.text(CANVAS_WIDTH / 2, BAR_Y - 12, this.displayLabel, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(97);
  }

  /**
   * Refresh the fill width + label text each frame.
   *
   * When the boss dies (no matching active invader found while the wave is
   * the final wave), the bar is destroyed automatically.
   */
  update(activeInvaders: Invader[], wave: number, maxWave: number): void {
    if (!this.fill || !this.bg) return;

    // Find any active boss invader (works for knight, dragon_king, god_emperor, ...).
    const boss = activeInvaders.find(i => i.active && i.def.isBoss);

    if (!boss && wave === maxWave) {
      // Boss dead on final wave — remove the bar
      this.destroy();
      return;
    }
    if (!boss) return;

    const pct = boss.hp / this.maxHp;
    // High HP → bold boss RED; enraged late phase → PURPLE.
    const fillCol  = pct > ENRAGE_THRESHOLD ? CASUAL.RED : CASUAL.PURPLE;
    const edgeCol  = pct > ENRAGE_THRESHOLD ? CASUAL.RED_DK : CASUAL.PURPLE_DK;
    const innerW   = Math.max(0, (BAR_WIDTH - 4) * pct);

    this.fill.clear();
    if (innerW > 0) {
      // candy-fill base edge
      this.fill.fillStyle(edgeCol, 1);
      this.fill.fillRoundedRect(BAR_X + 2, BAR_Y + 2, innerW, BAR_HEIGHT - 4, 3);
      // bright cap
      this.fill.fillStyle(fillCol, 1);
      this.fill.fillRoundedRect(BAR_X + 2, BAR_Y + 2, innerW, BAR_HEIGHT - 5, 3);
      // glossy top highlight
      this.fill.fillStyle(0xffffff, 0.3);
      this.fill.fillRoundedRect(BAR_X + 3, BAR_Y + 3, Math.max(0, innerW - 2), 2, 1);
    }

    if (this.label) {
      this.label.setText(`${this.displayLabel}  ${boss.hp} / ${this.maxHp}`);
    }
  }

  /** Destroy the visuals; safe to call repeatedly. */
  destroy(): void {
    this.bg?.destroy();    this.bg    = undefined;
    this.fill?.destroy();  this.fill  = undefined;
    this.label?.destroy(); this.label = undefined;
  }
}
