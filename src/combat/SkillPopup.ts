// ─── Skill Popup ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene.showSkillPopup(). Renders a transient in-battle
// floating skill panel above the tapped room. The caller owns the popup field
// so we communicate through get/set callbacks.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { loadGameState } from '../data/wisdom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { drawSigil } from '../ui/Sigils';
import { ACTIVE_SKILL_SIGILS } from '../ui/sigilMaps';
import { getReducedMotion } from '../utils/reducedMotion';

export interface SkillPopupContext {
  readonly scene:         Phaser.Scene;
  readonly room:          Room;
  readonly skillCooldowns: Map<string, number>;
  readonly equipmentMap:   Map<string, EquipmentStats>;
  readonly speedMult:      number;
  readonly synergyCooldownMult: number;
  getSkillPopup:  () => Phaser.GameObjects.Container | undefined;
  setSkillPopup:  (v: Phaser.GameObjects.Container | undefined) => void;
  activateSkill:  (skillId: string, room: Room) => void;
}

const CARD_W = 116;
const CARD_H = 100;
const CARD_GAP = 8;
const PANEL_PAD = 10;

function getSkillCooldownKey(row: number, col: number, skillId: string): string {
  return `${row}_${col}_${skillId}`;
}

function getCategoryAccent(category: typeof ACTIVE_SKILLS[number]['category']): number {
  switch (category) {
    case 'combat':
      return CASUAL.RED;
    case 'defense':
      return CASUAL.BLUE;
    case 'support':
      return CASUAL.GREEN;
    default:
      return CASUAL.GOLD;
  }
}

function getCategoryLabel(category: typeof ACTIVE_SKILLS[number]['category']): string {
  switch (category) {
    case 'combat':
      return 'ATK';
    case 'defense':
      return 'DEF';
    case 'support':
      return 'SUP';
    default:
      return 'ACT';
  }
}

function getSlotIndex(row: number, col: number): number | null {
  return col >= 3 ? null : row * 3 + col;
}

function getMonsterName(monsterId: string | null | undefined): string {
  if (!monsterId) return '수호자';
  return resolveOwnedMonsterProfile(monsterId)?.name ?? monsterId;
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
  const monsterName = getMonsterName(monsterId);
  const slotIndex = getSlotIndex(room.row, room.col);

  // Even without owned monster skills, show an empty-state tip briefly
  if (skills.length === 0) {
    const tipW = 178;
    const tipH = 58;
    const tipX = Phaser.Math.Clamp(room.x - tipW / 2, 8, CANVAS_WIDTH - tipW - 8);
    const tipY = Phaser.Math.Clamp(room.y - 86, 118, CANVAS_HEIGHT - tipH - 122);
    const tip = scene.add.container(0, 0).setDepth(211).setAlpha(0);
    const bg = scene.add.graphics();
    bg.fillStyle(DUNGEON_UI.VOID, 0.65);
    bg.fillRoundedRect(tipX + 2, tipY + 4, tipW, tipH, 7);
    bg.fillStyle(DUNGEON_UI.STONE, 1);
    bg.fillRoundedRect(tipX, tipY, tipW, tipH, 7);
    bg.fillStyle(DUNGEON_UI.BRASS, 0.9);
    bg.fillRect(tipX + 1, tipY + 9, 3, tipH - 18);
    bg.fillStyle(DUNGEON_UI.SOOT, 1);
    bg.fillRoundedRect(tipX + 9, tipY + 9, 34, tipH - 18, 5);
    bg.lineStyle(1.5, DUNGEON_UI.EDGE, 1);
    bg.strokeRoundedRect(tipX, tipY, tipW, tipH, 7);
    tip.add(bg);
    tip.add(scene.add.text(tipX + 25, tipY + 29, '✦', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0.5));
    tip.add(scene.add.text(tipX + 52, tipY + 22, '전술 슬롯 비어 있음', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));
    tip.add(scene.add.text(tipX + 52, tipY + 39, monsterName, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
    const reducedMotion = getReducedMotion();
    if (reducedMotion) tip.setAlpha(1);
    else scene.tweens.add({ targets: tip, alpha: 1, y: -4, duration: 120, ease: 'Cubic.easeOut' });
    scene.time.delayedCall(1300, () => {
      if (reducedMotion) {
        tip.destroy();
        return;
      }
      scene.tweens.add({
        targets: tip,
        alpha: 0,
        y: tip.y - 8,
        duration: 180,
        onComplete: () => tip.destroy(),
      });
    });
    return;
  }

  const popup = scene.add.container(0, 0).setName('skillCommandPopup').setDepth(210).setAlpha(0);
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

  const totalW = skills.length * CARD_W + (skills.length - 1) * CARD_GAP;
  const panelW = totalW + PANEL_PAD * 2;
  const panelH = CARD_H + PANEL_PAD * 2 + 40;
  const panelX = Phaser.Math.Clamp(room.x - panelW / 2, 8, CANVAS_WIDTH - panelW - 8);
  const pyAbove = room.y - panelH - 18;
  const panelY = pyAbove >= 112 ? pyAbove : Phaser.Math.Clamp(room.y + 54, 126, CANVAS_HEIGHT - panelH - 118);
  const startX = panelX + PANEL_PAD;

  const panel = addFramedPanel(scene, {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    radius: 8,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.EDGE,
    borderAlpha: 1,
    borderWidth: 1.5,
    accentColor: DUNGEON_UI.BRASS,
    accentAlpha: 1,
    glowColor: DUNGEON_UI.BRASS,
    glowOpacity: 0.05,
    shadowOpacity: 0.3,
    shadowOffsetY: 5,
  });
  popup.add([panel.shadow, panel.panel, panel.glow]);

  const header = scene.add.graphics();
  header.fillStyle(DUNGEON_UI.SOOT, 1);
  header.fillRoundedRect(panelX + 8, panelY + 8, panelW - 16, 28, 5);
  header.fillStyle(DUNGEON_UI.BRASS, 1);
  header.fillRect(panelX + 14, panelY + 13, 3, 18);
  header.fillStyle(DUNGEON_UI.STONE, 1);
  header.fillRoundedRect(panelX + panelW - 44, panelY + 13, 30, 16, 6);
  header.lineStyle(1, DUNGEON_UI.BRASS, 0.9);
  header.strokeRoundedRect(panelX + panelW - 44, panelY + 13, 30, 16, 6);
  popup.add(header);

  const title = scene.add.text(panelX + PANEL_PAD + 14, panelY + 17, '전술 명령', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0, 0.5);
  popup.add(title);
  popup.add(scene.add.text(panelX + PANEL_PAD + 14, panelY + 29, `${monsterName} · Lv.${om?.level ?? 1}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  popup.add(scene.add.text(panelX + panelW - 29, panelY + 21, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5));

  skills.forEach((skillId, i) => {
    const sk = ACTIVE_SKILLS.find(s => s.id === skillId);
    if (!sk) return;

    const bx    = startX + i * (CARD_W + CARD_GAP);
    const by    = panelY + PANEL_PAD + 40;
    const cdKey = getSkillCooldownKey(room.row, room.col, skillId);
    const now   = scene.time.now;
    const readyAt = skillCooldowns.get(cdKey) ?? 0;
    const ready = readyAt <= now;
    const accent = getCategoryAccent(sk.category);
    const categoryLabel = getCategoryLabel(sk.category);

    const bg = scene.add.graphics();
    const drawCard = (hover = false): void => {
      bg.clear();
      bg.fillStyle(DUNGEON_UI.VOID, ready ? 0.58 : 0.3);
      bg.fillRoundedRect(bx + 2, by + 3, CARD_W, CARD_H, 6);
      bg.fillStyle(ready ? (hover ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE) : DUNGEON_UI.SOOT, 1);
      bg.fillRoundedRect(bx, by, CARD_W, CARD_H, 6);
      bg.fillStyle(accent, ready ? 0.28 : 0.12);
      bg.fillRoundedRect(bx + 7, by + 7, 25, 25, 5);
      bg.fillStyle(accent, ready ? 0.92 : 0.3);
      bg.fillRect(bx + 1, by + 10, 3, CARD_H - 20);
      bg.fillStyle(DUNGEON_UI.SOOT, ready ? 0.92 : 0.65);
      bg.fillRoundedRect(bx + 8, by + CARD_H - 28, CARD_W - 16, 20, 5);
      bg.lineStyle(hover ? 2 : 1.5, ready ? accent : DUNGEON_UI.EDGE, ready ? 0.95 : 0.55);
      bg.strokeRoundedRect(bx, by, CARD_W, CARD_H, 6);
    };
    drawCard();
    popup.add(bg);

    const skSigil = ACTIVE_SKILL_SIGILS[sk.id];
    const iconT = scene.add.graphics().setAlpha(ready ? 1 : 0.45);
    drawSigil(iconT, skSigil?.kind ?? 'spark', bx + 19.5, by + 19.5, 22, skSigil?.color ?? 0xd8c08a, { disc: false });
    popup.add(iconT);

    const nameT = scene.add.text(bx + 39, by + 18, sk.name, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: ready ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: CARD_W - 48 },
    }).setOrigin(0, 0.5);
    popup.add(nameT);

    popup.add(scene.add.text(bx + 10, by + 40, sk.desc, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: CARD_W - 20 },
      lineSpacing: 0,
    }).setOrigin(0, 0));

    const categoryBg = scene.add.graphics();
    categoryBg.fillStyle(accent, ready ? 0.72 : 0.22);
    categoryBg.fillRoundedRect(bx + 8, by + CARD_H - 27, 34, 19, 4);
    categoryBg.lineStyle(1, accent, ready ? 1 : 0.4);
    categoryBg.strokeRoundedRect(bx + 8, by + CARD_H - 27, 34, 19, 4);
    popup.add(categoryBg);
    popup.add(scene.add.text(bx + 25, by + CARD_H - 17.5, categoryLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: ready ? '#ffffff' : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));

    const eqCdMult = room.roomData?.monsterSlot
      ? (equipmentMap.get(room.roomData.monsterSlot)?.skillCdMult ?? 1)
      : 1;
    const cdMs = sk.cooldown * 1000 * eqCdMult * ctx.synergyCooldownMult / speedMult;
    const cdLeft = ready
      ? `준비 · ${Number((cdMs / 1000).toFixed(1))}s`
      : `${Math.ceil((readyAt - now) / 1000)}s 남음`;
    const statusBg = scene.add.graphics();
    statusBg.fillStyle(ready ? DUNGEON_UI.JADE : DUNGEON_UI.SOOT, ready ? 0.82 : 1);
    statusBg.fillRoundedRect(bx + 46, by + CARD_H - 27, CARD_W - 54, 19, 4);
    statusBg.lineStyle(1, ready ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER, ready ? 1 : 0.7);
    statusBg.strokeRoundedRect(bx + 46, by + CARD_H - 27, CARD_W - 54, 19, 4);
    popup.add(statusBg);

    const cdT = scene.add.text(bx + 46 + (CARD_W - 54) / 2, by + CARD_H - 17.5, cdLeft, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: ready ? '#ffffff' : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0.5);
    popup.add(cdT);

    if (ready) {
      const zone = scene.add.zone(bx + CARD_W / 2, by + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => drawCard(true));
      zone.on('pointerout', () => drawCard(false));
      zone.on('pointerdown', () => {
        ctx.activateSkill(skillId, room);
        skillCooldowns.set(cdKey, scene.time.now + cdMs);
        popup.destroy();
        ctx.setSkillPopup(undefined);
      });
      popup.add(zone);
    }
  });

  if (getReducedMotion()) popup.setAlpha(1);
  else {
    scene.tweens.add({
      targets: popup,
      alpha: 1,
      y: -4,
      duration: 150,
      ease: 'Cubic.easeOut',
    });
  }
}
