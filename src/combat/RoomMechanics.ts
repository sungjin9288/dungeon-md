/**
 * Room mechanic runner functions extracted from DungeonScene.
 *
 * Each function receives a RoomMechanicsContext that provides read/write
 * access to scene state, plus any per-mechanic local state structures.
 */
import { applyEquipmentBasicEffects } from './EquipmentAttacks';
import { equipmentAuraAttackMult } from '../data/equipmentAuras';
import { equipmentBonusDamage, equipmentMagicAttackMult } from '../data/equipmentCombat';
import type { EquipmentStats } from '../data/barracks';
import { equipmentAttackIntervalMult, equipmentBossDamageMult } from '../data/equipmentCombat';
import { comboMultiplier } from '../data/traps';
import type Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { Room } from '../objects/Room';
import type { RoomData } from '../data/rooms';
import {
  ROOM_DEFS,
  getRoomLevelDamageMult,
  getMedicineHealRate,
  getAltarKillsNeeded,
} from '../data/rooms';
import {
  resolveMonsterAttackCooldown,
  resolveMonsterDef,
  resolveMonsterTypeId,
} from '../data/monsters';
import { INVADER_DEFS } from '../data/invaders';
import type { DungeonSlot } from '../data/wisdom';
import {
  CANVAS_WIDTH,
  GRID_ROWS,
  GRID_X,
  GRID_Y,
} from '../constants/layout';
import { logger } from '../utils/logger';

// ─── RoomMechanicsContext ───────────────────────────────────────────────────

export interface RoomMechanicsContext {
  /** Per-trap-type mastery from the save (trapId → +0..+5). */
  /** monsterId → raising multiplier (level growth · 강타). */
  readonly guardianAtkMult?: ReadonlyMap<string, number>;
  /** Wave-event ATK multiplier (rally / ancient_blessing / …), same value CombatResolver applies. */
  readonly waveAtkMult?: number;
  /** Aggregate tribe-synergy ATK multiplier, same value CombatResolver applies. */
  readonly synergyAtkMult?: number;
  readonly synergyAttackIntervalMult?: number;
  readonly equipmentMap?: ReadonlyMap<string, EquipmentStats>;
  readonly equipmentAttackCounts?: Map<string, number>;
  readonly hasCelestialPierce?: boolean;
  readonly trapMastery?: Readonly<Record<string, number>>;
  /** The Phaser scene instance (for add, tweens, time, cameras). */
  readonly scene: Phaser.Scene;

  /** 2D room data grid. */
  readonly roomGrid: (RoomData | null)[][];

  /** 2D visual Room objects. */
  readonly rooms: Room[][];

  /** Current active invaders list. */
  readonly activeInvaders: Invader[];

  /** Dynamic grid dimensions. */
  readonly effectiveCols: number;
  readonly effectiveCellSize: number;

  /** Wave state. */
  readonly waveActive: boolean;

  /** Invader movement path (for ghost spawning). */
  readonly invaderPath: Phaser.Curves.Path;

  /** Chapter number (for armory gating). */
  readonly stageChapter: number;

  // ── Player state accessors ────────────────────────────────────────────────

  gold: number;
  dungeonHp: number;
  readonly maxHp: number;

  /** Dungeon trap slots (wisdom system). */
  readonly dungeonTrapSlots: DungeonSlot[];

  /** Per-slot trap synergy multiplier map. */
  readonly slotTrapSynergyMult: Map<number, number>;

  /** 함정술사 decoration set trap-damage multiplier (1.0 / undefined = no bonus). */
  readonly decorationTrapMult?: number;

  /** Extra monster attack cooldowns. */
  readonly extraMonsterCooldowns: Map<string, number>;

  /** TAUNTING_ROAR damage boost deadline. */
  readonly tauntBoostActiveUntil: number;

  /** Battle speed multiplier (1 or 2). */
  readonly speedMult: number;

  // ── Local state maps (owned by DungeonScene, passed by reference) ────────

  readonly pounceReadyMap: Map<string, { ready: boolean; cooldownUntil: number }>;

  // ── Tick timers (mutable, written back through context) ──────────────────

  medicineHealTick: number;
  medicineGlobalPulseLast: number;
  poisonDamageTick: number;
  entrancingVeilApplied: boolean;

  // ── Delegated methods / callbacks ────────────────────────────────────────

  setGoldRegistry(gold: number): void;
  showGoldFloat(text: string, x: number, y: number): void;
  showTigersPounce(rx: number, ry: number, tx: number, ty: number): void;
  showHealEffect(healer: Invader, target: Invader, amount: number): void;
  showSoulHarvestExec(x: number, y: number): void;
  showFloatText(x: number, y: number, text: string, color: string): void;
  flashRoom(row: number, col: number): void;
  healRoomHp(row: number, col: number, amount: number): void;
  damageRoomHp(row: number, col: number, amount: number): void;
  hasDivineTerritory(): boolean;
  pushInvader(inv: Invader): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Extracted functions
// ═══════════════════════════════════════════════════════════════════════════

// ─── runTigersPounce ────────────────────────────────────────────────────────

export function runTigersPounce(ctx: RoomMechanicsContext, now: number): void {
  if (!ctx.waveActive) return;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const data = ctx.roomGrid[row][col];
      if (!data || resolveMonsterTypeId(data.monsterSlot ?? '') !== 'white_tiger') continue;
      const key = `${row},${col}`;
      let state = ctx.pounceReadyMap.get(key);
      if (!state) { state = { ready: true, cooldownUntil: 0 }; ctx.pounceReadyMap.set(key, state); }
      if (!state.ready && now < state.cooldownUntil) continue;
      state.ready = true;
      if (!state.ready) continue;

      // Find furthest-advanced invader (highest pathTween.progress)
      let target: Invader | null = null;
      let bestProgress = 0;
      for (const inv of ctx.activeInvaders) {
        if (!inv.active || inv.isInvisible) continue;
        const prog = (inv.pathTween as Phaser.Tweens.Tween).progress ?? 0;
        if (prog > 0.6 && prog > bestProgress) { bestProgress = prog; target = inv; }
      }
      if (!target) continue;

      // Trigger pounce
      const rdef = resolveMonsterDef(data.monsterSlot ?? undefined);
      if (!rdef) continue;
      const dmg  = Math.round(rdef.baseDamage * 3 * getRoomLevelDamageMult(data.level));
      target.takeDamage(dmg);
      state.ready = false;
      state.cooldownUntil = now + 5000 / ctx.speedMult;

      const rx = ctx.rooms[row][col].x;
      const cs = ctx.effectiveCellSize;
      const ry = GRID_Y + row * cs + cs / 2;
      ctx.showTigersPounce(rx, ry, target.x, target.y);
    }
  }
}

// ─── runMercenaryAuras ──────────────────────────────────────────────────────

/** Captain aura speed-up applied to nearby invaders. */
export const MERCENARY_AURA_BOOST = 1.3;

export function runMercenaryAuras(ctx: RoomMechanicsContext, _now: number): void {
  if (!ctx.waveActive) return;
  const captains = ctx.activeInvaders.filter(
    i => i.active && i.def.type === 'mercenary_captain',
  );
  if (captains.length === 0) return;

  // The aura is a speed *modifier*, not a raw timeScale write: setting the tween
  // directly used to overwrite an active slow (and then reset it to 1 on leaving
  // the aura, losing the slow for good). boostMult composes with slowMult instead.
  ctx.activeInvaders.forEach(inv => {
    if (!inv.active || inv.def.type === 'mercenary_captain') return;
    const nearCaptain = captains.some(c => Math.hypot(c.x - inv.x, c.y - inv.y) < 200);
    const boost = nearCaptain ? MERCENARY_AURA_BOOST : 1;
    if (inv.boostMult === boost) return;
    inv.boostMult = boost;
    inv.syncPathSpeed();
  });
}

// ─── runHealers ─────────────────────────────────────────────────────────────

export function runHealers(ctx: RoomMechanicsContext, now: number): void {
  const HEAL_INTERVAL = 2000;
  const HEAL_AMOUNT   = 20;
  const HEAL_RANGE    = 150;

  for (const healer of ctx.activeInvaders) {
    if (!healer.active || healer.def.type !== 'soldier') continue;
    if (now - healer.lastHealTime < HEAL_INTERVAL) continue;

    // Find lowest HP% invader within 150px (excluding self)
    let target: typeof healer | null = null;
    let lowestPct = 1;
    for (const inv of ctx.activeInvaders) {
      if (!inv.active || inv === healer) continue;
      const dist = Math.hypot(inv.x - healer.x, inv.y - healer.y);
      if (dist > HEAL_RANGE) continue;
      const pct = inv.hp / inv.maxHp;
      if (pct < lowestPct && inv.hp < inv.maxHp) { lowestPct = pct; target = inv; }
    }

    healer.lastHealTime = now;
    if (!target) continue;

    target.receiveHeal(HEAL_AMOUNT);
    ctx.showHealEffect(healer, target, HEAL_AMOUNT);
    logger.debug(`[HEAL] target hp=${target.hp}/${target.maxHp} (${Math.round(lowestPct * 100)}%) +${HEAL_AMOUNT}`);
  }
}

// ─── runSoulHarvest ─────────────────────────────────────────────────────────

export function runSoulHarvest(ctx: RoomMechanicsContext, now: number): void {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const data = ctx.roomGrid[row][col];
      if (!data || resolveMonsterTypeId(data.monsterSlot ?? '') !== 'death_messenger') continue;
      if (now - data.soulHarvestLastTime < 800) continue;

      // Check all invaders in row for <=15% HP
      const cs = ctx.effectiveCellSize;
      const cellCenterY = GRID_Y + row * cs + cs / 2;
      for (const inv of ctx.activeInvaders) {
        if (!inv.active || inv.isDecoy) continue;
        if (Math.abs(inv.y - cellCenterY) > cs * 1.5) continue;
        const pct = inv.hp / inv.maxHp;
        if (pct <= 0.15) {
          // Execute!
          inv.takeDamage(inv.hp, true);
          data.soulHarvestLastTime = now;
          ctx.gold += 5;
          ctx.setGoldRegistry(ctx.gold);
          ctx.showSoulHarvestExec(inv.x, inv.y);
          ctx.flashRoom(row, col);
          logger.debug(`[SOUL_HARVEST] executed ${inv.def.type} hp=${inv.hp}`);
          break;
        }
      }
    }
  }
}

// ─── runMedicineHallHeal ────────────────────────────────────────────────────

export function runMedicineHallHeal(ctx: RoomMechanicsContext, now: number): void {
  if (now - ctx.medicineHealTick < 1000) return;
  ctx.medicineHealTick = now;

  for (let mr = 0; mr < GRID_ROWS; mr++) {
    for (let mc = 0; mc < ctx.effectiveCols; mc++) {
      const md = ctx.roomGrid[mr][mc];
      if (!md || md.type !== 'medicine_hall') continue;
      const healRate = getMedicineHealRate(md.level);

      // Lv2+: self-heal
      if (md.level >= 2) ctx.healRoomHp(mr, mc, healRate);

      // Heal adjacent rooms
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        const nr = mr + dr, nc = mc + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= ctx.effectiveCols) continue;
        const nd = ctx.roomGrid[nr][nc];
        if (!nd) continue;
        ctx.healRoomHp(nr, nc, healRate);
      }

      // Lv3: global pulse every 15s
      if (md.level >= 3 && now - ctx.medicineGlobalPulseLast >= 15000 / ctx.speedMult) {
        ctx.medicineGlobalPulseLast = now;
        triggerMedicineGlobalPulse(ctx, healRate * 2);
      }
    }
  }
}

// ─── triggerMedicineGlobalPulse ─────────────────────────────────────────────

export function triggerMedicineGlobalPulse(ctx: RoomMechanicsContext, amount: number): void {
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < ctx.effectiveCols; c++)
      if (ctx.roomGrid[r][c]) ctx.healRoomHp(r, c, amount);

  const pulse = ctx.scene.add.graphics().setDepth(50);
  pulse.lineStyle(3, 0x44ff88, 0.8);
  pulse.strokeCircle(CANVAS_WIDTH / 2, GRID_Y + GRID_ROWS * ctx.effectiveCellSize / 2, 20);
  ctx.scene.tweens.add({ targets: pulse, scaleX: 20, scaleY: 20, alpha: 0, duration: 800,
    onComplete: () => pulse.destroy() });
  logger.debug(`[MEDICINE HALL] Lv3 global pulse +${amount} HP`);
}

// ─── runPoisonTrailDamage ───────────────────────────────────────────────────

export function runPoisonTrailDamage(ctx: RoomMechanicsContext, now: number): void {
  if (now - ctx.poisonDamageTick < 1000) return;
  ctx.poisonDamageTick = now;

  const cs = ctx.effectiveCellSize;
  for (const inv of ctx.activeInvaders) {
    if (!inv.active || inv.def.behavior !== 'POISON_TRAIL') continue;
    // Damage rooms near this invader (5 HP/s)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < ctx.effectiveCols; c++) {
        if (!ctx.roomGrid[r][c]) continue;
        const cx = GRID_X + c * cs + cs / 2;
        const cy = GRID_Y + r * cs + cs / 2;
        if (Math.hypot(inv.x - cx, inv.y - cy) < cs * 0.8) {
          const rd = ctx.roomGrid[r][c];
          if (rd && ctx.scene.time.now < (rd.immuneUntil ?? 0)) break; // fortress/shield active
          ctx.damageRoomHp(r, c, 5);
          // Green puddle beneath invader
          const puddle = ctx.scene.add.graphics().setDepth(inv.depth - 2);
          puddle.fillStyle(0x44ff44, 0.18);
          puddle.fillEllipse(inv.x, inv.y + inv.def.radius, 30, 14);
          ctx.scene.tweens.add({ targets: puddle, alpha: 0, duration: 600, onComplete: () => puddle.destroy() });
        }
      }
    }
  }
}

// ─── runEntrancingVeil ──────────────────────────────────────────────────────

export function runEntrancingVeil(ctx: RoomMechanicsContext): void {
  // Check if any room has celestial_dancer
  let hasDancer = false;
  for (const row of ctx.roomGrid)
    for (const d of row)
      if (resolveMonsterTypeId(d?.monsterSlot ?? '') === 'celestial_dancer') { hasDancer = true; break; }

  if (hasDancer && !ctx.entrancingVeilApplied) {
    ctx.entrancingVeilApplied = true;
    // Apply 0.88 speed multiplier to all active + future invaders
    for (const inv of ctx.activeInvaders)
      if (inv.active) inv.applySlow(0.88, 9999999);
    logger.debug('[ENTRANCING_VEIL] global 0.88x speed active');
  } else if (!hasDancer && ctx.entrancingVeilApplied) {
    ctx.entrancingVeilApplied = false;
  }
}

// ─── runSpiritAltar ─────────────────────────────────────────────────────────

export function runSpiritAltar(ctx: RoomMechanicsContext, _now: number): void {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const d = ctx.roomGrid[row][col];
      if (!d || d.type !== 'spirit_altar') continue;
      const needed = getAltarKillsNeeded(d.level);
      if (d.altarKillCount >= needed && d.altarGhostActiveUntil <= ctx.scene.time.now) {
        d.altarKillCount = 0;
        const ghostCount = d.level >= 2 ? 2 : 1;
        d.altarGhostActiveUntil = ctx.scene.time.now + 10000 / ctx.speedMult;
        for (let g = 0; g < ghostCount; g++) {
          ctx.scene.time.delayedCall(g * 400, () => spawnGhostWarrior(ctx, row, col));
        }
        logger.debug(`[SPIRIT_ALTAR Lv${d.level}] summoning ${ghostCount} ghost(s)`);
      }
    }
  }
}

// ─── spawnGhostWarrior ──────────────────────────────────────────────────────

export function spawnGhostWarrior(ctx: RoomMechanicsContext, altarRow: number, _altarCol: number): void {
  // Ghost patrols exit row — spawn a ghost_add at entrance and fast-track it
  const def = INVADER_DEFS['ghost_add'];
  const inv = new Invader(ctx.scene, ctx.invaderPath, def);
  inv.setDepth(42);
  inv.setAlpha(0.7);
  inv.setTint(0x8888ff);
  inv.isMagicImmune = true;   // physical-immune ghost
  ctx.pushInvader(inv);
  const label = ctx.scene.add.text(inv.x, inv.y - 18, '\ud83d\udc7b \uc18c\ud658!', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaaff',
  }).setOrigin(0.5).setDepth(56);
  ctx.scene.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  logger.debug(`[GHOST] spawned from altar row=${altarRow}`);
}

// ─── runLunarRhythm ─────────────────────────────────────────────────────────

export function runLunarRhythm(ctx: RoomMechanicsContext, now: number): void {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const d = ctx.roomGrid[row][col];
      if (!d || resolveMonsterTypeId(d.monsterSlot ?? '') !== 'moon_rabbit_sage') continue;
      if (now - d.lunarResetLastTime < 30000) continue;
      d.lunarResetLastTime = now;
      // Reset adjacent rooms (4 cardinal dirs)
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= ctx.effectiveCols) continue;
        const nd = ctx.roomGrid[nr][nc];
        if (nd) nd.lastAttackTime = 0;
      }
      const t = ctx.scene.add.text(ctx.rooms[row][col].x, ctx.rooms[row][col].y - 20, '\ud83c\udf19 \ucfe8\ud0c0\uc784 \ucd08\uae30\ud654!', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#ddeeff',
      }).setOrigin(0.5).setDepth(55);
      ctx.scene.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
      logger.debug(`[LUNAR_RHYTHM] adjacent cooldowns reset at [${row},${col}]`);
    }
  }
}

// ─── runExtraMonsterAttacks ─────────────────────────────────────────────────

export function runExtraMonsterAttacks(ctx: RoomMechanicsContext, now: number): void {
  const cs = ctx.effectiveCellSize;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < ctx.effectiveCols; col++) {
      const data = ctx.roomGrid[row][col];
      if (!data || !data.monsterSlots || data.monsterSlots.length <= 1) continue;

      const cellCenterY = GRID_Y + row * cs + cs / 2;
      // Process slots 1+ (slot 0 = primary, already handled by main runCombat)
      for (let si = 1; si < data.monsterSlots.length; si++) {
        const mId = data.monsterSlots[si];
        if (!mId) continue;
        const mDef = resolveMonsterDef(mId);
        if (!mDef) continue;

        const cdKey = `${row}_${col}_${si}`;
        const lastAt = ctx.extraMonsterCooldowns.get(cdKey) ?? 0;
        const eqStats = ctx.equipmentMap?.get(mId);
        const cd = resolveMonsterAttackCooldown(mId, data.type) * (ctx.synergyAttackIntervalMult ?? 1)
          * equipmentAttackIntervalMult(eqStats);
        if (now - lastAt < cd / ctx.speedMult) continue;

        // Find nearest target in row range
        const rowRange = cs * (mDef.range ?? 1) * 0.8;
        let target: Invader | null = null;
        let bestDist = Infinity;
        for (const inv of ctx.activeInvaders) {
          if (!inv.active || inv.isInvisible) continue;
          if (Math.abs(inv.y - cellCenterY) > rowRange) continue;
          const d = Math.hypot(inv.x - ctx.rooms[row][col].x, inv.y - cellCenterY);
          if (d < bestDist) { bestDist = d; target = inv; }
        }
        if (!target) continue;

        ctx.extraMonsterCooldowns.set(cdKey, now);
        let dmg = (mDef.baseDamage > 0 ? mDef.baseDamage : ROOM_DEFS[data.type].attackDamage)
          * getRoomLevelDamageMult(data.level)
          * data.roomTypeDmgMult
          * (ctx.guardianAtkMult?.get(mId) ?? 1)
          // CombatResolver applies these to the primary guardian; the extra
          // guardians in the same room fight the same wave under the same event
          // and stand in the same board's synergies.
          * (ctx.waveAtkMult ?? 1)
          * (ctx.synergyAtkMult ?? 1);
        if (now < ctx.tauntBoostActiveUntil) dmg *= 1.3;
        if (ctx.hasDivineTerritory()) dmg *= 1.2;
        dmg *= (1 + (eqStats?.atkMult ?? 0)) * equipmentMagicAttackMult(eqStats, mDef.type === 'magic');
        dmg *= equipmentAuraAttackMult(ctx.roomGrid, ctx.equipmentMap, row, col, mDef.tribe);
        const equipmentBaseDamage = dmg;
        dmg *= comboMultiplier(target.comboCount(now)) * equipmentBossDamageMult(eqStats, target.def);
        // Timed magic immunity is not bypassed by CELESTIAL_PIERCE (same as primary).
        if (mDef.type === 'magic' && now < target.magicImmuneUntil) continue;
        const pierceMagic = ctx.hasCelestialPierce && mDef.tribe === 'celestial';
        dmg = equipmentBonusDamage(dmg, target, now, mDef.type === 'magic' && !pierceMagic,
          data.type === 'trap' || data.type === 'trap_corridor', mDef.passive === 'GHOST_ARROW');
        if (dmg <= 0) continue;
        target.takeDamage(dmg);
        applyEquipmentBasicEffects(eqStats, mId, ctx.equipmentAttackCounts, mDef, data.type,
          equipmentBaseDamage, target, ctx.activeInvaders, now, { roomLevel: data.level, pierceMagic });
        ctx.flashRoom(row, col);
      }
    }
  }
}
