/**
 * 전장 미니맵 — 가로로 긴 통로는 한 화면에 3칸 남짓만 보인다. 웨이브 버튼 아래 빈자리에 통로 전체(방·입구·심장부),
 * 침입자 점(보스 크게, 모험가 금색, 떠돌이 몬스터 보라), 지금 보이는 범위를 그리고, 누르거나 끌면 그곳으로
 * 카메라를 옮긴다. 고정 카메라(HUD)로 그린다.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { ROOM_DEFS, type RoomType } from '../data/rooms';
import type { BattleTopology } from '../data/battleTopology';
import type { Invader } from '../objects/Invader';
import { markBattleHud } from './battleHudMark';
import { MINIMAP_ROWS, minimapScrollFor, minimapX, minimapY, type MinimapRect } from './battleMinimapGeometry';

const REDRAW_MS = 100;
const VISITOR_DOT: Record<string, number> = { raider: 0xff5a4a, adventurer: 0xf2c14e, wanderer: 0xb48cf0 };

export interface BattleMinimapOptions {
  readonly rect: MinimapRect;
  readonly topology: BattleTopology;
  readonly worldWidth: number;
  readonly gridX: number;
  readonly gridY: number;
  readonly cellSize: number;
  /** 칸(행, 열)의 방 종류 — 방 색. 없으면 빈 칸. */
  readonly roomTypeAt: (row: number, col: number) => RoomType | null;
  readonly onPan: (scrollX: number) => void;
}

export class BattleMinimap {
  private readonly dynamic: Phaser.GameObjects.Graphics;
  private lastDraw = -Infinity;

  constructor(scene: Phaser.Scene, private readonly o: BattleMinimapOptions) {
    const { rect } = o;
    const frame = markBattleHud(scene.add.graphics().setDepth(58));
    frame.fillStyle(DUNGEON_UI.SOOT, 0.92);
    frame.fillRoundedRect(rect.x - 6, rect.y - 18, rect.w + 12, rect.h + 42, 8);
    frame.lineStyle(1.2, DUNGEON_UI.IRON, 0.9);
    frame.strokeRoundedRect(rect.x - 6, rect.y - 18, rect.w + 12, rect.h + 42, 8);
    // Legend: what the dots mean (also teaches the visitor kinds).
    const legendY = rect.y + rect.h + 12;
    const legend: ReadonlyArray<readonly [string, number, number]> = [
      ['토벌대', VISITOR_DOT.raider, 2.5], ['모험가', VISITOR_DOT.adventurer, 2.5],
      ['떠돌이 몬스터', VISITOR_DOT.wanderer, 2.5], ['보스', VISITOR_DOT.raider, 4],
    ];
    let lx = rect.x + 4;
    for (const [label, color, radius] of legend) {
      frame.fillStyle(color, 1);
      frame.fillCircle(lx, legendY, radius);
      const text = markBattleHud(scene.add.text(lx + 7, legendY, label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5).setDepth(59));
      lx += 14 + text.width + 12;
    }
    // Rooms.
    const rowH = rect.h / MINIMAP_ROWS;
    for (const cell of o.topology.cells) {
      const type = o.roomTypeAt(cell.row, cell.col);
      const left = minimapX(o.gridX + cell.col * o.cellSize, o.worldWidth, rect);
      const right = minimapX(o.gridX + (cell.col + 1) * o.cellSize, o.worldWidth, rect);
      frame.fillStyle(type ? ROOM_DEFS[type].accentColor : DUNGEON_UI.STONE_RAISED, type ? 0.85 : 0.4);
      frame.lineStyle(1, 0xffffff, type ? 0.18 : 0);
      frame.fillRoundedRect(left + 1, rect.y + cell.row * rowH + 2, Math.max(2, right - left - 2), rowH - 4, 2);
      if (type) frame.strokeRoundedRect(left + 1, rect.y + cell.row * rowH + 2, Math.max(2, right - left - 2), rowH - 4, 2);
    }
    // Entrance (left) and heart (right) marks on the corridor row.
    const corridorY = rect.y + rowH * 1.5;
    frame.fillStyle(0xff6b1a, 0.95);
    frame.fillTriangle(rect.x - 4, corridorY - 4, rect.x - 4, corridorY + 4, rect.x + 2, corridorY);
    frame.fillStyle(0xffd24a, 0.95);
    frame.fillCircle(rect.x + rect.w - 2, corridorY, 3.5);
    markBattleHud(scene.add.text(rect.x, rect.y - 10, '전장 전체 · 눌러서 이동', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5).setDepth(59));

    this.dynamic = markBattleHud(scene.add.graphics().setDepth(59));

    const zone = markBattleHud(scene.add.zone(rect.x - 6, rect.y - 18, rect.w + 12, Math.max(44, rect.h + 24))
      .setOrigin(0).setInteractive().setDepth(60));
    const pan = (pointer: Phaser.Input.Pointer): void => {
      const mapX = pointer.x / (scene.cameras.main.zoom || 1);
      o.onPan(minimapScrollFor(mapX, rect, o.worldWidth, CANVAS_WIDTH));
    };
    zone.on('pointerdown', pan);
    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => { if (pointer.isDown) pan(pointer); });
  }

  /** 침입자 점과 보이는 범위. 매 프레임 불러도 100ms마다만 다시 그린다. */
  update(invaders: readonly Invader[], view: { readonly left: number; readonly width: number }, now: number): void {
    if (now - this.lastDraw < REDRAW_MS) return;
    this.lastDraw = now;
    const { rect, worldWidth, gridY, cellSize } = this.o;
    const g = this.dynamic.clear();
    const left = minimapX(view.left, worldWidth, rect);
    const right = minimapX(view.left + view.width, worldWidth, rect);
    g.lineStyle(1.5, DUNGEON_UI.BRASS_BRIGHT, 0.9);
    g.strokeRoundedRect(left, rect.y - 2, Math.max(4, right - left), rect.h + 4, 3);
    for (const inv of invaders) {
      if (!inv.active || inv.isDead) continue;
      g.fillStyle(VISITOR_DOT[inv.visitor] ?? VISITOR_DOT.raider, 1);
      g.fillCircle(minimapX(inv.x, worldWidth, rect), minimapY(inv.y, gridY, cellSize, rect), inv.def.isBoss ? 4 : 2.5);
    }
  }
}
