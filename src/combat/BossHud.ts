// ─── Boss HP Bar ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene. The scene now owns a single BossHud instance
// instead of three nullable Graphics/Text fields + a max-hp scalar. The same
// instance is also handed to BossBehaviors via BossContext so per-boss spawn
// handlers (dragon king, god emperor, ...) can build the bar themselves.
//
// VISUAL STYLE: dungeon command plate. Soot and iron carry the structure;
// ember marks boss danger and moonlight marks the enraged phase.

import { BATTLE_HUD_KEY, markBattleHud } from './battleHudMark';
import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { CANVAS_WIDTH, TOP_BAR_HEIGHT } from '../constants/layout';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';

const BAR_WIDTH  = 210;
const BAR_HEIGHT = 18;
const BAR_X      = CANVAS_WIDTH / 2 - BAR_WIDTH / 2;
// Boss priority temporarily replaces the center of the 110–134px command strip.
const BAR_Y      = TOP_BAR_HEIGHT + 3;

/** Visual customization passed to {@link BossHud.build}. */
export interface BossHudOptions {
  /** Display label (icon + name), e.g. "🐲 용왕". */
  label?:      string;
  /**
   * Legacy dark-hex background tint. Retained for API compatibility; the
   * shared dungeon command plate owns the chrome.
   */
  bgColor?:   number;
  /**
   * Legacy CSS label color. Retained for API compatibility; the shared HUD
   * text treatment owns the label contrast.
   */
  labelColor?: string;
}

/**
 * The HUD names the boss actually on the field. A hardcoded default ('도깨비
 * 대왕') used to label every unlabelled boss — stage 10's knight, the fox queen —
 * as the dokkaebi king. Data names carry a "(보스)" / "(최종 보스)" tag the bar
 * does not need.
 */
export function resolveBossHudLabel(explicit: string | undefined, bossName: string | undefined): string {
  if (explicit) return explicit;
  const name = (bossName ?? '').replace(/\s*\((?:최종\s*)?보스\)\s*$/, '').trim();
  return name || '보스';
}

/** HP ratio at/below which the boss is treated as enraged (fill turns PURPLE). */
const ENRAGE_THRESHOLD = 0.5;

export class BossHud {
  private bg?:    Phaser.GameObjects.Graphics;
  private fill?:  Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private maxHp        = 0;
  private explicitLabel?: string;

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
    this.explicitLabel = opts.label;

    // ── Plate: compact soot-and-iron boss command bar ──
    const px = BAR_X - 4;
    const py = BAR_Y - 2;
    const pw = BAR_WIDTH + 8;
    const ph = BAR_HEIGHT + 4;

    this.bg = markBattleHud(this.scene.add.graphics().setDepth(95));
    this.bg.fillStyle(DUNGEON_UI.VOID, 0.65);
    this.bg.fillRoundedRect(px + 2, py + 3, pw, ph, 5);
    this.bg.fillStyle(DUNGEON_UI.STONE, 1);
    this.bg.fillRoundedRect(px, py, pw, ph, 5);
    this.bg.fillStyle(DUNGEON_UI.EMBER, 0.9);
    this.bg.fillRect(px + 1, py + 4, 3, ph - 8);
    this.bg.lineStyle(1.5, DUNGEON_UI.EDGE, 1);
    this.bg.strokeRoundedRect(px, py, pw, ph, 5);

    // ── HP track ──
    this.bg.fillStyle(DUNGEON_UI.SOOT, 1);
    this.bg.fillRoundedRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 3);
    this.bg.lineStyle(1, DUNGEON_UI.IRON, 1);
    this.bg.strokeRoundedRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 3);

    this.fill = markBattleHud(this.scene.add.graphics().setDepth(96));

    // ── Boss name + HP numbers ──
    this.label = this.scene.add.text(CANVAS_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2, resolveBossHudLabel(this.explicitLabel, undefined), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: DUNGEON_UI_CSS.EMBER,
      stroke: '#030504', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(97).setData(BATTLE_HUD_KEY, true);
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
      this.fill.fillStyle(edgeCol, 1);
      this.fill.fillRoundedRect(BAR_X + 2, BAR_Y + 2, innerW, BAR_HEIGHT - 4, 3);
      this.fill.fillStyle(fillCol, 1);
      this.fill.fillRoundedRect(BAR_X + 2, BAR_Y + 2, innerW, BAR_HEIGHT - 5, 3);
      this.fill.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.35);
      this.fill.fillRect(BAR_X + 3, BAR_Y + 3, Math.max(0, innerW - 2), 1);
    }

    if (this.label) {
      this.label.setText(`${resolveBossHudLabel(this.explicitLabel, boss.def.koreanName)} · ${boss.hp}/${this.maxHp}`);
    }
  }

  /** Destroy the visuals; safe to call repeatedly. */
  destroy(): void {
    this.bg?.destroy();    this.bg    = undefined;
    this.fill?.destroy();  this.fill  = undefined;
    this.label?.destroy(); this.label = undefined;
  }
}
