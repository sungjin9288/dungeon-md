/**
 * 보석 특수 방 구매 확인 창 — 배치 트레이 '방 설계'의 잠긴 특수 방 칸을 누르면 뜬다(트레이 위, 깊이 125).
 * 해금 거래는 data/roomBuildings.ts `purchasePremiumBuilding`; 저장·방 설계는 호출 쪽 `onConfirm`이 한다.
 */
import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { ROOM_DEFS, type RoomType } from '../data/rooms';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';

const PANEL_NAME = 'premium-room-confirm';
const PANEL_DEPTH = 125;
const PANEL_W = 310;
const PANEL_H = 236;

export interface PremiumRoomConfirmOptions {
  readonly building: RoomType;
  readonly gems: number;
  readonly ownedGems: number;
  readonly onConfirm: () => void;
}

export function openPremiumRoomConfirm(scene: Phaser.Scene, options: PremiumRoomConfirmOptions): void {
  scene.children.getByName(PANEL_NAME)?.destroy();
  const def = ROOM_DEFS[options.building];
  const affordable = options.ownedGems >= options.gems;
  const root = scene.add.container(0, 0).setDepth(PANEL_DEPTH).setName(PANEL_NAME);
  const close = (): void => { root.destroy(); };

  const dim = scene.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.55)
    .setInteractive();
  dim.on('pointerdown', close);
  root.add(dim);

  const x = (CANVAS_WIDTH - PANEL_W) / 2;
  const y = (CANVAS_HEIGHT - PANEL_H) / 2 - 40;
  const frame = addFramedPanel(scene, {
    x, y, w: PANEL_W, h: PANEL_H, radius: 10,
    fillColor: DUNGEON_UI.STONE, borderColor: DUNGEON_UI.BRASS, accentColor: DUNGEON_UI.BRASS, shadowOpacity: 0.6,
  });
  root.add([frame.shadow, frame.panel, frame.glow]);
  root.add(scene.add.zone(x + PANEL_W / 2, y + PANEL_H / 2, PANEL_W, PANEL_H).setInteractive());

  root.add(scene.add.text(x + 20, y + 18, `${def.emoji} ${def.koreanName}`, {
    fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  root.add(scene.add.text(x + 20, y + 50, def.description, {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: PANEL_W - 40 }, lineSpacing: 3,
  }));
  root.add(scene.add.text(x + 20, y + 102, `영구 해금 · 보유 보석 ${options.ownedGems.toLocaleString('ko-KR')}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: affordable ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.EMBER,
  }));

  const buy = addPrimaryActionButton(scene, {
    x: x + 16, y: y + 124, w: PANEL_W - 32, h: 48,
    label: affordable ? `보석 ${options.gems}로 해금하고 짓기` : `보석 ${options.gems} 필요`, fontSize: '14px',
    enabled: affordable, once: true,
    onPress: () => {
      close();
      options.onConfirm();
    },
  });
  buy.zone.setName('premium-room-buy');
  root.add([buy.bg, buy.text, buy.zone]);

  const closeBtn = addPrimaryActionButton(scene, {
    x: x + 16, y: y + 180, w: PANEL_W - 32, h: 44,
    label: '닫기', fontSize: '13px', showArrow: false,
    fillColor: DUNGEON_UI.SOOT, borderColor: DUNGEON_UI.IRON, textColor: DUNGEON_UI_CSS.MUTED,
    onPress: close,
  });
  closeBtn.zone.setName('premium-room-close');
  root.add([closeBtn.bg, closeBtn.text, closeBtn.zone]);
}
