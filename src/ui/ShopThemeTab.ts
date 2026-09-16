import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import {
  equipTheme,
  purchaseAndEquipTheme,
  unequipTheme,
  type ShopTransactionResult,
} from '../data/shopTransactions';
import { ALL_THEMES, type DungeonTheme } from '../themes/themes';
import {
  addShopButton,
  addShopPager,
  addShopPanel,
  addShopSectionHeading,
  paginate,
  type ShopPurchaseOutcome,
  type ShopViewContext,
} from './ShopShared';

interface ThemeListing {
  readonly theme: DungeonTheme;
  readonly gemCost: number;
  readonly emoji: string;
  readonly rarity: 'default' | 'rare' | 'epic' | 'legendary';
}

export const THEME_LISTINGS: ThemeListing[] = [
  { theme: ALL_THEMES[0], gemCost: 0, emoji: '🪨', rarity: 'default' },
  { theme: ALL_THEMES[1], gemCost: 150, emoji: '❄️', rarity: 'rare' },
  { theme: ALL_THEMES[2], gemCost: 150, emoji: '🌋', rarity: 'rare' },
  { theme: ALL_THEMES[3], gemCost: 300, emoji: '🌑', rarity: 'epic' },
  { theme: ALL_THEMES[4], gemCost: 400, emoji: '✨', rarity: 'legendary' },
];

const RARITY: Record<ThemeListing['rarity'], { label: string; color: number; css: string }> = {
  default: { label: '기본', color: DUNGEON_UI.EDGE, css: DUNGEON_UI_CSS.MUTED },
  rare: { label: '희귀', color: 0x718dc5, css: '#aab9ff' },
  epic: { label: '영웅', color: 0x8a6fb4, css: '#c8aff2' },
  legendary: { label: '전설', color: DUNGEON_UI.BRASS_BRIGHT, css: DUNGEON_UI_CSS.BRASS },
};

export interface ShopThemeTabContext extends ShopViewContext {
  readonly themePage: number;
  readonly setThemePage: (page: number) => void;
}

export function buildThemeTab(ctx: ShopThemeTabContext): void {
  const state = loadGameState();
  const ownedCount = THEME_LISTINGS.filter(listing =>
    listing.rarity === 'default' || (state.ownedThemes ?? []).includes(listing.theme.id),
  ).length;
  const page = paginate(THEME_LISTINGS, ctx.themePage, 3);

  addShopSectionHeading(
    ctx.scene,
    ctx.contentCtr,
    '던전 마감재',
    `${THEME_LISTINGS.length}종 · 보유 ${ownedCount} · 구매 시 즉시 적용`,
  );

  page.items.forEach((listing, index) => {
    drawThemeCard(ctx, listing, 12, 204 + index * 168, 366, 160, state);
  });

  addShopPager(ctx.scene, ctx.contentCtr, {
    page: page.page,
    pageCount: page.pageCount,
    onPage: nextPage => {
      if (!ctx.isBusy()) ctx.setThemePage(nextPage);
    },
  });
}

function drawThemeCard(
  ctx: ShopThemeTabContext,
  listing: ThemeListing,
  x: number,
  y: number,
  w: number,
  h: number,
  state: ReturnType<typeof loadGameState>,
): void {
  const { theme, gemCost, emoji, rarity } = listing;
  const owned = rarity === 'default' || (state.ownedThemes ?? []).includes(theme.id);
  const equipped = (state.equippedTheme ?? 'cave') === theme.id;
  const rarityMeta = RARITY[rarity];
  const accent = equipped ? DUNGEON_UI.JADE : rarityMeta.color;

  addShopPanel(ctx.scene, ctx.contentCtr, { x, y, w, h, accent });
  const iconPlate = ctx.scene.add.graphics();
  iconPlate.fillStyle(DUNGEON_UI.VOID, 0.92);
  iconPlate.fillRoundedRect(x + 14, y + 18, 54, 54, 9);
  iconPlate.lineStyle(1, accent, 0.78);
  iconPlate.strokeRoundedRect(x + 14, y + 18, 54, 54, 9);
  ctx.contentCtr.add(iconPlate);
  ctx.contentCtr.add(ctx.scene.add.text(x + 41, y + 45, emoji, {
    fontFamily: 'sans-serif', fontSize: '27px',
  }).setOrigin(0.5));

  ctx.contentCtr.add(ctx.scene.add.text(x + 80, y + 17, theme.name, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  ctx.contentCtr.add(ctx.scene.add.text(x + 80, y + 42, rarityMeta.label, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: rarityMeta.css,
  }));

  const swatches = [theme.bgPrimary, theme.panelBorder, theme.ambientColor, theme.slotBorder];
  swatches.forEach((color, index) => {
    const swatch = ctx.scene.add.graphics();
    swatch.fillStyle(color, 1);
    swatch.fillRoundedRect(x + 80 + index * 27, y + 58, 21, 18, 4);
    swatch.lineStyle(1, DUNGEON_UI.EDGE, 0.75);
    swatch.strokeRoundedRect(x + 80 + index * 27, y + 58, 21, 18, 4);
    ctx.contentCtr.add(swatch);
  });

  const stateLabel = equipped
    ? '현재 던전에 적용 중'
    : owned
      ? '보유 중 · 적용 가능'
      : `보석 ${gemCost} · 구매 즉시 적용`;
  ctx.contentCtr.add(ctx.scene.add.text(x + 16, y + 92, stateLabel, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: equipped ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT,
  }));
  ctx.contentCtr.add(ctx.scene.add.text(x + 16, y + 116, '배경 · 패널 · 조명 · 슬롯 팔레트', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }));

  const defaultEquipped = rarity === 'default' && equipped;
  const actionLabel = defaultEquipped
    ? '기본 적용 중'
    : equipped
      ? '동굴로 복귀'
      : owned
        ? '테마 적용'
        : `보석 ${gemCost} 구매`;
  addShopButton(ctx.scene, ctx.contentCtr, {
    x: x + w - 150,
    y: y + h - 52,
    w: 138,
    h: 44,
    label: actionLabel,
    enabled: !defaultEquipped,
    accent: equipped ? DUNGEON_UI.EMBER : owned ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS_BRIGHT,
    onPress: () => {
      if (ctx.isBusy()) return;
      if (equipped) {
        ctx.runImmediate({
          execute: () => themeOutcome(
            unequipTheme(loadGameState()),
            '기본 동굴 적용',
            '던전 마감재를 기본 동굴 테마로 되돌렸습니다.',
          ),
        });
      } else if (owned) {
        ctx.runImmediate({
          execute: () => themeOutcome(
            equipTheme(loadGameState(), theme.id),
            `${theme.name} 적용`,
            '보유한 마감재를 던전 전체에 적용했습니다.',
          ),
        });
      } else {
        ctx.requestPurchase({
          itemName: theme.name,
          description: '테마를 구매하고 던전의 배경·패널·조명·슬롯 팔레트에 즉시 적용합니다.',
          costLabel: `보석 ${gemCost}`,
          confirmLabel: '구매·적용 확정',
          execute: () => themeOutcome(
            purchaseAndEquipTheme(loadGameState(), theme.id, gemCost),
            `${theme.name} 지급 완료`,
            '구매한 마감재를 던전 전체에 적용했습니다.',
          ),
        });
      }
    },
  });
}

function themeOutcome(
  result: ShopTransactionResult,
  successTitle: string,
  successDetail: string,
): ShopPurchaseOutcome {
  if (!result.ok) {
    return {
      ok: false,
      title: '테마 거래 불가',
      detail: '보석 잔액이 부족합니다. 자원과 적용 테마는 변경되지 않았습니다.',
    };
  }
  if (result.changed) saveGameState(result.state);
  return {
    ok: true,
    title: result.changed ? successTitle : '이미 적용된 테마',
    detail: result.changed ? successDetail : '추가 자원은 사용되지 않았습니다.',
  };
}
