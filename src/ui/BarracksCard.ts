// ─── Barracks Card ────────────────────────────────────────────────────────────
// buildMonsterCard + drawCollectionCardStickers.
// Context object carries scene-owned state; no `this` usage here.

import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { ACTIVE_SKILLS, xpToNextLevel, getMonsterAtk, type OwnedMonster } from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import { addPanelShadow, addInnerGlow } from '../ui/PanelDepth';
import {
  CARD_W,
  CARD_H,
  getMonsterCollectionMeta,
  getMonsterTypeMeta,
  getEquipmentDisplay,
  getDeployedMonsterIds,
  getMonsterRoomPlan,
  getMonsterCardActionCue,
  truncateLabel,
  type MonsterCollectionMeta,
} from './BarracksShared';
import type { GameState } from '../data/wisdom';

// ─── Context interface ────────────────────────────────────────────────────────

export interface BarracksCardContext {
  readonly gs: GameState;
  readonly focusMonsterId: string | null;
  readonly contentContainer: Phaser.GameObjects.Container;
  readonly onSelect: (m: OwnedMonster) => void;
  /** Returns a live tween builder so focus pulse can be attached. */
  readonly tweens: Phaser.Tweens.TweenManager;
}

// ─── buildMonsterCard ─────────────────────────────────────────────────────────

export function buildMonsterCard(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  m: OwnedMonster,
  x: number,
  y: number,
): void {
  const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
  if (!def) return;

  const isFocused     = ctx.focusMonsterId === m.id;
  const collectionMeta = getMonsterCollectionMeta(m, def);
  const rarity        = collectionMeta.rank;
  const borderColor   = collectionMeta.color;
  const borderAlpha   = rarity >= 4 ? 1 : rarity >= 2 ? 0.9 : 0.72;
  const xpNeeded      = xpToNextLevel(m.level);
  const xpPct         = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const sp            = m.skillPoints ?? 0;
  const typeMeta      = getMonsterTypeMeta(def.type);
  const deployedIds   = getDeployedMonsterIds(ctx.gs);
  const isDeployed    = deployedIds.has(m.id);

  // Drop shadow
  ctx.contentContainer.add(
    addPanelShadow(scene, x, y, CARD_W, CARD_H, 10, { offsetY: 3, opacity: 0.55 }),
  );

  // Focus ring
  if (isFocused) {
    const focus = scene.add.graphics();
    focus.fillStyle(0x66c08a, 0.08);
    focus.fillRoundedRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, 12);
    focus.lineStyle(2, 0xc8e8b0, 0.92);
    focus.strokeRoundedRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, 12);
    focus.lineStyle(1, 0xffffff, 0.24);
    focus.strokeRoundedRect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, 8);
    ctx.tweens.add({
      targets:  focus,
      alpha:    { from: 0.72, to: 1 },
      duration: 720,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
    ctx.contentContainer.add(focus);
  }

  // Card background
  const bg = scene.add.graphics();
  bg.fillStyle(rarity >= 3 ? 0x1a0d2e : COLORS.STONE_DARK, 1);
  bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
  bg.lineStyle(rarity >= 4 ? 2.5 : 2, borderColor, borderAlpha);
  bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
  if (rarity >= 4) {
    bg.lineStyle(1, borderColor, 0.3);
    bg.strokeRoundedRect(x + 3, y + 3, CARD_W - 6, CARD_H - 6, 8);
  }
  ctx.contentContainer.add(bg);

  // Top bevel
  ctx.contentContainer.add(
    addInnerGlow(scene, x, y, CARD_W, CARD_H, 10, borderColor, rarity >= 3 ? 0.18 : 0.12),
  );

  // Portrait chamber
  const chamber = scene.add.graphics();
  chamber.fillStyle(0x071010, 0.86);
  chamber.fillRoundedRect(x + 9, y + 20, CARD_W - 18, 62, 8);
  chamber.fillStyle(typeMeta.color, 0.10);
  chamber.fillRoundedRect(x + 14, y + 27, CARD_W - 28, 41, 7);
  chamber.fillStyle(0xffffff, 0.06);
  chamber.fillRoundedRect(x + 18, y + 25, CARD_W - 36, 4, 2);
  chamber.fillStyle(typeMeta.color, 0.18);
  chamber.fillEllipse(x + CARD_W / 2, y + 68, CARD_W - 54, 12);
  chamber.fillStyle(0x070503, 0.35);
  chamber.fillEllipse(x + CARD_W / 2, y + 72, CARD_W - 72, 6);
  chamber.lineStyle(1, typeMeta.color, 0.34);
  chamber.strokeRoundedRect(x + 9, y + 20, CARD_W - 18, 62, 8);
  chamber.fillStyle(typeMeta.color, 0.18);
  chamber.fillRoundedRect(x + 14, y + 75, CARD_W - 28, 4, 2);
  ctx.contentContainer.add(chamber);

  drawMonsterCardPortraitHalo(scene, ctx, x, y, collectionMeta, typeMeta.color, xpPct, isDeployed, sp);
  drawMonsterCardCollectionHeader(scene, ctx, x, y, collectionMeta, typeMeta.color, isDeployed, xpPct, sp);

  const typeRibbon = scene.add.text(x + 10, y + 10, typeMeta.label, {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: typeMeta.text,
    backgroundColor: '#111615',
    padding: { x: 4, y: 2 },
  }).setOrigin(0, 0.5);
  ctx.contentContainer.add(typeRibbon);

  if (isFocused) {
    const focusChip = scene.add.text(x + 10, y + 12, '방 선택', {
      fontFamily:      'sans-serif',
      fontSize:        '9px',
      color:           '#061016',
      fontStyle:       'bold',
      backgroundColor: '#c8e8b0',
      padding:         { x: 5, y: 2 },
    }).setOrigin(0, 0.5);
    ctx.contentContainer.add(focusChip);
  }

  // Portrait image or emoji
  const cardSkin        = getSkinForMonster(m.id, ctx.gs.equippedSkins ?? {});
  const cardPortraitKey = generatePortrait(scene, m.id as MonsterId, cardSkin?.id);
  if (scene.textures.exists(cardPortraitKey)) {
    const cardPortrait = scene.add.image(x + CARD_W / 2, y + 48, cardPortraitKey)
      .setOrigin(0.5).setDisplaySize(54, 54);
    ctx.contentContainer.add(cardPortrait);
  } else {
    const emoji = scene.add.text(x + CARD_W / 2, y + 48, cardSkin ? cardSkin.emoji : def.emoji, {
      fontFamily: 'sans-serif', fontSize: '48px',
    }).setOrigin(0.5);
    ctx.contentContainer.add(emoji);
  }

  drawCollectionCardStickers(scene, ctx, x, y, collectionMeta, typeMeta.color);

  // Level badge
  const lvBg = scene.add.graphics();
  lvBg.fillStyle(COLORS.STONE_MID, 1);
  lvBg.fillRoundedRect(x + CARD_W - 38, y + 6, 32, 18, 4);
  ctx.contentContainer.add(lvBg);
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 22, y + 15, `Lv.${m.level}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5));

  // Name
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 91, def.name, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT,
  }).setOrigin(0.5));

  // ATK stat
  const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 106, `ATK ${atk}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#ff9944',
  }).setOrigin(0.5));

  // XP bar
  const barW  = CARD_W - 20;
  const barBg = scene.add.graphics();
  barBg.fillStyle(0x1a1a1a, 1);
  barBg.fillRoundedRect(x + 10, y + 121, barW, 9, 3);
  barBg.fillStyle(xpPct >= 0.82 ? 0x55d4ff : 0x44aa44, 1);
  barBg.fillRoundedRect(x + 10, y + 121, Math.round(barW * xpPct), 9, 3);
  ctx.contentContainer.add(barBg);
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 125,
    m.level >= 50 ? 'MAX' : `XP ${Math.round(xpPct * 100)}%`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#dfffe0',
    }).setOrigin(0.5));

  // Room plan chip
  const roomPlan  = getMonsterRoomPlan(ctx.gs, m);
  const roomPlanG = scene.add.graphics();
  roomPlanG.fillStyle(0x0b1010, 0.92);
  roomPlanG.fillRoundedRect(x + 13, y + 138, CARD_W - 26, 17, 5);
  roomPlanG.lineStyle(1, roomPlan.accent, roomPlan.kind === 'deployed' ? 0.66 : 0.42);
  roomPlanG.strokeRoundedRect(x + 13, y + 138, CARD_W - 26, 17, 5);
  roomPlanG.fillStyle(roomPlan.accent, roomPlan.kind === 'deployed' ? 0.16 : 0.08);
  roomPlanG.fillRoundedRect(x + 16, y + 141, 4, 11, 3);
  ctx.contentContainer.add(roomPlanG);
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 146.5,
    truncateLabel(roomPlan.label, 13), {
      fontFamily: 'sans-serif',
      fontSize:   '8px',
      color:      roomPlan.kind === 'deployed' ? '#e8fff3' : '#d8c7a0',
      fontStyle:  'bold',
    }).setOrigin(0.5));

  // Skill chips
  const equippedSkills = m.equippedSkills ?? [];
  const skillsText = equippedSkills.length > 0
    ? equippedSkills.map(sk => ACTIVE_SKILLS.find(s => s.id === sk)?.icon ?? '?').join(' ')
    : '스킬';
  ctx.contentContainer.add(scene.add.text(x + 20, y + 164, skillsText, {
    fontFamily: 'sans-serif', fontSize: '9px',
    color: equippedSkills.length > 0 ? '#aaaaff' : '#cc9060',
  }).setOrigin(0.5));

  // Equipment slot
  const eqId  = m.equipment;
  const eqDef = getEquipmentDisplay(ctx.gs, eqId ?? null);
  const eqBg  = scene.add.graphics();
  eqBg.fillStyle(eqDef ? 0x3a2800 : 0x1a1a1a, 1);
  eqBg.fillRoundedRect(x + 35, y + 156, CARD_W - 50, 21, 6);
  eqBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.7);
  eqBg.strokeRoundedRect(x + 35, y + 156, CARD_W - 50, 21, 6);
  ctx.contentContainer.add(eqBg);
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2 + 10, y + 166.5,
    eqDef ? `${eqDef.icon} ${truncateLabel(eqDef.name, 7)}` : '장비 제작 추천', {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: eqDef ? CSS.TORCH_AMBER : '#666666',
    }).setOrigin(0.5));

  // Action cue bar
  const actionCue = getMonsterCardActionCue(m, xpPct, Boolean(eqDef), isDeployed, roomPlan);
  const actionBg  = scene.add.graphics();
  actionBg.fillStyle(0x070503, 0.34);
  actionBg.fillRoundedRect(x + 12, y + 187, CARD_W - 24, 25, 7);
  actionBg.fillStyle(actionCue.fill, 0.98);
  actionBg.fillRoundedRect(x + 10, y + 184, CARD_W - 20, 27, 7);
  actionBg.fillStyle(actionCue.accent, 0.16);
  actionBg.fillRoundedRect(x + 15, y + 189, 27, 17, 6);
  actionBg.fillStyle(0x070b08, 0.78);
  actionBg.fillRoundedRect(x + CARD_W - 55, y + 189, 38, 16, 6);
  actionBg.lineStyle(1.3, actionCue.accent, 0.62);
  actionBg.strokeRoundedRect(x + 10, y + 184, CARD_W - 20, 27, 7);
  actionBg.lineStyle(1, 0xffffff, 0.10);
  actionBg.lineBetween(x + 47, y + 190, x + 47, y + 205);
  ctx.contentContainer.add(actionBg);
  ctx.contentContainer.add(scene.add.text(x + 28.5, y + 197, actionCue.icon, {
    fontFamily: 'sans-serif', fontSize: '13px',
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 53, y + 193, truncateLabel(actionCue.label, 7), {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: actionCue.textColor,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + 53, y + 204, truncateLabel(actionCue.subLabel, 10), {
    fontFamily: 'sans-serif', fontSize: '7px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 36, y + 197, actionCue.chip, {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: `#${actionCue.accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(0.5));

  // SP badge
  if (sp > 0) {
    const spBadgeBg = scene.add.graphics();
    spBadgeBg.fillStyle(0xdd2222, 1);
    spBadgeBg.fillRoundedRect(x + CARD_W - 38, y + 27, 32, 15, 4);
    ctx.contentContainer.add(spBadgeBg);
    ctx.contentContainer.add(scene.add.text(x + CARD_W - 22, y + 34, `SP ${sp > 9 ? '9+' : sp}`, {
      fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
  }

  // Tap zone
  const zone = scene.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
  zone.on('pointerdown', () => ctx.onSelect(m));
  ctx.contentContainer.add(zone);
}

// ─── buildSummonSlot ──────────────────────────────────────────────────────────

export function buildSummonSlot(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.22);
  bg.fillRoundedRect(x + 2, y + 3, CARD_W, CARD_H, 10);
  bg.fillStyle(0x1b1021, 0.88);
  bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
  bg.lineStyle(2, COLORS.TORCH_GOLD, 0.62);
  bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
  bg.lineStyle(1, 0xffffff, 0.10);
  bg.strokeRoundedRect(x + 5, y + 5, CARD_W - 10, CARD_H - 10, 8);
  bg.fillStyle(0xc978ff, 0.10);
  bg.fillCircle(x + CARD_W / 2, y + 78, 46);
  bg.fillStyle(COLORS.TORCH_GOLD, 0.16);
  bg.fillRoundedRect(x + 18, y + 22, CARD_W - 36, 92, 10);
  bg.lineStyle(1, COLORS.TORCH_GOLD, 0.36);
  bg.strokeRoundedRect(x + 18, y + 22, CARD_W - 36, 92, 10);
  ctx.contentContainer.add(bg);

  ctx.contentContainer.add(scene.add.text(x + 14, y + 15, 'PACK', {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: '#f6eaff', backgroundColor: '#2a1838', padding: { x: 5, y: 2 },
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 14, y + 15, 'NEW', {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: '#241300', backgroundColor: '#ffd878', padding: { x: 5, y: 2 },
  }).setOrigin(1, 0.5));

  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 68, '✨', {
    fontFamily: 'sans-serif', fontSize: '38px',
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 124, '새 몬스터 카드팩', {
    fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 144, '도감 확장 · 성장 후보 획득', {
    fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  const dots = scene.add.graphics();
  [0x8f98a5, 0x58c681, 0x62a8ff, 0xc978ff, 0xffc857].forEach((color, i) => {
    const cx = x + CARD_W / 2 - 28 + i * 14;
    dots.fillStyle(color, i >= 3 ? 0.92 : 0.58);
    dots.fillCircle(cx, y + 166, i >= 3 ? 3.2 : 2.5);
  });
  ctx.contentContainer.add(dots);

  const cta = scene.add.graphics();
  cta.fillStyle(0x271536, 1);
  cta.fillRoundedRect(x + 22, y + 184, CARD_W - 44, 24, 7);
  cta.lineStyle(1, COLORS.TORCH_GOLD, 0.48);
  cta.strokeRoundedRect(x + 22, y + 184, CARD_W - 44, 24, 7);
  ctx.contentContainer.add(cta);
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 196, '소환하러 가기', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffe4a8',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
  zone.on('pointerdown', () => scene.scene.start('SummonScene'));
  ctx.contentContainer.add(zone);
}

// ─── Private helpers (file-private) ──────────────────────────────────────────

function drawMonsterCardCollectionHeader(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
  meta: MonsterCollectionMeta,
  typeColor: number,
  isDeployed: boolean,
  xpPct: number,
  skillPoints: number,
): void {
  const g         = scene.add.graphics();
  const readyColor = skillPoints > 0 ? 0xff5f5f : xpPct >= 0.82 ? 0x55d4ff : typeColor;
  const railW     = CARD_W - 16;
  const fillW     = Math.max(18, Math.round((railW - 42) * Phaser.Math.Clamp(xpPct, 0, 1)));

  g.fillStyle(0x030706, 0.92);
  g.fillRoundedRect(x + 8, y + 6, railW, 18, 6);
  g.fillStyle(meta.color, meta.rank >= 3 ? 0.20 : 0.12);
  g.fillRoundedRect(x + 11, y + 9, railW - 6, 5, 3);
  g.fillStyle(readyColor, 0.24);
  g.fillRoundedRect(x + 38, y + 17, fillW, 3, 2);
  g.lineStyle(meta.rank >= 4 ? 1.4 : 1, meta.color, meta.rank >= 3 ? 0.82 : 0.54);
  g.strokeRoundedRect(x + 8, y + 6, railW, 18, 6);
  g.fillStyle(meta.color, 0.20);
  g.fillCircle(x + 19, y + 15, 8);
  g.lineStyle(1, meta.color, 0.62);
  g.strokeCircle(x + 19, y + 15, 8);
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(x + 16, y + 12, 1.6);

  if (isDeployed) {
    g.fillStyle(0x071611, 0.98);
    g.fillRoundedRect(x + CARD_W - 58, y + 25, 48, 14, 5);
    g.lineStyle(1, 0x89f0b8, 0.62);
    g.strokeRoundedRect(x + CARD_W - 58, y + 25, 48, 14, 5);
  }
  ctx.contentContainer.add(g);

  ctx.contentContainer.add(scene.add.text(x + 19, y + 15, meta.tier, {
    fontFamily: 'Georgia, serif', fontSize: '8px', fontStyle: 'bold', color: meta.css,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 32, y + 15, meta.label, {
    fontFamily: 'sans-serif', fontSize: '7px', fontStyle: 'bold', color: meta.css,
  }).setOrigin(0, 0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 20, meta.stars, {
    fontFamily: 'Georgia, serif', fontSize: '7px', color: meta.css,
  }).setOrigin(0.5));

  if (isDeployed) {
    ctx.contentContainer.add(scene.add.text(x + CARD_W - 34, y + 32, '배치중', {
      fontFamily: 'sans-serif', fontSize: '7px', fontStyle: 'bold', color: '#b8ffd8',
    }).setOrigin(0.5));
  }
}

function drawMonsterCardPortraitHalo(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
  meta: MonsterCollectionMeta,
  typeColor: number,
  xpPct: number,
  isDeployed: boolean,
  skillPoints: number,
): void {
  const g    = scene.add.graphics();
  const cx   = x + CARD_W / 2;
  const cy   = y + 49;
  const ready = skillPoints > 0 || xpPct >= 0.82;
  const haloColor = skillPoints > 0 ? 0xff5f5f : xpPct >= 0.82 ? 0x55d4ff : meta.color;

  g.fillStyle(typeColor, 0.055);
  g.fillCircle(cx, cy, 35);
  g.lineStyle(meta.rank >= 3 ? 1.5 : 1, meta.color, meta.rank >= 3 ? 0.52 : 0.30);
  g.strokeCircle(cx, cy, 31);
  g.lineStyle(1, typeColor, 0.26);
  g.strokeCircle(cx, cy, 24);
  g.fillStyle(0x070503, 0.42);
  g.fillEllipse(cx, cy + 27, 68, 12);

  if (ready) {
    g.fillStyle(haloColor, 0.14);
    g.fillCircle(cx, cy, 38);
    g.lineStyle(1.4, haloColor, 0.62);
    g.beginPath();
    g.arc(cx, cy, 35, Phaser.Math.DegToRad(-88), Phaser.Math.DegToRad(64 + xpPct * 210));
    g.strokePath();
  }

  if (isDeployed) {
    g.fillStyle(0x89f0b8, 0.88);
    g.fillCircle(cx + 31, cy + 23, 5.5);
    g.lineStyle(1, 0x06100d, 0.62);
    g.strokeCircle(cx + 31, cy + 23, 5.5);
  }
  ctx.contentContainer.add(g);

  if (ready) {
    ctx.contentContainer.add(scene.add.text(cx - 31, cy + 24,
      skillPoints > 0 ? 'SP' : 'UP', {
        fontFamily:      'sans-serif',
        fontSize:        '7px',
        fontStyle:       'bold',
        color:           skillPoints > 0 ? '#ffd8d8' : '#d7f7ff',
        backgroundColor: '#07100f',
        padding:         { x: 3, y: 1 },
      }).setOrigin(0.5));
  }
}

export function drawCollectionCardStickers(
  scene: Phaser.Scene,
  ctx: BarracksCardContext,
  x: number,
  y: number,
  meta: MonsterCollectionMeta,
  typeColor: number,
): void {
  const g                = scene.add.graphics();
  const collectionNumber = meta.indexLabel.replace('No.', '');

  g.lineStyle(1, meta.color, meta.rank >= 3 ? 0.22 : 0.12);
  for (let i = 0; i < Math.max(2, meta.rank + 1); i += 1) {
    const sx = x + 18 + i * 23;
    g.lineBetween(sx, y + 25, sx + 24, y + 12);
  }
  g.fillStyle(0x070503, 0.58);
  g.fillRoundedRect(x + 14, y + 29, 50, 14, 5);
  g.lineStyle(1, meta.color, 0.38);
  g.strokeRoundedRect(x + 14, y + 29, 50, 14, 5);
  g.fillStyle(meta.color, 0.18);
  g.fillRoundedRect(x + 18, y + 33, 4, 6, 2);
  g.fillStyle(meta.color, 0.16);
  g.fillRoundedRect(x + CARD_W - 54, y + 47, 40, 14, 5);
  g.lineStyle(1, meta.color, 0.62);
  g.strokeRoundedRect(x + CARD_W - 54, y + 47, 40, 14, 5);
  g.fillStyle(0x070503, 0.54);
  g.fillRoundedRect(x + 17, y + 63, 48, 15, 6);
  g.lineStyle(1, typeColor, 0.32);
  g.strokeRoundedRect(x + 17, y + 63, 48, 15, 6);
  g.fillStyle(meta.elementColor, 0.20);
  g.fillCircle(x + CARD_W - 27, y + 70, 10);
  g.lineStyle(1, meta.elementColor, 0.68);
  g.strokeCircle(x + CARD_W - 27, y + 70, 10);
  g.fillStyle(0x070503, 0.66);
  g.fillRoundedRect(x + CARD_W / 2 - 27, y + 74, 54, 13, 5);
  g.lineStyle(1, meta.color, 0.42);
  g.strokeRoundedRect(x + CARD_W / 2 - 27, y + 74, 54, 13, 5);
  ctx.contentContainer.add(g);

  ctx.contentContainer.add(scene.add.text(x + 39, y + 36, `도감 ${collectionNumber}`, {
    fontFamily: 'monospace', fontSize: '7px', color: '#d6d4c8',
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 34, y + 54, `등급 ${meta.tier}`, {
    fontFamily: 'Georgia, serif', fontSize: '7px', fontStyle: 'bold', color: meta.css,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + 41, y + 70.5, meta.tribeLabel, {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#d8fff2',
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W - 27, y + 70, meta.elementIcon, {
    fontFamily: 'sans-serif', fontSize: '10px',
    color: `#${meta.elementColor.toString(16).padStart(6, '0')}`,
  }).setOrigin(0.5));
  ctx.contentContainer.add(scene.add.text(x + CARD_W / 2, y + 80, meta.stars, {
    fontFamily: 'sans-serif', fontSize: '8px', color: meta.css,
  }).setOrigin(0.5));
}
