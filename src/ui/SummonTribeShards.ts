// ─── Tribe shard strip ────────────────────────────────────────────────────────
// One compact row under the summon cards: the tribe closest to a guaranteed
// pull, its 100-shard bar, and the redeem button. Rules live in tribeShards.ts.

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { canRedeemTribeShards, TRIBE_SHARD_REDEEM_COST } from '../data/tribeShards';
import type { GameState } from '../data/wisdom';
import { SUMMON_TRIBE_LABELS } from './SummonShared';

export const SHARD_STRIP_H = 44;
const BUTTON_W = 96;

export interface TribeShardStripOptions {
  readonly gs: GameState;
  readonly y: number;
  readonly onRedeem: (tribe: string) => void;
}

export function buildTribeShardStrip(scene: Phaser.Scene, container: Phaser.GameObjects.Container, opts: TribeShardStripOptions): void {
  const { gs, y } = opts;
  const x = 11, w = CANVAS_WIDTH - 22, h = SHARD_STRIP_H;
  const shards = Object.entries(gs.tribeShards ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const lead = shards[0] ?? null;
  const check = lead ? canRedeemTribeShards(gs, lead[0]) : null;
  const ready = Boolean(check?.ok);

  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 0.92);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, ready ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON, ready ? 0.95 : 0.8);
  g.strokeRoundedRect(x, y, w, h, 8);
  container.add(g);

  if (!lead) {
    container.add(scene.add.text(x + 12, y + h / 2, '부족 조각 · 중복 소환마다 그 부족의 조각이 쌓입니다 · 100개 = 미보유 1체 확정', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, wordWrap: { width: w - 24 },
    }).setOrigin(0, 0.5));
    return;
  }

  const [tribe, count] = lead;
  const label = SUMMON_TRIBE_LABELS[tribe] ?? tribe;
  container.add(scene.add.text(x + 12, y + 12, `부족 조각 · ${label} ${Math.min(count, 999)}/${TRIBE_SHARD_REDEEM_COST}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: ready ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  const barX = x + 12, barY = y + 24, barW = w - BUTTON_W - 40, barH = 8;
  const bar = scene.add.graphics();
  bar.fillStyle(DUNGEON_UI.VOID, 1);
  bar.fillRoundedRect(barX, barY, barW, barH, 4);
  bar.fillStyle(ready ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 0.9);
  bar.fillRoundedRect(barX, barY, Math.max(6, barW * Math.min(1, count / TRIBE_SHARD_REDEEM_COST)), barH, 4);
  container.add(bar);
  const bx = x + w - BUTTON_W - 6, by = y;
  const btn = scene.add.graphics();
  btn.fillStyle(ready ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.VOID, 1);
  btn.fillRoundedRect(bx, by, BUTTON_W, h, 8);
  btn.lineStyle(1.2, ready ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON, ready ? 0.95 : 0.35);
  btn.strokeRoundedRect(bx, by, BUTTON_W, h, 8);
  container.add(btn);
  const buttonLabel = ready ? '교환' : check?.reason === 'tribe_complete' ? '부족 완성' : `${TRIBE_SHARD_REDEEM_COST - count} 더`;
  container.add(scene.add.text(bx + BUTTON_W / 2, by + h / 2, buttonLabel, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: ready ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  if (!ready) return;
  const zone = scene.add.zone(bx, by, BUTTON_W, h).setOrigin(0).setName('summon-shard-redeem').setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => opts.onRedeem(tribe));
  container.add(zone);
}
