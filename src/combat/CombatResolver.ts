// ─── CombatResolver ───────────────────────────────────────────────────────────
// Per-room combat logic extracted from DungeonScene.runCombat.
//
// Two exported functions cover the complete attack pipeline for one grid cell:
//
//   findTarget()    — scans activeInvaders and returns the best target (or null)
//   resolveAttack() — applies damage, passives, and VFX for one room→target pair;
//                     returns `true` when the caller should `continue` to the
//                     next grid cell (charm-orb, spectral-bolt, etc. intercept
//                     the normal damage path).

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { Room } from '../objects/Room';
import { ROOM_DEFS, getScrollAuraBonus, type RoomData } from '../data/rooms';
import { type CombatMonsterDef, type TribeId } from '../data/monsters';
import type { EquipmentStats } from '../data/barracks';
import { GRID_ROWS, GRID_Y, CANVAS_WIDTH } from '../constants/layout';
import {
  hasDivineTerritory,
  hasTribeMasteryFor,
  hasSeasonalBoon,
  isScrollBurstActive,
  getInvaderRow,
} from './GridQueries';
import {
  showAttackLine     as _showAttackLine,
  showFirstStrikeEffect as _showFirstStrikeEffect,
  showTrapRing       as _showTrapRing,
  showHolyBurst      as _showHolyBurst,
  spawnCharmOrb      as _spawnCharmOrb,
  showTideWave       as _showTideWave,
  showMagicImmuneMiss as _showMagicImmuneMiss,
  showFloatText      as _showFloatText,
  showGoldFloat      as _showGoldFloat,
  triggerDragonRoar  as _triggerDragonRoar,
} from './VisualEffects';
import { logger } from '../utils/logger';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface CombatResolverContext {
  readonly scene:              Phaser.Scene;
  readonly rooms:              Room[][];
  readonly roomGrid:           (RoomData | null)[][];
  readonly activeInvaders:     Invader[];
  readonly effectiveCols:      number;
  readonly effectiveCellSize:  number;
  readonly equipmentMap:       Map<string, EquipmentStats>;
  readonly waveAtkMult:        number;
  readonly wisdomBonuses:      { monsterAtkMult: number };
  readonly prestigeDmgMult:    number;
  readonly speedMult:          number;

  // Live getters — these can change mid-frame (GOLD_KILL, TAUNTING_ROAR)
  get gold(): number; set gold(v: number);
  get tauntBoostActiveUntil(): number;

  setGoldRegistry(v: number): void;
  hasSynergy(id: string): boolean;
  applyWarHexToHighestHP(): void;
  triggerTauntingRoar(rx: number, ry: number): void;
  triggerSpectralBolt(roomX: number, cellCenterY: number, row: number, dmg: number): void;
  triggerWhirlwind(row: number, dmg: number, roomX: number, cellCenterY: number): void;
  triggerChainLightning(source: Invader, chainDmg: number, maxChains: number): void;
}

// ─── findTarget ───────────────────────────────────────────────────────────────
// Scans the live invader list and returns the best attack target for a given
// room cell, respecting immunity flags, void-phase windows, invisibility, and
// the SUN_DIVE passive (targets highest path progress, ignoring row range).

export function findTarget(
  activeInvaders: Invader[],
  data:           RoomData,
  mDef:           CombatMonsterDef | null,
  roomX:          number,
  cellCenterY:    number,
  rowRange:       number,
  now:            number,
): Invader | null {
  const isSunDive = mDef?.passive === 'SUN_DIVE';
  let target: Invader | null = null;
  // Normal mode: minimise distance → start high.
  // SUN_DIVE mode: maximise pathProgress → start low.
  let bestDist = isSunDive ? -Infinity : Infinity;

  for (const inv of activeInvaders) {
    if (!inv.active) continue;
    // STUN_IMMUNE bosses: only damageable while stunned
    if (inv.isDamageImmune && !inv.isStunned) continue;
    // Void phase / stealth: immune to trap rooms for first N seconds
    if ((data.type === 'trap' || data.type === 'trap_corridor') && now < inv.voidPhaseUntil) continue;
    // TRAP_IMMUNITY: skip trap rooms entirely
    if ((data.type === 'trap' || data.type === 'trap_corridor') && inv.isTrapImmune) continue;
    // Invisible invaders: single-target attacks miss
    if (inv.isInvisible) continue;

    if (isSunDive) {
      // SUN_DIVE: ignores row restriction, targets highest pathProgress (closest to exit)
      const prog = inv.pathTween?.progress ?? 0;
      if (prog > bestDist) { bestDist = prog; target = inv; }
    } else {
      if (Math.abs(inv.y - cellCenterY) > rowRange) continue;
      const dist = Math.hypot(inv.x - roomX, inv.y - cellCenterY);
      if (dist < bestDist) { bestDist = dist; target = inv; }
    }
  }
  return target;
}

// ─── resolveAttack ────────────────────────────────────────────────────────────
// Applies the full single-room attack pipeline for one (room, target) pair.
//
// Returns `true` when the outer loop should `continue` to the next cell —
// e.g., charm-orb, WAR_HEX, SPECTRAL_BOLT, and magic-immunity misses all
// intercept the normal damage path and signal early termination via this flag.

export function resolveAttack(
  ctx:         CombatResolverContext,
  row:         number,
  col:         number,
  data:        RoomData,
  mDef:        CombatMonsterDef | null,
  target:      Invader,
  cellCenterY: number,
  now:         number,
): boolean {
  const roomX = ctx.rooms[row][col].x;

  // ── Base damage: prefer monster baseDamage when available ───────────────────
  const baseDmg = (mDef && mDef.baseDamage > 0)
    ? mDef.baseDamage
    : ROOM_DEFS[data.type].attackDamage;
  let dmg = baseDmg
    * Math.pow(1.4, data.level - 1)
    * data.roomTypeDmgMult
    * ctx.waveAtkMult
    * ctx.wisdomBonuses.monsterAtkMult
    * ctx.prestigeDmgMult;

  // ── Equipment bonus ─────────────────────────────────────────────────────────
  const eqStats = data.monsterSlot ? ctx.equipmentMap.get(data.monsterSlot) : undefined;
  if (eqStats?.atkMult) dmg *= (1 + eqStats.atkMult);

  // ── Scroll Library aura bonus (+15/25/40% to magic monsters) ────────────────
  const isMagicMonster = mDef?.type === 'magic';
  if (isMagicMonster) {
    for (let sr = 0; sr < GRID_ROWS; sr++) {
      for (let sc = 0; sc < ctx.effectiveCols; sc++) {
        const sd = ctx.roomGrid[sr][sc];
        if (!sd || sd.type !== 'scroll_library') continue;
        const dist = Math.abs(sr - row) + Math.abs(sc - col);
        if (dist <= 3) {
          dmg *= 1 + getScrollAuraBonus(sd.level);
          break;
        }
      }
    }
  }

  // ── Scroll Burst (Lv3 scroll_library active) ─────────────────────────────────
  if (isMagicMonster && isScrollBurstActive(ctx.roomGrid, ctx.effectiveCols, row, col, now)) {
    dmg *= 2;
  }

  // ── TAUNTING_ROAR boost: all rooms +30% while active ─────────────────────────
  if (now < ctx.tauntBoostActiveUntil) dmg *= 1.3;

  // ── Armory bonus: adjacent armory buffs guardian rooms (Ch3) ─────────────────
  if (data.type === 'guardian' && data.armoryDmgBonus > 0) {
    dmg *= (1 + data.armoryDmgBonus);
  }

  // ── DIVINE_TERRITORY (mountain_god): all monsters +20% dmg ───────────────────
  if (hasDivineTerritory(ctx.roomGrid)) dmg *= 1.2;

  // ── TRIBE_MASTERY: same-tribe monsters +15% ATK ───────────────────────────────
  if (mDef?.tribe && hasTribeMasteryFor(ctx.roomGrid, mDef.tribe as TribeId)) dmg *= 1.15;

  // ── SEASONAL_BOON: all monsters +10% ATK ─────────────────────────────────────
  if (hasSeasonalBoon(ctx.roomGrid)) dmg *= 1.10;

  // ── GHOST_ARROW: attacks ignore armor — bypass damage reductions ──────────────
  const isGhostArrow = mDef?.passive === 'GHOST_ARROW';
  if (isGhostArrow) dmg *= 1.30;

  // ── Dragon's Lair: 2× dmg vs boss invaders ────────────────────────────────────
  if (data.type === 'dragons_lair' && target.def.isBoss) dmg *= 2;

  // ── Active skill: heavy_strike (3× next attack) ───────────────────────────────
  if (data.nextAttack3x) { dmg *= 3; data.nextAttack3x = false; }

  // ── Active skill: rage (+100% ATK for 10s) ────────────────────────────────────
  if (now < (data.rageUntil ?? 0)) dmg *= 2;

  // ── Active skill: speed_up (attack 50% faster for 8s) ─────────────────────────
  if (now < (data.speedBoostUntil ?? 0)) {
    data.attackCooldown = ROOM_DEFS[data.type].attackCooldown * 0.5;
  } else if (data.speedBoostUntil > 0 && now >= data.speedBoostUntil) {
    data.attackCooldown = ROOM_DEFS[data.type].attackCooldown;
    data.speedBoostUntil = 0;
  }

  // ── FIRST_STRIKE_STUN passive ─────────────────────────────────────────────────
  if (mDef?.passive === 'FIRST_STRIKE_STUN' && !data.hasFirstStrikeUsed) {
    data.hasFirstStrikeUsed = true;
    dmg *= 2;
    target.applyStun(1500);
    _showFirstStrikeEffect(ctx.scene, roomX, cellCenterY);
  }

  // ── EMBER_TRAIL passive ───────────────────────────────────────────────────────
  if (mDef?.passive === 'EMBER_TRAIL' && !target.isFireImmune) {
    target.applyBurn(now);
  }

  // ── PINNING_SHOT passive ──────────────────────────────────────────────────────
  const procB = eqStats?.procBonus ?? 0;
  if (mDef?.passive === 'PINNING_SHOT' && Math.random() < 0.20 + procB) {
    target.applyRoot(800);
  }

  // ── PERMAFROST passive — 30% freeze chance, 1200ms ────────────────────────────
  if (mDef?.passive === 'PERMAFROST' && !target.isFrozen
      && !target.isMagicImmune && now >= target.magicImmuneUntil
      && Math.random() < 0.30 + procB) {
    target.applyFreeze(1200);
  }

  // ── FOX_FIRE_CHARM passive — every 3rd attack, charm orb ─────────────────────
  if (mDef?.passive === 'FOX_FIRE_CHARM'
      && !target.isCharmed && !target.isMagicImmune && now >= target.magicImmuneUntil) {
    data.foxCharmAttackCount++;
    const charmN = eqStats?.charmEvery ?? 3;
    if (data.foxCharmAttackCount % charmN === 0) {
      _spawnCharmOrb(ctx.scene, roomX, cellCenterY, target);
      data.lastAttackTime = now;
      ctx.rooms[row][col].flashAttack();
      return true; // charm orb replaces normal attack
    }
  }

  // ── TIDE_THRUST passive — every 4th hit pushback ──────────────────────────────
  if (mDef?.passive === 'TIDE_THRUST' && !target.isUnstoppable) {
    data.tideHitCount++;
    if (data.tideHitCount % 4 === 0) {
      target.applyPushback(60);
      _showTideWave(ctx.scene, target.x, target.y);
    }
  }

  // ── WAR_HEX passive — per-room interval, no direct damage ─────────────────────
  if (mDef?.passive === 'WAR_HEX') {
    ctx.applyWarHexToHighestHP();
    data.lastAttackTime = now;
    ctx.rooms[row][col].flashAttack();
    return true; // no direct damage
  }

  // ── TAUNTING_ROAR passive — 8000ms interval ───────────────────────────────────
  if (mDef?.passive === 'TAUNTING_ROAR') {
    if (now - data.tauntLastTime >= 8000) {
      data.tauntLastTime = now;
      ctx.triggerTauntingRoar(roomX, cellCenterY);
    }
  }

  // ── celestial_shrine: holy slow + bypasses DIVINE_WARD ───────────────────────
  if (data.type === 'celestial_shrine') {
    target.applySlow(0.7, 1500);
    if (data.level >= 2 && target.isMagicImmune) dmg = Math.max(dmg, 10);
    if (data.level >= 3) dmg *= 1.5;
    _showHolyBurst(ctx.scene, roomX, cellCenterY);
  }

  // ── void_forge: 3-row penetrating AoE ────────────────────────────────────────
  if (data.type === 'void_forge') {
    const voidRows = [row - 1, row, row + 1].filter(r => r >= 0 && r < GRID_ROWS);
    for (const vr of voidRows) {
      for (const inv of ctx.activeInvaders) {
        if (!inv.active || inv === target) continue;
        if (getInvaderRow(ctx.effectiveCellSize, inv) === vr) {
          inv.takeDamage(Math.round(dmg * 0.6));
        }
      }
    }
  }

  // ── trap_corridor per-level effects ───────────────────────────────────────────
  if (data.type === 'trap_corridor') {
    target.applySlow(0.6, 2000);
    if (data.level >= 2) target.applyBurn(now);
    if (data.level >= 3) {
      dmg += 20;
      if (target.isFrozen) dmg *= 2;
    }
    _showTrapRing(ctx.scene, roomX, cellCenterY);
  } else if (data.type === 'trap') {
    _showTrapRing(ctx.scene, roomX, cellCenterY);
  }

  // ── SIEGE_SHIELD: 50% dmg reduction from trap rooms (GHOST_ARROW ignores) ─────
  if (!isGhostArrow && target.hasSiegeShield && (data.type === 'trap' || data.type === 'trap_corridor')) {
    dmg *= 0.5;
  }
  // ── IRON_BODY: halves all damage (GHOST_ARROW ignores) ────────────────────────
  if (!isGhostArrow && target.hasIronBody) dmg *= 0.5;

  // ── DRAGON_KING phase 3: submerged — only traps deal damage ───────────────────
  if (target.isSubmerged && data.type !== 'trap' && data.type !== 'trap_corridor') {
    _showMagicImmuneMiss(ctx.scene, target.x, target.y);
    data.lastAttackTime = now;
    ctx.rooms[row][col].flashAttack();
    return true;
  }

  // ── DIVINE_WARD: magic attacks miss — CELESTIAL_PIERCE bypasses ───────────────
  const celestialPierce = ctx.hasSynergy('CELESTIAL_PIERCE') && mDef?.tribe === 'celestial';
  if (target.isMagicImmune && mDef?.type === 'magic' && !celestialPierce) dmg = 0;

  // ── MAGIC_IMMUNITY_WINDOW: first 5s magic immune ──────────────────────────────
  if (now < target.magicImmuneUntil && mDef?.type === 'magic') {
    _showMagicImmuneMiss(ctx.scene, target.x, target.y);
    data.lastAttackTime = now;
    ctx.rooms[row][col].flashAttack();
    return true;
  }

  // ── SPECTRAL_BOLT: piercing bolt hits all in same row ─────────────────────────
  if (mDef?.passive === 'SPECTRAL_BOLT') {
    ctx.triggerSpectralBolt(roomX, cellCenterY, row, Math.round(dmg));
    data.lastAttackTime = now;
    ctx.rooms[row][col].flashAttack();
    return true;
  }

  // ── WHIRLWIND_DANCE: every 5th hit full-row AoE 150% ─────────────────────────
  if (mDef?.passive === 'WHIRLWIND_DANCE') {
    data.whirlwindHitCount++;
    if (data.whirlwindHitCount % 5 === 0) {
      ctx.triggerWhirlwind(row, Math.round(dmg * 1.5), roomX, cellCenterY);
      data.lastAttackTime = now;
      ctx.rooms[row][col].flashAttack();
      return true;
    }
  }

  // ── Equipment effects: freeze / stun / execute ────────────────────────────────
  if (eqStats) {
    if (eqStats.freezeChance && !target.isFrozen && !target.isMagicImmune
        && now >= target.magicImmuneUntil && Math.random() < eqStats.freezeChance) {
      target.applyFreeze(800);
    }
    if (eqStats.stunBonus && target.isStunned) {
      target.applyStun(eqStats.stunBonus);
    }
    if (eqStats.executeChance && target.hp > 0 && target.hp < target.maxHp * 0.15
        && !target.def.isBoss && Math.random() < eqStats.executeChance) {
      target.takeDamage(target.hp);
      data.lastAttackTime = now;
      ctx.rooms[row][col].flashAttack();
      _showAttackLine(ctx.scene, roomX, cellCenterY, target.x, target.y);
      return true;
    }
  }

  // ── Apply final damage ────────────────────────────────────────────────────────
  const finalDmg = Math.round(dmg);
  target.takeDamage(finalDmg);
  data.lastAttackTime = now;
  ctx.rooms[row][col].flashAttack();
  _showAttackLine(ctx.scene, roomX, cellCenterY, target.x, target.y);
  if (finalDmg >= 10) {
    const dmgCol = finalDmg >= 500 ? '#ffee44' : finalDmg >= 200 ? '#ffaa44' : '#ff7777';
    _showFloatText(ctx.scene, target.x, target.y - 20, `-${finalDmg}`, dmgCol);
  }

  // ── CHAIN_LIGHTNING: chain to 3 nearby at 40% ────────────────────────────────
  if (mDef?.passive === 'CHAIN_LIGHTNING') {
    ctx.triggerChainLightning(target, Math.round(dmg * 0.4), 3);
  }

  // ── CONSTRICT: 25% chance immobilize 3s + 15dmg/s DoT ───────────────────────
  if (mDef?.passive === 'CONSTRICT' && !target.isUnstoppable && Math.random() < 0.25 + procB) {
    target.applyRoot(3000);
    target.applyBurn(now);
    const ct = ctx.scene.add.text(target.x, target.y - 22, '🐍 속박!', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#44cc00',
    }).setOrigin(0.5).setDepth(55);
    ctx.scene.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
    logger.debug('[CONSTRICT] 3s root + DoT applied');
  }

  // ── VENOM_BURST: on hit apply poison stack, burst at 5 stacks ────────────────
  if (mDef?.passive === 'VENOM_BURST') {
    target.addVenomStack();
  }

  // ── CHARM_GAZE: 25% chance to freeze/mesmerize target for 1.5s ───────────────
  if (mDef?.passive === 'CHARM_GAZE'
      && !target.isFrozen && !target.isMagicImmune
      && now >= target.magicImmuneUntil
      && Math.random() < 0.25 + procB) {
    target.applyFreeze(1500);
    const ct = ctx.scene.add.text(target.x, target.y - 22, '💫 매혹!', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ff66cc',
    }).setOrigin(0.5).setDepth(55);
    ctx.scene.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
  }

  // ── DEATH_RATTLE: every 30s burst 200 dmg to closest invader ─────────────────
  if (mDef?.passive === 'DEATH_RATTLE') {
    if (now - (data.deathRattleLastTime ?? 0) >= 30000) {
      data.deathRattleLastTime = now;
      const closest = ctx.activeInvaders
        .filter(i => i.active && !i.isDead)
        .sort((a, b) => {
          const da = Math.hypot(a.x - roomX, a.y - cellCenterY);
          const db = Math.hypot(b.x - roomX, b.y - cellCenterY);
          return da - db;
        })[0];
      if (closest) {
        closest.takeDamage(200);
        const ct = ctx.scene.add.text(closest.x, closest.y - 22, '💀 죽음의 울림!', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#cc0000',
        }).setOrigin(0.5).setDepth(55);
        ctx.scene.tweens.add({ targets: ct, y: ct.y - 28, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
        logger.debug('[DEATH_RATTLE] 200 burst dmg to closest invader');
      }
    }
  }

  // ── GOLD_KILL: +10g on every kill ─────────────────────────────────────────────
  if (mDef?.passive === 'GOLD_KILL' && target.hp <= 0) {
    ctx.gold += 10;
    ctx.setGoldRegistry(ctx.gold);
    _showGoldFloat(ctx.scene, '+10', target.x, target.y - 18);
  }

  // ── QUAKE_STUN: every 5th hit stuns all invaders 1.5s ────────────────────────
  if (mDef?.passive === 'QUAKE_STUN') {
    data.whirlwindHitCount = (data.whirlwindHitCount ?? 0) + 1;
    if (data.whirlwindHitCount % 5 === 0) {
      ctx.activeInvaders.forEach(i => {
        if (i.active && !i.isUnstoppable) i.applyStun(1500);
      });
      const g = ctx.scene.add.graphics().setDepth(55);
      g.fillStyle(0x886600, 0.3);
      g.fillRect(0, GRID_Y, CANVAS_WIDTH, GRID_ROWS * ctx.effectiveCellSize);
      ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
    }
  }

  // ── Dragon's Lair Lv3: 10% Dragon's Roar on any kill ─────────────────────────
  if (data.type === 'dragons_lair' && data.level >= 3 && Math.random() < 0.10) {
    _triggerDragonRoar(ctx.scene, roomX, cellCenterY, ctx.activeInvaders);
  }

  return false;
}
