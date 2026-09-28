// ─── Barracks Growth Hall ─────────────────────────────────────────────────────
// drawGrowthHallPanel + drawMonsterBust panel rendering.
// Context object carries scene-owned state; no `this` usage here.

import type Phaser from 'phaser';
import { COLORS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { xpToNextLevel, getOwnedMonsterBattleAtk, type OwnedMonster } from '../data/barracks';
import {
  getPrimaryGrowthRecommendation,
  type GrowthRecommendation,
} from '../data/reinforcementRecommendations';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawGrowthSigil } from './BarracksSkin';
import {
  GROWTH_PANEL_Y,
  GROWTH_PANEL_H,
  truncateLabel,
} from './BarracksShared';
import type { GameState } from '../data/wisdom';

// ─── Context interface ────────────────────────────────────────────────────────

export interface BarracksGrowthHallContext {
  readonly gs: GameState;
  readonly focusSourceLabel: string | null;
  readonly onCtaPress: (m: OwnedMonster) => void;
  readonly onSummonPress: () => void;
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
  recommendation?: GrowthRecommendation;
}

// ─── Stats computation ────────────────────────────────────────────────────────

export function computeBarracksStats(
  gs: GameState,
  deployedCount: number,
  equipmentInventoryCount: number,
): BarracksStats {
  const validMonsters = gs.ownedMonsters.filter(monster => resolveOwnedMonsterProfile(monster.id));
  let totalPower    = 0;
  let strongest: OwnedMonster | undefined;
  let strongestAtk  = -1;
  let skillTarget: OwnedMonster | undefined;
  let levelTarget: OwnedMonster | undefined;
  let bestLevelPct  = -1;

  validMonsters.forEach(monster => {
    const def = resolveOwnedMonsterProfile(monster.id)!;
    const atk = getOwnedMonsterBattleAtk(def.baseDamage, monster, gs);
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

  const equippedCount = validMonsters.filter(m => Boolean(m.equipment)).length;
  const gearTarget    = equipmentInventoryCount > 0
    ? validMonsters.find(m => !m.equipment)
    : undefined;

  return {
    totalPower,
    ownedCount:        validMonsters.length,
    spReady:           validMonsters.filter(m => (m.skillPoints ?? 0) > 0).length,
    levelReady:        validMonsters.filter(m => {
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
  if (stats.ownedCount === 0) {
    return {
      title: '군단이 비어 있음',
      body: '소환소에서 첫 수호자를 영입하세요.',
      cta: '소환',
      accent: DUNGEON_UI.BRASS,
    };
  }
  const recommendation = getPrimaryGrowthRecommendation(gs, focusMonsterId);
  const focused = recommendation
    ? gs.ownedMonsters.find(monster => monster.id === recommendation.monsterId)
    : undefined;

  if (focused && recommendation) {
    const def        = resolveOwnedMonsterProfile(focused.id);
    const name       = truncateLabel(def?.name ?? '수호자', 7);
    return {
      title: `${name} 성장 추천`,
      body:  recommendation.whyNow,
      cta:   '상세',
      accent: getGrowthAccent(recommendation.action),
      targetMonster: focused,
      recommendation,
    };
  }
  if (stats.skillTarget) {
    const def  = resolveOwnedMonsterProfile(stats.skillTarget.id);
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
    const def  = resolveOwnedMonsterProfile(stats.levelTarget.id);
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
    const def  = resolveOwnedMonsterProfile(stats.gearTarget.id);
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
  const readyPressure = Math.max(0, Math.min(
    1,
    (stats.spReady + stats.levelReady) / stats.ownedCount,
  ));
  const growthCoverage = 1 - readyPressure * 0.45;
  return Math.round(Math.max(0, Math.min(
    100,
    deploymentPct * 42 + equipmentPct * 34 + growthCoverage * 24,
  )));
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
    radius:       9,
    fillColor:    DUNGEON_UI.STONE,
    borderColor:  DUNGEON_UI.IRON,
    borderAlpha:  1,
    borderWidth:  2,
    accentColor:  directive.accent,
    accentAlpha:  1,
    shadowOpacity: 0.46,
    shadowOffsetY: 5,
  });
  frame.shadow.setDepth(7);
  frame.panel.setDepth(8);
  frame.glow.setDepth(9);

  const displayMonster = directive.targetMonster ?? stats.strongest;
  const recommendation = directive.recommendation;
  const canAct = Boolean(directive.targetMonster) || stats.ownedCount === 0;

  drawTrainingFocusStage(scene, ctx, displayMonster, x + 11, y + 11, 96, h - 22, directive.accent);

  const infoX = x + 121;
  const infoW = w - 132;
  scene.add.text(infoX, y + 18,
    ctx.focusSourceLabel ? ctx.focusSourceLabel : '방어선 성장 지휘', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(0, 0.5).setDepth(11);
  const currentEquipment = recommendation?.currentEquipment
    ? recommendation.currentEquipment.name
    : '미장착';
  scene.add.text(infoX, y + 37, displayMonster
    ? `${recommendation?.monsterName ?? directive.title} · Lv.${displayMonster.level}`
    : directive.title, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(infoX, y + 55, recommendation?.whyNow ?? directive.body, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: infoW, useAdvancedWrap: true }, maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(infoX, y + 73,
    `${recommendation?.costOrDeficit ?? '추천 대상 없음'} · 장비 ${currentEquipment}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
      wordWrap: { width: infoW, useAdvancedWrap: true }, maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(11);
  const roomLine = recommendation
    ? `${recommendation.room.roomLabel} · ${recommendation.room.roomContextLabel}`
    : `${stats.deployedCount}/${stats.ownedCount} 배치 중`;
  scene.add.text(infoX, y + 90, roomLine, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: recommendation?.room.kind === 'assigned' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: infoW, useAdvancedWrap: true }, maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(11);
  const projectionLine = recommendation?.room.readiness && recommendation.room.power
    ? `준비 ${recommendation.room.readiness.before}→${recommendation.room.readiness.after} · 전력 ${recommendation.room.power.before}→${recommendation.room.power.after} 예상`
    : recommendation
      ? '준비도·방 전력은 실제 배치 후 계산'
      : `전투 ${stats.totalPower} · 장비 ${stats.equippedCount}`;
  const ctaX = infoX;
  const ctaY = y + 99;
  const cta  = scene.add.graphics().setDepth(10);
  cta.fillStyle(DUNGEON_UI.SOOT, 1);
  cta.fillRoundedRect(ctaX, ctaY, infoW, 42, 6);
  cta.fillStyle(directive.accent, canAct ? 0.18 : 0.06);
  cta.fillRoundedRect(ctaX + 4, ctaY + 4, 36, 34, 5);
  cta.lineStyle(1.5, directive.accent, canAct ? 0.82 : 0.34);
  cta.strokeRoundedRect(ctaX, ctaY, infoW, 42, 6);
  drawGrowthSigil(cta, ctaX + 22, ctaY + 21, directive.accent, canAct ? 1 : 0.38);
  scene.add.text(ctaX + 49, ctaY + 14,
    stats.ownedCount === 0 ? '첫 수호자 소환' : `${directive.cta} 성장 계획`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: canAct ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(ctaX + 49, ctaY + 29, projectionLine, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: infoW - 78, useAdvancedWrap: true }, maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(11);
  scene.add.text(ctaX + infoW - 14, ctaY + 21, '›', {
    fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold',
    color: canAct ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5).setDepth(11);

  if (directive.targetMonster) {
    const target = directive.targetMonster;
    const zone   = scene.add.zone(ctaX, ctaY - 1, infoW, 44).setOrigin(0)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onCtaPress(target));
  } else if (stats.ownedCount === 0) {
    const zone = scene.add.zone(ctaX, ctaY - 1, infoW, 44).setOrigin(0)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', ctx.onSummonPress);
  }
}

function getGrowthAccent(action: GrowthRecommendation['action']): number {
  if (action === 'sp') return 0xc978ff;
  if (action === 'level-up') return 0x55d4ff;
  if (action === 'equip') return COLORS.TORCH_AMBER;
  if (action === 'blocked-feed') return 0xd8785a;
  return 0x66c08a;
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
  const def = resolveOwnedMonsterProfile(monster.id);
  addMonsterPortrait(scene, null, x, y, monster.id, {
    size,
    depth,
    frameColor: def?.accentColor ?? DUNGEON_UI.BRASS,
    glowColor: DUNGEON_UI.JADE,
    bgColor: DUNGEON_UI.SOOT,
    equippedSkins: gs.equippedSkins ?? {},
  });
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
  g.fillStyle(DUNGEON_UI.SOOT, 0.98);
  g.fillRoundedRect(x, y, w, h, 7);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 5, y + 21, w - 10, 71, 6);
  g.lineStyle(1, accent, 0.42);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.4);
  g.lineBetween(x + 8, y + h - 27, x + w - 8, y + h - 27);

  scene.add.text(x + w / 2, y + 12, monster ? '성장 대상' : '대기 슬롯', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: monster ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5).setDepth(12);

  if (!monster) {
    drawGrowthSigil(g, x + w / 2, y + 55, DUNGEON_UI.BRASS, 0.64);
    scene.add.text(x + w / 2, y + h - 16, '군단 확장', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5).setDepth(12);
    return;
  }

  const def            = resolveOwnedMonsterProfile(monster.id);
  const atk            = getOwnedMonsterBattleAtk(def?.baseDamage ?? 10, monster, ctx.gs);

  drawMonsterBust(scene, ctx.gs, monster, x + w / 2, y + 58, 68, 12);

  const name = truncateLabel(def?.name ?? '수호자', 6);
  scene.add.text(x + w / 2, y + 99, name, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5).setDepth(12);
  scene.add.text(x + w / 2, y + 114, `Lv.${monster.level} · ATK ${atk}`, {
    fontFamily: 'monospace', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5).setDepth(12);
}
