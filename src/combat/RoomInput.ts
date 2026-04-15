// ─── Room Input ────────────────────────────────────────────────────────────────
// Extracted from DungeonScene.onRoomClick().
// Routes a room-tap through every active input mode in priority order:
//   1. MonsterSwap mode         (long-press drag initiated earlier)
//   2. SkillHUD targeting mode  (skill waiting for a target room)
//   3. Repair option            (wave active, damaged room)
//   4. Skill popup              (wave active, occupied room)
//   5. Normal build / upgrade / monster panel flow

import { Room } from '../objects/Room';
import type { RoomData, RoomType } from '../data/rooms';
import { ROOM_DEFS } from '../data/rooms';
import { HYBRID_DEFS } from '../data/fusion';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { loadGameState } from '../data/wisdom';
import { getMonstersForRoom, type ElementId } from '../data/monsters';

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
  openUpgradePanel(row: number, col: number, roomData: RoomData, hints?: Array<{ name: string; desc: string }>): void;
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

  const card = scene.add.container(room.x, room.y - 44).setDepth(90).setAlpha(0);

  // Card background
  const cw = 136, ch = 54;
  const bg = scene.add.graphics();
  bg.fillStyle(0x0d0500, 0.95);
  bg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  bg.lineStyle(1.5, canAfford ? 0x44cc44 : 0xcc4444, 0.85);
  bg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 6);
  card.add(bg);

  // HP state bar (red = damaged, green = repaired)
  const barW = cw - 16;
  const barBg2 = scene.add.graphics();
  barBg2.fillStyle(0x330000, 1);
  barBg2.fillRect(-barW / 2, -ch / 2 + 6, barW, 5);
  barBg2.fillStyle(0x44cc44, 1);
  barBg2.fillRect(-barW / 2, -ch / 2 + 6, Math.round(barW * hpPct), 5);
  barBg2.fillStyle(0x882222, 1);
  barBg2.fillRect(-barW / 2 + Math.round(barW * hpPct), -ch / 2 + 6, Math.round(barW * (1 - hpPct)), 5);
  card.add(barBg2);

  // Damage label
  card.add(scene.add.text(0, -5, `🔧 수리  (-${dmgPct}% 피해)`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
  }).setOrigin(0.5));

  // Confirm button
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(canAfford ? 0x225522 : 0x442222, 1);
  btnBg.fillRoundedRect(-cw / 2 + 6, 8, cw - 12, 18, 4);
  card.add(btnBg);

  const btnLabel = canAfford ? `확인  ${cost}💰` : `골드 부족  ${cost}💰`;
  card.add(scene.add.text(0, 17, btnLabel, {
    fontFamily: 'sans-serif', fontSize: '10px',
    color: canAfford ? '#88ff88' : '#ff6666',
  }).setOrigin(0.5));

  // Click zone over button
  const zone = scene.add.zone(0, 17, cw - 12, 18).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    if (!canAfford) {
      ctx.showFloatText(room.x, room.y - 20, '골드 부족!', '#ff4444');
      dismiss();
      return;
    }
    ctx.setGold(ctx.gold - cost);
    data.roomHp = data.maxRoomHp;
    room.updateHpBar();
    ctx.showFloatText(room.x, room.y - 20, `🔧 수리 완료!`, '#44ff88');
    dismiss();
  });
  card.add(zone);

  // Slide-in animation
  scene.tweens.add({ targets: card, alpha: 1, y: room.y - 52, duration: 180, ease: 'Back.easeOut' });

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    scene.tweens.add({
      targets: card, alpha: 0, y: card.y - 8, duration: 140,
      onComplete: () => card.destroy(),
    });
  };

  // Auto-dismiss after 4s
  scene.time.delayedCall(4000, () => dismiss());
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
  if (ctx.targetingSkillId && room.state === 'occupied' && room.roomData) {
    const skillId = ctx.targetingSkillId;
    const sk      = ACTIVE_SKILLS.find(s => s.id === skillId);
    if (sk) {
      ctx.activateSkill(skillId, room);
      const eqCdMult = room.roomData.monsterSlot
        ? (ctx.equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1)
        : 1;
      const cdMs = sk.cooldown * 1000 * eqCdMult;
      ctx.skillCooldowns.set(`${skillId}:${room.row}:${room.col}`, ctx.nowMs + cdMs / ctx.speedMult);
      ctx.showSkillCooldown(skillId, cdMs);
    }
    ctx.targetingSkillId = null;
    ctx.clearSkillSelection();
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
    const ownedHybrid      = Object.values(HYBRID_DEFS)
      .some(h => h.roomTypes.includes(room.roomData!.type as string)
              && loadGameState().ownedMonsters.some(m => m.id === h.id));
    const hasMonstersAvail = getMonstersForRoom(room.roomData.type, ctx.unlockedStage).length > 0 || ownedHybrid;

    if (hasMonstersAvail && !room.roomData.monsterSlot) {
      ctx.openMonsterPanel(room.row, room.col, room.roomData.type as RoomType, ctx.unlockedStage, ctx.dailyElementRestrict);
    } else {
      const hints = ctx.getSynergyHints();
      ctx.openUpgradePanel(room.row, room.col, room.roomData, hints.length ? hints : undefined);
      const def = ROOM_DEFS[room.roomData.type];
      if (def && def.attackRange > 0) {
        ctx.showRangePreview(room.row, room.col, def.attackRange);
      }
    }
  }
}
