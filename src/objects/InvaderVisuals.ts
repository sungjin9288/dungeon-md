/**
 * InvaderVisuals.ts — extracted private visual/behaviour bodies from Invader.ts.
 *
 * Each function takes `invader: Invader` as its first argument and replicates the
 * original `this`-based body verbatim. Invader.ts keeps thin delegators so public
 * API and Phaser overrides are unchanged.
 *
 * Import rule: use `import type` to avoid a runtime circular reference.
 */

import Phaser from 'phaser';
import { COLORS } from '../constants/colors';
import { logger } from '../utils/logger';
import type { Invader } from './Invader';

// ─── Stun visual ──────────────────────────────────────────────────────────────

export function clearStunVisual(invader: Invader): void {
  invader.stunOrbs.forEach(o => o.destroy());
  invader.stunOrbs = [];
}

// ─── Burn ─────────────────────────────────────────────────────────────────────

export function processBurn(invader: Invader, now: number): void {
  if (invader.burnStacks.length === 0) return;
  let any = false;
  invader.burnStacks = invader.burnStacks.filter(stack => {
    if (now - stack.startTime >= stack.duration) { any = true; return false; }
    if (now - stack.lastTickTime >= 1000) {
      stack.lastTickTime = now;
      invader.hp = Math.max(0, invader.hp - stack.damage);
      any = true;
      if (invader.hp <= 0) { invader.die(); return false; }
    }
    return true;
  });
  if (any) updateBurnVisual(invader);
}

export function updateBurnVisual(invader: Invader): void {
  const n = invader.burnStacks.length;
  invader.burnAura.clear();
  if (n === 0) { invader.burnLabel.setText(''); return; }

  const r     = invader.def.radius + 3;
  const alpha = 0.25 + n * 0.18;   // 0.43 / 0.61 / 0.79
  const color = n < 3 ? 0xff6600 : 0xff2200;
  invader.burnAura.fillStyle(color, alpha);
  invader.burnAura.fillCircle(invader.x, invader.y, r + n * 2);

  const icons = '🔥'.repeat(n);
  invader.burnLabel
    .setText(icons)
    .setPosition(invader.x - n * 6, invader.y - invader.def.radius - 22);
}

// ─── Root visual ──────────────────────────────────────────────────────────────

export function drawRootGraphic(invader: Invader): void {
  if (!invader.rootGraphic) return;
  invader.rootGraphic.clear();
  invader.rootGraphic.lineStyle(2, 0x7a4500, 0.9);
  invader.rootGraphic.strokeCircle(invader.x, invader.y, invader.def.radius + 4);
  invader.rootGraphic.lineStyle(1.5, 0xa06020, 0.6);
  invader.rootGraphic.strokeCircle(invader.x, invader.y, invader.def.radius + 9);
}

export function clearRootVisual(invader: Invader): void {
  invader.rootGraphic?.destroy();
  invader.rootGraphic = undefined;
}

// ─── Shield ───────────────────────────────────────────────────────────────────

export function initShield(invader: Invader): void {
  invader.hasShield           = true;
  invader.shieldHitsRemaining = 3;
  invader.shieldGraphic       = invader.scene.add.graphics().setDepth(invader.depth + 1);
}

export function drawShield(invader: Invader): void {
  if (!invader.shieldGraphic || !invader.hasShield) return;
  invader.shieldGraphic.clear();
  invader.shieldGraphic.lineStyle(2.5, 0x4488ff, 0.7);
  invader.shieldGraphic.beginPath();
  // Arc in front of invader (left side, since invaders move left)
  invader.shieldGraphic.arc(invader.x, invader.y, invader.def.radius + 5, -2.2, 2.2, false);
  invader.shieldGraphic.strokePath();
}

export function triggerShieldBreak(invader: Invader): void {
  // 12 blue/silver shards
  for (let i = 0; i < 12; i++) {
    const shard = invader.scene.add.graphics().setDepth(invader.depth + 2);
    shard.fillStyle(i % 2 === 0 ? 0x4488ff : 0xaaccff, 1);
    shard.fillRect(-2, -6, 4, 8);
    shard.setPosition(invader.x, invader.y);
    const angle = (i / 12) * Math.PI * 2;
    invader.scene.tweens.add({
      targets: shard,
      x: invader.x + Math.cos(angle) * 80,
      y: invader.y + Math.sin(angle) * 80,
      alpha: 0,
      angle: Phaser.Math.Between(-180, 180),
      duration: 420,
      onComplete: () => shard.destroy(),
    });
  }
  // White flash
  const flash = invader.scene.add.graphics().setDepth(invader.depth + 3);
  flash.fillStyle(0xffffff, 0.85);
  flash.fillCircle(invader.x, invader.y, invader.def.radius + 8);
  invader.scene.tweens.add({
    targets: flash, alpha: 0, duration: 200,
    onComplete: () => flash.destroy(),
  });
  invader.shieldGraphic?.destroy();
  invader.shieldGraphic = undefined;
  logger.debug(`[SHIELD BREAK] invader at (${Math.round(invader.x)},${Math.round(invader.y)})`);
}

// ─── Freeze visual ────────────────────────────────────────────────────────────

export function clearFreezeVisual(invader: Invader): void {
  invader.frozenGfx?.destroy();
  invader.frozenGfx = undefined;
}

// ─── Ice shatter (PERMAFROST death) ──────────────────────────────────────────

export function spawnIceShatter(invader: Invader): void {
  const cx = invader.x, cy = invader.y;
  // 12 ice shards fly outward
  for (let i = 0; i < 12; i++) {
    const shard = invader.scene.add.graphics().setDepth(invader.depth + 3);
    shard.fillStyle(i % 2 === 0 ? 0x88ddff : 0xccf0ff, 1);
    shard.fillTriangle(-3, -7, 3, -7, 0, 4);
    shard.setPosition(cx, cy);
    const angle = (i / 12) * Math.PI * 2;
    invader.scene.tweens.add({
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
  const ring = invader.scene.add.graphics().setDepth(invader.depth + 2);
  ring.lineStyle(3, 0x44ddff, 0.9);
  ring.strokeCircle(cx, cy, 10);
  invader.scene.tweens.add({
    targets: ring,
    scaleX: 8, scaleY: 8,
    alpha: 0,
    duration: 400,
    ease: 'Power2',
    onComplete: () => ring.destroy(),
  });
  // White flash
  const flash = invader.scene.add.graphics().setDepth(invader.depth + 2);
  flash.fillStyle(0xaaeeff, 0.75);
  flash.fillCircle(cx, cy, invader.def.radius + 8);
  invader.scene.tweens.add({
    targets: flash, alpha: 0, duration: 250,
    onComplete: () => flash.destroy(),
  });
}

// ─── Venom ────────────────────────────────────────────────────────────────────

export function triggerVenomBurst(invader: Invader): void {
  invader.venomStacks = 0;
  drawVenomStacks(invader);
  // Paralyzed
  if (invader.pathTween && !invader.isUnstoppable) {
    invader.pathTween.pause();
    invader.scene.time.delayedCall(2000, () => {
      if (!invader.active || invader.isDead) return;
      if (!invader.isStunned && !invader.isRooted && !invader.isFrozen && !invader.isCharmed)
        invader.pathTween?.resume();
    });
  }
  // 100 burst damage
  invader.takeDamage(100, false);
  // Visual: green explosion
  const g = invader.scene.add.graphics().setDepth(invader.depth + 3);
  g.fillStyle(0x00cc00, 0.7);
  g.fillCircle(invader.x, invader.y, invader.def.radius + 16);
  invader.scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
  logger.debug('[VENOM_BURST] paralyzed 2s + 100dmg');
}

export function drawVenomStacks(invader: Invader): void {
  invader.venomGfx?.destroy();
  if (invader.venomStacks <= 0) { invader.venomGfx = undefined; return; }
  invader.venomGfx = invader.scene.add.graphics().setDepth(invader.depth + 2);
  for (let i = 0; i < invader.venomStacks; i++) {
    invader.venomGfx.fillStyle(0x00bb00, 0.9);
    invader.venomGfx.fillCircle(invader.x - 8 + i * 4, invader.y - invader.def.radius - 8, 3);
  }
}

// ─── HP bar ───────────────────────────────────────────────────────────────────

export function updateHpBar(invader: Invader): void {
  const isBoss = invader.def.isBoss ?? false;
  const bw = isBoss ? 72 : 38;
  const bh = isBoss ? 8  : 5;
  const bx = invader.x - bw / 2;
  const by = invader.y - invader.def.radius - (isBoss ? 16 : 12);

  // Boss name label tracks position above bar
  if (invader.bossLabel) {
    invader.bossLabel.setPosition(invader.x, by - 2);
  }

  invader.hpBarBg.clear();
  invader.hpBarBg.fillStyle(0x000000, 0.75);
  invader.hpBarBg.fillRect(bx, by, bw, bh);
  invader.hpBarBg.lineStyle(0.5, COLORS.STONE_DARK, 0.6);
  invader.hpBarBg.strokeRect(bx, by, bw, bh);

  // Shield icon prefix on HP bar background when shielded
  const pct   = invader.hp / invader.maxHp;
  const color = pct > 0.55 ? COLORS.MOSS_LIGHT : pct > 0.25 ? COLORS.TORCH_GOLD : COLORS.BLOOD_GLOW;
  invader.hpBarFill.clear();
  invader.hpBarFill.fillStyle(color, 1);
  invader.hpBarFill.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * pct), bh - 2);

  // Blue tint over bar when shielded
  if (invader.hasShield) {
    invader.hpBarFill.fillStyle(0x4488ff, 0.3);
    invader.hpBarFill.fillRect(bx + 1, by + 1, Math.max(0, (bw - 2) * pct), bh - 2);
  }

  // Crisis ring: pulsing red border when HP ≤ 10%
  if (pct <= 0.10 && !invader.isDead) {
    if (!invader.crisisRing) {
      invader.crisisRing = invader.scene.add.graphics().setDepth(invader.depth + 5);
      invader.crisisTween = invader.scene.tweens.add({
        targets: invader.crisisRing,
        alpha: { from: 0.9, to: 0.2 },
        duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    const r = invader.def.radius + 4;
    invader.crisisRing.clear();
    invader.crisisRing.lineStyle(2, 0xff2222, 1);
    invader.crisisRing.strokeCircle(invader.x, invader.y, r);
    invader.crisisRing.lineStyle(1, 0xff6666, 0.5);
    invader.crisisRing.strokeCircle(invader.x, invader.y, r + 3);
  } else if (invader.crisisRing && pct > 0.10) {
    invader.crisisTween?.stop();
    invader.crisisRing.destroy();
    invader.crisisRing  = undefined;
    invader.crisisTween = undefined;
  }
}

// ─── Idle breathing ───────────────────────────────────────────────────────────

export function startIdleBreathing(invader: Invader): void {
  invader.breathTween?.stop();
  invader.breathTween = invader.scene.tweens.add({
    targets: invader,
    scaleY: invader.baseScaleY * 1.035,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
    // randomize start offset so multiple invaders don't sync-breathe
    delay: Math.random() * 1400,
  });
}

// ─── Hit reaction ─────────────────────────────────────────────────────────────

export function playHitReaction(invader: Invader): void {
  // Kill prior hit tween + suspend breathing so they don't fight
  invader.hitTween?.stop();
  invader.breathTween?.stop();

  // If breathing hasn't started yet (first 500ms of life), capture the
  // current scale as base now. Prevents scale drift on early hits.
  if (!invader.breathTween) {
    invader.baseScaleX = invader.scaleX;
    invader.baseScaleY = invader.scaleY;
  }

  // White flash
  invader.setTintFill(0xffffff);
  invader.scene.time.delayedCall(60, () => {
    if (invader.active && !invader.isDead) invader.clearTint();
  });

  // Scale bump — 1.18× → base over 180ms (Back.easeOut for overshoot feel)
  invader.setScale(invader.baseScaleX * 1.18, invader.baseScaleY * 1.18);
  invader.hitTween = invader.scene.tweens.add({
    targets: invader,
    scaleX: invader.baseScaleX,
    scaleY: invader.baseScaleY,
    duration: 180,
    ease: 'Back.easeOut',
    onComplete: () => {
      // Resume breathing if not destroyed
      if (invader.active && !invader.isDead) {
        startIdleBreathing(invader);
      }
    },
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup(invader: Invader): void {
  clearStunVisual(invader);
  clearRootVisual(invader);
  clearFreezeVisual(invader);
  invader.stunTimer?.remove();
  invader.rootTimer?.remove();
  invader.freezeTimer?.remove();
  invader.charmedTimer?.remove();
  invader.burnAura.destroy();
  invader.burnLabel.destroy();
  invader.shieldGraphic?.destroy();
  invader.voidAura?.destroy();
  invader.charmedGfx?.destroy();
  invader.berserkerAura?.destroy();
  invader.hexGfx?.destroy();
  invader.slowGfx?.destroy();
  invader.slowGfx = undefined;
  invader.crisisTween?.stop();
  invader.crisisRing?.destroy();
  invader.crisisRing  = undefined;
  invader.crisisTween = undefined;
  invader.venomGfx?.destroy();
  invader.venomGfx = undefined;
  invader.submergeAura?.destroy();
  invader.submergeAura = undefined;
  invader.submergeTimer?.remove();
  invader.venomBurstTimer?.remove();
  invader.mirrorGfx?.destroy();
  invader.shadowRealmGfx?.destroy();
  invader.shadowRealmTimer?.remove();
  invader.bossAura?.destroy();
  invader.hpBarBg.destroy();
  invader.hpBarFill.destroy();
  invader.bossLabel?.destroy();
  invader.hitTween?.stop();
  invader.breathTween?.stop();
  if (invader.active) invader.destroy();
}

// ─── Die ──────────────────────────────────────────────────────────────────────

export function die(invader: Invader): void {
  if (invader.isDead) return;

  // ── REVIVE_ONCE intercept ────────────────────────────────────────────────
  if (invader.canRevive && !invader.hasRevived) {
    invader.hasRevived = true;
    invader.hp = Math.round(invader.maxHp * 0.4);

    // Pause movement during revive
    invader.pathTween.pause();
    if (invader.isStunned || invader.isRooted) {
      invader.isStunned = false;
      invader.isRooted  = false;
      clearStunVisual(invader);
      clearRootVisual(invader);
      invader.stunTimer?.remove();
      invader.rootTimer?.remove();
    }

    // Red lightning burst
    for (let i = 0; i < 8; i++) {
      const bolt = invader.scene.add.graphics().setDepth(invader.depth + 3);
      bolt.lineStyle(2, 0xff2200, 1);
      const angle = (i / 8) * Math.PI * 2;
      const ex    = Math.cos(angle) * 40;
      const ey    = Math.sin(angle) * 40;
      bolt.lineBetween(invader.x, invader.y, invader.x + ex, invader.y + ey);
      invader.scene.tweens.add({
        targets: bolt, alpha: 0, duration: 300,
        onComplete: () => bolt.destroy(),
      });
    }

    // Dark red flash on body
    const flash = invader.scene.add.graphics().setDepth(invader.depth + 2);
    flash.fillStyle(0xff0000, 0.7);
    flash.fillCircle(invader.x, invader.y, invader.def.radius + 6);
    invader.scene.tweens.add({
      targets: flash, alpha: 0, duration: 350,
      onComplete: () => flash.destroy(),
    });

    // Rise animation: sink down then pop back up
    invader.scene.tweens.add({
      targets: invader,
      y: invader.y + 20,
      duration: 200, ease: 'Power1',
      onComplete: () => {
        invader.scene.tweens.add({
          targets: invader,
          y: invader.y - 20, scaleX: 1.3, scaleY: 1.3,
          duration: 400, ease: 'Back.Out',
          onComplete: () => {
            invader.setScale(1);
            if (!invader.isDead && invader.active) invader.pathTween.resume();
          },
        });
      },
    });

    logger.debug(`[REVIVE] undying at (${Math.round(invader.x)},${Math.round(invader.y)}) revives to ${invader.hp} HP`);
    return;   // do NOT die
  }

  // ── Normal death ─────────────────────────────────────────────────────────
  invader.isDead = true;
  const wasfrozen = invader.isFrozen;

  // Un-pause path so cleanup can proceed
  if (invader.isStunned || invader.isRooted || invader.isFrozen || invader.isCharmed) {
    invader.isStunned = false;
    invader.isRooted  = false;
    invader.isFrozen  = false;
    invader.isCharmed = false;
    invader.pathTween.timeScale = 1;
    invader.pathTween.resume();
    clearStunVisual(invader);
    clearRootVisual(invader);
    clearFreezeVisual(invader);
    invader.stunTimer?.remove();
    invader.rootTimer?.remove();
    invader.freezeTimer?.remove();
    invader.charmedTimer?.remove();
  }
  // Remove hex on death (so DungeonScene knows to transfer it)
  if (invader.hexed) {
    invader.hexed           = false;
    invader.damageMultiplier = 1;
    invader.hexGfx?.destroy();
    invader.hexGfx = undefined;
  }
  invader.clearTint();

  // PERMAFROST shatter — emit before death fade so DungeonScene can react
  if (wasfrozen) {
    invader.scene.events.emit('permafrostShatter', invader);
    spawnIceShatter(invader);
  }

  invader.scene.tweens.add({
    targets: invader,
    alpha: 0, scaleX: 1.6, scaleY: 1.6,
    duration: 200, ease: 'Power2',
    onComplete: () => cleanup(invader),
  });

  invader.scene.events.emit('invaderKilled', invader);
}

// ─── preUpdate (Phaser override body) ────────────────────────────────────────

export function invaderPreUpdate(invader: Invader, time: number, _delta: number): void {
  if (!invader.active || invader.isDead) return;

  // Stun orbs orbit
  if (invader.isStunned && invader.stunOrbs.length) {
    const a0 = time / 400;
    invader.stunOrbs.forEach((orb, i) => {
      const a = a0 + (i * Math.PI * 2) / 3;
      orb.setPosition(
        invader.x + Math.cos(a) * 20,
        invader.y - invader.def.radius - 4 + Math.sin(a) * 8,
      );
    });
  }

  // Burn ticks + aura tracks position
  if (invader.burnStacks.length > 0) {
    processBurn(invader, time);
    updateBurnVisual(invader);
  } else {
    invader.burnAura.clear();
  }

  // Shield arc tracks position
  if (invader.hasShield) drawShield(invader);

  // Root rings track position
  if (invader.isRooted && invader.rootGraphic) drawRootGraphic(invader);

  // Freeze crystal aura tracks position
  if (invader.isFrozen && invader.frozenGfx) {
    invader.frozenGfx.clear();
    const pulse = 0.5 + 0.3 * Math.sin(time / 150);
    invader.frozenGfx.fillStyle(0x88ddff, 0.35);
    invader.frozenGfx.fillCircle(invader.x, invader.y, invader.def.radius + 4);
    invader.frozenGfx.lineStyle(2.5, 0x44ddff, pulse);
    invader.frozenGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 5);
    invader.frozenGfx.lineStyle(1.5, 0xaaeeff, pulse * 0.6);
    invader.frozenGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 10);
    // 4 ice crystal spikes
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + time / 1000;
      const r1 = invader.def.radius + 4;
      const r2 = invader.def.radius + 14;
      invader.frozenGfx.lineStyle(2, 0xccf0ff, 0.8);
      invader.frozenGfx.lineBetween(
        invader.x + Math.cos(a) * r1, invader.y + Math.sin(a) * r1,
        invader.x + Math.cos(a) * r2, invader.y + Math.sin(a) * r2,
      );
    }
  }

  // Charm visual — pink hearts orbit
  if (invader.isCharmed && invader.charmedGfx) {
    invader.charmedGfx.clear();
    invader.charmedGfx.fillStyle(0xff66bb, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = time / 300 + (i / 3) * Math.PI * 2;
      invader.charmedGfx.fillCircle(
        invader.x + Math.cos(a) * (invader.def.radius + 8),
        invader.y + Math.sin(a) * (invader.def.radius + 8) - 4,
        3,
      );
    }
  }

  // Hex visual — purple skull orbits hexed invader
  if (invader.hexed && invader.hexGfx) {
    invader.hexGfx.clear();
    const a = time / 500;
    const r = invader.def.radius + 10;
    invader.hexGfx.fillStyle(0xaa00ff, 0.85);
    invader.hexGfx.fillCircle(invader.x + Math.cos(a) * r, invader.y + Math.sin(a) * r, 4);
    invader.hexGfx.fillCircle(invader.x + Math.cos(a + Math.PI) * r, invader.y + Math.sin(a + Math.PI) * r, 3);
  }

  // Slow — cyan dashed ring pulses to signal reduced speed
  if (invader.isSlowed && invader.slowGfx) {
    invader.slowGfx.clear();
    const pulse = 0.35 + 0.25 * Math.sin(time / 220);
    invader.slowGfx.lineStyle(2.5, 0x44aaff, pulse + 0.25);
    invader.slowGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 6);
    invader.slowGfx.lineStyle(1.5, 0x88ccff, pulse);
    invader.slowGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 10);
    // 3 small blue diamond droplets above
    for (let i = 0; i < 3; i++) {
      const a = time / 600 + (i / 3) * Math.PI * 2;
      const r = invader.def.radius + 7;
      invader.slowGfx.fillStyle(0x44aaff, 0.7);
      invader.slowGfx.fillCircle(invader.x + Math.cos(a) * r, invader.y + Math.sin(a) * r - 2, 2.5);
    }
  }

  // Venom stack dots track position
  if (invader.venomStacks > 0 && invader.venomGfx) {
    invader.venomGfx.clear();
    for (let i = 0; i < invader.venomStacks; i++) {
      invader.venomGfx.fillStyle(0x00bb00, 0.9);
      invader.venomGfx.fillCircle(invader.x - 8 + i * 4, invader.y - invader.def.radius - 8, 3);
    }
  }

  // Submerge aura tracks position
  if (invader.isSubmerged && invader.submergeAura) {
    invader.submergeAura.clear();
    invader.submergeAura.fillStyle(0x003366, 0.35);
    invader.submergeAura.fillCircle(invader.x, invader.y, invader.def.radius + 8);
    invader.submergeAura.lineStyle(2, 0x0066cc, 0.6);
    invader.submergeAura.strokeCircle(invader.x, invader.y, invader.def.radius + 8);
  }

  // BERSERKER_RAGE — triggers below 50% HP: speed ×2 + red aura
  if (invader.hasBerserkerRage && !invader.berserkTriggered && invader.hp < invader.maxHp * 0.5) {
    invader.berserkTriggered = true;
    if (invader.pathTween) invader.pathTween.timeScale = 2;
    invader.berserkerAura = invader.scene.add.graphics().setDepth(invader.depth - 1);
    logger.debug('[BERSERKER_RAGE] triggered — speed ×2');
  }
  if (invader.berserkerAura) {
    invader.berserkerAura.clear();
    const pulse = 0.4 + 0.35 * Math.sin(time / 120);
    invader.berserkerAura.fillStyle(0xff2200, pulse * 0.5);
    invader.berserkerAura.fillCircle(invader.x, invader.y, invader.def.radius + 5);
    invader.berserkerAura.lineStyle(2, 0xff4400, pulse);
    invader.berserkerAura.strokeCircle(invader.x, invader.y, invader.def.radius + 6);
  }

  // Void aura — pulsing purple ring while in phase
  if (invader.voidAura) {
    invader.voidAura.clear();
    if (time < invader.voidPhaseUntil) {
      const pulse = 0.35 + 0.25 * Math.sin(time / 180);
      invader.voidAura.lineStyle(2.5, 0x9933ff, pulse);
      invader.voidAura.strokeCircle(invader.x, invader.y, invader.def.radius + 6);
      invader.voidAura.lineStyle(1.5, 0xcc66ff, pulse * 0.5);
      invader.voidAura.strokeCircle(invader.x, invader.y, invader.def.radius + 11);
    }
  }

  // Mirror shield visual
  if (invader.hasMirrorShield && invader.mirrorGfx) {
    invader.mirrorGfx.clear();
    const shimmer = 0.5 + 0.3 * Math.sin(time / 200);
    invader.mirrorGfx.fillStyle(0xc0c0ff, shimmer * 0.3);
    invader.mirrorGfx.fillCircle(invader.x, invader.y, invader.def.radius + 4);
    invader.mirrorGfx.lineStyle(1.5, 0xeeeeff, shimmer);
    invader.mirrorGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 5);
  }

  // Shadow realm visual
  if (invader.isInShadowRealm && invader.shadowRealmGfx) {
    invader.shadowRealmGfx.clear();
    const pulse = 0.3 + 0.2 * Math.sin(time / 150);
    invader.shadowRealmGfx.fillStyle(0x1a0030, pulse);
    invader.shadowRealmGfx.fillCircle(invader.x, invader.y, invader.def.radius + 8);
    invader.shadowRealmGfx.lineStyle(1.5, 0x6622aa, pulse + 0.2);
    invader.shadowRealmGfx.strokeCircle(invader.x, invader.y, invader.def.radius + 10);
  } else if (invader.shadowRealmGfx) {
    invader.shadowRealmGfx.clear();
  }

  // Boss aura — pulsing outer ring with phase-based color
  if (invader.bossAura) {
    invader.bossAura.clear();
    const r = invader.def.radius;
    const pulse = 0.3 + 0.25 * Math.sin(time / 300);
    const pulse2 = 0.2 + 0.15 * Math.sin(time / 500 + 1);

    // Phase-based color selection
    let auraColor = 0xffaa00; // default gold
    if (invader.def.type === 'dragon_king') {
      auraColor = invader.dragonPhase === 3 ? 0xff2200 : invader.dragonPhase === 2 ? 0xff6600 : 0xffaa00;
    } else if (invader.def.type === 'death_emissary') {
      auraColor = invader.ch4BossPhase >= 3 ? 0x660099 : invader.ch4BossPhase === 2 ? 0x993399 : 0x8800aa;
    } else if (invader.def.type === 'three_god_destroyer') {
      const colors = [0xcc8800, 0xff4400, 0x4400ff, 0x00ccff, 0xffffff];
      auraColor = colors[Math.min(invader.ch5BossPhase - 1, 4)];
    } else if (invader.def.type === 'eternal_emperor') {
      const colors = [0xd4af37, 0xff6600, 0x8844cc, 0xff0000];
      auraColor = colors[Math.min(invader.ch6BossPhase - 1, 3)];
    }

    // Outer pulsing ring
    invader.bossAura.lineStyle(3, auraColor, pulse);
    invader.bossAura.strokeCircle(invader.x, invader.y, r + 8);
    // Inner softer ring
    invader.bossAura.lineStyle(1.5, auraColor, pulse2);
    invader.bossAura.strokeCircle(invader.x, invader.y, r + 14);

    // Crown particles (4 dots orbiting above)
    const crownY = invader.y - r - 10;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + time / 800;
      const cx = invader.x + Math.cos(a) * (r * 0.5);
      const cy = crownY + Math.sin(a) * 3;
      invader.bossAura.fillStyle(auraColor, 0.6 + 0.3 * Math.sin(time / 200 + i));
      invader.bossAura.fillCircle(cx, cy, 2);
    }
  }

  updateHpBar(invader);
}
