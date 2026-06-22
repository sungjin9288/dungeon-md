// ─── Evolution Tab ─────────────────────────────────────────────────────────────
// Implements the 진화 (Evolution) tab for FusionScene.
// Requires 3 identical monsters → produces evolved form.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_STARS, RARITY_COLORS,
  getMonsterEmoji, getMonsterDisplayName,
  getMonsterBaseDamage, getNextEvolution,
} from '../data/fusion';
import { applyFusionEvolution } from '../data/fusionTransactions';
import { getReducedMotion } from '../utils/reducedMotion';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  type FusionTabContext, TAB_ACCENT,
  drawMonsterSlot, openMonsterPicker, showFusionAnimation, showResultToast, showConfirmDialog,
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
  const LY    = ctx.contentY + 250;
  const slotW = 80, slotH = 90;
  const totalW = 3 * slotW + 2 * 10;
  const sx0   = (CANVAS_WIDTH - totalW) / 2;

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, LY - 26, '같은 몬스터 3마리 → 진화', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  for (let i = 0; i < 3; i++) {
    const sx = sx0 + i * (slotW + 10);
    const fi = i;
    drawMonsterSlot(ctx, c, sx, LY, slotW, slotH, state.evoSlots[i] ?? null, '진화', () => {
      const filter = state.evoSlots[0] && fi > 0
        ? (m: OwnedMonster) => m.id === state.evoSlots[0]!.id
        : undefined;
      openMonsterPicker(ctx, filter, (monster) => {
        const next = [...state.evoSlots];
        next[fi] = monster;
        state.setEvoSlots(next);
        ctx.refreshTab();
      });
    });
  }

  [sx0 + slotW, sx0 + slotW * 2 + 10].forEach(px => {
    c.add(ctx.scene.add.text(px + 5, LY + slotH / 2, '+', {
      fontFamily: 'sans-serif', fontSize: '18px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0.5));
  });

  const arrowY = LY + slotH + 20;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
  }).setOrigin(0.5));

  const resultX  = (CANVAS_WIDTH - slotW) / 2;
  const resultY  = arrowY + 22;
  const allFilled = state.evoSlots.every(s => s !== null);

  if (allFilled) {
    const tier = getNextEvolution(state.evoSlots[0]!.id);
    if (tier) {
      const resultId     = tier.resultId;
      const evolvedName  = getMonsterDisplayName(resultId);
      const evolvedEmoji = getMonsterEmoji(resultId);
      const baseAtk      = getMonsterBaseDamage(state.evoSlots[0]!.id);
      const newAtk       = Math.round(baseAtk * 1.30);
      const rarity       = tier.rarity;

      const rg = ctx.scene.add.graphics();
      rg.fillStyle(CASUAL.SHADOW, 0.18);
      rg.fillRoundedRect(resultX, resultY + 3, slotW, slotH + 18, 12);
      rg.fillStyle(CASUAL.PANEL, 1);
      rg.fillRoundedRect(resultX, resultY, slotW, slotH + 18, 12);
      rg.fillStyle(0xffffff, 0.12);
      rg.fillRoundedRect(resultX + 4, resultY + 4, slotW - 8, 6, 3);
      rg.lineStyle(3, TAB_ACCENT['진화'], 1);
      rg.strokeRoundedRect(resultX, resultY, slotW, slotH + 18, 12);
      c.add(rg);

      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 20, evolvedEmoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 62, evolvedName, {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[rarity], fontStyle: 'bold',
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 76, `ATK: ${baseAtk}→${newAtk}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
      }).setOrigin(0.5));

      const execBtn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '✨ 진화 실행', {
        fontFamily: 'sans-serif', fontSize: '16px', color: CASUAL_CSS.WHITE, fontStyle: 'bold',
        backgroundColor: CASUAL_CSS.GREEN, padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setInteractive();
      // Decorative button glow — execBtn stays fully visible when gated.
      if (!getReducedMotion()) {
        ctx.scene.tweens.add({
          targets: execBtn, alpha: { from: 0.8, to: 1.0 },
          duration: 800, yoyo: true, repeat: -1,
        });
      }
      execBtn.on('pointerdown', () => {
        ctx.scene.tweens.add({ targets: execBtn, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
        showConfirmDialog(
          ctx,
          '✨ 진화를 실행하시겠습니까?',
          `${getMonsterDisplayName(state.evoSlots[0]!.id)} ×3 → ${evolvedName}\n재료 몬스터가 사라집니다.`,
          '#44cc66',
          () => executeEvolution(ctx, state),
        );
      });
      c.add(execBtn);
    }
  } else {
    const g = ctx.scene.add.graphics();
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(resultX, resultY, slotW, slotH, 12);
    g.lineStyle(3, CASUAL.EDGE, 0.9);
    g.strokeRoundedRect(resultX, resultY, slotW, slotH, 12);
    c.add(g);
    c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
      fontFamily: 'sans-serif', fontSize: '26px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '슬롯을 채우세요', {
      fontFamily: 'sans-serif', fontSize: '15px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.CREAM, padding: { x: 28, y: 10 },
    }).setOrigin(0.5));
  }

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50, '진화 성공 시: 능력치 +30%, 희귀도 ↑', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
}

function executeEvolution(ctx: FusionTabContext, state: EvolutionState): void {
  const result = applyFusionEvolution(loadGameState(), state.evoSlots);
  if (!result.ok) return;

  saveGameState(result.state);

  const evolvedAtk = getMonsterBaseDamage(result.resultId);
  const baseAtk    = getMonsterBaseDamage(result.consumedMonsterId);
  logger.debug(`[EVOLUTION] ${result.consumedMonsterId}×3 → ${result.resultId} Lv.${result.monster.level} ATK:${evolvedAtk} (was ${baseAtk})`);

  state.setEvoSlots([null, null, null]);
  showFusionAnimation(ctx, '진화', () => {
    ctx.refreshTab();
    showResultToast(ctx, `${getMonsterDisplayName(result.resultId)} 진화 완료!`, '#44cc66');
  });
}
