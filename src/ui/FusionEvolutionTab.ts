import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_STARS,
  getMonsterBaseDamage,
  getMonsterDisplayName,
  getNextEvolution,
} from '../data/fusion';
import { applyFusionEvolution } from '../data/fusionTransactions';
import { logger } from '../utils/logger';
import { addMonsterPortrait } from './MonsterPortraitView';
import { addPrimaryActionButton } from './GameUiPrimitives';
import {
  type FusionTabContext,
  TAB_ACCENT,
  bindFusionTransactionAction,
  drawMonsterSlot,
  getFusionPickerSourceIndex,
  openMonsterPicker,
  showConfirmDialog,
  showFusionAnimation,
  showFusionResultPanel,
} from './FusionTabs';

export interface EvolutionState {
  readonly evoSlots: readonly (OwnedMonster | null)[];
  readonly setEvoSlots: (slots: (OwnedMonster | null)[]) => void;
}

export function buildEvolutionTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  state: EvolutionState,
): void {
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

  c.add(ctx.scene.add.text(panelX + 16, panelY + 20, '삼중 결속진', {
    fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + panelW - 16, panelY + 20, '동일 ID 3체 필요', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));

  const slotW = 100;
  const slotH = 120;
  const gap = 9;
  const startX = (CANVAS_WIDTH - (slotW * 3 + gap * 2)) / 2;
  const slotY = panelY + 42;
  for (let index = 0; index < 3; index++) {
    const selected = state.evoSlots[index] ?? null;
    drawMonsterSlot(
      ctx,
      c,
      startX + index * (slotW + gap),
      slotY,
      slotW,
      slotH,
      selected,
      '진화',
      () => {
        const first = state.evoSlots[0];
        const occupiedIndices = new Set(
          state.evoSlots
            .filter((slot, slotIndex): slot is OwnedMonster => slotIndex !== index && slot !== null)
            .map(getFusionPickerSourceIndex)
            .filter((sourceIndex): sourceIndex is number => sourceIndex !== undefined),
        );
        const filter = first && index > 0
          ? (monster: OwnedMonster) => monster.id === first.id
            && !occupiedIndices.has(getFusionPickerSourceIndex(monster) ?? -1)
          : (monster: OwnedMonster) => !occupiedIndices.has(getFusionPickerSourceIndex(monster) ?? -1);
        openMonsterPicker(ctx, filter, monster => {
          const next = index === 0 && monster.id !== state.evoSlots[0]?.id
            ? [monster, null, null]
            : [...state.evoSlots];
          next[index] = monster;
          state.setEvoSlots(next);
          ctx.refreshTab();
        });
      },
      `재료 ${index + 1}`,
    );
  }

  const allFilled = state.evoSlots.every((slot): slot is OwnedMonster => slot !== null);
  const tier = allFilled ? getNextEvolution(state.evoSlots[0]!.id) : null;
  const resultY = slotY + slotH + 18;
  const resultX = panelX + 16;
  const resultW = panelW - 32;
  const resultH = 110;
  const resultBg = ctx.scene.add.graphics();
  resultBg.fillStyle(DUNGEON_UI.SOOT, 0.96);
  resultBg.fillRoundedRect(resultX, resultY, resultW, resultH, 8);
  resultBg.lineStyle(1.5, tier ? TAB_ACCENT['진화'] : DUNGEON_UI.IRON, tier ? 0.82 : 0.72);
  resultBg.strokeRoundedRect(resultX, resultY, resultW, resultH, 8);
  c.add(resultBg);

  if (tier && allFilled) {
    const resultName = getMonsterDisplayName(tier.resultId);
    const baseAtk = getMonsterBaseDamage(state.evoSlots[0]!.id);
    const resultAtk = getMonsterBaseDamage(tier.resultId);
    const maxLevel = Math.max(...state.evoSlots.map(slot => slot!.level));
    addMonsterPortrait(ctx.scene, c, resultX + 58, resultY + 55, tier.resultId, {
      size: 76,
      frameColor: TAB_ACCENT['진화'],
      glowColor: TAB_ACCENT['진화'],
      bgColor: DUNGEON_UI.VOID,
      equippedSkins: loadGameState().equippedSkins,
    });
    c.add(ctx.scene.add.text(resultX + 112, resultY + 24, '결속 결과', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 47, resultName, {
      fontFamily: 'sans-serif', fontSize: '16px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 70,
      `${RARITY_STARS[tier.rarity]} · Lv.${maxLevel} 계승`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0, 0.5));
    c.add(ctx.scene.add.text(resultX + 112, resultY + 91,
      `기본 ATK ${baseAtk} → ${resultAtk}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
  } else {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 42,
      allFilled ? '이 개체는 더 진화할 수 없습니다' : '재료 3체를 지정하면 결과를 예측합니다', {
        fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
      }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + 70,
      '결과는 선택한 재료 중 최고 Level을 계승합니다', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#727c72',
      }).setOrigin(0.5));
  }

  const warningY = resultY + resultH + 18;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, warningY,
    tier ? '주의: 선택한 재료 3체는 영구 소멸합니다' : '동일 개체 3체를 선택하세요', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: tier ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold',
    }).setOrigin(0.5));

  const action = addPrimaryActionButton(ctx.scene, {
    x: panelX + 16,
    y: warningY + 18,
    w: panelW - 32,
    h: 48,
    label: tier ? '진화 의식 준비' : '재료를 먼저 선택하세요',
    fontSize: '15px',
    enabled: Boolean(tier),
    once: true,
    showArrow: false,
    fillColor: TAB_ACCENT['진화'],
    borderColor: DUNGEON_UI.BRASS_BRIGHT,
    hoverFillColor: TAB_ACCENT['진화'],
    hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    disabledFillColor: DUNGEON_UI.SOOT,
    disabledBorderColor: DUNGEON_UI.IRON,
    disabledTextColor: DUNGEON_UI_CSS.MUTED,
    onPress: () => {},
  });
  bindFusionTransactionAction(ctx, action, () => {
      if (!tier) return;
      const materialName = getMonsterDisplayName(state.evoSlots[0]!.id);
      const levels = state.evoSlots.map(slot => `Lv.${slot!.level}`).join(' · ');
      showConfirmDialog(
        ctx,
        `${materialName} 3체를 결속합니다`,
        `${levels}\n재료 3체 영구 소멸 · ${getMonsterDisplayName(tier.resultId)} 생성`,
        '진화',
        () => executeEvolution(ctx, state),
      );
    });
  c.add([action.bg, action.text, action.zone]);
}

function executeEvolution(ctx: FusionTabContext, state: EvolutionState): void {
  const result = applyFusionEvolution(loadGameState(), state.evoSlots);
  if (!result.ok) {
    logger.warn(`[EVOLUTION] rejected: ${result.reason}`);
    showFusionResultPanel(ctx, {
      tabId: '진화', status: 'failure', title: '진화 조건이 바뀌었습니다',
      detail: '현재 보유 상태를 다시 확인한 뒤 재료를 선택하세요.',
    });
    return;
  }

  saveGameState(result.state);
  state.setEvoSlots([null, null, null]);
  logger.debug(`[EVOLUTION] ${result.consumedMonsterId}×3 → ${result.resultId} Lv.${result.monster.level}`);
  showFusionAnimation(ctx, '진화', () => {
    showFusionResultPanel(ctx, {
      tabId: '진화',
      title: `${getMonsterDisplayName(result.resultId)} 진화 완료`,
      detail: `Lv.${result.monster.level} 계승 · 상위 희귀도와 진화 Skill을 획득했습니다.`,
    });
  });
}
