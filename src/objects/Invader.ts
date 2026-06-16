import Phaser from 'phaser';
import { COLORS } from '../constants/colors';
import type { InvaderDef } from '../data/invaders';
import { logger } from '../utils/logger';
import { showFloatText } from '../combat/VisualEffects';

// ─── Burn stack ───────────────────────────────────────────────────────────────

interface BurnStack {
  startTime:    number;   // ms when applied
  lastTickTime: number;   // ms of last damage tick
  damage:       number;   // 10 per tick
  duration:     number;   // 3000ms total lifetime
}

// ─── Invader ──────────────────────────────────────────────────────────────────

export class Invader extends Phaser.GameObjects.PathFollower {
  public  hp:     number;
  public readonly maxHp: number;
  public readonly def:   InvaderDef;
  public isDead = false;

  // ── Stun (FIRST_STRIKE_STUN) ───────────────────────────────────────────────
  public  isStunned  = false;
  private stunOrbs:  Phaser.GameObjects.Graphics[] = [];
  private stunTimer?: Phaser.Time.TimerEvent;

  // ── Burn (EMBER_TRAIL) ─────────────────────────────────────────────────────
  public  burnStacks: BurnStack[] = [];
  private burnAura!:  Phaser.GameObjects.Graphics;
  private burnLabel!: Phaser.GameObjects.Text;

  // ── Root (PINNING_SHOT) ────────────────────────────────────────────────────
  public  isRooted     = false;
  private rootGraphic?: Phaser.GameObjects.Graphics;
  private rootTimer?:   Phaser.Time.TimerEvent;

  // ── Shield (FRONTAL_SHIELD — knight invaders) ──────────────────────────────
  public  hasShield           = false;
  public  shieldHitsRemaining = 0;
  private shieldGraphic?:     Phaser.GameObjects.Graphics;

  // ── Heal (soldier = 야전 치유사) ─────────────────────────────────────────
  public  lastHealTime = 0;   // ms; checked in DungeonScene.runHealers()

  // ── Freeze (PERMAFROST) ───────────────────────────────────────────────────
  public  isFrozen     = false;
  public  frozenUntil  = 0;
  private frozenGfx?:  Phaser.GameObjects.Graphics;
  private freezeTimer?: Phaser.Time.TimerEvent;

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
  public  isSlowed         = false;
  private slowGfx?:        Phaser.GameObjects.Graphics;
  public  hexed            = false;   // WAR_HEX: +25% damage received
  public  damageMultiplier = 1;       // >1 = takes more dmg (hex); applied in takeDamage
  public  isInvisible      = false;   // shadow_ninja: single-target attacks miss
  private charmedGfx?:     Phaser.GameObjects.Graphics;
  private charmedTimer?:   Phaser.Time.TimerEvent;
  private berserkerAura?:  Phaser.GameObjects.Graphics;
  private berserkTriggered = false;
  private hexGfx?:         Phaser.GameObjects.Graphics;

  // ── Chapter 3 status fields ────────────────────────────────────────────────
  public  isFireImmune     = false;   // DRAGON_KING phase 2
  public  isSubmerged      = false;   // DRAGON_KING phase 3 (only traps hit)
  public  submergedUntil   = 0;       // timestamp when submerge ends
  private submergeTimer?:  Phaser.Time.TimerEvent;
  private submergeAura?:   Phaser.GameObjects.Graphics;
  public  venomStacks      = 0;       // VENOM_STACK counter (0-5)
  private venomGfx?:       Phaser.GameObjects.Graphics;
  private venomBurstTimer?: Phaser.Time.TimerEvent;
  public  isDecoy          = false;   // DECOY_CLONE: this is a fake clone
  public  realInvader?:    Invader;   // DECOY_CLONE: pointer to real one
  public  hasDecoyAlive    = false;   // DECOY_CLONE: real's clone is alive
  public  dragonPhase      = 1;       // DRAGON_KING: 1, 2, or 3
  public  isDamageImmune   = false;   // STUN_IMMUNE boss: only takes dmg when stunned
  public  ch4BossPhase     = 1;       // death_emissary: 1, 2, or 3
  public  ch5BossPhase     = 1;       // three_god_destroyer: 1–5
  public  ch6BossPhase     = 1;       // eternal_emperor: 1–4
  private bossAura?:       Phaser.GameObjects.Graphics;
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
  private voidAura?:      Phaser.GameObjects.Graphics;

  // ── Revive (REVIVE_ONCE) ──────────────────────────────────────────────────
  public  canRevive  = false;
  public  hasRevived = false;

  // ── HP bar ────────────────────────────────────────────────────────────────
  private hpBarBg:    Phaser.GameObjects.Graphics;
  private hpBarFill:  Phaser.GameObjects.Graphics;
  private bossLabel?: Phaser.GameObjects.Text;
  private crisisRing?: Phaser.GameObjects.Graphics;
  private crisisTween?: Phaser.Tweens.Tween;

  // ── Phase D: hit reaction + idle breathing ───────────────────────────────
  /** Base scale captured after setDisplaySize — anchor for scale tweens. */
  private baseScaleX = 1;
  private baseScaleY = 1;
  /** Active hit-flash tween, killed on new hit to prevent stacking. */
  private hitTween?:    Phaser.Tweens.Tween;
  /** Active breathing tween. */
  private breathTween?: Phaser.Tweens.Tween;

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
      this.startIdleBreathing();
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
        this.cleanup();
      }
    });

    // Knights start with a 3-hit frontal shield
    if (def.type === 'knight') {
      this.initShield();
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
      this.pathTween.resume();
      this.clearStunVisual();
    });
  }

  private clearStunVisual(): void {
    this.stunOrbs.forEach(o => o.destroy());
    this.stunOrbs = [];
  }

  // ─── Burn (EMBER_TRAIL) ────────────────────────────────────────────────────

  applyBurn(now: number): void {
    if (this.isDead || this.burnStacks.length >= 3) return;
    this.burnStacks.push({ startTime: now, lastTickTime: now, damage: 10, duration: 3000 });
    logger.debug(`[BURN] stacks=${this.burnStacks.length} total_dps=${this.burnStacks.length * 10}/s`);
    this.updateBurnVisual();
  }

  private processBurn(now: number): void {
    if (this.burnStacks.length === 0) return;
    let any = false;
    this.burnStacks = this.burnStacks.filter(stack => {
      if (now - stack.startTime >= stack.duration) { any = true; return false; }
      if (now - stack.lastTickTime >= 1000) {
        stack.lastTickTime = now;
        this.hp = Math.max(0, this.hp - stack.damage);
        any = true;
        if (this.hp <= 0) { this.die(); return false; }
      }
      return true;
    });
    if (any) this.updateBurnVisual();
  }

  private updateBurnVisual(): void {
    const n = this.burnStacks.length;
    this.burnAura.clear();
    if (n === 0) { this.burnLabel.setText(''); return; }

    const r     = this.def.radius + 3;
    const alpha = 0.25 + n * 0.18;   // 0.43 / 0.61 / 0.79
    const color = n < 3 ? 0xff6600 : 0xff2200;
    this.burnAura.fillStyle(color, alpha);
    this.burnAura.fillCircle(this.x, this.y, r + n * 2);

    const icons = '🔥'.repeat(n);
    this.burnLabel
      .setText(icons)
      .setPosition(this.x - n * 6, this.y - this.def.radius - 22);
  }

  // ─── Root (PINNING_SHOT) ───────────────────────────────────────────────────

  applyRoot(durationMs: number): void {
    if (this.isDead || this.isRooted || this.isStunned || this.isUnstoppable) return;
    this.isRooted = true;
    this.pathTween.pause();
    logger.debug('[PINNING_SHOT triggered]');

    const g = this.scene.add.graphics().setDepth(this.depth - 1);
    this.rootGraphic = g;
    this.drawRootGraphic();

    this.rootTimer = this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isRooted = false;
      if (!this.isStunned) this.pathTween.resume();
      this.clearRootVisual();
    });
  }

  private drawRootGraphic(): void {
    if (!this.rootGraphic) return;
    this.rootGraphic.clear();
    this.rootGraphic.lineStyle(2, 0x7a4500, 0.9);
    this.rootGraphic.strokeCircle(this.x, this.y, this.def.radius + 4);
    this.rootGraphic.lineStyle(1.5, 0xa06020, 0.6);
    this.rootGraphic.strokeCircle(this.x, this.y, this.def.radius + 9);
  }

  private clearRootVisual(): void {
    this.rootGraphic?.destroy();
    this.rootGraphic = undefined;
  }

  // ─── Shield (FRONTAL_SHIELD) ───────────────────────────────────────────────

  private initShield(): void {
    this.hasShield           = true;
    this.shieldHitsRemaining = 3;
    this.shieldGraphic       = this.scene.add.graphics().setDepth(this.depth + 1);
  }

  private drawShield(): void {
    if (!this.shieldGraphic || !this.hasShield) return;
    this.shieldGraphic.clear();
    this.shieldGraphic.lineStyle(2.5, 0x4488ff, 0.7);
    this.shieldGraphic.beginPath();
    // Arc in front of invader (left side, since invaders move left)
    this.shieldGraphic.arc(this.x, this.y, this.def.radius + 5, -2.2, 2.2, false);
    this.shieldGraphic.strokePath();
  }

  private triggerShieldBreak(): void {
    // 12 blue/silver shards
    for (let i = 0; i < 12; i++) {
      const shard = this.scene.add.graphics().setDepth(this.depth + 2);
      shard.fillStyle(i % 2 === 0 ? 0x4488ff : 0xaaccff, 1);
      shard.fillRect(-2, -6, 4, 8);
      shard.setPosition(this.x, this.y);
      const angle = (i / 12) * Math.PI * 2;
      this.scene.tweens.add({
        targets: shard,
        x: this.x + Math.cos(angle) * 80,
        y: this.y + Math.sin(angle) * 80,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: 420,
        onComplete: () => shard.destroy(),
      });
    }
    // White flash
    const flash = this.scene.add.graphics().setDepth(this.depth + 3);
    flash.fillStyle(0xffffff, 0.85);
    flash.fillCircle(this.x, this.y, this.def.radius + 8);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 200,
      onComplete: () => flash.destroy(),
    });
    this.shieldGraphic?.destroy();
    this.shieldGraphic = undefined;
    logger.debug(`[SHIELD BREAK] invader at (${Math.round(this.x)},${Math.round(this.y)})`);
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
      if (!this.isStunned && !this.isRooted) this.pathTween.resume();
    });
  }

  private clearFreezeVisual(): void {
    this.frozenGfx?.destroy();
    this.frozenGfx = undefined;
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
    if (this.pathTween && !this.isFrozen && !this.isStunned && !this.isRooted) {
      this.pathTween.timeScale = 1;
    }
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
    this.pathTween.pause();
    this.setTint(0xff4444);
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      if (!this.isStunned && !this.isRooted && !this.isFrozen && !this.isCharmed) {
        this.pathTween.resume();
      }
      this.clearTint();
    });
  }

  applySlow(mult: number, durationMs: number): void {
    if (this.isDead || this.isSlowed || this.isUnstoppable) return;
    this.isSlowed = true;
    if (this.pathTween) this.pathTween.timeScale = mult;
    // Visual: cyan pulsing ring to indicate slow
    if (!this.slowGfx) {
      this.slowGfx = this.scene.add.graphics().setDepth(this.depth + 1);
    }
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      this.isSlowed = false;
      this.slowGfx?.destroy();
      this.slowGfx = undefined;
      if (this.pathTween && !this.isFrozen && !this.isStunned && !this.isRooted) {
        this.pathTween.timeScale = 1;
      }
    });
  }

  // ─── Speed boost (RALLY_CRY) ──────────────────────────────────────────────

  applySpeedBoost(mult: number, durationMs: number): void {
    if (this.isDead || this.isStunned || this.isFrozen) return;
    if (this.pathTween) this.pathTween.timeScale = mult;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.isDead || !this.active) return;
      if (this.pathTween && !this.isSlowed && !this.isFrozen && !this.isStunned) {
        this.pathTween.timeScale = 1;
      }
    });
  }

  /** Ice crystal burst — purely visual, AoE damage handled in DungeonScene */
  private spawnIceShatter(): void {
    const cx = this.x, cy = this.y;
    // 12 ice shards fly outward
    for (let i = 0; i < 12; i++) {
      const shard = this.scene.add.graphics().setDepth(this.depth + 3);
      shard.fillStyle(i % 2 === 0 ? 0x88ddff : 0xccf0ff, 1);
      shard.fillTriangle(-3, -7, 3, -7, 0, 4);
      shard.setPosition(cx, cy);
      const angle = (i / 12) * Math.PI * 2;
      this.scene.tweens.add({
        targets: shard,
        x: cx + Math.cos(angle) * 90,
        y: cy + Math.sin(angle) * 90,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: 500,
        ease: 'Power2',
        onComplete: () => shard.destroy(),
      });
    }
    // Cyan AoE ring expansion
    const ring = this.scene.add.graphics().setDepth(this.depth + 2);
    ring.lineStyle(3, 0x44ddff, 0.9);
    ring.strokeCircle(cx, cy, 10);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 8, scaleY: 8,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
    // White flash
    const flash = this.scene.add.graphics().setDepth(this.depth + 2);
    flash.fillStyle(0xaaeeff, 0.75);
    flash.fillCircle(cx, cy, this.def.radius + 8);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 250,
      onComplete: () => flash.destroy(),
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
        this.triggerShieldBreak();
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
      this.playHitReaction();
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
    this.drawVenomStacks();
    if (this.venomStacks >= 5) this.triggerVenomBurst();
  }

  private triggerVenomBurst(): void {
    this.venomStacks = 0;
    this.drawVenomStacks();
    // Paralyzed
    if (this.pathTween && !this.isUnstoppable) {
      this.pathTween.pause();
      this.scene.time.delayedCall(2000, () => {
        if (!this.active || this.isDead) return;
        if (!this.isStunned && !this.isRooted && !this.isFrozen && !this.isCharmed)
          this.pathTween?.resume();
      });
    }
    // 100 burst damage
    this.takeDamage(100, false);
    // Visual: green explosion
    const g = this.scene.add.graphics().setDepth(this.depth + 3);
    g.fillStyle(0x00cc00, 0.7);
    g.fillCircle(this.x, this.y, this.def.radius + 16);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
    logger.debug('[VENOM_BURST] paralyzed 2s + 100dmg');
  }

  private drawVenomStacks(): void {
    this.venomGfx?.destroy();
    if (this.venomStacks <= 0) { this.venomGfx = undefined; return; }
    this.venomGfx = this.scene.add.graphics().setDepth(this.depth + 2);
    for (let i = 0; i < this.venomStacks; i++) {
      this.venomGfx.fillStyle(0x00bb00, 0.9);
      this.venomGfx.fillCircle(this.x - 8 + i * 4, this.y - this.def.radius - 8, 3);
    }
  }

  // ─── Death ────────────────────────────────────────────────────────────────

  die(): void {
    if (this.isDead) return;

    // ── REVIVE_ONCE intercept ────────────────────────────────────────────────
    if (this.canRevive && !this.hasRevived) {
      this.hasRevived = true;
      this.hp = Math.round(this.maxHp * 0.4);

      // Pause movement during revive
      this.pathTween.pause();
      if (this.isStunned || this.isRooted) {
        this.isStunned = false;
        this.isRooted  = false;
        this.clearStunVisual();
        this.clearRootVisual();
        this.stunTimer?.remove();
        this.rootTimer?.remove();
      }

      // Red lightning burst
      for (let i = 0; i < 8; i++) {
        const bolt = this.scene.add.graphics().setDepth(this.depth + 3);
        bolt.lineStyle(2, 0xff2200, 1);
        const angle = (i / 8) * Math.PI * 2;
        const ex    = Math.cos(angle) * 40;
        const ey    = Math.sin(angle) * 40;
        bolt.lineBetween(this.x, this.y, this.x + ex, this.y + ey);
        this.scene.tweens.add({
          targets: bolt, alpha: 0, duration: 300,
          onComplete: () => bolt.destroy(),
        });
      }

      // Dark red flash on body
      const flash = this.scene.add.graphics().setDepth(this.depth + 2);
      flash.fillStyle(0xff0000, 0.7);
      flash.fillCircle(this.x, this.y, this.def.radius + 6);
      this.scene.tweens.add({
        targets: flash, alpha: 0, duration: 350,
        onComplete: () => flash.destroy(),
      });

      // Rise animation: sink down then pop back up
      this.scene.tweens.add({
        targets: this,
        y: this.y + 20,
        duration: 200, ease: 'Power1',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this,
            y: this.y - 20, scaleX: 1.3, scaleY: 1.3,
            duration: 400, ease: 'Back.Out',
            onComplete: () => {
              this.setScale(1);
              if (!this.isDead && this.active) this.pathTween.resume();
            },
          });
        },
      });

      logger.debug(`[REVIVE] undying at (${Math.round(this.x)},${Math.round(this.y)}) revives to ${this.hp} HP`);
      return;   // do NOT die
    }

    // ── Normal death ─────────────────────────────────────────────────────────
    this.isDead = true;
    const wasfrozen = this.isFrozen;

    // Un-pause path so cleanup can proceed
    if (this.isStunned || this.isRooted || this.isFrozen || this.isCharmed) {
      this.isStunned = false;
      this.isRooted  = false;
      this.isFrozen  = false;
      this.isCharmed = false;
      this.pathTween.timeScale = 1;
      this.pathTween.resume();
      this.clearStunVisual();
      this.clearRootVisual();
      this.clearFreezeVisual();
      this.stunTimer?.remove();
      this.rootTimer?.remove();
      this.freezeTimer?.remove();
      this.charmedTimer?.remove();
    }
    // Remove hex on death (so DungeonScene knows to transfer it)
    if (this.hexed) {
      this.hexed           = false;
      this.damageMultiplier = 1;
      this.hexGfx?.destroy();
      this.hexGfx = undefined;
    }
    this.clearTint();

    // PERMAFROST shatter — emit before death fade so DungeonScene can react
    if (wasfrozen) {
      this.scene.events.emit('permafrostShatter', this);
      this.spawnIceShatter();
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0, scaleX: 1.6, scaleY: 1.6,
      duration: 200, ease: 'Power2',
      onComplete: () => this.cleanup(),
    });

    this.scene.events.emit('invaderKilled', this);
  }

  private cleanup(): void {
    this.clearStunVisual();
    this.clearRootVisual();
    this.clearFreezeVisual();
    this.stunTimer?.remove();
    this.rootTimer?.remove();
    this.freezeTimer?.remove();
    this.charmedTimer?.remove();
    this.burnAura.destroy();
    this.burnLabel.destroy();
    this.shieldGraphic?.destroy();
    this.voidAura?.destroy();
    this.charmedGfx?.destroy();
    this.berserkerAura?.destroy();
    this.hexGfx?.destroy();
    this.slowGfx?.destroy();
    this.slowGfx = undefined;
    this.crisisTween?.stop();
    this.crisisRing?.destroy();
    this.crisisRing  = undefined;
    this.crisisTween = undefined;
    this.venomGfx?.destroy();
    this.venomGfx = undefined;
    this.submergeAura?.destroy();
    this.submergeAura = undefined;
    this.submergeTimer?.remove();
    this.venomBurstTimer?.remove();
    this.mirrorGfx?.destroy();
    this.shadowRealmGfx?.destroy();
    this.shadowRealmTimer?.remove();
    this.bossAura?.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.bossLabel?.destroy();
    this.hitTween?.stop();
    this.breathTween?.stop();
    if (this.active) this.destroy();
  }

  // ─── Phase D: hit reaction + idle breathing ─────────────────────────────

  /**
   * Idle breathing tween — subtle Y-scale pulse (1.00 → 1.035 → 1.00)
   * on a 1400ms cycle. Uses baseScaleY as anchor so it doesn't drift.
   * Paused while a hit tween is active to avoid conflicts.
   */
  private startIdleBreathing(): void {
    this.breathTween?.stop();
    this.breathTween = this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScaleY * 1.035,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      // randomize start offset so multiple invaders don't sync-breathe
      delay: Math.random() * 1400,
    });
  }

  /**
   * Hit reaction — brief white tint flash + scale bump.
   * Called from takeDamage() whenever damage > 0 is applied.
   */
  private playHitReaction(): void {
    // Kill prior hit tween + suspend breathing so they don't fight
    this.hitTween?.stop();
    this.breathTween?.stop();

    // If breathing hasn't started yet (first 500ms of life), capture the
    // current scale as base now. Prevents scale drift on early hits.
    if (!this.breathTween) {
      this.baseScaleX = this.scaleX;
      this.baseScaleY = this.scaleY;
    }

    // White flash
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active && !this.isDead) this.clearTint();
    });

    // Scale bump — 1.18× → base over 180ms (Back.easeOut for overshoot feel)
    this.setScale(this.baseScaleX * 1.18, this.baseScaleY * 1.18);
    this.hitTween = this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScaleX,
      scaleY: this.baseScaleY,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Resume breathing if not destroyed
        if (this.active && !this.isDead) {
          this.startIdleBreathing();
        }
      },
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || this.isDead) return;

    // Stun orbs orbit
    if (this.isStunned && this.stunOrbs.length) {
      const a0 = time / 400;
      this.stunOrbs.forEach((orb, i) => {
        const a = a0 + (i * Math.PI * 2) / 3;
        orb.setPosition(
          this.x + Math.cos(a) * 20,
          this.y - this.def.radius - 4 + Math.sin(a) * 8,
        );
      });
    }

    // Burn ticks + aura tracks position
    if (this.burnStacks.length > 0) {
      this.processBurn(time);
      this.updateBurnVisual();
    } else {
      this.burnAura.clear();
    }

    // Shield arc tracks position
    if (this.hasShield) this.drawShield();

    // Root rings track position
    if (this.isRooted && this.rootGraphic) this.drawRootGraphic();

    // Freeze crystal aura tracks position
    if (this.isFrozen && this.frozenGfx) {
      this.frozenGfx.clear();
      const pulse = 0.5 + 0.3 * Math.sin(time / 150);
      this.frozenGfx.fillStyle(0x88ddff, 0.35);
      this.frozenGfx.fillCircle(this.x, this.y, this.def.radius + 4);
      this.frozenGfx.lineStyle(2.5, 0x44ddff, pulse);
      this.frozenGfx.strokeCircle(this.x, this.y, this.def.radius + 5);
      this.frozenGfx.lineStyle(1.5, 0xaaeeff, pulse * 0.6);
      this.frozenGfx.strokeCircle(this.x, this.y, this.def.radius + 10);
      // 4 ice crystal spikes
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time / 1000;
        const r1 = this.def.radius + 4;
        const r2 = this.def.radius + 14;
        this.frozenGfx.lineStyle(2, 0xccf0ff, 0.8);
        this.frozenGfx.lineBetween(
          this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1,
          this.x + Math.cos(a) * r2, this.y + Math.sin(a) * r2,
        );
      }
    }

    // Charm visual — pink hearts orbit
    if (this.isCharmed && this.charmedGfx) {
      this.charmedGfx.clear();
      this.charmedGfx.fillStyle(0xff66bb, 0.9);
      for (let i = 0; i < 3; i++) {
        const a = time / 300 + (i / 3) * Math.PI * 2;
        this.charmedGfx.fillCircle(
          this.x + Math.cos(a) * (this.def.radius + 8),
          this.y + Math.sin(a) * (this.def.radius + 8) - 4,
          3,
        );
      }
    }

    // Hex visual — purple skull orbits hexed invader
    if (this.hexed && this.hexGfx) {
      this.hexGfx.clear();
      const a = time / 500;
      const r = this.def.radius + 10;
      this.hexGfx.fillStyle(0xaa00ff, 0.85);
      this.hexGfx.fillCircle(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 4);
      this.hexGfx.fillCircle(this.x + Math.cos(a + Math.PI) * r, this.y + Math.sin(a + Math.PI) * r, 3);
    }

    // Slow — cyan dashed ring pulses to signal reduced speed
    if (this.isSlowed && this.slowGfx) {
      this.slowGfx.clear();
      const pulse = 0.35 + 0.25 * Math.sin(time / 220);
      this.slowGfx.lineStyle(2.5, 0x44aaff, pulse + 0.25);
      this.slowGfx.strokeCircle(this.x, this.y, this.def.radius + 6);
      this.slowGfx.lineStyle(1.5, 0x88ccff, pulse);
      this.slowGfx.strokeCircle(this.x, this.y, this.def.radius + 10);
      // 3 small blue diamond droplets above
      for (let i = 0; i < 3; i++) {
        const a = time / 600 + (i / 3) * Math.PI * 2;
        const r = this.def.radius + 7;
        this.slowGfx.fillStyle(0x44aaff, 0.7);
        this.slowGfx.fillCircle(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r - 2, 2.5);
      }
    }

    // Venom stack dots track position
    if (this.venomStacks > 0 && this.venomGfx) {
      this.venomGfx.clear();
      for (let i = 0; i < this.venomStacks; i++) {
        this.venomGfx.fillStyle(0x00bb00, 0.9);
        this.venomGfx.fillCircle(this.x - 8 + i * 4, this.y - this.def.radius - 8, 3);
      }
    }

    // Submerge aura tracks position
    if (this.isSubmerged && this.submergeAura) {
      this.submergeAura.clear();
      this.submergeAura.fillStyle(0x003366, 0.35);
      this.submergeAura.fillCircle(this.x, this.y, this.def.radius + 8);
      this.submergeAura.lineStyle(2, 0x0066cc, 0.6);
      this.submergeAura.strokeCircle(this.x, this.y, this.def.radius + 8);
    }

    // BERSERKER_RAGE — triggers below 50% HP: speed ×2 + red aura
    if (this.hasBerserkerRage && !this.berserkTriggered && this.hp < this.maxHp * 0.5) {
      this.berserkTriggered = true;
      if (this.pathTween) this.pathTween.timeScale = 2;
      this.berserkerAura = this.scene.add.graphics().setDepth(this.depth - 1);
      logger.debug('[BERSERKER_RAGE] triggered — speed ×2');
    }
    if (this.berserkerAura) {
      this.berserkerAura.clear();
      const pulse = 0.4 + 0.35 * Math.sin(time / 120);
      this.berserkerAura.fillStyle(0xff2200, pulse * 0.5);
      this.berserkerAura.fillCircle(this.x, this.y, this.def.radius + 5);
      this.berserkerAura.lineStyle(2, 0xff4400, pulse);
      this.berserkerAura.strokeCircle(this.x, this.y, this.def.radius + 6);
    }

    // Void aura — pulsing purple ring while in phase
    if (this.voidAura) {
      this.voidAura.clear();
      if (time < this.voidPhaseUntil) {
        const pulse = 0.35 + 0.25 * Math.sin(time / 180);
        this.voidAura.lineStyle(2.5, 0x9933ff, pulse);
        this.voidAura.strokeCircle(this.x, this.y, this.def.radius + 6);
        this.voidAura.lineStyle(1.5, 0xcc66ff, pulse * 0.5);
        this.voidAura.strokeCircle(this.x, this.y, this.def.radius + 11);
      }
    }

    // Mirror shield visual
    if (this.hasMirrorShield && this.mirrorGfx) {
      this.mirrorGfx.clear();
      const shimmer = 0.5 + 0.3 * Math.sin(time / 200);
      this.mirrorGfx.fillStyle(0xc0c0ff, shimmer * 0.3);
      this.mirrorGfx.fillCircle(this.x, this.y, this.def.radius + 4);
      this.mirrorGfx.lineStyle(1.5, 0xeeeeff, shimmer);
      this.mirrorGfx.strokeCircle(this.x, this.y, this.def.radius + 5);
    }

    // Shadow realm visual
    if (this.isInShadowRealm && this.shadowRealmGfx) {
      this.shadowRealmGfx.clear();
      const pulse = 0.3 + 0.2 * Math.sin(time / 150);
      this.shadowRealmGfx.fillStyle(0x1a0030, pulse);
      this.shadowRealmGfx.fillCircle(this.x, this.y, this.def.radius + 8);
      this.shadowRealmGfx.lineStyle(1.5, 0x6622aa, pulse + 0.2);
      this.shadowRealmGfx.strokeCircle(this.x, this.y, this.def.radius + 10);
    } else if (this.shadowRealmGfx) {
      this.shadowRealmGfx.clear();
    }

    // Boss aura — pulsing outer ring with phase-based color
    if (this.bossAura) {
      this.bossAura.clear();
      const r = this.def.radius;
      const pulse = 0.3 + 0.25 * Math.sin(time / 300);
      const pulse2 = 0.2 + 0.15 * Math.sin(time / 500 + 1);

      // Phase-based color selection
      let auraColor = 0xffaa00; // default gold
      if (this.def.type === 'dragon_king') {
        auraColor = this.dragonPhase === 3 ? 0xff2200 : this.dragonPhase === 2 ? 0xff6600 : 0xffaa00;
      } else if (this.def.type === 'death_emissary') {
        auraColor = this.ch4BossPhase >= 3 ? 0x660099 : this.ch4BossPhase === 2 ? 0x993399 : 0x8800aa;
      } else if (this.def.type === 'three_god_destroyer') {
        const colors = [0xcc8800, 0xff4400, 0x4400ff, 0x00ccff, 0xffffff];
        auraColor = colors[Math.min(this.ch5BossPhase - 1, 4)];
      } else if (this.def.type === 'eternal_emperor') {
        const colors = [0xd4af37, 0xff6600, 0x8844cc, 0xff0000];
        auraColor = colors[Math.min(this.ch6BossPhase - 1, 3)];
      }

      // Outer pulsing ring
      this.bossAura.lineStyle(3, auraColor, pulse);
      this.bossAura.strokeCircle(this.x, this.y, r + 8);
      // Inner softer ring
      this.bossAura.lineStyle(1.5, auraColor, pulse2);
      this.bossAura.strokeCircle(this.x, this.y, r + 14);

      // Crown particles (4 dots orbiting above)
      const crownY = this.y - r - 10;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time / 800;
        const cx = this.x + Math.cos(a) * (r * 0.5);
        const cy = crownY + Math.sin(a) * 3;
        this.bossAura.fillStyle(auraColor, 0.6 + 0.3 * Math.sin(time / 200 + i));
        this.bossAura.fillCircle(cx, cy, 2);
      }
    }

    this.updateHpBar();
  }

  private updateHpBar(): void {
    const isBoss = this.def.isBoss ?? false;
    const bw = isBoss ? 72 : 38;
    const bh = isBoss ? 8  : 5;
    const bx = this.x - bw / 2;
    const by = this.y - this.def.radius - (isBoss ? 16 : 12);

    // Boss name label tracks position above bar
    if (this.bossLabel) {
      this.bossLabel.setPosition(this.x, by - 2);
    }

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x000000, 0.75);
    this.hpBarBg.fillRect(bx, by, bw, bh);
    this.hpBarBg.lineStyle(0.5, COLORS.STONE_DARK, 0.6);
    this.hpBarBg.strokeRect(bx, by, bw, bh);

    // Shield icon prefix on HP bar background when shielded
    const pct   = this.hp / this.maxHp;
    const color = pct > 0.55 ? COLORS.MOSS_LIGHT : pct > 0.25 ? COLORS.TORCH_GOLD : COLORS.BLOOD_GLOW;
    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * pct), bh - 2);

    // Blue tint over bar when shielded
    if (this.hasShield) {
      this.hpBarFill.fillStyle(0x4488ff, 0.3);
      this.hpBarFill.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * pct), bh - 2);
    }

    // Crisis ring: pulsing red border when HP ≤ 10%
    if (pct <= 0.10 && !this.isDead) {
      if (!this.crisisRing) {
        this.crisisRing = this.scene.add.graphics().setDepth(this.depth + 5);
        this.crisisTween = this.scene.tweens.add({
          targets: this.crisisRing,
          alpha: { from: 0.9, to: 0.2 },
          duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
      const r = this.def.radius + 4;
      this.crisisRing.clear();
      this.crisisRing.lineStyle(2, 0xff2222, 1);
      this.crisisRing.strokeCircle(this.x, this.y, r);
      this.crisisRing.lineStyle(1, 0xff6666, 0.5);
      this.crisisRing.strokeCircle(this.x, this.y, r + 3);
    } else if (this.crisisRing && pct > 0.10) {
      this.crisisTween?.stop();
      this.crisisRing.destroy();
      this.crisisRing  = undefined;
      this.crisisTween = undefined;
    }
  }
}
