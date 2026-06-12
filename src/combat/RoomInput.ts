// ─── Room Input ────────────────────────────────────────────────────────────────
// Extracted from DungeonScene.onRoomClick().
// Routes a room-tap through every active input mode in priority order:
//   1. MonsterSwap mode         (long-press drag initiated earlier)
//   2. SkillHUD targeting mode  (skill waiting for a target room)
//   3. Repair option            (wave active, damaged room)
//   4. Skill popup              (wave active, occupied room)
//   5. Normal build / upgrade / monster panel flow

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import type { RoomData, RoomType } from '../data/rooms';
import { ROOM_DEFS } from '../data/rooms';
import { HYBRID_DEFS } from '../data/fusion';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { getRoomSlotCapacity, loadGameState, ROOM_SLOT_TYPE_DEFS, type RoomSlotType } from '../data/wisdom';
import { getMonstersForRoom, MONSTER_DEFS, type ElementId } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import type { RoomUpgradeLoadoutSummary } from '../ui/RoomUpgradePanel';

const ROOM_SLOT_ACCENT: Record<RoomSlotType, number> = {
  combat:  0xff8a45,
  trap:    0x5fb854,
  support: 0x55b88a,
  magic:   0x9a6cd8,
};

// ─── Context ─────────────────────────────────────────────────────────────────

export interface RoomInputContext {
  readonly waveActive:    boolean;
  readonly equipmentMap:  Map<string, EquipmentStats>;
  readonly skillCooldowns: Map<string, number>;
  readonly speedMult:     number;
  readonly unlockedStage: number;
  readonly nowMs:         number;
  readonly dailyElementRestrict: ElementId | undefined | null;

  get targetingSkillId(): string | null;    set targetingSkillId(v: string | null);
  get skillPopup(): Phaser.GameObjects.Container | undefined;
  set skillPopup(v: Phaser.GameObjects.Container | undefined);
  get selectedRoom(): Room | null;          set selectedRoom(v: Room | null);

  isInSwapMode(): boolean;
  routeSwapTap(row: number, col: number): void;
  startSwapPress(row: number, col: number): void;
  activateSkill(skillId: string, room: Room): void;
  showSkillCooldown(skillId: string, cdMs: number): void;
  clearSkillSelection(): void;
  showRepairOption(row: number, col: number): void;
  showSkillPopup(room: Room): void;
  closeRoomPanel(): void;
  openRoomPanel(row: number, col: number, gold: number): void;
  openMonsterPanel(row: number, col: number, type: RoomType, unlockedStage: number, restrict?: ElementId | null): void;
  openUpgradePanel(
    row: number,
    col: number,
    roomData: RoomData,
    hints?: Array<{ name: string; desc: string }>,
    loadout?: RoomUpgradeLoadoutSummary,
  ): void;
  showRangePreview(row: number, col: number, range: number): void;
  getSynergyHints(): Array<{ name: string; desc: string }>;
  getGold(): number;
}

// ─── RepairUIContext ──────────────────────────────────────────────────────────
// Minimal context used by showRepairOption — a subset of the scene state
// needed to display and confirm a room-repair popup card.

export interface RepairUIContext {
  scene: Phaser.Scene;
  roomGrid: (RoomData | null)[][];
  rooms: Array<Array<{ x: number; y: number; updateHpBar: () => void }>>;
  get gold(): number;
  showFloatText: (x: number, y: number, text: string, color: string) => void;
  setGold: (v: number) => void;
}

// ─── showRepairOption ─────────────────────────────────────────────────────────
// Shows a slide-in repair card when the player taps a damaged room mid-wave.

export function showRepairOption(ctx: RepairUIContext, row: number, col: number): void {
  const scene = ctx.scene;
  const data = ctx.roomGrid[row]?.[col];
  if (!data || data.roomHp >= data.maxRoomHp) return;

  const def       = ROOM_DEFS[data.type];
  const cost      = Math.round(def.cost * 0.5);
  const room      = ctx.rooms[row]?.[col];
  if (!room) return;

  const canAfford = ctx.gold >= cost;
  const hpPct     = data.maxRoomHp > 0 ? data.roomHp / data.maxRoomHp : 1;
  const dmgPct    = Math.round((1 - hpPct) * 100);
  const slotIndex = getSlotIndex(row, col);
  const roomName  = ROOM_SLOT_TYPE_DEFS.find(slot => slot.id === loadGameState().dungeonSlots?.[slotIndex ?? -1]?.roomType)?.name
    ?? def.koreanName;
  const beforeHp  = Math.round(data.roomHp);
  const afterHp   = Math.round(data.maxRoomHp);

  const cardW = 228;
  const cardH = 112;
  const cardX = Phaser.Math.Clamp(room.x - cardW / 2, 8, CANVAS_WIDTH - cardW - 8);
  const preferredY = room.y < 245 ? room.y + 58 : room.y - cardH - 48;
  const cardY = Phaser.Math.Clamp(preferredY, 112, CANVAS_HEIGHT - cardH - 136);
  const accent = canAfford ? 0x5cff9b : 0xff7a5a;
  const card = scene.add.container(0, 0).setName('repairCommandPopup').setDepth(212).setAlpha(0);

  const panel = addFramedPanel(scene, {
    x: cardX,
    y: cardY,
    w: cardW,
    h: cardH,
    radius: 10,
    fillColor: 0x07131d,
    borderColor: accent,
    borderAlpha: 0.72,
    borderWidth: 1.4,
    accentColor: accent,
    accentAlpha: canAfford ? 0.7 : 0.55,
    glowColor: accent,
    glowOpacity: 0.08,
    shadowOpacity: 0.48,
    shadowOffsetY: 4,
  });
  card.add([panel.shadow, panel.panel, panel.glow]);

  const shell = scene.add.graphics();
  shell.fillStyle(0x070503, 0.38);
  shell.fillRoundedRect(cardX + 9, cardY + 10, 35, cardH - 22, 8);
  shell.fillStyle(accent, 0.16);
  shell.fillRoundedRect(cardX + 16, cardY + 19, 21, cardH - 40, 7);
  shell.fillStyle(accent, 0.36);
  shell.fillRoundedRect(cardX + 11, cardY + 10, 31, 4, 2);
  shell.fillRoundedRect(cardX + 11, cardY + cardH - 16, 31, 4, 2);
  [[cardX + 8, cardY + 8], [cardX + cardW - 14, cardY + 8], [cardX + 8, cardY + cardH - 14], [cardX + cardW - 14, cardY + cardH - 14]].forEach(([sx, sy]) => {
    shell.fillStyle(accent, 0.38);
    shell.fillRoundedRect(sx, sy, 6, 6, 2);
  });
  card.add(shell);

  card.add(scene.add.text(cardX + 26, cardY + 34, '🔧', {
    fontFamily: 'sans-serif',
    fontSize: '15px',
  }).setOrigin(0.5));
  card.add(scene.add.text(cardX + 26, cardY + cardH - 33, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    fontStyle: 'bold',
    color: canAfford ? '#a6ffd0' : '#ffb29e',
  }).setOrigin(0.5));

  card.add(scene.add.text(cardX + 52, cardY + 16, canAfford ? '긴급 정비' : '정비 대기', {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  card.add(scene.add.text(cardX + 52, cardY + 31, roomName, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '9px',
    color: '#8fb4c4',
  }).setOrigin(0, 0.5));

  const damageChip = scene.add.graphics();
  damageChip.fillStyle(canAfford ? 0x12362b : 0x3b1510, 0.86);
  damageChip.fillRoundedRect(cardX + cardW - 74, cardY + 10, 60, 20, 8);
  damageChip.lineStyle(1, accent, 0.48);
  damageChip.strokeRoundedRect(cardX + cardW - 74, cardY + 10, 60, 20, 8);
  card.add(damageChip);
  card.add(scene.add.text(cardX + cardW - 44, cardY + 20, `피해 ${dmgPct}%`, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: canAfford ? '#8cffc1' : '#ff9a78',
  }).setOrigin(0.5));

  const barW = cardW - 68;
  const barX = cardX + 52;
  const barY = cardY + 49;
  const hpBar = scene.add.graphics();
  hpBar.fillStyle(0x03090d, 0.9);
  hpBar.fillRoundedRect(barX, barY, barW, 10, 5);
  hpBar.fillStyle(0x45d982, 0.92);
  hpBar.fillRoundedRect(barX, barY, Math.max(4, barW * hpPct), 10, 5);
  hpBar.fillStyle(0xff5d46, 0.55);
  hpBar.fillRoundedRect(barX + Math.max(4, barW * hpPct), barY, Math.max(0, barW * (1 - hpPct)), 10, 5);
  hpBar.lineStyle(1, 0x5cff9b, 0.34);
  hpBar.lineBetween(barX + barW - 1, barY - 2, barX + barW - 1, barY + 12);
  hpBar.lineStyle(1, 0xffffff, 0.14);
  hpBar.strokeRoundedRect(barX, barY, barW, 10, 5);
  card.add(hpBar);

  card.add(scene.add.text(barX, cardY + 68, `HP ${beforeHp} → ${afterHp}`, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: '#e8d5aa',
  }).setOrigin(0, 0.5));
  card.add(scene.add.text(cardX + cardW - 15, cardY + 68, `비용 ${cost}`, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: canAfford ? CSS.TORCH_AMBER : '#ff8a6e',
  }).setOrigin(1, 0.5));

  const action = addPrimaryActionButton(scene, {
    x: cardX + 51,
    y: cardY + cardH - 32,
    w: cardW - 64,
    h: 24,
    label: canAfford ? '즉시 수리' : '골드 부족',
    fontSize: '11px',
    enabled: true,
    fillColor: canAfford ? 0x1b9f71 : 0x3a1b16,
    hoverFillColor: canAfford ? 0x24bd86 : 0x4b241d,
    borderColor: canAfford ? 0x8cffc1 : 0xff7a5a,
    hoverBorderColor: COLORS.TORCH_AMBER,
    textColor: canAfford ? '#fff8d8' : '#ffb29e',
    onPress: () => {
      if (!canAfford) {
        ctx.showFloatText(room.x, room.y - 20, '골드 부족!', '#ff4444');
        dismiss();
        return;
      }
      ctx.setGold(ctx.gold - cost);
      data.roomHp = data.maxRoomHp;
      room.updateHpBar();
      ctx.showFloatText(room.x, room.y - 20, '수리 완료!', '#44ff88');
      dismiss();
    },
  });
  card.add([action.bg, action.text, action.zone]);

  scene.tweens.add({ targets: card, alpha: 1, y: -4, duration: 160, ease: 'Cubic.easeOut' });

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    scene.tweens.add({
      targets: card, alpha: 0, y: card.y - 10, duration: 150,
      onComplete: () => card.destroy(),
    });
  };

  // Auto-dismiss after 4s
  scene.time.delayedCall(4000, () => dismiss());
}

// ─── Room Intel Tip ──────────────────────────────────────────────────────────

function getSlotIndex(row: number, col: number): number | null {
  return col >= 3 ? null : row * 3 + col;
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getMonsterLabel(monsterId: string): string {
  return MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS]?.name
    ?? HYBRID_DEFS[monsterId]?.name
    ?? monsterId;
}

function getMonsterToken(monsterId: string): string {
  const def = MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS];
  const hybrid = HYBRID_DEFS[monsterId];
  const emoji = def?.emoji ?? hybrid?.emoji ?? '👾';
  return `${emoji} ${shorten(def?.name ?? hybrid?.name ?? monsterId, 5)}`;
}

function getTrapToken(trapId: string): string {
  const def = TRAP_DEFS.find(trap => trap.id === trapId);
  return `${def?.emoji ?? '◇'} ${shorten(def?.name ?? trapId, 5)}`;
}

function getRoomLoadoutSummary(room: Room): RoomUpgradeLoadoutSummary | undefined {
  if (!room.roomData) return undefined;

  const gs = loadGameState();
  const slotIndex = getSlotIndex(room.row, room.col);
  const slot = slotIndex === null ? undefined : gs.dungeonSlots?.[slotIndex];
  const def = ROOM_DEFS[room.roomData.type];
  const roomTypeDef = ROOM_SLOT_TYPE_DEFS.find(td => td.id === slot?.roomType);
  const roomLevel = slot?.roomLevel ?? room.roomData.level;
  const capacity = getRoomSlotCapacity(roomLevel, slot?.roomType);
  const monsterIds = (slot?.monsterIds ?? room.roomData.monsterSlots ?? []).filter((id): id is string => Boolean(id));
  const trapIds = (slot?.trapIds ?? []).filter((id): id is string => Boolean(id));

  return {
    slotIcon: roomTypeDef?.icon ?? def.emoji,
    slotName: roomTypeDef?.name ?? def.koreanName,
    accentColor: slot?.roomType ? ROOM_SLOT_ACCENT[slot.roomType] : def.accentColor,
    roomLevel,
    monsters: monsterIds.map(getMonsterToken),
    monsterCapacity: capacity.monsters,
    traps: trapIds.map(getTrapToken),
    trapCapacity: capacity.traps,
    hp: room.roomData.roomHp ?? slot?.hp ?? def.baseHp,
    maxHp: Math.max(1, room.roomData.maxRoomHp ?? slot?.maxHp ?? def.baseHp),
  };
}

function showRoomIntelTip(room: Room): void {
  const scene = room.scene;
  scene.children.getByName('roomIntelTip')?.destroy();

  const gs = loadGameState();
  const slotIndex = getSlotIndex(room.row, room.col);
  const slot = slotIndex === null ? undefined : gs.dungeonSlots?.[slotIndex];
  const def = room.roomData ? ROOM_DEFS[room.roomData.type] : undefined;
  if (!def) return;

  const roomTypeDef = ROOM_SLOT_TYPE_DEFS.find(td => td.id === slot?.roomType);
  const capacity = getRoomSlotCapacity(slot?.roomLevel ?? room.roomData?.level ?? 1, slot?.roomType);
  const monsterIds = (slot?.monsterIds ?? room.roomData?.monsterSlots ?? []).filter((id): id is string => Boolean(id));
  const trapIds = (slot?.trapIds ?? []).filter((id): id is string => Boolean(id));
  const hp = room.roomData?.roomHp ?? slot?.hp ?? def.baseHp;
  const maxHp = Math.max(1, room.roomData?.maxRoomHp ?? slot?.maxHp ?? def.baseHp);
  const hpPct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
  const accent = def.accentColor;
  const hpStatus = hpPct > 0.66
    ? { label: '정상', color: 0x5fb854, css: '#b9ffd8' }
    : hpPct > 0.33
      ? { label: '주의', color: 0xe8c468, css: '#ffdf8a' }
      : { label: '위험', color: 0xd9594a, css: '#ffb8c9' };

  const panelW = 224;
  const panelH = 96;
  const px = Phaser.Math.Clamp(room.x, panelW / 2 + 8, CANVAS_WIDTH - panelW / 2 - 8);
  const py = room.y < 230 ? room.y + 98 : Math.max(122, room.y - 104);
  const tip = scene.add.container(px, py).setName('roomIntelTip').setDepth(205).setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(0x140c03, 0.96);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
  bg.lineStyle(1.4, accent, 0.78);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
  bg.fillStyle(0x070503, 0.32);
  bg.fillRoundedRect(-panelW / 2 + 7, -panelH / 2 + 8, 31, panelH - 20, 7);
  bg.fillStyle(accent, 0.18);
  bg.fillRoundedRect(-panelW / 2 + 8, -panelH / 2 + 7, panelW - 16, 4, 2);
  bg.fillStyle(accent, 0.16);
  bg.fillRoundedRect(-panelW / 2 + 14, -panelH / 2 + 18, 17, panelH - 40, 5);
  bg.fillStyle(0x221504, 0.86);
  bg.fillRoundedRect(-panelW / 2 + 46, panelH / 2 - 20, panelW - 59, 7, 4);
  bg.fillStyle(hpStatus.color, 0.94);
  bg.fillRoundedRect(-panelW / 2 + 46, panelH / 2 - 20, Math.max(4, (panelW - 59) * hpPct), 7, 4);
  [[-panelW / 2 + 8, -panelH / 2 + 8], [panelW / 2 - 14, -panelH / 2 + 8], [-panelW / 2 + 8, panelH / 2 - 14], [panelW / 2 - 14, panelH / 2 - 14]].forEach(([sx, sy]) => {
    bg.fillStyle(accent, 0.42);
    bg.fillRoundedRect(sx, sy, 6, 6, 2);
  });
  tip.add(bg);

  tip.add(scene.add.text(-panelW / 2 + 22, -panelH / 2 + 30, roomTypeDef?.icon ?? def.emoji, {
    fontFamily: 'sans-serif',
    fontSize: '16px',
  }).setOrigin(0.5));
  tip.add(scene.add.text(-panelW / 2 + 22, panelH / 2 - 24, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: `#${accent.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  tip.add(scene.add.text(-panelW / 2 + 48, -panelH / 2 + 16, '방 관리', {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#907a58',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, -panelH / 2 + 30, `${roomTypeDef?.name ?? def.koreanName}`, {
    fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
    fontSize: '11px',
    color: '#f0e6c8',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  tip.add(scene.add.text(panelW / 2 - 13, -panelH / 2 + 24, `Lv.${slot?.roomLevel ?? room.roomData?.level ?? 1}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: `#${accent.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const statusBg = scene.add.graphics();
  statusBg.fillStyle(hpStatus.color, 0.14);
  statusBg.fillRoundedRect(panelW / 2 - 52, -panelH / 2 + 34, 39, 16, 5);
  statusBg.lineStyle(1, hpStatus.color, 0.42);
  statusBg.strokeRoundedRect(panelW / 2 - 52, -panelH / 2 + 34, 39, 16, 5);
  tip.add(statusBg);
  tip.add(scene.add.text(panelW / 2 - 32.5, -panelH / 2 + 42, hpStatus.label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: hpStatus.css,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const monsterLabel = monsterIds.length > 0
    ? monsterIds.slice(0, 2).map(getMonsterLabel).map(name => shorten(name, 6)).join(' · ')
    : '수호자 없음';
  const trapLabel = trapIds.length > 0
    ? trapIds.slice(0, 2).map(id => TRAP_DEFS.find(trap => trap.id === id)?.name ?? id).map(name => shorten(name, 5)).join(' · ')
    : '함정 없음';

  tip.add(scene.add.text(-panelW / 2 + 48, 1, `수호 ${monsterIds.length}/${capacity.monsters}  ${monsterLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#ffd3a6',
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, 17, `함정 ${trapIds.length}/${capacity.traps}  ${trapLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#b9ffd8',
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, panelH / 2 - 7, `HP ${Math.round(hp)}/${Math.round(maxHp)}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: '#e8d5aa',
  }).setOrigin(0, 0.5));

  scene.tweens.add({ targets: tip, alpha: 1, y: py - 6, duration: 150, ease: 'Cubic.easeOut' });
  scene.time.delayedCall(2200, () => {
    if (!tip.active) return;
    scene.tweens.add({
      targets: tip,
      alpha: 0,
      y: tip.y - 8,
      duration: 160,
      onComplete: () => tip.destroy(),
    });
  });
}

function showInvalidSkillTarget(room: Room): void {
  const scene = room.scene;
  const t = scene.add.text(room.x, room.y - 34, '대상 없음', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#ffccd4',
    stroke: '#160004',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(215);

  scene.tweens.add({
    targets: t,
    y: t.y - 18,
    alpha: 0,
    duration: 580,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

// ─── onRoomClick ──────────────────────────────────────────────────────────────

export function onRoomClick(ctx: RoomInputContext, room: Room): void {
  if (room.state === 'water') return;

  // ── 1. Swap mode ─────────────────────────────────────────────────────────
  if (ctx.isInSwapMode()) {
    ctx.routeSwapTap(room.row, room.col);
    return;
  }
  if (ctx.waveActive && room.state === 'occupied') {
    ctx.startSwapPress(room.row, room.col);
  }

  // ── 2. SkillHUD targeting mode ────────────────────────────────────────────
  if (ctx.targetingSkillId) {
    if (room.state === 'occupied' && room.roomData) {
      const skillId = ctx.targetingSkillId;
      const sk      = ACTIVE_SKILLS.find(s => s.id === skillId);
      if (sk) {
        ctx.activateSkill(skillId, room);
        const eqCdMult = room.roomData.monsterSlot
          ? (ctx.equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1)
          : 1;
        const cdMs = sk.cooldown * 1000 * eqCdMult;
        ctx.skillCooldowns.set(`${room.row}_${room.col}_${skillId}`, ctx.nowMs + cdMs / ctx.speedMult);
        ctx.showSkillCooldown(skillId, cdMs);
      }
      ctx.targetingSkillId = null;
      ctx.clearSkillSelection();
    } else {
      showInvalidSkillTarget(room);
    }
    return;
  }

  // ── 3. Repair option (wave active, damaged room) ──────────────────────────
  if (ctx.waveActive && room.state === 'occupied' && room.roomData
      && room.roomData.roomHp < room.roomData.maxRoomHp) {
    ctx.showRepairOption(room.row, room.col);
    return;
  }

  // ── 4. Skill popup (wave active, occupied room) ───────────────────────────
  if (ctx.waveActive && room.state === 'occupied' && room.roomData) {
    ctx.showSkillPopup(room);
    return;
  }

  // ── 5. Normal build / upgrade / monster panel flow ────────────────────────
  ctx.skillPopup?.destroy();
  ctx.skillPopup = undefined;

  if (room.state === 'empty') {
    if (ctx.selectedRoom === room) {
      room.deselect();
      ctx.selectedRoom = null;
      ctx.closeRoomPanel();
      return;
    }
    ctx.selectedRoom?.deselect();
    room.select();
    ctx.selectedRoom = room;
    ctx.openRoomPanel(room.row, room.col, ctx.getGold());

  } else if (room.state === 'occupied' && room.roomData) {
    showRoomIntelTip(room);

    const ownedHybrid      = Object.values(HYBRID_DEFS)
      .some(h => h.roomTypes.includes(room.roomData!.type as string)
              && loadGameState().ownedMonsters.some(m => m.id === h.id));
    const hasMonstersAvail = getMonstersForRoom(room.roomData.type, ctx.unlockedStage).length > 0 || ownedHybrid;

    if (hasMonstersAvail && !room.roomData.monsterSlot) {
      ctx.openMonsterPanel(room.row, room.col, room.roomData.type as RoomType, ctx.unlockedStage, ctx.dailyElementRestrict);
    } else {
      const hints = ctx.getSynergyHints();
      ctx.openUpgradePanel(
        room.row,
        room.col,
        room.roomData,
        hints.length ? hints : undefined,
        getRoomLoadoutSummary(room),
      );
      const def = ROOM_DEFS[room.roomData.type];
      if (def && def.attackRange > 0) {
        ctx.showRangePreview(room.row, room.col, def.attackRange);
      }
    }
  }
}
