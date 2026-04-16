import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { SKIN_DATA, MONSTER_DEFS, type MonsterSkin } from '../data/monsters';
import { addPanelShadow, addInnerGlow } from './PanelDepth';

export type SkinFilter = 'all' | 'normal' | 'rare' | 'limited';

export interface ShopSkinTabContext {
  readonly scene: Phaser.Scene;
  readonly contentCtr: Phaser.GameObjects.Container;
  readonly gemsText: Phaser.GameObjects.Text;
  readonly showToast: (msg: string) => void;
  readonly showPurchaseFlash: (cost: number, icon: string, color: string) => void;
  readonly refreshContent: () => void;
}

interface SkinFilterState {
  skinFilter: SkinFilter;
  setSkinFilter: (f: SkinFilter) => void;
}

export function buildSkinTab(
  ctx: ShopSkinTabContext,
  filterState: SkinFilterState,
): void {
  const { scene, contentCtr } = ctx;
  const { skinFilter, setSkinFilter } = filterState;
  const gs = loadGameState();
  const TOP = 100;

  const filters: { id: SkinFilter; label: string }[] = [
    { id: 'all',     label: '전체' },
    { id: 'normal',  label: '일반' },
    { id: 'rare',    label: '레어' },
    { id: 'limited', label: '한정' },
  ];
  const fW = CANVAS_WIDTH / filters.length;
  const fg = scene.add.graphics();
  contentCtr.add(fg);

  filters.forEach(({ id, label }, i) => {
    const isActive = id === skinFilter;
    fg.fillStyle(isActive ? 0x220044 : 0x0a0010, 1);
    fg.fillRoundedRect(i * fW + 4, TOP, fW - 8, 26, 4);
    if (isActive) {
      fg.lineStyle(1, 0xaa44ff, 0.8);
      fg.strokeRoundedRect(i * fW + 4, TOP, fW - 8, 26, 4);
    }

    const ft = scene.add.text(i * fW + fW / 2, TOP + 13, label, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: isActive ? '#dd88ff' : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(6);
    contentCtr.add(ft);

    const fz = scene.add.zone(i * fW + fW / 2, TOP + 13, fW - 8, 26)
      .setInteractive().setDepth(7);
    contentCtr.add(fz);
    fz.on('pointerdown', () => {
      setSkinFilter(id);
      ctx.refreshContent();
    });
  });

  const skins = SKIN_DATA.filter(s => skinFilter === 'all' || s.rarity === skinFilter);
  const COLS = 2;
  const CARD_W = (CANVAS_WIDTH - 24) / COLS;
  const CARD_H = 140;
  const START_Y = TOP + 34;

  skins.forEach((skin, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const cx  = 8 + col * (CARD_W + 8);
    const cy  = START_Y + row * (CARD_H + 8);
    drawSkinCard(ctx, skin, cx, cy, CARD_W, CARD_H, gs);
  });

  if (skins.length === 0) {
    const emptyT = scene.add.text(CANVAS_WIDTH / 2, START_Y + 60, '해당 필터의 스킨이 없습니다.', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(6);
    contentCtr.add(emptyT);
  }
}

function drawSkinCard(
  ctx: ShopSkinTabContext,
  skin: MonsterSkin,
  x: number, y: number, w: number, h: number,
  gs: ReturnType<typeof loadGameState>,
): void {
  const { scene, contentCtr, gemsText } = ctx;
  const ownedList = gs.ownedSkins?.[skin.monsterId] ?? [];
  const isOwned   = ownedList.includes(skin.id);
  const equipped  = gs.equippedSkins?.[skin.monsterId] === skin.id;

  const rarityLabel = { normal: '일반', rare: '레어', limited: '한정' };
  const rarityStars = { normal: '⭐', rare: '⭐⭐⭐', limited: '⭐⭐⭐⭐⭐' };

  const shadow = addPanelShadow(scene, x, y, w, h, 10, { offsetY: 3, opacity: 0.5 });
  contentCtr.add(shadow);

  const g = scene.add.graphics();
  g.fillStyle(isOwned ? 0x0a1a1a : 0x0d0d22, 1);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1.5, isOwned ? 0x44aa88 : (skin.rarity === 'limited' ? 0xcc2222 : 0x4466aa), 0.7);
  g.strokeRoundedRect(x, y, w, h, 10);
  contentCtr.add(g);

  const glowColor = skin.rarity === 'limited' ? 0xffaa88 : 0xaaccff;
  contentCtr.add(addInnerGlow(scene, x, y, w, h, 10, glowColor, 0.14));

  if (skin.rarity === 'limited') {
    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(0x880000, 1);
    badgeBg.fillRoundedRect(x + w - 44, y + 6, 38, 16, 4);
    contentCtr.add(badgeBg);
    contentCtr.add(scene.add.text(x + w - 25, y + 14, '한정', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffaaaa',
    }).setOrigin(0.5).setDepth(6));
  }

  contentCtr.add(scene.add.text(x + 36, y + h / 2 - 4, skin.emoji, {
    fontFamily: 'sans-serif', fontSize: '36px',
  }).setOrigin(0.5).setDepth(6));

  const dotG = scene.add.graphics();
  dotG.fillStyle(skin.particleColor, 0.9);
  dotG.fillCircle(x + 58, y + h / 2 + 20, 5);
  contentCtr.add(dotG);

  contentCtr.add(scene.add.text(x + 68, y + 12, skin.name, {
    fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
    color: isOwned ? '#88ddcc' : '#ffffff',
  }).setDepth(6));

  contentCtr.add(scene.add.text(x + 68, y + 30, `${rarityStars[skin.rarity]}  ${rarityLabel[skin.rarity]}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaacc',
  }).setDepth(6));

  const mDef = MONSTER_DEFS[skin.monsterId];
  contentCtr.add(scene.add.text(x + 68, y + 47, mDef ? mDef.name : skin.monsterId, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
  }).setDepth(6));

  if (isOwned) {
    const owBadge = scene.add.text(x + 68, y + 65, equipped ? '✓ 장착 중' : '보유 중', {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: equipped ? '#44ffaa' : '#66aa66',
    }).setDepth(6);
    contentCtr.add(owBadge);

    const btnLabel = equipped ? '해제' : '장착';
    const btnColor = equipped ? 0x442200 : 0x002244;
    const btnBorderColor = equipped ? 0xcc6600 : 0x4488ff;
    const btnW2 = 56, btnH2 = 26;
    const bx = x + w - btnW2 - 8, by = y + h - btnH2 - 10;
    const bbg = scene.add.graphics();
    bbg.fillStyle(btnColor, 1);
    bbg.fillRoundedRect(bx, by, btnW2, btnH2, 5);
    bbg.lineStyle(1, btnBorderColor, 0.8);
    bbg.strokeRoundedRect(bx, by, btnW2, btnH2, 5);
    contentCtr.add(bbg);
    contentCtr.add(scene.add.text(bx + btnW2 / 2, by + btnH2 / 2, btnLabel, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: equipped ? '#ffaa44' : '#88bbff',
    }).setOrigin(0.5).setDepth(7));

    const zone = scene.add.zone(bx + btnW2 / 2, by + btnH2 / 2, btnW2, btnH2)
      .setInteractive().setDepth(8);
    contentCtr.add(zone);
    zone.on('pointerdown', () => {
      const state = loadGameState();
      if (!state.equippedSkins) state.equippedSkins = {};
      if (equipped) {
        delete state.equippedSkins[skin.monsterId];
      } else {
        state.equippedSkins[skin.monsterId] = skin.id;
      }
      saveGameState(state);
      gemsText.setText(`💎 ${state.gems} 젬`);
      ctx.refreshContent();
    });

    const pbx = bx - 64, pby = by;
    const pbg = scene.add.graphics();
    pbg.fillStyle(0x111133, 1);
    pbg.fillRoundedRect(pbx, pby, 56, 26, 5);
    pbg.lineStyle(1, 0x6644aa, 0.6);
    pbg.strokeRoundedRect(pbx, pby, 56, 26, 5);
    contentCtr.add(pbg);
    contentCtr.add(scene.add.text(pbx + 28, pby + 13, '미리보기', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#9966cc',
    }).setOrigin(0.5).setDepth(7));
    const pz = scene.add.zone(pbx + 28, pby + 13, 56, 26).setInteractive().setDepth(8);
    contentCtr.add(pz);
    pz.on('pointerdown', () => showPreviewModal(ctx, skin));

  } else {
    contentCtr.add(scene.add.text(x + 68, y + 65, `💎 ${skin.gemCost} 젬`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
    }).setDepth(6));

    const btnW2 = 68, btnH2 = 26;
    const bx = x + w - btnW2 - 8, by = y + h - btnH2 - 10;

    const pbx = bx - 64, pby = by;
    const pbg = scene.add.graphics();
    pbg.fillStyle(0x111133, 1);
    pbg.fillRoundedRect(pbx, pby, 56, 26, 5);
    pbg.lineStyle(1, 0x6644aa, 0.6);
    pbg.strokeRoundedRect(pbx, pby, 56, 26, 5);
    contentCtr.add(pbg);
    contentCtr.add(scene.add.text(pbx + 28, pby + 13, '미리보기', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#9966cc',
    }).setOrigin(0.5).setDepth(7));
    const pz = scene.add.zone(pbx + 28, pby + 13, 56, 26).setInteractive().setDepth(8);
    contentCtr.add(pz);
    pz.on('pointerdown', () => showPreviewModal(ctx, skin));

    const bbg = scene.add.graphics();
    bbg.fillStyle(0x220044, 1);
    bbg.fillRoundedRect(bx, by, btnW2, btnH2, 5);
    bbg.lineStyle(1, 0xaa44ff, 0.8);
    bbg.strokeRoundedRect(bx, by, btnW2, btnH2, 5);
    contentCtr.add(bbg);
    contentCtr.add(scene.add.text(bx + btnW2 / 2, by + btnH2 / 2, `💎 ${skin.gemCost} 구매`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(7));

    const zone = scene.add.zone(bx + btnW2 / 2, by + btnH2 / 2, btnW2, btnH2)
      .setInteractive().setDepth(8);
    contentCtr.add(zone);
    zone.on('pointerdown', () => {
      const state = loadGameState();
      if ((state.gems ?? 0) < skin.gemCost) {
        ctx.showToast('젬 부족!');
        return;
      }
      state.gems -= skin.gemCost;
      if (!state.ownedSkins) state.ownedSkins = {};
      if (!state.ownedSkins[skin.monsterId]) state.ownedSkins[skin.monsterId] = [];
      if (!state.ownedSkins[skin.monsterId].includes(skin.id)) {
        state.ownedSkins[skin.monsterId].push(skin.id);
      }
      saveGameState(state);
      gemsText.setText(`💎 ${state.gems} 젬`);
      ctx.showPurchaseFlash(skin.gemCost, '💎', '#88aaff');
      ctx.showToast(`${skin.name} 구입 완료!`);
      ctx.refreshContent();
    });
  }
}

export function showPreviewModal(
  ctx: ShopSkinTabContext,
  skin: MonsterSkin,
): Phaser.GameObjects.Container {
  const { scene, gemsText } = ctx;
  const ov = scene.add.container(0, 0).setDepth(200);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.9);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const pw = 340, ph = 360;
  const px = (CANVAS_WIDTH - pw) / 2;
  const py = (CANVAS_HEIGHT - ph) / 2;

  const panel = scene.add.graphics();
  panel.fillStyle(0x0d0d2a, 1);
  panel.fillRoundedRect(px, py, pw, ph, 14);
  panel.lineStyle(2, 0x8844ff, 0.9);
  panel.strokeRoundedRect(px, py, pw, ph, 14);
  ov.add(panel);

  ov.add(scene.add.text(px + pw / 2, py + 16, '🎨 스킨 미리보기', {
    fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
    color: '#dd88ff',
  }).setOrigin(0.5));

  const halfW = pw / 2 - 20;
  const defaultBg = scene.add.graphics();
  defaultBg.fillStyle(0x1a1a1a, 1);
  defaultBg.fillRoundedRect(px + 10, py + 36, halfW, 180, 8);
  defaultBg.lineStyle(1, 0x333333, 0.6);
  defaultBg.strokeRoundedRect(px + 10, py + 36, halfW, 180, 8);
  ov.add(defaultBg);

  const mDef = MONSTER_DEFS[skin.monsterId];
  ov.add(scene.add.text(px + 10 + halfW / 2, py + 36 + 90 - 16, mDef?.emoji ?? '?', {
    fontFamily: 'sans-serif', fontSize: '56px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(px + 10 + halfW / 2, py + 36 + 150, '기본', {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  const skinBg = scene.add.graphics();
  skinBg.fillStyle(0x080820, 1);
  skinBg.fillRoundedRect(px + pw / 2 + 10, py + 36, halfW, 180, 8);
  skinBg.lineStyle(1.5, skin.particleColor, 0.8);
  skinBg.strokeRoundedRect(px + pw / 2 + 10, py + 36, halfW, 180, 8);
  ov.add(skinBg);

  ov.add(scene.add.text(px + pw / 2 + 10 + halfW / 2, py + 36 + 90 - 16, skin.emoji, {
    fontFamily: 'sans-serif', fontSize: '56px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(px + pw / 2 + 10 + halfW / 2, py + 36 + 150, skin.name, {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: '#dd88ff',
  }).setOrigin(0.5));

  const pcG = scene.add.graphics();
  pcG.fillStyle(skin.particleColor, 0.9);
  for (let i = 0; i < 5; i++) {
    const px2 = px + pw / 2 + 10 + 10 + i * 18;
    const py2 = py + 36 + 160;
    pcG.fillCircle(px2, py2, 5 - i * 0.5);
  }
  ov.add(pcG);
  ov.add(scene.add.text(px + pw / 2 + 10 + 8, py + 36 + 173, '파티클', {
    fontFamily: 'sans-serif', fontSize: '8px', color: '#888888',
  }));

  ov.add(scene.add.text(px + pw / 2, py + 230, skin.name, {
    fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
    color: '#ffffff',
  }).setOrigin(0.5));

  const rarityLabel = { normal: '일반', rare: '레어', limited: '한정' };
  ov.add(scene.add.text(px + pw / 2, py + 250, `${rarityLabel[skin.rarity]} | 💎 ${skin.gemCost} 젬`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaacc',
  }).setOrigin(0.5));

  const gs = loadGameState();
  const isOwned = (gs.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id);

  const closeBg = scene.add.graphics();
  closeBg.fillStyle(0x222222, 1);
  closeBg.fillRoundedRect(px + 16, py + ph - 52, 100, 36, 6);
  ov.add(closeBg);
  ov.add(scene.add.text(px + 16 + 50, py + ph - 34, '닫기', {
    fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));
  const closeZ = scene.add.zone(px + 16 + 50, py + ph - 34, 100, 36).setInteractive();
  ov.add(closeZ);
  closeZ.on('pointerdown', () => { ov.destroy(); });

  const actW = 180;
  const actBg = scene.add.graphics();
  actBg.fillStyle(isOwned ? 0x004422 : 0x220044, 1);
  actBg.fillRoundedRect(px + pw - actW - 16, py + ph - 52, actW, 36, 6);
  actBg.lineStyle(1.5, isOwned ? 0x44aa66 : 0xaa44ff, 0.9);
  actBg.strokeRoundedRect(px + pw - actW - 16, py + ph - 52, actW, 36, 6);
  ov.add(actBg);
  const actLabel = isOwned ? '장착하기' : `💎 ${skin.gemCost} 구매`;
  ov.add(scene.add.text(px + pw - 16 - actW / 2, py + ph - 34, actLabel, {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: isOwned ? '#44ffaa' : '#cc88ff',
  }).setOrigin(0.5));
  const actZ = scene.add.zone(px + pw - 16 - actW / 2, py + ph - 34, actW, 36).setInteractive();
  ov.add(actZ);
  actZ.on('pointerdown', () => {
    const state = loadGameState();
    if (isOwned) {
      if (!state.equippedSkins) state.equippedSkins = {};
      state.equippedSkins[skin.monsterId] = skin.id;
      saveGameState(state);
      ov.destroy();
      ctx.refreshContent();
      ctx.showToast(`${skin.name} 장착!`);
    } else {
      if ((state.gems ?? 0) < skin.gemCost) { ctx.showToast('젬 부족!'); return; }
      state.gems -= skin.gemCost;
      if (!state.ownedSkins) state.ownedSkins = {};
      if (!state.ownedSkins[skin.monsterId]) state.ownedSkins[skin.monsterId] = [];
      if (!state.ownedSkins[skin.monsterId].includes(skin.id)) {
        state.ownedSkins[skin.monsterId].push(skin.id);
      }
      state.equippedSkins = state.equippedSkins ?? {};
      state.equippedSkins[skin.monsterId] = skin.id;
      saveGameState(state);
      gemsText.setText(`💎 ${state.gems} 젬`);
      ctx.showPurchaseFlash(skin.gemCost, '💎', '#88aaff');
      ov.destroy();
      ctx.refreshContent();
      ctx.showToast(`${skin.name} 구입 및 장착!`);
    }
  });

  return ov;
}
