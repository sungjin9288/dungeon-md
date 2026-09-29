// ─── Forecast tray (오늘의 손님) ──────────────────────────────────────────────
// Home's daily decision surface: the three forecast cards, the dungeon's name
// (notoriety tier and the sign-raising control), and a link to the day's
// records. Battle cards launch DungeonScene the same way a story invasion does
// (inline waves + returnTo) and tag the registry with the card id so the
// return settles through settleForecastBattle. The merchant settles here.
//
// Layout stays inside the Daily hub's frame (20px inset, 356px tall) so the
// modal harness measures it against the same 390×844 contract.

import Phaser from 'phaser';
import { drawSigil, type SigilKind } from './Sigils';
import type { DungeonHomeScene } from '../scenes/DungeonHomeScene';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { audioManager } from '../audio/AudioManager';
import { getReducedMotion } from '../utils/reducedMotion';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from './GameUiPrimitives';
import { showToast } from './Toast';
import { showDailyContentHub } from './DailyContentPanel';
import { INVADER_DEFS } from '../data/invaders';
import { getTodayString } from '../data/daily';
import { isBattleCard, type ForecastCard, type ForecastKind } from '../data/forecast';
import { isForecastCardTaken, takeForecastCard, merchantPayout } from '../data/forecastTransactions';
import { type GameState } from '../data/wisdom';
import { settleIdleAcrossChange } from '../data/idleIncome';
import {
  canRaiseNotorietyTier,
  getNotorietyTier,
  nextNotorietyThreshold,
  raiseNotorietyTier,
} from '../data/notoriety';

/** Guest kind → line sigil (was emoji). Tinted with the card's accent. */
const KIND_SIGIL: Readonly<Record<ForecastKind, SigilKind>> = {
  raid: 'swords', elite: 'shield', merchant: 'coin', pilgrim: 'flame', treasure: 'chest', weekly_boss: 'skull', daily_rule: 'scroll',
};

const KIND_ACCENT: Readonly<Record<ForecastKind, number>> = {
  raid: CASUAL.GOLD, elite: CASUAL.RED, merchant: CASUAL.GREEN, pilgrim: CASUAL.BLUE,
  treasure: CASUAL.PURPLE, weekly_boss: CASUAL.PURPLE, daily_rule: CASUAL.BLUE,
};

function rewardSummary(card: ForecastCard, gs: GameState): string {
  const parts: string[] = [];
  // The merchant's take depends on what the player is holding, so read the
  // payout function rather than the card's own constant — those two used to
  // disagree by 3x on an empty material stock.
  if (card.kind === 'merchant') parts.push(`골드 ${merchantPayout(gs, card.bandTier).gold}`);
  else if (card.reward.gold) parts.push(`골드 ${card.reward.gold}`);
  if (card.reward.gems) parts.push(`보석 ${card.reward.gems}`);
  if (card.reward.soulCrystals) parts.push(`수정 ${card.reward.soulCrystals}`);
  if (card.daily) parts.push(`수정 ${card.daily.rewards.crystals}`);
  if (card.reward.notoriety) parts.push(`명성 +${card.reward.notoriety}`);
  return parts.join(' · ') || '보상 없음';
}

function guestSummary(card: ForecastCard): string {
  if (card.kind === 'merchant') return '전투 없음 · 광석·약초·천·가루를 사 갑니다';
  const names = card.preview.invaderTypes.slice(0, 3).map(type => INVADER_DEFS[type]?.koreanName ?? type);
  const traits = card.preview.traitBlurbs[0];
  const waves = card.waves?.length ?? 0;
  return `${waves}웨이브 · ${names.join('·')}${traits ? ` · ${traits}` : ''}`;
}

function launchForecastBattle(scene: DungeonHomeScene, card: ForecastCard): void {
  if (!isBattleCard(card)) return;
  scene.registry.set('stageConfig', { waves: card.waves, dungeonHp: card.dungeonHp, chapter: card.bandTier });
  scene.registry.set('returnTo', 'DungeonHomeScene');
  scene.registry.set('forecastCardId', card.id);
  // The battle scene owns these modes' rules and rewards; the card only names them.
  if (card.daily) scene.registry.set('dailyMode', card.daily);
  if (card.weeklyBoss) scene.registry.set('weeklyBossMode', { boss: card.weeklyBoss });
  const start = (): void => {
    scene.scene.stop('DungeonHomeScene');
    scene.scene.start('DungeonScene');
  };
  if (getReducedMotion()) { start(); return; }
  scene.cameras.main.fadeOut(220, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', start);
}

export function showForecastTray(scene: DungeonHomeScene): void {
  if (scene.children.getByName('forecast-tray')) return;
  const gs = scene.gs;
  const today = getTodayString();
  const cards = gs.forecast?.date === today ? gs.forecast.cards : [];

  const container = scene.add.container(0, 0).setDepth(95).setName('forecast-tray');
  const close = (): void => container.destroy(true);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.58);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  container.add(dim);

  const panelX = 20;
  const panelY = 168;
  const panelW = CANVAS_WIDTH - panelX * 2;
  const panelH = 420;
  const panel = addFramedPanel(scene, {
    x: panelX, y: panelY, w: panelW, h: panelH, radius: 16,
    fillColor: CASUAL.PANEL, borderColor: CASUAL.EDGE, borderAlpha: 0.9, borderWidth: 2,
    accentColor: CASUAL.GOLD, accentAlpha: 0.9, glowColor: CASUAL.GOLD, glowOpacity: 0.08,
    shadowOpacity: 0.5, shadowOffsetY: 5,
  });
  container.add([panel.shadow, panel.panel, panel.glow]);
  container.add(scene.add.text(panelX + 20, panelY + 24, '◆ 오늘의 손님', {
    fontFamily: 'Georgia, serif', fontSize: '18px', color: CASUAL_CSS.INK, fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  // ── The dungeon's name ────────────────────────────────────────────────────
  const tier = getNotorietyTier(gs);
  const threshold = nextNotorietyThreshold(gs);
  const points = gs.notoriety ?? 0;
  const canRaise = canRaiseNotorietyTier(gs);
  const nameLine = threshold === null
    ? `명성 ${tier}단계 · 최고 명성`
    : `명성 ${tier}단계 · ${points} / ${threshold}`;
  container.add(scene.add.text(panelX + 20, panelY + 46, nameLine, {
    fontFamily: 'sans-serif', fontSize: '11px', color: canRaise ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  if (canRaise) {
    const raise = addPrimaryActionButton(scene, {
      x: panelX + panelW - 156, y: panelY + 24, w: 104, h: 44,
      label: '간판 올리기', fontSize: '11px', enabled: true, once: true,
      fillColor: CASUAL.GOLD, hoverFillColor: CASUAL.GOLD, borderColor: CASUAL.GOLD_DK, hoverBorderColor: CASUAL.GOLD_DK,
      onPress: () => {
        audioManager.playSfx('button_click');
        const raised = raiseNotorietyTier(scene.gs);
        // A higher tier raises the idle gold multiplier: settle the old rate first.
        const result = scene.applyGameStateResult({
          ...raised, changed: true,
          state: raised.ok ? settleIdleAcrossChange(scene.gs, raised.state, Date.now()) : raised.state,
        });
        if (!result.ok) return;
        showToast(scene, `명성 ${result.tier}단계 — 더 강하고 더 부유한 손님이 옵니다`, { color: '#ffd166' });
        close();
        scene.refreshHomeDynamicPanels();
        showForecastTray(scene);
      },
    });
    container.add([raise.bg, raise.text, raise.zone]);
  }

  const closeText = scene.add.text(panelX + panelW - 24, panelY + 26, '×', {
    fontFamily: 'sans-serif', fontSize: '22px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
  }).setOrigin(0.5);
  const closeZone = scene.add.zone(panelX + panelW - 24, panelY + 26, 44, 44)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => { audioManager.playSfx('button_click'); close(); });
  container.add([closeText, closeZone]);

  // ── Cards ─────────────────────────────────────────────────────────────────
  const rowX = panelX + 12;
  const rowW = panelW - 24;
  const rowH = 82;
  if (cards.length === 0) {
    container.add(scene.add.text(panelX + panelW / 2, panelY + 160, '오늘의 손님이 아직 정해지지 않았습니다.', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
  }
  cards.forEach((card, index) => {
    const y = panelY + 66 + index * (rowH + 8);
    const taken = isForecastCardTaken(gs, card.id);
    const accent = taken ? CASUAL.EDGE_SOFT : KIND_ACCENT[card.kind];
    const frame = addFramedPanel(scene, {
      x: rowX, y, w: rowW, h: rowH, radius: GAME_UI.radius.row,
      fillColor: CASUAL.PANEL_SOFT, borderColor: accent, borderAlpha: taken ? 0.3 : 0.48, borderWidth: 1.5,
      accentColor: accent, accentAlpha: taken ? 0.4 : 0.9, glowOpacity: 0, shadowOpacity: 0.12, shadowOffsetY: 2,
    });
    container.add([frame.shadow, frame.panel, frame.glow]);
    const kindG = scene.add.graphics();
    drawSigil(kindG, KIND_SIGIL[card.kind], rowX + 24, y + 26, 24, accent, { alpha: taken ? 0.5 : 1 });
    container.add(kindG);
    container.add(scene.add.text(rowX + 48, y + 18, `${card.title} · ${card.bandTier}단계`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: taken ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    container.add(scene.add.text(rowX + 48, y + 38, guestSummary(card), {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, wordWrap: { width: rowW - 150 },
    }).setOrigin(0, 0.5));
    container.add(scene.add.text(rowX + 48, y + 60, taken ? '오늘 처리 완료' : rewardSummary(card, gs), {
      fontFamily: 'sans-serif', fontSize: '10px', color: taken ? CASUAL_CSS.GREEN : CASUAL_CSS.GOLD, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const action = addPrimaryActionButton(scene, {
      x: rowX + rowW - 88, y: y + 19, w: 76, h: 44,
      label: taken ? '완료' : card.kind === 'merchant' ? '거래' : '맞이',
      fontSize: '12px', enabled: !taken, once: true,
      fillColor: accent, hoverFillColor: accent, borderColor: accent, hoverBorderColor: accent,
      onPress: () => {
        audioManager.playSfx('button_click');
        const took = takeForecastCard(scene.gs, card.id);
        if (!took.ok) return;
        scene.applyGameStateResult({ ...took, changed: true });
        if (card.kind === 'merchant') {
          showToast(scene, `${card.title} — 골드 +${took.goldEarned}`, { color: '#9fe1cb' });
          close();
          scene.refreshHomeDynamicPanels();
          return;
        }
        close();
        launchForecastBattle(scene, card);
      },
    });
    container.add([action.bg, action.text, action.zone]);
  });

  // ── Records link ──────────────────────────────────────────────────────────
  const linkY = panelY + panelH - 26;
  const link = scene.add.text(panelX + panelW / 2, linkY, '도전 과제 · 출석 보상 보기', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.BLUE, fontStyle: 'bold',
  }).setOrigin(0.5).setName('forecast-records-link');
  const linkZone = scene.add.zone(panelX + panelW / 2, linkY, 200, 44).setInteractive({ useHandCursor: true })
    .on('pointerdown', () => { audioManager.playSfx('button_click'); close(); showDailyContentHub(scene); });
  container.add([link, linkZone]);

  if (!getReducedMotion()) {
    container.setAlpha(0);
    scene.tweens.add({ targets: container, alpha: 1, duration: 140, ease: 'Quad.easeOut' });
  }
}
