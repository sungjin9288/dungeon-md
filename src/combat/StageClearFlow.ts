// ─── StageClearFlow ───────────────────────────────────────────────────────────
// Handles the animated stage-clear overlay after each chapter is beaten.
// Full-game-clear (stageNumber 80) delegates immediately to GameCompleteFlow.

import { audioManager } from '../audio/AudioManager';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { MATERIAL_DEFS } from '../data/fusion';
import { MONSTER_DEFS } from '../data/monsters';
import { getMonsterAtk } from '../data/barracks';
import { loadGameState, saveGameState } from '../data/wisdom';
import { applyClearRewards } from '../data/clearRewards';
import { recordClear, STAGE_CONFIGS } from '../data/stageProgress';
import { STAGE_CINEMATICS } from '../data/cinematics';
import { logger } from '../utils/logger';
import { popIn } from '../ui/motion';
import type { ResultFlowContext } from './ResultFlow';
import { showGameComplete } from './GameCompleteFlow';

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

  const dim = scene.add.graphics();
  dim.fillStyle(CASUAL.SHADOW, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 600 });

  // Card — extra height for monster level chips row
  const cw = 320, ch = 360;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;
  const card = scene.add.graphics();
  // chunky drop shadow
  card.fillStyle(CASUAL.SHADOW, 0.22);
  card.fillRoundedRect(cx, cy + 5, cw, ch, 16);
  // cream body
  card.fillStyle(CASUAL.PANEL, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 16);
  // glossy white top highlight band
  card.fillStyle(0xffffff, 0.12);
  card.fillRoundedRect(cx + 6, cy + 6, cw - 12, 18, 8);
  // thick rounded brown border
  card.lineStyle(3, CASUAL.EDGE, 1);
  card.strokeRoundedRect(cx, cy, cw, ch, 16);
  card.setY(-60).setAlpha(0);
  ov.add(card);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 500, ease: 'Power2.easeOut', delay: 200 });

  const chLabel = `${ctx.stageChapter}장`;

  // Game complete: stage 80 (final stage of Ch8 — primordial_titan)
  const stageCfgX = scene.registry.get('stageConfig') as { stageNumber?: number } | undefined;
  if (stageCfgX?.stageNumber === 80) {
    scene.time.delayedCall(200, () => showGameComplete(ctx));
    return;
  }
  const clearTitle = ctx.dailyMode
    ? `⚔️  ${ctx.dailyMode.name}  클리어!`
    : ctx.weeklyBossMode
    ? `👑  ${ctx.weeklyBossMode.name}  격파!`
    : ctx.returnTo
    ? '🛡️  침략 방어 성공!'
    : `🎉  ${chLabel} 클리어!`;
  const title = scene.add.text(CANVAS_WIDTH / 2, cy + 32, clearTitle, {
    fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(title);
  scene.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 500 });

  // Animated star pop — 3 individual stars with staggered Back.easeOut
  const starSpacing = 28;
  for (let si = 0; si < 3; si++) {
    const isFilled = si < stars;
    const starT = scene.add.text(
      CANVAS_WIDTH / 2 + (si - 1) * starSpacing,
      cy + 78,
      isFilled ? '★' : '☆',
      { fontFamily: 'sans-serif', fontSize: '26px',
        color: isFilled ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT },
    ).setOrigin(0.5).setScale(0).setAlpha(0);
    ov.add(starT);
    // Gated pop (snaps to final state under prefers-reduced-motion).
    popIn(scene, starT, { duration: 280, delay: 650 + si * 110 });
  }

  const crystalT = scene.add.text(CANVAS_WIDTH / 2, cy + 120, `영혼 결정체  +${crystals} 💠`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(crystalT);
  scene.tweens.add({ targets: crystalT, alpha: 1, duration: 300, delay: 780 });

  // Daily dungeon reward line
  if (ctx.dailyMode) {
    const dailyCrystals = ctx.dailyMode.rewards.crystals;
    const dailyT = scene.add.text(CANVAS_WIDTH / 2, cy + 148, `일일 보상  +${dailyCrystals} 💠  재료 ×${ctx.dailyMode.rewards.materials.length}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(dailyT);
    scene.tweens.add({ targets: dailyT, alpha: 1, duration: 300, delay: 880 });
  }

  // Stats row: gold + kills + waves
  const statsStr = `💰 ${ctx.gold}골드   💀 ${ctx.killsThisRun}킬   ⚔ ${ctx.wave}웨이브`;
  const killT = scene.add.text(CANVAS_WIDTH / 2, cy + 152, statsStr, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setAlpha(0);
  ov.add(killT);
  scene.tweens.add({ targets: killT, alpha: 1, duration: 300, delay: 880 });

  // Materials earned this run
  const matEntries = Object.entries(ctx.materialsEarnedThisRun).filter(([, q]) => q > 0);
  if (matEntries.length > 0) {
    const matStr = '획득 재료: ' + matEntries.map(([id, q]) => {
      const def = MATERIAL_DEFS[id];
      return `${def?.emoji ?? '?'} ${def?.name ?? id} ×${q}`;
    }).join('  ');
    const matT = scene.add.text(CANVAS_WIDTH / 2, cy + 170, matStr, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(matT);
    scene.tweens.add({ targets: matT, alpha: 1, duration: 300, delay: 940 });
  }

  // Monster level chips ("수호자 성장")
  const gs3 = loadGameState();
  const activeMonsters = gs3.ownedMonsters.filter(m => {
    // show only monsters that are actually in dungeon slots
    return gs3.dungeonSlots?.some(s => s?.monsterIds?.includes(m.id));
  });
  const chipsSource = activeMonsters.length > 0 ? activeMonsters : gs3.ownedMonsters.slice(0, 3);
  if (chipsSource.length > 0) {
    const chipRowY = cy + 182;
    const chipW = Math.min(80, Math.floor((cw - 32) / chipsSource.length) - 4);
    const totalChipW = chipsSource.length * (chipW + 4) - 4;
    const chipStartX = cx + (cw - totalChipW) / 2;
    chipsSource.slice(0, 4).forEach((m, mi) => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      const atk = def ? getMonsterAtk(def.baseDamage, m.level, m.spentSkills) : 0;
      const cx2 = chipStartX + mi * (chipW + 4);
      const chipBg = scene.add.graphics().setAlpha(0);
      chipBg.fillStyle(CASUAL.PANEL_SOFT, 1);
      chipBg.fillRoundedRect(cx2, chipRowY, chipW, 26, 6);
      chipBg.fillStyle(0xffffff, 0.12);
      chipBg.fillRoundedRect(cx2 + 3, chipRowY + 3, chipW - 6, 3, 2);
      chipBg.lineStyle(2, CASUAL.EDGE_SOFT, 0.8);
      chipBg.strokeRoundedRect(cx2, chipRowY, chipW, 26, 6);
      ov.add(chipBg);
      const nameLine = def?.name ? def.name.slice(0, 4) : m.id.slice(0, 4);
      const chipT = scene.add.text(cx2 + chipW / 2, chipRowY + 7, `${nameLine}`, {
        fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(chipT);
      const lvT = scene.add.text(cx2 + chipW / 2, chipRowY + 16, `Lv.${m.level}  ATK ${atk}`, {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
      }).setOrigin(0.5, 0).setAlpha(0);
      ov.add(lvT);
      const delay = 950 + mi * 60;
      scene.tweens.add({ targets: [chipBg, chipT, lvT], alpha: 1, duration: 200, delay });
    });
  }

  // Divider
  const divY = chipsSource.length > 0 ? cy + 214 : cy + 178;
  const divG = scene.add.graphics();
  divG.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
  divG.lineBetween(cx + 20, divY, cx + cw - 20, divY);
  divG.setAlpha(0);
  ov.add(divG);
  scene.tweens.add({ targets: divG, alpha: 1, duration: 300, delay: 900 });

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
      label: nextCfg ? `다음 스테이지 →  (${nextCfg.stageNumber}스테이지)` : '🏆  모든 챕터 클리어!',
      action: nextCfg ? launchNext : () => {},
      enabled: !!nextCfg,
    }]),
    {
      label: ctx.returnTo ? '🏰  던전으로 귀환' : '스테이지 선택으로',
      action: () => {
        if (ctx.returnTo) {
          scene.registry.set('battleResult', { won: true, goldEarned, dmXP: 150, materialsEarned: { ...ctx.materialsEarnedThisRun } });
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
    const btnY = divY + 22 + i * 48;
    const bw = cw - 40, bh = 36, bx = cx + 20, br = 12;
    // i===0 primary green candy; i===1 secondary cream; disabled cream-muted
    const isPrimary = enabled && i === 0;
    const capColor  = !enabled ? CASUAL.PANEL_SOFT : i === 0 ? CASUAL.GREEN : CASUAL.PANEL;
    const baseColor = !enabled ? CASUAL.EDGE_SOFT  : i === 0 ? CASUAL.GREEN_DK : CASUAL.EDGE;
    const btnBg = scene.add.graphics();
    // thick colored bottom edge (candy-button base)
    btnBg.fillStyle(baseColor, 1);
    btnBg.fillRoundedRect(bx, btnY + 3, bw, bh, br);
    // bright cap
    btnBg.fillStyle(capColor, 1);
    btnBg.fillRoundedRect(bx, btnY, bw, bh - 1, br);
    // glossy top highlight
    btnBg.fillStyle(0xffffff, isPrimary ? 0.3 : 0.5);
    btnBg.fillRoundedRect(bx + 5, btnY + 3, bw - 10, 11, 5);
    btnBg.setAlpha(0);
    ov.add(btnBg);
    scene.tweens.add({ targets: btnBg, alpha: 1, duration: 250, delay: 1000 + i * 120 });

    const btnT = scene.add.text(CANVAS_WIDTH / 2, btnY + 18, label, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: !enabled ? CASUAL_CSS.INK_SOFT : isPrimary ? CASUAL_CSS.WHITE : CASUAL_CSS.INK,
      stroke: isPrimary ? '#00000033' : undefined,
      strokeThickness: isPrimary ? 3 : 0,
    }).setOrigin(0.5).setAlpha(0);
    ov.add(btnT);
    scene.tweens.add({ targets: btnT, alpha: 1, duration: 250, delay: 1000 + i * 120 });

    if (enabled) {
      const zone = scene.add.zone(CANVAS_WIDTH / 2, btnY + 18, cw - 40, 36).setInteractive();
      ov.add(zone);
      zone.on('pointerdown', action);
    }
  });
}
