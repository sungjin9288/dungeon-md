/**
 * RoomPickerChrome.ts — scene-facing draw/build helpers for the trap and monster
 * picker modals. Depends on RoomPickerShared for constants/pure helpers.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  calculateRoomLoadoutStatus,
  calculateRoomMetricDelta,
  calculateRoomMetrics,
  type RoomMetricDelta,
} from '../data/dungeonMetrics';
import { ROOM_SLOT_TYPE_DEFS, type DungeonSlot, type GameState } from '../data/wisdom';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import type { RoomDetailState } from './RoomDetailOverlay';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import {
  buildRoomGrowthFeedbackStats,
  type RoomGrowthFeedbackStats,
} from './RoomGrowthFeedback';
import {
  SHEET_X,
  PICKER_SLIDE_MS,
  getRoomAccent,
  formatSigned,
  formatDeltaParts,
} from './RoomPickerShared';

// ─── Destroy helpers ──────────────────────────────────────────────────────────

export function destroyTrapPicker(
  state: RoomDetailState,
  scene?: Phaser.Scene,
  animate = false,
): void {
  const container = state.trapPickerContainer;
  state.trapPickerContainer = null;
  if (!container) return;
  if (animate && scene) {
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      y: CANVAS_HEIGHT,
      alpha: 0,
      duration: PICKER_SLIDE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => container.destroy(),
    });
  } else {
    container.destroy();
  }
}

export function destroyMonsterPicker(
  state: RoomDetailState,
  scene?: Phaser.Scene,
  animate = false,
): void {
  const container = state.monsterPickerContainer;
  state.monsterPickerContainer = null;
  if (!container) return;
  if (animate && scene) {
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      y: CANVAS_HEIGHT,
      alpha: 0,
      duration: PICKER_SLIDE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => container.destroy(),
    });
  } else {
    container.destroy();
  }
}

// ─── Sheet frame / header / room context ─────────────────────────────────────

export function addPickerSheetFrame(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  modalH: number,
  borderColor: number = CASUAL.GOLD,
): void {
  const frame = addFramedPanel(scene, {
    x: SHEET_X,
    y: 4,
    w: CANVAS_WIDTH - SHEET_X * 2,
    h: modalH - 4,
    radius: 16,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: borderColor,
    accentAlpha: 1,
    glowColor: borderColor,
    glowOpacity: 0.06,
    shadowOpacity: 0.42,
    shadowOffsetY: -2,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);
}

export function addPickerHeader(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  title: string,
  subtitle: string,
  onClose: () => void,
): void {
  c.add(scene.add.text(22, 18, title, {
    fontFamily: 'sans-serif',
    fontSize: '17px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
    stroke: '#ffffff',
    strokeThickness: 3,
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(22, 36, subtitle, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  const closeBtn = scene.add.text(CANVAS_WIDTH - 20, 16, '×', {
    fontFamily: 'sans-serif',
    fontSize: '22px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerover', () => closeBtn.setColor(CASUAL_CSS.INK));
  closeBtn.on('pointerout', () => closeBtn.setColor(CASUAL_CSS.INK_SOFT));
  closeBtn.on('pointerdown', onClose);
  c.add(closeBtn);
}

export function addPickerRoomContext(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  gs: GameState,
  slotIdx: number,
  targetLabel: string,
  accent: number,
): void {
  const slot = gs.dungeonSlots?.[slotIdx];
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === slot?.roomType);
  const roomAccent = getRoomAccent(slot, accent);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const metrics = calculateRoomMetrics(gs, slot);
  const x = 20;
  const y = 47;
  const w = CANVAS_WIDTH - 40;
  const h = 24;

  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(x + 3, y + 3, w - 6, 3, 2);
  g.lineStyle(2, roomAccent, 0.9);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(roomAccent, 1);
  g.fillRoundedRect(x + 5, y + 5, 5, h - 10, 3);
  c.add(g);

  c.add(scene.add.text(x + 16, y + h / 2, `${typeDef?.icon ?? '▣'} 방 #${slotIdx + 1} · ${typeDef?.name ?? '미설계'}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 130, y + h / 2, targetLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CASUAL_CSS.GREEN,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
    x: x + w - 134,
    y: y + 4,
    w: 88,
    h: 16,
    accent: roomAccent,
  });
  c.add(scene.add.text(x + w - 21, y + h / 2, `${metrics.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

// ─── Scroll helper ────────────────────────────────────────────────────────────

export function attachSheetListScroll(
  scene: Phaser.Scene,
  sheet: Phaser.GameObjects.Container,
  list: Phaser.GameObjects.Container,
  targetY: number,
  listY: number,
  listH: number,
  contentH: number,
): void {
  const maxScroll = Math.max(0, contentH - listH);

  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(SHEET_X, targetY + listY, CANVAS_WIDTH - SHEET_X * 2, listH);
  const mask = maskShape.createGeometryMask();
  list.setMask(mask);
  sheet.once(Phaser.GameObjects.Events.DESTROY, () => {
    list.clearMask(false);
    mask.destroy();
    maskShape.destroy();
  });

  if (maxScroll <= 0) return;

  const applyScroll = (nextY: number): void => {
    list.setY(listY + Phaser.Math.Clamp(nextY, -maxScroll, 0));
  };

  let updateButtons = (): void => {};
  const buttonY = 13;
  const upButton = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH - 104,
    y: buttonY,
    w: 30,
    h: 28,
    label: '▲',
    fontSize: '11px',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd564,
    borderColor: CASUAL.GOLD_DK,
    hoverBorderColor: CASUAL.GOLD_DK,
    textColor: '#ffffff',
    onPress: () => {
      applyScroll(list.y - listY + 128);
      updateButtons();
    },
  });
  const downButton = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH - 70,
    y: buttonY,
    w: 30,
    h: 28,
    label: '▼',
    fontSize: '11px',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd564,
    borderColor: CASUAL.GOLD_DK,
    hoverBorderColor: CASUAL.GOLD_DK,
    textColor: '#ffffff',
    onPress: () => {
      applyScroll(list.y - listY - 128);
      updateButtons();
    },
  });
  sheet.add([upButton.bg, upButton.text, upButton.zone, downButton.bg, downButton.text, downButton.zone]);

  const setButtonState = (button: ReturnType<typeof addPrimaryActionButton>, enabled: boolean): void => {
    button.bg.setAlpha(enabled ? 0.88 : 0.24);
    button.text.setAlpha(enabled ? 1 : 0.3);
    if (enabled) button.zone.setInteractive({ useHandCursor: true });
    else button.zone.disableInteractive();
  };

  updateButtons = (): void => {
    const offsetY = list.y - listY;
    setButtonState(upButton, offsetY < -1);
    setButtonState(downButton, offsetY > -maxScroll + 1);
  };
  updateButtons();
}

// ─── Card chrome ─────────────────────────────────────────────────────────────

export function addPickerCardChrome(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  enabled: boolean,
): void {
  const frame = addFramedPanel(scene, {
    x,
    y,
    w,
    h,
    radius: 12,
    fillColor: enabled ? CASUAL.PANEL : CASUAL.PANEL_SOFT,
    borderColor: enabled ? accent : CASUAL.EDGE_SOFT,
    borderAlpha: enabled ? 1 : 0.6,
    borderWidth: enabled ? 3 : 2,
    glowColor: enabled ? accent : CASUAL.EDGE_SOFT,
    glowOpacity: enabled ? 0.05 : 0.02,
    shadowOpacity: 0.24,
    shadowOffsetY: 2,
  });
  list.add([frame.shadow, frame.panel, frame.glow]);

  const strip = scene.add.graphics();
  strip.fillStyle(accent, enabled ? 1 : 0.3);
  strip.fillRoundedRect(x + 7, y + 6, w - 14, 4, 3);
  strip.fillStyle(0xffffff, enabled ? 0.5 : 0.2);
  strip.fillRoundedRect(x + 9, y + 13, w - 18, 4, 2);
  list.add(strip);
}

export function addPickerStatusPill(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  enabled: boolean,
): void {
  const w = Math.max(38, label.length * 8 + 12);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
  g.fillRoundedRect(x, y, w, 16, 6);
  g.lineStyle(2, accent, enabled ? 0.9 : 0.4);
  g.strokeRoundedRect(x, y, w, 16, 6);
  g.fillStyle(accent, enabled ? 1 : 0.3);
  g.fillRoundedRect(x + 3, y + 3, 4, 10, 3);
  list.add(g);
  list.add(scene.add.text(x + w / 2 + 2, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

export function addPickerTinyPill(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  enabled: boolean,
): void {
  const w = Math.max(34, Math.min(70, label.length * 8 + 13));
  const g = scene.add.graphics();
  g.fillStyle(CASUAL.PANEL_SOFT, enabled ? 1 : 0.6);
  g.fillRoundedRect(x, y, w, 14, 5);
  g.lineStyle(2, accent, enabled ? 0.8 : 0.3);
  g.strokeRoundedRect(x, y, w, 14, 5);
  g.fillStyle(accent, enabled ? 1 : 0.3);
  g.fillRoundedRect(x + 3, y + 3, 4, 8, 3);
  list.add(g);
  list.add(scene.add.text(x + w / 2 + 2, y + 7, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

export function addPickerMiniBadge(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  enabled: boolean,
): void {
  const w = Math.max(28, Math.min(58, label.length * 8 + 15));
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
  g.fillRoundedRect(x, y, w, 14, 5);
  g.lineStyle(2, accent, enabled ? 0.85 : 0.3);
  g.strokeRoundedRect(x, y, w, 14, 5);
  g.fillStyle(accent, enabled ? 1 : 0.35);
  g.fillCircle(x + 8, y + 7, 2.6);
  list.add(g);
  list.add(scene.add.text(x + w / 2 + 3, y + 7, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

export function addDeltaChipRow(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  delta: RoomMetricDelta,
  enabled: boolean,
): void {
  const chips = [
    { label: '위협', value: delta.threatDelta, suffix: '', color: 0xff8a45 },
    { label: '전리품', value: delta.lootDelta, suffix: '', color: 0xe8c468 },
    { label: '준비', value: delta.readinessDelta, suffix: '%', color: 0x66c08a },
  ].filter(chip => chip.value !== 0);

  if (chips.length === 0) {
    const g = scene.add.graphics();
    g.fillStyle(CASUAL.PANEL_SOFT, enabled ? 1 : 0.6);
    g.fillRoundedRect(x, y, w, 18, 6);
    g.lineStyle(2, CASUAL.EDGE_SOFT, 0.6);
    g.strokeRoundedRect(x, y, w, 18, 6);
    list.add(g);
    list.add(scene.add.text(x + w / 2, y + 9, '변화 없음', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    return;
  }

  const gap = 4;
  const chipW = (w - gap * (chips.length - 1)) / chips.length;
  chips.forEach((chip, idx) => {
    const chipX = x + idx * (chipW + gap);
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
    g.fillRoundedRect(chipX, y, chipW, 18, 6);
    g.lineStyle(2, chip.color, enabled ? 0.85 : 0.35);
    g.strokeRoundedRect(chipX, y, chipW, 18, 6);
    g.fillStyle(chip.color, enabled ? 1 : 0.35);
    g.fillRoundedRect(chipX + 3, y + 3, 4, 12, 3);
    list.add(g);
    list.add(scene.add.text(chipX + chipW / 2 + 2, y + 9, `${chip.label} ${formatSigned(chip.value)}${chip.suffix}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
  });
}

// ─── Feedback + preview slot helpers ─────────────────────────────────────────

export function registerRoomLoadoutFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  kind: 'monster' | 'trap',
  name: string,
  icon: string,
  delta: RoomMetricDelta,
  accent: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const actionLabel = kind === 'monster' ? '수호 라인 배치' : '함정 라인 설치';
  const parts = formatDeltaParts(delta);
  const feedback = {
    kind,
    slotIdx,
    title: kind === 'monster' ? '수호자 배치 완료' : '함정 설치 완료',
    body: `${name} ${actionLabel}${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`,
    roomIcon: icon,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent,
  };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

export function previewMonsterSlot(
  slot: DungeonSlot | null | undefined,
  monsterSlotIdx: number,
  monsterId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const monsterIds = [...(slot.monsterIds ?? [])];
  monsterIds[monsterSlotIdx] = monsterId;
  return { ...slot, monsterIds };
}

export function previewTrapSlot(
  slot: DungeonSlot | null | undefined,
  trapSlotIdx: number,
  trapId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const trapIds = [...(slot.trapIds ?? [])];
  trapIds[trapSlotIdx] = trapId;
  return { ...slot, trapIds };
}

// ─── Preview delta / growth stats ────────────────────────────────────────────

export function getPreviewDelta(
  gs: GameState,
  slotIdx: number,
  previewSlot: DungeonSlot | null,
): RoomMetricDelta {
  return calculateRoomMetricDelta(gs, gs.dungeonSlots?.[slotIdx], previewSlot);
}

export function getPreviewGrowthStats(
  gs: GameState,
  slotIdx: number,
  previewSlot: DungeonSlot | null,
): RoomGrowthFeedbackStats {
  return buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(gs, gs.dungeonSlots?.[slotIdx]),
    calculateRoomMetrics(gs, previewSlot),
  );
}

