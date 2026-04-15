// ─── Late Boss Behaviors ──────────────────────────────────────────────────────
// Ch5-Ch7 boss setup functions extracted from BossBehaviors.ts.
// "Late" = post-game-chapter-4 bosses that rely on showHolyBurst, flashCelestialScreen,
// and multi-phase mechanics beyond the early boss set.
//
// Imports showBossPhaseText and buildBossHpBar from BossBehaviors.ts (shared helpers).
// BossHud.update() is driven by the scene per-frame loop — no updateBossHpBar call needed.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { showHolyBurst } from './VisualEffects';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_X, GRID_Y, GRID_ROWS } from '../constants/layout';
import { logger } from '../utils/logger';
import type { BossContext } from './BossBehaviors';
import { showBossPhaseText, buildBossHpBar } from './BossBehaviors';

// ─── Three God Destroyer (Ch5) ────────────────────────────────────────────────

export function setupThreeGodDestroyer(ctx: BossContext, inv: Invader): void {
  const { scene, activeInvaders, roomGrid } = ctx;
  buildBossHpBar(ctx, inv.maxHp);

  let phase5 = 1;
  const phaseColors = [0xff4444, 0xff8800, 0xffff00, 0x44ff88, 0xaa00ff];
  const phaseNames  = ['화염', '번개', '공허', '독', '신성'];

  const checkPhase5 = () => {
    if (!inv.active) return;
    const pct        = inv.hp / inv.maxHp;
    const thresholds = [0.80, 0.60, 0.40, 0.20];
    if (phase5 <= 4 && pct <= thresholds[phase5 - 1]) {
      phase5++;
      inv.ch5BossPhase = phase5;
      const color = phaseColors[phase5 - 1];
      const name  = phaseNames[phase5 - 1];
      showBossPhaseText(ctx, inv, phase5, `⛰️ ${name} 단계!`, color);
      scene.cameras.main.shake(600, 0.03);
      scene.cameras.main.flash(400, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false);

      switch (phase5) {
        case 2: // Lightning: chain lightning every 10s
          scene.time.addEvent({
            delay: 10000, repeat: -1,
            callback: () => {
              if (!inv.active || inv.ch5BossPhase < 2) return;
              const nearest = activeInvaders.filter(i => i !== inv && i.active)[0];
              if (nearest) ctx.triggerChainLightning(nearest, 60, 5);
            },
          });
          break;
        case 3: // Void: teleport every 15s
          scene.time.addEvent({
            delay: 15000, repeat: -1,
            callback: () => {
              if (!inv.active || inv.ch5BossPhase < 3) return;
              inv.setAlpha(0);
              const cs = ctx.effectiveCellSize;
              inv.setPosition(GRID_X + cs / 2, GRID_Y + (GRID_ROWS - 1) * cs + cs / 2);
              scene.tweens.add({ targets: inv, alpha: 1, duration: 300 });
              logger.debug('[THREE_GOD] phase 3 void teleport');
            },
          });
          break;
        case 4: // Venom: burn all rooms every 20s
          scene.time.addEvent({
            delay: 20000, repeat: -1,
            callback: () => {
              if (!inv.active || inv.ch5BossPhase < 4) return;
              for (const r of roomGrid)
                for (const d of r)
                  if (d) d.roomHp = Math.max(0, d.roomHp - 40);
              const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, '🐍 독 홍수!', {
                fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cc00',
                backgroundColor: '#001400', padding: { x: 10, y: 5 },
              }).setOrigin(0.5).setDepth(260).setAlpha(0);
              scene.tweens.add({
                targets: t, alpha: 1, duration: 300,
                onComplete: () => scene.tweens.add({
                  targets: t, alpha: 0, duration: 400, delay: 1200, onComplete: () => t.destroy(),
                }),
              });
              logger.debug('[THREE_GOD] phase 4 venom flood — all rooms −40 HP');
            },
          });
          break;
        case 5: // Divine: heal + speed boost all invaders every 12s
          scene.time.addEvent({
            delay: 12000, repeat: -1,
            callback: () => {
              if (!inv.active || inv.ch5BossPhase < 5) return;
              for (const ai of activeInvaders)
                if (ai.active) { ai.receiveHeal(100); ai.applySpeedBoost(1.3, 8000); }
              const t = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, '✨ 신성 가호!', {
                fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffeeaa',
                backgroundColor: '#201000', padding: { x: 10, y: 5 },
              }).setOrigin(0.5).setDepth(260).setAlpha(0);
              scene.tweens.add({
                targets: t, alpha: 1, duration: 300,
                onComplete: () => scene.tweens.add({
                  targets: t, alpha: 0, duration: 400, delay: 1200, onComplete: () => t.destroy(),
                }),
              });
              logger.debug('[THREE_GOD] phase 5 divine blessing — all invaders +100HP +30% speed');
            },
          });
          break;
      }
      logger.debug(`[THREE_GOD_DESTROYER] phase ${phase5} (${name}) — HP ${Math.round(pct * 100)}%`);
    }
    scene.time.delayedCall(300, checkPhase5);
  };
  checkPhase5();

  logger.debug('[THREE_GOD_DESTROYER] setup complete — 5-phase final boss');
}

// ─── Shadow Realm (Ch6) ───────────────────────────────────────────────────────

export function setupShadowRealm(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  inv.shadowRealmGfx = scene.add.graphics().setDepth(inv.depth - 1);
  const phaseIn = () => {
    if (inv.isDead || !inv.active) return;
    inv.isInShadowRealm = true;
    inv.isDamageImmune   = true;
    scene.tweens.add({ targets: inv, alpha: 0.15, duration: 300 });
    scene.time.delayedCall(2000, () => {
      if (inv.isDead || !inv.active) return;
      inv.isInShadowRealm = false;
      inv.isDamageImmune   = false;
      scene.tweens.add({ targets: inv, alpha: 1, duration: 300 });
    });
  };
  inv.shadowRealmTimer = scene.time.addEvent({ delay: 8000, callback: phaseIn, loop: true });
}

// ─── flashCelestialScreen (module-private) ────────────────────────────────────

function flashCelestialScreen(scene: Phaser.Scene, colorHex: number = 0xffd700): void {
  const flash = scene.add.graphics().setDepth(260).setAlpha(0);
  flash.fillStyle(colorHex, 0.45);
  flash.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({
    targets: flash, alpha: 1, duration: 120, yoyo: true, hold: 80,
    onComplete: () => flash.destroy(),
  });
}

// ─── spawnGoldParticles (module-private) ──────────────────────────────────────

function spawnGoldParticles(scene: Phaser.Scene, x: number, y: number, count: number = 10): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const g = scene.add.graphics().setDepth(255);
    g.fillStyle(0xffd700, 1);
    g.fillCircle(x, y, 3);
    scene.tweens.add({
      targets: g,
      x: x + Math.cos(angle) * 55,
      y: y + Math.sin(angle) * 55,
      alpha: 0, scaleX: 0.3, scaleY: 0.3,
      duration: 550, ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }
}

// ─── God Emperor (Ch7 final boss) ─────────────────────────────────────────────

export function setupGodEmperor(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  buildBossHpBar(ctx, inv.maxHp);

  // Phase 1: mirror shield (5 hits) + magic immune
  inv.isMagicImmune       = true;
  inv.hasMirrorShield     = true;
  inv.mirrorHitsRemaining = 5;
  inv.mirrorGfx           = scene.add.graphics().setDepth(inv.depth + 1);

  const checkPhase = () => {
    if (inv.isDead || !inv.active) return;
    const pct = inv.hp / inv.maxHp;

    // ── Phase 2: 65% HP — celestial shield, spawn guards ──────────────────
    if (pct <= 0.65 && inv.ch6BossPhase < 2) {
      inv.ch6BossPhase = 2;

      // 4s magic immunity burst
      inv.isMagicImmune = true;
      scene.time.delayedCall(4000, () => { if (!inv.isDead) inv.isMagicImmune = false; });

      // Spawn 2 divine_archers in succession
      for (let i = 0; i < 2; i++)
        scene.time.delayedCall(i * 600, () => ctx.spawnInvader('divine_archer'));

      showBossPhaseText(ctx, inv, 2, '👑 2단계 — 천상의 방패!', 0xffd700);
      flashCelestialScreen(scene, 0xffd700);
      scene.cameras.main.shake(300, 0.008);
      for (let i = 0; i < 5; i++)
        scene.time.delayedCall(i * 80, () => showHolyBurst(scene, inv.x, inv.y));
      spawnGoldParticles(scene, inv.x, inv.y, 12);
    }

    // ── Phase 3: 35% HP — divine rage, speed up, dragon descends ──────────
    if (pct <= 0.35 && inv.ch6BossPhase < 3) {
      inv.ch6BossPhase = 3;

      // Speed boost: 30% faster
      if (inv.pathTween) {
        const rem = inv.pathTween.duration - inv.pathTween.elapsed;
        inv.pathTween.duration = inv.pathTween.elapsed + rem * 0.7;
      }

      // Periodic 3s magic immunity every 12s
      scene.time.addEvent({
        delay: 12000, loop: true,
        callback: () => {
          if (inv.isDead || !inv.active) return;
          inv.isMagicImmune = true;
          ctx.showFloatText(inv.x, inv.y - 30, '✨ 신성 방어', '#ffd700');
          scene.time.delayedCall(3000, () => { if (!inv.isDead) inv.isMagicImmune = false; });
        },
      });

      ctx.spawnInvader('celestial_dragon');
      scene.time.delayedCall(800, () => ctx.spawnInvader('heaven_general'));

      showBossPhaseText(ctx, inv, 3, '🐉 3단계 — 천룡 강림!', 0xff8800);
      flashCelestialScreen(scene, 0xff8800);
      scene.cameras.main.shake(500, 0.014);
      spawnGoldParticles(scene, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 20);
      for (let i = 0; i < 4; i++)
        scene.time.delayedCall(i * 120, () => showHolyBurst(scene, inv.x, inv.y));
    }

    // ── Phase 4: 10% HP — final stand, rapid damage immunity ──────────────
    if (pct <= 0.10 && inv.ch6BossPhase < 4) {
      inv.ch6BossPhase = 4;

      // Speed boost: 50% faster total
      if (inv.pathTween) {
        const rem = inv.pathTween.duration - inv.pathTween.elapsed;
        inv.pathTween.duration = inv.pathTween.elapsed + rem * 0.5;
      }

      // Damage immunity cycle: 2s immune every 6s
      scene.time.addEvent({
        delay: 6000, loop: true,
        callback: () => {
          if (inv.isDead || !inv.active) return;
          inv.isDamageImmune = true;
          ctx.showFloatText(inv.x, inv.y - 30, '🛡️ 불사', '#ffffff');
          scene.time.delayedCall(2000, () => { if (!inv.isDead) inv.isDamageImmune = false; });
        },
      });

      showBossPhaseText(ctx, inv, 4, '☀️ 4단계 — 천제 최후의 강림!!', 0xffffff);
      flashCelestialScreen(scene, 0xffffff);
      scene.cameras.main.shake(700, 0.020);
      for (let i = 0; i < 6; i++)
        scene.time.delayedCall(i * 100, () => {
          showHolyBurst(
            scene,
            inv.x + Phaser.Math.Between(-30, 30),
            inv.y + Phaser.Math.Between(-30, 30),
          );
        });
      spawnGoldParticles(scene, inv.x, inv.y, 18);
    }

    scene.time.delayedCall(400, checkPhase);
  };
  scene.time.delayedCall(1000, checkPhase);
}

// ─── Eternal Emperor (Ch6) ────────────────────────────────────────────────────

export function setupEternalEmperor(ctx: BossContext, inv: Invader): void {
  const { scene } = ctx;
  buildBossHpBar(ctx, inv.maxHp);

  // Phase 1: mirror shield active
  inv.hasMirrorShield     = true;
  inv.mirrorHitsRemaining = 3;
  inv.mirrorGfx           = scene.add.graphics().setDepth(inv.depth + 1);

  const checkPhase = () => {
    if (inv.isDead || !inv.active) return;
    const pct = inv.hp / inv.maxHp;

    // Phase 2: 70% HP — summon titan_sentinel adds
    if (pct <= 0.7 && inv.ch6BossPhase < 2) {
      inv.ch6BossPhase = 2;
      for (let i = 0; i < 2; i++)
        scene.time.delayedCall(i * 500, () => ctx.spawnInvader('titan_sentinel'));
    }

    // Phase 3: 40% HP — activate shadow realm cycle
    if (pct <= 0.4 && inv.ch6BossPhase < 3) {
      inv.ch6BossPhase = 3;
      setupShadowRealm(ctx, inv);
    }

    // Phase 4: 15% HP — enrage
    if (pct <= 0.15 && inv.ch6BossPhase < 4) {
      inv.ch6BossPhase = 4;
      if (inv.pathTween) {
        const remaining = inv.pathTween.duration - inv.pathTween.elapsed;
        inv.pathTween.duration = inv.pathTween.elapsed + remaining * 0.5;
      }
      scene.time.addEvent({
        delay: 5000, loop: true,
        callback: () => {
          if (inv.isDead || !inv.active) return;
          inv.isDamageImmune = true;
          scene.time.delayedCall(1000, () => { if (!inv.isDead) inv.isDamageImmune = false; });
        },
      });
    }

    scene.time.delayedCall(400, checkPhase);
  };
  scene.time.delayedCall(1000, checkPhase);
}
