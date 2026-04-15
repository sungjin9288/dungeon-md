/**
 * Boss behavior functions extracted from DungeonScene.
 *
 * Each function receives a BossContext that provides access to Phaser scene
 * methods and game state, plus the target Invader.
 */
import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { Room } from '../objects/Room';
import type { RoomData } from '../data/rooms';
import type { InvaderType } from '../data/invaders';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_X, GRID_Y,
  INVADER_WAYPOINTS,
} from '../constants/layout';
import { logger } from '../utils/logger';
import { BossHud } from './BossHud';

// ─── BossContext ─────────────────────────────────────────────────────────────

export interface BossContext {
  /** The Phaser scene instance (for add, tweens, time, cameras, events). */
  readonly scene: Phaser.Scene;

  /** Current active invaders list. */
  readonly activeInvaders: Invader[];

  /** 2D room grid (visual Room objects). */
  readonly rooms: Room[][];

  /** 2D room data grid. */
  readonly roomGrid: (RoomData | null)[][];

  /** Dynamic grid dimensions. */
  readonly effectiveCols: number;
  readonly effectiveCellSize: number;

  /** Battle speed multiplier (1 or 2). Needed for time-based windows. */
  readonly speedMult: number;

  /** Invader movement path. */
  readonly invaderPath: Phaser.Curves.Path;

  // ── Boss HP bar ──────────────────────────────────────────────────────────

  /**
   * Shared boss HP bar instance owned by the scene. BossBehaviors only calls
   * `build()` here — `update()` is driven from the scene's per-frame loop so
   * a single update path stays in sync with `activeInvaders`.
   */
  readonly bossHud: BossHud;

  // ── Delegated methods ────────────────────────────────────────────────────

  showFloatText(x: number, y: number, text: string, color: string): void;
  spawnInvader(type: InvaderType): void;
  triggerChainLightning(source: Invader, chainDmg: number, maxChains: number): void;
}

// ─── scheduleNinjaInvisibilityCycle ─────────────────────────────────────────

export function scheduleNinjaInvisibilityCycle(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  const beVisible = () => {
    if (!inv.active) return;
    inv.isInvisible = false;
    scene.tweens.add({ targets: inv, alpha: 1, duration: 300 });
    scene.time.delayedCall(5000, () => {
      if (!inv.active) return;
      inv.isInvisible = true;
      scene.tweens.add({ targets: inv, alpha: 0.2, duration: 300 });
      scene.time.delayedCall(3000, beVisible);
    });
  };
  scene.time.delayedCall(3000, beVisible);
}

// ─── Fox Queen (Ch2) ────────────────────────────────────────────────────────

export function setupFoxQueenPhase(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  let phase = 1;
  const checkPhase = () => {
    if (!inv.active) return;
    const pct = inv.hp / inv.maxHp;
    if (pct <= 0.6 && phase === 1) {
      phase = 2;
      showFoxQueenPhaseTransition(ctx, inv, 2);
      scene.time.addEvent({
        delay: 15000, repeat: -1,
        callback: () => {
          if (!inv.active || phase < 2) return;
          foxQueenCharmMonster(ctx);
        },
      });
    }
    if (pct <= 0.3 && phase === 2) {
      phase = 3;
      showFoxQueenPhaseTransition(ctx, inv, 3);
      scene.time.addEvent({
        delay: 20000, repeat: -1,
        callback: () => {
          if (!inv.active || phase < 3) return;
          for (let i = 0; i < 3; i++)
            scene.time.delayedCall(i * 500, () => ctx.spawnInvader('shadow_ninja'));
          const portal = scene.add.text(INVADER_WAYPOINTS[0].x, INVADER_WAYPOINTS[0].y, '🌀', {
            fontFamily: 'sans-serif', fontSize: '24px',
          }).setOrigin(0.5).setDepth(50);
          scene.tweens.add({ targets: portal, alpha: 0, duration: 1200, onComplete: () => portal.destroy() });
        },
      });
    }
    scene.time.delayedCall(500, checkPhase);
  };
  scene.time.delayedCall(500, checkPhase);
}

function showFoxQueenPhaseTransition(ctx: BossContext, inv: Invader, phase: number): void {
  const { scene } = ctx;
  scene.cameras.main.shake(400, 0.015);
  const colors = ['', '#ff9900', '#ff4400'];
  const t = scene.add.text(inv.x, inv.y - 30, `🦊 Phase ${phase}!`, {
    fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
    color: colors[phase - 1] ?? '#ff4400',
  }).setOrigin(0.5).setDepth(55);
  scene.tweens.add({ targets: t, y: inv.y - 65, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  logger.debug(`[FOX_QUEEN] entering phase ${phase} at ${Math.round((inv.hp / inv.maxHp) * 100)}% HP`);
}

function foxQueenCharmMonster(ctx: BossContext): void {
  const { scene, rooms, roomGrid, effectiveCols } = ctx;
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < effectiveCols; col++) {
      const data = roomGrid[row][col];
      if (data?.monsterSlot) {
        const warn = scene.add.text(
          rooms[row][col].x, rooms[row][col].y,
          '홀렸다!', { fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ff66bb' },
        ).setOrigin(0.5).setDepth(55);
        scene.tweens.add({ targets: warn, y: rooms[row][col].y - 30, alpha: 0, duration: 1200,
          onComplete: () => warn.destroy() });
        rooms[row][col].flashAttack();
        return;  // only one room charmed per trigger
      }
    }
}

// ─── Undying Knight (Ch3) ───────────────────────────────────────────────────

export function setupUndyingKnight(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  const checkRevive = () => {
    if (!inv.active) return;
    if (inv.hp <= 0 && !inv.revivedOnce && !inv.killedByMagic) {
      inv.revivedOnce = true;
      inv.hp = Math.round(inv.maxHp * 0.60);
      inv.setTint(0xaaaaff);
      const t = scene.add.text(inv.x, inv.y - 22, '불사 부활!', {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#88aaff',
      }).setOrigin(0.5).setDepth(56);
      scene.tweens.add({ targets: t, y: inv.y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
      logger.debug('[UNDYING_KNIGHT] revived at 60% HP');
    }
    scene.time.delayedCall(200, checkRevive);
  };
  scene.time.delayedCall(200, checkRevive);
}

// ─── Decoy Clone (Ch3) ─────────────────────────────────────────────────────

export function setupDecoyClone(ctx: BossContext, inv: Invader): void {
  const { scene, activeInvaders, invaderPath } = ctx;
  const spawnDecoy = () => {
    if (!inv.active || !inv.active) return;
    if (inv.hasDecoyAlive) { scene.time.delayedCall(15000, spawnDecoy); return; }
    const decoyDef = { ...inv.def, hp: 1, reward: 0, damage: 0 };
    const decoy = new Invader(scene, invaderPath, decoyDef);
    decoy.isDecoy = true;
    decoy.setAlpha(0.45);
    decoy.setTint(0xaaaaff);
    decoy.setDepth(38);
    activeInvaders.push(decoy);
    inv.hasDecoyAlive = true;
    scene.events.once(`decoyDied_${decoy.def.type}_${Date.now()}`, () => {
      inv.hasDecoyAlive = false;
    });
    logger.debug('[DECOY_CLONE] spawned decoy');
    scene.time.delayedCall(15000, spawnDecoy);
  };
  scene.time.delayedCall(15000, spawnDecoy);
}

// ─── Void Teleport (Ch3) ───────────────────────────────────────────────────

export function scheduleVoidTeleport(ctx: BossContext, inv: Invader): void {
  const { scene, effectiveCellSize } = ctx;
  scene.time.delayedCall(2000, () => {
    if (!inv.active) return;
    const cs = effectiveCellSize;
    const finalRowY = GRID_Y + (GRID_ROWS - 1) * cs + cs / 2;
    const targetX   = GRID_X + cs / 2;
    const flash = scene.add.graphics().setDepth(60);
    flash.fillStyle(0x220044, 0.9);
    flash.fillCircle(inv.x, inv.y, 28);
    scene.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 400,
      onComplete: () => flash.destroy() });
    inv.setPosition(targetX, finalRowY);
    inv.setAlpha(0);
    scene.tweens.add({ targets: inv, alpha: 1, duration: 300 });
    const t = scene.add.text(targetX, finalRowY - 22, '공허 이동!', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#cc44ff',
    }).setOrigin(0.5).setDepth(56);
    scene.tweens.add({ targets: t, y: finalRowY - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    logger.debug('[VOID_TELEPORT] teleported to final row');
  });
}

// ─── Dragon King Phase (Ch3) ───────────────────────────────────────────────

export function setupDragonKingPhase(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  buildDragonKingHpBar(ctx, inv.maxHp);
  let phase = 1;
  const checkPhase = () => {
    if (!inv.active) return;
    const pct = inv.hp / inv.maxHp;
    if (pct <= 0.66 && phase === 1) {
      phase = 2;
      inv.isFireImmune = true;
      inv.applySpeedBoost(55 / inv.def.speed, 9999999);
      showDragonPhaseTransition(ctx, inv, 2, '🐲 불꽃 형태! 화염 면역!');
      logger.debug('[DRAGON_KING] phase 2 — fire immune, speed 55');
    }
    if (pct <= 0.33 && phase === 2) {
      phase = 3;
      inv.dragonPhase = 3;
      showDragonPhaseTransition(ctx, inv, 3, '🐲 해저 잠수! 함정만 통함!');
      inv.applySubmerge(6000);
      logger.debug('[DRAGON_KING] phase 3 — submerge loop begins');
    }
    scene.time.delayedCall(400, checkPhase);
  };
  scene.time.delayedCall(400, checkPhase);
}

function buildDragonKingHpBar(ctx: BossContext, maxHp: number): void {
  ctx.bossHud.build(maxHp, {
    label:      '🐲 용왕',
    bgColor:    0x001430,
    labelColor: '#44aaff',
  });
}

function showDragonPhaseTransition(ctx: BossContext, _inv: Invader, phase: number, msg: string): void {
  const { scene } = ctx;
  scene.cameras.main.shake(400, 0.02);
  scene.cameras.main.flash(300, 0, 100, 180, false);
  const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, msg, {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
    color: phase === 2 ? '#ff8844' : '#44aaff',
    backgroundColor: '#001430', padding: { x: 12, y: 6 },
  }).setOrigin(0.5).setDepth(260).setAlpha(0);
  scene.tweens.add({
    targets: t, alpha: 1, duration: 300,
    onComplete: () => {
      scene.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1500, onComplete: () => t.destroy() });
    },
  });
  logger.debug(`[DRAGON_KING] phase transition → ${phase}: "${msg}"`);
}

// ─── Void Stealth Elite (Ch4) ──────────────────────────────────────────────

export function setupVoidStealthElite(ctx: BossContext, inv: Invader): void {
  const { scene, effectiveCellSize } = ctx;
  scene.time.delayedCall(2000, () => {
    if (!inv.active) return;
    const flash = scene.add.graphics().setDepth(60);
    flash.fillStyle(0x440066, 0.85);
    flash.fillCircle(inv.x, inv.y, 22);
    scene.tweens.add({ targets: flash, scaleX: 2, scaleY: 2, alpha: 0, duration: 350, onComplete: () => flash.destroy() });

    const cs = effectiveCellSize;
    inv.setPosition(GRID_X + cs / 2, GRID_Y + Math.floor(GRID_ROWS / 2) * cs + cs / 2);
    inv.isInvisible = true;
    inv.setAlpha(0.15);

    scene.time.delayedCall(2000, () => {
      if (!inv.active) return;
      inv.isInvisible = false;
      scene.tweens.add({ targets: inv, alpha: 1, duration: 300 });
    });
    logger.debug('[VOID_STEALTH_ELITE] teleported + stealth 2s');
  });
}

// ─── Death Emissary (Ch4) ──────────────────────────────────────────────────

export function setupDeathEmissary(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  buildBossHpBar(ctx, inv.maxHp);

  // Dark purple immunity aura
  const aura = scene.add.graphics().setDepth(inv.depth - 1);
  const drawAura = () => {
    if (!inv.active) { aura.destroy(); return; }
    aura.clear();
    const pulse = 0.5 + 0.3 * Math.sin(scene.time.now * 0.004);
    if (inv.isDamageImmune) {
      aura.lineStyle(3, 0x660088, pulse);
      aura.strokeCircle(inv.x, inv.y, inv.def.radius + 12);
      aura.fillStyle(0x220044, pulse * 0.3);
      aura.fillCircle(inv.x, inv.y, inv.def.radius + 12);
    } else {
      aura.lineStyle(3, 0xff0000, 0.9);
      aura.strokeCircle(inv.x, inv.y, inv.def.radius + 12);
    }
    scene.time.delayedCall(60, drawAura);
  };
  drawAura();

  let emissaryPhase = 1;

  const checkPhase = () => {
    if (!inv.active) return;
    const pct = inv.hp / inv.maxHp;

    if (pct <= 0.66 && emissaryPhase === 1) {
      emissaryPhase = 2;
      logger.debug('[DEATH_EMISSARY] phase 2 — faster ghost adds (12s)');
      showBossPhaseText(ctx, inv, 2, '💀 2단계! 망령 가속!', 0x8800cc);
    }
    if (pct <= 0.33 && emissaryPhase === 2) {
      emissaryPhase = 3;
      logger.debug('[DEATH_EMISSARY] phase 3 — JUDGMENT every 25s');
      showBossPhaseText(ctx, inv, 3, '💀 3단계! 심판의 심판!', 0xcc0000);
      scene.time.addEvent({
        delay: 25000, repeat: -1,
        callback: () => {
          if (!inv.active || emissaryPhase < 3) return;
          triggerJudgment(ctx);
        },
      });
    }
    scene.time.delayedCall(300, checkPhase);
  };
  checkPhase();

  // Ghost adds every 20s (12s in phase 2)
  const spawnGhostAdd = () => {
    if (!inv.active) return;
    const delay = emissaryPhase >= 2 ? 12000 : 20000;
    ctx.spawnInvader('ghost_add');
    const t = scene.add.text(INVADER_WAYPOINTS[0].x, INVADER_WAYPOINTS[0].y, '👻', {
      fontFamily: 'sans-serif', fontSize: '20px',
    }).setOrigin(0.5).setDepth(50);
    scene.tweens.add({ targets: t, alpha: 0, y: t.y - 30, duration: 800, onComplete: () => t.destroy() });
    scene.time.delayedCall(delay, spawnGhostAdd);
  };
  scene.time.delayedCall(20000, spawnGhostAdd);

  // Immunity / stun-to-damage hint
  const hintLoop = () => {
    if (!inv.active) return;
    const msg = inv.isDamageImmune
      ? '면역 — 기절시켜야 피해!'
      : '⚡ 피해 가능!';
    const color = inv.isDamageImmune ? '#cc44ff' : '#ff4444';
    const t = scene.add.text(inv.x, inv.y - inv.def.radius - 18, msg, {
      fontFamily: 'sans-serif', fontSize: '9px', color,
    }).setOrigin(0.5).setDepth(70);
    scene.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
    scene.time.delayedCall(1500, hintLoop);
  };
  scene.time.delayedCall(500, hintLoop);

  logger.debug('[DEATH_EMISSARY] setup complete — isDamageImmune=true, ghost adds every 20s');
}

function triggerJudgment(ctx: BossContext): void {
  const { scene, roomGrid, rooms, effectiveCols } = ctx;
  const candidates: Array<[number, number]> = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < effectiveCols; c++)
      if (roomGrid[r][c]) candidates.push([r, c]);
  if (!candidates.length) return;
  const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
  const d = roomGrid[r][c]!;
  const dmg = Math.round(d.maxRoomHp * 0.5);
  d.roomHp = Math.max(0, d.roomHp - dmg);
  const rm = rooms[r][c];
  scene.cameras.main.shake(500, 0.025);
  const t = scene.add.text(rm.x, rm.y, '☠️ 심판!', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ff0000',
  }).setOrigin(0.5).setDepth(70);
  scene.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  logger.debug(`[JUDGMENT] room [${r},${c}] −50% HP (−${dmg})`);
}

// ─── showBossPhaseText (shared) ────────────────────────────────────────────

export function showBossPhaseText(ctx: BossContext, inv: Invader, phase: number, msg: string, colorHex: number): void {
  const { scene } = ctx;
  const cs = `#${colorHex.toString(16).padStart(6, '0')}`;
  const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, msg, {
    fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
    color: cs, backgroundColor: '#000000cc', padding: { x: 14, y: 8 },
  }).setOrigin(0.5).setDepth(265).setAlpha(0);
  scene.tweens.add({
    targets: t, alpha: 1, duration: 300,
    onComplete: () => {
      scene.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1800, onComplete: () => t.destroy() });
    },
  });
  logger.debug(`[BOSS_PHASE_${phase}] "${msg}"`);
  const ring = scene.add.graphics().setDepth(inv.depth + 2);
  ring.lineStyle(4, colorHex, 1);
  ring.strokeCircle(inv.x, inv.y, inv.def.radius + 6);
  scene.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
}

// ─── Shared boss HP bar helper ─────────────────────────────────────────────

export function buildBossHpBar(ctx: BossContext, maxHp: number): void {
  ctx.bossHud.build(maxHp);
}
