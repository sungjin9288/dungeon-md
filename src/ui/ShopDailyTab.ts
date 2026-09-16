import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import {
  purchaseDailyEquipment,
  purchaseDailySkill,
  type ShopTransactionResult,
} from '../data/shopTransactions';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS, type ActiveSkill, type Equipment } from '../data/barracks';
import {
  addShopButton,
  addShopPanel,
  addShopSectionHeading,
  type ShopPurchaseOutcome,
  type ShopViewContext,
} from './ShopShared';

export function getDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getDailyItems(): { skills: ActiveSkill[]; equipment: Equipment[] } {
  const day = getDayIndex();
  return {
    skills: seededShuffle(ACTIVE_SKILLS, day).slice(0, 3),
    equipment: seededShuffle(EQUIPMENT_DEFS, day + 7).slice(0, 3),
  };
}

export function isCurrentDailyOffer(kind: 'equipment' | 'skill', itemId: string): boolean {
  const daily = getDailyItems();
  const catalog = kind === 'equipment' ? daily.equipment : daily.skills;
  return catalog.some(item => item.id === itemId);
}

export interface ShopDailyTabContext extends ShopViewContext {}

export function buildEquipmentTab(ctx: ShopDailyTabContext): void {
  const state = loadGameState();
  const { equipment } = getDailyItems();
  const ownedCount = equipment.filter(item => state.ownedEquipment.includes(item.id)).length;
  addShopSectionHeading(
    ctx.scene,
    ctx.contentCtr,
    '일일 장비 보급',
    `오늘의 보급품 3종 · 보유 ${ownedCount} · 영혼 수정 결제`,
  );
  equipment.forEach((item, index) => {
    drawDailyCard(ctx, item, index, state.ownedEquipment.includes(item.id), 'equipment');
  });
  drawRestockNote(ctx);
}

export function buildSkillTab(ctx: ShopDailyTabContext): void {
  const state = loadGameState();
  const { skills } = getDailyItems();
  const ownedCount = skills.filter(item => state.ownedActiveSkills.includes(item.id)).length;
  addShopSectionHeading(
    ctx.scene,
    ctx.contentCtr,
    '일일 전술 교본',
    `오늘의 교본 3종 · 보유 ${ownedCount} · 영혼 수정 결제`,
  );
  skills.forEach((item, index) => {
    drawDailyCard(ctx, item, index, state.ownedActiveSkills.includes(item.id), 'skill');
  });
  drawRestockNote(ctx);
}

function drawRestockNote(ctx: ShopDailyTabContext): void {
  ctx.contentCtr.add(ctx.scene.add.text(195, 735, '상단 재입고 시각에 UTC 기준 목록이 교체됩니다.', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
}

function drawDailyCard(
  ctx: ShopDailyTabContext,
  item: ActiveSkill | Equipment,
  index: number,
  owned: boolean,
  kind: 'equipment' | 'skill',
): void {
  const x = 12;
  const y = 204 + index * 168;
  const w = 366;
  const h = 160;
  const accent = owned ? DUNGEON_UI.JADE : kind === 'equipment' ? DUNGEON_UI.BRASS : 0x718dc5;
  addShopPanel(ctx.scene, ctx.contentCtr, { x, y, w, h, accent });

  const iconPlate = ctx.scene.add.graphics();
  iconPlate.fillStyle(DUNGEON_UI.VOID, 0.92);
  iconPlate.fillRoundedRect(x + 16, y + 20, 66, 66, 10);
  iconPlate.lineStyle(1.5, accent, 0.82);
  iconPlate.strokeRoundedRect(x + 16, y + 20, 66, 66, 10);
  ctx.contentCtr.add(iconPlate);
  ctx.contentCtr.add(ctx.scene.add.text(x + 49, y + 53, item.icon, {
    fontFamily: 'sans-serif', fontSize: '31px',
  }).setOrigin(0.5));

  ctx.contentCtr.add(ctx.scene.add.text(x + 96, y + 20, item.name, {
    fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  const classification = kind === 'equipment'
    ? { weapon: '무기', armor: '방어구', accessory: '장신구' }[(item as Equipment).type]
    : `${{ combat: '공격', defense: '방어', support: '지원' }[(item as ActiveSkill).category]} · 재사용 ${(item as ActiveSkill).cooldown}s`;
  ctx.contentCtr.add(ctx.scene.add.text(x + 96, y + 48, classification, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }));
  ctx.contentCtr.add(ctx.scene.add.text(x + 96, y + 72, item.desc, {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
    wordWrap: { width: w - 116 },
  }));

  ctx.contentCtr.add(ctx.scene.add.text(x + 18, y + 118, owned ? '보급 완료' : `영혼 수정 ${item.gemCost}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
    color: owned ? DUNGEON_UI_CSS.JADE : '#aab9ff',
  }));
  addShopButton(ctx.scene, ctx.contentCtr, {
    x: x + w - 126,
    y: y + h - 52,
    w: 114,
    h: 44,
    label: owned ? '보유 중' : '구매 확인',
    enabled: !owned,
    accent,
    onPress: () => {
      if (ctx.isBusy()) return;
      ctx.requestPurchase({
        itemName: item.name,
        description: kind === 'equipment'
          ? `${item.desc} 효과의 장비를 보유 목록에 추가합니다.`
          : `${item.desc} 효과의 전술 교본을 보유 목록에 추가합니다.`,
        costLabel: `영혼 수정 ${item.gemCost}`,
        execute: () => {
          if (!isCurrentDailyOffer(kind, item.id)) {
            return {
              ok: false,
              title: '재입고 완료',
              detail: '확인 중 오늘의 목록이 교체되었습니다. 새 선반에서 다시 선택해 주세요.',
            };
          }
          const state = loadGameState();
          const result = kind === 'equipment'
            ? purchaseDailyEquipment(state, item.id, item.gemCost)
            : purchaseDailySkill(state, item.id, item.gemCost);
          return dailyOutcome(result, item.name, kind);
        },
      });
    },
  });
}

function dailyOutcome(
  result: ShopTransactionResult,
  itemName: string,
  kind: 'equipment' | 'skill',
): ShopPurchaseOutcome {
  if (!result.ok) {
    return {
      ok: false,
      title: '보급 조건 미충족',
      detail: '영혼 수정 잔액이 부족합니다. 자원과 보유 목록은 변경되지 않았습니다.',
    };
  }
  if (result.changed) saveGameState(result.state);
  return {
    ok: true,
    title: result.changed ? `${itemName} 지급 완료` : '이미 보유한 보급품',
    detail: result.changed
      ? kind === 'equipment' ? '장비 보유 목록에 추가했습니다.' : '액티브 스킬 보유 목록에 추가했습니다.'
      : '추가 영혼 수정은 사용되지 않았습니다.',
  };
}
