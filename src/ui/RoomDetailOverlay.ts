/**
 * Room detail overlay — extracted from DungeonHomeScene.
 * Shows room info, type selector, monster/trap slots, upgrade/repair controls.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  saveGameState,
  getRoomSlotCapacity, getMaxRoomLevel, ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot, type RoomSlotType, type GameState,
} from '../data/wisdom';
import { MONSTER_DEFS } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  drawStalactites, drawStalagmites, drawCaveWallTexture,
} from '../themes/decorations';
import type { DungeonTheme } from '../themes/themes';
import { logger } from '../utils/logger';


// ─── Layout constants (mirrored from DungeonHomeScene) ────────────────────────

const SLOT_W = 100;
const SLOT_H = 100;


// ─── Context / State ──────────────────────────────────────────────────────────

/** Mutable state managed by the overlay functions. */
export interface RoomDetailState {
  roomDetailContainer: Phaser.GameObjects.Container | null;
  trapPickerContainer: Phaser.GameObjects.Container | null;
  monsterPickerContainer: Phaser.GameObjects.Container | null;
  roomDetailCellX: number;
  roomDetailCellY: number;
}

export function createRoomDetailState(): RoomDetailState {
  return {
    roomDetailContainer: null,
    trapPickerContainer: null,
    monsterPickerContainer: null,
    roomDetailCellX: 0,
    roomDetailCellY: 0,
  };
}

export interface RoomDetailCallbacks {
  getGameState: () => GameState;
  saveAndRefresh: () => void;
  rebuildDungeonSlots: () => void;
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

  const gs = cb.getGameState();

  // Store cell position for reopen after upgrade/assignment
  state.roomDetailCellX = cellX;
  state.roomDetailCellY = cellY;

  gs.dungeonSlots = gs.dungeonSlots ?? [];
  if (!gs.dungeonSlots[slotIdx]) {
    const cap = getRoomSlotCapacity(1);
    gs.dungeonSlots[slotIdx] = {
      monsterIds: Array(cap.monsters).fill(undefined),
      trapIds:    Array(cap.traps).fill(undefined),
      roomLevel: 1, hp: 200, maxHp: 200,
    };
    updateQuestObjective(gs, 'build_room');
    tickSubQuestProgress(gs, 'build_room');
    saveGameState(gs);
  }
  // Ensure arrays are sized to current capacity (handles upgrades)
  const slot: DungeonSlot = gs.dungeonSlots[slotIdx];
  {
    const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    if (!Array.isArray(slot.monsterIds)) slot.monsterIds = Array(cap.monsters).fill(undefined);
    if (!Array.isArray(slot.trapIds))    slot.trapIds    = Array(cap.traps).fill(undefined);
    while (slot.monsterIds.length < cap.monsters) slot.monsterIds.push(undefined);
    while (slot.trapIds.length    < cap.traps)    slot.trapIds.push(undefined);
  }
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
  const headerH = 44;
  const hdrG = scene.add.graphics();
  hdrG.fillStyle(t.panelDark, 1);
  hdrG.fillRect(-CW / 2, -CH / 2, CW, headerH);
  hdrG.lineStyle(1, t.panelBorder, 0.5);
  hdrG.lineBetween(-CW / 2, -CH / 2 + headerH, CW / 2, -CH / 2 + headerH);
  c.add(hdrG);

  const backBtn = scene.add.text(-CW / 2 + 16, -CH / 2 + headerH / 2, '← 나가기', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: t.panelBorderCSS,
  }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  backBtn.on('pointerdown', () => closeRoomDetail(state, cb));
  c.add(backBtn);

  const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot.roomType);
  const typeLabel = typeDef ? `${typeDef.icon} ${typeDef.name}` : '🏚 일반실';
  c.add(scene.add.text(0, -CH / 2 + headerH / 2,
    `방 #${slotIdx + 1}  ${typeLabel}  ${'★'.repeat(slot.roomLevel)}`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: t.textPrimary,
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

  // ── Layout constants ──────────────────────────────────────────────────────
  const secPad = 14;
  const secX   = -CW / 2 + secPad;
  const secW   = CW - secPad * 2;
  const typeStripY = -CH / 2 + headerH + 10;

  // ── Room Type Selector strip ───────────────────────────────────────────────
  const reopen = () => {
    closeRoomDetail(state, cb);
    setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 100);
  };
  const typeStripH = buildRoomTypeStrip(scene, state, theme, cb, c, slot, slotIdx, secX, secW, typeStripY, reopen);
  const monSecY = typeStripY + typeStripH + 6;

  // ── Monster Section ───────────────────────────────────────────────────────
  const monSecH = buildMonsterSection(scene, state, theme, cb, c, slot, slotIdx, secX, secW, monSecY);

  // ── Trap Section ──────────────────────────────────────────────────────────
  const trapSecY = monSecY + monSecH + 8;
  const trapSecH = buildTrapSection(scene, state, theme, cb, c, slot, slotIdx, secX, secW, trapSecY);

  // ── Durability bar ────────────────────────────────────────────────────────
  const durY    = trapSecY + trapSecH + 10;
  const hpPct   = Math.max(0, slot.hp / slot.maxHp);
  const barW    = secW - 80;
  const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? 0xc8921a : 0x8b0000;
  const durG = scene.add.graphics();
  durG.fillStyle(0x0e0900, 1);
  durG.fillRoundedRect(secX + 40, durY, barW, 10, 3);
  durG.fillStyle(barColor, 1);
  durG.fillRoundedRect(secX + 40, durY, barW * hpPct, 10, 3);
  durG.lineStyle(1, 0x664400, 0.4);
  durG.strokeRoundedRect(secX + 40, durY, barW, 10, 3);
  c.add(durG);
  c.add(scene.add.text(secX + 36, durY + 5, '내구도', {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#664400',
  }).setOrigin(1, 0.5));
  c.add(scene.add.text(secX + 40 + barW + 4, durY + 5, `${slot.hp}/${slot.maxHp}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }).setOrigin(0, 0.5));

  // ── Repair button (only when damaged) ────────────────────────────────────
  const repairY = durY + 18;
  if (slot.hp < slot.maxHp) {
    const missingHp  = slot.maxHp - slot.hp;
    const repairCost = Math.max(10, Math.ceil(missingHp / slot.maxHp * 80));
    const canRepair  = gs.homeGold >= repairCost;
    const repairBtn  = scene.add.text(
      secX + secW / 2, repairY,
      `🔧 수리  (${repairCost}g)  HP +${missingHp}`, {
        fontFamily: 'Georgia, serif', fontSize: '10px',
        color: canRepair ? '#88cc44' : '#664400',
        backgroundColor: '#0e0900', padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: canRepair });
    if (canRepair) {
      repairBtn.on('pointerover', () => repairBtn.setColor('#bbff66'));
      repairBtn.on('pointerout',  () => repairBtn.setColor('#88cc44'));
      repairBtn.on('pointerdown', () => {
        gs.homeGold -= repairCost;
        slot.hp = slot.maxHp;
        saveGameState(gs);
        logger.debug(`[REPAIR] slot ${slotIdx}: restored to ${slot.maxHp} HP (cost ${repairCost}g)`);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, cellX, cellY), 150);
      });
    }
    c.add(repairBtn);
  }

  // ── Upgrade button (capped by DM level) ──────────────────────────────────
  const maxRoomLv = getMaxRoomLevel(gs.dmLevel);
  const upgY = slot.hp < slot.maxHp ? repairY + 26 : durY + 22;
  if (slot.roomLevel < 5 && slot.roomLevel < maxRoomLv) {
    const ROOM_UPGRADE_COSTS = [150, 300, 600, 1200, 2400];
    const ROOM_UPGRADE_HP    = [300, 450, 650, 900, 1200];
    const upgCost = ROOM_UPGRADE_COSTS[slot.roomLevel - 1] ?? 1200;
    const nextHp  = ROOM_UPGRADE_HP[slot.roomLevel] ?? 1200;
    const newCap  = getRoomSlotCapacity(slot.roomLevel + 1, slot.roomType);
    const cdBonus = ['-10%', '-20%', '-30%', '-40%'][slot.roomLevel - 1] ?? '-40%';
    const upgBtn  = scene.add.text(secX + secW / 2, upgY,
      `업그레이드  Lv.${slot.roomLevel}→${slot.roomLevel + 1}  (${upgCost}g)  몬스터 ${newCap.monsters} / 함정 ${newCap.traps}`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8921a',
        backgroundColor: '#1e1206', padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    upgBtn.on('pointerover', () => upgBtn.setColor('#ffe080'));
    upgBtn.on('pointerout',  () => upgBtn.setColor('#c8921a'));
    upgBtn.on('pointerdown', () => {
      if (gs.homeGold < upgCost) return;
      gs.homeGold  -= upgCost;
      slot.roomLevel    += 1;
      slot.maxHp         = nextHp;
      slot.hp            = nextHp;
      // Expand slot arrays to new capacity
      const cap2 = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      while (slot.monsterIds.length < cap2.monsters) slot.monsterIds.push(undefined);
      while (slot.trapIds.length    < cap2.traps)    slot.trapIds.push(undefined);
      updateQuestObjective(gs, 'upgrade_room');
      tickSubQuestProgress(gs, 'upgrade_room');
      saveGameState(gs);
      logger.debug(`[ROOM UPGRADE] slot ${slotIdx}: Lv.${slot.roomLevel - 1}→Lv.${slot.roomLevel}  HP: ${slot.maxHp - 100}→${slot.maxHp}, cooldown bonus: ${cdBonus}`);
      closeRoomDetail(state, cb);
      setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, cellX, cellY), 250);
    });
    c.add(upgBtn);
  } else if (slot.roomLevel < 5 && slot.roomLevel >= maxRoomLv) {
    // Blocked by DM level
    const neededDm = [5, 10, 15, 20][slot.roomLevel - 1] ?? 20;
    c.add(scene.add.text(secX + secW / 2, upgY,
      `🔒 DM Lv.${neededDm} 달성 후 업그레이드 가능`, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#664400',
    }).setOrigin(0.5));
  } else {
    c.add(scene.add.text(secX + secW / 2, upgY, '✨ 최고 레벨 (Lv.5)', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ffe080',
    }).setOrigin(0.5));
  }

  // ── Expand animation from cell ─────────────────────────────────────────────
  const startScaleX = SLOT_W / CW;
  const startScaleY = SLOT_H / CH;
  const startX      = cellX + SLOT_W / 2 - CW / 2;
  const startY      = cellY + SLOT_H / 2 - CH / 2;
  c.setPosition(CW / 2 + startX, CH / 2 + startY).setScale(startScaleX, startScaleY);

  const STEPS = 15;
  let step = 0;
  const iv = setInterval(() => {
    step++;
    const prog    = step / STEPS;
    const ease = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog;
    c.setAlpha(ease)
     .setScale(startScaleX + (1 - startScaleX) * ease, startScaleY + (1 - startScaleY) * ease)
     .setPosition(CW / 2 + startX * (1 - ease), CH / 2 + startY * (1 - ease));
    if (step >= STEPS) {
      clearInterval(iv);
      c.setScale(1).setPosition(CW / 2, CH / 2).setAlpha(1);
    }
  }, 20);
}


// ─── Close ────────────────────────────────────────────────────────────────────

export function closeRoomDetail(
  state: RoomDetailState,
  cb: RoomDetailCallbacks,
): void {
  if (state.trapPickerContainer)   { state.trapPickerContainer.destroy();   state.trapPickerContainer   = null; }
  if (state.monsterPickerContainer) { state.monsterPickerContainer.destroy(); state.monsterPickerContainer = null; }
  if (!state.roomDetailContainer) return;
  const c = state.roomDetailContainer;
  state.roomDetailContainer = null;

  const STEPS = 10;
  let step = 0;
  const iv = setInterval(() => {
    step++;
    const prog = step / STEPS;
    c.setAlpha(1 - prog).setScale(1 - prog * 0.3);
    if (step >= STEPS) {
      clearInterval(iv);
      c.destroy();
      cb.rebuildDungeonSlots();
    }
  }, 20);
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
): number {
  const gs = _cb.getGameState();
  const stripH = 42;
  const bg = scene.add.graphics();
  bg.fillStyle(0x130c04, 0.95);
  bg.fillRoundedRect(secX, secY, secW, stripH, 6);
  bg.lineStyle(1, 0x3a2010, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, stripH, 6);
  c.add(bg);

  const btnW = (secW - 4) / 4;
  ROOM_SLOT_TYPE_DEFS.forEach((td, i) => {
    const bx   = secX + 2 + i * btnW;
    const isActive = slot.roomType === td.id;
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(isActive ? 0xc8921a : 0x241208, isActive ? 0.9 : 0.6);
    btnBg.fillRoundedRect(bx + 1, secY + 4, btnW - 2, stripH - 8, 4);
    c.add(btnBg);
    c.add(scene.add.text(bx + btnW / 2, secY + 14, td.icon, {
      fontFamily: 'sans-serif', fontSize: '14px',
    }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2, secY + 30, td.name, {
      fontFamily: 'Georgia, serif', fontSize: '8px',
      color: isActive ? '#0e0900' : '#806040',
    }).setOrigin(0.5));

    const zone = scene.add.zone(bx + btnW / 2, secY + stripH / 2, btnW - 2, stripH - 8)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      slot.roomType = td.id as RoomSlotType;
      // Resize arrays to new capacity
      const newCap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
      while (slot.monsterIds.length < newCap.monsters) slot.monsterIds.push(undefined);
      while (slot.trapIds.length    < newCap.traps)    slot.trapIds.push(undefined);
      saveGameState(gs);
      reopen();
    });
    c.add(zone);
  });

  return stripH;
}


// ─── Monster Section ──────────────────────────────────────────────────────────

function buildMonsterSection(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
): number {
  const gs = cb.getGameState();
  const cap    = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const rowH   = 58;
  const secH   = 26 + cap.monsters * rowH;

  const bg = scene.add.graphics();
  bg.fillStyle(0x241208, 1);
  bg.fillRoundedRect(secX, secY, secW, secH, 8);
  bg.lineStyle(1.5, 0xc8921a, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, secH, 8);
  c.add(bg);

  c.add(scene.add.text(secX + 12, secY + 8, `👊 몬스터 구역`, {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
  }));
  c.add(scene.add.text(secX + secW - 12, secY + 8, `${cap.monsters}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }).setOrigin(1, 0));

  for (let mi = 0; mi < cap.monsters; mi++) {
    const rowY   = secY + 24 + mi * rowH;
    const mId    = slot.monsterIds[mi];
    const om     = mId ? gs.ownedMonsters.find(m => m.id === mId) : null;
    const typeId = om ? (Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id) : null;
    const mDef   = typeId ? MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] : null;

    // Row separator
    if (mi > 0) {
      const sepG = scene.add.graphics();
      sepG.lineStyle(1, 0x3a2010, 0.3);
      sepG.lineBetween(secX + 8, rowY - 1, secX + secW - 8, rowY - 1);
      c.add(sepG);
    }

    // Slot number badge
    c.add(scene.add.text(secX + 10, rowY + rowH / 2, `${mi + 1}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#4a3020',
    }).setOrigin(0.5));

    if (mDef && om) {
      c.add(scene.add.text(secX + 30, rowY + rowH / 2, mDef.emoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5));
      c.add(scene.add.text(secX + 50, rowY + 8, `${mDef.name}  Lv.${om.level}`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#e8d090',
      }));
      c.add(scene.add.text(secX + 50, rowY + 22, `ATK:${mDef.baseDamage}  CD:${(mDef.attackCooldown/1000).toFixed(1)}s`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#a07040',
      }));
      c.add(scene.add.text(secX + 50, rowY + 34, mDef.passiveDesc, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
        fontStyle: 'italic',
      }));
      makeDetailBtn(scene, c, secX + secW - 14, rowY + rowH / 2, '교체', () => {
        showMonsterPicker(scene, state, theme, cb, slotIdx, mi);
      });
      // Remove button
      makeDetailBtn(scene, c, secX + secW - 48, rowY + rowH / 2, '제거', () => {
        slot.monsterIds[mi] = undefined;
        saveGameState(gs);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
    } else {
      c.add(scene.add.text(secX + 30, rowY + rowH / 2, '👤', {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5).setAlpha(0.3));
      c.add(scene.add.text(secX + 50, rowY + rowH / 2 - 6, `슬롯 ${mi + 1} — 비어있음`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4a3020',
      }));
      makeDetailBtn(scene, c, secX + secW - 14, rowY + rowH / 2, '배치 →', () => {
        showMonsterPicker(scene, state, theme, cb, slotIdx, mi);
      });
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
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
): number {
  const gs = cb.getGameState();
  const cap  = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const rowH = 58;
  const secH = 26 + cap.traps * rowH;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0f0f0f, 1);
  bg.fillRoundedRect(secX, secY, secW, secH, 8);
  bg.lineStyle(1.5, 0x664400, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, secH, 8);
  c.add(bg);

  c.add(scene.add.text(secX + 12, secY + 8, `🕸 함정 구역`, {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#885500',
  }));
  c.add(scene.add.text(secX + secW - 12, secY + 8, `${cap.traps}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }).setOrigin(1, 0));

  for (let ti = 0; ti < cap.traps; ti++) {
    const rowY = secY + 24 + ti * rowH;
    const trap = TRAP_DEFS.find(t => t.id === slot.trapIds[ti]);

    if (ti > 0) {
      const sepG = scene.add.graphics();
      sepG.lineStyle(1, 0x3a2010, 0.3);
      sepG.lineBetween(secX + 8, rowY - 1, secX + secW - 8, rowY - 1);
      c.add(sepG);
    }

    c.add(scene.add.text(secX + 10, rowY + rowH / 2, `${ti + 1}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#4a3020',
    }).setOrigin(0.5));

    if (trap) {
      c.add(scene.add.text(secX + 30, rowY + rowH / 2, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5));
      c.add(scene.add.text(secX + 50, rowY + 8, trap.name, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
      }));
      c.add(scene.add.text(secX + 50, rowY + 22, `효과: ${trap.desc}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#a07040',
      }));
      makeDetailBtn(scene, c, secX + secW - 14, rowY + rowH / 2, '교체', () => {
        showTrapPicker(scene, state, theme, cb, slotIdx, ti);
      });
      makeDetailBtn(scene, c, secX + secW - 48, rowY + rowH / 2, '제거', () => {
        slot.trapIds[ti] = undefined;
        const refund = Math.floor(trap.cost * 0.5);
        gs.homeGold += refund;
        saveGameState(gs);
        logger.debug(`[TRAP] slot ${slotIdx}[${ti}] removed, refund: ${refund}g`);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
    } else {
      c.add(scene.add.text(secX + 30, rowY + rowH / 2, '🔧', {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5).setAlpha(0.3));
      c.add(scene.add.text(secX + 50, rowY + rowH / 2 - 6, `슬롯 ${ti + 1} — 비어있음`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4a3020',
      }));
      makeDetailBtn(scene, c, secX + secW - 14, rowY + rowH / 2, '설치 →', () => {
        showTrapPicker(scene, state, theme, cb, slotIdx, ti);
      });
    }
  }

  return secH;
}


// ─── Detail Button Helper ─────────────────────────────────────────────────────

function makeDetailBtn(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number, y: number,
  label: string,
  cb: () => void,
): void {
  const btn = scene.add.text(x, y, label, {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: '#e8d090',
    backgroundColor: '#2a1806', padding: { x: 8, y: 4 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setColor('#ffe080'));
  btn.on('pointerout',  () => btn.setColor('#e8d090'));
  btn.on('pointerdown', cb);
  c.add(btn);
}


// ─── Trap Picker Modal ──────────────────────────────────────────────────────

export function showTrapPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  trapSlotIdx: number,
): void {
  if (state.trapPickerContainer) { state.trapPickerContainer.destroy(); state.trapPickerContainer = null; }

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const modalH = 240;
  const c = scene.add.container(0, CH).setDepth(110);  // starts offscreen bottom
  state.trapPickerContainer = c;

  // Background
  const bg = scene.add.graphics();
  bg.fillStyle(0x0e0900, 1);
  bg.fillRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
  bg.lineStyle(1, 0xc8921a, 0.5);
  bg.strokeRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
  c.add(bg);

  c.add(scene.add.text(CW / 2, 16, '함정 선택', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
  }).setOrigin(0.5, 0));

  const closeBtn = scene.add.text(CW - 14, 10, '✕', {
    fontFamily: 'sans-serif', fontSize: '14px', color: '#664422',
  }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => { state.trapPickerContainer?.destroy(); state.trapPickerContainer = null; });
  c.add(closeBtn);

  let rowY = 44;
  TRAP_DEFS.forEach(trap => {
    const locked = gs.dmLevel < trap.unlockLv;

    const rowBg = scene.add.graphics();
    rowBg.fillStyle(locked ? 0x0a0900 : 0x1a0f00, 1);
    rowBg.fillRect(8, rowY, CW - 16, 42);
    rowBg.lineStyle(1, locked ? 0x332200 : 0x664400, 0.4);
    rowBg.lineBetween(8, rowY + 42, CW - 8, rowY + 42);
    c.add(rowBg);

    const alpha = locked ? 0.4 : 1;
    c.add(scene.add.text(28, rowY + 12, trap.emoji, {
      fontFamily: 'sans-serif', fontSize: '20px',
    }).setOrigin(0.5).setAlpha(alpha));
    c.add(scene.add.text(48, rowY + 7, `${trap.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: locked ? '#4a3020' : '#c8921a',
    }).setOrigin(0, 0));
    c.add(scene.add.text(48, rowY + 22, trap.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }).setOrigin(0, 0).setAlpha(alpha));

    const costLabel = locked ? `🔒 Lv.${trap.unlockLv} 해금` : `${trap.cost}g`;
    if (locked) {
      c.add(scene.add.text(CW - 20, rowY + 14, costLabel, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
      }).setOrigin(1, 0.5));
    } else {
      const pickBtn = scene.add.text(CW - 20, rowY + 14, `${trap.cost}g  [선택]`, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#e8d090',
        backgroundColor: '#2a1806', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      pickBtn.on('pointerdown', () => {
        if (gs.homeGold < trap.cost) {
          logger.debug(`[TRAP] not enough gold (need ${trap.cost}g)`);
          return;
        }
        // Refund existing trap if replacing
        const sl = gs.dungeonSlots[slotIdx]!;
        const existingId = sl.trapIds?.[trapSlotIdx];
        if (existingId) {
          const old = TRAP_DEFS.find(t => t.id === existingId);
          if (old) { gs.homeGold += Math.floor(old.cost * 0.5); }
        }
        gs.homeGold -= trap.cost;
        if (!Array.isArray(sl.trapIds)) sl.trapIds = [];
        sl.trapIds[trapSlotIdx] = trap.id;
        saveGameState(gs);
        logger.debug(`[TRAP] slot ${slotIdx}[${trapSlotIdx}]: ${trap.id} installed, cost: ${trap.cost}g`);
        state.trapPickerContainer?.destroy();
        state.trapPickerContainer = null;
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
      c.add(pickBtn);
    }
    rowY += 44;
  });

  // Slide up animation
  const targetY = CH - modalH;
  const startY  = CH;
  const STEPS   = 12;
  let step = 0;
  const iv = setInterval(() => {
    step++;
    const prog    = step / STEPS;
    const ease = 1 - Math.pow(1 - prog, 2);
    c.setPosition(0, startY + (targetY - startY) * ease);
    if (step >= STEPS) { clearInterval(iv); c.setPosition(0, targetY); }
  }, 16);
}


// ─── Monster Picker Modal ───────────────────────────────────────────────────

export function showMonsterPicker(
  scene: Phaser.Scene,
  state: RoomDetailState,
  theme: DungeonTheme,
  cb: RoomDetailCallbacks,
  slotIdx: number,
  monsterSlotIdx = 0,
): void {
  if (state.monsterPickerContainer) { state.monsterPickerContainer.destroy(); state.monsterPickerContainer = null; }

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const monsters = gs.ownedMonsters;
  const rowH  = 52;
  const modalH = Math.min(48 + monsters.length * rowH, CH - 100);

  const c = scene.add.container(0, CH).setDepth(110);
  state.monsterPickerContainer = c;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0e0900, 1);
  bg.fillRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
  bg.lineStyle(1, 0xc8921a, 0.5);
  bg.strokeRoundedRect(0, 0, CW, modalH, { tl: 12, tr: 12, bl: 0, br: 0 });
  c.add(bg);

  c.add(scene.add.text(CW / 2, 16, '몬스터 선택', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
  }).setOrigin(0.5, 0));

  const closeBtn = scene.add.text(CW - 14, 10, '✕', {
    fontFamily: 'sans-serif', fontSize: '14px', color: '#664422',
  }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => { state.monsterPickerContainer?.destroy(); state.monsterPickerContainer = null; });
  c.add(closeBtn);

  let rowY = 44;
  monsters.forEach(om => {
    const omTypeId = Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id;
    const mDef = MONSTER_DEFS[omTypeId as keyof typeof MONSTER_DEFS];
    if (!mDef) return;

    const isAssigned = gs.dungeonSlots?.some((s, i) =>
      i !== slotIdx && (s?.monsterIds ?? []).includes(om.id),
    );

    const rowBg = scene.add.graphics();
    rowBg.fillStyle(isAssigned ? 0x0a0900 : 0x1a0f00, 1);
    rowBg.fillRect(8, rowY, CW - 16, rowH - 4);
    rowBg.lineStyle(1, 0x3a2010, 0.4);
    rowBg.lineBetween(8, rowY + rowH - 4, CW - 8, rowY + rowH - 4);
    c.add(rowBg);

    c.add(scene.add.text(28, rowY + rowH / 2 - 8, mDef.emoji, {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));
    c.add(scene.add.text(50, rowY + 8, `${mDef.name}  Lv.${om.level}`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: isAssigned ? '#4a3020' : '#e8d090',
    }));
    c.add(scene.add.text(50, rowY + 24, `ATK: ${mDef.baseDamage}  ${mDef.passiveDesc}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }));

    if (isAssigned) {
      c.add(scene.add.text(CW - 20, rowY + rowH / 2 - 8, '배치됨', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#4a3020',
      }).setOrigin(1, 0.5));
    } else {
      const pickBtn = scene.add.text(CW - 20, rowY + rowH / 2 - 8, '[배치]', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8921a',
        backgroundColor: '#2a1806', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      pickBtn.on('pointerdown', () => {
        // Remove this monster from any other slot it was in
        gs.dungeonSlots?.forEach(s => {
          if (!s?.monsterIds) return;
          const idx = s.monsterIds.indexOf(om.id);
          if (idx !== -1) s.monsterIds[idx] = undefined;
        });
        if (!gs.dungeonSlots[slotIdx]) {
          const cap = getRoomSlotCapacity(1);
          gs.dungeonSlots[slotIdx] = {
            monsterIds: Array(cap.monsters).fill(undefined),
            trapIds:    Array(cap.traps).fill(undefined),
            roomLevel: 1, hp: 200, maxHp: 200,
          };
        }
        gs.dungeonSlots[slotIdx]!.monsterIds[monsterSlotIdx] = om.id;
        saveGameState(gs);
        logger.debug(`[ROOM] slot ${slotIdx}[${monsterSlotIdx}]: ${mDef.name} (${om.id}) assigned`);
        state.monsterPickerContainer?.destroy();
        state.monsterPickerContainer = null;
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
      c.add(pickBtn);
    }
    rowY += rowH;
  });

  // Slide up
  const targetY = CH - modalH;
  const STEPS   = 12;
  let step = 0;
  const iv = setInterval(() => {
    step++;
    const prog    = step / STEPS;
    const ease = 1 - Math.pow(1 - prog, 2);
    c.setPosition(0, CH + (targetY - CH) * ease);
    if (step >= STEPS) { clearInterval(iv); c.setPosition(0, targetY); }
  }, 16);
}
