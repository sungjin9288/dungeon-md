import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_XP_VALUES,
  getBaseId,
  getMonsterDisplayName,
  getMonsterRarity,
} from '../data/fusion';
import { applyFusionAbsorption } from '../data/fusionTransactions';
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

export interface AbsorptionState {
  readonly absorbTarget: OwnedMonster | null;
  readonly absorbSacrifices: readonly OwnedMonster[];
  readonly setAbsorbTarget: (monster: OwnedMonster | null) => void;
  readonly setAbsorbSacrifices: (monsters: OwnedMonster[]) => void;
}

export function buildAbsorptionTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  state: AbsorptionState,
): void {
  const gameState = loadGameState();
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

  c.add(ctx.scene.add.text(panelX + 16, panelY + 20, '정수 이전진', {
    fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + panelW - 16, panelY + 20, '희생 최대 5체', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));

  const targetX = panelX + 16;
  const targetY = panelY + 44;
  drawMonsterSlot(ctx, c, targetX, targetY, 108, 138, state.absorbTarget, '흡수', () => {
    openMonsterPicker(
      ctx,
      monster => !state.absorbSacrifices.some(sacrifice => sacrifice.id === monster.id),
      monster => {
        state.setAbsorbTarget(monster);
        ctx.refreshTab();
      },
    );
  }, '정수 수용체');

  const sacrificeStartX = targetX + 120;
  const cellW = 62;
  const cellH = 66;
  const gap = 6;
  for (let index = 0; index < 5; index++) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = sacrificeStartX + col * (cellW + gap);
    const y = targetY + row * (cellH + gap);
    const sacrifice = state.absorbSacrifices[index];
    const card = ctx.scene.add.graphics();
    card.fillStyle(DUNGEON_UI.SOOT, 0.98);
    card.fillRoundedRect(x, y, cellW, cellH, 7);
    card.lineStyle(1.5, sacrifice ? TAB_ACCENT['흡수'] : DUNGEON_UI.IRON, sacrifice ? 0.86 : 0.7);
    card.strokeRoundedRect(x, y, cellW, cellH, 7);
    c.add(card);

    if (sacrifice) {
      addMonsterPortrait(ctx.scene, c, x + cellW / 2, y + 25, sacrifice.id, {
        size: 38,
        frameColor: TAB_ACCENT['흡수'],
        glowColor: TAB_ACCENT['흡수'],
        bgColor: DUNGEON_UI.VOID,
        equippedSkins: gameState.equippedSkins,
      });
      const rarity = sacrifice.rarity ?? getMonsterRarity(sacrifice.id);
      c.add(ctx.scene.add.text(x + cellW / 2, y + 54, `+${RARITY_XP_VALUES[rarity] ?? 30} XP`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#d69a67', fontStyle: 'bold',
      }).setOrigin(0.5));
      const removeZone = ctx.scene.add.zone(x, y, cellW, cellH).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      removeZone.once('pointerdown', () => {
        const next = [...state.absorbSacrifices];
        next.splice(index, 1);
        state.setAbsorbSacrifices(next);
        ctx.refreshTab();
      });
      c.add(removeZone);
    } else if (index === state.absorbSacrifices.length) {
      const plus = ctx.scene.add.graphics();
      plus.lineStyle(2, TAB_ACCENT['흡수'], 0.8);
      plus.strokeCircle(x + cellW / 2, y + cellH / 2 - 5, 13);
      plus.lineBetween(x + cellW / 2 - 6, y + cellH / 2 - 5, x + cellW / 2 + 6, y + cellH / 2 - 5);
      plus.lineBetween(x + cellW / 2, y + cellH / 2 - 11, x + cellW / 2, y + cellH / 2 + 1);
      c.add(plus);
      c.add(ctx.scene.add.text(x + cellW / 2, y + cellH - 10, '추가', {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const addZone = ctx.scene.add.zone(x, y, cellW, cellH).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      addZone.once('pointerdown', () => {
        const ownedCounts = new Map<string, number>();
        for (const monster of gameState.ownedMonsters) {
          ownedCounts.set(monster.id, (ownedCounts.get(monster.id) ?? 0) + 1);
        }
        openMonsterPicker(
          ctx,
          monster => {
            if (state.absorbTarget?.id === monster.id) return false;
            const candidateIndex = getFusionPickerSourceIndex(monster);
            const alreadySelected = state.absorbSacrifices.some(
              sacrifice => getFusionPickerSourceIndex(sacrifice) === candidateIndex,
            );
            if (alreadySelected) return false;
            const selected = state.absorbSacrifices.filter(item => item.id === monster.id).length;
            return selected < (ownedCounts.get(monster.id) ?? 0);
          },
          monster => {
            state.setAbsorbSacrifices([...state.absorbSacrifices, monster]);
            ctx.refreshTab();
          },
        );
      });
      c.add(addZone);
    } else {
      c.add(ctx.scene.add.text(x + cellW / 2, y + cellH / 2, `${index + 1}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#505950',
      }).setOrigin(0.5));
    }
  }

  c.add(ctx.scene.add.text(sacrificeStartX, targetY + 151, '선택된 희생체를 누르면 해제', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  let totalXp = 0;
  let sameLineage = 0;
  if (state.absorbTarget) {
    for (const sacrifice of state.absorbSacrifices) {
      const rarity = sacrifice.rarity ?? getMonsterRarity(sacrifice.id);
      totalXp += RARITY_XP_VALUES[rarity] ?? 30;
      if (getBaseId(sacrifice.id) === getBaseId(state.absorbTarget.id)) sameLineage++;
    }
  }
  const oldStacks = state.absorbTarget?.absorptionStacks ?? 0;
  const newStacks = Math.min(10, oldStacks + sameLineage);
  const previewY = targetY + 180;
  const preview = ctx.scene.add.graphics();
  preview.fillStyle(DUNGEON_UI.SOOT, 0.96);
  preview.fillRoundedRect(panelX + 16, previewY, panelW - 32, 94, 8);
  preview.lineStyle(1, DUNGEON_UI.IRON, 0.78);
  preview.strokeRoundedRect(panelX + 16, previewY, panelW - 32, 94, 8);
  c.add(preview);
  c.add(ctx.scene.add.text(panelX + 30, previewY + 20, '예상 이전 결과', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + 30, previewY + 46, `경험치 +${totalXp}`, {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#d69a67', fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + 30, previewY + 72,
    `동일 계보 ${sameLineage}체 · ATK stack ${oldStacks} → ${newStacks}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));

  const canExecute = Boolean(state.absorbTarget) && state.absorbSacrifices.length > 0;
  const warningY = previewY + 112;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, warningY,
    canExecute ? `주의: 희생 ${state.absorbSacrifices.length}체는 영구 소멸합니다` : '수용체와 희생체를 지정하세요', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: canExecute ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold',
    }).setOrigin(0.5));

  const action = addPrimaryActionButton(ctx.scene, {
    x: panelX + 16, y: warningY + 18, w: panelW - 32, h: 48,
    label: canExecute ? '흡수 의식 준비' : '대상을 먼저 선택하세요',
    fontSize: '15px', enabled: canExecute, once: true, showArrow: false,
    fillColor: TAB_ACCENT['흡수'], borderColor: DUNGEON_UI.BRASS_BRIGHT,
    hoverFillColor: TAB_ACCENT['흡수'], hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
    disabledTextColor: DUNGEON_UI_CSS.MUTED,
    onPress: () => {},
  });
  bindFusionTransactionAction(ctx, action, () => {
      if (!state.absorbTarget) return;
      showConfirmDialog(
        ctx,
        `${getMonsterDisplayName(state.absorbTarget.id)}에게 정수를 이전합니다`,
        `희생 ${state.absorbSacrifices.length}체 영구 소멸\n경험치 +${totalXp} · ATK stack ${oldStacks} → ${newStacks}`,
        '흡수',
        () => executeAbsorption(ctx, state),
      );
    });
  c.add([action.bg, action.text, action.zone]);
}

function executeAbsorption(ctx: FusionTabContext, state: AbsorptionState): void {
  const target = state.absorbTarget;
  if (!target) {
    ctx.finishTransaction();
    return;
  }
  const result = applyFusionAbsorption(loadGameState(), target, state.absorbSacrifices);
  if (!result.ok) {
    logger.warn(`[ABSORB] rejected: ${result.reason}`);
    showFusionResultPanel(ctx, {
      tabId: '흡수', status: 'failure', title: '흡수 조건이 바뀌었습니다',
      detail: '현재 보유 상태를 다시 확인한 뒤 수용체와 희생체를 선택하세요.',
    });
    return;
  }

  saveGameState(result.state);
  state.setAbsorbSacrifices([]);
  state.setAbsorbTarget(null);
  logger.debug(`[ABSORB] ${target.id}: +${result.totalXp} XP, stacks ${result.newStacks}/10`);
  showFusionAnimation(ctx, '흡수', () => {
    const stackDetail = result.sameTypeCount > 0
      ? `동일 계보 ${result.sameTypeCount}체 · ATK stack ${result.newStacks}/10`
      : '동일 계보 bonus는 적용되지 않았습니다.';
    showFusionResultPanel(ctx, {
      tabId: '흡수', title: `정수 이전 완료 · +${result.totalXp} XP`, detail: stackDetail,
    });
  });
}
