/**
 * MonsterDetailSkin.ts — skin slot, skin display card, skin mini-card,
 * and locked-skin purchase popup for MonsterDetailPanel.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import {
  getSkinForMonster,
  getSkinsForMonster,
  resolveOwnedMonsterProfile,
  type MonsterSkin,
} from '../data/monsters';
import { equipSkin, purchaseSkin, unequipSkin } from '../data/shopTransactions';
import { getQuest } from '../data/quests';
import {
  type MonsterDetailContext,
  getSkinRarityColor,
  shortenLabel,
} from './MonsterDetailShared';

// getSkinForMonster imported to avoid TS "unused" on line that reads it in original
void getSkinForMonster;

// ─── Skin Slot ────────────────────────────────────────────────────────────────

export function buildSkinSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene } = ctx;
  const gs          = loadGameState();
  const profile     = resolveOwnedMonsterProfile(m.id);
  const typeId      = profile?.registryId ?? m.id;
  const allSkins    = getSkinsForMonster(typeId);
  const ownedSkinIds = gs.ownedSkins?.[typeId] ?? [];
  const owned       = allSkins.filter(s => ownedSkinIds.includes(s.id));
  const locked      = allSkins.filter(s => !ownedSkinIds.includes(s.id));
  const equipped    = gs.equippedSkins?.[typeId];

  const baseW    = 78;
  const galleryX = x + baseW + 8;
  const galleryW = w - baseW - 8;
  drawSkinDisplayCard(ctx, ov, m, typeId, x, y, baseW, null, !equipped, profile?.emoji ?? '?', '기본');

  const gallery = scene.add.graphics();
  gallery.fillStyle(DUNGEON_UI.SOOT, 1);
  gallery.fillRoundedRect(galleryX, y, galleryW, 88, 8);
  gallery.fillStyle(DUNGEON_UI.JADE, 0.1);
  gallery.fillRoundedRect(galleryX + 6, y + 7, galleryW - 12, 18, 5);
  gallery.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
  gallery.strokeRoundedRect(galleryX, y, galleryW, 88, 8);
  ov.add(gallery);

  ov.add(scene.add.text(galleryX + 10, y + 15, `스킨 도감 ${owned.length}/${allSkins.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(galleryX + galleryW - 10, y + 15, locked.length > 0 ? `잠금 ${locked.length}` : '완성', {
    fontFamily: 'monospace',
    fontSize: '9px',
    fontStyle: 'bold',
    color: locked.length > 0 ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.JADE,
  }).setOrigin(1, 0.5));

  if (allSkins.length === 0) {
    ov.add(scene.add.text(galleryX + galleryW / 2, y + 52, '이 수호자의 외형은 아직 없습니다', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    return;
  }

  const miniSize = 44;
  const miniGap  = 5;
  [...owned, ...locked].slice(0, 5).forEach((skin, i) => {
    const sx      = galleryX + 10 + i * (miniSize + miniGap);
    const isOwned  = ownedSkinIds.includes(skin.id);
    const isActive = equipped === skin.id;
    drawSkinMiniCard(ctx, ov, m, sx, y + 34, miniSize, skin, isOwned, isActive);
  });

  const nextLocked = locked[0];
  if (nextLocked) {
    const nextVia = nextLocked.unlockVia === 'quest' && nextLocked.unlockRef
      ? `퀘스트 ${getQuest(nextLocked.unlockRef)?.title ?? nextLocked.unlockRef}`
      : `상점 보석 ${nextLocked.gemCost}`;
    ov.add(scene.add.text(galleryX + galleryW - 10, y + 81, shortenLabel(nextVia, 16), {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5));
  }
}

// ─── Skin Display Card ────────────────────────────────────────────────────────

export function drawSkinDisplayCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  typeId: string,
  x: number,
  y: number,
  w: number,
  skin: MonsterSkin | null,
  active: boolean,
  fallbackEmoji: string,
  fallbackLabel: string,
): void {
  const { scene, onRefresh } = ctx;
  const accent = skin ? getSkinRarityColor(skin) : DUNGEON_UI.BRASS;
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 1);
  bg.fillRoundedRect(x, y, w, 88, 7);
  bg.fillStyle(accent, active ? 0.2 : 0.1);
  bg.fillRoundedRect(x + 7, y + 9, w - 14, 50, 7);
  bg.lineStyle(active ? 2 : 1.5, active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON, 0.9);
  bg.strokeRoundedRect(x, y, w, 88, 7);
  ov.add(bg);

  ov.add(scene.add.text(x + w / 2, y + 34, skin ? skin.emoji : fallbackEmoji, {
    fontFamily: 'sans-serif',
    fontSize: skin ? '28px' : '30px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + w / 2, y + 71, skin ? shortenLabel(skin.name, 5) : fallbackLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: active ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + w / 2, y + 44, w, 88).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    const state  = loadGameState();
    const result = skin ? equipSkin(state, skin.monsterId, skin.id) : unequipSkin(state, typeId);
    if (result.ok && result.changed) saveGameState(result.state);
    ov.destroy();
    onRefresh(m);
  });
  ov.add(zone);
}

// ─── Skin Mini-Card ───────────────────────────────────────────────────────────

export function drawSkinMiniCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number,
  y: number,
  size: number,
  skin: MonsterSkin,
  owned: boolean,
  active: boolean,
): void {
  const { scene, onRefresh } = ctx;
  const accent = getSkinRarityColor(skin);
  const bg = scene.add.graphics();
  // 활성=초록 채도 타일, 보유=크림 타일+레어 액센트, 잠금=뮤트 크림
  bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(accent, active ? 0.22 : owned ? 0.1 : 0.04);
  bg.fillRoundedRect(x + 4, y + 4, size - 8, size - 8, 4);
  bg.lineStyle(owned ? 2 : 1.5, active ? DUNGEON_UI.JADE : owned ? accent : DUNGEON_UI.EDGE, owned ? 1 : 0.55);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);
  ov.add(scene.add.text(x + size / 2, y + size / 2 - 1, owned ? skin.emoji : '×', {
    fontFamily: 'sans-serif',
    fontSize: owned ? '14px' : '12px',
    color: owned ? '#ffffff' : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  if (skin.rarity !== 'normal') {
    ov.add(scene.add.text(x + size - 4, y + 5, skin.rarity === 'limited' ? 'L' : 'R', {
      fontFamily: 'monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: active ? '#ffffff' : `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0.5));
  }

  const zone = scene.add.zone(x + size / 2, y + size / 2, size, size).setInteractive({ useHandCursor: true });
  if (owned) {
    zone.on('pointerdown', () => {
      const result = equipSkin(loadGameState(), skin.monsterId, skin.id);
      if (result.ok && result.changed) saveGameState(result.state);
      ov.destroy();
      onRefresh(m);
    });
  } else {
    zone.on('pointerdown', () => showLockedSkinPopup(ctx, ov, m, skin));
  }
  ov.add(zone);
}

// ─── Locked Skin Purchase Popup ───────────────────────────────────────────────

export function showLockedSkinPopup(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  skin: MonsterSkin,
): void {
  const { scene, onRefresh } = ctx;
  scene.children.getByName('skinBuyPopup')?.destroy();

  const isQuestSkin = skin.unlockVia === 'quest';
  const popW = 250;
  const popH = isQuestSkin ? 96 : 128;
  const pop  = scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    .setName('skinBuyPopup').setDepth(220);

  const dim = scene.add.zone(0, 0, CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2).setInteractive();
  dim.once('pointerdown', () => pop.destroy());
  pop.add(dim);

  const accent = getSkinRarityColor(skin);
  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.SHADOW, 0.3);
  bg.fillRoundedRect(-popW / 2, -popH / 2 + 6, popW, popH, 12);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(-popW / 2 + 5, -popH / 2 + 4, popW - 10, 6, 4);
  bg.fillStyle(accent, 1);
  bg.fillRoundedRect(-popW / 2 + 6, -popH / 2 + 6, popW - 12, 8, 4);
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
  pop.add(bg);

  pop.add(scene.add.text(0, -popH / 2 + 22, `${skin.emoji} ${skin.name}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0.5));

  if (isQuestSkin) {
    const questTitle = skin.unlockRef
      ? getQuest(skin.unlockRef)?.title ?? skin.unlockRef
      : '?';
    pop.add(scene.add.text(0, -popH / 2 + 48, `퀘스트 「${questTitle}」\n완료 시 해금됩니다`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0));
    return;
  }

  if (!skin.available) {
    pop.add(scene.add.text(0, -popH / 2 + 52, '기간 한정 스킨 — 현재 판매 종료', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    return;
  }

  const gems      = loadGameState().gems ?? 0;
  const canAfford = gems >= skin.gemCost;
  pop.add(scene.add.text(0, -popH / 2 + 44, `보유 보석 ${gems.toLocaleString()}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  const btnW = 150;
  const btnH = 34;
  const btnY = popH / 2 - 28;
  const btn  = scene.add.graphics();
  btn.fillStyle(canAfford ? CASUAL.BLUE_DK : CASUAL.EDGE_SOFT, 1);
  btn.fillRoundedRect(-btnW / 2, btnY - btnH / 2 + 4, btnW, btnH, 10);
  btn.fillStyle(canAfford ? CASUAL.BLUE : CASUAL.PANEL_SOFT, 1);
  btn.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH - 2, 10);
  btn.fillStyle(0xffffff, canAfford ? 0.32 : 0.4);
  btn.fillRoundedRect(-btnW / 2 + 5, btnY - btnH / 2 + 4, btnW - 10, 10, 6);
  pop.add(btn);
  pop.add(scene.add.text(0, btnY, canAfford ? `보석 ${skin.gemCost} 구매` : '보석 부족', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: canAfford ? '#ffffff' : CASUAL_CSS.INK_SOFT,
    stroke: canAfford ? '#00000033' : undefined,
    strokeThickness: canAfford ? 3 : 0,
  }).setOrigin(0.5));

  if (!canAfford) return;
  const btnZone = scene.add.zone(0, btnY, btnW + 28, btnH + 28).setInteractive({ useHandCursor: true });
  btnZone.on('pointerdown', () => {
    const result = purchaseSkin(loadGameState(), skin.monsterId, skin.id, skin.gemCost);
    if (!result.ok) {
      pop.destroy();
      return;
    }
    if (result.changed) {
      const equipped = equipSkin(result.state, skin.monsterId, skin.id);
      saveGameState(equipped.ok ? equipped.state : result.state);
    }
    pop.destroy();
    ov.destroy();
    onRefresh(m);
  });
  pop.add(btnZone);
}
