import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TOP_BAR_HEIGHT } from '../constants/layout';
import { getReducedMotion } from '../utils/reducedMotion';
import { getEndlessModifierById } from '../data/endlessModifiers';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private gemsText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Graphics;
  private hpText?: Phaser.GameObjects.Text;
  private waveLabel!: Phaser.GameObjects.Text;
  private waveProgress?: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
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

    // Chunky cream header bar — extends from y=0 to cover under the notch.
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, TOP_BAR_HEIGHT + st);

    // Top edge highlight strip
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(0, 0, CANVAS_WIDTH, 3);

    // Chunky brown bottom edge
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, TOP_BAR_HEIGHT + st - 3, CANVAS_WIDTH, 3);
  }

  private createHUD(): void {
    const st = this.safeTop;

    // Sync initial values from registry (set by DungeonScene before UIScene launches)
    this.gold   = this.registry.get('gold')  ?? 500;
    this.gems   = this.registry.get('gems')  ?? 0;
    this.hp     = this.registry.get('hp')    ?? 1000;
    this.maxHp  = this.registry.get('hp')    ?? 1000;
    this.wave   = this.registry.get('wave')  ?? 0;
    this.maxWave = this.registry.get('maxWave') ?? 10;

    // ── Title ──────────────────────────────────────────────
    const titlePlate = this.add.graphics();
    titlePlate.fillStyle(CASUAL.PANEL, 1);
    titlePlate.fillRoundedRect(10, st + 8, 154, 44, 9);
    titlePlate.lineStyle(2, CASUAL.EDGE, 1);
    titlePlate.strokeRoundedRect(10, st + 8, 154, 44, 9);
    titlePlate.fillStyle(0xffffff, 0.14);
    titlePlate.fillRoundedRect(18, st + 14, 138, 3, 2);

    // Main title
    this.add.text(16, st + 16, '던전 방어전', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    });
    this.add.text(18, st + 38, 'DUNGEON DEFENSE', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    });

    // ── Wave pill (left, row 2) — wave counter only ────────────────────────
    const wavePill = this.add.graphics();
    wavePill.fillStyle(CASUAL.PANEL, 1);
    wavePill.fillRoundedRect(12, st + 58, 86, 26, 6);
    wavePill.lineStyle(2, CASUAL.EDGE, 1);
    wavePill.strokeRoundedRect(12, st + 58, 86, 26, 6);
    wavePill.fillStyle(0xffffff, 0.14);
    wavePill.fillRoundedRect(20, st + 62, 48, 3, 2);

    this.waveLabel = this.add.text(55, st + 71, this.getWaveLabel(), {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0.5);
    this.waveProgress = this.add.graphics();
    this.redrawWaveProgress();

    // ── Speed toggle — separate mini pill ────────────────
    const speedPill = this.add.graphics();
    speedPill.fillStyle(CASUAL.PANEL_SOFT, 1);
    speedPill.fillRoundedRect(102, st + 58, 36, 26, 6);
    speedPill.lineStyle(2, CASUAL.EDGE, 1);
    speedPill.strokeRoundedRect(102, st + 58, 36, 26, 6);
    speedPill.fillStyle(0xffffff, 0.14);
    speedPill.fillRoundedRect(106, st + 62, 28, 3, 2);

    this.speedBtn = this.add.text(120, st + 71, '1x', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.speedBtn.on('pointerdown', () => {
      // Cycle 1× → 2× → 3× → 1× (3× = grinding-friendly ultra speed).
      this.currentSpeed = (this.currentSpeed >= 3 ? 1 : this.currentSpeed + 1) as 1 | 2 | 3;
      this.speedBtn.setText(this.currentSpeed + 'x');
      this.speedBtn.setColor(this.currentSpeed > 1 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT);
      this.registry.set('battleSpeed', this.currentSpeed);
      this.showSpeedToast(this.currentSpeed);
    });

    // ── Pause button (right of wave pill) ────────────────
    const pausePill = this.add.graphics();
    pausePill.fillStyle(CASUAL.PANEL_SOFT, 1);
    pausePill.fillRoundedRect(136, st + 58, 28, 26, 6);
    pausePill.lineStyle(2, CASUAL.EDGE, 1);
    pausePill.strokeRoundedRect(136, st + 58, 28, 26, 6);
    pausePill.fillStyle(0xffffff, 0.14);
    pausePill.fillRoundedRect(140, st + 61, 20, 3, 2);

    this.pauseBtn = this.add.text(150, st + 71, '⏸', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => {
      this.isPaused = !this.isPaused;
      this.pauseBtn.setText(this.isPaused ? '▶' : '⏸');
      this.pauseBtn.setColor(this.isPaused ? CASUAL_CSS.GOLD : CASUAL_CSS.INK);
      this.registry.set('battlePaused', this.isPaused);
    });

    // ── Endless high score ────────────────────────────────
    const endlessHS = this.registry.get('endlessHighScore') as number | undefined;
    if (endlessHS !== undefined) {
      this.add.text(106, st + 71, `🏆 최고: ${endlessHS}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0, 0.5);
    }

    // ── Endless challenge modifier chip (도전 변수) ──────────
    const modifier = getEndlessModifierById(this.registry.get('endlessModifier') as string | null);
    if (modifier) {
      const my = st + 88;
      const mw = 124;
      const modChip = this.add.graphics();
      modChip.fillStyle(CASUAL.PANEL, 1);
      modChip.fillRoundedRect(12, my, mw, 18, 6);
      modChip.lineStyle(1.5, CASUAL.PURPLE, 1);
      modChip.strokeRoundedRect(12, my, mw, 18, 6);
      this.add.text(18, my + 9, `${modifier.icon} ${modifier.name}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
      }).setOrigin(0, 0.5);
      // Tap the chip to recap the modifier's effect.
      this.add.zone(12 + mw / 2, my + 9, mw, 18)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.showModifierToast(modifier.icon, modifier.name, modifier.desc));
    }

    // ── Gold pill ─────────────────────────────────────────
    const gx = CANVAS_WIDTH - 196;
    const goldPill = this.add.graphics();
    goldPill.fillStyle(CASUAL.PANEL, 1);
    goldPill.fillRoundedRect(gx, st + 8, 90, 30, 7);
    goldPill.lineStyle(2, CASUAL.EDGE, 1);
    goldPill.strokeRoundedRect(gx, st + 8, 90, 30, 7);
    goldPill.fillStyle(0xffffff, 0.14);
    goldPill.fillRoundedRect(gx + 6, st + 12, 78, 3, 2);

    // coin icon
    goldPill.fillStyle(CASUAL.GOLD, 1);
    goldPill.fillCircle(gx + 13, st + 23, 7);
    goldPill.lineStyle(1.5, CASUAL.GOLD_DK, 1);
    goldPill.strokeCircle(gx + 13, st + 23, 7);
    goldPill.fillStyle(0xffffff, 0.35);
    goldPill.fillCircle(gx + 11, st + 21, 3);

    this.add.text(gx + 26, st + 12, '황금', { fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT });
    this.goldText = this.add.text(gx + 26, st + 23, this.gold.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);

    // ── Gem pill ─────────────────────────────────────────
    const px = CANVAS_WIDTH - 100;
    const gemPill = this.add.graphics();
    gemPill.fillStyle(CASUAL.PANEL, 1);
    gemPill.fillRoundedRect(px, st + 8, 90, 30, 7);
    gemPill.lineStyle(2, CASUAL.EDGE, 1);
    gemPill.strokeRoundedRect(px, st + 8, 90, 30, 7);
    gemPill.fillStyle(0xffffff, 0.14);
    gemPill.fillRoundedRect(px + 6, st + 12, 78, 3, 2);

    // gem icon (diamond)
    gemPill.fillStyle(CASUAL.BLUE, 1);
    gemPill.fillTriangle(px + 13, st + 16, px + 7, st + 23, px + 19, st + 23);
    gemPill.fillStyle(CASUAL.PURPLE, 1);
    gemPill.fillTriangle(px + 13, st + 30, px + 7, st + 23, px + 19, st + 23);

    this.add.text(px + 26, st + 12, '보석', { fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT });
    this.gemsText = this.add.text(px + 26, st + 23, this.gems.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);

    // ── HP bar ────────────────────────────────────────────
    const hbx = 138;
    const hby = st + 60;
    const hbw = CANVAS_WIDTH - hbx - 8;
    const hbh = 14;

    this.add.text(hbx, hby - 1, '던전 내구도', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 1);

    const hpBg = this.add.graphics();
    hpBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    hpBg.fillRoundedRect(hbx, hby, hbw, hbh, 4);
    hpBg.lineStyle(2, CASUAL.EDGE, 1);
    hpBg.strokeRoundedRect(hbx, hby, hbw, hbh, 4);

    this.hpFill = this.add.graphics();
    this.safeHby = hby;

    // Numerical HP readout — right-aligned above the bar (always legible regardless of fill)
    this.hpText = this.add.text(hbx + hbw, hby - 1, '', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(1, 1).setDepth(103);

    this.redrawHp();

    // ── Remaining invaders counter — mini pill below HP bar ──
    this.remainingPillBg = this.add.graphics();
    this.remainingPillBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    this.remainingPillBg.fillRoundedRect(hbx, hby + hbh + 4, 80, 18, 6);
    this.remainingPillBg.lineStyle(1.5, CASUAL.EDGE, 1);
    this.remainingPillBg.strokeRoundedRect(hbx, hby + hbh + 4, 80, 18, 6);
    this.remainingPillBg.setAlpha(0);

    this.remainingText = this.add.text(hbx + 40, hby + hbh + 13, '', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0.5).setDepth(103);

    // ── Status text (wave info) ───────────────────────────
    this.statusText = this.add.text(CANVAS_WIDTH / 2, TOP_BAR_HEIGHT + st + 10, '', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0);
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
    const startX = 24;
    const y = st + 80;
    const gap = 7;

    for (let i = 0; i < pipCount; i++) {
      const active = i < activeCount;
      const current = active && i === activeCount - 1;
      g.fillStyle(active ? CASUAL.GOLD : CASUAL.EDGE_SOFT, active ? 1 : 0.8);
      g.fillCircle(startX + i * gap, y, current ? 2.6 : 2.1);
      if (current) {
        g.lineStyle(1, CASUAL.GOLD_DK, 0.9);
        g.strokeCircle(startX + i * gap, y, 4.1);
      }
    }
  }

  private redrawHp(): void {
    const hbx = 138, hby = this.safeHby, hbw = CANVAS_WIDTH - hbx - 8, hbh = 14;
    const pct  = this.hp / this.maxHp;
    const col  = pct > 0.6 ? CASUAL.GREEN : pct > 0.3 ? CASUAL.GOLD : CASUAL.RED;
    this.hpFill.clear();
    this.hpFill.fillStyle(col, 1);
    this.hpFill.fillRoundedRect(hbx + 2, hby + 2, Math.max(1, (hbw - 4) * pct), hbh - 4, 3);
    this.hpText?.setText(`${this.hp} / ${this.maxHp}`);

    // HP danger pulse — start when ≤20%, stop when recovered
    if (pct <= 0.2 && !this.hpPulseTween) {
      if (!this.hpPulseOverlay) {
        this.hpPulseOverlay = this.add.graphics().setDepth(102);
        this.hpPulseOverlay.fillStyle(CASUAL.RED, 1);
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
      this.gold = v; this.goldText?.setText(v.toLocaleString('ko-KR'));
    });
    on('changedata-goldWarn', () => {
      if (!this.goldText) return;
      this.goldText.setColor(CASUAL_CSS.RED);
      this.tweens.add({
        targets: this.goldText, alpha: { from: 0.4, to: 1 },
        duration: 80, yoyo: true, repeat: 2,
        onComplete: () => this.goldText?.setColor(CASUAL_CSS.INK),
      });
    });
    on('changedata-gems', (_: unknown, v: number) => {
      this.gems = v; this.gemsText?.setText(v.toLocaleString('ko-KR'));
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
            onComplete: () => this.hpText?.setColor(CASUAL_CSS.INK),
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
      this.waveLabel?.setColor(isFinal ? CASUAL_CSS.RED : CASUAL_CSS.INK);
      this.redrawWaveProgress();
    });
    on('changedata-maxWave', (_: unknown, v: number) => {
      this.maxWave = v;
      this.waveLabel?.setText(this.getWaveLabel());
      this.redrawWaveProgress();
    });
    on('changedata-status', (_: unknown, v: string) => {
      this.statusText?.setText(v);
    });
    on('changedata-remainingInvaders', (_: unknown, v: number) => {
      if (v > 0) {
        this.remainingText?.setText(`👾 ${v}명`);
        this.remainingText?.setColor(v <= 3 ? CASUAL_CSS.RED : CASUAL_CSS.INK_SOFT);
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

  private showSpeedToast(speed: 1 | 2 | 3): void {
    const label = speed === 3 ? '⚡⚡ 3× 초고속 적용'
                : speed === 2 ? '⚡ 2× 배속 적용'
                :               '▶ 1× 일반 속도';
    const toast = this.add.text(CANVAS_WIDTH / 2, 120, label, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: speed > 1 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK,
        backgroundColor: CASUAL_CSS.CREAM, padding: { x: 14, y: 6 },
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
      color: CASUAL_CSS.PURPLE, backgroundColor: CASUAL_CSS.CREAM,
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
