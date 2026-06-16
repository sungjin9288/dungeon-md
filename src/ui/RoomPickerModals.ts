/**
 * RoomPickerModals — trap picker and monster picker modals for the room detail overlay.
 * Extracted from RoomDetailOverlay (lines 598-823).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { EQUIPMENT_DEFS, getMonsterAtk } from '../data/barracks';
import { assignMonsterToRoomSlot, installTrapInRoomSlot } from '../data/roomSlotTransactions';
import {
  calculateRoomLoadoutStatus,
  calculateRoomMetricDelta,
  calculateRoomMetrics,
  type RoomMetricDelta,
} from '../data/dungeonMetrics';
import { MONSTER_DEFS } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import {
  ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot,
  type GameState,
} from '../data/wisdom';
import { logger } from '../utils/logger';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import type { RoomDetailState, RoomDetailCallbacks } from './RoomDetailOverlay';
import type { DungeonTheme } from '../themes/themes';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback,
  type RoomGrowthFeedbackStats,
} from './RoomGrowthFeedback';

/** Callbacks injected to avoid circular imports. */
export interface PickerNavCallbacks {
  closeRoomDetail: (state: RoomDetailState, cb: RoomDetailCallbacks) => void;
  openRoomDetail: (
    scene: Phaser.Scene,
    state: RoomDetailState,
    theme: DungeonTheme,
    cb: RoomDetailCallbacks,
    slotIdx: number,
    cellX: number,
    cellY: number,
  ) => void;
}

const SHEET_X = 8;
const SHEET_PAD_X = 12;
const SHEET_HEADER_H = 78;
const SHEET_BOTTOM_PAD = 14;
const ROW_GAP = 8;
const PICKER_SLIDE_MS = 220;

const MONSTER_TYPE_LABEL: Record<string, string> = {
  melee: '근접',
  ranged: '원거리',
  magic: '마법',
  support: '지원',
};

const MONSTER_TYPE_ACCENT: Record<string, number> = {
  melee: 0xd65a42,
  ranged: 0x5fb7ff,
  magic: 0x9a6cd8,
  support: 0x65e0a0,
};

const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat: 0xb64a3a,
  trap: 0xc8921a,
  support: 0x44aa77,
  magic: 0x7f66cc,
};

const PICKER_MONSTER_RARITY_META = {
  C: { stars: '★', color: 0x8aa4aa, css: '#8aa4aa' },
  U: { stars: '★★', color: 0x65e0a0, css: '#65e0a0' },
  R: { stars: '★★★', color: 0x5fb7ff, css: '#5fb7ff' },
  E: { stars: '★★★★', color: 0xc58cff, css: '#c58cff' },
  L: { stars: '★★★★★', color: 0xe8c468, css: '#ffd166' },
} as const;

const MONSTER_ROOM_FIT: Record<string, Partial<Record<string, string>>> = {
  combat: {
    melee: '전열 핵심',
    ranged: '후열 화력',
  },
  trap: {
    ranged: '함정 보조',
    magic: '제압 보조',
    support: '유지 보조',
  },
  support: {
    support: '지원 적합',
    magic: '버프 연계',
  },
  magic: {
    magic: '마력 적합',
    support: '쿨감 연계',
  },
};

const TRAP_ROOM_FIT: Record<string, Partial<Record<string, string>>> = {
  combat: {
    slow_trap: '진입 제어',
    spike_trap: '초반 피해',
  },
  trap: {
    stun_trap: '핵심 제압',
    poison_trap: '지속 피해',
    slow_trap: '동선 제어',
  },
  support: {
    slow_trap: '보호 동선',
    stun_trap: '긴급 제압',
  },
  magic: {
    stun_trap: '시전 보호',
    poison_trap: '마력 압박',
  },
};

function destroyTrapPicker(
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

function destroyMonsterPicker(
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

function addPickerSheetFrame(
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

function addPickerHeader(
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

function addPickerRoomContext(
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

function getRoomAccent(slot: DungeonSlot | null | undefined, fallback: number): number {
  return slot?.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? fallback : fallback;
}

function attachSheetListScroll(
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

function fitPickerLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function addPickerCardChrome(
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

function addPickerStatusPill(
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

function addPickerTinyPill(
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

function addPickerMiniBadge(
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

function addDeltaChipRow(
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

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDeltaParts(delta: RoomMetricDelta): string[] {
  return [
    delta.threatDelta !== 0 ? `위협 ${formatSigned(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSigned(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSigned(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
}

function registerRoomLoadoutFeedback(
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

function previewMonsterSlot(
  slot: DungeonSlot | null | undefined,
  monsterSlotIdx: number,
  monsterId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const monsterIds = [...(slot.monsterIds ?? [])];
  monsterIds[monsterSlotIdx] = monsterId;
  return { ...slot, monsterIds };
}

function previewTrapSlot(
  slot: DungeonSlot | null | undefined,
  trapSlotIdx: number,
  trapId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const trapIds = [...(slot.trapIds ?? [])];
  trapIds[trapSlotIdx] = trapId;
  return { ...slot, trapIds };
}

function getPreviewDelta(
  gs: GameState,
  slotIdx: number,
  previewSlot: DungeonSlot | null,
): RoomMetricDelta {
  return calculateRoomMetricDelta(gs, gs.dungeonSlots?.[slotIdx], previewSlot);
}

function getPreviewGrowthStats(
  gs: GameState,
  slotIdx: number,
  previewSlot: DungeonSlot | null,
): RoomGrowthFeedbackStats {
  return buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(gs, gs.dungeonSlots?.[slotIdx]),
    calculateRoomMetrics(gs, previewSlot),
  );
}

function getMonsterRoomFitLabel(slot: DungeonSlot | null | undefined, monsterType: string): string {
  if (!slot?.roomType) return MONSTER_TYPE_LABEL[monsterType] ?? '전투';
  return MONSTER_ROOM_FIT[slot.roomType]?.[monsterType]
    ?? MONSTER_TYPE_LABEL[monsterType]
    ?? '전투';
}

function getTrapRoomFitLabel(slot: DungeonSlot | null | undefined, trapId: string): string {
  if (!slot?.roomType) return '기본 설비';
  return TRAP_ROOM_FIT[slot.roomType]?.[trapId]
    ?? (slot.roomType === 'trap' ? '함정실 보정' : '보조 설비');
}

function getEquipmentIcon(gs: GameState, equipmentId: string | null | undefined): string | null {
  if (!equipmentId) return null;
  return EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId)?.icon
    ?? gs.craftedEquipment?.find(equipment => equipment.id === equipmentId)?.emoji
    ?? '◆';
}

function getPickerMonsterRarityMeta(rarityTier: string | undefined): typeof PICKER_MONSTER_RARITY_META[keyof typeof PICKER_MONSTER_RARITY_META] {
  if (rarityTier && rarityTier in PICKER_MONSTER_RARITY_META) {
    return PICKER_MONSTER_RARITY_META[rarityTier as keyof typeof PICKER_MONSTER_RARITY_META];
  }
  return PICKER_MONSTER_RARITY_META.C;
}


// ─── Trap Picker Modal ──────────────────────────────────────────────────────

export function showTrapPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  slotIdx: number,
  trapSlotIdx: number,
): void {
  destroyTrapPicker(state);
  destroyMonsterPicker(state);

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const targetSlot = gs.dungeonSlots?.[slotIdx];
  const trapCols = 2;
  const trapCardW = (CW - SHEET_PAD_X * 2 - ROW_GAP) / trapCols;
  const trapCardH = 162;
  const trapRows = Math.ceil(TRAP_DEFS.length / trapCols);
  const contentH = trapRows * trapCardH + Math.max(0, trapRows - 1) * ROW_GAP;
  const modalH = Math.min(SHEET_HEADER_H + contentH + SHEET_BOTTOM_PAD, CH - 112);
  const listY = SHEET_HEADER_H;
  const listH = modalH - SHEET_HEADER_H - SHEET_BOTTOM_PAD;
  const targetY = CH - modalH;
  const c = scene.add.container(0, CH).setDepth(110);  // starts offscreen bottom
  state.trapPickerContainer = c;

  addPickerSheetFrame(scene, c, modalH, CASUAL.GOLD);
  addPickerHeader(
    scene,
    c,
    '함정 선택',
    `슬롯 ${trapSlotIdx + 1} · 보유 ${gs.homeGold.toLocaleString('ko-KR')}g`,
    () => destroyTrapPicker(state, scene, true),
  );
  addPickerRoomContext(scene, c, gs, slotIdx, `T 슬롯 ${trapSlotIdx + 1}`, CASUAL.GOLD);

  const list = scene.add.container(0, listY);
  c.add(list);

  TRAP_DEFS.forEach((trap, index) => {
    const col = index % trapCols;
    const row = Math.floor(index / trapCols);
    const cardX = SHEET_PAD_X + col * (trapCardW + ROW_GAP);
    const cardY = row * (trapCardH + ROW_GAP);
    const locked = gs.dmLevel < trap.unlockLv;
    const canAfford = gs.homeGold >= trap.cost;
    const enabled = !locked && canAfford;
    const accent = enabled ? CASUAL.GOLD : locked ? CASUAL.EDGE_SOFT : CASUAL.RED;
    const fitLabel = getTrapRoomFitLabel(targetSlot, trap.id);
    const delta = getPreviewDelta(
      gs,
      slotIdx,
      previewTrapSlot(gs.dungeonSlots?.[slotIdx], trapSlotIdx, trap.id),
    );
    addPickerCardChrome(scene, list, cardX, cardY, trapCardW, trapCardH, accent, enabled);
    addPickerStatusPill(
      scene,
      list,
      cardX + 10,
      cardY + 15,
      locked ? `Lv.${trap.unlockLv}` : canAfford ? '설치 가능' : '골드 부족',
      accent,
      enabled,
    );
    addPickerTinyPill(
      scene,
      list,
      cardX + trapCardW - 76,
      cardY + 15,
      fitLabel,
      accent,
      enabled,
    );
    addPickerMiniBadge(scene, list, cardX + 10, cardY + 37, `T${trapSlotIdx + 1}`, accent, enabled);

    const alpha = enabled ? 1 : 0.42;
    const iconBg = scene.add.graphics();
    iconBg.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
    iconBg.fillCircle(cardX + trapCardW / 2, cardY + 48, 27);
    iconBg.lineStyle(2.5, accent, enabled ? 0.9 : 0.4);
    iconBg.strokeCircle(cardX + trapCardW / 2, cardY + 48, 27);
    iconBg.fillStyle(accent, enabled ? 0.18 : 0.08);
    iconBg.fillCircle(cardX + trapCardW / 2, cardY + 48, 18);
    list.add(iconBg);
    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 48, trap.emoji, {
      fontFamily: 'sans-serif', fontSize: '25px',
    }).setOrigin(0.5).setAlpha(alpha));

    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 80, fitPickerLabel(trap.name, 8), {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    list.add(scene.add.text(cardX + trapCardW / 2, cardY + 96, locked ? `DM Lv.${trap.unlockLv}` : `${trap.cost}g · ${trap.desc}`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: enabled ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.6));
    addDeltaChipRow(scene, list, cardX + 10, cardY + 107, trapCardW - 20, delta, enabled);

    const label = locked ? `Lv.${trap.unlockLv}` : canAfford ? '선택' : '골드 부족';
    const pickBtn = addPrimaryActionButton(scene, {
      x: cardX + 10,
      y: cardY + trapCardH - 30,
      w: trapCardW - 20,
      h: 24,
      label,
      fontSize: locked || !canAfford ? '10px' : '11px',
      align: 'center',
      enabled,
      fillColor: CASUAL.GOLD,
      hoverFillColor: 0xffd564,
      borderColor: CASUAL.GOLD_DK,
      hoverBorderColor: CASUAL.GOLD_DK,
      textColor: '#ffffff',
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      disabledTextColor: CASUAL_CSS.INK_SOFT,
      onPress: () => {
        const freshGs = cb.getGameState();
        const previewSlot = previewTrapSlot(freshGs.dungeonSlots?.[slotIdx], trapSlotIdx, trap.id);
        const freshDelta = getPreviewDelta(
          freshGs,
          slotIdx,
          previewSlot,
        );
        const growthStats = getPreviewGrowthStats(freshGs, slotIdx, previewSlot);
        const result = installTrapInRoomSlot(freshGs, slotIdx, trapSlotIdx, trap.id);
        if (!result.ok) {
          logger.debug(`[TRAP] not enough gold (need ${trap.cost}g)`);
          return;
        }
        cb.saveAndRefresh(result.state);
        cb.markRoomChanged?.(slotIdx);
        registerRoomLoadoutFeedback(scene, slotIdx, 'trap', trap.name, trap.emoji, freshDelta, 0xc8921a, growthStats);
        showRoomGrowthFeedback(scene, freshDelta, `${trap.name} 설치 완료`, growthStats);
        logger.debug(`[TRAP] slot ${slotIdx}[${trapSlotIdx}]: ${trap.id} installed, cost: ${result.cost ?? trap.cost}g`);
        destroyTrapPicker(state);
        nav.closeRoomDetail(state, cb);
        scene.time.delayedCall(250, () => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY));
      },
    });
    list.add([pickBtn.bg, pickBtn.text, pickBtn.zone]);
  });

  attachSheetListScroll(scene, c, list, targetY, listY, listH, contentH);

  // Slide up animation
  c.setPosition(0, CH);
  scene.tweens.add({ targets: c, y: targetY, duration: PICKER_SLIDE_MS, ease: 'Quad.easeOut' });
}


// ─── Monster Picker Modal ───────────────────────────────────────────────────

export function showMonsterPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  slotIdx: number,
  monsterSlotIdx = 0,
): void {
  destroyMonsterPicker(state);
  destroyTrapPicker(state);

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const targetSlot = gs.dungeonSlots?.[slotIdx];
  const monsterRows = gs.ownedMonsters
    .map(om => {
      const omTypeId = Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id;
      const mDef = MONSTER_DEFS[omTypeId as keyof typeof MONSTER_DEFS];
      return mDef ? { om, mDef } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const monsterCols = 2;
  const monsterCardW = (CW - SHEET_PAD_X * 2 - ROW_GAP) / monsterCols;
  const monsterCardH = 170;
  const monsterCardRows = monsterRows.length > 0 ? Math.ceil(monsterRows.length / monsterCols) : 1;
  const contentH = monsterRows.length > 0
    ? monsterCardRows * monsterCardH + Math.max(0, monsterCardRows - 1) * ROW_GAP
    : 54;
  const modalH = Math.min(SHEET_HEADER_H + contentH + SHEET_BOTTOM_PAD, CH - 112);
  const listY = SHEET_HEADER_H;
  const listH = modalH - SHEET_HEADER_H - SHEET_BOTTOM_PAD;
  const targetY = CH - modalH;

  const c = scene.add.container(0, CH).setDepth(110);
  state.monsterPickerContainer = c;

  addPickerSheetFrame(scene, c, modalH, CASUAL.GREEN);
  addPickerHeader(
    scene,
    c,
    '몬스터 선택',
    `슬롯 ${monsterSlotIdx + 1} · 보유 ${monsterRows.length}체`,
    () => destroyMonsterPicker(state, scene, true),
  );
  addPickerRoomContext(scene, c, gs, slotIdx, `M 슬롯 ${monsterSlotIdx + 1}`, CASUAL.GREEN);

  const list = scene.add.container(0, listY);
  c.add(list);

  if (monsterRows.length === 0) {
    const emptyFrame = addFramedPanel(scene, {
      x: SHEET_PAD_X,
      y: 0,
      w: CW - SHEET_PAD_X * 2,
      h: 48,
      radius: 10,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      borderAlpha: 0.8,
      borderWidth: 2,
      glowOpacity: 0.02,
      shadowOpacity: 0.2,
      shadowOffsetY: 2,
    });
    list.add([emptyFrame.shadow, emptyFrame.panel, emptyFrame.glow]);
    list.add(scene.add.text(CW / 2, 24, '배치 가능한 몬스터 없음', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  monsterRows.forEach(({ om, mDef }, index) => {
    const col = index % monsterCols;
    const row = Math.floor(index / monsterCols);
    const cardX = SHEET_PAD_X + col * (monsterCardW + ROW_GAP);
    const cardY = row * (monsterCardH + ROW_GAP);
    const currentRoomMonsterIdx = gs.dungeonSlots?.[slotIdx]?.monsterIds?.findIndex(id => id === om.id) ?? -1;
    const isCurrent = currentRoomMonsterIdx === monsterSlotIdx;
    const isAssignedInCurrentRoom = currentRoomMonsterIdx >= 0 && !isCurrent;
    const assignedRoomIdx = gs.dungeonSlots?.findIndex((s, i) =>
      i !== slotIdx && (s?.monsterIds ?? []).includes(om.id),
    ) ?? -1;
    const isAssignedElsewhere = assignedRoomIdx >= 0;
    const enabled = !isCurrent && !isAssignedElsewhere;
    const accent = enabled ? mDef.accentColor : CASUAL.EDGE_SOFT;
    const typeAccent = MONSTER_TYPE_ACCENT[mDef.type] ?? mDef.accentColor;
    const roomFitLabel = getMonsterRoomFitLabel(targetSlot, mDef.type);
    const rarity = getPickerMonsterRarityMeta(mDef.rarityTier);
    const equipmentIcon = getEquipmentIcon(gs, om.equipment);
    const actualAtk = getMonsterAtk(mDef.baseDamage, om.level, om.spentSkills ?? {});
    const statusLabel = isCurrent
      ? '현재 슬롯'
      : isAssignedInCurrentRoom
        ? `이 방 M${currentRoomMonsterIdx + 1}`
        : isAssignedElsewhere
          ? `방 #${assignedRoomIdx + 1}`
          : '배치 가능';
    const delta = getPreviewDelta(
      gs,
      slotIdx,
      previewMonsterSlot(gs.dungeonSlots?.[slotIdx], monsterSlotIdx, om.id),
    );

    addPickerCardChrome(scene, list, cardX, cardY, monsterCardW, monsterCardH, accent, enabled);
    addPickerStatusPill(scene, list, cardX + 10, cardY + 15, statusLabel, accent, enabled);
    addPickerTinyPill(
      scene,
      list,
      cardX + monsterCardW - 78,
      cardY + 15,
      roomFitLabel,
      typeAccent,
      enabled,
    );
    addPickerMiniBadge(scene, list, cardX + 10, cardY + 37, rarity.stars, rarity.color, enabled);
    addPickerMiniBadge(scene, list, cardX + monsterCardW - 48, cardY + 37, `M${monsterSlotIdx + 1}`, accent, enabled);

    const alpha = enabled ? 1 : 0.42;
    const cx = cardX + monsterCardW / 2;
    const portrait = addMonsterPortrait(scene, list, cx, cardY + 54, om.id, {
      size: 60,
      frameColor: accent,
      glowColor: accent,
      bgColor: 0x070908,
      equippedSkins: gs.equippedSkins ?? {},
    });
    portrait.frame.setAlpha(alpha);
    portrait.image?.setAlpha(alpha);
    portrait.fallbackText?.setAlpha(alpha);
    if (equipmentIcon) {
      const gear = scene.add.graphics();
      gear.fillStyle(0xffffff, enabled ? 0.95 : 0.6);
      gear.fillCircle(cx + 24, cardY + 35, 10);
      gear.lineStyle(2, CASUAL.GOLD, enabled ? 0.9 : 0.35);
      gear.strokeCircle(cx + 24, cardY + 35, 10);
      gear.fillStyle(CASUAL.GOLD, enabled ? 0.2 : 0.06);
      gear.fillCircle(cx + 24, cardY + 35, 6);
      list.add(gear);
      list.add(scene.add.text(cx + 24, cardY + 35, equipmentIcon, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
      }).setOrigin(0.5).setAlpha(alpha));
    }

    list.add(scene.add.text(cx, cardY + 90, fitPickerLabel(mDef.name, 8), {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: enabled ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));
    list.add(scene.add.text(cx, cardY + 106, `Lv.${om.level} · ${MONSTER_TYPE_LABEL[mDef.type] ?? '전투'} · ATK ${actualAtk}${equipmentIcon ? ' · 장비' : ''}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: enabled ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.54));
    addDeltaChipRow(scene, list, cardX + 10, cardY + 116, monsterCardW - 20, delta, enabled);
    if ((om.skillPoints ?? 0) > 0) {
      list.add(scene.add.text(cardX + monsterCardW - 14, cardY + 23, `SP ${om.skillPoints}`, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: enabled ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5).setAlpha(enabled ? 1 : 0.54));
    }

    const label = isCurrent ? '현재' : isAssignedElsewhere ? '배치됨' : isAssignedInCurrentRoom ? '이동' : '배치';
    const pickBtn = addPrimaryActionButton(scene, {
      x: cardX + 10,
      y: cardY + monsterCardH - 30,
      w: monsterCardW - 20,
      h: 24,
      label,
      fontSize: '10px',
      enabled,
      fillColor: CASUAL.GREEN,
      hoverFillColor: 0x6fdc70,
      borderColor: CASUAL.GREEN_DK,
      hoverBorderColor: CASUAL.GREEN_DK,
      textColor: '#ffffff',
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      disabledTextColor: CASUAL_CSS.INK_SOFT,
      onPress: () => {
        const freshGs = cb.getGameState();
        const previewSlot = previewMonsterSlot(freshGs.dungeonSlots?.[slotIdx], monsterSlotIdx, om.id);
        const freshDelta = getPreviewDelta(
          freshGs,
          slotIdx,
          previewSlot,
        );
        const growthStats = getPreviewGrowthStats(freshGs, slotIdx, previewSlot);
        const result = assignMonsterToRoomSlot(freshGs, slotIdx, monsterSlotIdx, om.id);
        if (!result.ok) return;
        cb.saveAndRefresh(result.state);
        cb.markRoomChanged?.(slotIdx);
        registerRoomLoadoutFeedback(scene, slotIdx, 'monster', mDef.name, mDef.emoji, freshDelta, 0x66c08a, growthStats);
        showRoomGrowthFeedback(scene, freshDelta, `${mDef.name} 배치 완료`, growthStats);
        logger.debug(`[ROOM] slot ${slotIdx}[${monsterSlotIdx}]: ${mDef.name} (${om.id}) assigned`);
        destroyMonsterPicker(state);
        nav.closeRoomDetail(state, cb);
        scene.time.delayedCall(250, () => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY));
      },
    });
    list.add([pickBtn.bg, pickBtn.text, pickBtn.zone]);
  });

  attachSheetListScroll(scene, c, list, targetY, listY, listH, contentH);

  // Slide up
  c.setPosition(0, CH);
  scene.tweens.add({ targets: c, y: targetY, duration: PICKER_SLIDE_MS, ease: 'Quad.easeOut' });
}
