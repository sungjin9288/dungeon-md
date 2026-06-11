/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getRoomSlotCapacity, getMaxRoomLevel, getUnlockedSlots, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type GameState,
} from '../data/wisdom';
import { MONSTER_DEFS, type MonsterDef } from '../data/monsters';
import { EQUIPMENT_DEFS, getEquipmentStats, type EquipmentStats } from '../data/barracks';
import { TRAP_DEFS } from '../data/traps';
import {
  calculateRoomLoadoutStatus,
  calculateRoomMetricDelta,
  calculateRoomMetrics,
  type RoomMetricDelta,
  type RoomOperationalMetrics,
} from '../data/dungeonMetrics';
import { getRoomDesignRecommendation, type RoomDesignRecommendation } from '../data/roomDesignRecommendations';
import { getDungeonActionQueue } from '../data/roomActionRecommendations';
import {
  getMonsterLoadoutRecommendation,
  getTrapLoadoutRecommendation,
  type MonsterLoadoutRecommendation,
  type TrapLoadoutRecommendation,
} from '../data/roomLoadoutRecommendations';
import {
  assignMonsterToRoomSlot,
  changeRoomSlotType,
  ensureDungeonSlot,
  getRoomRepairCost,
  getRoomUpgradeCost,
  installTrapInRoomSlot,
  removeTrapFromRoomSlot,
  repairRoomSlot,
  upgradeRoomSlot,
} from '../data/roomSlotTransactions';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture,
} from '../themes/decorations';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton, addProgressBar } from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';
import {
  buildRoomGrowthFeedbackStats,
  showRoomGrowthFeedback,
  type RoomGrowthFeedbackStats,
} from './RoomGrowthFeedback';

export type { PickerNavCallbacks };


// ─── Layout constants (mirrored from DungeonHomeScene) ────────────────────────

const SLOT_W = 100;
const SLOT_H = 100;
const ROOM_DETAIL_CLOSE_MS = 200;
const ROOM_DETAIL_REOPEN_DELAY_MS = ROOM_DETAIL_CLOSE_MS + 50;

const MONSTER_ROW_ACCENT = 0xc8921a;
const TRAP_ROW_ACCENT = 0x8c6a24;
const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat:  0xb64a3a,
  trap:    0xc8921a,
  support: 0x44aa77,
  magic:   0x7f66cc,
};
const ROOM_TYPE_SHORT_BONUS: Record<string, string> = {
  combat:  'M+1',
  trap:    'T+1',
  support: '인접+',
  magic:   'CD-20',
};
const ROOM_TYPE_ROLE_CHIP: Record<string, string> = {
  combat:  '수호',
  trap:    '함정',
  support: '지원',
  magic:   '마법',
};

const MONSTER_TYPE_LABEL: Record<string, string> = {
  melee: '근접',
  ranged: '원거리',
  magic: '마법',
  support: '지원',
};

const MONSTER_TYPE_COLOR: Record<string, number> = {
  melee: 0xd65a42,
  ranged: 0x5fb7ff,
  magic: 0xa887ff,
  support: 0x65e0a0,
};

const MONSTER_RARITY_META = {
  C: { label: 'COMMON', stars: '★', color: 0x8aa4aa, css: '#8aa4aa' },
  U: { label: 'UNIQUE', stars: '★★', color: 0x65e0a0, css: '#65e0a0' },
  R: { label: 'RARE', stars: '★★★', color: 0x5fb7ff, css: '#5fb7ff' },
  E: { label: 'EPIC', stars: '★★★★', color: 0xc58cff, css: '#c58cff' },
  L: { label: 'LEGEND', stars: '★★★★★', color: 0xffd166, css: '#ffd166' },
} as const;

type RoomDirectiveTarget = 'type' | 'repair' | 'monster' | 'trap' | 'growth' | 'none';
type RoomDetailQueueAction = ReturnType<typeof getDungeonActionQueue>[number];

interface RoomDetailNextActionEntry {
  readonly action: RoomDetailQueueAction;
  readonly rank: number;
}

interface RoomActionHeaderStatus {
  readonly readiness: number;
  readonly monsterCount: number;
  readonly monsterCapacity: number;
  readonly trapCount: number;
  readonly trapCapacity: number;
  readonly equipmentPower: number;
}

interface RoomDirective {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly target: RoomDirectiveTarget;
  readonly accent: number;
  readonly fillColor: number;
  readonly textColor: string;
  readonly enabled?: boolean;
  readonly onPress?: () => void;
}

interface EquipmentBadge {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly effect: string;
}

interface RoomDetailReturnFeedback {
  readonly kind: 'equipment' | 'upgrade' | 'design' | 'monster' | 'trap' | 'repair';
  readonly slotIdx: number;
  readonly title: string;
  readonly body: string;
  readonly equipmentName?: string;
  readonly equipmentEmoji?: string;
  readonly roomIcon?: string;
  readonly statLabel?: string;
  readonly statBefore?: string;
  readonly statAfter?: string;
  readonly accent: number;
}

function getEquipmentEffectLabel(stats: EquipmentStats, fallback = '전투 보조'): string {
  const labels: string[] = [];
  if (stats.atkMult) labels.push(`ATK ${stats.atkMult > 0 ? '+' : ''}${Math.round(stats.atkMult * 100)}%`);
  if (stats.roomHpBonus) labels.push(`HP +${stats.roomHpBonus}`);
  if (stats.freezeChance) labels.push(`빙결 +${Math.round(stats.freezeChance * 100)}%`);
  if (stats.executeChance) labels.push(`처형 +${Math.round(stats.executeChance * 100)}%`);
  if (stats.procBonus) labels.push(`발동 +${Math.round(stats.procBonus * 100)}%`);
  if (stats.skillCdMult && stats.skillCdMult < 1) labels.push(`쿨 -${Math.round((1 - stats.skillCdMult) * 100)}%`);
  if (stats.goldMult) labels.push(`골드 +${Math.round(stats.goldMult * 100)}%`);
  if (stats.crystalMult) labels.push(`결정 +${Math.round(stats.crystalMult * 100)}%`);
  return labels.slice(0, 2).join(' · ') || fallback;
}

function formatSignedPower(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function getEquippedItem(gs: GameState, monsterId: string | null | undefined): EquipmentBadge | null {
  if (!monsterId) return null;
  const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;
  const stats = getEquipmentStats(equipmentId);
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) {
    return {
      id: equipmentId,
      icon: staticDef.icon,
      name: staticDef.name,
      effect: getEquipmentEffectLabel(stats, staticDef.desc),
    };
  }
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return craftedDef
    ? {
        id: equipmentId,
        icon: craftedDef.emoji,
        name: craftedDef.name,
        effect: getEquipmentEffectLabel(stats),
      }
    : null;
}

function consumeRoomDetailFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
): RoomDetailReturnFeedback | null {
  const raw = scene.registry.get('roomDetailFeedback') as Partial<RoomDetailReturnFeedback> | undefined;
  if (!raw || (
    raw.kind !== 'equipment'
    && raw.kind !== 'upgrade'
    && raw.kind !== 'design'
    && raw.kind !== 'monster'
    && raw.kind !== 'trap'
    && raw.kind !== 'repair'
  )) return null;
  const feedbackSlotIdx = typeof raw.slotIdx === 'number' ? raw.slotIdx : Number(raw.slotIdx);
  if (feedbackSlotIdx !== slotIdx) return null;
  scene.registry.remove('roomDetailFeedback');
  if (!raw.title || !raw.body) return null;
  if (raw.kind === 'equipment' && (!raw.equipmentName || !raw.equipmentEmoji)) return null;
  return {
    kind: raw.kind,
    slotIdx: feedbackSlotIdx,
    title: raw.title,
    body: raw.body,
    equipmentName: raw.equipmentName,
    equipmentEmoji: raw.equipmentEmoji,
    roomIcon: raw.roomIcon,
    statLabel: typeof raw.statLabel === 'string' ? raw.statLabel : undefined,
    statBefore: typeof raw.statBefore === 'string' ? raw.statBefore : undefined,
    statAfter: typeof raw.statAfter === 'string' ? raw.statAfter : undefined,
    accent: typeof raw.accent === 'number' ? raw.accent : 0x88ffdd,
  };
}

function drawRoomDetailReturnFeedback(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  theme: DungeonTheme,
  feedback: RoomDetailReturnFeedback,
  x: number,
  y: number,
  w: number,
): number {
  const h = 48;
  const accent = feedback.accent;
  const icon = feedback.kind === 'equipment'
    ? feedback.equipmentEmoji ?? '⚒'
    : feedback.kind === 'design' || feedback.kind === 'monster' || feedback.kind === 'trap'
      ? feedback.roomIcon ?? '▣'
      : feedback.kind === 'repair'
        ? '🛠'
      : '★';
  const status = feedback.kind === 'equipment'
    ? '적용됨'
    : feedback.kind === 'design'
      ? '설계됨'
      : feedback.kind === 'monster'
        ? '배치됨'
        : feedback.kind === 'trap'
          ? '설치됨'
          : feedback.kind === 'repair'
            ? '복구됨'
          : '성장됨';
  const statText = feedback.statLabel && feedback.statBefore && feedback.statAfter
    ? `${feedback.statLabel} ${feedback.statBefore}→${feedback.statAfter}`
    : null;
  const g = scene.add.graphics();
  g.fillStyle(0x06100d, 0.96);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1.4, accent, 0.76);
  g.strokeRoundedRect(x, y, w, h, 10);
  g.fillStyle(accent, 0.16);
  g.fillRoundedRect(x + 7, y + 7, 5, h - 14, 4);
  g.fillCircle(x + 31, y + h / 2, 18);
  g.lineStyle(1, 0xffffff, 0.18);
  g.strokeCircle(x + 31, y + h / 2, 18);
  c.add(g);

  c.add(scene.add.text(x + 31, y + h / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '20px',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 58, y + 16, feedback.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#d8fff5',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 58, y + 33, feedback.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: theme.textSecondary,
    wordWrap: { width: statText ? w - 156 : w - 136, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));
  if (statText) {
    g.fillStyle(accent, 0.18);
    g.fillRoundedRect(x + w - 92, y + 13, 78, 22, 6);
    g.lineStyle(1, accent, 0.48);
    g.strokeRoundedRect(x + w - 92, y + 13, 78, 22, 6);
  }
  c.add(scene.add.text(x + w - 14, y + h / 2, statText ?? status, {
    fontFamily: 'sans-serif',
    fontSize: statText ? '9px' : '10px',
    color: '#b8fff0',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  g.setAlpha(0.78);
  scene.tweens.add({
    targets: g,
    alpha: 1,
    duration: 380,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  return h;
}

function drawPreBattleReturnStrip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  state: RoomDetailState,
  x: number,
  y: number,
  w: number,
): number {
  const h = 34;
  const g = scene.add.graphics();
  g.fillStyle(0x091c2a, 0.96);
  g.fillRoundedRect(x, y, w, h, 9);
  g.lineStyle(1.2, 0xffd166, 0.74);
  g.strokeRoundedRect(x, y, w, h, 9);
  g.fillStyle(0xffd166, 0.12);
  g.fillRoundedRect(x + 8, y + 7, 22, 20, 6);
  c.add(g);

  c.add(scene.add.text(x + 19, y + 17, '⚔', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#fff4d6',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 40, y + 12, '침공 편집 중', {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '10px',
    color: '#ffdf6e',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 40, y + 24, '정비 후 바로 작전판으로 돌아갈 수 있습니다.', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: theme.textSecondary,
  }).setOrigin(0, 0.5));

  const button = addPrimaryActionButton(scene, {
    x: x + w - 92,
    y: y + 5,
    w: 82,
    h: 24,
    label: '침공 복귀',
    fontSize: '9px',
    fillColor: 0x27445a,
    hoverFillColor: 0x315b78,
    borderColor: 0xffd166,
    hoverBorderColor: 0xfff0a3,
    textColor: '#fff4d6',
    onPress: () => {
      closeRoomDetail(state, cb);
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    },
  });
  c.add([button.bg, button.text, button.zone]);

  return h;
}

function drawRoomActionHeader(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  directive: RoomDirective,
  x: number,
  y: number,
  w: number,
  status: RoomActionHeaderStatus,
  nextActionEntry?: RoomDetailNextActionEntry | null,
  onNextActionPress?: () => void,
): number {
  const hasNextAction = Boolean(nextActionEntry && onNextActionPress);
  const h = hasNextAction ? 110 : 82;
  const ctaW = 88;
  const meta = getDirectiveVisualMeta(directive);
  const readinessColor = getRoomReadinessColor(status.readiness);
  const readinessCss = `#${readinessColor.toString(16).padStart(6, '0')}`;
  const g = scene.add.graphics();
  g.fillStyle(0x03070b, 0.94);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1.4, directive.accent, 0.66);
  g.strokeRoundedRect(x, y, w, h, 10);
  g.fillStyle(directive.accent, 0.12);
  g.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 8);
  g.fillStyle(0x03070b, 0.74);
  g.fillRoundedRect(x + 12, y + 12, 40, 44, 10);
  g.lineStyle(1.1, directive.accent, 0.58);
  g.strokeRoundedRect(x + 12, y + 12, 40, 44, 10);
  g.fillStyle(directive.accent, 0.20);
  g.fillCircle(x + 32, y + 34, 15);
  c.add(g);

  c.add(scene.add.text(x + 32, y + 34, meta.icon, {
    fontFamily: 'sans-serif',
    fontSize: '18px',
  }).setOrigin(0.5));

  c.add(scene.add.text(x + 60, y + 14, '던전마스터 지휘', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  g.fillStyle(directive.accent, 0.16);
  g.fillRoundedRect(x + 155, y + 6, 44, 17, 6);
  g.lineStyle(1, directive.accent, 0.36);
  g.strokeRoundedRect(x + 155, y + 6, 44, 17, 6);
  c.add(scene.add.text(x + 177, y + 14.5, meta.label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5));
  g.fillStyle(readinessColor, 0.13);
  g.fillRoundedRect(x + 203, y + 6, 58, 17, 6);
  g.lineStyle(1, readinessColor, 0.44);
  g.strokeRoundedRect(x + 203, y + 6, 58, 17, 6);
  g.fillStyle(readinessColor, 0.35);
  g.fillRoundedRect(
    x + 207,
    y + 18,
    Math.max(5, 24 * Phaser.Math.Clamp(status.readiness / 100, 0, 1)),
    2,
    1,
  );
  c.add(scene.add.text(x + 232, y + 14.5, `준비 ${status.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: readinessCss,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const miniStats = [
    { label: '수호', value: `${status.monsterCount}/${status.monsterCapacity}`, color: status.monsterCount > 0 ? '#88ffcc' : '#806040' },
    { label: '함정', value: status.trapCapacity > 0 ? `${status.trapCount}/${status.trapCapacity}` : '-', color: status.trapCount > 0 ? '#ffe080' : '#806040' },
    { label: '장비', value: status.equipmentPower > 0 ? formatSignedPower(status.equipmentPower) : '-', color: status.equipmentPower > 0 ? '#ffdf6e' : '#806040' },
  ];
  const miniY = y + 60;
  miniStats.forEach((stat, i) => {
    const chipX = x + 60 + i * 62;
    g.fillStyle(0x050806, 0.72);
    g.fillRoundedRect(chipX, miniY, 56, 16, 5);
    g.lineStyle(1, directive.accent, 0.16);
    g.strokeRoundedRect(chipX, miniY, 56, 16, 5);
    c.add(scene.add.text(chipX + 7, miniY + 8, stat.label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#8ab3aa',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(chipX + 50, miniY + 8, stat.value, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: stat.color,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
  });
  c.add(scene.add.text(x + 60, y + 32, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: directive.textColor,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 60, y + 49, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ebcae',
    wordWrap: { width: w - ctaW - 82, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  if (nextActionEntry && onNextActionPress) {
    drawNextQueuePreviewChip(scene, c, nextActionEntry, x + 12, y + 82, w - 24, onNextActionPress);
  }

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 8,
      y: y + 29,
      w: ctaW,
      h: 34,
      label: directive.ctaLabel,
      fontSize: '10px',
      enabled: directive.enabled ?? true,
      fillColor: directive.fillColor,
      hoverFillColor: directive.fillColor,
      borderColor: directive.accent,
      hoverBorderColor: 0xffdf6e,
      textColor: directive.textColor,
      onPress: directive.onPress,
    });
    c.add([button.bg, button.text, button.zone]);
    return h;
  }

  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x + w - ctaW - 8, y + 29, ctaW, 34, 7);
  g.lineStyle(1, directive.accent, 0.34);
  g.strokeRoundedRect(x + w - ctaW - 8, y + 29, ctaW, 34, 7);
  c.add(scene.add.text(x + w - ctaW / 2 - 8, y + 46, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  return h;
}

function getRoomReadinessColor(readiness: number): number {
  if (readiness >= 78) return 0x44ccaa;
  if (readiness >= 45) return 0xffc45c;
  return 0xff6b5f;
}

function drawNextQueuePreviewChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  nextActionEntry: RoomDetailNextActionEntry,
  x: number,
  y: number,
  w: number,
  onPress: () => void,
): void {
  const h = 24;
  const buttonW = 48;
  const { action, rank } = nextActionEntry;
  const g = scene.add.graphics();
  g.fillStyle(0x06110f, 0.94);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, action.accent, 0.46);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.fillStyle(action.accent, 0.16);
  g.fillRoundedRect(x + 5, y + 5, 5, h - 10, 3);
  g.fillStyle(0x071812, 0.96);
  g.fillRoundedRect(x + w - buttonW - 5, y + 2, buttonW, 20, 6);
  g.lineStyle(1, action.accent, 0.62);
  g.strokeRoundedRect(x + w - buttonW - 5, y + 2, buttonW, 20, 6);
  c.add(g);

  c.add(scene.add.text(x + 16, y + h / 2, `다음 ${rank}순 · 방 #${action.slotIdx + 1} ${action.label}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#b7ffe8',
    fontStyle: 'bold',
    wordWrap: { width: w - buttonW - 30 },
  }).setOrigin(0, 0.5));

  c.add(scene.add.text(x + w - buttonW / 2 - 5, y + h / 2, '이동', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#d8fff0',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x, y - 6, w, h + 12)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => g.setAlpha(1));
  zone.on('pointerout', () => g.setAlpha(0.94));
  zone.on('pointerdown', onPress);
  c.add(zone);
}

function getDirectiveVisualMeta(directive: RoomDirective): { icon: string; label: string } {
  switch (directive.target) {
    case 'repair':
      return { icon: '🛠', label: '내구' };
    case 'type':
      return { icon: '▣', label: '설계' };
    case 'monster':
      return { icon: '👹', label: '수호' };
    case 'trap':
      return { icon: '🕸', label: '함정' };
    case 'growth':
      return { icon: '✦', label: '성장' };
    case 'none':
    default:
      return { icon: '✓', label: '완비' };
  }
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function shouldHighlightDirectiveTarget(directive: RoomDirective, target: RoomDirectiveTarget): boolean {
  return directive.target === target;
}

function drawSectionTargetPulse(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
  chipPlacement: 'top' | 'none' = 'top',
): void {
  const g = scene.add.graphics();
  g.lineStyle(4, accent, 0.14);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 10);
  g.lineStyle(1.7, accent, 0.82);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 9);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 8);
  c.add(g);

  let chip: Phaser.GameObjects.Text | null = null;
  if (chipPlacement === 'top') {
    const chipW = Math.min(98, Math.max(58, label.length * 9 + 18));
    const chipX = x + w / 2 - chipW / 2;
    const chipY = y + 6;
    g.fillStyle(0x040908, 0.88);
    g.fillRoundedRect(chipX, chipY, chipW, 18, 6);
    g.lineStyle(1, accent, 0.66);
    g.strokeRoundedRect(chipX, chipY, chipW, 18, 6);
    chip = scene.add.text(chipX + chipW / 2, chipY + 9, label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#f5ffe8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(chip);
  }

  if (prefersReducedMotion()) return;
  scene.tweens.add({
    targets: chip ? [g, chip] : g,
    alpha: { from: 0.72, to: 1 },
    duration: 520,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
  });
}

function registerRoomUpgradeFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  previousLevel: number,
  nextLevel: number,
  previousHp: number,
  nextHp: number,
  previousCap: { monsters: number; traps: number },
  nextCap: { monsters: number; traps: number },
  stats?: RoomGrowthFeedbackStats,
): void {
  const slotDelta = [
    nextCap.monsters > previousCap.monsters ? `수호 +${nextCap.monsters - previousCap.monsters}` : null,
    nextCap.traps > previousCap.traps ? `함정 +${nextCap.traps - previousCap.traps}` : null,
  ].filter((part): part is string => Boolean(part));
  const slotText = slotDelta.length > 0 ? slotDelta.join(' · ') : '방 구조 강화';
  const feedback: RoomDetailReturnFeedback = {
    kind: 'upgrade',
    slotIdx,
    title: '방 레벨 상승',
    body: `Lv.${previousLevel}→${nextLevel} · HP ${previousHp}→${nextHp} · ${slotText}`,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent: 0xffd166,
  };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function registerRoomDesignFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  roomName: string,
  roomIcon: string,
  delta: RoomMetricDelta,
  accent: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const parts = [
    delta.threatDelta !== 0 ? `위협 ${formatSignedPower(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSignedPower(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSignedPower(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
  const feedback: RoomDetailReturnFeedback = {
    kind: 'design',
    slotIdx,
    title: '방 설계 완료',
    body: `${roomName} 역할 적용${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`,
    roomIcon,
    statLabel: stats ? '준비' : undefined,
    statBefore: stats ? `${stats.readinessBefore}%` : undefined,
    statAfter: stats ? `${stats.readinessAfter}%` : undefined,
    accent,
  };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function registerRoomRepairFeedback(
  scene: Phaser.Scene,
  slotIdx: number,
  previousHp: number,
  nextHp: number,
  cost: number,
  stats?: RoomGrowthFeedbackStats,
): void {
  const feedback: RoomDetailReturnFeedback = {
    kind: 'repair',
    slotIdx,
    title: '방 수리 완료',
    body: `HP ${previousHp}→${nextHp} · ${cost}g 사용`,
    statLabel: stats ? '위협' : undefined,
    statBefore: stats ? String(stats.threatBefore) : undefined,
    statAfter: stats ? String(stats.threatAfter) : undefined,
    accent: 0x44ccaa,
  };
  scene.registry.set('homeRoomFeedback', feedback);
  scene.registry.set('roomDetailFeedback', feedback);
}

function applyRoomRepairAction(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  fallbackSlot: DungeonSlot,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? fallbackSlot;
  const beforeMetrics = calculateRoomMetrics(freshGs, freshSlot);
  const repairCost = getRoomRepairCost(freshSlot);
  const result = repairRoomSlot(freshGs, slotIdx);
  if (!result.ok) return;

  const repairDelta = calculateRoomMetricDelta(freshGs, freshSlot, result.slot);
  const repairStats = buildRoomGrowthFeedbackStats(
    beforeMetrics,
    calculateRoomMetrics(freshGs, result.slot),
  );
  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomRepairFeedback(
    scene,
    slotIdx,
    freshSlot.hp,
    result.slot.hp,
    result.cost ?? repairCost,
    repairStats,
  );
  showRoomGrowthFeedback(scene, repairDelta, '방 내구도 복구', repairStats);
  logger.debug(`[REPAIR] slot ${slotIdx}: restored to ${result.slot.maxHp} HP (cost ${result.cost ?? repairCost}g)`);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

function applyRecommendedRoomDesign(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  recommendation: RoomDesignRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = { ...freshSlot, roomType: recommendation.roomType };
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = changeRoomSlotType(freshGs, slotIdx, recommendation.roomType);
  if (!result.ok) return;

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(def => def.id === recommendation.roomType);
  const accent = ROOM_TYPE_ACCENT[recommendation.roomType] ?? 0xc8921a;
  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomDesignFeedback(
    scene,
    slotIdx,
    typeDef?.name ?? recommendation.title,
    typeDef?.icon ?? '▣',
    freshDelta,
    accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${typeDef?.name ?? recommendation.title} 설계 적용`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
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
  const parts = [
    delta.threatDelta !== 0 ? `위협 ${formatSignedPower(delta.threatDelta)}` : null,
    delta.lootDelta !== 0 ? `전리품 ${formatSignedPower(delta.lootDelta)}` : null,
    delta.readinessDelta !== 0 ? `준비 ${formatSignedPower(delta.readinessDelta)}%` : null,
  ].filter((part): part is string => Boolean(part));
  const feedback: RoomDetailReturnFeedback = {
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

function previewMonsterLoadoutSlot(
  slot: DungeonSlot | null | undefined,
  monsterSlotIdx: number,
  monsterId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const monsterIds = Array.from({ length: cap.monsters }, (_, i) => slot.monsterIds?.[i]);
  monsterIds[monsterSlotIdx] = monsterId;
  return { ...slot, monsterIds };
}

function previewTrapLoadoutSlot(
  slot: DungeonSlot | null | undefined,
  trapSlotIdx: number,
  trapId: string,
): DungeonSlot | null {
  if (!slot) return null;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const trapIds = Array.from({ length: cap.traps }, (_, i) => slot.trapIds?.[i]);
  trapIds[trapSlotIdx] = trapId;
  return { ...slot, trapIds };
}

function applyRecommendedMonsterPlacement(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  monsterSlotIdx: number,
  recommendation: MonsterLoadoutRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = previewMonsterLoadoutSlot(freshSlot, monsterSlotIdx, recommendation.monsterId);
  if (!previewSlot) return;
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = assignMonsterToRoomSlot(freshGs, slotIdx, monsterSlotIdx, recommendation.monsterId);
  if (!result.ok) {
    logger.debug(`[ROOM] recommended monster assignment failed: ${result.reason}`);
    return;
  }

  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomLoadoutFeedback(
    scene,
    slotIdx,
    'monster',
    recommendation.name,
    recommendation.icon,
    freshDelta,
    recommendation.accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${recommendation.name} 배치 완료`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}

function applyRecommendedTrapPlacement(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  slot: DungeonSlot,
  trapSlotIdx: number,
  recommendation: TrapLoadoutRecommendation,
): void {
  const freshGs = cb.getGameState();
  const freshSlot = freshGs.dungeonSlots?.[slotIdx] ?? slot;
  const previewSlot = previewTrapLoadoutSlot(freshSlot, trapSlotIdx, recommendation.trapId);
  if (!previewSlot) return;
  const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
  const growthStats = buildRoomGrowthFeedbackStats(
    calculateRoomMetrics(freshGs, freshSlot),
    calculateRoomMetrics(freshGs, previewSlot),
  );
  const result = installTrapInRoomSlot(freshGs, slotIdx, trapSlotIdx, recommendation.trapId);
  if (!result.ok) {
    logger.debug(`[TRAP] recommended trap install failed: ${result.reason}`);
    return;
  }

  cb.saveAndRefresh(result.state);
  cb.markRoomChanged?.(slotIdx);
  registerRoomLoadoutFeedback(
    scene,
    slotIdx,
    'trap',
    recommendation.name,
    recommendation.icon,
    freshDelta,
    recommendation.accent,
    growthStats,
  );
  showRoomGrowthFeedback(scene, freshDelta, `${recommendation.name} 설치 완료`, growthStats);
  closeRoomDetail(state, cb);
  setTimeout(() => {
    openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY);
  }, ROOM_DETAIL_REOPEN_DELAY_MS);
}


// ─── Context / State ──────────────────────────────────────────────────────────

/** Mutable state managed by the overlay functions. */
export interface RoomDetailState {
  roomDetailContainer: Phaser.GameObjects.Container | null;
  trapPickerContainer: Phaser.GameObjects.Container | null;
  monsterPickerContainer: Phaser.GameObjects.Container | null;
  roomDetailSlotIdx: number | null;
  roomDetailCellX: number;
  roomDetailCellY: number;
  /** Set by openRoomDetail; used by closeRoomDetail for tween access. */
  scene: Phaser.Scene | null;
  /** Removes scroll listeners and mask objects owned by the active overlay. */
  roomDetailScrollCleanup: (() => void) | null;
}

export function createRoomDetailState(): RoomDetailState {
  return {
    roomDetailContainer: null,
    trapPickerContainer: null,
    monsterPickerContainer: null,
    roomDetailSlotIdx: null,
    roomDetailCellX: 0,
    roomDetailCellY: 0,
    scene: null,
    roomDetailScrollCleanup: null,
  };
}

export interface RoomDetailCallbacks {
  getGameState: () => GameState;
  saveAndRefresh: (state?: GameState) => void;
  rebuildDungeonSlots: () => void;
  markRoomChanged?: (slotIdx: number) => void;
  navigateToScene?: (sceneKey: string) => void;
  openRoomSlot?: (slotIdx: number) => void;
  startBattle?: () => void;
  isPreBattleEditActive?: () => boolean;
  resumePreBattle?: () => void;
}


// ─── Public API ───────────────────────────────────────────────────────────────

export function openRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  cellX: number,
  cellY: number,
): void {
  if (state.roomDetailContainer) return;

  state.scene = scene;
  const gs = cb.getGameState();

  // Store cell position for reopen after upgrade/assignment
  state.roomDetailSlotIdx = slotIdx;
  state.roomDetailCellX = cellX;
  state.roomDetailCellY = cellY;

  const prevSlots  = gs.dungeonSlots ?? [];
  let currentGs    = gs;
  if (!prevSlots[slotIdx]) {
    const result = ensureDungeonSlot(gs, slotIdx);
    if (!result.ok) return;
    currentGs = result.state;
    if (result.changed) {
      cb.saveAndRefresh(currentGs);
      cb.markRoomChanged?.(slotIdx);
    }
  }
  // Build a normalized UI copy of the slot (correct array sizes, no gs mutation)
  const rawSlot: DungeonSlot = (currentGs.dungeonSlots ?? [])[slotIdx];
  const slotCap = getRoomSlotCapacity(rawSlot.roomLevel, rawSlot.roomType);
  const slot: DungeonSlot = {
    ...rawSlot,
    monsterIds: Array.from({ length: slotCap.monsters }, (_, i) =>
      Array.isArray(rawSlot.monsterIds) ? rawSlot.monsterIds[i] : undefined,
    ),
    trapIds: Array.from({ length: slotCap.traps }, (_, i) =>
      Array.isArray(rawSlot.trapIds) ? rawSlot.trapIds[i] : undefined,
    ),
  };
  logger.debug(`[ROOM] Opening detail for slot ${slotIdx} Lv.${slot.roomLevel}`);

  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const c = scene.add.container(CW / 2, CH / 2).setDepth(100).setAlpha(0);
  state.roomDetailContainer = c;


  // ── Cave chamber background ─────────────────────────────────────────────────
  const t  = theme;
  const bg = scene.add.graphics();
  bg.fillStyle(t.stoneDark, 1);
  bg.fillRect(-CW / 2, -CH / 2, CW, CH);
  // Rock strata lines
  bg.lineStyle(1, t.stoneMid, 0.25);
  for (let ty = -CH / 2; ty < CH / 2; ty += 24) bg.lineBetween(-CW / 2, ty, CW / 2, ty);
  bg.lineStyle(1, t.stoneMid, 0.12);
  for (let tx = -CW / 2; tx < CW / 2; tx += 32) bg.lineBetween(tx, -CH / 2, tx, CH / 2);
  drawCaveWallTexture(bg, t, -CW / 2, -CH / 2, CW, CH, 99);
  // Cave wall edges
  bg.fillStyle(t.bgPrimary, 0.6);
  bg.fillRect(-CW / 2, -CH / 2, 14, CH);
  bg.fillRect(CW / 2 - 14, -CH / 2, 14, CH);
  // Stalactites at top, stalagmites at bottom
  drawStalactites(bg, t, -CH / 2 + 44, CW, 55);
  drawStalagmites(bg, t, CH / 2, CW, 66);
  c.add(bg);

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 56;
  const hdrG = scene.add.graphics();
  hdrG.fillStyle(t.panelDark, 1);
  hdrG.fillRect(-CW / 2, -CH / 2, CW, headerH);
  hdrG.lineStyle(1, t.panelBorder, 0.5);
  hdrG.lineBetween(-CW / 2, -CH / 2 + headerH, CW / 2, -CH / 2 + headerH);
  c.add(hdrG);

  const backBtn = scene.add.text(-CW / 2 + 16, -CH / 2 + headerH / 2, '← 나가기', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: t.panelBorderCSS,
  }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  backBtn.on('pointerdown', () => closeRoomDetail(state, cb));
  c.add(backBtn);

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const typeLabel = typeDef ? `${typeDef.icon} ${typeDef.name}` : '🏚 일반실';
  c.add(scene.add.text(0, -CH / 2 + headerH / 2,
    `방 #${slotIdx + 1}  ${typeLabel}  ${'★'.repeat(slot.roomLevel)}`, {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: t.textPrimary,
  }).setOrigin(0.5));

  // ── Bioluminescent glow dots ────────────────────────────────────────────────
  const glowG = scene.add.graphics();
  for (const tx of [-CW / 2 + 18, CW / 2 - 18]) {
    glowG.fillStyle(t.glowColor, 0.15);
    glowG.fillCircle(tx, -CH / 2 + headerH + 14, 12);
    glowG.fillStyle(t.glowColor, 0.35);
    glowG.fillCircle(tx, -CH / 2 + headerH + 14, 5);
  }
  c.add(glowG);

  const content = scene.add.container(0, 0);
  c.add(content);

  // ── Layout constants ──────────────────────────────────────────────────────
  const secPad = 16;
  const secX   = -CW / 2 + secPad;
  const secW   = CW - secPad * 2;
  const roomFeedback = consumeRoomDetailFeedback(scene, slotIdx);

  // ── Nav callbacks (avoids circular import with RoomPickerModals) ─────────
  const nav: PickerNavCallbacks = {
    closeRoomDetail,
    openRoomDetail,
  };

  const contentTopY = -CH / 2 + headerH + 10;
  const preBattleStripOffset = cb.isPreBattleEditActive?.() && cb.resumePreBattle
    ? drawPreBattleReturnStrip(scene, content, theme, cb, state, secX, contentTopY, secW) + 8
    : 0;
  const feedbackOffset = roomFeedback
    ? drawRoomDetailReturnFeedback(scene, content, theme, roomFeedback, secX, contentTopY + preBattleStripOffset, secW) + 8
    : 0;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const roomMetrics = calculateRoomMetrics(currentGs, slot);
  const actionDirective = getRoomDirective(scene, state, theme, cb, nav, slot, slotIdx, cap, monsterCount, trapCount, roomMetrics);
  const nextActionEntry = actionDirective.target !== 'none' && cb.openRoomSlot
    ? getNextRoomDetailAction(currentGs, slotIdx)
    : null;
  const previewY = -CH / 2 + headerH + 12 + preBattleStripOffset + feedbackOffset;
  const previewH = buildRoomInteriorPreview(
    scene, state, theme, cb, nav, content, currentGs, slot, slotIdx, secX, secW, previewY,
    actionDirective,
  );
  const actionHeaderY = previewY + previewH + 8;
  const actionHeaderH = drawRoomActionHeader(
    scene,
    content,
    actionDirective,
    secX,
    actionHeaderY,
    secW,
    {
      readiness: roomMetrics.readiness,
      monsterCount,
      monsterCapacity: cap.monsters,
      trapCount,
      trapCapacity: cap.traps,
      equipmentPower: roomMetrics.equipmentPower,
    },
    nextActionEntry,
    nextActionEntry ? () => openQueuedRoomFromDetail(scene, state, cb, nextActionEntry.action.slotIdx) : undefined,
  );
  const typeStripY = actionHeaderY + actionHeaderH + 8;

  // ── Room Type Selector strip ───────────────────────────────────────────────
  const reopen = () => {
    closeRoomDetail(state, cb);
    setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), ROOM_DETAIL_REOPEN_DELAY_MS);
  };
  const typeStripH = buildRoomTypeStrip(
    scene, state, theme, cb, content, slot, slotIdx, secX, secW, typeStripY, reopen,
    shouldHighlightDirectiveTarget(actionDirective, 'type'),
  );
  const opsY = typeStripY + typeStripH + 8;
  const opsH = buildRoomOperationsPanel(
    scene, state, theme, cb, nav, content, currentGs, slot, slotIdx, secX, secW, opsY,
    shouldHighlightDirectiveTarget(actionDirective, 'growth'),
  );
  const monSecY = opsY + opsH + 8;

  // ── Monster Section ───────────────────────────────────────────────────────
  const monSecH = buildMonsterSection(
    scene, state, theme, cb, nav, content, slot, slotIdx, secX, secW, monSecY,
    shouldHighlightDirectiveTarget(actionDirective, 'monster'),
  );

  // ── Trap Section ──────────────────────────────────────────────────────────
  const trapSecY = monSecY + monSecH + 8;
  const trapSecH = buildTrapSection(
    scene, state, theme, cb, nav, content, slot, slotIdx, secX, secW, trapSecY,
    shouldHighlightDirectiveTarget(actionDirective, 'trap'),
  );

  // ── Room growth panel ─────────────────────────────────────────────────────
  const growthY = trapSecY + trapSecH + 14;
  const hpPct = Math.max(0, slot.hp / slot.maxHp);
  const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? 0xc8921a : 0x8b0000;
  const maxRoomLv = getMaxRoomLevel(gs.dmLevel);
  const isDamaged = slot.hp < slot.maxHp;
  const canShowUpgradeButton = slot.roomLevel < 5 && slot.roomLevel < maxRoomLv;
  const growthPanelH = isDamaged ? 252 : 216;
  const growthAccent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0xc8921a : 0xc8921a;
  const growthFrame = addFramedPanel(scene, {
    x: secX,
    y: growthY,
    w: secW,
    h: growthPanelH,
    radius: 10,
    fillColor: 0x160c04,
    borderColor: growthAccent,
    borderAlpha: 0.28,
    borderWidth: 1.2,
    accentColor: growthAccent,
    accentAlpha: 0.26,
    glowColor: growthAccent,
    glowOpacity: 0.05,
    shadowOpacity: 0.28,
    shadowOffsetY: 3,
  });
  content.add([growthFrame.shadow, growthFrame.panel, growthFrame.glow]);

  const growthG = scene.add.graphics();
  growthG.fillStyle(growthAccent, 0.08);
  growthG.fillRoundedRect(secX + 10, growthY + 10, secW - 20, 30, 8);
  growthG.fillStyle(0x050806, 0.76);
  growthG.fillRoundedRect(secX + secW - 72, growthY + 14, 56, 18, 7);
  growthG.lineStyle(1, growthAccent, 0.38);
  growthG.strokeRoundedRect(secX + secW - 72, growthY + 14, 56, 18, 7);
  content.add(growthG);

  content.add(scene.add.text(secX + 18, growthY + 25, '방 성장', {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#ffe1a8',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 44, growthY + 23, `Lv.${slot.roomLevel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffdf8a',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const durabilityY = growthY + 56;
  const durabilityBar = addProgressBar(scene, {
    x: secX + 72,
    y: durabilityY,
    w: secW - 126,
    h: 14,
    ratio: hpPct,
    fillColor: barColor,
    trackColor: 0x0e0900,
    borderColor: growthAccent,
    borderAlpha: 0.32,
    duration: 320,
  });
  content.add([durabilityBar.track, durabilityBar.fill]);
  content.add(scene.add.text(secX + 18, durabilityY + 7, '내구도', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#b78954',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  content.add(scene.add.text(secX + secW - 18, durabilityY + 7, `${slot.hp}/${slot.maxHp}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: hpPct > 0.33 ? '#ffdf8a' : '#ff8a6a',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  let nextGrowthY = growthY + 86;
  if (isDamaged) {
    const missingHp = slot.maxHp - slot.hp;
    const repairCost = getRoomRepairCost(slot);
    const canRepair = gs.homeGold >= repairCost;
    const repairBtn = addPrimaryActionButton(scene, {
      x: secX + 18,
      y: nextGrowthY,
      w: secW - 36,
      h: 32,
      label: `내구 수리  ${repairCost}g  ·  HP +${missingHp}`,
      fontSize: '12px',
      enabled: canRepair,
      fillColor: 0x143010,
      hoverFillColor: 0x1c4616,
      borderColor: 0x5aaa40,
      hoverBorderColor: 0x9be66b,
      textColor: '#bbff66',
      disabledTextColor: '#664400',
      onPress: () => {
        applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot);
      },
    });
    content.add([repairBtn.bg, repairBtn.text, repairBtn.zone]);
    if (shouldHighlightDirectiveTarget(actionDirective, 'repair')) {
      drawSectionTargetPulse(scene, content, secX + 12, nextGrowthY - 4, secW - 24, 40, actionDirective.accent, '수리', 'none');
    }
    nextGrowthY += 42;
  }

  let upgradeSummary = '';
  if (canShowUpgradeButton) {
    const upgCost = getRoomUpgradeCost(slot.roomLevel);
    const newCap = getRoomSlotCapacity(slot.roomLevel + 1, slot.roomType);
    const cdBonus = ['-10%', '-20%', '-30%', '-40%'][slot.roomLevel - 1] ?? '-40%';
    const canUpgrade = gs.homeGold >= upgCost;
    upgradeSummary = `확장 시 수호 ${newCap.monsters} / 함정 ${newCap.traps}`;
    const upgBtn = addPrimaryActionButton(scene, {
      x: secX + 18,
      y: nextGrowthY,
      w: secW - 36,
      h: 42,
      label: `Lv.${slot.roomLevel} → ${slot.roomLevel + 1} 방 확장  (${upgCost}g)\n${upgradeSummary}`,
      fontSize: '12px',
      align: 'center',
      enabled: canUpgrade,
      fillColor: 0x2a1606,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      textColor: '#ffe080',
      onPress: () => {
        showRoomUpgradeConfirm(scene, upgCost, slot.roomLevel, newCap, () => {
          const freshGs = cb.getGameState();
          const freshSlot = freshGs.dungeonSlots?.[slotIdx];
          const previousLevel = freshSlot?.roomLevel ?? slot.roomLevel;
          const previousHp = freshSlot?.maxHp ?? slot.maxHp;
          const previousCap = getRoomSlotCapacity(previousLevel, freshSlot?.roomType ?? slot.roomType);
          const result = upgradeRoomSlot(freshGs, slotIdx);
          if (!result.ok) return;
          const upgradeDelta = freshSlot
            ? calculateRoomMetricDelta(freshGs, freshSlot, result.slot)
            : { threatDelta: 0, lootDelta: 0, readinessDelta: 0 };
          const upgradeStats = freshSlot
            ? buildRoomGrowthFeedbackStats(
                calculateRoomMetrics(freshGs, freshSlot),
                calculateRoomMetrics(freshGs, result.slot),
              )
            : undefined;
          cb.saveAndRefresh(result.state);
          cb.markRoomChanged?.(slotIdx);
          registerRoomUpgradeFeedback(
            scene,
            slotIdx,
            result.previousLevel ?? previousLevel,
            result.nextLevel ?? result.slot.roomLevel,
            previousHp,
            result.slot.maxHp,
            previousCap,
            getRoomSlotCapacity(result.slot.roomLevel, result.slot.roomType),
            upgradeStats,
          );
          showRoomGrowthFeedback(scene, upgradeDelta, `방 Lv.${result.nextLevel ?? result.slot.roomLevel} 확장`, upgradeStats);
          logger.debug(`[ROOM UPGRADE] slot ${slotIdx}: Lv.${result.previousLevel}→Lv.${result.nextLevel}  HP: ${freshSlot?.maxHp ?? 0}→${result.slot.maxHp}, cooldown bonus: ${cdBonus}`);
          closeRoomDetail(state, cb);
          setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, cellX, cellY), ROOM_DETAIL_REOPEN_DELAY_MS);
        });
      },
    });
    content.add([upgBtn.bg, upgBtn.text, upgBtn.zone]);
    nextGrowthY += 54;
  } else if (slot.roomLevel < 5 && slot.roomLevel >= maxRoomLv) {
    const neededDm = [5, 10, 15, 20][slot.roomLevel - 1] ?? 20;
    upgradeSummary = `DM Lv.${neededDm} 달성 후 다음 확장`;
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, `🔒 ${upgradeSummary}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#9b7650',
      fontStyle: 'bold',
      backgroundColor: '#0e0900',
      padding: { x: 10, y: 5 },
    }).setOrigin(0, 0.5));
    nextGrowthY += 36;
  } else {
    upgradeSummary = '최고 레벨 확장 완료';
    content.add(scene.add.text(secX + 18, nextGrowthY + 12, '최고 레벨 (Lv.5)', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#ffe080',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    nextGrowthY += 34;
  }

  const bonusDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === (slot.roomType ?? 'combat'));
  let contentBottom = growthY + growthPanelH + 18;
  if (bonusDef) {
    const bonusY = nextGrowthY + 2;
    const bonusH = 64;
    growthG.fillStyle(0x050806, 0.66);
    growthG.fillRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 8);
    growthG.lineStyle(1, growthAccent, 0.24);
    growthG.strokeRoundedRect(secX + 14, bonusY, secW - 28, bonusH, 8);
    growthG.fillStyle(growthAccent, 0.16);
    growthG.fillRoundedRect(secX + 22, bonusY + 10, 5, bonusH - 20, 3);
    content.add(scene.add.text(secX + 36, bonusY + 14, `${bonusDef.icon} ${bonusDef.name} 특성`, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#ffdf8a',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 36, bonusY + 34, bonusDef.bonus, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#c79b68',
      wordWrap: { width: secW - 88, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));
    content.add(scene.add.text(secX + 36, bonusY + 52, upgradeSummary || `현재 Lv.${slot.roomLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#7f6143',
    }).setOrigin(0, 0.5));
  }

  attachRoomDetailScroll(scene, state, c, content, contentBottom, headerH);

  // ── Expand animation from cell ─────────────────────────────────────────────
  const startScaleX = SLOT_W / CW;
  const startScaleY = SLOT_H / CH;
  const startX      = cellX + SLOT_W / 2 - CW / 2;
  const startY      = cellY + SLOT_H / 2 - CH / 2;
  c.setPosition(CW / 2 + startX, CH / 2 + startY).setScale(startScaleX, startScaleY);

  c.setAlpha(0);
  scene.tweens.add({
    targets: c,
    alpha: 1, scaleX: 1, scaleY: 1, x: CW / 2, y: CH / 2,
    duration: 300, ease: 'Quad.easeInOut',
  });
}

function attachRoomDetailScroll(
  scene: Phaser.Scene,
  state: RoomDetailState,
  overlay: Phaser.GameObjects.Container,
  content: Phaser.GameObjects.Container,
  contentBottom: number,
  headerH: number,
): void {
  const viewBottom = CANVAS_HEIGHT / 2 - 16;
  const maxScroll = Math.max(0, contentBottom - viewBottom);

  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(0, headerH, CANVAS_WIDTH, CANVAS_HEIGHT - headerH - 10);
  const mask = maskShape.createGeometryMask();
  content.setMask(mask);

  const applyScroll = (nextY: number): void => {
    content.setY(Phaser.Math.Clamp(nextY, -maxScroll, 0));
  };

  const isInScrollView = (pointer: Phaser.Input.Pointer): boolean =>
    pointer.x >= 0 && pointer.x <= CANVAS_WIDTH &&
    pointer.y >= headerH && pointer.y <= CANVAS_HEIGHT - 10;

  let updateButtons = (): void => {};

  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (maxScroll <= 0 || !isInScrollView(pointer)) return;
    applyScroll(content.y - deltaY * 0.45);
    updateButtons();
  };
  scene.input.on('wheel', onWheel);

  if (maxScroll > 0) {
    const buttonW = 34;
    const buttonH = 28;
    const buttonY = -CANVAS_HEIGHT / 2 + 14;
    const upButton = addPrimaryActionButton(scene, {
      x: CANVAS_WIDTH / 2 - 86,
      y: buttonY,
      w: buttonW,
      h: buttonH,
      label: '▲',
      fontSize: '12px',
      fillColor: 0x241208,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      onPress: () => {
        applyScroll(content.y + 150);
        updateButtons();
      },
    });
    const downButton = addPrimaryActionButton(scene, {
      x: CANVAS_WIDTH / 2 - 48,
      y: buttonY,
      w: buttonW,
      h: buttonH,
      label: '▼',
      fontSize: '12px',
      fillColor: 0x241208,
      hoverFillColor: 0x3a210a,
      borderColor: 0xc8921a,
      hoverBorderColor: 0xffcc44,
      onPress: () => {
        applyScroll(content.y - 150);
        updateButtons();
      },
    });
    overlay.add([upButton.bg, upButton.text, upButton.zone, downButton.bg, downButton.text, downButton.zone]);

    const setButtonState = (button: ReturnType<typeof addPrimaryActionButton>, enabled: boolean): void => {
      button.bg.setAlpha(enabled ? 0.88 : 0.24);
      button.text.setAlpha(enabled ? 1 : 0.3);
      if (enabled) button.zone.setInteractive({ useHandCursor: true });
      else button.zone.disableInteractive();
    };

    updateButtons = (): void => {
      setButtonState(upButton, content.y < -1);
      setButtonState(downButton, content.y > -maxScroll + 1);
    };
    updateButtons();
  }

  state.roomDetailScrollCleanup = () => {
    scene.input.off('wheel', onWheel);
    content.clearMask(false);
    mask.destroy();
    maskShape.destroy();
  };
}


// ─── Operations summary ──────────────────────────────────────────────────────

function buildRoomOperationsPanel(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number,
  secW: number,
  secY: number,
  highlightTarget = false,
): number {
  const canResumePreBattle = Boolean(cb.isPreBattleEditActive?.() && cb.resumePreBattle);
  const panelH = canResumePreBattle ? 188 : 178;
  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const roomMetrics = calculateRoomMetrics(gs, slot);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const directive = getRoomDirective(scene, state, theme, cb, nav, slot, slotIdx, cap, monsterCount, trapCount, roomMetrics);
  const status = slot.roomType && slot.hp <= 0
    ? '수리 필요'
    : !slot.roomType
      ? '설계 대기'
      : monsterCount > 0 || trapCount > 0
        ? '가동 중'
        : '배치 대기';

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: panelH,
    radius: 10,
    fillColor: 0x07100d,
    borderColor: 0x2f8f75,
    borderAlpha: 0.38,
    borderWidth: 1.2,
    accentColor: 0x44ccaa,
    accentAlpha: 0.34,
    glowColor: 0x44ccaa,
    glowOpacity: 0.04,
    shadowOpacity: 0.26,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, panelH, 0x44aa77, '전력 보강');
  }

  const g = scene.add.graphics();
  g.fillStyle(0x44ccaa, 0.07);
  g.fillRoundedRect(secX + 10, secY + 10, secW - 20, 28, 7);
  g.lineStyle(1, 0x2f8f75, 0.18);
  g.lineBetween(secX + 14, secY + 58, secX + secW - 14, secY + 58);
  c.add(g);

  c.add(scene.add.text(secX + 18, secY + 24, '운영 현황', {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#88ffdd',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 18, secY + 24, `${typeDef?.name ?? '미설계'} · ${status}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: slot.roomType && slot.hp <= 0 ? '#ff7766' : slot.roomType ? '#88ffcc' : '#d0a86c',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const readinessW = secW - 156;
  const readinessY = secY + 48;
  g.fillStyle(0x07100d, 1);
  g.fillRoundedRect(secX + 14, readinessY, readinessW, 8, 4);
  g.fillStyle(roomMetrics.readiness >= 70 ? 0x44ccaa : roomMetrics.readiness >= 35 ? 0xc8921a : 0x8a4c32, 0.92);
  g.fillRoundedRect(secX + 14, readinessY, Math.max(5, readinessW * roomMetrics.readiness / 100), 8, 4);
  c.add(scene.add.text(secX + 14, readinessY - 10, `준비도 ${roomMetrics.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#6f9c8c',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
    x: secX + secW - 142,
    y: secY + 39,
    w: 128,
    h: 18,
    accent: slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0x44ccaa : 0x44ccaa,
    showLabels: true,
  });

  c.add(scene.add.text(secX + 18, secY + 73, '다음 지시', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#6f9c8c',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  drawRoomDirective(scene, c, directive, secX + 14, secY + 84, secW - 28);

  const shortcutY = secY + 144;
  const shortcutW = canResumePreBattle ? (secW - 42) / 3 : (secW - 34) / 2;
  const shortcutGap = canResumePreBattle ? 7 : 6;
  const firstMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
  const addShortcut = (
    x: number,
    label: string,
    fillColor: number,
    borderColor: number,
    textColor: string,
    onPress: () => void,
  ): void => {
    const button = addPrimaryActionButton(scene, {
      x,
      y: shortcutY,
      w: shortcutW,
      h: 26,
      label,
      fontSize: '10px',
      fillColor,
      hoverFillColor: fillColor,
      borderColor,
      hoverBorderColor: 0xffdf6e,
      textColor,
      onPress,
    });
    c.add([button.bg, button.text, button.zone]);
  };

  addShortcut(secX + 14, canResumePreBattle ? '👹 성장' : '👹 성장/레벨업', 0x123a2b, 0x4ee89a, '#c8ffe0', () => {
    if (firstMonsterId) {
      navigateToFocusedMonster(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
  });
  addShortcut(secX + 14 + shortcutW + shortcutGap, canResumePreBattle ? '⚒ 장비' : '⚒ 장비 강화', 0x2e2142, 0xa887ff, '#e4d8ff', () => {
    if (firstMonsterId) {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
      return;
    }
    navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
  });
  if (canResumePreBattle) {
    addShortcut(secX + 14 + (shortcutW + shortcutGap) * 2, '⚔ 침공 복귀', 0x27445a, 0xffd166, '#fff4d6', () => {
      closeRoomDetail(state, cb);
      scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
        cb.resumePreBattle?.();
      });
    });
  }

  return panelH;
}

function getRoomDirective(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  slot: DungeonSlot,
  slotIdx: number,
  cap: { monsters: number; traps: number },
  monsterCount: number,
  trapCount: number,
  roomMetrics: RoomOperationalMetrics,
): RoomDirective {
  const firstMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  const firstTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const gs = cb.getGameState();
  const recommendation = !slot.roomType ? getRoomDesignRecommendation(gs, slotIdx) : null;

  if (slot.roomType && slot.hp <= 0) {
    const repairCost = getRoomRepairCost(slot);
    const canRepair = gs.homeGold >= repairCost;
    return {
      title: '수리 우선',
      body: `HP ${slot.hp}/${slot.maxHp} · 수리 ${repairCost}g`,
      ctaLabel: canRepair ? '즉시 수리' : '골드 부족',
      target: 'repair',
      accent: 0xff5544,
      fillColor: 0x22100c,
      textColor: '#ffb09a',
      enabled: canRepair,
      onPress: () => applyRoomRepairAction(scene, state, theme, cb, slotIdx, slot),
    };
  }

  if (!slot.roomType) {
    return {
      title: recommendation ? `${recommendation.title}` : '방 역할 설계',
      body: recommendation?.reason ?? '먼저 전투실, 함정실, 지원실, 마법실 중 역할을 정하세요.',
      ctaLabel: recommendation ? '추천 적용' : '아래에서 설계',
      target: 'type',
      accent: 0x4bd5ff,
      fillColor: 0x08151c,
      textColor: '#c8f1ff',
      onPress: recommendation
        ? () => applyRecommendedRoomDesign(scene, state, theme, cb, slotIdx, slot, recommendation)
        : undefined,
    };
  }

  if (firstMonsterSlot >= 0) {
    const monsterRecommendation = getMonsterLoadoutRecommendation(gs, slotIdx);
    if (monsterRecommendation) {
      return {
        title: '추천 수호자 배치',
        body: `${monsterRecommendation.name} · ${monsterRecommendation.reason}`,
        ctaLabel: '추천 배치',
        target: 'monster',
        accent: monsterRecommendation.accent,
        fillColor: 0x1f1208,
        textColor: '#ffe1c2',
        onPress: () => applyRecommendedMonsterPlacement(
          scene,
          state,
          theme,
          cb,
          slotIdx,
          slot,
          firstMonsterSlot,
          monsterRecommendation,
        ),
      };
    }
    return {
      title: '수호자 배치',
      body: `빈 몬스터 슬롯 ${cap.monsters - monsterCount}개가 남았습니다.`,
      ctaLabel: '즉시 배치',
      target: 'monster',
      accent: 0xff8a45,
      fillColor: 0x1f1208,
      textColor: '#ffe1c2',
      onPress: () => showMonsterPicker(scene, state, theme, cb, nav, slotIdx, firstMonsterSlot),
    };
  }

  if (cap.traps > 0 && firstTrapSlot >= 0) {
    const trapRecommendation = getTrapLoadoutRecommendation(gs, slotIdx);
    if (trapRecommendation) {
      return {
        title: '추천 함정 설치',
        body: `${trapRecommendation.name} · ${trapRecommendation.reason}`,
        ctaLabel: '추천 설치',
        target: 'trap',
        accent: trapRecommendation.accent,
        fillColor: 0x201605,
        textColor: '#ffe3a0',
        onPress: () => applyRecommendedTrapPlacement(
          scene,
          state,
          theme,
          cb,
          slotIdx,
          slot,
          firstTrapSlot,
          trapRecommendation,
        ),
      };
    }
    return {
      title: '함정 설치',
      body: `침입 경로에 빈 함정 슬롯 ${cap.traps - trapCount}개가 있습니다.`,
      ctaLabel: '즉시 설치',
      target: 'trap',
      accent: 0xc8921a,
      fillColor: 0x201605,
      textColor: '#ffe3a0',
      onPress: () => showTrapPicker(scene, state, theme, cb, nav, slotIdx, firstTrapSlot),
    };
  }

  const assignedMonsterIds = slot.monsterIds.filter((monsterId): monsterId is string =>
    typeof monsterId === 'string' && monsterId.length > 0,
  );
  const firstUnequippedMonsterId = assignedMonsterIds.find(monsterId =>
    !gs.ownedMonsters.find(monster => monster.id === monsterId)?.equipment,
  );
  if (firstUnequippedMonsterId) {
    const focusMonsterDef = MONSTER_DEFS[firstUnequippedMonsterId as keyof typeof MONSTER_DEFS] ?? null;
    return {
      title: '장비 보강',
      body: `${focusMonsterDef?.name ?? '수호자'} 장비가 비어 있습니다. 제작소에서 바로 보강하세요.`,
      ctaLabel: '장비 강화',
      target: 'growth',
      accent: 0xa887ff,
      fillColor: 0x151026,
      textColor: '#e4d8ff',
      onPress: () => navigateToFocusedForge(scene, state, cb, firstUnequippedMonsterId, slotIdx),
    };
  }

  const targetLevel = Math.max(2, gs.dmLevel - 1);
  const underleveledMonster = assignedMonsterIds
    .map(monsterId => gs.ownedMonsters.find(monster => monster.id === monsterId))
    .find(monster => monster && monster.level < targetLevel);
  if (underleveledMonster) {
    const focusMonsterDef = MONSTER_DEFS[underleveledMonster.id as keyof typeof MONSTER_DEFS] ?? null;
    return {
      title: '수호자 성장 필요',
      body: `${focusMonsterDef?.name ?? '수호자'} Lv.${underleveledMonster.level} · 목표 Lv.${targetLevel}`,
      ctaLabel: '수호자 성장',
      target: 'growth',
      accent: 0x44aa77,
      fillColor: 0x0b1b14,
      textColor: '#c8ffe0',
      onPress: () => navigateToFocusedMonster(scene, state, cb, underleveledMonster.id, slotIdx),
    };
  }

  if (roomMetrics.readiness < 78) {
    const focusMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
    const focusMonsterDef = focusMonsterId ? MONSTER_DEFS[focusMonsterId as keyof typeof MONSTER_DEFS] : null;
    return {
      title: focusMonsterDef ? '수호자 성장 필요' : '전력 보강',
      body: focusMonsterDef
        ? `${focusMonsterDef.name} 성장/장비 보강으로 방 준비도를 올리세요.`
        : '몬스터 성장이나 장비 제작으로 준비도를 더 올릴 수 있습니다.',
      ctaLabel: focusMonsterDef ? '수호자 성장' : '성장 이동',
      target: 'growth',
      accent: 0x44aa77,
      fillColor: 0x0b1b14,
      textColor: '#c8ffe0',
      onPress: () => {
        if (focusMonsterId) {
          navigateToFocusedMonster(scene, state, cb, focusMonsterId, slotIdx);
          return;
        }
        navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
      },
    };
  }

  const nextActionEntry = getNextRoomDetailAction(gs, slotIdx);
  if (nextActionEntry && cb.openRoomSlot) {
    const { action: nextAction, rank: nextActionRank } = nextActionEntry;
    return {
      title: '가동 완비',
      body: `${nextActionRank}순 작업: 방 #${nextAction.slotIdx + 1} ${nextAction.label} · ${nextAction.body}`,
      ctaLabel: `방 #${nextAction.slotIdx + 1} ${nextAction.label}`,
      target: 'none',
      accent: nextAction.accent,
      fillColor: 0x071812,
      textColor: '#b7ffe8',
      onPress: () => openQueuedRoomFromDetail(scene, state, cb, nextAction.slotIdx),
    };
  }

  if (cb.startBattle) {
    return {
      title: '전투 준비 완료',
      body: '모든 작업 큐가 비었습니다. 다음 침공 방어로 진행하세요.',
      ctaLabel: '침공 준비',
      target: 'none',
      accent: 0xffd166,
      fillColor: 0x1f1506,
      textColor: '#ffe8a6',
      onPress: () => startBattleFromRoomDetail(scene, state, cb),
    };
  }

  return {
    title: '가동 완비',
    body: '이 방은 다음 침입을 막을 준비가 끝났습니다.',
    ctaLabel: '완비',
    target: 'none',
    accent: 0x44ccaa,
    fillColor: 0x071812,
    textColor: '#b7ffe8',
  };
}

function getNextRoomDetailAction(
  state: GameState,
  currentSlotIdx: number,
): RoomDetailNextActionEntry | null {
  const unlockedSlots = getUnlockedSlots(state.dmLevel);
  const queue = getDungeonActionQueue(state, unlockedSlots);
  const index = queue.findIndex(action => action.slotIdx !== currentSlotIdx);
  if (index < 0) return null;
  return { action: queue[index], rank: index + 1 };
}

function openQueuedRoomFromDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  slotIdx: number,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.openRoomSlot?.(slotIdx);
  });
}

function startBattleFromRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 40, () => {
    cb.startBattle?.();
  });
}

function findFirstEmptySlot(ids: readonly (string | undefined)[], cap: number): number {
  for (let i = 0; i < cap; i++) {
    if (!ids[i]) return i;
  }
  return -1;
}

function drawRoomDirective(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  directive: RoomDirective,
  x: number,
  y: number,
  w: number,
): void {
  const h = 48;
  const ctaW = 86;
  const g = scene.add.graphics();
  g.fillStyle(directive.fillColor, 0.96);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(1.2, directive.accent, 0.58);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(directive.accent, 0.20);
  g.fillRoundedRect(x + 5, y + 5, 4, h - 10, 3);
  g.fillStyle(directive.accent, 0.08);
  g.fillRoundedRect(x + 13, y + 7, w - ctaW - 30, h - 14, 7);
  c.add(g);

  c.add(scene.add.text(x + 18, y + 14, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    color: directive.textColor,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + 18, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ebcae',
    wordWrap: { width: w - ctaW - 42, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  if (directive.onPress) {
    const button = addPrimaryActionButton(scene, {
      x: x + w - ctaW - 8,
      y: y + 8,
      w: ctaW,
      h: 32,
      label: directive.ctaLabel,
      fontSize: '10px',
      fillColor: directive.fillColor,
      hoverFillColor: directive.fillColor,
      borderColor: directive.accent,
      hoverBorderColor: 0xffdf6e,
      textColor: directive.textColor,
      onPress: directive.onPress,
    });
    c.add([button.bg, button.text, button.zone]);
    return;
  }

  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  g.lineStyle(1, directive.accent, 0.34);
  g.strokeRoundedRect(x + w - ctaW - 8, y + 8, ctaW, 32, 7);
  c.add(scene.add.text(x + w - ctaW / 2 - 8, y + 24, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: directive.textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function navigateFromRoomDetail(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  sceneKey: string,
): void {
  closeRoomDetail(state, cb);
  scene.time.delayedCall(ROOM_DETAIL_CLOSE_MS + 30, () => {
    if (cb.navigateToScene) {
      cb.navigateToScene(sceneKey);
      return;
    }
    scene.scene.start(sceneKey);
  });
}

function buildRoomInteriorPreview(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number,
  secW: number,
  secY: number,
  directive: RoomDirective,
): number {
  const panelH = 314;
  const accent = slot.roomType ? ROOM_TYPE_ACCENT[slot.roomType] ?? 0x44ccaa : 0x4bd5ff;
  const roomMetrics = calculateRoomMetrics(gs, slot);

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: panelH,
    radius: 10,
    fillColor: 0x0a1118,
    borderColor: accent,
    borderAlpha: 0.44,
    borderWidth: 1.3,
    accentColor: accent,
    accentAlpha: 0.28,
    glowColor: accent,
    glowOpacity: 0.06,
    shadowOpacity: 0.28,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const g = scene.add.graphics();
  c.add(g);
  const chamberX = secX + 10;
  const chamberY = secY + 32;
  const chamberW = secW - 20;
  const chamberH = 226;

  if (!slot.roomType) {
    const recommendation = getRoomDesignRecommendation(gs, slotIdx);
    const recommendedType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === recommendation.roomType);
    drawUnbuiltRoomBlueprintPreview(
      scene,
      c,
      g,
      chamberX,
      chamberY,
      chamberW,
      chamberH,
      accent,
      recommendation,
      directive,
    );
    c.add(scene.add.text(secX + 16, secY + 17, '🏗 방 설계 도면', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#d8f5ff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(scene.add.text(secX + secW - 16, secY + 17, `추천 ${recommendedType?.name ?? recommendation.title} · ${recommendation.shortLabel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#9ccbd8',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
    return panelH;
  }

  const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const monsterCount = slot.monsterIds.filter(Boolean).length;
  const trapCount = slot.trapIds.filter(Boolean).length;
  const equippedCount = slot.monsterIds
    .filter((monsterId): monsterId is string => typeof monsterId === 'string')
    .filter(monsterId => Boolean(getEquippedItem(gs, monsterId)))
    .length;

  drawInteriorChamber(scene, c, g, chamberX, chamberY, chamberW, chamberH, accent, slot);
  drawInteriorDungeonEditorDetails(g, chamberX, chamberY, chamberW, chamberH, accent, slot.roomLevel, roomMetrics.readiness);
  drawInteriorEquipmentAura(scene, c, g, chamberX, chamberY, chamberW, chamberH, roomMetrics.equipmentPower);
  drawInteriorRoomFixture(g, chamberX, chamberY, chamberW, chamberH, accent, slot.roomType, slot.roomLevel, roomMetrics.readiness);
  drawInteriorLoadoutBands(
    scene, c, g, chamberX, chamberY, chamberW, chamberH, accent,
    cap.monsters, monsterCount, cap.traps, trapCount, equippedCount, roomMetrics.readiness,
  );
  drawInteriorPlacementScaffold(
    g,
    chamberX,
    chamberY,
    chamberW,
    chamberH,
    accent,
    slot,
    cap.monsters,
    cap.traps,
    roomMetrics.readiness,
  );
  if (shouldHighlightDirectiveTarget(directive, 'type')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH * 0.54, 138, 72, directive.accent, '역할 선택');
  }
  if (shouldHighlightDirectiveTarget(directive, 'repair')) {
    drawPreviewTargetRing(scene, c, chamberX + chamberW / 2, chamberY + chamberH / 2, chamberW - 26, chamberH - 18, directive.accent, '수리 필요');
  }

  const roomIcon = typeDef?.icon ?? '🏚';
  const roomLabel = typeDef?.name ?? '일반실';
  drawInteriorRoomPlaque(
    scene,
    c,
    g,
    chamberX,
    chamberY,
    chamberW,
    accent,
    roomIcon,
    roomLabel,
    slot.roomLevel,
    roomMetrics.readiness,
    Boolean(slot.roomType && slot.hp <= 0),
  );
  c.add(scene.add.text(secX + 16, secY + 17, `${roomIcon} 방 내부 편집`, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#d8f5ff',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  const equipmentHeader = roomMetrics.equipmentPower !== 0
    ? ` · 장비 ${formatSignedPower(roomMetrics.equipmentPower)}`
    : '';
  const headerMetric = roomMetrics.threatScore > 0
    ? `${roomLabel} · 준비 ${roomMetrics.readiness}%${equipmentHeader}`
    : `${roomLabel} · 배치 ${monsterCount}/${cap.monsters}`;
  c.add(scene.add.text(secX + secW - 16, secY + 17, headerMetric, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9ccbd8',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
  const firstTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const firstMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  for (let i = 0; i < cap.traps; i++) {
    const trapId = slot.trapIds[i];
    const trap = trapId ? TRAP_DEFS.find(t => t.id === trapId) : undefined;
    const pos = getPreviewSlotPosition(i, cap.traps, chamberX + 60, chamberY + Math.round(chamberH * 0.27), chamberW - 120, 28);
    drawTrapPreviewSlot(scene, c, pos.x, pos.y, trap?.emoji ?? 'T', accent, !!trap, `T${i + 1}`);
    drawInteriorSlotActionChip(scene, c, pos.x, pos.y + 18, trap ? '교체' : '설치', trap ? 0xffc44d : accent, !!trap);
    if (shouldHighlightDirectiveTarget(directive, 'trap') && i === firstTrapSlot && !trap) {
      drawPreviewTargetRing(scene, c, pos.x, pos.y + 8, 92, 52, directive.accent, '설치');
    }
    addPreviewHitZone(scene, c, pos.x, pos.y + 8, 42, 44, () => {
      showTrapPicker(scene, state, theme, cb, nav, slotIdx, i);
    });
  }

  for (let i = 0; i < cap.monsters; i++) {
    const monsterId = slot.monsterIds[i];
    const pos = getPreviewSlotPosition(i, cap.monsters, chamberX + 58, chamberY + Math.round(chamberH * 0.68), chamberW - 116, 34);
    const owned = monsterId ? gs.ownedMonsters.find(m => m.id === monsterId) : undefined;
    const equipment = getEquippedItem(gs, monsterId);
    if (monsterId) {
      drawMonsterPreviewPedestal(scene, c, pos.x, pos.y, accent, true, `M${i + 1}`);
      addMonsterPortrait(scene, c, pos.x, pos.y, monsterId, {
        size: 38,
        frameColor: accent,
        glowColor: accent,
        bgColor: 0x061016,
        equippedSkins: gs.equippedSkins ?? {},
      });
      c.add(scene.add.text(pos.x, pos.y + 28, owned ? `Lv.${owned.level}` : '배치됨', {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: '#ffe080',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      drawInteriorSlotActionChip(scene, c, pos.x - 22, pos.y - 26, '성장', 0x44ccaa, true);
      if (equipment) {
        drawInteriorEquipmentBadge(scene, c, pos.x + 23, pos.y - 17, equipment, accent);
      } else {
        drawInteriorEquipmentSocket(scene, c, pos.x + 23, pos.y - 17, accent);
      }
    } else {
      drawMonsterPreviewPedestal(scene, c, pos.x, pos.y, accent, false, `M${i + 1}`);
      drawMonsterAnchor(scene, c, pos.x, pos.y, accent);
      drawInteriorSlotActionChip(scene, c, pos.x, pos.y + 27, '배치', accent, false);
      if (shouldHighlightDirectiveTarget(directive, 'monster') && i === firstMonsterSlot) {
        drawPreviewTargetRing(scene, c, pos.x, pos.y + 2, 98, 68, directive.accent, '배치');
      }
    }
    addPreviewHitZone(scene, c, pos.x, pos.y, 52, 64, () => {
      if (monsterId && owned) {
        navigateToFocusedMonster(scene, state, cb, monsterId, slotIdx);
        return;
      }
      showMonsterPicker(scene, state, theme, cb, nav, slotIdx, i);
    });
    if (monsterId && owned) {
      addPreviewHitZone(scene, c, pos.x + 23, pos.y - 17, 28, 26, () => {
        navigateToFocusedForge(scene, state, cb, monsterId, slotIdx);
      });
    }
  }

  drawInteriorEquipmentSummary(
    scene, state, cb, c, g, gs, slot, slotIdx,
    secX + 16, secY + panelH - 36, secW - 32, accent, monsterCount, equippedCount,
    roomMetrics.equipmentPower,
  );
  if (shouldHighlightDirectiveTarget(directive, 'growth')) {
    drawPreviewTargetRing(scene, c, secX + secW / 2, secY + panelH - 22, secW - 28, 34, directive.accent, '성장/장비');
  }

  return panelH;
}

function drawUnbuiltRoomBlueprintPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: RoomDesignRecommendation,
  directive: RoomDirective,
): void {
  const recommendedType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === recommendation.roomType);
  const blueprintX = x + 16;
  const blueprintY = y + 16;
  const blueprintW = w - 32;
  const blueprintH = h - 38;
  const centerX = x + w / 2;
  const centerY = y + h / 2 - 8;

  g.fillStyle(0x031017, 0.96);
  g.fillRoundedRect(x, y, w, h, 14);
  g.fillStyle(0x071b23, 0.88);
  g.fillRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 12);
  g.lineStyle(1.5, accent, 0.48);
  g.strokeRoundedRect(x, y, w, h, 14);
  g.lineStyle(1, 0xffffff, 0.10);
  g.strokeRoundedRect(blueprintX, blueprintY, blueprintW, blueprintH, 12);

  g.lineStyle(1, accent, 0.10);
  for (let gx = blueprintX + 22; gx < blueprintX + blueprintW - 12; gx += 22) {
    g.lineBetween(gx, blueprintY + 10, gx, blueprintY + blueprintH - 10);
  }
  for (let gy = blueprintY + 20; gy < blueprintY + blueprintH - 10; gy += 20) {
    g.lineBetween(blueprintX + 10, gy, blueprintX + blueprintW - 10, gy);
  }

  g.fillStyle(0x010608, 0.54);
  g.fillRoundedRect(x + 44, y + 52, w - 88, 94, 14);
  g.lineStyle(2, accent, 0.54);
  g.strokeRoundedRect(x + 56, y + 64, w - 112, 68, 12);
  g.lineStyle(1.2, accent, 0.34);
  g.strokeRoundedRect(x + 72, y + 78, w - 144, 40, 8);
  g.lineStyle(1, 0xffffff, 0.14);
  g.lineBetween(x + 64, y + 132, x + w - 64, y + 64);
  g.lineBetween(x + 64, y + 64, x + w - 64, y + 132);

  g.lineStyle(2, 0x8f5b2b, 0.72);
  g.lineBetween(x + 38, y + 44, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 44, x + w - 38, y + 151);
  g.lineBetween(x + 30, y + 58, x + w - 30, y + 58);
  g.lineBetween(x + 34, y + 144, x + w - 34, y + 144);
  g.lineBetween(x + 38, y + 48, x + w - 38, y + 146);
  g.lineBetween(x + w - 38, y + 48, x + 38, y + 146);
  g.lineStyle(1, 0xffcf72, 0.28);
  g.lineBetween(x + 38, y + 43, x + 38, y + 151);
  g.lineBetween(x + w - 38, y + 43, x + w - 38, y + 151);

  g.fillStyle(accent, 0.13);
  g.fillCircle(centerX, centerY, 39);
  g.lineStyle(1.4, accent, 0.44);
  g.strokeCircle(centerX, centerY, 38);
  g.strokeCircle(centerX, centerY, 24);
  g.fillStyle(0x020608, 0.82);
  g.fillRoundedRect(centerX - 72, centerY - 17, 144, 34, 10);
  g.lineStyle(1, accent, 0.36);
  g.strokeRoundedRect(centerX - 72, centerY - 17, 144, 34, 10);

  c.add(scene.add.text(centerX, centerY - 5, `${recommendedType?.icon ?? '▣'} ${recommendedType?.name ?? recommendation.title}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    color: '#d8f5ff',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(centerX, centerY + 12, recommendation.shortLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#9ccbd8',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  ROOM_SLOT_TYPE_DEFS.forEach((type, i) => {
    const optionX = x + 54 + i * ((w - 108) / Math.max(1, ROOM_SLOT_TYPE_DEFS.length - 1));
    const optionY = y + h - 54;
    const isRecommended = type.id === recommendation.roomType;
    const optionAccent = ROOM_TYPE_ACCENT[type.id] ?? accent;
    g.fillStyle(isRecommended ? optionAccent : 0x071014, isRecommended ? 0.28 : 0.82);
    g.fillRoundedRect(optionX - 31, optionY - 16, 62, 36, 9);
    g.lineStyle(isRecommended ? 1.6 : 1, optionAccent, isRecommended ? 0.78 : 0.26);
    g.strokeRoundedRect(optionX - 31, optionY - 16, 62, 36, 9);
    if (isRecommended) {
      g.fillStyle(optionAccent, 0.95);
      g.fillCircle(optionX + 23, optionY - 11, 4);
    }
    c.add(scene.add.text(optionX, optionY - 3, type.icon, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
    }).setOrigin(0.5));
    c.add(scene.add.text(optionX, optionY + 12, fitSlotLabel(type.name, 5), {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: isRecommended ? '#fff4d6' : '#7fa2a8',
      fontStyle: isRecommended ? 'bold' : 'normal',
    }).setOrigin(0.5));
  });

  const ctaW = 118;
  const ctaX = centerX - ctaW / 2;
  const ctaY = y + h - 28;
  g.fillStyle(directive.accent, 0.88);
  g.fillRoundedRect(ctaX, ctaY, ctaW, 24, 8);
  g.lineStyle(1, 0xffffff, 0.24);
  g.strokeRoundedRect(ctaX, ctaY, ctaW, 24, 8);
  c.add(scene.add.text(centerX, ctaY + 12, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#051016',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  if (directive.onPress) {
    const zone = scene.add.zone(centerX, ctaY + 12, ctaW, 26)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => directive.onPress?.());
    c.add(zone);
  }

  if (shouldHighlightDirectiveTarget(directive, 'type')) {
    drawPreviewTargetRing(scene, c, centerX, centerY + 1, 164, 58, directive.accent, '역할 선택');
  }
}

function drawInteriorEquipmentSummary(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  gs: GameState,
  slot: DungeonSlot,
  slotIdx: number,
  x: number,
  y: number,
  w: number,
  accent: number,
  monsterCount: number,
  equippedCount: number,
  equipmentPower: number,
): void {
  const firstMonsterId = slot.monsterIds.find((monsterId): monsterId is string => typeof monsterId === 'string');
  const equipmentEntries = slot.monsterIds
    .filter((monsterId): monsterId is string => typeof monsterId === 'string')
    .map(monsterId => getEquippedItem(gs, monsterId))
    .filter((equipment): equipment is EquipmentBadge => Boolean(equipment));
  const primaryEquipment = equipmentEntries[0] ?? null;
  const actionLabel = firstMonsterId ? (primaryEquipment ? '교체' : '제작') : '대기';
  const assignedMonsterIds = slot.monsterIds.filter((monsterId): monsterId is string => typeof monsterId === 'string');
  const assignedCount = Math.max(1, assignedMonsterIds.length, monsterCount);
  const fullyEquipped = firstMonsterId && equippedCount >= assignedCount;
  const statusLabel = !firstMonsterId ? 'EMPTY' : fullyEquipped ? 'READY' : 'NEED';
  const statusColor = !firstMonsterId ? 0x31443d : fullyEquipped ? 0x44ccaa : 0xffc44d;
  const text = primaryEquipment
    ? `${primaryEquipment.icon} ${primaryEquipment.name} · ${primaryEquipment.effect}${equipmentEntries.length > 1 ? ` · +${equipmentEntries.length - 1}` : ''}`
    : firstMonsterId
      ? '⚙ 장비 미장착 · 제작으로 방 전력 보강'
      : '⚙ 수호자 배치 후 장비 강화 가능';

  const railH = 30;
  const buttonW = 44;
  const buttonH = 18;
  const buttonX = x + w - buttonW - 7;
  const buttonY = y + 6;
  const pipAreaX = buttonX - 58;
  const titleX = x + 42;
  const textMaxChars = w < 310 ? 18 : 24;
  const powerLabel = equipmentPower !== 0 ? `전력 ${formatSignedPower(equipmentPower)}` : '전력 -';

  g.fillStyle(0x050806, 0.9);
  g.fillRoundedRect(x, y, w, railH, 8);
  g.lineStyle(1.2, primaryEquipment ? 0xffd166 : accent, primaryEquipment ? 0.62 : 0.32);
  g.strokeRoundedRect(x, y, w, railH, 8);
  g.fillStyle(primaryEquipment ? 0xffd166 : accent, primaryEquipment ? 0.18 : 0.1);
  g.fillRoundedRect(x + 5, y + 5, 28, railH - 10, 7);
  g.lineStyle(1, primaryEquipment ? 0xffef9c : accent, primaryEquipment ? 0.42 : 0.24);
  g.strokeRoundedRect(x + 5, y + 5, 28, railH - 10, 7);
  c.add(scene.add.text(x + 19, y + railH / 2, primaryEquipment?.icon ?? '⚙', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
  }).setOrigin(0.5));

  g.fillStyle(statusColor, firstMonsterId ? 0.2 : 0.12);
  g.fillRoundedRect(titleX, y + 4, 38, 11, 4);
  g.lineStyle(1, statusColor, firstMonsterId ? 0.5 : 0.26);
  g.strokeRoundedRect(titleX, y + 4, 38, 11, 4);
  c.add(scene.add.text(titleX + 19, y + 9.5, statusLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: firstMonsterId ? '#f5ffe7' : '#79958a',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(titleX + 44, y + 9.5, `장비 ${equippedCount}/${assignedCount}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: primaryEquipment ? '#ffdf6e' : '#7aa895',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(titleX, y + 22, fitSlotLabel(text, textMaxChars), {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: primaryEquipment ? '#fff0c2' : '#9ebcae',
  }).setOrigin(0, 0.5));

  g.fillStyle(equipmentPower > 0 ? 0xffd166 : 0x11261d, equipmentPower > 0 ? 0.22 : 0.46);
  g.fillRoundedRect(pipAreaX - 2, y + 4, 48, 10, 4);
  g.lineStyle(1, equipmentPower > 0 ? 0xffd166 : 0x38584c, equipmentPower > 0 ? 0.46 : 0.3);
  g.strokeRoundedRect(pipAreaX - 2, y + 4, 48, 10, 4);
  c.add(scene.add.text(pipAreaX + 22, y + 9, powerLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: equipmentPower > 0 ? '#ffdf6e' : '#7aa895',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const pipCount = Math.min(4, assignedCount);
  const pipGap = 11;
  const pipStartX = pipAreaX + 5;
  for (let i = 0; i < pipCount; i++) {
    const pipX = pipStartX + i * pipGap;
    const monsterId = assignedMonsterIds[i];
    const equipped = Boolean(monsterId && getEquippedItem(gs, monsterId));
    g.fillStyle(equipped ? 0xffd166 : 0x101a1a, equipped ? 0.95 : 0.78);
    g.fillRoundedRect(pipX, y + 18, 8, 8, 3);
    g.lineStyle(1, equipped ? 0xffef9c : 0x3f6557, equipped ? 0.7 : 0.42);
    g.strokeRoundedRect(pipX, y + 18, 8, 8, 3);
    if (!equipped) {
      c.add(scene.add.text(pipX + 4, y + 22, '+', {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#6d9f8a',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  g.fillStyle(firstMonsterId ? 0x2e2142 : 0x111716, firstMonsterId ? 0.95 : 0.72);
  g.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 6);
  g.lineStyle(1, firstMonsterId ? 0xa887ff : 0x31443d, firstMonsterId ? 0.64 : 0.38);
  g.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 6);
  c.add(scene.add.text(buttonX + buttonW / 2, buttonY + buttonH / 2, actionLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: firstMonsterId ? '#e4d8ff' : '#6f8c82',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  if (firstMonsterId) {
    addPreviewHitZone(scene, c, x + w / 2, y + railH / 2, w, railH, () => {
      navigateToFocusedForge(scene, state, cb, firstMonsterId, slotIdx);
    });
  }
}

function drawInteriorLoadoutBands(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  monsterCap: number,
  monsterCount: number,
  trapCap: number,
  trapCount: number,
  equippedCount: number,
  readiness: number,
): void {
  const trapY = y + Math.round(h * 0.27);
  const guardY = y + Math.round(h * 0.68);
  const readinessColor = readiness >= 78 ? 0x44ccaa : readiness >= 45 ? 0xc8921a : 0xff6a4a;
  const floorTop = y + Math.round(h * 0.43);

  g.fillStyle(0x020405, 0.34);
  g.fillRoundedRect(x + 24, trapY - 16, w - 48, 36, 10);
  g.fillStyle(0x030608, 0.44);
  g.beginPath();
  g.moveTo(x + 34, floorTop);
  g.lineTo(x + w - 34, floorTop);
  g.lineTo(x + w - 18, y + h - 18);
  g.lineTo(x + 18, y + h - 18);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x050806, 0.56);
  g.fillRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.fillRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);
  g.lineStyle(1.1, accent, 0.20);
  g.strokeRoundedRect(x + 28, trapY - 13, w - 56, 31, 9);
  g.strokeRoundedRect(x + 24, guardY - 30, w - 48, 64, 13);

  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 34, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + w - 42, trapY - 11, 8, 27, 4);
  g.fillRoundedRect(x + 35, guardY - 27, 8, 58, 4);
  g.fillRoundedRect(x + w - 43, guardY - 27, 8, 58, 4);
  g.lineStyle(1, accent, 0.12);
  g.lineBetween(x + 42, trapY + 18, x + 52, guardY - 30);
  g.lineBetween(x + w - 42, trapY + 18, x + w - 52, guardY - 30);

  g.lineStyle(1, accent, 0.14);
  g.lineBetween(x + 40, trapY + 2, x + w - 40, trapY + 2);
  g.lineBetween(x + 43, guardY + 19, x + w - 43, guardY + 19);
  g.lineStyle(1, 0xffffff, 0.06);
  g.lineBetween(x + 56, floorTop + 14, x + 43, y + h - 25);
  g.lineBetween(x + w - 56, floorTop + 14, x + w - 43, y + h - 25);

  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(x + 38, trapY - 9, Math.max(12, (w - 76) * (trapCap > 0 ? trapCount / trapCap : 0)), 4, 2);
  g.fillRoundedRect(x + 38, guardY + 25, Math.max(12, (w - 76) * (monsterCap > 0 ? monsterCount / monsterCap : 0)), 4, 2);
  drawInteriorEquipmentTrack(g, x + w - 92, guardY - 6, equippedCount, monsterCap, accent);

  c.add(scene.add.text(x + 42, trapY - 2, '함정 라인', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, trapY - 2, `T ${trapCount}/${trapCap}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: trapCount > 0 ? '#ffe080' : '#56707a',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
  c.add(scene.add.text(x + 42, guardY - 20, '수호 라인', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(x + w - 42, guardY - 20, `M ${monsterCount}/${monsterCap} · E ${equippedCount}/${monsterCap}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: monsterCount > 0 ? '#ffe080' : '#56707a',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const chipX = x + w - 76;
  const chipY = y + h - 18;
  g.fillStyle(0x03070b, 0.88);
  g.fillRoundedRect(chipX, chipY, 58, 13, 5);
  g.lineStyle(1, readinessColor, 0.56);
  g.strokeRoundedRect(chipX, chipY, 58, 13, 5);
  g.fillStyle(readinessColor, 0.18);
  g.fillRoundedRect(chipX + 2, chipY + 2, Math.max(5, 54 * Phaser.Math.Clamp(readiness / 100, 0, 1)), 9, 4);
  c.add(scene.add.text(chipX + 29, chipY + 6.5, `운영 ${readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#fff0c2',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawInteriorPlacementScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  slot: DungeonSlot,
  monsterCap: number,
  trapCap: number,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const coreX = x + w / 2;
  const coreY = y + h - 27;
  const trapBusY = y + Math.round(h * 0.27) + 2;
  const guardBusY = y + Math.round(h * 0.68) + 18;

  g.lineStyle(1, accent, 0.10 + glow * 0.08);
  g.lineBetween(x + 46, trapBusY, x + w - 46, trapBusY);
  g.lineBetween(x + 50, guardBusY, x + w - 50, guardBusY);
  g.lineStyle(1, 0xffffff, 0.035 + glow * 0.025);
  g.lineBetween(coreX, y + Math.round(h * 0.44), coreX, y + h - 22);

  for (let i = 0; i < trapCap; i += 1) {
    const pos = getPreviewSlotPosition(i, trapCap, x + 60, y + Math.round(h * 0.27), w - 120, 28);
    const filled = Boolean(slot.trapIds?.[i]);
    const color = filled ? 0xffc45f : accent;
    const alpha = filled ? 0.22 + glow * 0.08 : 0.10 + glow * 0.04;

    g.lineStyle(1, color, alpha);
    g.lineBetween(pos.x, pos.y + 14, pos.x, trapBusY);
    g.lineBetween(pos.x, trapBusY, coreX + (pos.x < coreX ? -18 : 18), y + Math.round(h * 0.43));
    g.fillStyle(color, alpha * 0.68);
    g.beginPath();
    g.moveTo(pos.x, pos.y - 25);
    g.lineTo(pos.x + 29, pos.y - 6);
    g.lineTo(pos.x + 21, pos.y + 20);
    g.lineTo(pos.x - 21, pos.y + 20);
    g.lineTo(pos.x - 29, pos.y - 6);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, color, filled ? 0.30 : 0.16);
    g.strokePath();
    g.fillStyle(0x020405, 0.34);
    g.fillCircle(pos.x, pos.y + 2, 18);
    g.fillStyle(color, filled ? 0.22 : 0.10);
    g.fillCircle(pos.x, pos.y + 2, 8);
  }

  for (let i = 0; i < monsterCap; i += 1) {
    const pos = getPreviewSlotPosition(i, monsterCap, x + 58, y + Math.round(h * 0.68), w - 116, 34);
    const filled = Boolean(slot.monsterIds?.[i]);
    const color = filled ? accent : 0x4bd5ff;
    const alpha = filled ? 0.20 + glow * 0.10 : 0.08 + glow * 0.04;

    g.lineStyle(1, color, alpha);
    g.lineBetween(pos.x, pos.y + 24, pos.x, guardBusY);
    g.lineBetween(pos.x, guardBusY, coreX + (pos.x < coreX ? -22 : 22), coreY - 18);
    g.fillStyle(color, alpha * 0.64);
    g.fillEllipse(pos.x, pos.y + 15, 70, 25);
    g.lineStyle(1, color, filled ? 0.28 : 0.14);
    g.strokeEllipse(pos.x, pos.y + 15, 62, 20);
    g.strokeCircle(pos.x, pos.y + 1, filled ? 27 : 23);
    g.lineStyle(1, 0xffffff, filled ? 0.08 : 0.04);
    g.lineBetween(pos.x - 21, pos.y + 15, pos.x + 21, pos.y + 15);
    g.lineBetween(pos.x, pos.y - 8, pos.x, pos.y + 29);
    g.fillStyle(color, filled ? 0.24 : 0.12);
    g.fillCircle(pos.x - 25, pos.y + 17, 2);
    g.fillCircle(pos.x + 25, pos.y + 17, 2);
  }

  g.fillStyle(accent, 0.08 + glow * 0.08);
  g.fillCircle(coreX, coreY, 34);
  g.lineStyle(1, accent, 0.18 + glow * 0.12);
  g.strokeCircle(coreX, coreY, 27);
}

function drawInteriorEquipmentTrack(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  y: number,
  equippedCount: number,
  monsterCap: number,
  accent: number,
): void {
  const visibleCapacity = Math.min(Math.max(1, monsterCap), 4);
  g.fillStyle(0x030608, 0.76);
  g.fillRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.lineStyle(1, 0xffd166, equippedCount > 0 ? 0.38 : 0.18);
  g.strokeRoundedRect(startX - 8, y - 7, visibleCapacity * 8 + 14, 14, 5);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(startX - 5, y + 4, Math.max(5, visibleCapacity * 8 + 8), 1.5, 1);

  for (let i = 0; i < visibleCapacity; i += 1) {
    const px = startX + i * 8;
    const filled = i < equippedCount;
    g.fillStyle(filled ? 0xffd166 : 0x121a1a, filled ? 0.94 : 0.78);
    g.beginPath();
    g.moveTo(px, y - 4);
    g.lineTo(px + 4, y);
    g.lineTo(px, y + 4);
    g.lineTo(px - 4, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, filled ? 0xffd166 : accent, filled ? 0.58 : 0.24);
    g.strokeTriangle(px, y - 4, px + 4, y, px, y + 4);
    g.lineBetween(px, y + 4, px - 4, y);
    g.lineBetween(px - 4, y, px, y - 4);
  }
  if (monsterCap > visibleCapacity) {
    g.fillStyle(0xffd166, 0.46);
    g.fillCircle(startX + visibleCapacity * 8 + 2, y, 1.5);
  }
}

function drawInteriorChamber(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  slot: DungeonSlot,
): void {
  const isBroken = Boolean(slot.roomType && slot.hp <= 0);
  const backY = y + 14;
  const backH = Math.round(h * 0.42);
  const floorY = backY + backH - 4;

  g.fillStyle(0x020405, 0.99);
  g.fillRoundedRect(x, y, w, h, 14);
  g.fillStyle(isBroken ? 0x210b08 : 0x111b22, 0.90);
  g.fillRoundedRect(x + 8, y + 8, w - 16, h - 16, 12);
  g.lineStyle(1.5, isBroken ? 0xff5544 : accent, isBroken ? 0.64 : 0.45);
  g.strokeRoundedRect(x, y, w, h, 14);
  g.lineStyle(1, 0xffffff, 0.08);
  g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 11);

  g.fillStyle(0x17262d, 0.95);
  g.fillRoundedRect(x + 24, backY, w - 48, backH, 11);
  g.fillStyle(0x071014, 0.84);
  g.fillRoundedRect(x + 34, backY + 13, w - 68, backH - 18, 9);
  g.lineStyle(1, accent, 0.12);
  for (let gy = backY + 24; gy < backY + backH - 7; gy += 13) {
    g.lineBetween(x + 42, gy, x + w - 42, gy);
  }
  g.lineStyle(1, 0xffffff, 0.06);
  for (let gx = x + 56; gx < x + w - 45; gx += 34) {
    g.lineBetween(gx, backY + 18, gx - 7, backY + backH - 8);
  }

  g.fillStyle(0x071014, 0.96);
  g.beginPath();
  g.moveTo(x + 34, floorY);
  g.lineTo(x + w - 34, floorY);
  g.lineTo(x + w - 14, y + h - 18);
  g.lineTo(x + 14, y + h - 18);
  g.closePath();
  g.fillPath();
  g.fillStyle(accent, 0.07);
  g.beginPath();
  g.moveTo(x + 46, floorY + 8);
  g.lineTo(x + w - 46, floorY + 8);
  g.lineTo(x + w - 34, y + h - 28);
  g.lineTo(x + 34, y + h - 28);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, accent, 0.15);
  g.lineBetween(x + 42, floorY + 2, x + 25, y + h - 22);
  g.lineBetween(x + w - 42, floorY + 2, x + w - 25, y + h - 22);
  g.lineStyle(1, 0xffffff, 0.06);
  for (let i = 0; i < 4; i++) {
    const yy = floorY + 18 + i * 20;
    g.lineBetween(x + 36 + i * 4, yy, x + w - 36 - i * 4, yy);
  }

  const laneY = backY + 38;
  g.fillStyle(0x020506, 0.72);
  g.fillRoundedRect(x + 18, laneY - 10, w - 36, 20, 9);
  g.lineStyle(1.2, accent, 0.22);
  g.lineBetween(x + 36, laneY, x + w - 36, laneY);
  for (let i = 0; i < 5; i++) {
    const px = x + 58 + i * Math.max(32, (w - 116) / 4);
    g.fillStyle(accent, 0.16 + (i % 2) * 0.07);
    g.fillTriangle(px + 6, laneY, px - 3, laneY - 5, px - 3, laneY + 5);
  }

  g.fillStyle(0x0e171b, 1);
  g.fillRoundedRect(x - 6, y + 38, 19, 48, 6);
  g.fillRoundedRect(x + w - 13, y + 38, 19, 48, 6);
  g.fillStyle(accent, 0.26);
  g.fillRoundedRect(x, y + 50, 6, 22, 3);
  g.fillRoundedRect(x + w - 6, y + 50, 6, 22, 3);
  c.add(scene.add.text(x + 7, y + 94, 'IN', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0.74));
  c.add(scene.add.text(x + w - 7, y + 94, 'OUT', {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#6f9c8c',
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0.74));

  if (isBroken) {
    g.lineStyle(1.6, 0xff5544, 0.42);
    g.lineBetween(x + 36, y + 19, x + 76, y + 70);
    g.lineBetween(x + 76, y + 70, x + 57, y + h - 16);
    g.lineBetween(x + w - 55, y + 22, x + w - 92, y + 58);
    g.fillStyle(0xff5544, 0.08);
    g.fillRoundedRect(x + 9, y + 9, w - 18, h - 18, 10);
  }
}

function drawInteriorDungeonEditorDetails(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomLevel: number,
  readiness: number,
): void {
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const ceilingY = y + 18;
  const floorY = y + h - 38;

  g.fillStyle(0x020405, 0.58);
  g.fillRoundedRect(x + 30, y + 13, w - 60, 11, 5);
  g.fillStyle(accent, 0.08 + glow * 0.05);
  g.fillRoundedRect(x + 44, y + 16, w - 88, 4, 2);
  g.lineStyle(1, accent, 0.18 + glow * 0.08);
  for (let i = 0; i < 4; i++) {
    const xx = x + 58 + i * ((w - 116) / 3);
    g.lineBetween(xx, ceilingY, xx - 10, ceilingY + 38);
  }

  g.fillStyle(0xffc875, 0.10 + glow * 0.08);
  g.fillCircle(x + 25, y + 55, 15);
  g.fillCircle(x + w - 25, y + 55, 15);
  g.fillStyle(0xffd978, 0.48);
  g.fillCircle(x + 25, y + 55, 3);
  g.fillCircle(x + w - 25, y + 55, 3);
  g.lineStyle(1, 0xffd978, 0.22);
  g.lineBetween(x + 25, y + 58, x + 25, y + 82);
  g.lineBetween(x + w - 25, y + 58, x + w - 25, y + 82);

  g.lineStyle(1, accent, 0.12 + glow * 0.08);
  for (let i = 0; i < 3; i++) {
    const yy = floorY + i * 12;
    g.lineBetween(x + 46 + i * 7, yy, x + w - 46 - i * 7, yy);
  }
  for (let i = 0; i < 4; i++) {
    const xx = x + 64 + i * ((w - 128) / 3);
    g.lineBetween(xx, floorY - 13, xx - 16, y + h - 20);
  }

  const pipCount = Phaser.Math.Clamp(roomLevel, 1, 5);
  for (let i = 0; i < pipCount; i++) {
    const yy = y + 106 + i * 12;
    g.fillStyle(accent, 0.20 + glow * 0.12);
    g.fillCircle(x + 22, yy, 2.4);
    g.fillCircle(x + w - 22, yy, 2.4);
  }
}

function drawInteriorEquipmentAura(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  equipmentPower: number,
): void {
  if (equipmentPower <= 0) return;

  g.lineStyle(1.4, 0xffd166, 0.44);
  g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 18, 10);
  g.lineStyle(0.8, 0xffffff, 0.11);
  g.strokeRoundedRect(x + 17, y + 20, w - 34, h - 48, 8);
  g.fillStyle(0xffd166, 0.09);
  g.fillRoundedRect(x + 22, y + 18, w - 44, 5, 3);
  g.fillCircle(x + 36, y + 24, 3);
  g.fillCircle(x + w - 36, y + 24, 3);

  g.fillStyle(0x100b03, 0.92);
  g.fillRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  g.lineStyle(1, 0xffd166, 0.58);
  g.strokeRoundedRect(x + w - 104, y + 12, 82, 16, 6);
  c.add(scene.add.text(x + w - 63, y + 20, `장비 강화 +${equipmentPower}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#fff0c2',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawInteriorRoomPlaque(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  accent: number,
  icon: string,
  roomName: string,
  roomLevel: number,
  readiness: number,
  danger: boolean,
): void {
  const plaqueW = 132;
  const plaqueH = 28;
  const plaqueX = x + w / 2 - plaqueW / 2;
  const plaqueY = y + 16;
  const readinessColor = readiness >= 70 ? 0x4ee89a : readiness >= 35 ? 0xffd166 : 0xff7a5a;

  g.fillStyle(0x020405, 0.72);
  g.fillRoundedRect(plaqueX, plaqueY + 3, plaqueW, plaqueH, 8);
  g.fillStyle(danger ? 0x2a0906 : 0x07131d, 0.94);
  g.fillRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.lineStyle(1.2, danger ? 0xff5544 : accent, danger ? 0.66 : 0.46);
  g.strokeRoundedRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
  g.fillStyle(accent, danger ? 0.12 : 0.08);
  g.fillRoundedRect(plaqueX + 8, plaqueY + 6, 22, plaqueH - 12, 6);
  g.fillStyle(readinessColor, 0.16);
  g.fillRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.lineStyle(1, readinessColor, 0.34);
  g.strokeRoundedRect(plaqueX + 84, plaqueY + 7, 38, 14, 5);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(plaqueX + 36, plaqueY + 6, 40, 2, 1);

  c.add(scene.add.text(plaqueX + 19, plaqueY + plaqueH / 2, icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }).setOrigin(0.5));
  c.add(scene.add.text(plaqueX + 36, plaqueY + 12, `${roomName} Lv.${roomLevel}`, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '10px',
    color: danger ? '#ffb7a8' : '#fff3cf',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(plaqueX + 103, plaqueY + 14, `${readiness}%`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: readiness >= 35 ? '#fff0c2' : '#ffb39a',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawInteriorRoomFixture(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  roomType: string | undefined,
  roomLevel: number,
  readiness: number,
): void {
  const cx = x + w / 2;
  const cy = y + h - 26;
  const glow = 0.12 + Math.min(0.16, readiness / 800);

  g.fillStyle(accent, glow * 0.6);
  g.fillCircle(cx, cy, 26 + Math.min(10, roomLevel * 2));
  g.lineStyle(1.2, accent, glow + 0.12);

  if (roomType === 'combat') {
    g.fillStyle(0x180605, 0.54);
    g.fillRoundedRect(cx - 62, y + 42, 22, 54, 5);
    g.fillRoundedRect(cx + 40, y + 42, 22, 54, 5);
    g.fillStyle(accent, 0.23 + glow * 0.16);
    g.fillTriangle(cx - 62, y + 42, cx - 40, y + 42, cx - 51, y + 66);
    g.fillTriangle(cx + 40, y + 42, cx + 62, y + 42, cx + 51, y + 66);
    g.strokeCircle(cx, cy, 23);
    g.strokeCircle(cx, cy, 13);
    g.fillStyle(accent, 0.24);
    g.fillRoundedRect(x + 34, y + h - 25, 36, 5, 3);
    g.fillRoundedRect(x + w - 70, y + h - 25, 36, 5, 3);
    g.lineStyle(1.2, accent, 0.34);
    g.lineBetween(x + 45, y + h - 29, x + 63, y + h - 49);
    g.lineBetween(x + w - 45, y + h - 29, x + w - 63, y + h - 49);
    g.lineStyle(1.2, 0xffd8a0, 0.22 + glow * 0.08);
    g.lineBetween(cx - 18, cy - 7, cx + 18, cy - 29);
    g.lineBetween(cx - 18, cy - 29, cx + 18, cy - 7);
    return;
  }

  if (roomType === 'trap') {
    g.fillStyle(0x160d03, 0.60);
    g.fillRoundedRect(cx - 72, y + 34, 144, 30, 8);
    g.lineStyle(1, accent, 0.22 + glow * 0.14);
    for (let i = 0; i < 5; i++) {
      const sx = cx - 60 + i * 30;
      g.lineBetween(sx, y + 39, sx + 18, y + 59);
    }
    g.fillStyle(accent, 0.22);
    for (let i = 0; i < 7; i++) {
      const px = x + 53 + i * ((w - 106) / 6);
      g.fillTriangle(px - 5, y + 48, px, y + 34 - (i % 2) * 4, px + 5, y + 48);
    }
    g.lineStyle(1.2, accent, 0.38);
    g.lineBetween(x + 44, y + 49, x + w - 44, y + 49);
    g.fillStyle(accent, 0.16 + glow * 0.10);
    g.fillRoundedRect(cx - 39, cy - 11, 78, 20, 8);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(cx - 26, cy - 2, cx + 26, cy - 2);
    g.strokeCircle(cx, cy, 16);
    return;
  }

  if (roomType === 'support') {
    g.fillStyle(0x06130c, 0.58);
    g.fillEllipse(cx, cy + 7, 92, 28);
    g.lineStyle(1, accent, 0.24 + glow * 0.10);
    for (let i = 0; i < 6; i++) {
      const vx = cx - 70 + i * 28;
      g.lineBetween(vx, y + 42, vx - 6 + (i % 2) * 12, y + 82);
      g.fillCircle(vx - 4 + (i % 2) * 8, y + 76, 2.6);
    }
    g.fillStyle(accent, 0.16);
    g.fillRoundedRect(cx - 38, cy - 13, 76, 22, 9);
    g.fillStyle(accent, 0.34);
    g.fillRoundedRect(cx - 5, cy - 20, 10, 36, 5);
    g.fillRoundedRect(cx - 18, cy - 7, 36, 10, 5);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(cx - 40, cy - 15, 80, 25, 9);
    return;
  }

  if (roomType === 'magic') {
    g.fillStyle(0x08051c, 0.60);
    g.fillCircle(cx, cy, 46);
    g.strokeCircle(cx, cy, 27);
    g.strokeCircle(cx, cy, 16);
    g.strokeCircle(cx, cy, 6);
    g.lineStyle(1, 0xffffff, 0.10 + glow * 0.08);
    g.lineBetween(cx, cy - 34, cx + 30, cy + 18);
    g.lineBetween(cx + 30, cy + 18, cx - 30, cy + 18);
    g.lineBetween(cx - 30, cy + 18, cx, cy - 34);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      g.fillStyle(accent, 0.35);
      g.fillCircle(cx + Math.cos(angle) * 27, cy + Math.sin(angle) * 27, 2.4);
      g.fillCircle(cx + Math.cos(angle + 0.25) * 39, cy + Math.sin(angle + 0.25) * 39, 1.8);
    }
    return;
  }

  g.lineStyle(1.1, accent, 0.26);
  g.strokeRoundedRect(cx - 38, cy - 18, 76, 34, 8);
  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(cx - 26, cy - 10, 52, 20, 6);
}

function drawMonsterPreviewPedestal(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x020405, 0.48);
  g.fillEllipse(x, y + 24, 66, 18);
  g.fillStyle(0x030608, 0.88);
  g.fillRoundedRect(x - 27, y + 5, 54, 22, 9);
  g.fillStyle(filled ? accent : 0x050806, filled ? 0.20 : 0.84);
  g.fillEllipse(x, y + 16, 56, 18);
  g.lineStyle(1.2, accent, filled ? 0.54 : 0.30);
  g.strokeEllipse(x, y + 16, 56, 18);
  g.lineStyle(1, accent, filled ? 0.28 : 0.14);
  g.strokeEllipse(x, y + 11, 38, 9);
  g.lineStyle(1, 0xffffff, filled ? 0.12 : 0.06);
  g.lineBetween(x - 18, y + 16, x + 18, y + 16);
  g.lineBetween(x, y + 9, x, y + 24);
  if (!filled) {
    g.fillStyle(accent, 0.10);
    g.fillCircle(x, y, 25);
    g.lineStyle(1.1, accent, 0.34);
    g.strokeCircle(x, y, 22);
    g.lineStyle(1, 0xffffff, 0.08);
    g.strokeCircle(x, y, 13);
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 2 * i + Math.PI / 4;
      g.fillStyle(accent, 0.26);
      g.fillCircle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 1.8);
    }
  }
  g.fillStyle(accent, filled ? 0.16 : 0.07);
  g.fillRoundedRect(x - 22, y + 20, 44, 6, 3);
  g.fillCircle(x - 22, y + 15, 2.2);
  g.fillCircle(x + 22, y + 15, 2.2);
  g.fillStyle(0x020405, 0.90);
  g.fillRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.lineStyle(1, accent, filled ? 0.58 : 0.34);
  g.strokeRoundedRect(x - 33, y + 2, 22, 13, 5);
  g.fillStyle(accent, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 30, y + 12, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 22, y + 8.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawInteriorEquipmentBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.94);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0xffcc66, 0.74);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y, equipment.icon, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
  }).setOrigin(0.5));
}

function drawInteriorEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.88);
  g.fillRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.lineStyle(1, 0xa887ff, 0.52);
  g.strokeRoundedRect(x - 10, y - 8, 20, 16, 5);
  g.fillStyle(accent, 0.10);
  g.fillCircle(x, y, 7);
  c.add(g);
  c.add(scene.add.text(x, y - 0.5, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#e4d8ff',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawInteriorSlotActionChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  filled: boolean,
): void {
  const w = Math.max(filled ? 34 : 42, label.length * 10 + (filled ? 13 : 22));
  const h = filled ? 15 : 16;
  const g = scene.add.graphics();
  g.fillStyle(0x020806, filled ? 0.94 : 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.lineStyle(1, accent, filled ? 0.68 : 0.72);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  g.fillStyle(accent, filled ? 0.20 : 0.16);
  g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 5);
  g.fillStyle(accent, filled ? 0.86 : 0.58);
  g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, 4, h - 8, 3);
  if (!filled) {
    const arrowX = x + w / 2 - 7;
    g.fillStyle(0xffffff, 0.24);
    g.beginPath();
    g.moveTo(arrowX - 2, y - 3);
    g.lineTo(arrowX + 3, y);
    g.lineTo(arrowX - 2, y + 3);
    g.closePath();
    g.fillPath();
  } else {
    g.fillStyle(accent, 0.72);
    g.fillCircle(x + w / 2 - 8, y, 2.2);
  }
  c.add(g);
  c.add(scene.add.text(filled ? x - 2 : x - 3, y + 0.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: filled ? '#eaffd8' : '#fff4ce',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawPreviewTargetRing(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  label: string,
): void {
  const g = scene.add.graphics();
  g.lineStyle(4, accent, 0.14);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(1.7, accent, 0.86);
  g.strokeRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 9);
  g.fillStyle(accent, 0.07);
  g.fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 8);
  const chipW = Math.min(w - 14, Math.max(48, label.length * 10 + 18));
  const chipY = y - h / 2 + 7;
  g.fillStyle(0x040908, 0.90);
  g.fillRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  g.lineStyle(1, accent, 0.72);
  g.strokeRoundedRect(x - chipW / 2, chipY, chipW, 18, 6);
  c.add(g);

  const text = scene.add.text(x, chipY + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#f5ffe8',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  c.add(text);

  if (prefersReducedMotion()) return;
  scene.tweens.add({
    targets: [g, text],
    alpha: { from: 0.72, to: 1 },
    duration: 560,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
  });
}

function navigateToFocusedMonster(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  monsterId: string,
  slotIdx: number,
): void {
  scene.registry.set('focusMonsterId', monsterId);
  scene.registry.set('focusSourceLabel', `방 #${slotIdx + 1} 수호자`);
  scene.registry.set('focusRoomSlotIdx', slotIdx);
  navigateFromRoomDetail(scene, state, cb, 'BarracksScene');
}

function navigateToFocusedForge(
  scene: Phaser.Scene,
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
  monsterId: string,
  slotIdx: number,
): void {
  scene.registry.set('focusMonsterId', monsterId);
  scene.registry.set('focusSourceLabel', `방 #${slotIdx + 1} 수호자`);
  scene.registry.set('focusRoomSlotIdx', slotIdx);
  scene.registry.set('forgeReturnScene', 'DungeonHomeScene');
  navigateFromRoomDetail(scene, state, cb, 'ForgeScene');
}

function addPreviewHitZone(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  onPress: () => void,
): void {
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onPress);
  c.add(zone);
}

function getPreviewSlotPosition(
  index: number,
  total: number,
  x: number,
  y: number,
  w: number,
  rowGap: number,
): { x: number; y: number } {
  const perRow = Math.min(3, Math.max(1, total));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const countInRow = Math.min(perRow, total - row * perRow);
  const gap = countInRow <= 1 ? 0 : Math.min(54, w / (countInRow - 1));
  const startX = x + w / 2 - gap * (countInRow - 1) / 2;
  return { x: startX + col * gap, y: y + row * rowGap };
}

function drawTrapPreviewSlot(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  icon: string,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  const edge = filled ? 0xffc44d : accent;
  g.fillStyle(0x020405, 0.46);
  g.fillEllipse(x, y + 13, 50, 13);
  g.fillStyle(filled ? 0x2d1b08 : 0x071016, filled ? 0.98 : 0.86);
  g.beginPath();
  g.moveTo(x - 20, y - 7);
  g.lineTo(x - 13, y - 14);
  g.lineTo(x + 13, y - 14);
  g.lineTo(x + 20, y - 7);
  g.lineTo(x + 20, y + 8);
  g.lineTo(x + 12, y + 14);
  g.lineTo(x - 12, y + 14);
  g.lineTo(x - 20, y + 8);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.2, edge, filled ? 0.86 : 0.36);
  g.strokePath();
  g.fillStyle(edge, filled ? 0.15 : 0.07);
  g.fillRoundedRect(x - 13, y - 8, 26, 5, 2);
  g.lineStyle(1, edge, filled ? 0.38 : 0.18);
  g.lineBetween(x - 13, y + 8, x + 13, y + 8);
  if (!filled) {
    g.fillStyle(edge, 0.11);
    g.fillCircle(x, y, 16);
    g.lineStyle(1, edge, 0.32);
    g.strokeCircle(x, y, 13);
  }
  g.fillStyle(0xffffff, filled ? 0.14 : 0.06);
  g.fillCircle(x - 14, y - 8, 1.5);
  g.fillCircle(x + 14, y - 8, 1.5);
  g.fillStyle(0x020405, 0.92);
  g.fillRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.lineStyle(1, edge, filled ? 0.62 : 0.36);
  g.strokeRoundedRect(x - 28, y - 19, 22, 13, 5);
  g.fillStyle(edge, filled ? 0.18 : 0.08);
  g.fillRoundedRect(x - 25, y - 9, 16, 1.5, 1);
  c.add(g);
  c.add(scene.add.text(x - 17, y - 12.5, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: filled ? '#fff0c2' : '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x, filled ? y : y - 0.5, filled ? icon : '+', {
    fontFamily: 'sans-serif',
    fontSize: filled ? '16px' : '18px',
    color: filled ? '#ffe080' : '#fff4ce',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawMonsterAnchor(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x061016, 0.88);
  g.fillCircle(x, y, 15);
  g.fillStyle(accent, 0.07);
  g.fillCircle(x, y, 22);
  g.lineStyle(1.2, accent, 0.40);
  g.strokeCircle(x, y, 15);
  g.lineStyle(1, accent, 0.25);
  g.strokeCircle(x, y, 8);
  g.lineBetween(x - 10, y, x + 10, y);
  g.lineBetween(x, y - 10, x, y + 10);
  g.fillStyle(accent, 0.22);
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 2 * i + Math.PI / 4;
    g.fillCircle(x + Math.cos(angle) * 17, y + Math.sin(angle) * 17, 1.8);
  }
  c.add(g);
  c.add(scene.add.text(x, y - 1, '+', {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    color: '#fff4ce',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function fitSlotLabel(label: string, max = 8): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function getCompactTrapEffectLabel(desc: string): string {
  if (desc.includes('이동속도')) return '감속 2초';
  if (desc.includes('피해/초')) return '독 피해';
  if (desc.includes('기절')) return '기절 1초';
  if (desc.includes('피해')) return '진입 피해';
  return fitSlotLabel(desc, 5);
}

function formatCompactTrapCost(cost: number, unlockLv: number, compact: boolean): string {
  return compact ? `${cost}g Lv${unlockLv}` : `${cost}g · Lv.${unlockLv}`;
}

function getMonsterRarityMeta(monster: MonsterDef): typeof MONSTER_RARITY_META[keyof typeof MONSTER_RARITY_META] {
  return MONSTER_RARITY_META[monster.rarityTier ?? 'C'] ?? MONSTER_RARITY_META.C;
}

function drawCollectorCardSkin(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  rarity: ReturnType<typeof getMonsterRarityMeta>,
  owned: boolean,
): void {
  const g = scene.add.graphics();
  g.fillStyle(rarity.color, owned ? 0.12 : 0.06);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.lineStyle(1, rarity.color, owned ? 0.44 : 0.18);
  g.lineBetween(x + 48, y + 8, x + w - 12, y + 8);
  g.fillStyle(0xffffff, owned ? 0.24 : 0.08);
  g.fillCircle(x + w - 19, y + 27, 1.4);
  g.fillCircle(x + w - 30, y + 36, 1.1);
  g.fillCircle(x + 12, y + h - 13, 1.2);
  g.fillStyle(rarity.color, owned ? 0.28 : 0.12);
  g.fillCircle(x + 28, y + 35, 20);
  g.fillStyle(0x050806, 0.62);
  g.fillRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  g.lineStyle(1, rarity.color, owned ? 0.62 : 0.30);
  g.strokeRoundedRect(x + w - 52, y + 9, 43, 13, 5);
  c.add(g);
  c.add(scene.add.text(x + w - 30.5, y + 15.5, rarity.label, {
    fontFamily: 'sans-serif',
    fontSize: '6px',
    color: rarity.css,
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + w - 10, y + h - 14, rarity.stars, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

function drawCompactLoadoutSlotFrame(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  filled: boolean,
  slotLabel: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.24);
  g.fillRoundedRect(x + 2, y + 3, w, h, 8);
  g.fillStyle(filled ? 0x130c06 : 0x060909, filled ? 0.95 : 0.82);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(filled ? 0x2a1608 : 0x091210, filled ? 0.52 : 0.54);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  g.fillStyle(0x050806, 0.82);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(1.1, accent, filled ? 0.52 : 0.25);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, 0xffffff, filled ? 0.08 : 0.04);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);
  g.fillStyle(accent, filled ? 0.16 : 0.06);
  g.fillRoundedRect(x + 5, y + 5, w - 10, 4, 3);
  g.fillStyle(0x050806, 0.72);
  g.fillRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.lineStyle(1, accent, filled ? 0.48 : 0.24);
  g.strokeRoundedRect(x + 7, y + 10, 26, 16, 5);
  g.fillStyle(accent, filled ? 0.10 : 0.04);
  g.fillRoundedRect(x + 2, y + 12, 3, h - 24, 2);
  g.fillStyle(accent, filled ? 0.42 : 0.18);
  g.fillCircle(x + w - 9, y + 13, 2.3);
  g.fillCircle(x + w - 9, y + h - 13, 2.3);
  g.lineStyle(1, accent, filled ? 0.20 : 0.10);
  g.lineBetween(x + 45, y + 18, x + w - 12, y + 18);
  g.lineBetween(x + 45, y + h - 30, x + w - 12, y + h - 30);
  c.add(g);
  c.add(scene.add.text(x + 20, y + 18, slotLabel, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: filled ? '#ffe080' : '#8a6a4a',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function addCompactAttributeChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
): void {
  const chipW = Math.max(30, Math.min(44, label.length * 11 + 12));
  const chip = scene.add.graphics();
  chip.fillStyle(0x050806, 0.88);
  chip.fillRoundedRect(x, y, chipW, 13, 5);
  chip.lineStyle(1, accent, 0.48);
  chip.strokeRoundedRect(x, y, chipW, 13, 5);
  chip.fillStyle(accent, 0.16);
  chip.fillRoundedRect(x + 2, y + 2, 4, 9, 3);
  c.add(chip);
  c.add(scene.add.text(x + chipW / 2 + 2, y + 6.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: '#fff0c2',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function addCompactEquipmentSocket(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  equipment: EquipmentBadge | null,
  accent: number,
): void {
  const socket = scene.add.graphics();
  const filled = Boolean(equipment);
  socket.fillStyle(filled ? 0x332005 : 0x070b0a, filled ? 0.96 : 0.84);
  socket.fillCircle(x, y, 8);
  socket.lineStyle(1, filled ? 0xffd166 : accent, filled ? 0.68 : 0.30);
  socket.strokeCircle(x, y, 8);
  socket.fillStyle(filled ? 0xffd166 : accent, filled ? 0.16 : 0.06);
  socket.fillCircle(x, y, 5);
  c.add(socket);
  if (equipment) {
    c.add(scene.add.text(x, y, equipment.icon, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
    }).setOrigin(0.5));
    return;
  }
  c.add(scene.add.text(x, y, '◇', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function addCompactEmptySlotGlyph(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  icon: string,
): void {
  const glyph = scene.add.graphics();
  glyph.fillStyle(0x050806, 0.92);
  glyph.fillRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.lineStyle(1.1, accent, 0.34);
  glyph.strokeRoundedRect(x - 17, y - 17, 34, 34, 8);
  glyph.fillStyle(accent, 0.08);
  glyph.fillRoundedRect(x - 11, y - 11, 22, 22, 6);
  glyph.lineStyle(1, accent, 0.20);
  glyph.lineBetween(x - 9, y, x + 9, y);
  glyph.lineBetween(x, y - 9, x, y + 9);
  glyph.lineStyle(1, accent, 0.12);
  glyph.strokeCircle(x, y, 14);
  c.add(glyph);
  c.add(scene.add.text(x, y, icon, {
    fontFamily: 'sans-serif',
    fontSize: '17px',
    color: '#806040',
  }).setOrigin(0.5).setAlpha(0.60));
}

function drawCompactGrowthMeter(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  xp: number,
  accent: number,
): void {
  const ready = xp >= 100;
  const progress = ready ? 1 : Phaser.Math.Clamp((xp % 100) / 100, 0, 1);
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.82);
  g.fillRoundedRect(x, y, w, 5, 3);
  g.lineStyle(1, accent, 0.22);
  g.strokeRoundedRect(x, y, w, 5, 3);
  g.fillStyle(ready ? 0xffd166 : accent, ready ? 0.88 : 0.72);
  g.fillRoundedRect(x + 1, y + 1, Math.max(4, (w - 2) * progress), 3, 2);
  g.fillStyle(ready ? 0xffd166 : 0xffffff, ready ? 0.42 : 0.12);
  g.fillCircle(x + w - 4, y + 2.5, 2);
  c.add(g);
  c.add(scene.add.text(x + w, y - 5, ready ? 'UP' : `${Math.round(progress * 100)}%`, {
    fontFamily: 'monospace',
    fontSize: '6px',
    color: ready ? '#ffdf6e' : '#8ab3aa',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

function drawCompactTrapEffectTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  desc: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.84);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.30);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.18);
  g.fillRoundedRect(x + 3, y - 3, 4, 8, 3);
  c.add(g);
  c.add(scene.add.text(x + 10, y + 1, fitSlotLabel(getCompactTrapEffectLabel(desc), w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffe3a0',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
}

function drawCompactEmptyTrapPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.70);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.20);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.08);
  for (let sx = x + 4; sx < x + w - 5; sx += 8) {
    g.fillRoundedRect(sx, y - 1, 4, 2, 1);
  }
  c.add(g);
  c.add(scene.add.text(x + 9, y + 1, w < 58 ? '차단' : '경로 차단', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
}

function drawCompactMonsterRoleTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.78);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.26);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x + 7, y + 1, 3);
  c.add(g);
  c.add(scene.add.text(x + 13, y + 1, fitSlotLabel(label, w < 58 ? 4 : 5), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#ffe1c2',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
}

function getCompactMonsterRoleLabel(recommendation: MonsterLoadoutRecommendation): string {
  const [primaryReason] = recommendation.reason.split('·').map(part => part.trim());
  return primaryReason || '수호 배치';
}

function drawCompactEmptyMonsterPlanTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x050806, 0.70);
  g.fillRoundedRect(x, y - 7, w, 16, 5);
  g.lineStyle(1, accent, 0.20);
  g.strokeRoundedRect(x, y - 7, w, 16, 5);
  g.fillStyle(accent, 0.08);
  g.fillCircle(x + 7, y + 1, 3);
  g.fillCircle(x + 17, y + 1, 2.4);
  g.fillCircle(x + 27, y + 1, 1.8);
  c.add(g);
  c.add(scene.add.text(x + 36, y + 1, w < 58 ? '대기' : '대기 라인', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#9b7650',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
}

function drawCompactRoomTypeStateTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accent: number,
  isActive: boolean,
  isRecommended: boolean,
): void {
  const tagW = Math.max(32, Math.min(42, 20 + label.length * 10));
  const g = scene.add.graphics();
  g.fillStyle(isActive || isRecommended ? accent : 0x050806, isActive ? 0.92 : isRecommended ? 0.84 : 0.76);
  g.fillRoundedRect(x, y, tagW, 16, 6);
  g.lineStyle(1, accent, isActive || isRecommended ? 0.38 : 0.28);
  g.strokeRoundedRect(x, y, tagW, 16, 6);
  if (!isActive && !isRecommended) {
    g.fillStyle(accent, 0.16);
    g.fillCircle(x + 8, y + 8, 3);
  }
  c.add(g);
  c.add(scene.add.text(x + tagW / 2, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: isActive || isRecommended ? '#0e0900' : '#ffe1b0',
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function addRecommendedMonsterSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: MonsterLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const recommendedDef = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS];
  const rarity = recommendedDef ? getMonsterRarityMeta(recommendedDef) : MONSTER_RARITY_META.C;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 0.10);
  g.fillRoundedRect(x + 9, y + 29, 38, h - 39, 8);
  g.lineStyle(1.3, rarity.color, 0.72);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(rarity.color, 0.88);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(x + 13, y + 11, 1.4);
  g.fillCircle(x + w - 16, y + h - 13, 1.2);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#0e0900',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  addMonsterPortrait(scene, c, x + 27, y + 35, recommendation.monsterId, {
    size: 36,
    frameColor: rarity.color,
    glowColor: rarity.color,
    bgColor: 0x070908,
    equippedSkins: {},
  });
  c.add(scene.add.text(x + 8, y + h - 12, rarity.stars, {
    fontFamily: 'Georgia, serif',
    fontSize: '7px',
    color: rarity.css,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  const recommendedType = MONSTER_DEFS[recommendation.monsterTypeId as keyof typeof MONSTER_DEFS]?.type;
  if (recommendedType) {
    addCompactAttributeChip(
      scene,
      c,
      x + 52,
      y + 20,
      MONSTER_TYPE_LABEL[recommendedType] ?? recommendedType,
      MONSTER_TYPE_COLOR[recommendedType] ?? recommendation.accent,
    );
  }
  c.add(scene.add.text(x + 52, y + 36, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: '#ffe1c2',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  drawCompactMonsterRoleTag(
    scene,
    c,
    x + 52,
    y + 48,
    Math.max(38, w - 63),
    getCompactMonsterRoleLabel(recommendation),
    recommendation.accent,
  );
  c.add(scene.add.text(x + 52, y + 61, `ATK ${recommendation.attack}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#c8921a',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 27, btnW, compact ? '추천' : '추천 배치', recommendation.accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 27, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

function addRecommendedTrapSlotPreview(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  recommendation: TrapLoadoutRecommendation,
  onApply: () => void,
  onPick: () => void,
): void {
  const compact = w < 132;
  const trapDef = TRAP_DEFS.find(trap => trap.id === recommendation.trapId);
  const effectDesc = trapDef?.desc ?? recommendation.reason;
  const unlockLv = trapDef?.unlockLv ?? 0;
  const badgeW = compact ? 35 : 39;
  const g = scene.add.graphics();
  g.fillStyle(accent, 0.10);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 0.08);
  g.fillRoundedRect(x + 9, y + 27, 38, h - 37, 8);
  g.lineStyle(1.3, accent, 0.72);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 7);
  g.fillStyle(accent, 0.88);
  g.fillRoundedRect(x + w - badgeW - 8, y + 9, badgeW, 16, 5);
  g.fillStyle(0x050806, 0.94);
  g.fillCircle(x + 27, y + 33, 18);
  g.lineStyle(1.2, accent, 0.62);
  g.strokeCircle(x + 27, y + 33, 18);
  g.fillStyle(accent, 0.14);
  g.fillCircle(x + 27, y + 33, 12);
  c.add(g);

  c.add(scene.add.text(x + w - badgeW / 2 - 8, y + 17, '추천', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#0e0900',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 27, y + 33, recommendation.icon, {
    fontFamily: 'sans-serif',
    fontSize: '19px',
  }).setOrigin(0.5));
  c.add(scene.add.text(x + 52, y + 29, fitSlotLabel(recommendation.name, compact ? 5 : 7), {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: '#ffe3a0',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  drawCompactTrapEffectTag(
    scene,
    c,
    x + 52,
    y + 43,
    Math.max(38, w - 63),
    effectDesc,
    accent,
  );
  c.add(scene.add.text(x + 52, y + 58, formatCompactTrapCost(recommendation.cost, unlockLv, compact), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#c8921a',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  const btnW = (w - 22) / 2;
  addCompactLoadoutButton(scene, c, x + 7, y + h - 25, btnW, compact ? '추천' : '추천 설치', accent, onApply, true);
  addCompactLoadoutButton(scene, c, x + 15 + btnW, y + h - 25, btnW, compact ? '선택' : '직접 선택', accent, onPick);
}

function addCompactLoadoutButton(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  accent: number,
  onPress: () => void,
  primary = false,
): void {
  const button = addPrimaryActionButton(scene, {
    x,
    y,
    w,
    h: 22,
    label,
    fontSize: '10px',
    fillColor: primary ? 0x123526 : 0x160e06,
    hoverFillColor: primary ? 0x18513a : 0x241606,
    borderColor: accent,
    hoverBorderColor: primary ? 0x88ffcc : 0xffdf6e,
    textColor: primary ? '#d8fff0' : '#e8d090',
    onPress,
  });
  c.add([button.bg, button.text, button.zone]);
}


// ─── Close ────────────────────────────────────────────────────────────────────

export function closeRoomDetail(
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  if (state.roomDetailScrollCleanup) { state.roomDetailScrollCleanup(); state.roomDetailScrollCleanup = null; }
  if (state.trapPickerContainer)   { state.trapPickerContainer.destroy();   state.trapPickerContainer   = null; }
  if (state.monsterPickerContainer) { state.monsterPickerContainer.destroy(); state.monsterPickerContainer = null; }
  if (!state.roomDetailContainer) return;
  const c = state.roomDetailContainer;
  state.roomDetailContainer = null;
  state.roomDetailSlotIdx = null;

  const tweenScene = state.scene;
  if (tweenScene) {
    tweenScene.tweens.add({
      targets: c,
      alpha: 0, scaleX: 0.7, scaleY: 0.7,
      duration: ROOM_DETAIL_CLOSE_MS, ease: 'Linear',
      onComplete: () => { c.destroy(); cb.rebuildDungeonSlots(); },
    });
  } else {
    c.destroy();
    cb.rebuildDungeonSlots();
  }
}


// ─── Room Type Strip ──────────────────────────────────────────────────────────

function buildRoomTypeStrip(
  scene: Phaser.Scene,
  _state: RoomDetailState,
  _theme: DungeonTheme,
  _cb: RoomDetailCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  _slotIdx: number,
  secX: number, secW: number, secY: number,
  reopen: () => void,
  highlightTarget = false,
): number {
  const stripH = 126;
  const activeType = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const designGs = _cb.getGameState();
  const recommendation = activeType ? null : getRoomDesignRecommendation(designGs, _slotIdx);
  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: stripH,
    radius: 8,
    fillColor: 0x130c04,
    borderColor: 0x3a2010,
    borderAlpha: 0.45,
    borderWidth: 1,
    glowColor: 0xc8921a,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 2,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, stripH, 0x4bd5ff, '다음 선택');
  }

  c.add(scene.add.text(secX + 14, secY + 15, '방 설계 타입', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: '#c8921a',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(secX + secW - 14, secY + 15, activeType ? `${activeType.name} 적용 중` : recommendation ? `추천 ${recommendation.shortLabel}` : '역할 미설정', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: activeType ? '#ffdd88' : recommendation ? '#88ffcc' : '#806040',
  }).setOrigin(1, 0.5));
  if (recommendation) {
    c.add(scene.add.text(secX + 14, secY + 32, `추천: ${recommendation.title} · ${recommendation.reason}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#88ffcc',
      wordWrap: { width: secW - 28, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));
  }

  const cardY = secY + 44;
  const cardH = 74;
  const btnW = (secW - 10) / 4;
  ROOM_SLOT_TYPE_DEFS.forEach((td, i) => {
    const bx   = secX + 5 + i * btnW;
    const isActive = slot.roomType === td.id;
    const isRecommended = recommendation?.roomType === td.id;
    const accent = ROOM_TYPE_ACCENT[td.id] ?? 0xc8921a;
    const delta = calculateRoomMetricDelta(designGs, slot, { ...slot, roomType: td.id });
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(isActive ? accent : isRecommended ? 0x102820 : 0x241208, isActive ? 0.86 : isRecommended ? 0.92 : 0.66);
    btnBg.fillRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.lineStyle(isRecommended ? 1.7 : 1.2, accent, isActive || isRecommended ? 0.95 : 0.35);
    btnBg.strokeRoundedRect(bx + 1, cardY, btnW - 4, cardH, 7);
    btnBg.fillStyle(isActive ? 0xffffff : accent, isActive ? 0.13 : 0.08);
    btnBg.fillRoundedRect(bx + 8, cardY + 5, btnW - 18, 3, 2);
    c.add(btnBg);
    const tagLabel = isActive ? '적용' : isRecommended ? '추천' : ROOM_TYPE_ROLE_CHIP[td.id] ?? '설계';
    drawCompactRoomTypeStateTag(scene, c, bx + 8, cardY + 10, tagLabel, accent, isActive, isRecommended);
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 31, td.icon, {
      fontFamily: 'sans-serif', fontSize: '17px',
    }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 49, td.name, {
      fontFamily: 'Georgia, serif', fontSize: '10px',
      color: isActive ? '#0e0900' : isRecommended ? '#d8fff5' : '#a07040',
      fontStyle: isActive || isRecommended ? 'bold' : 'normal',
    }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2 - 1, cardY + 64, isActive ? '적용중' : isRecommended ? recommendation.shortLabel : formatRoomTypeDelta(delta.threatDelta, delta.readinessDelta, td.id), {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: isActive ? '#0e0900' : isRecommended ? '#88ffcc' : '#6f5636',
      fontStyle: isRecommended ? 'bold' : 'normal',
    }).setOrigin(0.5));

    const zone = scene.add.zone(bx + btnW / 2, cardY + cardH / 2, btnW - 4, cardH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (isActive) return;
      const freshGs = _cb.getGameState();
      const freshSlot = freshGs.dungeonSlots?.[_slotIdx] ?? slot;
      const previewSlot = { ...freshSlot, roomType: td.id };
      const freshDelta = calculateRoomMetricDelta(freshGs, freshSlot, previewSlot);
      const growthStats = buildRoomGrowthFeedbackStats(
        calculateRoomMetrics(freshGs, freshSlot),
        calculateRoomMetrics(freshGs, previewSlot),
      );
      const result = changeRoomSlotType(freshGs, _slotIdx, td.id);
      if (!result.ok) return;
      _cb.saveAndRefresh(result.state);
      _cb.markRoomChanged?.(_slotIdx);
      registerRoomDesignFeedback(scene, _slotIdx, td.name, td.icon, freshDelta, accent, growthStats);
      showRoomGrowthFeedback(scene, freshDelta, `${td.name} 설계 적용`, growthStats);
      reopen();
    });
    c.add(zone);
  });

  return stripH;
}

function formatRoomTypeDelta(
  threatDelta: number,
  readinessDelta: number,
  roomType: string,
): string {
  if (threatDelta > 0) return `위협 +${threatDelta}`;
  if (readinessDelta > 0) return `준비 +${readinessDelta}%`;
  return ROOM_TYPE_SHORT_BONUS[roomType] ?? '역할 변경';
}


// ─── Monster Section ──────────────────────────────────────────────────────────

function buildMonsterSection(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
  highlightTarget = false,
): number {
  const gs = cb.getGameState();
  const cap    = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const perRow = Math.min(3, Math.max(1, cap.monsters));
  const gap    = 8;
  const cardH  = 94;
  const rows   = Math.ceil(cap.monsters / perRow);
  const cardW  = (secW - 24 - gap * (perRow - 1)) / perRow;
  const secH   = 38 + rows * cardH + Math.max(0, rows - 1) * gap + 10;
  const firstEmptyMonsterSlot = findFirstEmptySlot(slot.monsterIds, cap.monsters);
  const monsterRecommendation = firstEmptyMonsterSlot >= 0
    ? getMonsterLoadoutRecommendation(gs, slotIdx)
    : null;

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: secH,
    radius: 10,
    fillColor: 0x241208,
    borderColor: 0xc8921a,
    borderAlpha: 0.36,
    borderWidth: 1.2,
    accentColor: 0xc8921a,
    accentAlpha: 0.28,
    glowColor: 0xc8921a,
    glowOpacity: 0.04,
    shadowOpacity: 0.24,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, MONSTER_ROW_ACCENT, '다음 배치');
  }

  const assignedCount = slot.monsterIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '👊 수호 라인 슬롯', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    fontStyle: 'bold',
  }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${assignedCount}/${cap.monsters}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: assignedCount > 0 ? '#ffdd88' : '#806040',
  }).setOrigin(1, 0));

  for (let mi = 0; mi < cap.monsters; mi++) {
    const col    = mi % perRow;
    const row    = Math.floor(mi / perRow);
    const cardX  = secX + 12 + col * (cardW + gap);
    const cardY  = secY + 34 + row * (cardH + gap);
    const mId    = slot.monsterIds[mi];
    const om     = mId ? gs.ownedMonsters.find(m => m.id === mId) : null;
    const typeId = om ? (Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id) : null;
    const mDef   = typeId ? MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] : null;

    drawCompactLoadoutSlotFrame(scene, c, cardX, cardY, cardW, cardH, MONSTER_ROW_ACCENT, !!mDef && !!om, `M${mi + 1}`);

    if (mDef && om) {
      const equipment = getEquippedItem(gs, om.id);
      const typeAccent = MONSTER_TYPE_COLOR[mDef.type] ?? MONSTER_ROW_ACCENT;
      const rarity = getMonsterRarityMeta(mDef);
      drawCollectorCardSkin(scene, c, cardX, cardY, cardW, cardH, rarity, true);
      addMonsterPortrait(scene, c, cardX + 27, cardY + 35, om.id, {
        size: 36,
        frameColor: rarity.color,
        glowColor: rarity.color,
        bgColor: 0x070908,
        equippedSkins: gs.equippedSkins ?? {},
      });
      addCompactEquipmentSocket(scene, c, cardX + 40, cardY + 23, equipment, MONSTER_ROW_ACCENT);
      addCompactAttributeChip(
        scene,
        c,
        cardX + 52,
        cardY + 14,
        MONSTER_TYPE_LABEL[mDef.type] ?? mDef.type,
        typeAccent,
      );
      c.add(scene.add.text(cardX + 52, cardY + 32, fitSlotLabel(mDef.name, 6), {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e8d090',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      c.add(scene.add.text(cardX + 52, cardY + 47, `Lv.${om.level} · ATK ${mDef.baseDamage}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#a07040',
      }).setOrigin(0, 0.5));
      drawCompactGrowthMeter(
        scene,
        c,
        cardX + 52,
        cardY + 55,
        Math.max(28, cardW - 63),
        om.xp ?? 0,
        typeAccent,
      );
      const swapW = Math.max(33, Math.min(39, cardW * 0.36));
      const growW = Math.max(40, cardW - 23 - swapW);
      addCompactLoadoutButton(scene, c, cardX + 7, cardY + cardH - 27, swapW, '교체', MONSTER_ROW_ACCENT, () => {
        showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
      });
      addCompactLoadoutButton(scene, c, cardX + 15 + swapW, cardY + cardH - 27, growW, cardW < 114 ? '성장' : '성장 관리', 0x44ccaa, () => {
        navigateToFocusedMonster(scene, state, cb, om.id, slotIdx);
      }, true);
    } else {
      if (monsterRecommendation && mi === firstEmptyMonsterSlot) {
        addRecommendedMonsterSlotPreview(
          scene, c, cardX, cardY, cardW, cardH, MONSTER_ROW_ACCENT,
          monsterRecommendation,
          () => applyRecommendedMonsterPlacement(
            scene, state, theme, cb, slotIdx, slot, mi, monsterRecommendation,
          ),
          () => showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi),
        );
      } else {
        addCompactEmptySlotGlyph(scene, c, cardX + 27, cardY + 35, MONSTER_ROW_ACCENT, '+');
        addCompactAttributeChip(scene, c, cardX + 52, cardY + 17, '대기', MONSTER_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 35, '수호 설계', {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#8a6a4a',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        drawCompactEmptyMonsterPlanTag(scene, c, cardX + 52, cardY + 48, Math.max(38, cardW - 63), MONSTER_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 61, '새 수호자', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#6f5636',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        addCompactLoadoutButton(scene, c, cardX + 10, cardY + cardH - 27, cardW - 20, '배치', MONSTER_ROW_ACCENT, () => {
          showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
        }, true);
      }
    }
  }

  return secH;
}


// ─── Trap Section ─────────────────────────────────────────────────────────────

function buildTrapSection(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
  highlightTarget = false,
): number {
  const cap  = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const perRow = Math.min(3, Math.max(1, cap.traps));
  const gap    = 8;
  const cardH  = 90;
  const rows   = Math.ceil(cap.traps / perRow);
  const cardW  = (secW - 24 - gap * (perRow - 1)) / perRow;
  const secH   = 38 + rows * cardH + Math.max(0, rows - 1) * gap + 10;
  const firstEmptyTrapSlot = findFirstEmptySlot(slot.trapIds, cap.traps);
  const trapRecommendation = firstEmptyTrapSlot >= 0
    ? getTrapLoadoutRecommendation(cb.getGameState(), slotIdx)
    : null;

  const frame = addFramedPanel(scene, {
    x: secX,
    y: secY,
    w: secW,
    h: secH,
    radius: 10,
    fillColor: 0x0f0f0f,
    borderColor: 0x664400,
    borderAlpha: 0.36,
    borderWidth: 1.2,
    accentColor: 0x664400,
    accentAlpha: 0.24,
    glowColor: 0xc8921a,
    glowOpacity: 0.03,
    shadowOpacity: 0.24,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);
  if (highlightTarget) {
    drawSectionTargetPulse(scene, c, secX, secY, secW, secH, TRAP_ROW_ACCENT, '다음 설치');
  }

  const installedCount = slot.trapIds.filter(Boolean).length;
  c.add(scene.add.text(secX + 14, secY + 10, '🕸 함정 라인 슬롯', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    fontStyle: 'bold',
  }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${installedCount}/${cap.traps}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: installedCount > 0 ? '#ffdd88' : '#806040',
  }).setOrigin(1, 0));

  for (let ti = 0; ti < cap.traps; ti++) {
    const col = ti % perRow;
    const row = Math.floor(ti / perRow);
    const cardX = secX + 12 + col * (cardW + gap);
    const cardY = secY + 34 + row * (cardH + gap);
    const trap = TRAP_DEFS.find(t => t.id === slot.trapIds[ti]);

    drawCompactLoadoutSlotFrame(scene, c, cardX, cardY, cardW, cardH, TRAP_ROW_ACCENT, !!trap, `T${ti + 1}`);

    if (trap) {
      const iconX = cardX + 27;
      const trapIconG = scene.add.graphics();
      trapIconG.fillStyle(0x050806, 0.94);
      trapIconG.fillCircle(iconX, cardY + 33, 18);
      trapIconG.lineStyle(1.2, TRAP_ROW_ACCENT, 0.54);
      trapIconG.strokeCircle(iconX, cardY + 33, 18);
      trapIconG.fillStyle(TRAP_ROW_ACCENT, 0.12);
      trapIconG.fillCircle(iconX, cardY + 33, 12);
      c.add(trapIconG);
      c.add(scene.add.text(iconX, cardY + 33, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '19px',
      }).setOrigin(0.5));
      addCompactAttributeChip(scene, c, cardX + 52, cardY + 12, '설비', TRAP_ROW_ACCENT);
      c.add(scene.add.text(cardX + 52, cardY + 30, fitSlotLabel(trap.name, 6), {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      drawCompactTrapEffectTag(
        scene,
        c,
        cardX + 52,
        cardY + 42,
        Math.max(38, cardW - 63),
        trap.desc,
        TRAP_ROW_ACCENT,
      );
      c.add(scene.add.text(cardX + 52, cardY + 58, formatCompactTrapCost(trap.cost, trap.unlockLv, cardW < 114), {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#8a6a4a',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      const swapW = Math.max(33, Math.min(39, cardW * 0.36));
      const manageW = Math.max(40, cardW - 23 - swapW);
      addCompactLoadoutButton(scene, c, cardX + 7, cardY + cardH - 27, swapW, '교체', TRAP_ROW_ACCENT, () => {
        showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
      });
      addCompactLoadoutButton(scene, c, cardX + 15 + swapW, cardY + cardH - 27, manageW, '회수', 0xffc44d, () => {
        const result = removeTrapFromRoomSlot(cb.getGameState(), slotIdx, ti);
        if (!result.ok) return;
        cb.saveAndRefresh(result.state);
        cb.markRoomChanged?.(slotIdx);
        logger.debug(`[TRAP] slot ${slotIdx}[${ti}] removed, refund: ${result.refund ?? 0}g`);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), ROOM_DETAIL_REOPEN_DELAY_MS);
      });
    } else {
      if (trapRecommendation && ti === firstEmptyTrapSlot) {
        addRecommendedTrapSlotPreview(
          scene, c, cardX, cardY, cardW, cardH, TRAP_ROW_ACCENT,
          trapRecommendation,
          () => applyRecommendedTrapPlacement(
            scene, state, theme, cb, slotIdx, slot, ti, trapRecommendation,
          ),
          () => showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti),
        );
      } else {
        addCompactEmptySlotGlyph(scene, c, cardX + 27, cardY + 33, TRAP_ROW_ACCENT, '+');
        addCompactAttributeChip(scene, c, cardX + 52, cardY + 12, '대기', TRAP_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 31, '함정 설계', {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#8a6a4a',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        drawCompactEmptyTrapPlanTag(scene, c, cardX + 52, cardY + 43, Math.max(38, cardW - 63), TRAP_ROW_ACCENT);
        c.add(scene.add.text(cardX + 52, cardY + 58, '새 설비', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#6f5636',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5));
        addCompactLoadoutButton(scene, c, cardX + 10, cardY + cardH - 27, cardW - 20, '설치', TRAP_ROW_ACCENT, () => {
          showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
        }, true);
      }
    }
  }

  return secH;
}


// ─── Room Upgrade Confirm Dialog ─────────────────────────────────────────────

function showRoomUpgradeConfirm(
  scene: Phaser.Scene,
  cost: number,
  currentLevel: number,
  newCap: { monsters: number; traps: number },
  onConfirm: () => void,
): void {
  const OW = 280, OH = 170;
  const OX = (CANVAS_WIDTH  - OW) / 2;
  const OY = (CANVAS_HEIGHT - OH) / 2;

  const ov = scene.add.container(0, 0).setDepth(200).setAlpha(0);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const frame = addFramedPanel(scene, {
    x: OX,
    y: OY,
    w: OW,
    h: OH,
    radius: 8,
    fillColor: 0x1e1206,
    borderColor: 0xc8921a,
    borderAlpha: 0.9,
    accentColor: 0xc8921a,
    accentAlpha: 0.65,
    glowColor: 0xc8921a,
    glowOpacity: 0.09,
    shadowOpacity: 0.75,
    shadowOffsetY: 5,
  });
  ov.add([frame.shadow, frame.panel, frame.glow]);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 26, '⬆️ 방 업그레이드', {
    fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: '#c8921a',
  }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 52, `Lv.${currentLevel} → Lv.${currentLevel + 1}`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0e6c8',
  }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 70, `비용: 💰 ${cost} 골드`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcc44',
  }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 90, `몬스터 ${newCap.monsters}슬롯 / 함정 ${newCap.traps}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#a07040',
  }).setOrigin(0.5));

  const confirmBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 - 124,
    y: OY + OH - 46,
    w: 104,
    h: 34,
    label: '업그레이드',
    fontSize: '12px',
    fillColor: 0x2a1400,
    hoverFillColor: 0x3c2100,
    borderColor: 0xc8921a,
    hoverBorderColor: 0xffcc44,
    textColor: '#ffe080',
    once: true,
    onPress: () => { ov.destroy(true); onConfirm(); },
  });
  ov.add([confirmBtn.bg, confirmBtn.text, confirmBtn.zone]);

  const cancelBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 + 20,
    y: OY + OH - 46,
    w: 104,
    h: 34,
    label: '취소',
    fontSize: '12px',
    fillColor: 0x111111,
    hoverFillColor: 0x1a1a1a,
    borderColor: 0x4a3424,
    hoverBorderColor: 0x806040,
    textColor: '#8a6a4a',
    once: true,
    onPress: () => ov.destroy(true),
  });
  ov.add([cancelBtn.bg, cancelBtn.text, cancelBtn.zone]);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
}
