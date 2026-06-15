// ─── DungeonPlacementTray ─────────────────────────────────────────────────────
// 던전 전체 직접 배치 보드의 하단 트레이. 방을 선택하면 떠올라
// 방 타입·몬스터·함정을 한 탭에서 즉시 배치한다. 전체화면 폼(RoomDetailOverlay)
// 다이빙을 대체하는 핵심 루프 UI. 데이터 변경은 roomSlotTransactions 재사용.

import Phaser from 'phaser';
import { COLORS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  ROOM_SLOT_TYPE_DEFS, getRoomSlotCapacity, getMaxRoomLevel,
  type GameState, type DungeonSlot, type RoomSlotType,
} from '../data/wisdom';
import { MONSTER_DEFS } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import {
  assignMonsterToRoomSlot, installTrapInRoomSlot, changeRoomSlotType,
  removeMonsterFromRoomSlot, removeTrapFromRoomSlot,
  upgradeRoomSlot, getRoomUpgradeCost,
} from '../data/roomSlotTransactions';
import { addMonsterPortrait, resolveMonsterTypeId } from './MonsterPortraitView';

export interface PlacementTrayCtx {
  scene:        Phaser.Scene;
  getGameState: () => GameState;
  persist:      (state: GameState) => void;   // save + currency refresh
  rebuildSlots: () => void;                    // live board update
  openDetail:   (slotIdx: number) => void;     // advanced overlay fallback
  onClose:      () => void;                    // deselect room
}

type TrayTab = 'type' | 'monster' | 'trap';

const TAB_BAR_H = 64;
const TRAY_H    = 238;
const TRAY_Y    = CANVAS_HEIGHT - TAB_BAR_H - TRAY_H;
const PANEL_BG     = 0x12100a;
const PANEL_BG_TOP = 0x1c1810;
const VIEW_X = 6;
const VIEW_W = CANVAS_WIDTH - 12;

let container: Phaser.GameObjects.Container | null = null;
let activeTab: TrayTab = 'monster';
let activeSlot = -1;
let ctxRef: PlacementTrayCtx | null = null;

export function openPlacementTray(ctx: PlacementTrayCtx, slotIdx: number): void {
  ctxRef = ctx;
  activeSlot = slotIdx;
  render();
}

export function closePlacementTray(): void {
  container?.destroy();
  container = null;
  activeSlot = -1;
  ctxRef = null;
}

export function isPlacementTrayOpen(): boolean {
  return container !== null;
}

export function placementTraySlot(): number {
  return activeSlot;
}

function firstEmpty(arr: (string | undefined)[], cap: number): number {
  for (let i = 0; i < cap; i++) if (!arr[i]) return i;
  return 0; // full → replace first
}

function render(): void {
  if (!ctxRef) return;
  const { scene } = ctxRef;
  container?.destroy();
  const c = scene.add.container(0, 0).setDepth(120);
  container = c;

  const gs = ctxRef.getGameState();
  const slot = gs.dungeonSlots?.[activeSlot] as DungeonSlot | undefined;
  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot?.roomType);

  // ── Tap blocker: swallow taps on the panel so nothing falls through to
  //    the command deck / overlay underneath the tray ─────────────────────────
  const blocker = scene.add.zone(CANVAS_WIDTH / 2, TRAY_Y + TRAY_H / 2, CANVAS_WIDTH, TRAY_H + 12)
    .setInteractive().setDepth(120);
  blocker.on('pointerdown', () => { /* swallow */ });
  c.add(blocker);

  // ── Panel ────────────────────────────────────────────────────────────────
  const g = scene.add.graphics().setDepth(120);
  g.fillStyle(0x000000, 0.4);
  g.fillRect(0, TRAY_Y - 10, CANVAS_WIDTH, 10);
  g.fillStyle(PANEL_BG, 0.98);
  g.fillRoundedRect(VIEW_X, TRAY_Y, VIEW_W, TRAY_H, 14);
  g.fillStyle(PANEL_BG_TOP, 1);
  g.fillRoundedRect(VIEW_X, TRAY_Y, VIEW_W, 40, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.lineStyle(1.5, COLORS.JADE, 0.85);
  g.strokeRoundedRect(VIEW_X, TRAY_Y, VIEW_W, TRAY_H, 14);
  c.add(g);

  // ── Header row 1: title + 상세/닫기 ──────────────────────────────────────
  const lv = slot?.roomLevel ?? 1;
  c.add(scene.add.text(20, TRAY_Y + 11, `방 #${activeSlot + 1}  ·  ${typeDef ? typeDef.name : '미설계'}`, {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#f0e6c8', fontStyle: 'bold',
  }).setDepth(122));
  addTextButton(c, CANVAS_WIDTH - 100, TRAY_Y + 10, '상세 ▸', '#9a8a6a', () => {
    const idx = activeSlot;
    const open = ctxRef?.openDetail;
    closePlacementTray();
    open?.(idx);
  });
  addTextButton(c, CANVAS_WIDTH - 36, TRAY_Y + 10, '✕', '#cc8a6a', () => {
    const onClose = ctxRef?.onClose;
    closePlacementTray();
    onClose?.();
  });

  // ── Header row 2: capacity counters + room upgrade ───────────────────────
  const cap = getRoomSlotCapacity(lv, slot?.roomType);
  const mFilled = (slot?.monsterIds ?? []).filter(Boolean).length;
  const tFilled = (slot?.trapIds ?? []).filter(Boolean).length;
  c.add(scene.add.text(20, TRAY_Y + 36, `Lv.${lv}   👊 ${mFilled}/${cap.monsters}   🕸 ${tFilled}/${cap.traps}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#c8b890',
  }).setDepth(122));
  if (slot) {
    const maxLv = Math.min(5, getMaxRoomLevel(gs.dmLevel));
    if (lv >= maxLv) {
      c.add(scene.add.text(CANVAS_WIDTH - 22, TRAY_Y + 36, '강화 최대', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#6a6052',
      }).setOrigin(1, 0).setDepth(122));
    } else {
      const cost = getRoomUpgradeCost(lv);
      const afford = (gs.homeGold ?? 0) >= cost;
      const bw = 96, bx = CANVAS_WIDTH - 22 - bw, by = TRAY_Y + 31;
      const bg = scene.add.graphics().setDepth(121);
      bg.fillStyle(afford ? COLORS.JADE_DEEP : 0x2a2418, 0.95);
      bg.fillRoundedRect(bx, by, bw, 22, 6);
      bg.lineStyle(1, afford ? COLORS.JADE : 0x4a3d28, 1);
      bg.strokeRoundedRect(bx, by, bw, 22, 6);
      c.add(bg);
      c.add(scene.add.text(bx + bw / 2, by + 11, `방 강화 ${cost}💰`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: afford ? '#f0e6c8' : '#7a6f58', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(122));
      if (afford) {
        const z = scene.add.zone(bx + bw / 2, by + 11, bw, 22).setInteractive({ useHandCursor: true }).setDepth(124);
        z.on('pointerdown', () => {
          const r = upgradeRoomSlot(ctxRef!.getGameState(), activeSlot);
          if (r.ok) commit(r.state);
        });
        c.add(z);
      }
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: TrayTab; label: string }[] = [
    { id: 'type', label: '방 설계' },
    { id: 'monster', label: '몬스터' },
    { id: 'trap', label: '함정' },
  ];
  const tabW = 108, tabGap = 6, tabY = TRAY_Y + 62;
  let tx = (CANVAS_WIDTH - (tabs.length * tabW + (tabs.length - 1) * tabGap)) / 2;
  for (const t of tabs) {
    const on = t.id === activeTab;
    const tg = scene.add.graphics().setDepth(121);
    tg.fillStyle(on ? COLORS.JADE_DEEP : 0x241d12, on ? 0.95 : 0.8);
    tg.fillRoundedRect(tx, tabY, tabW, 30, 8);
    tg.lineStyle(1.2, on ? COLORS.JADE : 0x4a3d28, 1);
    tg.strokeRoundedRect(tx, tabY, tabW, 30, 8);
    c.add(tg);
    c.add(scene.add.text(tx + tabW / 2, tabY + 15, t.label, {
      fontFamily: 'sans-serif', fontSize: '13px',
      color: on ? '#f0e6c8' : '#9a8a6a', fontStyle: on ? 'bold' : 'normal',
    }).setOrigin(0.5).setDepth(122));
    const tID = t.id;
    const z = scene.add.zone(tx + tabW / 2, tabY + 15, tabW, 30).setInteractive({ useHandCursor: true }).setDepth(123);
    z.on('pointerdown', () => { activeTab = tID; render(); });
    c.add(z);
    tx += tabW + tabGap;
  }

  // ── Content ────────────────────────────────────────────────────────────────
  const stripY = tabY + 40;
  const stripH = TRAY_H - (stripY - TRAY_Y) - 12;
  if (activeTab === 'type') renderTypeStrip(c, slot, stripY, stripH);
  else if (activeTab === 'monster') renderMonsterStrip(c, gs, slot, stripY, stripH);
  else renderTrapStrip(c, gs, slot, stripY, stripH);
}

// ── 방 설계 ──────────────────────────────────────────────────────────────────
function renderTypeStrip(c: Phaser.GameObjects.Container, slot: DungeonSlot | undefined, y: number, h: number): void {
  const cardW = 86, gap = 8;
  const inner = buildStrip(c, y, h, ROOM_SLOT_TYPE_DEFS.length, cardW, gap);
  let x = 0;
  for (const def of ROOM_SLOT_TYPE_DEFS) {
    const on = slot?.roomType === def.id;
    const z = chipBase(inner, x, 0, cardW, h, on, COLORS.JADE);
    addText(inner, x + cardW / 2, h / 2 - 12, def.icon, '26px', '#ffffff', false, 0.5);
    addText(inner, x + cardW / 2, h - 18, def.name, '12px', on ? '#9fe1cb' : '#c8b890', on, 0.5);
    z.on('pointerdown', () => {
      const r = changeRoomSlotType(ctxRef!.getGameState(), activeSlot, def.id as RoomSlotType);
      if (r.ok) commit(r.state);
    });
    x += cardW + gap;
  }
}

// ── 몬스터 ───────────────────────────────────────────────────────────────────
function renderMonsterStrip(c: Phaser.GameObjects.Container, gs: GameState, slot: DungeonSlot | undefined, y: number, h: number): void {
  const owned = gs.ownedMonsters ?? [];
  const items = owned.map(om => {
    const typeId = resolveMonsterTypeId(om.id) ?? om.id;
    return MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] ? { om } : null;
  }).filter((v): v is { om: typeof owned[number] } => v !== null);
  if (items.length === 0) { emptyHint(c, '보유 몬스터 없음 · 소환에서 획득하세요', y + h / 2); return; }

  const placed = new Set((slot?.monsterIds ?? []).filter(Boolean) as string[]);
  const itemW = 64, gap = 8;
  const inner = buildStrip(c, y, h, items.length, itemW, gap);
  let x = 0;
  for (const { om } of items) {
    const on = placed.has(om.id);
    const z = chipBase(inner, x, 0, itemW, h, on, on ? COLORS.JADE : 0xc8921a);
    addMonsterPortrait(ctxRef!.scene, inner, x + itemW / 2, 28, om.id, {
      size: 38, depth: 122, frameColor: on ? COLORS.JADE : 0xc8921a,
    });
    addText(inner, x + itemW / 2, h - 14, on ? '✓ 해제' : `Lv.${om.level}`, '10px', on ? '#9fe1cb' : '#c8b890', false, 0.5, on ? 'sans-serif' : 'monospace');
    z.on('pointerdown', () => {
      const gsNow = ctxRef!.getGameState();
      const cur = gsNow.dungeonSlots?.[activeSlot];
      if (on) {
        const mIdx = (cur?.monsterIds ?? []).indexOf(om.id);
        if (mIdx >= 0) { const r = removeMonsterFromRoomSlot(gsNow, activeSlot, mIdx); if (r.ok) commit(r.state); }
      } else {
        const cap2 = getRoomSlotCapacity(cur?.roomLevel ?? 1, cur?.roomType);
        const mIdx = firstEmpty(cur?.monsterIds ?? [], cap2.monsters);
        const r = assignMonsterToRoomSlot(gsNow, activeSlot, mIdx, om.id);
        if (r.ok) commit(r.state);
      }
    });
    x += itemW + gap;
  }
}

// ── 함정 ─────────────────────────────────────────────────────────────────────
function renderTrapStrip(c: Phaser.GameObjects.Container, gs: GameState, slot: DungeonSlot | undefined, y: number, h: number): void {
  const placed = new Set((slot?.trapIds ?? []).filter(Boolean) as string[]);
  const itemW = 74, gap = 8;
  const inner = buildStrip(c, y, h, TRAP_DEFS.length, itemW, gap);
  let x = 0;
  for (const trap of TRAP_DEFS) {
    const locked = gs.dmLevel < trap.unlockLv;
    const afford = (gs.homeGold ?? 0) >= trap.cost;
    const on = placed.has(trap.id);
    const accent = locked ? 0x555044 : on ? COLORS.JADE : 0xc8921a;
    const z = chipBase(inner, x, 0, itemW, h, on, accent);
    addText(inner, x + itemW / 2, 20, trap.emoji, '22px', '#ffffff', false, 0.5).setAlpha(locked ? 0.35 : 1);
    addText(inner, x + itemW / 2, h - 30, trap.name, '11px', locked ? '#6a6052' : '#f0e6c8', false, 0.5);
    addText(inner, x + itemW / 2, h - 14, on ? '✓ 해제' : locked ? `Lv.${trap.unlockLv} 해금` : `${trap.cost}💰`,
      '10px', on ? '#9fe1cb' : locked ? '#6a6052' : afford ? '#c8b890' : '#cc6a5a', false, 0.5, on ? 'sans-serif' : 'monospace');
    if (on) {
      z.on('pointerdown', () => {
        const cur = ctxRef!.getGameState().dungeonSlots?.[activeSlot];
        const tIdx = (cur?.trapIds ?? []).indexOf(trap.id);
        if (tIdx >= 0) { const r = removeTrapFromRoomSlot(ctxRef!.getGameState(), activeSlot, tIdx); if (r.ok) commit(r.state); }
      });
    } else if (!locked && afford) {
      z.on('pointerdown', () => {
        const gsNow = ctxRef!.getGameState();
        const cur = gsNow.dungeonSlots?.[activeSlot];
        const cap2 = getRoomSlotCapacity(cur?.roomLevel ?? 1, cur?.roomType);
        const tIdx = firstEmpty(cur?.trapIds ?? [], cap2.traps);
        const r = installTrapInRoomSlot(gsNow, activeSlot, tIdx, trap.id);
        if (r.ok) commit(r.state);
      });
    }
    x += itemW + gap;
  }
}

// ── Shared ───────────────────────────────────────────────────────────────────
function commit(state: GameState): void {
  if (!ctxRef) return;
  ctxRef.persist(state);
  ctxRef.rebuildSlots();
  render();
}

function emptyHint(c: Phaser.GameObjects.Container, msg: string, cy: number): void {
  c.add(ctxRef!.scene.add.text(CANVAS_WIDTH / 2, cy, msg, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#9a8a6a',
  }).setOrigin(0.5).setDepth(122));
}

// Build a horizontally drag-scrollable, masked inner container. Items are drawn
// in inner-local coords starting at x=0. Returns the inner container.
function buildStrip(
  c: Phaser.GameObjects.Container, y: number, h: number, count: number, itemW: number, gap: number,
): Phaser.GameObjects.Container {
  const s = ctxRef!.scene;
  const padL = 16;
  const contentW = count * itemW + (count - 1) * gap + padL * 2;
  const inner = s.add.container(VIEW_X + padL, y).setDepth(121);
  c.add(inner);

  const maskG = s.make.graphics({});
  maskG.fillStyle(0xffffff);
  maskG.fillRect(VIEW_X, y - 4, VIEW_W, h + 8);
  inner.setMask(maskG.createGeometryMask());

  if (contentW > VIEW_W) {
    const minX = (VIEW_X + padL) + (VIEW_W - contentW);
    const baseX = VIEW_X + padL;
    let startPX = 0, dragBase = 0, dragging = false;
    const dz = s.add.zone(CANVAS_WIDTH / 2, y + h / 2, VIEW_W, h + 8).setInteractive().setDepth(120);
    c.add(dz);
    dz.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; startPX = p.x; dragBase = inner.x; });
    dz.on('pointerup', () => { dragging = false; });
    dz.on('pointerout', () => { dragging = false; });
    dz.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      inner.x = Phaser.Math.Clamp(dragBase + (p.x - startPX), minX, baseX);
    });
  }
  return inner;
}

function chipBase(
  c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, on: boolean, accent: number,
): Phaser.GameObjects.Zone {
  const s = ctxRef!.scene;
  const g = s.add.graphics().setDepth(121);
  g.fillStyle(on ? 0x1c2a22 : 0x191510, 0.95);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(on ? 2 : 1, accent, on ? 1 : 0.6);
  g.strokeRoundedRect(x, y, w, h, 8);
  c.add(g);
  const z = s.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(124);
  c.add(z);
  return z;
}

function addText(
  c: Phaser.GameObjects.Container, x: number, y: number, str: string, size: string, color: string,
  bold: boolean, origin = 0, family = 'sans-serif',
): Phaser.GameObjects.Text {
  const t = ctxRef!.scene.add.text(x, y, str, {
    fontFamily: family, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal',
  }).setOrigin(origin, 0.5).setDepth(123);
  c.add(t);
  return t;
}

function addTextButton(
  c: Phaser.GameObjects.Container, x: number, y: number, label: string, color: string, onTap: () => void,
): void {
  const s = ctxRef!.scene;
  const t = s.add.text(x, y, label, {
    fontFamily: 'sans-serif', fontSize: '13px', color, fontStyle: 'bold',
  }).setDepth(122);
  const z = s.add.zone(x + t.width / 2, y + 8, Math.max(t.width, 30) + 14, 28).setInteractive({ useHandCursor: true }).setDepth(124);
  z.on('pointerdown', onTap);
  c.add(t); c.add(z);
}
