// ─── Forge Workbench ─────────────────────────────────────────────────────────
// buildWorkbenchPanel, drawWorkbenchStat, drawProgressTrack,
// drawForgeRecommendationPreview, drawEffectChips, buildForgeTargetRail.
// All functions take (scene, ctx, ...) — no `this` usage.

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import {
  cycleForgeTargetsByRoster,
  rankForgeBlueprints,
  type ForgeRecommendation,
} from '../data/forgeRecommendations';
import { addMonsterPortrait } from './MonsterPortraitView';
import {
  WORKBENCH_H, LIST_PAD,
  getFocusMonsterDisplay,
  getFocusEquipmentDisplay,
  getMonsterEquipmentDisplay,
  formatForgeMaterialStatus,
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
  const rankedBlueprints = mode === 'craft'
    ? rankForgeBlueprints(gs, { monsterId: focusMonsterId, sourceLabel: focusSourceLabel })
    : [];
  const selectedProjection = ctx.selectedBpId
    ? rankedBlueprints.find(projection => projection.blueprint.id === ctx.selectedBpId) ?? null
    : null;
  const primaryProjection = selectedProjection ?? rankedBlueprints[0] ?? null;
  const previewBlueprint = primaryProjection?.blueprint;
  const recommendation = primaryProjection?.recommendation ?? null;
  const craftable = rankedBlueprints.filter(projection => projection.craftable);
  const materialTypes = Object.values(gs.materials ?? {}).filter(qty => qty > 0).length;
  const craftedCount  = (gs.craftedEquipment ?? []).length;
  const equippedCount = gs.ownedMonsters.filter(monster => Boolean(monster.equipment)).length;
  const target        = getFocusMonsterDisplay(gs, focusMonsterId);
  const workbenchMonsterId = target ? focusMonsterId : recommendation?.monsterId ?? null;
  const workbenchTarget = target ?? (recommendation
    ? {
        name:  recommendation.monsterName,
        emoji: recommendation.monsterEmoji,
        level: recommendation.monsterLevel,
      }
    : null);
  const targetName    = workbenchTarget?.name ?? null;
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
  panel.fillStyle(CASUAL.SHADOW, 0.94);
  panel.fillRoundedRect(x + 8, y + 10, 86, h - 20, 10);
  panel.fillStyle(CASUAL.PANEL_SOFT, 0.7);
  panel.fillRoundedRect(x + 100, y + 8, w - 108, h - 16, 10);
  panel.lineStyle(1.5, target ? CASUAL.GREEN : CASUAL.EDGE_SOFT, target ? 0.7 : 0.4);
  panel.strokeRoundedRect(x + 12, y + 14, 78, h - 28, 9);
  c.add(panel);

  if (workbenchMonsterId) {
    addMonsterPortrait(scene, c, x + 51, y + 48, workbenchMonsterId, {
      size: 62,
      frameColor: recommendation?.accent ?? accent,
      glowColor: recommendation?.accent ?? accent,
      equippedSkins: gs.equippedSkins,
    });
  } else {
    c.add(scene.add.text(x + 51, y + 40, mode === 'craft' ? '⚒' : '🔨', {
      fontFamily: 'sans-serif', fontSize: '31px',
    }).setOrigin(0.5));
  }
  c.add(scene.add.text(x + 51, y + 83, workbenchTarget ? `Lv.${workbenchTarget.level}` : mode === 'craft' ? '제작대' : '분해대', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK,
    fontStyle: workbenchTarget ? 'bold' : 'normal',
  }).setOrigin(0.5));
  if (workbenchTarget) {
    c.add(scene.add.text(x + 51, y + 99, workbenchTarget.name, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  const title = mode === 'craft'
    ? (previewBlueprint
        ? `${previewBlueprint.name} ${primaryProjection?.craftable ? '추천 제작' : '재료 수급'}`
        : '재료 수급 필요')
    : (craftedCount > 0 ? '장비 회수 가능' : '제작 장비 없음');
  const body = mode === 'craft'
    ? (primaryProjection
        ? primaryProjection.whyNow
        : targetName
          ? `${targetName}에게 장착할 장비를 제작해 전투실 효율을 올리세요.`
        : '방어선에 부족한 무기, 방어구, 장신구를 제작하세요.')
    : '사용하지 않는 제작 장비를 분해해 다음 장비 재료로 회수하세요.';

  c.add(scene.add.text(x + 110, y + 18, title, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 110, y + 34, body, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));

  const equipLine = currentEquipment
    ? `${currentEquipment.emoji} ${currentEquipment.name} 장착 중`
    : workbenchTarget
      ? '장비 슬롯 비어 있음'
      : mode === 'craft'
        ? '설계도 선택 후 단조'
        : '불필요 장비 회수';
  const hasPowerRecommendation = mode === 'craft' && recommendation !== null;
  const equipChipW = w - 122;
  const equipChip = scene.add.graphics();
  equipChip.fillStyle(currentEquipment ? CASUAL.GOLD : CASUAL.PANEL, currentEquipment ? 0.32 : 0.9);
  equipChip.fillRoundedRect(x + 110, y + 50, equipChipW, 18, 7);
  equipChip.lineStyle(1.5, currentEquipment ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT, currentEquipment ? 0.9 : 0.6);
  equipChip.strokeRoundedRect(x + 110, y + 50, equipChipW, 18, 7);
  c.add(equipChip);
  c.add(scene.add.text(x + 116, y + 59, equipLine, {
    fontFamily: 'sans-serif', fontSize: '11px',
    color: currentEquipment ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    fontStyle: currentEquipment ? 'bold' : 'normal',
  }).setOrigin(0, 0.5));

  if (hasPowerRecommendation) {
    const roomLine = `${recommendation.room.roomLabel} · ${recommendation.room.roomContextLabel}`;
    const metricLine = recommendation.room.power && recommendation.room.readiness
      ? `준비 ${recommendation.room.readiness.before}→${recommendation.room.readiness.after} · 전력 ${recommendation.room.power.before}→${recommendation.room.power.after} 예상`
      : '준비도·방 전력은 실제 배치 후 계산';
    c.add(scene.add.text(x + 110, y + 76, roomLine, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(x + 110, y + 90, metricLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#8fffe0',
    }).setOrigin(0, 0.5));
  }

  const materialLine = primaryProjection
    ? primaryProjection.materials
      .map(formatForgeMaterialStatus)
      .reduce<string[]>((lines, material, index) => {
        const lineIndex = Math.floor(index / 2);
        lines[lineIndex] = lines[lineIndex] ? `${lines[lineIndex]} · ${material}` : material;
        return lines;
      }, [])
      .join('\n')
    : mode === 'craft'
      ? `가능 ${craftable.length} · 설계도 ${ownedBlueprints.length} · 재료 ${materialTypes}`
      : `보관 ${craftedCount} · 장착 ${equippedCount}`;
  c.add(scene.add.text(x + 110, y + 102, materialLine, {
    fontFamily: 'sans-serif', fontSize: '10px', color: primaryProjection?.craftable ? CASUAL_CSS.GREEN : CASUAL_CSS.RED,
  }).setOrigin(0));

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
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
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
  g.fillStyle(CASUAL.SHADOW, 1);
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
  g.fillStyle(CASUAL.SHADOW, 0.96);
  g.fillRoundedRect(x, y, w, h, 9);
  g.fillStyle(recommendation.accent, 0.15);
  g.fillRoundedRect(x + 6, y + 7, 42, h - 14, 8);
  g.fillStyle(CASUAL.SHADOW, 0.36);
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
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 62, y + 27, truncateLabel(recommendation.monsterName, 8), {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f4ffe9', fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 62, y + 42, `${recommendation.roomLabel} · Lv.${recommendation.monsterLevel}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 41, y + h / 2 - 5, recommendation.powerDelta === null ? '—' : `${recommendation.powerDelta >= 0 ? '+' : ''}${recommendation.powerDelta}`, {
    fontFamily: 'sans-serif', fontSize: '15px', color: '#b8fff0', fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 41, y + h / 2 + 11, recommendation.powerDelta === null ? '배치 전' : '전력', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
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
    g.fillStyle(CASUAL.SHADOW, 0.9);
    g.fillRoundedRect(cursorX, y, chipW, 18, 6);
    g.lineStyle(1, accent, index === 0 ? 0.5 : 0.28);
    g.strokeRoundedRect(cursorX, y, chipW, 18, 6);
    c.add(g);
    c.add(scene.add.text(cursorX + chipW / 2, y + 9, label, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: index === 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
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
  const targets = cycleForgeTargetsByRoster(ctx.gs, ctx.focusMonsterId);
  if (targets.length === 0) return y;

  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 98;
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

  c.add(scene.add.text(x + 12, y + 16, `추천 장착 대상 ${targets.length}명`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  const activeMonsterId = ctx.focusMonsterId ?? targets[0].monster.id;
  const visible = Array.from({ length: Math.min(3, targets.length) }, (_, index) =>
    targets[index],
  );
  const next = targets[targets.length > 1 ? 1 : 0];
  const nextX = x + w - 56;
  const nextButton = scene.add.graphics();
  nextButton.fillStyle(CASUAL.PANEL_SOFT, 1);
  nextButton.fillRoundedRect(nextX, y + 6, 48, 44, 7);
  nextButton.lineStyle(1.5, CASUAL.EDGE, 1);
  nextButton.strokeRoundedRect(nextX, y + 6, 48, 44, 7);
  c.add(nextButton);
  c.add(scene.add.text(nextX + 24, y + 20, '다음', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(nextX + 24, y + 34, `${targets[0].rosterIndex + 1}/${targets.length}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
  const nextZone = scene.add.zone(nextX + 24, y + 28, 48, 44).setInteractive({ useHandCursor: true });
  nextZone.on('pointerdown', () => ctx.onFocusChange(next.monster.id, next.recommendation?.room.roomLabel ?? '배치 대기'));
  c.add(nextZone);

  const chipW = Math.floor((w - 28) / 3);
  visible.forEach((target, index) => {
    const chipX = x + 8 + index * (chipW + 6);
    const chipY = y + 50;
    const active = activeMonsterId === target.monster.id;
    const chip = scene.add.graphics();
    chip.fillStyle(active ? CASUAL.GREEN : CASUAL.PANEL_SOFT, 1);
    chip.fillRoundedRect(chipX, chipY, chipW, 44, 7);
    chip.fillStyle(0xffffff, active ? 0.28 : 0.18);
    chip.fillRoundedRect(chipX + 4, chipY + 5, 24, 34, 5);
    chip.lineStyle(2, active ? CASUAL.GREEN_DK : CASUAL.EDGE, 1);
    chip.strokeRoundedRect(chipX, chipY, chipW, 44, 7);
    c.add(chip);

    c.add(scene.add.text(chipX + 16, chipY + 22, target.recommendation?.monsterEmoji ?? '👹', {
      fontFamily: 'sans-serif', fontSize: '14px',
    }).setOrigin(0.5));
    c.add(scene.add.text(chipX + 34, chipY + 10, truncateLabel(target.monster.id, 7), {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: active ? '#ffffff' : CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    const roomCue = target.recommendation?.room.kind === 'assigned'
      ? `실제 ${target.recommendation.room.roomLabel}`
      : target.recommendation?.room.kind === 'recommended'
        ? `추천 ${target.recommendation.room.roomLabel}`
        : '배치 대기';
    c.add(scene.add.text(chipX + 34, chipY + 24, roomCue, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: active ? '#eafff0' : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(chipX + 34, chipY + 36, target.recommendation?.improvementLabel ?? '장비 수급', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: active ? '#ffffff' : CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const zone = scene.add.zone(chipX, chipY, chipW, 44)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onFocusChange(target.monster.id, target.recommendation?.room.roomLabel ?? '배치 대기'));
    c.add(zone);
  });

  return y + h + 8;
}
