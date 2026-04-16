import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
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
  if (!gs.ownedThemes) gs.ownedThemes = ['cave'];

  contentCtr.add(scene.add.text(CANVAS_WIDTH / 2, 108, '🏰 던전 테마', {
    fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
    color: '#ffcc88',
  }).setOrigin(0.5).setDepth(6));
  contentCtr.add(scene.add.text(CANVAS_WIDTH / 2, 128, '던전 전체 외관을 변경합니다', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#666688',
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

  contentCtr.add(addPanelShadow(scene, x, y, w, h, 10, { offsetY: 3, opacity: 0.5 }));

  const g = scene.add.graphics();
  g.fillStyle(theme.bgSecondary, 1);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(2, equipped ? theme.panelBorder : (owned ? 0x446644 : 0x334), equipped ? 1 : 0.7);
  g.strokeRoundedRect(x, y, w, h, 10);
  contentCtr.add(g);

  contentCtr.add(addInnerGlow(scene, x, y, w, h, 10, equipped ? theme.panelBorder : 0xaaccff, 0.14));

  if (equipped) {
    const bdg = scene.add.graphics();
    bdg.fillStyle(0x003300, 1);
    bdg.fillRoundedRect(x + w - 64, y + 6, 58, 18, 4);
    contentCtr.add(bdg);
    contentCtr.add(scene.add.text(x + w - 35, y + 15, '✓ 장착 중', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#44ff88',
    }).setOrigin(0.5).setDepth(7));
  }

  const RARITY_CONFIG: Record<string, { bg: number; label: string; color: string } | undefined> = {
    rare:      { bg: 0x002244, label: '레어',   color: '#88aaff' },
    epic:      { bg: 0x220044, label: '에픽',   color: '#cc88ff' },
    legendary: { bg: 0x221100, label: '전설',   color: '#ffd700' },
  };
  const rarityConfig = RARITY_CONFIG[rarity];
  if (rarityConfig) {
    const rdg = scene.add.graphics();
    rdg.fillStyle(rarityConfig.bg, 1);
    rdg.fillRoundedRect(x + 6, y + 6, 38, 18, 4);
    contentCtr.add(rdg);
    contentCtr.add(scene.add.text(x + 25, y + 15, rarityConfig.label, {
      fontFamily: 'sans-serif', fontSize: '9px', color: rarityConfig.color,
    }).setOrigin(0.5).setDepth(7));
  }

  contentCtr.add(scene.add.text(x + 36, y + h / 2 - 4, emoji, {
    fontFamily: 'sans-serif', fontSize: '36px',
  }).setOrigin(0.5).setDepth(6));

  contentCtr.add(scene.add.text(x + 64, y + 16, theme.name, {
    fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold',
    color: theme.textPrimary,
  }).setDepth(6));

  const swatchColors = [theme.bgPrimary, theme.panelBorder, theme.ambientColor, theme.slotBorder];
  swatchColors.forEach((col, si) => {
    const sg = scene.add.graphics();
    sg.fillStyle(col, 1);
    sg.fillRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 4);
    sg.lineStyle(1, 0x333333, 0.5);
    sg.strokeRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 4);
    contentCtr.add(sg);
  });

  contentCtr.add(scene.add.text(x + 64, y + 68, theme.textAccent + ' 색상 테마', {
    fontFamily: 'sans-serif', fontSize: '10px', color: theme.textSecondary,
  }).setDepth(6));

  if (owned) {
    contentCtr.add(scene.add.text(x + 64, y + 86, rarity === 'default' ? '기본 테마' : '✅ 보유 중', {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: rarity === 'default' ? theme.textSecondary : '#66cc66',
    }).setDepth(6));
  } else {
    contentCtr.add(scene.add.text(x + 64, y + 86, `💎 ${gemCost} 젬`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
    }).setDepth(6));
  }

  const btnW = 80, btnH = 30;
  const bx = x + w - btnW - 10;
  const by = y + h - btnH - 10;

  const canEquip  = owned && !equipped;
  const canBuy    = !owned;
  const isDefault = rarity === 'default' && equipped;

  if (isDefault) return;

  const btnBg = scene.add.graphics();
  if (equipped) {
    btnBg.fillStyle(0x442200, 1);
    btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
    btnBg.lineStyle(1.5, 0xcc6600, 0.8);
    btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
  } else if (canEquip) {
    btnBg.fillStyle(theme.bgSecondary, 1);
    btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
    btnBg.lineStyle(1.5, theme.panelBorder, 0.9);
    btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
  } else if (canBuy) {
    btnBg.fillStyle(0x220044, 1);
    btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
    btnBg.lineStyle(1.5, 0xaa44ff, 0.8);
    btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
  }
  contentCtr.add(btnBg);

  const btnLabel = equipped ? '해제' : canEquip ? '장착' : `💎 ${gemCost}`;
  contentCtr.add(scene.add.text(bx + btnW / 2, by + btnH / 2, btnLabel, {
    fontFamily: 'sans-serif', fontSize: '11px',
    color: equipped ? '#ffaa44' : canEquip ? theme.textAccent : '#cc88ff',
  }).setOrigin(0.5).setDepth(7));

  const zone = scene.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH)
    .setInteractive().setDepth(8);
  contentCtr.add(zone);

  zone.on('pointerdown', () => {
    const state = loadGameState();
    if (!state.ownedThemes) state.ownedThemes = ['cave'];

    if (equipped && rarity !== 'default') {
      state.equippedTheme = 'cave';
      saveGameState(state);
      ctx.showToast('기본 동굴 테마로 변경');
      ctx.refreshContent();
    } else if (canEquip) {
      state.equippedTheme = theme.id;
      saveGameState(state);
      ctx.showToast(`${theme.name} 테마 장착!`);
      ctx.refreshContent();
    } else if (canBuy) {
      if ((state.gems ?? 0) < gemCost) { ctx.showToast('젬 부족!'); return; }
      state.gems -= gemCost;
      if (!state.ownedThemes.includes(theme.id)) state.ownedThemes.push(theme.id);
      state.equippedTheme = theme.id;
      saveGameState(state);
      gemsText.setText(`💎 ${state.gems} 젬`);
      ctx.showPurchaseFlash(gemCost, '💎', '#88aaff');
      ctx.showToast(`${theme.name} 테마 구입 및 장착!`);
      ctx.refreshContent();
    }
  });
}
