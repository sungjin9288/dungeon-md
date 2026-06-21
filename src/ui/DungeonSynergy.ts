// ─── DungeonSynergy ───────────────────────────────────────────────────────────
// Synergy connector lines and summary badges drawn over the dungeon slot grid.
// Extracted from DungeonHomeScene.rebuildDungeonSlots().

import Phaser from 'phaser';
import type { DungeonTheme } from '../themes/themes';
import type { DungeonSlot } from '../data/wisdom';
import { SLOT_W, SLOT_H } from './RoomSlotRenderer';
import type { DungeonBoardLayout } from './DungeonBoardLayout';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── Layout context ───────────────────────────────────────────────────────────

export interface SynergyDrawContext {
  readonly scene: Phaser.Scene;
  readonly theme: DungeonTheme;
  readonly slots: (DungeonSlot | null)[];
  readonly gridCols: number;
  readonly gridRows: number;
  readonly slotW: number;
  readonly slotH: number;
  readonly slotPadX: number;
  readonly slotPadY: number;
  readonly gridStartY: number;
  /** When provided, positions are read from the layout rather than computed
   *  from the flat-grid formula. In vertical-cutaway mode, only intra-band
   *  (horizontal) connectors are drawn to avoid visual clutter. */
  readonly layout?: DungeonBoardLayout;
}

// ─── Connector lines ─────────────────────────────────────────────────────────

const SYNERGY_COLOR: Record<string, number> = {
  combat:  0xcc3333,
  trap:    0x884488,
  support: 0x33aa55,
  magic:   0x3366cc,
};

/**
 * Draw subtle resource channels between adjacent rooms of the same type.
 * The caller draws this before room shells so synergy reads as floor wiring,
 * not as a UI line over monsters or traps.
 */
export function drawSynergyConnectors(
  ctx: SynergyDrawContext,
  c: Phaser.GameObjects.Container,
  unlockedCount: number,
): void {
  const { scene, slots, gridCols, gridRows, slotPadX, slotPadY, gridStartY, layout } = ctx;
  const reducedMotion = getReducedMotion();

  const pairs: Array<[number, number]> = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      if (idx >= unlockedCount) continue;
      // Horizontal (intra-band) neighbour — always included
      if (col + 1 < gridCols) {
        const nIdx = row * gridCols + (col + 1);
        if (nIdx < unlockedCount) pairs.push([idx, nIdx]);
      }
      // Vertical (cross-band) neighbour — only when NOT in layout mode.
      // In vertical-cutaway the route shaft already shows the flow; cross-band
      // synergy lines would be visually confusing, so we skip them.
      if (!layout && row + 1 < gridRows) {
        const nIdx = (row + 1) * gridCols + col;
        if (nIdx < unlockedCount) pairs.push([idx, nIdx]);
      }
    }
  }

  for (const [aIdx, bIdx] of pairs) {
    const aSlot = slots[aIdx];
    const bSlot = slots[bIdx];
    if (!aSlot?.roomType || !bSlot?.roomType) continue;
    if (aSlot.roomType !== bSlot.roomType) continue;
    if (aSlot.hp <= 0 || bSlot.hp <= 0) continue;

    // Resolve centres — prefer layout lookup (accurate for any mode).
    let ax: number, ay: number, bx: number, by: number;
    const aCell = layout?.cellsByIdx.get(aIdx);
    const bCell = layout?.cellsByIdx.get(bIdx);
    if (aCell && bCell) {
      ax = aCell.center.x; ay = aCell.center.y;
      bx = bCell.center.x; by = bCell.center.y;
    } else {
      const aRow = Math.floor(aIdx / gridCols), aCol = aIdx % gridCols;
      const bRow = Math.floor(bIdx / gridCols), bCol = bIdx % gridCols;
      ax = slotPadX + aCol * (SLOT_W + slotPadX) + SLOT_W / 2;
      ay = gridStartY + aRow * (SLOT_H + slotPadY) + SLOT_H / 2;
      bx = slotPadX + bCol * (SLOT_W + slotPadX) + SLOT_W / 2;
      by = gridStartY + bRow * (SLOT_H + slotPadY) + SLOT_H / 2;
    }

    const cellHalfW = (layout?.slotW ?? SLOT_W) / 2 - 4;
    const cellHalfH = (layout?.slotH ?? SLOT_H) / 2 - 4;

    const color = SYNERGY_COLOR[aSlot.roomType] ?? 0xffffff;
    const dx = bx - ax;
    const dy = by - ay;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const dir = horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
    const from = horizontal
      ? { x: ax + dir * cellHalfW, y: ay }
      : { x: ax, y: ay + dir * cellHalfH };
    const to = horizontal
      ? { x: bx - dir * cellHalfW, y: by }
      : { x: bx, y: by - dir * cellHalfH };

    // Layered floor channel
    const sg = scene.add.graphics();
    sg.lineStyle(7, color, 0.08);
    sg.lineBetween(from.x, from.y, to.x, to.y);
    sg.lineStyle(3, color, 0.24);
    sg.lineBetween(from.x, from.y, to.x, to.y);
    sg.lineStyle(1, 0xffffff, 0.18);
    sg.lineBetween(from.x, from.y, to.x, to.y);
    c.add(sg);

    // Travelling floor pulse
    const dot = scene.add.graphics();
    dot.fillStyle(color, 0.58);
    dot.fillCircle(0, 0, 2.2);
    c.add(dot);
    if (reducedMotion) {
      // Static node at the channel midpoint — the link still reads, no travel.
      dot.setPosition((from.x + to.x) / 2, (from.y + to.y) / 2);
    } else {
      dot.setPosition(from.x, from.y);
      scene.tweens.add({
        targets: dot, x: to.x, y: to.y,
        duration: 1450 + Math.random() * 700,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Math.random() * 800,
      });
    }
  }
}

// ─── Summary badges ──────────────────────────────────────────────────────────

const TYPE_INFO: Record<string, { color: string; icon: string; bonus: string }> = {
  combat:  { color: '#cc5555', icon: '👊', bonus: '몬스터 슬롯+1'   },
  trap:    { color: '#aa66cc', icon: '🕸', bonus: '함정피해+20%'    },
  support: { color: '#44bb77', icon: '💚', bonus: '인접ATK+15%'    },
  magic:   { color: '#5588dd', icon: '🔮', bonus: '쿨다운-20%'     },
};

/**
 * Render a compact badge row below the grid for each active synergy type
 * (≥2 rooms of the same type with HP > 0).
 */
export function drawSynergySummary(
  ctx: SynergyDrawContext,
  c: Phaser.GameObjects.Container,
  canvasWidth: number,
): void {
  const { scene, theme: t, slots, gridRows, slotPadY, gridStartY, layout } = ctx;

  const typeCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (slot?.roomType && slot.hp > 0) {
      typeCounts[slot.roomType] = (typeCounts[slot.roomType] ?? 0) + 1;
    }
  }

  const activeTypes = Object.entries(typeCounts).filter(([, cnt]) => cnt >= 2);
  if (activeTypes.length === 0) return;

  // In vertical-cutaway mode use contentBottomY from the layout; otherwise the flat-grid formula.
  const baseY = layout
    ? layout.contentBottomY + 4
    : gridStartY + gridRows * (SLOT_H + slotPadY) + 4;
  let xOff = 8;

  for (const [type, count] of activeTypes) {
    const info = TYPE_INFO[type];
    if (!info) continue;

    const badge = scene.add.graphics().setDepth(4);
    badge.fillStyle(t.panelDark, 0.9);
    badge.fillRoundedRect(xOff, baseY, 106, 18, 4);
    badge.lineStyle(1, parseInt(info.color.replace('#', ''), 16), 0.7);
    badge.strokeRoundedRect(xOff, baseY, 106, 18, 4);
    c.add(badge);

    c.add(scene.add.text(xOff + 5, baseY + 9, `${info.icon} ×${count} ${info.bonus}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: info.color,
    }).setOrigin(0, 0.5).setDepth(5));

    xOff += 112;
    if (xOff + 106 > canvasWidth) break;
  }
}
