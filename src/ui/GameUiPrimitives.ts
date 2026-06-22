import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { addInnerGlow, addPanelShadow } from './PanelDepth';

export const GAME_UI = {
  radius: {
    panel: 16,
    button: 14,
    row: 11,
  },
  touch: {
    primaryHeight: 48,
    compactHeight: 34,
  },
  /** 타이포 3계층 — 캐주얼 토이: 전부 굵은 sans (제목은 약간 더 큼) */
  fonts: {
    title:   'sans-serif',
    body:    'sans-serif',
    numeric: 'sans-serif',
  },
  colors: {
    panelFill: CASUAL.PANEL,
    rowFill: CASUAL.PANEL_SOFT,
    rowBorder: CASUAL.EDGE_SOFT,
    primaryFill: CASUAL.GREEN,
    primaryHoverFill: 0x6fdc70,
    primaryBorder: CASUAL.GREEN_DK,
    primaryHoverBorder: CASUAL.GREEN_DK,
    mutedText: CASUAL_CSS.INK_SOFT,
    bevelLight: 0xffffff,
    shadowFill: CASUAL.SHADOW,
    valueChipFill: CASUAL.PANEL_SOFT,
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
    borderColor = CASUAL.EDGE,
    borderAlpha = 1,
    borderWidth = 3,
    accentColor,
    accentAlpha = 1,
    glowColor = borderColor,
    glowOpacity = 0,
    shadowOpacity = 0.28,
    shadowOffsetY = 5,
  } = options;

  // Chunky drop shadow (casual toy depth)
  const shadow = addPanelShadow(scene, x, y, w, h, radius, {
    offsetY: shadowOffsetY,
    opacity: shadowOpacity,
  });

  const panel = scene.add.graphics();
  // dark bottom edge — gives the stone card a chiseled thickness
  panel.fillStyle(CASUAL.SHADOW, 0.5);
  panel.fillRoundedRect(x, y + 4, w, h, radius);
  // stone body
  panel.fillStyle(fillColor, 1);
  panel.fillRoundedRect(x, y, w, h, radius);
  // subtle lit top bevel (torch-lit stone edge, not a bright gloss)
  panel.fillStyle(0xffffff, 0.07);
  panel.fillRoundedRect(x + 5, y + 4, w - 10, Math.min(16, h * 0.3), Math.max(6, radius - 4));
  // soft inner shadow toward the bottom for depth
  panel.fillStyle(CASUAL.SHADOW, 0.28);
  panel.fillRoundedRect(x + 5, y + h * 0.6, w - 10, h * 0.4 - 5, Math.max(6, radius - 4));
  // thick rounded brown border
  panel.lineStyle(borderWidth, borderColor, borderAlpha);
  panel.strokeRoundedRect(x, y, w, h, radius);

  // optional accent header pill (saturated cap across the top)
  if (accentColor !== undefined) {
    panel.fillStyle(accentColor, accentAlpha);
    panel.fillRoundedRect(x + 6, y + 6, Math.max(8, w - 12), Math.min(8, h * 0.16), 4);
  }

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
    h = 22,
    icon,
    label,
    value,
    valueColor = CASUAL_CSS.INK,
    fillColor = GAME_UI.colors.rowFill,
    borderColor = GAME_UI.colors.rowBorder,
    labelColor = GAME_UI.colors.mutedText,
  } = options;

  const bg = scene.add.graphics();
  // soft stone pill row
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(x, y, w, h, GAME_UI.radius.row);
  bg.fillStyle(0xffffff, 0.07);
  bg.fillRoundedRect(x + 3, y + 3, w - 6, 3, 2);
  bg.lineStyle(2, borderColor, 0.9);
  bg.strokeRoundedRect(x, y, w, h, GAME_UI.radius.row);
  // icon disc (warm tan)
  bg.fillStyle(CASUAL.EDGE_SOFT, 0.45);
  bg.fillCircle(x + 14, y + h / 2, 9);
  // value chip (dark inset so the value text reads)
  const valueChipW = Math.max(24, Math.min(64, w - 40));
  const valueChipX = x + Math.max(30, w - valueChipW - 6);
  bg.fillStyle(CASUAL.SHADOW, 0.4);
  bg.fillRoundedRect(valueChipX, y + 4, valueChipW, h - 8, 6);

  const iconText = scene.add.text(x + 14, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
  }).setOrigin(0.5);
  const labelText = scene.add.text(x + 31, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: labelColor,
    fontStyle: 'bold',
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
    disabledFillColor = CASUAL.PANEL_SOFT,
    disabledBorderColor = CASUAL.EDGE_SOFT,
    textColor = '#ffffff',
    disabledTextColor = GAME_UI.colors.mutedText,
    onPress,
  } = options;

  const r = GAME_UI.radius.button;
  const bg = scene.add.graphics();
  const draw = (fill: number, border: number): void => {
    bg.clear();
    // thick colored bottom edge (the candy-button base)
    bg.fillStyle(border, 1);
    bg.fillRoundedRect(x, y + 4, w, h, r);
    // bright cap
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x, y, w, h - 2, r);
    // glossy top highlight
    bg.fillStyle(0xffffff, 0.32);
    bg.fillRoundedRect(x + 5, y + 4, w - 10, Math.max(8, h * 0.36), Math.max(5, r - 4));
    if (w >= 92 && enabled) {
      bg.fillStyle(0xffffff, 0.85);
      bg.fillTriangle(x + w - 16, y + h / 2 - 1, x + w - 24, y + h / 2 - 6, x + w - 24, y + h / 2 + 4);
    }
  };
  draw(enabled ? fillColor : disabledFillColor, enabled ? borderColor : disabledBorderColor);

  const text = scene.add.text(x + w / 2, y + h / 2 - 1, label, {
    fontFamily: 'sans-serif',
    fontSize,
    color: enabled ? textColor : disabledTextColor,
    fontStyle: 'bold',
    align,
    stroke: enabled ? '#00000033' : undefined,
    strokeThickness: enabled ? 3 : 0,
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
    fillColor = CASUAL.GOLD,
    trackColor = CASUAL.PANEL_SOFT,
    borderColor = CASUAL.EDGE_SOFT,
    borderAlpha = 0.9,
    animate = true,
    delay = 0,
    duration = 420,
  } = options;
  const clamped = Phaser.Math.Clamp(ratio, 0, 1);
  const targetW = clamped <= 0 ? 0 : Math.max(2, w * clamped);

  const track = scene.add.graphics();
  track.fillStyle(trackColor, 1);
  track.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
  track.lineStyle(2, borderColor, borderAlpha);
  track.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));

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

// ─── Pill Tag ──────────────────────────────────────────────────────────────
// 컴팩트 라운드 태그: 선택적 아이콘 + 라벨을 채워진 알약 위에. 상태 뱃지
// (Lv.N / 미건설), 자원·생산률 칩, 희귀도 태그 등 타이쿤 'juice' 요소에 공용.
// 텍스트 폭에 맞춰 자동 크기. 컨테이너 + 측정폭을 돌려줘 호출부가 이어 배치.

export interface PillTagOptions {
  readonly x: number;            // 좌측 끝
  readonly y: number;            // 수직 중심
  readonly label: string;
  readonly icon?: string;
  readonly fillColor?: number;
  readonly fillAlpha?: number;
  readonly borderColor?: number;
  readonly borderAlpha?: number;
  readonly textColor?: string;
  readonly fontSize?: string;
  readonly height?: number;
  readonly paddingX?: number;
  readonly glowColor?: number;   // 알약 뒤 소프트 글로우(시선 유도)
  readonly depth?: number;
}

export interface PillTagRefs {
  readonly container: Phaser.GameObjects.Container;
  readonly width: number;
}

export function addPillTag(scene: Phaser.Scene, o: PillTagOptions): PillTagRefs {
  const {
    x, y, label, icon,
    fillColor = CASUAL.PANEL_SOFT, fillAlpha = 1,
    borderColor = CASUAL.EDGE_SOFT, borderAlpha = 0.9,
    textColor = CASUAL_CSS.INK, fontSize = '10px',
    height = 18, paddingX = 8, glowColor, depth,
  } = o;

  const txtObj = scene.add.text(0, 0, (icon ? icon + ' ' : '') + label, {
    fontFamily: 'sans-serif', fontSize, color: textColor, fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  const w = Math.ceil(txtObj.width) + paddingX * 2;
  txtObj.setPosition(x + paddingX, y);

  const r = height / 2;
  const g = scene.add.graphics();
  if (glowColor !== undefined) {
    g.fillStyle(glowColor, 0.22);
    g.fillRoundedRect(x - 3, y - r - 3, w + 6, height + 6, r + 3);
  }
  g.fillStyle(fillColor, fillAlpha);
  g.fillRoundedRect(x, y - r, w, height, r);
  g.fillStyle(0xffffff, 0.10);
  g.fillRoundedRect(x + 3, y - r + 2, w - 6, 3, 2);
  g.lineStyle(1.5, borderColor, borderAlpha);
  g.strokeRoundedRect(x, y - r, w, height, r);

  // container children order [g, txtObj] → 텍스트가 알약 위에 렌더
  const container = scene.add.container(0, 0, [g, txtObj]);
  if (depth !== undefined) container.setDepth(depth);
  return { container, width: w };
}

// ─── Icon Medallion ──────────────────────────────────────────────────────────
// 액센트 링 + 소프트 글로우를 두른 아이콘 디스크. 평면 다크 사각 타일 대신
// 캐릭터·시설·기능 아이콘을 '메달리온'으로 띄워 타이쿤 카드의 시선 앵커로.

export interface IconMedallionOptions {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;         // 지름 / 사각 한 변
  readonly emoji: string;
  readonly accent?: number;      // 링 + 글로우 색
  readonly rounded?: boolean;    // 라운드 사각(기본) vs 원형
  readonly glow?: boolean;
  readonly depth?: number;
}

export interface IconMedallionRefs {
  readonly container: Phaser.GameObjects.Container;
}

export function addIconMedallion(scene: Phaser.Scene, o: IconMedallionOptions): IconMedallionRefs {
  const { cx, cy, size, emoji, accent = CASUAL.GOLD, rounded = true, glow = true, depth } = o;
  const half = size / 2;
  const r = rounded ? Math.max(8, size * 0.28) : half;

  const g = scene.add.graphics();
  if (glow) {
    g.fillStyle(accent, 0.16);
    if (rounded) g.fillRoundedRect(cx - half - 3, cy - half - 3, size + 6, size + 6, r + 3);
    else g.fillCircle(cx, cy, half + 4);
  }
  // recessed dark base (drop)
  g.fillStyle(CASUAL.SHADOW, 0.55);
  if (rounded) g.fillRoundedRect(cx - half, cy - half + 2, size, size, r);
  else g.fillCircle(cx, cy + 2, half);
  // body
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  if (rounded) g.fillRoundedRect(cx - half, cy - half, size, size, r);
  else g.fillCircle(cx, cy, half);
  // accent tint toward bottom + top gloss
  g.fillStyle(accent, 0.14);
  if (rounded) g.fillRoundedRect(cx - half + 3, cy + 1, size - 6, half - 3, Math.max(4, r - 4));
  else g.fillCircle(cx, cy + half * 0.4, half * 0.66);
  g.fillStyle(0xffffff, 0.10);
  if (rounded) g.fillRoundedRect(cx - half + 4, cy - half + 4, size - 8, Math.max(6, size * 0.30), Math.max(4, r - 4));
  // accent ring
  g.lineStyle(2, accent, 0.95);
  if (rounded) g.strokeRoundedRect(cx - half, cy - half, size, size, r);
  else g.strokeCircle(cx, cy, half);

  const icon = scene.add.text(cx, cy, emoji, {
    fontFamily: 'sans-serif', fontSize: `${Math.round(size * 0.5)}px`,
  }).setOrigin(0.5);
  const container = scene.add.container(0, 0, [g, icon]);
  if (depth !== undefined) container.setDepth(depth);
  return { container };
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

  // chunky cream back pill
  const backW = 58;
  const backX = 14;
  const backG = scene.add.graphics();
  backG.fillStyle(CASUAL.SHADOW, 0.2);
  backG.fillRoundedRect(backX, y - 13 + 3, backW, 26, 13);
  backG.fillStyle(CASUAL.PANEL, 1);
  backG.fillRoundedRect(backX, y - 13, backW, 26, 13);
  backG.fillStyle(0xffffff, 0.1);
  backG.fillRoundedRect(backX + 4, y - 11, backW - 8, 5, 3);
  backG.lineStyle(2.5, CASUAL.EDGE, 1);
  backG.strokeRoundedRect(backX, y - 13, backW, 26, 13);
  container.add(backG);

  const back = scene.add.text(backX + backW / 2, y, o.backLabel ?? '← 뒤로', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(back);

  const backZone = scene.add.zone(backX, y - 13, backW, 26).setOrigin(0)
    .setInteractive({ useHandCursor: true });
  backZone.on('pointerdown', o.onBack);
  container.add(backZone);

  const title = scene.add.text(CANVAS_WIDTH / 2, y, o.title, {
    fontFamily: 'sans-serif', fontSize: '21px', fontStyle: 'bold',
    color: o.titleCSS ?? CASUAL_CSS.INK,
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5);
  container.add(title);

  if (o.subtitle) {
    container.add(scene.add.text(title.x, y + 18, o.subtitle, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
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
  const height  = o.height ?? 38;
  const depth   = o.depth ?? 10;
  const width   = o.width ?? CANVAS_WIDTH;
  const accent  = o.accent ?? CASUAL.GOLD;
  const fontSize  = o.fontSize ?? '13px';

  const container = scene.add.container(0, o.y).setDepth(depth);

  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRect(0, 0, width, height);
  bg.fillStyle(0xffffff, 0.08);
  bg.fillRect(0, 0, width, 2);
  bg.fillStyle(CASUAL.EDGE, 1);
  bg.fillRect(0, height - 3, width, 3);
  container.add(bg);

  const tabW = width / o.tabs.length;
  o.tabs.forEach((tab, i) => {
    const isActive = tab.id === o.active;
    const tabAccent    = tab.accent    ?? accent;
    const cx = i * tabW + tabW / 2;

    if (isActive) {
      // saturated rounded active pill
      const fill = scene.add.graphics();
      fill.fillStyle(CASUAL.EDGE, 0.25);
      fill.fillRoundedRect(i * tabW + 5, 5 + 2, tabW - 10, height - 12, 11);
      fill.fillStyle(tabAccent, 1);
      fill.fillRoundedRect(i * tabW + 5, 5, tabW - 10, height - 12, 11);
      fill.fillStyle(0xffffff, 0.32);
      fill.fillRoundedRect(i * tabW + 9, 8, tabW - 18, 6, 3);
      container.add(fill);
    }

    container.add(scene.add.text(cx, height / 2, tab.label, {
      fontFamily: 'sans-serif', fontSize,
      color: isActive ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
      stroke: isActive ? '#00000033' : undefined,
      strokeThickness: isActive ? 3 : 0,
    }).setOrigin(0.5));

    if (tab.badge && tab.badge > 0) {
      const bx = (i + 1) * tabW - 12;
      const badge = scene.add.graphics();
      badge.fillStyle(CASUAL.RED, 1);
      badge.fillCircle(bx, 9, 8);
      badge.lineStyle(2, 0xffffff, 1);
      badge.strokeCircle(bx, 9, 8);
      container.add(badge);
      container.add(scene.add.text(bx, 9, tab.badge > 9 ? '9+' : String(tab.badge), {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const zone = scene.add.zone(i * tabW, 0, tabW, height)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => { if (!isActive) o.onSelect(tab.id); });
    container.add(zone);
  });

  return { container };
}
