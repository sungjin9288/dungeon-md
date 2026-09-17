// ─── Impact VFX ───────────────────────────────────────────────────────────────
// Large "moment" visual effects extracted from VisualEffects.ts.
// These are cinematic / high-stakes animations — boss entrance, wave banner,
// kill reactions — as opposed to the small per-hit effects in VisualEffects.ts.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { COLORS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { INVADER_DEFS } from '../data/invaders';
import type { WaveSpec } from '../data/stages';
import { logger } from '../utils/logger';

// ── Boss warning cinematic ──────────────────────────────────────────────────

export interface BossWarningConfig {
  readonly waveConfigs: readonly WaveSpec[];
  readonly wave: number;
  readonly isEndless: boolean;
  readonly buildBossHpBar: (hp: number) => void;
  /** Overrides the displayed/HUD boss HP (weekly boss totalHp). */
  readonly bossHpOverride?: number;
}

export function showBossWarning(
  scene: Phaser.Scene,
  config: BossWarningConfig,
): void {
  const { waveConfigs, wave, isEndless, buildBossHpBar } = config;
  const cam = scene.cameras.main;

  // Resolve boss info from current wave config
  const waveCfg = waveConfigs[wave - 1];
  const bossGrp = waveCfg?.invaders.find(i => i.isBoss);
  const bossDef = bossGrp ? INVADER_DEFS[bossGrp.type] : null;
  const endlessBossName = wave >= 50 ? '전설적 침략자' : wave >= 30 ? '고위 보스' : wave >= 20 ? '엘리트 보스' : '미니 보스';
  const bossName = bossDef?.koreanName ?? (isEndless ? endlessBossName : '보스');
  const bossHp   = config.bossHpOverride ?? bossDef?.hp ?? (isEndless ? 200 + wave * 30 : 350);

  // Boss-specific accent color (hex -> CSS string)
  const bossColorNum = bossDef?.color ?? 0xff2222;
  const bossColorCss = '#' + bossColorNum.toString(16).padStart(6, '0');

  // Boss emoji per type
  const BOSS_EMOJI: Record<string, string> = {
    fox_queen:          '🦊',
    dragon_king:        '🐉',
    death_emissary:     '💀',
    three_god_destroyer:'⛩️',
    eternal_emperor:    '👑',
  };
  const bossEmoji = (bossGrp ? BOSS_EMOJI[bossGrp.type] : null) ?? '⚔️';

  // Boss one-liner quote
  const BOSS_QUOTES: Record<string, string> = {
    fox_queen:           '내 꼬리 아홉 개가 너희를 집어삼킬 것이다.',
    dragon_king:         '이 바다의 모든 것은 내 것이다!',
    death_emissary:      '저승의 문은 이미 열렸다...',
    three_god_destroyer: '모든 것을 부숴버리겠다!!',
    eternal_emperor:     '영원히... 너희는 나를 이길 수 없다.',
  };
  const bossQuote = bossGrp ? (BOSS_QUOTES[bossGrp.type] ?? null) : null;

  // 0ms: dark overlay
  const overlay = scene.add.graphics().setDepth(198).setAlpha(0);
  overlay.fillStyle(0x000000, 0.75);
  overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 800 });

  // 300ms: Boss-colored vignette pulse (3x)
  const vignette = scene.add.graphics().setDepth(199).setAlpha(0);
  vignette.lineStyle(18, bossColorNum, 1);
  vignette.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.time.delayedCall(300, () => {
    scene.tweens.add({
      targets: vignette, alpha: { from: 0, to: 0.6 },
      duration: 350, yoyo: true, repeat: 2,
      onComplete: () => vignette.destroy(),
    });
  });

  // 800ms: Boss name card slide-in
  const cardH = bossQuote ? 100 : 80;
  const nameCard = scene.add.container(CANVAS_WIDTH + 220, CANVAS_HEIGHT / 2 - cardH / 2).setDepth(200);

  const cardBg = scene.add.graphics();
  cardBg.fillStyle(0x080808, 0.92);
  cardBg.fillRoundedRect(-170, 0, 340, cardH, 8);
  cardBg.lineStyle(2, bossColorNum, 0.9);
  cardBg.strokeRoundedRect(-170, 0, 340, cardH, 8);
  // Top accent stripe in boss color
  cardBg.fillStyle(bossColorNum, 0.7);
  cardBg.fillRoundedRect(-170, 0, 340, 4, { tl: 8, tr: 8, bl: 0, br: 0 });
  nameCard.add(cardBg);

  // Warning label
  const warningT = scene.add.text(0, 14, '⚠  보스 출현', {
    fontFamily: 'sans-serif', fontSize: '10px', color: bossColorCss,
    letterSpacing: 2,
  }).setOrigin(0.5);
  nameCard.add(warningT);

  // Emoji + Name
  const nameT = scene.add.text(0, 36, `${bossEmoji} ${bossName}`, {
    fontFamily: 'Georgia, serif', fontSize: '19px', fontStyle: 'bold', color: '#ffffff',
    shadow: { color: bossColorCss, blur: 10, fill: true },
  }).setOrigin(0.5);
  nameCard.add(nameT);

  // HP bar preview
  const hpLabel = scene.add.text(0, 62, `HP  ${bossHp.toLocaleString()}`, {
    fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
  }).setOrigin(0.5);
  nameCard.add(hpLabel);

  // Optional quote line
  if (bossQuote) {
    const quoteT = scene.add.text(0, 83, `"${bossQuote}"`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#cccccc',
      fontStyle: 'italic', wordWrap: { width: 300 },
    }).setOrigin(0.5, 0);
    nameCard.add(quoteT);
  }

  scene.time.delayedCall(800, () => {
    scene.tweens.add({
      targets: nameCard, x: CANVAS_WIDTH / 2,
      duration: 380, ease: 'Power2.easeOut',
    });
    audioManager.playSfx('boss_appear');
  });

  // 850ms: Camera shake
  scene.time.delayedCall(850, () => {
    cam.shake(700, 0.014);
  });

  // 1000ms: Camera zoom-in
  scene.time.delayedCall(1000, () => {
    cam.zoomTo(1.06, 1500, 'Sine.easeInOut');
  });

  // Camera boss-color flash
  const r = (bossColorNum >> 16) & 0xff;
  const g = (bossColorNum >> 8)  & 0xff;
  const b = bossColorNum          & 0xff;
  cam.flash(500, r, g, b);

  // 2500ms: Name card fade out
  scene.time.delayedCall(2500, () => {
    scene.tweens.add({
      targets: nameCard, alpha: 0, duration: 400,
      onComplete: () => nameCard.destroy(),
    });
  });

  // 2700ms: Zoom restore + overlay fade
  scene.time.delayedCall(2700, () => {
    cam.zoomTo(1.0, 500, 'Sine.easeOut');
    scene.tweens.add({
      targets: overlay, alpha: 0, duration: 600,
      onComplete: () => overlay.destroy(),
    });
  });

  logger.debug(`[BOSS] ${bossName} appears! HP: ${bossHp}`);
  buildBossHpBar(bossHp);
}

// ── Tiger Pounce slash line ─────────────────────────────────────────────────

export function showTigersPounce(
  scene: Phaser.Scene,
  rx: number, ry: number, tx: number, ty: number,
): void {
  const g = scene.add.graphics().setDepth(50);
  g.lineStyle(3, 0xe8a000, 0.9);
  g.lineBetween(rx, ry, tx, ty);
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  const t = scene.add.text(tx, ty - 16, '포효!', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#e8a000',
  }).setOrigin(0.5).setDepth(51);
  scene.tweens.add({ targets: t, y: ty - 45, alpha: 0, duration: 600, onComplete: () => t.destroy() });
}

// ── Rally Cry expanding ring ────────────────────────────────────────────────

export function showRallyCryEffect(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const g = scene.add.graphics().setDepth(50);
  g.lineStyle(2.5, 0xffcc00, 0.8);
  g.strokeCircle(x, y, 10);
  scene.tweens.add({ targets: g, scaleX: 20, scaleY: 20, alpha: 0, duration: 600,
    onComplete: () => g.destroy() });
  const t = scene.add.text(x, y - 18, '집결!', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#ffcc00',
  }).setOrigin(0.5).setDepth(51);
  scene.tweens.add({ targets: t, y: y - 48, alpha: 0, duration: 700, onComplete: () => t.destroy() });
}

// ── Boss kill reaction (slow-mo + flash + shake) ────────────────────────────
// Used by the invaderKilled event handler when a boss invader dies. The
// scene-level timeScale dip is restored via window.setTimeout (which is
// unaffected by timeScale itself).

/**
 * Only the newest slow-mo restores the clock. Without this, two boss kills
 * inside the 160ms window make the second capture the *dipped* scale as its
 * "previous" value and strand the battle at 0.15× forever (seen organically on
 * stage 90, whose late waves kill two titans in quick succession).
 */
let bossSlowMoToken = 0;

export const BOSS_SLOWMO_SCALE = 0.15;
export const BOSS_SLOWMO_MS = 160;

/**
 * `baseScale` is the battle's speed setting (DungeonScene.speedMult) — the
 * clock AND the tweens return to it, so a boss kill never silently drops a 3×
 * battle back to 1× motion.
 */
export function playBossKillReaction(scene: Phaser.Scene, baseScale = 1): void {
  // Brief slow-motion hit pause — 160ms at 0.15× speed.
  const token = ++bossSlowMoToken;
  scene.time.timeScale   = BOSS_SLOWMO_SCALE;
  scene.tweens.timeScale = BOSS_SLOWMO_SCALE;
  window.setTimeout(() => {
    if (!scene.scene.isActive() || token !== bossSlowMoToken) return;
    scene.time.timeScale   = baseScale;
    scene.tweens.timeScale = baseScale;
  }, BOSS_SLOWMO_MS);

  // Full-screen white flash
  const flash = scene.add.graphics().setDepth(295);
  flash.fillStyle(0xffffff, 0.55);
  flash.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({
    targets: flash, alpha: 0, duration: 280, ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy(),
  });

  // Dramatic shake
  scene.cameras.main.shake(380, 0.016);
}

// ── Kill combo edge tint + shake ────────────────────────────────────────────
// Called from the invaderKilled handler when killComboCount ≥ 5. The text
// itself is already produced by the caller; this helper only paints the
// screen-edge amber strips and (at 7+ combo) adds a small shake.

export function playKillComboEdgeFlash(
  scene:      Phaser.Scene,
  comboCount: number,
): void {
  if (comboCount < 5) return;
  const edge = scene.add.graphics().setDepth(288);
  const comboAlpha = Math.min(0.25, 0.10 + comboCount * 0.015);
  edge.fillStyle(0xff8800, comboAlpha);
  // Top + bottom strips only — subtler than full flash
  edge.fillRect(0, 0, CANVAS_WIDTH, 60);
  edge.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);
  scene.tweens.add({
    targets: edge, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
    onComplete: () => edge.destroy(),
  });
  if (comboCount >= 7) {
    scene.cameras.main.shake(180, 0.006);
  }
}

// ── Death particles (5 small squares scatter) ──────────────────────────────

export function spawnDeathParticles(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const pColors = [0xff4444, 0xff8844, 0xffcc44, 0xffffff, 0xcc4422];
  for (let pi = 0; pi < 5; pi++) {
    const pg = scene.add.graphics().setDepth(150);
    const angle = (pi / 5) * Math.PI * 2 + Math.random() * 0.5;
    const dist  = 18 + Math.random() * 18;
    pg.fillStyle(pColors[pi % pColors.length], 1);
    pg.fillRect(-3, -3, 5, 5);
    pg.setPosition(x, y);
    scene.tweens.add({
      targets: pg,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 10,
      alpha:  { from: 1, to: 0 },
      scaleX: { from: 1, to: 0 }, scaleY: { from: 1, to: 0 },
      duration: 320 + Math.random() * 160,
      ease: 'Power2',
      onComplete: () => pg.destroy(),
    });
  }
}

// ── Wave start banner ───────────────────────────────────────────────────────
// Centered scroll/banner that drops from the top of the screen at the start
// of each wave, holds for a moment, then retracts. The `onSettled` callback
// fires after the drop-in completes (used to trigger the enemy preview panel)
// so the caller can keep its own scene-specific hook.

export interface WaveStartBannerOptions {
  /** Label drawn inside the banner. */
  text:       string;
  /** CSS color for the label. */
  textColor:  string;
  /** Border color (hex) for the banner frame. */
  borderColor: number;
  /** Called once the banner has finished dropping in. Optional. */
  onSettled?: () => void;
}

export function playWaveStartBanner(
  scene: Phaser.Scene,
  opts:  WaveStartBannerOptions,
): void {
  const banner = scene.add.container(CANVAS_WIDTH / 2, -50).setDepth(250);
  const bannerBg = scene.add.graphics();
  bannerBg.fillStyle(0x0d0500, 0.92);
  bannerBg.fillRoundedRect(-155, -20, 310, 40, 6);
  bannerBg.lineStyle(1.5, opts.borderColor, 0.85);
  bannerBg.strokeRoundedRect(-155, -20, 310, 40, 6);
  banner.add(bannerBg);
  banner.add(scene.add.text(0, 0, opts.text, {
    fontFamily: 'Georgia, serif', fontSize: '15px',
    color: opts.textColor, fontStyle: 'bold',
  }).setOrigin(0.5));

  scene.tweens.add({
    targets: banner, y: 80, duration: 350, ease: 'Back.easeOut',
    onComplete: () => {
      opts.onSettled?.();
      scene.tweens.add({
        targets: banner, y: -50, delay: 1200, duration: 300, ease: 'Sine.easeIn',
        onComplete: () => banner.destroy(),
      });
    },
  });
}

// ── Endless record-broken flash ────────────────────────────────────────────
// Large "🏆 신기록!" text that fades in, drifts up, then fades out. Played
// the first time the current wave exceeds the player's saved endless PB.

export function playEndlessRecordFlash(scene: Phaser.Scene): void {
  const rt = scene.add.text(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, '🏆 신기록!',
    {
      fontFamily: 'Georgia, serif', fontSize: '28px',
      color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    },
  ).setOrigin(0.5).setDepth(300).setAlpha(0);

  scene.tweens.add({
    targets: rt, alpha: 1, y: rt.y - 30, duration: 600, ease: 'Back.easeOut',
    onComplete: () => scene.tweens.add({
      targets: rt, alpha: 0, delay: 1200, duration: 400,
      onComplete: () => rt.destroy(),
    }),
  });
}

// ── Invader spawn entrance ──────────────────────────────────────────────────
// Pure VFX played the moment a new Invader is added to the path. Regular
// invaders get a small scale pop; bosses get a screen shake + red flash, an
// oversized scale pop, and a "⚠ BOSS" banner that fades up then drifts away.

export function playInvaderSpawnEntrance(
  scene:  Phaser.Scene,
  inv:    Invader,
  isBoss: boolean,
): void {
  if (!isBoss) {
    inv.setScale(1.6).setAlpha(0);
    scene.tweens.add({
      targets: inv, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 180, ease: 'Back.easeOut',
    });
    return;
  }

  // ── Boss entrance ───────────────────────────────────────────────────────
  scene.cameras.main.shake(360, 0.012);
  const flash = scene.add.graphics().setDepth(290);
  flash.fillStyle(0xff2200, 0.45);
  flash.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({
    targets: flash, alpha: 0, duration: 450,
    onComplete: () => flash.destroy(),
  });

  // Oversized scale pop
  inv.setScale(2.8).setAlpha(0);
  scene.tweens.add({
    targets: inv, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 420, ease: 'Back.easeOut',
  });

  // "⚠ BOSS" banner: scale-in then drift up + fade
  const bossT = scene.add.text(inv.x, inv.y - 40, '⚠ BOSS', {
    fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
    color: '#ff4444', stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5).setDepth(300).setAlpha(0).setScale(0.5);
  scene.tweens.add({
    targets: bossT, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 280, ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: bossT, alpha: 0, y: bossT.y - 30,
        duration: 700, delay: 400,
        onComplete: () => bossT.destroy(),
      });
    },
  });
}

// ── Dungeon HP hit reaction (red vignette + shake) ─────────────────────────
// Played whenever the player's dungeon takes damage from a breakthrough or
// reflected hit. `hpRatio` is the fraction of max HP just lost — bigger hits
// shake harder (capped).

export function playDungeonHpHitReaction(
  scene:   Phaser.Scene,
  hpRatio: number,
): void {
  // Red vignette flash on HP loss
  const vf = scene.add.graphics().setDepth(280).setAlpha(0.4);
  vf.fillStyle(COLORS.BLOOD_RED, 0.4);
  vf.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({ targets: vf, alpha: 0, duration: 500, onComplete: () => vf.destroy() });

  // Camera shake — stronger for big hits
  const shakeIntensity = Math.min(0.025, 0.006 + hpRatio * 0.8);
  scene.cameras.main.shake(300, shakeIntensity);
}

// ── Low-HP vignette (pulsing red border when HP < 30%) ─────────────────────
// Returns the new value for the caller's `lowHpVignette` reference:
//   - Creates and starts the tween when HP drops below 30% for the first time.
//   - Destroys and returns undefined when HP recovers to 30%+.
//   - No-ops (returns current) when already in the right state.

export function updateLowHpVignette(
  scene:   Phaser.Scene,
  pct:     number,
  current: Phaser.GameObjects.Graphics | undefined,
): Phaser.GameObjects.Graphics | undefined {
  if (pct < 0.3 && !current) {
    const vg = scene.add.graphics().setDepth(291).setAlpha(0);
    vg.fillStyle(COLORS.BLOOD_RED, 1);
    vg.fillRect(0, 0, CANVAS_WIDTH, 18);
    vg.fillRect(0, CANVAS_HEIGHT - 18, CANVAS_WIDTH, 18);
    vg.fillRect(0, 0, 18, CANVAS_HEIGHT);
    vg.fillRect(CANVAS_WIDTH - 18, 0, 18, CANVAS_HEIGHT);
    scene.tweens.add({
      targets: vg,
      alpha: { from: 0.15, to: 0.55 },
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    return vg;
  }
  if (pct >= 0.3 && current) {
    current.destroy();
    return undefined;
  }
  return current;
}
