import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS, ZONE_ACCENTS, ZONE_ACCENT_DARK } from '../constants/colors';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ROOT_NAV_HEIGHT,
  ROOT_NAV_Y,
  SCENE_HEADER_TOUCH_HEIGHT,
} from '../constants/layout';
import {
  GAME_ZONE_DEFINITIONS,
  GAME_ZONES,
  type GameZone,
} from '../data/navigationContract';
import { audioManager } from '../audio/AudioManager';

const ZONE_ICON: Readonly<Record<GameZone, string>> = {
  dungeon: '🏰',
  legion: '👹',
  forge: '⚒',
  invasion: '⚔️',
};

export interface GameZoneHitArea {
  readonly zone: GameZone;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FixedShellCameraMetrics {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** Convert Phaser's physical-canvas pointer coordinate to logical viewport px. */
export function getLogicalViewportPointerY(pointerY: number, cameraZoom: number): number {
  return pointerY / (cameraZoom > 0 ? cameraZoom : 1);
}

/** Correct the centered-camera offset for scrollFactor-0 shell coordinates. */
export function getFixedShellViewportOffset(
  camera: FixedShellCameraMetrics,
): { readonly x: number; readonly y: number } {
  const zoom = camera.zoom > 0 ? camera.zoom : 1;
  return {
    x: (camera.width / zoom) * (zoom - 1) / 2,
    y: (camera.height / zoom) * (zoom - 1) / 2,
  };
}

/** Read the configured DPR even when CREATE runs before the camera hook. */
export function getSceneFixedShellViewportOffset(
  scene: Phaser.Scene,
): { readonly x: number; readonly y: number } {
  const camera = scene.cameras.main;
  const configuredDpr = Math.max(
    camera.width / CANVAS_WIDTH,
    camera.height / CANVAS_HEIGHT,
  );
  return getFixedShellViewportOffset({
    width: camera.width,
    height: camera.height,
    zoom: Math.max(camera.zoom, configuredDpr),
  });
}

/** Exported geometry keeps four-zone targets auditable at the 390×844 canvas. */
export function getHomeZoneHitAreas(
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
): readonly GameZoneHitArea[] {
  const tabWidth = width / GAME_ZONES.length;
  return GAME_ZONES.map((zone, index) => ({
    zone,
    x: index * tabWidth,
    y: height - ROOT_NAV_HEIGHT,
    width: tabWidth,
    height: ROOT_NAV_HEIGHT,
  }));
}

export function buildHomeZoneNavigation(
  scene: Phaser.Scene,
  activeZone: GameZone,
  onNavigate: (zone: GameZone) => void,
): void {
  const offset = getSceneFixedShellViewportOffset(scene);
  const shell = scene.add.container(offset.x, offset.y)
    .setDepth(80)
    .setScrollFactor(0);
  const navY = ROOT_NAV_Y;
  const graphics = scene.add.graphics().setScrollFactor(0);
  shell.add(graphics);
  graphics.fillStyle(CASUAL.SHADOW, 1);
  graphics.fillRect(0, navY - 4, CANVAS_WIDTH, ROOT_NAV_HEIGHT + 4);
  graphics.fillStyle(CASUAL.PANEL, 1);
  graphics.fillRect(0, navY, CANVAS_WIDTH, ROOT_NAV_HEIGHT);
  graphics.fillStyle(0xffffff, 0.14);
  graphics.fillRect(0, navY, CANVAS_WIDTH, 3);
  graphics.lineStyle(3, CASUAL.EDGE, 1);
  graphics.lineBetween(0, navY, CANVAS_WIDTH, navY);

  getHomeZoneHitAreas().forEach(({ zone, x, y, width, height }) => {
    const definition = GAME_ZONE_DEFINITIONS[zone];
    const accent = ZONE_ACCENTS[zone];
    const darkAccent = ZONE_ACCENT_DARK[zone];
    const active = zone === activeZone;
    const panelX = x + 4;
    const panelY = y + (active ? 2 : 7);
    const panelW = width - 8;
    const panelH = active ? height - 7 : height - 13;

    if (active) {
      graphics.fillStyle(darkAccent, 1);
      graphics.fillRoundedRect(panelX, panelY + 3, panelW, panelH, 11);
      graphics.fillStyle(accent, 1);
      graphics.fillRoundedRect(panelX, panelY, panelW, panelH - 1, 11);
      graphics.fillStyle(0xffffff, 0.32);
      graphics.fillRoundedRect(panelX + 5, panelY + 4, panelW - 10, 7, 4);
      // Shape + vertical lift + literal status make the selected Dungeon clear without color alone.
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillTriangle(x + width / 2 - 5, y + 1, x + width / 2 + 5, y + 1, x + width / 2, y - 5);
    } else {
      graphics.fillStyle(CASUAL.PANEL_SOFT, 1);
      graphics.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
      graphics.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
      graphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);
    }

    const icon = scene.add.text(x + width / 2, active ? y + 9 : y + 14, ZONE_ICON[zone], {
      fontFamily: 'sans-serif', fontSize: active ? '20px' : '18px',
    }).setOrigin(0.5, 0).setDepth(81).setScrollFactor(0);
    shell.add(icon);
    const label = scene.add.text(x + width / 2, active ? y + 38 : y + 43, definition.label, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: active ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      stroke: active ? `#${darkAccent.toString(16).padStart(6, '0')}` : undefined,
      strokeThickness: active ? 3 : 0,
    }).setOrigin(0.5).setDepth(81).setScrollFactor(0);
    shell.add(label);
    if (active) {
      const status = scene.add.text(x + width / 2, y + 55, '현재', {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setDepth(81).setScrollFactor(0);
      shell.add(status);
      return;
    }

    const hover = scene.add.graphics().setDepth(80.5).setVisible(false).setScrollFactor(0);
    shell.add(hover);
    hover.fillStyle(accent, 0.22);
    hover.fillRoundedRect(panelX, panelY, panelW, panelH, 11);
    hover.lineStyle(2, accent, 0.9);
    hover.strokeRoundedRect(panelX, panelY, panelW, panelH, 11);
    const target = scene.add.zone(x, y, width, height)
      .setOrigin(0)
      .setDepth(82)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    shell.add(target);
    target.on('pointerover', () => hover.setVisible(true));
    target.on('pointerout', () => hover.setVisible(false));
    target.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      onNavigate(zone);
    });
  });
}

export function buildZoneBackButton(
  scene: Phaser.Scene,
  options: { readonly label: string; readonly onBack: () => void; readonly width?: number },
): void {
  const offset = getSceneFixedShellViewportOffset(scene);
  const shell = scene.add.container(offset.x, offset.y)
    .setDepth(30)
    .setScrollFactor(0);
  const x = 10;
  const y = 8;
  const width = options.width ?? 86;
  const height = SCENE_HEADER_TOUCH_HEIGHT;
  const depth = 30;
  const graphics = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  shell.add(graphics);
  graphics.fillStyle(CASUAL.SHADOW, 0.22);
  graphics.fillRoundedRect(x, y + 3, width, height, 14);
  graphics.fillStyle(CASUAL.PANEL, 1);
  graphics.fillRoundedRect(x, y, width, height, 14);
  graphics.fillStyle(0xffffff, 0.12);
  graphics.fillRoundedRect(x + 5, y + 4, width - 10, 7, 4);
  graphics.lineStyle(2.5, CASUAL.EDGE, 1);
  graphics.strokeRoundedRect(x, y, width, height, 14);
  const label = scene.add.text(x + width / 2, y + height / 2, options.label, {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
  shell.add(label);
  const zone = scene.add.zone(x, y, width, height)
    .setOrigin(0)
    .setDepth(depth + 2)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });
  shell.add(zone);
  zone.on('pointerdown', options.onBack);
}
