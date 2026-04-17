// ─── Combination Tab ───────────────────────────────────────────────────────────
// Implements the 조합 (Combination) tab for FusionScene.
// Two different monsters + 100 soul crystals → hybrid monster discovery.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  RARITY_STARS, RARITY_COLORS,
  HYBRID_DEFS, COMBINATION_TABLE,
  getBaseId, combinationKey,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
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
    '서로 다른 몬스터 2마리 + 💎 100 → 혼종 탄생', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4488cc',
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
    fontFamily: 'Georgia, serif', fontSize: '22px', color: '#4488cc',
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
    `💠 보유 수정: ${gs.soulCrystals} / 필요: 100`, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: gs.soulCrystals >= 100 ? '#4488cc' : '#aa2222',
    }).setOrigin(0.5));

  const arrowY  = LY + slotH + 42;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#4488cc',
  }).setOrigin(0.5));

  const resultX   = (CANVAS_WIDTH - slotW) / 2;
  const resultY   = arrowY + 22;
  const bothFilled = state.combineSlots[0] !== null && state.combineSlots[1] !== null;

  if (bothFilled) {
    const key      = combinationKey(state.combineSlots[0]!.id, state.combineSlots[1]!.id);
    const hybridId = COMBINATION_TABLE[key];
    const hybrid   = hybridId ? HYBRID_DEFS[hybridId] : undefined;

    const rg = ctx.scene.add.graphics();
    rg.fillStyle(0x00080d, 1);
    rg.fillRoundedRect(resultX, resultY, slotW, slotH, 6);
    rg.lineStyle(1.5, 0x4488cc, hybrid ? 0.9 : 0.3);
    rg.strokeRoundedRect(resultX, resultY, slotW, slotH, 6);
    c.add(rg);

    if (hybrid) {
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 22, hybrid.emoji, {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[hybrid.rarity], {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 62, hybrid.name, {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[hybrid.rarity],
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
    } else {
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
        fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
      }).setOrigin(0.5));
    }
  } else {
    const g = ctx.scene.add.graphics();
    g.fillStyle(0x001408, 1);
    g.fillRoundedRect(resultX, resultY, slotW, slotH, 6);
    g.lineStyle(1.5, TAB_ACCENT['조합'], 0.3);
    g.strokeRoundedRect(resultX, resultY, slotW, slotH, 6);
    c.add(g);
    c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
    }).setOrigin(0.5));
  }

  const allReady = bothFilled && gs.soulCrystals >= 100;
  const btn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 28,
    allReady ? '🧪 조합 시도 (-💠 100)' : bothFilled ? '💠 부족 (100 필요)' : '조건 미충족', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: allReady ? '#4488cc' : '#2a3a55', fontStyle: 'bold',
      backgroundColor: allReady ? '#001433' : '#000810',
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
        ? `${known.emoji} ${known.name} 생성\n💠 100 소모됩니다.`
        : '결과를 알 수 없습니다\n💠 100 소모 (실패 가능)',
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
  if (gs.soulCrystals < 100) return;
  gs.soulCrystals -= 100;

  const key      = combinationKey(slotA.id, slotB.id);
  const hybridId = COMBINATION_TABLE[key];

  if (hybridId) {
    const hybrid = HYBRID_DEFS[hybridId];
    const isNew  = !(gs.discoveredCombinations ?? []).includes(hybridId);
    if (isNew) {
      gs.discoveredCombinations = [...(gs.discoveredCombinations ?? []), hybridId];
      logger.debug(`[COMBINATION] NEW DISCOVERY: ${hybridId} — ${hybrid.name}`);
    }

    const avgLevel = Math.round((slotA.level + slotB.level) / 2);
    const newMonster = {
      id: hybridId, level: avgLevel, xp: 0,
      skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null,
      rarity: hybrid.rarity, absorptionStacks: 0,
    };
    gs.ownedMonsters.push(newMonster);
    updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
    saveGameState(gs);

    state.setCombineSlots([null, null]);
    showFusionAnimation(ctx, '조합', () => {
      ctx.refreshHeader();
      ctx.refreshTab();
      if (isNew) {
        showDiscoveryFanfare(ctx, hybrid.emoji, hybrid.name, hybrid.rarity);
      } else {
        showResultToast(ctx, `${hybrid.name} 조합 성공!`, '#4488cc');
      }
    });
  } else {
    logger.debug(`[COMBINATION] FAILED: ${key} — no known recipe`);
    saveGameState(gs);
    state.setCombineSlots([null, null]);

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
