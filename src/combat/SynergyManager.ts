import Phaser from 'phaser';
import { MONSTER_DEFS } from '../data/monsters';
import type { RoomData } from '../data/rooms';
import {
  calcTribeSynergies, calcElementCombos, getSynergyAtkMult, getSynergySpdMult,
  type ActiveSynergy, type ActiveElementCombo,
} from '../data/synergy';
import { CANVAS_WIDTH } from '../constants/layout';

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

const TRIBE_COLORS: Record<string, number> = {
  dokkaebi:   0x2a1500,
  gumiho:     0x1a1000,
  dragon:     0x1a0000,
  underworld: 0x0d0d1a,
  sansin:     0x001a0d,
  sea:        0x001520,
  mask:       0x1a1520,
  moonlight:  0x100d1a,
  celestial:  0x1a1a00,
};

const TRIBE_BORDER: Record<string, number> = {
  dokkaebi:   0xcc6600,
  gumiho:     0xcc9933,
  dragon:     0xcc2200,
  underworld: 0x6644aa,
  sansin:     0x44aa66,
  sea:        0x2288cc,
  mask:       0xaa44aa,
  moonlight:  0x8866cc,
  celestial:  0xcccc44,
};

export class SynergyManager {
  private scene: Phaser.Scene;
  private display?: Phaser.GameObjects.Container;

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
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private updateDisplay(): void {
    this.display?.destroy();
    if (this.activeSynergies.length === 0 && this.activeElementCombos.length === 0) return;

    this.display = this.scene.add.container(0, 0).setDepth(85);
    let yOff = 48;
    const PILL_H = 24;
    const GAP    = 4;

    for (const syn of this.activeSynergies) {
      const emoji      = TRIBE_EMOJI[syn.tribe] ?? '❓';
      const tierDot    = syn.tier.count >= 6 ? '●●●' : syn.tier.count >= 4 ? '●●' : '●';
      const label      = `${emoji} ×${syn.count} ${tierDot}`;
      const borderCol  = TRIBE_BORDER[syn.tribe] ?? 0x886644;
      const bgCol      = TRIBE_COLORS[syn.tribe] ?? 0x1a1000;

      const tmp = this.scene.add.text(0, -1000, label, {
        fontFamily: 'sans-serif', fontSize: '13px',
      });
      const pillW = Math.max(tmp.width + 16, 48);
      tmp.destroy();

      const pillX = CANVAS_WIDTH - 8 - pillW;

      const g = this.scene.add.graphics().setDepth(85);
      g.fillStyle(bgCol, 0.92);
      g.fillRoundedRect(pillX, yOff, pillW, PILL_H, 4);
      g.lineStyle(1, borderCol, 0.85);
      g.strokeRoundedRect(pillX, yOff, pillW, PILL_H, 4);

      const t = this.scene.add.text(pillX + pillW / 2, yOff + PILL_H / 2, label, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#ffeecc',
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);
      yOff += PILL_H + GAP;
    }

    for (const ec of this.activeElementCombos) {
      const label  = `⚡${ec.combo.name}`;
      const tmp    = this.scene.add.text(0, -1000, label, { fontFamily: 'sans-serif', fontSize: '11px' });
      const pillW  = Math.max(tmp.width + 12, 48);
      tmp.destroy();

      const pillX = CANVAS_WIDTH - 8 - pillW;

      const g = this.scene.add.graphics().setDepth(85);
      g.fillStyle(0x001428, 0.92);
      g.fillRoundedRect(pillX, yOff, pillW, PILL_H - 4, 4);
      g.lineStyle(1, 0x2266aa, 0.8);
      g.strokeRoundedRect(pillX, yOff, pillW, PILL_H - 4, 4);

      const t = this.scene.add.text(pillX + pillW / 2, yOff + (PILL_H - 4) / 2, label, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#88ccff',
      }).setOrigin(0.5).setDepth(86);

      this.display.add([g, t]);
      yOff += (PILL_H - 4) + GAP;
    }
  }
}
