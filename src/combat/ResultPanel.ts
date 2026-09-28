// ─── Result Panel ─────────────────────────────────────────────────────────────
// Builds the wave-clear / wave-fail overlay card shown to the player after
// each combat round ends. Extracted from ResultFlow.ts so that the flow
// orchestration (showWaveClear, triggerWaveFail) stays readable without the
// 250-line UI builder buried inside it.
//
// Also owns revive() and resetStage() — they are only ever called from
// buildFailContent, so housing them here avoids a circular import
// (ResultFlow → ResultPanel → ResultFlow).
//
// Public exports:
//   showResultPanel  — entry point; delegates to success or fail builder
//   revive           — gem/ad revive (called by fail-panel action)
//   resetStage       — full stage reset (called by fail-panel action)

import { STAGE_DEFEAT_DM_XP, applyBattleReturnSettlement } from '../data/invasionTransactions';
import { loadGameState, saveGameState } from '../data/wisdom';
import Phaser from 'phaser';
import {
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
} from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { MATERIAL_DEFS } from '../data/fusion';
import { enableWaveButton } from './WaveLifecycle';
import type { ResultFlowContext } from './ResultFlow';
import { logger } from '../utils/logger';
import { projectBattleResultCallout, type BattleResultCallout } from '../data/battleResultCallout';
import { addBattleCalloutRow } from '../ui/HomeResultOverlays';
import { getReducedMotion } from '../utils/reducedMotion';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';

type ResultActionTone = 'primary' | 'secondary' | 'danger' | 'arcane';

function addResultAction(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  options: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h?: number;
    readonly label: string;
    readonly tone: ResultActionTone;
    readonly revealDelay?: number;
    readonly onPress: () => void;
  },
): void {
  const { x, y, w, h = 44, label, tone, revealDelay = 0, onPress } = options;
  const textColor = tone === 'primary' ? '#ffffff'
    : tone === 'danger' ? DUNGEON_UI_CSS.EMBER
      : tone === 'arcane' ? CASUAL_CSS.PURPLE
        : DUNGEON_UI_CSS.TEXT;
  const fillColor = tone === 'primary' ? DUNGEON_UI.JADE : DUNGEON_UI.SOOT;
  const borderColor = tone === 'primary' ? DUNGEON_UI.JADE
    : tone === 'danger' ? DUNGEON_UI.EMBER
      : tone === 'arcane' ? CASUAL.PURPLE
        : DUNGEON_UI.EDGE;
  const button = addPrimaryActionButton(scene, {
    x, y, w, h, label,
    fontSize: '13px',
    fillColor,
    hoverFillColor: tone === 'primary' ? 0x5aad86 : DUNGEON_UI.STONE_RAISED,
    borderColor,
    hoverBorderColor: borderColor,
    textColor,
    showArrow: tone === 'primary',
    once: true,
    onPress,
  });
  button.bg.setAlpha(0);
  button.text.setAlpha(0);
  button.zone.disableInteractive();
  container.add([button.bg, button.text, button.zone]);

  const reveal = (): void => {
    if (!button.zone.scene) return;
    if (getReducedMotion()) [button.bg, button.text].forEach(obj => obj.setAlpha(1));
    else scene.tweens.add({ targets: [button.bg, button.text], alpha: 1, duration: 180, ease: 'Quad.easeOut' });
    button.zone.setInteractive({ useHandCursor: true });
  };
  if (getReducedMotion()) reveal();
  else scene.time.delayedCall(revealDelay, reveal);
}

// ─── showResultPanel ──────────────────────────────────────────────────────────

export function showResultPanel(ctx: ResultFlowContext, isFail: boolean, reward: number, stars: number): void {
  const scene = ctx.scene;
  if (ctx.resultOverlay) ctx.resultOverlay.destroy();
  const ov = scene.add.container(0, 0).setDepth(300);
  ctx.setResultOverlay(ov);
  const failCallout = isFail && ctx.returnTo
    ? projectBattleResultCallout({
      outcome: { won: false },
      slots: ctx.dungeonTrapSlots,
      recentStartHps: ctx.waveStartSlotHps,
    })
    : null;

  // Compute wave stat summary
  const damagedCount  = ctx.dungeonTrapSlots.filter(
    (s, i) => s && (ctx.waveStartSlotHps[i] ?? s.hp) > s.hp,
  ).length;
  const destroyedCount = ctx.dungeonTrapSlots.filter(s => s && s.hp <= 0).length;

  // Dim overlay
  const dim = scene.add.graphics();
  dim.fillStyle(isFail ? DUNGEON_UI.EMBER : DUNGEON_UI.VOID, isFail ? 0.32 : 0.68);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 400 });

  // Card — taller to fit stats
  const cw     = 300;
  // Fail: dynamic height based on option count; Success: dynamic based on materials
  const matEntries = Object.entries(ctx.materialsEarnedThisRun ?? {}).filter(([, q]) => q > 0);
  const matRowCount = Math.min(Math.ceil(matEntries.length / 3), 2);
  const failOptionCount = FAIL_OPTION_COUNT; // retreat + ad + gems + reset
  const ch     = isFail
    ? 140 + failOptionCount * 54 + (failCallout ? 40 : 0)
    : 350 + matRowCount * 36;
  const cx     = CANVAS_WIDTH  / 2 - cw / 2;
  const cy     = CANVAS_HEIGHT / 2 - ch / 2;

  const card = addFramedPanel(scene, {
    x: cx,
    y: cy,
    w: cw,
    h: ch,
    radius: 9,
    fillColor: DUNGEON_UI.STONE,
    borderColor: isFail ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON,
    accentColor: isFail ? DUNGEON_UI.EMBER : DUNGEON_UI.BRASS,
    accentAlpha: 0.92,
    shadowOpacity: 0.72,
    shadowOffsetY: 5,
  });
  const cardObjects = [card.shadow, card.panel, card.glow];
  cardObjects.forEach(obj => obj.setY(-120).setAlpha(0));
  ov.add(cardObjects);
  scene.tweens.add({ targets: cardObjects, y: 0, alpha: 1, duration: 350, ease: 'Power2.easeOut' });

  const title      = isFail ? '방어선 붕괴' : '침입자 격퇴';
  const titleColor = isFail ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.BRASS;
  const titleT = scene.add.text(CANVAS_WIDTH / 2, cy + 30, title, {
    fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold', color: titleColor,
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(titleT);
  scene.tweens.add({ targets: titleT, alpha: 1, duration: 300, delay: 200 });

  if (!isFail) {
    buildSuccessContent(ctx, ov, cx, cy, cw, ch, stars, reward, damagedCount, destroyedCount);
  } else {
    buildFailContent(ctx, ov, cx, cy, cw, failCallout);
  }
}

// ─── buildSuccessContent (module-private) ─────────────────────────────────────

function buildSuccessContent(
  ctx: ResultFlowContext,
  ov: Phaser.GameObjects.Container,
  cx: number, cy: number, cw: number, ch: number,
  stars: number, reward: number,
  damagedCount: number, destroyedCount: number,
): void {
  const scene = ctx.scene;

  // Stars — earned brass, empty muted stone.
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const starsT  = scene.add.text(CANVAS_WIDTH / 2, cy + 68, starStr, {
    fontFamily: 'sans-serif', fontSize: '22px', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(starsT);
  scene.tweens.add({ targets: starsT, alpha: 1, duration: 300, delay: 350 });

  // Reward
  const rewardT = scene.add.text(CANVAS_WIDTH / 2, cy + 106, `작전 보상 · 황금 +${reward}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(rewardT);
  scene.tweens.add({ targets: rewardT, alpha: 1, duration: 300, delay: 450 });

  // Wave stat row
  const statY       = cy + 138;
  const statDivider = scene.add.graphics().setAlpha(0);
  statDivider.lineStyle(1, DUNGEON_UI.EDGE, 0.55);
  statDivider.lineBetween(cx + 16, statY - 10, cx + cw - 16, statY - 10);
  ov.add(statDivider);
  scene.tweens.add({ targets: statDivider, alpha: 1, duration: 200, delay: 480 });

  const statItems = [
    { icon: '⚔',  label: '격퇴',    value: String(ctx.killsThisWave),   color: DUNGEON_UI_CSS.JADE },
    { icon: '◆',  label: '돌파',    value: String(ctx.breakthruCount),   color: ctx.breakthruCount > 0 ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED },
    { icon: '▦',  label: '손상 방', value: `${damagedCount}칸`,           color: damagedCount > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED },
    { icon: '●',  label: '획득 골드', value: `+${ctx.goldEarnedThisRun}`, color: DUNGEON_UI_CSS.BRASS },
  ];
  const colW = cw / 4;
  statItems.forEach(({ icon, label, value, color }, i) => {
    const sx = cx + colW * i + colW / 2;
    const iconT = scene.add.text(sx, statY + 4, icon, {
      fontFamily: 'sans-serif', fontSize: '16px',
    }).setOrigin(0.5).setAlpha(0);
    ov.add(iconT);
    scene.tweens.add({ targets: iconT, alpha: 1, duration: 200, delay: 520 + i * 60 });

    const valT = scene.add.text(sx, statY + 24, value, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(valT);
    scene.tweens.add({ targets: valT, alpha: 1, duration: 200, delay: 540 + i * 60 });

    const lblT = scene.add.text(sx, statY + 40, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(lblT);
    scene.tweens.add({ targets: lblT, alpha: 1, duration: 200, delay: 560 + i * 60 });
  });

  // Perfect clear bonus
  if (ctx.breakthruCount === 0 && damagedCount === 0 && destroyedCount === 0) {
    const perfectT = scene.add.text(CANVAS_WIDTH / 2, statY + 54, '완전 방어 · 피해 없음', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
      stroke: '#030504', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(perfectT);
    scene.tweens.add({
      targets: perfectT, alpha: 1,
      scaleX: { from: 0.7, to: 1 }, scaleY: { from: 0.7, to: 1 },
      duration: 350, ease: 'Back.easeOut', delay: 640,
    });
  }

  // Destroyed room warning
  if (destroyedCount > 0) {
    const warnT = scene.add.text(CANVAS_WIDTH / 2, statY + 60,
      `파손 ${destroyedCount}칸 · 던전에서 수리 필요`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.EMBER,
      backgroundColor: '#080b09', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setAlpha(0);
    ov.add(warnT);
    scene.tweens.add({ targets: warnT, alpha: 1, duration: 200, delay: 680 });
  }

  // Materials earned this wave — up to 2 rows × 3 cols (max 6)
  const matEntries = Object.entries(ctx.materialsEarnedThisRun).filter(([, q]) => q > 0);
  if (matEntries.length > 0) {
    // Section divider + header
    const matDivY = statY + 62;
    const matDiv = scene.add.graphics().setAlpha(0);
    matDiv.lineStyle(1, DUNGEON_UI.EDGE, 0.45);
    matDiv.lineBetween(cx + 16, matDivY, cx + cw - 16, matDivY);
    ov.add(matDiv);
    scene.tweens.add({ targets: matDiv, alpha: 1, duration: 200, delay: 680 });

    const matHeaderT = scene.add.text(cx + 16, matDivY + 6, '획득 재료', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setAlpha(0);
    ov.add(matHeaderT);
    scene.tweens.add({ targets: matHeaderT, alpha: 1, duration: 200, delay: 690 });

    // Material chips — 3 per row, up to 2 rows (max 6 shown)
    const COLS_PER_ROW = 3;
    const chipW = (cw - 32) / COLS_PER_ROW;
    const visibleEntries = matEntries.slice(0, 6);
    visibleEntries.forEach(([id, qty], mi) => {
      const rowIdx = Math.floor(mi / COLS_PER_ROW);
      const colIdx = mi % COLS_PER_ROW;
      const chipY  = matDivY + 22 + rowIdx * 36;
      const def    = MATERIAL_DEFS[id];
      const emoji  = def?.emoji ?? '?';
      const name   = def?.name  ?? id;
      const chipX  = cx + 16 + colIdx * chipW;

      // Material receipt row.
      const chipBg = scene.add.graphics().setAlpha(0);
      chipBg.fillStyle(DUNGEON_UI.SOOT, 1);
      chipBg.fillRoundedRect(chipX, chipY, chipW - 4, 30, 5);
      chipBg.lineStyle(1, DUNGEON_UI.BRASS, 0.65);
      chipBg.strokeRoundedRect(chipX, chipY, chipW - 4, 30, 5);
      ov.add(chipBg);
      scene.tweens.add({ targets: chipBg, alpha: 1, duration: 180, delay: 710 + mi * 50 });

      // Emoji + qty
      const chipT = scene.add.text(chipX + (chipW - 4) / 2, chipY + 8, `${emoji} ×${qty}`, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(chipT);
      scene.tweens.add({ targets: chipT, alpha: 1, duration: 180, delay: 720 + mi * 50 });

      // Material name below
      const nameT = scene.add.text(chipX + (chipW - 4) / 2, chipY + 18, name.length > 6 ? name.slice(0, 6) + '…' : name, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(nameT);
      scene.tweens.add({ targets: nameT, alpha: 1, duration: 180, delay: 730 + mi * 50 });
    });

    // If more than 6, show "+N more" hint
    if (matEntries.length > 6) {
      const lastRowChipY = matDivY + 22 + 36;
      const moreT = scene.add.text(cx + cw - 16, lastRowChipY + 10, `+${matEntries.length - 6}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(1, 0).setAlpha(0);
      ov.add(moreT);
      scene.tweens.add({ targets: moreT, alpha: 1, duration: 180, delay: 780 });
    }
  }

  const wave     = ctx.wave;
  const btnDelay = matEntries.length > 0 ? 800 + Math.min(matEntries.length, 3) * 50 : 700;
  addResultAction(scene, ov, {
    x: cx + 18,
    y: cy + ch - 104,
    w: cw - 36,
    label: '방어선 확인',
    tone: 'secondary',
    revealDelay: btnDelay,
    onPress: () => {
      ov.destroy();
      ctx.setResultOverlay(undefined);
      ctx.setPrepActive(false);
      enableWaveButton(ctx);
    },
  });

  // Starting the next invasion is the single dominant outcome action.
  if (wave < ctx.maxWave) {
    addResultAction(scene, ov, {
      x: cx + 18,
      y: cy + ch - 54,
      w: cw - 36,
      label: `다음 침입 즉시 시작 · ${wave + 1}/${ctx.maxWave}`,
      tone: 'primary',
      revealDelay: btnDelay + 300,
      onPress: () => {
        ov.destroy();
        ctx.setResultOverlay(undefined);
        ctx.setPrepActive(false);
        ctx.setPrepTimer(0);
        ctx.countdownBar?.clear();
        ctx.startWave();
      },
    });
  }
}

// ─── buildFailContent (module-private) ────────────────────────────────────────

function buildFailContent(
  ctx: ResultFlowContext,
  ov: Phaser.GameObjects.Container,
  cx: number, cy: number, cw: number,
  callout: BattleResultCallout | null,
): void {
  const scene = ctx.scene;

  const failMsg = scene.add.text(CANVAS_WIDTH / 2, cy + 72, '던전이 함락되었습니다', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(failMsg);
  scene.tweens.add({ targets: failMsg, alpha: 1, duration: 300, delay: 200 });

  if (callout) {
    addBattleCalloutRow(scene, ov, callout, cx + 20, cy + 104, cw - 40, 56);
  } else {
    // Keep the generic weakest-room hint for non-return chapter flows.
    let worstIdx  = -1;
    let worstLoss = 0;
    ctx.dungeonTrapSlots.forEach((slot, i) => {
      if (!slot || slot.maxHp <= 0) return;
      const max     = slot.maxHp;
      const startHp = ctx.waveStartSlotHps[i] ?? max;
      const loss    = (startHp - slot.hp) / max;
      if (loss > worstLoss) { worstLoss = loss; worstIdx = i; }
    });
    if (worstIdx >= 0 && worstLoss > 0.05) {
      const wRow   = Math.floor(worstIdx / ctx.effectiveCols) + 1;
      const wCol   = worstIdx % ctx.effectiveCols + 1;
      const dmgPct = Math.round(worstLoss * 100);
      const hintT  = scene.add.text(CANVAS_WIDTH / 2, cy + 93,
        `취약 지점 · ${wRow}행 ${wCol}열 · 피해 ${dmgPct}%`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.EMBER,
        stroke: '#030504', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      ov.add(hintT);
      scene.tweens.add({ targets: hintT, alpha: 1, duration: 300, delay: 350 });
    }
  }

  const options = buildFailOptions(ctx, ov, callout);

  options.forEach(({ label, action, tone, keepPanel, canDismiss }, i) => {
    const oy = cy + (callout ? 190 : 145) + i * 54;
    addResultAction(scene, ov, {
      x: cx + 20,
      y: oy - 22,
      w: cw - 40,
      label,
      tone,
      revealDelay: 220 + i * 70,
      onPress: () => {
        if (!keepPanel && (canDismiss?.() ?? true)) {
          ov.destroy();
          ctx.setResultOverlay(undefined);
        }
        action();
      },
    });
  });
}

// ─── buildFailOptions ─────────────────────────────────────────────────────────

export interface FailOption {
  label: string;
  action: () => void;
  tone: ResultActionTone;
  keepPanel?: boolean;
  canDismiss?: () => boolean;
}

/** Retreat home to reinforce is always offered; a lost campaign stage had none. */
export const FAIL_OPTION_COUNT = 4;

export function buildFailOptions(
  ctx: ResultFlowContext,
  ov: Phaser.GameObjects.Container,
  callout: BattleResultCallout | null,
): FailOption[] {
  const scene = ctx.scene;
  const retreat = (): void => {
    const materialsEarned = { ...ctx.materialsEarnedThisRun };
    if (ctx.returnTo) {
      scene.registry.set('battleResult', {
        won: false, goldEarned: ctx.gold, dmXP: STAGE_DEFEAT_DM_XP, materialsEarned,
        ...(callout ? { callout } : {}),
      });
    } else {
      // A campaign stage has no Home hand-off: settle here, and not as a
      // story-invasion defense.
      const settled = applyBattleReturnSettlement(loadGameState(), {
        won: false, goldEarned: ctx.gold, dmXP: STAGE_DEFEAT_DM_XP, materialsEarned,
      }, { defendInvasion: false, now: Date.now() });
      try {
        if (settled.changed) saveGameState(settled.state);
      } catch (error: unknown) {
        logger.warn('[RESULT] stage retreat save failed', error);
        scene.registry.set('status', '저장 실패 · 다시 시도해주세요');
        return;
      }
    }
    ov.destroy();
    scene.scene.stop('UIScene');
    scene.scene.start(ctx.returnTo ?? 'DungeonHomeScene');
  };
  return [
    { label: '던전으로 귀환 · 방어선 보강', tone: 'primary', action: retreat },
    { label: '광고 확인 후 부활', tone: 'secondary', action: () => revive(ctx, 0) },
    {
      label: '보석 5개로 부활',
      tone: 'arcane',
      canDismiss: () => ctx.gems >= 5,
      action: () => revive(ctx, 5),
    },
    {
      label: '처음부터 재정비',
      tone: 'danger',
      keepPanel: true,
      action: () => confirmReset(ctx, ov),
    },
  ];
}

// ─── revive ───────────────────────────────────────────────────────────────────

export function revive(ctx: ResultFlowContext, gemCost: number): void {
  if (gemCost > 0 && ctx.gems < gemCost) {
    ctx.scene.registry.set('status', '보석 부족!');
    return;
  }
  if (gemCost > 0) {
    ctx.setGems(ctx.gems - gemCost);
  } else {
    logger.debug('[AD] watch_ad triggered');
  }
  ctx.setDungeonHp(Math.round(ctx.maxHp * 0.5));
  ctx.setWaveEndChecked(false);
  ctx.setWave(ctx.wave - 1); // pre-decrement so startWave's ++ lands on the same wave
  ctx.startWave();
}

// ─── confirmReset ─────────────────────────────────────────────────────────────

function confirmReset(ctx: ResultFlowContext, failOv: Phaser.GameObjects.Container): void {
  const scene = ctx.scene;
  const OW = 280, OH = 180;
  const OX = (CANVAS_WIDTH  - OW) / 2;
  const OY = (CANVAS_HEIGHT - OH) / 2;

  // This confirmation must sit above the still-live fail panel so its cancel
  // target cannot fall through to a revive action underneath.
  const ov = scene.add.container(0, 0).setDepth(320).setAlpha(0);

  const dim = scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.72);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);
  // Consume all pointer input so taps outside the modal cannot reach the live
  // revive/reset zones on the fail panel underneath.
  ov.add(scene.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT).setInteractive());

  const frame = addFramedPanel(scene, {
    x: OX,
    y: OY,
    w: OW,
    h: OH,
    radius: 9,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.EMBER,
    borderAlpha: 0.95,
    accentColor: DUNGEON_UI.EMBER,
    accentAlpha: 0.9,
    shadowOpacity: 0.7,
    shadowOffsetY: 5,
  });
  ov.add([frame.shadow, frame.panel, frame.glow]);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 32, '전투 재설정', {
    fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: DUNGEON_UI_CSS.EMBER,
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0.5));
  ov.add(scene.add.text(CANVAS_WIDTH / 2, OY + 73, '현재 웨이브 진행과 획득 골드를 버리고\n이 스테이지를 처음부터 다시 시작합니다.', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
    align: 'center',
  }).setOrigin(0.5));

  const cbW = 108, cbH = 44;
  const cbX = CANVAS_WIDTH / 2 - 58 - cbW / 2, cbY = OY + OH - 56;
  const confirm = addPrimaryActionButton(scene, {
    x: cbX,
    y: cbY,
    w: cbW,
    h: cbH,
    label: '처음부터',
    fontSize: '13px',
    fillColor: DUNGEON_UI.SOOT,
    hoverFillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.EMBER,
    hoverBorderColor: DUNGEON_UI.EMBER,
    textColor: DUNGEON_UI_CSS.EMBER,
    showArrow: false,
    once: true,
    onPress: () => {
      ov.destroy(true);
      failOv.destroy(true);
      ctx.setResultOverlay(undefined);
      resetStage(ctx);
    },
  });
  ov.add([confirm.bg, confirm.text, confirm.zone]);

  const xbX = CANVAS_WIDTH / 2 + 58 - cbW / 2, xbY = cbY;
  const cancel = addPrimaryActionButton(scene, {
    x: xbX,
    y: xbY,
    w: cbW,
    h: cbH,
    label: '전투 유지',
    fontSize: '13px',
    fillColor: DUNGEON_UI.STONE_RAISED,
    hoverFillColor: DUNGEON_UI.IRON,
    borderColor: DUNGEON_UI.EDGE,
    hoverBorderColor: DUNGEON_UI.BRASS,
    textColor: DUNGEON_UI_CSS.TEXT,
    showArrow: false,
    once: true,
    onPress: () => ov.destroy(true),
  });
  ov.add([cancel.bg, cancel.text, cancel.zone]);

  scene.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
}

// ─── resetStage ───────────────────────────────────────────────────────────────

export function resetStage(ctx: ResultFlowContext): void {
  ctx.setWave(0);
  ctx.setDungeonHp(ctx.maxHp);
  ctx.setGold(0);
  ctx.activeInvaders.length = 0;
  ctx.setWaveEndChecked(false);
  enableWaveButton(ctx);
  logger.debug('[RESET] stage reset');
}
