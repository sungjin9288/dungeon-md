/**
 * SummonHistory.ts — history tab renderers.
 * All functions take (scene, ctx, ...) — no `this` usage.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS, ZONE_ACCENTS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { RARITIES, RARITY_COLORS, RARITY_CSS, RARITY_STARS, RARITY_KO } from '../data/summonPools';
import { CX, CARDS_Y, getDexNo, getMonsterTagLine } from './SummonShared';
import { buildTribeShardStrip, SHARD_STRIP_H } from './SummonTribeShards';
import { addFramedPanel } from './GameUiPrimitives';

// ─── Context ──────────────────────────────────────────────────────────────────

export type HistoryFilter = 'all' | 'new' | 'dupe';

export interface SummonHistoryContext {
  historyFilter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  /** Redeem 100 tribe shards for an unowned guardian of that tribe (SummonTribeShards). */
  onRedeemShards?: (tribe: string) => void;
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
  const filterY = CARDS_Y + 16;
  type FilterEntry = { label: string; val: HistoryFilter };
  const filters: FilterEntry[] = [
    { label: '전체',   val: 'all'  },
    { label: '새 몬스터', val: 'new'  },
    { label: '중복',   val: 'dupe' },
  ];

  filters.forEach((f, i) => {
    const fx       = 65 + i * 130;
    const isActive = ctx.historyFilter === f.val;
    const fg       = scene.add.graphics();

    if (isActive) {
      fg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
      fg.fillRoundedRect(fx - 56, filterY - 18, 112, 36, 6);
      fg.fillStyle(ZONE_ACCENTS.summon, 1);
      fg.fillRect(fx - 48, filterY + 15, 96, 3);
      fg.lineStyle(1, ZONE_ACCENTS.summon, 0.8);
      fg.strokeRoundedRect(fx - 56, filterY - 18, 112, 36, 6);
    } else {
      fg.fillStyle(DUNGEON_UI.SOOT, 1);
      fg.fillRoundedRect(fx - 56, filterY - 18, 112, 36, 6);
      fg.lineStyle(1, DUNGEON_UI.IRON, 1);
      fg.strokeRoundedRect(fx - 56, filterY - 18, 112, 36, 6);
    }
    c.add(fg);

    const ft = scene.add.text(fx, filterY + 2, f.label, {
      fontFamily:      'sans-serif',
      fontSize:        '10px',
      fontStyle:       'bold',
      color:           isActive ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      stroke:          isActive ? '#00000033' : '#00000000',
      strokeThickness: isActive ? 3 : 0,
    }).setOrigin(0.5);
    c.add(ft);
    const filterZone = scene.add.zone(fx, filterY, 112, 44)
      .setInteractive({ useHandCursor: true });
    filterZone.on('pointerdown', () => ctx.onFilterChange(f.val));
    c.add(filterZone);
  });

  // ── Filtered rows ────────────────────────────────────────────────────────────
  const filtered = history.filter(r => {
    if (ctx.historyFilter === 'new')  return r.isNew;
    if (ctx.historyFilter === 'dupe') return !r.isNew;
    return true;
  });

  if (filtered.length === 0) {
    const emptyFrame = addFramedPanel(scene, {
      x: 28,
      y: CARDS_Y + 68,
      w: CANVAS_WIDTH - 56,
      h: 108,
      radius: 8,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      accentColor: DUNGEON_UI.BRASS,
      accentAlpha: 0.6,
      shadowOpacity: 0.5,
    });
    c.add([emptyFrame.shadow, emptyFrame.panel, emptyFrame.glow]);
    c.add(scene.add.text(CX, CARDS_Y + 105, '아직 맺은 계약이 없습니다', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5));
    c.add(scene.add.text(CX, CARDS_Y + 132, '소환 계약을 완료하면 결과가 이곳에 보관됩니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
  } else {
    let ry = CARDS_Y + 58;
    // Seven rows leave room for the 부족 조각 strip above the lifetime line.
    filtered.slice(0, 7).forEach(rec => {
      const def = MONSTER_DEFS[rec.monsterId as MonsterId];
      if (!def) return;
      const rarityIdx   = RARITIES.indexOf(rec.rarity);
      const rarityColor = RARITY_COLORS[rarityIdx] ?? 0x6644ff;
      const rarityCss   = RARITY_CSS[rarityIdx]    ?? '#9977cc';
      const rowX        = 12;
      const rowW        = CANVAS_WIDTH - 24;
      const rowH        = 48;
      const statusLabel = rec.isNew ? 'NEW' : rec.scCompensation ? `+${rec.scCompensation}💠` : 'DUP';

      // Row bg
      const rbg = scene.add.graphics();
      rbg.fillStyle(DUNGEON_UI.VOID, 0.56);
      rbg.fillRoundedRect(rowX + 1, ry + 2, rowW, rowH, 8);
      rbg.fillStyle(DUNGEON_UI.STONE, 0.98);
      rbg.fillRoundedRect(rowX, ry, rowW, rowH, 8);
      rbg.fillStyle(rarityColor, rec.isNew ? 0.17 : 0.08);
      rbg.fillRoundedRect(rowX + 6, ry + 6, 50, rowH - 12, 8);
      rbg.fillStyle(rarityColor, rec.isNew ? 0.08 : 0.035);
      rbg.fillRoundedRect(rowX + 64, ry + 6, rowW - 140, rowH - 12, 8);
      rbg.lineStyle(1, rarityColor, rec.isNew ? 0.82 : 0.42);
      rbg.strokeRoundedRect(rowX, ry, rowW, rowH, 8);
      rbg.fillStyle(DUNGEON_UI.SOOT, 0.92);
      rbg.fillRoundedRect(CANVAS_WIDTH - 78, ry + 11, 56, 26, 5);
      rbg.lineStyle(1, rec.isNew ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 0.7);
      rbg.strokeRoundedRect(CANVAS_WIDTH - 78, ry + 11, 56, 26, 5);
      c.add(rbg);

      c.add(scene.add.text(38, ry + 12, `#${getDexNo(rec.monsterId as MonsterId)}`, {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      rarityCss,
        fontStyle:  'bold',
      }).setOrigin(0.5));
      c.add(scene.add.text(38, ry + 32, def.emoji, {
        fontFamily: 'sans-serif', fontSize: '18px',
      }).setOrigin(0.5));

      c.add(scene.add.text(72, ry + 14, def.name, {
        fontFamily: 'sans-serif',
        fontSize:   '11px',
        color:      rec.isNew ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
        fontStyle:  rec.isNew ? 'bold' : 'normal',
      }).setOrigin(0, 0.5));
      c.add(scene.add.text(72, ry + 34, getMonsterTagLine(def), {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5));

      c.add(scene.add.text(218, ry + 14, RARITY_STARS[rarityIdx] ?? '', {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      rarityCss,
      }).setOrigin(0.5));
      c.add(scene.add.text(218, ry + 34, RARITY_KO[rarityIdx] ?? '획득', {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      rarityCss,
        fontStyle:  'bold',
      }).setOrigin(0.5));

      c.add(scene.add.text(CANVAS_WIDTH - 50, ry + 24, statusLabel, {
        fontFamily: 'sans-serif',
        fontSize:   '10px',
        color:      rec.isNew ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.JADE,
        fontStyle:  'bold',
      }).setOrigin(0.5));
      ry += 52;
    });
  }

  // ── 부족 조각 (always here; the summon tab only shows it when no banner takes the space) ──
  if (ctx.onRedeemShards) {
    buildTribeShardStrip(scene, c, { gs, y: CANVAS_HEIGHT - 52 - 14 - SHARD_STRIP_H, onRedeem: ctx.onRedeemShards });
  }

  // ── Lifetime stats ───────────────────────────────────────────────────────────
  const total = gs.summonHistory?.length ?? 0;
  const epics = gs.summonHistory?.filter(r => r.rarity === 'epic').length ?? 0;
  const legs  = gs.summonHistory?.filter(r => r.rarity === 'legendary').length ?? 0;
  c.add(scene.add.text(CX, CANVAS_HEIGHT - 52, `총 소환: ${total}회  |  에픽: ${epics}회  |  전설: ${legs}회`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
}
