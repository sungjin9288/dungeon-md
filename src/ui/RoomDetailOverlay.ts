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
import { showTrapPicker, showMonsterPicker } from './RoomPickerModals';
import type { PickerNavCallbacks } from './RoomPickerModals';

export type { PickerNavCallbacks };


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

  // ── Layout constants ──────────────────────────────────────────────────────
  const secPad = 16;
  const secX   = -CW / 2 + secPad;
  const secW   = CW - secPad * 2;
  const typeStripY = -CH / 2 + headerH + 12;

  // ── Nav callbacks (avoids circular import with RoomPickerModals) ─────────
  const nav: PickerNavCallbacks = {
    closeRoomDetail,
    openRoomDetail,
  };

  // ── Room Type Selector strip ───────────────────────────────────────────────
  const reopen = () => {
    closeRoomDetail(state, cb);
    setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 100);
  };
  const typeStripH = buildRoomTypeStrip(scene, state, theme, cb, c, slot, slotIdx, secX, secW, typeStripY, reopen);
  const monSecY = typeStripY + typeStripH + 6;

  // ── Monster Section ───────────────────────────────────────────────────────
  const monSecH = buildMonsterSection(scene, state, theme, cb, nav, c, slot, slotIdx, secX, secW, monSecY);

  // ── Trap Section ──────────────────────────────────────────────────────────
  const trapSecY = monSecY + monSecH + 8;
  const trapSecH = buildTrapSection(scene, state, theme, cb, nav, c, slot, slotIdx, secX, secW, trapSecY);

  // ── Durability bar ────────────────────────────────────────────────────────
  const durY    = trapSecY + trapSecH + 14;
  const hpPct   = Math.max(0, slot.hp / slot.maxHp);
  const barW    = secW - 90;
  const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? 0xc8921a : 0x8b0000;
  const durG = scene.add.graphics();
  durG.fillStyle(0x0e0900, 1);
  durG.fillRoundedRect(secX + 52, durY, barW, 14, 5);
  durG.fillStyle(barColor, 1);
  durG.fillRoundedRect(secX + 52, durY, barW * hpPct, 14, 5);
  durG.lineStyle(1, 0x664400, 0.4);
  durG.strokeRoundedRect(secX + 52, durY, barW, 14, 5);
  c.add(durG);
  c.add(scene.add.text(secX + 48, durY + 7, '내구도', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#664400',
  }).setOrigin(1, 0.5));
  c.add(scene.add.text(secX + 52 + barW + 6, durY + 7, `${slot.hp}/${slot.maxHp}`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#806040',
  }).setOrigin(0, 0.5));

  // ── Repair button (only when damaged) ────────────────────────────────────
  const repairY = durY + 26;
  if (slot.hp < slot.maxHp) {
    const missingHp  = slot.maxHp - slot.hp;
    const repairCost = Math.max(10, Math.ceil(missingHp / slot.maxHp * 80));
    const canRepair  = gs.homeGold >= repairCost;
    const repairBtn  = scene.add.text(
      secX + secW / 2, repairY,
      `🔧 수리  (${repairCost}g)  HP +${missingHp}`, {
        fontFamily: 'Georgia, serif', fontSize: '14px',
        color: canRepair ? '#88cc44' : '#664400',
        backgroundColor: '#0e0900', padding: { x: 16, y: 8 },
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
  const upgY = slot.hp < slot.maxHp ? repairY + 40 : durY + 28;
  if (slot.roomLevel < 5 && slot.roomLevel < maxRoomLv) {
    const ROOM_UPGRADE_COSTS = [150, 300, 600, 1200, 2400];
    const ROOM_UPGRADE_HP    = [300, 450, 650, 900, 1200];
    const upgCost = ROOM_UPGRADE_COSTS[slot.roomLevel - 1] ?? 1200;
    const nextHp  = ROOM_UPGRADE_HP[slot.roomLevel] ?? 1200;
    const newCap  = getRoomSlotCapacity(slot.roomLevel + 1, slot.roomType);
    const cdBonus = ['-10%', '-20%', '-30%', '-40%'][slot.roomLevel - 1] ?? '-40%';
    const upgBtn  = scene.add.text(secX + secW / 2, upgY,
      `⬆️  Lv.${slot.roomLevel}→${slot.roomLevel + 1}  업그레이드  (${upgCost}g)\n몬스터 ${newCap.monsters}슬롯 / 함정 ${newCap.traps}슬롯`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
        backgroundColor: '#1e1206', padding: { x: 14, y: 10 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    upgBtn.on('pointerover', () => upgBtn.setColor('#ffe080'));
    upgBtn.on('pointerout',  () => upgBtn.setColor('#c8921a'));
    upgBtn.on('pointerdown', () => {
      if (gs.homeGold < upgCost) return;
      showRoomUpgradeConfirm(scene, upgCost, slot.roomLevel, newCap, () => {
        gs.homeGold  -= upgCost;
        slot.roomLevel    += 1;
        slot.maxHp         = nextHp;
        slot.hp            = nextHp;
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
    });
    c.add(upgBtn);
  } else if (slot.roomLevel < 5 && slot.roomLevel >= maxRoomLv) {
    const neededDm = [5, 10, 15, 20][slot.roomLevel - 1] ?? 20;
    c.add(scene.add.text(secX + secW / 2, upgY,
      `🔒 DM Lv.${neededDm} 달성 후 업그레이드 가능`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#664400',
      backgroundColor: '#0e0900', padding: { x: 14, y: 8 },
    }).setOrigin(0.5));
  } else {
    c.add(scene.add.text(secX + secW / 2, upgY, '✨ 최고 레벨 (Lv.5)', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffe080',
    }).setOrigin(0.5));
  }

  // ── Room type bonus info card ─────────────────────────────────────────────
  const bonusCardY = upgY + (slot.roomLevel < 5 ? 64 : 36);
  const bonusDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === (slot.roomType ?? 'combat'));
  if (bonusDef) {
    const cardH = 80;
    const cardG = scene.add.graphics();
    cardG.fillStyle(0x180e00, 0.9);
    cardG.fillRoundedRect(secX, bonusCardY, secW, cardH, 10);
    cardG.lineStyle(1, 0xc8921a, 0.25);
    cardG.strokeRoundedRect(secX, bonusCardY, secW, cardH, 10);
    c.add(cardG);
    c.add(scene.add.text(secX + 14, bonusCardY + 12, `${bonusDef.icon} ${bonusDef.name} 보너스`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a',
    }));
    c.add(scene.add.text(secX + 14, bonusCardY + 34, bonusDef.bonus, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#a07040',
      wordWrap: { width: secW - 28 },
    }));
    c.add(scene.add.text(secX + 14, bonusCardY + 58, `현재 레벨: Lv.${slot.roomLevel}  /  내구도: ${slot.hp}/${slot.maxHp}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#664400',
    }));
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
  const stripH = 60;
  const bg = scene.add.graphics();
  bg.fillStyle(0x130c04, 0.95);
  bg.fillRoundedRect(secX, secY, secW, stripH, 8);
  bg.lineStyle(1, 0x3a2010, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, stripH, 8);
  c.add(bg);

  const btnW = (secW - 4) / 4;
  ROOM_SLOT_TYPE_DEFS.forEach((td, i) => {
    const bx   = secX + 2 + i * btnW;
    const isActive = slot.roomType === td.id;
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(isActive ? 0xc8921a : 0x241208, isActive ? 0.9 : 0.6);
    btnBg.fillRoundedRect(bx + 1, secY + 4, btnW - 2, stripH - 8, 6);
    c.add(btnBg);
    c.add(scene.add.text(bx + btnW / 2, secY + 18, td.icon, {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5));
    c.add(scene.add.text(bx + btnW / 2, secY + 44, td.name, {
      fontFamily: 'Georgia, serif', fontSize: '11px',
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
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
): number {
  const gs = cb.getGameState();
  const cap    = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const rowH   = 80;
  const secH   = 36 + cap.monsters * rowH;

  const bg = scene.add.graphics();
  bg.fillStyle(0x241208, 1);
  bg.fillRoundedRect(secX, secY, secW, secH, 10);
  bg.lineStyle(1.5, 0xc8921a, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, secH, 10);
  c.add(bg);

  c.add(scene.add.text(secX + 14, secY + 10, `👊 몬스터 구역`, {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
  }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${cap.monsters}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#806040',
  }).setOrigin(1, 0));

  for (let mi = 0; mi < cap.monsters; mi++) {
    const rowY   = secY + 34 + mi * rowH;
    const mId    = slot.monsterIds[mi];
    const om     = mId ? gs.ownedMonsters.find(m => m.id === mId) : null;
    const typeId = om ? (Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id) : null;
    const mDef   = typeId ? MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] : null;

    // Row separator
    if (mi > 0) {
      const sepG = scene.add.graphics();
      sepG.lineStyle(1, 0x3a2010, 0.3);
      sepG.lineBetween(secX + 8, rowY - 2, secX + secW - 8, rowY - 2);
      c.add(sepG);
    }

    // Slot number badge
    c.add(scene.add.text(secX + 12, rowY + rowH / 2, `${mi + 1}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#4a3020',
    }).setOrigin(0.5));

    if (mDef && om) {
      c.add(scene.add.text(secX + 36, rowY + rowH / 2, mDef.emoji, {
        fontFamily: 'sans-serif', fontSize: '32px',
      }).setOrigin(0.5));
      c.add(scene.add.text(secX + 58, rowY + 10, `${mDef.name}  Lv.${om.level}`, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#e8d090',
      }));
      c.add(scene.add.text(secX + 58, rowY + 30, `ATK:${mDef.baseDamage}  CD:${(mDef.attackCooldown/1000).toFixed(1)}s`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#a07040',
      }));
      c.add(scene.add.text(secX + 58, rowY + 50, mDef.passiveDesc, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#806040',
        fontStyle: 'italic',
      }));
      makeDetailBtn(scene, c, secX + secW - 16, rowY + rowH / 2, '교체', () => {
        showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
      });
      makeDetailBtn(scene, c, secX + secW - 56, rowY + rowH / 2, '제거', () => {
        slot.monsterIds[mi] = undefined;
        saveGameState(gs);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
    } else {
      c.add(scene.add.text(secX + 36, rowY + rowH / 2, '👤', {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5).setAlpha(0.3));
      c.add(scene.add.text(secX + 58, rowY + rowH / 2 - 8, `슬롯 ${mi + 1} — 비어있음`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#4a3020',
      }));
      makeDetailBtn(scene, c, secX + secW - 16, rowY + rowH / 2, '배치 →', () => {
        showMonsterPicker(scene, state, theme, cb, nav, slotIdx, mi);
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
  nav: PickerNavCallbacks,
  c: Phaser.GameObjects.Container,
  slot: DungeonSlot,
  slotIdx: number,
  secX: number, secW: number, secY: number,
): number {
  const gs = cb.getGameState();
  const cap  = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const rowH = 80;
  const secH = 36 + cap.traps * rowH;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0f0f0f, 1);
  bg.fillRoundedRect(secX, secY, secW, secH, 10);
  bg.lineStyle(1.5, 0x664400, 0.4);
  bg.strokeRoundedRect(secX, secY, secW, secH, 10);
  c.add(bg);

  c.add(scene.add.text(secX + 14, secY + 10, `🕸 함정 구역`, {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#885500',
  }));
  c.add(scene.add.text(secX + secW - 14, secY + 10, `${cap.traps}슬롯`, {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#806040',
  }).setOrigin(1, 0));

  for (let ti = 0; ti < cap.traps; ti++) {
    const rowY = secY + 34 + ti * rowH;
    const trap = TRAP_DEFS.find(t => t.id === slot.trapIds[ti]);

    if (ti > 0) {
      const sepG = scene.add.graphics();
      sepG.lineStyle(1, 0x3a2010, 0.3);
      sepG.lineBetween(secX + 8, rowY - 2, secX + secW - 8, rowY - 2);
      c.add(sepG);
    }

    c.add(scene.add.text(secX + 12, rowY + rowH / 2, `${ti + 1}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#4a3020',
    }).setOrigin(0.5));

    if (trap) {
      c.add(scene.add.text(secX + 36, rowY + rowH / 2, trap.emoji, {
        fontFamily: 'sans-serif', fontSize: '30px',
      }).setOrigin(0.5));
      c.add(scene.add.text(secX + 58, rowY + 10, trap.name, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8921a',
      }));
      c.add(scene.add.text(secX + 58, rowY + 32, `효과: ${trap.desc}`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#a07040',
      }));
      makeDetailBtn(scene, c, secX + secW - 16, rowY + rowH / 2, '교체', () => {
        showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
      });
      makeDetailBtn(scene, c, secX + secW - 56, rowY + rowH / 2, '제거', () => {
        slot.trapIds[ti] = undefined;
        const refund = Math.floor(trap.cost * 0.5);
        gs.homeGold += refund;
        saveGameState(gs);
        logger.debug(`[TRAP] slot ${slotIdx}[${ti}] removed, refund: ${refund}g`);
        closeRoomDetail(state, cb);
        setTimeout(() => openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
      });
    } else {
      c.add(scene.add.text(secX + 36, rowY + rowH / 2, '🔧', {
        fontFamily: 'sans-serif', fontSize: '24px',
      }).setOrigin(0.5).setAlpha(0.3));
      c.add(scene.add.text(secX + 58, rowY + rowH / 2 - 9, `슬롯 ${ti + 1} — 비어있음`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#4a3020',
      }));
      makeDetailBtn(scene, c, secX + secW - 16, rowY + rowH / 2, '설치 →', () => {
        showTrapPicker(scene, state, theme, cb, nav, slotIdx, ti);
      });
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

  const bg = scene.add.graphics();
  bg.fillStyle(0x1e1206, 1);
  bg.fillRoundedRect(OX, OY, OW, OH, 8);
  bg.lineStyle(2, 0xc8921a, 0.9);
  bg.strokeRoundedRect(OX, OY, OW, OH, 8);
  ov.add(bg);

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

  const confirmBtn = scene.add.text(CANVAS_WIDTH / 2 - 50, OY + OH - 28, '업그레이드', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8921a',
    backgroundColor: '#2a1400', padding: { x: 16, y: 7 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  confirmBtn.on('pointerdown', () => { ov.destroy(true); onConfirm(); });
  ov.add(confirmBtn);

  const cancelBtn = scene.add.text(CANVAS_WIDTH / 2 + 50, OY + OH - 28, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#664422',
    backgroundColor: '#111111', padding: { x: 16, y: 7 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  cancelBtn.on('pointerdown', () => ov.destroy(true));
  ov.add(cancelBtn);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
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
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8d090',
    backgroundColor: '#2a1806', padding: { x: 10, y: 7 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setColor('#ffe080'));
  btn.on('pointerout',  () => btn.setColor('#e8d090'));
  btn.on('pointerdown', cb);
  c.add(btn);
}
