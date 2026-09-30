import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { MONSTER_DEFS, SKIN_DATA, type MonsterSkin } from '../data/monsters';
import {
  equipSkin,
  purchaseSkin,
  unequipSkin,
  type ShopTransactionResult,
} from '../data/shopTransactions';
import { addMonsterPortrait } from './MonsterPortraitView';
import {
  addShopButton,
  addShopPager,
  addShopPanel,
  addShopSectionHeading,
  paginate,
  type ShopPurchaseOutcome,
  type ShopViewContext,
} from './ShopShared';

export type SkinFilter = 'all' | 'normal' | 'rare' | 'limited';

const RARITY: Record<MonsterSkin['rarity'], { label: string; color: number; css: string }> = {
  normal: { label: '일반', color: DUNGEON_UI.EDGE, css: DUNGEON_UI_CSS.MUTED },
  rare: { label: '희귀', color: 0x718dc5, css: '#aab9ff' },
  limited: { label: '한정', color: DUNGEON_UI.BRASS_BRIGHT, css: DUNGEON_UI_CSS.BRASS },
};

export interface ShopSkinTabContext extends ShopViewContext {
  readonly skinFilter: SkinFilter;
  readonly skinPage: number;
  readonly setSkinView: (filter: SkinFilter, page: number) => void;
  readonly openSkinPreview: (skin: MonsterSkin) => void;
}

export function buildSkinTab(ctx: ShopSkinTabContext): void {
  const state = loadGameState();
  const catalog = SKIN_DATA.filter(skin => ctx.skinFilter === 'all' || skin.rarity === ctx.skinFilter);
  const page = paginate(catalog, ctx.skinPage, 4);
  const ownedCount = catalog.filter(skin => (state.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id)).length;
  const questCount = catalog.filter(skin => skin.unlockVia === 'quest').length;

  addShopSectionHeading(
    ctx.scene,
    ctx.contentCtr,
    '외형 보급고',
    `${catalog.length}종 · 보유 ${ownedCount} · 퀘스트 해금 ${questCount}`,
  );
  drawFilters(ctx);

  page.items.forEach((skin, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawSkinCard(ctx, skin, 8 + col * 191, 248 + row * 232, 183, 224, state);
  });

  if (page.items.length === 0) {
    addShopPanel(ctx.scene, ctx.contentCtr, {
      x: 24, y: 292, w: 342, h: 180, accent: DUNGEON_UI.EDGE,
    });
    ctx.contentCtr.add(ctx.scene.add.text(195, 366, '해당 등급의 외형이 없습니다.', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5));
  }

  addShopPager(ctx.scene, ctx.contentCtr, {
    page: page.page,
    pageCount: page.pageCount,
    onPage: nextPage => {
      if (!ctx.isBusy()) ctx.setSkinView(ctx.skinFilter, nextPage);
    },
  });
}

function drawFilters(ctx: ShopSkinTabContext): void {
  const filters: Array<{ id: SkinFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'normal', label: '일반' },
    { id: 'rare', label: '희귀' },
    { id: 'limited', label: '한정' },
  ];
  filters.forEach((filter, index) => {
    const active = filter.id === ctx.skinFilter;
    addShopButton(ctx.scene, ctx.contentCtr, {
      x: 8 + index * 95,
      y: 194,
      w: 89,
      h: 44,
      label: active ? `● ${filter.label}` : filter.label,
      accent: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON,
      onPress: () => {
        if (!ctx.isBusy() && !active) ctx.setSkinView(filter.id, 0);
      },
    });
  });
}

function drawSkinCard(
  ctx: ShopSkinTabContext,
  skin: MonsterSkin,
  x: number,
  y: number,
  w: number,
  h: number,
  state: ReturnType<typeof loadGameState>,
): void {
  const owned = (state.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id);
  const equipped = state.equippedSkins?.[skin.monsterId] === skin.id;
  const questOnly = skin.unlockVia === 'quest';
  const rarity = RARITY[skin.rarity];
  const accent = equipped ? DUNGEON_UI.JADE : rarity.color;
  const monsterName = MONSTER_DEFS[skin.monsterId]?.name ?? skin.monsterId;

  addShopPanel(ctx.scene, ctx.contentCtr, { x, y, w, h, accent });
  const cx = x + w / 2;
  addMonsterPortrait(ctx.scene, ctx.contentCtr, cx, y + 58, skin.monsterId, {
    size: 96,
    frameColor: accent,
    glowColor: skin.particleColor,
    bgColor: DUNGEON_UI.VOID,
    equippedSkins: { [skin.monsterId]: skin.id },
  });
  ctx.contentCtr.add(ctx.scene.add.text(x + 9, y + 8, rarity.label, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: rarity.css,
  }));
  if (owned) drawOwnedBadge(ctx, cx, y + 106, equipped);

  ctx.contentCtr.add(ctx.scene.add.text(cx, y + 124, skin.name, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  ctx.contentCtr.add(ctx.scene.add.text(cx, y + 142, monsterName, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  if (questOnly && !owned) {
    const questTitle = skin.unlockRef ? (getQuest(skin.unlockRef)?.title ?? skin.unlockRef) : '퀘스트';
    ctx.contentCtr.add(ctx.scene.add.text(cx, y + 158, `🔒 ${clip(questTitle, 13)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
  }

  addShopButton(ctx.scene, ctx.contentCtr, {
    x: x + 8,
    y: y + h - 52,
    w: 70,
    h: 44,
    label: '미리보기',
    accent: DUNGEON_UI.EDGE,
    onPress: () => {
      if (!ctx.isBusy()) ctx.openSkinPreview(skin);
    },
  });

  const canAct = owned || !questOnly;
  const actionLabel = owned ? (equipped ? '해제' : '장착') : questOnly ? '퀘스트 보상' : `보석 ${skin.gemCost}`;
  addShopButton(ctx.scene, ctx.contentCtr, {
    x: x + 86,
    y: y + h - 52,
    w: w - 94,
    h: 44,
    label: actionLabel,
    enabled: canAct,
    accent: equipped ? DUNGEON_UI.EMBER : owned ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS_BRIGHT,
    onPress: () => {
      if (ctx.isBusy()) return;
      if (owned) {
        ctx.runImmediate({
          execute: () => skinOutcome(
            equipped
              ? unequipSkin(loadGameState(), skin.monsterId)
              : equipSkin(loadGameState(), skin.monsterId, skin.id),
            equipped ? `${skin.name} 해제` : `${skin.name} 장착`,
            equipped ? `${monsterName}이 기본 외형으로 돌아갔습니다.` : `${monsterName}의 외형을 변경했습니다.`,
          ),
        });
        return;
      }
      ctx.requestPurchase({
        itemName: skin.name,
        description: `${monsterName}의 외형을 보유 목록에 추가합니다. 장착은 구매 후 선택할 수 있습니다.`,
        costLabel: `보석 ${skin.gemCost}`,
        execute: () => skinOutcome(
          purchaseSkin(loadGameState(), skin.monsterId, skin.id, skin.gemCost),
          `${skin.name} 지급 완료`,
          '외형 보급고의 보유 목록에 추가했습니다.',
        ),
      });
    },
  });
}

/** 보유·장착 표시 — 초상 아래 가장자리에 걸친 알약. */
function drawOwnedBadge(ctx: ShopSkinTabContext, cx: number, y: number, equipped: boolean): void {
  const label = equipped ? '장착 중' : '보유';
  const color = equipped ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE;
  const w = equipped ? 52 : 36;
  const pill = ctx.scene.add.graphics();
  pill.fillStyle(DUNGEON_UI.VOID, 0.96);
  pill.fillRoundedRect(cx - w / 2, y - 8, w, 16, 8);
  pill.lineStyle(1, color, 0.9);
  pill.strokeRoundedRect(cx - w / 2, y - 8, w, 16, 8);
  ctx.contentCtr.add(pill);
  ctx.contentCtr.add(ctx.scene.add.text(cx, y, label, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: equipped ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0.5));
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function skinOutcome(
  result: ShopTransactionResult,
  successTitle: string,
  successDetail: string,
): ShopPurchaseOutcome {
  if (!result.ok) {
    return {
      ok: false,
      title: '외형 거래 불가',
      detail: result.reason === 'insufficient_gems'
        ? '보석 잔액이 부족합니다. 자원은 변경되지 않았습니다.'
        : '보유 조건을 충족하지 못했습니다. 상태는 변경되지 않았습니다.',
    };
  }
  if (result.changed) saveGameState(result.state);
  return {
    ok: true,
    title: result.changed ? successTitle : '이미 반영된 외형',
    detail: result.changed ? successDetail : '추가 자원은 사용되지 않았습니다.',
  };
}
