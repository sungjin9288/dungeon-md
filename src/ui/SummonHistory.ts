/**
 * SummonHistory.ts — history tab renderers.
 * All functions take (scene, ctx, ...) — no `this` usage.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { RARITIES, RARITY_COLORS, RARITY_CSS, RARITY_STARS, RARITY_KO } from '../data/summonPools';
import { CX, CARDS_Y, getDexNo, getMonsterTagLine } from './SummonShared';

// ─── Context ──────────────────────────────────────────────────────────────────

export type HistoryFilter = 'all' | 'new' | 'dupe';

export interface SummonHistoryContext {
  historyFilter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
}

// ─── buildHistoryTab ──────────────────────────────────────────────────────────

/**
 * Creates and returns the history tab container, wired to ctx.
 * Call once from SummonScene.create().
 */
export function buildHistoryTab(
  scene: Phaser.Scene,
  ctx: SummonHistoryContext,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(7);
  rebuildHistory(scene, container, ctx);
  return container;
}

// ─── rebuildHistory ───────────────────────────────────────────────────────────

/**
 * Clears and redraws the history container in-place.
 * Called by buildHistoryTab and by the scene whenever historyFilter changes.
 */
export function rebuildHistory(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  ctx: SummonHistoryContext,
): void {
  container.removeAll(true);
  const c  = container;
  const gs = loadGameState();
  const history = (gs.summonHistory ?? []).slice().reverse().slice(0, 100);

  // ── Filter tabs ─────────────────────────────────────────────────────────────
  const filterY = CARDS_Y - 4;
  type FilterEntry = { label: string; val: HistoryFilter };
  const filters: FilterEntry[] = [
    { label: '전체',   val: 'all'  },
    { label: '새 몬스터', val: 'new'  },
    { label: '중복',   val: 'dupe' },
  ];

  filters.forEach((f, i) => {
    const fx       = 50 + i * 110;
    const isActive = ctx.historyFilter === f.val;
    const fg       = scene.add.graphics();

    if (isActive) {
      fg.fillStyle(CASUAL.EDGE, 0.3);
      fg.fillRoundedRect(fx - 40, filterY - 8, 80, 24, 11);
      fg.fillStyle(CASUAL.PURPLE, 1);
      fg.fillRoundedRect(fx - 40, filterY - 10, 80, 24, 11);
      fg.fillStyle(0xffffff, 0.3);
      fg.fillRoundedRect(fx - 34, filterY - 7, 68, 5, 3);
    } else {
      fg.fillStyle(CASUAL.PANEL, 1);
      fg.fillRoundedRect(fx - 40, filterY - 10, 80, 24, 11);
      fg.fillStyle(0xffffff, 0.12);
      fg.fillRoundedRect(fx - 34, filterY - 7, 68, 5, 3);
      fg.lineStyle(2.5, CASUAL.EDGE, 1);
      fg.strokeRoundedRect(fx - 40, filterY - 10, 80, 24, 11);
    }
    c.add(fg);

    const ft = scene.add.text(fx, filterY + 2, f.label, {
      fontFamily:      'sans-serif',
      fontSize:        '10px',
      fontStyle:       'bold',
      color:           isActive ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
      stroke:          isActive ? '#00000033' : '#00000000',
      strokeThickness: isActive ? 3 : 0,
    }).setOrigin(0.5).setInteractive();

    ft.on('pointerdown', () => ctx.onFilterChange(f.val));
    c.add(ft);
  });

  // ── Filtered rows ────────────────────────────────────────────────────────────
  const filtered = history.filter(r => {
    if (ctx.historyFilter === 'new')  return r.isNew;
    if (ctx.historyFilter === 'dupe') return !r.isNew;
    return true;
  });

  if (filtered.length === 0) {
    c.add(scene.add.text(CX, CARDS_Y + 80, '소환 기록이 없습니다', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
  } else {
    let ry = CARDS_Y + 26;
    filtered.slice(0, 11).forEach(rec => {
      const def = MONSTER_DEFS[rec.monsterId as MonsterId];
      if (!def) return;
      const rarityIdx   = RARITIES.indexOf(rec.rarity);
      const rarityColor = RARITY_COLORS[rarityIdx] ?? 0x6644ff;
      const rarityCss   = RARITY_CSS[rarityIdx]    ?? '#9977cc';
      const rowX        = 12;
      const rowW        = CANVAS_WIDTH - 24;
      const rowH        = 42;
      const statusLabel = rec.isNew ? 'NEW' : rec.scCompensation ? `+${rec.scCompensation}💠` : 'DUP';

      // Row bg
      const rbg = scene.add.graphics();
      rbg.fillStyle(0x000000, 0.18);
      rbg.fillRoundedRect(rowX + 1, ry + 2, rowW, rowH, 8);
      rbg.fillStyle(0x1a1005, 0.96);
      rbg.fillRoundedRect(rowX, ry, rowW, rowH, 8);
      rbg.fillStyle(rarityColor, rec.isNew ? 0.17 : 0.08);
      rbg.fillRoundedRect(rowX + 6, ry + 6, 50, rowH - 12, 8);
      rbg.fillStyle(rarityColor, rec.isNew ? 0.08 : 0.035);
      rbg.fillRoundedRect(rowX + 64, ry + 6, rowW - 140, rowH - 12, 8);
      for (let i = 0; i < 6; i++) {
        rbg.lineStyle(0.8, rarityColor, rec.isNew ? 0.10 : 0.045);
        rbg.lineBetween(rowX + 70 + i * 28, ry + rowH - 8, rowX + 108 + i * 28, ry + 8);
      }
      rbg.lineStyle(1, rarityColor, rec.isNew ? 0.82 : 0.42);
      rbg.strokeRoundedRect(rowX, ry, rowW, rowH, 8);
      rbg.lineStyle(1, 0xffffff, 0.10);
      rbg.strokeRoundedRect(rowX + 4, ry + 4, rowW - 8, rowH - 8, 6);
      rbg.fillStyle(0x110a03, 0.94);
      rbg.fillRoundedRect(rowX + 17, ry + 5, 42, 12, 5);
      rbg.lineStyle(1, rarityColor, 0.48);
      rbg.strokeRoundedRect(rowX + 17, ry + 5, 42, 12, 5);
      rbg.fillStyle(rec.isNew ? 0x3b2500 : 0x180e05, 0.94);
      rbg.fillRoundedRect(CANVAS_WIDTH - 78, ry + 10, 56, 22, 7);
      rbg.lineStyle(1, rec.isNew ? 0xffd45c : 0x44ffcc, rec.isNew ? 0.72 : 0.54);
      rbg.strokeRoundedRect(CANVAS_WIDTH - 78, ry + 10, 56, 22, 7);
      c.add(rbg);

      c.add(scene.add.text(38, ry + 11, `도감 ${getDexNo(rec.monsterId as MonsterId)}`, {
        fontFamily: 'sans-serif',
        fontSize:   '7px',
        color:      rarityCss,
        fontStyle:  'bold',
      }).setOrigin(0.5));
      c.add(scene.add.text(37, ry + 27, def.emoji, {
        fontFamily: 'sans-serif', fontSize: '18px',
      }).setOrigin(0.5));

      c.add(scene.add.text(72, ry + 11, def.name, {
        fontFamily: 'sans-serif',
        fontSize:   '11px',
        color:      rec.isNew ? '#ffffff' : '#b6a9c8',
        fontStyle:  rec.isNew ? 'bold' : 'normal',
      }).setOrigin(0, 0.5));
      c.add(scene.add.text(72, ry + 28, getMonsterTagLine(def), {
        fontFamily: 'sans-serif',
        fontSize:   '8px',
        color:      '#9d86be',
      }).setOrigin(0, 0.5));

      c.add(scene.add.text(202, ry + 11, RARITY_STARS[rarityIdx] ?? '', {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      rarityCss,
      }).setOrigin(0.5));
      c.add(scene.add.text(202, ry + 28, RARITY_KO[rarityIdx] ?? '획득', {
        fontFamily: 'sans-serif',
        fontSize:   '8px',
        color:      rarityCss,
        fontStyle:  'bold',
      }).setOrigin(0.5));

      c.add(scene.add.text(CANVAS_WIDTH - 50, ry + 21, statusLabel, {
        fontFamily: 'sans-serif',
        fontSize:   rec.isNew ? '10px' : '9px',
        color:      rec.isNew ? '#ffe8a3' : '#b8fff0',
        fontStyle:  'bold',
      }).setOrigin(0.5));
      ry += 46;
    });
  }

  // ── Lifetime stats ───────────────────────────────────────────────────────────
  const total = gs.summonHistory?.length ?? 0;
  const epics = gs.summonHistory?.filter(r => r.rarity === 'epic').length ?? 0;
  const legs  = gs.summonHistory?.filter(r => r.rarity === 'legendary').length ?? 0;
  c.add(scene.add.text(CX, CANVAS_HEIGHT - 52, `총 소환: ${total}회  |  에픽: ${epics}회  |  전설: ${legs}회`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
}
