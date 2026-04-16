/**
 * RoomPickerModals — trap picker and monster picker modals for the room detail overlay.
 * Extracted from RoomDetailOverlay (lines 598-823).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { saveGameState, getRoomSlotCapacity } from '../data/wisdom';
import { MONSTER_DEFS } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { logger } from '../utils/logger';
import type { RoomDetailState, RoomDetailCallbacks } from './RoomDetailOverlay';
import type { DungeonTheme } from '../themes/themes';

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
  if (state.trapPickerContainer) { state.trapPickerContainer.destroy(); state.trapPickerContainer = null; }

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const trapRowH = 58;
  const modalH = 56 + TRAP_DEFS.length * trapRowH;
  const c = scene.add.container(0, CH).setDepth(110);  // starts offscreen bottom
  state.trapPickerContainer = c;

  // Background
  const bg = scene.add.graphics();
  bg.fillStyle(0x0e0900, 1);
  bg.fillRoundedRect(0, 0, CW, modalH, { tl: 16, tr: 16, bl: 0, br: 0 });
  bg.lineStyle(1.5, 0xc8921a, 0.5);
  bg.strokeRoundedRect(0, 0, CW, modalH, { tl: 16, tr: 16, bl: 0, br: 0 });
  c.add(bg);

  c.add(scene.add.text(CW / 2, 18, '함정 선택', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8921a',
  }).setOrigin(0.5, 0));

  const closeBtn = scene.add.text(CW - 16, 14, '✕', {
    fontFamily: 'sans-serif', fontSize: '18px', color: '#664422',
  }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => { state.trapPickerContainer?.destroy(); state.trapPickerContainer = null; });
  c.add(closeBtn);

  let rowY = 52;
  TRAP_DEFS.forEach(trap => {
    const locked = gs.dmLevel < trap.unlockLv;

    const rowBg = scene.add.graphics();
    rowBg.fillStyle(locked ? 0x0a0900 : 0x1a0f00, 1);
    rowBg.fillRect(8, rowY, CW - 16, trapRowH);
    rowBg.lineStyle(1, locked ? 0x332200 : 0x664400, 0.4);
    rowBg.lineBetween(8, rowY + trapRowH, CW - 8, rowY + trapRowH);
    c.add(rowBg);

    const alpha = locked ? 0.4 : 1;
    c.add(scene.add.text(32, rowY + trapRowH / 2, trap.emoji, {
      fontFamily: 'sans-serif', fontSize: '24px',
    }).setOrigin(0.5).setAlpha(alpha));
    c.add(scene.add.text(52, rowY + 10, `${trap.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: locked ? '#4a3020' : '#c8921a',
    }).setOrigin(0, 0));
    c.add(scene.add.text(52, rowY + 30, trap.desc, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#806040',
      wordWrap: { width: CW - 130 },
    }).setOrigin(0, 0).setAlpha(alpha));

    const costLabel = locked ? `🔒 Lv.${trap.unlockLv} 해금` : `${trap.cost}g`;
    if (locked) {
      c.add(scene.add.text(CW - 20, rowY + trapRowH / 2, costLabel, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#4a3020',
      }).setOrigin(1, 0.5));
    } else {
      const pickBtn = scene.add.text(CW - 16, rowY + trapRowH / 2, `${trap.cost}g  선택`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e8d090',
        backgroundColor: '#2a1806', padding: { x: 10, y: 6 },
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
        nav.closeRoomDetail(state, cb);
        setTimeout(() => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
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
    const prog = step / STEPS;
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
  nav: PickerNavCallbacks,
  slotIdx: number,
  monsterSlotIdx = 0,
): void {
  if (state.monsterPickerContainer) { state.monsterPickerContainer.destroy(); state.monsterPickerContainer = null; }

  const gs = cb.getGameState();
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;
  const monsters = gs.ownedMonsters;
  const rowH   = 52;
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
        nav.closeRoomDetail(state, cb);
        setTimeout(() => nav.openRoomDetail(scene, state, theme, cb, slotIdx, state.roomDetailCellX, state.roomDetailCellY), 250);
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
    const prog = step / STEPS;
    const ease = 1 - Math.pow(1 - prog, 2);
    c.setPosition(0, CH + (targetY - CH) * ease);
    if (step >= STEPS) { clearInterval(iv); c.setPosition(0, targetY); }
  }, 16);
}
