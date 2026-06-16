import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { loadGameState } from '../data/wisdom';
import { addSceneHeader, addTabBar } from '../ui/GameUiPrimitives';
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
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);

    // Soft cream product tray behind the shop cards (below the tab bar).
    const trayY = 100;
    const trayH = CANVAS_HEIGHT - trayY - 12;
    const g = this.add.graphics().setDepth(-9);
    g.fillStyle(CASUAL.SHADOW, 0.16);
    g.fillRoundedRect(8, trayY + 4, CANVAS_WIDTH - 16, trayH, 18);
    g.fillStyle(CASUAL.PANEL_SOFT, 0.92);
    g.fillRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 18);
    g.lineStyle(3, CASUAL.EDGE, 0.9);
    g.strokeRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 18);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(13, trayY + 5, CANVAS_WIDTH - 26, 6, 3);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    addSceneHeader(this, {
      title:  '🏪 상점',
      onBack: () => this.scene.start('BarracksScene'),
    });

    const gs = loadGameState();
    this.gemsText = this.add.text(CANVAS_WIDTH / 2 - 10, 50, `💎 ${gs.gems}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.BLUE, fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(10);
    this.add.text(CANVAS_WIDTH / 2 + 10, 50, `💠 ${gs.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.PURPLE, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(10);

    const msUntilReset = 86_400_000 - (Date.now() % 86_400_000);
    const h = Math.floor(msUntilReset / 3_600_000);
    const m = Math.floor((msUntilReset % 3_600_000) / 60_000);
    const s = Math.floor((msUntilReset % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timerText = this.add.text(CANVAS_WIDTH - 12, 52,
      `🔄 ${pad(h)}:${pad(m)}:${pad(s)}`, {
      fontFamily: 'monospace', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
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
    addTabBar<ShopTab>(this, {
      tabs: [
        { id: 'skin',      label: '🎨 스킨' },
        { id: 'theme',     label: '🏰 테마' },
        { id: 'equipment', label: '⚒️ 장비' },
        { id: 'skill',     label: '✨ 스킬' },
      ],
      active:    this.activeTab,
      y:         66,
      height:    28,
      fontSize:  '11px',
      accent:    CASUAL.PURPLE,
      accentCSS: CASUAL_CSS.PURPLE,
      onSelect:  id => { this.activeTab = id; this.scene.restart(); },
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
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.WHITE,
      backgroundColor: '#2f8f3a', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(300);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 1500, onComplete: () => t.destroy() });
  }
}
