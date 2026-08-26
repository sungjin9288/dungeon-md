import Phaser from 'phaser';
import { addTabBar } from '../ui/GameUiPrimitives';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { loadGameState } from '../data/wisdom';
import { audioManager } from '../audio/AudioManager';
import { MONSTER_DEFS } from '../data/monsters';
import { getActiveBanner, type SeasonBanner } from '../data/banners';
import {
  type SummonType, type SummonTypeDef, SUMMON_TYPE_DEFS,
  RARITY_RATES, RARITIES, RARITY_COLORS,
} from '../data/summonPools';
import { buildBannerCard } from '../ui/SummonBannerCard';
import { executePull as runPull } from '../ui/SummonPullLogic';
import {
  RARITY_STARS, RARITY_CSS, RARITY_KO,
} from '../data/summonPools';
import { CX, CARD_W, CARD_H, CARD_GAP, CARD_ML, CARDS_Y, PORTAL_CY, TAB_Y } from '../ui/SummonShared';
import { drawCollectionShowcase } from '../ui/SummonShowcase';
import { getContextualBackTarget } from '../data/navigationContract';
import { buildZoneBackButton } from '../ui/GameZoneNavigation';
import { getReducedMotion } from '../utils/reducedMotion';
import {
  buildHistoryTab, rebuildHistory,
  type SummonHistoryContext, type HistoryFilter,
} from '../ui/SummonHistory';

// ─── Scene ────────────────────────────────────────────────────────────────────

export class SummonScene extends Phaser.Scene {
  private summonTabContainer!: Phaser.GameObjects.Container;
  private historyTabContainer!: Phaser.GameObjects.Container;
  private historyFilter: HistoryFilter = 'all';
  private portalGraphics!: Phaser.GameObjects.Graphics;
  private runeGraphics!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'SummonScene' }); }

  create(): void {
    this.drawBackground();
    this.drawPortal();
    drawCollectionShowcase(this);
    this.drawHeader();
    this.drawTabBar();
    this.buildSummonTab();
    this.buildHistoryTabLocal();
    this.showTab('summon');
    this.checkFreeReminderBadge();

    audioManager.resume().then(() => audioManager.playBgm('summon'));
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);

    // Rune particles are decorative; reduced-motion keeps the static portal only.
    if (!getReducedMotion()) {
      this.add.particles(CX, CANVAS_HEIGHT / 2, 'dust', {
        x: { min: -CX, max: CX },
        y: { min: -CANVAS_HEIGHT / 2, max: CANVAS_HEIGHT / 2 },
        alpha: { min: 0.03, max: 0.2 },
        scale: { min: 0.1, max: 0.4 },
        tint: [0x9966ff, 0xcc44ff, 0x4444ff, 0xffffff],
        lifespan: { min: 2500, max: 6000 },
        speedX: { min: -5, max: 5 },
        speedY: { min: -5, max: 5 },
        frequency: 120, quantity: 1,
      }).setDepth(0);
    }
  }

  // ─── Portal animation ────────────────────────────────────────────────────────

  private drawPortal(): void {
    this.portalGraphics = this.add.graphics().setDepth(3);
    this.runeGraphics   = this.add.graphics().setDepth(4);

    // Portal + floating runes — reduced-motion draws one stable frame.
    const drawPortalFrame = (t: number): void => {
      if (!this.portalGraphics.active) return;
      this.portalGraphics.clear();

      // Outer glow rings (3 rings, different speeds + radii) — CASUAL palette
      const rings = [
        { r: 52, speed: 0.4,  color: CASUAL.PURPLE_DK, alpha: 0.18 },
        { r: 40, speed: 0.7,  color: CASUAL.PURPLE,    alpha: 0.30 },
        { r: 28, speed: 1.1,  color: 0xd49cff,         alpha: 0.45 },
      ];
      for (const ring of rings) {
        const pulse = 1 + 0.08 * Math.sin(t * ring.speed * 2.5);
        this.portalGraphics.lineStyle(3, ring.color, ring.alpha * (0.8 + 0.2 * Math.sin(t * ring.speed)));
        this.portalGraphics.strokeCircle(CX, PORTAL_CY, ring.r * pulse);
      }

      // Inner core glow — CASUAL.PURPLE
      for (let r = 18; r >= 4; r -= 3) {
        this.portalGraphics.fillStyle(CASUAL.PURPLE, 0.04 * (20 - r));
        this.portalGraphics.fillCircle(CX, PORTAL_CY, r);
      }

      // Center orb
      this.portalGraphics.fillStyle(0xffffff, 0.7 + 0.15 * Math.sin(t * 3));
      this.portalGraphics.fillCircle(CX, PORTAL_CY, 6);

      // Floating runes (8 small circles orbiting) — CASUAL.PURPLE tint
      this.runeGraphics.clear();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.6;
        const rx    = CX + Math.cos(angle) * 60;
        const ry    = PORTAL_CY + Math.sin(angle) * 22;
        const alpha = 0.25 + 0.25 * Math.sin(t * 1.5 + i);
        this.runeGraphics.fillStyle(CASUAL.PURPLE, alpha);
        this.runeGraphics.fillCircle(rx, ry, 3.5);
      }
    };
    if (getReducedMotion()) {
      drawPortalFrame(0);
    } else {
      this.time.addEvent({
        delay: 33,
        repeat: -1,
        callback: () => drawPortalFrame(this.time.now * 0.001),
      });
    }

    // Portal emoji label above
    this.add.text(CX, PORTAL_CY - 22, '🌌', {
      fontFamily: 'sans-serif', fontSize: '32px',
    }).setOrigin(0.5).setDepth(5);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    buildZoneBackButton(this, {
      label: '← 군단',
      onBack: () => this.scene.start(getContextualBackTarget('SummonScene')),
    });
    this.add.text(CX, 22, '군단 · 몬스터 소환', {
      fontFamily: 'sans-serif', fontSize: '19px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    // Resource bar
    const gs = loadGameState();
    this.add.text(CX - 10, 47, `💎 ${gs.gems}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.BLUE,
    }).setOrigin(1, 0.5).setDepth(10);
    this.add.text(CX + 10, 47, `💠 ${gs.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
    }).setOrigin(0, 0.5).setDepth(10);
  }

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  private activeTab: 'summon' | 'history' = 'summon';
  private tabBarContainer!: Phaser.GameObjects.Container;

  private drawTabBar(): void {
    const { container } = addTabBar(this, {
      tabs: [
        { id: 'summon',  label: '🌀 소환', accent: CASUAL.PURPLE },
        { id: 'history', label: '📜 기록', accent: CASUAL.BLUE   },
      ],
      active:   this.activeTab,
      y:        TAB_Y,
      accent:   CASUAL.PURPLE,
      height:   32,
      fontSize: '12px',
      depth:    8,
      onSelect: (id) => this.showTab(id as 'summon' | 'history'),
    });
    this.tabBarContainer = container;
  }

  private showTab(tab: 'summon' | 'history'): void {
    this.activeTab = tab;
    this.summonTabContainer.setVisible(tab === 'summon');
    this.historyTabContainer.setVisible(tab === 'history');

    // Rebuild tab bar to reflect new active state
    this.tabBarContainer.destroy();
    this.drawTabBar();
  }

  // ─── Summon tab ─────────────────────────────────────────────────────────────

  private activeBanner: SeasonBanner | null = null;

  private buildSummonTab(): void {
    this.summonTabContainer = this.add.container(0, 0).setDepth(7);

    this.activeBanner = getActiveBanner();
    let cardsOffsetY = 0;

    if (this.activeBanner) {
      const BANNER_H = 96;
      this.buildBannerCard(this.activeBanner, CARDS_Y);
      cardsOffsetY = BANNER_H + 10;
    }

    SUMMON_TYPE_DEFS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx  = CARD_ML + col * (CARD_W + CARD_GAP) + CARD_W / 2;
      const y   = CARDS_Y + cardsOffsetY + row * (CARD_H + CARD_GAP);
      this.buildSummonCard(def, cx, y);
    });
  }

  private buildBannerCard(banner: SeasonBanner, topY: number): void {
    buildBannerCard(this, this.summonTabContainer, banner, topY);
  }

  private buildSummonCard(def: SummonTypeDef, cx: number, cardTop: number): void {
    const c = this.summonTabContainer;
    const gs = loadGameState();

    // ── Background ──────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(cx - CARD_W / 2 + 2, cardTop + 3, CARD_W, CARD_H, 8);
    bg.fillStyle(def.bgColor, 1);
    bg.fillRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 8);
    bg.lineStyle(1.5, def.border, 0.9);
    bg.strokeRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 8);
    // Inner highlight line at top
    bg.lineStyle(1, def.border, 0.3);
    bg.lineBetween(cx - CARD_W / 2 + 10, cardTop + 1, cx + CARD_W / 2 - 10, cardTop + 1);
    bg.fillStyle(def.border, 0.08);
    bg.fillCircle(cx, cardTop + 36, 38);
    c.add(bg);

    this.drawSummonPackSkin(c, def, cx, cardTop);

    // ── Icon ─────────────────────────────────────────────────────
    c.add(this.add.text(cx, cardTop + 26, def.icon, {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));

    // ── Name ─────────────────────────────────────────────────────
    c.add(this.add.text(cx, cardTop + 54, def.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: def.accent,
    }).setOrigin(0.5));

    // ── Cost ─────────────────────────────────────────────────────
    const currencyIcon = def.currency === 'gems' ? '💎' : def.currency === 'soul' ? '💠' : '🤝';
    if (def.currency === 'fp') {
      c.add(this.add.text(cx, cardTop + 70, '무료 1회/일', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 70, `${currencyIcon} ${def.cost1}/뽑`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));
    }
    if (def.cost10 !== null) {
      c.add(this.add.text(cx, cardTop + 81, `×10: ${def.cost10}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#777777',
      }).setOrigin(0.5));
    }
    if (def.id === 'soul') {
      c.add(this.add.text(cx, cardTop + 81, '미보유만', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#44ffcc',
      }).setOrigin(0.5));
    }

    // ── Divider ──────────────────────────────────────────────────
    const dg = this.add.graphics();
    dg.lineStyle(1, def.border, 0.3);
    dg.lineBetween(cx - CARD_W / 2 + 10, cardTop + 90, cx + CARD_W / 2 - 10, cardTop + 90);
    c.add(dg);

    // ── Buttons ──────────────────────────────────────────────────
    const btnY = cardTop + 106;
    this.makeCardBtn(c, def, cx + (def.cost10 !== null ? -44 : 0), btnY, '1회', () => this.executePull(def.id, 1));
    if (def.cost10 !== null) {
      this.makeCardBtn(c, def, cx + 44, btnY, '10회', () => this.executePull(def.id, 10));
    } else if (def.id === 'friendship') {
      this.makeFriendBtn(c, def, cx, btnY, gs);
    }

    // ── 확률 보기 ────────────────────────────────────────────────
    if (def.id !== 'friendship') {
      const rateY = cardTop + 176;
      const rateT = this.add.text(cx, rateY, '확률 보기 ▼', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#664488',
      }).setOrigin(0.5);
      c.add(rateT);
      const rateZone = this.add.zone(cx, rateY, 96, 44)
        .setInteractive({ useHandCursor: true });
      rateZone.on('pointerdown', () => this.showRatesModal(def.id));
      c.add(rateZone);
    }

    // ── Pity bar (normal / special only) ─────────────────────────
    if (def.hasPity) {
      const pityKey = def.id as 'normal' | 'special';
      const pity    = gs.summonPity?.[pityKey] ?? { count: 0, guaranteed: def.id === 'normal' ? 50 : 80 };
      const pct     = pity.count / pity.guaranteed;
      const barX    = cx - CARD_W / 2 + 12;
      const barW    = CARD_W - 24;
      const barY    = cardTop + 134;

      const pg = this.add.graphics();
      pg.fillStyle(0x1c1208, 1);
      pg.fillRoundedRect(barX, barY, barW, 6, 3);
      pg.fillStyle(def.border, 0.8);
      pg.fillRoundedRect(barX, barY, barW * pct, 6, 3);
      c.add(pg);

      const remaining = pity.guaranteed - pity.count;
      c.add(this.add.text(cx, barY + 10, `천장까지 ${remaining}회`, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#664488',
      }).setOrigin(0.5));

      // desc badge
      c.add(this.add.text(cx, cardTop + 158, def.desc, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#444466',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 148, def.desc, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#444466',
      }).setOrigin(0.5));
    }
  }

  private drawSummonPackSkin(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number,
    cardTop: number,
  ): void {
    const gs = loadGameState();
    const rates = RARITY_RATES[def.id];
    const highRate = (rates[3] ?? 0) + (rates[4] ?? 0);
    const rateLabel = def.id === 'friendship' ? 'C/U' : `E+ ${highRate}%`;
    const today = new Date().toISOString().slice(0, 10);
    const isFriendReady = def.id === 'friendship' && gs.lastFriendSummon !== today;
    const pity = def.hasPity
      ? gs.summonPity?.[def.id as 'normal' | 'special'] ?? { count: 0, guaranteed: def.id === 'normal' ? 50 : 80 }
      : null;
    const pityPct = pity ? Phaser.Math.Clamp(pity.count / pity.guaranteed, 0, 1) : 0;
    const stateAccent = isFriendReady ? 0x66ffcc : pityPct >= 0.75 ? 0xffd66b : def.border;

    const deco = this.add.graphics();
    deco.fillStyle(0xffffff, 0.08);
    deco.fillRoundedRect(cx - 28, cardTop + 10, 56, 44, 8);
    deco.lineStyle(1, def.border, 0.35);
    deco.strokeRoundedRect(cx - 28, cardTop + 10, 56, 44, 8);
    deco.fillStyle(def.border, 0.10);
    deco.fillRoundedRect(cx - 20, cardTop + 16, 40, 32, 6);
    deco.fillStyle(def.border, 0.06);
    deco.fillCircle(cx, cardTop + 32, 42);
    deco.lineStyle(1, def.border, 0.22);
    deco.strokeCircle(cx, cardTop + 32, 35);
    deco.lineStyle(1.5, stateAccent, def.hasPity || isFriendReady ? 0.68 : 0.34);
    deco.beginPath();
    deco.arc(
      cx,
      cardTop + 32,
      41,
      Phaser.Math.DegToRad(-92),
      Phaser.Math.DegToRad(-92 + 360 * (def.hasPity ? pityPct : isFriendReady ? 1 : highRate / 100)),
    );
    deco.strokePath();
    deco.fillStyle(0x0a0602, 0.82);
    deco.fillRoundedRect(cx - CARD_W / 2 + 9, cardTop + 9, 47, 16, 6);
    deco.fillRoundedRect(cx + CARD_W / 2 - 58, cardTop + 9, 49, 16, 6);
    deco.lineStyle(1, def.border, 0.42);
    deco.strokeRoundedRect(cx - CARD_W / 2 + 9, cardTop + 9, 47, 16, 6);
    deco.strokeRoundedRect(cx + CARD_W / 2 - 58, cardTop + 9, 49, 16, 6);
    deco.fillStyle(0x0a0602, 0.88);
    deco.fillRoundedRect(cx + 34, cardTop + 62, 47, 15, 6);
    deco.lineStyle(1, stateAccent, 0.52);
    deco.strokeRoundedRect(cx + 34, cardTop + 62, 47, 15, 6);
    deco.fillStyle(stateAccent, 0.12);
    deco.fillCircle(cx + 43, cardTop + 69.5, 4.2);
    c.add(deco);

    const packBadge = this.add.text(cx - CARD_W / 2 + 32, cardTop + 17, 'PACK', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#f6eaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(packBadge);

    const rateBadge = this.add.text(cx + CARD_W / 2 - 33.5, cardTop + 17, rateLabel, {
      fontFamily: 'sans-serif', fontSize: '8px', color: def.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(rateBadge);
    c.add(this.add.text(cx + 58, cardTop + 69.5, def.hasPity ? `천장 ${Math.round(pityPct * 100)}%` : isFriendReady ? '무료' : '팩', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: isFriendReady ? '#b8fff0' : def.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const rarityY = cardTop + 92;
    const activeRates = rates
      .map((rate, idx) => ({ rate, idx }))
      .filter(item => item.rate > 0);
    const startX = cx - ((activeRates.length - 1) * 20) / 2;
    activeRates.forEach((item, i) => {
      const dot = this.add.graphics();
      const x = startX + i * 20;
      dot.fillStyle(RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.18 : 0.08);
      dot.fillCircle(x, rarityY, item.idx >= 3 ? 6.2 : 4.8);
      dot.fillStyle(RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.9 : 0.55);
      dot.fillCircle(x, rarityY, item.idx >= 3 ? 3.6 : 2.7);
      dot.lineStyle(0.8, RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.54 : 0.26);
      dot.strokeCircle(x, rarityY, item.idx >= 3 ? 6.2 : 4.8);
      c.add(dot);
    });

    c.add(this.add.text(cx - 50, cardTop + 32, '✦', {
      fontFamily: 'sans-serif', fontSize: '10px', color: def.accent,
    }).setOrigin(0.5));
    c.add(this.add.text(cx + 50, cardTop + 38, '✦', {
      fontFamily: 'sans-serif', fontSize: '8px', color: def.accent,
    }).setOrigin(0.5));
  }

  private makeCardBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number, y: number,
    label: string,
    cb: () => void,
  ): void {
    const w = 68, h = 24;
    const bg = this.add.graphics();
    bg.fillStyle(def.border, 0.2);
    bg.fillRoundedRect(cx - w / 2, y - h / 2, w, h, 6);
    bg.lineStyle(1, def.border, 0.7);
    bg.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, 6);
    c.add(bg);

    const t = this.add.text(cx, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: def.accent,
    }).setOrigin(0.5);
    c.add(t);

    // Hit zone
    const zone = this.add.zone(cx, y, w + 4, 44)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
    c.add(zone);
  }

  private makeFriendBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number, y: number,
    gs: ReturnType<typeof loadGameState>,
  ): void {
    const today = new Date().toISOString().slice(0, 10);
    const used  = gs.lastFriendSummon === today;

    if (used) {
      // Show countdown
      const now      = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const secsLeft = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
      const ss = String(secsLeft % 60).padStart(2, '0');
      c.add(this.add.text(cx, y, `⏰ ${hh}:${mm}:${ss}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#666644',
      }).setOrigin(0.5));
    } else {
      this.makeCardBtn(c, def, cx, y, '1회 (무료)', () => this.executePull('friendship', 1));
    }
  }

  // ─── Rates modal ────────────────────────────────────────────────────────────

  private showRatesModal(type: SummonType): void {
    const overlay = this.add.container(0, 0).setDepth(80);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    overlay.add(dim);

    // Panel
    const panelW = 280, panelH = 280;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = (CANVAS_HEIGHT - panelH) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x281808, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1.5, 0x8866ff, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    overlay.add(panel);

    const def = SUMMON_TYPE_DEFS.find(d => d.id === type)!;
    overlay.add(this.add.text(CANVAS_WIDTH / 2, panelY + 20, `${def.icon} ${def.name} 확률`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc88ff',
    }).setOrigin(0.5));

    const rates = RARITY_RATES[type];
    let rowY = panelY + 46;
    RARITIES.forEach((_rarity, idx) => {
      if (rates[idx] === 0) return;
      overlay.add(this.add.text(panelX + 24, rowY, RARITY_STARS[idx], {
        fontFamily: 'sans-serif', fontSize: '11px',
      }));
      overlay.add(this.add.text(panelX + 80, rowY, RARITY_KO[idx], {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_CSS[idx],
      }));
      overlay.add(this.add.text(panelX + panelW - 20, rowY, `${rates[idx]}%`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ffffff',
      }).setOrigin(1, 0));
      rowY += 24;
    });

    // Pity note
    if (def.hasPity) {
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 10, `천장: ${def.id === 'normal' ? 50 : 80}회 → ${def.pityRarity} 보장`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#8866aa',
      }).setOrigin(0.5));
      rowY += 28;
    }

    // Banner featured info
    if (this.activeBanner && (this.activeBanner.validSummonTypes as string[]).includes(type)) {
      const b = this.activeBanner;
      const divG = this.add.graphics();
      divG.lineStyle(1, b.borderColor, 0.4);
      divG.lineBetween(panelX + 16, rowY + 4, panelX + panelW - 16, rowY + 4);
      overlay.add(divG);

      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 16, `${b.icon} ${b.name} 피처드`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: b.accentCss, fontStyle: 'bold',
      }).setOrigin(0.5));

      const boostPct = Math.round(b.rateMultiplier * 100);
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 30, `${RARITY_KO[RARITIES.indexOf(b.boostedRarity)]} 등급 뽑기 시 ${boostPct}% 확률로 피처드`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));

      const emojis = b.featuredMonsters.slice(0, 5).map(id => {
        const md = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
        return md?.emoji ?? '👾';
      }).join(' ');
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 44, emojis, {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5));
    }

    // Close button
    const closeT = this.add.text(CANVAS_WIDTH / 2, panelY + panelH - 22, '닫기  ✕', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
      backgroundColor: '#1a0030', padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive();
    closeT.on('pointerdown', () => overlay.destroy());
    overlay.add(closeT);

    // tap dim to close
    const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setInteractive().setOrigin(0);
    closeZone.on('pointerdown', () => overlay.destroy());
    overlay.add(closeZone);
    closeZone.setDepth(-1); // behind close btn
  }

  // ─── History tab ─────────────────────────────────────────────────────────────

  private buildHistoryTabLocal(): void {
    const ctx: SummonHistoryContext = {
      historyFilter: this.historyFilter,
      onFilterChange: (filter: HistoryFilter) => {
        this.historyFilter = filter;
        const updatedCtx: SummonHistoryContext = {
          historyFilter: this.historyFilter,
          onFilterChange: ctx.onFilterChange,
        };
        rebuildHistory(this, this.historyTabContainer, updatedCtx);
      },
    };
    this.historyTabContainer = buildHistoryTab(this, ctx);
  }

  // ─── Execute pull ────────────────────────────────────────────────────────────

  private executePull(type: SummonType, count: number): void {
    runPull(
      { scene: this, activeBanner: this.activeBanner, showToast: (msg) => this.showToast(msg) },
      type,
      count,
    );
  }

  // ─── Friend summon reminder ────────────────────────────────────────────────

  private checkFreeReminderBadge(): void {
    const gs    = loadGameState();
    const today = new Date().toISOString().slice(0, 10);
    if (gs.lastFriendSummon !== today) {
      // Brief toast reminder
      this.time.delayedCall(1200, () => {
        if (this.scene.isActive()) {
          this.showToast('🤝 오늘의 무료 소환이 준비됐습니다!');
        }
      });
    }
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────

  private showToast(msg: string): void {
    const t = this.add.text(CX, CANVAS_HEIGHT - 80, msg, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ffaaff',
      backgroundColor: '#1a0030', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 2000, onComplete: () => t.destroy() });
  }
}
