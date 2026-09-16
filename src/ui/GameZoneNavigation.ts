import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS, ZONE_ACCENTS } from '../constants/colors';
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
  graphics.fillStyle(0x020302, 1);
  graphics.fillRect(0, navY - 4, CANVAS_WIDTH, ROOT_NAV_HEIGHT + 4);
  graphics.fillStyle(0x0a0c0b, 1);
  graphics.fillRect(0, navY, CANVAS_WIDTH, ROOT_NAV_HEIGHT);
  graphics.fillStyle(0xa98245, 0.38);
  graphics.fillRect(0, navY, CANVAS_WIDTH, 2);
  graphics.lineStyle(1, 0x5f4d32, 0.82);
  graphics.lineBetween(0, navY, CANVAS_WIDTH, navY);

  getHomeZoneHitAreas().forEach(({ zone, x, y, width, height }) => {
    const definition = GAME_ZONE_DEFINITIONS[zone];
    const accent = ZONE_ACCENTS[zone];
    const active = zone === activeZone;
    const panelX = x + 3;
    const panelY = y + 3;
    const panelW = width - 6;
    const panelH = height - 6;

    if (active) {
      graphics.fillStyle(0x171713, 1);
      graphics.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
      graphics.fillStyle(accent, 0.86);
      graphics.fillRect(panelX + 7, panelY, panelW - 14, 3);
      graphics.lineStyle(1.5, 0xa98245, 0.82);
      graphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
      graphics.fillStyle(accent, 0.94);
      graphics.fillTriangle(x + width / 2 - 5, y + 4, x + width / 2 + 5, y + 4, x + width / 2, y - 2);
    } else {
      graphics.fillStyle(0x0d0f0e, 1);
      graphics.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
      graphics.lineStyle(1, 0x34342d, 0.88);
      graphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
    }
    if (x > 0) {
      graphics.lineStyle(1, 0x6b5738, 0.28);
      graphics.lineBetween(x, y + 12, x, y + height - 12);
    }

    drawZoneSigil(graphics, zone, x + width / 2, y + 23, active ? accent : 0x8c806d, active ? 0.96 : 0.74);
    const label = scene.add.text(x + width / 2, y + 48, definition.label, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: active ? '#ead6ad' : '#918776',
    }).setOrigin(0.5).setDepth(81).setScrollFactor(0);
    shell.add(label);
    if (active) {
      return;
    }

    const hover = scene.add.graphics().setDepth(80.5).setVisible(false).setScrollFactor(0);
    shell.add(hover);
    hover.fillStyle(accent, 0.09);
    hover.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
    hover.lineStyle(1.5, accent, 0.72);
    hover.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);
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

function drawZoneSigil(
  g: Phaser.GameObjects.Graphics,
  zone: GameZone,
  x: number,
  y: number,
  color: number,
  alpha: number,
): void {
  g.lineStyle(2, color, alpha);
  g.fillStyle(color, alpha);
  if (zone === 'dungeon') {
    g.beginPath();
    g.arc(x, y + 3, 10, Math.PI, Math.PI * 2);
    g.strokePath();
    g.lineBetween(x - 10, y + 3, x - 10, y + 11);
    g.lineBetween(x + 10, y + 3, x + 10, y + 11);
    g.lineBetween(x - 10, y + 11, x + 10, y + 11);
    g.fillRect(x - 2, y + 3, 4, 8);
    return;
  }
  if (zone === 'legion') {
    g.beginPath();
    g.arc(x - 7, y - 2, 7, 0.2, 1.65);
    g.strokePath();
    g.beginPath();
    g.arc(x + 7, y - 2, 7, 1.49, 2.94);
    g.strokePath();
    g.fillTriangle(x - 8, y + 2, x + 8, y + 2, x, y + 12);
    g.fillStyle(0x070806, 1);
    g.fillCircle(x - 3, y + 5, 1.3);
    g.fillCircle(x + 3, y + 5, 1.3);
    return;
  }
  if (zone === 'forge') {
    g.fillRect(x - 11, y + 5, 22, 5);
    g.fillTriangle(x - 7, y + 10, x + 7, y + 10, x, y + 14);
    g.lineStyle(3, color, alpha);
    g.lineBetween(x - 8, y - 8, x + 8, y + 6);
    g.fillRoundedRect(x - 13, y - 11, 8, 5, 1);
    return;
  }
  g.lineStyle(2.5, color, alpha);
  g.lineBetween(x - 9, y - 8, x + 9, y + 11);
  g.lineBetween(x + 9, y - 8, x - 9, y + 11);
  g.fillTriangle(x - 12, y - 11, x - 5, y - 8, x - 9, y - 4);
  g.fillTriangle(x + 12, y - 11, x + 5, y - 8, x + 9, y - 4);
}

export function buildZoneBackButton(
  scene: Phaser.Scene,
  options: {
    readonly label: string;
    readonly onBack: () => void;
    readonly width?: number;
    readonly fillColor?: number;
    readonly borderColor?: number;
    readonly textColor?: string;
  },
): void {
  const offset = getSceneFixedShellViewportOffset(scene);
  const shell = scene.add.container(offset.x, offset.y)
    .setDepth(30)
    .setScrollFactor(0);
  const x = 10;
  const y = 8;
  const width = options.width ?? 86;
  const height = SCENE_HEADER_TOUCH_HEIGHT;
  const fillColor = options.fillColor ?? CASUAL.PANEL;
  const borderColor = options.borderColor ?? CASUAL.EDGE;
  const textColor = options.textColor ?? CASUAL_CSS.INK;
  const depth = 30;
  const graphics = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  shell.add(graphics);
  graphics.fillStyle(CASUAL.SHADOW, 0.22);
  graphics.fillRoundedRect(x, y + 3, width, height, 14);
  graphics.fillStyle(fillColor, 1);
  graphics.fillRoundedRect(x, y, width, height, 14);
  graphics.fillStyle(0xffffff, 0.12);
  graphics.fillRoundedRect(x + 5, y + 4, width - 10, 7, 4);
  graphics.lineStyle(2.5, borderColor, 1);
  graphics.strokeRoundedRect(x, y, width, height, 14);
  const label = scene.add.text(x + width / 2, y + height / 2, options.label, {
    fontFamily: 'sans-serif', fontSize: '12px', color: textColor, fontStyle: 'bold',
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
