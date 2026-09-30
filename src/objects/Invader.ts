import Phaser from 'phaser';
import type { InvaderDef } from '../data/invaders';
import { COMBO_WINDOW_MS, type AfflictionId, shouldAnnounceCombo } from '../data/traps';
import { logger } from '../utils/logger';
import { showFloatText } from '../combat/VisualEffects';
import {
  clearStunVisual,
  updateBurnVisual,
  drawRootGraphic,
  clearRootVisual,
  initShield,
  triggerShieldBreak,
  drawVenomStacks,
  triggerVenomBurst,
  startIdleBreathing,
  playHitReaction,
  cleanup,
  die as invaderDie,
  invaderPreUpdate,
} from './InvaderVisuals';
import { isMovementLocked, restingPathSpeed } from './movementLock';
import type { VisitorKind } from '../data/visitors';

// ─── Burn stack ───────────────────────────────────────────────────────────────

export interface BurnStack {
  startTime:    number;   // ms when applied
  lastTickTime: number;   // ms of last damage tick
  damage:       number;   // 10 per tick
  duration:     number;   // 3000ms total lifetime
}

// ─── Invader ──────────────────────────────────────────────────────────────────

// Movement-lock rules live in movementLock.ts (pure, tested).
export class Invader extends Phaser.GameObjects.PathFollower {
  public  hp:     number;
  public readonly maxHp: number;
  public readonly def:   InvaderDef;
  public isDead = false;

  // ── Stun (FIRST_STRIKE_STUN) ───────────────────────────────────────────────
  public  isStunned  = false;
  /** @internal */ stunOrbs:  Phaser.GameObjects.Graphics[] = [];
  /** @internal */ stunTimer?: Phaser.Time.TimerEvent;

  // ── Burn (EMBER_TRAIL) ─────────────────────────────────────────────────────
  public  burnStacks: BurnStack[] = [];
  /** Trap afflictions received recently: affliction → expiry (scene time). Feeds comboMultiplier. */
  public  recentAfflictions = new Map<AfflictionId, number>();
  /** @internal */ burnAura!:  Phaser.GameObjects.Graphics;
  /** @internal */ burnLabel!: Phaser.GameObjects.Text;

  // ── Root (PINNING_SHOT) ────────────────────────────────────────────────────
  public  isRooted     = false;
  /** @internal */ rootGraphic?: Phaser.GameObjects.Graphics;
  /** @internal */ rootTimer?:   Phaser.Time.TimerEvent;

  // ── Shield (FRONTAL_SHIELD — knight invaders) ──────────────────────────────
  public  hasShield           = false;
  public  shieldHitsRemaining = 0;
  /** @internal */ shieldGraphic?:     Phaser.GameObjects.Graphics;

  // ── Heal (soldier = 야전 치유사) ─────────────────────────────────────────
  public  lastHealTime = 0;   // ms; checked in DungeonScene.runHealers()

  // ── Freeze (PERMAFROST) ───────────────────────────────────────────────────
  public  isFrozen     = false;
  public  frozenUntil  = 0;
  /** @internal */ frozenGfx?:  Phaser.GameObjects.Graphics;
  /** @internal */ freezeTimer?: Phaser.Time.TimerEvent;

  // ── Chapter 2 status fields ────────────────────────────────────────────────
  public  isCharmed        = false;
  public  charmedUntil     = 0;
  public  isMagicImmune    = false;   // DIVINE_WARD (permanent)
  public  magicImmuneUntil = 0;       // MAGIC_IMMUNITY_WINDOW (timed, holy_paladin)
  public  hasSiegeShield   = false;   // SIEGE_SHIELD
  public  hasIronBody      = false;   // IRON_BODY
  public  isTrapImmune     = false;   // TRAP_IMMUNITY
  public  hasBerserkerRage = false;   // BERSERKER_RAGE
  public  isUnstoppable    = false;   // UNSTOPPABLE: immune to all CC
  /** Active slow factor (1 = none) — kept so an unrelated effect ending restores it. */
  /** Held by TAUNTING_ROAR / venom paralysis — pauses with no timer of their own. */
  public  isTaunted        = false;
  public  isParalyzed      = false;
  public  slowMult         = 1;
  /** Active rally/captain boost factor (1 = none). */
  public  boostMult        = 1;
  public  isSlowed         = false;
  /** @internal */ slowGfx?:        Phaser.GameObjects.Graphics;
  public  hexed            = false;   // WAR_HEX: +25% damage received
  public  damageMultiplier = 1;       // >1 = takes more dmg (hex); applied in takeDamage
  public  isInvisible      = false;   // shadow_ninja: single-target attacks miss
  /** @internal */ charmedGfx?:     Phaser.GameObjects.Graphics;
  /** @internal */ charmedTimer?:   Phaser.Time.TimerEvent;
  /** @internal */ berserkerAura?:  Phaser.GameObjects.Graphics;
  /** @internal */ berserkTriggered = false;
  /** @internal */ hexGfx?:         Phaser.GameObjects.Graphics;

  // ── Chapter 3 status fields ────────────────────────────────────────────────
  public  isFireImmune     = false;   // DRAGON_KING phase 2
  public  isSubmerged      = false;   // DRAGON_KING phase 3 (only traps hit)
  public  submergedUntil   = 0;       // timestamp when submerge ends
  /** @internal */ submergeTimer?:  Phaser.Time.TimerEvent;
  /** @internal */ submergeAura?:   Phaser.GameObjects.Graphics;
  public  venomStacks      = 0;       // VENOM_STACK counter (0-5)
  /** @internal */ venomGfx?:       Phaser.GameObjects.Graphics;
  /** @internal */ venomBurstTimer?: Phaser.Time.TimerEvent;
  public  isDecoy          = false;   // DECOY_CLONE: this is a fake clone
  public  realInvader?:    Invader;   // DECOY_CLONE: pointer to real one
  public  hasDecoyAlive    = false;   // DECOY_CLONE: real's clone is alive
  public  dragonPhase      = 1;       // DRAGON_KING: 1, 2, or 3
  public  isDamageImmune   = false;   // STUN_IMMUNE boss: only takes dmg when stunned
  public  ch4BossPhase     = 1;       // death_emissary: 1, 2, or 3
  public  ch5BossPhase     = 1;       // three_god_destroyer: 1–5
  public  ch6BossPhase     = 1;       // eternal_emperor: 1–4
  /** @internal */ bossAura?:       Phaser.GameObjects.Graphics;
  // ── Mirror Shield (MIRROR_SHIELD) ────────────────────────────────────────
  public  hasMirrorShield     = false;
  public  mirrorHitsRemaining = 0;
  public  mirrorGfx?:         Phaser.GameObjects.Graphics;
  // ── Shadow Realm (SHADOW_REALM) ──────────────────────────────────────────
  public  isInShadowRealm     = false;
  public  shadowRealmGfx?:    Phaser.GameObjects.Graphics;
  public  shadowRealmTimer?:  Phaser.Time.TimerEvent;
  public  killedByMagic    = false;   // UNDYING_KNIGHT: track killing blow type
  public  revivedOnce      = false;   // UNDYING_KNIGHT: can only revive once

  // ── Void phase (VOID_PHASE) ───────────────────────────────────────────────
  public  voidPhaseUntil = 0;   // ms timestamp; immune to traps until this time
  /** @internal */ voidAura?:      Phaser.GameObjects.Graphics;

  // ── Revive (REVIVE_ONCE) ──────────────────────────────────────────────────
  public  canRevive  = false;
  public  hasRevived = false;

  // ── HP bar ────────────────────────────────────────────────────────────────
  /** @internal */ hpBarBg:    Phaser.GameObjects.Graphics;
  /** @internal */ hpBarFill:  Phaser.GameObjects.Graphics;
  /** @internal */ bossLabel?: Phaser.GameObjects.Text;
  /** @internal */ crisisRing?: Phaser.GameObjects.Graphics;
  /** @internal */ crisisTween?: Phaser.Tweens.Tween;

  // ── Phase D: hit reaction + idle breathing ───────────────────────────────
  /** Base scale captured after setDisplaySize — anchor for scale tweens. */
  /** @internal */ baseScaleX = 1;
  /** @internal */ baseScaleY = 1;
  /** Active hit-flash tween, killed on new hit to prevent stacking. */
  /** @internal */ hitTween?:    Phaser.Tweens.Tween;
  /** 손님 종류(visitors.ts). 목표 방이 없으면 'raider' — 심장부로 간다. */
  visitor: VisitorKind = 'raider';
  /** 모험가·떠돌이 몬스터가 찾아가는 방의 홈 슬롯. */
  visitorTargetSlot: number | null = null;

  /** Active breathing tween. */
  /** @internal */ breathTween?: Phaser.Tweens.Tween;

  // ─────────────────────────────────────────────────────────────────────────

  constructor(scene: Phaser.Scene, path: Phaser.Curves.Path, def: InvaderDef) {
    const start = path.getStartPoint();
    super(scene, path, start.x, start.y, `invader-${def.type}`);

    this.def   = def;
    this.hp    = def.hp;
    this.maxHp = def.hp;
    this.setOrigin(0.5, 0.5);

    // Sprites are baked larger than the gameplay radius (pixel sprites at 48×48,
    // legacy AI sprites at 128×128) — scale every invader to ~3× its radius so
    // size still tracks the unit's stats, NEAREST keeping the pixels crisp.
    const texKey = `invader-${def.type}`;
    const texSrc = scene.textures.get(texKey).source[0];
    if (texSrc) {
      this.setDisplaySize(def.radius * 3, def.radius * 3);
    }

    // Phase D: defer breathing start until after the external spawn pop-in
    // tween (in DungeonScene.spawnInvaderWithDef) has finished setting its
    // final scaleX/scaleY. 500ms covers the longest spawn tween (boss 420ms).
    scene.time.delayedCall(500, () => {
      if (!this.active || this.isDead) return;
      this.baseScaleX = this.scaleX;
      this.baseScaleY = this.scaleY;
      startIdleBreathing(this);
    });

    // Burn visuals (always created, hidden when stacks=0)
    this.burnAura  = scene.add.graphics().setDepth(this.depth - 1);
    this.burnLabel = scene.add.text(0, 0, '', { fontSize: '10px' }).setDepth(this.depth + 2);

    this.hpBarBg   = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();

    scene.add.existing(this);

    const pathLen  = path.getLength();
    const duration = (pathLen / def.speed) * 1000;
    this.startFollow({ duration, ease: 'Linear', repeat: 0 });

    this.pathTween.on('complete', () => {
      if (!this.isDead) {
        this.isDead = true;
        scene.events.emit('invaderReachedEnd', this);
        cleanup(this);
      }
    });

    // Knights start with a 3-hit frontal shield
    if (def.type === 'knight') {
      initShield(this);
    }

    // Void: immune to traps for first 5 seconds
    if (def.behavior === 'VOID_PHASE') {
      this.voidPhaseUntil = scene.time.now + 5000;
      this.voidAura = scene.add.graphics().setDepth(this.depth - 1);
    }

    // Undying: can revive once at 40% HP
    if (def.behavior === 'REVIVE_ONCE') {
      this.canRevive = true;
    }

    // Boss aura (pulsing outer ring) + name label above HP bar
    if (def.isBoss) {
      this.bossAura = scene.add.graphics().setDepth(this.depth - 2);
      this.bossLabel = scene.add.text(0, 0, `👹 ${def.koreanName}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: '#ff6644', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(this.depth + 3);
    }
  }

  // ─── Stun ─────────────────────────────────────────────────────────────────

  /** A trap applied `affliction` now; it counts toward the combo for COMBO_WINDOW_MS. */
  noteAffliction(affliction: AfflictionId, now: number): void {
    this.recentAfflictions.set(affliction, now + COMBO_WINDOW_MS);
  }

  /** Highest combo level already shown for this invader; resets when the combo lapses. */
  private announcedCombo = 0;

  /**
   * True once per escalation (2 → 3 → 4 afflictions), so the battle shows the
   * combo multiplier when it changes instead of on every hit.
   */
  noteComboAnnounce(count: number): boolean {
    if (!shouldAnnounceCombo(this.announcedCombo, count)) {
      if (count < 2) this.announcedCombo = 0;
      return false;
    }
    this.announcedCombo = count;
    return true;
  }

  /** Distinct afflictions still inside the combo window. */
  comboCount(now: number): number {
    let count = 0;
    for (const [affliction, expiresAt] of this.recentAfflictions) {
      if (expiresAt > now) count++;
      else this.recentAfflictions.delete(affliction);
    }
    return count;
  }

  /**
   * Hand movement back only when every crowd-control effect has expired, and at
   * the speed the *remaining* modifiers call for. Overlapping effects are normal
   * with tier-2/3 traps, so each expiry funnels through here rather than
   * guessing which other effects are still running. See movementLock.ts.
   */
  resumePathIfFree(): void {
    if (!this.pathTween || this.isDead) return;
    if (isMovementLocked(this)) return;
    this.pathTween.timeScale = restingPathSpeed(this);
    this.pathTween.resume();
  }

  /**
   * Speed-only update. Slow / rally / captain-aura changes must NEVER un-pause:
   * taunt, venom paralysis and the revive animation hold the tween without a
   * lock flag, and resuming here would cut them short (measured: it cost the
   * defence a whole stage-20 run).
   */
  syncPathSpeed(): void {
    if (!this.pathTween || this.isDead || isMovementLocked(this)) return;
    this.pathTween.timeScale = restingPathSpeed(this);
  }

  applyStun(durationMs: number): void {
    if (this.isDead || this.isStunned || this.isUnstoppable) return;
    this.isStunned = true;
    this.pathTween.pause();

    for (let i = 0; i < 3; i++) {
      const orb = this.scene.add.graphics().setDepth(this.depth + 1);
      orb.fillStyle(0xffee00, 1);
      orb.fillCircle(0, 0, 4);
      this.stunOrbs.push(orb);
    }

    this.stunTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isStunned = false;
      this.resumePathIfFree();
      clearStunVisual(this);
    });
  }

  // ─── Burn (EMBER_TRAIL) ────────────────────────────────────────────────────

  applyBurn(now: number): void {
    if (this.isDead || this.burnStacks.length >= 3) return;
    this.burnStacks.push({ startTime: now, lastTickTime: now, damage: 10, duration: 3000 });
    logger.debug(`[BURN] stacks=${this.burnStacks.length} total_dps=${this.burnStacks.length * 10}/s`);
    updateBurnVisual(this);
  }

  // ─── Root (PINNING_SHOT) ───────────────────────────────────────────────────

  applyRoot(durationMs: number): void {
    if (this.isDead || this.isRooted || this.isStunned || this.isUnstoppable) return;
    this.isRooted = true;
    this.pathTween.pause();
    logger.debug('[PINNING_SHOT triggered]');

    const g = this.scene.add.graphics().setDepth(this.depth - 1);
    this.rootGraphic = g;
    drawRootGraphic(this);

    this.rootTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isRooted = false;
      this.resumePathIfFree();
      clearRootVisual(this);
    });
  }

  // ─── Freeze (PERMAFROST) ──────────────────────────────────────────────────

  applyFreeze(durationMs: number): void {
    if (this.isDead || this.isFrozen || this.isUnstoppable) return;
    this.isFrozen    = true;
    this.frozenUntil = this.scene.time.now + durationMs;
    this.pathTween.pause();

    this.frozenGfx = this.scene.add.graphics().setDepth(this.depth + 2);
    // Draw cyan crystal ring
    this.frozenGfx.lineStyle(4, 0x44ddff, 1.0);
    this.frozenGfx.strokeCircle(this.x, this.y, 24);
    this.frozenGfx.lineStyle(2, 0xaaeeff, 0.6);
    this.frozenGfx.strokeCircle(this.x, this.y, 32);
    this.frozenGfx.fillStyle(0x44ddff, 0.25);
    this.frozenGfx.fillCircle(this.x, this.y, 24);
    this.setTint(0x99eeff);

    this.freezeTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isFrozen = false;
      this.frozenGfx?.destroy();
      this.frozenGfx = undefined;
      this.clearTint();
      this.resumePathIfFree();
    });
  }

  // ─── Charm (FOX_FIRE_CHARM) ────────────────────────────────────────────────

  applyCharm(durationMs: number): void {
    if (this.isDead || this.isCharmed || this.isUnstoppable) return;
    this.isCharmed    = true;
    this.charmedUntil = this.scene.time.now + durationMs;
    // Stop movement (not reverse — charmed = helpless)
    if (this.pathTween) this.pathTween.timeScale = 0;
    this.charmedGfx = this.scene.add.graphics().setDepth(this.depth + 1);
    // Pink tint
    this.setTint(0xffaacc);
    logger.debug('[FOX_FIRE_CHARM] charmed for 3s — stopped');

    this.charmedTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.breakCharm();
    });
  }

  /** Break charm early (e.g. on taking damage) */
  breakCharm(): void {
    if (!this.isCharmed) return;
    this.isCharmed = false;
    this.charmedTimer?.remove();
    this.charmedTimer = undefined;
    this.resumePathIfFree();
    this.clearTint();
    this.charmedGfx?.destroy();
    this.charmedGfx = undefined;
  }

  // ─── Hex (WAR_HEX) ────────────────────────────────────────────────────────

  applyHex(): void {
    if (this.isDead || this.hexed) return;
    this.hexed           = true;
    this.damageMultiplier = 1.25;   // +25% from all sources
    this.hexGfx = this.scene.add.graphics().setDepth(this.depth + 2);
    logger.debug('[WAR_HEX] applied — dmg ×1.25');
  }

  removeHex(): void {
    if (!this.hexed) return;
    this.hexed           = false;
    this.damageMultiplier = 1;
    this.hexGfx?.destroy();
    this.hexGfx = undefined;
  }

  // ─── Path jump (boss teleports) ─────────────────────────────────────────────

  /**
   * 경로 진행도 `progress`(0~1) 지점으로 도약하고 그 위치를 돌려준다. 좌표를 직접 옮기면 경로 추종이
   * 다음 프레임에 되돌리거나(옛 코드) 주 통로 밖으로 튀어 나간다.
   */
  jumpAlongPath(progress: number): { x: number; y: number } {
    const t = Phaser.Math.Clamp(progress, 0, 0.98);
    if (this.pathTween) this.pathTween.seek(t);
    const point = (this.path as Phaser.Curves.Path).getPoint(t);
    this.setPosition(point.x, point.y);
    return { x: point.x, y: point.y };
  }

  // ─── Pushback (TIDE_THRUST) ────────────────────────────────────────────────

  applyPushback(pixels: number): void {
    if (this.isDead || this.isStunned || this.isFrozen) return;
    // Move the invader backward along the path by reducing path progress
    if (this.pathTween) {
      const pathLen  = (this.path as Phaser.Curves.Path).getLength();
      const pushFrac = pixels / pathLen;
      const newT     = Math.max(0, this.pathTween.progress - pushFrac);
      this.pathTween.seek(newT);
    }
  }

  // ─── Slow (TAUNTING_ROAR) ─────────────────────────────────────────────────

  // ─── Taunt (TAUNTING_ROAR interval) ───────────────────────────────────────

  applyTaunt(durationMs: number): void {
    if (this.isDead || this.isUnstoppable) return;
    this.isTaunted = true;
    this.pathTween.pause();
    this.setTint(0xff4444);
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isTaunted = false;
      this.resumePathIfFree();
      this.clearTint();
    });
  }

  applySlow(mult: number, durationMs: number): void {
    if (this.isDead || this.isSlowed || this.isUnstoppable) return;
    this.isSlowed = true;
    this.slowMult = mult;
    this.syncPathSpeed();
    // Visual: cyan pulsing ring to indicate slow
    if (!this.slowGfx) {
      this.slowGfx = this.scene.add.graphics().setDepth(this.depth + 1);
    }
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isSlowed = false;
      this.slowMult = 1;
      this.slowGfx?.destroy();
      this.slowGfx = undefined;
      this.syncPathSpeed();
    });
  }

  // ─── Speed boost (RALLY_CRY) ──────────────────────────────────────────────

  applySpeedBoost(mult: number, durationMs: number): void {
    if (this.isDead || this.isStunned || this.isFrozen) return;
    this.boostMult = mult;
    this.syncPathSpeed();
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.boostMult = 1;
      this.syncPathSpeed();
    });
  }

  // ─── Heal (called from DungeonScene.runHealers) ────────────────────────────

  receiveHeal(amount: number): void {
    if (this.isDead || !this.active) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // ─── Damage ───────────────────────────────────────────────────────────────

  takeDamage(amount: number, isMagic = false): void {
    if (this.isDead) return;
    // STUN_IMMUNE: only takes damage while stunned
    if (this.isDamageImmune && !this.isStunned) {
      return;  // damage blocked — caller must show immune visual
    }
    // Mirror shield: reflect 30% and decrement shield counter
    if (this.hasMirrorShield && this.mirrorHitsRemaining > 0) {
      this.mirrorHitsRemaining--;
      this.scene.events.emit('mirrorReflect', this, Math.round(amount * 0.3));
      if (this.mirrorHitsRemaining === 0) {
        this.hasMirrorShield = false;
        this.mirrorGfx?.destroy();
        this.mirrorGfx = undefined;
      }
    }
    let actual = Math.round(amount * this.damageMultiplier);
    if (this.hasShield && this.shieldHitsRemaining > 0) {
      actual = Math.round(actual * 0.5);
      this.shieldHitsRemaining--;
      logger.debug(`[SHIELD HIT] hits_left=${this.shieldHitsRemaining} dmg=${actual}`);
      if (this.shieldHitsRemaining === 0) {
        this.hasShield = false;
        triggerShieldBreak(this);
      }
    }
    // Charm breaks on taking any damage
    if (this.isCharmed) this.breakCharm();
    this.hp = Math.max(0, this.hp - actual);
    if (actual >= 10) {
      const col = actual >= 500 ? '#ffee44' : actual >= 200 ? '#ffaa44' : '#ff7777';
      showFloatText(this.scene, this.x, this.y - this.def.radius * 2, `-${actual}`, col);
    }
    // Phase D: hit reaction flash + scale bump (skip if killed — die() handles visuals)
    if (actual > 0 && this.hp > 0) {
      playHitReaction(this);
    }
    if (this.hp <= 0) this.killedByMagic = isMagic;
    if (this.hp <= 0) this.die();
  }

  applySubmerge(durationMs: number): void {
    if (this.isDead) return;
    this.isSubmerged = true;
    this.submergedUntil = this.scene.time.now + durationMs;
    this.setAlpha(0.5);
    this.submergeAura = this.scene.add.graphics().setDepth(this.depth - 1);
    this.submergeAura.fillStyle(0x003366, 0.3);
    this.submergeAura.fillCircle(this.x, this.y, this.def.radius + 8);

    this.submergeTimer = this.scene.time.delayedCall(durationMs, () => {
      if (!this.active || this.isDead) return;
      this.isSubmerged = false;
      this.setAlpha(1);
      this.submergeAura?.destroy();
      this.submergeAura = undefined;
      // resurface: schedule next submerge after 5s
      this.scene.time.delayedCall(5000, () => {
        if (!this.active || this.isDead) return;
        this.applySubmerge(8000);
      });
    });
  }

  addVenomStack(): void {
    if (this.isDead) return;
    this.venomStacks = Math.min(5, this.venomStacks + 1);
    drawVenomStacks(this);
    if (this.venomStacks >= 5) triggerVenomBurst(this);
  }

  // ─── Death ────────────────────────────────────────────────────────────────

  die(): void {
    invaderDie(this);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    invaderPreUpdate(this, time, delta);
  }
}

