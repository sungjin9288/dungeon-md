import Phaser from 'phaser';
import { MONSTER_DEFS } from '../data/monsters';
import type { RoomData } from '../data/rooms';
import {
  calcTribeSynergies, calcElementCombos, getSynergyAtkMult, getSynergySpdMult,
  type ActiveSynergy, type ActiveElementCombo,
} from '../data/synergy';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';

// ─── SynergyManager ───────────────────────────────────────────────────────────
//
// Extracted from DungeonScene. Owns all tribe/element synergy state and the
// synergy indicator UI in the top-right corner.
//
// Usage:
//   const sm = new SynergyManager(this);
//   sm.recalc(this.roomGrid, this.effectiveCols); // call after any room change
//   // read sm.activeSynergies / sm.activeElementCombos for ATK/SPD mult lookups

const TRIBE_EMOJI: Record<string, string> = {
  dokkaebi:   '👹',
  gumiho:     '🦊',
  dragon:     '🐉',
  underworld: '💀',
  sansin:     '⛩️',
  sea:        '🌊',
  mask:       '🎭',
  moonlight:  '🌙',
  celestial:  '✨',
};

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
          const def = MONSTER_DEFS[mid as keyof typeof MONSTER_DEFS];
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
    getSynergyAtkMult(this.activeSynergies); // populates per-synergy atkMult cache
    getSynergySpdMult(this.activeSynergies); // populates per-synergy spdMult cache

    this.updateDisplay();
  }

  // ── ATK / SPD multipliers (for external combat queries) ────────────────────

  getAtkMult(): number {
    return getSynergyAtkMult(this.activeSynergies);
  }

  getSpdMult(): number {
    return getSynergySpdMult(this.activeSynergies);
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

    this.display = this.scene.add.container(0, 0).setDepth(85);
    let yOff = 48;
    const PILL_H = 24;
    const GAP    = 4;

    for (const syn of this.activeSynergies) {
      const emoji      = TRIBE_EMOJI[syn.tribe] ?? '❓';
      const tierDot    = syn.tier.count >= 8 ? '●●●●' : syn.tier.count >= 6 ? '●●●' : syn.tier.count >= 4 ? '●●' : '●';
      const label      = `${emoji} ×${syn.count} ${tierDot}`;
      const fillCol    = TRIBE_FILL[syn.tribe] ?? CASUAL.GOLD;
      const edgeCol    = TRIBE_EDGE[syn.tribe] ?? CASUAL.GOLD_DK;

      const tmp = this.scene.add.text(0, -1000, label, {
        fontFamily: 'sans-serif', fontSize: '13px',
      });
      const pillW = Math.max(tmp.width + 16, 48);
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
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);

      const synZone = this.scene.add.zone(pillX, yOff, pillW, PILL_H)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(90);
      this.tooltipZones.push(synZone);
      synZone.once('pointerdown', () => {
        const desc = syn.tier.desc;
        const tipX = Math.min(pillX + pillW / 2, this.scene.scale.width - 80);
        const tipY = yOff - 10;
        const tip = this.scene.add.text(tipX, tipY, desc, {
          fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
          color: CASUAL_CSS.INK,
          backgroundColor: CASUAL_CSS.CREAM,
          padding: { x: 8, y: 5 },
        }).setOrigin(0.5, 1).setDepth(200);
        this.scene.tweens.add({
          targets: tip,
          alpha: { from: 1, to: 0 },
          y: tipY - 16,
          duration: 400,
          delay: 2100,
          onComplete: () => tip.destroy(),
        });
      });

      yOff += PILL_H + GAP;
    }

    for (const ec of this.activeElementCombos) {
      const label  = `⚡${ec.combo.name}`;
      const tmp    = this.scene.add.text(0, -1000, label, { fontFamily: 'sans-serif', fontSize: '11px' });
      const pillW  = Math.max(tmp.width + 12, 48);
      tmp.destroy();

      const pillX = CANVAS_WIDTH - 8 - pillW;
      const ecH   = PILL_H - 4;

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
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);

      const ecZone = this.scene.add.zone(pillX, yOff, pillW, ecH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(90);
      this.tooltipZones.push(ecZone);
      ecZone.once('pointerdown', () => {
        const desc = ec.combo.desc;
        const tipX = Math.min(pillX + pillW / 2, this.scene.scale.width - 80);
        const tipY = yOff - 10;
        const tip = this.scene.add.text(tipX, tipY, desc, {
          fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
          color: CASUAL_CSS.INK,
          backgroundColor: CASUAL_CSS.CREAM,
          padding: { x: 8, y: 5 },
        }).setOrigin(0.5, 1).setDepth(200);
        this.scene.tweens.add({
          targets: tip,
          alpha: { from: 1, to: 0 },
          y: tipY - 16,
          duration: 400,
          delay: 2100,
          onComplete: () => tip.destroy(),
        });
      });

      yOff += ecH + GAP;
    }
  }
}
