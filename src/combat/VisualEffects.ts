import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import type { WisdomBonuses } from '../data/wisdom';
import { logger } from '../utils/logger';

// ── Simple attack / hit visuals ─────────────────────────────────────────────

export function showAttackLine(
  scene: Phaser.Scene,
  x1: number, y1: number, x2: number, y2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const px = -ny;
  const py = nx;

  const slash = scene.add.graphics().setDepth(46);
  slash.lineStyle(4, COLORS.TORCH_GLOW, 0.28);
  slash.lineBetween(x1, y1, x2, y2);
  slash.lineStyle(2, COLORS.TORCH_GOLD, 0.88);
  slash.lineBetween(x1, y1, x2, y2);
  slash.lineStyle(1, 0xfff2a8, 0.9);
  slash.lineBetween(x1 + px * 3, y1 + py * 3, x2 + px * 3, y2 + py * 3);

  const spark = scene.add.graphics().setDepth(48);
  spark.fillStyle(0xfff2a8, 0.96);
  spark.fillCircle(x2, y2, 3);
  spark.lineStyle(1.5, COLORS.TORCH_AMBER, 0.84);
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const sx = x2 + Math.cos(angle) * 4;
    const sy = y2 + Math.sin(angle) * 4;
    const ex = x2 + Math.cos(angle) * 14;
    const ey = y2 + Math.sin(angle) * 14;
    spark.lineBetween(sx, sy, ex, ey);
  }

  scene.tweens.add({
    targets: slash,
    alpha: 0,
    duration: 160,
    ease: 'Cubic.easeOut',
    onComplete: () => slash.destroy(),
  });
  scene.tweens.add({
    targets: spark,
    alpha: 0,
    scaleX: 1.7,
    scaleY: 1.7,
    duration: 220,
    ease: 'Cubic.easeOut',
    onComplete: () => spark.destroy(),
  });
}

export function showEquipmentStrike(
  scene: Phaser.Scene,
  x1: number, y1: number, x2: number, y2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const px = -ny;
  const py = nx;
  const midX = x1 + dx * 0.62;
  const midY = y1 + dy * 0.62;

  const g = scene.add.graphics().setDepth(49);
  g.lineStyle(2, 0xe8c468, 0.65);
  g.lineBetween(x1 + px * 5, y1 + py * 5, x2 + px * 5, y2 + py * 5);
  g.fillStyle(0xfff0a8, 0.95);
  for (let i = -1; i <= 1; i++) {
    const sx = midX + nx * i * 9 + px * 5;
    const sy = midY + ny * i * 9 + py * 5;
    g.fillCircle(sx, sy, 2.4);
  }
  g.lineStyle(1, 0xfff5c4, 0.9);
  g.strokeCircle(x2, y2, 8);

  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: 1.35,
    scaleY: 1.35,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => g.destroy(),
  });
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
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#6cc0ff',
    stroke: '#000000', strokeThickness: 3,
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
    stroke: '#000000', strokeThickness: 3,
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
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#5cff7a',
    stroke: '#000000', strokeThickness: 3,
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
    stroke: '#000000', strokeThickness: 3,
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
    stroke: '#000000', strokeThickness: 3,
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
  if (b.idleIncomeMult > 1) lines.push(`💰 운영 수익 +${Math.round((b.idleIncomeMult - 1) * 100)}%`);
  if (b.dungeonMaxHpBonus > 0) lines.push(`🏰 던전 HP +${b.dungeonMaxHpBonus}`);
  if (b.roomCostMult   < 1) lines.push(`🔨 방 업그레이드 비용 -${Math.round((1 - b.roomCostMult) * 100)}%`);
  if (b.waveRewardMult > 1) lines.push(`⚡ 웨이브 보상 +${Math.round((b.waveRewardMult - 1) * 100)}%`);
  if (b.extraSlots     > 0) lines.push(`📜 추가 슬롯 +${b.extraSlots}`);
  if (b.crystalEarnMult > 1) lines.push(`💠 수정 획득 +${Math.round((b.crystalEarnMult - 1) * 100)}%`);
  if (b.monsterDmgMult < 1) lines.push(`🛡 몬스터 피해 -${Math.round((1 - b.monsterDmgMult) * 100)}%`);
  if (b.monsterAtkMult > 1) lines.push(`⚔️ 몬스터 공격 +${Math.round((b.monsterAtkMult - 1) * 100)}%`);
  if (b.crystalPerWave > 0) lines.push(`💠 스테이지 클리어 수정 +${b.crystalPerWave}`);
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
