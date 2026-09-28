// ─── Barracks roster card ────────────────────────────────────────────────────
// Full-width guardian records keep portrait, growth, equipment, and room context
// readable on the 390px mobile canvas. State and navigation remain scene-owned.

import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { xpToNextLevel, getOwnedMonsterBattleAtk, type OwnedMonster } from '../data/barracks';
import { addPanelShadow } from './PanelDepth';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawGrowthSigil, drawReinforcementSigil } from './BarracksSkin';
import {
  CARD_W,
  CARD_H,
  SUMMON_ROW_H,
  getMonsterCollectionMeta,
  getMonsterTypeMeta,
  getEquipmentDisplay,
  getDeployedMonsterIds,
  getMonsterRoomPlan,
  getMonsterCardActionCue,
  truncateLabel,
} from './BarracksShared';
import type { GameState } from '../data/wisdom';

export interface BarracksCardContext {
  readonly gs: GameState;
  readonly focusMonsterId: string | null;
  readonly contentContainer: Phaser.GameObjects.Container;
  readonly onSelect: (m: OwnedMonster) => void;
  readonly tweens: Phaser.Tweens.TweenManager;
}

export function buildMonsterCard(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  monster: OwnedMonster,
  x: number,
  y: number,
): void {
  const def = resolveOwnedMonsterProfile(monster.id);
  if (!def) return;

  const isFocused = ctx.focusMonsterId === monster.id;
  const collection = getMonsterCollectionMeta(monster, def);
  const type = getMonsterTypeMeta(def.type);
  const xpNeeded = xpToNextLevel(monster.level);
  const xpPct = monster.level >= 50 ? 1 : Math.min(1, monster.xp / xpNeeded);
  const atk = getOwnedMonsterBattleAtk(def.baseDamage, monster, ctx.gs);
  const deployed = getDeployedMonsterIds(ctx.gs).has(monster.id);
  const equipment = getEquipmentDisplay(ctx.gs, monster.equipment ?? null);
  const roomPlan = getMonsterRoomPlan(ctx.gs, monster);
  // Same ownership test as equipMonsterEquipment: starter/owned ids plus crafted ones.
  const equippable = new Set([
    ...(ctx.gs.ownedEquipment ?? []),
    ...(ctx.gs.craftedEquipment ?? []).map(item => item.id),
  ]).size;
  const action = getMonsterCardActionCue(monster, xpPct, Boolean(equipment), deployed, roomPlan, equippable);
  const skillCount = (monster.equippedSkills ?? []).length;

  ctx.contentContainer.add(
    addPanelShadow(scene, x, y, CARD_W, CARD_H, 8, { offsetY: 4, opacity: 0.5 }),
  );

  if (isFocused) {
    const focus = scene.add.graphics();
    focus.fillStyle(DUNGEON_UI.JADE, 0.08);
    focus.fillRoundedRect(x - 3, y - 3, CARD_W + 6, CARD_H + 6, 10);
    focus.lineStyle(2, DUNGEON_UI.BRASS_BRIGHT, 0.9);
    focus.strokeRoundedRect(x - 3, y - 3, CARD_W + 6, CARD_H + 6, 10);
    ctx.tweens.add({
      targets: focus,
      alpha: { from: 0.72, to: 1 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    ctx.contentContainer.add(focus);
  }

  const card = scene.add.graphics();
  card.fillStyle(DUNGEON_UI.STONE, 1);
  card.fillRoundedRect(x, y, CARD_W, CARD_H, 8);
  card.fillStyle(DUNGEON_UI.STONE_RAISED, 0.72);
  card.fillRoundedRect(x + 7, y + 7, 94, CARD_H - 14, 6);
  card.fillStyle(collection.color, collection.rank >= 3 ? 0.16 : 0.09);
  card.fillRect(x + 1, y + 1, 4, CARD_H - 2);
  card.lineStyle(collection.rank >= 3 ? 2 : 1.5, collection.color, collection.rank >= 3 ? 0.82 : 0.5);
  card.strokeRoundedRect(x, y, CARD_W, CARD_H, 8);
  card.lineStyle(1, DUNGEON_UI.EDGE, 0.46);
  card.lineBetween(x + 108, y + 10, x + 108, y + CARD_H - 10);
  card.fillStyle(0xffffff, 0.06);
  card.fillRect(x + 10, y + 5, CARD_W - 20, 2);
  ctx.contentContainer.add(card);

  addMonsterPortrait(scene, ctx.contentContainer, x + 54, y + 59, monster.id, {
    size: 84,
    frameColor: collection.color,
    glowColor: type.color,
    bgColor: DUNGEON_UI.SOOT,
    equippedSkins: ctx.gs.equippedSkins ?? {},
  });

  ctx.contentContainer.add(scene.add.text(x + 54, y + 111, type.label, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: type.text,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 54, y + 127, collection.stars, {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: collection.css,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 54, y + 146, `Lv.${monster.level}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 54, y + 163, `ATK ${atk}`, {
    fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));

  const infoX = x + 120;
  const infoW = CARD_W - 132;
  ctx.contentContainer.add(scene.add.text(infoX, y + 16, `${collection.tier} · ${collection.label}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: collection.css,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 14, y + 16, deployed ? '방어선 배치중' : '배치 대기', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: deployed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));
  ctx.contentContainer.add(scene.add.text(infoX, y + 32, def.name, {
    fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  if ((monster.skillPoints ?? 0) > 0) {
    ctx.contentContainer.add(scene.add.text(x + CARD_W - 14, y + 32, `SP ${monster.skillPoints}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#d9b2f2',
    }).setOrigin(1, 0.5));
  }

  const xp = scene.add.graphics();
  xp.fillStyle(DUNGEON_UI.SOOT, 1);
  xp.fillRoundedRect(infoX, y + 57, infoW, 8, 3);
  xp.fillStyle(xpPct >= 0.82 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 1);
  xp.fillRoundedRect(infoX, y + 57, Math.max(3, Math.round(infoW * xpPct)), 8, 3);
  xp.lineStyle(1, DUNGEON_UI.EDGE, 0.48);
  xp.strokeRoundedRect(infoX, y + 57, infoW, 8, 3);
  ctx.contentContainer.add(xp);
  ctx.contentContainer.add(scene.add.text(infoX, y + 52, monster.level >= 50 ? '최대 성장' : `EXP ${monster.xp}/${xpNeeded}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 1));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 14, y + 52, `${Math.round(xpPct * 100)}%`, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
  }).setOrigin(1, 1));

  drawInfoRail(scene, ctx, infoX, y + 73, infoW, 24, roomPlan.accent,
    roomPlan.label, roomPlan.subLabel);
  drawInfoRail(scene, ctx, infoX, y + 101, infoW, 22,
    equipment ? DUNGEON_UI.BRASS : DUNGEON_UI.EDGE,
    equipment ? `장비 ${truncateLabel(equipment.name, 11)}` : '장비 미장착',
    `스킬 ${skillCount}/2`);

  const actionBg = scene.add.graphics();
  actionBg.fillStyle(DUNGEON_UI.SOOT, 0.96);
  actionBg.fillRoundedRect(infoX, y + 130, infoW, 40, 6);
  actionBg.fillStyle(action.accent, 0.15);
  actionBg.fillRoundedRect(infoX + 4, y + 134, 34, 32, 5);
  actionBg.lineStyle(1.5, action.accent, 0.72);
  actionBg.strokeRoundedRect(infoX, y + 130, infoW, 40, 6);
  drawGrowthSigil(actionBg, infoX + 21, y + 150, action.accent, 0.94);
  ctx.contentContainer.add(actionBg);
  ctx.contentContainer.add(scene.add.text(infoX + 47, y + 143, action.label, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: action.textColor,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(infoX + 47, y + 158, action.subLabel, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 25, y + 150, `${action.chip}  ›`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: `#${action.accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5));

  const zone = scene.add.zone(x, y, CARD_W, CARD_H)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });
  zone.setName(`barracks-card-${monster.id}`);
  zone.on('pointerdown', () => ctx.onSelect(monster));
  ctx.contentContainer.add(zone);
}

export function buildSummonSlot(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 0.98);
  bg.fillRoundedRect(x, y, CARD_W, SUMMON_ROW_H, 8);
  bg.fillStyle(DUNGEON_UI.BRASS, 0.12);
  bg.fillRoundedRect(x + 10, y + 9, 54, SUMMON_ROW_H - 18, 7);
  bg.lineStyle(1.5, DUNGEON_UI.BRASS, 0.68);
  bg.strokeRoundedRect(x, y, CARD_W, SUMMON_ROW_H, 8);
  drawReinforcementSigil(bg, x + 37, y + SUMMON_ROW_H / 2, DUNGEON_UI.BRASS_BRIGHT, 0.9);
  ctx.contentContainer.add(bg);

  ctx.contentContainer.add(scene.add.text(x + 78, y + 24, '새 수호자 영입', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + 78, y + 45, '소환소에서 군단 후보를 확보합니다', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 18, y + SUMMON_ROW_H / 2, '소환소  ›', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(1, 0.5));

  const zone = scene.add.zone(x, y, CARD_W, SUMMON_ROW_H)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => scene.scene.start('SummonScene'));
  ctx.contentContainer.add(zone);
}

function drawInfoRail(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
  value: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 0.82);
  g.fillRoundedRect(x, y, w, h, 5);
  g.fillStyle(accent, 0.82);
  g.fillRoundedRect(x + 3, y + 4, 3, h - 8, 2);
  g.lineStyle(1, DUNGEON_UI.IRON, 0.76);
  g.strokeRoundedRect(x, y, w, h, 5);
  ctx.contentContainer.add(g);
  ctx.contentContainer.add(scene.add.text(x + 12, y + h / 2, truncateLabel(label, 13), {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + w - 9, y + h / 2, truncateLabel(value, 13), {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));
}
