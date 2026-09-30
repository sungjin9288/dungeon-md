/**
 * Persistent bottom-bar skill HUD for DungeonScene.
 *
 * Shows up to 3 equipped active skills with cooldown arcs.
 * Tap skill → targeting mode → tap room → activateSkill().
 */

import { markBattleHud } from './battleHudMark';
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { ACTIVE_SKILLS, type ActiveSkill } from '../data/barracks';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { drawSigil } from '../ui/Sigils';
import { ACTIVE_SKILL_SIGILS } from '../ui/sigilMaps';

// ─── Skill slot geometry ───────────────────────────────────────────────────────

const SLOT_SIZE  = 46;
const SLOT_GAP   = 12;
const SLOT_TOUCH = 52;
const HUD_H      = 72;
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
  private cooldownDurations = new Map<string, number>();
  private cooldowns = new Map<string, number>(); // skillId → ready-at (ms)

  constructor(scene: Phaser.Scene, equippedSkillIds: string[], callbacks: SkillHUDCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = markBattleHud(scene.add.container(0, 0).setDepth(90));

    const barW = MAX_SLOTS * SLOT_SIZE + SLOT_GAP * (MAX_SLOTS + 1);
    const barX = (CANVAS_WIDTH - barW) / 2;
    const dock = addFramedPanel(scene, {
      x: barX,
      y: HUD_Y,
      w: barW,
      h: HUD_H,
      radius: 8,
      fillColor: DUNGEON_UI.SOOT,
      borderColor: DUNGEON_UI.IRON,
      borderAlpha: 1,
      borderWidth: 1.5,
      shadowOpacity: 0.38,
      shadowOffsetY: 3,
    });
    this.container.add(dock.shadow);
    this.container.add(dock.panel);
    this.container.add(dock.glow);
    this.container.add(drawSkillDockOrnaments(scene, barX, HUD_Y, barW, HUD_H));
    this.container.add(scene.add.text(CANVAS_WIDTH / 2, HUD_Y + 9, '전술 명령', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
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
    this.cooldownDurations.set(skillId, durationMs);
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
      slot.updateCooldown(remaining, (this.cooldownDurations.get(slot.skill.id) ?? slot.skill.cooldown * 1000) / 1000);
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
  g.fillStyle(DUNGEON_UI.STONE, 0.92);
  g.fillRoundedRect(x + 10, y + 6, w - 20, 8, 4);
  g.fillStyle(DUNGEON_UI.BRASS, 0.55);
  g.fillRoundedRect(x + 24, y + 8, w - 48, 2, 1);
  g.fillStyle(DUNGEON_UI.VOID, 0.4);
  g.fillRoundedRect(x + 12, y + h - 10, w - 24, 3, 2);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.5);
  g.lineBetween(x + 8, y + 18, x + 8, y + h - 16);
  g.lineBetween(x + w - 8, y + 18, x + w - 8, y + h - 16);
  g.fillStyle(DUNGEON_UI.IRON, 0.9);
  g.fillCircle(x + 11, y + 12, 3);
  g.fillCircle(x + w - 11, y + 12, 3);
  g.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.95);
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
  /** Skill sigil drawn around (0,0) and positioned at the slot centre, so scale pivots there. */
  private iconText: Phaser.GameObjects.Graphics;
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
      fontSize: '10px',
      fontStyle: 'bold',
      color: skill ? '#ffffff' : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
    this.container.add(this.badgeText);

    // Icon
    const sigil = skill ? ACTIVE_SKILL_SIGILS[skill.id] : undefined;
    this.iconText = scene.add.graphics({ x: x + SLOT_SIZE / 2, y: y + SLOT_SIZE / 2 }).setAlpha(skill ? 1 : 0.3);
    drawSigil(this.iconText, sigil?.kind ?? 'spark', 0, 0, 26, sigil?.color ?? 0xd8c08a);
    this.container.add(this.iconText);

    this.categoryText = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE - 7, getCategoryLabel(skill?.category), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: skill ? '#ffffff' : DUNGEON_UI_CSS.MUTED,
      stroke: skill ? '#00000033' : undefined,
      strokeThickness: skill ? 2 : 0,
    }).setOrigin(0.5).setAlpha(skill ? 1 : 0.6);
    this.container.add(this.categoryText);

    this.container.add(this.cooldownArc);

    // Cooldown seconds label
    this.cdLabel = scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      stroke: '#030504', strokeThickness: 2,
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
    const r = 7;
    const accent = this.skill ? getCategoryAccent(this.skill.category) : DUNGEON_UI.IRON;

    // selection halo (active targeting glow)
    if (this.highlight) {
      this.bg.fillStyle(DUNGEON_UI.BRASS, 0.18);
      this.bg.fillRoundedRect(-4, -4, SLOT_SIZE + 8, SLOT_SIZE + 8, 9);
      this.bg.lineStyle(2, DUNGEON_UI.BRASS_BRIGHT, 0.95);
      this.bg.strokeRoundedRect(-3, -3, SLOT_SIZE + 6, SLOT_SIZE + 6, 8);
    }

    if (this.skill && !this.cooldownActive) {
      this.bg.fillStyle(DUNGEON_UI.VOID, 0.7);
      this.bg.fillRoundedRect(1, 3, SLOT_SIZE, SLOT_SIZE - 1, r);
      this.bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
      this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
      this.bg.fillStyle(accent, 0.88);
      this.bg.fillRect(5, 1, SLOT_SIZE - 10, 3);
      this.bg.lineStyle(this.highlight ? 2 : 1.5, this.highlight ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE, 1);
      this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
    } else {
      const fillAlpha = this.skill ? 1 : 0.7;
      this.bg.fillStyle(DUNGEON_UI.VOID, 0.6);
      this.bg.fillRoundedRect(1, 3, SLOT_SIZE, SLOT_SIZE - 1, r);
      this.bg.fillStyle(DUNGEON_UI.STONE, fillAlpha);
      this.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
      this.bg.lineStyle(1.5, DUNGEON_UI.IRON, this.skill ? 1 : 0.7);
      this.bg.strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, r);
    }

    if (this.skill) {
      // slot-number disc (top-left)
      this.bg.fillStyle(DUNGEON_UI.SOOT, 0.96);
      this.bg.fillCircle(8, 7, 5.4);
      this.bg.lineStyle(1, DUNGEON_UI.EDGE, 0.9);
      this.bg.strokeCircle(8, 7, 5.4);

      // accent rail under the top edge
      this.bg.fillStyle(this.cooldownActive ? DUNGEON_UI.EDGE : accent, this.cooldownActive ? 0.55 : 0.9);
      this.bg.fillRoundedRect(8, 4, SLOT_SIZE - 16, 3, 2);

      // Ready dot remains semantic even when the category accent changes.
      this.bg.fillStyle(this.cooldownActive ? DUNGEON_UI.EDGE : DUNGEON_UI.JADE, 1);
      this.bg.fillCircle(SLOT_SIZE - 8, 8, 3);
      this.bg.lineStyle(1, this.cooldownActive ? DUNGEON_UI.IRON : DUNGEON_UI.JADE, 0.9);
      this.bg.strokeCircle(SLOT_SIZE - 8, 8, 3);

      // bottom charge pip rail
      this.bg.fillStyle(this.cooldownActive ? DUNGEON_UI.EDGE : DUNGEON_UI.JADE, this.cooldownActive ? 0.45 : 0.7);
      this.bg.fillRoundedRect(8, SLOT_SIZE - 8, SLOT_SIZE - 16, 3, 2);
      if (!this.cooldownActive) {
        this.bg.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.8);
        this.bg.fillTriangle(SLOT_SIZE - 12, 14, SLOT_SIZE - 6, 14, SLOT_SIZE - 6, 20);
      }
    } else {
      this.bg.fillStyle(DUNGEON_UI.EDGE, 0.4);
      this.bg.fillRoundedRect(14, 21, SLOT_SIZE - 28, 2, 1);
    }
  }

  setHighlighted(on: boolean): void {
    if (this.highlight === on) return;
    this.highlight = on;
    this.iconText.setScale(on ? 1.08 : 1);
    this.badgeText.setColor(this.skill ? '#ffffff' : DUNGEON_UI_CSS.MUTED);
    this.drawBg();

    if (on && !this.cancelHint) {
      this.cancelHint = this.scene.add.text(
        this.slotX + SLOT_SIZE / 2,
        this.slotY + SLOT_SIZE + 4,
        '탭하면 취소',
        {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: DUNGEON_UI_CSS.MUTED,
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
        // Ready again: restore full-contrast labels.
        this.categoryText.setColor(this.skill ? '#ffffff' : DUNGEON_UI_CSS.MUTED);
        this.badgeText.setColor(this.skill ? '#ffffff' : DUNGEON_UI_CSS.MUTED);
        this.drawBg();
      }
      this.cdLabel.setVisible(false);
      return;
    }

    if (!this.cooldownActive) {
      this.cooldownActive = true;
      this.iconText.setAlpha(0.5);
      this.categoryText.setAlpha(0.85);
      // Charging: mute labels while the numeric cooldown remains visible.
      this.categoryText.setColor(DUNGEON_UI_CSS.MUTED);
      this.badgeText.setColor(DUNGEON_UI_CSS.MUTED);
      this.drawBg();
    }

    const pct = remainingMs / totalMs;
    const cx = SLOT_SIZE / 2;
    const cy = SLOT_SIZE / 2;
    const r  = SLOT_SIZE / 2 - 2;

    // Soft "charging" darkening sweep proportional to remaining cooldown
    this.cooldownArc.fillStyle(DUNGEON_UI.VOID, 0.55 * pct);
    this.cooldownArc.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE - 2, 7);

    // Charging arc
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * pct;
    this.cooldownArc.lineStyle(2.5, DUNGEON_UI.BRASS_BRIGHT, 0.95);
    this.cooldownArc.beginPath();
    this.cooldownArc.arc(cx, cy, r, startAngle, endAngle, false);
    this.cooldownArc.strokePath();

    // Remaining seconds — compact command readout.
    const secs = Math.ceil(remainingMs / 1000);
    this.cooldownArc.fillStyle(DUNGEON_UI.SOOT, 0.96);
    this.cooldownArc.fillRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cooldownArc.lineStyle(1.5, DUNGEON_UI.EDGE, 0.9);
    this.cooldownArc.strokeRoundedRect(cx - 13, cy - 9, 26, 18, 7);
    this.cdLabel.setText(`${secs}`).setVisible(true);
  }
}

/** Category accent used only as an identity rail inside the dark command slot. */
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
