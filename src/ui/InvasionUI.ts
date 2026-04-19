// ─── InvasionUI ───────────────────────────────────────────────────────────────
// Invasion-alert UI extracted from DungeonHomeScene.
// Covers: detecting an active invasion quest, pulsing the grid zone,
// showing / dismissing the banner, countdown reminder icon, and transitioning
// to PreBattleScene.

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { getQuest, type InvasionConfig } from '../data/quests';
import type { GameState } from '../data/wisdom';
import { SLOT_H } from './RoomSlotRenderer';

// ─── State ───────────────────────────────────────────────────────────────────

export interface InvasionUIState {
  invasionConfig?: InvasionConfig;
  alertBanner?: Phaser.GameObjects.Container;
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
  const quest = getQuest(gs.activeMainQuestId);
  if (!quest?.invasionOnComplete) return;
  const defObj = quest.objectives.find(o => o.type === 'defend_invasion');
  if (!defObj) return;
  const prog    = gs.questProgress[quest.id];
  const current = prog?.objectives[defObj.id] ?? 0;
  if (current > 0) return; // already fought

  state.invasionConfig = quest.invasionOnComplete;
  state.cachedGs = gs;
  showZoneAPulse(scene, gridStartY, gridRows, slotPadY);
  scene.time.delayedCall(1500, () => showInvasionBanner(scene, state, () => goToPreBattle(scene, gs, state)));
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

  const c = scene.add.container(0, -110).setDepth(60);

  const bg = scene.add.graphics();
  bg.fillStyle(0x660000, 1);
  bg.fillRect(0, 0, CANVAS_WIDTH, 104);
  bg.lineStyle(2, 0xc8921a, 0.8);
  bg.lineBetween(0, 104, CANVAS_WIDTH, 104);
  c.add(bg);

  c.add(scene.add.text(18, 10, '⚠️  침략 발생!', {
    fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ff7755', fontStyle: 'bold',
  }));
  c.add(scene.add.text(18, 34, `${cfg.name}이(가) 쳐들어온다!`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0c8a0',
  }));
  const waveCount = cfg.waves.length;
  c.add(scene.add.text(18, 52, `🌊 총 ${waveCount} 웨이브`, {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc8844',
  }));

  const prepBtn = scene.add.text(CANVAS_WIDTH - 16, 60, '방어 준비 →', {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f0e6c8', fontStyle: 'bold',
    backgroundColor: '#8b0000', padding: { x: 10, y: 5 },
  }).setOrigin(1, 0).setInteractive();
  prepBtn.on('pointerdown', () => onPrepare());
  c.add(prepBtn);

  const laterBtn = scene.add.text(16, 62, '잠시 후에', {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#886644',
  }).setInteractive();
  laterBtn.on('pointerdown', () => dismissBanner(scene, state));
  c.add(laterBtn);

  state.alertBanner = c;

  // Slide down
  c.setY(-110);
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
    targets: banner, y: -110,
    duration: 200, ease: 'Quad.easeIn',
    onComplete: () => { banner.destroy(); showReminderIcon(scene, state); },
  });
}

// ─── Reminder icon ───────────────────────────────────────────────────────────

export function showReminderIcon(
  scene: Phaser.Scene,
  state: InvasionUIState,
): void {
  if (state.reminderIcon) return;

  const COUNTDOWN_MS = 15 * 60 * 1000;
  const getLabel = (): string => {
    const elapsed   = Date.now() - (state.invasionShownAt || Date.now());
    const remaining = Math.max(0, COUNTDOWN_MS - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `🔴  침략  ${mins}:${String(secs).padStart(2, '0')} 후 — 탭하여 준비`;
  };

  state.reminderIcon = scene.add.text(CANVAS_WIDTH / 2, 72, getLabel(), {
    fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ff5544',
    backgroundColor: '#2a0000', padding: { x: 10, y: 5 },
  }).setOrigin(0.5).setDepth(30).setInteractive();

  const timerEvent = scene.time.addEvent({
    delay: 1000,
    repeat: 14 * 60 + 59,
    callback: () => {
      if (state.reminderIcon?.active) state.reminderIcon.setText(getLabel());
    },
  });

  state.reminderIcon.on('pointerdown', () => {
    timerEvent.remove();
    state.reminderIcon?.destroy();
    state.reminderIcon = undefined;
    if (!state.cachedGs) return;
    showInvasionBanner(scene, state, () => goToPreBattle(scene, state.cachedGs!, state));
  });
  scene.tweens.add({
    targets: state.reminderIcon, alpha: { from: 0.55, to: 1.0 },
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
  state.reminderIcon?.destroy();
  state.reminderIcon = undefined;

  const quest = getQuest(gs.activeMainQuestId);
  scene.registry.set('invasionConfig', quest?.invasionOnComplete ?? state.invasionConfig);
  scene.registry.set('questId', gs.activeMainQuestId);

  scene.cameras.main.fadeOut(280, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start('PreBattleScene');
  });
}
