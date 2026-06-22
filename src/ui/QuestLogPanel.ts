/**
 * Quest log panel: main quest card, sub quests, and daily mini quests.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { getReducedMotion } from '../utils/reducedMotion';
import {
  getQuest, applySubQuestClaim, prepareSubQuestLogViewState,
  type MainQuest,
  type SubQuestLogViewStateResult,
} from '../data/quests';
import { prepareDailyChallengeViewState } from '../data/daily';
import { type GameState, loadGameState, saveGameState } from '../data/wisdom';
import {
  addFramedPanel,
  addInfoRow,
  addPrimaryActionButton,
  addProgressBar,
  type InfoRowOptions,
} from './GameUiPrimitives';

const QUEST_PANEL_FILL = CASUAL.PANEL;
const QUEST_ROW_FILL = CASUAL.PANEL_SOFT;
const COSMIC_PANEL_FILL = CASUAL.PANEL;
const COSMIC_ROW_FILL = CASUAL.PANEL_SOFT;
const COSMIC_BORDER = CASUAL.PURPLE_DK;
const COSMIC_ACCENT = CASUAL.PURPLE;
const COSMIC_ACCENT_CSS = CASUAL_CSS.PURPLE;
const COSMIC_TEXT = CASUAL_CSS.PURPLE;
const COSMIC_MUTED = CASUAL_CSS.INK_SOFT;

// ─── Quest complete overlay ─────────────────────────────────────────────────

export function showQuestCompleteOverlay(scene: Phaser.Scene, quest: MainQuest): void {
  const c = scene.add.container(0, 0).setDepth(80);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive();
  c.add(dim);

  const rows = buildQuestRewardRows(quest);

  // Panel
  const PW = 320;
  const PH = Math.max(240, 154 + rows.length * 27);
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const frame = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: QUEST_PANEL_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0,
    shadowOpacity: 0.3,
    shadowOffsetY: 5,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 28, '퀘스트 완료', {
    fontFamily: 'sans-serif', fontSize: '22px',
    color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 58, quest.title, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5));

  const div = scene.add.graphics();
  div.lineStyle(2, CASUAL.EDGE_SOFT, 0.6);
  div.lineBetween(PX + 22, PY + 78, PX + PW - 22, PY + 78);
  c.add(div);

  rows.forEach((row, i) => {
    const refs = addInfoRow(scene, {
      ...row,
      x: PX + 24,
      y: PY + 92 + i * 26,
      w: PW - 48,
      h: 22,
    });
    c.add([refs.bg, refs.iconText, refs.labelText, refs.valueText]);
  });

  // Confirm button
  const dismiss = () => { c.destroy(true); scene.scene.restart(); };
  dim.on('pointerdown', dismiss);
  const confirmBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 - 70,
    y: PY + PH - 48,
    w: 140,
    h: 44,
    label: '확인',
    fontSize: '15px',
    fillColor: CASUAL.GREEN,
    hoverFillColor: 0x6fdc70,
    borderColor: CASUAL.GREEN_DK,
    hoverBorderColor: CASUAL.GREEN_DK,
    textColor: CASUAL_CSS.WHITE,
    once: true,
    onPress: dismiss,
  });
  c.add([confirmBtn.bg, confirmBtn.text, confirmBtn.zone]);

  c.setScale(0.85).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 220, ease: 'Back.easeOut',
  });
}

// ─── Game-complete overlay (MQ-044 only) ────────────────────────────────────

export function showGameCompleteOverlay(scene: Phaser.Scene, quest: MainQuest): void {
  const c = scene.add.container(0, 0).setDepth(80);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive();
  c.add(dim);

  const rows = buildQuestRewardRows(quest, true);

  // Panel — purple cosmic theme on cream
  const PW = 320, PH = 380;
  const PX = (CANVAS_WIDTH - PW) / 2;
  const PY = (CANVAS_HEIGHT - PH) / 2;
  const frame = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 12,
    fillColor: COSMIC_PANEL_FILL,
    borderColor: COSMIC_BORDER,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: COSMIC_ACCENT,
    accentAlpha: 1,
    glowColor: COSMIC_ACCENT,
    glowOpacity: 0,
    shadowOpacity: 0.32,
    shadowOffsetY: 6,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  // Top cosmic decoration
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 22, '✦  심연 정복  ✦', {
    fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: COSMIC_ACCENT_CSS,
  }).setOrigin(0.5));

  // Main title
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 54, '원초의 심연 정복!', {
    fontFamily: 'sans-serif', fontSize: '24px',
    color: COSMIC_TEXT, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  // Quest subtitle
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 86, quest.title, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: COSMIC_MUTED,
  }).setOrigin(0.5));

  // Divider
  const div = scene.add.graphics();
  div.lineStyle(2, CASUAL.PURPLE, 0.5);
  div.moveTo(PX + 24, PY + 104);
  div.lineTo(PX + PW - 24, PY + 104);
  div.strokePath();
  c.add(div);

  rows.slice(0, 5).forEach((row, i) => {
    const refs = addInfoRow(scene, {
      ...row,
      x: PX + 26,
      y: PY + 120 + i * 25,
      w: PW - 52,
      h: 21,
      fillColor: COSMIC_ROW_FILL,
      borderColor: CASUAL.PURPLE,
      labelColor: COSMIC_MUTED,
    });
    c.add([refs.bg, refs.iconText, refs.labelText, refs.valueText]);
  });

  // Title badge
  const badgeY = PY + 260;
  const titleBadge = addInfoRow(scene, {
    x: PX + 20,
    y: badgeY - 16,
    w: PW - 40,
    h: 32,
    icon: '✦',
    label: '칭호 획득',
    value: '원초의 심연 정복자',
    valueColor: COSMIC_ACCENT_CSS,
    fillColor: CASUAL.PANEL_SOFT,
    borderColor: COSMIC_BORDER,
    labelColor: COSMIC_MUTED,
  });
  c.add([titleBadge.bg, titleBadge.iconText, titleBadge.labelText, titleBadge.valueText]);

  // Congratulation message
  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 305, '모든 챕터를 완료하셨습니다!', {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: COSMIC_MUTED,
  }).setOrigin(0.5));

  const dismiss = () => { c.destroy(true); scene.scene.restart(); };
  const btn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH / 2 - 76,
    y: PY + PH - 60,
    w: 152,
    h: 44,
    label: '✦ 확인 ✦',
    fontSize: '15px',
    fillColor: CASUAL.PURPLE,
    hoverFillColor: 0xc488f0,
    borderColor: COSMIC_BORDER,
    hoverBorderColor: COSMIC_ACCENT,
    textColor: CASUAL_CSS.WHITE,
    once: true,
    onPress: dismiss,
  });
  c.add([btn.bg, btn.text, btn.zone]);

  // Entrance animation — scale up with glow pulse
  c.setScale(0.8).setAlpha(0);
  scene.tweens.add({
    targets: c, scaleX: 1, scaleY: 1, alpha: 1,
    duration: 320, ease: 'Back.easeOut',
  });
  // Decorative claim-button glow pulse — button stays fully visible when gated.
  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: [btn.bg, btn.text], alpha: 0.6, yoyo: true, repeat: -1,
      duration: 900, ease: 'Sine.easeInOut', delay: 500,
    });
  }
}

function buildQuestRewardRows(
  quest: MainQuest,
  cosmic = false,
): Array<Omit<InfoRowOptions, 'x' | 'y' | 'w'>> {
  const rows: Array<Omit<InfoRowOptions, 'x' | 'y' | 'w'>> = [];
  if (quest.reward.gold) {
    rows.push({ icon: '💰', label: '골드', value: `+${quest.reward.gold.toLocaleString('ko-KR')}`, valueColor: cosmic ? COSMIC_ACCENT_CSS : CASUAL_CSS.GOLD, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  if (quest.reward.soulCrystals) {
    rows.push({ icon: '💠', label: '수정', value: `+${quest.reward.soulCrystals.toLocaleString('ko-KR')}`, valueColor: cosmic ? COSMIC_ACCENT_CSS : CASUAL_CSS.BLUE, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  if (quest.reward.dmXP) {
    rows.push({ icon: '✨', label: 'DM XP', value: `+${quest.reward.dmXP.toLocaleString('ko-KR')}`, valueColor: cosmic ? COSMIC_TEXT : CASUAL_CSS.INK, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  if (quest.reward.monsters?.length) {
    rows.push({ icon: '👹', label: '몬스터', value: quest.reward.monsters[0], valueColor: cosmic ? COSMIC_TEXT : CASUAL_CSS.INK, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  quest.reward.unlocks?.forEach(unlock => {
    rows.push({ icon: '🔓', label: '해금', value: unlock, valueColor: cosmic ? COSMIC_ACCENT_CSS : CASUAL_CSS.GOLD, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  });
  return rows;
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
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  c.add(bg);

  // Header bar
  const hg = scene.add.graphics();
  hg.fillStyle(CASUAL.PANEL_SOFT, 1);
  hg.fillRect(0, 0, CANVAS_WIDTH, 48);
  hg.fillStyle(0xffffff, 0.12);
  hg.fillRect(0, 0, CANVAS_WIDTH, 3);
  hg.fillStyle(CASUAL.EDGE, 1);
  hg.fillRect(0, 45, CANVAS_WIDTH, 3);
  c.add(hg);

  c.add(scene.add.text(CANVAS_WIDTH / 2, 24, '퀘스트 로그', {
    fontFamily: 'sans-serif', fontSize: '18px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
    stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5));

  // chunky cream close pill
  const closeG = scene.add.graphics();
  closeG.fillStyle(CASUAL.SHADOW, 0.2);
  closeG.fillRoundedRect(CANVAS_WIDTH - 40, 12 + 2, 28, 26, 13);
  closeG.fillStyle(CASUAL.PANEL, 1);
  closeG.fillRoundedRect(CANVAS_WIDTH - 40, 12, 28, 26, 13);
  closeG.lineStyle(2.5, CASUAL.EDGE, 1);
  closeG.strokeRoundedRect(CANVAS_WIDTH - 40, 12, 28, 26, 13);
  c.add(closeG);
  const closeBtn = scene.add.text(CANVAS_WIDTH - 26, 25, '✕', {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5).setInteractive();
  closeBtn.on('pointerdown', () => closeQuestLog(state, scene));
  c.add(closeBtn);

  const subQuestView = prepareSubQuestLogViewState(gs);
  const workGs = subQuestView.state;
  if (subQuestView.changed) saveGameState(workGs);

  let y = 56;
  y = drawMainQuestCard(scene, c, y, workGs);
  y = drawSubQuestSection(scene, c, y, subQuestView, state);
  drawMiniQuestSection(scene, c, y, workGs);

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
    fontFamily: 'sans-serif', fontSize: '12px',
    color: CASUAL_CSS.INK, fontStyle: 'bold', letterSpacing: 1,
  }));
  y += 20;

  const quest = gs.activeMainQuestId
    ? getQuest(gs.activeMainQuestId)
    : null;

  if (!quest) {
    const frame = addFramedPanel(scene, {
      x: PAD,
      y,
      w: CARD_W,
      h: 50,
      radius: 9,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      borderAlpha: 1,
      borderWidth: 2,
      glowColor: CASUAL.EDGE_SOFT,
      glowOpacity: 0,
      shadowOpacity: 0.2,
      shadowOffsetY: 2,
    });
    c.add([frame.shadow, frame.panel, frame.glow]);
    c.add(scene.add.text(CANVAS_WIDTH / 2, y + 25, '진행 중인 메인 퀘스트 없음', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    return y + 62;
  }

  const prog     = gs.questProgress[quest.id];
  const objCount = quest.objectives.length;
  const CARD_H   = 74 + objCount * 28 + 24;

  // Card background
  const frame = addFramedPanel(scene, {
    x: PAD,
    y,
    w: CARD_W,
    h: CARD_H,
    radius: 11,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.GOLD_DK,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.GOLD,
    accentAlpha: 1,
    glowColor: CASUAL.GOLD,
    glowOpacity: 0,
    shadowOpacity: 0.28,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  const cg = scene.add.graphics();
  // Status dot (yellow = in progress)
  cg.fillStyle(CASUAL.GOLD, 1);
  cg.fillCircle(PAD + CARD_W - 12, y + 16, 5);
  cg.lineStyle(2, CASUAL.GOLD_DK, 1);
  cg.strokeCircle(PAD + CARD_W - 12, y + 16, 5);
  c.add(cg);

  // Chapter badge + quest ID
  const chBadgeBg = scene.add.graphics();
  chBadgeBg.fillStyle(CASUAL.GOLD, 1);
  chBadgeBg.fillRoundedRect(PAD + 10, y + 8, 38, 16, 5);
  chBadgeBg.lineStyle(1.5, CASUAL.GOLD_DK, 1);
  chBadgeBg.strokeRoundedRect(PAD + 10, y + 8, 38, 16, 5);
  c.add(chBadgeBg);
  c.add(scene.add.text(PAD + 29, y + 16, `CH.${quest.chapter}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.WHITE, fontStyle: 'bold',
  }).setOrigin(0.5));

  c.add(scene.add.text(PAD + 54, y + 8, `[${quest.id}]`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
  }));
  c.add(scene.add.text(PAD + 96, y + 8, quest.title, {
    fontFamily: 'sans-serif', fontSize: '13px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }));

  // NPC emoji + first line of description
  c.add(scene.add.text(PAD + 10, y + 28, quest.npcEmoji, {
    fontFamily: 'sans-serif', fontSize: '18px',
  }));
  const descLine = quest.description.split('\n')[0];
  c.add(scene.add.text(PAD + 36, y + 30, `"${descLine}"`, {
    fontFamily: 'sans-serif', fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT, fontStyle: 'italic',
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
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }));

    const progress = addProgressBar(scene, {
      x: barBx,
      y: oy,
      w: BAR_W,
      h: 11,
      ratio: pct,
      fillColor: CASUAL.GOLD,
      trackColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      delay: 80 + oi * 120,
    });
    c.add([progress.track, progress.fill]);

    c.add(scene.add.text(CANVAS_WIDTH - PAD - 6, oy + 5, `${cur}/${obj.target}`, {
      fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
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
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
  }));

  return y + CARD_H + 14;
}

// ─── Sub quest section ──────────────────────────────────────────────────────

function drawSubQuestSection(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
  subQuestView: SubQuestLogViewStateResult,
  state: QuestLogState,
): number {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;
  const CARD_H = 62;

  c.add(scene.add.text(PAD, y, '⚔️  서브 퀘스트', {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }));
  y += 20;

  const { items } = subQuestView;

  if (subQuestView.allCompleted) {
    const frame = addFramedPanel(scene, {
      x: PAD,
      y,
      w: CARD_W,
      h: 44,
      radius: 9,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      borderAlpha: 1,
      borderWidth: 2,
      glowColor: CASUAL.EDGE_SOFT,
      glowOpacity: 0,
      shadowOpacity: 0.2,
      shadowOffsetY: 2,
    });
    c.add([frame.shadow, frame.panel, frame.glow]);
    c.add(scene.add.text(CANVAS_WIDTH / 2, y + 22, '모든 서브 퀘스트 완료! 내일 다시 도전하세요.', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
    }).setOrigin(0.5));
    return y + 56;
  }

  items.forEach((item, itemIndex) => {
    const { subQuest: sq } = item;
    const prog   = item.progress;
    const done   = item.completed;
    const pct    = item.progressRatio;
    const BAR_W  = 100;
    const borderCol = done ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT;

    const frame = addFramedPanel(scene, {
      x: PAD,
      y,
      w: CARD_W,
      h: CARD_H,
      radius: 11,
      fillColor: done ? CASUAL.PANEL : CASUAL.PANEL_SOFT,
      borderColor: borderCol,
      borderAlpha: 1,
      borderWidth: done ? 3 : 2,
      accentColor: done ? CASUAL.GREEN : undefined,
      accentAlpha: 1,
      glowColor: borderCol,
      glowOpacity: 0,
      shadowOpacity: done ? 0.28 : 0.2,
      shadowOffsetY: 2,
    });
    c.add([frame.shadow, frame.panel, frame.glow]);

    // Icon + title (+ check when done)
    c.add(scene.add.text(PAD + 10, y + 10, `${done ? '✓ ' : ''}${sq.icon} ${sq.title}`, {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: done ? CASUAL_CSS.GREEN : CASUAL_CSS.INK, fontStyle: 'bold',
    }));

    // Objective description
    c.add(scene.add.text(PAD + 10, y + 26, sq.objective.description, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }));

    const bx = PAD + 10;
    const by = y + 40;
    const progressBar = addProgressBar(scene, {
      x: bx,
      y: by,
      w: BAR_W,
      h: 10,
      ratio: pct,
      fillColor: done ? CASUAL.GREEN : CASUAL.GOLD,
      trackColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      duration: 400,
      delay: 100 + itemIndex * 120,
    });
    c.add([progressBar.track, progressBar.fill]);

    // Progress text
    c.add(scene.add.text(bx + BAR_W + 6, by + 5, `${prog}/${item.target}`, {
      fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));

    // Reward preview
    const rwds: string[] = [];
    if (sq.reward.gold)         rwds.push(`💰${sq.reward.gold}`);
    if (sq.reward.soulCrystals) rwds.push(`💠${sq.reward.soulCrystals}`);
    if (sq.reward.dmXP)         rwds.push(`✨${sq.reward.dmXP}XP`);
    c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, y + 26, rwds.join(' '), {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    }).setOrigin(1, 0.5));

    // Claim button (only when done)
    if (done) {
      const btnW = 60;
      const btnX = CANVAS_WIDTH - PAD - 10 - btnW;
      const btnY = y + 38;
      const claim = (): void => {
        const result = applySubQuestClaim(loadGameState(), sq.id);
        if (!result.ok) return;
        const newGs = result.state;
        saveGameState(newGs);

        // Brief "✨ 수령!" toast before rebuilding
        const toast = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '✨ 수령 완료!', {
          fontFamily: 'sans-serif', fontSize: '18px', color: CASUAL_CSS.WHITE, fontStyle: 'bold',
          backgroundColor: CASUAL_CSS.GREEN, padding: { x: 20, y: 10 },
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
      };
      const claimBtn = addPrimaryActionButton(scene, {
        x: btnX,
        y: btnY,
        w: btnW,
        h: 18,
        label: '수령',
        fontSize: '10px',
        fillColor: CASUAL.GREEN,
        hoverFillColor: 0x6fdc70,
        borderColor: CASUAL.GREEN_DK,
        hoverBorderColor: CASUAL.GREEN_DK,
        textColor: CASUAL_CSS.WHITE,
        once: true,
        onPress: claim,
      });
      c.add([claimBtn.bg, claimBtn.text, claimBtn.zone]);
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
    fontFamily: 'sans-serif', fontSize: '12px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }));
  y += 20;

  const dailyView = prepareDailyChallengeViewState(gs);
  const { challenges } = dailyView;
  const workGs = dailyView.state;
  if (dailyView.changed) saveGameState(workGs);
  const CARD_H = 16 + challenges.length * 26 + 20;

  const frame = addFramedPanel(scene, {
    x: PAD,
    y,
    w: CARD_W,
    h: CARD_H,
    radius: 11,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.BLUE_DK,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.BLUE,
    accentAlpha: 1,
    glowColor: CASUAL.BLUE,
    glowOpacity: 0,
    shadowOpacity: 0.24,
    shadowOffsetY: 2,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  let dy = y + 10;
  let allDone = true;
  challenges.forEach(ch => {
    const chState = workGs.dailyChallenges[ch.id] ?? { completed: false, progress: 0 };
    const done    = chState.completed;
    const prog    = Math.min(chState.progress, ch.objective.target);
    if (!done) allDone = false;

    const checkmark = done ? '✓' : '□';
    const col       = done ? CASUAL_CSS.GREEN : CASUAL_CSS.INK;
    c.add(scene.add.text(PAD + 10, dy, `${checkmark}  ${ch.description}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: col,
    }));
    const rwdStr = ch.reward.gems ? `💎${ch.reward.gems}` : '';
    c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, dy, done ? '완료' : `${prog}/${ch.objective.target}  ${rwdStr}`, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: done ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0));
    dy += 26;
  });

  // Summary footer
  c.add(scene.add.text(PAD + 10, dy + 2, `${dailyView.completedCount}/${challenges.length} 완료`, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
    color: allDone ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
  }));
  c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, dy + 2, `총 보상: 💎${dailyView.totalRewardGems}`, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
  }).setOrigin(1, 0));
}
