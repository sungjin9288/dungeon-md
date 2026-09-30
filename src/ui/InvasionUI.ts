// ─── InvasionUI ───────────────────────────────────────────────────────────────
// Invasion-alert UI extracted from DungeonHomeScene.
// Covers: detecting an active invasion quest, pulsing the grid zone,
// showing / dismissing the banner, countdown reminder icon, and transitioning
// to PreBattleScene.

import Phaser from 'phaser';
import { whenHomeModalsClear } from './homeModalQueue';
import { CANVAS_WIDTH } from '../constants/layout';
import { getPendingQuestInvasion, getQuest, type InvasionConfig } from '../data/quests';
import type { GameState } from '../data/wisdom';
import { addFramedPanel, addPrimaryActionButton } from './GameUiPrimitives';
import { SLOT_H } from './RoomSlotRenderer';
import { getReducedMotion } from '../utils/reducedMotion';

// ─── State ───────────────────────────────────────────────────────────────────

export interface InvasionUIState {
  invasionConfig?: InvasionConfig;
  alertBanner?: Phaser.GameObjects.Container;
  reminderBanner?: Phaser.GameObjects.Container;
  reminderIcon?: Phaser.GameObjects.Text;
  invasionShownAt: number;
  /** Cached gs for use when the reminder icon is tapped after the initial banner. */
  cachedGs?: GameState;
}

export function createInvasionUIState(): InvasionUIState {
  return { invasionShownAt: 0 };
}

// ─── Check ───────────────────────────────────────────────────────────────────

/**
 * Inspect the active quest for an pending invasion objective.
 * If found, stores the config and kicks off the pulse + banner sequence.
 */
export function checkForInvasion(
  scene: Phaser.Scene,
  gs: GameState,
  state: InvasionUIState,
  gridStartY: number,
  gridRows: number,
  slotPadY: number,
): void {
  const invasion = getPendingQuestInvasion(gs);
  if (!invasion) return;

  state.invasionConfig = invasion;
  state.cachedGs = gs;
  showZoneAPulse(scene, gridStartY, gridRows, slotPadY);
  // The alert waits behind any open home modal instead of stacking on top of it.
  scene.time.delayedCall(1500, () => whenHomeModalsClear(scene, () => showInvasionBanner(scene, state, () => goToPreBattle(scene, gs, state))));
}

// ─── Zone A pulse ────────────────────────────────────────────────────────────

export function showZoneAPulse(
  scene: Phaser.Scene,
  gridStartY: number,
  gridRows: number,
  slotPadY: number,
): void {
  const overlay = scene.add.graphics().setDepth(15).setAlpha(0);
  overlay.fillStyle(0xff0000, 1);
  overlay.fillRect(0, gridStartY, CANVAS_WIDTH, gridRows * (SLOT_H + slotPadY));
  scene.tweens.add({
    targets: overlay, alpha: 0.22,
    duration: 450, yoyo: true, repeat: 2, ease: 'Linear',
    onComplete: () => overlay.destroy(),
  });
}

// ─── Banner ──────────────────────────────────────────────────────────────────

export function showInvasionBanner(
  scene: Phaser.Scene,
  state: InvasionUIState,
  onPrepare: () => void,
): void {
  if (state.alertBanner) return;
  const cfg = state.invasionConfig;
  if (!cfg) return;
  if (!state.invasionShownAt) state.invasionShownAt = Date.now();

  const bannerH = 150;
  const c = scene.add.container(0, -bannerH).setDepth(60);

  const frame = addFramedPanel(scene, {
    x: 12,
    y: 10,
    w: CANVAS_WIDTH - 24,
    h: 132,
    radius: 9,
    fillColor: 0x1a0800,
    borderColor: 0xff6655,
    borderAlpha: 0.86,
    accentColor: 0xff6655,
    accentAlpha: 0.82,
    glowColor: 0xff6655,
    glowOpacity: 0.10,
    shadowOpacity: 0.68,
    shadowOffsetY: 4,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  c.add(scene.add.text(24, 24, '침략 발생', {
    fontFamily: 'Georgia, serif', fontSize: '17px', color: '#ff7755', fontStyle: 'bold',
  }));
  c.add(scene.add.text(24, 47, cfg.name, {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0c8a0',
  }));
  const waveCount = cfg.waves.length;
  c.add(scene.add.text(24, 69, `총 ${waveCount} 웨이브\n실패 시 퀘스트 진행 불가`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#cc8844', lineSpacing: 3,
  }));

  const prepBtn = addPrimaryActionButton(scene, {
    x: CANVAS_WIDTH - 152,
    y: 48,
    w: 124,
    h: 44,
    label: '방어 준비',
    fontSize: '13px',
    once: true,
    onPress: onPrepare,
  });
  c.add([prepBtn.bg, prepBtn.text, prepBtn.zone]);

  const laterBg = scene.add.graphics();
  laterBg.fillStyle(0x120904, 0.88);
  laterBg.fillRoundedRect(CANVAS_WIDTH - 152, 98, 124, 34, 8);
  laterBg.lineStyle(1, 0x3a2810, 0.72);
  laterBg.strokeRoundedRect(CANVAS_WIDTH - 152, 98, 124, 34, 8);
  c.add(laterBg);

  const laterBtn = scene.add.text(CANVAS_WIDTH - 90, 115, '잠시 후에', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#9a7650',
  }).setOrigin(0.5);
  const laterZone = scene.add.zone(CANVAS_WIDTH - 152, 94, 124, 42).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  laterZone.on('pointerover', () => laterBtn.setColor('#c8921a'));
  laterZone.on('pointerout', () => laterBtn.setColor('#9a7650'));
  laterZone.on('pointerdown', () => dismissBanner(scene, state));
  c.add([laterBtn, laterZone]);

  state.alertBanner = c;

  // Slide down
  c.setY(-bannerH);
  scene.tweens.add({ targets: c, y: 0, duration: 200, ease: 'Quad.easeOut' });
}

// ─── Dismiss ─────────────────────────────────────────────────────────────────

export function dismissBanner(
  scene: Phaser.Scene,
  state: InvasionUIState,
): void {
  const banner = state.alertBanner;
  if (!banner) return;
  state.alertBanner = undefined;
  scene.tweens.add({
    targets: banner, y: -150,
    duration: 200, ease: 'Quad.easeIn',
    onComplete: () => { banner.destroy(); showReminderIcon(scene, state); },
  });
}

// ─── Reminder icon ───────────────────────────────────────────────────────────

export function showReminderIcon(
  scene: Phaser.Scene,
  state: InvasionUIState,
): void {
  if (state.reminderBanner) return;

  const COUNTDOWN_MS = 15 * 60 * 1000;
  const getLabel = (): string => {
    const elapsed   = Date.now() - (state.invasionShownAt || Date.now());
    const remaining = Math.max(0, COUNTDOWN_MS - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `⚔ 침략 ${mins}:${String(secs).padStart(2, '0')}`;
  };

  // A compact chip at the right end of the quest line (y 64–86): a full-width pill here
  // covered the quest objective text. Tapping it reopens the invasion alert.
  const CHIP_W = 96;
  const CHIP_H = 20;
  const c = scene.add.container(CANVAS_WIDTH - 8 - CHIP_W / 2, 75).setDepth(30);
  const frame = addFramedPanel(scene, {
    x: -CHIP_W / 2,
    y: -CHIP_H / 2,
    w: CHIP_W,
    h: CHIP_H,
    radius: 9,
    fillColor: 0x220400,
    borderColor: 0xff6655,
    borderAlpha: 0.8,
    accentColor: 0xff6655,
    accentAlpha: 0.5,
    glowColor: 0xff6655,
    glowOpacity: 0.06,
    shadowOpacity: 0.3,
    shadowOffsetY: 1,
  });
  c.add([frame.shadow, frame.panel, frame.glow]);

  state.reminderIcon = scene.add.text(0, 0, getLabel(), {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#ff7766', fontStyle: 'bold',
  }).setOrigin(0.5);

  const zone = scene.add.zone(-CHIP_W / 2, -22, CHIP_W, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => state.reminderIcon?.setColor('#ff9977'));
  zone.on('pointerout', () => state.reminderIcon?.setColor('#ff7766'));
  c.add([state.reminderIcon, zone]);
  state.reminderBanner = c;

  const timerEvent = scene.time.addEvent({
    delay: 1000,
    repeat: 14 * 60 + 59,
    callback: () => {
      if (state.reminderIcon?.active) state.reminderIcon.setText(getLabel());
    },
  });

  zone.on('pointerdown', () => {
    timerEvent.remove();
    state.reminderBanner?.destroy(true);
    state.reminderBanner = undefined;
    state.reminderIcon = undefined;
    if (!state.cachedGs) return;
    showInvasionBanner(scene, state, () => goToPreBattle(scene, state.cachedGs!, state));
  });
  scene.tweens.add({
    targets: c, alpha: { from: 0.72, to: 1.0 },
    duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
}

// ─── Go to battle ────────────────────────────────────────────────────────────

export function goToPreBattle(
  scene: Phaser.Scene,
  gs: GameState,
  state: InvasionUIState,
): void {
  state.alertBanner?.destroy();
  state.alertBanner = undefined;
  state.reminderBanner?.destroy(true);
  state.reminderBanner = undefined;
  state.reminderIcon?.destroy();
  state.reminderIcon = undefined;

  const quest = getQuest(gs.activeMainQuestId);
  scene.registry.set('invasionConfig', quest?.invasionOnComplete ?? state.invasionConfig);
  scene.registry.set('questId', gs.activeMainQuestId);

  if (getReducedMotion()) {
    scene.scene.start('PreBattleScene');
    return;
  }
  scene.cameras.main.fadeOut(280, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start('PreBattleScene');
  });
}
