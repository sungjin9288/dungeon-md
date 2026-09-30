import Phaser from 'phaser';
import { markBattleHud } from './battleHudMark';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import type { RoomData } from '../data/rooms';
import {
  calcTribeSynergies, calcElementCombos, getSynergyAtkMult, getSynergyInvaderMoveMult,
  getSynergyGuardianCooldownMult, getSynergyGuardianAttackIntervalMult,
  type ActiveSynergy, type ActiveElementCombo,
} from '../data/synergy';
import { CANVAS_HEIGHT, CANVAS_WIDTH, TOUCH_MIN } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { TRIBE_LABELS } from '../ui/BarracksShared';

// ─── SynergyManager ───────────────────────────────────────────────────────────
//
// Extracted from DungeonScene. Owns all tribe/element synergy state and the
// synergy indicator UI in the top-right corner.
//
// Usage:
//   const sm = new SynergyManager(this);
//   sm.recalc(this.roomGrid, this.effectiveCols); // call after any room change
//   // read sm.activeSynergies / sm.activeElementCombos for ATK/SPD mult lookups

// Casual toy: each tribe gets a saturated candy pill fill + a darker edge.
const TRIBE_FILL: Record<string, number> = {
  dokkaebi:   0xe88a2a,
  gumiho:     0xe6a93a,
  dragon:     0xe8503a,
  underworld: 0x8a6ad8,
  sansin:     0x5fc760,
  sea:        0x4aa8ee,
  mask:       0xc762d8,
  moonlight:  0xa080e8,
  celestial:  0xf0d23a,
};

const TRIBE_EDGE: Record<string, number> = {
  dokkaebi:   0xb05a10,
  gumiho:     0xb07a18,
  dragon:     0xb02a1c,
  underworld: 0x5a3fa8,
  sansin:     0x2f8f3a,
  sea:        0x2470c0,
  mask:       0x9a3aa8,
  moonlight:  0x6a3fc0,
  celestial:  0xc09a18,
};

export class SynergyManager {
  private scene: Phaser.Scene;
  private display?: Phaser.GameObjects.Container;
  private tooltipZones: Phaser.GameObjects.Zone[] = [];

  public activeSynergies:     ActiveSynergy[]     = [];
  public activeElementCombos: ActiveElementCombo[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Recalculate and refresh display ────────────────────────────────────────

  recalc(roomGrid: (RoomData | null)[][], effectiveCols: number): void {
    const tribeCounts = new Map<import('../data/monsters').TribeId, number>();
    const elementGrid: (import('../data/monsters').ElementId | null)[][] = [];

    for (let r = 0; r < roomGrid.length; r++) {
      const eRow: (import('../data/monsters').ElementId | null)[] = [];
      for (let c = 0; c < effectiveCols; c++) {
        const data = roomGrid[r]?.[c];
        const mid  = data?.monsterSlot;
        if (mid) {
          const def = resolveOwnedMonsterProfile(mid);
          if (def?.tribe) {
            tribeCounts.set(def.tribe, (tribeCounts.get(def.tribe) ?? 0) + 1);
          }
          eRow.push(def?.element ?? null);
        } else {
          eRow.push(null);
        }
      }
      elementGrid.push(eRow);
    }

    this.activeSynergies     = calcTribeSynergies(tribeCounts);
    this.activeElementCombos = calcElementCombos(elementGrid, effectiveCols);
    this.updateDisplay();
  }

  // Each consumer reads only the axis it applies; no mixed SPD product.
  getAtkMult(): number {
    return getSynergyAtkMult(this.activeSynergies);
  }

  getInvaderMoveMult(): number {
    return getSynergyInvaderMoveMult(this.activeSynergies);
  }

  getGuardianCooldownMult(): number {
    return getSynergyGuardianCooldownMult(this.activeSynergies);
  }

  getGuardianAttackIntervalMult(): number {
    return getSynergyGuardianAttackIntervalMult(this.activeSynergies);
  }

  hasSpecial(special: string): boolean {
    return this.activeSynergies.some(s => s.tier.effect.special === special)
      || this.activeElementCombos.some(e => e.combo.effect.special === special);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.display?.destroy();
    this.display = undefined;
    this.tooltipZones.forEach(z => z.destroy());
    this.tooltipZones = [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private updateDisplay(): void {
    this.tooltipZones.forEach(z => z.destroy());
    this.tooltipZones = [];
    this.display?.destroy();
    if (this.activeSynergies.length === 0 && this.activeElementCombos.length === 0) return;

    this.display = markBattleHud(this.scene.add.container(0, 0).setDepth(85));
    // The top of the battle is UIScene's HUD (these pills used to sit hidden
    // under it). They now stack upward in the free corners beside the skill
    // dock: tribe synergies on the right, element combos on the left.
    const PILL_H = 22;
    const GAP    = 4;
    const bottom = CANVAS_HEIGHT - 8;
    let yOff = bottom - PILL_H;
    const synLines: string[] = [];
    let synLeft = CANVAS_WIDTH;

    for (const syn of this.activeSynergies) {
      const name       = TRIBE_LABELS[syn.tribe] ?? syn.tribe;
      const tierDot    = syn.tier.count >= 8 ? '●●●●' : syn.tier.count >= 6 ? '●●●' : syn.tier.count >= 4 ? '●●' : '●';
      const label      = `${name} ×${syn.count} ${tierDot}`;
      const fillCol    = TRIBE_FILL[syn.tribe] ?? CASUAL.GOLD;
      const edgeCol    = TRIBE_EDGE[syn.tribe] ?? CASUAL.GOLD_DK;

      const fontSize = fitPillFont(this.scene, label);
      const tmp = this.scene.add.text(0, -1000, label, {
        fontFamily: 'sans-serif', fontSize, fontStyle: 'bold',
      });
      const pillW = Math.min(Math.max(tmp.width + 12, 48), PILL_MAX_W);
      tmp.destroy();

      const pillX = CANVAS_WIDTH - 8 - pillW;

      const g = this.scene.add.graphics().setDepth(85);
      // chunky drop shadow
      g.fillStyle(CASUAL.SHADOW, 0.22);
      g.fillRoundedRect(pillX, yOff + 3, pillW, PILL_H, 8);
      // saturated candy fill
      g.fillStyle(fillCol, 1);
      g.fillRoundedRect(pillX, yOff, pillW, PILL_H, 8);
      // glossy white top highlight
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(pillX + 4, yOff + 3, pillW - 8, 5, 3);
      // chunky darker edge
      g.lineStyle(2.5, edgeCol, 1);
      g.strokeRoundedRect(pillX, yOff, pillW, PILL_H, 8);

      const t = this.scene.add.text(pillX + pillW / 2, yOff + PILL_H / 2, label, {
        fontFamily: 'sans-serif', fontSize, fontStyle: 'bold',
        color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);

      synLines.push(`${label} · ${syn.tier.desc}`);
      synLeft = Math.min(synLeft, pillX);

      yOff -= PILL_H + GAP;
    }
    this.addColumnTooltip(synLeft, CANVAS_WIDTH - 8, yOff + PILL_H, bottom, synLines, 'right');

    yOff = bottom - PILL_H;
    const ecLines: string[] = [];
    let ecRight = 0;
    for (const ec of this.activeElementCombos) {
      const label  = ec.combo.name;
      const fontSize = fitPillFont(this.scene, label);
      const tmp    = this.scene.add.text(0, -1000, label, { fontFamily: 'sans-serif', fontSize, fontStyle: 'bold' });
      const pillW  = Math.min(Math.max(tmp.width + 12, 48), PILL_MAX_W);
      tmp.destroy();

      const pillX = 8;
      const ecH   = PILL_H;

      const g = this.scene.add.graphics().setDepth(85);
      // chunky drop shadow
      g.fillStyle(CASUAL.SHADOW, 0.22);
      g.fillRoundedRect(pillX, yOff + 3, pillW, ecH, 7);
      // blue candy fill (element combos read as "info" accent)
      g.fillStyle(CASUAL.BLUE, 1);
      g.fillRoundedRect(pillX, yOff, pillW, ecH, 7);
      // glossy white top highlight
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(pillX + 4, yOff + 3, pillW - 8, 4, 2);
      // chunky darker edge
      g.lineStyle(2.5, CASUAL.BLUE_DK, 1);
      g.strokeRoundedRect(pillX, yOff, pillW, ecH, 7);

      const t = this.scene.add.text(pillX + pillW / 2, yOff + ecH / 2, label, {
        fontFamily: 'sans-serif', fontSize, fontStyle: 'bold',
        color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);

      ecLines.push(`${label} · ${ec.combo.desc}`);
      ecRight = Math.max(ecRight, pillX + pillW);

      yOff -= ecH + GAP;
    }
    this.addColumnTooltip(8, ecRight, yOff + PILL_H, bottom, ecLines, 'left');
  }

  /**
   * One tap target per pill column: pills are 22px tall and 4px apart, so a
   * per-pill zone could never meet the 44px touch minimum. Tapping the column
   * shows every active entry's effect at once.
   */
  private addColumnTooltip(
    left: number, right: number, top: number, bottom: number,
    lines: readonly string[], align: 'left' | 'right',
  ): void {
    if (lines.length === 0 || right <= left) return;
    const zoneTop = Math.min(top, bottom - TOUCH_MIN);
    const zone = markBattleHud(this.scene.add.zone(left, zoneTop, right - left, bottom - zoneTop)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(90));
    this.tooltipZones.push(zone);
    zone.on('pointerdown', () => {
      const tipX = align === 'right' ? right : left;
      const tipY = zoneTop - 4;
      const tip = markBattleHud(this.scene.add.text(tipX, tipY, lines.join('\n'), {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: CASUAL_CSS.INK,
        backgroundColor: CASUAL_CSS.CREAM,
        padding: { x: 8, y: 5 },
        lineSpacing: 3,
        wordWrap: { width: 264, useAdvancedWrap: true },
      }).setOrigin(align === 'right' ? 1 : 0, 1).setDepth(200));
      this.scene.tweens.add({
        targets: tip,
        alpha: { from: 1, to: 0 },
        y: tipY - 16,
        duration: 400,
        delay: 2600,
        onComplete: () => tip.destroy(),
      });
    });
  }
}

/** Corner beside the skill dock: (390 − 186) / 2 − 8 margin − 6 gap. */
const PILL_MAX_W = 88;

/** 11px unless the label would overflow the corner, then 10px. */
function fitPillFont(scene: Phaser.Scene, label: string): string {
  const probe = scene.add.text(0, -1000, label, { fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold' });
  const fits = probe.width + 12 <= PILL_MAX_W;
  probe.destroy();
  return fits ? '11px' : '10px';
}
