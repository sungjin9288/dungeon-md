/**
 * Battle slot renderer — extracted from DungeonHomeScene.
 *
 * Renders dungeon room slots in 3 states: locked, destroyed, or occupied.
 */
import Phaser from 'phaser';
import { MONSTER_DEFS, getSkinForMonster } from '../data/monsters';
import { TRAP_DEFS } from '../data/traps';
import { SLOT_UNLOCK_LEVELS, ROOM_SLOT_TYPE_DEFS } from '../data/wisdom';
import type { DungeonTheme } from '../themes/themes';
import { drawRoughEdgeRect, strokeRoughEdgeRect } from '../themes/decorations';
import type { GameState } from '../data/wisdom';

// ─── Shared layout constants ───────────────────────────────────────────────

export const SLOT_W = 100;
export const SLOT_H = 100;
export const INVASION_ORDER = [3, 2, 1, 4, 5, 6, 9, 8, 7];

// ─── RoomSlotContext ───────────────────────────────────────────────────────

export interface RoomSlotContext {
  readonly scene: Phaser.Scene;
  readonly theme: DungeonTheme;
  readonly gs: GameState;
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
  const { scene, theme: t, gs } = ctx;

  if (!unlocked) {
    // Dark cave alcove — locked
    drawRoughEdgeRect(g, t.slotLocked, 0.7, x, y, SLOT_W, SLOT_H, index * 17);
    strokeRoughEdgeRect(g, t.stoneDark, 0.3, 1, x, y, SLOT_W, SLOT_H, index * 17);
    // X-chain pattern
    g.lineStyle(2, t.stoneMid, 0.3);
    g.lineBetween(x + 20, y + 20, x + SLOT_W - 20, y + SLOT_H - 20);
    g.lineBetween(x + SLOT_W - 20, y + 20, x + 20, y + SLOT_H - 20);
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2;
    c.add(scene.add.text(cx, cy - 8, '🔒', { fontSize: '22px' }).setOrigin(0.5).setAlpha(0.5));
    const reqLv = SLOT_UNLOCK_LEVELS[index]?.[0] ?? 99;
    c.add(scene.add.text(cx, cy + 16, `Lv.${reqLv} 해금`, {
      fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
    }).setOrigin(0.5));
    return;
  }

  const slot = gs.dungeonSlots?.[index];

  // ── 파손 방: HP=0 특수 표시 ────────────────────────────────────────────────
  if (slot && slot.hp <= 0) {
    g.fillStyle(0x1a0000, 1);
    g.fillRoundedRect(x, y, SLOT_W, SLOT_H, 6);
    g.lineStyle(2, 0x8b0000, 0.8);
    g.strokeRoundedRect(x, y, SLOT_W, SLOT_H, 6);
    // Crack lines
    g.lineStyle(2, 0xff2222, 0.6);
    g.lineBetween(x + 18, y + 8,  x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + SLOT_W - 14, y + SLOT_H - 6);
    g.lineBetween(x + SLOT_W / 2 - 4, y + SLOT_H / 2 + 4, x + 10, y + SLOT_H - 14);
    const cx = x + SLOT_W / 2;
    c.add(scene.add.text(cx, y + SLOT_H / 2 - 10, '💥', { fontFamily: 'sans-serif', fontSize: '22px' }).setOrigin(0.5).setAlpha(0.75));
    c.add(scene.add.text(cx, y + SLOT_H / 2 + 12, '파손', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ff4444',
    }).setOrigin(0.5));
    c.add(scene.add.text(cx, y + SLOT_H - 10, '수리 필요', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#884444',
    }).setOrigin(0.5));
    // Invasion order badge
    const order = INVASION_ORDER[index];
    if (order !== undefined) {
      const bg2 = scene.add.graphics();
      bg2.fillStyle(0x8b0000, 0.7);
      bg2.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
      c.add(bg2);
      c.add(scene.add.text(x + 10, y + 9, String(order), { fontFamily: 'monospace', fontSize: '9px', color: '#ff8888' }).setOrigin(0.5));
    }
    return;
  }

  const primaryMonsterId = slot?.monsterIds?.[0];
  const monDef = primaryMonsterId
    ? (() => {
        const om = gs.ownedMonsters.find(m => m.id === primaryMonsterId);
        if (!om) return null;
        const typeId = Object.keys(MONSTER_DEFS).find(k => om.id === k || om.id.startsWith(k + '_')) ?? om.id;
        return MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS] ?? null;
      })()
    : null;
  const primaryTrapId = slot?.trapIds?.[0];
  const trapDef = primaryTrapId ? TRAP_DEFS.find(td => td.id === primaryTrapId) : null;
  // Extra occupied monster count for badge
  const extraMonsterCount = Math.max(0, (slot?.monsterIds ?? []).filter(Boolean).length - 1);

  if (monDef) {
    // ── Occupied cell: cave alcove with rough edges ────────────────────────
    drawRoughEdgeRect(g, t.slotFill, 1, x, y, SLOT_W, SLOT_H, index * 17);
    const inset = 6;
    g.fillStyle(t.stoneDark, 0.65);
    g.fillRoundedRect(x + inset, y + inset, SLOT_W - inset * 2, SLOT_H - inset * 2, 4);

    // Mineral-vein border
    strokeRoughEdgeRect(g, t.slotBorder, 0.8, 1, x, y, SLOT_W, SLOT_H, index * 17);

    // Glow behind emoji — cool-toned by monster type
    const glowColor: Record<string, number> = {
      melee:   0x884444,   // muted red
      ranged:  0x446688,   // steel blue
      magic:   0x664488,   // purple
      support: 0x448866,   // teal
    };
    const glow = glowColor[monDef.type] ?? t.stoneMid;
    const glowG = scene.add.graphics();
    const cx = x + SLOT_W / 2;
    const cy = y + SLOT_H / 2 - 10;
    for (let r = 22; r >= 6; r -= 4) {
      glowG.fillStyle(glow, 0.06 * (22 - r) / 4 + 0.04);
      glowG.fillCircle(cx, cy, r);
    }
    c.add(glowG);

    // Monster emoji (36px) — apply equipped skin if any
    const typeIdForSlot = Object.keys(MONSTER_DEFS).find(
      k => primaryMonsterId === k || (primaryMonsterId ?? '').startsWith(k + '_'),
    ) ?? (primaryMonsterId ?? '');
    const slotSkin = getSkinForMonster(typeIdForSlot, gs.equippedSkins ?? {});
    const emojiText = scene.add.text(cx, cy, slotSkin ? slotSkin.emoji : monDef.emoji, {
      fontFamily: 'sans-serif', fontSize: '36px',
    }).setOrigin(0.5);
    c.add(emojiText);
    // Idle animation (compact — no particles)
    ctx.applyIdleAnimation(emojiText, typeIdForSlot, true);

    // Extra monster count badge (bottom-left)
    if (extraMonsterCount > 0) {
      const ebg = scene.add.graphics();
      ebg.fillStyle(0x8b0000, 0.85);
      ebg.fillRoundedRect(x + 2, y + SLOT_H - 16, 18, 13, 3);
      c.add(ebg);
      c.add(scene.add.text(x + 11, y + SLOT_H - 9, `+${extraMonsterCount}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffcccc',
      }).setOrigin(0.5));
    }

    // Level badge top-right
    if (slot && slot.roomLevel > 1) {
      const badgeBg = scene.add.graphics();
      badgeBg.fillStyle(t.panelBorder, 0.9);
      badgeBg.fillRoundedRect(x + SLOT_W - 22, y + 2, 20, 13, 3);
      c.add(badgeBg);
      c.add(scene.add.text(x + SLOT_W - 12, y + 8, `Lv${slot.roomLevel}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#0a0e14',
      }).setOrigin(0.5));
    }

    // Trap icon bottom-right with colored dot behind it
    if (trapDef) {
      const trapDotG = scene.add.graphics();
      const trapDotColors: Record<string, number> = {
        spike_trap:  0x8b0000,
        slow_trap:   0x004488,
        poison_trap: 0x2d6b00,
        stun_trap:   0x886600,
      };
      trapDotG.fillStyle(trapDotColors[trapDef.id] ?? 0x333333, 0.55);
      trapDotG.fillCircle(x + SLOT_W - 10, y + SLOT_H - 12, 9);
      c.add(trapDotG);
      c.add(scene.add.text(x + SLOT_W - 10, y + SLOT_H - 12, trapDef.emoji, {
        fontFamily: 'sans-serif', fontSize: '14px',
      }).setOrigin(0.5));
    }

    // HP bar bottom
    if (slot) {
      const hpPct = Math.max(0, slot.hp / slot.maxHp);
      const barW  = SLOT_W - 10;
      const barY  = y + SLOT_H - 8;
      const barColor = hpPct > 0.66 ? 0x2d9e2d : hpPct > 0.33 ? t.panelBorder : 0x8b0000;
      g.fillStyle(t.panelDark, 1);
      g.fillRoundedRect(x + 5, barY, barW, 4, 2);
      g.fillStyle(barColor, 1);
      g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
    }
  } else {
    // ── Empty cell: dark cave alcove ──────────────────────────────────────
    drawRoughEdgeRect(g, t.stoneDark, 1, x, y, SLOT_W, SLOT_H, index * 17);
    const hasType = !!(slot?.roomType);
    strokeRoughEdgeRect(g, hasType ? t.stoneMid : t.slotBorder, hasType ? 0.5 : 0.35, 1.5, x, y, SLOT_W, SLOT_H, index * 17);

    if (hasType) {
      const td = ROOM_SLOT_TYPE_DEFS.find(d => d.id === slot!.roomType);
      const cx = x + SLOT_W / 2;
      c.add(scene.add.text(cx, y + SLOT_H / 2 - 14, td?.icon ?? '🏚', {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5).setAlpha(0.6));
      c.add(scene.add.text(cx, y + SLOT_H / 2 + 10, td?.name ?? '', {
        fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
      }).setOrigin(0.5));
      c.add(scene.add.text(cx, y + SLOT_H - 10, '몬스터 미배치', {
        fontFamily: 'sans-serif', fontSize: '8px', color: t.textSecondary,
      }).setOrigin(0.5));
      if (slot && slot.hp < slot.maxHp) {
        const hpPct = Math.max(0, slot.hp / slot.maxHp);
        const barW  = SLOT_W - 10;
        const barY  = y + SLOT_H - 8;
        g.fillStyle(t.panelDark, 1);
        g.fillRoundedRect(x + 5, barY, barW, 4, 2);
        g.fillStyle(hpPct > 0.33 ? t.panelBorder : 0x8b0000, 1);
        g.fillRoundedRect(x + 5, barY, barW * hpPct, 4, 2);
      }
    } else {
      // Truly empty — cave rock interior
      g.lineStyle(1, t.stoneLight, 0.2);
      for (let ty = y + 12; ty < y + SLOT_H - 4; ty += 12) {
        g.lineBetween(x + 4, ty, x + SLOT_W - 4, ty);
      }
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H / 2 - 10, '⚠️', {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5).setAlpha(0.35));
      c.add(scene.add.text(x + SLOT_W / 2, y + SLOT_H - 12, '빈 슬롯', {
        fontFamily: 'Georgia, serif', fontSize: '9px', color: t.textSecondary,
      }).setOrigin(0.5));
    }
  }

  // ── Invasion order badge (top-left, all unlocked slots) ───────────────────
  const order = INVASION_ORDER[index];
  if (order !== undefined) {
    const badgeG = scene.add.graphics();
    badgeG.fillStyle(0x000000, 0.55);
    badgeG.fillRoundedRect(x + 2, y + 2, 16, 14, 3);
    c.add(badgeG);
    c.add(scene.add.text(x + 10, y + 9, String(order), {
      fontFamily: 'monospace', fontSize: '9px', color: '#c8921a',
    }).setOrigin(0.5));
  }
}
