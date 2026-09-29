// ─── Forge '함정' tab ─────────────────────────────────────────────────────────
// Traps are crafted here into stock and installed from the placement tray.
// Each row: what you hold (stock, mastery), what the next craft/enhance
// costs, and the two actions. All facts come from trapForgeView (pure).

import Phaser from 'phaser';
import { addTrapIcon } from './TrapIcon';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { buildTrapForgeRows, summarizeTrapForge, type TrapForgeRow, type TrapNeedLine } from '../data/trapForgeView';
import { TRAP_MASTERY_MAX } from '../data/traps';
import { drawPageNavigator } from './ForgeTabs';
import { LIST_PAD, type ForgeContext } from './ForgeShared';

export const TRAP_PAGE_SIZE = 3;
// 3 rows + summary + pager fit the 644px content band with a two-line recipe
// budget (tier-3 recipes list four inputs); buttons keep the 44px touch target.
const ROW_H = 146;
const ROW_GAP = 6;
const BUTTON_H = 44;
const TIER_HEX: Record<1 | 2 | 3, number> = { 1: 0xc8921a, 2: 0x8ac7ff, 3: 0xd48cff };
const TIER_CSS: Record<1 | 2 | 3, string> = { 1: '#c8921a', 2: '#8ac7ff', 3: '#d48cff' };

function needLine(lines: readonly TrapNeedLine[]): string {
  return lines.map(line => `${line.emoji}${line.name} ${line.have}/${line.need}`).join(' · ');
}

function drawSummary(scene: Phaser.Scene, ctx: ForgeContext, c: Phaser.GameObjects.Container, y: number): number {
  const summary = summarizeTrapForge(ctx.gs);
  const x = LIST_PAD, w = CANVAS_WIDTH - LIST_PAD * 2, h = 54;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 0.96);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(x, y, w, h, 7);
  c.add(g);
  c.add(scene.add.text(x + 12, y + 10, `재고 ${summary.stockTotal} · 숙련 합계 ${summary.masteryTotal} · 지금 제작 가능 ${summary.craftableCount}종`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  c.add(scene.add.text(x + 12, y + 31, '1티어는 재료로, 2·3티어는 하위 함정 두 개를 융합. 설치는 홈 배치 트레이에서.', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }));
  return y + h + ROW_GAP;
}

function drawActionButton(
  scene: Phaser.Scene, c: Phaser.GameObjects.Container,
  x: number, y: number, w: number, label: string, enabled: boolean, accent: number, onTap: () => void,
): void {
  const h = BUTTON_H;
  const bg = scene.add.graphics();
  bg.fillStyle(enabled ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.VOID, 1);
  bg.fillRoundedRect(x, y, w, h, 6);
  bg.lineStyle(1.2, enabled ? accent : DUNGEON_UI.IRON, enabled ? 0.85 : 0.35);
  bg.strokeRoundedRect(x, y, w, h, 6);
  c.add(bg);
  c.add(scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: enabled ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  if (!enabled) return;
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onTap);
  c.add(zone);
}

function drawTrapRow(scene: Phaser.Scene, ctx: ForgeContext, c: Phaser.GameObjects.Container, row: TrapForgeRow, y: number): void {
  const { def } = row;
  const x = LIST_PAD, w = CANVAS_WIDTH - LIST_PAD * 2;
  const tierHex = TIER_HEX[def.tier];
  const locked = row.craft.reason === 'locked';

  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.STONE, 1);
  g.fillRoundedRect(x, y, w, ROW_H, 8);
  g.fillStyle(tierHex, locked ? 0.03 : 0.08);
  g.fillRoundedRect(x, y, w, ROW_H, 8);
  g.lineStyle(1, row.stock > 0 ? tierHex : DUNGEON_UI.IRON, row.stock > 0 ? 0.7 : 0.6);
  g.strokeRoundedRect(x, y, w, ROW_H, 8);
  c.add(g);

  c.add(addTrapIcon(scene, def.id, x + 30, y + 26, 32, locked ? 0.35 : 1));
  c.add(scene.add.text(x + 30, y + 50, `T${def.tier}`, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: TIER_CSS[def.tier],
  }).setOrigin(0.5));

  const textX = x + 60;
  c.add(scene.add.text(textX, y + 10, def.name, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: locked ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.PARCHMENT,
  }));
  c.add(scene.add.text(textX + 92, y + 12, row.afflictionLabel, {
    fontFamily: 'sans-serif', fontSize: '10px', color: TIER_CSS[def.tier],
  }));
  c.add(scene.add.text(x + w - 12, y + 10, `재고 ${row.stock}`, {
    fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: row.stock > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0));

  const masteryText = `숙련 +${row.mastery}/${TRAP_MASTERY_MAX} · 효과 ×${row.masteryMult.toFixed(2)}`;
  c.add(scene.add.text(textX, y + 29, masteryText, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
  }));

  const craftNeeds = [...row.inputTraps, ...row.materials];
  const craftLine = scene.add.text(textX, y + 46, `제작: ${needLine(craftNeeds)}`, {
    fontFamily: 'sans-serif', fontSize: '10px', lineSpacing: 2, color: row.craft.ok ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: w - 72 },
  });
  c.add(craftLine);
  // The recipe may take two lines; the enhance line follows it instead of a fixed slot.
  c.add(scene.add.text(textX, craftLine.y + craftLine.height + 2, row.enhanceMaterials.length ? `강화: ${needLine(row.enhanceMaterials)}` : '강화: 숙련 최대', {
    fontFamily: 'sans-serif', fontSize: '10px', color: row.enhance.ok ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: w - 72 },
  }));

  const btnW = 108, btnY = y + ROW_H - BUTTON_H - 6;
  drawActionButton(scene, c, x + w - btnW * 2 - 20, btnY, btnW, row.craft.label, row.craft.ok, DUNGEON_UI.JADE, () => ctx.onCraftTrap(def.id));
  drawActionButton(scene, c, x + w - btnW - 10, btnY, btnW, row.enhance.label, row.enhance.ok, DUNGEON_UI.BRASS, () => ctx.onEnhanceTrap(def.id));
}

export function buildTrapTab(scene: Phaser.Scene, ctx: ForgeContext, c: Phaser.GameObjects.Container): void {
  const rows = buildTrapForgeRows(ctx.gs);
  let y = drawSummary(scene, ctx, c, 8);
  const pageCount = Math.max(1, Math.ceil(rows.length / TRAP_PAGE_SIZE));
  const page = Phaser.Math.Clamp(ctx.page, 0, pageCount - 1);
  for (const row of rows.slice(page * TRAP_PAGE_SIZE, (page + 1) * TRAP_PAGE_SIZE)) {
    drawTrapRow(scene, ctx, c, row, y);
    y += ROW_H + ROW_GAP;
  }
  drawPageNavigator(scene, ctx, c, y, rows.length, TRAP_PAGE_SIZE);
}
