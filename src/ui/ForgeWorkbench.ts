import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS, ZONE_ACCENTS } from '../constants/colors';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import {
  cycleForgeTargetsByRoster,
  rankForgeBlueprints,
  type ForgeRecommendation,
} from '../data/forgeRecommendations';
import { addMonsterPortrait } from './MonsterPortraitView';
import {
  WORKBENCH_H,
  LIST_PAD,
  getFocusMonsterDisplay,
  getFocusEquipmentDisplay,
  getMonsterEquipmentDisplay,
  truncateLabel,
  type ForgeContext,
} from './ForgeShared';
import { drawDismantleSigil, drawForgeCrest } from './ForgeSkin';
import { getForgeTargetRoomCue } from './BarracksShared';

export function buildWorkbenchPanel(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  mode: 'craft' | 'dismantle',
): number {
  const { gs, focusMonsterId, focusSourceLabel } = ctx;
  const rankedBlueprints = mode === 'craft'
    ? rankForgeBlueprints(gs, { monsterId: focusMonsterId, sourceLabel: focusSourceLabel })
    : [];
  const selectedProjection = ctx.selectedBpId
    ? rankedBlueprints.find(item => item.blueprint.id === ctx.selectedBpId) ?? null
    : null;
  const primaryProjection = selectedProjection ?? rankedBlueprints[0] ?? null;
  const recommendation = primaryProjection?.recommendation ?? null;
  const explicitTarget = getFocusMonsterDisplay(gs, focusMonsterId);
  const targetMonsterId = explicitTarget ? focusMonsterId : recommendation?.monsterId ?? null;
  const target = explicitTarget ?? (recommendation
    ? {
        name: recommendation.monsterName,
        emoji: recommendation.monsterEmoji,
        level: recommendation.monsterLevel,
      }
    : null);
  const currentEquipment = explicitTarget
    ? getFocusEquipmentDisplay(gs, focusMonsterId)
    : recommendation
      ? getMonsterEquipmentDisplay(gs, recommendation.monsterId)
      : null;
  const craftedCount = (gs.craftedEquipment ?? []).length;
  const equippedCount = gs.ownedMonsters.filter(monster => Boolean(monster.equipment)).length;

  const x = 14;
  const y = 8;
  const w = CANVAS_WIDTH - 28;
  const h = 176;
  const accent = mode === 'craft' ? ZONE_ACCENTS.forge : DUNGEON_UI.EMBER;
  const frame = addFramedPanel(scene, {
    x,
    y,
    w,
    h,
    radius: 9,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 1,
    borderWidth: 2,
    accentColor: accent,
    accentAlpha: 1,
    shadowOpacity: 0.46,
    shadowOffsetY: 5,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const stage = scene.add.graphics();
  stage.fillStyle(DUNGEON_UI.VOID, 0.96);
  stage.fillRoundedRect(x + 10, y + 10, 92, h - 20, 8);
  stage.fillStyle(accent, 0.08);
  stage.fillRoundedRect(x + 16, y + 16, 80, 94, 7);
  stage.lineStyle(1.2, target ? DUNGEON_UI.JADE : accent, 0.62);
  stage.strokeRoundedRect(x + 10, y + 10, 92, h - 20, 8);
  c.add(stage);

  if (targetMonsterId) {
    addMonsterPortrait(scene, c, x + 56, y + 54, targetMonsterId, {
      size: 72,
      frameColor: recommendation?.accent ?? DUNGEON_UI.JADE,
      glowColor: recommendation?.accent ?? DUNGEON_UI.JADE,
      equippedSkins: gs.equippedSkins,
    });
  } else {
    const crest = scene.add.graphics();
    crest.fillStyle(accent, 0.12);
    crest.fillCircle(x + 56, y + 54, 31);
    crest.lineStyle(1.5, accent, 0.55);
    crest.strokeCircle(x + 56, y + 54, 31);
    if (mode === 'craft') drawForgeCrest(crest, x + 56, y + 52, accent, 0.94, 1.15);
    else drawDismantleSigil(crest, x + 56, y + 52, accent, 0.94, 1);
    c.add(crest);
  }
  c.add(scene.add.text(x + 56, y + 102, target ? `Lv.${target.level}` : mode === 'craft' ? '단조 지휘' : '회수 지휘', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 56, y + 121, target ? truncateLabel(target.name, 7) : mode === 'craft' ? '대상 대기' : '분해대', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 56, y + 143, focusSourceLabel ?? (target ? '추천 수호자' : '공방 명령'), {
    fontFamily: 'sans-serif', fontSize: '10px', color: target ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));

  const infoX = x + 114;
  const infoW = w - 126;
  const blueprint = primaryProjection?.blueprint;
  const title = mode === 'craft'
    ? blueprint
      ? blueprint.name
      : '설계도 수급 필요'
    : craftedCount > 0
      ? '장비 회수 명령'
      : '회수할 장비 없음';
  const body = mode === 'craft'
    ? primaryProjection?.whyNow ?? '전투 또는 심연에서 장비 설계도를 확보하세요.'
    : craftedCount > 0
      ? '미사용 장비를 선택하고 반환 재료를 확인하세요.'
      : '장비를 제작하면 분해 회수 경로가 열립니다.';
  c.add(scene.add.text(infoX, y + 17, mode === 'craft' ? '추천 제작 지휘' : '분해·재료 회수', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: mode === 'craft' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(infoX, y + 37, title, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(infoX, y + 56, body, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: infoW, useAdvancedWrap: true }, maxLines: 1,
  }).setOrigin(0, 0.5));

  const equipmentLine = currentEquipment
    ? `현재 장비 · ${currentEquipment.name}`
    : target
      ? '현재 장비 · 미장착'
      : mode === 'craft'
        ? '현재 장비 · 대상 없음'
        : `보관 ${craftedCount} · 장착 ${equippedCount}`;
  c.add(scene.add.text(infoX, y + 74, equipmentLine, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: currentEquipment ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const roomLine = recommendation
    ? `${recommendation.room.roomLabel} · ${recommendation.room.roomContextLabel}`
    : mode === 'craft'
      ? '추천 방 · 대상 계산 대기'
      : '반환 재료는 제작 비용의 일부';
  const metricLine = recommendation?.room.power && recommendation.room.readiness
    ? `준비 ${recommendation.room.readiness.before}→${recommendation.room.readiness.after} · 전력 ${recommendation.room.power.before}→${recommendation.room.power.after} 예상`
    : recommendation
      ? `${recommendation.improvementLabel} · 실제 배치 후 방 전력 계산`
      : mode === 'craft'
        ? '장착 대상과 방 전력은 설계도 기준으로 계산'
        : '장착 중 장비는 분해 시 자동 해제';
  c.add(scene.add.text(infoX, y + 91, roomLine, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: recommendation ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(infoX, y + 107, metricLine, {
    fontFamily: 'sans-serif', fontSize: '10px', color: recommendation ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const materialLine = primaryProjection
    ? primaryProjection.materials
        .slice(0, 2)
        .map(material => `${material.name} ${material.have}/${material.need}${material.missing > 0 ? ` 부족 ${material.missing}` : ''}`)
        .join(' · ')
        + (primaryProjection.materials.length > 2 ? ` · +${primaryProjection.materials.length - 2}종` : '')
    : mode === 'craft'
      ? `설계도 ${(gs.blueprints ?? []).length} · 보유 재료 ${Object.values(gs.materials ?? {}).filter(qty => qty > 0).length}종`
      : `보관 ${craftedCount} · 장착 ${equippedCount}`;
  c.add(scene.add.text(infoX, y + 122, materialLine, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: primaryProjection?.craftable ? DUNGEON_UI_CSS.JADE : mode === 'craft' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0, 0.5));

  const actionLabel = mode === 'craft'
    ? primaryProjection?.craftable
      ? `제작 · ${truncateLabel(blueprint?.name ?? '장비', 9)}`
      : primaryProjection
        ? `재료 부족 ${primaryProjection.materialMissing}`
        : '설계도 필요'
    : craftedCount > 0
      ? '아래 장비를 선택해 분해'
      : '제작 장비 없음';
  const enabled = mode === 'craft' && Boolean(primaryProjection?.craftable && blueprint);
  const action = addPrimaryActionButton(scene, {
    x: infoX,
    y: y + 132,
    w: infoW,
    h: 44,
    label: actionLabel,
    fontSize: '11px',
    enabled,
    fillColor: DUNGEON_UI.JADE,
    hoverFillColor: 0x61ad87,
    borderColor: DUNGEON_UI.JADE,
    hoverBorderColor: 0x76c6a0,
    disabledFillColor: DUNGEON_UI.SOOT,
    disabledBorderColor: mode === 'craft' ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON,
    textColor: '#07100b',
    disabledTextColor: mode === 'craft' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
    onPress: () => {
      if (blueprint) ctx.onConfirmCraft(blueprint.id);
    },
  });
  c.add([action.bg, action.text, action.zone]);

  return WORKBENCH_H;
}

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
  g.fillStyle(DUNGEON_UI.SOOT, 0.96);
  g.fillRoundedRect(x, y, w, 24, 5);
  g.lineStyle(1, accent, 0.58);
  g.strokeRoundedRect(x, y, w, 24, 5);
  c.add(g);
  c.add(scene.add.text(x + 7, y + 12, label, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 7, y + 12, value, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: `#${accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5));
}

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
  g.fillStyle(DUNGEON_UI.VOID, 1);
  g.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
  g.fillStyle(color, 0.92);
  g.fillRoundedRect(x, y, Math.max(2, fillW), h, Math.max(2, h / 2));
  g.lineStyle(0.5, color, 0.45);
  g.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));
  c.add(g);
}

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
  g.fillStyle(DUNGEON_UI.SOOT, 0.98);
  g.fillRoundedRect(x, y, w, h, 7);
  g.fillStyle(recommendation.accent, 0.12);
  g.fillRoundedRect(x + 5, y + 5, 42, h - 10, 6);
  g.fillStyle(DUNGEON_UI.VOID, 0.66);
  g.fillRoundedRect(x + w - 68, y + 6, 60, h - 12, 6);
  g.lineStyle(1.2, recommendation.accent, 0.7);
  g.strokeRoundedRect(x, y, w, h, 7);
  c.add(g);

  addMonsterPortrait(scene, c, x + 26, y + h / 2, recommendation.monsterId, {
    size: Math.min(36, h - 12),
    frameColor: recommendation.accent,
    glowColor: recommendation.accent,
  });
  c.add(scene.add.text(x + 54, y + 11, title, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 54, y + 27, `${truncateLabel(recommendation.monsterName, 7)} · Lv.${recommendation.monsterLevel}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 54, y + 42, recommendation.roomLabel, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 38, y + h / 2 - 6, recommendation.powerDelta === null ? '—' : `${recommendation.powerDelta >= 0 ? '+' : ''}${recommendation.powerDelta}`, {
    fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 38, y + h / 2 + 10, recommendation.powerDelta === null ? '배치 전' : '전력', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0.5));
}

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
    const text = scene.add.text(0, 0, label, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: index === 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5);
    const chipW = Math.max(52, Math.ceil(text.width) + 14);
    if (cursorX + chipW > x + maxWidth) { text.destroy(); return; }
    const g = scene.add.graphics();
    g.fillStyle(DUNGEON_UI.VOID, 0.92);
    g.fillRoundedRect(cursorX, y, chipW, 20, 5);
    g.lineStyle(1, accent, index === 0 ? 0.58 : 0.3);
    g.strokeRoundedRect(cursorX, y, chipW, 20, 5);
    c.add(g);
    c.add(text.setPosition(cursorX + chipW / 2, y + 10));
    cursorX += chipW + 5;
  });
}

export function buildForgeTargetRail(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  y: number,
): number {
  const targets = cycleForgeTargetsByRoster(ctx.gs, ctx.focusMonsterId);
  if (targets.length === 0) return y;

  const active = targets[0];
  const next = targets[targets.length > 1 ? 1 : 0];
  const recommendation = active.recommendation;
  const targetName = getFocusMonsterDisplay(ctx.gs, active.monster.id)?.name ?? active.monster.id;
  const roomCue = getForgeTargetRoomCue(ctx.gs, active.monster, recommendation?.room);
  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 76;
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.VOID, 0.46);
  bg.fillRoundedRect(x, y + 3, w, h, 8);
  bg.fillStyle(DUNGEON_UI.STONE, 1);
  bg.fillRoundedRect(x, y, w, h, 8);
  bg.fillStyle(DUNGEON_UI.JADE, 0.08);
  bg.fillRoundedRect(x + 6, y + 6, w - 96, h - 12, 6);
  bg.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
  bg.strokeRoundedRect(x, y, w, h, 8);
  bg.fillStyle(DUNGEON_UI.JADE, 1);
  bg.fillRect(x + 1, y + 1, 3, h - 2);
  c.add(bg);

  addMonsterPortrait(scene, c, x + 35, y + 38, active.monster.id, {
    size: 52,
    frameColor: recommendation?.accent ?? DUNGEON_UI.JADE,
    glowColor: recommendation?.accent ?? DUNGEON_UI.JADE,
    equippedSkins: ctx.gs.equippedSkins,
  });
  c.add(scene.add.text(x + 70, y + 15, '현재 장착 대상', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 70, y + 34, `${truncateLabel(targetName, 8)} · Lv.${active.monster.level}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 70, y + 52, `${roomCue} · ${recommendation?.improvementLabel ?? '장비 수급'}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 70, y + 67, `대상 ${active.rosterIndex + 1}/${targets.length}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const buttonX = x + w - 82;
  const buttonY = y + 16;
  const buttonW = 70;
  const buttonH = 44;
  const button = scene.add.graphics();
  button.fillStyle(DUNGEON_UI.SOOT, 1);
  button.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
  button.fillStyle(DUNGEON_UI.BRASS, targets.length > 1 ? 0.16 : 0.05);
  button.fillRoundedRect(buttonX + 4, buttonY + 4, buttonW - 8, buttonH - 8, 5);
  button.lineStyle(1.4, DUNGEON_UI.BRASS, targets.length > 1 ? 0.75 : 0.28);
  button.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
  c.add(button);
  c.add(scene.add.text(buttonX + buttonW / 2, buttonY + 15, targets.length > 1 ? '다음 대상' : '대상 고정', {
    fontFamily: 'sans-serif', fontSize: '10px', color: targets.length > 1 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(buttonX + buttonW / 2, buttonY + 31, targets.length > 1 ? '전환 ›' : '1/1', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0.5));
  if (targets.length > 1) {
    const zone = scene.add.zone(buttonX, buttonY, buttonW, buttonH).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onFocusChange(next.monster.id, next.recommendation?.room.roomLabel ?? '배치 대기'));
    c.add(zone);
  }

  return y + h + 8;
}
