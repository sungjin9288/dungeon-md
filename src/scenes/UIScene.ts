import Phaser from 'phaser';
import {
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
  ZONE_ACCENTS,
} from '../constants/colors';
import { getBattleHudSecondRowLayout } from '../ui/BattleHudLayout';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TOP_BAR_HEIGHT } from '../constants/layout';
import { getReducedMotion } from '../utils/reducedMotion';
import { getEndlessModifierById } from '../data/endlessModifiers';
import type { TraitCalloutPayload } from '../combat/TraitCallout';
import { loadBattleSpeed, saveBattleSpeed } from '../data/battleSpeedSetting';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private gemsText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Graphics;
  private hpText?: Phaser.GameObjects.Text;
  private waveLabel!: Phaser.GameObjects.Text;
  private waveProgress?: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private statusBg?: Phaser.GameObjects.Graphics;
  private speedBtn!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private remainingText?: Phaser.GameObjects.Text;
  private remainingPillBg?: Phaser.GameObjects.Graphics;
  private currentSpeed: 1 | 2 | 3 = 1;
  private isPaused = false;
  private vignetteG?: Phaser.GameObjects.Graphics;
  private hpPulseOverlay?: Phaser.GameObjects.Graphics;
  private hpPulseTween?: Phaser.Tweens.Tween;

  private gold    = 500;
  private gems    = 200;
  private hp      = 1000;
  private maxHp   = 1000;
  private wave    = 0;
  private maxWave = 10;

  constructor() { super({ key: 'UIScene' }); }

  create(): void {
    // Safe area is handled globally: index.html pads <body> with env(safe-area-inset-*),
    // so the canvas never sits under the notch — no per-element offset needed.
    const st = 0;
    this.safeTop = st;

    this.drawBar();
    this.createHUD();
    this.bindRegistry();
  }

  private safeTop = 0;

  private drawBar(): void {
    const st = this.safeTop;
    const g = this.add.graphics();

    // Fixed battle lintel: soot carries structure, ember marks the live front.
    g.fillStyle(DUNGEON_UI.SOOT, 0.98);
    g.fillRect(0, 0, CANVAS_WIDTH, TOP_BAR_HEIGHT + st);
    g.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(DUNGEON_UI.IRON, 0.92);
    g.fillRect(0, TOP_BAR_HEIGHT + st - 3, CANVAS_WIDTH, 3);
    g.fillStyle(ZONE_ACCENTS.invasion, 0.9);
    g.fillRect(18, TOP_BAR_HEIGHT + st - 3, 86, 3);
  }

  private createHUD(): void {
    const st = this.safeTop;
    const row = getBattleHudSecondRowLayout();

    // Sync initial values from registry (set by DungeonScene before UIScene launches)
    this.gold   = this.registry.get('gold')  ?? 500;
    this.gems   = this.registry.get('gems')  ?? 0;
    this.hp     = this.registry.get('hp')    ?? 1000;
    this.maxHp  = this.registry.get('hp')    ?? 1000;
    this.wave   = this.registry.get('wave')  ?? 0;
    this.maxWave = this.registry.get('maxWave') ?? 10;
    const isEndless = this.maxWave >= 9999;
    const endlessHS = isEndless
      ? this.registry.get('endlessHighScore') as number | undefined
      : undefined;
    const modifier = isEndless
      ? getEndlessModifierById(this.registry.get('endlessModifier') as string | null)
      : null;

    // ── Title ──────────────────────────────────────────────
    const titlePlate = this.add.graphics();
    titlePlate.fillStyle(DUNGEON_UI.STONE, 1);
    titlePlate.fillRoundedRect(10, st + 8, 154, 44, 7);
    titlePlate.fillStyle(ZONE_ACCENTS.invasion, 0.92);
    titlePlate.fillRect(10, st + 15, 3, 30);
    titlePlate.lineStyle(1.5, DUNGEON_UI.IRON, 1);
    titlePlate.strokeRoundedRect(10, st + 8, 154, 44, 7);

    // Main title
    this.add.text(18, st + 15, '침공 방어전', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    });
    this.add.text(18, st + 38, modifier ? `${modifier.icon} ${modifier.name}` : '전선 작전 · DUNGEON DEFENSE', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: modifier ? CASUAL_CSS.PURPLE : DUNGEON_UI_CSS.MUTED,
    });
    if (modifier) {
      this.add.zone(87, st + 30, 154, 44)
        .setName('endlessModifierControl')
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.showModifierToast(modifier.icon, modifier.name, modifier.desc));
      this.time.delayedCall(500, () => this.showModifierToast(modifier.icon, modifier.name, modifier.desc));
    }

    // ── Wave pill (left, row 2) — wave counter only ────────────────────────
    const wavePill = this.add.graphics();
    wavePill.fillStyle(DUNGEON_UI.STONE, 1);
    wavePill.fillRoundedRect(row.wave.x, st + row.wave.y, row.wave.width, row.wave.height, 5);
    wavePill.lineStyle(1, DUNGEON_UI.IRON, 1);
    wavePill.strokeRoundedRect(row.wave.x, st + row.wave.y, row.wave.width, row.wave.height, 5);

    this.waveLabel = this.add.text(row.wave.x + row.wave.width / 2, st + row.wave.y + 13, this.getWaveLabel(), {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5);
    this.waveProgress = this.add.graphics();
    this.redrawWaveProgress();

    // ── Speed toggle — separate mini pill ────────────────
    const speedPill = this.add.graphics();
    speedPill.fillStyle(DUNGEON_UI.STONE, 1);
    speedPill.fillRoundedRect(row.speed.x, st + row.speed.y, row.speed.width, row.speed.height, 6);
    speedPill.lineStyle(1.5, DUNGEON_UI.IRON, 1);
    speedPill.strokeRoundedRect(row.speed.x, st + row.speed.y, row.speed.width, row.speed.height, 6);

    // Restore the persisted speed preference (sticks across battles).
    this.currentSpeed = loadBattleSpeed();
    this.speedBtn = this.add.text(row.speed.x + row.speed.width / 2, st + row.speed.y + row.speed.height / 2, this.currentSpeed + 'x', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: this.currentSpeed > 1 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
    // Apply the restored speed to the battle (init seeded 1×, so a non-1×
    // preference registers as a change → DungeonScene.setSpeed via changedata).
    this.registry.set('battleSpeed', this.currentSpeed);
    this.add.zone(
      row.speed.x + row.speed.width / 2,
      st + row.speed.y + row.speed.height / 2,
      row.speed.width,
      row.speed.height,
    ).setName('battleSpeedControl').setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      // Cycle 1× → 2× → 3× → 1× (3× = grinding-friendly ultra speed).
      this.currentSpeed = (this.currentSpeed >= 3 ? 1 : this.currentSpeed + 1) as 1 | 2 | 3;
      this.speedBtn.setText(this.currentSpeed + 'x');
      this.speedBtn.setColor(this.currentSpeed > 1 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED);
      this.registry.set('battleSpeed', this.currentSpeed);
      saveBattleSpeed(this.currentSpeed);
      this.showSpeedToast(this.currentSpeed);
    });

    // ── Pause button (right of wave pill) ────────────────
    const pausePill = this.add.graphics();
    pausePill.fillStyle(DUNGEON_UI.STONE, 1);
    pausePill.fillRoundedRect(row.pause.x, st + row.pause.y, row.pause.width, row.pause.height, 6);
    pausePill.lineStyle(1.5, DUNGEON_UI.IRON, 1);
    pausePill.strokeRoundedRect(row.pause.x, st + row.pause.y, row.pause.width, row.pause.height, 6);

    this.pauseBtn = this.add.text(
      row.pause.x + row.pause.width / 2,
      st + row.pause.y + row.pause.height / 2,
      '⏸',
      { fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.TEXT },
    ).setOrigin(0.5);
    this.add.zone(
      row.pause.x + row.pause.width / 2,
      st + row.pause.y + row.pause.height / 2,
      row.pause.width,
      row.pause.height,
    ).setName('battlePauseControl').setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.isPaused = !this.isPaused;
      this.pauseBtn.setText(this.isPaused ? '▶' : '⏸');
      this.pauseBtn.setColor(this.isPaused ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.TEXT);
      this.registry.set('battlePaused', this.isPaused);
    });

    // ── Gold pill ─────────────────────────────────────────
    const gx = CANVAS_WIDTH - 196;
    const goldPill = this.add.graphics();
    goldPill.fillStyle(DUNGEON_UI.STONE, 1);
    goldPill.fillRoundedRect(gx, st + 8, 90, 30, 5);
    goldPill.lineStyle(1, DUNGEON_UI.IRON, 1);
    goldPill.strokeRoundedRect(gx, st + 8, 90, 30, 5);

    // coin icon
    goldPill.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 1);
    goldPill.fillCircle(gx + 13, st + 23, 7);
    goldPill.lineStyle(1.5, DUNGEON_UI.BRASS, 1);
    goldPill.strokeCircle(gx + 13, st + 23, 7);
    goldPill.fillStyle(0xffffff, 0.35);
    goldPill.fillCircle(gx + 11, st + 21, 3);

    this.goldText = this.add.text(gx + 26, st + 23, `골드 ${formatHudResourceValue(this.gold)}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);

    // ── Gem pill ─────────────────────────────────────────
    const px = CANVAS_WIDTH - 100;
    const gemPill = this.add.graphics();
    gemPill.fillStyle(DUNGEON_UI.STONE, 1);
    gemPill.fillRoundedRect(px, st + 8, 90, 30, 5);
    gemPill.lineStyle(1, DUNGEON_UI.IRON, 1);
    gemPill.strokeRoundedRect(px, st + 8, 90, 30, 5);

    // gem icon (diamond)
    gemPill.fillStyle(CASUAL.BLUE, 1);
    gemPill.fillTriangle(px + 13, st + 16, px + 7, st + 23, px + 19, st + 23);
    gemPill.fillStyle(CASUAL.PURPLE, 1);
    gemPill.fillTriangle(px + 13, st + 30, px + 7, st + 23, px + 19, st + 23);

    this.gemsText = this.add.text(px + 26, st + 23, `보석 ${formatHudResourceValue(this.gems)}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);

    // ── HP bar ────────────────────────────────────────────
    const hbx = row.hp.x;
    const hby = st + row.hp.y;
    const hbw = row.hp.width;
    const hbh = row.hp.height;

    this.add.text(hbx, hby - 1, '던전 내구도', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 1);

    const hpBg = this.add.graphics();
    hpBg.fillStyle(DUNGEON_UI.SOOT, 1);
    hpBg.fillRoundedRect(hbx, hby, hbw, hbh, 4);
    hpBg.lineStyle(1, DUNGEON_UI.IRON, 1);
    hpBg.strokeRoundedRect(hbx, hby, hbw, hbh, 4);

    this.hpFill = this.add.graphics();
    this.safeHby = hby;

    // Numerical HP readout — right-aligned above the bar (always legible regardless of fill)
    this.hpText = this.add.text(hbx + hbw, hby - 1, '', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(1, 1).setDepth(103);

    this.redrawHp();

    // ── Remaining invaders counter — mini pill below HP bar ──
    this.remainingPillBg = this.add.graphics();
    this.remainingPillBg.fillStyle(DUNGEON_UI.SOOT, 1);
    this.remainingPillBg.fillRoundedRect(row.remaining.x, st + row.remaining.y, row.remaining.width, row.remaining.height, 6);
    this.remainingPillBg.lineStyle(1, DUNGEON_UI.IRON, 1);
    this.remainingPillBg.strokeRoundedRect(row.remaining.x, st + row.remaining.y, row.remaining.width, row.remaining.height, 6);
    this.remainingPillBg.setAlpha(0);

    this.remainingText = this.add.text(
      row.remaining.x + row.remaining.width / 2,
      st + row.remaining.y + row.remaining.height / 2,
      '',
      {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
      },
    ).setOrigin(0.5, 0.5).setDepth(103);

    // ── Endless high score — shares the quiet status row below HP ──────────
    if (endlessHS !== undefined) {
      const hs = row.highScore;
      const highScorePill = this.add.graphics();
      highScorePill.fillStyle(DUNGEON_UI.SOOT, 1);
      highScorePill.fillRoundedRect(hs.x, st + hs.y, hs.width, hs.height, 6);
      highScorePill.lineStyle(1, DUNGEON_UI.IRON, 1);
      highScorePill.strokeRoundedRect(hs.x, st + hs.y, hs.width, hs.height, 6);
      this.add.text(hs.x + hs.width / 2, st + hs.y + hs.height / 2, `🏆 최고 ${formatHudResourceValue(endlessHS)}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
    }

    // ── Status text (wave info) ───────────────────────────
    this.statusBg = this.add.graphics().setDepth(104).setAlpha(0);
    this.statusBg.fillStyle(DUNGEON_UI.SOOT, 0.94);
    this.statusBg.fillRoundedRect(124, TOP_BAR_HEIGHT + st + 3, 142, 24, 5);
    this.statusBg.lineStyle(1, ZONE_ACCENTS.invasion, 0.72);
    this.statusBg.strokeRoundedRect(124, TOP_BAR_HEIGHT + st + 3, 142, 24, 5);
    this.statusText = this.add.text(CANVAS_WIDTH / 2, TOP_BAR_HEIGHT + st + 15, '', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5).setDepth(105);
  }

  private safeHby = 60;

  private getWaveLabel(): string {
    if (this.maxWave >= 9999) return this.wave > 0 ? `침략 ${this.wave}` : '침략 대기';
    return this.wave > 0 && this.wave === this.maxWave
      ? '⚠ 최종 침략!'
      : `침략 ${this.wave}/${this.maxWave}`;
  }

  private redrawWaveProgress(): void {
    if (!this.waveProgress) return;
    const st = this.safeTop;
    const g = this.waveProgress;
    g.clear();

    const endless = this.maxWave >= 9999;
    const pipCount = endless ? 5 : Phaser.Math.Clamp(this.maxWave || 1, 1, 10);
    const activeCount = endless
      ? (this.wave > 0 ? ((this.wave - 1) % pipCount) + 1 : 0)
      : Math.min(this.wave, pipCount);
    const row = getBattleHudSecondRowLayout();
    const startX = row.wave.x + 12;
    const y = st + row.wave.y + row.wave.height - 4;
    const gap = 7;

    for (let i = 0; i < pipCount; i++) {
      const active = i < activeCount;
      const current = active && i === activeCount - 1;
      g.fillStyle(active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE, active ? 1 : 0.68);
      g.fillCircle(startX + i * gap, y, current ? 2.6 : 2.1);
      if (current) {
        g.lineStyle(1, ZONE_ACCENTS.invasion, 0.9);
        g.strokeCircle(startX + i * gap, y, 4.1);
      }
    }
  }

  private redrawHp(): void {
    const row = getBattleHudSecondRowLayout();
    const hbx = row.hp.x, hby = this.safeHby, hbw = row.hp.width, hbh = row.hp.height;
    const pct  = this.hp / this.maxHp;
    const col  = pct > 0.6 ? DUNGEON_UI.JADE : pct > 0.3 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EMBER;
    this.hpFill.clear();
    this.hpFill.fillStyle(col, 1);
    this.hpFill.fillRoundedRect(hbx + 2, hby + 2, Math.max(1, (hbw - 4) * pct), hbh - 4, 3);
    this.hpText?.setText(`${this.hp} / ${this.maxHp}`);

    // HP danger pulse — start when ≤20%, stop when recovered
    if (pct <= 0.2 && !this.hpPulseTween && !getReducedMotion()) {
      if (!this.hpPulseOverlay) {
        this.hpPulseOverlay = this.add.graphics().setDepth(102);
        this.hpPulseOverlay.fillStyle(DUNGEON_UI.EMBER, 1);
        this.hpPulseOverlay.fillRoundedRect(hbx, hby, hbw, hbh, 4);
      }
      this.hpPulseTween = this.tweens.add({
        targets: this.hpPulseOverlay, alpha: { from: 0, to: 0.55 },
        duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (pct > 0.2 && this.hpPulseTween) {
      this.hpPulseTween.stop();
      this.hpPulseTween = undefined;
      this.hpPulseOverlay?.destroy();
      this.hpPulseOverlay = undefined;
    }
  }

  private flashDamageVignette(): void {
    if (!this.vignetteG) {
      const r = 55;
      this.vignetteG = this.add.graphics().setDepth(500);
      this.vignetteG.fillStyle(0xcc0000, 1);
      this.vignetteG.fillRect(0, 0, r, CANVAS_HEIGHT);
      this.vignetteG.fillRect(CANVAS_WIDTH - r, 0, r, CANVAS_HEIGHT);
      this.vignetteG.fillRect(0, 0, CANVAS_WIDTH, r);
      this.vignetteG.fillRect(0, CANVAS_HEIGHT - r, CANVAS_WIDTH, r);
      this.vignetteG.setAlpha(0);
    }
    this.tweens.killTweensOf(this.vignetteG);
    this.vignetteG.setAlpha(0.42);
    this.tweens.add({
      targets: this.vignetteG, alpha: 0,
      duration: 450, ease: 'Power2.easeOut',
    });
  }

  private bindRegistry(): void {
    // The registry is GAME-global: listeners outlive this scene unless removed.
    // Without the shutdown cleanup, a second battle in the same session fires
    // stale handlers on destroyed text objects and crashes (endless 재도전 등).
    const registryEvents = this.registry.events;
    const on = (key: string, fn: (...args: never[]) => void): void => {
      registryEvents.on(key, fn);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => registryEvents.off(key, fn));
    };
    on('changedata-gold', (_: unknown, v: number) => {
      this.gold = v; this.goldText?.setText(`골드 ${formatHudResourceValue(v)}`);
    });
    on('changedata-goldWarn', () => {
      if (!this.goldText) return;
      this.goldText.setColor(DUNGEON_UI_CSS.EMBER);
      this.tweens.add({
        targets: this.goldText, alpha: { from: 0.4, to: 1 },
        duration: 80, yoyo: true, repeat: 2,
        onComplete: () => this.goldText?.setColor(DUNGEON_UI_CSS.TEXT),
      });
    });
    on('changedata-gems', (_: unknown, v: number) => {
      this.gems = v; this.gemsText?.setText(`보석 ${formatHudResourceValue(v)}`);
    });
    on('changedata-traitCallout', (_: unknown, v: TraitCalloutPayload | null) => {
      if (v) this.showTraitBanner(v.title, v.blurb);
    });
    on('changedata-hp', (_: unknown, v: number) => {
      if (v < this.hp) {
        this.flashDamageVignette();
        // HP text scale/color pulse
        if (this.hpText) {
          this.tweens.killTweensOf(this.hpText);
          this.hpText.setScale(1.35).setColor(CASUAL_CSS.RED);
          this.tweens.add({
            targets: this.hpText, scaleX: 1, scaleY: 1,
            duration: 260, ease: 'Back.easeIn',
            onComplete: () => this.hpText?.setColor(DUNGEON_UI_CSS.TEXT),
          });
        }
        // HP fill alpha pulse
        if (this.hpFill) {
          this.tweens.killTweensOf(this.hpFill);
          this.hpFill.setAlpha(0.4);
          this.tweens.add({
            targets: this.hpFill, alpha: 1, duration: 220, ease: 'Quad.easeOut',
          });
        }
      }
      this.hp = v; this.redrawHp();
    });
    on('changedata-wave', (_: unknown, v: number) => {
      this.wave = v;
      const isFinal = this.maxWave < 9999 && v > 0 && v === this.maxWave;
      this.waveLabel?.setText(this.getWaveLabel());
      this.waveLabel?.setColor(isFinal ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.TEXT);
      this.redrawWaveProgress();
    });
    on('changedata-maxWave', (_: unknown, v: number) => {
      this.maxWave = v;
      this.waveLabel?.setText(this.getWaveLabel());
      this.redrawWaveProgress();
    });
    on('changedata-status', (_: unknown, v: string) => {
      this.statusText?.setText(v);
      this.statusBg?.setAlpha(v ? 1 : 0);
    });
    on('changedata-remainingInvaders', (_: unknown, v: number) => {
      if (v > 0) {
        this.remainingText?.setText(`잔여 ${v}`);
        this.remainingText?.setColor(v <= 3 ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED);
        this.remainingPillBg?.setAlpha(1);
        const reducedMotion = getReducedMotion();
        if (v <= 3 && !reducedMotion && this.remainingText) {
          this.tweens.killTweensOf(this.remainingText);
          this.tweens.add({
            targets: this.remainingText,
            scaleX: { from: 1.2, to: 1 },
            scaleY: { from: 1.2, to: 1 },
            duration: 180,
            ease: 'Back.easeOut',
          });
        }
      } else {
        this.remainingText?.setText('');
        this.remainingPillBg?.setAlpha(0);
      }
    });
  }

  /** First-appearance trait callout for a special invader (rendered in the HUD). */
  private showTraitBanner(title: string, blurb: string): void {
    const y = 158;
    const titleT = this.add.text(0, -9, `위협 감지 · ${title}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0.5);
    const blurbT = this.add.text(0, 9, blurb, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5);

    const w = Math.max(titleT.width, blurbT.width) + 28;
    const h = 40;
    const bg = this.add.graphics();
    bg.fillStyle(DUNGEON_UI.VOID, 0.5);
    bg.fillRoundedRect(-w / 2, -h / 2 + 2, w, h, 9);
    bg.fillStyle(DUNGEON_UI.STONE, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    bg.fillStyle(DUNGEON_UI.EMBER, 0.8);
    bg.fillRect(-w / 2 + 1, -h / 2 + 5, 3, h - 10);
    bg.lineStyle(1.5, DUNGEON_UI.EMBER, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);

    const ctr = this.add.container(CANVAS_WIDTH / 2, y, [bg, titleT, blurbT]).setDepth(330).setAlpha(0);
    const reduced = getReducedMotion();
    this.tweens.add({
      targets: ctr, alpha: 1, y: reduced ? y : y - 8,
      duration: reduced ? 120 : 240, ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: ctr, alpha: 0, delay: 1900, duration: 420,
      onComplete: () => ctr.destroy(),
    });
  }

  private showSpeedToast(speed: 1 | 2 | 3): void {
    const label = speed === 3 ? '⚡⚡ 3× 초고속 적용'
                : speed === 2 ? '⚡ 2× 배속 적용'
                :               '▶ 1× 일반 속도';
    const toast = this.add.text(CANVAS_WIDTH / 2, 120, label, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: speed > 1 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.TEXT,
        backgroundColor: '#080b09', padding: { x: 14, y: 6 },
      }).setOrigin(0.5).setDepth(200).setAlpha(0);
    this.tweens.add({
      targets: toast, alpha: 1, duration: 150, ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(800, () => {
          this.tweens.add({
            targets: toast, alpha: 0, duration: 300,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  private showModifierToast(icon: string, name: string, desc: string): void {
    const toast = this.add.text(CANVAS_WIDTH / 2, 130, `${icon} ${name}\n${desc}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', align: 'center',
      color: CASUAL_CSS.PURPLE, backgroundColor: '#080b09',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(200).setAlpha(0);
    this.tweens.add({
      targets: toast, alpha: 1, duration: 150, ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets: toast, alpha: 0, duration: 300,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }
}
