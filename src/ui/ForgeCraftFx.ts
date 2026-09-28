// ─── Forge Craft FX ───────────────────────────────────────────────────────────
// 제작 연출 — 용광로 단조 애니메이션, 희귀도 버스트, 제작 완료 카드, 모달 버튼.
// 씬에서 추출(scene+콜백 주입). 장착 액션은 ForgeCraftCallbacks.onEquip로 위임.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { RARITY_COLORS, RARITY_NAMES, type BlueprintDef } from '../data/fusion';
import { loadGameState } from '../data/wisdom';
import { getBlueprintRecommendation } from '../data/forgeRecommendations';
import {
  rarityHex,
  getForgeTypeMeta,
  getForgeRarityStars,
  truncateLabel,
  summarizeBlueprintEffects,
  blueprintEffectText,
} from './ForgeShared';
import { drawEffectChips, drawForgeRecommendationPreview } from './ForgeWorkbench';
import { drawEquipmentSigil, drawForgeCrest } from './ForgeSkin';

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

// ─── Modal button ─────────────────────────────────────────────────────────────

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
  const fillColor = variant === 'primary' ? accent : DUNGEON_UI.SOOT;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.VOID, 0.52);
  g.fillRoundedRect(x, y + 3, w, h, 8);
  g.fillStyle(fillColor, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  if (variant === 'primary') {
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(x + 6, y + 5, w - 12, 2);
  }
  g.lineStyle(1.5, variant === 'primary' ? accent : DUNGEON_UI.IRON, 1);
  g.strokeRoundedRect(x, y, w, h, 8);
  c.add(g);

  c.add(scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: variant === 'primary' ? '#07100b' : DUNGEON_UI_CSS.TEXT,
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
  box.fillStyle(DUNGEON_UI.STONE, 1);
  box.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 10);
  box.fillStyle(accent, 0.12);
  box.fillRoundedRect(cx - panelW / 2 + 12, cy - panelH / 2 + 12, panelW - 24, 88, 8);
  box.fillStyle(DUNGEON_UI.VOID, 0.68);
  box.fillRoundedRect(cx - 104, cy + 52, 208, 44, 8);
  box.lineStyle(2, DUNGEON_UI.IRON, 0.96);
  box.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 10);
  box.fillStyle(accent, 1);
  box.fillRect(cx - panelW / 2 + 1, cy - panelH / 2 + 1, 3, panelH - 2);
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

  const hammerG = scene.add.graphics().setPosition(cx - 66, cy - 78);
  drawForgeCrest(hammerG, 0, 0, accent, 0.94, 1.2);
  c.add(hammerG);

  const itemG = scene.add.graphics().setPosition(cx, cy - 36).setScale(0.72).setAlpha(0);
  drawEquipmentSigil(itemG, 0, 0, bp.type, accent, 1, 1.35);
  c.add(itemG);

  const titleT = scene.add.text(cx, cy - panelH / 2 + 24, '장비 단조', {
    fontFamily: 'sans-serif',
    fontSize: '18px',
    color: DUNGEON_UI_CSS.BRASS,
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
    fontFamily: 'sans-serif',
    fontSize: '18px',
    color: rarityColor,
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0);
  c.add(nameT);

  const statusT = scene.add.text(cx, cy + 96, '용광로 가열 중...', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.BRASS,
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
      hammerG
        .setY(hit ? baseHammerY - 8 : baseHammerY - 24)
        .setRotation(hit ? -0.22 : -0.74);
      card.setScale(0.68 + strikes * 0.045).setAlpha(0.32 + strikes * 0.08);
      emitForgeSparks(scene, c, cx, cy + 4, accent, strikes);
      if (strikes === 3) statusT.setText('마력 각인 중...');
      if (strikes >= 6) {
        statusT.setText('단조 완료');
        statusT.setStyle({ color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold' });
        card.setScale(1).setAlpha(1);
        itemG.setAlpha(1).setScale(1);
        nameT.setAlpha(1);
        hammerG.setAlpha(0.56);
        emitForgeRarityBurst(scene, c, cx, cy - 30, accent);
        scene.tweens.add({
          targets: [card, itemG],
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
  const pw = 310, ph = targetMonsterId ? 414 : 286;
  const accent = rarityHex(bp.rarity);
  const top = cy - ph / 2;

  const box = scene.add.graphics();
  box.fillStyle(DUNGEON_UI.STONE, 1);
  box.fillRoundedRect(cx - pw / 2, top, pw, ph, 10);
  box.fillStyle(accent, 0.12);
  box.fillRoundedRect(cx - pw / 2 + 12, top + 42, pw - 24, 76, 8);
  box.fillStyle(DUNGEON_UI.VOID, 0.72);
  box.fillRoundedRect(cx - pw / 2 + 18, top + 150, pw - 36, 68, 7);
  box.lineStyle(2, DUNGEON_UI.IRON, 1);
  box.strokeRoundedRect(cx - pw / 2, top, pw, ph, 10);
  box.fillStyle(accent, 1);
  box.fillRect(cx - pw / 2 + 1, top + 1, 3, ph - 2);
  c.add(box);

  const medal = scene.add.graphics();
  medal.fillStyle(accent, 0.18);
  medal.fillCircle(cx, top + 79, 31);
  medal.lineStyle(2, accent, 0.72);
  medal.strokeCircle(cx, top + 79, 31);
  medal.fillStyle(DUNGEON_UI.VOID, 0.82);
  medal.fillCircle(cx, top + 79, 23);
  drawEquipmentSigil(medal, cx, top + 79, bp.type, accent, 0.98, 1.05);
  c.add(medal);

  c.add(scene.add.text(cx, top + 23, '단조 완료', {
    fontFamily: 'sans-serif', fontSize: '18px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(cx, top + 133, bp.name, {
    fontFamily: 'sans-serif', fontSize: '18px', color: RARITY_COLORS[bp.rarity] ?? DUNGEON_UI_CSS.BRASS,
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(cx, top + 111, `${typeMeta.label} · ${getForgeRarityStars(bp.rarity)} · 장비 도감 등록`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: typeMeta.color,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(cx, top + 164, blueprintEffectText(bp), {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: 270, useAdvancedWrap: true }, align: 'center',
  }).setOrigin(0.5));

  drawEffectChips(scene, c, summarizeBlueprintEffects(bp), cx - 137, top + 183, accent, 274);

  c.add(scene.add.text(cx, top + 210, `${RARITY_NAMES[bp.rarity] ?? '특수'} 장비가 보관함에 추가되었습니다.`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));

  if (recommendation) {
    drawForgeRecommendationPreview(
      scene,
      c,
      recommendation,
      cx - 137,
      top + 228,
      274,
      58,
      '추천 장착 대상',
    );
  }

  const confirmY = top + ph - 54;
  if (targetMonsterId && targetLabel) {
    addModalButton(scene, c, cx - 137, confirmY - 52, 274, 44, targetLabel, DUNGEON_UI.JADE, 'primary', () => {
      if (callbacks.onEquip(targetMonsterId)) c.destroy();
    });
  }

  addModalButton(scene, c, cx - 137, confirmY, 274, 44, '공방으로 돌아가기', DUNGEON_UI.IRON, 'secondary', () => c.destroy());

  c.setScale(0.85).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 220, ease: 'Back.easeOut',
  });
}
