// ─── Battle Event Handlers ─────────────────────────────────────────────────────
// Side-effect handlers for Phaser events fired during combat:
//   invaderReachedEnd, mirrorReflect, invaderKilledRow, permafrostShatter.
// Plus two active-combat passive helpers:
//   applyWarHexToHighestHP, triggerTauntingRoar.
//
// Extracted from DungeonScene to keep event-response logic out of the scene.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { RoomData } from '../data/rooms';
import { COLORS } from '../constants/colors';
import { CANVAS_WIDTH, GRID_Y } from '../constants/layout';
import { showGoldFloat } from './VisualEffects';
import { playDungeonHpHitReaction } from './ImpactVfx';
import { remainingInvaderCount } from './waveSpawnAccounting';
import { logger } from '../utils/logger';
import { resolveMonsterTypeId } from '../data/monsters';
import { adventurerStealAmount, resolveWandererArrival } from '../data/visitors';
import { TRIBE_LABELS } from '../ui/BarracksShared';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface BattleEventContext {
  readonly scene:         Phaser.Scene;
  readonly wisdomBonuses: { monsterDmgMult: number };
  readonly roomGrid:      (RoomData | null)[][];
  readonly rooms:         { x: number; y: number }[][];
  readonly effectiveCols: number;
  readonly speedMult:     number;
  readonly maxHp:         number;

  get dungeonHp(): number;            set dungeonHp(v: number);
  get activeInvaders(): Invader[];    set activeInvaders(v: Invader[]);
  get gold(): number;                 set gold(v: number);
  get hexedInvader(): Invader | null; set hexedInvader(v: Invader | null);
  get tauntBoostActiveUntil(): number; set tauntBoostActiveUntil(v: number);
  get breakthruCount(): number;       set breakthruCount(v: number);
  /** 떠돌이 몬스터 포섭으로 얻은 부족 조각(전투 끝에 홈으로 정산). */
  readonly tribeShardsEarnedThisRun: Record<string, number>;
  get goldStolenThisRun(): number;    set goldStolenThisRun(v: number);

  hasSynergy(id: string): boolean;
  applyRoomSlotDamage(pct: number): void;
  triggerWaveFail(): void;
  updateLowHpVignette(): void;
  setHpRegistry(v: number): void;
  setGoldRegistry(v: number): void;
  setRemainingInvadersRegistry(n: number): void;
}

// ─── invaderReachedEnd ────────────────────────────────────────────────────────

export function handleInvaderReachedEnd(ctx: BattleEventContext, inv: Invader): void {
  if (inv.visitor === 'adventurer' || inv.visitor === 'wanderer') {
    // A visitor with a destination never touches the heart: it leaves (adventurer) or settles (wanderer).
    ctx.setRemainingInvadersRegistry(remainingInvaderCount(ctx.activeInvaders, inv));
    ctx.activeInvaders = ctx.activeInvaders.filter(i => i !== inv);
    if (inv.visitor === 'adventurer') handleAdventurerEscape(ctx, inv);
    else handleWandererArrival(ctx, inv);
    return;
  }
  const balanceDefMult = ctx.hasSynergy('BALANCE_DEF') ? 0.85 : 1;
  const actualDamage   = Math.round(inv.def.damage * ctx.wisdomBonuses.monsterDmgMult * balanceDefMult);

  ctx.dungeonHp = Math.max(0, ctx.dungeonHp - actualDamage);
  ctx.setHpRegistry(ctx.dungeonHp);
  ctx.setRemainingInvadersRegistry(remainingInvaderCount(ctx.activeInvaders, inv));
  ctx.activeInvaders = ctx.activeInvaders.filter(i => i !== inv);

  ctx.breakthruCount = ctx.breakthruCount + 1;
  ctx.applyRoomSlotDamage(0.05);

  playDungeonHpHitReaction(ctx.scene, actualDamage / ctx.maxHp);
  ctx.updateLowHpVignette();

  if (ctx.dungeonHp <= 0) ctx.triggerWaveFail();
}

/** 모험가가 입구로 빠져나감: 전리품 골드를 훔쳐 간다(던전 피해 없음). */
function handleAdventurerEscape(ctx: BattleEventContext, inv: Invader): void {
  const stolen = adventurerStealAmount(inv.def.reward, ctx.gold);
  if (stolen > 0) {
    ctx.gold -= stolen;
    ctx.goldStolenThisRun += stolen;
    ctx.setGoldRegistry(ctx.gold);
  }
  showGoldFloat(ctx.scene, stolen > 0 ? `도굴 −${stolen}` : '도굴 실패', inv.x, inv.y - 20);
}

/** 떠돌이 몬스터가 굴에 닿음: 포섭 판정 — 성공하면 그 부족 조각. */
function handleWandererArrival(ctx: BattleEventContext, inv: Invader): void {
  const recruit = resolveWandererArrival(inv.def.type, Math.random());
  if (recruit) {
    ctx.tribeShardsEarnedThisRun[recruit.tribe] = (ctx.tribeShardsEarnedThisRun[recruit.tribe] ?? 0) + recruit.shards;
  }
  const label = recruit ? `포섭! ${TRIBE_LABELS[recruit.tribe] ?? recruit.tribe} 조각 +${recruit.shards}` : '포섭 실패';
  showGoldFloat(ctx.scene, label, inv.x, inv.y - 20);
}

// ─── mirrorReflect ────────────────────────────────────────────────────────────

export function handleMirrorReflect(ctx: BattleEventContext, reflectDmg: number): void {
  ctx.dungeonHp = Math.max(0, ctx.dungeonHp - reflectDmg);
  ctx.setHpRegistry(ctx.dungeonHp);
  showGoldFloat(ctx.scene, `-${reflectDmg}`, CANVAS_WIDTH / 2, GRID_Y + 20);
  if (ctx.dungeonHp <= 0) ctx.triggerWaveFail();
}

// ─── invaderKilledRow (GILDED_KILL) ───────────────────────────────────────────

export function handleInvaderKilledRow(ctx: BattleEventContext, invRow: number): void {
  for (let col = 0; col < ctx.effectiveCols; col++) {
    const d = ctx.roomGrid[invRow][col];
    if (resolveMonsterTypeId(d?.monsterSlot ?? '') === 'gold_turtle') {
      ctx.gold += 2;
      ctx.setGoldRegistry(ctx.gold);
      showGoldFloat(ctx.scene, '+2', ctx.rooms[invRow][col].x, ctx.rooms[invRow][col].y - 20);
    }
  }
}

// ─── permafrostShatter ────────────────────────────────────────────────────────

export function handlePermafrostShatter(ctx: BattleEventContext, source: Invader): void {
  const SHATTER_RANGE = 80;
  const SHATTER_DMG   = 60;

  ctx.scene.cameras.main.shake(300, 0.02);
  let aoeHits = 0;

  ctx.activeInvaders.forEach(other => {
    if (other === source || !other.active) return;
    if (Math.hypot(other.x - source.x, other.y - source.y) <= SHATTER_RANGE) {
      other.takeDamage(SHATTER_DMG);
      aoeHits++;
      const bl = ctx.scene.add.graphics().setDepth(other.depth + 2);
      bl.fillStyle(0x88ddff, 0.7);
      bl.fillCircle(other.x, other.y, other.def.radius + 4);
      ctx.scene.tweens.add({ targets: bl, alpha: 0, duration: 200, onComplete: () => bl.destroy() });
    }
  });

  logger.debug(`[PERMAFROST SHATTER] aoeHits=${aoeHits} dmg=${SHATTER_DMG}`);
}

// ─── applyWarHexToHighestHP ───────────────────────────────────────────────────

export function applyWarHexToHighestHP(ctx: BattleEventContext): void {
  if (ctx.hexedInvader?.active) ctx.hexedInvader.removeHex();
  ctx.hexedInvader = null;

  let best: Invader | null = null;
  let bestHp = 0;
  for (const inv of ctx.activeInvaders) {
    if (inv.active && inv.hp > bestHp) { bestHp = inv.hp; best = inv; }
  }

  if (best) {
    best.applyHex();
    ctx.hexedInvader = best;
    const t = ctx.scene.add.text(best.x, best.y - best.def.radius - 16, '💀', {
      fontFamily: 'sans-serif', fontSize: '14px',
    }).setOrigin(0.5).setDepth(52);
    ctx.scene.tweens.add({
      targets: t, y: best.y - best.def.radius - 36, alpha: 0, duration: 800,
      onComplete: () => t.destroy(),
    });
    logger.debug(`[WAR_HEX] targeting hp=${bestHp} — dmg ×1.25`);
  }
}

// ─── triggerTauntingRoar ──────────────────────────────────────────────────────

export function triggerTauntingRoar(ctx: BattleEventContext, rx: number, ry: number): void {
  // Gold ring pulse from room
  const ring = ctx.scene.add.graphics().setDepth(50);
  ring.lineStyle(3, COLORS.TORCH_GOLD, 0.9);
  ring.strokeCircle(rx, ry, 12);
  ctx.scene.tweens.add({
    targets: ring, scaleX: 12, scaleY: 12, alpha: 0, duration: 600,
    onComplete: () => ring.destroy(),
  });

  // Stop all active invaders for 2000 ms; show "!" above each
  ctx.activeInvaders.forEach(inv => {
    if (!inv.active) return;
    inv.applyTaunt(2000);
    const excl = ctx.scene.add.text(inv.x, inv.y - inv.def.radius - 10, '!', {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: '#ff4444',
    }).setOrigin(0.5).setDepth(53);
    ctx.scene.tweens.add({
      targets: excl, y: inv.y - inv.def.radius - 28, alpha: 0, duration: 800,
      onComplete: () => excl.destroy(),
    });
  });

  // All rooms get +30% damage for 2000 ms
  ctx.tauntBoostActiveUntil = ctx.scene.time.now + 2000 / ctx.speedMult;

  logger.debug(
    `[TAUNTING_ROAR] ${ctx.activeInvaders.filter(i => i.active).length} invaders stopped, +30% dmg for 2s`,
  );
}
