// ─── HomeResultOverlays ───────────────────────────────────────────────────────
// Battle-return / level-up / defeat / chapter-complete modal overlays for
// DungeonHomeScene. Split from HomeOverlays.ts to keep each module under the
// 800-line limit.

import type Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { getUnlockedSlots } from '../data/wisdom';
import { addFramedPanel, addInfoRow, addPrimaryActionButton } from './GameUiPrimitives';
import {
  buildBattleReturnGrowthSummary,
  type BattleReturnGrowthContext,
} from './HomeOverlayShared';
import type { BattleResultCallout } from '../data/battleResultCallout';

// Casual-toy modal chrome — cream cards, brown edges, saturated accents.
const OVERLAY_FILL = CASUAL.PANEL;          // cream modal body
const OVERLAY_ROW_FILL = CASUAL.PANEL_SOFT; // soft cream stat row
const VICTORY_GREEN = CASUAL.GREEN;
const VICTORY_GREEN_DARK = CASUAL.GREEN_DK; // candy-button base for primary
const VICTORY_TEXT = CASUAL_CSS.GREEN;
const DEFEAT_RED = CASUAL.RED;
const DEFEAT_RED_DARK = CASUAL.RED_DK;      // candy-button base for retry
const DEFEAT_TEXT = CASUAL_CSS.RED;

interface DmLevelUpOverlayOptions {
  readonly primaryLabel?: string;
  readonly onDismiss?: () => void;
}

// ─── Battle-return overlay ────────────────────────────────────────────────────

export function showBattleReturnOverlay(
  scene: Phaser.Scene,
  result: { goldEarned: number; dmXP: number },
  onDismiss: () => void,
  growth?: BattleReturnGrowthContext,
  callout?: BattleResultCallout,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  c.add(buildOverlayDim(scene, 0x000000, 0.5));

  const growthSummary = buildBattleReturnGrowthSummary(growth);
  const PW = 310, PH = callout ? 320 : 268;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: VICTORY_GREEN,
    accentAlpha: 1,
    glowColor: VICTORY_GREEN,
    glowOpacity: 0.1,
    shadowOpacity: 0.32,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '침략 격퇴! ✓', {
    fontFamily: 'sans-serif', fontSize: '21px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 64,
    w: PW - 48,
    h: 28,
    icon: '💰',
    label: '전리품 골드',
    value: `+${result.goldEarned.toLocaleString('ko-KR')}`,
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
  })));
  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 100,
    w: PW - 48,
    h: 28,
    icon: '✦',
    label: '던전 마스터 XP',
    value: `+${result.dmXP.toLocaleString('ko-KR')}`,
    valueColor: VICTORY_TEXT,
    fillColor: OVERLAY_ROW_FILL,
    borderColor: VICTORY_GREEN_DARK,
  })));
  addToContainer(c, ...Object.values(addInfoRow(scene, {
    x: PX + 24,
    y: PY + 136,
    w: PW - 48,
    h: 32,
    icon: growthSummary.icon,
    label: growthSummary.label,
    value: growthSummary.value,
    valueColor: growthSummary.valueColor,
    fillColor: growthSummary.fillColor,
    borderColor: growthSummary.borderColor,
  })));

  if (callout) {
    addBattleCalloutRow(scene, c, callout, PX + 24, PY + 174, PW - 48, 56);
  }

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + (callout ? 244 : 188), growthSummary.note, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 44,
    y: PY + PH - 58,
    w: PW - 88,
    label: growthSummary.buttonLabel,
    fillColor: VICTORY_GREEN,
    hoverFillColor: 0x6fdc70,
    borderColor: VICTORY_GREEN_DARK,
    textColor: CASUAL_CSS.WHITE,
    onPress: () => {
      c.destroy(true);
      onDismiss();
    },
  });

  animateOverlayIn(scene, c);
}

// ─── DM level-up overlay ──────────────────────────────────────────────────────

export function showDmLevelUpOverlay(
  scene: Phaser.Scene,
  newLevel: number,
  options: DmLevelUpOverlayOptions = {},
): void {
  const newSlots  = getUnlockedSlots(newLevel);
  const prevSlots = getUnlockedSlots(newLevel - 1);
  const slotUnlocked = newSlots > prevSlots;

  const c = scene.add.container(0, 0).setDepth(75);
  c.add(buildOverlayDim(scene, 0x000000, 0.5));

  const PW = 304, PH = 222;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.1,
    shadowOpacity: 0.32,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 26, '✨ LEVEL UP! ✨', {
    fontFamily: 'sans-serif', fontSize: '15px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    letterSpacing: 3, stroke: '#ffffff', strokeThickness: 3,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 60, `던전 마스터 Lv.${newLevel}`, {
    fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  const row = addInfoRow(scene, {
    x: PX + 24,
    y: PY + 96,
    w: PW - 48,
    h: 30,
    icon: slotUnlocked ? '🏰' : '⚔',
    label: slotUnlocked ? '방 슬롯 해금' : '전투력 강화',
    value: slotUnlocked ? `${prevSlots} → ${newSlots}` : '적용 완료',
    valueColor: slotUnlocked ? CASUAL_CSS.GREEN : CASUAL_CSS.GOLD,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: slotUnlocked ? CASUAL.GREEN_DK : CASUAL.GOLD_DK,
  });
  addToContainer(c, ...Object.values(row));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 148, '다음 방어 준비에 즉시 반영됩니다', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 52,
    y: PY + PH - 58,
    w: PW - 104,
    label: options.primaryLabel ?? '확인',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd66a,
    borderColor: CASUAL.GOLD_DK,
    textColor: CASUAL_CSS.WHITE,
    onPress: () => dismissOverlay(scene, c, options.onDismiss),
  });

  animateOverlayIn(scene, c, 0.82, 280);

  scene.time.delayedCall(4000, () => {
    if (c.active) {
      dismissOverlay(scene, c, options.onDismiss);
    }
  });
}

// ─── Battle-defeat overlay ────────────────────────────────────────────────────

export function showBattleDefeatOverlay(
  scene: Phaser.Scene,
  onRetry: () => void,
  callout?: BattleResultCallout,
): void {
  const c = scene.add.container(0, 0).setDepth(70);
  c.add(buildOverlayDim(scene, 0x1a0000, 0.5));

  const PW = 310, PH = callout ? 286 : 208;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: DEFEAT_RED,
    accentAlpha: 1,
    glowColor: DEFEAT_RED,
    glowOpacity: 0.1,
    shadowOpacity: 0.32,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '던전 함락...', {
    fontFamily: 'sans-serif', fontSize: '20px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  const row = addInfoRow(scene, {
    x: PX + 24,
    y: PY + 64,
    w: PW - 48,
    h: 34,
    icon: '🛡',
    label: '방어 실패',
    value: '재정비 필요',
    valueColor: DEFEAT_TEXT,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: DEFEAT_RED_DARK,
  });
  addToContainer(c, ...Object.values(row));

  if (callout) {
    addBattleCalloutRow(scene, c, callout, PX + 24, PY + 108, PW - 48, 56);
  }

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + (callout ? 190 : 122), '수호자들이 물러났습니다.\n다시 방어를 준비하세요.', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK,
    align: 'center', lineSpacing: 5,
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 42,
    y: PY + PH - 58,
    w: PW - 84,
    label: '다시 준비하기',
    fillColor: DEFEAT_RED,
    hoverFillColor: 0xf57a66,
    borderColor: DEFEAT_RED_DARK,
    textColor: CASUAL_CSS.WHITE,
    onPress: () => {
      c.destroy(true);
      onRetry();
    },
  });

  animateOverlayIn(scene, c);
}

// ─── Chapter-complete overlay ─────────────────────────────────────────────────

export function showChapterCompleteOverlay(
  scene: Phaser.Scene,
): void {
  const c = scene.add.container(0, 0).setDepth(90);
  c.add(buildOverlayDim(scene, 0x000000, 0.5));

  const PW = 340, PH = 280;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: OVERLAY_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0.1,
    shadowOpacity: 0.32,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 30, '✨  Chapter 1  ✨', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 58, '메인 퀘스트 완료!', {
    fontFamily: 'sans-serif', fontSize: '24px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 96, '던전이 더욱 강해졌다.\n연구소가 개방되었습니다.', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK,
    align: 'center', lineSpacing: 6,
  }).setOrigin(0.5));

  const unlockRow = addInfoRow(scene, {
    x: PX + 32,
    y: PY + 130,
    w: PW - 64,
    h: 30,
    icon: '🔓',
    label: '신규 시설',
    value: '연구소 개방',
    valueColor: CASUAL_CSS.GOLD,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.GOLD_DK,
  });
  addToContainer(c, ...Object.values(unlockRow));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 182, '"구미호 계곡에서 이상한 소식이..."', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'italic',
  }).setOrigin(0.5));
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 204, 'Chapter 2 티저', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0.5));

  addOverlayButton(scene, c, {
    x: PX + 56,
    y: PY + PH - 60,
    w: PW - 112,
    label: '확인',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd66a,
    borderColor: CASUAL.GOLD_DK,
    textColor: CASUAL_CSS.WHITE,
    onPress: () => {
      c.destroy(true);
      scene.scene.restart();
    },
  });

  animateOverlayIn(scene, c, 0.85, 300);
}

// ─── Shared overlay helpers ───────────────────────────────────────────────────

function buildOverlayDim(
  scene: Phaser.Scene,
  fillColor: number,
  alpha: number,
): Phaser.GameObjects.Graphics {
  const dim = scene.add.graphics();
  dim.fillStyle(fillColor, alpha);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  return dim;
}

export function addBattleCalloutRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  callout: BattleResultCallout,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, w, h, 8);
  bg.fillStyle(callout.accent, 0.12);
  bg.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);
  bg.lineStyle(2, callout.accent, 0.9);
  bg.strokeRoundedRect(x, y, w, h, 8);
  bg.fillStyle(callout.accent, 0.24);
  bg.fillCircle(x + 16, y + h / 2, 10);
  container.add(bg);

  const roomSpecific = Boolean(callout.roomLabel && callout.roleLabel);
  const targetLabel = roomSpecific
    ? `${callout.roomLabel} · ${callout.roleLabel}`
    : callout.title;
  const detailLabel = roomSpecific ? callout.title : callout.body;

  container.add(scene.add.text(x + 16, y + h / 2, callout.icon, {
    fontFamily: 'sans-serif', fontSize: '11px',
  }).setOrigin(0.5));
  container.add(scene.add.text(x + 32, y + 10, '다음 수비 지시', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  container.add(scene.add.text(x + 32, y + 25, targetLabel, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  container.add(scene.add.text(x + 32, y + 43, detailLabel, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    wordWrap: roomSpecific ? undefined : { width: w - 107 },
  }).setOrigin(0, 0.5));

  const statX = x + w - 38;
  container.add(scene.add.text(statX, y + 21, callout.statValue, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0.5));
  container.add(scene.add.text(statX, y + 41, callout.statLabel, {
    fontFamily: 'sans-serif', fontSize: '10px', color: toCssColor(callout.accent), fontStyle: 'bold',
  }).setOrigin(0.5));
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function addOverlayButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly label: string;
    readonly fillColor: number;
    readonly hoverFillColor: number;
    readonly borderColor: number;
    readonly textColor: string;
    readonly onPress: () => void;
  },
): void {
  const button = addPrimaryActionButton(scene, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: 44,
    label: options.label,
    fontSize: '15px',
    fillColor: options.fillColor,
    hoverFillColor: options.hoverFillColor,
    borderColor: options.borderColor,
    hoverBorderColor: options.borderColor,
    textColor: options.textColor,
    onPress: options.onPress,
  });
  addToContainer(container, button.bg, button.text, button.zone);
}

function animateOverlayIn(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  fromScale = 0.88,
  duration = 220,
): void {
  container.setAlpha(0).setScale(fromScale);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration,
    ease: 'Back.easeOut',
  });
}

function dismissOverlay(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  onDismiss?: () => void,
): void {
  if (!container.active) return;
  container.setActive(false);
  scene.tweens.add({
    targets: container,
    alpha: 0,
    duration: 200,
    onComplete: () => {
      container.destroy(true);
      onDismiss?.();
    },
  });
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
