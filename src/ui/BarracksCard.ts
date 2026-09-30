// ─── Barracks roster tiles ───────────────────────────────────────────────────
// A three-column collection grid: portrait, rarity, level/ATK and the next step
// per guardian. Room plan, equipment and skills live in the detail panel.
// State and navigation remain scene-owned.

import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { xpToNextLevel, getOwnedMonsterBattleAtk, type OwnedMonster } from '../data/barracks';
import { addPanelShadow } from './PanelDepth';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawReinforcementSigil } from './BarracksSkin';
import {
  CARD_W,
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
  /** Copies owned per kind (spares are evolution/absorption material); absent = 1. */
  readonly copyCounts?: ReadonlyMap<string, number>;
}

/** 3열 보관함 타일 — 한 화면에 9~12체. 세부(배치 계획·장비·스킬)는 탭하면 여는 상세 창에 있다. */
export const TILE_COLS = 3;
export const TILE_GAP = 8;
export const TILE_W = Math.floor((CARD_W - TILE_GAP * (TILE_COLS - 1)) / TILE_COLS);
export const TILE_H = 162;

export function buildMonsterTile(
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
  const cx = x + TILE_W / 2;

  ctx.contentContainer.add(addPanelShadow(scene, x, y, TILE_W, TILE_H, 8, { offsetY: 3, opacity: 0.45 }));
  if (isFocused) {
    const focus = scene.add.graphics();
    focus.lineStyle(2, DUNGEON_UI.BRASS_BRIGHT, 0.95);
    focus.strokeRoundedRect(x - 3, y - 3, TILE_W + 6, TILE_H + 6, 10);
    ctx.tweens.add({ targets: focus, alpha: { from: 0.6, to: 1 }, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    ctx.contentContainer.add(focus);
  }

  const card = scene.add.graphics();
  card.fillStyle(DUNGEON_UI.STONE, 1);
  card.fillRoundedRect(x, y, TILE_W, TILE_H, 8);
  card.fillStyle(collection.color, collection.rank >= 3 ? 0.18 : 0.1);
  card.fillRoundedRect(x + 3, y + 3, TILE_W - 6, 90, 6);
  card.lineStyle(collection.rank >= 3 ? 2 : 1.5, collection.color, collection.rank >= 3 ? 0.9 : 0.55);
  card.strokeRoundedRect(x, y, TILE_W, TILE_H, 8);
  // Rarity tier tab (top-left) and deployment dot (top-right).
  card.fillStyle(collection.color, 0.95);
  card.fillRoundedRect(x + 5, y + 5, 20, 15, 4);
  card.fillStyle(deployed ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, 1);
  card.fillCircle(x + TILE_W - 11, y + 12, 4);
  ctx.contentContainer.add(card);
  ctx.contentContainer.add(scene.add.text(x + 15, y + 12.5, collection.tier, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#140d06',
  }).setOrigin(0.5));

  addMonsterPortrait(scene, ctx.contentContainer, cx, y + 52, monster.id, {
    size: 74,
    frameColor: collection.color,
    glowColor: type.color,
    bgColor: DUNGEON_UI.SOOT,
    equippedSkins: ctx.gs.equippedSkins ?? {},
  });
  // Spare copies (3-of-a-kind evolution, absorption fodder) ride on the one tile's name line.
  const copies = ctx.copyCounts?.get(monster.id) ?? 1;

  ctx.contentContainer.add(scene.add.text(cx, y + 101, `${truncateLabel(def.name, copies > 1 ? 6 : 7)}${copies > 1 ? ` ×${copies}` : ''}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(cx, y + 117, `Lv.${monster.level} · ATK ${atk}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));

  // XP sliver under the stats.
  const xp = scene.add.graphics();
  xp.fillStyle(DUNGEON_UI.SOOT, 1);
  xp.fillRoundedRect(x + 10, y + 125, TILE_W - 20, 4, 2);
  xp.fillStyle(xpPct >= 0.82 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 1);
  xp.fillRoundedRect(x + 10, y + 125, Math.max(2, Math.round((TILE_W - 20) * xpPct)), 4, 2);
  // Next-step chip: the one thing worth doing for this guardian.
  xp.fillStyle(action.fill, 1);
  xp.fillRoundedRect(x + 6, y + 134, TILE_W - 12, 22, 6);
  xp.lineStyle(1.2, action.accent, 0.8);
  xp.strokeRoundedRect(x + 6, y + 134, TILE_W - 12, 22, 6);
  ctx.contentContainer.add(xp);
  ctx.contentContainer.add(scene.add.text(cx, y + 145, truncateLabel(action.label, 8), {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: action.textColor,
  }).setOrigin(0.5));

  const zone = scene.add.zone(x, y, TILE_W, TILE_H).setOrigin(0).setInteractive({ useHandCursor: true });
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
