import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { BLUEPRINT_DEFS, RARITY_COLORS, RARITY_NAMES, type BlueprintDef } from '../data/fusion';
import { getDismantleReturns } from '../data/forgeTransactions';
import { rankForgeBlueprints } from '../data/forgeRecommendations';
import {
  LIST_PAD,
  rarityHex,
  getForgeRarityStars,
  getForgeTypeMeta,
  getMaterialDisplay,
  summarizeEquipmentEffects,
  getEquipmentHolderDisplay,
  getMonsterEquipmentDisplay,
  formatForgeMaterialStatus,
  truncateLabel,
  type ForgeContext,
} from './ForgeShared';
import {
  drawEffectChips,
  buildWorkbenchPanel,
  buildForgeTargetRail,
} from './ForgeWorkbench';
import {
  drawBlueprintSigil,
  drawDismantleSigil,
  drawEquipmentSigil,
  drawSupplySigil,
} from './ForgeSkin';

const CRAFT_PAGE_SIZE = 2;
const DISMANTLE_PAGE_SIZE = 3;

export function drawPageNavigator(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  y: number,
  itemCount: number,
  pageSize: number,
): void {
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
  if (pageCount <= 1) return;

  const page = Phaser.Math.Clamp(ctx.page, 0, pageCount - 1);
  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 44;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 0.96);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(x, y, w, h, 7);
  c.add(g);

  const addStep = (buttonX: number, label: string, enabled: boolean, nextPage: number): void => {
    const bw = 90;
    const bg = scene.add.graphics();
    bg.fillStyle(enabled ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.VOID, 1);
    bg.fillRoundedRect(buttonX, y, bw, h, 7);
    bg.lineStyle(1.2, enabled ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, enabled ? 0.72 : 0.3);
    bg.strokeRoundedRect(buttonX, y, bw, h, 7);
    c.add(bg);
    c.add(scene.add.text(buttonX + bw / 2, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: enabled ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    if (!enabled) return;
    const zone = scene.add.zone(buttonX, y, bw, h).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onPageChange(nextPage));
    c.add(zone);
  };

  addStep(x, '‹ 이전', page > 0, page - 1);
  addStep(x + w - 90, '다음 ›', page < pageCount - 1, page + 1);
  c.add(scene.add.text(CANVAS_WIDTH / 2, y + 14, `${page + 1} / ${pageCount}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, y + 30, `전체 ${itemCount}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
}

export function drawBlueprintCardShell(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rowH: number,
  bp: BlueprintDef,
  cardNo: string,
  typeMeta: ReturnType<typeof getForgeTypeMeta>,
  rarityHexVal: number,
  canCraft: boolean,
  isSelected: boolean,
  progressRatio: number,
  hasRecommendation: boolean,
): void {
  const w = CANVAS_WIDTH - x * 2;
  const g = scene.add.graphics();
  const statusColor = canCraft ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER;
  const progress = Phaser.Math.Clamp(progressRatio, 0, 1);
  g.fillStyle(DUNGEON_UI.VOID, 0.48);
  g.fillRoundedRect(x, y + 4, w, rowH - 4, 9);
  g.fillStyle(isSelected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, rowH - 4, 9);
  g.fillStyle(rarityHexVal, isSelected ? 0.16 : canCraft ? 0.08 : 0.035);
  g.fillRoundedRect(x + 7, y + 7, 58, rowH - 18, 7);
  g.lineStyle(1.5, isSelected ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON, 0.94);
  g.strokeRoundedRect(x, y, w, rowH - 4, 9);
  g.fillStyle(statusColor, 1);
  g.fillRect(x + 1, y + 1, 3, rowH - 6);

  const iconX = x + 36;
  const iconY = y + 42;
  g.fillStyle(typeMeta.hex, 0.1);
  g.fillCircle(iconX, iconY, 24);
  g.lineStyle(1.3, rarityHexVal, 0.62);
  g.strokeCircle(iconX, iconY, 24);
  drawEquipmentSigil(g, iconX, iconY, bp.type, typeMeta.hex, canCraft ? 0.96 : 0.5, 1);
  g.lineStyle(1.4, statusColor, canCraft ? 0.8 : 0.48);
  g.beginPath();
  g.arc(iconX, iconY, 29, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * progress));
  g.strokePath();
  if (hasRecommendation) {
    g.fillStyle(DUNGEON_UI.JADE, 0.14);
    g.fillRoundedRect(x + 12, y + rowH - 48, 48, 18, 5);
    g.lineStyle(1, DUNGEON_UI.JADE, 0.52);
    g.strokeRoundedRect(x + 12, y + rowH - 48, 48, 18, 5);
  }
  c.add(g);

  c.add(scene.add.text(iconX, y + 12, `도면 ${cardNo}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: RARITY_COLORS[bp.rarity] ?? DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));
  c.add(scene.add.text(iconX, y + 77, getForgeRarityStars(bp.rarity), {
    fontFamily: 'sans-serif', fontSize: '10px', color: RARITY_COLORS[bp.rarity] ?? DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));
  c.add(scene.add.text(iconX, y + 96, canCraft ? '제작 가능' : '재료 부족', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: canCraft ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
  }).setOrigin(0.5));
  if (hasRecommendation) {
    c.add(scene.add.text(iconX, y + rowH - 39, '추천 장착', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(0.5));
  }
}

export function buildCraftTab(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
): void {
  const { gs } = ctx;
  const workbenchEndY = buildWorkbenchPanel(scene, ctx, c, 'craft');
  const listStartY = buildForgeTargetRail(scene, ctx, c, workbenchEndY);
  const ranked = rankForgeBlueprints(gs, {
    monsterId: ctx.focusMonsterId,
    sourceLabel: ctx.focusSourceLabel,
  });

  if (ranked.length === 0) {
    drawEmptyBlueprintState(scene, ctx, c, listStartY + 4);
    return;
  }

  const pageCount = Math.max(1, Math.ceil(ranked.length / CRAFT_PAGE_SIZE));
  const page = Phaser.Math.Clamp(ctx.page, 0, pageCount - 1);
  const visible = ranked.slice(page * CRAFT_PAGE_SIZE, (page + 1) * CRAFT_PAGE_SIZE);
  let oy = listStartY;
  const pad = LIST_PAD;
  const rowH = 154;
  visible.forEach((projection, index) => {
    const { blueprint: bp, recommendation, craftable, materials, whyNow } = projection;
    const isSelected = ctx.selectedBpId === bp.id;
    const rarityColor = RARITY_COLORS[bp.rarity] ?? '#aaaaaa';
    const rarityHexVal = rarityHex(bp.rarity);
    const typeMeta = getForgeTypeMeta(bp.type);
    const targetEquipment = recommendation
      ? getMonsterEquipmentDisplay(gs, recommendation.monsterId)
      : null;
    const targetLine = recommendation
      ? `${recommendation.monsterName} Lv.${recommendation.monsterLevel} · ${targetEquipment ? targetEquipment.name : '장비 미착용'}`
      : '추천 장착 대상 없음';
    const roomLine = recommendation?.room.readiness
      ? `${recommendation.room.roomLabel} · 준비 ${recommendation.room.readiness.before}→${recommendation.room.readiness.after}`
      : recommendation
        ? `${recommendation.room.roomLabel} · ${recommendation.room.roomContextLabel}`
        : '방 배치 정보 없음';
    const powerLine = recommendation?.room.power
      ? `전력 ${recommendation.room.power.before}→${recommendation.room.power.after} 예상`
      : recommendation
        ? `${recommendation.improvementLabel} · 배치 후 계산`
        : '예상 전력 없음';
    const materialLine = materials
      .map(formatForgeMaterialStatus)
      .reduce<string[]>((lines, material, materialIndex) => {
        const lineIndex = Math.floor(materialIndex / 2);
        lines[lineIndex] = lines[lineIndex] ? `${lines[lineIndex]} · ${material}` : material;
        return lines;
      }, [])
      .slice(0, 2)
      .join('\n');

    drawBlueprintCardShell(
      scene,
      c,
      pad,
      oy,
      rowH,
      bp,
      String(page * CRAFT_PAGE_SIZE + index + 1).padStart(2, '0'),
      typeMeta,
      rarityHexVal,
      craftable,
      isSelected,
      projection.materialNeed > 0 ? projection.materialHave / projection.materialNeed : 1,
      Boolean(recommendation),
    );

    const textX = pad + 78;
    c.add(scene.add.text(textX, oy + 13, truncateLabel(bp.name, 12), {
      fontFamily: 'sans-serif', fontSize: '13px', color: rarityColor, fontStyle: 'bold',
    }));
    c.add(scene.add.text(textX, oy + 32, `${typeMeta.label} · ${RARITY_NAMES[bp.rarity] ?? '일반'} · ${targetLine}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    }));
    c.add(scene.add.text(textX, oy + 49, whyNow, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: craftable ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
    }));
    const materialBg = scene.add.graphics();
    materialBg.fillStyle(DUNGEON_UI.VOID, 0.82);
    materialBg.fillRoundedRect(textX, oy + 66, CANVAS_WIDTH - pad - textX - 8, 39, 5);
    materialBg.lineStyle(1, craftable ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER, 0.32);
    materialBg.strokeRoundedRect(textX, oy + 66, CANVAS_WIDTH - pad - textX - 8, 39, 5);
    c.add(materialBg);
    c.add(scene.add.text(textX + 7, oy + 74, materialLine, {
      fontFamily: 'sans-serif', fontSize: '10px', lineSpacing: 4,
      color: craftable ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
    }));

    c.add(scene.add.text(textX, oy + 119, roomLine, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
      wordWrap: { width: 184, useAdvancedWrap: true }, maxLines: 1,
    }));
    c.add(scene.add.text(textX, oy + 137, powerLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: 184, useAdvancedWrap: true }, maxLines: 1,
    }));

    const buttonW = 88;
    const buttonH = 44;
    const buttonX = CANVAS_WIDTH - pad - buttonW - 8;
    const buttonY = oy + 109;
    const button = scene.add.graphics();
    button.fillStyle(DUNGEON_UI.SOOT, 1);
    button.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
    button.fillStyle(craftable ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER, craftable ? 0.9 : 0.08);
    button.fillRoundedRect(buttonX + 4, buttonY + 4, buttonW - 8, buttonH - 8, 5);
    button.lineStyle(1.5, craftable ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER, craftable ? 0.94 : 0.42);
    button.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
    c.add(button);
    c.add(scene.add.text(buttonX + buttonW / 2, buttonY + 15, craftable ? '지금 제작' : `부족 ${projection.materialMissing}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: craftable ? '#07100b' : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0.5));
    c.add(scene.add.text(buttonX + buttonW / 2, buttonY + 31, craftable ? '단조 시작 ›' : '재료 필요', {
      fontFamily: 'sans-serif', fontSize: '10px', color: craftable ? '#173426' : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));

    const rowZoneW = buttonX - pad - 8;
    const rowZone = scene.add.zone(pad, oy, rowZoneW, rowH - 4).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    rowZone.on('pointerdown', () => ctx.onSelectBlueprint(bp.id));
    c.add(rowZone);
    if (craftable) {
      const zone = scene.add.zone(buttonX, buttonY, buttonW, buttonH).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => ctx.onConfirmCraft(bp.id));
      c.add(zone);
    }
    oy += rowH;
  });
  drawPageNavigator(scene, ctx, c, oy + 4, ranked.length, CRAFT_PAGE_SIZE);
}

function drawEmptyBlueprintState(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
  y: number,
): void {
  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 128;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(DUNGEON_UI.BRASS, 0.09);
  g.fillRoundedRect(x + 8, y + 8, 70, h - 16, 7);
  g.lineStyle(1.5, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(x, y, w, h, 8);
  drawBlueprintSigil(g, x + 43, y + 46, DUNGEON_UI.BRASS_BRIGHT, 0.9, 1.25);
  c.add(g);
  c.add(scene.add.text(x + 43, y + 83, '설계도 없음', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 91, y + 20, '새 단조 명령 대기', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  c.add(scene.add.text(x + 91, y + 43, '전투에서 설계도를 획득하세요.\n심연에서는 다음 제작 재료를 수급할 수 있습니다.', {
    fontFamily: 'sans-serif', fontSize: '10px', lineSpacing: 4, color: DUNGEON_UI_CSS.TEXT,
  }));
  const buttonX = x + 91;
  const buttonY = y + 76;
  const buttonW = w - 103;
  const buttonH = 44;
  const button = scene.add.graphics();
  button.fillStyle(DUNGEON_UI.SOOT, 1);
  button.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
  button.fillStyle(DUNGEON_UI.BRASS, 0.14);
  button.fillRoundedRect(buttonX + 4, buttonY + 4, 34, buttonH - 8, 5);
  button.lineStyle(1.5, DUNGEON_UI.BRASS, 0.72);
  button.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
  drawSupplySigil(button, buttonX + 21, buttonY + 21, DUNGEON_UI.BRASS_BRIGHT, 0.94, 0.62);
  c.add(button);
  c.add(scene.add.text(buttonX + 48, buttonY + buttonH / 2, '심연에서 재료 수급', {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(buttonX + buttonW - 15, buttonY + buttonH / 2, '›', {
    fontFamily: 'sans-serif', fontSize: '16px', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));
  const zone = scene.add.zone(buttonX, buttonY, buttonW, buttonH).setOrigin(0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerdown', ctx.onOpenAbyss);
  c.add(zone);
}

export function buildDismantleTab(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
): void {
  const { gs } = ctx;
  const crafted = gs.craftedEquipment ?? [];
  const listStartY = buildWorkbenchPanel(scene, ctx, c, 'dismantle');
  if (crafted.length === 0) {
    drawEmptyDismantleState(scene, c, listStartY + 4);
    return;
  }

  const pageCount = Math.max(1, Math.ceil(crafted.length / DISMANTLE_PAGE_SIZE));
  const page = Phaser.Math.Clamp(ctx.page, 0, pageCount - 1);
  const visible = crafted
    .map((equipment, index) => ({ equipment, index }))
    .slice(page * DISMANTLE_PAGE_SIZE, (page + 1) * DISMANTLE_PAGE_SIZE);
  let oy = listStartY;
  const pad = LIST_PAD;
  const rowH = 120;
  visible.forEach(({ equipment: eq, index: idx }) => {
    const isSelected = ctx.selectedEqIdx === idx;
    const rarityColor = RARITY_COLORS[eq.rarity] ?? '#aaaaaa';
    const rarityHexVal = rarityHex(eq.rarity);
    const typeMeta = getForgeTypeMeta(eq.type);
    const effectLabels = summarizeEquipmentEffects(eq);
    const bp = Object.values(BLUEPRINT_DEFS).find(blueprint => blueprint.resultId === eq.id);
    const returned = getDismantleReturns(bp);
    const returnEntries = Object.entries(returned);
    const returnTotal = returnEntries.reduce((sum, [, qty]) => sum + qty, 0);
    const returnLine = returnEntries.length > 0
      ? returnEntries.map(([id, qty]) => `${getMaterialDisplay(id).name} +${qty}`).join(' · ')
      : '반환 재료 없음';
    const holder = getEquipmentHolderDisplay(gs, eq.id);
    const holderLine = holder
      ? `장착 중 · ${truncateLabel(holder.name, 7)} Lv.${holder.level} · 분해 시 해제`
      : '보관함 · 안전 회수';
    const x = pad;
    const w = CANVAS_WIDTH - pad * 2;
    const g = scene.add.graphics();
    g.fillStyle(DUNGEON_UI.VOID, 0.48);
    g.fillRoundedRect(x, oy + 4, w, rowH - 4, 9);
    g.fillStyle(isSelected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(x, oy, w, rowH - 4, 9);
    g.fillStyle(rarityHexVal, 0.08);
    g.fillRoundedRect(x + 7, oy + 7, 60, rowH - 18, 7);
    g.lineStyle(1.5, isSelected ? DUNGEON_UI.BRASS_BRIGHT : holder ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON, 0.92);
    g.strokeRoundedRect(x, oy, w, rowH - 4, 9);
    g.fillStyle(holder ? DUNGEON_UI.EMBER : DUNGEON_UI.BRASS, 1);
    g.fillRect(x + 1, oy + 1, 3, rowH - 6);
    g.fillStyle(typeMeta.hex, 0.1);
    g.fillCircle(x + 37, oy + 43, 24);
    g.lineStyle(1.2, rarityHexVal, 0.62);
    g.strokeCircle(x + 37, oy + 43, 24);
    drawEquipmentSigil(g, x + 37, oy + 43, eq.type, typeMeta.hex, 0.92, 1);
    c.add(g);
    c.add(scene.add.text(x + 37, oy + 12, `EQ.${String(idx + 1).padStart(2, '0')}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    c.add(scene.add.text(x + 37, oy + 78, `${typeMeta.label} · ${getForgeRarityStars(eq.rarity)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: typeMeta.color,
    }).setOrigin(0.5));
    c.add(scene.add.text(x + 78, oy + 14, truncateLabel(eq.name, 11), {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: rarityColor,
    }));
    c.add(scene.add.text(x + 78, oy + 34, holderLine, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: holder ? 'bold' : 'normal',
      color: holder ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
    }));
    drawEffectChips(scene, c, effectLabels, x + 78, oy + 51, rarityHexVal, 184);
    c.add(scene.add.text(x + 78, oy + 80, returnLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: returnTotal > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: 190, useAdvancedWrap: true }, maxLines: 1,
    }));
    c.add(scene.add.text(x + 78, oy + 99, `예상 회수 ${returnTotal}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }));

    const buttonX = x + w - 92;
    const buttonY = oy + 38;
    const buttonW = 80;
    const buttonH = 44;
    const button = scene.add.graphics();
    button.fillStyle(DUNGEON_UI.SOOT, 1);
    button.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
    button.fillStyle(DUNGEON_UI.EMBER, holder ? 0.12 : 0.2);
    button.fillRoundedRect(buttonX + 4, buttonY + 4, 28, buttonH - 8, 5);
    button.lineStyle(1.5, DUNGEON_UI.EMBER, 0.76);
    button.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 7);
    drawDismantleSigil(button, buttonX + 18, buttonY + 22, DUNGEON_UI.EMBER, 0.92, 0.55);
    c.add(button);
    c.add(scene.add.text(buttonX + 54, buttonY + buttonH / 2, '분해', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0.5));
    const zone = scene.add.zone(buttonX, buttonY, buttonW, buttonH).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onConfirmDismantle(idx, eq));
    c.add(zone);
    const rowZoneW = buttonX - x - 8;
    const rowZone = scene.add.zone(x, oy, rowZoneW, rowH - 4).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    rowZone.on('pointerdown', () => ctx.onSelectEquipment(idx));
    c.add(rowZone);
    oy += rowH;
  });
  drawPageNavigator(scene, ctx, c, oy + 4, crafted.length, DISMANTLE_PAGE_SIZE);
}

function drawEmptyDismantleState(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
): void {
  const x = LIST_PAD;
  const w = CANVAS_WIDTH - LIST_PAD * 2;
  const h = 112;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(DUNGEON_UI.EMBER, 0.07);
  g.fillRoundedRect(x + 8, y + 8, 72, h - 16, 7);
  g.lineStyle(1.5, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(x, y, w, h, 8);
  drawDismantleSigil(g, x + 44, y + 44, DUNGEON_UI.EMBER, 0.72, 1);
  c.add(g);
  c.add(scene.add.text(x + 44, y + 80, '회수 대기', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.EMBER, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 96, y + 28, '분해할 장비가 없습니다', {
    fontFamily: 'sans-serif', fontSize: '14px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }));
  c.add(scene.add.text(x + 96, y + 54, '제작 탭에서 장비를 단조하면\n재료 회수 상태를 확인할 수 있습니다.', {
    fontFamily: 'sans-serif', fontSize: '10px', lineSpacing: 5, color: DUNGEON_UI_CSS.TEXT,
  }));
}
