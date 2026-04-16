import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { buildSkinTab, type SkinFilter, type ShopSkinTabContext } from '../ui/ShopSkinTab';
import { buildThemeTab, type ShopThemeTabContext } from '../ui/ShopThemeTab';
import { buildEquipmentTab, buildSkillTab, type ShopDailyTabContext } from '../ui/ShopDailyTab';

type ShopTab = 'skin' | 'equipment' | 'skill' | 'theme';

export class ShopScene extends Phaser.Scene {
  private activeTab:   ShopTab    = 'skin';
  private skinFilter:  SkinFilter = 'all';
  private contentCtr!: Phaser.GameObjects.Container;
  private gemsText!:   Phaser.GameObjects.Text;

  constructor() { super({ key: 'ShopScene' }); }

  create(): void {
    this.skinFilter = 'all';
    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.buildContent();
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x050010, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.lineStyle(1, 0x1a1a3a, 0.3);
    for (let y = 80; y < CANVAS_HEIGHT; y += 80) g.lineBetween(0, y, CANVAS_WIDTH, y);
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(0, CANVAS_WIDTH);
      const sy = Phaser.Math.Between(0, CANVAS_HEIGHT);
      g.fillStyle(0xffffff, Math.random() * 0.15 + 0.05);
      g.fillCircle(sx, sy, Math.random() + 0.5);
    }
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.add.text(28, 24, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
      backgroundColor: '#2d2416', padding: { x: 8, y: 4 },
    }).setInteractive().setDepth(10)
      .on('pointerdown', () => this.scene.start('BarracksScene'));

    this.add.text(CANVAS_WIDTH / 2, 28, '🏪 상점', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    const gs = loadGameState();
    this.gemsText = this.add.text(CANVAS_WIDTH / 2, 50, `💎 ${gs.gems} 젬`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#88aaff',
    }).setOrigin(0.5).setDepth(10);

    const msUntilReset = 86_400_000 - (Date.now() % 86_400_000);
    const h = Math.floor(msUntilReset / 3_600_000);
    const m = Math.floor((msUntilReset % 3_600_000) / 60_000);
    const s = Math.floor((msUntilReset % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timerText = this.add.text(CANVAS_WIDTH - 12, 52,
      `🔄 ${pad(h)}:${pad(m)}:${pad(s)}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6688aa',
    }).setOrigin(1, 0.5).setDepth(10);

    let remaining = Math.floor(msUntilReset / 1000);
    const tick = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        remaining = Math.max(0, remaining - 1);
        const th = Math.floor(remaining / 3600);
        const tm = Math.floor((remaining % 3600) / 60);
        const ts = remaining % 60;
        timerText.setText(`🔄 ${pad(th)}:${pad(tm)}:${pad(ts)}`);
      },
    });
    this.events.once('shutdown', () => tick.remove());
  }

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'skin',      label: '🎨 스킨' },
      { id: 'theme',     label: '🏰 테마' },
      { id: 'equipment', label: '⚒️ 장비' },
      { id: 'skill',     label: '✨ 스킬' },
    ];
    const tabW = CANVAS_WIDTH / tabs.length;
    const tabY = 66;
    const g = this.add.graphics().setDepth(9);

    tabs.forEach(({ id, label }, i) => {
      const tx = i * tabW;
      const isActive = id === this.activeTab;

      g.fillStyle(isActive ? 0x1a1a3a : 0x0a0a18, 1);
      g.fillRect(tx, tabY, tabW, 28);
      g.lineStyle(1, isActive ? 0x8866ff : 0x2a2a4a, 0.8);
      if (isActive) {
        g.lineBetween(tx, tabY + 27, tx + tabW, tabY + 27);
      }

      this.add.text(tx + tabW / 2, tabY + 14, label, {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: isActive ? '#cc88ff' : CSS.PARCHMENT_MUTED,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(10);

      const zone = this.add.zone(tx + tabW / 2, tabY + 14, tabW, 28)
        .setInteractive().setDepth(11);
      zone.on('pointerdown', () => {
        if (this.activeTab !== id) {
          this.activeTab = id;
          this.scene.restart();
        }
      });
    });
  }

  // ─── Content dispatcher ─────────────────────────────────────────────────────

  private buildContent(): void {
    this.contentCtr?.destroy();
    this.contentCtr = this.add.container(0, 0).setDepth(5);

    if (this.activeTab === 'skin')      this.buildSkinTabContent();
    if (this.activeTab === 'theme')     this.buildThemeTabContent();
    if (this.activeTab === 'equipment') this.buildEquipmentTabContent();
    if (this.activeTab === 'skill')     this.buildSkillTabContent();
  }

  // ─── Tab delegators ─────────────────────────────────────────────────────────

  private buildSkinTabContent(): void {
    const ctx: ShopSkinTabContext = {
      scene:              this,
      contentCtr:         this.contentCtr,
      gemsText:           this.gemsText,
      showToast:          (msg) => this.showToast(msg),
      showPurchaseFlash:  (cost, icon, color) => this.showPurchaseFlash(cost, icon, color),
      refreshContent:     () => this.buildContent(),
    };
    buildSkinTab(ctx, {
      skinFilter:    this.skinFilter,
      setSkinFilter: (f) => { this.skinFilter = f; },
    });
  }

  private buildThemeTabContent(): void {
    const ctx: ShopThemeTabContext = {
      scene:             this,
      contentCtr:        this.contentCtr,
      gemsText:          this.gemsText,
      showToast:         (msg) => this.showToast(msg),
      showPurchaseFlash: (cost, icon, color) => this.showPurchaseFlash(cost, icon, color),
      refreshContent:    () => this.buildContent(),
    };
    buildThemeTab(ctx);
  }

  private buildEquipmentTabContent(): void {
    const ctx: ShopDailyTabContext = {
      scene:          this,
      contentCtr:     this.contentCtr,
      showToast:      (msg) => this.showToast(msg),
      refreshContent: () => this.buildContent(),
    };
    buildEquipmentTab(ctx);
  }

  private buildSkillTabContent(): void {
    const ctx: ShopDailyTabContext = {
      scene:          this,
      contentCtr:     this.contentCtr,
      showToast:      (msg) => this.showToast(msg),
      refreshContent: () => this.buildContent(),
    };
    buildSkillTab(ctx);
  }

  // ─── Purchase flash ─────────────────────────────────────────────────────────

  showPurchaseFlash(cost: number, icon: string, color: string): void {
    const f = this.add.text(CANVAS_WIDTH / 2, 68, `-${cost}${icon}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(250).setAlpha(0);
    this.tweens.add({
      targets: f, y: 92, alpha: { from: 1, to: 0 },
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => f.destroy(),
    });

    if (this.gemsText) {
      this.tweens.killTweensOf(this.gemsText);
      this.gemsText.setScale(1.3);
      this.tweens.add({
        targets: this.gemsText, scaleX: 1, scaleY: 1,
        duration: 260, ease: 'Back.easeIn',
      });
    }
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────

  showToast(msg: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#88ffaa',
      backgroundColor: '#002200', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(300);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 1500, onComplete: () => t.destroy() });
  }
}
