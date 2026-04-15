// ─── Active Skill Effects ────────────────────────────────────────────────────
// Extracted from DungeonScene.activateSkill(). The scene still owns the
// audio/quest/cooldown bookkeeping in its public wrapper; this module is
// just the "what does the skill do" dispatch table plus its shared
// flashText / skillHitFlash helpers.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Invader } from '../objects/Invader';
import type { RoomData } from '../data/rooms';

export interface ActiveSkillContext {
  scene:             Phaser.Scene;
  room:              Room;
  activeInvaders:    Invader[];          // already filtered to alive+active by caller
  effectiveCellSize: number;
  roomGrid:          (RoomData | null)[][];
  rooms:             Room[][];
  /** Current scene time in ms (`scene.time.now`, cached by caller). */
  now:               number;
  /** Mutate scene gold counter and registry. */
  addGold:           (amount: number) => void;
  /** Visual effect helper (already present on scene). */
  showGoldFloat:     (text: string, x: number, y: number) => void;
  /** Ghost-warrior summon delegates to RoomMechanics. */
  spawnGhostWarrior: (row: number, col: number) => void;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function flashText(
  ctx:   ActiveSkillContext,
  msg:   string,
  color: string = '#ffffff',
): void {
  const { scene, room } = ctx;
  const t = scene.add.text(room.x, room.y - 20, msg, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    color, stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(250);
  scene.tweens.add({
    targets: t, y: room.y - 60, alpha: 0, duration: 900,
    onComplete: () => t.destroy(),
  });
}

function skillHitFlash(
  scene: Phaser.Scene,
  inv:   Invader,
  color: number,
): void {
  if (!inv.active || inv.isDead) return;
  const g = scene.add.graphics().setDepth((inv.depth ?? 40) + 2);
  g.fillStyle(color, 0.8);
  g.fillCircle(inv.x, inv.y, inv.def.radius + 6);
  scene.tweens.add({
    targets: g, alpha: 0, scaleX: 1.6, scaleY: 1.6,
    duration: 260, ease: 'Power2.easeOut',
    onComplete: () => g.destroy(),
  });
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Apply an active-skill effect to the current combat state.
 *
 * The caller (DungeonScene) is responsible for cooldown tracking, audio,
 * and quest/daily-challenge bookkeeping. This function only performs the
 * damage/buff/visual side effects for the given skillId.
 */
export function activateSkillEffect(skillId: string, ctx: ActiveSkillContext): void {
  const { scene, room, activeInvaders: invaders, effectiveCellSize, roomGrid, rooms, now } = ctx;
  const row = room.row;

  switch (skillId) {
    case 'fire_burst': {
      const rowInvs = invaders.filter(inv => Math.abs(inv.y - room.y) < effectiveCellSize);
      rowInvs.forEach(inv => {
        skillHitFlash(scene, inv, 0xff6600);
        inv.takeDamage(200);
      });
      flashText(ctx, '🔥 화염 폭발! -200', '#ff6600');
      break;
    }
    case 'ice_arrow': {
      invaders.slice(0, 3).forEach(inv => {
        skillHitFlash(scene, inv, 0x88ddff);
        inv.applyFreeze(2000);
      });
      flashText(ctx, '❄️ 빙결!', '#88ddff');
      break;
    }
    case 'lightning': {
      const targets = invaders.slice(0, 5);
      targets.forEach((inv, i) => {
        scene.time.delayedCall(i * 80, () => {
          if (inv.isDead) return;
          skillHitFlash(scene, inv, 0xffff44);
          inv.takeDamage(100);
        });
      });
      flashText(ctx, '⚡ 연쇄 번개!', '#ffff44');
      break;
    }
    case 'poison_cloud': {
      invaders.forEach(inv => {
        skillHitFlash(scene, inv, 0x88ff44);
        inv.applyBurn(now);
      });
      flashText(ctx, '🌫️ 독 안개!', '#88ff44');
      break;
    }
    case 'heavy_strike': {
      if (room.roomData) room.roomData.nextAttack3x = true;
      flashText(ctx, '💥 강타 준비!', '#ff8800');
      break;
    }
    case 'fortress': {
      if (room.roomData) room.roomData.immuneUntil = now + 10000;
      flashText(ctx, '🏰 철옹성!', '#88ccff');
      break;
    }
    case 'heal_room': {
      if (room.roomData) {
        room.roomData.roomHp = Math.min(room.roomData.maxRoomHp, room.roomData.roomHp + 100);
        room.updateHpBar?.();
      }
      flashText(ctx, '💚 회복 +100', '#44ff88');
      break;
    }
    case 'shield': {
      // Adjacent rooms (±1 row or ±1 col)
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      neighbors.forEach(([dr, dc]) => {
        const d = roomGrid[row + dr]?.[room.col + dc];
        if (d) d.immuneUntil = now + 5000;
      });
      flashText(ctx, '🛡️ 보호막!', '#aaaaff');
      break;
    }
    case 'gold_rush': {
      ctx.addGold(200);
      ctx.showGoldFloat('+200 💰', room.x, room.y - 30);
      flashText(ctx, '💰 골드 +200!', '#ffdd44');
      break;
    }
    case 'speed_up': {
      // Approximate a 50% attack-speed buff by flagging every room for 8s.
      for (const r of roomGrid)
        for (const d of r)
          if (d) d.speedBoostUntil = now + 8000;
      flashText(ctx, '🌀 속도 증가!', '#44ffcc');
      break;
    }
    case 'summon_ghost': {
      ctx.spawnGhostWarrior(row, room.col);
      flashText(ctx, '👻 소환!', '#cc88ff');
      break;
    }
    case 'timestop': {
      invaders.forEach(inv => inv.applyFreeze(3000));
      flashText(ctx, '⏸️ 시간 정지!', '#ffffff');
      break;
    }
    case 'curse_all': {
      invaders.forEach(inv => { inv.applyRoot(1000); inv.applyBurn(now); });
      flashText(ctx, '🔮 저주!', '#9944ff');
      break;
    }
    case 'healing_rain': {
      for (const r of roomGrid)
        for (const d of r)
          if (d) d.roomHp = Math.min(d.maxRoomHp, d.roomHp + 30);
      rooms.forEach(rRow => rRow.forEach(r => r?.updateHpBar?.()));
      flashText(ctx, '🌧️ 치유의 비!', '#44ccff');
      break;
    }
    case 'rage': {
      if (room.roomData) room.roomData.rageUntil = now + 10000;
      flashText(ctx, '😤 분노!', '#ff4444');
      break;
    }
    default:
      flashText(ctx, '✨', '#ffffff');
  }
}
