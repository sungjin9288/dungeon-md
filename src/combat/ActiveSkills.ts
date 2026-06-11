// ─── Active Skill Effects ────────────────────────────────────────────────────
// Extracted from DungeonScene.activateSkill(). The scene still owns the
// audio/quest/cooldown bookkeeping in its public wrapper; this module is
// just the "what does the skill do" dispatch table plus its shared
// flashText / skillHitFlash helpers.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { Invader } from '../objects/Invader';
import type { RoomData } from '../data/rooms';
import { CANVAS_WIDTH } from '../constants/layout';

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

interface SkillVisualSpec {
  readonly icon: string;
  readonly color: number;
  readonly css: string;
}

const SKILL_VISUALS: Record<string, SkillVisualSpec> = {
  fire_burst:   { icon: '🔥', color: 0xff6b1a, css: '#ff8a2a' },
  ice_arrow:    { icon: '❄️', color: 0x88ddff, css: '#9fe8ff' },
  lightning:    { icon: '⚡', color: 0xfff27a, css: '#fff27a' },
  poison_cloud: { icon: '🌫️', color: 0x7cff64, css: '#a4ff7a' },
  heavy_strike: { icon: '💥', color: 0xff9a35, css: '#ff9a35' },
  fortress:     { icon: '🏰', color: 0x8acbff, css: '#9bd8ff' },
  heal_room:    { icon: '💚', color: 0x5cff9b, css: '#7dffad' },
  shield:       { icon: '🛡️', color: 0xaab7ff, css: '#bbc7ff' },
  gold_rush:    { icon: '💰', color: 0xffdf6e, css: '#ffdf6e' },
  speed_up:     { icon: '🌀', color: 0x44ffcc, css: '#64ffda' },
  summon_ghost: { icon: '👻', color: 0xcc88ff, css: '#d7a4ff' },
  timestop:     { icon: '⏸️', color: 0xffffff, css: '#ffffff' },
  curse_all:    { icon: '🔮', color: 0x9944ff, css: '#b27cff' },
  healing_rain: { icon: '🌧️', color: 0x44ccff, css: '#68ddff' },
  rage:         { icon: '😤', color: 0xff5555, css: '#ff6666' },
};

function getSkillVisual(skillId: string): SkillVisualSpec {
  return SKILL_VISUALS[skillId] ?? { icon: '✨', color: 0xffffff, css: '#ffffff' };
}

function showSkillCastPulse(ctx: ActiveSkillContext, visual: SkillVisualSpec): void {
  const { scene, room } = ctx;
  const c = scene.add.container(room.x, room.y).setDepth(214);

  const ring = scene.add.graphics();
  ring.fillStyle(visual.color, 0.18);
  ring.fillCircle(0, 0, 26);
  ring.lineStyle(2.5, visual.color, 0.88);
  ring.strokeCircle(0, 0, 24);
  ring.lineStyle(1, 0xffffff, 0.42);
  ring.strokeCircle(0, 0, 15);

  const rays = scene.add.graphics();
  rays.lineStyle(2, visual.color, 0.72);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i;
    rays.lineBetween(Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 33, Math.sin(a) * 33);
  }

  const glyphBg = scene.add.graphics();
  glyphBg.fillStyle(0x04070a, 0.78);
  glyphBg.fillCircle(0, 0, 13);
  glyphBg.lineStyle(1, visual.color, 0.62);
  glyphBg.strokeCircle(0, 0, 13);

  const glyph = scene.add.text(0, -1, visual.icon, {
    fontFamily: 'sans-serif',
    fontSize: '16px',
  }).setOrigin(0.5);
  glyph.setShadow(0, 2, '#000000', 0.45, true, true);

  c.add([ring, rays, glyphBg, glyph]);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scaleX: 2.15,
    scaleY: 2.15,
    duration: 1500,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: rays,
    angle: 42,
    alpha: 0,
    scaleX: 1.4,
    scaleY: 1.4,
    duration: 1300,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: [glyphBg, glyph],
    y: -18,
    alpha: 0,
    duration: 1500,
    ease: 'Cubic.easeOut',
    onComplete: () => c.destroy(),
  });
}

function showLaneSweep(ctx: ActiveSkillContext, visual: SkillVisualSpec): void {
  const { scene, room } = ctx;
  const lane = scene.add.graphics().setDepth(53);
  const y = room.y;
  lane.lineStyle(9, visual.color, 0.22);
  lane.lineBetween(18, y, CANVAS_WIDTH - 18, y);
  lane.lineStyle(3, visual.color, 0.82);
  lane.lineBetween(28, y, CANVAS_WIDTH - 28, y);
  lane.fillStyle(visual.color, 0.72);
  for (let x = 36; x < CANVAS_WIDTH; x += 42) {
    lane.fillTriangle(x, y - 8, x + 16, y, x, y + 8);
  }
  scene.tweens.add({
    targets: lane,
    alpha: 0,
    x: 18,
    duration: 1500,
    ease: 'Cubic.easeOut',
    onComplete: () => lane.destroy(),
  });
}

function showSkillBolt(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  inv: Invader,
  visual: SkillVisualSpec,
  delay = 0,
): void {
  scene.time.delayedCall(delay, () => {
    if (!inv.active || inv.isDead) return;
    const bolt = scene.add.graphics().setDepth(55);
    bolt.lineStyle(4, visual.color, 0.22);
    bolt.lineBetween(x1, y1, inv.x, inv.y);
    bolt.lineStyle(1.8, 0xffffff, 0.82);
    bolt.lineBetween(x1, y1, inv.x, inv.y);
    bolt.fillStyle(visual.color, 0.9);
    bolt.fillCircle(inv.x, inv.y, 4);
    scene.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => bolt.destroy(),
    });
  });
}

function showRoomBloom(scene: Phaser.Scene, room: Room, visual: SkillVisualSpec): void {
  const g = scene.add.graphics().setDepth(56);
  g.fillStyle(visual.color, 0.12);
  g.fillCircle(room.x, room.y, 26);
  g.lineStyle(2, visual.color, 0.84);
  g.strokeCircle(room.x, room.y, 25);
  g.lineStyle(1, 0xffffff, 0.42);
  g.strokeCircle(room.x, room.y, 14);

  for (let i = 0; i < 7; i++) {
    const px = room.x + Phaser.Math.Between(-22, 22);
    const py = room.y + Phaser.Math.Between(-8, 20);
    g.fillStyle(visual.color, 0.76);
    g.fillCircle(px, py, Phaser.Math.Between(2, 4));
  }

  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: 1.9,
    scaleY: 1.9,
    duration: 1500,
    ease: 'Cubic.easeOut',
    onComplete: () => g.destroy(),
  });
}

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
    targets: t, y: room.y - 64, alpha: 0, duration: 1300,
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
    duration: 420, ease: 'Power2.easeOut',
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
  const visual = getSkillVisual(skillId);

  showSkillCastPulse(ctx, visual);

  switch (skillId) {
    case 'fire_burst': {
      showLaneSweep(ctx, visual);
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
        showSkillBolt(scene, room.x, room.y, inv, visual);
        skillHitFlash(scene, inv, 0x88ddff);
        inv.applyFreeze(2000);
      });
      flashText(ctx, '❄️ 빙결!', '#88ddff');
      break;
    }
    case 'lightning': {
      const targets = invaders.slice(0, 5);
      targets.forEach((inv, i) => {
        showSkillBolt(scene, room.x, room.y, inv, visual, i * 80);
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
      showLaneSweep(ctx, visual);
      invaders.forEach(inv => {
        skillHitFlash(scene, inv, 0x88ff44);
        inv.applyBurn(now);
      });
      flashText(ctx, '🌫️ 독 안개!', '#88ff44');
      break;
    }
    case 'heavy_strike': {
      if (room.roomData) room.roomData.nextAttack3x = true;
      showRoomBloom(scene, room, visual);
      flashText(ctx, '💥 강타 준비!', '#ff8800');
      break;
    }
    case 'fortress': {
      if (room.roomData) room.roomData.immuneUntil = now + 10000;
      showRoomBloom(scene, room, visual);
      flashText(ctx, '🏰 철옹성!', '#88ccff');
      break;
    }
    case 'heal_room': {
      if (room.roomData) {
        room.roomData.roomHp = Math.min(room.roomData.maxRoomHp, room.roomData.roomHp + 100);
        room.updateHpBar?.();
      }
      showRoomBloom(scene, room, visual);
      flashText(ctx, '💚 회복 +100', '#44ff88');
      break;
    }
    case 'shield': {
      // Adjacent rooms (±1 row or ±1 col)
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      neighbors.forEach(([dr, dc]) => {
        const d = roomGrid[row + dr]?.[room.col + dc];
        const neighborRoom = rooms[row + dr]?.[room.col + dc];
        if (d) {
          d.immuneUntil = now + 5000;
          if (neighborRoom) showRoomBloom(scene, neighborRoom, visual);
        }
      });
      showRoomBloom(scene, room, visual);
      flashText(ctx, '🛡️ 보호막!', '#aaaaff');
      break;
    }
    case 'gold_rush': {
      ctx.addGold(200);
      ctx.showGoldFloat('+200 💰', room.x, room.y - 30);
      showRoomBloom(scene, room, visual);
      flashText(ctx, '💰 골드 +200!', '#ffdd44');
      break;
    }
    case 'speed_up': {
      // Approximate a 50% attack-speed buff by flagging every room for 8s.
      for (const r of roomGrid)
        for (const d of r)
          if (d) d.speedBoostUntil = now + 8000;
      rooms.forEach(rRow => rRow.forEach(r => { if (r?.roomData) showRoomBloom(scene, r, visual); }));
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
      invaders.slice(0, 6).forEach(inv => showSkillBolt(scene, room.x, room.y, inv, visual));
      flashText(ctx, '⏸️ 시간 정지!', '#ffffff');
      break;
    }
    case 'curse_all': {
      invaders.forEach(inv => { inv.applyRoot(1000); inv.applyBurn(now); });
      showLaneSweep(ctx, visual);
      flashText(ctx, '🔮 저주!', '#9944ff');
      break;
    }
    case 'healing_rain': {
      for (const r of roomGrid)
        for (const d of r)
          if (d) d.roomHp = Math.min(d.maxRoomHp, d.roomHp + 30);
      rooms.forEach(rRow => rRow.forEach(r => r?.updateHpBar?.()));
      rooms.forEach(rRow => rRow.forEach(r => { if (r?.roomData) showRoomBloom(scene, r, visual); }));
      flashText(ctx, '🌧️ 치유의 비!', '#44ccff');
      break;
    }
    case 'rage': {
      if (room.roomData) room.roomData.rageUntil = now + 10000;
      showRoomBloom(scene, room, visual);
      flashText(ctx, '😤 분노!', '#ff4444');
      break;
    }
    default:
      flashText(ctx, '✨', '#ffffff');
  }
}
