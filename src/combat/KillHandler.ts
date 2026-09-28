// ─── Kill Handler ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene.handleInvaderKilled(). Owns all side-effects
// triggered the moment an Invader is removed from the field: gold rewards,
// kill combos, achievement tracking, passive procs (DIVINE_PROPHECY,
// CHAIN_CURSE, WAR_HEX, SWARM, …), XP, and material drops.
//
// The scene retains ownership of mutable state; this module receives it
// through the KillHandlerContext getter/setter pattern used by other combat
// subsystems (BossContext, RoomMechanicsContext, etc.).

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { InvaderDef, InvaderType } from '../data/invaders';
import type { RoomData } from '../data/rooms';
import type { EquipmentStats } from '../data/barracks';
import { rollMaterialDrop, MATERIAL_DEFS } from '../data/fusion';
import { resolveMonsterDef } from '../data/monsters';
import { loadGameState, saveGameState } from '../data/wisdom';
import { applyInvaderKillProgress } from '../data/progressionTransactions';
import { CANVAS_WIDTH, GRID_Y, GRID_ROWS } from '../constants/layout';
import { audioManager } from '../audio/AudioManager';
import {
  showGoldFloat,
  showFloatText,
} from './VisualEffects';
import {
  playBossKillReaction,
  playKillComboEdgeFlash,
  spawnDeathParticles,
} from './ImpactVfx';
import { logger } from '../utils/logger';
import { remainingInvaderCount } from './waveSpawnAccounting';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface KillHandlerContext {
  readonly scene:          Phaser.Scene;
  readonly equipmentMap:   Map<string, EquipmentStats>;
  readonly materialsEarnedThisRun: Record<string, number>;
  readonly killCounterText:  Phaser.GameObjects.Text | undefined;
  readonly waveInvaderTotal: number;
  readonly roomGrid:         (RoomData | null)[][];
  /** Battle speed setting; the boss slow-mo returns the clock and tweens to it. */
  readonly speedMult:        number;

  get gold(): number;          set gold(v: number);
  get killsThisRun(): number;  set killsThisRun(v: number);
  get killsThisWave(): number; set killsThisWave(v: number);
  get goldEarnedThisRun(): number; set goldEarnedThisRun(v: number);
  get killComboCount(): number; set killComboCount(v: number);
  get lastKillTime(): number;   set lastKillTime(v: number);
  get activeInvaders(): Invader[];  set activeInvaders(v: Invader[]);
  get dungeonHp(): number;     set dungeonHp(v: number);
  get hexedInvader(): Invader | null; set hexedInvader(v: Invader | null);
  get recentlyDeadInvaders(): InvaderDef[]; set recentlyDeadInvaders(v: InvaderDef[]);

  readonly wave:          number;
  readonly maxWave:       number;
  readonly isEndless:     boolean;
  readonly waveActive:    boolean;
  readonly maxHp:         number;
  readonly stageChapter:  number;
  readonly effectiveCols: number;

  setGoldRegistry(v: number): void;
  setHpRegistry(v: number): void;
  setRemainingInvadersRegistry(n: number): void;
  hasSynergy(id: string): boolean;
  spawnInvader(type: InvaderType): void;
  spawnCoinFlyEffect(x: number, y: number): void;
  checkAchievementsAndToast(gs: ReturnType<typeof loadGameState>): void;
  applyWarHexToHighestHP(): void;
  grantMonsterXp(amount: number): void;
  hasDivineTerritory(): boolean;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * Process all side-effects for a single invader kill.
 * Called by DungeonScene.handleInvaderKilled() via a thin wrapper.
 */
export function handleInvaderKilled(ctx: KillHandlerContext, inv: Invader): void {
  const { scene, equipmentMap } = ctx;

  // Boss kills get a dramatic "slow-mo → white flash → shake" reaction.
  if (inv.def.isBoss) playBossKillReaction(scene, ctx.speedMult);

  // ── Gold reward ─────────────────────────────────────────────────────────────
  let goldReward = inv.def.reward;
  for (const eq of equipmentMap.values()) {
    if (eq.goldMult) goldReward = Math.round(goldReward * (1 + eq.goldMult));
  }
  ctx.gold += goldReward;
  ctx.setGoldRegistry(ctx.gold);
  showGoldFloat(scene, `+${goldReward} 💰`, inv.x, inv.y - 20);
  ctx.spawnCoinFlyEffect(inv.x, inv.y - 10);
  audioManager.playSfx('death');

  // ── Per-wave stats ──────────────────────────────────────────────────────────
  ctx.killsThisRun++;
  ctx.killsThisWave++;
  ctx.goldEarnedThisRun += goldReward;
  ctx.killCounterText?.setText(`💀 ${ctx.killsThisWave} / ${ctx.waveInvaderTotal || '?'}`);
  ctx.setRemainingInvadersRegistry(remainingInvaderCount(ctx.activeInvaders, inv));

  // ── Kill combo ──────────────────────────────────────────────────────────────
  const now = scene.time.now;
  if (now - ctx.lastKillTime < 2500) {
    ctx.killComboCount++;
    if (ctx.killComboCount >= 3) {
      const comboText = ctx.killComboCount >= 7 ? `🔥 ${ctx.killComboCount}연속!! UNSTOPPABLE`
                      : ctx.killComboCount >= 5 ? `🔥 ${ctx.killComboCount}연속! 맹공격`
                      : `🔥 ${ctx.killComboCount}연속!`;
      showFloatText(scene, inv.x, inv.y - 40, comboText, '#ff8800');
      playKillComboEdgeFlash(scene, ctx.killComboCount);
    }
  } else {
    ctx.killComboCount = 1;
  }
  ctx.lastKillTime = now;

  spawnDeathParticles(scene, inv.x, inv.y);

  // ── Persistence & achievements ──────────────────────────────────────────────
  const progressResult = applyInvaderKillProgress(loadGameState(), inv.def.type, goldReward);
  saveGameState(progressResult.state);
  ctx.checkAchievementsAndToast(progressResult.state);

  // ── Boss split (knight → 4 peasants) ───────────────────────────────────────
  if (inv.def.type === 'knight' && ctx.wave === ctx.maxWave && !ctx.isEndless && !inv.def.isMiniBoss) {
    for (let i = 0; i < 4; i++) {
      scene.time.delayedCall(i * 200, () => ctx.spawnInvader('peasant'));
    }
    ctx.gold += 200;
    ctx.setGoldRegistry(ctx.gold);
    showGoldFloat(scene, '+200', CANVAS_WIDTH / 2, GRID_Y + 20);
    logger.debug('[BOSS SPLIT] spawning 4 peasants');
  }

  ctx.activeInvaders = ctx.activeInvaders.filter(i => i !== inv);

  // ── SWARM: split into 3 swarm_spawn on death ────────────────────────────────
  if (inv.def.behavior === 'SWARM' && inv.def.type !== 'swarm_spawn') {
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 120, () => {
        if (!ctx.waveActive) return;
        ctx.spawnInvader('swarm_spawn');
      });
    }
  }

  // ── DIVINE_PROPHECY: 5% chance on kill → heal 5% dungeonHp ─────────────────
  if (Math.random() < 0.05) {
    const hasProphecy = ctx.roomGrid.flat().some(
      d => resolveMonsterDef(d?.monsterSlot ?? undefined)?.passive === 'DIVINE_PROPHECY',
    );
    if (hasProphecy) {
      const heal = Math.ceil(ctx.maxHp * 0.05);
      ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + heal);
      ctx.setHpRegistry(ctx.dungeonHp);
      showFloatText(scene, CANVAS_WIDTH / 2, 80, `👁️ +${heal} 신탁의 가호`, '#ffd700');
    }
  }

  // ── CHAIN_CURSE: on kill, chain 30 dmg to 3 nearest invaders ───────────────
  if (ctx.hasSynergy('CHAIN_CURSE')) {
    const nearby = ctx.activeInvaders
      .filter(o => o.active && o !== inv)
      .sort((a, b) => Math.hypot(a.x - inv.x, a.y - inv.y) - Math.hypot(b.x - inv.x, b.y - inv.y))
      .slice(0, 3);
    nearby.forEach((o, i) => {
      scene.time.delayedCall(i * 80, () => {
        if (!o.active) return;
        o.takeDamage(30);
        const g = scene.add.graphics().setDepth(55);
        g.lineStyle(2, 0x4422ff, 0.9);
        g.lineBetween(inv.x, inv.y, o.x, o.y);
        scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
      });
    });
  }

  // ── Recently-dead tracking (HIGH_PRIEST resurrection) ──────────────────────
  ctx.recentlyDeadInvaders = [inv.def, ...ctx.recentlyDeadInvaders].slice(0, 3);

  // ── WAR_HEX transfer ────────────────────────────────────────────────────────
  if (ctx.hexedInvader === inv) {
    ctx.hexedInvader = null;
    ctx.applyWarHexToHighestHP();
  }

  // ── Spirit Altar kill count (Ch4+) ──────────────────────────────────────────
  if (ctx.stageChapter >= 4) {
    for (let ar = 0; ar < GRID_ROWS; ar++)
      for (let ac = 0; ac < ctx.effectiveCols; ac++) {
        const ad = ctx.roomGrid[ar][ac];
        if (ad?.type === 'spirit_altar') ad.altarKillCount++;
      }
  }

  // ── Dragon's Lair Lv2+: +100g on boss kill (Ch4+) ──────────────────────────
  if (ctx.stageChapter >= 4 && inv.def.isBoss) {
    for (const row of ctx.roomGrid)
      for (const d of row)
        if (d?.type === 'dragons_lair' && d.level >= 2) {
          ctx.gold += 100;
          ctx.setGoldRegistry(ctx.gold);
          showGoldFloat(scene, '+100 🐲', inv.x, inv.y - 30);
        }
  }

  // ── DIVINE_TERRITORY gold bonus (+20% per kill) ─────────────────────────────
  if (ctx.hasDivineTerritory()) {
    const bonus = Math.round(inv.def.reward * 0.2);
    if (bonus > 0) {
      ctx.gold += bonus;
      ctx.setGoldRegistry(ctx.gold);
    }
  }

  // ── Monster XP ──────────────────────────────────────────────────────────────
  ctx.grantMonsterXp(inv.def.isBoss ? 100 : 5);

  // ── Material drop ────────────────────────────────────────────────────────────
  if (!ctx.isEndless) {
    const matId = rollMaterialDrop(inv.def.type);
    if (matId) {
      ctx.materialsEarnedThisRun[matId] = (ctx.materialsEarnedThisRun[matId] ?? 0) + 1;
      const matDef = MATERIAL_DEFS[matId];
      logger.debug(`[MATERIAL DROP] ${matDef?.emoji ?? ''} ${matDef?.name ?? matId} ×1 (from ${inv.def.type})`);
    }
  }
}
