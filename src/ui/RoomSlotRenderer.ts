/**
 * Battle slot renderer — extracted from DungeonHomeScene.
 *
 * Renders dungeon room slots in 3 states: locked, destroyed, or occupied.
 */
import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { MONSTER_DEFS } from '../data/monsters';
import { EQUIPMENT_DEFS } from '../data/barracks';
import { calculateRoomLoadoutStatus, calculateRoomMetrics } from '../data/dungeonMetrics';
import { getRoomActionRecommendation } from '../data/roomActionRecommendations';
import { SLOT_UNLOCK_LEVELS, ROOM_SLOT_TYPE_DEFS } from '../data/wisdom';
import type { DungeonTheme } from '../themes/themes';
import type { GameState } from '../data/wisdom';
import { resolveMonsterTypeId } from './MonsterPortraitView';
import { drawRoomLoadoutRail } from './RoomLoadoutRail';
import { drawPixelRoom } from '../art/PixelRoom';
import { generateMonsterSprite } from '../art/PortraitGenerator';
import type { MonsterId } from '../data/monsters';

// ─── Shared layout constants ───────────────────────────────────────────────

export const SLOT_W = 100;
export const SLOT_H = 100;
export const INVASION_ORDER = [3, 2, 1, 4, 5, 6, 9, 8, 7];

// Saturated casual accents per room type — used as chunky cell borders on cream.
const ROOM_TYPE_ACCENT: Record<string, number> = {
  combat:  CASUAL.RED,
  trap:    CASUAL.GOLD,
  support: CASUAL.GREEN,
  magic:   CASUAL.PURPLE,
};
const ROOM_TYPE_SHORT_LABEL: Record<string, string> = {
  combat: '전투',
  trap: '함정',
  support: '지원',
  magic: '마법',
};
const HOME_MONSTER_SLOT_COLOR = CASUAL.RED;
const HOME_TRAP_SLOT_COLOR = CASUAL.GREEN_DK;

interface RoomActionHint {
  readonly label: string;
  readonly icon: string;
  readonly color: number;
}

interface EquipmentBadge {
  readonly icon: string;
  readonly name: string;
}

function getEquippedItem(gs: GameState, monsterId: string | null | undefined): EquipmentBadge | null {
  if (!monsterId) return null;
  const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
  const equipmentId = owned?.equipment;
  if (!equipmentId) return null;
  const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
  if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
  const craftedDef = [...(gs.craftedEquipment ?? [])].reverse().find(equipment => equipment.id === equipmentId);
  return craftedDef ? { icon: craftedDef.emoji, name: craftedDef.name } : null;
}

function getRoomActionHint(
  gs: GameState,
  slotIdx: number,
): RoomActionHint {
  const action = getRoomActionRecommendation(gs, slotIdx);
  return { label: action.label, icon: action.icon, color: action.accent };
}

function drawActionHintBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hint: RoomActionHint,
): void {
  const cx = x + SLOT_W - 18;
  const cy = y + 26;

  // Pulsing attention ring — draws the eye to a room that needs managing.
  // Circle at local (0,0) + object positioned at the badge so it scales about
  // the badge centre (Phaser scales graphics about their local origin).
  const pulse = scene.add.graphics();
  pulse.lineStyle(2, hint.color, 0.85);
  pulse.strokeCircle(0, 0, 13);
  pulse.setPosition(cx, cy);
  c.add(pulse);
  scene.tweens.add({
    targets: pulse,
    alpha: { from: 0.85, to: 0.12 },
    scaleX: { from: 1, to: 1.5 },
    scaleY: { from: 1, to: 1.5 },
    duration: 1100,
    repeat: -1,
    ease: 'Sine.easeOut',
  });

  g.fillStyle(CASUAL.PANEL, 0.98);
  g.fillCircle(cx, cy, 11);
  g.lineStyle(2, hint.color, 1);
  g.strokeCircle(cx, cy, 11);
  g.fillStyle(hint.color, 0.3);
  g.fillCircle(cx, cy, 7);
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(cx - 3, cy - 4, 2.4);
  c.add(scene.add.text(cx, cy, hint.icon, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawEquipmentBadge(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  equipment: EquipmentBadge,
): void {
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.lineStyle(1.5, CASUAL.GOLD_DK, 0.9);
  g.strokeRoundedRect(x - 11, y - 9, 22, 18, 6);
  g.fillStyle(CASUAL.GOLD, 0.25);
  g.fillCircle(x, y, 8);
  c.add(scene.add.text(x, y, equipment.icon, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }).setOrigin(0.5));
}

function drawEquipmentPowerAura(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  equipmentPower: number,
  equipment: EquipmentBadge | null,
): void {
  if (equipmentPower <= 0) return;

  g.lineStyle(2, CASUAL.GOLD, 0.6);
  g.strokeRoundedRect(x + 8, y + 15, SLOT_W - 16, SLOT_H - 25, 11);
  g.lineStyle(1, CASUAL.GOLD_DK, 0.3);
  g.strokeRoundedRect(x + 13, y + 20, SLOT_W - 26, SLOT_H - 35, 8);
  g.fillStyle(CASUAL.GOLD, 0.14);
  g.fillRoundedRect(x + 13, y + 21, SLOT_W - 26, 7, 4);
  g.fillStyle(CASUAL.GOLD, 0.22);
  g.fillCircle(x + 20, y + 25, 3);
  g.fillCircle(x + SLOT_W - 20, y + 25, 3);

  if (!equipment) return;
  const name = equipment.name.length > 5 ? `${equipment.name.slice(0, 5)}…` : equipment.name;
  const label = scene.add.text(x + SLOT_W / 2, y + 15, name, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: CASUAL_CSS.GOLD,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  c.add(label);
}

function drawRoomOperationsChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  readiness: number,
  threatScore: number,
  accent: number,
  loadoutStatus?: ReturnType<typeof calculateRoomLoadoutStatus>,
  roomShortLabel?: string,
): void {
  const chipX = x + 9;
  const chipY = y + 57;
  const chipW = 82;
  const chipH = 18;
  const readinessColor = readiness >= 78 ? CASUAL.GREEN : readiness >= 45 ? CASUAL.GOLD : CASUAL.RED;
  const label = loadoutStatus
    ? `${roomShortLabel ?? '방'} M${loadoutStatus.monsterCount}`
    : '운영';
  const value = loadoutStatus
    ? `T${loadoutStatus.trapCount} ${Math.round(readiness)}%`
    : threatScore > 0
    ? `${Math.round(readiness)}%/${Math.min(999, threatScore)}`
    : `${Math.round(readiness)}%/-`;

  g.fillStyle(CASUAL.PANEL_SOFT, 0.96);
  g.fillRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(chipX, chipY, chipW, chipH, 4);
  g.fillStyle(readinessColor, 0.9);
  g.fillRoundedRect(
    chipX + 2,
    chipY + chipH - 4,
    Math.max(4, (chipW - 4) * Phaser.Math.Clamp(readiness / 100, 0, 1)),
    2,
    1,
  );
  g.fillStyle(accent, 0.85);
  g.fillRoundedRect(chipX + 3, chipY + 3, 4, chipH - 7, 2);
  c.add(scene.add.text(chipX + 10, chipY + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(scene.add.text(chipX + chipW - 5, chipY + 8, value, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: readiness >= 45 ? CASUAL_CSS.INK : CASUAL_CSS.RED,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

function drawRoomNameRibbon(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  label: string,
  accent: number,
  readiness: number,
  danger = false,
): void {
  void readiness;
  const ribbonX = x + 30;
  const ribbonY = y + 7;
  const ribbonW = 43;
  const ribbonH = 15;
  const ribbonFill = danger ? CASUAL.RED : accent;

  // Saturated accent ribbon with white sheen + white label (matches Room.ts title strip).
  g.fillStyle(CASUAL.SHADOW, 0.22);
  g.fillRoundedRect(ribbonX, ribbonY + 2, ribbonW, ribbonH, 5);
  g.fillStyle(ribbonFill, 0.92);
  g.fillRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(ribbonX, ribbonY, ribbonW, ribbonH, 5);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(ribbonX + 5, ribbonY + 3, ribbonW - 10, 2, 1);

  c.add(scene.add.text(ribbonX + ribbonW / 2, ribbonY + ribbonH / 2 + 0.5, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '8px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawHomeSocketChip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  kind: 'M' | 'T',
  count: number,
  capacity: number,
  color: number,
): void {
  if (capacity <= 0) return;
  const complete = count >= capacity;
  const label = `${kind}${count}/${capacity}`;
  g.fillStyle(CASUAL.PANEL, 0.96);
  g.fillRoundedRect(x, y, 38, 16, 5);
  g.lineStyle(1.5, color, complete ? 0.55 : 0.9);
  g.strokeRoundedRect(x, y, 38, 16, 5);
  g.fillStyle(color, complete ? 0.85 : 0.5);
  g.fillRoundedRect(x + 2, y + 3, 4, 10, 3);
  if (!complete) {
    g.fillStyle(color, 0.5);
    g.fillCircle(x + 31, y + 8, 2);
  }
  c.add(scene.add.text(x + 20, y + 8, label, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: complete ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5));
}

function drawHomeEmptyRoomLoadoutCue(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  status: ReturnType<typeof calculateRoomLoadoutStatus>,
  accent: number,
): void {
  g.fillStyle(CASUAL.PANEL_SOFT, 0.9);
  g.fillRoundedRect(x + 10, y + 48, SLOT_W - 20, 22, 7);
  g.lineStyle(1.5, accent, 0.55);
  g.strokeRoundedRect(x + 10, y + 48, SLOT_W - 20, 22, 7);
  drawHomeSocketChip(scene, c, g, x + 13, y + 51, 'M', status.monsterCount, status.monsterCapacity, HOME_MONSTER_SLOT_COLOR);
  drawHomeSocketChip(scene, c, g, x + 51, y + 51, 'T', status.trapCount, status.trapCapacity, HOME_TRAP_SLOT_COLOR);
}

function drawConstructionScaffold(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  accent: number,
): void {
  // Bright "blueprint plot" (casual reskin): a clean cream build pad with a dashed
  // accent blueprint frame + corner pegs — reads as buildable on the bright board.
  const cx = x + SLOT_W / 2;

  // Soft cream build pad + warm ground shadow.
  g.fillStyle(CASUAL.SHADOW, 0.18);
  g.fillEllipse(cx, y + SLOT_H - 14, SLOT_W - 30, 12);
  g.fillStyle(CASUAL.PANEL_SOFT, 0.85);
  g.fillRoundedRect(x + 16, y + 26, SLOT_W - 32, SLOT_H - 44, 9);

  // Blueprint frame — accent dashes around the pad.
  g.lineStyle(1.5, accent, 0.7);
  g.strokeRoundedRect(x + 20, y + 30, SLOT_W - 40, SLOT_H - 52, 7);
  g.lineStyle(1, accent, 0.4);
  g.lineBetween(x + 28, y + 44, x + SLOT_W - 28, y + 44);
  g.lineBetween(x + 28, y + 56, x + SLOT_W - 28, y + 56);
  g.lineBetween(cx, y + 34, cx, y + 64);

  // Corner build pegs.
  g.fillStyle(accent, 0.85);
  g.fillCircle(x + 22, y + 32, 2.4);
  g.fillCircle(x + SLOT_W - 22, y + 32, 2.4);
  g.fillCircle(x + 22, y + SLOT_H - 24, 2.4);
  g.fillCircle(x + SLOT_W - 22, y + SLOT_H - 24, 2.4);

  // Warm gold guide pins.
  g.fillStyle(CASUAL.GOLD, 0.8);
  g.fillCircle(x + 31, y + 64, 2.5);
  g.fillCircle(x + SLOT_W - 31, y + 64, 2.5);
}

function addRoomShine(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  accent: number,
  readiness: number,
  seed: number,
  reducedMotion: boolean,
): void {
  if (readiness < 55) return;
  const shine = scene.add.graphics();
  shine.fillStyle(accent, 0.14);
  shine.fillRoundedRect(x + 9, y + 8, SLOT_W - 18, 4, 3);
  shine.lineStyle(1, accent, 0.26);
  shine.lineBetween(x + 18, y + SLOT_H - 20, x + SLOT_W - 18, y + SLOT_H - 24);
  shine.setAlpha(0.18);
  c.add(shine);
  // Reduced motion: keep the shine visible at a steady mid alpha (no shimmer).
  if (reducedMotion) {
    shine.setAlpha(0.30);
    return;
  }
  scene.tweens.add({
    targets: shine,
    alpha: 0.42,
    duration: 900 + (seed % 4) * 180,
    delay: seed * 70,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ─── RoomSlotContext ───────────────────────────────────────────────────────

export interface RoomSlotContext {
  readonly scene: Phaser.Scene;
  readonly theme: DungeonTheme;
  readonly gs: GameState;
  /** Whether the user prefers reduced motion — gates perpetual decorative tweens. */
  readonly reducedMotion: boolean;
  applyIdleAnimation(emoji: Phaser.GameObjects.Text, monsterId: string, compact: boolean): void;
}

// ─── drawBattleSlot ────────────────────────────────────────────────────────

export function drawBattleSlot(
  ctx: RoomSlotContext,
  c: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  index: number, unlocked: boolean,
): void {
  const { scene, gs } = ctx;

  if (!unlocked) {
    // Sealed chamber — a dim veil lets the painted dungeon backdrop show through
    // (rooms read as framed openings in the illustration, Dungeon-Maker style),
    // with a lock + unlock-level plaque. No opaque rock / bars.
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2;
    g.fillStyle(0x07040c, 0.5);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 10);
    g.lineStyle(2, CASUAL.EDGE, 0.5);
    g.strokeRoundedRect(x + 1, y + 1, SLOT_W - 2, SLOT_H - 2, 10);
    c.add(scene.add.text(cx, cy - 6, '🔒', { fontSize: '22px' }).setOrigin(0.5).setAlpha(0.82));
    const reqLv = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
    g.fillStyle(0x140d07, 0.92);
    g.fillRoundedRect(cx - 24, cy + 16, 48, 16, 4);
    g.lineStyle(1, CASUAL.EDGE, 0.6);
    g.strokeRoundedRect(cx - 24, cy + 16, 48, 16, 4);
    c.add(scene.add.text(cx, cy + 24, `Lv.${reqLv}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.9));
    return;
  }

  const slot = gs.dungeonSlots?.[index];
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot?.roomType);
  const roomMetrics = calculateRoomMetrics(gs, slot);
  const loadoutStatus = calculateRoomLoadoutStatus(gs, slot);
  const actionHint = getRoomActionHint(gs, index);

  // ── 파손 방: HP=0 특수 표시 ────────────────────────────────────────────────
  if (slot?.roomType && slot.hp <= 0) {
    // Broken room — cream tile with RED danger border + red crack marks.
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.RED, 0.12);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    g.lineStyle(2.5, CASUAL.RED, 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '파손 방', CASUAL.RED, roomMetrics.readiness, true);
    // Crack lines
    g.lineStyle(2, CASUAL.RED_DK, 0.85);
    g.lineBetween(x + 18, y + 8,  x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + SLOT_W - 14, y + SLOT_H - 6);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + 10, y + SLOT_H - 14);
    const cx = x + SLOT_W / 2;
    g.fillStyle(CASUAL.RED, 0.15);
    g.fillCircle(cx, y + SLOT_H / 2 - 10, 27);
    c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, '💥', { fontFamily: 'sans-serif', fontSize: '22px' }).setOrigin(0.5).setAlpha(0.85));
    c.add(scene.add.text(cx, y + SLOT_H / 2 + 12, '파손', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(scene.add.text(cx, y + SLOT_H - 10, '수리 필요', {
      fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    drawActionHintBadge(scene, c, g, x, y, actionHint);
    // Invasion order badge
    const order = INVASION_ORDER[index];
    if (order !== undefined) {
      const bg2 = scene.add.graphics();
      bg2.fillStyle(CASUAL.RED, 0.95);
      bg2.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
      bg2.lineStyle(1, CASUAL.RED_DK, 0.7);
      bg2.strokeRoundedRect(x + 2, y + 2, 16, 14, 3);
      c.add(bg2);
      c.add(scene.add.text(x + 10, y + 9, String(order), { fontFamily: 'monospace', fontSize: '9px', color: CASUAL_CSS.WHITE, fontStyle: 'bold' }).setOrigin(0.5));
    }
    return;
  }

  const primaryMonsterId = slot?.monsterIds?.[0];
  const typeIdForSlot = primaryMonsterId ? resolveMonsterTypeId(primaryMonsterId) : null;
  const monDef = typeIdForSlot ? MONSTER_DEFS[typeIdForSlot] : null;
  const primaryEquipment = getEquippedItem(gs, primaryMonsterId);

  if (monDef) {
    // ── Occupied cell: cream chamber with the room's saturated accent ──────
    const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.GOLD;
    // Warm shadow + cream cell body + white top highlight (matches Room.ts).
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    drawPixelRoom(g, x, y, slot?.roomType, roomAccent, roomMetrics.readiness);
    addRoomShine(scene, c, x, y, roomAccent, roomMetrics.readiness, index, ctx.reducedMotion);
    drawEquipmentPowerAura(scene, c, g, x, y, roomMetrics.equipmentPower, primaryEquipment);

    // Chunky saturated accent border.
    g.lineStyle(2.5, roomAccent, 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);

    g.fillStyle(roomAccent, 0.95);
    g.fillCircle(x + 15, y + 15, 10);
    g.lineStyle(1.5, CASUAL.EDGE, 0.8);
    g.strokeCircle(x + 15, y + 15, 10);
    c.add(scene.add.text(x + 15, y + 15, typeDef?.icon ?? '▣', {
      fontFamily: 'sans-serif', fontSize: '12px',
    }).setOrigin(0.5));
    drawRoomNameRibbon(scene, c, g, x, y, typeDef?.name ?? '던전 방', roomAccent, roomMetrics.readiness);

    // Soft accent glow behind the portrait — warm casual accent by monster type.
    const glowColor: Record<string, number> = {
      melee:   CASUAL.RED,
      ranged:  CASUAL.GOLD,
      magic:   CASUAL.PURPLE,
      support: CASUAL.GREEN,
    };
    const glow = glowColor[monDef.type] ?? roomAccent;
    const glowG = scene.add.graphics();
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2 - 10;
    for (let r = 22; r >= 6; r -= 4) {
      glowG.fillStyle(glow, 0.06 * (22 - r) / 4 + 0.05);
      glowG.fillCircle(cx, cy, r);
    }
    c.add(glowG);

    // Pixel monster sprite (transparent) standing inside the pixel room.
    const spriteKey = generateMonsterSprite(scene, (typeIdForSlot ?? primaryMonsterId ?? '') as MonsterId);
    const sprite = scene.add.image(cx, cy + 8, spriteKey).setOrigin(0.5).setScale(1.25);
    c.add(sprite);
    // Reduced motion: the sprite stands still (no perpetual idle bob).
    if (!ctx.reducedMotion) {
      scene.tweens.add({
        targets: sprite,
        y: cy + 3,
        duration: 1300 + (index % 4) * 130,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    if (primaryEquipment) {
      drawEquipmentBadge(scene, c, g, x + SLOT_W - 20, y + SLOT_H / 2 - 8, primaryEquipment);
    }

    // Level badge top-right — gold chip with white sheen.
    if (slot && slot.roomLevel > 1) {
      const badgeBg = scene.add.graphics();
      badgeBg.fillStyle(CASUAL.GOLD, 1);
      badgeBg.fillRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      badgeBg.lineStyle(1.5, CASUAL.EDGE, 0.85);
      badgeBg.strokeRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      c.add(badgeBg);
      c.add(scene.add.text(x + SLOT_W - 12, y + 8, `Lv${slot.roomLevel}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    drawRoomOperationsChip(
      scene,
      c,
      g,
      x,
      y,
      roomMetrics.readiness,
      roomMetrics.threatScore,
      roomAccent,
      loadoutStatus,
      ROOM_TYPE_SHORT_LABEL[slot?.roomType ?? ''],
    );
    drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
      x: x + 9,
      y: y + 77,
      w: SLOT_W - 18,
      h: 14,
      accent: roomAccent,
    });

    // HP bar bottom — cream track + brown edge, fill GREEN/GOLD/RED by ratio.
    if (slot) {
      const hpPct = Math.max(0, slot.hp / slot.maxHp);
      const barW  = SLOT_W - 10;
      const barY  = y + SLOT_H - 8;
      const barColor = hpPct > 0.66 ? CASUAL.GREEN : hpPct > 0.33 ? CASUAL.GOLD : CASUAL.RED;
      g.fillStyle(CASUAL.EDGE, 1);
      g.fillRoundedRect(x + 3.5, barY - 1.5, barW + 3, 7, 3);
      g.fillStyle(CASUAL.PANEL_SOFT, 1);
      g.fillRoundedRect(x + 5, barY, barW, 4, 2);
      g.fillStyle(barColor, 1);
      g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
    }
  } else {
    // ── Empty / buildable cell: cream PANEL_SOFT plot ─────────────────────
    const hasType = !!(slot?.roomType);
    g.fillStyle(CASUAL.SHADOW, 0.2);
    g.fillRoundedRect(x + 1, y + 3, SLOT_W, SLOT_H, 12);
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 12);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 8, y + 6, SLOT_W - 16, 16, 7);
    const emptyBorder = hasType ? (ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.EDGE) : CASUAL.EDGE;
    g.lineStyle(2.5, emptyBorder, hasType ? 0.9 : 1);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 12);

    if (hasType) {
      const td = typeDef;
      const cx = x + SLOT_W / 2;
      const roomAccent = ROOM_TYPE_ACCENT[slot?.roomType ?? ''] ?? CASUAL.GOLD;
      drawPixelRoom(g, x, y, slot?.roomType, roomAccent, roomMetrics.readiness);
      addRoomShine(scene, c, x, y, roomAccent, roomMetrics.readiness, index, ctx.reducedMotion);
      c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, td?.icon ?? '▣', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5).setAlpha(0.74));
      drawRoomNameRibbon(scene, c, g, x, y, td?.name ?? '던전 방', roomAccent, roomMetrics.readiness);
      drawHomeEmptyRoomLoadoutCue(scene, c, g, x, y, loadoutStatus, roomAccent);
      c.add(scene.add.text(cx, y + 73, `${ROOM_TYPE_SHORT_LABEL[slot?.roomType ?? ''] ?? '방'} 대기`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      drawRoomLoadoutRail(scene, c, g, loadoutStatus, {
        x: x + 9,
        y: y + 80,
        w: SLOT_W - 18,
        h: 12,
        accent: roomAccent,
      });
      if (slot && slot.hp < slot.maxHp) {
        const hpPct = Math.max(0, slot.hp / slot.maxHp);
        const barW  = SLOT_W - 10;
        const barY  = y + SLOT_H - 8;
        g.fillStyle(CASUAL.EDGE, 1);
        g.fillRoundedRect(x + 3.5, barY - 1.5, barW + 3, 7, 3);
        g.fillStyle(CASUAL.PANEL_SOFT, 1);
        g.fillRoundedRect(x + 5, barY, barW, 4, 2);
        g.fillStyle(hpPct > 0.66 ? CASUAL.GREEN : hpPct > 0.33 ? CASUAL.GOLD : CASUAL.RED, 1);
        g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
      }
    } else {
      // Truly empty — bright blueprint plot inviting a build.
      drawConstructionScaffold(g, x, y, CASUAL.GOLD);
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 - 14, '+', {
        fontFamily: 'Georgia, serif', fontSize: '28px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0.5));
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 + 10, '방 설계', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  if (actionHint.label !== '완비' && slot?.roomType) {
    drawActionHintBadge(scene, c, g, x, y, actionHint);
  }

  // ── Invasion order badge (top-left, all unlocked slots) ───────────────────
  const order = INVASION_ORDER[index];
  if (order !== undefined && !slot?.roomType) {
    const badgeG = scene.add.graphics();
    badgeG.fillStyle(CASUAL.GOLD, 0.95);
    badgeG.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
    badgeG.lineStyle(1, CASUAL.EDGE, 0.7);
    badgeG.strokeRoundedRect(x + 2, y + 2, 16, 14, 3);
    c.add(badgeG);
    c.add(scene.add.text(x + 10, y + 9, String(order), {
      fontFamily: 'monospace', fontSize: '9px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5));
  }
}
