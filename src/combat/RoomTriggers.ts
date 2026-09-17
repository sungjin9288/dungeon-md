// ─── Room Triggers ────────────────────────────────────────────────────────────
// One-shot triggered combat effects, extracted from RoomMechanics.ts.
// All functions take RoomMechanicsContext (defined in RoomMechanics.ts).
//
//   updateArmoryBonuses   — recalculate armory attack bonus for guardian rooms
//   runTrapEffects        — apply dungeon slot traps to passing invaders
//   applyTrapToInvader    — inner helper for runTrapEffects
//   triggerScrollBurst    — library scroll burst (4s magic dmg boost + VFX)
//   triggerChainLightning — arc chain between nearby invaders
//   triggerSpectralBolt   — row-wide ghostly bolt
//   triggerWhirlwind      — spinning vortex row AOE
//   recalcRoomTypeBonuses — recompute room-type synergy multipliers after build

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { RoomData } from '../data/rooms';
import { getArmoryDmgBonus, getArmoryRadius } from '../data/rooms';
import type { DungeonSlot } from '../data/wisdom';
import { getTrapDef, trapMasteryMult, type AfflictionId } from '../data/traps';
import { GRID_ROWS, GRID_X, GRID_Y, CELL_SIZE } from '../constants/layout';
import { logger } from '../utils/logger';
import type { RoomMechanicsContext } from './RoomMechanics';

// ─── Trap column centers (static) ───────────────────────────────────────────

const TRAP_COL_CENTERS = [
  GRID_X + CELL_SIZE * 0.5,
  GRID_X + CELL_SIZE * 1.5,
  GRID_X + CELL_SIZE * 2.5,
];

// ─── updateArmoryBonuses ────────────────────────────────────────────────────

export function updateArmoryBonuses(ctx: RoomMechanicsContext): void {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const d = ctx.roomGrid[row][col];
      if (!d || d.type !== 'guardian') continue;
      let bonus = 0;
      // Find nearest armory within its radius
      for (let ar = 0; ar < GRID_ROWS; ar++) {
        for (let ac = 0; ac < ctx.effectiveCols; ac++) {
          const ad = ctx.roomGrid[ar][ac];
          if (!ad || ad.type !== 'armory') continue;
          const radius = getArmoryRadius(ad.level);
          const dist = Math.max(Math.abs(ar - row), Math.abs(ac - col));
          if (dist <= radius) {
            bonus = Math.max(bonus, getArmoryDmgBonus(ad.level));
          }
        }
      }
      d.armoryDmgBonus = bonus;
    }
  }
}

// ─── runTrapEffects ─────────────────────────────────────────────────────────

export function runTrapEffects(ctx: RoomMechanicsContext, now: number): void {
  if (ctx.dungeonTrapSlots.length === 0) return;
  for (const inv of ctx.activeInvaders) {
    if (!inv.active || inv.isDead || inv.isTrapImmune) continue;
    if (!('_trapCols' in inv)) (inv as unknown as Record<string, unknown>)['_trapCols'] = new Set<number>();
    const triggered = (inv as unknown as Record<string, unknown>)['_trapCols'] as Set<number>;

    for (let col = 0; col < 3; col++) {
      const cx = TRAP_COL_CENTERS[col];
      if (Math.abs(inv.x - cx) > 45 || triggered.has(col)) continue;
      triggered.add(col);

      // Check all rows of dungeonSlots for this column
      for (let row = 0; row < GRID_ROWS; row++) {
        const slotIdx = row * 3 + col;
        const slot    = ctx.dungeonTrapSlots[slotIdx];
        if (!slot) continue;
        for (const trapId of (slot.trapIds ?? [])) {
          applyTrapToInvader(ctx, inv, slot, slotIdx, trapId, now);
        }
      }
    }
  }
}

// ─── applyTrapToInvader ─────────────────────────────────────────────────────

export function applyTrapToInvader(
  ctx: RoomMechanicsContext,
  inv: Invader,
  slot: DungeonSlot,
  slotIdx: number,
  trapId: string | undefined,
  now: number,
): void {
  const def = getTrapDef(trapId);
  if (!def || slot.hp <= 0) return;   // broken rooms don't trigger traps
  // Trap room bonus: +20% trap damage + synergy bonus + 함정술사 set bonus,
  // then the trap type's mastery (+15% per level).
  const trapRoomMult  = slot.roomType === 'trap' ? 1.2 : 1.0;
  const synergyMult   = ctx.slotTrapSynergyMult.get(slotIdx) ?? 1.0;
  const mastery       = trapMasteryMult(ctx.trapMastery?.[def.id] ?? 0);
  const dmgMult = slot.roomLevel * trapRoomMult * synergyMult * (ctx.decorationTrapMult ?? 1) * mastery;
  for (const affliction of def.afflictions) {
    applyAffliction(inv, affliction, dmgMult, mastery, now);
    inv.noteAffliction(affliction, now);
  }
  logger.debug(`[TRAP] slot${slotIdx} ${def.id}: ${def.afflictions.join('+')} ×${dmgMult.toFixed(2)}`);
}

/** One affliction's concrete effect. Durations scale with mastery, damage with dmgMult. */
function applyAffliction(inv: Invader, affliction: AfflictionId, dmgMult: number, mastery: number, now: number): void {
  switch (affliction) {
    case 'bleed':
      inv.takeDamage(20 * dmgMult);
      break;
    case 'slow':
      inv.applySlow(0.6, Math.round(2000 * mastery));
      break;
    case 'poison':
      inv.burnStacks.push({ startTime: now, lastTickTime: now, damage: 8 * dmgMult, duration: 4000 });
      break;
    case 'shock':
      inv.applyStun(Math.round(1000 * mastery));
      break;
    case 'burn':
      inv.burnStacks.push({ startTime: now, lastTickTime: now, damage: 10 * dmgMult, duration: 3000 });
      break;
    case 'fear':
      inv.applyCharm(Math.round(2000 * mastery));
      break;
  }
}

// ─── triggerScrollBurst ─────────────────────────────────────────────────────

export function triggerScrollBurst(ctx: RoomMechanicsContext, libraryData: RoomData): void {
  libraryData.scrollBurstActiveUntil = ctx.scene.time.now + 4000 / ctx.speedMult;
  // Purple wave ripple visual from this library's room
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const d = ctx.roomGrid[row][col];
      if (d === libraryData) {
        const g = ctx.scene.add.graphics().setDepth(50);
        g.lineStyle(3, 0xaa44ff, 0.9);
        g.strokeCircle(ctx.rooms[row][col].x, ctx.rooms[row][col].y, 10);
        ctx.scene.tweens.add({ targets: g, scaleX: 10, scaleY: 10, alpha: 0, duration: 600,
          onComplete: () => g.destroy() });
        const t = ctx.scene.add.text(ctx.rooms[row][col].x, ctx.rooms[row][col].y - 20, '\ud83d\udcdc \ud3ed\ubc1c!', {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
        }).setOrigin(0.5).setDepth(51);
        ctx.scene.tweens.add({ targets: t, y: ctx.rooms[row][col].y - 50, alpha: 0, duration: 800,
          onComplete: () => t.destroy() });
      }
    }
  logger.debug('[SCROLL_BURST] Lv3 burst — 2x magic dmg for 4s');
}

// ─── triggerChainLightning ──────────────────────────────────────────────────

export function triggerChainLightning(ctx: RoomMechanicsContext, source: Invader, chainDmg: number, maxChains: number): void {
  const chained = new Set<Invader>([source]);
  let current = source;
  for (let i = 0; i < maxChains; i++) {
    let nearest: Invader | null = null;
    let nearestDist = Infinity;
    for (const inv of ctx.activeInvaders) {
      if (!inv.active || chained.has(inv)) continue;
      const d = Math.hypot(inv.x - current.x, inv.y - current.y);
      if (d < 120 && d < nearestDist) { nearestDist = d; nearest = inv; }
    }
    if (!nearest) break;
    chained.add(nearest);
    nearest.takeDamage(chainDmg, true);
    // Lightning arc visual
    const arc = ctx.scene.add.graphics().setDepth(55);
    arc.lineStyle(2, 0xffee44, 0.9);
    arc.lineBetween(current.x, current.y, nearest.x, nearest.y);
    // Zig-zag: add 2 mid points offset
    const mx = (current.x + nearest.x) / 2 + Phaser.Math.Between(-12, 12);
    const my = (current.y + nearest.y) / 2 + Phaser.Math.Between(-12, 12);
    arc.lineStyle(1.5, 0xffffff, 0.7);
    arc.lineBetween(current.x, current.y, mx, my);
    arc.lineBetween(mx, my, nearest.x, nearest.y);
    ctx.scene.tweens.add({ targets: arc, alpha: 0, duration: 250, onComplete: () => arc.destroy() });
    current = nearest;
  }
  if (chained.size > 1) {
    const t = ctx.scene.add.text(source.x, source.y - 18, `\u26a1\u00d7${chained.size - 1}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffee44',
    }).setOrigin(0.5).setDepth(56);
    ctx.scene.tweens.add({ targets: t, y: source.y - 45, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    logger.debug(`[CHAIN_LIGHTNING] chained ${chained.size - 1} targets @ ${chainDmg} dmg`);
  }
}

// ─── triggerSpectralBolt ────────────────────────────────────────────────────

export function triggerSpectralBolt(ctx: RoomMechanicsContext, fromX: number, _fromY: number, row: number, dmg: number): void {
  const cs = ctx.effectiveCellSize;
  const rowY = GRID_Y + row * cs + cs / 2;
  let hits = 0;

  // Ghostly bolt visual travelling right to left
  const bolt = ctx.scene.add.graphics().setDepth(55);
  bolt.fillStyle(0xaaddff, 0.9);
  bolt.fillEllipse(fromX, rowY, 14, 8);
  ctx.scene.tweens.add({
    targets: bolt, x: -40, duration: 600, ease: 'Linear',
    onComplete: () => bolt.destroy(),
  });

  // Deal damage to all invaders in row
  ctx.activeInvaders.forEach(inv => {
    if (!inv.active || Math.abs(inv.y - rowY) > cs * 0.7) return;
    inv.takeDamage(dmg, true);
    hits++;
    const flash = ctx.scene.add.graphics().setDepth(inv.depth + 2);
    flash.fillStyle(0xaaddff, 0.6);
    flash.fillCircle(inv.x, inv.y, inv.def.radius + 4);
    ctx.scene.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
  });

  if (hits > 0) logger.debug(`[SPECTRAL_BOLT] row=${row} hits=${hits} dmg=${dmg}`);
}

// ─── triggerWhirlwind ───────────────────────────────────────────────────────

export function triggerWhirlwind(ctx: RoomMechanicsContext, row: number, dmg: number, rx: number, ry: number): void {
  const cs = ctx.effectiveCellSize;
  const rowY = GRID_Y + row * cs + cs / 2;
  let hits = 0;
  ctx.activeInvaders.forEach(inv => {
    if (!inv.active || Math.abs(inv.y - rowY) > cs * 0.8) return;
    inv.takeDamage(dmg);
    hits++;
  });
  // Spinning vortex visual
  const g = ctx.scene.add.graphics().setDepth(55);
  g.lineStyle(3, 0xff6622, 0.9);
  g.strokeCircle(rx, ry, 20);
  ctx.scene.tweens.add({ targets: g, scaleX: 5, scaleY: 5, alpha: 0, rotation: Math.PI * 2, duration: 600,
    onComplete: () => g.destroy() });
  const t = ctx.scene.add.text(rx, ry - 20, '\ud83c\udf00 \ud68c\uc624\ub9ac!', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ff8844',
  }).setOrigin(0.5).setDepth(56);
  ctx.scene.tweens.add({ targets: t, y: ry - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  logger.debug(`[WHIRLWIND] row=${row} hits=${hits} dmg=${dmg}`);
}

// ─── recalcRoomTypeBonuses ──────────────────────────────────────────────────

export function recalcRoomTypeBonuses(ctx: RoomMechanicsContext): void {
  const gc = ctx.effectiveCols;

  // Reset all bonuses
  ctx.slotTrapSynergyMult.clear();
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < gc; c++) {
      const data = ctx.roomGrid[r][c];
      if (data) data.roomTypeDmgMult = 1.0;
    }
  }

  const adj = (r: number, c: number): Array<[number, number]> =>
    ([ [-1,0],[1,0],[0,-1],[0,1] ] as Array<[number, number]>)
      .filter(([dr, dc]) => r+dr>=0 && r+dr<GRID_ROWS && c+dc>=0 && c+dc<gc)
      .map(([dr, dc]) => [r+dr, c+dc] as [number, number]);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < gc; c++) {
      const idx  = r * gc + c;
      const slot = ctx.dungeonTrapSlots[idx];
      if (!slot || slot.hp <= 0) continue;   // broken rooms grant no bonus

      // support room: adjacent rooms ATK +15%
      if (slot.roomType === 'support') {
        for (const [nr, nc] of adj(r, c)) {
          const adjData = ctx.roomGrid[nr][nc];
          if (adjData) adjData.roomTypeDmgMult = Math.max(adjData.roomTypeDmgMult, 1.15);
        }
      }

      // synergy: combat + magic adjacent
      if (slot.roomType === 'combat') {
        const hasMagicNeighbor = adj(r, c).some(([nr, nc]) => {
          const ns = ctx.dungeonTrapSlots[nr * gc + nc];
          return ns && ns.roomType === 'magic' && ns.hp > 0;
        });
        if (hasMagicNeighbor) {
          const data = ctx.roomGrid[r][c];
          if (data) data.roomTypeDmgMult = Math.max(data.roomTypeDmgMult, 1.1);
          logger.debug(`[SYNERGY] combat+magic synergy at [${r},${c}]`);
        }
      }
      if (slot.roomType === 'magic') {
        const hasCombatNeighbor = adj(r, c).some(([nr, nc]) => {
          const ns = ctx.dungeonTrapSlots[nr * gc + nc];
          return ns && ns.roomType === 'combat' && ns.hp > 0;
        });
        if (hasCombatNeighbor) {
          const data = ctx.roomGrid[r][c];
          if (data) data.attackCooldown = Math.round(data.attackCooldown * 0.9);
        }
      }

      // synergy: trap + support adjacent
      if (slot.roomType === 'trap') {
        const hasSupportNeighbor = adj(r, c).some(([nr, nc]) => {
          const ns = ctx.dungeonTrapSlots[nr * gc + nc];
          return ns && ns.roomType === 'support' && ns.hp > 0;
        });
        if (hasSupportNeighbor) {
          ctx.slotTrapSynergyMult.set(idx, 1.15);
          logger.debug(`[SYNERGY] trap+support synergy at [${r},${c}]`);
        }
      }
    }
  }
}
