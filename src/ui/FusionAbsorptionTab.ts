// ─── Absorption Tab ────────────────────────────────────────────────────────────
// Implements the 흡수 (Absorption) tab for FusionScene.
// Sacrifices monsters → XP + same-type ATK stacks for a base target monster.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster, addXp } from '../data/barracks';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  RARITY_XP_VALUES,
  getBaseId, getMonsterRarity, getMonsterEmoji,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  type FusionTabContext,
  drawMonsterSlot, openMonsterPicker, showFusionAnimation, showResultToast,
} from './FusionTabs';

export interface AbsorptionState {
  absorbTarget: OwnedMonster | null;
  absorbSacrifices: OwnedMonster[];
  readonly setAbsorbTarget: (m: OwnedMonster | null) => void;
  readonly setAbsorbSacrifices: (list: OwnedMonster[]) => void;
}

export function buildAbsorptionTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  state: AbsorptionState,
): void {
  const slotW = 80, slotH = 90;
  const PAD   = 18;
  let   y     = ctx.contentY + 240;

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y - 22, '희생 몬스터 → XP 전환  |  같은 종류: +5% ATK 스택', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
    align: 'center', wordWrap: { width: CANVAS_WIDTH - 40 },
  }).setOrigin(0.5));

  // Target (베이스) slot
  c.add(ctx.scene.add.text(PAD + slotW / 2, y - 6, '베이스', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#cc8844',
  }).setOrigin(0.5));
  drawMonsterSlot(ctx, c, PAD, y, slotW, slotH, state.absorbTarget, '흡수', () => {
    openMonsterPicker(ctx, undefined, (m) => {
      state.setAbsorbTarget(m);
      ctx.refreshTab();
    });
  });

  // Sacrifice slots
  const sacrificeX = PAD + slotW + 18;
  c.add(ctx.scene.add.text(sacrificeX, y - 6, '희생 (최대 5)', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#885533',
  }));

  const maxSacs = 5;
  const sacW = 56, sacH = 70;
  const sacGap = 8;
  for (let i = 0; i <= Math.min(state.absorbSacrifices.length, maxSacs - 1); i++) {
    const sx = sacrificeX + i * (sacW + sacGap);
    if (sx + sacW > CANVAS_WIDTH - PAD) break;
    const sac = state.absorbSacrifices[i] ?? null;

    if (sac) {
      const sg = ctx.scene.add.graphics();
      sg.fillStyle(0x200a00, 1);
      sg.fillRoundedRect(sx, y, sacW, sacH, 5);
      sg.lineStyle(1.5, 0xcc8844, 0.7);
      sg.strokeRoundedRect(sx, y, sacW, sacH, 5);
      c.add(sg);
      c.add(ctx.scene.add.text(sx + sacW / 2, y + sacH / 2 - 10, getMonsterEmoji(sac.id), {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5));
      const rarityVal = sac.rarity ?? getMonsterRarity(sac.id);
      const xpVal = RARITY_XP_VALUES[rarityVal] ?? 30;
      c.add(ctx.scene.add.text(sx + sacW / 2, y + sacH - 12, `+${xpVal} XP`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#cc8844',
      }).setOrigin(0.5));
      const xBtn = ctx.scene.add.text(sx + sacW - 3, y + 3, '×', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#aa4422',
      }).setOrigin(1, 0).setInteractive();
      const fi = i;
      xBtn.on('pointerdown', () => {
        const next = [...state.absorbSacrifices];
        next.splice(fi, 1);
        state.setAbsorbSacrifices(next);
        ctx.refreshTab();
      });
      c.add(xBtn);
    } else if (state.absorbSacrifices.length < maxSacs) {
      const sg = ctx.scene.add.graphics();
      sg.fillStyle(0x0d0600, 1);
      sg.fillRoundedRect(sx, y, sacW, sacH, 5);
      sg.lineStyle(1, 0x331a00, 0.8);
      sg.strokeRoundedRect(sx, y, sacW, sacH, 5);
      c.add(sg);
      c.add(ctx.scene.add.text(sx + sacW / 2, y + sacH / 2, '+', {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#331a00',
      }).setOrigin(0.5));
      const addZone = ctx.scene.add.zone(sx, y, sacW, sacH).setOrigin(0).setInteractive();
      addZone.on('pointerdown', () => {
        const currentTarget = state.absorbTarget;
        openMonsterPicker(
          ctx,
          currentTarget ? (m: OwnedMonster) => m.id !== currentTarget.id : undefined,
          (m) => {
            state.setAbsorbSacrifices([...state.absorbSacrifices, m]);
            ctx.refreshTab();
          },
        );
      });
      c.add(addZone);
    }
  }

  y += slotH + 14;

  // XP preview
  if (state.absorbSacrifices.length > 0 && state.absorbTarget) {
    let totalXP = 0;
    let sameTypeCount = 0;
    for (const sac of state.absorbSacrifices) {
      const r = sac.rarity ?? getMonsterRarity(sac.id);
      totalXP += RARITY_XP_VALUES[r] ?? 30;
      if (getBaseId(sac.id) === getBaseId(state.absorbTarget.id)) sameTypeCount++;
    }
    const currentStacks = state.absorbTarget.absorptionStacks ?? 0;
    const newStacks     = Math.min(currentStacks + sameTypeCount, 10);
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y,
      `XP 획득: +${totalXP}  /  같은 종류 보너스: ${currentStacks}스택 → ${newStacks}스택`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc8844', align: 'center',
        wordWrap: { width: CANVAS_WIDTH - 40 },
      }).setOrigin(0.5));
    if (sameTypeCount > 0) {
      c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y + 18, `ATK +${newStacks * 5}% (스택 ×${newStacks})`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#ffaa44',
      }).setOrigin(0.5));
    }
    y += 40;
  }

  // Execute button
  const canExec = state.absorbTarget !== null && state.absorbSacrifices.length > 0;
  const btn = ctx.scene.add.text(CANVAS_WIDTH / 2, y + 10, canExec ? '🍴 흡수 실행' : '슬롯을 채우세요', {
    fontFamily: 'Georgia, serif', fontSize: '15px',
    color: canExec ? '#cc8844' : '#553322', fontStyle: 'bold',
    backgroundColor: canExec ? '#2a1400' : '#0d0800',
    padding: { x: 28, y: 10 },
  }).setOrigin(0.5);
  if (canExec) btn.setInteractive().on('pointerdown', () => {
    ctx.scene.tweens.add({ targets: btn, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
    executeAbsorption(ctx, state);
  });
  c.add(btn);

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50,
    '같은 속성 희생 시 ATK 스택 +5% (최대 ×10)', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#553322',
    }).setOrigin(0.5));
}

function executeAbsorption(ctx: FusionTabContext, state: AbsorptionState): void {
  const target = state.absorbTarget;
  if (!target || state.absorbSacrifices.length === 0) return;

  const gs = loadGameState();
  let totalXP = 0;
  let sameTypeCount = 0;

  for (const sac of state.absorbSacrifices) {
    const r = sac.rarity ?? getMonsterRarity(sac.id);
    totalXP += RARITY_XP_VALUES[r] ?? 30;
    if (getBaseId(sac.id) === getBaseId(target.id)) sameTypeCount++;
    const idx = gs.ownedMonsters.findIndex(m => m.id === sac.id && m !== target);
    if (idx >= 0) gs.ownedMonsters.splice(idx, 1);
  }

  const tgt = gs.ownedMonsters.find(m => m.id === target.id);
  if (tgt) {
    addXp(tgt, totalXP);
    const newStacks = Math.min((tgt.absorptionStacks ?? 0) + sameTypeCount, 10);
    tgt.absorptionStacks = newStacks;
    logger.debug(`[ABSORB] ${target.id}: +${totalXP} XP, stacks: ${newStacks}/10 (+5% ATK per stack)`);
  }

  updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
  saveGameState(gs);

  state.setAbsorbSacrifices([]);
  state.setAbsorbTarget(null);
  showFusionAnimation(ctx, '흡수', () => {
    ctx.refreshTab();
    const stackMsg = sameTypeCount > 0 ? ` · ATK 스택 +${sameTypeCount}` : '';
    showResultToast(ctx, `흡수 완료! +${totalXP} XP${stackMsg}`, '#cc8844');
  });
}
