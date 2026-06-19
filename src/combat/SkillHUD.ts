/**
 * Persistent bottom-bar skill HUD for DungeonScene.
 *
 * Shows up to 3 equipped active skills with cooldown arcs.
 * Tap skill → targeting mode → tap room → activateSkill().
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { ACTIVE_SKILLS, type ActiveSkill } from '../data/barracks';
import { addFramedPanel } from '../ui/GameUiPrimitives';

// ─── Skill slot geometry ───────────────────────────────────────────────────────

const SLOT_SIZE  = 46;
const SLOT_GAP   = 12;
const SLOT_TOUCH = 52;
const HUD_H      = 68;
const HUD_Y      = CANVAS_HEIGHT - HUD_H - 8;
const MAX_SLOTS  = 3;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SkillHUDCallbacks {
  /** Called when user taps a skill button. Parent enters targeting mode. */
  onSkillSelected: (skillId: string) => void;
  /** Called when user taps the same skill again (cancel). */
  onSkillCancelled: () => void;
}

// ─── Skill HUD class ──────────────────────────────────────────────────────────

export class SkillHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slots: SkillSlot[] = [];
  private callbacks: SkillHUDCallbacks;
  private selectedSkillId: string | null = null;
  private cooldowns = new Map<string, number>(); // skillId → ready-at (ms)

  constructor(scene: Phaser.Scene, equippedSkillIds: string[], callbacks: SkillHUDCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = scene.add.container(0, 0).setDepth(90);

    const barW = MAX_SLOTS * SLOT_SIZE + SLOT_GAP * (MAX_SLOTS + 1);
    const barX = (CANVAS_WIDTH - barW) / 2;
    const dock = addFramedPanel(scene, {
      x: barX,
      y: HUD_Y,
      w: barW,
      h: HUD_H,
      radius: 12,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      shadowOpacity: 0.32,
      shadowOffsetY: 4,
    });
    this.container.add(dock.shadow);
    this.container.add(dock.panel);
    this.container.add(dock.glow);
    this.container.add(drawSkillDockOrnaments(scene, barX, HUD_Y, barW, HUD_H));
    this.container.add(scene.add.text(CANVAS_WIDTH / 2, HUD_Y + 9, '전술 스킬', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0.5));

    // Create skill slots
    for (let i = 0; i < MAX_SLOTS; i++) {
      const x = barX + SLOT_GAP + i * (SLOT_SIZE + SLOT_GAP);
      const y = HUD_Y + 16;
      const skillId = equippedSkillIds[i] ?? null;
      const skill = skillId ? ACTIVE_SKILLS.find(s => s.id === skillId) ?? null : null;
      const slot = new SkillSlot(scene, x, y, i + 1, skill, () => this.onSlotTap(skillId));
      this.container.add(slot.container);
      this.slots.push(slot);
    }
  }

  private onSlotTap(skillId: string | null): void {
    if (!skillId) return;

    // Check cooldown
    const now = this.scene.time.now;
    if ((this.cooldowns.get(skillId) ?? 0) > now) return;

    if (this.selectedSkillId === skillId) {
      // Cancel targeting
      this.clearSelection();
    } else {
      this.selectedSkillId = skillId;
      this.updateHighlights();
      this.callbacks.onSkillSelected(skillId);
    }
  }

  /** Call after a skill is successfully used. Starts cooldown. */
  startCooldown(skillId: string, durationMs: number): void {
    this.cooldowns.set(skillId, this.scene.time.now + durationMs);
    this.selectedSkillId = null;
    this.updateHighlights();
    this.callbacks.onSkillCancelled();
  }

  /** Call from update() to refresh cooldown arcs. */
  update(): void {
    const now = this.scene.time.now;
    for (const slot of this.slots) {
      if (!slot.skill) continue;
      const readyAt = this.cooldowns.get(slot.skill.id) ?? 0;
      const remaining = Math.max(0, readyAt - now);
      slot.updateCooldown(remaining, slot.skill.cooldown);
    }
  }

  getSelectedSkillId(): string | null { return this.selectedSkillId; }

  clearSelection(): void {
    const hadSelection = this.selectedSkillId !== null;
    this.selectedSkillId = null;
    this.updateHighlights();
    if (hadSelection) this.callbacks.onSkillCancelled();
  }

  private updateHighlights(): void {
    for (const slot of this.slots) {
      slot.setHighlighted(slot.skill?.id === this.selectedSkillId);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

function drawSkillDockOrnaments(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  // soft header rail behind the label
  g.fillStyle(CASUAL.PANEL_SOFT, 0.92);
  g.fillRoundedRect(x + 10, y + 6, w - 20, 8, 4);
  g.fillStyle(CASUAL.EDGE_SOFT, 0.5);
  g.fillRoundedRect(x + 24, y + 8, w - 48, 2, 1);
  // warm bottom shading hint
  g.fillStyle(CASUAL.SHADOW, 0.1);
  g.fillRoundedRect(x + 12, y + h - 10, w - 24, 3, 2);
  // side rails
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.5);
  g.lineBetween(x + 8, y + 18, x + 8, y + h - 16);
  g.lineBetween(x + w - 8, y + 18, x + w - 8, y + h - 16);
  // corner studs
  g.fillStyle(CASUAL.EDGE, 0.9);
  g.fillCircle(x + 11, y + 12, 3);
  g.fillCircle(x + w - 11, y + 12, 3);
  g.fillStyle(CASUAL.GOLD, 0.95);
  g.fillCircle(x + 11, y + 12, 1.4);
  g.fillCircle(x + w - 11, y + 12, 1.4);
  return g;
}

// ─── Individual skill slot ─────────────────────────────────────────────────────

class SkillSlot {
  readonly container: Phaser.GameObjects.Container;
  readonly skill: ActiveSkill | null;
  private bg: Phaser.GameObjects.Graphics;
  private cooldownArc: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private cdLabel: Phaser.GameObjects.Text;
  private badgeText: Phaser.GameObjects.Text;
  private categoryText: Phaser.GameObjects.Text;
  private cancelHint?: Phaser.GameObjects.Text;
  private highlight = false;
  private cooldownActive = false;
  private slotX = 0;
  private slotY = 0;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    slotNumber: number,
    skill: ActiveSkill | null,
    onTap: () => void,
  ) {
    this.skill = skill;
    this.scene = scene;
    this.slotX = x;
    this.slotY = y;
    this.container = scene.add.container(0, 0);

    // Background circle
    this.bg = scene.add.graphics();
    this.drawBg();
    this.bg.setPosition(x, y);
    this.container.add(this.bg);

    // Cooldown overlay
    this.cooldownArc = scene.add.graphics();
    this.cooldownArc.setPosition(x, y);

    this.badgeText = scene.add.text(x + 8, y + 7, `${slotNumber}`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: skill ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5);
    this.container.add(this.badgeText);

    // Icon
    const icon = skill?.icon ?? '◇';
    this.iconText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, icon, {
      fontFamily: 'sans-serif',
      fontSize: '21px',
    }).setOrigin(0.5).setAlpha(skill ? 1 : 0.3);
    this.iconText.setShadow(0, 2, '#00000055', 0.36, true, true);
    this.container.add(this.iconText);

    this.categoryText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE - 7, getCategoryLabel(skill?.category), {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: skill ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
      stroke: skill ? '#00000033' : undefined,
      strokeThickness: skill ? 2 : 0,
    }).setOrigin(0.5).setAlpha(skill ? 1 : 0.6);
    this.container.add(this.categoryText);

    this.container.add(this.cooldownArc);

    // Cooldown seconds label
    this.cdLabel = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setVisible(false);
    this.container.add(this.cdLabel);

    // Touch zone
    const zone = scene.add.zone(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, SLOT_TOUCH, SLOT_TOUCH);
    if (skill) {
      zone.setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
    }
    this.container.add(zone);
  }

  private drawBg(): void {
    this.bg.clear();
    const r = 11;
    const accent = this.skill ? getCategoryAccent(this.skill.category) : CASUAL.PANEL_SOFT;
    const accentDk = this.skill ? getCategoryAccentDark(this.skill.category) : CASUAL.EDGE_SOFT;

    // selection halo (active targeting glow)
    if (this.highlight) {
      this.bg.fillStyle(CASUAL.GOLD, 0.22);
      this.bg.fillRoundedRect(-4, -4, SLOT_SIZE + 8, SLOT_SIZE + 8, 13);
      this.bg.lineStyle(2, CASUAL.GOLD_DK, 0.9);
      this.bg.strokeRoundedRect(-3, -3, SLOT_SIZE + 6, SLOT_SIZE + 6, 12);
    }

    if (this.skill && !this.cooldownActive) {
      // ─── ready: category-colored action button (de-glossed for dark tone) ───
      // colored bottom edge (depth base)
      this.bg.fillStyle(accentDk, 1);
      this.bg.fillRoundedRect(0, 4, SLOT_SIZE, SLOT_SIZE - 2, r);
      // category-accent cap
      this.bg.fillStyle(accent, 1);
      this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
      // soft top highlight (de-glossed to match the dark dungeon tone)
      this.bg.fillStyle(0xffffff, 0.14);
      this.bg.fillRoundedRect(4, 4, SLOT_SIZE - 8, 16, 7);
      // thick rounded brown border
      this.bg.lineStyle(this.highlight ? 2.5 : 2, CASUAL.EDGE, 1);
      this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
    } else {
      // ─── cooldown / disabled / empty: muted cream pill ───
      const fillAlpha = this.skill ? 1 : 0.7;
      this.bg.fillStyle(CASUAL.SHADOW, 0.18);
      this.bg.fillRoundedRect(0, 4, SLOT_SIZE, SLOT_SIZE - 2, r);
      this.bg.fillStyle(CASUAL.PANEL_SOFT, fillAlpha);
      this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
      this.bg.fillStyle(0xffffff, this.skill ? 0.4 : 0.25);
      this.bg.fillRoundedRect(4, 4, SLOT_SIZE - 8, 4, 3);
      this.bg.lineStyle(2, CASUAL.EDGE_SOFT, this.skill ? 1 : 0.7);
      this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
    }

    if (this.skill) {
      // slot-number disc (top-left)
      this.bg.fillStyle(CASUAL.EDGE, 0.92);
      this.bg.fillCircle(8, 7, 5.4);
      this.bg.lineStyle(1, 0xffffff, 0.5);
      this.bg.strokeCircle(8, 7, 5.4);

      // accent rail under the top edge
      this.bg.fillStyle(this.cooldownActive ? CASUAL.EDGE_SOFT : accentDk, this.cooldownActive ? 0.6 : 0.85);
      this.bg.fillRoundedRect(8, 4, SLOT_SIZE - 16, 3, 2);

      // ready-indicator dot (top-right): GREEN = ready, EDGE_SOFT = charging
      this.bg.fillStyle(this.cooldownActive ? CASUAL.EDGE_SOFT : CASUAL.GREEN, 1);
      this.bg.fillCircle(SLOT_SIZE - 8, 8, 3);
      this.bg.lineStyle(1, this.cooldownActive ? CASUAL.EDGE : CASUAL.GREEN_DK, 0.9);
      this.bg.strokeCircle(SLOT_SIZE - 8, 8, 3);

      // bottom charge pip rail
      this.bg.fillStyle(this.cooldownActive ? CASUAL.EDGE_SOFT : CASUAL.GREEN, this.cooldownActive ? 0.45 : 0.7);
      this.bg.fillRoundedRect(8, SLOT_SIZE - 8, SLOT_SIZE - 16, 3, 2);
      if (!this.cooldownActive) {
        this.bg.fillStyle(0xffffff, 0.42);
        this.bg.fillTriangle(SLOT_SIZE - 12, 14, SLOT_SIZE - 6, 14, SLOT_SIZE - 6, 20);
      }
    } else {
      this.bg.fillStyle(CASUAL.EDGE_SOFT, 0.4);
      this.bg.fillRoundedRect(14, 21, SLOT_SIZE - 28, 2, 1);
    }
  }

  setHighlighted(on: boolean): void {
    if (this.highlight === on) return;
    this.highlight = on;
    this.iconText.setScale(on ? 1.08 : 1);
    this.badgeText.setColor(this.skill ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT);
    this.drawBg();

    if (on && !this.cancelHint) {
      this.cancelHint = this.scene.add.text(
        this.slotX + SLOT_SIZE / 2,
        this.slotY + SLOT_SIZE + 4,
        '탭하면 취소',
        {
          fontFamily: 'sans-serif',
          fontSize: '8px',
          color: CASUAL_CSS.INK_SOFT,
        },
      ).setOrigin(0.5, 0).setDepth(91);
      this.container.add(this.cancelHint);
    } else if (!on && this.cancelHint) {
      this.cancelHint.destroy();
      this.cancelHint = undefined;
    }
  }

  updateCooldown(remainingMs: number, totalMs: number): void {
    this.cooldownArc.clear();
    if (remainingMs <= 0 || totalMs <= 0) {
      if (this.cooldownActive) {
        this.cooldownActive = false;
        this.iconText.setAlpha(this.skill ? 1 : 0.3);
        this.categoryText.setAlpha(this.skill ? 1 : 0.6);
        // ready again → label rides the saturated cap as white
        this.categoryText.setColor(this.skill ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT);
        this.badgeText.setColor(this.skill ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT);
        this.drawBg();
      }
      this.cdLabel.setVisible(false);
      return;
    }

    if (!this.cooldownActive) {
      this.cooldownActive = true;
      this.iconText.setAlpha(0.5);
      this.categoryText.setAlpha(0.85);
      // charging → cream pill, so label reads as INK
      this.categoryText.setColor(CASUAL_CSS.INK_SOFT);
      this.badgeText.setColor(CASUAL_CSS.INK_SOFT);
      this.drawBg();
    }

    const pct = remainingMs / totalMs;
    const cx = SLOT_SIZE / 2;
    const cy = SLOT_SIZE / 2;
    const r  = SLOT_SIZE / 2 - 2;

    // Soft "charging" darkening sweep proportional to remaining cooldown
    this.cooldownArc.fillStyle(CASUAL.SHADOW, 0.42 * pct);
    this.cooldownArc.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, 11);

    // Charging arc
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * pct;
    this.cooldownArc.lineStyle(2.5, CASUAL.GOLD, 0.95);
    this.cooldownArc.beginPath();
    this.cooldownArc.arc(cx, cy, r, startAngle, endAngle, false);
    this.cooldownArc.strokePath();

    // Remaining seconds — cream chip
    const secs = Math.ceil(remainingMs / 1000);
    this.cooldownArc.fillStyle(CASUAL.PANEL, 0.96);
    this.cooldownArc.fillRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cooldownArc.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.9);
    this.cooldownArc.strokeRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cdLabel.setText(`${secs}`).setVisible(true);
  }
}

/** Bright candy-cap accent per skill category. */
function getCategoryAccent(category: ActiveSkill['category'] | undefined): number {
  switch (category) {
    case 'combat':
      return CASUAL.RED;
    case 'defense':
      return CASUAL.BLUE;
    case 'support':
      return CASUAL.PURPLE;
    default:
      return CASUAL.GOLD;
  }
}

/** Darker base of the same hue (candy-button bottom edge). */
function getCategoryAccentDark(category: ActiveSkill['category'] | undefined): number {
  switch (category) {
    case 'combat':
      return CASUAL.RED_DK;
    case 'defense':
      return CASUAL.BLUE_DK;
    case 'support':
      return CASUAL.PURPLE_DK;
    default:
      return CASUAL.GOLD_DK;
  }
}

function getCategoryLabel(category: ActiveSkill['category'] | undefined): string {
  switch (category) {
    case 'combat':
      return '⚔';
    case 'defense':
      return '🛡';
    case 'support':
      return '✨';
    default:
      return '';
  }
}
