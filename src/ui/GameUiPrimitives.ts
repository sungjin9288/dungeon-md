import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, SCENE_HEADER_TOUCH_HEIGHT } from '../constants/layout';
import { addInnerGlow, addPanelShadow } from './PanelDepth';
import { getReducedMotion } from '../utils/reducedMotion';

export const GAME_UI = {
  radius: {
    panel: 10,
    button: 9,
    row: 7,
  },
  touch: {
    primaryHeight: 48,
    compactHeight: 44,
  },
  /** Compact mobile sans; hierarchy comes from size and spacing. */
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
    primaryHoverFill: 0x66c69a,
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
    borderWidth = 1.5,
    accentColor,
    accentAlpha = 1,
    glowColor = borderColor,
    glowOpacity = 0,
    shadowOpacity = 0.18,
    shadowOffsetY = 3,
  } = options;

  // Quiet depth: a short shadow, one stone face, and a functional edge.
  const shadow = addPanelShadow(scene, x, y, w, h, radius, {
    offsetY: shadowOffsetY,
    opacity: shadowOpacity,
  });

  const panel = scene.add.graphics();
  panel.fillStyle(fillColor, 1);
  panel.fillRoundedRect(x, y, w, h, radius);
  panel.lineStyle(borderWidth, borderColor, borderAlpha);
  panel.strokeRoundedRect(x, y, w, h, radius);

  // Optional semantic marker: a narrow rule, never a decorative cap.
  if (accentColor !== undefined) {
    panel.fillStyle(accentColor, accentAlpha);
    panel.fillRect(x + 1, y + 1, 3, Math.max(8, h - 2));
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
  // Low-contrast information row; value position carries the hierarchy.
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(x, y, w, h, GAME_UI.radius.row);
  bg.lineStyle(1, borderColor, 0.55);
  bg.strokeRoundedRect(x, y, w, h, GAME_UI.radius.row);
  bg.fillStyle(borderColor, 0.16);
  bg.fillRect(x, y, 3, h);

  const iconText = scene.add.text(x + 14, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
  }).setOrigin(0.5);
  const labelText = scene.add.text(x + 31, y + h / 2, label, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
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
  readonly showArrow?: boolean;
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
    showArrow = true,
    onPress,
  } = options;

  const r = GAME_UI.radius.button;
  const bg = scene.add.graphics();
  const draw = (fill: number, border: number): void => {
    bg.clear();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x, y, w, h, r);
    bg.lineStyle(1.5, border, 0.95);
    bg.strokeRoundedRect(x, y, w, h, r);
    if (showArrow && w >= 92 && enabled) {
      bg.fillStyle(0xffffff, 0.76);
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
      if (getReducedMotion()) {
        onPress();
        return;
      }
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
  const effectiveAnimate = animate && !getReducedMotion();

  const track = scene.add.graphics();
  track.fillStyle(trackColor, 1);
  track.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
  track.lineStyle(1, borderColor, borderAlpha);
  track.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));

  const fill = scene.add.rectangle(x, y, effectiveAnimate && targetW > 0 ? 1 : targetW, h, fillColor)
    .setOrigin(0, 0);
  if (targetW <= 0) {
    fill.setVisible(false);
  } else if (effectiveAnimate) {
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
    borderColor = CASUAL.EDGE_SOFT, borderAlpha = 0.65,
    textColor = CASUAL_CSS.INK, fontSize = '11px',
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
    g.fillStyle(glowColor, 0.10);
    g.fillRoundedRect(x - 2, y - r - 2, w + 4, height + 4, Math.min(6, r + 2));
  }
  g.fillStyle(fillColor, fillAlpha);
  g.fillRoundedRect(x, y - r, w, height, Math.min(6, r));
  g.lineStyle(1, borderColor, borderAlpha);
  g.strokeRoundedRect(x, y - r, w, height, Math.min(6, r));

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
  const r = rounded ? Math.max(6, size * 0.20) : half;

  const g = scene.add.graphics();
  if (glow) {
    g.fillStyle(accent, 0.09);
    if (rounded) g.fillRoundedRect(cx - half - 3, cy - half - 3, size + 6, size + 6, r + 3);
    else g.fillCircle(cx, cy, half + 4);
  }
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  if (rounded) g.fillRoundedRect(cx - half, cy - half, size, size, r);
  else g.fillCircle(cx, cy, half);
  // Restrained semantic tint.
  g.fillStyle(accent, 0.10);
  if (rounded) g.fillRoundedRect(cx - half + 3, cy + 1, size - 6, half - 3, Math.max(4, r - 4));
  else g.fillCircle(cx, cy + half * 0.4, half * 0.66);
  g.lineStyle(1.5, accent, 0.82);
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

  // Utility action: quiet visual with a 58×44 hit surface.
  const backW = 58;
  const backX = 14;
  const backH = 32;
  const backG = scene.add.graphics();
  backG.fillStyle(CASUAL.PANEL, 1);
  backG.fillRoundedRect(backX, y - backH / 2, backW, backH, 7);
  backG.lineStyle(1, CASUAL.EDGE_SOFT, 0.7);
  backG.strokeRoundedRect(backX, y - backH / 2, backW, backH, 7);
  container.add(backG);

  const back = scene.add.text(backX + backW / 2, y, o.backLabel ?? '← 뒤로', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(back);

  const backZone = scene.add.zone(backX, y - 22, backW, 44).setOrigin(0)
    .setInteractive({ useHandCursor: true });
  backZone.on('pointerdown', o.onBack);
  container.add(backZone);

  const title = scene.add.text(CANVAS_WIDTH / 2, y, o.title, {
    fontFamily: 'sans-serif', fontSize: '21px', fontStyle: 'bold',
    color: o.titleCSS ?? CASUAL_CSS.INK,
    stroke: '#05060c', strokeThickness: 2,
  }).setOrigin(0.5);
  container.add(title);

  if (o.subtitle) {
    container.add(scene.add.text(title.x, y + 18, o.subtitle, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
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
  const height  = o.height ?? 44;
  const depth   = o.depth ?? 10;
  const width   = o.width ?? CANVAS_WIDTH;
  const accent  = o.accent ?? CASUAL.GOLD;
  const fontSize  = o.fontSize ?? '13px';

  const container = scene.add.container(0, o.y).setDepth(depth);

  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRect(0, 0, width, height);
  bg.fillStyle(CASUAL.EDGE_SOFT, 0.45);
  bg.fillRect(0, height - 1, width, 1);
  container.add(bg);

  const tabW = width / o.tabs.length;
  o.tabs.forEach((tab, i) => {
    const isActive = tab.id === o.active;
    const tabAccent    = tab.accent    ?? accent;
    const cx = i * tabW + tabW / 2;

    if (isActive) {
      const fill = scene.add.graphics();
      fill.fillStyle(tabAccent, 0.14);
      fill.fillRect(i * tabW + 6, 0, tabW - 12, height);
      fill.fillStyle(tabAccent, 1);
      fill.fillRect(i * tabW + 10, height - 3, tabW - 20, 3);
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

    const touchHeight = Math.max(height, SCENE_HEADER_TOUCH_HEIGHT);
    const zone = scene.add.zone(i * tabW, (height - touchHeight) / 2, tabW, touchHeight)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => { if (!isActive) o.onSelect(tab.id); });
    container.add(zone);
  });

  return { container };
}
