// ─── Wave Start ────────────────────────────────────────────────────────────────
// Extracted from DungeonScene.startWave().
// Owns all state mutations and side-effects triggered when the player launches
// a new wave: HUD updates, per-wave reset, synergy timed events, spawn queue
// construction and dispatch.

import Phaser from 'phaser';
import { Invader } from '../objects/Invader';
import type { InvaderDef, InvaderType } from '../data/invaders';
import { INVADER_DEFS } from '../data/invaders';
import type { RoomData } from '../data/rooms';
import type { WaveSpec } from '../data/stages';
import type { DungeonSlot } from '../data/wisdom';
import { buildEndlessSpawnQueue } from '../data/endlessWave';
import { getEndlessModifierById } from '../data/endlessModifiers';
import { CSS } from '../constants/colors';
import { CANVAS_WIDTH, GRID_Y, GRID_ROWS } from '../constants/layout';
import { showFloatText } from './VisualEffects';
import {
  playWaveStartBanner,
  playEndlessRecordFlash,
} from './ImpactVfx';
import { logger } from '../utils/logger';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface WaveStartContext {
  readonly scene:             Phaser.Scene;
  readonly maxWave:           number;
  readonly isEndless:         boolean;
  readonly endlessHighScore:  number;
  readonly stageChapter:      number;
  readonly maxHp:             number;
  readonly effectiveCellSize: number;
  readonly roomGrid:          (RoomData | null)[][];
  readonly waveConfigs:       WaveSpec[];
  readonly dungeonTrapSlots:  DungeonSlot[];
  readonly activeInvaders:    Invader[];

  get wave():               number;    set wave(v: number);
  get waveActive():         boolean;   set waveActive(v: boolean);
  get endlessRecordBroken():boolean;   set endlessRecordBroken(v: boolean);
  get waveEndChecked():     boolean;   set waveEndChecked(v: boolean);
  get waveHasSpawned():     boolean;   set waveHasSpawned(v: boolean);
  get dungeonHp():          number;    set dungeonHp(v: number);
  get recentlyDeadInvaders(): InvaderDef[]; set recentlyDeadInvaders(v: InvaderDef[]);
  get tauntBoostActiveUntil(): number; set tauntBoostActiveUntil(v: number);
  get killsThisWave():      number;    set killsThisWave(v: number);
  get breakthruCount():     number;    set breakthruCount(v: number);
  get waveStartSlotHps():   number[];  set waveStartSlotHps(v: number[]);
  get waveStartDungeonHp(): number;    set waveStartDungeonHp(v: number);
  get waveInvaderTotal():   number;    set waveInvaderTotal(v: number);
  get killCounterText():    Phaser.GameObjects.Text | undefined;
  set killCounterText(v:    Phaser.GameObjects.Text | undefined);
  get waveGoldMult():       number;    set waveGoldMult(v: number);
  get waveHpMult():         number;    set waveHpMult(v: number);
  get waveAtkMult():        number;    set waveAtkMult(v: number);
  get waveSpdMult():        number;    set waveSpdMult(v: number);
  get waveFogOverlay():     Phaser.GameObjects.Graphics | undefined;
  set waveFogOverlay(v:     Phaser.GameObjects.Graphics | undefined);
  get spawnQueue():         Array<{ def: InvaderDef; delay: number }>;
  set spawnQueue(v:         Array<{ def: InvaderDef; delay: number }>);

  setWaveRegistry(v: number): void;
  setHpRegistry(v: number): void;
  setWaveLabelText(text: string, color: string): void;
  disableWaveButton(): void;
  hasSynergy(id: string): boolean;
  updateArmoryBonuses(): void;
  triggerScrollBurst(data: RoomData): void;
  showBossWarning(): void;
  processSpawnQueue(delay: number): void;
  showEndlessMilestoneToast(): void;
  showWaveEnemyPreview(): void;
}

// ─── startWave ────────────────────────────────────────────────────────────────

export function startWave(ctx: WaveStartContext): void {
  if (ctx.wave >= ctx.maxWave) return;
  ctx.wave++;
  ctx.waveActive = true;
  ctx.setWaveRegistry(ctx.wave);

  const isBoss = ctx.wave === ctx.maxWave && !ctx.isEndless;
  ctx.setWaveLabelText(`⚔  ${ctx.wave}번 침략 진행 중...`, CSS.PARCHMENT_MUTED);

  // Wave start banner (drops in, settles, retracts)
  playWaveStartBanner(ctx.scene, {
    text:        isBoss ? `👹  ${ctx.wave} / ${ctx.maxWave}  보스 출현!`
                        : `⚔  웨이브  ${ctx.wave} / ${ctx.maxWave}`,
    textColor:   isBoss ? '#ff6644' : '#f0e6c8',
    borderColor: isBoss ? 0xff4422  : 0xc8921a,
    onSettled:   () => ctx.showWaveEnemyPreview(),
  });

  // Endless mode: flash 🏆 the first time a personal best is exceeded
  if (ctx.isEndless && !ctx.endlessRecordBroken
      && ctx.endlessHighScore > 0 && ctx.wave > ctx.endlessHighScore) {
    ctx.endlessRecordBroken = true;
    playEndlessRecordFlash(ctx.scene);
  }

  ctx.disableWaveButton();
  ctx.waveEndChecked = false;
  ctx.waveHasSpawned = false;

  // ── Per-wave monster passive reset ──────────────────────────────────────────
  for (const row of ctx.roomGrid)
    for (const data of row)
      if (data) data.hasFirstStrikeUsed = false;

  // ── Per-wave hit / effect counters reset ────────────────────────────────────
  for (const row of ctx.roomGrid)
    for (const data of row) {
      if (!data) continue;
      data.foxCharmAttackCount    = 0;
      data.tideHitCount           = 0;
      data.venomHitCount          = 0;
      data.whirlwindHitCount      = 0;
      data.scrollBurstActiveUntil = 0;
      data.deathRattleLastTime    = 0;
    }

  ctx.recentlyDeadInvaders  = [];
  ctx.tauntBoostActiveUntil = 0;

  // ── Per-wave result stats ────────────────────────────────────────────────────
  ctx.killsThisWave      = 0;
  ctx.breakthruCount     = 0;
  ctx.waveStartSlotHps   = ctx.dungeonTrapSlots.map(s => s?.hp ?? 0);
  ctx.waveStartDungeonHp = ctx.dungeonHp;

  // ── Kill counter HUD ─────────────────────────────────────────────────────────
  ctx.waveInvaderTotal = ctx.waveConfigs[ctx.wave - 1]?.invaders?.reduce(
    (sum: number, inv: { count: number }) => sum + inv.count, 0) ?? 0;
  ctx.killCounterText?.destroy();
  ctx.killCounterText = ctx.scene.add.text(
    CANVAS_WIDTH - 8, GRID_Y + 14,
    `💀 0 / ${ctx.waveInvaderTotal || '?'}`,
    { fontFamily: 'sans-serif', fontSize: '11px', color: '#cc8844',
      stroke: '#000000', strokeThickness: 2 },
  ).setOrigin(1, 0).setDepth(92).setAlpha(0.85);

  // ── Wave event multipliers reset ─────────────────────────────────────────────
  ctx.waveGoldMult = 1;
  ctx.waveHpMult   = 1;
  ctx.waveAtkMult  = 1;
  ctx.waveSpdMult  = 1;
  if (ctx.waveFogOverlay) { ctx.waveFogOverlay.destroy(); ctx.waveFogOverlay = undefined; }

  if (ctx.stageChapter >= 3) ctx.updateArmoryBonuses();

  // ── STEAM_BURST (fire+frost combo): 25 dmg AoE every 10s ───────────────────
  if (ctx.hasSynergy('STEAM_BURST')) {
    ctx.scene.time.addEvent({
      delay: 10000, repeat: 8,
      callback: () => {
        if (!ctx.waveActive) return;   // reads live value via getter
        ctx.activeInvaders.forEach(i => { if (i.active) i.takeDamage(25); });
        const g = ctx.scene.add.graphics().setDepth(55);
        g.fillStyle(0x88ddff, 0.2);
        g.fillRect(0, GRID_Y, CANVAS_WIDTH, GRID_ROWS * ctx.effectiveCellSize);
        ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
      },
    });
  }

  // ── MOONLIGHT_MASS_HEAL (6 moonlight): heal 5% maxHp every 8s ───────────────
  if (ctx.hasSynergy('MOONLIGHT_MASS_HEAL')) {
    ctx.scene.time.addEvent({
      delay: 8000, repeat: 4,
      callback: () => {
        if (ctx.dungeonHp <= 0) return; // reads live value via getter
        const heal = Math.ceil(ctx.maxHp * 0.05);
        ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + heal);
        ctx.setHpRegistry(ctx.dungeonHp);
        showFloatText(ctx.scene, CANVAS_WIDTH / 2, 80, `🌙 +${heal}`, '#44ffaa');
      },
    });
  }

  // ── Lv3 scroll_library SCROLL_BURST: 2× magic rooms for 4000ms ───────────────
  for (const row of ctx.roomGrid)
    for (const data of row)
      if (data?.type === 'scroll_library' && data.level >= 3)
        ctx.triggerScrollBurst(data);

  // ── Spawn queue construction + dispatch ──────────────────────────────────────
  if (ctx.isEndless) {
    const modifier = getEndlessModifierById(ctx.scene.registry.get('endlessModifier') as string | null);
    ctx.spawnQueue = buildEndlessSpawnQueue(ctx.wave, modifier);
    ctx.showEndlessMilestoneToast();
    ctx.processSpawnQueue(0);
    logger.debug(`[ENDLESS WAVE ${ctx.wave}] spawning ${ctx.spawnQueue.length} invaders`);
  } else {
    const cfg = ctx.waveConfigs[Math.min(ctx.wave - 1, ctx.waveConfigs.length - 1)];
    const queue: Array<{ def: InvaderDef; delay: number }> = [];
    cfg.invaders.forEach((item: { type: InvaderType; count: number; spawnDelay: number }) => {
      for (let i = 0; i < item.count; i++) {
        queue.push({ def: INVADER_DEFS[item.type], delay: item.spawnDelay });
      }
    });
    ctx.spawnQueue = queue;

    const isBossWave = ctx.wave === ctx.maxWave;
    if (isBossWave) ctx.showBossWarning();
    ctx.processSpawnQueue(isBossWave ? 3000 : 0);
    logger.debug(`[WAVE ${ctx.wave}] spawning ${ctx.spawnQueue.length} invaders`);
  }
}
