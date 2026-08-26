// ─── Forge Tabs ───────────────────────────────────────────────────────────────
// buildCraftTab, buildDismantleTab, drawBlueprintCardShell.
// All functions take (scene, ctx, c, ...) — no `this` usage.

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { BLUEPRINT_DEFS, RARITY_COLORS, RARITY_NAMES } from '../data/fusion';
import type { BlueprintDef } from '../data/fusion';
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
import { addMonsterPortrait } from './MonsterPortraitView';

// ─── drawBlueprintCardShell ───────────────────────────────────────────────────

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
  const g = scene.add.graphics();
  const cardW = CANVAS_WIDTH - x * 2;
  const itemCx = x + 35;
  const itemCy = y + 31;
  const statusColor = canCraft ? 0x8de36d : 0xcc6644;
  const progress = Phaser.Math.Clamp(progressRatio, 0, 1);

  g.fillStyle(rarityHexVal, isSelected ? 0.16 : canCraft ? 0.10 : 0.045);
  g.fillRoundedRect(x + 9, y + 10, 52, rowH - 26, 9);
  g.lineStyle(1, rarityHexVal, canCraft ? 0.42 : 0.20);
  g.strokeRoundedRect(x + 10, y + 11, 50, rowH - 28, 8);
  for (let i = 0; i < 5; i++) {
    const lineY = y + 19 + i * 13;
    g.lineStyle(0.8, rarityHexVal, canCraft ? 0.12 : 0.055);
    g.lineBetween(x + 17, lineY + 10, x + 50, lineY);
  }

  g.fillStyle(typeMeta.hex, canCraft ? 0.12 : 0.055);
  g.fillCircle(itemCx, itemCy, 27);
  g.lineStyle(bp.rarity >= 3 ? 1.4 : 1, rarityHexVal, canCraft ? 0.58 : 0.28);
  g.strokeCircle(itemCx, itemCy, 25);
  g.lineStyle(1, typeMeta.hex, canCraft ? 0.34 : 0.16);
  g.strokeCircle(itemCx, itemCy, 18);
  g.fillStyle(0x070503, 0.34);
  g.fillEllipse(itemCx, itemCy + 26, 56, 9);

  g.lineStyle(1.5, statusColor, canCraft ? 0.72 : 0.44);
  g.beginPath();
  g.arc(
    itemCx,
    itemCy,
    30,
    Phaser.Math.DegToRad(-90),
    Phaser.Math.DegToRad(-90 + 360 * progress),
  );
  g.strokePath();

  g.fillStyle(0x050806, 0.94);
  g.fillRoundedRect(x + 11, y + 7, 48, 13, 5);
  g.lineStyle(1, rarityHexVal, 0.46);
  g.strokeRoundedRect(x + 11, y + 7, 48, 13, 5);
  g.fillStyle(0x050806, 0.94);
  g.fillRoundedRect(x + 14, y + rowH - 31, 43, 13, 5);
  g.lineStyle(1, statusColor, canCraft ? 0.58 : 0.34);
  g.strokeRoundedRect(x + 14, y + rowH - 31, 43, 13, 5);

  g.fillStyle(rarityHexVal, canCraft ? 0.16 : 0.07);
  g.fillRoundedRect(x + 17, y + 71, 36, 14, 5);
  g.lineStyle(1, rarityHexVal, canCraft ? 0.5 : 0.22);
  g.strokeRoundedRect(x + 17, y + 71, 36, 14, 5);
  for (let i = 0; i < Math.min(3, bp.rarity + 1); i++) {
    g.fillStyle(rarityHexVal, canCraft ? 0.74 : 0.34);
    g.fillCircle(x + 22 + i * 7, y + 97, i === 0 ? 1.8 : 1.3);
  }

  if (hasRecommendation) {
    g.fillStyle(0x061816, 0.92);
    g.fillRoundedRect(x + cardW - 156, y + 34, 62, 15, 6);
    g.lineStyle(1, 0xc8e8b0, 0.52);
    g.strokeRoundedRect(x + cardW - 156, y + 34, 62, 15, 6);
    g.fillStyle(0xc8e8b0, 0.16);
    g.fillCircle(x + cardW - 146, y + 41.5, 4.2);
  }

  c.add(g);
  c.add(scene.add.text(x + 35, y + 13.5, `도면 ${cardNo}`, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: RARITY_COLORS[bp.rarity] ?? '#d6b783',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 35, y + rowH - 24.5, canCraft ? 'READY' : 'WAIT', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: canCraft ? '#c8f7b0' : '#ffb088',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  if (hasRecommendation) {
    c.add(scene.add.text(x + cardW - 124, y + 41.5, '추천 장착', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }
}

// ─── buildCraftTab ────────────────────────────────────────────────────────────

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
    c.add(scene.add.text(CANVAS_WIDTH / 2, listStartY + 18, '보유한 설계도가 없습니다.\n전투에서 설계도를 획득하세요.', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0));
    return;
  }

  let oy = listStartY;
  const pad = LIST_PAD;
  const rowH = 166;

  ranked.forEach(projection => {
    const { blueprint: bp, recommendation, craftable, materials, whyNow } = projection;
    const isSelected = ctx.selectedBpId === bp.id;
    const rarityColor = RARITY_COLORS[bp.rarity] ?? '#aaaaaa';
    const rarityHexVal = rarityHex(bp.rarity);
    const targetEquipment = recommendation
      ? getMonsterEquipmentDisplay(gs, recommendation.monsterId)
      : null;
    const targetLine = recommendation
      ? `${recommendation.monsterName} Lv.${recommendation.monsterLevel} · ${targetEquipment ? `${targetEquipment.emoji} ${targetEquipment.name}` : '장비 없음'}`
      : '장착 대상 없음';
    const roomLine = recommendation?.room.readiness
      ? `${recommendation.room.roomLabel} 실제 배치 · 준비 ${recommendation.room.readiness.before}→${recommendation.room.readiness.after}`
      : recommendation
        ? `${recommendation.room.roomLabel} · ${recommendation.room.roomContextLabel}`
        : '추천 대상 없음';
    const powerLine = recommendation?.room.power
      ? `전력 ${recommendation.room.power.before}→${recommendation.room.power.after} 예상`
      : recommendation
        ? '준비도·방 전력은 실제 배치 후 계산'
        : '준비도·방 전력 추정 없음';
    const materialLine = materials
      .map(formatForgeMaterialStatus)
      .reduce<string[]>((lines, material, index) => {
        const lineIndex = Math.floor(index / 2);
        lines[lineIndex] = lines[lineIndex] ? `${lines[lineIndex]} · ${material}` : material;
        return lines;
      }, [])
      .join('\n');

    const bg = scene.add.graphics();
    bg.fillStyle(isSelected ? 0x2d1808 : 0x170d06, 1);
    bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
    bg.fillStyle(0x060402, 0.42);
    bg.fillRoundedRect(pad + 5, oy + 5, CANVAS_WIDTH - pad * 2 - 10, rowH - 14, 8);
    bg.fillStyle(rarityHexVal, craftable ? 0.12 : 0.05);
    bg.fillRoundedRect(pad + 6, oy + 7, 58, rowH - 18, 8);
    bg.lineStyle(1.5, isSelected ? 0xffaa44 : (craftable ? rarityHexVal : 0x2a1a00), craftable ? 0.92 : 0.78);
    bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
    bg.lineStyle(1, 0xffffff, isSelected ? 0.16 : 0.08);
    bg.lineBetween(pad + 74, oy + 12, pad + 74, oy + rowH - 18);
    c.add(bg);

    if (recommendation) {
      addMonsterPortrait(scene, c, pad + 35, oy + 35, recommendation.monsterId, {
        size: 50,
        frameColor: recommendation.accent,
        glowColor: recommendation.accent,
        equippedSkins: gs.equippedSkins,
      });
      c.add(scene.add.text(pad + 35, oy + 70, `Lv.${recommendation.monsterLevel}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#fff3d0', fontStyle: 'bold',
      }).setOrigin(0.5));
    } else {
      c.add(scene.add.text(pad + 35, oy + 34, bp.resultEmoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5));
    }
    c.add(scene.add.text(pad + 35, oy + 89, getForgeRarityStars(bp.rarity), {
      fontFamily: 'sans-serif', fontSize: '10px', color: rarityColor,
    }).setOrigin(0.5));
    c.add(scene.add.text(pad + 35, oy + 108, craftable ? '제작 가능' : `부족 ${projection.materialMissing}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: craftable ? '#c8f7b0' : '#ffb088', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(scene.add.text(pad + 84, oy + 12, `${bp.resultEmoji} ${bp.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: rarityColor, fontStyle: 'bold',
    }));
    c.add(scene.add.text(pad + 84, oy + 26, targetLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ffe6bd',
    }));
    c.add(scene.add.text(pad + 84, oy + 42, whyNow, {
      fontFamily: 'sans-serif', fontSize: '10px', color: craftable ? '#8fdc72' : '#d88a66',
    }));
    c.add(scene.add.text(pad + 84, oy + 58, materialLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: craftable ? '#b6e58f' : '#ffb088',
    }));
    c.add(scene.add.text(pad + 84, oy + 86, roomLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#8fffe0',
    }));
    c.add(scene.add.text(pad + 84, oy + 100, powerLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#8fffe0',
    }));
    const btnW = 66, btnH = 44;
    const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
    const btnY = oy + 114;

    const btnBg = scene.add.graphics();
    btnBg.fillStyle(craftable ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT, craftable ? 1 : 0.5);
    btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 10);
    btnBg.fillStyle(craftable ? CASUAL.GREEN : CASUAL.PANEL_SOFT, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.fillStyle(0xffffff, craftable ? 0.32 : 0.2);
    btnBg.fillRoundedRect(btnX + 6, btnY + 5, btnW - 12, 6, 3);
    btnBg.lineStyle(2, craftable ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    c.add(btnBg);

    c.add(scene.add.text(btnX + btnW / 2, btnY + btnH / 2, craftable ? '제작' : '재료 부족', {
      fontFamily: 'sans-serif', fontSize: craftable ? '12px' : '10px', fontStyle: 'bold',
      color: craftable ? '#ffffff' : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    const rowZoneW = CANVAS_WIDTH - pad * 3 - btnW - 10;
    const rowZone = scene.add.zone(pad + rowZoneW / 2, oy + (rowH - 4) / 2, rowZoneW, rowH - 4)
      .setInteractive({ useHandCursor: true });
    rowZone.on('pointerdown', () => ctx.onSelectBlueprint(bp.id));
    c.add(rowZone);
    if (craftable) {
      const zone = scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => ctx.onConfirmCraft(bp.id));
      c.add(zone);
    }

    oy += rowH;
  });
}

// ─── buildDismantleTab ────────────────────────────────────────────────────────

export function buildDismantleTab(
  scene: Phaser.Scene,
  ctx: ForgeContext,
  c: Phaser.GameObjects.Container,
): void {
  const { gs } = ctx;
  const crafted = gs.craftedEquipment ?? [];
  const listStartY = buildWorkbenchPanel(scene, ctx, c, 'dismantle');

  if (crafted.length === 0) {
    c.add(scene.add.text(CANVAS_WIDTH / 2, listStartY + 18, '분해할 장비가 없습니다.\n먼저 장비를 제작하세요.', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0));
    return;
  }

  let oy = listStartY;
  const pad = LIST_PAD;
  const rowH = 98;

  crafted.forEach((eq, idx) => {
    const isSelected = ctx.selectedEqIdx === idx;
    const rarityColor = RARITY_COLORS[eq.rarity] ?? '#aaaaaa';
    const rarityHexVal = rarityHex(eq.rarity);
    const typeMeta = getForgeTypeMeta(eq.type);
    const cardNo = String(idx + 1).padStart(3, '0');
    const effectLabels = summarizeEquipmentEffects(eq);
    const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
    const returned = getDismantleReturns(bp);
    const returnEntries = Object.entries(returned);
    const returnTotal = returnEntries.reduce((sum, [, qty]) => sum + qty, 0);
    const retStr = returnEntries
      .map(([id, qty]) => {
        const material = getMaterialDisplay(id);
        return qty > 0 ? `${material.emoji}×${qty}` : null;
      }).filter(Boolean).join('  ');
    const holder = getEquipmentHolderDisplay(gs, eq.id);
    const holderLine = holder
      ? `장착 중 · ${holder.emoji}${truncateLabel(holder.name, 5)} Lv.${holder.level}`
      : '보관함 · 안전 회수';

    const bg = scene.add.graphics();
    bg.fillStyle(isSelected ? 0x2a1208 : 0x170806, 1);
    bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
    bg.fillStyle(0x060302, 0.42);
    bg.fillRoundedRect(pad + 5, oy + 5, CANVAS_WIDTH - pad * 2 - 10, rowH - 14, 8);
    bg.fillStyle(rarityHexVal, 0.09);
    bg.fillRoundedRect(pad + 6, oy + 7, 58, rowH - 18, 8);
    bg.lineStyle(1.5, isSelected ? 0xffaa44 : 0x7a2f12, isSelected ? 0.96 : 0.78);
    bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
    bg.lineStyle(1, 0xffffff, isSelected ? 0.16 : 0.07);
    bg.lineBetween(pad + 74, oy + 12, pad + 74, oy + rowH - 18);
    c.add(bg);

    const typeBadge = scene.add.graphics();
    typeBadge.fillStyle(typeMeta.hex, 0.13);
    typeBadge.fillRoundedRect(pad + 15, oy + 52, 40, 15, 6);
    typeBadge.lineStyle(0.8, typeMeta.hex, 0.42);
    typeBadge.strokeRoundedRect(pad + 15, oy + 52, 40, 15, 6);
    c.add(typeBadge);

    c.add(scene.add.text(pad + 35, oy + 12, `EQ.${cardNo}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#927757',
    }).setOrigin(0.5));
    c.add(scene.add.text(pad + 35, oy + 30, eq.emoji, {
      fontFamily: 'sans-serif', fontSize: '28px',
    }).setOrigin(0.5));
    c.add(scene.add.text(pad + 35, oy + 59, `${typeMeta.icon} ${typeMeta.label}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: typeMeta.color, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(scene.add.text(pad + 35, oy + 73, getForgeRarityStars(eq.rarity), {
      fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
    }).setOrigin(0.5));
    c.add(scene.add.text(pad + 35, oy + 86, RARITY_NAMES[eq.rarity] ?? '일반', {
      fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
    }).setOrigin(0.5));

    c.add(scene.add.text(pad + 84, oy + 10, truncateLabel(eq.name, 9), {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: rarityColor,
    }));

    const returnChipX = CANVAS_WIDTH - pad - 132;
    const returnChip = scene.add.graphics();
    returnChip.fillStyle(returnTotal > 0 ? 0x201006 : 0x100906, 0.96);
    returnChip.fillRoundedRect(returnChipX, oy + 9, 56, 18, 6);
    returnChip.lineStyle(1, returnTotal > 0 ? 0xffaa44 : 0x63402a, 0.6);
    returnChip.strokeRoundedRect(returnChipX, oy + 9, 56, 18, 6);
    c.add(returnChip);
    c.add(scene.add.text(returnChipX + 28, oy + 18, returnTotal > 0 ? `회수 +${returnTotal}` : '회수 없음', {
      fontFamily: 'sans-serif',
      fontSize: returnTotal > 0 ? '9px' : '8px',
      color: returnTotal > 0 ? '#ffd08a' : '#8d6c50',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(scene.add.text(pad + 84, oy + 29, holderLine, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: holder ? '#ffb088' : '#9f8a68',
      fontStyle: holder ? 'bold' : 'normal',
    }));
    drawEffectChips(scene, c, effectLabels, pad + 84, oy + 45, rarityHexVal, 166);
    c.add(scene.add.text(pad + 84, oy + 70, retStr ? `반환 ${retStr}` : '반환 재료 없음', {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: returnTotal > 0 ? '#d6b582' : '#7d5f48',
    }));

    const btnW = 70, btnH = 28;
    const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
    const btnY = oy + (rowH - 4 - btnH) / 2;

    const dismantleFill = holder ? CASUAL.RED : CASUAL.GOLD;
    const dismantleEdge = holder ? CASUAL.RED_DK : CASUAL.GOLD_DK;
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(dismantleEdge, 1);
    btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 13);
    btnBg.fillStyle(dismantleFill, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 13);
    btnBg.fillStyle(0xffffff, 0.32);
    btnBg.fillRoundedRect(btnX + 6, btnY + 5, btnW - 12, 6, 3);
    btnBg.lineStyle(2, dismantleEdge, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 13);
    c.add(btnBg);

    c.add(scene.add.text(btnX + btnW / 2, btnY + btnH / 2, '분해', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));

    const zone = scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => ctx.onConfirmDismantle(idx, eq));
    c.add(zone);

    const rowZoneW = CANVAS_WIDTH - pad * 3 - btnW - 10;
    const rowZone = scene.add.zone(pad + rowZoneW / 2, oy + (rowH - 4) / 2, rowZoneW, rowH - 4)
      .setInteractive({ useHandCursor: true });
    rowZone.on('pointerdown', () => ctx.onSelectEquipment(idx));
    c.add(rowZone);

    oy += rowH;
  });
}
