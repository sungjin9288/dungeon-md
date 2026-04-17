// ─── Evolution Tab ─────────────────────────────────────────────────────────────
// Implements the 진화 (Evolution) tab for FusionScene.
// Requires 3 identical base-type monsters → produces evolved form.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  RARITY_STARS, RARITY_COLORS,
  getBaseId, getMonsterEmoji, getMonsterDisplayName,
  getMonsterBaseDamage, getNextEvolution,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
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
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#66aa77',
  }).setOrigin(0.5));

  for (let i = 0; i < 3; i++) {
    const sx = sx0 + i * (slotW + 10);
    const fi = i;
    drawMonsterSlot(ctx, c, sx, LY, slotW, slotH, state.evoSlots[i] ?? null, '진화', () => {
      const filter = state.evoSlots[0] && fi > 0
        ? (m: OwnedMonster) => getBaseId(m.id) === getBaseId(state.evoSlots[0]!.id)
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
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#335544',
    }).setOrigin(0.5));
  });

  const arrowY = LY + slotH + 20;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#44cc66',
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
      rg.fillStyle(0x001a10, 1);
      rg.fillRoundedRect(resultX, resultY, slotW, slotH + 18, 6);
      rg.lineStyle(2, TAB_ACCENT['진화'], 0.9);
      rg.strokeRoundedRect(resultX, resultY, slotW, slotH + 18, 6);
      c.add(rg);

      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 20, evolvedEmoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 62, evolvedName, {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[rarity],
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 76, `ATK: ${baseAtk}→${newAtk}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#44cc66',
      }).setOrigin(0.5));

      const execBtn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '✨ 진화 실행', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cc66', fontStyle: 'bold',
        backgroundColor: '#002a14', padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setInteractive();
      ctx.scene.tweens.add({
        targets: execBtn, alpha: { from: 0.8, to: 1.0 },
        duration: 800, yoyo: true, repeat: -1,
      });
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
    g.fillStyle(0x001408, 1);
    g.fillRoundedRect(resultX, resultY, slotW, slotH, 6);
    g.lineStyle(1.5, TAB_ACCENT['진화'], 0.3);
    g.strokeRoundedRect(resultX, resultY, slotW, slotH, 6);
    c.add(g);
    c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '슬롯을 채우세요', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#335544',
      backgroundColor: '#001208', padding: { x: 28, y: 10 },
    }).setOrigin(0.5));
  }

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50, '진화 성공 시: 능력치 +30%, 희귀도 ↑', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#336644',
  }).setOrigin(0.5));
}

function executeEvolution(ctx: FusionTabContext, state: EvolutionState): void {
  const slot0 = state.evoSlots[0];
  if (!slot0) return;
  const tier = getNextEvolution(slot0.id);
  if (!tier) return;

  const gs = loadGameState();
  const maxLevel = Math.max(...state.evoSlots.map(s => s?.level ?? 1));

  const slotIds = state.evoSlots.map(s => s?.id);
  let removed = 0;
  for (let i = gs.ownedMonsters.length - 1; i >= 0 && removed < 3; i--) {
    if (gs.ownedMonsters[i].id === slotIds[removed] || gs.ownedMonsters[i].id === slot0.id) {
      gs.ownedMonsters.splice(i, 1);
      removed++;
    }
  }

  const evolved: OwnedMonster = {
    id: tier.resultId, level: maxLevel, xp: 0,
    skillPoints: 0,
    spentSkills: { [tier.unlockedSkill]: 1 },
    equippedSkills: [], equipment: null,
    rarity: tier.rarity, absorptionStacks: 0,
  };
  gs.ownedMonsters.push(evolved);

  updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
  saveGameState(gs);

  const evolvedAtk = getMonsterBaseDamage(tier.resultId);
  const baseAtk    = getMonsterBaseDamage(slot0.id);
  logger.debug(`[EVOLUTION] ${getBaseId(slot0.id)}×3 → ${tier.resultId} Lv.${maxLevel} ATK:${evolvedAtk} (was ${baseAtk})`);

  state.setEvoSlots([null, null, null]);
  showFusionAnimation(ctx, '진화', () => {
    ctx.refreshTab();
    showResultToast(ctx, `${getMonsterDisplayName(tier.resultId)} 진화 완료!`, '#44cc66');
  });
}
