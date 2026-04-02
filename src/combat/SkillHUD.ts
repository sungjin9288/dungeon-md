/**
 * Persistent bottom-bar skill HUD for DungeonScene.
 *
 * Shows up to 3 equipped active skills with cooldown arcs.
 * Tap skill → targeting mode → tap room → activateSkill().
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS } from '../constants/colors';
import { ACTIVE_SKILLS, type ActiveSkill } from '../data/barracks';

// ─── Skill slot geometry ───────────────────────────────────────────────────────

const SLOT_SIZE  = 44;
const SLOT_GAP   = 12;
const HUD_Y      = CANVAS_HEIGHT - 56;
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

    // Background bar
    const barW = MAX_SLOTS * (SLOT_SIZE + SLOT_GAP) + SLOT_GAP;
    const barX = (CANVAS_WIDTH - barW) / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0a0a, 0.75);
    bg.fillRoundedRect(barX, HUD_Y - 6, barW, SLOT_SIZE + 12, 10);
    bg.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    bg.strokeRoundedRect(barX, HUD_Y - 6, barW, SLOT_SIZE + 12, 10);
    this.container.add(bg);

    // Create skill slots
    for (let i = 0; i < MAX_SLOTS; i++) {
      const x = barX + SLOT_GAP + i * (SLOT_SIZE + SLOT_GAP);
      const skillId = equippedSkillIds[i] ?? null;
      const skill = skillId ? ACTIVE_SKILLS.find(s => s.id === skillId) ?? null : null;
      const slot = new SkillSlot(scene, x, HUD_Y, skill, () => this.onSlotTap(skillId));
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
      this.selectedSkillId = null;
      this.updateHighlights();
      this.callbacks.onSkillCancelled();
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
    this.selectedSkillId = null;
    this.updateHighlights();
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

// ─── Individual skill slot ─────────────────────────────────────────────────────

class SkillSlot {
  readonly container: Phaser.GameObjects.Container;
  readonly skill: ActiveSkill | null;
  private bg: Phaser.GameObjects.Graphics;
  private cooldownArc: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private highlight = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
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
    this.container.add(this.cooldownArc);

    // Icon
    const icon = skill?.icon ?? '⬜';
    this.iconText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, icon, {
      fontFamily: 'sans-serif', fontSize: '20px',
    }).setOrigin(0.5);
    this.container.add(this.iconText);

    // Touch zone
    const zone = scene.add.zone(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
      .setInteractive()
      .on('pointerdown', onTap);
    this.container.add(zone);
  }

  private drawBg(): void {
    this.bg.clear();
    const col = this.highlight ? COLORS.TORCH_GOLD : COLORS.STONE_MID;
    this.bg.fillStyle(col, 0.8);
    this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8);
    this.bg.lineStyle(1.5, this.highlight ? COLORS.TORCH_AMBER : 0x555555, 0.8);
    this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8);
  }

  setHighlighted(on: boolean): void {
    if (this.highlight === on) return;
    this.highlight = on;
    this.drawBg();
  }

  updateCooldown(remainingMs: number, totalMs: number): void {
    this.cooldownArc.clear();
    if (remainingMs <= 0 || totalMs <= 0) return;

    const pct = remainingMs / totalMs;
    const cx = SLOT_SIZE / 2;
    const cy = SLOT_SIZE / 2;
    const r  = SLOT_SIZE / 2 - 2;

    // Semi-transparent dark overlay proportional to remaining cooldown
    this.cooldownArc.fillStyle(0x000000, 0.5 * pct);
    this.cooldownArc.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8);

    // Arc
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * pct;
    this.cooldownArc.lineStyle(2, COLORS.BLOOD_RED, 0.8);
    this.cooldownArc.beginPath();
    this.cooldownArc.arc(cx, cy, r, startAngle, endAngle, false);
    this.cooldownArc.strokePath();
  }
}
