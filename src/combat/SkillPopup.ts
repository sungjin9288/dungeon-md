// ─── Skill Popup ─────────────────────────────────────────────────────────────
// Extracted from DungeonScene.showSkillPopup(). Renders a transient in-battle
// floating skill panel above the tapped room. The caller owns the popup field
// so we communicate through get/set callbacks.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { ACTIVE_SKILLS } from '../data/barracks';
import type { EquipmentStats } from '../data/barracks';
import { HYBRID_DEFS } from '../data/fusion';
import { MONSTER_DEFS } from '../data/monsters';
import { loadGameState } from '../data/wisdom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { addFramedPanel } from '../ui/GameUiPrimitives';

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

const CARD_W = 116;
const CARD_H = 88;
const CARD_GAP = 8;
const PANEL_PAD = 10;

function getSkillCooldownKey(row: number, col: number, skillId: string): string {
  return `${row}_${col}_${skillId}`;
}

function getCategoryAccent(category: typeof ACTIVE_SKILLS[number]['category']): number {
  switch (category) {
    case 'combat':
      return COLORS.BLOOD_GLOW;
    case 'defense':
      return 0x55b88a;
    case 'support':
      return 0x5cff9b;
    default:
      return COLORS.TORCH_GOLD;
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
  return MONSTER_DEFS[monsterId as keyof typeof MONSTER_DEFS]?.name
    ?? HYBRID_DEFS[monsterId]?.name
    ?? monsterId;
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
    bg.fillStyle(0x07131d, 0.96);
    bg.fillRoundedRect(tipX, tipY, tipW, tipH, 9);
    bg.fillStyle(0x070503, 0.34);
    bg.fillRoundedRect(tipX + 8, tipY + 8, 34, tipH - 16, 7);
    bg.lineStyle(1.2, COLORS.TORCH_GOLD, 0.62);
    bg.strokeRoundedRect(tipX, tipY, tipW, tipH, 9);
    bg.fillStyle(COLORS.TORCH_GOLD, 0.16);
    bg.fillRoundedRect(tipX + 48, tipY + 12, tipW - 62, 3, 2);
    tip.add(bg);
    tip.add(scene.add.text(tipX + 25, tipY + 29, '✦', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5));
    tip.add(scene.add.text(tipX + 52, tipY + 22, '전술 슬롯 비어 있음', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT,
    }).setOrigin(0, 0.5));
    tip.add(scene.add.text(tipX + 52, tipY + 39, monsterName, {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      color: CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0.5));
    scene.tweens.add({ targets: tip, alpha: 1, y: -4, duration: 120, ease: 'Cubic.easeOut' });
    scene.time.delayedCall(1300, () => {
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
    radius: 10,
    fillColor: 0x07131d,
    borderColor: COLORS.TORCH_GOLD,
    borderAlpha: 0.7,
    borderWidth: 1.4,
    accentColor: COLORS.TORCH_GOLD,
    accentAlpha: 0.62,
    glowColor: COLORS.TORCH_AMBER,
    glowOpacity: 0.09,
    shadowOpacity: 0.5,
    shadowOffsetY: 4,
  });
  popup.add([panel.shadow, panel.panel, panel.glow]);

  const header = scene.add.graphics();
  header.fillStyle(0x070503, 0.28);
  header.fillRoundedRect(panelX + 8, panelY + 8, panelW - 16, 28, 8);
  header.fillStyle(COLORS.TORCH_GOLD, 0.18);
  header.fillRoundedRect(panelX + 14, panelY + 13, 4, 18, 2);
  header.fillStyle(0x0f2b3a, 0.88);
  header.fillRoundedRect(panelX + panelW - 44, panelY + 13, 30, 16, 6);
  header.lineStyle(1, COLORS.TORCH_GOLD, 0.36);
  header.strokeRoundedRect(panelX + panelW - 44, panelY + 13, 30, 16, 6);
  popup.add(header);

  const title = scene.add.text(panelX + PANEL_PAD + 14, panelY + 17, '전술 명령', {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: CSS.TORCH_AMBER,
  }).setOrigin(0, 0.5);
  popup.add(title);
  popup.add(scene.add.text(panelX + PANEL_PAD + 14, panelY + 29, `${monsterName} · Lv.${om?.level ?? 1}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '8px',
    color: '#9fc0ce',
  }).setOrigin(0, 0.5));
  popup.add(scene.add.text(panelX + panelW - 29, panelY + 21, slotIndex === null ? 'B?' : `B${slotIndex + 1}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    fontStyle: 'bold',
    color: '#ffe0a3',
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
      bg.fillStyle(0x070503, 0.48);
      bg.fillRoundedRect(bx, by + 4, CARD_W, CARD_H, 8);
      bg.fillStyle(ready ? (hover ? 0x183449 : 0x112434) : 0x171717, 0.98);
      bg.fillRoundedRect(bx, by, CARD_W, CARD_H, 8);
      bg.fillStyle(0xffffff, ready ? (hover ? 0.11 : 0.07) : 0.035);
      bg.fillRoundedRect(bx + 4, by + 4, CARD_W - 8, 22, 6);
      bg.fillStyle(accent, ready ? (hover ? 0.36 : 0.28) : 0.11);
      bg.fillRoundedRect(bx + 7, by + 7, 25, 25, 7);
      bg.fillStyle(accent, ready ? 0.85 : 0.26);
      bg.fillRoundedRect(bx + 38, by + 8, CARD_W - 47, 3, 2);
      bg.fillStyle(accent, ready ? 0.16 : 0.07);
      bg.fillRoundedRect(bx + 8, by + 57, CARD_W - 16, 21, 7);
      bg.lineStyle(hover ? 1.9 : 1.5, ready ? (hover ? COLORS.TORCH_AMBER : accent) : 0x525252, ready ? 0.84 : 0.42);
      bg.strokeRoundedRect(bx, by, CARD_W, CARD_H, 8);
      bg.lineStyle(1, 0xffffff, ready ? 0.2 : 0.08);
      bg.strokeRoundedRect(bx + 4, by + 4, CARD_W - 8, CARD_H - 8, 6);
    };
    drawCard();
    popup.add(bg);

    const iconT = scene.add.text(bx + 19.5, by + 19.5, sk.icon, {
      fontFamily: 'sans-serif',
      fontSize: '17px',
    }).setOrigin(0.5);
    iconT.setAlpha(ready ? 1 : 0.45);
    iconT.setShadow(0, 2, '#000000', 0.38, true, true);
    popup.add(iconT);

    const nameT = scene.add.text(bx + 39, by + 18, sk.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: ready ? '#f2fbff' : '#777777',
      wordWrap: { width: CARD_W - 48 },
    }).setOrigin(0, 0.5);
    popup.add(nameT);

    popup.add(scene.add.text(bx + 10, by + 41, sk.desc, {
      fontFamily: 'Georgia, serif',
      fontSize: '8px',
      color: ready ? '#aacbd8' : '#666666',
      wordWrap: { width: CARD_W - 20 },
      lineSpacing: -1,
    }).setOrigin(0, 0.5));

    const categoryBg = scene.add.graphics();
    categoryBg.fillStyle(accent, ready ? 0.18 : 0.08);
    categoryBg.fillRoundedRect(bx + 8, by + CARD_H - 25, 32, 17, 6);
    categoryBg.lineStyle(1, accent, ready ? 0.42 : 0.18);
    categoryBg.strokeRoundedRect(bx + 8, by + CARD_H - 25, 32, 17, 6);
    popup.add(categoryBg);
    popup.add(scene.add.text(bx + 24, by + CARD_H - 16.5, categoryLabel, {
      fontFamily: 'monospace',
      fontSize: '8px',
      fontStyle: 'bold',
      color: ready ? '#d9fbff' : '#777777',
    }).setOrigin(0.5));

    const cooldownBg = scene.add.graphics();
    cooldownBg.fillStyle(0x070503, 0.42);
    cooldownBg.fillRoundedRect(bx + CARD_W - 43, by + 10, 32, 14, 5);
    cooldownBg.lineStyle(1, 0xffffff, 0.12);
    cooldownBg.strokeRoundedRect(bx + CARD_W - 43, by + 10, 32, 14, 5);
    popup.add(cooldownBg);
    popup.add(scene.add.text(bx + CARD_W - 27, by + 17, `${sk.cooldown}s`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: ready ? '#e8d5aa' : '#777777',
    }).setOrigin(0.5));

    const cdLeft = ready
      ? '준비됨'
      : `${Math.ceil((readyAt - now) / 1000)}s`;
    const statusBg = scene.add.graphics();
    statusBg.fillStyle(ready ? 0x0d3627 : 0x35170f, 0.86);
    statusBg.fillRoundedRect(bx + 45, by + CARD_H - 25, CARD_W - 53, 17, 7);
    statusBg.lineStyle(1, ready ? 0x5cff9b : 0xff7a4d, ready ? 0.48 : 0.38);
    statusBg.strokeRoundedRect(bx + 45, by + CARD_H - 25, CARD_W - 53, 17, 7);
    popup.add(statusBg);

    const cdT = scene.add.text(bx + 45 + (CARD_W - 53) / 2, by + CARD_H - 16.5, cdLeft, {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: ready ? '#8cffc1' : '#ff9a78',
    }).setOrigin(0.5);
    popup.add(cdT);

    if (ready) {
      const zone = scene.add.zone(bx + CARD_W / 2, by + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => drawCard(true));
      zone.on('pointerout', () => drawCard(false));
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

  scene.tweens.add({
    targets: popup,
    alpha: 1,
    y: -4,
    duration: 150,
    ease: 'Cubic.easeOut',
  });
}
