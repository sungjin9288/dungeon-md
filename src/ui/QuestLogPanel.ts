/**
 * Quest log panel: main quest card, sub quests, and daily mini quests.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  getQuest, getSubQuestById, claimSubQuest,
  type MainQuest,
} from '../data/quests';
import { getDailyChallenges, getTodayString } from '../data/daily';
import { type GameState, loadGameState, saveGameState } from '../data/wisdom';

// ─── Quest complete overlay ─────────────────────────────────────────────────

export function showQuestCompleteOverlay(scene: Phaser.Scene, quest: MainQuest): void {
  const c = scene.add.container(0, 0).setDepth(80);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive();
  c.add(dim);

  // Panel
  const PW = 320, PH = 240;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = scene.add.graphics();
  pg.fillStyle(0x1a0f00, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 8);
  pg.lineStyle(2, 0xc8921a, 1);
  pg.strokeRoundedRect(PX, PY, PW, PH, 8);
  c.add(pg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 26, '퀘스트 완료!', {
    fontFamily: 'Georgia, serif', fontSize: '22px',
    color: '#c8921a', fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 56, quest.title, {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0e6c8',
  }).setOrigin(0.5));

  // Rewards
  const lines: string[] = [];
  if (quest.reward.gold)         lines.push(`💰  +${quest.reward.gold} 골드`);
  if (quest.reward.soulCrystals) lines.push(`💠  +${quest.reward.soulCrystals} 수정`);
  if (quest.reward.dmXP)         lines.push(`✨  +${quest.reward.dmXP} XP`);
  if (quest.reward.monsters?.length)  lines.push(`👹  ${quest.reward.monsters[0]}`);
  if (quest.reward.unlocks?.length)   lines.push(`🔓  ${quest.reward.unlocks[0]} 해금`);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 84, lines.join('\n'), {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8b090',
    align: 'center', lineSpacing: 6,
  }).setOrigin(0.5, 0));

  // Confirm button
  const confirmBtn = scene.add.text(CANVAS_WIDTH / 2, PY + PH - 40, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '15px',
    color: '#c8921a', fontStyle: 'bold',
    backgroundColor: '#2a1800', padding: { x: 32, y: 10 },
  }).setOrigin(0.5).setInteractive();

  const dismiss = () => { c.destroy(true); scene.scene.restart(); };
  confirmBtn.on('pointerdown', dismiss);
  dim.on('pointerdown', dismiss);
  c.add(confirmBtn);

  c.setScale(0.85).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 220, ease: 'Back.easeOut',
  });
}

// ─── Quest log panel state & methods ────────────────────────────────────────

export interface QuestLogState {
  questLogOpen: boolean;
  questLogContainer?: Phaser.GameObjects.Container;
}

export function openQuestLog(
  scene: Phaser.Scene,
  state: QuestLogState,
  gs: GameState,
): void {
  if (state.questLogOpen) return;
  state.questLogOpen = true;
  state.questLogContainer?.destroy();
  const container = buildQuestLogContainer(scene, state, gs);
  state.questLogContainer = container;
  container.setX(CANVAS_WIDTH);
  scene.tweens.add({
    targets: container, x: 0,
    duration: 240, ease: 'Quad.easeOut',
  });
}

export function closeQuestLog(state: QuestLogState, scene?: Phaser.Scene): void {
  if (!state.questLogOpen) return;
  state.questLogOpen = false;
  const container = state.questLogContainer;
  state.questLogContainer = undefined;
  if (!container) return;
  if (scene) {
    scene.tweens.add({
      targets: container, x: CANVAS_WIDTH,
      duration: 200, ease: 'Quad.easeIn',
      onComplete: () => container.destroy(true),
    });
  } else {
    container.destroy(true);
  }
}

function buildQuestLogContainer(
  scene: Phaser.Scene,
  state: QuestLogState,
  gs: GameState,
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(50);

  // Full-screen background
  const bg = scene.add.graphics();
  bg.fillStyle(0x080500, 0.97);
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bg.lineStyle(2, 0xc8921a, 0.35);
  bg.lineBetween(0, 0, 0, CANVAS_HEIGHT);
  c.add(bg);

  // Header bar
  const hg = scene.add.graphics();
  hg.fillStyle(0x0d0800, 1);
  hg.fillRect(0, 0, CANVAS_WIDTH, 48);
  hg.lineStyle(1, 0xc8921a, 0.4);
  hg.lineBetween(0, 48, CANVAS_WIDTH, 48);
  c.add(hg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, 24, '퀘스트 로그', {
    fontFamily: 'Georgia, serif', fontSize: '16px',
    color: '#c8921a', fontStyle: 'bold',
  }).setOrigin(0.5));

  const closeBtn = scene.add.text(CANVAS_WIDTH - 14, 12, '✕', {
    fontFamily: 'sans-serif', fontSize: '16px', color: '#664422',
  }).setOrigin(1, 0).setInteractive();
  closeBtn.on('pointerdown', () => closeQuestLog(state, scene));
  c.add(closeBtn);

  let y = 56;
  y = drawMainQuestCard(scene, c, y, gs);
  y = drawSubQuestSection(scene, c, y, gs, state);
  drawMiniQuestSection(scene, c, y, gs);

  // Tap dim bg behind to close
  bg.setInteractive();
  bg.on('pointerdown', () => closeQuestLog(state, scene));

  return c;
}

// ─── Active main quest card ─────────────────────────────────────────────────

function drawMainQuestCard(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
  gs: GameState,
): number {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;

  c.add(scene.add.text(PAD, y, '📜  메인 퀘스트', {
    fontFamily: 'Georgia, serif', fontSize: '11px',
    color: '#c8921a', fontStyle: 'bold', letterSpacing: 1,
  }));
  y += 20;

  const quest = gs.activeMainQuestId
    ? getQuest(gs.activeMainQuestId)
    : null;

  if (!quest) {
    const eg = scene.add.graphics();
    eg.fillStyle(0x140c04, 1);
    eg.fillRoundedRect(PAD, y, CARD_W, 50, 6);
    eg.lineStyle(1, 0x664422, 0.4);
    eg.strokeRoundedRect(PAD, y, CARD_W, 50, 6);
    c.add(eg);
    c.add(scene.add.text(CANVAS_WIDTH / 2, y + 25, '진행 중인 메인 퀘스트 없음', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#4a3020',
    }).setOrigin(0.5));
    return y + 62;
  }

  const prog     = gs.questProgress[quest.id];
  const objCount = quest.objectives.length;
  const CARD_H   = 74 + objCount * 28 + 24;

  // Card background
  const cg = scene.add.graphics();
  cg.fillStyle(0x1a0f00, 1);
  cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
  cg.lineStyle(1.5, 0xc8921a, 0.7);
  cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
  // Status dot (yellow = in progress)
  cg.fillStyle(0xffcc00, 1);
  cg.fillCircle(PAD + CARD_W - 12, y + 14, 5);
  c.add(cg);

  // Chapter badge + quest ID
  const chBadgeBg = scene.add.graphics();
  chBadgeBg.fillStyle(0x5a3a00, 1);
  chBadgeBg.fillRoundedRect(PAD + 10, y + 8, 38, 16, 3);
  c.add(chBadgeBg);
  c.add(scene.add.text(PAD + 29, y + 16, `CH.${quest.chapter}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#ffc844', fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(PAD + 54, y + 8, `[${quest.id}]`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }));
  c.add(scene.add.text(PAD + 96, y + 8, quest.title, {
    fontFamily: 'Georgia, serif', fontSize: '13px',
    color: '#f0e6c8', fontStyle: 'bold',
  }));

  // NPC emoji + first line of description
  c.add(scene.add.text(PAD + 10, y + 28, quest.npcEmoji, {
    fontFamily: 'sans-serif', fontSize: '18px',
  }));
  const descLine = quest.description.split('\n')[0];
  c.add(scene.add.text(PAD + 36, y + 30, `"${descLine}"`, {
    fontFamily: 'Georgia, serif', fontSize: '10px',
    color: '#a08060', fontStyle: 'italic',
    wordWrap: { width: CARD_W - 50 },
  }));

  // Objectives
  let oy = y + 54;
  quest.objectives.forEach((obj, oi) => {
    const cur    = prog?.objectives[obj.id] ?? 0;
    const pct    = Math.min(cur / obj.target, 1);
    const BAR_W  = 90;
    const barBx  = CANVAS_WIDTH - PAD - BAR_W - 10;

    c.add(scene.add.text(PAD + 10, oy, `▸ ${obj.description}`, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#c8b090',
    }));

    // Track
    const track2 = scene.add.graphics();
    track2.fillStyle(0x0a0600, 1);
    track2.fillRoundedRect(barBx, oy, BAR_W, 11, 2);
    track2.lineStyle(0.5, 0x664400, 0.6);
    track2.strokeRoundedRect(barBx, oy, BAR_W, 11, 2);
    c.add(track2);

    // Animated fill
    if (pct > 0) {
      const fill2 = scene.add.rectangle(barBx, oy, 2, 11, 0xc8921a).setOrigin(0, 0);
      c.add(fill2);
      scene.tweens.add({
        targets: fill2, displayWidth: BAR_W * pct,
        duration: 420, ease: 'Power2.Out', delay: 80 + oi * 120,
      });
    }

    c.add(scene.add.text(CANVAS_WIDTH - PAD - 6, oy + 5, `${cur}/${obj.target}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
    }).setOrigin(1, 0.5));

    oy += 26;
  });

  // Reward preview
  const rwds: string[] = [];
  if (quest.reward.gold)         rwds.push(`💰${quest.reward.gold}`);
  if (quest.reward.soulCrystals) rwds.push(`💠${quest.reward.soulCrystals}`);
  if (quest.reward.dmXP)         rwds.push(`✨${quest.reward.dmXP}XP`);
  if (quest.reward.unlocks?.length) rwds.push(`🔓${quest.reward.unlocks[0]}`);
  c.add(scene.add.text(PAD + 10, oy + 4, `보상: ${rwds.join('  ')}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }));

  return y + CARD_H + 14;
}

// ─── Sub quest section ──────────────────────────────────────────────────────

function drawSubQuestSection(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
  gs: GameState,
  state: QuestLogState,
): number {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;
  const CARD_H = 62;

  c.add(scene.add.text(PAD, y, '⚔️  서브 퀘스트', {
    fontFamily: 'Georgia, serif', fontSize: '11px',
    color: '#a08060', fontStyle: 'bold',
  }));
  y += 20;

  const sqIds = gs.activeSubQuestIds ?? [];

  if (sqIds.length === 0) {
    const eg = scene.add.graphics();
    eg.fillStyle(0x120a02, 1);
    eg.fillRoundedRect(PAD, y, CARD_W, 44, 6);
    eg.lineStyle(1, 0x5a3c1c, 0.45);
    eg.strokeRoundedRect(PAD, y, CARD_W, 44, 6);
    c.add(eg);
    c.add(scene.add.text(CANVAS_WIDTH / 2, y + 22, '모든 서브 퀘스트 완료! 내일 다시 도전하세요.', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#806040',
    }).setOrigin(0.5));
    return y + 56;
  }

  sqIds.forEach(sqId => {
    const sq = getSubQuestById(sqId);
    if (!sq) return;

    const prog   = gs.subQuestProgress?.[sqId] ?? 0;
    const done   = prog >= sq.objective.target;
    const pct    = Math.min(prog / sq.objective.target, 1);
    const BAR_W  = 100;
    const borderCol = done ? 0xffcc44 : 0x5a3c1c;
    const borderAlpha = done ? 0.9 : 0.45;

    const cg = scene.add.graphics();
    cg.fillStyle(done ? 0x1a1200 : 0x120a02, 1);
    cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    cg.lineStyle(done ? 1.5 : 1, borderCol, borderAlpha);
    cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
    c.add(cg);

    // Icon + title
    c.add(scene.add.text(PAD + 10, y + 10, `${sq.icon} ${sq.title}`, {
      fontFamily: 'Georgia, serif', fontSize: '12px',
      color: done ? '#ffcc44' : '#c8b090', fontStyle: 'bold',
    }));

    // Objective description
    c.add(scene.add.text(PAD + 10, y + 26, sq.objective.description, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
    }));

    // Progress bar — track
    const bx = PAD + 10;
    const by = y + 40;
    const trackSq = scene.add.graphics();
    trackSq.fillStyle(0x0a0600, 1);
    trackSq.fillRoundedRect(bx, by, BAR_W, 10, 2);
    trackSq.lineStyle(0.5, 0x664400, 0.6);
    trackSq.strokeRoundedRect(bx, by, BAR_W, 10, 2);
    c.add(trackSq);

    // Animated fill
    if (pct > 0) {
      const fillSq = scene.add.rectangle(bx, by, 2, 10, done ? 0xffcc00 : 0xc8921a).setOrigin(0, 0);
      c.add(fillSq);
      scene.tweens.add({
        targets: fillSq, displayWidth: BAR_W * pct,
        duration: 400, ease: 'Power2.Out', delay: 100 + sqIds.indexOf(sqId) * 120,
      });
    }

    // Progress text
    c.add(scene.add.text(bx + BAR_W + 6, by + 5, `${prog}/${sq.objective.target}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#806040',
    }).setOrigin(0, 0.5));

    // Reward preview
    const rwds: string[] = [];
    if (sq.reward.gold)         rwds.push(`💰${sq.reward.gold}`);
    if (sq.reward.soulCrystals) rwds.push(`💠${sq.reward.soulCrystals}`);
    if (sq.reward.dmXP)         rwds.push(`✨${sq.reward.dmXP}XP`);
    c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, y + 26, rwds.join(' '), {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#c8921a',
    }).setOrigin(1, 0.5));

    // Claim button (only when done)
    if (done) {
      const btnW = 52;
      const btnX = CANVAS_WIDTH - PAD - 10 - btnW;
      const btnY = y + 38;
      const btnBg = scene.add.graphics();
      btnBg.fillStyle(0x8a6200, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, 16, 4);
      c.add(btnBg);
      const btnTxt = scene.add.text(btnX + btnW / 2, btnY + 8, '완료!  수령', {
        fontFamily: 'Georgia, serif', fontSize: '9px', color: '#fff9e0', fontStyle: 'bold',
      }).setOrigin(0.5).setInteractive();
      btnTxt.on('pointerdown', () => {
        const freshGs = loadGameState();
        const [newGs, claimed] = claimSubQuest(freshGs, sqId);
        if (!claimed) return;
        saveGameState(newGs);

        // Brief "✨ 수령!" toast before rebuilding
        const toast = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '✨ 수령 완료!', {
          fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffcc44', fontStyle: 'bold',
          backgroundColor: '#1a0f00', padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setDepth(200).setAlpha(0);
        scene.tweens.add({
          targets: toast, alpha: 1, y: CANVAS_HEIGHT / 2 - 30,
          duration: 200, ease: 'Power2.Out',
          onComplete: () => scene.tweens.add({
            targets: toast, alpha: 0, duration: 300, delay: 500,
            onComplete: () => {
              toast.destroy();
              state.questLogContainer?.destroy();
              state.questLogContainer = undefined;
              state.questLogContainer = buildQuestLogContainer(scene, state, newGs);
            },
          }),
        });
      });
      c.add(btnTxt);
    }

    y += CARD_H + 10;
  });

  return y + 4;
}

// ─── Mini quest (daily) section ─────────────────────────────────────────────

function drawMiniQuestSection(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
  gs: GameState,
): void {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;

  c.add(scene.add.text(PAD, y, '🎯  일일 퀘스트', {
    fontFamily: 'Georgia, serif', fontSize: '11px',
    color: '#a08060', fontStyle: 'bold',
  }));
  y += 20;

  const challenges = getDailyChallenges();
  const today      = getTodayString();
  // Reset stale challenge data if date changed, and persist immediately
  let workGs = gs;
  if (gs.dailyChallengeDate !== today) {
    workGs = { ...gs, dailyChallenges: {}, dailyChallengeDate: today };
    saveGameState(workGs);
  }
  const CARD_H = 16 + challenges.length * 26 + 20;

  const cg = scene.add.graphics();
  cg.fillStyle(0x0e0700, 1);
  cg.fillRoundedRect(PAD, y, CARD_W, CARD_H, 6);
  cg.lineStyle(1, 0x4a3010, 0.5);
  cg.strokeRoundedRect(PAD, y, CARD_W, CARD_H, 6);
  c.add(cg);

  let dy = y + 10;
  let allDone = true;
  challenges.forEach(ch => {
    const chState = workGs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
    const done    = chState.completed;
    const prog    = Math.min(chState.progress, ch.objective.target);
    if (!done) allDone = false;

    const checkmark = done ? '✓' : '□';
    const col       = done ? '#44cc88' : '#7a5a3a';
    c.add(scene.add.text(PAD + 10, dy, `${checkmark}  ${ch.description}`, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: col,
    }));
    const rwdStr = ch.reward.gems ? `💎${ch.reward.gems}` : '';
    c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, dy, done ? '완료' : `${prog}/${ch.objective.target}  ${rwdStr}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: done ? '#44cc88' : '#5a3c1c',
    }).setOrigin(1, 0));
    dy += 26;
  });

  // Summary footer
  const completedCount = challenges.filter(ch => (workGs.dailyChallenges[ch.id]?.completed ?? false)).length;
  c.add(scene.add.text(PAD + 10, dy + 2, `${completedCount}/${challenges.length} 완료`, {
    fontFamily: 'sans-serif', fontSize: '9px',
    color: allDone ? '#44cc88' : '#5a3c1c',
  }));
  const totalGems = challenges.reduce((sum, ch) => sum + (ch.reward.gems ?? 0), 0);
  c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, dy + 2, `총 보상: 💎${totalGems}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
  }).setOrigin(1, 0));
}
