import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TOP_BAR_HEIGHT } from '../constants/layout';

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
  private currentSpeed: 1 | 2 = 1;
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

    // Base fill — extends from y=0 to cover under the notch.
    g.fillGradientStyle(0x06131d, 0x06131d, 0x11283a, 0x1c1730, 1, 1, 1, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, TOP_BAR_HEIGHT + st);

    // Command-room texture rows
    for (let y = 0; y < TOP_BAR_HEIGHT + st; y += 12) {
      g.fillStyle(0x4bd5ff, 0.045);
      g.fillRect(0, y, CANVAS_WIDTH, 3);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(0, y + 7, CANVAS_WIDTH, 2);
    }

    // Top edge highlight
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(0, 0, CANVAS_WIDTH, 2);

    // Bottom command border
    g.fillStyle(0x4bd5ff, 0.36);
    g.fillRect(0, TOP_BAR_HEIGHT + st - 6, CANVAS_WIDTH, 2);
    g.fillStyle(COLORS.TORCH_GOLD, 0.92);
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
    titlePlate.fillStyle(0x071824, 0.86);
    titlePlate.fillRoundedRect(10, st + 8, 154, 44, 9);
    titlePlate.lineStyle(1.2, 0x4bd5ff, 0.46);
    titlePlate.strokeRoundedRect(10, st + 8, 154, 44, 9);
    titlePlate.fillStyle(COLORS.TORCH_GOLD, 0.16);
    titlePlate.fillRoundedRect(18, st + 14, 138, 3, 2);

    // Shadow layer
    this.add.text(18, st + 18, '던전 방어전', {
      fontFamily: "Trebuchet MS, Apple SD Gothic Neo, sans-serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#021018',
    });
    // Main title
    this.add.text(16, st + 16, '던전 방어전', {
      fontFamily: "Trebuchet MS, Apple SD Gothic Neo, sans-serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    });
    this.add.text(18, st + 38, 'DUNGEON DEFENSE', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#9fd9ea',
    });

    // ── Wave pill + speed toggle (left, row 2) ────────────────────────────
    const wavePill = this.add.graphics();
    wavePill.fillStyle(0x071824, 0.96);
    wavePill.fillRoundedRect(12, st + 58, 120, 26, 4);
    wavePill.lineStyle(1, 0x4bd5ff, 0.44);
    wavePill.strokeRoundedRect(12, st + 58, 120, 26, 4);
    wavePill.fillStyle(COLORS.TORCH_GOLD, 0.14);
    wavePill.fillRoundedRect(20, st + 62, 68, 3, 2);
    // Divider between wave label and speed button
    wavePill.lineStyle(1, 0x4bd5ff, 0.24);
    wavePill.lineBetween(96, st + 62, 96, st + 80);

    this.waveLabel = this.add.text(54, st + 71, this.getWaveLabel(), {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.waveProgress = this.add.graphics();
    this.redrawWaveProgress();

    // ── Speed toggle button ───────────────────────────────
    this.speedBtn = this.add.text(110, st + 71, '1x', {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.speedBtn.on('pointerdown', () => {
      this.currentSpeed = this.currentSpeed === 1 ? 2 : 1;
      this.speedBtn.setText(this.currentSpeed + 'x');
      this.speedBtn.setColor(this.currentSpeed === 2 ? '#ffcc44' : CSS.PARCHMENT_MUTED);
      this.registry.set('battleSpeed', this.currentSpeed);
      this.showSpeedToast(this.currentSpeed);
    });

    // ── Pause button (right of wave pill) ────────────────
    const pausePill = this.add.graphics();
    pausePill.fillStyle(COLORS.STONE_DARK, 1);
    pausePill.fillRoundedRect(136, st + 58, 28, 26, 4);
    pausePill.lineStyle(1, 0x444444, 0.5);
    pausePill.strokeRoundedRect(136, st + 58, 28, 26, 4);

    this.pauseBtn = this.add.text(150, st + 71, '⏸', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => {
      this.isPaused = !this.isPaused;
      this.pauseBtn.setText(this.isPaused ? '▶' : '⏸');
      this.pauseBtn.setColor(this.isPaused ? '#ffcc44' : CSS.PARCHMENT_MUTED);
      this.registry.set('battlePaused', this.isPaused);
    });

    // ── Endless high score ────────────────────────────────
    const endlessHS = this.registry.get('endlessHighScore') as number | undefined;
    if (endlessHS !== undefined) {
      this.add.text(106, st + 71, `🏆 최고: ${endlessHS}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0, 0.5);
    }

    // ── Gold pill ─────────────────────────────────────────
    const gx = CANVAS_WIDTH - 196;
    const goldPill = this.add.graphics();
    goldPill.fillStyle(COLORS.STONE_DARK, 1);
    goldPill.fillRoundedRect(gx, st + 8, 90, 30, 5);
    goldPill.lineStyle(1, COLORS.TORCH_GOLD, 0.5);
    goldPill.strokeRoundedRect(gx, st + 8, 90, 30, 5);

    // coin icon
    goldPill.fillStyle(COLORS.TORCH_GOLD, 1);
    goldPill.fillCircle(gx + 13, st + 23, 7);
    goldPill.fillStyle(COLORS.BLACK, 0.3);
    goldPill.fillCircle(gx + 13, st + 23, 4);

    this.add.text(gx + 26, st + 12, '황금', { fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED });
    this.goldText = this.add.text(gx + 26, st + 23, this.gold.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0, 0.5);

    // ── Gem pill ─────────────────────────────────────────
    const px = CANVAS_WIDTH - 100;
    const gemPill = this.add.graphics();
    gemPill.fillStyle(COLORS.STONE_DARK, 1);
    gemPill.fillRoundedRect(px, st + 8, 90, 30, 5);
    gemPill.lineStyle(1, COLORS.MAGIC_GLOW, 0.45);
    gemPill.strokeRoundedRect(px, st + 8, 90, 30, 5);

    // gem icon (diamond)
    gemPill.fillStyle(COLORS.MAGIC_GLOW, 0.9);
    gemPill.fillTriangle(px + 13, st + 16, px + 7, st + 23, px + 19, st + 23);
    gemPill.fillTriangle(px + 13, st + 30, px + 7, st + 23, px + 19, st + 23);

    this.add.text(px + 26, st + 12, '보석', { fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED });
    this.gemsText = this.add.text(px + 26, st + 23, this.gems.toLocaleString('ko-KR'), {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#b080f0',
    }).setOrigin(0, 0.5);

    // ── HP bar ────────────────────────────────────────────
    const hbx = 138;
    const hby = st + 60;
    const hbw = CANVAS_WIDTH - hbx - 8;
    const hbh = 14;

    this.add.text(hbx, hby - 1, '던전 내구도', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 1);

    const hpBg = this.add.graphics();
    hpBg.fillStyle(COLORS.BLACK, 1);
    hpBg.fillRoundedRect(hbx, hby, hbw, hbh, 2);
    hpBg.lineStyle(0.5, COLORS.STONE_DARK, 0.7);
    hpBg.strokeRoundedRect(hbx, hby, hbw, hbh, 2);

    this.hpFill = this.add.graphics();
    this.safeHby = hby;

    // Numerical HP readout inside the bar
    this.hpText = this.add.text(hbx + hbw / 2, hby + hbh / 2, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(103).setAlpha(0.85);

    this.redrawHp();

    // ── Remaining invaders counter (right of HP bar label) ──
    this.remainingText = this.add.text(CANVAS_WIDTH - 8, hby - 1, '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(1, 1);

    // ── Status text (wave info) ───────────────────────────
    this.statusText = this.add.text(CANVAS_WIDTH / 2, TOP_BAR_HEIGHT + st + 10, '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
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
      g.fillStyle(active ? COLORS.TORCH_GOLD : 0x29465a, active ? 0.92 : 0.74);
      g.fillCircle(startX + i * gap, y, current ? 2.6 : 2.1);
      if (current) {
        g.lineStyle(1, COLORS.TORCH_AMBER, 0.62);
        g.strokeCircle(startX + i * gap, y, 4.1);
      }
    }
  }

  private redrawHp(): void {
    const hbx = 138, hby = this.safeHby, hbw = CANVAS_WIDTH - hbx - 8, hbh = 14;
    const pct  = this.hp / this.maxHp;
    const col  = pct > 0.6 ? COLORS.MOSS_LIGHT : pct > 0.3 ? COLORS.TORCH_GOLD : COLORS.BLOOD_GLOW;
    this.hpFill.clear();
    this.hpFill.fillStyle(col, 1);
    this.hpFill.fillRoundedRect(hbx + 1, hby + 1, Math.max(1, (hbw - 2) * pct), hbh - 2, 2);
    this.hpText?.setText(`${this.hp} / ${this.maxHp}`);

    // HP danger pulse — start when ≤20%, stop when recovered
    if (pct <= 0.2 && !this.hpPulseTween) {
      if (!this.hpPulseOverlay) {
        this.hpPulseOverlay = this.add.graphics().setDepth(102);
        this.hpPulseOverlay.fillStyle(COLORS.BLOOD_GLOW, 1);
        this.hpPulseOverlay.fillRoundedRect(hbx, hby, hbw, hbh, 2);
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
      this.goldText.setColor('#ff4444');
      this.tweens.add({
        targets: this.goldText, alpha: { from: 0.4, to: 1 },
        duration: 80, yoyo: true, repeat: 2,
        onComplete: () => this.goldText?.setColor(CSS.TORCH_AMBER),
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
          this.hpText.setScale(1.35).setColor('#ff4444');
          this.tweens.add({
            targets: this.hpText, scaleX: 1, scaleY: 1,
            duration: 260, ease: 'Back.easeIn',
            onComplete: () => this.hpText?.setColor('#ffffff'),
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
      this.waveLabel?.setColor(isFinal ? '#ff4444' : CSS.PARCHMENT);
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
        this.remainingText?.setColor(v <= 3 ? '#ffcc44' : CSS.PARCHMENT_MUTED);
      } else {
        this.remainingText?.setText('');
      }
    });
  }

  private showSpeedToast(speed: 1 | 2): void {
    const toast = this.add.text(CANVAS_WIDTH / 2, 120,
      speed === 2 ? '⚡ 2× 배속 적용' : '▶ 1× 일반 속도', {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: speed === 2 ? '#ffcc44' : CSS.PARCHMENT,
        backgroundColor: '#000000cc', padding: { x: 14, y: 6 },
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
}
