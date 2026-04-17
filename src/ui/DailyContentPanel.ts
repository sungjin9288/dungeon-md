/**
 * Daily content panel: daily dungeon, weekly boss, and challenge buttons.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { getDailyDungeon, getDailyChallenges, getWeeklyBoss, getTodayString, getThisWeekMonday } from '../data/daily';
import { loadGameState } from '../data/wisdom';
import { audioManager } from '../audio/AudioManager';

interface ShowChallengePanelFn {
  (): void;
}

export function buildDailyContentPanel(
  scene: Phaser.Scene,
  onShowChallengePanel: ShowChallengePanelFn,
): void {
  const gs = loadGameState();
  const today = getTodayString();
  const daily = getDailyDungeon();
  const weeklyBoss = getWeeklyBoss();
  const challenges = getDailyChallenges();

  const dailyDone = gs.dailyDungeonCompleted === today;

  // Floating daily content button - right side of screen
  const btnX = CANVAS_WIDTH - 55;
  const btnY = 140;

  // Rule label mapping
  const ELEMENT_KR: Record<string, string> = {
    fire: '화염', frost: '빙결', lightning: '뇌전', dark: '암흑', holy: '신성',
  };
  const RULE_LABELS: Record<string, { text: string; color: string }> = {
    element_restrict: { text: ELEMENT_KR[daily.elementRestrict ?? ''] ?? '속성', color: '#88ccff' },
    gold_rush:        { text: '골드 3×',   color: '#ffdd44' },
    speed_run:        { text: '스피드',     color: '#ff8844' },
    boss_rush:        { text: '보스전',     color: '#ff4466' },
  };
  const ruleLabel = RULE_LABELS[daily.rule] ?? { text: daily.rule, color: '#aaaaaa' };

  // Daily dungeon button
  const dailyBg = scene.add.graphics().setDepth(10);
  dailyBg.fillStyle(dailyDone ? 0x1a3a1a : 0x3a1a00, 0.9);
  dailyBg.fillRoundedRect(btnX, btnY, 48, 48, 8);
  dailyBg.lineStyle(1.5, dailyDone ? 0x44cc44 : 0xc8921a, 0.8);
  dailyBg.strokeRoundedRect(btnX, btnY, 48, 48, 8);

  scene.add.text(btnX + 24, btnY + 10, dailyDone ? '✅' : '⚔️', {
    fontFamily: 'sans-serif', fontSize: '16px',
  }).setOrigin(0.5).setDepth(11);

  // Rule sub-label / done countdown (small, inside button)
  if (!dailyDone) {
    scene.add.text(btnX + 24, btnY + 27, ruleLabel.text, {
      fontFamily: 'sans-serif', fontSize: '11px', color: ruleLabel.color,
    }).setOrigin(0.5).setDepth(11);
  } else {
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    let secs = Math.max(0, Math.floor((midnight.getTime() - Date.now()) / 1000));
    const cdT = scene.add.text(btnX + 24, btnY + 27, '', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#44aa44',
    }).setOrigin(0.5).setDepth(11);
    const fmtHms = (s: number) =>
      `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    cdT.setText(fmtHms(secs));
    scene.time.addEvent({ delay: 1000, loop: true, callback: () => {
      secs = Math.max(0, secs - 1); cdT.setText(fmtHms(secs));
    }});
  }

  scene.add.text(btnX + 24, btnY + 38, '일일', {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#c8921a',
  }).setOrigin(0.5).setDepth(11);

  if (!dailyDone) {
    const zone = scene.add.zone(btnX + 24, btnY + 24, 48, 48)
      .setInteractive().setDepth(12);
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      // Launch dungeon scene with daily mode
      scene.registry.set('stageConfig', {
        stageNumber: 1,
        slots: 12,
        endless: false,
      });
      scene.registry.set('dailyMode', daily);
      scene.cameras.main.fadeOut(220, 0, 0, 0);
      scene.cameras.main.once('camerafadeoutcomplete', () => {
        scene.scene.start('DungeonScene');
      });
    });
  }

  // Weekly boss button
  const weekBtnY = btnY + 56;
  const weeklyDone = gs.weeklyBossResetDate === getThisWeekMonday();
  const weeklyBg = scene.add.graphics().setDepth(10);
  weeklyBg.fillStyle(weeklyDone ? 0x1a0030 : 0x2a0030, 0.9);
  weeklyBg.fillRoundedRect(btnX, weekBtnY, 48, 48, 8);
  weeklyBg.lineStyle(1.5, weeklyDone ? 0x44cc44 : 0xaa44ff, 0.8);
  weeklyBg.strokeRoundedRect(btnX, weekBtnY, 48, 48, 8);

  scene.add.text(btnX + 24, weekBtnY + 10, weeklyDone ? '✅' : '👑', {
    fontFamily: 'sans-serif', fontSize: '16px',
  }).setOrigin(0.5).setDepth(11);

  // Boss name sub-label / done countdown
  if (!weeklyDone) {
    const bossShort = weeklyBoss.name.length > 5 ? weeklyBoss.name.slice(0, 4) + '…' : weeklyBoss.name;
    scene.add.text(btnX + 24, weekBtnY + 27, bossShort, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc99ff',
    }).setOrigin(0.5).setDepth(11);
  } else {
    const now2 = new Date();
    const nextMon = new Date(now2);
    const daysUntil = ((1 - now2.getDay() + 7) % 7) || 7;
    nextMon.setDate(now2.getDate() + daysUntil); nextMon.setHours(0, 0, 0, 0);
    let wSecs = Math.max(0, Math.floor((nextMon.getTime() - now2.getTime()) / 1000));
    const wCdT = scene.add.text(btnX + 24, weekBtnY + 27, '', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#44aa44',
    }).setOrigin(0.5).setDepth(11);
    const fmtDhm = (s: number) => {
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
      return d > 0 ? `${d}일 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                   : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    wCdT.setText(fmtDhm(wSecs));
    scene.time.addEvent({ delay: 1000, loop: true, callback: () => {
      wSecs = Math.max(0, wSecs - 1); wCdT.setText(fmtDhm(wSecs));
    }});
  }

  scene.add.text(btnX + 24, weekBtnY + 38, '주간', {
    fontFamily: 'sans-serif', fontSize: '11px', color: weeklyDone ? '#44cc44' : '#aa44ff',
  }).setOrigin(0.5).setDepth(11);

  // Weekly boss click - launch as invasion-style battle
  const weekZone = scene.add.zone(btnX + 24, weekBtnY + 24, 48, 48)
    .setInteractive().setDepth(12);
  weekZone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    // Build single boss wave
    const bossWave = [{
      wave: 1, clearReward: weeklyBoss.rewards.skinShards * 100,
      invaders: [{ type: weeklyBoss.bossType, count: 1, spawnDelay: 0, isBoss: true }],
    }];
    scene.registry.set('stageConfig', {
      waves: bossWave,
      dungeonHp: 3000,
      startGold: 500,
      chapter: 1,
    });
    scene.registry.set('returnTo', 'DungeonHomeScene');
    scene.registry.set('weeklyBossMode', { boss: weeklyBoss });
    scene.cameras.main.fadeOut(220, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      scene.scene.stop('DungeonHomeScene');
      scene.scene.start('DungeonScene');
    });
  });

  // Challenge button
  const chalBtnY = weekBtnY + 56;
  const completedCount = challenges.filter(c => {
    const chState = gs.dailyChallenges[c.id];
    return chState?.completed ?? false;
  }).length;

  const chalBg = scene.add.graphics().setDepth(10);
  chalBg.fillStyle(0x003030, 0.9);
  chalBg.fillRoundedRect(btnX, chalBtnY, 48, 48, 8);
  chalBg.lineStyle(1.5, 0x44cccc, 0.8);
  chalBg.strokeRoundedRect(btnX, chalBtnY, 48, 48, 8);

  scene.add.text(btnX + 24, chalBtnY + 14, '🎯', {
    fontFamily: 'sans-serif', fontSize: '18px',
  }).setOrigin(0.5).setDepth(11);

  scene.add.text(btnX + 24, chalBtnY + 34, `${completedCount}/3`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#44cccc',
  }).setOrigin(0.5).setDepth(11);

  const chalZone = scene.add.zone(btnX + 24, chalBtnY + 24, 48, 48)
    .setInteractive().setDepth(12);
  chalZone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    onShowChallengePanel();
  });
}

export function showChallengePanel(scene: Phaser.Scene): void {
  const gs = loadGameState();
  const today = getTodayString();
  // Reset stale progress
  if (gs.dailyChallengeDate !== today) {
    gs.dailyChallenges    = {};
    gs.dailyChallengeDate = today;
  }
  const challenges = getDailyChallenges();

  const c = scene.add.container(0, 0).setDepth(95);

  // Dim overlay
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.80);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  c.add(dim);

  const PW = 340, PH = 320;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;

  const pg = scene.add.graphics();
  pg.fillStyle(0x060e18, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 10);
  pg.lineStyle(2, 0x44cccc, 1);
  pg.strokeRoundedRect(PX, PY, PW, PH, 10);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 22, '🎯  오늘의 도전 과제', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cccc', fontStyle: 'bold',
  }).setOrigin(0.5));

  challenges.forEach((ch, i) => {
    const entry = gs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
    const rowY = PY + 56 + i * 78;

    // Row bg
    const rbg = scene.add.graphics();
    rbg.fillStyle(entry.completed ? 0x0a2a1a : 0x0a1422, 0.8);
    rbg.fillRoundedRect(PX + 12, rowY, PW - 24, 68, 6);
    if (entry.completed) {
      rbg.lineStyle(1, 0x44cc88, 0.6);
      rbg.strokeRoundedRect(PX + 12, rowY, PW - 24, 68, 6);
    }
    c.add(rbg);

    // Status icon + description
    const icon = entry.completed ? '✅' : '🔲';
    c.add(scene.add.text(PX + 26, rowY + 12, icon, {
      fontFamily: 'sans-serif', fontSize: '14px',
    }));
    c.add(scene.add.text(PX + 48, rowY + 12, ch.description, {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: entry.completed ? '#88eebb' : '#d0c8b0',
    }));

    // Reward
    c.add(scene.add.text(PX + PW - 24, rowY + 12, `+${ch.reward.gems ?? 0} 💎`, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: entry.completed ? '#aaffcc' : '#88aacc',
    }).setOrigin(1, 0));

    // Progress bar
    const barX = PX + 26, barY = rowY + 44, barW = PW - 52, barH = 8;
    const prog = scene.add.graphics();
    prog.fillStyle(0x1a2a3a, 1);
    prog.fillRoundedRect(barX, barY, barW, barH, 4);
    const ratio = Math.min(entry.progress / ch.objective.target, 1);
    if (ratio > 0) {
      prog.fillStyle(entry.completed ? 0x44cc88 : 0x44aacc, 1);
      prog.fillRoundedRect(barX, barY, barW * ratio, barH, 4);
    }
    c.add(prog);

    c.add(scene.add.text(barX + barW + 6, barY - 1, `${entry.progress}/${ch.objective.target}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#88aacc',
    }));
  });

  const closeBtn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 26, '닫기', {
    fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44cccc', fontStyle: 'bold',
    backgroundColor: '#060e18', padding: { x: 32, y: 10 },
  }).setOrigin(0.5).setInteractive();
  closeBtn.on('pointerdown', () => { c.destroy(true); });
  c.add(closeBtn);

  c.setScale(0.88).setAlpha(0);
  scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
}
