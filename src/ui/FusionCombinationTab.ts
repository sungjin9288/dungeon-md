import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  COMBINATION_TABLE,
  RARITY_STARS,
  combinationKey,
  getBaseId,
  getMonsterDisplayName,
  resolveFusionMonsterDef,
} from '../data/fusion';
import { FUSION_COMBINATION_COST, applyFusionCombination } from '../data/fusionTransactions';
import { logger } from '../utils/logger';
import { addMonsterPortrait } from './MonsterPortraitView';
import { addPrimaryActionButton } from './GameUiPrimitives';
import { reconcileCombinationSlots } from './FusionSelectionState';
import {
  type FusionTabContext,
  TAB_ACCENT,
  bindFusionTransactionAction,
  drawMonsterSlot,
  openMonsterPicker,
  showConfirmDialog,
  showFusionAnimation,
  showFusionResultPanel,
} from './FusionTabs';

export interface CombinationState {
  readonly combineSlots: readonly (OwnedMonster | null)[];
  readonly setCombineSlots: (slots: (OwnedMonster | null)[]) => void;
}

export function buildCombinationTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  state: CombinationState,
): void {
  const gameState = loadGameState();
  const combineSlots = reconcileCombinationSlots(state.combineSlots, gameState.ownedMonsters ?? []);
  if (combineSlots.some((slot, index) => slot !== (state.combineSlots[index] ?? null))) {
    state.setCombineSlots(combineSlots);
  }
  const panelX = 18;
  const panelY = ctx.contentY + 154;
  const panelW = CANVAS_WIDTH - 36;
  const panelH = CANVAS_HEIGHT - panelY - 18;
  const panel = ctx.scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.STONE, 0.96);
  panel.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
  panel.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
  c.add(panel);

  c.add(ctx.scene.add.text(panelX + 16, panelY + 20, '이중 공명진', {
    fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + panelW - 16, panelY + 20, '원본 수호자는 유지', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const slotY = panelY + 42;
  const slotW = 126;
  const slotH = 126;
  const leftX = panelX + 18;
  const rightX = panelX + panelW - 18 - slotW;
  drawMonsterSlot(ctx, c, leftX, slotY, slotW, slotH, combineSlots[0], '조합', () => {
    const second = combineSlots[1];
    openMonsterPicker(
      ctx,
      second ? monster => getBaseId(monster.id) !== getBaseId(second.id) : undefined,
      monster => {
        state.setCombineSlots([monster, combineSlots[1]]);
        ctx.refreshTab();
      },
    );
  }, '공명원 A');
  drawMonsterSlot(ctx, c, rightX, slotY, slotW, slotH, combineSlots[1], '조합', () => {
    const first = combineSlots[0];
    openMonsterPicker(
      ctx,
      first ? monster => getBaseId(monster.id) !== getBaseId(first.id) : undefined,
      monster => {
        state.setCombineSlots([combineSlots[0], monster]);
        ctx.refreshTab();
      },
    );
  }, '공명원 B');

  const bridge = ctx.scene.add.graphics();
  bridge.lineStyle(2, TAB_ACCENT['조합'], 0.7);
  bridge.lineBetween(leftX + slotW + 7, slotY + slotH / 2, rightX - 7, slotY + slotH / 2);
  bridge.strokeCircle(CANVAS_WIDTH / 2, slotY + slotH / 2, 12);
  c.add(bridge);

  const balanceOk = (gameState.soulCrystals ?? 0) >= FUSION_COMBINATION_COST;
  const resourceY = slotY + slotH + 18;
  c.add(ctx.scene.add.text(panelX + 18, resourceY, '영혼 결정', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + panelW - 18, resourceY,
    `${gameState.soulCrystals ?? 0} 보유 · ${FUSION_COMBINATION_COST} 소모`, {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: balanceOk ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

  const bothFilled = Boolean(combineSlots[0] && combineSlots[1]);
  const key = bothFilled
    ? combinationKey(combineSlots[0]!.id, combineSlots[1]!.id)
    : '';
  const hybridId = key ? COMBINATION_TABLE[key] : undefined;
  const hybrid = hybridId ? resolveFusionMonsterDef(hybridId) : undefined;
  const resultX = panelX + 16;
  const resultY = resourceY + 20;
  const resultW = panelW - 32;
  const resultH = 112;
  const resultBg = ctx.scene.add.graphics();
  resultBg.fillStyle(DUNGEON_UI.SOOT, 0.96);
  resultBg.fillRoundedRect(resultX, resultY, resultW, resultH, 8);
  resultBg.lineStyle(1.5, hybrid ? TAB_ACCENT['조합'] : DUNGEON_UI.IRON, hybrid ? 0.82 : 0.72);
  resultBg.strokeRoundedRect(resultX, resultY, resultW, resultH, 8);
  c.add(resultBg);

  if (hybrid) {
    addMonsterPortrait(ctx.scene, c, resultX + 58, resultY + 56, hybridId!, {
      size: 76, frameColor: TAB_ACCENT['조합'], glowColor: TAB_ACCENT['조합'],
      bgColor: DUNGEON_UI.VOID, equippedSkins: gameState.equippedSkins,
    });
    c.add(ctx.scene.add.text(resultX + 112, resultY + 23, '공명 결과 확인됨', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 49, hybrid.name, {
      fontFamily: 'sans-serif', fontSize: '17px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 76, RARITY_STARS[hybrid.rarity], {
      fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 96, '새 혼종 1체가 군단에 합류', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));
  } else if (bothFilled) {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 37, '미지의 공명', {
      fontFamily: 'sans-serif', fontSize: '17px', color: DUNGEON_UI_CSS.EMBER, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 69,
      `결과 없음 가능 · 실패해도 영혼 결정 ${FUSION_COMBINATION_COST} 소모`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 91, '원본 수호자는 소모되지 않습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(0.5));
  } else {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 45, '두 공명원을 지정하세요', {
      fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 75, '서로 다른 계보만 결속할 수 있습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#727c72',
    }).setOrigin(0.5));
  }

  const canExecute = bothFilled && balanceOk;
  const warningY = resultY + resultH + 16;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, warningY,
    bothFilled
      ? `실행 시 영혼 결정 ${FUSION_COMBINATION_COST}이 즉시 소모됩니다`
      : '공명원을 선택하면 결과와 risk를 표시합니다', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: bothFilled ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold',
    }).setOrigin(0.5));

  const action = addPrimaryActionButton(ctx.scene, {
    x: panelX + 16, y: warningY + 18, w: panelW - 32, h: 48,
    label: canExecute
      ? hybrid ? '확인된 조합 의식 준비' : '미지의 조합 시도'
      : bothFilled ? `영혼 결정 ${FUSION_COMBINATION_COST} 부족` : '공명원을 먼저 선택하세요',
    fontSize: '15px', enabled: canExecute, once: true, showArrow: false,
    fillColor: hybrid ? TAB_ACCENT['조합'] : DUNGEON_UI.EMBER,
    borderColor: DUNGEON_UI.BRASS_BRIGHT,
    hoverFillColor: hybrid ? TAB_ACCENT['조합'] : DUNGEON_UI.EMBER,
    hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
    disabledTextColor: DUNGEON_UI_CSS.MUTED,
    onPress: () => {},
  });
  bindFusionTransactionAction(ctx, action, () => {
      const [first, second] = combineSlots;
      if (!first || !second) return;
      const names = `${getMonsterDisplayName(first.id)} + ${getMonsterDisplayName(second.id)}`;
      showConfirmDialog(
        ctx,
        hybrid ? `${hybrid.name} 공명을 실행합니다` : '결과가 없는 미지의 공명입니다',
        `${names}\n영혼 결정 ${FUSION_COMBINATION_COST} 소모 · 원본 2체 유지`,
        '조합',
        () => executeCombination(ctx, state, combineSlots),
      );
    });
  c.add([action.bg, action.text, action.zone]);
}

function executeCombination(
  ctx: FusionTabContext,
  state: CombinationState,
  slots: readonly (OwnedMonster | null)[],
): void {
  const [slotA, slotB] = slots;
  if (!slotA || !slotB) {
    ctx.finishTransaction();
    return;
  }
  const result = applyFusionCombination(loadGameState(), slotA, slotB);
  if (!result.ok) {
    logger.warn(`[COMBINATION] rejected: ${result.reason}`);
    showFusionResultPanel(ctx, {
      tabId: '조합', status: 'failure', title: '조합 조건이 바뀌었습니다',
      detail: '영혼 결정 잔액과 선택한 공명원을 다시 확인하세요.',
    });
    return;
  }

  saveGameState(result.state);
  state.setCombineSlots([null, null]);
  if (result.recipeMatched) {
    logger.debug(`[COMBINATION] ${result.isNewDiscovery ? 'NEW ' : ''}${result.hybridId}`);
    showFusionAnimation(ctx, '조합', () => {
      showFusionResultPanel(ctx, {
        tabId: '조합',
        status: result.isNewDiscovery ? 'discovery' : 'success',
        title: `${result.hybrid.name} 조합 성공`,
        detail: `영혼 결정 ${FUSION_COMBINATION_COST} 소모 · 원본 2체 유지${result.isNewDiscovery ? '\n신규 조합이 도감에 기록되었습니다.' : ''}`,
      });
    });
    return;
  }

  logger.debug(`[COMBINATION] FAILED: ${result.recipeKey} — no known recipe`);
  showFusionAnimation(ctx, '조합', () => {
    showFusionResultPanel(ctx, {
      tabId: '조합', status: 'failure', title: '공명 결과 없음',
      detail: `영혼 결정 ${FUSION_COMBINATION_COST} 소모 · 원본 2체 유지\n융합 진척은 증가하지 않았습니다.`,
    });
  });
}
