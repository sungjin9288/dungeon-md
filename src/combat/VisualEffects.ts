import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { audioManager } from '../audio/AudioManager';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { INVADER_DEFS } from '../data/invaders';
import type { WaveSpec } from '../data/stages';
import type { WisdomBonuses } from '../data/wisdom';
import { logger } from '../utils/logger';

// ── Simple attack / hit visuals ─────────────────────────────────────────────

export function showAttackLine(
  scene: Phaser.Scene,
  x1: number, y1: number, x2: number, y2: number,
): void {
  const g = scene.add.graphics().setDepth(45);
  g.lineStyle(1.5, COLORS.TORCH_GOLD, 0.9);
  g.lineBetween(x1, y1, x2, y2);
  scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
}

export function showFirstStrikeEffect(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const t = scene.add.text(x, y - 10, '일격!', {
    fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
    color: CSS.TORCH_AMBER,
  }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({
    targets: t, y: y - 45, alpha: 0, duration: 700,
    onComplete: () => t.destroy(),
  });
}

export function showTrapRing(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const g = scene.add.graphics().setDepth(45);
  g.lineStyle(2, 0x9040e0, 0.9);
  g.strokeCircle(x, y, 20);
  scene.tweens.add({
    targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 400,
    onComplete: () => g.destroy(),
  });
}

export function showHolyBurst(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const g = scene.add.graphics().setDepth(45);
  g.lineStyle(2, 0xffd700, 0.9);
  g.strokeCircle(x, y, 18);
  g.fillStyle(0xffeebb, 0.3);
  g.fillCircle(x, y, 18);
  scene.tweens.add({
    targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 350,
    onComplete: () => g.destroy(),
  });
}

// ── Charm / crowd-control visuals ───────────────────────────────────────────

export function spawnCharmOrb(
  scene: Phaser.Scene,
  rx: number, ry: number, target: Invader,
): void {
  const orb = scene.add.graphics().setDepth(52);
  orb.fillStyle(0xff44aa, 1);
  orb.fillCircle(rx, ry, 6);
  scene.tweens.add({
    targets: orb,
    x: target.x, y: target.y,
    duration: 400, ease: 'Power2',
    onComplete: () => {
      orb.destroy();
      if (target.active) {
        target.applyCharm(3000);
        // Heart burst at impact
        const h = scene.add.text(target.x, target.y - 14, '💗', {
          fontFamily: 'sans-serif', fontSize: '16px',
        }).setOrigin(0.5).setDepth(53);
        scene.tweens.add({ targets: h, y: target.y - 44, alpha: 0, duration: 700,
          onComplete: () => h.destroy() });
      }
    },
  });
}

export function showTideWave(
  scene: Phaser.Scene,
  tx: number, ty: number,
): void {
  const g = scene.add.graphics().setDepth(50);
  g.lineStyle(2.5, 0x44aaff, 0.9);
  g.strokeCircle(tx, ty, 12);
  scene.tweens.add({ targets: g, scaleX: 3, scaleY: 3, alpha: 0, duration: 350,
    onComplete: () => g.destroy() });
  const t = scene.add.text(tx, ty - 18, '밀어냄!', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#44aaff',
  }).setOrigin(0.5).setDepth(51);
  scene.tweens.add({ targets: t, y: ty - 45, alpha: 0, duration: 500, onComplete: () => t.destroy() });
}

export function showMagicImmuneMiss(
  scene: Phaser.Scene,
  tx: number, ty: number,
): void {
  const t = scene.add.text(tx, ty - 16, 'IMMUNE', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
    backgroundColor: '#ffffff22',
  }).setOrigin(0.5).setDepth(53);
  scene.tweens.add({ targets: t, y: ty - 40, alpha: 0, duration: 500, onComplete: () => t.destroy() });
}

// ── Gold / XP / float text ──────────────────────────────────────────────────

export function showGoldFloat(
  scene: Phaser.Scene,
  text: string, x: number, y: number,
): void {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5).setDepth(95);
  scene.tweens.add({
    targets: t, y: y - 35, alpha: 0, duration: 900,
    onComplete: () => t.destroy(),
  });
}

export function showFloatText(
  scene: Phaser.Scene,
  x: number, y: number, text: string, color: string,
): void {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color,
    stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(99);
  scene.tweens.add({
    targets: t, y: y - 30, alpha: { from: 1, to: 0 },
    duration: 800, ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

export function showXpToast(
  scene: Phaser.Scene,
  msg: string,
): void {
  const t = scene.add.text(CANVAS_WIDTH / 2, 120, `⬆ LEVEL UP! ${msg}`, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: '#ffdd44', stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(350).setAlpha(0);
  scene.tweens.add({
    targets: t, alpha: 1, y: 100, duration: 300, ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({ targets: t, alpha: 0, y: 80, duration: 400, delay: 1200,
        onComplete: () => t.destroy() });
    },
  });
}

// ── Heal visual ─────────────────────────────────────────────────────────────

export function showHealEffect(
  scene: Phaser.Scene,
  healer: Invader, target: Invader, amount: number,
): void {
  // Green beam from healer -> target
  const beam = scene.add.graphics().setDepth(46);
  beam.lineStyle(2, 0x44ff44, 1);
  beam.lineBetween(healer.x, healer.y, target.x, target.y);
  scene.tweens.add({ targets: beam, alpha: 0, duration: 400, onComplete: () => beam.destroy() });

  // "+N" float above target
  const t = scene.add.text(target.x, target.y - 20, `+${amount}`, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#44ff44',
  }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({ targets: t, y: target.y - 50, alpha: 0, duration: 600, onComplete: () => t.destroy() });

  // Green cross on target
  const cross = scene.add.text(target.x + 12, target.y - 12, '✚', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#44ff44',
  }).setOrigin(0.5).setDepth(51);
  scene.tweens.add({
    targets: cross, scaleX: { from: 0, to: 1 }, scaleY: { from: 0, to: 1 },
    duration: 150, yoyo: true, hold: 200,
    onComplete: () => cross.destroy(),
  });
}

// ── Aura / persistent visuals ───────────────────────────────────────────────

export function showHolyPaladinAura(
  scene: Phaser.Scene,
  inv: Invader,
): void {
  const aura = scene.add.graphics().setDepth(inv.depth - 1);
  const step = () => {
    if (!inv.active) { aura.destroy(); return; }
    const remaining = inv.magicImmuneUntil - scene.time.now;
    if (remaining <= 0) { aura.destroy(); return; }
    const alpha = Math.min(0.6, remaining / 3000) * 0.8;
    aura.clear();
    aura.lineStyle(2.5, 0xffffff, alpha);
    aura.strokeCircle(inv.x, inv.y, inv.def.radius + 8);
    aura.fillStyle(0xffffff, alpha * 0.15);
    aura.fillCircle(inv.x, inv.y, inv.def.radius + 8);
    scene.time.delayedCall(80, step);
  };
  step();
}

// ── Soul harvest execution visual ───────────────────────────────────────────

export function showSoulHarvestExec(
  scene: Phaser.Scene,
  x: number, y: number,
): void {
  const g = scene.add.graphics().setDepth(55);
  g.fillStyle(0x400060, 0.9);
  g.fillCircle(x, y, 28);
  scene.tweens.add({ targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 500,
    onComplete: () => g.destroy() });
  const t = scene.add.text(x, y - 20, '💀 처형 +5💰', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#cc88ff',
  }).setOrigin(0.5).setDepth(56);
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
}

// ── Dragon roar (needs active invaders for slow) ────────────────────────────

export function triggerDragonRoar(
  scene: Phaser.Scene,
  x: number, y: number,
  activeInvaders: Invader[],
): void {
  scene.cameras.main.shake(300, 0.015);
  const flash = scene.add.graphics().setDepth(60);
  flash.lineStyle(3, 0xff4400, 0.9);
  flash.strokeCircle(x, y, 20);
  scene.tweens.add({ targets: flash, scaleX: 5, scaleY: 5, alpha: 0, duration: 500, onComplete: () => flash.destroy() });

  // Slow all invaders 50% for 3s
  for (const inv of activeInvaders)
    if (inv.active) inv.applySlow(0.5, 3000);

  const t = scene.add.text(x, y - 24, '🐲 포효!', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ff8844',
  }).setOrigin(0.5).setDepth(56);
  scene.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  logger.debug('[DRAGONS_ROAR] all invaders slowed 50% for 3s');
}

// ── Wisdom toast (needs bonuses) ────────────────────────────────────────────

export function showWisdomToast(
  scene: Phaser.Scene,
  wisdomBonuses: WisdomBonuses,
): void {
  const b = wisdomBonuses;
  const lines: string[] = [];
  if (b.startingGold   > 0) lines.push(`💰 시작 골드 +${b.startingGold}`);
  if (b.dungeonMaxHpBonus > 0) lines.push(`🏰 던전 HP +${b.dungeonMaxHpBonus}`);
  if (b.roomCostMult   < 1) lines.push(`🔨 방 비용 -${Math.round((1 - b.roomCostMult) * 100)}%`);
  if (b.waveRewardMult > 1) lines.push(`⚡ 웨이브 보상 +${Math.round((b.waveRewardMult - 1) * 100)}%`);
  if (b.extraSlots     > 0) lines.push(`📜 추가 슬롯 +${b.extraSlots}`);
  if (b.crystalEarnMult > 1) lines.push(`💎 수정 획득 +${Math.round((b.crystalEarnMult - 1) * 100)}%`);
  if (b.monsterDmgMult < 1) lines.push(`🛡 몬스터 피해 -${Math.round((1 - b.monsterDmgMult) * 100)}%`);
  if (b.monsterAtkMult > 1) lines.push(`⚔️ 몬스터 공격 +${Math.round((b.monsterAtkMult - 1) * 100)}%`);
  if (b.crystalPerWave > 0) lines.push(`💎 웨이브 수정 +${b.crystalPerWave}`);
  if (b.fortressHp     > 0) lines.push(`🏯 요새 HP +${b.fortressHp}`);
  if (lines.length === 0) return;

  const toast = scene.add.text(CANVAS_WIDTH / 2, 98, `⛩ 선조의 가호\n${lines.join('  ')}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#c070ff',
    align: 'center', backgroundColor: '#0d0a1a',
    padding: { x: 10, y: 6 },
    wordWrap: { width: 340 },
  }).setOrigin(0.5, 0).setDepth(200).setAlpha(0);

  scene.tweens.add({
    targets: toast, alpha: 1, duration: 300,
    onComplete: () => {
      scene.tweens.add({
        targets: toast, alpha: 0, duration: 400, delay: 2500,
        onComplete: () => toast.destroy(),
      });
    },
  });
}

// ── Boss warning cinematic ──────────────────────────────────────────────────

export interface BossWarningConfig {
  readonly waveConfigs: readonly WaveSpec[];
  readonly wave: number;
  readonly isEndless: boolean;
  readonly buildBossHpBar: (hp: number) => void;
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
  const bossHp   = bossDef?.hp ?? (isEndless ? 200 + wave * 30 : 350);

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

  // 0ms: BGM slowdown + dark overlay
  audioManager.rampBpm(80, 1.5);

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

  // 2700ms: Zoom restore + BGM accelerate + overlay fade
  scene.time.delayedCall(2700, () => {
    cam.zoomTo(1.0, 500, 'Sine.easeOut');
    audioManager.rampBpm(130, 2);
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
