// ─── Barracks Growth Hall ─────────────────────────────────────────────────────
// drawGrowthHallPanel + drawMonsterBust panel rendering.
// Context object carries scene-owned state; no `this` usage here.

import Phaser from 'phaser';
import { COLORS, CSS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { xpToNextLevel, getMonsterAtk, type OwnedMonster } from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import {
  GROWTH_PANEL_Y,
  GROWTH_PANEL_H,
  getMonsterCollectionMeta,
  getMonsterRoomPlan,
  truncateLabel,
} from './BarracksShared';
import type { GameState } from '../data/wisdom';

// ─── Context interface ────────────────────────────────────────────────────────

export interface BarracksGrowthHallContext {
  readonly gs: GameState;
  readonly focusSourceLabel: string | null;
  readonly onCtaPress: (m: OwnedMonster) => void;
}

// ─── Stats / Directive types (local to this module) ──────────────────────────

export interface BarracksStats {
  totalPower: number;
  ownedCount: number;
  spReady: number;
  levelReady: number;
  equippedCount: number;
  deployedCount: number;
  equipmentInventory: number;
  strongest?: OwnedMonster;
  skillTarget?: OwnedMonster;
  levelTarget?: OwnedMonster;
  gearTarget?: OwnedMonster;
}

export interface BarracksDirective {
  title: string;
  body: string;
  cta: string;
  accent: number;
  targetMonster?: OwnedMonster;
}

// ─── Stats computation ────────────────────────────────────────────────────────

export function computeBarracksStats(
  gs: GameState,
  deployedCount: number,
  equipmentInventoryCount: number,
): BarracksStats {
  let totalPower    = 0;
  let strongest: OwnedMonster | undefined;
  let strongestAtk  = -1;
  let skillTarget: OwnedMonster | undefined;
  let levelTarget: OwnedMonster | undefined;
  let bestLevelPct  = -1;

  gs.ownedMonsters.forEach(monster => {
    const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
    const atk = getMonsterAtk(def?.baseDamage ?? 10, monster.level, monster.spentSkills);
    totalPower += atk;
    if (atk > strongestAtk) {
      strongest    = monster;
      strongestAtk = atk;
    }
    if ((monster.skillPoints ?? 0) > 0 &&
        (!skillTarget || (monster.skillPoints ?? 0) > (skillTarget.skillPoints ?? 0))) {
      skillTarget = monster;
    }
    const needed = xpToNextLevel(monster.level);
    const pct    = monster.level >= 50 ? 1 : monster.xp / needed;
    if (monster.level < 50 && pct >= 0.78 && pct > bestLevelPct) {
      levelTarget  = monster;
      bestLevelPct = pct;
    }
  });

  const equippedCount = gs.ownedMonsters.filter(m => Boolean(m.equipment)).length;
  const gearTarget    = equipmentInventoryCount > 0
    ? gs.ownedMonsters.find(m => !m.equipment)
    : undefined;

  return {
    totalPower,
    ownedCount:        gs.ownedMonsters.length,
    spReady:           gs.ownedMonsters.filter(m => (m.skillPoints ?? 0) > 0).length,
    levelReady:        gs.ownedMonsters.filter(m => {
      if (m.level >= 50) return false;
      return m.xp / xpToNextLevel(m.level) >= 0.78;
    }).length,
    equippedCount,
    deployedCount,
    equipmentInventory: equipmentInventoryCount,
    strongest,
    skillTarget,
    levelTarget,
    gearTarget,
  };
}

export function computeBarracksDirective(
  gs: GameState,
  stats: BarracksStats,
  focusMonsterId: string | null,
): BarracksDirective {
  const focused = focusMonsterId
    ? gs.ownedMonsters.find(m => m.id === focusMonsterId)
    : undefined;

  if (focused) {
    const def        = MONSTER_DEFS[focused.id as keyof typeof MONSTER_DEFS];
    const name       = truncateLabel(def?.name ?? '수호자', 7);
    const xpNeeded   = xpToNextLevel(focused.level);
    const xpPct      = focused.level >= 50 ? 1 : focused.xp / xpNeeded;
    const sp         = focused.skillPoints ?? 0;
    const nextAction = sp > 0
      ? `SP ${sp} 사용 가능`
      : focused.level < 50 && xpPct >= 0.75
        ? `레벨업 ${Math.round(xpPct * 100)}%`
        : focused.equipment
          ? '장비 장착 완료'
          : '장비 제작 추천';
    return {
      title: '방 수호자 성장',
      body:  `${name} · ${nextAction}`,
      cta:   '상세',
      accent: 0x66c08a,
      targetMonster: focused,
    };
  }
  if (stats.skillTarget) {
    const def  = MONSTER_DEFS[stats.skillTarget.id as keyof typeof MONSTER_DEFS];
    const name = truncateLabel(def?.name ?? '몬스터', 7);
    return {
      title: '스킬 성장 대기',
      body:  `${name} SP 대기. 핵심 스킬 우선.`,
      cta:   '성장',
      accent: 0xc978ff,
      targetMonster: stats.skillTarget,
    };
  }
  if (stats.levelTarget) {
    const def  = MONSTER_DEFS[stats.levelTarget.id as keyof typeof MONSTER_DEFS];
    const name = truncateLabel(def?.name ?? '몬스터', 7);
    return {
      title: '레벨업 임박',
      body:  `${name} 레벨업 임박. 주력 후보.`,
      cta:   '확인',
      accent: 0x55d4ff,
      targetMonster: stats.levelTarget,
    };
  }
  if (stats.gearTarget && stats.equipmentInventory > stats.equippedCount) {
    const def  = MONSTER_DEFS[stats.gearTarget.id as keyof typeof MONSTER_DEFS];
    const name = truncateLabel(def?.name ?? '몬스터', 7);
    return {
      title: '장비 장착 추천',
      body:  `${name} 장비 장착 추천.`,
      cta:   '장착',
      accent: COLORS.TORCH_AMBER,
      targetMonster: stats.gearTarget,
    };
  }
  return {
    title: '훈련 안정 상태',
    body:  '새 소환·장비 제작으로 전력 확장.',
    cta:   '대기',
    accent: 0x8bbf6a,
    targetMonster: stats.strongest,
  };
}

export function computeTrainingOpsScore(stats: BarracksStats): number {
  if (stats.ownedCount <= 0) return 0;
  const deploymentPct  = stats.deployedCount / stats.ownedCount;
  const equipmentPct   = stats.equippedCount / stats.ownedCount;
  const readyPressure  = Phaser.Math.Clamp(
    (stats.spReady + stats.levelReady) / stats.ownedCount, 0, 1,
  );
  const growthCoverage = 1 - readyPressure * 0.45;
  return Math.round(Phaser.Math.Clamp(
    deploymentPct * 42 + equipmentPct * 34 + growthCoverage * 24, 0, 100,
  ));
}

// ─── drawGrowthHallPanel ──────────────────────────────────────────────────────

export function drawGrowthHallPanel(
  scene: Phaser.Scene,
  ctx: BarracksGrowthHallContext,
  stats: BarracksStats,
  directive: BarracksDirective,
): void {
  const x = 14, y = GROWTH_PANEL_Y, w = CANVAS_WIDTH - 28, h = GROWTH_PANEL_H;

  const frame = addFramedPanel(scene, {
    x, y, w, h,
    radius:       14,
    fillColor:    CASUAL.PANEL,
    borderColor:  CASUAL.EDGE,
    borderAlpha:  1,
    borderWidth:  3,
    accentColor:  directive.accent,
    accentAlpha:  1,
    shadowOpacity: 0.26,
    shadowOffsetY: 5,
  });
  frame.shadow.setDepth(7);
  frame.panel.setDepth(8);
  frame.glow.setDepth(9);

  const displayMonster = directive.targetMonster ?? stats.strongest;
  const roomPlan       = displayMonster ? getMonsterRoomPlan(ctx.gs, displayMonster) : null;

  drawTrainingFocusStage(scene, ctx, displayMonster, x + 12, y + 12, 78, h - 24, directive.accent);

  scene.add.text(x + 94, y + 17,
    ctx.focusSourceLabel ? ctx.focusSourceLabel : '성장 지휘', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(x + 94, y + 34, directive.title, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(x + 94, y + 52, directive.body, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5).setDepth(11);

  const opsScore = computeTrainingOpsScore(stats);
  drawTrainingOpsMeter(scene, x + 94, y + 64, 178, opsScore, directive.accent);

  const statY = y + 86;
  drawMiniStat(scene, x + 92,  statY, 44, '전투', String(stats.totalPower), 0xff9d41);
  drawMiniStat(scene, x + 140, statY, 44, '대기', String(stats.spReady + stats.levelReady), 0x88ddff);
  drawMiniStat(scene, x + 188, statY, 44, '배치', `${stats.deployedCount}/${stats.ownedCount}`, 0xa4e06f);
  drawMiniStat(scene, x + 236, statY, 44, '장비', `${stats.equippedCount}/${Math.max(1, stats.ownedCount)}`, COLORS.TORCH_AMBER);

  const ctaX = x + w - 72;
  const ctaY = y + 13;
  const cta  = scene.add.graphics().setDepth(10);
  cta.fillStyle(0x070503, 0.34);
  cta.fillRoundedRect(ctaX, ctaY + 3, 58, 30, 7);
  cta.fillStyle(directive.accent, directive.targetMonster ? 0.95 : 0.36);
  cta.fillRoundedRect(ctaX, ctaY, 58, 30, 7);
  cta.fillStyle(0xffffff, directive.targetMonster ? 0.14 : 0.07);
  cta.fillRoundedRect(ctaX + 5, ctaY + 5, 48, 6, 3);
  cta.lineStyle(1, 0xffffff, 0.26);
  cta.strokeRoundedRect(ctaX, ctaY, 58, 30, 7);
  scene.add.text(ctaX + 29, ctaY + 15, directive.cta, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: directive.targetMonster ? '#10110b' : CSS.PARCHMENT_DIM,
  }).setOrigin(0.5).setDepth(11);

  const cueText = scene.add.text(
    ctaX + 29, y + 68,
    roomPlan?.label ?? `${stats.equippedCount}/${stats.equipmentInventory} 장비`,
    {
      fontFamily: 'sans-serif',
      fontSize:   '9px',
      color:      roomPlan ? `#${roomPlan.accent.toString(16).padStart(6, '0')}` : CSS.PARCHMENT_MUTED,
      fontStyle:  roomPlan ? 'bold' : 'normal',
    },
  ).setOrigin(0.5).setDepth(11);
  cueText.setAlpha(0.9);

  if (roomPlan) {
    scene.add.text(ctaX + 29, y + 84, truncateLabel(roomPlan.subLabel, 10), {
      fontFamily: 'sans-serif', fontSize: '8px', color: CSS.PARCHMENT_DIM,
    }).setOrigin(0.5).setDepth(11);
  }

  if (directive.targetMonster) {
    const target = directive.targetMonster;
    const zone   = scene.add.zone(ctaX + 29, ctaY + 15, 64, 38)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onCtaPress(target));
  }
}

// ─── drawMonsterBust ──────────────────────────────────────────────────────────

export function drawMonsterBust(
  scene: Phaser.Scene,
  gs: GameState,
  monster: OwnedMonster,
  x: number,
  y: number,
  size: number,
  depth: number,
): void {
  const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
  const skin = getSkinForMonster(monster.id, gs.equippedSkins ?? {});
  const portraitKey = generatePortrait(scene, monster.id as MonsterId, skin?.id);
  if (scene.textures.exists(portraitKey)) {
    scene.add.image(x, y, portraitKey)
      .setOrigin(0.5)
      .setDisplaySize(size, size)
      .setDepth(depth);
    return;
  }
  scene.add.text(x, y, skin ? skin.emoji : def?.emoji ?? '?', {
    fontFamily: 'sans-serif', fontSize: `${size}px`,
  }).setOrigin(0.5).setDepth(depth);
}

// ─── Private drawing helpers ──────────────────────────────────────────────────

function drawTrainingFocusStage(
  scene: Phaser.Scene,
  ctx: BarracksGrowthHallContext,
  monster: OwnedMonster | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
): void {
  const g = scene.add.graphics().setDepth(10);
  g.fillStyle(0x07110f, 0.96);
  g.fillRoundedRect(x, y, w, h, 9);
  g.fillStyle(accent, 0.09);
  g.fillRoundedRect(x + 6, y + 17, w - 12, h - 29, 8);
  g.lineStyle(1, accent, 0.36);
  g.strokeRoundedRect(x, y, w, h, 9);
  g.lineStyle(1, 0xffffff, 0.12);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(x + 8, y + 7, w - 16, 3, 2);
  g.fillStyle(accent, 0.18);
  g.fillEllipse(x + w / 2, y + 55, w - 22, 14);
  g.fillStyle(0x070503, 0.42);
  g.fillEllipse(x + w / 2, y + 58, w - 30, 7);

  scene.add.text(x + w / 2, y + 10, monster ? '성장 대상' : '대기 슬롯', {
    fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
    color: monster ? '#b8fff0' : CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5).setDepth(12);

  if (!monster) {
    scene.add.text(x + w / 2, y + 43, '소환', {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(12);
    scene.add.text(x + w / 2, y + h - 15, '군단 확장', {
      fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(12);
    return;
  }

  const def            = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
  const collectionMeta = def ? getMonsterCollectionMeta(monster, def) : null;
  const atk            = getMonsterAtk(def?.baseDamage ?? 10, monster.level, monster.spentSkills);

  drawMonsterBust(scene, ctx.gs, monster, x + w / 2, y + 43, 52, 12);

  if (collectionMeta) {
    g.fillStyle(collectionMeta.color, 0.20);
    g.fillRoundedRect(x + w - 30, y + 18, 23, 14, 5);
    g.lineStyle(1, collectionMeta.color, 0.68);
    g.strokeRoundedRect(x + w - 30, y + 18, 23, 14, 5);
    g.fillStyle(collectionMeta.elementColor, 0.20);
    g.fillCircle(x + w - 15, y + h - 18, 8);
    g.lineStyle(1, collectionMeta.elementColor, 0.46);
    g.strokeCircle(x + w - 15, y + h - 18, 8);
    g.fillStyle(0xffffff, 0.14);
    g.fillCircle(x + w - 18, y + h - 21, 2);

    scene.add.text(x + w - 18.5, y + 25, collectionMeta.tier, {
      fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold', color: collectionMeta.css,
    }).setOrigin(0.5).setDepth(12);
    scene.add.text(x + w - 15, y + h - 18, collectionMeta.elementIcon, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(12);
    scene.add.text(x + 10, y + h - 18, collectionMeta.stars, {
      fontFamily: 'Georgia, serif', fontSize: '7px', color: collectionMeta.css,
    }).setOrigin(0, 0.5).setDepth(12);
  }

  const name = truncateLabel(def?.name ?? '수호자', 6);
  scene.add.text(x + w / 2, y + h - 24, name, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CSS.PARCHMENT,
  }).setOrigin(0.5).setDepth(12);
  scene.add.text(x + w / 2, y + h - 10, `Lv.${monster.level}  ATK ${atk}`, {
    fontFamily: 'monospace', fontSize: '8px', color: '#ffcf78',
  }).setOrigin(0.5).setDepth(12);
}

function drawTrainingOpsMeter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  pct: number,
  color: number,
): void {
  const clamped = Phaser.Math.Clamp(pct, 0, 100);
  const g       = scene.add.graphics().setDepth(9);
  g.fillStyle(0x0a1110, 0.92);
  g.fillRoundedRect(x, y, w, 16, 5);
  g.lineStyle(1, color, 0.38);
  g.strokeRoundedRect(x, y, w, 16, 5);
  g.fillStyle(0x1d2722, 1);
  g.fillRoundedRect(x + 46, y + 6, w - 88, 4, 2);
  g.fillStyle(color, 0.86);
  g.fillRoundedRect(x + 46, y + 6, Math.max(5, (w - 88) * (clamped / 100)), 4, 2);

  scene.add.text(x + 8, y + 8, '육성도', {
    fontFamily: 'sans-serif', fontSize: '8px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0, 0.5).setDepth(10);
  scene.add.text(x + w - 8, y + 8, `${clamped}%`, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
    color: `#${color.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5).setDepth(10);
}

function drawMiniStat(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  color: number,
): void {
  const g = scene.add.graphics().setDepth(9);
  g.fillStyle(0x0d1110, 0.86);
  g.fillRoundedRect(x, y, w, 22, 5);
  g.lineStyle(1, color, 0.32);
  g.strokeRoundedRect(x, y, w, 22, 5);
  scene.add.text(x + 6, y + 7, label, {
    fontFamily: 'sans-serif', fontSize: w < 50 ? '7px' : '8px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0, 0.5).setDepth(10);
  scene.add.text(x + w - 6, y + 14, value, {
    fontFamily: 'sans-serif', fontSize: w < 50 ? '9px' : '10px', fontStyle: 'bold',
    color: `#${color.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5).setDepth(10);
}
