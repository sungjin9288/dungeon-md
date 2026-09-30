/**
 * 홈 보드(가로 던전)의 굴착 자리 타일과 가로 끌기 스크롤. HomeRoomCards.rebuildDungeonSlots가 보드를 그린 뒤 부른다.
 * DungeonHomeScene은 타입으로만 import한다(런타임 순환 방지).
 */
import { onReleaseTap } from '../ui/releaseTap';
import Phaser from 'phaser';
import type { DungeonHomeScene } from './DungeonHomeScene';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { getDigSpotView, showSideDigSpots } from '../data/dungeonDigView';
import { openDigPanel } from '../ui/HomeDigPanel';

/** 굴착 자리 타일: 주 통로 끝은 항상, 곁방 자리는 곁방 허가나 살 수 있는 허가증이 남았을 때만(`showSideDigSpots`). */
export function drawDigSpots(scene: DungeonHomeScene, c: Phaser.GameObjects.Container): void {
  const spots = scene.boardLayout.digSpots ?? [];
  const sides = showSideDigSpots(scene.gs);
  for (const spot of spots) {
    if (spot.kind !== 'corridor' && !sides) continue;
    const view = getDigSpotView(scene.gs, spot.kind);
    const { x, y, w, h } = spot.rect;
    // The corridor end is the main expansion; side spots stay quiet (dashed outline, small +)
    // so a board full of empty dig spots does not outshine the rooms that exist.
    const main = spot.kind === 'corridor';
    const inset = main ? 10 : 22;
    const accent = view.canDig ? CASUAL.GREEN : CASUAL.EDGE_SOFT;
    const g = scene.add.graphics();
    const rx = x + inset, ry = y + inset, rw = w - inset * 2, rh = h - inset * 2;
    if (main) {
      g.fillStyle(0x000000, view.canDig ? 0.34 : 0.22);
      g.fillRoundedRect(rx, ry, rw, rh, 12);
      g.lineStyle(2, accent, view.canDig ? 0.9 : 0.5);
      g.strokeRoundedRect(rx, ry, rw, rh, 12);
    } else {
      strokeDashedRect(g, rx, ry, rw, rh, accent, view.canDig ? 0.55 : 0.3);
    }
    const cx = x + w / 2, cy = y + h / 2 - 8;
    const arm = main ? 10 : 6;
    g.lineStyle(main ? 3 : 2, accent, view.canDig ? (main ? 1 : 0.7) : 0.5);
    g.lineBetween(cx - arm, cy, cx + arm, cy);
    g.lineBetween(cx, cy - arm, cx, cy + arm);
    c.add(g);
    const label = spot.kind === 'corridor'
      ? (view.canDig ? `굴착 ${view.cost.toLocaleString('ko-KR')}` : view.blocker ?? '굴착')
      : (view.canDig ? '곁방' : view.blocker ?? '곁방');
    c.add(scene.add.text(cx, cy + 22, label, {
      fontFamily: 'sans-serif', fontSize: main ? '11px' : '10px', fontStyle: 'bold',
      color: view.canDig && main ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setAlpha(main ? 1 : 0.8));
    const zone = scene.add.zone(x + w / 2, y + h / 2, w - inset * 2, h - inset * 2)
      .setName(`home-dig-${spot.kind}-${spot.anchor}`)
      .setDepth(10).setInteractive({ useHandCursor: true });
    onReleaseTap(zone, () => openDigPanel(scene, spot), () => scene.boardDragMoved || scene.swapSourceIdx !== null);
    c.add(zone);
  }
}

/** Dashed rounded-ish outline (corners left open) for quiet placeholders. */
function strokeDashedRect(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number,
): void {
  const dash = 7, gap = 5;
  g.lineStyle(1.5, color, alpha);
  const edge = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 6; d < len - 6; d += dash + gap) {
      const e = Math.min(len - 6, d + dash);
      g.lineBetween(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}

const BOARD_DRAG_THRESHOLD = 10;

/** 보드가 화면보다 넓으면 보드 영역 안에서만 가로로 끌어 스크롤한다(마스크 + 컨테이너 x). */
export function enableBoardScroll(scene: DungeonHomeScene, c: Phaser.GameObjects.Container, regionBottom: number): void {
  const maxScroll = Math.max(0, Math.ceil(scene.boardLayout.boardRect.w - CANVAS_WIDTH));
  scene.boardScrollX = Phaser.Math.Clamp(scene.boardScrollX, 0, maxScroll);
  c.x = -scene.boardScrollX;
  if (maxScroll === 0) return;

  const top = scene.boardLayout.boardRect.y - 6;
  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff, 1).fillRect(0, top, CANVAS_WIDTH, regionBottom - top + 6);
  c.setMask(maskShape.createGeometryMask());
  c.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());

  // Edge cues: the corridor runs past the screen. Fixed to the screen (not the scrolling
  // container) and hidden at the end they point to.
  const midY = scene.boardLayout.heart.y;
  const cue = (side: 'left' | 'right'): Phaser.GameObjects.Container => {
    const x = side === 'left' ? 0 : CANVAS_WIDTH - 22;
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.42);
    bg.fillRect(x, top + 6, 22, regionBottom - top - 6);
    const arrow = scene.add.text(x + 11, midY, side === 'left' ? '‹' : '›', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#e8c060', fontStyle: 'bold',
    }).setOrigin(0.5);
    return scene.add.container(0, 0, [bg, arrow]).setDepth(12);
  };
  const leftCue = cue('left');
  const rightCue = cue('right');
  const syncCues = (): void => {
    leftCue.setVisible(scene.boardScrollX > 4);
    rightCue.setVisible(scene.boardScrollX < maxScroll - 4);
  };
  syncCues();
  c.once(Phaser.GameObjects.Events.DESTROY, () => { leftCue.destroy(); rightCue.destroy(); });

  let startX: number | null = null;
  let startScroll = 0;
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    scene.boardDragMoved = false;
    startX = pointer.worldY >= top && pointer.worldY <= regionBottom ? pointer.worldX : null;
    startScroll = scene.boardScrollX;
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (startX === null || !pointer.isDown) return;
    const dx = pointer.worldX - startX;
    if (!scene.boardDragMoved && Math.abs(dx) < BOARD_DRAG_THRESHOLD) return;
    scene.boardDragMoved = true;
    scene.boardScrollX = Phaser.Math.Clamp(startScroll - dx, 0, maxScroll);
    if (c.active) c.x = -scene.boardScrollX;
    syncCues();
  };
  const onUp = (): void => { startX = null; };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  // The board is rebuilt often; drop this board's listeners with it.
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
  });
}
