/**
 * Persistent bottom-bar skill HUD for DungeonScene.
 *
 * Shows up to 3 equipped active skills with cooldown arcs.
 * Tap skill → targeting mode → tap room → activateSkill().
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
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
      fillColor: 0x0d0a07,
      borderColor: COLORS.TORCH_GOLD,
      borderAlpha: 0.58,
      borderWidth: 1.5,
      accentColor: COLORS.TORCH_GOLD,
      accentAlpha: 0.72,
      glowColor: COLORS.TORCH_AMBER,
      glowOpacity: 0.08,
      shadowOpacity: 0.46,
      shadowOffsetY: 3,
    });
    this.container.add(dock.shadow);
    this.container.add(dock.panel);
    this.container.add(dock.glow);
    this.container.add(drawSkillDockOrnaments(scene, barX, HUD_Y, barW, HUD_H));
    this.container.add(scene.add.text(CANVAS_WIDTH / 2, HUD_Y + 9, '전술 스킬', {
      fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#ffdf8a',
      stroke: '#050301',
      strokeThickness: 2,
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
  g.fillStyle(0x06131d, 0.52);
  g.fillRoundedRect(x + 10, y + 6, w - 20, 8, 4);
  g.fillStyle(COLORS.TORCH_GOLD, 0.52);
  g.fillRoundedRect(x + 24, y + 8, w - 48, 2, 1);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(x + 12, y + h - 10, w - 24, 3, 2);
  g.lineStyle(1, COLORS.TORCH_GOLD, 0.34);
  g.lineBetween(x + 8, y + 18, x + 8, y + h - 16);
  g.lineBetween(x + w - 8, y + 18, x + w - 8, y + h - 16);
  g.fillStyle(0x020609, 0.7);
  g.fillCircle(x + 11, y + 12, 3);
  g.fillCircle(x + w - 11, y + 12, 3);
  g.fillStyle(COLORS.TORCH_GOLD, 0.48);
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
  private highlight = false;
  private cooldownActive = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    slotNumber: number,
    skill: ActiveSkill | null,
    onTap: () => void,
  ) {
    this.skill = skill;
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
      fontFamily: 'monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: skill ? CSS.PARCHMENT_MUTED : '#5a4a36',
    }).setOrigin(0.5);
    this.container.add(this.badgeText);

    // Icon
    const icon = skill?.icon ?? '◇';
    this.iconText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, icon, {
      fontFamily: 'sans-serif',
      fontSize: '21px',
    }).setOrigin(0.5).setAlpha(skill ? 1 : 0.3);
    this.iconText.setShadow(0, 2, '#000000', 0.36, true, true);
    this.container.add(this.iconText);

    this.categoryText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE - 7, getCategoryLabel(skill?.category), {
      fontFamily: 'monospace',
      fontSize: '6px',
      fontStyle: 'bold',
      color: getCategoryCss(skill?.category),
    }).setOrigin(0.5).setAlpha(skill ? 0.92 : 0.38);
    this.container.add(this.categoryText);

    this.container.add(this.cooldownArc);

    // Cooldown seconds label
    this.cdLabel = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
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
    const accent = this.skill ? getCategoryAccent(this.skill.category) : COLORS.STONE_MID;
    const fill = this.highlight ? 0x251708 : 0x111820;
    const border = this.highlight ? COLORS.TORCH_AMBER : accent;
    const borderAlpha = this.skill ? (this.highlight ? 0.95 : 0.68) : 0.28;

    if (this.highlight) {
      this.bg.fillStyle(COLORS.TORCH_GOLD, 0.16);
      this.bg.fillRoundedRect(-4, -4, SLOT_SIZE + 8, SLOT_SIZE + 8, 13);
      this.bg.lineStyle(1.5, 0xfff0b0, 0.42);
      this.bg.strokeRoundedRect(-3, -3, SLOT_SIZE + 6, SLOT_SIZE + 6, 12);
    }

    this.bg.fillStyle(0x020609, 0.56);
    this.bg.fillRoundedRect(1, 3, SLOT_SIZE, SLOT_SIZE - 1, 10);
    this.bg.fillStyle(fill, this.skill ? 0.98 : 0.7);
    this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 10);
    this.bg.fillStyle(0xffffff, this.skill ? 0.075 : 0.03);
    this.bg.fillRoundedRect(4, 4, SLOT_SIZE - 8, 17, 7);
    this.bg.fillStyle(0x000000, this.skill ? 0.2 : 0.12);
    this.bg.fillRoundedRect(4, SLOT_SIZE - 17, SLOT_SIZE - 8, 13, 7);
    this.bg.lineStyle(this.highlight ? 2 : 1.25, border, borderAlpha);
    this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 10);

    if (this.skill) {
      this.bg.fillStyle(0x020609, 0.68);
      this.bg.fillCircle(8, 7, 5.4);
      this.bg.lineStyle(1, accent, this.highlight ? 0.82 : 0.48);
      this.bg.strokeCircle(8, 7, 5.4);

      this.bg.fillStyle(accent, this.highlight ? 0.95 : 0.78);
      this.bg.fillRoundedRect(8, 4, SLOT_SIZE - 16, 3, 2);
      this.bg.fillStyle(this.cooldownActive ? COLORS.BLOOD_RED : 0x36c46a, this.cooldownActive ? 0.82 : 0.9);
      this.bg.fillCircle(SLOT_SIZE - 8, 8, 3);

      this.bg.fillStyle(accent, this.cooldownActive ? 0.24 : 0.44);
      this.bg.fillRoundedRect(8, SLOT_SIZE - 6, SLOT_SIZE - 16, 3, 2);
      if (!this.cooldownActive) {
        this.bg.fillStyle(0xffffff, 0.12);
        this.bg.fillTriangle(SLOT_SIZE - 12, 14, SLOT_SIZE - 6, 14, SLOT_SIZE - 6, 20);
      }
    } else {
      this.bg.fillStyle(0xffffff, 0.04);
      this.bg.fillRoundedRect(14, 21, SLOT_SIZE - 28, 2, 1);
    }
  }

  setHighlighted(on: boolean): void {
    if (this.highlight === on) return;
    this.highlight = on;
    this.iconText.setScale(on ? 1.08 : 1);
    this.badgeText.setColor(on ? '#fff0b0' : (this.skill ? CSS.PARCHMENT_MUTED : '#5a4a36'));
    this.drawBg();
  }

  updateCooldown(remainingMs: number, totalMs: number): void {
    this.cooldownArc.clear();
    if (remainingMs <= 0 || totalMs <= 0) {
      if (this.cooldownActive) {
        this.cooldownActive = false;
        this.iconText.setAlpha(this.skill ? 1 : 0.3);
        this.categoryText.setAlpha(this.skill ? 0.92 : 0.38);
        this.drawBg();
      }
      this.cdLabel.setVisible(false);
      return;
    }

    if (!this.cooldownActive) {
      this.cooldownActive = true;
      this.iconText.setAlpha(0.46);
      this.categoryText.setAlpha(0.46);
      this.drawBg();
    }

    const pct = remainingMs / totalMs;
    const cx = SLOT_SIZE / 2;
    const cy = SLOT_SIZE / 2;
    const r  = SLOT_SIZE / 2 - 2;

    // Semi-transparent dark overlay proportional to remaining cooldown
    this.cooldownArc.fillStyle(0x000000, 0.5 * pct);
    this.cooldownArc.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 10);

    // Arc
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * pct;
    this.cooldownArc.lineStyle(2.25, COLORS.BLOOD_RED, 0.85);
    this.cooldownArc.beginPath();
    this.cooldownArc.arc(cx, cy, r, startAngle, endAngle, false);
    this.cooldownArc.strokePath();

    // Remaining seconds
    const secs = Math.ceil(remainingMs / 1000);
    this.cooldownArc.fillStyle(0x050301, 0.74);
    this.cooldownArc.fillRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cooldownArc.lineStyle(1, 0xffffff, 0.14);
    this.cooldownArc.strokeRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cdLabel.setText(`${secs}`).setVisible(true);
  }
}

function getCategoryAccent(category: ActiveSkill['category'] | undefined): number {
  switch (category) {
    case 'combat':
      return COLORS.BLOOD_GLOW;
    case 'defense':
      return 0x4a9cff;
    case 'support':
      return COLORS.MOSS_LIGHT;
    default:
      return COLORS.TORCH_GOLD;
  }
}

function getCategoryLabel(category: ActiveSkill['category'] | undefined): string {
  switch (category) {
    case 'combat':
      return 'ATK';
    case 'defense':
      return 'DEF';
    case 'support':
      return 'SUP';
    default:
      return 'LOCK';
  }
}

function getCategoryCss(category: ActiveSkill['category'] | undefined): string {
  switch (category) {
    case 'combat':
      return '#ffb8a0';
    case 'defense':
      return '#bcefff';
    case 'support':
      return '#b9ffd8';
    default:
      return '#5a4a36';
  }
}
