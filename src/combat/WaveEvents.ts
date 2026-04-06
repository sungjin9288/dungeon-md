/**
 * Wave event display & wave preview panel — extracted from DungeonScene.
 *
 * Each function receives a WaveEventContext that provides read/write
 * access to wave multiplier state and scene rendering capabilities.
 */
import Phaser from 'phaser';
import { rollWaveEvent, type WaveEventDef } from '../data/waveEvents';
import { INVADER_DEFS } from '../data/invaders';
import type { WaveSpec } from '../data/stages';
import type { DungeonTheme } from '../themes/themes';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { logger } from '../utils/logger';

// ─── WaveEventContext ──────────────────────────────────────────────────────

export interface WaveEventContext {
  readonly scene: Phaser.Scene;
  readonly wave: number;
  readonly maxWave: number;
  readonly isEndless: boolean;
  readonly waveConfigs: WaveSpec[];
  readonly theme: DungeonTheme;
  readonly synergyHasMoonlightHealUp: boolean;
  readonly maxHp: number;
  readonly stageNumber: number;

  // wave event multiplier state (read/write)
  waveGoldMult: number;
  waveHpMult: number;
  waveAtkMult: number;
  waveSpdMult: number;
  waveFogOverlay: Phaser.GameObjects.Graphics | undefined;
  dungeonHp: number;

  // callbacks
  startWave(): void;
  setRegistryHp(hp: number): void;
}

// ─── tryShowWaveEvent ──────────────────────────────────────────────────────

export function tryShowWaveEvent(ctx: WaveEventContext): void {
  const nextWave = ctx.wave + 1;
  const evt = rollWaveEvent(nextWave, ctx.maxWave, ctx.stageNumber);

  if (evt) {
    showWaveEvent(ctx, evt, () => showWavePreview(ctx));
  } else {
    showWavePreview(ctx);
  }
}

// ─── showWaveEvent ─────────────────────────────────────────────────────────

export function showWaveEvent(
  ctx: WaveEventContext,
  evt: WaveEventDef,
  onDone: () => void,
): void {
  const { scene, theme: t } = ctx;
  const ov = scene.add.container(0, 0).setDepth(250);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

  // Card
  const cw = 260, ch = 120;
  const cx = (CANVAS_WIDTH - cw) / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2 - 20;

  const card = scene.add.graphics();
  card.fillStyle(t.panelDark, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 8);
  card.lineStyle(2, parseInt(evt.color.replace('#', ''), 16), 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 8);
  card.setAlpha(0).setY(-40);
  ov.add(card);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 300, ease: 'Power2.easeOut' });

  // Icon
  const icon = scene.add.text(cx + cw / 2, cy + 28, evt.icon, {
    fontSize: '32px',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(icon);
  scene.tweens.add({ targets: icon, alpha: 1, duration: 200, delay: 150 });

  // Name
  const name = scene.add.text(cx + cw / 2, cy + 62, evt.name, {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: evt.color,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(name);
  scene.tweens.add({ targets: name, alpha: 1, duration: 200, delay: 250 });

  // Description
  const desc = scene.add.text(cx + cw / 2, cy + 86, evt.description, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aabbcc',
  }).setOrigin(0.5).setAlpha(0);
  ov.add(desc);
  scene.tweens.add({ targets: desc, alpha: 1, duration: 200, delay: 350 });

  // Apply event effect
  applyWaveEvent(ctx, evt);

  // Auto-dismiss after 1.8s
  scene.time.delayedCall(1800, () => {
    scene.tweens.add({
      targets: ov, alpha: 0, duration: 300,
      onComplete: () => { ov.destroy(); onDone(); },
    });
  });
}

// ─── applyWaveEvent ────────────────────────────────────────────────────────

export function applyWaveEvent(ctx: WaveEventContext, evt: WaveEventDef): void {
  switch (evt.type) {
    case 'merchant':
      ctx.waveGoldMult = 1.5;
      break;
    case 'supply': {
      const moonHealUp = ctx.synergyHasMoonlightHealUp ? 1.20 : 1;
      ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + Math.ceil(ctx.maxHp * 0.15 * moonHealUp));
      ctx.setRegistryHp(ctx.dungeonHp);
      break;
    }
    case 'curse':
      ctx.waveHpMult   = 1.3;
      ctx.waveGoldMult = 2.0;
      break;
    case 'rally':
      ctx.waveAtkMult = 1.25;
      break;
    case 'fog':
      ctx.waveSpdMult = 0.85;
      // Visual fog overlay
      ctx.waveFogOverlay = ctx.scene.add.graphics().setDepth(15).setAlpha(0.3);
      ctx.waveFogOverlay.fillStyle(0x556677, 0.25);
      ctx.waveFogOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      break;
  }
  logger.debug(`[EVENT] ${evt.name} applied: gold×${ctx.waveGoldMult} hp×${ctx.waveHpMult} atk×${ctx.waveAtkMult} spd×${ctx.waveSpdMult}`);
}

// ─── showWavePreview ───────────────────────────────────────────────────────

export function showWavePreview(ctx: WaveEventContext): void {
  const { scene } = ctx;
  const nextWave = ctx.wave + 1;
  if (nextWave > ctx.maxWave) { ctx.startWave(); return; }

  // Gather wave info
  const cfg = ctx.isEndless
    ? null
    : ctx.waveConfigs[Math.min(nextWave - 1, ctx.waveConfigs.length - 1)];

  const ov = scene.add.container(0, 0).setDepth(300);

  // Dim
  const dim = scene.add.graphics().setAlpha(0);
  dim.fillStyle(0x000000, 0.65);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

  // Card
  const cw = 310, ch = cfg ? 40 + cfg.invaders.length * 36 + 80 : 140;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;
  const card = scene.add.graphics();
  card.fillStyle(0x1a0f00, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 10);
  card.lineStyle(2, 0xc8921a, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 10);
  ov.add(card);

  // Title
  ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 18,
    `⚠️  ${nextWave}번째 침략 예고`, {
    fontFamily: 'Georgia, serif', fontSize: '15px',
    fontStyle: 'bold', color: '#c8921a',
  }).setOrigin(0.5));

  if (cfg) {
    // Enemy list
    let rowY = cy + 46;
    const typeCount = new Map<string, number>();
    for (const { type, count } of cfg.invaders) {
      typeCount.set(type, (typeCount.get(type) ?? 0) + count);
    }
    const totalInvaders = [...typeCount.values()].reduce((a, b) => a + b, 0);

    for (const [type, count] of typeCount) {
      const def = INVADER_DEFS[type as import('../data/invaders').InvaderType];
      if (!def) continue;

      const rowG = scene.add.graphics();
      rowG.fillStyle(0x2d1a00, 0.7);
      rowG.fillRoundedRect(cx + 12, rowY - 12, cw - 24, 30, 4);
      ov.add(rowG);

      // HP bar (relative strength)
      const hpFrac = Math.min(1, def.hp / 1000);
      const barW   = 60;
      const hpG    = scene.add.graphics();
      hpG.fillStyle(0x0e0900, 1);
      hpG.fillRoundedRect(cx + cw - 90, rowY - 6, barW, 8, 2);
      hpG.fillStyle(def.hp > 400 ? 0x8b0000 : def.hp > 150 ? 0xc8921a : 0x2d9e2d, 1);
      hpG.fillRoundedRect(cx + cw - 90, rowY - 6, barW * hpFrac, 8, 2);
      ov.add(hpG);

      ov.add(scene.add.text(cx + 20, rowY,
        `×${count}  ${def.koreanName}`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#e8d090',
      }).setOrigin(0, 0.5));
      ov.add(scene.add.text(cx + cw - 24, rowY,
        `HP ${def.hp}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
      }).setOrigin(1, 0.5));

      // Special behavior badge
      if (def.behavior) {
        const behaviorLabel: Record<string, string> = {
          VOID_PHASE: '순간이동', REVIVE_ONCE: '부활', NINJA_STEALTH: '은신',
          SIEGE_SHIELD: '방어막', HOLY_PALADIN: '신성면역', IRON_GOLEM: '둔화면역',
        };
        ov.add(scene.add.text(cx + 20 + 120, rowY,
          `[${behaviorLabel[def.behavior] ?? def.behavior}]`, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#ff8888',
        }).setOrigin(0, 0.5));
      }

      rowY += 36;
    }

    // Total / damage warning
    ov.add(scene.add.text(CANVAS_WIDTH / 2, rowY + 2,
      `총 ${totalInvaders}명  ·  돌파 시 던전 피해`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#664400',
    }).setOrigin(0.5));
  } else {
    ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 60,
      '무한 모드 — 침략자가 계속 강해집니다', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#806040',
    }).setOrigin(0.5));
  }

  // Confirm button
  const btnY = cy + ch - 32;
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(0x8b0000, 0.85);
  btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6);
  ov.add(btnBg);
  const btnT = scene.add.text(CANVAS_WIDTH / 2, btnY, '⚔  침략 시작', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8d090',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btnT.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(0xb00000, 1); btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6); });
  btnT.on('pointerout',  () => { btnBg.clear(); btnBg.fillStyle(0x8b0000, 0.85); btnBg.fillRoundedRect(cx + 40, btnY - 14, cw - 80, 28, 6); });
  btnT.on('pointerdown', () => { ov.destroy(); ctx.startWave(); });
  ov.add(btnT);
}
