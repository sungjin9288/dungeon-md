import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster, addXp } from '../data/barracks';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  RARITY_STARS, RARITY_COLORS, RARITY_XP_VALUES,
  HYBRID_DEFS, COMBINATION_TABLE, AWAKENED_PASSIVES,
  getBaseId, getMonsterRarity, getMonsterEmoji, getMonsterDisplayName,
  getMonsterBaseDamage, getNextEvolution, combinationKey,
} from '../data/fusion';
import { logger } from '../utils/logger';

// ─── Shared types & constants ──────────────────────────────────────────────

const TABS = ['진화', '흡수', '조합', '각성'] as const;
export type TabId = typeof TABS[number];

export const TAB_ACCENT: Record<TabId, number> = {
  '진화': 0x44cc66, '흡수': 0xcc8844, '조합': 0x4488cc, '각성': 0xcc44cc,
};
export const TAB_ACCENT_CSS: Record<TabId, string> = {
  '진화': '#44cc66', '흡수': '#cc8844', '조합': '#4488cc', '각성': '#cc44cc',
};

/** Context object passed from FusionScene into each tab builder. */
export interface FusionTabContext {
  readonly scene: Phaser.Scene;
  readonly contentY: number;
  readonly cauldronEmoji: Phaser.GameObjects.Text | undefined;
  /** Re-renders the active tab content. */
  readonly refreshTab: () => void;
  /** Re-draws the header (e.g. after codex count changes). */
  readonly refreshHeader: () => void;
}

// ─── Shared slot drawing helpers ───────────────────────────────────────────

export function drawMonsterSlot(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  x: number, y: number, w: number, h: number,
  monster: OwnedMonster | null,
  tabId: TabId,
  onTap: () => void,
): void {
  const accent    = TAB_ACCENT[tabId];
  const accentCSS = TAB_ACCENT_CSS[tabId];
  const g = ctx.scene.add.graphics();
  c.add(g);

  if (monster) {
    g.fillStyle(0x001408, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, accent, 0.7);
    g.strokeRoundedRect(x, y, w, h, 6);

    c.add(ctx.scene.add.text(x + w / 2, y + h / 2 - 12, getMonsterEmoji(monster.id), {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(x + w / 2, y + h / 2 + 12, `Lv.${monster.level}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#669977',
    }).setOrigin(0.5));
    const rarity = monster.rarity ?? getMonsterRarity(monster.id);
    if (rarity > 0) {
      c.add(ctx.scene.add.text(x + w / 2, y + h - 12, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '8px',
      }).setOrigin(0.5));
    }
  } else {
    g.fillStyle(0x000e06, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x1a3322, 0.8);
    g.strokeRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x1a3322, 0.5);
    g.lineBetween(x + 8, y + h / 2, x + w - 8, y + h / 2);
    g.lineBetween(x + w / 2, y + 8, x + w / 2, y + h - 8);
    c.add(ctx.scene.add.text(x + w / 2, y + h / 2, '+', {
      fontFamily: 'sans-serif', fontSize: '20px', color: accentCSS,
    }).setOrigin(0.5).setAlpha(0.4));
  }

  const zone = ctx.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
  zone.on('pointerdown', onTap);
  c.add(zone);
}

function drawResultSlot(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  x: number, y: number, w: number, h: number, tabId: TabId,
): void {
  const accent = TAB_ACCENT[tabId];
  const g = ctx.scene.add.graphics();
  g.fillStyle(0x001408, 1);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(1.5, accent, 0.3);
  g.strokeRoundedRect(x, y, w, h, 6);
  c.add(g);
  c.add(ctx.scene.add.text(x + w / 2, y + h / 2, '?', {
    fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
  }).setOrigin(0.5));
}

// ─── Fusion animation helpers ──────────────────────────────────────────────

export function showFusionAnimation(
  ctx: FusionTabContext,
  tabId: TabId,
  onComplete: () => void,
): void {
  const overlay = ctx.scene.add.graphics().setDepth(60);
  overlay.fillStyle(0x000000, 0);
  overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const label = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '⚗️', {
    fontFamily: 'sans-serif', fontSize: '64px',
  }).setOrigin(0.5).setDepth(61).setAlpha(0);

  const sub = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60, '합성 중...', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: TAB_ACCENT_CSS[tabId],
  }).setOrigin(0.5).setDepth(61).setAlpha(0);

  ctx.scene.tweens.add({ targets: [label, sub], alpha: 1, duration: 300, ease: 'Quad.easeOut' });
  ctx.scene.tweens.add({ targets: label, rotation: Math.PI * 2, duration: 1200, ease: 'Linear' });
  if (ctx.cauldronEmoji) {
    ctx.scene.tweens.add({
      targets: ctx.cauldronEmoji, scaleX: 1.5, scaleY: 1.5,
      duration: 600, yoyo: true, ease: 'Back.easeOut',
    });
  }

  ctx.scene.time.delayedCall(1600, () => {
    ctx.scene.tweens.add({
      targets: [label, sub, overlay], alpha: 0, duration: 300,
      onComplete: () => { label.destroy(); sub.destroy(); overlay.destroy(); onComplete(); },
    });
  });
}

function showFailAnimation(ctx: FusionTabContext, onComplete: () => void): void {
  const smoke = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '💨', {
    fontFamily: 'sans-serif', fontSize: '64px',
  }).setOrigin(0.5).setDepth(61).setAlpha(0);
  ctx.scene.tweens.add({ targets: smoke, alpha: 1, scaleX: 1.5, scaleY: 1.5, duration: 300 });
  ctx.scene.time.delayedCall(900, () => {
    ctx.scene.tweens.add({
      targets: smoke, alpha: 0, duration: 300,
      onComplete: () => { smoke.destroy(); onComplete(); },
    });
  });
}

export function showResultToast(ctx: FusionTabContext, msg: string, color: string): void {
  const t = ctx.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, msg, {
    fontFamily: 'Georgia, serif', fontSize: '17px', color, fontStyle: 'bold',
    backgroundColor: '#001208', padding: { x: 18, y: 10 },
  }).setOrigin(0.5).setDepth(65).setAlpha(0);
  ctx.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 350, ease: 'Back.easeOut' });
  ctx.scene.time.delayedCall(1800, () => {
    ctx.scene.tweens.add({
      targets: t, alpha: 0, duration: 300,
      onComplete: () => t.destroy(),
    });
  });
}

// ─── Monster picker modal ──────────────────────────────────────────────────

export function openMonsterPicker(
  ctx: FusionTabContext,
  filter: ((m: OwnedMonster) => boolean) | undefined,
  onSelect: (m: OwnedMonster) => void,
): void {
  const gs       = loadGameState();
  const monsters = filter ? gs.ownedMonsters.filter(filter) : gs.ownedMonsters;

  const SHEET_H  = 360;
  const targetY  = CANVAS_HEIGHT - SHEET_H;
  const c        = ctx.scene.add.container(0, CANVAS_HEIGHT).setDepth(50);

  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, -CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive();
  dim.on('pointerdown', slideDown);
  c.add(dim);

  const sg = ctx.scene.add.graphics();
  sg.fillStyle(0x000e08, 1);
  sg.fillRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
  sg.lineStyle(1.5, 0x00cc66, 0.4);
  sg.strokeRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
  c.add(sg);

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, 18, '몬스터 선택', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44cc88',
  }).setOrigin(0.5));

  if (monsters.length === 0) {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, SHEET_H / 2, '조건에 맞는 몬스터 없음', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#335544',
    }).setOrigin(0.5));
  }

  const cols = 4;
  const cellW = 72, cellH = 78;
  const padX  = (CANVAS_WIDTH - cols * cellW) / (cols + 1);
  monsters.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const mx  = padX + col * (cellW + padX);
    const my  = 40 + row * (cellH + 8);

    const mg = ctx.scene.add.graphics();
    mg.fillStyle(0x001408, 1);
    mg.fillRoundedRect(mx, my, cellW, cellH, 6);
    mg.lineStyle(1, 0x003322, 0.8);
    mg.strokeRoundedRect(mx, my, cellW, cellH, 6);
    c.add(mg);

    c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH / 2 - 12, getMonsterEmoji(m.id), {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH / 2 + 8, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#44aa66',
    }).setOrigin(0.5));
    const rarity = m.rarity ?? getMonsterRarity(m.id);
    if (rarity > 0) {
      c.add(ctx.scene.add.text(mx + cellW / 2, my + cellH - 10, RARITY_STARS[rarity], {
        fontFamily: 'sans-serif', fontSize: '7px',
      }).setOrigin(0.5));
    }

    const zone = ctx.scene.add.zone(mx, my, cellW, cellH).setOrigin(0).setInteractive();
    zone.on('pointerdown', () => { slideDown(); onSelect(m); });
    c.add(zone);
  });

  let y = CANVAS_HEIGHT;
  const ti = setInterval(() => {
    y = Math.max(targetY, y - 40);
    c.setY(y);
    if (y <= targetY) clearInterval(ti);
  }, 28);

  function slideDown(): void {
    let sy = c.y;
    const td = setInterval(() => {
      sy = Math.min(CANVAS_HEIGHT, sy + 40);
      c.setY(sy);
      if (sy >= CANVAS_HEIGHT) { clearInterval(td); c.destroy(true); }
    }, 28);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TAB 1 — 진화 (Evolution)
// ─────────────────────────────────────────────────────────────────────────

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

  // 3 slots
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

  // + signs between slots
  [sx0 + slotW, sx0 + slotW * 2 + 10].forEach(px => {
    c.add(ctx.scene.add.text(px + 5, LY + slotH / 2, '+', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#335544',
    }).setOrigin(0.5));
  });

  // Result preview
  const arrowY = LY + slotH + 20;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#44cc66',
  }).setOrigin(0.5));

  const resultX = (CANVAS_WIDTH - slotW) / 2;
  const resultY = arrowY + 22;
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
        fontFamily: 'sans-serif', fontSize: '7px', color: RARITY_COLORS[rarity],
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + 76, `ATK: ${baseAtk}→${newAtk}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#44cc66',
      }).setOrigin(0.5));

      const execBtn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '✨ 진화 실행', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cc66', fontStyle: 'bold',
        backgroundColor: '#002a14', padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setInteractive();
      ctx.scene.tweens.add({
        targets: execBtn, alpha: { from: 0.8, to: 1.0 },
        duration: 800, yoyo: true, repeat: -1,
      });
      execBtn.on('pointerdown', () => executeEvolution(ctx, state));
      c.add(execBtn);
    }
  } else {
    drawResultSlot(ctx, c, resultX, resultY, slotW, slotH, '진화');
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

// ─────────────────────────────────────────────────────────────────────────
// TAB 2 — 흡수 (Absorption)
// ─────────────────────────────────────────────────────────────────────────

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
    fontFamily: 'sans-serif', fontSize: '9px', color: '#cc8844',
  }).setOrigin(0.5));
  drawMonsterSlot(ctx, c, PAD, y, slotW, slotH, state.absorbTarget, '흡수', () => {
    openMonsterPicker(ctx, undefined, (m) => {
      state.setAbsorbTarget(m);
      ctx.refreshTab();
    });
  });

  // Sacrifice slots
  let sacrificeX = PAD + slotW + 18;
  const sacrificeLabel = ctx.scene.add.text(sacrificeX, y - 6, '희생 (최대 5)', {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#885533',
  });
  c.add(sacrificeLabel);

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
        fontFamily: 'sans-serif', fontSize: '7px', color: '#cc8844',
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
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y, `XP 획득: +${totalXP}  /  같은 종류 보너스: ${currentStacks}스택 → ${newStacks}스택`, {
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
  if (canExec) btn.setInteractive().on('pointerdown', () => executeAbsorption(ctx, state));
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

// ─────────────────────────────────────────────────────────────────────────
// TAB 3 — 조합 (Combination)
// ─────────────────────────────────────────────────────────────────────────

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
  // + separator
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
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, LY + slotH + 14, `💎 보유 수정: ${gs.soulCrystals} / 필요: 100`, {
    fontFamily: 'sans-serif', fontSize: '11px',
    color: gs.soulCrystals >= 100 ? '#4488cc' : '#aa2222',
  }).setOrigin(0.5));

  // Result arrow + slot
  const arrowY  = LY + slotH + 42;
  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#4488cc',
  }).setOrigin(0.5));

  const resultX = (CANVAS_WIDTH - slotW) / 2;
  const resultY = arrowY + 22;
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
        fontFamily: 'sans-serif', fontSize: '7px', color: RARITY_COLORS[hybrid.rarity],
        wordWrap: { width: slotW - 4 },
      }).setOrigin(0.5));
    } else {
      c.add(ctx.scene.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
        fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
      }).setOrigin(0.5));
    }
  } else {
    drawResultSlot(ctx, c, resultX, resultY, slotW, slotH, '조합');
  }

  const allReady = bothFilled && gs.soulCrystals >= 100;
  const btn = ctx.scene.add.text(CANVAS_WIDTH / 2, resultY + slotH + 28,
    allReady ? '🧪 조합 시도 (-💎 100)' : bothFilled ? '💎 부족 (100 필요)' : '조건 미충족', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: allReady ? '#4488cc' : '#2a3a55', fontStyle: 'bold',
      backgroundColor: allReady ? '#001433' : '#000810',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
  if (allReady) btn.setInteractive().on('pointerdown', () => executeCombination(ctx, state));
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
    const newMonster: OwnedMonster = {
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
    showFailAnimation(ctx, () => {
      ctx.refreshTab();
      showResultToast(ctx, '이 조합은 효과가 없습니다', '#885533');
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

// ─────────────────────────────────────────────────────────────────────────
// TAB 4 — 각성 (Awakening)
// ─────────────────────────────────────────────────────────────────────────

export function buildAwakeningTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
): void {
  const gs  = loadGameState();
  const PAD = 16;
  const rowH = 70;
  const rowW = CANVAS_WIDTH - PAD * 2;
  let   y    = ctx.contentY + 238;

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y - 22,
    `친밀도 100 + 각성석 1개 → 몬스터 각성   🪨 보유: ${gs.awakeningStones ?? 0}개`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc',
    }).setOrigin(0.5));

  const monsters = gs.ownedMonsters;
  if (!monsters.length) {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y + 50, '보유 몬스터 없음', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#442244',
    }).setOrigin(0.5));
    return;
  }

  monsters.forEach((m, i) => {
    const ry       = y + i * (rowH + 6);
    const affinity = gs.monsterAffinity?.[m.id] ?? 0;
    const awakened = gs.monsterAwakened?.[m.id] ?? false;
    const stones   = gs.awakeningStones ?? 0;
    const eligible = affinity >= 100 && !awakened && stones >= 1;

    const rg = ctx.scene.add.graphics().setDepth(3);
    const borderCol = awakened ? 0xcc44cc : eligible ? 0x663366 : 0x1a0a1a;
    rg.fillStyle(0x0d040d, 1);
    rg.fillRoundedRect(PAD, ry, rowW, rowH - 4, 6);
    rg.lineStyle(1.5, borderCol, awakened ? 1 : 0.7);
    rg.strokeRoundedRect(PAD, ry, rowW, rowH - 4, 6);
    c.add(rg);

    c.add(ctx.scene.add.text(PAD + 24, ry + (rowH - 4) / 2, getMonsterEmoji(m.id), {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));

    c.add(ctx.scene.add.text(PAD + 48, ry + 10, getMonsterDisplayName(m.id), {
      fontFamily: 'Georgia, serif', fontSize: '12px',
      color: awakened ? '#cc44cc' : '#c8b090',
    }));
    c.add(ctx.scene.add.text(PAD + 48, ry + 26, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#664466',
    }));

    // Affinity bar
    const barX = PAD + 48, barY = ry + 40, barW = 120, barH = 6;
    const barBg = ctx.scene.add.graphics();
    barBg.fillStyle(0x220022, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 2);
    if (affinity > 0) {
      barBg.fillStyle(0xcc44cc, 1);
      barBg.fillRoundedRect(barX, barY, Math.round(barW * affinity / 100), barH, 2);
    }
    c.add(barBg);
    c.add(ctx.scene.add.text(barX + barW + 4, barY + 3, `${affinity}/100`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#884488',
    }).setOrigin(0, 0.5));

    // Right side: action or status
    if (awakened) {
      c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '✨ 각성 완료', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#cc44cc',
      }).setOrigin(1, 0.5));
      const ap = AWAKENED_PASSIVES[getBaseId(m.id)];
      if (ap) {
        c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2 + 14, ap.desc, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#884488',
        }).setOrigin(1, 0.5));
      }
    } else if (eligible) {
      const awakBtn = ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '⚡ 각성 실행', {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc', fontStyle: 'bold',
        backgroundColor: '#2a003a', padding: { x: 8, y: 4 },
      }).setOrigin(1, 0.5).setInteractive();
      awakBtn.on('pointerdown', () => confirmAwakening(ctx, m));
      c.add(awakBtn);
    } else {
      const reasons: string[] = [];
      if (affinity < 100) reasons.push(`친밀도 ${affinity}/100`);
      if (stones < 1)     reasons.push('각성석 필요');
      c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, reasons.join(' · '), {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#442244',
      }).setOrigin(1, 0.5));
    }
  });
}

function confirmAwakening(ctx: FusionTabContext, monster: OwnedMonster): void {
  const name = getMonsterDisplayName(monster.id);
  const ov = ctx.scene.add.container(0, 0).setDepth(80);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const PW = 300, PH = 180;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = ctx.scene.add.graphics();
  pg.fillStyle(0x0d000d, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 8);
  pg.lineStyle(2, 0xcc44cc, 0.9);
  pg.strokeRoundedRect(PX, PY, PW, PH, 8);
  ov.add(pg);

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 28, '각성 확인', {
    fontFamily: 'Georgia, serif', fontSize: '17px', color: '#cc44cc', fontStyle: 'bold',
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 60,
    `각성을 실행하면 각성석 1개가\n소모됩니다. 계속하시겠습니까?`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8b0c8',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 95, `▶ ${name}`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#884488',
  }).setOrigin(0.5));

  const confirmBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 - 52, PY + PH - 36, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc44cc',
    backgroundColor: '#2a003a', padding: { x: 22, y: 8 },
  }).setOrigin(0.5).setInteractive();
  confirmBtn.on('pointerdown', () => { ov.destroy(true); executeAwakening(ctx, monster); });
  ov.add(confirmBtn);

  const cancelBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 + 52, PY + PH - 36, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#664466',
    backgroundColor: '#150015', padding: { x: 22, y: 8 },
  }).setOrigin(0.5).setInteractive();
  cancelBtn.on('pointerdown', () => ov.destroy(true));
  ov.add(cancelBtn);

  ov.setAlpha(0);
  ctx.scene.tweens.add({ targets: ov, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
}

function executeAwakening(ctx: FusionTabContext, monster: OwnedMonster): void {
  const gs = loadGameState();
  if ((gs.awakeningStones ?? 0) < 1) return;

  gs.awakeningStones = (gs.awakeningStones ?? 0) - 1;
  gs.monsterAwakened[monster.id] = true;

  const tgt = gs.ownedMonsters.find(m => m.id === monster.id);
  if (tgt) {
    tgt.absorptionStacks = (tgt.absorptionStacks ?? 0) + 3;
  }

  saveGameState(gs);
  logger.debug(`[AWAKEN] ${monster.id} awakened! Stones remaining: ${gs.awakeningStones}`);

  showFusionAnimation(ctx, '각성', () => {
    ctx.refreshTab();
    showResultToast(ctx, `${getMonsterDisplayName(monster.id)} 각성 완료!`, '#cc44cc');
  });
}
