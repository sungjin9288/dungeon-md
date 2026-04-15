// ─── Boss HP Bar ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene. The scene now owns a single BossHud instance
// instead of three nullable Graphics/Text fields + a max-hp scalar. The same
// instance is also handed to BossBehaviors via BossContext so per-boss spawn
// handlers (dragon king, god emperor, ...) can build the bar themselves.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { CANVAS_WIDTH, TOP_BAR_HEIGHT } from '../constants/layout';
import { CSS } from '../constants/colors';

const BAR_WIDTH  = 200;
const BAR_HEIGHT = 12;
const BAR_X      = CANVAS_WIDTH / 2 - BAR_WIDTH / 2;
const BAR_Y      = TOP_BAR_HEIGHT + 2;

/** Visual customization passed to {@link BossHud.build}. */
export interface BossHudOptions {
  /** Display label (icon + name), e.g. "🐲 용왕". */
  label?:      string;
  /** Background fill color (hex). */
  bgColor?:   number;
  /** Label CSS color string. */
  labelColor?: string;
}

const DEFAULT_LABEL       = '👹 도깨비 대왕';
const DEFAULT_BG_COLOR    = 0x220011;
const DEFAULT_LABEL_COLOR = CSS.BLOOD_GLOW;

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

    this.bg = this.scene.add.graphics().setDepth(95);
    this.bg.fillStyle(opts.bgColor ?? DEFAULT_BG_COLOR, 1);
    this.bg.fillRoundedRect(BAR_X - 2, BAR_Y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4, 3);

    this.fill = this.scene.add.graphics().setDepth(96);

    this.label = this.scene.add.text(CANVAS_WIDTH / 2, BAR_Y - 12, this.displayLabel, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: opts.labelColor ?? DEFAULT_LABEL_COLOR,
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
    const col = pct > 0.5 ? 0x440044 : 0x8b0000;

    this.fill.clear();
    this.fill.fillStyle(col, 1);
    this.fill.fillRoundedRect(BAR_X, BAR_Y, Math.max(0, BAR_WIDTH * pct), BAR_HEIGHT, 3);

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
