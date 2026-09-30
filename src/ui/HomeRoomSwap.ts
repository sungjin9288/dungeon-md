/**
 * 홈 방 자리 바꾸기 — 배치 트레이의 '⇄ 자리'로 시작한다. 바꾸기 모드에서는 방 카드를 누르면 트레이 대신
 * 확인 창이 뜨고(같은 방을 다시 누르면 취소), 골드 또는 보석 특전으로 두 방의 자리를 맞바꾼다.
 * 거래는 data/dungeonPlanTransactions.ts `swapDungeonRooms`. 저장 실패 시 상태를 바꾸지 않는다.
 */
import Phaser from 'phaser';
import type { DungeonHomeScene } from '../scenes/DungeonHomeScene';
import { getHomeRoomTitle } from '../scenes/HomeRoomCards';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { getDungeonPlan } from '../data/dungeonPlan';
import { roomPositionLabel } from '../data/dungeonDigView';
import {
  RELOCATE_GEMS,
  getRelocateGoldCost,
  swapDungeonRooms,
  type RelocatePayment,
} from '../data/dungeonPlanTransactions';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { showToast } from './Toast';
import { logger } from '../utils/logger';

const BANNER_NAME = 'home-swap-banner';
const PANEL_NAME = 'home-swap-panel';
const BANNER_DEPTH = 120;          // where the placement tray sits — it replaces the tray while swapping
const PANEL_DEPTH = 125;
const TAB_BAR_H = 64;
const BANNER_H = 96;
const PANEL_W = 310;
const PANEL_H = 250;

/** 바꾸기 모드 시작: 이 방을 옮길 방으로 고르고, 다른 방을 누르라는 띠를 띄운다. */
export function beginRoomSwap(scene: DungeonHomeScene, sourceIdx: number): void {
  scene.swapSourceIdx = sourceIdx;
  scene.selectedRoomIdx = sourceIdx;
  scene.rebuildDungeonSlots();
  drawBanner(scene, sourceIdx);
}

/** 바꾸기 모드를 끝낸다(띠·확인 창 제거, 보드 다시 그림). */
export function endRoomSwap(scene: DungeonHomeScene): void {
  scene.swapSourceIdx = null;
  scene.selectedRoomIdx = null;
  scene.children.getByName(BANNER_NAME)?.destroy();
  scene.children.getByName(PANEL_NAME)?.destroy();
  scene.rebuildDungeonSlots();
}

/** 바꾸기 모드에서 방 카드를 눌렀을 때. */
export function handleSwapTarget(scene: DungeonHomeScene, targetIdx: number): void {
  const source = scene.swapSourceIdx;
  if (source === null) return;
  if (targetIdx === source) {
    endRoomSwap(scene);
    return;
  }
  openSwapPanel(scene, source, targetIdx);
}

function roomName(scene: DungeonHomeScene, slotIdx: number): string {
  return `방 #${slotIdx + 1} · ${getHomeRoomTitle(scene.gs.dungeonSlots?.[slotIdx]) ?? '빈 터'}`;
}

function drawBanner(scene: DungeonHomeScene, sourceIdx: number): void {
  scene.children.getByName(BANNER_NAME)?.destroy();
  const y = CANVAS_HEIGHT - TAB_BAR_H - BANNER_H - 8;
  const root = scene.add.container(0, 0).setDepth(BANNER_DEPTH).setName(BANNER_NAME);
  const frame = addFramedPanel(scene, {
    x: 8, y, w: CANVAS_WIDTH - 16, h: BANNER_H, radius: 12,
    fillColor: DUNGEON_UI.STONE, borderColor: DUNGEON_UI.BRASS, accentColor: DUNGEON_UI.BRASS, shadowOpacity: 0.5,
  });
  root.add([frame.shadow, frame.panel, frame.glow]);
  // Swallow taps on the banner body so they do not fall through to the command deck underneath.
  root.add(scene.add.zone(CANVAS_WIDTH / 2, y + BANNER_H / 2, CANVAS_WIDTH - 16, BANNER_H).setInteractive());
  root.add(scene.add.text(24, y + 16, `⇄ ${roomName(scene, sourceIdx)}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  root.add(scene.add.text(24, y + 42, '자리를 바꿀 방을 누르세요', {
    fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.BRASS,
  }));
  root.add(scene.add.text(24, y + 64, '방 안의 수호자·함정·레벨은 방과 함께 옮겨 갑니다', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }));
  const cancel = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH - 104, y: y + 26, w: 80, h: 44,
    label: '취소', fontSize: '13px', showArrow: false,
    fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.IRON, textColor: DUNGEON_UI_CSS.MUTED,
    onPress: () => endRoomSwap(scene),
  });
  cancel.zone.setName('home-swap-cancel');
  root.add([cancel.bg, cancel.text, cancel.zone]);
}

function openSwapPanel(scene: DungeonHomeScene, sourceIdx: number, targetIdx: number): void {
  scene.children.getByName(PANEL_NAME)?.destroy();
  const plan = getDungeonPlan(scene.gs);
  const goldCost = getRelocateGoldCost(scene.gs);
  const gold = scene.gs.homeGold ?? 0;
  const gems = scene.gs.gems ?? 0;
  const root = scene.add.container(0, 0).setDepth(PANEL_DEPTH).setName(PANEL_NAME);
  const close = (): void => { root.destroy(); };

  const dim = scene.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.55)
    .setInteractive();
  dim.on('pointerdown', close);
  root.add(dim);

  const x = (CANVAS_WIDTH - PANEL_W) / 2;
  const y = (CANVAS_HEIGHT - PANEL_H) / 2 - 20;
  const frame = addFramedPanel(scene, {
    x, y, w: PANEL_W, h: PANEL_H, radius: 10,
    fillColor: DUNGEON_UI.STONE, borderColor: DUNGEON_UI.BRASS, accentColor: DUNGEON_UI.BRASS, shadowOpacity: 0.6,
  });
  root.add([frame.shadow, frame.panel, frame.glow]);
  root.add(scene.add.zone(x + PANEL_W / 2, y + PANEL_H / 2, PANEL_W, PANEL_H).setInteractive());

  const text = (ty: number, value: string, size: number, color: string, bold = false): Phaser.GameObjects.Text =>
    scene.add.text(x + 20, ty, value, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal',
    });
  root.add(text(y + 18, '방 자리 바꾸기', 17, DUNGEON_UI_CSS.PARCHMENT, true));
  root.add(text(y + 50, roomName(scene, sourceIdx), 12, DUNGEON_UI_CSS.TEXT, true));
  root.add(text(y + 66, `${roomPositionLabel(plan, sourceIdx) ?? ''} → ${roomPositionLabel(plan, targetIdx) ?? ''}`, 10, DUNGEON_UI_CSS.MUTED));
  root.add(text(y + 88, roomName(scene, targetIdx), 12, DUNGEON_UI_CSS.TEXT, true));
  root.add(text(y + 104, `${roomPositionLabel(plan, targetIdx) ?? ''} → ${roomPositionLabel(plan, sourceIdx) ?? ''}`, 10, DUNGEON_UI_CSS.MUTED));

  const pay = (payment: RelocatePayment): void => {
    if (!commit(scene, sourceIdx, targetIdx, payment)) return;
    close();
  };
  const goldBtn = addPrimaryActionButton(scene, {
    x: x + 16, y: y + 132, w: PANEL_W - 32, h: 48,
    label: `골드 ${goldCost.toLocaleString('ko-KR')}로 바꾸기`, fontSize: '15px',
    enabled: gold >= goldCost, once: true,
    onPress: () => pay('gold'),
  });
  goldBtn.zone.setName('home-swap-gold');
  root.add([goldBtn.bg, goldBtn.text, goldBtn.zone]);

  const halfW = (PANEL_W - 40) / 2;
  const gemBtn = addPrimaryActionButton(scene, {
    x: x + 16, y: y + 190, w: halfW, h: 44,
    label: `보석 ${RELOCATE_GEMS}`, fontSize: '13px',
    enabled: gems >= RELOCATE_GEMS, once: true, showArrow: false,
    fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.JADE, textColor: DUNGEON_UI_CSS.JADE,
    onPress: () => pay('gems'),
  });
  gemBtn.zone.setName('home-swap-gems');
  root.add([gemBtn.bg, gemBtn.text, gemBtn.zone]);
  const closeBtn = addPrimaryActionButton(scene, {
    x: x + 24 + halfW, y: y + 190, w: halfW, h: 44,
    label: '닫기', fontSize: '13px', showArrow: false,
    fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.IRON, textColor: DUNGEON_UI_CSS.MUTED,
    onPress: close,
  });
  closeBtn.zone.setName('home-swap-close');
  root.add([closeBtn.bg, closeBtn.text, closeBtn.zone]);
}

/** 거래·저장. 성공하면 바꾸기 모드를 끝내고 옮긴 방을 반짝인다. */
function commit(scene: DungeonHomeScene, sourceIdx: number, targetIdx: number, payment: RelocatePayment): boolean {
  const result = swapDungeonRooms(scene.gs, sourceIdx, targetIdx, payment);
  if (!result.ok) {
    showToast(scene, result.reason === 'insufficient_gems' ? '보석이 부족합니다' : '골드가 부족합니다', { color: DUNGEON_UI_CSS.EMBER });
    return false;
  }
  try {
    scene.persistGameState(result.state);
  } catch (error: unknown) {
    logger.warn('[SWAP] save failed; dungeon unchanged', error);
    showToast(scene, '저장에 실패했습니다 · 다시 시도하세요', { color: DUNGEON_UI_CSS.EMBER });
    return false;
  }
  scene.recentlyChangedRoomIdx = sourceIdx;
  endRoomSwap(scene);
  scene.refreshHomeDynamicPanels();
  showToast(scene, `방 #${sourceIdx + 1}과 방 #${targetIdx + 1}의 자리를 바꿨습니다`, { color: DUNGEON_UI_CSS.JADE });
  return true;
}
