// ─── Room Input ────────────────────────────────────────────────────────────────
// Extracted from DungeonScene.onRoomClick().
// Routes a room-tap through every active input mode in priority order:
//   1. MonsterSwap mode         (long-press drag initiated earlier)
//   2. SkillHUD targeting mode  (skill waiting for a target room)
//   3. Repair option            (wave active, damaged room)
//   4. Skill popup              (wave active, occupied room)
//   5. Prep-phase inspection (rooms are designed at home, never mid-battle)

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import type { RoomData } from '../data/rooms';
import { ROOM_DEFS } from '../data/rooms';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { getRoomSlotCapacity, loadGameState, ROOM_SLOT_TYPE_DEFS } from '../data/wisdom';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface RoomInputContext {
  readonly waveActive:    boolean;
  readonly equipmentMap:  Map<string, EquipmentStats>;
  readonly skillCooldowns: Map<string, number>;
  readonly speedMult:     number;
  readonly synergyCooldownMult: number;
  readonly nowMs:         number;

  get targetingSkillId(): string | null;    set targetingSkillId(v: string | null);
  get skillPopup(): Phaser.GameObjects.Container | undefined;
  set skillPopup(v: Phaser.GameObjects.Container | undefined);

  isInSwapMode(): boolean;
  routeSwapTap(row: number, col: number): void;
  startSwapPress(row: number, col: number): void;
  activateSkill(skillId: string, room: Room): void;
  showSkillCooldown(skillId: string, cdMs: number): void;
  clearSkillSelection(): void;
  showRepairOption(row: number, col: number): void;
  showSkillPopup(room: Room): void;
  showRangePreview(row: number, col: number, range: number): void;
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
  const accent     = canAfford ? CASUAL.GREEN : CASUAL.RED;
  const accentDk   = canAfford ? CASUAL.GREEN_DK : CASUAL.RED_DK;
  const card = scene.add.container(0, 0).setName('repairCommandPopup').setDepth(212).setAlpha(0);

  const panel = addFramedPanel(scene, {
    x: cardX,
    y: cardY,
    w: cardW,
    h: cardH,
    radius: 12,
    accentColor: accent,
    accentAlpha: 1,
    shadowOpacity: 0.3,
    shadowOffsetY: 5,
  });
  card.add([panel.shadow, panel.panel, panel.glow]);

  // soft cream icon tray on the left, capped with the accent color
  const shell = scene.add.graphics();
  shell.fillStyle(CASUAL.PANEL_SOFT, 1);
  shell.fillRoundedRect(cardX + 9, cardY + 12, 35, cardH - 24, 9);
  shell.fillStyle(0xffffff, 0.14);
  shell.fillRoundedRect(cardX + 12, cardY + 14, 29, 4, 2);
  shell.lineStyle(2, CASUAL.EDGE_SOFT, 1);
  shell.strokeRoundedRect(cardX + 9, cardY + 12, 35, cardH - 24, 9);
  shell.fillStyle(accent, 1);
  shell.fillRoundedRect(cardX + 13, cardY + 14, 27, 5, 2);
  card.add(shell);

  card.add(scene.add.text(cardX + 26, cardY + 34, '🔧', {
    fontFamily: 'sans-serif',
    fontSize: '15px',
  }).setOrigin(0.5));
  card.add(scene.add.text(cardX + 26, cardY + cardH - 33, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  card.add(scene.add.text(cardX + 52, cardY + 16, canAfford ? '긴급 정비' : '정비 대기', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  card.add(scene.add.text(cardX + 52, cardY + 31, roomName, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));

  const damageChip = scene.add.graphics();
  damageChip.fillStyle(accent, 1);
  damageChip.fillRoundedRect(cardX + cardW - 74, cardY + 10, 60, 20, 9);
  damageChip.fillStyle(0xffffff, 0.3);
  damageChip.fillRoundedRect(cardX + cardW - 71, cardY + 12, 54, 4, 2);
  damageChip.lineStyle(2, accentDk, 1);
  damageChip.strokeRoundedRect(cardX + cardW - 74, cardY + 10, 60, 20, 9);
  card.add(damageChip);
  card.add(scene.add.text(cardX + cardW - 44, cardY + 20, `피해 ${dmgPct}%`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: CASUAL_CSS.WHITE,
  }).setOrigin(0.5));

  const barW = cardW - 68;
  const barX = cardX + 52;
  const barY = cardY + 49;
  const hpBar = scene.add.graphics();
  hpBar.fillStyle(CASUAL.PANEL_SOFT, 1);
  hpBar.fillRoundedRect(barX, barY, barW, 10, 5);
  hpBar.fillStyle(CASUAL.GREEN, 1);
  hpBar.fillRoundedRect(barX, barY, Math.max(4, barW * hpPct), 10, 5);
  hpBar.fillStyle(CASUAL.RED, 0.85);
  hpBar.fillRoundedRect(barX + Math.max(4, barW * hpPct), barY, Math.max(0, barW * (1 - hpPct)), 10, 5);
  hpBar.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
  hpBar.strokeRoundedRect(barX, barY, barW, 10, 5);
  card.add(hpBar);

  card.add(scene.add.text(barX, cardY + 68, `HP ${beforeHp} → ${afterHp}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  card.add(scene.add.text(cardX + cardW - 15, cardY + 68, `비용 ${cost}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: canAfford ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
  }).setOrigin(1, 0.5));

  const action = addPrimaryActionButton(scene, {
    x: cardX + 51,
    y: cardY + cardH - 34,
    w: cardW - 64,
    h: 26,
    label: canAfford ? '즉시 수리' : '골드 부족',
    fontSize: '11px',
    enabled: true,
    fillColor: canAfford ? CASUAL.GREEN : CASUAL.RED,
    hoverFillColor: canAfford ? 0x6fdc70 : 0xf57a66,
    borderColor: accentDk,
    hoverBorderColor: accentDk,
    textColor: CASUAL_CSS.WHITE,
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
  return resolveOwnedMonsterProfile(monsterId)?.name ?? monsterId;
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
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  const hpStatus = hpPct > 0.66
    ? { label: '정상', color: CASUAL.GREEN, dark: CASUAL.GREEN_DK }
    : hpPct > 0.33
      ? { label: '주의', color: CASUAL.GOLD, dark: CASUAL.GOLD_DK }
      : { label: '위험', color: CASUAL.RED, dark: CASUAL.RED_DK };

  const panelW = 224;
  const panelH = 96;
  const px = Phaser.Math.Clamp(room.x, panelW / 2 + 8, CANVAS_WIDTH - panelW / 2 - 8);
  const py = room.y < 230 ? room.y + 98 : Math.max(122, room.y - 104);
  const tip = scene.add.container(px, py).setName('roomIntelTip').setDepth(205).setAlpha(0);

  const bg = scene.add.graphics();
  // chunky drop shadow + cream card body
  bg.fillStyle(CASUAL.SHADOW, 0.3);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2 + 5, panelW, panelH, 12);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
  bg.fillStyle(0xffffff, 0.14);
  bg.fillRoundedRect(-panelW / 2 + 6, -panelH / 2 + 4, panelW - 12, 5, 3);
  // soft icon tray + accent header cap
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(-panelW / 2 + 9, -panelH / 2 + 12, 31, panelH - 24, 9);
  bg.lineStyle(2, CASUAL.EDGE_SOFT, 1);
  bg.strokeRoundedRect(-panelW / 2 + 9, -panelH / 2 + 12, 31, panelH - 24, 9);
  bg.fillStyle(accent, 1);
  bg.fillRoundedRect(-panelW / 2 + 8, -panelH / 2 + 7, panelW - 16, 5, 2);
  // HP track + fill
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(-panelW / 2 + 46, panelH / 2 - 20, panelW - 59, 7, 4);
  bg.fillStyle(hpStatus.color, 1);
  bg.fillRoundedRect(-panelW / 2 + 46, panelH / 2 - 20, Math.max(4, (panelW - 59) * hpPct), 7, 4);
  // chunky brown outer border
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
  tip.add(bg);

  tip.add(scene.add.text(-panelW / 2 + 24, -panelH / 2 + 30, roomTypeDef?.icon ?? def.emoji, {
    fontFamily: 'sans-serif',
    fontSize: '16px',
  }).setOrigin(0.5));
  tip.add(scene.add.text(-panelW / 2 + 24, panelH / 2 - 24, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  tip.add(scene.add.text(-panelW / 2 + 48, -panelH / 2 + 16, '방 관리', {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, -panelH / 2 + 30, `${roomTypeDef?.name ?? def.koreanName}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  tip.add(scene.add.text(panelW / 2 - 13, -panelH / 2 + 24, `Lv.${slot?.roomLevel ?? room.roomData?.level ?? 1}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: accentCss,
    fontStyle: 'bold',
    stroke: '#ffffff',
    strokeThickness: 2,
  }).setOrigin(1, 0.5));

  const statusBg = scene.add.graphics();
  statusBg.fillStyle(hpStatus.color, 1);
  statusBg.fillRoundedRect(panelW / 2 - 52, -panelH / 2 + 34, 39, 16, 7);
  statusBg.fillStyle(0xffffff, 0.3);
  statusBg.fillRoundedRect(panelW / 2 - 50, -panelH / 2 + 35, 35, 3, 2);
  statusBg.lineStyle(1.5, hpStatus.dark, 1);
  statusBg.strokeRoundedRect(panelW / 2 - 52, -panelH / 2 + 34, 39, 16, 7);
  tip.add(statusBg);
  tip.add(scene.add.text(panelW / 2 - 32.5, -panelH / 2 + 42, hpStatus.label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.WHITE,
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
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, 17, `함정 ${trapIds.length}/${capacity.traps}  ${trapLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  tip.add(scene.add.text(-panelW / 2 + 48, panelH / 2 - 7, `HP ${Math.round(hp)}/${Math.round(maxHp)}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
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

function showDesignAtHomeTip(room: Room): void {
  const scene = room.scene;
  scene.children.getByName('designAtHomeTip')?.destroy();
  const t = scene.add.text(room.x, room.y - 30, '홈에서 설계한 방만 방어에 나섭니다', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: CASUAL_CSS.WHITE,
    stroke: '#160004',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(215).setName('designAtHomeTip');

  scene.tweens.add({
    targets: t,
    y: t.y - 14,
    alpha: 0,
    delay: 900,
    duration: 420,
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
        const cdMs = sk.cooldown * 1000 * eqCdMult * ctx.synergyCooldownMult / ctx.speedMult;
        ctx.skillCooldowns.set(`${room.row}_${room.col}_${skillId}`, ctx.nowMs + cdMs);
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

  // ── 5. Prep-phase inspection ──────────────────────────────────────────────
  // The dungeon is designed at home; a battle only tests it. Tapping a room here
  // inspects it, and tapping an unbuilt cell explains where building happens.
  ctx.skillPopup?.destroy();
  ctx.skillPopup = undefined;

  if (room.state === 'empty') {
    showDesignAtHomeTip(room);
    return;
  }

  if (room.state === 'occupied' && room.roomData) {
    showRoomIntelTip(room);
    const def = ROOM_DEFS[room.roomData.type];
    if (def && def.attackRange > 0) {
      ctx.showRangePreview(room.row, room.col, def.attackRange);
    }
  }
}
