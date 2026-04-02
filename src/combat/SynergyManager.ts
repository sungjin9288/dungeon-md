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
    let yOff = 50;

    for (const syn of this.activeSynergies) {
      const emoji = TRIBE_EMOJI[syn.tribe] ?? '❓';
      const t = this.scene.add.text(CANVAS_WIDTH - 10, yOff, `${emoji}${syn.count}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ffcc44',
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      }).setOrigin(1, 0).setDepth(85);
      this.display.add(t);
      yOff += 22;
    }

    for (const ec of this.activeElementCombos) {
      const t = this.scene.add.text(CANVAS_WIDTH - 10, yOff, `⚡${ec.combo.name}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#88ccff',
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      }).setOrigin(1, 0).setDepth(85);
      this.display.add(t);
      yOff += 20;
    }
  }
}
