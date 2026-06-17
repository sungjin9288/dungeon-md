/**
 * MonsterDetailEquipment.ts — equipment slot, mini-cards, and equipped-skill
 * slot builders for MonsterDetailPanel.
 */
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS } from '../data/barracks';
import { equipMonsterEquipment, cycleMonsterActiveSkillSlot } from '../data/barracksTransactions';
import { addPrimaryActionButton } from './GameUiPrimitives';
import {
  type MonsterDetailContext,
  type EquipmentDisplay,
  SHOP_PURPLE,
  getEquipmentDisplay,
  getEquipmentInventoryIds,
  getEquipmentTypeMeta,
  getEquipmentStars,
  getEquipmentRarityColor,
  getRecommendedEquipmentId,
  getEquipmentImpactLabel,
  shortenLabel,
} from './MonsterDetailShared';

// Keep EQUIPMENT_DEFS import to prevent unused import warning — used via getEquipmentDisplay indirectly
void EQUIPMENT_DEFS;

// ─── Equipment Slot ───────────────────────────────────────────────────────────

export function buildEquipmentSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene } = ctx;
  const gs    = loadGameState();
  const eqId  = m.equipment;
  const eqDef = eqId ? getEquipmentDisplay(gs, eqId) : null;
  const typeMeta  = getEquipmentTypeMeta(eqDef?.type);
  const inventory = getEquipmentInventoryIds(gs)
    .map(eId => getEquipmentDisplay(gs, eId))
    .filter((ed): ed is EquipmentDisplay => Boolean(ed));
  const equippedLabel        = eqDef
    ? `${typeMeta.icon} ${typeMeta.label} · ${getEquipmentStars(eqDef.rarity)}`
    : '장비 슬롯 비어 있음';
  const slotAccent           = eqDef ? getEquipmentRarityColor(eqDef.rarity) : CASUAL.EDGE_SOFT;
  const recommendedEquipmentId = getRecommendedEquipmentId(inventory, eqId);
  const impactLabel          = eqDef ? getEquipmentImpactLabel(eqDef) : '전력 보강 대기';

  const leftW  = 154;
  const rightX = x + leftW + 8;
  const rightW = w - leftW - 8;

  const slotBg = scene.add.graphics();
  slotBg.fillStyle(eqDef ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
  slotBg.fillRoundedRect(x, y, leftW, 68, 9);
  slotBg.fillStyle(0xffffff, 0.12);
  slotBg.fillRoundedRect(x + 5, y + 4, leftW - 10, 4, 3);
  slotBg.fillStyle(slotAccent, eqDef ? 0.22 : 0.12);
  slotBg.fillRoundedRect(x + 6, y + 6, 46, 56, 8);
  slotBg.lineStyle(2, slotAccent, eqDef ? 1 : 0.7);
  slotBg.strokeRoundedRect(x + 6, y + 6, 46, 56, 8);
  slotBg.lineStyle(3, CASUAL.EDGE, 1);
  slotBg.strokeRoundedRect(x, y, leftW, 68, 9);
  slotBg.fillStyle(slotAccent, eqDef ? 0.28 : 0.16);
  slotBg.fillRoundedRect(x + 64, y + 48, 74, 13, 5);
  ov.add(slotBg);

  ov.add(scene.add.text(x + 29, y + 24, eqDef ? eqDef.icon : '◇', {
    fontFamily: 'sans-serif',
    fontSize: eqDef ? '24px' : '22px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 29, y + 48, eqDef ? getEquipmentStars(eqDef.rarity) : 'EMPTY', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  ov.add(scene.add.text(x + 66, y + 11, equippedLabel, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? typeMeta.css : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 29, eqDef ? shortenLabel(eqDef.name, 8) : '장비 미장착', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: eqDef ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 44, eqDef ? shortenLabel(eqDef.desc, 13) : '보관함에서 장착', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 101, y + 54.5, impactLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const invBg = scene.add.graphics();
  invBg.fillStyle(CASUAL.PANEL_SOFT, 1);
  invBg.fillRoundedRect(rightX, y, rightW, 68, 9);
  invBg.fillStyle(0xffffff, 0.12);
  invBg.fillRoundedRect(rightX + 5, y + 4, rightW - 10, 4, 3);
  invBg.fillStyle(CASUAL.GOLD, 0.16);
  invBg.fillRoundedRect(rightX + 5, y + 5, rightW - 10, 15, 6);
  invBg.lineStyle(3, CASUAL.EDGE, 1);
  invBg.strokeRoundedRect(rightX, y, rightW, 68, 9);
  ov.add(invBg);

  ov.add(scene.add.text(rightX + 8, y + 9, `보관함 ${inventory.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(rightX + rightW - 8, y + 9, inventory.length > 0 ? '탭 장착' : '제작 필요', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: inventory.length > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  inventory.slice(0, 4).forEach((ed, idx) => {
    drawEquipmentMiniCard(ctx, ov, m, ed, rightX + 8 + idx * 31, y + 20, 27, eqId === ed.id, ed.id === recommendedEquipmentId);
  });
  if (inventory.length > 4) {
    ov.add(scene.add.text(rightX + rightW - 12, y + 34, `+${inventory.length - 4}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.INK_SOFT,
      padding: { x: 3, y: 1 },
    }).setOrigin(1, 0.5));
  }
  if (inventory.length === 0) {
    ov.add(scene.add.text(rightX + rightW / 2, y + 32, '장비 없음', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
  }

  const forgeButton = addPrimaryActionButton(scene, {
    x: rightX + 8,
    y: y + 48,
    w: rightW - 16,
    h: 18,
    label: inventory.length > 0 ? '⚒ 장비 더 제작' : '⚒ 장비 제작소',
    fontSize: '9px',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd45f,
    borderColor: CASUAL.GOLD_DK,
    hoverBorderColor: CASUAL.GOLD_DK,
    textColor: '#ffffff',
    onPress: () => {
      ov.destroy();
      if (ctx.onOpenForge) {
        ctx.onOpenForge(m);
      } else {
        scene.scene.start('ForgeScene');
      }
    },
  });
  ov.add(forgeButton.bg);
  ov.add(forgeButton.text);
  ov.add(forgeButton.zone);
}

// ─── Equipment Mini-Card ──────────────────────────────────────────────────────

export function drawEquipmentMiniCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  ed: EquipmentDisplay,
  x: number, y: number, size: number,
  equipped: boolean,
  recommended: boolean,
): void {
  const { scene, onRefresh } = ctx;
  const typeMeta  = getEquipmentTypeMeta(ed.type);
  const accent    = getEquipmentRarityColor(ed.rarity);
  const tileBorder = equipped ? CASUAL.GREEN : recommended ? CASUAL.GOLD : accent;
  const bg = scene.add.graphics();
  bg.fillStyle(equipped ? CASUAL.GREEN : recommended ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(0xffffff, equipped ? 0.28 : 0.4);
  bg.fillRoundedRect(x + 3, y + 3, size - 6, 3, 2);
  bg.lineStyle(equipped || recommended ? 2 : 1.5, tileBorder, equipped || recommended ? 1 : 0.7);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);

  ov.add(scene.add.text(x + size / 2, y + 10, ed.icon, {
    fontFamily: 'sans-serif',
    fontSize: '14px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + size / 2, y + 21, equipped ? '✓' : recommended ? 'BEST' : typeMeta.icon, {
    fontFamily: 'sans-serif',
    fontSize: equipped || recommended ? '7px' : '8px',
    color: equipped ? '#ffffff' : recommended ? CASUAL_CSS.GOLD : typeMeta.css,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + size / 2, y + size / 2, Math.max(32, size), Math.max(32, size)).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    const result = equipMonsterEquipment(loadGameState(), m.id, ed.id);
    if (!result.ok) return;
    saveGameState(result.state);
    ov.destroy();
    onRefresh(result.monster);
  });
  ov.add(zone);
}

// ─── Equipped Skill Slots ─────────────────────────────────────────────────────

export function buildEquippedSkillSlots(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene, onRefresh } = ctx;
  const gs = loadGameState();
  const ownedSkillCount = (gs.ownedActiveSkills ?? []).length;
  const hasOwnedSkills  = ownedSkillCount > 0;
  const slots = [0, 1];
  slots.forEach(si => {
    const slotW    = w / 2 - 4;
    const sx       = x + si * (w / 2 + 4);
    const skId     = (m.equippedSkills ?? [])[si];
    const sk       = skId ? ACTIVE_SKILLS.find(s => s.id === skId) : null;
    const accent   = sk ? SHOP_PURPLE : hasOwnedSkills ? CASUAL.BLUE : CASUAL.EDGE_SOFT;
    const label    = sk ? sk.name : '장착 대기';
    const subLabel = sk
      ? `쿨다운 ${sk.cooldown}s`
      : hasOwnedSkills
        ? `보유 ${ownedSkillCount} 스킬`
        : '상점 필요';

    const bg = scene.add.graphics();
    // 장착됨=보라 채도 타일(흰글자), 비어있음=크림 타일(잉크글자)
    bg.fillStyle(sk ? SHOP_PURPLE : hasOwnedSkills ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
    bg.fillRoundedRect(sx, y, slotW, 50, 8);
    bg.fillStyle(0xffffff, sk ? 0.26 : 0.4);
    bg.fillRoundedRect(sx + 5, y + 4, slotW - 10, 4, 3);
    bg.fillStyle(sk ? 0xffffff : accent, sk ? 0.22 : 0.16);
    bg.fillRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(2, sk ? CASUAL.PURPLE_DK : accent, sk ? 1 : 0.7);
    bg.strokeRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(3, CASUAL.EDGE, 1);
    bg.strokeRoundedRect(sx, y, slotW, 50, 8);
    ov.add(bg);

    ov.add(scene.add.text(sx + 25, y + 25, sk ? sk.icon : '+', {
      fontFamily: 'sans-serif',
      fontSize: sk ? '21px' : '24px',
      color: sk ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(scene.add.text(sx + 57, y + 16, label, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: sk ? '#ffffff' : hasOwnedSkills ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + 57, y + 33, subLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: sk ? '#ffffff' : hasOwnedSkills ? CASUAL_CSS.BLUE : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + slotW - 9, y + 10, `S${si + 1}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: sk ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    // Tap to cycle through owned skills
    const zone = scene.add.zone(sx + slotW / 2, y + 25, slotW, 50).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      const result = cycleMonsterActiveSkillSlot(loadGameState(), m.id, si);
      if (!result.ok) return;
      saveGameState(result.state);
      ov.destroy();
      onRefresh(result.monster);
    });
    ov.add(zone);
  });
}
