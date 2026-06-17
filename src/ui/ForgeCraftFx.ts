// ─── Forge Craft FX ───────────────────────────────────────────────────────────
// 제작 연출 — 용광로 단조 애니메이션, 희귀도 버스트, 제작 완료 카드, 모달 버튼.
// 씬에서 추출(scene+콜백 주입). 장착 액션은 ForgeCraftCallbacks.onEquip로 위임.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { RARITY_COLORS, RARITY_NAMES, type BlueprintDef } from '../data/fusion';
import { loadGameState } from '../data/wisdom';
import { getBlueprintRecommendation } from '../data/forgeRecommendations';
import {
  rarityHex,
  getForgeTypeMeta,
  getForgeRarityStars,
  truncateLabel,
  summarizeBlueprintEffects,
} from './ForgeShared';
import { drawEffectChips, drawForgeRecommendationPreview } from './ForgeWorkbench';

// ─── Callbacks ──────────────────────────────────────────────────────────────
// Scene-coupled actions the craft FX needs. onEquip performs the actual
// equip + save + room feedback / navigation / toast and returns success;
// the card destroys itself on success.

export interface ForgeCraftCallbacks {
  readonly focusMonsterId: string | null;
  /** Refresh the forge screen (drawHeader + renderContent). */
  readonly onRefresh: () => void;
  /** Equip the crafted item on the target monster. Returns true on success. */
  readonly onEquip: (targetMonsterId: string) => boolean;
}

// ─── Modal button (shared candy button) ───────────────────────────────────────

export function addModalButton(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  accent: number,
  variant: 'primary' | 'secondary',
  onClick: () => void,
): void {
  // Candy button: primary = bright accent + white label, secondary = cream pill + ink.
  const fillColor = variant === 'primary' ? accent : CASUAL.PANEL;
  const g = scene.add.graphics();
  g.fillStyle(variant === 'primary' ? CASUAL.EDGE : CASUAL.EDGE, variant === 'primary' ? 0.6 : 0.45);
  g.fillRoundedRect(x, y + 3, w, h, 13);
  g.fillStyle(fillColor, 1);
  g.fillRoundedRect(x, y, w, h, 13);
  g.fillStyle(0xffffff, variant === 'primary' ? 0.3 : 0.45);
  g.fillRoundedRect(x + 6, y + 5, w - 12, 6, 3);
  g.lineStyle(2, variant === 'primary' ? accent : CASUAL.EDGE, 1);
  g.strokeRoundedRect(x, y, w, h, 13);
  c.add(g);

  c.add(scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: variant === 'primary' ? '#ffffff' : CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + w / 2, y + h / 2, w, h)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onClick);
  c.add(zone);
}

// ─── Craft animation (furnace forging) ────────────────────────────────────────

export function showCraftAnimation(
  scene: Phaser.Scene,
  bp: BlueprintDef,
  callbacks: ForgeCraftCallbacks,
): void {
  const c = scene.add.container(0, 0).setDepth(50);
  const typeMeta = getForgeTypeMeta(bp.type);
  const accent = rarityHex(bp.rarity);
  const rarityColor = RARITY_COLORS[bp.rarity] ?? '#ffaa44';

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const panelW = 284;
  const panelH = 254;

  const box = scene.add.graphics();
  box.fillStyle(0x1c0802, 1);
  box.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
  box.fillStyle(accent, 0.12);
  box.fillRoundedRect(cx - panelW / 2 + 12, cy - panelH / 2 + 12, panelW - 24, 88, 12);
  box.fillStyle(0x090402, 0.6);
  box.fillRoundedRect(cx - 104, cy + 52, 208, 44, 12);
  box.lineStyle(2, accent, 0.96);
  box.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
  box.lineStyle(1, 0xffffff, 0.12);
  box.strokeRoundedRect(cx - panelW / 2 + 6, cy - panelH / 2 + 6, panelW - 12, panelH - 12, 10);
  c.add(box);

  const furnace = scene.add.graphics();
  furnace.fillStyle(0x080402, 0.92);
  furnace.fillRoundedRect(cx - 72, cy - 24, 144, 70, 16);
  furnace.fillStyle(0xff4b16, 0.52);
  furnace.fillEllipse(cx, cy + 9, 126, 38);
  furnace.fillStyle(0xffcf75, 0.9);
  furnace.fillEllipse(cx, cy + 5, 76, 19);
  furnace.fillStyle(0x2e2a24, 1);
  furnace.fillRoundedRect(cx - 62, cy + 40, 124, 12, 4);
  furnace.lineStyle(1.5, accent, 0.7);
  furnace.strokeRoundedRect(cx - 72, cy - 24, 144, 70, 16);
  c.add(furnace);

  const card = scene.add.graphics();
  card.setPosition(cx, cy - 23);
  card.fillStyle(0x0b0704, 0.98);
  card.fillRoundedRect(-46, -59, 92, 118, 12);
  card.fillStyle(accent, 0.11);
  card.fillRoundedRect(-38, -51, 76, 102, 9);
  card.lineStyle(2, accent, 0.92);
  card.strokeRoundedRect(-46, -59, 92, 118, 12);
  card.lineStyle(1, 0xffffff, 0.12);
  card.strokeRoundedRect(-40, -53, 80, 106, 9);
  card.setScale(0.68).setAlpha(0.32);
  c.add(card);

  const hammerT = scene.add.text(cx - 66, cy - 78, '⚒', {
    fontFamily: 'sans-serif', fontSize: '34px',
  }).setOrigin(0.5);
  c.add(hammerT);

  const itemT = scene.add.text(cx, cy - 36, bp.resultEmoji, {
    fontFamily: 'sans-serif',
    fontSize: '34px',
  }).setOrigin(0.5).setScale(0.72).setAlpha(0);
  c.add(itemT);

  const titleT = scene.add.text(cx, cy - panelH / 2 + 24, '장비 단조', {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    color: '#ffaa44',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const metaT = scene.add.text(cx, cy - panelH / 2 + 48, `${typeMeta.icon} ${typeMeta.label} · ${getForgeRarityStars(bp.rarity)}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: typeMeta.color,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  c.add([titleT, metaT]);

  const nameT = scene.add.text(cx, cy + 74, bp.name, {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    color: rarityColor,
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0);
  c.add(nameT);

  const statusT = scene.add.text(cx, cy + 96, '용광로 가열 중...', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#d9a66d',
  }).setOrigin(0.5);
  c.add(statusT);

  let strikes = 0;
  const baseHammerY = cy - 78;
  scene.time.addEvent({
    delay: 190,
    repeat: 5,
    callback: () => {
      strikes++;
      const hit = strikes % 2 === 0;
      hammerT
        .setY(hit ? baseHammerY - 8 : baseHammerY - 24)
        .setRotation(hit ? -0.22 : -0.74);
      card.setScale(0.68 + strikes * 0.045).setAlpha(0.32 + strikes * 0.08);
      emitForgeSparks(scene, c, cx, cy + 4, accent, strikes);
      if (strikes === 3) statusT.setText('마력 각인 중...');
      if (strikes >= 6) {
        statusT.setText('단조 완료');
        statusT.setStyle({ color: '#b8fff0', fontStyle: 'bold' });
        card.setScale(1).setAlpha(1);
        itemT.setAlpha(1).setScale(1);
        nameT.setAlpha(1);
        hammerT.setAlpha(0.56);
        emitForgeRarityBurst(scene, c, cx, cy - 30, accent);
        scene.tweens.add({
          targets: [card, itemT],
          y: '-=10',
          duration: 280,
          yoyo: true,
          ease: 'Sine.easeOut',
        });
        scene.time.delayedCall(780, () => {
          c.destroy();
          callbacks.onRefresh();
          showCraftCompleteCard(scene, bp, callbacks);
        });
      }
    },
  });
}

function emitForgeSparks(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  seed: number,
): void {
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i - 2) * 0.38 + seed * 0.11;
    const distance = 32 + i * 6;
    const spark = scene.add.text(x, y, i % 2 === 0 ? '✦' : '•', {
      fontFamily: 'sans-serif',
      fontSize: i % 2 === 0 ? '13px' : '16px',
      color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5).setAlpha(0.9);
    c.add(spark);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}

function emitForgeRarityBurst(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const ring = scene.add.graphics();
  ring.setPosition(x, y);
  ring.lineStyle(2, accent, 0.92);
  ring.strokeCircle(0, 0, 12);
  c.add(ring);
  scene.tweens.add({
    targets: ring,
    scaleX: 5.2,
    scaleY: 5.2,
    alpha: 0,
    duration: 560,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    const star = scene.add.text(x, y, '✦', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    c.add(star);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * 92,
      y: y + Math.sin(angle) * 58,
      alpha: 0,
      scaleX: 0.45,
      scaleY: 0.45,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}

// ─── Craft complete card ──────────────────────────────────────────────────────

function showCraftCompleteCard(
  scene: Phaser.Scene,
  bp: BlueprintDef,
  callbacks: ForgeCraftCallbacks,
): void {
  const c = scene.add.container(0, 0).setDepth(60);
  const focusMonsterId = callbacks.focusMonsterId;
  const recommendation = getBlueprintRecommendation(loadGameState(), bp);
  const typeMeta = getForgeTypeMeta(bp.type);
  const targetMonsterId = focusMonsterId ?? recommendation?.monsterId ?? null;
  const targetLabel = focusMonsterId
    ? '장착하고 돌아가기'
    : recommendation
      ? `${truncateLabel(recommendation.monsterName, 5)} 장착`
      : null;

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const pw = 278, ph = targetMonsterId ? 398 : 226;
  const accent = rarityHex(bp.rarity);

  const box = scene.add.graphics();
  box.fillStyle(0x1a0800, 1);
  box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
  box.fillStyle(accent, 0.12);
  box.fillRoundedRect(cx - pw / 2 + 10, cy - ph / 2 + 10, pw - 20, 90, 10);
  box.fillStyle(0x060402, 0.34);
  box.fillRoundedRect(cx - pw / 2 + 14, cy + 24, pw - 28, 58, 9);
  box.lineStyle(2, accent, 1);
  box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
  box.lineStyle(1, 0xffffff, 0.12);
  box.strokeRoundedRect(cx - pw / 2 + 5, cy - ph / 2 + 5, pw - 10, ph - 10, 9);
  c.add(box);

  const medal = scene.add.graphics();
  medal.fillStyle(accent, 0.18);
  medal.fillCircle(cx, cy - ph / 2 + 72, 38);
  medal.lineStyle(2, accent, 0.72);
  medal.strokeCircle(cx, cy - ph / 2 + 72, 38);
  medal.fillStyle(0x0a0503, 0.82);
  medal.fillCircle(cx, cy - ph / 2 + 72, 27);
  c.add(medal);

  c.add(scene.add.text(cx, cy - ph / 2 + 24, '제작 완료', {
    fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffaa44', fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(cx, cy - ph / 2 + 70, bp.resultEmoji, {
    fontFamily: 'sans-serif', fontSize: '34px',
  }).setOrigin(0.5));

  c.add(scene.add.text(cx, cy - 18, bp.name, {
    fontFamily: 'Georgia, serif', fontSize: '19px', color: RARITY_COLORS[bp.rarity] ?? '#ffaa44',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(cx, cy - 40, `${typeMeta.icon} ${typeMeta.label} · ${getForgeRarityStars(bp.rarity)} · 장비 도감 등록`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: typeMeta.color,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(cx, cy + 8, bp.statDesc, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#aa8844',
  }).setOrigin(0.5));

  drawEffectChips(scene, c, summarizeBlueprintEffects(bp), cx - 92, cy + 34, accent, 184);

  c.add(scene.add.text(cx, recommendation ? cy + 54 : cy + 58, `${RARITY_NAMES[bp.rarity] ?? '특수'} 장비가 보관함에 추가되었습니다.`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#ccb083',
  }).setOrigin(0.5));

  if (recommendation) {
    drawForgeRecommendationPreview(
      scene,
      c,
      recommendation,
      cx - 112,
      cy + 62,
      224,
      48,
      '추천 장착 대상',
    );
  }

  const confirmY = cy + ph / 2 - 26;
  if (targetMonsterId && targetLabel) {
    addModalButton(scene, c, cx - 104, confirmY - 52, 208, 34, targetLabel, accent, 'primary', () => {
      if (callbacks.onEquip(targetMonsterId)) c.destroy();
    });
  }

  addModalButton(scene, c, cx - 54, confirmY - 10, 108, 30, '확인', 0x7c5633, 'secondary', () => c.destroy());

  c.setScale(0.85).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 220, ease: 'Back.easeOut',
  });
}
