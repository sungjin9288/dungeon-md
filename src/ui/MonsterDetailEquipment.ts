/**
 * MonsterDetailEquipment.ts — equipment slot, mini-cards, and equipped-skill
 * slot builders for MonsterDetailPanel.
 */
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS } from '../data/barracks';
import { equipMonsterEquipment, cycleMonsterActiveSkillSlot } from '../data/barracksTransactions';
import { addPrimaryActionButton } from './GameUiPrimitives';
import {
  type MonsterDetailContext,
  type EquipmentDisplay,
  getEquipmentDisplay,
  getEquipmentInventoryIds,
  getEquipmentTypeMeta,
  getEquipmentStars,
  getEquipmentRarityColor,
  getRecommendedEquipmentId,
  getEquipmentImpactLabel,
  shortenLabel,
  equipmentTileLabel,
} from './MonsterDetailShared';

// Keep EQUIPMENT_DEFS import to prevent unused import warning — used via getEquipmentDisplay indirectly
void EQUIPMENT_DEFS;

// ─── Equipment Slot ───────────────────────────────────────────────────────────
export function buildEquipmentSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  monster: OwnedMonster,
  x: number,
  y: number,
  w: number,
): void {
  const { scene } = ctx;
  const state = loadGameState();
  const equipmentId = monster.equipment;
  const equipment = equipmentId ? getEquipmentDisplay(state, equipmentId) : null;
  const typeMeta = getEquipmentTypeMeta(equipment?.type);
  const inventory = getEquipmentInventoryIds(state)
    .map(id => getEquipmentDisplay(state, id))
    .filter((item): item is EquipmentDisplay => Boolean(item));
  const accent = equipment ? getEquipmentRarityColor(equipment.rarity) : DUNGEON_UI.EDGE;
  const recommendedId = getRecommendedEquipmentId(inventory, equipmentId);

  const current = scene.add.graphics();
  current.fillStyle(DUNGEON_UI.SOOT, 0.98);
  current.fillRoundedRect(x, y, w, 66, 7);
  current.fillStyle(accent, equipment ? 0.18 : 0.08);
  current.fillRoundedRect(x + 7, y + 7, 52, 52, 6);
  current.lineStyle(1.5, accent, equipment ? 0.82 : 0.46);
  current.strokeRoundedRect(x + 7, y + 7, 52, 52, 6);
  current.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
  current.strokeRoundedRect(x, y, w, 66, 7);
  current.lineStyle(2, accent, 0.76);
  current.lineBetween(x + 24, y + 19, x + 42, y + 47);
  current.lineBetween(x + 42, y + 19, x + 24, y + 47);
  ov.add(current);

  ov.add(scene.add.text(x + 72, y + 14, equipment ? typeMeta.label + ' · ' + getEquipmentStars(equipment.rarity) : '비어 있는 장비 슬롯', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: equipment ? typeMeta.css : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 72, y + 34, equipment ? shortenLabel(equipment.name, 18) : '장비 미장착', {
    fontFamily: 'sans-serif',
    fontSize: '15px',
    fontStyle: 'bold',
    color: equipment ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 72, y + 52,
    equipment ? getEquipmentImpactLabel(equipment) : '추천 장비를 탭하거나 공방에서 제작하세요', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: equipment ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));

  const storageY = y + 74;
  const storage = scene.add.graphics();
  storage.fillStyle(DUNGEON_UI.SOOT, 0.98);
  storage.fillRoundedRect(x, storageY, w, 94, 7);
  storage.fillStyle(DUNGEON_UI.BRASS, 0.1);
  storage.fillRect(x + 1, storageY + 1, 4, 92);
  storage.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
  storage.strokeRoundedRect(x, storageY, w, 94, 7);
  ov.add(storage);

  ov.add(scene.add.text(x + 12, storageY + 15, '장비 보관함 ' + inventory.length, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  // Name the recommendation and its effect: the tiles alone showed only an icon.
  const recommendedItem = inventory.find(item => item.id === recommendedId);
  ov.add(scene.add.text(x + w - 12, storageY + 15,
    recommendedItem
      ? `추천 ${shortenLabel(recommendedItem.name, 8)} · ${shortenLabel(getEquipmentImpactLabel(recommendedItem), 14)}`
      : inventory.length > 0 ? '추천 장비 우선' : '제작 필요', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: inventory.length > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5));

  inventory.slice(0, 4).forEach((item, index) => {
    drawEquipmentMiniCard(
      ctx,
      ov,
      monster,
      item,
      x + 12 + index * 48,
      storageY + 35,
      44,
      equipmentId === item.id,
      item.id === recommendedId,
    );
  });
  if (inventory.length === 0) {
    ov.add(scene.add.text(x + 82, storageY + 58, '보관 중인 장비 없음', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
  }

  const forgeButton = addPrimaryActionButton(scene, {
    x: x + w - 126,
    y: storageY + 35,
    w: 114,
    h: 44,
    label: inventory.length > 0 ? '추가 제작' : '공방으로',
    fontSize: '11px',
    fillColor: DUNGEON_UI.STONE_RAISED,
    hoverFillColor: 0x2d382e,
    borderColor: DUNGEON_UI.BRASS,
    hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    textColor: DUNGEON_UI_CSS.BRASS,
    onPress: () => {
      ov.destroy();
      if (ctx.onOpenForge) {
        ctx.onOpenForge(monster);
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
  const tileBorder = equipped ? DUNGEON_UI.JADE : recommended ? DUNGEON_UI.BRASS_BRIGHT : accent;
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(tileBorder, equipped || recommended ? 0.18 : 0.08);
  bg.fillRoundedRect(x + 4, y + 4, size - 8, size - 8, 4);
  bg.lineStyle(equipped || recommended ? 2 : 1.5, tileBorder, equipped || recommended ? 1 : 0.7);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);

  ov.add(scene.add.text(x + size / 2, y + 15, typeMeta.icon, {
    fontFamily: 'sans-serif',
    fontSize: '16px',
    color: typeMeta.css,
  }).setOrigin(0.5));
  // Status reads from the border (jade 장착, brass 추천); the label names the item.
  ov.add(scene.add.text(x + size / 2, y + 33, equipped ? '장착' : equipmentTileLabel(ed.name), {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: equipped ? DUNGEON_UI_CSS.JADE : recommended ? DUNGEON_UI_CSS.BRASS : typeMeta.css,
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
    const accent   = sk ? 0x8f6eb7 : hasOwnedSkills ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE;
    const label    = sk ? sk.name : '장착 대기';
    const subLabel = sk
      ? `쿨다운 ${sk.cooldown}s`
      : hasOwnedSkills
        ? `보유 ${ownedSkillCount} 스킬`
        : '상점 필요';

    const bg = scene.add.graphics();
    bg.fillStyle(DUNGEON_UI.SOOT, 1);
    bg.fillRoundedRect(sx, y, slotW, 50, 8);
    bg.fillStyle(accent, sk ? 0.2 : 0.1);
    bg.fillRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(1.5, accent, sk ? 0.9 : 0.62);
    bg.strokeRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
    bg.strokeRoundedRect(sx, y, slotW, 50, 8);
    ov.add(bg);

    ov.add(scene.add.text(sx + 25, y + 25, `S${si + 1}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: sk ? '#d9c4ef' : DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(scene.add.text(sx + 57, y + 16, label, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: sk ? DUNGEON_UI_CSS.PARCHMENT : hasOwnedSkills ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + 57, y + 33, subLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: sk ? '#b9a3cf' : hasOwnedSkills ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
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
