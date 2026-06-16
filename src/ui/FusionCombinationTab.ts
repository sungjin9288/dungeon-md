// ─── Combination Tab ───────────────────────────────────────────────────────────
// Implements the 조합 (Combination) tab for FusionScene.
// Two different monsters + 100 soul crystals → hybrid monster discovery.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_STARS, RARITY_COLORS,
  HYBRID_DEFS, COMBINATION_TABLE,
  getBaseId, combinationKey,
} from '../data/fusion';
import { FUSION_COMBINATION_COST, applyFusionCombination } from '../data/fusionTransactions';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  type FusionTabContext, TAB_ACCENT,
  drawMonsterSlot, openMonsterPicker,
  showFusionAnimation, showResultToast, showConfirmDialog,
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
  const LY    = ctx.contentY + 250;
  const slotW = 80, slotH = 90;
  const gap   = 60;
  const totalW = 2 * slotW + gap;
  const sx0   = (CANVAS_WIDTH - totalW) / 2;

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, LY - 26,
    `서로 다른 몬스터 2마리 + 💠 ${FUSION_COMBINATION_COST} → 혼종 탄생`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: CANVAS_WIDTH - 40 }, align: 'center',
    }).setOrigin(0.5));

  // Slot A
  drawMonsterSlot(ctx, c, sx0, LY, slotW, slotH, state.combineSlots[0] ?? null, '조합', () => {
    openMonsterPicker(ctx, undefined, (m) => {
      state.setCombineSlots([m, state.combineSlots[1] ?? null]);
      ctx.refreshTab();
    });
  });
  c.add(ctx.scene.add.text(sx0 + slotW + gap / 2, LY + slotH / 2, '+', {
    fontFamily: 'sans-serif', fontSize: '22px', color: CASUAL_CSS.BLUE, fontStyle: 'bold',
  }).setOrigin(0.5));
  // Slot B
  drawMonsterSlot(ctx, c, sx0 + slotW + gap, LY, slotW, slotH, state.combineSlots[1] ?? null, '조합', () => {
    const a = state.combineSlots[0];
    openMonsterPicker(
      ctx,
      a ? (m: OwnedMonster) => getBaseId(m.id) !== getBaseId(a.id) : undefined,
      (m) => {
        state.setCombineSlots([state.combineSlots[0] ?? null, m]);
        ctx.refreshTab();
      },
    );
  });

  // Crystal cost
  const gs = loadGameState();
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, LY + slotH + 14,
    `💠 보유 수정: ${gs.soulCrystals} / 필요: ${FUSION_COMBINATION_COST}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: gs.soulCrystals >= FUSION_COMBINATION_COST ? CASUAL_CSS.BLUE : CASUAL_CSS.RED,
    }).setOrigin(0.5));

  const arrowY  = LY + slotH + 42;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: CASUAL_CSS.BLUE, fontStyle: 'bold',
  }).setOrigin(0.5));

  const resultX   = (CANVAS_WIDTH - slotW) / 2;
  const resultY   = arrowY + 22;
  const bothFilled = state.combineSlots[0] !== null && state.combineSlots[1] !== null;

  if (bothFilled) {
    const key      = combinationKey(state.combineSlots[0]!.id, state.combineSlots[1]!.id);
    const hybridId = COMBINATION_TABLE[key];
    const hybrid   = hybridId ? HYBRID_DEFS[hybridId] : undefined;

    const rg = ctx.scene.add.graphics();
    if (hybrid) {
      rg.fillStyle(CASUAL.SHADOW, 0.18);
      rg.fillRoundedRect(resultX, resultY + 3, slotW, slotH, 12);
      rg.fillStyle(CASUAL.PANEL, 1);
      rg.fillRoundedRect(resultX, resultY, slotW, slotH, 12);
      rg.fillStyle(0xffffff, 0.12);
      rg.fillRoundedRect(resultX + 4, resultY + 4, slotW - 8, 6, 3);
      rg.lineStyle(3, TAB_ACCENT['조합'], 1);
      rg.strokeRoundedRect(resultX, resultY, slotW, slotH, 12);
    } else {
      rg.fillStyle(CASUAL.PANEL_SOFT, 1);
      rg.fillRoundedRect(resultX, resultY, slotW, slotH, 12);
      rg.lineStyle(3, CASUAL.EDGE, 0.9);
      rg.strokeRoundedRect(resultX, resultY, slotW, slotH, 12);
    }
    c.add(rg);

    if (hybrid) {
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 22, hybrid.emoji, {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[hybrid.rarity], {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 62, hybrid.name, {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[hybrid.rarity], fontStyle: 'bold',
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
    } else {
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
        fontFamily: 'sans-serif', fontSize: '26px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0.5));
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
  }

  const allReady = bothFilled && gs.soulCrystals >= FUSION_COMBINATION_COST;
  const btn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 28,
    allReady ? `🧪 조합 시도 (-💠 ${FUSION_COMBINATION_COST})` : bothFilled ? `💠 부족 (${FUSION_COMBINATION_COST} 필요)` : '조건 미충족', {
      fontFamily: 'sans-serif', fontSize: '14px',
      color: allReady ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      backgroundColor: allReady ? CASUAL_CSS.BLUE : CASUAL_CSS.CREAM,
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
  if (allReady) btn.setInteractive().on('pointerdown', () => {
    ctx.scene.tweens.add({ targets: btn, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
    const [slotA, slotB] = state.combineSlots;
    if (!slotA || !slotB) return;
    const knownId = COMBINATION_TABLE[combinationKey(slotA.id, slotB.id)];
    const known   = knownId ? HYBRID_DEFS[knownId] : undefined;
    showConfirmDialog(
      ctx,
      known ? '🧪 조합을 실행하시겠습니까?' : '⚠️ 미지의 조합',
      known
        ? `${known.emoji} ${known.name} 생성\n💠 ${FUSION_COMBINATION_COST} 소모됩니다.`
        : `결과를 알 수 없습니다\n💠 ${FUSION_COMBINATION_COST} 소모 (실패 가능)`,
      known ? '#4488cc' : '#885533',
      () => executeCombination(ctx, state),
    );
  });
  c.add(btn);
}

function executeCombination(ctx: FusionTabContext, state: CombinationState): void {
  const [slotA, slotB] = state.combineSlots;
  if (!slotA || !slotB) return;

  const gs = loadGameState();
  const result = applyFusionCombination(gs, slotA, slotB);
  if (!result.ok) return;

  saveGameState(result.state);
  state.setCombineSlots([null, null]);

  if (result.recipeMatched) {
    const { hybrid, hybridId, isNewDiscovery } = result;

    if (isNewDiscovery) logger.debug(`[COMBINATION] NEW DISCOVERY: ${hybridId} — ${hybrid.name}`);
    showFusionAnimation(ctx, '조합', () => {
      ctx.refreshHeader();
      ctx.refreshTab();
      if (isNewDiscovery) {
        showDiscoveryFanfare(ctx, hybrid.emoji, hybrid.name, hybrid.rarity);
      } else {
        showResultToast(ctx, `${hybrid.name} 조합 성공!`, '#4488cc');
      }
    });
  } else {
    logger.debug(`[COMBINATION] FAILED: ${result.recipeKey} — no known recipe`);

    // Fail animation (smoke)
    const smoke = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '💨', {
      fontFamily: 'sans-serif', fontSize: '64px',
    }).setOrigin(0.5).setDepth(61).setAlpha(0);
    ctx.scene.tweens.add({ targets: smoke, alpha: 1, scaleX: 1.5, scaleY: 1.5, duration: 300 });
    ctx.scene.time.delayedCall(900, () => {
      ctx.scene.tweens.add({
        targets: smoke, alpha: 0, duration: 300,
        onComplete: () => {
          smoke.destroy();
          ctx.refreshTab();
          showResultToast(ctx, '이 조합은 효과가 없습니다', '#885533');
        },
      });
    });
  }
}

function showDiscoveryFanfare(
  ctx: FusionTabContext, emoji: string, name: string, rarity: number,
): void {
  const c = ctx.scene.add.container(0, 0).setDepth(80);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.85);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(dim);

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80, '✨ 새로운 조합 발견! ✨', {
    fontFamily: 'Georgia, serif', fontSize: '20px', color: RARITY_COLORS[rarity], fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 24, emoji, {
    fontFamily: 'sans-serif', fontSize: '64px',
  }).setOrigin(0.5));
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 48, name, {
    fontFamily: 'Georgia, serif', fontSize: '22px', color: RARITY_COLORS[rarity], fontStyle: 'bold',
  }).setOrigin(0.5));
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80, RARITY_STARS[rarity], {
    fontFamily: 'sans-serif', fontSize: '18px',
  }).setOrigin(0.5));

  c.setAlpha(0);
  ctx.scene.tweens.add({ targets: c, alpha: 1, duration: 300, ease: 'Quad.easeOut' });
  ctx.scene.time.delayedCall(2800, () => {
    ctx.scene.tweens.add({
      targets: c, alpha: 0, duration: 400,
      onComplete: () => c.destroy(true),
    });
  });
}
