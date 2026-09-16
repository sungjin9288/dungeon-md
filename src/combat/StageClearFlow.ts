// ─── StageClearFlow ───────────────────────────────────────────────────────────
// Handles the animated stage-clear overlay after each chapter is beaten.
// Full-game-clear (stageNumber 90, Ch9 finale) delegates immediately to GameCompleteFlow.

import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import {
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
} from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { MATERIAL_DEFS } from '../data/fusion';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { getMonsterAtk } from '../data/barracks';
import { loadGameState, saveGameState } from '../data/wisdom';
import { applyClearRewards } from '../data/clearRewards';
import { recordClear, STAGE_CONFIGS } from '../data/stageProgress';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';
import { popIn } from '../ui/motion';
import type { ResultFlowContext } from './ResultFlow';
import { showGameComplete } from './GameCompleteFlow';
import { projectBattleResultCallout } from '../data/battleResultCallout';
import { addBattleCalloutRow } from '../ui/HomeResultOverlays';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { getReducedMotion } from '../utils/reducedMotion';

type AlphaTarget = { setAlpha(value: number): unknown };

function revealAlpha(
  scene: Phaser.Scene,
  targets: AlphaTarget | AlphaTarget[],
  duration: number,
  delay = 0,
): void {
  if (getReducedMotion()) {
    (Array.isArray(targets) ? targets : [targets]).forEach(target => target.setAlpha(1));
    return;
  }
  scene.tweens.add({ targets, alpha: 1, duration, delay });
}

// ── showChapterClear ──────────────────────────────────────────────────────────

export function showChapterClear(ctx: ResultFlowContext): void {
  const scene = ctx.scene;
  audioManager.playSfx('victory');
  const baseCrystals = 5 + ctx.wisdomBonuses.crystalPerWave;
  const crystals     = Math.round(baseCrystals * ctx.wisdomBonuses.crystalEarnMult);
  const stars        = ctx.dungeonHp / ctx.maxHp > 0.8 ? 3
                     : ctx.dungeonHp / ctx.maxHp > 0.4 ? 2 : 1;
  scene.registry.set('soulCrystals', crystals);

  // Persist all clear rewards immutably
  const gs = loadGameState();
  const stageCfg = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  const stageNum = stageCfg?.stageNumber;
  const hpPercent = Math.round((ctx.dungeonHp / ctx.maxHp) * 100);

  const updated = applyClearRewards(gs, {
    earnedCrystals: crystals,
    stageNumber: stageNum,
    stars,
    hpPercent,
    dailyMode: ctx.dailyMode,
    weeklyBossMode: ctx.weeklyBossMode,
  });
  // Pass stageNum as amount so complete_stage objectives like target=73
  // are satisfied immediately on clearing that specific stage.
  // Invasion battles have no stageNumber and must not tick complete_stage.
  const finalGs = stageNum !== undefined
    ? ctx.tickQuestAndNotify(updated, 'complete_stage', stageNum)
    : updated;
  saveGameState(finalGs);

  // Sync to StageSelectScene's own progress key
  if (stageNum !== undefined) recordClear(stageNum - 1, stars, hpPercent);

  logger.debug(`[CHAPTER CLEAR] stars=${stars} +${crystals} soul crystals (×${ctx.wisdomBonuses.crystalEarnMult.toFixed(2)})`);

  // Full overlay
  const ov = scene.add.container(0, 0).setDepth(310);
  const returnCallout = ctx.returnTo
    ? projectBattleResultCallout({
      outcome: { won: true },
      slots: ctx.dungeonTrapSlots,
      recentStartHps: ctx.waveStartSlotHps,
    })
    : null;

  const dim = scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.72);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  revealAlpha(scene, dim, 180);

  // Card — extra height for monster level chips row
  const cw = 320, ch = returnCallout ? 430 : 360;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;
  const card = addFramedPanel(scene, {
    x: cx,
    y: cy,
    w: cw,
    h: ch,
    radius: 9,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.IRON,
    accentColor: DUNGEON_UI.BRASS,
    accentAlpha: 0.92,
    shadowOpacity: 0.72,
    shadowOffsetY: 5,
  });
  const cardObjects = [card.shadow, card.panel, card.glow];
  if (getReducedMotion()) cardObjects.forEach(obj => obj.setAlpha(1));
  else {
    cardObjects.forEach(obj => obj.setY(-60).setAlpha(0));
    scene.tweens.add({ targets: cardObjects, y: 0, alpha: 1, duration: 260, ease: 'Power2.easeOut' });
  }
  ov.add(cardObjects);

  const chLabel = `${ctx.stageChapter}장`;

  // Game complete: stage 90 (true final stage of Ch9 — void_sovereign).
  // Ch8 stage 80 now falls through to the normal "8장 클리어" chapter-clear path.
  const stageCfgX = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  if (stageCfgX?.stageNumber === 90) {
    scene.time.delayedCall(200, () => showGameComplete(ctx));
    return;
  }
  const clearTitle = ctx.dailyMode
    ? `${ctx.dailyMode.name} · 작전 완료`
    : ctx.weeklyBossMode
    ? `${ctx.weeklyBossMode.name} · 격파`
    : ctx.returnTo
    ? '침공 방어 성공'
    : `${chLabel} 전선 확보`;
  const title = scene.add.text(CANVAS_WIDTH / 2, cy + 32, clearTitle, {
    fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(title);
  revealAlpha(scene, title, 180, 80);

  // Animated star pop — 3 individual stars with staggered Back.easeOut
  const starSpacing = 28;
  for (let si = 0; si < 3; si++) {
    const isFilled = si < stars;
    const starT = scene.add.text(
      CANVAS_WIDTH / 2 + (si - 1) * starSpacing,
      cy + 78,
      isFilled ? '★' : '☆',
      { fontFamily: 'sans-serif', fontSize: '26px',
        color: isFilled ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED },
    ).setOrigin(0.5).setScale(0).setAlpha(0);
    ov.add(starT);
    // Gated pop (snaps to final state under prefers-reduced-motion).
    popIn(scene, starT, { duration: 160, delay: 100 + si * 40 });
  }

  const crystalT = scene.add.text(CANVAS_WIDTH / 2, cy + 120, `영혼 결정체 · +${crystals}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(crystalT);
  revealAlpha(scene, crystalT, 180, 150);

  // Daily dungeon reward line
  if (ctx.dailyMode) {
    const dailyCrystals = ctx.dailyMode.rewards.crystals;
    const dailyT = scene.add.text(CANVAS_WIDTH / 2, cy + 148, `일일 보상  +${dailyCrystals} 💠  재료 ×${ctx.dailyMode.rewards.materials.length}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(dailyT);
    revealAlpha(scene, dailyT, 180, 180);
  }

  // Stats row: gold + kills + waves
  const contentOffset = ctx.dailyMode ? 20 : 0;
  const statsStr = `황금 ${ctx.gold} · 격퇴 ${ctx.killsThisRun} · 침입 ${ctx.wave}`;
  const killT = scene.add.text(CANVAS_WIDTH / 2, cy + 152 + contentOffset, statsStr, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(killT);
  revealAlpha(scene, killT, 180, 180);

  // Materials earned this run
  const matEntries = Object.entries(ctx.materialsEarnedThisRun).filter(([, q]) => q > 0);
  if (matEntries.length > 0) {
    const matStr = '획득 재료: ' + matEntries.map(([id, q]) => {
      const def = MATERIAL_DEFS[id];
      return `${def?.emoji ?? '?'} ${def?.name ?? id} ×${q}`;
    }).join('  ');
    const matT = scene.add.text(CANVAS_WIDTH / 2, cy + 170 + contentOffset, matStr, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(matT);
    revealAlpha(scene, matT, 180, 210);
  }

  // Monster level chips ("수호자 성장")
  const gs3 = loadGameState();
  const activeMonsters = gs3.ownedMonsters.filter(m => {
    // show only monsters that are actually in dungeon slots
    return gs3.dungeonSlots?.some(s => s?.monsterIds?.includes(m.id));
  });
  const chipsSource = activeMonsters.length > 0 ? activeMonsters : gs3.ownedMonsters.slice(0, 3);
  if (chipsSource.length > 0) {
    const visibleChips = chipsSource.slice(0, 4);
    const chipRowY = cy + 182 + contentOffset;
    const chipW = Math.min(80, Math.floor((cw - 32) / visibleChips.length) - 4);
    const totalChipW = visibleChips.length * (chipW + 4) - 4;
    const chipStartX = cx + (cw - totalChipW) / 2;
    visibleChips.forEach((m, mi) => {
      const def = resolveOwnedMonsterProfile(m.id);
      const atk = def ? getMonsterAtk(def.baseDamage, m.level, m.spentSkills) : 0;
      const cx2 = chipStartX + mi * (chipW + 4);
      const chipBg = scene.add.graphics().setAlpha(0);
      chipBg.fillStyle(DUNGEON_UI.SOOT, 1);
      chipBg.fillRoundedRect(cx2, chipRowY, chipW, 32, 5);
      chipBg.lineStyle(1, DUNGEON_UI.EDGE, 0.75);
      chipBg.strokeRoundedRect(cx2, chipRowY, chipW, 32, 5);
      ov.add(chipBg);
      const nameLine = def?.name ? def.name.slice(0, 4) : m.id.slice(0, 4);
      const chipT = scene.add.text(cx2 + chipW / 2, chipRowY + 7, `${nameLine}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(chipT);
      const lvT = scene.add.text(cx2 + chipW / 2, chipRowY + 18, `Lv.${m.level} · ATK ${atk}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(lvT);
      const delay = 220 + mi * 40;
      revealAlpha(scene, [chipBg, chipT, lvT], 160, delay);
    });
  }

  // Divider
  const baseDivY = (chipsSource.length > 0 ? cy + 220 : cy + 178) + contentOffset;
  if (returnCallout) {
    addBattleCalloutRow(scene, ov, returnCallout, cx + 20, baseDivY, cw - 40, 56);
  }
  const divY = baseDivY + (returnCallout ? 64 : 0);
  const divG = scene.add.graphics();
  divG.lineStyle(1, DUNGEON_UI.EDGE, 0.55);
  divG.lineBetween(cx + 20, divY, cx + cw - 20, divY);
  divG.setAlpha(0);
  ov.add(divG);
  revealAlpha(scene, divG, 180, 220);

  // Buttons
  const goldEarned = ctx.gold;
  const curStageCfg = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  const curStageNum = curStageCfg?.stageNumber;
  const nextCfg = (curStageNum !== undefined && !ctx.returnTo)
    ? STAGE_CONFIGS[curStageNum]
    : undefined;

  const launchNext = () => {
    if (!nextCfg) return;
    scene.registry.set('stageConfig', nextCfg);
    const cinematicId = STAGE_CINEMATICS[nextCfg.stageNumber];
    if (cinematicId) {
      const gs2 = loadGameState();
      const seen = gs2.cinematicSeen ?? [];
      if (!seen.includes(cinematicId)) {
        ov.destroy();
        scene.scene.stop('UIScene');
        scene.scene.start('CinematicScene', { cinematicId, nextScene: 'DungeonScene' });
        return;
      }
    }
    ov.destroy();
    scene.scene.stop('UIScene');
    scene.scene.start('DungeonScene');
  };

  const btnData: Array<{ label: string; action: () => void; enabled: boolean }> = [
    // Invasion battles (returnTo set) have no next-stage concept — show only the return button.
    ...(ctx.returnTo ? [] : [{
      label: nextCfg ? `다음 관문 · 스테이지 ${nextCfg.stageNumber}` : '모든 전선 확보 완료',
      action: nextCfg ? launchNext : () => {},
      enabled: !!nextCfg,
    }]),
    {
      label: ctx.returnTo ? '던전으로 귀환 · 방어선 확인' : '침공 전선으로',
      action: () => {
        if (ctx.returnTo) {
          scene.registry.set('battleResult', {
            won: true,
            goldEarned,
            dmXP: 150,
            materialsEarned: { ...ctx.materialsEarnedThisRun },
            ...(returnCallout ? { callout: returnCallout } : {}),
          });
          ov.destroy();
          scene.scene.stop('UIScene');
          scene.scene.start(ctx.returnTo);
        } else {
          ov.destroy();
          scene.scene.stop('UIScene');
          scene.scene.start('StageSelectScene');
        }
      },
      enabled: true,
    },
  ];
  btnData.forEach(({ label, action, enabled }, i) => {
    const btnY = divY + 18 + i * 52;
    const bw = cw - 40, bh = 44, bx = cx + 20;
    const isPrimary = enabled && i === 0;
    const capColor  = !enabled ? DUNGEON_UI.SOOT : i === 0 ? DUNGEON_UI.JADE : DUNGEON_UI.STONE_RAISED;
    const baseColor = !enabled ? DUNGEON_UI.IRON : i === 0 ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE;
    const button = addPrimaryActionButton(scene, {
      x: bx,
      y: btnY,
      w: bw,
      h: bh,
      label,
      fontSize: '13px',
      enabled,
      fillColor: capColor,
      hoverFillColor: isPrimary ? 0x5aad86 : DUNGEON_UI.IRON,
      borderColor: baseColor,
      hoverBorderColor: isPrimary ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.BRASS,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      textColor: isPrimary ? '#ffffff' : DUNGEON_UI_CSS.TEXT,
      disabledTextColor: DUNGEON_UI_CSS.MUTED,
      showArrow: isPrimary,
      once: true,
      onPress: action,
    });
    button.bg.setAlpha(0);
    button.text.setAlpha(0);
    if (enabled) button.zone.disableInteractive();
    ov.add([button.bg, button.text, button.zone]);

    const revealDelay = 260 + i * 60;
    revealAlpha(scene, [button.bg, button.text], 220, revealDelay);
    if (enabled) {
      if (getReducedMotion()) button.zone.setInteractive({ useHandCursor: true });
      else scene.time.delayedCall(revealDelay, () => {
        if (button.zone.scene) button.zone.setInteractive({ useHandCursor: true });
      });
    }
  });
}
