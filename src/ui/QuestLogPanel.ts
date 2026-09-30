/**
 * Quest log panel: main quest card, sub quests, and daily mini quests.
 */

import Phaser from 'phaser';
import { trackHomeModal } from './homeModalQueue';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
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
import { addQuestSpeakerVisual } from './QuestSpeakerView';
import { addSigil } from './Sigils';
import { questUnlockLabel } from '../data/dmTitles';
import { questObjectiveDestination } from '../data/questRoutes';
import { settleIdleAcrossChange } from '../data/idleIncome';

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

/**
 * Main-quest result overlays dismiss by restarting Home, so they must sit above
 * every Home edit layer that can trigger a settlement: room detail (100),
 * room pickers (110) and the placement tray (120).
 */
export const MAIN_QUEST_RESULT_DEPTH = 130;

export function showQuestCompleteOverlay(scene: Phaser.Scene, quest: MainQuest): void {
  const c = scene.add.container(0, 0).setDepth(MAIN_QUEST_RESULT_DEPTH);
  trackHomeModal(scene, c);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  c.add(dim);

  const rows = buildQuestRewardRows(quest);

  // Panel
  const PW = 320;
  const PH = Math.max(248, 176 + rows.length * 27);
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

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 30, '퀘스트 완료', {
    fontFamily: 'sans-serif', fontSize: '21px',
    color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    stroke: '#11131f', strokeThickness: 2,
  }).setOrigin(0.5));

  c.add(scene.add.text(CANVAS_WIDTH / 2, PY + 62, quest.title, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    align: 'center', wordWrap: { width: PW - 48, useAdvancedWrap: true },
  }).setOrigin(0.5));

  const div = scene.add.graphics();
  div.lineStyle(2, CASUAL.EDGE_SOFT, 0.6);
  div.lineBetween(PX + 22, PY + 82, PX + PW - 22, PY + 82);
  c.add(div);

  rows.forEach((row, i) => {
    const refs = addInfoRow(scene, {
      ...row,
      x: PX + 24,
      y: PY + 96 + i * 26,
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
    y: PY + PH - 58,
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
  const c = scene.add.container(0, 0).setDepth(MAIN_QUEST_RESULT_DEPTH);
  trackHomeModal(scene, c);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
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
    stroke: '#0a0806', strokeThickness: 4,
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
    rows.push({ icon: '💠', label: '영혼 결정', value: `+${quest.reward.soulCrystals.toLocaleString('ko-KR')}`, valueColor: cosmic ? COSMIC_ACCENT_CSS : CASUAL_CSS.BLUE, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  if (quest.reward.dmXP) {
    rows.push({ icon: '✨', label: 'DM XP', value: `+${quest.reward.dmXP.toLocaleString('ko-KR')}`, valueColor: cosmic ? COSMIC_TEXT : CASUAL_CSS.INK, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  }
  quest.reward.unlocks?.forEach(unlock => {
    const value = questUnlockLabel(unlock);
    if (!value) return;
    rows.push({ icon: '🔓', label: '해금', value, valueColor: cosmic ? COSMIC_ACCENT_CSS : CASUAL_CSS.GOLD, fillColor: cosmic ? COSMIC_ROW_FILL : QUEST_ROW_FILL });
  });
  return rows;
}

// ─── Quest log panel state & methods ────────────────────────────────────────

export interface QuestLogState {
  questLogOpen: boolean;
  questLogContainer?: Phaser.GameObjects.Container;
  /** Scene change for an objective's "바로 가기"; the route is hidden without it. */
  navigate?: (sceneKey: string) => void;
  /** Owner's save (Home's persistGameState) so its in-memory state follows. */
  persist?: (next: GameState) => void;
}

/**
 * Save a quest-log change. Writing storage behind Home's back let Home's stale
 * copy overwrite a claimed sub-quest reward on its next save (and reopen it).
 */
export function commitQuestLogState(state: QuestLogState, next: GameState): void {
  if (state.persist) state.persist(next);
  else saveGameState(next);
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
  // Above the invasion banner (60), below Home's result overlays (70+).
  const c = scene.add.container(0, 0).setDepth(65);

  // Full-screen background
  const bg = scene.add.graphics();
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Graphics has no size of its own: without an explicit hit area the log's
  // tap-to-close never fired and taps reached Home's room cards and deck below.
  bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
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
    stroke: '#0a0806', strokeThickness: 4,
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
  }).setOrigin(0.5);
  c.add(closeBtn);
  const closeZone = scene.add.zone(CANVAS_WIDTH - 48, 2, 44, 44)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  closeZone.on('pointerdown', () => closeQuestLog(state, scene));
  c.add(closeZone);

  const subQuestView = prepareSubQuestLogViewState(gs);
  const workGs = subQuestView.state;
  if (subQuestView.changed) commitQuestLogState(state, workGs);

  let y = 56;
  y = drawMainQuestCard(scene, c, y, workGs, state.navigate
    ? (sceneKey: string) => { closeQuestLog(state, scene); state.navigate?.(sceneKey); }
    : undefined);
  y = drawSubQuestSection(scene, c, y, subQuestView, state);
  drawMiniQuestSection(scene, c, y, workGs, state);

  // Tap the background to close (its full-screen hit area is set above).
  bg.on('pointerdown', () => closeQuestLog(state, scene));

  return c;
}

// ─── Active main quest card ─────────────────────────────────────────────────

function drawMainQuestCard(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  y: number,
  gs: GameState,
  onRoute?: (sceneKey: string) => void,
): number {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;

  c.add(addSigil(scene, 'scroll', PAD + 7, y + 8, 14, DUNGEON_UI.BRASS));
  c.add(scene.add.text(PAD + 18, y, '메인 퀘스트', {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
  }));
  y += 22;

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

  const prog = gs.questProgress[quest.id];
  const cardTop = y;
  const innerX = PAD + 12;
  const innerWidth = CARD_W - 24;
  const cardContent = scene.add.container(0, 0);
  let contentY = cardTop + 12;

  // Compact ledger metadata stays above the title.
  const metadata = scene.add.graphics();
  metadata.fillStyle(DUNGEON_UI.BRASS, 1);
  metadata.fillRoundedRect(innerX, contentY, 48, 20, 5);
  metadata.lineStyle(1.5, DUNGEON_UI.BRASS_BRIGHT, 0.9);
  metadata.strokeRoundedRect(innerX, contentY, 48, 20, 5);
  metadata.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 1);
  metadata.fillCircle(PAD + CARD_W - 12, contentY + 10, 5);
  cardContent.add(metadata);
  cardContent.add(scene.add.text(innerX + 24, contentY + 10, `CH.${quest.chapter}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0.5));
  cardContent.add(scene.add.text(innerX + 58, contentY + 3, `[${quest.id}]`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
  }));
  contentY += 28;

  const title = scene.add.text(innerX, contentY, quest.title, {
    fontFamily: 'sans-serif', fontSize: '14px',
    color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
    wordWrap: { width: innerWidth, useAdvancedWrap: true },
    lineSpacing: 2,
  });
  cardContent.add(title);
  contentY = title.y + title.height + 10;

  // Exact speaker identity and first description line share one bounded art block.
  const speakerSize = 48;
  const speakerY = contentY;
  addQuestSpeakerVisual(
    scene, cardContent, innerX, speakerY, speakerSize, quest.npcSpeaker, quest.npcEmoji,
  );
  const speakerTextX = innerX + speakerSize + 12;
  const speakerTextWidth = innerWidth - speakerSize - 12;
  const speakerName = scene.add.text(speakerTextX, speakerY, quest.npcSpeaker, {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
    wordWrap: { width: speakerTextWidth, useAdvancedWrap: true },
  });
  cardContent.add(speakerName);
  const descLine = quest.description.split('\n')[0];
  const description = scene.add.text(
    speakerTextX,
    speakerName.y + speakerName.height + 5,
    `"${descLine}"`,
    {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: DUNGEON_UI_CSS.MUTED, fontStyle: 'italic',
      wordWrap: { width: speakerTextWidth, useAdvancedWrap: true },
      lineSpacing: 2,
    },
  );
  cardContent.add(description);
  contentY = Math.max(speakerY + speakerSize, description.y + description.height) + 12;

  // Each objective reserves a description band and a distinct progress band.
  quest.objectives.forEach((obj, oi) => {
    const cur = prog?.objectives[obj.id] ?? 0;
    const pct = Math.min(cur / obj.target, 1);
    const destination = onRoute && cur < obj.target ? questObjectiveDestination(obj.type) : null;
    const routeW = 82;
    const objectiveText = scene.add.text(innerX, contentY, `▸ ${obj.description}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: destination ? innerWidth - routeW - 8 : innerWidth, useAdvancedWrap: true },
    });
    cardContent.add(objectiveText);
    if (destination && onRoute) {
      const route = addPrimaryActionButton(scene, {
        x: innerX + innerWidth - routeW,
        y: contentY - 12,
        w: routeW,
        h: 44,
        label: '바로 가기',
        fontSize: '11px',
        fillColor: DUNGEON_UI.STONE_RAISED,
        hoverFillColor: DUNGEON_UI.IRON,
        borderColor: DUNGEON_UI.BRASS,
        hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
        textColor: DUNGEON_UI_CSS.BRASS,
        onPress: () => onRoute(destination),
      });
      cardContent.add([route.bg, route.text, route.zone]);
    }
    const progressY = objectiveText.y + objectiveText.height + 6;
    const progressValue = scene.add.text(innerX + innerWidth, progressY + 6, `${cur}/${obj.target}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    const barWidth = innerWidth - progressValue.width - 12;
    const progress = addProgressBar(scene, {
      x: innerX,
      y: progressY,
      w: barWidth,
      h: 12,
      ratio: pct,
      fillColor: DUNGEON_UI.BRASS_BRIGHT,
      trackColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.EDGE,
      delay: 80 + oi * 120,
    });
    cardContent.add([progress.track, progress.fill]);
    cardContent.add(progressValue);
    contentY = Math.max(progressY + 12, progressValue.y + progressValue.height / 2) + 12;
  });

  // Reward preview remains the final ledger row.
  const rwds: string[] = [];
  if (quest.reward.gold)         rwds.push(`골드 ${quest.reward.gold}`);
  if (quest.reward.soulCrystals) rwds.push(`결정 ${quest.reward.soulCrystals}`);
  if (quest.reward.dmXP)         rwds.push(`${quest.reward.dmXP}XP`);
  const shownUnlock = (quest.reward.unlocks ?? []).map(questUnlockLabel).find(Boolean);
  if (shownUnlock) rwds.push(`해금 ${shownUnlock}`);
  const reward = scene.add.text(innerX, contentY, `보상: ${rwds.join('  ')}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    wordWrap: { width: innerWidth, useAdvancedWrap: true },
    lineSpacing: 2,
  });
  cardContent.add(reward);
  const cardHeight = reward.y + reward.height + 12 - cardTop;

  const frame = addFramedPanel(scene, {
    x: PAD,
    y: cardTop,
    w: CARD_W,
    h: cardHeight,
    radius: 11,
    fillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.BRASS,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: DUNGEON_UI.BRASS_BRIGHT,
    accentAlpha: 1,
    glowColor: DUNGEON_UI.BRASS,
    glowOpacity: 0,
    shadowOpacity: 0.28,
    shadowOffsetY: 3,
  });
  c.add([frame.shadow, frame.panel, frame.glow, cardContent]);

  return cardTop + cardHeight + 14;
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

  c.add(addSigil(scene, 'swords', PAD + 7, y + 8, 14, CASUAL.INK));
  c.add(scene.add.text(PAD + 18, y, '서브 퀘스트', {
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
    c.add(scene.add.text(PAD + 10, y + 10, `${done ? '✓ ' : ''}${sq.title}`, {
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
    if (sq.reward.gold)         rwds.push(`골드 ${sq.reward.gold}`);
    if (sq.reward.soulCrystals) rwds.push(`결정 ${sq.reward.soulCrystals}`);
    if (sq.reward.dmXP)         rwds.push(`${sq.reward.dmXP}XP`);
    c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, y + 26, rwds.join(' '), {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    }).setOrigin(1, 0.5));

    // Claim button (only when done)
    if (done) {
      const btnW = 60;
      const btnX = CANVAS_WIDTH - PAD - 10 - btnW;
      const btnY = y + 38;
      const claim = (): void => {
        const before = loadGameState();
        const result = applySubQuestClaim(before, sq.id);
        if (!result.ok) return;
        const newGs = settleIdleAcrossChange(before, result.state, Date.now());
        commitQuestLogState(state, newGs);

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
      // The pill stays 18px tall; the touch target meets the 44px minimum.
      claimBtn.zone.setPosition(btnX, btnY + 9 - 22).setSize(btnW, 44);
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
  state: QuestLogState,
): void {
  const PAD    = 12;
  const CARD_W = CANVAS_WIDTH - PAD * 2;

  c.add(addSigil(scene, 'target', PAD + 7, y + 8, 14, CASUAL.INK));
  c.add(scene.add.text(PAD + 18, y, '일일 퀘스트', {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: CASUAL_CSS.INK, fontStyle: 'bold',
  }));
  y += 20;

  const dailyView = prepareDailyChallengeViewState(gs);
  const { challenges } = dailyView;
  const workGs = dailyView.state;
  if (dailyView.changed) commitQuestLogState(state, workGs);
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
    const rwdStr = ch.reward.gems ? `보석 ${ch.reward.gems}` : '';
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
  c.add(scene.add.text(CANVAS_WIDTH - PAD - 10, dy + 2, `총 보상: 보석 ${dailyView.totalRewardGems}`, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
  }).setOrigin(1, 0));
}
