import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { addInnerGlow, addPanelShadow } from './PanelDepth';

export const GAME_UI = {
  radius: {
    panel: 8,
    button: 8,
    row: 6,
  },
  touch: {
    primaryHeight: 48,
    compactHeight: 34,
  },
  colors: {
    panelFill: 0x1f1305,
    rowFill: 0x2c1d0d,
    rowBorder: 0x55b88a,
    primaryFill: 0x1b9f71,
    primaryHoverFill: 0x24bd86,
    primaryBorder: 0x8cffc1,
    primaryHoverBorder: 0xffdf6e,
    mutedText: '#c8b896',
    bevelLight: 0xf5e8c8,
    shadowFill: 0x070503,
    valueChipFill: 0x140c03,
  },
} as const;

export interface FramedPanelOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly radius?: number;
  readonly fillColor?: number;
  readonly borderColor?: number;
  readonly borderAlpha?: number;
  readonly borderWidth?: number;
  readonly accentColor?: number;
  readonly accentAlpha?: number;
  readonly glowColor?: number;
  readonly glowOpacity?: number;
  readonly shadowOpacity?: number;
  readonly shadowOffsetY?: number;
}

export interface FramedPanelRefs {
  readonly shadow: Phaser.GameObjects.Graphics;
  readonly panel: Phaser.GameObjects.Graphics;
  readonly glow: Phaser.GameObjects.Graphics;
}

export function addFramedPanel(
  scene: Phaser.Scene,
  options: FramedPanelOptions,
): FramedPanelRefs {
  const {
    x,
    y,
    w,
    h,
    radius = GAME_UI.radius.panel,
    fillColor = GAME_UI.colors.panelFill,
    borderColor = COLORS.TORCH_GOLD,
    borderAlpha = 0.85,
    borderWidth = 2,
    accentColor,
    accentAlpha = 0.75,
    glowColor = borderColor,
    glowOpacity = 0.12,
    shadowOpacity = 0.55,
    shadowOffsetY = 4,
  } = options;

  const shadow = addPanelShadow(scene, x, y, w, h, radius, {
    offsetY: shadowOffsetY,
    opacity: shadowOpacity,
  });

  const panel = scene.add.graphics();
  panel.fillStyle(0x070503, 0.38);
  panel.fillRoundedRect(x + 2, y + h - 8, w - 4, 9, Math.max(3, radius - 2));
  panel.fillStyle(fillColor, 1);
  panel.fillRoundedRect(x, y, w, h, radius);
  panel.fillStyle(0xffffff, 0.045);
  panel.fillRoundedRect(x + 4, y + 4, w - 8, Math.min(28, h - 8), Math.max(4, radius - 2));
  panel.fillStyle(0x000000, 0.12);
  panel.fillRoundedRect(x + 4, y + h - Math.min(22, h / 3), w - 8, Math.min(18, h - 8), Math.max(4, radius - 2));
  panel.lineStyle(borderWidth, borderColor, borderAlpha);
  panel.strokeRoundedRect(x, y, w, h, radius);
  panel.lineStyle(1, 0xffffff, Math.min(0.22, borderAlpha * 0.28));
  panel.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, Math.max(3, radius - 2));

  if (accentColor !== undefined) {
    panel.fillStyle(accentColor, accentAlpha);
    panel.fillRoundedRect(x + 16, y + 5, Math.max(8, w - 32), 3, 2);
    panel.fillStyle(accentColor, Math.max(0.08, accentAlpha * 0.24));
    panel.fillRoundedRect(x + 6, y + 12, 4, Math.max(10, h - 24), 3);
  }

  const rivetColor = accentColor ?? borderColor;
  panel.fillStyle(0x070503, 0.62);
  panel.fillCircle(x + 10, y + 10, 2.4);
  panel.fillCircle(x + w - 10, y + 10, 2.4);
  panel.fillCircle(x + 10, y + h - 10, 2.4);
  panel.fillCircle(x + w - 10, y + h - 10, 2.4);
  panel.fillStyle(rivetColor, 0.54);
  panel.fillCircle(x + 10, y + 10, 1.25);
  panel.fillCircle(x + w - 10, y + 10, 1.25);
  panel.fillCircle(x + 10, y + h - 10, 1.25);
  panel.fillCircle(x + w - 10, y + h - 10, 1.25);

  const glow = addInnerGlow(scene, x, y, w, h, radius, glowColor, glowOpacity);
  return { shadow, panel, glow };
}

export interface InfoRowOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h?: number;
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly valueColor?: string;
  readonly fillColor?: number;
  readonly borderColor?: number;
  readonly labelColor?: string;
}

export interface InfoRowRefs {
  readonly bg: Phaser.GameObjects.Graphics;
  readonly iconText: Phaser.GameObjects.Text;
  readonly labelText: Phaser.GameObjects.Text;
  readonly valueText: Phaser.GameObjects.Text;
}

export function addInfoRow(
  scene: Phaser.Scene,
  options: InfoRowOptions,
): InfoRowRefs {
  const {
    x,
    y,
    w,
    h = 21,
    icon,
    label,
    value,
    valueColor = CSS.PARCHMENT_DIM,
    fillColor = GAME_UI.colors.rowFill,
    borderColor = GAME_UI.colors.rowBorder,
    labelColor = GAME_UI.colors.mutedText,
  } = options;

  const bg = scene.add.graphics();
  bg.fillStyle(GAME_UI.colors.shadowFill, 0.34);
  bg.fillRoundedRect(x + 1, y + 2, w - 2, h, GAME_UI.radius.row);
  bg.fillStyle(fillColor, 0.96);
  bg.fillRoundedRect(x, y, w, h, GAME_UI.radius.row);
  bg.fillStyle(0xffffff, 0.045);
  bg.fillRoundedRect(x + 3, y + 3, w - 6, 3, 2);
  bg.lineStyle(1, borderColor, 0.55);
  bg.strokeRoundedRect(x, y, w, h, GAME_UI.radius.row);
  bg.fillStyle(borderColor, 0.18);
  bg.fillRoundedRect(x + 4, y + 4, 20, h - 8, 5);
  const valueChipW = Math.max(24, Math.min(64, w - 40));
  const valueChipX = x + Math.max(30, w - valueChipW - 6);
  bg.fillStyle(GAME_UI.colors.valueChipFill, 0.72);
  bg.fillRoundedRect(valueChipX, y + 4, valueChipW, h - 8, 5);

  const iconText = scene.add.text(x + 14, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
  }).setOrigin(0.5);
  const labelText = scene.add.text(x + 31, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: labelColor,
  }).setOrigin(0, 0.5);
  const valueText = scene.add.text(x + w - 10, y + h / 2, value, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: valueColor,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5);

  return { bg, iconText, labelText, valueText };
}

export interface PrimaryActionButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h?: number;
  readonly label: string;
  readonly fontSize?: string;
  readonly align?: CanvasTextAlign;
  readonly enabled?: boolean;
  readonly once?: boolean;
  readonly fillColor?: number;
  readonly hoverFillColor?: number;
  readonly borderColor?: number;
  readonly hoverBorderColor?: number;
  readonly disabledFillColor?: number;
  readonly disabledBorderColor?: number;
  readonly textColor?: string;
  readonly disabledTextColor?: string;
  readonly onPress: () => void;
}

export interface PrimaryActionButtonRefs {
  readonly bg: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
}

export function addPrimaryActionButton(
  scene: Phaser.Scene,
  options: PrimaryActionButtonOptions,
): PrimaryActionButtonRefs {
  const {
    x,
    y,
    w,
    h = GAME_UI.touch.primaryHeight,
    label,
    fontSize = '17px',
    align = 'center',
    enabled = true,
    once = false,
    fillColor = GAME_UI.colors.primaryFill,
    hoverFillColor = GAME_UI.colors.primaryHoverFill,
    borderColor = GAME_UI.colors.primaryBorder,
    hoverBorderColor = GAME_UI.colors.primaryHoverBorder,
    disabledFillColor = 0x1b2630,
    disabledBorderColor = 0x395168,
    textColor = '#fff8d8',
    disabledTextColor = GAME_UI.colors.mutedText,
    onPress,
  } = options;

  const bg = scene.add.graphics();
  const draw = (fill: number, border: number): void => {
    bg.clear();
    bg.fillStyle(GAME_UI.colors.shadowFill, 0.42);
    bg.fillRoundedRect(x, y + 5, w, h, GAME_UI.radius.button);
    bg.fillStyle(border, 0.22);
    bg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, GAME_UI.radius.button + 1);
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x, y, w, h, GAME_UI.radius.button);
    bg.fillStyle(0xffffff, 0.10);
    bg.fillRoundedRect(x + 5, y + 5, w - 10, Math.min(12, h - 10), 5);
    bg.fillStyle(0x000000, 0.15);
    bg.fillRoundedRect(x + 5, y + h - 13, w - 10, 8, 4);
    bg.fillStyle(border, 0.18);
    bg.fillRoundedRect(x + 7, y + 7, 5, h - 14, 3);
    bg.lineStyle(1.5, border, 0.92);
    bg.strokeRoundedRect(x, y, w, h, GAME_UI.radius.button);
    bg.lineStyle(1, 0xffffff, 0.24);
    bg.lineBetween(x + 14, y + 7, x + w - 14, y + 7);
    if (w >= 92) {
      bg.fillStyle(0xffffff, 0.26);
      bg.fillTriangle(x + w - 17, y + h / 2, x + w - 24, y + h / 2 - 4, x + w - 24, y + h / 2 + 4);
    }
  };
  draw(enabled ? fillColor : disabledFillColor, enabled ? borderColor : disabledBorderColor);

  const text = scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize,
    color: enabled ? textColor : disabledTextColor,
    fontStyle: 'bold',
    align,
  }).setOrigin(0.5);

  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0);
  if (enabled) {
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(hoverFillColor, hoverBorderColor));
    zone.on('pointerout', () => {
      text.setScale(1);
      draw(fillColor, borderColor);
    });

    const press = (): void => {
      scene.tweens.add({
        targets: [bg, text],
        alpha: 0.7,
        duration: 70,
        yoyo: true,
        onComplete: () => {
          bg.setAlpha(1);
          text.setAlpha(1);
          onPress();
        },
      });
    };
    if (once) zone.once('pointerdown', press);
    else zone.on('pointerdown', press);
  }

  return { bg, text, zone };
}

export interface ProgressBarOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h?: number;
  readonly ratio: number;
  readonly fillColor?: number;
  readonly trackColor?: number;
  readonly borderColor?: number;
  readonly borderAlpha?: number;
  readonly animate?: boolean;
  readonly delay?: number;
  readonly duration?: number;
}

export interface ProgressBarRefs {
  readonly track: Phaser.GameObjects.Graphics;
  readonly fill: Phaser.GameObjects.Rectangle;
}

export function addProgressBar(
  scene: Phaser.Scene,
  options: ProgressBarOptions,
): ProgressBarRefs {
  const {
    x,
    y,
    w,
    h = 10,
    ratio,
    fillColor = COLORS.TORCH_GOLD,
    trackColor = 0x0a0600,
    borderColor = 0x664400,
    borderAlpha = 0.6,
    animate = true,
    delay = 0,
    duration = 420,
  } = options;
  const clamped = Phaser.Math.Clamp(ratio, 0, 1);
  const targetW = clamped <= 0 ? 0 : Math.max(2, w * clamped);

  const track = scene.add.graphics();
  track.fillStyle(0x000000, 0.28);
  track.fillRoundedRect(x, y + 1, w, h, Math.max(2, h / 2));
  track.fillStyle(trackColor, 1);
  track.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
  track.lineStyle(0.5, borderColor, borderAlpha);
  track.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));
  track.lineStyle(1, 0xffffff, 0.10);
  track.lineBetween(x + 3, y + 2, x + w - 3, y + 2);

  const fill = scene.add.rectangle(x, y, animate && targetW > 0 ? 1 : targetW, h, fillColor)
    .setOrigin(0, 0);
  if (targetW <= 0) {
    fill.setVisible(false);
  } else if (animate) {
    scene.tweens.add({
      targets: fill,
      displayWidth: targetW,
      duration,
      ease: 'Power2.Out',
      delay,
    });
  }

  return { track, fill };
}

// ─── Scene Header ─────────────────────────────────────────────────────────────
// 표준 씬 헤더: 좌측 뒤로 버튼 + 중앙 Georgia serif 골드 타이틀(+서브타이틀).
// 우측 부가 요소(타이머·도감 버튼 등)는 씬이 표준 좌표에 직접 배치한다.

export interface SceneHeaderOptions {
  title:      string;
  onBack:     () => void;
  /** 타이틀 색 — 기본은 통일 골드. 구역 정체성은 탭/버튼 액센트로만 표현 권장. */
  titleCSS?:  string;
  subtitle?:  string;
  /** 헤더 중심 y (기본 28) */
  y?:         number;
  backLabel?: string;
  depth?:     number;
}

export interface SceneHeaderRefs {
  container: Phaser.GameObjects.Container;
  title:     Phaser.GameObjects.Text;
  back:      Phaser.GameObjects.Text;
}

export function addSceneHeader(
  scene: Phaser.Scene,
  o: SceneHeaderOptions,
): SceneHeaderRefs {
  const y     = o.y ?? 28;
  const depth = o.depth ?? 10;
  const container = scene.add.container(0, 0).setDepth(depth);

  const back = scene.add.text(18, y, o.backLabel ?? '← 뒤로', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_DIM,
    backgroundColor: '#2d2416', padding: { x: 8, y: 4 },
  }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  back.on('pointerdown', o.onBack);
  container.add(back);

  const title = scene.add.text(CANVAS_WIDTH / 2, y, o.title, {
    fontFamily: 'Georgia, serif', fontSize: '20px',
    color: o.titleCSS ?? CSS.TORCH_AMBER,
  }).setOrigin(0.5);
  container.add(title);

  if (o.subtitle) {
    container.add(scene.add.text(title.x, y + 18, o.subtitle, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5));
  }

  return { container, title, back };
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
// 표준 탭바: 등폭 탭, 활성 = 액센트 볼드 + 하단 2px 언더라인, 비활성 = 음소거.
// 우상단 숫자 뱃지 지원(연구소 가용 카운트 등).

export interface TabBarTab<T extends string = string> {
  id:         T;
  label:      string;
  badge?:     number;
  /** 탭별 액센트 오버라이드 (기본은 TabBarOptions.accent) */
  accent?:    number;
  accentCSS?: string;
}

export interface TabBarOptions<T extends string = string> {
  tabs:      ReadonlyArray<TabBarTab<T>>;
  active:    T;
  /** 탭바 상단 y */
  y:         number;
  onSelect:  (id: T) => void;
  accent?:    number;
  accentCSS?: string;
  height?:    number;
  fontSize?:  string;
  depth?:     number;
  width?:     number;
}

export interface TabBarRefs {
  container: Phaser.GameObjects.Container;
}

export function addTabBar<T extends string>(
  scene: Phaser.Scene,
  o: TabBarOptions<T>,
): TabBarRefs {
  const height  = o.height ?? 32;
  const depth   = o.depth ?? 10;
  const width   = o.width ?? CANVAS_WIDTH;
  const accent  = o.accent ?? COLORS.TORCH_AMBER;
  const accentCSS = o.accentCSS ?? CSS.TORCH_AMBER;
  const fontSize  = o.fontSize ?? '13px';

  const container = scene.add.container(0, o.y).setDepth(depth);

  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.PANEL_DEEP, 1);
  bg.fillRect(0, 0, width, height);
  bg.lineStyle(1, COLORS.STONE_MID, 0.6);
  bg.lineBetween(0, height, width, height);
  container.add(bg);

  const tabW = width / o.tabs.length;
  o.tabs.forEach((tab, i) => {
    const isActive = tab.id === o.active;
    const tabAccent    = tab.accent    ?? accent;
    const tabAccentCSS = tab.accentCSS ?? accentCSS;
    const cx = i * tabW + tabW / 2;

    if (isActive) {
      const fill = scene.add.graphics();
      fill.fillStyle(COLORS.CARD_BG, 1);
      fill.fillRect(i * tabW, 0, tabW, height);
      fill.lineStyle(2, tabAccent, 1);
      fill.lineBetween(i * tabW + 6, height - 1, (i + 1) * tabW - 6, height - 1);
      container.add(fill);
    }

    container.add(scene.add.text(cx, height / 2, tab.label, {
      fontFamily: 'Georgia, serif', fontSize,
      color: isActive ? tabAccentCSS : CSS.PARCHMENT_MUTED,
      fontStyle: isActive ? 'bold' : 'normal',
    }).setOrigin(0.5));

    if (tab.badge && tab.badge > 0) {
      const bx = (i + 1) * tabW - 10;
      const badge = scene.add.graphics();
      badge.fillStyle(COLORS.BLOOD_GLOW, 1);
      badge.fillCircle(bx, 8, 7);
      container.add(badge);
      container.add(scene.add.text(bx, 8, tab.badge > 9 ? '9+' : String(tab.badge), {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
      }).setOrigin(0.5));
    }

    const zone = scene.add.zone(i * tabW, 0, tabW, height)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => { if (!isActive) o.onSelect(tab.id); });
    container.add(zone);
  });

  return { container };
}
