import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';

export const SHOP_LAYOUT = {
  contentTop: 150,
  pagerTop: 728,
  side: 8,
} as const;

export interface ShopPurchaseOutcome {
  readonly ok: boolean;
  readonly title: string;
  readonly detail: string;
}

export interface ShopPurchaseRequest {
  readonly itemName: string;
  readonly description: string;
  readonly costLabel: string;
  readonly confirmLabel?: string;
  readonly execute: () => ShopPurchaseOutcome;
}

export interface ShopImmediateRequest {
  readonly execute: () => ShopPurchaseOutcome;
}

export interface ShopViewContext {
  readonly scene: Phaser.Scene;
  readonly contentCtr: Phaser.GameObjects.Container;
  readonly isBusy: () => boolean;
  readonly requestPurchase: (request: ShopPurchaseRequest, reuseLatch?: boolean) => void;
  readonly runImmediate: (request: ShopImmediateRequest, reuseLatch?: boolean) => void;
}

export interface PageSlice<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  readonly end: number;
}

export function paginate<T>(items: readonly T[], requestedPage: number, pageSize: number): PageSlice<T> {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safeSize));
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), pageCount - 1);
  const start = page * safeSize;
  const end = Math.min(items.length, start + safeSize);
  return { items: items.slice(start, end), page, pageCount, start, end };
}

export function secondsUntilUtcReset(nowMs: number = Date.now()): number {
  const dayMs = 86_400_000;
  const elapsed = ((nowMs % dayMs) + dayMs) % dayMs;
  return Math.ceil((dayMs - elapsed) / 1000);
}

export function formatUtcReset(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function acceptUtcDayIndex(currentDay: number, observedDay: number, isBusy: boolean): number {
  return isBusy ? currentDay : observedDay;
}

export interface ShopPanelOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly accent?: number;
  readonly fill?: number;
  readonly radius?: number;
}

export function addShopPanel(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: ShopPanelOptions,
): Phaser.GameObjects.Graphics {
  const { x, y, w, h, accent = DUNGEON_UI.EDGE, fill = DUNGEON_UI.STONE, radius = 8 } = options;
  const panel = scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.VOID, 0.58);
  panel.fillRoundedRect(x + 2, y + 4, w, h, radius);
  panel.fillStyle(fill, 0.98);
  panel.fillRoundedRect(x, y, w, h, radius);
  panel.lineStyle(1.5, accent, 0.82);
  panel.strokeRoundedRect(x, y, w, h, radius);
  panel.fillStyle(accent, 0.9);
  panel.fillRect(x + 1, y + 9, 3, Math.max(12, h - 18));
  panel.lineStyle(1, 0xffffff, 0.07);
  panel.lineBetween(x + 8, y + 5, x + w - 8, y + 5);
  container.add(panel);
  return panel;
}

export interface ShopButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h?: number;
  readonly label: string;
  readonly enabled?: boolean;
  readonly accent?: number;
  readonly textColor?: string;
  readonly onPress: () => void;
}

export function addShopButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: ShopButtonOptions,
): Phaser.GameObjects.Zone {
  const {
    x,
    y,
    w,
    h = 44,
    label,
    enabled = true,
    accent = DUNGEON_UI.BRASS,
    textColor = '#ffffff',
    onPress,
  } = options;
  const fill = enabled ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE;
  const border = enabled ? accent : DUNGEON_UI.IRON;
  const labelColor = enabled ? textColor : DUNGEON_UI_CSS.MUTED;

  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.VOID, 0.7);
  bg.fillRoundedRect(x + 1, y + 3, w, h, 7);
  bg.fillStyle(fill, 1);
  bg.fillRoundedRect(x, y, w, h, 7);
  bg.lineStyle(1.5, border, enabled ? 0.95 : 0.56);
  bg.strokeRoundedRect(x, y, w, h, 7);
  if (enabled) {
    bg.fillStyle(accent, 0.16);
    bg.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
  container.add(bg);

  container.add(scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: w < 82 ? '10px' : '11px',
    fontStyle: 'bold',
    color: labelColor,
    align: 'center',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0);
  if (enabled) {
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onPress);
  }
  container.add(zone);
  return zone;
}

export interface ShopPagerOptions {
  readonly y?: number;
  readonly page: number;
  readonly pageCount: number;
  readonly onPage: (page: number) => void;
}

export function addShopPager(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: ShopPagerOptions,
): void {
  const y = options.y ?? SHOP_LAYOUT.pagerTop;
  addShopButton(scene, container, {
    x: 12,
    y,
    w: 92,
    label: '이전 선반',
    enabled: options.page > 0,
    onPress: () => options.onPage(options.page - 1),
  });
  container.add(scene.add.text(195, y + 17, `${options.page + 1} / ${options.pageCount}`, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0.5));
  container.add(scene.add.text(195, y + 32, 'SHELF', {
    fontFamily: 'monospace',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  addShopButton(scene, container, {
    x: 286,
    y,
    w: 92,
    label: '다음 선반',
    enabled: options.page < options.pageCount - 1,
    onPress: () => options.onPage(options.page + 1),
  });
}

export function addShopSectionHeading(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  title: string,
  detail: string,
): void {
  container.add(scene.add.text(14, SHOP_LAYOUT.contentTop, title, {
    fontFamily: 'sans-serif',
    fontSize: '15px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  container.add(scene.add.text(14, SHOP_LAYOUT.contentTop + 21, detail, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }));
}
