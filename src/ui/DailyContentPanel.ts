/**
 * Daily content panel: daily dungeon, weekly boss, and challenge buttons.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getDailyDungeon,
  getWeeklyBoss,
  prepareDailyChallengeViewState,
  getTodayString,
  getThisWeekMonday,
} from '../data/daily';
import { loadGameState, saveGameState } from '../data/wisdom';
import { audioManager } from '../audio/AudioManager';
import { addFramedPanel, addPrimaryActionButton, addProgressBar, GAME_UI } from './GameUiPrimitives';

interface ShowChallengePanelFn {
  (): void;
}

const EVENT_TILE_SIZE = 42;
const EVENT_TILE_GAP = 8;
const CHALLENGE_PANEL_FILL = 0x061018;
const CHALLENGE_ROW_FILL = 0x081420;
const CHALLENGE_DONE_FILL = 0x082518;
const CHALLENGE_CYAN = 0x44cccc;
const CHALLENGE_CYAN_DARK = 0x226c6c;
const CHALLENGE_DONE_GREEN = 0x44cc88;

function drawEventTileShell(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: {
    readonly fillColor: number;
    readonly borderColor: number;
    readonly accentColor: number;
    readonly done?: boolean;
  },
): void {
  const { shadow, panel, glow } = addFramedPanel(scene, {
    x,
    y,
    w: EVENT_TILE_SIZE,
    h: EVENT_TILE_SIZE,
    radius: 8,
    fillColor: opts.fillColor,
    borderColor: opts.done ? 0x44cc44 : opts.borderColor,
    borderAlpha: opts.done ? 0.9 : 0.78,
    borderWidth: 1.5,
    accentColor: opts.done ? 0x44cc44 : opts.accentColor,
    accentAlpha: opts.done ? 0.75 : 0.62,
    glowColor: opts.done ? 0x44cc44 : opts.accentColor,
    glowOpacity: opts.done ? 0.09 : 0.07,
    shadowOpacity: 0.42,
    shadowOffsetY: 3,
  });
  shadow.setDepth(9);
  panel.setDepth(10);
  glow.setDepth(11);
}

export function buildDailyContentPanel(
  scene: Phaser.Scene,
  onShowChallengePanel: ShowChallengePanelFn,
): void {
  const gs = loadGameState();
  const today = getTodayString();
  const daily = getDailyDungeon();
  const weeklyBoss = getWeeklyBoss();
  const dailyView = prepareDailyChallengeViewState(gs, today);
  const { challenges } = dailyView;

  const dailyDone = gs.dailyDungeonCompleted === today;

  // Compact event rail. Keep it on the screen edge so the dungeon rooms remain the focus.
  const btnX = CANVAS_WIDTH - EVENT_TILE_SIZE - 7;
  const btnY = 468;
  const tileCenter = EVENT_TILE_SIZE / 2;

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
  drawEventTileShell(scene, btnX, btnY, {
    fillColor: dailyDone ? 0x102810 : 0x261006,
    borderColor: 0xc8921a,
    accentColor: 0xc8921a,
    done: dailyDone,
  });

  scene.add.text(btnX + tileCenter, btnY + 13, dailyDone ? '✅' : '⚔️', {
    fontFamily: 'sans-serif', fontSize: '15px',
  }).setOrigin(0.5).setDepth(11);

  // Rule sub-label / done countdown (small, inside button)
  if (!dailyDone) {
    scene.add.text(btnX + tileCenter, btnY + 30, ruleLabel.text, {
      fontFamily: 'sans-serif', fontSize: '9px', color: ruleLabel.color,
    }).setOrigin(0.5).setDepth(11);
  } else {
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    let secs = Math.max(0, Math.floor((midnight.getTime() - Date.now()) / 1000));
    const cdT = scene.add.text(btnX + tileCenter, btnY + 30, '', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#44aa44',
    }).setOrigin(0.5).setDepth(11);
    const fmtHms = (s: number) =>
      `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    cdT.setText(fmtHms(secs));
    scene.time.addEvent({ delay: 1000, loop: true, callback: () => {
      secs = Math.max(0, secs - 1); cdT.setText(fmtHms(secs));
    }});
  }

  if (!dailyDone) {
    const zone = scene.add.zone(btnX + tileCenter, btnY + tileCenter, EVENT_TILE_SIZE, EVENT_TILE_SIZE)
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
  const weekBtnY = btnY + EVENT_TILE_SIZE + EVENT_TILE_GAP;
  const weeklyDone = gs.weeklyBossResetDate === getThisWeekMonday();
  drawEventTileShell(scene, btnX, weekBtnY, {
    fillColor: weeklyDone ? 0x102810 : 0x19051f,
    borderColor: 0xaa44ff,
    accentColor: 0xaa44ff,
    done: weeklyDone,
  });

  scene.add.text(btnX + tileCenter, weekBtnY + 13, weeklyDone ? '✅' : '👑', {
    fontFamily: 'sans-serif', fontSize: '15px',
  }).setOrigin(0.5).setDepth(11);

  // Boss name sub-label / done countdown
  if (!weeklyDone) {
    const bossShort = weeklyBoss.name.length > 5 ? weeklyBoss.name.slice(0, 4) + '…' : weeklyBoss.name;
    scene.add.text(btnX + tileCenter, weekBtnY + 30, bossShort, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#cc99ff',
    }).setOrigin(0.5).setDepth(11);
  } else {
    const now2 = new Date();
    const nextMon = new Date(now2);
    const daysUntil = ((1 - now2.getDay() + 7) % 7) || 7;
    nextMon.setDate(now2.getDate() + daysUntil); nextMon.setHours(0, 0, 0, 0);
    let wSecs = Math.max(0, Math.floor((nextMon.getTime() - now2.getTime()) / 1000));
    const wCdT = scene.add.text(btnX + tileCenter, weekBtnY + 30, '', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#44aa44',
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

  // Weekly boss click - launch as invasion-style battle
  const weekZone = scene.add.zone(btnX + tileCenter, weekBtnY + tileCenter, EVENT_TILE_SIZE, EVENT_TILE_SIZE)
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
  const chalBtnY = weekBtnY + EVENT_TILE_SIZE + EVENT_TILE_GAP;
  const completedCount = dailyView.completedCount;

  drawEventTileShell(scene, btnX, chalBtnY, {
    fillColor: 0x041f20,
    borderColor: 0x44cccc,
    accentColor: 0x44cccc,
  });

  scene.add.text(btnX + tileCenter, chalBtnY + 14, '🎯', {
    fontFamily: 'sans-serif', fontSize: '16px',
  }).setOrigin(0.5).setDepth(11);

  scene.add.text(btnX + tileCenter, chalBtnY + 30, `${completedCount}/3`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#44cccc',
  }).setOrigin(0.5).setDepth(11);

  // Mini dot indicators — one per challenge
  const dotStates = challenges.map(c => dailyView.state.dailyChallenges[c.id]);
  dotStates.forEach((st, di) => {
    const completed  = st?.completed ?? false;
    const inProgress = !completed && (st?.progress ?? 0) > 0;
    const dotColor   = completed ? '#44ff88' : inProgress ? '#ffcc44' : '#336666';
    const dotX = btnX + 10 + di * 11;
    scene.add.text(dotX, chalBtnY + 37, '●', {
      fontFamily: 'sans-serif', fontSize: '7px', color: dotColor,
    }).setDepth(11);
  });

  const chalZone = scene.add.zone(btnX + tileCenter, chalBtnY + tileCenter, EVENT_TILE_SIZE, EVENT_TILE_SIZE)
    .setInteractive().setDepth(12);
  chalZone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    onShowChallengePanel();
  });
}

export function showChallengePanel(scene: Phaser.Scene): void {
  const gs = loadGameState();
  const dailyView = prepareDailyChallengeViewState(gs);
  const workGs = dailyView.state;
  if (dailyView.changed) saveGameState(workGs);
  const { challenges } = dailyView;

  const c = scene.add.container(0, 0).setDepth(95);

  // Dim overlay
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.80);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  c.add(dim);

  const PW = 340, PH = 342;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;

  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: CHALLENGE_PANEL_FILL,
    borderColor: CHALLENGE_CYAN,
    borderAlpha: 0.9,
    borderWidth: 2,
    accentColor: CHALLENGE_CYAN,
    accentAlpha: 0.72,
    glowColor: CHALLENGE_CYAN,
    glowOpacity: 0.10,
    shadowOpacity: 0.62,
    shadowOffsetY: 5,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  // ── Header: "all done" banner vs normal title ────────────────────────────
  const allDone = dailyView.allCompleted;
  const totalGems = allDone ? dailyView.totalRewardGems : 0;

  if (allDone) {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 16, '🎉 모든 도전 완료!', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44ffaa', fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 36, `오늘 총 +${totalGems} 💎 획득`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#aaffcc',
    }).setOrigin(0.5));
  } else {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 22, '🎯  오늘의 도전 과제', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#78ffff', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  challenges.forEach((ch, i) => {
    const entry = workGs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
    const rowY  = PY + 58 + i * 78;
    const ratio = Math.min(entry.progress / ch.objective.target, 1);
    const rowX = PX + 12;
    const rowW = PW - 24;
    const rowH = 70;

    // Row background
    const rbg = scene.add.graphics();
    rbg.fillStyle(entry.completed ? CHALLENGE_DONE_FILL : CHALLENGE_ROW_FILL, 0.96);
    rbg.fillRoundedRect(rowX, rowY, rowW, rowH, GAME_UI.radius.row);
    rbg.lineStyle(1, entry.completed ? CHALLENGE_DONE_GREEN : CHALLENGE_CYAN_DARK, entry.completed ? 0.68 : 0.55);
    rbg.strokeRoundedRect(rowX, rowY, rowW, rowH, GAME_UI.radius.row);
    c.add(rbg);

    // Status icon + description
    c.add(scene.add.text(rowX + 14, rowY + 15, entry.completed ? '✅' : '🔲', {
      fontFamily: 'sans-serif', fontSize: '14px',
    }));
    c.add(scene.add.text(rowX + 38, rowY + 12, ch.description, {
      fontFamily: 'Georgia, serif', fontSize: '11px',
      color: entry.completed ? '#88eebb' : '#d0c8b0',
      wordWrap: { width: 200, useAdvancedWrap: true },
    }));

    // Reward badge
    const rewardBg = scene.add.graphics();
    rewardBg.fillStyle(entry.completed ? 0x103624 : 0x0a1f2d, 0.95);
    rewardBg.fillRoundedRect(PX + PW - 84, rowY + 10, 58, 20, 10);
    rewardBg.lineStyle(1, entry.completed ? CHALLENGE_DONE_GREEN : 0x336688, 0.65);
    rewardBg.strokeRoundedRect(PX + PW - 84, rowY + 10, 58, 20, 10);
    c.add(rewardBg);
    c.add(scene.add.text(PX + PW - 36, rowY + 20, `+${ch.reward.gems ?? 0} 💎`, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: entry.completed ? '#aaffcc' : '#9ed8ff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Progress bar
    const barX = rowX + 14, barY = rowY + 47, barW = rowW - 78, barH = 9;
    const fillColor = entry.completed ? 0x44cc88 : 0x44aacc;
    const progress = addProgressBar(scene, {
      x: barX,
      y: barY,
      w: barW,
      h: barH,
      ratio,
      fillColor,
      trackColor: 0x06101a,
      borderColor: entry.completed ? CHALLENGE_DONE_GREEN : CHALLENGE_CYAN_DARK,
      borderAlpha: 0.68,
      delay: 120 + i * 140,
      duration: 440,
    });
    addToContainer(c, progress.track, progress.fill);

    // Progress text: count + percentage
    const pct = Math.floor(ratio * 100);
    c.add(scene.add.text(barX + barW + 10, barY - 3,
      `${entry.progress}/${ch.objective.target}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: entry.completed ? '#aaffcc' : '#88cce8',
        fontStyle: 'bold',
      }));
    c.add(scene.add.text(barX + barW + 10, barY + 10,
      entry.completed ? '완료' : `${pct}%`, {
        fontFamily: 'sans-serif', fontSize: '9px',
        color: entry.completed ? '#44ffaa' : '#667788',
      }));
  });

  const closeBtn = addPrimaryActionButton(scene, {
    x: PX + 92,
    y: PY + PH - 42,
    w: PW - 184,
    h: 32,
    label: '닫기',
    fontSize: '13px',
    fillColor: 0x071822,
    hoverFillColor: 0x0b2834,
    borderColor: CHALLENGE_CYAN,
    hoverBorderColor: 0x78ffff,
    textColor: '#78ffff',
    onPress: () => { c.destroy(true); },
  });
  addToContainer(c, closeBtn.bg, closeBtn.text, closeBtn.zone);

  c.setScale(0.88).setAlpha(0);
  scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
