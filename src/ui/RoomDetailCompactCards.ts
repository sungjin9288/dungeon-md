// ─── Room Detail Interior Preview ─────────────────────────────────────────────
// RoomDetailOverlay에서 분리한 방 내부 프리뷰 + 컴팩트 로드아웃 드로잉 계층.
// 진입점: buildRoomInteriorPreview (열린 방), drawUnbuiltRoomBlueprintPreview(본체 잔류).

/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { MONSTER_DEFS, type MonsterDef } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import {
  
  
  type MonsterLoadoutRecommendation,
  type TrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import { addPrimaryActionButton } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


import {
  EquipmentBadge, MONSTER_RARITY_META, MONSTER_TYPE_COLOR, MONSTER_TYPE_LABEL } from './RoomDetailShared';

// RoomDetailCompactCards — 컴팩트 로드아웃 카드·추천 슬롯 드로잉

export function fitSlotLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function getCompactTrapEffectLabel(desc: string): string {
  if (desc.includes('이동속도')) return '감속 2초';
  if (desc.includes('피해/초')) return '독 피해';
  if (desc.includes('기절')) return '기절 1초';
  if (desc.includes('피해')) return '진입 피해';
  return fitSlotLabel(desc, 5);
}

export function formatCompactTrapCost(cost: number, unlockLv: number, compact: boolean): string {
  return compact ? `${cost}g Lv${unlockLv}` : `${cost}g · Lv.${unlockLv}`;
}

export function getMonsterRarityMeta(monster: MonsterDef): typeof MONSTER_RARITY_META[keyof typeof MONSTER_RARITY_META] {
  return MONSTER_RARITY_META[monster.rarityTier ?? 'C'] ?? MONSTER_RARITY_META.C;
}

export function drawCollectorCardSkin(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  rarity: ReturnType<typeof getMonsterRarityMeta>,
  owned: boolean,
): void {
  const g = scene.add.graphics();
  g.fillStyle(rarity.color, owned ? 0.16 : 0.08);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.lineStyle(1.5, rarity.color, owned ? 0.7 : 0.3);
  g.lineBetween(x + 48, y + 8, x + w - 12, y + 8);
  g.fillStyle(0xffffff, owned ? 0.5 : 0.2);
  g.fillCircle(x + w - 19, y + 27, 1.4);
  g.fillCircle(x + w - 30, y + 36, 1.1);
  g.fillCircle(x + 12, y + h - 13, 1.2);
  g.fillStyle(rarity.color, owned ? 0.3 : 0.14);
  g.fillCircle(x + 28, y + 35, 20);
  g.fillStyle(0xffffff, 0.9);
  g.fillRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  g.lineStyle(1.5, rarity.color, owned ? 0.85 : 0.45);
  g.strokeRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  c.add(g);
  c.add(scene.add.text(x + w - 30.5, y + 15.5, rarity.label, {
    fontFamily: 'sans-serif',
    fontSize: '6px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 10, y + h - 14, rarity.stars, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
}

export function drawCompactLoadoutSlotFrame(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const cardFill = filled ? CASUAL.PANEL : CASUAL.PANEL_SOFT;
  const cardBorder = filled ? accent : CASUAL.EDGE_SOFT;
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.SHADOW, 0.22);
  g.fillRoundedRect(x + 2, y + 3, w, h, 8);
  g.fillStyle(cardFill, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(CASUAL.PANEL_SOFT, filled ? 0.5 : 0.7);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.fillStyle(0xffffff, 0.7);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(filled ? 3 : 2, cardBorder, filled ? 1 : 0.7);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(x + 5, y + 5, w - 10, 4, 3);
  g.fillStyle(accent, filled ? 0.9 : 0.3);
  g.fillRoundedRect(x + 5, y + 5, w - 10, 4, 3);
  g.fillStyle(0xffffff, 0.85);
  g.fillRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.lineStyle(1.5, cardBorder, filled ? 0.85 : 0.45);
  g.strokeRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.fillStyle(accent, filled ? 0.9 : 0.3);
  g.fillRoundedRect(x + 2, y + 12, 3, h - 24, 2);
  g.fillStyle(accent, filled ? 0.7 : 0.3);
  g.fillCircle(x + w - 9, y + 13, 2.3);
  g.fillCircle(x + w - 9, y + h - 13, 2.3);
  g.lineStyle(1, CASUAL.EDGE_SOFT, filled ? 0.4 : 0.25);
  g.lineBetween(x + 45, y + 18, x + w - 12, y + 18);
  g.lineBetween(x + 45, y + h - 30, x + w - 12, y + h - 30);
  c.add(g);
  c.add(scene.add.text(x + 20, y + 18, slotLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: filled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactAttributeChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
): void {
  const chipW = Math.max(30, Math.min(44, label.length * 11 + 12));
  const chip = scene.add.graphics();
  chip.fillStyle(accent, 1);
  chip.fillRoundedRect(x, y, chipW, 13, 5);
  chip.fillStyle(0xffffff, 0.3);
  chip.fillRoundedRect(x + 2, y + 2, chipW - 4, 3, 2);
  chip.lineStyle(1.5, CASUAL.EDGE, 0.45);
  chip.strokeRoundedRect(x, y, chipW, 13, 5);
  c.add(chip);
  c.add(scene.add.text(x + chipW / 2 + 2, y + 6.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#ffffff',
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge | null,
  accent: number,
): void {
  const socket = scene.add.graphics();
  const filled = Boolean(equipment);
  socket.fillStyle(filled ? CASUAL.GOLD : CASUAL.PANEL_SOFT, 1);
  socket.fillCircle(x, y, 8);
  socket.lineStyle(1.5, filled ? CASUAL.GOLD_DK : accent, filled ? 0.9 : 0.6);
  socket.strokeCircle(x, y, 8);
  socket.fillStyle(filled ? 0xffffff : accent, filled ? 0.3 : 0.16);
  socket.fillCircle(x, y, 5);
  c.add(socket);
  if (equipment) {
    c.add(scene.add.text(x, y, equipment.icon, {
      fontFamily: 'sans-serif',
      fontSize: '10px' }).setOrigin(0.5));
    return;
  }
  c.add(scene.add.text(x, y, '◇', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addCompactEmptySlotGlyph(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  icon: string,
): void {
  const glyph = scene.add.graphics();
  glyph.fillStyle(0xffffff, 0.85);
  glyph.fillRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.lineStyle(2, accent, 0.55);
  glyph.strokeRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.fillStyle(accent, 0.14);
  glyph.fillRoundedRect(x - 11, y - 11, 22, 22, 6);
  glyph.lineStyle(1.5, accent, 0.4);
  glyph.lineBetween(x - 9, y, x + 9, y);
  glyph.lineBetween(x, y - 9, x, y + 9);
  glyph.lineStyle(1, accent, 0.22);
  glyph.strokeCircle(x, y, 14);
  c.add(glyph);
  c.add(scene.add.text(x, y, icon, {
    fontFamily: 'sans-serif',
    fontSize: '17px',
    color: CASUAL_CSS.INK_SOFT }).setOrigin(0.5).setAlpha(0.8));
}

export function drawCompactGrowthMeter(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  xp: number,
  accent: number,
): void {
  const ready = xp >= 100;
  const progress = ready ? 1 : Phaser.Math.Clamp((xp % 100) / 100, 0, 1);
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, w, 5, 3);
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.5);
  g.strokeRoundedRect(x, y, w, 5, 3);
  g.fillStyle(ready ? CASUAL.GOLD : accent, 1);
  g.fillRoundedRect(x + 1, y + 1, Math.max(4, (w - 2) * progress), 3, 2);
  g.fillStyle(0xffffff, ready ? 0.5 : 0.3);
  g.fillCircle(x + w - 4, y + 2.5, 2);
  c.add(g);
  c.add(scene.add.text(x + w, y - 5, ready ? 'UP' : `${Math.round(progress * 100)}%`, {
    fontFamily: 'sans-serif',
    fontSize: '6px',
    color: ready ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(1, 0.5));
}

export function drawCompactTrapEffectTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  desc: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1.5, accent, 0.5);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.8);
  g.fillRoundedRect(x + 3, y - 3, 4, 8, 3);
  c.add(g);
  c.add(scene.add.text(x + 10, y + 1, fitSlotLabel(getCompactTrapEffectLabel(desc), w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function drawCompactEmptyTrapPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 0.85);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.4);
  for (let sx = x + 4; sx < x + w - 5; sx += 8) {
    g.fillRoundedRect(sx, y - 1, 4, 2, 1);
  }
  c.add(g);
  c.add(scene.add.text(x + 9, y + 1, w < 58 ? '차단' : '경로 차단', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function drawCompactMonsterRoleTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1.5, accent, 0.5);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.9);
  g.fillCircle(x + 7, y + 1, 3);
  c.add(g);
  c.add(scene.add.text(x + 13, y + 1, fitSlotLabel(label, w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function getCompactMonsterRoleLabel(recommendation: MonsterLoadoutRecommendation): string {
  const [primaryReason] = recommendation.reason.split('·').map(part => part.trim());
  return primaryReason || '수호 배치';
}

export function drawCompactEmptyMonsterPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 0.85);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.4);
  g.fillCircle(x + 7, y + 1, 3);
  g.fillCircle(x + 17, y + 1, 2.4);
  g.fillCircle(x + 27, y + 1, 1.8);
  c.add(g);
  c.add(scene.add.text(x + 36, y + 1, w < 58 ? '대기' : '대기 라인', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
}

export function drawCompactRoomTypeStateTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  isActive: boolean,
  isRecommended: boolean,
): void {
  const tagW = Math.max(32, Math.min(42, 20 + label.length * 10));
  const highlight = isActive || isRecommended;
  const g = scene.add.graphics();
  g.fillStyle(highlight ? accent : CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, tagW, 16, 6);
  g.fillStyle(0xffffff, highlight ? 0.3 : 0.4);
  g.fillRoundedRect(x + 2, y + 2, tagW - 4, 3, 2);
  g.lineStyle(1.5, highlight ? accent : CASUAL.EDGE_SOFT, highlight ? 0.6 : 0.6);
  g.strokeRoundedRect(x, y, tagW, 16, 6);
  if (!highlight) {
    g.fillStyle(accent, 0.7);
    g.fillCircle(x + 8, y + 8, 3);
  }
  c.add(g);
  c.add(scene.add.text(x + tagW / 2, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: highlight ? '#ffffff' : CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0.5));
}

export function addRecommendedMonsterSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: MonsterLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const recommendedDef = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS];
  const rarity = recommendedDef ? getMonsterRarityMeta(recommendedDef) : MONSTER_RARITY_META.C;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 0.16);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(3, rarity.color, 1);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 1);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0xffffff, 0.14);
  g.fillRoundedRect(x + 7, y + 7, w - 14, 4, 2);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffffff',
    fontStyle: 'bold' }).setOrigin(0.5));
  addMonsterPortrait(scene, c, x + 27, y + 35, recommendation.monsterId, {
    size: 36,
    frameColor: rarity.color,
    glowColor: rarity.color,
    bgColor: 0x070908,
    equippedSkins: {} });
  c.add(scene.add.text(x + 8, y + h - 12, rarity.stars, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  const recommendedType = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS]?.type;
  if (recommendedType) {
    addCompactAttributeChip(
      scene,
      c,
      x + 52,
      y + 20,
      MONSTER_TYPE_LABEL[recommendedType] ?? recommendedType,
      MONSTER_TYPE_COLOR[recommendedType] ?? recommendation.accent,
    );
  }
  c.add(scene.add.text(x + 52, y + 36, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  drawCompactMonsterRoleTag(
    scene,
    c,
    x + 52,
    y + 48,
    Math.max(38, w - 63),
    getCompactMonsterRoleLabel(recommendation),
    recommendation.accent,
  );
  c.add(scene.add.text(x + 52, y + 61, `ATK ${recommendation.attack}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.GOLD,
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 27, btnW, compact ? '추천' : '추천 배치', recommendation.accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 27, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

export function addRecommendedTrapSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: TrapLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const trapDef = TRAP_DEFS.find(trap => trap.id === recommendation.trapId);
  const effectDesc = trapDef?.desc ?? recommendation.reason;
  const unlockLv = trapDef?.unlockLv ?? 0;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 0.14);
  g.fillRoundedRect(x + 9, y + 27, 38, h - 37, 8);
  g.lineStyle(3, accent, 1);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 1);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x + 27, y + 33, 18);
  g.lineStyle(2, accent, 0.85);
  g.strokeCircle(x + 27, y + 33, 18);
  g.fillStyle(accent, 0.16);
  g.fillCircle(x + 27, y + 33, 12);
  g.fillStyle(0xffffff, 0.14);
  g.fillRoundedRect(x + 7, y + 7, w - 14, 4, 2);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffffff',
    fontStyle: 'bold' }).setOrigin(0.5));
  c.add(scene.add.text(x + 27, y + 33, recommendation.icon, {
    fontFamily: 'sans-serif',
    fontSize: '19px' }).setOrigin(0.5));
  c.add(scene.add.text(x + 52, y + 29, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold' }).setOrigin(0, 0.5));
  drawCompactTrapEffectTag(
    scene,
    c,
    x + 52,
    y + 43,
    Math.max(38, w - 63),
    effectDesc,
    accent,
  );
  c.add(scene.add.text(x + 52, y + 58, formatCompactTrapCost(recommendation.cost, unlockLv, compact), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.GOLD,
    fontStyle: 'bold' }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 25, btnW, compact ? '추천' : '추천 설치', accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 25, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

export function addCompactLoadoutButton(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
  onPress: () => void,
  primary = false,
): void {
  const button = addPrimaryActionButton(scene, {
    x,
    y,
    w,
    h: 22,
    label,
    fontSize: '10px',
    fillColor: primary ? accent : CASUAL.PANEL,
    hoverFillColor: primary ? accent : CASUAL.PANEL_SOFT,
    borderColor: primary ? accent : CASUAL.EDGE,
    hoverBorderColor: primary ? accent : CASUAL.EDGE_SOFT,
    textColor: primary ? '#ffffff' : CASUAL_CSS.INK,
    onPress });
  c.add([button.bg, button.text, button.zone]);
}


