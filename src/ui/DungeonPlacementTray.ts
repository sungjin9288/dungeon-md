// ─── DungeonPlacementTray ─────────────────────────────────────────────────────
// 던전 전체 직접 배치 보드의 하단 트레이. 방을 선택하면 떠올라
// 방 타입·몬스터·함정을 한 탭에서 즉시 배치한다. 전체화면 폼(RoomDetailOverlay)
// 다이빙을 대체하는 핵심 루프 UI. 데이터 변경은 roomSlotTransactions 재사용.

import Phaser from 'phaser';
import { showToast } from './Toast';
import { countRooms, getDungeonPlan } from '../data/dungeonPlan';
import { COLORS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TOUCH_MIN } from '../constants/layout';
import {
  ROOM_SLOT_TYPE_DEFS, getRoomSlotCapacity, getMaxRoomLevel, getDmLevelForRoomLevel,
  type GameState, type DungeonSlot,
} from '../data/wisdom';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { shortenLabel } from './MonsterDetailShared';
import { TRAP_DEFS } from '../data/traps';
import { getTrapStock } from '../data/trapTransactions';
import { isMonsterOnShift } from '../data/productionTransactions';
import { ROOM_DEFS, ROOM_FAMILY, type RoomType } from '../data/rooms';
import {
  PREMIUM_BUILDING_GEMS,
  getSlotBuilding,
  listLockedPremiumBuildings,
  listUnlockedBuildings,
  purchasePremiumBuilding,
} from '../data/roomBuildings';
import { openPremiumRoomConfirm } from './PremiumRoomConfirm';
import {
  assignMonsterToRoomSlot, installTrapInRoomSlot, changeRoomSlotType,
  ensureDungeonSlot, setRoomSlotBuilding,
  removeMonsterFromRoomSlot, removeTrapFromRoomSlot,
  upgradeRoomSlot, getRoomUpgradeCost,
  repairRoomSlot, getRoomRepairCost,
} from '../data/roomSlotTransactions';
import { getRoomDesignRecommendation } from '../data/roomDesignRecommendations';
import { getMonsterLoadoutRecommendation, getTrapLoadoutRecommendation } from '../data/roomLoadoutRecommendations';
import { addTrapIcon } from './TrapIcon';
import { addMonsterPortrait } from './MonsterPortraitView';
import {
  getPlacementTrayOpeningTab,
  type PlacementTrayTab,
} from './DungeonPlacementTrayState';

export interface PlacementTrayCtx {
  scene:        Phaser.Scene;
  getGameState: () => GameState;
  persist:      (state: GameState) => void;   // save + currency refresh
  rebuildSlots: () => void;                    // live board update
  openDetail:   (slotIdx: number) => void;     // advanced overlay fallback
  onClose:      () => void;                    // deselect room
  openForgeTraps: () => void;                  // crafted trap out of stock → forge '함정' tab
  startSwap?:   (slotIdx: number) => void;     // 방 자리 바꾸기 모드(방이 둘 이상일 때)
}

const TAB_BAR_H = 64;
// Grown from 238 so every control clears the 44px touch minimum: the header
// row and tabs were 22–30px tall, which the modal harness flags as hard
// failures. Visuals stay compact; the interactive zones are the 44px ones.
const TRAY_H    = 272;
/** Minimum touch target (modal harness treats anything smaller as a failure). */
const TRAY_Y    = CANVAS_HEIGHT - TAB_BAR_H - TRAY_H;
const PANEL_BG     = 0x12100a;
const PANEL_BG_TOP = 0x1c1810;
const VIEW_X = 6;
const VIEW_W = CANVAS_WIDTH - 12;

let container: Phaser.GameObjects.Container | null = null;
let activeTab: PlacementTrayTab = 'monster';
let activeSlot = -1;
let ctxRef: PlacementTrayCtx | null = null;
/** 이번 누름이 가로 목록 끌기였는지 — 끌기 뒤 손을 떼도 칸 탭으로 처리하지 않는다. */
let stripDragMoved = false;
const STRIP_DRAG_THRESHOLD = 10;

export function openPlacementTray(ctx: PlacementTrayCtx, slotIdx: number): void {
  ctxRef = ctx;
  activeSlot = slotIdx;
  activeTab = getPlacementTrayOpeningTab(
    activeTab,
    ctx.getGameState().dungeonSlots?.[slotIdx],
  );
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

function firstEmptyStrict(arr: (string | undefined)[], cap: number): number {
  for (let i = 0; i < cap; i++) if (!arr[i]) return i;
  return -1; // no empty slot
}

// One-tap recommended loadout: design (if needed) → fill empty monster slots
// with best-fit owned monsters → top up traps while gold allows. Single commit.
function applyRecommendedLoadout(): void {
  if (!ctxRef) return;
  const timestamp = Date.now();
  let state = ctxRef.getGameState();
  let slot = state.dungeonSlots?.[activeSlot];

  if (!slot?.roomType) {
    const rec = getRoomDesignRecommendation(state, activeSlot);
    state = ensureDungeonSlot(state, activeSlot).state;
    const r = changeRoomSlotType(state, activeSlot, rec.roomType, timestamp);
    if (r.ok) state = r.state;
  }
  for (let guard = 0; guard < 6; guard++) {
    slot = state.dungeonSlots?.[activeSlot];
    const cap = getRoomSlotCapacity(slot?.roomLevel ?? 1, slot?.roomType);
    const mIdx = firstEmptyStrict(slot?.monsterIds ?? [], cap.monsters);
    if (mIdx < 0) break;
    const rec = getMonsterLoadoutRecommendation(state, activeSlot);
    if (!rec) break;
    const r = assignMonsterToRoomSlot(state, activeSlot, mIdx, rec.monsterId, timestamp);
    if (!r.ok) break;
    state = r.state;
  }
  for (let guard = 0; guard < 4; guard++) {
    slot = state.dungeonSlots?.[activeSlot];
    const cap = getRoomSlotCapacity(slot?.roomLevel ?? 1, slot?.roomType);
    const tIdx = firstEmptyStrict(slot?.trapIds ?? [], cap.traps);
    if (tIdx < 0) break;
    const rec = getTrapLoadoutRecommendation(state, activeSlot);
    if (!rec) break;
    const r = installTrapInRoomSlot(state, activeSlot, tIdx, rec.trapId);
    if (!r.ok) break;
    state = r.state;
  }
  commit(state);
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
  if (ctxRef?.startSwap && countRooms(getDungeonPlan(gs)) >= 2) {
    addTextButton(c, CANVAS_WIDTH - 170, TRAY_Y + 10, '⇄ 자리', '#d8b45a', () => {
      const idx = activeSlot;
      const start = ctxRef?.startSwap;
      closePlacementTray();
      start?.(idx);
    }, 'placement-swap');
  }
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

  // ── Header row 2: 추천 배치 · capacity counters · upgrade/repair ──────────
  const cap = getRoomSlotCapacity(lv, slot?.roomType);
  const mFilled = (slot?.monsterIds ?? []).filter(Boolean).length;
  const tFilled = (slot?.trapIds ?? []).filter(Boolean).length;
  // One-tap recommend button (left)
  {
    const bw = 92, bx = 18, by = TRAY_Y + 34;
    const bg = scene.add.graphics().setDepth(121);
    bg.fillStyle(0x3a2e5a, 0.95);
    bg.fillRoundedRect(bx, by, bw, 22, 6);
    bg.lineStyle(1, 0x9a7fd0, 1);
    bg.strokeRoundedRect(bx, by, bw, 22, 6);
    c.add(bg);
    c.add(scene.add.text(bx + bw / 2, by + 11, '✨ 추천 배치', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#e8dcff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(122));
    const z = scene.add.zone(bx + bw / 2, by + 11, bw, TOUCH_MIN).setInteractive({ useHandCursor: true }).setDepth(124);
    z.on('pointerdown', () => applyRecommendedLoadout());
    c.add(z);
  }
  c.add(scene.add.text(118, TRAY_Y + 39, `Lv.${lv} 👊${mFilled}/${cap.monsters} 🕸${tFilled}/${cap.traps}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#c8b890',
  }).setDepth(122));
  const damaged = !!slot && slot.hp < slot.maxHp;
  if (damaged) {
    // Damaged/broken room → repair takes priority over upgrade
    const cost = getRoomRepairCost(slot!);
    const afford = (gs.homeGold ?? 0) >= cost;
    const bw = 104, bx = CANVAS_WIDTH - 22 - bw, by = TRAY_Y + 34;
    const bg = scene.add.graphics().setDepth(121);
    bg.fillStyle(afford ? 0x6e2e2e : 0x2a2418, 0.95);
    bg.fillRoundedRect(bx, by, bw, 22, 6);
    bg.lineStyle(1, afford ? 0xcc6a5a : 0x4a3d28, 1);
    bg.strokeRoundedRect(bx, by, bw, 22, 6);
    c.add(bg);
    c.add(scene.add.text(bx + bw / 2, by + 11, `방 수리 ${cost}골드`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: afford ? '#ffd8c8' : '#7a6f58', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(122));
    if (afford) {
      const z = scene.add.zone(bx + bw / 2, by + 11, bw, TOUCH_MIN).setInteractive({ useHandCursor: true }).setDepth(124);
      z.on('pointerdown', () => {
        const r = repairRoomSlot(ctxRef!.getGameState(), activeSlot);
        if (r.ok) commit(r.state);
      });
      c.add(z);
    }
  } else if (slot?.roomType && lv >= 1) {
    const maxLv = Math.min(5, getMaxRoomLevel(gs.dmLevel));
    if (lv >= maxLv) {
      // A DM-gated room is not maxed: say which DM level opens the next one.
      const gateLabel = lv >= 5 ? '강화 최대' : `강화 DM${getDmLevelForRoomLevel(lv + 1)} 필요`;
      c.add(scene.add.text(CANVAS_WIDTH - 22, TRAY_Y + 36, gateLabel, {
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
      c.add(scene.add.text(bx + bw / 2, by + 11, `방 강화 ${cost}골드`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: afford ? '#f0e6c8' : '#7a6f58', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(122));
      if (afford) {
        const z = scene.add.zone(bx + bw / 2, by + 11, bw, TOUCH_MIN).setInteractive({ useHandCursor: true }).setDepth(124);
        z.setName('placement-room-upgrade');
        z.on('pointerdown', () => {
          const r = upgradeRoomSlot(ctxRef!.getGameState(), activeSlot, Date.now());
          if (r.ok) commit(r.state);
        });
        c.add(z);
      }
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: PlacementTrayTab; label: string }[] = [
    { id: 'type', label: '방 설계' },
    { id: 'monster', label: '몬스터' },
    { id: 'trap', label: '함정' },
  ];
  const tabW = 108, tabGap = 6, tabY = TRAY_Y + 84;
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
    // Named: '함정' also appears in the room title (방 #1 · 함정실), so a label
    // click is ambiguous and silently lands on the wrong control.
    const z = scene.add.zone(tx + tabW / 2, tabY + 15, tabW, TOUCH_MIN)
      .setName(`placement-tab-${t.id}`)
      .setInteractive({ useHandCursor: true }).setDepth(123);
    z.on('pointerdown', () => { activeTab = tID; render(); });
    c.add(z);
    tx += tabW + tabGap;
  }

  // ── Content ────────────────────────────────────────────────────────────────
  const stripY = tabY + 40;
  const stripH = TRAY_H - (stripY - TRAY_Y) - 12;
  if (activeTab === 'type') renderTypeStrip(c, gs, slot, stripY, stripH);
  else if (activeTab === 'monster') renderMonsterStrip(c, gs, slot, stripY, stripH);
  else renderTrapStrip(c, gs, slot, stripY, stripH);
}

// ── 방 설계 ──────────────────────────────────────────────────────────────────
// Lists every building the campaign has unlocked, in family order. Picking one
// sets both the slot's family (capacity bonus) and the room that deploys.
function renderTypeStrip(c: Phaser.GameObjects.Container, gs: GameState, slot: DungeonSlot | undefined, y: number, h: number): void {
  const cardW = 86, gap = 8;
  const buildings = listUnlockedBuildings(gs);
  const locked = listLockedPremiumBuildings(gs);
  const inner = buildStrip(c, y, h, buildings.length + locked.length, cardW, gap);
  const active = slot ? getSlotBuilding(slot) : null;
  let x = 0;
  for (const type of buildings) {
    const def = ROOM_DEFS[type];
    const family = ROOM_SLOT_TYPE_DEFS.find(t => t.id === ROOM_FAMILY[type]);
    const on = active === type;
    const z = chipBase(inner, x, 0, cardW, h, on, COLORS.JADE);
    z.setName(`placement-building-${type}`);
    addText(inner, x + cardW / 2, h / 2 - 14, def.emoji, '24px', '#ffffff', false, 0.5);
    addText(inner, x + cardW / 2, h - 30, def.koreanName, '11px', on ? '#9fe1cb' : '#c8b890', on, 0.5);
    addText(inner, x + cardW / 2, h - 14, family?.name ?? '', '10px', on ? '#9fe1cb' : '#8f8468', false, 0.5);
    onChipTap(z, () => {
      const ensured = ensureDungeonSlot(ctxRef!.getGameState(), activeSlot);
      const r = setRoomSlotBuilding(ensured.state, activeSlot, type, Date.now());
      if (r.ok) commit(r.state);
    });
    x += cardW + gap;
  }
  // 보석 특수 방(아직 안 산 것): 잠긴 칸 → 확인 창 → 해금하고 이 방에 짓는다.
  for (const type of locked) {
    const def = ROOM_DEFS[type];
    const price = PREMIUM_BUILDING_GEMS[type] ?? 0;
    const z = chipBase(inner, x, 0, cardW, h, false, 0x7fd3c4);
    z.setName(`placement-building-${type}`);
    addText(inner, x + cardW / 2, h / 2 - 14, def.emoji, '24px', '#ffffff', false, 0.5).setAlpha(0.45);
    addText(inner, x + cardW / 2, h - 30, def.koreanName, '11px', '#c8b890', false, 0.5);
    addText(inner, x + cardW / 2, h - 14, `🔒 보석 ${price}`, '10px', (gs.gems ?? 0) >= price ? '#7fd3c4' : '#8f8468', true, 0.5);
    onChipTap(z, () => openPremiumRoomConfirm(ctxRef!.scene, {
      building: type,
      gems: price,
      ownedGems: ctxRef!.getGameState().gems ?? 0,
      onConfirm: () => buyAndBuild(type),
    }));
    x += cardW + gap;
  }
}

/** 특수 방을 보석으로 해금하고 지금 방에 짓는다(설계가 거절되면 해금만 저장). */
function buyAndBuild(type: RoomType): void {
  if (!ctxRef) return;
  const bought = purchasePremiumBuilding(ctxRef.getGameState(), type);
  if (!bought.ok) {
    showToast(ctxRef.scene, bought.reason === 'insufficient_gems' ? '보석이 부족합니다' : '지금은 살 수 없습니다', { depth: 901 });
    return;
  }
  const ensured = ensureDungeonSlot(bought.state, activeSlot);
  const built = setRoomSlotBuilding(ensured.state, activeSlot, type, Date.now());
  commit(built.ok ? built.state : bought.state);
  showToast(ctxRef.scene, `${ROOM_DEFS[type].koreanName} 해금`, { depth: 901 });
}

// ── 몬스터 ───────────────────────────────────────────────────────────────────
function renderMonsterStrip(c: Phaser.GameObjects.Container, gs: GameState, slot: DungeonSlot | undefined, y: number, h: number): void {
  const owned = gs.ownedMonsters ?? [];
  const items = owned.map(om => {
    return resolveOwnedMonsterProfile(om.id) ? { om } : null;
  }).filter((v): v is { om: typeof owned[number] } => v !== null);
  if (items.length === 0) { emptyHint(c, '보유 몬스터 없음 · 소환에서 획득하세요', y + h / 2); return; }

  const placed = new Set((slot?.monsterIds ?? []).filter(Boolean) as string[]);
  const itemW = 64, gap = 8;
  const inner = buildStrip(c, y, h, items.length, itemW, gap);
  let x = 0;
  for (const { om } of items) {
    const on = placed.has(om.id);
    const z = chipBase(inner, x, 0, itemW, h, on, on ? COLORS.JADE : 0xc8921a);
    z.setName(`placement-monster-${om.id}`);
    addMonsterPortrait(ctxRef!.scene, inner, x + itemW / 2, 28, om.id, {
      size: 38, depth: 122, frameColor: on ? COLORS.JADE : 0xc8921a,
    });
    // Portrait alone did not say who is being placed.
    const profileName = resolveOwnedMonsterProfile(om.id)?.name ?? om.id;
    addText(inner, x + itemW / 2, 62, shortenLabel(profileName, 6), '10px', '#e7d6b5', true, 0.5);
    const onShift = !on && isMonsterOnShift(gs, om.id);
    addText(inner, x + itemW / 2, h - 14, on ? '✓ 해제' : onShift ? '근무 중' : `Lv.${om.level}`, '10px', on ? '#9fe1cb' : onShift ? '#c8a04a' : '#c8b890', false, 0.5, on || onShift ? 'sans-serif' : 'monospace');
    onChipTap(z, () => {
      const gsNow = ctxRef!.getGameState();
      const cur = gsNow.dungeonSlots?.[activeSlot];
      if (on) {
        const mIdx = (cur?.monsterIds ?? []).indexOf(om.id);
        if (mIdx >= 0) { const r = removeMonsterFromRoomSlot(gsNow, activeSlot, mIdx, Date.now()); if (r.ok) commit(r.state); }
      } else {
        const cap2 = getRoomSlotCapacity(cur?.roomLevel ?? 1, cur?.roomType);
        const mIdx = firstEmpty(cur?.monsterIds ?? [], cap2.monsters);
        const r = assignMonsterToRoomSlot(gsNow, activeSlot, mIdx, om.id, Date.now());
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
    // Tier 1 is bought with gold on the spot; crafted tiers come out of forge stock.
    const stock = getTrapStock(gs, trap.id);
    const afford = trap.tier === 1 ? (gs.homeGold ?? 0) >= trap.cost : stock > 0;
    const on = placed.has(trap.id);
    const accent = locked ? 0x555044 : on ? COLORS.JADE : trap.tier === 1 ? 0xc8921a : trap.tier === 2 ? 0x8ac7ff : 0xd48cff;
    const z = chipBase(inner, x, 0, itemW, h, on, accent);
    inner.add(addTrapIcon(ctxRef!.scene, trap.id, x + itemW / 2, 24, 28, locked ? 0.35 : 1).setDepth(123));
    addText(inner, x + 6, 5, `T${trap.tier}`, '10px', locked ? '#6a6052' : '#c8b890', true);
    addText(inner, x + itemW / 2, h - 30, trap.name, '11px', locked ? '#6a6052' : '#f0e6c8', false, 0.5);
    const priceLabel = trap.tier === 1 ? `${trap.cost}골드` : stock > 0 ? `재고 ${stock}` : '재고 없음';
    addText(inner, x + itemW / 2, h - 14, on ? '✓ 해제' : locked ? `Lv.${trap.unlockLv} 해금` : priceLabel,
      '10px', on ? '#9fe1cb' : locked ? '#6a6052' : afford ? '#c8b890' : '#cc6a5a', false, 0.5, on ? 'sans-serif' : 'monospace');
    if (on) {
      onChipTap(z, () => {
        const cur = ctxRef!.getGameState().dungeonSlots?.[activeSlot];
        const tIdx = (cur?.trapIds ?? []).indexOf(trap.id);
        if (tIdx >= 0) { const r = removeTrapFromRoomSlot(ctxRef!.getGameState(), activeSlot, tIdx); if (r.ok) commit(r.state); }
      });
    } else if (!locked && afford) {
      onChipTap(z, () => {
        const gsNow = ctxRef!.getGameState();
        const cur = gsNow.dungeonSlots?.[activeSlot];
        const cap2 = getRoomSlotCapacity(cur?.roomLevel ?? 1, cur?.roomType);
        const tIdx = firstEmpty(cur?.trapIds ?? [], cap2.traps);
        const r = installTrapInRoomSlot(gsNow, activeSlot, tIdx, trap.id);
        if (r.ok) commit(r.state);
      });
    } else if (!locked && trap.tier > 1) {
      onChipTap(z, () => ctxRef?.openForgeTraps());
    }
    x += itemW + gap;
  }
}

// ── Shared ───────────────────────────────────────────────────────────────────
function commit(state: GameState): void {
  if (!ctxRef) return;
  try {
    ctxRef.persist(state);
  } catch {
    showToast(ctxRef.scene, '저장 실패 · 다시 시도해주세요', { depth: 901 });
    return;
  }
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
    // Scene-level drag so a drag may start on a chip (chips cover nearly the whole strip); chips act on
    // release only when the press was not a drag (`onChipTap`).
    let startX: number | null = null;
    let dragBase = 0;
    const onDown = (p: Phaser.Input.Pointer): void => {
      stripDragMoved = false;
      startX = p.worldY >= y - 4 && p.worldY <= y + h + 4 ? p.worldX : null;
      dragBase = inner.x;
    };
    const onMove = (p: Phaser.Input.Pointer): void => {
      if (startX === null || !p.isDown) return;
      const dx = p.worldX - startX;
      if (!stripDragMoved && Math.abs(dx) < STRIP_DRAG_THRESHOLD) return;
      stripDragMoved = true;
      if (inner.active) inner.x = Phaser.Math.Clamp(dragBase + dx, minX, baseX);
    };
    const onUp = (): void => { startX = null; };
    s.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    s.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
    s.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    inner.once(Phaser.GameObjects.Events.DESTROY, () => {
      s.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      s.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
      s.input.off(Phaser.Input.Events.POINTER_UP, onUp);
    });
  }
  return inner;
}

/** 가로 목록 칸의 탭: 손을 뗄 때, 그 누름이 목록 끌기가 아니었을 때만. */
function onChipTap(z: Phaser.GameObjects.Zone, onTap: () => void): void {
  z.on('pointerup', () => { if (!stripDragMoved) onTap(); });
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
  c: Phaser.GameObjects.Container, x: number, y: number, label: string, color: string, onTap: () => void, name?: string,
): void {
  const s = ctxRef!.scene;
  const t = s.add.text(x, y, label, {
    fontFamily: 'sans-serif', fontSize: '13px', color, fontStyle: 'bold',
  }).setDepth(122);
  // Zone is the touch target, not the glyph: 13px labels would otherwise leave
  // a 28px-tall tap area, under the 44px minimum the harness enforces.
  const z = s.add.zone(x + t.width / 2, y + 8, Math.max(t.width, TOUCH_MIN) + 14, TOUCH_MIN).setInteractive({ useHandCursor: true }).setDepth(124);
  if (name) z.setName(name);
  z.on('pointerdown', onTap);
  c.add(t); c.add(z);
}
