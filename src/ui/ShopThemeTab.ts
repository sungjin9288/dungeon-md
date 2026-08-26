import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { equipTheme, purchaseAndEquipTheme, unequipTheme } from '../data/shopTransactions';
import { ALL_THEMES, type DungeonTheme } from '../themes/themes';
import { addPanelShadow, addInnerGlow } from './PanelDepth';

// ─── Theme shop metadata ───────────────────────────────────────────────────────

interface ThemeListing {
  theme:   DungeonTheme;
  gemCost: number;
  emoji:   string;
  rarity:  'default' | 'rare' | 'epic' | 'legendary';
}

export const THEME_LISTINGS: ThemeListing[] = [
  { theme: ALL_THEMES[0], gemCost: 0,   emoji: '🪨', rarity: 'default' },
  { theme: ALL_THEMES[1], gemCost: 150, emoji: '❄️', rarity: 'rare'    },
  { theme: ALL_THEMES[2], gemCost: 150, emoji: '🌋', rarity: 'rare'    },
  { theme: ALL_THEMES[3], gemCost: 300, emoji: '🌑', rarity: 'epic'    },
  { theme: ALL_THEMES[4], gemCost: 400, emoji: '✨', rarity: 'legendary' },
];

export interface ShopThemeTabContext {
  readonly scene: Phaser.Scene;
  readonly contentCtr: Phaser.GameObjects.Container;
  readonly gemsText: Phaser.GameObjects.Text;
  readonly showToast: (msg: string) => void;
  readonly showPurchaseFlash: (cost: number, icon: string, color: string) => void;
  readonly refreshContent: () => void;
}

export function buildThemeTab(ctx: ShopThemeTabContext): void {
  const { scene, contentCtr } = ctx;
  const gs = loadGameState();

  contentCtr.add(scene.add.text(CANVAS_WIDTH / 2, 108, '🏰 던전 테마', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0.5).setDepth(6));
  contentCtr.add(scene.add.text(CANVAS_WIDTH / 2, 128, '던전 전체 외관을 변경합니다', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setDepth(6));

  const CARD_H = 148;
  THEME_LISTINGS.forEach((listing, i) => {
    drawThemeCard(ctx, listing, 8, 144 + i * (CARD_H + 8), CANVAS_WIDTH - 16, CARD_H, gs);
  });
}

function drawThemeCard(
  ctx: ShopThemeTabContext,
  listing: ThemeListing,
  x: number, y: number, w: number, h: number,
  gs: ReturnType<typeof loadGameState>,
): void {
  const { scene, contentCtr, gemsText } = ctx;
  const { theme, gemCost, emoji, rarity } = listing;
  const owned    = rarity === 'default' || (gs.ownedThemes ?? []).includes(theme.id);
  const equipped = (gs.equippedTheme ?? 'cave') === theme.id;

  // Rarity → saturated CASUAL accent (kept as the card border hue).
  const RARITY_ACCENT: Record<string, number> = {
    default:   CASUAL.INK_SOFT,
    rare:      CASUAL.BLUE,
    epic:      CASUAL.PURPLE,
    legendary: CASUAL.GOLD,
  };
  const accent = equipped ? CASUAL.GREEN : RARITY_ACCENT[rarity] ?? CASUAL.EDGE;

  contentCtr.add(addPanelShadow(scene, x, y, w, h, 10, { offsetY: 3, opacity: 0.32 }));

  const g = scene.add.graphics();
  g.fillStyle(CASUAL.SHADOW, 0.22);
  g.fillRoundedRect(x, y + 4, w, h, 10);
  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(x, y, w, h, 10);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(x + 5, y + 4, w - 10, 6, 3);
  g.fillStyle(CASUAL.PANEL_SOFT, 0.5);
  g.fillRoundedRect(x + 5, y + h * 0.62, w - 10, h * 0.38 - 5, 6);
  g.lineStyle(3, accent, 1);
  g.strokeRoundedRect(x, y, w, h, 10);
  contentCtr.add(g);

  contentCtr.add(addInnerGlow(scene, x, y, w, h, 10, accent, 0.1));

  if (equipped) {
    const bdg = scene.add.graphics();
    bdg.fillStyle(CASUAL.GREEN_DK, 1);
    bdg.fillRoundedRect(x + w - 64, y + 6 + 2, 58, 18, 7);
    bdg.fillStyle(CASUAL.GREEN, 1);
    bdg.fillRoundedRect(x + w - 64, y + 6, 58, 18, 7);
    contentCtr.add(bdg);
    contentCtr.add(scene.add.text(x + w - 35, y + 15, '✓ 장착 중', {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.WHITE,
    }).setOrigin(0.5).setDepth(7));
  }

  // Rarity tag → saturated accent pill + white bold (readable on cream).
  const RARITY_TAG: Record<string, { cap: number; base: number; label: string } | undefined> = {
    rare:      { cap: CASUAL.BLUE,   base: CASUAL.BLUE_DK,   label: '레어' },
    epic:      { cap: CASUAL.PURPLE, base: CASUAL.PURPLE_DK, label: '에픽' },
    legendary: { cap: CASUAL.GOLD,   base: CASUAL.GOLD_DK,   label: '전설' },
  };
  const rarityTag = RARITY_TAG[rarity];
  if (rarityTag) {
    const rdg = scene.add.graphics();
    rdg.fillStyle(rarityTag.base, 1);
    rdg.fillRoundedRect(x + 6, y + 6 + 2, 38, 18, 7);
    rdg.fillStyle(rarityTag.cap, 1);
    rdg.fillRoundedRect(x + 6, y + 6, 38, 18, 7);
    contentCtr.add(rdg);
    contentCtr.add(scene.add.text(x + 25, y + 15, rarityTag.label, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.WHITE,
    }).setOrigin(0.5).setDepth(7));
  }

  contentCtr.add(scene.add.text(x + 36, y + h / 2 - 4, emoji, {
    fontFamily: 'sans-serif', fontSize: '36px',
  }).setOrigin(0.5).setDepth(6));

  contentCtr.add(scene.add.text(x + 64, y + 16, theme.name, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setDepth(6));

  // Swatches preview the theme's real colors — keep the fills, only soften the border.
  const swatchColors = [theme.bgPrimary, theme.panelBorder, theme.ambientColor, theme.slotBorder];
  swatchColors.forEach((col, si) => {
    const sg = scene.add.graphics();
    sg.fillStyle(col, 1);
    sg.fillRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 5);
    sg.lineStyle(2, CASUAL.EDGE, 0.8);
    sg.strokeRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 5);
    contentCtr.add(sg);
  });

  contentCtr.add(scene.add.text(x + 64, y + 68, '색상 테마', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setDepth(6));

  if (owned) {
    contentCtr.add(scene.add.text(x + 64, y + 86, rarity === 'default' ? '기본 테마' : '✅ 보유 중', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: rarity === 'default' ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.GREEN,
    }).setDepth(6));
  } else {
    contentCtr.add(scene.add.text(x + 64, y + 86, `💎 ${gemCost} 젬`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
    }).setDepth(6));
  }

  const btnW = 80, btnH = 30;
  const bx = x + w - btnW - 10;
  const by = y + h - btnH - 10;

  const canEquip  = owned && !equipped;
  const canBuy    = !owned;
  const isDefault = rarity === 'default' && equipped;

  if (isDefault) return;

  // 해제 → red, 장착 → blue, 구매 → green candy button.
  let btnCap: number = CASUAL.GREEN, btnBase: number = CASUAL.GREEN_DK;
  if (equipped)      { btnCap = CASUAL.RED;  btnBase = CASUAL.RED_DK; }
  else if (canEquip) { btnCap = CASUAL.BLUE; btnBase = CASUAL.BLUE_DK; }

  const btnBg = scene.add.graphics();
  btnBg.fillStyle(btnBase, 1);
  btnBg.fillRoundedRect(bx, by + 4, btnW, btnH, 8);
  btnBg.fillStyle(btnCap, 1);
  btnBg.fillRoundedRect(bx, by, btnW, btnH - 1, 8);
  btnBg.fillStyle(0xffffff, 0.32);
  btnBg.fillRoundedRect(bx + 5, by + 4, btnW - 10, 9, 4);
  contentCtr.add(btnBg);

  const btnLabel = equipped ? '해제' : canEquip ? '장착' : `💎 ${gemCost}`;
  contentCtr.add(scene.add.text(bx + btnW / 2, by + btnH / 2 - 1, btnLabel, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(7));

  const zone = scene.add.zone(bx + btnW / 2, by + btnH / 2, btnW, 44)
    .setInteractive().setDepth(8);
  contentCtr.add(zone);

  zone.on('pointerdown', () => {
    const state = loadGameState();

    if (equipped && rarity !== 'default') {
      const result = unequipTheme(state);
      if (result.ok && result.changed) saveGameState(result.state);
      ctx.showToast('기본 동굴 테마로 변경');
      ctx.refreshContent();
    } else if (canEquip) {
      const result = equipTheme(state, theme.id);
      if (result.ok && result.changed) saveGameState(result.state);
      ctx.showToast(`${theme.name} 테마 장착!`);
      ctx.refreshContent();
    } else if (canBuy) {
      const result = purchaseAndEquipTheme(state, theme.id, gemCost);
      if (!result.ok) { ctx.showToast('젬 부족!'); return; }
      if (result.changed) saveGameState(result.state);
      gemsText.setText(`💎 ${result.state.gems} 젬`);
      ctx.showPurchaseFlash(gemCost, '💎', '#88aaff');
      ctx.showToast(`${theme.name} 테마 구입 및 장착!`);
      ctx.refreshContent();
    }
  });
}
