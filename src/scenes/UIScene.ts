import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, TOP_BAR_HEIGHT } from '../constants/layout';
import { getGameSafeArea } from '../constants/safeArea';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private gemsText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Graphics;
  private waveLabel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private gold    = 500;
  private gems    = 200;
  private hp      = 1000;
  private maxHp   = 1000;
  private wave    = 0;
  private maxWave = 10;

  constructor() { super({ key: 'UIScene' }); }

  create(): void {
    // Safe area offset — pushes all HUD elements below the device notch/status bar
    const { top: st } = getGameSafeArea(this.scale.displayScale.x);
    this.safeTop = st;

    this.drawBar();
    this.createHUD();
    this.bindRegistry();
  }

  private safeTop = 0;

  private drawBar(): void {
    const st = this.safeTop;
    const g = this.add.graphics();

    // Base fill — extends from y=0 to cover under the notch
    g.fillStyle(COLORS.BLACK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, TOP_BAR_HEIGHT + st);

    // Stone texture rows
    for (let y = 0; y < TOP_BAR_HEIGHT + st; y += 10) {
      g.fillStyle(COLORS.STONE_DARK, 0.22);
      g.fillRect(0, y, CANVAS_WIDTH, 5);
    }

    // Top edge highlight
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(0, 0, CANVAS_WIDTH, 2);

    // Gold bottom border
    g.fillStyle(COLORS.TORCH_GOLD, 1);
    g.fillRect(0, TOP_BAR_HEIGHT + st - 4, CANVAS_WIDTH, 4);

    // Inner glow line just above border
    g.fillStyle(COLORS.TORCH_AMBER, 0.3);
    g.fillRect(0, TOP_BAR_HEIGHT + st - 7, CANVAS_WIDTH, 3);
  }

  private createHUD(): void {
    const st = this.safeTop;

    // Sync initial values from registry (set by DungeonScene before UIScene launches)
    this.gold   = this.registry.get('gold')  ?? 500;
    this.gems   = this.registry.get('gems')  ?? 200;
    this.hp     = this.registry.get('hp')    ?? 1000;
    this.maxHp  = this.registry.get('hp')    ?? 1000;
    this.wave   = this.registry.get('wave')  ?? 0;

    // ── Title ──────────────────────────────────────────────
    // Shadow layer
    this.add.text(18, st + 16, '던전 수호자', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '22px',
      color: '#3a1800',
    });
    // Main title
    this.add.text(16, st + 14, '던전 수호자', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '22px',
      color: CSS.TORCH_AMBER,
    });
    this.add.text(16, st + 40, 'DUNGEON  GUARDIAN', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CSS.PARCHMENT_MUTED,
      letterSpacing: 4,
    });

    // ── Wave pill (left, row 2) ────────────────────────────
    const wavePill = this.add.graphics();
    wavePill.fillStyle(COLORS.STONE_DARK, 1);
    wavePill.fillRoundedRect(12, st + 58, 88, 26, 4);
    wavePill.lineStyle(1, COLORS.BLOOD_RED, 0.5);
    wavePill.strokeRoundedRect(12, st + 58, 88, 26, 4);

    this.waveLabel = this.add.text(56, st + 71, `침략 ${this.wave}/${this.maxWave}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT,
    }).setOrigin(0.5);

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
    const hbx = 108;
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
    this.redrawHp();

    // ── Status text (wave info) ───────────────────────────
    this.statusText = this.add.text(CANVAS_WIDTH / 2, TOP_BAR_HEIGHT + st + 10, '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
  }

  private safeHby = 60;

  private redrawHp(): void {
    const hbx = 108, hby = this.safeHby, hbw = CANVAS_WIDTH - hbx - 8, hbh = 14;
    const pct  = this.hp / this.maxHp;
    const col  = pct > 0.6 ? COLORS.MOSS_LIGHT : pct > 0.3 ? COLORS.TORCH_GOLD : COLORS.BLOOD_GLOW;
    this.hpFill.clear();
    this.hpFill.fillStyle(col, 1);
    this.hpFill.fillRoundedRect(hbx + 1, hby + 1, Math.max(1, (hbw - 2) * pct), hbh - 2, 2);
  }

  private bindRegistry(): void {
    this.registry.events.on('changedata-gold', (_: unknown, v: number) => {
      this.gold = v; this.goldText?.setText(v.toLocaleString('ko-KR'));
    });
    this.registry.events.on('changedata-gems', (_: unknown, v: number) => {
      this.gems = v; this.gemsText?.setText(v.toLocaleString('ko-KR'));
    });
    this.registry.events.on('changedata-hp', (_: unknown, v: number) => {
      this.hp = v; this.redrawHp();
    });
    this.registry.events.on('changedata-wave', (_: unknown, v: number) => {
      this.wave = v;
      this.waveLabel?.setText(`침략 ${v}/${this.maxWave}`);
    });
    this.registry.events.on('changedata-status', (_: unknown, v: string) => {
      this.statusText?.setText(v);
    });
  }
}
