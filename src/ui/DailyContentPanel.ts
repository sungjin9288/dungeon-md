/**
 * Daily content panel: daily dungeon, weekly boss, and challenge buttons.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
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
import { canClaimAttendance } from '../data/attendance';
import { showAttendancePanel } from './AttendancePanel';
import { getReducedMotion } from '../utils/reducedMotion';

// Casual-toy challenge modal palette (used only by showChallengePanel).
const CHALLENGE_PANEL_FILL = CASUAL.PANEL;       // cream modal body
const CHALLENGE_ACCENT = CASUAL.BLUE;            // challenge identity = blue
const CHALLENGE_ROW_FILL = CASUAL.PANEL_SOFT;    // soft cream row pill
const CHALLENGE_DONE_FILL = CASUAL.PANEL_SOFT;   // done rows keep cream + green accent
const CHALLENGE_ROW_BORDER = CASUAL.EDGE_SOFT;   // incomplete row edge
const CHALLENGE_DONE_GREEN = CASUAL.GREEN;       // done accent

interface DailyHubRow {
  readonly icon: string;
  readonly title: string;
  readonly status: string;
  readonly accent: number;
  readonly actionLabel: string;
  readonly enabled?: boolean;
  readonly onPress: () => void;
}

function addDailyHubRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  row: DailyHubRow,
  x: number,
  y: number,
  w: number,
): void {
  const h = 60;
  const frame = addFramedPanel(scene, {
    x,
    y,
    w,
    h,
    radius: GAME_UI.radius.row,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: row.accent,
    borderAlpha: 0.48,
    borderWidth: 1.5,
    accentColor: row.accent,
    accentAlpha: 0.9,
    glowOpacity: 0,
    shadowOpacity: 0.12,
    shadowOffsetY: 2,
  });
  container.add([frame.shadow, frame.panel, frame.glow]);

  container.add(scene.add.text(x + 24, y + h / 2, row.icon, {
    fontFamily: 'sans-serif', fontSize: '18px',
  }).setOrigin(0.5));
  container.add(scene.add.text(x + 48, y + 20, row.title, {
    fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  container.add(scene.add.text(x + 48, y + 40, row.status, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));

  const enabled = row.enabled !== false;
  const action = addPrimaryActionButton(scene, {
    x: x + w - 88,
    y: y + 8,
    w: 76,
    h: 44,
    label: row.actionLabel,
    fontSize: '12px',
    enabled,
    once: true,
    fillColor: row.accent,
    hoverFillColor: row.accent,
    borderColor: row.accent,
    hoverBorderColor: row.accent,
    onPress: () => {
      audioManager.playSfx('button_click');
      row.onPress();
    },
  });
  container.add([action.bg, action.text, action.zone]);
}

export function showDailyContentHub(scene: Phaser.Scene): void {
  if (scene.children.getByName('daily-content-hub')) return;

  const gs = loadGameState();
  const today = getTodayString();
  const daily = getDailyDungeon();
  const weeklyBoss = getWeeklyBoss();
  const dailyView = prepareDailyChallengeViewState(gs, today);
  const dailyDone = gs.dailyDungeonCompleted === today;
  const ELEMENT_KR: Record<string, string> = {
    fire: '화염', frost: '빙결', lightning: '뇌전', dark: '암흑', holy: '신성',
  };
  const RULE_LABELS: Record<string, { text: string; color: string }> = {
    element_restrict: { text: ELEMENT_KR[daily.elementRestrict ?? ''] ?? '속성', color: CASUAL_CSS.BLUE },
    gold_rush:        { text: '골드 3×',   color: CASUAL_CSS.GOLD },
    speed_run:        { text: '스피드',     color: CASUAL_CSS.RED },
    boss_rush:        { text: '보스전',     color: CASUAL_CSS.RED },
  };
  const ruleLabel = RULE_LABELS[daily.rule] ?? { text: daily.rule, color: CASUAL_CSS.INK_SOFT };
  const weeklyDone = gs.weeklyBossResetDate === getThisWeekMonday();
  const completedCount = dailyView.completedCount;
  const attendClaimable = canClaimAttendance(gs, today);

  const container = scene.add.container(0, 0).setDepth(95).setName('daily-content-hub');
  const close = (): void => container.destroy(true);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.58);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );
  container.add(dim);

  const panelX = 20;
  const panelY = 200;
  const panelW = CANVAS_WIDTH - panelX * 2;
  const panelH = 356;
  const panel = addFramedPanel(scene, {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    radius: 16,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 0.9,
    borderWidth: 2,
    accentColor: CASUAL.BLUE,
    accentAlpha: 0.9,
    glowColor: CASUAL.BLUE,
    glowOpacity: 0.08,
    shadowOpacity: 0.5,
    shadowOffsetY: 5,
  });
  container.add([panel.shadow, panel.panel, panel.glow]);
  container.add(scene.add.text(panelX + 20, panelY + 24, '◆ 일일 작전실', {
    fontFamily: 'Georgia, serif', fontSize: '18px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  container.add(scene.add.text(panelX + 20, panelY + 45, '오늘의 전투와 보상을 한곳에서 관리합니다.', {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  const closeText = scene.add.text(panelX + panelW - 24, panelY + 26, '×', {
    fontFamily: 'sans-serif', fontSize: '22px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0.5);
  const closeZone = scene.add.zone(panelX + panelW - 24, panelY + 26, 44, 44)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
      audioManager.playSfx('button_click');
      close();
    });
  container.add([closeText, closeZone]);

  const launchDaily = (): void => {
    close();
    scene.registry.set('stageConfig', { stageNumber: 1, slots: 12, endless: false });
    scene.registry.set('dailyMode', daily);
    if (getReducedMotion()) {
      scene.scene.start('DungeonScene');
      return;
    }
    scene.cameras.main.fadeOut(220, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start('DungeonScene'));
  };
  const launchWeeklyBoss = (): void => {
    close();
    const bossWave = [{
      wave: 1,
      clearReward: weeklyBoss.rewards.skinShards * 100,
      invaders: [{ type: weeklyBoss.bossType, count: 1, spawnDelay: 0, isBoss: true }],
    }];
    scene.registry.set('stageConfig', {
      waves: bossWave,
      dungeonHp: 3000,
      chapter: 1,
    });
    scene.registry.set('returnTo', 'DungeonHomeScene');
    scene.registry.set('weeklyBossMode', { boss: weeklyBoss });
    if (getReducedMotion()) {
      scene.scene.stop('DungeonHomeScene');
      scene.scene.start('DungeonScene');
      return;
    }
    scene.cameras.main.fadeOut(220, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      scene.scene.stop('DungeonHomeScene');
      scene.scene.start('DungeonScene');
    });
  };

  const rowX = panelX + 12;
  const rowW = panelW - 24;
  const rows: DailyHubRow[] = [
    {
      icon: dailyDone ? '✅' : '⚔️',
      title: '일일 던전',
      status: dailyDone ? '오늘 보상 수령 완료' : `오늘 규칙 · ${ruleLabel.text}`,
      accent: dailyDone ? CASUAL.GREEN : CASUAL.GOLD,
      actionLabel: dailyDone ? '완료' : '입장',
      enabled: !dailyDone,
      onPress: launchDaily,
    },
    {
      icon: weeklyDone ? '✅' : '👑',
      title: '주간 보스',
      status: `${weeklyBoss.name}${weeklyDone ? ' · 이번 주 완료' : ''}`,
      accent: weeklyDone ? CASUAL.GREEN : CASUAL.PURPLE,
      actionLabel: weeklyDone ? '재도전' : '도전',
      onPress: launchWeeklyBoss,
    },
    {
      icon: '🎯',
      title: '도전 과제',
      status: `${completedCount}/${dailyView.challenges.length} 완료 · 총 보상 💎${dailyView.totalRewardGems}`,
      accent: CASUAL.BLUE,
      actionLabel: '보기',
      onPress: () => {
        close();
        showChallengePanel(scene);
      },
    },
    {
      icon: attendClaimable ? '📅' : '✅',
      title: '출석 보상',
      status: attendClaimable ? '오늘 보상을 받을 수 있습니다.' : '오늘 보상 수령 완료',
      accent: attendClaimable ? CASUAL.GOLD : CASUAL.GREEN,
      actionLabel: attendClaimable ? '수령' : '확인',
      onPress: () => {
        close();
        showAttendancePanel(scene);
      },
    },
  ];
  rows.forEach((row, index) => addDailyHubRow(
    scene,
    container,
    row,
    rowX,
    panelY + 66 + index * 68,
    rowW,
  ));

  if (!getReducedMotion()) {
    container.setAlpha(0);
    scene.tweens.add({ targets: container, alpha: 1, duration: 140, ease: 'Quad.easeOut' });
  }
}

export function showChallengePanel(scene: Phaser.Scene): void {
  const gs = loadGameState();
  const dailyView = prepareDailyChallengeViewState(gs);
  const workGs = dailyView.state;
  if (dailyView.changed) saveGameState(workGs);
  const { challenges } = dailyView;

  const c = scene.add.container(0, 0).setDepth(95);

  // Dim scrim — lightened for the bright casual look
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
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
    radius: 16,
    fillColor: CHALLENGE_PANEL_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CHALLENGE_ACCENT,
    accentAlpha: 1,
    shadowOpacity: 0.32,
    shadowOffsetY: 6,
  });
  addToContainer(c, panel.shadow, panel.panel, panel.glow);

  // ── Header: "all done" banner vs normal title ────────────────────────────
  const allDone = dailyView.allCompleted;
  const totalGems = allDone ? dailyView.totalRewardGems : 0;

  if (allDone) {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 18, '🎉 모든 도전 완료!', {
      fontFamily: 'sans-serif', fontSize: '17px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5));
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 38, `오늘 총 +${totalGems} 💎 획득`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0.5));
  } else {
    c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 24, '🎯  오늘의 도전 과제', {
      fontFamily: 'sans-serif', fontSize: '18px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5));
  }

  challenges.forEach((ch, i) => {
    const entry = workGs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
    const rowY  = PY + 58 + i * 78;
    const ratio = Math.min(entry.progress / ch.objective.target, 1);
    const rowX = PX + 12;
    const rowW = PW - 24;
    const rowH = 70;

    // Row background — cream pill, green accent border when complete
    const rowBorder = entry.completed ? CHALLENGE_DONE_GREEN : CHALLENGE_ROW_BORDER;
    const rbg = scene.add.graphics();
    rbg.fillStyle(entry.completed ? CHALLENGE_DONE_FILL : CHALLENGE_ROW_FILL, 1);
    rbg.fillRoundedRect(rowX, rowY, rowW, rowH, GAME_UI.radius.row);
    rbg.fillStyle(0xffffff, 0.12);
    rbg.fillRoundedRect(rowX + 4, rowY + 4, rowW - 8, 4, 2);
    rbg.lineStyle(2, rowBorder, entry.completed ? 1 : 0.9);
    rbg.strokeRoundedRect(rowX, rowY, rowW, rowH, GAME_UI.radius.row);
    c.add(rbg);

    // Status icon + description
    c.add(scene.add.text(rowX + 14, rowY + 15, entry.completed ? '✅' : '🔲', {
      fontFamily: 'sans-serif', fontSize: '14px',
    }));
    c.add(scene.add.text(rowX + 38, rowY + 12, ch.description, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: entry.completed ? CASUAL_CSS.GREEN : CASUAL_CSS.INK,
      wordWrap: { width: 200, useAdvancedWrap: true },
    }));

    // Reward badge — gold (or green when claimed)
    const rewardFill = entry.completed ? CASUAL.GREEN : CASUAL.GOLD;
    const rewardBorder = entry.completed ? CASUAL.GREEN_DK : CASUAL.GOLD_DK;
    const rewardBg = scene.add.graphics();
    rewardBg.fillStyle(rewardFill, 1);
    rewardBg.fillRoundedRect(PX + PW - 84, rowY + 10, 58, 20, 10);
    rewardBg.fillStyle(0xffffff, 0.12);
    rewardBg.fillRoundedRect(PX + PW - 80, rowY + 12, 50, 4, 2);
    rewardBg.lineStyle(2, rewardBorder, 1);
    rewardBg.strokeRoundedRect(PX + PW - 84, rowY + 10, 58, 20, 10);
    c.add(rewardBg);
    c.add(scene.add.text(PX + PW - 36, rowY + 20, `+${ch.reward.gems ?? 0} 💎`, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
      stroke: '#00000033', strokeThickness: 2,
    }).setOrigin(0.5));

    // Progress bar — cream track, green/gold fill
    const barX = rowX + 14, barY = rowY + 47, barW = rowW - 78, barH = 9;
    const fillColor = entry.completed ? CASUAL.GREEN : CASUAL.GOLD;
    const progress = addProgressBar(scene, {
      x: barX,
      y: barY,
      w: barW,
      h: barH,
      ratio,
      fillColor,
      trackColor: CASUAL.PANEL_SOFT,
      borderColor: entry.completed ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT,
      borderAlpha: 0.9,
      delay: 120 + i * 140,
      duration: 440,
    });
    addToContainer(c, progress.track, progress.fill);

    // Progress text: count + percentage
    const pct = Math.floor(ratio * 100);
    c.add(scene.add.text(barX + barW + 10, barY - 3,
      `${entry.progress}/${ch.objective.target}`, {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: entry.completed ? CASUAL_CSS.GREEN : CASUAL_CSS.INK,
        fontStyle: 'bold',
      }));
    c.add(scene.add.text(barX + barW + 10, barY + 10,
      entry.completed ? '완료' : `${pct}%`, {
        fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
        color: entry.completed ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
      }));
  });

  const closeBtn = addPrimaryActionButton(scene, {
    x: PX + 92,
    y: PY + PH - 44,
    w: PW - 184,
    h: 34,
    label: '닫기',
    fontSize: '14px',
    fillColor: CASUAL.PANEL,
    hoverFillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE,
    hoverBorderColor: CASUAL.EDGE,
    textColor: CASUAL_CSS.INK,
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
