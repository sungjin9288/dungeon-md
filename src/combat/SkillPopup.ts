// ─── Skill Popup ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene.showSkillPopup(). Renders a transient in-battle
// floating skill panel above the tapped room. The caller owns the popup field
// so we communicate through get/set callbacks.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { loadGameState } from '../data/wisdom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';

export interface SkillPopupContext {
  readonly scene:         Phaser.Scene;
  readonly room:          Room;
  readonly skillCooldowns: Map<string, number>;
  readonly equipmentMap:   Map<string, EquipmentStats>;
  readonly speedMult:      number;
  getSkillPopup:  () => Phaser.GameObjects.Container | undefined;
  setSkillPopup:  (v: Phaser.GameObjects.Container | undefined) => void;
  activateSkill:  (skillId: string, room: Room) => void;
}

/**
 * Show (or dismiss) the floating active-skill selection panel above `room`.
 *
 * Call on every wave-time occupied-room tap. If the popup is already open the
 * function closes it immediately (toggle).  If the monster has no equipped
 * skills a brief "no skills" toast is shown instead.
 */
export function showSkillPopup(ctx: SkillPopupContext): void {
  const { scene, room, skillCooldowns, equipmentMap, speedMult } = ctx;

  // Dismiss if tapping same room twice
  const existing = ctx.getSkillPopup();
  if (existing) {
    existing.destroy();
    ctx.setSkillPopup(undefined);
    return;
  }

  const gs = loadGameState();
  const monsterId = room.roomData?.monsterSlot;
  const om = monsterId ? gs.ownedMonsters.find(m => m.id === monsterId) : undefined;
  const skills = om?.equippedSkills ?? [];

  // Even without owned monster skills, show an empty-state tip briefly
  if (skills.length === 0) {
    const tip = scene.add.text(room.x, room.y - 40, '장착된 스킬 없음', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#888888',
      backgroundColor: '#111111', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(200);
    scene.time.delayedCall(1200, () => tip.destroy());
    return;
  }

  const popup = scene.add.container(0, 0).setDepth(200);
  ctx.setSkillPopup(popup);

  // Dim background click to close
  const dismissZone = scene.add.zone(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT,
  ).setInteractive();
  dismissZone.on('pointerdown', () => {
    popup.destroy();
    ctx.setSkillPopup(undefined);
  });
  popup.add(dismissZone);

  const btnW = 90, btnH = 56, gap = 8;
  const totalW = skills.length * btnW + (skills.length - 1) * gap;
  const startX = room.x - totalW / 2;
  const py     = Math.max(room.y - btnH - 12, 100);

  skills.forEach((skillId, i) => {
    const sk = ACTIVE_SKILLS.find(s => s.id === skillId);
    if (!sk) return;

    const bx    = startX + i * (btnW + gap);
    const by    = py;
    const cdKey = `${room.row}_${room.col}_${skillId}`;
    const now   = scene.time.now;
    const ready = (skillCooldowns.get(cdKey) ?? 0) <= now;

    // Button bg
    const bg = scene.add.graphics();
    bg.fillStyle(ready ? 0x1a0030 : 0x1a1a1a, 1);
    bg.fillRoundedRect(bx, by, btnW, btnH, 8);
    bg.lineStyle(2, ready ? 0xaa44ff : 0x444444, 0.9);
    bg.strokeRoundedRect(bx, by, btnW, btnH, 8);
    popup.add(bg);

    const iconT = scene.add.text(bx + btnW / 2, by + 14, sk.icon, {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5);
    popup.add(iconT);

    const nameT = scene.add.text(bx + btnW / 2, by + 32, sk.name, {
      fontFamily: 'sans-serif', fontSize: '9px', color: ready ? '#cc88ff' : '#555555',
      wordWrap: { width: btnW - 6 }, align: 'center',
    }).setOrigin(0.5);
    popup.add(nameT);

    const cdLeft = ready
      ? '준비됨'
      : `${Math.ceil(((skillCooldowns.get(cdKey) ?? 0) - now) / 1000)}s`;
    const cdT = scene.add.text(bx + btnW / 2, by + 48, cdLeft, {
      fontFamily: 'sans-serif', fontSize: '8px', color: ready ? '#44ff88' : '#ff6644',
    }).setOrigin(0.5);
    popup.add(cdT);

    if (ready) {
      const zone = scene.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH).setInteractive();
      zone.on('pointerdown', () => {
        ctx.activateSkill(skillId, room);
        const eqCdMult = room.roomData?.monsterSlot
          ? (equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1)
          : 1;
        skillCooldowns.set(cdKey, scene.time.now + sk.cooldown * 1000 * eqCdMult / speedMult);
        popup.destroy();
        ctx.setSkillPopup(undefined);
      });
      popup.add(zone);
    }
  });
}
