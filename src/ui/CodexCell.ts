/**
 * CodexCell.ts — cell and bonus panel renderers for the Codex.
 * All functions take (scene, ctx, ...) — no `this` usage.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CSS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { generatePortrait } from '../art/PortraitGenerator';
import { showCodexMonsterDetail } from '../ui/CodexMonsterDetail';
import type { GameState } from '../data/wisdom';
import type { TribeId } from '../data/monsters';
import {
  CX, PAD,
  CODEX_ELEMENT_LABELS,
  getDexNo, getRarityMeta, truncateLabel,
  type TribeMeta,
} from './CodexShared';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface CodexCellContext {
  /** Current game state snapshot */
  gs: GameState;
  /** Which tribes are currently expanded */
  expandedTribes: Set<TribeId>;
  /** Whether the owned-only filter is active */
  showOwnedOnly: boolean;
  /** Returns true when the given monster id is owned */
  isOwned: (monsterId: MonsterId) => boolean;
  /** Called when user taps the Claim reward button */
  onClaimTribeReward: (tribeId: string) => void;
  /** Mutable ref for the currently-open detail overlay (set/cleared inside) */
  detailOverlayRef: { current: Phaser.GameObjects.Container | null };
}

// ─── drawMonsterCell ──────────────────────────────────────────────────────────

export function drawMonsterCell(
  scene: Phaser.Scene,
  ctx: CodexCellContext,
  c: Phaser.GameObjects.Container,
  m: (typeof MONSTER_DEFS)[MonsterId],
  owned: boolean,
  tribeColor: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const g = scene.add.graphics();
  c.add(g);
  const rarity = getRarityMeta(m.rarityTier);
  const dexNo = getDexNo(m.id);
  const elementLabel = m.element ? (CODEX_ELEMENT_LABELS[m.element] ?? m.element) : '중립';

  if (owned) {
    g.fillStyle(0x000000, 0.24);
    g.fillRoundedRect(x + 3, y + 4, w - 5, h - 4, 7);
    g.fillStyle(0x150b08, 1);
    g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
    g.fillStyle(rarity.color, 0.10);
    g.fillRoundedRect(x + 8, y + 20, w - 16, 35, 7);
    g.fillStyle(tribeColor, 0.08);
    g.fillRoundedRect(x + 7, y + 58, w - 14, 16, 6);
    drawFoilLines(g, x + 8, y + 20, w - 16, 35, rarity.color, 0.10);
    g.lineStyle(1.2, rarity.color, 0.72);
    g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
    g.lineStyle(1, 0xffffff, 0.10);
    g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 5);
    g.fillStyle(0x060402, 0.94);
    g.fillRoundedRect(x + 8, y + 7, 42, 13, 5);
    g.lineStyle(1, rarity.color, 0.46);
    g.strokeRoundedRect(x + 8, y + 7, 42, 13, 5);
    g.fillStyle(rarity.color, 0.17);
    g.fillRoundedRect(x + w - 38, y + 7, 27, 13, 5);
    g.lineStyle(1, rarity.color, 0.54);
    g.strokeRoundedRect(x + w - 38, y + 7, 27, 13, 5);

    const codexSkin = getSkinForMonster(m.id, ctx.gs.equippedSkins ?? {});
    const codexPortraitKey = generatePortrait(scene, m.id as MonsterId, codexSkin?.id);
    if (scene.textures.exists(codexPortraitKey)) {
      const portrait = scene.add.image(x + w / 2, y + 38, codexPortraitKey)
        .setOrigin(0.5).setDisplaySize(34, 34);
      c.add(portrait);
    } else {
      const emojiT = scene.add.text(x + w / 2, y + 24, codexSkin ? codexSkin.emoji : m.emoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5, 0);
      c.add(emojiT);
    }

    const dexT = scene.add.text(x + 29, y + 13.5, `도감 ${dexNo}`, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: rarity.css,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(dexT);

    const rarityT = scene.add.text(x + w - 24.5, y + 13.5, rarity.label, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: rarity.css,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(rarityT);

    const starsT = scene.add.text(x + 13, y + h - 15, rarity.stars, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: rarity.css,
    }).setOrigin(0, 0.5);
    c.add(starsT);

    const nameT = scene.add.text(x + w / 2, y + 62, truncateLabel(m.name, 7), {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: CSS.PARCHMENT_DIM,
      fontStyle: 'bold',
      align: 'center', wordWrap: { width: w - 8 },
    }).setOrigin(0.5, 0);
    c.add(nameT);

    const metaT = scene.add.text(x + w / 2, y + 76, `${elementLabel} · Ch.${m.chapter ?? '-'}`, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: '#b39b72',
    }).setOrigin(0.5);
    c.add(metaT);

    // Tap to show detail overlay
    const tapZone = scene.add.zone(x + w / 2, y + h / 2, w - 4, h - 4)
      .setInteractive({ useHandCursor: true }).setOrigin(0.5);
    c.add(tapZone);
    tapZone.on('pointerdown', () => {
      ctx.detailOverlayRef.current?.destroy();
      ctx.detailOverlayRef.current = showCodexMonsterDetail(scene, m, ctx.gs, () => {
        ctx.detailOverlayRef.current = null;
      });
    });

  } else {
    // Silhouette (unowned)
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(x + 3, y + 4, w - 5, h - 4, 7);
    g.fillStyle(0x0b0808, 1);
    g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
    g.fillStyle(rarity.color, 0.04);
    g.fillRoundedRect(x + 8, y + 20, w - 16, 35, 7);
    drawFoilLines(g, x + 8, y + 20, w - 16, 35, rarity.color, 0.035);
    g.lineStyle(1, 0x2a1a00, 0.8);
    g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
    g.fillStyle(0x060402, 0.88);
    g.fillRoundedRect(x + 8, y + 7, 42, 13, 5);
    g.lineStyle(1, 0x3a2a18, 0.5);
    g.strokeRoundedRect(x + 8, y + 7, 42, 13, 5);
    g.fillStyle(0x060402, 0.88);
    g.fillRoundedRect(x + w - 38, y + 7, 27, 13, 5);
    g.lineStyle(1, rarity.color, 0.24);
    g.strokeRoundedRect(x + w - 38, y + 7, 27, 13, 5);

    const dexT = scene.add.text(x + 29, y + 13.5, `도감 ${dexNo}`, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: '#5e4a36',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(dexT);

    const rarityT = scene.add.text(x + w - 24.5, y + 13.5, rarity.label, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#5d4d38',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(rarityT);

    const shadowT = scene.add.text(x + w / 2, y + 28, '???', {
      fontFamily: 'Georgia, serif', fontSize: '18px',
    }).setOrigin(0.5, 0).setAlpha(0.4);
    c.add(shadowT);

    const unknownT = scene.add.text(x + w / 2, y + 64, '미발견', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#5a3a18',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    c.add(unknownT);

    const hintT = scene.add.text(x + w / 2, y + 78, `${elementLabel} · Ch.${m.chapter ?? '-'}`, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: '#46301c',
    }).setOrigin(0.5);
    c.add(hintT);
  }
}

// ─── drawFoilLines ────────────────────────────────────────────────────────────

export function drawFoilLines(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha: number,
): void {
  const lineCount = Math.max(3, Math.ceil(w / 28));
  for (let i = -1; i < lineCount; i++) {
    const sx = x + 8 + i * 24;
    g.lineStyle(0.8, color, alpha);
    g.lineBetween(sx, y + h - 5, sx + 42, y + 4);
  }
}

// ─── drawSetBonus ─────────────────────────────────────────────────────────────

export function drawSetBonus(
  scene: Phaser.Scene,
  ctx: CodexCellContext,
  c: Phaser.GameObjects.Container,
  tribe: TribeMeta,
  owned: number,
  total: number,
  y: number,
): number {
  const claimed = ctx.gs.codexRewardsClaimed?.includes(tribe.id) ?? false;
  const done = owned === total;
  const h = done && !claimed ? 70 : 50;

  const g = scene.add.graphics();
  c.add(g);

  g.fillStyle(CASUAL.SHADOW, 0.16);
  g.fillRoundedRect(PAD + 4, y + 3, CANVAS_WIDTH - PAD * 2 - 8, h, 8);
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(PAD + 4, y, CANVAS_WIDTH - PAD * 2 - 8, h, 8);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(PAD + 9, y + 4, CANVAS_WIDTH - PAD * 2 - 18, 4, 2);
  g.lineStyle(3, done ? CASUAL.GREEN_DK : CASUAL.EDGE, 1);
  g.strokeRoundedRect(PAD + 4, y, CANVAS_WIDTH - PAD * 2 - 8, h, 8);

  const labelColor = done ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT;
  const prefix = done
    ? (claimed ? '✓ 세트 효과 활성화! (보상 수령 완료)' : '✓ 세트 효과 활성화!')
    : `세트 효과 (${owned}/${total} 달성 시)`;
  const labelT = scene.add.text(PAD + 12, y + 8, prefix, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: labelColor,
  }).setOrigin(0, 0);
  c.add(labelT);

  const bonusT = scene.add.text(PAD + 12, y + 24, `✦ ${tribe.bonus}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: done ? CASUAL_CSS.GREEN : CASUAL_CSS.INK,
  }).setOrigin(0, 0);
  c.add(bonusT);

  if (done && !claimed) {
    // Claim button
    const btnW = 120, btnH = 24;
    const btnX = CX - btnW / 2, btnY = y + 40;
    const btnG = scene.add.graphics();
    btnG.fillStyle(CASUAL.GREEN_DK, 1);
    btnG.fillRoundedRect(btnX, btnY + 2, btnW, btnH, 7);
    btnG.fillStyle(CASUAL.GREEN, 1);
    btnG.fillRoundedRect(btnX, btnY, btnW, btnH, 7);
    btnG.fillStyle(0xffffff, 0.32);
    btnG.fillRoundedRect(btnX + 5, btnY + 3, btnW - 10, 5, 3);
    c.add(btnG);

    const btnLabel = scene.add.text(CX, btnY + btnH / 2, `🎁 ${tribe.reward.split(' ')[0]} 수령`, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: CASUAL_CSS.WHITE, fontStyle: 'bold',
      stroke: '#00000033', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive();
    c.add(btnLabel);

    btnLabel.on('pointerdown', () => {
      ctx.onClaimTribeReward(tribe.id);
    });
  } else if (!done) {
    const rewardT = scene.add.text(CANVAS_WIDTH - PAD - 12, y + 8, tribe.reward, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    }).setOrigin(1, 0);
    c.add(rewardT);
  }

  return y + h + 4;
}
