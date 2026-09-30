/**
 * 홈 굴착 확인 창 — 굴착 자리(주 통로 끝 / 곁방 위·아래)를 누르면 뜬다.
 * 판정은 data/dungeonDigView.ts, 거래는 data/dungeonPlanTransactions.ts. 저장 실패 시 상태를 바꾸지 않는다.
 */
import Phaser from 'phaser';
import type { DungeonHomeScene } from '../scenes/DungeonHomeScene';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { getDigSpotView } from '../data/dungeonDigView';
import {
  buyDungeonLicense,
  digCorridorRoom,
  digSideRoom,
  type DungeonExpandResult,
} from '../data/dungeonPlanTransactions';
import type { DigSpot } from './DungeonBoardLayout';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { showToast } from './Toast';
import { logger } from '../utils/logger';

const PANEL_NAME = 'home-dig-panel';
const PANEL_DEPTH = 125;
const PANEL_W = 310;
const PANEL_H = 262;

export function openDigPanel(scene: DungeonHomeScene, spot: DigSpot): void {
  scene.children.getByName(PANEL_NAME)?.destroy();
  const view = getDigSpotView(scene.gs, spot.kind);
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
  // Swallow taps on the panel body so they do not reach the dim layer.
  root.add(scene.add.zone(x + PANEL_W / 2, y + PANEL_H / 2, PANEL_W, PANEL_H).setInteractive());

  const text = (tx: number, ty: number, value: string, size: number, color: string, bold = false): Phaser.GameObjects.Text =>
    scene.add.text(tx, ty, value, { fontFamily: 'sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });

  root.add(text(x + 20, y + 18, view.title, 17, DUNGEON_UI_CSS.PARCHMENT, true));
  root.add(text(x + 20, y + 48, view.usageLine, 11, DUNGEON_UI_CSS.MUTED));
  root.add(text(x + 20, y + 74, `굴착비 ${view.cost.toLocaleString('ko-KR')} 황금`, 14,
    view.canAfford ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER, true));
  root.add(text(x + 20, y + 96, `보유 ${(scene.gs.homeGold ?? 0).toLocaleString('ko-KR')} 황금`, 11, DUNGEON_UI_CSS.MUTED));
  if (view.blocker) root.add(text(x + 20, y + 118, view.blocker, 12, DUNGEON_UI_CSS.EMBER, true));

  const dig = addPrimaryActionButton(scene, {
    x: x + 16, y: y + 142, w: PANEL_W - 32, h: 48,
    label: view.canDig ? '굴착하기' : (view.blocker ?? '굴착 불가'), fontSize: '15px',
    enabled: view.canDig, once: true,
    onPress: () => {
      const result = spot.kind === 'corridor'
        ? digCorridorRoom(scene.gs)
        : digSideRoom(scene.gs, spot.anchor, spot.kind);
      if (!commit(scene, result)) return;
      close();
      showToast(scene, '새 방 자리를 팠습니다 · 방을 설계하세요', { color: DUNGEON_UI_CSS.JADE });
      scene.refreshHomeDynamicPanels();
      if (result.ok && result.slot !== undefined) scene.selectRoomForPlacement(result.slot);
    },
  });
  dig.zone.setName('home-dig-confirm');
  root.add([dig.bg, dig.text, dig.zone]);

  const offer = view.licenseOffer;
  const bottomY = y + 200;
  if (offer) {
    const buy = addPrimaryActionButton(scene, {
      x: x + 16, y: bottomY, w: (PANEL_W - 40) / 2, h: 44,
      label: `허가증 · 보석 ${offer.gems}`, fontSize: '12px',
      enabled: (scene.gs.gems ?? 0) >= offer.gems, once: true, showArrow: false,
      fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.JADE, textColor: DUNGEON_UI_CSS.JADE,
      onPress: () => {
        if (!commit(scene, buyDungeonLicense(scene.gs, offer.kind))) return;
        showToast(scene, `${offer.kind === 'corridor' ? '주 통로' : '곁방'} 허가증을 얻었습니다`, { color: DUNGEON_UI_CSS.JADE });
        openDigPanel(scene, spot);   // reopen with the new permit
      },
    });
    buy.zone.setName('home-dig-license');
    root.add([buy.bg, buy.text, buy.zone]);
  }
  const closeBtn = addPrimaryActionButton(scene, {
    x: offer ? x + 24 + (PANEL_W - 40) / 2 : x + 16, y: bottomY, w: offer ? (PANEL_W - 40) / 2 : PANEL_W - 32, h: 44,
    label: '닫기', fontSize: '13px', showArrow: false,
    fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.IRON, textColor: DUNGEON_UI_CSS.MUTED,
    onPress: close,
  });
  closeBtn.zone.setName('home-dig-close');
  root.add([closeBtn.bg, closeBtn.text, closeBtn.zone]);
}

/** 성공한 거래를 저장한다. 실패(거절·저장 오류)면 안내하고 false. */
function commit(scene: DungeonHomeScene, result: DungeonExpandResult): boolean {
  if (!result.ok) {
    showToast(scene, '지금은 할 수 없습니다', { color: DUNGEON_UI_CSS.EMBER });
    return false;
  }
  try {
    scene.persistGameState(result.state);
    return true;
  } catch (error: unknown) {
    logger.warn('[DIG] save failed; dungeon unchanged', error);
    showToast(scene, '저장에 실패했습니다 · 다시 시도하세요', { color: DUNGEON_UI_CSS.EMBER });
    return false;
  }
}
