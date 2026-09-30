/**
 * 침공 지도 헤더의 '원정' — 관문 밖 활동(심연·무한 던전·선조의 지혜·업적·생산·장식)을 한 번에 여는 메뉴.
 * 이 입구들은 지도 맨 아래(관문 90개 뒤)에만 있어서 지금 관문 근처에서 열린 지도로는 보이지 않았다.
 * 목록·현황은 data/expeditionRoutes.ts, 씬 이동은 호출 쪽 `onSelect`(StageSelectScene.openExpeditionRoute).
 */
import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import type { ExpeditionRoute, ExpeditionRouteKey } from '../data/expeditionRoutes';
import { getSceneFixedShellViewportOffset } from './GameZoneNavigation';
import { addSigil, type SigilKind } from './Sigils';

const MENU_NAME = 'expedition-menu';
const BUTTON_DEPTH = 26;
const MENU_DEPTH = 120;
const BUTTON = { x: CANVAS_WIDTH - 82, y: 8, w: 72, h: 44 } as const;
const PANEL_W = 236;
const ROW_H = 50;
const PANEL_TOP = 130;

const ROUTE_STYLE: Record<ExpeditionRouteKey, { sigil: SigilKind; accent: number }> = {
  abyss:       { sigil: 'orb',      accent: CASUAL.PURPLE },
  endless:     { sigil: 'infinity', accent: CASUAL.RED },
  wisdom:      { sigil: 'pagoda',   accent: CASUAL.PURPLE },
  achievement: { sigil: 'star',     accent: CASUAL.GREEN },
  production:  { sigil: 'hammer',   accent: CASUAL.GOLD },
  decoration:  { sigil: 'banner',   accent: CASUAL.GREEN },
};

export function isExpeditionMenuOpen(scene: Phaser.Scene): boolean {
  return scene.children.getByName(MENU_NAME) !== null;
}

/** 헤더 오른쪽 '원정' 버튼. 누를 때마다 목록을 새로 읽는다(심연 열쇠·결정 수가 바뀌므로). */
export function buildExpeditionButton(
  scene: Phaser.Scene,
  getRoutes: () => readonly ExpeditionRoute[],
  onSelect: (route: ExpeditionRoute) => void,
): void {
  const offset = getSceneFixedShellViewportOffset(scene);
  const shell = scene.add.container(offset.x, offset.y).setDepth(BUTTON_DEPTH).setScrollFactor(0);
  const { x, y, w, h } = BUTTON;
  const bg = scene.add.graphics();
  const draw = (active: boolean): void => {
    bg.clear();
    bg.fillStyle(DUNGEON_UI.VOID, 0.5);
    bg.fillRoundedRect(x, y + 3, w, h, 9);
    bg.fillStyle(active ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    bg.fillRoundedRect(x, y, w, h, 9);
    bg.lineStyle(1.5, active ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, 1);
    bg.strokeRoundedRect(x, y, w, h, 9);
  };
  draw(false);
  shell.add(bg);
  shell.add(addSigil(scene, 'orb', x + 17, y + h / 2, 15, CASUAL.PURPLE));
  const label = scene.add.text(x + 46, y + h / 2, '원정', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0.5);
  shell.add(label);
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setScrollFactor(0)
    .setInteractive({ useHandCursor: true }).setName('expedition-menu-button');
  shell.add(zone);
  zone.on('pointerover', () => { draw(true); label.setColor(DUNGEON_UI_CSS.BRASS); });
  zone.on('pointerout', () => { draw(false); label.setColor(DUNGEON_UI_CSS.TEXT); });
  zone.on('pointerdown', () => {
    const open = scene.children.getByName(MENU_NAME);
    if (open) { open.destroy(); return; }
    openMenu(scene, getRoutes(), onSelect);
  });
}

function openMenu(
  scene: Phaser.Scene,
  routes: readonly ExpeditionRoute[],
  onSelect: (route: ExpeditionRoute) => void,
): void {
  const offset = getSceneFixedShellViewportOffset(scene);
  const overlay = scene.add.container(offset.x, offset.y).setDepth(MENU_DEPTH).setScrollFactor(0).setName(MENU_NAME);
  const close = (): void => { overlay.destroy(); };

  const dismiss = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0).setScrollFactor(0).setInteractive();
  dismiss.on('pointerdown', close);
  overlay.add(dismiss);

  const panelX = CANVAS_WIDTH - PANEL_W - 10;
  const panelH = 44 + routes.length * ROW_H + 8;
  const panel = scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.VOID, 0.78);
  panel.fillRoundedRect(panelX + 3, PANEL_TOP + 4, PANEL_W, panelH, 12);
  panel.fillStyle(DUNGEON_UI.STONE, 1);
  panel.fillRoundedRect(panelX, PANEL_TOP, PANEL_W, panelH, 12);
  panel.lineStyle(1.5, DUNGEON_UI.BRASS, 0.82);
  panel.strokeRoundedRect(panelX, PANEL_TOP, PANEL_W, panelH, 12);
  overlay.add(panel);
  // Swallow taps on the panel body so only rows (and the dim area) act.
  overlay.add(scene.add.zone(panelX, PANEL_TOP, PANEL_W, panelH).setOrigin(0).setScrollFactor(0).setInteractive());
  overlay.add(scene.add.text(panelX + 14, PANEL_TOP + 21, '원정', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  overlay.add(scene.add.text(panelX + PANEL_W - 14, PANEL_TOP + 21, '관문 밖 활동', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));

  routes.forEach((route, index) => {
    const rowY = PANEL_TOP + 40 + index * ROW_H;
    addRow(scene, overlay, route, panelX + 8, rowY, PANEL_W - 16, () => {
      close();
      onSelect(route);
    });
  });
}

function addRow(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  route: ExpeditionRoute,
  x: number, y: number, w: number,
  onPress: () => void,
): void {
  const style = ROUTE_STYLE[route.key];
  const h = ROW_H - 4;
  const bg = scene.add.graphics();
  bg.fillStyle(route.locked ? DUNGEON_UI.VOID : DUNGEON_UI.SOOT, 1);
  bg.fillRoundedRect(x, y, w, h, 7);
  bg.fillStyle(style.accent, route.locked ? 0.25 : 0.8);
  bg.fillRect(x, y + 6, 3, h - 12);
  bg.lineStyle(1, DUNGEON_UI.IRON, 0.72);
  bg.strokeRoundedRect(x, y, w, h, 7);
  overlay.add(bg);
  overlay.add(addSigil(scene, style.sigil, x + 22, y + h / 2, 16, route.locked ? DUNGEON_UI.EDGE : style.accent));
  overlay.add(scene.add.text(x + 42, y + 15, route.label, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: route.locked ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  overlay.add(scene.add.text(x + 42, y + 32, route.detail, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  if (route.locked) {
    overlay.add(scene.add.text(x + w - 14, y + h / 2, '봉인', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5));
    return;
  }
  overlay.add(scene.add.text(x + w - 16, y + h / 2, '›', {
    fontFamily: 'sans-serif', fontSize: '20px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setScrollFactor(0)
    .setInteractive({ useHandCursor: true }).setName(`expedition-route-${route.key}`);
  zone.on('pointerdown', onPress);
  overlay.add(zone);
}
