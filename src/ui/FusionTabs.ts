// ─── FusionTabs — shared types, helpers, and tab re-exports ──────────────────
// The 4 tab implementations live in separate files:
//   FusionEvolutionTab.ts  — 진화 (Evolution)
//   FusionAbsorptionTab.ts — 흡수 (Absorption)
//   FusionCombinationTab.ts — 조합 (Combination)
//   FusionAwakeningTab.ts  — 각성 (Awakening)
// FusionScene.ts imports everything from this barrel.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_STARS,
  getMonsterRarity, getMonsterEmoji,
} from '../data/fusion';

// ─── Shared types & constants ──────────────────────────────────────────────

const TABS = ['진화', '흡수', '조합', '각성'] as const;
export type TabId = typeof TABS[number];

export const TAB_ACCENT: Record<TabId, number> = {
  '진화': 0x44cc66, '흡수': 0xcc8844, '조합': 0x4488cc, '각성': 0xcc44cc,
};
export const TAB_ACCENT_CSS: Record<TabId, string> = {
  '진화': '#44cc66', '흡수': '#cc8844', '조합': '#4488cc', '각성': '#cc44cc',
};

/** Context object passed from FusionScene into each tab builder. */
export interface FusionTabContext {
  readonly scene: Phaser.Scene;
  readonly contentY: number;
  readonly cauldronEmoji: Phaser.GameObjects.Text | undefined;
  /** Re-renders the active tab content. */
  readonly refreshTab: () => void;
  /** Re-draws the header (e.g. after codex count changes). */
  readonly refreshHeader: () => void;
}

// ─── Shared slot drawing ──────────────────────────────────────────────────

export function drawMonsterSlot(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  x: number, y: number, w: number, h: number,
  monster: OwnedMonster | null,
  tabId: TabId,
  onTap: () => void,
): void {
  const accent    = TAB_ACCENT[tabId];
  const accentCSS = TAB_ACCENT_CSS[tabId];
  const g = ctx.scene.add.graphics();
  c.add(g);

  if (monster) {
    g.fillStyle(0x001408, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, accent, 0.7);
    g.strokeRoundedRect(x, y, w, h, 6);
    c.add(ctx.scene.add.text(x + w / 2, y + h / 2 - 12, getMonsterEmoji(monster.id), {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(x + w / 2, y + h / 2 + 12, `Lv.${monster.level}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#669977',
    }).setOrigin(0.5));
    const rarity = monster.rarity ?? getMonsterRarity(monster.id);
    if (rarity > 0) {
      c.add(ctx.scene.add.text(x + w / 2, y + h - 12, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '11px',
      }).setOrigin(0.5));
    }
  } else {
    g.fillStyle(0x000e06, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x1a3322, 0.8);
    g.strokeRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x1a3322, 0.5);
    g.lineBetween(x + 8, y + h / 2, x + w - 8, y + h / 2);
    g.lineBetween(x + w / 2, y + 8, x + w / 2, y + h - 8);
    c.add(ctx.scene.add.text(x + w / 2, y + h / 2, '+', {
      fontFamily: 'sans-serif', fontSize: '20px', color: accentCSS,
    }).setOrigin(0.5).setAlpha(0.4));
  }

  const zone = ctx.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
  zone.on('pointerdown', onTap);
  c.add(zone);
}

// ─── Fusion animation helpers ─────────────────────────────────────────────

export function showFusionAnimation(
  ctx: FusionTabContext,
  tabId: TabId,
  onComplete: () => void,
): void {
  const overlay = ctx.scene.add.graphics().setDepth(60);
  overlay.fillStyle(0x000000, 0);
  overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const label = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '⚗️', {
    fontFamily: 'sans-serif', fontSize: '64px',
  }).setOrigin(0.5).setDepth(61).setAlpha(0);

  const sub = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60, '합성 중...', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: TAB_ACCENT_CSS[tabId],
  }).setOrigin(0.5).setDepth(61).setAlpha(0);

  ctx.scene.tweens.add({ targets: [label, sub], alpha: 1, duration: 300, ease: 'Quad.easeOut' });
  ctx.scene.tweens.add({ targets: label, rotation: Math.PI * 2, duration: 1200, ease: 'Linear' });
  if (ctx.cauldronEmoji) {
    ctx.scene.tweens.add({
      targets: ctx.cauldronEmoji, scaleX: 1.5, scaleY: 1.5,
      duration: 600, yoyo: true, ease: 'Back.easeOut',
    });
  }

  ctx.scene.time.delayedCall(1600, () => {
    ctx.scene.tweens.add({
      targets: [label, sub, overlay], alpha: 0, duration: 300,
      onComplete: () => { label.destroy(); sub.destroy(); overlay.destroy(); onComplete(); },
    });
  });
}

export function showResultToast(ctx: FusionTabContext, msg: string, color: string): void {
  const t = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, msg, {
    fontFamily: 'Georgia, serif', fontSize: '17px', color, fontStyle: 'bold',
    backgroundColor: '#001208', padding: { x: 18, y: 10 },
  }).setOrigin(0.5).setDepth(65).setAlpha(0);
  ctx.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 350, ease: 'Back.easeOut' });
  ctx.scene.time.delayedCall(1800, () => {
    ctx.scene.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
  });
}

// ─── Monster picker bottom sheet ──────────────────────────────────────────

export function openMonsterPicker(
  ctx: FusionTabContext,
  filter: ((m: OwnedMonster) => boolean) | undefined,
  onSelect: (m: OwnedMonster) => void,
): void {
  const gs       = loadGameState();
  const monsters = filter ? gs.ownedMonsters.filter(filter) : gs.ownedMonsters;

  const SHEET_H = 360;
  const targetY = CANVAS_HEIGHT - SHEET_H;
  const c       = ctx.scene.add.container(0, CANVAS_HEIGHT).setDepth(50);

  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, -CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive();
  dim.on('pointerdown', slideDown);
  c.add(dim);

  const sg = ctx.scene.add.graphics();
  sg.fillStyle(0x000e08, 1);
  sg.fillRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
  sg.lineStyle(1.5, 0x00cc66, 0.4);
  sg.strokeRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
  c.add(sg);

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, 18, '몬스터 선택', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44cc88',
  }).setOrigin(0.5));

  if (monsters.length === 0) {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, SHEET_H / 2, '조건에 맞는 몬스터 없음', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#335544',
    }).setOrigin(0.5));
  }

  const cols = 4;
  const cellW = 72, cellH = 78;
  const padX  = (CANVAS_WIDTH - cols * cellW) / (cols + 1);
  monsters.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const mx  = padX + col * (cellW + padX);
    const my  = 40 + row * (cellH + 8);

    const mg = ctx.scene.add.graphics();
    mg.fillStyle(0x001408, 1);
    mg.fillRoundedRect(mx, my, cellW, cellH, 6);
    mg.lineStyle(1, 0x003322, 0.8);
    mg.strokeRoundedRect(mx, my, cellW, cellH, 6);
    c.add(mg);

    c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH / 2 - 12, getMonsterEmoji(m.id), {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH / 2 + 8, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#44aa66',
    }).setOrigin(0.5));
    const rarity = m.rarity ?? getMonsterRarity(m.id);
    if (rarity > 0) {
      c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH - 10, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '11px',
      }).setOrigin(0.5));
    }

    const zone = ctx.scene.add.zone(mx, my, cellW, cellH).setOrigin(0).setInteractive();
    zone.on('pointerdown', () => { slideDown(); onSelect(m); });
    c.add(zone);
  });

  let y = CANVAS_HEIGHT;
  const ti = setInterval(() => {
    y = Math.max(targetY, y - 40);
    c.setY(y);
    if (y <= targetY) clearInterval(ti);
  }, 28);

  function slideDown(): void {
    let sy = c.y;
    const td = setInterval(() => {
      sy = Math.min(CANVAS_HEIGHT, sy + 40);
      c.setY(sy);
      if (sy >= CANVAS_HEIGHT) { clearInterval(td); c.destroy(true); }
    }, 28);
  }
}

// ─── Confirmation dialog ─────────────────────────────────────────────────

export function showConfirmDialog(
  ctx: FusionTabContext,
  title: string,
  detail: string,
  accentCss: string,
  onConfirm: () => void,
): void {
  const PW = 260, PH = 164;
  const PX = (CANVAS_WIDTH - PW) / 2;
  const PY = (CANVAS_HEIGHT - PH) / 2;
  const ov = ctx.scene.add.container(0, 0).setDepth(75);

  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.78);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const bg = ctx.scene.add.graphics();
  bg.fillStyle(0x080e0a, 1);
  bg.fillRoundedRect(PX, PY, PW, PH, 10);
  bg.lineStyle(1.5, 0x334433, 0.85);
  bg.strokeRoundedRect(PX, PY, PW, PH, 10);
  ov.add(bg);

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 26, title, {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: accentCss, fontStyle: 'bold',
  }).setOrigin(0.5));

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 58, detail, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#998877',
    align: 'center', wordWrap: { width: PW - 32 },
  }).setOrigin(0.5));

  const cancelBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 - 56, PY + PH - 28, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#777777',
    backgroundColor: '#111111', padding: { x: 20, y: 8 },
  }).setOrigin(0.5).setInteractive();
  cancelBtn.on('pointerdown', () => ov.destroy(true));
  ov.add(cancelBtn);

  const confirmBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 + 56, PY + PH - 28, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: accentCss, fontStyle: 'bold',
    backgroundColor: '#111111', padding: { x: 20, y: 8 },
  }).setOrigin(0.5).setInteractive();
  confirmBtn.on('pointerdown', () => { ov.destroy(true); onConfirm(); });
  ov.add(confirmBtn);

  ov.setAlpha(0);
  ctx.scene.tweens.add({ targets: ov, alpha: 1, duration: 160 });
}

// ─── Tab re-exports (barrel) ──────────────────────────────────────────────
// FusionScene.ts imports these without knowing the individual tab modules.

export { buildEvolutionTab, type EvolutionState } from './FusionEvolutionTab';
export { buildAbsorptionTab, type AbsorptionState } from './FusionAbsorptionTab';
export { buildCombinationTab, type CombinationState } from './FusionCombinationTab';
export { buildAwakeningTab } from './FusionAwakeningTab';
