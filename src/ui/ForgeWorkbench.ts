// ─── Forge Workbench ─────────────────────────────────────────────────────────
// buildWorkbenchPanel, drawWorkbenchStat, drawProgressTrack,
// drawForgeRecommendationPreview, drawEffectChips, buildForgeTargetRail.
// All functions take (scene, ctx, ...) — no `this` usage.

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { BLUEPRINT_DEFS, RARITY_COLORS } from '../data/fusion';
import { type BlueprintDef } from '../data/fusion';
import { canCraftBlueprint } from '../data/forgeTransactions';
import { getBlueprintRecommendation, type ForgeRecommendation } from '../data/forgeRecommendations';
import {
  WORKBENCH_H, LIST_PAD,
  rarityHex as rarityHexFn,
  getForgeRarityStars,
  getFocusMonsterDisplay,
  getFocusEquipmentDisplay,
  getMonsterEquipmentDisplay,
  getForgeTargetCues,
  truncateLabel,
  type ForgeContext,
} from './ForgeShared';

// ─── buildWorkbenchPanel ──────────────────────────────────────────────────────

export function buildWorkbenchPanel(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  mode: 'craft' | 'dismantle',
): number {
  const { gs, focusMonsterId, focusSourceLabel } = ctx;
  const ownedBlueprints = gs.blueprints ?? [];
  const craftable = ownedBlueprints
    .map(id => BLUEPRINT_DEFS[id])
    .filter((bp): bp is BlueprintDef => Boolean(bp))
    .filter(bp => canCraftBlueprint(bp, gs.materials ?? {}));
  const bestCraftable = [...craftable].sort((a, b) => b.rarity - a.rarity)[0];
  const previewBlueprint = bestCraftable
    ?? ownedBlueprints.map(id => BLUEPRINT_DEFS[id]).find((bp): bp is BlueprintDef => Boolean(bp));
  const recommendation = mode === 'craft' && previewBlueprint
    ? getBlueprintRecommendation(gs, previewBlueprint)
    : null;
  const materialTypes = Object.values(gs.materials ?? {}).filter(qty => qty > 0).length;
  const craftedCount  = (gs.craftedEquipment ?? []).length;
  const equippedCount = gs.ownedMonsters.filter(monster => Boolean(monster.equipment)).length;
  const heatRatio     = ownedBlueprints.length > 0 ? craftable.length / ownedBlueprints.length : 0;
  const target        = getFocusMonsterDisplay(gs, focusMonsterId);
  const workbenchTarget = target ?? (recommendation
    ? {
        name:  recommendation.monsterName,
        emoji: recommendation.monsterEmoji,
        level: recommendation.monsterLevel,
      }
    : null);
  const targetName    = workbenchTarget?.name ?? null;
  const sourceLabel   = focusSourceLabel ?? recommendation?.roomLabel ?? null;
  const currentEquipment = target
    ? getFocusEquipmentDisplay(gs, focusMonsterId)
    : recommendation
      ? getMonsterEquipmentDisplay(gs, recommendation.monsterId)
      : null;

  const x = 12, y = 10, w = CANVAS_WIDTH - 24, h = 116;
  const accent = mode === 'craft' ? CASUAL.GOLD : CASUAL.RED;
  const frame = addFramedPanel(scene, {
    x, y, w, h,
    radius:       12,
    fillColor:    CASUAL.PANEL,
    borderColor:  CASUAL.EDGE,
    borderAlpha:  1,
    borderWidth:  3,
    accentColor:  accent,
    accentAlpha:  1,
    shadowOpacity: 0.26,
    shadowOffsetY: 5,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const panel = scene.add.graphics();
  panel.fillStyle(0x0c1714, 0.94);
  panel.fillRoundedRect(x + 8, y + 10, 86, h - 20, 10);
  panel.fillStyle(CASUAL.PANEL_SOFT, 0.7);
  panel.fillRoundedRect(x + 100, y + 8, w - 194, h - 16, 10);
  panel.fillStyle(accent, target ? 0.6 : 0.28);
  panel.fillRoundedRect(x + w - 86, y + 11, 74, h - 22, 10);
  panel.lineStyle(1.5, target ? CASUAL.GREEN : CASUAL.EDGE_SOFT, target ? 0.7 : 0.4);
  panel.strokeRoundedRect(x + 12, y + 14, 78, h - 28, 9);
  c.add(panel);

  c.add(scene.add.text(x + 51, y + 32, workbenchTarget ? workbenchTarget.emoji : mode === 'craft' ? '⚒' : '🔨', {
    fontFamily: 'sans-serif', fontSize: workbenchTarget ? '30px' : '31px',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 51, y + 64, workbenchTarget ? `Lv.${workbenchTarget.level}` : mode === 'craft' ? '제작대' : '분해대', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#ffe9c8',
    fontStyle: workbenchTarget ? 'bold' : 'normal',
  }).setOrigin(0.5));
  if (workbenchTarget) {
    c.add(scene.add.text(x + 51, y + 82, truncateLabel(workbenchTarget.name, 6), {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#fff6e6', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  const title = mode === 'craft'
    ? (bestCraftable
        ? (recommendation ? `${bestCraftable.name} 추천 제작` : `${bestCraftable.name} 제작 가능`)
        : '재료 수급 필요')
    : (craftedCount > 0 ? '장비 회수 가능' : '제작 장비 없음');
  const body = mode === 'craft'
    ? (recommendation
        ? recommendation.targetLine
        : targetName
          ? `${targetName}에게 장착할 장비를 제작해 전투실 효율을 올리세요.`
        : '방어선에 부족한 무기, 방어구, 장신구를 제작하세요.')
    : '사용하지 않는 제작 장비를 분해해 다음 장비 재료로 회수하세요.';

  c.add(scene.add.text(x + 110, y + 19, title, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 110, y + 41, body, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: sourceLabel ? 142 : 162, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  const equipLine = currentEquipment
    ? `${currentEquipment.emoji} ${truncateLabel(currentEquipment.name, 9)} 장착 중`
    : workbenchTarget
      ? '장비 슬롯 비어 있음'
      : mode === 'craft'
        ? '설계도 선택 후 단조'
        : '불필요 장비 회수';
  const hasPowerRecommendation = mode === 'craft' && recommendation !== null;
  const equipChipW = hasPowerRecommendation ? 112 : 160;
  const equipChip = scene.add.graphics();
  equipChip.fillStyle(currentEquipment ? CASUAL.GOLD : CASUAL.PANEL, currentEquipment ? 0.32 : 0.9);
  equipChip.fillRoundedRect(x + 110, y + 60, equipChipW, 20, 7);
  equipChip.lineStyle(1.5, currentEquipment ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT, currentEquipment ? 0.9 : 0.6);
  equipChip.strokeRoundedRect(x + 110, y + 60, equipChipW, 20, 7);
  c.add(equipChip);
  c.add(scene.add.text(x + 110 + equipChipW / 2, y + 70, equipLine, {
    fontFamily: 'sans-serif', fontSize: '9px',
    color: currentEquipment ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    fontStyle: currentEquipment ? 'bold' : 'normal',
  }).setOrigin(0.5));

  if (hasPowerRecommendation) {
    const boostX = x + 226;
    const boost = scene.add.graphics();
    boost.fillStyle(CASUAL.GREEN, 1);
    boost.fillRoundedRect(boostX, y + 60, 54, 20, 7);
    boost.lineStyle(1.5, CASUAL.GREEN_DK, 1);
    boost.strokeRoundedRect(boostX, y + 60, 54, 20, 7);
    boost.fillStyle(0xffffff, 0.3);
    boost.fillRoundedRect(boostX + 5, y + 63, 44, 4, 3);
    c.add(boost);
    c.add(scene.add.text(boostX + 27, y + 70, `전력 +${recommendation.powerDelta}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  if (sourceLabel) {
    const chipX = x + w - 76;
    const chipY = y + 14;
    const chip = scene.add.graphics();
    chip.fillStyle(CASUAL.GREEN, 1);
    chip.fillRoundedRect(chipX, chipY, 58, 20, 7);
    chip.lineStyle(1.5, CASUAL.GREEN_DK, 1);
    chip.strokeRoundedRect(chipX, chipY, 58, 20, 7);
    chip.fillStyle(0xffffff, 0.3);
    chip.fillRoundedRect(chipX + 5, chipY + 4, 48, 4, 3);
    c.add(chip);
    c.add(scene.add.text(chipX + 29, chipY + 10, truncateLabel(sourceLabel, 5), {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  drawWorkbenchStat(scene, c, x + 110, y + 88, 50, '가능',  String(craftable.length),      CASUAL.GREEN_DK);
  drawWorkbenchStat(scene, c, x + 166, y + 88, 52, '설계도', String(ownedBlueprints.length), CASUAL.GOLD_DK);
  drawWorkbenchStat(scene, c, x + 224, y + 88, 48, '재료',   String(materialTypes),          CASUAL.BLUE_DK);

  if (!sourceLabel) {
    const craftedText = mode === 'craft'
      ? `도감 ${craftedCount} · 장착 ${equippedCount}`
      : `보유 ${craftedCount} · 장착 ${equippedCount}`;
    c.add(scene.add.text(x + w - 20, y + 22, craftedText, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0.5));
  }

  const forgeX = x + w - 49;
  const forgeY = y + 64;
  const forge = scene.add.graphics();
  forge.fillStyle(0x080402, 0.86);
  forge.fillRoundedRect(forgeX - 26, forgeY - 25, 52, 42, 8);
  forge.fillStyle(mode === 'craft' ? 0xff4b16 : 0x693021, 0.44);
  forge.fillEllipse(forgeX, forgeY - 3, 44, 23);
  forge.fillStyle(mode === 'craft' ? 0xffcf75 : 0xb86b42, mode === 'craft' ? 0.86 : 0.45);
  forge.fillEllipse(forgeX, forgeY - 5, 26, 11);
  forge.fillStyle(0x2e2a24, 1);
  forge.fillRoundedRect(forgeX - 22, forgeY + 22, 44, 9, 3);
  forge.fillStyle(0x050201, 0.92);
  forge.fillRoundedRect(forgeX - 20, forgeY + 14, 40, 5, 3);
  forge.fillStyle(mode === 'craft' ? 0xffcf75 : 0xb86b42, 0.86);
  forge.fillRoundedRect(forgeX - 20, forgeY + 14, Math.max(4, 40 * (mode === 'craft' ? heatRatio : Math.min(1, craftedCount / 6))), 5, 3);
  forge.lineStyle(1, bestCraftable ? rarityHexFn(bestCraftable.rarity) : 0x8a4a12, 0.72);
  forge.strokeRoundedRect(forgeX - 27, forgeY - 26, 54, 58, 8);
  c.add(forge);
  c.add(scene.add.text(forgeX, forgeY + 17, mode === 'craft' && previewBlueprint ? getForgeRarityStars(previewBlueprint.rarity) : 'STOCK', {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: mode === 'craft' && previewBlueprint ? (RARITY_COLORS[previewBlueprint.rarity] ?? '#ffd096') : '#c38a63',
  }).setOrigin(0.5));
  c.add(scene.add.text(forgeX, forgeY + 37, mode === 'craft' ? '단조' : '회수', {
    fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5));

  return WORKBENCH_H;
}

// ─── drawWorkbenchStat ────────────────────────────────────────────────────────

export function drawWorkbenchStat(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL, 0.95);
  g.fillRoundedRect(x, y, w, 22, 5);
  g.lineStyle(1.5, accent, 0.7);
  g.strokeRoundedRect(x, y, w, 22, 5);
  c.add(g);
  c.add(scene.add.text(x + 6, y + 7, label, {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 6, y + 14, value, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: `#${accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5));
}

// ─── drawProgressTrack ────────────────────────────────────────────────────────

export function drawProgressTrack(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: number,
): void {
  const g = scene.add.graphics();
  const fillW = Math.round(w * Phaser.Math.Clamp(ratio, 0, 1));
  g.fillStyle(0x0b0704, 1);
  g.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
  g.fillStyle(color, 0.92);
  g.fillRoundedRect(x, y, Math.max(2, fillW), h, Math.max(2, h / 2));
  g.lineStyle(0.5, color, 0.45);
  g.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));
  c.add(g);
}

// ─── drawForgeRecommendationPreview ──────────────────────────────────────────

export function drawForgeRecommendationPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  recommendation: ForgeRecommendation,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x061815, 0.96);
  g.fillRoundedRect(x, y, w, h, 9);
  g.fillStyle(recommendation.accent, 0.15);
  g.fillRoundedRect(x + 6, y + 7, 42, h - 14, 8);
  g.fillStyle(0x070503, 0.36);
  g.fillRoundedRect(x + w - 72, y + 8, 62, h - 16, 8);
  g.lineStyle(1.2, recommendation.accent, 0.66);
  g.strokeRoundedRect(x, y, w, h, 9);
  g.lineStyle(1, 0xffffff, 0.11);
  g.lineBetween(x + 55, y + 9, x + 55, y + h - 9);
  c.add(g);

  c.add(scene.add.text(x + 27, y + h / 2, recommendation.monsterEmoji, {
    fontFamily: 'sans-serif', fontSize: '20px',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 62, y + 12, title, {
    fontFamily: 'sans-serif', fontSize: '8px', color: '#8fffe0', fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 62, y + 27, truncateLabel(recommendation.monsterName, 8), {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f4ffe9', fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 62, y + 42, `${recommendation.roomLabel} · Lv.${recommendation.monsterLevel}`, {
    fontFamily: 'sans-serif', fontSize: '8px', color: '#9ed0c5',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 41, y + h / 2 - 5, `+${recommendation.powerDelta}`, {
    fontFamily: 'sans-serif', fontSize: '15px', color: '#b8fff0', fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 41, y + h / 2 + 11, '전력', {
    fontFamily: 'sans-serif', fontSize: '8px', color: '#7fb8a8', fontStyle: 'bold',
  }).setOrigin(0.5));
}

// ─── drawEffectChips ──────────────────────────────────────────────────────────

export function drawEffectChips(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  labels: string[],
  x: number,
  y: number,
  accent: number,
  maxWidth: number,
): void {
  let cursorX = x;
  labels.forEach((label, index) => {
    const chipW = Math.min(78, Math.max(50, label.length * 7 + 14));
    if (cursorX + chipW > x + maxWidth) return;
    const g = scene.add.graphics();
    g.fillStyle(0x0b0a07, 0.9);
    g.fillRoundedRect(cursorX, y, chipW, 18, 6);
    g.lineStyle(1, accent, index === 0 ? 0.5 : 0.28);
    g.strokeRoundedRect(cursorX, y, chipW, 18, 6);
    c.add(g);
    c.add(scene.add.text(cursorX + chipW / 2, y + 9, label, {
      fontFamily: 'sans-serif', fontSize: '8px',
      color: index === 0 ? '#fff3be' : '#d2bd8a',
    }).setOrigin(0.5));
    cursorX += chipW + 5;
  });
}

// ─── buildForgeTargetRail ─────────────────────────────────────────────────────

export function buildForgeTargetRail(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  y: number,
): number {
  const targets = getForgeTargetCues(ctx.gs, ctx.focusMonsterId).slice(0, 3);
  if (targets.length === 0) return y;

  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 58;
  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.SHADOW, 0.14);
  bg.fillRoundedRect(x, y + 3, w, h, 10);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(x, y, w, h, 10);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(x + 5, y + 4, w - 10, 5, 3);
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(x, y, w, h, 10);
  c.add(bg);

  c.add(scene.add.text(x + 12, y + 16, '추천 장착 대상', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 12, y + 16, '칩 선택 시 추천 갱신', {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(1, 0.5));

  const chipW = Math.floor((w - 28) / 3);
  targets.forEach((target, index) => {
    const chipX = x + 8 + index * (chipW + 6);
    const chipY = y + 31;
    const active = ctx.focusMonsterId === target.monsterId;
    const chip = scene.add.graphics();
    chip.fillStyle(active ? CASUAL.GREEN : CASUAL.PANEL_SOFT, 1);
    chip.fillRoundedRect(chipX, chipY, chipW, 22, 7);
    chip.fillStyle(0xffffff, active ? 0.28 : 0.18);
    chip.fillRoundedRect(chipX + 4, chipY + 4, 22, 14, 5);
    chip.lineStyle(2, active ? CASUAL.GREEN_DK : CASUAL.EDGE, 1);
    chip.strokeRoundedRect(chipX, chipY, chipW, 22, 7);
    c.add(chip);

    c.add(scene.add.text(chipX + 15, chipY + 11, target.monsterEmoji, {
      fontFamily: 'sans-serif', fontSize: '12px',
    }).setOrigin(0.5));
    c.add(scene.add.text(chipX + 30, chipY + 7, truncateLabel(target.monsterName, 5), {
      fontFamily: 'sans-serif', fontSize: '8px',
      color: active ? '#ffffff' : CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(chipX + 30, chipY + 16, truncateLabel(target.needLabel, 6), {
      fontFamily: 'sans-serif', fontSize: '7px',
      color: active ? '#eafff0' : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(chipX + chipW - 5, chipY + 11, target.roomLabel, {
      fontFamily: 'sans-serif', fontSize: '7px',
      color: active ? '#ffffff' : CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    const zone = scene.add.zone(chipX, chipY, chipW, 22)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onFocusChange(target.monsterId, target.roomLabel));
    c.add(zone);
  });

  return y + h + 8;
}
